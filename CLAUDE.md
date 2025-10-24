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

## CURRENT WORK IN PROGRESS (2025-10-24)

### E2E Test Suite - Cleaning Up and Optimizing

**Status:** Test suite improved, 9/15 tests passing (60% success rate)

**Work Completed This Session:**

1. ✅ **Fixed Database Cleanup Between Tests**
   - Added `global-setup.ts` and `global-teardown.ts` to clean test builds before/after test runs
   - Backend endpoint `/api/test/cleanup` deletes builds with names starting with "Test Build"
   - Prevents test pollution and duplicate name errors

2. ✅ **Fixed Duplicate Name Check for Deleted Builds**
   - Backend now allows reusing names of soft-deleted builds (backend/index.js:524, 644)
   - Query checks `deleted=0` when validating duplicate names

3. ✅ **Disabled Rate Limiting for Test Users**
   - Test users bypass rate limiting in `backend/security.js:81-84`
   - Uses `provider='test'` and `provider_id='test-user-id'` to identify test users

4. ✅ **Improved Trait Validation UX in BuildForm**
   - Removed logic that disabled trait checkboxes when limits exceeded
   - Now shows error messages instead of disabling selection (frontend/src/BuildForm.tsx:794-806)
   - Users can see all options and understand why certain combinations don't work

5. ✅ **Fixed Test Trait Selection to Respect Validation Rules**
   - All test builds now use traits with cost ≤2 (MAX_TRAIT_POINTS = 2)
   - Biological/Lithoid tests: Use "Nonadaptive" (cost -2)
   - Machine test: Use "Slow Learners" (cost -1)
   - Tests respect MAX_TRAIT_COUNT = 5 and isBuildComplete() requirements

6. ✅ **Optimized Test Timeouts**
   - Reduced global timeout from 30s to 5s in `playwright.config.ts`
   - Replaced all individual timeout values from 2000ms to 5000ms
   - Tests complete in ~10 seconds total (was 32+ seconds)

**Current Test Results (5s timeout):**
- ✅ **9 passed** / ❌ **5 failed** / ⏭️ **1 skipped**
- **Execution time:** 10.4 seconds
- **Success rate:** 60% (up from 20% with 2s timeout)

**Failing Tests:**
1. `builds.spec.ts:4` - "should display builds list without errors"
   - **Issue:** 3x 404 errors for missing icon/image resources on home page
   - **Not timeout-related** - actual missing resources

2. `builds.spec.ts:94` - "should display all 11 builds without errors"
   - **Issue:** Timeout waiting for h1 selector when iterating through all builds
   - May need longer timeout or pagination optimization

3. `crud.spec.ts:289` - "should require build name"
   - **Issue:** Submit button stays disabled (validation preventing submission)
   - Test expects to click disabled button - needs different assertion approach

4. `crud.spec.ts:318` - "should allow creator to edit their own build"
   - **Issue:** Update button disabled, timeout waiting for click
   - Similar to #3 - validation issue or missing data

5. `crud.spec.ts:396` - "should allow creating new build with same name after deletion"
   - **Issue:** Timeout clicking authority selector
   - May be race condition with form loading

**Files Modified:**
- `frontend/src/pages/BuildDetail.tsx` - Added getTraitCost() helper (previous session)
- `frontend/src/BuildForm.tsx` - Removed trait selection restrictions (lines 794-806)
- `backend/index.js` - Test login endpoint, duplicate name check, test cleanup endpoint
- `backend/security.js` - Rate limiting bypass for test users (lines 81-84)
- `tests/e2e/crud.spec.ts` - Fixed trait selection to use valid low-cost traits
- `tests/e2e/builds.spec.ts` - Build display tests
- `tests/helpers/auth.ts` - Test authentication helpers
- `tests/global-setup.ts` - Pre-test cleanup
- `tests/global-teardown.ts` - Post-test cleanup
- `playwright.config.ts` - Timeout set to 5000ms

**Testing Commands:**
```bash
# Run all tests
npm test

# Run specific test
npx playwright test -g "should create a biological build successfully"

# Run tests with UI
npm run test:ui

# View test report
npm run test:report
```

**Next Steps (For Next Session):**
1. 🔧 **Fix 404 errors** - Identify and add missing image/icon resources
2. 🔧 **Fix validation tests** - Tests that expect to click disabled buttons need different assertions
3. 🔧 **Fix "display all builds" timeout** - May need to increase timeout for this specific test or optimize build detail page loading
4. 🔧 **Fix "edit own build" test** - Debug why update button is disabled
5. 🔧 **Fix "recreate after delete" test** - Debug race condition with form loading
6. 🎯 **Goal: Get all 15 tests passing**
7. 🚀 **Deploy React fix to production** (getTraitCost helper is ready)

**Technical Notes:**
- Test suite uses Playwright with Chromium
- Tests run in parallel with 8 workers
- Global timeout: 5000ms (5 seconds per test)
- Individual waitForSelector timeouts: 5000ms
- Database cleanup runs before and after full test suite
- Test user authentication: `POST /api/test/login` creates test user session
