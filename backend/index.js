const express = require('express');
const fs = require('fs');
const { setupDatabase, db } = require('./database');
const app = express();
const port = process.env.PORT || 3001;

// Middlewares
app.use(express.json());

// Setup the database
setupDatabase();

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

// Get all builds
app.get('/api/builds', (req, res) => {
  const sql = "SELECT * FROM builds ORDER BY created_at DESC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ builds: rows });
  });
});

// Create a new build
app.post('/api/builds', (req, res) => {
  const { name, description, game_version, civics, traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Build name is required.' });
  }

  // Check if a build with the same name already exists
  db.get(`SELECT id FROM builds WHERE name = ?`, [name], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (row) {
      return res.status(409).json({ error: 'A build with this name already exists. Please choose a different name.' });
    }

    // If no duplicate, proceed with insert
    const sql = `INSERT INTO builds (name, description, game_version, civics, traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [name, description, game_version, civics, traits, origin, ethics, authority, ascension_perks, traditions, ruler_trait, dlcs, tags];

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

// Delete a build by ID
app.delete('/api/builds/:id', (req, res) => {
  const { id } = req.params;
  const sql = `DELETE FROM builds WHERE id = ?`;

  db.run(sql, [id], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      res.status(404).json({ error: 'Build not found.' });
      return;
    }
    res.json({ message: 'Build deleted successfully.', id: parseInt(id) });
  });
});

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
