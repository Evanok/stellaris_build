require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const SteamStrategy = require('passport-steam').Strategy;
const { db } = require('./database');

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser((id, done) => {
  db.get('SELECT * FROM users WHERE id = ?', [id], (err, user) => {
    done(err, user);
  });
});

// Helper function to find or create user
const findOrCreateUser = (profile, done) => {
  const { provider, providerId, email, username, avatar } = profile;

  // Check if user already exists
  db.get(
    'SELECT * FROM users WHERE provider = ? AND provider_id = ?',
    [provider, providerId],
    (err, user) => {
      if (err) {
        return done(err);
      }

      if (user) {
        // User exists, return it
        return done(null, user);
      }

      // Create new user
      db.run(
        'INSERT INTO users (username, email, avatar, provider, provider_id) VALUES (?, ?, ?, ?, ?)',
        [username, email, avatar, provider, providerId],
        function (err) {
          if (err) {
            return done(err);
          }

          // Return newly created user
          db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, newUser) => {
            done(err, newUser);
          });
        }
      );
    }
  );
};

// Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/google/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      const userProfile = {
        provider: 'google',
        providerId: profile.id,
        email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
        username: profile.displayName,
        avatar: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
      };

      findOrCreateUser(userProfile, done);
    }
  )
);

// Steam OpenID Strategy
passport.use(
  new SteamStrategy(
    {
      returnURL: process.env.STEAM_RETURN_URL || 'http://localhost:3001/auth/steam/callback',
      realm: process.env.STEAM_REALM || 'http://localhost:3001/',
      apiKey: process.env.STEAM_API_KEY || 'YOUR_STEAM_API_KEY',
    },
    (identifier, profile, done) => {
      const userProfile = {
        provider: 'steam',
        providerId: profile.id,
        email: null, // Steam doesn't provide email
        username: profile.displayName,
        avatar: profile.photos && profile.photos[2] ? profile.photos[2].value : null, // Full size avatar
      };

      findOrCreateUser(userProfile, done);
    }
  )
);

module.exports = passport;
