// Evaluates the structured predicate trees produced by
// data-extractor/extract_civics_and_origins.py (civic/origin `potential` and
// `possible` fields). Mirrors frontend/src/utils/ruleEvaluator.ts - backend is
// CommonJS with no build step, frontend is TS/Vite, so this is a deliberate
// duplication until/unless a shared package is worth the setup. Keep both in
// sync.

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
    case 'country_type': return value === 'default'; // player empires are always country_type "default"
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

const splitCsv = str => (typeof str === 'string' ? str.split(',').map(s => s.trim()).filter(Boolean) : (Array.isArray(str) ? str : []));

// Builds an evaluator context from a build record shaped like the SQLite
// `builds` row / the JSON returned by GET /api/builds/:id (comma-separated
// strings for ethics/civics/traits).
function contextFromBuild(build, archetypeByClass) {
  return {
    ethics: splitCsv(build.ethics),
    authority: build.authority || undefined,
    civics: splitCsv(build.civics),
    origin: build.origin || undefined,
    species_archetype: (archetypeByClass || {})[build.species_class] || undefined,
    species_class: build.species_class || undefined,
    traits: splitCsv(build.traits),
    is_nomadic: !!build.is_nomadic,
  };
}

module.exports = {
  evaluatePredicate,
  describe,
  getFailingConditions,
  contextFromBuild,
  splitCsv,
};
