"""
Paradox Script Parser
Parses Stellaris game files (Paradox Script format) into Python dictionaries
"""

import re
from typing import Dict, List, Any, Optional


class ParadoxParser:
    """Parser for Paradox Interactive script files (.txt)"""

    def __init__(self):
        self.current_pos = 0
        self.text = ""
        self.line_num = 1

    def parse_file(self, filepath: str) -> Dict[str, Any]:
        """Parse a Paradox script file and return a dictionary"""
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            self.text = f.read()

        self.current_pos = 0
        self.line_num = 1
        return self._parse_object()

    def _skip_whitespace_and_comments(self):
        """Skip whitespace and comments"""
        while self.current_pos < len(self.text):
            # Skip whitespace
            if self.text[self.current_pos].isspace():
                if self.text[self.current_pos] == '\n':
                    self.line_num += 1
                self.current_pos += 1
                continue

            # Skip comments (# until end of line)
            if self.text[self.current_pos] == '#':
                while self.current_pos < len(self.text) and self.text[self.current_pos] != '\n':
                    self.current_pos += 1
                continue

            break

    def _peek_char(self) -> Optional[str]:
        """Peek at the current character without consuming it"""
        self._skip_whitespace_and_comments()
        if self.current_pos < len(self.text):
            return self.text[self.current_pos]
        return None

    def _read_token(self) -> str:
        """Read a token (word, number, or operator)"""
        self._skip_whitespace_and_comments()

        if self.current_pos >= len(self.text):
            return ""

        # String literals (quoted)
        if self.text[self.current_pos] == '"':
            self.current_pos += 1
            start = self.current_pos
            while self.current_pos < len(self.text) and self.text[self.current_pos] != '"':
                self.current_pos += 1
            token = self.text[start:self.current_pos]
            if self.current_pos < len(self.text):
                self.current_pos += 1  # Skip closing quote
            return token

        # Special characters
        if self.text[self.current_pos] in '{}=<>':
            char = self.text[self.current_pos]
            self.current_pos += 1
            # Check for <= >= operators
            if char in '<>' and self.current_pos < len(self.text) and self.text[self.current_pos] == '=':
                self.current_pos += 1
                return char + '='
            return char

        # Regular tokens (words, numbers, identifiers)
        start = self.current_pos
        while (self.current_pos < len(self.text) and
               not self.text[self.current_pos].isspace() and
               self.text[self.current_pos] not in '{}=#"<>'):
            self.current_pos += 1

        return self.text[start:self.current_pos]

    def _parse_value(self) -> Any:
        """Parse a value (can be a string, number, bool, object, or list)"""
        self._skip_whitespace_and_comments()

        char = self._peek_char()

        if char == '{':
            self._read_token()  # consume {
            return self._parse_block()

        token = self._read_token()

        # Try to convert to appropriate type
        if token.lower() == 'yes':
            return True
        elif token.lower() == 'no':
            return False
        elif token.isdigit() or (token.startswith('-') and token[1:].isdigit()):
            return int(token)
        elif self._is_float(token):
            return float(token)
        else:
            return token

    def _parse_block(self) -> Any:
        """Parse a block {...} which can be either an object or a list"""
        # Peek ahead to determine if this is an object (key = value) or list (value value...)
        start_pos = self.current_pos

        # Try to read first token
        first_token = self._read_token()
        if not first_token or first_token == '}':
            # Empty block
            if first_token == '}':
                pass  # Already consumed
            return {}

        # Check next token
        next_token = self._read_token()

        # Reset position
        self.current_pos = start_pos

        # If next token is '=' or other operator, it's an object
        if next_token in ['=', '<', '>', '<=', '>=']:
            return self._parse_object(expect_braces=True)
        else:
            # It's a list
            return self._parse_list()

    def _parse_list(self) -> List[Any]:
        """Parse a list of values { val1 val2 val3 }"""
        result = []

        while True:
            self._skip_whitespace_and_comments()

            char = self._peek_char()
            if char == '}':
                self._read_token()  # consume }
                break

            if self.current_pos >= len(self.text):
                break

            token = self._read_token()
            if not token:
                break

            # Convert token to appropriate type
            if token.lower() == 'yes':
                result.append(True)
            elif token.lower() == 'no':
                result.append(False)
            elif token.isdigit() or (token.startswith('-') and token[1:].isdigit()):
                result.append(int(token))
            elif self._is_float(token):
                result.append(float(token))
            else:
                result.append(token)

        return result

    def _is_float(self, s: str) -> bool:
        """Check if string is a float"""
        try:
            float(s)
            return '.' in s
        except ValueError:
            return False

    def _parse_object(self, expect_braces: bool = False) -> Dict[str, Any]:
        """Parse an object { key = value ... }"""
        result = {}

        while True:
            self._skip_whitespace_and_comments()

            if self.current_pos >= len(self.text):
                break

            char = self._peek_char()

            # Handle closing brace
            if char == '}':
                if expect_braces:
                    self._read_token()  # consume }
                    break
                else:
                    # Unexpected } at root level - this shouldn't happen
                    # but skip it just in case
                    self._read_token()
                    continue

            # Read key
            key = self._read_token()
            if not key:
                break

            # Read operator (usually =, sometimes < > <= >=)
            operator = self._read_token()

            if operator not in ['=', '<', '>', '<=', '>=']:
                # Some files have keys without values
                result[key] = True
                continue

            # Read value
            value = self._parse_value()

            # Handle multiple values for same key (convert to list)
            if key in result:
                if not isinstance(result[key], list):
                    result[key] = [result[key]]
                result[key].append(value)
            else:
                result[key] = value

        return result


def parse_stellaris_file(filepath: str) -> Dict[str, Any]:
    """
    Convenience function to parse a Stellaris file

    Args:
        filepath: Path to the Stellaris .txt file

    Returns:
        Dictionary containing parsed data
    """
    parser = ParadoxParser()
    return parser.parse_file(filepath)
