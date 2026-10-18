// Shipset (ship appearance, `graphical_culture`) rules. The shipset is
// optional in a build; when set, the only rules are the `graphical_culture`
// predicates in origin/civic/authority `possible`/`potential` (e.g. Wilderness
// requires a Biological set, Red Giant forbids them). The full evaluation at
// submit/export goes through ruleEvaluator (ctx.graphical_culture) - this file
// only drives the live picker. Data: data-extractor/extract_shipsets.py.

import { PredicateNode, findFieldOccurrences } from './ruleEvaluator';

export interface Shipset {
  id: string;
  name: string;
  category: 'biological' | 'mechanical';
  has_city_graphics: boolean;
  image: string;
}

export interface ShipsetRuleSource {
  label: string; // e.g. 'Origin "Wilderness"'
  possible?: PredicateNode;
  potential?: PredicateNode;
}

/**
 * Why `shipsetId` is incompatible with the given origin/civics/authority
 * ([] = compatible). Polarity-only check (findFieldOccurrences), so it works
 * on a half-filled form.
 */
export function getShipsetConflicts(shipsetId: string, sources: ShipsetRuleSource[], label: (id: string) => string): string[] {
  const conflicts: string[] = [];
  for (const source of sources) {
    const occurrences = [
      ...findFieldOccurrences(source.possible, 'graphical_culture'),
      ...findFieldOccurrences(source.potential, 'graphical_culture'),
    ];
    const forbidden = occurrences.filter(o => o.negated).map(o => String(o.value));
    const required = occurrences.filter(o => !o.negated).map(o => String(o.value));
    if (forbidden.includes(shipsetId)) {
      conflicts.push(`${source.label} cannot use the ${label(shipsetId)} ship appearance`);
    } else if (required.length > 0 && !required.includes(shipsetId)) {
      conflicts.push(`${source.label} requires one of these ship appearances: ${required.map(label).join(', ')}`);
    }
  }
  return conflicts;
}

/** City appearance written to the empire design export: the shipset's own, or Humanoid for sets without cities (Imperial, Mindwarden). */
export function getCityGraphicalCulture(shipset: Shipset | undefined): string {
  return shipset && shipset.has_city_graphics ? shipset.id : 'humanoid_01';
}
