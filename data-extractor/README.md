# Stellaris Data Extractor

Python tool to extract game data from Stellaris metadata files and convert them to JSON with full localization support.

## Features

- **Paradox Script Parser**: Generic parser for Paradox Interactive `.txt` format files
- **Localization Parser**: Extracts and resolves localized names and descriptions from YAML files
- **Species Traits Extraction**: Extracts all player-selectable species traits (349 traits)
- **Civics & Origins Extraction**: Extracts all playable civics and origins (207 civics + 55 origins)
- **Ethics Extraction**: Extracts all ethics with their effects and variants (17 ethics)
- **Authorities Extraction**: Extracts all government authorities (7 authorities)
- **Traditions Extraction**: Extracts all tradition trees and individual traditions (234 traditions, 32 trees)
- **Ascension Perks Extraction**: Extracts all player-available ascension perks (44 perks)
- **JSON Export**: Data exported in JSON format for easy use in other applications

## Key Features

✅ **Fully Localized**: All names and descriptions are extracted in English
✅ **Filtered Data**: Only player-accessible content (no NPC-only items, no obsolete content)
✅ **Variable Resolution**: Automatically resolves `$variable$` references in localization
✅ **Clean Output**: No underscores in names, no dollar signs in descriptions

## Prerequisites

- Python 3.6 or higher
- Stellaris installed (tested with Steam version)

## Installation

No external dependencies required - uses only Python standard library.

```bash
# Optional: create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

## Usage

### Complete Extraction (Recommended)

```bash
python3 extract_all.py [path_to_stellaris]
```

Extracts all data: ethics, authorities, traits, civics, origins, traditions, and ascension perks.

**WSL Example:**
```bash
python3 extract_all.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"
```

**Windows Example:**
```bash
python extract_all.py "C:\Program Files (x86)\Steam\steamapps\common\Stellaris"
```

**Outputs:**
- `output/ethics.json` - 17 ethics
- `output/authorities.json` - 7 authorities
- `output/traits.json` - 349 species traits (player-selectable only)
- `output/civics.json` - All civics + origins
- `output/civics_civics_only.json` - 207 civics only (playable)
- `output/civics_origins_only.json` - 55 origins only (playable)
- `output/traditions.json` - 234 traditions
- `output/traditions_by_tree.json` - Traditions organized by tree (32 trees)
- `output/ascension_perks.json` - 44 ascension perks (player-available)

### Individual Extraction

You can also extract each data type separately:

```bash
python3 extract_ethics.py [path]            # Ethics
python3 extract_authorities.py [path]       # Authorities
python3 extract_traits.py [path]            # Traits
python3 extract_civics.py [path]            # Civics & Origins
python3 extract_traditions.py [path]        # Traditions
python3 extract_ascension_perks.py [path]   # Ascension Perks
```

### Default Path

If no path is specified, the script uses the default WSL path:
```
/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris
```

## Data Filtering

The extractors automatically filter out:

- **Leader Traits**: Only species traits are included (83 leader traits filtered)
- **NPC Civics**: Fallen empires, primitives, enclaves, etc. (47 NPC civics filtered)
- **Obsolete Perks**: Perks with `potential = { always = no }` (48 obsolete perks filtered)
- **Duplicate Trees**: Tradition tree duplicates without proper adoption data

## Localization System

The `localization_parser.py` module:

1. **Loads all English localizations** from `localisation/english/*.yml` files
2. **Resolves variable references** like `$civic_name$` recursively (up to 5 iterations)
3. **Cleans markup** (removes color codes `§Y`, icons `£energy£`, etc.)
4. **Handles multiple formats**:
   - `key: "value"`
   - `key:0 "value"`
   - `key: 1 "value"`

**Result**: 69,867 localization entries loaded for English

## Data Structure

### Traits (traits.json)

Each trait contains:
```json
{
  "id": "trait_intelligent",
  "name": "Intelligent",
  "description": "This species is blessed with a greater capacity for abstract thought.",
  "cost": 2,
  "category": "normal",
  "initial": true,
  "randomized": true,
  "opposites": ["trait_erudite", "trait_nerve_stapled"],
  "prerequisites": [],
  "allowed_archetypes": ["BIOLOGICAL", "LITHOID"],
  "tags": ["positive", "organic"],
  "effects": "engineering_research_add: +10%; physics_research_add: +10%; society_research_add: +10%",
  "modifier": {
    "engineering_research_add": 0.1,
    "physics_research_add": 0.1,
    "society_research_add": 0.1
  }
}
```

### Civics (civics.json)

Each civic/origin contains:
```json
{
  "id": "civic_technocracy",
  "name": "Technocracy",
  "description": "This society is led by a council of scientists...",
  "is_origin": false,
  "playable": true,
  "pickable_at_start": true,
  "potential": [],
  "possible": ["NOT auth_corporate"],
  "can_modify": true,
  "effects": "country_scientist_cap_add: +1",
  "modifier": {
    "country_scientist_cap_add": 1
  },
  "enforced_traits": []
}
```

### Traditions (traditions_by_tree.json)

Each tradition tree contains:
```json
{
  "tr_expansion": {
    "name": "tr_expansion",
    "adopt": {
      "id": "tr_expansion_adopt",
      "name": "Expansion Traditions",
      "description": "Pop Growth Speed: +10%",
      "effects": "pop_growth_speed: +10.0%"
    },
    "finish": {
      "id": "tr_expansion_finish",
      "name": "Expansion Traditions Finished",
      "description": "Completing this tradition grants +1 Ascension Perk slot.",
      "effects": "ascension_perks_add: +1"
    },
    "traditions": [
      {
        "id": "tr_expansion_colonization_fever",
        "name": "Colonization Fever",
        "description": "New colonies start with additional pops...",
        "type": "tradition",
        "tree": "expansion"
      }
    ]
  }
}
```

## Architecture

### Main Files

- `paradox_parser.py` - Generic parser for Paradox Script format
- `localization_parser.py` - Localization YAML parser with variable resolution
- `extract_all.py` - Main script to extract all data types
- `extract_ethics.py` - Ethics extractor
- `extract_authorities.py` - Authorities extractor
- `extract_traits.py` - Species traits extractor
- `extract_civics.py` - Civics and origins extractor
- `extract_traditions.py` - Traditions extractor
- `extract_ascension_perks.py` - Ascension perks extractor

### Paradox Script Parser

The `ParadoxParser` handles:
- Comments (`#`)
- Nested objects (`{ }`)
- Operators (`=`, `<`, `>`, `<=`, `>=`)
- Data types: booleans (`yes`/`no`), integers, floats, strings
- Quoted strings
- Multiple keys (converted to lists)

### Stellaris Source Files

**Traits:**
- `common/traits/01_species_traits_habitability.txt`
- `common/traits/02_species_traits_basic_characteristics.txt`
- `common/traits/04_species_traits.txt`
- `common/traits/05_species_traits_robotic.txt`
- DLC files (distant_stars, megacorp, etc.)

**Civics:**
- `common/governments/civics/00_civics.txt`
- `common/governments/civics/00_origins.txt`
- `common/governments/civics/01_special_civics.txt` (filtered)
- `common/governments/civics/02_gestalt_civics.txt`
- `common/governments/civics/03_corporate_civics.txt`

**Ethics:**
- `common/ethics/00_ethics.txt`

**Authorities:**
- `common/governments/00_governments.txt`

**Traditions:**
- `common/traditions/*.txt` (all tradition files)

**Ascension Perks:**
- `common/ascension_perks/00_ascension_paths.txt`
- `common/ascension_perks/00_ascension_perks.txt`

**Localizations:**
- `localisation/english/*.yml` (all English localization files)

## Extension

To add extraction for other data types (technologies, buildings, etc.):

1. Create a new file `extract_xxx.py`
2. Use `paradox_parser.parse_stellaris_file(filepath)` to parse
3. Use `localization_parser.load_all_localizations(stellaris_path)` for names
4. Extract and format relevant data
5. Export to JSON

## Extracted Data Summary

✅ **Implemented:**
- Ethics (17)
- Authorities (7)
- Species Traits (349 - player-selectable only)
- Civics (207 - playable only)
- Origins (55 - playable only)
- Traditions (234 in 32 trees)
- Ascension Perks (44 - player-available only)

✅ **Localization:**
- Full English localization with 69,867 entries
- Automatic variable resolution
- Clean text output (no markup, no dollar signs)

## When to Re-Extract Data

You should re-run the extractor when:

1. **Stellaris Major Updates**: New DLCs or major patches add new content
2. **Game Balance Changes**: Stellaris updates trait costs, civic effects, etc.
3. **Localization Updates**: Text descriptions or translations change
4. **Bug Fixes**: Paradox fixes incorrect data in game files

## Copying Data to Backend

After extraction:

```bash
cd data-extractor

# Copy all extracted data to backend
cp output/traits.json ../backend/data/
cp output/civics_civics_only.json ../backend/data/civics.json
cp output/civics_origins_only.json ../backend/data/origins.json
cp output/ethics.json ../backend/data/
cp output/authorities.json ../backend/data/
cp output/ascension_perks.json ../backend/data/
cp output/traditions_by_tree.json ../backend/data/traditions.json

# Or use extract_all.py which does this automatically
```

## Known Limitations

- ✅ ~~Names are technical keys, not localized~~ **FIXED**: Full localization implemented
- ✅ ~~Dollar signs in descriptions~~ **FIXED**: Variable resolution implemented
- ✅ ~~NPC content included~~ **FIXED**: Filtering implemented
- Some complex scripted effects may not be fully captured
- Dynamic modifiers may not be complete

## Troubleshooting

**Problem**: Extraction produces empty or incomplete data
**Solution**: Verify Stellaris path is correct and files exist

**Problem**: Localization shows IDs instead of names
**Solution**: Check that `localisation/english/` directory exists in Stellaris folder

**Problem**: Dollar signs still appear in text
**Solution**: Re-run extraction - the localization parser should resolve all variables

## Contributing

To report a bug or suggest an improvement, create an issue or pull request.

## License

This project is an extraction tool for personal use. Stellaris and its data belong to Paradox Interactive.
