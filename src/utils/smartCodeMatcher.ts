import { CostCode } from '@/hooks/useCostCodes';

// Common plumbing/construction abbreviation mappings
const ABBREVIATIONS: Record<string, string[]> = {
  'comp': ['compressed', 'compressor'],
  'air': ['air'],
  'nitr': ['nitrogen'],
  'nitro': ['nitrogen'],
  'argo': ['argon'],
  'hpn': ['high purity nitrogen', 'hp nitrogen'],
  'lpgs': ['low pressure gas', 'lp gas'],
  'hpwv': ['high purity waste', 'hp waste', 'high purity vent'],
  'hwt': ['hot water', 'hotwater'],
  'cwt': ['cold water', 'coldwater'],
  'thl': ['tool hookup', 'toolhookup'],
  'pcw': ['process cooling water', 'process chilled water'],
  'diw': ['deionized water', 'di water'],
  'vac': ['vacuum'],
  'exh': ['exhaust'],
  'vent': ['vent', 'venting'],
  'waste': ['waste'],
  'drain': ['drain', 'drainage'],
  'storm': ['storm', 'stormwater'],
  'sani': ['sanitary'],
  'dw': ['domestic water'],
  'cda': ['clean dry air'],
  'ucw': ['utility cooling water'],
  'chw': ['chilled water'],
  'hw': ['hot water', 'heating water'],
  'cw': ['cold water', 'cooling water'],
  'steam': ['steam'],
  'cond': ['condensate'],
  'gas': ['gas', 'natural gas'],
  'fire': ['fire', 'fire protection'],
  'sprink': ['sprinkler'],
  'med': ['medical'],
  'lab': ['laboratory', 'lab'],
  'acid': ['acid'],
  'chem': ['chemical'],
  'solv': ['solvent'],
  'fuel': ['fuel'],
  'oil': ['oil'],
  'ref': ['refrigerant'],
};

// Expand abbreviations in a string
const expandAbbreviations = (text: string): string[] => {
  const words = text.toLowerCase().split(/[\s\-_\/]+/);
  const variations: string[] = [text.toLowerCase()];
  
  for (const word of words) {
    const expansions = ABBREVIATIONS[word];
    if (expansions) {
      for (const expansion of expansions) {
        variations.push(text.toLowerCase().replace(word, expansion));
      }
    }
  }
  
  return [...new Set(variations)];
};

// Calculate similarity between two strings (0-1)
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // One contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    const shorter = s1.length < s2.length ? s1 : s2;
    const longer = s1.length < s2.length ? s2 : s1;
    return shorter.length / longer.length * 0.95;
  }
  
  // Word-based matching
  const words1 = s1.split(/[\s\-_\/]+/).filter(w => w.length > 1);
  const words2 = s2.split(/[\s\-_\/]+/).filter(w => w.length > 1);
  
  let matchedWords = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
        matchedWords++;
        break;
      }
    }
  }
  
  if (words1.length > 0 && matchedWords > 0) {
    return (matchedWords / Math.max(words1.length, words2.length)) * 0.85;
  }
  
  // Levenshtein distance for fuzzy matching
  const maxLen = Math.max(s1.length, s2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(s1, s2);
  const similarity = 1 - (distance / maxLen);
  
  return similarity * 0.7; // Reduce confidence for fuzzy matches
};

// Levenshtein distance algorithm
const levenshteinDistance = (s1: string, s2: string): number => {
  const m = s1.length;
  const n = s2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  
  return dp[m][n];
};

export interface MatchResult {
  code: string;
  description: string;
  category: 'L' | 'M' | 'O' | 'R' | 'S';
  confidence: number;
  matchReason: string;
}

// Find the best matching cost code for a system name
export const findBestMatch = (
  systemName: string,
  costCodes: CostCode[],
  preferredCategory?: 'L' | 'M'
): MatchResult | null => {
  if (!systemName || !costCodes || costCodes.length === 0) {
    return null;
  }

  const searchTerms = expandAbbreviations(systemName);
  const candidates: MatchResult[] = [];
  
  for (const code of costCodes) {
    let bestSimilarity = 0;
    let bestReason = '';
    
    // Check code match (e.g., "HPN2" matches code "HPN2")
    const codeUpper = code.code.toUpperCase();
    const systemUpper = systemName.toUpperCase().replace(/[\s\-_\/]+/g, '');
    
    if (codeUpper === systemUpper || systemUpper.includes(codeUpper) || codeUpper.includes(systemUpper)) {
      bestSimilarity = 0.95;
      bestReason = `Code match: "${code.code}"`;
    }
    
    // Check description match with all search term variations
    for (const term of searchTerms) {
      const similarity = calculateSimilarity(term, code.description);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestReason = `Description match: "${code.description}"`;
      }
      
      // Also check against code
      const codeSimilarity = calculateSimilarity(term, code.code);
      if (codeSimilarity > bestSimilarity) {
        bestSimilarity = codeSimilarity;
        bestReason = `Code match: "${code.code}"`;
      }
    }
    
    // Only consider matches with reasonable confidence
    if (bestSimilarity >= 0.4) {
      candidates.push({
        code: code.code,
        description: code.description,
        category: code.category,
        confidence: bestSimilarity,
        matchReason: bestReason,
      });
    }
  }
  
  if (candidates.length === 0) {
    return null;
  }
  
  // Sort by confidence (descending), then prefer the specified category
  candidates.sort((a, b) => {
    // First by confidence
    if (Math.abs(a.confidence - b.confidence) > 0.1) {
      return b.confidence - a.confidence;
    }
    // Then by preferred category
    if (preferredCategory) {
      if (a.category === preferredCategory && b.category !== preferredCategory) return -1;
      if (b.category === preferredCategory && a.category !== preferredCategory) return 1;
    }
    // Then by confidence again for close matches
    return b.confidence - a.confidence;
  });
  
  return candidates[0];
};

// Find matches for multiple systems at once (more efficient)
export const findMatchesForSystems = (
  systems: string[],
  costCodes: CostCode[],
  preferredCategory?: 'L' | 'M'
): Map<string, MatchResult | null> => {
  const results = new Map<string, MatchResult | null>();
  
  for (const system of systems) {
    const normalizedSystem = system.toLowerCase().trim();
    if (!results.has(normalizedSystem)) {
      results.set(normalizedSystem, findBestMatch(system, costCodes, preferredCategory));
    }
  }
  
  return results;
};
