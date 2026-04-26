# Murray Budget Manager — Code Cleanup Tab Spec

**Date:** April 25, 2026
**Status:** Design locked, ready for implementation
**Replaces:** Section Rollup detector + tab (the design previously specified in `.lovable/plan.md`)

---

## 1. Context and motivation

The current Murray Budget Manager surfaces small-code consolidation work across **seven separate UI surfaces**, each fronted by its own detector with mismatched grouping keys:

1. Cross-Section Consolidation Candidates (collapsible row inside Code Health card)
2. Section Breakdown ⚠ triangles (Code Health, no action)
3. Job-Wide Consolidation panel (separate panel below Code Health)
4. Merge Groups tab (inside Small Code Review)
5. Standalone Codes tab (inside Small Code Review)
6. Round 2 residuals yellow banner (inside Small Code Review)
7. Auto-resolve button (inside Small Code Review)

Each one solves a slice of the same domain problem — "this code or section is too small to track at this granularity." A PM working through cleanup must scan all seven, mentally reconcile what each one is telling them, and hop between surfaces to take action. Adding an eighth surface (the originally-planned Section Rollup tab) would make this worse, not better.

This spec replaces all seven surfaces with **one top-level tab named Code Cleanup** organized as a three-step PM workflow. The original Section Rollup design — and specifically its "constrain target dropdown to existing bucket heads" architectural invariant — is **inverted by this spec** for reasons documented in §10.

---

## 2. Goals

1. **One surface for one domain problem.** A PM looking at small-code work sees one tab with one workflow. No tab-hopping, no detector-jargon, no "where do I act on this?"
2. **Field consistency is the dominant rule.** A cost head's destination must be the same project-wide. The UI enforces this at the structural level — a global head decision is made once, applied everywhere, and the field sees one consistent rule.
3. **PM judgment, not algorithmic correctness.** Surface candidates with full project context, offer the four operations as options, allow custom routing. Don't auto-decide. The product is good judgment, not optimal-by-some-metric output.
4. **No regression on existing reconciliation.** Every consolidation operation preserves total hours; audit trail captures provenance for any future "where did this 107h come from?" question.

---

## 3. Non-goals (explicit)

- **Level-splitting (e.g., `PL 0105 SNWV`, `PL 0610 SNWV`).** This is a **decomposition** operation that breaks one big cost head into level-range lines for granular tracking. It only applies when a cost head exceeds 500–1000h. It is architecturally separate from consolidation and out of scope for this tab.
- **HVAC support.** Spec assumes plumbing trade.
- **Multi-trade combined budgets.**
- **Auto-resolve as a first-class feature.** See §11.

---

## 4. Domain rules

These rules emerged from PM walkthrough and supersede prior assumptions:

### 4.1 The four consolidation operations

| Operation | What it does | Example |
|---|---|---|
| **Fold to PLMB** | Tiny section's heads collapse into one generic plumbing labor line. Cost head dimension dies inside that section. | `1M 0000 [WATR + PIDV + SNWV + STRM + SLVS]` → `1M 0000 PLMB` |
| **Pool to 40** | Same head spread across sections collapses to `40 0000 [head]`. Section dimension dies, head preserved. | `1M / 2M / L2 / BG / LL DRNS` → `40 0000 DRNS` |
| **Reroute globally** | Head A's hours absorbed into head B project-wide. | `COND → WATR` everywhere |
| **Redistribute within section** | Pull hours from a peer head in the same section to bump a small head over the floor. Section total unchanged, distribution rebalanced. | `L2 0000 DRNS 2h` becomes `L2 0000 DRNS 8h` by transferring 6h from `L2 0000 FNSH` (which drops 9h → 3h). |

### 4.2 The dominant rule: field consistency

A cost head's destination must be the same project-wide. The field cannot have DRNS landing in PLMB on one floor and `40 0000 DRNS` on another — there's no way to write a scope note that field crews can act on consistently. This rule drives the workflow ordering (global head decisions first, before section folds).

### 4.3 The "field communication" test

When combining sections (1M + 2M → MZ), the criterion is not hours or section type — it is: **can the PM write a clear scope note that field crews understand?** Three tiny buildings can fold together if their work is similar enough that one code covers them; if not, they stay separate. The combined section name is PM-invented (MZ for "mezzanine," not a fixed lookup).

### 4.4 Per-line floor: 8–16h (default 12)

Any line below this is a candidate for consolidation. Above this, leave alone. The floor is a signal that surfaces candidates — whether to act on each one is judgment, not automatic.

### 4.5 Acceptable noise

A line below the floor is **not always actionable**. If the line lives in a healthy section (where other heads are large) AND the head isn't pattern-matching a cross-section problem, the line stays as-is. Field crews can still charge to it; consolidating it adds friction without benefit.

### 4.6 ST never folds

`ST` section / `00ST` activity is universal exception, never folds, never combines, never redistributes. Carry-over from prior architectural rules.

### 4.7 No rules-driven automation

The PM said it directly: *"not a lot of rules, it's whatever makes sense."* The system does not auto-decide consolidation. It surfaces candidates with context, offers operations, accepts custom routing.

---

## 5. The three-step workflow

The Code Cleanup tab is one page with three sequential sections. PMs scroll top-to-bottom; later steps recompute live as earlier steps are answered.

### Step 1 — Global head decisions

For every cost head with at least one small instance project-wide, a card appears showing **all instances of that head across the entire job** (small ones flagged, healthy ones shown for context). Options:

- Pool ALL to `40 0000 [head]`
- Reroute ALL to a peer head (e.g., COND → WATR)
- Keep distributed — defer the small instances to Step 3 for per-instance handling
- Custom — type a target

The decision applies project-wide. Field consistency is structurally enforced — there is no per-section opt-out.

### Step 2 — Section folds

For every section under the section threshold (default 80h) **after Step 1's reductions**, a card appears showing the section's remaining heads. Default action: fold to `[SEC] 0000 PLMB`. Optional combine action: PM checks "Combine with [other section]," names the combined section, writes a field-scope note. Both sections then fold to the combined target.

The section card recomputes live: if Step 1 pools DRNS to 40, and L2 had a DRNS 2h instance, the L2 card shows "6 codes / 23h" instead of "7 codes / 25h."

### Step 3 — What's left

For every line still below floor after Steps 1+2 — typically a borderline head in an otherwise-healthy section, or a small instance whose head was kept distributed in Step 1 — a row appears with four action buttons:

- **Accept** (default if the section is healthy and no cross-section pattern exists)
- **Redistribute** — opens a sub-control: pick a peer head in the same section to pull hours from, set amount, see live preview
- **Reroute** — opens target options: cross-section pool target, peer heads in the same section, custom
- **Custom** — type any target

---

## 6. UI specification

### 6.1 Top-level placement

A new tab in the existing tab bar, placed between Budget Builder and Bulk Buyout:

```
Upload | Estimates | Labor Mapping | Material Mapping | Budget Builder | Code Cleanup [N] | Bulk Buyout | Rules
```

Tab badge `[N]` shows the count of lines currently below the line floor. When N=0, the tab is still visible but the badge is hidden.

### 6.2 Page header

- Stripped Code Health summary (read-only): budget lines / total hours / lines below floor / hours affected. No action buttons. ⚠ triangles (if present in the existing Code Health) deep-link into this tab pre-filtered to the relevant section.
- Threshold knob: line floor (default 12h) and section threshold (default 80h). Reads from the existing `consolidation_thresholds` DB setting (already wired in prior loop). PMs adjust here; both Code Health and the workflow recompute live.

### 6.3 Step 1 card structure

Each card represents one cost head with at least one small instance.

- **Header:** head name, section count, total hours job-wide
- **Instance list:** every section where the head appears, with hours. Small instances flagged red. Healthy instances shown grayed for context.
- **Options:** four radio-button rows (Pool to 40 / Reroute to peer / Keep distributed / Custom). Each option has a one-line note explaining what it does.
- **View audit link:** top-right, expands an inline audit drawer showing source-to-target provenance for the selected option. Default collapsed.

### 6.4 Step 2 card structure

Each card represents one section under the section threshold (after Step 1).

- **Header:** section name, code count and total hours **after Step 1 reductions** (with parenthetical showing original count if Step 1 affected this section)
- **Codes line:** comma-separated list of remaining heads with hours
- **Fold target block:** non-editable display of `[SEC] 0000 PLMB`
- **Combine block:** checkbox "Combine with [other section]," with two text inputs (combined section name + field scope note). Combined cards collapse into one combined card after the checkbox is enabled.
- **View audit link:** same pattern as Step 1.

### 6.5 Step 3 row structure

Each row represents one remaining below-floor line.

- **Identity:** code in mono font + meta (hours, section health context)
- **Actions:** four-button toolbar (Accept / Redistribute / Reroute / Custom). Active button has a visual indicator. Default selection: Accept if section is healthy.
- **Sub-controls (expand inline below the row):**
  - Redistribute: source-head dropdown (heads in same section), hours input, live preview ("L2 0000 DRNS: 2h → 8h · L2 0000 FNSH: 9h → 3h · section total unchanged at 25h")
  - Reroute: target options list with tags ("cross-section pool" / "peer in same section" / "custom"). Each option has a contextual note.
  - Custom: free-text input for target code in `[SEC] [ACT] [HEAD]` format.
- **View audit link:** same pattern.

### 6.6 Audit drawer

Expands inline within any action card. Contents:

- Source list: every source code and hours
- Arrow indicating consolidation direction
- Target code with combined hours
- Audit note: operation type, what the audit report will record (PM identity + timestamp captured at apply time, source breakdown preserved)

### 6.7 Footer

- Preview block: "Before / After" comparison showing budget line count delta and lines-below-floor delta
- Apply All button (primary) and Save Draft button (secondary)
- Apply All commits all decisions atomically; Save Draft persists the in-progress state without committing

---

## 7. Detection logic

The detector populates the three steps from `finalLaborSummary` (post-merge data, same source as the export pipeline).

### 7.1 Step 1 candidates — global head decisions

For each unique cost head H in `finalLaborSummary`:

- Count `n_total` = total instances of H across all sections
- Count `n_small` = instances where line hours < line floor
- Sum `total_hours` = sum of all H's hours job-wide

Surface as a Step 1 card if `n_small >= 1` AND any of:
- `n_small >= 2` (small in multiple places — clear cross-section pattern), OR
- `n_total == 1 AND total_hours < floor` (only instance is below floor — global decision still required for consistency in case more instances appear later)

### 7.2 Step 2 candidates — section folds

For each section S in `finalLaborSummary`, after subtracting hours that Step 1 will move out:

- Compute `remaining_total` = sum of S's hours after Step 1
- Compute `remaining_codes` = count of distinct heads remaining in S

Surface as a Step 2 card if:
- `remaining_total < section threshold` (default 80h), AND
- `remaining_codes >= 2` (single-head section is just one line, no fold needed), AND
- S != 'ST' AND act != '00ST' (universal exception)

### 7.3 Step 3 candidates — what's left

For each line in `finalLaborSummary`, after applying Step 1 + Step 2 decisions:

- If line hours < floor AND line is not in a section being folded AND line's head is not being globally consolidated → surface in Step 3.

Default action: Accept if the section's total hours > section threshold (healthy) AND the head is not flagged in Step 1. Otherwise, no default — PM must pick.

---

## 8. Save / persistence

All decisions write to `project_small_code_merges` (existing table). Schema reuse:

| Operation | Records written | Notes |
|---|---|---|
| Pool to 40 | One per source instance, all with same `reassign_to_head` and `reassign_to_sec='40'`, `reassign_to_act='0000'` | New columns may be needed (see §10) |
| Reroute globally | One per source instance, with `reassign_to_head=[target]` per-section | Reuses existing reassign mechanic |
| Fold to PLMB | One per source head in section, with `reassign_to_head='PLMB'` | Target key `[SEC] 0000 PLMB` is NEW — see §10 line 1593 |
| Combine sections | One per source code in both sections, with `reassign_to_sec=[combined_name]`, `reassign_to_act='0000'`, `reassign_to_head='PLMB'` | Combined section name is PM-invented free text |
| Redistribute within section | NOT a merge record — this is hour rebalancing. Needs new persistence path (see §10) | |
| Accept | NOT persisted. Acceptance is implicit when no merge record exists for a small line | |

---

## 9. Audit trail requirements

Every applied decision writes an audit row capturing:

- Operation type (`pool_to_40` / `reroute_global` / `fold_to_plmb` / `combine_sections` / `redistribute`)
- Source codes (full list)
- Target code(s)
- Hours moved
- Timestamp
- PM identity
- Field scope note (combine operations only)

The Code Cleanup tab's "View audit" link reads from this table. The export's Audit Report includes a Code Cleanup section listing every consolidation with provenance.

Provenance must answer: **for every consolidated line, where did its hours originally come from?**

---

## 10. Implementation notes (line-level)

### 10.1 Stage 3 reassign branch — INVERSION FROM PRIOR PLAN

The prior Section Rollup design at `.lovable/plan.md` locked in this safety invariant:

> Section Rollup target dropdown must be constrained to cost heads already present in the bucket. With this invariant, line 1572's `Object.keys(result).find` always succeeds, and line 1593's hardcoded-`0000` fall-through is unreachable.

**This invariant is inverted by this spec.** Two of the four operations (Fold to PLMB, Pool to 40) write target keys that **do not exist in the source data**:

- Fold to PLMB writes `[SEC] 0000 PLMB`. If the source section had no PLMB head before, this is a new key.
- Pool to 40 writes `40 0000 [head]`. The synthetic `40` section is always new.

For these operations, line 1572's match-existing path must fail and line 1593's create-new-key path must execute. **Line 1593 is now load-bearing for this spec, not a fall-through to avoid.**

Recommended: extract line 1593's create-new-key logic into a named helper (`createNewBudgetKey(sec, act, head)`) so both code paths are explicit and testable. Add a dev-only invariant logging when create-new-key fires, capturing operation type, so we can verify the right operations are taking the right path.

### 10.2 Reroute globally — multi-section operation

Existing reassign records are per-section (one record per source code). A global reroute (COND → WATR everywhere) writes one record per COND instance. Confirm the existing apply-merges code iterates correctly when N records share the same `reassign_to_head` across different sections.

### 10.3 Redistribute within section — new persistence

This is hour rebalancing, not code mapping. The existing `project_small_code_merges` schema cannot represent it (there is no source code being merged into a target — both source and destination still exist as their own codes, just with different hour counts).

Two options:

- **(A)** New table `project_hour_redistributions` with columns `(project_id, sec, act, source_head, target_head, hours_moved)`. Pipeline applies these post-merge but pre-export. Cleanest separation.
- **(B)** Store as adjustment metadata on existing merge records via a new column `hours_delta` and a `redistribution_pair_id` so source/target rows reference each other. Avoids new table but couples redistribution to merge schema.

Recommend Option A. Redistribution is a different operation conceptually; deserves its own table.

### 10.4 Threshold object

Already DB-backed via `consolidation_thresholds` setting from the prior loop. Existing fields: `smallLine`, `sectionRollup`, `sectionWarning`, `jobWide`. This spec uses:

- `smallLine` → renamed conceptually to "line floor" (no schema change)
- `sectionRollup` → renamed conceptually to "section threshold" (no schema change)
- `sectionWarning` → kept for Code Health ⚠ display
- `jobWide` → may become obsolete; review whether any detector still uses it after Step 1 absorbs the cross-section consolidation logic

UI labels in the Code Cleanup tab should use the simpler names (Line floor / Section threshold), not the schema names.

### 10.5 Existing surfaces to delete

Order matters — delete UI consumers before deleting their data sources to avoid mid-deploy breakage.

| Surface | Component | Delete in phase |
|---|---|---|
| Cross-Section Consolidation Candidates | `CodeHealthDashboard.tsx` (collapsible) | Phase 7 |
| Job-Wide Consolidation panel | `JobWideConsolidation.tsx` | Phase 7 |
| Merge Groups tab | `BudgetAdjustmentsPanel.tsx` (smallCodeAnalysis) | Phase 7 |
| Standalone Codes tab | `BudgetAdjustmentsPanel.tsx` (smallCodeAnalysis standalone branch) | Phase 7 |
| Round 2 residuals banner | `BudgetAdjustmentsPanel.tsx` | Phase 7 |
| Auto-resolve button | `BudgetAdjustmentsPanel.tsx` (`standaloneAutoSuggestions` consumer) | Phase 7 — see §11 |
| Code Health action buttons | `CodeHealthDashboard.tsx` | Phase 7 |

The `smallCodeAnalysis` useMemo in `BudgetAdjustmentsPanel.tsx` should be **kept as the underlying data source** but no longer rendered in tabs. The new Code Cleanup tab consumes its output via the new detection logic in §7.

---

## 11. Auto-resolve disposition

The existing auto-resolve button operates per-section, applying suggestions like "PIDV → WATR via system mapping" within one section without considering project-wide patterns. This **violates the field consistency rule** (§4.2): if PIDV → WATR happens in 1M but not in 2M, the field has no consistent rule.

**Disposition: kill auto-resolve as a top-level action.** Its logic (`standaloneAutoSuggestions`) may still inform Step 1 default selections — for example, if PIDV consistently maps to WATR via system mapping across all instances, that mapping can be surfaced as the default Reroute option in PIDV's Step 1 card. But the "click once to fix many" pattern at the section level is gone.

If a future loop wants to restore something auto-resolve-like, it must operate **globally**: one click that pre-selects the "consistent default" radio button on every Step 1 card simultaneously. PM still confirms.

---

## 12. Phased shipping plan

This is a substantially larger lift than the original Section Rollup task. Ship in phases to keep PRs reviewable.

| Phase | Deliverable | Risk gate |
|---|---|---|
| 1 | Detection layer — pure function returning `{ step1Candidates, step2Candidates, step3Candidates }` from `finalLaborSummary` and threshold object. No UI. Unit tests cover Pasadena fixtures. | Lovable cites Pasadena test cases verified against expected output |
| 2 | New top-level Code Cleanup tab with empty page shell. Tab badge wired. Code Health stripped of action buttons (read-only mode). | Tab renders, navigation works, Code Health metrics still display |
| 3 | Step 1 (global head decisions) cards rendered from detection layer. Apply writes merge records via existing pipeline + the new line 1593 path. | Pasadena: DRNS Pool to 40 produces correct merge records, applies cleanly, audit captures provenance |
| 4 | Step 2 (section folds) cards with combine action. Live recomputation from Step 1 selections. | Pasadena: 1M + 2M combine to MZ 0000 PLMB with correct field note, audit shows 10 source codes folded |
| 5 | Step 3 (what's left) rows with all four actions. Redistribute introduces new persistence path (§10.3). | Hypothetical L2 0000 DRNS redistribute test passes; section total preserved |
| 6 | Audit drawer integration on every action card. Audit report export includes Code Cleanup section. | Audit drawer shows correct provenance for all five operation types |
| 7 | Delete old surfaces in `BudgetAdjustmentsPanel`, `CodeHealthDashboard`, `JobWideConsolidation`. Delete auto-resolve. | All Pasadena cleanup work flows through Code Cleanup tab; no PM-facing regression |

Each phase ships independently. After each phase, PM validates on Pasadena before proceeding.

---

## 13. Acceptance criteria

1. Pasadena's 22 flagged codes resolve through one tab with PM completing three steps in under 5 minutes.
2. Field consistency holds: every consolidated cost head has exactly one global rule applied (or is explicitly kept distributed via Step 3 individual actions).
3. Audit report shows every consolidation with full provenance (source codes, target, hours, operation, PM, timestamp).
4. Total hours preserved through every operation. `sum(finalLaborSummary hours)` before vs after any apply is identical.
5. Threshold changes (line floor or section threshold) recompute the entire workflow live without page reload.
6. ST section never appears as a Step 1 / Step 2 / Step 3 candidate regardless of hours.
7. No regression on Hamilton High reconciliation or any prior session's verified behavior.
8. Old surfaces (1–7 listed in §1) are deleted, not left as dead UI.

---

## 14. Open questions for first implementation loop

These do not block detection-layer work in Phase 1 but should be resolved before Phase 5:

1. **Audit drawer placement.** Inline within each card (per current spec) or a side drawer with all pending audit entries collected together? Inline is more discoverable per-action; side drawer is better for reviewing all changes before Apply All. PM preference?
2. **Reroute default targets.** Should the system propose a default Reroute target (e.g., for COND, suggest WATR based on existing system mappings)? Or always require PM to pick?
3. **Combine UI affordance.** Currently a checkbox inside one section's card. Should it be its own row above the affected sections instead? Especially relevant when combining 3+ sections.
4. **Save Draft semantics.** Does Save Draft persist the decisions to a draft slot in the DB (PM can resume later) or just to local state? Affects whether multiple PMs can collaborate on the same project's cleanup.

---

## 15. References

- `CLAUDE.md` — domain rules, architectural principles
- `.lovable/plan.md` — prior Section Rollup design (superseded by this spec)
- Prior session: threshold ownership lift (April 2026) — Code Cleanup uses the `consolidation_thresholds` DB setting established there
- Pasadena Library project — primary fixture for detection-layer tests and acceptance validation
