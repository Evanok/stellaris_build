#!/usr/bin/env python3
"""
Extract all Stellaris data (traits, civics, origins, ethics, traditions, ascension perks)
"""

import sys
from extract_traits import extract_all_traits
from extract_civics_and_origins import extract_all_civics
from extract_ethics import extract_all_ethics
from extract_traditions import extract_all_traditions
from extract_ascension_perks import extract_all_ascension_perks


def main():
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    print("=" * 70)
    print("STELLARIS DATA EXTRACTOR")
    print("=" * 70)
    print(f"\nSource: {stellaris_path}\n")

    print("\n--- Extracting Ethics ---")
    extract_all_ethics(stellaris_path)

    print("\n--- Extracting Traits ---")
    extract_all_traits(stellaris_path)

    print("\n--- Extracting Civics & Origins ---")
    extract_all_civics(stellaris_path)

    print("\n--- Extracting Traditions ---")
    extract_all_traditions(stellaris_path)

    print("\n--- Extracting Ascension Perks ---")
    extract_all_ascension_perks(stellaris_path)

    print("\n" + "=" * 70)
    print("EXTRACTION COMPLETE!")
    print("=" * 70)
    print("\nOutput files:")
    print("  - output/ethics.json")
    print("  - output/traits.json")
    print("  - output/civics.json")
    print("  - output/civics_civics_only.json")
    print("  - output/civics_origins_only.json")
    print("  - output/traditions.json")
    print("  - output/traditions_by_tree.json")
    print("  - output/ascension_perks.json")


if __name__ == "__main__":
    main()
