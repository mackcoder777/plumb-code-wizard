# Blank Estimates screen on the published app

## What you're seeing

The project header says "Estimate 9/7/2026 — 1944 items", but the area under the
tabs is completely empty. That count comes from the project record; the line items
themselves are fetched separately and had not arrived (or never arrived) in the
screen's memory when the screenshot was taken.

The Estimates tab is the only tab with no "nothing here yet" state. Every other tab
(Labor Mapping, Material Mapping, Budget Builder) shows a friendly placeholder card
when no items are loaded. The Estimates tab renders only when items are present and
otherwise renders nothing at all — which is exactly a blank page. So whatever the
underlying cause, the blank screen is guaranteed to look like a broken app rather
than a state you can act on.

Two things can leave the items unloaded, and they need different fixes. Which one it
is has not been confirmed yet, so confirming comes first.

## Step 1 — Confirm the cause (no code changes)

- Check whether the published site is running an older build than the editor
  preview. The same account and project load correctly in the preview, so a stale
  published build is the leading candidate. If so, the fix is to publish the current
  version.
- If the published build is current, sign in on the published site as the same user
  and capture the browser console. The item load prints progress lines; the specific
  line that appears (or the absence of all of them) tells us whether the fetch was
  blocked, returned zero rows, or was deferred waiting on mapping data.

Nothing below assumes an answer to Step 1; it is worth doing either way.

## Step 2 — Never show a blank screen again

Give the Estimates tab the same treatment the other tabs already have:

- While the items are still being fetched: a "Loading your estimate…" state in the
  content area (today there is only a small floating pill at the top of the window,
  easy to miss).
- When the fetch has finished and there are still no items, but the project claims a
  non-zero count: a clear message saying the items could not be loaded, with a Retry
  button that refetches.
- When the project genuinely has no items: the same "Upload an estimate file first"
  placeholder the other tabs use.

## Step 3 — Surface a load failure instead of swallowing it

If the item fetch errors, the screen currently falls back to the empty state with no
message. Show the failure as a toast and in the retry card so it is visible and
reportable.

## Technical notes

- `src/pages/Index.tsx:2919` — `{activeTab === 'estimates' && estimateData.length > 0 && (...)}`
  has no else branch. Add the three-way state (loading / error-or-empty-with-retry /
  no-data placeholder) using `itemsLoading` from line 747 and the project's own item
  count.
- `useEstimateItems` (`src/hooks/useEstimateProjects.ts:412`) already exposes query
  state; surface `isError`/`error` and `refetch` alongside `isLoading` to Index.
- The hydration effect at `Index.tsx:1153` defers on `floorMappingsFetched`,
  `mappingsFetched`, and `materialDescOverridesFetched`. If Step 1 shows a permanent
  deferral, the fix belongs there instead — add a timeout fallback so a never-resolving
  dependency cannot strand the screen forever.
- No database or business-logic changes; presentation and query-state plumbing only.
