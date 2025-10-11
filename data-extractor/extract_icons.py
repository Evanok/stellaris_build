#!/usr/bin/env python3
"""
Stellaris Icon Extractor
Extracts and converts game icons from DDS to PNG format
"""

import os
import sys
import json
from pathlib import Path
try:
    from wand.image import Image as WandImage
    USE_WAND = True
except ImportError:
    from PIL import Image
    USE_WAND = False
    print("⚠ Warning: Wand not available, falling back to PIL (may have transparency issues)")

def ensure_dir(directory):
    """Create directory if it doesn't exist"""
    Path(directory).mkdir(parents=True, exist_ok=True)

def convert_dds_to_png(dds_path, png_path, target_size=64):
    """
    Convert a DDS file to PNG with optional resizing

    Args:
        dds_path: Path to source DDS file
        png_path: Path to output PNG file
        target_size: Target size in pixels (square image)
    """
    try:
        if USE_WAND:
            # Use Wand (ImageMagick) for better DDS support
            with WandImage(filename=dds_path) as img:
                # Ensure RGBA format
                img.alpha_channel = 'activate'

                # Resize if needed
                if target_size and (img.width != target_size or img.height != target_size):
                    img.resize(target_size, target_size, filter='lanczos')

                # Set PNG format and save
                img.format = 'png'
                img.save(filename=png_path)
            return True
        else:
            # Fallback to PIL
            from PIL import Image
            with Image.open(dds_path) as img:
                # Convert to RGBA if not already
                if img.mode != 'RGBA':
                    img = img.convert('RGBA')

                # Resize if needed (high quality)
                if target_size and img.size != (target_size, target_size):
                    # Use LANCZOS (old: Image.ANTIALIAS for older Pillow versions)
                    try:
                        img = img.resize((target_size, target_size), Image.Resampling.LANCZOS)
                    except AttributeError:
                        img = img.resize((target_size, target_size), Image.LANCZOS)

                # Save as PNG
                img.save(png_path, 'PNG', optimize=True)
            return True
    except Exception as e:
        print(f"  ✗ Error converting {os.path.basename(dds_path)}: {e}")
        return False

def extract_icons_for_type(stellaris_path, output_path, icon_type, ids_list, target_size=64):
    """
    Extract icons for a specific game element type

    Args:
        stellaris_path: Path to Stellaris installation
        output_path: Path to output directory (frontend/public/icons/)
        icon_type: Type of icon ('civics', 'traits', 'ethics', etc.)
        ids_list: List of IDs to extract icons for
        target_size: Target size for output images
    """
    # Map icon types to their source directories
    source_dirs = {
        'civics': 'gfx/interface/icons/governments/civics',
        'origins': 'gfx/interface/icons/origins',
        'traits': 'gfx/interface/icons/traits',
        'ethics': 'gfx/interface/icons/ethics',
        'authorities': 'gfx/interface/icons/governments',
        'ascension_perks': 'gfx/interface/icons/ascension_perks',
        'traditions': 'gfx/interface/icons/traditions',
        'tradition_trees': 'gfx/interface/icons/traditions/tree_icons',
    }

    if icon_type not in source_dirs:
        print(f"Unknown icon type: {icon_type}")
        return

    source_dir = os.path.join(stellaris_path, source_dirs[icon_type])
    output_dir = os.path.join(output_path, icon_type)

    if not os.path.exists(source_dir):
        print(f"Source directory not found: {source_dir}")
        return

    ensure_dir(output_dir)

    print(f"\n📁 Extracting {icon_type} icons...")
    print(f"   Source: {source_dir}")
    print(f"   Output: {output_dir}")

    extracted = 0
    missing = 0

    for item_id in ids_list:
        # DDS filename is typically the ID + .dds
        dds_filename = f"{item_id}.dds"
        dds_path = os.path.join(source_dir, dds_filename)

        # Output PNG filename
        png_filename = f"{item_id}.png"
        png_path = os.path.join(output_dir, png_filename)

        if os.path.exists(dds_path):
            if convert_dds_to_png(dds_path, png_path, target_size):
                extracted += 1
        else:
            missing += 1
            print(f"  ⚠ Missing icon: {dds_filename}")

    print(f"   ✓ Extracted: {extracted}")
    if missing > 0:
        print(f"   ⚠ Missing: {missing}")

    return extracted, missing

def extract_all_icons(stellaris_path, data_path, output_path, target_size=64):
    """
    Extract all icons from Stellaris installation

    Args:
        stellaris_path: Path to Stellaris installation
        data_path: Path to extracted JSON data (data-extractor/output/)
        output_path: Path to frontend public icons directory
        target_size: Target size for output images (default 64x64)
    """
    print(f"🎨 Stellaris Icon Extractor")
    print(f"=" * 60)
    print(f"Target size: {target_size}x{target_size} pixels")
    print(f"Output format: PNG")

    stats = {
        'total_extracted': 0,
        'total_missing': 0
    }

    # Extract Traits
    traits_file = os.path.join(data_path, 'traits.json')
    if os.path.exists(traits_file):
        with open(traits_file, 'r', encoding='utf-8') as f:
            traits = json.load(f)
            trait_ids = [t['id'] for t in traits]
            extracted, missing = extract_icons_for_type(
                stellaris_path, output_path, 'traits', trait_ids, target_size
            )
            stats['total_extracted'] += extracted
            stats['total_missing'] += missing

    # Extract Civics
    civics_file = os.path.join(data_path, 'civics_civics_only.json')
    if os.path.exists(civics_file):
        with open(civics_file, 'r', encoding='utf-8') as f:
            civics = json.load(f)
            civic_ids = [c['id'] for c in civics]
            extracted, missing = extract_icons_for_type(
                stellaris_path, output_path, 'civics', civic_ids, target_size
            )
            stats['total_extracted'] += extracted
            stats['total_missing'] += missing

    # Extract Origins
    origins_file = os.path.join(data_path, 'civics_origins_only.json')
    if os.path.exists(origins_file):
        with open(origins_file, 'r', encoding='utf-8') as f:
            origins = json.load(f)
            origin_ids = [o['id'] for o in origins]
            extracted, missing = extract_icons_for_type(
                stellaris_path, output_path, 'origins', origin_ids, target_size
            )
            stats['total_extracted'] += extracted
            stats['total_missing'] += missing

    # Extract Ethics
    ethics_file = os.path.join(data_path, 'ethics.json')
    if os.path.exists(ethics_file):
        with open(ethics_file, 'r', encoding='utf-8') as f:
            ethics = json.load(f)
            ethic_ids = [e['id'] for e in ethics]
            extracted, missing = extract_icons_for_type(
                stellaris_path, output_path, 'ethics', ethic_ids, target_size
            )
            stats['total_extracted'] += extracted
            stats['total_missing'] += missing

    # Extract Authorities
    authorities_file = os.path.join(data_path, 'authorities.json')
    if os.path.exists(authorities_file):
        with open(authorities_file, 'r', encoding='utf-8') as f:
            authorities = json.load(f)
            auth_ids = [a['id'] for a in authorities]
            extracted, missing = extract_icons_for_type(
                stellaris_path, output_path, 'authorities', auth_ids, target_size
            )
            stats['total_extracted'] += extracted
            stats['total_missing'] += missing

    # Extract Ascension Perks
    perks_file = os.path.join(data_path, 'ascension_perks.json')
    if os.path.exists(perks_file):
        with open(perks_file, 'r', encoding='utf-8') as f:
            perks_data = json.load(f)
            # Handle both array and object format
            perks = perks_data.get('all', perks_data) if isinstance(perks_data, dict) else perks_data
            perk_ids = [p['id'] for p in perks]
            extracted, missing = extract_icons_for_type(
                stellaris_path, output_path, 'ascension_perks', perk_ids, target_size
            )
            stats['total_extracted'] += extracted
            stats['total_missing'] += missing

    # Extract Tradition Trees (use tree key, not adopt ID)
    traditions_file = os.path.join(data_path, 'traditions_by_tree.json')
    if os.path.exists(traditions_file):
        with open(traditions_file, 'r', encoding='utf-8') as f:
            traditions = json.load(f)
            # Get tree keys that start with "tr_" (these have the icons)
            tree_ids = [key for key in traditions.keys() if key.startswith('tr_')]

            # Extract from tree_icons directory
            source_dir = os.path.join(stellaris_path, 'gfx/interface/icons/traditions/tree_icons')
            output_dir = os.path.join(output_path, 'traditions')

            if os.path.exists(source_dir):
                ensure_dir(output_dir)
                print(f"\n📁 Extracting traditions icons...")
                print(f"   Source: {source_dir}")
                print(f"   Output: {output_dir}")

                extracted = 0
                missing = 0

                for tree_id in tree_ids:
                    # Icons use "tradition_icon_" prefix instead of "tr_"
                    # e.g., tr_expansion -> tradition_icon_expansion.dds
                    icon_name = tree_id.replace('tr_', '')
                    dds_filename = f"tradition_icon_{icon_name}.dds"
                    dds_path = os.path.join(source_dir, dds_filename)

                    # Save with tree_id as filename so frontend can find it
                    png_filename = f"{tree_id}.png"
                    png_path = os.path.join(output_dir, png_filename)

                    if os.path.exists(dds_path):
                        if convert_dds_to_png(dds_path, png_path, target_size):
                            extracted += 1
                    else:
                        missing += 1
                        print(f"  ⚠ Missing icon: {dds_filename}")

                print(f"   ✓ Extracted: {extracted}")
                if missing > 0:
                    print(f"   ⚠ Missing: {missing}")

                stats['total_extracted'] += extracted
                stats['total_missing'] += missing

    print(f"\n" + "=" * 60)
    print(f"🎉 Extraction complete!")
    print(f"   Total extracted: {stats['total_extracted']}")
    print(f"   Total missing: {stats['total_missing']}")
    print(f"\n📂 Icons saved to: {output_path}")

    return stats

if __name__ == "__main__":
    # Parse command line arguments
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, 'output')
    output_path = os.path.join(script_dir, '..', 'frontend', 'public', 'icons')

    # Target size (can be changed via argument)
    target_size = int(sys.argv[2]) if len(sys.argv) > 2 else 64

    # Extract icons
    extract_all_icons(stellaris_path, data_path, output_path, target_size)
