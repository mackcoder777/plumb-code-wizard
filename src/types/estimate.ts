export interface EstimateItem {
  id: number | string;  // number for freshly uploaded, string (UUID) for database items
  drawing: string;
  system: string;
  floor: string;
  zone: string;
  symbol: string;
  estimator: string;
  materialSpec: string;
  itemType: string;
  reportCat: string;
  trade: string;
  materialDesc: string;
  itemName: string;
  size: string;
  quantity: number;
  listPrice: number;
  materialDollars: number;
  weight: number;
  hours: number;
  laborDollars: number;
  costCode: string;           // Labor cost code
  materialCostCode: string;   // Material cost code
  suggestedCodes: CostCodeSuggestion[];
}

export interface CostCodeSuggestion {
  code: string;
  type: 'material' | 'labor';
  confidence: number;
  reason: string;
}

export interface CostCodeEntry {
  code: string;
  description: string;
  category: 'L' | 'M';
  keywords: string[];
}

export interface AutomationRule {
  pattern: RegExp;
  field: string;
  codes: {
    material?: string;
    labor?: string;
  };
  description: string;
}

export interface ProjectStats {
  totalItems: number;
  totalMaterial: number;
  totalHours: number;
  itemsCoded: number;
  codingCompletion: number;
}

export interface SystemMapping {
  system: string;
  materialCode?: string;
  laborCode?: string;
  itemCount: number;
}

export interface SystemMappingState {
  mappings: Record<string, { materialCode?: string; laborCode?: string }>;
  appliedAt?: Date;
}