import { describe, it, expect } from 'vitest';
import { describeRowCountMismatch } from '@/lib/uploadIntegrity';

describe('describeRowCountMismatch', () => {
  it('returns null when the counts agree', () => {
    expect(describeRowCountMismatch(12846, 12846)).toBeNull();
    expect(describeRowCountMismatch(0, 0)).toBeNull();
    expect(describeRowCountMismatch(1, 1)).toBeNull();
  });

  it('detects a short upload and says how many rows were lost', () => {
    const msg = describeRowCountMismatch(12000, 12846);
    expect(msg).toContain('846');
    expect(msg).toContain('lost in transfer');
    expect(msg).toContain('Nothing was saved');
  });

  it('detects a duplicated chunk', () => {
    const msg = describeRowCountMismatch(13000, 12846);
    expect(msg).toContain('154');
    expect(msg).toContain('duplicated in transfer');
  });

  it('catches an off-by-one, not just a lost chunk', () => {
    // The realistic bug is a whole chunk; the dangerous one is a single row,
    // because it is the one a human reviewing totals would never notice.
    expect(describeRowCountMismatch(12845, 12846)).not.toBeNull();
    expect(describeRowCountMismatch(12847, 12846)).not.toBeNull();
  });

  it('reports zero assembled rows against a non-zero total', () => {
    // Every chunk lost. Without the check this is an empty project that looks
    // like a successful upload of an empty file.
    expect(describeRowCountMismatch(0, 12846)).toContain('lost in transfer');
  });

  it('rejects an invalid reported count instead of comparing against it', () => {
    expect(describeRowCountMismatch(10, NaN)).toContain('invalid row count');
    expect(describeRowCountMismatch(10, -1)).toContain('invalid row count');
    expect(describeRowCountMismatch(10, Infinity)).toContain('invalid row count');
  });

  it('does not treat a NaN assembled count as a match for NaN reported', () => {
    // NaN === NaN is false, so this falls through to the mismatch branch
    // rather than silently passing.
    expect(describeRowCountMismatch(NaN, 10)).not.toBeNull();
  });
});
