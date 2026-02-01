import { CostCodeEntry, AutomationRule } from "@/types/estimate";

// NOTE: This file contains ONLY fallback/example codes.
// Real cost codes are loaded from the database (cost_codes table).
// These hardcoded codes should be empty to avoid confusion with real codes.

export const COST_CODES_DB = {
  // Labor codes are loaded from database - no hardcoded fallbacks
  fieldLabor: [] as { code: string; description: string; category: "L"; keywords: string[] }[],
  
  // Material codes are loaded from database - no hardcoded fallbacks
  material: [] as { code: string; description: string; category: "M"; keywords: string[] }[],
};

// Automation rules are disabled - they contained fake placeholder codes
export const AUTOMATION_RULES: AutomationRule[] = [];