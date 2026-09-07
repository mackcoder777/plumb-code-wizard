import { describe, it, expect } from 'vitest';
import {
  isDeletedProjectWriteError,
  projectScopedStorageKeys,
} from '../projectTeardown';

describe('isDeletedProjectWriteError', () => {
  it('recognizes a Postgres foreign-key violation (23503)', () => {
    expect(isDeletedProjectWriteError({ code: '23503' })).toBe(true);
  });

  it('rejects every other error code', () => {
    // Codes a settings upsert could plausibly return: NOT NULL violation,
    // unique violation, RLS denial, undefined table.
    for (const code of ['23502', '23505', '42501', '42P01', '']) {
      expect(isDeletedProjectWriteError({ code })).toBe(false);
    }
  });

  it('rejects absent errors and errors without a code', () => {
    expect(isDeletedProjectWriteError(null)).toBe(false);
    expect(isDeletedProjectWriteError(undefined)).toBe(false);
    expect(isDeletedProjectWriteError({})).toBe(false);
  });
});

describe('projectScopedStorageKeys', () => {
  const projectId = 'bf611bbb-0000-4000-8000-000000000001';
  const otherId = 'feb06ed9-0000-4000-8000-000000000002';

  it('selects only budget_* keys ending with the project id', () => {
    const keys = [
      `budget_zip_${projectId}`,
      `budget_consolidation_thresholds_${projectId}`,
      `budget_zip_${otherId}`, // another project's mirror — must survive
      'lastSelectedProjectId', // restore pointer — handled separately by value
      `unrelated_${projectId}`, // not a budget mirror key
      'smallCodeMinHours', // legacy project-agnostic key
    ];
    expect(projectScopedStorageKeys(keys, projectId)).toEqual([
      `budget_zip_${projectId}`,
      `budget_consolidation_thresholds_${projectId}`,
    ]);
  });

  it('requires the id as a full suffix segment, not a substring', () => {
    // `budget_zip_${projectId}extra` must not match ${projectId}
    expect(
      projectScopedStorageKeys([`budget_zip_${projectId}extra`], projectId)
    ).toEqual([]);
  });

  it('returns nothing for an empty project id (never sweep everything)', () => {
    expect(
      projectScopedStorageKeys([`budget_zip_${projectId}`], '')
    ).toEqual([]);
  });

  it('returns nothing when no keys match', () => {
    expect(projectScopedStorageKeys([], projectId)).toEqual([]);
    expect(
      projectScopedStorageKeys(['theme', 'sb-auth-token'], projectId)
    ).toEqual([]);
  });
});
