

## Status: Hour Discrepancy Analysis

### What happened

The **no console warnings** after refresh confirms the merge-application fix is active — `finalLaborSummary` has zero hour drift. The 468.5h gap you saw (28,085.7 → 27,617.2) was from the **previous export before the fix was deployed**.

### Expected math now

With the fix in place, the export should show:

```text
Raw estimate hours:          28,085.7
Foreman Bonus Strip (1%):     −280.9  (stripped from field, becomes FCNT material line)
Fab Strips:                      0.0  (moved between field→fab, both in total)
Merge application drift:         0.0  (fixed — reconciliation confirms <0.1h)
                             --------
Expected export total:       ~27,804.8 hours
```

### What to do

**No code changes needed.** Just re-export the budget now (the fix is already live) and confirm the total labor hours in the Excel are approximately **27,804.8** (28,085.7 × 0.99).

If the number still shows 27,617.2 after a fresh export, then there's a separate issue and I'll need to dig deeper into the `adjustedLaborSummary` calculation. But based on the zero-drift reconciliation, the export should now be correct.

### One thing to verify

Open the Budget Builder tab and check the summary section — it should show:
- **Total Field Hours**: ~27,804.8 minus fab strip hours
- **Total Fab Hours**: the fab strip portion
- **Field + Fab**: ~27,804.8 total
- **Foreman Bonus Hours**: ~280.9

If Field + Fab + Foreman ≈ 28,085.7, everything is reconciled.

