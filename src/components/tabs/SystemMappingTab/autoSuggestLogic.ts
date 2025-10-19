import { COST_CODES_DB } from '@/data/costCodes';

export interface SuggestionResult {
  materialCode?: string;
  laborCode?: string;
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
}

// System name patterns for auto-suggestion
const systemPatterns = [
  // Water Systems
  {
    pattern: /cold.*water|domestic.*water|potable|drinking/i,
    materialCode: 'MAT-PIPE-CU',
    laborCode: '2213',
    confidence: 'high' as const,
    reason: 'Cold/domestic water system'
  },
  {
    pattern: /hot.*water|hw|dhw/i,
    materialCode: 'MAT-PIPE-CU',
    laborCode: '2213',
    confidence: 'high' as const,
    reason: 'Hot water system'
  },
  {
    pattern: /irrigation|sprinkler|landscape/i,
    laborCode: '2213',
    confidence: 'high' as const,
    reason: 'Irrigation/sprinkler system'
  },
  
  // Waste Systems
  {
    pattern: /waste|sanitary|sewer|soil/i,
    materialCode: 'MAT-PIPE-CI',
    laborCode: '2212',
    confidence: 'high' as const,
    reason: 'Waste/sanitary system'
  },
  {
    pattern: /vent|dwv/i,
    materialCode: 'MAT-PIPE-CI',
    laborCode: '2212',
    confidence: 'high' as const,
    reason: 'Vent system'
  },
  
  // Storm Systems
  {
    pattern: /storm|rain|roof.*drain|overflow/i,
    materialCode: 'MAT-PIPE-CI',
    laborCode: '2214',
    confidence: 'high' as const,
    reason: 'Storm drainage system'
  },
  
  // Gas Systems
  {
    pattern: /gas|fuel|natural.*gas/i,
    laborCode: '2215',
    confidence: 'high' as const,
    reason: 'Gas piping system'
  },
  
  // Underground
  {
    pattern: /underground|below.*grade|ug/i,
    laborCode: '2211',
    confidence: 'medium' as const,
    reason: 'Underground location'
  },
  
  // Fixtures
  {
    pattern: /fixture|toilet|lavatory|sink/i,
    materialCode: 'MAT-FIXT',
    laborCode: '2216',
    confidence: 'medium' as const,
    reason: 'Fixture system'
  },
  
  // Equipment
  {
    pattern: /equipment|heater|pump|tank/i,
    laborCode: '2217',
    confidence: 'medium' as const,
    reason: 'Equipment installation'
  },
];

/**
 * Analyzes a system name and suggests appropriate cost codes
 */
export function suggestCodesForSystem(systemName: string): SuggestionResult {
  const result: SuggestionResult = {
    confidence: 'low',
    reasons: [],
  };

  // Try to match against known patterns
  for (const pattern of systemPatterns) {
    if (pattern.pattern.test(systemName)) {
      if (pattern.materialCode && !result.materialCode) {
        result.materialCode = pattern.materialCode;
      }
      if (pattern.laborCode && !result.laborCode) {
        result.laborCode = pattern.laborCode;
      }
      result.confidence = pattern.confidence;
      result.reasons.push(pattern.reason);
      
      // If we have both codes with high confidence, we can stop
      if (result.materialCode && result.laborCode && result.confidence === 'high') {
        break;
      }
    }
  }

  // Fallback: keyword matching for material codes
  if (!result.materialCode) {
    const lowerSystem = systemName.toLowerCase();
    
    if (lowerSystem.includes('copper') || lowerSystem.includes('cu')) {
      result.materialCode = 'MAT-PIPE-CU';
      result.reasons.push('Copper material detected');
    } else if (lowerSystem.includes('cast iron') || lowerSystem.includes('ci')) {
      result.materialCode = 'MAT-PIPE-CI';
      result.reasons.push('Cast iron material detected');
    } else if (lowerSystem.includes('pvc') || lowerSystem.includes('plastic')) {
      result.materialCode = 'MAT-PIPE-PVC';
      result.reasons.push('PVC material detected');
    }
  }

  // If we found any suggestions, upgrade from 'low' confidence
  if ((result.materialCode || result.laborCode) && result.confidence === 'low') {
    result.confidence = 'medium';
  }

  return result;
}

/**
 * Gets a confidence score (0-100) based on the confidence level
 */
export function getConfidenceScore(confidence: 'high' | 'medium' | 'low'): number {
  switch (confidence) {
    case 'high':
      return 90;
    case 'medium':
      return 70;
    case 'low':
      return 40;
  }
}

/**
 * Validates that a code exists in the database
 */
export function validateCode(code: string, type: 'material' | 'labor'): boolean {
  if (type === 'material') {
    return COST_CODES_DB.material.some(c => c.code === code);
  } else {
    return COST_CODES_DB.fieldLabor.some(c => c.code === code);
  }
}

/**
 * Generates suggestions for all systems
 */
export function generateAllSuggestions(systems: string[]): Record<string, SuggestionResult> {
  const suggestions: Record<string, SuggestionResult> = {};
  
  for (const system of systems) {
    const suggestion = suggestCodesForSystem(system);
    if (suggestion.materialCode || suggestion.laborCode) {
      suggestions[system] = suggestion;
    }
  }
  
  return suggestions;
}
