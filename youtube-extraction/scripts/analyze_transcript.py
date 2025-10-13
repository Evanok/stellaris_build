#!/usr/bin/env python3
import json

# Load Stellaris data
print("📚 Chargement des données Stellaris...")
with open('backend/data/civics.json', 'r') as f:
    civics_data = json.load(f)
    civics = civics_data.get('civics', [])
    origins = civics_data.get('origins', [])

with open('backend/data/traits.json', 'r') as f:
    traits = json.load(f)

with open('backend/data/ethics.json', 'r') as f:
    ethics = json.load(f)

with open('backend/data/authorities.json', 'r') as f:
    authorities = json.load(f)

# Load transcript
print("📖 Lecture de la transcription...")
with open('youtube_transcript_clean.txt', 'r') as f:
    transcript = f.read().lower()

print(f"✅ Transcription chargée: {len(transcript.split())} mots\n")

# Search for mentions
found = {
    'civics': [],
    'origins': [],
    'traits': [],
    'ethics': [],
    'authorities': []
}

print("🔍 Recherche des éléments...\n")

for civic in civics:
    if civic['name'].lower() in transcript:
        found['civics'].append({'name': civic['name'], 'id': civic['id']})

for origin in origins:
    if origin['name'].lower() in transcript:
        found['origins'].append({'name': origin['name'], 'id': origin['id']})

for ethic in ethics:
    if ethic['name'].lower() in transcript:
        found['ethics'].append({'name': ethic['name'], 'id': ethic['id']})

for auth in authorities:
    if auth['name'].lower() in transcript:
        found['authorities'].append({'name': auth['name'], 'id': auth['id']})

# Only check traits with longer names to avoid false positives
for trait in traits:
    name_lower = trait['name'].lower()
    if len(name_lower) > 6 and name_lower in transcript:
        found['traits'].append({'name': trait['name'], 'id': trait['id']})

# Display results
print("=" * 80)
print("🎯 ÉLÉMENTS TROUVÉS DANS LA VIDÉO")
print("=" * 80)

total = 0
for category, items in found.items():
    if items:
        print(f"\n📌 {category.upper()} ({len(items)}):")
        for item in items[:20]:
            print(f"   • {item['name']}")
        if len(items) > 20:
            print(f"   ... et {len(items) - 20} autres")
        total += len(items)

# Save results
with open('video_analysis.json', 'w') as f:
    json.dump(found, f, indent=2, ensure_ascii=False)

print(f"\n💾 Analyse sauvegardée dans: video_analysis.json")
print(f"📊 Total d'éléments trouvés: {total}")
