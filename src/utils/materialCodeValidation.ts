export interface MaterialCodeWarning {
  expectedCode: string;
  expectedDescription: string;
  reason: string;
}

interface ValidationRule {
  keywords: RegExp[];
  expectedCode: string;
  expectedDescription: string;
}

const VALIDATION_RULES: ValidationRule[] = [
  {
    keywords: [/copper/i, /\bcu\b/i, /type[- ]k/i, /type[- ]l/i, /type[- ]m/i, /wrought/i],
    expectedCode: '9512',
    expectedDescription: 'COPPER PIPE & FITTINGS',
  },
  {
    keywords: [/cast iron/i, /ci[- ]no[- ]hub/i, /ci[- ]hub/i, /no[- ]hub/i, /\bcinh\b/i, /soil pipe/i],
    expectedCode: '9511',
    expectedDescription: 'CAST IRON PIPE & FITTINGS',
  },
  {
    keywords: [/carbon steel/i, /cs std/i, /\bcsst\b/i, /black steel/i, /galvanized steel/i, /\bschd\b/i, /schedule 40/i, /schedule 80/i],
    expectedCode: '9513',
    expectedDescription: 'STEEL PIPE & FITTINGS',
  },
  {
    keywords: [/stainless/i, /\bss\b/i, /\b304\b/i, /\b316\b/i],
    expectedCode: '9514',
    expectedDescription: 'STAINLESS STEEL PIPE & FTGS',
  },
  {
    keywords: [/\bpvc\b/i, /\bcpvc\b/i, /\babs\b/i, /\bhdpe\b/i, /\bppe\b/i, /\bpp\b/i, /plastic pipe/i, /polyethylene/i, /polypropylene/i],
    expectedCode: '9515',
    expectedDescription: 'PLASTIC PIPE & FITTINGS',
  },
  {
    keywords: [/ductile iron/i, /\bdi\b/i, /mechanical joint/i, /push[- ]on joint/i],
    expectedCode: '9516',
    expectedDescription: 'DUCTILE PIPE & FITTINGS',
  },
  {
    keywords: [/sleeve/i, /insert/i, /wall sleeve/i, /core drill/i, /escutcheon/i],
    expectedCode: '9519',
    expectedDescription: 'SLEEVES & INSERTS',
  },
  {
    keywords: [/hanger/i, /clevis/i, /trapeze/i, /riser clamp/i, /pipe clamp/i, /strut/i, /unistrut/i, /support/i],
    expectedCode: '9518',
    expectedDescription: 'HANGERS & SUPPORTS',
  },
  {
    keywords: [/valve/i, /\bgate\b/i, /\bball valve\b/i, /\bcheck valve\b/i, /\bbutterfly\b/i, /\bglobe\b/i, /\bangle valve\b/i],
    expectedCode: '9517',
    expectedDescription: 'VALVES',
  },
  {
    keywords: [/insulation/i, /fiberglass insul/i, /elastomeric/i, /armaflex/i, /foam insul/i],
    expectedCode: '9521',
    expectedDescription: 'PIPE INSULATION',
  },
];

// Codes that should NEVER receive structural pipe/fitting material
const INCOMPATIBLE_FAMILIES: Record<string, string[]> = {
  '9512': ['9730', '9731', '9732', '9733', '9734', '9735', '9900', '9901'],
  '9511': ['9730', '9731', '9732', '9733', '9734', '9735', '9900', '9901'],
  '9513': ['9730', '9731', '9732', '9733', '9734', '9735', '9900', '9901'],
  '9514': ['9730', '9731', '9732', '9733', '9734', '9735', '9900', '9901'],
  '9515': ['9730', '9731', '9732', '9733', '9734', '9735', '9900', '9901'],
  '9516': ['9730', '9731', '9732', '9733', '9734', '9735', '9900', '9901'],
  '9517': ['9730', '9731', '9732', '9733', '9734', '9735', '9900', '9901'],
  '9518': ['9730', '9731', '9732', '9733', '9734', '9735', '9900', '9901'],
};

export function validateMaterialCodeAssignment(
  materialSpec: string,
  assignedCode: string
): MaterialCodeWarning | null {
  if (!materialSpec || !assignedCode) return null;

  for (const rule of VALIDATION_RULES) {
    const matched = rule.keywords.some((kw) => kw.test(materialSpec));
    if (!matched) continue;

    // If assigned code matches expected — no warning
    if (assignedCode === rule.expectedCode) return null;

    // Check if the assigned code is in an incompatible family
    const incompatible = INCOMPATIBLE_FAMILIES[rule.expectedCode];
    if (incompatible && incompatible.includes(assignedCode)) {
      return {
        expectedCode: rule.expectedCode,
        expectedDescription: rule.expectedDescription,
        reason: `"${materialSpec}" appears to be ${rule.expectedDescription} material but is assigned to code ${assignedCode}. Expected: ${rule.expectedCode} (${rule.expectedDescription}).`,
      };
    }

    // Assigned code is in a different family but not on the explicit incompatible list — soft warning
    if (assignedCode.startsWith('97') || assignedCode.startsWith('99')) {
      return {
        expectedCode: rule.expectedCode,
        expectedDescription: rule.expectedDescription,
        reason: `"${materialSpec}" looks like ${rule.expectedDescription} but is assigned to code ${assignedCode}. Expected: ${rule.expectedCode} (${rule.expectedDescription}).`,
      };
    }
  }

  return null;
}

export function validateAllMaterialMappings(
  groups: Array<{ materialSpec: string; assignedCode: string }>
): Array<{ materialSpec: string; assignedCode: string; warning: MaterialCodeWarning }> {
  const results = [];
  for (const group of groups) {
    const warning = validateMaterialCodeAssignment(group.materialSpec, group.assignedCode);
    if (warning) {
      results.push({ ...group, warning });
    }
  }
  return results;
}
