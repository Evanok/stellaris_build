// Cache-busting query strings for static images whose content changed under
// the same filename. nginx serves /icons with a 30-day `immutable` cache, so a
// regenerated file is never re-fetched by returning visitors without this.
// Bump the version whenever the files are regenerated.

// v2 (2026-10-17): origin illustrations re-extracted at their native 220x115
// ratio (were stretched to 256x256), minis now 64px square center crops.
export const ORIGIN_IMAGE_QUERY = '?v=2';

/** Query string to append to /icons/{type}/... for the given icon type. */
export const iconQuery = (type: string): string => (type.startsWith('origin_') ? ORIGIN_IMAGE_QUERY : '');
