#!/usr/bin/env node
// Standalone rule checker - no server, no browser, just Node + the extracted
// game data. Checks a build (or every build in the DB) against the
// potential/possible predicates in backend/data/versions/<X.Y>/{civics,origins}.json.
//
// Usage:
//   node check_build_rules.js check <build.json>   Check a single build (a JSON
//                                                    file shaped like GET /api/builds/:id -
//                                                    origin, ethics, authority, civics,
//                                                    traits, species_class, is_nomadic,
//                                                    game_version)
//   node check_build_rules.js check-id <id>         Fetch build <id> from the local
//                                                    DB and check it
//   node check_build_rules.js audit                 Check every non-deleted build in
//                                                    the local DB (TODO.md section 3a)
//
// Only game_version 4.4 has been re-extracted with the fixed predicate format
// (see TODO.md section 1) - builds on other versions are still checked, but
// against unverified/older data, and are reported as such.

const path = require('path');
const fs = require('fs');
const { getFailingConditions, contextFromBuild } = require('./rules/predicateEvaluator');

const AVAILABLE_DATA_VERSIONS = ['4.2', '4.3', '4.4'];
const FIXED_VERSIONS = new Set(['4.4']); // versions re-extracted with the structured predicate format

function getDataVersion(requestedVersion) {
  if (!requestedVersion) return AVAILABLE_DATA_VERSIONS[0];
  const match = String(requestedVersion).match(/(\d+)\.(\d+)/);
  if (!match) return AVAILABLE_DATA_VERSIONS[0];
  const reqMajor = parseInt(match[1], 10);
  const reqMinor = parseInt(match[2], 10);
  let result = AVAILABLE_DATA_VERSIONS[0];
  for (const v of AVAILABLE_DATA_VERSIONS) {
    const [vMajor, vMinor] = v.split('.').map(Number);
    if (reqMajor > vMajor || (reqMajor === vMajor && reqMinor >= vMinor)) {
      result = v;
    }
  }
  return result;
}

function loadVersionData(dataVersion) {
  const dir = path.join(__dirname, 'data', 'versions', dataVersion);
  const civics = JSON.parse(fs.readFileSync(path.join(dir, 'civics.json'), 'utf8'));
  const origins = JSON.parse(fs.readFileSync(path.join(dir, 'origins.json'), 'utf8'));
  const speciesClasses = JSON.parse(fs.readFileSync(path.join(dir, 'species_classes.json'), 'utf8'));
  const authorities = JSON.parse(fs.readFileSync(path.join(dir, 'authorities.json'), 'utf8'));
  const traits = JSON.parse(fs.readFileSync(path.join(dir, 'traits.json'), 'utf8'));
  const archetypeBudgets = JSON.parse(fs.readFileSync(path.join(dir, 'species_archetypes.json'), 'utf8'));
  return {
    civicById: Object.fromEntries(civics.map(c => [c.id, c])),
    originById: Object.fromEntries(origins.map(o => [o.id, o])),
    archetypeByClass: Object.fromEntries(speciesClasses.map(c => [c.id, c.archetype])),
    authorityById: Object.fromEntries(authorities.map(a => [a.id, a])),
    costByTraitId: Object.fromEntries(traits.map(t => [t.id, t.cost])),
    archetypeBudgets,
  };
}

// Mirrors BuildForm.tsx's getOriginTraitBonuses(): an origin's `modifier` can
// grant `<ARCHETYPE>_species_trait_points_add` / `_picks_add` (e.g. Shroud
// Forged grants ROBOT +1/+1).
function getOriginTraitBonus(origin, speciesArchetype) {
  const modifier = (origin && origin.modifier) || {};
  return {
    pointsBonus: modifier[`${speciesArchetype}_species_trait_points_add`] || 0,
    picksBonus: modifier[`${speciesArchetype}_species_trait_picks_add`] || 0,
  };
}

// Checks one build record (already in the {origin, ethics, authority, civics,
// traits, species_class, is_nomadic, game_version} shape). Returns
// { issues: string[], dataVersion: string, verified: boolean }.
function checkBuild(build) {
  const dataVersion = getDataVersion(build.game_version);
  const verified = FIXED_VERSIONS.has(dataVersion);
  const { civicById, originById, archetypeByClass, authorityById, costByTraitId, archetypeBudgets } = loadVersionData(dataVersion);
  const ctx = contextFromBuild(build, archetypeByClass);
  const issues = [];

  // GOVERNMENT_CIVIC_POINTS_BASE in common/defines/00_defines.txt - 2 civics
  // max at creation, confirmed in-game. BuildForm.tsx used to allow 3
  // (MAX_CIVIC_SLOTS) until 2026-08-10 - about 40% of existing builds have 3.
  if (ctx.civics.length > 2) {
    issues.push(`civics: ${ctx.civics.length} selected, but the game only allows 2 at empire creation`);
  }

  // Trait point/pick budget differs per archetype (e.g. MACHINE: 1 point/5
  // traits, ROBOT: 0 points/4 traits) - double-checked here independently of
  // BuildForm.tsx's live enforcement.
  const budget = archetypeBudgets[ctx.species_archetype];
  if (budget && budget.trait_points != null && budget.max_traits != null) {
    const origin = build.origin ? originById[build.origin] : null;
    const { pointsBonus, picksBonus } = getOriginTraitBonus(origin, ctx.species_archetype);
    const maxPoints = budget.trait_points + pointsBonus;
    const maxCount = budget.max_traits + picksBonus;
    const traitPoints = ctx.traits.reduce((sum, id) => sum + (costByTraitId[id] || 0), 0);
    const traitCount = ctx.traits.filter(id => (costByTraitId[id] || 0) !== 0).length;
    if (traitPoints > maxPoints) {
      issues.push(`species traits: ${traitPoints} trait points spent, but ${ctx.species_archetype} allows only ${maxPoints}`);
    }
    if (traitCount > maxCount) {
      issues.push(`species traits: ${traitCount} traits selected, but ${ctx.species_archetype} allows only ${maxCount}`);
    }
  }

  if (build.authority) {
    const authority = authorityById[build.authority];
    if (!authority) {
      issues.push(`authority "${build.authority}" not found in ${dataVersion} data (removed/renamed?)`);
    } else {
      getFailingConditions(authority.possible, ctx).forEach(r => issues.push(`authority "${build.authority}" possible violated: ${r}`));
      getFailingConditions(authority.potential, ctx).forEach(r => issues.push(`authority "${build.authority}" potential violated: ${r}`));
    }
  }

  if (build.origin) {
    const origin = originById[build.origin];
    if (!origin) {
      issues.push(`origin "${build.origin}" not found in ${dataVersion} data (removed/renamed?)`);
    } else {
      getFailingConditions(origin.possible, ctx).forEach(r => issues.push(`origin "${build.origin}" possible violated: ${r}`));
      getFailingConditions(origin.potential, ctx).forEach(r => issues.push(`origin "${build.origin}" potential violated: ${r}`));
    }
  }

  for (const civicId of ctx.civics) {
    const civic = civicById[civicId];
    if (!civic) {
      issues.push(`civic "${civicId}" not found in ${dataVersion} data (removed/renamed?)`);
      continue;
    }
    getFailingConditions(civic.possible, ctx).forEach(r => issues.push(`civic "${civicId}" possible violated: ${r}`));
    getFailingConditions(civic.potential, ctx).forEach(r => issues.push(`civic "${civicId}" potential violated: ${r}`));
  }

  return { issues, dataVersion, verified };
}

function printResult(label, result) {
  const versionNote = result.verified ? '' : ' (unverified data - only 4.4 has the fixed predicate format)';
  console.log(`${label} [game_version -> ${result.dataVersion}${versionNote}]`);
  if (result.issues.length === 0) {
    console.log('  No rule violations found.');
  } else {
    result.issues.forEach(issue => console.log(`  - ${issue}`));
  }
}

// Accepts a bare build object, the { build: {...} } wrapper from
// GET /api/builds/:id, the { builds: [...] } wrapper from GET /api/builds, or
// a raw JSON array of builds.
function extractBuilds(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.builds)) return parsed.builds;
  if (parsed && parsed.build && typeof parsed.build === 'object') return [parsed.build];
  return [parsed];
}

function cmdCheckFile(filePath) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const builds = extractBuilds(parsed);
  builds.forEach((b, i) => printResult(`Build ${b.name ? `"${b.name}"` : `#${i}`}`, checkBuild(b)));
}

function cmdCheckId(id) {
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(path.join(__dirname, 'stellaris_builds.db'), sqlite3.OPEN_READONLY);
  db.get('SELECT * FROM builds WHERE id = ?', [id], (err, build) => {
    if (err) { console.error(err); db.close(); return; }
    if (!build) { console.error(`No build with id ${id}`); db.close(); return; }
    printResult(`Build #${build.id} "${build.name}"`, checkBuild(build));
    db.close();
  });
}

function cmdAudit() {
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(path.join(__dirname, 'stellaris_builds.db'), sqlite3.OPEN_READONLY);
  db.all('SELECT * FROM builds WHERE deleted = 0', (err, builds) => {
    if (err) { console.error(err); db.close(); return; }
    console.log(`Auditing ${builds.length} builds\n`);
    let violating = 0;
    for (const build of builds) {
      const result = checkBuild(build);
      if (result.issues.length > 0) {
        violating++;
        printResult(`Build #${build.id} "${build.name}"`, result);
        console.log('');
      }
    }
    console.log('---');
    console.log(`Total audited: ${builds.length}`);
    console.log(`Builds with at least one violation: ${violating}`);
    db.close();
  });
}

const [, , cmd, arg] = process.argv;

if (cmd === 'check' && arg) {
  cmdCheckFile(arg);
} else if (cmd === 'check-id' && arg) {
  cmdCheckId(arg);
} else if (cmd === 'audit') {
  cmdAudit();
} else {
  console.log('Usage:');
  console.log('  node check_build_rules.js check <build.json>');
  console.log('  node check_build_rules.js check-id <id>');
  console.log('  node check_build_rules.js audit');
  process.exit(1);
}
