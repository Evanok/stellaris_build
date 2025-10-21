#!/usr/bin/env python3
"""
Import a Stellaris build from a save game file (.sav) - Version 2
Simplified to just extract and display the essential build info

Usage:
    python3 import_build_from_save_v2.py <path_to_save_file.sav>
"""

import sys
import os
import json
import zipfile
import tempfile
import re

def extract_gamestate(save_file_path):
    """Extract gamestate file from .sav ZIP archive with caching"""
    try:
        # Create cache directory based on save file name
        save_basename = os.path.basename(save_file_path)
        cache_dir = os.path.join(os.path.dirname(save_file_path), f'.cache_{save_basename}')
        gamestate_path = os.path.join(cache_dir, 'gamestate')

        # Check if cached gamestate exists
        if os.path.exists(gamestate_path):
            print(f"✓ Using cached gamestate")
            return gamestate_path

        # Extract to cache directory
        print(f"Extracting gamestate to cache...")
        with zipfile.ZipFile(save_file_path, 'r') as zip_ref:
            if 'gamestate' not in zip_ref.namelist():
                print("ERROR: 'gamestate' file not found in save archive")
                return None

            os.makedirs(cache_dir, exist_ok=True)
            zip_ref.extract('gamestate', cache_dir)
            return gamestate_path
    except Exception as e:
        print(f"ERROR: Failed to extract save file: {e}")
        return None

def find_value_in_section(lines, start_idx, key):
    """Find a simple key=value in a section"""
    pattern = re.compile(rf'\s*{key}="?([^"\s]+)"?')

    # Search forward from start_idx
    for i in range(start_idx, min(start_idx + 100, len(lines))):
        match = pattern.match(lines[i])
        if match:
            return match.group(1)
    return None

def find_list_in_section(lines, start_idx, key):
    """Find a list of values for a key in a section"""
    # Look for pattern: key={ "value1" "value2" ... }
    values = []
    in_section = False

    for i in range(start_idx, min(start_idx + 200, len(lines))):
        line = lines[i].strip()

        if f'{key}=' in line:
            in_section = True
            continue

        if in_section:
            if '}' in line and '{' not in lines[i-1]:
                break

            # Extract quoted values
            matches = re.findall(r'"([^"]+)"', line)
            values.extend(matches)

    return values

def parse_gamestate_simple(gamestate_path):
    """Simple parser - just extract the key build info"""

    print("Reading gamestate file...")
    with open(gamestate_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    lines = content.split('\n')
    print(f"Loaded {len(lines):,} lines")

    # Extract empire name from file header (line 3: name="Empire Name")
    build_data = {}
    if len(lines) > 3:
        match = re.search(r'name="([^"]+)"', lines[2])  # Line 3 is index 2
        if match:
            build_data['name'] = match.group(1)
            print(f"Found empire name in header: {build_data['name']}")

    # Find the player country section (country={ 0={ ... } })
    print("\nSearching for player country data...")

    country_start = None
    for i, line in enumerate(lines):
        if line.strip() == 'country=':
            country_start = i
            break

    if not country_start:
        print("ERROR: Could not find 'country=' section")
        return None

    print(f"Found country section at line {country_start}")

    # Find key sections within the country data

    # Search for government section (contains civics, authority, origin)
    gov_start = None
    ethos_start = None

    for i in range(country_start, min(country_start + 50000, len(lines))):
        line = lines[i].strip()

        if line == 'government=':
            gov_start = i
            print(f"Found government section at line {gov_start}")

        if line == 'ethos=':
            ethos_start = i
            print(f"Found ethos section at line {ethos_start}")

        # Stop if we've found both
        if gov_start and ethos_start:
            break

    # Extract ethics
    if ethos_start:
        ethics = []
        for i in range(ethos_start, min(ethos_start + 20, len(lines))):
            matches = re.findall(r'ethic="([^"]+)"', lines[i])
            ethics.extend(matches)

        # Filter to only ethic_ entries
        build_data['ethics'] = [e for e in ethics if e.startswith('ethic_')]

    # Extract government data
    if gov_start:
        # Find authority
        for i in range(gov_start, min(gov_start + 30, len(lines))):
            match = re.search(r'authority="([^"]+)"', lines[i])
            if match:
                build_data['authority'] = match.group(1)
                break

        # Find civics list
        civics = find_list_in_section(lines, gov_start, 'civics')
        build_data['civics'] = [c for c in civics if c.startswith('civic_')]

        # Find origin
        for i in range(gov_start, min(gov_start + 50, len(lines))):
            match = re.search(r'origin="([^"]+)"', lines[i])
            if match:
                build_data['origin'] = match.group(1)
                break

    # Empire name was already extracted from header (no need to parse complex structure)

    # Extract traditions (tradition trees)
    traditions_start = None
    for i in range(country_start, min(country_start + 50000, len(lines))):
        if lines[i].strip() == 'traditions=':
            traditions_start = i
            print(f"Found traditions section at line {traditions_start}")
            break

    if traditions_start:
        tradition_trees = []
        seen_trees = set()
        for i in range(traditions_start, min(traditions_start + 200, len(lines))):
            # Match individual traditions like "tr_expansion_adopt"
            match = re.search(r'"(tr_[^_]+)', lines[i])
            if match:
                tree_id = match.group(1)  # Extract just "tr_expansion" part
                if tree_id not in seen_trees:
                    seen_trees.add(tree_id)
                    tradition_trees.append(tree_id)
                    print(f"  Found tradition tree: {tree_id}")
            elif lines[i].strip() == '}' and '{' not in lines[i-1]:
                # End of traditions section
                break

        if tradition_trees:
            build_data['traditions'] = tradition_trees

    # Extract ascension perks
    ascension_start = None
    for i in range(country_start, min(country_start + 50000, len(lines))):
        if lines[i].strip() == 'ascension_perks=':
            ascension_start = i
            print(f"Found ascension_perks section at line {ascension_start}")
            break

    if ascension_start:
        ascension_perks = []
        for i in range(ascension_start, min(ascension_start + 50, len(lines))):
            match = re.search(r'"(ap_[^"]+)"', lines[i])
            if match:
                perk_id = match.group(1)
                ascension_perks.append(perk_id)
                print(f"  Found ascension perk: {perk_id}")
            elif lines[i].strip() == '}' and '{' not in lines[i-1]:
                # End of ascension_perks section
                break

        if ascension_perks:
            build_data['ascension_perks'] = ascension_perks

    # Extract founder_species_ref from the player's country (country 0)
    founder_species_id = None
    for i in range(country_start, min(country_start + 20000, len(lines))):
        match = re.search(r'founder_species_ref=(\d+)', lines[i])
        if match:
            founder_species_id = match.group(1)
            print(f"Found founder_species_ref={founder_species_id} at line {i}")
            break

    if not founder_species_id:
        print("⚠️  Could not find founder_species_ref in player country")

    # Extract species traits from species_db
    # Find species_db section (near the beginning of file)
    species_db_start = None
    for i in range(0, min(100, len(lines))):
        if lines[i].strip() == 'species_db=':
            species_db_start = i
            print(f"Found species_db section at line {species_db_start}")
            break

    if species_db_start and founder_species_id:
        # Strategy: Find the specific species by its ID (founder_species_ref from country 0)
        traits = []
        species_found = False
        founder_species_start = None

        # Look for the exact species entry matching founder_species_id
        species_pattern = re.compile(rf'^\s*{founder_species_id}=\s*$')

        for i in range(species_db_start, min(species_db_start + 50000, len(lines))):
            line = lines[i]

            # Match the exact species ID
            if species_pattern.match(line):
                print(f"Found founder species (ID={founder_species_id}) at line {i}")
                species_found = True
                founder_species_start = i

                # Now find the traits section for this species
                for j in range(i, min(i + 200, len(lines))):
                    if lines[j].strip() == 'traits=':
                        print(f"Found traits section at line {j}")
                        # Extract all traits from this section
                        for k in range(j, min(j + 50, len(lines))):
                            if lines[k].strip() == '}' and '{' not in lines[k-1]:
                                break
                            match = re.search(r'trait="(trait_[^"]+)"', lines[k])
                            if match:
                                trait = match.group(1)
                                # Filter out system/automatic traits
                                # These are traits automatically added by the game
                                excluded_traits = {
                                    'trait_organic', 'trait_hive_mind', 'trait_machine_unit',
                                    'trait_robot', 'trait_wilderness', 'trait_clone_soldier_infertile',
                                    'trait_self_modified', 'trait_lithoid', 'trait_mechanical',
                                    'trait_cybernetic', 'trait_latent_psionic', 'trait_psionic',
                                    'trait_nerve_stapled', 'trait_erudite', 'trait_enigmatic_intelligence'
                                    # Note: trait_auto_mod_robotic (Adaptive Frames) and trait_auto_mod_biological (Vocational Genomics)
                                    # are NOT excluded - they are selectable traits at empire creation
                                }
                                # Exclude planet preference traits (trait_pc_* and trait_machine_pc_*)
                                if trait.startswith('trait_pc_') or trait.startswith('trait_machine_pc_'):
                                    continue
                                # Exclude digital/modded traits added after game start (trait_robot_digital_*)
                                if trait.startswith('trait_robot_digital_'):
                                    continue
                                # Only include if not in excluded set
                                if trait not in excluded_traits:
                                    traits.append(trait)
                                    print(f"  Added trait: {trait}")
                        break
                break

        if traits:
            build_data['traits'] = traits
        elif species_found:
            print(f"⚠️  Found founder species but no traits extracted")
        else:
            print(f"⚠️  Could not find founder species (ID={founder_species_id}) in species_db")

    # Detect species type from the founder species traits
    # Check the traits we already extracted to determine species type
    if species_db_start and species_found and founder_species_start:
        species_type = 'BIOLOGICAL'  # Default

        # Look in the specific founder species section where we found traits
        # Search from founder_species_start to avoid false positives from other species
        for i in range(founder_species_start, min(founder_species_start + 300, len(lines))):
            line = lines[i].strip()

            # Stop if we hit the next species entry
            if re.match(r'\d+=\s*$', line) and i > founder_species_start + 10:
                break

            # Check for species type indicator traits
            if 'trait="trait_lithoid"' in line:
                species_type = 'LITHOID'
                print(f"✓ Detected species type: LITHOID")
                break
            elif 'trait="trait_machine_unit"' in line:
                species_type = 'MACHINE'
                print(f"✓ Detected species type: MACHINE")
                break
            elif 'trait="trait_robot"' in line and 'trait="trait_machine_unit"' not in lines[max(0,i-5):i+5]:
                species_type = 'ROBOT'
                print(f"✓ Detected species type: ROBOT")
                break
            elif 'trait="trait_organic"' in line:
                species_type = 'BIOLOGICAL'
                print(f"✓ Detected species type: BIOLOGICAL")
                break

        build_data['speciesType'] = species_type

    return build_data

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 import_build_from_save_v2.py <path_to_save_file.sav>")
        sys.exit(1)

    save_file = os.path.expanduser(sys.argv[1])

    if not os.path.exists(save_file):
        print(f"ERROR: File not found")
        sys.exit(1)

    # Get just the filename for display (hide full path)
    save_filename = os.path.basename(save_file)

    print(f"{'='*70}")
    print(f"Importing build from: {save_filename}")
    print(f"{'='*70}\n")

    # Extract gamestate (with caching)
    gamestate_path = extract_gamestate(save_file)

    if not gamestate_path:
        sys.exit(1)

    print(f"✓ Gamestate ready\n")

    # Parse gamestate
    build_data = parse_gamestate_simple(gamestate_path)

    if not build_data:
        print("\n✗ Failed to extract build data")
        sys.exit(1)

    # Display results
    print(f"\n{'='*70}")
    print("EXTRACTED BUILD DATA")
    print(f"{'='*70}\n")

    print(f"Empire Name:    {build_data.get('name', 'Not found')}")
    print(f"Species Type:   {build_data.get('speciesType', 'BIOLOGICAL (default)')}")
    print(f"Origin:         {build_data.get('origin', 'Not found')}")
    print(f"Authority:      {build_data.get('authority', 'Not found')}")
    print(f"Ethics:         {', '.join(build_data.get('ethics', [])) or 'Not found'}")
    print(f"Civics:         {', '.join(build_data.get('civics', [])) or 'Not found'}")
    print(f"Traits:         {', '.join(build_data.get('traits', [])) or 'Not found'}")
    print(f"Traditions:     {', '.join(build_data.get('traditions', [])) or 'Not found'}")
    print(f"Asc. Perks:     {', '.join(build_data.get('ascension_perks', [])) or 'Not found'}")

    print(f"\n{'='*70}")
    print("JSON OUTPUT")
    print(f"{'='*70}\n")
    print(json.dumps(build_data, indent=2))

    # Validate against backend data (optional check)
    print(f"\n{'='*70}")
    print("VALIDATION (checking against website data)")
    print(f"{'='*70}\n")

    try:
        # Get relative path to backend data (don't expose absolute server paths)
        script_dir = os.path.dirname(os.path.abspath(__file__))
        backend_data_path = os.path.join(script_dir, '..', 'backend', 'data')

        if os.path.exists(backend_data_path):
            # Load backend data for validation
            with open(os.path.join(backend_data_path, 'origins.json')) as f:
                origins = json.load(f)
            with open(os.path.join(backend_data_path, 'traits.json')) as f:
                traits = json.load(f)
            with open(os.path.join(backend_data_path, 'civics.json')) as f:
                civics = json.load(f)
            with open(os.path.join(backend_data_path, 'ascension_perks.json')) as f:
                ascension_perks_data = json.load(f)
            with open(os.path.join(backend_data_path, 'traditions.json')) as f:
                traditions_data = json.load(f)

            origin_ids = [o['id'] for o in origins]
            trait_ids = [t['id'] for t in traits]
            civic_ids = [c['id'] for c in civics]

            # ascension_perks.json has structure: {"all": [...]}
            perk_ids = [p['id'] for p in ascension_perks_data.get('all', [])]

            # traditions.json has structure: {"tr_adaptability": {...}, "tr_supremacy": {...}}
            tradition_ids = list(traditions_data.keys())

            # Check origin
            if build_data.get('origin') not in origin_ids:
                print(f"⚠️  Origin '{build_data.get('origin')}' not found in website data")
                print(f"   → This origin is likely from a mod (not in vanilla Stellaris)")
                print(f"   → You'll need to manually select a vanilla origin when importing")

            # Check traits
            unknown_traits = [t for t in build_data.get('traits', []) if t not in trait_ids]
            if unknown_traits:
                print(f"⚠️  Unknown traits detected: {', '.join(unknown_traits)}")
                print(f"   → These traits are likely from mods (not in vanilla Stellaris)")
                print(f"   → They won't be recognized when importing to the website")
                print(f"   → You may need to manually select equivalent vanilla traits")

            # Check civics
            unknown_civics = [c for c in build_data.get('civics', []) if c not in civic_ids]
            if unknown_civics:
                print(f"⚠️  Unknown civics detected: {', '.join(unknown_civics)}")
                print(f"   → These civics are likely from mods (not in vanilla Stellaris)")
                print(f"   → They won't be recognized when importing to the website")

            # Check ascension perks
            unknown_perks = [p for p in build_data.get('ascension_perks', []) if p not in perk_ids]
            if unknown_perks:
                print(f"⚠️  Unknown ascension perks detected: {', '.join(unknown_perks)}")
                print(f"   → These perks are likely from mods (not in vanilla Stellaris)")
                print(f"   → They won't be recognized when importing to the website")

            # Check traditions
            unknown_traditions = [t for t in build_data.get('traditions', []) if t not in tradition_ids]
            if unknown_traditions:
                print(f"⚠️  Unknown traditions detected: {', '.join(unknown_traditions)}")
                print(f"   → These traditions are likely from mods (not in vanilla Stellaris)")
                print(f"   → They won't be recognized when importing to the website")

            if (not unknown_traits and not unknown_civics and not unknown_perks and
                not unknown_traditions and build_data.get('origin') in origin_ids):
                print("✅ All extracted data is valid and present in website database!")
        else:
            print("⚠️  Backend data not found, skipping validation")
    except Exception as e:
        print(f"⚠️  Validation skipped: {e}")

    print(f"\n✓ Build extraction completed!\n")

if __name__ == "__main__":
    main()
