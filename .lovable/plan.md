# Section Rollup + Threshold Unification — Corrected Plan

**Correction from prior plan:** Task 1 has been reworded. The previous "Add section-act guard" framing implied an `act === '0000'` filter on the detector. That violates Rule E (universal applicability) — it works for Pasadena (whose small buckets happen to be `0000`) but breaks level-split projects (`1M 01BA`, `2M 02BA`) the moment they produce multi-head small buckets. The correct invariant is at the **target dropdown**, not the detector.

---

## Verified source citations (re-confirmed this turn)

**`src/components/BudgetAdjustmentsPanel.tsx:1567–1604`** — Stage 3 reassign branch:
- Line 1572: `Object.keys(result).find` matches by `sec` + `head` only — **activity code is not part of the match key**.
- Line 1580: if any key in the section has the target head (any ACT), source keys collapse into it.
- Line 1593: hardcoded `${sec} 0000 ${effectiveTargetHead}` fall-through — only fires when no key in the section has that head.

**Implication:** If the Section Rollup target dropdown is constrained to heads already present in the bucket, line 1572 always matches → line 1593 is unreachable → no act filter needed. Same-act preservation is automatic because the matched target key is the existing bucket member.

---

## Tasks (5 total — Task 1 corrected, others unchanged)

### Task 1 (CORRECTED): Constrain Section Rollup target to bucket heads

**Invariant:** The target-head dropdown for any Section Rollup card must be populated **only from the cost heads already present in that `sec|act` bucket**. No free-text input. No heads from other buckets. No heads from other sections.

**Why this is the right invariant:**
- With this constraint, `Object.keys(result).find` at line 1572 always succeeds — the target key is, by construction, an existing bucket member.
- Line 1593's hardcoded-`0000` fall-through becomes unreachable for Section Rollup writes.
- Works universally for any `sec|act` bucket: `1M 0000`, `1M 01BA`, `B2 00L3`, etc. No activity-code restriction.
- Preserves the source bucket's ACT automatically because the target lives in the same bucket.

**Do NOT implement:** Any `act === '0000'` filter on the detector. Any `act` parameter in the reassign payload. Any "both for safety" combination of dropdown constraint + act filter — the dropdown constraint alone is sufficient and correct.

**UI implementation:**
- Section Rollup card lists heads in the bucket sorted by hours descending.
- Dominant head pre-selected as default target.
- Dropdown options = the other N-1 heads in the same bucket. The dominant head is the implicit target; the dropdown picks an alternate if the PM disagrees.
- Save writes N-1 reassign records to `project_small_code_merges`, each with `sec_code = bucket sec`, `cost_head = source head`, `reassign_to_head = target head`. No `act` field needed in the payload.

### Task 2: Resolve Standalone overlap — Section Rollup as visualization layer

Section Rollup card displays the bucket grouping. The underlying Standalone rows for those heads remain visible in the Standalone tab. Saving a Section Rollup proposal writes the same reassign records that an individual Standalone reassign would write — there is exactly one persistence path. PMs see both the grouped view and the per-row view; only one of them needs to be acted on (whichever is more convenient).

### Task 3: Prevent Job-Wide double-saves

Section Rollup detector skips any `sec|head` already saved as a Job-Wide merge (records where `merged_act === '__JOBWIDE__'`). Prevents proposing a section-level fold for a head that's already been folded job-wide.

### Task 4: Unify dashboard thresholds

Fold the hardcoded `200` in `CodeHealthDashboard.tsx:225` into a `sectionWarningThreshold` field. All thresholds (line floor, section bucket, section warning, job-wide) live in a single object passed as props from the Budget tab parent. No per-component `useState`.

### Task 5: Seed thresholds on first load

Silent one-shot migration: on first load post-deployment, if `consolidation_thresholds` is null in `project_budget_settings`, read existing localStorage values (if any) and write them to the DB, then clear the localStorage entry. After this loop, all reads/writes go through `useBudgetSettings`. No PM-visible toast.

---

## Phase 4 (auto-resolve copy update) — unchanged

Auto-resolve handler updated to surface "Section Rollup available for this bucket" hint when a code with no deterministic fallback chain is part of a multi-head small bucket. Does not auto-write — surfaces the option in the inline hint, PM clicks through to the Section Rollup card.

---

## Acceptance criteria

1. Pasadena: `1M 0000` (5 heads, 18h) appears as a single Section Rollup card with the dominant head pre-selected. Saving produces 4 reassign records, all heads collapse into the dominant target, line 1593 fall-through is **not** triggered (verifiable via `import.meta.env.DEV` log).
2. Hypothetical level-split project with `1M 01BA` (4 heads, 22h): same card structure, same save behavior, target ACT = `01BA` (preserved automatically), line 1593 not triggered.
3. `CodeHealthDashboard` reads `sectionWarningThreshold` from props; no hardcoded `200`.
4. Both `JobWideConsolidation` and `BudgetAdjustmentsPanel` read thresholds from `useBudgetSettings.consolidation_thresholds`. Changing a threshold in one updates the other.
5. localStorage `minHoursThreshold` key absent after first load; DB row present.
6. No `sec|head` appears in both a Section Rollup card and an active Job-Wide merge.

---

## Out of scope (deferred to separate loops)

- **Phase 5** (unify Job-Wide and Section Rollup engines): merge-record schema differences make this a regression risk on already-saved consolidations. Both detectors will read from the unified threshold object so thresholds don't drift, but the detectors remain parallel implementations.
- **Open Item 7** (silent batchUpdateSilent failures): tracked separately.

---

## Loop closure (partial — 2026-04-25 session 2)

### Shipped
- **Task 4 (threshold unification)** — `ConsolidationThresholds` interface added to `BudgetAdjustmentsPanel`. `CodeHealthDashboard` and `JobWideConsolidation` now read thresholds from props (passed from `Index.tsx` via `budgetAdjustments.consolidationThresholds`). Hardcoded `200`/`40`/`160` removed; `useState` thresholds in dashboards eliminated.
- **Task 5 (seed migration)** — Legacy `localStorage.smallCodeMinHours` reads on first auto-migration cycle, seeds DB `consolidation_thresholds` setting, removes the localStorage key. Subsequent loads use DB exclusively.
- `useBudgetSettings.SETTINGS_KEYS` extended with `'consolidation_thresholds'`.
- DB save effect added (debounced 500ms, same pattern as other settings).

### Not yet implemented (deferred to next loop)
- **Task 1 (Section Rollup detector + UI)** — design locked: useMemo keyed by `sec|act`, target dropdown constrained to bucket heads (Rule E preserved, no act filter). UI adds new tab in Small Code Review.
- **Task 2 (Standalone overlap)** — Section Rollup save will write the same reassign records as individual Standalone reassigns; no new persistence path needed. Visualization layer only.
- **Task 3 (Job-Wide skip)** — detector filters out any sec|head with an existing `__JOBWIDE__` merge record.

### Architectural notes for next loop
- The Stage 3 reassign branch at `BudgetAdjustmentsPanel.tsx:1567-1604` is verified safe to reuse: line 1572's target match ignores act, line 1593's hardcoded `0000` fall-through is unreachable when target dropdown is constrained to existing bucket heads.
- `currentAdjustments` in `BudgetAdjustmentsPanel` now exposes `consolidationThresholds` to `Index.tsx`; passing them down to dashboards is wired via callback props that mutate `budgetAdjustments` state. The panel's own DB load/save effect handles persistence.

### Open Items still pending
- **Open Item 7** — silent batchUpdateSilent failures (toast + banner pattern).
- **Open Item 5** — three-extractor consolidation (`extractMultitradeLevelPrefix` × 2 + `extractLevelPrefixForSummary`).
- **Open Item 6** — format-logging during export.
- **Phase 5** — unify Job-Wide and Section Rollup engines (deferred to separate loop, schema reconciliation risk).
