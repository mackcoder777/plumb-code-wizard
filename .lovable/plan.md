

# Add Item-Name Override Recalculation Effect

## Problem
The material description override recalc effect (Index.tsx lines 1240-1338) watches `dbMaterialDescOverrides` and recalculates affected items when overrides change. There is **no equivalent effect** for `dbItemNameOverrides`. This means:
- User assigns an item-name override in the Category Labor Mapping UI
- The DB updates (optimistic + server)
- But already-loaded `estimateData` items keep their old cost codes until a full page refresh

## Solution
Add a parallel `useEffect` that mirrors the material desc recalc pattern exactly, but watches `dbItemNameOverrides` instead. It will:

1. Track previous state via a `prevItemNameOverridesRef`
2. Detect which `(category, materialDesc, itemName)` triples changed or were deleted
3. For each affected item in `estimateData`, re-run the full priority chain (item name override → material desc override → category → system)
4. Batch-update changed items in state and persist to DB via `batchUpdateSilent`

### File: `src/pages/Index.tsx`

**Add** near line 982 (alongside existing refs):
- `const prevItemNameOverridesRef = useRef<string>('')`

**Add** after the material desc recalc effect (~line 1338):
- New `useEffect` with dependency `[dbItemNameOverrides, currentProject?.id]`
- Same structure as the material desc effect but keyed on `(reportCat, materialDesc, itemName)` triples
- Recalculation uses the same priority chain already in the material desc effect

## Files changed
| File | Change |
|------|--------|
| `src/pages/Index.tsx` | Add `prevItemNameOverridesRef` + new useEffect for item-name override recalculation |

