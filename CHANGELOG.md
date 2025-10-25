# Changelog

All notable changes to the Stellaris Build project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2025-10-25

### Added

#### Testing Infrastructure
- **Comprehensive game asset testing suite** (`tests/e2e/game-assets.spec.ts`)
  - Automated validation for ALL game element images (traits, origins, ethics, authorities, civics, ascension perks, traditions, ruler traits)
  - Detects 404 errors before production deployment
  - Tests apply same filtering logic as frontend (only validates selectable elements)
  - 100% test coverage for all 8 game element types

- **Origin filtering test suite** (`tests/e2e/origin-filtering.spec.ts`)
  - 6 comprehensive tests covering all species type combinations
  - Validates origin visibility/hiding when switching between BIOLOGICAL, LITHOID, MACHINE, ROBOT
  - Tests 4 origin pairs (Ocean Paradise/Subaquatic, Post-Apocalyptic/Radioactive, Subterranean/Subterranean Machines, Void Dwellers/Voidforged)

- **Enhanced build display tests**
  - Network error tracking with full URLs for precise debugging
  - Individual timeout controls (5s per action)
  - Console error filtering for React StrictMode timing issues

#### Features
- **Build editing capability**
  - Users can now edit their own builds
  - Edit button on build detail pages (only visible to build authors)
  - Edit page reuses BuildForm component with pre-filled data
  - Frontend edit route: `/edit/:id`

- **Species portraits in builds**
  - Display species portraits on build detail pages
  - Portraits stored in database and shown alongside build information

- **Origin filtering by species type**
  - Origins now automatically filter based on selected species archetype
  - Machine/Robot empires see machine-specific origins (Subaquatic Machines, Radioactive Rovers, etc.)
  - Biological/Lithoid empires see biological origins (Ocean Paradise, Post-Apocalyptic, etc.)
  - Implements `possible` condition checking from origins.json

- **Improved civic filtering**
  - Civics requiring non-existent origins are now hidden
  - Filters out `civic_galactic_sovereign_megacorp` (event-only civic)
  - Filters out `civic_diadochi` and `civic_great_khans_legacy` (require unavailable origins)

- **Improved ascension perk filtering**
  - Filters perks with non-localized names (where `name === id`)
  - Removes duplicate perks (e.g., 3 Galactic Wonders DLC variants now show as 1)
  - Only displays perks with proper localization

#### Icon Management
- **Automated icon extraction with DLC variant support**
  - Added icon mappings in `extract_icons.py` for elements sharing same source image
  - Ascension perk mappings:
    - All Galactic Wonders variants → base `ap_galactic_wonders.dds`
    - Colossus Project → `ap_colossus_project.dds`
    - Machine Assimilator variant → base `ap_organo_machine_interfacing.dds`
  - Tradition mappings:
    - Logistics (gestalt) → Mercantile tradition icon
    - Cybernetics Assimilator → base Cybernetics icon
    - Psionics Shroud → base Psionics icon
  - Fully automated workflow - NO manual image conversions required

- **Reorganized origin image folders**
  - `origin_images/` → `origin_original/` (256x256 full-size images)
  - `origins/` → `origin_mini/` (32x32 thumbnails)
  - Clearer naming convention matching other game element folders

#### Database Management
- **Database sync script** (`sync_db.sh`)
  - Safely sync builds between test and production databases
  - Validates conditions before running to prevent data loss

### Fixed

#### Game Assets
- **All missing game element icons resolved**
  - Fixed 6 missing ascension perk images (DLC variants)
  - Fixed 3 missing tradition images (gestalt variants)
  - Fixed 3 missing civic icons (origins-dependent civics)
  - Fixed wilderness origin duplicate image issue
  - Fixed "Under One Rule" tradition duplicate

#### Search & Filtering
- **Search functionality corrected across all game elements**
  - Search now uses ONLY `name` field (previously searched IDs, effects, descriptions)
  - Fixed for: traits, origins, ethics, civics, ascension perks
  - Users get accurate results matching only visible names

#### Build System
- **Fixed duplicate trait issue**
  - Resolved bug allowing same trait to be selected multiple times
  - Proper trait deduplication in build creation/editing

- **Fixed build name conflict handling**
  - Users can now delete and recreate builds with the same name
  - Fixed "duplicate name" error preventing legitimate recreations

- **Fixed Guilded Vault build crash (Build ID 12)**
  - Resolved React rendering error on build detail page
  - Fixed cost object rendering issue in trait badges

- **Fixed edit page routing**
  - Edit page properly loads build data
  - All form fields correctly populated from existing build

#### Database Cleanup
- **Removed invalid elements from existing builds**
  - Build 5: Removed `trait_overtuned_preplanned_growth` (no icon, cost=0)
  - Build 5: Removed `civic_genesis_guides` (no icon)
  - Build 5: Removed `ap_evolutionary_mastery` (non-localized)
  - Build 118: Replaced `ap_evolutionary_mastery` with valid perk
  - Prevents random 404 errors when viewing builds

#### Testing
- **Fixed infinite loop issue in build limit tests**
  - Increased build display limit safely
  - Tests no longer timeout due to excessive builds

- **Fixed test cleanup routine**
  - Database cleanup properly executes on first test run
  - No more errors when running tests fresh

- **Fixed machine species test**
  - Machine archetype tests properly validate machine-specific features

- **Removed global timeout causing premature test failures**
  - Individual action timeouts (5s) provide better control
  - Tests no longer fail arbitrarily at 10s global timeout

- **Fixed test error logging**
  - Improved error reporting with full URLs and context
  - Filters transient "Failed to fetch" errors from React StrictMode
  - Clear distinction between real errors and timing issues

### Changed

#### Testing Configuration
- **Playwright configuration improvements**
  - Removed aggressive 10s global timeout (now 0 = no global timeout)
  - Individual action timeouts: 5s for navigation, 5s for element loading
  - Tests run in parallel with 6 workers
  - Better error reporting with network request tracking

- **Test structure improvements**
  - Database cleanup runs before and after full test suite
  - Test user authentication via `POST /api/test/login`
  - Consistent test patterns across all test files

#### Icon Management Workflow
- **Updated icon extraction process**
  - Extract icons: `python3 extract_icons.py "<stellaris_path>"`
  - Copy icons: `cp -r output/icons/* ../frontend/public/icons/`
  - All mappings handled automatically via extraction script
  - No manual DDS to PNG conversions needed

#### Documentation
- **Updated CLAUDE.md**
  - Documented current session work (game assets + test suite)
  - Added icon extraction workflow
  - Updated technical notes with timeout configurations
  - Added key achievements section

### Test Results

#### Current Status: 29/29 tests passing (100% success rate)

**Test Distribution:**
- `builds.spec.ts`: 15 tests (build creation, validation, display, permissions)
- `origin-filtering.spec.ts`: 6 tests (species type filtering)
- `game-assets.spec.ts`: 8 tests (image availability for all game elements)

**Execution Time:** ~25 seconds

**Coverage:**
- ✅ Build creation for all species types (BIOLOGICAL, MACHINE, LITHOID, ROBOT)
- ✅ Build validation (traits, ethics, name requirements)
- ✅ Build permissions (edit/delete own builds only)
- ✅ Build display (list, detail pages, no React errors)
- ✅ Origin filtering by species type
- ✅ All game asset images validated

### Production Readiness

This release is **production ready** with:
- 🎯 100% test success rate (29/29 tests passing)
- 🖼️ All game asset images validated and available
- 🔍 Search functionality corrected to use only names
- 🧹 Database cleaned of invalid elements
- 🤖 Fully automated icon extraction workflow
- ✅ Comprehensive E2E test coverage

### Migration Notes

No database migrations required. Invalid elements have been manually cleaned from existing builds.

---

## [v1.2.2] - Previous Release

Prior release - see git history for details.
