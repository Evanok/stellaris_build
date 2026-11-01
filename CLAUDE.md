# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Public Repository — Never Commit

This repo is **PUBLIC**. Never commit: `.env` files, database files/backups (`*.db`, `*.db.backup*`), credentials, API keys, session secrets, real user data, or server IPs/access details. Server connection details live in `CLAUDE.local.md` (gitignored, not committed) — see that file locally, never add them here. Always double-check `git status` before staging with `-A` or `add .`.

## Project Overview

This is a community website for sharing Stellaris (game) builds. It's a monorepo with a React frontend, Express backend, and Python data extraction tools.

**Live Site:** https://stellaris-build.com

## Tech Stack

_Versions verified against the workspace `package.json` files on 2026-08-18 (major-version upgrade pass same day — see below)._

**Repo layout**
- npm workspaces monorepo: `frontend/` + `backend/` are workspaces; `data-extractor/` (Python) sits outside them
- Root scripts only orchestrate: `concurrently` 8 for dev, Playwright for tests
- Root `package.json` has an `overrides` block pinning `react`/`react-dom` to 19.2.x and `sqlite3` to 6.0.x tree-wide — **do not remove**. Without it, `react-bootstrap` → `@restart/ui` → `react-aria` pulls in its own nested `react-dom@18`, which crashes the entire app at runtime with "A React Element from an older version of React was rendered" (blank page, not a build error — `tsc`/`vite build` pass fine even when this is broken). If you ever bump these packages again, re-verify `npm ls react-dom` shows a single deduped version, and actually load the app in a browser, not just a type-check.

**Frontend** (`frontend/`)
- React 19.2 + TypeScript 7, built with Vite 8 + `@vitejs/plugin-react` 6
- UI: Bootstrap 5.3 + `react-bootstrap` 2.10 + `bootstrap-icons` (no Tailwind)
- Routing: `react-router-dom` 7.9
- SEO/meta: `react-helmet-async` 3
- Markdown rendering: `react-markdown` 10 + `remark-gfm` 4 (tables, strikethrough, task lists, autolinks), wrapped in `components/MarkdownText.tsx` for user-written text (build description, "How to Play" guide); raw HTML is never rendered
- Charts: `recharts` 3.10 (Stats page)
- CSS trimming: `@fullhuman/postcss-purgecss` 8
- Lint: ESLint (`npm run lint -w frontend`) — **script present but `eslint` itself is not in `devDependencies`**, so `npm run lint -w frontend` currently fails with `eslint: not found`; pre-existing, not caused by the dependency upgrade
- `src/vite-env.d.ts` (`/// <reference types="vite/client" />`) — required since TypeScript 7 for CSS side-effect imports (`import './index.css'`) to type-check; standard Vite scaffold file, just hadn't existed here before

**Backend** (`backend/`)
- Node + Express 5.1, **CommonJS** (`require`, not ESM)
- Database: `sqlite3` 6.0 — `stellaris_builds.db`, tables auto-created on startup (`database.js`). **No prebuilt binary compatible with prod's glibc** (Ubuntu 20.04, glibc 2.31; sqlite3 6's prebuild needs glibc 2.38+) — `backend/package.json`'s `postinstall` script auto-detects a failed `require('sqlite3')` and runs `npm rebuild sqlite3 --build-from-source` when needed, so a plain `npm install` self-heals on any machine. Needs `python3`/`make`/`g++` (already present on prod); if a rebuild ever fails there, install `build-essential`.
- Sessions: `express-session` 1.18 + **`connect-sqlite3`** 0.9 → `sessions.db` (its own nested `sqlite3` dependency is pinned to 6.0.x too, via the root `overrides` — otherwise it'd carry its own vulnerable `sqlite3@5.1.7` + old `node-gyp`/`tar`)
- Auth: `passport` 0.7 with `passport-google-oauth20`, `passport-steam`, `passport-local`; `bcrypt` 6 for local accounts
- Rate limiting: `express-rate-limit` 8, plus in-memory limiters in `security.js`
- Uploads: `multer` 2 (`.sav` / `.txt`, 50 MB cap)
- Images: `sharp` 0.35 (OG/social preview generation, `ogImage.js`)
- Email: `nodemailer` 9 over SMTP (password reset)
- Config: `dotenv`; dev runner: `nodemon` 3 (**watches `.js` only** — see Key Technical Details)

**Data extraction** (`data-extractor/`)
- Python 3.8, custom Paradox script parser (`paradox_parser.py`, `localization_parser.py`) — no parsing library
- `Pillow` (PIL) for icon/image processing, and the **ImageMagick `convert` CLI** shelled out via `subprocess` for DDS→PNG/JPG
- `requirements.txt` lists Pillow + numpy (numpy: `pdx_mesh.py`, the 3D model renderer for shipset previews); ImageMagick `convert` is also needed

**Testing**
- Playwright 1.56 at the repo root (`npm test`, specs in `tests/`)
- No unit-test framework in either workspace (`npm test -w backend` is a stub that exits 1)

**Deployment**
- PM2 + nginx + Let's Encrypt SSL on a Scaleway Dedibox
- Backend on :3001, **bound to 127.0.0.1 only** (`BIND_HOST` to override) - reached through nginx in prod; the Vite dev server proxies `/api/*` to `127.0.0.1:3001` locally

## Development Commands

### Running the Application

```bash
# Start both frontend and backend in development mode (recommended)
npm run dev

# Or run individually:
npm run dev -w frontend  # Starts Vite dev server on port 3000
npm run dev -w backend   # Starts Express server on port 3001
```

### Building

```bash
# Build frontend for production
npm run build -w frontend  # Runs TypeScript compiler + Vite build
```

### Production Deployment

**Production Server:**
- Domain: https://stellaris-build.com
- Connection details: see `CLAUDE.local.md` (not committed). The deploy kit reads the host from
  `deploy/.env` (gitignored, `DEPLOY_HOST=user@host`).

Deployed **from the dev machine** with the shared deploy kit (`~/work/deploy_kit`, see its README):

```bash
./deploy.sh            # local gate (backend syntax, frontend build, Playwright E2E), then a new release
./deploy.sh status     # current release, pm2, health
./deploy.sh rollback   # previous release (code only: the database is shared, never rolled back)
DEPLOY_CONF=deploy/staging.conf ./deploy.sh   # rehearsal app on :3002 (see deploy/staging.conf)
```

- Settings: `deploy/deploy.conf`. Only the commit pushed to `origin/master` can be deployed.
- On the VPS: `~/apps/stellaris_build/releases/<date>_<sha>/`, `current` (what PM2 runs as
  `stellaris-build`, from `current/backend`) and `shared/`. Symlinked into each release:
  `backend/.env`, `backend/db/` (`stellaris_builds.db` + `sessions.db` and their `-wal`/`-shm`),
  `backend/cache/`, `backend/import_archive/`. Also in `shared/`: `backups/` (used by `backup_db.sh`).
- The database location comes from `DB_PATH` / `SESSIONS_DIR` (`backend/dbPath.js`, resolved
  against `backend/`): `db/stellaris_builds.db` and `db` in production (set in `PM2_START`),
  `backend/stellaris_builds.db` and `backend/` by default (development).
- Each deploy: build in the new release (`npm ci`, frontend build, `version.json` from the
  `DEPLOY_*` variables since a release has no `.git`), pre-deploy DB backup, switch, PM2 restart
  (nginx shows `maintenance.html` for the few seconds Node is down), health check on
  `/api/builds?limit=1` that must return a real build (`HEALTH_EXPECT`), automatic rollback if not.
- PM2 refuses to start the app if the database file is missing: SQLite would otherwise silently
  create an empty one, and the site would answer 200 with zero builds.
- `enable_maintenance.sh` / `disable_maintenance.sh` (pm2 stop/restart) remain for manual maintenance.

**Backups:** `backup_db.sh` (cron 03:00): 7 daily + 4 weekly (Sunday) gzip backups in
`shared/backups`, mirrored to `gdrive:backups/stellaris_build` with `rclone sync` (a mirror: it
deletes on Drive what is not local, so anything that is not production must set
`STELLARIS_GDRIVE_DIR`). `predeploy` mode runs before every deploy (own folder, last 5).

**nginx config:** Tracked in the repo at `infra/nginx/stellaris-build.conf` (mirrors the live prod
config — edit this file, not the server directly). Static paths are served from
`~/apps/stellaris_build/current/frontend/dist` and fall back to Node when a file is not there, so a
deploy never serves a page whose assets 404. Deploy changes with `infra/deploy_nginx.sh` (requires
`PROD_HOST`, see `CLAUDE.local.md`); it restores the previous file if `nginx -t` fails, since that
nginx also serves the other sites on the server.

### OAuth Setup (Development)

The site uses Google and Steam OAuth for authentication. To run locally:

1. **Copy environment file:**
```bash
cd backend
cp .env.example .env
```

2. **Get Google OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project (or use existing)
   - Enable "Google+ API" or "Google Identity"
   - Go to Credentials > Create Credentials > OAuth 2.0 Client ID
   - Add authorized redirect URI: `http://localhost:3001/auth/google/callback`
   - Copy `Client ID` and `Client Secret` to `.env`

3. **Get Steam API key (optional):**
   - Go to [Steam API Key](https://steamcommunity.com/dev/apikey)
   - Register your domain: `http://localhost:3001`
   - Copy API key to `.env`

4. **Update `.env` file:**
```bash
SESSION_SECRET=your-random-secret-key
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
STEAM_API_KEY=your-steam-api-key
```

5. **Restart backend:** The auth routes will now work

**Production Setup:**
- Update callback URLs in Google Cloud Console to use `https://stellaris-build.com`
- Update `.env` on production server with production credentials
- Set `NODE_ENV=production` for secure cookies

## Architecture

### Monorepo Structure

The project uses npm workspaces with three main parts:
- `frontend/` - React/Vite application
- `backend/` - Express API server
- `data-extractor/` - Python scripts for extracting Stellaris game data

### Frontend Architecture (frontend/src/)

**Main Components:**
- `App.tsx` - Root component that fetches and displays builds list, manages build state
- `BuildForm.tsx` - Comprehensive form for creating builds with all game elements
- `main.tsx` - Application entry point

**BuildForm Features:**
- Species type selection (Biological, Lithoid, Machine, Robot)
- Species traits with point/pick validation and origin bonuses
- Origins with trait bonuses
- Starting ruler traits (with origin/ethics filtering)
- Ethics with point limits and compatibility checks
- Authorities with ethics requirements
- Civics with conditional filtering (potential/possible): 2 at creation, plus an optional third civic (`third_civic`, unlocked later in game - shown on the build page, never exported, still rule-checked with all 3 civics)
- Description (5k chars) and optional "How to Play" guide (`guide`, 20k chars), both markdown, length enforced while typing (`maxLength` + counter)
- Recommended Ascension Perks with ordering
- Recommended Tradition Trees with ordering
- Game version tracking
- Optional YouTube video link
- Tooltips with descriptions for all game elements

**Pages:**
- `Home.tsx` - Displays all builds with search, filtering, and pagination
- `CreateChoice.tsx` (`/create`) - Public page listing the 3 ways to create a build, imports first (`ImportEmpireDesigns.tsx`, `ImportSave.tsx`, `CreateManual.tsx`). None of them needs a login up front - it is asked at publish time, where the visitor can also publish as a guest (see "Build Creation Funnel" and "Publishing Without an Account" in `CHANGELOG.md`)
- `BuildDetail.tsx` - Individual build view with all details, embedded YouTube videos, and soft delete button
- `Login.tsx` - Login page, tabs Login (default) / Register / Google / Steam - email login is deliberately the default, OAuth buttons put some visitors off
- `Resources.tsx` - Curated community resources page with categorized links to guides, tools, YouTubers, mods, and communities
- `Feedback.tsx` - Feedback & bug reports list (col-lg-8) with community chat sidebar (col-lg-4)
- `GuestSubmitted.tsx` (`/build-submitted`) - Confirmation after a guest submission: claim link + "create an account" pitch
- `ClaimBuild.tsx` (`/claim/:token`) - Attaches a guest build to the logged-in account (asks to sign in first)
- `PendingBuilds.tsx` (`/admin/pending`) - Moderation page (admin only): pending guest builds + reported comments (View / Dismiss / Delete); `/admin/pending/:id` is `BuildDetail.tsx` in `pendingMode` (moderator preview with Approve/Reject, no rating, no comments)
- Build comments: `components/BuildComments.tsx`, at the bottom of `BuildDetail.tsx` (see "Build Comments" in `CHANGELOG.md`)
- `AdminStats.tsx` (`/admin/stats`) - Admin statistics from the DB only (accounts, builds, and builds published without an account: submitted / approved / rejected / emailed / claimed, plus a weekly published-vs-guest chart). Traffic sources are left to GA. Both admin pages are linked in the navbar for admins only (Moderation shows the pending count)

**Authentication:**
- `AuthContext.tsx` - React context providing authentication state and user info
- `useAuth()` hook - Access current user, loading state, logout function
- Pages that need an account send the visitor to `/login` after `setPostLoginRedirect(path)` (`utils/postLoginRedirect.ts`); `App.tsx` / `Login.tsx` bring them back once logged in. Every login path (local, Google, Steam) otherwise ends on `/`
- Navbar shows user avatar and username when logged in

**Data Flow:**
- API calls to `/api/*` endpoints are proxied to backend via Vite config (vite.config.ts:9-14)
- Build form fetches all game data from respective API endpoints
- App component manages global build state and passes down callbacks
- AuthProvider wraps the entire app to provide authentication state

### Backend Architecture

**Entry Point:** `backend/index.js`
- Express server running on port 3001 (configurable via PORT env var), listening on `127.0.0.1` only (`BIND_HOST` env var to override, e.g. `0.0.0.0` to test from another device)
- Sets up database on startup via `setupDatabase()`
- Configures Passport.js for OAuth authentication (Google + Steam)
- Uses express-session for maintaining user sessions
- Serves static JSON data files from `backend/data/`
- Serves compiled frontend from `frontend/dist/` in production
- All non-API routes fallback to `index.html` for React Router

**Authentication:** `backend/auth.js`
- Passport.js configuration with Google OAuth 2.0 and Steam OpenID strategies
- Serialization/deserialization for session management
- `findOrCreateUser()` helper to automatically create users on first login
- Stores provider info (google/steam), username, email, and avatar

**Database:** `backend/database.js`
- SQLite database at `DB_PATH` (`backend/dbPath.js`; default `backend/stellaris_builds.db`, production `shared/backend/db/`), created at runtime
- Tables: `users`, `builds`, `ratings`, `feedback`, `page_views` (legacy, no longer written since 2026-10-19), `chat_messages`, `pending_builds`, `import_attempts`, `build_comments`, `comment_reports`
- Users table: stores OAuth user info (provider, provider_id, username, email, avatar). `provider = 'guest'` rows are not real accounts: they only carry the author name of approved guest builds, cannot log in, and are excluded from signup stats
- Builds table: stores complete empire configurations with soft delete support and author_id foreign key
- chat_messages table: community chat (content, author_name, author_id nullable, is_guest, deleted, created_at)
- build_comments table: comments under a build (build_id, user_id, content, `quote_id` = quoted comment of the same build, deleted, created_at). Flat list, no threads. Content stored raw, rendered as plain text
- comment_reports table: one row per (comment_id, user_id) report, `UNIQUE`; deleted when an admin dismisses them
- pending_builds table: builds submitted without an account, waiting for moderation (`data` = sanitized build fields as JSON, `guest_name`, optional `guest_email`, `claim_token_hash`, `claimed_user_id`, `status` pending/approved/rejected, plus a transient `approving` that locks the row during an approval and is reset to `pending` at startup, `build_id` once published). Deliberately separate from `builds`, which many public queries read
- Schema uses ALTER TABLE for migrations to add new columns without breaking existing data

**Authentication Routes:**
- `GET /auth/google` - Initiate Google OAuth flow
- `GET /auth/google/callback` - Google OAuth callback (redirects to `/`)
- `GET /auth/steam` - Initiate Steam OpenID flow
- `GET /auth/steam/callback` - Steam OpenID callback (redirects to `/`)
- `GET /auth/logout` - Logout and destroy session
- `GET /api/user` - Get current authenticated user (or null)

**API Endpoints:**
- `GET /api/test` - Health check
- `GET /api/traits` - Returns species traits (349 player-selectable)
- `GET /api/origins` - Returns origins (55 playable)
- `GET /api/ethics` - Returns ethics (17 total)
- `GET /api/authorities` - Returns authorities (7 total)
- `GET /api/civics` - Returns civics (207 playable)
- `GET /api/ascension-perks` - Returns ascension perks (44 player-available)
- `GET /api/traditions` - Returns tradition trees (32 trees)
- `GET /api/ruler-traits` - Returns ruler traits filtered by origin/ethics compatibility
- `GET /api/shipsets` - Returns the 20 shipsets (ship appearance) with names, category (biological/mechanical) and rendered preview images
- `GET /api/planet-classes` - Returns homeworld planet classes (10 selectable climates + origin-forced classes like Habitat/Gaia, with icons)
- `GET /api/builds` - Returns all non-deleted builds ordered by created_at DESC
- `POST /api/builds` - Creates new build (requires authentication, name, checks for duplicates)
- `POST /api/builds/guest` - Submits a build without an account to the moderation queue (`guest_name` required, `guest_email` optional, honeypot field `website`). `guestSubmitLimiter`: 5 successful submissions/day per IP (the slot is reserved before the handler runs, so parallel requests cannot bypass it). Emails to `guest_email` are capped by `reserveGuestEmail()` (3/day per address, 50/day in total; beyond, the build is saved but not emailed). Returns the claim token
- `POST /api/builds/claim` - Attaches a guest build to the logged-in user from its claim token (before or after approval)
- `GET /api/admin/pending-builds`, `GET /api/admin/pending-builds/:id`, `POST /api/admin/pending-builds/:id/approve|reject` - Moderation (admin only). Approve copies the build into `builds`, after an atomic `pending` -> `approving` transition (a double click cannot publish twice)
- `GET /api/admin/pending-builds-count` - Admin navbar badge: `count` (pending builds) + `reported_comments` (visible comments with at least one report); the navbar shows the sum
- `GET /api/builds/:id/comments` - Comments of a build, oldest first, with the quoted excerpt (`quote_content` null when the quoted comment was deleted) and `user_reported`; `report_count` for admins only
- `POST /api/builds/:id/comments` - Post a comment (login required, 2000 chars, optional `quote_id`), 5 per 5 min per account (in-memory)
- `DELETE /api/builds/:id/comments/:commentId` - Soft-delete a comment (**admin only** - authors cannot delete their own)
- `POST /api/builds/:id/comments/:commentId/report` - Report a comment (login required, not your own, once per user, 10 reports/h per account); emails `ADMIN_EMAIL`. The comment author is never notified
- `DELETE /api/builds/:id/comments/:commentId/reports` - Dismiss the reports of a comment (admin only)
- `GET /api/admin/reported-comments` - Moderation list of reported comments (admin only)
- `POST /api/import-build` (`.sav`), `POST /api/list-empires` + `POST /api/import-empire-designs` (empire designs `.txt`) - parse an uploaded file with a Python script and return pre-filled build data. **Open to anonymous visitors**, protected by `importLimiter` (30/h per IP, 60/h per account), max 3 concurrent parses (503 beyond), 60s script timeout. Every request, failed ones included (rate limit, wrong file, parser crash), gets a row in `import_attempts` (status, error, parser output tail, file name/size/sha256), and the uploaded file is kept in `backend/import_archive/{save,designs}/<sha256>.<ext>` (gitignored, deduplicated, 5 GB cap) as test material when a parser breaks - see `backend/importLog.js`
- `DELETE /api/builds/:id` - Soft deletes a build (sets deleted=1)
- `GET /api/resources` - Returns curated community resources (YouTube channels, guides, tools, mods, communities)
- `GET /api/chat` - Returns last 100 non-deleted chat messages (oldest first)
- `POST /api/chat` - Posts a chat message (logged-in or guest with pseudo); rate-limited 5 msg/5 min per IP or user_id
- `DELETE /api/chat/:id` - Soft-deletes a chat message (admin only)
- `GET /og/build/:id-:fingerprint.jpg` - Per-build social preview image, 1200x630 (generated on demand, cached on disk). Not under `/api`. Any failure redirects to the static `/og-image.jpg`

**Static Data Files (backend/data/versions/):**
Game data is versioned by Stellaris patch. Each folder maps to a game version:
- `backend/data/versions/4.2/` - Stellaris 4.2 "Corvus" data
- `backend/data/versions/4.3/` - Stellaris 4.3 "Cetus" data
- `backend/data/versions/4.4/` - Stellaris 4.4 "Pegasus" data
- `backend/data/versions/4.5/` - Stellaris 4.5 "Cygnus" data

Each version folder contains the same set of files:
- `traits.json` - species traits (filtered, no leader traits)
- `origins.json` - origins (playable only)
- `ethics.json` - ethics
- `authorities.json` - authorities
- `civics.json` - civics (filtered, no NPC civics)
- `ascension_perks.json` - perks (player-available only)
- `traditions.json` - tradition trees with adopt/finish/individual traditions
- `ruler_traits.json` - ruler/leader traits for starting leaders
- `species_classes.json` - species classes with portrait IDs (18 categories from portrait_categories)
- `species_archetypes.json` - trait point/pick budget per archetype (BIOLOGICAL/ROBOT/MACHINE/LITHOID/PRESAPIENT/OTHER) - extracted by `extract_species_archetypes.py`, included in `extract_all.py`
- `shipsets.json` - shipsets as listed by the in-game "Ship models" picker (same 20 entries, order and names) - extracted by `extract_shipsets.py`, included in `extract_all.py`. 4.2-4.4 hold a copy of the 4.5 file
- `planet_classes.json` - homeworld planet classes (`selectable` = offered in the empire creator; others are only reachable through an origin or the Nomadic toggle) - extracted by `extract_planet_classes.py`, included in `extract_all.py`. 4.2-4.4 hold a copy of the 4.5 file (planet classes unchanged across those versions; only 4.5 was extracted)

Non-versioned files (still in `backend/data/`):
- `resources.json` - Curated community resources (not game data)

**Version routing logic (backend/index.js):**
- All game data endpoints accept `?version=X.Y` query param
- `getDataVersion(requestedVersion)` maps any version string to the nearest available data folder
- Versions below the oldest available (4.2) fall back to 4.2
- Versions above the latest available fall back to the latest (4.5)
- `AVAILABLE_DATA_VERSIONS` array must be updated when adding new version folders
- `LATEST_DATA_VERSION` is auto-derived from the last element of that array

### Data Extractor (data-extractor/)

**Purpose:** Extract and localize game data from Stellaris installation files

**Main Scripts:**
- `extract_all.py` - Extract all data types at once (recommended)
- `paradox_parser.py` - Generic parser for Paradox Script format (.txt files)
- `localization_parser.py` - Parse and resolve localized names/descriptions from .yml files
- `extract_species_classes.py` - Extracts 18 portrait categories from `portrait_categories` + `portrait_sets` (NOT species_classes.txt)
- `download_wiki_portraits.py` - Downloads portrait PNGs from Stellaris wiki (requires browser cookies to bypass CDN)
- Individual extractors: `extract_traits.py`, `extract_civics.py`, `extract_ethics.py`, etc.
- `extract_shipsets.py` - shipsets -> `shipsets.json` (in `extract_all.py`); `extract_shipset_images()` renders the previews (called from `extract_icons.py`, ~30s) with `pdx_mesh.py`
- `pdx_mesh.py` - reader for the game's binary 3D models (`.mesh`, "@@b@" format) + numpy software renderer
- `extract_planet_classes.py` - homeworld planet classes -> `planet_classes.json` (in `extract_all.py`); `extract_planet_icons()` slices the planet icons, called from `extract_icons.py`

**Localization System:**
- Loads 69,867 English localization entries from `localisation/english/*.yml`
- Recursively resolves variable references like `$civic_name$` (up to 5 iterations)
- Cleans markup (removes color codes `§Y`, icons `£energy£`, etc.)
- Handles multiple YAML formats: `key: "value"`, `key:0 "value"`, `key:1 "value"`

**Data Filtering:**
- **Traits**: Excludes 83 leader traits (only species traits)
- **Civics**: Excludes 47 NPC civics (fallen empires, primitives, enclaves, etc.)
- **Ascension Perks**: Excludes 48 obsolete/NPC perks with `potential = { always = no }`
- **Traditions**: Excludes duplicate tree entries without proper adoption data

**Usage:**
```bash
cd data-extractor

# Extract all data - auto-detects game version from launcher-settings.json
python3 extract_all.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"
# Output goes to: output/versions/X.Y/ (created or updated automatically)
```

**Process for a new Stellaris version (e.g. 4.6):**

Full checklist, verified end-to-end on the 4.4 -> 4.5 "Cygnus" upgrade (2026-09-23). `NEW` = the
new version, `PREV` = the previous one. Steps 5-9 are the "wire it into the site" half — easy to
forget, and the data is invisible to users until they're all done.

*Extraction*
1. Confirm the game version: `launcher-settings.json` -> `modsCompatibilityVersion` (data folder
   name, `X.Y`) and `rawVersion` (exact patch, `X.Y.Z` — needed in step 6).
2. Check for new trait files — each DLC adds a new numbered file (e.g. `18_nomads_species_traits.txt`).
   Diff `ls common/traits/` against the `species_trait_files` list in `extract_traits.py`, add any
   missing `*_species_traits.txt` / `*_traits.txt` (species ones only, not `*_leader_traits.txt`).
3. Run `extract_all.py "<stellaris_path>"` — auto-detects the version, creates `output/versions/NEW/`.
4. Run the two extractors that are NOT in `extract_all.py`:
```bash
python3 extract_ruler_traits.py "<stellaris_path>"    # -> output/ruler_traits.json
python3 extract_species_classes.py "<stellaris_path>" # -> output/species_classes.json
```
5. Copy to backend:
```bash
VERSION=4.6; PREV=4.5
mkdir -p ../backend/data/versions/$VERSION
cp output/versions/$VERSION/traits.json               ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/civics_civics_only.json   ../backend/data/versions/$VERSION/civics.json
cp output/versions/$VERSION/civics_origins_only.json  ../backend/data/versions/$VERSION/origins.json
cp output/versions/$VERSION/ethics.json               ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/traditions_by_tree.json   ../backend/data/versions/$VERSION/traditions.json
cp output/versions/$VERSION/ascension_perks.json      ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/species_archetypes.json   ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/planet_classes.json       ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/shipsets.json             ../backend/data/versions/$VERSION/
cp output/ruler_traits.json                           ../backend/data/versions/$VERSION/ruler_traits.json
cp output/species_classes.json                        ../backend/data/versions/$VERSION/species_classes.json
cp ../backend/data/versions/$PREV/authorities.json    ../backend/data/versions/$VERSION/  # hand-maintained, copy then refresh:
python3 extract_authority_rules.py "<stellaris_path>" ../backend/data/versions/$VERSION/authorities.json
```

**Gotcha — `ruler_traits.json` loses its `icon` field.** `extract_ruler_traits.py` does not emit
`icon`; the field was added out-of-band and only survives in the already-deployed files. Copying
the fresh `output/ruler_traits.json` over it silently drops all 10 icons (no error, icons just
vanish from the UI). Re-inject them from the previous version after copying:
```bash
python3 - <<'EOF'
import json
prev, new = 'backend/data/versions/4.5/ruler_traits.json', 'backend/data/versions/4.6/ruler_traits.json'
a = {x['id']: x for x in json.load(open(prev))}
b = json.load(open(new))
for t in b:
    if 'icon' not in t and 'icon' in a.get(t['id'], {}):
        t['icon'] = a[t['id']]['icon']
json.dump(b, open(new, 'w'), indent=2, ensure_ascii=False)
EOF
```

*Wiring it into the site* — all of these must be updated together:

6. `frontend/src/utils/gameVersion.ts` — `LATEST_GAME_VERSION = { value, name, patch }`. This single
   constant drives the **"Up to date with Stellaris X.Y.Z <Name>" badge on the home page hero**
   (`Home.tsx`). `patch` is the exact `X.Y.Z` from step 1 — bump it on every hotfix, even when the
   data folder itself doesn't change.
7. **Version filters + default** (a new version is invisible in the UI until all of these are done):
   - `backend/index.js` — add to `AVAILABLE_DATA_VERSIONS` (`LATEST_DATA_VERSION` is auto-derived
     from the last element) **and** to `VERSION_NAMES_MAP` (`'4.6': '4.6 (Name)'`), which feeds the
     home page's version filter dropdown.
   - `backend/check_build_rules.js` — same `AVAILABLE_DATA_VERSIONS`, plus add the version to
     `FIXED_VERSIONS` (versions extracted with the structured predicate format).
   - `frontend/src/BuildForm.tsx` — add to `GAME_VERSIONS` (mark the new one `(Latest)`, drop the
     `(Latest)` suffix from the previous), and make it **the default for new builds**: three
     `setGameVersion`/`useState` call sites all carry the version literal (initial state, edit-load
     fallback, post-submit reset). Grep the old version string in that file to catch all of them.
   - `frontend/src/pages/Home.tsx` — `VERSION_NAMES` map (filter dropdown labels).
   - `frontend/src/pages/Stats.tsx` — `VERSION_NAMES` map (the "Builds by Game Version" chart).
8. `frontend/src/pages/Home.tsx` — add a `latestNews` entry (only the 2 most recent are shown).
9. `frontend/public/llms.txt` — supported-versions list, the intro sentence, and the
   "Data Coverage (Stellaris X.Y)" heading.

*Verification*
10. Diff the new data against the previous version before announcing anything — a patch that adds no
    new IDs can still silently change rules (4.5 rewrote the ethics requirements of 7 civics without
    adding a single new item). Compare **`backend/data/versions/PREV/`**, not `output/versions/PREV/`
    — old output dumps predate the structured-predicate extractor rewrite and produce hundreds of
    lines of phantom diff.
11. `npm run build -w frontend`, then start the backend on a spare port
    (`cd backend && PORT=3099 node index.js`) and curl every game-data endpoint with `?version=NEW`;
    each must return a non-empty payload, and an out-of-range version (`?version=4.9`) must fall back
    to the latest rather than 404.
12. `cd backend && node check_build_rules.js audit` — the violation count should stay in line with the
    previous run (34/70 as of 2026-10-17, excluding throwaway test builds); a sudden jump means the new rules broke the evaluator, not the builds.
13. Icons: a patch with no new civics/traits/origins needs no icon run. If there ARE new IDs, run
    `data-extractor/extract_icons.py` (generates both the 32px build-page PNGs and the 20px
    `icons/home/*.webp` used by home cards, plus the planet icons in `icons/planets/` and the shipset
    previews in `icons/shipsets/` - re-render those when a patch adds a shipset). Sanity-check that every `icon` path in the new JSON
    resolves under `frontend/public/`.
14. Deploy: `npm run build -w frontend` then `pm2 restart stellaris-build` (see Production Deployment).

**When to Re-Extract:**
1. Stellaris major updates (new DLCs, patches)
2. Game balance changes (trait costs, civic effects)
3. Localization updates (text changes)
4. Bug fixes in game files

**Note:** `authorities.json`'s core fields (election rules, tags, modifiers) are not extracted by `extract_all.py` and are hand-maintained - copy from the previous version if unchanged. Its `potential`/`possible` fields (the same requirement DSL as civics/origins, e.g. Machine Intelligence requiring `species_archetype: MACHINE`) ARE extracted, by `extract_authority_rules.py`, and `extract_all.py` auto-merges them into `backend/data/versions/<X.Y>/authorities.json` if that file already exists at extraction time. For a brand-new version, `authorities.json` doesn't exist yet when `extract_all.py` runs (see step 4), so run `extract_authority_rules.py` manually right after copying it from the previous version.

### Key Technical Details

1. **Database Initialization**: Database tables are created automatically on server startup if they don't exist (database.js:12-40)

2. **API Proxy**: Frontend Vite dev server proxies `/api/*` requests to `http://127.0.0.1:3001` (vite.config.ts) - an explicit IPv4 address, as the backend only listens on IPv4 loopback

3. **Data Format**: Build data fields are stored as comma-separated strings in SQLite:
   - `traits`: "trait_intelligent,trait_strong"
   - `ethics`: "ethic_fanatic_militarist,ethic_materialist"
   - `civics`: "civic_police_state,civic_technocracy"
   - `ascension_perks`: "ap_technological_ascendancy,ap_master_builders" (ordered)
   - `traditions`: "tr_expansion,tr_supremacy,tr_prosperity" (ordered)
   - `ruler_trait`: "leader_trait_spark_of_genius" (single value)
   - `youtube_url`: Full YouTube URL (optional)

4. **Soft Delete**: Builds have a `deleted` column (0=visible, 1=hidden). Deleted builds stay in the database for potential recovery.

5. **Authentication**: Local accounts + OAuth (Google + Steam). User sessions managed via express-session. Publishing a build requires authentication (author_id automatically set), or goes through the guest moderation queue; filling the form or importing a file needs neither: `BuildForm.tsx` asks for a login (or a guest name) only at submit time, after every validation step.

6. **Nodemon Limitation**: Backend nodemon only watches `.js` files. If you update JSON data files in `backend/data/`, you must manually restart the backend.

## Common Patterns

### Adding New API Endpoints

1. Add route handler in `backend/index.js`
2. Use `db.all()` for SELECT queries, `db.run()` for INSERT/UPDATE/DELETE
3. Return JSON with appropriate status codes

Example:
```javascript
app.get('/api/new-endpoint', (req, res) => {
  const data = require('./data/new-data.json');
  res.json(data);
});
```

### Adding New Form Fields

1. Add state in `BuildForm.tsx`
2. Add form input with Bootstrap classes (`bg-secondary`, `text-white`, `border-secondary` for dark theme)
3. Include field in POST body (BuildForm.tsx submit handler)
4. Update database schema in `database.js` if needed

### Working with Game Data

**DO NOT edit JSON files directly**. Instead:

1. Modify the Python extraction scripts in `data-extractor/`
2. Re-run the extraction: `python3 extract_all.py <stellaris_path>`
3. Copy updated files to `backend/data/`
4. Restart the backend server

**Reason**: JSON files are auto-generated from Stellaris game files. Manual edits will be overwritten on next extraction.

### Adding Tooltips

All game elements should have tooltip descriptions using the native `title` attribute:

```tsx
<label
  title={item.description || 'No description available'}
>
  {item.name}
</label>
```

### Conditional Filtering (Civics, etc.)

The BuildForm implements conditional filtering based on game rules:

- **Ethics vs Authority**: Authorities have `required_ethics` and `blocked_ethics`
- **Civics vs Ethics/Authority**: Civics have `potential` (visibility) and `possible` (requirements)
- **Traits vs Species Type**: Traits have `allowed_archetypes` array

Use helper functions like `canSelectCivic()`, `canSelectAuthority()`, etc.

### Updating What's New Section

To add a new news item to the home page:

1. Open `frontend/src/pages/Home.tsx`
2. Find the `latestNews` array (around line 65)
3. Add a new entry at the beginning of the array:

```tsx
const latestNews: NewsItem[] = [
  {
    date: '15 Feb 2026',  // Format: 'DD MMM YYYY'
    title: 'Your New Feature Title',
    description: 'Shown under the title. OPTIONAL - omit the field entirely for a title-only item.',
    type: 'feature'  // 'feature' (🎉), 'update' (✨), or 'fix' (🔧)
  },
  // Previous news items...
];
```

4. **Development**: Vite will hot-reload automatically
5. **Production**:
   - Rebuild frontend: `npm run build -w frontend`
   - Restart: `pm2 restart stellaris-build`

**Note**: Only the 2 most recent items are displayed. The banner shows icon + date + NEW badge (if <7 days) + title, followed by the `description` on its own line **when the item has one** — `description` is optional (`description?: string`), so a short item can be title-only. Mixing both in the list is fine and intended.

## Data Quality Standards

All extracted data must be:
- ✅ Fully localized (no IDs like "trait_intelligent", use "Intelligent")
- ✅ Clean descriptions (no `$variables$`, no `§` color codes, no `£` icons)
- ✅ Filtered (no NPC-only content, no obsolete items)
- ✅ Properly typed (modifiers as objects, effects as strings)

## Common Issues

**Issue**: A frontend change does not show up when testing on `http://localhost:3001`
**Solution**: Port 3001 is the backend serving the **built** `frontend/dist`, only refreshed by `npm run build -w frontend`. During development use the Vite server on `http://localhost:3000` (hot reload). The backend's "Access the app at: http://localhost:3001" startup log is misleading in dev.

**Issue**: Origin/civic names show as IDs
**Solution**: Re-run data extraction with `extract_all.py`

**Issue**: Dollar signs in descriptions
**Solution**: The localization parser should resolve these. Re-extract data.

**Issue**: Underscores in names
**Solution**: Check filtering in extraction scripts. Leader traits, NPC civics should be filtered.

**Issue**: Backend doesn't pick up data changes
**Solution**: Nodemon only watches .js files. Manually restart: `killall node && npm run dev -w backend`

**Issue**: Server starts fine but the site shows zero builds
**Solution**: The app is not reading the expected database: SQLite silently creates an empty file wherever it is pointed. Check the `Connected to the SQLite database at ...` startup log against `DB_PATH` (`backend/dbPath.js`; paths are resolved against `backend/`, whatever the working directory). In production, PM2's start command refuses to run without the file and the deploy health check requires a real build.

## Testing

**Google Analytics in tests:** `frontend/index.html` only loads GA on `stellaris-build.com` / `www.stellaris-build.com`, so localhost and test runs never send hits. `trackEvent()` calls still land in `window.dataLayer`, which is what tests should assert on. GA is also skipped when `navigator.webdriver` is true (Playwright/Selenium) - to test the loading gate itself, override it with `addInitScript`.

After making changes to game data:

1. **Verify extraction output**: Check `data-extractor/output/` for clean JSON
2. **Check API responses**: Visit `http://localhost:3001/api/traits` (and other endpoints)
3. **Test in BuildForm**: Reload frontend and check tooltips, filtering, validation
4. **Submit test build**: Ensure data is properly stored in SQLite

## Authentication System

**Implementation:** OAuth 2.0 (Google) + OpenID (Steam)

**Backend:**
- Passport.js handles OAuth flow and session management
- `backend/auth.js` - Strategy configurations
- `backend/index.js` - Auth routes and middleware
- Sessions stored in SQLite (`sessions.db`, via `connect-sqlite3`)
- `isAuthenticated` middleware protects routes requiring login
- Local registration (`/auth/register`) is outside `/api/`, so `apiLimiter` does not cover it: it has its own `registerLimiter` (5 accounts created per hour per IP, failed attempts not counted) and a honeypot field (`components/HoneypotField.tsx`, also the pattern of the guest build form): a filled `website` gets a fake 201, no account. Every per-account limit (comments, ratings, builds) relies on account creation being limited
- Rate limiters (`security.js`) are skipped for requests from the machine itself (`isLocalRequest`, based on `req.ip`). **Never base such checks on `req.hostname`**: behind nginx with `trust proxy`, it comes from `X-Forwarded-Host`, which any client can set
- Custom display names: OAuth users can set unique display_name (3-30 chars, alphanumeric + underscore/dash)
- Collision prevention: display_name uniqueness enforced across all users (both usernames and display_names)

**Frontend:**
- `AuthContext.tsx` - React context for auth state
- `useAuth()` hook - Access user, loading, logout, refreshUser
- Pages needing an account redirect to `/login` with a post-login redirect (see Frontend Architecture > Authentication)
- Navbar displays user info (display_name or username); the "Create Build" link is shown to everyone
- `DisplayNameModal.tsx` - Modal for OAuth users to set/change their custom display name
- "Edit" button in navbar for OAuth users only (local users cannot change display_name)

**User Flow:**
1. User clicks "Sign In" in navbar → redirected to `/login`
2. User clicks Google/Steam button → OAuth flow starts
3. Provider authenticates user → callback to backend
4. Backend creates/finds user in database → session created
5. User redirected to home → frontend fetches user via `/api/user`
6. AuthContext updates; `App.tsx` sends the user back to the page stored by `setPostLoginRedirect()` (30 min expiry), if any - e.g. the build form, where `BuildForm.tsx` restores the draft saved before the OAuth round trip

**Environment Variables Required:**
- `SESSION_SECRET` - Random string for session encryption
- `GOOGLE_CLIENT_ID` - From Google Cloud Console
- `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- `GOOGLE_CALLBACK_URL` - Your domain + `/auth/google/callback`
- `STEAM_API_KEY` - From Steam Web API (optional but recommended)
- `STEAM_RETURN_URL` - Your domain + `/auth/steam/callback`
- `STEAM_REALM` - Your domain (e.g., https://stellaris-build.com/)

## Known Bugs / TODO

- **Scripted variables not resolved in effects text**: Some civics/traits show raw Paradox variable references like `$@civic_tankbound_job_upkeep|0=-%$` instead of numeric values. Fix: `localization_parser.py` needs to load `common/scripted_variables/` and resolve `$@var|format$` syntax.
- **`BuildForm.tsx` feels sluggish in dev mode since the React 19 upgrade (2026-08-18)**: measured click-to-render on a trait checkbox (442 checkboxes on the create-build page) at ~400ms in dev under React 19, vs ~125ms under React 18 and ~100ms in the production build — confirmed by directly A/B-swapping React versions locally, not just suspected. Root cause: React 19's dev build does more diagnostic work per render than React 18's, which compounds with `StrictMode`'s double-render and the fact that toggling one checkbox re-renders all ~442 (no memoization). **Production is unaffected** (dev-only diagnostics are stripped by `vite build`). Fix, if it's worth doing: memoize the trait/civic/ethic checkbox rows in `BuildForm.tsx` (`React.memo` + stable callbacks) so a single toggle doesn't re-render the whole list — would help both the dev experience and prod on slower devices, but it's a real refactor of a ~2500-line file, not attempted yet.

## Future Development

Planned features (not yet implemented):
- User profiles and build history
- Notify a build author of new comments
- Advanced search and filtering
- Build comparison tools
- Community features (favorites, build of the month)
- Build editing (only by author)
- User-specific build management dashboard

## Changelog

Shipped work, its context and the decisions behind it are in `CHANGELOG.md` (newest first).
**Do not add "Recent Completions" / per-feature history to this file**: record each change as a new
entry at the top of `CHANGELOG.md`, and only update this file when the current architecture, commands
or conventions change. When touching a feature, grep `CHANGELOG.md` for its name to get its history.
