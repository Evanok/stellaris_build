#!/usr/bin/env python3
"""
Extracts species trait point/pick budgets per archetype from
common/species_archetypes/00_species_archetypes.txt.

Each archetype (BIOLOGICAL, ROBOT, MACHINE, LITHOID, PRESAPIENT, OTHER) has a
different `species_trait_points` (budget to spend on traits) and
`species_max_traits` (max number of cost != 0 traits). The site currently
hardcodes 2 points / 5 traits for everyone (BuildForm.tsx BASE_MAX_TRAIT_POINTS
/ BASE_MAX_TRAIT_COUNT), which is wrong for MACHINE (1 point) and ROBOT
(0 points, 4 traits) - confirmed against the game files and cross-checked
in-game (Biological 2/5, Machine 1/5 both matched).

Values are defined as file-local @variables (e.g. `@robot_trait_points = 0`)
right in this file - paradox_parser surfaces them as top-level keys, so
resolution is a simple lookup, no need for the common/scripted_variables/
loader used elsewhere. LITHOID has no @variable of its own - it inherits via
`inherit_trait_points_from = BIOLOGICAL`.

Usage: python3 extract_species_archetypes.py "<stellaris_path>" [output_file]
"""

import json
import sys
from paradox_parser import parse_stellaris_file


def extract_species_archetypes(stellaris_path: str) -> dict:
    filepath = f"{stellaris_path}/common/species_archetypes/00_species_archetypes.txt"
    data = parse_stellaris_file(filepath)

    def resolve(value):
        if isinstance(value, str) and value.startswith("@"):
            return data.get(value)
        return value

    archetypes = {}
    for key, value in data.items():
        if key.startswith("@") or not isinstance(value, dict):
            continue
        archetypes[key] = {
            "trait_points": resolve(value.get("species_trait_points")),
            "max_traits": resolve(value.get("species_max_traits")),
            "_inherit_from": value.get("inherit_trait_points_from"),
        }

    for entry in archetypes.values():
        inherit_from = entry.pop("_inherit_from", None)
        if inherit_from and inherit_from in archetypes:
            entry["trait_points"] = archetypes[inherit_from]["trait_points"]
            entry["max_traits"] = archetypes[inherit_from]["max_traits"]

    return archetypes


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 extract_species_archetypes.py <stellaris_path> [output_file]")
        sys.exit(1)

    stellaris_path = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else "output/species_archetypes.json"

    archetypes = extract_species_archetypes(stellaris_path)
    print(f"Extracted trait budgets for {len(archetypes)} archetypes:")
    for name, budget in archetypes.items():
        print(f"  {name}: {budget['trait_points']} points, {budget['max_traits']} max traits")

    import os
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(archetypes, f, indent=2, ensure_ascii=False)
    print(f"\nOutput saved to: {output_file}")
