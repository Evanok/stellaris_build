#!/usr/bin/env python3
"""
Import Stellaris empires from user_empire_designs_v3.4.txt file

This script parses the user empire designs file and extracts all custom empires.
Each empire is returned as a JSON object with all build details.

Usage:
    python3 import_empire_from_designs.py <path_to_user_empire_designs_v3.4.txt> [empire_name]

If empire_name is provided, only that specific empire is returned.
If no empire_name is provided, all empires are listed with their names.
"""

import sys
import json
import re
from pathlib import Path


def parse_empire_designs(file_path, target_empire=None):
    """
    Parse user_empire_designs file and extract empire data

    Args:
        file_path: Path to user_empire_designs_v3.4.txt
        target_empire: Optional - specific empire name to extract

    Returns:
        If target_empire is None: List of empire names
        If target_empire is provided: Empire data as dict
    """
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"ERROR: Failed to read file: {e}", file=sys.stderr)
        return None

    # Find all empire definitions
    # Pattern: "Empire Name"=\n{\n...
    empire_pattern = r'"([^"]+)"\s*=\s*\n\{'
    empire_matches = list(re.finditer(empire_pattern, content))

    if not empire_matches:
        print("ERROR: No empire definitions found in file", file=sys.stderr)
        return None

    # If no target empire specified, return list of names
    if target_empire is None:
        empire_names = [match.group(1) for match in empire_matches]
        return empire_names

    # Find the target empire
    target_match = None
    for match in empire_matches:
        if match.group(1) == target_empire:
            target_match = match
            break

    if not target_match:
        print(f"ERROR: Empire '{target_empire}' not found in file", file=sys.stderr)
        print(f"Available empires: {', '.join([m.group(1) for m in empire_matches])}", file=sys.stderr)
        return None

    # Extract the empire block
    start_pos = target_match.end()

    # Find matching closing brace
    brace_count = 1
    pos = start_pos
    while pos < len(content) and brace_count > 0:
        if content[pos] == '{':
            brace_count += 1
        elif content[pos] == '}':
            brace_count -= 1
        pos += 1

    empire_block = content[start_pos:pos-1]

    # Parse the empire data
    empire_data = parse_empire_block(empire_block, target_empire)
    return empire_data


def parse_empire_block(block, empire_name):
    """Parse a single empire block and extract all relevant data"""

    data = {
        'name': empire_name,
        'origin': None,
        'authority': None,
        'ethics': [],
        'civics': [],
        'traits': [],
        'ruler_trait': None,
    }

    lines = block.split('\n')

    # Extract authority
    authority_match = re.search(r'authority\s*=\s*"([^"]+)"', block)
    if authority_match:
        data['authority'] = authority_match.group(1)

    # Extract origin
    origin_match = re.search(r'origin\s*=\s*"([^"]+)"', block)
    if origin_match:
        data['origin'] = origin_match.group(1)

    # Extract ethics (can be multiple)
    ethic_matches = re.findall(r'ethic\s*=\s*"([^"]+)"', block)
    data['ethics'] = ethic_matches

    # Extract civics (they're in a civics={ ... } block)
    civics_match = re.search(r'civics\s*=\s*\{([^}]+)\}', block, re.DOTALL)
    if civics_match:
        civics_block = civics_match.group(1)
        civic_matches = re.findall(r'"([^"]+)"', civics_block)
        data['civics'] = civic_matches

    # Extract traits from species block
    species_match = re.search(r'species\s*=\s*\{(.*?)\n\t\}', block, re.DOTALL)
    if species_match:
        species_block = species_match.group(1)
        trait_matches = re.findall(r'trait\s*=\s*"([^"]+)"', species_block)

        # Detect species type from system traits before filtering
        species_type = 'BIOLOGICAL'  # Default
        if 'trait_lithoid' in trait_matches:
            species_type = 'LITHOID'
        elif 'trait_machine_unit' in trait_matches:
            species_type = 'MACHINE'
        elif 'trait_robot' in trait_matches:
            species_type = 'ROBOT'
        # trait_organic means BIOLOGICAL (default)

        data['speciesType'] = species_type

        # Filter out meta traits and portraits
        # These are automatic/system traits that shouldn't be user-selectable
        excluded_traits = {
            'trait_organic', 'trait_hive_mind', 'trait_machine_unit', 'trait_mechanical',
            'trait_lithoid', 'trait_robot', 'trait_wilderness', 'trait_machine',
            'trait_clone_soldier_infertile', 'trait_self_modified', 'trait_cybernetic',
            'trait_latent_psionic', 'trait_psionic', 'trait_nerve_stapled',
            'trait_erudite', 'trait_enigmatic_intelligence'
        }
        traits = [t for t in trait_matches if t.startswith('trait_') and t not in excluded_traits]
        data['traits'] = traits

    # Extract ruler trait
    ruler_match = re.search(r'ruler\s*=\s*\{(.*?)\n\t\}', block, re.DOTALL)
    if ruler_match:
        ruler_block = ruler_match.group(1)
        # Find trait that starts with trait_ruler_
        ruler_trait_matches = re.findall(r'trait\s*=\s*"(trait_ruler_[^"]+)"', ruler_block)
        if ruler_trait_matches:
            data['ruler_trait'] = ruler_trait_matches[0]

    return data


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 import_empire_from_designs.py <path_to_user_empire_designs.txt> [empire_name]")
        print("\nIf empire_name is not provided, lists all available empires.")
        print("If empire_name is provided, extracts that empire's data as JSON.")
        sys.exit(1)

    file_path = sys.argv[1]

    # Check if file exists
    if not Path(file_path).exists():
        print(f"ERROR: File not found: {file_path}", file=sys.stderr)
        sys.exit(1)

    # If no empire name specified, list all empires
    if len(sys.argv) == 2:
        empire_names = parse_empire_designs(file_path)
        if empire_names is None:
            sys.exit(1)

        # Output as JSON array for API consumption
        print(json.dumps(empire_names))
        sys.exit(0)

    # Extract specific empire
    empire_name = sys.argv[2]
    empire_data = parse_empire_designs(file_path, empire_name)

    if empire_data is None:
        sys.exit(1)

    # Output as JSON
    print(json.dumps(empire_data, indent=2))


if __name__ == '__main__':
    main()
