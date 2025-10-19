require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { spawn } = require('child_process');
const { setupDatabase, db } = require('./database');
const passport = require('./auth');
const { apiLimiter, createBuildLimiter, validateBuildData, sanitizeBuildData } = require('./security');
const app = express();
const port = process.env.PORT || 3001;

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, 'uploads'), // Temporary upload directory
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Only accept .sav files
    if (path.extname(file.originalname).toLowerCase() === '.sav') {
      cb(null, true);
    } else {
      cb(new Error('Only .sav files are allowed'));
    }
  }
});

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

// Register route (create local account)
app.post('/auth/register', async (req, res) => {
  const { username, password } = req.body;

  // Validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ error: 'Username must be between 3 and 50 characters.' });
  }

  // Password validation (NIST/OWASP best practices)
  if (password.length < 12) {
    return res.status(400).json({ error: 'Password must be at least 12 characters long.' });
  }

  if (password.length > 128) {
    return res.status(400).json({ error: 'Password must be less than 128 characters.' });
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&#).'
    });
  }

  // Check if username already exists (any provider)
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error.' });
    }

    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create new user
    db.run(
      'INSERT INTO users (username, provider, provider_id, password_hash) VALUES (?, ?, ?, ?)',
      [username, 'local', username, password_hash],
      function (err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create user.' });
        }

        // Get the newly created user
        db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to retrieve user.' });
          }

          // Log the user in
          req.login(newUser, (err) => {
            if (err) {
              return res.status(500).json({ error: 'Login failed after registration.' });
            }

            res.status(201).json({
              success: true,
              user: {
                id: newUser.id,
                username: newUser.username,
                provider: newUser.provider
              }
            });
          });
        });
      }
    );
  });
});

// Login route (local account)
app.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      return res.status(500).json({ error: 'Authentication error.' });
    }

    if (!user) {
      return res.status(401).json({ error: info.message || 'Invalid username or password.' });
    }

    req.login(user, (err) => {
      if (err) {
        return res.status(500).json({ error: 'Login failed.' });
      }

      res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          provider: user.provider
        }
      });
    });
  })(req, res, next);
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
  const { name, description, game_version, youtube_url, source_url, difficulty, civics, traits, secondary_traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags } = sanitizedData;

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
    const sql = `INSERT INTO builds (name, description, game_version, youtube_url, source_url, difficulty, civics, traits, secondary_traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags, author_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, description, game_version, youtube_url, source_url, difficulty, civics, traits, secondary_traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags, author_id];

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

// Import build from .sav file
app.post('/api/import-build', isAuthenticated, upload.single('savefile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const savFilePath = req.file.path;
  const scriptPath = path.join(__dirname, '../data-extractor/import_build_from_save.py');

  // Run Python script to extract build data
  const python = spawn('python3', [scriptPath, savFilePath]);

  let stdout = '';
  let stderr = '';

  python.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  python.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  python.on('close', (code) => {
    // Clean up uploaded file
    fs.unlink(savFilePath, (err) => {
      if (err) console.error('Failed to delete uploaded file:', err);
    });

    // Clean up cache directory (.cache_<filename>)
    const savFileName = path.basename(savFilePath);
    const cacheDir = path.join(path.dirname(savFilePath), `.cache_${savFileName}`);
    if (fs.existsSync(cacheDir)) {
      fs.rm(cacheDir, { recursive: true, force: true }, (err) => {
        if (err) console.error('Failed to delete cache directory:', err);
      });
    }

    if (code !== 0) {
      console.error('Python script error:', stderr);
      return res.status(500).json({
        error: 'Failed to parse save file',
        details: stderr,
        output: stdout
      });
    }

    try {
      // Extract JSON from output (it's at the end after "JSON OUTPUT")
      const jsonMatch = stdout.match(/\{[\s\S]*"ethics"[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({
          error: 'Failed to extract build data from save file',
          output: stdout
        });
      }

      const buildData = JSON.parse(jsonMatch[0]);

      // Return both the extracted data and the full output for debugging
      res.json({
        success: true,
        buildData: buildData,
        output: stdout, // Full script output for user to see/copy
      });
    } catch (error) {
      console.error('JSON parse error:', error);
      res.status(500).json({
        error: 'Failed to parse extracted data',
        details: error.message,
        output: stdout
      });
    }
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
