// Homeworld planet class rules - mirrors frontend/src/utils/planetRules.ts
// (backend is CommonJS with no build step, same deliberate duplication as
// predicateEvaluator.js). Keep both in sync.
//
// The planet is optional in a build. When known it is: pc_ark for Nomadic
// empires, else the origin's habitability_preference if it has one, else the
// build's own planet_class pick.

function getEffectivePlanetClass(build, origin) {
  if (build.is_nomadic) return 'pc_ark';
  return (origin && origin.habitability_preference) || build.planet_class || undefined;
}

// Traits (picked, or granted by the origin/civics) whose allowed_planet_classes
// exclude planetId. Origin/civic `preferred_planet_class` predicates are not
// checked here - they go through the normal possible/potential evaluation once
// the context carries preferred_planet_class.
function getTraitPlanetConflicts(planetId, { origin, civics, traitIds, traitById }) {
  const conflicts = [];
  const check = (traitId, grantedBy) => {
    const allowed = traitById[traitId] && traitById[traitId].allowed_planet_classes;
    if (!Array.isArray(allowed) || allowed.length === 0 || allowed.includes(planetId)) return;
    const via = grantedBy ? ` (granted by ${grantedBy})` : '';
    conflicts.push(`trait "${traitId}"${via} requires homeworld ${allowed.join('/')}, got ${planetId}`);
  };
  traitIds.forEach(id => check(id));
  if (origin) (origin.granted_traits || []).forEach(id => check(id, `origin "${origin.id}"`));
  civics.forEach(civic => (civic.granted_traits || []).forEach(id => check(id, `civic "${civic.id}"`)));
  return conflicts;
}

// A picked planet the species class is not offered by the empire creator
// (Volcanic is Infernal-only, Infernals cannot pick cold worlds). Origin-forced
// planets bypass this (Red Giant gives Volcanic to any species).
function getSpeciesPlanetConflict(planet, speciesClass) {
  const only = planet.only_species_classes || [];
  if (only.length > 0 && !only.includes(speciesClass)) {
    return `homeworld ${planet.id} can only be picked by species class ${only.join('/')}, got ${speciesClass || 'none'}`;
  }
  if (speciesClass && (planet.excluded_species_classes || []).includes(speciesClass)) {
    return `species class ${speciesClass} cannot pick homeworld ${planet.id}`;
  }
  return undefined;
}

module.exports = {
  getEffectivePlanetClass,
  getSpeciesPlanetConflict,
  getTraitPlanetConflicts,
};
