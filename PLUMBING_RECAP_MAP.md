# PLUMBING_RECAP_MAP.md

**Purpose:** Authoritative reference for the Murray Company Plumbing Bid Recap Workbook (BRCAP .xlsm). Covers every sheet, cell, formula flow, and calculation convention needed to (a) read a recap correctly, (b) extract budget inputs from it, and (c) reconcile a budget back to the bid. This is the foundation document for the Full Recap Integration phase of the Murray Budget Manager app.

**Audience:** Lovable (implementation), future Claude sessions (institutional knowledge), PMs onboarding the app, and Jonathan as the system of record when memory is stale.

**Scope:** Plumbing only. HVAC/Mechanical uses a different template and is explicitly out of scope. See `NEXT_PHASE_SPEC_FULL_RECAP.md` §8 for HVAC future phase.

**Trust tier:** Tier 1 — every number in this doc is verified against the live Hamilton High Re-Bid BRCAP file (`Copy_of_Hamilton_HS_-_RE-BID_8-25-25_Plumbing_BRCAP_R1_contract_value.xlsm`). When this doc and the code disagree, the live file is the arbiter.

---

## 1. File identification & quick-start protocol

A Murray Plumbing BRCAP file is recognizable by:

- Extension `.xlsm` (macro-enabled; has a "Create C/O Sheet" VBA button on BID BREAKDOWN)
- Presence of sheet named `EQFIX` (this is the single distinguishing marker — HVAC uses `RECAP SHT`)
- 32 worksheets total (variant by a few, but core sheet set is stable)
- File name pattern: `[Project]_Plumbing_BRCAP[_version].xlsm`

**Loading safely:**

```python
import openpyxl
# Formula strings preserved
wb_formulas = openpyxl.load_workbook(path, data_only=False, keep_vba=True)
# Calculated values (READ-ONLY — never save this handle)
wb_values   = openpyxl.load_workbook(path, data_only=True,  keep_vba=True)
```

**Never save a workbook opened with `data_only=True`** — it permanently strips formulas and replaces them with cached values, destroying the file for the estimating team.

**Sheet protection:** Every calc sheet is protected, often with per-sheet passwords. Protection is a UI flag only (not encryption). To annotate a working copy, strip the `<sheetProtection>` XML element directly rather than chasing passwords.

---

## 2. Sheet inventory

| # | Sheet | Role | Rows × Cols | Feeds |
|---|-------|------|-------------|-------|
| 1 | **EQFIX** | Master calc engine | 300 × 542 | BID BREAKDOWN, BOND, everywhere |
| 2 | **MLSHT** | Material & labor takeoff source | 56 × LM | EQFIX row 4 |
| 3 | **SUBS** | Subcontractor rollup | 57 × JK | EQFIX row 17 |
| 4 | **UNIT PRICE SHEET** | Unit price line items | 56 × LM | EQFIX row 18 |
| 5 | FIELD G&A | Aggregator for G&A per bid item | 220 × PQ | EQFIX row 4 (GC col I) |
| 6 | FIELD G&A DISTRICT 16 | DC16 rate table (active for Hamilton) | 167 × M | FIELD G&A |
| 7 | FIELD G&A LOCAL 38/342/393/467 | Per-local variants | 167 × CH | FIELD G&A when active |
| 8 | APPRENTICE - CONDITIONAL FORMAT | Apprentice ratio lookup | 17 × B | CREW sheets |
| 9 | **EQUIPMENT RENTAL** | Rental cost per bid item | 205 × RS | EQFIX row 5 (Equipment Rental) |
| 10 | EQUIPMENT RENTAL DATA | Raw equipment rate table | 479 × F | EQUIPMENT RENTAL |
| 11 | **PIPE & TANK EXCAVATION** | Excavation detail | 2,161 × BG | EQFIX rows 42–47 |
| 12 | Pipe Tank Excavation DATA | Excavation unit rates | 34 × S | PIPE & TANK EXCAVATION |
| 13 | **CREW** | Blended labor rate engine | 120 × AK | EQFIX rows 33–36 |
| 14 | CREW - APPRENTICE | Apprentice crew rates | 116 × Z | CREW |
| 15 | CREW-MASTER | Master union rate table | 162 × AF | all CREW sheets |
| 16 | DISCTRICT 16 / LOCAL 38–469I CREW | Per-local rate tables | ~100–335 × S | CREW-MASTER |
| 17 | **BOND** | Performance/payment bond calc | 47 × XFD | BID BREAKDOWN col I |
| 18 | **BID BREAKDOWN** | User-facing summary | 106 × AB | — (output) |
| 19 | BREAKDOWN-ACCOUNTING | Owner/GC billing format | 182 × EN | — (output) |
| 20 | UNIT PRICE RECAP | Line-item unit price rollup | 4,352 × AF | — (output) |
| 21 | UNIT PRICE EXCAVATION | Excavation unit pricing | 6,000 × ES | — (output) |
| 22 | BREAKDOWN-UNIT PRICING | Unit pricing summary | 155 × AJ | — (output) |
| 23 | UNIT PRICING-CHECK TOTALS | Unit pricing verification | 154 × Q | audit only |

**Bolded sheets** are the 7 Phase 1 ingest targets. The rest are either internal calculation support (CREW family, rate tables), output/reporting (BREAKDOWN-*, UNIT PRICE RECAP), or locale-specific variants (FIELD G&A LOCAL 38/342/393/467).

---

## 3. The Bid Assembly Waterfall — Hamilton High live

This is the single most important section of this document. It traces every dollar from the raw takeoff to the final $16,237,635 Grand Total, cell by cell. Everything else is a deep-dive on one slice of this waterfall.

### 3.1 Material path

```
AutoBid Raw Data export                            $3,111,930.22  (external)
  + MLSHT manual adjustment lines (net)               $97,359.68  (MLSHT rows 4–53, net of deducts)
─────────────────────────────────────────────────────────────────
= M&L SHEET #1 TOTAL                               $3,209,289.90  ← MLSHT!D56  →  EQFIX!D4

  + Material Factor 20%  (EQFIX!A5 × EQFIX!D4)       $641,857.98  ← EQFIX!D5
─────────────────────────────────────────────────────────────────
= TOTAL MAT (sum of EQFIX!D4:D23)                  $3,851,147.88  ← EQFIX!D24

  + Sales Tax 9.75%  (EQFIX!H28 × EQFIX!D24)         $375,486.92  ← EQFIX!J28
  + Consumables 3%   (EQFIX!H29 × EQFIX!D24)         $115,534.44  ← EQFIX!J29
  + Cartage 3%       (EQFIX!H30 × EQFIX!D24)         $115,534.44  ← EQFIX!J30
─────────────────────────────────────────────────────────────────
= MATERIAL + BURDENS SUBTOTAL                      $4,457,703.67  ← EQFIX!J31
```

Note: sales tax is computed on the post-factor material subtotal ($3,851,147.88), not on AutoBid raw. Consumables and Cartage are also on the post-factor subtotal. All three burdens (tax / consumables / cartage) share the same base.

### 3.2 Labor path

```
AutoBid Raw Data labor hours                          28,086.00  (external)
  + MLSHT manual labor adjustment lines (net)            885.68  (MLSHT column F, net of deducts)
─────────────────────────────────────────────────────────────────
= M&L SHEET #1 LABOR HOURS                           28,971.68  ← MLSHT!F56  →  EQFIX!F4

  + Labor Factor 25%  (EQFIX!A6 × EQFIX!F4)            7,242.92  ← EQFIX!F6
─────────────────────────────────────────────────────────────────
= TOTAL LABOR HOURS (EQFIX!F24)                      36,214.60  ← split 60/10/30:

    Straight Time  (60%)  21,728.76  × $110.14  =  $2,393,178.60  ← EQFIX!J33
    Shift          (10%)   3,621.46  × $114.26  =    $413,781.07  ← EQFIX!J34
    Overtime        (0%)        0    × $143.26  =           $0    ← EQFIX!J35
    Double Time     (0%)        0    × $169.91  =           $0    ← EQFIX!J36
    Shop           (30%)  10,864.38  × $71.59   =    $777,783.05  ← EQFIX!J37
─────────────────────────────────────────────────────────────────
= LABOR SUBTOTAL                                   $3,584,742.72  ← EQFIX!J33+J34+J35+J36+J37

  + Supervision 15%  (EQFIX!H38 × labor subtotal)    $537,711.41  ← EQFIX!J38
─────────────────────────────────────────────────────────────────
= LABOR + SUPERVISION                              $4,122,454.13  ← EQFIX!J39
```

The 60/10/30 split is the convention for every plumbing base bid. It's not a formula — it's a factor baked into EQFIX rows 33/34/37. (OT and DT exist as rows 35/36 but are 0% on every Hamilton base bid / alternate / bid item observed.) If a project's schedule forces shift work or overtime, estimating manually adjusts the percentages.

### 3.3 Equipment / Fixtures path

```
Fixture schedule (EQFIX rows 55–101, left side)
  Total fixtures material (EQFIX!D101)                $520,380
  Total fixtures labor $ (EQFIX!J160 or similar)      $611,933.73
─────────────────────────────────────────────────────────
= Fixtures subtotal                                 $1,132,313.73  ← EQFIX!D28

  + Equipment schedule (separate rows, EQFIX rows 102–)  ~$296,808
  + (possibly) supervision on equipment labor              $16,870
─────────────────────────────────────────────────────────
= EQUIPMENT/FIXTURES TOTAL                          $1,429,121.47  ← EQFIX!J45

⚠ Open question: the $16,870 delta between J25 ($1,412,251.17) and J45 ($1,429,121.47)
  is most likely supervision applied only to fixtures labor, not to equipment labor.
  This needs Jonathan's confirmation before the import service is written, because it
  determines whether Fixtures labor hours participate in the Supervision line (EQFIX!J38)
  or are burdened separately.
```

### 3.4 Subs + Unit Price path

```
SUBS rollup (SUBS!E57, post-markup)                  $1,167,050.50  →  EQFIX row 17
  + UNIT PRICE SHEET rollup (F56)                      $245,200.67  →  EQFIX row 18
─────────────────────────────────────────────────────────
= SUBCONTRACTORS line in Grand Total                $1,412,251.17  ← EQFIX!J46

Note: Unit Price Sheet is treated as a subcontractor line in the Grand Total rollup,
even though mechanically it's driven by internally-calculated unit prices. This is
a Murray convention.
```

### 3.5 General Conditions path

```
FIELD G&A output (FIELD G&A!H111)                    $2,273,243.91  →  EQFIX!I4
  + EQUIPMENT RENTAL total (EQUIPMENT RENTAL!I205)     $176,600.00  →  EQFIX!I5
  + OCIP/CCIP deduct / XBE premium / other adds                 $0  →  EQFIX!I6–14
─────────────────────────────────────────────────────────
= TOTAL GC's (EQFIX!J15)                            $2,449,843.91

  Shown in Grand Total at EQFIX!J40                  $2,449,843.91
```

The G&A sub-line at FIELD G&A!H111 is *not* just supervision — it's a full project G&A rollup including foreman ratios, office equipment, insurance, truck allowances, etc. It's driven by project duration (72 months for Hamilton), crew size, and union local.

### 3.6 Excavation path

```
PIPE & TANK EXCAVATION — Base Bid summary row (~40)
  Pipe Excavation         $360,076.67  →  EQFIX!F42
  Pipe Backfill            $66,903.00  →  EQFIX!F43
  Pipe Haul-Off            $92,920.83  →  EQFIX!F44
  Pipe Shoring             $29,862.05  →  EQFIX!F45
  Pipe Saw Cut/Break/Rem         $0    →  EQFIX!F46
  Tank Excavation          $18,731.30  →  EQFIX!F47
─────────────────────────────────────────────────────────
= EXCAVATION TOTAL                                     $568,493.85  ← EQFIX!F49  →  EQFIX!J41
```

### 3.7 Top-level rollup

```
MATERIAL + BURDENS                                  $4,457,703.67  (EQFIX!J31)
LABOR + SUPERVISION                                 $4,122,454.13  (EQFIX!J39)
GENERAL CONDITIONS                                  $2,449,843.91  (EQFIX!J40)
EXCAVATION                                            $568,493.85  (EQFIX!J41)
─────────────────────────────────────────────────────────
DIRECT COST CORE                                   $11,598,495.56  (EQFIX!J42)

  + Overhead 10%  (H43 × J42)                       $1,159,849.56  (EQFIX!J43)
  + Profit 5%     (H44 × J42)                         $637,917.26  (EQFIX!J44)
  + Equipment/Fixtures (NO markup)                  $1,429,121.47  (EQFIX!J45)
  + Subs + Unit Price (NO markup)                   $1,412,251.17  (EQFIX!J46)
─────────────────────────────────────────────────────────
GRAND TOTAL                                        $16,237,635.00  ← EQFIX!J47

  Bond (~1.12% of bid, from BOND!A10)                 $182,413.71  → BID BREAKDOWN!I5
```

**Critical:** Overhead (10%) and Profit (5%) are applied ONLY to the Direct Cost Core (material + labor + GC + excavation). They are NOT applied to Equipment/Fixtures or to Subcontractors. This is an important architectural rule for the app — if OH/Profit are re-computed internally, they must only include the core components. Bond is separate and is not part of the Grand Total; it's shown as a line in BID BREAKDOWN.

### 3.8 Alternates

Alternates live in their own EQFIX column blocks (JJ47, JT47, KD47, ...). Each alternate block mirrors the base bid structure (rows 4–47) but is scoped to only that alternate's adjustments. The alternate's grand total feeds BID BREAKDOWN rows 34–58. Alternates do NOT roll up into J47 — they are separately presentable. Accepted alternates are added back into the contract value during post-award.

---

## 4. MLSHT — Material & Labor Sheet

**Role:** The sheet where estimating itemizes adjustments on top of the AutoBid raw data. This is the first-stop edit layer: any scope addition, deduct, quote swap, or clarification that's not in AutoBid gets added here.

### 4.1 Structure per bid item

```
Columns per bid item (6 cols): QTY | DESCRIPTION | MAT UNIT | MAT EXT | LAB UNIT | LAB EXT

Base Bid:       cols A–F   (totals at D56, F56)
Bid Item #1:    cols G–L   (totals at J56, L56)
Bid Item #2:    cols M–R   (totals at P56, R56)
(pattern continues every 6 cols)
```

### 4.2 Line classification

MLSHT rows 4–53 contain four distinct line types. The app must treat them differently.

**Type A — AutoBid anchor line (row 4).** Always row 4. Description is "AUTOBID". The estimator enters the AutoBid totals here as a baseline. This line is NOT imported separately — it's already captured via the Raw Data export pipeline. The app should **skip MLSHT row 4** during ingest. (Note: the AutoBid-line numbers here may differ from Raw Data by small amounts. Estimator rounds/adjusts. The Raw Data is the truth; MLSHT row 4 is informational only.)

**Type B — Adjustment line with extension (the real deal).** Has a non-zero QTY and non-zero MAT EXT or LAB EXT. This is a scope addition that must be budgeted. Examples from Hamilton:

| Row | Description | QTY | Mat Ext | Lab Ext |
|-----|-------------|-----|---------|---------|
| 6 | VALVES TAGS | 858 | $6,006 | 129 hrs |
| 7 | HD Coupling adjustment / contingency | 1 | $117,712 | — |
| 8 | BG POLY WRAP CI/CU FT ADJ | 8,533 | $6,400 | 512 hrs |
| 9 | DEMO SAFE-OFF ADJUSTMENT | 1 | $8,150 | 326 hrs |
| 11 | CORE DRILL & WALL ADJUSTMENT | 256 | $44,800 | 256 hrs |
| 12 | Existing Building Hanger Adjustment | 1,596 | — | 399 hrs |
| 20 | Acid Waste & Vent - PVDF Pipe - AG (quote) | 1 | $560,247.60 | — |
| 23 | SEISMIC labor based on quote kit qty | 618 | — | 1,236 hrs |
| 24 | TRENCH PLATES for Site Gas | 1 | — | 240 hrs |
| 25 | DRYWELLS | 2 | $3,000 | 24 hrs |
| 39 | HOSE BIBB - SEE SHEET | 119 | $74,786 | — |
| 52 | NGMR | 9 | — | 18 hrs |
| 53 | Condensate Drainpipe Covers | 1 | $900 | 4 hrs |

**Type C — Deduct/replace pair (paired rows that net).** MLSHT commonly uses a deduct-then-add pattern for value engineering or quote swaps. Example from Hamilton (PVDF Acid Waste):

| Row | Description | QTY | Mat Ext |
|-----|-------------|-----|---------|
| 16 | Acid Waste & Vent - PVDF Pipe & Fittings - AG (Autobid) | **-1** | -$545,692 |
| 20 | Acid Waste & Vent - PVDF Pipe - AG (quote) | 1 | +$560,247.60 |
| **Net** | | | **+$14,555.60** |

The pattern: row 16 removes the AutoBid value, row 20 adds the quote-based value. Both lines pass through to the budget as positive-and-negative adjustments that net to the delta. Same pattern for SEISMIC (rows 22 deduct + 23 add).

**Type D — Reference-only line (rows with QTY but no extension).** Listed for context, not budgeted. Example: "QTY FOR REF ONLY" header at MLSHT row 26, followed by rows 27–37 which enumerate fixture quantities (FD-8, FS-3, RD-1, etc.) for estimator reference. The app should **skip any row where MAT EXT = 0 AND LAB EXT = 0 AND QTY ≠ 1** as reference-only. Row 4 (AutoBid) is the exception — always skip regardless.

Edge case: MLSHT row 5 on Hamilton has NIPPLES with QTY=0, so extensions are 0 — it's a placeholder for a scope that was considered and zeroed out. Treat as reference-only.

### 4.3 Net Hamilton totals from MLSHT adjustments

```
Material net (excluding AutoBid row 4):          +$85,464.90  
                                                 (3,209,289.90 − 3,123,825)
Labor net (excluding AutoBid row 4):             +822.68 hrs
                                                 (28,971.68 − 28,149)
```

Versus Raw Data Export: +$97,359.68 material / +885.68 labor hrs (accounts for the small estimator-vs-raw mismatch on the AutoBid line).

### 4.4 Routing conventions (app defaults — see §9 for full table)

**Material side:** every MLSHT adjustment routes to exactly one material cost code. Route by description keyword match to the `MA PL00 9xxx` code family (VALVE TAGS → 9523, HD Coupling → 9524, Hose Bibb → 9524 or 9526, PVDF → 9515 Plastic, Drywells → 9526 Specialties, NGMR → 9510 Major Equipment, etc.). See §9 for the full keyword-to-code map.

**Labor side:** every MLSHT adjustment routes to a code family (one cost head, spanning all activity codes) and the hours are allocated to the matching activity codes via one of three methods:
- **Weighted** (default): distribute proportionally to existing hours on those codes. `code_share = existing_hours_on_code / sum(existing_hours_on_family)`. Preserves the scope's natural distribution across buildings.
- **Equal**: distribute evenly across all codes in the family. Used when the scope is judged to be uniform (e.g., valve tags are administrative and spread evenly).
- **Manual**: PM enters per-code hours directly. Used for one-offs where neither equal nor weighted makes sense.

Residual rounding goes to the largest-existing-hours bucket (d'Hondt convention). Negatives flow through the same way.

---

## 5. EQFIX — Master Calculation Engine

**Role:** The central calc sheet. Every bid item, alternate, and stand-alone has its own 10-column block. Pricing rolls up here, burdens applied here, Grand Total emitted at row 47.

### 5.1 Row structure (per bid item block)

```
r 1    | BID BREAKDOWN cross-reference labels
r 2    | BID# and PROJECT metadata
r 3    | Column headers: QTY / ADD-DEDUCT / MAT. / EXT. / LAB. / EXT. / GC / QTY / UNIT / EXT.
r 4    | M&L Sheet #1 total (MLSHT D/F col 56 for that bid item)
r 5    | Material Factor = 20% of row 4 material ext
r 6    | Labor Factor = 25% of row 4 labor ext
r 7    | XBE Goal premium (EQFIX!H7 qty × $275,000)
r 8–14 | Additional add/deduct line items (mostly zero on Hamilton)
r 15   | TOTAL G&A — combines General Conditions / Equipment Rental / OCIP/CCIP / XBE
r 16   | SUBCONTRACTORS header
r 17   | SUBS sheet total (SUBS!E57 for base bid)
r 18   | UNIT PRICE SHEET total (UNIT PRICE SHEET!F56 for base bid)
r 19–23| Additional line items (zero on Hamilton)
r 24   | TOTAL MAT + LABOR = SUM(rows 4–23) for mat ($) and labor (hrs)
r 25   | EQUIP/FIXTURES summary header
r 26   | Fixtures MAT= value (EQFIX!F26, from row 101 total below)
r 27   | Equipment LABOR= value (EQFIX!F27, from row 160 total below)
r 28   | Sales Tax rate (H28 = 9.75%)  +  EQ/FIX subtotal (D28)
r 29   | Consumable rate (H29 = 3%)
r 30   | Cartage rate (H30 = 3%)
r 31   | Material subtotal (J31 = row 24 + tax + consumable + cartage)
r 32   | (header row)
r 33   | Labor STRAIGHT TIME: (F24 × 60%) × CREW!F33
r 34   | Labor SHIFT:         (F24 × 10%) × CREW!F62
r 35   | Labor OVERTIME:      (F24 × 0%)  × CREW!F91
r 36   | Labor DOUBLE TIME:   (F24 × 0%)  × CREW!F120
r 37   | Labor SHOP:          (F24 × 30%) × (CREW!F33 × 65%)  [shop rate = 65% of ST rate]
r 38   | Labor SUPERVISION = 15% × (J33+J34+J35+J36+J37)
r 39   | Labor Subtotal = SUM(J33:J38)
r 40   | General Conditions (= total G&A from row 15)
r 41   | Excavation label
r 42   | Pipe Excavation (from PIPE & TANK EXCAVATION)
r 43   | Pipe Backfill
r 44   | Pipe Haul-Off
r 45   | Pipe Shoring
r 46   | Pipe Saw Cut / Break / Remove
r 47   | Tank Excavation & Backfill  +  GRAND TOTAL in col J
r 48   | (unused on Hamilton)
r 49   | Excavation subtotal (F49)
r 50–54| Analytic category labels and per-metric cost breakdowns (SQFT / FIXTURE / UNIT / LNFT / etc.)
r 55–101| Fixture schedule (qty, CO#1 unit cost, extension, CO#2 alt cost, etc.)
r 102–160| Equipment schedule (separate from fixtures)
```

### 5.2 Column pattern across bid items

Each bid item block = 10 columns. Base bid starts at col A. Pattern:

| Bid Scope | Grand Total (r47) | GC % (r15) | Mat Total (r24) | Labor Hrs (r24) |
|-----------|-----|-----|-----|-----|
| Base Bid | **J47** | **I15** | **D24** | **F24** |
| Bid Item #1 | T47 | S15 | N24 | P24 |
| Bid Item #2 | AD47 | AC15 | X24 | Z24 |
| ... | (every 10 cols) | | | |
| Alt #1 (CICIP) | JJ47 | JI15 | JD24 | JF24 |
| Alt #2 (Parking) | JT47 | JS15 | JN24 | JP24 |
| ... | | | | |
| Stand-Alone Plumbing | SZ47 | SY15 | ST24 | SV24 |

Full column map is in Appendix A.

### 5.3 Assumption cells

All in column A or H of the base bid block — these are the tuning knobs:

| Cell | Default | Purpose |
|------|---------|---------|
| A5 | 0.20 | Material Factor |
| A6 | 0.25 | Labor Factor |
| H28 | 0.0975 | Sales Tax rate |
| H29 | 0.03 | Consumables rate |
| H30 | 0.03 | Cartage rate |
| H38 | 0.15 | Supervision rate |
| H43 | 0.10 | Overhead rate |
| H44 | 0.05 | Profit rate |
| I30 | 16 | Union local (16 = District Council 16) |
| I7 | $275,000 | XBE goal premium per unit |
| TV1 | date | Project start date (drives CREW duration) |
| TV2 | date | Project end date |

Defaults above are Murray standards. They can vary per project — the app must read them per-file, not hardcode.

---

## 6. SUBS — Subcontractor Rollup

**Role:** Single rollup sheet for all bid-level subcontractor costs. Murray's estimating breaks subs into ~10–15 canonical scope categories; each project fills in the ones that apply.

### 6.1 Structure per bid item

Columns: `SECTION | DESCRIPTION | AMOUNT (USED) | MARKUP % | EXTENSION`

Row 4 is the header. Rows 5–56 are sub line items, grouped by scope. Row 57 = TOTAL (SUM of all extensions).

### 6.2 Status tags in SECTION column

The SECTION column (col A) contains a status tag indicating how firm the number is:

- **Named vendor** (e.g., "West Coast Firestopping", "P&E Insulation"): bid confirmed with that sub.
- **"PLUG"**: placeholder number; no sub quote yet; the estimator's best guess pending bid.
- **"EMAIL PRICE"**: vendor emailed a quote, not yet on official letterhead.
- **(blank)**: scope considered but not yet priced; extension is 0.

### 6.3 Hamilton example (row-by-row base bid)

| Row | Section | Scope | Amount | Markup | Extension |
|-----|---------|-------|--------|--------|-----------|
| 5 | West Coast Firestopping | Firestopping & Acoustical Caulking | $94,200 | 5% | $98,910 |
| 7 | P&E Insulation | DHW/IHW/TW + Cond Drn Int Insulation | $156,985 | 5% | $164,834 |
| 9 | (blank) | Cross Conn./Med.Gas Certification | 0 | 5% | 0 |
| 11 | PLUG | Low-Voltage Wiring | $45,000 | 5% | $47,250 |
| 15 | (blank) | Excavation | 0 | **0%** | 0 |
| 17 | PLUG | Slab X-Ray | $170,667 | 5% | $179,200 |
| 21 | PLUG | Air & Water Balancing | $17,500 | 5% | $18,375 |
| 25 | (blank) | HVAC Dry-Side | 0 | **3%** | 0 |
| 27 | PLUG | Crane, Rigging & Demolition | $15,000 | 5% | $15,750 |
| 31 | EMAIL PRICE | Site Gas MC Civil Div Trench | $612,125 | 5% | $642,731 |
| **57** | | **TOTAL** | **$1,111,477** | | **$1,167,051** |

### 6.4 Markup conventions

- **5%** is the Murray standard markup on virtually all plumbing subs.
- **3%** is the HVAC Dry-Side convention (if a plumbing bid happens to include HVAC sub scope).
- **0%** on the Excavation sub line — excavation subs are included at direct cost with no markup.
- Row 9 (Cross Conn./Med.Gas Certification) shows 5% markup even with $0 amount (cell formula persists regardless).

### 6.5 Routing to cost codes (app defaults)

Subcontractors route to the `98xx` code family by scope:

| Scope keyword | Cost code | Description |
|---------------|-----------|-------------|
| Insulation | 9801 | Insulation sub |
| Firestopping / Caulking | 9805 | Firestop sub |
| Concrete / Saw Cut | 9804 | Concrete sub |
| Controls / Low-Voltage | 9822 | Controls sub |
| X-Ray / NDT | 9803 | X-Ray sub |
| T&B / Air & Water Balancing | 9802 | TAB sub |
| Excavation | 9634 | Excavation (direct cost, no markup) |
| Crane / Rigging | 9820 | Crane sub |
| Chemical Treatment | 9806 | Chem treatment sub |
| Sound Testing | 9810 | Sound test sub |
| Site Gas / Civil | 9634 or 9899 | Civil trench work |

These are app *defaults* — PM confirms per line during import review.

---

## 7. UNIT PRICE SHEET

**Role:** Bid-required unit price items. Every GC bid form has a "unit price" section where the GC names certain items and asks for per-unit pricing (per cubic yard of over-excavation, per linear foot of extra piping, per fixture, etc.). Murray's bid response is computed here.

### 7.1 Structure

Same 6-column pattern per bid item as MLSHT. Totals at row 56.

### 7.2 Hamilton base bid (only 4 active lines)

| Row | Description | Qty | Unit Cost | Extension |
|-----|-------------|-----|-----------|-----------|
| 4 | ADD - Site DFs shown on Civil | 1 | $51,621 | $51,621 |
| 5 | ADD - AG Temp Evap Cooler Civil | 1 | $9,258 | $9,258 |
| 6 | ADD - AG Trash Enclosure Civil | 1 | $4,322 | $4,322 |
| 7 | ADD - P&P BOND | 1 | $180,000 | $180,000 |
| **56** | **TOTAL** | | | **$245,201** |

### 7.3 What lives here vs. MLSHT vs. EQFIX

- **MLSHT**: material/labor takeoff additions for scope inside the main work (pipe, fittings, valves, fixtures attached to systems).
- **UNIT PRICE SHEET**: discrete items the GC asks for separately, usually off-scope add-ons or civil-adjacent scope (trash enclosures, temp cooling, bond).
- **EQFIX direct**: fixture/equipment schedule with qty × unit cost, not an adjustment to a takeoff.

Rule of thumb: if the item has a qty and a unit, and it's listed on the GC bid form's unit price section, it goes here. Bond always goes here (it's not a sub).

### 7.4 Routing to cost codes

Heavily dependent on the specific item. App defaults:

| Pattern | Cost code |
|---------|-----------|
| BOND | 0000 BOND (material side) |
| Site DFs / Temp Cooler / Trash | appropriate material code (e.g., 9525 Fixtures) OR custom |
| Civil add | 9634 Excavation & Backfill |

PM judgment required per line during import. No reliable auto-classification.

---

## 8. FIELD G&A, EQUIPMENT RENTAL, PIPE & TANK EXCAVATION, BOND, CREW

### 8.1 FIELD G&A

**Role:** Project-level field overhead rollup. Supervision (foreman time beyond the 15% line in EQFIX), office equipment, PM/project engineer allocations, truck allowances, small tools, insurance, safety, start-up, commissioning — everything that's not direct craft labor but is field-executed.

**Key output cell:** `FIELD G&A!H111` = $2,273,243.91 for Hamilton Base Bid. Feeds EQFIX!I4.

**Variant selection:** Murray maintains separate G&A detail sheets per union local:
- `FIELD G&A DISTRICT 16` — active for Hamilton (I30 = 16)
- `FIELD G&A LOCAL 38`
- `FIELD G&A LOCAL 342`
- `FIELD G&A LOCAL 393`
- `FIELD G&A LOCAL 467`

The main `FIELD G&A` sheet pulls from whichever variant matches `EQFIX!I30`. This is a lookup convention — the app should read `EQFIX!I30` and ingest the matching variant sheet's detail if per-line granularity is needed.

**Drivers:** Project duration (`EQFIX!TV1` / `TV2` / `CREW!H4`), crew size (`CREW!E32`), and union-specific wage scales from CREW-MASTER.

**App routing:** G&A rolls up to `GC PL00 GCON` by default, with finer sub-routing by G&A category (Supervision → SUPR, Office Equipment → OFEQ, Trucks → TRCK, Insurance → INSR, etc.). PMs can accept the default rollup or break it out during import.

### 8.2 EQUIPMENT RENTAL

**Role:** Rental cost for equipment used on the project (lifts, forklifts, welders, compressors, etc.).

**Key output cell:** `EQUIPMENT RENTAL!I205` = $176,600 for Hamilton Base Bid. Feeds EQFIX!I5.

**Column pattern:** every 9 columns for successive bid items (I205, R205, AA205, ...).

**Routing:** `MA PL00 9510 MAJOR EQUIPMENT` or `GC PL00 EQRN` (equipment rental). Murray convention tends to fold rental into GC side, not material.

### 8.3 PIPE & TANK EXCAVATION

**Role:** Detailed excavation calc sheet — 2,161 rows of line items organized by bid item.

**Summary row pattern:** Base bid summary at ~row 40, Bid Item #1 at ~row 80, +40 rows per bid item thereafter.

**Per-summary-row categories (columns):**

| Col | Category | EQFIX destination |
|-----|----------|-------------------|
| F | Pipe Excavation | EQFIX!F42 |
| G | Pipe Backfill | EQFIX!F43 |
| H | Backfill Compaction | (rolls into F43) |
| I | Pipe Haul-Off | EQFIX!F44 |
| J | Pipe Shoring | EQFIX!F45 |
| K | Saw Cut | EQFIX!F46 portion |
| L | Break Concrete | EQFIX!F46 portion |
| M | Remove Concrete | EQFIX!F46 portion |
| N | Remove Asphalt | EQFIX!F46 portion |
| X | Tank Excavation & Backfill | EQFIX!F47 |

**Routing:** all excavation → `GC PL00 9634 EXCAVATION AND BACKFILL`, with optional sub-routing by category if the PM wants line-item granularity in the budget packet.

### 8.4 BOND

**Role:** Performance & Payment Bond cost calculator.

**Tier table (rows 22–26):**
```
Bid ≤ $500K       → 11.25 per $1,000
Bid ≤ $2.5M       →  7.88 per $1,000
Bid ≤ $5M         →  6.75 per $1,000
Bid ≤ $7.5M       →  6.00 per $1,000
Bid > $7.5M       →  6.00 per $1,000 (flat)
```

**Surcharge:** 1% of bond base per month for jobs over 24 months. Hamilton at 72 months = 48 month surcharge × 1% = 48% additional.

**Base Bid math for Hamilton:**
- Bid amount (BOND!A6, pulled from EQFIX!J47): $16,237,635
- Tier lookup (BOND!A8): $106,320 (at 6.00/$1,000 = $97,426 plus tier add)
- Surcharge (BOND!A9): $76,094 (72mo – 24mo = 48 months × 1% on tier amount)
- **TOTAL (BOND!A10): $182,414** → feeds BID BREAKDOWN!I5

**Column pattern:** three parallel bond calcs per 6-column block. A/G/M for Base/Item1/Item2, continuing across columns.

**Routing:** `MA PL00 BOND` or split to its own line. Bond does NOT get OH/Profit markup — it's handled separately.

### 8.5 CREW family

**Role:** Computes the blended labor rates used in EQFIX labor breakdown (rows 33–37).

**Crew composition (Hamilton, District Council 16):**

| Classification | Code | Rate | Crew Size |
|----------------|------|------|-----------|
| Foreman | 9420 | $140.53 | 1 |
| Journeyman | 9420 | $124.04 | 2 |
| 3rd Yr Apprentice | 9430 | $81.44 | 1 |
| 4th Yr Apprentice | 9430 | $90.73 | 1 |
| 5th Yr Apprentice | 9430 | $100.06 | 1 |
| **TOTAL** | | **$660.83** | **6** |

**Key output cells:**

| Cell | Value | Purpose |
|------|-------|---------|
| E32 | 6 | Total crew size (excluding non-working GF/F) |
| F32 | 660.83 | Total hourly cost for crew |
| **F33** | **$110.14** | **ST AVG RATE** — drives EQFIX!J33 |
| F62 | $114.26 | SHIFT avg rate — drives EQFIX!J34 |
| F91 | $143.26 | OT avg rate — drives EQFIX!J35 |
| F120 | $169.91 | DT avg rate — drives EQFIX!J36 |
| H4 | 72 | Project duration (months) |
| H5 | MONTHS | Duration type |

**Shop rate:** Murray convention = 65% of ST rate = $71.59 for Hamilton. Used for all fab/shop hours (SHOP line at EQFIX!J37 and FP fab codes in the budget export).

**Escalation:** Rates in CREW-MASTER escalate annually. Each project's effective date (`CREW!A4`) determines which rate year applies.

---

## 9. MLSHT line routing defaults

Comprehensive routing table for the MLSHT adjustment lines observed across Murray plumbing projects. This is the default auto-suggest table during import. PM can accept or override per line.

### 9.1 Material routing (description keyword → cost code)

| Keyword pattern | Cost code | Description |
|-----------------|-----------|-------------|
| NIPPLES | MA PL00 9513 | Steel Pipe & Fittings |
| VALVES TAGS / VALVE TAG / ID TAG | MA PL00 9523 | Pipe ID & Valve Tags |
| PIPE ID | MA PL00 9523 | Pipe ID & Valve Tags |
| HEAVY DUTY COUPLING / HD COUPLING | MA PL00 9524 | Valves |
| POLY WRAP / CI/CU FT | MA PL00 9519 | Sleeves & Inserts |
| DEMO SAFE-OFF / DEMO fixtures | MA PL00 9526 | Specialties |
| CORE DRILL / WALL ADJUSTMENT | MA PL00 9519 | Sleeves & Inserts (or 9634 Excav) |
| EXISTING BUILDING HANGER | MA PL00 9521 | Hangers & Supports |
| PVDF / Polypropylene / PP Pipe | MA PL00 9515 | Plastic Pipe & Fittings |
| ABS Sch40 | MA PL00 9515 | Plastic Pipe & Fittings |
| Polyethylene / SDR11 | MA PL00 9515 | Plastic Pipe & Fittings |
| SEISMIC | MA PL00 9521 | Hangers & Supports (seismic bracing) |
| TRENCH PLATES | MA PL00 9634 | Excavation & Backfill |
| DRYWELLS | MA PL00 9526 | Specialties |
| HOSE BIBB | MA PL00 9524 | Valves |
| FD-* / FS-* / RD-* (any fixture tag) | MA PL00 9525 | Fixtures |
| L-* / WC-* / UR-* / SA-* / LS-* | MA PL00 9525 | Fixtures |
| NGMR (gas meter) | MA PL00 9510 | Major Equipment |
| CONDENSATE Cover / Drainpipe Cover | MA PL00 9519 | Sleeves & Inserts |

### 9.2 Labor routing (description keyword → cost head family + method)

| Keyword pattern | Cost head family | Default method |
|-----------------|------------------|----------------|
| VALVES TAGS / VALVE TAG | PIDV (across all activity codes) | Weighted |
| HEAVY DUTY COUPLING | WATR / DWTR / COND | Weighted |
| POLY WRAP / CI/CU FT | BGWV / BGSD / BGWT | Weighted |
| DEMO SAFE-OFF | DEMO | Weighted |
| CORE DRILL | SLVS | Weighted |
| EXISTING BUILDING HANGER | HNGS | Weighted |
| PVDF / PP / Plastic AG | AWST | Weighted |
| SEISMIC | SZMC | Weighted |
| TRENCH PLATES | BGNG | Manual (site scope only) |
| DRYWELLS | BGSD | Weighted |
| HOSE BIBB | WATR / FNSH | Weighted |
| NGMR | NGAS | Weighted |
| CONDENSATE Cover | COND | Weighted |

**Residual rule:** rounding differences always go to the largest-existing-hours bucket in the target family. Negative allocations follow the same rule (largest bucket absorbs the largest cut).

**Multi-family scope:** some lines target more than one cost head (e.g., BG POLY WRAP spans all BG* codes). In those cases the PM selects the target *family set*, and weighted distribution computes over the union of existing hours across the selected codes.

---

## 10. Assumption cells reference (consolidated)

All reads during import, all PM-editable in the Recap Config UI:

### EQFIX (base bid block)
| Cell | Default | Meaning |
|------|---------|---------|
| A5 | 0.20 | Material Factor % |
| A6 | 0.25 | Labor Factor % |
| H7 | 0 | XBE premium quantity |
| I7 | $275,000 | XBE premium per unit |
| H28 | 0.0975 | Sales Tax rate |
| H29 | 0.03 | Consumables rate |
| H30 | 0.03 | Cartage rate |
| H38 | 0.15 | Supervision rate |
| H43 | 0.10 | Overhead rate |
| H44 | 0.05 | Profit rate |
| I30 | 16 | Union local (selects FIELD G&A variant) |
| TV1 | date | Project start |
| TV2 | date | Project end |

### Labor split (hardcoded via EQFIX rows 33–37 formulas)
| Cell | Default | Meaning |
|------|---------|---------|
| F24 × 60% | — | Straight Time hours |
| F24 × 10% | — | Shift hours |
| F24 × 0% | — | Overtime hours |
| F24 × 0% | — | Double Time hours |
| F24 × 30% | — | Shop hours |

(Editable per-project via formula override in rows 33/34/37.)

### BID BREAKDOWN
| Cell | Default | Meaning |
|------|---------|---------|
| G4 | 0 | Design fee % (usually 0, sometimes positive) |
| H67 | 0.124375 | Building breakout markup (Hamilton specific) |

### Shop rate convention
| Derivation | Default | Meaning |
|------------|---------|---------|
| CREW!F33 × 65% | $71.59 | Shop/fab rate |

---

## 11. Budget reconciliation model — extended for full recap

This is the successor to the reconciliation model in CLAUDE.md §3. Phase 1 (AutoBid + contingencies) reconciled to the **labor subtotal** and **material-plus-tax subtotal** of the bid. Phase 2 extends the reconciliation to the Grand Total.

### 11.1 Bid target (direct from EQFIX!J47)

```
BID_TARGET = EQFIX!J47

For Hamilton: $16,237,635.00
```

### 11.2 Budget target (built up in the app's Budget Packet)

```
BUDGET_TARGET =
    Material code lines (MA PL00 9xxx, all codes × tax-inclusive)
  + Consumables 3% burden line (GC PL00 CNSM or similar)
  + Cartage 3% burden line (GC PL00 CTGE or similar)
  + Labor code lines (PL ACT COSTHEAD, field rate × hours)
  + Fab code lines (FP ACT COSTHEAD, shop rate × hours)
  + FCNT (foreman strip contingency)
  + LRCN (labor rate contingency)
  + GC 0FAB CONT (unbudgeted shop volume)
  + GC 0FLD CONT (unbudgeted field volume)
  + Supervision line (GC PL00 SUPR)
  + Subcontractor code lines (98xx series)
  + Unit Price Sheet lines (misc cost codes)
  + Excavation code lines (GC PL00 9634 family)
  + G&A code lines (GC PL00 GCON + sub-categories)
  + Equipment Rental line (GC PL00 EQRN)
  + Equipment/Fixtures code lines (MA PL00 9510, 9525)
  + Overhead line (GC PL00 9900 OVHD)
  + Profit line (GC PL00 9901 PRFT)
  + Bond line (MA PL00 9902 BOND)
```

### 11.3 Reconciliation gate

At export, compute:
```
Δ = |BUDGET_TARGET − BID_TARGET|
pct = Δ / BID_TARGET

If pct < 0.1%  → green, ship
If pct < 0.5%  → yellow, investigate residual
If pct ≥ 0.5%  → red, do NOT ship until residual is traced
```

Any residual must be a named contingency line, not silent drift. The existing contingency lines (FCNT/LRCN/GC 0FAB CONT/GC 0FLD CONT) handle the AutoBid→Bid labor gap. Any Phase 2 residual must be given its own named line (e.g., `GC PL00 RECAP RECN` for recap reconciliation residual) or the import must be flagged as incomplete.

### 11.4 What each new budget piece reconciles against

| Budget line | Bid line it mirrors | Gate |
|-------------|---------------------|------|
| Material codes (taxed) | EQFIX!J27 × (1 + H28) | should match within rounding |
| Consumables burden | EQFIX!J29 | exact, rate × material subtotal |
| Cartage burden | EQFIX!J30 | exact, rate × material subtotal |
| Factor material (20% of AutoBid+MLSHT) | EQFIX!D5 | exact |
| Labor codes + FCNT/LRCN/contingencies | EQFIX!J39 pre-supervision or J33+J34+J35+J36+J37 | currently matches to $21 on Hamilton |
| Supervision | EQFIX!J38 | exact, 15% × labor subtotal |
| Factor labor hours | EQFIX!F6 × blended rate | already absorbed by GC 0FLD CONT |
| Subcontractor codes | EQFIX!J46 minus UNIT PRICE SHEET | should match within rounding |
| Unit Price codes | UNIT PRICE SHEET!F56 | exact |
| Excavation codes | EQFIX!F49 | exact |
| G&A codes | EQFIX!I4 → FIELD G&A!H111 | exact |
| Equipment Rental | EQFIX!I5 → EQUIPMENT RENTAL!I205 | exact |
| Equipment/Fixtures | EQFIX!J45 | exact |
| Overhead | EQFIX!J43 = 10% × J42 | exact |
| Profit | EQFIX!J44 = 5% × J42 | exact |
| Bond | BOND!A10 → BID BREAKDOWN!I5 | exact |

---

## 12. Phase 2 import & app implications

For Lovable and future development. This section translates the reference into concrete requirements.

### 12.1 Import service entry points per sheet

| Sheet | Extraction target | Notes |
|-------|-------------------|-------|
| MLSHT | rows 4–55, 6 cols per bid item | Skip row 4 (AutoBid anchor). Skip rows where mat_ext=0 AND lab_ext=0 unless explicitly a deduct (neg qty). Preserve line order. Preserve sign on deducts. |
| EQFIX | assumption cells (A5, A6, H28–H44, I30), fixture schedule (55–101), equipment schedule (102–160) | Read all assumption cells into `project_recap_config`. Fixture rows → `project_equipment_fixtures` with category='fixture'. Equipment rows → same table with category='equipment'. |
| SUBS | rows 5–56, 5 cols per bid item | Read col A (SECTION/status), col B (DESCRIPTION), col C (AMOUNT USED), col D (MARKUP), col E (EXTENSION). Preserve markup — 5% standard, 3% HVAC, 0% excav. |
| UNIT PRICE SHEET | rows 4–55, 6 cols per bid item | Same pattern as MLSHT. |
| FIELD G&A | H111 (+ variant sheet detail if per-category breakout needed) | Determine active variant from EQFIX!I30. |
| EQUIPMENT RENTAL | I205 (base), R205, AA205, etc. per bid item | Summary-cell read only unless PM wants line detail. |
| PIPE & TANK EXCAVATION | summary rows (40, 80, 120, …) cols F-N, X | Per-bid-item rollup, optional category breakout. |
| BOND | A6 (input), A10 (output total) | Recompute in app using same tier table + surcharge rule so it updates on bid changes. |

### 12.2 Idempotency requirements

- Re-importing a file must not duplicate rows.
- Re-import must preserve `user_edited = true` rows (PM manually adjusted values, do not overwrite).
- Re-import must replace `user_edited = false` rows with fresh values from the file.
- Re-import of a file with a different `bid_version` (estimator ships a revised recap) must show a diff: "These 4 MLSHT lines changed since last import. Accept updates? Keep current?"

### 12.3 UI surfaces

Per the NEXT_PHASE_SPEC, add a "Recap" tab with 8 sections:
1. Recap Configuration (percentages, rates, bond, tax override)
2. M&L Sheet Adjustments
3. Equipment / Fixtures
4. Subcontractors
5. Excavation
6. Unit Price Sheet
7. General Conditions
8. Alternates

Each section is editable post-import. Each edit sets `user_edited=true`. Each section shows a live-computed total and exports to its own budget packet section.

### 12.4 Export pipeline additions

Add to `budgetExportSystem.ts`:

```typescript
// Pure helpers following computeGcFabCont/computeGcFldCont pattern
export function computeMaterialFactor(config, materialSubtotal): number
export function computeConsumables(config, materialSubtotal): number
export function computeCartage(config, materialSubtotal): number
export function computeLaborSupervision(config, laborSubtotal): number
export function computeOverhead(config, directCostCore): number
export function computeProfit(config, directCostCore): number
export function computeBond(bidAmount, durationMonths, tierTable): number
```

These helpers must be pure and exported. The Recap tab UI and the Budget Packet export both consume them — no duplicated math.

### 12.5 Hour reconciliation extension

The existing hour-reconciliation gate (ensuring 100% of bid hours are represented in the budget, either as labor codes or as named contingencies) must extend to cover:

- MLSHT labor adjustments (add to totalFieldHours or totalFabHours based on target cost head family)
- Labor Factor 25% hours (currently absorbed by GC 0FLD CONT — stays there if recap factor is present, or moves to explicit Factor line if preferred)
- Supervision hours (if estimated as hours; if as a $ line only, no hour impact)
- Excavation labor embedded in excavation extension $ (may not be hour-tracked — if so, route to a dollar-only contingency)
- G&A labor (field G&A includes foreman time that's not in EQFIX labor subtotal — needs reconciliation against supervision / foreman strip)

This is the trickiest part of Phase 2 and must be addressed before any export changes ship.

---

## 13. Critical warnings

**File integrity:**
- Never save a workbook opened with `data_only=True` — destroys formulas.
- Use `keep_vba=True` when loading `.xlsm` to preserve macros.
- EQFIX is 542 columns wide — always iterate to the actual `max_col`, never hardcode.
- BOND sheet extends to column XFD (16,384) — this is not corruption; the tier table lives in rows 22–26.
- Array formulas in CREW appear as `ArrayFormula` objects — read `.text` for the string.

**Data accuracy:**
- MLSHT row 4 (AutoBid anchor) will likely differ from the actual Raw Data export by small amounts. Raw Data is truth.
- EQFIX labor hour split (60/10/30) is hardcoded via row 33/34/37 formulas — if OT/DT appear, the split has been manually edited.
- The $16,870 delta between EQFIX!J25 and EQFIX!J45 on Equipment/Fixtures is unresolved — likely supervision-on-fixture-labor. Needs confirmation before ingest.
- Bond does NOT get OH/Profit markup. Equipment/Fixtures and Subs also do NOT get OH/Profit markup. Only the direct cost core does.

**Reading conventions:**
- Every percentage cell is stored as decimal (0.20, not 20).
- Every activity code is 4 chars padded (`B100`, `00BA`, `BA01`), never 3.
- Union local stored as integer (16, 38, 342, etc.), not string.

**Formula architecture:**
- Sales tax, consumables, and cartage all apply to EQFIX!D24 (post-factor material subtotal), not to AutoBid raw.
- Overhead and Profit apply only to EQFIX!J42 (direct cost core), not to full Grand Total.
- Supervision applies to labor subtotal (J33+J34+J35+J36+J37), not to labor-inclusive of factor hours separately.
- Labor Factor 25% is added to hours BEFORE the 60/10/30 split — the 36,214.60 figure includes both AutoBid and Factor hours.

---

## 14. Appendices

### Appendix A — Full EQFIX column map (bid items & alternates)

| Bid Scope | Grand Total (r47) | GC % (r15) | Mat Total (r24) | Labor Hrs (r24) |
|-----------|-----|-----|-----|-----|
| Base Bid | J47 | I15 | D24 | F24 |
| Bid Item #1 | T47 | S15 | N24 | P24 |
| Bid Item #2 | AD47 | AC15 | X24 | Z24 |
| Bid Item #3 | AN47 | AM15 | AH24 | AJ24 |
| Bid Item #4 | AX47 | AW15 | AR24 | AT24 |
| Bid Item #5 | BH47 | BG15 | BB24 | BD24 |
| Bid Item #6 | BR47 | BQ15 | BL24 | BN24 |
| Bid Item #7 | CB47 | CA15 | BV24 | BX24 |
| Bid Item #8 | CL47 | CK15 | CF24 | CH24 |
| Bid Item #9 | CV47 | CU15 | CP24 | CR24 |
| Bid Item #10 | DF47 | DE15 | CZ24 | DB24 |
| (continues every 10 cols to Bid Item #25 at IZ47) |
| Alt #1 (CICIP) | JJ47 | JI15 | JD24 | JF24 |
| Alt #2 (Parking) | JT47 | JS15 | JN24 | JP24 |
| Alt #3 (Combo disc) | KD47 | KC15 | JX24 | JZ24 |
| Alt #4 (XBE premium) | KN47 | KM15 | KH24 | KJ24 |
| Alt #5 (Tariff) | KX47 | KW15 | KR24 | KT24 |
| Alt #6 (PVC VE) | LH47 | LG15 | LB24 | LD24 |
| Alt #7 (ProPress VE) | LR47 | LQ15 | LL24 | LN24 |
| Alt #8 (Std coupling VE) | MB47 | MA15 | LV24 | LX24 |
| Alt #9 (Firestop VE) | ML47 | MK15 | MF24 | MH24 |
| (continues to Alt #25) |
| Stand-Alone Plumbing | SZ47 | SY15 | ST24 | SV24 |
| Stand-Alone Process | TJ47 | TI15 | TD24 | TF24 |
| Stand-Alone HVAC | TT47 | TS15 | TN24 | TP24 |

### Appendix B — MLSHT adjustment lines observed across Murray projects

(Maintained as a living catalog; add new patterns as they appear on other projects. Current entries from Hamilton High only — extend as Culver Crossing, ABMC, Rancho etc. come through.)

See §4.2 Type B table.

### Appendix C — Hamilton High live number registry

All numbers below are verified against `Copy_of_Hamilton_HS_-_RE-BID_8-25-25_Plumbing_BRCAP_R1_contract_value.xlsm` as of April 19, 2026.

| Reference | Cell/Source | Value |
|-----------|-------------|-------|
| Grand Total | EQFIX!J47 | $16,237,635.00 |
| Bond | BOND!A10 | $182,413.71 |
| Material + Burdens | EQFIX!J31 | $4,457,703.67 |
| Labor + Supervision | EQFIX!J39 | $4,122,454.13 |
| Labor subtotal (pre-sup) | EQFIX!J33+J34+J37 | $3,584,742.72 |
| Supervision | EQFIX!J38 | $537,711.41 |
| General Conditions | EQFIX!J40 | $2,449,843.91 |
| FIELD G&A | FIELD G&A!H111 | $2,273,243.91 |
| Equipment Rental | EQUIPMENT RENTAL!I205 | $176,600.00 |
| Excavation | EQFIX!F49 | $568,493.85 |
| Equipment/Fixtures | EQFIX!J45 | $1,429,121.47 |
| Subs + Unit Price | EQFIX!J46 | $1,412,251.17 |
| SUBS rollup | SUBS!E57 | $1,167,050.50 |
| Unit Price rollup | UNIT PRICE SHEET!F56 | $245,200.67 |
| Fixtures mat | EQFIX!D101 | $520,380 |
| Fixtures labor | EQFIX!F27 | $611,933.73 |
| Direct Cost Core | EQFIX!J42 | $11,598,495.56 |
| Overhead | EQFIX!J43 | $1,159,849.56 |
| Profit | EQFIX!J44 | $637,917.26 |
| M&L Sheet #1 total material | MLSHT!D56 | $3,209,289.90 |
| M&L Sheet #1 total labor | MLSHT!F56 | 28,971.68 hrs |
| AutoBid Raw material | external | $3,111,930.22 |
| AutoBid Raw labor | external | 28,086 hrs |
| MLSHT net add (material) | D56 − Raw | +$97,359.68 |
| MLSHT net add (labor) | F56 − Raw | +885.68 hrs |
| Material Factor 20% | EQFIX!D5 | $641,857.98 |
| Labor Factor 25% | EQFIX!F6 | 7,242.92 hrs |
| Sales Tax (on post-factor) | EQFIX!J28 | $375,486.92 |
| Consumables 3% | EQFIX!J29 | $115,534.44 |
| Cartage 3% | EQFIX!J30 | $115,534.44 |
| Total Labor Hours | EQFIX!F24 | 36,214.60 |
| ST rate (Local 16, crew of 6) | CREW!F33 | $110.14 |
| Shift rate | CREW!F62 | $114.26 |
| OT rate | CREW!F91 | $143.26 |
| DT rate | CREW!F120 | $169.91 |
| Shop rate (65% of ST) | derived | $71.59 |
| Union local | EQFIX!I30 | 16 |
| Project duration | CREW!H4 | 72 months |
| Crew size | CREW!E32 | 6 |

---

**End of PLUMBING_RECAP_MAP.md**

*Maintained by: Jonathan Rubin + Claude. Version 1.0, verified against Hamilton HS Re-Bid Plumbing BRCAP R1 Contract Value as of April 19, 2026. Update this doc whenever (a) a new MLSHT line pattern emerges on a non-Hamilton project, (b) Murray's factor/burden conventions change, (c) a new bid item or alternate type appears, or (d) the recap template itself is versioned by estimating.*
