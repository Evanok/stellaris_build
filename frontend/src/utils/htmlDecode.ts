/**
 * Decode HTML entities in a string
 * Converts things like &#x27; to ' and &quot; to "
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}
