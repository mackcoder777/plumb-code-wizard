import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useBudgetSettings } from '@/hooks/useBudgetSettings';
import type { EstimateItem } from '@/types/estimate';
import { toast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Wrench, 
  Award,
  Calculator,
  Info,
  DollarSign,
  Undo2,
  AlertTriangle,
  ChevronDown,
  Scale
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { roundHoursPreservingTotal, computeGcFabCont, computeGcFldCont } from '@/utils/budgetExportSystem';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CodeHistoryDetail } from '@/components/CodeHistoryDetail';
import { computeAdjustedLaborSummary, computeFinalLaborSummary, type SavedMergeRecord } from '@/utils/laborSummaryComputation';

// Function to get tax rate by ZIP code using ranges
const getTaxRateByZip = (zipCode: string): { rate: number; jurisdiction: string } => {
  const zip = parseInt(zipCode);
  if (isNaN(zip)) return { rate: 7.25, jurisdiction: 'California State Minimum' };

  // LOS ANGELES COUNTY (varies by city)
  
  // Long Beach: 10.25%
  if ((zip >= 90801 && zip <= 90815) || 
      zip === 90822 || 
      (zip >= 90831 && zip <= 90848)) {
    return { rate: 10.25, jurisdiction: 'Long Beach' };
  }
  
  // Los Angeles City: 9.75% (state 7.25% + county/district add-ons)
  // Rate last verified 2026-04. CDTFA publishes quarterly updates at
  // https://www.cdtfa.ca.gov/taxes-and-fees/sales-use-tax-rates.htm
  if ((zip >= 90001 && zip <= 90089) ||
      (zip >= 90091 && zip <= 90099) ||
      (zip >= 90101 && zip <= 90189) ||
      (zip >= 90291 && zip <= 90296) ||
      (zip >= 91040 && zip <= 91043) ||
      (zip >= 91303 && zip <= 91308) ||
      (zip >= 91311 && zip <= 91316) ||
      (zip >= 91324 && zip <= 91328) ||
      (zip >= 91330 && zip <= 91335) ||
      (zip >= 91340 && zip <= 91349) ||
      (zip >= 91352 && zip <= 91357) ||
      (zip >= 91364 && zip <= 91367) ||
      (zip >= 91401 && zip <= 91499) ||
      (zip >= 91601 && zip <= 91618)) {
    return { rate: 9.75, jurisdiction: 'Los Angeles' };
  }
  
  // Pasadena: 10.25%
  if (zip >= 91101 && zip <= 91199) {
    return { rate: 10.25, jurisdiction: 'Pasadena' };
  }
  
  // Glendale: 10.25%
  if (zip >= 91201 && zip <= 91226) {
    return { rate: 10.25, jurisdiction: 'Glendale' };
  }
  
  // Burbank: 10.25%
  if (zip >= 91501 && zip <= 91526) {
    return { rate: 10.25, jurisdiction: 'Burbank' };
  }
  
  // Santa Monica: 10.25%
  if (zip >= 90401 && zip <= 90411) {
    return { rate: 10.25, jurisdiction: 'Santa Monica' };
  }
  
  // Culver City: 10.25%
  if (zip >= 90230 && zip <= 90233) {
    return { rate: 10.25, jurisdiction: 'Culver City' };
  }
  
  // Inglewood: 10.25%
  if (zip >= 90301 && zip <= 90312) {
    return { rate: 10.25, jurisdiction: 'Inglewood' };
  }
  
  // Torrance: 10.25%
  if (zip >= 90501 && zip <= 90510) {
    return { rate: 10.25, jurisdiction: 'Torrance' };
  }
  
  // Carson: 10.25%
  if (zip >= 90745 && zip <= 90749) {
    return { rate: 10.25, jurisdiction: 'Carson' };
  }
  
  // Compton: 10.25%
  if (zip >= 90220 && zip <= 90224) {
    return { rate: 10.25, jurisdiction: 'Compton' };
  }
  
  // Downey: 10.25%
  if (zip >= 90239 && zip <= 90242) {
    return { rate: 10.25, jurisdiction: 'Downey' };
  }
  
  // Pomona: 10.25%
  if (zip >= 91766 && zip <= 91769) {
    return { rate: 10.25, jurisdiction: 'Pomona' };
  }
  
  // El Monte: 10.25%
  if (zip >= 91731 && zip <= 91735) {
    return { rate: 10.25, jurisdiction: 'El Monte' };
  }
  
  // West Covina: 10.25%
  if (zip >= 91790 && zip <= 91793) {
    return { rate: 10.25, jurisdiction: 'West Covina' };
  }
  
  // Other LA County (unincorporated): 9.5%
  if (zip >= 90000 && zip <= 91999) {
    return { rate: 9.5, jurisdiction: 'Los Angeles County' };
  }
  
  // ORANGE COUNTY
  
  // Santa Ana: 9.25%
  if (zip >= 92701 && zip <= 92799) {
    return { rate: 9.25, jurisdiction: 'Santa Ana' };
  }
  
  // Anaheim: 7.75%
  if (zip >= 92801 && zip <= 92899) {
    return { rate: 7.75, jurisdiction: 'Anaheim' };
  }
  
  // Irvine: 7.75%
  if (zip >= 92602 && zip <= 92699) {
    return { rate: 7.75, jurisdiction: 'Irvine' };
  }
  
  // Other Orange County: 7.75%
  if (zip >= 92600 && zip <= 92899) {
    return { rate: 7.75, jurisdiction: 'Orange County' };
  }
  
  // SAN DIEGO COUNTY: 7.75%
  if (zip >= 92101 && zip <= 92199) {
    return { rate: 7.75, jurisdiction: 'San Diego' };
  }
  if ((zip >= 91901 && zip <= 92199) || (zip >= 92020 && zip <= 92099)) {
    return { rate: 7.75, jurisdiction: 'San Diego County' };
  }
  
  // RIVERSIDE COUNTY: 7.75%
  if (zip >= 92201 && zip <= 92599) {
    return { rate: 7.75, jurisdiction: 'Riverside County' };
  }
  
  // SAN BERNARDINO COUNTY: 7.75%
  if ((zip >= 91701 && zip <= 91799) || (zip >= 92301 && zip <= 92427)) {
    return { rate: 7.75, jurisdiction: 'San Bernardino County' };
  }
  
  // VENTURA COUNTY: 7.25%
  if (zip >= 93001 && zip <= 93099) {
    return { rate: 7.25, jurisdiction: 'Ventura County' };
  }
  
  // KERN COUNTY (Bakersfield): 8.25%
  if (zip >= 93201 && zip <= 93399) {
    return { rate: 8.25, jurisdiction: 'Kern County' };
  }
  
  // FRESNO COUNTY: 7.975%
  if (zip >= 93601 && zip <= 93799) {
    return { rate: 7.975, jurisdiction: 'Fresno County' };
  }
  
  // SACRAMENTO COUNTY: 8.75%
  if (zip >= 94203 && zip <= 95899) {
    return { rate: 8.75, jurisdiction: 'Sacramento County' };
  }
  
  // ALAMEDA COUNTY (Oakland, Berkeley): 10.25%
  if (zip >= 94501 && zip <= 94699) {
    return { rate: 10.25, jurisdiction: 'Alameda County' };
  }
  
  // SAN FRANCISCO: 8.625%
  if (zip >= 94101 && zip <= 94188) {
    return { rate: 8.625, jurisdiction: 'San Francisco' };
  }
  
  // SANTA CLARA COUNTY (San Jose): 9.125%
  if (zip >= 94301 && zip <= 95199) {
    return { rate: 9.125, jurisdiction: 'Santa Clara County' };
  }
  
  // CONTRA COSTA COUNTY: 8.75%
  if (zip >= 94506 && zip <= 94599) {
    return { rate: 8.75, jurisdiction: 'Contra Costa County' };
  }
  
  // Default California State Minimum
  return { rate: 7.25, jurisdiction: 'California State Minimum' };
};

// Material codes that are NON-TAXABLE by default.
// California treats tangible construction material as taxable personal property.
// This list captures narrow exceptions: admin, contingencies, bonds, allowances,
// subcontract work, services. Everything else defaults to taxable.
// PM overrides in Material Tax Details always take precedence.
const NON_TAXABLE_MATERIAL_CODES = [
  'ACCR',  // Accrual
  'ALOW',  // Allowance
  'BCNT',  // Balance of Remainder of Contract
  'BOND',  // Bonds & Permits
  'CCIP',  // CCIP Deduct
  'OCIP',  // OCIP
  'UCIP',  // UCIP Deduct
  'COAL',  // CO Allowance
  'COCN',  // C.O. Contingency
  'CONT',  // Contingency
  'LCNT',  // Labor Contingency
  'MCNT',  // Material Contingency
  'GCNT',  // GC Labor Contingency
  'CCNT',  // Company Cost Contingency
  'HRCN',  // High Rise Factor Contingency
  'LRCN',  // Labor Rate Contingency
  'OCTN',  // Overtime Contingency
  'FCNT',  // Field Bonus Contingency
  'RET1',  // Retainage
  'REV1',  // Income
  'SUB1',  // Sub placeholder
  'OTR1',  // Other placeholder
  'MAT1',  // Material placeholder
  'SUBS',  // Subsistence
];

interface LaborCodeSummary {
  code: string;
  description: string;
  fieldHours: number;
  rate: number;
}

interface MaterialCodeSummary {
  code: string;
  description: string;
  amount: number;
}

interface FabricationConfig {
  enabled: boolean;
  percentage: number;
}

export interface BidRate {
  hours: number;
  rate: string; // String to support editing decimal values — stored at full precision when back-calculated
  total?: string; // Optional user-entered dollar total — when set, this is the source of truth
}

export interface BidRates {
  straightTime: BidRate;
  shiftTime: BidRate;
  overtime: BidRate;
  doubleTime: BidRate;
  shop: BidRate;
}

export interface BudgetAdjustments {
  jobsiteZipCode: string;
  taxRate: number;
  taxJurisdiction: string;
  foremanBonusEnabled: boolean;
  foremanBonusPercent: number;
  foremanBonusHours: number;
  foremanBonusDollars: number;
  fabricationConfigs: Record<string, FabricationConfig>;
  fabricationSummary: Array<{
    code: string;
    description: string;
    fabCode: string;
    strippedHours: number;
    remainingFieldHours: number;
  }>;
  materialTaxOverrides: Record<string, boolean>;
  materialTaxSummary: Array<{
    code: string;
    description: string;
    amount: number;
    taxable: boolean;
    taxAmount: number;
  }>;
  totalMaterialTax: number;
  adjustedLaborSummary: Record<string, {
    code: string;
    description: string;
    hours: number;
    rawHours?: number;
    rate: number;
    dollars: number;
    type: 'field' | 'fab' | 'foreman';
  }>;
  totalFieldHours: number;
  totalFabHours: number;
  totalLaborDollars: number;
  totalMaterialWithTax: number;
  totalMaterialPreTax: number;
  // LRCN (Labor Rate Contingency)
  laborRateContingencyEnabled: boolean;
  bidRates: BidRates;
  budgetRate: number;
  bidTotal: number;
  budgetTotal: number;
  lrcnAmount: number;
  // Fab LRCN
  fabRates: Record<string, { bidRate: number; budgetRate: number }>;
  fabLrcnAmount: number;
  fabLrcnEnabled: boolean;
  // Computed rates
  computedBidLaborRate: number;
  shopRate: number;
  savedMerges?: Array<{
    sec_code: string;
    cost_head: string;
    reassign_to_head?: string | null;
    redistribute_adjustments?: Record<string, number> | null;
    merged_act: string;
  }>;
  // Unified consolidation thresholds — single source of truth for Code Health
  // Dashboard, Job-Wide Consolidation, and Small Code Review small-line floor.
  consolidationThresholds: ConsolidationThresholds;
}

export interface ConsolidationThresholds {
  smallLine: number;       // single line < this is flagged in Small Code Review (default 8)
  sectionRollup: number;   // sec|act bucket total < this is a Section Rollup candidate (default 80)
  sectionWarning: number;  // section total < this gets a ⚠ in Code Health (default 200)
  jobWide: number;         // head across 2+ sections totalling < this is a Job-Wide candidate (default 160)
}

export const DEFAULT_THRESHOLDS: ConsolidationThresholds = {
  smallLine: 8,
  sectionRollup: 80,
  sectionWarning: 200,
  jobWide: 160,
};

interface BudgetAdjustmentsPanelProps {
  laborSummary: Record<string, LaborCodeSummary>;
  materialSummary: Record<string, MaterialCodeSummary>;
  bidLaborRate: number;
  projectId?: string;
  onAdjustmentsChange: (adjustments: BudgetAdjustments) => void;
  estimateData?: EstimateItem[];
  systemMappings?: Array<{ system: string; laborCode?: string }>;
  // Consolidation thresholds owned by Index.tsx (single source of truth).
  // Panel reads these via props and emits changes via the callback. The panel
  // no longer holds its own consolidation_thresholds state, load effect, or
  // save effect — those moved to Index.tsx to fix the dual-ownership bug
  // where dashboard edits could be silently overwritten by the panel's stale
  // copy via the currentAdjustments round-trip.
  consolidationThresholds: ConsolidationThresholds;
  onConsolidationThresholdsChange: (next: ConsolidationThresholds) => void;
}

const FAB_SECTION = 'FP';
const FAB_ACTIVITY = '0000';

// ── Redistribute helpers ────────────────────────────────────
const toActKeyGlobal = (code: string): string => {
  const parts = (code ?? '').trim().split(/\s+/);
  return parts.length >= 3 ? parts[1] : code;
};

interface SmallCodeLine {
  code: string;
  hours: number;
  dollars: number;
  [key: string]: unknown;
}

const buildRoundedDeltas = (
  lines: SmallCodeLine[],
  targets: Record<string, string | number>
): {
  deltas: Record<string, number>;
  netRounded: number;
  isBalanced: boolean;
} => {
  let netRounded = 0;
  const deltas: Record<string, number> = {};
  lines.forEach((l) => {
    const actKey = toActKeyGlobal(l.code);
    const targetVal = parseFloat(String(targets[actKey] ?? targets[l.code] ?? l.hours));
    const raw = targetVal - l.hours;
    const rounded = Math.round(raw);
    netRounded += rounded;
    if (Math.abs(rounded) > 0.001) {
      deltas[actKey] = rounded;
    }
  });
  netRounded = parseFloat(netRounded.toFixed(4));
  return { deltas, netRounded, isBalanced: Math.abs(netRounded) <= 0.01 };
};

/** Nudge the largest-delta line to absorb floating-point residual */
const fixResidual = (
  deltas: Record<string, number>,
  netRounded: number
): Record<string, number> => {
  if (Math.abs(netRounded) <= 0.001 || Object.keys(deltas).length === 0) return deltas;
  const fixed = { ...deltas };
  const target = Object.keys(fixed).reduce((a, b) =>
    Math.abs(fixed[a]) >= Math.abs(fixed[b]) ? a : b
  );
  fixed[target] = parseFloat((fixed[target] - netRounded).toFixed(2));
  return fixed;
};
// ─────────────────────────────────────────────────────────────

const BG_TO_ABOVE_GRADE: Record<string, string[]> = {
  BGWT: ['DWTR', 'WATR'],        // Below Grade Water → Domestic Water, fallback WATR
  DWTR: ['WATR'],                // Stale domestic water code → Water
  BGSD: ['STRM'],                 // Below Grade Storm → Storm Drain
  BGWV: ['SNWV'],                 // Below Grade Waste & Vent → Sanitary Waste & Vent
  BGNG: ['NGAS'],                 // Below Grade Gas → Natural Gas
  BGTP: ['TRAP', 'WATR', 'DWTR'],  // Below Grade Trap Primers → Trap, fallback WATR, then DWTR
  BGAW: ['AWST', 'SNWV'],         // Below Grade Acid Waste → Acid Waste, fallback SNWV
  BGCN: ['COND', 'DWTR', 'WATR'], // Below Grade Condensate → Cond, fallback DWTR/WATR
  BGGW: ['GRWV', 'SNWV'],         // Below Grade Grease Waste → Grease, fallback SNWV
  BGPD: ['PMPD'],                 // Below Grade Pumped Discharge → PMPD (dynamic fallback)
  BGCM: ['COMA'],                 // Below Grade Compressed Air → Compressed Air
  INDR: ['SNWV'],                 // Indoor drain → Sanitary Waste & Vent
  TRAP: ['WATR', 'DWTR'],         // Standalone Trap → WATR, fallback DWTR
  COND: ['DWTR', 'WATR'],         // Condensate → Domestic Water, fallback WATR
  AWST: ['SNWV'],                 // Acid Waste → Sanitary Waste & Vent
};

// These sections are 100% zone-resolved to building sections — never user-intended as standalone
// ST is explicitly excluded — it is a real user-assigned section (Site)
const FALLBACK_SECTIONS = new Set(['CS', 'UG', 'RF', 'AG']);

// For BGPD: determine storm vs sanitary fallback from source system names
const getBgpdFallback = (sourceSystems: Set<string>): string => {
  for (const sys of sourceSystems) {
    const lower = sys.toLowerCase();
    if (/storm|^sd\b|\bsd\s/.test(lower)) return 'STRM';
    if (/sanitary|waste|\bsn\b/.test(lower)) return 'SNWV';
  }
  return 'SNWV';
};

// Maps field labor cost heads → fabrication material cost head
const DEFAULT_FAB_CODE_MAP: Record<string, string> = {
  // Fixed routing — material-independent, always correct regardless of job
  HNGS: 'HNGS',  // Hangers always route to hanger fab
  SUPP: 'HNGS',  // Supports same as hangers
  NGAS: 'CRBN',  // Gas pipe is always carbon steel
  MGAS: 'CRBN',  // Medium pressure gas — always carbon steel
  FNSH: 'FNSH',  // Fixtures always route to finish fab
  FIRE: 'CRBN',  // Fire protection — always carbon steel

  // Spec-dependent — these are intentionally left empty so the
  // auto-suggest engine reads materialSpec from the estimate.
  // Do NOT add entries here that vary by job material selection.
  // SNWV, STRM, BGWV, BGWT, BGSD, BGNG, BGAW, BGPD, BGTP,
  // WATR, DWTR, COND, AWST, RCLM, TRAP, PMPD, INDR — all spec-dependent.

  // No-fab codes — fab strip should never be enabled on these
  // but if it is, route to empty so UI warning fires
  DEMO: '',
  SEQP: '',
  PIDV: '',
  SLVS: '',
  DRNS: '',
};

// Material spec → fab code lookup (pattern-based, order matters)
const MATERIAL_SPEC_TO_FAB_CODE: Array<{ pattern: RegExp; fabCode: string }> = [
  { pattern: /^CI\b|cast\s+iron/i,                                              fabCode: 'CSTI' },
  { pattern: /^copper/i,                                                         fabCode: 'COPR' },
  { pattern: /^CS\s|carbon\s+steel/i,                                           fabCode: 'CRBN' },
  { pattern: /^ABS|^PP\s|^PVDF|^PE\s+Butt|^CPVC|butt\s+fusion|polyprop|polyethylene/i, fabCode: 'PLST' },
];

function getFabCodeFromSpec(materialSpec: string): string | null {
  if (!materialSpec || materialSpec.trim() === 'No Matl Spec') return null;
  for (const { pattern, fabCode } of MATERIAL_SPEC_TO_FAB_CODE) {
    if (pattern.test(materialSpec.trim())) return fabCode;
  }
  return null;
}

// Fixed fab routing — these cost heads always route to a specific fab code
// regardless of material spec. Not spec-dependent.
const FIXED_FAB_ROUTING: Record<string, string> = {
  HNGS: 'HNGS',
  SZMC: 'HNGS',
  PIDV: 'HNGS',
  SLVS: 'HNGS',
};

// For a given cost head, find the dominant fab code suggestion from estimate items
function getDominantFabCode(
  costHead: string,
  estimateData: EstimateItem[]
): { fabCode: string; specName: string; confidence: number } | null {
  if (FIXED_FAB_ROUTING[costHead]) {
    return {
      fabCode: FIXED_FAB_ROUTING[costHead],
      specName: 'Fixed routing — not spec-dependent',
      confidence: 1.0,
    };
  }
  const hoursByFabCode: Record<string, { hours: number; specName: string }> = {};
  let totalHours = 0;

  estimateData.forEach(item => {
    const itemHead = (item.costCode || '').trim().split(/\s+/).pop() || '';
    if (itemHead !== costHead) return;
    const hours = item.hours || 0;
    if (hours <= 0) return;
    const spec = (item.materialSpec || '').trim();
    const fabCode = getFabCodeFromSpec(spec);
    if (!fabCode) return;
    if (!hoursByFabCode[fabCode]) {
      hoursByFabCode[fabCode] = { hours: 0, specName: spec };
    }
    hoursByFabCode[fabCode].hours += hours;
    totalHours += hours;
  });

  if (Object.keys(hoursByFabCode).length === 0) return null;

  const dominant = Object.entries(hoursByFabCode).reduce((best, [code, data]) =>
    data.hours > best.hours ? { fabCode: code, hours: data.hours, specName: data.specName } : best,
    { fabCode: '', hours: 0, specName: '' }
  );

  if (!dominant.fabCode) return null;

  return {
    fabCode: dominant.fabCode,
    specName: dominant.specName,
    confidence: totalHours > 0 ? dominant.hours / totalHours : 0,
  };
}

const FAB_COST_HEAD_DESCRIPTIONS: Record<string, string> = {
  COPR: 'FABRICATION - COPPER',
  CSTI: 'FABRICATION - CAST IRON',
  CSTF: 'FABRICATION - CARBON STEEL TEFLON LINED',
  CRBN: 'FABRICATION - CARBON STEEL',
  SSTL: 'FABRICATION - STAINLESS STEEL',
  SS10: 'FABRICATION - STAINLESS 10GA',
  PLST: 'FABRICATION - PLASTIC / CPVC',
  BRAZ: 'FABRICATION - BRAZED',
  HFBS: 'FABRICATION - HANGER FAB SHEETS',
  HNGS: 'FABRICATION - HANGERS & SUPPORTS',
  FNSH: 'FABRICATION - FINISH',
};

const BudgetAdjustmentsPanel: React.FC<BudgetAdjustmentsPanelProps> = ({
  laborSummary,
  materialSummary,
  bidLaborRate,
  projectId = 'default',
  onAdjustmentsChange,
  estimateData = [],
  systemMappings = [],
  consolidationThresholds,
  onConsolidationThresholdsChange,
}) => {
  // ── Budget settings persistence (DB-backed with localStorage cache) ──
  const { dbSettings, isLoading: settingsLoading, saveSetting, getSetting } = useBudgetSettings(projectId);

  // State initializers use empty defaults — populated by DB load effect below
  const [jobsiteZipCode, setJobsiteZipCode] = useState('');
  const [customTaxRate, setCustomTaxRate] = useState<number | null>(null);
  const [foremanBonusEnabled, setForemanBonusEnabled] = useState(true);
  const [foremanBonusPercent, setForemanBonusPercent] = useState(1);
  const [fabricationConfigs, setFabricationConfigs] = useState<Record<string, FabricationConfig>>({});
  const [materialTaxOverrides, setMaterialTaxOverrides] = useState<Record<string, boolean>>({});
  const [fabRates, setFabRates] = useState<Record<string, { bidRate: string; budgetRate: string }>>({});
  const [fabCodeMap, setFabCodeMap] = useState<Record<string, string>>({ ...DEFAULT_FAB_CODE_MAP });
  const [lrcnEnabled, setLrcnEnabled] = useState(false);
  const [fabLrcnEnabled, setFabLrcnEnabled] = useState(true);
  const [bidRates, setBidRates] = useState<BidRates>({
    straightTime: { hours: 0, rate: '92.03' },
    shiftTime: { hours: 0, rate: '95.70' },
    overtime: { hours: 0, rate: '121.57' },
    doubleTime: { hours: 0, rate: '145.38' },
    shop: { hours: 0, rate: '0' }
  });
  const [budgetRate, setBudgetRate] = useState(85);
  const [budgetRateInput, setBudgetRateInput] = useState('85');
  const [customFabCodes, setCustomFabCodes] = useState<Record<string, string>>({});
  const [customFabEntry, setCustomFabEntry] = useState<{ costHead: string; code: string; desc: string } | null>(null);

  // Track whether we've loaded DB settings for this project
  const settingsLoadedForRef = useRef<string | null>(null);

  // Fix B: reset settingsLoadedForRef on unmount so remounts re-hydrate from DB
  useEffect(() => {
    return () => { settingsLoadedForRef.current = null; };
  }, []);

  // Load settings from DB (or localStorage fallback) when dbSettings arrive or projectId changes
  useEffect(() => {
    if (settingsLoading) return;
    if (!projectId || projectId === 'default') return;
    if (settingsLoadedForRef.current === projectId && Object.keys(dbSettings).length === 0) return;
    // Only run once per projectId unless dbSettings change
    if (settingsLoadedForRef.current === projectId) return;
    settingsLoadedForRef.current = projectId;

    if (import.meta.env.DEV) console.log('[BudgetAdjustments] Loading settings from DB for', projectId);

    setJobsiteZipCode(getSetting<string>('zip', ''));
    setCustomTaxRate(getSetting<number | null>('taxrate', null));
    setForemanBonusEnabled(getSetting<boolean>('foreman_enabled', true));
    setForemanBonusPercent(getSetting<number>('foreman_pct', 1));
    setFabricationConfigs(getSetting<Record<string, FabricationConfig>>('fab_configs', {}));
    setMaterialTaxOverrides(getSetting<Record<string, boolean>>('tax_overrides', {}));
    setLrcnEnabled(getSetting<boolean>('lrcn_enabled', false));
    setFabLrcnEnabled(getSetting<boolean>('fab_lrcn_enabled', true));
    setBidRates(getSetting<BidRates>('bid_rates', {
      straightTime: { hours: 0, rate: '92.03' },
      shiftTime: { hours: 0, rate: '95.70' },
      overtime: { hours: 0, rate: '121.57' },
      doubleTime: { hours: 0, rate: '145.38' },
      shop: { hours: 0, rate: '0' }
    }));
    const rate = getSetting<number>('budget_rate', 85);
    setBudgetRate(rate);
    setBudgetRateInput(rate.toString());
    const savedFabCodeMap = getSetting<Record<string, string>>('fab_code_map', {});
    setFabCodeMap({ ...DEFAULT_FAB_CODE_MAP, ...savedFabCodeMap });
    setFabRates(getSetting<Record<string, { bidRate: string; budgetRate: string }>>('fab_rates', {}));
    setCustomFabCodes(getSetting<Record<string, string>>('custom_fab_codes', {}));

    // All setState calls complete — defer setting initialized=true until AFTER
    // React processes the re-render so save effects skip the load-triggered updates
    setTimeout(() => {
      settingsInitializedRef.current = true;
    }, 0);

    // Auto-migrate: if DB was empty but localStorage had data, persist to DB
    if (Object.keys(dbSettings).length === 0) {
      if (import.meta.env.DEV) console.log('[BudgetAdjustments] Auto-migrating localStorage to DB');
      const lsZip = localStorage.getItem(`budget_zip_${projectId}`);
      if (lsZip) saveSetting('zip', lsZip);
      const lsTax = localStorage.getItem(`budget_taxrate_${projectId}`);
      if (lsTax) saveSetting('taxrate', parseFloat(lsTax));
      const lsFE = localStorage.getItem(`budget_foreman_enabled_${projectId}`);
      if (lsFE !== null) saveSetting('foreman_enabled', lsFE === 'true');
      const lsFP = localStorage.getItem(`budget_foreman_pct_${projectId}`);
      if (lsFP) saveSetting('foreman_pct', parseFloat(lsFP));
      const lsFC = localStorage.getItem(`budget_fab_configs_${projectId}`);
      if (lsFC) saveSetting('fab_configs', JSON.parse(lsFC));
      const lsTO = localStorage.getItem(`budget_tax_overrides_${projectId}`);
      if (lsTO) saveSetting('tax_overrides', JSON.parse(lsTO));
      const lsLE = localStorage.getItem(`budget_lrcn_enabled_${projectId}`);
      if (lsLE) saveSetting('lrcn_enabled', lsLE === 'true');
      const lsFLE = localStorage.getItem(`budget_fab_lrcn_enabled_${projectId}`);
      if (lsFLE !== null) saveSetting('fab_lrcn_enabled', lsFLE === 'true');
      const lsBR = localStorage.getItem(`budget_bid_rates_${projectId}`);
      if (lsBR) saveSetting('bid_rates', JSON.parse(lsBR));
      const lsRate = localStorage.getItem(`budget_rate_${projectId}`);
      if (lsRate) saveSetting('budget_rate', parseFloat(lsRate));
      const lsFCM = localStorage.getItem(`budget_fab_code_map_${projectId}`);
      if (lsFCM) saveSetting('fab_code_map', JSON.parse(lsFCM));
      const lsFR = localStorage.getItem(`budget_fab_rates_${projectId}`);
      if (lsFR) saveSetting('fab_rates', JSON.parse(lsFR));
      const lsCFC = localStorage.getItem(`budget_custom_fab_codes_${projectId}`);
      if (lsCFC) saveSetting('custom_fab_codes', JSON.parse(lsCFC));
      // NOTE: consolidation_thresholds load + seed migration moved to
      // Index.tsx (single owner). Do not re-add here.
    }
  }, [settingsLoading, projectId, dbSettings, getSetting, saveSetting]);

const [consolidations, setConsolidations] = useState<Record<string, boolean>>({});
const [undoingKey, setUndoingKey] = useState<string | null>(null);
const [smallCodeTab, setSmallCodeTab] = useState<'merge' | 'standalone'>('merge');
  const lastCheckedIndexRef = useRef<number>(-1);
  const [expandedHistoryKeys, setExpandedHistoryKeys] = useState<Set<string>>(new Set());
  
  const shiftKeyRef = useRef<boolean>(false);
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({});
  const [redistributeAdjustments, setRedistributeAdjustments] = useState<Record<string, Record<string, number>>>({});
  const [manuallyOverridden, setManuallyOverridden] = useState<Set<string>>(new Set());
  
  const [standaloneMaxHours, setStandaloneMaxHours] = useState<number>(8);
  // Consolidation thresholds are owned by Index.tsx (single source of truth)
  // and arrive as props. minHoursThreshold remains a derived alias so existing
  // call sites (filters, threshold comparisons, label text) compile unchanged.
  // Threshold edits flow through onConsolidationThresholdsChange; there is no
  // local state, no load effect, no save effect for thresholds in this panel.
  const minHoursThreshold = consolidationThresholds.smallLine;
  const [standaloneFilter, setStandaloneFilter] = useState<'all' | 'open' | 'saved' | 'residual' | 'in-export'>('all');

  // Supabase: load saved merges for this project
  const queryClient = useQueryClient();
  const { data: savedMergesData } = useQuery({
    queryKey: ['small-code-merges', projectId],
    queryFn: async () => {
      if (!projectId || projectId === 'default') return [];
      const { data, error } = await supabase
        .from('project_small_code_merges')
        .select('*')
        .eq('project_id', projectId);
      if (error) { console.error('Failed to load saved merges:', error); return []; }
      return data ?? [];
    },
    enabled: !!projectId && projectId !== 'default',
  });

  // Fix A: load Code Cleanup hour redistributions and feed them into the
  // finalLaborSummary pipeline. Without this, Step 3 redistribute decisions
  // are written to the DB but never affect the export.
  const { data: hourRedistributionsData } = useQuery({
    queryKey: ['hour-redistributions', projectId],
    queryFn: async () => {
      if (!projectId || projectId === 'default') return [];
      const { data, error } = await supabase
        .from('project_hour_redistributions')
        .select('*')
        .eq('project_id', projectId);
      if (error) {
        console.error('Failed to load hour redistributions:', error);
        return [];
      }
      return data ?? [];
    },
    enabled: !!projectId && projectId !== 'default',
  });

  const saveMergeMutation = useMutation({
    mutationFn: async (entries: Array<{ sec_code: string; cost_head: string; reassign_to_head?: string | null; redistribute_adjustments?: Record<string, number> | null }>) => {
      if (!projectId || projectId === 'default') return;
      
      // Build the full set of rows to persist
      const rows = entries.map(e => ({
        project_id: projectId,
        cost_head: e.cost_head,
        sec_code: e.sec_code,
        merged_act: '0000',
        reassign_to_head: e.reassign_to_head ?? null,
        redistribute_adjustments: e.redistribute_adjustments ?? null,
      }));

      // Deduplicate by (sec_code, cost_head) — keep last entry per key to prevent constraint violations
      const seen = new Set<string>();
      const dedupedRows = [...rows].reverse().filter(r => {
        const k = `${r.sec_code}|${r.cost_head}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      }).reverse();

      // Fix C: legacy writer must NOT touch Code Cleanup-authored rows
      // (those have a non-null `operation_type`). Inclusion check on null is
      // forward-compatible — any new operation_type added later automatically
      // stays protected without updating an enumerated blocklist.
      const { error: deleteError } = await supabase
        .from('project_small_code_merges')
        .delete()
        .eq('project_id', projectId)
        .is('operation_type', null);

      if (deleteError) throw new Error(`Failed to clear existing merges: ${deleteError.message}`);

      if (dedupedRows.length > 0) {
        const { error: insertError } = await supabase
          .from('project_small_code_merges')
          .insert(dedupedRows);
        if (insertError) throw new Error(`Failed to save merges: ${insertError.message}`);
      }
    },
    onSuccess: () => {
      // State clearing moved to callsite onSuccess — after refetch completes
      // to prevent the "flash of unsaved" between state clear and cache refresh
    },
    onError: (error: Error) => {
      console.error('Save merge failed:', error);
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
      // Refetch to restore last-known-good state
      queryClient.invalidateQueries({ queryKey: ['small-code-merges', projectId] });
    },
  });

  // ── DB-backed persistence effects (replace all localStorage-only effects) ──
  // Each setting change writes to both localStorage (instant) and DB (debounced 500ms)
  const settingsInitializedRef = useRef(false);

  // Fix B: reset settingsInitializedRef when projectId changes so save effects
  // don't fire during the load cycle of a new project
  useEffect(() => {
    settingsInitializedRef.current = false;
    settingsLoadedForRef.current = null;
  }, [projectId]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('zip', jobsiteZipCode);
  }, [jobsiteZipCode]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('taxrate', customTaxRate);
  }, [customTaxRate]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('foreman_enabled', foremanBonusEnabled);
  }, [foremanBonusEnabled]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('foreman_pct', foremanBonusPercent);
  }, [foremanBonusPercent]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('fab_configs', fabricationConfigs);
  }, [fabricationConfigs]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('tax_overrides', materialTaxOverrides);
  }, [materialTaxOverrides]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('lrcn_enabled', lrcnEnabled);
  }, [lrcnEnabled]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('bid_rates', bidRates);
  }, [bidRates]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('budget_rate', budgetRate);
  }, [budgetRate]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('fab_code_map', fabCodeMap);
  }, [fabCodeMap]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('fab_rates', fabRates);
  }, [fabRates]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('fab_lrcn_enabled', fabLrcnEnabled);
  }, [fabLrcnEnabled]);

  useEffect(() => {
    if (!settingsInitializedRef.current || !projectId || projectId === 'default') return;
    saveSetting('custom_fab_codes', customFabCodes);
  }, [customFabCodes]);

  // Save effect for consolidation_thresholds removed: threshold persistence
  // is owned by Index.tsx now. Do not re-add here — that would recreate the
  // dual-ownership stale-state bug.

  // Aggregate laborSummary by cost head (last segment of full code)
  const groupedByCostHead = useMemo(() => {
    const grouped: Record<string, {
      costHead: string;
      description: string;
      totalHours: number;
      totalDollars: number;
      fullCodes: string[];
    }> = {};

    Object.entries(laborSummary).forEach(([fullCode, data]) => {
      const parts = fullCode.trim().split(/\s+/);
      const costHead = parts[parts.length - 1];

      if (!grouped[costHead]) {
        grouped[costHead] = {
          costHead,
          description: data.description || costHead,
          totalHours: 0,
          totalDollars: 0,
          fullCodes: [],
        };
      }
      grouped[costHead].totalHours += data.fieldHours || 0;
      grouped[costHead].totalDollars += (data.fieldHours || 0) * (data.rate || 0);
      grouped[costHead].fullCodes.push(fullCode);
    });

    return grouped;
  }, [laborSummary]);

  const taxInfo = useMemo(() => {
    if (customTaxRate !== null) {
      return { rate: customTaxRate, jurisdiction: 'Custom Rate' };
    }
    if (jobsiteZipCode && jobsiteZipCode.length === 5) {
      return getTaxRateByZip(jobsiteZipCode);
    }
    return { rate: 7.25, jurisdiction: 'Enter ZIP Code' };
  }, [jobsiteZipCode, customTaxRate]);

  // LRCN calculations — uses entry.total as source of truth when present
  const lrcnCalculations = useMemo(() => {
    const parseRate = (rate: string) => parseFloat(rate) || 0;
    // Resolve the authoritative dollar total for a bid rate entry:
    // If user entered a total, use it; otherwise compute hours × rate.
    const resolveTotal = (entry: BidRate): number => {
      if (entry.total !== undefined && entry.total !== '') {
        const parsed = parseFloat(entry.total);
        if (!isNaN(parsed)) return parsed;
      }
      return entry.hours * parseRate(entry.rate);
    };
    
    const straightTotal = resolveTotal(bidRates.straightTime);
    const shiftTotal = resolveTotal(bidRates.shiftTime);
    const overtimeTotal = resolveTotal(bidRates.overtime);
    const doubleTimeTotal = resolveTotal(bidRates.doubleTime);
    const shopTotal = resolveTotal(bidRates.shop);
    
    const bidTotal = straightTotal + shiftTotal + overtimeTotal + doubleTimeTotal + shopTotal;
    const fieldHours = bidRates.straightTime.hours + bidRates.shiftTime.hours +
                       bidRates.overtime.hours + bidRates.doubleTime.hours;
    const shopHours = bidRates.shop.hours;
    const shopRate = parseRate(bidRates.shop.rate);
    const totalHours = fieldHours + shopHours;
    const budgetTotal = (fieldHours * budgetRate) + (shopHours * shopRate);
    const lrcnAmount = bidTotal - budgetTotal;
    
    return {
      bidTotal,
      budgetTotal,
      lrcnAmount,
      totalHours,
      fieldHours,
      shopHours,
      shopRate,
      straightTotal,
      shiftTotal,
      overtimeTotal,
      doubleTimeTotal,
      shopTotal
    };
  }, [bidRates, budgetRate]);

  // computedBidLaborRate — field hours only, no shop
  const computedBidLaborRate = useMemo(() => {
    const fieldHours =
      (parseFloat(String(bidRates.straightTime.hours)) || 0) +
      (parseFloat(String(bidRates.shiftTime.hours)) || 0) +
      (parseFloat(String(bidRates.overtime.hours)) || 0) +
      (parseFloat(String(bidRates.doubleTime.hours)) || 0);

    if (!lrcnEnabled || fieldHours <= 0) return bidLaborRate; // fallback

    const fieldDollars =
      lrcnCalculations.straightTotal +
      lrcnCalculations.shiftTotal +
      lrcnCalculations.overtimeTotal +
      lrcnCalculations.doubleTimeTotal;

    return fieldDollars / fieldHours;
  }, [bidRates, lrcnCalculations, lrcnEnabled, bidLaborRate]);

  // shopRate — for fab codes only
  const shopRate = useMemo(() => {
    return parseFloat(String(bidRates.shop?.rate)) || bidLaborRate;
  }, [bidRates.shop?.rate, bidLaborRate]);

  const calculations = useMemo(() => {
    // Commit 1a: labor/fab/foreman/rounding pass extracted to pure helper.
    // Material tax pass stays panel-local — independent deps, separate concern.
    const {
      adjustedLaborSummary,
      foremanBonusHours,
      foremanBonusDollars,
      fabricationSummary,
      totalFieldHours,
      totalFabHours,
      generatedFabCodes,
    } = computeAdjustedLaborSummary({
      laborSummary,
      foremanBonusEnabled,
      foremanBonusPercent,
      computedBidLaborRate,
      fabricationConfigs,
      fabCodeMap,
      fabRates,
      customFabCodes,
      shopRate,
      budgetRate,
    });

    // Note: FCNT (Foreman Contingency) is now a MATERIAL line item, not labor
    // It appears in the Material Breakdown section of the export

    const totalLaborDollars = Object.values(adjustedLaborSummary)
      .reduce((sum, item) => sum + item.dollars, 0);

    const materialTaxSummary: BudgetAdjustments['materialTaxSummary'] = [];
    let totalMaterialTax = 0;
    let totalMaterialPreTax = 0;

    Object.entries(materialSummary).forEach(([code, data]) => {
      const amount = data.amount || 0;
      // Default to taxable unless code is in non-taxable list OR is a
      // 98xx subcontract code (9800-9877 all represent sub work, not material).
      // PM overrides in Material Tax Details always win.
      const isSubCode = /^98\d{2}$/.test(code);
      const defaultTaxable = !NON_TAXABLE_MATERIAL_CODES.includes(code) && !isSubCode;
      const isTaxable = materialTaxOverrides[code] !== undefined
        ? materialTaxOverrides[code]
        : defaultTaxable;
      const taxAmount = isTaxable ? amount * (taxInfo.rate / 100) : 0;

      materialTaxSummary.push({
        code,
        description: data.description,
        amount,
        taxable: isTaxable,
        taxAmount
      });

      totalMaterialPreTax += amount;
      totalMaterialTax += taxAmount;
    });

    const totalMaterialWithTax = totalMaterialPreTax + totalMaterialTax;

    return {
      foremanBonusHours,
      foremanBonusDollars,
      fabricationSummary,
      adjustedLaborSummary,
      totalFieldHours,
      totalFabHours,
      totalLaborDollars,
      materialTaxSummary,
      totalMaterialTax,
      totalMaterialWithTax,
      totalMaterialPreTax,
      generatedFabCodes
    };
  }, [laborSummary, materialSummary, foremanBonusEnabled, foremanBonusPercent, fabricationConfigs, materialTaxOverrides, taxInfo, budgetRate, shopRate, fabCodeMap, fabRates, computedBidLaborRate, customFabCodes]);

  // Fab LRCN calculations
  const fabLrcnCalculations = useMemo(() => {
    let fabLrcnAmount = 0;
    const breakdown: Array<{ code: string; hours: number; bidRate: number; budgetRate: number; diff: number }> = [];
    Object.entries(calculations.generatedFabCodes || {}).forEach(([fabCostHead, hours]) => {
      const bidRate = parseFloat(fabRates[fabCostHead]?.bidRate) || shopRate;
      const budgetRate = parseFloat(fabRates[fabCostHead]?.budgetRate) || bidRate;
      const diff = (hours * bidRate) - (hours * budgetRate);
      fabLrcnAmount += diff;
      breakdown.push({ code: fabCostHead, hours, bidRate, budgetRate, diff });
    });
    return { fabLrcnAmount, breakdown };
  }, [calculations.generatedFabCodes, fabRates, shopRate]);

  // Stale merge detection — find saved merges whose cost_head no longer exists in live data
  const staleMergeUpdates = useMemo(() => {
    if (!savedMergesData?.length || !calculations.adjustedLaborSummary) return [];

    const liveKeys = new Set(Object.keys(calculations.adjustedLaborSummary));

    return savedMergesData
      .filter(merge => {
        const hasMatch = [...liveKeys].some(lk => {
          const parts = lk.trim().split(/\s+/);
          const keyHead = parts[parts.length - 1];
          const keySec = parts[0];
          return keySec === merge.sec_code && keyHead === merge.cost_head;
        });
        return !hasMatch;
      })
      .map(merge => {
        const nameMatch = [...liveKeys].find(lk => {
          const parts = lk.trim().split(/\s+/);
          const keySec = parts[0];
          const keyHead = parts[parts.length - 1];
          return keySec === merge.sec_code && keyHead === merge.cost_head;
        });

        const newCostHead = nameMatch
          ? nameMatch.trim().split(/\s+/).slice(2).join(' ')
          : null;

        return {
          mergeId: merge.id,
          secCode: merge.sec_code,
          oldCostHead: merge.cost_head,
          newCostHead,
          // Narrow the Supabase Json column to the helper's contract at the
          // boundary. Runtime: redistribute_adjustments is always null or a
          // {[act: string]: number} object — never a string/array — because
          // every writer in this codebase constructs it that way. Cast keeps
          // SavedMergeRecord's stricter type without changing behavior.
          mergeRecord: {
            ...merge,
            redistribute_adjustments:
              (merge.redistribute_adjustments as Record<string, number> | null | undefined) ?? null,
          } as SavedMergeRecord,
        };
      }) as Array<{
        mergeId: string;
        secCode: string;
        oldCostHead: string;
        newCostHead: string | null;
        mergeRecord: SavedMergeRecord;
      }>;
  }, [savedMergesData, calculations.adjustedLaborSummary]);

  // Apply saved merges on top of adjustedLaborSummary → finalLaborSummary
  const finalLaborSummary = useMemo(() => {
    const result = computeFinalLaborSummary({
      adjustedLaborSummary: calculations.adjustedLaborSummary,
      savedMergesData: savedMergesData as any,
      staleMergeUpdates,
      // Fix A: feed Code Cleanup hour redistributions into Stage 3.5.
      hourRedistributions: (hourRedistributionsData ?? []).map((r: any) => ({
        sec: r.sec_code,
        act: r.act_code,
        sourceHead: r.source_head,
        targetHead: r.target_head,
        hoursMoved: Number(r.hours_moved) || 0,
      })),
    });
    if (import.meta.env.DEV) {
      const inHours = Object.values(calculations.adjustedLaborSummary ?? {})
        .reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
      const outHours = Object.values(result ?? {})
        .reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
      console.log(
        `[BudgetPanel/diag] finalLaborSummary: inKeys=${Object.keys(calculations.adjustedLaborSummary ?? {}).length} ` +
          `outKeys=${Object.keys(result ?? {}).length} ` +
          `inHours=${inHours.toFixed(1)} outHours=${outHours.toFixed(1)} ` +
          `redist=${(hourRedistributionsData ?? []).length}`
      );
    }
    return result;
  }, [calculations.adjustedLaborSummary, savedMergesData, staleMergeUpdates, hourRedistributionsData]);

  // Auto-cleanup: delete orphaned merges for fallback sections that folded to 0 hours
  const cleanupRanRef = useRef(false);

  useEffect(() => {
    if (
      !savedMergesData?.length ||
      !calculations.adjustedLaborSummary ||  // use PRE-merge data
      !projectId ||
      projectId === 'default' ||
      cleanupRanRef.current
    ) return;

    const rawSummary = calculations.adjustedLaborSummary;
    const rawKeys = Object.keys(rawSummary);

    // Only clean up merges for fallback sections where the cost head
    // has ZERO hours across ALL sections in the raw pre-merge data
    // Fix D: skip Code Cleanup-authored rows (operation_type !== null).
    // The orphan-cleanup is built around the legacy writer's quirks; Code
    // Cleanup rows are managed atomically by useApplyDecisions and must not
    // be touched here.
    const fallbackMerges = savedMergesData.filter(m =>
      !m.operation_type &&
      FALLBACK_SECTIONS.has((m.sec_code || '').trim().toUpperCase())
    );

    if (fallbackMerges.length === 0) return;

    const toDelete = fallbackMerges.filter(merge => {
      const head = (merge.cost_head || '').trim();
      // Check if this cost head has ANY hours anywhere in the raw summary
      const hasAnyHours = rawKeys.some(k => {
        const kHead = k.trim().split(/\s+/).pop();
        return kHead === head && (rawSummary[k]?.hours ?? 0) > 0;
      });
      return !hasAnyHours; // only delete if truly zero across all sections
    });

    // nullNullOrphans: merge records with no action AND no source in raw data
    const nullNullOrphans = savedMergesData.filter(m => {
      if (m.operation_type) return false; // Fix D: skip Code Cleanup rows
      if (m.reassign_to_head !== null || m.redistribute_adjustments !== null) return false;
      const sec = (m.sec_code || '').trim();
      const head = (m.cost_head || '').trim();
      // Check if ANY key with this sec+head exists in raw pre-merge data
      const hasSourceInRaw = rawKeys.some(k => {
        const kParts = k.trim().split(/\s+/);
        return kParts[0] === sec && kParts[kParts.length - 1] === head;
      });
      return !hasSourceInRaw;
    });

    // activityOrphans: merge records whose source activity codes no longer exist
    // (e.g., after clearing all ACT to 0000 — 00L1/00L2 keys collapsed into 0000)
    const activityOrphans = savedMergesData.filter(m => {
      if (m.operation_type) return false; // Fix D: skip Code Cleanup rows
      if (toDelete.some(d => d.id === m.id) || nullNullOrphans.some(d => d.id === m.id)) return false;
      if (m.reassign_to_head === '__keep__') return false;

      const sec = (m.sec_code || '').trim();
      const head = (m.cost_head || '').trim();
      if (!sec || !head) return false;

      const liveKeys = rawKeys.filter(k => {
        const parts = k.trim().split(/\s+/);
        return parts[0] === sec && parts.slice(2).join(' ') === head;
      });

      // Zero live keys = fully orphaned
      if (liveKeys.length === 0) return true;

      // One live key at 0000 activity = collapse happened, merge is moot
      if (liveKeys.length === 1) {
        const parts = liveKeys[0].trim().split(/\s+/);
        if (parts[1] === '0000') return true;
      }

      return false;
    });

    // Combine but deduplicate by id
    const seen = new Set<string>();
    const allToDelete = [...toDelete, ...nullNullOrphans, ...activityOrphans].filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });

    if (allToDelete.length === 0) return;

    cleanupRanRef.current = true;

    const cleanup = async () => {
      const ids = allToDelete.map(m => m.id);
      if (import.meta.env.DEV) console.log('[AutoCleanup] Deleting orphaned merges:', ids.length, allToDelete.map(m => `${m.sec_code}|${m.cost_head}`));

      const { error } = await supabase
        .from('project_small_code_merges')
        .delete()
        .in('id', ids);

      if (error) {
        console.error('[AutoCleanup] Failed:', error);
        cleanupRanRef.current = false;
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['small-code-merges', projectId] });
      toast({
        title: `Cleaned up ${allToDelete.length} orphaned merge${allToDelete.length > 1 ? 's' : ''}`,
        description: `Removed rules for sections with no source data: ${[...new Set(allToDelete.map(m => m.sec_code))].join(', ')}`,
      });
    };

    cleanup();
  }, [savedMergesData, calculations.adjustedLaborSummary, projectId]);

  // Auto-cleanup: delete stale __accepted__ records where code is below threshold
  const acceptedCleanupRanRef = useRef(false);

  useEffect(() => {
    if (acceptedCleanupRanRef.current) return;
    if (!savedMergesData?.length || !finalLaborSummary || !projectId || projectId === 'default') return;
    const stale = savedMergesData.filter(m => {
      // Delete ALL __accepted__ records — the action is architecturally broken
      if (m.reassign_to_head === '__accepted__') return true;
      return false;
    });
    if (stale.length === 0) return;
    acceptedCleanupRanRef.current = true;
    const ids = stale.map(m => m.id);
    supabase
      .from('project_small_code_merges')
      .delete()
      .in('id', ids)
      .then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ['small-code-merges', projectId] });
          toast({
            title: `Cleared ${ids.length} stale accepted record(s)`,
            description: 'These codes will reappear as open for re-resolution.',
          });
        }
      });
  }, [savedMergesData, finalLaborSummary, minHoursThreshold, projectId]);

  // Detect saved redistributions that can't be applied against live data
  const inapplicableSavedKeys = useMemo(() => {
    if (!savedMergesData || !calculations.adjustedLaborSummary) return new Set<string>();
    const liveKeys = new Set(Object.keys(calculations.adjustedLaborSummary));
    const stale = new Set<string>();

    savedMergesData.forEach(merge => {
      if (merge.redistribute_adjustments && typeof merge.redistribute_adjustments === 'object') {
        const adjKeys = Object.keys(merge.redistribute_adjustments as object);
        const sec = (merge.sec_code || '').trim();
        const head = (merge.cost_head || '').trim();
        const anyLive = adjKeys.some(k => {
          // Full code key — check directly
          if (k.includes(' ')) return liveKeys.has(k);
          // Short activity code — expand to full code before checking
          const fullCode = `${sec} ${k} ${head}`;
          return liveKeys.has(fullCode);
        });
        if (!anyLive) stale.add(`${sec}|${head}`);
      }
    });
    return stale;
  }, [savedMergesData, calculations.adjustedLaborSummary]);

  // Small Code Consolidation Analysis — runs against finalLaborSummary
  const smallCodeAnalysis = useMemo(() => {
    if (!finalLaborSummary || Object.keys(finalLaborSummary).length === 0) return [];
    const entries = Object.values(finalLaborSummary);

    const parsed = entries.map(item => {
      const parts = (item.code ?? '').trim().split(/\s+/);
      return { ...item, sec: parts[0] ?? '', act: parts[1] ?? '', head: parts.slice(2).join(' ') || '', isSmall: (item.rawHours ?? item.hours ?? 0) < minHoursThreshold };
    });

    const bySecHead: Record<string, typeof parsed> = {};
    parsed.forEach(item => {
      if (!item.head) return;
      const key = `${item.sec}|${item.head}`;
      if (!bySecHead[key]) bySecHead[key] = [];
      bySecHead[key].push(item);
    });

    return Object.entries(bySecHead)
      .filter(([, lines]) => lines.some(l => l.isSmall))
      .map(([key, lines]) => {
        const [sec, ...headParts] = key.split('|');
        const head = headParts.join('|');
        const combinedHours = lines.reduce((s, l) => s + (l.hours ?? 0), 0);
        const combinedRawHours = lines.reduce((s, l) => s + ((l as any).rawHours ?? l.hours ?? 0), 0);
        return { key, head, sec: sec!, lines, combinedHours, combinedRawHours };
      });
  }, [finalLaborSummary, minHoursThreshold]);

  // Auto-suggestions for standalone codes
  const standaloneAutoSuggestions = useMemo(() => {
    if (!smallCodeAnalysis?.length || !finalLaborSummary) return {};
    const standalone = smallCodeAnalysis.filter(r => r.lines.length === 1);
    if (standalone.length === 0) return {};
    const suggestions: Record<string, { targetHead: string; targetKey: string; reason: string }> = {};
    const liveKeys = Object.keys(finalLaborSummary);

    // These are peer system codes — no valid auto-merge target exists
    const ABOVE_GRADE_SYSTEM_CODES = new Set([
      'DWTR', 'WATR', 'SNWV', 'STRM', 'NGAS', 'GRWV', 'RCLM',
      'PMPD', 'FIRE', 'DEMO', 'AWST', 'COND', 'TRAP',
    ]);

    const findTargetKey = (sec: string, candidates: string[]) => {
      for (const candidate of candidates) {
        const match = liveKeys.find(k => {
          const kParts = k.trim().split(/\s+/);
          return kParts[0] === sec && kParts[kParts.length - 1] === candidate;
        });
        if (match) return { key: match, head: candidate };
      }
      return null;
    };

    standalone.forEach(entry => {
      const parts = (entry.key || '').split('|');
      const sec = parts[0] || '';
      const head = parts[1] || '';
      const actualHead = head.split(' ').pop() || head; // "PL BGAW" → "BGAW"

      // Rule 1: Known alias / BG variant with fallback chain
      const chain = BG_TO_ABOVE_GRADE[actualHead];
      if (chain) {
        let candidates = [...chain];

        // BGPD: dynamic fallback based on source system name
        if (actualHead === 'BGPD') {
          const sourceSystems = new Set<string>();
          estimateData.forEach(item => {
            if (!item.costCode) return;
            const ip = (item.costCode || '').trim().split(/\s+/);
           if (ip[0] === sec && ip[ip.length - 1] === actualHead) sourceSystems.add((item.system || '').trim());
          });
          candidates = ['PMPD', getBgpdFallback(sourceSystems)];
        }

        const found = findTargetKey(sec, candidates);
        if (found) {
          const isPrimary = found.head === candidates[0];
          suggestions[entry.key] = {
            targetHead: found.head,
            targetKey: found.key,
            reason: isPrimary
              ? `${head} → ${found.head}`
              : `${head} → ${candidates[0]} not found, using fallback ${found.head}`,
          };
          return;
        }
      }

      // Rule 2: Category override codes → infer target from source systems
      // Above-grade peer system codes are excluded — they cannot merge into each other
      if (ABOVE_GRADE_SYSTEM_CODES.has(actualHead)) {
        // Rule 2b: same cost head, different activity — check first before peer-merge
        const sameHeadMatch = Object.entries(finalLaborSummary ?? {})
          .filter(([k]) => {
            const p = k.trim().split(/\s+/);
            const kHours = finalLaborSummary[k]?.hours ?? 0;
            return p[0] === sec &&
                   p.slice(2).join(' ') === head &&
                   k !== entry.lines[0].code &&
                   (kHours + entry.combinedHours) >= minHoursThreshold;
          })
          .sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
        if (sameHeadMatch.length > 0) {
          suggestions[entry.key] = {
            targetHead: head,
            targetKey: sameHeadMatch[0][0],
            reason: `${head} → ${head} (same cost head, consolidated activity)`,
          };
          return;
        }

        // No same-head match — fall through to peer-merge largest-in-section
        const sameSec = Object.entries(finalLaborSummary ?? {})
          .filter(([k]) => {
            const p = k.trim().split(/\s+/);
            const targetHead = p.slice(2).join(' ');
            return p[0] === sec && targetHead !== head && (finalLaborSummary[k]?.hours ?? 0) >= minHoursThreshold;
          })
          .sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
        if (sameSec.length > 0) {
          const tHead = sameSec[0][0].trim().split(/\s+/).slice(2).join(' ');
          if (ABOVE_GRADE_SYSTEM_CODES.has(tHead.split(' ').pop() || tHead)) {
            suggestions[entry.key] = {
              targetHead: tHead,
              targetKey: sameSec[0][0],
              reason: `${head} → ${tHead} (largest in section)`,
            };
          }
        }
        return;
      }

      // Rule 2b: Same cost head, different activity — highest priority after BG chain
      // e.g. "12 00L2 SEQP" should suggest merging into "12 00L1 SEQP" or "12 0000 SEQP"
      {
        const sameHeadFirst = Object.entries(finalLaborSummary ?? {}).filter(([k]) => {
          const p = k.trim().split(/\s+/);
          const kHours = finalLaborSummary[k]?.hours ?? 0;
          return p[0] === sec && p.slice(2).join(' ') === head && k !== entry.lines[0].code && (kHours + entry.combinedHours) >= minHoursThreshold;
        }).sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
        if (sameHeadFirst.length > 0) {
          suggestions[entry.key] = {
            targetHead: head,
            targetKey: sameHeadFirst[0][0],
            reason: `${head} → ${head} (same cost head, consolidated activity)`,
          };
        }
      }

      if (!suggestions[entry.key]) {
        const sourceSystems = new Set<string>();
        estimateData.forEach(item => {
          if (!item.costCode) return;
          const ip = (item.costCode || '').trim().split(/\s+/);
          if (ip[0] === sec && ip[ip.length - 1] === actualHead) sourceSystems.add((item.system || '').trim());
        });

        const systemTargetHeads = new Set<string>();
        sourceSystems.forEach(sys => {
          const sysMapping = systemMappings.find(m => (m.system || '').toLowerCase().trim() === sys.toLowerCase().trim());
          if (sysMapping?.laborCode && sysMapping.laborCode !== actualHead) systemTargetHeads.add(sysMapping.laborCode);
        });

        for (const targetHead of systemTargetHeads) {
          const found = findTargetKey(sec, [targetHead]);
          if (found) {
            const sysNames = [...sourceSystems].slice(0, 2).join(', ');
            suggestions[entry.key] = {
              targetHead: found.head,
              targetKey: found.key,
              reason: `System${sourceSystems.size > 1 ? 's' : ''} (${sysNames}) → ${found.head}`,
            };
            break;
          }
        }

        if (!suggestions[entry.key] && systemTargetHeads.size > 0) {
          const targetHead = [...systemTargetHeads][0];
          const sysNames = [...sourceSystems].slice(0, 2).join(', ');
          suggestions[entry.key] = {
            targetHead,
            targetKey: '',
            reason: `System${sourceSystems.size > 1 ? 's' : ''} (${sysNames}) → ${targetHead}`,
          };
        }
      }

      // Rule 3: Peer-merge fallback — suggest largest same-section code above threshold
      if (!suggestions[entry.key]) {
        const sameSec = Object.entries(finalLaborSummary)
          .filter(([k]) => {
            const p = k.trim().split(/\s+/);
            return p[0] === sec && p.slice(2).join(' ') !== head && (finalLaborSummary[k]?.hours ?? 0) >= minHoursThreshold;
          })
          .sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
        if (sameSec.length > 0) {
          const [targetFullKey, targetEntry] = sameSec[0];
          const tHead = targetFullKey.trim().split(/\s+/).slice(2).join(' ');
          suggestions[entry.key] = {
            targetHead: tHead,
            targetKey: targetFullKey,
            reason: `Largest in section → ${tHead} (${(targetEntry.hours ?? 0).toFixed(0)}h)`,
          };
        }
      }
    });

    // Pass 2: Cover in-export rows (from finalLaborSummary under threshold) not already in suggestions
    Object.entries(finalLaborSummary).forEach(([flKey, flEntry]) => {
      const hrs = flEntry.hours ?? 0;
      if (hrs <= 0.05 || hrs >= minHoursThreshold) return; // only under-threshold rows
      const flParts = flKey.trim().split(/\s+/);
      const pKey = `${flParts[0] ?? ''}|${flParts.slice(2).join(' ') || ''}`;
      if (suggestions[pKey]) return; // already have one

      const sec = flParts[0] ?? '';
      const head = flParts.slice(2).join(' ') || '';
      const actualHead = head.split(' ').pop() || head; // "PL BGAW" → "BGAW"

      // Rule A: BG-to-above-grade chain
      const chain = BG_TO_ABOVE_GRADE[actualHead];
      if (chain) {
        let candidates = [...chain];
        if (actualHead === 'BGPD') {
          const srcSys = new Set<string>();
          estimateData.forEach(item => {
            if (!item.costCode) return;
            const ip = (item.costCode || '').trim().split(/\s+/);
            if (ip[0] === sec && ip[ip.length - 1] === actualHead) srcSys.add((item.system || '').trim());
          });
          candidates = ['PMPD', getBgpdFallback(srcSys)];
        }
        const found = findTargetKey(sec, candidates);
        if (found) {
          suggestions[pKey] = {
            targetHead: found.head,
            targetKey: found.key,
            reason: `${head} → ${found.head}`,
          };
          return;
        }
      }

      // Rule B: Above-grade system codes → peer-merge into largest in section
      if (ABOVE_GRADE_SYSTEM_CODES.has(actualHead)) {
        // Rule 2b (Pass 2): same cost head, different activity — check first
        const sameHeadMatch2 = Object.entries(finalLaborSummary ?? {})
          .filter(([k]) => {
            const p = k.trim().split(/\s+/);
            const kHours = finalLaborSummary[k]?.hours ?? 0;
            return p[0] === sec &&
                   p.slice(2).join(' ') === head &&
                   k !== flKey &&
                   (kHours + hrs) >= minHoursThreshold;
          })
          .sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
        if (sameHeadMatch2.length > 0) {
          suggestions[pKey] = {
            targetHead: head,
            targetKey: sameHeadMatch2[0][0],
            reason: `${head} → ${head} (same cost head, consolidated activity)`,
          };
          return;
        }

        // No same-head match — fall through to peer-merge largest-in-section
        const sameSec2 = Object.entries(finalLaborSummary ?? {})
          .filter(([k]) => {
            const p = k.trim().split(/\s+/);
            const targetHead = p.slice(2).join(' ');
            return p[0] === sec && targetHead !== head && (finalLaborSummary[k]?.hours ?? 0) >= minHoursThreshold;
          })
          .sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
        if (sameSec2.length > 0) {
          const tHead2 = sameSec2[0][0].trim().split(/\s+/).slice(2).join(' ');
          if (ABOVE_GRADE_SYSTEM_CODES.has(tHead2.split(' ').pop() || tHead2)) {
            suggestions[pKey] = {
              targetHead: tHead2,
              targetKey: sameSec2[0][0],
              reason: `${head} → ${tHead2} (largest in section)`,
            };
          }
        }
        return;
      }

      // Rule 2b (Pass 2): Same cost head, different activity — combined threshold
      {
        const sameHeadFirst2 = Object.entries(finalLaborSummary ?? {}).filter(([k]) => {
          const p = k.trim().split(/\s+/);
          const kHours = finalLaborSummary[k]?.hours ?? 0;
          return p[0] === sec && p.slice(2).join(' ') === head && k !== flKey && (kHours + hrs) >= minHoursThreshold;
        }).sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
        if (sameHeadFirst2.length > 0) {
          suggestions[pKey] = {
            targetHead: head,
            targetKey: sameHeadFirst2[0][0],
            reason: `${head} → ${head} (same cost head, consolidated activity)`,
          };
        }
      }

      // Rule C: System inference from source items
      if (!suggestions[pKey]) {
        const srcSys2 = new Set<string>();
        estimateData.forEach(item => {
          if (!item.costCode) return;
          const ip = (item.costCode || '').trim().split(/\s+/);
          if (ip[0] === sec && ip[ip.length - 1] === actualHead) srcSys2.add((item.system || '').trim());
        });

        const sysHeads2 = new Set<string>();
        srcSys2.forEach(sys => {
          const sysMapping = systemMappings.find(m => (m.system || '').toLowerCase().trim() === sys.toLowerCase().trim());
          if (sysMapping?.laborCode && sysMapping.laborCode !== actualHead) sysHeads2.add(sysMapping.laborCode);
        });

        for (const targetHead of sysHeads2) {
          const found = findTargetKey(sec, [targetHead]);
          if (found) {
            const sysNames = [...srcSys2].slice(0, 2).join(', ');
            suggestions[pKey] = {
              targetHead: found.head,
              targetKey: found.key,
              reason: `System${srcSys2.size > 1 ? 's' : ''} (${sysNames}) → ${found.head}`,
            };
            break;
          }
        }

        if (!suggestions[pKey] && sysHeads2.size > 0) {
          const targetHead = [...sysHeads2][0];
          const sysNames = [...srcSys2].slice(0, 2).join(', ');
          suggestions[pKey] = {
            targetHead,
            targetKey: '',
            reason: `System${srcSys2.size > 1 ? 's' : ''} (${sysNames}) → ${targetHead}`,
          };
        }
      }

      // Rule D: Peer-merge fallback — largest same-section code above threshold
      if (!suggestions[pKey]) {
        const sameSec = Object.entries(finalLaborSummary)
          .filter(([k]) => {
            const p = k.trim().split(/\s+/);
            return p[0] === sec && p.slice(2).join(' ') !== head && (finalLaborSummary[k]?.hours ?? 0) >= minHoursThreshold;
          })
          .sort((a, b) => (b[1].hours ?? 0) - (a[1].hours ?? 0));
        if (sameSec.length > 0) {
          const [targetFullKey, targetEntry] = sameSec[0];
          const tHead = targetFullKey.trim().split(/\s+/).slice(2).join(' ');
          suggestions[pKey] = {
            targetHead: tHead,
            targetKey: targetFullKey,
            reason: `Largest in section → ${tHead} (${(targetEntry.hours ?? 0).toFixed(0)}h)`,
          };
        }
      }
    });

    return suggestions;
  }, [smallCodeAnalysis, finalLaborSummary, estimateData, systemMappings, minHoursThreshold]);

  // Auto-default action helper
  const getDefaultAction = (lines: Array<{ code: string; hours: number; isSmall: boolean }>) => {
    const MIN_HOURS = minHoursThreshold;

    if (lines.length === 1) {
      return { action: '__reassign__' as const, targets: undefined, reason: 'Auto: standalone code — reassign to another cost head' };
    }

    // Filter out zero-hour ghost lines — they inflate the deficit without real hours
    // e.g. 00CS fallback entries that exist in the pipeline but carry 0h
    const liveLines = lines.filter(l => l.hours > 0);
    if (liveLines.length <= 1) {
      return { action: '__merge__' as const, targets: undefined, reason: 'Auto: only one live activity — merge' };
    }

    const underMin = liveLines.filter(l => l.hours < MIN_HOURS);
    const donors = liveLines.filter(l => l.hours > MIN_HOURS);
    const deficit = underMin.reduce((sum, l) => sum + (MIN_HOURS - l.hours), 0);
    const totalExcess = donors.reduce((sum, l) => sum + (l.hours - MIN_HOURS), 0);

    if (donors.length > 0 && totalExcess >= deficit) {
      const targets: Record<string, number> = {};
      const toActKey = (code: string) => { const p = (code ?? '').trim().split(/\s+/); return p.length >= 3 ? p[1] : code; };
      liveLines.forEach(l => { targets[toActKey(l.code)] = l.hours; });
      underMin.forEach(l => { targets[toActKey(l.code)] = MIN_HOURS; });
      donors.forEach(l => {
        const contribution = deficit * ((l.hours - MIN_HOURS) / totalExcess);
        targets[toActKey(l.code)] = l.hours - contribution;
      });
      return { action: '__redistribute__' as const, targets, reason: 'Auto: enough excess to fund 8h minimum' };
    }

    return { action: '__merge__' as const, targets: undefined, reason: 'Auto: not enough excess for 8h minimum' };
  };

  // Auto-initialize a single row
  const autoInitRow = (key: string) => {
    const row = smallCodeAnalysis.find(r => r.key === key);
    if (!row) {
      // Handle in-export rows not in smallCodeAnalysis
      if (standaloneAutoSuggestions?.[key]?.targetHead) {
        setReassignTargets(prev => ({ ...prev, [key]: standaloneAutoSuggestions[key].targetHead }));
      }
      return;
    }
    const result = getDefaultAction(row.lines);
    // For standalone rows, prefer auto-suggestion over placeholder
    if (result.action === '__reassign__' && standaloneAutoSuggestions?.[key]?.targetHead) {
      setReassignTargets(prev => ({ ...prev, [key]: standaloneAutoSuggestions[key].targetHead }));
      return;
    }
    setReassignTargets(prev => ({ ...prev, [key]: result.action }));
    if (result.action === '__redistribute__' && result.targets) {
      setRedistributeAdjustments(prev => ({ ...prev, [key]: result.targets! }));
    }
  };

  // Already-saved sec|head keys for display
  const savedMergeKeySet = useMemo(() => new Set(savedMergesData?.map(m => `${m.sec_code}|${m.cost_head}`) ?? []), [savedMergesData]);

  // Reconstruct display rows for saved entries consumed by finalLaborSummary
  const savedOnlyRows = useMemo(() => {
    if (!savedMergesData || savedMergesData.length === 0) return [];
    const analysisKeys = new Set(smallCodeAnalysis.map((r) => r.key));
    const rows: typeof smallCodeAnalysis = [];

    savedMergesData.forEach((m) => {
      const key = `${m.sec_code}|${m.cost_head}`;
      if (analysisKeys.has(key)) return; // already visible

      // Read hours from finalLaborSummary (post-pipeline) so UI matches export
      const flsLines = Object.entries(finalLaborSummary ?? {}).filter(([k]) => {
        const parts = k.trim().split(/\s+/);
        const sec = parts[0] ?? '';
        const head = parts.slice(2).join(' ') || '';
        return sec === m.sec_code && head === m.cost_head;
      });

      const combinedHours = flsLines.reduce((s, [, entry]) => s + (entry.hours ?? 0), 0);

      // Also recover pre-merge lines for line detail display
      const premerge = calculations?.adjustedLaborSummary ?? {};
      const premergeLines = Object.values(premerge).filter((entry) => {
        const parts = (entry.code ?? '').trim().split(/\s+/);
        const sec = parts[0] ?? '';
        const head = parts.slice(2).join(' ') || '';
        return sec === m.sec_code && head === m.cost_head;
      });

      rows.push({
        key,
        sec: m.sec_code,
        head: m.cost_head,
        combinedHours,
        combinedRawHours: combinedHours,
        lines: premergeLines.length > 0
          ? premergeLines.map((l) => {
              const parts = (l.code ?? '').trim().split(/\s+/);
              return {
                code: l.code,
                hours: l.hours ?? 0,
                description: l.description ?? '',
                sec: parts[0] ?? '',
                act: parts[1] ?? '',
                head: parts.slice(2).join(' ') || '',
                isSmall: (l.hours ?? 0) < minHoursThreshold,
                dollars: l.dollars ?? 0,
                rate: l.rate ?? 0,
                type: l.type ?? 'field',
              };
            })
          : [{
              code: `${m.sec_code} ${m.merged_act || '0000'} ${m.cost_head}`,
              hours: combinedHours,
              description: '',
              sec: m.sec_code,
              act: m.merged_act || '0000',
              head: m.cost_head,
              isSmall: combinedHours < minHoursThreshold,
              dollars: 0,
              rate: 0,
              type: 'field' as const,
            }],
        
      });
    });

    return rows;
  }, [savedMergesData, smallCodeAnalysis, calculations?.adjustedLaborSummary, finalLaborSummary, minHoursThreshold]);

  // DISABLED: auto-update was too aggressive and caused duplicate key errors + data loss
  // Stale merges are now surfaced as a warning banner for the user to handle manually
  // useEffect(() => { ... }, [staleMergeUpdates.length]);

  const exportReconciliationLog = useMemo(() => {
    if (!finalLaborSummary || !calculations.adjustedLaborSummary) return null;

    // Build chain map same way finalLaborSummary does
    const directMap = new Map<string, string>();
    (savedMergesData ?? []).forEach(m => {
      const rt = (m as any).reassign_to_head as string | null;
      if (rt && rt !== '__keep__' && !rt.startsWith('__')) {
        directMap.set(`${m.sec_code}|${m.cost_head}`, rt);
      }
    });
    const resolveChain = (sec: string, head: string, visited = new Set<string>()): string => {
      const key = `${sec}|${head}`;
      if (visited.has(key) || visited.size > 10) return head;
      visited.add(key);
      const next = directMap.get(key);
      if (!next) return head;
      return resolveChain(sec, next, visited);
    };

    const preTotal = Object.values(calculations.adjustedLaborSummary)
      .reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
    const postTotal = Object.values(finalLaborSummary)
      .reduce((s: number, e: any) => s + (e.hours ?? 0), 0);
    const drift = postTotal - preTotal;

    const mergeLog = (savedMergesData ?? []).map(m => {
      const sec = m.sec_code ?? '';
      const head = m.cost_head ?? '';
      const reassignTo = (m as any).reassign_to_head as string | null;
      const redistAdj = (m as any).redistribute_adjustments;
      const action = redistAdj && Object.keys(redistAdj as object).length > 0
        ? 'redistribute'
        : reassignTo === '__keep__' ? 'keep'
        : reassignTo && !reassignTo.startsWith('__') ? 'reassign'
        : 'merge';

      // Resolve chain to terminal for reassigns
      const terminalHead = (action === 'reassign' && reassignTo)
        ? resolveChain(sec, reassignTo)
        : head;

      const targetEntry = Object.entries(finalLaborSummary).find(([k]) => {
        const p = k.trim().split(/\s+/);
        return p[0] === sec && p.slice(2).join(' ') === terminalHead;
      });

      const sourceStillExists = Object.entries(finalLaborSummary).some(([k]) => {
        const p = k.trim().split(/\s+/);
        return p[0] === sec && p.slice(2).join(' ') === head;
      });

      const sourceEliminated = action === 'reassign' ? !sourceStillExists : null;

      return {
        rule: `${sec}|${head} → ${action === 'reassign' ? terminalHead + (terminalHead !== reassignTo ? ' (chained)' : '') : '0000 ' + action}`,
        targetHours: targetEntry ? Math.round(targetEntry[1].hours ?? 0) : 0,
        sourceEliminated,
        action,
      };
    });

    // Find codes that exist in post but NOT in pre (created by pipeline)
    const preKeys = new Set(Object.keys(calculations.adjustedLaborSummary));
    const newKeys = Object.keys(finalLaborSummary).filter(k => !preKeys.has(k));
    const newKeyHours = newKeys.reduce((s, k) => s + (finalLaborSummary[k]?.hours ?? 0), 0);

    return { preTotal, postTotal, drift, driftOk: Math.abs(drift) < 0.5, mergeLog, newKeys, newKeyHours };
  }, [finalLaborSummary, calculations.adjustedLaborSummary, savedMergesData]);


  // Filtered view for standalone hour threshold
  const filteredSmallCodeAnalysis = useMemo(() => {
    return smallCodeAnalysis.filter(row => {
      if (row.lines.length > 1) return true;
      return savedMergeKeySet.has(row.key) || (row.combinedRawHours ?? row.combinedHours) < standaloneMaxHours;
    });
  }, [smallCodeAnalysis, standaloneMaxHours, savedMergeKeySet]);

  const mergeGroups = filteredSmallCodeAnalysis.filter(g => g.lines.length > 1).sort((a, b) => {
    const aSaved = savedMergeKeySet.has(a.key);
    const bSaved = savedMergeKeySet.has(b.key);
    if (aSaved && !bSaved) return 1;
    if (!aSaved && bSaved) return -1;
    return 0;
  });
  const standaloneGroups = filteredSmallCodeAnalysis.filter(g => g.lines.length === 1);

  // Shared Pass1/Accepted key sets for badge + residual filter
  const { allPass1Keys, acceptedKeys } = useMemo(() => {
    const allPass1Keys = new Set([
      // Original standalone rows
      ...(standaloneGroups ?? []).map(g => g.key ?? ''),
      // Saved-only rows
      ...(savedOnlyRows ?? []).map(r => r.key ?? ''),
      // Merge group source codes
      ...(mergeGroups ?? []).map(g => g.key ?? ''),
      // Saved merge/reassign source keys — only exclude if result is above threshold
      ...(savedMergesData ?? [])
        .filter(m => {
          const sec = m.sec_code ?? '';
          const head = m.cost_head ?? '';
          const resultKey = Object.keys(finalLaborSummary ?? {}).find(k => {
            const parts = k.trim().split(/\s+/);
            return parts[0] === sec && parts.slice(2).join(' ') === head;
          });
          return resultKey
            ? (finalLaborSummary[resultKey]?.hours ?? 0) >= minHoursThreshold
            : true;
        })
        .map(m => `${m.sec_code ?? ''}|${m.cost_head ?? ''}`),
      // Reassignment TARGET keys — only exclude if target result is above threshold
      ...(savedMergesData ?? [])
        .filter(m => {
          if (!m.reassign_to_head || m.reassign_to_head === '__keep__') return false;
          const resultEntry = Object.entries(finalLaborSummary ?? {}).find(([k]) => {
            const parts = k.trim().split(/\s+/);
            return parts[0] === m.sec_code && parts.slice(2).join(' ') === m.reassign_to_head;
          });
          return resultEntry && (resultEntry[1]?.hours ?? 0) >= minHoursThreshold;
        })
        .map(m => `${m.sec_code ?? ''}|${m.reassign_to_head ?? ''}`),
    ]);
    const acceptedKeys = new Set<string>();
    return { allPass1Keys, acceptedKeys };
  }, [standaloneGroups, savedOnlyRows, mergeGroups, savedMergesData, finalLaborSummary, minHoursThreshold]);

  // Round 2 residual rows — codes under threshold NOT in Pass 1 and NOT accepted
  const residualRows = useMemo(() => {
    return Object.entries(finalLaborSummary ?? {})
      .filter(([key, entry]) => {
        if ((entry.hours ?? 0) >= minHoursThreshold || (entry.hours ?? 0) < 0.05) return false;
        const parts = key.trim().split(/\s+/);
        const sec = parts[0] ?? '';
        const head = parts.slice(2).join(' ') || '';
        const pKey = `${sec}|${head}`;
        return !allPass1Keys.has(pKey) && !acceptedKeys.has(pKey);
      })
      .map(([key, entry]) => {
        const parts = key.trim().split(/\s+/);
        return {
          key: `${parts[0]}|${parts.slice(2).join(' ')}`,
          displayKey: key,
          sec: parts[0] ?? '',
          act: parts[1] ?? '0000',
          head: parts.slice(2).join(' ') || '',
          combinedHours: entry.hours ?? 0,
          lines: [{ code: key, hours: entry.hours ?? 0 }] as { code: string; hours: number }[],
          isResidual: true,
        };
      });
  }, [finalLaborSummary, minHoursThreshold, allPass1Keys, acceptedKeys]);

  const totalSmallInExport = useMemo(() =>
    Object.values(finalLaborSummary ?? {})
      .filter(e => (e.hours ?? 0) > 0.05 && (e.hours ?? 0) < minHoursThreshold)
      .length,
    [finalLaborSummary, minHoursThreshold]
  );

  const inExportRows = useMemo(() => {
    return Object.entries(finalLaborSummary ?? {})
      .filter(([, e]) => (e.hours ?? 0) > 0.05 && (e.hours ?? 0) < minHoursThreshold)
      .map(([key, entry]) => {
        const parts = key.trim().split(/\s+/);
        const pKey = `${parts[0] ?? ''}|${parts.slice(2).join(' ') || ''}`;
        return {
          key: pKey,
          displayKey: key,
          sec: parts[0] ?? '',
          act: parts[1] ?? '0000',
          head: parts.slice(2).join(' ') || '',
          combinedHours: entry.hours ?? 0,
          isStale: false,
          status: acceptedKeys.has(pKey) ? 'accepted' as const
            : savedMergeKeySet.has(pKey) ? 'saved' as const
            : 'open' as const,
        };
      })
      .sort((a, b) => {
        if (a.isStale && !b.isStale) return -1;
        if (!a.isStale && b.isStale) return 1;
        return a.combinedHours - b.combinedHours;
      });
  }, [finalLaborSummary, minHoursThreshold, acceptedKeys, savedMergeKeySet]);


  const handleConsolidate = async () => {
    if (!projectId || projectId === 'default') {
      toast({
        title: 'No project selected',
        description: 'Select a project before saving merge actions.',
        variant: 'destructive',
      });
      return;
    }

    const newEntries = Object.entries(consolidations)
      .filter(([, v]) => v)
      .map(([key]) => {
        const [sec, ...headParts] = key.split('|');
        const head = headParts.join('|');
        const target = reassignTargets[key];
        if (target === '__redistribute__') {
          const rowTargets = redistributeAdjustments[key] ?? {};
          const row = smallCodeAnalysis.find(r => r.key === key);
          if (!row) return null;
          const { deltas: rawDeltas, netRounded, isBalanced: redistBalanced } =
            buildRoundedDeltas(row.lines, rowTargets);
          let finalDeltas = rawDeltas;
          if (!redistBalanced) {
            finalDeltas = fixResidual(rawDeltas, netRounded);
            const recheckNet = Object.values(finalDeltas).reduce((s, v) => s + v, 0);
            if (Math.abs(recheckNet) > 0.01) {
              if (import.meta.env.DEV) console.warn(`[redistribute] skipping ${sec}|${head}: net=${netRounded} after fix=${recheckNet}`);
              return { __invalid: true, sec, head, reason: `unbalanced (net ${netRounded.toFixed(3)}h)` } as any;
            }
          }
          if (Object.keys(finalDeltas).length === 0) {
            return { __invalid: true, sec, head, reason: 'no effective delta' } as any;
          }
          return { sec_code: sec!, cost_head: head, reassign_to_head: null, redistribute_adjustments: finalDeltas };
        }
        // __keep__ passes through as reassign_to_head = '__keep__'
        const reassignTo = target && target !== '__merge__' && target !== '__reassign__' ? target : null;
        // Block any entry with no actionable decision:
        // must have an explicit target (reassign/keep) OR be a redistribute action
        if (!reassignTo && target !== '__redistribute__' && target !== '__merge__') return null;
        return { sec_code: sec!, cost_head: head, reassign_to_head: reassignTo, redistribute_adjustments: null as Record<string, number> | null };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    // Separate invalid entries from valid ones
    const invalidRows = newEntries.filter((e: any) => e.__invalid);
    const validEntries = newEntries.filter((e: any) => !e.__invalid);

    if (validEntries.length === 0 && (savedMergesData ?? []).length === 0 && invalidRows.length === 0) {
      if (import.meta.env.DEV) console.log('[handleConsolidate] Early return: no entries to save');
      return;
    }
    const existingEntries = (savedMergesData ?? []).map(m => ({
      sec_code: m.sec_code,
      cost_head: m.cost_head,
      reassign_to_head: (m as any).reassign_to_head as string | null ?? null,
      redistribute_adjustments: (m as any).redistribute_adjustments as Record<string, number> | null ?? null,
    }));
    const allMap = new Map<string, { sec_code: string; cost_head: string; reassign_to_head?: string | null; redistribute_adjustments?: Record<string, number> | null }>();
    [...existingEntries, ...validEntries].forEach(e => allMap.set(`${e.sec_code}|${e.cost_head}`, e));

    if (import.meta.env.DEV) console.log('[handleConsolidate] validEntries:', validEntries.length, 'invalidRows:', invalidRows.length);

    const allRows = [...allMap.values()];
    const seen = new Set<string>();
    const dedupedRows = allRows.filter(row => {
      const key = `${row.sec_code}__${row.cost_head}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (import.meta.env.DEV) console.log('[handleConsolidate] Final rows to save:', dedupedRows.length);
    const skippedCount = Object.keys(consolidations).filter(key => {
      const t = reassignTargets[key];
      // Only count as skipped: user explicitly chose reassign but didn't pick a target
      return consolidations[key] && t === '__reassign__';
    }).length;

    if (skippedCount > 0) {
      toast({
        title: `${skippedCount} ${skippedCount === 1 ? 'entry' : 'entries'} skipped`,
        description: 'Select a reassign target or uncheck before saving.',
        variant: 'destructive',
      });
    }

    const progressToastId = toast({
      title: `Saving ${dedupedRows.length} action${dedupedRows.length !== 1 ? 's' : ''}…`,
      description: 'Please wait.',
    });

    try {
      await saveMergeMutation.mutateAsync(dedupedRows);

      // Wait for refetch to complete BEFORE clearing local state
      await queryClient.invalidateQueries({ queryKey: ['small-code-merges', projectId] });

      // NOW clear local state — savedMergesData is already refreshed in cache
      setConsolidations({});
      setReassignTargets({});
      setRedistributeAdjustments({});
      setManuallyOverridden(new Set());

      // Dismiss progress, show result
      toast({
        title: `Saved ${dedupedRows.length} action${dedupedRows.length !== 1 ? 's' : ''}`,
        description: skippedCount > 0
          ? `${skippedCount} skipped — select a target or uncheck before saving.`
          : 'All actions saved successfully.',
      });

      if (invalidRows.length > 0) {
        const names = invalidRows.map((r: any) => `${r.sec} ${r.head} (${r.reason})`).join(', ');
        toast({
          title: `${invalidRows.length} row(s) skipped`,
          description: `Skipped: ${names}. Fix balance and re-apply.`,
          variant: 'destructive',
        });
      }

      // Background: warn about remaining small codes (non-blocking)
      const SMALL_THRESHOLD = minHoursThreshold;
      const savedKeys = new Set(
        (queryClient.getQueryData<typeof savedMergesData>(['small-code-merges', projectId]) ?? [])
          .map(m => `${m.sec_code}|${m.cost_head}`)
      );
      const remainingSmall = Object.entries(finalLaborSummary ?? {}).filter(
        ([key, entry]) => {
          const head = key.trim().split(/\s+/).pop() ?? '';
          return (entry.hours ?? 0) < minHoursThreshold &&
                 (entry.hours ?? 0) >= 0.05 &&
                 !savedKeys.has(key.trim().split(/\s+/)[0] + '|' + head);
        }
      ).length;

      if (remainingSmall > 0) {
        setTimeout(() => {
          toast({
            title: `${remainingSmall} small codes still unassigned`,
            description: `Review Standalone Codes tab for remaining codes under ${minHoursThreshold}h.`,
            variant: 'default',
          });
        }, 1500);
      }

    } catch (err) {
      console.error('[Save] Failed:', err);
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Unknown error. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getSavedAction = (merge: { redistribute_adjustments?: unknown; reassign_to_head?: string | null }) => {
    if (
      merge.redistribute_adjustments &&
      typeof merge.redistribute_adjustments === 'object' &&
      Object.keys(merge.redistribute_adjustments as object).length > 0
    ) return '__redistribute__';
    if (merge.reassign_to_head === '__keep__') return '__keep__';
    if (merge.reassign_to_head && merge.reassign_to_head !== '__keep__') return merge.reassign_to_head;
    return '__merge__';
  };

  /** Build CodeHistoryDetail props for a given sec|head entry */
  const buildCodeHistoryProps = (sec: string, head: string, combinedHours: number) => {
    const savedMerge = savedMergesData?.find(
      m => (m.sec_code || '').trim() === (sec || '').trim() &&
           (m.cost_head || '').trim() === (head || '').trim()
    );
    if (!savedMerge) return null;

    const action = getSavedAction(savedMerge);
    const actionType: 'merge' | 'reassign' | 'redistribute' | 'keep' | 'accepted' | null =
      action === '__redistribute__' ? 'redistribute'
      : action === '__keep__' ? 'keep'
      : action === '__merge__' ? 'merge'
      : action === 'keep' ? 'keep'
      : action === 'accepted' ? 'accepted'
      : 'reassign';

    const premerge = calculations?.adjustedLaborSummary ?? {};
    const sourceLines = Object.values(premerge)
      .filter((entry) => {
        const parts = (entry.code ?? '').trim().split(/\s+/);
        const s = parts[0] ?? '';
        const h = parts.slice(2).join(' ') || '';
        return s === sec && h === head;
      })
      .map((entry: any) => ({
        code: entry.code ?? '',
        hours: entry.hours ?? 0,
        act: (entry.code ?? '').trim().split(/\s+/)[1] ?? '0000',
      }));

    const redistDeltas = savedMerge.redistribute_adjustments &&
      typeof savedMerge.redistribute_adjustments === 'object'
      ? savedMerge.redistribute_adjustments as Record<string, number>
      : null;

    const targetHead = actionType === 'reassign' ? action : head;
    const targetEntries = Object.entries(finalLaborSummary ?? {})
      .filter(([k]) => {
        const parts = k.trim().split(/\s+/);
        return parts[0] === sec && parts.slice(2).join(' ') === targetHead;
      })
      .map(([code, entry]) => ({ code, hours: entry.hours ?? 0 }));

    return {
      sec, head, sourceLines, actionType, redistDeltas, targetEntries, combinedHours,
      reassignTarget: actionType === 'reassign' ? action : null,
    };
  };

  const handleUndoMerge = async (sec: string, head: string) => {
    const targetSec = (sec || '').trim();
    const targetHead = (head || '').trim();
    const key = `${targetSec}|${targetHead}`;

    if (!projectId || projectId === 'default') {
      toast({
        title: 'No project selected',
        description: 'Select a project before undoing merges.',
        variant: 'destructive',
      });
      return;
    }

    if (import.meta.env.DEV) console.log('[Undo] Direct delete:', { projectId, targetSec, targetHead });
    setUndoingKey(key);

    try {
      const { error } = await supabase
        .from('project_small_code_merges')
        .delete()
        .eq('project_id', projectId)
        .eq('sec_code', targetSec)
        .eq('cost_head', targetHead)
        // Fix C: legacy undo must not touch Code Cleanup rows for the same
        // (sec, head). Code Cleanup ownership is exclusive to its own writer.
        .is('operation_type', null);

      if (error) {
        console.error('[Undo] Delete failed:', error);
        toast({
          title: 'Undo failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        queryClient.invalidateQueries({ queryKey: ['small-code-merges', projectId] });
        toast({
          title: 'Merge undone',
          description: `${targetSec} ${targetHead} restored.`,
        });
      }
    } finally {
      setUndoingKey(null);
    }
  };

  useEffect(() => {
    if (import.meta.env.DEV && exportReconciliationLog) {
      console.group('[EXPORT RECONCILIATION]');
      console.log('Pre-merge total hours:', exportReconciliationLog.preTotal.toFixed(2));
      console.log('Post-merge total hours:', exportReconciliationLog.postTotal.toFixed(2));
      console.log('Hour drift:', exportReconciliationLog.drift.toFixed(3), exportReconciliationLog.driftOk ? '✓ OK' : '⚠ DRIFT DETECTED');
      if (!exportReconciliationLog.driftOk) {
        console.warn('[DRIFT] New keys created by pipeline (not in pre-merge):', exportReconciliationLog.newKeys);
        console.warn('[DRIFT] Hours in new keys:', exportReconciliationLog.newKeyHours.toFixed(2));
        const reassignRows = exportReconciliationLog.mergeLog.filter(r => r.action === 'reassign' && r.sourceEliminated === false);
        console.warn('[DRIFT] Reassign rules where source was NOT eliminated:', reassignRows);
      }
      console.table(exportReconciliationLog.mergeLog);
      console.groupEnd();
    }
  }, [exportReconciliationLog]);

  // Single source of truth for the BudgetAdjustments object: built once, consumed
  // by both onAdjustmentsChange (export pipeline) and the bid reconciliation readout.
  // Guarantees the readout shows exactly what the export receives.
  const currentAdjustments = useMemo<BudgetAdjustments>(() => {
    const summary = finalLaborSummary ?? calculations.adjustedLaborSummary;
    return {
      jobsiteZipCode,
      taxRate: taxInfo.rate,
      taxJurisdiction: taxInfo.jurisdiction,
      foremanBonusEnabled,
      foremanBonusPercent,
      foremanBonusHours: calculations.foremanBonusHours,
      foremanBonusDollars: calculations.foremanBonusDollars,
      fabricationConfigs,
      fabricationSummary: calculations.fabricationSummary,
      materialTaxOverrides,
      materialTaxSummary: calculations.materialTaxSummary,
      totalMaterialTax: calculations.totalMaterialTax,
      // NOTE: adjustedLaborSummary actually contains finalLaborSummary data when merges are active.
      // The field is not renamed to avoid breaking downstream references, but consumers should be
      // aware this reflects post-merge (final) values, not just pre-merge adjusted values.
      adjustedLaborSummary: summary,
      totalFieldHours: calculations.totalFieldHours,
      totalFabHours: calculations.totalFabHours,
      totalLaborDollars: Object.values(summary).reduce((s, i) => s + (i.dollars ?? 0), 0),
      totalMaterialWithTax: calculations.totalMaterialWithTax,
      totalMaterialPreTax: calculations.totalMaterialPreTax,
      laborRateContingencyEnabled: lrcnEnabled,
      bidRates,
      budgetRate,
      bidTotal: lrcnCalculations.bidTotal,
      budgetTotal: lrcnCalculations.budgetTotal,
      lrcnAmount: lrcnCalculations.lrcnAmount,
      fabRates: Object.fromEntries(Object.entries(fabRates).map(([k, v]) => [k, { bidRate: parseFloat(v.bidRate) || shopRate, budgetRate: parseFloat(v.budgetRate) || shopRate }])),
      fabLrcnAmount: fabLrcnCalculations.fabLrcnAmount,
      fabLrcnEnabled,
      computedBidLaborRate,
      shopRate,
      savedMerges: savedMergesData?.map(m => ({
        sec_code: m.sec_code,
        cost_head: m.cost_head,
        reassign_to_head: m.reassign_to_head,
        redistribute_adjustments: m.redistribute_adjustments as Record<string, number> | null,
        merged_act: m.merged_act,
      })) ?? [],
      // Pass-through field: required by BudgetAdjustments interface, populated from
      // the prop. Index.tsx is the source of truth and does NOT read this back from
      // budgetAdjustments — it reads its own local state. This field exists only for
      // type compatibility and downstream consumers (export pipeline, etc.) that
      // receive BudgetAdjustments and may inspect thresholds for reference.
      consolidationThresholds,
    };
  }, [calculations, lrcnCalculations, fabLrcnCalculations, jobsiteZipCode, taxInfo, foremanBonusEnabled, foremanBonusPercent, fabricationConfigs, materialTaxOverrides, lrcnEnabled, bidRates, budgetRate, computedBidLaborRate, shopRate, fabRates, fabLrcnEnabled, finalLaborSummary, savedMergesData, consolidationThresholds]);

  useEffect(() => {
    onAdjustmentsChange(currentAdjustments);
  }, [currentAdjustments, onAdjustmentsChange]);

  // Bid Reconciliation readout — uses the same helpers as the export pipeline,
  // guaranteeing the displayed values exactly match what gets written to the .xlsx.
  const bidReconciliation = useMemo(() => {
    // Split budget labor into field vs fab for breakdown clarity.
    // Source: finalLaborSummary entries carry `type: 'field' | 'fab'` set in calculations memo.
    let budgetField = 0;
    let budgetFab = 0;
    Object.values(finalLaborSummary ?? {}).forEach((i: any) => {
      const dollars = i?.dollars || 0;
      if (i?.type === 'fab') budgetFab += dollars;
      else budgetField += dollars;
    });
    const budgetLabor = budgetField + budgetFab;
    const fcnt = calculations.foremanBonusDollars || 0;
    const lrcn = lrcnEnabled ? (lrcnCalculations.lrcnAmount || 0) : 0;
    // Match export gate exactly: fabLrcnEnabled && fabLrcnAmount > 0.
    // Clamp negative (possible when budget fab rate > bid fab rate) to prevent
    // drift between readout and export.
    const fabLrcn = fabLrcnEnabled ? Math.max(0, fabLrcnCalculations.fabLrcnAmount || 0) : 0;
    const gcFabCont = computeGcFabCont(currentAdjustments);
    const gcFldCont = computeGcFldCont(currentAdjustments);
    const contingencies = fcnt + lrcn + fabLrcn + gcFabCont + gcFldCont;
    const exportTotal = budgetLabor + contingencies;
    const bidTotal = lrcnCalculations.bidTotal || 0;
    const delta = exportTotal - bidTotal;
    const hasFieldBid =
      (Number(bidRates.straightTime.hours) || 0) +
      (Number(bidRates.shiftTime.hours) || 0) +
      (Number(bidRates.overtime.hours) || 0) +
      (Number(bidRates.doubleTime.hours) || 0) > 0;

    // Dev-only invariant: breakdown line items must sum to exportTotal.
    // Catches drift if a new contingency is added to the export but not the readout.
    if (import.meta.env.DEV) {
      const lineSum = budgetField + budgetFab + fcnt + lrcn + fabLrcn + gcFabCont + gcFldCont;
      if (Math.abs(lineSum - exportTotal) > 1) {
        // eslint-disable-next-line no-console
        console.warn('[BidReconciliation] Breakdown drift', { lineSum, exportTotal, diff: lineSum - exportTotal });
      }
    }

    return { budgetField, budgetFab, budgetLabor, fcnt, lrcn, fabLrcn, gcFabCont, gcFldCont, contingencies, exportTotal, bidTotal, delta, hasFieldBid };
  }, [currentAdjustments, finalLaborSummary, calculations.foremanBonusDollars, lrcnCalculations, fabLrcnCalculations, lrcnEnabled, fabLrcnEnabled, bidRates]);


  const toggleFabForCode = (code: string, enabled: boolean) => {
    setFabricationConfigs(prev => ({
      ...prev,
      [code]: { enabled, percentage: prev[code]?.percentage || 15 }
    }));

    // Auto-suggest fab routing when enabling — only if not already set by user
    if (enabled && !fabCodeMap[code]) {
      const suggestion = getDominantFabCode(code, estimateData);
      if (suggestion) {
        setFabCodeMap(prev => ({ ...prev, [code]: suggestion.fabCode }));
        toast({
          title: `Fab routing auto-suggested: ${code} → ${suggestion.fabCode}`,
          description: `Based on dominant material spec "${suggestion.specName}" (${Math.round(suggestion.confidence * 100)}% of hours). Override in Fab Material Routing if needed.`,
        });
      }
    }

    // Clear routing when disabling so it doesn't persist stale suggestions
    if (!enabled) {
      setFabCodeMap(prev => {
        const next = { ...prev };
        delete next[code];
        return next;
      });
    }
  };

  const setFabPercentForCode = (code: string, percentage: number) => {
    setFabricationConfigs(prev => ({
      ...prev,
      [code]: { enabled: prev[code]?.enabled || false, percentage }
    }));
  };

  const formatUSD = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const absDelta = Math.abs(bidReconciliation.delta);
  const deltaColor =
    absDelta < 5_000 ? 'text-green-600'
    : absDelta < 25_000 ? 'text-amber-600'
    : 'text-red-600';
  const showReconciliation = lrcnEnabled && bidReconciliation.hasFieldBid;

  return (
    <div className="space-y-6">
      {/* Bid Reconciliation Readout */}
      {showReconciliation && (
        <Card className="border-2 border-primary/40">
          <Collapsible defaultOpen>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Scale className="h-5 w-5 text-primary" />
                  Bid Reconciliation
                </CardTitle>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1">
                    <ChevronDown className="h-4 w-4 transition-transform data-[state=closed]:-rotate-90" />
                    Breakdown
                  </Button>
                </CollapsibleTrigger>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Bid Total</div>
                  <div className="text-xl font-semibold tabular-nums">{formatUSD(bidReconciliation.bidTotal)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Export Total</div>
                  <div className="text-xl font-semibold tabular-nums">{formatUSD(bidReconciliation.exportTotal)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide">Delta</div>
                  <div className={`text-xl font-semibold tabular-nums ${deltaColor}`}>
                    {bidReconciliation.delta >= 0 ? '+' : ''}{formatUSD(bidReconciliation.delta)}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Separator className="mb-3" />
                <div className="space-y-1.5 text-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budget Labor</div>
                  <div className="flex justify-between pl-3"><span className="text-muted-foreground">Field (AutoBid produced)</span><span className="tabular-nums">{formatUSD(bidReconciliation.budgetField)}</span></div>
                  <div className="flex justify-between pl-3"><span className="text-muted-foreground">Fab (AutoBid produced)</span><span className="tabular-nums">{formatUSD(bidReconciliation.budgetFab)}</span></div>
                  <div className="flex justify-between pl-3 text-muted-foreground border-t pt-1"><span>Subtotal budget labor</span><span className="tabular-nums">{formatUSD(bidReconciliation.budgetLabor)}</span></div>

                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-3">Contingencies</div>
                  <div className="flex justify-between pl-3"><span className="text-muted-foreground">FCNT (foreman bonus, bid blended rate)</span><span className="tabular-nums">{formatUSD(bidReconciliation.fcnt)}</span></div>
                  <div className="flex justify-between pl-3"><span className="text-muted-foreground">LRCN (field rate arbitrage)</span><span className="tabular-nums">{formatUSD(bidReconciliation.lrcn)}</span></div>
                  <div className="flex justify-between pl-3"><span className="text-muted-foreground">Fab LRCN (shop rate arbitrage)</span><span className="tabular-nums">{formatUSD(bidReconciliation.fabLrcn)}</span></div>
                  <div className="flex justify-between pl-3"><span className="text-muted-foreground">GC 0FAB CONT (unbudgeted shop volume)</span><span className="tabular-nums">{formatUSD(bidReconciliation.gcFabCont)}</span></div>
                  <div className="flex justify-between pl-3"><span className="text-muted-foreground">GC 0FLD CONT (unbudgeted field volume)</span><span className="tabular-nums">{formatUSD(bidReconciliation.gcFldCont)}</span></div>
                  <div className="flex justify-between pl-3 text-muted-foreground border-t pt-1"><span>Subtotal contingencies</span><span className="tabular-nums">{formatUSD(bidReconciliation.contingencies)}</span></div>

                  <Separator className="my-2" />
                  <div className="flex justify-between font-semibold text-base"><span>TOTAL LABOR DOLLARS</span><span className="tabular-nums">{formatUSD(bidReconciliation.exportTotal)}</span></div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {/* Project Location & Sales Tax */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-blue-500" />
            Project Location & Sales Tax
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="zipcode">Jobsite ZIP Code</Label>
              <Input
                id="zipcode"
                placeholder="e.g., 90802"
                value={jobsiteZipCode}
                onChange={(e) => setJobsiteZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                maxLength={5}
                className="font-mono"
              />
            </div>
            <div>
              <Label>Tax Rate</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.25"
                  min="0"
                  max="15"
                  value={customTaxRate ?? taxInfo.rate}
                  onChange={(e) => setCustomTaxRate(parseFloat(e.target.value) || null)}
                  className="font-mono"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <Label>Jurisdiction</Label>
              <div className="h-10 flex items-center px-3 bg-muted rounded-md border text-sm">
                {taxInfo.jurisdiction}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <div className="flex justify-between items-center">
              <span className="text-blue-800 dark:text-blue-200 font-medium">Total Material (Pre-Tax)</span>
              <span className="font-mono font-bold text-blue-900 dark:text-blue-100">
                ${calculations.totalMaterialPreTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="text-blue-700 dark:text-blue-300">Sales Tax ({taxInfo.rate}%)</span>
              <span className="font-mono text-blue-800 dark:text-blue-200">
                +${calculations.totalMaterialTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between items-center">
              <span className="text-blue-900 dark:text-blue-100 font-bold">Total Material (With Tax)</span>
              <span className="font-mono font-bold text-blue-900 dark:text-blue-100 text-lg">
                ${calculations.totalMaterialWithTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Foreman Field Bonus */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-amber-500" />
            Foreman Field Bonus Strip
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Strips a percentage of total field hours to fund foreman incentive bonus.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Switch checked={foremanBonusEnabled} onCheckedChange={setForemanBonusEnabled} />
              <span className={foremanBonusEnabled ? 'text-foreground' : 'text-muted-foreground'}>
                Enable Foreman Bonus Strip
              </span>
            </div>

            {foremanBonusEnabled && (
              <div className="flex items-center gap-3">
                <Label>Strip Percentage:</Label>
                <div className="flex items-center gap-2 w-32">
                  <Slider
                    value={[foremanBonusPercent]}
                    onValueChange={([val]) => setForemanBonusPercent(val)}
                    min={0.5}
                    max={3}
                    step={0.25}
                    className="w-20"
                  />
                  <span className="font-mono font-bold text-amber-600 w-12">{foremanBonusPercent}%</span>
                </div>
              </div>
            )}
          </div>

          {foremanBonusEnabled && (
            <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Hours Stripped</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    {calculations.foremanBonusHours?.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Rate</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    ${computedBidLaborRate.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-amber-700 dark:text-amber-300 text-sm">Foreman Bonus Value</div>
                  <div className="font-mono font-bold text-amber-900 dark:text-amber-100 text-xl">
                    ${calculations.foremanBonusDollars?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Labor Rate Contingency (LRCN) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-teal-500" />
            Labor Rate Contingency (LRCN)
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Calculate the difference between bid labor rates and budget rate. The contingency is added to material code LRCN.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={lrcnEnabled} onCheckedChange={setLrcnEnabled} />
            <span className={lrcnEnabled ? 'text-foreground' : 'text-muted-foreground'}>
              Enable Labor Rate Contingency
            </span>
          </div>

          {lrcnEnabled && (
            <>
              <div className="space-y-3">
                <Label className="text-base font-semibold">Bid Labor Breakdown</Label>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Labor Type</TableHead>
                      <TableHead className="text-right w-28">Hours</TableHead>
                      <TableHead className="text-right w-32">Rate ($/hr)</TableHead>
                      <TableHead className="text-right w-36">Total ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {([
                      { key: 'straightTime' as const, label: 'Straight Time', totalKey: 'straightTotal' as const },
                      { key: 'shiftTime' as const, label: 'Shift Time', totalKey: 'shiftTotal' as const },
                      { key: 'overtime' as const, label: 'Overtime', totalKey: 'overtimeTotal' as const },
                      { key: 'doubleTime' as const, label: 'Double Time', totalKey: 'doubleTimeTotal' as const },
                      { key: 'shop' as const, label: 'Shop', totalKey: 'shopTotal' as const },
                    ] as const).map(({ key, label, totalKey }) => {
                      const entry = bidRates[key];
                      const resolvedTotal = lrcnCalculations[totalKey];
                      const hasUserTotal = entry.total !== undefined && entry.total !== '';
                      return (
                        <TableRow key={key}>
                          <TableCell>{label}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              min="0"
                              value={entry.hours || ''}
                              onChange={(e) => {
                                const newHours = parseFloat(e.target.value) || 0;
                                setBidRates(prev => {
                                  const prevEntry = prev[key];
                                  // If there's a user-entered total, back-calculate rate from total / newHours
                                  if (prevEntry.total !== undefined && prevEntry.total !== '' && newHours > 0) {
                                    const totalVal = parseFloat(prevEntry.total) || 0;
                                    return { ...prev, [key]: { ...prevEntry, hours: newHours, rate: String(totalVal / newHours) } };
                                  }
                                  return { ...prev, [key]: { ...prevEntry, hours: newHours } };
                                });
                              }}
                              className="w-24 text-right font-mono"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              inputMode="decimal"
                              value={hasUserTotal ? (parseFloat(entry.rate) || 0).toFixed(2) : entry.rate}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  // User is manually typing a rate — clear total so rate is source of truth
                                  setBidRates(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], rate: val, total: undefined }
                                  }));
                                }
                              }}
                              className="w-28 text-right font-mono"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              inputMode="decimal"
                              value={hasUserTotal ? entry.total : resolvedTotal.toFixed(2)}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                  const parsedTotal = parseFloat(val);
                                  const hours = entry.hours;
                                  // Back-calculate rate at full precision
                                  const newRate = (!isNaN(parsedTotal) && hours > 0)
                                    ? String(parsedTotal / hours)
                                    : entry.rate;
                                  setBidRates(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], total: val, rate: newRate }
                                  }));
                                }
                              }}
                              onBlur={() => {
                                // On blur, if total is empty, clear it so computed value shows
                                if (entry.total === '') {
                                  setBidRates(prev => ({
                                    ...prev,
                                    [key]: { ...prev[key], total: undefined }
                                  }));
                                }
                              }}
                              className={`w-32 text-right font-mono ${hasUserTotal ? 'border-primary/50 bg-primary/5' : ''}`}
                              placeholder={resolvedTotal.toFixed(2)}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="border-t-2 font-bold bg-muted/50">
                      <TableCell>BID TOTAL</TableCell>
                      <TableCell className="text-right font-mono">{lrcnCalculations.totalHours.toLocaleString()}</TableCell>
                      <TableCell className="text-right"></TableCell>
                      <TableCell className="text-right font-mono text-lg">
                        ${lrcnCalculations.bidTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="budgetRate">Budget Rate ($/hr)</Label>
                  <Input
                    id="budgetRate"
                    type="text"
                    inputMode="decimal"
                    value={budgetRateInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) {
                        setBudgetRateInput(val);
                        const parsed = parseFloat(val);
                        if (!isNaN(parsed)) setBudgetRate(parsed);
                      }
                    }}
                    onBlur={() => {
                      const parsed = parseFloat(budgetRateInput);
                      if (isNaN(parsed) || budgetRateInput.trim() === '') {
                        setBudgetRateInput(budgetRate.toString());
                      } else {
                        setBudgetRate(parsed);
                        setBudgetRateInput(parsed.toString());
                      }
                    }}
                    className="font-mono text-lg"
                  />
                  <p className="text-xs text-muted-foreground">Single blended rate for budgeting</p>
                </div>
                <div className="space-y-2">
                  <Label>Budget Total</Label>
                  <div className="h-10 flex items-center px-3 bg-muted rounded-md border font-mono text-lg">
                    ${lrcnCalculations.budgetTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted-foreground">Field: {lrcnCalculations.fieldHours.toLocaleString()} hrs × ${budgetRate.toFixed(2)} + Shop: {lrcnCalculations.shopHours.toLocaleString()} hrs × ${lrcnCalculations.shopRate.toFixed(2)}</p>
                </div>
              </div>

              {/* LRCN Audit Breakdown Table */}
              {(() => {
                const parseRate = (rate: string) => parseFloat(rate) || 0;
                // Resolve authoritative bid dollars per row: entry.total ?? (hours × rate)
                const resolveRowTotal = (entry: BidRate): number => {
                  if (entry.total !== undefined && entry.total !== '') {
                    const parsed = parseFloat(entry.total);
                    if (!isNaN(parsed)) return parsed;
                  }
                  return entry.hours * parseRate(entry.rate);
                };
                const auditRows = [
                  { label: 'Straight Time', entry: bidRates.straightTime, budgetRateVal: budgetRate },
                  { label: 'Shift Time', entry: bidRates.shiftTime, budgetRateVal: budgetRate },
                  { label: 'Overtime', entry: bidRates.overtime, budgetRateVal: budgetRate },
                  { label: 'Double Time', entry: bidRates.doubleTime, budgetRateVal: budgetRate },
                  { label: 'Shop', entry: bidRates.shop, budgetRateVal: lrcnCalculations.shopRate },
                ];
                const totalBid = auditRows.reduce((s, r) => s + resolveRowTotal(r.entry), 0);
                const totalBudget = auditRows.reduce((s, r) => s + r.entry.hours * r.budgetRateVal, 0);
                const totalDelta = totalBid - totalBudget;
                const totalHours = auditRows.reduce((s, r) => s + r.entry.hours, 0);
                const deltaColor = (d: number) => d > 0.005 ? 'text-emerald-600 dark:text-emerald-400' : d < -0.005 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground';
                const fmt = (n: number) => '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                return (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold text-foreground">LRCN Audit Breakdown</div>
                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="text-xs">Labor Type</TableHead>
                            <TableHead className="text-xs text-right">Hours</TableHead>
                            <TableHead className="text-xs text-right">Bid Rate</TableHead>
                            <TableHead className="text-xs text-right">Bid $</TableHead>
                            <TableHead className="text-xs text-right bg-primary/5">Budget Rate</TableHead>
                            <TableHead className="text-xs text-right bg-primary/5">Budget $</TableHead>
                            <TableHead className="text-xs text-right">Delta</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditRows.map((row) => {
                            const bidDollars = resolveRowTotal(row.entry);
                            const budgetDollars = row.entry.hours * row.budgetRateVal;
                            const delta = bidDollars - budgetDollars;
                            const displayRate = parseRate(row.entry.rate);
                            return (
                              <TableRow key={row.label}>
                                <TableCell className="text-xs font-medium py-2">{row.label}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2">{row.entry.hours.toLocaleString()}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2">${displayRate.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2">{fmt(bidDollars)}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2 bg-primary/5">${row.budgetRateVal.toFixed(2)}</TableCell>
                                <TableCell className="text-xs text-right font-mono py-2 bg-primary/5">{fmt(budgetDollars)}</TableCell>
                                <TableCell className={`text-xs text-right font-mono font-semibold py-2 ${deltaColor(delta)}`}>{fmt(delta)}</TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="border-t-2 font-bold bg-muted/50">
                            <TableCell className="text-xs font-bold py-2">TOTALS</TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold py-2">{totalHours.toLocaleString()}</TableCell>
                            <TableCell className="py-2"></TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold py-2">{fmt(totalBid)}</TableCell>
                            <TableCell className="py-2 bg-primary/5"></TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold py-2 bg-primary/5">{fmt(totalBudget)}</TableCell>
                            <TableCell className={`text-xs text-right font-mono font-bold py-2 ${deltaColor(totalDelta)}`}>{fmt(totalDelta)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })()}

              <div className={`rounded-lg p-4 border ${lrcnCalculations.lrcnAmount >= 0 ? 'bg-teal-50 dark:bg-teal-950 border-teal-200 dark:border-teal-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'}`}>
                <div className="flex justify-between items-center">
                  <div>
                    <div className={`text-sm ${lrcnCalculations.lrcnAmount >= 0 ? 'text-teal-700 dark:text-teal-300' : 'text-red-700 dark:text-red-300'}`}>
                      Labor Rate Contingency (LRCN)
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Bid Total - Budget Total = LRCN
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono font-bold text-2xl ${lrcnCalculations.lrcnAmount >= 0 ? 'text-teal-700 dark:text-teal-200' : 'text-red-700 dark:text-red-200'}`}>
                      ${lrcnCalculations.lrcnAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    {lrcnCalculations.lrcnAmount >= 0 && (
                      <div className="text-xs text-teal-600 dark:text-teal-400 mt-1">
                        → Material Code LRCN
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Fabrication Hours Strip */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wrench className="h-5 w-5 text-purple-500" />
            Fabrication Hours Strip
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>For jobs with shop fabrication, strip a percentage of field hours to create separate fabrication budget codes.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">FAB</TableHead>
                  <TableHead>Cost Head</TableHead>
                  <TableHead className="text-right">Original Hours</TableHead>
                  {foremanBonusEnabled && (
                    <>
                      <TableHead className="text-center bg-amber-50 dark:bg-amber-950">Foreman Strip %</TableHead>
                      <TableHead className="text-right bg-amber-50 dark:bg-amber-950">Foreman Hrs</TableHead>
                      <TableHead className="text-right bg-amber-50 dark:bg-amber-950">After Foreman</TableHead>
                    </>
                  )}
                  <TableHead className="text-center bg-purple-50 dark:bg-purple-950 w-24">Fab Strip %</TableHead>
                  <TableHead className="text-right bg-purple-50 dark:bg-purple-950">Fab Hours</TableHead>
                  <TableHead className="text-right font-bold">Final Field Hrs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(groupedByCostHead)
                  .sort((a, b) => b[1].totalHours - a[1].totalHours)
                  .map(([costHead, group]) => {
                    const fabConfig = fabricationConfigs[costHead];
                    const isEnabled = fabConfig?.enabled || false;
                    const fabPercent = fabConfig?.percentage || 15;

                    const originalHours = group.totalHours;
                    const foremanStripHours = foremanBonusEnabled ? originalHours * (foremanBonusPercent / 100) : 0;
                    const hoursAfterForeman = originalHours - foremanStripHours;
                    const fabHours = isEnabled ? hoursAfterForeman * (fabPercent / 100) : 0;
                    const finalFieldHours = hoursAfterForeman - fabHours;

                    return (
                      <TableRow key={costHead} className={isEnabled ? 'bg-purple-50/30 dark:bg-purple-950/30' : ''}>
                        <TableCell>
                          <Switch checked={isEnabled} onCheckedChange={(checked) => toggleFabForCode(costHead, checked)} />
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm font-semibold">{costHead}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {group.description}
                            <span className="ml-1 opacity-50">({group.fullCodes.length} code{group.fullCodes.length > 1 ? 's' : ''})</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{originalHours.toFixed(1)}</TableCell>
                        {foremanBonusEnabled && (
                          <>
                            <TableCell className="text-center font-mono text-amber-600 bg-amber-50/50 dark:bg-amber-950/50">
                              {foremanBonusPercent}%
                            </TableCell>
                            <TableCell className="text-right font-mono text-amber-600 bg-amber-50/50 dark:bg-amber-950/50">
                              -{foremanStripHours.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-right font-mono bg-amber-50/50 dark:bg-amber-950/50">
                              {hoursAfterForeman.toFixed(1)}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="bg-purple-50/50 dark:bg-purple-950/50">
                          {isEnabled ? (
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                min="1"
                                max="50"
                                value={fabPercent}
                                onChange={(e) => setFabPercentForCode(costHead, parseInt(e.target.value) || 15)}
                                className="w-14 h-7 text-center font-mono text-sm"
                              />
                              <span className="text-muted-foreground text-xs">%</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-center block">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-purple-600 bg-purple-50/50 dark:bg-purple-950/50">
                          {isEnabled ? `-${fabHours.toFixed(1)}` : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-green-600">
                          {finalFieldHours.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>

          {/* Fab Material Routing Table */}
          {Object.keys(groupedByCostHead).some(h => fabricationConfigs[h]?.enabled) && (
            <details className="mt-4">
              <summary className="text-sm font-medium cursor-pointer text-muted-foreground hover:text-foreground select-none">
                ⚙ Fab Material Routing
                <span className="ml-2 text-xs text-orange-500">
                  ({Object.keys(
                    Object.entries(groupedByCostHead)
                      .filter(([costHead]) => fabricationConfigs[costHead]?.enabled)
                      .reduce((acc, [costHead]) => {
                        const fabCostHead = fabCodeMap[costHead];
                        if (fabCostHead) acc[fabCostHead] = true;
                        return acc;
                      }, {} as Record<string, boolean>)
                  ).length} fab codes will be generated)
                </span>
              </summary>

              {(() => {
                const unroutedStripped = Object.entries(fabCodeMap).filter(
                  ([costHead, fabCode]) =>
                    fabricationConfigs[costHead]?.enabled && !fabCode
                );
                return unroutedStripped.length > 0 ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 mt-3 mb-3">
                    <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <div className="text-sm text-amber-300">
                      <span className="font-semibold">
                        {unroutedStripped.length} cost head{unroutedStripped.length > 1 ? 's have' : ' has'} fab strip ON but no routing code assigned:
                      </span>{' '}
                      <span className="font-mono">
                        {unroutedStripped.map(([ch]) => ch).join(', ')}
                      </span>
                      . Stripped hours will not appear in any fab line. Select a Routes To code or disable the strip.
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="mt-3 rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Field Cost Head</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Fab Hrs Stripped</TableHead>
                      <TableHead>Routes To</TableHead>
                      <TableHead className="text-right">Bid Rate ($/hr)</TableHead>
                      <TableHead className="text-right">Budget Rate ($/hr)</TableHead>
                      <TableHead className="text-center w-16">Reset</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(groupedByCostHead)
                      .filter(([costHead]) => fabricationConfigs[costHead]?.enabled)
                      .sort((a, b) => b[1].totalHours - a[1].totalHours)
                      .map(([costHead, group]) => {
                        const config = fabricationConfigs[costHead] || { percentage: 15 };
                        const originalHours = group.totalHours;
                        const foremanStripHours = foremanBonusEnabled ? originalHours * (foremanBonusPercent / 100) : 0;
                        const hoursAfterForeman = originalHours - foremanStripHours;
                        const fabHours = hoursAfterForeman * ((config.percentage || 15) / 100);
                        const currentFabCostHead = fabCodeMap[costHead] || '';
                        const assembledCode = currentFabCostHead
                          ? `${FAB_SECTION} ${FAB_ACTIVITY} ${currentFabCostHead}`
                          : '—';

                        return (
                          <TableRow key={costHead}>
                            <TableCell className="font-mono font-semibold text-blue-500">
                              {costHead}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">
                              {group.description}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-mono text-orange-500">{fabHours.toFixed(1)} hrs</span>
                              <div className="text-xs text-muted-foreground">→ {assembledCode}</div>
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const suggestion = getDominantFabCode(costHead, estimateData);
                                if (!suggestion || suggestion.fabCode === currentFabCostHead) return null;
                                return (
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-xs text-blue-500">
                                      ⚡ Suggested: <strong>{suggestion.fabCode}</strong>
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      — {suggestion.specName} ({Math.round(suggestion.confidence * 100)}% of hrs)
                                    </span>
                                    <button
                                      onClick={() => setFabCodeMap(prev => ({ ...prev, [costHead]: suggestion.fabCode }))}
                                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                                    >
                                      Apply
                                    </button>
                                  </div>
                                );
                              })()}
                              <select
                                value={currentFabCostHead}
                                onChange={(e) => {
                                  if (e.target.value === '__custom__') {
                                    setCustomFabEntry({ costHead, code: '', desc: '' });
                                  } else {
                                    setFabCodeMap(prev => ({ ...prev, [costHead]: e.target.value }));
                                  }
                                }}
                                className="bg-background border border-border rounded px-2 py-1 text-sm font-mono w-full"
                              >
                                <option value="">-- No Fab Code --</option>
                                <option value="COPR">FP 0000 COPR — Copper</option>
                                <option value="CSTI">FP 0000 CSTI — Cast Iron</option>
                                <option value="CSTF">FP 0000 CSTF — Carbon Steel Teflon Lined</option>
                                <option value="CRBN">FP 0000 CRBN — Carbon Steel</option>
                                <option value="SSTL">FP 0000 SSTL — Stainless Steel</option>
                                <option value="SS10">FP 0000 SS10 — Stainless 10GA</option>
                                <option value="PLST">FP 0000 PLST — Plastic / CPVC</option>
                                <option value="BRAZ">FP 0000 BRAZ — Brazed</option>
                                <option value="HFBS">FP 0000 HFBS — Hanger Fab Sheets</option>
                                <option value="HNGS">FP 0000 HNGS — Hangers & Supports</option>
                                <option value="FNSH">FP 0000 FNSH — Finish</option>
                                {Object.entries(customFabCodes).map(([code, desc]) => (
                                  <option key={code} value={code}>FP 0000 {code} — {desc}</option>
                                ))}
                                <option value="__custom__">+ Add Custom Code...</option>
                              </select>
                              {customFabEntry?.costHead === costHead && (
                                <div className="flex gap-2 mt-2 items-center">
                                  <Input placeholder="Code (4 chars)" maxLength={4}
                                    value={customFabEntry?.code || ''}
                                    onChange={e => setCustomFabEntry(prev => prev ? { ...prev, code: e.target.value.toUpperCase() } : null)}
                                    className="w-[90px] h-8 font-mono text-sm" />
                                  <Input placeholder="Description"
                                    value={customFabEntry?.desc || ''}
                                    onChange={e => setCustomFabEntry(prev => prev ? { ...prev, desc: e.target.value } : null)}
                                    className="w-[200px] h-8 text-sm" />
                                  <Button size="sm" onClick={() => {
                                    if (customFabEntry?.code?.length === 4 && customFabEntry.desc) {
                                      setCustomFabCodes(prev => ({ ...prev, [customFabEntry.code]: customFabEntry.desc.toUpperCase() }));
                                      setFabCodeMap(prev => ({ ...prev, [customFabEntry.costHead]: customFabEntry.code }));
                                      setCustomFabEntry(null);
                                    }
                                  }}>Add</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setCustomFabEntry(null)}>Cancel</Button>
                                </div>
                              )}
                              {fabricationConfigs[costHead]?.enabled && !currentFabCostHead && (
                                <div className="flex items-center gap-1 mt-1">
                                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                                  <span className="text-xs text-amber-400">
                                    No routing — stripped hours will be lost
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24 text-right font-mono text-sm h-8 ml-auto"
                                value={fabRates[currentFabCostHead]?.bidRate ?? shopRate.toFixed(2)}
                                onChange={(e) =>
                                  setFabRates(prev => ({
                                    ...prev,
                                    [currentFabCostHead]: {
                                      ...prev[currentFabCostHead],
                                      bidRate: e.target.value,
                                      budgetRate: prev[currentFabCostHead]?.budgetRate ?? e.target.value,
                                    },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                step="0.01"
                                className="w-24 text-right font-mono text-sm h-8 ml-auto"
                                value={fabRates[currentFabCostHead]?.budgetRate ?? fabRates[currentFabCostHead]?.bidRate ?? shopRate.toFixed(2)}
                                onChange={(e) =>
                                  setFabRates(prev => ({
                                    ...prev,
                                    [currentFabCostHead]: {
                                      ...prev[currentFabCostHead],
                                      bidRate: prev[currentFabCostHead]?.bidRate ?? shopRate.toFixed(2),
                                      budgetRate: e.target.value,
                                    },
                                  }))
                                }
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <button
                                onClick={() =>
                                  setFabCodeMap(prev => ({
                                    ...prev,
                                    [costHead]: DEFAULT_FAB_CODE_MAP[costHead] || '',
                                  }))
                                }
                                className="text-xs text-muted-foreground hover:text-foreground underline"
                              >
                                Reset
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </div>

              {/* Generated Fab Code Summary */}
              <div className="mt-3 bg-purple-50 dark:bg-purple-950 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                <div className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-2">Generated Fabrication Labor Codes:</div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    Object.entries(groupedByCostHead)
                      .filter(([costHead]) => fabricationConfigs[costHead]?.enabled)
                      .reduce((acc, [costHead, group]) => {
                        const fabCostHead = fabCodeMap[costHead];
                        if (fabCostHead) {
                          const config = fabricationConfigs[costHead] || { percentage: 15 };
                          const originalHours = group.totalHours;
                          const foremanStripHours = foremanBonusEnabled ? originalHours * (foremanBonusPercent / 100) : 0;
                          const hoursAfterForeman = originalHours - foremanStripHours;
                          const fabHrs = hoursAfterForeman * ((config.percentage || 15) / 100);
                          acc[fabCostHead] = (acc[fabCostHead] || 0) + fabHrs;
                        }
                        return acc;
                      }, {} as Record<string, number>)
                  ).map(([fabCostHead, hours]) => (
                    <div key={fabCostHead} className="bg-background border border-border rounded px-3 py-1.5 text-sm">
                      <span className="font-mono font-semibold text-purple-600 dark:text-purple-400">
                        {FAB_SECTION} {FAB_ACTIVITY} {fabCostHead}
                      </span>
                      <span className="ml-2 text-muted-foreground text-xs">
                        {(hours).toFixed(1)} hrs @ ${(parseFloat(fabRates[fabCostHead]?.budgetRate) || shopRate).toFixed(2)}/hr
                      </span>
                      <span className="ml-1 text-muted-foreground text-xs">
                        — {FAB_COST_HEAD_DESCRIPTIONS[fabCostHead] || customFabCodes[fabCostHead] || fabCostHead}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fab LRCN Toggle & Summary */}
              {fabLrcnCalculations.breakdown.length > 0 && (
                <div className="mt-3 bg-orange-50 dark:bg-orange-950 rounded-lg p-3 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-medium text-orange-700 dark:text-orange-300">
                      Fab Labor Rate Contingency (MA 0FAB LRCN)
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-xs text-muted-foreground">{fabLrcnEnabled ? 'Enabled' : 'Disabled'}</span>
                      <input
                        type="checkbox"
                        checked={fabLrcnEnabled}
                        onChange={(e) => setFabLrcnEnabled(e.target.checked)}
                        className="rounded"
                      />
                    </label>
                  </div>
                  {fabLrcnEnabled && (
                    <>
                      <div className="space-y-1">
                        {fabLrcnCalculations.breakdown.filter(b => b.hours > 0).map(b => (
                          <div key={b.code} className="flex justify-between text-xs font-mono">
                            <span className="text-muted-foreground">
                              {b.code}: {b.hours.toFixed(1)} hrs × (${b.bidRate.toFixed(2)} - ${b.budgetRate.toFixed(2)})
                            </span>
                            <span className={b.diff > 0 ? 'text-green-600' : 'text-muted-foreground'}>
                              ${b.diff.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between mt-2 pt-2 border-t border-orange-200 dark:border-orange-700 text-sm font-semibold">
                        <span className="text-orange-700 dark:text-orange-300">Fab LRCN Total</span>
                        <span className={fabLrcnCalculations.fabLrcnAmount > 0 ? 'text-green-600 font-mono' : 'text-muted-foreground font-mono'}>
                          ${fabLrcnCalculations.fabLrcnAmount.toFixed(2)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </details>
          )}

          {calculations.totalFabHours > 0 && (
            <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-4 border border-purple-200 dark:border-purple-800 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-purple-800 dark:text-purple-200 font-medium">Total Field Hours</span>
                <span className="font-mono font-bold text-green-700">{calculations.totalFieldHours?.toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center mt-1">
                <span className="text-purple-800 dark:text-purple-200 font-medium">Total Fabrication Hours</span>
                <span className="font-mono font-bold text-purple-700">{calculations.totalFabHours?.toFixed(1)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Material Tax Details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-green-500" />
            Material Tax Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">TAX</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Tax ({taxInfo.rate}%)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calculations.materialTaxSummary?.map((item) => (
                <TableRow key={item.code} className={item.taxable ? '' : 'bg-muted/50'}>
                  <TableCell>
                    <Switch
                      checked={item.taxable}
                      onCheckedChange={(checked) => {
                        setMaterialTaxOverrides(prev => ({ ...prev, [item.code]: checked }));
                      }}
                    />
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.code}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-right font-mono">
                    ${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right font-mono text-orange-600">
                    {item.taxable ? `$${item.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ${(item.amount + item.taxAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Final Budget Summary */}
      <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-green-800 dark:text-green-200">
            <Calculator className="h-5 w-5" />
            Adjusted Budget Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-semibold text-green-800 dark:text-green-200">Labor</h4>
              <div className="flex justify-between text-sm">
                <span>Field Hours</span>
                <span className="font-mono">{calculations.totalFieldHours?.toFixed(1)}</span>
              </div>
              {calculations.totalFabHours > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Fabrication Hours</span>
                  <span className="font-mono">{calculations.totalFabHours?.toFixed(1)}</span>
                </div>
              )}
              {foremanBonusEnabled && (
                <div className="flex justify-between text-sm">
                  <span>Foreman Bonus Hours</span>
                  <span className="font-mono">{calculations.foremanBonusHours?.toFixed(1)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Labor</span>
                <span className="font-mono">
                  ${calculations.totalLaborDollars?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-green-800 dark:text-green-200">Material</h4>
              <div className="flex justify-between text-sm">
                <span>Material (Pre-Tax)</span>
                <span className="font-mono">
                  ${calculations.totalMaterialPreTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Sales Tax ({taxInfo.rate}%)</span>
                <span className="font-mono">
                  ${calculations.totalMaterialTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between font-bold">
                <span>Total Material</span>
                <span className="font-mono">
                  ${calculations.totalMaterialWithTax?.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Small Code Consolidation */}
          {(smallCodeAnalysis.length > 0 || (savedMergesData?.length ?? 0) > 0) && (
            <div className="mt-8 rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-orange-400 flex items-center gap-2">
                  ⚠️ Small Code Review
                  <span className="text-xs font-normal text-muted-foreground">
                    ({filteredSmallCodeAnalysis.length} flagged{savedMergesData?.length ? `, ${savedMergesData.length} saved` : ''})
                  </span>
                </h3>
              </div>
              <div className="text-xs text-muted-foreground mb-3 px-1 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => { setSmallCodeTab('standalone'); setStandaloneFilter('in-export'); }}
                  className="underline cursor-pointer hover:opacity-80"
                >
                  <strong className="text-foreground">{totalSmallInExport}</strong> codes under {minHoursThreshold}h will appear in export
                </button>
                <span className="text-muted-foreground">·</span>
                <span className="text-green-600">{acceptedKeys.size} accepted</span>
                <span className="text-muted-foreground">·</span>
                <button
                  onClick={() => {
                    setSmallCodeTab('standalone');
                    setStandaloneFilter('residual');
                  }}
                  className={cn(
                    'underline cursor-pointer',
                    residualRows.length > 0 ? 'text-amber-500 hover:text-amber-600' : 'text-green-600'
                  )}
                >
                  {residualRows.length} need attention
                </button>
              </div>
              {residualRows.length > 0 && (
                <button
                  onClick={() => {
                    setSmallCodeTab('standalone');
                    setStandaloneFilter('residual');
                  }}
                  className="w-full mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left hover:bg-amber-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-amber-700">
                        ⚠ {residualRows.length} codes still under {minHoursThreshold}h after all actions
                      </span>
                      <p className="text-xs text-amber-600 mt-0.5">
                        Click to review and reassign or accept these codes
                      </p>
                    </div>
                    <span className="text-amber-500 text-sm">Review →</span>
                  </div>
                </button>
              )}
              <p className="text-xs text-muted-foreground mb-4">
                Floor-level codes under {minHoursThreshold} hrs should typically be merged into a single <code className="font-mono bg-muted px-1 rounded">0000</code> activity code. Check each to merge. If a SEC section total is under 80 hrs, consider merging the entire section.
              </p>

              {/* Show saved merges that no longer appear in smallCodeAnalysis (already merged) */}
              {savedMergesData && savedMergesData.length > 0 && (
                <div className="mb-4 space-y-1">
                  {savedMergesData
                    .filter(m => !smallCodeAnalysis.some(s => s.sec === m.sec_code && s.head === m.cost_head))
                    .map(m => {
                      const savedKey = `saved-top-${m.sec_code}|${m.cost_head}`;
                      const historyProps = buildCodeHistoryProps(m.sec_code, m.cost_head, (() => {
                        // Get final hours from finalLaborSummary for this sec|head
                        return Object.entries(finalLaborSummary ?? {})
                          .filter(([k]) => {
                            const parts = k.trim().split(/\s+/);
                            return parts[0] === m.sec_code && parts.slice(2).join(' ') === m.cost_head;
                          })
                          .reduce((s, [, e]) => s + (e.hours ?? 0), 0);
                      })());
                      return (
                      <div key={`${m.sec_code}|${m.cost_head}`}>
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-muted/30 opacity-60">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-500 font-medium">✓ Saved</span>
                            <span className="font-mono font-bold text-blue-400">SEC {m.sec_code} — {m.cost_head}</span>
                            <span className="text-muted-foreground">→ merged to {m.merged_act}</span>
                            {historyProps && historyProps.actionType !== 'keep' && historyProps.actionType !== 'accepted' && (
                              <button
                                className="text-[10px] text-muted-foreground hover:text-foreground underline ml-1"
                                onClick={() => {
                                  setExpandedHistoryKeys(prev => {
                                    const next = new Set(prev);
                                    if (next.has(savedKey)) next.delete(savedKey);
                                    else next.add(savedKey);
                                    return next;
                                  });
                                }}
                              >
                                {expandedHistoryKeys.has(savedKey) ? 'Hide History' : 'Code History'}
                              </button>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 px-2 text-xs ${undoingKey === `${(m.sec_code || '').trim()}|${(m.cost_head || '').trim()}` ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={undoingKey === `${(m.sec_code || '').trim()}|${(m.cost_head || '').trim()}`}
                            onClick={() => handleUndoMerge(m.sec_code, m.cost_head)}
                          >
                            <Undo2 className="h-3 w-3 mr-1" /> {undoingKey === `${(m.sec_code || '').trim()}|${(m.cost_head || '').trim()}` ? 'Undoing...' : 'Undo'}
                          </Button>
                        </div>
                        {historyProps && expandedHistoryKeys.has(savedKey) && (
                          <div className="ml-3 mt-1 mb-2 border-l-2 border-border/40 pl-3">
                            <CodeHistoryDetail
                              sec={historyProps.sec}
                              head={historyProps.head}
                              sourceLines={historyProps.sourceLines}
                              actionType={historyProps.actionType}
                              reassignTarget={historyProps.reassignTarget}
                              redistributeDeltas={historyProps.redistDeltas}
                              targetEntries={historyProps.targetEntries}
                              finalHours={historyProps.combinedHours}
                              isOpen={true}
                              onToggle={() => {
                                setExpandedHistoryKeys(prev => {
                                  const next = new Set(prev);
                                  next.delete(savedKey);
                                  return next;
                                });
                              }}
                              colSpan={0}
                            />
                          </div>
                        )}
                      </div>
                      );
                    })}
                </div>
              )}

              {(() => {
                // Detect saved redistributions where finalLaborSummary still has sub-threshold rows
                const failedRedistKeys = (savedMergesData ?? []).filter(m => {
                  if (!m.redistribute_adjustments || Object.keys(m.redistribute_adjustments as object).length === 0) return false;
                  const sec = (m.sec_code || '').trim();
                  const head = (m.cost_head || '').trim();
                  return Object.entries(finalLaborSummary ?? {}).some(([k, e]) => {
                    const kParts = k.trim().split(/\s+/);
                    return kParts[0] === sec && kParts.slice(2).join(' ') === head && ((e as any).rawHours ?? e.hours ?? 0) < minHoursThreshold && ((e as any).rawHours ?? e.hours ?? 0) > 0.05;
                  });
                });
                if (failedRedistKeys.length === 0) return null;
                return (
                  <div className="mb-3 flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3">
                    <span className="mt-0.5 shrink-0 text-destructive">⚠️</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-destructive">
                        {failedRedistKeys.length} saved redistribution{failedRedistKeys.length > 1 ? 's' : ''} did not achieve the {minHoursThreshold}h minimum
                      </p>
                      <p className="mt-0.5 text-xs text-destructive/80">
                        These were computed with stale data. Undo and re-apply auto-resolve to fix:
                        {' '}<span className="font-mono">{failedRedistKeys.map(m => `${m.sec_code}|${m.cost_head}`).join(', ')}</span>
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const ids = failedRedistKeys.map(m => m.id);
                        const { error } = await supabase
                          .from('project_small_code_merges')
                          .delete()
                          .in('id', ids);
                        if (!error) {
                          queryClient.invalidateQueries({ queryKey: ['small-code-merges', projectId] });
                          toast({ title: `Cleared ${ids.length} failed redistribution${ids.length > 1 ? 's' : ''}`, description: 'Re-apply auto-resolve to rebuild with correct deltas.' });
                        }
                      }}
                      className="shrink-0 rounded bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                    >
                      Clear &amp; rebuild
                    </button>
                  </div>
                );
              })()}

              {staleMergeUpdates.filter(Boolean).length > 0 && (
                <div className="mb-3 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                  <span className="mt-0.5 shrink-0 text-amber-500">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-amber-800">
                      {staleMergeUpdates.filter(Boolean).length} saved merge{staleMergeUpdates.filter(Boolean).length > 1 ? 's' : ''} reference cost heads that no longer exist
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700">
                      These were likely renamed by a system mapping change:
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {staleMergeUpdates.filter(Boolean).map((u, i) => (
                        <li key={i} className="text-xs font-mono text-amber-700">
                          {u!.secCode} {u!.oldCostHead}{' '}
                          <span className="text-amber-500">→ not found in current data</span>
                          {u!.newCostHead ? (
                            <span className="text-amber-600"> (possible replacement: {u!.newCostHead})</span>
                          ) : (
                            <span className="text-amber-400"> — cost head may have been removed or remapped</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="shrink-0 flex flex-col gap-1.5">
                    <button
                      onClick={async () => {
                        for (const u of staleMergeUpdates.filter(Boolean)) {
                          if (!u || !projectId) continue;
                          await supabase
                            .from('project_small_code_merges')
                            .delete()
                            .eq('project_id', projectId)
                            .eq('sec_code', u.secCode)
                            .eq('cost_head', u.oldCostHead);
                        }
                        queryClient.invalidateQueries({ queryKey: ['small-code-merges', projectId] });
                        toast({ title: 'Stale merges cleared', description: 'Re-apply your merge decisions for the updated cost heads.' });
                      }}
                      className="rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
                    >
                      Clear stale entries
                    </button>
                  </div>
                </div>
              )}

              {filteredSmallCodeAnalysis.length > 0 && (
                <>

                  {/* Inner tab switcher */}
                  <div className="flex items-center gap-2 mb-4 border-b border-border pb-2">
                    {(() => {
                      const mergeOpenCount = mergeGroups.filter(g => !savedMergeKeySet.has(g.key)).length;
                      const mergeSavedCount = mergeGroups.filter(g => savedMergeKeySet.has(g.key)).length;
                      const standaloneOpenCount = standaloneGroups.filter(g => !savedMergeKeySet.has(g.key)).length;
                      const standaloneSavedCount = standaloneGroups.filter(g => savedMergeKeySet.has(g.key)).length;
                      return (
                        <>
                          <button
                            onClick={() => setSmallCodeTab('merge')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              smallCodeTab === 'merge'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              Merge Groups
                              <span className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                mergeOpenCount > 0
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                              )}>
                                {mergeOpenCount > 0 ? `${mergeOpenCount} open` : '✓ all saved'}
                                {mergeSavedCount > 0 && mergeOpenCount > 0 ? `, ${mergeSavedCount} saved` : ''}
                              </span>
                            </span>
                          </button>
                          <button
                            onClick={() => setSmallCodeTab('standalone')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                              smallCodeTab === 'standalone'
                                ? 'bg-orange-600 text-white'
                                : 'bg-muted text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            <span className="flex items-center gap-1.5">
                              Standalone Codes
                              <span className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-semibold',
                                standaloneOpenCount > 0
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                              )}>
                                {standaloneOpenCount > 0 ? `${standaloneOpenCount} open` : '✓ all saved'}
                                {standaloneSavedCount > 0 && standaloneOpenCount > 0 ? `, ${standaloneSavedCount} saved` : ''}
                                
                              </span>
                            </span>
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  {/* ── MERGE GROUPS TAB ── */}
                  {smallCodeTab === 'merge' && (
                    mergeGroups.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        No multi-line merge candidates below the hour threshold.
                      </p>
                    ) : (
                      <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={
                                  mergeGroups.length > 0 &&
                                  mergeGroups.filter(r => !savedMergeKeySet.has(r.key)).length > 0 &&
                                  mergeGroups.filter(r => !savedMergeKeySet.has(r.key)).every(r => consolidations[r.key])
                                }
                                onCheckedChange={(checked) => {
                                  const next: Record<string, boolean> = {};
                                  mergeGroups.forEach((row) => {
                                    if (!savedMergeKeySet.has(row.key)) {
                                      next[row.key] = !!checked;
                                      if (checked) autoInitRow(row.key);
                                    }
                                  });
                                  setConsolidations((prev) => ({ ...prev, ...next }));
                                  if (!checked) setManuallyOverridden(new Set());
                                }}
                              />
                            </TableHead>
                            <TableHead>Cost Head</TableHead>
                            <TableHead>Current Lines (hrs each)</TableHead>
                            <TableHead className="text-right">Combined Hrs</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Result</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...mergeGroups, ...savedOnlyRows.filter((r) => {
                            const saved = (savedMergesData ?? []).find(
                              (m) => m.sec_code === r.sec && m.cost_head === r.head
                            );
                            return saved && (
                              saved.reassign_to_head === null ||
                              (saved.redistribute_adjustments &&
                                Object.keys(typeof saved.redistribute_adjustments === 'object' && saved.redistribute_adjustments !== null ? saved.redistribute_adjustments : {}).length > 0)
                            );
                          })].map((row, rowIndex) => {
                            const mergeKey = row.key;
                            const isSaved = savedMergeKeySet.has(mergeKey);
                            const sameSECHeads = Object.keys(finalLaborSummary ?? {})
                              .map((k) => {
                                const parts = k.trim().split(/\s+/);
                                return { key: k, sec: parts[0], act: parts[1], head: parts.slice(2).join(' ') };
                              })
                              .filter((p) => p.sec === row.sec && p.head !== row.head);
                            return (
                              <React.Fragment key={mergeKey}>
                              <TableRow className={isSaved ? 'opacity-50' : ''}>
                                <TableCell>
                                  {isSaved ? (
                                    <Checkbox checked disabled />
                                  ) : (
                                    <Checkbox
                                      checked={!!consolidations[mergeKey]}
                                      onClick={(e) => { shiftKeyRef.current = (e as React.MouseEvent).shiftKey; }}
                                      onCheckedChange={(checked) => {
                                        const currentIndex = rowIndex;
                                        const isShift = shiftKeyRef.current;
                                        shiftKeyRef.current = false;
                                        if (isShift && lastCheckedIndexRef.current >= 0) {
                                          const from = Math.min(lastCheckedIndexRef.current, currentIndex);
                                          const to = Math.max(lastCheckedIndexRef.current, currentIndex);
                                          const next: Record<string, boolean> = {};
                                          for (let i = from; i <= to; i++) {
                                            if (!savedMergeKeySet.has(mergeGroups[i].key)) {
                                              next[mergeGroups[i].key] = !!checked;
                                              if (checked) autoInitRow(mergeGroups[i].key);
                                            }
                                          }
                                          setConsolidations((prev) => ({ ...prev, ...next }));
                                        } else {
                                          setConsolidations((prev) => ({ ...prev, [mergeKey]: !!checked }));
                                          if (checked) autoInitRow(mergeKey);
                                        }
                                        lastCheckedIndexRef.current = currentIndex;
                                      }}
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="font-mono font-bold text-blue-400">
                                  SEC {row.sec} — {row.head}
                                  {isSaved && <span className="ml-2 text-xs text-green-500 font-normal">✓ Saved</span>}
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {row.lines.map(l => (
                                      <span key={l.code} className={`px-1.5 py-0.5 rounded text-xs ${l.isSmall ? 'bg-orange-500/20 text-orange-300' : 'bg-muted text-muted-foreground'}`}>
                                        {l.code} ({(l.hours ?? 0).toFixed(1)}h)
                                      </span>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className={`text-right font-mono font-semibold ${row.combinedHours < minHoursThreshold ? 'text-destructive' : row.combinedHours < 20 ? 'text-orange-400' : 'text-foreground'}`}>
                                  {row.combinedHours.toFixed(1)}
                                </TableCell>
                                <TableCell>
                                  {(consolidations[mergeKey] || isSaved) ? (
                                    <div>
                                      <select
                                        className="text-xs bg-background border border-border rounded px-1 py-0.5"
                                        value={reassignTargets[mergeKey] ?? (() => {
                                          const saved = savedMergesData?.find(
                                            m => (m.sec_code || '').trim() === (row.sec || '').trim() &&
                                                 (m.cost_head || '').trim() === (row.head || '').trim()
                                          );
                                          return saved ? getSavedAction(saved) : '__merge__';
                                        })()}
                                        onChange={(e) => {
                                          const newVal = e.target.value;
                                          setReassignTargets((prev) => ({ ...prev, [mergeKey]: newVal }));
                                          const autoResult = getDefaultAction(row.lines);
                                          setManuallyOverridden(prev => {
                                            const next = new Set(prev);
                                            if (newVal === autoResult.action) next.delete(mergeKey);
                                            else next.add(mergeKey);
                                            return next;
                                          });
                                        }}
                                        disabled={isSaved}
                                      >
                                        <option value="__merge__">Merge → {row.sec} 0000 {row.head}</option>
                                        <option value="__redistribute__">Redistribute Hours</option>
                                        {sameSECHeads
                                          .filter((p, i, arr) => arr.findIndex(x => x.head === p.head) === i)
                                          .map((p) => (
                                          <option key={p.key} value={p.head}>Reassign → {p.head}</option>
                                        ))}
                                        <option value="__keep__">Keep as-is</option>
                                      </select>
                                      {consolidations[mergeKey] && !manuallyOverridden.has(mergeKey) && (() => {
                                        const autoResult = getDefaultAction(row.lines);
                                        return (
                                          <div className={`text-xs mt-0.5 ${autoResult.action === '__redistribute__' ? 'text-green-400' : 'text-amber-400'}`}>
                                            {autoResult.reason}
                                          </div>
                                        );
                                      })()}
                                      {consolidations[mergeKey] && reassignTargets[mergeKey] === '__redistribute__' && (() => {
                                        const targets = redistributeAdjustments[mergeKey] ?? {};
                                        const toActKey = (code: string) => { const p = (code ?? '').trim().split(/\s+/); return p.length >= 3 ? p[1] : code; };
                                        const getTarget = (line: typeof row.lines[0]) => targets[toActKey(line.code)] ?? targets[line.code] ?? line.hours;
                                        const netDelta = row.lines.reduce((s, l) => s + (getTarget(l) - l.hours), 0);
                                        const isBalanced = Math.abs(netDelta) < 0.01;
                                        const MIN_HOURS = minHoursThreshold;
                                         const handleAutoRebalance = () => {
                                           // Filter out zero-hour ghost lines before computing deficit/donors
                                           const liveLines = row.lines.filter(l => l.hours > 0);
                                           // Only strictly above MIN_HOURS are donors — exactly-at-threshold lines are NOT donors
                                           const donors = liveLines.filter(l => l.hours > MIN_HOURS);
                                           const totalExcess = donors.reduce((s, l) => s + (l.hours - MIN_HOURS), 0);
                                           const deficitLines = liveLines.filter(l => l.hours < MIN_HOURS);
                                           const deficit = deficitLines.reduce((s, l) => s + (MIN_HOURS - l.hours), 0);
                                           const newTargets: Record<string, number> = {};
                                           const toActKey2 = (code: string) => { const p = (code ?? '').trim().split(/\s+/); return p.length >= 3 ? p[1] : code; };
                                           // Initialize all live lines to their current hours
                                           liveLines.forEach(l => { newTargets[toActKey2(l.code)] = l.hours; });
                                           if (totalExcess <= 0) {
                                             // Not enough excess — leave as-is, will fall back to merge
                                           } else {
                                             const actualDeficit = Math.min(deficit, totalExcess);
                                             // Raise deficit lines to MIN_HOURS (ceil to whole number)
                                             deficitLines.forEach(l => {
                                               const need = MIN_HOURS - l.hours;
                                               const raw = l.hours + Math.min(need, need * (actualDeficit / deficit));
                                               newTargets[toActKey2(l.code)] = Math.ceil(raw);
                                             });
                                             // Compute hours actually added after rounding
                                             const actualAdded = deficitLines.reduce(
                                               (sum, l) => sum + (newTargets[toActKey2(l.code)] - l.hours), 0
                                             );
                                             // Reduce donor lines proportional to their EXCESS (not total hours)
                                             // This ensures exactly-at-threshold lines are never touched
                                             donors.forEach(l => {
                                               const excess = l.hours - MIN_HOURS;
                                               const contribution = excess * (actualAdded / totalExcess);
                                               // Floor but never below MIN_HOURS
                                               newTargets[toActKey2(l.code)] = Math.max(MIN_HOURS, Math.floor(l.hours - contribution));
                                             });
                                             // Fix residual: absorb rounding drift into largest-excess donor
                                             // but never push it below MIN_HOURS
                                             const allLines = [...deficitLines, ...donors];
                                             const rebalanceNet = allLines.reduce(
                                               (sum, l) => sum + (newTargets[toActKey2(l.code)] - l.hours), 0
                                             );
                                             if (Math.abs(rebalanceNet) > 0.01 && donors.length > 0) {
                                               const largestDonor = [...donors].sort((a, b) => b.hours - a.hours)[0];
                                               const key = toActKey2(largestDonor.code);
                                               const adjusted = Math.round(newTargets[key] - rebalanceNet);
                                               // Only absorb if it doesn't push below MIN_HOURS
                                               newTargets[key] = Math.max(MIN_HOURS, adjusted);
                                             }
                                           }
                                           setRedistributeAdjustments(prev => ({ ...prev, [mergeKey]: newTargets }));
                                         };
                                        return (
                                          <div className="flex flex-col gap-1 mt-2 border-t border-border pt-2">
                                            {row.lines.map((line) => {
                                              const target = getTarget(line);
                                              const delta = target - line.hours;
                                              return (
                                                <div key={line.code} className="flex items-center gap-1 text-xs">
                                                  <span className="font-mono w-36 truncate text-muted-foreground">{line.code}</span>
                                                  <span className="font-mono w-12 text-right text-foreground">{line.hours.toFixed(1)}h</span>
                                                  <span className="text-muted-foreground px-1">→</span>
                                                  <input
                                                    type="number"
                                                    step={1}
                                                    value={target === line.hours && !(mergeKey in targets) ? '' : parseFloat(target.toFixed(0))}
                                                    placeholder={line.hours.toFixed(0)}
                                                    onChange={(e) => {
                                                      const val = e.target.value === '' ? line.hours : parseFloat(e.target.value) || 0;
                                                      setRedistributeAdjustments((prev) => ({
                                                        ...prev,
                                                        [mergeKey]: { ...(prev[mergeKey] ?? {}), [(() => { const p = (line.code ?? '').trim().split(/\s+/); return p.length >= 3 ? p[1] : line.code; })()]: val },
                                                      }));
                                                    }}
                                                    className="w-16 bg-background border border-border rounded px-1 py-0.5 text-xs text-center"
                                                  />
                                                  <span className="font-mono w-20 text-right text-muted-foreground">
                                                    ({delta > 0 ? '+' : ''}{delta.toFixed(0)}h)
                                                  </span>
                                                </div>
                                              );
                                            })}
                                            <div className="flex items-center gap-2 mt-1">
                                              {isBalanced ? (
                                                <span className="text-xs font-semibold text-green-500">✓ Balanced</span>
                                              ) : netDelta > 0 ? (
                                                <span className="text-xs font-semibold text-amber-400">+{netDelta.toFixed(0)}h over — reduce some lines</span>
                                              ) : (
                                                <span className="text-xs font-semibold text-amber-400">{netDelta.toFixed(0)}h under — increase some lines</span>
                                              )}
                                              <button
                                                type="button"
                                                onClick={handleAutoRebalance}
                                                className="text-xs text-primary hover:underline font-medium ml-auto"
                                              >
                                                Auto-Rebalance
                                              </button>
                                            </div>
                                            {row.lines.some(l => l.hours < MIN_HOURS) && (() => {
                                              const donors = row.lines.filter(l => l.hours > MIN_HOURS);
                                              const totalExcess = donors.reduce((s, l) => s + (l.hours - MIN_HOURS), 0);
                                              const deficit = row.lines.reduce((s, l) => s + Math.max(0, MIN_HOURS - l.hours), 0);
                                              if (totalExcess < deficit) {
                                                return <span className="text-xs text-amber-400 mt-0.5">⚠ Not enough excess hours for full rebalance</span>;
                                              }
                                              return null;
                                            })()}
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground italic">
                                        <span className="inline-block w-2 h-2 rounded-full bg-muted-foreground/40" />
                                        no merge applied
                                      </span>
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  {isSaved ? (() => {
                                    const savedMerge = savedMergesData?.find(
                                      m => (m.sec_code || '').trim() === (row.sec || '').trim() &&
                                           (m.cost_head || '').trim() === (row.head || '').trim()
                                    );
                                    const action = savedMerge ? getSavedAction(savedMerge) : '__merge__';
                                    const isRedistribute = action === '__redistribute__';
                                    const isKeep = action === '__keep__';
                                    const isReassign = action !== '__merge__' && !isRedistribute && !isKeep;

                                    return inapplicableSavedKeys.has(`${(row.sec || '').trim()}|${(row.head || '').trim()}`) ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-amber-500 text-sm font-medium">⚠ Saved but unresolved</span>
                                        <span className="text-xs text-muted-foreground">Source codes no longer exist</span>
                                        <button
                                          onClick={() => handleUndoMerge(row.sec, row.head)}
                                          className="text-xs text-blue-500 hover:text-blue-700 underline"
                                        >
                                          Clear &amp; remap
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-green-400 text-sm font-medium">
                                          {isKeep
                                            ? '↔ Kept as-is'
                                            : isRedistribute
                                            ? `⇄ Redistribute — ${(row.sec || '').trim()} 0000 ${(row.head || '').trim()}`
                                            : isReassign
                                            ? `→ Reassign to ${(row.sec || '').trim()} ${action}`
                                            : `⊕ Merge — ${(row.sec || '').trim()} 0000 ${(row.head || '').trim()}`}
                                        </span>
                                        {isRedistribute && savedMerge?.redistribute_adjustments && (() => {
                                          const adjustments = savedMerge.redistribute_adjustments as Record<string, number>;
                                          return (
                                            <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                                              {Object.entries(adjustments).map(([act, delta]) => (
                                                <span
                                                  key={act}
                                                  className={`text-xs font-mono ${
                                                    (delta as number) > 0 ? 'text-green-400' : (delta as number) < 0 ? 'text-red-400' : 'text-muted-foreground'
                                                  }`}
                                                >
                                                  {act}: {(delta as number) > 0 ? '+' : ''}{delta as number}h
                                                </span>
                                              ))}
                                            </div>
                                          );
                                        })()}
                                        <button
                                          onClick={() => handleUndoMerge(row.sec, row.head)}
                                          disabled={undoingKey === `${(row.sec || '').trim()}|${(row.head || '').trim()}`}
                                          className={cn(
                                            'ml-1 flex items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors',
                                            undoingKey === `${(row.sec || '').trim()}|${(row.head || '').trim()}` && 'opacity-50 cursor-not-allowed'
                                          )}
                                        >
                                          <Undo2 className="h-3 w-3" />
                                          {undoingKey === `${(row.sec || '').trim()}|${(row.head || '').trim()}` ? 'Undoing...' : 'Undo'}
                                        </button>
                                      </div>
                                    );
                                  })() : consolidations[mergeKey] && reassignTargets[mergeKey] === '__redistribute__' ? (() => {
                                    const targets = redistributeAdjustments[mergeKey] ?? {};
                                    const toActKey3 = (code: string) => { const p = (code ?? '').trim().split(/\s+/); return p.length >= 3 ? p[1] : code; };
                                    const getTarget = (line: typeof row.lines[0]) => targets[toActKey3(line.code)] ?? targets[line.code] ?? line.hours;
                                    const netDelta = row.lines.reduce((s, l) => s + (getTarget(l) - l.hours), 0);
                                    if (Math.abs(netDelta) > 0.01) {
                                      return <span className="text-amber-400 text-xs">Adjust to balance</span>;
                                    }
                                    const changed = row.lines.filter(l => Math.abs(getTarget(l) - l.hours) > 0.01);
                                    if (changed.length === 0) return <span className="text-muted-foreground text-xs">No change</span>;
                                    return (
                                      <div className="flex flex-col gap-0.5">
                                        {changed.map((line) => {
                                          const target = getTarget(line);
                                          return (
                                            <div key={line.code} className="text-xs font-mono">
                                              <span className="text-green-500">{line.code}: {target.toFixed(1)}h</span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })() : consolidations[mergeKey] ? (
                                    <span className={reassignTargets[mergeKey] === '__keep__' || reassignTargets[mergeKey] === '__reassign__' ? 'text-muted-foreground' : 'text-green-400'}>
                                      {reassignTargets[mergeKey] === '__keep__'
                                        ? 'Keeping as-is'
                                        : reassignTargets[mergeKey] === '__reassign__'
                                        ? 'Select a target →'
                                        : reassignTargets[mergeKey] && reassignTargets[mergeKey] !== '__merge__'
                                        ? `→ ${row.sec} * ${reassignTargets[mergeKey]}`
                                        : `${row.sec} 0000 ${row.head}`}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                              {isSaved && (() => {
                                const historyProps = buildCodeHistoryProps(row.sec, row.head, row.combinedHours);
                                if (!historyProps) return null;
                                const mergeHistKey = `merge-${mergeKey}`;
                                return (
                                  <CodeHistoryDetail
                                    sec={historyProps.sec}
                                    head={historyProps.head}
                                    sourceLines={historyProps.sourceLines}
                                    actionType={historyProps.actionType}
                                    reassignTarget={historyProps.reassignTarget}
                                    redistributeDeltas={historyProps.redistDeltas}
                                    targetEntries={historyProps.targetEntries}
                                    finalHours={historyProps.combinedHours}
                                    isOpen={expandedHistoryKeys.has(mergeHistKey)}
                                    onToggle={() => {
                                      setExpandedHistoryKeys(prev => {
                                        const next = new Set(prev);
                                        if (next.has(mergeHistKey)) next.delete(mergeHistKey);
                                        else next.add(mergeHistKey);
                                        return next;
                                      });
                                    }}
                                    colSpan={6}
                                  />
                                );
                              })()}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {/* Merge tab footer */}
                      {(() => {
                        const mergeKeys = Object.entries(consolidations)
                          .filter(([k, v]) => v && mergeGroups.some(g => g.key === k) && !savedMergeKeySet.has(k));
                        const readyCount = mergeKeys.length;
                        return (
                          <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                            <span className="text-xs text-muted-foreground">
                              {readyCount} selected actions
                            </span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => {
                                  const cleared = { ...consolidations };
                                  mergeGroups.forEach(g => { delete cleared[g.key]; });
                                  setConsolidations(cleared);
                                }}
                                className="text-xs text-muted-foreground hover:text-foreground underline bg-transparent border-none cursor-pointer"
                              >
                                Clear Selections
                              </button>
                              <Button
                                onClick={handleConsolidate}
                                disabled={readyCount === 0 || saveMergeMutation.isPending}
                                size="sm"
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                {saveMergeMutation.isPending ? 'Saving…' : `Apply ${readyCount > 0 ? readyCount + ' ' : ''}Merge${readyCount !== 1 ? 's' : ''}`}
                              </Button>
                            </div>
                          </div>
                        );
                      })()}
                      </>
                    )
                  )}

                  {/* ── STANDALONE CODES TAB ── */}
                  {smallCodeTab === 'standalone' && (
                    standaloneGroups.length === 0 && inExportRows.length === 0 && savedOnlyRows.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        No standalone codes below the hour threshold.
                      </p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <p className="text-xs text-muted-foreground">
                            Single-entry codes below the minimum. Select rows to reassign their hours to another cost head in the same section.
                          </p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">Min Hours:</Label>
                              <Input
                                type="number"
                                min={1}
                                max={40}
                                step={1}
                                value={minHoursThreshold}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 8;
                                  const clamped = Math.max(1, Math.min(40, val));
                                  // Route through prop callback — Index.tsx is the
                                  // single owner of consolidationThresholds. The
                                  // legacy `smallCodeMinHours` localStorage write
                                  // is intentionally gone; the seed migration in
                                  // Index.tsx already drained it on first load.
                                  onConsolidationThresholdsChange({
                                    ...consolidationThresholds,
                                    smallLine: clamped,
                                  });
                                }}
                                className="h-7 w-14 text-xs font-mono"
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">Filter:</span>
                            <Select
                              value={standaloneFilter}
                              onValueChange={(v) => setStandaloneFilter(v as typeof standaloneFilter)}
                            >
                              <SelectTrigger className="h-7 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">All (&lt; {minHoursThreshold}h)</SelectItem>
                                <SelectItem value="open">Open only</SelectItem>
                                <SelectItem value="saved">Saved only</SelectItem>
                                
                                <SelectItem value="residual">Residual (post-action)</SelectItem>
                                <SelectItem value="in-export">In Export ({totalSmallInExport})</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Round 2 residual badge */}
                          {(() => {
                            const openPass1 = standaloneGroups.filter(g => !savedMergeKeySet.has(g.key)).length;
                            const round2Count = residualRows.length;

                            const openPass1Badge = openPass1 > 0 ? (
                              <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700">
                                {openPass1} code{openPass1 !== 1 ? 's' : ''} need action below
                              </span>
                            ) : null;

                            const round2Badge = round2Count === 0
                              ? (openPass1 === 0
                                  ? <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-700">✓ All resolved</span>
                                  : null)
                              : <button
                                  onClick={() => {
                                    setSmallCodeTab('standalone');
                                    setStandaloneFilter('residual');
                                  }}
                                  className="rounded-full px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                >
                                  ⚠ {round2Count} code{round2Count !== 1 ? 's' : ''} still under {minHoursThreshold}h after actions
                                </button>;

                            return <div className="flex items-center gap-2">{openPass1Badge}{round2Badge}</div>;
                          })()}
                          {(() => {
                            const unsavedAutoCount = Object.keys(standaloneAutoSuggestions ?? {})
                              .filter(key => !savedMergeKeySet.has(key)).length;
                            return unsavedAutoCount > 0 ? (
                            <button
                              onClick={() => {
                                const newTargets: Record<string, string> = { ...reassignTargets };
                                const newConsolidations: Record<string, boolean> = { ...consolidations };
                                let count = 0;
                                Object.entries(standaloneAutoSuggestions).forEach(([key, suggestion]) => {
                                  const alreadySaved = savedMergeKeySet.has(key);
                                  if (!alreadySaved) {
                                    newTargets[key] = suggestion.targetHead;
                                    newConsolidations[key] = true;
                                    count++;
                                  }
                                });
                                setReassignTargets(newTargets);
                                setConsolidations(newConsolidations);
                                toast({ title: `${count} codes auto-targeted`, description: 'Review suggestions below then click Save to apply.' });
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              ⚡ Auto-resolve ({unsavedAutoCount})
                            </button>
                            ) : null;
                          })()}
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <Checkbox
                                  checked={(() => {
                                    const rows = standaloneFilter === 'in-export'
                                      ? inExportRows.filter(r => !savedMergeKeySet.has(r.key))
                                      : standaloneGroups.filter(r => !savedMergeKeySet.has(r.key));
                                    return rows.length > 0 && rows.every(r => consolidations[r.key]);
                                  })()}
                                  onCheckedChange={(checked) => {
                                    const next: Record<string, boolean> = {};
                                    const rows = standaloneFilter === 'in-export' ? inExportRows : standaloneGroups;
                                    rows.forEach((row) => {
                                      if (!savedMergeKeySet.has(row.key)) {
                                        next[row.key] = !!checked;
                                        if (checked) autoInitRow(row.key);
                                      }
                                    });
                                    setConsolidations((prev) => ({ ...prev, ...next }));
                                  }}
                                />
                              </TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead className="text-right">Hours</TableHead>
                              <TableHead>Reassign To</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {standaloneFilter === 'residual' ? (
                              residualRows.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                                    No residual codes found — all codes are above {minHoursThreshold}h after actions.
                                  </TableCell>
                                </TableRow>
                              ) : residualRows.map((row) => {
                                const mergeKey = row.key;
                                const sameSECHeads = Object.keys(finalLaborSummary ?? {})
                                  .map((k) => {
                                    const parts = k.trim().split(/\s+/);
                                    return { key: k, sec: parts[0], act: parts[1], head: parts.slice(2).join(' ') };
                                  })
                                  .filter((p) => p.sec === row.sec && p.head !== row.head);
                                return (
                                  <TableRow key={mergeKey} className="border-l-2 border-l-amber-400">
                                    <TableCell>
                                      <Checkbox
                                        checked={!!consolidations[mergeKey]}
                                        onCheckedChange={(checked) => {
                                          setConsolidations((prev) => ({ ...prev, [mergeKey]: !!checked }));
                                          if (checked) autoInitRow(mergeKey);
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell className="font-mono font-bold text-amber-500">
                                      {row.lines[0].code}
                                      <div className="text-xs text-amber-400 font-normal mt-0.5">Round 2</div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-semibold text-destructive">
                                      {row.combinedHours.toFixed(1)}h
                                    </TableCell>
                                    <TableCell>
                                      {consolidations[mergeKey] ? (
                                        <div>
                                          <select
                                            className="text-xs bg-background border border-border rounded px-1 py-0.5"
                                            value={reassignTargets[mergeKey] ?? '__reassign__'}
                                            onChange={(e) => {
                                              setReassignTargets((prev) => ({ ...prev, [mergeKey]: e.target.value }));
                                            }}
                                          >
                                            <option value="__reassign__" disabled>— select target —</option>
                                            {sameSECHeads
                                              .filter((p, i, arr) => arr.findIndex(x => x.head === p.head) === i)
                                              .map((p) => (
                                              <option key={p.key} value={p.head}>{p.head}</option>
                                            ))}
                                            <option value="__keep__">Keep as-is</option>
                                          </select>
                                          {(() => {
                                            const target = reassignTargets[mergeKey];
                                            if (!target || target === '__reassign__' || target === '__keep__') return null;
                                            const targetEntry = Object.entries(finalLaborSummary ?? {}).find(([k]) => {
                                              const parts = k.trim().split(/\s+/);
                                              return parts[0] === row.sec && parts.slice(2).join(' ') === target;
                                            });
                                            const targetHours = targetEntry ? (targetEntry[1].hours ?? 0) : 0;
                                            const projected = row.combinedHours + targetHours;
                                            return projected < minHoursThreshold ? (
                                              <div className="text-xs text-amber-500 mt-0.5">⚠ Still {projected.toFixed(1)}h after reassignment</div>
                                            ) : (
                                              <div className="text-xs text-green-500 mt-0.5">✓ Will be {projected.toFixed(1)}h</div>
                                            );
                                          })()}
                                        </div>
                                      ) : (
                                        <div className="flex flex-col gap-1">
                                          <span className="text-xs text-muted-foreground italic">keeps original code</span>
                                          <div className="flex gap-2 mt-1">
                                            <button
                                              onClick={() => {
                                                setConsolidations(prev => ({ ...prev, [mergeKey]: true }));
                                                autoInitRow(mergeKey);
                                              }}
                                              className="text-xs text-blue-600 underline hover:text-blue-800"
                                            >
                                              Reassign →
                                            </button>
                                          </div>
                                        </div>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <span className="text-xs text-amber-500 font-medium">⚠ Round 2 residual</span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })
                            ) : (() => {
                              const sourceRows = standaloneFilter === 'in-export'
                                ? (() => {
                                    const mapped = inExportRows.map(ieRow => {
                                      const found = standaloneGroups.find(g => g.key === ieRow.key)
                                        || savedOnlyRows.find(r => r.key === ieRow.key);
                                      return {
                                        ...(found ?? {
                                          key: ieRow.key,
                                          lines: [{ code: ieRow.displayKey }],
                                          sec: ieRow.sec,
                                          head: ieRow.head,
                                        }),
                                        // ALWAYS use finalLaborSummary hours — never the pre-merge hours from standaloneGroups
                                        combinedHours: ieRow.combinedHours,
                                      };
                                    });
                                    // Deduplicate by key, summing hours for entries with multiple activity codes
                                    const seen = new Map<string, typeof mapped[0]>();
                                    mapped.forEach(row => {
                                      if (seen.has(row.key)) {
                                        const existing = seen.get(row.key)!;
                                        existing.combinedHours = (existing.combinedHours ?? 0) + (row.combinedHours ?? 0);
                                      } else {
                                        seen.set(row.key, { ...row });
                                      }
                                    });
                                    return Array.from(seen.values());
                                  })()
                                : [...standaloneGroups, ...savedOnlyRows.filter((r) => {
                                    const saved = (savedMergesData ?? []).find(
                                      (m) => m.sec_code === r.sec && m.cost_head === r.head
                                    );
                                    return saved && saved.reassign_to_head !== null &&
                                      !(saved.redistribute_adjustments &&
                                        Object.keys(typeof saved.redistribute_adjustments === 'object' && saved.redistribute_adjustments !== null ? saved.redistribute_adjustments : {}).length > 0);
                                  })];
                              if (sourceRows.length === 0) {
                                return (
                                  <TableRow>
                                    <TableCell colSpan={5} className="text-center text-xs text-muted-foreground py-6">
                                      {standaloneFilter === 'in-export'
                                        ? `No codes under ${minHoursThreshold}h in the final export.`
                                        : 'No matching rows.'}
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                              return sourceRows.filter((row) => {
                                if (standaloneFilter === 'in-export') return true;
                                const isSaved = savedMergeKeySet.has(row.key);
                                if (standaloneFilter === 'open') return !isSaved;
                                if (standaloneFilter === 'saved') return isSaved;
                                return true;
                                return true;
                              }).map((row) => {
                              const mergeKey = row.key;
                              const isSaved = savedMergeKeySet.has(mergeKey);
                              const line = row.lines[0];
                              const sameSECHeads = Object.keys(finalLaborSummary ?? {})
                                .map((k) => {
                                  const parts = k.trim().split(/\s+/);
                                  return { key: k, sec: parts[0], act: parts[1], head: parts.slice(2).join(' ') };
                                })
                                .filter((p) => p.sec === row.sec && p.head !== row.head);
                              return (
                                <React.Fragment key={mergeKey}>
                                <TableRow className={isSaved ? 'opacity-50' : ''}>
                                  <TableCell>
                                    {isSaved ? (
                                      <Checkbox checked disabled />
                                    ) : (
                                      <Checkbox
                                        checked={!!consolidations[mergeKey]}
                                        onCheckedChange={(checked) => {
                                          setConsolidations((prev) => ({ ...prev, [mergeKey]: !!checked }));
                                          if (checked) autoInitRow(mergeKey);
                                        }}
                                      />
                                    )}
                                  </TableCell>
                                  <TableCell className="font-mono font-bold text-orange-400">
                                    {line.code}
                                    {isSaved && <span className="ml-2 text-xs text-green-500 font-normal">✓ Saved</span>}
                                  </TableCell>
                                  <TableCell className="text-right font-mono font-semibold text-destructive">
                                    {row.combinedHours.toFixed(1)}h
                                    {standaloneAutoSuggestions[mergeKey] && !isSaved && (() => {
                                      const suggestion = standaloneAutoSuggestions[mergeKey];
                                      return (
                                         <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                          <span className="text-xs text-blue-500 font-normal">
                                            ⚡ <span className="font-mono font-semibold">{suggestion.targetHead}</span>
                                          </span>
                                          <span className="text-xs text-muted-foreground font-normal">— {suggestion.reason}</span>
                                          <button
                                            onClick={() => {
                                              setReassignTargets(prev => ({ ...prev, [mergeKey]: suggestion.targetHead }));
                                              setConsolidations(prev => ({ ...prev, [mergeKey]: true }));
                                            }}
                                            className="text-xs text-blue-600 hover:text-blue-800 underline font-normal"
                                          >
                                            Apply
                                          </button>
                                        </div>
                                      );
                                    })()}
                                  </TableCell>
                                  <TableCell>
                                    {isSaved ? (() => {
                                      const savedMerge = savedMergesData?.find(m =>
                                        (m.sec_code || '').trim() === row.sec &&
                                        (m.cost_head || '').trim() === row.head
                                      );
                                      if (!savedMerge) return null;
                                      const action = getSavedAction(savedMerge);
                                      const isRedistribute = action === '__redistribute__';
                                      const isKeep = action === '__keep__';
                                      const isMerge = action === '__merge__';
                                      const isReassign = !isRedistribute && !isKeep && !isMerge;
                                      return (
                                        <span className="text-xs font-mono text-green-400">
                                          {isKeep && '↔ Kept as-is'}
                                          {isMerge && `⊕ Merged → ${row.sec} 0000 ${row.head}`}
                                          {isReassign && `→ Reassigned to ${row.sec} ${action}`}
                                          {isRedistribute && '⇄ Redistributed'}
                                        </span>
                                      );
                                    })()
                                    : (consolidations[mergeKey]) ? (
                                      <div>
                                        <select
                                          className="text-xs bg-background border border-border rounded px-1 py-0.5"
                                          value={reassignTargets[mergeKey] ?? '__reassign__'}
                                          onChange={(e) => {
                                            setReassignTargets((prev) => ({ ...prev, [mergeKey]: e.target.value }));
                                          }}
                                        >
                                          <option value="__reassign__" disabled>— select target —</option>
                                          {sameSECHeads
                                            .filter((p, i, arr) => arr.findIndex(x => x.head === p.head) === i)
                                            .map((p) => (
                                            <option key={p.key} value={p.head}>{p.head}</option>
                                          ))}
                                          
                                          <option value="__keep__">Keep as-is</option>
                                        </select>
                                        {/* Pre-action projection warning */}
                                        {(() => {
                                          const target = reassignTargets[mergeKey];
                                          if (!target || target === '__reassign__' || target === '__keep__' || target === '__merge__') return null;
                                          const targetEntry = Object.entries(finalLaborSummary ?? {}).find(([k]) => {
                                            const parts = k.trim().split(/\s+/);
                                            return parts[0] === row.sec && parts.slice(2).join(' ') === target;
                                          });
                                          const targetHours = targetEntry ? (targetEntry[1].hours ?? 0) : 0;
                                          const projected = row.combinedHours + targetHours;
                                          return projected < minHoursThreshold ? (
                                            <div className="text-xs text-amber-500 mt-0.5">⚠ Still {projected.toFixed(1)}h after reassignment</div>
                                          ) : (
                                            <div className="text-xs text-green-500 mt-0.5">✓ Will be {projected.toFixed(1)}h</div>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-1">
                                        <span className="text-xs text-muted-foreground italic">keeps original code</span>
                                        <div className="flex gap-2 mt-1">
                                          <button
                                            onClick={() => {
                                              setConsolidations(prev => ({ ...prev, [mergeKey]: true }));
                                              autoInitRow(mergeKey);
                                            }}
                                            className="text-xs text-blue-600 underline hover:text-blue-800"
                                          >
                                            Reassign →
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {(() => {
                                      const isChecked = !!consolidations[mergeKey];
                                      const target = reassignTargets[mergeKey];
                                      const hasTarget = !!target && target !== '__reassign__' && target !== '';

                                      if (isSaved) {
                                        const savedEntry = savedMergesData?.find(
                                          m => (m.sec_code || '').trim() === row.sec && (m.cost_head || '').trim() === row.head
                                        );
                                        const action = savedEntry ? getSavedAction(savedEntry) : null;
                                        const isKept = action === '__keep__';
                                        const isMerge = action === '__merge__';
                                        const isRedist = action === '__redistribute__';
                                        return (
                                          <div className="flex items-center gap-2">
                                            <span className={`text-xs ${isKept ? 'text-blue-400' : 'text-green-500'}`}>
                                              {isKept ? '✓ Kept' : isMerge ? '✓ Merged' : '✓ Saved'}
                                            </span>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className={`h-5 px-1.5 text-xs ${undoingKey === `${(row.sec || '').trim()}|${(row.head || '').trim()}` ? 'opacity-50 cursor-not-allowed' : ''}`}
                                              disabled={undoingKey === `${(row.sec || '').trim()}|${(row.head || '').trim()}`}
                                              onClick={() => handleUndoMerge(row.sec, row.head)}
                                            >
                                              <Undo2 className="h-3 w-3 mr-1" /> {undoingKey === `${(row.sec || '').trim()}|${(row.head || '').trim()}` ? 'Undoing...' : 'Undo'}
                                            </Button>
                                          </div>
                                        );
                                      }
                                      if (!isChecked) return (
                                        <span className="text-xs text-amber-500 font-medium">
                                          ⚠ Needs action — check to assign or accept
                                        </span>
                                      );
                                      if (!hasTarget) return <span className="text-xs text-orange-400">Select target</span>;
                                      return <span className="text-xs text-primary font-semibold">Ready</span>;
                                    })()}
                                  </TableCell>
                                </TableRow>
                                {/* Code History expandable detail */}
                                {isSaved && (() => {
                                  const savedMerge = savedMergesData?.find(m =>
                                    (m.sec_code || '').trim() === row.sec &&
                                    (m.cost_head || '').trim() === row.head
                                  );
                                  if (!savedMerge) return null;
                                  const action = getSavedAction(savedMerge);
                                  const actionType = action === '__redistribute__' ? 'redistribute' as const
                                    : action === '__keep__' ? 'keep' as const
                                    : action === '__merge__' ? 'merge' as const
                                    : 'reassign' as const;

                                  // Pre-merge source lines from adjustedLaborSummary
                                  const premerge = calculations?.adjustedLaborSummary ?? {};
                                  const sourceLines = Object.values(premerge)
                                    .filter((entry: any) => {
                                      const parts = (entry.code ?? '').trim().split(/\s+/);
                                      const s = parts[0] ?? '';
                                      const h = parts.slice(2).join(' ') || '';
                                      return s === row.sec && h === row.head;
                                    })
                                    .map((entry: any) => ({
                                      code: entry.code ?? '',
                                      hours: entry.hours ?? 0,
                                      act: (entry.code ?? '').trim().split(/\s+/)[1] ?? '0000',
                                    }));

                                  // Redistribute deltas
                                  const redistDeltas = savedMerge.redistribute_adjustments &&
                                    typeof savedMerge.redistribute_adjustments === 'object'
                                    ? savedMerge.redistribute_adjustments as Record<string, number>
                                    : null;

                                  // Target entries from finalLaborSummary
                                  const targetHead = actionType === 'reassign' ? action : row.head;
                                  const targetEntries = Object.entries(finalLaborSummary ?? {})
                                    .filter(([k]) => {
                                      const parts = k.trim().split(/\s+/);
                                      return parts[0] === row.sec && parts.slice(2).join(' ') === targetHead;
                                    })
                                    .map(([code, entry]) => ({ code, hours: entry.hours ?? 0 }));

                                  return (
                                    <CodeHistoryDetail
                                      sec={row.sec}
                                      head={row.head}
                                      sourceLines={sourceLines}
                                      actionType={actionType}
                                      reassignTarget={actionType === 'reassign' ? action : null}
                                      redistributeDeltas={redistDeltas}
                                      targetEntries={targetEntries}
                                      finalHours={row.combinedHours}
                                      isOpen={expandedHistoryKeys.has(mergeKey)}
                                      onToggle={() => {
                                        setExpandedHistoryKeys(prev => {
                                          const next = new Set(prev);
                                          if (next.has(mergeKey)) next.delete(mergeKey);
                                          else next.add(mergeKey);
                                          return next;
                                        });
                                      }}
                                      colSpan={5}
                                    />
                                  );
                                })()}
                              </React.Fragment>
                              );
                            });

                            })()}
                          </TableBody>
                        </Table>
                        {/* Standalone tab footer */}
                        {(() => {
                          const standaloneKeys = standaloneGroups.map(g => g.key);
                          const checkedKeys = standaloneKeys.filter(k => consolidations[k] && !savedMergeKeySet.has(k));
                          const readyKeys = checkedKeys.filter(k => {
                            const t = reassignTargets[k];
                            return t && t !== '__reassign__' && t !== '';
                          });
                          const selectedCount = checkedKeys.length;
                          const readyCount = readyKeys.length;

                          return (
                            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
                              <span className="text-xs text-muted-foreground">
                                {selectedCount} selected,{' '}
                                <span className={readyCount > 0 ? 'text-green-500' : 'text-orange-400'}>
                                  {readyCount} with valid targets
                                </span>
                              </span>
                              {selectedCount > 0 && readyCount === 0 && (
                                <span className="text-xs text-amber-500 mr-3">
                                  Select targets for checked rows, or use Auto-resolve
                                </span>
                              )}
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={() => {
                                    const cleared = { ...consolidations };
                                    const clearedTargets = { ...reassignTargets };
                                    standaloneKeys.forEach(k => {
                                      delete cleared[k];
                                      delete clearedTargets[k];
                                    });
                                    setConsolidations(cleared);
                                    setReassignTargets(clearedTargets);
                                  }}
                                  className="text-xs text-muted-foreground hover:text-foreground underline bg-transparent border-none cursor-pointer"
                                >
                                  Clear Selections
                                </button>
                                <Button
                                  onClick={handleConsolidate}
                                  disabled={readyCount === 0 || saveMergeMutation.isPending}
                                  size="sm"
                                  className="bg-green-600 text-white hover:bg-green-500"
                                >
                                  {saveMergeMutation.isPending ? 'Saving…' : `Apply ${readyCount > 0 ? readyCount + ' ' : ''}Reassignment${readyCount !== 1 ? 's' : ''}`}
                                </Button>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )
                  )}
                </>
              )}
          </div>
        )}

          <Separator className="my-4" />

          <div className="flex justify-between items-center text-xl">
            <span className="font-bold text-green-900 dark:text-green-100">GRAND TOTAL</span>
            <span className="font-mono font-bold text-green-900 dark:text-green-100">
              ${((Object.values(finalLaborSummary ?? {}).reduce((s, i) => s + (i.dollars ?? 0), 0) || 0) + (calculations.totalMaterialWithTax || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BudgetAdjustmentsPanel;
