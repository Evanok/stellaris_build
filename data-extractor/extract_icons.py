#!/usr/bin/env python3
"""
Stellaris Icon Extractor
Extracts and converts game icons from DDS to PNG format
"""

import os
import sys
import json
import shutil
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

def copy_and_resize_icons(source_dir, dest_dir, target_size=32):
    """
    Copy all PNG icons from source_dir to dest_dir and resize them

    Args:
        source_dir: Source directory with PNG files
        dest_dir: Destination directory for resized files
        target_size: Target size in pixels (square image)

    Returns:
        Tuple of (copied_count, error_count)
    """
    ensure_dir(dest_dir)
    copied = 0
    errors = 0

    source_path = Path(source_dir)
    dest_path = Path(dest_dir)

    if not source_path.exists():
        print(f"⚠ Warning: Source directory {source_dir} does not exist")
        return 0, 0

    for png_file in source_path.glob("*.png"):
        try:
            output_file = dest_path / png_file.name

            # Use PIL to resize
            from PIL import Image as PILImage
            with PILImage.open(png_file) as img:
                resized = img.resize((target_size, target_size), PILImage.LANCZOS)
                resized.save(output_file, 'PNG', optimize=True)

            copied += 1
        except Exception as e:
            print(f"  ⚠ Error copying/resizing {png_file.name}: {e}")
            errors += 1

    return copied, errors

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
        'origin_original': 'gfx/event_pictures/origins',  # Large origin illustrations (256x256)
        'traits': 'gfx/interface/icons/traits',
        'ethics': 'gfx/interface/icons/ethics',
        'authorities': 'gfx/interface/icons/governments/authorities',
        'ascension_perks': 'gfx/interface/icons/ascension_perks',
        'traditions': 'gfx/interface/icons/traditions',
        'tradition_trees': 'gfx/interface/icons/traditions/tree_icons',
    }

    # Mapping for items that share the same icon file (DLC variants, etc.)
    # Maps item_id -> actual_dds_filename (without .dds extension)
    icon_mappings = {
        'ascension_perks': {
            # Galactic Wonders DLC variants all use the same base icon
            'ap_galactic_wonders_utopia': 'ap_galactic_wonders',
            'ap_galactic_wonders_megacorp': 'ap_galactic_wonders',
            'ap_galactic_wonders_utopia_and_megacorp': 'ap_galactic_wonders',
            # Colossus Project uses different filename
            'ap_colossus': 'ap_colossus_project',
            # Machine Assimilator variant uses base organo-machine icon
            'ap_organo_machine_interfacing_assimilator': 'ap_organo_machine_interfacing',
        },
        'tradition_trees': {
            # Gestalt/special variants that share icons with base traditions
            'tr_logistics': 'tradition_icon_mercantile',  # Gestalt variant of Mercantile
            'tr_cybernetics_assimilator': 'tradition_icon_cybernetics',  # Assimilator variant
            'tr_psionics_shroud': 'tradition_icon_psionics',  # Shroud variant
        },
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

    print(f"\n📁 Extracting {icon_type} icons (→ {target_size}x{target_size}px)...")
    print(f"   Source: {source_dir}")
    print(f"   Output: {output_dir}")

    extracted = 0
    missing = 0

    for item_id in ids_list:
        # Check if there's a custom mapping for this item
        mappings = icon_mappings.get(icon_type, {})
        if item_id in mappings:
            dds_filename = f"{mappings[item_id]}.dds"
        else:
            # DDS filename is typically the ID + .dds
            dds_filename = f"{item_id}.dds"

        dds_path = os.path.join(source_dir, dds_filename)

        # Special case: Origins use "origins_" (plural) prefix in file names
        if icon_type == 'origins' and not os.path.exists(dds_path):
            # Try with plural prefix: origin_xxx -> origins_xxx
            alt_filename = item_id.replace('origin_', 'origins_', 1) + '.dds'
            alt_path = os.path.join(source_dir, alt_filename)
            if os.path.exists(alt_path):
                dds_path = alt_path
                dds_filename = alt_filename

        # Output PNG filename (always use original item_id)
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
        target_size: Default target size (can be overridden per icon type)
    """
    print(f"🎨 Stellaris Icon Extractor")
    print(f"=" * 60)
    print(f"Output format: PNG (optimized sizes per icon type)")

    # Optimal sizes for each icon type (based on actual display size in frontend)
    # This reduces file size by ~75% for icons displayed at 32px
    optimal_sizes = {
        'traits': 32,           # Displayed at 32px in BuildForm
        'civics': 32,           # Displayed at 32px in BuildForm
        'ethics': 32,           # Displayed at 32px in BuildForm
        'ascension_perks': 32,  # Displayed at 32px in BuildForm
        'traditions': 32,       # Displayed at 32px in BuildForm
        'authorities': 32,      # Displayed at 32px in BuildForm
        'origin_original': 256, # Large origin illustrations (kept at high res)
        'origin_mini': 32,      # Small origins for home page list
    }

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
                stellaris_path, output_path, 'traits', trait_ids,
                optimal_sizes.get('traits', target_size)
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
                stellaris_path, output_path, 'civics', civic_ids,
                optimal_sizes.get('civics', target_size)
            )
            stats['total_extracted'] += extracted
            stats['total_missing'] += missing

    # Extract Origins (small icons)
    origins_file = os.path.join(data_path, 'civics_origins_only.json')
    if os.path.exists(origins_file):
        with open(origins_file, 'r', encoding='utf-8') as f:
            origins = json.load(f)
            # Use image_file field if available (from GFX mapping), fallback to ID
            origin_image_files = [o.get('image_file', o['id']) for o in origins]

            # Extract large origin illustrations (event pictures) at 256x256
            # These are the source of truth for all origin icons
            # Using image_file names to match actual DDS filenames in Stellaris
            extracted_large, missing_large = extract_icons_for_type(
                stellaris_path, output_path, 'origin_original', origin_image_files,
                optimal_sizes.get('origin_original', 256)
            )
            stats['total_extracted'] += extracted_large
            stats['total_missing'] += missing_large

            # Create copies with ID names for origins where image_file != id
            # This allows frontend to reference by ID while using correct source files
            print("  Creating ID-named copies for origins with different image_file...")
            origin_original_dir = os.path.join(output_path, 'origin_original')
            copy_count = 0
            for origin in origins:
                image_file = origin.get('image_file', origin['id'])
                origin_id = origin['id']
                if image_file != origin_id:
                    source_file = os.path.join(origin_original_dir, f"{image_file}.png")
                    dest_file = os.path.join(origin_original_dir, f"{origin_id}.png")
                    if os.path.exists(source_file) and not os.path.exists(dest_file):
                        import shutil
                        shutil.copy2(source_file, dest_file)
                        copy_count += 1
            if copy_count > 0:
                print(f"  ✓ Created {copy_count} ID-named copies")

            # Create smaller versions (32x32) for the home page list view
            # by copying and resizing from origin_original to origin_mini
            print("  Creating mini origin icons (32x32) from origin_original...")
            origin_mini_dir = os.path.join(output_path, 'origin_mini')
            copied, errors = copy_and_resize_icons(origin_original_dir, origin_mini_dir, target_size=32)
            print(f"  ✓ Created {copied} mini origin icons (32x32)")
            if errors > 0:
                print(f"  ⚠ {errors} errors creating mini icons")

    # Extract Ethics
    ethics_file = os.path.join(data_path, 'ethics.json')
    if os.path.exists(ethics_file):
        with open(ethics_file, 'r', encoding='utf-8') as f:
            ethics = json.load(f)
            ethic_ids = [e['id'] for e in ethics]
            extracted, missing = extract_icons_for_type(
                stellaris_path, output_path, 'ethics', ethic_ids,
                optimal_sizes.get('ethics', target_size)
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
                stellaris_path, output_path, 'authorities', auth_ids,
                optimal_sizes.get('authorities', target_size)
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
                stellaris_path, output_path, 'ascension_perks', perk_ids,
                optimal_sizes.get('ascension_perks', target_size)
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

                # Tradition tree icon mappings for variants that share the same icon
                tradition_mappings = {
                    'tr_logistics': 'tradition_icon_mercantile',  # Gestalt variant of Mercantile
                    'tr_cybernetics_assimilator': 'tradition_icon_cybernetics',  # Assimilator variant
                    'tr_psionics_shroud': 'tradition_icon_psionics',  # Shroud variant
                }

                extracted = 0
                missing = 0

                for tree_id in tree_ids:
                    # Check if there's a custom mapping for this tradition tree
                    mappings = tradition_mappings
                    if tree_id in mappings:
                        dds_filename = f"{mappings[tree_id]}.dds"
                    else:
                        # Icons use "tradition_icon_" prefix instead of "tr_"
                        # e.g., tr_expansion -> tradition_icon_expansion.dds
                        icon_name = tree_id.replace('tr_', '')
                        dds_filename = f"tradition_icon_{icon_name}.dds"

                    dds_path = os.path.join(source_dir, dds_filename)

                    # Save with tree_id as filename so frontend can find it
                    png_filename = f"{tree_id}.png"
                    png_path = os.path.join(output_dir, png_filename)

                    if os.path.exists(dds_path):
                        if convert_dds_to_png(dds_path, png_path, optimal_sizes.get('traditions', target_size)):
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
