## 0. Authoritative references

Load these at the start of every session. They are Tier 1, verified against live files.

- **`PLUMBING_RECAP_MAP.md`** — v1.0 structural reference for Murray plumbing
  BRCAP workbooks. Every sheet, every cell, every formula flow, and the full
  bid-assembly waterfall from AutoBid raw to $16.2M Grand Total on Hamilton High.
- **`PLUMBING_RECAP_MAP_v1.1_PATCH.md`** — v1.1 additions covering MLSHT line
  classification, the two-dimensional routing matrix, Building Classification
  schema (§15), and the MLSHT Guided Review Flow (§16) with Hamilton
  gold-standard routing log (Appendix D). When v1.0 and v1.1 conflict, v1.1
  wins. Both docs must be loaded at session start.
- **`NEXT_PHASE_SPEC_FULL_RECAP.md`** — phase 1 spec (data model, import flow,
  UI, export helpers, reconciliation). Pre-MLSHT-walkthrough. v1.1 PATCH
  supersedes specific sections — see supersession map below.

### Spec supersession map (v1.1 PATCH wins)

- **§5.1 Data model** — spec has 7 tables. v1.1 adds 3 more:
  `project_building_classification` (v1.1 §15),
  `mlsheet_review_sessions` (v1.1 §16.3),
  `mlsheet_routing_decisions` (v1.1 §16.3).
  Sprint 1 creates all **10 tables**, not 7.
- **§5.3 Recap tab UI** — spec says "8 sections, CRUD for each." v1.1 §16
  upgrades the M&L Sheet Adjustments section to a **guided review flow**
  (session-based wizard, not flat CRUD). Other 7 sections remain CRUD.
- **§6 Sprint timeline** — spec says Sprint 2 = 2 weeks. v1.1 §16 expands
  Sprint 2 to **3 weeks**. Total Phase 1 = **9 weeks**, not 8.
- **§9 Open questions** — Q2, Q6, Q7 answered during the live MLSHT
  walkthrough. Q1, Q3, Q4, Q5, Q8, Q9, Q10, Q11, Q12 remain open.
  See `PLUMBING_RECAP_MAP_v1.1_PATCH.md` §9 routing tables + Appendix D
  Hamilton gold-standard log for the answers.

### Reference workbook

`reference/hamilton-hs-rebid-brcap.xlsm` (gitignored). Future sessions must
download from Murray local storage and place at this path before Phase 2
work. Used as live arbiter for verifying formulas against the spec.

---

Murray Company Budget Manager — Complete
Reference Document
Merged from: AutoBid raw data analysis + Lovable app reference + session history Last
updated: March 2026
CRITICAL: How to Use This Document
This document has two tiers of reliability. You must treat them differently.
TIER 1 — Trust unconditionally (domain rules from Murray Company)
These sections describe what the app must do. They come from Murray Company’s actual
workflow and the raw AutoBid data — not from Lovable’s implementation. They cannot be
wrong.
Section 2 — Raw Data Structure: column names, what each field means, real data stats
Section 6 — Labor Code Priority Hierarchy: the intended priority order
Section 7 — Activity Code Resolution: floor-to-activity mappings
Section 9 — Material Code Assignment: material spec to cost head rules
Section 15 — Key Constants: BG chains, alias chains, all cost head mappings
Section 16 — Critical Architectural Rules: non-negotiable, enforce always
Section 17 — QC Checklist: run before AND after every change
TIER 2 — Verify against actual code before trusting
These sections describe intended behavior as documented by Lovable. The implementation
may be wrong — in fact, the bugs we have spent weeks fixing exist precisely because
implementation diverged from intent. Read the actual code first. Do not assume it
matches this document.
Section What to verify
Section 10: Read the actual useMemo in BudgetAdjustmentsPanel.tsx. Each stage
finalLaborSummary description here is the spec — check whether the code actually
Pipeline implements it correctly. Known drift: +16h still unresolved.
Section 11: Small Check standaloneAutoSuggestions useMemo directly. Auto-
Code Review suggestion rules may differ from what is actually implemented.
Section 5: Section resolveSectionStatic and resolveFloorMappingStatic may have edge
Mapping cases not captured here. Read the actual functions.
Section 8: Budget Fab strip, FCNT, and LRCN logic — verify actual implementation
Adjustments matches description.
Any “how it works”
Treat as spec, not as verified behavior.
description
Your mandatory workflow for every task
1. Read this document (both tiers)
2. Read the actual relevant source code
3. Identify any gap between this document and the code
4. If gap found: fix the code to match Tier 1 rules, OR flag the discrepancy
before proceeding — never silently accept wrong implementation
5. Run the QC checklist (Section 17) after every change
6. If a fix introduces a new gap, document it in Section 17
The fundamental principle
The code is the bug report. This document is the spec.
Lovable’s AI made implementation decisions that looked correct but weren’t. Do not give
existing code the benefit of the doubt just because it is there or because this document
describes something similar. Read it, verify it, fix it if wrong.
Table of Contents
1. Overview
2. Raw Data Structure
3. Step 1: File Upload & Parsing (Tier 2 — Verify)
4. Step 2: Dataset Profiling (Tier 2 — Verify)
5. Step 3: Section Mapping (Floor to SEC) (Tier 2 — Verify)
6. Step 4: System Mapping (System to Cost Head) (Tier 2 — Verify)
7. Step 5: Activity Code Resolution (Tier 1 — Trust)
8. Step 6: Labor Code Priority Hierarchy (Tier 1 — Trust)
9. Step 7: Material Code Assignment (Tier 1 — Trust)
10. Step 8: finalLaborSummary Pipeline (Tier 2 — Spec only, verify code)
11. Step 9: Small Code Review (Tier 2 — Spec only, verify code)
12. Step 10: Budget Adjustments (Tier 2 — Verify)
13. Step 11: Export (Tier 2 — Verify)
14. Database Tables (Tier 2 — Verify)
15. Key Constants & Mappings (Tier 1 — Trust)
16. Critical Architectural Rules (Tier 1 — Trust)
17. Known Bug Status & QC Checklist (Tier 1 — Trust)
18. Key Files Reference (Tier 1 — Trust)
19. Data Flow Diagram
1. Overview
Murray Company is a mechanical contracting firm. This app processes AutoBid plumbing
estimate exports, assigns Murray Company internal cost codes (SEC-ACT-COSTHEAD
format) to every labor and material line item, and produces a structured budget packet
(Excel) for field and accounting use.
Primary users: Project Managers and Estimators. Stack: React, TypeScript, Vite,
Supabase, deployed via Lovable.dev.
The Cost Code Format
SEC ACT COSTHEAD
| | |
| | +-- What type of work (e.g., WATR = Domestic Water, SNWV = Sanitary Waste & Vent)
| +-- Activity code (e.g., 0000 = default, 00L1 = Level 1, 00UG = Underground)
+-- Section code (building identifier, e.g., B2, B3, ST for site)
Example: B2 00L3 WATR = Building 2, Level 3, Domestic Water
2. Raw Data Structure
Source File Format
AutoBid exports a .xlsm file (QuickPen Rapid Report). The app reads the “Raw Data”
sheet exclusively. Row 1 is a type-code row (D/A/T/O), Row 2 is the real header, data starts
Row 3.
Key Columns
Column Description
Drawing Sheet/drawing reference (e.g., “P-1-301 - BLDG 1 PLUMBING DEMO 1”)
System Plumbing system name – PRIMARY DRIVER for labor cost head
Building + level (e.g., “Bldg A - Level 2”) – PRIMARY DRIVER for section
Floor
code
Zone Building zone identifier (e.g., “BLDG - A”)
Material Spec Material type – PRIMARY DRIVER for material cost head
Item Type Category (Fittings, Pipe, Supports, Valves, Specialties, etc.)
Report Cat Report category grouping
Trade Labor trade (always “Plumbers” for plumbing)
Material
Product family (e.g., “Cast Iron - Soil, No-Hub,”)
Description
Item Name Specific product (e.g., “1/4 Bend”, “90 Deg Elbow”)
Size Pipe/fitting size
Quantity Number of units
Material Dollars Total material cost for this line
Hours Total labor hours (= Field Hours for plumbing)
Field Hours THE column the app uses for labor hour assignment
Shop Hours Shop/fab hours (0 for most plumbing)
Critical: Field Hours is the total hours for the line. The app uses Field Hours directly – does
NOT multiply by quantity.
Real Data Stats (HHS Comprehensive Modernization, Bid 2339-25a)
12,846 line items across 36 systems
28,085.73 total field hours
$3,111,930.22 total material dollars
28 floors/levels across multiple buildings
15 zones
Systems with Default Cost Head Mapping
System Default Labor Cost Head Hours
Cold Water WATR 4,788h
Hot Water WATR 2,741h
Vent SNWV 2,551h
Waste SNWV 1,972h
Condensate - Interior COND 1,795h
BG Waste SNWV 1,720h
Gas NGAS 1,650h
Fixture FNSH 1,515h
Strm Drain STRM 1,402h
Overflow Drn. STRM 1,115h
Ind.Cold Wtr. WATR 1,091h
Acid Waste AWST 1,074h
Acid Vent AWST 912h
Ind.Hot Wtr. WATR 685h
BG Storm Drn BGSD 487h
BG M.P.Gas BGNG 385h
Demo DEMO 326h
Trap Primer TRAP 302h
Tempered Wtr. WATR 302h
Condensate - Exterior COND 261h
Med.Press.Gas NGAS 185h
Waste ABS SNWV 180h
BG Acid Waste BGAW 113h
Equipment SEQP 107h
BG Trp.Primer BGTP 96h
BG Vent BGWV 85h
BG Cold Water BGWT 81h
Fuel Oil Vent NGAS 48h
Indirect Drn. INDR 21h
BG Condensate BGCN 11h
SP Pmp.Discharge PMPD 4h
Material Specs to Material Cost Heads
Material Spec Material Cost Head
Copper Type L/K/M Hard/Soft COPR
CI - No-Hub (all variants) CSTF
CS Std.Wt.A53 CSTL
PVDF DWV Fusion PLST
ABS Sch 40 DWV PLST
PE Butt Fusion HDPE PLST
PP DWV Fusion PLST
No Matl Spec SPCL or SEQP depending on item type
3. Step 1: File Upload & Parsing
Components: FileUpload.tsx, AddFileDialog.tsx
Parsing Logic
1. Opens workbook, finds sheet with “raw” in name (or first sheet)
2. Scans first 15 rows to find the header row (must contain both “system” and “drawing” or
“material”)
3. Maps column positions by header text with fallbacks:
Material Dollars: header detection, fallback to Column Z (index 25)
Field Hours: header detection (“hours w/factor”, “field hours”, “total hours”), fallback
to Column AA (index 26)
4. Skips rows where System, Drawing, Material Desc, AND Item Name are all empty
5. Each row becomes an EstimateItem with sourceFile property for audit trail
Multi-File Support
Initial upload creates the project
“Add File” dialog appends additional files to same project
Items saved to estimate_items table with project ID
4. Step 2: Dataset Profiling
File: src/utils/datasetProfiler.ts
Automatically detects how the estimator encoded building/location data.
Pattern How Buildings Are Encoded Resolution Source
Pattern Floor column encodes building + level (e.g., “Bldg A -
Floor column
1 Level 2”)
Pattern
Zone column is the building identifier (e.g., “BLDG - A”) Zone column
2
Pattern
Floor is building, Zone is sub-zone Floor column
3
Pattern Drawing column
Minimal coding
4 fallback
Users can manually override via dataset_profile_override in project settings.
5. Step 3: Section Mapping
TIER 2 — VERIFY BEFORE TRUSTING: Section resolution logic described here is the
spec. Read resolveSectionStatic and resolveFloorMappingStatic directly for actual
behavior. (Floor to SEC)
Components: FloorSectionMapping.tsx, BuildingSectionMapping.tsx Hooks:
useFloorSectionMappings.ts, useBuildingSectionMappings.ts
Determines the SEC (first segment) of the cost code.
Resolution Process
1. resolveSectionStatic attempts automatic resolution using building + floor mappings
2. resolveFloorMappingStatic handles floor-to-activity-code translation
3. findBuildingMapping normalizes B-prefix/numeric mismatches (“B9” vs “9”)
4. User can override any auto-resolved section
5. Results stored per project in Supabase
Building to Section Code Examples
Building A -> “BA”
Building B -> “BB”
Building 3 -> “B3”
Building 12 -> “12”
Building 14 -> “14”
Site -> “ST”
Modular systems -> “MD”, “FP”, etc.
Special Floor Cases
Floor Value Default Activity Notes
Roof 00RF Needs zone/drawing for building context
UG (Underground) 00UG Needs building context
Crawl Space 00CS Needs building context
Site 00ST Maps to ST section
Site Above Grade 00AG Folds to ST in final summary
Database Tables
floor_section_mappings: Floor pattern -> section_code + activity_code
building_section_mappings: Building identifier -> section_code + zone_pattern
6. Step 4: System Mapping
TIER 2 — VERIFY BEFORE TRUSTING: The hardcoded
DEFAULT_COST_HEAD_MAPPING is a known bug (OPEN). Do not assume the described
priority chain is correctly implemented. (System to Cost Head)
Component: SystemMappingTab.tsx
Determines the COSTHEAD (last segment) of the labor cost code.
CRITICAL RULE: Labor cost heads assigned by SYSTEM. Material cost heads assigned by
MATERIAL TYPE. These are architecturally separate. Never mix them.
How It Works
1. App extracts all unique System values from estimateData
2. Each system displayed with item count and total hours
3. User assigns a cost head to each system
4. Applied mappings set costHead on every item with that system
PROBLEM: Hardcoded DEFAULT_COST_HEAD_MAPPING
Index.tsx ~line 372 has hardcoded regex patterns that assign cost heads (including DWTR)
BEFORE user mappings are checked. This must be removed. Cost heads must come only
from explicit user system mappings.
7. Step 5: Activity Code Resolution
Activity codes resolved per item based on Floor value:
Floor Pattern Activity Code
Level 1 00L1
Level 2 00L2
Level 3 00L3
Underground / UG 00UG
Roof 00RF
Crawl Space 00CS
Basement 00LB
Mezzanine 00MZ
Site 00ST
Default 0000
Stored in system_activity_mappings table per project.
8. Step 6: Labor Code Priority Hierarchy
For each estimate item, final labor cost code determined by this chain:
Priority 1: Explicit keyword rule (user-defined, per category)
(if no match)
Priority 2: Category labor mapping (category -> cost head)
(if no match)
Priority 3: System mapping (system name -> cost head) [THE MAIN ONE]
(if no match)
Priority 4: Item type mapping
(if no match)
Priority 5: Smart DB matching (cost_codes table fuzzy match)
(if no match)
Unassigned
DO NOT use DEFAULT_COST_HEAD_MAPPING hardcoded patterns as a priority level.
9. Step 7: Material Code Assignment
Material codes assigned separately from labor codes, based on Material Spec (not system).
All copper fittings -> same material code regardless of system (COPR)
All cast iron fittings -> same material code regardless of system (CSTF)
A copper 90 deg elbow in Cold Water gets the same material code as one in Hot Water.
Material code rules stored in material_code_rules table.
10. Step 8: finalLaborSummary Pipeline
TIER 2 — VERIFY BEFORE TRUSTING: Intended spec only. Read the actual useMemo in
BudgetAdjustmentsPanel.tsx and verify each stage. The +16h drift is still open — one
stage creates hours incorrectly.
Location: BudgetAdjustmentsPanel.tsx – the finalLaborSummary useMemo
THE CRITICAL COMPUTATION PIPELINE.
Input
adjustedLaborSummary: flat map of { “SEC ACT COSTHEAD”: { hours, dollars } } produced
by grouping all estimate items by full cost code key and summing field hours.
Output
finalLaborSummary: same structure after all transformations. SINGLE SOURCE OF TRUTH
for export.
Pipeline Stages (order is critical)
Stage 1: Section Alias Normalization
Converts numeric section prefixes to B-prefix canonical form.
“2 00UG SNWV” -> “B2 00UG SNWV”
“12 00RF WATR” stays “12 00RF WATR” (already canonical)
Stage 2: Fallback Section Folding
Groups with section prefixes CS, UG, RF, AG (without building context) get folded into their
matching building section.
Try 1: Find exact match (same cost head AND same activity code) in canonical section ->
add hours there, delete source.
Try 2: If no exact match, find head-only match (same cost head, any activity) -> create NEW
key preserving the ORIGINAL activity code but using canonical section. NEVER dump onto a
mismatched activity key.
If neither try succeeds, hours stay in fallback section.
Stage 3: Apply Saved Actions (from project_small_code_merges)
Action reassign_to_head value Behavior
EARLY RETURN – hours stay unchanged,
Keep keep
nothing deleted
EARLY RETURN – hours stay unchanged,
Accept accepted
nothing deleted
(has
Redistribute redistribute_adjustments Apply absolute hour deltas per activity code
JSON)
Reassign real cost head string Move all hours to target, delete source
null reassign + null
Merge Combine all activity codes into 0000 activity
redistribute
Reassign detail:
Search result for any key where section = sec AND head = reassignTo
If target found: accumulate hours into target, delete all source keys
If target NOT found AND reassignTo is a real cost head: create “${sec} 0000
${reassignTo}”, delete source keys
If reassignTo is a sentinel (redistribute, merge, ‘’): delete source keys, do NOT create
target
Sentinel guard in else/no-target branch:
const specialValues = ['__redistribute__', '__merge__', ''];
if (!reassignTo || specialValues.includes(reassignTo)) {
matchingKeys.forEach(k => delete result[k]);
return;
}
Note: keep and accepted are caught by EARLY RETURN above, NOT by this sentinel guard.
There must be NO dead “else if (targetKey)” branch. Only two paths: “if (targetKey)” and
“else”.
Stage 4: Zero-Hour Cleanup
Entries with < 0.05 hours deleted from result.
Stage 5: Largest Remainder Rounding
roundHoursPreservingTotal applies Largest Remainder rounding. Individual codes round to
whole numbers while total is preserved exactly.
Hour Reconciliation
After every pipeline run, log warning if sum(output hours) != sum(input hours). Any drift is a
bug. Current known drift: +16h (source not yet pinpointed – needs step-by-step logging).
11. Step 9: Small Code Review
TIER 2 — VERIFY BEFORE TRUSTING: Auto-suggestion rules described here are the
spec. Read standaloneAutoSuggestions useMemo directly to verify the actual
implementation matches.
Location: BudgetAdjustmentsPanel.tsx
What Are Small Codes?
Any cost code in finalLaborSummary with hours below minHoursThreshold (default 8h).
These appear in export at 1h after rounding.
Two-Tab Analysis
Merge Groups tab:
sec|head combination appearing across multiple activity codes, each individually under
threshold
User actions: Merge (-> single sec 0000 head), Redistribute (reallocate hours),
Reassign all
Standalone Codes tab:
sec|head appearing under only ONE activity code, hours below threshold
User actions: Reassign (move to another cost head in same section), Accept as-is, Keep
original
In Export Filter
Shows every entry currently under threshold in finalLaborSummary – the exact lines
appearing in the budget packet.
CRITICAL: In Export view must use hours from finalLaborSummary (ieRow.combinedHours),
NOT from standaloneGroups or savedOnlyRows (which have pre-merge hours). B2 00UG
SLVS at 1h in finalLaborSummary shows 1h in In Export – not 10h from standalone group.
Each In Export row = one exact SEC ACT COSTHEAD line from the export.
Auto-Suggestion Rules (priority order)
Rule 1: BG-to-Above-Grade Chain
BG Code Primary Target Fallback Targets
BGWV SNWV –
BGSD STRM –
BGWT DWTR -> WATR –
BGTP TRAP -> WATR -> DWTR –
BGGW GRWV -> SNWV –
BGAW AWST -> SNWV –
BGCN COND -> DWTR -> WATR –
BGPD PMPD -> STRM or SNWV (dynamic) –
Additional alias chains:
INDR -> [SNWV]
TRAP -> [WATR, DWTR]
COND -> [DWTR, WATR]
DWTR -> [WATR] (legacy correction)
Rule 2: Above-Grade System Codes (Peer Merge) For system codes (SNWV, WATR, STRM,
NGAS, etc.) – suggest the largest same-section code ABOVE the threshold. Never suggest
merging into another small code.
Rule 3: System Inference For category-based codes (SPCL, SLVS, HNGS): find which
systems contribute items, look up their mapped cost head, suggest that as merge target.
Rule 4: Peer-Merge Fallback If no other rule applies, suggest the largest code in same
section above threshold.
CRITICAL RULE: NEVER auto-suggest accepted. Auto-suggestions must always be a real
cost head merge target. accepted is only for manual user choice.
Cleanup Effects
1. Orphaned Merge Cleanup: Deletes saved actions for fallback sections (CS, RF, UG)
where source cost head has zero hours in raw data
2. Stale accepted Cleanup: Deletes saved accepted records where code’s actual hours in
finalLaborSummary are below threshold – forces re-resolution with proper merge
targets
12. Step 10: Budget Adjustments
Sales Tax
User enters jobsite ZIP code. System looks up California jurisdiction tax rate. Tax applied to
material codes (per-code taxable/non-taxable override). Custom rate input available.
Foreman Field Bonus (FCNT)
Strips configurable % (default 1%) of total field hours. Creates foreman incentive bonus =
stripped hours x bid labor rate. Exported as material line “GC 0000 FCNT”.
Fabrication Hours Strip
Per-labor-code configurable % strips (e.g., 15% of HNGS hours). Creates separate FAB
codes (e.g., “FP 0000 COPR”). Reduces field hours, creates distinct fabrication budget
lines.
LRCN
Rate-only contingency. Different rate from field rate, no hour change.
13. Step 11: Export
File: src/utils/budgetExportSystem.ts
What It Reads
budgetAdjustments.adjustedLaborSummary – misleading field name but it contains
finalLaborSummary data (fully-adjusted pipeline output). The export reads this, NOT raw
estimateData or filteredData.
Budget Packet Format
Single “Initial Budget” tab:
Project header (job name, date, prepared by)
LABOR BREAKDOWN: SEC ACT COSTHEAD | Description | Hours | Rate | Total Cost
MATERIAL BREAKDOWN: Cost codes with material dollar amounts
Labor Total, Material Total, Grand Total
Foreman Bonus as material line item
Rounding Standard
Largest Remainder Method – individual rounded hours sum to same total as original
fractional hours. Excel cells use #,##0 (whole numbers).
Normalization
Export detects and fixes duplicated cost code patterns (e.g., “BG 0000 BG 0000 BGGW” ->
“BG 0000 BGGW”).
14. Database Tables
Table Purpose
estimate_projects Project metadata
estimate_items All line items with assigned codes
system_mappings System -> Cost Head per project
floor_section_mappings Floor -> Section + Activity per project
building_section_mappings Building -> Section Code per project
category_labor_mappings Report Category -> Labor Code per project
category_item_type_overrides Category + Item Type -> Labor Code per project
category_material_desc_overrides Category + Material Desc -> Labor Code per project
system_activity_mappings System -> Activity Code per project
material_code_rules Material code assignment rules
project_small_code_merges Saved merge/reassign/redistribute actions
mapping_patterns Global learned labor mapping patterns
material_mapping_patterns Global learned material mapping patterns
cost_codes Company-wide cost code library
user_roles User role assignments
project_small_code_merges Schema
id uuid
project_id uuid
sec_code text -- e.g., "B2", "BA", "12"
cost_head text -- e.g., "SNWV", "SLVS"
action_type text -- "reassign" | "merge" | "redistribute" | "keep" | "accepted"
reassign_to_head text -- target cost head, or "__keep__" / "__accepted__"
merged_act text -- for merge actions: activity code merged from
redistribute_adjustments jsonb -- {activityCode: deltaHours}
created_at timestamptz
updated_at timestamptz
15. Key Constants & Mappings
Fallback Sections (fold during budget build)
CS, UG, RF, AG
Above-Grade Peer System Codes (excluded from cross-system merge)
DWTR, WATR, SNWV, STRM, NGAS, GRWV, RCLM, PMPD, FIRE, DEMO, AWST, COND, TRAP
BG-to-Above-Grade Chains
BGWV -> [SNWV]
BGSD -> [STRM]
BGWT -> [DWTR, WATR]
BGTP -> [TRAP, WATR, DWTR]
BGGW -> [GRWV, SNWV]
BGAW -> [AWST, SNWV]
BGCN -> [COND, DWTR, WATR]
BGPD -> [PMPD, STRM or SNWV (dynamic)]
Additional Alias Chains
INDR -> [SNWV]
TRAP -> [WATR, DWTR]
COND -> [DWTR, WATR]
DWTR -> [WATR] (legacy correction)
Hour Threshold
Default 8 hours – codes below this are flagged in Small Code Review.
Sentinel Values (action flags, never real cost heads)
__keep__ -- preserve hours, do nothing
__accepted__ -- user accepted as intentionally small, preserve hours
__redistribute__ -- action type flag
__merge__ -- action type flag
16. Critical Architectural Rules
NEVER violate these:
1. finalLaborSummary is the single source of truth – export reads ONLY from this
2. BudgetAdjustmentsPanel MUST always be mounted – never conditionally render it. Use
CSS show/hide, NOT conditional rendering based on estimateData.length > 0
3. Labor codes by SYSTEM, material codes by MATERIAL TYPE – never mix these
4. keep and accepted PRESERVE hours – they early-return WITHOUT deleting source
keys. They are NOT deletion sentinels.
5. No dead “else if (targetKey)” branch in reassign block – only “if (targetKey)” and “else”
6. In Export view uses ieRow.combinedHours – always from finalLaborSummary, never from
standaloneGroups.combinedHours or savedOnlyRows.combinedHours
7. No hardcoded cost head patterns – DEFAULT_COST_HEAD_MAPPING with DWTR and
other patterns must be removed
8. All console.warn/log inside finalLaborSummary useMemo must be wrapped in
import.meta.env.DEV
9. Hour totals must reconcile – sum(finalLaborSummary hours) must equal
sum(adjustedLaborSummary hours)
10. Sentinel values must never become result keys – if any key in result contains “__” it is a
bug
11. project_small_code_merges lifted to Index.tsx – prevents budget adjustments being lost
before Budget tab is visited
12. Export must use unfiltered data – estimateData not filteredData; UI filters must never
affect export totals
17. Known Bug Status & QC Checklist
FIXED (verified)
Reassign accepted early-return (was deleting source hours)
Dead “else if (targetKey)” branch removed
accepted removed from sentinel deletion guard (now in early-return guard)
Try 2 folding preserves activity codes (no more hour stranding)
Merge guard executes with 1 remaining source key
Additive merge does not overwrite existing merged entries
In Export view uses ieRow.combinedHours from finalLaborSummary
Stale accepted DB records cleaned up on load
accepted no longer used in auto-suggestions
Peer-merge target must be above threshold
Multitrade ACT format flipped to building-first (BA01) — was level-first (01BA),
which fragmented buildings on Excel sort. Single helper composeMultitradeActivity
in src/lib/utils.ts is the only ACT assembler for multitrade level-split. All five
assembly sites (Index.tsx memoizedLaborSummary, SystemMappingTab buildFullLaborCode
+ handleApplySectionCodes, FloorSectionMapping perBuildingBreakdown + the second
projection useMemo) gate on bldgSuffix.length ≤ 2 and route through the helper.
Helper throws on length > 2 as a regression alarm. FloorSectionMapping preview
sites previously composed level-split ACTs without a length gate, producing 5-char
strings like "01B12" for 3-char building IDs — fixed in the same patch by aligning
the gate with memoizedLaborSummary.
OPEN BUGS (priority order)
1. Hour drift +16h: finalLaborSummary output=27633 vs input=27617. Needs step-by-step
logging after EACH pipeline stage to pinpoint which step creates hours.
2. Console floods: budgetExportSystem.ts lines 322/326 not wrapped in
import.meta.env.DEV guard
3. DWTR hardcoded fallback: DEFAULT_COST_HEAD_MAPPING in Index.tsx ~line 372
assigns DWTR before user mappings
4. BudgetAdjustmentsPanel conditional render: Index.tsx ~line 2816 only renders when
estimateData.length > 0
5. Three copies of the level-prefix extractor exist (FloorSectionMapping
   extractMultitradeLevelPrefix, SystemMappingTab extractMultitradeLevelPrefix,
   Index.tsx extractLevelPrefixForSummary). Bodies are textually identical for the
   two extractMultitradeLevelPrefix copies; Index.tsx's variant adds 0B/0M cases.
   A separate extractLevelPrefixFromPattern in Index.tsx parses floor pattern text
   (different input domain). Consolidate the three activity-code extractors after
   verifying identical output for known inputs; rename for clarity:
   extractLevelFromActivityCode (act → prefix) vs extractLevelFromFloorPattern
   (pattern text → prefix).
6. Format logging during export: emit the composed ACT format (building-first vs
   legacy) in the export audit log so any future regression is visible in
   shipped packets.
QC Checklist (run before AND after any change)
sum(finalLaborSummary hours) == sum(adjustedLaborSummary hours) – check drift log
No keys in result containing “__” (sentinels never become cost codes)
No accepted or keep as result keys
In Export row hours exactly match budgetExportSystem.ts output
BudgetAdjustmentsPanel always in DOM (check React DevTools)
No unguarded console calls in finalLaborSummary useMemo
Auto-suggestions never produce accepted as a target
All peer-merge targets have hours >= minHoursThreshold
18. Key Files Reference
File Purpose
ALL budget adjustment logic,
finalLaborSummary useMemo, small code
src/components/BudgetAdjustmentsPanel.tsx
review UI, merge/reassign/redistribute logic,
In Export view
Excel export pipeline – reads
src/utils/budgetExportSystem.ts
budgetAdjustments.adjustedLaborSummary
Data loading, system/section mapping,
src/pages/Index.tsx auto-apply effects,
BudgetAdjustmentsPanel mounting
src/hooks/useCategoryMaterialDescOverrides.ts Material description override persistence
src/hooks/useBuildingSectionMappings.ts Building and section mapping persistence
src/hooks/useCategoryKeywordRules.ts Keyword-based cost head assignment rules
src/components/tabs/SystemMappingTab.tsx System -> cost head mapping UI
Auto-detects building/location encoding
src/utils/datasetProfiler.ts
pattern
AI Budget Chat edge function (Anthropic
supabase/functions/budget-chat/index.ts
API)
19. Data Flow Diagram
AutoBid .xlsm
| Upload + parse "Raw Data" sheet (~12,846 rows)
v
estimateData[] (EstimateItem: system, floor, zone, material spec, field hours, etc.)
| Dataset Profiling (detect building encoding pattern)
| System Mapping tab (system -> cost head, e.g., "Cold Water" -> WATR)
| Section Mapping tab (floor + building -> SEC + ACT, e.g., "Bldg A Level 2" -> BA 00L2)
| Category/keyword overrides (refine cost head per category)
| Material item overrides (individual item cost head adjustments)
| Group by "SEC ACT COSTHEAD", sum Field Hours
v
adjustedLaborSummary { "BA 00L2 WATR": {hours: 142.5}, "B3 00UG SNWV": {hours: 87.3}, ... }
| finalLaborSummary useMemo (BudgetAdjustmentsPanel.tsx)
| Stage 1: Section alias normalization (numeric -> B-prefix)
| Stage 2: Fallback section folding (CS/UG/RF/AG -> canonical building section)
| Stage 3: Apply savedMergesData (__keep__/__accepted__ early-return, redistribute, reassign, merge)
| Stage 4: Zero-hour cleanup (< 0.05h deleted)
| Stage 5: Largest Remainder rounding (whole numbers, total preserved)
v
finalLaborSummary { "BA 00L2 WATR": {hours: 142}, "B3 00UG SNWV": {hours: 87}, ... }
| Small Code Review (codes < 8h flagged)
| Merge Groups tab: multi-activity codes -> merge/redistribute
| Standalone Codes tab: single-activity codes -> reassign/accept
| In Export filter: exact finalLaborSummary lines, one row per SEC ACT COSTHEAD
| Budget Adjustments (sales tax, foreman bonus, fab strip, LRCN)
v
budgetExportSystem.ts (reads budgetAdjustments.adjustedLaborSummary = finalLaborSummary data)
v
Budget Packet .xlsx
LABOR BREAKDOWN: one row per SEC ACT COSTHEAD
Format: SEC ACT COSTHEAD | Description | # of Hours | Rate | Total Cost
This document is the authoritative reference for all development on this codebase. All code
changes must be verified against the QC checklist in Section 17. All changes must comply
with the architectural rules in Section 16.

20. PM Authority Rule

THE PM IS ALWAYS THE SOURCE OF ANY CODE ASSIGNMENT.

- System → cost head mapping: user assigns only.
  Auto-suggest may surface recommendations. No silent assignment.
- If a system has no mapping, route to uncoded state. Never fall back
  to a guessed code.
- No hardcoded cost head defaults anywhere in the pipeline.
- This rule cannot be overridden by any convenience feature.

Every time a fix touches cost head assignment logic, this rule gets checked first.
If the fix silently assigns anything, it gets rejected before any other review.

21. Technical Debt Log

- floor_section_mappings table lacks a building_identifier column. The only way to
  associate a floor mapping with a building is by parsing the floor_pattern string
  with a regex. When naming doesn't follow the "Bldg X - ..." convention (e.g.,
  "Modular Bldgs - Level 1"), the regex fails. A pragmatic fallback (match
  activity_code to building_identifier) is in place. The true fix is adding
  building_identifier as an optional FK column to floor_section_mappings, making the
  association explicit. When present, use it directly; when null, fall back to regex.