

## Bug: Checkboxes Can't Be Unchecked for Standalone Small Codes

### Root Cause

The `Checkbox` component (Radix UI) uses `onClick` for toggling instead of the proper `onCheckedChange` callback. Radix Checkbox internally handles click events and when only `checked` is provided without `onCheckedChange`, the component can swallow or interfere with clicks — particularly when trying to uncheck.

The shift-click range-select logic requires access to the native `MouseEvent` (for `shiftKey`), which is why `onClick` was used. But this conflicts with Radix's internal event handling.

### Fix

**File: `src/components/BudgetAdjustmentsPanel.tsx`**

**Change the checkbox to use `onCheckedChange` for the toggle logic, and a separate `onClick` only for capturing `shiftKey`:**

1. Store the last shift state in a ref so `onCheckedChange` can read it
2. Move all toggle logic from `onClick` into `onCheckedChange`
3. Use `onClick` only to capture `e.shiftKey` into the ref

Specifically, replace the checkbox block (lines 2331-2355) with:

```tsx
<Checkbox
  checked={!!consolidations[mergeKey]}
  onClick={(e) => {
    // Just capture shift state for range-select
    shiftKeyRef.current = (e as React.MouseEvent).shiftKey;
  }}
  onCheckedChange={(checked) => {
    const currentIndex = rowIndex;
    const isShift = shiftKeyRef.current;
    shiftKeyRef.current = false;
    
    if (isShift && lastCheckedIndexRef.current >= 0) {
      const from = Math.min(lastCheckedIndexRef.current, currentIndex);
      const to = Math.max(lastCheckedIndexRef.current, currentIndex);
      const next: Record<string, boolean> = {};
      for (let i = from; i <= to; i++) {
        if (!savedMergeKeySet.has(smallCodeAnalysis[i].key)) {
          next[smallCodeAnalysis[i].key] = !!checked;
          if (checked) autoInitRow(smallCodeAnalysis[i].key);
        }
      }
      setConsolidations((prev) => ({ ...prev, ...next }));
    } else {
      setConsolidations((prev) => ({ ...prev, [mergeKey]: !!checked }));
      if (checked) autoInitRow(mergeKey);
    }
    lastCheckedIndexRef.current = currentIndex;
  }}
/>
```

Also add a `shiftKeyRef` near the existing `lastCheckedIndexRef`:
```tsx
const shiftKeyRef = useRef<boolean>(false);
```

Similarly update the "Select All" checkbox (line 2285-2305) to use `onCheckedChange` if it also uses `onClick`.

### Summary
- Add `shiftKeyRef` near line 462
- Replace `onClick` toggle logic with `onCheckedChange` on the per-row checkbox (lines 2331-2355)
- Keep `onClick` only for capturing shift key state
- No database changes

