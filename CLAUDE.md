# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a community website for sharing Stellaris (game) builds. It's a monorepo with a React frontend and Express backend, using SQLite for data persistence.

**Tech Stack:**
- Frontend: React 18 + TypeScript + Vite + Bootstrap 5
- Backend: Express 5 + SQLite3
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

## Architecture

### Monorepo Structure

The project uses npm workspaces with two packages:
- `frontend/` - React/Vite application
- `backend/` - Express API server

### Frontend Architecture (frontend/src/)

**Main Components:**
- `App.tsx` - Root component that fetches and displays builds list, manages build state
- `BuildForm.tsx` - Form component for creating new builds with trait selection
- `main.tsx` - Application entry point

**Data Flow:**
- API calls to `/api/*` endpoints are proxied to backend via Vite config (vite.config.ts:9-14)
- Build form fetches traits from `/api/traits` and posts new builds to `/api/builds`
- App component manages global build state and passes down callbacks

### Backend Architecture

**Entry Point:** `backend/index.js`
- Express server running on port 3001 (configurable via PORT env var)
- Sets up database on startup via `setupDatabase()`

**Database:** `backend/database.js`
- SQLite database stored at `./stellaris_builds.db` (created at runtime)
- Two tables: `users` and `builds`
- Builds table stores game build configurations (civics, traits, DLCs stored as JSON strings)
- Currently users table exists but authentication not implemented

**API Endpoints:**
- `GET /api/test` - Health check
- `GET /api/traits` - Returns static trait data from `backend/data/traits.json`
- `GET /api/builds` - Returns all builds ordered by created_at DESC
- `POST /api/builds` - Creates new build (requires name field)

**Static Data:**
- `backend/data/traits.json` - Stellaris species traits with point costs and effects

### Key Technical Details

1. **Database Initialization**: Database tables are created automatically on server startup if they don't exist (database.js:12-40)

2. **API Proxy**: Frontend Vite dev server proxies `/api/*` requests to `http://localhost:3001` (vite.config.ts:9-14)

3. **Data Format**: Build data fields (civics, traits, DLCs, tags) are stored as comma-separated strings or JSON strings in SQLite

4. **No Authentication Yet**: The users table exists but there's no auth implementation. Builds are created without author_id.

## Common Patterns

### Adding New API Endpoints

1. Add route handler in `backend/index.js`
2. Use `db.all()` for SELECT queries, `db.run()` for INSERT/UPDATE/DELETE
3. Return JSON with appropriate status codes

### Adding New Form Fields

1. Add state in `BuildForm.tsx`
2. Add form input with Bootstrap classes (`bg-secondary`, `text-white`, `border-secondary` for dark theme)
3. Include field in POST body (BuildForm.tsx:56-64)
4. Update database schema in `database.js` if needed

### Working with Traits

Traits are loaded from static JSON file. To modify available traits, edit `backend/data/traits.json` directly.
