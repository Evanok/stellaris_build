#!/usr/bin/env python3
"""
Extract all Stellaris data (traits, civics, origins, ethics, traditions, ascension perks).

Auto-detects the game version from launcher-settings.json and outputs to output/versions/X.Y/.
If a versioned folder already exists, its files are updated in place.
"""

import sys
import os
import json
import re
from extract_traits import extract_all_traits
from extract_civics_and_origins import extract_all_civics
from extract_ethics import extract_all_ethics
from extract_traditions import extract_all_traditions
from extract_ascension_perks import extract_all_ascension_perks
from extract_authority_rules import extract_authority_rules, merge_into_authorities_json
from extract_species_archetypes import extract_species_archetypes


def detect_game_version(stellaris_path: str) -> str | None:
    """Read major.minor version from launcher-settings.json (e.g. 'v4.3.1' -> '4.3')."""
    settings_path = os.path.join(stellaris_path, "launcher-settings.json")
    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        raw = data.get("rawVersion", "")
        match = re.search(r"(\d+)\.(\d+)", raw)
        if match:
            return f"{match.group(1)}.{match.group(2)}"
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        pass
    return None


def main():
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    print("=" * 70)
    print("STELLARIS DATA EXTRACTOR")
    print("=" * 70)
    print(f"\nSource: {stellaris_path}")

    game_version = detect_game_version(stellaris_path)
    if game_version:
        print(f"Detected game version: {game_version}")
        output_dir = os.path.join("output", "versions", game_version)
        action = "Updating" if os.path.isdir(output_dir) else "Creating"
        print(f"{action} output directory: {output_dir}")
    else:
        print("Warning: could not detect game version, using default output/ directory")
        output_dir = "output"

    os.makedirs(output_dir, exist_ok=True)
    print()

    print("--- Extracting Ethics ---")
    extract_all_ethics(stellaris_path, os.path.join(output_dir, "ethics.json"))

    print("\n--- Extracting Traits ---")
    extract_all_traits(stellaris_path, os.path.join(output_dir, "traits.json"))

    print("\n--- Extracting Civics & Origins ---")
    extract_all_civics(stellaris_path, os.path.join(output_dir, "civics.json"))

    print("\n--- Extracting Traditions ---")
    extract_all_traditions(stellaris_path, os.path.join(output_dir, "traditions.json"))

    print("\n--- Extracting Ascension Perks ---")
    extract_all_ascension_perks(stellaris_path, os.path.join(output_dir, "ascension_perks.json"))

    print("\n--- Extracting Authority Rules (potential/possible) ---")
    # authorities.json itself has no full extractor (most fields are
    # hand-maintained, copied from the previous version - see CLAUDE.md).
    # We only extract the potential/possible predicates here, same DSL as
    # civics/origins, and merge them into whichever authorities.json already
    # exists for this version (backend copy if present, else just the raw
    # rules file so a later manual merge is possible).
    authority_rules = extract_authority_rules(stellaris_path)
    authority_rules_path = os.path.join(output_dir, "authority_rules.json")
    with open(authority_rules_path, "w", encoding="utf-8") as f:
        json.dump(authority_rules, f, indent=2, ensure_ascii=False)
    print(f"  Extracted rules for {len(authority_rules)} authority entries -> {authority_rules_path}")

    backend_authorities_path = None
    if game_version:
        candidate = os.path.join("..", "backend", "data", "versions", game_version, "authorities.json")
        if os.path.isfile(candidate):
            backend_authorities_path = candidate
    if backend_authorities_path:
        merge_into_authorities_json(authority_rules, backend_authorities_path)
    else:
        print("  No existing backend authorities.json for this version yet - merge manually once it's")
        print("  copied from the previous version (see 'Process for a new Stellaris version' in CLAUDE.md):")
        print(f"    python3 extract_authority_rules.py \"{stellaris_path}\" ../backend/data/versions/{game_version or 'X.Y'}/authorities.json")

    print("\n--- Extracting Species Archetype Trait Budgets ---")
    species_archetypes = extract_species_archetypes(stellaris_path)
    species_archetypes_path = os.path.join(output_dir, "species_archetypes.json")
    with open(species_archetypes_path, "w", encoding="utf-8") as f:
        json.dump(species_archetypes, f, indent=2, ensure_ascii=False)
    for name, budget in species_archetypes.items():
        print(f"  {name}: {budget['trait_points']} points, {budget['max_traits']} max traits")
    print(f"  -> {species_archetypes_path}")

    print("\n" + "=" * 70)
    print("EXTRACTION COMPLETE!")
    print("=" * 70)
    print(f"\nOutput directory: {output_dir}/")
    print("  - ethics.json")
    print("  - traits.json")
    print("  - civics.json")
    print("  - civics_civics_only.json")
    print("  - civics_origins_only.json")
    print("  - traditions.json")
    print("  - traditions_by_tree.json")
    print("  - ascension_perks.json")
    print("  - authority_rules.json (potential/possible only - authorities.json itself is hand-maintained)")
    print("  - species_archetypes.json")
    if game_version:
        print(f"\nTo deploy, copy to backend/data/versions/{game_version}/")
        print(f"  cp {output_dir}/species_archetypes.json ../backend/data/versions/{game_version}/")
        print(f"  cp {output_dir}/traits.json ../backend/data/versions/{game_version}/traits.json")
        print(f"  cp {output_dir}/civics_civics_only.json ../backend/data/versions/{game_version}/civics.json")
        print(f"  cp {output_dir}/civics_origins_only.json ../backend/data/versions/{game_version}/origins.json")
        print(f"  cp {output_dir}/ethics.json ../backend/data/versions/{game_version}/")
        print(f"  cp {output_dir}/traditions_by_tree.json ../backend/data/versions/{game_version}/traditions.json")
        print(f"  cp {output_dir}/ascension_perks.json ../backend/data/versions/{game_version}/")
        if not backend_authorities_path:
            print(f"  cp ../backend/data/versions/<previous_version>/authorities.json ../backend/data/versions/{game_version}/  # if unchanged")
            print(f"  python3 extract_authority_rules.py \"{stellaris_path}\" ../backend/data/versions/{game_version}/authorities.json")


if __name__ == "__main__":
    main()
