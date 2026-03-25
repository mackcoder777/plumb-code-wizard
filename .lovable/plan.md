

# Expand Auto-Resolve Suggestions for Standalone Codes

## Summary
Add two new suggestion rules so that above-grade system codes and override codes get auto-resolve suggestions instead of blank dropdowns.

## Changes — single file: `src/components/BudgetAdjustmentsPanel.tsx`

### 1. Above-grade codes → suggest `__accepted__`

In `standaloneAutoSuggestions` useMemo (~line 1701), replace the bare `return;` for `ABOVE_GRADE_SYSTEM_CODES` with an `__accepted__` suggestion:

```typescript
if (ABOVE_GRADE_SYSTEM_CODES.has(head)) {
  suggestions[entry.key] = {
    targetHead: '__accepted__',
    targetKey: '',
    reason: 'Above-grade system code — accept as standalone',
  };
  return;
}
```

**Safety**: `__accepted__` is caught by the existing early-return guard at line 1409 — hours are untouched, no deletion, no orphan.

### 2. Override codes → suggest largest same-section peer

After the system-inference block (~line 1739), add a fallback for codes still without suggestions:

```typescript
if (!suggestions[entry.key]) {
  // Find largest code in same section as peer-merge target
  const sameSec = Object.entries(finalLaborSummary)
    .filter(([k]) => {
      const p = k.trim().split(/\s+/);
      return p[0] === sec && p.slice(2).join(' ') !== head;
    })
    .sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
  if (sameSec.length > 0) {
    const [targetFullKey, targetEntry] = sameSec[0];
    const tHead = targetFullKey.trim().split(/\s+/).slice(2).join(' ');
    suggestions[entry.key] = {
      targetHead: tHead,
      targetKey: targetFullKey,
      reason: `Largest in section → ${tHead} (${(targetEntry.hours ?? 0).toFixed(0)}h)`,
    };
  }
}
```

**Safety**: Uses existing reassign pathway (line 1413-1449) which accumulates hours into target and deletes source — proven pattern, no orphans.

### 3. UI — render "Accept" label for `__accepted__` suggestions

In the suggestion lightning-bolt display (~line 4145-4160), add a condition: if `suggestion.targetHead === '__accepted__'`, show "⚡ Accept as-is" instead of "⚡ → {targetHead}".

### 4. autoInitRow — already handles this

`autoInitRow` (line 1779) already sets `reassignTargets[key] = suggestion.targetHead` for any suggestion including `__accepted__`. No change needed.

## Safety Confirmation
- **No orphans**: `__accepted__` triggers early-return preserving all keys; peer-merge uses proven accumulate-delete pattern
- **No duplicate keys**: Deduplication fix already in place for rendered rows
- **No hour drift**: `__accepted__` doesn't modify hours; peer-merge is a simple sum transfer

