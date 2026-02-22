import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FloorSectionMapping } from '@/hooks/useFloorSectionMappings';

export interface BuildingSectionMapping {
  id: string;
  project_id: string;
  building_identifier: string;
  section_code: string;
  description: string | null;
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
    const bid = getBuildingFromDrawing(item.drawing || '');
    if (!bid) continue;
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
 * Nullable floor section resolver — returns null when floor can't be resolved,
 * allowing building-based fallback.
 */
export function getSectionFromFloorNullable(
  floor: string,
  floorMappings: FloorSectionMapping[]
): string | null {
  if (!floor || floorMappings.length === 0) return null;

  const normalizedFloor = floor.toLowerCase().trim();

  // 1. Exact match (case-insensitive)
  const exactMatch = floorMappings.find(
    m => m.floor_pattern.toLowerCase().trim() === normalizedFloor
  );
  if (exactMatch) return exactMatch.section_code;

  // 2. Partial match: pattern contained in floor value
  const containsMatch = floorMappings.find(m => {
    const pattern = m.floor_pattern.toLowerCase().trim();
    return pattern.length >= 2 && normalizedFloor.includes(pattern);
  });
  if (containsMatch) return containsMatch.section_code;

  // 3. Reverse partial match: floor contained in pattern
  const reverseMatch = floorMappings.find(m => {
    const pattern = m.floor_pattern.toLowerCase().trim();
    return normalizedFloor.length >= 2 && pattern.includes(normalizedFloor);
  });
  if (reverseMatch) return reverseMatch.section_code;

  // Generic floors that need building context — return null to trigger fallback
  if (/^(roof|crawl\s*space|site|attic|penthouse)$/i.test(normalizedFloor)) return null;

  return null; // Unknown — let caller decide fallback
}

/**
 * Pure static function for resolving section from floor + drawing + mappings.
 * Can be called anywhere (no React hooks).
 */
export function resolveSectionStatic(
  floor: string,
  drawing: string,
  floorMappings: FloorSectionMapping[],
  buildingMappings: BuildingSectionMapping[]
): string {
  // 1. Floor resolves
  const fromFloor = getSectionFromFloorNullable(floor, floorMappings);
  if (fromFloor) return fromFloor;

  // 2. Fallback to drawing → building → section
  const buildingId = getBuildingFromDrawing(drawing);
  if (buildingId) {
    const m = buildingMappings.find(
      bm => bm.building_identifier.toUpperCase() === buildingId.toUpperCase()
    );
    if (m) return m.section_code;
    return suggestSectionForBuilding(buildingId);
  }

  return '01';
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
        const mapping = mappings.find(
          m => m.building_identifier.toUpperCase() === buildingId.toUpperCase()
        );
        if (mapping) return mapping.section_code;
        return suggestSectionForBuilding(buildingId);
      }

      return '01';
    },
    [mappings]
  );

  return {
    mappings,
    loading,
    fetchMappings,
    upsertMapping,
    deleteMapping,
    autoPopulate,
    getSectionForItem,
  };
}
