#!/usr/bin/env python3
"""
Extracts the homeworld planet classes a build can use, from common/planet_classes/.

Two kinds of classes are kept:
- selectable: `initial = yes` and not `starting_planet = no` - the climates the
  empire creator offers as homeworld / species preference (Desert ... Alpine,
  Volcanic). Species classes can add/remove some (`only_species_classes` /
  `excluded_species_classes`): Volcanic is Infernal-only, and Infernals lose
  the three cold worlds. pc_ark is `initial = yes` but `starting_planet = no`: it is only
  reachable through the Nomadic toggle, so it is kept but not selectable.
- forced: any class a playable origin sets through `habitability_preference`
  (Void Dwellers -> Habitat, Life-Seeded -> Gaia, ...) or `starting_colony`
  (Remnants -> Relic World, ...). Not offered in the selector, but needed for
  names/icons when an origin locks the homeworld.

The rules linking planets to the rest of a build are NOT here - they already
live in the other files: origins' `habitability_preference` (forced class),
civics/origins `possible` (`preferred_planet_class` predicates, e.g. "NOT
volcanic"), traits' `allowed_planet_classes` (Aquatic = ocean only) and
civics/origins' `granted_traits`.

Icons are sliced from the game's sprite sheets (interface/*.gfx ->
gfx/interface/icons/planet_type_big_icons.dds) by extract_planet_icons(),
called from extract_icons.py.

Usage: python3 extract_planet_classes.py "<stellaris_path>" [output_file] [--icons]
"""

import glob
import json
import os
import re
import sys
from paradox_parser import parse_stellaris_file
from localization_parser import load_all_localizations, get_localized_text, clean_localized_text

PLAYABLE_ORIGIN_FILES_EXCLUDE = ("01_origins_non_playable.txt",)
ICON_URL_PREFIX = "/icons/planets"


def _load_planet_classes(stellaris_path: str) -> dict:
    classes = {}
    for filepath in sorted(glob.glob(os.path.join(stellaris_path, "common", "planet_classes", "*.txt"))):
        data = parse_stellaris_file(filepath)
        for key, value in data.items():
            if key.startswith("pc_") and isinstance(value, dict):
                classes[key] = value
    return classes


def _origin_planet_classes(stellaris_path: str) -> set:
    """Planet classes forced by playable origins (habitability_preference / starting_colony)."""
    found = set()
    civics_dir = os.path.join(stellaris_path, "common", "governments", "civics")
    for filepath in sorted(glob.glob(os.path.join(civics_dir, "*.txt"))):
        if os.path.basename(filepath) in PLAYABLE_ORIGIN_FILES_EXCLUDE:
            continue
        with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
            text = f.read()
        found.update(re.findall(r"^\s*(?:habitability_preference|starting_colony)\s*=\s*(pc_\w+)", text, re.MULTILINE))
    return found


def _species_class_planet_types(stellaris_path: str) -> dict:
    """Maps planet class -> {"added": [species classes], "removed": [species classes]} from
    common/species_classes/ `added_planet_types` / `removed_planet_types` (e.g. Infernal adds
    Volcanic and removes the three cold worlds)."""
    result = {}
    for filepath in sorted(glob.glob(os.path.join(stellaris_path, "common", "species_classes", "*.txt"))):
        data = parse_stellaris_file(filepath)
        for class_id, class_data in data.items():
            if not isinstance(class_data, dict):
                continue
            for key, bucket in (("added_planet_types", "added"), ("removed_planet_types", "removed")):
                planets = class_data.get(key)
                if isinstance(planets, str):
                    planets = [planets]
                elif isinstance(planets, dict):
                    planets = list(planets.values())
                for planet in planets or []:
                    result.setdefault(planet, {"added": [], "removed": []})[bucket].append(class_id)
    return result


def _preference_trait_dlcs(stellaris_path: str) -> dict:
    """Maps planet class -> DLC required for its habitability preference trait (e.g. Volcanic -> Infernals)."""
    filepath = os.path.join(stellaris_path, "common", "traits", "01_species_traits_habitability.txt")
    data = parse_stellaris_file(filepath)
    dlcs = {}
    for key, value in data.items():
        match = re.fullmatch(r"trait_(pc_\w+)_preference", key)
        if match and isinstance(value, dict) and isinstance(value.get("host_has_dlc"), str):
            dlcs[match.group(1)] = value["host_has_dlc"]
    return dlcs


def extract_planet_classes(stellaris_path: str, localizations: dict = None) -> list:
    if localizations is None:
        localizations = load_all_localizations(stellaris_path)

    classes = _load_planet_classes(stellaris_path)
    forced = _origin_planet_classes(stellaris_path)
    dlcs = _preference_trait_dlcs(stellaris_path)
    species_class_types = _species_class_planet_types(stellaris_path)

    result = []
    for class_id, data in classes.items():
        initial = data.get("initial") is True
        if not initial and class_id not in forced:
            continue
        selectable = initial and data.get("starting_planet") is not False
        climate = data.get("climate") if isinstance(data.get("climate"), str) else None

        entry = {
            "id": class_id,
            "name": clean_localized_text(get_localized_text(class_id, localizations), localizations),
            "description": clean_localized_text(get_localized_text(f"{class_id}_desc", localizations), localizations),
            "climate": climate,
            "climate_name": clean_localized_text(get_localized_text(f"climate_{climate}", localizations), localizations) if climate in ("dry", "wet", "cold") else None,
            "selectable": selectable,
            "icon": f"{ICON_URL_PREFIX}/{class_id}.png",
        }
        if class_id in dlcs:
            entry["required_dlc"] = dlcs[class_id]

        # Species-class-specific availability. A class a species class *adds*
        # (Volcanic, Infernal only) is not offered to anyone else, and gets its
        # own picker column - the game swaps the Cold header for "climate_volcanic".
        per_class = species_class_types.get(class_id, {"added": [], "removed": []})
        column = climate
        if per_class["added"]:
            entry["only_species_classes"] = per_class["added"]
            column = class_id[len("pc_"):]
        if per_class["removed"]:
            entry["excluded_species_classes"] = per_class["removed"]
        entry["picker_column"] = column
        column_label = get_localized_text(f"climate_{column}", localizations) if column else ""
        entry["picker_column_name"] = clean_localized_text(column_label, localizations) if column_label and column_label != f"climate_{column}" else None
        if entry["description"] == f"{class_id}_desc":
            entry["description"] = ""
        result.append(entry)

    # Selectable climates first, grouped by climate (dry/wet/cold), then forced classes
    column_order = {"dry": 0, "wet": 1, "cold": 2}
    result.sort(key=lambda c: (not c["selectable"], column_order.get(c["picker_column"], 3), c["name"]))
    return result


def _scan_gfx_sprites(stellaris_path: str) -> dict:
    """name -> {texturefile, sprite_sheet_sprite_type, default_frame, noOfFrames} from interface/*.gfx."""
    sprites = {}
    block_re = re.compile(r"(?:spriteType|frameAnimatedSpriteType)\s*=\s*\{([^{}]*)\}", re.IGNORECASE)
    field_re = re.compile(r"(\w+)\s*=\s*\"?([^\"\s}]+)\"?")
    for filepath in glob.glob(os.path.join(stellaris_path, "interface", "*.gfx")):
        with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
            text = re.sub(r"#[^\n]*", "", f.read())
        for block in block_re.findall(text):
            fields = {k.lower(): v for k, v in field_re.findall(block)}
            if "name" in fields:
                sprites[fields["name"]] = fields
    return sprites


def extract_planet_icons(stellaris_path: str, output_dir: str) -> int:
    """Slices each planet class's large icon out of its sprite sheet into {output_dir}/{class_id}.png."""
    from PIL import Image

    sprites = _scan_gfx_sprites(stellaris_path)
    classes = _load_planet_classes(stellaris_path)
    os.makedirs(output_dir, exist_ok=True)

    written = 0
    for planet in extract_planet_classes(stellaris_path, localizations={}):
        sprite = sprites.get(classes[planet["id"]].get("icon_large", ""))
        if not sprite:
            print(f"  Warning: no icon sprite for {planet['id']}")
            continue
        frame = int(sprite.get("default_frame", 1))
        sheet = sprites.get(sprite.get("sprite_sheet_sprite_type", ""), sprite)
        texture = sheet.get("texturefile")
        frames = int(sheet.get("noofframes", 1))
        if not texture:
            print(f"  Warning: no texture for {planet['id']}")
            continue
        try:
            with Image.open(os.path.join(stellaris_path, texture)) as img:
                img = img.convert("RGBA")
                width = img.width // frames
                icon = img.crop(((frame - 1) * width, 0, frame * width, img.height))
                icon.save(os.path.join(output_dir, f"{planet['id']}.png"), "PNG", optimize=True)
                written += 1
        except Exception as e:
            print(f"  Error extracting icon for {planet['id']}: {e}")
    return written


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    stellaris_path = args[0] if args else "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"
    output_file = args[1] if len(args) > 1 else "output/planet_classes.json"

    planet_classes = extract_planet_classes(stellaris_path)
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(planet_classes, f, indent=2, ensure_ascii=False)
    print(f"Extracted {len(planet_classes)} planet classes ({sum(c['selectable'] for c in planet_classes)} selectable) -> {output_file}")

    if "--icons" in sys.argv:
        icons_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "icons", "planets")
        print(f"Extracted {extract_planet_icons(stellaris_path, icons_dir)} planet icons -> {icons_dir}")
