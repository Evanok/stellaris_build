#!/usr/bin/env python3
"""
Script to insert extracted YouTube build into the database
"""
import json
import requests

# Load the extracted build
with open('build_extracted.json', 'r') as f:
    build = json.load(f)

# Format the description in English
description = f"""
{build['description']}

**Strategy:**
- {build['strategy']['key_building']}
- Early Game: {build['strategy']['early_game']}
- Tech Path: {build['strategy']['tech_path']}
- Military: {build['strategy']['military']}
- Civic Changes: {build['strategy']['civic_changes']}

**Why It Works:**
{build['strategy']['why_it_works']}
""".strip()

# Prepare the payload for the API
payload = {
    "name": build['name'],
    "description": description,
    "game_version": build['game_version'],
    "youtube_url": build['youtube_url'],
    "origin": build['origin'],
    "ethics": ",".join(build['ethics']),
    "authority": build['authority'],
    "civics": ",".join(build['civics']),
    "traits": ",".join(build['traits']),
    "ascension_perks": ",".join(build['ascension_perks']),
    "traditions": ",".join(build['traditions']),
    "tags": ",".join(build['tags']),
    "dlcs": ",".join(build.get('dlcs', []))
}

print("📤 Sending build to API...")
print(f"   Name: {payload['name']}")
print(f"   Origin: {payload['origin']}")
print(f"   Ethics: {payload['ethics']}")
print(f"   Civics: {payload['civics']}")

# Send to API
response = requests.post('http://localhost:3001/api/builds', json=payload)

if response.status_code == 201:
    print("\n✅ Build inserted successfully!")
    build_data = response.json()
    print(f"   Build ID: {build_data['build']['id']}")
    print(f"\n🌐 View at: http://localhost:3000/build/{build_data['build']['id']}")
elif response.status_code == 409:
    print("\n⚠️  Build already exists with this name")
else:
    print(f"\n❌ Error: {response.status_code}")
    print(response.text)
