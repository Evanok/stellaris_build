#!/usr/bin/env python3
"""
Extracts potential/possible structured predicates for authorities and merges
them into the existing (hand-maintained) authorities.json.

authorities.json has no real extractor (see CLAUDE.md: "not extracted by
extract_all.py... copy from previous version if unchanged") - it was
hand-assembled at some point and most fields (election_term_years, tags,
required_ethics, blocked_ethics, etc.) are left untouched here since we don't
know their original source. This script only adds/overwrites `potential` and
`possible`, using the same structured predicate format as civics/origins
(common/governments/authorities/00_authorities.txt uses the identical
value/OR/NOT/NOR DSL - see extract_civics_and_origins.py).

Note: `required_ethics`/`blocked_ethics` in the existing file do not match
the real possible block (e.g. auth_democratic's real rule is "NOT gestalt,
NOT authoritarian, NOT fanatic_authoritarian", not "requires egalitarian").
They are left in place because nothing in the codebase reads them, but
`possible` is now the authoritative field.

Usage: python3 extract_authority_rules.py "<stellaris_path>" <path_to_authorities.json>
"""

import json
import sys
from paradox_parser import parse_stellaris_file
from extract_civics_and_origins import extract_trigger_info


def extract_authority_rules(stellaris_path: str) -> dict:
    filepath = f"{stellaris_path}/common/governments/authorities/00_authorities.txt"
    data = parse_stellaris_file(filepath)

    rules = {}
    for key, value in data.items():
        if not isinstance(value, dict):
            continue
        rules[key] = {
            "potential": extract_trigger_info(value.get("potential", {})),
            "possible": extract_trigger_info(value.get("possible", {})),
        }
    return rules


def merge_into_authorities_json(rules: dict, authorities_json_path: str):
    with open(authorities_json_path, "r", encoding="utf-8") as f:
        authorities = json.load(f)

    updated = 0
    missing = []
    for authority in authorities:
        auth_id = authority["id"]
        if auth_id in rules:
            authority["potential"] = rules[auth_id]["potential"]
            authority["possible"] = rules[auth_id]["possible"]
            updated += 1
        else:
            missing.append(auth_id)

    with open(authorities_json_path, "w", encoding="utf-8") as f:
        json.dump(authorities, f, indent=2, ensure_ascii=False)

    print(f"Updated {updated} authorities with potential/possible")
    if missing:
        print(f"WARNING: not found in game files: {missing}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 extract_authority_rules.py <stellaris_path> <authorities.json path>")
        sys.exit(1)

    stellaris_path, authorities_json_path = sys.argv[1], sys.argv[2]
    rules = extract_authority_rules(stellaris_path)
    print(f"Found rules for {len(rules)} authority entries in game files")
    merge_into_authorities_json(rules, authorities_json_path)
