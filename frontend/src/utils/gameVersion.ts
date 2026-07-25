// `value` matches the data folder version (major.minor) and GAME_VERSIONS in BuildForm.tsx /
// AVAILABLE_DATA_VERSIONS in backend/index.js. `patch` is the exact game patch (major.minor.patch),
// shown to reassure users the site tracks the current game build — update on every hotfix, even
// when the data folder itself doesn't change.
export const LATEST_GAME_VERSION = { value: '4.4', name: 'Pegasus', patch: '4.4.6' };
