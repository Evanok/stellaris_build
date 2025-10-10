#!/usr/bin/env python3
"""
Stellaris Traditions Extractor
Extracts tradition trees and individual traditions from Stellaris game files
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
from paradox_parser import parse_stellaris_file


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


def extract_tradition_data(tradition_key: str, tradition_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract relevant data from a single tradition"""
    tradition = {
        "id": tradition_key,
        "name": tradition_key,
        "custom_tooltip": tradition_data.get("custom_tooltip", "")
    }

    # Determine type (adopt, finish, or regular)
    if tradition_key.endswith('_adopt'):
        tradition["type"] = "adopt"
        tradition["tree"] = tradition_key.replace('_adopt', '')
    elif tradition_key.endswith('_finish'):
        tradition["type"] = "finish"
        tradition["tree"] = tradition_key.replace('_finish', '')
    else:
        tradition["type"] = "tradition"
        # Extract tree name (tr_discovery_something -> discovery)
        parts = tradition_key.split('_')
        if len(parts) >= 2:
            tradition["tree"] = parts[1]
        else:
            tradition["tree"] = "unknown"

    # Extract modifier effects
    modifier = tradition_data.get("modifier", {})
    tradition["effects"] = extract_modifier_effects(modifier)
    tradition["modifier"] = modifier

    # Extract possible conditions
    possible = tradition_data.get("possible", {})
    tradition["possible"] = possible

    # Extract AI weight
    ai_weight = tradition_data.get("ai_weight", {})
    if isinstance(ai_weight, dict) and "factor" in ai_weight:
        tradition["ai_weight"] = ai_weight["factor"]
    else:
        tradition["ai_weight"] = 1

    # Check for tradition_swap (different effects for different empire types)
    if "tradition_swap" in tradition_data:
        tradition["has_variants"] = True
    else:
        tradition["has_variants"] = False

    return tradition


def extract_traditions_from_file(filepath: str) -> List[Dict[str, Any]]:
    """Extract all traditions from a single file"""
    print(f"Processing: {os.path.basename(filepath)}")

    try:
        data = parse_stellaris_file(filepath)
        traditions = []

        for key, value in data.items():
            if isinstance(value, dict) and key.startswith('tr_'):
                tradition = extract_tradition_data(key, value)
                traditions.append(tradition)

        print(f"  Found {len(traditions)} traditions")
        return traditions

    except Exception as e:
        print(f"  Error processing file: {e}")
        import traceback
        traceback.print_exc()
        return []


def extract_all_traditions(stellaris_path: str, output_file: str = "output/traditions.json"):
    """Extract all traditions from Stellaris installation"""
    traditions_dir = os.path.join(stellaris_path, "common", "traditions")

    if not os.path.exists(traditions_dir):
        print(f"Error: Traditions directory not found at {traditions_dir}")
        sys.exit(1)

    all_traditions = []

    # Get all tradition files (exclude README)
    tradition_files = [f for f in os.listdir(traditions_dir)
                      if f.endswith('.txt') and 'README' not in f.upper()]

    for filename in sorted(tradition_files):
        filepath = os.path.join(traditions_dir, filename)
        if os.path.exists(filepath):
            traditions = extract_traditions_from_file(filepath)
            all_traditions.extend(traditions)

    # Organize by tree
    trees = {}
    for trad in all_traditions:
        tree_name = trad.get("tree", "unknown")
        if tree_name not in trees:
            trees[tree_name] = {
                "name": tree_name,
                "adopt": None,
                "finish": None,
                "traditions": []
            }

        if trad["type"] == "adopt":
            trees[tree_name]["adopt"] = trad
        elif trad["type"] == "finish":
            trees[tree_name]["finish"] = trad
        else:
            trees[tree_name]["traditions"].append(trad)

    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write full list to JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_traditions, f, indent=2, ensure_ascii=False)

    # Also write organized by tree
    trees_output = output_file.replace('.json', '_by_tree.json')
    with open(trees_output, 'w', encoding='utf-8') as f:
        json.dump(trees, f, indent=2, ensure_ascii=False)

    print(f"\nTotal traditions extracted: {len(all_traditions)}")
    print(f"Total tradition trees: {len(trees)}")
    print(f"Output saved to: {output_file}")
    print(f"  - By tree: {trees_output}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    extract_all_traditions(stellaris_path)
