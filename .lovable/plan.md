
Goal: fix `standaloneAutoSuggestions` so Rule 2b (same cost head consolidation) is evaluated inside the `ABOVE_GRADE_SYSTEM_CODES` branches before their early `return`, in both passes, using the combined-hours threshold condition.

Implementation plan

1) Update Pass 1 (`standalone.forEach(entry => { ... })`)
- In the existing block:
  - `if (ABOVE_GRADE_SYSTEM_CODES.has(head)) { ... return; }`
- Insert Rule 2b at the top of that block, before current peer-merge logic:
  - Scan `Object.entries(finalLaborSummary ?? {})`
  - Match same section + same head
  - Exclude self using full key: `k !== entry.lines[0].code`
  - Require `(kHours + entry.combinedHours) >= minHoursThreshold`
  - Sort by target hours desc
  - If found, set:
    - `targetHead: head`
    - `targetKey: sameHeadMatch[0][0]`
    - `reason: \`${head} → ${head} (same cost head, consolidated activity)\``
  - `return` immediately
- Keep existing “largest in section” peer-merge logic exactly as-is for the no-match path, then keep existing `return`.

2) Update Pass 2 (`Object.entries(finalLaborSummary).forEach(([flKey, flEntry]) => { ... })`)
- In the existing block:
  - `if (ABOVE_GRADE_SYSTEM_CODES.has(head)) { ... return; }`
- Insert same Rule 2b-first pattern at top of block:
  - Scan `Object.entries(finalLaborSummary ?? {})`
  - Match same section + same head
  - Exclude self using full key: `k !== flKey`
  - Require `(kHours + hrs) >= minHoursThreshold` (`hrs` is the source row hours already computed in pass 2)
  - Sort by target hours desc
  - If found, assign suggestion on `pKey` with same reason format and return
- If no same-head match, fall through to the existing peer-merge largest-in-section logic unchanged, then return.

3) Keep all other logic untouched
- Do not change rule ordering outside these two `ABOVE_GRADE_SYSTEM_CODES` branches.
- Do not change Rule C/Rule D behavior.
- Do not alter suggestion keying (`entry.key` in pass 1, `pKey` in pass 2) or existing reason text outside the new Rule 2b insertions.

Technical details
- Why this works: current early return in `ABOVE_GRADE_SYSTEM_CODES` prevents downstream Rule 2b from ever running; moving a Rule 2b check into that branch preserves architecture while respecting current control flow.
- Threshold rule applied exactly as requested: only suggest same-head when source+target meets/exceeds `minHoursThreshold`.
- Self-exclusion uses full code keys in both passes (`entry.lines[0].code` and `flKey`) to prevent self-targeting.

Validation plan (post-change)
1. Reproduce failing case (`12 00L2 SEQP`) and confirm suggestion becomes:
   - `SEQP → SEQP (same cost head, consolidated activity)` when combined hours meet threshold.
2. Confirm fallback behavior:
   - If no qualifying same-head target exists, above-grade peer-merge largest-in-section still appears.
3. Regression checks:
   - BG chain (Rule 1/Rule A) still takes precedence.
   - Non-above-grade paths still use existing Rule 2b/Rule C/Rule D flow unchanged.
4. QC spot checks from project checklist relevant to this change:
   - Auto-suggestions do not emit sentinel values.
   - Targets remain real cost heads.
   - In Export rows remain aligned with `finalLaborSummary`.
