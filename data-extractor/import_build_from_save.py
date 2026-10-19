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

def extract_gamestate(save_file_path, work_dir):
    """Extract the gamestate file from the .sav ZIP archive into work_dir.

    No cache next to the upload: every upload has a random name, so a cache was
    never reused and each import left ~100 MB behind in backend/uploads.
    """
    try:
        print(f"Extracting gamestate...")
        with zipfile.ZipFile(save_file_path, 'r') as zip_ref:
            if 'gamestate' not in zip_ref.namelist():
                print("ERROR: 'gamestate' file not found in save archive")
                return None

            zip_ref.extract('gamestate', work_dir)
            return os.path.join(work_dir, 'gamestate')
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

def find_block_end(lines, key_idx):
    """Index just past the closing brace of the block opened after the `key=` line at key_idx"""
    depth = 0
    opened = False
    for i in range(key_idx + 1, len(lines)):
        depth += lines[i].count('{') - lines[i].count('}')
        if '{' in lines[i]:
            opened = True
        if opened and depth <= 0:
            return i + 1
    return len(lines)

def find_planet_class(lines, planet_id):
    """planet_class of a planet in the top-level planets={ planet={ <id>={ ... } } } section"""
    planets_start = next((i for i, line in enumerate(lines) if line.rstrip() == 'planets='), None)
    if planets_start is None:
        return None
    planet_header = f'\t\t{planet_id}='
    for i in range(planets_start, len(lines)):
        if lines[i].rstrip() == planet_header:
            for j in range(i, min(i + 50, len(lines))):
                match = re.search(r'planet_class="([^"]+)"', lines[j])
                if match:
                    return match.group(1)
            return None
        if i > planets_start and lines[i] and not lines[i][0].isspace() and lines[i][0] not in '{}':
            break  # Left the planets section
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

    # Bound the search to the player's country block (country 0). It is tens of
    # thousands of lines long in a late-game save, so a fixed-size window misses keys.
    country0_start = None
    for i in range(country_start, min(country_start + 10, len(lines))):
        if lines[i].rstrip() == '\t0=':
            country0_start = i
            break

    if country0_start is None:
        print("ERROR: Could not find the player country (country 0)")
        return None

    country0_end = find_block_end(lines, country0_start)
    print(f"Player country block: lines {country0_start}-{country0_end}")

    def country_key(key):
        """Line index of a top-level key of the player country, or None"""
        prefix = f'\t\t{key}='
        for i in range(country0_start, country0_end):
            if lines[i].startswith(prefix):
                return i
        return None

    gov_start = country_key('government')
    ethos_start = country_key('ethos')

    # Extract ethics: ethos={ ethics={ "ethic_a" "ethic_b" } }
    # Always present: the backend locates the JSON output by its "ethics" key
    build_data['ethics'] = []
    if ethos_start is not None:
        ethos_lines = lines[ethos_start:find_block_end(lines, ethos_start)]
        build_data['ethics'] = re.findall(r'"(ethic_[^"]+)"', '\n'.join(ethos_lines))

    # Extract government data
    if gov_start is not None:
        gov_lines = lines[gov_start:find_block_end(lines, gov_start)]
        gov_text = '\n'.join(gov_lines)

        match = re.search(r'authority="([^"]+)"', gov_text)
        if match:
            build_data['authority'] = match.group(1)

        civics = find_list_in_section(lines, gov_start, 'civics')
        build_data['civics'] = [c for c in civics if c.startswith('civic_')]

        match = re.search(r'origin="([^"]+)"', gov_text)
        if match:
            build_data['origin'] = match.group(1)

    # Ship appearance
    shipset_line = country_key('graphical_culture')
    if shipset_line is not None:
        match = re.search(r'graphical_culture="([^"]+)"', lines[shipset_line])
        if match:
            build_data['graphical_culture'] = match.group(1)

    # Extract tradition trees, in adoption order: every tree has a "<tree>_adopt"
    # entry (tree ids can contain underscores, e.g. tr_cybernetics_assimilator)
    traditions_start = country_key('traditions')
    if traditions_start is not None:
        tradition_lines = lines[traditions_start:find_block_end(lines, traditions_start)]
        tradition_trees = re.findall(r'"(tr_[^"]+)_adopt"', '\n'.join(tradition_lines))
        if tradition_trees:
            build_data['traditions'] = tradition_trees
            print(f"  Found tradition trees: {', '.join(tradition_trees)}")

    # Extract ascension perks
    ascension_start = country_key('ascension_perks')
    if ascension_start is not None:
        perk_lines = lines[ascension_start:find_block_end(lines, ascension_start)]
        ascension_perks = re.findall(r'"(ap_[^"]+)"', '\n'.join(perk_lines))
        if ascension_perks:
            build_data['ascension_perks'] = ascension_perks
            print(f"  Found ascension perks: {', '.join(ascension_perks)}")

    # Extract founder_species_ref from the player's country (country 0)
    founder_species_id = None
    founder_line = country_key('founder_species_ref')
    if founder_line is not None:
        founder_species_id = lines[founder_line].split('=', 1)[1].strip()
        print(f"Found founder_species_ref={founder_species_id} at line {founder_line}")

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
        species_class = None
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

                species_text = '\n'.join(lines[i:find_block_end(lines, i)])
                portrait_match = re.search(r'^\t\tportrait="([^"]+)"', species_text, re.MULTILINE)
                if portrait_match:
                    build_data['portrait'] = portrait_match.group(1)
                    print(f"Found portrait: {build_data['portrait']}")

                # Homeworld planet class: home_planet={ type=planet reference=<id> } (4.2+), home_planet=<id> before
                home_match = re.search(r'home_planet=\s*(?:\{[^}]*reference=)?(\d+)', species_text)
                if home_match:
                    planet_class = find_planet_class(lines, home_match.group(1))
                    if planet_class:
                        build_data['planet_class'] = planet_class
                        print(f"Found homeworld planet class: {planet_class}")

                # Now extract species_class and traits for this species
                for j in range(i, min(i + 200, len(lines))):
                    # Extract species class
                    class_match = re.search(r'class="([^"]+)"', lines[j])
                    if class_match and not species_class:
                        species_class = class_match.group(1)
                        print(f"Found species class: {species_class}")

                    # Extract traits
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
                                    'trait_nerve_stapled', 'trait_erudite', 'trait_enigmatic_intelligence',
                                    'trait_infernal'
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

        # Add species_class to build_data if found
        if species_class:
            build_data['species_class'] = species_class
            print(f"✓ Added species_class to build_data: {species_class}")
        elif species_found:
            print(f"⚠️  Found founder species but no species class extracted")

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

    # Extract and parse the gamestate in a temporary directory, removed afterwards
    with tempfile.TemporaryDirectory(prefix='stellaris_save_') as work_dir:
        gamestate_path = extract_gamestate(save_file, work_dir)

        if not gamestate_path:
            sys.exit(1)

        print(f"✓ Gamestate ready\n")

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
        # Game data is versioned (backend/data/versions/X.Y/): validate against the latest one
        versions_path = os.path.join(script_dir, '..', 'backend', 'data', 'versions')
        versions = sorted(
            (v for v in os.listdir(versions_path) if re.fullmatch(r'\d+\.\d+', v)),
            key=lambda v: tuple(int(n) for n in v.split('.'))
        ) if os.path.isdir(versions_path) else []
        backend_data_path = os.path.join(versions_path, versions[-1]) if versions else None

        if backend_data_path:
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
