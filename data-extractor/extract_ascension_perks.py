#!/usr/bin/env python3
"""
Stellaris Ascension Perks Extractor
Extracts ascension perks from Stellaris game files
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
from paradox_parser import parse_stellaris_file
from localization_parser import load_all_localizations, get_localized_text, clean_localized_text


def extract_modifier_effects(modifier_data: Any) -> str:
    """Extract and format modifier effects into readable text"""
    if not modifier_data or not isinstance(modifier_data, dict):
        return ""

    effects = []
    for key, value in modifier_data.items():
        if isinstance(value, (int, float)):
            if '_mult' in key or 'speed' in key or '_add' in key:
                if abs(value) < 1 and value != 0:
                    percentage = value * 100
                    sign = '+' if percentage > 0 else ''
                    effects.append(f"{key}: {sign}{percentage}%")
                else:
                    sign = '+' if value > 0 else ''
                    effects.append(f"{key}: {sign}{value}")
            else:
                sign = '+' if value > 0 else ''
                effects.append(f"{key}: {sign}{value}")

    return "; ".join(effects)


def extract_perk_data(perk_key: str, perk_data: Dict[str, Any], localizations: Dict[str, str] = None) -> Dict[str, Any]:
    """Extract relevant data from a single ascension perk"""
    if localizations is None:
        localizations = {}

    # Get localized name and description
    name = get_localized_text(perk_key, localizations)
    desc_key = f"{perk_key}_desc"
    description_raw = get_localized_text(desc_key, localizations)

    # If description contains dynamic function calls like [GetMindOverMatterDesc], try fallback variants
    if description_raw and (description_raw.startswith('[Get') or description_raw == desc_key):
        # Try organic/machine/hive variants
        for variant in ['_organic', '_machine', '_hive']:
            variant_key = f"{perk_key}_desc{variant}"
            variant_desc = get_localized_text(variant_key, localizations)
            # Accept variant if it's a real description (not starting with a dynamic function)
            if variant_desc and variant_desc != variant_key and not variant_desc.startswith('[Get'):
                description_raw = variant_desc
                break

    perk = {
        "id": perk_key,
        "name": name,
        "description": clean_localized_text(description_raw) if description_raw != desc_key else "",
        "custom_tooltip": perk_data.get("custom_tooltip", "")
    }

    # Determine category/type
    if perk_key.startswith('ap_'):
        perk["type"] = "ascension_perk"
    else:
        perk["type"] = "unknown"

    # Extract possible conditions
    possible = perk_data.get("possible", {})
    perk["possible"] = possible

    # Try to extract prerequisite count
    perk["prerequisites"] = []
    if isinstance(possible, dict):
        # Look for num_ascension_perks requirement
        custom_tooltip = possible.get("custom_tooltip", {})
        if isinstance(custom_tooltip, dict):
            fail_text = custom_tooltip.get("fail_text", "")
            if "requires_ascension_perks" in str(fail_text):
                # Try to extract number
                import re
                match = re.search(r'requires_ascension_perks_(\d+)', str(fail_text))
                if match:
                    perk["min_perks_required"] = int(match.group(1))

    # Extract modifier effects
    modifier = perk_data.get("modifier", {})
    perk["effects"] = extract_modifier_effects(modifier)
    perk["modifier"] = modifier

    # Check if it's a path perk (Genetic, Psionic, Synthetic, etc.)
    path_keywords = ['genetic', 'psionic', 'synthetic', 'cybernetic', 'biological']
    perk["is_path_perk"] = any(keyword in perk_key.lower() for keyword in path_keywords)

    # Check for tradition_swap (different effects for different empire types)
    if "tradition_swap" in perk_data:
        perk["has_variants"] = True
    else:
        perk["has_variants"] = False

    # Extract potential
    potential = perk_data.get("potential", {})
    perk["potential"] = potential

    # Extract AI weight
    ai_weight = perk_data.get("ai_weight", {})
    if isinstance(ai_weight, dict) and "factor" in ai_weight:
        perk["ai_weight"] = ai_weight["factor"]
    else:
        perk["ai_weight"] = 1

    return perk


def extract_perks_from_file(filepath: str, localizations: Dict[str, str] = None) -> List[Dict[str, Any]]:
    """Extract all ascension perks from a single file"""
    print(f"Processing: {os.path.basename(filepath)}")

    # Ascension paths file contains path perks that should always be included
    is_paths_file = '00_ascension_paths.txt' in filepath

    try:
        data = parse_stellaris_file(filepath)
        perks = []

        for key, value in data.items():
            if isinstance(value, dict) and key.startswith('ap_'):
                # For ascension paths (transcendence, evolutionary_mastery, etc.),
                # ignore the potential check as they're core game features
                if not is_paths_file:
                    # Check if perk is actually available (potential != { always = no })
                    potential = value.get("potential", {})
                    # Parser converts 'no' to False
                    if isinstance(potential, dict) and potential.get("always") == False:
                        print(f"  Skipping {key} (potential = always no)")
                        continue

                perk = extract_perk_data(key, value, localizations)
                perks.append(perk)

        print(f"  Found {len(perks)} ascension perks")
        return perks

    except Exception as e:
        print(f"  Error processing file: {e}")
        import traceback
        traceback.print_exc()
        return []


def extract_all_ascension_perks(stellaris_path: str, output_file: str = "output/ascension_perks.json"):
    """Extract all ascension perks from Stellaris installation"""
    perks_dir = os.path.join(stellaris_path, "common", "ascension_perks")

    if not os.path.exists(perks_dir):
        print(f"Error: Ascension perks directory not found at {perks_dir}")
        sys.exit(1)

    # Load localizations
    print("Loading localizations...")
    localizations = load_all_localizations(stellaris_path)

    all_perks = []

    # Files to process
    perk_files = [
        "00_ascension_paths.txt",
        "00_ascension_perks.txt"
    ]

    for filename in perk_files:
        filepath = os.path.join(perks_dir, filename)
        if os.path.exists(filepath):
            perks = extract_perks_from_file(filepath, localizations)
            all_perks.extend(perks)

    # Separate path perks from regular perks
    path_perks = [p for p in all_perks if p.get("is_path_perk")]
    regular_perks = [p for p in all_perks if not p.get("is_path_perk")]

    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write all to one file
    output_data = {
        "all": all_perks,
        "path_perks": path_perks,
        "regular_perks": regular_perks
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"\nTotal ascension perks extracted: {len(all_perks)}")
    print(f"  - Path perks: {len(path_perks)}")
    print(f"  - Regular perks: {len(regular_perks)}")
    print(f"Output saved to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    extract_all_ascension_perks(stellaris_path)
