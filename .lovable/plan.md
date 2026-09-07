# Repair the two malformed storm-drain mappings

## Step 1 result (already run, read-only)

Both preconditions from `docs/repair-corrupt-cost-heads.sql` hold:

| project | system | current value | proposed | materialCode present |
| --- | --- | --- | --- | --- |
| Estimate 8/25/2026 | bg storm drn | `{"laborCode":"STRM"}` | `STRM` | none |
| Estimate 8/25/2026 | overflow drn. | `{"laborCode":"STRM"}` | `STRM` | none |

Exactly 2 rows. Both propose a plain `STRM`. Neither carries a `materialCode`, so
the `material|labor` pipe form does not apply and nothing is discarded by the
update. Step 2's broader shape sweep returns the same 2 rows and nothing else —
no array-shaped, padded, or empty values anywhere in `system_mappings`.

## What to do

Run the step 3 update from `docs/repair-corrupt-cost-heads.sql` verbatim, with
its three guards intact:

- `jsonb_typeof(...) = 'object'` — never touches a plain string cost head
- `->> 'laborCode' IS NOT NULL` — never writes NULL over a real value
- `btrim(...) <> ''` — never writes an empty or padded value

Expected result: 2 rows updated. Anything else means stop and re-survey.

Then re-run the step 4 confirmation, which must return 0 rows, and the banner in
the app clears on next load.

## Scope

- Data only. No code changes — PR #6 already removed the producer and PR #7
  already made the banner report-only, both of which are on main.
- The 14 rows holding a bare `STRM` are untouched. `STRM` is a legitimate cost
  head for storm drain and overflow; those rows are not corrupt.
- Republishing to clear the stale published bundle is separate from this repair
  and can follow once the Lovable API is healthy.

## Technical detail

```sql
UPDATE system_mappings
SET cost_head = btrim(cost_head::jsonb ->> 'laborCode'),
    updated_at = now()
WHERE cost_head LIKE '{%'
  AND jsonb_typeof(cost_head::jsonb) = 'object'
  AND cost_head::jsonb ->> 'laborCode' IS NOT NULL
  AND btrim(cost_head::jsonb ->> 'laborCode') <> '';
```

Affects `system_mappings` rows `30b90609-f7f2-47e2-aee6-84a4ef8e1042` and
`a61880f9-68ad-4ce1-8c04-cfd9f2892a1a`, both in project
`cba6b129-fbd7-4b3d-a673-90b4f23263a1`.
