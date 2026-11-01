const path = require('path');

// Where the SQLite databases live. Default: next to this file (development).
// Production (deploy kit) sets DB_PATH and SESSIONS_DIR to a directory shared by
// every release, so a deploy never replaces the data or logs everyone out.
// Relative values are resolved against this directory.
const resolveFromBackend = (value) => path.resolve(__dirname, value);

const DB_PATH = process.env.DB_PATH
  ? resolveFromBackend(process.env.DB_PATH)
  : path.join(__dirname, 'stellaris_builds.db');

const SESSIONS_DIR = process.env.SESSIONS_DIR
  ? resolveFromBackend(process.env.SESSIONS_DIR)
  : __dirname;

module.exports = { DB_PATH, SESSIONS_DIR };
