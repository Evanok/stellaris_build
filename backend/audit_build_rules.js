// Audits existing 4.4 builds against the structured potential/possible
// predicates produced by data-extractor/extract_civics_and_origins.py.
// Read-only, no schema change - see TODO.md section 3a.
//
// NOTE: this duplicates the evaluator logic in
// frontend/src/utils/ruleEvaluator.ts. Backend is CommonJS with no build
// step, frontend is TS/Vite - not worth a shared package until this proves
// out. Keep both in sync until then.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const VERSION = '4.4';
const civics = require(`./data/versions/${VERSION}/civics.json`);
const origins = require(`./data/versions/${VERSION}/origins.json`);
const speciesClasses = require(`./data/versions/${VERSION}/species_classes.json`);

const civicById = Object.fromEntries(civics.map(c => [c.id, c]));
const originById = Object.fromEntries(origins.map(o => [o.id, o]));
const archetypeByClass = Object.fromEntries(speciesClasses.map(c => [c.id, c.archetype]));

function evaluateField(field, value, ctx) {
  switch (field) {
    case 'ethics': return (ctx.ethics || []).includes(value);
    case 'authority': return ctx.authority === value;
    case 'civics': return (ctx.civics || []).includes(value);
    case 'origin': return ctx.origin === value;
    case 'species_archetype': return ctx.species_archetype === value;
    case 'species_class': return ctx.species_class === value;
    case 'traits': return (ctx.traits || []).includes(value);
    case 'is_nomadic': return !!ctx.is_nomadic === !!value;
    case 'preferred_planet_class': return ctx.preferred_planet_class === value;
    case 'graphical_culture': return ctx.graphical_culture === value;
    case 'country_type': return true; // NPC-only civics/origins already filtered at extraction time
    case 'host_has_dlc': return true; // can't know which DLC a build's author owns
    default: return true;
  }
}

function evaluatePredicate(node, ctx) {
  if (!node) return true;
  if (node.all) return node.all.every(c => evaluatePredicate(c, ctx));
  if (node.any) return node.any.some(c => evaluatePredicate(c, ctx));
  if (node.not) return !evaluatePredicate(node.not, ctx);
  if ('always' in node) return !!node.always;
  if ('unsupported' in node || 'unsupported_limit' in node) return true;
  if (node.field) return evaluateField(node.field, node.value, ctx);
  return true;
}

function describe(node) {
  if (node.all) return '(' + node.all.map(describe).join(' AND ') + ')';
  if (node.any) return '(' + node.any.map(describe).join(' OR ') + ')';
  if (node.not) return 'NOT ' + describe(node.not);
  if ('always' in node) return `always=${node.always}`;
  if (node.field) return `${node.field}=${JSON.stringify(node.value)}`;
  if ('unsupported' in node) return `<unsupported:${JSON.stringify(node.unsupported)}>`;
  if ('unsupported_limit' in node) return '<unsupported_limit>';
  return '<?>';
}

// Drill into failing AND-branches to report the most specific failing
// sub-condition instead of the whole (often large) possible/potential block.
function getFailingConditions(node, ctx) {
  if (!node) return [];
  if (node.all) {
    return node.all
      .filter(c => !evaluatePredicate(c, ctx))
      .flatMap(c => (c.all ? getFailingConditions(c, ctx) : [describe(c)]));
  }
  return evaluatePredicate(node, ctx) ? [] : [describe(node)];
}

const splitCsv = str => (str ? str.split(',').map(s => s.trim()).filter(Boolean) : []);

function buildContext(build) {
  return {
    ethics: splitCsv(build.ethics),
    authority: build.authority || undefined,
    civics: splitCsv(build.civics),
    origin: build.origin || undefined,
    species_archetype: archetypeByClass[build.species_class] || undefined,
    species_class: build.species_class || undefined,
    traits: splitCsv(build.traits),
    is_nomadic: !!build.is_nomadic,
  };
}

const db = new sqlite3.Database(path.join(__dirname, 'stellaris_builds.db'), sqlite3.OPEN_READONLY);

db.all(
  `SELECT id, name, origin, ethics, authority, civics, traits, species_class, is_nomadic, game_version
   FROM builds WHERE deleted = 0 AND game_version LIKE '4.4%'`,
  (err, builds) => {
    if (err) {
      console.error('Error reading builds:', err);
      db.close();
      return;
    }

    console.log(`Auditing ${builds.length} builds (game_version 4.4.x)\n`);

    let violatingBuilds = 0;
    let unknownOrigin = 0;
    let unknownCivics = 0;

    for (const build of builds) {
      const ctx = buildContext(build);
      const issues = [];

      if (build.origin) {
        const origin = originById[build.origin];
        if (!origin) {
          unknownOrigin++;
          issues.push(`origin "${build.origin}" not found in 4.4 data (removed/renamed?)`);
        } else {
          for (const reason of getFailingConditions(origin.possible, ctx)) {
            issues.push(`origin "${build.origin}" possible violated: ${reason}`);
          }
          for (const reason of getFailingConditions(origin.potential, ctx)) {
            issues.push(`origin "${build.origin}" potential violated: ${reason}`);
          }
        }
      }

      for (const civicId of ctx.civics) {
        const civic = civicById[civicId];
        if (!civic) {
          unknownCivics++;
          issues.push(`civic "${civicId}" not found in 4.4 data (removed/renamed?)`);
          continue;
        }
        for (const reason of getFailingConditions(civic.possible, ctx)) {
          issues.push(`civic "${civicId}" possible violated: ${reason}`);
        }
        for (const reason of getFailingConditions(civic.potential, ctx)) {
          issues.push(`civic "${civicId}" potential violated: ${reason}`);
        }
      }

      if (issues.length > 0) {
        violatingBuilds++;
        console.log(`Build #${build.id} "${build.name}":`);
        issues.forEach(issue => console.log(`  - ${issue}`));
        console.log('');
      }
    }

    console.log('---');
    console.log(`Total audited: ${builds.length}`);
    console.log(`Builds with at least one violation: ${violatingBuilds}`);
    console.log(`References to unknown origins: ${unknownOrigin}`);
    console.log(`References to unknown civics: ${unknownCivics}`);

    db.close();
  }
);
