#!/usr/bin/env python3
"""
Extract portrait textures from Stellaris game files and convert to PNG.
Reads character_textures directly from portrait definition .txt files.
"""

import os
import re
import sys
import json
import glob
import subprocess
from pathlib import Path

STELLARIS_PATH = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"
PORTRAITS_DEF_DIR = "gfx/portraits/portraits"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output", "portrait_icons")


def parse_portrait_textures(stellaris_path):
    """
    Parse all portrait definition .txt files and return a dict mapping
    portrait_id -> first character_texture DDS path (relative to stellaris_path).
    """
    portraits_dir = os.path.join(stellaris_path, PORTRAITS_DEF_DIR)
    portrait_map = {}

    txt_files = sorted(glob.glob(os.path.join(portraits_dir, "*.txt")))
    for txt_file in txt_files:
        with open(txt_file, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        _parse_file(content, portrait_map)

    return portrait_map


def _parse_file(content, portrait_map):
    """
    Scan content for portrait blocks and extract first character_texture path.

    Format examples:
      portrait_id = { ... character_textures = { "gfx/..." ... } ... }
      portrait_id = { portrait_evolution = { ... character_textures = { "gfx/..." } ... } }
    """
    # Strip comments
    content = re.sub(r"#[^\n]*", "", content)

    # Find all top-level portrait = { ... } blocks
    # A portrait entry starts at column 1 with an identifier (no leading spaces beyond a tab)
    pos = 0
    length = len(content)

    while pos < length:
        # Find an identifier at the start of an entry (after newline or start)
        m = re.search(r"(?:^|\n)\t(\w+)\s*=\s*\{", content[pos:])
        if not m:
            break

        portrait_id = m.group(1)
        block_start = pos + m.start() + m.group().index("{")
        block_content, block_end = _extract_block(content, block_start)
        pos = block_end

        # Skip non-portrait entries (portrait_groups, portraits top-level, etc.)
        if portrait_id in ("portraits", "portrait_groups", "species", "value", "variants"):
            continue

        # Find character_textures anywhere in this block (handles nested portrait_evolution)
        textures = _extract_character_textures(block_content)
        if textures and portrait_id not in portrait_map:
            portrait_map[portrait_id] = textures[0]


def _extract_block(content, open_brace_pos):
    """
    Given the position of an opening '{', return (block_content, end_pos)
    where block_content is everything between the braces and end_pos is after '}'.
    """
    depth = 0
    i = open_brace_pos
    while i < len(content):
        if content[i] == "{":
            depth += 1
        elif content[i] == "}":
            depth -= 1
            if depth == 0:
                return content[open_brace_pos + 1 : i], i + 1
        i += 1
    return content[open_brace_pos + 1 :], len(content)


def _extract_character_textures(block_content):
    """Return list of DDS paths from first character_textures block found."""
    m = re.search(r"character_textures\s*=\s*\{([^}]*)\}", block_content, re.DOTALL)
    if not m:
        return []
    inner = m.group(1)
    return re.findall(r'"(gfx/[^"]+\.dds)"', inner)


def convert_dds_to_png(dds_path, png_path, size=256):
    try:
        result = subprocess.run(
            ["convert", dds_path, "-resize", f"{size}x{size}>", png_path],
            capture_output=True,
            text=True,
            timeout=15,
        )
        return result.returncode == 0
    except FileNotFoundError:
        print("ERROR: ImageMagick 'convert' not found. Install with: sudo apt-get install imagemagick")
        sys.exit(1)
    except subprocess.TimeoutExpired:
        return False


# Portraits without character_textures in their definition - hardcoded texture paths.
# These use entity-based rendering (old 3D models) so we point directly to their body texture.
MANUAL_TEXTURE_MAP = {
    "human_legacy_female_01": "gfx/models/portraits/human/human_female_body_01.dds",
    "human_legacy_female_02": "gfx/models/portraits/human/human_female_body_02.dds",
    "human_legacy_female_03": "gfx/models/portraits/human/human_female_body_03.dds",
    "human_legacy_female_04": "gfx/models/portraits/human/human_female_body_04.dds",
    "human_legacy_female_05": "gfx/models/portraits/human/human_female_body_05.dds",
    "human_legacy_male_01": "gfx/models/portraits/human/human_male_body_01.dds",
    "human_legacy_male_02": "gfx/models/portraits/human/human_male_body_02.dds",
    "human_legacy_male_03": "gfx/models/portraits/human/human_male_body_03.dds",
    "human_legacy_male_04": "gfx/models/portraits/human/human_male_body_04.dds",
    "human_legacy_male_05": "gfx/models/portraits/human/human_male_body_05.dds",
    "humanoid_05_female_01": "gfx/models/portraits/humanoid/humanoid_05_female_body_01.dds",
    "humanoid_05_male_01": "gfx/models/portraits/humanoid/humanoid_05_male_body_01.dds",
}


def extract_portraits(stellaris_path=STELLARIS_PATH, output_dir=OUTPUT_DIR):
    # Load species classes to know which portrait IDs we need
    species_classes_file = os.path.join(
        os.path.dirname(__file__), "output", "species_classes.json"
    )
    if not os.path.exists(species_classes_file):
        print(f"ERROR: {species_classes_file} not found. Run extract_species_classes.py first.")
        sys.exit(1)

    with open(species_classes_file, encoding="utf-8") as f:
        species_classes = json.load(f)

    needed_portraits = {}  # portrait_id -> species_class_id
    for sc in species_classes:
        for pid in sc.get("portraits", []):
            needed_portraits[pid] = sc["id"]

    print(f"Need textures for {len(needed_portraits)} portraits across {len(species_classes)} species classes")

    print("Parsing portrait definition files...")
    portrait_texture_map = parse_portrait_textures(stellaris_path)
    # Apply manual overrides for portraits without character_textures
    portrait_texture_map.update(MANUAL_TEXTURE_MAP)
    # Fallback for portrait_group aliases: avi6 -> avi6_m, avi7 -> avi7_m, etc.
    for pid in list(needed_portraits):
        if pid not in portrait_texture_map:
            for suffix in ("_m", "_f", "_male", "_female"):
                alt = pid + suffix
                if alt in portrait_texture_map:
                    portrait_texture_map[pid] = portrait_texture_map[alt]
                    break
    print(f"Found {len(portrait_texture_map)} portrait definitions with character_textures")

    os.makedirs(output_dir, exist_ok=True)

    results = {"ok": 0, "skip": 0, "missing": [], "failed": []}

    for species_class in sorted(species_classes, key=lambda s: s["id"]):
        portraits = species_class.get("portraits", [])
        if not portraits:
            continue

        class_id = species_class["id"].lower()
        class_dir = os.path.join(output_dir, class_id)
        os.makedirs(class_dir, exist_ok=True)

        print(f"\n{species_class['name']} ({len(portraits)} portraits)...")

        for pid in sorted(portraits):
            png_path = os.path.join(class_dir, f"{pid}.png")

            if os.path.exists(png_path):
                results["skip"] += 1
                continue

            rel_dds = portrait_texture_map.get(pid)
            if not rel_dds:
                print(f"  missing def: {pid}")
                results["missing"].append(pid)
                continue

            abs_dds = os.path.join(stellaris_path, rel_dds.replace("/", os.sep))
            if not os.path.exists(abs_dds):
                print(f"  file not found: {rel_dds}")
                results["missing"].append(pid)
                continue

            if convert_dds_to_png(abs_dds, png_path):
                print(f"  ok: {pid}")
                results["ok"] += 1
            else:
                print(f"  convert failed: {pid}")
                results["failed"].append(pid)

    print(f"\nDone.")
    print(f"  Converted : {results['ok']}")
    print(f"  Skipped   : {results['skip']} (already exist)")
    print(f"  Missing   : {len(results['missing'])} {results['missing']}")
    print(f"  Failed    : {len(results['failed'])} {results['failed']}")
    print(f"  Output    : {output_dir}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else STELLARIS_PATH
    extract_portraits(stellaris_path=path)
