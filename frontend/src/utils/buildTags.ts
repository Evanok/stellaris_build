// Hardcoded build tags. The list lives in shared/build_tags.json so the backend validates
// against exactly the same ids (see backend/security.js).
import buildTagsData from '../../../shared/build_tags.json';

export interface BuildTag {
  id: string;
  group: string;
  label: string;
  description: string;
}

export interface BuildTagGroup {
  id: string;
  label: string;
}

export const BUILD_TAGS: BuildTag[] = buildTagsData.tags;
export const BUILD_TAG_GROUPS: BuildTagGroup[] = buildTagsData.groups;
export const MAX_TAGS_PER_BUILD: number = buildTagsData.maxPerBuild;
const EXCLUSIVE_PAIRS: string[][] = buildTagsData.exclusive;

const TAGS_BY_ID = new Map(BUILD_TAGS.map(tag => [tag.id, tag]));

export const getBuildTag = (id: string): BuildTag | undefined => TAGS_BY_ID.get(id);

// Parses the stored comma-separated value into known tags, in canonical order.
// Unknown ids (legacy free-text tags) are silently skipped.
export const parseBuildTags = (value: string | null | undefined): BuildTag[] => {
  if (!value) return [];
  const ids = new Set(value.split(',').map(s => s.trim()));
  return BUILD_TAGS.filter(tag => ids.has(tag.id));
};

export const serializeBuildTags = (ids: string[]): string =>
  BUILD_TAGS.filter(tag => ids.includes(tag.id)).map(tag => tag.id).join(',');

// Returns the already-selected tag that cannot be combined with `id`, if any
export const getConflictingTag = (id: string, selectedIds: string[]): BuildTag | undefined => {
  for (const pair of EXCLUSIVE_PAIRS) {
    if (!pair.includes(id)) continue;
    const other = pair.find(p => p !== id);
    if (other && selectedIds.includes(other)) return getBuildTag(other);
  }
  return undefined;
};

// Drops unknown ids (e.g. legacy free-text tags) so a loaded build always passes validation
export const normalizeBuildTags = (value: string | null | undefined): string =>
  parseBuildTags(value).map(tag => tag.id).join(',');
