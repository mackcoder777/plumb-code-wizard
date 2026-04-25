---
name: Multitrade ACT Format
description: Building-first ACT format (BA01) for multitrade level-split, single helper composeMultitradeActivity, strict length gate.
type: architecture
---
Multitrade level-split ACT codes use BUILDING-FIRST format: `BA01`, `BA02`, `BA0R` (building BA, level 1/2/roof).
NOT level-first (`01BA`) — that legacy format fragmented buildings on Excel sort.

**Single source of truth**: `composeMultitradeActivity(bldgSuffix, levelPrefix)` in `src/lib/utils.ts`.
- Returns `'0000'` when bldgSuffix is empty.
- Returns flat `bldgSuffix.padStart(4, '0')` when levelPrefix is missing or `'00'`.
- Otherwise returns `bldgSuffix + levelPrefix` (4 chars guaranteed).
- **Throws** when `bldgSuffix.length > 2`. This is a regression alarm — callers MUST gate.

**Gate pattern** (uniform across all 5 assembly sites):
```ts
const bldgSuffix = buildingAct.replace(/^0+/, ''); // strip ALL leading zeros
if (bldgSuffix && bldgSuffix.length <= 2) {
  activity = composeMultitradeActivity(bldgSuffix, levelPrefix);
} else {
  activity = buildingAct; // 3+ char building IDs (B12/MOD) can't encode level
}
```

**Five assembly sites** (all flipped):
1. `src/pages/Index.tsx` — memoizedLaborSummary (writes data)
2. `src/components/tabs/SystemMappingTab.tsx` buildFullLaborCode (writes data)
3. `src/components/tabs/SystemMappingTab.tsx` handleApplySectionCodes (writes data)
4. `src/components/FloorSectionMapping.tsx` perBuildingBreakdown (preview projection)
5. `src/components/FloorSectionMapping.tsx` second projection useMemo at line ~1345 (preview)

**Why**: PM ships building-first packets (Hamilton's hand-corrected packet is the spec). Runtime now matches the manual fix; PMs no longer rewrite ACTs in Excel.

**No DB migration**: `project_small_code_merges`, `cost_head_activity_overrides`, `floor_section_mappings` contain zero rows matching `^[0-9]{2}[A-Z]{1,2}$` (level-first regex). Existing rows are flat building-only (`00BA`, `0B12`) and unaffected by the flip.
