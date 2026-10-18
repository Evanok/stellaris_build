#!/usr/bin/env python3
"""
Extracts the shipsets (ship appearance, `graphical_culture`) offered in the
empire creator, and renders one preview image per shipset.

What the in-game "Ship models" list shows (verified against it, 4.5):
- one entry per graphical culture used by a species class playable at empire
  creation (common/species_classes/, skipping `playable = { always = no }`,
  pre-sapient PRE_* classes and ROBOT, only playable once a game started)
- only cultures with their own ships: Solarpunk and Wilderness are selectable
  but borrow another set through `fallback`, and are not listed
- labelled with the species class name (HUM -> "Humanoid", IMPERIAL ->
  "Imperial" for nemesis_01, MACHINE -> "Machine" for synthetics_01...)
- in species class file order, Biological sets (`bio_ship` in ship_kinds)
  grouped first

Previews: the game has no 2D shipset picture (its picker is a live 3D view),
so each set's default first ship is rendered from the game models with
pdx_mesh.py - the corvette's default section (CORVETTE_MID_S3, the first
template in common/section_templates/corvette.txt) for mechanical sets, the
Mauler (first bio ship size shown in the ship browser) for biological ones.

Usage: python3 extract_shipsets.py "<stellaris_path>" [output_file] [--images]
"""

import glob
import json
import os
import re
import sys

from paradox_parser import parse_stellaris_file
from localization_parser import load_all_localizations, get_localized_text, clean_localized_text

IMAGE_URL_PREFIX = "/icons/shipsets"
IMAGE_SIZE = (320, 160)  # ships are long and flat - 2:1, displayed at ~160x80
MECHANICAL_PREVIEW_ENTITY = "corvette_s3"
BIOLOGICAL_PREVIEW_ENTITY = "mauler_stage_2_ship"


def _graphical_cultures(stellaris_path: str) -> dict:
    """culture id -> {selectable, biological, has_city_graphics}"""
    cultures = {}
    for filepath in sorted(glob.glob(os.path.join(stellaris_path, "common", "graphical_culture", "*.txt"))):
        text = re.sub(r"#[^\n]*", "", open(filepath, encoding="utf-8-sig").read())
        for match in re.finditer(r"^(\w+)\s*=\s*\{(.*?)^\}", text, re.M | re.S):
            body = match.group(2)
            selectable = re.search(r"selectable\s*=\s*\{([^}]*)\}", body)
            kinds = re.search(r"ship_kinds\s*=\s*\{([^}]*)\}", body)
            cultures[match.group(1)] = {
                "selectable": not (selectable and re.search(r"always\s*=\s*no", selectable.group(1))),
                "biological": bool(kinds and "bio_ship" in kinds.group(1).split()),
                "has_city_graphics": not re.search(r"has_city_graphics\s*=\s*no", body),
            }
    return cultures


def _playable_species_class_cultures(stellaris_path: str) -> list:
    """(species class key, graphical culture) for classes playable at empire creation, in file order."""
    result = []
    for filepath in sorted(glob.glob(os.path.join(stellaris_path, "common", "species_classes", "*.txt"))):
        for key, data in parse_stellaris_file(filepath).items():
            if not isinstance(data, dict) or not isinstance(data.get("graphical_culture"), str) or key.startswith("PRE_"):
                continue
            playable = data.get("playable")
            if isinstance(playable, dict) and (playable.get("always") is False or playable.get("has_global_flag") == "game_started"):
                continue
            result.append((key, data["graphical_culture"]))
    return result


def extract_shipsets(stellaris_path: str, localizations: dict = None, models=None) -> list:
    if localizations is None:
        localizations = load_all_localizations(stellaris_path)
    if models is None:
        from pdx_mesh import ModelIndex
        models = ModelIndex(stellaris_path)
    cultures = _graphical_cultures(stellaris_path)

    shipsets, seen = [], set()
    for class_key, culture_id in _playable_species_class_cultures(stellaris_path):
        culture = cultures.get(culture_id)
        if culture_id in seen or not culture or not culture["selectable"]:
            continue
        preview = BIOLOGICAL_PREVIEW_ENTITY if culture["biological"] else MECHANICAL_PREVIEW_ENTITY
        preview_mesh = models.entity_mesh(f"{culture_id}_{preview}_entity")
        if not preview_mesh:
            continue  # no ships of its own (Solarpunk, Wilderness) - not in the in-game list
        seen.add(culture_id)
        name = clean_localized_text(get_localized_text(class_key, localizations), localizations)
        shipsets.append({
            "id": culture_id,
            "name": name if name != class_key else culture_id,
            "category": "biological" if culture["biological"] else "mechanical",
            "has_city_graphics": culture["has_city_graphics"],
            "image": f"{IMAGE_URL_PREFIX}/{culture_id}.webp",
            "preview_mesh": preview_mesh,
        })

    # Biological sets first, like the in-game list (stable sort keeps file order within a category)
    shipsets.sort(key=lambda s: s["category"] != "biological")
    return shipsets


def extract_shipset_images(stellaris_path: str, output_dir: str) -> int:
    """Renders each shipset's preview ship into {output_dir}/{id}.webp."""
    from pdx_mesh import ModelIndex, render, fit_to_canvas
    models = ModelIndex(stellaris_path)
    os.makedirs(output_dir, exist_ok=True)
    written = 0
    for shipset in extract_shipsets(stellaris_path, localizations={}, models=models):
        try:
            image = render(models.load_parts(shipset["preview_mesh"]), size=640)
            fit_to_canvas(image, *IMAGE_SIZE).save(os.path.join(output_dir, f"{shipset['id']}.webp"), "WEBP", quality=90)
            written += 1
        except Exception as e:
            print(f"  Error rendering {shipset['id']}: {e}")
    return written


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    stellaris_path = args[0] if args else "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"
    output_file = args[1] if len(args) > 1 else "output/shipsets.json"

    shipsets = extract_shipsets(stellaris_path)
    os.makedirs(os.path.dirname(output_file) or ".", exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(shipsets, f, indent=2, ensure_ascii=False)
    print(f"Extracted {len(shipsets)} shipsets -> {output_file}")

    if "--images" in sys.argv:
        images_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend", "public", "icons", "shipsets")
        print(f"Rendered {extract_shipset_images(stellaris_path, images_dir)} shipset previews -> {images_dir}")
