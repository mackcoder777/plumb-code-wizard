# PR 3 — Step 0 result and the verification run

## Step 0: `.env` is clean

The committed `.env` has exactly five lines: the project URL, the project ID, and the publishable (anon) key — duplicated under both a `VITE_`-prefixed and unprefixed name. No `service_role` key, nothing named `SECRET`, no database password. The anon key is meant to ship in the client bundle and is protected by row-level security. Nothing to rotate.

## Instrumentation is already in place

The `[stampIds]` diagnostic exists in `src/hooks/useEstimateProjects.ts` and fires on every exit path — count mismatch, missing row, and success — reporting `sent`, `returned`, and `aborted`. It is deliberately not DEV-gated, so it appears in the preview build. Both the fresh-upload path and the Replace Data path route through it. No code change is needed before the run.

## The run

Executed against the preview, signed in as the normal account:

1. Clear `lastSelectedProjectId` from local storage so the upload takes the fresh-project path, not the append path.
2. Reload to the "No project selected" state.
3. Upload the 1,944-row ABMC file and wait through the parse block before network activity begins.
4. Read the single `[stampIds]` console line.

Expected: `sent: 1944`, `returned: 1944`, `aborted: false`.

If `aborted: true`, stop before assigning anything and report both counts — a short `returned` names the dropped batch, and assigning against partially hydrated IDs would write to the wrong rows.

## Second half — assignment survives reload

5. In Material Mapping, record one item's row number and material spec, then assign a different valid material code.
6. Confirm the update request succeeds.
7. Reload the project and locate the same item by that fingerprint; confirm the code persisted.
8. Cross-check the persisted row in the database so the UI value and stored value agree.

## Notes

- 1,944 rows is four insert batches at 500 per batch, so this does exercise the multi-batch assembly, though not at Hamilton's 26.
- The parse-phase main-thread block stays a separate performance investigation; slowness during this run is expected and is not a failure signal.
- Queue behind this is unchanged: empty upload filename, user-scoped project query key, real `rowNumber` cleanup, append invalidation-key consistency, and the completion/recovery restructure.
