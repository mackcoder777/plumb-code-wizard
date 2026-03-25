

## Plan: Add diagnostic console.logs to finalLaborSummary

Three `console.log` statements added at precise locations in the `finalLaborSummary` useMemo:

### Log 1 — After section alias normalization (after line 1183)
After the `Object.entries(summary).forEach(...)` block that normalizes numeric sections to canonical (e.g. "2" → "B2"), before the fallback folding block starts at line 1185.

### Log 2 — After fallback folding (after line 1259)
After the `fallbackKeys.forEach(...)` block completes and before the `if (!savedMergesData?.length) return result;` guard at line 1261.

### Log 3 — After redistributes applied (after line 1411)
This one is trickier — the redistribute block is inside a `remappedMerges.forEach(...)` loop. The log needs to go after the entire loop completes, not inside the redistribute branch. Need to check where the forEach ends.

Actually, since the user wants to see the state after ALL redistributes have been applied, the log should go after the entire `remappedMerges.forEach(...)` loop ends. Let me find that line — it's around line 1480-1500 based on prior context.

### Implementation

**File**: `src/components/BudgetAdjustmentsPanel.tsx`

**Edit 1** — Insert after line 1183 (end of alias normalization loop):
```typescript
    console.log('[12 SPCL after alias normalization]', 
      Object.entries(result)
        .filter(([k]) => k.startsWith('12') && k.includes('SPCL'))
        .map(([k,v]) => ({k, hours: (v as any).hours}))
    );
```

**Edit 2** — Insert after line 1259 (end of fallback folding), before line 1261:
```typescript
    console.log('[12 SPCL after folding]',
      Object.entries(result)
        .filter(([k]) => k.startsWith('12') && k.includes('SPCL'))
        .map(([k,v]) => ({k, hours: (v as any).hours}))
    );
```

**Edit 3** — Insert after the `remappedMerges.forEach(...)` closing `});` (need to confirm exact line), before the final `return result;`:
```typescript
    console.log('[12 SPCL after redistributes]',
      Object.entries(result)
        .filter(([k]) => k.startsWith('12') && k.includes('SPCL'))
        .map(([k,v]) => ({k, hours: (v as any).hours}))
    );
```

No logic changes — diagnostic only.

