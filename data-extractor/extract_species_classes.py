#!/usr/bin/env python3
"""
Stellaris Species Classes Extractor
Extracts species classes and their associated portraits from Stellaris game files
"""

import json
import os
import sys
import re
from pathlib import Path
from typing import Dict, List, Any
from paradox_parser import parse_stellaris_file
from localization_parser import load_all_localizations, get_localized_text

# Mapping of species class codes to their portrait file prefixes
SPECIES_CLASS_PORTRAIT_PREFIXES = {
    'MAM': 'mam',       # Mammalian
    'REP': 'rep',       # Reptilian
    'AVI': 'avi',       # Avian
    'ART': 'art',       # Arthropoid
    'FUN': 'fun',       # Fungoid
    'MOL': 'mol',       # Molluscoid
    'PLANT': 'pla',     # Plantoid
    'HUM': 'human',     # Humanoid
    'IMPERIAL': 'human',     # Imperial (DLC)
    'LITHOID': 'lith',     # Lithoid
    'NECROID': 'nec',       # Necroid
    'AQUATIC': 'aqu',       # Aquatic
    'TOX': 'tox',       # Toxoid
}


def extract_portraits_from_file(filepath: str) -> List[str]:
    """
    Extract portrait IDs from a portraits file

    Args:
        filepath: Path to the portraits file

    Returns:
        List of portrait IDs
    """
    try:
        data = parse_stellaris_file(filepath)
        portraits = []

        # Look for 'portraits' section
        if 'portraits' in data and isinstance(data['portraits'], dict):
            for portrait_id in data['portraits'].keys():
                # Skip internal keys and gendered variations (we'll handle groups)
                if not portrait_id.startswith('_') and not portrait_id.endswith('_f') and not portrait_id.endswith('_m'):
                    portraits.append(portrait_id)
                # For gendered portraits, we need to include the group name
                elif portrait_id.endswith('_f'):
                    # Check if there's a corresponding group
                    base_id = portrait_id[:-2]  # Remove '_f'
                    portraits.append(base_id)

        return portraits
    except Exception as e:
        print(f"  Error reading portraits from {os.path.basename(filepath)}: {e}")
        return []


def extract_all_portraits(stellaris_path: str) -> Dict[str, List[str]]:
    """
    Extract all portraits organized by species class prefix

    Args:
        stellaris_path: Path to Stellaris installation

    Returns:
        Dictionary mapping species class to list of portrait IDs
    """
    portraits_dir = os.path.join(stellaris_path, "gfx", "portraits", "portraits")
    portraits_by_class = {}

    # Get all portrait files
    portrait_files = [
        "01_portraits_mammalian.txt",
        "02_portraits_reptilian.txt",
        "03_portraits_avian.txt",
        "04_portraits_arthropoid.txt",
        "05_portraits_fungoid.txt",
        "06_portraits_molluscoid.txt",
        "07_portraits_human.txt",
        "08_portraits_plantoid.txt",
        "09_portraits_humanoid.txt",
        "11_portraits_humanoid_hp.txt",
        "14_portraits_lithoid.txt",
        "15_portraits_necroid.txt",
        "16_portraits_aquatic.txt",
        "17_portraits_toxoid.txt",
    ]

    all_portraits = []

    for filename in portrait_files:
        filepath = os.path.join(portraits_dir, filename)
        if os.path.exists(filepath):
            portraits = extract_portraits_from_file(filepath)
            all_portraits.extend(portraits)
            print(f"  Found {len(portraits)} portraits in {filename}")

    # Now organize portraits by their prefix
    for species_class, prefix in SPECIES_CLASS_PORTRAIT_PREFIXES.items():
        matching_portraits = [p for p in all_portraits if p.startswith(prefix)]
        if matching_portraits:
            portraits_by_class[species_class] = sorted(list(set(matching_portraits)))

    return portraits_by_class


def extract_species_class_data(class_id: str, class_data: Dict[str, Any],
                                portraits: List[str], localizations: Dict[str, str]) -> Dict[str, Any]:
    """
    Extract data for a single species class

    Args:
        class_id: The species class identifier (e.g., 'MAM', 'REP')
        class_data: Raw species class data from parser
        portraits: List of portrait IDs for this class
        localizations: Dictionary of localization strings

    Returns:
        Cleaned species class data
    """
    # Get localized name (use just the class_id, not SPEC_ prefix)
    name_key = class_id
    name = get_localized_text(name_key, localizations)

    # Track if this is a manual override (to skip post-processing)
    is_manual_override = False

    # If no localization found, generate from ID
    if name == name_key:
        # Convert MAM -> Mammalian, REP -> Reptilian, etc.
        name_mapping = {
            'MAM': 'Mammalian',
            'REP': 'Reptilian',
            'AVI': 'Avian',
            'ART': 'Arthropoid',
            'FUN': 'Fungoid',
            'MOL': 'Molluscoid',
            'PLANT': 'Plantoid',
            'IMPERIAL': 'Human',
            'LITHOID': 'Lithoid',
            'NECROID': 'Necroid',
            'AQUATIC': 'Aquatic',
            'TOX': 'Toxoid',
        }
        name = name_mapping.get(class_id, class_id)

    # Post-processing: Clean up special species names (only if not manual override)
    if not is_manual_override:
        # Remove trailing numbers (e.g., BIOGENESIS_01 -> Biogenesis)
        if '_' in name and name.split('_')[-1].isdigit():
            name = name.rsplit('_', 1)[0]

        # Convert all-caps names to title case (e.g., MACHINE -> Machine, PSIONIC -> Psionic)
        if name.isupper() and len(name) > 1:
            name = name.capitalize()

        # Replace underscores with spaces and title case (e.g., BIOGENESIS_01 -> Biogenesis)
        name = name.replace('_', ' ').title()

    # Manual overrides for specific species classes (applied AFTER post-processing)
    if class_id == 'ROBOT':
        name = 'Synthetic'  # More commonly known as Synthetic in the game
    elif class_id == 'BIOGENESIS_01':
        name = 'BioGenesis'  # Use origin name instead of species name

    # Get description if available
    desc_key = f"{name_key}_desc"
    description = get_localized_text(desc_key, localizations)
    if description == desc_key:
        description = ""

    species_class = {
        "id": class_id,
        "name": name,
        "description": description,
        "archetype": class_data.get("archetype", "BIOLOGICAL"),
        "graphical_culture": class_data.get("graphical_culture", ""),
        "portraits": portraits,
        "portrait_count": len(portraits)
    }

    return species_class


def extract_all_species_classes(stellaris_path: str, output_file: str = "output/species_classes.json"):
    """
    Extract all species classes from Stellaris installation

    Args:
        stellaris_path: Path to Stellaris installation directory
        output_file: Output JSON file path
    """
    species_classes_dir = os.path.join(stellaris_path, "common", "species_classes")

    if not os.path.exists(species_classes_dir):
        print(f"Error: Species classes directory not found at {species_classes_dir}")
        sys.exit(1)

    print("Loading localizations...")
    localizations = load_all_localizations(stellaris_path)

    print("Extracting portraits...")
    portraits_by_class = extract_all_portraits(stellaris_path)

    # Get all .txt files in species_classes directory
    species_classes_files = sorted([
        f for f in os.listdir(species_classes_dir)
        if f.endswith('.txt')
    ])

    print(f"\nProcessing species classes from {len(species_classes_files)} files:")
    all_species_data = {}

    # Read all files and merge data
    for filename in species_classes_files:
        filepath = os.path.join(species_classes_dir, filename)
        print(f"  Reading {filename}...")
        try:
            data = parse_stellaris_file(filepath)
            all_species_data.update(data)
        except Exception as e:
            print(f"    Error reading {filename}: {e}")

    print(f"\nFound {len(all_species_data)} species class definitions")

    try:
        species_classes = []

        # Define player-selectable species classes (including those without specific portraits)
        # NPC-only classes should be excluded
        npc_only_classes = [
            'PRE_MAM', 'PRE_REP', 'PRE_AVI', 'PRE_ART', 'PRE_MOL', 'PRE_FUN', 'PRE_PLANT',
            'PRE_LITHOID', 'PRE_AQUATIC', 'PRE_TOX', 'PRE_INF',  # Primitives
            'AI', 'SWARM', 'EXD',  # Event-spawned species
            'SALVAGER', 'SHROUDWALKER', 'MINDWARDEN_ENCLAVE', 'PARAGON', 'MSI_SLAVER',  # Special NPC species
            'WILDERNESS',  # Special origin species
            'MINDWARDEN',  # Special event species
            'SOLARPUNK',  # Not yet released/playable
            'BIOGENESIS_02',  # Duplicate, keep only BIOGENESIS_01
            'IMPERIAL',  # Requires Nemesis DLC, duplicate of HUM
        ]

        for class_id, class_data in all_species_data.items():
            if isinstance(class_data, dict) and not class_id.startswith('_'):
                # Skip NPC-only classes
                if class_id in npc_only_classes:
                    print(f"  Skipping {class_id} - NPC-only species")
                    continue

                # Get portraits for this class (may be empty for special species)
                portraits = portraits_by_class.get(class_id, [])

                species_class = extract_species_class_data(class_id, class_data, portraits, localizations)
                species_classes.append(species_class)

                if portraits:
                    print(f"  {class_id}: {species_class['name']} ({len(portraits)} portraits)")
                else:
                    print(f"  {class_id}: {species_class['name']} (special species, uses other portraits)")

        # Sort by name for better readability
        species_classes.sort(key=lambda x: x['name'])

        # Create output directory
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # Write to JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(species_classes, f, indent=2, ensure_ascii=False)

        print(f"\nTotal species classes extracted: {len(species_classes)}")
        print(f"Output saved to: {output_file}")

    except Exception as e:
        print(f"Error processing species classes: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    extract_all_species_classes(stellaris_path)
