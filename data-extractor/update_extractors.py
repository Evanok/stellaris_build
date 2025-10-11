#!/usr/bin/env python3
"""
Script to update all extractors to use localization
"""

import re
import os

def update_extractor_file(filename):
    """Update a single extractor file to use localization"""

    if not os.path.exists(filename):
        print(f"Skipping {filename} - file not found")
        return False

    with open(filename, 'r') as f:
        content = f.read()

    # Skip if already updated
    if 'from localization_parser import' in content:
        print(f"Skipping {filename} - already updated")
        return False

    original_content = content

    # Add import
    content = content.replace(
        'from paradox_parser import parse_stellaris_file',
        'from paradox_parser import parse_stellaris_file\nfrom localization_parser import load_all_localizations, get_localized_text, clean_localized_text'
    )

    # Find and update extract functions that process files
    # Pattern: extract_X_from_file(filepath: str) -> add localizations param
    content = re.sub(
        r'def extract_(\w+)_from_file\(filepath: str\) -> List\[Dict\[str, Any\]\]:',
        r'def extract_\1_from_file(filepath: str, localizations: Dict[str, str] = None) -> List[Dict[str, Any]]:',
        content
    )

    # Find and update data extraction functions
    # Pattern: extract_X_data(key, data) -> add localizations param
    content = re.sub(
        r'def extract_(\w+)_data\((\w+)_key: str, \2_data: Dict\[str, Any\]\) -> Dict\[str, Any\]:',
        r'def extract_\1_data(\2_key: str, \2_data: Dict[str, Any], localizations: Dict[str, str] = None) -> Dict[str, Any]:',
        content
    )

    # Update calls to extract_X_data to pass localizations
    content = re.sub(
        r'(\w+) = extract_(\w+)_data\(key, value\)',
        r'\1 = extract_\2_data(key, value, localizations)',
        content
    )

    # Update calls to extract_X_from_file to pass localizations
    content = re.sub(
        r'(\w+) = extract_(\w+)_from_file\(filepath\)',
        r'\1 = extract_\2_from_file(filepath, localizations)',
        content
    )

    # Add localization loading in extract_all_X functions
    # Find the pattern: def extract_all_X(...): with directory setup
    content = re.sub(
        r'(def extract_all_\w+\([^)]+\):.*?if not os\.path\.exists\([^)]+\):.*?sys\.exit\(1\)\n)',
        r'\1\n    # Load localizations\n    print("Loading localizations...")\n    localizations = load_all_localizations(stellaris_path)\n',
        content,
        flags=re.DOTALL
    )

    if content != original_content:
        with open(filename, 'w') as f:
            f.write(content)
        print(f"✓ Updated {filename}")
        return True
    else:
        print(f"⚠ No changes needed for {filename}")
        return False

# Update all extractor files
files = [
    'extract_ascension_perks.py',
    'extract_traditions.py',
    'extract_ethics.py'
]

updated_count = 0
for filename in files:
    if update_extractor_file(filename):
        updated_count += 1

print(f"\n{updated_count} files updated successfully")
