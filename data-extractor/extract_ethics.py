#!/usr/bin/env python3
"""
Stellaris Ethics Extractor
Extracts ethics from Stellaris game files and outputs to JSON
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
from paradox_parser import parse_stellaris_file


def extract_modifier_effects(modifier_data: Any) -> str:
    """
    Extract and format modifier effects into readable text

    Args:
        modifier_data: The modifier object

    Returns:
        Formatted string describing the effects
    """
    if not modifier_data or not isinstance(modifier_data, dict):
        return ""

    effects = []
    for key, value in modifier_data.items():
        if isinstance(value, (int, float)):
            # Format percentage modifiers
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


def extract_ethic_data(ethic_key: str, ethic_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extract relevant data from a single ethic

    Args:
        ethic_key: The ethic identifier
        ethic_data: Raw ethic data from parser

    Returns:
        Cleaned ethic data dictionary
    """
    ethic = {
        "id": ethic_key,
        "name": ethic_key,
        "cost": ethic_data.get("cost", 0),
        "category": ethic_data.get("category", "unknown"),
        "category_value": ethic_data.get("category_value", 0),
        "use_for_pops": ethic_data.get("use_for_pops", True)
    }

    # Extract fanatic/regular variants
    ethic["fanatic_variant"] = ethic_data.get("fanatic_variant", "")
    ethic["regular_variant"] = ethic_data.get("regular_variant", "")

    # Extract tags
    tags = ethic_data.get("tags", {})
    if isinstance(tags, dict):
        ethic["tags"] = list(tags.keys()) if tags else []
    elif isinstance(tags, list):
        ethic["tags"] = tags
    else:
        ethic["tags"] = []

    # Extract modifier effects
    country_modifier = ethic_data.get("country_modifier", {})
    ethic["effects"] = extract_modifier_effects(country_modifier)
    ethic["modifier"] = country_modifier

    # Extract random weight
    random_weight = ethic_data.get("random_weight", {})
    if isinstance(random_weight, dict) and "base" in random_weight:
        ethic["random_weight"] = random_weight["base"]
    else:
        ethic["random_weight"] = 0

    return ethic


def extract_ethics_from_file(filepath: str) -> List[Dict[str, Any]]:
    """
    Extract all ethics from a single file

    Args:
        filepath: Path to the ethics file

    Returns:
        List of ethic dictionaries
    """
    print(f"Processing: {os.path.basename(filepath)}")

    try:
        data = parse_stellaris_file(filepath)
        ethics = []

        for key, value in data.items():
            if isinstance(value, dict) and key.startswith('ethic_'):
                ethic = extract_ethic_data(key, value)
                ethics.append(ethic)

        print(f"  Found {len(ethics)} ethics")
        return ethics

    except Exception as e:
        print(f"  Error processing file: {e}")
        import traceback
        traceback.print_exc()
        return []


def extract_all_ethics(stellaris_path: str, output_file: str = "output/ethics.json"):
    """
    Extract all ethics from Stellaris installation

    Args:
        stellaris_path: Path to Stellaris installation directory
        output_file: Output JSON file path
    """
    ethics_dir = os.path.join(stellaris_path, "common", "ethics")

    if not os.path.exists(ethics_dir):
        print(f"Error: Ethics directory not found at {ethics_dir}")
        sys.exit(1)

    all_ethics = []

    # Files to process
    ethics_files = [
        "00_ethics.txt"
    ]

    for filename in ethics_files:
        filepath = os.path.join(ethics_dir, filename)
        if os.path.exists(filepath):
            ethics = extract_ethics_from_file(filepath)
            all_ethics.extend(ethics)

    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write to JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_ethics, f, indent=2, ensure_ascii=False)

    print(f"\nTotal ethics extracted: {len(all_ethics)}")
    print(f"Output saved to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    extract_all_ethics(stellaris_path)
