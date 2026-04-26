## Diagnosis confirmed

Your read is exactly right. I traced both suspect paths against `HourReconciliationBar.tsx:30` (the `entry.type === 'field'` filter) and `laborSummaryComputation.ts:58` (the `SummaryEntry.type` field declaration), and there are exactly two places where new entries get inserted into `result` via a bare object literal — both omit `type`. Every other `result[k] = { ... }` site either spreads an existing entry (which carries `type` forward) or just updates an existing entry's hours/dollars.

**The 35.4h gap is structural and surgical: untyped entries silently drop out of `exportFieldHours`.**

### Site 1 — Cross-section reassign create-new-key (`src/utils/laborSummaryComputation.ts:759-767`)

This is the MZ path. Fires when `reassign_to_sec` is set and no existing target key matches:

```ts
result[newTargetKey] = {
  code: newTargetKey,
  sec: targetSec,
  activityCode: targetAct,
  head: effectiveTargetHead,
  hours: sourceHours,
  dollars: sourceDollars,
  description: `Reassigned from ${head}`,
  // ❌ no `type` field
};
```

When 1M + 2M combined to MZ on Pasadena, this path created `MZ 0000 SNWV`, `MZ 0000 PIDV`, etc. — all without `type`. They live in `finalLaborSummary` with the right hours, but the reconciliation strip can't see them. That's the 35.4h.

### Site 2 — Stage 3.5 redistribute create-target-key (`src/utils/laborSummaryComputation.ts:856-864`)

Same class of bug, inert today because Pasadena has 0 redistributions, but it'll bite the moment a PM uses Step 3 Redistribute:

```ts
result[targetKey] = {
  code: targetKey,
  sec: red.sec,
  activityCode: red.act,
  head: red.targetHead,
  hours: actualMoved,
  dollars: actualDollars,
  description: `Redistributed from ${red.sourceHead}`,
  // ❌ no `type` field
};
```

The comment on line 854 even says "same description style as the cross-section reassign create-new path" — confirms these two sites were authored as a pair and drift together.

### Why other paths are safe

I audited all 21 `result[...] = {` sites:

- **Spreads from existing entries** (`...item`, `...result[k]`, `...fbEntry`, `...group[0]`, `...source`) — carry `type` forward. Safe.
- **Hours/dollars updates on existing keys** — `type` already set. Safe.
- **Only the two flagged sites** build a new entry from scratch with field-by-field assignment. Both miss `type`.

## The fix

### File 1: `src/utils/laborSummaryComputation.ts`

Add `type: 'field' as const,` (or just `type: 'field',` since the surrounding object satisfies the discriminated union) to both new-entry literals:

**Line 759-767** — cross-section reassign create-new-key:
```ts
result[newTargetKey] = {
  code: newTargetKey,
  sec: targetSec,
  activityCode: targetAct,
  head: effectiveTargetHead,
  hours: sourceHours,
  dollars: sourceDollars,
  type: 'field',                          // ← add
  description: `Reassigned from ${head}`,
};
```

**Line 856-864** — Stage 3.5 redistribute create-target-key:
```ts
result[targetKey] = {
  code: targetKey,
  sec: red.sec,
  activityCode: red.act,
  head: red.targetHead,
  hours: actualMoved,
  dollars: actualDollars,
  type: 'field',                          // ← add
  description: `Redistributed from ${red.sourceHead}`,
};
```

That's the entire reconciliation fix. Two added lines.

### File 2: `src/components/tabs/CodeCleanupTab/index.tsx`

Subtitle copy fix at line 156. Current text says the Step 2 list is "pinned from initial detection," but after the recent Step 2 leak fix it actually iterates `liveDetection`. Realign copy to truth:

```tsx
// before
subtitle="List is pinned from initial detection; per-card hour previews update as Step 1 selections come in."
// after
subtitle="Per-card hour previews and remaining heads update as Step 1 selections come in."
```

No behavior change; just stops misleading the reader of the source.

## Verification

User runs the lightweight check on Pasadena — no full re-run of the six scenarios needed:

1. Reload the page (clears any cached state).
2. Re-apply the same scenario that produced 35.4h missing (combine 1M + 2M into MZ, custom on PIDV, keep distributed on SNWV/SLVS, Apply All).
3. Watch the **Hour Reconciliation strip** at the top of Pasadena.

**Expected result:** strip drops to **0h missing** (or under 1h of rounding noise).

If the strip still shows 35.4h, the type fix didn't reach the path that produced those hours — paste back the breakdown and we triage. If it shows ~0h, **Phase 2's core flow is shipped end-to-end** and the remaining items (Step 2/3 inline UI polish, audit drawer, old-surface deletion) are punch-list, not blockers.

## Scope discipline

Only these two files change. Specifically NOT touching:

- `applyPendingDecisions` — no behavior change needed.
- Initial pessimistic detection — stays pessimistic by design.
- Step 3 row union logic — already shipped and verified.
- The reconciliation bar filter itself — `entry.type === 'field'` is correct; the bug is upstream entries not declaring their type.
- Any merge/reassign control flow — the fix is one extra field in two object literals.

Approve and I'll switch to default mode and ship the two-file patch.