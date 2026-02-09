export type BuyoutStatus = 'not_started' | 'quoted' | 'awarded' | 'po_issued' | 'delivered';

export interface BuyoutLine {
  id: string; // deterministic key from materialSpec+size
  materialSpec: string;
  size: string;
  materialDesc: string;
  totalEstimateQty: number;
  buyoutPercent: number;
  buyoutQty: number;
  estimateUnitCost: number;
  estimateTotal: number;
  materialCostCode: string;
  vendorName: string;
  quotedUnitPrice: number | null;
  quotedTotal: number;
  savings: number;
  savingsPercent: number;
  poNumber: string;
  status: BuyoutStatus;
  sourceItemCount: number;
}

export interface BuyoutVendorData {
  vendorName: string;
  quotedUnitPrice: number | null;
  poNumber: string;
  status: BuyoutStatus;
  materialCostCode: string;
}

export interface BuyoutSummary {
  totalEstimateValue: number;
  totalQuotedValue: number;
  totalSavings: number;
  totalSavingsPercent: number;
  totalLines: number;
  awardedLines: number;
  byMaterialCode: Record<string, { code: string; estimateValue: number; quotedValue: number; savings: number }>;
}

export const BUYOUT_STATUS_CONFIG: Record<BuyoutStatus, { label: string; color: string; bgColor: string }> = {
  not_started: { label: 'Not Started', color: 'text-muted-foreground', bgColor: 'bg-muted' },
  quoted: { label: 'Quoted', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  awarded: { label: 'Awarded', color: 'text-green-700', bgColor: 'bg-green-100' },
  po_issued: { label: 'PO Issued', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  delivered: { label: 'Delivered', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
};
