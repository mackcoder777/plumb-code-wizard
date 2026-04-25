

## Scoped Investigation: Section Mapping vs Building Mapping (Multitrade MP)

Read-only diagnostic. No code changes. Returns a five-line paragraph.

### Three verifications

**1. `building_section_mappings` project scoping**
- File: `src/hooks/useBuildingSectionMappings.ts`
- Confirm `.eq('project_id', projectId)` on **both** `.select()` and `.insert()` paths
- Confirm Hamilton MP project ID is distinct from Hamilton PL (`79aeb1d0-5c88-48a6-8485-74bc792abae5`) — visual check via project selector / URL
- **Failure mode being checked:** stale rows from prior project loaded under wrong project_id, not "global by mistake"

**2. `floorMap.buildingActivity` padding — paste the exact line**
- File: `src/hooks/useBuildingSectionMappings.ts` `resolveFloorMappingStatic`
- Hamilton PL evidence: stored `BA` → returned `00BA`. That proves padding happens in the resolver, but doesn't prove direction without reading.
- **Specific deliverable:** paste the exact padding line. Must be `padStart(4, '0')`. If `padEnd`, that's a bug masked by alpha inputs (`BA → BA00` would still display 4 chars and slip QA).
- Per CLAUDE.md: "ACT codes are always 4 characters, padded with leading zeros (padStart, not padEnd)."

**3. Confidence value behavior in `resolveFloorMappingStatic`**
- Files: `src/utils/datasetProfiler.ts` (already in context — confidence is a number on the profile object) + consumers in `src/pages/Index.tsx` / `useBuildingSectionMappings.ts`
- Question: when `datasetProfile.confidence = 0.3`, does the resolver:
  - **(a) Gate** — uses confidence to pick which column to read (drawing vs floor vs zone). Low confidence could route to the wrong field, partially explaining the 13/14 slip-through.
  - **(b) Display-only** — confidence is shown in the UI but resolution logic always uses `buildingSource` / `floorSource` regardless of value.
- Search: `grep -rn 'confidence' src/pages/Index.tsx src/hooks/useBuildingSectionMappings.ts src/components/FloorSectionMapping.tsx src/components/BuildingSectionMapping.tsx`

### Plain-language answers (Q1 + Q2) to compose at the end

- **Q1 — Why 13/14 missing from Section Mapping:** Section Mapping derives rows from `unique(item.floor)`. If estimator left Floor blank for buildings 13/14 (encoded only in Drawing column), they produce no Floor row → no Section Mapping entry. Building Section Mapping derives from drawing names, so it sees them.
- **Q2 — Architectural difference:** Section Mapping = per-floor granular (Floor → SEC + ACT). Building Section Mapping = drawing-derived coarse fallback (Building → SEC, feeds ACT building suffix via `buildingActivity`). Complementary, not redundant.
- **Q3 — Multitrade overwrite risk:** None. Already settled by `Index.tsx` lines ~715-720: `section = tradePrefix || 'PL'` is hardcoded in multitrade mode. Building Mapping `section_code` flows into ACT, never SEC. Hamilton PL `PL 00BA WATR` (not `PL PL BA WATR`) empirically confirms.

### Output format (single paragraph, five lines)

```
Project scoping: ✅/❌ — Hamilton MP project ID: <uuid> (distinct from PL: 79aeb1d0...)
Padding: <exact line from resolver>, padStart confirmed
Confidence: <gating | display-only> — code path: <file:line>
Q1: <plain language>
Q2: <plain language>
```

### Hard out-of-scope (explicit)

- ❌ No proposed change to confidence threshold
- ❌ No proposed change to `datasetProfiler.ts`
- ❌ No touch on override detection UI
- ❌ No "fix" to Section Mapping that scans drawings (architecture is correct as-is)
- ❌ No code edits this loop
- ❌ No re-derivation of Q3

If verification 1, 2, or 3 surfaces something unexpected (stale-rows leak, `padEnd`, gating with wrong-field routing), **stop and report** — do not propose a fix inline.

### Time

~5 minutes, 3 files + 1 grep + 1 visual check. Approve and I'll return the five-line paragraph.

