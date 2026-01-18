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

# Check for rembg availability
try:
    from rembg import remove
    REMBG_AVAILABLE = True
except ImportError:
    REMBG_AVAILABLE = False


class ImageItem:
    """Represents an image in the processing queue."""
    def __init__(self, input_path: Path, output_path: Path, original_path: Path = None):
        self.input_path = input_path  # Where to read for processing
        self.output_path = output_path  # Where to save results
        self.original_path = original_path or input_path  # Original source for manual crop
        self.status = "pending"  # pending, processing, auto_cropped, manual_cropped, error
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
    """Canvas for manual crop selection."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.image = None
        self.photo = None
        self.original_image = None
        self.scale = 1.0
        self.offset_x = 0
        self.offset_y = 0

        # Selection rectangle
        self.start_x = None
        self.start_y = None
        self.rect_id = None
        self.selection = None  # (x1, y1, x2, y2) in original image coordinates

        # Bind mouse events
        self.bind("<ButtonPress-1>", self.on_press)
        self.bind("<B1-Motion>", self.on_drag)
        self.bind("<ButtonRelease-1>", self.on_release)

        self.configure(bg="#2b2b2b", highlightthickness=0)

    def load_image(self, image_path: Path):
        """Load and display an image."""
        try:
            self.original_image = Image.open(image_path)
            if self.original_image.mode not in ('RGB', 'RGBA'):
                self.original_image = self.original_image.convert('RGB')
            self._fit_image()
            self.selection = None
            if self.rect_id:
                self.delete(self.rect_id)
                self.rect_id = None
        except Exception as e:
            print(f"Error loading image: {e}")

    def _fit_image(self):
        """Fit image to canvas size."""
        if self.original_image is None:
            return

        canvas_width = self.winfo_width()
        canvas_height = self.winfo_height()

        if canvas_width <= 1 or canvas_height <= 1:
            self.after(100, self._fit_image)
            return

        img_width, img_height = self.original_image.size

        # Calculate scale to fit
        scale_x = canvas_width / img_width
        scale_y = canvas_height / img_height
        self.scale = min(scale_x, scale_y) * 0.95  # 95% to leave margin

        # Calculate display size
        display_width = int(img_width * self.scale)
        display_height = int(img_height * self.scale)

        # Calculate offset to center
        self.offset_x = (canvas_width - display_width) // 2
        self.offset_y = (canvas_height - display_height) // 2

        # Resize and display
        display_image = self.original_image.copy()
        if display_image.mode == 'RGBA':
            display_image = display_image.convert('RGB')
        display_image = display_image.resize(
            (display_width, display_height),
            Image.Resampling.LANCZOS
        )
        self.photo = ImageTk.PhotoImage(display_image)

        self.delete("all")
        self.create_image(
            self.offset_x, self.offset_y,
            anchor=tk.NW,
            image=self.photo,
            tags="image"
        )

    def canvas_to_image(self, cx, cy):
        """Convert canvas coordinates to original image coordinates."""
        if self.original_image is None:
            return 0, 0

        ix = int((cx - self.offset_x) / self.scale)
        iy = int((cy - self.offset_y) / self.scale)

        # Clamp to image bounds
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

        # Convert to image coordinates
        x1, y1 = self.canvas_to_image(self.start_x, self.start_y)
        x2, y2 = self.canvas_to_image(event.x, event.y)

        # Ensure proper order
        if x1 > x2:
            x1, x2 = x2, x1
        if y1 > y2:
            y1, y2 = y2, y1

        # Minimum selection size
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

        # Get base image (convert RGBA to RGB for cropping source)
        base_image = self.original_image
        if base_image.mode == 'RGBA':
            base_image = base_image.convert('RGB')

        cropped = base_image.crop((x1, y1, x2, y2))

        # Create transparent background version
        # The cropped area becomes the foreground on transparent background
        result = Image.new('RGBA', base_image.size, (0, 0, 0, 0))

        # Paste the cropped region at its original position
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


class PreviewPanel(tk.Frame):
    """Panel for displaying image preview."""

    def __init__(self, parent, title="Preview", **kwargs):
        super().__init__(parent, **kwargs)
        self.configure(bg="#1e1e1e")

        # Title
        self.title_label = tk.Label(
            self, text=title,
            bg="#1e1e1e", fg="#ffffff",
            font=("Segoe UI", 10, "bold")
        )
        self.title_label.pack(pady=(5, 0))

        # Canvas for image
        self.canvas = tk.Canvas(self, bg="#2b2b2b", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        self.photo = None
        self.original_image = None

    def set_title(self, title):
        """Update the panel title."""
        self.title_label.configure(text=title)

    def load_image(self, image_path: Path = None, pil_image: Image.Image = None):
        """Load and display an image from path or PIL Image."""
        try:
            if image_path:
                self.original_image = Image.open(image_path)
            elif pil_image:
                self.original_image = pil_image
            else:
                self.clear()
                return

            self._fit_image()
        except Exception as e:
            print(f"Error loading preview: {e}")
            self.clear()

    def _fit_image(self):
        """Fit image to canvas."""
        if self.original_image is None:
            return

        self.canvas.update_idletasks()
        canvas_width = self.canvas.winfo_width()
        canvas_height = self.canvas.winfo_height()

        if canvas_width <= 1 or canvas_height <= 1:
            self.after(100, self._fit_image)
            return

        img_width, img_height = self.original_image.size

        # Calculate scale
        scale_x = canvas_width / img_width
        scale_y = canvas_height / img_height
        scale = min(scale_x, scale_y) * 0.95

        display_width = int(img_width * scale)
        display_height = int(img_height * scale)

        # Handle RGBA for display (add checkerboard background)
        if self.original_image.mode == 'RGBA':
            # Create checkerboard background
            checker = Image.new('RGB', self.original_image.size, '#3c3c3c')
            checker_draw = ImageDraw.Draw(checker)
            check_size = 10
            for y in range(0, self.original_image.height, check_size):
                for x in range(0, self.original_image.width, check_size):
                    if (x // check_size + y // check_size) % 2 == 0:
                        checker_draw.rectangle(
                            [x, y, x + check_size, y + check_size],
                            fill='#2c2c2c'
                        )
            checker.paste(self.original_image, mask=self.original_image.split()[3])
            display_image = checker
        else:
            display_image = self.original_image

        display_image = display_image.resize(
            (display_width, display_height),
            Image.Resampling.LANCZOS
        )

        self.photo = ImageTk.PhotoImage(display_image)

        self.canvas.delete("all")
        self.canvas.create_image(
            canvas_width // 2, canvas_height // 2,
            anchor=tk.CENTER,
            image=self.photo
        )

    def clear(self):
        """Clear the preview."""
        self.canvas.delete("all")
        self.photo = None
        self.original_image = None


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
        self.original_dir = None  # For correction mode
        self.images: list[ImageItem] = []
        self.current_index = -1
        self.processing = False
        self.process_queue = queue.Queue()

        # Mode: "normal" or "correction"
        self.mode = "normal"

        # Configure styles
        self._setup_styles()

        # Build UI
        self._build_ui()

        # Check dependencies
        if not REMBG_AVAILABLE:
            self.root.after(500, self._show_dependency_warning)

    def _setup_styles(self):
        """Configure ttk styles for dark theme."""
        style = ttk.Style()
        style.theme_use('clam')

        # Configure colors
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

        # Treeview style
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
        # Main container
        main_frame = ttk.Frame(self.root)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Mode indicator banner
        self._build_mode_banner(main_frame)

        # Top bar with directory selection
        self._build_top_bar(main_frame)

        # Content area
        content_frame = ttk.Frame(main_frame)
        content_frame.pack(fill=tk.BOTH, expand=True, pady=(10, 0))

        # Left panel - Image list
        self._build_image_list(content_frame)

        # Center panel - Previews
        self._build_preview_area(content_frame)

        # Right panel - Controls
        self._build_control_panel(content_frame)

        # Bottom bar - Status and progress
        self._build_status_bar(main_frame)

    def _build_mode_banner(self, parent):
        """Build the mode indicator banner."""
        self.mode_frame = tk.Frame(parent, bg=self.accent_color, height=35)
        self.mode_frame.pack(fill=tk.X, pady=(0, 10))
        self.mode_frame.pack_propagate(False)

        self.mode_label = tk.Label(
            self.mode_frame,
            text="📁 NORMAL MODE - Select an input directory to process images",
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
                text="🔧 CORRECTION MODE - Manual cropping from original images"
            )
        else:
            self.mode_frame.configure(bg=self.accent_color)
            self.mode_label.configure(
                bg=self.accent_color,
                text="📁 NORMAL MODE - Auto-process images with AI background removal"
            )

    def _build_top_bar(self, parent):
        """Build top directory selection bar."""
        top_frame = tk.Frame(parent, bg=self.panel_bg, padx=10, pady=10)
        top_frame.pack(fill=tk.X)

        # Row 1: Directory selection
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

        # Row 2: Info labels
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

        # Header
        tk.Label(
            list_frame, text="Images",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 11, "bold")
        ).pack(pady=(10, 5))

        # Filter frame
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

        # Treeview with scrollbar
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

        # Image count label
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

        # Top row - Original and Result previews
        top_preview = tk.Frame(preview_frame, bg=self.bg_color)
        top_preview.pack(fill=tk.BOTH, expand=True)

        # Original preview
        self.original_preview = PreviewPanel(top_preview, title="Original")
        self.original_preview.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 5))

        # Result preview
        self.result_preview = PreviewPanel(top_preview, title="Cropped Result")
        self.result_preview.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(5, 0))

        # Manual crop section
        manual_frame = tk.Frame(preview_frame, bg=self.panel_bg)
        manual_frame.pack(fill=tk.X, pady=(10, 0))

        # Manual crop header
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

        # Manual crop canvas
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

        # Process All button
        self.process_all_btn = tk.Button(
            control_frame, text="Process All Images",
            command=self._process_all,
            bg=self.accent_color, fg="#ffffff",
            relief=tk.FLAT, padx=20, pady=10,
            font=("Segoe UI", 10, "bold"),
            width=18
        )
        self.process_all_btn.pack(pady=5)

        # Process Selected button
        self.process_selected_btn = tk.Button(
            control_frame, text="Process Selected",
            command=self._process_selected,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=20, pady=8,
            width=18,
            state=tk.DISABLED
        )
        self.process_selected_btn.pack(pady=5)

        # Separator
        ttk.Separator(control_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=20, padx=10)

        # Navigation
        tk.Label(
            control_frame, text="Navigation",
            bg=self.panel_bg, fg="#888888",
            font=("Segoe UI", 9)
        ).pack()

        nav_frame = tk.Frame(control_frame, bg=self.panel_bg)
        nav_frame.pack(pady=10)

        self.prev_btn = tk.Button(
            nav_frame, text="◀ Prev",
            command=self._prev_image,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=15,
            state=tk.DISABLED
        )
        self.prev_btn.pack(side=tk.LEFT, padx=5)

        self.next_btn = tk.Button(
            nav_frame, text="Next ▶",
            command=self._next_image,
            bg="#555555", fg="#ffffff",
            relief=tk.FLAT, padx=15,
            state=tk.DISABLED
        )
        self.next_btn.pack(side=tk.LEFT, padx=5)

        # Separator
        ttk.Separator(control_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=20, padx=10)

        # Options
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

        # Separator
        ttk.Separator(control_frame, orient=tk.HORIZONTAL).pack(fill=tk.X, pady=20, padx=10)

        # Open folders
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

        # Status label
        self.status_label = tk.Label(
            status_frame, text="Ready - Select a directory to begin",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 9),
            anchor=tk.W
        )
        self.status_label.pack(side=tk.LEFT, padx=10, pady=10)

        # Progress bar
        self.progress = ttk.Progressbar(
            status_frame, mode='determinate', length=300
        )
        self.progress.pack(side=tk.RIGHT, padx=10, pady=10)

        # Progress label
        self.progress_label = tk.Label(
            status_frame, text="",
            bg=self.panel_bg, fg=self.fg_color,
            font=("Segoe UI", 9)
        )
        self.progress_label.pack(side=tk.RIGHT, padx=5)

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
        """Browse for directory - auto-detect mode based on name."""
        directory = filedialog.askdirectory(title="Select Directory")
        if directory:
            self._load_directory(Path(directory))

    def _load_directory(self, directory: Path):
        """Load directory and detect mode based on C- prefix."""
        dir_name = directory.name

        if dir_name.startswith("C-"):
            # CORRECTION MODE: User selected a cropped output folder
            self.mode = "correction"
            self.output_dir = directory

            # Find original folder (remove C- prefix)
            original_name = dir_name[2:]  # Remove "C-"
            potential_original = directory.parent / original_name

            if potential_original.exists():
                self.original_dir = potential_original
                self.input_dir = directory  # For listing cropped images
            else:
                # Try to find original with images subfolder
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

            # Update UI for correction mode
            self.process_all_btn.configure(state=tk.DISABLED)
            self.original_preview.set_title("Original (Source)")
            self.result_preview.set_title("Current Crop (Will be replaced)")

        else:
            # NORMAL MODE: User selected a source folder
            self.mode = "normal"
            self.input_dir = directory
            self.original_dir = directory

            # Auto-generate output directory with C- prefix
            input_name = directory.name
            if input_name.lower() in ('images', 'image', 'photos', 'photo', 'pics'):
                input_name = directory.parent.name
                self.original_dir = directory

            output_name = f"C-{input_name}"
            self.output_dir = directory.parent / output_name

            self.source_label.configure(text=f"Input: {self.input_dir}")
            self.output_label.configure(text=f"Output: {self.output_dir}")

            # Update UI for normal mode
            self.process_all_btn.configure(state=tk.NORMAL)
            self.original_preview.set_title("Original")
            self.result_preview.set_title("Cropped Result")

        # Update entry and banner
        self.dir_entry.delete(0, tk.END)
        self.dir_entry.insert(0, str(directory))
        self._update_mode_banner()

        # Load images
        self._load_images()

    def _load_images(self):
        """Load images based on current mode."""
        self.images.clear()
        extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')

        if self.mode == "correction":
            # In correction mode, list cropped images and find originals
            for ext in extensions:
                for img_path in self.output_dir.rglob(f'*{ext}'):
                    # Find corresponding original
                    try:
                        rel_path = img_path.relative_to(self.output_dir)
                    except ValueError:
                        rel_path = Path(img_path.name)

                    # Original might be jpg while cropped is png
                    original_path = None
                    for orig_ext in extensions:
                        potential = self.original_dir / rel_path.with_suffix(orig_ext)
                        if potential.exists():
                            original_path = potential
                            break

                    if original_path is None:
                        # Try without nested structure
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
                    self.images.append(item)

        else:
            # Normal mode - list source images
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

                    self.images.append(item)

        # Sort by name
        self.images.sort(key=lambda x: x.name.lower())

        self._refresh_tree()

        mode_text = "correction" if self.mode == "correction" else "processing"
        self._update_status(f"Loaded {len(self.images)} images for {mode_text}")

        # Enable controls
        if self.images:
            self.open_input_btn.configure(state=tk.NORMAL)
            self.open_output_btn.configure(state=tk.NORMAL)

    def _refresh_tree(self):
        """Refresh the image list treeview."""
        self.tree.delete(*self.tree.get_children())

        filter_val = self.filter_var.get()
        visible_count = 0

        for i, item in enumerate(self.images):
            # Apply filter
            if filter_val == "pending" and item.status != "pending":
                continue
            elif filter_val == "processed" and not item.is_processed:
                continue
            elif filter_val == "error" and item.status != "error":
                continue

            # Status display
            status_map = {
                "pending": "⏳ Pending",
                "processing": "🔄 Processing",
                "auto_cropped": "✅ Auto",
                "manual_cropped": "✋ Manual",
                "error": "❌ Error"
            }
            status_text = status_map.get(item.status, item.status)

            self.tree.insert("", tk.END, iid=str(i), text=item.display_name, values=(status_text,))
            visible_count += 1

        # Update count
        total = len(self.images)
        processed = sum(1 for i in self.images if i.is_processed)
        manual = sum(1 for i in self.images if i.status == "manual_cropped")
        self.count_label.configure(
            text=f"{visible_count} shown / {total} total\n({processed} processed, {manual} manual)"
        )

    def _apply_filter(self):
        """Apply filter to image list."""
        self._refresh_tree()

    def _on_image_select(self, event):
        """Handle image selection."""
        selection = self.tree.selection()
        if not selection:
            return

        index = int(selection[0])
        self._select_image(index)

    def _select_image(self, index):
        """Select and display an image."""
        if index < 0 or index >= len(self.images):
            return

        self.current_index = index
        item = self.images[index]

        # Load original preview (from original source)
        if item.original_path and item.original_path.exists():
            self.original_preview.load_image(image_path=item.original_path)
        else:
            self.original_preview.load_image(image_path=item.input_path)

        # Load result preview if exists
        if item.output_path.exists():
            self.result_preview.load_image(image_path=item.output_path)
        else:
            self.result_preview.clear()

        # Load manual crop canvas with ORIGINAL image
        if item.original_path and item.original_path.exists():
            self.manual_canvas.load_image(item.original_path)
        else:
            self.manual_canvas.load_image(item.input_path)

        self.apply_manual_btn.configure(state=tk.NORMAL)

        # Update navigation buttons
        self.prev_btn.configure(state=tk.NORMAL if index > 0 else tk.DISABLED)
        self.next_btn.configure(state=tk.NORMAL if index < len(self.images) - 1 else tk.DISABLED)

        if self.mode == "normal":
            self.process_selected_btn.configure(state=tk.NORMAL)
        else:
            self.process_selected_btn.configure(state=tk.DISABLED)

        # Select in tree
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

        # Get pending images
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

        # Setup progress
        self.progress['value'] = 0
        self.progress['maximum'] = len(indices)

        # Start processing thread
        thread = threading.Thread(
            target=self._process_batch_thread,
            args=(indices,),
            daemon=True
        )
        thread.start()

        # Start checking queue
        self.root.after(100, self._check_process_queue)

    def _process_batch_thread(self, indices):
        """Background thread for batch processing."""
        for i, idx in enumerate(indices):
            item = self.images[idx]
            item.status = "processing"
            self.process_queue.put(("update", idx))

            try:
                # Ensure output directory exists
                item.output_path.parent.mkdir(parents=True, exist_ok=True)

                # Process image
                with Image.open(item.input_path) as img:
                    if img.mode != 'RGB':
                        img = img.convert('RGB')

                    output = remove(
                        img,
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

            self.process_queue.put(("progress", i + 1))
            self.process_queue.put(("update", idx))

        self.process_queue.put(("done", None))

    def _check_process_queue(self):
        """Check processing queue and update UI."""
        try:
            while True:
                msg_type, data = self.process_queue.get_nowait()

                if msg_type == "progress":
                    self.progress['value'] = data
                    self.progress_label.configure(text=f"{data}/{int(self.progress['maximum'])}")

                elif msg_type == "update":
                    self._refresh_tree()
                    if data == self.current_index:
                        self._select_image(data)

                elif msg_type == "done":
                    self.processing = False
                    if self.mode == "normal":
                        self.process_all_btn.configure(state=tk.NORMAL)
                        self.process_selected_btn.configure(state=tk.NORMAL)
                    self._update_status("Processing complete!")
                    self.progress_label.configure(text="")
                    return

        except queue.Empty:
            pass

        if self.processing:
            self.root.after(100, self._check_process_queue)

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
            # Ensure output directory exists
            item.output_path.parent.mkdir(parents=True, exist_ok=True)

            # Save cropped image (replaces existing if any)
            cropped.save(item.output_path, 'PNG')

            item.status = "manual_cropped"

            # Update UI
            self._refresh_tree()
            self.result_preview.load_image(pil_image=cropped)
            self._update_status(f"✓ Manual crop saved: {item.output_path.name}")

            # Auto-advance to next image
            if self.current_index < len(self.images) - 1:
                self.root.after(500, lambda: self._select_image(self.current_index + 1))

        except Exception as e:
            messagebox.showerror("Error", f"Failed to save manual crop:\n{e}")

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

    # Set DPI awareness for Windows
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except:
        pass

    app = SoilScanApp(root)
    root.mainloop()


if __name__ == '__main__':
    main()
