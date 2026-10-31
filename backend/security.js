const BUILD_TAGS = require('../shared/build_tags.json');
const KNOWN_TAG_IDS = new Set(BUILD_TAGS.tags.map(tag => tag.id));

// Deduplicated list of tag ids from the stored comma-separated value
const splitTagIds = (value) => [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))];

// Dev bypass for the rate limiters: true only for requests really coming from this
// machine. Based on req.ip, not req.hostname: with 'trust proxy', req.hostname is
// read from the X-Forwarded-Host header, which nginx passes through untouched, so
// any client could send "X-Forwarded-Host: localhost" and skip every limit. req.ip
// comes from X-Forwarded-For, whose last hop nginx appends itself (real client IP).
const LOCAL_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const isLocalRequest = (req) => LOCAL_IPS.has(req.ip);

// Manual rate limiting stores
const apiRequestStore = new Map();
const buildCreationStore = new Map();
const importStore = new Map();
const guestSubmitStore = new Map();
const guestEmailStore = new Map();

// Clean up old entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;

  // Clean API request store
  for (const [key, data] of apiRequestStore.entries()) {
    if (now - data.resetTime > fifteenMinutes) {
      apiRequestStore.delete(key);
    }
  }

  // Clean build creation store
  const oneHour = 60 * 60 * 1000;
  for (const [key, data] of importStore.entries()) {
    if (now - data.resetTime > oneHour) {
      importStore.delete(key);
    }
  }
  for (const [key, data] of guestSubmitStore.entries()) {
    if (now - data.resetTime > 24 * oneHour) {
      guestSubmitStore.delete(key);
    }
  }
  for (const [key, data] of guestEmailStore.entries()) {
    if (now - data.resetTime > 24 * oneHour) {
      guestEmailStore.delete(key);
    }
  }
  for (const [key, data] of buildCreationStore.entries()) {
    if (now - data.resetTime > oneHour) {
      buildCreationStore.delete(key);
    }
  }
}, 15 * 60 * 1000);

// General API rate limiter - 100 requests per 15 minutes per IP
const apiLimiter = (req, res, next) => {
  // Skip rate limiting on localhost for development
  if (isLocalRequest(req)) {
    return next();
  }

  // Use IP address as key
  const key = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const fifteenMinutes = 15 * 60 * 1000;

  let userData = apiRequestStore.get(key);

  if (!userData) {
    // First request from this IP
    userData = {
      count: 1,
      resetTime: now,
    };
    apiRequestStore.set(key, userData);
    return next();
  }

  // Check if the time window has expired
  if (now - userData.resetTime > fifteenMinutes) {
    // Reset the counter
    userData.count = 1;
    userData.resetTime = now;
    apiRequestStore.set(key, userData);
    return next();
  }

  // Increment the counter
  userData.count += 1;

  // Check if limit exceeded
  if (userData.count > 500) {
    return res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
    });
  }

  apiRequestStore.set(key, userData);
  next();
};

// Manual rate limiter middleware for build creation - 20 builds per hour (unlimited on localhost)
const createBuildLimiter = (req, res, next) => {
  // Skip rate limiting on localhost for development
  if (isLocalRequest(req)) {
    return next();
  }

  // Use user ID if authenticated, otherwise skip rate limiting (protected by auth middleware anyway)
  if (!req.user) {
    return next();
  }

  // Skip rate limiting for test users
  if (req.user.provider === 'test' && req.user.provider_id === 'test-user-id') {
    return next();
  }

  const key = req.user.id.toString();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  let userData = buildCreationStore.get(key);

  if (!userData) {
    // First request from this user
    userData = {
      count: 1,
      resetTime: now,
    };
    buildCreationStore.set(key, userData);
    return next();
  }

  // Check if the time window has expired
  if (now - userData.resetTime > oneHour) {
    // Reset the counter
    userData.count = 1;
    userData.resetTime = now;
    buildCreationStore.set(key, userData);
    return next();
  }

  // Increment the counter
  userData.count += 1;

  // Check if limit exceeded
  if (userData.count > 20) {
    return res.status(429).json({
      error: 'You can only create 20 builds per hour. Please wait before creating more.',
    });
  }

  buildCreationStore.set(key, userData);
  next();
};

// Validation functions
const validateBuildData = (data) => {
  const errors = [];

  // Name validation
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Build name is required');
  } else if (data.name.length > 100) {
    errors.push('Build name must be less than 100 characters');
  } else if (data.name.trim().length === 0) {
    errors.push('Build name cannot be empty');
  }

  // Description validation
  if (data.description && typeof data.description === 'string') {
    if (data.description.length > 5000) {
      errors.push('Description must be less than 5000 characters');
    }
  }

  // Game version validation
  if (data.game_version && typeof data.game_version === 'string') {
    if (data.game_version.length > 20) {
      errors.push('Game version must be less than 20 characters');
    }
  }

  // YouTube URL validation
  if (data.youtube_url && typeof data.youtube_url === 'string') {
    if (data.youtube_url.length > 500) {
      errors.push('YouTube URL must be less than 500 characters');
    }
    // Validate it's a YouTube URL
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    if (!youtubeRegex.test(data.youtube_url)) {
      errors.push('Invalid YouTube URL format');
    }
  }

  // Tags validation: only the hardcoded ids from shared/build_tags.json are accepted
  if (data.tags !== undefined && data.tags !== null && data.tags !== '') {
    if (typeof data.tags !== 'string') {
      errors.push('Tags must be a comma-separated string');
    } else {
      const ids = splitTagIds(data.tags);
      const unknown = ids.filter(id => !KNOWN_TAG_IDS.has(id));
      if (unknown.length > 0) {
        errors.push(`Unknown tag(s): ${unknown.join(', ')}`);
      }
      if (ids.length > BUILD_TAGS.maxPerBuild) {
        errors.push(`A build can have at most ${BUILD_TAGS.maxPerBuild} tags`);
      }
      for (const [a, b] of BUILD_TAGS.exclusive) {
        if (ids.includes(a) && ids.includes(b)) {
          errors.push(`Tags "${a}" and "${b}" cannot be combined`);
        }
      }
    }
  }

  // Array fields validation (should be comma-separated strings)
  const arrayFields = ['civics', 'traits', 'ethics', 'ascension_perks', 'traditions', 'dlcs'];
  arrayFields.forEach(field => {
    if (data[field] && typeof data[field] === 'string') {
      if (data[field].length > 1000) {
        errors.push(`${field} must be less than 1000 characters`);
      }
    }
  });

  // Single value fields
  const singleFields = ['origin', 'authority', 'ruler_trait'];
  singleFields.forEach(field => {
    if (data[field] && typeof data[field] === 'string') {
      if (data[field].length > 200) {
        errors.push(`${field} must be less than 200 characters`);
      }
    }
  });

  // Third civic (optional, unlocked during the game): a single civic id
  if (data.third_civic !== undefined && data.third_civic !== null && data.third_civic !== '') {
    if (typeof data.third_civic !== 'string' || !/^[a-z][a-z0-9_]{1,100}$/.test(data.third_civic)) {
      errors.push('Invalid third civic');
    } else if (typeof data.civics === 'string' && data.civics.split(',').map(c => c.trim()).includes(data.third_civic)) {
      errors.push('The third civic is already one of the starting civics');
    }
  }

  // Homeworld planet class (optional): a game id like "pc_desert". Not checked
  // against planet_classes.json - the rule evaluator handles game validity,
  // this only keeps arbitrary strings out of the column.
  if (data.planet_class !== undefined && data.planet_class !== null && data.planet_class !== '') {
    if (typeof data.planet_class !== 'string' || !/^pc_[a-z0-9_]{1,60}$/.test(data.planet_class)) {
      errors.push('Invalid planet class');
    }
  }

  // Ship appearance (optional): a graphical culture id like "humanoid_01"
  if (data.graphical_culture !== undefined && data.graphical_culture !== null && data.graphical_culture !== '') {
    if (typeof data.graphical_culture !== 'string' || !/^[a-z][a-z0-9_]{1,60}$/.test(data.graphical_culture)) {
      errors.push('Invalid ship appearance');
    }
  }

  return errors;
};

// Sanitize HTML to prevent XSS
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;

  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Sanitize build data
const sanitizeBuildData = (data) => {
  const sanitized = { ...data };

  // Sanitize string fields
  const stringFields = ['name', 'description', 'game_version'];
  stringFields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeString(sanitized[field]);
    }
  });

  // Tags are already whitelisted by validateBuildData: store them deduplicated, in canonical order
  if (typeof sanitized.tags === 'string') {
    const ids = new Set(splitTagIds(sanitized.tags));
    sanitized.tags = BUILD_TAGS.tags.filter(tag => ids.has(tag.id)).map(tag => tag.id).join(',');
  }

  return sanitized;
};

// Rate limiter for file imports (.sav / empire designs). Imports are open to
// anonymous visitors (the login is asked at publish time), and each one runs a
// Python parser on up to 50 MB, so they get their own, tighter budget per hour:
// per IP for visitors, per account once logged in. An empire designs import is
// 2 requests (list empires, then import one).
const IMPORT_LIMIT_ANONYMOUS = 30;
const IMPORT_LIMIT_USER = 60;

const importLimiter = (req, res, next) => {
  if (isLocalRequest(req)) return next();
  const key = req.user ? `user:${req.user.id}` : `ip:${req.ip || 'unknown'}`;
  const limit = req.user ? IMPORT_LIMIT_USER : IMPORT_LIMIT_ANONYMOUS;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  let entry = importStore.get(key);
  if (!entry || now - entry.resetTime > oneHour) {
    entry = { count: 0, resetTime: now };
    importStore.set(key, entry);
  }

  entry.count += 1;
  if (entry.count > limit) {
    return res.status(429).json({
      error: 'Too many imports, please try again in an hour.',
    });
  }
  next();
};

// Rate limiter for builds submitted without an account (moderation queue): every
// one of them lands in the moderator's inbox, so keep it to a few per day per IP.
const GUEST_SUBMIT_LIMIT_PER_DAY = 5;

const guestSubmitLimiter = (req, res, next) => {
  if (isLocalRequest(req)) return next();
  const key = req.ip || 'unknown';
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;

  let entry = guestSubmitStore.get(key);
  if (!entry || now - entry.resetTime > oneDay) {
    entry = { count: 0, resetTime: now };
    guestSubmitStore.set(key, entry);
  }

  if (entry.count >= GUEST_SUBMIT_LIMIT_PER_DAY) {
    return res.status(429).json({
      error: 'Too many builds submitted without an account today. Sign in to keep publishing, or try again tomorrow.',
    });
  }
  // The slot is reserved before the (async) handler runs, otherwise parallel
  // requests would all pass the check above before any of them is counted.
  // Only successful submissions keep it: a visitor retrying after "name already
  // taken" or a validation error should not burn their daily quota.
  entry.count += 1;
  res.on('finish', () => {
    if (res.statusCode !== 201) entry.count = Math.max(0, entry.count - 1);
  });
  next();
};

// Emails sent to the address a guest typed in. Nothing proves the address is
// theirs, so anyone could make the site email a stranger: cap it per address and
// overall, per day. Beyond the cap the build is still saved, just not emailed
// (the claim link is shown on screen anyway).
const GUEST_EMAILS_PER_ADDRESS_PER_DAY = 3;
const GUEST_EMAILS_TOTAL_PER_DAY = 50;
const GUEST_EMAIL_TOTAL_KEY = '*';

// Returns true and counts the email if it may be sent
const reserveGuestEmail = (address) => {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const entryFor = (key) => {
    let entry = guestEmailStore.get(key);
    if (!entry || now - entry.resetTime > oneDay) {
      entry = { count: 0, resetTime: now };
      guestEmailStore.set(key, entry);
    }
    return entry;
  };

  const perAddress = entryFor(`address:${address}`);
  const total = entryFor(GUEST_EMAIL_TOTAL_KEY);
  if (perAddress.count >= GUEST_EMAILS_PER_ADDRESS_PER_DAY || total.count >= GUEST_EMAILS_TOTAL_PER_DAY) {
    return false;
  }
  perAddress.count += 1;
  total.count += 1;
  return true;
};

module.exports = {
  apiLimiter,
  importLimiter,
  guestSubmitLimiter,
  reserveGuestEmail,
  createBuildLimiter,
  validateBuildData,
  sanitizeBuildData,
};
