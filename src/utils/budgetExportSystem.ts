// Murray Company Budget Export System
// Provides two export types:
// 1. Budget Packet - Aggregated by cost code with Excel formulas
// 2. Audit Report - Detailed line items for internal backup

import * as XLSX from 'xlsx';
import { BudgetAdjustments } from '../components/BudgetAdjustmentsPanel';

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
 * Get section code from floor value using floor mappings
 */
function getSectionFromFloor(floor: string | undefined, floorMappings: FloorSectionMap): string {
  if (!floor || Object.keys(floorMappings).length === 0) return '01';
  
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
  categoryMappings: CategoryLaborMap = {}
): AggregatedLabor[] {
  const aggregated = new Map<string, AggregatedLabor>();

  items.forEach(item => {
    // Priority: explicit laborSec > floor mapping > suggested section > default
    let sec = item.laborSec || item.suggestedCode?.section;
    if (!sec && item.floor) {
      sec = getSectionFromFloor(item.floor, floorMappings);
    }
    sec = sec || '01';
    
    const act = item.laborAct || item.suggestedCode?.activity || '0000';
    
    // LABOR CODE PRIORITY:
    // 1. Category mapping (if reportCat has assigned code)
    // 2. Item's existing costCode/laborCostHead (from system mapping)
    // 3. Suggested code
    let costHead = getLaborCodeFromCategory(item.reportCat, categoryMappings);
    if (!costHead) {
      costHead = item.laborCostHead || item.costCode || item.suggestedCode?.costHead || '';
    }
    
    if (!costHead) return; // Skip items without labor code
    
    const costCode = `${sec} ${act} ${costHead}`;
    const description = item.laborDescription || item.suggestedCode?.description || '';
    const hours = parseFloat(String(item.hours)) || 0;
    const laborDollars = parseFloat(String(item.laborDollars)) || 0;

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
  categoryMappings: CategoryLaborMap = {}
): { laborCodes: number; materialCodes: number; totalLaborHours: number; totalLaborDollars: number; totalMaterialDollars: number; grandTotal: number } {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  // Determine data source: use Budget Adjustments if available, otherwise raw aggregation
  let laborData: Array<{ code: string; description: string; hours: number; dollars: number }>;
  let materialData: Array<{ code: string; description: string; amount: number }>;
  let totalLaborHours = 0;
  let totalLaborDollars = 0;
  let totalMaterialDollars = 0;

  if (budgetAdjustments && Object.keys(budgetAdjustments.adjustedLaborSummary || {}).length > 0) {
    // USE BUDGET BUILDER ADJUSTMENTS (includes foreman FCNT, FAB codes)
    laborData = Object.values(budgetAdjustments.adjustedLaborSummary)
      .map(item => ({
        code: item.code,
        description: item.description,
        hours: item.hours,
        dollars: item.dollars
      }))
      .sort((a, b) => a.code.localeCompare(b.code));

    totalLaborHours = budgetAdjustments.totalFieldHours + 
                      budgetAdjustments.totalFabHours + 
                      (budgetAdjustments.foremanBonusHours || 0);
    totalLaborDollars = budgetAdjustments.totalLaborDollars;

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
    const rawLaborSummary = aggregateLaborByCostCode(items, floorMappings, categoryMappings);
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

  // Labor data: Rows 19-54 (35 rows max)
  const LABOR_START_ROW = 19;
  const LABOR_END_ROW = 54;
  
  laborData.forEach((item, index) => {
    if (index >= 35) return; // Max 35 labor items
    
    const row = LABOR_START_ROW + index;
    
    ws[`B${row}`] = { t: 's', v: item.code };
    ws[`D${row}`] = { t: 's', v: item.description };
    ws[`H${row}`] = { t: 'n', v: Math.round(item.hours * 10) / 10, z: '#,##0.0' };
    
    if (laborRate > 0) {
      ws[`I${row}`] = { t: 'n', v: laborRate, z: '#,##0.00' };
    }
    
    // Use actual dollars from adjusted data, or formula for fallback
    ws[`J${row}`] = { t: 'n', v: Math.round(item.dollars * 100) / 100, z: '#,##0' };
  });

  // Fill remaining labor rows with formula structure
  for (let row = LABOR_START_ROW + laborData.length; row <= LABOR_END_ROW; row++) {
    ws[`J${row}`] = { t: 'n', f: `I${row}*H${row}`, v: 0, z: '#,##0' };
  }

  // Row 55: Labor TOTALS
  ws['E55'] = { t: 's', v: 'TOTALS' };
  ws['H55'] = { t: 'n', v: Math.round(totalLaborHours * 10) / 10, z: '#,##0.0' };
  ws['J55'] = { t: 'n', v: Math.round(totalLaborDollars * 100) / 100, z: '#,##0' };

  // ===== SECOND HEADER BLOCK (Rows 58-71) - Before Material Section =====
  ws['D58'] = { t: 's', v: '   CHANGE ORDER' };
  ws['E59'] = { t: 's', v: '   WORKSHEET' };
  
  ws['B62'] = { t: 's', v: 'JOB #:' };
  ws['C62'] = { t: 's', v: projectInfo.jobNumber };
  ws['G62'] = { t: 's', v: '0' };
  ws['H62'] = { t: 's', v: '  Pending Change Order (MPCO)' };
  
  ws['B63'] = { t: 's', v: 'JOB NAME:' };
  ws['C63'] = { t: 's', v: projectInfo.jobName };
  ws['H63'] = { t: 's', v: ' MCE # (s)' };
  ws['I63'] = { t: 's', v: 'Initial Budget' };
  
  ws['B64'] = { t: 's', v: 'DATE:' };
  ws['C64'] = { t: 's', v: projectInfo.date.toLocaleDateString() };
  
  ws['B65'] = { t: 's', v: 'BY:' };
  ws['C65'] = { t: 's', v: projectInfo.preparedBy };
  ws['H65'] = { t: 's', v: '  Change Order  (CO)' };
  
  ws['H66'] = { t: 's', v: ' (if PCO transfer to CO, see page 2)' };
  ws['H67'] = { t: 's', v: '     CO # ' };
  ws['I67'] = { t: 's', v: '0' };
  
  ws['B69'] = { t: 's', v: 'Client Change Reference:' };
  ws['G69'] = { t: 's', v: 'X' };
  ws['H69'] = { t: 's', v: 'Original Budget' };
  ws['I70'] = { t: 's', v: '0' };

  // ===== MATERIAL BREAKDOWN SECTION (Rows 73-108) =====
  const MATERIAL_HEADER_ROW = 73;
  const MATERIAL_COLS_ROW = 74;
  const MATERIAL_START_ROW = 75;
  const MATERIAL_END_ROW = 108;
  
  ws[`B${MATERIAL_HEADER_ROW}`] = { t: 's', v: 'MATERIAL BREAKDOWN' };
  
  ws[`B${MATERIAL_COLS_ROW}`] = { t: 's', v: 'Cost Code' };
  ws[`D${MATERIAL_COLS_ROW}`] = { t: 's', v: 'DESCRIPTION' };
  ws[`H${MATERIAL_COLS_ROW}`] = { t: 's', v: 'AMOUNT' };

  // Material data: Rows 75-108 (33 rows max)
  let materialRowIndex = 0;
  materialData.forEach((item) => {
    if (materialRowIndex >= 32) return; // Leave room for tax line
    
    const row = MATERIAL_START_ROW + materialRowIndex;
    
    // Format material code as "01 0000 {code}" to match template format
    const formattedCode = item.code.includes(' ') ? item.code : `01 0000 ${item.code}`;
    
    ws[`B${row}`] = { t: 's', v: formattedCode };
    ws[`D${row}`] = { t: 's', v: item.description || getMaterialCodeDescription(item.code) };
    ws[`H${row}`] = { t: 'n', v: Math.round(item.amount * 100) / 100, z: '#,##0.00' };
    materialRowIndex++;
  });

  // Note: Sales tax is now included directly in each material code's amount (not a separate line)

  // Add LRCN (Labor Rate Contingency) line if enabled and has positive amount
  if (budgetAdjustments && budgetAdjustments.laborRateContingencyEnabled && budgetAdjustments.lrcnAmount > 0) {
    const lrcnRow = MATERIAL_START_ROW + materialRowIndex;
    ws[`B${lrcnRow}`] = { t: 's', v: '01 0000 LRCN' };
    ws[`D${lrcnRow}`] = { t: 's', v: 'LABOR RATE CONTINGENCY' };
    ws[`H${lrcnRow}`] = { t: 'n', v: Math.round(budgetAdjustments.lrcnAmount * 100) / 100, z: '#,##0.00' };
    // Update totalMaterialDollars to include LRCN
    totalMaterialDollars += budgetAdjustments.lrcnAmount;
    materialRowIndex++;
  }

  // ===== RIGHT-SIDE SUMMARY BOX (Rows 77-81, Columns J-K) =====
  const grandTotal = totalLaborDollars + totalMaterialDollars;
  ws['J77'] = { t: 's', v: 'TOTAL COST' };
  ws['K77'] = { 
    t: 'n', 
    v: Math.round(grandTotal * 100) / 100,
    z: '#,##0.00'
  };
  
  ws['J78'] = { t: 's', v: 'PLUS' };
  
  ws['J79'] = { t: 's', v: 'MARKUP' };
  ws['K79'] = { t: 'n', v: 0, z: '#,##0' };
  
  ws['J80'] = { t: 's', v: 'TOTAL' };
  ws['K80'] = { 
    t: 'n', 
    v: Math.round(grandTotal * 100) / 100,
    z: '#,##0.00'
  };
  
  ws['J81'] = { t: 's', v: '(PCO, TRNSFR, CO, or RVSN)' };

  // ===== BOTTOM SUMMARY ROWS (Rows 110, 112, 114) =====
  ws['G110'] = { t: 's', v: 'MATERIAL TOTAL -->' };
  ws['H110'] = { 
    t: 'n', 
    v: Math.round(totalMaterialDollars * 100) / 100,
    z: '#,##0.00'
  };
  
  ws['G112'] = { t: 's', v: 'LABOR TOTAL -->' };
  ws['H112'] = { t: 'n', v: Math.round(totalLaborDollars * 100) / 100, z: '#,##0.00' };
  
  ws['G114'] = { t: 's', v: 'TOTAL -->' };
  ws['H114'] = { t: 'n', v: Math.round(grandTotal * 100) / 100, z: '#,##0.00' };

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

  ws['!ref'] = 'A1:K115';

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

// ============================================
// AUDIT REPORT EXPORT (Detailed Line Items)
// ============================================

/**
 * Prepares labor report data for audit export
 */
function prepareLaborReportData(items: ExportEstimateItem[]): any[] {
  return items
    .filter(item => item.laborCostHead || item.costCode || item.suggestedCode?.costHead)
    .map(item => ({
      'SEC': item.laborSec || item.suggestedCode?.section || '01',
      'ACT': item.laborAct || item.suggestedCode?.activity || '0000',
      'COST HEAD': item.laborCostHead || item.costCode || item.suggestedCode?.costHead || '',
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
      'Labor Dollars': item.laborDollars || 0
    }));
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
  floorMappings: FloorSectionMap = {}
): { laborItems: number; materialItems: number; totalItems: number } {
  const wb = XLSX.utils.book_new();

  // Labor Report tab (detailed line items)
  const laborData = prepareLaborReportData(items);
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
  const laborSummary = aggregateLaborByCostCode(items, floorMappings);
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
