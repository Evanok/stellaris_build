#!/usr/bin/env python3
"""
Stellaris Localization Parser
Parses Stellaris .yml localization files to extract translations
"""

import os
import re
from typing import Dict, Optional


def parse_localization_file(filepath: str) -> Dict[str, str]:
    """
    Parse a Stellaris localization YAML file

    Args:
        filepath: Path to the .yml localization file

    Returns:
        Dictionary mapping keys to localized strings
    """
    localizations = {}

    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            # Skip the first line (l_english:, l_french:, etc.)
            lines = f.readlines()[1:]

            for line in lines:
                # Skip comments and empty lines
                line = line.strip()
                if not line or line.startswith('#'):
                    continue

                # Parse key:value pairs
                # Format: key: "value" or key:0 "value" or key:1 "value"
                # Try multiple patterns to handle variations
                match = re.match(r'^\s*([a-zA-Z0-9_]+)\s*:\s*"(.+)"', line)  # key: "value"
                if not match:
                    match = re.match(r'^\s*([a-zA-Z0-9_]+):(\d+)\s+"(.+)"', line)  # key:0 "value"
                    if match:
                        # For numbered format, use groups 1 and 3 (skip the number)
                        key = match.group(1)
                        value = match.group(3)
                        localizations[key] = value
                        continue
                if match:
                    key = match.group(1)
                    value = match.group(2)
                    # Clean up the value (remove color codes, etc.)
                    # Keep basic formatting but remove Stellaris-specific markup
                    localizations[key] = value

    except Exception as e:
        print(f"Warning: Error parsing {filepath}: {e}")

    return localizations


def load_all_localizations(stellaris_path: str, language: str = 'english') -> Dict[str, str]:
    """
    Load all localization files for a given language

    Args:
        stellaris_path: Path to Stellaris installation
        language: Language to load (default: english)

    Returns:
        Combined dictionary of all localizations
    """
    localization_dir = os.path.join(stellaris_path, 'localisation', language)

    if not os.path.exists(localization_dir):
        print(f"Warning: Localization directory not found: {localization_dir}")
        return {}

    all_localizations = {}

    # Process all .yml files in the directory
    for filename in os.listdir(localization_dir):
        if filename.endswith('.yml'):
            filepath = os.path.join(localization_dir, filename)
            file_localizations = parse_localization_file(filepath)
            all_localizations.update(file_localizations)

    print(f"Loaded {len(all_localizations)} localization entries for {language}")
    return all_localizations


def get_localized_text(key: str, localizations: Dict[str, str]) -> str:
    """
    Get localized text for a key, with fallback to the key itself
    Recursively resolves variable references like $other_key$

    Args:
        key: The localization key
        localizations: Dictionary of localizations

    Returns:
        Localized text or the key if not found
    """
    text = localizations.get(key, key)

    # Resolve variable references like $civic_life_seeded$
    # Look for $variable_name$ patterns and replace them
    import re
    max_iterations = 5  # Prevent infinite loops
    iteration = 0

    while '$' in text and iteration < max_iterations:
        # Find all $variable$ patterns
        matches = re.findall(r'\$([a-zA-Z0-9_]+)\$', text)
        if not matches:
            break

        changed = False
        for var_name in matches:
            # Try to resolve the variable
            if var_name in localizations:
                resolved = localizations[var_name]
                text = text.replace(f'${var_name}$', resolved)
                changed = True

        if not changed:
            # Can't resolve any more variables
            break

        iteration += 1

    return text


def clean_localized_text(text: str, localizations: Optional[Dict[str, str]] = None) -> str:
    """
    Clean up Stellaris-specific markup from localized text

    Args:
        text: Raw localized text
        localizations: Optional dictionary to resolve concept references

    Returns:
        Cleaned text
    """
    # Remove color codes like §Y, §!, §H, §L, etc.
    text = re.sub(r'§[A-Z!]', '', text)

    # Remove icon references like £energy£, £pop£, etc.
    text = re.sub(r'£[a-z_]+£', '', text)

    # Remove special formatting like $TABBED_NEW_LINE$
    text = re.sub(r'\$[A-Z_]+\$', '\n', text)

    # Remove dynamic function calls like [GetIndividualNamePlural], [GetSpeciesName], etc.
    text = re.sub(r'\[Get[^\]]+\]', 'individuals', text)

    # Remove concept references with comma format like ['edict:energy_drain',Energy Drain]
    # Extract the display name (after the comma) if present, otherwise use the key
    text = re.sub(r"\['[^']+',([^\]]+)\]", r'\1', text)

    # Resolve concept references like ['concept_foo'] or ['building:building_foo']
    if localizations:
        def resolve_concept(match):
            concept_ref = match.group(1)
            # Handle building:building_foo format
            if ':' in concept_ref:
                concept_ref = concept_ref.split(':')[1]

            # Try to resolve the concept
            resolved = get_localized_text(concept_ref, localizations)
            if resolved != concept_ref:
                return resolved
            # If can't resolve, return a cleaned version
            return concept_ref.replace('_', ' ').title()

        text = re.sub(r"\['([^']+)'\]", resolve_concept, text)
    else:
        # If no localizations available, just remove the brackets and clean up
        text = re.sub(r"\['([^']+)'\]", lambda m: m.group(1).split(':')[-1].replace('_', ' ').title(), text)

    # Clean up multiple spaces
    text = re.sub(r'\s+', ' ', text)

    # Clean up newline codes
    text = text.replace('\\n', ' ')

    return text.strip()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        stellaris_path = sys.argv[1]
    else:
        stellaris_path = "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"

    # Test the parser
    localizations = load_all_localizations(stellaris_path)

    # Print some examples
    test_keys = [
        'origin_shroud_forged',
        'origin_shroud_forged_desc',
        'origin_tooltip_shroud_forged_effects'
    ]

    print("\nExample localizations:")
    for key in test_keys:
        value = get_localized_text(key, localizations)
        cleaned = clean_localized_text(value)
        print(f"\n{key}:")
        print(f"  Raw: {value[:100]}...")
        print(f"  Cleaned: {cleaned[:100]}...")
