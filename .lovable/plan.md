

# UI Cleanup: Rename, Hide, and Collapse Mapping Panels

Three label/visibility changes only. No logic, database, or component renaming.

## Change 1: Rename "Floor to Section Mapping" → "Section Mapping"

**`src/components/FloorSectionMapping.tsx`**:
- Line 767: `Floor to Section Mapping` → `Section Mapping` (empty state)
- Line 787: `Floor to Section Mapping` → `Section Mapping` (main render)

**`src/components/tabs/SystemMappingTab.tsx`**:
- Line 833: `Floor to Section Mapping` → `Section Mapping` (collapsible trigger label)

## Change 2: Hide Building → Section Code panel

**`src/components/tabs/SystemMappingTab.tsx`** (lines 853-873):
Wrap the entire `{projectId && (<Collapsible>...</Collapsible>)}` block with `{false && (...)}`  so it renders nothing but remains in source.

## Change 3: Collapse System to Activity Mapping by default + add subtitle

**`src/components/tabs/SystemMappingTab.tsx`** (lines 876-893):
- Add state or use `defaultOpen={false}` (currently no open state, so it defaults to closed already — but explicitly set `open` to a state initialized as `false` for clarity, or just leave as-is since `<Collapsible>` without `open` defaults closed).
- Actually, reviewing the code: `<Collapsible>` on line 876 has no `open` prop, so it's already closed by default. I just need to add the subtitle text.
- Add muted description text inside the trigger button: `"Optional: override activity codes per system. Only needed when systems on the same floor require different activity codes."`
- Remove the `NEW` badge since this is now a known feature.

