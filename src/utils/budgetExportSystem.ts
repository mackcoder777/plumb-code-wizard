// Murray Company Budget Export System
// Provides two export types:
// 1. Budget Packet - Aggregated by cost code for accounting submission
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
// BUDGET PACKET EXPORT (Aggregated Format)
// ============================================

/**
 * Builds the Budget Packet worksheet as array of arrays
 */
function buildBudgetWorksheetData(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo,
  laborRate: number = 0
): any[][] {
  const laborSummary = aggregateLaborByCostCode(items);
  const materialSummary = aggregateMaterialByCostCode(items);

  const data: any[][] = [];

  // ===== HEADER SECTION =====
  data.push([]); // Row 1
  data.push([null, null, null, '  NEW JOB / CHANGE ORDER']); // Row 2
  data.push([null, null, null, null, '   WORKSHEET']); // Row 3
  data.push([]); // Row 4
  data.push([]); // Row 5
  
  // Job Info
  data.push([null, 'JOB #:', projectInfo.jobNumber, null, null, null, null, '  Pending Change Order (MPCO)']); // Row 6
  data.push([null, 'JOB NAME:', projectInfo.jobName, null, null, null, null, ' MCE # (s)', 'Initial Budget']); // Row 7
  data.push([null, 'DATE:', projectInfo.date.toLocaleDateString()]); // Row 8
  data.push([null, 'BY:', projectInfo.preparedBy, null, null, null, ' ', '  Change Order  (CO)']); // Row 9
  data.push([null, null, null, null, null, null, null, ' (if PCO transfer to CO, see page 2)']); // Row 10
  data.push([null, null, null, null, null, null, null, '     CO # ']); // Row 11
  data.push([]); // Row 12
  data.push([null, 'Client Change Reference:', null, projectInfo.clientReference || '', null, null, 'X', 'Original Budget']); // Row 13
  data.push([]); // Row 14
  data.push([]); // Row 15
  data.push([null, null, null, null, null, null, null, 'APPROVAL:']); // Row 16

  // ===== LABOR SECTION =====
  data.push([null, 'LABOR BREAKDOWN']); // Row 17
  data.push([null, 'Cost Code', null, 'DESCRIPTION', null, null, null, ' # of HOURS', 'RATE', 'TOTAL COST']); // Row 18
  data.push([]); // Row 19 - empty before data

  const laborStartRow = data.length + 1; // Excel is 1-indexed
  let totalLaborHours = 0;
  let totalLaborDollars = 0;

  // Labor data rows
  laborSummary.forEach(item => {
    const totalCost = laborRate > 0 ? item.hours * laborRate : item.laborDollars;
    data.push([
      null,
      item.costCode, // Cost Code
      null,
      item.description, // Description
      null, null, null,
      Math.round(item.hours * 10) / 10, // Hours (rounded to 1 decimal)
      laborRate || '', // Rate
      Math.round(totalCost * 100) / 100 // Total Cost (rounded to cents)
    ]);
    totalLaborHours += item.hours;
    totalLaborDollars += totalCost;
  });

  // Add empty rows to reach minimum 15 labor rows
  const minLaborRows = 15;
  while (data.length - laborStartRow + 1 < minLaborRows) {
    data.push([null, '', null, '', null, null, null, null, null, 0]);
  }

  // Labor subtotal row
  data.push([]);
  data.push([
    null, null, null, null, null, null,
    'LABOR SUBTOTAL:',
    Math.round(totalLaborHours * 10) / 10,
    null,
    Math.round(totalLaborDollars * 100) / 100
  ]);

  // ===== NON-LABOR (MATERIAL) SECTION =====
  data.push([]); // Spacer
  data.push([null, 'NON LABOR']); // Section header
  data.push([null, 'Cost Code', null, null, 'Description', null, null, null, null, null, 'Total Cost']); // Column headers

  const materialStartRow = data.length + 1;
  let totalMaterialDollars = 0;

  // Material data rows
  materialSummary.forEach(item => {
    data.push([
      null,
      item.costCode, // Cost Code
      null, null,
      item.description, // Description
      null, null, null, null, null,
      Math.round(item.materialDollars * 100) / 100 // Total Cost
    ]);
    totalMaterialDollars += item.materialDollars;
  });

  // Add empty rows to reach minimum 10 material rows
  const minMaterialRows = 10;
  while (data.length - materialStartRow + 1 < minMaterialRows) {
    data.push([null, '', null, null, '', null, null, null, null, null, 0]);
  }

  // ===== SUMMARY SECTION =====
  data.push([]); // Spacer
  data.push([]); // Spacer

  const grandTotal = totalLaborDollars + totalMaterialDollars;

  // Summary totals
  data.push([
    null, null, null, null, null, null, null, null, null,
    'TOTAL COST',
    Math.round(grandTotal * 100) / 100
  ]);

  data.push([
    null, null, null, null,
    'Labor Hours Total', null,
    Math.round(totalLaborHours * 10) / 10,
    null, null,
    'PLUS'
  ]);

  data.push([
    null, null, null, null,
    'Labor $$ Total', null,
    Math.round(totalLaborDollars * 100) / 100,
    0, // Placeholder for rate
    null,
    'MARKUP',
    0 // Markup amount
  ]);

  data.push([
    null, null, null, null,
    'Material Total', null,
    Math.round(totalMaterialDollars * 100) / 100,
    0,
    null,
    'MARGIN %',
    0
  ]);

  data.push([
    null, null, null, null, null, null, null, null, null,
    'TOTAL',
    Math.round(grandTotal * 100) / 100
  ]);

  return data;
}

/**
 * Exports Budget Packet in Murray Company format
 */
export function exportBudgetPacket(
  items: ExportEstimateItem[],
  projectInfo: ProjectInfo,
  laborRate: number = 0
): { laborCodes: number; materialCodes: number; totalLaborHours: number; totalLaborDollars: number; totalMaterialDollars: number; grandTotal: number } {
  const wb = XLSX.utils.book_new();

  // Build worksheet data
  const worksheetData = buildBudgetWorksheetData(items, projectInfo, laborRate);
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  ws['!cols'] = [
    { wch: 3 },   // A
    { wch: 14 },  // B - Cost Code
    { wch: 6 },   // C
    { wch: 20 },  // D - Description
    { wch: 12 },  // E
    { wch: 10 },  // F
    { wch: 12 },  // G
    { wch: 12 },  // H - Hours
    { wch: 10 },  // I - Rate
    { wch: 14 },  // J - Total Cost
    { wch: 14 },  // K
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Initial Budget');

  // Generate filename with date
  const dateStr = projectInfo.date.toISOString().split('T')[0];
  const filename = `Budget_Packet_${projectInfo.jobNumber.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

  XLSX.writeFile(wb, filename);

  // Calculate stats for return
  const laborSummary = aggregateLaborByCostCode(items);
  const materialSummary = aggregateMaterialByCostCode(items);
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
