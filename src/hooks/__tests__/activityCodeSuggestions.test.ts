import { describe, it, expect } from 'vitest';
import {
  ACTIVITY_CODE_SUGGESTIONS,
  suggestActivityCode,
} from '@/hooks/useSystemActivityMappings';

// The ACT segment of SEC-ACT-COSTHEAD is a floor/level code. CLAUDE.md §7
// (Tier 1) enumerates them. This suite is the shape assertion that was held
// back from the first test batch because it FAILED on the code of that day:
// both the dropdown list and the suggester offered cost heads (DWTR, STRM,
// SNWV, ...) in the ACT slot, which composes codes like "B2 STRM WATR" where
// the format requires "B2 00L1 WATR". It lands together with the fix.

const TIER1_ACTIVITY_CODES = [
  '0000', '00L1', '00L2', '00L3', '00UG', '00RF', '00CS', '00LB', '00MZ', '00ST',
];

// The cost heads the old implementation wrongly offered. Kept as an explicit
// deny-list so a regression toward any of them fails with a readable message,
// not just a format mismatch.
const COST_HEADS_NEVER_ACTIVITY = [
  'DWTR', 'WATR', 'SNWV', 'STRM', 'GRWV', 'NGAS', 'COND', 'RCLM', 'FIRE', 'DEMO',
];

describe('ACTIVITY_CODE_SUGGESTIONS', () => {
  it('offers only §7 activity codes', () => {
    for (const { code } of ACTIVITY_CODE_SUGGESTIONS) {
      expect(TIER1_ACTIVITY_CODES).toContain(code);
    }
  });

  it('offers every §7 activity code, so the PM is never forced to type one', () => {
    const offered = ACTIVITY_CODE_SUGGESTIONS.map(s => s.code);
    for (const code of TIER1_ACTIVITY_CODES) {
      expect(offered).toContain(code);
    }
  });

  it('offers no cost heads', () => {
    for (const { code } of ACTIVITY_CODE_SUGGESTIONS) {
      expect(COST_HEADS_NEVER_ACTIVITY).not.toContain(code);
    }
  });

  it('every code is exactly 4 characters', () => {
    // The ACT slot is fixed-width; composeMultitradeActivity and the export
    // both assume it.
    for (const { code } of ACTIVITY_CODE_SUGGESTIONS) {
      expect(code).toHaveLength(4);
    }
  });
});

describe('suggestActivityCode', () => {
  it('suggests 00UG for below-grade systems', () => {
    expect(suggestActivityCode('BG Waste')).toBe('00UG');
    expect(suggestActivityCode('BG Storm Drn')).toBe('00UG');
    expect(suggestActivityCode('bg trp.primer')).toBe('00UG');
    expect(suggestActivityCode('Below Grade Sanitary')).toBe('00UG');
    expect(suggestActivityCode('Underground Gas')).toBe('00UG');
  });

  it('suggests nothing for systems whose name does not imply a level', () => {
    // A system name says WHAT the work is; the Floor column says WHERE.
    // Suggesting a level from "Cold Water" would be a guess, and §20 reserves
    // guesses for the PM.
    for (const name of ['Cold Water', 'Hot Water', 'Strm Drain', 'Vent', 'Waste',
                        'Fixture', 'Gas', 'Overflow Drn.', 'Condensate - Interior']) {
      expect(suggestActivityCode(name)).toBeNull();
    }
  });

  it('never returns a cost head, for any system in the Tier 1 catalog', () => {
    // Every system name from CLAUDE.md §2. The old implementation returned a
    // cost head for most of these.
    const TIER1_SYSTEMS = [
      'Cold Water', 'Hot Water', 'Vent', 'Waste', 'Condensate - Interior',
      'BG Waste', 'Gas', 'Fixture', 'Strm Drain', 'Overflow Drn.',
      'Ind.Cold Wtr.', 'Acid Waste', 'Acid Vent', 'Ind.Hot Wtr.',
      'BG Storm Drn', 'BG M.P.Gas', 'Demo', 'Trap Primer', 'Tempered Wtr.',
      'Condensate - Exterior', 'Med.Press.Gas', 'Waste ABS', 'BG Acid Waste',
      'Equipment', 'BG Trp.Primer', 'BG Vent', 'BG Cold Water',
      'Fuel Oil Vent', 'Indirect Drn.', 'BG Condensate', 'SP Pmp.Discharge',
    ];
    for (const name of TIER1_SYSTEMS) {
      const out = suggestActivityCode(name);
      if (out !== null) {
        expect(TIER1_ACTIVITY_CODES).toContain(out);
        expect(COST_HEADS_NEVER_ACTIVITY).not.toContain(out);
      }
    }
  });

  it('is deny-listed against the exact regression: storm never suggests STRM', () => {
    expect(suggestActivityCode('Strm Drain')).not.toBe('STRM');
    expect(suggestActivityCode('Overflow Drn.')).not.toBe('STRM');
    expect(suggestActivityCode('Cold Water')).not.toBe('DWTR');
  });
});
