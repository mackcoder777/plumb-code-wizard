# Murray Budget Manager — Claude Code Context

## What this app does
React/TypeScript/Vite/Supabase app that processes AutoBid plumbing estimate exports, assigns Murray Company cost codes (SEC-ACT-COSTHEAD format), and produces budget summaries for export to Excel.

## Critical files
- src/components/BudgetAdjustmentsPanel.tsx — ALL budget adjustment logic, finalLaborSummary pipeline, small code review UI
- src/utils/budgetExportSystem.ts — Excel export pipeline
- src/pages/Index.tsx — Data loading, mapping application, auto-apply effects
- src/hooks/useCategoryMaterialDescOverrides.ts — Material description override persistence

## Architecture rules (never violate these)
- finalLaborSummary is the single source of truth for export — export reads ONLY from this
- Labor codes assigned by SYSTEM, material codes by material type — never mix
- Cost code format: SEC-ACT-COSTHEAD (e.g., B2 00UG TRAP)
- Merges persist to project_small_code_merges table
- BudgetAdjustmentsPanel MUST always be mounted (never conditionally rendered) — it populates budgetAdjustments state that export depends on

## Known bugs to fix (priority order)
1. Hour drift: finalLaborSummary output=27633 vs input=27617 (+16h created from nowhere) — likely in reassign block
2. Reassign accepted early-returns correctly but stale DB records still cause 1h orphans in export
3. In Export view shows pre-merge hours (10h) instead of actual export hours (1h) — inExportInteractiveRows uses standaloneGroups.combinedHours instead of ieRow.combinedHours
4. console floods from finalLaborSummary — wrap all dev logs in import.meta.env.DEV
5. DWTR codes appearing from hardcoded DEFAULT_COST_HEAD_MAPPING fallback — should only come from user system mappings

## finalLaborSummary pipeline (order matters)
1. Section alias normalization (numeric → B-prefix)
2. Fallback section folding (CS/UG/RF/AG → canonical) — Try 1: exact activity+head match, Try 2: preserve activity code, use canonical section
3. Saved merge/reassign actions applied
4. Zero-hour cleanup (< 0.05h deleted)
5. Final rounding via roundHoursPreservingTotal

## Reassign block rules
- keep AND accepted must both early-return (preserve hours, don't delete source)
- redistribute, merge, empty string must be in sentinel guard (don't create bogus target keys)
- When no target key found: create new key using 0000 activity code, delete source keys
- Dead else-if (targetKey) branch should not exist

## Small code review architecture
- Pass 1 (smallCodeAnalysis): groups by sec|head, flags groups where any line < minHoursThreshold
- Standalone tab: single-activity codes
- Merge Groups tab: multi-activity codes
- In Export filter: reads directly from finalLaborSummary, shows actual export lines one-to-one
- allPass1Keys must include: standaloneGroups, savedOnlyRows, mergeGroups, savedMergesData source keys
- Saved merges only excluded from Round 2 if the result in finalLaborSummary is >= minHoursThreshold

## QC checklist before any change
- Total hours in finalLaborSummary must equal input (27617h) — check hour drift log
- Export total rows must match finalLaborSummary entry count
- No accepted or keep entries in result object (they should early-return)
- No entries with head containing __ (sentinel values must never become cost codes)
- In Export row hours must exactly match what budgetExportSystem.ts will write
