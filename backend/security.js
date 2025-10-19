// Manual rate limiting stores
const apiRequestStore = new Map();
const buildCreationStore = new Map();

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
  if (userData.count > 100) {
    return res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
    });
  }

  apiRequestStore.set(key, userData);
  next();
};

// Manual rate limiter middleware for build creation - 5 builds per hour
const createBuildLimiter = (req, res, next) => {
  // Use user ID if authenticated, otherwise skip rate limiting (protected by auth middleware anyway)
  if (!req.user) {
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
  if (userData.count > 5) {
    return res.status(429).json({
      error: 'You can only create 5 builds per hour. Please wait before creating more.',
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

  // Tags validation
  if (data.tags && typeof data.tags === 'string') {
    if (data.tags.length > 500) {
      errors.push('Tags must be less than 500 characters');
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
  const stringFields = ['name', 'description', 'game_version', 'tags'];
  stringFields.forEach(field => {
    if (sanitized[field] && typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeString(sanitized[field]);
    }
  });

  return sanitized;
};

module.exports = {
  apiLimiter,
  createBuildLimiter,
  validateBuildData,
  sanitizeBuildData,
};
