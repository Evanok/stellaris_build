const sqlite3 = require('sqlite3').verbose();

// Connect to DB
const db = new sqlite3.Database('./stellaris_builds.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Connected to the stellaris_builds.db SQLite database.');
});

// Create tables
const setupDatabase = () => { 
  db.serialize(() => {
    // User table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Build table
    db.run(`CREATE TABLE IF NOT EXISTS builds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      civics TEXT, -- Stored as JSON string
      traits TEXT, -- Stored as JSON string
      dlcs TEXT, -- Stored as JSON string
      game_version TEXT,
      tags TEXT, -- Stored as JSON string
      author_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users (id)
    )`);

    console.log('Database tables checked/created.');
  });
};

module.exports = { db, setupDatabase };
