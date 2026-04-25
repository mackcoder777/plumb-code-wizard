

## Read-Only Investigation: ACT Code Format (Building-First vs Level-First)

Trace every site where the ACT segment is assembled in multitrade level-split mode, plus check for any persisted data in the old format. **No code changes this loop** — output is a precise patch surface map and a data-migration risk assessment.

### What I'll trace

**Code sites — find every place ACT is assembled with `levelPrefix + bldgSuffix`:**

1. `src/pages/Index.tsx` — `memoizedLaborSummary` (~line 728). Confirmed format: `levelPrefix + bldgSuffix` → `01BA`.
2. `src/pages/Index.tsx` — `generateCostCode` multitrade branch (~lines 1070-1085).
3. `src/pages/Index.tsx` — `executeApplyDualCodes` activity assembly (~line 1620+).
4. `src/pages/Index.tsx` — material desc override recalc effect.
5. `src/pages/Index.tsx` — item name override recalc effect.
6. `src/hooks/useBuildingSectionMappings.ts` — `resolveFloorMappingStatic` `buildingActivity` return value. Does it return the raw building suffix (e.g., `BA`) or a pre-assembled value?
7. `src/hooks/useCostHeadActivityOverrides.ts` + `useCategoryItemTypeOverrides.ts` + `useCategoryItemNameOverrides.ts` — any internal ACT assembly?
8. `grep -rn 'levelPrefix' src/` — catch any utility I haven't named.
9. `grep -rn 'extractLevelPrefixFromPattern' src/` — confirm consumer count.
10. `src/utils/budgetExportSystem.ts` — confirm export reads pre-assembled codes from `adjustedLaborSummary` (read-only consumer, should require no change).

**Memory + spec cross-check:**

11. `mem://features/multitrade-level-indicators` — current documented behavior (says ACT is "composite code assembly e.g., 01BA" — confirms level-first is the documented spec, not just a code accident).
12. `mem://architecture/multitrade-act-resolution-integrity` — strict resolver-only sourcing rule.
13. `mem://data/cost-code-formatting-constraints` — the "4-char padStart leading zeros" rule.
14. `mem://architecture/building-id-normalization` — single-digit normalization rules.

**Data sites — check for persisted old-format ACT values that would break on a runtime flip:**

15. `cost_head_activity_overrides` — schema shows `building_identifier`, no ACT column, so likely safe. Confirm no full ACT strings stored.
16. `floor_section_mappings.activity_code` — defaults to `0000`. Are any rows storing pre-assembled level-split values like `01BA`?
17. `building_section_mappings.section_code` — should store raw building IDs (`BA`, `B12`). Hamilton PL evidence already confirms raw storage. Re-verify.
18. `project_small_code_merges` — `merged_act` and `redistribute_adjustments` jsonb. **Critical:** Hamilton PL has saved merges referencing specific ACT codes. If those are stored as `01BA`, flipping runtime to `BA01` orphans every saved merge.
19. `category_item_name_overrides.labor_code` + `category_item_type_overrides.labor_code` + `category_material_desc_overrides.labor_code` — full code strings. Do any contain level-split ACTs?

For items 15-19 I'll run targeted `supabase--read_query` SELECTs scoped to Hamilton PL (`79aeb1d0-5c88-48a6-8485-74bc792abae5`) and Hamilton MP (`7aa11e70-0781-495d-82a6-53d486d747da`) to see actual stored values, not assumed schema.

### Deliverable

A single document with three sections:

**A. Patch surface map**
- Every file:line where ACT is assembled
- Whether each site uses a shared helper or inlines the concatenation
- Recommended single-helper location (likely `src/lib/utils.ts` next to `normalizeActivityCode`)
- List of consumers that would need to switch from inline `levelPrefix + bldgSuffix` to `assembleActivityCode(buildingId, levelPrefix)`

**B. Data migration risk assessment**
- For each of the 5 DB sites (15-19): exact count of rows containing level-split ACT codes on Hamilton PL and Hamilton MP
- Whether flipping runtime format orphans any saved merges, overrides, or floor mappings
- If yes → recommended approach: (a) per-project format flag on `estimate_projects` (legacy stays level-first, new projects go building-first), (b) one-shot data migration, or (c) leave Hamilton PL alone and apply new format to MP only via a code-format-mode variant

**C. Hamilton PL impact statement**
- Whether PMs have any exported budgets quoting `PL 01BA WATR` that downstream Murray accounting depends on
- This is a question for **you**, not something I can answer from the code — but I'll flag it explicitly so it's not skipped

**D. Spec/memory updates required**
- `mem://features/multitrade-level-indicators` says level-first is the format. If we flip, this memory is wrong and must be updated in the same patch.
- `mem://data/cost-code-formatting-constraints` — the `padStart` rule is correct for the leading-zero case but doesn't address building-first ordering. Needs a clarifying line.
- CLAUDE.md `data/cost-code-formatting-constraints` reference — same.

### Hard out-of-scope

- ❌ No code edits this loop
- ❌ No DB migrations this loop
- ❌ No `mem://` writes this loop
- ❌ No proposed patch — only the patch surface map. Patch design happens after you decide on per-project flag vs global flip vs MP-only.
- ❌ No re-derivation of Q3 / multitrade SEC overwrite (settled)
- ❌ No touching `datasetProfiler.ts`

### Stop conditions

- If item 18 (`project_small_code_merges` on Hamilton PL) shows level-split ACT values like `01BA` in `merged_act` or `redistribute_adjustments` keys → **stop, report, do not propose flip without your explicit decision on Hamilton PL re-export vs per-project versioning**
- If any code site assembles ACT in a way that *can't* be expressed by a single `assembleActivityCode(buildingId, levelPrefix)` helper → stop, report the exception, ask whether to special-case or refactor
- If `mem://features/multitrade-level-indicators` documents specific PM-facing behavior we'd be changing (not just internal format) → stop, report

### Time

~10 minutes: 5 file reads, 2 greps, 5 scoped DB queries, 3 memory file reads. Approve and I'll return the three-section document.

