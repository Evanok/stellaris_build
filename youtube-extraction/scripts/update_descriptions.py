#!/usr/bin/env python3
"""
Update build descriptions in production with cleaner, more concise versions
"""

import requests

API_URL = "https://stellaris-build.com/api/builds"

# New clean descriptions - concise and well-structured
DESCRIPTIONS = {
    7: """A tall psionic empire that exploits the Composer of Strands shroud patron to spam Gaia worlds.

**Core Strategy:** Rush 800 attunement to make a covenant with the Composer of Strands. This unlocks the Transformation power - once per decade, you can terraform ANY uninhabitable planet or moon into a small Gaia world. Combined with Life Seeded origin (size 30 Gaia homeworld + 100% Gaia habitability), you create a constellation filled with perfect worlds.

**How to Play:**
- Choose Composer of Strands as shroud domain immediately and rush 800 attunement with envoys + calling tasks
- Stay in 1 system or small constellation - pick Sol system for guaranteed rocky moons to transform
- Complete Psionic Ascension (Mind Over Matter → Transcendence) to make the covenant
- Use Transformation power every 10 years to convert barren worlds into Gaia paradises
- Spam Shrouded Vegetation blockers on capital for massive unity (Environmentalist civic synergy)

**Why It Works:** One quality Gaia world produces more than three normal planets. Extremely defensible with 1-2 choke points. Perfect 100% habitability everywhere. Great for single-player roleplay as nature druids with purple vines everywhere.""",

    6: """An exponentially scaling tech build that achieves 35,000+ research by year 57 using the Knights of the Toxic God origin.

**Core Strategy:** The origin gives you an orbital habitat with Knight and Squire jobs. Knights consume alloys to produce research/unity/naval capacity. Squires buff Knight output and are INFINITE in patch 4.0 - you can stack unlimited Squires by reducing housing to -100%. Knights also inherit ALL politician and scientist bonuses, allowing insane stacking.

**How to Play:**
- Focus all development on the Order's Keep orbital habitat
- Build strongholds to unlock more Knight job slots
- Spam infinite Squire jobs (housing exploit) - each Squire buffs all Knights
- Use Spiritualist for Veneration of Saints edict (+20% priest output applies to Knights)
- Stack every politician/scientist bonus you can find - all apply to Knights
- Research tech buildings (+1 per 100 researchers bonus also applies to Knights!)

**Why It's Broken:** Infinite Squires × Knight stacking × inherited bonuses = exponential growth with no ceiling. Each additional Squire makes ALL Knights stronger, which speeds up tech, which unlocks more bonuses. Tech output scales faster than any other build in the game.""",

    5: """A build that exploits Overtuned origin's hidden mechanic: taking Biomorphosis ascension as your SECOND perk instead of third.

**Core Strategy:** Overtuned origin has an undocumented benefit - it lets you skip the normal ascension perk requirement and take Biomorphosis (biological ascension) as your 2nd perk. Combined with insane pop growth (+40% from Overtuned traits + Rapid Breeders) and Genesis Guides civic (unity from colonizing/uplifting), you hit endgame ascension when other empires are still in early traditions.

**How to Play:**
- Start with Pre-Planned Growth trait (+30% growth) + Rapid Breeders (+10%) = 40% pop growth from day 1
- Use Genesis Guides civic to farm unity by colonizing planets and uplifting primitives
- Rush Discovery + Prosperity traditions, take One Vision first perk
- Take Evolutionary Mastery (Biomorphosis) as SECOND perk - normally requires 3rd slot!
- Reform government late-game: swap Parliamentary System → Crowdsourced Research (factions produce science)
- Use gene modding to min-max species and activate "Damn the Consequences" edict when economy is strong

**Why It's Broken:** You reach biological ascension years before other empires. The pop growth + unity generation combo lets you speedrun ascension perks. One perk earlier = massive power spike in 4.0 meta.""",

    8: """The first-ever psionic machine empire, made possible by the Shadows of the Shroud DLC.

**Core Strategy:** Shroud-Forged origin creates machines reshaped by a shroud entity. You get unique shroud-forged pops that can't do menial work but excel at complex jobs (+efficiency). Energy Extractors civic allows machines to go psionic (normally impossible). Combine with Cranial Megatrophy trait (+25% researcher efficiency) and shroud observation buildings (produce research + Zro) for explosive tech growth.

**How to Play:**
- Build Shroud Observation Complexes on shroud-touched worlds (10 jobs each producing physics/society research + Zro)
- Use shroud-forged pops for specialist/researcher jobs, regular robots for menial work
- Progress through "Forged by the Shroud" situation for additional powers
- Take psionic ascension path (Mind Over Matter → Transcendence)
- Use Pattern Finders civic for cycling empire buffs every 13 years
- Pierce the Shroud planetary decision to terraform worlds (unpredictable results)

**Why It's Unique:** This is the ONLY way to create psionic machines. Completely new playstyle combining machine efficiency with shroud powers. Shroud-forged pops are quality over quantity - they're elite workers but can't do basic labor.""",

    3: """An exponentially scaling build that abuses the Virtual Computational Core Focus policy to reach millions of research per month.

**Core Strategy:** Every 100 civilians provides +0.5% output to chosen resource (research/unity/alloys). Transform from biological → synthetic → virtual, then reform to Megacorp with Corporate Hedonism civic. This creates infinite civilians (no job slot limit) that scale exponentially - more pops = faster assembly = more pops = more research = faster tech = better assembly.

**How to Play:**
- Start with Synthetic Fertility origin and rush engineering for robot assembly
- Complete Synthetic Ascension transformation to become full synthetic
- During Virtual transformation event chain, choose "Research Turning Into Profits" for fake virtual state
- Reform government to Megacorp authority and take Corporate Hedonism civic
- Enable Computational Core Focus policy (set to Research) - unlisted/unnamed policy!
- Build Ecumenopolises with max city districts and Robot Quantum Production Hubs (300 roboticist jobs each)
- At 1.3 million pops with 71k+ civilians, achieve 570%+ research bonus

**Why It's Broken:** The Computational Core Focus policy has NO CAP and isn't properly named in-game (devs overlooked it). Corporate Hedonism civilians don't use job slots so you can stack infinite. The build discovered by community member 'Scope' can reach 1+ million research per month.""",

    4: """A comprehensive generalized tech rush framework that can achieve ~1000 tech output by year 30.

**Core Strategy:** This is a teaching guide showing universal principles for tech rushing in Stellaris 4.0, adaptable to any playstyle. Focus on early unity (Parliamentary System + faction management), specialized research buildings (+1 per 100 researchers), and proper opening moves to establish a strong tech foundation quickly.

**How to Play:**
- Use Parliamentary System or equivalent unity civic (Civil Education, Beacon of Liberty, etc.)
- Take Intelligent (+10% research) + growth trait (Rapid Breeders/Erudite) + specialized research trait (Natural Sociologists/Physicists/Engineers based on ship type)
- Opening: Survey home system, buy 42 minerals, replace starbase crew quarters with hydroponics, promote factions, adjust policies
- Research priority: Get specialized tech buildings ASAP (doubles output in chosen category)
- Colonize 2nd planet for minerals/food, use trade from Masterful Crafters for consumer goods
- Later swap Parliamentary System → Crowdsourced Research for science scaling

**Why It Works:** This isn't a specific build but a framework. The creator emphasizes understanding WHY each choice is made rather than copying exactly. Works on Grand Admiral with midgame scaling. Good beginner foundation with clear opening steps.""",

    2: """An early-game artillery rush build using Ancient Nano Missile Clouds to dominate before enemies can counter.

**Core Strategy:** Nano Missile Clouds have 120 range (normal weapons are 80-100 range) allowing you to kite and destroy enemies without taking damage. Rush Archaeo-Engineers AP to unlock this ancient tech, build pure corvette fleets with nano missiles, and conquer aggressively before the tech window closes.

**How to Play:**
- Take Technological Ascendancy 1st perk, Archaeo-Engineers 2nd perk (unlocks ancient weapons)
- Research Ancient Nano Missile Clouds tech ASAP
- Build corvette fleets with only nano missiles (no other weapons - waste of alloys)
- Use 120 range to kite enemy fleets - they can't shoot back while you delete them
- Conquer aggressively in early-mid game before enemies get long-range counters
- Transition to normal late-game fleet composition once the nano missile advantage fades

**Why It Works:** The 120 range creates a timing window where you're untouchable. Enemies with 80-100 range weapons literally cannot fight back. Pure corvettes are cheap and fast. However, this is a timing attack - the advantage disappears once enemies get titans or other long-range options."""
}

def update_build(build_id, new_description):
    """Update a single build's description"""
    print(f"\nUpdating Build #{build_id}...")

    payload = {
        "description": new_description
    }

    try:
        response = requests.patch(f"{API_URL}/{build_id}", json=payload, timeout=10)
        if response.status_code == 200:
            print(f"  ✅ Updated successfully")
            return True
        else:
            print(f"  ❌ Failed: {response.status_code}")
            print(f"  Response: {response.text}")
            return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False

def main():
    print("Updating build descriptions in production")
    print(f"Target API: {API_URL}")
    print(f"\n{'='*60}")

    success_count = 0
    for build_id, description in DESCRIPTIONS.items():
        if update_build(build_id, description):
            success_count += 1

    print(f"\n{'='*60}")
    print(f"Results: {success_count}/{len(DESCRIPTIONS)} builds updated successfully")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
