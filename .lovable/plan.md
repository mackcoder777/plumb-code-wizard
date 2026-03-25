

# Fix: "In Export" rows not selectable due to duplicate React keys

## Root Cause

The console shows **duplicate key warnings** for `B3|SPCL`, `B2|SLVS`, etc. The `inExportRows` memo iterates `finalLaborSummary` entries — multiple entries can share the same `sec|head` key but differ by activity code (e.g., `B3 0000 SPCL` and `B3 00L1 SPCL` both produce key `B3|SPCL`). When rendered, React receives two `<TableRow key="B3|SPCL">` elements, causing it to silently drop/duplicate DOM nodes. This makes some rows unclickable — their checkboxes and buttons are dead.

## Fix

**File**: `src/components/BudgetAdjustmentsPanel.tsx`

**At render time only** (not changing the `inExportRows` memo), deduplicate `sourceRows` when `standaloneFilter === 'in-export'` before passing to the `.map()` renderer.

After building `sourceRows` from `inExportRows.map(...)` (around line 4061-4071), add a deduplication step:

```typescript
const sourceRows = standaloneFilter === 'in-export'
  ? (() => {
      const mapped = inExportRows.map(ieRow => {
        const found = standaloneGroups.find(g => g.key === ieRow.key)
          || savedOnlyRows.find(r => r.key === ieRow.key);
        return found ?? {
          key: ieRow.key,
          lines: [{ code: ieRow.displayKey }],
          combinedHours: ieRow.combinedHours,
          sec: ieRow.sec,
          head: ieRow.head,
        };
      });
      // Deduplicate by key, summing hours for entries with multiple activity codes
      const seen = new Map();
      mapped.forEach(row => {
        if (seen.has(row.key)) {
          const existing = seen.get(row.key);
          existing.combinedHours = (existing.combinedHours ?? 0) + (row.combinedHours ?? 0);
        } else {
          seen.set(row.key, { ...row });
        }
      });
      return Array.from(seen.values());
    })()
  : [/* existing default logic unchanged */];
```

This ensures each `sec|head` key appears exactly once in the rendered table, fixing:
- **Select All** — no duplicate keys means every checkbox maps to a unique row
- **Individual row checkboxes** — React correctly tracks each row's DOM
- **Reassign/Accept buttons** — click handlers fire on the correct element

No changes to `inExportRows` useMemo, merge logic, or export code.

