

# Category Labor Mapping Enhancements

## Overview
Enhance the Category Labor Mapping panel with two features:
1. **Expandable item preview** - Click to view items within each category (similar to System cards)
2. **"Use System Mapping" option** - An explicit choice to keep system-based mapping for a category without showing it as "unmapped"

## Current Issue
- Categories without explicit mappings show as "unmapped" (6 unmapped in screenshot)
- Users cannot see what items belong to each category
- No way to indicate "I intentionally want this category to use System mapping"

## Solution

### Feature 1: Category Item Preview

Add expandable item preview to each category row:

```text
┌────────────────────────────────────────────────────────────────┐
│ ✓ Drains/Cleanouts    │ 14 items • 584.0 hrs │ [DRNS ▼]       │
│   ▼ Preview Items                                              │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │ Drawing  │ System     │ Material Desc      │ Qty │ Hours │ │
│   │──────────────────────────────────────────────────────────│ │
│   │ P-101    │ Strm Drain │ 4" CI Drain Body   │  2  │  1.5  │ │
│   │ P-102    │ Vent       │ 3" Floor Cleanout  │  4  │  2.0  │ │
│   │ ...                                                       │ │
│   └──────────────────────────────────────────────────────────┘ │
│   [View All 14 Items in Estimates]                             │
└────────────────────────────────────────────────────────────────┘
```

Implementation:
- Add collapsible section to each category row
- Filter estimate data by `reportCat` field to get preview items
- Show first 5 items with Drawing, System, Material Desc, Qty, Hours
- Add "View All Items" button to navigate to Estimates tab filtered by category

### Feature 2: "Use System Mapping" Option

Add a special option in the dropdown that indicates the user wants this category to defer to system-based mapping:

```text
Dropdown Options:
├── No mapping (will count as unmapped)
├── ✦ Use System Mapping  ← NEW - counts as "mapped" but defers to system
├── ─────────────────────
├── DRNS - DRAINS & FLOOR SINKS
├── SEQP - EQUIPMENT SETTING
├── ...
```

Implementation:
- Store special value `__SYSTEM__` in database when user selects "Use System Mapping"
- Update stats calculation: categories with `__SYSTEM__` count as "mapped"
- Update UI: show checkmark for these categories but display "Use System Mapping" text
- Update export logic: categories with `__SYSTEM__` do not override system mapping

### Statistics Update

Change badge display:
- Current: "7/13 mapped • 6 unmapped"
- New: "7/13 mapped • 4 use system • 2 unset" (or similar wording)

## Technical Details

### File Changes

**`src/components/CategoryLaborMapping.tsx`**
- Add state for expanded categories: `expandedCategories: Set<string>`
- Add function to get preview items for a category
- Add Collapsible wrapper around each category row
- Add preview table similar to SystemCard
- Add "View All Items" button
- Update Select to include "Use System Mapping" option with value `__SYSTEM__`
- Update status icon logic: `__SYSTEM__` shows different icon (maybe link/chain icon)
- Update stats calculation to differentiate between "Use System Mapping" and truly unmapped

**`src/hooks/useCategoryMappings.ts`**
- Update `CategoryIndexEntry` to include `previewItems` array
- Add helper function `isUsingSystemMapping(laborCode: string)` 

**`src/utils/budgetExportSystem.ts`**
- Update category mapping logic to ignore `__SYSTEM__` values (fall through to system mapping)

### UI Layout for Category Row (with expansion)

```text
// Collapsed state
<div className="category-row">
  <button className="expand-toggle">▶</button>
  <CheckIcon /> 
  <span>Drains/Cleanouts</span>
  <span className="stats">14 items • 584.0 hrs</span>
  <Select value="DRNS">...</Select>
</div>

// Expanded state  
<div className="category-row expanded">
  <button className="expand-toggle">▼</button>
  ...
  <Collapsible>
    <table>...</table>
    <Button>View All in Estimates</Button>
  </Collapsible>
</div>
```

### Dropdown Options Structure

```typescript
<SelectContent>
  <SelectItem value="none">
    <span className="text-muted-foreground">No mapping (unset)</span>
  </SelectItem>
  <SelectItem value="__SYSTEM__">
    <span className="flex items-center gap-2">
      <Link2 className="h-3 w-3" />
      Use System Mapping
    </span>
  </SelectItem>
  <SelectSeparator />
  {laborCodes.map((code) => (
    <SelectItem key={code.id} value={code.code}>
      <span className="font-mono">{code.code}</span>
      <span className="ml-2">- {code.description}</span>
    </SelectItem>
  ))}
</SelectContent>
```

### Stats Badge Update

```typescript
const stats = useMemo(() => {
  const total = filteredCategories.length;
  const mapped = filteredCategories.filter(c => {
    const code = mappingsLookup[c.category.toLowerCase().trim()];
    return code && code !== '__SYSTEM__';
  }).length;
  const useSystem = filteredCategories.filter(c => {
    const code = mappingsLookup[c.category.toLowerCase().trim()];
    return code === '__SYSTEM__';
  }).length;
  const unset = total - mapped - useSystem;
  return { total, mapped, useSystem, unset };
}, [filteredCategories, mappingsLookup]);

// Badge display
<Badge>{stats.mapped} mapped</Badge>
{stats.useSystem > 0 && <Badge variant="outline">{stats.useSystem} use system</Badge>}
{stats.unset > 0 && <Badge variant="secondary">{stats.unset} unset</Badge>}
```

## User Workflow

1. User opens Category Labor Mapping panel
2. Sees list of categories with item counts
3. For categories like "Drains/Cleanouts" → selects specific labor code (DRNS)
4. For categories like "Pipe" or "Fittings" → selects "Use System Mapping" to defer to system-level codes
5. Can expand any category to see preview of items
6. Can click "View All Items" to jump to Estimates tab filtered by that category
7. Stats badge shows accurate counts: "7 mapped • 4 use system • 2 unset"

