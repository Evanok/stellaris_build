const BUILD_TAGS = require('../shared/build_tags.json');
const KNOWN_TAG_IDS = new Set(BUILD_TAGS.tags.map(tag => tag.id));

// Deduplicated list of tag ids from the stored comma-separated value
const splitTagIds = (value) => [...new Set(value.split(',').map(s => s.trim()).filter(Boolean))];

// Manual rate limiting stores
const apiRequestStore = new Map();
const buildCreationStore = new Map();
const importStore = new Map();

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
  for (const [key, data] of buildCreationStore.entries()) {
    if (now - data.resetTime > oneHour) {
      buildCreationStore.delete(key);
    }
  }
}, 15 * 60 * 1000);

// General API rate limiter - 100 requests per 15 minutes per IP
const apiLimiter = (req, res, next) => {
  // Skip rate limiting on localhost for development
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (isLocalhost) {
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
  const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (isLocalhost) {
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
// No localhost bypass here on purpose: req.hostname comes from X-Forwarded-Host
// behind the proxy, which a client can set itself.
const IMPORT_LIMIT_ANONYMOUS = 30;
const IMPORT_LIMIT_USER = 60;

const importLimiter = (req, res, next) => {
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

module.exports = {
  apiLimiter,
  importLimiter,
  createBuildLimiter,
  validateBuildData,
  sanitizeBuildData,
};
