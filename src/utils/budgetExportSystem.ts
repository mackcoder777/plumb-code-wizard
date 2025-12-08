// Murray Company Budget Export System
// Provides two export types:
// 1. Budget Packet - Aggregated by cost code with Excel formulas
// 2. Audit Report - Detailed line items for internal backup

import * as XLSX from 'xlsx';

// ============================================
// TYPES
// ============================================

export interface ExportEstimateItem {
  id: string | number;
  drawing?: string;
  system?: string;
  floor?: string;
  zone?: string;
  materialSpec?: string;
  itemType?: string;
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
// AGGREGATION FUNCTIONS
// ============================================

/**
 * Aggregates labor data by full cost code (SEC ACT COSTHEAD)
 */
export function aggregateLaborByCostCode(items: ExportEstimateItem[]): AggregatedLabor[] {
  const aggregated = new Map<string, AggregatedLabor>();

  items.forEach(item => {
    const sec = item.laborSec || item.suggestedCode?.section || '01';
    const act = item.laborAct || item.suggestedCode?.activity || '0000';
    const costHead = item.laborCostHead || item.costCode || item.suggestedCode?.costHead || '';
    
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
 * Exports Budget Packet matching Murray Company Budget_Packet.xls format
 * Includes proper cell positions and Excel formulas
 */
export function exportBudgetPacket(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo,
  laborRate: number = 0
): { laborCodes: number; materialCodes: number; totalLaborHours: number; totalLaborDollars: number; totalMaterialDollars: number; grandTotal: number } {
  const wb = XLSX.utils.book_new();
  const ws: XLSX.WorkSheet = {};

  const laborSummary = aggregateLaborByCostCode(items);
  const materialSummary = aggregateMaterialByCostCode(items);

  // ===== HEADER SECTION (Rows 1-16) =====
  // Row 2: Title
  ws['D2'] = { t: 's', v: '  NEW JOB / CHANGE ORDER' };
  
  // Row 3: Title continued
  ws['E3'] = { t: 's', v: '   WORKSHEET' };
  
  // Row 6: Job #
  ws['B6'] = { t: 's', v: 'JOB #:' };
  ws['C6'] = { t: 's', v: projectInfo.jobNumber };
  ws['H6'] = { t: 's', v: '  Pending Change Order (MPCO)' };
  
  // Row 7: Job Name
  ws['B7'] = { t: 's', v: 'JOB NAME:' };
  ws['C7'] = { t: 's', v: projectInfo.jobName };
  ws['H7'] = { t: 's', v: ' MCE # (s)' };
  ws['I7'] = { t: 's', v: 'Initial Budget' };
  
  // Row 8: Date
  ws['B8'] = { t: 's', v: 'DATE:' };
  ws['C8'] = { t: 's', v: projectInfo.date.toLocaleDateString() };
  
  // Row 9: By
  ws['B9'] = { t: 's', v: 'BY:' };
  ws['C9'] = { t: 's', v: projectInfo.preparedBy };
  ws['H9'] = { t: 's', v: '  Change Order  (CO)' };
  
  // Row 10
  ws['H10'] = { t: 's', v: ' (if PCO transfer to CO, see page 2)' };
  
  // Row 11
  ws['H11'] = { t: 's', v: '     CO # ' };
  
  // Row 13: Client Change Reference
  ws['B13'] = { t: 's', v: 'Client Change Reference:' };
  ws['D13'] = { t: 's', v: projectInfo.clientReference || '' };
  ws['G13'] = { t: 's', v: 'X' };
  ws['H13'] = { t: 's', v: 'Original Budget' };
  
  // Row 16: Approval
  ws['H16'] = { t: 's', v: 'APPROVAL:' };

  // ===== LABOR BREAKDOWN SECTION (Rows 17-36) =====
  // Row 17: Section header
  ws['B17'] = { t: 's', v: 'LABOR BREAKDOWN' };
  
  // Row 18: Column headers
  ws['B18'] = { t: 's', v: 'Cost Code' };
  ws['D18'] = { t: 's', v: 'DESCRIPTION' };
  ws['H18'] = { t: 's', v: ' # of HOURS' };
  ws['I18'] = { t: 's', v: 'RATE' };
  ws['J18'] = { t: 's', v: 'TOTAL COST' };

  // Labor data starts at row 20, max 16 rows (20-35)
  const LABOR_START_ROW = 20;
  const LABOR_END_ROW = 35;
  
  laborSummary.forEach((item, index) => {
    if (index >= 16) return; // Max 16 labor items
    
    const row = LABOR_START_ROW + index;
    
    // Cost Code (column B)
    ws[`B${row}`] = { t: 's', v: item.costCode };
    
    // Description (column D)
    ws[`D${row}`] = { t: 's', v: item.description };
    
    // Hours (column H)
    ws[`H${row}`] = { t: 'n', v: Math.round(item.hours * 10) / 10, z: '#,##0.0' };
    
    // Rate (column I) - Leave empty for user to fill, or use provided rate
    if (laborRate > 0) {
      ws[`I${row}`] = { t: 'n', v: laborRate, z: '#,##0.00' };
    }
    
    // Total Cost formula (column J): =I{row}*H{row}
    ws[`J${row}`] = { t: 'n', f: `I${row}*H${row}`, v: 0, z: '#,##0' };
  });

  // Fill remaining labor rows with empty structure and formulas
  for (let row = LABOR_START_ROW + laborSummary.length; row <= LABOR_END_ROW; row++) {
    ws[`J${row}`] = { t: 'n', f: `I${row}*H${row}`, v: 0, z: '#,##0' };
  }

  // Row 36: Labor Subtotals with SUM formulas
  ws['G36'] = { t: 's', v: 'LABOR SUBTOTAL:' };
  ws['H36'] = { t: 'n', f: `SUM(H${LABOR_START_ROW}:H${LABOR_END_ROW})`, v: 0, z: '#,##0.0' };
  ws['J36'] = { t: 'n', f: `SUM(J${LABOR_START_ROW}:J${LABOR_END_ROW})`, v: 0, z: '#,##0' };

  // ===== NON LABOR SECTION (Rows 38-49) =====
  const NON_LABOR_HEADER_ROW = 38;
  const NON_LABOR_COLS_ROW = 39;
  const NON_LABOR_START_ROW = 40;
  const NON_LABOR_END_ROW = 49; // Max 10 material rows
  
  // Row 38: Section header
  ws[`B${NON_LABOR_HEADER_ROW}`] = { t: 's', v: 'NON LABOR' };
  
  // Row 39: Column headers
  ws[`B${NON_LABOR_COLS_ROW}`] = { t: 's', v: 'Cost Code' };
  ws[`E${NON_LABOR_COLS_ROW}`] = { t: 's', v: 'Description' };
  ws[`J${NON_LABOR_COLS_ROW}`] = { t: 's', v: 'Total Cost' };

  // Material data
  materialSummary.forEach((item, index) => {
    if (index >= 10) return; // Max 10 material items
    
    const row = NON_LABOR_START_ROW + index;
    
    // Cost Code (column B)
    ws[`B${row}`] = { t: 's', v: item.costCode };
    
    // Description (column E)
    ws[`E${row}`] = { t: 's', v: item.description };
    
    // Total Cost (column J)
    ws[`J${row}`] = { t: 'n', v: Math.round(item.materialDollars * 100) / 100, z: '#,##0.00' };
  });

  // Fill remaining material rows with 0
  for (let row = NON_LABOR_START_ROW + materialSummary.length; row <= NON_LABOR_END_ROW; row++) {
    ws[`J${row}`] = { t: 'n', v: 0, z: '#,##0' };
  }

  // ===== SUMMARY SECTION (Rows 52-56) =====
  const SUMMARY_START = 52;
  
  // Row 52: TOTAL COST (Labor + Material)
  ws[`J${SUMMARY_START}`] = { t: 's', v: 'TOTAL COST' };
  ws[`K${SUMMARY_START}`] = { 
    t: 'n', 
    f: `J36+SUM(J${NON_LABOR_START_ROW}:J${NON_LABOR_END_ROW})`,
    v: 0,
    z: '#,##0.00'
  };
  
  // Row 53: Labor Hours Total
  ws[`E${SUMMARY_START + 1}`] = { t: 's', v: 'Labor Hours Total' };
  ws[`G${SUMMARY_START + 1}`] = { t: 'n', f: 'H36', v: 0, z: '#,##0.0' };
  ws[`J${SUMMARY_START + 1}`] = { t: 's', v: 'PLUS' };
  
  // Row 54: Labor $$ Total
  ws[`E${SUMMARY_START + 2}`] = { t: 's', v: 'Labor $$ Total' };
  ws[`G${SUMMARY_START + 2}`] = { t: 'n', f: 'J36', v: 0, z: '#,##0' };
  ws[`H${SUMMARY_START + 2}`] = { t: 'n', v: 0, z: '0%' };
  ws[`J${SUMMARY_START + 2}`] = { t: 's', v: 'MARKUP' };
  ws[`K${SUMMARY_START + 2}`] = { t: 'n', v: 0, z: '#,##0' };
  
  // Row 55: Material Total
  ws[`E${SUMMARY_START + 3}`] = { t: 's', v: 'Material Total' };
  ws[`G${SUMMARY_START + 3}`] = { 
    t: 'n', 
    f: `SUM(J${NON_LABOR_START_ROW}:J${NON_LABOR_END_ROW})`,
    v: 0,
    z: '#,##0.00'
  };
  ws[`H${SUMMARY_START + 3}`] = { t: 'n', v: 0, z: '0%' };
  ws[`J${SUMMARY_START + 3}`] = { t: 's', v: 'MARGIN %' };
  ws[`K${SUMMARY_START + 3}`] = { t: 'n', v: 0, z: '0%' };
  
  // Row 56: TOTAL (with formula)
  ws[`J${SUMMARY_START + 4}`] = { t: 's', v: 'TOTAL' };
  ws[`K${SUMMARY_START + 4}`] = { 
    t: 'n', 
    f: `K${SUMMARY_START}+K${SUMMARY_START + 2}`,
    v: 0,
    z: '#,##0.00'
  };

  // ===== WORKSHEET CONFIGURATION =====
  
  // Set column widths
  ws['!cols'] = [
    { wch: 3 },   // A
    { wch: 14 },  // B - Cost Code
    { wch: 18 },  // C - Job info values
    { wch: 25 },  // D - Description
    { wch: 20 },  // E - Description (non-labor)
    { wch: 8 },   // F
    { wch: 16 },  // G - Subtotal labels
    { wch: 12 },  // H - Hours
    { wch: 10 },  // I - Rate
    { wch: 14 },  // J - Total Cost
    { wch: 14 },  // K - Summary values
  ];

  // Set print area / used range
  ws['!ref'] = `A1:K${SUMMARY_START + 5}`;

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Initial Budget');

  // ===== GENERATE FILENAME AND DOWNLOAD =====
  const dateStr = projectInfo.date.toISOString().split('T')[0];
  const safeName = projectInfo.jobNumber.replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Budget_Packet_${safeName}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);

  // Calculate stats for return
  const totalLaborHours = laborSummary.reduce((s, l) => s + l.hours, 0);
  const totalLaborDollars = laborSummary.reduce((s, l) => s + l.laborDollars, 0);
  const totalMaterialDollars = materialSummary.reduce((s, m) => s + m.materialDollars, 0);

  return {
    laborCodes: laborSummary.length,
    materialCodes: materialSummary.length,
    totalLaborHours,
    totalLaborDollars,
    totalMaterialDollars,
    grandTotal: totalLaborDollars + totalMaterialDollars
  };
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
 */
export function exportAuditReport(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo
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
  const laborSummary = aggregateLaborByCostCode(items);
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
