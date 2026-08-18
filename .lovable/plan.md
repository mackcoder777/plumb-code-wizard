# Fix the persistent "Unapplied System Mapping Changes" warning — with cited source

## Answers to the five questions, from the files

### 1. There is only one latch, and it is the memo

- `SystemMappingTab.tsx:123-140` defines `hasUnappliedChanges`.
- `:142-144` pushes it up via `onUnappliedChangesUpdate`.
- `Index.tsx:3404` binds that to `setHasUnappliedMappingChanges`.
- `Index.tsx:550` gates the tab-leave modal on `hasUnappliedMappingChanges`; `SystemMappingTab.tsx:991` gates the amber banner on `hasUnappliedChanges`. Same value, one hop apart.
- `beforeunload` (`:146-155`) uses the same value.

`appliedSystems` no longer gates anything. Remaining uses:
- write on DB load `:261-289`, write in Apply All `:820`, write in single-system apply `:900-907`
- read only at `:329` (`appliedInfo` for the per-system card display) and `:331`

`Index.tsx:596` declares a **separate** `appliedSystems` state for its own UI; it is not the tab's. So fixing the memo fixes banner and modal together. My previous plan listed them as two verification outcomes — that was sloppy wording, not evidence of a second mechanism.

### 2. Where Apply All lives — your objection is correct, and worse than stated

The priority chain is **already duplicated three times**, all component-local, none in a util:

- `applyMappings` (Apply All) — `:726-844`, chain at `:742-781`
- `applySystemMapping` (single system) — `:846-934`, chain at `:855-885`
- `handleApplySectionCodes` (re-apply sections) — `:621-724`, chain at `:636-646`

A fourth component-local copy for the banner is the bug reintroduced. This plan extracts one pure exported helper and routes all four through it.

### 3. Token parser

- Banner memo `:135`: `code.split(/\s+/).pop()`
- Apply sites `:768-769`, `:862-863`, `:873-874`: `parts[parts.length - 1]`
- `handleApplySectionCodes` `:633-634` differs: `parts.length >= 3 ? parts[last] : parts[0]` — it accepts a bare head with no SEC/ACT.

Last-token and `pop()` agree on `SEC ACT HEAD`. They disagree with the fourth site on a bare 1-token code, and all of them return `''` for an uncoded item. The helper below fixes the parse in one place with explicit handling for both shapes.

### 4. PM authority — verified, these are DB rows

`getLaborCodeFromCategory` is `useCategoryMappings.ts:183-205`; `getLaborCodeFromMaterialDesc` is `useCategoryMaterialDescOverrides.ts:130-143`. Both are pure lookups over query results with no fallback constants; both return `null` on sentinel (`__SYSTEM__`, `__CATEGORY__`).

Rows come from `category_labor_mappings` (`useCategoryMappings.ts:35-52`) and `category_material_desc_overrides` (`useCategoryMaterialDescOverrides.ts:15-29`) filtered by `project_id`.

Live LBTP rows, with authoring timestamps:

```text
Supports            -> HNGS   2026-08-18 23:09:28
Fixtures            -> FNSH   2026-08-18 23:10:34
Valves              -> VALV   2026-08-18 23:10:40
Sleeves             -> SLVS   2026-08-18 23:10:45
Drains/Cleanouts    -> DRNS   2026-08-18 23:10:48
Plumbing Equipment  -> SEQP   2026-08-18 23:10:50
PlumbingSpecialties -> SPCL   2026-08-18 23:11:03
HVAC Equipment      -> SEQP   2026-08-18 23:11:13
```

You authored these minutes before the report. The HNGS recode is your `Supports -> HNGS` row, not a hardcoded rule. Nothing is being silenced except a comparison that ignores your own overrides.

### 5. Consumers of appliedSystems outside the tab

None. `Index.tsx:596` is a distinct state object; `Index.tsx:843-846` populates it from `system_mappings.applied_at` for Index's own display. No cross-component read of the tab's copy.

## What to change

1. **New pure helper, exported** — `src/utils/laborHeadResolution.ts`:
   - `parseCostHead(costCode)` — returns the head token, handling `SEC ACT HEAD`, bare `HEAD`, and empty/uncoded (returns `null`, never `''`).
   - `resolveExpectedHead(item, { materialDescOverrides, categoryMappings, systemMappings })` — Tier 0 material desc, Tier 1 category, Tier 2 system, else `null`. Pure, no defaults, no auto-assignment.

2. **Route all four sites through it** — `applyMappings`, `applySystemMapping`, `handleApplySectionCodes`, and the banner memo. This removes the three existing duplicate chains rather than adding a fourth.

3. **Rewrite the banner memo** (`:123-140`) as: unapplied iff some item's `parseCostHead(item.costCode)` differs from `resolveExpectedHead(item, ...)` where the expected head is non-null. Items with no resolvable head are ignored (they are the "unmapped" signal, counted separately).

4. **Leave `appliedSystems` alone.** It stays display-only. No timestamp logic returns.

5. **Verify on LBTP**: banner and modal both clear; 26/26 systems, 1944/1944 items still coded; `01 0000 HNGS` still present; pre/post-merge totals stay 4176.00 h with 0.000 drift. Then break it deliberately — change one system mapping without applying — and confirm the banner returns.

## Scope

Files: new `src/utils/laborHeadResolution.ts`, `src/components/tabs/SystemMappingTab.tsx`. No database change, no change to which code any item receives, no new assignment authority.
