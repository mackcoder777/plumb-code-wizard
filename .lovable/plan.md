# Material tab: "Save Failed" and nothing persists after a fresh upload

## What is actually happening (verified)

The other user (cnaik@murraycompany.com) created their own LBTP project (`bcfa2e36…`) at 20:53 today. Its 1,944 rows exist in the database, but **every single one has an empty `material_cost_code`** — no material assignment has ever landed. The owner check is not the problem: they own the project and RLS allows their updates.

The failure is an ID-type mismatch:

- `FileUpload.tsx:210` gives every parsed row a **numeric** id (`0, 1, 2, …`) while the workbook is still in memory.
- `useSaveEstimateItems` (`useEstimateProjects.ts:475+`) deletes and re-inserts the rows; the database generates **UUID** primary keys, and the in-memory rows are never refreshed with them.
- Every material save path in `MaterialMappingTab.tsx` (group assign :666, bulk assign :807, item-level :880, smart assign :977, apply-suggestions :1064) calls `useBatchUpdateMaterialCostCodes`, which filters with `.in('id', batchIds)` (`useEstimateProjects.ts:776`).

So in a session that uploaded the file (rather than re-opening a saved project), the request sends `id=in.(0,1,2,…)` against a `uuid` column. Postgres rejects it, the mutation throws, and the tab shows "Save Failed — changes applied locally but failed to save to database." That is exactly the state in the screenshot, and it explains why jrubin never sees it: his sessions load projects from the database, so his rows already carry UUIDs.

The same trap exists in `useDismissFromMaterialBudget` if it also filters by `id` — to be confirmed while patching.

## The fix

**1. Make the material batch writer key on `row_number`, not `id`.**
`row_number` is already the project's stable identifier and is the mechanism the labor-side writer (`batchUpdateSilent`, `useEstimateProjects.ts:589+`) uses for exactly this reason. Change `useBatchUpdateMaterialCostCodes` to accept row numbers and filter with `.eq('project_id', …).in('row_number', …)`, keeping the 100-per-batch chunking.

**2. Update the five call sites in `MaterialMappingTab.tsx`** to pass `item.rowNumber` instead of `String(item.id)`. Local state updates continue to key on `id` — only the database filter changes.

**3. Apply the same treatment to `useDismissFromMaterialBudget`** if it filters by `id`, so the "dismiss from material budget" action does not fail in the same session.

**4. Surface the real error.** The catch blocks swallow the Postgres message. Include `error.message` in the destructive toast so the next database rejection is diagnosable from a screenshot instead of requiring a database audit.

## Verification

- Confirm the writer chunking still holds for a 613-item group (7 requests).
- Re-run a group assign in a fresh-upload session and confirm `material_cost_code` is non-empty in the database afterward.
- Re-open an existing project (jrubin's LBTP, UUID ids) and confirm group assign, item-level assign, and Smart Assign all still persist — the row-number path must work for both session shapes.
- Confirm no labor-side code path is touched and no cost-code assignment authority changes.

## Scope

`src/hooks/useEstimateProjects.ts` (material batch writer, dismiss writer), `src/components/tabs/MaterialMappingTab.tsx` (call sites + error text). No database migration, no schema change.
