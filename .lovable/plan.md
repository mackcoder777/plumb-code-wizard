## Root cause confirmed

The DB query proves the bug AND its eventual workaround:

- Floor mapping `UG-3 → BG` saved at **14:53:18**
- Items NOT updated for ~51 minutes despite the auto-apply effect's dep array including `dbFloorMappings`
- At **15:44:17**, a project reload triggered a fresh `savedItems` fetch, the effect re-fired with a new `runKey`, and 1,556 items got persisted in one shot

So the resolver works, the matcher works, the persist path works — but only on **project load**, not on **mapping save**. The screenshot you took was during the 51-minute window where DB and mappings were out of sync.

## Why the mid-session re-fire fails

The auto-apply effect (`Index.tsx:1065-1310`) depends on both `savedItems` and `dbFloorMappings`. When you save a mapping, `dbFloorMappings` invalidates and refetches; `savedItems` does NOT. The effect re-fires, but one of two things blocks the persist:

**Path A — runKey dedup blocks it.** If the effect ran earlier with the OLD `dbFloorMappings`, it computed a smaller `itemsNeedingPersist` (or empty). The runKey was set. Now with the new mapping, it computes the correct diff — but if for any reason the diff hashes the same, line 1281 `[AutoApply] Skipping — same run key` swallows it.

**Path B — early-return gates eat the re-fire.** Lines 1069–1087 have three deferral guards:
- `floorMappingsLoaded` (line 1069)
- `systemMappingsLoaded` (line 1077)
- `materialDescOverridesFetched` (line 1084)

Each guard does an unconditional `return` without setting any tracking state. If any guard fires, the effect exits silently and only re-runs when one of its deps changes again. There's no retry loop tied to the guard that failed.

The combination means: save a mapping → `dbFloorMappings` updates → effect re-fires → if a guard trips OR if runKey matches, **silent no-op**. The next persist only happens when the user reloads the project (fresh `savedItems`).

## Patch (3 changes, 1 file: `src/pages/Index.tsx`)

### Change 1 — Make runKey reflect mapping state, not just item diff (line 1279)

Current:
```ts
const runKey = `${currentProject.id}|${JSON.stringify(itemsNeedingPersist.map(...))}`;
```

Change to include a hash of the mapping inputs that drove resolution:
```ts
const mappingFingerprint = `${dbFloorMappings.length}:${dbBuildingMappings.length}:${savedMappings.length}:${dbCategoryMappings.length}`;
const runKey = `${currentProject.id}|${mappingFingerprint}|${JSON.stringify(itemsNeedingPersist.map(u => `${u.row_number}:${u.cost_code}`))}`;
```

This forces a fresh runKey whenever upstream mappings change, even if the computed diff happens to look the same. Cheap, defensive, fixes Path A.

### Change 2 — Add diagnostic logging to the deferral guards (lines 1069–1087)

Each `return` should log which guard fired and what state it was in. We already log "Deferring auto-apply: floor mappings not yet loaded" but don't log when the guard releases. Add a one-line summary at effect entry:

```ts
console.log('[AutoApply] Effect fired', {
  savedItems: savedItems.length,
  floorMappingsFetched, mappingsFetched, materialDescOverridesFetched,
  dbFloorMappings: dbFloorMappings.length, savedMappings: savedMappings.length,
});
```

This makes the next debugging loop trivial — we'll see exactly which gate the mid-session save is hitting.

### Change 3 — Reset runKey when mapping inputs change (new effect)

Add a small effect that resets `autoApplyRunKeyRef.current` when any mapping input reference changes. This belt-and-suspenders the runKey behavior so even if Change 1 misses an edge case, the dedup can't silently block a legitimate re-resolution:

```ts
useEffect(() => {
  autoApplyRunKeyRef.current = '';
}, [dbFloorMappings, dbBuildingMappings, savedMappings, dbCategoryMappings]);
```

This is cheap — it just clears a string. The next auto-apply effect run will recompute and write a fresh key.

## What this does NOT change

- Resolver logic (`resolveSectionStatic`, `resolveFloorMappingStatic`) — confirmed working by the DB data.
- Matcher logic in `useFloorSectionMappings.ts` — confirmed working by the floor panel item counts in your screenshot.
- The `01` fallback at line 274 of `useFloorSectionMappings.ts` — that's the correct default when no mapping exists; it's not the bug.
- The deferral guards themselves — they're necessary to prevent a half-loaded resolution from clobbering correct codes with `01`. Don't touch them.

## Test plan

1. **Mid-session save, single mapping.** Open Pasadena. Change one floor mapping (e.g., `UG-21` from `BG` to `LL`). Watch console:
   - Should see `[AutoApply] Effect fired ...` with all gates true
   - Should see `[AutoApply] Persisting N labor codes to database...`
   - Should see `[AutoApply] Successfully saved N labor codes to database`
   - Re-query DB: items with `floor = 'UG-21'` should have `cost_code` starting with `LL ...`

2. **Mid-session save, revert.** Change `UG-21` back to `BG`. Same console sequence, items revert in DB.

3. **Project load idempotency.** Reload Pasadena. Should see `[Load] ... 0 newly applied from mappings` since DB is already in sync.

4. **Cold-start with deferred guards.** Switch to a different project, then back to Pasadena. Confirm the deferral guards log when they trip and that the effect eventually completes successfully once all queries resolve.

## Out of scope (filed for follow-up)

- The deferral guards have no retry mechanism beyond dep-array re-fires. If a guard trips and the user never triggers another mapping change or reload, the effect never completes. This is a latent reliability issue but not what we're fixing here.
- `[BatchUpdate]` does not surface failures to the user (CLAUDE.md §16 violation). Already tracked as Open Item 7.
- The three extractor consolidation (Open Item 5) and export format logging (Open Item 6) remain follow-ups.

## Time estimate

~15 min: 3 small edits in one file, no new dependencies, no schema changes.
