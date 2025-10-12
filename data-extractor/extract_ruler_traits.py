#!/usr/bin/env python3
"""
Stellaris Starting Ruler Traits Extractor
Extracts starting ruler traits from Stellaris game files and outputs to JSON
"""

import json
import os
import sys
from pathlib import Path
from typing import Dict, List, Any
from paradox_parser import parse_stellaris_file
from localization_parser import load_all_localizations, get_localized_text, clean_localized_text


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
                if abs(value) < 1 and value != 0 and '_add' not in key:
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


def extract_ruler_trait_data(trait_key: str, trait_data: Dict[str, Any], localizations: Dict[str, str] = None) -> Dict[str, Any]:
    """
    Extract relevant data from a single ruler trait

    Args:
        trait_key: The trait identifier
        trait_data: Raw trait data from parser
        localizations: Optional dictionary of localization strings

    Returns:
        Cleaned ruler trait data dictionary
    """
    if localizations is None:
        localizations = {}

    # Get localized name and description
    name = get_localized_text(trait_key, localizations)
    desc_key = f"{trait_key}_desc"
    description_raw = get_localized_text(desc_key, localizations)

    trait = {
        "id": trait_key,
        "name": name,
        "description": clean_localized_text(description_raw) if description_raw != desc_key else "",
        "cost": trait_data.get("cost", 1),
        "starting_ruler_trait": trait_data.get("starting_ruler_trait", False),
    }

    # Extract leader class
    leader_class = trait_data.get("leader_class", {})
    if isinstance(leader_class, dict):
        trait["leader_class"] = list(leader_class.values()) if leader_class else []
    elif isinstance(leader_class, list):
        trait["leader_class"] = leader_class
    else:
        trait["leader_class"] = []

    # Extract councilor modifier (most starting ruler traits use this)
    councilor_modifier = trait_data.get("councilor_modifier", {})
    trait["effects"] = extract_modifier_effects(councilor_modifier)
    trait["councilor_modifier"] = councilor_modifier

    # Extract self modifier (some traits use this)
    self_modifier = trait_data.get("self_modifier", {})
    if self_modifier:
        self_effects = extract_modifier_effects(self_modifier)
        if self_effects:
            if trait["effects"]:
                trait["effects"] += "; " + self_effects
            else:
                trait["effects"] = self_effects
        trait["self_modifier"] = self_modifier

    # Extract forbidden origins
    forbidden_origins = trait_data.get("forbidden_origins", {})
    if isinstance(forbidden_origins, dict):
        trait["forbidden_origins"] = list(forbidden_origins.values()) if forbidden_origins else []
    elif isinstance(forbidden_origins, list):
        trait["forbidden_origins"] = forbidden_origins
    else:
        trait["forbidden_origins"] = []

    # Extract allowed ethics (for gestalt-only traits)
    allowed_ethics = trait_data.get("allowed_ethics", {})
    if isinstance(allowed_ethics, dict):
        trait["allowed_ethics"] = list(allowed_ethics.values()) if allowed_ethics else []
    elif isinstance(allowed_ethics, list):
        trait["allowed_ethics"] = allowed_ethics
    else:
        trait["allowed_ethics"] = []

    # Extract opposites
    opposites = trait_data.get("opposites", {})
    if isinstance(opposites, dict):
        trait["opposites"] = list(opposites.values()) if opposites else []
    elif isinstance(opposites, list):
        trait["opposites"] = opposites
    else:
        trait["opposites"] = []

    return trait


def extract_ruler_traits_from_file(filepath: str, localizations: Dict[str, str] = None) -> List[Dict[str, Any]]:
    """
    Extract all starting ruler traits from a file

    Args:
        filepath: Path to the traits file
        localizations: Optional dictionary of localization strings

    Returns:
        List of ruler trait dictionaries
    """
    print(f"Processing: {os.path.basename(filepath)}")

    try:
        data = parse_stellaris_file(filepath)
        traits = []

        for key, value in data.items():
            if isinstance(value, dict) and not key.startswith('_'):
                # Only extract starting ruler traits (tier 1)
                if value.get("starting_ruler_trait", False):
                    trait = extract_ruler_trait_data(key, value, localizations)
                    traits.append(trait)

        print(f"  Found {len(traits)} starting ruler traits")
        return traits

    except Exception as e:
        print(f"  Error processing file: {e}")
        import traceback
        traceback.print_exc()
        return []


def extract_all_ruler_traits(stellaris_path: str, output_file: str = "output/ruler_traits.json"):
    """
    Extract all starting ruler traits from Stellaris installation

    Args:
        stellaris_path: Path to Stellaris installation directory
        output_file: Output JSON file path
    """
    traits_dir = os.path.join(stellaris_path, "common", "traits")

    if not os.path.exists(traits_dir):
        print(f"Error: Traits directory not found at {traits_dir}")
        sys.exit(1)

    # Load localizations
    print("Loading localizations...")
    localizations = load_all_localizations(stellaris_path)

    all_traits = []

    # Only process the starting ruler traits file
    filepath = os.path.join(traits_dir, "00_starting_ruler_traits.txt")
    if os.path.exists(filepath):
        traits = extract_ruler_traits_from_file(filepath, localizations)
        all_traits.extend(traits)
    else:
        print(f"Error: Starting ruler traits file not found at {filepath}")
        sys.exit(1)

    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write to file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_traits, f, indent=2, ensure_ascii=False)

    print(f"\nTotal starting ruler traits extracted: {len(all_traits)}")
    print(f"Output saved to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    extract_all_ruler_traits(stellaris_path)
