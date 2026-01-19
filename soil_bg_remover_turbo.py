"""
Soil Sample Background Remover - TURBO VERSION
Maximum speed optimizations for background removal.

SPEED OPTIMIZATIONS:
1. GPU acceleration (if available) - 10-50x faster
2. Lighter model (u2netp) - 2-3x faster than u2net
3. Image downscaling - 2-4x faster processing
4. Parallel processing - Uses all CPU cores
5. Session reuse - 80% faster initialization

Usage:
    python soil_bg_remover_turbo.py -i input_folder
    python soil_bg_remover_turbo.py -i input_folder --model u2net  # Higher quality
    python soil_bg_remover_turbo.py -i input_folder --max-size 1024  # Downscale large images
"""

import argparse
import sys
import os
import gc
from pathlib import Path
from typing import Optional, Tuple, List
import time
import multiprocessing

# === TURBO SETTINGS ===
DEFAULT_WORKERS = multiprocessing.cpu_count()  # Use ALL cores
DEFAULT_MODEL = "u2netp"  # 2-3x faster than u2net, good quality
MAX_IMAGE_SIZE = 1500  # Downscale images larger than this (huge speedup)
GC_INTERVAL = 5

# Available models (fastest to slowest):
# "silueta"       - Fastest, lower quality
# "u2netp"        - Fast, good quality (RECOMMENDED)
# "isnet-general-use" - Medium speed, good quality
# "u2net"         - Slowest, best quality


def check_gpu():
    """Check if GPU acceleration is available."""
    try:
        import onnxruntime as ort
        providers = ort.get_available_providers()
        if 'CUDAExecutionProvider' in providers:
            return True, "CUDA GPU"
        elif 'CoreMLExecutionProvider' in providers:
            return True, "Apple Silicon"
        elif 'DmlExecutionProvider' in providers:
            return True, "DirectML GPU"
        return False, "CPU only"
    except:
        return False, "CPU only"


def check_dependencies():
    """Check required packages."""
    missing = []
    try:
        from PIL import Image
    except ImportError:
        missing.append("Pillow")
    try:
        from rembg import remove
    except ImportError:
        missing.append("rembg[cpu]")
    try:
        from tqdm import tqdm
    except ImportError:
        missing.append("tqdm")

    if missing:
        print("Missing packages. Install with:")
        print(f"  pip install {' '.join(missing)}")
        print("\nFor GPU acceleration (10-50x faster):")
        print("  pip install rembg[gpu] onnxruntime-gpu")
        sys.exit(1)


def scan_images_fast(directory: Path, extensions: tuple, recursive: bool = True) -> List[Path]:
    """Ultra-fast image scanning."""
    images = []
    ext_set = {ext.lower() for ext in extensions} | {ext.upper() for ext in extensions}

    def scan(path):
        try:
            with os.scandir(path) as it:
                for entry in it:
                    if entry.is_file() and any(entry.name.endswith(e) for e in ext_set):
                        images.append(Path(entry.path))
                    elif entry.is_dir() and recursive:
                        scan(entry.path)
        except PermissionError:
            pass

    scan(directory)
    return sorted(images)


def process_image_turbo(
    input_path: Path,
    output_path: Path,
    session,
    max_size: int = MAX_IMAGE_SIZE,
    alpha_matting: bool = False
) -> bool:
    """Process single image with all speed optimizations."""
    from PIL import Image
    from rembg import remove

    try:
        with Image.open(input_path) as img:
            original_size = img.size

            # Convert mode
            if img.mode != 'RGB':
                img = img.convert('RGB')

            # Downscale large images for faster processing
            scale_factor = 1.0
            if max(img.size) > max_size:
                scale_factor = max_size / max(img.size)
                new_size = (int(img.width * scale_factor), int(img.height * scale_factor))
                img = img.resize(new_size, Image.Resampling.BILINEAR)

            # Remove background
            output = remove(
                img,
                session=session,
                alpha_matting=alpha_matting,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                alpha_matting_erode_size=10,
            )

            # Upscale mask back to original size if we downscaled
            if scale_factor < 1.0:
                output = output.resize(original_size, Image.Resampling.BILINEAR)

            output_path.parent.mkdir(parents=True, exist_ok=True)
            output.save(output_path, 'PNG', optimize=False)  # optimize=False is faster

            del output
            return True

    except Exception as e:
        print(f"Error: {input_path.name} - {e}")
        return False


def _worker_init(model_name):
    """Initialize worker with pre-loaded model."""
    global _worker_session
    from rembg import new_session
    _worker_session = new_session(model_name)


def _worker_process(args):
    """Worker function using pre-loaded session."""
    input_path, output_path, max_size, alpha_matting = args
    global _worker_session

    from PIL import Image
    from rembg import remove

    try:
        with Image.open(input_path) as img:
            original_size = img.size

            if img.mode != 'RGB':
                img = img.convert('RGB')

            # Downscale
            scale_factor = 1.0
            if max(img.size) > max_size:
                scale_factor = max_size / max(img.size)
                new_size = (int(img.width * scale_factor), int(img.height * scale_factor))
                img = img.resize(new_size, Image.Resampling.BILINEAR)

            output = remove(
                img,
                session=_worker_session,
                alpha_matting=alpha_matting,
            )

            if scale_factor < 1.0:
                output = output.resize(original_size, Image.Resampling.BILINEAR)

            output_path.parent.mkdir(parents=True, exist_ok=True)
            output.save(output_path, 'PNG', optimize=False)

            del output
            return (str(input_path), True, None)

    except Exception as e:
        return (str(input_path), False, str(e))


def process_batch_turbo(
    input_dir: Path,
    output_dir: Path,
    model: str = DEFAULT_MODEL,
    max_size: int = MAX_IMAGE_SIZE,
    alpha_matting: bool = False,
    num_workers: int = DEFAULT_WORKERS,
    recursive: bool = True,
    extensions: tuple = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')
) -> Tuple[int, int]:
    """Process images with maximum speed."""
    from tqdm import tqdm

    # Scan images
    print("Scanning...")
    all_images = scan_images_fast(input_dir, extensions, recursive)

    if not all_images:
        print("No images found")
        return 0, 0

    # Filter already processed
    tasks = []
    skipped = 0
    for img_path in all_images:
        try:
            rel_path = img_path.relative_to(input_dir)
        except ValueError:
            rel_path = Path(img_path.name)

        output_path = output_dir / rel_path.with_suffix('.png')

        if output_path.exists():
            skipped += 1
        else:
            tasks.append((img_path, output_path, max_size, alpha_matting))

    if not tasks:
        print(f"All {len(all_images)} images already done")
        return len(all_images), 0

    print(f"Found {len(all_images)} images ({skipped} done, {len(tasks)} to process)")
    print(f"Model: {model} | Workers: {num_workers} | Max size: {max_size}px")
    print("-" * 50)

    successful = skipped
    failed = 0

    # Use pool with pre-initialized workers
    with multiprocessing.Pool(
        processes=num_workers,
        initializer=_worker_init,
        initargs=(model,)
    ) as pool:
        results = list(tqdm(
            pool.imap_unordered(_worker_process, tasks),
            total=len(tasks),
            desc="Processing",
            unit="img"
        ))

    for path, success, error in results:
        if success:
            successful += 1
        else:
            failed += 1

    gc.collect()
    return successful, failed


def process_sequential_turbo(
    input_dir: Path,
    output_dir: Path,
    model: str = DEFAULT_MODEL,
    max_size: int = MAX_IMAGE_SIZE,
    alpha_matting: bool = False,
    recursive: bool = True,
    extensions: tuple = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')
) -> Tuple[int, int]:
    """Sequential processing (for low memory or single image)."""
    from tqdm import tqdm
    from rembg import new_session

    print("Scanning...")
    all_images = scan_images_fast(input_dir, extensions, recursive)

    if not all_images:
        print("No images found")
        return 0, 0

    print(f"Loading model: {model}...")
    session = new_session(model)

    successful = 0
    failed = 0

    for i, img_path in enumerate(tqdm(all_images, desc="Processing", unit="img")):
        try:
            rel_path = img_path.relative_to(input_dir)
        except ValueError:
            rel_path = Path(img_path.name)

        output_path = output_dir / rel_path.with_suffix('.png')

        if output_path.exists():
            successful += 1
            continue

        if process_image_turbo(img_path, output_path, session, max_size, alpha_matting):
            successful += 1
        else:
            failed += 1

        if (i + 1) % GC_INTERVAL == 0:
            gc.collect()

    return successful, failed


def main():
    parser = argparse.ArgumentParser(
        description="TURBO Background Remover - Maximum Speed",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Speed tips:
  --model silueta      Fastest (lower quality)
  --model u2netp       Fast + good quality (default)
  --model u2net        Best quality (slowest)
  --max-size 1024      Downscale large images (faster)

For GPU (10-50x faster):
  pip install rembg[gpu] onnxruntime-gpu
        """
    )

    parser.add_argument('-i', '--input', type=Path, required=True)
    parser.add_argument('-o', '--output', type=Path, default=None)
    parser.add_argument('--model', default=DEFAULT_MODEL,
                        choices=['silueta', 'u2netp', 'u2net', 'isnet-general-use'],
                        help='Model to use (default: u2netp)')
    parser.add_argument('--max-size', type=int, default=MAX_IMAGE_SIZE,
                        help=f'Max image dimension (default: {MAX_IMAGE_SIZE})')
    parser.add_argument('--workers', type=int, default=DEFAULT_WORKERS)
    parser.add_argument('--sequential', action='store_true', help='Sequential mode')
    parser.add_argument('--alpha-matting', action='store_true')
    parser.add_argument('--no-recursive', action='store_true')

    args = parser.parse_args()

    check_dependencies()

    # Check GPU
    has_gpu, gpu_type = check_gpu()
    print(f"Acceleration: {gpu_type}")

    if not args.input.exists():
        print(f"Error: {args.input} not found")
        sys.exit(1)

    if args.output is None:
        name = args.input.resolve().name
        if name.lower() in ('images', 'image', 'photos'):
            name = args.input.resolve().parent.name
        args.output = args.input.parent / f"C-{name}"

    args.output.mkdir(parents=True, exist_ok=True)

    start = time.time()

    if args.sequential:
        successful, failed = process_sequential_turbo(
            args.input, args.output, args.model, args.max_size,
            args.alpha_matting, not args.no_recursive
        )
    else:
        successful, failed = process_batch_turbo(
            args.input, args.output, args.model, args.max_size,
            args.alpha_matting, args.workers, not args.no_recursive
        )

    elapsed = time.time() - start
    rate = successful / elapsed if elapsed > 0 else 0

    print("-" * 50)
    print(f"Done in {elapsed:.1f}s ({rate:.2f} img/sec)")
    print(f"Success: {successful} | Failed: {failed}")
    print(f"Output: {args.output}")


if __name__ == '__main__':
    multiprocessing.freeze_support()
    main()
