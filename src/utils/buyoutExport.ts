import * as XLSX from 'xlsx';
import { BuyoutLine, BUYOUT_STATUS_CONFIG } from '@/types/buyout';

export function exportBuyoutPackage(
  lines: BuyoutLine[],
  projectName: string
) {
  const wb = XLSX.utils.book_new();

  // Header rows
  const headerRows: (string | number)[][] = [
    ['BULK BUYOUT PACKAGE'],
    [`Project: ${projectName}`],
    [`Generated: ${new Date().toLocaleDateString()}`],
    [`Total Lines: ${lines.length}`],
    [], // blank row
  ];

  // Column headers
  const colHeaders = [
    'Material Code',
    'Material Description',
    'Material Spec',
    'Size',
    'Estimate Qty',
    'Buyout Qty',
    'Buyout %',
    'Estimate Unit Cost',
    'Estimate Total',
    'Vendor',
    'Quoted Unit Price',
    'Quoted Total',
    'Savings $',
    'Savings %',
    'PO Number',
    'Status',
    'Source Items',
  ];

  // Data rows
  const dataRows = lines.map((line) => [
    line.materialCostCode || '',
    line.materialDesc,
    line.materialSpec,
    line.size,
    line.totalEstimateQty,
    line.buyoutQty,
    `${line.buyoutPercent}%`,
    line.estimateUnitCost,
    line.estimateTotal,
    line.vendorName || '',
    line.quotedUnitPrice ?? '',
    line.quotedTotal || '',
    line.savings || '',
    line.savingsPercent ? `${line.savingsPercent.toFixed(1)}%` : '',
    line.poNumber || '',
    BUYOUT_STATUS_CONFIG[line.status].label,
    line.sourceItemCount,
  ]);

  // Summary row
  const totalEstimate = lines.reduce((s, l) => s + l.estimateTotal, 0);
  const totalQuoted = lines.reduce((s, l) => s + l.quotedTotal, 0);
  const totalSavings = totalEstimate - totalQuoted;
  const savingsPct = totalEstimate > 0 ? (totalSavings / totalEstimate) * 100 : 0;

  const summaryRows: (string | number)[][] = [
    [], // blank
    [
      'TOTALS', '', '', '', '',
      '',
      '',
      '',
      totalEstimate,
      '',
      '',
      totalQuoted,
      totalSavings,
      `${savingsPct.toFixed(1)}%`,
      '',
      '',
      lines.reduce((s, l) => s + l.sourceItemCount, 0),
    ],
  ];

  const allRows = [...headerRows, colHeaders, ...dataRows, ...summaryRows];
  const ws = XLSX.utils.aoa_to_sheet(allRows);

  // Column widths
  ws['!cols'] = [
    { wch: 16 }, // Material Code
    { wch: 30 }, // Material Description
    { wch: 25 }, // Material Spec
    { wch: 10 }, // Size
    { wch: 12 }, // Estimate Qty
    { wch: 12 }, // Buyout Qty
    { wch: 10 }, // Buyout %
    { wch: 16 }, // Estimate Unit Cost
    { wch: 16 }, // Estimate Total
    { wch: 20 }, // Vendor
    { wch: 16 }, // Quoted Unit Price
    { wch: 16 }, // Quoted Total
    { wch: 14 }, // Savings $
    { wch: 12 }, // Savings %
    { wch: 14 }, // PO Number
    { wch: 14 }, // Status
    { wch: 12 }, // Source Items
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Buyout Package');

  const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_Buyout_Package_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
