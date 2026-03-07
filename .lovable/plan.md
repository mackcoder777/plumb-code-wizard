

# Smart Assign Preview Dialog

## Problem

When Smart Assign detects multiple codes (e.g., 9524 and 9525 in the Fixtures group), you currently only see a basic browser confirmation popup like "200 items -> 9525, 225 items -> 9524". There's no way to:
- See WHICH items go to which code
- Understand the high-level breakdown by description/size
- Verify the assignments are correct before applying

## What 9524 Covers (for reference)

Code **9524** matches items containing these keywords: `valve`, `ball valve`, `gate valve`, `check valve`, `butterfly`, `prv`, `pressure reducing`.

In your Fixtures group, items like "Ball Valve", "Check Valve", "Gate Valve" descriptions would route to 9524, while "Lavatory", "Urinal", "Water Closet", "Sink" items route to 9525.

## Solution: Smart Assign Preview Dialog

Replace the basic `window.confirm` popup with a proper dialog that shows a tabbed breakdown of which items go to each code.

### UI Design

When you click "Smart Assign", a dialog opens with:

1. **Summary header** showing total items and code count
2. **Tabbed sections**, one per detected code (e.g., "9524 - Valves (200)", "9525 - Fixtures (225)")
3. Each tab shows a **grouped summary** of items by their Size/Description, with counts and dollar totals
4. An **"Unmatched" tab** (if any) showing items that didn't match any keyword rule
5. **Confirm** and **Cancel** buttons at the bottom

```text
+--------------------------------------------------+
|  Smart Assign Preview                        [X]  |
|                                                   |
|  425 items will be assigned to 2 codes            |
|                                                   |
|  [9525 Fixtures (200)]  [9524 Valves (225)]       |
|  [Unmatched (0)]                                  |
|                                                   |
|  9525 - Plumbing Fixtures                         |
|  +-----------+-------------------------+-----+    |
|  | Qty       | Description             | $   |    |
|  +-----------+-------------------------+-----+    |
|  | 45        | Wall Lavatories          | 12k |    |
|  | 32        | Urinal Wall Hung         | 8k  |    |
|  | 28        | Water Closet             | 15k |    |
|  | ...       | ...                      | ... |    |
|  +-----------+-------------------------+-----+    |
|                                                   |
|            [Cancel]    [Apply All (425 items)]    |
+--------------------------------------------------+
```

### Technical Changes

#### File: `src/components/tabs/MaterialMappingTab.tsx`

1. **Add state** for the preview dialog:
   - `smartAssignPreview` state holding `{ groups, unmatched, items }` or `null`
   - When not null, the dialog is open

2. **Modify `handleSmartAssign`** to set the preview state instead of calling `window.confirm`. The actual assignment logic moves to a `confirmSmartAssign` function triggered by the dialog's "Apply" button.

3. **Add `SmartAssignPreviewDialog` component** (inline or extracted):
   - Uses the existing `Dialog` component from shadcn
   - `Tabs` component for switching between code groups
   - Each tab aggregates items by description/size and shows counts + dollar totals
   - A summary row at the bottom of each tab
   - "Apply All" button calls the existing batch update logic

#### File: `src/hooks/useMaterialMappingPatterns.ts`

4. **Export `DESCRIPTION_CODE_KEYWORDS`** so the preview dialog can show which keywords triggered the match for transparency (optional enhancement -- show matched keyword next to each group).

### No database changes needed.

