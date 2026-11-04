// Daily unique visitors, logged-in vs anonymous, for the admin statistics page.
//
// The frontend sends POST /api/visit once per page load, only after the visitor looks
// human (same heuristic as the Google Analytics loader: a real interaction or a few
// seconds of visible page time), so headless bots that load and leave are not counted.
// Counting is server-side and does not depend on GA (ad blockers, consent).

const crypto = require('crypto');
const { db } = require('./database');

const VISITOR_RETENTION_DAYS = 180;
const HASH_SECRET = process.env.SESSION_SECRET || 'stellaris-build-visitors';

let lastPruneDay = null;

const today = () => new Date().toISOString().slice(0, 10); // UTC, same as SQLite date('now')

// Keyed by the day: the same browser gets a different hash every day, so rows of
// different days cannot be linked together.
const visitorHash = (day, ip, userAgent) =>
  crypto.createHmac('sha256', HASH_SECRET).update(`${day}|${ip}|${userAgent}`).digest('hex').slice(0, 32);

const pruneOldVisitors = (day) => {
  if (lastPruneDay === day) return;
  lastPruneDay = day;
  db.run(`DELETE FROM daily_visitors WHERE day < date('now', ?)`, [`-${VISITOR_RETENTION_DAYS} days`], (err) => {
    if (err) console.error('Error pruning daily_visitors:', err.message);
  });
};

const recordVisit = (req, res) => {
  // Admins browse the site all day; counting them would skew a small audience
  if (req.isAuthenticated() && req.user.is_admin === 1) return res.status(204).end();

  const day = today();
  const hash = visitorHash(day, req.ip, req.get('User-Agent') || '');
  const userId = req.isAuthenticated() ? req.user.id : null;

  // An anonymous hit never clears the user_id of a visitor already seen logged in
  db.run(
    `INSERT INTO daily_visitors (day, visitor_hash, user_id) VALUES (?, ?, ?)
     ON CONFLICT (day, visitor_hash) DO UPDATE SET user_id = COALESCE(excluded.user_id, daily_visitors.user_id)`,
    [day, hash, userId],
    (err) => {
      if (err) console.error('Error recording visit:', err.message);
    }
  );
  pruneOldVisitors(day);
  res.status(204).end();
};

module.exports = { recordVisit };
