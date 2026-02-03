
# Enhanced Search and Item Type Filtering for Material Mapping

## Problem
The current search only filters parent Material Spec names, not child Item Type names. Users cannot:
1. Search for common Item Types like "Specialties", "Struct Attachments", "Supports" across all Material Specs
2. Select all matching Item Types at once to assign the same code

## Solution
Add dual-level search and an Item Type filter dropdown to enable cross-category selection.

## Technical Changes

### File: `src/components/tabs/MaterialMappingTab.tsx`

**1. Add Item Type Filter State (~line 75)**
```typescript
const [itemTypeFilter, setItemTypeFilter] = useState<string>('all');
```

**2. Extract Unique Item Types (~line 91)**
```typescript
const uniqueItemTypes = useMemo(() => {
  const types = new Set<string>();
  data.forEach(item => {
    if (item.itemType) types.add(item.itemType);
  });
  return Array.from(types).sort();
}, [data]);
```

**3. Update Search Logic in `filteredGroups` (~lines 384-388)**

Current (only searches Material Spec):
```typescript
if (searchTerm && !group.materialSpec.toLowerCase().includes(searchTerm.toLowerCase())) {
  return false;
}
```

New (searches both Material Spec AND Item Type):
```typescript
if (searchTerm) {
  const searchLower = searchTerm.toLowerCase();
  const specMatches = group.materialSpec.toLowerCase().includes(searchLower);
  const typeMatches = group.subGroups.some(sg => 
    sg.itemType.toLowerCase().includes(searchLower)
  );
  if (!specMatches && !typeMatches) return false;
}
```

**4. Filter subGroups when Item Type filter is active**

After the existing filter logic, add Item Type filtering:
```typescript
// Apply Item Type filter
if (itemTypeFilter !== 'all') {
  const filtered = group.subGroups.filter(sg => sg.itemType === itemTypeFilter);
  if (filtered.length === 0) return null;
  return { ...group, subGroups: filtered };
}
```

**5. Add Item Type Filter Dropdown to UI**

Add a new Select dropdown in the filter area (similar to System filter):
```tsx
<Select value={itemTypeFilter} onValueChange={setItemTypeFilter}>
  <SelectTrigger className="w-48">
    <SelectValue placeholder="All Item Types" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Item Types</SelectItem>
    {uniqueItemTypes.map(type => (
      <SelectItem key={type} value={type}>{type}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

**6. Add "Select All Visible" Button**

Add a button to select all currently visible/filtered groups at once:
```tsx
<Button 
  variant="outline" 
  size="sm"
  onClick={() => {
    // Select all visible subgroups and their items
    const newGroups = new Set(selectedGroups);
    const newItems = new Set(selectedItems);
    filteredGroups.forEach(g => {
      g.subGroups.forEach(sg => {
        newGroups.add(`${g.materialSpec}|${sg.itemType}`);
        sg.items.forEach(i => newItems.add(String(i.id)));
      });
    });
    setSelectedGroups(newGroups);
    setSelectedItems(newItems);
  }}
>
  Select All Visible ({filteredGroups.reduce((sum, g) => sum + g.subGroups.length, 0)})
</Button>
```

## Expected Workflow After Implementation

1. **Filter by Item Type**: Select "Specialties" from Item Type dropdown
2. **View**: See all Material Specs that contain "Specialties" items
3. **Select All**: Click "Select All Visible" to select all Specialties groups
4. **Bulk Assign**: Use floating action bar to assign a single code to all selected

Alternative workflow:
1. **Search**: Type "Support" in search box
2. **View**: See all groups where Material Spec OR Item Type contains "Support"
3. **Select matching**: Check the ones you want
4. **Assign**: Apply code to selection

## UI Layout

The filter bar will have:
- System Filter dropdown (existing)
- Item Type Filter dropdown (new)
- Status Filter dropdown (existing)
- Search input (existing, enhanced)
- Select All Visible button (new)

## Complexity
Medium - Multiple coordinated changes but follows existing patterns
