# PR 3 End-to-End Verification

## Confirmed current state

- Fresh uploads are written in 500-row batches. Every insert batch returns `id` and `row_number`, and `useSaveEstimateItems` accumulates those values into one `Map<number, string>` across the full mutation.
- `stampIds` rejects an incomplete map before changing any row, then stamps each in-memory row from the UUID stored under its zero-based position.
- Both fresh-upload and Replace Data paths call `stampIds`; neither currently logs the sent count, returned count, or abort result in one structured diagnostic.
- Material assignment writes by UUID through `useBatchUpdateMaterialCostCodes`, so a successful assignment after a fresh upload directly exercises the hydrated IDs.
- The Hamilton-size multi-batch upload and material-assignment-survives-reload checks have not yet been completed. The prior 13k-row run reached no item POSTs because the main thread remained occupied before persistence began; that run was inconclusive for PR 3 but is a reproducible input for a separate performance investigation.

## Change 1 — add narrow stamping instrumentation

- Add a single structured `console.info('[stampIds]', { sent, returned, aborted })` diagnostic inside `stampIds`.
- Emit it on both success and integrity-abort paths, using the actual row and map sizes rather than inferred request counts.
- Keep the helper’s return values and abort behavior unchanged; this is diagnostics only.

## Verification 1 — Hamilton multi-batch upload

- Upload the real Hamilton 12,846-row AutoBid export through the normal fresh-project flow.
- Wait for persistence to finish rather than inferring completion from the early upload UI.
- Confirm 26 item insert batches complete and the diagnostic reports exactly:
  - `sent: 12846`
  - `returned: 12846`
  - `aborted: false`
- Confirm the loaded in-memory rows use database UUIDs and no `stampIds` mismatch/gap error appears.
- If the diagnostic reports an abort, stop there, preserve the logs, and do not attempt a material assignment with partially hydrated IDs.

## Verification 2 — material assignment survives reload

- In the freshly uploaded Hamilton project, choose one identifiable material group or item and record its current code plus a stable source fingerprint such as row number, material spec, item type, and description.
- Assign a different valid material code through the Material Mapping tab and confirm the update request succeeds and returns the expected affected row count.
- Reload the project from the backend, locate the same source item/group, and confirm the assigned material code remains present.
- Query the persisted row by project and UUID/row number to verify the UI result matches the database value.

## Regression checks

- Confirm the upload row count, total material dollars, and total labor hours are unchanged after UUID stamping.
- Run the project QC checks: labor totals reconcile, no sentinel keys appear, and mapping/export behavior is unchanged.
- Remove or DEV-gate the temporary diagnostic after evidence is captured so production consoles are not permanently noisy.

## Explicitly separate follow-up

- Do not optimize parsing or processing in this PR. Preserve the 13k-row reproduction and investigate the minutes-long pre-network main-thread block as a dedicated performance task after PR 3 verification.
- Keep the remaining queue unchanged: empty upload filename, user-scoped project query key, real `rowNumber` cleanup, append invalidation-key consistency, and upload completion/recovery restructuring.

## Files

- `src/hooks/useEstimateProjects.ts` — diagnostic only.
- No production behavior changes are planned unless the end-to-end run exposes a concrete failure.
