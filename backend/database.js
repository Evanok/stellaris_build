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
    // User table for OAuth authentication
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      email TEXT,
      avatar TEXT,
      provider TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(provider, provider_id)
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

    // Add difficulty column if it doesn't exist (optional field for build difficulty rating)
    db.run(`ALTER TABLE builds ADD COLUMN difficulty TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding difficulty column:', err.message);
      }
    });

    // Add source_url column if it doesn't exist (for external source attribution)
    db.run(`ALTER TABLE builds ADD COLUMN source_url TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding source_url column:', err.message);
      }
    });

    // Add secondary_traits column if it doesn't exist (for origins with secondary species)
    db.run(`ALTER TABLE builds ADD COLUMN secondary_traits TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding secondary_traits column:', err.message);
      }
    });

    // Add species_class column if it doesn't exist (for species appearance selection)
    db.run(`ALTER TABLE builds ADD COLUMN species_class TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding species_class column:', err.message);
      }
    });

    // Add portrait column if it doesn't exist (for species portrait selection)
    db.run(`ALTER TABLE builds ADD COLUMN portrait TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding portrait column:', err.message);
      }
    });

    // Migrate users table for OAuth (for existing databases)
    db.run(`ALTER TABLE users ADD COLUMN email TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding email column:', err.message);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN avatar TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding avatar column:', err.message);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN provider TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding provider column:', err.message);
      }
    });

    db.run(`ALTER TABLE users ADD COLUMN provider_id TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding provider_id column:', err.message);
      }
    });

    // Add password_hash column for local authentication
    db.run(`ALTER TABLE users ADD COLUMN password_hash TEXT`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding password_hash column:', err.message);
      }
    });

    // Add is_admin column for admin users
    db.run(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`, (err) => {
      if (err && !err.message.includes('duplicate column')) {
        console.error('Error adding is_admin column:', err.message);
      } else {
        // Set admin user from environment variable
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          db.run(`UPDATE users SET is_admin = 1 WHERE email = ?`, [adminEmail], (err) => {
            if (err) {
              console.error('Error setting admin user:', err.message);
            } else {
              console.log('Admin user configured (if exists).');
            }
          });
        }
      }
    });

    // Create page_views table for traffic tracking
    db.run(`CREATE TABLE IF NOT EXISTS page_views (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT NOT NULL,
      referrer TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Error creating page_views table:', err.message);
      }
    });

    // Create feedback table for user feedback and bug reports
    db.run(`CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('bug', 'feedback', 'suggestion')),
      description TEXT NOT NULL,
      screenshot_path TEXT,
      page_url TEXT,
      user_agent TEXT,
      user_id INTEGER,
      status TEXT DEFAULT 'new' CHECK(status IN ('new', 'in_progress', 'resolved')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
      if (err) {
        console.error('Error creating feedback table:', err.message);
      }
    });

    console.log('Database tables checked/created.');
  });
};

module.exports = { db, setupDatabase };
