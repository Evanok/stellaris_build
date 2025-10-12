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
      origin TEXT, -- Origin ID
      ethics TEXT, -- Ethics (JSON string)
      ascension_perks TEXT, -- Recommended ascension perks (JSON string)
      dlcs TEXT, -- Stored as JSON string
      game_version TEXT,
      tags TEXT, -- Stored as JSON string
      author_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users (id)
    )`);

    // Add origin column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE builds ADD COLUMN origin TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding origin column:', err.message);
      }
    });

    // Add ethics column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE builds ADD COLUMN ethics TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding ethics column:', err.message);
      }
    });

    // Add ascension_perks column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE builds ADD COLUMN ascension_perks TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding ascension_perks column:', err.message);
      }
    });

    // Add authority column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE builds ADD COLUMN authority TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding authority column:', err.message);
      }
    });

    // Add traditions column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE builds ADD COLUMN traditions TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding traditions column:', err.message);
      }
    });

    // Add ruler_trait column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE builds ADD COLUMN ruler_trait TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding ruler_trait column:', err.message);
      }
    });

    // Add deleted column if it doesn't exist (for soft delete functionality)
    db.run(`ALTER TABLE builds ADD COLUMN deleted INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding deleted column:', err.message);
      }
    });

    // Add youtube_url column if it doesn't exist (for YouTube video links)
    db.run(`ALTER TABLE builds ADD COLUMN youtube_url TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding youtube_url column:', err.message);
      }
    });

    console.log('Database tables checked/created.');
  });
};

module.exports = { db, setupDatabase };
