# Murray Budget Manager — Next Phase Spec

**Title:** Full Recap Integration
**Status:** Draft, pending approval
**Author:** Jonathan Rubin (Murray Company) + Claude (Anthropic)
**Prerequisite:** Raw AutoBid labor + material reconciliation shipped April 17, 2026 (see SESSION_AUDIT_APR17_2026.md)
**Scope phase 1:** Plumbing trade only. HVAC/Mechanical is a separate phase (see Section 8).

---

## 1. Background

### 1.1 Current state (end of April 17, 2026 session)
The Murray Budget Manager app ingests raw AutoBid/Rapid Report estimate exports and produces a budget that reconciles to **AutoBid raw data only**, plus a set of contingency lines that bridge the gap between AutoBid and the final bid:

- FCNT (foreman field bonus)
- LRCN (labor rate contingency — bid rate vs budget rate arbitrage at bid hour volumes)
- Fab LRCN (fab rate contingency)
- GC 0FAB CONT (unbudgeted shop hour volume contingency)
- GC 0FLD CONT (unbudgeted field hour volume contingency)

For Hamilton High, the app's labor export now reconciles to bid within 0.1% tolerance. Material export reconciles to raw AutoBid × sales tax. **Every dollar in the export is traceable to either AutoBid raw data or a named contingency line.**

### 1.2 The gap this phase closes
The bid recap worksheet contains **~$1M of material and several hundred thousand dollars of labor** that live outside AutoBid. Today, these recap layers are invisible to the app. PMs have no way to load, track, or budget against them.

For Hamilton High specifically:
- M&L Sheet line adjustments: +$97,360 material
- Material Factor 20%: +$641,858 material
- Consumables 3%: +$115,534 material
- Cartage 3%: +$115,534 material
- Equipment/Fixtures: +$1,412,251
- Excavation schedule: +$568,494
- Subcontractors: +$1,167,050
- Unit Price Sheet: +$245,201
- Labor Factor 25%: +7,243 hours (already incidentally absorbed by GC 0FLD CONT)
- General Conditions (G&A): $2,449,844
- Design fee, bonds, overhead, profit, markup, alternates

Total bid value = $16,237,635. App currently captures ~$7M of this (labor + material at AutoBid level with contingencies). **This phase aims to capture the full bid value, line by line, with full transparency.**

### 1.3 Trade scope
**Phase 1 = Plumbing only.** The plumbing bid recap structure is the only template fully analyzed. HVAC/Mechanical uses a different template with different worksheets, factor logic, and cost code conventions. Do not generalize plumbing assumptions to HVAC. See Section 8 for the HVAC architecture strategy.

---

## 2. Goals

1. **Full bid reconciliation.** The app must reconcile to the bid's Grand Total within the same 0.1% tolerance currently achieved for AutoBid raw. No opaque lump sums.

2. **Line-item traceability.** Every recap line in the estimator's Excel must be representable in the app. PMs must be able to answer "where did this dollar come from?" without opening the source Excel.

3. **Repeatability across jobs.** The recap structure (M&L Sheet, EQFIX, SUBS, UNIT PRICE SHEET, etc.) is the same template for every plumbing bid. Import must work for any Murray plumbing BRCAP file without manual mapping.

4. **No regression on raw data pipeline.** Everything working today (level-splitting, small-code consolidation, fab strips, FCNT, LRCN, GC 0FAB CONT, GC 0FLD CONT) must continue to work unchanged. Recap layers sit on top.

5. **Editable recap.** PMs must be able to adjust any recap line after import (budget buyout, value engineering, contingency release) and see changes propagate to export.

---

## 3. Non-goals (explicit)

- Replacing the estimator's Excel recap as the bid-creation tool. Estimator still builds the bid in Excel; the app only ingests and budgets against it.
- Automating the bid itself. No cost databases, no assembly logic, no pricing engines in this phase.
- Supporting non-Murray bid recap formats. All work assumes Murray's proprietary BRCAP template.
- HVAC/Mechanical support. Explicitly separate phase.
- Multi-trade combined budgets. Each trade is its own project for now.
- Alternates pricing or selection logic. Display only in this phase.

---

## 4. Recap structure reference (plumbing)

From the Murray Plumbing BRCAP template (Hamilton High file analyzed):

### 4.1 Worksheet inventory
| Worksheet | Contents | In app today? |
|---|---|---|
| Raw Data (AutoBid export) | Line-item material + labor takeoff | ✅ Fully ingested |
| MLSHT (M&L Sheet #1) | AutoBid total + line adjustments (NIPPLES, VALVES TAGS, DEMO, CORE DRILL, etc.) | ❌ Not captured |
| EQFIX (Equipment/Fixtures) | Fixture schedule (DF-11A, EEW, LS, etc.) + Equipment + Summary Recap + Material Factor + Tax + Consumables + Cartage + Labor breakdown by type (straight/shift/OT/DT/shop) + Supervision + Excavation rollup + GC/Subs/Fixtures/Excavation subtotals + Overhead/Profit/Markup + Grand Total | ❌ Not captured (partial: bid rates are entered in LRCN panel manually) |
| SUBS | Subcontractor rollup | ❌ Not captured |
| UNIT PRICE SHEET | Unit price line items | ❌ Not captured |
| FIELD G&A | General Conditions detail (with variations for Local 38, 342, 393, 467, D16, etc.) | ❌ Not captured |
| EQUIPMENT RENTAL | Rental cost detail | ❌ Not captured |
| PIPE & TANK EXCAVATION | Excavation detail | ❌ Not captured |
| BID BREAKDOWN | Bid item allocation by package + alternates | ❌ Not captured |
| BOND | P&P bond cost | ❌ Not captured |
| CREW (various locals) | Crew composition + wage rates | ❌ Not captured |
| UNIT PRICE RECAP + EXCAVATION + BREAKDOWNS | Rollups and check totals | ❌ Not captured |

### 4.2 Recap layer ordering (material side)
```
AutoBid raw material
+ M&L Sheet line adjustments (itemized)
= M&L Sheet #1 Total
+ 20% Material Factor
= Material Subtotal
+ 9.75% Sales Tax (applied to subtotal)
+ 3% Consumables
+ 3% Cartage
= Material + Burdens Subtotal ($4,457,703.67 for Hamilton)
+ Equipment/Fixtures ($1,412,251)
= Total Material + Equipment
```

### 4.3 Recap layer ordering (labor side)
```
AutoBid raw labor hours
+ M&L Sheet labor line adjustments (itemized)
= M&L Sheet #1 Labor Total
+ 25% Labor Factor
= Labor Hour Subtotal (36,214 for Hamilton)
× Labor rates by type (Straight/Shift/OT/DT/Shop)
= Labor Dollars Subtotal ($3,584,721 for Hamilton)
+ 15% Labor Supervision
= Field Labor Total ($4,122,454 for Hamilton)
```

### 4.4 Top-level bid assembly
```
Material + Tax + Burdens        $4,457,704
Labor + Supervision             $4,122,454
Equipment + Fixtures            $1,412,251  (from EQFIX sheet)
General Conditions (G&A)        $2,449,844  (from FIELD G&A)
Subcontractors                  $1,167,050
Excavation                        $568,494  (from PIPE & TANK EXCAVATION)
Unit Price Sheet                  $245,201
──────────────────────────────────────────
Total Direct Cost              $14,422,998
+ Overhead 10%                  $1,159,850
+ Profit 5%                       $637,917
+ Bond                                 ...
──────────────────────────────────────────
GRAND TOTAL                    $16,237,635
```

All percentages and rates are per-job configurable in the recap.

---

## 5. Phase 1 requirements — plumbing recap full integration

### 5.1 Data model additions

**New Supabase tables:**

```sql
-- Per-project recap configuration (percentages, rates, flags)
CREATE TABLE project_recap_config (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  trade text NOT NULL CHECK (trade IN ('plumbing', 'hvac', 'mechanical')),
  material_factor_pct numeric DEFAULT 0,        -- e.g., 20
  labor_factor_pct numeric DEFAULT 0,           -- e.g., 25
  consumables_pct numeric DEFAULT 3,
  cartage_pct numeric DEFAULT 3,
  supervision_pct numeric DEFAULT 15,
  overhead_pct numeric DEFAULT 10,
  profit_pct numeric DEFAULT 5,
  bond_cost numeric DEFAULT 0,
  tax_rate_override numeric,                    -- overrides ZIP-based default if set
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(project_id, trade)
);

-- M&L Sheet line adjustments (itemized additions outside AutoBid)
CREATE TABLE project_mlsheet_adjustments (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  line_number int NOT NULL,                     -- preserves order
  quantity numeric,
  description text NOT NULL,
  material_unit_cost numeric DEFAULT 0,
  material_extension numeric GENERATED ALWAYS AS (quantity * material_unit_cost) STORED,
  labor_unit_hours numeric DEFAULT 0,
  labor_extension_hours numeric GENERATED ALWAYS AS (quantity * labor_unit_hours) STORED,
  source text,                                  -- 'autobid', 'quote', 'manual', 'adjustment'
  cost_code_override text,                      -- if PM assigns a specific code, else inferred
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Equipment/Fixtures schedule (from EQFIX worksheet)
CREATE TABLE project_equipment_fixtures (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  category text CHECK (category IN ('fixture', 'equipment')),
  tag text NOT NULL,                            -- 'DF-11A', 'EEW-1wTMV', etc.
  quantity int,
  unit_cost numeric,
  extension numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  cost_code text,                               -- default 9510 MAJOR EQUIPMENT or 9525 FIXTURES
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Subcontractor rollup (from SUBS worksheet)
CREATE TABLE project_subcontractors (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  scope text NOT NULL,                          -- 'Insulation', 'Fire Safe Stop', etc.
  vendor text,
  amount numeric NOT NULL,
  cost_code text,                               -- 98xx series
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Excavation schedule (from PIPE & TANK EXCAVATION worksheet)
CREATE TABLE project_excavation (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  line_type text NOT NULL,                      -- 'Pipe Excavation', 'Pipe Backfill', etc.
  quantity numeric DEFAULT 1,
  unit_cost numeric,
  extension numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  cost_code text,                               -- 9634 EXCAVATION AND BACKFILL typically
  notes text
);

-- Unit Price Sheet line items
CREATE TABLE project_unit_prices (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_price numeric,
  extension numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  cost_code text,
  notes text
);

-- General Conditions line items (from FIELD G&A)
CREATE TABLE project_general_conditions (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  category text,                                -- 'Supervision', 'Office', 'Insurance', etc.
  description text NOT NULL,
  quantity numeric DEFAULT 1,
  unit_cost numeric,
  extension numeric GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  cost_code text,
  notes text
);

-- Alternates (ADD/DEDUCT items from BID BREAKDOWN)
CREATE TABLE project_alternates (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  alt_number int NOT NULL,
  description text NOT NULL,
  amount numeric,
  is_add boolean DEFAULT true,                  -- false = deduct
  is_accepted boolean DEFAULT false,
  notes text
);
```

All tables include RLS policies matching existing project-scoped access patterns.

### 5.2 Import flow

**Single entry point:** "Upload Bid Recap" button on project page. Accepts `.xlsm` Murray BRCAP workbook.

**Import service** reads the following sheets using SheetJS:
1. Raw Data → existing pipeline (unchanged)
2. MLSHT → populate `project_mlsheet_adjustments` (skip row 4 "AUTOBID" line — already captured from Raw Data)
3. EQFIX rows 4-6 → populate `project_recap_config` (material_factor_pct, labor_factor_pct from QTY column)
4. EQFIX Summary Recap section (rows 26-32) → extract tax_rate, consumables_pct, cartage_pct into `project_recap_config`
5. EQFIX fixture/equipment section → populate `project_equipment_fixtures`
6. EQFIX labor breakdown (rows 33-37) → populate existing `bid_rates` in `project_budget_settings` (straight/shift/OT/DT/shop hours and rates). Replace the manual LRCN panel entry.
7. SUBS → populate `project_subcontractors`
8. UNIT PRICE SHEET → populate `project_unit_prices`
9. FIELD G&A (variant matching project's local) → populate `project_general_conditions`
10. PIPE & TANK EXCAVATION → populate `project_excavation`
11. BID BREAKDOWN alternates section (rows 33-50) → populate `project_alternates`
12. BOND sheet → `project_recap_config.bond_cost`

**Import must be idempotent.** Re-uploading the same file overwrites prior import. Preserve manual edits made after import via a `user_edited` flag per row — edited rows are not overwritten, unedited rows are replaced with fresh values.

**Validation pass runs after import:**
- Compare imported recap Grand Total against computed assembly (tax + factors + burdens + labor + equipment + subs + GCs + excavation + unit prices + OH + profit + bond)
- If mismatch > 0.5%, flag the project with import warning and show delta breakdown to PM
- Log import timestamp and source filename for audit

### 5.3 UI additions

**New top-level tab:** "Recap" (between existing Estimates and Budget Builder tabs).

**Recap tab sub-sections** (each an expandable Card):
1. **Recap Configuration** — editable percentages and rates (Material Factor, Labor Factor, Consumables, Cartage, Supervision, Overhead, Profit, Tax Override, Bond)
2. **M&L Sheet Adjustments** — editable table of non-AutoBid line items
3. **Equipment / Fixtures** — editable schedule
4. **Subcontractors** — editable rollup
5. **Excavation** — editable schedule
6. **Unit Price Sheet** — editable line items
7. **General Conditions** — editable schedule (with local selector if project uses multiple locals)
8. **Alternates** — editable with accept/reject toggle per alternate

Each section shows:
- Total dollars (live-computed as PM edits)
- Item count
- Export preview (which cost codes will be generated)
- Last import source (filename + timestamp)
- "Edited since import" indicator on modified rows

**Budget Builder panel updates:**
- Bid Reconciliation card (existing) gains additional export line entries for each recap section
- New contingency lines appear in the export only when `project_recap_config` has non-zero values for the corresponding layer

### 5.4 Export pipeline updates

**`budgetExportSystem.ts` additions:**

New exported pure helpers (following `computeGcFabCont`/`computeGcFldCont` pattern):
```typescript
export function computeMaterialFactor(config, materialSubtotal): number
export function computeConsumables(config, materialSubtotal): number
export function computeCartage(config, materialSubtotal): number
export function computeLaborSupervision(config, laborSubtotal): number
export function computeOverhead(config, directCostSubtotal): number
export function computeProfit(config, directCostPlusOverhead): number
```

**Budget Packet export new sections:**

Material Breakdown section gains:
- All M&L Sheet adjustment lines (grouped by cost_code_override or inferred code)
- "MATERIAL FACTOR" line as % of (AutoBid + M&L adjustments)
- "CONSUMABLES" line
- "CARTAGE" line
- Equipment/Fixtures rows (each at its cost code — typically 9510/9525)
- Subcontractor rows (each at its 98xx code)
- Unit Price Sheet rows
- Excavation rows

New section: **General Conditions Breakdown**
- All G&A line items at their cost codes (GCON, and various GC codes per spec)

New section: **Alternates** (informational only, not added to totals unless `is_accepted = true`)

New section: **Summary Rollup**
- Direct Cost
- Overhead
- Profit
- Bond
- Grand Total

**Audit Report export** mirrors all new sections in the Summary tab.

### 5.5 Updated Bid Reconciliation readout

Card expands to show:
```
BID RECONCILIATION
─────────────────────────────────────────────
Bid Grand Total:                $16,237,635

Export Total:                   $16,234,127
  AutoBid raw labor + fab:      $2,552,217
  FCNT + LRCN + Fab LRCN:         $376,835
  GC 0FAB CONT + GC 0FLD CONT:    $682,313
  M&L labor adjustments:           [number]
  Labor Factor contingency:        [number]
  Supervision:                     [number]
  
  AutoBid raw material + tax:   $3,415,343
  M&L material adjustments:     [number]
  Material Factor:                [number]
  Consumables:                    [number]
  Cartage:                        [number]
  Equipment/Fixtures:           $1,412,251
  
  Subcontractors:               $1,167,050
  Excavation:                     $568,494
  Unit Price Sheet:               $245,201
  General Conditions:           $2,449,844
  Bond:                             [number]
  
  Overhead 10%:                 $1,159,850
  Profit 5%:                      $637,917

Delta:                              -$3,508  ✓ Green
```

Color thresholds scale with total: green <0.1%, yellow <0.5%, red ≥0.5%.

### 5.6 Cost code routing

Every imported line item must be assigned a cost code for export. Defaults:
- M&L material adjustments → user-selectable, default inferred from description pattern (NIPPLES → 9510, VALVE TAGS → 9523 PIDV, CORE DRILL → 9647, etc.)
- M&L labor adjustments → PL 00 0000 MSLB (miscellaneous labor) by default
- Equipment → 9510 MAJOR EQUIPMENT
- Fixtures → 9525 FIXTURES
- Subcontractors → 98xx series by scope (insulation → 9801, concrete → 9805, etc.)
- Excavation → 9634 EXCAVATION AND BACKFILL
- Unit Price Sheet → user-selectable
- General Conditions → GCON by default, finer routing by category (SUPR for Supervision, OFEQ for office equipment, etc.)
- Overhead → 0000 OVERHEAD material line
- Profit → 0000 PROFIT material line
- Bond → 0000 BOND material line

Build a **Recap Code Mapping** config page where PMs can override default routing patterns per company (not per project). This becomes the Murray-specific knowledge base.

### 5.7 Hour reconciliation

All new labor-bearing sections (M&L labor adjustments, Labor Supervision, Excavation labor, G&A labor) must participate in the existing hour reconciliation gate. Hours from these sources roll into `totalFieldHours` and `totalFabHours` calculations as appropriate, so FCNT/LRCN/GC 0FLD CONT math remains correct.

### 5.8 Validation & edge cases

- **Missing worksheets:** If BRCAP file is missing EQFIX or any required sheet, show import error with specific missing sheets listed. Don't partial-import.
- **Factor = 0:** If labor factor or material factor is 0%, no factor line is added to export. Existing GC 0FLD CONT handles volume gap without needing the factor layer.
- **Negative quantities:** M&L Sheet allows deducts (Acid Waste & Vent PVDF -1). Must preserve sign through export.
- **Alternate acceptance state:** Export excludes unaccepted alternates from totals; accepted alternates flow through as additional line items with their own cost code routing.

---

## 6. Phase 1 implementation order

### Sprint 1: Data model + import (2 weeks)
- Create all Supabase tables with RLS
- Build BRCAP import service with tab-by-tab parsers
- Implement idempotent re-import with `user_edited` preservation
- Validation pass comparing imported Grand Total to computed assembly

### Sprint 2: Recap tab UI (2 weeks)
- Build Recap tab with all 8 sections
- CRUD for each table (add/edit/delete rows)
- Per-section totals, live recompute on edit
- "Edited since import" indicators

### Sprint 3: Export pipeline integration (2 weeks)
- Add new helpers to `budgetExportSystem.ts`
- Extend Budget Packet with all new sections
- Extend Audit Report Summary tab
- Wire hour reconciliation from new labor sources

### Sprint 4: Bid Reconciliation readout + polish (1 week)
- Expand Bid Reconciliation card to full Grand Total reconciliation
- Color thresholds recalibrated for full bid
- Per-section drill-down expand/collapse
- Full Hamilton High proof of reconciliation

### Sprint 5: Validation on non-Hamilton projects (1 week)
- Test with Culver Crossing, ABMC, Rancho, and 2-3 other plumbing projects
- Identify any template variations not captured in spec
- Ship hotfixes for variations

**Total Phase 1: 8 weeks.**

---

## 7. Architectural principles (non-negotiable)

### 7.1 Helper extraction for drift prevention
Every calc used in both export and UI must be a pure exported function. No duplicated math. No "comments as enforcement." The helper is the contract.

### 7.2 Contingency lines for uncovered gaps
When any layer cannot fully reconcile, the residual must be a named, visible contingency line in the export. No silent drops. No opaque lump sums. PMs and auditors must be able to follow every dollar.

### 7.3 Idempotent imports
Re-importing the same file produces the same result. User edits survive re-import via `user_edited` flags. Never destroy manual work.

### 7.4 Editability everywhere
Every imported value is editable by the PM. The app is the source of truth after import; the BRCAP file is the initial seed. Budget decisions made in the app (buyout savings, VE accepted, contingency release) must flow to export.

### 7.5 Trade separation at schema level
The `trade` field on `project_recap_config` is the gate. Plumbing logic never runs on HVAC projects and vice versa. This prevents accidental cross-contamination.

### 7.6 No cost databases in this app
The app does not maintain material/equipment pricing databases. It ingests and budgets; it does not price. All pricing lives in the estimator's tools (AutoBid, Trimble, vendor quotes). This keeps the app focused and avoids becoming a second source of truth for estimating.

---

## 8. HVAC/Mechanical — separate future phase

### 8.1 Why HVAC is different
HVAC uses a completely different recap template. The fundamental structure differs from plumbing:

- **Estimate source:** Typically Trimble AutoBid Mechanical (dryside) or QuickPen for piping side. Different export formats than plumbing AutoBid.
- **Worksheet structure:** HVAC BRCAP has different sheets — air distribution, ductwork, equipment hookup, refrigerant piping, controls, T&B, start-up, balancing.
- **Factor logic:** HVAC doesn't use the same 20%/25% material/labor factor model. Common to see equipment-specific burden markups, ductwork labor factors, refrigerant piping premiums.
- **Cost code usage:** HVAC draws heavily from a different subset of Murray's code library. Sheet metal (SMTL), fabricated duct (9560), air distribution (9566), AH-RTUs (9564), exhaust fans, VAV boxes, controls. Plumbing codes like SNWV, STRM, DWTR are irrelevant.
- **Labor classification:** HVAC uses Sheet Metal Workers (Local 105) alongside Pipefitters (Local 250 etc.). Different union rates, different supervision structures.
- **Equipment scheduling:** Major equipment (chillers, boilers, air handlers, pumps, cooling towers) dominates the budget — often 40-60% of cost. Equipment tracking needs dedicated schedule management that plumbing doesn't.
- **Multi-trade jobs:** Mechanical projects often combine HVAC + piping + plumbing + controls. Need per-trade recap under one project umbrella.

### 8.2 Architecture for HVAC addition
**Do NOT extend plumbing schema to fit HVAC.** The correct approach:

1. `project_recap_config.trade` already has `'hvac'` and `'mechanical'` as valid values.
2. Create new HVAC-specific tables: `project_hvac_equipment_schedule`, `project_hvac_duct_fabrication`, `project_hvac_refrigerant`, etc. Do not reuse `project_equipment_fixtures` even if the shape looks similar.
3. HVAC BRCAP import service is a separate service from plumbing. It reads different sheets, applies different factor math, routes to different cost codes.
4. Recap tab UI renders different sections per trade (React switch on `project.trade`).
5. Export pipeline branches on trade at the top level — `exportBudgetPacket_plumbing` vs `exportBudgetPacket_hvac`, or a strategy pattern.

**Shared infrastructure** (across trades):
- Core reconciliation architecture (helper-extracted contingency math)
- FCNT / LRCN / foreman strip pattern
- Hour reconciliation gate
- Small code consolidation
- Level splitting (if applicable)
- Bid Reconciliation readout pattern
- Audit Report structure

**Per-trade infrastructure:**
- Import parsers
- Cost code routing defaults
- Factor/burden math
- Schedule types (fixtures vs equipment vs ductwork)
- UI sections

### 8.3 HVAC as separate phase timeline
**After plumbing Phase 1 is proven on 3-5 real projects**, a parallel HVAC phase can start. Estimated 8-10 weeks similar scope.

**Do not start HVAC implementation before plumbing recap is stable.** The architecture patterns from plumbing (edited live on Hamilton High) must be validated before they're generalized.

---

## 9. Open questions for Jonathan

Answers required before Sprint 1 starts:

1. **Material Factor across jobs:** Is 20% universal for plumbing, or does it vary? If it varies, is it predictable (per-client, per-package, per-GC), or truly per-job?
2. **Labor Factor:** Same question — is 25% universal?
3. **Consumables 3% / Cartage 3%:** Universal or per-job?
4. **Supervision 15%:** Universal or varies by union local?
5. **Overhead 10% / Profit 5%:** Standard company rates?
6. **Default tax treatment on Material Factor itself:** Tax computed on (AutoBid + M&L + Factor) or just (AutoBid + M&L)? Current recap does the former.
7. **M&L Sheet line adjustment cost code routing:** What's the pattern? Does estimator maintain a known list of common adjustments, or is each one ad-hoc?
8. **Equipment/Fixtures schedule source:** Is EQFIX tag data always keyed to spec drawings, or can it be free-form?
9. **Subcontractor code routing:** Does Murray maintain a vendor-to-98xx-code mapping, or is it per-bid judgment?
10. **G&A by union local:** Does the app need to know which local the project uses, or is G&A always picked manually per project?
11. **Alternates:** When an alternate is accepted post-award, does it flow into the budget the same as a base bid item, or tracked separately as a change?
12. **Bond calculation:** Is bond a fixed cost from the BOND sheet, or a % of contract value? Does it vary by project?

---

## 10. Success criteria

Phase 1 is complete when:

1. ✅ BRCAP import ingests a full plumbing recap in <30 seconds with no manual intervention
2. ✅ Re-import preserves user edits, replaces unedited imported values
3. ✅ Hamilton High Budget Packet export reconciles to $16,237,635 bid within 0.1% tolerance
4. ✅ Audit Report shows every recap layer as separate line items
5. ✅ Bid Reconciliation card displays live delta as PM edits any recap section
6. ✅ At least 3 non-Hamilton plumbing projects imported and reconciled successfully
7. ✅ No regression on existing AutoBid pipeline (level-splitting, small codes, fab strips, FCNT, LRCN, GC 0FAB/FLD CONT all still work)
8. ✅ Documentation written for adding new recap line types

---

## 11. Deferred scope (not Phase 1)

- Integration with AutoBid / Trimble / QuickPen for direct estimate pull (stays upload-based)
- Integration with Procore / CMiC / other accounting for budget export to PM systems
- Budget vs Actual tracking (separate phase — requires timecard and vendor invoice ingestion)
- Change Order integration (separate skill pipeline already in place)
- Multi-project rollup dashboards
- Historical bid analytics (factor trending, burden variation by client)
- Estimator feedback loop (flagging AutoBid shortages so estimator can adjust template)
- Template auto-detection (if Murray adopts new BRCAP format, import service needs version awareness)
- Lump sum bids (spec assumes BRCAP-style line-item bid)
- Design-build / GMP contract types

---

## 12. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| BRCAP template varies between estimators | High | Medium | Validation pass catches structural mismatches; hotfix import parsers as variations found |
| PM edits lost on re-import | Medium | High | `user_edited` flag per row; never overwrite edited rows |
| Factor percentages change mid-job | Medium | Medium | All percentages editable; export recomputes on save |
| Hour reconciliation breaks when new labor sources added | High | High | Extend existing hour balance gate to include recap labor lines; test case per added source |
| Cost code routing defaults wrong for specific estimators' habits | High | Low | Build Recap Code Mapping config; easily adjustable per company |
| Recap tab becomes too cluttered | Medium | Low | Expandable/collapsible sections; search/filter within sections |
| Import takes too long on large files | Low | Medium | Web Worker parsing; progress indicators per sheet |
| HVAC work starts before plumbing stable | High | High | Explicit phase gate — plumbing must ship to 3 projects before HVAC starts |
| Architecture drift when Lovable proposes own approach | High | Medium | Claude reviews every Lovable plan against CLAUDE.md before approval |

---

## 13. References

- Session audit: `SESSION_AUDIT_APR17_2026.md`
- Hamilton BRCAP file analyzed: `Copy_of_Hamilton_HS_-_RE-BID_8-25-25_Plumbing_BRCAP_R1_contract_value.xlsm`
- Murray standard cost codes: in `budgetExportSystem.ts` `COST_CODE_LOOKUP` (862 codes)
- Current reconciliation helpers: `budgetExportSystem.ts` `computeGcFabCont`, `computeGcFldCont`
- CLAUDE.md: project root (Tier 1 domain knowledge, Tier 2 implementation specs)

---

**End of spec.**
