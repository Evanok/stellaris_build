#!/usr/bin/env python3
"""
Stellaris Portrait Icons Extractor
Extracts and converts portrait textures from .dds to .png
"""

import os
import sys
import json
import subprocess
from pathlib import Path

def convert_dds_to_png(dds_path: str, png_path: str) -> bool:
    """
    Convert a .dds file to .png using ImageMagick

    Args:
        dds_path: Path to source .dds file
        png_path: Path to output .png file

    Returns:
        True if successful, False otherwise
    """
    try:
        # Use ImageMagick's convert command
        result = subprocess.run(
            ['convert', dds_path, '-resize', '128x128', png_path],
            capture_output=True,
            text=True,
            timeout=10
        )
        return result.returncode == 0
    except FileNotFoundError:
        print("ERROR: ImageMagick 'convert' command not found!")
        print("Install with: sudo apt-get install imagemagick")
        return False
    except subprocess.TimeoutExpired:
        print(f"  Timeout converting {os.path.basename(dds_path)}")
        return False
    except Exception as e:
        print(f"  Error converting {os.path.basename(dds_path)}: {e}")
        return False


def find_portrait_texture(stellaris_path: str, portrait_id: str, species_folder: str) -> str:
    """
    Find the main texture file for a portrait

    Args:
        stellaris_path: Path to Stellaris installation
        portrait_id: Portrait ID (e.g., 'mam1', 'rep2')
        species_folder: Species folder name (e.g., 'mammalian', 'reptilian')

    Returns:
        Path to the texture file, or None if not found
    """
    portraits_dir = os.path.join(stellaris_path, "gfx", "models", "portraits", species_folder)

    # Try to find the main color texture
    # Pattern: {species_folder}_{portrait_type}_{number}_{color_variant}.dds
    # Example: mammalian_slender_01_blue_orange.dds

    # Extract the portrait number from ID (e.g., 'mam1' -> '01', 'rep12' -> '12')
    import re
    match = re.search(r'(\d+)', portrait_id)
    if not match:
        return None

    portrait_num = match.group(1).zfill(2)  # Pad with zeros: 1 -> 01

    # Search for texture files matching this portrait
    search_patterns = [
        f"*_{portrait_num}_*.dds",  # Generic pattern
        f"*{portrait_num}*.dds",    # Broader pattern
    ]

    for pattern in search_patterns:
        import glob
        matches = glob.glob(os.path.join(portraits_dir, "**", pattern), recursive=True)

        # Filter to get the first color variant (skip outfit/attachment files)
        for match in matches:
            basename = os.path.basename(match)
            # Skip outfit, attachment, normal maps, etc.
            if any(skip in basename for skip in ['outfit', 'attachment', 'normal', 'properties', 'specular']):
                continue
            # Prefer files with "blue" or first color variant
            if 'blue' in basename or 'brown' in basename or 'orange' in basename:
                return match

        # If no color variant found, return first match
        if matches:
            for match in matches:
                basename = os.path.basename(match)
                if not any(skip in basename for skip in ['outfit', 'attachment', 'normal', 'properties', 'specular']):
                    return match

    return None


def extract_portrait_icons(stellaris_path: str, output_dir: str = "output/portrait_icons"):
    """
    Extract portrait icons for all species classes

    Args:
        stellaris_path: Path to Stellaris installation
        output_dir: Output directory for PNG files
    """
    # Load species classes data
    species_classes_file = "output/species_classes.json"
    if not os.path.exists(species_classes_file):
        print(f"ERROR: {species_classes_file} not found!")
        print("Run extract_species_classes.py first.")
        sys.exit(1)

    with open(species_classes_file, 'r', encoding='utf-8') as f:
        species_classes = json.load(f)

    # Mapping of species class IDs to their folder names
    species_folders = {
        'MAM': 'mammalian',
        'REP': 'reptilian',
        'AVI': 'avian',
        'ART': 'arthropoid',
        'MOL': 'molluscoid',
        'FUN': 'fungoid',
        'PLANT': 'plantoid',
        'IMPERIAL': 'human',
        'LITHOID': 'lithoid',
        'NECROID': 'necroid',
        'AQUATIC': 'aquatic',
        'TOX': 'toxoid',
    }

    # Create output directory
    os.makedirs(output_dir, exist_ok=True)

    total_portraits = 0
    converted_portraits = 0

    print("Extracting portrait icons...")
    print()

    for species_class in species_classes:
        class_id = species_class['id']
        class_name = species_class['name']
        portraits = species_class['portraits']

        if class_id not in species_folders:
            print(f"Skipping {class_name} - no folder mapping")
            continue

        species_folder = species_folders[class_id]
        print(f"Processing {class_name} ({len(portraits)} portraits)...")

        class_output_dir = os.path.join(output_dir, class_id.lower())
        os.makedirs(class_output_dir, exist_ok=True)

        for portrait_id in portraits:
            total_portraits += 1

            # Find the texture file
            texture_path = find_portrait_texture(stellaris_path, portrait_id, species_folder)

            if not texture_path:
                print(f"  ⚠️  {portrait_id}: texture not found")
                continue

            # Convert to PNG
            png_path = os.path.join(class_output_dir, f"{portrait_id}.png")

            if convert_dds_to_png(texture_path, png_path):
                converted_portraits += 1
                print(f"  ✓ {portrait_id}: {os.path.basename(texture_path)}")
            else:
                print(f"  ✗ {portrait_id}: conversion failed")

        print()

    print(f"Conversion complete!")
    print(f"Total portraits: {total_portraits}")
    print(f"Successfully converted: {converted_portraits}")
    print(f"Failed: {total_portraits - converted_portraits}")
    print(f"Output directory: {output_dir}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    extract_portrait_icons(stellaris_path)
