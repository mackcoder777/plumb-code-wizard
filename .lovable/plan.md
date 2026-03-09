

## Fix: Custom Fab Codes Not Persisting Between Sessions

### Root Cause

The `customFabCodes` persist effect (line 447-449) has **two bugs**:

1. **Missing `'default'` guard** — Every other persist effect in this file checks `if (projectId !== 'default')` before writing to localStorage. The custom fab codes effect does not, so it writes stale/empty data under `budget_custom_fab_codes_default`.

2. **Race condition on projectId change** — When `projectId` changes (e.g., from `'default'` to a real ID), this persist effect fires with the **old state** + **new projectId** before the reload effect (line 457) runs. This **overwrites** the previously saved custom fab codes for that project with empty data `{}`.

This is the same pattern every other setting avoids by guarding with `projectId !== 'default'`, but that alone doesn't fully fix the race. A proper fix also needs to skip persisting during the reload transition.

### Fix — `src/components/BudgetAdjustmentsPanel.tsx`

**Lines 447-449**: Replace the unguarded persist effect with one that matches the pattern used by all other settings, plus add a transition guard:

```typescript
useEffect(() => {
  if (projectId !== 'default' && projectId === prevProjectId) {
    localStorage.setItem(`budget_custom_fab_codes_${projectId}`, JSON.stringify(customFabCodes));
  }
}, [customFabCodes, projectId, prevProjectId]);
```

The `projectId === prevProjectId` check ensures we only persist when the user actually changes custom fab codes — not when the projectId itself is transitioning (which is when the reload effect is about to restore the correct saved values).

### Why This Works
- On initial mount with `projectId = 'default'`: skipped (guard)
- When projectId transitions from 'default' to real ID: skipped (`projectId !== prevProjectId`), so the reload effect restores saved data without it being overwritten
- When user adds a custom code (projectId stable): persists normally

### Single file change
- `src/components/BudgetAdjustmentsPanel.tsx` — lines 447-449 only

