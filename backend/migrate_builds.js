const sqlite3 = require('sqlite3').verbose();

// Open both databases
const prodDb = new sqlite3.Database('./stellaris_builds_prod_backup.db', sqlite3.OPEN_READONLY);
const devDb = new sqlite3.Database('./stellaris_builds.db');

console.log('Starting migration...\n');

// Get all builds from production
prodDb.all('SELECT * FROM builds', (err, builds) => {
  if (err) {
    console.error('Error reading production builds:', err);
    return;
  }

  console.log(`Found ${builds.length} builds in production database\n`);

  if (builds.length === 0) {
    console.log('No builds to migrate.');
    prodDb.close();
    devDb.close();
    return;
  }

  // Insert each build into dev database with author_id = 1
  let completed = 0;
  const authorId = 1; // Your user ID

  builds.forEach((build, index) => {
    const sql = `INSERT INTO builds
      (name, description, game_version, youtube_url, civics, traits, origin, ethics, authority,
       ascension_perks, traditions, ruler_trait, dlcs, tags, author_id, created_at, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const params = [
      build.name,
      build.description,
      build.game_version,
      build.youtube_url || null,
      build.civics,
      build.traits,
      build.origin,
      build.ethics,
      build.authority,
      build.ascension_perks || null,
      build.traditions || null,
      build.ruler_trait || null,
      build.dlcs,
      build.tags,
      authorId, // Assign to your user
      build.created_at,
      build.deleted || 0
    ];

    devDb.run(sql, params, function(err) {
      completed++;

      if (err) {
        console.error(`❌ Error migrating build "${build.name}":`, err.message);
      } else {
        console.log(`✓ Migrated build ${completed}/${builds.length}: "${build.name}"`);
      }

      // Close databases when done
      if (completed === builds.length) {
        console.log(`\n✅ Migration complete! ${builds.length} builds migrated.`);
        prodDb.close();
        devDb.close();
      }
    });
  });
});
