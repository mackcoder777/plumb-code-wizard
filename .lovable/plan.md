# Fix: Step 3 missing rows for "Keep distributed" heads

## Root cause (verified in source)

`src/components/tabs/CodeCleanupTab/Step3RowList.tsx` line 40 iterates `detection.step3Candidates` — the **initial pessimistic** detection where every Step 1 candidate head is excluded. As a result, when SNWV / PIDV / SLVS are set to `keep_distributed`, their small instances (e.g., SR 0000 SNWV 10h, 1M 0000 SNWV 3h, 2M 0000 SNWV 3h) never appear in Step 3 — even though the spec promises exactly that.

The detector itself is already correct: lines 487–488 of `codeCleanupDetector.ts` honor `step1ExclusionSet` and `step2ExclusionSet`, so `liveDetection.step3Candidates` is the authoritative live list. The parent (`CodeCleanupTab/index.tsx` lines 78, 170) already passes `liveDetection` into `Step3RowList`. The leak is purely the wrong source pick inside the row list.

A previous patch (the comment at lines 34–39) deliberately pinned to `detection` to prevent rows from vanishing mid-edit when the PM commits a Step 3 reroute / custom / redistribute (those decisions move hours out of `livePreview`, dropping the candidate from `liveDetection`). That guard was real, just over-applied — it also blocked legitimate Step 1 `keep_distributed` recovery.

## Fix — single file, ~10 lines

Edit `src/components/tabs/CodeCleanupTab/Step3RowList.tsx`:

1. **Primary source becomes `liveDetection.step3Candidates`** — honors `committedStep1Heads` / `committedStep2Sections` exactly the way the detector already computes them.
2. **Union-merge with pending Step 3 decisions** — if the PM has an active `decisions.step3[key]` and the candidate is no longer in `liveDetection` (because their reroute already moved the hours), pull the original candidate from `detection.step3Candidates` so the row stays visible mid-edit.
3. **Re-apply the upstream filters** to the union (defensive — `liveDetection` already filters, but a re-added pinned row needs the same gate).
4. **Deterministic sort by `hours` ascending** to match the detector's existing `step3Candidates.sort((a, b) => a.hours - b.hours)` at line 512. Map insertion order is fine functionally, but a stable sort prevents any visual jitter on re-renders.

### Sketch

```ts
// Primary source: liveDetection (correctly excludes only COMMITTED Step 1/2)
const byKey = new Map(liveDetection.step3Candidates.map(c => [c.key, c]));

// Union with pending Step 3 decisions to prevent mid-edit vanishing
// (a committed reroute/custom/redistribute moves hours out of livePreview,
// which would otherwise drop the row from liveDetection.step3Candidates).
for (const key of Object.keys(decisions.step3)) {
  if (decisions.step3[key] && !byKey.has(key)) {
    const original = detection.step3Candidates.find(c => c.key === key);
    if (original) byKey.set(key, original);
  }
}

const visible = Array.from(byKey.values())
  .filter(c => !committedStep1Heads.has(c.head) && !committedStep2Sections.has(c.sec))
  .sort((a, b) => a.hours - b.hours); // match detector's ordering
```

Update the inline comments to reflect the new pattern (drop the "pinned against detection" wording; document that `liveDetection` is the source of truth and `detection` is consulted only as a mid-edit fallback).

## Files touched

- `src/components/tabs/CodeCleanupTab/Step3RowList.tsx` — replace the `visible` computation and refresh comments. No prop changes.

## Not touched (verified safe to leave alone)

- `src/utils/codeCleanupDetector.ts` — already correct (uses `step1ExclusionSet` / `step2ExclusionSet` at lines 487–488, sorts at line 512).
- `src/components/tabs/CodeCleanupTab/index.tsx` — `liveDetection` memo and prop wiring already correct (lines 78, 170).
- `applyPendingDecisions` and the Apply All writer — out of scope.

## Verification on Pasadena

**Set A — keep_distributed recovery (the bug we're fixing):**
1. Reset all decisions, then set SNWV = Keep distributed → SR/1M/2M 0000 SNWV instances appear in Step 3.
2. Set PIDV = Keep distributed → small PIDV instances appear in Step 3.
3. Flip SNWV back to Pool → SNWV rows disappear from Step 3.
4. Pick Reroute on a Step 3 row, choose a target → row stays visible (mid-edit guard via union).
5. Set 1M = fold (Step 2) → 1M small lines disappear from Step 3.
6. Combine 1M + 2M → both sections' small lines disappear.

**Set B — Phase 2 end-to-end (after Set A passes):**
1. Reset → click Reroute on SR 0000 COND → dropdown expands inline, row stays visible.
2. Pick a target → decision persists, row stays visible.
3. Open Step 2 1M card → click Accept fold → fields populate (1M / 0000 / PLMB).
4. Edit ACT from `0000` to `BLDG` → live target shows `1M BLDG PLMB`.
5. Combine 1M + 2M with name `MZ`, scope `Mezzanine plumbing` → both cards remain until Apply All.
6. Click Apply All → footer BUDGET LINES drops, Hour Reconciliation strip approaches ~0h missing, decisions persist after page reload.

If both sets pass, Phase 2's core flow is shipped end-to-end.
