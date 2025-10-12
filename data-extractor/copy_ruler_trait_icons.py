#!/usr/bin/env python3
"""
Copy ruler trait icons from Stellaris to the frontend public directory
"""

import os
import shutil
import json
from pathlib import Path

# Paths
STELLARIS_ICONS_DIR = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris/gfx/interface/icons/traits/leader_trait_icons"
OUTPUT_DIR = "../frontend/public/icons/ruler_traits"
RULER_TRAITS_JSON = "../backend/data/ruler_traits.json"

# Icon mapping based on trait IDs
ICON_MAPPING = {
    "leader_trait_principled": "principled.dds",
    "leader_trait_fleet_organizer": "fleet_organizer.dds",
    "leader_trait_spycraft": "spycraft.dds",
    "leader_trait_spark_of_genius": "spark_of_genius.dds",
    "trait_ruler_industrialist": "industrialist.dds",
    "trait_ruler_warlike": "warlike.dds",
    "trait_ruler_charismatic": "charismatic.dds",
    "trait_ruler_feedback_loop": "charismatic.dds",  # fallback, will check for actual icon
    "trait_ruler_logistic_understanding": "logistic_understanding.dds",
    "trait_ruler_eye_for_talent": "eye_for_talent.dds",
}

def convert_dds_to_png(dds_path, png_path):
    """Convert DDS to PNG using ImageMagick convert command"""
    try:
        result = os.system(f'convert "{dds_path}" "{png_path}"')
        return result == 0
    except Exception as e:
        print(f"Error converting {dds_path}: {e}")
        return False

def main():
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Load ruler traits JSON
    with open(RULER_TRAITS_JSON, 'r', encoding='utf-8') as f:
        ruler_traits = json.load(f)

    print(f"Processing {len(ruler_traits)} ruler traits...")

    # Process each trait
    for trait in ruler_traits:
        trait_id = trait['id']

        if trait_id in ICON_MAPPING:
            dds_filename = ICON_MAPPING[trait_id]
            dds_path = os.path.join(STELLARIS_ICONS_DIR, dds_filename)

            if os.path.exists(dds_path):
                # Output as PNG
                png_filename = f"{trait_id}.png"
                png_path = os.path.join(OUTPUT_DIR, png_filename)

                print(f"Converting {trait_id}: {dds_filename} -> {png_filename}")

                if convert_dds_to_png(dds_path, png_path):
                    # Add icon path to trait data
                    trait['icon'] = f"/icons/ruler_traits/{png_filename}"
                    print(f"  ✓ Converted successfully")
                else:
                    print(f"  ✗ Conversion failed, copying DDS file instead")
                    # Fallback: copy DDS file
                    dds_output = os.path.join(OUTPUT_DIR, f"{trait_id}.dds")
                    shutil.copy2(dds_path, dds_output)
                    trait['icon'] = f"/icons/ruler_traits/{trait_id}.dds"
            else:
                print(f"⚠ Icon not found for {trait_id}: {dds_path}")
                trait['icon'] = None
        else:
            print(f"⚠ No icon mapping for {trait_id}")
            trait['icon'] = None

    # Save updated JSON
    output_json_path = os.path.join(OUTPUT_DIR, "ruler_traits_with_icons.json")
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(ruler_traits, f, indent=2, ensure_ascii=False)

    # Also update the backend JSON
    with open(RULER_TRAITS_JSON, 'w', encoding='utf-8') as f:
        json.dump(ruler_traits, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Updated ruler traits JSON with icon paths")
    print(f"  Backend: {RULER_TRAITS_JSON}")
    print(f"  Frontend copy: {output_json_path}")

if __name__ == "__main__":
    main()
