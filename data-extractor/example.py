#!/usr/bin/env python3
"""
Example usage of extracted Stellaris data
"""

import json


def main():
    # Load extracted data
    with open('output/ethics.json', 'r') as f:
        ethics = json.load(f)

    with open('output/traits.json', 'r') as f:
        traits = json.load(f)

    with open('output/civics.json', 'r') as f:
        civics_data = json.load(f)

    with open('output/traditions.json', 'r') as f:
        traditions = json.load(f)

    with open('output/ascension_perks.json', 'r') as f:
        perks_data = json.load(f)

    # Example 1: Find all positive traits
    positive_traits = [t for t in traits if 'positive' in t.get('tags', [])]
    print(f"Found {len(positive_traits)} positive traits")
    print("\nFirst 5 positive traits:")
    for trait in positive_traits[:5]:
        print(f"  - {trait['id']}: cost={trait['cost']}, effects={trait.get('effects', 'None')[:50]}")

    # Example 2: Find all origins
    origins = civics_data['origins']
    print(f"\n\nFound {len(origins)} origins")
    print("\nFirst 5 origins:")
    for origin in origins[:5]:
        print(f"  - {origin['id']}")

    # Example 3: Find expensive traits (cost >= 3)
    expensive = [t for t in traits if isinstance(t.get('cost'), (int, float)) and t.get('cost', 0) >= 3]
    print(f"\n\nFound {len(expensive)} expensive traits (cost >= 3)")
    print("\nMost expensive traits:")
    sorted_expensive = sorted(expensive, key=lambda x: x.get('cost', 0) if isinstance(x.get('cost'), (int, float)) else 0, reverse=True)
    for trait in sorted_expensive[:5]:
        print(f"  - {trait['id']}: cost={trait['cost']}")

    # Example 4: Find civics that modify research
    research_civics = [c for c in civics_data['civics']
                       if 'research' in c.get('effects', '').lower() or
                          'tech' in c.get('effects', '').lower()]
    print(f"\n\nFound {len(research_civics)} research-related civics:")
    for civic in research_civics[:5]:
        print(f"  - {civic['id']}: {civic.get('effects', 'None')[:60]}")

    # Example 5: Ethics analysis
    print(f"\n\n=== ETHICS ({len(ethics)} total) ===")
    fanatic_ethics = [e for e in ethics if 'fanatic' in e['id']]
    print(f"Fanatic ethics: {len(fanatic_ethics)}")
    for ethic in fanatic_ethics[:3]:
        print(f"  - {ethic['id']} (cost: {ethic['cost']})")

    # Example 6: Tradition trees
    discovery = [t for t in traditions if t.get('tree') == 'discovery']
    print(f"\n\n=== DISCOVERY TRADITION TREE ===")
    print(f"Total traditions in tree: {len(discovery)}")
    adopt = [t for t in discovery if t.get('type') == 'adopt']
    finish = [t for t in discovery if t.get('type') == 'finish']
    if adopt:
        print(f"Adopt bonus: {adopt[0].get('effects', 'None')[:60]}")
    if finish:
        print(f"Finish bonus: {finish[0].get('effects', 'None')[:60]}")

    # Example 7: Ascension perks recommendations
    print(f"\n\n=== ASCENSION PERKS RECOMMENDATIONS ===")
    # Example: suggest perks for a science-focused build
    science_keywords = ['research', 'science', 'technology', 'tech']
    science_perks = [p for p in perks_data['all']
                     if any(kw in p.get('effects', '').lower() or kw in p['id'].lower()
                            for kw in science_keywords)]
    print(f"Science-focused perks: {len(science_perks)}")
    for perk in science_perks[:3]:
        print(f"  - {perk['id']}")
        if perk.get('effects'):
            print(f"    {perk['effects'][:70]}")


if __name__ == "__main__":
    main()
