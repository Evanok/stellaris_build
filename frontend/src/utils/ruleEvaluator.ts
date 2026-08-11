// Evaluates the structured predicate trees produced by
// data-extractor/extract_civics_and_origins.py (civic/origin `potential` and
// `possible` fields). See that file's extract_trigger_info() docstring for the
// node shapes ("all" / "any" / "not" / "always" / "field").

export interface PredicateNode {
  all?: PredicateNode[];
  any?: PredicateNode[];
  not?: PredicateNode;
  always?: boolean;
  field?: string;
  value?: unknown;
  unsupported?: unknown;
  unsupported_limit?: unknown;
  tooltip?: string;
}

export interface BuildContext {
  ethics?: string[];
  authority?: string;
  civics?: string[];
  origin?: string;
  species_archetype?: string;
  species_class?: string;
  traits?: string[];
  is_nomadic?: boolean;
  preferred_planet_class?: string;
  graphical_culture?: string;
}

function evaluateField(field: string, value: unknown, ctx: BuildContext): boolean {
  switch (field) {
    case 'ethics':
      return (ctx.ethics || []).includes(value as string);
    case 'authority':
      return ctx.authority === value;
    case 'civics':
      return (ctx.civics || []).includes(value as string);
    case 'origin':
      return ctx.origin === value;
    case 'species_archetype':
      return ctx.species_archetype === value;
    case 'species_class':
      return ctx.species_class === value;
    case 'traits':
      return (ctx.traits || []).includes(value as string);
    case 'is_nomadic':
      return !!ctx.is_nomadic === !!value;
    case 'preferred_planet_class':
      return ctx.preferred_planet_class === value;
    case 'graphical_culture':
      return ctx.graphical_culture === value;
    case 'country_type':
      // Player-created builds are always country_type "default".
      return value === 'default';
    case 'host_has_dlc':
      // We have no way to know which DLC a hypothetical build's author owns -
      // assume available rather than block on something we can't check.
      return true;
    default:
      // Unknown predicate field (schema drift) - don't block on it, but this
      // should not happen if extract_trigger_info's LEAF_PREDICATE_FIELDS is
      // kept in sync with the game files.
      return true;
  }
}

/**
 * Evaluate a `potential`/`possible` predicate tree against a build's picks.
 * `unsupported`/`unsupported_limit` nodes (shapes the extractor could not
 * normalize, e.g. scope-changing `limit` blocks) are treated as satisfied -
 * we would rather under-enforce a rule than wrongly block a valid build on
 * something we cannot evaluate.
 */
export function evaluatePredicate(node: PredicateNode | null | undefined, ctx: BuildContext): boolean {
  if (!node) return true;
  if (node.all) return node.all.every(child => evaluatePredicate(child, ctx));
  if (node.any) return node.any.some(child => evaluatePredicate(child, ctx));
  if (node.not) return !evaluatePredicate(node.not, ctx);
  if ('always' in node) return !!node.always;
  if ('unsupported' in node || 'unsupported_limit' in node) return true;
  if (node.field) return evaluateField(node.field, node.value, ctx);
  return true;
}

function describeValue(value: unknown): string {
  return JSON.stringify(value);
}

/** Human-readable rendering of a predicate node, for warning messages. */
export function describePredicate(node: PredicateNode): string {
  if (node.all) return '(' + node.all.map(describePredicate).join(' AND ') + ')';
  if (node.any) return '(' + node.any.map(describePredicate).join(' OR ') + ')';
  if (node.not) return 'NOT ' + describePredicate(node.not);
  if ('always' in node) return `always=${node.always}`;
  if (node.field) return `${node.field}=${describeValue(node.value)}`;
  if ('unsupported' in node) return '<unsupported>';
  if ('unsupported_limit' in node) return '<unsupported_limit>';
  return '<?>';
}

/**
 * Drill into failing AND-branches to find the most specific failing
 * sub-node(s) instead of the whole (often large) possible/potential block.
 * Mirrors backend/rules/predicateEvaluator.js - keep both in sync.
 */
export function getFailingNodes(node: PredicateNode | null | undefined, ctx: BuildContext): PredicateNode[] {
  if (!node) return [];
  if (node.all) {
    return node.all
      .filter(child => !evaluatePredicate(child, ctx))
      .flatMap(child => (child.all ? getFailingNodes(child, ctx) : [child]));
  }
  return evaluatePredicate(node, ctx) ? [] : [node];
}

/** Same as getFailingNodes, but pre-rendered as the raw machine-readable DSL. */
export function getFailingConditions(node: PredicateNode | null | undefined, ctx: BuildContext): string[] {
  return getFailingNodes(node, ctx).map(describePredicate);
}

const FIELD_LABELS: Record<string, string> = {
  ethics: 'ethic',
  civics: 'civic',
  authority: 'authority',
  origin: 'origin',
  species_archetype: 'species type',
  species_class: 'species class',
  traits: 'trait',
  graphical_culture: 'graphical culture',
  preferred_planet_class: 'preferred planet class',
};

/** Resolves a leaf field's raw id (e.g. "ethic_authoritarian") to a display name (e.g. "Authoritarian"). */
export type LabelResolver = (field: string, value: unknown) => string;

/**
 * Human-readable rendering of a predicate node for end users, resolving raw
 * ids to display names via `resolveLabel` (built from the game data already
 * loaded in the form - ethics/civics/authorities/origins name lookups).
 */
export function describePredicateHuman(node: PredicateNode, resolveLabel: LabelResolver): string {
  if (node.all) {
    return node.all.map(c => describePredicateHuman(c, resolveLabel)).join(' and ');
  }
  if (node.any) {
    return 'at least one of: ' + node.any.map(c => describePredicateHuman(c, resolveLabel)).join(', ');
  }
  if (node.not) {
    const inner = node.not;
    if (inner.any) {
      return 'none of: ' + inner.any.map(c => describePredicateHuman(c, resolveLabel)).join(', ');
    }
    return 'not: ' + describePredicateHuman(inner, resolveLabel);
  }
  if ('always' in node) return node.always ? 'always true' : 'never available';
  if (node.field === 'is_nomadic') return node.value ? 'must be Nomadic' : 'must not be Nomadic';
  if (node.field) {
    const label = FIELD_LABELS[node.field] || node.field;
    return `${label} "${resolveLabel(node.field, node.value)}"`;
  }
  if ('unsupported' in node || 'unsupported_limit' in node) return '(a condition we could not check)';
  return '(unknown condition)';
}

/**
 * Find every leaf occurrence of a given field in a predicate tree, along with
 * whether it sits under an odd number of `not` wrappers. Unlike
 * evaluatePredicate, this does not require a full build context - useful for
 * UI-time questions like "does this predicate ever reference field X, and in
 * which polarity" when the rest of the build's picks aren't made yet (e.g.
 * origin is selected before ethics/authority in the form, so a full
 * evaluatePredicate against a partial context would wrongly read unset
 * fields as "not selected" and hide origins that need an as-yet-unmade pick).
 */
export function findFieldOccurrences(
  node: PredicateNode | null | undefined,
  field: string,
  negated = false
): Array<{ value: unknown; negated: boolean }> {
  if (!node) return [];
  if (node.all) return node.all.flatMap(child => findFieldOccurrences(child, field, negated));
  if (node.any) return node.any.flatMap(child => findFieldOccurrences(child, field, negated));
  if (node.not) return findFieldOccurrences(node.not, field, !negated);
  if (node.field === field) return [{ value: node.value, negated }];
  return [];
}
