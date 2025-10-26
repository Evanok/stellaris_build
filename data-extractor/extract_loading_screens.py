#!/usr/bin/env python3
"""
Extract loading screen images from Stellaris and convert them to web-friendly format.
Converts .dds files to .jpg for use on the website.
"""

import os
import sys
import subprocess
from pathlib import Path

def convert_loading_screens(stellaris_path, output_dir='output/loading_screens'):
    """
    Convert Stellaris loading screen .dds files to .jpg format.

    Args:
        stellaris_path: Path to Stellaris installation
        output_dir: Directory to save converted images
    """

    # Path to loading screens in Stellaris
    loadingscreens_dir = Path(stellaris_path) / 'gfx' / 'loadingscreens'

    if not loadingscreens_dir.exists():
        print(f"❌ Loading screens directory not found: {loadingscreens_dir}")
        return

    # Create output directory
    output_path = Path(__file__).parent / output_dir
    output_path.mkdir(parents=True, exist_ok=True)

    # Find all .dds files
    dds_files = sorted(loadingscreens_dir.glob('*.dds'))

    if not dds_files:
        print(f"❌ No .dds files found in {loadingscreens_dir}")
        return

    print(f"📁 Found {len(dds_files)} loading screen images")
    print(f"📤 Output directory: {output_path}")
    print()

    converted = 0
    failed = 0

    for dds_file in dds_files:
        # Output filename (same name but .jpg)
        output_file = output_path / f"{dds_file.stem}.jpg"

        try:
            # Use ImageMagick's convert to convert .dds to .jpg
            # -quality 90 gives good quality while reducing file size
            result = subprocess.run(
                ['convert', str(dds_file), '-quality', '90', str(output_file)],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 0:
                # Get file sizes
                original_size = dds_file.stat().st_size / (1024 * 1024)  # MB
                new_size = output_file.stat().st_size / (1024 * 1024)  # MB

                print(f"✅ {dds_file.name:<15} → {output_file.name:<15} ({original_size:.1f}M → {new_size:.1f}M)")
                converted += 1
            else:
                print(f"❌ Failed to convert {dds_file.name}: {result.stderr}")
                failed += 1

        except subprocess.TimeoutExpired:
            print(f"❌ Timeout converting {dds_file.name}")
            failed += 1
        except Exception as e:
            print(f"❌ Error converting {dds_file.name}: {e}")
            failed += 1

    print()
    print(f"✨ Conversion complete!")
    print(f"   Converted: {converted}")
    print(f"   Failed: {failed}")
    print()
    print(f"📂 Images saved to: {output_path.absolute()}")
    print()
    print("📋 Next steps:")
    print(f"   1. Review images in {output_path}")
    print(f"   2. Copy selected images to frontend/public/loading_screens/")
    print(f"   3. Use in website banner/hero section")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 extract_loading_screens.py <path_to_stellaris>")
        print("Example: python3 extract_loading_screens.py '/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris'")
        sys.exit(1)

    stellaris_path = sys.argv[1]

    if not os.path.exists(stellaris_path):
        print(f"❌ Stellaris path not found: {stellaris_path}")
        sys.exit(1)

    convert_loading_screens(stellaris_path)
