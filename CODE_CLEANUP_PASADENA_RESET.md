# Pasadena verification reset

Use this once **before** the first verification round on Pasadena to clear
inconsistent rows left over from the whack-a-mole cycling. After this runs,
the Code Cleanup tab on Pasadena should mount with zero committed Step 1 /
Step 2 / Step 3 decisions and zero redistributions, so iterative-Apply
verification starts from a clean baseline.

Project ID: `66ba29b2-f8de-4bdd-a098-0c13264eefa8` (PASADENA CENTRAL LIBRARY)

## SQL — paste into the Lovable Cloud SQL editor

```sql
-- Clear all Code-Cleanup-authored merges for Pasadena.
-- Legacy / non-cleanup merges (operation_type IS NULL) are preserved.
DELETE FROM project_small_code_merges
WHERE project_id = '66ba29b2-f8de-4bdd-a098-0c13264eefa8'
  AND operation_type IN (
    'pool_to_40',
    'reroute_global',
    'fold_to_plmb',
    'combine_sections',
    'cleanup_reroute',
    'cleanup_custom'
  );

-- Clear all hour redistributions for Pasadena.
DELETE FROM project_hour_redistributions
WHERE project_id = '66ba29b2-f8de-4bdd-a098-0c13264eefa8';
```

## Verification protocol after reset

1. Reload the Pasadena project. Open Code Cleanup tab.
2. Confirm: Step 1 cards show no radio selected, Step 2 cards show no fold
   chosen, Step 3 list is fresh. Footer shows `0 pending decisions`.
3. **Round 1**: choose a few Step 1 decisions (mix of pool / reroute /
   keep_distributed / custom) + one Step 2 fold. Click Apply All.
4. After the toast, **reload the page**. Code Cleanup should re-open with
   exactly the Round 1 selections still active (radios filled in, Step 2
   target preserved, hidden Step 3 rows still hidden, surfaced Step 3 rows
   still surfaced).
5. **Round 2**: make additional decisions on top of Round 1's persisted
   state. Apply All again. Reload. Both rounds should be visible.
6. Confirm Hour Reconciliation strip stays at the same drift across rounds —
   no compounding loss.

If round 2 shows whack-a-mole again, capture: (a) the network response from
the `cleanup-merges` query, (b) which decisions came back vs vanished,
(c) browser console for any hydration errors. The hydration hook orphan rule
ignores rows whose `cost_head` no longer appears in detection candidates —
if a head moves out of the candidate set between rounds, its decision will
not re-hydrate (this is by design, not a bug).