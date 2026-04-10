

# Fix: Deduplicate Records Before Upsert in Job-Wide Consolidation

## Problem
The `candidate.sections` array contains one entry per `(sec, act)` combination. Multiple activity codes in the same section (e.g., `B2 00L1 BGNG` and `B2 00L2 BGNG`) produce records with identical `(project_id, sec_code='B2', cost_head='BGNG', merged_act='__JOBWIDE__')`. Postgres rejects an upsert batch where two rows target the same conflict key.

## Fix

**File: `src/components/JobWideConsolidation.tsx` (~line 108)**

Deduplicate `records` by `sec_code` before upserting:

```typescript
// Before:
const records = candidate.sections.map(s => ({
  project_id: projectId,
  sec_code: s.sec,
  cost_head: candidate.head,
  reassign_to_head: candidate.head,
  merged_act: JOB_WIDE_MARKER,
}));

// After:
const uniqueSecs = [...new Set(candidate.sections.map(s => s.sec))];
const records = uniqueSecs.map(sec => ({
  project_id: projectId,
  sec_code: sec,
  cost_head: candidate.head,
  reassign_to_head: candidate.head,
  merged_act: JOB_WIDE_MARKER,
}));
```

One change, one file. The dedup ensures each `(project_id, sec_code, cost_head, merged_act)` tuple appears exactly once in the upsert batch.

## Files changed
| File | Change |
|------|--------|
| `src/components/JobWideConsolidation.tsx` | Deduplicate sections by `sec_code` before building upsert records |

