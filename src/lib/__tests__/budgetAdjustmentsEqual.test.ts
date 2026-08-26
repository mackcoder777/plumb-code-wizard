import { describe, it, expect } from 'vitest';
import { budgetAdjustmentsEqual } from '@/lib/budgetAdjustmentsEqual';
import type { BudgetAdjustments } from '@/components/BudgetAdjustmentsPanel';

/**
 * The comparator gates setBudgetAdjustments, which sits directly upstream of
 * finalLaborSummary -- CLAUDE.md §16 rule 1's single source of truth for the
 * export. The two directions are NOT symmetric in cost:
 *
 *   false "changed" -> one wasted render. Harmless.
 *   false "equal"   -> the export silently keeps stale numbers. Wrong packet.
 *
 * So the "must report CHANGED" block below is the one that matters, and the
 * conservatism cases at the end pin the deliberate choice to treat anything
 * the comparator does not positively understand as changed.
 */

// The comparator is structural and takes BudgetAdjustments, but every case
// here exercises the shared deepEqual walk. Cast at the boundary so the tests
// can use small readable fixtures instead of 30-field objects.
const eq = (a: unknown, b: unknown) =>
  budgetAdjustmentsEqual(a as BudgetAdjustments | null, b as BudgetAdjustments | null);

describe('budgetAdjustmentsEqual — must report EQUAL (suppressing no-op updates)', () => {
  it('treats the same reference as equal', () => {
    const o = { a: 1 } as unknown as BudgetAdjustments;
    expect(budgetAdjustmentsEqual(o, o)).toBe(true);
  });

  it('treats a deep clone as equal', () => {
    expect(eq({ x: { y: [1, 2, { z: 'a' }] } }, { x: { y: [1, 2, { z: 'a' }] } })).toBe(true);
  });

  it('ignores key order', () => {
    // The JSON.stringify failure mode this comparator exists to avoid: two
    // equivalent objects built in a different order are still equal.
    expect(eq({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('treats NaN as equal to NaN', () => {
    // A NaN hours field is a bug elsewhere. It should not additionally cost a
    // render on every emit.
    expect(eq({ hours: NaN }, { hours: NaN })).toBe(true);
  });

  it('treats two empty records as equal', () => {
    expect(eq({ r: {} }, { r: {} })).toBe(true);
  });

  it('treats two nulls as equal', () => {
    expect(budgetAdjustmentsEqual(null, null)).toBe(true);
  });

  it('treats an identical realistic labor summary as equal', () => {
    const entry = {
      code: 'B2 00L1 WATR', description: 'Domestic Water',
      hours: 142, rate: 88.5, dollars: 12567, type: 'field',
    };
    expect(eq(
      { adjustedLaborSummary: { 'B2 00L1 WATR': { ...entry } }, totalFieldHours: 142 },
      { adjustedLaborSummary: { 'B2 00L1 WATR': { ...entry } }, totalFieldHours: 142 },
    )).toBe(true);
  });
});

describe('budgetAdjustmentsEqual — must report CHANGED (a dropped update corrupts the export)', () => {
  it('detects a single hour differing deep in the summary', () => {
    expect(eq(
      { s: { 'B2 00L1 WATR': { hours: 142 } } },
      { s: { 'B2 00L1 WATR': { hours: 143 } } },
    )).toBe(false);
  });

  it('detects an added key', () => {
    expect(eq({ a: 1 }, { a: 1, b: 2 })).toBe(false);
  });

  it('detects a removed key', () => {
    expect(eq({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it('detects a renamed key even when the key count matches', () => {
    // Key-count equality alone would pass this; the hasOwnProperty check is
    // what catches it.
    expect(eq({ a: 1 }, { b: 1 })).toBe(false);
  });

  it('detects null against an object in either direction', () => {
    expect(budgetAdjustmentsEqual(null, { a: 1 } as unknown as BudgetAdjustments)).toBe(false);
    expect(budgetAdjustmentsEqual({ a: 1 } as unknown as BudgetAdjustments, null)).toBe(false);
  });

  it('detects array length and array order', () => {
    expect(eq({ a: [1, 2] }, { a: [1, 2, 3] })).toBe(false);
    expect(eq({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
  });

  it('detects an array swapped for an object', () => {
    expect(eq({ a: [] }, { a: {} })).toBe(false);
  });

  it('does not coerce across types', () => {
    expect(eq({ a: 1 }, { a: '1' })).toBe(false);
    expect(eq({ a: false }, { a: 0 })).toBe(false);
    expect(eq({ a: null }, { a: undefined })).toBe(false);
  });

  it('detects an explicit undefined against a missing key', () => {
    expect(eq({ a: undefined, b: 1 }, { b: 1 })).toBe(false);
  });

  it('detects a renamed key when both sides read undefined and the counts match', () => {
    // Found by mutation-testing this suite: deleting the hasOwnProperty check
    // left every other case still passing, because a renamed key normally
    // trips the type comparison (1 vs undefined). It only escapes when the
    // differing key's value IS undefined -- then both sides read undefined,
    // Object.is says equal, and the counts match. hasOwnProperty is the only
    // thing standing between that and a silently dropped update.
    expect(eq({ a: undefined, x: 1 }, { c: undefined, x: 1 })).toBe(false);
  });

  it('detects a difference nested several levels deep', () => {
    expect(eq({ x: { y: { z: { w: 1 } } } }, { x: { y: { z: { w: 2 } } } })).toBe(false);
  });

  it('detects an empty record becoming populated', () => {
    // The realistic shape of this: adjustedLaborSummary going from {} to a
    // full summary once the pipeline has run.
    expect(eq({ r: {} }, { r: { a: 1 } })).toBe(false);
  });
});

describe('budgetAdjustmentsEqual — conservatism: never guess "equal" on an unrecognised type', () => {
  // These all COULD be compared equal by a more elaborate comparator. They are
  // deliberately reported as changed instead: a field of such a type added to
  // BudgetAdjustments later can then only cost an extra render, never drop an
  // update to the export. If someone "improves" the comparator to inspect
  // these, these tests should fail and be argued with, not deleted.

  it('reports two equal Dates as changed', () => {
    expect(eq({ d: new Date(0) }, { d: new Date(0) })).toBe(false);
  });

  it('reports two empty Maps as changed', () => {
    expect(eq({ m: new Map() }, { m: new Map() })).toBe(false);
  });

  it('reports two empty Sets as changed', () => {
    expect(eq({ s: new Set() }, { s: new Set() })).toBe(false);
  });

  it('reports two structurally identical class instances as changed', () => {
    class C { a = 1; }
    expect(eq({ c: new C() }, { c: new C() })).toBe(false);
  });

  it('reports two functions as changed', () => {
    expect(eq({ f: () => 1 }, { f: () => 1 })).toBe(false);
  });
});
