# TODO

Notes for work that needs the machine with a Stellaris installation available
(extraction re-runs, in-game validation). Everything marked "offline" can be done
from any checkout.

---

## 1. BUG: `OR` requirements are extracted as `NOT` (inverted meaning)

**File:** `data-extractor/extract_civics_and_origins.py`, `extract_requirements()` (~lines 69-104)

Two bugs stacked on top of each other.

**Bug A - inverted operator.** `OR` and `AND` are handled in the same branch as
`NOT` and `NOR`, and the branch always emits `NOT`:

```python
elif key == 'ethics':
    for ethic_key, ethic_val in value.items():
        if ethic_key in ['NOT', 'NOR', 'OR', 'AND']:      # OR lumped with NOT
            requirements.append(f"NOT {ethic_val['value']}")
```

So `OR` ("at least one of these") becomes `NOT` ("none of these"). The requirement
is extracted with the opposite meaning.

**Bug B - Python repr leaking into the data.** An `OR` block contains several
`value = ` keys, so `paradox_parser` returns a list. The f-string then interpolates
a Python list repr into the requirement string, producing something no evaluator
can parse:

```json
"origin_sacred_path":       { "possible": ["NOT ['ethic_spiritualist', 'ethic_fanatic_spiritualist']"] }
"origin_heirs_of_the_khan": { "possible": ["NOT ['ethic_militarist', 'ethic_fanatic_militarist']"] }
```

**Confirmed wrong.** The wiki (https://stellaris.paradoxwikis.com/Origin) states that
The Sacred Path *requires* Spiritualist and Heirs of the Khan *requires* Militarist.
The extracted data says the opposite.

**Scale:** 148 broken predicates across 115 of the 292 entries (~39%), including 26
origins. Detect them with:

```bash
cd backend/data/versions/4.4
python3 -c "
import json
for f in ['origins.json','civics.json']:
    for x in json.load(open(f)):
        for k in ['potential','possible']:
            for p in x.get(k) or []:
                if isinstance(p,str) and p.startswith('NOT ['):
                    print(f, x['id'], k, repr(p))
"
```

**Affected origins:** common_ground, cybernetic_creed, endbringers, forever_cruise,
fruitful, hegemon, heirs_of_the_khan, here_be_dragons, machine, mechanists,
mindwardens, ocean_machines, post_apocalyptic, primal_calling, sacred_path, scion,
shattered_ring, shroud_forged, shroudwalker_apprentice, storm_chasers,
syncretic_evolution, synthetic_fertility, treasure_hunters, unplugged, void_machines,
wilderness.

**Fix:** rewrite `extract_requirements()` to keep the operator (`OR` / `AND` / `NOT` /
`NOR`) and emit a structured predicate instead of a flat string. Then re-run extraction
for all three versions (4.2, 4.3, 4.4) - this needs the game files.

Note: the broken JSON cannot be repaired by post-processing alone. `OR` and `NOR` both
collapse to `NOT [...]`, so the original operator is unrecoverable from the output. The
wiki can disambiguate the 26 origins, but not the 89 civics. Re-extraction is the only
complete fix.

**Do not hand-edit the JSON files** - they are generated (see CLAUDE.md).

---

## 2. Use cwtools-stellaris-config as the reference for the rule grammar

https://github.com/cwtools/cwtools-stellaris-config

Community-maintained `.cwt` schema files describing every valid field of every
Stellaris `common/` file. It documents the *shape* of the rules, not their content -
the content stays in the game files and in our extracted JSON. Useful because it gives
the exhaustive, closed list of what a requirement block can contain, so the extractor
and the evaluator can be checked for completeness instead of guessed at.

**Key files:**

| File | What it gives us |
|---|---|
| `config/common/governments.cwt` | civic/origin schema, and `alias[government_trigger:*]` (lines ~621-935) = the complete requirement DSL |
| `config/common/traits.cwt` | trait schema (archetypes, opposites, cost) |
| `config/common/ethics.cwt` | ethics schema |
| `config/common/species_consolidated.cwt` | species classes and archetypes |
| `config/prescripted_countries/prescripted_countries.cwt` | schema of the empire design file - see section 3c |

**The requirement DSL has 16 predicate forms**, each accepting `value` / `OR` / `NOT` /
`NOR`:

```
authority   country_type   ethics    civics     traits    preferred_planet_class
graphical_culture   origin   species_class   species_archetype
OR   AND   limit   host_has_dlc   always   text
```

Our extractor currently handles 5 of them (`species_archetype`, `ethics`, `authority`,
`civics`, `origin`). The wiki's Government modding page claims only 6 exist - it is
incomplete, trust the schema.

**Civic/origin fields we are not extracting at all** (they exist in the game files):

```cwt
starting_colony = <planet_class>          # homeworld forced by the origin (Ocean Paradise)
soft_traits = { trait = ... }             # enforced traits that CAN be removed
habitability_preference = <planet_class>  # climate preference override
```

Also missing from extraction entirely: trait points/picks budget per archetype
(`common/species_archetypes/`), the hidden baseline class traits (`trait_organic`,
`trait_lithoid`, `trait_machine_unit`, `trait_hive_mind` - currently filtered out as
non-player-selectable), and the authority-to-archetype link (MACHINE archetype forces
`auth_machine_intelligence`; this is not in `authorities.txt`).

**Caveat:** the `.cwt` config may lag behind the newest patches. Nomads-era fields
(`is_nomadic`, ark ship sizes) may be absent - verify against the game files rather
than assuming the schema is exhaustive for 4.4+.

---

## 3. Build rule validation

Goal: one shared evaluator for the requirement DSL, called from three places. The
rule data already lives in `backend/data/versions/<X.Y>/*.json`
(`potential`, `possible`, `enforced_traits`, `allowed_archetypes`, `opposites`,
`required_ethics`, `blocked_ethics`) - no game files needed at runtime.

Blocked on section 1 for correctness: validating against inverted requirements would
produce wrong verdicts.

### 3a. Audit existing builds (offline)

Script that runs every build in `backend/stellaris_builds.db` through the evaluator and
reports violations per build. Answers the open question: how many builds on the site are
actually invalid, and which rules do they break. Read-only, no schema change.

Decide afterwards what to do with the invalid ones (flag in UI, notify author, leave
as-is).

### 3b. Validate before submit

Wire the same evaluator into `BuildForm.tsx` (and server-side in `POST /api/builds` -
client-side validation alone is not enforcement). `canSelectCivic()` and friends already
do part of this by hand; replace them with the shared evaluator so there is one source
of truth.

Server-side matters: builds can be posted directly to the API.

### 3c. Validate the export to `user_empire_designs_v3.4.txt`

Two independent failure modes, currently conflated - keep them separate when debugging:

1. **Format / unknown values** - the design is rejected at parse time. This is the
   likely cause of the current import failures.
2. **Rule violations** - the design parses but shows as invalid in the empire designer.

Important: the design file is *more permissive* than the empire creation screen. Per
https://stellaris.paradoxwikis.com/Custom_empire_designs_editing, a mismatched
authority/ethics combination does not invalidate a design, and contradictory ethics are
accepted. Pick counts *are* enforced ("the game will not allow empires exceeding their
default pick numbers"). So an import failure is probably a bad value, not a bad build.

**Placeholder values in the export that need verifying against
`prescripted_countries.cwt` and the game files:**

| Field in the export | Current value | Schema expects | To check |
|---|---|---|---|
| `government` | `"gov_fallback"` | `<government>` | does this key exist? |
| `name_list` | `"HUM1"` | `<name_list>` | valid for non-human species classes? |
| `room` | `"default_room"` | `icon[gfx/portraits/city_sets]` | must be a real file in city_sets |
| `leader_class` | `"official"` | `enum[leader_classes]` | leader classes changed in 4.x |
| `graphical_culture` | `"humanoid_01"` | `<graphical_culture>` | valid key? |
| `planet_class` | `pc_continental` / `pc_ocean` / `pc_ark` | `<planet_class.habitable_planet>` | is `pc_ark` in that subtype? |
| `ship_size` | `"<ark>_tier_1"` | not in the schema | undocumented field, verify it is real |
| `is_nomadic` | `yes` / `no` | not in the schema | same |
| `empire_flag` icon/background | fixed dds filenames | folder + file | must exist on disk |

Schema constraints worth asserting in the export:

```cwt
civics = { ## cardinality = 2..2 }        # exactly 2 civics
ethic = <ethos>   ## cardinality = 0..3   # at most 3 ethics
trait = <trait.species_trait>             # species block: species traits only
trait = <trait.leader_trait>              # ruler block: leader traits only
```

**Also:** the hardcoded `ORIGIN_MANDATORY_TRAITS` table and `getClassMandatoryTraits()`
in `frontend/src/pages/BuildDetail.tsx` duplicate the `enforced_traits` field that is
already present in `origins.json`. Drop the hand-written tables and read the data.
Note that `soft_traits` (section 2) is a separate, removable set - do not merge the two.

### 3d. Use the game as a batch validation oracle (needs the game)

`error.log` in `Documents/Paradox Interactive/Stellaris/logs/` reports precise parse
failures for the design file (for example `invalid planet class pc_pd_mesa from
user_empire_designs_v3.4.txt`). Workflow: paste N generated designs into the file,
launch the game to the empire selection screen, quit, read `error.log`. That validates
N builds in a single pass and is the only access we have to the real validator.

**Confirmed empirically (2026-08-10):** the file is parsed very early during game
load - errors show up in `error.log` seconds after the mod-loading messages, well
before the empire selection screen. Launching to the main menu and quitting is
enough; no need to click through to empire creation. This makes full automation
plausible (launch via Steam URI, sleep N seconds, kill process, read log) instead
of manually clicking through the UI each time - see the CWTools discussion earlier
in this project's history for a lighter-weight *syntax-only* pre-check that needs
no game launch at all.

**Gotcha hit in practice:** `user_empire_designs_v3.4.txt` can already contain many
vanilla/prescripted empire blocks (`key="PRESCRIPTED_..."` placeholders, real
`government`/`room`/`leader_class` values) that look superficially similar to our
generated ones. Don't assume line numbers in an error alone identify *our* export -
confirm by grepping for markers unique to our generator (`"Fix Me"`, `gov_fallback`)
or the exact build name before diagnosing an error as ours.

Useful as a regression test for the export once 3c is done.
