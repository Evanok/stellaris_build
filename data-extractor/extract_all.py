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
    if game_version:
        print(f"\nTo deploy, copy to backend/data/versions/{game_version}/")
        print(f"  cp {output_dir}/traits.json ../backend/data/versions/{game_version}/traits.json")
        print(f"  cp {output_dir}/civics_civics_only.json ../backend/data/versions/{game_version}/civics.json")
        print(f"  cp {output_dir}/civics_origins_only.json ../backend/data/versions/{game_version}/origins.json")
        print(f"  cp {output_dir}/ethics.json ../backend/data/versions/{game_version}/")
        print(f"  cp {output_dir}/traditions_by_tree.json ../backend/data/versions/{game_version}/traditions.json")
        print(f"  cp {output_dir}/ascension_perks.json ../backend/data/versions/{game_version}/")


if __name__ == "__main__":
    main()
