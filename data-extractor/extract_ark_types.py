#!/usr/bin/env python3
"""
Stellaris Ark Ship Types Extractor
Extracts ark ship type metadata (names, per-tier modifiers, unique features)
from the Nomads DLC game files.

Output: output/ark_types.json
"""

import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from localization_parser import load_all_localizations, get_localized_text, clean_localized_text


# ─── Scripted variable parsing ────────────────────────────────────────────────

def load_scripted_variables(stellaris_path: str) -> dict:
    """Load all @variable = value definitions from common/scripted_variables/."""
    variables = {}
    var_dir = Path(stellaris_path) / "common" / "scripted_variables"
    if not var_dir.exists():
        return variables

    pattern = re.compile(r'^\s*(@\w+)\s*=\s*([0-9.\-]+)', re.MULTILINE)
    for f in sorted(var_dir.glob("*.txt")):
        try:
            text = f.read_text(encoding="utf-8", errors="replace")
            for m in pattern.finditer(text):
                variables[m.group(1)] = float(m.group(2))
        except Exception:
            pass
    return variables


def resolve_var(value_str: str, variables: dict) -> float:
    """Resolve @variable reference or parse a literal float."""
    value_str = value_str.strip()
    if value_str.startswith("@"):
        return variables.get(value_str, 0.0)
    try:
        return float(value_str)
    except ValueError:
        return 0.0


def format_modifier_value(value: float, is_percent: bool) -> str:
    sign = "+" if value >= 0 else ""
    if is_percent:
        pct = value * 100
        if pct == int(pct):
            return f"{sign}{int(pct)}%"
        return f"{sign}{pct:.1f}%"
    if value == int(value):
        return f"{sign}{int(value)}"
    return f"{sign}{value}"


# ─── Ship sizes parsing ───────────────────────────────────────────────────────

# Keys we care about, and whether they are percent multipliers
TRACKED_MODIFIER_KEYS = {
    "ship_fire_rate_mult":                  True,
    "ship_weapon_range_mult":               True,
    "science_ship_survey_speed":            True,
    "arkship_harvest_resources_produces_mult": True,
    # ship_starbase_stockpile_collection_rate_add is shared across all ark types — excluded
    "sensor_range_add":                     False,
    "hyperlane_range_add":                  False,
}

# Human-readable labels (fallback if localization fails)
MODIFIER_LABELS_FALLBACK = {
    "ship_fire_rate_mult":                  "Ship Fire Rate",
    "ship_weapon_range_mult":               "Ship Weapons Range",
    "science_ship_survey_speed":            "Survey Speed",
    "arkship_harvest_resources_produces_mult": "Resources from Harvesting Actions",
    "ship_starbase_stockpile_collection_rate_add": "Stockpile Collection Rate",
    "sensor_range_add":                     "Sensor Range",
    "hyperlane_range_add":                  "Ship Hyperlane Detection Range",
}

# Localization keys for modifier display names
MODIFIER_LOC_KEYS = {
    "ship_fire_rate_mult":                  "MOD_SHIP_FIRE_RATE_MULT",
    "ship_weapon_range_mult":               "MOD_SHIP_WEAPON_RANGE_MULT",
    "science_ship_survey_speed":            "MOD_SHIP_SCIENCE_SURVEY_SPEED",
    "arkship_harvest_resources_produces_mult": "mod_arkship_harvest_resources_produces_mult",
    "sensor_range_add":                     "MOD_SHIP_SENSOR_RANGE_ADD",
    "hyperlane_range_add":                  "MOD_SHIP_HYPERLANE_RANGE_ADD",
}


def extract_ship_modifier_blocks(stellaris_path: str) -> dict:
    """
    Parse 29_nomads_dlc_ships.txt and extract ship_modifier blocks
    for each ark type and tier. Returns:
    {
      "civilian_arkship": {1: {key: raw_value, ...}, 2: {...}, 3: {...}},
      "science_arkship":  {1: {...}, 2: {...}, 3: {...}},
      "military_arkship": {1: {...}, 2: {...}, 3: {...}},
    }
    """
    file_path = (Path(stellaris_path) / "common" / "ship_sizes" / "29_nomads_dlc_ships.txt")
    if not file_path.exists():
        print(f"WARNING: ship sizes file not found: {file_path}")
        return {}

    text = file_path.read_text(encoding="utf-8", errors="replace")
    result = {}

    ark_types = ["civilian_arkship", "science_arkship", "military_arkship"]

    for ark_type in ark_types:
        result[ark_type] = {}
        for tier in range(1, 4):
            block_key = f"{ark_type}_tier_{tier}"
            # Find the block start
            pattern = re.compile(
                rf'^{re.escape(block_key)}\s*=\s*\{{', re.MULTILINE
            )
            m = pattern.search(text)
            if not m:
                continue

            # Extract the full block by counting braces
            start = m.end()
            depth = 1
            pos = start
            while pos < len(text) and depth > 0:
                if text[pos] == '{':
                    depth += 1
                elif text[pos] == '}':
                    depth -= 1
                pos += 1
            block = text[start:pos - 1]

            # Find ship_modifier = { ... } within the block
            sm_match = re.search(r'ship_modifier\s*=\s*\{', block)
            if not sm_match:
                result[ark_type][tier] = {}
                continue

            sm_start = sm_match.end()
            depth = 1
            pos = sm_start
            while pos < len(block) and depth > 0:
                if block[pos] == '{':
                    depth += 1
                elif block[pos] == '}':
                    depth -= 1
                pos += 1
            sm_block = block[sm_start:pos - 1]

            # Parse key = value pairs inside ship_modifier
            modifiers = {}
            for kv in re.finditer(r'(\w+)\s*=\s*(@?\w+(?:\.\w+)?)', sm_block):
                key, val = kv.group(1), kv.group(2)
                if key in TRACKED_MODIFIER_KEYS:
                    modifiers[key] = val

            result[ark_type][tier] = modifiers

    return result


# ─── Science arkship extra flat modifiers (not per-tier, from description) ───

# Science arkship has +1 Sensor Range and +1 Hyperlane Range at all tiers
SCIENCE_FLAT_MODIFIERS = {
    "sensor_range_add":    "1",
    "hyperlane_range_add": "1",
}


# ─── Features per ark type (from localization, hand-mapped to stay stable) ───

def get_ark_features(locs: dict, ark_id: str) -> list:
    """Extract unique features list from localization."""
    key = f"{ark_id}_modifiers"
    raw = get_localized_text(key, locs) or ""
    if not raw:
        return []

    # "Unique Features:" section
    parts = re.split(r'Unique Features\s*:', raw, flags=re.IGNORECASE)
    if len(parts) < 2:
        return []

    features_text = parts[1]
    # Extract bullet points (lines starting with -)
    features = []
    for line in features_text.splitlines():
        line = clean_localized_text(line.strip())
        if line.startswith("- "):
            feat = line[2:].strip()
            # Skip empty or unresolved localization references
            if feat and not feat.startswith("[") and len(feat) > 3:
                # Remove artefact "Concept " from concept link resolution (e.g. "Concept Military Arkship Weapons")
                feat = re.sub(r'\bConcept\s+', '', feat)
                features.append(feat)

    return features


# ─── Main extraction ──────────────────────────────────────────────────────────

def extract_ark_types(stellaris_path: str) -> list:
    print("Loading scripted variables...")
    variables = load_scripted_variables(stellaris_path)

    print("Loading localizations...")
    locs = load_all_localizations(stellaris_path)

    print("Extracting ship modifier blocks...")
    modifier_blocks = extract_ship_modifier_blocks(stellaris_path)

    ark_types_info = []
    ark_ids = ["civilian_arkship", "science_arkship", "military_arkship"]

    for ark_id in ark_ids:
        # Resolve display name
        name_raw = get_localized_text(f"{ark_id}_name", locs) or ark_id
        name = clean_localized_text(name_raw)

        # Build per-tier modifier data
        per_tier_keys = {}  # key -> list of 3 raw values (tier 1/2/3)

        tiers = modifier_blocks.get(ark_id, {})

        # Add flat science modifiers if applicable
        if ark_id == "science_arkship":
            for flat_key, flat_val in SCIENCE_FLAT_MODIFIERS.items():
                for tier in range(1, 4):
                    if tier not in tiers:
                        tiers[tier] = {}
                    tiers[tier][flat_key] = flat_val

        for tier in range(1, 4):
            tier_mods = tiers.get(tier, {})
            for key, raw_val in tier_mods.items():
                if key not in per_tier_keys:
                    per_tier_keys[key] = {}
                per_tier_keys[key][tier] = raw_val

        # Format modifiers
        modifiers = []
        for key, tier_vals in per_tier_keys.items():
            # Resolve modifier display label
            loc_key = MODIFIER_LOC_KEYS.get(key)
            if loc_key:
                label_raw = get_localized_text(loc_key, locs) or ""
                label = clean_localized_text(label_raw) or MODIFIER_LABELS_FALLBACK.get(key, key)
            else:
                label = MODIFIER_LABELS_FALLBACK.get(key, key)

            is_percent = TRACKED_MODIFIER_KEYS.get(key, False)

            formatted = {}
            for tier in range(1, 4):
                raw = tier_vals.get(tier)
                if raw is not None:
                    val = resolve_var(raw, variables)
                    formatted[f"tier{tier}"] = format_modifier_value(val, is_percent)
                else:
                    # Use tier 1 value for missing tiers (some are constant)
                    first = next(iter(tier_vals.values()), "0")
                    val = resolve_var(first, variables)
                    formatted[f"tier{tier}"] = format_modifier_value(val, is_percent)

            modifiers.append({
                "key": key,
                "label": label,
                **formatted,
            })

        # Get unique features
        features = get_ark_features(locs, ark_id)

        ark_types_info.append({
            "id": ark_id,
            "name": name,
            "modifiers": modifiers,
            "features": features,
        })

    return ark_types_info


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 extract_ark_types.py <stellaris_path>")
        print("Example: python3 extract_ark_types.py '/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris'")
        sys.exit(1)

    stellaris_path = sys.argv[1]
    if not Path(stellaris_path).exists():
        print(f"Error: Stellaris path not found: {stellaris_path}")
        sys.exit(1)

    ark_types = extract_ark_types(stellaris_path)

    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    output_file = output_dir / "ark_types.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(ark_types, f, indent=2, ensure_ascii=False)

    print(f"\nExtracted {len(ark_types)} ark types -> {output_file}")
    for ark in ark_types:
        print(f"  {ark['id']}: {ark['name']} ({len(ark['modifiers'])} modifiers, {len(ark['features'])} features)")


if __name__ == "__main__":
    main()
