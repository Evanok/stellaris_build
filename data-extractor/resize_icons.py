#!/usr/bin/env python3
"""
Resize all PNG icons to 32x32 for optimal web performance.
This script processes all icons in frontend/public/icons/
"""

import os
import sys
from PIL import Image
from pathlib import Path

def resize_icon(input_path, output_path, size=(32, 32)):
    """Resize a single PNG icon to the specified size."""
    try:
        with Image.open(input_path) as img:
            # Use LANCZOS for high-quality downsampling
            # Use Image.LANCZOS for compatibility with older Pillow versions
            resized = img.resize(size, Image.LANCZOS)
            resized.save(output_path, 'PNG', optimize=True)
            return True
    except Exception as e:
        print(f"Error resizing {input_path}: {e}")
        return False

def resize_all_icons(icons_dir, size=(32, 32), dry_run=False):
    """Resize all PNG icons in the icons directory."""
    icons_dir = Path(icons_dir)

    if not icons_dir.exists():
        print(f"Error: Directory {icons_dir} does not exist")
        return

    # Find all PNG files recursively
    png_files = list(icons_dir.rglob("*.png"))

    print(f"Found {len(png_files)} PNG files")
    print(f"Target size: {size[0]}x{size[1]}")

    if dry_run:
        print("\n[DRY RUN MODE - No files will be modified]")

    success_count = 0
    skip_count = 0
    error_count = 0
    total_before = 0
    total_after = 0

    for png_file in png_files:
        # Get current size
        try:
            with Image.open(png_file) as img:
                current_size = img.size
                file_size_before = png_file.stat().st_size
                total_before += file_size_before
        except Exception as e:
            print(f"Error reading {png_file}: {e}")
            error_count += 1
            continue

        # Skip if already correct size
        if current_size == size:
            skip_count += 1
            total_after += file_size_before
            continue

        print(f"Resizing: {png_file.name} ({current_size[0]}x{current_size[1]} -> {size[0]}x{size[1]})", end="")

        if dry_run:
            print(" [DRY RUN]")
            success_count += 1
            continue

        # Resize in-place
        if resize_icon(png_file, png_file, size):
            file_size_after = png_file.stat().st_size
            total_after += file_size_after
            reduction = ((file_size_before - file_size_after) / file_size_before) * 100
            print(f" ✓ ({file_size_before//1024}KB -> {file_size_after//1024}KB, -{reduction:.1f}%)")
            success_count += 1
        else:
            print(" ✗ FAILED")
            error_count += 1

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"Total files: {len(png_files)}")
    print(f"Resized: {success_count}")
    print(f"Skipped (already correct size): {skip_count}")
    print(f"Errors: {error_count}")

    if not dry_run and total_before > 0:
        print(f"\nTotal size before: {total_before / (1024*1024):.2f} MB")
        print(f"Total size after: {total_after / (1024*1024):.2f} MB")
        reduction = ((total_before - total_after) / total_before) * 100
        print(f"Total reduction: {reduction:.1f}% ({(total_before - total_after) / (1024*1024):.2f} MB saved)")

def main():
    # Default path
    script_dir = Path(__file__).parent
    default_icons_dir = script_dir / "../frontend/public/icons"

    # Check for dry-run flag first
    dry_run = "--dry-run" in sys.argv or "-n" in sys.argv

    # Get icons directory (skip flags)
    args = [arg for arg in sys.argv[1:] if not arg.startswith("-")]
    if len(args) > 0:
        icons_dir = args[0]
    else:
        icons_dir = default_icons_dir

    print("=" * 70)
    print("ICON RESIZE UTILITY")
    print("=" * 70)
    print(f"Icons directory: {icons_dir}")
    print()

    resize_all_icons(icons_dir, size=(32, 32), dry_run=dry_run)

if __name__ == "__main__":
    main()
