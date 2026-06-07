#!/usr/bin/env python3
"""
Extract species class portrait groups from portrait_categories + portrait_sets.
"""

import json
import os
import re
import sys
from localization_parser import load_all_localizations, get_localized_text

STELLARIS_PATH = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "output", "species_classes.json")

# Remap portrait_category name field → our ID (when they differ)
ID_REMAP = {
    'BIOGENESIS_CAT': 'BIOGENESIS',
}

# Archetype per category ID (fallback when not in species_classes.txt)
ARCHETYPE_FALLBACK = {
    'HUM': 'BIOLOGICAL',
    'MAM': 'BIOLOGICAL',
    'REP': 'BIOLOGICAL',
    'AVI': 'BIOLOGICAL',
    'ART': 'BIOLOGICAL',
    'MOL': 'BIOLOGICAL',
    'FUN': 'BIOLOGICAL',
    'PLANT': 'BIOLOGICAL',
    'AQUATIC': 'BIOLOGICAL',
    'TOX': 'BIOLOGICAL',
    'NECROID': 'BIOLOGICAL',
    'LITHOID': 'LITHOID',
    'MACHINE': 'MACHINE',
    'INF': 'BIOLOGICAL',
    'CYBERNETIC': 'BIOLOGICAL',
    'SYNTH': 'ROBOT',
    'BIOGENESIS': 'BIOLOGICAL',
    'PSIONIC': 'BIOLOGICAL',
}

# Display name overrides when localization key doesn't resolve
NAME_OVERRIDES = {
    'BIOGENESIS': 'BioGenesis',
    'SYNTH': 'Synthetic',
    'PSIONIC': 'Psionic',
    'CYBERNETIC': 'Cybernetic',
    'INF': 'Infernal',
}


def _extract_block(content, open_brace_pos):
    depth = 0
    i = open_brace_pos
    while i < len(content):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                return content[open_brace_pos + 1:i], i + 1
        i += 1
    return content[open_brace_pos + 1:], len(content)


def parse_portrait_categories(stellaris_path):
    filepath = os.path.join(stellaris_path, "common", "portrait_categories", "00_portrait_categories.txt")
    with open(filepath, encoding='utf-8') as f:
        content = re.sub(r'#[^\n]*', '', f.read())

    categories = []
    for m in re.finditer(r'^(\w+)\s*=\s*\{', content, re.MULTILINE):
        cat_key = m.group(1)
        brace_pos = m.start() + m.group().index('{')
        block, _ = _extract_block(content, brace_pos)

        name_m = re.search(r'\bname\s*=\s*(\S+)', block)
        sets_m = re.search(r'\bsets\s*=\s*\{([^}]*)\}', block, re.DOTALL)
        if not name_m or not sets_m:
            continue

        cat_id = name_m.group(1)
        sets = re.findall(r'\b(\w+)\b', sets_m.group(1))

        categories.append({
            'key': cat_key,
            'id': ID_REMAP.get(cat_id, cat_id),
            'sets': sets,
        })

    return categories


def parse_portrait_sets(stellaris_path):
    filepath = os.path.join(stellaris_path, "common", "portrait_sets", "00_portrait_sets.txt")
    with open(filepath, encoding='utf-8') as f:
        content = re.sub(r'#[^\n]*', '', f.read())

    sets_map = {}
    for m in re.finditer(r'^(\w+)\s*=\s*\{', content, re.MULTILINE):
        set_name = m.group(1)
        brace_pos = m.start() + m.group().index('{')
        block, _ = _extract_block(content, brace_pos)

        # All quoted strings in portrait set blocks are portrait IDs
        portrait_ids = list(dict.fromkeys(re.findall(r'"(\w+)"', block)))

        if portrait_ids:
            sets_map[set_name] = portrait_ids

    return sets_map


def parse_species_class_archetypes(stellaris_path):
    classes_dir = os.path.join(stellaris_path, "common", "species_classes")
    archetypes = {}
    for fname in sorted(os.listdir(classes_dir)):
        if not fname.endswith('.txt'):
            continue
        with open(os.path.join(classes_dir, fname), encoding='utf-8', errors='replace') as f:
            content = re.sub(r'#[^\n]*', '', f.read())
        for m in re.finditer(r'^(\w+)\s*=\s*\{', content, re.MULTILINE):
            class_id = m.group(1)
            brace_pos = m.start() + m.group().index('{')
            block, _ = _extract_block(content, brace_pos)
            arch_m = re.search(r'\barchetype\s*=\s*(\S+)', block)
            if arch_m:
                archetypes[class_id] = arch_m.group(1)
    return archetypes


def get_display_name(cat_id, localizations):
    if cat_id in NAME_OVERRIDES:
        return NAME_OVERRIDES[cat_id]
    name = get_localized_text(cat_id, localizations)
    if name == cat_id:
        return cat_id.replace('_', ' ').title()
    return name


def main(stellaris_path=STELLARIS_PATH, output_file=OUTPUT_FILE):
    print("Loading localizations...")
    localizations = load_all_localizations(stellaris_path)

    print("Parsing portrait categories...")
    categories = parse_portrait_categories(stellaris_path)
    print(f"  Found {len(categories)} categories")

    print("Parsing portrait sets...")
    sets_map = parse_portrait_sets(stellaris_path)
    print(f"  Found {len(sets_map)} sets")

    print("Parsing species class archetypes...")
    archetypes = parse_species_class_archetypes(stellaris_path)

    print("\nBuilding species classes:")
    species_classes = []
    for cat in categories:
        cat_id = cat['id']
        portrait_ids = []
        for set_name in cat['sets']:
            for pid in sets_map.get(set_name, []):
                if pid not in portrait_ids:
                    portrait_ids.append(pid)

        archetype = archetypes.get(cat_id, ARCHETYPE_FALLBACK.get(cat_id, 'BIOLOGICAL'))
        name = get_display_name(cat_id, localizations)

        desc_key = f"{cat_id}_desc"
        description = get_localized_text(desc_key, localizations)
        if description == desc_key:
            description = ""

        entry = {
            "id": cat_id,
            "name": name,
            "description": description,
            "archetype": archetype,
            "portraits": sorted(portrait_ids),
            "portrait_count": len(portrait_ids),
        }
        species_classes.append(entry)
        print(f"  {cat_id}: {name} — {len(portrait_ids)} portraits")

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(species_classes, f, indent=2, ensure_ascii=False)

    print(f"\nTotal: {len(species_classes)} species classes")
    print(f"Output: {output_file}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else STELLARIS_PATH
    out = sys.argv[2] if len(sys.argv) > 2 else OUTPUT_FILE
    main(path, out)
