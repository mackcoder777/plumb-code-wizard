

# Dataset Profile Analyzer — Intelligent Floor/Zone Field Role Detection

## Problem
The Floor and Zone columns in estimate data serve different roles depending on the estimator and job. The current section resolution only uses Floor + Drawing for building detection. The Zone column is ignored, even though it often contains the building identifier (e.g., "BLDG - A"). A hard-coded assumption about zone's role would break other datasets where Zone means something else entirely (subzone, phase, etc.).

## Approach
Build a confidence-scored profiler that runs once at file upload, detects how each dataset uses Floor vs Zone, stores the result, and feeds it into all section resolution calls. The system handles 4 known patterns and falls back safely when it can't determine roles.

## Changes

### 1. New file: `src/utils/datasetProfiler.ts`
- Define types: `FieldRole` (`'building' | 'floor' | 'zone' | 'phase' | 'building+floor' | 'building-confirm' | 'unknown'`), `DatasetProfile` (`floorRole`, `zoneRole`, `confidence`, `buildingSource`, `floorSource`)
- Implement `profileDataset(items)` with the 4-pattern heuristics from the user's pseudocode (building prefix ratio, floor-only ratio, zone-as-building ratio, zone-as-subzone ratio, avgZonesPerFloor cross-check)
- Implement `getBuildingFromZone(zone)` — extract building ID from strings like `"BLDG - A"`, `"Building 12"`, `"PCS - MODULAR"`

### 2. Update `src/hooks/useBuildingSectionMappings.ts`
- Update `resolveSectionStatic` and `resolveFloorMappingStatic` signatures to accept an optional options object as the 5th parameter:
  ```ts
  interface ResolutionOptions {
    zone?: string;
    datasetProfile?: DatasetProfile | null;
  }
  ```
- After floor-mapping check fails, if `datasetProfile?.buildingSource === 'zone'` and `confidence >= 0.6`, try `getBuildingFromZone(zone)` → look up in `buildingMappings`
- If profile is `null` or `confidence < 0.6`, skip zone-based resolution entirely — fall through to existing drawing-based logic
- Pattern 3 (`buildingSource === 'floor'`) correctly does NOT use zone for building lookup

### 3. Update `src/pages/Index.tsx`
- Run `profileDataset(items)` after file upload/append, store in state as `datasetProfile` (initialized to `null`)
- Update all ~6 call sites of `resolveSectionStatic` / `resolveFloorMappingStatic` (lines ~625, 647, 796-797, 1536-1537, 2582-2604) to pass `{ zone: item.zone, datasetProfile }` as the 5th argument

### 4. Update `src/utils/budgetExportSystem.ts`
- Change `aggregateLaborByCostCode` to use an options object for the last params (already at 5 positional params):
  ```ts
  aggregateLaborByCostCode(items, floorMappings, {
    categoryMappings,
    buildingMappings,
    dbFloorMappings,
    datasetProfile  // NEW
  })
  ```
- Update the 3 call sites (~lines 350, 899, and the internal `getSectionFromFloor` helper) to pass profile and zone through to `resolveSectionStatic`

### 5. Update `src/components/FloorSectionMapping.tsx`
- Accept `datasetProfile` as an optional prop
- Show an informational banner at the top when profile is detected:
  ```
  ℹ️ Detected pattern: Floor encodes building + level, Zone confirms building. Confidence: 94%
  [Override detection ▾]
  ```
- Override dropdown lets user manually select pattern (1-4), stored to `estimate_projects` metadata column via database

### 6. Database: Add `dataset_profile_override` column to `estimate_projects`
- Migration: `ALTER TABLE estimate_projects ADD COLUMN dataset_profile_override text DEFAULT NULL;`
- Stores the user's manual override selection (e.g., `'pattern1'`, `'pattern2'`, `'pattern3'`, `'pattern4'`) so it persists across reloads
- When override is set, skip auto-detection and use the override pattern directly

## Key Safety Rules
- `datasetProfile` initializes to `null` before any file upload. All resolution functions handle `null` gracefully by skipping zone-based resolution and falling through to existing drawing-based logic.
- When `confidence < 0.6`, zone-based resolution is skipped entirely.
- Pattern 3 (zone = subzone) explicitly avoids using zone for building lookup.
- No breaking changes to existing behavior — zone is purely additive in the resolution chain.

