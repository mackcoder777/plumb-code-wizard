---
name: Auto-apply runKey dual mechanism
description: Auto-apply persist dedup uses TWO mechanisms in tandem — runKey fingerprint AND ref-change reset effect. Removing either reintroduces mid-session persistence bug.
type: architecture
---

The auto-apply effect in `src/pages/Index.tsx` (the one that re-resolves cost
codes from upstream mappings and persists the diff to `estimate_items`) uses
TWO complementary dedup mechanisms. Both are required. Removing either
reintroduces the Pasadena mid-session persistence bug (saved floor mapping
changes don't propagate to items until project reload).

## Mechanism 1 — runKey fingerprint (inside the persist block)

```ts
const mappingFingerprint = `${dbFloorMappings.length}:${dbBuildingMappings.length}:${savedMappings.length}:${dbCategoryMappings.length}`;
const runKey = `${currentProject.id}|${mappingFingerprint}|${JSON.stringify(itemsNeedingPersist.map(u => `${u.row_number}:${u.cost_code}`))}`;
```

Includes `currentProject.id`, a length-based fingerprint of upstream mapping
arrays, and a hash of the computed item diff. Stored in `autoApplyRunKeyRef`.
If the next effect run computes the same key, the persist is skipped. Defends
against StrictMode double-renders and idempotent re-runs after a load.

## Mechanism 2 — runKey reset effect (separate useEffect)

```ts
useEffect(() => {
  autoApplyRunKeyRef.current = '';
}, [dbFloorMappings, dbBuildingMappings, savedMappings, dbCategoryMappings]);
```

Clears the runKey whenever any upstream mapping reference changes. Belt and
suspenders for cases where the fingerprint hash collides (two different
mapping configurations producing identical `.length` counts).

## Why both are required

- **Fingerprint alone fails** when a mapping is swapped (e.g., `Lower LVL` from
  `LL` to `02`) without changing array length. Same `.length`, same
  fingerprint, runKey appears unchanged, persist skipped — even though the
  resolution result differs.
- **Reset effect alone fails** because every effect run would clear the key,
  defeating the StrictMode dedup. The first persist would write, the second
  would write the same diff again on the duplicate render.

## Failure mode if removed

If a future change "simplifies" by removing one mechanism:
1. PM saves a floor mapping change while project is open.
2. `dbFloorMappings` query invalidates and refetches.
3. Auto-apply effect re-fires.
4. Either dedup blocks the persist OR the persist runs but is silently a no-op.
5. Items in DB do NOT reflect the new mapping.
6. PM only sees the change after a full project reload (which forces
   `savedItems` to refetch from DB and produces a different diff hash).

Diagnosed via DB timeline analysis: floor mapping `UG-3 → BG` saved at
14:53:18, items not updated until 15:44:17 (51-minute gap, only resolved by
reload). Verified fix via Lower LVL test: mapping save at 18:03:23, 700
items rewrote at 18:03:24 — one second, no reload.

## Related files

- `src/pages/Index.tsx` — auto-apply effect (~lines 1065-1310) and runKey
  reset effect.
- `src/hooks/useFloorSectionMappings.ts` — `useBatchSaveFloorSectionMappings`
  invalidates the query that drives the upstream ref change.

See also: `mem://architecture/cost-code-re-resolution-policy`,
`mem://architecture/section-mapping-canonical-source-truth`.