import type { BudgetAdjustments } from '@/components/BudgetAdjustmentsPanel';

/**
 * Structural equality for the BudgetAdjustments object emitted by
 * BudgetAdjustmentsPanel.
 *
 * This sits directly upstream of finalLaborSummary, which CLAUDE.md §16 rule 1
 * names the single source of truth for the export. A false "equal" here means
 * the export silently keeps stale numbers, which is far worse than an extra
 * render. So the comparator is deliberately conservative: anything it does not
 * positively recognise as equal is reported as CHANGED.
 *
 * Concretely, it understands primitives, plain objects, and arrays -- which is
 * everything BudgetAdjustments declares. Any value with a non-plain prototype
 * (Date, Map, Set, class instance, function) compares as changed rather than
 * being inspected, so introducing such a field can only cause an extra update,
 * never a dropped one.
 *
 * It is also key-count-checked rather than key-order-dependent, so it does not
 * share JSON.stringify's failure mode of reporting a difference when two
 * equivalent objects were merely built in a different order.
 */
export function budgetAdjustmentsEqual(
  a: BudgetAdjustments | null,
  b: BudgetAdjustments | null,
): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return deepEqual(a, b);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function deepEqual(a: unknown, b: unknown): boolean {
  // Object.is rather than ===, so NaN equals NaN. An hours field that has gone
  // NaN is a bug elsewhere; it should not additionally cause a render every
  // time the panel re-emits.
  if (Object.is(a, b)) return true;

  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;

  const aIsArray = Array.isArray(a);
  if (aIsArray !== Array.isArray(b)) return false;

  if (aIsArray) {
    const x = a as unknown[];
    const y = b as unknown[];
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) {
      if (!deepEqual(x[i], y[i])) return false;
    }
    return true;
  }

  // Anything that is not a plain object is reported as changed rather than
  // guessed at. See the note on conservatism above.
  if (!isPlainObject(a) || !isPlainObject(b)) return false;

  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
    if (!deepEqual(a[k], b[k])) return false;
  }
  return true;
}
