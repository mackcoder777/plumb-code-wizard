/**
 * Dataset Profile Analyzer
 * 
 * Detects how each estimator uses the Floor and Zone columns in their dataset.
 * Runs once at file upload time and produces a DatasetProfile that tells the
 * section resolver which field to trust for building vs floor information.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type FieldRole =
  | 'building'
  | 'floor'
  | 'zone'
  | 'phase'
  | 'building+floor'
  | 'building-confirm'
  | 'unknown';

export interface DatasetProfile {
  /** What role the floor column is playing in this dataset */
  floorRole: FieldRole;
  /** What role the zone column is playing in this dataset */
  zoneRole: FieldRole;
  /** 0-1 confidence in the detection */
  confidence: number;
  /** Where to extract the building identifier from */
  buildingSource: 'floor' | 'zone' | 'drawing' | 'both';
  /** Where to extract the actual floor/level from */
  floorSource: 'floor' | 'zone' | 'neither';
}

/** The 4 known estimator patterns, for manual override */
export type PatternOverride = 'pattern1' | 'pattern2' | 'pattern3' | 'pattern4';

// ─── Pattern override → profile mappings ──────────────────────────────────────

const OVERRIDE_PROFILES: Record<PatternOverride, DatasetProfile> = {
  pattern1: {
    floorRole: 'building+floor',
    zoneRole: 'building-confirm',
    confidence: 1,
    buildingSource: 'floor',
    floorSource: 'floor',
  },
  pattern2: {
    floorRole: 'floor',
    zoneRole: 'building',
    confidence: 1,
    buildingSource: 'zone',
    floorSource: 'floor',
  },
  pattern3: {
    floorRole: 'building',
    zoneRole: 'zone',
    confidence: 1,
    buildingSource: 'floor',
    floorSource: 'neither',
  },
  pattern4: {
    floorRole: 'unknown',
    zoneRole: 'unknown',
    confidence: 1,
    buildingSource: 'drawing',
    floorSource: 'neither',
  },
};

/** Returns the profile for a manual override value */
export function getProfileFromOverride(override: PatternOverride): DatasetProfile {
  return OVERRIDE_PROFILES[override];
}

// ─── Detection heuristics ─────────────────────────────────────────────────────

interface ProfileableItem {
  floor?: string | null;
  zone?: string | null;
}

/**
 * Analyzes an entire dataset's floor + zone values and determines what role
 * each column is playing. Runs once at upload time.
 */
export function profileDataset(items: ProfileableItem[]): DatasetProfile {
  const floorValues = [...new Set(items.map(i => i.floor).filter(Boolean))] as string[];
  const zoneValues = [...new Set(items.map(i => i.zone).filter(Boolean))] as string[];

  // If no zone data at all, fall back to drawing-based resolution
  if (zoneValues.length === 0) {
    return {
      floorRole: floorValues.length > 0 ? 'floor' : 'unknown',
      zoneRole: 'unknown',
      confidence: 0.8,
      buildingSource: 'drawing',
      floorSource: floorValues.length > 0 ? 'floor' : 'neither',
    };
  }

  // ── Ratio calculations ──────────────────────────────────────────────────

  // Does floor contain building+floor combos? ("Bldg A - Level 1")
  const floorHasBuildingPrefix = floorValues.length > 0
    ? floorValues.filter(f =>
        /bldg|building|blk|block/i.test(f) && /\s*-\s*/.test(f)
      ).length / floorValues.length
    : 0;

  // Does floor contain ONLY floor info? ("Level 1", "Basement")
  const floorIsFloorOnly = floorValues.length > 0
    ? floorValues.filter(f =>
        /^(level|floor|l\d|basement|mezzanine|roof|crawl|penthouse|attic|ground|grade)/i.test(f.trim()) &&
        !/bldg|building/i.test(f)
      ).length / floorValues.length
    : 0;

  // Does zone look like building IDs? ("BLDG - A", "BLDG - 12", "Building A")
  const zoneIsBuildingId = zoneValues.filter(z =>
    /bldg|building/i.test(z)
  ).length / zoneValues.length;

  // Does zone look like sub-zones? ("Zone A", "Zone 1", "North Wing", "Phase 1")
  const zoneIsSubzone = zoneValues.filter(z =>
    /^(zone|phase|wing|area|section)/i.test(z.trim())
  ).length / zoneValues.length;

  // Cross-check: does one floor value map to multiple zones? (zone = subzone)
  const floorToZones = new Map<string, Set<string>>();
  items.forEach(item => {
    const f = item.floor || '';
    if (!floorToZones.has(f)) floorToZones.set(f, new Set());
    if (item.zone) floorToZones.get(f)!.add(item.zone);
  });
  const floorToZoneEntries = [...floorToZones.values()].filter(s => s.size > 0);
  const avgZonesPerFloor = floorToZoneEntries.length > 0
    ? floorToZoneEntries.reduce((s, z) => s + z.size, 0) / floorToZoneEntries.length
    : 0;

  // ── Decision tree ───────────────────────────────────────────────────────

  if (floorHasBuildingPrefix > 0.5) {
    // Pattern 1: Floor encodes both building and level, zone confirms building
    return {
      floorRole: 'building+floor',
      zoneRole: zoneIsBuildingId > 0.5 ? 'building-confirm' : 'unknown',
      buildingSource: 'floor',
      floorSource: 'floor',
      confidence: floorHasBuildingPrefix,
    };
  }

  if (floorIsFloorOnly > 0.5 && zoneIsBuildingId > 0.5) {
    // Pattern 2: Floor = floor, Zone = building
    return {
      floorRole: 'floor',
      zoneRole: 'building',
      buildingSource: 'zone',
      floorSource: 'floor',
      confidence: Math.min(floorIsFloorOnly, zoneIsBuildingId),
    };
  }

  if (avgZonesPerFloor > 2 && zoneIsSubzone > 0.3) {
    // Pattern 3: Floor = building, Zone = subzone
    // Zone must NOT be used for building lookup
    return {
      floorRole: 'building',
      zoneRole: 'zone',
      buildingSource: 'floor',
      floorSource: 'neither',
      confidence: 0.7,
    };
  }

  // Fallback — can't determine, use drawing
  return {
    floorRole: 'unknown',
    zoneRole: 'unknown',
    buildingSource: 'drawing',
    floorSource: 'neither',
    confidence: 0.3,
  };
}

// ─── Zone → Building ID extraction ───────────────────────────────────────────

/**
 * Extracts a building identifier from a zone string.
 * E.g., "BLDG - A" → "A", "Building 12" → "12", "BLDG-C1" → "C1"
 */
export function getBuildingFromZone(zone: string): string | null {
  if (!zone) return null;

  // "BLDG - A", "BLDG - 12", "BLDG-C1"
  const bldgMatch = zone.match(/BLDG\s*[-–—]\s*([A-Z0-9]+)/i);
  if (bldgMatch) return bldgMatch[1].toUpperCase();

  // "Building A", "Building 12"
  const buildingMatch = zone.match(/Building\s+([A-Z0-9]+)/i);
  if (buildingMatch) return buildingMatch[1].toUpperCase();

  // "BLK A", "Block 3"
  const blockMatch = zone.match(/(?:BLK|Block)\s+([A-Z0-9]+)/i);
  if (blockMatch) return blockMatch[1].toUpperCase();

  return null;
}

// ─── Zone Pattern Matching (Priority 2) ──────────────────────────────────────

/**
 * Checks if a zone string matches any user-configured zone_pattern
 * from building_section_mappings. Used as Priority 2 fallback when
 * getBuildingFromZone (Priority 1 regex) returns null.
 */
export function getZonePatternMatch(
  zone: string,
  buildingMappings: Array<{ building_identifier: string; zone_pattern?: string | null }>
): { building_identifier: string } | null {
  if (!zone) return null;
  for (const m of buildingMappings) {
    if (m.zone_pattern && m.zone_pattern.split(',').some(
      p => zone.toLowerCase().includes(p.trim().toLowerCase())
    )) {
      return { building_identifier: m.building_identifier };
    }
  }
  return null;
}

// ─── Human-readable description ──────────────────────────────────────────────

/** Returns a human-readable description of the detected profile */
export function describeProfile(profile: DatasetProfile): string {
  switch (profile.buildingSource) {
    case 'floor':
      if (profile.floorRole === 'building+floor') {
        return profile.zoneRole === 'building-confirm'
          ? 'Floor encodes building + level, Zone confirms building'
          : 'Floor encodes building + level';
      }
      if (profile.floorRole === 'building') {
        return 'Floor identifies building, Zone is sub-zone';
      }
      return 'Building derived from floor';

    case 'zone':
      return 'Floor is level only, Zone identifies building';

    case 'drawing':
      return 'Building derived from drawing names (floor/zone roles unclear)';

    case 'both':
      return 'Building information in both floor and zone';

    default:
      return 'Unknown field layout';
  }
}

/** Maps override string to display label */
export function getPatternLabel(override: PatternOverride): string {
  switch (override) {
    case 'pattern1': return 'Floor = Building + Level, Zone = Confirm';
    case 'pattern2': return 'Floor = Level, Zone = Building';
    case 'pattern3': return 'Floor = Building, Zone = Sub-zone';
    case 'pattern4': return 'Minimal (use drawing names)';
  }
}
