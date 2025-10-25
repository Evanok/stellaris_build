#!/usr/bin/env python3
"""
Stellaris Traits Extractor
Extracts species traits from Stellaris game files and outputs to JSON
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Any
from paradox_parser import parse_stellaris_file
from localization_parser import load_all_localizations, get_localized_text, clean_localized_text


def extract_modifier_effects(modifier_data: Any) -> str:
    """
    Extract and format modifier effects into readable text

    Args:
        modifier_data: The modifier object from the trait

    Returns:
        Formatted string describing the effects
    """
    if not modifier_data or not isinstance(modifier_data, dict):
        return ""

    effects = []
    for key, value in modifier_data.items():
        if isinstance(value, (int, float)):
            # Format percentage modifiers
            if '_mult' in key or 'speed' in key:
                percentage = value * 100
                sign = '+' if percentage > 0 else ''
                effects.append(f"{key}: {sign}{percentage}%")
            else:
                sign = '+' if value > 0 else ''
                effects.append(f"{key}: {sign}{value}")
        elif isinstance(value, dict):
            # Nested modifiers
            nested_effects = extract_modifier_effects(value)
            if nested_effects:
                effects.append(nested_effects)

    return "; ".join(effects)


def extract_triggered_modifiers(trait_data: Dict[str, Any]) -> str:
    """
    Extract effects from triggered modifiers (triggered_planet_growth_habitability_modifier, etc.)

    Args:
        trait_data: Raw trait data

    Returns:
        Formatted string describing triggered effects
    """
    effects = []

    # Look for all triggered modifier types
    triggered_keys = [
        'triggered_planet_growth_habitability_modifier',
        'triggered_pop_modifier',
        'triggered_modifier',
        'triggered_country_modifier',
        'triggered_planet_pop_group_modifier_for_species',
        'triggered_pop_modifier_for_species',
        'triggered_planet_modifier'
    ]

    for key in triggered_keys:
        if key in trait_data:
            modifier_data = trait_data[key]
            # Can be a single dict or list of dicts
            if isinstance(modifier_data, dict):
                modifier_data = [modifier_data]
            elif not isinstance(modifier_data, list):
                continue

            for mod in modifier_data:
                if isinstance(mod, dict):
                    mod_effects = extract_modifier_effects(mod)
                    if mod_effects:
                        effects.append(mod_effects)

    return "; ".join(effects)


def extract_trait_data(trait_key: str, trait_data: Dict[str, Any], localizations: Dict[str, str] = None) -> Dict[str, Any]:
    """
    Extract relevant data from a single trait

    Args:
        trait_key: The trait identifier
        trait_data: Raw trait data from parser
        localizations: Optional dictionary of localization strings

    Returns:
        Cleaned trait data dictionary
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
        "description": clean_localized_text(description_raw, localizations) if description_raw != desc_key else "",
        "cost": trait_data.get("cost", 0),
        "category": trait_data.get("category", "unknown"),
        "initial": trait_data.get("initial", False),
        "randomized": trait_data.get("randomized", True),
        "modification_species_add": trait_data.get("modification_species_add", True)
    }

    # Extract opposites (mutually exclusive traits)
    opposites = trait_data.get("opposites", {})
    if isinstance(opposites, dict):
        trait["opposites"] = list(opposites.values()) if opposites else []
    elif isinstance(opposites, list):
        trait["opposites"] = opposites
    else:
        trait["opposites"] = [opposites] if opposites else []

    # Extract prerequisites
    prereqs = trait_data.get("prerequisites", {})
    if isinstance(prereqs, dict):
        trait["prerequisites"] = list(prereqs.values()) if prereqs else []
    elif isinstance(prereqs, list):
        trait["prerequisites"] = prereqs
    else:
        trait["prerequisites"] = [prereqs] if prereqs else []

    # Extract allowed archetypes
    archetypes = trait_data.get("allowed_archetypes", {})
    if isinstance(archetypes, dict):
        trait["allowed_archetypes"] = list(archetypes.values()) if archetypes else []
    elif isinstance(archetypes, list):
        trait["allowed_archetypes"] = archetypes
    else:
        trait["allowed_archetypes"] = []

    # Extract tags
    tags = trait_data.get("tags", {})
    if isinstance(tags, dict):
        trait["tags"] = list(tags.values()) if tags else []
    elif isinstance(tags, list):
        trait["tags"] = tags
    else:
        trait["tags"] = []

    # Extract modifier effects
    modifier = trait_data.get("modifier", {})
    trait["modifier"] = modifier

    # Build effects string from multiple sources
    effects_parts = []

    # 1. Get custom tooltip from localizations if it exists
    custom_tooltip_key = trait_data.get("custom_tooltip_with_modifiers", "") or trait_data.get("custom_tooltip", "")
    if custom_tooltip_key:
        tooltip_text = get_localized_text(custom_tooltip_key, localizations)
        if tooltip_text and tooltip_text != custom_tooltip_key:
            # Clean the tooltip (remove color codes, etc.)
            cleaned_tooltip = clean_localized_text(tooltip_text, localizations)
            effects_parts.append(cleaned_tooltip)

    # 2. Extract regular modifier effects
    modifier_effects = extract_modifier_effects(modifier)
    if modifier_effects:
        effects_parts.append(modifier_effects)

    # 3. Extract triggered modifiers
    triggered_effects = extract_triggered_modifiers(trait_data)
    if triggered_effects:
        effects_parts.append(f"Triggered: {triggered_effects}")

    # Combine all effects
    trait["effects"] = " | ".join(effects_parts) if effects_parts else ""

    # Keep custom tooltip key for reference
    trait["custom_tooltip"] = custom_tooltip_key

    # Extract slave cost if present
    slave_cost = trait_data.get("slave_cost", {})
    if isinstance(slave_cost, dict):
        trait["slave_cost"] = slave_cost

    return trait


def extract_traits_from_file(filepath: str, localizations: Dict[str, str] = None) -> List[Dict[str, Any]]:
    """
    Extract all traits from a single file

    Args:
        filepath: Path to the traits file
        localizations: Optional dictionary of localization strings

    Returns:
        List of trait dictionaries
    """
    print(f"Processing: {os.path.basename(filepath)}")

    try:
        data = parse_stellaris_file(filepath)
        traits = []

        for key, value in data.items():
            if isinstance(value, dict) and not key.startswith('_'):
                # Skip documentation and internal keys
                if 'documentation' in key.lower():
                    continue

                # Skip leader traits (these are not species traits)
                if key.startswith('leader_trait'):
                    continue

                trait = extract_trait_data(key, value, localizations)
                traits.append(trait)

        print(f"  Found {len(traits)} traits")
        return traits

    except Exception as e:
        print(f"  Error processing file: {e}")
        return []


def extract_all_traits(stellaris_path: str, output_file: str = "output/traits.json"):
    """
    Extract all species traits from Stellaris installation

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

    # Files to process (species traits only, not leader traits)
    species_trait_files = [
        "01_species_traits_habitability.txt",
        "02_species_traits_basic_characteristics.txt",
        "03_species_traits_presapients.txt",
        "04_species_traits.txt",
        "05_species_traits_robotic.txt",
        "06_distant_stars_traits.txt",
        "07_megacorp_traits.txt",
        "08_ancrel_traits.txt",
        "09_ascension_traits.txt",
        "09_overlord_traits.txt",
        "09_tox_traits.txt",
        "10_species_traits_cyborg.txt",
        "11_first_contact_traits.txt",
        "12_astral_planes_traits.txt",
        "13_cosmic_storms_traits.txt",
        "13_machine_age_traits.txt",
        "14_grand_archive_traits.txt",
        "15_biogenesis_species_traits.txt",
        "15_extreme_frontiers_traits.txt",
        "15_strange_worlds_traits.txt",
        "15_unplugged_traits.txt",
        "17_shroud_species_traits.txt"
    ]

    for filename in species_trait_files:
        filepath = os.path.join(traits_dir, filename)
        if os.path.exists(filepath):
            traits = extract_traits_from_file(filepath, localizations)
            all_traits.extend(traits)

    # Filter out cyborg traits (not selectable at empire creation, only after ascension)
    # This prevents duplicate trait names in the UI (e.g., "Bulky" appearing twice for robot and cyborg)
    filtered_traits = [t for t in all_traits if '_cyborg_' not in t.get('id', '')]

    removed_count = len(all_traits) - len(filtered_traits)
    if removed_count > 0:
        print(f"Filtered out {removed_count} cyborg traits (post-ascension only)")

    # Filter out planet/climate preference traits (automatic based on homeworld)
    before_preference = len(filtered_traits)
    filtered_traits = [t for t in filtered_traits if '_preference' not in t.get('id', '')]
    removed_count = before_preference - len(filtered_traits)
    if removed_count > 0:
        print(f"Filtered out {removed_count} planet/climate preference traits (automatic)")

    # Filter out gestalt leader traits (should have been caught by leader_trait filter)
    before_gestalt = len(filtered_traits)
    filtered_traits = [t for t in filtered_traits if not t.get('id', '').startswith('gestalt_trait_')]
    removed_count = before_gestalt - len(filtered_traits)
    if removed_count > 0:
        print(f"Filtered out {removed_count} gestalt leader traits")

    # Filter out event/progression traits (cost 0) but keep background traits (machine history)
    before_cost_filter = len(filtered_traits)
    filtered_traits = [
        t for t in filtered_traits
        if (
            # Keep if cost is non-zero
            (isinstance(t.get('cost'), (int, float)) and t.get('cost') != 0) or
            (isinstance(t.get('cost'), dict) and t.get('cost', {}).get('base', 0) != 0) or
            # Or if it has 'background' tag (machine history choices)
            (isinstance(t.get('tags'), list) and 'background' in t.get('tags', []))
        )
    ]
    removed_count = before_cost_filter - len(filtered_traits)
    if removed_count > 0:
        print(f"Filtered out {removed_count} event/progression traits (cost 0, non-selectable)")

    # Add archetype suffix to trait names when there are duplicates
    # Group traits by name to find duplicates
    by_name = defaultdict(list)
    for trait in filtered_traits:
        by_name[trait.get('name', '')].append(trait)

    # For duplicate names, add archetype suffix
    duplicate_count = 0
    for name, traits in by_name.items():
        if len(traits) > 1:
            duplicate_count += 1
            for trait in traits:
                archetypes = trait.get('allowed_archetypes', [])
                if archetypes:
                    # Use the first archetype as the suffix
                    archetype = archetypes[0]
                    # Capitalize and format: BIOLOGICAL -> Biological
                    archetype_formatted = archetype.capitalize()
                    trait['name'] = f"{name} ({archetype_formatted})"

    if duplicate_count > 0:
        print(f"Added archetype suffix to {duplicate_count} duplicate trait names")

    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write to JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(filtered_traits, f, indent=2, ensure_ascii=False)

    print(f"\nTotal traits extracted: {len(filtered_traits)}")
    print(f"Output saved to: {output_file}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    extract_all_traits(stellaris_path)
