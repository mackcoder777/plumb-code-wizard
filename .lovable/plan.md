

# Fix: Cascading Parent Selection to Item-Level

## Problem
When selecting a parent Material Spec checkbox, the child Item Type checkboxes appear selected (via `selectedGroups`), but the underlying `selectedItems` set is not populated. This breaks bulk assignment because the floating action bar relies on `selectedItems.size`.

## Root Cause
The `toggleParentSelection` function only updates `selectedGroups` (group keys like `"Copper Type L Hard - 95/5"` and `"Copper Type L Hard - 95/5|Fittings"`), but does not cascade to `selectedItems` (actual item IDs).

## Solution
Update `toggleParentSelection` to also populate/clear `selectedItems` with all item IDs from all child groups when toggling a parent.

## Technical Changes

### File: `src/components/tabs/MaterialMappingTab.tsx`

**Modify `toggleParentSelection` function (~lines 108-123):**

```typescript
const toggleParentSelection = (spec: string, group: MaterialGroup, e: React.MouseEvent) => {
  e.stopPropagation();
  const currentState = getParentCheckState(spec, group);
  
  // Collect ALL item IDs from ALL sub-groups
  const allItemIds = group.subGroups.flatMap(sg => 
    sg.items.map(i => String(i.id))
  );
  
  // Update group-level selection
  setSelectedGroups(prev => {
    const next = new Set(prev);
    if (currentState === 'checked' || currentState === 'indeterminate') {
      // Deselect parent and all children
      next.delete(spec);
      group.subGroups.forEach(sg => next.delete(`${spec}|${sg.itemType}`));
    } else {
      // Select parent and all children
      next.add(spec);
      group.subGroups.forEach(sg => next.add(`${spec}|${sg.itemType}`));
    }
    return next;
  });
  
  // CASCADE to item-level selection
  setSelectedItems(prev => {
    const next = new Set(prev);
    if (currentState === 'checked' || currentState === 'indeterminate') {
      // Deselect all items
      allItemIds.forEach(id => next.delete(id));
    } else {
      // Select all items
      allItemIds.forEach(id => next.add(id));
    }
    return next;
  });
};
```

## Expected Behavior After Fix

1. **Click parent checkbox (unchecked → checked):**
   - All child Item Type groups become selected (green checkmarks)
   - All individual items within those groups are added to `selectedItems`
   - Floating action bar appears showing total item count
   - User can deselect individual children they don't want

2. **Click parent checkbox (checked/indeterminate → unchecked):**
   - All child groups deselected
   - All item IDs removed from `selectedItems`
   - Floating bar hides if no other selections remain

3. **Deselect individual child after parent selection:**
   - Only that child's items removed from `selectedItems`
   - Parent shows indeterminate state
   - Remaining selections intact

## Complexity
Low - single function modification, approximately 15 lines changed.

