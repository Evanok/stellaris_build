# Build Finder — Planning Document

Design notes for the "Find a Build" feature: a guided questionnaire that helps
players discover a Stellaris build that fits how they want to play.

> Status: **design in progress**. A working v1 prototype exists at `/finder`
> (experience/example tree only) to validate the UX. This document captures the
> thinking, the locked decisions, the candidate questions, and the DLC content
> map that the real question tree will be built from.

---

## 1. Purpose / vision

The finder is not only "pick a build for me". Its deeper goal is to be a
**guided tour of Stellaris' content** — most DLCs introduced a distinct gameplay
archetype, and answering the questions walks the player through that content
space.

Two consequences of that framing:

- The question tree is **derived from the game's content space** (DLC ->
  gameplay archetype), not reverse-engineered from our current catalog.
- Empty leaves (a valid archetype combination with no matching build) are a
  **feature, not a bug**: they become a **roadmap of builds to create** so the
  database eventually covers the whole content space.

---

## 2. Locked decisions

These were agreed during brainstorming and should not be re-litigated without a
reason:

- **Strict decision tree with hardcoded build IDs at the leaves.** No dynamic
  classification, no tag/scoring engine for now. Each leaf explicitly pins the
  build IDs to suggest.
- **If a leaf has no matching build, we create the build.** The tree can have
  more leaves than we currently have builds; that gap list is the content
  roadmap.
- **Order questions by elimination power**: ask the questions that split the
  content space the most first, then the more specific ones.
- **Variable depth + early exits.** Not every branch needs to be 5-7 questions
  deep. Some answers can lead to a result after Q1 or Q2 (e.g. the beginner
  fast-track). Depth is chosen per branch, not uniform. This is what keeps a
  strict tree from exploding into thousands of leaves.
- **DLC handling (v1): assume the player owns everything.** No upfront DLC
  checklist (selecting ~30 DLCs is a chore and kills the "fun quiz" feel).
  Instead, each suggested build on the result screen **lists the important DLCs
  it needs** (badge). A DLC filter can be added later.

### Data model already built (v1 prototype)

- `backend/data/build_finder_tree.json` — the tree (nodes = question or result;
  result nodes carry `build_ids`).
- `GET /api/build-finder-tree` — serves the tree JSON.
- `GET /api/finder/builds?ids=1,2,3` — resolves build IDs into enriched builds,
  preserves requested order, silently drops missing/deleted IDs.
- `frontend/src/pages/BuildFinder.tsx` — route `/finder`, walks the tree with
  back/restart, result screen reuses the dark-theme card styling.
- Navbar link "Find a Build".

---

## 3. Question / axis ideas

Candidate axes a Stellaris player cares about, grouped by the role they play:

**Filters (hard constraints — eliminate builds):**
- DLC owned (deferred to v2 — v1 assumes all owned, shows DLC badges on results)
- Empire archetype: Normal empire / Hive mind / Machine intelligence
- Species base / diet: Biological (food) / Lithoid (minerals) / Machine (energy)

**Direction (what the player wants — steer toward a category):**
- Win condition / playstyle: Military conquest / Tech rush / Economy & trade /
  Diplomacy & federation / Tall optimization / Wide expansion
- Ascension path: Genetic (bio) / Cybernetic / Synthetic / Psionic / Don't care
- Origin flavor: story/roleplay-driven vs meta/performance-driven
- Nomadic vs classic (Nomads DLC)

**Tuning (refine within a category):**
- Power / difficulty: chill / balanced / meta grand-admiral
- Experience level: beginner / knows the game / veteran
- Single-player vs multiplayer/competitive

### Backbone under consideration: experience first, variable depth

The first question sets **how deep the journey goes**, not what to eliminate:

```
Q1 - Your level?
     Beginner  /  I know the game  /  Expert
      |
      +- BEGINNER ------------- depth ~2
      |   Q2: "What appeals to you?" (a few simple & strong archetypes)
      |       -> results immediately
      |
      +- I KNOW THE GAME ------ depth ~4
      |   Q2 archetype -> Q3 win condition -> Q4 ascension -> results
      |
      +- EXPERT --------------- depth ~5-7
          Q2 archetype -> Q3 win condition -> Q4 ascension -> Q5 species
             -> Q6 temperament -> Q7 power level -> results
```

- Conditional questions: species skipped for machine empires; ethics/temperament
  skipped for gestalts (hive/machine).
- A beginner answers ~2 questions; an expert answers ~6-7.

Alternative backbone (not chosen, kept for reference): **archetype first**
(Normal / Hive / Machine) as the single most eliminating question, then win
condition, then ascension.

> Open question: which backbone to commit to. Leaning toward experience-first
> because it doses depth naturally.

---

## 4. DLC content map (the content space)

Game up to date: **4.4 "Pegasus"**. The rightmost column is what feeds the tree
— note how ~30 DLCs collapse into ~10-12 gameplay archetypes. Items marked `?`
need verification.

### Major expansions (large gameplay changes)

| DLC | Content added | -> Archetype unlocked |
|---|---|---|
| **Utopia** | Ascension paths (bio/psionic/synthetic), megastructures, habitats, Hive Mind authority, slavery/purge | Tall/habitat, hive mind, ascensions |
| **Apocalypse** | Titans, Colossus (planet-killers), Marauders + Great Khan, Nihilistic Acquisition | Total-war conquest / brutal militarism |
| **MegaCorp** | Corporate authority, branch offices, trade value, ecumenopolis, criminal syndicate, Caravaneers | Economy / trade / megacorp |
| **Federations** | Federation types, Galactic Community + Senate/resolutions, Juggernaut | Diplomacy / federation leader |
| **Nemesis** | Espionage, Become the Crisis (menace), Galactic Custodian -> Emperor, menacing ships | Crisis empire / galactic emperor / espionage |
| **Overlord** | Specialist vassals (Bulwark/Scholarium/Prospectorium), holdings, hyper relays, orbital rings, quantum catapult | Overlord / vassal management |
| **Galactic Paragons** | Leader overhaul, Council, leader traits, immortal/legendary leaders | Leader-centric / council empire |
| **The Machine Age** | Cybernetic & synthetic ascension reworks, Nanotech ascension, Individual Machine Intelligence, Virtuality, Cosmogenesis crisis, arc furnace | Cyborg / synthetic / virtual / machine crisis |
| **BioGenesis** | Biological ascension rework, Wilderness origin (planet = empire), evolutionary predators, tameable space fauna/behemoths, cordyceptic drones | Bio ascension / space fauna / wilderness |

### Story packs (thematic mechanics)

| DLC | Content added | -> Archetype unlocked |
|---|---|---|
| **Leviathans** | Guardians/space monsters, enclaves (Curators/Artisans/Traders), War in Heaven | Leviathan hunting / PvE |
| **Synthetic Dawn** | Machine Intelligence empires, Determined Exterminator / Driven Assimilator / Rogue Servitor | Machine empires (robots/AI) |
| **Distant Stars** | Anomalies, L-Cluster/L-Gates, unique systems, creatures | Exploration (weak build signal) |
| **Ancient Relics** | Archaeology sites, relics, Remnants origin, precursors | Archaeology / relics |
| **First Contact** | Pre-FTL/primitive gameplay, cloaking, first-contact protocols, Payback/Broken Shackles origins | Stealth / primitive observation |
| **Astral Planes** | Astral rifts (expeditions), astral actions ("spells"/buffs), Riftworld origin | Rift explorer / astral "magic" |
| **Cosmic Storms** | Galactic storms (weather), storm chasing, storm tech | Storm-focused build |
| **Grand Archive** | Specimens/collection, menagerie, exhibiting creatures | Collector / archivist |

### Species packs (portraits + a few civics/traits/origins)

| DLC | Content added | -> Archetype unlocked |
|---|---|---|
| **Plantoids** | Plant/fungoid portraits, Budding trait, phototrophic | Plant empire (pop growth) |
| **Humanoids** | Humanoid portraits, Clone Army origin `?`, mercenaries | Clone army `?` |
| **Lithoids** | Mineral species (eat minerals, slow growth), Terravore (devouring hive), Calamitous Birth | Lithoid empire / terravore |
| **Necroids** | Necrophage origin (convert pops), Reanimators, death theme | Necrophage / necromancer |
| **Aquatics** | Ocean Paradise origin, Anglers civic, Hydrocentric ascension perk, ocean worlds | Aquatic empire / ocean tall |
| **Toxoids** | Overtuned origin (trait points), Knights of the Toxic God, toxic-world tolerance | Overtuned min-max / toxic knights |
| **Infernals** (4.2) | Infernal species, hell/brimstone theme, dedicated origins/civics | Infernal empire |
| **Shadows of the Shroud** (4.1) | Psionic machines, Shroud-Forged origin, Shroud mechanics for gestalts | Psionic machines / Shroud |
| **Nomads** (4.4) | Nomadic empires (arks, no fixed capital), Voidfarers/Heirs of the Khan/Sacred Path/Forever Cruise origins | Nomadic empire |

### Cosmetic / immersion packs
Anniversary Portraits, Horizon Signal, various Species/Creatures/Ruler/Namelist
packs, Rick the Cube, music packs. **No gameplay impact -> out of scope for the
finder.**

---

## 5. Next steps

1. Cluster the "archetype unlocked" column into the tree's top-level branches
   (~10-12 archetypes; many species packs are variations of the same one).
2. Verify the `?` items in the DLC map.
3. Commit to a backbone (experience-first vs archetype-first).
4. Draft the full tree (markdown first, for review / community feedback), with
   leaves marked "existing build #X" or "TO CREATE".
5. Encode the tree in `build_finder_tree.json` and assign build IDs.
6. Build a coverage report (script: tree + DB -> list of leaves with 0 builds)
   to materialize the build-creation roadmap.
7. Create the missing builds to fill empty leaves.

---

## 6. Open questions

- Backbone: experience-first or archetype-first?
- Target depth / leaf budget (how many builds are we willing to author to fill
  the tree)?
- Should some archetypes be reachable directly (a "browse by archetype" shortcut)
  in addition to the guided flow?
- Multiplayer vs single-player: a real axis, or just a tag on results?

---

## 7. Prior art & external references

Nobody publishes exactly the tree we want, but three reusable structures from
the community, combined, give most of the skeleton:

1. **Origin tier lists** — the best "list of all the content". Every origin,
   ranked. Origins are a good proxy for DLC content, so these enumerate leaf
   candidates and tell us which are strong vs weak.
2. **Strategic-orientation frameworks** — several guides organize builds by *how
   you win*: conquest / research / diplomacy / economy / expansion (+ tall vs
   wide). This is the mid-tree "win condition" axis, already validated by the
   community.
3. **"Meta builds" playlists/lists** — curated panels of concrete builds, one per
   niche (e.g. Montu Plays' Meta Builds playlist: Clone Army Rush, etc.). These
   are essentially ready-made hardcoded leaves we can adapt.

**Working hypothesis for the tree:** it is roughly the cross product of
**(strategic orientation) x (empire archetype / origin)**, and the tier lists
tell us which cells are worth a leaf (strong/popular) vs which to skip or mark
"for fun".

Useful search keywords (the thing has no standard name): "meta builds",
"origins tier list", "build compendium", "builds by playstyle".

References (may be a patch or two behind — still a good starting point):

- EarlyGuides — Best Stellaris Builds Ranked (by strategic orientation + tier):
  https://earlyguides.com/stellaris/builds
- Montu Plays — YouTube channel (tier lists for origins/civics/ethics/traits/
  traditions/APs) and "Stellaris Meta Builds" playlist:
  https://www.youtube.com/@MontuPlays
- Steam guide — "Guide to Traits, Ethics, Origins, Civics, Traditions and APs"
  (built on Montu's tier lists):
  https://steamcommunity.com/sharedfiles/filedetails/?id=3403418321
- FantasyWarden — Best Origins ranked:
  https://fantasywarden.com/games/stellaris-origins
- GameRant — 21 Best Origins:
  https://gamerant.com/stellaris-best-origins/
- Steam — community "Build Idea List" thread (references stellaris-build.com):
  https://steamcommunity.com/app/281990/discussions/0/597392228959157545/
- Stellaris Wiki — Beginner's guide (empire archetypes / playstyles):
  https://stellaris.paradoxwikis.com/Beginner%27s_guide

---

## 8. Ideas from external brainstorm (ChatGPT)

An external brainstorm (ChatGPT) produced a large candidate questionnaire.
Distilled below: what converges, what is genuinely new and worth adopting, and
where it conflicts with our locked decisions.

### Convergences (validate our direction)
- "Players don't look for a build, they look for an experience; describe the
  experience, then deduce the build." Matches our content-tour vision.
- Inspiration from RPG/character configurators (D&D class, WoW race, MTG deck,
  LoL hero): ask "how do you want to play?", never "which class?".
- **"Why are you relaunching Stellaris today?"** — flagged as "probably the most
  orienting question". This is exactly our intent-first Q1. Strong candidate
  options: try an ascension / play the new DLC / tired of classic empires / want
  lots of war / monstrous economy / play the Crisis / hard start / max narrative
  events / an empire that changes a lot start-to-end / start weak and become a
  war machine.

### New ideas worth adopting (compatible with the strict tree)
- **Fantasy as a translation layer.** Let the player pick a *fiction* (Borg /
  Tyranids / Protoss / Necrons / Romulans / Jedi / space dwarves / pirates /
  ancient civ / rogue AI / explorers / merchants / nomads / parasites...) and
  **translate it into a mechanical archetype** (Borg = machine assimilator,
  Tyranids = devouring hive, etc.). Bridges our many roleplay builds (Sith,
  Jedi, Scrin, Doom, Mass Effect, WoW, Subnautica) into the archetype tree.
- **Return 3 recommendations instead of 1:** *Best match* / *Original
  alternative* (same playstyle, different mechanic) / *Surprising pick* (they
  wouldn't have thought of it but it fits). Compatible with hardcoded leaves:
  just order/tag the 3 `build_ids` per role. Avoids everyone landing on the same
  result.

### Its full candidate axis list (for picking OUR questions, not to adopt wholesale)
Experience level; what you want (simplest / easy-but-strong / original / very
technical); main objective; empire type; fantasy; play style (expansion / tall /
many colonies / few / vassals / federation / isolation / exploration);
diplomacy (pacifist<->genocidal); victory condition; ascension; **mechanic to
discover (multi-select: megastructures, espionage, vassals, federations,
archaeology, relics, Shroud, nomads, crisis, cosmogenesis, biogenesis, titans,
colossi, mercenaries, cosmic storms, astral rifts...)**; DLC (auto-filled);
difficulty (Civilian..Grand Admiral); game length (short/standard/long);
management complexity (relax<->optimize); originality (classic / a bit different
/ completely WTF); build-or-scenario.

### Conflict to keep in mind
ChatGPT's design is ~15 categories with **multi-select and sliders** — that is a
**score/filter questionnaire (Model 2)**, which we deliberately rejected in favor
of a **strict hardcoded tree**. We cannot encode 15 multi-select axes in a strict
tree without leaf explosion. So: use this list as **inspiration to pick our 5-7
tree questions**, not as a spec to implement. Same trade-off as before.

> Note: if we ever reconsider Model 2/3 (scoring), this axis list + the
> 3-recommendation idea would be a strong basis for it.

### Reddit post ?

Hey r/Stellaris,
▎
▎ I help run a free, no-ads community build-sharing site, and I'm adding a "Find Your Build" feature: answer a few questions, get build recommendations. I'm torn between two ways to design the questions and would love your take.
▎
▎ Approach A — describe the experience you want
▎ The idea: players don't want "a build", they want an experience. So ask about that.
▎ Example flow:
▎ 1. Why are you booting up Stellaris today? (finally try an ascension / play the newest DLC / tired of classic empires / want a war-heavy game / build a monstrous economy / play as the Crisis / a brutally hard start)
▎ 2. Any fantasy in mind? (the Borg → machine assimilator, Tyranids → devouring swarm, merchants, explorers, space pirates, a rogue AI…)
▎ 3. Relax or min-max?
▎ → then 3 picks: best match, an original alternative, and a "surprise" you might not have considered.
▎
▎ Approach B — pick the mechanics directly
▎ More pragmatic and precise, closer to how build guides are already organized.
▎ Example flow:
▎ 1. Empire type: normal / hive mind / machine intelligence / megacorp
▎ 2. Ascension path: genetic / cybernetic / synthetic / psionic / don't care
▎ 3. Species base: biological (food) / lithoid (minerals) / machine (energy)
▎ 4. Win condition: military conquest / tech rush / economy & trade / diplomacy / tall
▎ → build recommendations.
▎
▎ Where I'd love your input:
▎ 1. Which would actually help you more — A (experience/fantasy), B (mechanics), or a mix (e.g. start with A, refine with B)?
▎ 2. If a tool asked you 3–5 questions, what would they be — and which comes first (the one that narrows it down the most)?
▎ 3. Fantasy → build: which iconic fictions should map to which archetypes? (Necrons? Protoss? Romulans? space pirates?)
▎ 4. Which gameplay niches feel underserved by existing build guides?
▎
▎ I'll compile the answers and share the resulting questionnaire back here. Cheers!
▎
▎ TL;DR: making a questionnaire that recommends a build. Should it ask about the experience you want (A), or the mechanics like origin/species/ethics (B)? What would your questions be?