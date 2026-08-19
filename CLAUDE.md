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
- Markdown rendering: `react-markdown` 10
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
- Note: `requirements.txt` still claims "no external dependencies" — inaccurate, Pillow + ImageMagick are required

**Testing**
- Playwright 1.56 at the repo root (`npm test`, specs in `tests/`)
- No unit-test framework in either workspace (`npm test -w backend` is a stub that exits 1)

**Deployment**
- PM2 + nginx + Let's Encrypt SSL on a Scaleway Dedibox
- Backend on :3001; the Vite dev server proxies `/api/*` to it locally

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
- Connection details (IP, user, SSH/SCP commands): see `CLAUDE.local.md` (not committed — ask the project owner if you don't have it)

```bash
# On production server (stellaris-build.com)

# 1. Update code
cd ~/work/stellaris_build
git pull
npm install

# 2. Rebuild frontend (REQUIRED for frontend changes)
npm run build -w frontend

# 3. Restart backend
pm2 restart stellaris-build

# Useful commands:
pm2 status                  # Check app status
pm2 logs stellaris-build    # View logs
pm2 restart stellaris-build # Restart (backend changes only)
sudo systemctl restart nginx # Restart nginx (if config changed)
```

**Important:**
- Frontend changes require `npm run build -w frontend` before restart
- Backend changes only need `pm2 restart stellaris-build`
- Database is at `/home/arthur/work/stellaris_build/backend/stellaris_builds.db`

**nginx config:** Tracked in the repo at `infra/nginx/stellaris-build.conf` (mirrors the live prod config — edit this file, not the server directly). Deploy changes with `infra/deploy_nginx.sh` (requires `PROD_HOST`, see `CLAUDE.local.md`).

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
- Civics with conditional filtering (potential/possible)
- Recommended Ascension Perks with ordering
- Recommended Tradition Trees with ordering
- Game version tracking
- Optional YouTube video link
- Tooltips with descriptions for all game elements

**Pages:**
- `Home.tsx` - Displays all builds with search, filtering, and pagination
- `Create.tsx` - Build creation page with BuildForm (requires authentication)
- `BuildDetail.tsx` - Individual build view with all details, embedded YouTube videos, and soft delete button
- `Login.tsx` - OAuth login page with Google and Steam buttons
- `Resources.tsx` - Curated community resources page with categorized links to guides, tools, YouTubers, mods, and communities
- `Feedback.tsx` - Feedback & bug reports list (col-lg-8) with community chat sidebar (col-lg-4)

**Authentication:**
- `AuthContext.tsx` - React context providing authentication state and user info
- `useAuth()` hook - Access current user, loading state, logout function
- Protected routes redirect to `/login` if user not authenticated
- Navbar shows user avatar and username when logged in

**Data Flow:**
- API calls to `/api/*` endpoints are proxied to backend via Vite config (vite.config.ts:9-14)
- Build form fetches all game data from respective API endpoints
- App component manages global build state and passes down callbacks
- AuthProvider wraps the entire app to provide authentication state

### Backend Architecture

**Entry Point:** `backend/index.js`
- Express server running on port 3001 (configurable via PORT env var)
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
- SQLite database stored at `./stellaris_builds.db` (created at runtime)
- Tables: `users`, `builds`, `ratings`, `feedback`, `page_views`, `chat_messages`
- Users table: stores OAuth user info (provider, provider_id, username, email, avatar)
- Builds table: stores complete empire configurations with soft delete support and author_id foreign key
- chat_messages table: community chat (content, author_name, author_id nullable, is_guest, deleted, created_at)
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
- `GET /api/builds` - Returns all non-deleted builds ordered by created_at DESC
- `POST /api/builds` - Creates new build (requires authentication, name, checks for duplicates)
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

Non-versioned files (still in `backend/data/`):
- `resources.json` - Curated community resources (not game data)

**Version routing logic (backend/index.js):**
- All game data endpoints accept `?version=X.Y` query param
- `getDataVersion(requestedVersion)` maps any version string to the nearest available data folder
- Versions below the oldest available (4.2) fall back to 4.2
- Versions above the latest available fall back to the latest (4.4)
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

**Process for a new Stellaris version (e.g. 4.5):**
1. Run `extract_all.py` — it auto-detects the version and creates `output/versions/4.5/`
2. Also run separately (not included in extract_all):
```bash
python3 extract_ruler_traits.py "<stellaris_path>"   # output/ruler_traits.json
python3 extract_species_classes.py "<stellaris_path>" # output/species_classes.json
cp output/ruler_traits.json output/versions/4.5/ruler_traits.json
cp output/species_classes.json output/versions/4.5/species_classes.json
```
3. Check for new trait files — each DLC adds a new numbered file (e.g. `18_nomads_species_traits.txt`). Add any new file to the `species_trait_files` list in `extract_traits.py` and re-run.
4. Copy to backend:
```bash
VERSION=4.5
mkdir -p ../backend/data/versions/$VERSION
cp ../backend/data/versions/4.4/authorities.json ../backend/data/versions/$VERSION/  # if unchanged
python3 extract_authority_rules.py "<stellaris_path>" ../backend/data/versions/$VERSION/authorities.json  # refresh potential/possible
cp output/versions/$VERSION/species_archetypes.json ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/traits.json ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/civics_civics_only.json ../backend/data/versions/$VERSION/civics.json
cp output/versions/$VERSION/civics_origins_only.json ../backend/data/versions/$VERSION/origins.json
cp output/versions/$VERSION/ethics.json ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/traditions_by_tree.json ../backend/data/versions/$VERSION/traditions.json
cp output/versions/$VERSION/ascension_perks.json ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/ruler_traits.json ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/species_classes.json ../backend/data/versions/$VERSION/
```
5. Update `AVAILABLE_DATA_VERSIONS` in `backend/index.js` to add `'4.5'`
6. Add `4.5` to `GAME_VERSIONS` in `frontend/src/BuildForm.tsx` (mark as Latest, update previous)
7. Update `latestNews` in `frontend/src/pages/Home.tsx`
8. Rebuild frontend and restart backend

**When to Re-Extract:**
1. Stellaris major updates (new DLCs, patches)
2. Game balance changes (trait costs, civic effects)
3. Localization updates (text changes)
4. Bug fixes in game files

**Note:** `authorities.json`'s core fields (election rules, tags, modifiers) are not extracted by `extract_all.py` and are hand-maintained - copy from the previous version if unchanged. Its `potential`/`possible` fields (the same requirement DSL as civics/origins, e.g. Machine Intelligence requiring `species_archetype: MACHINE`) ARE extracted, by `extract_authority_rules.py`, and `extract_all.py` auto-merges them into `backend/data/versions/<X.Y>/authorities.json` if that file already exists at extraction time. For a brand-new version, `authorities.json` doesn't exist yet when `extract_all.py` runs (see step 4), so run `extract_authority_rules.py` manually right after copying it from the previous version.

### Key Technical Details

1. **Database Initialization**: Database tables are created automatically on server startup if they don't exist (database.js:12-40)

2. **API Proxy**: Frontend Vite dev server proxies `/api/*` requests to `http://localhost:3001` (vite.config.ts:9-14)

3. **Data Format**: Build data fields are stored as comma-separated strings in SQLite:
   - `traits`: "trait_intelligent,trait_strong"
   - `ethics`: "ethic_fanatic_militarist,ethic_materialist"
   - `civics`: "civic_police_state,civic_technocracy"
   - `ascension_perks`: "ap_technological_ascendancy,ap_master_builders" (ordered)
   - `traditions`: "tr_expansion,tr_supremacy,tr_prosperity" (ordered)
   - `ruler_trait`: "leader_trait_spark_of_genius" (single value)
   - `youtube_url`: Full YouTube URL (optional)

4. **Soft Delete**: Builds have a `deleted` column (0=visible, 1=hidden). Deleted builds stay in the database for potential recovery.

5. **Authentication**: OAuth-based authentication (Google + Steam). User sessions managed via express-session. Creating builds requires authentication (author_id automatically set).

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
    description: 'Brief description (not displayed in condensed format)',
    type: 'feature'  // 'feature' (🎉), 'update' (✨), or 'fix' (🔧)
  },
  // Previous news items...
];
```

4. **Development**: Vite will hot-reload automatically
5. **Production**:
   - Rebuild frontend: `npm run build -w frontend`
   - Restart: `pm2 restart stellaris-build`

**Note**: Only the 2 most recent items are displayed. The banner shows: icon + date + NEW badge (if <7 days) + title.

## Data Quality Standards

All extracted data must be:
- ✅ Fully localized (no IDs like "trait_intelligent", use "Intelligent")
- ✅ Clean descriptions (no `$variables$`, no `§` color codes, no `£` icons)
- ✅ Filtered (no NPC-only content, no obsolete items)
- ✅ Properly typed (modifiers as objects, effects as strings)

## Common Issues

**Issue**: Origin/civic names show as IDs
**Solution**: Re-run data extraction with `extract_all.py`

**Issue**: Dollar signs in descriptions
**Solution**: The localization parser should resolve these. Re-extract data.

**Issue**: Underscores in names
**Solution**: Check filtering in extraction scripts. Leader traits, NPC civics should be filtered.

**Issue**: Backend doesn't pick up data changes
**Solution**: Nodemon only watches .js files. Manually restart: `killall node && npm run dev -w backend`

**Issue**: Server starts fine but the site shows zero builds, and a `stellaris_builds.db` appears at the repo root
**Solution**: `database.js` opens `./stellaris_builds.db` — a path relative to the **current working directory**, not to the file. Launching with `node backend/index.js` from the repo root silently creates a fresh empty DB there instead of using `backend/stellaris_builds.db`. Always start from the backend folder (`cd backend && node index.js`) or via `npm run dev -w backend`. Delete the stray root DB if one was created. PM2 sets its own cwd, so prod is unaffected.

## Testing

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
- Custom display names: OAuth users can set unique display_name (3-30 chars, alphanumeric + underscore/dash)
- Collision prevention: display_name uniqueness enforced across all users (both usernames and display_names)

**Frontend:**
- `AuthContext.tsx` - React context for auth state
- `useAuth()` hook - Access user, loading, logout, refreshUser
- Protected routes redirect to `/login` when user is null
- Navbar displays user info (display_name or username) and conditional "Create Build" link
- `DisplayNameModal.tsx` - Modal for OAuth users to set/change their custom display name
- "Edit" button in navbar for OAuth users only (local users cannot change display_name)

**User Flow:**
1. User clicks "Sign In" in navbar → redirected to `/login`
2. User clicks Google/Steam button → OAuth flow starts
3. Provider authenticates user → callback to backend
4. Backend creates/finds user in database → session created
5. User redirected to home → frontend fetches user via `/api/user`
6. AuthContext updates, user can now create builds

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
- Build rating and comments
- Advanced search and filtering
- Build comparison tools
- Community features (favorites, build of the month)
- Build editing (only by author)
- User-specific build management dashboard

---

## Recent Completions

### Structured Rule Extraction + Trait Budget Fix + Export Warnings (2026-08-10)
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

### Social Link Previews (2026-08-10)
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

### Server Perf + Public Repo Hardening (2026-07-07)
Diagnosed intermittent home page freezes (site fully unresponsive while loading, images popping in one by one). Root cause: prod is a single 2-core box where SQLite session writes and static asset serving both compete for Node's 4-slot libuv threadpool.

**Fixes:**
- `UV_THREADPOOL_SIZE=8` default set in `backend/index.js` (before any async I/O)
- Both SQLite DBs switched to WAL mode: `stellaris_builds.db` via `PRAGMA` in `backend/database.js`, `sessions.db` via `concurrentDb: true` on the `connect-sqlite3` store in `backend/index.js`
- nginx now serves `/icons`, `/portraits`, `/loading_screens`, `/assets` directly from disk instead of proxying through Node — see `infra/nginx/stellaris-build.conf` (tracked, mirrors prod) and `infra/deploy_nginx.sh` (deploys + `nginx -t` + graceful reload, needs `PROD_HOST` env var)

**Icon pipeline gap fixed:** `icons/home/*.webp` (20x20, used by home page cards) were never auto-generated for new DLC content — only `icons/{civics,traits,ethics,authorities}/*.png` (32px, build page) were. `data-extractor/extract_icons.py` now generates both together for every extraction run; backfilled 14 civics + 6 traits missing from the Nomads DLC (e.g. `civic_flight_schools`).

**Public repo hardening** (repo is public): prod IP/SSH details moved out of `CLAUDE.md` into `CLAUDE.local.md` (gitignored, auto-loaded by Claude Code same as `CLAUDE.md`); added a "never commit" warning banner at the top of this file; infra scripts (`deploy_nginx.sh`, `fetch_prod_db.sh`) take the server address via `PROD_HOST` env var instead of hardcoding it.

**New script:** `infra/fetch_prod_db.sh` — pulls a consistent snapshot of prod's `stellaris_builds.db` (via `sqlite3 .backup`, safe on a live WAL DB) for local testing; never touches `sessions.db`; backs up the local DB before overwriting.

**Admin pages cleanup:** deleted `frontend/src/pages/AdminFeedback.tsx` and `GET /api/admin/feedback` — fully redundant, the public `/feedback` page already has admin-gated resolve controls hitting the same `PATCH` endpoint. `AdminStats.tsx` kept (shows data with no public equivalent: user counts, signups, referrers) but fixed a missing guard — it only checked login, not `is_admin`.

### Tips & Tricks Page — IN PROGRESS (2026-06-27)
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

### Maintenance Mode Fix (2026-06-27)
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

### Nomadic Empire Feature (2026-06-27)
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

### SetEmailModal Per-User localStorage Fix (2026-06-27)
- Global key `skip_email_prompt` caused "don't show again" to bleed between accounts on the same browser
- Fixed to per-user key `` `skip_email_prompt_${user.id}` `` in both `SetEmailModal.tsx` and `App.tsx`
- Key files: `frontend/src/components/SetEmailModal.tsx`, `frontend/src/App.tsx`

### Home Page Performance Pass (2026-06-20)
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

### Stats Page Improvements + Resources SEO (2026-06-19)

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

### Community Chat on Feedback Page (2026-06-13)
- Added IRC-style chat panel as a sticky sidebar on the Feedback page (col-lg-8 feedback / col-lg-4 chat)
- New `chat_messages` SQLite table (content, author_name, author_id nullable, is_guest, deleted, created_at)
- Backend endpoints: `GET /api/chat` (last 100 msgs), `POST /api/chat`, `DELETE /api/chat/:id` (admin only)
- Rate limiting: 5 messages / 5 min per IP (guests) or user_id (logged-in), in-memory Map with auto-cleanup every 10 min
- Guest users: set a pseudo on first post, stored in `localStorage` as `chat_guest_name`, editable from the panel header
- Admin: red `×` button on each message triggers a Bootstrap modal confirmation before soft-delete
- Polling every 8 seconds; auto-scrolls to bottom only when already near the bottom
- Layout fix: page header (h2 + description) and tabs are full-width above the two-column grid so the chat top aligns exactly with the first feedback card
- Key files: `backend/database.js`, `backend/index.js`, `frontend/src/components/ChatPanel.tsx`, `frontend/src/pages/Feedback.tsx`

### Home Page Performance Optimization (2026-06-13)
- Removed `ReactMarkdown` from build card titles — was instantiating a full markdown parser × 12 cards per page
- Replaced stateful `IconWithFallback` (`useState`) with a stateless `<img onError→display:none>` — eliminated ~96 stateful React components per page load
- Removed `react-markdown` import from `Home.tsx`; the library is now only loaded lazily from `BuildDetail`
- HTTP caching for static assets already set to `maxAge: '30d', immutable` (portraits, icons, loading screens, JS assets)
- Key file: `frontend/src/pages/Home.tsx`

### Species Portrait System (2026-06-07)
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
- ~29 portraits still missing images (psionic_02/05/06/09, bio7/9/10/11, mammalian_ar_03/06/08/09, etc.) — these timed out on wiki; show broken image silently via `onError` handler
- Wiki uses different naming conventions: `Cyber_NN_stage_2.png`, `Synth_NN.png`, `Bio_species_NN.png`, etc.

### AI Search Optimization / LLM SEO (2026-05-22)
- `frontend/public/robots.txt`: Added explicit allow rules for AI crawlers (GPTBot, ChatGPT-User, Google-Extended, ClaudeBot, PerplexityBot, Amazonbot, cohere-ai)
- `frontend/public/llms.txt`: New file (served at `/llms.txt`) — describes the site for LLMs with structured markdown: purpose, what a Stellaris build is, supported versions, data coverage stats
- `frontend/index.html`: Added `WebSite` JSON-LD schema with `SearchAction` — tells LLMs the site is about Stellaris and how to search it
- `frontend/src/pages/Home.tsx`: Added `ItemList` JSON-LD schema (top 20 builds) in Helmet
- `frontend/src/pages/BuildDetail.tsx`: Fixed hardcoded author `"Arthur LAMBERT"` → dynamic `build.author_username || "Community Member"`
- Key files: `frontend/public/robots.txt`, `frontend/public/llms.txt`, `frontend/index.html`, `frontend/src/pages/Home.tsx`, `frontend/src/pages/BuildDetail.tsx`

### Stellaris 4.4 "Pegasus" Support (2026-06-15)
- Added `backend/data/versions/4.4/` with all game data for Pegasus patch
- New content: 4 origins (Voidfarers, Heirs of the Khan, The Sacred Path, Forever Cruise), 16 civics, 8 nomad species traits, 1 ascension perk (Wanderlust)
- `18_nomads_species_traits.txt` added to `species_trait_files` list in `extract_traits.py` (same pattern as `16_infernals_traits.txt` for Infernals DLC)
- `AVAILABLE_DATA_VERSIONS` updated to `['4.2', '4.3', '4.4']` in `backend/index.js`
- Default build version set to 4.4 in `BuildForm.tsx`
- Key files: `backend/data/versions/4.4/`, `backend/index.js`, `frontend/src/BuildForm.tsx`, `frontend/src/pages/Home.tsx`, `data-extractor/extract_traits.py`

### Versioned Game Data + Stellaris 4.3 "Cetus" Support (2026-03-20)
- Game data is now versioned: `backend/data/versions/4.2/` and `backend/data/versions/4.3/`
- All game data API endpoints accept `?version=X.Y` — `getDataVersion()` maps any version string to the nearest available folder
- `BuildDetail` fetches build first via `/api/builds/:id`, then loads game data with the matching version
- `BuildForm` reloads game data when version changes, deselects items no longer valid in the new version
- `extract_all.py` auto-detects game version from `launcher-settings.json`, outputs to `output/versions/X.Y/`
- Home page: added version filter dropdown (populated dynamically from loaded builds)
- Default build version changed to 4.3; old builds without version data fall back to 4.2
- Key files: `backend/index.js`, `frontend/src/pages/BuildDetail.tsx`, `frontend/src/BuildForm.tsx`, `frontend/src/pages/Home.tsx`, `data-extractor/extract_all.py`

### Custom Display Names for OAuth Users (2026-01-11)
- Added display_name system for Google/Steam authenticated users
- Database: New `display_name` column with unique index (allows NULL for users without custom name)
- API endpoint: `PATCH /api/user/display-name` with validation (3-30 chars, alphanumeric + underscore/dash)
- Collision prevention: display_name uniqueness checked against both usernames and other display_names
- Frontend: DisplayNameModal component accessible from navbar for OAuth users only
- Build queries updated: `COALESCE(display_name, username)` shows custom name if set, falls back to OAuth username
- UI: "Edit" button in navbar for OAuth users, modal with real-time validation
- Restriction: Local account users cannot set display_name (they use their username)
- Key files: `backend/database.js`, `backend/index.js`, `frontend/src/components/DisplayNameModal.tsx`, `frontend/src/components/Navbar.tsx`

### What's New Section on Home Page (2026-01-11)
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

### UI Optimization - Reduced Hero Banner Height (2026-01-11)
- Reduced hero banner padding from 4rem to 2rem (50% height reduction)
- Scaled down typography: display-3 → display-5, removed `lead` class
- Compacted build counter widget with smaller padding and text
- Result: Builds visible much faster on page load with less scrolling required
- Key file: `frontend/src/pages/Home.tsx`

### Infernals Species Pack DLC Support (2025-11-25)
- Updated game version to 4.2 "Corvus" (latest) in BuildForm
- Extracted all DLC Infernals content: 2 new origins, 4 new civics, 5 new selectable traits, 1 new ascension perk
- Added `16_infernals_traits.txt` to trait extraction script (was missing, causing 6 traits to be skipped)
- Added new species class INF (Infernal) with 18 total species classes
- Fixed PRE_INF (presapient) appearing as duplicate by adding to NPC filter list
- Extracted 22 new icon files (origins, civics, traits, ascension perks) for DLC content
- Note: Icon extraction now uses PIL instead of Wand (may cause encoding differences in existing files)
- Updated species_classes.json, traits.json, civics.json, origins.json, ascension_perks.json
- Key files: `extract_traits.py`, `extract_species_classes.py`, `BuildForm.tsx`, `backend/data/*.json`

### Icon Optimization & Performance (2025-10-25)
- Optimized icon extraction (32px icons: 2.6MB savings, ~75% reduction)
- Added machine trait filtering (MACHINE/ROBOT species only)
- Implemented background trait disabled UX (instead of auto-replace)
- Fixed BuildDetail loading race condition (Promise.all pattern)
- Added trait counting logic (cost 0 traits excluded from 5-trait limit)
- Created performance and TypeScript validation test suites
- Key files: `extract_icons.py`, `BuildForm.tsx`, `BuildDetail.tsx`, `tests/e2e/performance.spec.ts`

### SEO & Image Lazy Loading (2025-10-26)
- Implemented comprehensive SEO (meta tags, Open Graph, Twitter Cards, JSON-LD structured data)
- Created `robots.txt` and dynamic `/sitemap.xml` endpoint
- Added `react-helmet-async` for per-page meta tags
- Implemented lazy loading (`loading="lazy"`) across all images (50% fewer initial requests)
- Added Google Search Console verification file
- Optimized render blocking resources (preconnect, dns-prefetch)
- Key files: `index.html`, `robots.txt`, `backend/index.js`, `BuildDetail.tsx`, `BuildForm.tsx`

### Species Class Dynamic Extraction (2025-10-26)
- Replaced 4 hardcoded species types with 17 dynamically extracted species classes
- Fixed localization parser to recursively search subdirectories (103k+ entries)
- Filtered 26 NPC-only species classes
- Changed UI from button group to dropdown select
- Updated all E2E tests for dropdown selectors
- Added archetype mapping (BIOLOGICAL, LITHOID, MACHINE, ROBOT, NECROPHAGE)
- Key files: `localization_parser.py`, `extract_species_classes.py`, `species_classes.json`, `BuildForm.tsx`

### Loading Screen Backgrounds (2025-10-26)
- Extracted 19 loading screens from Stellaris (DDS → JPG: 91% size reduction, ~400KB each)
- Implemented random background system at App.tsx level
- Background changes on page navigation (useLocation hook)
- Mobile optimization (no images on screens ≤768px)
- Fixed parallax background with 80% dark overlay
- Key files: `extract_loading_screens.py`, `App.tsx`, `frontend/public/loading_screens/`

### Community Resources Page (2025-11-05)
- Created Resources page with 6 categories, 23+ curated resources
- Implemented category filtering and featured resources system
- Added responsive grid layout and SEO optimization
- Created 14 E2E tests for full functionality coverage
- Resources include YouTube channels, guides, tools, mods, communities
- Key files: `Resources.tsx`, `Resources.css`, `resources.json`, `tests/e2e/resources.spec.ts`
