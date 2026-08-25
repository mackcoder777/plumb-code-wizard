# Diagnose fresh-upload project creation and verify UUID hydration

## Confirmed current state

- The affected account currently owns zero projects, so the upload shown did not create a database project.
- Fresh upload puts parsed rows into memory before project creation. Item persistence and `stampIds` run only from the create mutation's `onSuccess`; therefore this session did not exercise PR 3.
- The create call has no `onError`, while the mutation throws both auth and database errors. A create failure is therefore invisible in the UI.
- The project insert supplies `user_id`, `name`, `file_name`, and `total_items`. All other non-null columns have database defaults, and the insert policy checks `auth.uid() = user_id`. Neither the schema nor the policy alone identifies the observed failure.
- The available request snapshot contains project-list GETs only; it does not include the failed create POST. The exact failure remains unconfirmed until a fresh upload is captured.

## Change 1 — expose project-creation failures

- Add an `onError` callback to the fresh-upload `createProject.mutate` call.
- Log the complete error for diagnostics and show a destructive notification containing its safe code/message.
- Reset the upload loading state/progress so a failed create does not look successful or leave the workflow stuck.
- Do not call `saveItemsToDb`, report upload success, or navigate to Estimates after project creation fails.

## Change 2 — make upload completion reflect persistence

- Move the fresh-upload completion state, success notification, and Estimates navigation into the successful create → item save → UUID hydration path.
- Make `saveItemsToDb` return an explicit result so its currently caught item-save failure cannot be followed by a generic “Successfully loaded” message.
- Preserve the existing fail-closed hydration behavior: a complete insert with an incomplete UUID response keeps the rows unhydrated and tells the operator to reload before material assignment.
- Keep the existing selected-project/Replace Data behavior unchanged except where the shared save result is required to prevent false success.

## Verification

1. Re-upload the same 1,944-row file while signed in to the zero-project account.
2. Capture the `POST /estimate_projects` status and response body plus the related console error. Use that evidence to fix the actual auth, policy, grant, or payload problem only if one is confirmed.
3. On success, verify the header changes from “No project selected” to `ABMC-RR-RAW-2277-BB-2` and the account has exactly one new project.
4. Verify 1,944 item rows were inserted with contiguous `row_number` values from 0 through 1,943.
5. Verify all 1,944 in-memory item IDs are UUID strings, array order is unchanged, and no hydration warning appears.
6. Assign one material code and confirm exactly one successful database mutation; reload and confirm the assignment persists.
7. Failure-path regression: force or reproduce a project-create failure and confirm one actionable error notification appears, no item insert runs, no success notification appears, and the app does not navigate as if the upload persisted.
8. Run the project QC checks: labor-hour totals unchanged, no sentinel keys, and no mapping or export behavior changed.

## Files

- `src/pages/Index.tsx` — create error handling, persistence-aware completion flow, and loading-state cleanup.
- `src/hooks/useEstimateProjects.ts` — only if an explicit typed save result is needed; no database behavior change unless the captured POST proves one is required.