# Stellaris Build Sharing

Community-driven web platform for sharing, discovering, and optimizing Stellaris empire builds.

🌐 **Live Site:** https://stellaris-build.com

---

## Current Implementation Status

This project is currently in active development with the following features implemented:

### ✅ Implemented Features

- **Build Creation Form**: Comprehensive form for creating empire builds with:
  - **Species class selection** - 18 species classes dynamically extracted from game files, with archetype mapping (Biological, Lithoid, Machine, Robot, Presapient)
  - Species traits with point/pick validation (budget varies by species archetype - e.g. Machine gets fewer trait points than Biological) and origin bonuses
  - **Secondary species support** for specific origins (Necrophage, Syncretic Evolution, Clone Army, Overtuned)
  - Origins with trait bonuses and conditional UI
  - Starting ruler traits with origin/ethics filtering
  - Ethics with point limits and compatibility checks
  - Authorities with ethics/archetype requirements
  - Civics with conditional filtering (potential/possible) and a 2-civic limit matching the game's own rule
  - Recommended Ascension Perks (with ordering)
  - Recommended Tradition Trees (with ordering)
  - Game version tracking (4.4 Pegasus, 4.3 Cetus, 4.2 Corvus, 4.1 Lyra, 4.0 Phoenix, 3.14 Circinus, 3.13 Vela)
  - Difficulty rating (Overpowered, Strong, Balanced, Challenging, Extreme Challenge)
  - Optional YouTube video link with embedded player
  - **Source URL attribution** for builds from Reddit/forums
  - **Import from .sav files** (automatically extract build data from Stellaris save files)
  - **Import from Empire Designs** (import all empires from `user_empire_designs.txt`)
  - **Nomadic Empire support** (Nomads DLC) - ark type selection with per-tier stats
- **Build Rule Checking (experimental)**: Every build is checked at submit and export time against rules parsed directly from the game's own files - not hardcoded - covering origin/authority/civic compatibility, civic count, and trait budget per species archetype. Shows a non-blocking, plain-English warning ("Authority 'Democratic' requires none of: ethic 'Authoritarian'...") rather than blocking the user. A standalone CLI (`backend/check_build_rules.js`) can audit the whole database or check a single build. About 57% of currently published builds have at least one flagged rule conflict.
- **Export to Stellaris (experimental)**: Generate a custom empire design block ready to paste into `user_empire_designs_v3.4.txt`, so a build can be loaded directly in-game. Runs the same rule check before exporting.
- **Species Portraits**: Portrait selector in the build form; build cards and detail pages display the species portrait alongside civic/trait/origin/ethics/authority icons.
- **Build Display**: View submitted builds with all details, difficulty badges, embedded YouTube videos, and source attribution
- **Build Management**:
  - Soft delete functionality (builds are hidden, not permanently deleted)
  - **Build editing** (authors can edit their own builds)
- **Search & Filtering**: Search builds by name, origin, ethics, tags, difficulty level, game version, and nomadic status
- **Pagination**: Browse builds with paginated, server-side filtered and sorted results
- **Authentication**:
  - OAuth 2.0 (Google) + OpenID (Steam)
  - **Local username/password accounts** with bcrypt hashing
  - **Custom display names** for OAuth users (unique, 3-30 chars)
  - **Persistent sessions** using SQLite (survives server restarts)
  - Session duration: 30 days
  - **Password requirements**: 12+ chars, uppercase, lowercase, number, special character
  - Password reset via email token
- **Ratings**: Star ratings on builds (one per logged-in user, average shown)
- **Community Chat**: IRC-style chat panel on the Feedback page (logged-in or guest with a pseudo), rate-limited, admin moderation
- **Statistics Page**: Admin and public statistics on build usage, version distribution, and popular traits
- **Resources Page**: Curated guides, YouTube channels, tools, and communities, filterable by category and game version
- **Feedback System**: A global button for users to submit feedback and bug reports (with optional screenshot upload), plus a public feedback/bug list with admin resolve controls
- **Social Link Previews**: Per-build Open Graph image generated on demand (species portrait or origin art, build name, origin, authority, ethics), so shared links show a real preview instead of the generic site card
- **Google Analytics**: Visitor tracking and statistics (G-E67MKKS33Q)
- **Security**:
  - Rate limiting (100 requests/15min per IP, 5 builds/hour per user)
  - Input validation and sanitization
  - XSS protection
  - Password complexity requirements (NIST/OWASP compliant)
- **Data Extraction**: Automated, versioned extraction from Stellaris game files with full localization - separate datasets per supported game version (4.2/4.3/4.4)
- **Maintenance Mode**: nginx-level maintenance page, toggled by stopping/restarting the PM2 process
- **Production Deployment**: Fully deployed with HTTPS, auto-restart, SSL certificates, and 100MB file upload support
- **Dynamic Backgrounds**: Random Stellaris loading screen backgrounds that change on page navigation (mobile-optimized)



---

## Tech Stack

**Current Implementation:**

- **Frontend:** React 18 + TypeScript + Vite + Bootstrap 5
- **Backend:** Express 5 + SQLite3
- **Authentication:** Passport.js (Google OAuth 2.0 + Steam OpenID)
- **Build Tool:** Vite
- **Architecture:** Monorepo with npm workspaces
- **Data Extraction:** Python 3 (custom Paradox file parser)
- **Deployment:** PM2 + nginx + Let's Encrypt SSL
- **Hosting:** Dedicated server (Scaleway Dedibox)

---

## Project Structure

```
stellaris_build/
├── frontend/          # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx           # Main app component
│   │   ├── BuildForm.tsx     # Build creation form
│   │   ├── pages/             # BuildDetail, Home, Resources, Stats, Feedback, ...
│   │   ├── components/        # RatingStars, ChatPanel, WhatsNewBanner, ...
│   │   ├── utils/
│   │   │   └── ruleEvaluator.ts  # Evaluates the extracted rule predicates
│   │   └── main.tsx          # Entry point
│   └── package.json
├── backend/           # Express API server
│   ├── index.js              # Server entry point, all API routes
│   ├── database.js           # SQLite setup
│   ├── auth.js                # Passport.js OAuth strategies
│   ├── ogImage.js             # Per-build social preview image generation
│   ├── check_build_rules.js   # Standalone rule-checking CLI (check/check-id/audit)
│   ├── rules/
│   │   └── predicateEvaluator.js  # Shared with check_build_rules.js
│   └── data/
│       ├── versions/          # Game-version-specific data
│       │   ├── 4.2/           # Corvus
│       │   ├── 4.3/           # Cetus
│       │   └── 4.4/           # Pegasus - traits, civics, origins, ethics,
│       │                      #   authorities, ascension_perks, traditions,
│       │                      #   ruler_traits, species_classes, species_archetypes
│       └── resources.json     # Non-versioned: curated community resources
├── data-extractor/    # Python data extraction tools
│   ├── extract_all.py        # Extract all data at once, auto-detects game version
│   ├── paradox_parser.py     # Paradox file format parser
│   ├── localization_parser.py # Extract localized names/descriptions
│   ├── extract_civics_and_origins.py  # Includes the requirement-predicate extractor
│   ├── extract_authority_rules.py     # Authority potential/possible rules
│   ├── extract_species_archetypes.py  # Trait point/pick budget per archetype
│   ├── extract_*.py          # Other individual extractors
│   ├── extract_icons.py      # Extract and convert game icons
│   ├── extract_loading_screens.py # Extract loading screen backgrounds
│   └── output/versions/X.Y/  # Extracted JSON files and images, per game version
├── tests/e2e/          # Playwright end-to-end tests
└── package.json       # Root workspace config
```

---

## Getting Started

### Prerequisites

- **Node.js** (version 18 or higher)
- **npm** (comes with Node.js)
- **Python 3** (for data extraction)
- **Stellaris** installed (for extracting game data)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd stellaris_build

# Install dependencies for all workspaces
npm install
```

### Running the Development Server

```bash
# Start both frontend and backend concurrently
npm run dev

# The application will be available at:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:3001
```

**Or run individually:**

```bash
# Frontend only (Vite dev server)
npm run dev -w frontend

# Backend only (Express server with nodemon)
npm run dev -w backend
```

### Extracting Game Data

The project includes Python scripts to extract data from Stellaris game files:

```bash
cd data-extractor

# Extract all data at once (recommended) - auto-detects the game version from
# launcher-settings.json and writes to output/versions/X.Y/
python3 extract_all.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

# Copy extracted data to the matching versioned backend folder (the script
# prints the exact commands for the detected version at the end of its output)
VERSION=4.4
mkdir -p ../backend/data/versions/$VERSION
cp output/versions/$VERSION/species_archetypes.json ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/traits.json ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/civics_civics_only.json ../backend/data/versions/$VERSION/civics.json
cp output/versions/$VERSION/civics_origins_only.json ../backend/data/versions/$VERSION/origins.json
cp output/versions/$VERSION/ethics.json ../backend/data/versions/$VERSION/
cp output/versions/$VERSION/traditions_by_tree.json ../backend/data/versions/$VERSION/traditions.json
cp output/versions/$VERSION/ascension_perks.json ../backend/data/versions/$VERSION/
# authorities.json is hand-maintained - copy from the previous version if
# unchanged, extract_all.py auto-merges the potential/possible rules into it

# Extract game icons (DDS to PNG conversion)
python3 extract_icons.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

# Copy icons to frontend
cp -r output/icons/* ../frontend/public/icons/

# Extract loading screen backgrounds (DDS to JPG conversion)
python3 extract_loading_screens.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

# Copy loading screens to frontend
cp output/loading_screens/*.jpg ../frontend/public/loading_screens/
```

**Note:** Data extraction is required when:
- Setting up the project for the first time
- Stellaris receives a major update with new content
- You want to update game element descriptions or icons

See `data-extractor/README.md` for detailed extraction documentation.

### Building for Production

```bash
# Build frontend
npm run build -w frontend

# The backend serves the built frontend in production
```

### Deployment (Production Server)

The site is deployed on a dedicated server with the following setup:

```bash
# On the production server

# 1. Update code
cd ~/work/stellaris_build
git pull
npm install

# 2. Rebuild frontend
npm run build -w frontend

# 3. Restart backend (PM2)
pm2 restart stellaris-build

# Useful PM2 commands:
pm2 status                    # Check app status
pm2 logs stellaris-build      # View logs
pm2 restart stellaris-build   # Restart app
pm2 stop stellaris-build      # Stop app
```

**Production Stack:**
- **Process Manager:** PM2 (auto-restart on crash, startup on boot)
- **Reverse Proxy:** nginx (serves static files, proxies API)
- **SSL/TLS:** Let's Encrypt (auto-renewed every 90 days)
- **Domain:** https://stellaris-build.com

---

## Data Extraction

The `data-extractor` folder contains Python tools that parse Stellaris game files and
extract a separate dataset per supported game version (currently 4.2, 4.3, 4.4).
Counts below are for 4.4 "Pegasus":

- **18 Species Classes** (playable only, with archetype mapping)
- **186 Species Traits** (filtered, player-selectable only)
- **58 Origins** (playable only)
- **17 Ethics** (with fanatic variants)
- **7 Authorities** (with ethics/archetype requirements)
- **234 Civics** (filtered, no NPC civics)
- **46 Ascension Perks** (available to players)
- **32 Tradition Trees** (with adoption and completion effects)
- **Species archetype trait budgets** (point/pick limits per BIOLOGICAL/LITHOID/MACHINE/ROBOT/PRESAPIENT)
- **Game Icons** (DDS → PNG conversion for all game elements)
- **Loading Screen Backgrounds** (19 images, DDS → JPG conversion)

All data includes:
- ✅ Fully localized names (English) with recursive directory search
- ✅ Complete descriptions
- ✅ Game effects and modifiers
- ✅ Prerequisites and compatibility rules, as a structured predicate tree (not
  hardcoded) - the same requirement DSL the game itself uses for civics, origins,
  and authorities
- ✅ Automatic filtering of NPC/DLC-specific content

---

## API Endpoints

**Backend runs on `http://localhost:3001`**

Most game-data endpoints accept an optional `?version=X.Y` query param (e.g.
`/api/traits?version=4.3`); the server maps it to the nearest available data
version (currently 4.2, 4.3, or 4.4).

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/test` | GET | Health check |
| `/api/species-classes` | GET | Get all species classes (18 classes with archetype mapping) |
| `/api/species-archetypes` | GET | Get trait point/pick budget per species archetype |
| `/api/traits` | GET | Get all species traits |
| `/api/origins` | GET | Get all origins |
| `/api/ethics` | GET | Get all ethics |
| `/api/authorities` | GET | Get all authorities |
| `/api/civics` | GET | Get all civics |
| `/api/ascension-perks` | GET | Get all ascension perks |
| `/api/traditions` | GET | Get all tradition trees |
| `/api/ruler-traits` | GET | Get all ruler traits (filtered by origin/ethics compatibility) |
| `/api/ark-types` | GET | Get Nomads ark types with per-tier stats |
| `/api/resources` | GET | Get curated community resources |
| `/api/builds` | GET | Get paginated/filtered/sorted builds (excludes soft-deleted) |
| `/api/builds/:id` | GET | Get a single build with resolved names |
| `/api/builds` | POST | Create a new build (requires authentication) |
| `/api/builds/:id` | PUT | Update a build (requires authentication, author only) |
| `/api/builds/:id` | DELETE | Soft delete a build (requires authentication, author only) |
| `/api/builds/:id/rating` | GET | Get average rating and the current user's rating |
| `/api/builds/:id/rating` | POST | Rate a build (requires authentication) |
| `/api/import-build` | POST | Extract a build from an uploaded `.sav` file |
| `/api/list-empires` / `/api/import-empire-designs` | POST | List/import empires from a `user_empire_designs.txt` upload |
| `/api/stats` | GET | Public site statistics |
| `/api/feedback` | GET/POST | List/submit feedback and bug reports |
| `/api/chat` | GET/POST | Community chat messages (rate-limited) |
| `/og/build/:id-:fingerprint.jpg` | GET | Per-build social preview image (generated on demand, cached) |
| `/api/user` | GET | Get current authenticated user |
| `/api/user/display-name` | PATCH | Set a custom display name (OAuth users only) |
| `/auth/google` | GET | Initiate Google OAuth login |
| `/auth/steam` | GET | Initiate Steam OpenID login |
| `/auth/register` / `/auth/login` | POST | Local username/password account creation and login |
| `/auth/forgot-password` / `/auth/reset-password` | POST | Password reset via emailed token |
| `/auth/logout` | GET | Logout and destroy session |

---

## Development

### Frontend Development

```bash
npm run dev -w frontend     # Start dev server
npm run build -w frontend   # Build for production
npm run lint -w frontend    # Run ESLint
npm run preview -w frontend # Preview production build
```

### Backend Development

```bash
npm run dev -w backend      # Start with nodemon (auto-reload)
```

**Note:** Nodemon only watches `.js` files. If you update JSON data files, you'll need to manually restart the backend.

### Testing

The project uses **Playwright** for end-to-end testing.

```bash
# Run all tests (headless)
npm test

# Run tests with UI (interactive mode)
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# View HTML test report
npm run test:report
```

**Current Test Coverage: 55 tests across 9 files**

**Build Display Tests** (`tests/e2e/builds.spec.ts` - 4 tests):
- Display builds list without errors
- Display build detail pages without React errors
- Display all builds from database individually for rendering issues

**CRUD Tests** (`tests/e2e/crud.spec.ts` - 11 tests):
- Build creation (biological/humanoid, machine, lithoid)
- Build validation (trait limits, ethics limits, civic count, required fields)
- Build editing by creator
- Build deletion by creator
- Permission checks for edit/delete
- Re-creation after deletion

**Origin Filtering Tests** (`tests/e2e/origin-filtering.spec.ts` - 6 tests):
- Origin visibility when switching species classes (Humanoid, Lithoid, Machine, Synthetic)
- Test 4 origin pairs (Ocean Paradise/Subaquatic, Post-Apocalyptic/Radioactive, etc.)
- Validate species-specific origin filtering logic

**Trait Budget Tests** (`tests/e2e/machine-trait-budget.spec.ts` - 1 test):
- Confirms the trait point limit shown in the form matches the selected species archetype (e.g. 1 point for Machine, not the Biological default of 2)

**Rule Warning Tests** (`tests/e2e/rule-warning.spec.ts` - 1 test):
- Confirms the non-blocking rule-conflict warning appears on an invalid combination and that "Submit Anyway" still creates the build

**Game Asset Tests** (`tests/e2e/game-assets.spec.ts` - 8 tests):
- Validate ALL game element images exist (no 404 errors)
- Test coverage: traits, origins (original + mini), ethics, authorities, civics, ascension perks, traditions, ruler traits
- Apply same filtering logic as frontend (only test selectable elements)
- Prevent missing images from reaching production

**Import Tests** (`tests/e2e/import.spec.ts` - 8 tests):
- Import a build from a `.sav` file
- List and import empires from a `user_empire_designs.txt` upload

**Resources Page Tests** (`tests/e2e/resources.spec.ts` - 14 tests):
- Category filters, featured resources, SEO meta tags, loading state

**Build Check Tests** (`tests/e2e/build-check.spec.ts` - 2 tests):
- Full frontend TypeScript compilation test
- Type check only test (tsc --noEmit)
- Prevents deployment with TypeScript errors

**Test Strategy:**
- Tests run automatically before production deployments
- Comprehensive coverage: build creation, validation, display, permissions, assets, import, rule checking
- Each build detail page tested individually to catch rendering issues early
- Automated asset validation prevents 404 errors on all game elements

---

## Database

The project uses **SQLite** with the following schema:

### `users` table
- `id` (primary key)
- `username`
- `email`
- `avatar` (profile picture URL)
- `provider` (oauth provider: google/steam, null for local accounts)
- `provider_id` (unique ID from provider)
- `password_hash` (local accounts only, bcrypt)
- `display_name` (custom display name, OAuth users only, unique)
- `is_admin`
- `reset_token` / `reset_token_expires` (password reset)
- `created_at`

### `builds` table
- `id` (primary key)
- `name`
- `description`
- `game_version` (Stellaris version, e.g. 4.4, 4.3, 4.2, ...)
- `difficulty` (optional: overpowered, strong, balanced, challenging, extreme)
- `youtube_url` (optional YouTube video link)
- `source_url` (optional attribution link)
- `species_class` / `portrait` (species class ID and selected portrait)
- `secondary_traits` (comma-separated, for origins with a secondary species)
- `origin` (origin ID)
- `ethics` (comma-separated IDs)
- `authority` (authority ID)
- `civics` (comma-separated IDs)
- `traits` (comma-separated IDs)
- `ruler_trait` (starting ruler trait ID)
- `ascension_perks` (comma-separated, ordered)
- `traditions` (comma-separated, ordered)
- `is_nomadic` / `ark_type` (Nomads DLC)
- `dlcs` (required DLCs)
- `tags` (comma-separated)
- `deleted` (soft delete flag, 0 = visible, 1 = hidden)
- `author_id` (foreign key to users)
- `created_at`
- `updated_at`

### Other tables
- `ratings` - one star rating per user per build
- `feedback` - bug reports and feedback, with admin resolve status
- `chat_messages` - community chat (logged-in or guest)
- `page_views` - basic analytics

**Database file:** `./stellaris_builds.db` (auto-created on first run)

---

## Contributing

When contributing:

1. **Data Updates**: If Stellaris updates, re-run the data extractor
2. **Code Style**: Follow the existing ESLint configuration
3. **Testing**: Test the build form thoroughly before submitting PRs
4. **Documentation**: Update READMEs when adding new features

---

## Roadmap

- [ ] **Comment System**: Discussion threads on each build page (upvotes, replies, moderation).
- [ ] **Predefined Tag System**: Tag builds from a fixed, curated list (not free-text) for consistent search and filtering.
- [ ] **Complete Build Elements**: Add the still-missing pieces of an empire build - ship design/section choices, preferred planet climate, and other elements not yet captured, so a build can fully describe an empire.

---

## License

This project is a community tool for personal use. Stellaris and all game data belong to Paradox Interactive.

---