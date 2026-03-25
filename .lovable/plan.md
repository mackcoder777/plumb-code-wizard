

# Fix: Generate Auto-Suggestions for ALL In-Export Rows

## Root Cause

`standaloneAutoSuggestions` only generates suggestions for codes in `smallCodeAnalysis` where `lines.length === 1`. But the "In Export" view shows rows from `inExportRows`, which comes from `finalLaborSummary` — a completely different source. Many codes in `inExportRows` either:
1. Don't appear in `smallCodeAnalysis` at all (they only exist post-merge in `finalLaborSummary`)
2. Appear in `smallCodeAnalysis` with multiple lines (`lines.length > 1`), so they're filtered out

This leaves most "In Export" rows without any suggestion — no ⚡ badge, no auto-populated dropdown, and no auto-resolve capability.

## Fix

**File**: `src/components/BudgetAdjustmentsPanel.tsx`

### Change 1: Extend suggestion generation to cover all inExportRows

In the `standaloneAutoSuggestions` useMemo (~line 1640), after processing `standalone` entries from `smallCodeAnalysis`, add a second pass that iterates over `inExportRows` and generates suggestions for any key not already covered:

```typescript
// After existing standalone.forEach block (line 1766)...

// Pass 2: Cover inExportRows not already in suggestions
(inExportRows ?? []).forEach(ieRow => {
  if (suggestions[ieRow.key]) return; // already have one
  const sec = ieRow.sec;
  const head = ieRow.head;

  // Rule A: BG-to-above-grade chain
  const chain = BG_TO_ABOVE_GRADE[head];
  if (chain) {
    const found = findTargetKey(sec, head === 'BGPD' ? ['PMPD', 'STRM'] : [...chain]);
    if (found) {
      suggestions[ieRow.key] = {
        targetHead: found.head,
        targetKey: found.key,
        reason: `${head} → ${found.head}`,
      };
      return;
    }
  }

  // Rule B: Above-grade system codes → accept
  if (ABOVE_GRADE_SYSTEM_CODES.has(head)) {
    suggestions[ieRow.key] = {
      targetHead: '__accepted__',
      targetKey: '',
      reason: 'Above-grade system code — accept as standalone',
    };
    return;
  }

  // Rule C: System inference from source items
  // (same logic as existing Rule 2)

  // Rule D: Peer-merge fallback — largest same-section code
  if (!suggestions[ieRow.key]) {
    const sameSec = Object.entries(finalLaborSummary)
      .filter(([k]) => {
        const p = k.trim().split(/\s+/);
        return p[0] === sec && p.slice(2).join(' ') !== head;
      })
      .sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
    if (sameSec.length > 0) {
      const [targetFullKey, targetEntry] = sameSec[0];
      const tHead = targetFullKey.trim().split(/\s+/).slice(2).join(' ');
      suggestions[ieRow.key] = {
        targetHead: tHead,
        targetKey: targetFullKey,
        reason: `Largest in section → ${tHead} (${(targetEntry.hours ?? 0).toFixed(0)}h)`,
      };
    }
  }
});
```

### Change 2: Add `inExportRows` to the useMemo dependency array

Add `inExportRows` to the dependency array of `standaloneAutoSuggestions` (line 1768).

### Change 3: Update autoInitRow for in-export context

The `autoInitRow` function (line 1800) currently only looks up rows in `smallCodeAnalysis`. When called from the "In Export" view's Select All or individual checkbox, it needs to also handle `inExportRows` entries that aren't in `smallCodeAnalysis`:

```typescript
const autoInitRow = (key: string) => {
  const row = smallCodeAnalysis.find(r => r.key === key);
  // If not in smallCodeAnalysis, still apply suggestion for in-export rows
  if (!row) {
    if (standaloneAutoSuggestions?.[key]?.targetHead) {
      setReassignTargets(prev => ({ ...prev, [key]: standaloneAutoSuggestions[key].targetHead }));
    }
    return;
  }
  // ... existing logic
};
```

## Safety

- **No orphans**: Same proven pathways — `__accepted__` early-returns, peer-merge accumulates-and-deletes
- **No duplicate keys**: Deduplication fix already in place for rendered rows
- **No hour drift**: Suggestions are just dropdown pre-selections; actual hour movement uses the same reassign logic

