

# Sort Expanded Item Rows by Hours (Descending)

## Problem
When you expand a material description group in Category Labor Mapping, the item rows appear in arbitrary insertion order. Items with the most hours should appear first so you can quickly see what's driving the labor in that group.

## Change

**File: `src/components/CategoryLaborMapping/MaterialDescSection.tsx` (~line 284)**

Sort `rawItems` by hours descending before slicing to the first 15:

```typescript
// BEFORE:
{rawItems.slice(0, 15).map((item, i) => (

// AFTER:
{[...rawItems].sort((a, b) => (b.hours || 0) - (a.hours || 0)).slice(0, 15).map((item, i) => (
```

One line change. The sort is done on a shallow copy to avoid mutating the source array. Items with the most hours appear at the top of the expanded preview table.

## Files changed
| File | Change |
|------|--------|
| `src/components/CategoryLaborMapping/MaterialDescSection.tsx` | Sort rawItems by hours desc before rendering |

