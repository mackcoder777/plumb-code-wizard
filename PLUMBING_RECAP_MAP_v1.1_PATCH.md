# Appendix patch to `PLUMBING_RECAP_MAP.md` — version 1.1

**Changelog from v1.0:**
- Rewrites §4.2 (Line classification) with two new patterns learned from Hamilton walkthrough
- Rewrites §4.4 (Routing conventions) as the two-dimensional Method × Scope Filter matrix
- Rewrites §9 (MLSHT routing defaults) with Jonathan's actual routing decisions as canonical
- Adds §15 — Building Classification (project-specific ACT categorization)
- Adds §16 — MLSHT Guided Review Flow (the core new app pattern)
- Adds Appendix D — Hamilton High gold-standard routing log (all 13 active MLSHT lines verbatim)

---

## §4.2 (REWRITE) — Line classification

MLSHT rows 4–53 contain **six distinct line types**, not four. The app must treat each differently during the review flow.

**Type A — AutoBid anchor (row 4).** Always row 4. Description "AUTOBID". Skip during ingest; the Raw Data pipeline captures this.

**Type B — Adjustment line with extension.** Non-zero QTY and non-zero MAT EXT or LAB EXT. Real scope addition requiring PM routing decisions.

**Type C — Scope Swap Net-Delta (paired rows).** Matched deduct+add pair where:
- One row has `qty = -1` with description containing `(Autobid)` — references AutoBid-embedded scope
- Another row has `qty = 1` with description containing `(quote)` — replaces with a real quote
- Description prefix matches between the two rows (first ~40 chars align)

The app auto-detects these pairs during parse, surfaces them to the PM as a **single swap entry** with the net delta, and books the net (pre-tax) to the code that already holds the deducted scope in AutoBid. Do not enter both rows separately — that double-books.

Auto-pairing rule: iterate MLSHT rows, for each `qty = -1` row look for a subsequent `qty = 1` row whose description shares the first 40 characters (stripped of "(Autobid)"/"(quote)" suffixes). If found, mark both as a swap pair. PM confirms the pairing in the review UI before the net entry is posted.

Hamilton examples:
- Rows 16+20: PVDF Acid Waste, net +$14,566 to 9515 Plastic
- Rows 22+23: SEISMIC material & Labor, net −$190,844 material to 9521 Hangers + net −1,085 labor hours to SZMC family

**Type D — Reference-only.** Rows with `mat_ext = 0 AND lab_ext = 0`, typically a fixture qty tabulation ("QTY FOR REF ONLY" header at row 26 followed by FD-8, FS-3, etc.). Skip during ingest. Also applies to rows with `qty = 0` — placeholder lines that were considered and zeroed out.

**Type E — Description-hinted adjustment.** Type B with an embedded building/package/scope reference in the description (e.g., "Bldg 2 qty 1 & Bldg 3 qty 1", "for Package 2", "for Site Gas"). The app surfaces the hint as a non-binding suggestion in the review UI ("Detected building refs: Bldg 2, Bldg 3 — allocate to B200 and B300?"). PM can accept the hint or override with judgment — hints are never enforced. Hamilton examples: Drywells row 25 (hint said Bldg 2/3 but PM routed to PL SITE SNWV); Condensate Covers row 53 (hint said Package 2 but PM routed to PL B900 COND); Trench Plates row 24 (hint said "Site Gas" and PM confirmed single-code routing).

**Type F — Trivial-scope adjustment.** Any adjustment under ~20 hours or under ~$5,000 where the PM will likely pick buckets by convenience rather than algorithm. App must make Manual method fast for these — no mandatory filter selection, no distribution preview, just click codes and enter hours. Hamilton example: NGMR (18 hrs split 9+9 across the two smallest existing NGAS buckets by PM convenience).

---

## §4.4 (REWRITE) — Routing conventions

Routing an MLSHT line is **two independent decisions**: WHERE does the scope live (scope filter), and HOW do the hours distribute (method). Both decisions apply to labor. Material has a simpler analog: route to an existing code, or create a new code.

### Material routing — two options

| Option | When used | Example |
|---|---|---|
| **Existing code** | Scope fits a standard Murray cost head | HD Coupling → MA PL00 9511 |
| **New code** | Scope doesn't fit any existing code family | Core Drill material → RN 0000 9615 (new) |

New codes require: Section + ACT + Cost Head + Description. Must persist to `COST_CODE_LOOKUP` on PM confirm. Sections are free-form (MA, PL, FP, RN, GC, SUB, 40, etc.) — the app cannot enumerate them exhaustively. New-code creation must be PM-explicit, never auto-triggered.

### Labor routing — Scope Filter × Method matrix

**Dimension 1 — Scope Filter (which ACTs are eligible):**

| Filter | Selects |
|---|---|
| All in family | Every ACT that has any hours on the target cost head |
| Existing TI only | ACTs classified `is_existing = true` in `project_building_classification` |
| New buildings only | ACTs classified `is_new = true` |
| Site only | ACTs classified `is_site = true` |
| Custom subset | PM manually picks ACTs from the full list |
| Single code | PM picks one specific ACT (equivalent to Custom subset of size 1) |

**Dimension 2 — Distribution Method (how eligible ACTs split the hours):**

| Method | Math |
|---|---|
| Weighted | Each ACT's share = its existing hours ÷ sum of existing hours across eligible ACTs |
| Equal | Each ACT's share = total hours ÷ count of eligible ACTs |
| Manual | PM enters per-ACT hours directly; app validates sum = total |
| Dedicated new code | No eligible ACTs exist — PM creates a new cost code for this scope exclusively |

Filter and Method are orthogonal. Any Filter can pair with any Method except Dedicated new code (which bypasses Filter entirely because there are no existing ACTs to filter).

**Residual rounding rule:** For Weighted and Equal methods, integer rounding residual (positive or negative) goes to the ACT with the largest existing-hours bucket in the eligible set. This is the d'Hondt convention and applies identically to positive (add) and negative (deduct) distributions.

**Cross-section routing.** Material and labor routing decisions are independent — a single MLSHT line can route material to one section and labor to a completely different section. Example: Core Drill material → RN 0000 9615 (Rental/Equipment), Core Drill labor → 40 0000 CORE (new Specialty section). The app's routing UI cannot assume section parity between mat and lab.

### Scope Swap Net-Delta routing

Type C swap pairs follow a special rule: **route the net (pre-tax) to the code already holding the AutoBid-embedded scope.** Material side applies tax as normal. Labor side can use any filter+method on the net hours.

Hamilton examples:
- PVDF swap: `(560,247.60 - 545,692) = +14,566` to 9515 Plastic, tax-loaded to +$15,986
- Seismic swap material: `(0 - 190,844) = -190,844` to 9521 Hangers, tax-loaded deduct of −$209,451
- Seismic swap labor: `(1,236 - 2,321) = -1,085` hours, Weighted across full SZMC family

---

## §9 (REWRITE) — MLSHT routing defaults

Rewritten from Hamilton High actual routings. This is the canonical keyword→routing map. Murray PMs: add new patterns as they appear on non-Hamilton projects.

### 9.1 Material routing (description keyword → cost code)

| Keyword pattern | Cost code | Rationale |
|---|---|---|
| NIPPLES | MA PL00 9513 | Steel pipe fittings |
| VALVES TAGS / VALVE TAG / ID TAG | MA PL00 9523 | Pipe ID & Valve Tags |
| PIPE ID / PIPE IDENTIFICATION | MA PL00 9523 | Pipe ID & Valve Tags |
| POLY WRAP / CI/CU FT ADJ | MA PL00 9523 | Treated as pipe marking, not sleeves |
| HEAVY DUTY COUPLING / HD COUPLING | **MA PL00 9511** | Cast iron coupling — material type routes, not function |
| DEMO SAFE-OFF / DEMO ADJUSTMENT | **MA PL00 9730** | Consumable plugs/caps for demo |
| CORE DRILL / WALL ADJUSTMENT / PLUG | **RN 0000 9615** | Owned equipment — cross-section, not MA |
| EXISTING BUILDING HANGER | (usually no material) | Labor-only adjustment |
| PVDF / Polypropylene / PP Pipe | MA PL00 9515 | Plastic pipe & fittings |
| ABS Sch40 / Polyethylene / SDR11 | MA PL00 9515 | Plastic pipe & fittings |
| SEISMIC material | MA PL00 9521 | Hangers & supports (seismic bracing) |
| TRENCH PLATES | (usually no material) | Labor-only — creates new 40-code |
| DRYWELLS | MA PL00 9526 | Specialties |
| HOSE BIBB | **MA PL00 9525** | Routed as fixture, not valve |
| FD-* / FS-* / RD-* / L-* / WC-* / UR-* / SA-* / LS-* (fixture tags) | MA PL00 9525 | Fixtures |
| NGMR (gas meter) | (varies — on Hamilton zero material, 18 labor hrs) | |
| CONDENSATE Cover / Drainpipe Cover | MA PL00 9526 | Specialties |

**Defaults I got wrong in v1.0:** HD Coupling (was 9524), BG Poly Wrap (was 9519), Demo Safe-Off (was 9526), Core Drill (was 9519), Hose Bibb (was 9524). These are now corrected above.

### 9.2 Labor routing (description keyword → cost head family + default filter + default method)

| Keyword pattern | Cost head | Default filter | Default method |
|---|---|---|---|
| VALVES TAGS | PIDV | All in family | Weighted |
| HEAVY DUTY COUPLING | (no labor) | — | — |
| POLY WRAP / CI/CU FT | PIDV | Single code (PL SITE PIDV) | Dedicated single |
| DEMO SAFE-OFF | DEMO | All in family | Weighted |
| CORE DRILL | — | — | **Dedicated new code (40 0000 CORE)** |
| EXISTING BUILDING HANGER | HNGS | **Existing TI only** | Weighted |
| SEISMIC (net) | SZMC | All in family | Weighted (applied to negative) |
| TRENCH PLATES | — | — | **Dedicated new code (40 0000 PLATE)** |
| DRYWELLS | SNWV | Single code (PL SITE SNWV) | Manual |
| HOSE BIBB | (no labor) | — | — |
| NGMR | NGAS | Custom subset (smallest buckets) | Manual |
| CONDENSATE Cover | COND | Single code (PL B900 COND) | Manual |

**Cautions:** keyword matching is a *suggestion engine only*. The PM can always override via the review flow. These defaults exist to make the routine cases 3-second decisions; they are not authoritative for anything outside the exact keyword match.

---

## §15 (NEW) — Building Classification

Every Murray plumbing project classifies its ACT codes into categories that drive scope filter logic during MLSHT routing. This classification is **project-specific** but follows consistent heuristics.

### 15.1 Classification schema

New table: `project_building_classification`

```sql
CREATE TABLE project_building_classification (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  activity_code text NOT NULL,              -- '00BA', 'B100', 'SITE', 'MOD0', etc.
  building_label text,                      -- 'Building A', 'Main TI', 'Site Work'
  classification text NOT NULL CHECK (classification IN ('existing', 'new', 'site', 'modular', 'other')),
  is_existing boolean GENERATED ALWAYS AS (classification = 'existing') STORED,
  is_new boolean GENERATED ALWAYS AS (classification = 'new') STORED,
  is_site boolean GENERATED ALWAYS AS (classification = 'site') STORED,
  parent_act text,                          -- for sub-ACTs (BA01 parent = 00BA)
  notes text,
  UNIQUE(project_id, activity_code)
);
```

### 15.2 Heuristic defaults (run at project creation; PM overrides)

- ACT starting with digit (`B100`, `B200`, `B300`, `B120`, etc.) → `existing`
- ACT starting with letter (`00BA`, `00BB`, `BC00`, `BD00`) → `new`
- ACT = `SITE` → `site`
- ACT starting with `MOD` → `modular` (treated as `new` for most filter purposes, separable if needed)
- Sub-ACT (suffix digit after letter block, e.g., `BA01`, `BA02`) → inherits classification from parent ACT

### 15.3 Sub-ACT inheritance

When an MLSHT line filters to "New buildings only," the filter must include all sub-ACTs of every building classified as `new`. Example: if Building A (`00BA`) is `new`, then BA01, BA02, BA03, and BA0R all participate in the filter automatically. The app stores the parent relationship in `parent_act` and resolves inheritance at filter-application time.

### 15.4 PM override

Every classification is editable post-import on a Project Settings → Building Classification screen. Changing a classification re-runs all scope filters on MLSHT lines that use that filter type, with a preview diff before commit. This matters when a project is ambiguous (e.g., a heavy-remodel building that's technically "existing" but functions as "new" for scope routing purposes).

### 15.5 Hamilton High classification (reference)

| ACT | Classification | Parent | Notes |
|---|---|---|---|
| B100 | existing | — | TI |
| B200 | existing | — | TI |
| B300 | existing | — | TI |
| B900 | existing | — | TI |
| B120 | existing | — | TI |
| B130 | existing | — | TI |
| B140 | existing | — | TI |
| 00BA (BA00) | new | — | Building A ground-up |
| BA01 | new | 00BA | Building A sub-scope |
| BA02 | new | 00BA | Building A sub-scope |
| BA03 | new | 00BA | Building A sub-scope |
| BA0R | new | 00BA | Building A roof |
| BB00 | new | — | Building B |
| BC00 | new | — | Building C |
| BD00 | new | — | Building D |
| MOD0 | modular | — | Modular building |
| SITE | site | — | Site/underground work |

---

## §16 (NEW) — MLSHT Guided Review Flow

The core new UX pattern for Phase 2. MLSHT adjustments cannot be batch-auto-routed — every line requires PM judgment that pattern-matching cannot reliably predict. The review flow makes the PM and app collaborators: the PM makes the calls, the app handles arithmetic, persistence, and reconciliation.

### 16.1 Core design principle

**Any recap section where every line requires domain judgment is not a CRUD table — it's a guided session. Design the UI around the review, not the data model.**

This applies unconditionally to MLSHT. Other recap sections (SUBS, UNIT PRICE SHEET, EXCAVATION, G&A) default to flat CRUD with an optional "expand to guided review" affordance for PMs who want the structured flow.

### 16.2 Session architecture

**Entry point.** From the Recap tab, the M&L Sheet Adjustments card shows:
```
M&L Sheet Adjustments
Status: Not yet reviewed (13 lines)
[Begin Review Session →]
```

On click, the app parses MLSHT, classifies every row (Type A–F per §4.2), auto-detects Type C swap pairs, and presents the review queue:
```
Review queue — Base Bid
───────────────────────
We found 13 active adjustments and 2 auto-detected swap pairs.

• 11 individual adjustments (Types B, E, F)
• 2 swap pairs (Type C) — auto-paired: PVDF rows 16+20, Seismic rows 22+23
• 3 reference-only rows skipped (Type D): row 5 (zero-qty), row 26 (QTY FOR REF header), rows 27–37 (fixture tabulation)

Estimated review time: 10–15 minutes.
[Start Review] [Cancel]
```

**Per-line review screen.** Three zones:

*Left rail (30%) — Line context:*
- Current MLSHT row number + full description
- QTY, material unit/ext, labor unit/ext
- If Type C (swap pair): both source rows side-by-side with net delta highlighted
- If Type E (description hints): detected hints shown with confidence ("Building refs: Bldg 2, Bldg 3")
- Progress indicator: "Line 5 of 13 — Base Bid"
- Link: "[View in MLSHT]" pops up the actual sheet row for context

*Center (50%) — Decision panels:*

Material routing panel (shown only if mat_ext ≠ 0):
- Routing option: Existing code / Create new code (radio)
- If existing: Section dropdown → ACT dropdown → Cost Head dropdown (cascading, scoped)
- If new: Section + ACT + Cost Head + Description (all required)
- Auto-suggestion banner: "Suggested: 9511 Cast Iron (based on keyword match on 'Heavy Duty Coupling'). Confidence: 85%. [Accept]"
- Tax preview: "Pre-tax: $117,712 → Tax-loaded: $129,188.92 → 9511 balance after: $748,521.22"

Labor routing panel (shown only if lab_ext ≠ 0):
- Cost head family: Section dropdown → Cost Head dropdown
- Scope filter: radio group (All / Existing TI / New / Site / Custom / Single code)
- Distribution method: radio group (Weighted / Equal / Manual / Dedicated new code)
- Auto-suggestion banner: "Suggested: HNGS family, Existing TI filter, Weighted method (based on keyword match on 'Existing Building')"
- Live preview table: shows every eligible ACT with existing hours + added hours + new total, with residual allocation highlighted

*Right rail (20%) — Running totals:*
- Budget running total (Material / Labor / Combined)
- Bid target (EQFIX!J47) and % booked
- Scrollable adjustment checklist showing all 13 lines, current line highlighted, completed lines checked

*Controls bar (bottom):*
- `[← Prev]` — back up one line (saves current state)
- `[Skip]` — mark line as "deferred," come back later (session can commit without resolving skipped lines but flags them)
- `[Save & Next →]` — primary action; shows confirmation modal with diff summary before commit
- `[Save & Review Later]` — exit session, resume state preserved
- `[Exit Session]` — discard unsaved current-line changes, keep previously-saved lines

**Commit confirmation modal** (appears on Save & Next):
```
Confirm this adjustment:
───────────────────────
Line 7 — All Heavy Duty Coupling adjustment
  Material: $117,712 + 9.75% tax → +$129,188.92 to MA PL00 9511
    Balance: $619,332.30 → $748,521.22
  Labor: no change

[Confirm & Next] [Back to Edit]
```

One extra click, but it's the safety net for typo-level errors on a decision that's been made a hundred times.

**Session summary screen** (after last line):
```
Review complete — Base Bid MLSHT
─────────────────────────────────
13 lines reviewed ✓
2 swap pairs processed ✓
3 reference rows skipped ✓
0 lines deferred

Material net: +$174,463.93 (tax-loaded)
Labor net: +885.68 hours
Combined budget impact: +$254,000 ± reconciliation

[View Full Routing Log]  [Export Budget Packet]  [Back to Recap Tab]
```

The "Export Budget Packet" button is disabled until this session reaches 100% (no deferred lines, all lines confirmed).

### 16.3 Resumability & state

Session state persists to Supabase on every Save & Next. Schema:

```sql
CREATE TABLE mlsheet_review_sessions (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id),
  bid_scope text NOT NULL,                  -- 'base_bid', 'bid_item_1', etc.
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  current_line int,                          -- for resume
  total_lines int,
  lines_completed int,
  lines_deferred int,
  UNIQUE(project_id, bid_scope)
);

CREATE TABLE mlsheet_routing_decisions (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES mlsheet_review_sessions(id),
  mlsheet_row int NOT NULL,                 -- original MLSHT row number
  line_type text NOT NULL,                  -- 'B', 'C_swap', 'E_hinted', 'F_trivial'
  description text NOT NULL,
  material_routing jsonb,                   -- {section, act, cost_head, is_new_code, tax_loaded_amount}
  labor_routing jsonb,                      -- {section, cost_head, scope_filter, method, allocations[]}
  swap_pair_row int,                        -- for Type C, the paired row number
  net_material numeric,
  net_labor_hours numeric,
  override_auto_suggestion boolean DEFAULT false,
  pm_notes text,
  committed_at timestamptz DEFAULT now(),
  user_edited boolean DEFAULT false
);
```

Re-opening a mid-review session returns the PM to their last uncompleted line. Completed lines show as committed in the checklist and can be edited by clicking them (re-entering the review UI for that line only).

### 16.4 Auto-suggestion engine

Priority cascade for auto-suggestions (first match wins):

1. **Project-scoped history** — same project, same keyword → use prior decision. Rare on first review but common for Change Order MLSHT processing later.
2. **Company-scoped history** — all Murray projects in the DB, same keyword → use the modal routing across prior decisions.
3. **Universal defaults** — the §9 table above, shipped with the app.

Every PM confirmation (especially overrides) writes to `mlsheet_routing_decisions` with `override_auto_suggestion = true` when the PM changed the suggestion. Over time, the company-scoped history becomes the dominant suggestion source, and universal defaults become fallbacks. This is **exact-match keyword lookup, not ML** — simpler, deterministic, auditable.

### 16.5 Keyboard shortcuts (power users)

- `Enter` — confirm current routing, proceed to next line
- `Shift+Enter` — save & review later (exit without advancing)
- `Esc` — revert current-line changes to last-saved state
- `N` — focus Create New Code option
- `1–9` — jump to scope filter option by number
- `W / E / M / D` — jump to distribution method (Weighted/Equal/Manual/Dedicated)

Target: routine lines (Valve Tags hitting 9523) should be **3 seconds** — `Enter` to accept material suggestion, `Enter` to accept labor suggestion, `Enter` to confirm commit.

### 16.6 Bulk operations (edge cases)

Some MLSHT lines share identical routing (e.g., on a large project, multiple rows of the same fixture type). The review UI offers a "Apply to similar lines" action after any commit: "This routing decision matches 4 other unreviewed lines (rows 27, 28, 29, 30) by description pattern. Apply the same routing to all? [Apply to all] [Review individually]". Used sparingly but valuable for repetitive scopes.

### 16.7 Commit gate

The Budget Packet export for a given bid scope is **blocked** until its MLSHT review session has `status = 'completed'` AND `lines_deferred = 0`. The Export button shows:
```
[Export Budget Packet — 3 MLSHT lines still deferred]
```
and remains disabled until resolved. This is the architectural enforcement that the reconciliation can't drift silently because MLSHT lines got skipped during hasty packet production.

### 16.8 Per-bid-scope sessions

Each bid scope (Base Bid, Bid Item #1, …, Alt #1, …) has its own MLSHT review session. Most of the Base Bid adjustments also appear in bid items and alts with different extensions. The session UI lets the PM copy routing decisions forward across bid scopes: "Use the same Valve Tags routing from Base Bid for Bid Item #1? [Copy] [Review fresh]". This avoids re-deciding the same pattern 25 times for a full bid with all items.

### 16.9 What this changes in the broader Phase 2 plan

Previously `NEXT_PHASE_SPEC_FULL_RECAP.md` Sprint 2 was "Recap tab UI with 8 sections, CRUD for each." This section upgrades the MLSHT section to a guided-review flow. The other 7 sections stay simpler:

- **SUBS** — flat CRUD, optional guided review for complex sub packages
- **Equipment / Fixtures** — flat CRUD, fixture-tag→9525 routing is mostly mechanical
- **Subcontractors** — flat CRUD with a 98xx routing suggestion helper
- **Excavation** — flat CRUD with category rollup helper
- **Unit Price Sheet** — flat CRUD, PM-entered routing per line
- **General Conditions** — flat CRUD with category→sub-code rollup
- **Alternates** — flat CRUD with accept/reject toggle

Sprint 2 becomes 3 weeks instead of 2 (extra week for the guided-review flow).

---

## Appendix D (NEW) — Hamilton High gold-standard routing log

These are the 13 MLSHT adjustment decisions Jonathan Rubin made on the Hamilton High Re-Bid Base Bid, April 19, 2026 session. This is the **gold-standard reference example** for both the auto-suggestion engine's seed data and for future documentation.

| # | Row | Description | Material routing | Labor routing |
|---|---|---|---|---|
| 1 | 6 | Valve Tags (858 qty) | MA PL00 9523 (+$6,006 → $6,591.59 w/tax) | PIDV family / All-in-family filter / Weighted method → +129 hrs |
| 2 | 7 | HD Coupling adj (1 qty) | MA PL00 9511 (+$117,712 → $129,188.92 w/tax) | — (no labor) |
| 3 | 8 | BG Poly Wrap CI/CU FT (8,533 qty) | MA PL00 9523 (+$6,400 → $7,024 w/tax) | PIDV family / Single code (PL SITE PIDV) filter / Dedicated single method → +512 hrs |
| 4 | 9 | Demo Safe-Off (1 qty) | MA PL00 9730 (+$8,150 → $8,944.63 w/tax) | DEMO family / All-in-family filter / Weighted method → +326 hrs |
| 5 | 11 | Core Drill & Wall Adj / Plug (256 qty) | RN 0000 9615 NEW CODE (+$44,800 → $49,168 w/tax) | Dedicated new code (40 0000 CORE NEW) → +256 hrs |
| 6 | 12 | Existing Building Hanger Adj (1,596 qty) | — (no material) | HNGS family / Existing TI only filter / Weighted method → +399 hrs (7 eligible ACTs) |
| 7 | 16+20 | PVDF Swap (deduct/add pair) | MA PL00 9515 Plastic +$14,566 net → +$15,985.96 w/tax | — (no labor delta) |
| 8 | 22+23 | Seismic Swap (deduct/add pair) | MA PL00 9521 Hangers −$190,844 net → −$209,451.79 w/tax | SZMC family / All-in-family filter / Weighted method → −1,085 hrs (15 eligible ACTs) |
| 9 | 24 | Trench Plates for Site Gas (1 qty) | — (no material) | Dedicated new code (40 0000 PLATE NEW) → +240 hrs |
| 10 | 25 | Drywells (2 qty, Bldg 2+3 hint) | MA PL00 9526 (+$3,000 → $3,292.50 w/tax) | SNWV family / Single code (PL SITE SNWV) filter / Manual method → +24 hrs *(PM overrode description hint)* |
| 11 | 39 | Hose Bibb — See Sheet (119 qty) | MA PL00 9525 (+$74,786 → $82,077.64 w/tax) | — (no labor) |
| 12 | 52 | NGMR (9 qty) | — (no material) | NGAS family / Custom subset filter / Manual method → +9 hrs PL B120 NGAS, +9 hrs PL BC00 NGAS (18 total, smallest buckets by PM convenience) |
| 13 | 53 | Condensate Drainpipe Covers on P1012/6 for Package 2 (1 qty) | MA PL00 9526 (+$900 → $987.75 w/tax) | COND family / Single code (PL B900 COND) filter / Manual method → +4 hrs *(PM overrode description hint)* |

**Session totals after all 13 adjustments:**
- Material added (tax-loaded): +$93,809.93 against MA PL00 codes + $49,168 to RN 0000 9615
- Labor added: +1,056.60 net hours (129 + 512 + 326 + 256 + 399 + 0 + 0 − 1,085 + 240 + 24 + 0 + 18 + 4 + new codes)
- Combined budget impact: +$174,463.93 (Material Total $4,447,837.70 → $4,622,301.63 approx; Labor Total $2,552,247.83 → $2,632,901.83)

**New cost codes created in this session:**
1. `RN 0000 9615` Owned Equipment — already existed, added balance
2. `40 0000 CORE` Coring — NEW CODE
3. `40 0000 PLATE` Trench Plates — NEW CODE

These become part of `COST_CODE_LOOKUP` going forward for all Murray projects.
