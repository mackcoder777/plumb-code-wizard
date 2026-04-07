import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FloorSectionMapping, FloorMappingResult } from '@/hooks/useFloorSectionMappings';
import { normalizeActivityCode } from '@/lib/utils';
import { DatasetProfile, getBuildingFromZone, getZonePatternMatch } from '@/utils/datasetProfiler';

/** Finds a building mapping with B-prefix normalization ("9" ↔ "B9") */
function findBuildingMapping<T extends { building_identifier: string }>(
  buildingId: string,
  mappings: T[]
): T | undefined {
  const upper = buildingId.toUpperCase().trim();
  // 1. Exact match
  let m = mappings.find(bm => bm.building_identifier.toUpperCase().trim() === upper);
  if (m) return m;
  // 2. "9" → try "B9"
  if (/^\d+$/.test(upper)) {
    m = mappings.find(bm => bm.building_identifier.toUpperCase().trim() === `B${upper}`);
    if (m) return m;
  }
  // 3. "B9" → try "9"
  if (/^B\d+$/.test(upper)) {
    m = mappings.find(bm => bm.building_identifier.toUpperCase().trim() === upper.slice(1));
    if (m) return m;
  }
  return undefined;
}

/** Floors that exist across multiple buildings and need zone-based section resolution */
const STANDALONE_FLOORS = /^(roof|ug|crawl\s*space|site|site\s+above\s+grade|attic|penthouse)$/i;

/** Derives a sensible default activity code for standalone floors */
export function deriveStandaloneActivity(floor: string): string | null {
  const clean = floor.toLowerCase().trim();
  if (/^roof$/i.test(clean)) return '00RF';
  if (/^ug$/i.test(clean)) return '00UG';
  if (/^site$/i.test(clean)) return '00ST';
  if (/^site\s+above\s+grade$/i.test(clean)) return '00AG';
  if (/^crawl\s*space$/i.test(clean)) return '00CS';
  return '0000';
}

export interface BuildingSectionMapping {
  id: string;
  project_id: string;
  building_identifier: string;
  section_code: string;
  description: string | null;
  zone_pattern: string | null;
}

export interface DetectedBuilding {
  building_identifier: string;
  suggested_section: string;
  drawing_examples: string[];
  item_count: number;
}

/**
 * Parses a drawing name to extract a building identifier.
 * e.g. "P-A-315.1 - BLDG A PLUMBING" → "A"
 *      "P-14-305 - BLDG 14 PLUMBING"  → "14"
 *      "PC1-P1.0 - RESTROOM"          → "C1"
 */
export function getBuildingFromDrawing(drawing: string): string | null {
  if (!drawing) return null;

  // Priority 1: "BLDG XX" in the description portion
  const bldgDescMatch = drawing.match(/BLDG\s+([A-Z0-9]+)/i);
  if (bldgDescMatch) return bldgDescMatch[1].toUpperCase();

  // Priority 2: Drawing prefix pattern like "P-A-", "P-14-"
  const prefixMatch = drawing.match(/^P-([A-Z0-9]+)-/i);
  if (prefixMatch) return prefixMatch[1].toUpperCase();

  // Priority 3: Leading alpha+digit prefix e.g. "PC1", "PB", "PA"
  const alphaMatch = drawing.match(/^P([A-Z][0-9]?)\b/i);
  if (alphaMatch) return alphaMatch[1].toUpperCase();

  return null;
}

/**
 * Returns true if a floor value already contains a building identifier
 */
export function floorHasBuildingInfo(floor: string): boolean {
  if (!floor) return false;
  return /bldg|building/i.test(floor);
}

/**
 * Suggests a section code for a given building identifier.
 * Single letters get "B" prefix (A→BA, B→BB), numbers stay as-is (14→14).
 */
export function suggestSectionForBuilding(buildingId: string): string {
  if (!buildingId) return '';
  if (/^\d+$/.test(buildingId)) return buildingId;
  if (buildingId.length === 1) return `B${buildingId}`;
  return buildingId;
}

/**
 * Scans all estimate items and auto-detects unique buildings from drawing names.
 */
export function detectBuildingsFromDrawings(
  items: Array<{ drawing?: string }>
): DetectedBuilding[] {
  const buildingMap = new Map<string, { drawings: Set<string>; count: number }>();

  for (const item of items) {
    const rawBid = getBuildingFromDrawing(item.drawing || '');
    if (!rawBid) continue;
    // Normalize: strip leading "B" from numeric IDs so "B9" and "9" merge
    const bid = rawBid.replace(/^[Bb](\d+)$/, '$1');
    if (!buildingMap.has(bid)) {
      buildingMap.set(bid, { drawings: new Set(), count: 0 });
    }
    const entry = buildingMap.get(bid)!;
    entry.drawings.add(item.drawing || '');
    entry.count++;
  }

  return Array.from(buildingMap.entries())
    .map(([bid, data]) => ({
      building_identifier: bid,
      suggested_section: suggestSectionForBuilding(bid),
      drawing_examples: Array.from(data.drawings).slice(0, 3),
      item_count: data.count,
    }))
    .sort((a, b) => a.building_identifier.localeCompare(b.building_identifier));
}

/**
 * Nullable floor mapping resolver — returns null when floor can't be resolved,
 * allowing building-based fallback.
 */
export function getFloorMappingNullable(
  floor: string,
  floorMappings: FloorSectionMapping[]
): FloorMappingResult | null {
  if (!floor || floorMappings.length === 0) return null;

  const normalizedFloor = floor.toLowerCase().trim();

  // 1. Exact match (case-insensitive)
  const exactMatch = floorMappings.find(
    m => m.floor_pattern.toLowerCase().trim() === normalizedFloor
  );
  if (exactMatch) return { section: exactMatch.section_code, activity: exactMatch.activity_code || '0000' };

  // 2. Partial match: pattern contained in floor value
  const containsMatch = floorMappings.find(m => {
    const pattern = m.floor_pattern.toLowerCase().trim();
    return pattern.length >= 2 && normalizedFloor.includes(pattern);
  });
  if (containsMatch) return { section: containsMatch.section_code, activity: containsMatch.activity_code || '0000' };

  // 3. Reverse partial match: floor contained in pattern
  const reverseMatch = floorMappings.find(m => {
    const pattern = m.floor_pattern.toLowerCase().trim();
    return normalizedFloor.length >= 2 && pattern.includes(normalizedFloor);
  });
  if (reverseMatch) return { section: reverseMatch.section_code, activity: reverseMatch.activity_code || '0000' };

  // Generic floors that need building context — return null to trigger fallback
  if (/^(roof|crawl\s*space|site|attic|penthouse)$/i.test(normalizedFloor)) return null;

  return null; // Unknown — let caller decide fallback
}

/** @deprecated Use getFloorMappingNullable instead */
export function getSectionFromFloorNullable(
  floor: string,
  floorMappings: FloorSectionMapping[]
): string | null {
  const result = getFloorMappingNullable(floor, floorMappings);
  return result ? result.section : null;
}

/** Options for zone-aware resolution */
export interface ResolutionOptions {
  zone?: string;
  datasetProfile?: DatasetProfile | null;
}

/**
 * Pure static function for resolving section from floor + drawing + mappings.
 * Optionally uses zone-based resolution when the dataset profile indicates
 * zone contains the building identifier (Pattern 2).
 */
/**
 * Returns the canonical section code for a building by cross-referencing
 * floor mappings first (source of truth), then building mappings, then suggestion.
 * Prevents stale numeric section codes (e.g. "2") from overriding canonical
 * floor-mapping-derived codes (e.g. "B2").
 */
function getCanonicalSectionForBuilding(
  buildingId: string,
  floorMappings: FloorSectionMapping[],
  buildingMappings: BuildingSectionMapping[]
): string {
  const idNorm = buildingId.toUpperCase();
  // Check floor mapping entries whose pattern starts with "Bldg X -"
  const floorMatch = floorMappings.find(fm => {
    const m = (fm.floor_pattern || '').match(/^bldg\s+([A-Z0-9]+)\s*-/i);
    return m && m[1].toUpperCase() === idNorm;
  });
  if (floorMatch?.section_code) return floorMatch.section_code;
  // Fall back to building mapping record
  const bm = findBuildingMapping(buildingId, buildingMappings);
  if (bm) return bm.section_code;
  // No saved mapping yet — return empty so ACT stays 0000 until user saves sections
  return '';
}

export function resolveSectionStatic(
  floor: string,
  drawing: string,
  floorMappings: FloorSectionMapping[],
  buildingMappings: BuildingSectionMapping[],
  options?: ResolutionOptions
): string {
  const fromFloor = getFloorMappingNullable(floor, floorMappings);

  // Standalone floors: zone-based section takes priority over floor mapping's section
  if (STANDALONE_FLOORS.test((floor || '').trim()) && options?.zone) {
    // Priority 1: Standard BLDG/Building/BLK regex
    const zoneBuilding = getBuildingFromZone(options.zone);
    if (zoneBuilding) {
      return getCanonicalSectionForBuilding(zoneBuilding, floorMappings, buildingMappings);
    }
    // Priority 2: User-configured zone patterns
    const zonePatternMatch = getZonePatternMatch(options.zone, buildingMappings);
    if (zonePatternMatch) {
      return getCanonicalSectionForBuilding(zonePatternMatch.building_identifier, floorMappings, buildingMappings);
    }
  }

  // Non-standalone floor with a mapping — use it directly
  if (fromFloor) return fromFloor.section;

  // Zone-based building resolution (only when profile says zone = building and confidence >= 0.6)
  const profile = options?.datasetProfile;
  if (
    profile &&
    profile.buildingSource === 'zone' &&
    profile.confidence >= 0.6 &&
    options?.zone
  ) {
    const zoneBuilding = getBuildingFromZone(options.zone);
    if (zoneBuilding) {
      return getCanonicalSectionForBuilding(zoneBuilding, floorMappings, buildingMappings);
    }
  }
  // Per-item zone fallback (pattern-agnostic, suppressed for subzone/phase)
  if (
    options?.zone &&
    (!profile || (profile.zoneRole !== 'zone' && profile.zoneRole !== 'phase'))
  ) {
    const zoneBuilding = getBuildingFromZone(options.zone);
    if (zoneBuilding) {
      return getCanonicalSectionForBuilding(zoneBuilding, floorMappings, buildingMappings);
    }
  }

  // Drawing-based fallback (existing behavior)
  const buildingId = getBuildingFromDrawing(drawing);
  if (buildingId) {
    return getCanonicalSectionForBuilding(buildingId, floorMappings, buildingMappings);
  }

  return '01';
}

/**
 * Resolves full floor mapping (section + activity) with building fallback for section.
 * Activity comes from floor mapping only (building mappings don't have activity).
 */
export function resolveFloorMappingStatic(
  floor: string,
  drawing: string,
  floorMappings: FloorSectionMapping[],
  buildingMappings: BuildingSectionMapping[],
  options?: ResolutionOptions
): FloorMappingResult {
  const fromFloor = getFloorMappingNullable(floor, floorMappings);
  const hasExplicitMapping = !!fromFloor;
  const floorActivity = normalizeActivityCode(hasExplicitMapping
    ? (fromFloor.activity || '0000')
    : deriveStandaloneActivity(floor));

  // Standalone floors: zone-based section takes priority, preserve floor's activity
  if (STANDALONE_FLOORS.test((floor || '').trim()) && options?.zone) {
    // Priority 1: Standard BLDG/Building/BLK regex
    const zoneBuilding = getBuildingFromZone(options.zone);
    if (zoneBuilding) {
      const buildingFloorMatch = floorMappings.find(fm => {
        const m = (fm.floor_pattern || '').match(/^bldg\s+([A-Z0-9]+)\s*-/i);
        return m && m[1].toUpperCase() === zoneBuilding.toUpperCase();
      });
      const buildingActivity = buildingFloorMatch?.activity_code
        ? normalizeActivityCode(buildingFloorMatch.activity_code)
        : undefined;
      return { section: getCanonicalSectionForBuilding(zoneBuilding, floorMappings, buildingMappings), activity: floorActivity, buildingActivity, hasExplicitMapping };
    }
    // Priority 2: User-configured zone patterns with activity extraction from zone prefix
    const zonePatternMatch = getZonePatternMatch(options.zone, buildingMappings);
    if (zonePatternMatch) {
      const canonicalSection = getCanonicalSectionForBuilding(zonePatternMatch.building_identifier, floorMappings, buildingMappings);
      // Pull activity from floor mapping for this building (e.g., "Bldg MOD - ..." entry has activity_code = "0MOD")
      const buildingFloorMatch = floorMappings.find(fm => {
        const m = (fm.floor_pattern || '').match(/^bldg\s+([A-Z0-9]+)\s*-/i);
        return m && m[1].toUpperCase() === zonePatternMatch.building_identifier.toUpperCase();
      });
      const activity = buildingFloorMatch?.activity_code
        ? normalizeActivityCode(buildingFloorMatch.activity_code)
        : floorActivity;
      return { section: canonicalSection, activity, hasExplicitMapping };
    }

    // Priority 3: Zone resolution failed for standalone floor — return uncoded
    // Do NOT fall through to fromFloor path which would assign a fallback activity
    return {
      section: fromFloor?.section || '',
      activity: null,
      buildingActivity: undefined,
      hasExplicitMapping: false
    };
  }

  // Non-standalone floor with a mapping — use it directly
  if (fromFloor) return { ...fromFloor, activity: normalizeActivityCode(fromFloor.activity), hasExplicitMapping: true };

  // Zone-based building fallback for section, activity stays default
  const profile = options?.datasetProfile;
  if (
    profile &&
    profile.buildingSource === 'zone' &&
    profile.confidence >= 0.6 &&
    options?.zone
  ) {
    const zoneBuilding = getBuildingFromZone(options.zone);
    if (zoneBuilding) {
      return { section: getCanonicalSectionForBuilding(zoneBuilding, floorMappings, buildingMappings), activity: '0000', hasExplicitMapping: false };
    }
  }

  // Per-item zone fallback (pattern-agnostic, suppressed for subzone/phase)
  if (
    options?.zone &&
    (!profile || (profile.zoneRole !== 'zone' && profile.zoneRole !== 'phase'))
  ) {
    const zoneBuilding = getBuildingFromZone(options.zone);
    if (zoneBuilding) {
      return { section: getCanonicalSectionForBuilding(zoneBuilding, floorMappings, buildingMappings), activity: '0000', hasExplicitMapping: false };
    }
  }

  // Drawing-based fallback
  const buildingId = getBuildingFromDrawing(drawing);
  if (buildingId) {
    return { section: getCanonicalSectionForBuilding(buildingId, floorMappings, buildingMappings), activity: '0000', hasExplicitMapping: false };
  }

  return { section: '01', activity: '0000', hasExplicitMapping: false };
}

export function useBuildingSectionMappings(projectId: string | null) {
  const [mappings, setMappings] = useState<BuildingSectionMapping[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMappings = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('building_section_mappings')
      .select('*')
      .eq('project_id', projectId)
      .order('building_identifier');
    if (!error && data) setMappings(data as BuildingSectionMapping[]);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchMappings();
  }, [fetchMappings]);

  const upsertMapping = useCallback(
    async (buildingIdentifier: string, sectionCode: string, description = '') => {
      if (!projectId) return;
      const { data, error } = await (supabase as any)
        .from('building_section_mappings')
        .upsert(
          {
            project_id: projectId,
            building_identifier: buildingIdentifier,
            section_code: sectionCode,
            description,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_id,building_identifier' }
        )
        .select()
        .single();
      if (!error && data) {
        setMappings(prev => {
          const idx = prev.findIndex(m => m.building_identifier === buildingIdentifier);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = data as BuildingSectionMapping;
            return next;
          }
          return [...prev, data as BuildingSectionMapping];
        });
      }
    },
    [projectId]
  );

  const deleteMapping = useCallback(async (id: string) => {
    await (supabase as any).from('building_section_mappings').delete().eq('id', id);
    setMappings(prev => prev.filter(m => m.id !== id));
  }, []);

  const autoPopulate = useCallback(
    async (detected: DetectedBuilding[]) => {
      if (!projectId || detected.length === 0) return;
      const rows = detected.map(d => ({
        project_id: projectId,
        building_identifier: d.building_identifier,
        section_code: d.suggested_section,
        description: `Building ${d.building_identifier}`,
        updated_at: new Date().toISOString(),
      }));
      const { data, error } = await (supabase as any)
        .from('building_section_mappings')
        .upsert(rows, { onConflict: 'project_id,building_identifier' })
        .select();
      if (!error && data) setMappings(data as BuildingSectionMapping[]);
    },
    [projectId]
  );

  const getSectionForItem = useCallback(
    (
      floor: string,
      drawing: string,
      floorResolver: (floor: string) => string | null
    ): string => {
      const fromFloor = floorResolver(floor);
      if (fromFloor) return fromFloor;

      const buildingId = getBuildingFromDrawing(drawing);
      if (buildingId) {
        const mapping = findBuildingMapping(buildingId, mappings);
        if (mapping) return mapping.section_code;
        return '';
      }

      return '01';
    },
    [mappings]
  );

  const updateZonePattern = useCallback(
    async (id: string, zonePattern: string) => {
      const { error } = await (supabase as any)
        .from('building_section_mappings')
        .update({ zone_pattern: zonePattern || null, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (!error) {
        setMappings(prev =>
          prev.map(m => (m.id === id ? { ...m, zone_pattern: zonePattern || null } : m))
        );
      }
    },
    []
  );

  return {
    mappings,
    loading,
    fetchMappings,
    upsertMapping,
    deleteMapping,
    autoPopulate,
    getSectionForItem,
    updateZonePattern,
  };
}
