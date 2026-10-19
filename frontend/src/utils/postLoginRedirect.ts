// Remembers where to send the visitor once they are logged in.
//
// Every login path (local form, Google, Steam) ends on '/' - OAuth callbacks are
// server-side redirects - so without this a visitor who was sent to log in from a
// create/import page lands on the home page and loses their place. App.tsx
// consumes the value as soon as the user is known.

const STORAGE_KEY = 'post_login_redirect';
// A stale value from an abandoned login must not hijack a later, unrelated visit
const MAX_AGE_MS = 30 * 60 * 1000;

export function setPostLoginRedirect(path: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Storage unavailable (private mode...): the visitor just lands on '/'
  }
}

export function consumePostLoginRedirect(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    localStorage.removeItem(STORAGE_KEY);
    const { path, at } = JSON.parse(raw);
    // Same-origin paths only ('//host' would be protocol-relative)
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return null;
    if (typeof at !== 'number' || Date.now() - at > MAX_AGE_MS) return null;
    return path;
  } catch {
    return null;
  }
}
