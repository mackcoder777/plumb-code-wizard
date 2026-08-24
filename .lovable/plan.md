# Material saves fail after a fresh upload — corrected plan

Your three findings are confirmed against the source. The previous plan's fix is withdrawn.

## What holds

`useSaveEstimateItems` (`useEstimateProjects.ts:438`) deletes by `project_id`, inserts in 500-row batches with no `.select()` (`:515-517`), and explicitly declines invalidation at `:530-531`. The client is never handed the generated UUIDs. `useBatchUpdateMaterialCostCodes:776` filters `.in('id', batchIds)`; in a fresh-upload session those ids are the integers from `FileUpload.tsx:210`. A `uuid` column rejects them — 22P02. Confirmed by data: cnaik's LBTP (`bcfa2e36…`, created 20:53 today) has 1,944 rows with `material_cost_code = ''` across the board, and they own the project, so RLS is not involved.

## What was wrong

1. `rowNumber` does not exist on `EstimateItem` (`src/types/estimate.ts:1-27`) and `FileUpload.tsx` never sets it. The proposed patch would have shipped `.in('row_number', [undefined, …])` into the exact session it was meant to fix.
2. There is no unique constraint on `(project_id, row_number)`. Calling it "the stable identifier" was an assertion, not a schema fact.
3. Six call sites, not five. `dismissFromBudget` (`MaterialMappingTab.tsx:752`) passes `String(item.id)` into `useDismissFromMaterialBudget:882`, which filters `.in('id', …)`.

The base disagreement is real: `saveItemsToDb` (`Index.tsx:2055`) writes `row_number: index`, `handleReplaceData` (`Index.tsx:2731`) writes `index + 1` while setting in-memory `id: index` at `:2722`, and the labor writer at `Index.tsx:2405` keys on `typeof item.id === 'number' ? item.id : …`.

## Audit result — PR 2 is smaller than feared

Every project currently in the database is 0-based and gap-free:

```text
project                          rows    min_rn  max_rn  distinct_rn
LBTP (cnaik, bcfa2e36)           1944    0       1943    1944
LBTP (jrubin, 83ab6db1)          1944    0       1943    1944
HAMILTON HVAC                    1919    0       1918    1919
PASADENA CENTRAL LIBRARY         1559    0       1558    1559
25053 - HAMILTON HIGH PLUMBING  12846    0       12845  12846
ROSE BOWL - BAFO                 1033    0       1032    1033
ROSE BOWL - REV 02                839    0        838     839
HAMILTON HIGH - PLUMBING        12846    0       12845  12846
RELATIVITY BAY 5                  444    0        443     444
```

No project shows `min_rn = 1`. Nothing live went through `handleReplaceData`'s 1-based path, so **no labor codes are currently written one row off and there is no data repair to schedule**. PR 2 becomes hygiene — close the trap before someone uses Replace Data — not remediation.

## Sequence

**PR 1 — error surfacing only.** Append `error.message` to the destructive toast in the four `MaterialMappingTab.tsx` catch blocks (`:686`, `:819`, `:901`, `:1086`) plus the dismiss catch. No behavior change. Then have cnaik reproduce and confirm the code is 22P02 before any writer is touched.

**PR 2 — unify the row_number base.** Make `handleReplaceData` (`Index.tsx:2731`) write `row_number: index`, matching `saveItemsToDb` (`:2055`) and the in-memory `id: index` it already sets at `:2722`. No migration, no backfill — the audit above says nothing needs repairing.

**PR 3 — hydrate ids at the source.** Change `useSaveEstimateItems` to `.insert(batch).select('id, row_number')`, return the mapping, and have the caller stamp the returned UUIDs onto the in-memory rows keyed by `row_number`. Safe without a unique constraint because the save is a full delete-and-replace, so row numbers are unique by construction within that one write. This is one change that fixes all six material sites, the dismiss path, and every other id-keyed writer. Reading the insert response is not a refetch, so the double-load the `:530` comment guards against does not return.

No row-number refactor at the call sites. No migration in any of the three.

## Verification

- After PR 3, in a fresh-upload session: group assign, item-level assign, Smart Assign, apply-suggestions, and dismiss all persist; confirm non-empty `material_cost_code` in the database.
- Re-open an existing project (UUID ids already loaded) and confirm the same five actions still persist — the hydration path must not disturb the load-from-database shape.
- Confirm the 100-per-batch chunking still holds on a 613-item group.
- Confirm no labor-side cost code changes value before/after PR 2 on an existing project.

## Scope

`src/components/tabs/MaterialMappingTab.tsx` (PR 1 toasts), `src/pages/Index.tsx` (PR 2 base), `src/hooks/useEstimateProjects.ts` plus its callers in `Index.tsx` (PR 3 hydration). No schema change.
