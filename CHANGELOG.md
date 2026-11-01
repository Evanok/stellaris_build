# Changelog

History of shipped work on stellaris-build.com, newest first. Each entry keeps
the context, decisions and gotchas from the time it was built; `CLAUDE.md` only
describes the current state of the project and points here when the history of
a feature matters.

Add new entries at the top: `## <Title> (YYYY-MM-DD)`.

## Latest Build Comments on the Feedback page (2026-11-01)

- New sidebar widget under the community chat: the 10 latest comments across all builds, newest first
  ("author on build", relative time, 2-line excerpt). A click opens the build on that comment
  (`/build/:id#comment-:commentId`, scroll + highlight already handled by `BuildComments.tsx`). Polls every 60 s.
- `GET /api/comments/recent`: visible comments on visible builds only, excerpt cut server-side (160 chars).
- The Feedback sidebar is now sticky only on large screens, with its own scroll when taller than the viewport
  (otherwise the widget under the chat was unreachable until the bottom of the page). On mobile it stacks at the
  bottom, after the feedback list.
- Analytics event `recent_comment_click`.

## Faster deploys: dependency reuse (2026-11-01)

- `deploy.conf` splits `INSTALL_CMD` (npm ci) from `REMOTE_BUILD`; with `REUSE_DEPS`, the deploy kit copies the
  live release's `node_modules` when the lock, the `package.json` files and the node version are unchanged.
- Skips the ~7 min sqlite3 compile on most deploys (a dependency change still runs the full `npm ci`).

## nginx config through the deploy kit (2026-11-01)

- `infra/nginx/stellaris-build.conf` moved to `deploy/nginx.conf`; `infra/deploy_nginx.sh` replaced by
  `./deploy.sh nginx` / `./deploy.sh nginx-diff` (same safety: previous file restored if `nginx -t` fails).
- `infra/fetch_prod_db.sh` read the old checkout's database, frozen since the migration: now reads
  `~/apps/stellaris_build/shared/backend/db/`, host from `deploy/.env`.

## Deploy kit migration prep (2026-11-01)

- Deploys move to the shared deploy kit (`./deploy.sh` from the dev machine, `deploy/deploy.conf`):
  release directories in `~/apps/stellaris_build`, shared state (`backend/.env`, `backend/db/`, `cache/`,
  `import_archive/`), pre-deploy backup, health check on real data, automatic rollback.
  `deploy/staging.conf` rehearses the migration on :3002 without touching production.
- `backend/dbPath.js`: `DB_PATH` / `SESSIONS_DIR` (defaults unchanged). Paths no longer depend on the
  working directory, which removes the "stray empty DB at the repo root" failure mode.
- `generate-version.cjs` takes `DEPLOY_LATEST_TAG` / `DEPLOY_REVISION` / `DEPLOY_COMMIT_DATE` (a release
  has no `.git`).
- `backup_db.sh`: shared paths, `predeploy` mode, configurable Drive target (`STELLARIS_GDRIVE_DIR`).
- nginx: static files from `current/` with fallback to Node (no 404 on new asset hashes during a deploy);
  `infra/deploy_nginx.sh` restores the previous config if `nginx -t` fails.
- `frontend/public/googlecd04003f2c5c632e.html` (Search Console verification) committed: it only existed
  on the server and would have been lost with the old checkout.

## Changelog split out of CLAUDE.md (2026-11-01)

- The "Recent Completions" section of `CLAUDE.md` (about 60% of the file) moved here unchanged, headings
  shifted up one level. `CLAUDE.md` now only describes the current state.

## Build Comments, Third Civic, How to Play Guide, Markdown, Signup Protection (2026-10-31)
Mostly from community feedback (Feedback page suggestions).

**Build comments** (`components/BuildComments.tsx`, routes in `backend/index.js` "Build comments"):
- Flat list at the bottom of every build page, login required to post (visitors see them + a login link that brings them back via `setPostLoginRedirect`). Quote button: `quote_id` must be a visible comment of the same build; the excerpt is resolved at read time, so deleting a comment also blanks it in quotes ("Quoted comment was deleted")
- **Only admins delete** (soft delete). Authors cannot - decided on purpose; moderation goes through reports
- **Report**: flag button for logged-in users on others' comments, admin emailed with the text and two links (`/build/:id#comment-:cid`, which `BuildComments.tsx` scrolls to once comments load, and `/admin/pending`). Reported comments are listed on the Moderation page; admins also see a red "Reported (N)" badge + Dismiss in place. **Nobody but admins sees reports, and the author is never told** - decided on purpose
- Not shown in the moderator preview of pending builds. No notification to the build author yet

**Third civic** (`builds.third_civic`): the game allows 2 civics at creation, a third slot unlocks later. In `BuildForm.tsx` a third check fills it once 2 starting civics are picked ("3rd civic - unlocked later, not exported" badge). Shown with a badge on the build page, **never exported**, rule-checked with all 3 civics (form warnings + `check_build_rules.js`). Backend rejects a third civic equal to a starting one. Legacy builds with 3 starting civics are **not migrated**: displayed as before, and the edit form moves `civics[2]` into the third slot so the author can confirm on save

**How to Play guide** (`builds.guide`): optional markdown field, 20k chars, separate from the 5k-char description so a long guide does not push the build data down the page (it renders in its own card below the traits/civics/traditions). Sanitized like `description`. Both textareas block at the limit with a `123/5000` counter (backend validates the raw length, before HTML escaping, so the two always agree). The empty-description warning on create still fires even when a guide is filled

**Markdown**: description was already markdown but nothing said so; now hinted under both fields, and `remark-gfm` adds tables (Bootstrap dark `table-responsive`), strikethrough, task lists and autolinks. Links in user markdown open in a new tab with `nofollow`. Prod: `npm install` after pull (new dependency)

**Signup protection**: `registerLimiter` + honeypot on `/auth/register` (see Authentication System). A per-IP comment limit was considered and dropped (redundant once account creation is limited)

**Home cards blur fix** (`pages/Home.css`): hover used `scale(1.02)` on a `will-change`/`translateZ(0)` layer, which resamples the rasterized card (blurry text/icons). Now `translateY(-3px)`, which stays sharp

**Search Console** (API access, details in `CLAUDE.local.md`): the data lives in the **URL-prefix** property `https://stellaris-build.com/`; the domain property `sc-domain:stellaris-build.com` (added 2026-10-30) is empty - do not delete the URL-prefix one. Traffic peaked June-July 2026 (4.4/Nomads), ~-30% since August with stable positions (demand, not a penalty). Biggest unexploited queries: "stellaris <origin name>" (thousands of impressions at position 8-9, served by single build pages) - per-origin landing pages were proposed and declined for now

**Key files:** `frontend/src/components/{BuildComments,MarkdownText,HoneypotField}.tsx`, `frontend/src/pages/{BuildDetail,PendingBuilds,Login,Home}.tsx`, `frontend/src/pages/Home.css`, `frontend/src/BuildForm.tsx`, `frontend/src/components/{AuthModal,Navbar}.tsx`, `backend/index.js`, `backend/security.js`, `backend/database.js`, `backend/check_build_rules.js`

## Imports, Guest Mode Review Fixes, Admin Stats, Test Suite (2026-10-19)

**Empire designs import** (`import_empire_from_designs.py`): now also extracts `portrait` (species block only, the ruler has its own), `planet_class` and `graphical_culture` (top-level keys, anchored so `city_graphical_culture` does not match). The file is still `user_empire_designs_v3.4.txt` in 4.5 (`v3.4` is the format version, hard-coded in `stellaris.exe`). `ImportEmpireDesigns.tsx` lists a copyable path per OS: Windows uses `%USERPROFILE%\Documents\...` (the file picker expands it; paste it in "File name", not the address bar, which opens the file instead). A web page cannot choose the folder the picker opens in; `showOpenFilePicker` (`startIn: 'documents'`) was tried and dropped: Chromium only, Brave disables it.

**Save import** (`import_build_from_save.py`), several bugs on recent saves:
- Keys were searched in a fixed 50k-line window after `country=`; the player country is ~70k lines in a late save, so traditions/perks were missed. Now bounded to the exact country 0 block (`find_block_end()`)
- Ethics are now a list (`ethics={ "ethic_a" }`), the old `ethic="..."` regex found nothing. Both formats work; `ethics` is always in the output (the backend finds the JSON by that key)
- Tradition trees come from `<tree>_adopt` entries (ids can contain `_`, e.g. `tr_cybernetics_assimilator`)
- `trait_infernal` filtered (automatic trait of the INF class, `initial = no`, not in `traits.json`)
- New fields: portrait, homeworld `planet_class` (species `home_planet`, both `home_planet=<id>` and `{ reference=<id> }` formats), `graphical_culture`
- **Disk leak fixed**: each import unzipped ~100 MB into `backend/uploads/.cache_<random name>`, never reused nor deleted. Now a `TemporaryDirectory`. Prod `backend/uploads` was 8 KB (save imports barely used), nothing to clean
- Validation read `backend/data/*.json` (pre-versioning path); now the latest `backend/data/versions/X.Y/`
- `ImportSave.tsx` warns that a save holds the empire at that date: civics/traits/ethics gained in game must be removed

**Portraits**: `GET /api/species-classes` drops portrait ids with no PNG in `frontend/public/portraits/` (only `lith_human_inf` and `default_robot` as of today), and `BuildForm.tsx` clears a selected portrait the picker does not offer - before, it showed a selection on an invisible thumbnail.

**Rule check false positive**: `BuildForm.tsx` (submit) and `BuildDetail.tsx` (export) built the evaluator context without `species_class`, so every "requires species class X" predicate failed (20 in 4.5, e.g. Cosmic Dawn requires INF). `check_build_rules.js` already passed it.

**`£blocker£` in origin texts** (Cosmic Dawn, Buried Lithoids...): `clean_localized_text()` stripped icons before resolving `['concept_...']` references, whose text brings them back; markup is now stripped again afterwards. 4.5 re-extracted (only those 5 lines changed); 4.2-4.4 cannot be re-extracted (game versions not installed), the token was removed from their `origins.json` directly.

**Check Build button** next to Submit in `BuildForm.tsx`: same checks as submit (blocking issues + experimental rule warnings), results only, never submits.

**Admin stats**: removed "Top Traffic Sources" and the `trackPageView` middleware (5 paths only, no bot filter, an SQLite write per page load - GA does it better); added the guest build cards and chart (see Pages).

**Guest mode review fixes** (code review of PR #12): limiter reservation, email cap, atomic approval, one name rule (see Guest submission flow below), claim race (a 0-row claim UPDATE re-checks whether the build already belongs to the caller before answering "claimed by another account"), unguarded `localStorage.removeItem` after a successful guest submit (showed "Network error" and invited a duplicate), navbar count endpoint. Not fixed on purpose: claim token sent to GA in the `/claim/:token` page path (only the owner has GA access), auto-claim on a shared browser.

**Tests**: the whole Playwright suite passes (55/55, ~1 min). Fixed stale tests: Resources page title, civic image test reading `potential` as the pre-2026-08 flat-string format, empire designs fixture with 5 ethics points, save submit test now on `test2.sav` (`test1.sav` really holds a gestalt empire with an extra ethic, which rightly disables Submit). `playwright.config.ts` had `timeout: 0`: a selector that no longer exists hung the run forever; now 3 min per test. Gotcha: on branches without `isLocalRequest()`, repeated local runs hit `importLimiter` ("Too many imports") - restarting the backend resets the in-memory counters.

## Publishing Without an Account + Moderation + Hardening (2026-10-19)
Follow-up of the funnel work below: the last barrier was the login itself.

**Guest submission flow:**
- `BuildForm.tsx` runs every check first (missing fields, URLs, empty description, rule warnings), then, if not logged in, opens `AuthModal.tsx`, which offers "Publish without an account" in create mode -> `GuestSubmitModal.tsx` (name + optional email + hidden honeypot) -> `POST /api/builds/guest` -> `/build-submitted`.
- Guest name: same format as display names (3-30, `[a-zA-Z0-9_-]`). Guest names may repeat (one visitor, several builds).
- **One name rule at every step** (registration, display name change, guest submission, guest approval): `findRealAccountByName()` - unique among real accounts (`provider != 'guest'`), username or display_name, case-insensitive. A guest never blocks a real account: when an account takes a name a guest uses, `releaseGuestName()` renames the guest account to `<name> (guest)` (and an approval whose pseudo was taken in the meantime credits `<name> (guest)` directly). Typical case: a guest registers their own pseudo, then claims, and the emptied guest account is deleted. Known gap: Google/Steam accounts still get the provider's name at creation without this check
- Nothing is public before approval: the build sits in `pending_builds`. On approval it is inserted into `builds` (shared `insertBuild()` helper with `POST /api/builds`) under a guest user for the name (`findOrCreateGuestUser()`), or directly under the account that already claimed it.
- The moderator gets an email per submission (SMTP + `ADMIN_EMAIL`, already set in prod); the queue is `/admin/pending`. Mail failures are logged, never fail a request.

**Claiming** (proof of authorship = owning the secret token; only its sha256 is stored):
- The token is kept in localStorage (`utils/guestClaims.ts`): when the visitor signs in on the same browser, `App.tsx` claims automatically and shows a banner. **Never for admin accounts**: an admin enters builds on behalf of others (e.g. a Reddit author credited as a guest, then sent the claim link by DM), and logging in on that browser would take them over; their tokens stay untouched.
- It is also shown as a `/claim/:token` link on the confirmation page and, if an email was given, emailed right away; a second email is sent on approval. The approval email cannot repeat the link (hash only), it points back to the first one.
- Claim before approval -> published under the account. After -> the build moves off the guest user, which is deleted once it has no build left (frees the name).

**Security hardening:**
- The backend listened on every interface, so Node could be reached directly, bypassing nginx and forging `X-Forwarded-For`. It now binds to `127.0.0.1` (`BIND_HOST`), and nginx/Vite target `127.0.0.1:3001` explicitly.
- The limiters' localhost bypass used `req.hostname` (spoofable via `X-Forwarded-Host`, see Authentication System); now `isLocalRequest()` on `req.ip`, also applied to `importLimiter`/`guestSubmitLimiter` so local testing never hits their quotas.
- **Prod deploy order:** `infra/deploy_nginx.sh` (new `proxy_pass`) **before** restarting the app on the loopback bind. Afterwards `curl http://<server-ip>:3001/api/test` from outside must fail.

**GA:**
- New events: `build_submitted_guest` (key event), `build_claimed` (`source`: auto/link), and the form funnel `build_form_started` -> `build_form_invalid` (`reason`, `missing_fields`) / `build_form_warning` (`warning`) -> `build_auth_prompt` -> `build_guest_started` / `build_submit_error` (`status`, `guest`). Funnel events carry `form_mode` (manual/import) and `logged_in`, and are not sent in edit mode.
- All their parameters are registered as GA custom dimensions.

**Key files:** `backend/index.js` (guest/moderation/claim routes, `insertBuild()`, emails, `BIND_HOST`), `backend/security.js` (`isLocalRequest`, `guestSubmitLimiter`), `backend/database.js` (`pending_builds`), `frontend/src/BuildForm.tsx`, `frontend/src/components/AuthModal.tsx`, `frontend/src/components/GuestSubmitModal.tsx`, `frontend/src/pages/{GuestSubmitted,ClaimBuild,PendingBuilds,BuildDetail}.tsx`, `frontend/src/utils/{guestClaims,moderation}.ts`, `frontend/src/App.tsx`, `frontend/src/components/Navbar.tsx`, `infra/nginx/stellaris-build.conf`, `frontend/vite.config.ts`

## Google Analytics Clean-up + Build Creation Funnel (2026-10-19)
Started from a GA4 audit (Data API, via a service account - access details in `CLAUDE.local.md`).

**Audit findings worth remembering:**
- GA "users" are browser cookies, not people nor accounts: ~24.5k GA users all-time vs 211 real accounts (2026-10-19).
- ~500 "users"/month from Singapore (+ some China) were bots: 1 session each, ~4s, ~39% engagement.
- ~70% of traffic is organic search. Most "Direct" traffic is bots or links clicked in apps (Discord, Steam client...), which send no referrer - UTM-tagging our own links was considered and dropped (nobody on our side posts links).
- Create funnel, 90 days: 391 visitors on `/create/manual` -> 17 published builds (~4%). Empire designs imports convert ~50% (12 uploads -> at least 5 builds, matched from pm2 logs) but were barely used, partly because they required a login up front.

**GA (`frontend/index.html`, `components/GoogleAnalytics.tsx`, `utils/analytics.ts`):**
- gtag.js is only injected after a human signal (pointer/key/scroll/touch/wheel, or 5s of *visible* page time) and never for `navigator.webdriver`; `gtag()` calls are queued in `dataLayer` meanwhile. Production domain only (see Testing).
- `send_page_view: false` on `config`: the landing page was counted twice (automatic + manual page_view).
- The manual page_view waits (max 1.5s) for react-helmet-async to update `<title>`, which used to report the previous page's title.
- Custom events through `trackEvent()` (typed list in `utils/analytics.ts`): `build_created` (`method`: manual/import_save/import_designs), `build_updated`, `build_exported`, `rating_submitted`, `search`, `filter_used` (`filter_type`/`filter_value`, home filters + resource categories), `login`/`sign_up` (`method`; for Google/Steam it is the click, success happens on the provider side), `feedback_opened`, `feedback_submitted`, `chat_message_sent`, `comment_posted` (`build_id`), `resource_clicked`, `build_import_uploaded` / `build_import_empire_selected` (`method`, `result`, `error_status`, `empire_count`; sent for every upload, published or not). Events right before a full page load use `trackEventThenNavigate()` (waits for GA, max 500ms).
- Event parameters only show in GA reports once registered as custom dimensions/metrics (GA Admin > Custom definitions) - done for all of the above; `build_created` and `sign_up` are key events. **A new event parameter needs the same registration.**

**SEO fix:** the home page JSON-LD `ItemList` linked to `/builds/:id` (plural, no such route; Google indexed it as blank pages). Fixed to `/build/:id`, and the backend 301-redirects `/builds/:id` -> `/build/:id`.

**Build creation funnel** - ask for effort only once the work is done:
- `/create` and the "Create Build" navbar link are public; home hero has a "Share your build" CTA. Imports are listed first.
- File imports no longer need a login (see the import endpoints in API Endpoints for the abuse limits).
- `BuildForm.tsx` asks for a login only after every validation step. **Bug fixed:** an anonymous visitor who filled the form then picked Google/Steam in the auth modal came back on `/` and silently lost the build - the draft (`stellaris_build_draft` in localStorage) was only restored for the in-modal email login. Now `AuthModal.tsx` stores a post-login redirect (`/create/manual` for import pages, whose upload step does not survive a reload) and `BuildForm.tsx` restores the draft on mount when logged in. The portrait was also missing from the draft.

**Security:** removed `PATCH /api/builds/:id` - unused by the frontend and unauthenticated, anyone could rewrite any build's description.

**Key files:** `frontend/index.html`, `frontend/src/components/GoogleAnalytics.tsx`, `frontend/src/utils/analytics.ts`, `frontend/src/utils/postLoginRedirect.ts`, `frontend/src/pages/CreateChoice.tsx`, `frontend/src/BuildForm.tsx`, `frontend/src/components/AuthModal.tsx`, `frontend/src/App.tsx`, `backend/index.js`, `backend/security.js`

## Ship Appearance / Shipsets (2026-10-17)
Builds can record their ship appearance (`graphical_culture`, optional).

- **No 2D picture exists in-game** (the shipset picker is a live 3D view), so previews are rendered
  from the game's models: `data-extractor/pdx_mesh.py` reads the binary `.mesh` format and rasterizes
  it with numpy (texture + one light, no empire color tint - each set encodes its color mask
  differently, a tint attempt was unreliable). One ship per set: the corvette's default section
  (`CORVETTE_MID_S3`) for mechanical sets, the Mauler for biological ones; 3/4 side view, bow left,
  like the in-game thumbnails. 320x160 WebP, ~10 KB each, `frontend/public/icons/shipsets/`.
- **List = the in-game picker, checked against screenshots**: graphical cultures of species classes
  playable at creation, in species class file order, Biological sets first; only sets with their own
  ships (Solarpunk/Wilderness borrow others via `fallback` and are hidden in-game too). Names are the
  species class names (IMPERIAL -> "Imperial" for nemesis_01, MACHINE -> "Machine" for synthetics_01).
  Model resolution: entity (`*_entities.asset`) -> pdxmesh -> `.mesh`, with `.gfx` `meshsettings`
  overriding textures (Psionic/Mindwarden have no texture in the mesh itself).
- **Rules**: only the existing `graphical_culture` predicates (Wilderness requires a Biological set,
  Red Giant forbids them...). Both evaluators are now **three-valued**: a condition on an optional
  field the build left unset (`graphical_culture`, `preferred_planet_class`) is unknown, not false -
  this removed 3 false positives from the audit (Wilderness / Shared Genetics builds were flagged for
  "requiring" a Biological set they had no way to pick). Live picker filtering in `BuildForm.tsx`
  (`utils/shipsetRules.ts`), submit/export warnings, `check_build_rules.js`.
- **Export**: `graphical_culture` = the pick (default `humanoid_01`), `city_graphical_culture` = the
  same set unless it has no cities (Imperial, Mindwarden -> `humanoid_01`).
- **DB**: `builds.graphical_culture TEXT` (auto-migrated). Not shown on home cards yet.

## Homeworld Planet Class + Predicate Extractor Fix + 4.5.2 Data (2026-10-17)
Builds can now record their homeworld planet class (optional).

- **Data**: new `data-extractor/extract_planet_classes.py` (in `extract_all.py`) -> `planet_classes.json`;
  icons sliced from `planet_type_big_icons.dds` by `extract_icons.py` into `frontend/public/icons/planets/`
  (76px). Traits gained `allowed_planet_classes` (Aquatic = ocean, nomad traits = ark), civics/origins
  gained `granted_traits` (Anglers / Ocean Paradise grant Aquatic). Origins already had
  `habitability_preference` (forced planet) and the `preferred_planet_class` predicate field.
- **Rules** (`frontend/src/utils/planetRules.ts`, mirrored in `backend/rules/planetRules.js`):
  effective planet = `pc_ark` if Nomadic, else the origin's `habitability_preference`, else the pick.
  Unknown planet = no planet check at all. Species classes can add/remove pickable planets
  (`common/species_classes/` `added_planet_types`/`removed_planet_types` -> `only_species_classes`/
  `excluded_species_classes`): Volcanic is **Infernal-only** (not a DLC thing - the user owns all DLC
  and never sees it otherwise), and Infernals lose the 3 cold worlds; the picker mirrors the game
  (Volcanic column takes the Cold slot). Origin-forced planets bypass this (Red Giant -> Volcanic for
  any species, grid shown locked like in-game). Checked live in `BuildForm.tsx` (incompatible planets
  disabled with the reason as tooltip; incompatible traits/civics/origins hidden or disabled), at
  submit, in the `BuildDetail.tsx` export warnings, and by `check_build_rules.js`.
- **Home cards**: 40px homeworld icon next to the portrait (`icons/home/pc_*.webp`, generated by
  `extract_icons.py` with the other home webps). `enrichBuild()` returns `homeworld`/`homeworld_name`
  = effective planet, so builds saved before `planet_class` existed still show their origin-forced
  planet (Void Dwellers, Red Giant...). Hidden for Nomadic builds (their ark icon already shows).
- **Origin images were stretched**: the game's origin illustrations are 220x115, but `extract_icons.py`
  forced them to 256x256. Now extracted at native size (`origin_original`), minis are 64px square center
  crops (`origin_mini`). Same filenames + nginx's 30-day `immutable` cache on `/icons` -> URLs carry
  `?v=2` (`frontend/src/utils/assetVersions.ts`, bump it when regenerating). **Prod deploy:** also
  `rm backend/cache/og/*.jpg` - OG previews cached the stretched origin medallion, and the OG
  fingerprint does not cover image content (lazy re-render, safe to delete).
- **DB**: `builds.planet_class TEXT` (auto-migrated). Stores the effective planet. Export writes it as
  `planet_class`, falling back to the previous ocean/continental default when unset.
- **Extractor bug fixed** (`extract_civics_and_origins.py` `_normalize_field_value`): a field block
  mixing operators (`civics = { NOR = {...} NOT = {...} }`) kept only ONE operator, picked from a Python
  `set` - so which conditions survived changed with the per-process hash seed. Now all are kept, and
  re-extraction is deterministic (verified with two different `PYTHONHASHSEED`). Example of what was
  lost: Fanatic Purifiers' "requires Fanatic Xenophobe". **4.2-4.4 data still has this bug** - fixing
  it needs those game versions checked out via Steam betas.
- **4.5 data re-extracted from 4.5.2** (installed version). Besides the restored conditions, real hotfix
  changes are text-only plus `ap_hydrocentric`'s potential (also accepts Wet Climate cyborg mods).
  `LATEST_GAME_VERSION.patch` still says 4.5.0.
- Known gap: `NOT = { value = A value = B }` (e.g. Syncretic Evolution) - the game README says NOT takes
  a single value, so semantics are unclear; we keep the lenient NOT(A AND B) reading.

## Build Tags + Difficulty Rename + Stats Fixes (2026-10-10)
Triggered by community feedback: the difficulty scale mixed build power (Overpowered/Strong/
Balanced) with play difficulty (Challenging/Extreme).

- **Difficulty**: relabelled to a single Very Easy -> Very Hard axis. DB values unchanged
  (`overpowered`=Very Easy ... `extreme`=Very Hard). Labels/colors centralized in
  `frontend/src/utils/difficulty.ts` + `components/DifficultyBadge.tsx`.
- **Build tags**: 13 hardcoded tags, single source of truth `shared/build_tags.json` (ids,
  labels, descriptions, groups, max 4 per build, mutually exclusive pairs). Backend
  `security.js` whitelists ids on POST/PUT; frontend reads the same file via
  `utils/buildTags.ts`. Stored as CSV of ids in the pre-existing `builds.tags` column (it had
  existed since the initial scaffold but never had a form input - only the 7 seed builds #2-#8
  had free-text tags). Never rename a tag id, only labels/descriptions.
  `GET /api/builds?tag=<id>` filters; home has a tag filter + "What do the tags mean?" modal.
- **Prod deploy step**: `cd backend && node migrate_build_tags.js` (dry run) then `--apply`
  converts the legacy free-text tags of the seed builds. Idempotent.
- **Stats**: top contributors exclude admins (`is_admin = 1`) and use `display_name`; the
  version pie always shows the 4 most recent game versions (from `VERSION_NAMES` in `Stats.tsx`)
  individually and lumps the rest into "Older"; a recent version with 0 builds is hidden rather
  than shown as 0%. Previously it showed the 5 *most popular*, so 4.5 (5 builds) was hidden
  inside "Other".

## Stellaris 4.5 "Cygnus" Support (2026-09-23)
Re-extracted all game data for 4.5 and wired it through the site (data folder, backend version
constants, BuildForm default, home/stats filters, home badge, `llms.txt`, news item).

**Cygnus is a pure balance patch — zero new content.** No new traits, civics, origins, ethics,
ascension perks or authorities (counts identical to 4.4: 186 traits, 234 civics, 58 origins, 17
ethics, 46 perks, 7 authorities); `species_classes.json`, `authorities.json` core fields and the
species archetype trait budgets came back byte-identical. No new trait file to register in
`extract_traits.py`, and no new icons needed.

**What did change — rule rebalancing, which the site's filters and rule warnings enforce:**

> **Correction (2026-10-17):** the "7 civics swapped" claim below is WRONG - it was an artifact of an
> extractor bug (see "Homeworld Planet Class" below): blocks mixing operators kept only one of them,
> chosen at random. Beacon of Liberty, for instance, requires Egalitarian AND not Xenophobe. The Hard
> Reset point is wrong too (it still requires Militarist). Only the Storm Chasers / Knights of the
> Toxic God `is_nomadic` points may be real; not re-verified.

- **7 civics swapped a positive ethics requirement for a negative one** (from "requires X" to
  "forbids Y"), i.e. they're now available to far more empires: Beacon of Liberty and Worker
  Cooperative (were Egalitarian-only -> now just not-Xenophobe), Barbaric Despoilers and Void
  Reavers (were Militarist/Authoritarian/Xenophobe -> now just not-Xenophile), Crusader Spirit and
  Letters of Marque (-> not-Pacifist), Scorched World Heralds (was Xenophobe -> not-Pacifist).
- **Hard Reset** (`origin_unplugged`): Militarist requirement dropped, replaced by NOT fanatic
  Spiritualist / NOT fanatic Xenophile.
- **Storm Chasers** and **Knights of the Toxic God** lost their `is_nomadic = false` restriction —
  both are now playable by nomadic empires.
- Cosmetic/text only: 1 ethic (`ethic_gestalt_consciousness` `use_for_pops` false -> true), 4 traits
  (effect wording; Incubators gained two `opposites`), Ocean Paradise / Subaquatic Machines now
  list their granted species trait, and one tradition's modifier is now extracted
  (`leader_initial_traits_add +1`, `ascension_perks_add +1`).

**Two maintenance bugs found and fixed while doing this:**
- `extract_ruler_traits.py` doesn't emit the `icon` field, so copying its fresh output over
  `ruler_traits.json` silently drops all 10 ruler-trait icons. Re-injected from 4.4; documented as
  a gotcha in the version-upgrade process above.
- `backend/index.js` contained a **literal NUL byte** (a raw `\0` separator inside the OG-image
  fingerprint's `join()`), which made `grep` treat the whole file as binary and silently return no
  matches — `grep -n AVAILABLE_DATA_VERSIONS backend/index.js` found nothing despite the constant
  being right there. Replaced with the `'\u0000'` escape: identical at runtime (so no OG cache
  churn), but the file is text again. Use `grep -a` if this ever recurs.

**Also:** the 4.5 news item is deliberately title-only, so `NewsItem.description` became optional
(`description?: string`) rather than being removed — existing items keep their description.

**Key files:** `backend/data/versions/4.5/`, `backend/index.js`, `backend/check_build_rules.js`,
`frontend/src/utils/gameVersion.ts`, `frontend/src/BuildForm.tsx`, `frontend/src/pages/Home.tsx`,
`frontend/src/pages/Stats.tsx`, `frontend/public/llms.txt`

## Structured Rule Extraction + Trait Budget Fix + Export Warnings (2026-08-10)
Civics/origins requirement extraction had a real bug: `extract_civics_and_origins.py`'s
`extract_trigger_info()` handled only 5 of the 16 predicate forms in the government
trigger DSL (see `cwtools-stellaris-config` `config/common/governments.cwt`), and
collapsed `OR`/`NOR` into `NOT` - inverting the meaning for 148 predicates across 115
civics/origins (confirmed against the wiki: Sacred Path was extracted as requiring
*not* Spiritualist, when it actually requires it).

**1. Rewrote the extractor** to emit a structured predicate tree instead of flat
strings: `{"all"/"any"/"not"/"always"/"field"}` nodes, covering all 16 predicate
forms. Root is always `{"all": [...]}` for a consistent shape. Unrecognized shapes
are marked `{"unsupported": ...}` rather than silently dropped or mis-encoded.
Re-extracted `backend/data/versions/4.4/{civics,origins}.json` (4.2/4.3 NOT
re-extracted yet - old flat-string format there, evaluator treats it as always-satisfied
since it doesn't match any node shape, i.e. under-enforces rather than misfires).
Also extracts 3 previously-missing origin fields: `starting_colony`,
`habitability_preference`, `soft_traits`.

**2. Authorities have the same rule DSL** (`common/governments/authorities/00_authorities.txt`
uses an identical `possible`/`potential` structure) but had **no extractor at all** -
`authorities.json` was hand-maintained and its `required_ethics`/`blocked_ethics`
fields didn't match the real rules (e.g. Democratic's actual rule is "NOT gestalt,
NOT authoritarian, NOT fanatic_authoritarian", not "requires Egalitarian"). New
`extract_authority_rules.py` extracts just `potential`/`possible` and merges them into
the existing hand-maintained `authorities.json` (every other field untouched).
Confirmed the archetype-authority link exists in-game after all: Machine Intelligence
requires `species_archetype: MACHINE`, Hive Mind requires `NOT MACHINE`.

**3. Species archetype trait budgets were wrong for MACHINE/ROBOT.** BuildForm.tsx
hardcoded 2 trait points / 5 max traits for every species. Real budgets (from
`common/species_archetypes/00_species_archetypes.txt`, confirmed in-game): BIOLOGICAL/
LITHOID/PRESAPIENT 2/5, **MACHINE 1/5, ROBOT 0/4**. New `extract_species_archetypes.py`,
new `species_archetypes.json` per version, new `GET /api/species-archetypes`.
BuildForm.tsx's `MAX_TRAIT_POINTS`/`MAX_TRAIT_COUNT` are now computed from the
selected species' actual archetype. Caught a real pre-existing invalid build on first
audit run (a Machine-species build spending 2 points against a 1-point budget).

**4. Civic count was flat-out wrong: `MAX_CIVIC_SLOTS = 3` in `BuildForm.tsx`, but
`GOVERNMENT_CIVIC_POINTS_BASE = 2` in `common/defines/00_defines.txt` (confirmed
in-game by trying to select a 3-civic build in the empire selector - it's invalid).
Found by testing an actual export in-game, not by static analysis. **26 of 65
published builds (40%) have 3 civics** and are technically invalid. Fixed
`MAX_CIVIC_SLOTS` to 2 (a handful of narrative/mid-game-only civics - Great Khan's
Vision, Galactic Sovereign, Psionic Sovereign - grant +1 via
`country_government_civic_points_add`, but those aren't real creation-time picks, so
this stays a flat constant rather than dynamic like the trait budget). Existing
3-civic builds are not retroactively modified - the fix only prevents new ones and
surfaces a warning (see point 6) when viewing/editing/exporting an old one.

**5. All extraction pieces integrated into the real `extract_all.py` pipeline**, not
one-off scripts - re-running `extract_all.py` on a fresh checkout regenerates
everything including the authority rules and archetype budgets (authority rules
auto-merge into the backend's `authorities.json` if it already exists there; for a
brand-new version, prints the manual merge command since `authorities.json` doesn't
exist yet at that point in the version-upgrade process - see "Process for a new
Stellaris version" above).

**6. Non-blocking "Possible Rule Conflict" warning**, both at `BuildForm.tsx` submit
and in `BuildDetail.tsx`'s export modal (same check, re-run independently since export
is a separate action from submit). Evaluates the completed build's origin/authority/
civics (`possible` AND `potential`), civic count, and trait budget against a shared
evaluator (`frontend/src/utils/ruleEvaluator.ts`), shown as plain-English messages
(e.g. `Authority "Democratic" requires none of: ethic "Gestalt Consciousness", ethic
"Authoritarian", ethic "Fanatic Authoritarian"`) resolved from already-loaded game
data, not raw ids. Only checked once the whole build is filled in (submit/export
time) - origin is picked *before* ethics/authority/civics in the form, so a full
evaluation against a partial build would misfire on fields not chosen yet; the live
origin/civic filters use a narrower `findFieldOccurrences()` helper instead
(existence/polarity check, no full context needed).

**7. Standalone-ish CLI** `backend/check_build_rules.js` (`check <build.json>` /
`check-id <id>` / `audit`) - a Node script sharing `backend/rules/predicateEvaluator.js`
with the audit tooling, not a true compiled binary (deliberately not pursued further -
see git history if reconsidering). Reads `GET /api/builds/:id`'s `{build: {...}}`
wrapper, `GET /api/builds`'s `{builds: [...]}` wrapper, or a bare build object.

**8. Two more bugs found by actually testing exports in-game** (not by static
analysis - see the export-testing gotcha below for how):
- **Ruler `leader_class` was hardcoded to `"official"`** regardless of the chosen
  ruler trait. Each of the 3 leader classes (official/commander/scientist) has its
  own allowed traits (`leader_class` field, already extracted in `ruler_traits.json`) -
  e.g. `trait_ruler_warlike` (Warlike) is commander-only, so a build using it exported
  with a class/trait mismatch. Fixed: `BuildDetail.tsx`'s export now reads the selected
  ruler trait's actual `leader_class` and uses that (falls back to `"official"` only
  when no ruler trait is set - a ruler still needs some class to exist).
- **Species traits were only filtered one-way for archetype compatibility.**
  `BuildForm.tsx`'s trait list checked "hide MACHINE-tagged traits from non-machine
  species" but never the reverse, so BIOLOGICAL/LITHOID-only traits (e.g. Very Strong,
  Solitary) stayed selectable - and selected - for a MACHINE species build,
  confirmed invalid in-game (empire creator flags "portrait conflicts with selected
  traits"). Fixed: `filteredTraits` now checks the trait's real `allowed_archetypes`
  both ways (empty list = universal, only 1 vanilla trait is like that). Same
  double-check pattern added to the submit/export warnings and `check_build_rules.js`.

**Known limitations, not yet fixed:**
- `origin_legendary_leader`'s 3 late-game story variants (`_death`/`_imperial`/
  `_dictatorial`) are correctly excluded from `origins.json` (self-referential
  `potential`, `random_weight = 0` - not real creation-time choices), but authority
  rules that reference those specific ids by name (e.g. Democratic's origin exclusion
  list) can never match our merged generic id. Narrow, rare edge case.
- `host_has_dlc` and `country_type` beyond `"default"` are not meaningfully checked
  (assumed true) - no way to know which DLC a build's author owns.
- `limit`-scoped sub-triggers (scope changes, e.g. planet/pop scope) are marked
  unsupported and treated as satisfied rather than evaluated.
- 4.2/4.3 still have the old flat-string predicate format - re-extraction needs
  those game versions checked out via Steam (Properties > Betas), not done this session.
- Secondary species traits (`filteredSecondaryTraits` in `BuildForm.tsx`, for origins
  like Necrophage/Syncretic Evolution) aren't filtered by archetype at all yet - no
  secondary species class selector exists to know which archetype to filter against
  (pre-existing TODO, not addressed this session).

**Export-file testing gotcha:** `user_empire_designs_v3.4.txt` accumulates real
Stellaris design blocks over time and can already contain many vanilla/prescripted
empires (`key="PRESCRIPTED_..."` placeholders, real `government`/`room`/`leader_class`
values) that look superficially similar to what this site generates. When checking
`error.log` for a specific build's export, don't trust a line number alone - confirm
the block belongs to *this* export by grepping for markers unique to our generator
(`"Fix Me"`, `gov_fallback`) or the exact build name. Confirmed the game parses this
file very early during load (errors appear in `error.log` seconds after mod-loading
messages, well before the empire selection screen) - reaching the main menu and
quitting is enough to trigger validation.

**9. Re-extracted 4.3 after switching the Steam beta branch** - confirmed the fixed
extractor produces the same correct structured format there too (spot-checked
`origin_hegemon`/`origin_syncretic_evolution`), and that authority rules and species
archetype trait budgets are identical to 4.4 (previously only assumed/copied - now
actually verified). Only `civics.json`/`origins.json`/`authorities.json` changed;
`traits`/`ethics`/`traditions`/`ascension_perks`/`species_archetypes` came back
byte-identical. 4.2 still not done (needs that version checked out separately).

**10. Bug in the new trait/archetype check itself:** builds with no `species_class`
set (13 of 65 - mostly the site's earliest builds, October 2025, predating the
Species Portrait System feature from 2026-06-07) got every archetype-restricted trait
flagged as a false violation, because an unmapped species class resolves to
`species_archetype: undefined`, and `undefined` trivially fails `allowed.includes(...)`
for any non-empty restriction list. Fixed by only running the trait/archetype check
when the archetype is actually known, in both `check_build_rules.js` and
`BuildForm.tsx` (`BuildDetail.tsx`'s export check was already correctly guarded).

**Key files:** `data-extractor/extract_civics_and_origins.py`,
`data-extractor/extract_authority_rules.py`, `data-extractor/extract_species_archetypes.py`,
`data-extractor/extract_all.py`, `frontend/src/utils/ruleEvaluator.ts`,
`backend/rules/predicateEvaluator.js`, `backend/check_build_rules.js`,
`frontend/src/BuildForm.tsx`, `frontend/src/pages/BuildDetail.tsx`,
`backend/data/versions/{4.3,4.4}/{civics,origins,authorities,species_archetypes}.json`

## Social Link Previews (2026-08-10)
Pasting a build URL into Slack/Discord/Reddit showed the generic site title, the generic description, and **no image at all**. Two independent bugs:

1. **Per-build tags were invisible to crawlers.** `BuildDetail.tsx` sets `og:title`/`og:description` through `react-helmet-async`, i.e. in the browser. The SPA fallback serves raw `index.html`, and link-preview crawlers do not execute JavaScript, so they only ever saw the site-wide tags. This did not show up in Search Console because Google *does* run JS.
2. **`og-image.jpg` did not exist.** `index.html` referenced `https://stellaris-build.com/og-image.jpg`; the file was in neither `frontend/public/` nor `frontend/dist/` — a 404 on every page.

**Fixes, in three parts:**

**1. Static OG image** — `frontend/public/og-image.jpg` (1200x630). Regenerate with `python3 scripts/make_og_image.py <loading_screen.webp> frontend/public/og-image.jpg` (requires Pillow). Needs `npm run build -w frontend` to reach `dist/`.

**2. Server-side meta injection** (`backend/index.js`) — the catch-all now branches on `/build/:id` (numeric only): it queries the build, rewrites `<title>`, `description`, canonical and all `og:`/`twitter:` tags in the HTML, then sends it. React still hydrates and re-applies its own tags. Everything else keeps the previous `sendFile` behaviour untouched.
- `index.html` is memoized and re-read only when its mtime changes (frontend rebuild), so this adds no per-request disk read
- Build `name`/`description`/`game_version` are stored **HTML-escaped** by `sanitizeString()` in `security.js`, so `decodeStoredEntities()` decodes them before they are re-escaped into attributes — otherwise a quote reaches the crawler as `&amp;quot;`
- Every failure path (missing build, soft-deleted build, DB error, injection error) falls back to the untouched `index.html`

**3. Per-build generated image** (`backend/ogImage.js`, needs `sharp`) — 1200x630 JPEG: darkened loading screen background (picked deterministically by build id), build name, origin, authority, ethics, version, author, and a round medallion on the right.
- Text goes through sharp's `text` input (**Pango**), not SVG `<text>`: real word wrapping, and the rendered height comes back so blocks stack without guessing glyph widths
- **Medallion cascade:** species portrait -> origin illustration (`icons/origin_original/`) -> nothing. Only 6 of 49 builds have a portrait set, so the origin fallback is what most previews show; all origins in use have an icon, so every build gets a visual. Both sources are opaque rectangles, hence the circular mask
- **Cache:** `backend/cache/og/{id}-{fingerprint}.jpg` (gitignored). The fingerprint is a sha1 of the fields *drawn in the image* — `description` is excluded on purpose so rewording it does not churn the cache. `og:image` points at that exact filename, which is the only reliable way to bust the per-URL caches Slack/Facebook keep. Editing a build yields a new URL; the stale file is deleted on the next render
- Generation is **lazy** (first request for the image URL), not at submit/edit: no backfill needed, builds that are never shared cost nothing, and a render failure can never break build creation. Cold ~80ms locally, warm 2ms. Concurrent crawlers on a cold build are deduped via an in-flight Map; writes go to a temp file then `rename` so no crawler reads a partial file

**Prod requirement:** text rendering needs fontconfig to find a font. `fc-list | grep -ci dejavu` must be > 0, else `sudo apt install fonts-dejavu-core`. Without it, images render **without text and without erroring**. Also needs `npm install` after pull (sharp ships ~28MB of native binaries).

**Already-shared links** keep showing the old preview until the platform's cache expires; force revalidation via https://www.opengraph.xyz/ or Facebook's Sharing Debugger.

**Also fixed:** the stale `Browse 12+ builds` claim in `index.html` (both `description` and `og:description`), and the meta description shortened from ~250 to 159 chars so Google stops truncating it.

**Key files:** `backend/ogImage.js`, `backend/index.js`, `scripts/make_og_image.py`, `frontend/public/og-image.jpg`, `frontend/index.html`, `.gitignore`

## Server Perf + Public Repo Hardening (2026-07-07)
Diagnosed intermittent home page freezes (site fully unresponsive while loading, images popping in one by one). Root cause: prod is a single 2-core box where SQLite session writes and static asset serving both compete for Node's 4-slot libuv threadpool.

**Fixes:**
- `UV_THREADPOOL_SIZE=8` default set in `backend/index.js` (before any async I/O)
- Both SQLite DBs switched to WAL mode: `stellaris_builds.db` via `PRAGMA` in `backend/database.js`, `sessions.db` via `concurrentDb: true` on the `connect-sqlite3` store in `backend/index.js`
- nginx now serves `/icons`, `/portraits`, `/loading_screens`, `/assets` directly from disk instead of proxying through Node — see `infra/nginx/stellaris-build.conf` (tracked, mirrors prod) and `infra/deploy_nginx.sh` (deploys + `nginx -t` + graceful reload, needs `PROD_HOST` env var)

**Icon pipeline gap fixed:** `icons/home/*.webp` (20x20, used by home page cards) were never auto-generated for new DLC content — only `icons/{civics,traits,ethics,authorities}/*.png` (32px, build page) were. `data-extractor/extract_icons.py` now generates both together for every extraction run; backfilled 14 civics + 6 traits missing from the Nomads DLC (e.g. `civic_flight_schools`).

**Public repo hardening** (repo is public): prod IP/SSH details moved out of `CLAUDE.md` into `CLAUDE.local.md` (gitignored, auto-loaded by Claude Code same as `CLAUDE.md`); added a "never commit" warning banner at the top of this file; infra scripts (`deploy_nginx.sh`, `fetch_prod_db.sh`) take the server address via `PROD_HOST` env var instead of hardcoding it.

**New script:** `infra/fetch_prod_db.sh` — pulls a consistent snapshot of prod's `stellaris_builds.db` (via `sqlite3 .backup`, safe on a live WAL DB) for local testing; never touches `sessions.db`; backs up the local DB before overwriting.

**Admin pages cleanup:** deleted `frontend/src/pages/AdminFeedback.tsx` and `GET /api/admin/feedback` — fully redundant, the public `/feedback` page already has admin-gated resolve controls hitting the same `PATCH` endpoint. `AdminStats.tsx` kept (shows data with no public equivalent: user counts, signups, referrers) but fixed a missing guard — it only checked login, not `is_admin`.

## Tips & Tricks Page — IN PROGRESS (2026-06-27)
Community tips page with upvote-only voting, version/category filtering, sort by top/new. Login required to post/vote.

**Status:** Database schema done, backend + frontend TODO.

**Database (done — `backend/database.js`):**
- `tips` table: `id, title, content, categories TEXT (CSV), game_version, author_id, author_name, deleted, created_at`
- `tip_votes` table: `id, tip_id, user_id, created_at` — `UNIQUE(tip_id, user_id)` enforces one vote per user per tip

**Backend (TODO — `backend/index.js`):**
- `GET /api/tips?version=&category=&sort=top|new` — joins with tip_votes for `vote_count` + `user_voted`
- `POST /api/tips` — isAuthenticated, validates title (non-empty), content (max 500 chars), version, categories
- `POST /api/tips/:id/vote` — isAuthenticated, toggle: DELETE if exists, INSERT if not, return new count
- `DELETE /api/tips/:id` — isAuthenticated, author or admin only, soft delete
- 11 categories: `Early Game, Population, Economy, Science, Military, Diplomacy, Optimization, Planet Management, Traditions & Perks, General, Nomads`
- `TIP_MAX_LENGTH = 500`

**Frontend (TODO):**
- `frontend/src/pages/Tips.tsx` — filter bar (version + category dropdowns, sort toggle top/new), tip cards with vote column (▲ + count) on left, submit form below filters (login-gated)
- Route `/tips` in `App.tsx` (lazy import)
- Nav link "Tips" in `Navbar.tsx` between Resources and Stats

**Tips data (TODO):**
- 31 tips to insert as Evanok22 (user_id=6): 10 nomadic (4.4) + 21 general (4.3)
- Script at `/tmp/claude-.../scratchpad/insert_tips.js` (may be gone — regenerate from session transcript if needed)

## Maintenance Mode Fix (2026-06-27)
Replaced the old maintenance scripts (which swapped the entire nginx config and required sudo interactively) with a simpler approach.

**How it works now:**
- nginx has a permanent `error_page 502 503 504 @maintenance` directive pointing to `frontend/public/maintenance.html`
- `enable_maintenance.sh` — just `pm2 stop stellaris-build`
- `disable_maintenance.sh` — just `pm2 restart stellaris-build`

**Prod nginx config change (one-time, already applied):**
```nginx
error_page 502 503 504 @maintenance;
location @maintenance {
    root /home/arthur/work/stellaris_build/frontend/public;
    try_files /maintenance.html =502;
}
```
Also required: `proxy_intercept_errors on;` inside `location /`, and the `sites-enabled/stellaris-build` must be a **symlink** to `sites-available/stellaris-build` (was a plain file — fixed).

## Nomadic Empire Feature (2026-06-27)
Added full support for the Nomads DLC nomadic empire mechanic.

**Database:**
- `is_nomadic INTEGER DEFAULT 0` and `ark_type TEXT` columns added to `builds` table via ALTER TABLE migrations (in `backend/database.js`)
- Existing builds retroactively non-nomadic via `DEFAULT 0`

**Backend:**
- POST and PUT `/api/builds` handle `is_nomadic` and `ark_type` fields
- New endpoint `GET /api/ark-types` serves `backend/data/ark_types.json` (non-versioned)
- `is_nomadic` and `ark_type` returned in `/api/builds` responses (`enrichBuild` passes them through)

**Data extraction (`data-extractor/extract_ark_types.py`):**
- Parses `common/ship_sizes/29_nomads_dlc_ships.txt` for `ship_modifier` blocks per type (civilian/science/military) and tier (I/II/III)
- Resolves `@scripted_variables` from `common/scripted_variables/`
- Uses `localization_parser.py` for display names and feature text
- Excludes `ship_starbase_stockpile_collection_rate_add` (shared by all types, not differentiating)
- Run: `python3 extract_ark_types.py "<stellaris_path>"` → `output/ark_types.json`
- Copy output to `backend/data/ark_types.json` after each Stellaris update
- Key files: `data-extractor/extract_ark_types.py`, `backend/data/ark_types.json`

**BuildForm (`frontend/src/BuildForm.tsx`):**
- `supportsNomadic(version)` helper: returns true only for version >= 4.4 (Nomads DLC)
- Nomadic section hidden entirely for builds < 4.4; reset automatically when user switches version down
- Card with `nomad_toggle.png` icon (64px), checkbox toggle, and ark type selector (3 buttons with tech icons)
- Per-tier modifier table shown when an ark type is selected (data from `/api/ark-types`)
- Nomadic section positioned above Authority selection
- Key icons: `frontend/public/icons/nomad_toggle.png`, `tech_{civilian,science,military}_arkship.png`

**BuildDetail (`frontend/src/pages/BuildDetail.tsx`):**
- Nomadic badge + ark type icon displayed if `is_nomadic` is set

**Home page cards (`frontend/src/pages/Home.tsx`):**
- `is_nomadic` and `ark_type` added to `Build` interface
- Nomadic empire icon + ark type icon displayed to the right of the portrait, same row, same size (40×40px)
- Icons are WebP at 40px: `frontend/public/icons/home/nomad_toggle.webp`, `tech_{civilian,science,military}_arkship.webp`

## SetEmailModal Per-User localStorage Fix (2026-06-27)
- Global key `skip_email_prompt` caused "don't show again" to bleed between accounts on the same browser
- Fixed to per-user key `` `skip_email_prompt_${user.id}` `` in both `SetEmailModal.tsx` and `App.tsx`
- Key files: `frontend/src/components/SetEmailModal.tsx`, `frontend/src/App.tsx`

## Home Page Performance Pass (2026-06-20)
Diagnosed with WebPageTest (waterfall analysis). Fixes applied in order of impact:

**1. Eliminated 18 redundant API calls on home page**
- Home page was calling `/api/origins`, `/api/ethics`, `/api/authorities` for every unique game version in the builds list (up to 6 versions = 18 requests, ~213KB)
- Fix: backend `enrichBuild()` resolves names at request time using in-memory maps loaded at startup
- `/api/builds` now returns `origin_name`, `authority_name`, `ethics_names` (Record<id,name>) directly on each build
- Frontend `Home.tsx`: removed `fetchForVersions`, all name lookup states, and the `useEffect` that triggered the cascade
- Key files: `backend/index.js` (`enrichBuild`, `_nameCache`), `frontend/src/pages/Home.tsx`

**2. Loading screens: JPEG → WebP + deferred load**
- Converted 19 loading screen JPEGs to WebP (quality 82): 8.1MB → 2.6MB (68% reduction)
- Deferred background load: `useState(null)` + `useEffect` so background sets after first render paint instead of blocking it
- Key files: `frontend/public/loading_screens/*.webp`, `frontend/src/App.tsx`

**3. Bootstrap Icons: CDN → local bundle**
- Bootstrap Icons was loaded from `cdn.jsdelivr.net` (external DNS + SSL handshake on every cold visit)
- Installed `bootstrap-icons` as a local npm dependency, imported in `main.tsx`
- Removed CDN `<link>` and `preconnect`/`dns-prefetch` hints from `index.html`
- Key files: `frontend/src/main.tsx`, `frontend/index.html`

**4. HTTP/2 enabled on nginx (server config only, no code change)**
- Certbot had generated `listen 443 ssl` without `http2` — all 116+ requests to stellaris-build.com were HTTP/1.1
- Changed to `listen 443 ssl http2` on prod server: `sudo sed -i 's/listen 443 ssl;/listen 443 ssl http2;/' /etc/nginx/sites-enabled/stellaris-build`
- Zero downtime (`nginx reload` is graceful)

**5. Server-side pagination, filtering and sorting on `/api/builds`**
- Previously: returned all builds at once (~100KB), frontend did client-side filter/sort/paginate
- Now: `GET /api/builds?page=1&limit=12&sort=newest&search=&difficulty=&version=` returns `{ builds, total, page, totalPages, availableVersions }`
- Version filter uses display names (e.g. "4.1 (Lyra)") — backend maps to all equivalent raw version strings via `_versionGroups`
- Frontend: `useEffect` on [page, debouncedSearch, difficulty, version, sort] → fetch. 300ms debounce on search. No client-side filter logic remains.
- `invalidateBuildsCache()` is now a no-op — home always fetches fresh data from server
- Key files: `backend/index.js` (`VERSION_NAMES_MAP`, `_versionGroups`, `/api/builds` handler), `frontend/src/pages/Home.tsx`

## Stats Page Improvements + Resources SEO (2026-06-19)

**Stats page — new stats:**
- Added "Builds by Game Version" card (full-width, side by side with Total Builds): groups `game_version` column, normalizes legacy freeform strings (strips trailing `+`, DLC suffixes) via `normalizeVersion()` in backend
- Added "Top 5 Most Popular Species Traits" bar chart (full-width, height 350px)
- `renderTopItemsChart` now accepts an optional `height` param (default 250)
- COLORS array extended to 5 entries; `VERSION_NAMES` mapping covers 4.4→3.13 (names sourced from `GAME_VERSIONS` in `BuildForm.tsx`)
- Backend: loads `traits.json` for name mapping; queries `game_version` (not `version` — correct column name) and `traits` columns
- Key files: `backend/index.js`, `frontend/src/pages/Stats.tsx`

**Resources page SEO:**
- Added Open Graph tags (`og:type`, `og:url`, `og:title`, `og:description`, `og:image`, `og:site_name`)
- Added Twitter Card tags
- Added JSON-LD `CollectionPage` + `ItemList` schema (built dynamically from `resourcesData` once loaded)
- Sitemap priority `0.6 → 0.8`, changefreq `monthly → weekly`
- Key files: `frontend/src/pages/Resources.tsx`, `backend/index.js`

## Community Chat on Feedback Page (2026-06-13)
- Added IRC-style chat panel as a sticky sidebar on the Feedback page (col-lg-8 feedback / col-lg-4 chat)
- New `chat_messages` SQLite table (content, author_name, author_id nullable, is_guest, deleted, created_at)
- Backend endpoints: `GET /api/chat` (last 100 msgs), `POST /api/chat`, `DELETE /api/chat/:id` (admin only)
- Rate limiting: 5 messages / 5 min per IP (guests) or user_id (logged-in), in-memory Map with auto-cleanup every 10 min
- Guest users: set a pseudo on first post, stored in `localStorage` as `chat_guest_name`, editable from the panel header
- Admin: red `×` button on each message triggers a Bootstrap modal confirmation before soft-delete
- Polling every 8 seconds; auto-scrolls to bottom only when already near the bottom
- Layout fix: page header (h2 + description) and tabs are full-width above the two-column grid so the chat top aligns exactly with the first feedback card
- Key files: `backend/database.js`, `backend/index.js`, `frontend/src/components/ChatPanel.tsx`, `frontend/src/pages/Feedback.tsx`

## Home Page Performance Optimization (2026-06-13)
- Removed `ReactMarkdown` from build card titles — was instantiating a full markdown parser × 12 cards per page
- Replaced stateful `IconWithFallback` (`useState`) with a stateless `<img onError→display:none>` — eliminated ~96 stateful React components per page load
- Removed `react-markdown` import from `Home.tsx`; the library is now only loaded lazily from `BuildDetail`
- HTTP caching for static assets already set to `maxAge: '30d', immutable` (portraits, icons, loading screens, JS assets)
- Key file: `frontend/src/pages/Home.tsx`

## Species Portrait System (2026-06-07)
- Downloaded ~312 pre-rendered portrait PNGs from Stellaris wiki (stellaris.paradoxwikis.com/Category:Species_portraits)
- Rewrote `extract_species_classes.py` to use `portrait_categories` + `portrait_sets` as source of truth instead of `species_classes.txt` — now correctly extracts all 18 player-selectable portrait categories (was missing MACHINE, CYBERNETIC, SYNTH, PSIONIC, BIOGENESIS with 0 portraits before)
- Built `output/portrait_wiki_map.json` mapping 309 game portrait IDs → wiki PNG filenames
- Portraits copied to `frontend/public/portraits/` as `{portrait_id}.png`, resized to 256px (21MB total)
- Database: `portrait` column already existed; fixed `PUT /api/builds/:id` to include `species_class` and `portrait` in UPDATE query (were missing)
- `BuildForm.tsx`: activated portrait selector (was hidden behind `{false &&}`), replaced placeholder emoji with real `<img>` tags, 72px thumbnails with `objectPosition: top`
- `BuildDetail.tsx`: portrait displayed as 128px image next to species class badge
- `Home.tsx`: portrait thumbnail (56px) shown top-right of build cards
- Key files: `data-extractor/extract_species_classes.py`, `data-extractor/download_wiki_portraits.py`, `data-extractor/output/portrait_wiki_map.json`, `frontend/public/portraits/`, `frontend/src/BuildForm.tsx`, `frontend/src/pages/BuildDetail.tsx`, `frontend/src/pages/Home.tsx`, `backend/index.js`

**Portrait extraction notes:**
- Source: `common/portrait_categories/00_portrait_categories.txt` → `common/portrait_sets/00_portrait_sets.txt`
- 341 total portrait IDs across 18 categories (295 unique — many shared between categories e.g. cybernetic portraits appear under both MAM and CYBERNETIC)
- Portraits still missing an image: only `lith_human_inf` and `default_robot` as of 2026-10-19 (the ~29 initially missing were downloaded since). They are filtered out of `GET /api/species-classes`
- Wiki uses different naming conventions: `Cyber_NN_stage_2.png`, `Synth_NN.png`, `Bio_species_NN.png`, etc.

## AI Search Optimization / LLM SEO (2026-05-22)
- `frontend/public/robots.txt`: Added explicit allow rules for AI crawlers (GPTBot, ChatGPT-User, Google-Extended, ClaudeBot, PerplexityBot, Amazonbot, cohere-ai)
- `frontend/public/llms.txt`: New file (served at `/llms.txt`) — describes the site for LLMs with structured markdown: purpose, what a Stellaris build is, supported versions, data coverage stats
- `frontend/index.html`: Added `WebSite` JSON-LD schema with `SearchAction` — tells LLMs the site is about Stellaris and how to search it
- `frontend/src/pages/Home.tsx`: Added `ItemList` JSON-LD schema (top 20 builds) in Helmet
- `frontend/src/pages/BuildDetail.tsx`: Fixed hardcoded author `"Arthur LAMBERT"` → dynamic `build.author_username || "Community Member"`
- Key files: `frontend/public/robots.txt`, `frontend/public/llms.txt`, `frontend/index.html`, `frontend/src/pages/Home.tsx`, `frontend/src/pages/BuildDetail.tsx`

## Stellaris 4.4 "Pegasus" Support (2026-06-15)
- Added `backend/data/versions/4.4/` with all game data for Pegasus patch
- New content: 4 origins (Voidfarers, Heirs of the Khan, The Sacred Path, Forever Cruise), 16 civics, 8 nomad species traits, 1 ascension perk (Wanderlust)
- `18_nomads_species_traits.txt` added to `species_trait_files` list in `extract_traits.py` (same pattern as `16_infernals_traits.txt` for Infernals DLC)
- `AVAILABLE_DATA_VERSIONS` updated to `['4.2', '4.3', '4.4']` in `backend/index.js`
- Default build version set to 4.4 in `BuildForm.tsx`
- Key files: `backend/data/versions/4.4/`, `backend/index.js`, `frontend/src/BuildForm.tsx`, `frontend/src/pages/Home.tsx`, `data-extractor/extract_traits.py`

## Versioned Game Data + Stellaris 4.3 "Cetus" Support (2026-03-20)
- Game data is now versioned: `backend/data/versions/4.2/` and `backend/data/versions/4.3/`
- All game data API endpoints accept `?version=X.Y` — `getDataVersion()` maps any version string to the nearest available folder
- `BuildDetail` fetches build first via `/api/builds/:id`, then loads game data with the matching version
- `BuildForm` reloads game data when version changes, deselects items no longer valid in the new version
- `extract_all.py` auto-detects game version from `launcher-settings.json`, outputs to `output/versions/X.Y/`
- Home page: added version filter dropdown (populated dynamically from loaded builds)
- Default build version changed to 4.3; old builds without version data fall back to 4.2
- Key files: `backend/index.js`, `frontend/src/pages/BuildDetail.tsx`, `frontend/src/BuildForm.tsx`, `frontend/src/pages/Home.tsx`, `data-extractor/extract_all.py`

## Custom Display Names for OAuth Users (2026-01-11)
- Added display_name system for Google/Steam authenticated users
- Database: New `display_name` column with unique index (allows NULL for users without custom name)
- API endpoint: `PATCH /api/user/display-name` with validation (3-30 chars, alphanumeric + underscore/dash)
- Collision prevention: display_name uniqueness checked against both usernames and other display_names
- Frontend: DisplayNameModal component accessible from navbar for OAuth users only
- Build queries updated: `COALESCE(display_name, username)` shows custom name if set, falls back to OAuth username
- UI: "Edit" button in navbar for OAuth users, modal with real-time validation
- Restriction: Local account users cannot set display_name (they use their username)
- Key files: `backend/database.js`, `backend/index.js`, `frontend/src/components/DisplayNameModal.tsx`, `frontend/src/components/Navbar.tsx`

## What's New Section on Home Page (2026-01-11)
- Added "What's New" banner to communicate updates and new features
- Design: Compact green gradient banner side-by-side with Resources CTA
- Layout: Two-column responsive layout (col-lg-6 each) - stacks vertically on mobile
- Content: Displays 2 most recent news items in condensed format (icon + date + title, no description)
- News items hardcoded in Home.tsx with type ('feature', 'update', 'fix') for dynamic icons
- Auto badge: "NEW" badge appears if news is less than 7 days old
- Compact design: Reduced padding (0.75rem 1rem) to minimize vertical space
- Current news: Custom Display Names (11 Jan 2026), Infernals DLC Support (25 Nov 2025)
- Future updates: Edit `latestNews` array in Home.tsx and rebuild frontend
- Key files: `frontend/src/components/WhatsNewBanner.tsx`, `frontend/src/pages/Home.tsx`

## UI Optimization - Reduced Hero Banner Height (2026-01-11)
- Reduced hero banner padding from 4rem to 2rem (50% height reduction)
- Scaled down typography: display-3 → display-5, removed `lead` class
- Compacted build counter widget with smaller padding and text
- Result: Builds visible much faster on page load with less scrolling required
- Key file: `frontend/src/pages/Home.tsx`

## Infernals Species Pack DLC Support (2025-11-25)
- Updated game version to 4.2 "Corvus" (latest) in BuildForm
- Extracted all DLC Infernals content: 2 new origins, 4 new civics, 5 new selectable traits, 1 new ascension perk
- Added `16_infernals_traits.txt` to trait extraction script (was missing, causing 6 traits to be skipped)
- Added new species class INF (Infernal) with 18 total species classes
- Fixed PRE_INF (presapient) appearing as duplicate by adding to NPC filter list
- Extracted 22 new icon files (origins, civics, traits, ascension perks) for DLC content
- Note: Icon extraction now uses PIL instead of Wand (may cause encoding differences in existing files)
- Updated species_classes.json, traits.json, civics.json, origins.json, ascension_perks.json
- Key files: `extract_traits.py`, `extract_species_classes.py`, `BuildForm.tsx`, `backend/data/*.json`

## Icon Optimization & Performance (2025-10-25)
- Optimized icon extraction (32px icons: 2.6MB savings, ~75% reduction)
- Added machine trait filtering (MACHINE/ROBOT species only)
- Implemented background trait disabled UX (instead of auto-replace)
- Fixed BuildDetail loading race condition (Promise.all pattern)
- Added trait counting logic (cost 0 traits excluded from 5-trait limit)
- Created performance and TypeScript validation test suites
- Key files: `extract_icons.py`, `BuildForm.tsx`, `BuildDetail.tsx`, `tests/e2e/performance.spec.ts`

## SEO & Image Lazy Loading (2025-10-26)
- Implemented comprehensive SEO (meta tags, Open Graph, Twitter Cards, JSON-LD structured data)
- Created `robots.txt` and dynamic `/sitemap.xml` endpoint
- Added `react-helmet-async` for per-page meta tags
- Implemented lazy loading (`loading="lazy"`) across all images (50% fewer initial requests)
- Added Google Search Console verification file
- Optimized render blocking resources (preconnect, dns-prefetch)
- Key files: `index.html`, `robots.txt`, `backend/index.js`, `BuildDetail.tsx`, `BuildForm.tsx`

## Species Class Dynamic Extraction (2025-10-26)
- Replaced 4 hardcoded species types with 17 dynamically extracted species classes
- Fixed localization parser to recursively search subdirectories (103k+ entries)
- Filtered 26 NPC-only species classes
- Changed UI from button group to dropdown select
- Updated all E2E tests for dropdown selectors
- Added archetype mapping (BIOLOGICAL, LITHOID, MACHINE, ROBOT, NECROPHAGE)
- Key files: `localization_parser.py`, `extract_species_classes.py`, `species_classes.json`, `BuildForm.tsx`

## Loading Screen Backgrounds (2025-10-26)
- Extracted 19 loading screens from Stellaris (DDS → JPG: 91% size reduction, ~400KB each)
- Implemented random background system at App.tsx level
- Background changes on page navigation (useLocation hook)
- Mobile optimization (no images on screens ≤768px)
- Fixed parallax background with 80% dark overlay
- Key files: `extract_loading_screens.py`, `App.tsx`, `frontend/public/loading_screens/`

## Community Resources Page (2025-11-05)
- Created Resources page with 6 categories, 23+ curated resources
- Implemented category filtering and featured resources system
- Added responsive grid layout and SEO optimization
- Created 14 E2E tests for full functionality coverage
- Resources include YouTube channels, guides, tools, mods, communities
- Key files: `Resources.tsx`, `Resources.css`, `resources.json`, `tests/e2e/resources.spec.ts`
