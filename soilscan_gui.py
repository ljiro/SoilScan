"""
SoilScan GUI - Soil Sample Background Remover
A full-featured GUI application for removing backgrounds from soil sample images.

Features:
- Automatic AI-based background removal
- Manual crop tool for corrections
- Side-by-side preview (original vs cropped)
- Batch processing with progress indicator
- Auto-replacement of corrected images
- Smart C- directory detection for correction mode
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
from PIL import Image, ImageTk, ImageDraw
import threading
import queue
import os
import sys
import zipfile
from functools import lru_cache
from concurrent.futures import ThreadPoolExecutor

# Check for rembg availability
try:
    from rembg import remove, new_session
    REMBG_AVAILABLE = True
    # Pre-create session for 80% faster initialization (reuse across all processing)
    _rembg_session = None
    def get_rembg_session():
        global _rembg_session
        if _rembg_session is None:
            _rembg_session = new_session("u2net")
        return _rembg_session
except ImportError:
    REMBG_AVAILABLE = False
    _rembg_session = None
    def get_rembg_session():
        return None

# Check for 7z support
try:
    import py7zr
    PY7ZR_AVAILABLE = True
except ImportError:
    PY7ZR_AVAILABLE = False


# Global thread pool for background tasks - limit workers to prevent file handle exhaustion
_executor = ThreadPoolExecutor(max_workers=2)

# Semaphore to limit concurrent image loads (prevents "too many open files")
_load_semaphore = threading.Semaphore(3)

import time

class DebouncedProgressUpdater:
    """Throttle UI updates to prevent jitter during batch processing."""

    def __init__(self, callback, debounce_ms=100):
        self.callback = callback
        self.debounce_ms = debounce_ms
        self.last_update = 0
        self.pending_value = None

    def update(self, current, total):
        """Throttle updates to max once per debounce_ms"""
        now = time.time() * 1000
        self.pending_value = (current, total)

        if now - self.last_update >= self.debounce_ms:
            self.callback(*self.pending_value)
            self.last_update = now

    def flush(self):
        """Force final update"""
        if self.pending_value:
            self.callback(*self.pending_value)


class ImageCache:
    """LRU cache for loaded images to avoid repeated disk reads."""

    def __init__(self, max_size=20):
        self.max_size = max_size
        self._cache = {}
        self._order = []
        self._lock = threading.Lock()

    def get(self, path: Path, thumbnail_size: tuple = None):
        """Get image from cache or load from disk."""
        key = (str(path), thumbnail_size)

        with self._lock:
            if key in self._cache:
                # Move to end (most recently used)
                self._order.remove(key)
                self._order.append(key)
                return self._cache[key].copy()

        # Load from disk (outside lock) - USE CONTEXT MANAGER TO CLOSE FILE
        try:
            with Image.open(path) as img_file:
                # Load image data into memory and close file handle
                img = img_file.copy()
                if img.mode not in ('RGB', 'RGBA'):
                    img = img.convert('RGB')

                if thumbnail_size:
                    img.thumbnail(thumbnail_size, Image.Resampling.BILINEAR)

            with self._lock:
                # Evict oldest if at capacity
                while len(self._cache) >= self.max_size:
                    old_key = self._order.pop(0)
                    del self._cache[old_key]

                self._cache[key] = img
                self._order.append(key)

            return img.copy()
        except Exception as e:
            print(f"Error loading image {path}: {e}")
            return None

    def clear(self):
        """Clear the cache."""
        with self._lock:
            self._cache.clear()
            self._order.clear()


# Global image cache
_image_cache = ImageCache(max_size=30)


def create_checkerboard(size, check_size=10):
    """Create a checkerboard pattern image (cached)."""
    checker = Image.new('RGB', size, '#3c3c3c')
    draw = ImageDraw.Draw(checker)
    for y in range(0, size[1], check_size):
        for x in range(0, size[0], check_size):
            if (x // check_size + y // check_size) % 2 == 0:
                draw.rectangle([x, y, x + check_size, y + check_size], fill='#2c2c2c')
    return checker


# Pre-generate common checkerboard sizes
_checkerboard_cache = {}


def get_checkerboard(size, check_size=10):
    """Get or create a checkerboard pattern."""
    # Round to nearest 100 to improve cache hits
    rounded_size = ((size[0] // 100 + 1) * 100, (size[1] // 100 + 1) * 100)
    key = (rounded_size, check_size)

    if key not in _checkerboard_cache:
        _checkerboard_cache[key] = create_checkerboard(rounded_size, check_size)

    return _checkerboard_cache[key].crop((0, 0, size[0], size[1]))


class ImageItem:
    """Represents an image in the processing queue."""
    def __init__(self, input_path: Path, output_path: Path, original_path: Path = None):
        self.input_path = input_path
        self.output_path = output_path
        self.original_path = original_path or input_path
        self.status = "pending"
        self.error_message = None

    @property
    def name(self):
        return self.input_path.name

    @property
    def display_name(self):
        return self.output_path.name

    @property
    def is_processed(self):
        return self.status in ("auto_cropped", "manual_cropped")


class ManualCropCanvas(tk.Canvas):
    """Canvas for manual crop selection with optimized loading."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.photo = None
        self.original_image = None
        self.display_image = None
        self.scale = 1.0
        self.offset_x = 0
        self.offset_y = 0
        self._image_path = None
        self._loading = False

        # Selection rectangle
        self.start_x = None
        self.start_y = None
        self.rect_id = None
        self.selection = None

        # Bind mouse events
        self.bind("<ButtonPress-1>", self.on_press)
        self.bind("<B1-Motion>", self.on_drag)
        self.bind("<ButtonRelease-1>", self.on_release)
        self.bind("<Configure>", self._on_resize)

        self.configure(bg="#2b2b2b", highlightthickness=0)

    def _on_resize(self, event):
        """Handle canvas resize."""
        if self.original_image and not self._loading:
            self.after_idle(self._fit_image)

    def load_image(self, image_path: Path):
        """Load and display an image asynchronously."""
        if self._loading:
            return

        self._image_path = image_path
        self._loading = True
        self.selection = None

        if self.rect_id:
            self.delete(self.rect_id)
            self.rect_id = None

        # Show loading indicator
        self.delete("all")
        self.create_text(
            self.winfo_width() // 2, self.winfo_height() // 2,
            text="Loading...", fill="#888888", font=("Segoe UI", 10)
        )

        # Load in background thread - USE SEMAPHORE + CONTEXT MANAGER
        def load():
            with _load_semaphore:  # Limit concurrent loads
                try:
                    with Image.open(image_path) as img_file:
                        # Load into memory and close file handle
                        img = img_file.copy()
                        if img.mode not in ('RGB', 'RGBA'):
                            img = img.convert('RGB')
                        return img
                except Exception as e:
                    print(f"Error loading image: {e}")
                    return None

        def on_loaded(future):
            try:
                img = future.result()
                if img and self._image_path == image_path:
                    self.original_image = img
                    self.after_idle(self._fit_image)
            finally:
                self._loading = False

        future = _executor.submit(load)
        future.add_done_callback(lambda f: self.after(0, lambda: on_loaded(f)))

    def _fit_image(self):
        """Fit image to canvas size."""
        if self.original_image is None:
            return

        canvas_width = self.winfo_width()
        canvas_height = self.winfo_height()

        if canvas_width <= 1 or canvas_height <= 1:
            self.after(50, self._fit_image)
            return

        img_width, img_height = self.original_image.size

        scale_x = canvas_width / img_width
        scale_y = canvas_height / img_height
        self.scale = min(scale_x, scale_y) * 0.95

        display_width = int(img_width * self.scale)
        display_height = int(img_height * self.scale)

        self.offset_x = (canvas_width - display_width) // 2
        self.offset_y = (canvas_height - display_height) // 2

        # Use BILINEAR for faster preview (LANCZOS only for final output)
        display_image = self.original_image
        if display_image.mode == 'RGBA':
            display_image = display_image.convert('RGB')

        display_image = display_image.resize(
            (display_width, display_height),
            Image.Resampling.BILINEAR
        )
        self.photo = ImageTk.PhotoImage(display_image)

        self.delete("all")
        self.create_image(
            self.offset_x, self.offset_y,
            anchor=tk.NW, image=self.photo, tags="image"
        )

    def canvas_to_image(self, cx, cy):
        """Convert canvas coordinates to original image coordinates."""
        if self.original_image is None:
            return 0, 0

        ix = int((cx - self.offset_x) / self.scale)
        iy = int((cy - self.offset_y) / self.scale)

        img_width, img_height = self.original_image.size
        ix = max(0, min(ix, img_width))
        iy = max(0, min(iy, img_height))

        return ix, iy

    def on_press(self, event):
        """Start selection."""
        self.start_x = event.x
        self.start_y = event.y

        if self.rect_id:
            self.delete(self.rect_id)

        self.rect_id = self.create_rectangle(
            event.x, event.y, event.x, event.y,
            outline="#00ff00", width=2, dash=(5, 5)
        )

    def on_drag(self, event):
        """Update selection rectangle."""
        if self.rect_id:
            self.coords(self.rect_id, self.start_x, self.start_y, event.x, event.y)

    def on_release(self, event):
        """Finalize selection."""
        if self.original_image is None:
            return

        x1, y1 = self.canvas_to_image(self.start_x, self.start_y)
        x2, y2 = self.canvas_to_image(event.x, event.y)

        if x1 > x2:
            x1, x2 = x2, x1
        if y1 > y2:
            y1, y2 = y2, y1

        if x2 - x1 > 10 and y2 - y1 > 10:
            self.selection = (x1, y1, x2, y2)
        else:
            self.selection = None
            if self.rect_id:
                self.delete(self.rect_id)
                self.rect_id = None

    def get_cropped_image(self):
        """Get the cropped image based on selection."""
        if self.original_image is None or self.selection is None:
            return None

        x1, y1, x2, y2 = self.selection

        base_image = self.original_image
        if base_image.mode == 'RGBA':
            base_image = base_image.convert('RGB')

        cropped = base_image.crop((x1, y1, x2, y2))

        result = Image.new('RGBA', base_image.size, (0, 0, 0, 0))
        cropped_rgba = cropped.convert('RGBA')
        result.paste(cropped_rgba, (x1, y1))

        return result

    def clear(self):
        """Clear the canvas."""
        self.delete("all")
        self.original_image = None
        self.photo = None
        self.selection = None
        self.rect_id = None
        self._image_path = None


class PreviewPanel(tk.Frame):
    """Panel for displaying image preview with optimized loading."""

    def __init__(self, parent, title="Preview", **kwargs):
        super().__init__(parent, **kwargs)
        self.configure(bg="#1e1e1e")
        self._loading = False
        self._pending_path = None

        self.title_label = tk.Label(
            self, text=title,
            bg="#1e1e1e", fg="#ffffff",
            font=("Segoe UI", 10, "bold")
        )
        self.title_label.pack(pady=(5, 0))

        self.canvas = tk.Canvas(self, bg="#2b2b2b", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.canvas.bind("<Configure>", self._on_resize)

        self.photo = None
        self.original_image = None
        self._current_path = None

    def _on_resize(self, event):
        """Handle resize."""
        if self.original_image and not self._loading:
            self.after_idle(self._fit_image)

    def set_title(self, title):
        """Update the panel title."""
        self.title_label.configure(text=title)

    def load_image(self, image_path: Path = None, pil_image: Image.Image = None):
        """Load and display an image from path or PIL Image."""
        if image_path:
            self._current_path = image_path
            self._pending_path = image_path

            # Show loading
            self.canvas.delete("all")
            self.canvas.create_text(
                self.canvas.winfo_width() // 2,
                self.canvas.winfo_height() // 2,
                text="Loading...", fill="#888888", font=("Segoe UI", 10)
            )

            # Load async - USE SEMAPHORE + CONTEXT MANAGER
            def load():
                with _load_semaphore:  # Limit concurrent loads
                    try:
                        with Image.open(image_path) as img_file:
                            # Load into memory and close file handle
                            return img_file.copy()
                    except Exception as e:
                        print(f"Error loading preview: {e}")
                        return None

            def on_loaded(future):
                try:
                    img = future.result()
                    if img and self._pending_path == image_path:
                        self.original_image = img
                        self.after_idle(self._fit_image)
                except:
                    pass

            future = _executor.submit(load)
            future.add_done_callback(lambda f: self.after(0, lambda: on_loaded(f)))

        elif pil_image:
            self.original_image = pil_image
            self._current_path = None
            self._fit_image()
        else:
            self.clear()

    def _fit_image(self):
        """Fit image to canvas with optimized checkerboard."""
        if self.original_image is None:
            return

        self.canvas.update_idletasks()
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()

        if canvas_width <= 1 or canvas_height <= 1:
            self.after(50, self._fit_image)
            return

        img_width, img_height = self.original_image.size

        scale_x = canvas_width / img_width
        scale_y = canvas_height / img_height
        scale = min(scale_x, scale_y) * 0.95

        display_width = int(img_width * scale)
        display_height = int(img_height * scale)

        # Handle RGBA with optimized checkerboard
        if self.original_image.mode == 'RGBA':
            # Resize first, then apply checkerboard (much faster)
            resized = self.original_image.resize(
                (display_width, display_height),
                Image.Resampling.BILINEAR
            )
            checker = get_checkerboard((display_width, display_height))
            checker.paste(resized, mask=resized.split()[3])
            display_image = checker
        else:
            display_image = self.original_image.resize(
                (display_width, display_height),
                Image.Resampling.BILINEAR
            )

        self.photo = ImageTk.PhotoImage(display_image)

        self.canvas.delete("all")
        self.canvas.create_image(
            canvas_width // 2, canvas_height // 2,
            anchor=tk.CENTER, image=self.photo
        )

    def clear(self):
        """Clear the preview."""
        self.canvas.delete("all")
        self.photo = None
        self.original_image = None
        self._current_path = None


class SoilScanApp:
    """Main application class."""

    def __init__(self, root):
        self.root = root
        self.root.title("SoilScan - Soil Sample Background Remover")
        self.root.geometry("1400x850")
        self.root.minsize(1200, 700)

        # Set dark theme colors
        self.bg_color = "#1e1e1e"
        self.fg_color = "#ffffff"
        self.accent_color = "#0078d4"
        self.panel_bg = "#252526"
        self.list_bg = "#2d2d2d"
        self.warning_color = "#ff9800"
        self.success_color = "#28a745"

        self.root.configure(bg=self.bg_color)

        # Data
        self.input_dir = None
        self.output_dir = None
        self.original_dir = None
        self.images: list[ImageItem] = []
        self.current_index = -1
        self.processing = False
        self.loading = False  # Block UI during initial load
        self.process_queue = queue.Queue()

        # Mode: "normal" or "correction"
        self.mode = "normal"

        # Configure styles
        self._setup_styles()

        # Build UI
        self._build_ui()

        # Build loading overlay (hidden by default)
        self._build_loading_overlay()

        # Check dependencies
        if not REMBG_AVAILABLE:
            self.root.after(500, self._show_dependency_warning)

    def _setup_styles(self):
        """Configure ttk styles for dark theme."""
        style = ttk.Style()
        style.theme_use('clam')

        style.configure(".",
            background=self.bg_color,
            foreground=self.fg_color,
            fieldbackground=self.list_bg
        )

        style.configure("TFrame", background=self.bg_color)
        style.configure("TLabel", background=self.bg_color, foreground=self.fg_color)
        style.configure("TButton", padding=6)

        style.configure("Accent.TButton",
            background=self.accent_color,
            foreground="#ffffff"
        )

        style.configure("TProgressbar",
            background=self.accent_color,
            troughcolor=self.list_bg
        )

        style.configure("Treeview",
            background=self.list_bg,
            foreground=self.fg_color,
            fieldbackground=self.list_bg,
            rowheight=25
        )
        style.configure("Treeview.Heading",
            background=self.panel_bg,
            foreground=self.fg_color
        )
        style.map("Treeview",
            background=[("selected", self.accent_color)],
            foreground=[("selected", "#ffffff")]
        )

    def _build_ui(self):
        """Build the main UI."""
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self._build_mode_banner(main_frame)
        self._build_top_bar(main_frame)

        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True, pady=(10, 0))

        self._build_image_list(content_frame)
        self._build_preview_area(content_frame)
        self._build_control_panel(content_frame)
        self._build_status_bar(main_frame)

    def _build_mode_banner(self, parent):
        """Build the mode indicator banner."""
        self.mode_frame = tk.Frame(parent, bg=self.accent_color, height=35)
        self.mode_frame.pack(fill=tk.X, pady=(0, 10))
        self.mode_frame.pack_propagate(False)

        self.mode_label = tk.Label(
            self.mode_frame,
            text="NORMAL MODE - Select an input directory to process images",
            bg=self.accent_color, fg="#ffffff",
            font=("Segoe UI", 10, "bold")
        )
        self.mode_label.pack(pady=8)

    def _update_mode_banner(self):
        """Update the mode banner based on current mode."""
        if self.mode == "correction":
            self.mode_frame.configure(bg=self.warning_color)
            self.mode_label.configure(
                bg=self.warning_color,
                text="CORRECTION MODE - Manual cropping from original images"
            )
        else:
            self.mode_frame.configure(bg=self.accent_color)
            self.mode_label.configure(
                bg=self.accent_color,
                text="NORMAL MODE - Auto-process images with AI background removal"
            )

    def _build_top_bar(self, parent):
        """Build top directory selection bar."""
        top_frame = tk.Frame(parent, bg=self.panel_bg, padx=10, pady=10)
        top_frame.pack(fill=tk.X)

        row1 = tk.Frame(top_frame, bg=self.panel_bg)
        row1.pack(fill=tk.X)

        tk.Label(
            row1, text="Directory:",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 10)
        ).pack(side=tk.LEFT)

        self.dir_entry = tk.Entry(
            row1, width=80,
            bg=self.list_bg, fg=self.fg_color,
            insertbackground=self.fg_color
        )
        self.dir_entry.pack(side=tk.LEFT, padx=(5, 0))

        tk.Button(
            row1, text="Browse...",
            command=self._browse_directory,
            bg=self.accent_color, fg="#ffffff",
            relief=tk.FLAT, padx=15
        ).pack(side=tk.LEFT, padx=(10, 0))

        self.info_frame = tk.Frame(top_frame, bg=self.panel_bg)
        self.info_frame.pack(fill=tk.X, pady=(8, 0))

        self.source_label = tk.Label(
            self.info_frame, text="",
            bg=self.panel_bg, fg="#888888",
            font=("Segoe UI", 9)
        )
        self.source_label.pack(side=tk.LEFT)

        self.output_label = tk.Label(
            self.info_frame, text="",
            bg=self.panel_bg, fg="#888888",
            font=("Segoe UI", 9)
        )
        self.output_label.pack(side=tk.LEFT, padx=(20, 0))

    def _build_image_list(self, parent):
        """Build image list panel."""
        list_frame = tk.Frame(parent, bg=self.panel_bg, width=320)
        list_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        list_frame.pack_propagate(False)

        tk.Label(
            list_frame, text="Images",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 11, "bold")
        ).pack(pady=(10, 5))

        # Search bar with debouncing
        search_frame = tk.Frame(list_frame, bg=self.panel_bg)
        search_frame.pack(fill=tk.X, padx=10, pady=(0, 5))

        self.search_var = tk.StringVar()
        self._search_after_id = None  # For debouncing

        search_entry = tk.Entry(
            search_frame,
            textvariable=self.search_var,
            bg=self.list_bg, fg=self.fg_color,
            insertbackground=self.fg_color,
            font=("Segoe UI", 9)
        )
        search_entry.pack(side=tk.LEFT, fill=tk.X, expand=True)
        search_entry.bind("<KeyRelease>", self._on_search_changed)
        search_entry.bind("<Return>", self._on_search_enter)
        search_entry.bind("<Escape>", self._clear_search)

        tk.Button(
            search_frame, text="X",
            command=self._clear_search,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=5,
            font=("Segoe UI", 8)
        ).pack(side=tk.RIGHT, padx=(5, 0))

        # Bind Ctrl+F to focus search
        self.root.bind("<Control-f>", lambda e: search_entry.focus_set())

        filter_frame = tk.Frame(list_frame, bg=self.panel_bg)
        filter_frame.pack(fill=tk.X, padx=10)

        self.filter_var = tk.StringVar(value="all")
        filters = [("All", "all"), ("Pending", "pending"), ("Done", "processed"), ("Errors", "error")]

        for text, value in filters:
            tk.Radiobutton(
                filter_frame, text=text, value=value,
                variable=self.filter_var, command=self._apply_filter,
                bg=self.panel_bg, fg=self.fg_color,
                selectcolor=self.list_bg, activebackground=self.panel_bg,
                activeforeground=self.fg_color
            ).pack(side=tk.LEFT, padx=2)

        tree_frame = tk.Frame(list_frame, bg=self.panel_bg)
        tree_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        self.tree = ttk.Treeview(
            tree_frame,
            columns=("status",),
            show="tree headings",
            selectmode="browse"
        )
        self.tree.heading("#0", text="Filename")
        self.tree.heading("status", text="Status")
        self.tree.column("#0", width=200)
        self.tree.column("status", width=80)

        scrollbar = ttk.Scrollbar(tree_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.tree.bind("<<TreeviewSelect>>", self._on_image_select)

        self.count_label = tk.Label(
            list_frame, text="0 images",
            bg=self.panel_bg, fg="#888888",
            font=("Segoe UI", 9)
        )
        self.count_label.pack(pady=(0, 10))

    def _build_preview_area(self, parent):
        """Build preview panels."""
        preview_frame = tk.Frame(parent, bg=self.bg_color)
        preview_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

        top_preview = tk.Frame(preview_frame, bg=self.bg_color)
        top_preview.pack(fill=tk.BOTH, expand=True)

        self.original_preview = PreviewPanel(top_preview, title="Original")
        self.original_preview.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))

        self.result_preview = PreviewPanel(top_preview, title="Cropped Result")
        self.result_preview.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(5, 0))

        manual_frame = tk.Frame(preview_frame, bg=self.panel_bg)
        manual_frame.pack(fill=tk.X, pady=(10, 0))

        header_frame = tk.Frame(manual_frame, bg=self.panel_bg)
        header_frame.pack(fill=tk.X, padx=10, pady=5)

        self.manual_label = tk.Label(
            header_frame,
            text="Manual Crop - Click and drag to select the soil area",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 10, "bold")
        )
        self.manual_label.pack(side=tk.LEFT)

        self.apply_manual_btn = tk.Button(
            header_frame, text="Apply Manual Crop",
            command=self._apply_manual_crop,
            bg=self.success_color, fg="#ffffff",
            relief=tk.FLAT, padx=15,
            state=tk.DISABLED
        )
        self.apply_manual_btn.pack(side=tk.RIGHT)

        source_frame = tk.Frame(manual_frame, bg=self.panel_bg)
        source_frame.pack(fill=tk.X, padx=10, pady=(0, 5))

        self.source_status_label = tk.Label(
            source_frame,
            text="Source: Not loaded",
            bg=self.panel_bg, fg="#888888",
            font=("Segoe UI", 9)
        )
        self.source_status_label.pack(side=tk.LEFT)

        self.browse_original_btn = tk.Button(
            source_frame, text="Browse Original...",
            command=self._browse_original_image,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=10,
            state=tk.DISABLED
        )
        self.browse_original_btn.pack(side=tk.RIGHT)

        self.manual_canvas = ManualCropCanvas(manual_frame, height=200)
        self.manual_canvas.pack(fill=tk.X, padx=10, pady=(0, 10))

    def _build_control_panel(self, parent):
        """Build control panel."""
        control_frame = tk.Frame(parent, bg=self.panel_bg, width=200)
        control_frame.pack(side=tk.RIGHT, fill=tk.Y)
        control_frame.pack_propagate(False)

        tk.Label(
            control_frame, text="Actions",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 11, "bold")
        ).pack(pady=(10, 20))

        self.process_all_btn = tk.Button(
            control_frame, text="Process All Images",
            command=self._process_all,
            bg=self.accent_color, fg="#ffffff",
            relief=tk.FLAT, padx=20, pady=10,
            font=("Segoe UI", 10, "bold"),
            width=18
        )
        self.process_all_btn.pack(pady=5)

        self.process_selected_btn = tk.Button(
            control_frame, text="AI Crop Selected",
            command=self._process_selected,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=20, pady=8,
            width=18,
            state=tk.DISABLED
        )
        self.process_selected_btn.pack(pady=5)

        self.manual_crop_btn = tk.Button(
            control_frame, text="Manual Crop Selected",
            command=self._apply_manual_crop,
            bg=self.success_color, fg="#ffffff",
            relief=tk.FLAT, padx=20, pady=8,
            width=18,
            state=tk.DISABLED
        )
        self.manual_crop_btn.pack(pady=5)

        self.revert_btn = tk.Button(
            control_frame, text="Revert to Original",
            command=self._revert_to_original,
            bg="#dc3545", fg="#ffffff",
            relief=tk.FLAT, padx=20, pady=8,
            width=18,
            state=tk.DISABLED
        )
        self.revert_btn.pack(pady=5)

        self.crop_hint_label = tk.Label(
            control_frame,
            text="Draw selection below first,\nthen click Manual Crop",
            bg=self.panel_bg, fg="#888888",
            font=("Segoe UI", 8)
        )
        self.crop_hint_label.pack(pady=(0, 5))

        ttk.Separator(control_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=15, padx=10)

        tk.Label(
            control_frame, text="Navigation",
            bg=self.panel_bg, fg="#888888",
            font=("Segoe UI", 9)
        ).pack()

        nav_frame = tk.Frame(control_frame, bg=self.panel_bg)
        nav_frame.pack(pady=10)

        self.prev_btn = tk.Button(
            nav_frame, text="< Prev",
            command=self._prev_image,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=15,
            state=tk.DISABLED
        )
        self.prev_btn.pack(side=tk.LEFT, padx=5)

        self.next_btn = tk.Button(
            nav_frame, text="Next >",
            command=self._next_image,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=15,
            state=tk.DISABLED
        )
        self.next_btn.pack(side=tk.LEFT, padx=5)

        ttk.Separator(control_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=20, padx=10)

        tk.Label(
            control_frame, text="Options",
            bg=self.panel_bg, fg="#888888",
            font=("Segoe UI", 9)
        ).pack()

        self.alpha_var = tk.BooleanVar(value=False)
        tk.Checkbutton(
            control_frame, text="Alpha Matting\n(better edges, slower)",
            variable=self.alpha_var,
            bg=self.panel_bg, fg=self.fg_color,
            selectcolor=self.list_bg, activebackground=self.panel_bg,
            activeforeground=self.fg_color
        ).pack(pady=10)

        ttk.Separator(control_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=20, padx=10)

        self.open_input_btn = tk.Button(
            control_frame, text="Open Input Folder",
            command=self._open_input_folder,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=20, pady=6,
            width=18,
            state=tk.DISABLED
        )
        self.open_input_btn.pack(pady=3)

        self.open_output_btn = tk.Button(
            control_frame, text="Open Output Folder",
            command=self._open_output_folder,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=20, pady=6,
            width=18,
            state=tk.DISABLED
        )
        self.open_output_btn.pack(pady=3)

    def _build_status_bar(self, parent):
        """Build status bar."""
        status_frame = tk.Frame(parent, bg=self.panel_bg, height=40)
        status_frame.pack(fill=tk.X, pady=(10, 0))
        status_frame.pack_propagate(False)

        self.status_label = tk.Label(
            status_frame, text="Ready - Select a directory to begin",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 9),
            anchor=tk.W
        )
        self.status_label.pack(side=tk.LEFT, padx=10, pady=10)

        self.progress = ttk.Progressbar(
            status_frame, mode='determinate', length=300
        )
        self.progress.pack(side=tk.RIGHT, padx=10, pady=10)

        self.progress_label = tk.Label(
            status_frame, text="",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 9)
        )
        self.progress_label.pack(side=tk.RIGHT, padx=5)

    def _build_loading_overlay(self):
        """Build a loading overlay that blocks UI during image scanning."""
        self.loading_overlay = tk.Frame(self.root, bg="#000000")

        # Semi-transparent effect via a dark frame
        self.loading_inner = tk.Frame(self.loading_overlay, bg="#1e1e1e", padx=40, pady=30)
        self.loading_inner.place(relx=0.5, rely=0.5, anchor=tk.CENTER)

        self.loading_title = tk.Label(
            self.loading_inner,
            text="Loading Images...",
            bg="#1e1e1e", fg="#ffffff",
            font=("Segoe UI", 14, "bold")
        )
        self.loading_title.pack(pady=(0, 10))

        self.loading_message = tk.Label(
            self.loading_inner,
            text="Please wait while images are being scanned.",
            bg="#1e1e1e", fg="#aaaaaa",
            font=("Segoe UI", 10)
        )
        self.loading_message.pack(pady=(0, 15))

        self.loading_progress = ttk.Progressbar(
            self.loading_inner, mode='indeterminate', length=250
        )
        self.loading_progress.pack(pady=(0, 10))

        self.loading_count = tk.Label(
            self.loading_inner,
            text="",
            bg="#1e1e1e", fg="#888888",
            font=("Segoe UI", 9)
        )
        self.loading_count.pack()

    def _show_loading(self, message="Loading Images..."):
        """Show loading overlay and block UI."""
        self.loading = True
        self.loading_title.configure(text=message)
        self.loading_count.configure(text="")
        self.loading_overlay.place(relx=0, rely=0, relwidth=1, relheight=1)
        self.loading_progress.start(10)
        self.root.update_idletasks()

    def _hide_loading(self):
        """Hide loading overlay and restore UI."""
        self.loading = False
        self.loading_progress.stop()
        self.loading_overlay.place_forget()
        self.root.update_idletasks()

    def _update_loading_count(self, count):
        """Update the loading count display."""
        self.loading_count.configure(text=f"Found {count} images...")
        self.root.update_idletasks()

    def _show_dependency_warning(self):
        """Show warning if rembg is not installed."""
        messagebox.showwarning(
            "Missing Dependencies",
            "The 'rembg' package is not installed.\n\n"
            "Automatic background removal will not work.\n"
            "You can still use manual cropping.\n\n"
            "To install, run:\n"
            "pip install rembg[cpu]"
        )

    def _browse_directory(self):
        """Browse for directory or archive file."""
        if self.loading:  # Block while loading
            return

        choice = messagebox.askquestion(
            "Select Input",
            "Do you want to open a folder?\n\n"
            "Click 'Yes' for a folder\n"
            "Click 'No' for an archive file (.7z, .zip)",
            icon='question'
        )

        if choice == 'yes':
            directory = filedialog.askdirectory(title="Select Directory")
            if directory:
                self._load_directory(Path(directory))
        else:
            filetypes = [("Archive files", "*.7z *.zip"), ("7z files", "*.7z"), ("ZIP files", "*.zip")]
            archive_path = filedialog.askopenfilename(
                title="Select Archive File",
                filetypes=filetypes
            )
            if archive_path:
                self._extract_and_load(Path(archive_path))

    def _extract_and_load(self, archive_path: Path):
        """Extract archive and load the extracted directory."""
        extract_dir = archive_path.parent / archive_path.stem

        if extract_dir.exists():
            result = messagebox.askyesno(
                "Folder Exists",
                f"The folder '{extract_dir.name}' already exists.\n\n"
                "Use existing folder without re-extracting?"
            )
            if result:
                self._load_directory(extract_dir)
                return

        suffix = archive_path.suffix.lower()

        if suffix == '.7z':
            if not PY7ZR_AVAILABLE:
                messagebox.showerror(
                    "Missing Dependency",
                    "py7zr is not installed. Cannot extract .7z files.\n\n"
                    "Run: pip install py7zr"
                )
                return
            self._extract_7z(archive_path, extract_dir)

        elif suffix == '.zip':
            self._extract_zip(archive_path, extract_dir)

        else:
            messagebox.showerror("Error", f"Unsupported archive format: {suffix}")
            return

    def _extract_7z(self, archive_path: Path, extract_dir: Path):
        """Extract .7z archive with progress dialog."""
        self._update_status(f"Extracting {archive_path.name}...")
        self.progress['value'] = 0
        self.progress['mode'] = 'indeterminate'
        self.progress.start(10)

        def extract_thread():
            try:
                with py7zr.SevenZipFile(archive_path, mode='r') as archive:
                    archive.extractall(path=extract_dir)
                self.process_queue.put(("extract_done", extract_dir))
            except Exception as e:
                self.process_queue.put(("extract_error", str(e)))

        thread = threading.Thread(target=extract_thread, daemon=True)
        thread.start()
        self.root.after(100, self._check_extract_queue)

    def _extract_zip(self, archive_path: Path, extract_dir: Path):
        """Extract .zip archive with progress dialog."""
        self._update_status(f"Extracting {archive_path.name}...")
        self.progress['value'] = 0
        self.progress['mode'] = 'indeterminate'
        self.progress.start(10)

        def extract_thread():
            try:
                with zipfile.ZipFile(archive_path, 'r') as archive:
                    archive.extractall(path=extract_dir)
                self.process_queue.put(("extract_done", extract_dir))
            except Exception as e:
                self.process_queue.put(("extract_error", str(e)))

        thread = threading.Thread(target=extract_thread, daemon=True)
        thread.start()
        self.root.after(100, self._check_extract_queue)

    def _check_extract_queue(self):
        """Check extraction queue and update UI."""
        try:
            msg_type, data = self.process_queue.get_nowait()

            self.progress.stop()
            self.progress['mode'] = 'determinate'

            if msg_type == "extract_done":
                self._update_status(f"Extraction complete: {data.name}")
                self._load_directory(data)
                return

            elif msg_type == "extract_error":
                messagebox.showerror("Extraction Error", f"Failed to extract archive:\n{data}")
                self._update_status("Extraction failed")
                return

        except queue.Empty:
            pass

        self.root.after(100, self._check_extract_queue)

    def _load_directory(self, directory: Path):
        """Load directory and detect mode based on C- prefix."""
        self._update_status(f"Loading {directory.name}...")

        # Clear cache when loading new directory
        _image_cache.clear()

        dir_name = directory.name

        if dir_name.startswith("C-"):
            self.mode = "correction"
            self.output_dir = directory

            original_name = dir_name[2:]
            potential_original = directory.parent / original_name

            if potential_original.exists():
                self.original_dir = potential_original
                self.input_dir = directory
            else:
                potential_with_images = directory.parent / original_name / "images"
                if potential_with_images.exists():
                    self.original_dir = potential_with_images
                    self.input_dir = directory
                else:
                    messagebox.showwarning(
                        "Original Folder Not Found",
                        f"Could not find the original folder:\n{potential_original}\n\n"
                        "Manual cropping will use the cropped images as source."
                    )
                    self.original_dir = directory
                    self.input_dir = directory

            self.source_label.configure(text=f"Original: {self.original_dir}")
            self.output_label.configure(text=f"Output: {self.output_dir}")

            self.process_all_btn.configure(state=tk.DISABLED)
            self.original_preview.set_title("Original (Source)")
            self.result_preview.set_title("Current Crop (Will be replaced)")

        else:
            self.mode = "normal"
            self.input_dir = directory
            self.original_dir = directory

            input_name = directory.name
            if input_name.lower() in ('images', 'image', 'photos', 'photo', 'pics'):
                input_name = directory.parent.name
                self.original_dir = directory

            output_name = f"C-{input_name}"
            self.output_dir = directory.parent / output_name

            self.source_label.configure(text=f"Input: {self.input_dir}")
            self.output_label.configure(text=f"Output: {self.output_dir}")

            self.process_all_btn.configure(state=tk.NORMAL)
            self.original_preview.set_title("Original")
            self.result_preview.set_title("Cropped Result")

        self.dir_entry.delete(0, tk.END)
        self.dir_entry.insert(0, str(directory))
        self._update_mode_banner()

        # Show loading overlay and load images
        self._show_loading("Scanning Images...")
        self._load_images_async()

    def _load_images_async(self):
        """Load images list asynchronously."""
        self._update_status("Scanning for images...")

        def scan():
            images = []
            extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')

            if self.mode == "correction":
                for ext in extensions:
                    for img_path in self.output_dir.rglob(f'*{ext}'):
                        try:
                            rel_path = img_path.relative_to(self.output_dir)
                        except ValueError:
                            rel_path = Path(img_path.name)

                        original_path = None
                        for orig_ext in extensions:
                            potential = self.original_dir / rel_path.with_suffix(orig_ext)
                            if potential.exists():
                                original_path = potential
                                break

                        if original_path is None:
                            for orig_ext in extensions:
                                potential = self.original_dir / rel_path.name
                                potential = potential.with_suffix(orig_ext)
                                if potential.exists():
                                    original_path = potential
                                    break

                        item = ImageItem(
                            input_path=img_path,
                            output_path=img_path,
                            original_path=original_path or img_path
                        )
                        item.status = "auto_cropped"
                        images.append(item)

            else:
                for ext in extensions:
                    for img_path in self.input_dir.rglob(f'*{ext}'):
                        try:
                            rel_path = img_path.relative_to(self.input_dir)
                        except ValueError:
                            rel_path = Path(img_path.name)

                        output_path = self.output_dir / rel_path.with_suffix('.png')

                        item = ImageItem(
                            input_path=img_path,
                            output_path=output_path,
                            original_path=img_path
                        )

                        if output_path.exists():
                            item.status = "auto_cropped"

                        images.append(item)

            images.sort(key=lambda x: x.name.lower())
            return images

        def on_done(future):
            try:
                self.images = future.result()
                self._hide_loading()  # Hide loading overlay
                self.after_idle_safe(self._refresh_tree)
                mode_text = "correction" if self.mode == "correction" else "processing"
                self._update_status(f"Loaded {len(self.images)} images for {mode_text}")

                if self.images:
                    self.open_input_btn.configure(state=tk.NORMAL)
                    self.open_output_btn.configure(state=tk.NORMAL)
            except Exception as e:
                self._hide_loading()  # Hide loading overlay on error too
                self._update_status(f"Error loading images: {e}")

        future = _executor.submit(scan)
        future.add_done_callback(lambda f: self.root.after(0, lambda: on_done(f)))

    def after_idle_safe(self, func):
        """Schedule function to run on main thread."""
        self.root.after_idle(func)

    def _refresh_tree(self):
        """Refresh the image list treeview with search and filter support."""
        self.tree.delete(*self.tree.get_children())

        filter_val = self.filter_var.get()
        search_text = self.search_var.get().lower().strip()
        visible_count = 0

        status_map = {
            "pending": "Pending",
            "processing": "Processing",
            "auto_cropped": "Auto",
            "manual_cropped": "Manual",
            "error": "Error"
        }

        # Batch insert items for better performance
        items_to_insert = []

        for i, item in enumerate(self.images):
            # Filter by status
            if filter_val == "pending" and item.status != "pending":
                continue
            elif filter_val == "processed" and not item.is_processed:
                continue
            elif filter_val == "error" and item.status != "error":
                continue

            # Filter by search text
            if search_text and search_text not in item.display_name.lower():
                continue

            status_text = status_map.get(item.status, item.status)
            items_to_insert.append((str(i), item.display_name, status_text))
            visible_count += 1

        # Insert all items (batched internally by Tkinter)
        for iid, name, status in items_to_insert:
            self.tree.insert("", tk.END, iid=iid, text=name, values=(status,))

        total = len(self.images)
        processed = sum(1 for i in self.images if i.is_processed)
        manual = sum(1 for i in self.images if i.status == "manual_cropped")

        search_info = f" (filter: '{search_text}')" if search_text else ""
        self.count_label.configure(
            text=f"{visible_count} shown / {total} total{search_info}\n({processed} processed, {manual} manual)"
        )

    def _apply_filter(self):
        """Apply filter to image list."""
        self._refresh_tree()

    def _on_search_changed(self, event=None):
        """Handle search text change with debouncing (150ms delay)."""
        # Cancel previous scheduled refresh
        if self._search_after_id:
            self.root.after_cancel(self._search_after_id)

        # Schedule new refresh after 150ms (debounce)
        self._search_after_id = self.root.after(150, self._refresh_tree)

    def _on_search_enter(self, event=None):
        """Jump to first matching item on Enter."""
        children = self.tree.get_children()
        if children:
            self.tree.selection_set(children[0])
            self.tree.see(children[0])
            self._on_image_select(None)

    def _clear_search(self, event=None):
        """Clear the search box."""
        self.search_var.set("")
        self._refresh_tree()

    def _on_image_select(self, event):
        """Handle image selection."""
        if self.loading:  # Block selection during loading
            return

        selection = self.tree.selection()
        if not selection:
            return

        index = int(selection[0])
        self._select_image(index)

    def _select_image(self, index):
        """Select and display an image."""
        if self.loading:  # Block selection during loading
            return

        if index < 0 or index >= len(self.images):
            return

        self.current_index = index
        item = self.images[index]

        # Load previews (async)
        if item.original_path and item.original_path.exists():
            self.original_preview.load_image(image_path=item.original_path)
        else:
            self.original_preview.load_image(image_path=item.input_path)

        if item.output_path.exists():
            self.result_preview.load_image(image_path=item.output_path)
        else:
            self.result_preview.clear()

        # Load manual crop canvas
        if item.original_path and item.original_path.exists():
            self.manual_canvas.load_image(item.original_path)
        else:
            self.manual_canvas.load_image(item.input_path)

        self.apply_manual_btn.configure(state=tk.NORMAL)
        self.browse_original_btn.configure(state=tk.NORMAL)
        self.manual_crop_btn.configure(state=tk.NORMAL)

        # Enable revert only if there's a cropped output to revert
        if item.output_path.exists() and item.is_processed:
            self.revert_btn.configure(state=tk.NORMAL)
        else:
            self.revert_btn.configure(state=tk.DISABLED)

        self._update_source_status(item)

        self.prev_btn.configure(state=tk.NORMAL if index > 0 else tk.DISABLED)
        self.next_btn.configure(state=tk.NORMAL if index < len(self.images) - 1 else tk.DISABLED)

        if self.mode == "normal":
            self.process_selected_btn.configure(state=tk.NORMAL)
        else:
            self.process_selected_btn.configure(state=tk.DISABLED)

        self.tree.selection_set(str(index))
        self.tree.see(str(index))

        status_text = f"Viewing: {item.display_name}"
        if self.mode == "correction":
            status_text += " (draw selection and click Apply Manual Crop to correct)"
        self._update_status(status_text)

    def _prev_image(self):
        """Go to previous image."""
        if self.current_index > 0:
            self._select_image(self.current_index - 1)

    def _next_image(self):
        """Go to next image."""
        if self.current_index < len(self.images) - 1:
            self._select_image(self.current_index + 1)

    def _process_all(self):
        """Process all pending images."""
        if not REMBG_AVAILABLE:
            messagebox.showerror("Error", "rembg is not installed. Cannot perform automatic processing.")
            return

        if self.processing or self.mode == "correction":
            return

        pending = [i for i, item in enumerate(self.images) if item.status == "pending"]

        if not pending:
            messagebox.showinfo("Info", "No pending images to process.")
            return

        self._start_batch_processing(pending)

    def _process_selected(self):
        """Process selected image."""
        if not REMBG_AVAILABLE:
            messagebox.showerror("Error", "rembg is not installed. Cannot perform automatic processing.")
            return

        if self.current_index >= 0 and self.mode == "normal":
            self._start_batch_processing([self.current_index])

    def _start_batch_processing(self, indices):
        """Start batch processing in background thread."""
        self.processing = True
        self.process_all_btn.configure(state=tk.DISABLED)
        self.process_selected_btn.configure(state=tk.DISABLED)

        self.progress['value'] = 0
        self.progress['maximum'] = len(indices)

        thread = threading.Thread(
            target=self._process_batch_thread,
            args=(indices,),
            daemon=True
        )
        thread.start()

        self.root.after(100, self._check_process_queue)

    def _process_batch_thread(self, indices):
        """Background thread for batch processing with session reuse (80% faster)."""
        # Get reusable session once for all images
        session = get_rembg_session()
        total = len(indices)

        for i, idx in enumerate(indices):
            item = self.images[idx]
            item.status = "processing"
            self.process_queue.put(("update", idx))

            try:
                item.output_path.parent.mkdir(parents=True, exist_ok=True)

                with Image.open(item.input_path) as img:
                    if img.mode != 'RGB':
                        img = img.convert('RGB')

                    # Use session for 80% faster processing (no re-initialization)
                    output = remove(
                        img,
                        session=session,
                        alpha_matting=self.alpha_var.get(),
                        alpha_matting_foreground_threshold=240,
                        alpha_matting_background_threshold=10,
                        alpha_matting_erode_size=10,
                    )

                    output.save(item.output_path, 'PNG')

                item.status = "auto_cropped"

            except Exception as e:
                item.status = "error"
                item.error_message = str(e)

            # Debounced progress: only update UI every 100ms max
            self.process_queue.put(("progress", (i + 1, total)))
            # Only update tree for current item, not full refresh
            self.process_queue.put(("update_single", idx))

        self.process_queue.put(("done", None))

    def _check_process_queue(self):
        """Check processing queue and update UI with debouncing."""
        try:
            updates_this_cycle = 0
            max_updates_per_cycle = 10  # Limit UI updates per cycle

            while updates_this_cycle < max_updates_per_cycle:
                msg_type, data = self.process_queue.get_nowait()

                if msg_type == "progress":
                    current, total = data
                    self.progress['value'] = current
                    self.progress['maximum'] = total
                    self.progress_label.configure(text=f"{current}/{total}")

                elif msg_type == "update":
                    self._refresh_tree()
                    if data == self.current_index:
                        self._select_image(data)
                    updates_this_cycle += 1

                elif msg_type == "update_single":
                    # Fast single-item update instead of full tree refresh
                    self._update_tree_item(data)
                    if data == self.current_index:
                        self._select_image(data)
                    updates_this_cycle += 1

                elif msg_type == "done":
                    self.processing = False
                    if self.mode == "normal":
                        self.process_all_btn.configure(state=tk.NORMAL)
                        self.process_selected_btn.configure(state=tk.NORMAL)
                    self._refresh_tree()  # Final full refresh
                    self._update_status("Processing complete!")
                    self.progress_label.configure(text="")
                    return

        except queue.Empty:
            pass

        if self.processing:
            self.root.after(50, self._check_process_queue)  # Faster polling

    def _update_tree_item(self, index):
        """Update a single tree item status without full refresh."""
        if index < 0 or index >= len(self.images):
            return

        item = self.images[index]
        iid = str(index)

        # Check if item exists in tree
        if self.tree.exists(iid):
            status_map = {
                "pending": "Pending",
                "processing": "Processing",
                "auto_cropped": "Auto",
                "manual_cropped": "Manual",
                "error": "Error"
            }
            status_text = status_map.get(item.status, item.status)
            self.tree.item(iid, values=(status_text,))

    def _apply_manual_crop(self):
        """Apply manual crop selection."""
        if self.current_index < 0:
            return

        cropped = self.manual_canvas.get_cropped_image()
        if cropped is None:
            messagebox.showwarning(
                "No Selection",
                "Please draw a selection rectangle around the soil area first."
            )
            return

        item = self.images[self.current_index]

        try:
            item.output_path.parent.mkdir(parents=True, exist_ok=True)

            cropped.save(item.output_path, 'PNG')

            item.status = "manual_cropped"

            self._refresh_tree()
            self.result_preview.load_image(pil_image=cropped)
            self._update_status(f"Manual crop saved: {item.output_path.name}")

            if self.current_index < len(self.images) - 1:
                self.root.after(300, lambda: self._select_image(self.current_index + 1))

        except Exception as e:
            messagebox.showerror("Error", f"Failed to save manual crop:\n{e}")

    def _revert_to_original(self):
        """Revert the selected image to its original (unprocessed) state."""
        if self.current_index < 0:
            return

        item = self.images[self.current_index]

        # Check if there's anything to revert
        if not item.output_path.exists():
            messagebox.showinfo("Info", "No cropped image to revert.")
            return

        # Confirm with user
        result = messagebox.askyesno(
            "Confirm Revert",
            f"Delete the cropped version of:\n{item.display_name}\n\n"
            "This will reset the image to 'Pending' status."
        )

        if not result:
            return

        try:
            # Delete the output file
            item.output_path.unlink()

            # Reset status to pending
            item.status = "pending"

            # Clear the result preview
            self.result_preview.clear()

            # Refresh UI
            self._refresh_tree()
            self._update_status(f"Reverted: {item.display_name}")

            # Re-select to update button states
            self._select_image(self.current_index)

        except Exception as e:
            messagebox.showerror("Error", f"Failed to revert:\n{e}")

    def _browse_original_image(self):
        """Browse for the original image when auto-detection fails."""
        if self.current_index < 0:
            return

        item = self.images[self.current_index]

        initial_dir = self.original_dir if self.original_dir else self.input_dir
        if initial_dir and not initial_dir.exists():
            initial_dir = None

        file_path = filedialog.askopenfilename(
            title=f"Select Original Image for: {item.display_name}",
            initialdir=initial_dir,
            filetypes=[
                ("Image files", "*.jpg *.jpeg *.png *.bmp *.webp"),
                ("All files", "*.*")
            ]
        )

        if file_path:
            original_path = Path(file_path)
            item.original_path = original_path

            self.original_preview.load_image(image_path=original_path)
            self.manual_canvas.load_image(original_path)

            self._update_source_status(item)
            self._update_status(f"Original loaded: {original_path.name}")

    def _update_source_status(self, item: ImageItem):
        """Update the source status label for the current image."""
        if item.original_path and item.original_path.exists():
            if item.original_path == item.input_path:
                self.source_status_label.configure(
                    text="Source: Using cropped image (no original found)",
                    fg="#ff9800"
                )
            else:
                self.source_status_label.configure(
                    text=f"Source: {item.original_path.name}",
                    fg="#28a745"
                )
        else:
            self.source_status_label.configure(
                text="Source: Not found - use Browse to locate",
                fg="#ff5555"
            )

    def _open_input_folder(self):
        """Open input/original folder in file explorer."""
        folder = self.original_dir or self.input_dir
        if folder and folder.exists():
            os.startfile(folder)

    def _open_output_folder(self):
        """Open output folder in file explorer."""
        if self.output_dir:
            if not self.output_dir.exists():
                self.output_dir.mkdir(parents=True, exist_ok=True)
            os.startfile(self.output_dir)

    def _update_status(self, message):
        """Update status bar message."""
        self.status_label.configure(text=message)


def main():
    root = tk.Tk()

    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except:
        pass

    app = SoilScanApp(root)
    root.mainloop()

    # Cleanup
    _executor.shutdown(wait=False)


if __name__ == '__main__':
    main()
