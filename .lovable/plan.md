

# Fix: Exclude Standalone Floor Codes from Zone Assignment Suggestions

## Problem
The `localMappings` values include section codes for standalone floors like RF (Roof), UG (Underground), CS (Crawl Space). These are floor-level fallback codes, not actual building sections. They shouldn't appear as zone assignment options because standalone floors get resolved per-zone to different building sections.

## Solution
Filter out codes that match standalone floor patterns from the suggestions list. The standalone floors are already defined via `STANDALONE_FLOORS` regex in `useBuildingSectionMappings.ts`.

### `src/components/FloorSectionMapping.tsx` (~lines 546-552)

Update the `allSectionSuggestions` memo to exclude codes that are themselves standalone floor abbreviations:

```ts
const STANDALONE_SECTION_CODES = new Set(['RF', 'UG', 'CS', 'ST']);

const allSectionSuggestions = useMemo(() => {
  const codes = new Map<string, string>();
  Object.values(localMappings).forEach(code => {
    if (code && !codes.has(code) && !STANDALONE_SECTION_CODES.has(code.toUpperCase())) {
      codes.set(code, '');
    }
  });
  return Array.from(codes.entries()).map(([code, description]) => ({ code, description }));
}, [localMappings]);
```

This removes RF, UG, CS, ST from the dropdown while keeping real building section codes like MD, BA, BB, BC, BD, B1, B2, B3, etc.

