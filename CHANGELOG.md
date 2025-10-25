# Stellaris Build v1.3.0 - Quality & Reliability Update

## 🎯 What's New

### Build Editing
- **Edit your own builds** - Authors can now update their submitted builds
- Edit button appears on build detail pages for build owners

### Machine Empires
- **Machine background traits** now available during empire creation
  - War Machine, Research Assistants, Workerbots, Nannybot, Art Generator, Conversational AI
  - Choose your machine's historical purpose (6 mutually exclusive options)

### Search Improvements
- Search now uses **only build/element names** for more accurate results
- No more confusion with IDs or effect descriptions

## 🐛 Bug Fixes

### Visual Issues
- Fixed missing images for various game elements
- Corrected origin image paths (now properly displays mini icons)
- Fixed trait rendering issues (cost objects now display correctly)

### Data Quality
- Removed 138 non-selectable traits from the interface:
  - Auto-mutations and event-only traits
  - Planet preference traits (automatic based on homeworld)
  - Leader traits incorrectly listed as species traits
- Filtered civics requiring unavailable origins
- Removed duplicate ascension perks (Galactic Wonders variants)

### Build Management
- Database cleaned of invalid/outdated game elements
- Fixed name conflict when recreating builds with same name

## 🧪 Testing

- **100% test success rate** (29/29 tests passing)
- Comprehensive image validation for all game elements
- Automated asset testing prevents missing images from reaching production

## 🔧 Technical Improvements

- Optimized data extraction process (filters at source)
- Improved icon extraction for DLC variants
- Better error handling and validation

---

**Total Changes:**
- 172 valid traits (down from 310 - cleaner, more accurate)
- All visible game elements now have proper images
- Enhanced data quality and user experience

Thanks for playing! 🚀
