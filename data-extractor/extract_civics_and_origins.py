#!/usr/bin/env python3
"""
Stellaris Civics and Origins Extractor
Extracts civics and origins from Stellaris game files and outputs to JSON
"""

import json
import os
import sys
import re
from pathlib import Path
from typing import Dict, List, Any
from paradox_parser import parse_stellaris_file
from localization_parser import load_all_localizations, get_localized_text, clean_localized_text


def parse_origin_gfx_file(gfx_file_path: str) -> Dict[str, str]:
    """
    Parse origin_eventpictures.gfx to extract GFX → filename mapping

    Args:
        gfx_file_path: Path to origin_eventpictures.gfx

    Returns:
        Dict mapping GFX name to DDS filename (without extension)
    """
    mapping = {}

    if not os.path.exists(gfx_file_path):
        print(f"⚠ Warning: GFX file not found: {gfx_file_path}")
        return mapping

    try:
        with open(gfx_file_path, 'r', encoding='utf-8-sig', errors='ignore') as f:
            content = f.read()

        # Match spriteType blocks with name and texturefile
        # Pattern: name = "GFX_xxx" ... texturefile = "path/to/file.dds"
        pattern = r'name\s*=\s*"(GFX_origin_\w+)"[^}]*?texturefile\s*=\s*"([^"]+)"'
        matches = re.findall(pattern, content, re.DOTALL)

        for gfx_name, texture_path in matches:
            # Extract just the filename without path and extension
            # "gfx/event_pictures/origins/origin_shoulders.dds" → "origin_shoulders"
            filename = texture_path.split('/')[-1].replace('.dds', '')
            mapping[gfx_name] = filename

    except Exception as e:
        print(f"⚠ Error parsing GFX file: {e}")

    return mapping


# The 16 predicate forms of the government requirement DSL, per
# https://github.com/cwtools/cwtools-stellaris-config config/common/governments.cwt
# (alias[government_trigger:*]). Each of these fields accepts a bare `value`, or
# `value` wrapped in OR / NOT / NOR / AND. `always`, `text`, `limit` and
# `host_has_dlc` are handled separately below (not per-field predicates).
LEAF_PREDICATE_FIELDS = {
    'authority', 'country_type', 'ethics', 'civics', 'traits',
    'preferred_planet_class', 'graphical_culture', 'origin', 'species_class',
    'species_archetype', 'host_has_dlc',
    # Not in the .cwt schema (it may lag behind newer patches - see TODO.md
    # section 2) but confirmed present in 4.4 Nomads-era files.
    'is_nomadic',
}

TOPLEVEL_OPERATORS = {'OR', 'AND', 'NOT', 'NOR'}


def _leaves_from_raw_values(field: str, raw_values: Any) -> List[Dict[str, Any]]:
    if isinstance(raw_values, list):
        return [{"field": field, "value": v} for v in raw_values]
    return [{"field": field, "value": raw_values}]


def _normalize_operator_block(field: str, operator: str, block: Any) -> Dict[str, Any]:
    """
    Normalize a single OR/AND/NOT/NOR block for one field, e.g. the
    `{"text": ..., "value": [...]}"` that follows `ethics = { OR = ... }`.
    """
    if isinstance(block, dict) and 'value' in block:
        tooltip = block.get('text')
        leaves = _leaves_from_raw_values(field, block['value'])
    elif isinstance(block, dict):
        # No 'value' key - unrecognized shape, surface it rather than guessing.
        return {"field": field, "unsupported": block}
    else:
        tooltip = None
        leaves = _leaves_from_raw_values(field, block)

    if operator == 'OR':
        node = {"any": leaves}
    elif operator == 'AND':
        node = {"all": leaves}
    elif operator == 'NOT':
        node = {"not": leaves[0] if len(leaves) == 1 else {"all": leaves}}
    else:  # NOR
        node = {"not": {"any": leaves}}
    if tooltip:
        node["tooltip"] = tooltip
    return node


def _normalize_field_value(field: str, value: Any) -> List[Dict[str, Any]]:
    """
    Normalize everything that can follow `field = ...` for one of the leaf
    predicate fields (ethics, authority, civics, ...) into one or more
    structured condition nodes. Multiple occurrences of the same field within
    one block (parsed as a list) are implicitly AND-ed, matching the repeated-key
    convention used elsewhere in Paradox script.
    """
    if isinstance(value, list):
        return [node for item in value for node in _normalize_field_value(field, item)]

    if isinstance(value, dict):
        operator = next((op for op in TOPLEVEL_OPERATORS if op in value), None)
        if operator:
            inner = value[operator]
            # A field can carry several separate OR/NOT/NOR blocks (parsed as a
            # list when the same operator key repeats under one field) - each is
            # its own constraint, AND-ed together.
            if isinstance(inner, list):
                return [_normalize_operator_block(field, operator, block) for block in inner]
            return [_normalize_operator_block(field, operator, inner)]

        if 'value' in value:
            leaves = _leaves_from_raw_values(field, value['value'])
            tooltip = value.get('text')
            node = leaves[0] if len(leaves) == 1 else {"all": leaves}
            if tooltip:
                node["tooltip"] = tooltip
            return [node]

        # Unrecognized shape for this field - surface it instead of silently
        # dropping or mis-encoding it (see TODO.md section 1, Bug B).
        return [{"field": field, "unsupported": value}]

    # Bare scalar, e.g. is_nomadic = no
    return [{"field": field, "value": value}]


def _normalize_toplevel_operator(operator: str, inner: Any) -> Dict[str, Any]:
    """Normalize a top-level OR/AND/NOT/NOR that combines whole predicate
    blocks (possibly of different types), e.g. `OR = { authority = {...} civics = {...} }`."""
    children = _gather_children(inner) if isinstance(inner, dict) else [{"unsupported": inner}]
    if operator == 'OR':
        return {"any": children}
    if operator == 'AND':
        return {"all": children}
    if operator == 'NOT':
        return {"not": children[0] if len(children) == 1 else {"all": children}}
    # NOR
    return {"not": {"any": children}}


def _gather_children(trigger_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
    children: List[Dict[str, Any]] = []
    for key, value in trigger_dict.items():
        if key in TOPLEVEL_OPERATORS:
            children.append(_normalize_toplevel_operator(key, value))
        elif key == 'always':
            children.append({"always": bool(value)})
        elif key == 'text':
            continue  # tooltip override key, not a condition by itself
        elif key == 'limit':
            # `limit` scopes a sub-trigger to a different context (e.g. planet/pop
            # scope) that this extractor cannot evaluate without simulating the
            # game's scope changes. Surface it rather than silently ignoring it.
            children.append({"unsupported_limit": value})
        elif key in LEAF_PREDICATE_FIELDS:
            children.extend(_normalize_field_value(key, value))
        else:
            children.append({"field": key, "unsupported": value})
    return children


def extract_trigger_info(trigger_data: Any) -> Dict[str, Any]:
    """
    Convert a raw `potential`/`possible` trigger block into a structured
    predicate tree that preserves OR/AND/NOT/NOR semantics.

    Node shapes:
        {"all": [node, ...]}                 - every child must hold
        {"any": [node, ...]}                 - at least one child must hold
        {"not": node}                        - child must not hold
        {"always": true|false}
        {"field": <name>, "value": <value>}  - leaf equality check
        {"field": <name>, "unsupported": ...} - shape not recognized; do not
            silently treat as satisfied/unsatisfied, flag it for review instead.

    The root is always an {"all": [...]} node (possibly empty, meaning no
    constraints), so every consumer can rely on a single consistent shape.

    Args:
        trigger_data: The raw parsed `potential` or `possible` block.

    Returns:
        A structured predicate tree, rooted at "all".
    """
    if not trigger_data or not isinstance(trigger_data, dict):
        return {"all": []}

    return {"all": _gather_children(trigger_data)}


def extract_modifier_effects(modifier_data: Any) -> str:
    """
    Extract and format modifier effects into readable text

    Args:
        modifier_data: The modifier object

    Returns:
        Formatted string describing the effects
    """
    if not modifier_data or not isinstance(modifier_data, dict):
        return ""

    effects = []
    for key, value in modifier_data.items():
        if isinstance(value, (int, float)):
            # Format percentage modifiers
            if '_mult' in key or 'speed' in key or 'add' in key:
                if abs(value) < 1 and value != 0:
                    percentage = value * 100
                    sign = '+' if percentage > 0 else ''
                    effects.append(f"{key}: {sign}{percentage}%")
                else:
                    sign = '+' if value > 0 else ''
                    effects.append(f"{key}: {sign}{value}")
            else:
                sign = '+' if value > 0 else ''
                effects.append(f"{key}: {sign}{value}")
        elif isinstance(value, dict):
            # Nested modifiers
            nested_effects = extract_modifier_effects(value)
            if nested_effects:
                effects.append(nested_effects)

    return "; ".join(effects)


def extract_triggered_modifiers(civic_data: Dict[str, Any]) -> str:
    """
    Extract effects from triggered modifiers

    Args:
        civic_data: Raw civic data

    Returns:
        Formatted string describing triggered effects
    """
    effects = []

    # Look for all triggered modifier types
    triggered_keys = [
        'triggered_planet_modifier',
        'triggered_pop_modifier',
        'triggered_modifier',
        'triggered_country_modifier',
        'triggered_desc'
    ]

    for key in triggered_keys:
        if key in civic_data:
            modifier_data = civic_data[key]
            # Can be a single dict or list of dicts
            if isinstance(modifier_data, dict):
                modifier_data = [modifier_data]
            elif not isinstance(modifier_data, list):
                continue

            for mod in modifier_data:
                if isinstance(mod, dict):
                    mod_effects = extract_modifier_effects(mod)
                    if mod_effects:
                        effects.append(mod_effects)

    return "; ".join(effects)


def extract_civic_data(civic_key: str, civic_data: Dict[str, Any], localizations: Dict[str, str] = None) -> Dict[str, Any]:
    """
    Extract relevant data from a single civic

    Args:
        civic_key: The civic identifier
        civic_data: Raw civic data from parser
        localizations: Optional dictionary of localization strings

    Returns:
        Cleaned civic data dictionary
    """
    if localizations is None:
        localizations = {}

    # Get localized name and descriptions
    name = get_localized_text(civic_key, localizations)
    desc_key = f"{civic_key}_desc"
    description_raw = get_localized_text(desc_key, localizations)

    # For tooltips (effects description)
    tooltip_key = civic_data.get("description", "")
    tooltip_text = ""
    if tooltip_key and isinstance(tooltip_key, str):
        tooltip_text = clean_localized_text(get_localized_text(tooltip_key, localizations), localizations)

    # For negative effects
    negative_tooltip_key = civic_data.get("negative_description", "")
    negative_tooltip_text = ""
    if negative_tooltip_key and isinstance(negative_tooltip_key, str):
        negative_tooltip_text = clean_localized_text(get_localized_text(negative_tooltip_key, localizations), localizations)

    civic = {
        "id": civic_key,
        "name": name,
        "description": clean_localized_text(description_raw, localizations) if description_raw != desc_key else "",
        "is_origin": civic_data.get("is_origin", False),
        "playable": True,  # Default to playable unless specified
        "pickable_at_start": civic_data.get("pickable_at_start", True),
        "tooltip": tooltip_text,
        "negative_tooltip": negative_tooltip_text
    }

    # For origins, extract the GFX picture reference
    if civic_data.get("is_origin", False):
        picture = civic_data.get("picture", "")
        if picture:
            civic["picture"] = picture

    # Check if it has playable restrictions
    if "playable" in civic_data:
        playable_data = civic_data["playable"]
        if isinstance(playable_data, dict):
            # If playable has conditions, it might not be always playable
            civic["playable_conditions"] = str(playable_data)

    # Extract potential (availability conditions)
    potential = civic_data.get("potential", {})
    civic["potential"] = extract_trigger_info(potential)

    # Extract possible (selection requirements)
    possible = civic_data.get("possible", {})
    civic["possible"] = extract_trigger_info(possible)

    # Extract homeworld-related rules (origins only - forced/preferred planet class)
    starting_colony = civic_data.get("starting_colony")
    if isinstance(starting_colony, str) and starting_colony:
        civic["starting_colony"] = starting_colony

    habitability_preference = civic_data.get("habitability_preference")
    if isinstance(habitability_preference, str) and habitability_preference:
        civic["habitability_preference"] = habitability_preference

    # Extract soft traits (enforced but removable, unlike enforced_traits below)
    soft_traits_raw = civic_data.get("soft_traits")
    if isinstance(soft_traits_raw, dict):
        if "trait" in soft_traits_raw:
            trait_val = soft_traits_raw["trait"]
            civic["soft_traits"] = trait_val if isinstance(trait_val, list) else [trait_val]
        elif soft_traits_raw:
            civic["soft_traits"] = list(soft_traits_raw.values())
    elif isinstance(soft_traits_raw, list) and soft_traits_raw:
        civic["soft_traits"] = soft_traits_raw

    # Extract modification rules
    modification = civic_data.get("modification", True)
    if isinstance(modification, dict):
        civic["can_add"] = "add" in modification
        civic["can_remove"] = "remove" in modification
    elif isinstance(modification, bool):
        civic["can_modify"] = modification
    else:
        civic["can_modify"] = True

    # Extract modifier effects
    modifier = civic_data.get("modifier", {})
    civic["modifier"] = modifier

    # Build effects string from multiple sources
    effects_parts = []

    # 1. Use the tooltip if it contains useful info (not just a reference)
    if tooltip_text and len(tooltip_text) > 10:
        effects_parts.append(tooltip_text)

    # 2. Extract regular modifier effects
    modifier_effects = extract_modifier_effects(modifier)
    if modifier_effects:
        effects_parts.append(modifier_effects)

    # 3. Extract triggered modifiers
    triggered_effects = extract_triggered_modifiers(civic_data)
    if triggered_effects:
        effects_parts.append(f"Triggered: {triggered_effects}")

    # 4. Check for custom_tooltip_with_modifiers
    custom_tooltip_key = civic_data.get("custom_tooltip_with_modifiers", "") or civic_data.get("custom_tooltip", "")
    if custom_tooltip_key:
        custom_text = get_localized_text(custom_tooltip_key, localizations)
        if custom_text and custom_text != custom_tooltip_key:
            cleaned_custom = clean_localized_text(custom_text, localizations)
            if cleaned_custom not in effects_parts:  # Avoid duplicates
                effects_parts.append(cleaned_custom)

    # Combine all effects
    civic["effects"] = " | ".join(effects_parts) if effects_parts else ""

    # Extract traits (enforced on species)
    traits = civic_data.get("traits", {})
    if isinstance(traits, dict):
        if "trait" in traits:
            civic["enforced_traits"] = [traits["trait"]]
        else:
            civic["enforced_traits"] = list(traits.values()) if traits else []
    elif isinstance(traits, list):
        civic["enforced_traits"] = traits
    else:
        civic["enforced_traits"] = []

    # Extract AI weight
    ai_weight = civic_data.get("ai_weight", {})
    if isinstance(ai_weight, dict) and "base" in ai_weight:
        civic["ai_weight"] = ai_weight["base"]
    else:
        civic["ai_weight"] = 1

    # Extract random weight
    random_weight = civic_data.get("random_weight", {})
    if isinstance(random_weight, dict) and "base" in random_weight:
        civic["random_weight"] = random_weight["base"]
    else:
        civic["random_weight"] = 1

    # Extract alternate civic version (for government reforms)
    civic["alternate_version"] = civic_data.get("alternate_civic_version", "")

    # Can build ruler ship
    civic["can_build_ruler_ship"] = civic_data.get("can_build_ruler_ship", False)

    # Custom tooltip
    civic["custom_tooltip"] = civic_data.get("custom_tooltip_with_modifiers", "")

    return civic


def extract_civics_from_file(filepath: str, localizations: Dict[str, str] = None) -> List[Dict[str, Any]]:
    """
    Extract all civics from a single file

    Args:
        filepath: Path to the civics file
        localizations: Optional dictionary of localization strings

    Returns:
        List of civic dictionaries
    """
    print(f"Processing: {os.path.basename(filepath)}")

    try:
        data = parse_stellaris_file(filepath)
        civics = []

        for key, value in data.items():
            if isinstance(value, dict) and not key.startswith('_'):
                # Skip documentation and internal keys
                if 'documentation' in key.lower() or 'example' in key.lower():
                    continue

                # Skip NPC-only civics (e.g., caravaneer_home, etc.)
                potential = value.get("potential", {})
                if isinstance(potential, dict) and "country_type" in potential:
                    country_type = potential["country_type"]
                    if isinstance(country_type, dict) and "value" in country_type:
                        # If country_type is specified and not default, skip it
                        if country_type["value"] not in ["default", ""]:
                            print(f"  Skipping {key} (NPC country_type: {country_type['value']})")
                            continue

                civic = extract_civic_data(key, value, localizations)
                civics.append(civic)

        print(f"  Found {len(civics)} civics/origins")
        return civics

    except Exception as e:
        print(f"  Error processing file: {e}")
        import traceback
        traceback.print_exc()
        return []


def extract_all_civics(stellaris_path: str, output_file: str = "output/civics.json"):
    """
    Extract all civics and origins from Stellaris installation

    Args:
        stellaris_path: Path to Stellaris installation directory
        output_file: Output JSON file path
    """
    civics_dir = os.path.join(stellaris_path, "common", "governments", "civics")

    if not os.path.exists(civics_dir):
        print(f"Error: Civics directory not found at {civics_dir}")
        sys.exit(1)

    # Load localizations
    print("Loading localizations...")
    localizations = load_all_localizations(stellaris_path)

    all_civics = []

    # Files to process
    civic_files = [
        "00_civics.txt",
        "00_origins.txt",
        "01_special_civics.txt",
        "02_gestalt_civics.txt",
        "03_corporate_civics.txt"
    ]

    for filename in civic_files:
        filepath = os.path.join(civics_dir, filename)
        if os.path.exists(filepath):
            civics = extract_civics_from_file(filepath, localizations)
            all_civics.extend(civics)

    # Separate civics and origins
    all_origins = [c for c in all_civics if c.get("is_origin")]
    civics_only = [c for c in all_civics if not c.get("is_origin")]

    # Filter out duplicate legendary_leader variants (keep only the base one)
    # The game shows only one variant based on authority chosen
    excluded_legendary = [
        'origin_legendary_leader_death',
        'origin_legendary_leader_imperial',
        'origin_legendary_leader_dictatorial'
    ]

    excluded_origins = [o for o in all_origins if o['id'] in excluded_legendary]
    origins = [o for o in all_origins if o['id'] not in excluded_legendary]

    if excluded_origins:
        print(f"\n⚠ Excluded {len(excluded_origins)} legendary_leader variants:")
        for origin in excluded_origins:
            print(f"  - {origin['id']}: {origin['name']}")

    # Load GFX mapping for origins to get correct image filenames
    print("Loading origin GFX mappings...")
    gfx_file = os.path.join(stellaris_path, "interface", "origin_eventpictures.gfx")
    gfx_mapping = parse_origin_gfx_file(gfx_file)
    print(f"  Loaded {len(gfx_mapping)} GFX → filename mappings")

    # Add image_file to origins based on GFX mapping
    for origin in origins:
        picture = origin.get("picture", "")
        if picture and picture in gfx_mapping:
            origin["image_file"] = gfx_mapping[picture]
        else:
            # Special case: GFX_origins_wilderness uses GFX_origin_wilderness mapping
            # (the game has inconsistent naming)
            if picture == "GFX_origins_wilderness":
                alt_picture = "GFX_origin_wilderness"
                if alt_picture in gfx_mapping:
                    origin["image_file"] = gfx_mapping[alt_picture]
                    print(f"  ⚠ Fixed wilderness GFX: {picture} → {alt_picture}")
                else:
                    origin["image_file"] = origin["id"]
            else:
                # Fallback: use origin ID as filename
                origin["image_file"] = origin["id"]

    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(output_file), exist_ok=True)

    # Write all to one file
    output_data = {
        "civics": civics_only,
        "origins": origins,
        "all": all_civics
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    # Also save separately
    civics_output = output_file.replace('.json', '_civics_only.json')
    with open(civics_output, 'w', encoding='utf-8') as f:
        json.dump(civics_only, f, indent=2, ensure_ascii=False)

    origins_output = output_file.replace('.json', '_origins_only.json')
    with open(origins_output, 'w', encoding='utf-8') as f:
        json.dump(origins, f, indent=2, ensure_ascii=False)

    print(f"\nTotal civics extracted: {len(civics_only)}")
    print(f"Total origins extracted: {len(origins)}")
    print(f"Output saved to: {output_file}")
    print(f"  - Civics only: {civics_output}")
    print(f"  - Origins only: {origins_output}")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        # Default path for WSL
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    extract_all_civics(stellaris_path)
