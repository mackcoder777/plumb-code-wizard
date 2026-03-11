// Murray Company Budget Export System
// Provides two export types:
// 1. Budget Packet - Aggregated by cost code with Excel formulas
// 2. Audit Report - Detailed line items for internal backup

import * as XLSX from 'xlsx';
import { BudgetAdjustments } from '../components/BudgetAdjustmentsPanel';
import { BuildingSectionMapping, resolveSectionStatic, getSectionFromFloorNullable, ResolutionOptions } from '@/hooks/useBuildingSectionMappings';
import { FloorSectionMapping } from '@/hooks/useFloorSectionMappings';
import { DatasetProfile } from '@/utils/datasetProfiler';

// ============================================
// TYPES
// ============================================

export interface FloorSectionMap {
  [floorPattern: string]: string; // floor -> section code (e.g., "Club Level" -> "02")
}

export interface CategoryLaborMap {
  [categoryName: string]: string; // report_cat -> labor code (e.g., "Drains/Cleanouts" -> "DRNS")
}

export interface ExportEstimateItem {
  id: string | number;
  drawing?: string;
  system?: string;
  floor?: string;
  zone?: string;
  materialSpec?: string;
  itemType?: string;
  reportCat?: string; // Added for category-based labor mapping
  trade?: string;
  materialDesc?: string;
  materialDescription?: string;
  itemName?: string;
  size?: string;
  quantity?: number;
  listPrice?: number;
  materialDollars?: number;
  hours?: number;
  laborDollars?: number;
  // Labor cost code components
  laborSec?: string;
  laborAct?: string;
  laborCostHead?: string;
  laborDescription?: string;
  costCode?: string; // Legacy field - maps to laborCostHead
  // Material cost code
  materialCode?: string;
  materialCostCode?: string; // Legacy field - maps to materialCode
  materialCodeDescription?: string;
  // Suggested code info
  suggestedCode?: {
    section?: string;
    activity?: string;
    costHead?: string;
    description?: string;
  };
}

export interface ProjectInfo {
  jobNumber: string;
  jobName: string;
  date: Date;
  preparedBy: string;
  mceNumber?: string;
  clientReference?: string;
}

interface AggregatedLabor {
  costCode: string;
  sec: string;
  act: string;
  costHead: string;
  description: string;
  hours: number;
  laborDollars: number;
  itemCount: number;
}

interface AggregatedMaterial {
  costCode: string;
  description: string;
  materialDollars: number;
  itemCount: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get section code from floor value using floor mappings, with optional building fallback
 */
function getSectionFromFloor(
  floor: string | undefined, 
  floorMappings: FloorSectionMap, 
  drawing?: string,
  buildingMappings?: BuildingSectionMapping[],
  dbFloorMappings?: FloorSectionMapping[],
  zone?: string,
  datasetProfile?: DatasetProfile | null
): string {
  if (!floor) return '01';
  
  // If we have structured mappings, use the building-aware resolver
  if (buildingMappings && buildingMappings.length > 0 && dbFloorMappings) {
    return resolveSectionStatic(floor, drawing || '', dbFloorMappings, buildingMappings, { zone, datasetProfile });
  }
  
  // Fallback to simple floor map
  if (Object.keys(floorMappings).length === 0) return '01';
  
  const normalizedFloor = floor.toLowerCase().trim();
  
  // Try exact match first
  for (const [pattern, section] of Object.entries(floorMappings)) {
    if (pattern.toLowerCase().trim() === normalizedFloor) {
      return section;
    }
  }
  
  // Try partial match
  for (const [pattern, section] of Object.entries(floorMappings)) {
    const normalizedPattern = pattern.toLowerCase().trim();
    if (normalizedFloor.includes(normalizedPattern) || normalizedPattern.includes(normalizedFloor)) {
      return section;
    }
  }
  
  return '01'; // Default section
}

// Special value indicating category should use system mapping
const SYSTEM_MAPPING_VALUE = '__SYSTEM__';

/**
 * Get labor code from category mapping (priority over system mapping)
 * Returns null if category is set to "Use System Mapping" (__SYSTEM__)
 */
function getLaborCodeFromCategory(reportCat: string | undefined, categoryMappings: CategoryLaborMap): string | null {
  if (!reportCat || Object.keys(categoryMappings).length === 0) return null;
  
  const normalizedCat = reportCat.toLowerCase().trim();
  
  // Try exact match first
  for (const [pattern, laborCode] of Object.entries(categoryMappings)) {
    if (pattern.toLowerCase().trim() === normalizedCat) {
      // If set to __SYSTEM__, return null to defer to system mapping
      if (laborCode === SYSTEM_MAPPING_VALUE) {
        return null;
      }
      return laborCode;
    }
  }
  
  return null;
}

// ============================================
// AGGREGATION FUNCTIONS
// ============================================

/**
 * Aggregates labor data by full cost code (SEC ACT COSTHEAD)
 * @param items - Estimate items to aggregate
 * @param floorMappings - Optional floor-to-section mappings to derive section from floor
 * @param categoryMappings - Optional category-to-labor-code mappings (takes priority over item's costCode)
 */
export function aggregateLaborByCostCode(
  items: ExportEstimateItem[],
  floorMappings: FloorSectionMap = {},
  options: {
    categoryMappings?: CategoryLaborMap;
    buildingMappings?: BuildingSectionMapping[];
    dbFloorMappings?: FloorSectionMapping[];
    datasetProfile?: DatasetProfile | null;
  } = {}
): AggregatedLabor[] {
  const { categoryMappings = {}, buildingMappings = [], dbFloorMappings = [], datasetProfile = null } = options;
  const aggregated = new Map<string, AggregatedLabor>();

  items.forEach(item => {
    const hours = parseFloat(String(item.hours)) || 0;
    const laborDollars = parseFloat(String(item.laborDollars)) || 0;
    
    // Skip zero-hour items entirely
    if (hours === 0 && laborDollars === 0) return;

    // Standalone floors must always re-resolve through building-aware resolver
    const isStandalone = /^(roof|ug|crawl\s*space|site|site\s+above\s+grade|attic|penthouse)$/i
      .test((item.floor || '').trim());

    let sec: string;
    let act: string;

    if (isStandalone && item.floor && buildingMappings.length > 0) {
      sec = getSectionFromFloor(item.floor, floorMappings, item.drawing,
        buildingMappings, dbFloorMappings, item.zone, datasetProfile);
      act = item.laborAct || item.suggestedCode?.activity || '0000';
    } else {
      sec = item.laborSec || item.suggestedCode?.section;
      if (!sec && item.floor) {
        sec = getSectionFromFloor(item.floor, floorMappings, item.drawing,
          buildingMappings, dbFloorMappings, item.zone, datasetProfile);
      }
      sec = sec || '01';
      act = item.laborAct || item.suggestedCode?.activity || '0000';
    }
    
    // LABOR CODE PRIORITY:
    // 1. Category mapping (if reportCat has assigned code)
    // 2. Item's existing costCode/laborCostHead (from system mapping)
    // 3. Suggested code
    let costHead = getLaborCodeFromCategory(item.reportCat, categoryMappings);
    if (!costHead) {
      costHead = item.laborCostHead || item.costCode || item.suggestedCode?.costHead || '';
    }
    
    let description = item.laborDescription || item.suggestedCode?.description || '';

    // CRITICAL FIX: Bucket uncoded items instead of dropping them
    if (!costHead) {
      costHead = 'UNCD';
      description = 'UNCODED ITEMS';
    }
    
    const costCode = `${sec} ${act} ${costHead}`;

    if (aggregated.has(costCode)) {
      const existing = aggregated.get(costCode)!;
      existing.hours += hours;
      existing.laborDollars += laborDollars;
      existing.itemCount++;
    } else {
      aggregated.set(costCode, {
        costCode,
        sec,
        act,
        costHead,
        description,
        hours,
        laborDollars,
        itemCount: 1
      });
    }
  });

  return Array.from(aggregated.values())
    .sort((a, b) => a.costCode.localeCompare(b.costCode));
}

/**
 * Aggregates material data by material cost code
 */
export function aggregateMaterialByCostCode(items: ExportEstimateItem[]): AggregatedMaterial[] {
  const aggregated = new Map<string, AggregatedMaterial>();

  items.forEach(item => {
    const costCode = item.materialCode || item.materialCostCode || '';
    
    if (!costCode) return; // Skip items without material code
    
    const description = item.materialCodeDescription || '';
    const materialDollars = parseFloat(String(item.materialDollars)) || 0;

    if (aggregated.has(costCode)) {
      const existing = aggregated.get(costCode)!;
      existing.materialDollars += materialDollars;
      existing.itemCount++;
    } else {
      aggregated.set(costCode, {
        costCode,
        description,
        materialDollars,
        itemCount: 1
      });
    }
  });

  return Array.from(aggregated.values())
    .sort((a, b) => a.costCode.localeCompare(b.costCode));
}

/**
 * Validates that exported hours match raw item hours.
 * Logs a warning if there's a mismatch (prevents silent hour loss).
 */
function validateHoursReconciliation(
  items: ExportEstimateItem[],
  laborSummary: AggregatedLabor[]
): void {
  const rawTotal = items.reduce((sum, item) => {
    return sum + (parseFloat(String(item.hours)) || 0);
  }, 0);
  
  const exportTotal = laborSummary.reduce((sum, entry) => sum + entry.hours, 0);
  const delta = Math.abs(rawTotal - exportTotal);
  
  if (delta >= 0.1) {
    console.warn(
      `⚠️ HOURS RECONCILIATION MISMATCH: Raw ${rawTotal.toFixed(2)} hrs vs export ${exportTotal.toFixed(2)} hrs. Delta: ${delta.toFixed(2)} hrs.`
    );
  } else {
    console.log(`✓ Hours reconciliation passed: ${rawTotal.toFixed(2)} hrs`);
  }
}

// ============================================
// BUDGET PACKET EXPORT (Exact Template Match with Formulas)
// ============================================

/**
 * Exports Budget Packet matching Murray Company Budget_Packet.xls format exactly
 * Now accepts optional budgetAdjustments to use adjusted labor/material data
 * @param floorMappings - Optional floor-to-section mappings for deriving section from floor
 * @param categoryMappings - Optional category-to-labor-code mappings (takes priority over system mappings)
 */
export function exportBudgetPacket(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo,
  laborRate: number = 0,
  budgetAdjustments?: BudgetAdjustments | null,
  floorMappings: FloorSectionMap = {},
  categoryMappings: CategoryLaborMap = {},
  buildingMappings: BuildingSectionMapping[] = [],
  dbFloorMappings: FloorSectionMapping[] = []
): { laborCodes: number; materialCodes: number; totalLaborHours: number; totalLaborDollars: number; totalMaterialDollars: number; grandTotal: number } {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  // Determine data source: use Budget Adjustments if available, otherwise raw aggregation
  let laborData: Array<{ code: string; description: string; hours: number; dollars: number; rate?: number }>;
  let materialData: Array<{ code: string; description: string; amount: number }>;
  let totalLaborHours = 0;
  let totalLaborDollars = 0;
  let totalMaterialDollars = 0;

  if (budgetAdjustments && Object.keys(budgetAdjustments.adjustedLaborSummary || {}).length > 0) {
    // USE BUDGET BUILDER ADJUSTMENTS (includes FAB codes, strips already applied)
    laborData = Object.values(budgetAdjustments.adjustedLaborSummary)
      .map(item => ({
        code: item.code,
        description: item.description,
        hours: item.hours,
        dollars: item.dollars,
        rate: item.rate
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    // CRITICAL: Compute totals from the SAME data that gets written to rows
    // This ensures H55 totals always match the sum of individual rows
    totalLaborHours = laborData.reduce((sum, i) => sum + i.hours, 0);
    totalLaborDollars = laborData.reduce((sum, i) => sum + i.dollars, 0);

    // Material: Include tax directly in each code's amount (tax-inclusive amounts)
    materialData = (budgetAdjustments.materialTaxSummary || [])
      .map(item => ({
        code: item.code,
        description: item.description,
        amount: item.amount + item.taxAmount // Include tax in the material amount
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    // Total material includes tax
    totalMaterialDollars = budgetAdjustments.totalMaterialWithTax || 0;
  } else {
    // FALLBACK: Use raw item aggregation (no adjustments)
    const rawLaborSummary = aggregateLaborByCostCode(items, floorMappings, { categoryMappings, buildingMappings, dbFloorMappings });
    validateHoursReconciliation(items, rawLaborSummary);
    laborData = rawLaborSummary.map(item => ({
      code: item.costCode,
      description: item.description,
      hours: item.hours,
      dollars: item.hours * laborRate
    }));

    totalLaborHours = laborData.reduce((sum, i) => sum + i.hours, 0);
    totalLaborDollars = laborData.reduce((sum, i) => sum + i.dollars, 0);

    const rawMaterialSummary = aggregateMaterialByCostCode(items);
    materialData = rawMaterialSummary.map(item => ({
      code: item.costCode,
      description: item.description,
      amount: item.materialDollars
    }));

    totalMaterialDollars = materialData.reduce((sum, i) => sum + i.amount, 0);
  }

  // ===== FIRST HEADER SECTION (Rows 1-16) =====
  ws['D2'] = { t: 's', v: '  NEW JOB / CHANGE ORDER' };
  ws['E3'] = { t: 's', v: '   WORKSHEET' };
  
  ws['B6'] = { t: 's', v: 'JOB #:' };
  ws['C6'] = { t: 's', v: projectInfo.jobNumber };
  ws['H6'] = { t: 's', v: '  Pending Change Order (MPCO)' };
  
  ws['B7'] = { t: 's', v: 'JOB NAME:' };
  ws['C7'] = { t: 's', v: projectInfo.jobName };
  ws['H7'] = { t: 's', v: ' MCE # (s)' };
  ws['I7'] = { t: 's', v: 'Initial Budget' };
  
  ws['B8'] = { t: 's', v: 'DATE:' };
  ws['C8'] = { t: 's', v: projectInfo.date.toLocaleDateString() };
  
  ws['B9'] = { t: 's', v: 'BY:' };
  ws['C9'] = { t: 's', v: projectInfo.preparedBy };
  ws['H9'] = { t: 's', v: '  Change Order  (CO)' };
  
  ws['H10'] = { t: 's', v: ' (if PCO transfer to CO, see page 2)' };
  ws['H11'] = { t: 's', v: '     CO # ' };
  
  ws['B13'] = { t: 's', v: 'Client Change Reference:' };
  ws['D13'] = { t: 's', v: projectInfo.clientReference || '' };
  ws['G13'] = { t: 's', v: 'X' };
  ws['H13'] = { t: 's', v: 'Original Budget' };
  
  ws['H16'] = { t: 's', v: 'APPROVAL:' };

  // ===== LABOR BREAKDOWN SECTION (Rows 17-55) =====
  ws['B17'] = { t: 's', v: 'LABOR BREAKDOWN' };
  
  // Row 18: Column headers
  ws['B18'] = { t: 's', v: 'Cost Code' };
  ws['D18'] = { t: 's', v: 'DESCRIPTION' };
  ws['H18'] = { t: 's', v: ' # of HOURS' };
  ws['I18'] = { t: 's', v: 'RATE' };
  ws['J18'] = { t: 's', v: 'TOTAL COST' };

  // Labor data: dynamic row count based on actual data
  const LABOR_START_ROW = 19;
  // Calculate needed rows: count items + section headers
  const sectionCount = new Set(laborData.map(item => parseLaborCode(item.code).section)).size;
  const neededLaborRows = laborData.length + sectionCount;
  const LABOR_END_ROW = LABOR_START_ROW + neededLaborRows; // Dynamic end
  
  // Parse and normalize labor codes, group by section
  const parsedLabor = laborData.map(item => {
    const parsed = parseLaborCode(item.code);
    // Use parsed code's description lookup, falling back to item's description
    const description = getLaborCostHeadDescription(parsed.costHead) || item.description || parsed.costHead;
    return {
      ...item,
      section: parsed.section,
      activity: parsed.activity,
      costHead: parsed.costHead,
      normalizedCode: parsed.fullCode,
      normalizedDescription: description
    };
  });
  
  // Group by section
  const sectionGroups = new Map<string, typeof parsedLabor>();
  parsedLabor.forEach(item => {
    const section = item.section;
    if (!sectionGroups.has(section)) {
      sectionGroups.set(section, []);
    }
    sectionGroups.get(section)!.push(item);
  });
  
  // Sort sections
  const sortedSections = Array.from(sectionGroups.keys()).sort();
  
  let laborRowIndex = 0;
  const laborDataRows: number[] = []; // Track rows with actual hour data for SUM formulas
  sortedSections.forEach(section => {
    const sectionItems = sectionGroups.get(section)!;
    
    // Add section header
    const headerRow = LABOR_START_ROW + laborRowIndex;
    const sectionDesc = getSectionDescription(section);
    ws[`B${headerRow}`] = { t: 's', v: `SECTION ${section} - ${sectionDesc}` };
    laborRowIndex++;
    
    // Add items in this section
    sectionItems.forEach(item => {
      const row = LABOR_START_ROW + laborRowIndex;
      
      ws[`B${row}`] = { t: 's', v: item.normalizedCode };
      ws[`D${row}`] = { t: 's', v: item.normalizedDescription };
      ws[`H${row}`] = { t: 'n', v: Math.round(item.hours * 10) / 10, z: '#,##0.0' };
      
      const displayRate = item.rate ?? laborRate;
      if (displayRate > 0) {
        ws[`I${row}`] = { t: 'n', v: displayRate, z: '#,##0.00' };
      }
      
      ws[`J${row}`] = { t: 'n', v: Math.round(item.dollars * 100) / 100, z: '#,##0' };
      laborDataRows.push(row); // Track this row for SUM formula
      laborRowIndex++;
    });
  });

  // TOTALS row: dynamic position right after data
  const TOTALS_ROW = LABOR_START_ROW + laborRowIndex + 1;
  
  // Use SUM formulas so totals ALWAYS match the visible rows
  const hoursSumParts = laborDataRows.map(r => `H${r}`).join('+');
  const dollarsSumParts = laborDataRows.map(r => `J${r}`).join('+');
  
  ws[`E${TOTALS_ROW}`] = { t: 's', v: 'TOTALS' };
  ws[`H${TOTALS_ROW}`] = { 
    t: 'n', 
    f: hoursSumParts || '0',
    v: Math.round(laborData.reduce((s, i) => s + i.hours, 0) * 10) / 10,
    z: '#,##0.0' 
  };
  ws[`J${TOTALS_ROW}`] = { 
    t: 'n', 
    f: dollarsSumParts || '0',
    v: Math.round(laborData.reduce((s, i) => s + i.dollars, 0) * 100) / 100,
    z: '#,##0' 
  };

  // ===== SECOND HEADER BLOCK - Before Material Section =====
  const HEADER2_START = TOTALS_ROW + 3;
  ws[`D${HEADER2_START}`] = { t: 's', v: '   CHANGE ORDER' };
  ws[`E${HEADER2_START + 1}`] = { t: 's', v: '   WORKSHEET' };
  
  ws[`B${HEADER2_START + 4}`] = { t: 's', v: 'JOB #:' };
  ws[`C${HEADER2_START + 4}`] = { t: 's', v: projectInfo.jobNumber };
  ws[`G${HEADER2_START + 4}`] = { t: 's', v: '0' };
  ws[`H${HEADER2_START + 4}`] = { t: 's', v: '  Pending Change Order (MPCO)' };
  
  ws[`B${HEADER2_START + 5}`] = { t: 's', v: 'JOB NAME:' };
  ws[`C${HEADER2_START + 5}`] = { t: 's', v: projectInfo.jobName };
  ws[`H${HEADER2_START + 5}`] = { t: 's', v: ' MCE # (s)' };
  ws[`I${HEADER2_START + 5}`] = { t: 's', v: 'Initial Budget' };
  
  ws[`B${HEADER2_START + 6}`] = { t: 's', v: 'DATE:' };
  ws[`C${HEADER2_START + 6}`] = { t: 's', v: projectInfo.date.toLocaleDateString() };
  
  ws[`B${HEADER2_START + 7}`] = { t: 's', v: 'BY:' };
  ws[`C${HEADER2_START + 7}`] = { t: 's', v: projectInfo.preparedBy };
  ws[`H${HEADER2_START + 7}`] = { t: 's', v: '  Change Order  (CO)' };
  
  ws[`H${HEADER2_START + 8}`] = { t: 's', v: ' (if PCO transfer to CO, see page 2)' };
  ws[`H${HEADER2_START + 9}`] = { t: 's', v: '     CO # ' };
  ws[`I${HEADER2_START + 9}`] = { t: 's', v: '0' };
  
  ws[`B${HEADER2_START + 11}`] = { t: 's', v: 'Client Change Reference:' };
  ws[`G${HEADER2_START + 11}`] = { t: 's', v: 'X' };
  ws[`H${HEADER2_START + 11}`] = { t: 's', v: 'Original Budget' };
  ws[`I${HEADER2_START + 12}`] = { t: 's', v: '0' };

  // ===== MATERIAL BREAKDOWN SECTION =====
  const MATERIAL_HEADER_ROW = HEADER2_START + 15;
  const MATERIAL_COLS_ROW = MATERIAL_HEADER_ROW + 1;
  const MATERIAL_START_ROW = MATERIAL_COLS_ROW + 1;
  
  ws[`B${MATERIAL_HEADER_ROW}`] = { t: 's', v: 'MATERIAL BREAKDOWN' };
  
  ws[`B${MATERIAL_COLS_ROW}`] = { t: 's', v: 'Cost Code' };
  ws[`D${MATERIAL_COLS_ROW}`] = { t: 's', v: 'DESCRIPTION' };
  ws[`H${MATERIAL_COLS_ROW}`] = { t: 's', v: 'AMOUNT' };

  // Material data rows
  let materialRowIndex = 0;
  materialData.forEach((item) => {
    const row = MATERIAL_START_ROW + materialRowIndex;
    
    // Format material code as "01 0000 {code}" to match template format
    const formattedCode = item.code.includes(' ') ? item.code : `01 0000 ${item.code}`;
    
    ws[`B${row}`] = { t: 's', v: formattedCode };
    ws[`D${row}`] = { t: 's', v: item.description || getMaterialCodeDescription(item.code) };
    ws[`H${row}`] = { t: 'n', v: Math.round(item.amount * 100) / 100, z: '#,##0.00' };
    materialRowIndex++;
  });

  // Add Foreman Bonus Contingency (FCNT) to material section if enabled
  if (budgetAdjustments && budgetAdjustments.foremanBonusEnabled && budgetAdjustments.foremanBonusDollars > 0) {
    const fcntRow = MATERIAL_START_ROW + materialRowIndex;
    ws[`B${fcntRow}`] = { t: 's', v: 'GC 0000 FCNT' };
    ws[`D${fcntRow}`] = { t: 's', v: `FIELD BONUS CONTINGENCY ${budgetAdjustments.foremanBonusPercent}% - STRIP OF FIELD LABOR` };
    ws[`H${fcntRow}`] = { t: 'n', v: Math.round(budgetAdjustments.foremanBonusDollars * 100) / 100, z: '#,##0.00' };
    totalMaterialDollars += budgetAdjustments.foremanBonusDollars;
    materialRowIndex++;
  }

  // Add LRCN (Labor Rate Contingency) line if enabled and has positive amount
  if (budgetAdjustments && budgetAdjustments.laborRateContingencyEnabled && budgetAdjustments.lrcnAmount > 0) {
    const lrcnRow = MATERIAL_START_ROW + materialRowIndex;
    ws[`B${lrcnRow}`] = { t: 's', v: '01 0000 LRCN' };
    ws[`D${lrcnRow}`] = { t: 's', v: 'LABOR RATE CONTINGENCY' };
    ws[`H${lrcnRow}`] = { t: 'n', v: Math.round(budgetAdjustments.lrcnAmount * 100) / 100, z: '#,##0.00' };
    totalMaterialDollars += budgetAdjustments.lrcnAmount;
    materialRowIndex++;
  }

  // Add Fab LRCN (Fab Labor Rate Contingency) line if enabled and has positive amount
  if (budgetAdjustments?.fabLrcnEnabled && budgetAdjustments?.fabLrcnAmount > 0) {
    const fabLrcnRow = MATERIAL_START_ROW + materialRowIndex;
    ws[`B${fabLrcnRow}`] = { t: 's', v: 'MA 0FAB LRCN' };
    ws[`D${fabLrcnRow}`] = { t: 's', v: 'FAB LABOR RATE CONTINGENCY' };
    ws[`H${fabLrcnRow}`] = { t: 'n', v: Math.round(budgetAdjustments.fabLrcnAmount * 100) / 100, z: '#,##0.00' };
    totalMaterialDollars += budgetAdjustments.fabLrcnAmount;
    materialRowIndex++;
  }

  const grandTotal = totalLaborDollars + totalMaterialDollars;
  const SUMMARY_BOX_ROW = MATERIAL_START_ROW + 2;
  ws[`J${SUMMARY_BOX_ROW}`] = { t: 's', v: 'TOTAL COST' };
  ws[`K${SUMMARY_BOX_ROW}`] = { 
    t: 'n', 
    v: Math.round(grandTotal * 100) / 100,
    z: '#,##0.00'
  };
  
  ws[`J${SUMMARY_BOX_ROW + 1}`] = { t: 's', v: 'PLUS' };
  
  ws[`J${SUMMARY_BOX_ROW + 2}`] = { t: 's', v: 'MARKUP' };
  ws[`K${SUMMARY_BOX_ROW + 2}`] = { t: 'n', v: 0, z: '#,##0' };
  
  ws[`J${SUMMARY_BOX_ROW + 3}`] = { t: 's', v: 'TOTAL' };
  ws[`K${SUMMARY_BOX_ROW + 3}`] = { 
    t: 'n', 
    v: Math.round(grandTotal * 100) / 100,
    z: '#,##0.00'
  };
  
  ws[`J${SUMMARY_BOX_ROW + 4}`] = { t: 's', v: '(PCO, TRNSFR, CO, or RVSN)' };

  // ===== BOTTOM SUMMARY ROWS =====
  const BOTTOM_START = MATERIAL_START_ROW + materialRowIndex + 2;
  ws[`G${BOTTOM_START}`] = { t: 's', v: 'MATERIAL TOTAL -->' };
  ws[`H${BOTTOM_START}`] = { 
    t: 'n', 
    v: Math.round(totalMaterialDollars * 100) / 100,
    z: '#,##0.00'
  };
  
  ws[`G${BOTTOM_START + 2}`] = { t: 's', v: 'LABOR TOTAL -->' };
  ws[`H${BOTTOM_START + 2}`] = { t: 'n', v: Math.round(totalLaborDollars * 100) / 100, z: '#,##0.00' };
  
  ws[`G${BOTTOM_START + 4}`] = { t: 's', v: 'TOTAL -->' };
  ws[`H${BOTTOM_START + 4}`] = { t: 'n', v: Math.round(grandTotal * 100) / 100, z: '#,##0.00' };

  // ===== WORKSHEET CONFIGURATION =====
  ws['!cols'] = [
    { wch: 3 },   // A
    { wch: 16 },  // B - Cost Code
    { wch: 18 },  // C - Job info values
    { wch: 25 },  // D - Description
    { wch: 12 },  // E - TOTALS label
    { wch: 8 },   // F
    { wch: 20 },  // G - Bottom totals labels
    { wch: 14 },  // H - Hours / Amount
    { wch: 10 },  // I - Rate
    { wch: 14 },  // J - Total Cost / Summary labels
    { wch: 14 },  // K - Summary values
  ];

  const lastRow = BOTTOM_START + 5;
  ws['!ref'] = `A1:K${lastRow}`;

  XLSX.utils.book_append_sheet(wb, ws, 'Initial Budget');

  // Generate filename and download
  const dateStr = projectInfo.date.toISOString().split('T')[0];
  const safeName = projectInfo.jobNumber.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Budget_Packet_${safeName}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);

  return {
    laborCodes: laborData.length,
    materialCodes: materialData.length,
    totalLaborHours,
    totalLaborDollars,
    totalMaterialDollars,
    grandTotal
  };
}

/**
 * Helper: Get material code description
 */
function getMaterialCodeDescription(code: string): string {
  const descriptions: Record<string, string> = {
    '9510': 'PIPE',
    '9511': 'CAST IRON PIPE & FITTINGS',
    '9512': 'COPPER PIPE & FITTINGS',
    '9513': 'PLASTIC PIPE & FITTINGS',
    '9514': 'STAINLESS STEEL PIPE & FITTINGS',
    '9515': 'CARBON STEEL PIPE & FITTINGS',
    '9520': 'SPECIALTIES',
    '9521': 'HANGERS & SUPPORTS',
    '9522': 'INSULATION',
    '9523': 'IDENTIFICATION',
    '9524': 'VALVES',
    '9525': 'FIXTURES',
    '9526': 'EQUIPMENT',
    '9530': 'FITTINGS',
    '9540': 'FLANGES',
    '9550': 'MISCELLANEOUS',
    '9560': 'TESTING',
    '9570': 'CONSUMABLES',
    'MCKM': 'MISCELLANEOUS MATERIAL',
  };
  // Try exact match first, then try just the numeric part
  return descriptions[code] || descriptions[code.replace(/\D/g, '')] || '';
}

/**
 * Helper: Get section description for headers
 */
function getSectionDescription(section: string): string {
  const descriptions: Record<string, string> = {
    '01': 'GENERAL CONDITIONS',
    'BG': 'BELOW GRADE',
    'CL': 'CLUB LEVEL',
    'CN': 'CONCOURSE',
    'FL': 'FIELD LEVEL',
    'GC': 'GENERAL CONDITIONS',
    'ME': 'MECHANICAL',
    'PH': 'PENTHOUSE',
    'RF': 'ROOF',
    'SU': 'SUITE LEVEL',
    'TE': 'TERRACE',
    'UP': 'UPPER LEVEL',
    'LO': 'LOWER LEVEL',
    '02': 'SECOND FLOOR',
    '03': 'THIRD FLOOR',
    '04': 'FOURTH FLOOR',
    '05': 'FIFTH FLOOR',
  };
  return descriptions[section] || section;
}

/**
 * Helper: Get labor cost head description
 */
function getLaborCostHeadDescription(costHead: string): string {
  const descriptions: Record<string, string> = {
    'FCNT': 'FOREMAN CONTINGENCY',
    'BGGW': 'BELOW GRADE GREASE WASTE',
    'BGSD': 'BELOW GRADE STORM DRAIN',
    'BGTP': 'BELOW GRADE TRAP PRIMERS',
    'BGWT': 'BELOW GRADE DOMESTIC WATER',
    'BGWV': 'BELOW GRADE WASTE & VENT',
    'COND': 'CONDENSATE',
    'DEMO': 'DEMOLITION',
    'DRNS': 'DRAINS',
    'DWTR': 'DOMESTIC WATER',
    'FNSH': 'FIXTURES',
    'FUEL': 'FUEL OIL',
    'GRWV': 'GREASE WASTE AND VENT',
    'HNGS': 'HANGERS AND SUPPORTS',
    'IWTR': 'INDUSTRIAL WATER',
    'NGAS': 'NATURAL GAS',
    'PIDV': 'PIPE ID AND VALVE TAGS',
    'RCLM': 'RECLAIMED WATER',
    'SEQP': 'EQUIPMENT SETTING',
    'SLVS': 'SLEEVES',
    'SNWV': 'SANITARY WASTE AND VENT',
    'SPCL': 'SPECIALTIES',
    'STRM': 'STORM DRAIN',
    'SZMC': 'SEISMIC',
    'TRAP': 'TRAP PRIMERS',
    'GRAY': 'GRAY WATER',
  };
  return descriptions[costHead] || costHead;
}

/**
 * Helper: Parse and normalize cost code to remove duplicates
 * Input like "BG 0000 BG 0000 BGGW" returns { section: "BG", activity: "0000", costHead: "BGGW", fullCode: "BG 0000 BGGW" }
 */
function parseLaborCode(code: string): { section: string; activity: string; costHead: string; fullCode: string } {
  const parts = code.trim().split(/\s+/);
  
  // Detect doubled codes: "BG 0000 BG 0000 BGGW" (5 parts) or "BG 0000 BG 0000 BGGW EXTRA" (6+ parts)
  // Pattern: parts[0] === parts[2] && parts[1] === parts[3] indicates duplication
  if (parts.length >= 5 && parts[0] === parts[2] && parts[1] === parts[3]) {
    // Doubled - take section from [0], activity from [1], cost head from [4] onwards
    return {
      section: parts[0],
      activity: parts[1],
      costHead: parts.slice(4).join(' '),
      fullCode: `${parts[0]} ${parts[1]} ${parts.slice(4).join(' ')}`
    };
  } else if (parts.length >= 3) {
    // Normal format "BG 0000 BGGW"
    return {
      section: parts[0],
      activity: parts[1],
      costHead: parts.slice(2).join(' '),
      fullCode: code.trim()
    };
  } else if (parts.length === 2) {
    // Missing activity
    return {
      section: parts[0],
      activity: '0000',
      costHead: parts[1],
      fullCode: `${parts[0]} 0000 ${parts[1]}`
    };
  } else {
    // Just cost head
    return {
      section: '01',
      activity: '0000',
      costHead: parts[0] || '',
      fullCode: `01 0000 ${parts[0] || ''}`
    };
  }
}

// ============================================
// AUDIT REPORT EXPORT (Detailed Line Items)
// ============================================

interface SavedMerge {
  sec_code: string;
  cost_head: string;
  reassign_to_head?: string | null;
  redistribute_adjustments?: Record<string, number> | null;
  merged_act: string;
}

/**
 * Determines the adjustment label for an item based on saved merges
 */
function getAdjustmentLabel(sec: string, costHead: string, savedMerges: SavedMerge[]): string {
  for (const merge of savedMerges) {
    if (merge.sec_code !== sec) continue;
    if (merge.cost_head !== costHead) continue;
    if (merge.reassign_to_head) {
      return `Reassigned → ${merge.sec_code} ${merge.merged_act} ${merge.reassign_to_head}`;
    }
    if (merge.redistribute_adjustments && Object.keys(merge.redistribute_adjustments).length > 0) {
      return 'Redistributed';
    }
    return `Merged → ${merge.sec_code} ${merge.merged_act} ${merge.cost_head}`;
  }
  return '';
}

/**
 * Prepares labor report data for audit export
 */
function prepareLaborReportData(
  items: ExportEstimateItem[],
  floorMappings: FloorSectionMap = {},
  buildingMappings: BuildingSectionMapping[] = [],
  dbFloorMappings: FloorSectionMapping[] = [],
  datasetProfile: any = null,
  savedMerges: SavedMerge[] = []
): any[] {
  return items
    .filter(item => item.laborCostHead || item.costCode || item.suggestedCode?.costHead)
    .map(item => {
      const isStandalone = /^(roof|ug|crawl\s*space|site|site\s+above\s+grade|attic|penthouse)$/i
        .test((item.floor || '').trim());

      let sec: string;
      if (isStandalone && item.floor && buildingMappings.length > 0) {
        sec = getSectionFromFloor(item.floor, floorMappings, item.drawing,
          buildingMappings, dbFloorMappings, item.zone, datasetProfile);
      } else {
        sec = item.laborSec || item.suggestedCode?.section;
        if (!sec && item.floor) {
          sec = getSectionFromFloor(item.floor, floorMappings, item.drawing,
            buildingMappings, dbFloorMappings, item.zone, datasetProfile);
        }
        sec = sec || '01';
      }

      const costHead = item.laborCostHead || item.costCode || item.suggestedCode?.costHead || '';
      const adjustment = savedMerges.length > 0 ? getAdjustmentLabel(sec, costHead, savedMerges) : '';

      return {
        'SEC': sec,
        'ACT': item.laborAct || item.suggestedCode?.activity || '0000',
        'COST HEAD': costHead,
        'DESCRIPTION': item.laborDescription || item.suggestedCode?.description || '',
        'Drawing': item.drawing || '',
        'System': item.system || '',
        'Floor': item.floor || '',
        'Zone': item.zone || '',
        'Material Spec': item.materialSpec || '',
        'Item Type': item.itemType || '',
        'Material Description': item.materialDesc || item.materialDescription || '',
        'Item Name': item.itemName || '',
        'Size': item.size || '',
        'Quantity': item.quantity || 0,
        'Hours': item.hours || 0,
        'Labor Dollars': item.laborDollars || 0,
        'Adjustment': adjustment,
      };
    });
}

/**
 * Prepares material report data for audit export
 */
function prepareMaterialReportData(items: ExportEstimateItem[]): any[] {
  return items
    .filter(item => item.materialCode || item.materialCostCode)
    .map(item => ({
      'Material Code': item.materialCode || item.materialCostCode || '',
      'Code Description': item.materialCodeDescription || '',
      'Drawing': item.drawing || '',
      'System': item.system || '',
      'Floor': item.floor || '',
      'Zone': item.zone || '',
      'Material Spec': item.materialSpec || '',
      'Item Type': item.itemType || '',
      'Material Description': item.materialDesc || item.materialDescription || '',
      'Item Name': item.itemName || '',
      'Size': item.size || '',
      'Quantity': item.quantity || 0,
      'List Price': item.listPrice || 0,
      'Material Dollars': item.materialDollars || 0
    }));
}

/**
 * Exports detailed Audit Report with Labor and Material tabs
 * @param floorMappings - Optional floor-to-section mappings for deriving section from floor
 */
export function exportAuditReport(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo,
  floorMappings: FloorSectionMap = {},
  buildingMappings: BuildingSectionMapping[] = [],
  dbFloorMappings: FloorSectionMapping[] = []
): { laborItems: number; materialItems: number; totalItems: number } {
  const wb = XLSX.utils.book_new();

  // Labor Report tab (detailed line items)
  const laborData = prepareLaborReportData(items, floorMappings, buildingMappings, dbFloorMappings);
  if (laborData.length > 0) {
    const laborWs = XLSX.utils.json_to_sheet(laborData);
    laborWs['!cols'] = [
      { wch: 6 },  // SEC
      { wch: 8 },  // ACT
      { wch: 10 }, // COST HEAD
      { wch: 25 }, // DESCRIPTION
      { wch: 12 }, // Drawing
      { wch: 15 }, // System
      { wch: 10 }, // Floor
      { wch: 10 }, // Zone
      { wch: 20 }, // Material Spec
      { wch: 12 }, // Item Type
      { wch: 30 }, // Material Description
      { wch: 20 }, // Item Name
      { wch: 15 }, // Size
      { wch: 10 }, // Quantity
      { wch: 10 }, // Hours
      { wch: 12 }, // Labor Dollars
    ];
    XLSX.utils.book_append_sheet(wb, laborWs, 'Labor Report');
  }

  // Material Report tab (detailed line items)
  const materialData = prepareMaterialReportData(items);
  if (materialData.length > 0) {
    const materialWs = XLSX.utils.json_to_sheet(materialData);
    materialWs['!cols'] = [
      { wch: 15 }, // Material Code
      { wch: 25 }, // Code Description
      { wch: 12 }, // Drawing
      { wch: 15 }, // System
      { wch: 10 }, // Floor
      { wch: 10 }, // Zone
      { wch: 20 }, // Material Spec
      { wch: 12 }, // Item Type
      { wch: 30 }, // Material Description
      { wch: 20 }, // Item Name
      { wch: 15 }, // Size
      { wch: 10 }, // Quantity
      { wch: 12 }, // List Price
      { wch: 14 }, // Material Dollars
    ];
    XLSX.utils.book_append_sheet(wb, materialWs, 'Material Report');
  }

  // Summary tab
  const laborSummary = aggregateLaborByCostCode(items, floorMappings, { buildingMappings, dbFloorMappings });
  const materialSummary = aggregateMaterialByCostCode(items);

  const summaryData = [
    ['LABOR SUMMARY BY COST CODE'],
    ['Cost Code', 'Description', 'Hours', 'Labor $', 'Items'],
    ...laborSummary.map(l => [l.costCode, l.description, Math.round(l.hours * 10) / 10, Math.round(l.laborDollars * 100) / 100, l.itemCount]),
    [],
    ['MATERIAL SUMMARY BY COST CODE'],
    ['Cost Code', 'Description', 'Material $', 'Items'],
    ...materialSummary.map(m => [m.costCode, m.description, Math.round(m.materialDollars * 100) / 100, m.itemCount]),
    [],
    ['TOTALS'],
    ['Total Labor Hours:', Math.round(laborSummary.reduce((s, l) => s + l.hours, 0) * 10) / 10],
    ['Total Labor $:', Math.round(laborSummary.reduce((s, l) => s + l.laborDollars, 0) * 100) / 100],
    ['Total Material $:', Math.round(materialSummary.reduce((s, m) => s + m.materialDollars, 0) * 100) / 100],
  ];

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Audit_Report_${projectInfo.jobNumber.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);

  return {
    laborItems: laborData.length,
    materialItems: materialData.length,
    totalItems: items.length
  };
}
