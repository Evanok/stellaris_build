# Stellaris Build Sharing

Community-driven web platform for sharing, discovering, and optimizing Stellaris empire builds.

🌐 **Live Site:** https://stellaris-build.com

---

## Current Implementation Status

This project is currently in active development with the following features implemented:

### ✅ Implemented Features

- **Build Creation Form**: Comprehensive form for creating empire builds with:
  - Primary species type selection (Biological, Lithoid, Machine, Robot)
  - Species traits with point/pick validation and origin bonuses
  - **Secondary species support** for specific origins (Necrophage, Syncretic Evolution, Clone Army, Overtuned)
  - Origins with trait bonuses and conditional UI
  - Starting ruler traits with origin/ethics filtering
  - Ethics with point limits and compatibility checks
  - Authorities with ethics requirements
  - Civics with conditional filtering (potential/possible)
  - Recommended Ascension Perks (with ordering)
  - Recommended Tradition Trees (with ordering)
  - Game version tracking (4.1 Lyra, 4.0 Phoenix, 3.14 Circinus, 3.13 Vela)
  - Difficulty rating (Overpowered, Strong, Balanced, Challenging, Extreme Challenge)
  - Optional YouTube video link with embedded player
  - **Source URL attribution** for builds from Reddit/forums
  - **Import from .sav files** (automatically extract build data from Stellaris save files)
  - **Import from Empire Designs** (import all empires from `user_empire_designs.txt`)

- **Build Display**: View submitted builds with all details, difficulty badges, embedded YouTube videos, and source attribution
- **Build Management**:
  - Soft delete functionality (builds are hidden, not permanently deleted)
  - **Build editing** (authors can edit their own builds)
- **Search & Filtering**: Search builds by name, origin, ethics, tags, and difficulty level
- **Pagination**: Browse builds with paginated results
- **Authentication**:
  - OAuth 2.0 (Google) + OpenID (Steam)
  - **Local username/password accounts** with bcrypt hashing
  - **Persistent sessions** using SQLite (survives server restarts)
  - Session duration: 30 days
  - **Password requirements**: 12+ chars, uppercase, lowercase, number, special character
- **Statistics Page**: Admin and public statistics on build usage.
- **Feedback System**: A global button for users to submit feedback and bug reports.
- **Google Analytics**: Visitor tracking and statistics (G-E67MKKS33Q)
- **Security**:
  - Manual rate limiting (100 requests/15min per IP, 5 builds/hour per user)
  - Input validation and sanitization
  - XSS protection
  - Password complexity requirements (NIST/OWASP compliant)
- **Data Extraction**: Automated extraction from Stellaris game files with full localization
- **Maintenance Mode**: Styled maintenance page with enable/disable scripts
- **Production Deployment**: Fully deployed with HTTPS, auto-restart, SSL certificates, and 100MB file upload support



---

## Tech Stack

**Current Implementation:**

- **Frontend:** React 18 + TypeScript + Vite + Bootstrap 5
- **Backend:** Express 5 + SQLite3
- **Authentication:** Passport.js (Google OAuth 2.0 + Steam OpenID)
- **Build Tool:** Vite
- **Architecture:** Monorepo with npm workspaces
- **Data Extraction:** Python 3 (custom Paradox file parser) + Gemini AI for descriptions
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
│   │   └── main.tsx          # Entry point
│   └── package.json
├── backend/           # Express API server
│   ├── index.js              # Server entry point
│   ├── database.js           # SQLite setup
│   └── data/                 # JSON data files
│       ├── traits.json
│       ├── civics.json
│       ├── origins.json
│       ├── ethics.json
│       ├── authorities.json
│       ├── ascension_perks.json
│       └── traditions.json
├── data-extractor/    # Python data extraction tools
│   ├── extract_all.py        # Extract all data at once
│   ├── paradox_parser.py     # Paradox file format parser
│   ├── localization_parser.py # Extract localized names/descriptions
│   ├── extract_*.py          # Individual extractors
│   └── output/               # Extracted JSON files
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

# Extract all data at once (recommended)
python3 extract_all.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

# Copy extracted data to backend
cp output/*.json ../backend/data/

# Extract game icons (DDS to PNG conversion)
python3 extract_icons.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

# Copy icons to frontend
cp -r output/icons/* ../frontend/public/icons/
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

The `data-extractor` folder contains Python tools that parse Stellaris game files and extract:

- **349 Species Traits** (filtered, player-selectable only)
- **55 Origins** (playable only)
- **17 Ethics** (with fanatic variants)
- **7 Authorities** (with ethics requirements)
- **207 Civics** (filtered, no NPC civics)
- **44 Ascension Perks** (available to players)
- **32 Tradition Trees** (with adoption and completion effects)

All data includes:
- ✅ Fully localized names (English)
- ✅ Complete descriptions
- ✅ Game effects and modifiers
- ✅ Prerequisites and compatibility rules

---

## API Endpoints

**Backend runs on `http://localhost:3001`**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/test` | GET | Health check |
| `/api/traits` | GET | Get all species traits |
| `/api/origins` | GET | Get all origins |
| `/api/ethics` | GET | Get all ethics |
| `/api/authorities` | GET | Get all authorities |
| `/api/civics` | GET | Get all civics |
| `/api/ascension-perks` | GET | Get all ascension perks |
| `/api/traditions` | GET | Get all tradition trees |
| `/api/ruler-traits` | GET | Get all ruler traits |
| `/api/builds` | GET | Get all builds (excludes soft-deleted) |
| `/api/builds` | POST | Create a new build (requires authentication*) |
| `/api/builds/:id` | DELETE | Soft delete a build (requires authentication*) |
| `/api/user` | GET | Get current authenticated user |
| `/auth/google` | GET | Initiate Google OAuth login |
| `/auth/steam` | GET | Initiate Steam OpenID login |
| `/auth/logout` | GET | Logout and destroy session |

**Note:** *Authentication is bypassed on localhost for development convenience.

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

**Current Test Coverage: 29/29 tests passing (100% success rate)**

✅ **Build Display Tests** (`tests/e2e/builds.spec.ts` - 15 tests):
- Display builds list without errors
- Display build detail pages without React errors
- Display all builds from database
- Test all builds individually for rendering issues
- Network error tracking and console error validation
- Regression tests for cost object rendering bug

✅ **Origin Filtering Tests** (`tests/e2e/origin-filtering.spec.ts` - 6 tests):
- Origin visibility when switching species types (BIOLOGICAL, LITHOID, MACHINE, ROBOT)
- Test 4 origin pairs (Ocean Paradise/Subaquatic, Post-Apocalyptic/Radioactive, etc.)
- Validate species-specific origin filtering logic

✅ **Game Asset Tests** (`tests/e2e/game-assets.spec.ts` - 8 tests):
- Validate ALL game element images exist (no 404 errors)
- Test coverage: traits, origins (original + mini), ethics, authorities, civics, ascension perks, traditions, ruler traits
- Apply same filtering logic as frontend (only test selectable elements)
- Prevent missing images from reaching production

**Test Strategy:**
- All tests must pass with **0 errors** and **0 warnings**
- Tests run automatically before production deployments
- Comprehensive coverage: build creation, validation, display, permissions, assets
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
- `provider` (oauth provider: google/steam)
- `provider_id` (unique ID from provider)
- `created_at`

### `builds` table
- `id` (primary key)
- `name`
- `description`
- `game_version` (Stellaris version: 4.1, 4.0, 3.14, 3.13)
- `difficulty` (optional: overpowered, strong, balanced, challenging, extreme)
- `youtube_url` (optional YouTube video link)
- `origin` (origin ID)
- `ethics` (comma-separated IDs)
- `authority` (authority ID)
- `civics` (comma-separated IDs)
- `traits` (comma-separated IDs)
- `ruler_trait` (starting ruler trait ID)
- `ascension_perks` (comma-separated, ordered)
- `traditions` (comma-separated, ordered)
- `dlcs` (required DLCs)
- `tags` (comma-separated)
- `deleted` (soft delete flag, 0 = visible, 1 = hidden)
- `author_id` (foreign key to users)
- `created_at`
- `updated_at`

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

### 🔼 High Priority
- [ ] **Comment System**: Discussion threads on each build page (Upvotes, replies, moderation).
- [ ] **Rating System**: Like/dislike builds.
- [ ] **Improved Build Import**: Enhance the `.sav` file and `user_empire_designs` import to handle more cases and new game content gracefully.
- [ ] **UX/Design Improvements**: Continue refining the overall design, improve usability (e.g., making builds more clickable), and add a banner to the home page.

### ⏹️ Medium Priority
- [ ] **Build Export**: Export builds to a format that can be used in-game.

### 🔽 Low Priority
- [ ] **User Profiles**: With build history and custom usernames.
- [ ] **Favorites/Bookmarks**: Save builds for later.
- [ ] **Weekly Leaderboard**: Showcase top contributors.
- [ ] **Featured Build of the Week**: Spotlight a build weekly.
- [ ] **Build Comparison Tool**: Compare 2-3 builds side-by-side.
- [ ] **Advanced Search**: More detailed and combined filters.
- [ ] **Custom Build Tags**: Allow users to add custom tags to builds.
- [ ] **Synergy Analysis**: Automatically suggest traits/civics that work well together.
- [ ] **Automatic Compatibility Checking**: For new game updates.

---

## License

This project is a community tool for personal use. Stellaris and all game data belong to Paradox Interactive.

---