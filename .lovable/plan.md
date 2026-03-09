

## Bug: Small Code Consolidation Groups Across Different SECs

**Problem**: The `smallCodeAnalysis` logic groups codes by cost head alone (`byHead[item.head]`), ignoring which SEC they belong to. This means `12 00L1 TRAP` and `14 00L2 TRAP` get lumped together and the UI shows they'll all merge into `12 0000 TRAP` — which is wrong.

**Correct behavior**: Only codes with the **same SEC and same cost head** should be merge candidates. `12 00L1 TRAP` + `12 00L2 TRAP` → `12 0000 TRAP`. A TRAP code in SEC 14 is a separate group.

---

### Changes (all in `src/components/BudgetAdjustmentsPanel.tsx`)

**1. Fix `smallCodeAnalysis` grouping key** (~line 960-965)

Change the grouping from `byHead[item.head]` to `bySecHead[item.sec + ' ' + item.head]`, so codes are only grouped when they share both SEC and cost head.

Update the return to include the `sec` in each group result so the UI knows which SEC the group belongs to.

**2. Fix `finalLaborSummary` merge logic** (~line 920-940)

Same issue exists here — the merge application filters by cost head alone (`parts[2] === head`). This needs to also match on SEC. The saved merge record should store SEC or the merge logic should scope by SEC when applying.

**3. Fix `handleConsolidate` / saved merge data model**

Currently `project_small_code_merges` only stores `cost_head`. To scope merges per-SEC, either:
- Add a `sec_code` column to `project_small_code_merges` (preferred — precise)
- Or store a composite key like `"12|TRAP"` in `cost_head`

I recommend adding a `sec_code` text column via migration and updating the query/mutation/merge logic to filter on both `sec_code` and `cost_head`.

**4. Update the UI table** (~line 2077)

The table key and display already derive SEC from the first line. After fix #1, each group is guaranteed to be single-SEC, so the "Will Become" column will be correct.

---

### Summary of edits

| Location | What changes |
|---|---|
| DB migration | Add `sec_code` column to `project_small_code_merges` |
| `smallCodeAnalysis` useMemo | Group by `sec+head` instead of `head` alone |
| `finalLaborSummary` useMemo | Match on both `sec` and `cost_head` when applying saved merges |
| `handleConsolidate` | Include SEC in saved merge records |
| `handleUndoMerge` | Filter by both `sec_code` and `cost_head` |
| Query/mutation | Read and write `sec_code` alongside `cost_head` |

