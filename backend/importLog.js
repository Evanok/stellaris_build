// Trace of every file import (save game / empire designs), whatever its outcome:
// - one row per request in import_attempts, including the ones rejected before the
//   parser runs (rate limit, server busy, wrong file type, file too large);
// - a copy of each distinct uploaded file under import_archive/<kind>/, named by its
//   sha256, so a parser failure can be replayed locally against the exact file.
// The handlers report what happened through failImport() / res.locals.importLog;
// the row is written once the response is sent, and the uploaded file is moved to
// the archive (or deleted) at that point - handlers must not delete it themselves.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { db } = require('./database');

const ARCHIVE_DIR = path.join(__dirname, 'import_archive');
const ARCHIVE_MAX_BYTES = 5 * 1024 * 1024 * 1024; // past this, files are no longer kept (rows still are)
const DETAILS_MAX_LENGTH = 4000;

// The end of a parser's output is where its error is
const tail = (text) => {
  if (!text) return null;
  return text.length > DETAILS_MAX_LENGTH ? '...' + text.slice(-DETAILS_MAX_LENGTH) : text;
};

const sha256OfFile = (filePath) => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  fs.createReadStream(filePath)
    .on('error', reject)
    .on('data', (chunk) => hash.update(chunk))
    .on('end', () => resolve(hash.digest('hex')));
});

const directorySize = async (dir) => {
  let total = 0;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await directorySize(entryPath);
    else total += (await fs.promises.stat(entryPath)).size;
  }
  return total;
};

// Moves the uploaded file into the archive. Returns the archived path relative to
// the archive dir, or null when it was not kept (archive full). The temp file is
// gone either way.
const archiveUpload = async (file, archiveKind, sha256) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const dir = path.join(ARCHIVE_DIR, archiveKind);
  const relativePath = path.join(archiveKind, sha256 + ext);
  const target = path.join(ARCHIVE_DIR, relativePath);

  if (fs.existsSync(target)) {
    // Same file already kept (empire designs are uploaded twice: list, then import)
    await fs.promises.unlink(file.path);
    return relativePath;
  }
  if (await directorySize(ARCHIVE_DIR) + file.size > ARCHIVE_MAX_BYTES) {
    console.warn(`[import] archive over ${ARCHIVE_MAX_BYTES} bytes, not keeping ${file.originalname}`);
    await fs.promises.unlink(file.path);
    return null;
  }
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.rename(file.path, target);
  return relativePath;
};

const recordAttempt = async (req, res, kind, startedAt) => {
  const log = res.locals.importLog;
  const status = res.writableFinished ? res.statusCode : 0; // 0 = the visitor left before the answer
  const file = req.file;
  let sha256 = null;
  let archived = null;

  if (file) {
    try {
      sha256 = await sha256OfFile(file.path);
      // list + import of the same designs file land in one folder
      archived = await archiveUpload(file, kind === 'save' ? 'save' : 'designs', sha256);
    } catch (err) {
      console.error('[import] failed to archive upload:', err.message);
      fs.unlink(file.path, () => {});
    }
  }

  const durationMs = Date.now() - startedAt;
  console.log(`[import] ${kind} status=${status} size=${file ? file.size : '-'} ${durationMs}ms` +
    (log.error ? ` error="${log.error}"` : ''));

  db.run(
    `INSERT INTO import_attempts
      (kind, status, error, details, empire_name, empire_count, original_name, file_size, file_sha256, archived_file, user_id, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [kind, status, log.error || null, tail(log.details), log.empireName || null,
      log.empireCount ?? null, file ? file.originalname : null, file ? file.size : null,
      sha256, archived, req.user ? req.user.id : null, durationMs],
    (err) => {
      if (err) console.error('[import] failed to record attempt:', err.message);
    }
  );
};

// First middleware of every import route
const trackImport = (kind) => (req, res, next) => {
  const startedAt = Date.now();
  res.locals.importLog = {};
  let recorded = false;
  const record = () => {
    if (recorded) return;
    recorded = true;
    recordAttempt(req, res, kind, startedAt).catch((err) => {
      console.error('[import] failed to record attempt:', err.message);
    });
  };
  res.on('finish', record);
  res.on('close', record);
  next();
};

// Sends an error answer and records why. `details` (parser stderr/stdout) is
// stored, and also returned to the client as before.
const failImport = (res, status, error, details, extraBody = {}) => {
  res.locals.importLog.error = error;
  res.locals.importLog.details = details;
  const body = { error, ...extraBody };
  if (details) body.details = details;
  return res.status(status).json(body);
};

// multer's errors (wrong extension, file too large) otherwise reach Express's
// default handler, which answers with an HTML page the frontend cannot read
const receiveImportFile = (upload, field) => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return failImport(res, 413, 'File too large (max 50 MB).');
    return failImport(res, 400, err.message);
  });
};

module.exports = { trackImport, failImport, receiveImportFile };
