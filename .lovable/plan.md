

# Hide Zero-Hour Items in Category Labor Mapping

## Problem
The Material Description Routing section shows entries with 0.0 hours (e.g., "Polyethylene - Identification 167 items · 0.0 hrs", "Carbon Steel - Access Doors/Panels 94 items · 0.0 hrs"). These clutter the UI and distract from entries that actually carry labor hours.

## Changes

### File: `src/components/CategoryLaborMapping.tsx` (~line 77)

Filter out zero-hour material description groups before sorting:

```typescript
// BEFORE:
return Object.entries(groups)
  .sort((a, b) => b[1].hours - a[1].hours)
  .map(([desc, d]) => ({ desc, ...d }));

// AFTER:
return Object.entries(groups)
  .filter(([, d]) => d.hours > 0)
  .sort((a, b) => b[1].hours - a[1].hours)
  .map(([desc, d]) => ({ desc, ...d }));
```

This filters at the data source so zero-hour entries never reach the `MaterialDescSection` component. Items with 0 hours but existing overrides will also be hidden — this is correct because there's no labor to route.

### File: `src/hooks/useCategoryMappings.ts` (useCategoryIndex)

Also filter zero-hour categories from the category index so top-level entries like "Pipe 0 items · 0 hrs" don't appear:

The `useCategoryIndex` function already sorts by `itemCount`. Add a filter to exclude categories where `totalHours === 0`.

## No other files changed.

