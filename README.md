# Stellaris Build Sharing

Community-driven web platform for sharing, discovering, and optimizing Stellaris empire builds.

---

## Current Implementation Status

This project is currently in active development with the following features implemented:

### ✅ Implemented Features

- **Build Creation Form**: Comprehensive form for creating empire builds with:
  - Species type selection (Biological, Lithoid, Machine, Robot)
  - Species traits with point/pick validation
  - Origins with trait bonuses
  - Ethics with point limits and compatibility checks
  - Authorities with ethics requirements
  - Civics with conditional filtering
  - Recommended Ascension Perks (with ordering)
  - Recommended Tradition Trees (with ordering)
  - Game version tracking

- **Build Display**: View submitted builds with all details
- **Data Extraction**: Automated extraction from Stellaris game files with full localization
- **Tooltips**: Hover descriptions for all game elements

### 🚧 Planned Features

- User authentication and profiles
- Build rating and comments system
- Search and filtering
- Build comparison tools
- Community features (favorites, build of the month, etc.)
- Exporting empire build from the website in the Stellaris game file to play it right away!

---

## Tech Stack

**Current Implementation:**

- **Frontend:** React 18 + TypeScript + Vite + Bootstrap 5
- **Backend:** Express 5 + SQLite3
- **Build Tool:** Vite
- **Architecture:** Monorepo with npm workspaces
- **Data Extraction:** Python 3 (custom Paradox file parser)

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
```

**Note:** Data extraction is required when:
- Setting up the project for the first time
- Stellaris receives a major update with new content
- You want to update game element descriptions

See `data-extractor/README.md` for detailed extraction documentation.

### Building for Production

```bash
# Build frontend
npm run build -w frontend

# The backend serves the built frontend in production
```

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
| `/api/builds` | GET | Get all builds |
| `/api/builds` | POST | Create a new build |

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

---

## Database

The project uses **SQLite** with the following schema:

### `users` table
- `id` (primary key)
- `username`
- `email`
- `password_hash`
- `created_at`

### `builds` table
- `id` (primary key)
- `name`
- `description`
- `game_version` (Stellaris version)
- `species_type` (BIOLOGICAL, LITHOID, MACHINE, ROBOT)
- `origin` (origin ID)
- `ethics` (comma-separated IDs)
- `authority` (authority ID)
- `civics` (comma-separated IDs)
- `traits` (comma-separated IDs)
- `ascension_perks` (comma-separated, ordered)
- `traditions` (comma-separated, ordered)
- `dlcs` (required DLCs)
- `tags` (comma-separated)
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

## Future Roadmap

### Phase 1: Core Features (Current)
- ✅ Build creation form
- ✅ Data extraction with localization
- ✅ Basic build storage

### Phase 2: User Management
- [ ] User registration and authentication
- [ ] Personal profiles
- [ ] User build library

### Phase 3: Community Features
- [ ] Rating system
- [ ] Comments and discussions
- [ ] Favorites/bookmarks
- [ ] Build of the Month

### Phase 4: Advanced Features
- [ ] Build comparison tools
- [ ] Advanced search and filtering
- [ ] Synergy analysis
- [ ] Build import/export
- [ ] Automatic compatibility checking for game updates

---

## License

This project is a community tool for personal use. Stellaris and all game data belong to Paradox Interactive.

---