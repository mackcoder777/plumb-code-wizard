import { describe, it, expect } from 'vitest';
import { composeMultitradeActivity, normalizeActivityCode } from '@/lib/utils';

// Regression cover for the ACT-format fix recorded in CLAUDE.md §17: the
// multitrade activity segment was flipped from level-first ("01BA") to
// building-first ("BA01") because level-first fragmented buildings on Excel
// sort. These tests pin the format and the guard that caught the "01B12" bug.

describe('composeMultitradeActivity', () => {
  it('composes building-first, not level-first', () => {
    expect(composeMultitradeActivity('BA', '01')).toBe('BA01');
    expect(composeMultitradeActivity('BA', '02')).toBe('BA02');
    expect(composeMultitradeActivity('MD', '02')).toBe('MD02');
    expect(composeMultitradeActivity('B2', '03')).toBe('B203');
  });

  it('never emits the legacy level-first ordering', () => {
    // The specific regression: "01BA" sorts by level, scattering one
    // building's lines across the sheet.
    expect(composeMultitradeActivity('BA', '01')).not.toBe('01BA');
  });

  it('handles the roof level prefix', () => {
    expect(composeMultitradeActivity('BA', '0R')).toBe('BA0R');
  });

  it('left-pads a single-char building id so the ACT stays 4 chars', () => {
    // Callers derive bldgSuffix by stripping ALL leading zeros, and the gate
    // admits length 1, so "000A" reaches here as "A". Without the pad this
    // returned "A01" -- 3 chars, breaking the enforced 4-char ACT width.
    expect(composeMultitradeActivity('A', '01')).toBe('0A01');
    expect(composeMultitradeActivity('9', '02')).toBe('0902');
  });

  it('always produces exactly 4 characters for valid input', () => {
    const cases: Array<[string, string | null | undefined]> = [
      ['BA', '01'], ['B2', '0R'], ['MD', '00'], ['BA', null],
      ['BA', undefined], ['A', '01'], ['A', null],
    ];
    for (const [bldg, level] of cases) {
      expect(composeMultitradeActivity(bldg, level)).toHaveLength(4);
    }
  });

  it('falls back to a flat, left-padded building ACT when no level is extractable', () => {
    expect(composeMultitradeActivity('BA', undefined)).toBe('00BA');
    expect(composeMultitradeActivity('BA', null)).toBe('00BA');
    expect(composeMultitradeActivity('BA', '')).toBe('00BA');
    // '00' means "no level", not "level zero" -- same fallback.
    expect(composeMultitradeActivity('BA', '00')).toBe('00BA');
  });

  it('short-circuits an empty building suffix to 0000', () => {
    expect(composeMultitradeActivity('', '01')).toBe('0000');
    expect(composeMultitradeActivity('', null)).toBe('0000');
  });

  it('throws on a building suffix longer than 2 chars', () => {
    // This is the regression alarm. FloorSectionMapping previously composed
    // level-split ACTs with no length gate, producing 5-char strings like
    // "01B12" for 3-char building ids. The throw makes an ungated caller
    // fail loudly instead of shipping a malformed cost code.
    expect(() => composeMultitradeActivity('B12', '01')).toThrow(/≤2 chars/);
    expect(() => composeMultitradeActivity('ABCD', '01')).toThrow();
  });

  it('names the offending input in the throw, so the broken caller is findable', () => {
    expect(() => composeMultitradeActivity('B12', '01')).toThrow(/"B12"/);
  });
});

describe('normalizeActivityCode', () => {
  it('pads to 4 characters', () => {
    expect(normalizeActivityCode('1')).toBe('0001');
    expect(normalizeActivityCode('L1')).toBe('00L1');
    expect(normalizeActivityCode('00L1')).toBe('00L1');
  });

  it('maps empty input to the default activity code', () => {
    expect(normalizeActivityCode('')).toBe('0000');
  });
});
