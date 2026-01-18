"""
Soil Sample Background Remover
Removes white bag/container backgrounds from soil sample images.
Uses Rembg (AI-based) for accurate background removal.

Usage:
    python soil_bg_remover.py                    # Process default input folder
    python soil_bg_remover.py -i input -o output # Custom folders
    python soil_bg_remover.py --watch            # Watch mode (auto-process new files)
"""

import argparse
import sys
from pathlib import Path
from typing import Optional
import time


def check_dependencies():
    """Check if required packages are installed."""
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
        print("Missing required packages. Install with:")
        print(f"  pip install {' '.join(missing)}")
        print("\nOr install all at once:")
        print("  pip install Pillow \"rembg[cpu]\" tqdm")
        sys.exit(1)


def process_single_image(
    input_path: Path,
    output_path: Path,
    alpha_matting: bool = False,
    post_process_mask: bool = False
) -> bool:
    """
    Remove background from a single image.

    Args:
        input_path: Path to input image
        output_path: Path to save output image
        alpha_matting: Use alpha matting for better edges (slower)
        post_process_mask: Apply post-processing to mask

    Returns:
        True if successful, False otherwise
    """
    from PIL import Image
    from rembg import remove

    try:
        # Read input image
        with Image.open(input_path) as img:
            # Convert to RGB if necessary (handle RGBA, grayscale, etc.)
            if img.mode != 'RGB':
                img = img.convert('RGB')

            # Remove background
            output = remove(
                img,
                alpha_matting=alpha_matting,
                alpha_matting_foreground_threshold=240,
                alpha_matting_background_threshold=10,
                alpha_matting_erode_size=10,
                post_process_mask=post_process_mask,
            )

            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)

            # Save as PNG (to preserve transparency)
            output.save(output_path, 'PNG')

        return True

    except Exception as e:
        print(f"Error processing {input_path.name}: {e}")
        return False


def process_batch(
    input_dir: Path,
    output_dir: Path,
    alpha_matting: bool = False,
    recursive: bool = True,
    extensions: tuple = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')
) -> tuple[int, int]:
    """
    Process all images in a directory.

    Args:
        input_dir: Input directory containing images
        output_dir: Output directory for processed images
        alpha_matting: Use alpha matting for better edges
        recursive: Process subdirectories
        extensions: File extensions to process

    Returns:
        Tuple of (successful_count, failed_count)
    """
    from tqdm import tqdm

    # Find all image files
    if recursive:
        image_files = []
        for ext in extensions:
            image_files.extend(input_dir.rglob(f'*{ext}'))
            image_files.extend(input_dir.rglob(f'*{ext.upper()}'))
    else:
        image_files = []
        for ext in extensions:
            image_files.extend(input_dir.glob(f'*{ext}'))
            image_files.extend(input_dir.glob(f'*{ext.upper()}'))

    # Remove duplicates and sort
    image_files = sorted(set(image_files))

    if not image_files:
        print(f"No images found in {input_dir}")
        return 0, 0

    print(f"Found {len(image_files)} images to process")
    print(f"Output directory: {output_dir}")
    print("-" * 50)

    successful = 0
    failed = 0

    for img_path in tqdm(image_files, desc="Removing backgrounds", unit="img"):
        # Calculate relative path to maintain folder structure
        try:
            rel_path = img_path.relative_to(input_dir)
        except ValueError:
            rel_path = img_path.name

        # Create output path (change extension to .png)
        output_path = output_dir / rel_path.with_suffix('.png')

        # Skip if output already exists
        if output_path.exists():
            successful += 1
            continue

        if process_single_image(img_path, output_path, alpha_matting):
            successful += 1
        else:
            failed += 1

    return successful, failed


def watch_directory(
    input_dir: Path,
    output_dir: Path,
    alpha_matting: bool = False,
    extensions: tuple = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')
):
    """
    Watch directory for new images and process them automatically.
    """
    from tqdm import tqdm

    print(f"Watching {input_dir} for new images...")
    print(f"Output directory: {output_dir}")
    print("Press Ctrl+C to stop")
    print("-" * 50)

    processed = set()

    try:
        while True:
            # Find all image files
            image_files = []
            for ext in extensions:
                image_files.extend(input_dir.rglob(f'*{ext}'))
                image_files.extend(input_dir.rglob(f'*{ext.upper()}'))

            # Process new files
            for img_path in image_files:
                if img_path in processed:
                    continue

                try:
                    rel_path = img_path.relative_to(input_dir)
                except ValueError:
                    rel_path = img_path.name

                output_path = output_dir / rel_path.with_suffix('.png')

                if output_path.exists():
                    processed.add(img_path)
                    continue

                print(f"Processing: {img_path.name}")
                if process_single_image(img_path, output_path, alpha_matting):
                    print(f"  -> Saved: {output_path.name}")
                    processed.add(img_path)

            time.sleep(2)  # Check every 2 seconds

    except KeyboardInterrupt:
        print("\nStopped watching.")


def main():
    parser = argparse.ArgumentParser(
        description="Remove white backgrounds from soil sample images",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python soil_bg_remover.py
      Process images from default input folder

  python soil_bg_remover.py -i samples -o cleaned
      Process 'samples' folder, output to 'cleaned'

  python soil_bg_remover.py --watch
      Watch for new images and process automatically

  python soil_bg_remover.py --alpha-matting
      Use alpha matting for cleaner edges (slower)
        """
    )

    parser.add_argument(
        '-i', '--input',
        type=Path,
        default=Path('SF-AgriCapture_20260117_1708/images'),
        help='Input directory containing images (default: SF-AgriCapture_20260117_1708/images)'
    )

    parser.add_argument(
        '-o', '--output',
        type=Path,
        default=None,
        help='Output directory for processed images (default: C-{input_folder_name})'
    )

    parser.add_argument(
        '--alpha-matting',
        action='store_true',
        help='Use alpha matting for better edge quality (slower)'
    )

    parser.add_argument(
        '--watch',
        action='store_true',
        help='Watch input directory for new files'
    )

    parser.add_argument(
        '--no-recursive',
        action='store_true',
        help='Do not process subdirectories'
    )

    args = parser.parse_args()

    # Check dependencies
    check_dependencies()

    # Validate input directory
    if not args.input.exists():
        print(f"Error: Input directory '{args.input}' does not exist")
        sys.exit(1)

    # Auto-generate output directory with C- prefix if not specified
    if args.output is None:
        input_name = args.input.resolve().name
        # If input is a subdirectory like "images", use parent folder name
        if input_name.lower() in ('images', 'image', 'photos', 'photo', 'pics'):
            input_name = args.input.resolve().parent.name
        # Add C- prefix for "Cropped"
        output_name = f"C-{input_name}"
        args.output = args.input.parent / output_name

    # Create output directory
    args.output.mkdir(parents=True, exist_ok=True)

    if args.watch:
        watch_directory(
            args.input,
            args.output,
            args.alpha_matting
        )
    else:
        start_time = time.time()

        successful, failed = process_batch(
            args.input,
            args.output,
            args.alpha_matting,
            recursive=not args.no_recursive
        )

        elapsed = time.time() - start_time

        print("-" * 50)
        print(f"Completed in {elapsed:.1f} seconds")
        print(f"  Successful: {successful}")
        print(f"  Failed: {failed}")
        print(f"  Output: {args.output.absolute()}")


if __name__ == '__main__':
    main()
