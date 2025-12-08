import * as XLSX from 'xlsx';
import { EstimateItem } from '@/types/estimate';

interface CostCodeSummary {
  code: string;
  description: string;
  hours: number;
  laborDollars: number;
}

interface MaterialCodeSummary {
  code: string;
  description: string;
  materialDollars: number;
}

// Format cost code to 10-digit SEC-ACT-COST HEAD format
const formatCostCode = (code: string, section: string = '01', activity: string = '0000'): string => {
  if (!code) return '';
  return `${section} ${activity} ${code}`;
};

// Get description for a cost code (could be enhanced with actual lookup)
const getCodeDescription = (code: string, type: 'labor' | 'material'): string => {
  // Map common codes to descriptions
  const laborDescriptions: Record<string, string> = {
    'ARGO': 'ARGON PIPING',
    'COMA': 'COMPRESSED AIR PIPING',
    'NITR': 'NITROGEN PIPING',
    'STRM': 'STORM DRAIN',
    'SNWV': 'SANITARY WASTE & VENT',
    'COPR': 'COPPER PIPING',
    'SZMC': 'SEISMIC',
    'FIRE': 'FIRE PROTECTION',
    'HNGS': 'HANGERS & SUPPORTS',
    'VALV': 'VALVES',
    'FIXT': 'FIXTURES',
  };
  
  const materialDescriptions: Record<string, string> = {
    '9511': 'CAST IRON PIPE & FITTINGS',
    '9512': 'COPPER PIPE & FITTINGS',
    '9514': 'STAINLESS STEEL PIPE & FITTINGS',
    '9521': 'HANGERS & SUPPORTS',
    '9524': 'VALVES',
    '9525': 'FIXTURES',
    '9526': 'SPECIALTIES',
  };

  if (type === 'labor') {
    return laborDescriptions[code] || `LABOR - ${code}`;
  }
  return materialDescriptions[code] || `MATERIAL - ${code}`;
};

// Aggregate data by labor cost code
const aggregateLaborByCode = (data: EstimateItem[]): CostCodeSummary[] => {
  const summaryMap = new Map<string, CostCodeSummary>();

  data.forEach(item => {
    const code = item.costCode || 'UNASSIGNED';
    
    if (!summaryMap.has(code)) {
      summaryMap.set(code, {
        code,
        description: getCodeDescription(code, 'labor'),
        hours: 0,
        laborDollars: 0,
      });
    }
    
    const summary = summaryMap.get(code)!;
    summary.hours += item.hours || 0;
    summary.laborDollars += item.laborDollars || 0;
  });

  return Array.from(summaryMap.values())
    .filter(s => s.code !== 'UNASSIGNED' || s.hours > 0)
    .sort((a, b) => a.code.localeCompare(b.code));
};

// Aggregate data by material cost code
const aggregateMaterialByCode = (data: EstimateItem[]): MaterialCodeSummary[] => {
  const summaryMap = new Map<string, MaterialCodeSummary>();

  data.forEach(item => {
    const code = item.materialCostCode || 'UNASSIGNED';
    
    if (!summaryMap.has(code)) {
      summaryMap.set(code, {
        code,
        description: getCodeDescription(code, 'material'),
        materialDollars: 0,
      });
    }
    
    const summary = summaryMap.get(code)!;
    summary.materialDollars += item.materialDollars || 0;
  });

  return Array.from(summaryMap.values())
    .filter(s => s.code !== 'UNASSIGNED' || s.materialDollars > 0)
    .sort((a, b) => a.code.localeCompare(b.code));
};

// Export Budget Packet in the required format
export const exportBudgetPacket = (
  data: EstimateItem[],
  projectName: string = 'Project',
  userName: string = 'User'
) => {
  const laborSummary = aggregateLaborByCode(data);
  const materialSummary = aggregateMaterialByCode(data);

  const totalLaborHours = laborSummary.reduce((sum, s) => sum + s.hours, 0);
  const totalLaborDollars = laborSummary.reduce((sum, s) => sum + s.laborDollars, 0);
  const totalMaterialDollars = materialSummary.reduce((sum, s) => sum + s.materialDollars, 0);
  const grandTotal = totalLaborDollars + totalMaterialDollars;

  const date = new Date().toLocaleDateString();
  
  // Build the worksheet data as array of arrays for precise control
  const wsData: (string | number)[][] = [];

  // Header section
  wsData.push(['JOB #:', projectName, '', '', '']);
  wsData.push(['JOB NAME:', projectName, '', '', '']);
  wsData.push(['DATE:', date, '', '', '']);
  wsData.push(['BY:', userName, '', '', '']);
  wsData.push(['', '', '', '', '']);

  // Labor Breakdown Section
  wsData.push(['LABOR BREAKDOWN', '', '', '', '']);
  wsData.push(['Cost Code', 'Description', '# of HOURS', 'RATE', 'TOTAL COST']);

  laborSummary.forEach(item => {
    if (item.code !== 'UNASSIGNED') {
      const formattedCode = formatCostCode(item.code, '01', '0000');
      wsData.push([
        formattedCode,
        item.description,
        Math.round(item.hours * 10) / 10,
        '', // Rate - left blank for user to fill
        item.laborDollars
      ]);
    }
  });

  // Labor Totals
  wsData.push(['', 'LABOR TOTALS', Math.round(totalLaborHours * 10) / 10, '', totalLaborDollars]);
  wsData.push(['', '', '', '', '']);

  // Material Breakdown Section
  wsData.push(['MATERIAL BREAKDOWN', '', '', '', '']);
  wsData.push(['Cost Code', 'Description', 'AMOUNT', '', '']);

  materialSummary.forEach(item => {
    if (item.code !== 'UNASSIGNED') {
      const formattedCode = formatCostCode(item.code, '01', '9520');
      wsData.push([
        formattedCode,
        item.description,
        item.materialDollars,
        '',
        ''
      ]);
    }
  });

  // Material Total
  wsData.push(['', 'MATERIAL TOTAL', totalMaterialDollars, '', '']);
  wsData.push(['', '', '', '', '']);

  // Grand Total
  wsData.push(['', 'GRAND TOTAL', grandTotal, '', '']);

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, // Cost Code
    { wch: 30 }, // Description
    { wch: 15 }, // Hours/Amount
    { wch: 10 }, // Rate
    { wch: 15 }, // Total Cost
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Initial Budget');

  // Download
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `budget_packet_${projectName.replace(/\s+/g, '_')}_${dateStr}.xlsx`);

  return {
    laborCodes: laborSummary.length,
    materialCodes: materialSummary.length,
    totalLaborHours,
    totalLaborDollars,
    totalMaterialDollars,
    grandTotal
  };
};

// Export Audit Report with separate Labor and Material tabs
export const exportAuditReport = (
  data: EstimateItem[],
  projectName: string = 'Project'
) => {
  const wb = XLSX.utils.book_new();

  // Labor Report Tab - detailed line items with labor info
  const laborExportData = data.map(item => ({
    'Drawing': item.drawing || '',
    'System': item.system || '',
    'Floor': item.floor || '',
    'Zone': item.zone || '',
    'Material Description': item.materialDesc || '',
    'Item Name': item.itemName || '',
    'Size': item.size || '',
    'Quantity': item.quantity || 0,
    'Labor Hours': item.hours || 0,
    'Labor $': item.laborDollars || 0,
    'Labor Cost Code': item.costCode || '',
    'SEC': '01',
    'ACT': '0000',
    'COST HEAD': item.costCode || '',
  }));

  const laborWs = XLSX.utils.json_to_sheet(laborExportData);
  laborWs['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
    { wch: 30 }, { wch: 25 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 6 },
    { wch: 8 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, laborWs, 'Labor Report');

  // Material Report Tab - detailed line items with material info
  const materialExportData = data.map(item => ({
    'Drawing': item.drawing || '',
    'System': item.system || '',
    'Floor': item.floor || '',
    'Zone': item.zone || '',
    'Material Spec': item.materialSpec || '',
    'Item Type': item.itemType || '',
    'Material Description': item.materialDesc || '',
    'Item Name': item.itemName || '',
    'Size': item.size || '',
    'Quantity': item.quantity || 0,
    'List Price': item.listPrice || 0,
    'Material $': item.materialDollars || 0,
    'Material Cost Code': item.materialCostCode || '',
    'SEC': '01',
    'ACT': '9520',
    'COST HEAD': item.materialCostCode || '',
  }));

  const materialWs = XLSX.utils.json_to_sheet(materialExportData);
  materialWs['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
    { wch: 20 }, { wch: 15 }, { wch: 30 }, { wch: 25 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 18 }, { wch: 6 }, { wch: 8 }, { wch: 12 }
  ];
  XLSX.utils.book_append_sheet(wb, materialWs, 'Material Report');

  // Summary Tab - aggregated by cost code
  const laborSummary = aggregateLaborByCode(data);
  const materialSummary = aggregateMaterialByCode(data);

  const summaryData: any[] = [];
  
  // Labor summary header
  summaryData.push({ 'Category': 'LABOR SUMMARY', 'Code': '', 'Description': '', 'Value': '' });
  laborSummary.forEach(item => {
    summaryData.push({
      'Category': 'Labor',
      'Code': item.code,
      'Description': item.description,
      'Hours': item.hours,
      'Dollars': item.laborDollars
    });
  });
  
  summaryData.push({ 'Category': '', 'Code': '', 'Description': '', 'Value': '' });
  summaryData.push({ 'Category': 'MATERIAL SUMMARY', 'Code': '', 'Description': '', 'Value': '' });
  
  materialSummary.forEach(item => {
    summaryData.push({
      'Category': 'Material',
      'Code': item.code,
      'Description': item.description,
      'Hours': '',
      'Dollars': item.materialDollars
    });
  });

  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Download
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `audit_report_${projectName.replace(/\s+/g, '_')}_${dateStr}.xlsx`);

  return {
    laborItems: data.filter(d => d.costCode).length,
    materialItems: data.filter(d => d.materialCostCode).length,
    totalItems: data.length
  };
};
