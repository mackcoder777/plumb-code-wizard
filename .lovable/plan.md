

# Fix: Labor Code Assignments Lost on Every Reload

## Problem

All 1033 estimate items have **empty `cost_code` in the database**, despite having 22 system mappings and 13 category mappings fully configured. The current load logic (Index.tsx line 738) applies category mappings to local React state only -- it never writes them back to the database. System mappings are never applied during load at all. Every page refresh starts from scratch with empty codes.

This is a **design flaw**, not a one-off bug. The system has three layers of mapping rules (category, system, item-type) but no mechanism to automatically apply AND persist them on load.

## Root Cause (Three Issues)

1. **Category mappings applied but not saved**: On load, the code checks `if (!item.cost_code)` and applies category mappings to local state (line 738-746), but never calls the database save mutation. Next reload, `cost_code` is empty again.

2. **System mappings never applied on load**: For items where the category mapping is `__SYSTEM__` (Pipe, Fittings, Miscellaneous, Pipe_Fit -- which are the majority of items), `getLaborCodeFromCategory` returns `null`, so those items get no code. The system-to-labor-code mappings (e.g., "cold water" -> WATR) are only applied when the user manually clicks "Apply" in the Labor Mapping tab.

3. **No batch persist after load-time application**: Even if both mapping types were applied during load, there is no batch database write to make those assignments stick.

## Solution

Add an automatic "apply all mappings and persist" step that runs once after project data loads. This uses the existing mapping rules (category + system) to assign codes to every item and batch-saves them to the database.

### Step 1: Apply System Mappings During Load (Index.tsx)

In the existing `useEffect` that transforms saved items (line 698-759), add system mapping logic as a fallback when category mapping returns null:

```
For each item with no cost_code:
  1. Try category mapping (existing logic)
  2. If category returns null (including __SYSTEM__ defer):
     Look up system mapping from savedMappings (dbMappings)
     Extract the laborCode from the stored cost_head (format: "materialCode|laborCode")
     Build full code: section + activity + laborCode
  3. Assign to item
```

This means the load-time transformation now handles both priority levels: Category first, System as fallback.

### Step 2: Batch Persist Applied Codes to Database (Index.tsx)

After the load-time transformation, if any items received new codes (were previously empty in DB), trigger a batch database update using the existing `batchUpdateSystemCostCodes` mutation:

```
After transforming items:
  - Collect all items that got codes applied (where DB had empty cost_code)
  - Build itemUpdates array with row_number + cost_code pairs
  - Call batchUpdateSystemCostCodes to save in batches of 50
  - Log: "Auto-applied and saved X labor codes from mappings"
```

This ensures codes survive the next reload because they are now in the database.

### Step 3: Prevent Re-application Loop

Add a guard to prevent the auto-apply from firing repeatedly:

- Use a ref (`hasAutoAppliedRef`) that tracks whether auto-apply has already run for the current project
- Reset the ref when `currentProject.id` changes
- Only run the batch persist once per project load

## Technical Details

| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Expand load-time useEffect (line 698-759) to also apply system mappings as fallback when category returns null |
| `src/pages/Index.tsx` | Add a follow-up useEffect that batch-persists newly applied codes to DB using `batchUpdateSystemCostCodes` |
| `src/pages/Index.tsx` | Add `hasAutoAppliedRef` guard to prevent re-application loops |

### Mapping Priority (preserved)

```text
1. Saved DB code (cost_code not empty) --> keep as-is
2. Category mapping (e.g., Valves -> VALV) --> apply + save
3. System mapping (e.g., Cold Water -> WATR) --> apply + save
4. No mapping found --> leave empty
```

### What Changes for the User

- On project load, all items automatically get their labor codes from the configured mappings
- Those codes are saved to the database immediately
- Next reload shows 100% coded (or whatever percentage has mappings configured)
- No manual "Apply" step needed -- mappings are always enforced
- Manual overrides in the DB are still preserved (priority 1 above)

