require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const { setupDatabase, db } = require('./database');
const passport = require('./auth');
const { apiLimiter, createBuildLimiter, validateBuildData, sanitizeBuildData } = require('./security');
const app = express();
const port = process.env.PORT || 3001;

// Trust proxy - required when running behind nginx with HTTPS
app.set('trust proxy', 1);

// Middlewares
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Session configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'stellaris-build-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from the frontend build
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// Setup the database
setupDatabase();

// Authentication middleware
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Unauthorized. Please log in.' });
};

// ============ AUTH ROUTES ============

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // In development, redirect to Vite dev server
    const redirectUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:3000/';
    res.redirect(redirectUrl);
  }
);

// Steam OpenID routes
app.get('/auth/steam', passport.authenticate('steam'));

app.get(
  '/auth/steam/callback',
  passport.authenticate('steam', { failureRedirect: '/login' }),
  (req, res) => {
    // In development, redirect to Vite dev server
    const redirectUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:3000/';
    res.redirect(redirectUrl);
  }
);

// Logout route
app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed.' });
    }
    // In development, redirect to Vite dev server
    const redirectUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:3000/';
    res.redirect(redirectUrl);
  });
});

// Get current user
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

// ============ API ROUTES ============

app.get('/api/test', (req, res) => {
  res.json({ message: 'Hello from the backend!' });
});

// Get all traits
app.get('/api/traits', (req, res) => {
  fs.readFile('./data/traits.json', 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: "Could not read traits data." });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Get all ethics
app.get('/api/ethics', (req, res) => {
  fs.readFile('./data/ethics.json', 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: "Could not read ethics data." });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Get all civics
app.get('/api/civics', (req, res) => {
  fs.readFile('./data/civics.json', 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: "Could not read civics data." });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Get all origins
app.get('/api/origins', (req, res) => {
  fs.readFile('./data/origins.json', 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: "Could not read origins data." });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Get all traditions
app.get('/api/traditions', (req, res) => {
  fs.readFile('./data/traditions.json', 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: "Could not read traditions data." });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Get all authorities
app.get('/api/authorities', (req, res) => {
  fs.readFile('./data/authorities.json', 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: "Could not read authorities data." });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Get all ascension perks
app.get('/api/ascension-perks', (req, res) => {
  fs.readFile('./data/ascension_perks.json', 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: "Could not read ascension perks data." });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Get all ruler traits
app.get('/api/ruler-traits', (req, res) => {
  fs.readFile('./data/ruler_traits.json', 'utf8', (err, data) => {
    if (err) {
      res.status(500).json({ error: "Could not read ruler traits data." });
      return;
    }
    res.json(JSON.parse(data));
  });
});

// Get all builds (excluding soft-deleted ones)
app.get('/api/builds', (req, res) => {
  const sql = "SELECT * FROM builds WHERE deleted = 0 ORDER BY created_at DESC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ builds: rows });
  });
});

// Create a new build (requires authentication + rate limiting)
app.post('/api/builds', isAuthenticated, createBuildLimiter, (req, res) => {
  // Validate input data
  const validationErrors = validateBuildData(req.body);
  if (validationErrors.length > 0) {
    return res.status(400).json({
      error: 'Validation failed',
      details: validationErrors
    });
  }

  // Sanitize input data to prevent XSS
  const sanitizedData = sanitizeBuildData(req.body);
  const { name, description, game_version, youtube_url, civics, traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags } = sanitizedData;

  // Get author_id from authenticated user
  const author_id = req.user.id;

  // Check if a build with the same name already exists
  db.get(`SELECT id FROM builds WHERE name = ?`, [name], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (row) {
      return res.status(409).json({ error: 'A build with this name already exists. Please choose a different name.' });
    }

    // If no duplicate, proceed with insert
    const sql = `INSERT INTO builds (name, description, game_version, youtube_url, civics, traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, description, game_version, youtube_url, civics, traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags, author_id];

    db.run(sql, params, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      // Get the newly created build and return it
      db.get(`SELECT * FROM builds WHERE id = ?`, [this.lastID], (err, row) => {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.status(201).json({ build: row });
      });
    });
  });
});

// Update a build's description
app.patch('/api/builds/:id', (req, res) => {
  const { id } = req.params;
  const { description } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description is required.' });
  }

  const sql = `UPDATE builds SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND deleted = 0`;

  db.run(sql, [description, id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Build not found or already deleted.' });
      return;
    }
    res.json({ success: true, changes: this.changes, id: parseInt(id) });
  });
});

// Soft delete a build by ID (requires authentication and ownership)
app.delete('/api/builds/:id', isAuthenticated, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // First, check if the build exists and belongs to the user
  db.get('SELECT * FROM builds WHERE id = ? AND deleted = 0', [id], (err, build) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!build) {
      return res.status(404).json({ error: 'Build not found or already deleted.' });
    }

    // Check if user is the author
    if (build.author_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own builds.' });
    }

    // Proceed with deletion
    const sql = `UPDATE builds SET deleted = 1 WHERE id = ?`;
    db.run(sql, [id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Build deleted successfully.', id: parseInt(id) });
    });
  });
});

// Serve React app for all other routes (must be after API routes)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log(`Access the app at: http://51.159.55.29:${port}`);
});
