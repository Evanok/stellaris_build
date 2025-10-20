/**
 * Validates required environment variables on startup
 * Exits with clear error messages if critical variables are missing
 */

function validateEnv() {
  const errors = [];
  const warnings = [];

  // Critical variables (app won't work without these)
  const critical = {
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID,
    'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET,
  };

  // Recommended variables (app works but with limited functionality)
  const recommended = {
    'SESSION_SECRET': process.env.SESSION_SECRET,
    'STEAM_API_KEY': process.env.STEAM_API_KEY,
    'ADMIN_EMAIL': process.env.ADMIN_EMAIL,
  };

  // Optional variables (have sensible defaults)
  const optional = {
    'PORT': process.env.PORT,
    'NODE_ENV': process.env.NODE_ENV,
    'SERVER_HOST': process.env.SERVER_HOST,
  };

  // Check critical variables
  for (const [key, value] of Object.entries(critical)) {
    if (!value || value.trim() === '') {
      errors.push(`❌ CRITICAL: ${key} is not set`);
    }
  }

  // Check recommended variables
  for (const [key, value] of Object.entries(recommended)) {
    if (!value || value.trim() === '') {
      warnings.push(`⚠️  WARNING: ${key} is not set`);
    }
  }

  // Display results
  if (errors.length > 0 || warnings.length > 0) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Environment Variables Check');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  // Show errors
  if (errors.length > 0) {
    console.error('🚨 CRITICAL ERRORS:\n');
    errors.forEach(err => console.error(`   ${err}`));
    console.error('\n💡 To fix this:');
    console.error('   1. Copy backend/.env.example to backend/.env');
    console.error('   2. Fill in your Google OAuth credentials');
    console.error('   3. See CLAUDE.md for setup instructions\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    process.exit(1);
  }

  // Show warnings
  if (warnings.length > 0) {
    console.warn('⚠️  WARNINGS:\n');
    warnings.forEach(warn => {
      console.warn(`   ${warn}`);

      // Provide specific guidance for each warning
      if (warn.includes('SESSION_SECRET')) {
        console.warn('      → Using default secret (NOT SECURE for production!)');
      } else if (warn.includes('STEAM_API_KEY')) {
        console.warn('      → Steam OAuth login will not work');
      } else if (warn.includes('ADMIN_EMAIL')) {
        console.warn('      → No admin user will be configured');
      }
    });
    console.warn('\n💡 These are optional but recommended for full functionality');
    console.warn('   See backend/.env.example for details\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  // Success message if everything is configured
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ All environment variables are properly configured!\n');
  }
}

module.exports = { validateEnv };
