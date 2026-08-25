# Diagnose fresh-upload project creation

## Confirmed current state

- The affected account currently owns zero projects, so the upload shown did not create a database project.
- Fresh upload puts parsed rows into memory before project creation. Item persistence and `stampIds` run only from the create mutation's `onSuccess`; therefore this session did not exercise PR 3.
- The create call has no `onError`, while the mutation throws both auth and database errors. A create failure is therefore invisible in the UI.
- The project insert supplies `user_id`, `name`, `file_name`, and `total_items`. All other non-null columns have database defaults, and the insert policy checks `auth.uid() = user_id`. Neither the schema nor the policy alone identifies the observed failure.
- The available request snapshot contains project-list GETs only; it does not include the failed create POST. The exact failure remains unconfirmed until a fresh upload is captured.

## Change 1 — expose project-creation failures

- Add an `onError` callback to the fresh-upload `createProject.mutate` call.
- Log the complete error for diagnostics and show a destructive notification containing its safe code/message.
- Do not call `saveItemsToDb` after a create failure; it already lives only inside `onSuccess`.
- Leave the existing completion block (`setLoading(false)`, `setActiveTab('estimates')`, success notification) where it is. Because `createProject.mutate` is fire-and-forget, that block runs before the POST response returns. The error notification will overwrite the success notification once the POST fails, and the console will hold the full error for reading.

## Deferred until after capture

- Do not restructure upload completion in this diagnostic patch. The unconditional completion/success path is a confirmed bug, but changing it before capturing the failed create could alter the behavior being observed.
- After the POST error is known, define the smallest persistence-aware completion fix separately; moving completion into `onSuccess` may be sufficient.
- Investigate upload slowness separately. Classify it first as idle render activity, upload-time worker/computation, or interaction-time derivation using Network, console, and a Performance recording. Do not combine a performance fix with this diagnostic patch.

## Verification

1. Re-upload the same 1,944-row file while signed in to the zero-project account.
2. Capture the `POST /estimate_projects` status and response body plus the related console error. Use that evidence to fix the actual auth, policy, grant, or payload problem only if one is confirmed.
3. Confirm the new error notification includes the same safe code/message as the failed POST and the full error is available in the console.
4. Confirm `saveItemsToDb` and `stampIds` do not run after the create failure.
5. Separately classify slowness without changing code: slow while idle with quiet Network, slow only during upload, or slow only on tab/filter interaction.
6. Run the project QC checks: labor-hour totals unchanged, no sentinel keys, and no mapping or export behavior changed.

## Files

- `src/pages/Index.tsx` — create error handling and loading-state cleanup only.