#!/usr/bin/env python3
"""
Stellaris Localization Parser
Parses Stellaris .yml localization files to extract translations
"""

import os
import re
from typing import Dict, Optional

# Filled by load_all_localizations(): scripted variables (`@name = value`, from
# common/scripted_variables/ and the top of any common/ file) used by
# localization as `$@name|format$`, and the last loaded localizations (to
# resolve `[job.GetNamePlural]` when a caller cleans text without passing them)
_SCRIPTED_VARIABLES: Dict[str, float] = {}
# Scripted localization functions ([GetTelepathPlural] -> localization key of
# their default variant), from common/scripted_loc/
_SCRIPTED_LOC: Dict[str, str] = {}
# Engine functions that had to be guessed from their name, reported at exit
_UNRESOLVED_FUNCTIONS: set = set()


def _report_unresolved_functions():
    if _UNRESOLVED_FUNCTIONS:
        print(f"Localization functions guessed from their name ({len(_UNRESOLVED_FUNCTIONS)}): "
              + ', '.join(sorted(_UNRESOLVED_FUNCTIONS)))


import atexit
atexit.register(_report_unresolved_functions)

# Engine functions with no scripted_loc definition: a neutral word that fits
# the sentence instead of the raw call
ENGINE_FUNCTION_WORDS = {
    'IndividualNamePlural': 'Pops', 'IndividualName': 'Pop', 'SpeciesName': 'species',
    'SpeciesNamePlural': 'species', 'SpeciesAdj': 'species', 'HomeWorldName': 'the homeworld',
    'RulerName': 'the Ruler', 'Name': '', 'Date': '', 'CitizenOrCrew': 'Citizen',
    'CrimeDeviancy': 'Crime',
}
_LAST_LOCALIZATIONS: Dict[str, str] = {}


def load_scripted_variables(stellaris_path: str) -> Dict[str, float]:
    """Collect every numeric `@name = value` defined under common/."""
    variables: Dict[str, float] = {}
    pattern = re.compile(r'^\s*@([A-Za-z0-9_]+)\s*=\s*(-?\d+(?:\.\d+)?)\b', re.MULTILINE)
    for root, _dirs, files in os.walk(os.path.join(stellaris_path, 'common')):
        for filename in files:
            if not filename.endswith('.txt'):
                continue
            try:
                with open(os.path.join(root, filename), encoding='utf-8-sig', errors='replace') as f:
                    content = f.read()
            except OSError:
                continue
            for name, value in pattern.findall(content):
                variables.setdefault(name, float(value))
    return variables


def _blocks(content: str, keyword: str):
    """Bodies of every `keyword = { ... }` block (brace matched)."""
    for match in re.finditer(r'\b' + keyword + r'\s*=\s*\{', content):
        depth, i = 1, match.end()
        while i < len(content) and depth:
            depth += {'{': 1, '}': -1}.get(content[i], 0)
            i += 1
        yield content[match.end():i - 1]


# A variant whose trigger targets one kind of empire is not the generic text
SPECIFIC_EMPIRE_TRIGGER = re.compile(
    r'is_(machine|hive|robot|gestalt|wilderness|nomadic|megacorp)_empire\s*=\s*yes|is_gestalt\s*=\s*yes|'
    r'country_uses_bio_ships\s*=\s*yes|is_catalytic_empire\s*=\s*yes|has_origin')


def load_scripted_loc(stellaris_path: str) -> Dict[str, str]:
    """`defined_text = { name = GetX  text = { trigger = {...} localization_key = A }
    ...  default = B }` -> {GetX: B}. Without `default`, the first variant whose
    trigger does not target a specific kind of empire (machine, hive, bio-ships...):
    the text the game shows a standard empire."""
    functions: Dict[str, str] = {}
    loc_dir = os.path.join(stellaris_path, 'common', 'scripted_loc')
    if not os.path.isdir(loc_dir):
        return functions
    for filename in sorted(os.listdir(loc_dir)):
        if not filename.endswith('.txt') or re.search(r'_(fr|deloc|ruloc)\.txt$|loc_[a-z]{2}\.txt$', filename):
            continue
        with open(os.path.join(loc_dir, filename), encoding='utf-8-sig', errors='replace') as f:
            content = re.sub(r'#[^\n]*', '', f.read())
        # The game files spell it defined_text, define_text and defined_txt
        for body in _blocks(content, r'defined?_te?xt'):
            name = re.search(r'\bname\s*=\s*"?([A-Za-z0-9_]+)"?', body)
            if not name:
                continue
            default = re.search(r'\bdefault\s*=\s*"?([A-Za-z0-9_.]+)"?', body)
            key = default.group(1) if default else None
            # DLC-only text with an empty fallback (`default = BLANK_STRING`):
            # the site assumes every DLC is owned, so the DLC variant wins
            if key == 'BLANK_STRING':
                key = None
            if not key:
                variants = []
                for text in _blocks(body, 'text'):
                    loc_key = re.search(r'\blocalization_key\s*=\s*"?([A-Za-z0-9_.]+)"?', text)
                    if loc_key:
                        variants.append((bool(SPECIFIC_EMPIRE_TRIGGER.search(text)), loc_key.group(1)))
                generic = [k for specific, k in variants if not specific]
                key = (generic or [k for _, k in variants] or ['BLANK_STRING' if default else None])[0]
            if key:
                functions.setdefault(name.group(1), key)
    return functions


def resolve_engine_functions(text: str, localizations: Dict[str, str]) -> str:
    """[GetTelepathPlural] -> Telepaths (scripted_loc default variant),
    [GetSpeciesName] -> species (engine function, neutral word)."""
    def replace(match):
        name = match.group(1)
        key = _SCRIPTED_LOC.get('Get' + name)
        if key == 'BLANK_STRING':
            return ''
        if key and key in localizations:
            return get_localized_text(key, localizations)
        if name in ENGINE_FUNCTION_WORDS:
            return ENGINE_FUNCTION_WORDS[name]
        # Engine job name swaps: [GetBureaucratSwapPluralWithIcon] -> Bureaucrats
        job = re.match(r'^([A-Z][a-z]+)(?:Swap)?(Plural)?(?:WithIcon|Icon)?$', name)
        if job:
            suffix = '_plural' if job.group(2) else ''
            for key in (f'job_{job.group(1).lower()}{suffix}', f'pop_cat_{job.group(1).lower()}{suffix}'):
                if key in localizations:
                    return localizations[key]
        # Unknown engine function: a readable guess from its name
        _UNRESOLVED_FUNCTIONS.add(name)
        words = re.sub(r'(?<!^)(?=[A-Z])', ' ', name).lower()
        return words
    for _ in range(2):  # a resolved key can hold another call
        text = re.sub(r'\[Get([A-Za-z]+)\]', replace, text)
    return text


def format_scripted_variable(value: float, fmt: str) -> str:
    """Render `$@var|fmt$`: `%` = percentage (x100), `+` = explicit sign,
    digits = decimals; color/letter flags (`=`, `G`, `-`) are ignored."""
    if '%' in fmt:
        value *= 100
    digits = re.search(r'\d', fmt)
    text = f'{value:.{int(digits.group(0))}f}' if digits else f'{value:g}'
    if '+' in fmt and value > 0:
        text = '+' + text
    return text + ('%' if '%' in fmt else '')


def resolve_scripted_variables(text: str) -> str:
    def replace(match):
        name, fmt = match.group(1), match.group(2) or ''
        if name not in _SCRIPTED_VARIABLES:
            return match.group(0)
        return format_scripted_variable(_SCRIPTED_VARIABLES[name], fmt)
    return re.sub(r'\$@([A-Za-z0-9_]+)(?:\|([^$]*))?\$', replace, text)


def resolve_scope_references(text: str, localizations: Dict[str, str]) -> str:
    """`[foundry.GetIcon]` -> removed, `[foundry.GetName]` / `[foundry.GetNamePlural]`
    -> the job (or pop category) name, `[Ruler.GetTitle]` -> "Ruler"."""
    text = re.sub(r'\[[A-Za-z0-9_]+\.GetIcon\]\s*', '', text)

    def name(match):
        key, plural = match.group(1), match.group(2) == 'NamePlural'
        for candidate in (f'job_{key}', key):
            loc_key = candidate + ('_plural' if plural else '')
            if loc_key in localizations:
                return localizations[loc_key]
        return key.replace('_', ' ').title() + ('s' if plural else '')
    text = re.sub(r'\[([a-z0-9_]+)\.Get(NamePlural|Name)\]', name, text)
    text = re.sub(r'\[Ruler\.GetTitle\]', 'Ruler', text)
    return text


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

    # Process all .yml files in the directory and subdirectories
    for root, dirs, files in os.walk(localization_dir):
        for filename in files:
            if filename.endswith('.yml'):
                filepath = os.path.join(root, filename)
                file_localizations = parse_localization_file(filepath)
                all_localizations.update(file_localizations)

    print(f"Loaded {len(all_localizations)} localization entries for {language}")

    _LAST_LOCALIZATIONS.clear()
    _LAST_LOCALIZATIONS.update(all_localizations)
    if not _SCRIPTED_VARIABLES:
        _SCRIPTED_VARIABLES.update(load_scripted_variables(stellaris_path))
        print(f"Loaded {len(_SCRIPTED_VARIABLES)} scripted variables")
    if not _SCRIPTED_LOC:
        _SCRIPTED_LOC.update(load_scripted_loc(stellaris_path))
        print(f"Loaded {len(_SCRIPTED_LOC)} scripted localization functions")
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
    # Remove color codes like §Y, §!, §H, §L, §0, etc.
    text = re.sub(r'§[A-Za-z0-9!]', '', text)

    # Scripted variables ($@social_concord_starting_opinion|0$ -> 25) and
    # scope references ([foundry.GetNamePlural] -> Metallurgists)
    text = resolve_scripted_variables(text)
    text = resolve_scope_references(text, localizations or _LAST_LOCALIZATIONS)

    # Remove icon references like £energy£, £pop£, etc.
    text = re.sub(r'£[a-z_]+£', '', text)

    # Remove special formatting like $TABBED_NEW_LINE$
    text = re.sub(r'\$[A-Z_]+\$', '\n', text)

    # Engine / scripted localization calls like [GetTelepathPlural], [GetSpeciesName]
    text = resolve_engine_functions(text, localizations or _LAST_LOCALIZATIONS)
    # A resolved function can bring scripted variables ($@var|fmt$) and job
    # references ([telepath.GetNamePlural]) with it
    text = resolve_scripted_variables(text)
    text = resolve_scope_references(text, localizations or _LAST_LOCALIZATIONS)

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

    # Resolved concepts can bring their own markup back (e.g. "£blocker£ Ancient Stasis Pods")
    text = re.sub(r'§[A-Za-z0-9!]', '', text)
    text = re.sub(r'£[a-z_]+£', '', text)

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
