#!/usr/bin/env python3
"""
Script to insert all YouTube builds into a remote database via API
Usage: python3 bulk_insert_builds.py <api_url>
Example: python3 bulk_insert_builds.py https://your-dedibox.com/api/builds
"""

import json
import requests
import sys
import os
from pathlib import Path

def load_build(json_file):
    """Load and format a build JSON file"""
    with open(json_file, 'r') as f:
        build = json.load(f)

    # Format the description with strategy details
    if 'strategy' in build:
        strategy_parts = []
        for key, value in build['strategy'].items():
            # Format key as title
            title = key.replace('_', ' ').title()
            strategy_parts.append(f"**{title}:** {value}")

        strategy_text = "\n\n".join(strategy_parts)
        description = f"""{build['description']}

**Strategy:**

{strategy_text}

**Tags:** {', '.join(build.get('tags', []))}

**DLCs Required:** {', '.join(build.get('dlcs', []))}

**Difficulty:** {build.get('difficulty', 'Not specified')}

**Notes:** {build.get('notes', '')}
"""
    else:
        description = build['description']

    # Prepare the payload
    payload = {
        "name": build['name'],
        "description": description,
        "game_version": build.get('game_version', '4.0+'),
        "youtube_url": build.get('youtube_url', ''),
        "origin": build.get('origin', ''),
        "ethics": ",".join(build.get('ethics', [])),
        "authority": build.get('authority', ''),
        "civics": ",".join(build.get('civics', [])),
        "traits": ",".join(build.get('traits', [])),
        "ascension_perks": ",".join(build.get('ascension_perks', [])),
        "traditions": ",".join(build.get('traditions', [])),
        "tags": ",".join(build.get('tags', [])),
        "dlcs": ",".join(build.get('dlcs', []))
    }

    return payload

def insert_build(api_url, build_file):
    """Insert a single build via API"""
    print(f"\nProcessing: {build_file.name}")

    try:
        payload = load_build(build_file)
        print(f"  - Build: {payload['name']}")

        response = requests.post(api_url, json=payload, timeout=10)

        if response.status_code == 201:
            data = response.json()
            build_id = data['build']['id']
            print(f"  ✅ Success! Build ID: {build_id}")
            return True
        else:
            print(f"  ❌ Failed! Status: {response.status_code}")
            print(f"  Response: {response.text}")
            return False

    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 bulk_insert_builds.py <api_url>")
        print("Example: python3 bulk_insert_builds.py https://stellaris.yourdomain.com/api/builds")
        sys.exit(1)

    api_url = sys.argv[1]

    # Find builds directory
    script_dir = Path(__file__).parent
    builds_dir = script_dir.parent / 'builds'

    if not builds_dir.exists():
        print(f"❌ Builds directory not found: {builds_dir}")
        sys.exit(1)

    # Get all JSON files
    build_files = sorted(builds_dir.glob('build_*.json'))

    if not build_files:
        print(f"❌ No build JSON files found in {builds_dir}")
        sys.exit(1)

    print(f"Found {len(build_files)} build files")
    print(f"Target API: {api_url}")
    print("\nStarting insertion...")

    # Insert all builds
    success_count = 0
    for build_file in build_files:
        if insert_build(api_url, build_file):
            success_count += 1

    print(f"\n{'='*50}")
    print(f"Results: {success_count}/{len(build_files)} builds inserted successfully")
    print(f"{'='*50}")

if __name__ == '__main__':
    main()
