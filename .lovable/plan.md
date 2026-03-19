

## Issues Found

### 1. Code not shown in the dropdown display
In `SystemCard.tsx` line 221-226, `getCodeDisplay` only shows the description:
```typescript
return found ? found.description : effectiveCode;
```
Should show both code and description, e.g. `"DIWA - DOMESTIC & INDUSTRIAL WATER"`.

### 2. "Applied: 0 items" problem
In `applySystemMapping` (SystemMappingTab.tsx line 716-798), items are only counted as "affected" when their cost head **changes**. If the same code was already applied, the comparison `existingCostHead !== systemMapping.laborCode` returns false, so `itemsAffected` stays 0. The system then records `appliedItemCount: 0`.

This happens when a user clicks "Apply" a second time, or when the items already had that cost head from a previous apply. The fix: count all items that **match** the system and have the correct code, not just those that changed.

## Plan

### File: `src/components/tabs/SystemMappingTab/SystemCard.tsx`

**Fix 1 — Show code in dropdown display**
- Line 225: Change `return found ? found.description : effectiveCode;` to `return found ? \`${found.code} - ${found.description}\` : effectiveCode;`

### File: `src/components/tabs/SystemMappingTab.tsx`

**Fix 2 — Count all matching items, not just changed items**
- In `applySystemMapping` (around line 716), after the map loop, count total items belonging to the system regardless of whether they changed:
  ```typescript
  const totalSystemItems = data.filter(item => normalizeSystemKey(item.system) === systemKey).length;
  ```
- Use `Math.max(itemsAffected, totalSystemItems)` when recording the applied count, so re-applying shows the correct total rather than 0.

**Fix 3 — Same issue in bulk `applyMappings`** (around line 677)
- Similarly, for each mapped system, count total items belonging to that system so the applied count reflects the actual item count even when codes haven't changed.

