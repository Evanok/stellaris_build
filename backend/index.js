const express = require('express');
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
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Build name is required.' });
  }

  const sql = `INSERT INTO builds (name, description) VALUES (?, ?)`;
  db.run(sql, [name, description], function(err) {
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

app.listen(port, () => {
  console.log(`Backend server listening on port ${port}`);
});
