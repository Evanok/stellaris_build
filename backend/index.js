require('dotenv').config({ path: __dirname + '/.env' });

// Validate environment variables before starting the app
const { validateEnv } = require('./validateEnv');
validateEnv();

const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
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
    const ext = path.extname(file.originalname).toLowerCase();
    // Accept .sav files for save game imports and .txt files for empire designs
    if (ext === '.sav' || ext === '.txt') {
      cb(null, true);
    } else {
      cb(new Error('Only .sav and .txt files are allowed'));
    }
  }
});

// Trust proxy - required when running behind nginx with HTTPS
app.set('trust proxy', 1);

// Middlewares
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Session configuration with SQLite store
app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.db',
      dir: __dirname,
    }),
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
// Cache icons for 30 days (immutable assets)
app.use('/icons', express.static(path.join(__dirname, '../frontend/dist/icons'), {
  maxAge: '30d',
  immutable: true
}));
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

// Admin middleware
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.is_admin === 1) {
    return next();
  }
  res.status(403).json({ error: 'Forbidden. Admin access required.' });
};

// Page view tracking middleware for important pages
const trackPageView = (req, res, next) => {
  const trackedPaths = ['/', '/create', '/create/manual', '/create/import-save', '/create/import-designs'];
  const url = req.path;

  // Only track specific paths
  if (trackedPaths.includes(url)) {
    const referrer = req.get('Referer') || req.get('Referrer') || 'direct';
    const userAgent = req.get('User-Agent') || 'unknown';

    db.run(
      'INSERT INTO page_views (url, referrer, user_agent) VALUES (?, ?, ?)',
      [url, referrer, userAgent],
      (err) => {
        if (err) {
          console.error('Error tracking page view:', err.message);
        }
      }
    );
  }

  next();
};

// Apply page view tracking to all routes
app.use(trackPageView);

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

// Get a single build by ID
app.get('/api/builds/:id', (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM builds WHERE id = ? AND deleted = 0";
  db.get(sql, [id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Build not found' });
      return;
    }
    res.json({ build: row });
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

    // Proceed with deletion - also rename to avoid name conflicts
    const timestamp = Date.now();
    const newName = `[DELETED-${timestamp}] ${build.name}`;
    const sql = `UPDATE builds SET deleted = 1, name = ? WHERE id = ?`;
    db.run(sql, [newName, id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Build deleted successfully.', id: parseInt(id) });
    });
  });
});

// Update/Edit a build by ID (requires authentication and ownership)
app.put('/api/builds/:id', isAuthenticated, createBuildLimiter, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

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
      return res.status(403).json({ error: 'You can only edit your own builds.' });
    }

    // Check if the new name conflicts with another build (but allow keeping the same name)
    db.get(`SELECT id FROM builds WHERE name = ? AND id != ?`, [name, id], (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (row) {
        return res.status(409).json({ error: 'A build with this name already exists. Please choose a different name.' });
      }

      // Proceed with update
      const sql = `UPDATE builds SET
        name = ?,
        description = ?,
        game_version = ?,
        youtube_url = ?,
        source_url = ?,
        difficulty = ?,
        civics = ?,
        traits = ?,
        secondary_traits = ?,
        origin = ?,
        ethics = ?,
        authority = ?,
        ascension_perks = ?,
        traditions = ?,
        ruler_trait = ?,
        dlcs = ?,
        tags = ?
      WHERE id = ?`;

      const params = [name, description, game_version, youtube_url, source_url, difficulty, civics, traits, secondary_traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags, id];

      db.run(sql, params, function(err) {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json({
          message: 'Build updated successfully.',
          id: parseInt(id),
          changes: this.changes
        });
      });
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

// List all empires from empire designs file
app.post('/api/list-empires', isAuthenticated, upload.single('designsfile'), (req, res) => {
  console.log('[list-empires] Request received');

  if (!req.file) {
    console.log('[list-empires] ERROR: No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const designsFilePath = req.file.path;
  const scriptPath = path.join(__dirname, '../data-extractor/import_empire_from_designs.py');

  console.log('[list-empires] File uploaded:', designsFilePath);
  console.log('[list-empires] Script path:', scriptPath);

  // Run Python script to list empires
  const python = spawn('python3', [scriptPath, designsFilePath]);
  console.log('[list-empires] Python script spawned');

  let stdout = '';
  let stderr = '';

  python.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  python.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  python.on('close', (code) => {
    console.log('[list-empires] Python script exited with code:', code);
    console.log('[list-empires] stdout:', stdout);
    console.log('[list-empires] stderr:', stderr);

    // Clean up uploaded file
    fs.unlink(designsFilePath, (err) => {
      if (err) console.error('Failed to delete uploaded file:', err);
    });

    if (code !== 0) {
      console.error('[list-empires] ERROR: Python script failed');
      console.error('Python script error:', stderr);
      return res.status(500).json({
        error: 'Failed to parse empire designs file',
        details: stderr
      });
    }

    try {
      // Parse the JSON array of empire names
      const empires = JSON.parse(stdout.trim());
      console.log('[list-empires] SUCCESS: Parsed empires:', empires);
      res.json({ empires });
    } catch (error) {
      console.error('[list-empires] ERROR: JSON parse failed');
      console.error('JSON parse error:', error);
      res.status(500).json({
        error: 'Failed to parse empire list',
        details: error.message,
        output: stdout
      });
    }
  });
});

// Extract specific empire from empire designs file
app.post('/api/import-empire-designs', isAuthenticated, upload.single('designsfile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const empireName = req.body.empireName;
  if (!empireName) {
    // Clean up file first
    fs.unlink(req.file.path, () => {});
    return res.status(400).json({ error: 'Empire name is required' });
  }

  const designsFilePath = req.file.path;
  const scriptPath = path.join(__dirname, '../data-extractor/import_empire_from_designs.py');

  // Run Python script to extract specific empire
  const python = spawn('python3', [scriptPath, designsFilePath, empireName]);

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
    fs.unlink(designsFilePath, (err) => {
      if (err) console.error('Failed to delete uploaded file:', err);
    });

    if (code !== 0) {
      console.error('Python script error:', stderr);
      return res.status(500).json({
        error: 'Failed to extract empire data',
        details: stderr
      });
    }

    try {
      // Parse the empire data JSON
      const buildData = JSON.parse(stdout.trim());
      res.json(buildData);
    } catch (error) {
      console.error('JSON parse error:', error);
      res.status(500).json({
        error: 'Failed to parse empire data',
        details: error.message,
        output: stdout
      });
    }
  });
});

// ============ PUBLIC STATS ROUTES ============

// Get public statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = {};

    // 1. Total builds
    const totalBuilds = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM builds WHERE deleted = 0', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    stats.totalBuilds = totalBuilds;

    // 2. Top 3 Civics (parse comma-separated values)
    const allBuilds = await new Promise((resolve, reject) => {
      db.all('SELECT civics FROM builds WHERE deleted = 0 AND civics IS NOT NULL', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const civicCounts = {};
    allBuilds.forEach(build => {
      if (build.civics) {
        const civics = build.civics.split(',').map(c => c.trim()).filter(c => c);
        civics.forEach(civic => {
          civicCounts[civic] = (civicCounts[civic] || 0) + 1;
        });
      }
    });

    const topCivics = Object.entries(civicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name,
        count,
        percentage: ((count / totalBuilds) * 100).toFixed(1)
      }));
    stats.topCivics = topCivics;

    // 3. Top 3 Ethics
    const ethicCounts = {};
    allBuilds.forEach(build => {
      if (build.ethics) {
        const ethics = build.ethics.split(',').map(e => e.trim()).filter(e => e);
        ethics.forEach(ethic => {
          ethicCounts[ethic] = (ethicCounts[ethic] || 0) + 1;
        });
      }
    });

    const allBuildsEthics = await new Promise((resolve, reject) => {
      db.all('SELECT ethics FROM builds WHERE deleted = 0 AND ethics IS NOT NULL', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const ethicCountsFinal = {};
    allBuildsEthics.forEach(build => {
      if (build.ethics) {
        const ethics = build.ethics.split(',').map(e => e.trim()).filter(e => e);
        ethics.forEach(ethic => {
          ethicCountsFinal[ethic] = (ethicCountsFinal[ethic] || 0) + 1;
        });
      }
    });

    const topEthics = Object.entries(ethicCountsFinal)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name,
        count,
        percentage: ((count / totalBuilds) * 100).toFixed(1)
      }));
    stats.topEthics = topEthics;

    // 4. Top 3 Origins
    const originCounts = await new Promise((resolve, reject) => {
      db.all(
        `SELECT origin, COUNT(*) as count
         FROM builds
         WHERE deleted = 0 AND origin IS NOT NULL
         GROUP BY origin
         ORDER BY count DESC
         LIMIT 3`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            name: row.origin,
            count: row.count,
            percentage: ((row.count / totalBuilds) * 100).toFixed(1)
          })));
        }
      );
    });
    stats.topOrigins = originCounts;

    // 5. Top 3 Authorities
    const authorityCounts = await new Promise((resolve, reject) => {
      db.all(
        `SELECT authority, COUNT(*) as count
         FROM builds
         WHERE deleted = 0 AND authority IS NOT NULL
         GROUP BY authority
         ORDER BY count DESC
         LIMIT 3`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => ({
            name: row.authority,
            count: row.count,
            percentage: ((row.count / totalBuilds) * 100).toFixed(1)
          })));
        }
      );
    });
    stats.topAuthorities = authorityCounts;

    // 6. Top 3 Ascension Perks
    const allBuildsPerks = await new Promise((resolve, reject) => {
      db.all('SELECT ascension_perks FROM builds WHERE deleted = 0 AND ascension_perks IS NOT NULL', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const perkCounts = {};
    allBuildsPerks.forEach(build => {
      if (build.ascension_perks) {
        const perks = build.ascension_perks.split(',').map(p => p.trim()).filter(p => p);
        perks.forEach(perk => {
          perkCounts[perk] = (perkCounts[perk] || 0) + 1;
        });
      }
    });

    const topPerks = Object.entries(perkCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name,
        count,
        percentage: ((count / totalBuilds) * 100).toFixed(1)
      }));
    stats.topAscensionPerks = topPerks;

    // 7. Top 3 Traditions
    const allBuildsTraditions = await new Promise((resolve, reject) => {
      db.all('SELECT traditions FROM builds WHERE deleted = 0 AND traditions IS NOT NULL', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const traditionCounts = {};
    allBuildsTraditions.forEach(build => {
      if (build.traditions) {
        const traditions = build.traditions.split(',').map(t => t.trim()).filter(t => t);
        traditions.forEach(tradition => {
          traditionCounts[tradition] = (traditionCounts[tradition] || 0) + 1;
        });
      }
    });

    const topTraditions = Object.entries(traditionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name,
        count,
        percentage: ((count / totalBuilds) * 100).toFixed(1)
      }));
    stats.topTraditions = topTraditions;

    // 8. Top 5 Contributors
    const topContributors = await new Promise((resolve, reject) => {
      db.all(
        `SELECT u.username, u.avatar, COUNT(b.id) as buildCount
         FROM users u
         INNER JOIN builds b ON u.id = b.author_id
         WHERE b.deleted = 0
         GROUP BY u.id
         ORDER BY buildCount DESC
         LIMIT 5`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    stats.topContributors = topContributors;

    res.json(stats);
  } catch (error) {
    console.error('Error fetching public stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// ============ ADMIN STATS ROUTES ============

// Get admin statistics
app.get('/api/admin/stats', isAdmin, async (req, res) => {
  try {
    const stats = {};

    // 1. Total users
    const totalUsers = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    stats.totalUsers = totalUsers;

    // 2. New users this month
    const newUsersThisMonth = await new Promise((resolve, reject) => {
      db.get(
        `SELECT COUNT(*) as count FROM users
         WHERE created_at >= date('now', 'start of month')`,
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });
    stats.newUsersThisMonth = newUsersThisMonth;

    // 3. Total builds (active + deleted)
    const totalBuilds = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM builds', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    stats.totalBuilds = totalBuilds;

    // 4. Deleted builds
    const deletedBuilds = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM builds WHERE deleted = 1', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });
    stats.deletedBuilds = deletedBuilds;

    // 5. Builds created per week (last 12 weeks)
    const buildsPerWeek = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          strftime('%Y-W%W', created_at) as week,
          COUNT(*) as count
         FROM builds
         WHERE created_at >= date('now', '-12 weeks')
         GROUP BY week
         ORDER BY week`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    stats.buildsPerWeek = buildsPerWeek;

    // 6. Inscriptions per week (last 12 weeks)
    const signupsPerWeek = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          strftime('%Y-W%W', created_at) as week,
          COUNT(*) as count
         FROM users
         WHERE created_at >= date('now', '-12 weeks')
         GROUP BY week
         ORDER BY week`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    stats.signupsPerWeek = signupsPerWeek;

    // 7. Top referrers (last 30 days)
    const topReferrers = await new Promise((resolve, reject) => {
      db.all(
        `SELECT
          referrer,
          COUNT(*) as count
         FROM page_views
         WHERE created_at >= date('now', '-30 days')
         GROUP BY referrer
         ORDER BY count DESC
         LIMIT 10`,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
    stats.topReferrers = topReferrers;

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin statistics' });
  }
});

// Submit feedback or bug report (accessible to everyone, even not logged in)
app.post('/api/feedback', upload.single('screenshot'), (req, res) => {
  const { type, description, pageUrl } = req.body;

  // Validation
  if (!type || !['bug', 'feedback', 'suggestion'].includes(type)) {
    return res.status(400).json({ error: 'Invalid feedback type. Must be bug, feedback, or suggestion.' });
  }

  if (!description || description.trim() === '') {
    return res.status(400).json({ error: 'Description is required.' });
  }

  const userId = req.user ? req.user.id : null;
  const userAgent = req.get('User-Agent') || null;
  const screenshotPath = req.file ? req.file.path : null;

  db.run(
    `INSERT INTO feedback (type, description, screenshot_path, page_url, user_agent, user_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [type, description, screenshotPath, pageUrl, userAgent, userId],
    function(err) {
      if (err) {
        console.error('Error saving feedback:', err);
        return res.status(500).json({ error: 'Failed to save feedback' });
      }

      res.json({
        success: true,
        message: 'Thank you for your feedback!',
        id: this.lastID
      });
    }
  );
});

// Get all feedback (admin only)
app.get('/api/admin/feedback', isAdmin, (req, res) => {
  const { status } = req.query;

  let query = `
    SELECT
      f.*,
      u.username,
      u.email,
      u.avatar
    FROM feedback f
    LEFT JOIN users u ON f.user_id = u.id
  `;

  const params = [];

  if (status && ['new', 'in_progress', 'resolved'].includes(status)) {
    query += ' WHERE f.status = ?';
    params.push(status);
  }

  query += ' ORDER BY f.created_at DESC';

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error fetching feedback:', err);
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }

    res.json(rows);
  });
});

// Update feedback status (admin only)
app.patch('/api/admin/feedback/:id', isAdmin, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !['new', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be new, in_progress, or resolved.' });
  }

  db.run(
    'UPDATE feedback SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) {
        console.error('Error updating feedback:', err);
        return res.status(500).json({ error: 'Failed to update feedback' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Feedback not found' });
      }

      res.json({ success: true, message: 'Feedback status updated' });
    }
  );
});

// Serve React app for all other routes (must be after API routes)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  const host = process.env.SERVER_HOST || 'localhost';
  console.log(`Access the app at: http://${host}:${port}`);
});
