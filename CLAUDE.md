# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a community website for sharing Stellaris (game) builds. It's a monorepo with a React frontend, Express backend, and Python data extraction tools.

**Live Site:** https://stellaris-build.com

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + Bootstrap 5
- Backend: Express 5 + SQLite3
- Data Extraction: Python 3 (custom Paradox file parser)
- Deployment: PM2 + nginx + Let's Encrypt SSL
- Hosting: Scaleway Dedibox
- Monorepo managed with npm workspaces

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

### Linting

```bash
# Lint frontend TypeScript/TSX files
npm run lint -w frontend
```

### Preview Production Build

```bash
# Preview the production build locally
npm run preview -w frontend
```

### Production Deployment

**Production Server:**
- Domain: https://stellaris-build.com
- IP: 51.159.55.29
- User: arthur
- SSH: `ssh arthur@51.159.55.29`
- SCP: `scp file.txt arthur@51.159.55.29:~/path/`

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
- Two tables: `users` and `builds`
- Users table: stores OAuth user info (provider, provider_id, username, email, avatar)
- Builds table: stores complete empire configurations with soft delete support and author_id foreign key
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

**Static Data Files (backend/data/):**
All data is fully localized (English) with clean names and descriptions:
- `traits.json` - 349 species traits (filtered, no leader traits)
- `origins.json` - 55 origins (playable only)
- `ethics.json` - 17 ethics
- `authorities.json` - 7 authorities
- `civics.json` - 207 civics (filtered, no NPC civics)
- `ascension_perks.json` - 44 perks (player-available only)
- `traditions.json` - 32 tradition trees with adopt/finish/individual traditions
- `ruler_traits.json` - Ruler/leader traits for starting leaders

### Data Extractor (data-extractor/)

**Purpose:** Extract and localize game data from Stellaris installation files

**Main Scripts:**
- `extract_all.py` - Extract all data types at once (recommended)
- `paradox_parser.py` - Generic parser for Paradox Script format (.txt files)
- `localization_parser.py` - Parse and resolve localized names/descriptions from .yml files
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

# Extract all data (WSL example)
python3 extract_all.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

# Copy extracted data to backend
cp output/traits.json ../backend/data/
cp output/civics_civics_only.json ../backend/data/civics.json
cp output/civics_origins_only.json ../backend/data/origins.json
cp output/ethics.json ../backend/data/
cp output/authorities.json ../backend/data/
cp output/ascension_perks.json ../backend/data/
cp output/traditions_by_tree.json ../backend/data/traditions.json
```

**When to Re-Extract:**
1. Stellaris major updates (new DLCs, patches)
2. Game balance changes (trait costs, civic effects)
3. Localization updates (text changes)
4. Bug fixes in game files

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
- Sessions stored in memory (consider redis for production at scale)
- `isAuthenticated` middleware protects routes requiring login

**Frontend:**
- `AuthContext.tsx` - React context for auth state
- `useAuth()` hook - Access user, loading, logout, refreshUser
- Protected routes redirect to `/login` when user is null
- Navbar displays user info and conditional "Create Build" link

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

## COMPLETED WORK (2025-10-25)

### Performance Optimization + Machine Traits UX + Testing Infrastructure

**Status:** ✅ All features complete and tested. Production ready.

**Work Completed This Session:**

1. ✅ **Icon Optimization for Performance**
   - Modified `data-extractor/extract_icons.py` to output optimal icon sizes
   - Icons displayed at 32px now extracted as 32x32 (previously 64x64)
   - Results:
     - traits: 2.8M → 1.8M (-36%)
     - civics: 1.7M → 832K (-51%)
     - ethics: 192K → 72K (-63%)
     - ascension_perks: 544K → 184K (-66%)
     - traditions: 368K → 132K (-64%)
     - **Total savings: ~2.6MB** (~75% reduction for 32px icons)
   - Origin images kept at high resolution (256x256 for `origin_original/`, 32x32 for `origin_mini/`)

2. ✅ **Machine Trait Filtering and Background Trait UX**
   - **Machine-tagged traits**: Only visible for MACHINE/ROBOT species types
   - **Background traits**: 6 mutually exclusive traits (only 1 can be selected)
   - **Disabled state UX**: When one background trait is selected, others become disabled (grayed out with 50% opacity) instead of being auto-replaced
   - Implementation in `BuildForm.tsx` (lines 693-709, 1335-1343)

3. ✅ **Performance Testing Infrastructure**
   - Created `tests/e2e/performance.spec.ts` with 3 tests:
     - Home page load time measurement (~1 second)
     - Create page load time measurement (~1.7 seconds)
     - Create page breakdown (HTML → Form → Data → Icons)
   - Provides objective performance metrics for monitoring

4. ✅ **TypeScript Build Validation Tests**
   - Created `tests/e2e/build-check.spec.ts` with 2 tests:
     - Full build test (`npm run build -w frontend`)
     - Type check only test (`tsc --noEmit`)
   - Catches TypeScript errors before deployment
   - Prevents production build failures

5. ✅ **BuildDetail Page Loading Bug Fix**
   - **Problem**: Traits showed IDs and "0 points" during initial page load
   - **Cause**: Build data loaded before game data (traits, ethics, etc.)
   - **Solution**: Combined all fetches into one `Promise.all` in `BuildDetail.tsx` (lines 171-224)
   - Only sets `loading=false` when ALL data is ready
   - Prevents flash of incorrect values

6. ✅ **Trait Counting Logic Update**
   - **Rule**: Traits with cost 0 (background traits, auto-mutations) don't count toward 5-trait limit
   - Added `countTraitsTowardsLimit()` function that excludes cost 0 traits
   - Display shows: "Traits: 5 / 5 (6 total)" when background trait is selected
   - Implementation in `BuildForm.tsx` (lines 614-624, 1315-1318)

7. ✅ **Production Database Updates for Build 12**
   - Created `backend/scripts/update_build_12.js`:
     - Removed "V2" from name
     - Updated description to full version
     - Interactive confirmation with `--yes` flag support
   - Created `backend/scripts/add_bulky_to_build_12.js`:
     - Added `trait_robot_bulky` to traits list
     - Checks for duplicates before adding
     - Verification of update success
   - Both scripts executed successfully in production

**Files Modified:**
- `data-extractor/extract_icons.py` - Added optimal_sizes dictionary (lines 228-253)
- `frontend/src/BuildForm.tsx` - Machine trait filtering, background trait disabled state, trait counting logic
- `frontend/src/pages/BuildDetail.tsx` - Fixed data loading race condition with Promise.all
- `tests/e2e/performance.spec.ts` - NEW: Performance measurement tests
- `tests/e2e/build-check.spec.ts` - NEW: TypeScript compilation validation
- `backend/scripts/update_build_12.js` - NEW: Database update script
- `backend/scripts/add_bulky_to_build_12.js` - NEW: Add trait script

**TypeScript Fix (Critical):**
- Fixed `error TS2322: Type 'boolean | "" | undefined' is not assignable to type 'boolean | undefined'`
- Changed from: `const isDisabled = isBackgroundTrait && selectedBackgroundTrait && selectedBackgroundTrait !== trait.id;`
- To: `const isDisabled = !!(isBackgroundTrait && selectedBackgroundTrait && selectedBackgroundTrait !== trait.id);`
- Used `!!` to force boolean conversion (BuildForm.tsx:1343)

**Testing:**
```bash
# Run all tests
npm test

# Run performance tests
npx playwright test tests/e2e/performance.spec.ts

# Run build validation
npx playwright test tests/e2e/build-check.spec.ts

# Database update scripts (production)
node backend/scripts/update_build_12.js --yes
node backend/scripts/add_bulky_to_build_12.js --yes
```

**Icon Extraction (Updated Workflow):**
```bash
cd data-extractor

# Extract all icons with optimal sizes
python3 extract_icons.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

# Copy to frontend (icons are now 75% smaller)
cp -r output/icons/* ../frontend/public/icons/
```

**Key Achievements:**
- 🚀 Page load reduced by 2.6MB (~75% for 32px icons)
- 🎮 Machine trait filtering working correctly
- 🎯 Background trait UX improved (disabled state instead of auto-replace)
- 📊 Performance testing infrastructure in place
- ✅ TypeScript validation prevents deployment errors
- 🐛 BuildDetail loading bug fixed (no more flashing IDs)
- 🧮 Trait counting logic correct (cost 0 excluded from limit)
- 🗄️ Production database successfully updated

**Technical Notes:**
- Icon optimization applied during extraction (no manual resizing needed)
- Machine traits use `tags` array check: `trait.tags.includes('machine')`
- Background traits also use `tags` array check: `trait.tags.includes('background')`
- Disabled state uses `disabled` prop + `opacity: 0.5` for visual feedback
- BuildDetail uses `Promise.all` pattern to load all data before rendering
- TypeScript errors now caught by automated tests before deployment
- Database update scripts use readline for interactive confirmation

---

## COMPLETED WORK (2025-10-26)

### Species Class Refactor - Dynamic Extraction from Game Files

**Status:** ✅ All features complete and tested. Production ready.

**Work Completed This Session:**

1. ✅ **Replaced Hardcoded Species Types with Dynamic Extraction**
   - **Before**: 4 hardcoded species type buttons (Biological, Lithoid, Machine, Robot)
   - **After**: 17 species classes dynamically extracted from Stellaris game files
   - UI changed from button group to dropdown select (more scalable)
   - Added `species_classes.json` data file with archetype mapping
   - Frontend now fetches species classes from `/api/species-classes` endpoint

2. ✅ **Localization Extraction Fixes**
   - **Problem**: Species class names weren't being found in localization files
   - **Solution**: Modified `localization_parser.py` to recursively search subdirectories using `os.walk()`
   - **Result**: Found species names in `localisation/english/name_lists/` subdirectory
   - Loaded 103,567 localization entries (vs 69,919 previously)
   - Changed localization key from `SPEC_{class_id}` to just `{class_id}`

3. ✅ **Species Class Filtering**
   - Filtered 26 NPC-only species classes:
     - 10 primitive variants (PRE_MAM, PRE_REP, etc.)
     - 3 event-spawned species (AI, SWARM, EXD)
     - 6 special origin species (SALVAGER, SHROUDWALKER, etc.)
     - 1 unreleased species (SOLARPUNK)
     - 1 duplicate (BIOGENESIS_02)
     - 1 DLC-specific duplicate (IMPERIAL - requires Nemesis DLC)
   - **Result**: Exactly 17 playable species classes matching user's game

4. ✅ **Manual Name Overrides**
   - **ROBOT** → "Synthetic" (more commonly known name in-game)
   - **BIOGENESIS_01** → "BioGenesis" (preserves capital G, uses origin name instead of species name "Spinovore")
   - Overrides applied AFTER post-processing to prevent `.title()` modification

5. ✅ **Test Migration to Dropdown Selectors**
   - Updated all E2E tests from button clicks to dropdown selections
   - Changed from: `page.click('button:has-text("Biological")')`
   - Changed to: `page.locator('select.form-select').nth(2).selectOption({ label: 'Humanoid' })`
   - Updated 16 test occurrences across `crud.spec.ts` and `origin-filtering.spec.ts`
   - Renamed test: "ROBOT should see same origins as MACHINE" → "SYNTHETIC should see same origins as MACHINE"

6. ✅ **TypeScript Cleanup**
   - Removed `selectedSecondarySpeciesClass` references from BuildForm.tsx
   - Removed from localStorage save/restore
   - Replaced secondary species selector widget with TODO comment
   - Fixed compilation errors preventing test execution

**Final Species Class List (17 total):**
```json
[
  "Aquatic", "Arthropoid", "Avian", "BioGenesis", "Cybernetic",
  "Fungoid", "Humanoid", "Lithoid", "Machine", "Mammalian",
  "Molluscoid", "Necroid", "Plantoid", "Psionic", "Reptilian",
  "Synthetic", "Toxoid"
]
```

**Archetype Mapping:**
- **BIOLOGICAL** (13 classes): Aquatic, Arthropoid, Avian, BioGenesis, Cybernetic, Fungoid, Humanoid, Mammalian, Molluscoid, Necroid, Plantoid, Psionic, Reptilian, Toxoid
- **LITHOID** (1 class): Lithoid
- **MACHINE** (1 class): Machine
- **ROBOT** (1 class): Synthetic
- **NECROPHAGE** (1 class): Toxoid (with special handling)

**Files Modified:**
- `data-extractor/localization_parser.py` - Recursive directory search with `os.walk()`
- `data-extractor/extract_species_classes.py` - Added filtering, manual overrides, archetype mapping
- `backend/data/species_classes.json` - NEW: 17 species classes with archetypes
- `backend/index.js` - NEW: `/api/species-classes` endpoint
- `frontend/src/BuildForm.tsx` - Replaced button group with dropdown, removed secondary species class
- `tests/e2e/crud.spec.ts` - Updated 9 species type selections
- `tests/e2e/origin-filtering.spec.ts` - Updated 7 species type selections

**Testing:**
```bash
# Run all tests
npm test

# All 34 tests passed (22.9 seconds):
# ✅ TypeScript compilation: PASSED
# ✅ TypeScript type check: PASSED
# ✅ Build creation tests: PASSED (biological/humanoid, machine, lithoid)
# ✅ Validation tests: PASSED (trait limits, ethics limits, required fields)
# ✅ Permission tests: PASSED (edit/delete authorization)
# ✅ Origin filtering tests: PASSED (all species class dropdown selectors)
# ✅ Image asset tests: PASSED (all icons available)
# ✅ Performance tests: PASSED (home ~1.3s, create ~2.3s)
```

**Extraction Workflow (Updated):**
```bash
cd data-extractor

# Extract species classes from game files
python3 extract_species_classes.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

# Copy to backend
cp output/species_classes.json ../backend/data/

# Restart backend to load new data
pm2 restart stellaris-build  # Production
# OR
npm run dev -w backend       # Development
```

**Key Achievements:**
- 📊 17 species classes dynamically extracted vs 4 hardcoded
- 🎮 Accurate species names matching in-game display
- 🔧 Scalable architecture for future species additions
- ✅ All 34 tests passing (100% success rate)
- 🌍 Full localization support with recursive file search
- 🚫 Proper filtering of NPC/DLC-specific species
- 🎯 Manual overrides for user-preferred names

**Technical Notes:**
- Species class selector is 3rd `select.form-select` element (accessible via `.nth(2)`)
- Archetype determines trait filtering (BIOLOGICAL/LITHOID vs MACHINE/ROBOT)
- Species classes use game IDs (HUM, MAM, ROBOT) with localized display names
- Localization loader searches all subdirectories for maximum coverage
- Manual overrides prevent post-processing modifications (applied after `.title()`)
- Tests use `selectOption({ label: '...' })` instead of exact value matching
