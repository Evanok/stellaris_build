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
- `Resources.tsx` - Curated community resources page with categorized links to guides, tools, YouTubers, mods, and communities

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
- `GET /api/resources` - Returns curated community resources (YouTube channels, guides, tools, mods, communities)

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
- `resources.json` - Curated community resources organized by category (YouTube, guides, tools, streamers, mods, communities)

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
- Sessions stored in SQLite (via `better-sqlite3-session-store`)
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
