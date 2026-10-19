// Homeworld planet class rules. The planet itself is optional in a build; when
// set, it is the species' habitability preference (what the game writes as
// `planet_class` in an empire design). Rules come from four places in the
// extracted game data (see data-extractor/extract_planet_classes.py):
// - origin `habitability_preference`: forces the planet (Void Dwellers -> Habitat)
// - Nomadic empires always live on an Arkship (pc_ark)
// - origin/civic `possible`: `preferred_planet_class` predicates (e.g. "NOT volcanic")
// - trait `allowed_planet_classes` (Aquatic = ocean only), including traits an
//   origin/civic grants (`granted_traits`, e.g. Anglers grants Aquatic)
// Mirrored in backend/rules/planetRules.js - keep both in sync.

import { PredicateNode, findFieldOccurrences } from './ruleEvaluator';

export interface PlanetClass {
  id: string;
  name: string;
  description: string;
  climate: string | null;
  climate_name: string | null;
  selectable: boolean;
  icon: string;
  required_dlc?: string;
  only_species_classes?: string[]; // e.g. Volcanic: Infernal only
  excluded_species_classes?: string[]; // e.g. the cold worlds: not for Infernals
  picker_column: string | null; // dry / wet / cold, or a species-class column (volcanic)
  picker_column_name: string | null;
}

export interface PlanetRuleTrait {
  id: string;
  name?: string;
  allowed_planet_classes?: string[];
}

export interface PlanetRuleSource {
  id: string;
  name?: string;
  possible?: PredicateNode;
  habitability_preference?: string;
  granted_traits?: string[];
}

export interface PlanetRuleInput {
  isNomadic: boolean;
  origin?: PlanetRuleSource;
  civics: PlanetRuleSource[];
  traitIds: string[];
  traitById: Record<string, PlanetRuleTrait | undefined>;
}

/** Planet imposed by the rest of the build (Nomadic, or an origin's habitability_preference), if any. */
export function getForcedPlanetClass(isNomadic: boolean, origin?: PlanetRuleSource): string | undefined {
  if (isNomadic) return 'pc_ark';
  return origin?.habitability_preference || undefined;
}

/** The planet the build actually plays on: forced if any, else the user's pick (may be undefined). */
export function getEffectivePlanetClass(isNomadic: boolean, origin: PlanetRuleSource | undefined, picked: string | undefined | null): string | undefined {
  return getForcedPlanetClass(isNomadic, origin) || picked || undefined;
}

export type PlanetLabelResolver = (planetId: string) => string;

function sourceLabel(source: PlanetRuleSource, kind: 'Origin' | 'Civic'): string {
  return `${kind} "${source.name || source.id}"`;
}

/**
 * Trait-side conflicts: selected traits plus traits granted by the origin and
 * civics whose allowed_planet_classes exclude `planetId`. Only traits present
 * in traitById are checked (granted traits like Void Dweller are not species
 * picks and have no planet restriction in our data).
 */
export function getTraitPlanetConflicts(planetId: string, input: PlanetRuleInput, label: PlanetLabelResolver): string[] {
  const conflicts: string[] = [];
  const check = (traitId: string, grantedBy?: string) => {
    const trait = input.traitById[traitId];
    const allowed = trait?.allowed_planet_classes;
    if (!Array.isArray(allowed) || allowed.length === 0 || allowed.includes(planetId)) return;
    const via = grantedBy ? ` (granted by ${grantedBy})` : '';
    conflicts.push(`Trait "${trait?.name || traitId}"${via} requires a homeworld of type: ${allowed.map(label).join(', ')}`);
  };
  input.traitIds.forEach(id => check(id));
  if (input.origin) (input.origin.granted_traits || []).forEach(id => check(id, sourceLabel(input.origin!, 'Origin')));
  input.civics.forEach(civic => (civic.granted_traits || []).forEach(id => check(id, sourceLabel(civic, 'Civic'))));
  return conflicts;
}

/**
 * `preferred_planet_class` predicates of the origin/civics that `planetId`
 * violates. Uses findFieldOccurrences (polarity only) rather than a full
 * evaluation, so it works on a half-filled form. Already covered by the full
 * possible/potential evaluation at submit/export time - only for live UI.
 */
export function getPredicatePlanetConflicts(planetId: string, input: PlanetRuleInput, label: PlanetLabelResolver): string[] {
  const conflicts: string[] = [];
  const check = (source: PlanetRuleSource, kind: 'Origin' | 'Civic') => {
    const occurrences = findFieldOccurrences(source.possible, 'preferred_planet_class');
    const forbidden = occurrences.filter(o => o.negated).map(o => String(o.value));
    const required = occurrences.filter(o => !o.negated).map(o => String(o.value));
    if (forbidden.includes(planetId)) {
      conflicts.push(`${sourceLabel(source, kind)} cannot have a ${label(planetId)} homeworld`);
    } else if (required.length > 0 && !required.includes(planetId)) {
      conflicts.push(`${sourceLabel(source, kind)} requires a homeworld of type: ${required.map(label).join(', ')}`);
    }
  };
  if (input.origin) check(input.origin, 'Origin');
  input.civics.forEach(civic => check(civic, 'Civic'));
  return conflicts;
}

/** Every reason `planetId` is incompatible with the rest of the build ([] = compatible). */
export function getPlanetConflicts(planetId: string, input: PlanetRuleInput, label: PlanetLabelResolver): string[] {
  return [...getPredicatePlanetConflicts(planetId, input, label), ...getTraitPlanetConflicts(planetId, input, label)];
}

/**
 * Whether the empire creator offers `planet` as a pick to this species class
 * (species classes can add/remove planets: Infernals get Volcanic, lose the
 * cold worlds). An unknown species class gets the default set. Origin-forced
 * planets bypass this - Red Giant gives Volcanic to any species.
 */
export function isPlanetAvailableForSpecies(planet: PlanetClass, speciesClass: string | undefined): boolean {
  if (planet.only_species_classes && planet.only_species_classes.length > 0) {
    return !!speciesClass && planet.only_species_classes.includes(speciesClass);
  }
  return !(speciesClass && planet.excluded_species_classes?.includes(speciesClass));
}

/** Warning text when a picked (not forced) planet is not offered to the species class, else undefined. */
export function getSpeciesPlanetConflict(planet: PlanetClass, speciesClass: string | undefined, speciesLabel: (id: string) => string): string | undefined {
  if (isPlanetAvailableForSpecies(planet, speciesClass)) return undefined;
  if (planet.only_species_classes && planet.only_species_classes.length > 0) {
    return `${planet.name} can only be picked by ${planet.only_species_classes.map(speciesLabel).join(', ')} species (or forced by an origin)`;
  }
  return `${speciesLabel(speciesClass || '')} species cannot pick a ${planet.name} homeworld`;
}

/**
 * Columns of the in-game homeworld picker for this species class: Dry / Wet /
 * Cold, where a species-class column (Volcanic) takes the Cold slot - the game
 * draws both headers at the same position. `forcedPlanetId` (origin-forced,
 * e.g. Red Giant) is shown even when the species class would not offer it.
 */
export function getPlanetPickerColumns(planets: PlanetClass[], speciesClass: string | undefined, forcedPlanetId?: string): Array<{ id: string; name: string; planets: PlanetClass[] }> {
  const BASE_COLUMNS = ['dry', 'wet', 'cold'];
  const shown = planets.filter(p => p.selectable && p.picker_column &&
    (p.id === forcedPlanetId || isPlanetAvailableForSpecies(p, speciesClass)));
  const columnIds = [...new Set(shown.map(p => p.picker_column as string))];
  const extraColumns = columnIds.filter(id => !BASE_COLUMNS.includes(id));
  const ordered = [
    ...BASE_COLUMNS.filter(id => columnIds.includes(id) && !(id === 'cold' && extraColumns.length > 0)),
    ...extraColumns,
  ];
  return ordered.map(id => {
    const columnPlanets = shown.filter(p => p.picker_column === id);
    return { id, name: columnPlanets[0]?.picker_column_name || id, planets: columnPlanets };
  });
}

/** True when a trait's allowed_planet_classes excludes the given planet (unknown planet = never). */
export function isTraitBlockedByPlanet(trait: PlanetRuleTrait, planetId: string | undefined): boolean {
  if (!planetId) return false;
  const allowed = trait.allowed_planet_classes;
  return Array.isArray(allowed) && allowed.length > 0 && !allowed.includes(planetId);
}
