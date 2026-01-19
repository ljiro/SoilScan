"""
SoilScan LITE - Freeform Lasso + AI + Zoom Mode
- Draw freeform lasso around soil
- AI cleans up background within your selection
- Zoom mode for detailed manual editing
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from pathlib import Path
from PIL import Image, ImageTk, ImageDraw
import threading
import os
import gc

MAX_DISPLAY_SIZE = 500


class LassoCanvas(tk.Canvas):
    """Freeform lasso selection - draw around the soil with your mouse."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.configure(bg="#2a2a2a", highlightthickness=1, highlightbackground="#444")

        self.image = None
        self.photo = None
        self.scale = 1.0
        self.offset_x = 0
        self.offset_y = 0

        self.lasso_points = []
        self.lasso_line_ids = []
        self.polygon_id = None
        self.selection_polygon = None
        self.selection_bbox = None

        self.bind("<ButtonPress-1>", self._on_press)
        self.bind("<B1-Motion>", self._on_drag)
        self.bind("<ButtonRelease-1>", self._on_release)
        self.bind("<Configure>", self._on_resize)

        self._resize_job = None

    def _on_resize(self, event):
        """Refit image when canvas is resized."""
        if self._resize_job:
            self.after_cancel(self._resize_job)
        self._resize_job = self.after(100, self._do_resize)

    def _do_resize(self):
        self._resize_job = None
        if self.image:
            self._fit_image()

    def load_image(self, img_path):
        self._clear_lasso()
        try:
            with Image.open(img_path) as img:
                self.image = img.copy()
                if self.image.mode not in ('RGB', 'RGBA'):
                    self.image = self.image.convert('RGB')
            self._fit_image()
        except Exception as e:
            self.delete("all")
            self.create_text(100, 75, text=f"Error: {e}", fill="red")

    def _fit_image(self):
        if not self.image:
            return
        self.update_idletasks()
        cw = self.winfo_width() or 400
        ch = self.winfo_height() or 150

        iw, ih = self.image.size
        self.scale = min(cw / iw, ch / ih) * 0.95
        dw, dh = int(iw * self.scale), int(ih * self.scale)
        self.offset_x = (cw - dw) // 2
        self.offset_y = (ch - dh) // 2

        display = self.image.resize((dw, dh), Image.Resampling.BILINEAR)
        if display.mode == 'RGBA':
            display = display.convert('RGB')
        self.photo = ImageTk.PhotoImage(display)
        self.delete("all")
        self.create_image(self.offset_x, self.offset_y, anchor=tk.NW, image=self.photo)

    def _canvas_to_image(self, cx, cy):
        ix = int((cx - self.offset_x) / self.scale)
        iy = int((cy - self.offset_y) / self.scale)
        if self.image:
            iw, ih = self.image.size
            ix, iy = max(0, min(ix, iw)), max(0, min(iy, ih))
        return ix, iy

    def _clear_lasso(self):
        for lid in self.lasso_line_ids:
            self.delete(lid)
        if self.polygon_id:
            self.delete(self.polygon_id)
        self.lasso_points = []
        self.lasso_line_ids = []
        self.polygon_id = None
        self.selection_polygon = None
        self.selection_bbox = None

    def _on_press(self, event):
        self._clear_lasso()
        self._fit_image()
        self.lasso_points = [(event.x, event.y)]

    def _on_drag(self, event):
        if not self.lasso_points:
            return
        lx, ly = self.lasso_points[-1]
        self.lasso_points.append((event.x, event.y))
        lid = self.create_line(lx, ly, event.x, event.y, fill="#00ff00", width=2)
        self.lasso_line_ids.append(lid)

    def _on_release(self, event):
        if not self.image or len(self.lasso_points) < 3:
            self._clear_lasso()
            return
        # Close polygon
        fx, fy = self.lasso_points[0]
        lx, ly = self.lasso_points[-1]
        lid = self.create_line(lx, ly, fx, fy, fill="#00ff00", width=2)
        self.lasso_line_ids.append(lid)

        self.selection_polygon = [self._canvas_to_image(x, y) for x, y in self.lasso_points]
        xs = [p[0] for p in self.selection_polygon]
        ys = [p[1] for p in self.selection_polygon]
        self.selection_bbox = (min(xs), min(ys), max(xs), max(ys))

        flat = [c for p in self.lasso_points for c in p]
        self.polygon_id = self.create_polygon(flat, outline="#00ff00", fill="#00ff00", stipple="gray25", width=2)

    @property
    def selection(self):
        return self.selection_bbox

    def get_cropped(self):
        if not self.image or not self.selection_polygon:
            return None
        iw, ih = self.image.size
        mask = Image.new('L', (iw, ih), 0)
        ImageDraw.Draw(mask).polygon(self.selection_polygon, fill=255)
        base = self.image.convert('RGBA')
        result = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
        result.paste(base, mask=mask)
        return result


class FieldModeCanvas(tk.Canvas):
    """Canvas with both Lasso and Box selection for field mode."""

    def __init__(self, parent, **kwargs):
        super().__init__(parent, **kwargs)
        self.configure(bg="#2a2a2a", highlightthickness=1, highlightbackground="#444")

        self.image = None
        self.photo = None
        self.scale = 1.0
        self.offset_x = 0
        self.offset_y = 0

        self.mode = "lasso"  # "lasso" or "box"

        # Lasso data
        self.lasso_points = []
        self.lasso_line_ids = []
        self.polygon_id = None
        self.selection_polygon = None

        # Box data
        self.box_start = None
        self.box_rect_id = None
        self.box_coords = None

        self.bind("<ButtonPress-1>", self._on_press)
        self.bind("<B1-Motion>", self._on_drag)
        self.bind("<ButtonRelease-1>", self._on_release)
        self.bind("<Configure>", self._on_resize)

        self._resize_job = None

    def set_mode(self, mode):
        self.mode = mode
        self._clear_selection()
        self._fit_image()

    def _on_resize(self, event):
        if self._resize_job:
            self.after_cancel(self._resize_job)
        self._resize_job = self.after(100, self._fit_image)

    def load_image(self, img):
        self._clear_selection()
        self.image = img.copy()
        if self.image.mode not in ('RGB', 'RGBA'):
            self.image = self.image.convert('RGB')
        self._fit_image()

    def _fit_image(self):
        self._resize_job = None
        if not self.image:
            return
        self.update_idletasks()
        cw = self.winfo_width() or 800
        ch = self.winfo_height() or 600

        iw, ih = self.image.size
        self.scale = min(cw / iw, ch / ih) * 0.95
        dw, dh = int(iw * self.scale), int(ih * self.scale)
        self.offset_x = (cw - dw) // 2
        self.offset_y = (ch - dh) // 2

        display = self.image.resize((dw, dh), Image.Resampling.BILINEAR)
        if display.mode == 'RGBA':
            display = display.convert('RGB')
        self.photo = ImageTk.PhotoImage(display)
        self.delete("all")
        self.create_image(self.offset_x, self.offset_y, anchor=tk.NW, image=self.photo)

    def _canvas_to_image(self, cx, cy):
        ix = int((cx - self.offset_x) / self.scale)
        iy = int((cy - self.offset_y) / self.scale)
        if self.image:
            iw, ih = self.image.size
            ix, iy = max(0, min(ix, iw)), max(0, min(iy, ih))
        return ix, iy

    def _clear_selection(self):
        # Clear lasso
        for lid in self.lasso_line_ids:
            self.delete(lid)
        if self.polygon_id:
            self.delete(self.polygon_id)
        self.lasso_points = []
        self.lasso_line_ids = []
        self.polygon_id = None
        self.selection_polygon = None

        # Clear box
        if self.box_rect_id:
            self.delete(self.box_rect_id)
        self.box_start = None
        self.box_rect_id = None
        self.box_coords = None

    def _on_press(self, event):
        self._clear_selection()
        self._fit_image()

        if self.mode == "lasso":
            self.lasso_points = [(event.x, event.y)]
        else:  # box
            self.box_start = (event.x, event.y)

    def _on_drag(self, event):
        if self.mode == "lasso":
            if not self.lasso_points:
                return
            lx, ly = self.lasso_points[-1]
            self.lasso_points.append((event.x, event.y))
            lid = self.create_line(lx, ly, event.x, event.y, fill="#00ff00", width=2)
            self.lasso_line_ids.append(lid)
        else:  # box
            if not self.box_start:
                return
            if self.box_rect_id:
                self.delete(self.box_rect_id)
            x1, y1 = self.box_start
            x2, y2 = event.x, event.y
            self.box_rect_id = self.create_rectangle(x1, y1, x2, y2,
                                                      outline="#00ff00", width=2, fill="#00ff00", stipple="gray25")

    def _on_release(self, event):
        if self.mode == "lasso":
            if not self.image or len(self.lasso_points) < 3:
                self._clear_selection()
                return
            # Close polygon
            fx, fy = self.lasso_points[0]
            lx, ly = self.lasso_points[-1]
            lid = self.create_line(lx, ly, fx, fy, fill="#00ff00", width=2)
            self.lasso_line_ids.append(lid)

            self.selection_polygon = [self._canvas_to_image(x, y) for x, y in self.lasso_points]
        else:  # box
            if not self.box_start:
                return
            x1, y1 = self.box_start
            x2, y2 = event.x, event.y
            # Convert to image coords
            ix1, iy1 = self._canvas_to_image(min(x1, x2), min(y1, y2))
            ix2, iy2 = self._canvas_to_image(max(x1, x2), max(y1, y2))
            self.box_coords = (ix1, iy1, ix2, iy2)

    def get_cropped(self):
        """Get cropped image - maintains original dimensions with transparency outside selection."""
        if not self.image:
            return None

        iw, ih = self.image.size

        if self.mode == "lasso" and self.selection_polygon:
            # Lasso: mask outside polygon
            mask = Image.new('L', (iw, ih), 0)
            ImageDraw.Draw(mask).polygon(self.selection_polygon, fill=255)
            base = self.image.convert('RGBA')
            result = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
            result.paste(base, mask=mask)
            return result

        elif self.mode == "box" and self.box_coords:
            x1, y1, x2, y2 = self.box_coords
            if x2 <= x1 or y2 <= y1:
                return None
            # Box: keep original dimensions, make outside transparent
            mask = Image.new('L', (iw, ih), 0)
            ImageDraw.Draw(mask).rectangle([x1, y1, x2, y2], fill=255)
            base = self.image.convert('RGBA')
            result = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
            result.paste(base, mask=mask)
            return result

        return None


class FieldModeWindow(tk.Toplevel):
    """Field Mode - for outdoor/field images where AI won't work.
    Draw lasso or box around soil on shovel, no AI processing."""

    def __init__(self, parent, image, callback):
        super().__init__(parent)
        self.title("Field Mode - Draw around soil sample")
        self.state('zoomed')
        self.configure(bg="#1a1a1a")

        # Set icon
        try:
            logo_path = Path(__file__).parent / "logo.png"
            if logo_path.exists():
                logo = ImageTk.PhotoImage(Image.open(logo_path))
                self.iconphoto(True, logo)
                self._logo = logo
        except: pass

        self.callback = callback
        self.image = image

        # Top bar with mode toggle
        top = tk.Frame(self, bg="#795548")
        top.pack(fill=tk.X)

        tk.Label(top, text="FIELD MODE:", bg="#795548", fg="white",
                 font=("Segoe UI", 11, "bold")).pack(side=tk.LEFT, padx=10, pady=8)

        # Mode buttons
        self.lasso_btn = tk.Button(top, text="LASSO", command=lambda: self._set_mode("lasso"),
                                    bg="#28a745", fg="white", relief=tk.FLAT, padx=15,
                                    font=("Segoe UI", 10, "bold"))
        self.lasso_btn.pack(side=tk.LEFT, padx=5, pady=5)

        self.box_btn = tk.Button(top, text="BOX", command=lambda: self._set_mode("box"),
                                  bg="#444", fg="white", relief=tk.FLAT, padx=15,
                                  font=("Segoe UI", 10))
        self.box_btn.pack(side=tk.LEFT, padx=5, pady=5)

        tk.Label(top, text="  |  AI disabled - manual selection only",
                 bg="#795548", fg="#ddd", font=("Segoe UI", 9)).pack(side=tk.LEFT, padx=10)

        # Canvas
        canvas_frame = tk.Frame(self, bg="#1a1a1a")
        canvas_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.canvas = FieldModeCanvas(canvas_frame)
        self.canvas.pack(fill=tk.BOTH, expand=True)

        # Buttons
        btn_frame = tk.Frame(self, bg="#252525")
        btn_frame.pack(fill=tk.X, pady=10)

        tk.Button(btn_frame, text="Apply & Save", command=self._apply,
                  bg="#795548", fg="white", font=("Segoe UI", 11, "bold"),
                  relief=tk.FLAT, padx=30, pady=8).pack(side=tk.LEFT, padx=20)

        tk.Button(btn_frame, text="Clear", command=self._clear,
                  bg="#ff9800", fg="white", relief=tk.FLAT, padx=20, pady=8).pack(side=tk.LEFT, padx=5)

        tk.Button(btn_frame, text="Cancel", command=self.destroy,
                  bg="#dc3545", fg="white", relief=tk.FLAT, padx=20, pady=8).pack(side=tk.LEFT, padx=5)

        self.after(100, self._load)

    def _set_mode(self, mode):
        self.canvas.set_mode(mode)
        if mode == "lasso":
            self.lasso_btn.configure(bg="#28a745", font=("Segoe UI", 10, "bold"))
            self.box_btn.configure(bg="#444", font=("Segoe UI", 10))
        else:
            self.box_btn.configure(bg="#0078d4", font=("Segoe UI", 10, "bold"))
            self.lasso_btn.configure(bg="#444", font=("Segoe UI", 10))

    def _load(self):
        self.canvas.load_image(self.image)

    def _clear(self):
        self.canvas._clear_selection()
        self.canvas._fit_image()

    def _apply(self):
        result = self.canvas.get_cropped()
        if result is None:
            return
        self.callback(result)
        self.destroy()


class ResultEditor(tk.Toplevel):
    """Edit result image - restore or remove parts with brush."""

    def __init__(self, parent, original_img, result_img, callback):
        super().__init__(parent)
        self.title("Edit Result - Brush to Restore/Remove")
        self.state('zoomed')
        self.configure(bg="#1a1a1a")

        # Set icon
        try:
            logo_path = Path(__file__).parent / "logo.png"
            if logo_path.exists():
                logo = ImageTk.PhotoImage(Image.open(logo_path))
                self.iconphoto(True, logo)
                self._logo = logo
        except: pass

        self.callback = callback
        self.original = original_img.convert('RGBA')
        self.result = result_img.convert('RGBA')
        self.working = self.result.copy()

        # Brush trace overlay (shows where brush has been applied)
        iw, ih = self.working.size
        self.trace_overlay = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))

        self.brush_size = 20
        self.mode = "restore"  # "restore" or "remove"

        self._build_ui()
        self.after(100, self._load)

    def _build_ui(self):
        # Top controls
        top = tk.Frame(self, bg="#252525")
        top.pack(fill=tk.X, pady=5)

        tk.Label(top, text="Brush Mode:", bg="#252525", fg="#aaa").pack(side=tk.LEFT, padx=10)

        self.restore_btn = tk.Button(top, text="RESTORE", command=lambda: self._set_mode("restore"),
                                      bg="#28a745", fg="white", relief=tk.FLAT, padx=15,
                                      font=("Segoe UI", 10, "bold"))
        self.restore_btn.pack(side=tk.LEFT, padx=5)

        self.remove_btn = tk.Button(top, text="REMOVE", command=lambda: self._set_mode("remove"),
                                     bg="#444", fg="white", relief=tk.FLAT, padx=15,
                                     font=("Segoe UI", 10))
        self.remove_btn.pack(side=tk.LEFT, padx=5)

        tk.Label(top, text="  |", bg="#252525", fg="#555").pack(side=tk.LEFT, padx=5)

        # Restore to Original button
        tk.Button(top, text="RESTORE ORIGINAL", command=self._restore_original,
                  bg="#0078d4", fg="white", relief=tk.FLAT, padx=15,
                  font=("Segoe UI", 10, "bold")).pack(side=tk.LEFT, padx=10)

        tk.Label(top, text="  Brush Size:", bg="#252525", fg="#aaa").pack(side=tk.LEFT, padx=5)

        self.size_scale = tk.Scale(top, from_=5, to=100, orient=tk.HORIZONTAL,
                                    bg="#252525", fg="white", highlightthickness=0,
                                    length=150, command=self._set_brush_size)
        self.size_scale.set(self.brush_size)
        self.size_scale.pack(side=tk.LEFT, padx=5)

        self.size_label = tk.Label(top, text=f"{self.brush_size}px", bg="#252525", fg="white")
        self.size_label.pack(side=tk.LEFT, padx=5)

        # Legend
        legend = tk.Frame(top, bg="#252525")
        legend.pack(side=tk.RIGHT, padx=20)
        tk.Label(legend, text="Traces:", bg="#252525", fg="#888", font=("Segoe UI", 8)).pack(side=tk.LEFT)
        tk.Label(legend, text=" ● Restored", bg="#252525", fg="#00ff00", font=("Segoe UI", 8)).pack(side=tk.LEFT, padx=5)
        tk.Label(legend, text=" ● Removed", bg="#252525", fg="#ff4444", font=("Segoe UI", 8)).pack(side=tk.LEFT, padx=5)

        # Canvas
        self.canvas = tk.Canvas(self, bg="#2a2a2a", highlightthickness=0)
        self.canvas.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.canvas.bind("<ButtonPress-1>", self._on_press)
        self.canvas.bind("<B1-Motion>", self._on_drag)
        self.canvas.bind("<ButtonRelease-1>", self._on_release)
        self.canvas.bind("<Configure>", self._on_resize)
        self.canvas.bind("<Motion>", self._show_cursor)

        # Brush cursor
        self.cursor_id = None

        # Bottom buttons
        bottom = tk.Frame(self, bg="#252525")
        bottom.pack(fill=tk.X, pady=10)

        tk.Button(bottom, text="Apply & Save", command=self._apply,
                  bg="#28a745", fg="white", font=("Segoe UI", 11, "bold"),
                  relief=tk.FLAT, padx=30, pady=8).pack(side=tk.LEFT, padx=20)

        tk.Button(bottom, text="Reset to AI Result", command=self._reset,
                  bg="#ff9800", fg="white", relief=tk.FLAT, padx=20, pady=8).pack(side=tk.LEFT, padx=5)

        tk.Button(bottom, text="Clear Traces", command=self._clear_traces,
                  bg="#607d8b", fg="white", relief=tk.FLAT, padx=15, pady=8).pack(side=tk.LEFT, padx=5)

        tk.Button(bottom, text="Cancel", command=self.destroy,
                  bg="#dc3545", fg="white", relief=tk.FLAT, padx=20, pady=8).pack(side=tk.LEFT, padx=5)

        self.photo = None
        self.scale = 1.0
        self.offset_x = 0
        self.offset_y = 0
        self._resize_job = None

    def _set_mode(self, mode):
        self.mode = mode
        if mode == "restore":
            self.restore_btn.configure(bg="#28a745", font=("Segoe UI", 10, "bold"))
            self.remove_btn.configure(bg="#444", font=("Segoe UI", 10))
        else:
            self.remove_btn.configure(bg="#dc3545", font=("Segoe UI", 10, "bold"))
            self.restore_btn.configure(bg="#444", font=("Segoe UI", 10))

    def _set_brush_size(self, val):
        self.brush_size = int(val)
        self.size_label.configure(text=f"{self.brush_size}px")

    def _load(self):
        self._fit_image()

    def _on_resize(self, event):
        if self._resize_job:
            self.after_cancel(self._resize_job)
        self._resize_job = self.after(100, self._fit_image)

    def _fit_image(self):
        self._resize_job = None
        self.canvas.update_idletasks()
        cw = self.canvas.winfo_width() or 800
        ch = self.canvas.winfo_height() or 600

        iw, ih = self.working.size
        self.scale = min(cw / iw, ch / ih) * 0.95
        dw, dh = int(iw * self.scale), int(ih * self.scale)
        self.offset_x = (cw - dw) // 2
        self.offset_y = (ch - dh) // 2

        # Composite: gray bg + working image + trace overlay
        display = Image.new('RGBA', (iw, ih), (42, 42, 42, 255))
        display.paste(self.working, mask=self.working.split()[3])
        display = Image.alpha_composite(display, self.trace_overlay)
        display = display.resize((dw, dh), Image.Resampling.BILINEAR)

        self.photo = ImageTk.PhotoImage(display)
        self.canvas.delete("all")
        self.canvas.create_image(self.offset_x, self.offset_y, anchor=tk.NW, image=self.photo)

    def _canvas_to_image(self, cx, cy):
        ix = int((cx - self.offset_x) / self.scale)
        iy = int((cy - self.offset_y) / self.scale)
        iw, ih = self.working.size
        return max(0, min(ix, iw-1)), max(0, min(iy, ih-1))

    def _show_cursor(self, event):
        """Show brush cursor on mouse move."""
        if self.cursor_id:
            self.canvas.delete(self.cursor_id)
        r = self.brush_size * self.scale / 2
        color = "#28a745" if self.mode == "restore" else "#dc3545"
        self.cursor_id = self.canvas.create_oval(event.x - r, event.y - r, event.x + r, event.y + r,
                                                  outline=color, width=2)

    def _on_press(self, event):
        self._brush(event.x, event.y)

    def _on_drag(self, event):
        self._brush(event.x, event.y)
        self._show_cursor(event)

    def _on_release(self, event):
        self._fit_image()

    def _brush(self, cx, cy):
        ix, iy = self._canvas_to_image(cx, cy)
        radius = self.brush_size // 2

        # Get pixels
        orig_pixels = self.original.load()
        work_pixels = self.working.load()
        trace_pixels = self.trace_overlay.load()

        # Trace colors (semi-transparent)
        restore_color = (0, 255, 0, 80)  # Green
        remove_color = (255, 68, 68, 80)  # Red

        iw, ih = self.working.size
        for dy in range(-radius, radius+1):
            for dx in range(-radius, radius+1):
                if dx*dx + dy*dy <= radius*radius:
                    px, py = ix + dx, iy + dy
                    if 0 <= px < iw and 0 <= py < ih:
                        if self.mode == "restore":
                            # Restore from original
                            work_pixels[px, py] = orig_pixels[px, py]
                            trace_pixels[px, py] = restore_color
                        else:
                            # Remove (make transparent)
                            pr, pg, pb, pa = work_pixels[px, py]
                            work_pixels[px, py] = (pr, pg, pb, 0)
                            trace_pixels[px, py] = remove_color

    def _restore_original(self):
        """Restore entire image to original."""
        self.working = self.original.copy()
        # Clear traces and mark all as restored
        iw, ih = self.working.size
        self.trace_overlay = Image.new('RGBA', (iw, ih), (0, 255, 0, 30))  # Light green tint
        self._fit_image()

    def _reset(self):
        """Reset to AI result."""
        self.working = self.result.copy()
        iw, ih = self.working.size
        self.trace_overlay = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
        self._fit_image()

    def _clear_traces(self):
        """Clear trace overlay only (keep edits)."""
        iw, ih = self.working.size
        self.trace_overlay = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
        self._fit_image()

    def _apply(self):
        self.callback(self.working)
        self.destroy()


class ZoomWindow(tk.Toplevel):
    """Full-screen zoom window for detailed manual editing with AI support."""

    def __init__(self, parent, image, callback, session=None):
        super().__init__(parent)
        self.title("Zoom Edit - Draw lasso, then apply")
        self.state('zoomed')  # Start maximized/fullscreen
        self.configure(bg="#1a1a1a")

        # Set window icon
        try:
            logo_path = Path(__file__).parent / "logo.png"
            if logo_path.exists():
                logo = ImageTk.PhotoImage(Image.open(logo_path))
                self.iconphoto(True, logo)
                self._logo = logo
        except: pass

        self.callback = callback
        self.image = image
        self.session = session
        self.result = None

        # Instructions
        tk.Label(self, text="Draw around the soil, then choose: Lasso Only OR AI + Apply",
                 bg="#1a1a1a", fg="#aaa", font=("Segoe UI", 11)).pack(pady=5)

        # Canvas frame
        canvas_frame = tk.Frame(self, bg="#1a1a1a")
        canvas_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self.canvas = LassoCanvas(canvas_frame)
        self.canvas.pack(fill=tk.BOTH, expand=True)

        # Status
        self.status_label = tk.Label(self, text="", bg="#1a1a1a", fg="#888", font=("Segoe UI", 9))
        self.status_label.pack(pady=2)

        # Buttons
        btn_frame = tk.Frame(self, bg="#252525")
        btn_frame.pack(fill=tk.X, pady=10)

        # AI + Apply button (the main one they want)
        self.ai_btn = tk.Button(btn_frame, text="AI + Apply", command=self._apply_ai,
                  bg="#9c27b0", fg="white", font=("Segoe UI", 11, "bold"),
                  relief=tk.FLAT, padx=30, pady=8,
                  state=tk.NORMAL if session else tk.DISABLED)
        self.ai_btn.pack(side=tk.LEFT, padx=20)

        tk.Button(btn_frame, text="Lasso Only", command=self._apply_lasso,
                  bg="#ff9800", fg="white", font=("Segoe UI", 10),
                  relief=tk.FLAT, padx=20, pady=8).pack(side=tk.LEFT, padx=5)

        tk.Button(btn_frame, text="Cancel", command=self.destroy,
                  bg="#dc3545", fg="white", font=("Segoe UI", 10),
                  relief=tk.FLAT, padx=20, pady=8).pack(side=tk.LEFT, padx=5)

        # Load image after window is shown
        self.after(100, self._load)

    def _load(self):
        # Save temp and load
        self.canvas.image = self.image.copy()
        self.canvas._fit_image()

    def _apply_lasso(self):
        """Lasso only - just extract the selection without AI."""
        self.result = self.canvas.get_cropped()
        if self.result is None:
            self.status_label.configure(text="Draw a lasso first!", fg="#ff6b6b")
            return
        self.callback(self.result)
        self.destroy()

    def _apply_ai(self):
        """AI + Lasso - AI removes background within your lasso selection."""
        if not self.session:
            self.status_label.configure(text="AI not loaded", fg="#ff6b6b")
            return
        if not self.canvas.selection_polygon:
            self.status_label.configure(text="Draw a lasso first!", fg="#ff6b6b")
            return

        self.ai_btn.configure(state=tk.DISABLED, text="Processing...")
        self.status_label.configure(text="AI processing...", fg="#9c27b0")

        def process():
            from rembg import remove
            from PIL import ImageDraw
            try:
                polygon = self.canvas.selection_polygon
                bbox = self.canvas.selection_bbox
                source = self.canvas.image

                x1, y1, x2, y2 = bbox
                iw, ih = source.size

                # Lasso mask
                lasso_mask = Image.new('L', (iw, ih), 0)
                ImageDraw.Draw(lasso_mask).polygon(polygon, fill=255)

                # Crop for faster AI processing
                base = source.convert('RGB')
                cropped = base.crop((x1, y1, x2, y2))
                ai_result = remove(cropped, session=self.session)

                # Full-size result
                result = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
                result.paste(ai_result, (x1, y1))

                # Apply lasso mask (intersection of AI mask + lasso)
                r, g, b, a = result.split()
                final_mask = Image.composite(a, Image.new('L', (iw, ih), 0), lasso_mask)
                result.putalpha(final_mask)

                self.result = result
                self.after(0, self._ai_done)
            except Exception as e:
                self.after(0, lambda: self._ai_error(str(e)))

        threading.Thread(target=process, daemon=True).start()

    def _ai_done(self):
        self.callback(self.result)
        self.destroy()

    def _ai_error(self, msg):
        self.ai_btn.configure(state=tk.NORMAL, text="AI + Apply")
        self.status_label.configure(text=f"Error: {msg}", fg="#ff6b6b")


class SoilScanLite:
    def __init__(self, root):
        self.root = root
        self.root.title("SoilScan LITE")
        self.root.state('zoomed')  # Start maximized/fullscreen
        self.root.configure(bg="#1a1a1a")

        self.input_dir = None
        self.output_dir = None
        self.image_files = []
        self.current_idx = 0
        self.session = None
        self.processing = False
        self.use_gpu = True  # Can be toggled

        self._build_ui()
        self._load_model()

    def _build_ui(self):
        # Top bar
        top = tk.Frame(self.root, bg="#252525", height=45)
        top.pack(fill=tk.X, padx=5, pady=5)
        top.pack_propagate(False)

        tk.Button(top, text="Open Folder", command=self._open_folder,
                  bg="#0078d4", fg="white", relief=tk.FLAT, padx=12).pack(side=tk.LEFT, padx=5, pady=8)

        self.status = tk.Label(top, text="Load a folder", bg="#252525", fg="#888", font=("Segoe UI", 9))
        self.status.pack(side=tk.LEFT, padx=15)

        # CPU/GPU toggle
        self.mode_var = tk.StringVar(value="GPU")
        self.mode_btn = tk.Button(top, text="GPU", command=self._toggle_mode,
                                   bg="#28a745", fg="white", relief=tk.FLAT, padx=8,
                                   font=("Segoe UI", 8, "bold"))
        self.mode_btn.pack(side=tk.RIGHT, padx=5, pady=8)

        self.gpu_label = tk.Label(top, text="Loading...", bg="#252525", fg="#666", font=("Segoe UI", 8))
        self.gpu_label.pack(side=tk.RIGHT, padx=5)

        # Main
        main = tk.Frame(self.root, bg="#1a1a1a")
        main.pack(fill=tk.BOTH, expand=True, padx=5)

        # Left list
        left = tk.Frame(main, bg="#202020", width=180)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 5))
        left.pack_propagate(False)

        tk.Label(left, text="Images", bg="#202020", fg="white", font=("Segoe UI", 9, "bold")).pack(pady=5)

        self.listbox = tk.Listbox(left, bg="#2a2a2a", fg="white", selectbackground="#0078d4",
                                   highlightthickness=0, font=("Segoe UI", 8))
        self.listbox.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        self.listbox.bind('<<ListboxSelect>>', self._on_select)

        self.count_label = tk.Label(left, text="0 images", bg="#202020", fg="#666", font=("Segoe UI", 8))
        self.count_label.pack(pady=2)

        # Current position indicator
        self.pos_label = tk.Label(left, text="", bg="#202020", fg="#0078d4", font=("Segoe UI", 10, "bold"))
        self.pos_label.pack(pady=3)

        # Center - reorganized: Lasso BIG at top, previews at bottom
        center = tk.Frame(main, bg="#1a1a1a")
        center.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Lasso section - BIG, takes most space
        lasso_frame = tk.Frame(center, bg="#252525")
        lasso_frame.pack(fill=tk.BOTH, expand=True, pady=(0, 5))

        lh = tk.Frame(lasso_frame, bg="#252525")
        lh.pack(fill=tk.X, padx=5, pady=3)

        tk.Label(lh, text="Draw lasso around soil:", bg="#252525", fg="#aaa",
                 font=("Segoe UI", 9, "bold")).pack(side=tk.LEFT)

        # Field mode - for outdoor/field images where AI won't work
        self.field_btn = tk.Button(lh, text="FIELD MODE", command=self._open_field_mode,
                                    bg="#795548", fg="white", relief=tk.FLAT, padx=12,
                                    font=("Segoe UI", 9, "bold"), state=tk.DISABLED)
        self.field_btn.pack(side=tk.RIGHT, padx=5)

        # Zoom button - opens full window
        self.zoom_btn = tk.Button(lh, text="ZOOM EDIT", command=self._open_zoom,
                                   bg="#e91e63", fg="white", relief=tk.FLAT, padx=12,
                                   font=("Segoe UI", 9, "bold"), state=tk.DISABLED)
        self.zoom_btn.pack(side=tk.RIGHT, padx=5)

        self.smart_btn = tk.Button(lh, text="AI + Lasso", command=self._smart_crop,
                                    bg="#9c27b0", fg="white", relief=tk.FLAT, padx=12,
                                    font=("Segoe UI", 9, "bold"), state=tk.DISABLED)
        self.smart_btn.pack(side=tk.RIGHT, padx=5)

        self.manual_btn = tk.Button(lh, text="Lasso Only", command=self._apply_manual,
                                     bg="#ff9800", fg="white", relief=tk.FLAT, padx=10, state=tk.DISABLED)
        self.manual_btn.pack(side=tk.RIGHT, padx=5)

        # Lasso canvas - fills remaining space (big!)
        self.lasso_canvas = LassoCanvas(lasso_frame)
        self.lasso_canvas.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Controls bar
        ctrl = tk.Frame(center, bg="#252525", height=50)
        ctrl.pack(fill=tk.X, pady=2)
        ctrl.pack_propagate(False)

        tk.Button(ctrl, text="< Prev", command=self._prev, bg="#444", fg="white",
                  relief=tk.FLAT, padx=12).pack(side=tk.LEFT, padx=5, pady=10)

        self.ai_btn = tk.Button(ctrl, text="AI Full", command=self._process_current,
                                 bg="#28a745", fg="white", relief=tk.FLAT, padx=15,
                                 font=("Segoe UI", 9, "bold"))
        self.ai_btn.pack(side=tk.LEFT, padx=5, pady=10)

        self.ai_all_btn = tk.Button(ctrl, text="AI All", command=self._process_all,
                                     bg="#0078d4", fg="white", relief=tk.FLAT, padx=15)
        self.ai_all_btn.pack(side=tk.LEFT, padx=5, pady=10)

        tk.Button(ctrl, text="Next >", command=self._next, bg="#444", fg="white",
                  relief=tk.FLAT, padx=12).pack(side=tk.LEFT, padx=5, pady=10)

        self.progress = ttk.Progressbar(ctrl, length=120, mode='determinate')
        self.progress.pack(side=tk.RIGHT, padx=10, pady=10)

        self.prog_label = tk.Label(ctrl, text="", bg="#252525", fg="white", font=("Segoe UI", 8))
        self.prog_label.pack(side=tk.RIGHT, padx=5)

        # Previews - BOTTOM, smaller
        preview = tk.Frame(center, bg="#1a1a1a", height=200)
        preview.pack(fill=tk.X, pady=2)
        preview.pack_propagate(False)

        # Original
        of = tk.Frame(preview, bg="#1a1a1a")
        of.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=2)
        tk.Label(of, text="Original", bg="#1a1a1a", fg="#888", font=("Segoe UI", 8)).pack()
        self.orig_canvas = tk.Canvas(of, bg="#2a2a2a", highlightthickness=0)
        self.orig_canvas.pack(fill=tk.BOTH, expand=True)

        # Result (click to edit)
        rf = tk.Frame(preview, bg="#1a1a1a")
        rf.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=2)

        rf_header = tk.Frame(rf, bg="#1a1a1a")
        rf_header.pack(fill=tk.X)
        tk.Label(rf_header, text="Result (click to edit)", bg="#1a1a1a", fg="#888", font=("Segoe UI", 8)).pack(side=tk.LEFT)

        self.result_canvas = tk.Canvas(rf, bg="#2a2a2a", highlightthickness=0, cursor="hand2")
        self.result_canvas.pack(fill=tk.BOTH, expand=True)
        self.result_canvas.bind("<Button-1>", lambda e: self._edit_result())
        self._result_clickable = False

        self._photo_orig = None
        self._photo_result = None

        # Bind resize to refresh previews
        self._resize_job = None
        self.root.bind("<Configure>", self._on_window_resize)

    def _on_window_resize(self, event):
        """Refresh previews when window is resized."""
        if event.widget == self.root:
            if self._resize_job:
                self.root.after_cancel(self._resize_job)
            self._resize_job = self.root.after(150, self._refresh_previews)

    def _refresh_previews(self):
        """Redraw previews at new size."""
        self._resize_job = None
        if self.image_files and self.current_idx < len(self.image_files):
            self._show_previews()

    def _toggle_mode(self):
        """Toggle between CPU and GPU processing."""
        if self.processing:
            return  # Don't switch while processing

        self.use_gpu = not self.use_gpu
        mode = "GPU" if self.use_gpu else "CPU"
        self.mode_btn.configure(text=mode, bg="#28a745" if self.use_gpu else "#ff9800")
        self.status.configure(text=f"Switching to {mode}...")
        self._load_model()

    def _detect_gpu(self):
        """Detect GPU name and type."""
        gpu_name = "Unknown"
        gpu_type = "CPU"

        # Try to get GPU name
        try:
            import subprocess
            # Try nvidia-smi for NVIDIA
            result = subprocess.run(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'],
                                     capture_output=True, text=True, timeout=5)
            if result.returncode == 0 and result.stdout.strip():
                gpu_name = result.stdout.strip().split('\n')[0]
                gpu_type = "CUDA"
        except:
            pass

        if gpu_type == "CPU":
            try:
                # Try wmic for Windows (AMD/Intel)
                import subprocess
                result = subprocess.run(['wmic', 'path', 'win32_VideoController', 'get', 'name'],
                                         capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    lines = [l.strip() for l in result.stdout.strip().split('\n') if l.strip() and l.strip() != 'Name']
                    if lines:
                        gpu_name = lines[0]
                        if 'AMD' in gpu_name or 'Radeon' in gpu_name:
                            gpu_type = "DirectML"
                        elif 'NVIDIA' in gpu_name or 'GeForce' in gpu_name or 'RTX' in gpu_name:
                            gpu_type = "CUDA"
                        elif 'Intel' in gpu_name:
                            gpu_type = "DirectML"
            except:
                pass

        return gpu_name, gpu_type

    def _load_model(self):
        def load():
            try:
                import onnxruntime as ort
                providers = ort.get_available_providers()
                from rembg import new_session

                has_dml = 'DmlExecutionProvider' in providers
                has_cuda = 'CUDAExecutionProvider' in providers

                # Detect GPU
                gpu_name, detected_type = self._detect_gpu()
                short_name = gpu_name[:25] + "..." if len(gpu_name) > 28 else gpu_name

                if self.use_gpu and has_cuda:
                    self.session = new_session('u2netp', providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
                    mode_text = "CUDA"
                    self.root.after(0, lambda: self.mode_btn.configure(text="GPU", bg="#28a745"))
                elif self.use_gpu and has_dml:
                    self.session = new_session('u2netp', providers=['DmlExecutionProvider', 'CPUExecutionProvider'])
                    mode_text = "DirectML"
                    self.root.after(0, lambda: self.mode_btn.configure(text="GPU", bg="#28a745"))
                else:
                    self.session = new_session('u2netp', providers=['CPUExecutionProvider'])
                    mode_text = "CPU"
                    self.use_gpu = False
                    self.root.after(0, lambda: self.mode_btn.configure(text="CPU", bg="#ff9800"))

                display_text = f"{mode_text}: {short_name}"
                is_gpu = mode_text != "CPU"
                self.root.after(0, lambda: self.gpu_label.configure(text=display_text, fg="#28a745" if is_gpu else "#ff9800"))
                self.root.after(0, lambda: self.status.configure(text="Ready"))
            except Exception as e:
                self.root.after(0, lambda: self.status.configure(text=f"Error: {e}"))

        threading.Thread(target=load, daemon=True).start()

    def _open_folder(self):
        folder = filedialog.askdirectory()
        if not folder:
            return
        self.input_dir = Path(folder)
        name = self.input_dir.name
        if name.lower() in ('images', 'image', 'photos'):
            name = self.input_dir.parent.name
        self.output_dir = self.input_dir.parent / f"C-{name}"
        self.output_dir.mkdir(exist_ok=True)
        self._scan()

    def _scan(self):
        exts = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
        def scan(p):
            try:
                with os.scandir(p) as it:
                    for e in it:
                        if e.is_file() and Path(e.name).suffix.lower() in exts:
                            yield Path(e.path)
                        elif e.is_dir():
                            yield from scan(e.path)
            except: pass

        self.image_files = sorted(scan(self.input_dir))
        self.listbox.delete(0, tk.END)
        pending = 0
        for img in self.image_files:
            rel = img.relative_to(self.input_dir)
            out = self.output_dir / rel.with_suffix('.png')
            s = "✓" if out.exists() else "○"
            if not out.exists(): pending += 1
            self.listbox.insert(tk.END, f"{s} {img.name}")

        self.count_label.configure(text=f"{len(self.image_files)} ({pending} pending)")
        if self.image_files:
            self.current_idx = 0
            self.listbox.selection_set(0)
            self._show()

    def _on_select(self, e):
        sel = self.listbox.curselection()
        if sel:
            self.current_idx = sel[0]
            self._show()

    def _show(self):
        if not self.image_files or self.current_idx >= len(self.image_files):
            return

        img_path = self.image_files[self.current_idx]

        # Update position indicator
        self.pos_label.configure(text=f"{self.current_idx + 1} / {len(self.image_files)}")

        # Load lasso canvas
        self.lasso_canvas.load_image(img_path)
        self.manual_btn.configure(state=tk.NORMAL)
        self.smart_btn.configure(state=tk.NORMAL if self.session else tk.DISABLED)
        self.zoom_btn.configure(state=tk.NORMAL)
        self.field_btn.configure(state=tk.NORMAL)

        # Show previews
        self._show_previews()

    def _show_previews(self):
        """Show original and result previews at current canvas size."""
        if not self.image_files or self.current_idx >= len(self.image_files):
            return

        img_path = self.image_files[self.current_idx]
        rel = img_path.relative_to(self.input_dir)
        out_path = self.output_dir / rel.with_suffix('.png')

        self._photo_orig = self._photo_result = None
        gc.collect()

        # Get canvas sizes for dynamic scaling
        self.orig_canvas.update_idletasks()
        self.result_canvas.update_idletasks()
        oc_w = max(50, self.orig_canvas.winfo_width() - 10)
        oc_h = max(50, self.orig_canvas.winfo_height() - 10)
        rc_w = max(50, self.result_canvas.winfo_width() - 10)
        rc_h = max(50, self.result_canvas.winfo_height() - 10)

        # Show original - scale to fit canvas
        try:
            with Image.open(img_path) as img:
                img.thumbnail((oc_w, oc_h), Image.Resampling.BILINEAR)
                if img.mode not in ('RGB', 'RGBA'): img = img.convert('RGB')
                self._photo_orig = ImageTk.PhotoImage(img)

            self.orig_canvas.delete("all")
            self.orig_canvas.create_image(self.orig_canvas.winfo_width()//2, self.orig_canvas.winfo_height()//2,
                                           anchor=tk.CENTER, image=self._photo_orig)
        except: pass

        # Show result - scale to fit canvas
        if out_path.exists():
            try:
                with Image.open(out_path) as img:
                    img.thumbnail((rc_w, rc_h), Image.Resampling.BILINEAR)
                    if img.mode == 'RGBA':
                        bg = Image.new('RGB', img.size, '#2a2a2a')
                        bg.paste(img, mask=img.split()[3])
                        img = bg
                    self._photo_result = ImageTk.PhotoImage(img)

                self.result_canvas.delete("all")
                self.result_canvas.create_image(self.result_canvas.winfo_width()//2, self.result_canvas.winfo_height()//2,
                                                 anchor=tk.CENTER, image=self._photo_result)
                self._result_clickable = True
                self.result_canvas.configure(cursor="hand2")
            except: pass
        else:
            self.result_canvas.delete("all")
            self.result_canvas.create_text(self.result_canvas.winfo_width()//2, self.result_canvas.winfo_height()//2,
                                            text="Not processed", fill="#555")
            self._result_clickable = False
            self.result_canvas.configure(cursor="")

    def _edit_result(self):
        """Open result editor with brush tools - click on result to edit."""
        if not self._result_clickable or not self.image_files:
            return

        img_path = self.image_files[self.current_idx]
        rel = img_path.relative_to(self.input_dir)
        out_path = self.output_dir / rel.with_suffix('.png')

        if not out_path.exists():
            return

        try:
            with Image.open(img_path) as orig:
                original = orig.copy()
            with Image.open(out_path) as res:
                result = res.copy()

            ResultEditor(self.root, original, result, self._edit_result_callback)
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _edit_result_callback(self, edited_image):
        """Save edited result."""
        if edited_image is None:
            return

        img_path = self.image_files[self.current_idx]
        rel = img_path.relative_to(self.input_dir)
        out_path = self.output_dir / rel.with_suffix('.png')

        try:
            edited_image.save(out_path, 'PNG')
            self._show_previews()
            self.status.configure(text=f"Edited: {out_path.name}")
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _prev(self):
        if self.current_idx > 0:
            self.current_idx -= 1
            self.listbox.selection_clear(0, tk.END)
            self.listbox.selection_set(self.current_idx)
            self.listbox.see(self.current_idx)
            self._show()

    def _next(self):
        if self.current_idx < len(self.image_files) - 1:
            self.current_idx += 1
            self.listbox.selection_clear(0, tk.END)
            self.listbox.selection_set(self.current_idx)
            self.listbox.see(self.current_idx)
            self._show()

    def _open_field_mode(self):
        """Open Field Mode for outdoor/field images where AI won't work."""
        if not self.image_files:
            return
        img_path = self.image_files[self.current_idx]
        try:
            with Image.open(img_path) as img:
                image = img.copy()
                if image.mode not in ('RGB', 'RGBA'):
                    image = image.convert('RGB')
            FieldModeWindow(self.root, image, self._field_mode_callback)
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _field_mode_callback(self, result):
        """Called when field mode applies selection."""
        if result is None:
            return

        img_path = self.image_files[self.current_idx]
        rel = img_path.relative_to(self.input_dir)
        out_path = self.output_dir / rel.with_suffix('.png')

        try:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            result.save(out_path, 'PNG')
            self._mark_done(self.current_idx)
            self._show()
            self.status.configure(text=f"Field mode saved: {out_path.name}")
            if self.current_idx < len(self.image_files) - 1:
                self.root.after(200, self._next)
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _open_zoom(self):
        """Open full-screen zoom window with AI + Lasso support."""
        if not self.image_files:
            return
        img_path = self.image_files[self.current_idx]
        try:
            with Image.open(img_path) as img:
                image = img.copy()
                if image.mode not in ('RGB', 'RGBA'):
                    image = image.convert('RGB')
            # Pass session so AI + Apply works in zoom mode
            ZoomWindow(self.root, image, self._zoom_callback, session=self.session)
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _zoom_callback(self, result):
        """Called when zoom window applies selection."""
        if result is None:
            return

        img_path = self.image_files[self.current_idx]
        rel = img_path.relative_to(self.input_dir)
        out_path = self.output_dir / rel.with_suffix('.png')

        try:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            result.save(out_path, 'PNG')
            self._mark_done(self.current_idx)
            self._show()
            self.status.configure(text=f"Zoom edit saved: {out_path.name}")
            if self.current_idx < len(self.image_files) - 1:
                self.root.after(200, self._next)
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _apply_manual(self):
        if not self.image_files:
            return
        cropped = self.lasso_canvas.get_cropped()
        if not cropped:
            messagebox.showwarning("No Selection", "Draw a lasso around the soil first!")
            return

        img_path = self.image_files[self.current_idx]
        rel = img_path.relative_to(self.input_dir)
        out_path = self.output_dir / rel.with_suffix('.png')

        try:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            cropped.save(out_path, 'PNG')
            del cropped; gc.collect()
            self._mark_done(self.current_idx)
            self._show()
            self.status.configure(text=f"Lasso saved: {out_path.name}")
            if self.current_idx < len(self.image_files) - 1:
                self.root.after(200, self._next)
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _smart_crop(self):
        """AI + Lasso: AI removes bg within your lasso selection."""
        if not self.image_files or not self.session:
            return
        if not self.lasso_canvas.selection_polygon:
            messagebox.showwarning("No Lasso", "Draw around the soil first!")
            return

        polygon = self.lasso_canvas.selection_polygon
        bbox = self.lasso_canvas.selection_bbox
        source = self.lasso_canvas.image
        if not source: return

        x1, y1, x2, y2 = bbox
        img_path = self.image_files[self.current_idx]
        rel = img_path.relative_to(self.input_dir)
        out_path = self.output_dir / rel.with_suffix('.png')

        self.smart_btn.configure(state=tk.DISABLED, text="Processing...")
        self.status.configure(text="AI processing lasso...")

        def process():
            from rembg import remove
            try:
                base = source.convert('RGB')
                iw, ih = base.size

                # Lasso mask
                lasso_mask = Image.new('L', (iw, ih), 0)
                ImageDraw.Draw(lasso_mask).polygon(polygon, fill=255)

                # Crop for faster AI
                cropped = base.crop((x1, y1, x2, y2))
                ai_result = remove(cropped, session=self.session)

                # Full result
                result = Image.new('RGBA', (iw, ih), (0, 0, 0, 0))
                result.paste(ai_result, (x1, y1))

                # Apply lasso mask
                r, g, b, a = result.split()
                final_mask = Image.composite(a, Image.new('L', (iw, ih), 0), lasso_mask)
                result.putalpha(final_mask)

                out_path.parent.mkdir(parents=True, exist_ok=True)
                result.save(out_path, 'PNG')

                del cropped, ai_result, result; gc.collect()
                self.root.after(0, lambda: self._smart_done(out_path.name))
            except Exception as e:
                self.root.after(0, lambda: self._smart_error(str(e)))

        threading.Thread(target=process, daemon=True).start()

    def _smart_done(self, fn):
        self.smart_btn.configure(state=tk.NORMAL, text="AI + Lasso")
        self._mark_done(self.current_idx)
        self._show()
        self.status.configure(text=f"AI + Lasso saved: {fn}")
        if self.current_idx < len(self.image_files) - 1:
            self.root.after(300, self._next)

    def _smart_error(self, e):
        self.smart_btn.configure(state=tk.NORMAL, text="AI + Lasso")
        self.status.configure(text=f"Error: {e}")

    def _process_current(self):
        if self.processing or not self.session: return
        self._process([self.current_idx])

    def _process_all(self):
        if self.processing or not self.session: return
        pending = [i for i, img in enumerate(self.image_files)
                   if not (self.output_dir / img.relative_to(self.input_dir).with_suffix('.png')).exists()]
        if not pending:
            messagebox.showinfo("Done", "All processed!")
            return
        self._process(pending)

    def _process(self, indices):
        self.processing = True
        self.ai_btn.configure(state=tk.DISABLED)
        self.ai_all_btn.configure(state=tk.DISABLED)

        def run():
            from rembg import remove
            for i, idx in enumerate(indices):
                img_path = self.image_files[idx]
                rel = img_path.relative_to(self.input_dir)
                out_path = self.output_dir / rel.with_suffix('.png')

                self.root.after(0, lambda p=i+1, t=len(indices): self._prog(p, t))
                try:
                    out_path.parent.mkdir(parents=True, exist_ok=True)
                    with Image.open(img_path) as img:
                        if img.mode != 'RGB': img = img.convert('RGB')
                        out = remove(img, session=self.session)
                        out.save(out_path, 'PNG', optimize=False)
                        del out
                    self.root.after(0, lambda idx=idx: self._mark_done(idx))
                except Exception as e:
                    print(f"Error: {e}")
                gc.collect()
            self.root.after(0, self._proc_done)

        threading.Thread(target=run, daemon=True).start()

    def _prog(self, c, t):
        self.progress['value'] = (c/t)*100
        self.prog_label.configure(text=f"{c}/{t}")

    def _mark_done(self, idx):
        txt = self.listbox.get(idx)
        self.listbox.delete(idx)
        self.listbox.insert(idx, "✓" + txt[1:])
        if idx == self.current_idx:
            self._show()

    def _proc_done(self):
        self.processing = False
        self.ai_btn.configure(state=tk.NORMAL)
        self.ai_all_btn.configure(state=tk.NORMAL)
        self.progress['value'] = 0
        self.prog_label.configure(text="Done!")
        self._scan()


def main():
    root = tk.Tk()
    try:
        from ctypes import windll
        windll.shcore.SetProcessDpiAwareness(1)
    except: pass

    # Set window icon
    try:
        logo_path = Path(__file__).parent / "logo.png"
        if logo_path.exists():
            logo = ImageTk.PhotoImage(Image.open(logo_path))
            root.iconphoto(True, logo)
            root._logo = logo  # Keep reference
    except: pass

    SoilScanLite(root)
    root.mainloop()

if __name__ == '__main__':
    main()
