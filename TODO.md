# TODO

Notes for work that needs the machine with a Stellaris installation available
(extraction re-runs, in-game validation). Everything marked "offline" can be done
from any checkout.

---

## 1. DONE (4.2, 4.3, 4.4 - all versions) - `OR`/`NOR` requirements were extracted as `NOT`

Fixed in `extract_civics_and_origins.py`. `extract_trigger_info()` now emits a
structured predicate tree (`{"all"/"any"/"not"/"always"/"field"}`) instead of flat
strings, covering all 16 predicate forms (was 5). Re-extracted and verified against
the wiki for the 26 previously-known-wrong origins, zero `"unsupported"` shapes across
the whole civics/origins dataset.

Re-extracted for 4.3 and then 4.2 (2026-08-10) by switching the Steam beta branch
(Properties > Betas - any past patch level is directly selectable, no special key
needed; patch-level differences like 4.2.4 vs 4.2.0 don't matter, the site only
tracks major.minor). Same structured format confirmed correct on both (spot-checked
`origin_hegemon`, `origin_syncretic_evolution` - note the civics referenced by that
origin's anti-genocidal check are *different* per version, real historical content
drift, not a copy-paste). Species archetype trait budgets confirmed identical across
all three versions (actually re-extracted each time, not assumed).

All three versions now audit cleanly with the fixed format - `backend/check_build_rules.js
audit` checks the whole DB with no more "unverified data" caveat on any build.

---

## 2. DONE - cwtools-stellaris-config gaps closed

https://github.com/cwtools/cwtools-stellaris-config `config/common/governments.cwt`
`alias[government_trigger:*]` documents the 16 predicate forms; our extractor now
handles all of them (was 5).

Also extracted, previously missing: `starting_colony`, `habitability_preference`,
`soft_traits` (origins), species archetype trait point/pick budgets
(`extract_species_archetypes.py`), and authority `potential`/`possible`
(`extract_authority_rules.py` - this includes the archetype-authority link: Machine
Intelligence requires `species_archetype: MACHINE`, Hive Mind requires `NOT MACHINE`).
All three integrated into `extract_all.py`.

**Still not extracted:** the hidden baseline class traits (`trait_organic`,
`trait_lithoid`, `trait_machine_unit`, `trait_hive_mind`) remain filtered out as
non-player-selectable. Low priority - they're auto-assigned, never a player choice.

**Caveat still applies:** the `.cwt` config may lag behind the newest patches -
verify against game files rather than assuming the schema is exhaustive for 4.4+.

---

## 3. Build rule validation

### 3a. DONE - Audit existing builds (offline)

`backend/check_build_rules.js audit` runs every non-deleted build through the shared
evaluator (`backend/rules/predicateEvaluator.js`) and reports violations. Also
`check <build.json>` / `check-id <id>` for single builds.

Findings so far, not yet acted on: **26 of 65 builds have 3 civics** (game only
allows 2 - see below, form bug now fixed but existing builds not retroactively
touched), plus assorted individual rule violations (wrong ethics for an authority,
wrong civic for a species archetype, etc.) surfaced by `audit`.

### 3b. PARTIALLY DONE - Validate before submit

Done: a non-blocking "Possible Rule Conflict" warning on `BuildForm.tsx` submit and
on `BuildDetail.tsx`'s export modal, checking origin/authority/civics `possible` +
`potential`, civic count, trait budget, and trait/archetype compatibility. Shown once
the whole build is filled in (checking mid-form would misfire - origin is picked
before ethics/authority/civics).

**Remaining:**
- `canSelectCivic()` and friends in `BuildForm.tsx` still do their own hand-rolled
  checks (points/ethics budgets only) - not replaced by the shared evaluator. The
  warning added is *additive*, not a replacement of the live selection logic.
- **No server-side enforcement.** `POST /api/builds` accepts anything - a build can
  be posted directly to the API bypassing the client-side warning entirely. The
  warning is currently pure UX, not validation.
- Two real bugs found by testing exports in-game, now fixed, but worth remembering
  as the kind of thing this validation is supposed to catch going forward:
  `MAX_CIVIC_SLOTS` was 3 instead of 2 (`common/defines/00_defines.txt`
  `GOVERNMENT_CIVIC_POINTS_BASE = 2`), and species trait filtering only blocked
  Machine-tagged traits from non-Machine species, never biological-only traits from
  Machine species.

### 3c. PARTIALLY DONE - Validate the export to `user_empire_designs_v3.4.txt`

Fixed: `leader_class` now derived from the selected ruler trait's actual allowed
class (was hardcoded `"official"`, wrong for e.g. Warlike which is commander-only).
Civic count fixed at the source (3b), so new exports won't have 3 civics either.

**Still unverified** in the placeholder table (`BuildDetail.tsx`
`buildEmpireDesignText()`):

| Field | Current value | To check |
|---|---|---|
| `government` | `"gov_fallback"` | does this key exist? |
| `name_list` | `"HUM1"` | valid for non-human species classes? |
| `room` | `"default_room"` | must be a real file in city_sets |
| `graphical_culture` | `"humanoid_01"` | valid for non-humanoid species classes? |
| `planet_class` | `pc_continental`/`pc_ocean`/`pc_ark` | is `pc_ark` a real habitable subtype? |
| `ship_size` | `"<ark>_tier_1"` | undocumented field, verify it's real |
| `empire_flag` icon/background | fixed dds filenames | must exist on disk |

Also still open: the hardcoded `ORIGIN_MANDATORY_TRAITS` table and
`getClassMandatoryTraits()` in `BuildDetail.tsx` duplicate the `enforced_traits`
field already present in `origins.json` - drop the hand-written tables and read the
data instead. `soft_traits` is a separate, removable set - don't merge the two.

Known false-positive-adjacent edge case: `origin_legendary_leader`'s 3 late-game
story variants (`_death`/`_imperial`/`_dictatorial`) are correctly excluded from
`origins.json` (self-referential `potential`, `random_weight = 0` - not real
creation-time choices), but a couple of authority rules reference those specific ids
by name and can never match our merged generic id. Narrow, rare.

`host_has_dlc` and non-`"default"` `country_type` are not meaningfully checked
(assumed satisfied) - no way to know which DLC a build's author owns.
`limit`-scoped sub-triggers (scope changes) are marked unsupported, treated as
satisfied rather than evaluated.

### 3d. DONE (methodology confirmed) - Use the game as a validation oracle

Confirmed empirically (2026-08-10) by testing 4 real builds against the actual game:
`error.log` (`.../OneDrive/Documents/Paradox Interactive/Stellaris/logs/` on this
machine - Documents is OneDrive-redirected, easy to check the wrong path) is parsed
very early during load, well before the empire selection screen - launching to the
main menu and quitting is enough. This makes batch automation plausible (launch via
Steam URI, sleep N seconds, kill process, read log) instead of clicking through the
UI each time.

**Gotcha confirmed in practice:** `user_empire_designs_v3.4.txt` can already contain
many vanilla/prescripted empire blocks (`key="PRESCRIPTED_..."` placeholders, real
`government`/`room`/`leader_class` values) that look superficially similar to our
generated ones. Confirm an error belongs to *our* export by grepping for markers
unique to our generator (`"Fix Me"`, `gov_fallback`) or the exact build name, not by
line number alone.

Found and fixed 2 real bugs this way (leader_class mismatch, trait/archetype
mismatch) that static analysis alone had missed.

**Not yet done:** actually running this as an automated regression test (script the
launch/kill/read-log loop) - still manual today.
