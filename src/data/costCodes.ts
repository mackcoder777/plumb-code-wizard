import { CostCodeEntry, AutomationRule } from "@/types/estimate";

export const COST_CODES_DB = {
  fieldLabor: [
    { code: "2210", description: "ROUGH-IN PLUMBING", category: "L" as const, keywords: ["rough", "rough-in", "roughing"] },
    { code: "2211", description: "UNDERGROUND PLUMBING", category: "L" as const, keywords: ["underground", "below grade", "ug"] },
    { code: "2212", description: "ABOVE GROUND WASTE & VENT", category: "L" as const, keywords: ["waste", "vent", "dwv", "drainage"] },
    { code: "2213", description: "WATER PIPING", category: "L" as const, keywords: ["water", "domestic", "potable"] },
    { code: "2214", description: "STORM DRAINAGE", category: "L" as const, keywords: ["storm", "rain", "drainage", "overflow"] },
    { code: "2215", description: "GAS PIPING", category: "L" as const, keywords: ["gas", "natural gas", "fuel"] },
    { code: "2216", description: "FIXTURES INSTALLATION", category: "L" as const, keywords: ["fixture", "toilet", "sink", "lavatory"] },
    { code: "2217", description: "EQUIPMENT INSTALLATION", category: "L" as const, keywords: ["equipment", "heater", "pump", "tank"] },
    { code: "2218", description: "INSULATION", category: "L" as const, keywords: ["insulation", "insulate", "wrap"] },
    { code: "2219", description: "TESTING", category: "L" as const, keywords: ["test", "testing", "inspection"] },
    { code: "2220", description: "HANGERS & SUPPORTS", category: "L" as const, keywords: ["hanger", "support", "brace", "seismic"] },
  ],
  material: [
    { code: "MAT-PIPE-CI", description: "CAST IRON PIPE", category: "M" as const, keywords: ["cast iron", "ci", "no-hub"] },
    { code: "MAT-PIPE-CU", description: "COPPER PIPE", category: "M" as const, keywords: ["copper", "cu", "type l", "type k"] },
    { code: "MAT-PIPE-PVC", description: "PVC PIPE", category: "M" as const, keywords: ["pvc", "plastic", "schedule"] },
    { code: "MAT-FITT", description: "FITTINGS", category: "M" as const, keywords: ["fitting", "elbow", "tee", "coupling", "bend"] },
    { code: "MAT-VALV", description: "VALVES", category: "M" as const, keywords: ["valve", "gate", "ball", "check"] },
    { code: "MAT-FIXT", description: "FIXTURES", category: "M" as const, keywords: ["fixture", "toilet", "sink", "faucet"] },
    { code: "MAT-HANG", description: "HANGERS & SUPPORTS", category: "M" as const, keywords: ["hanger", "clamp", "strap", "support"] },
    { code: "MAT-INSL", description: "INSULATION", category: "M" as const, keywords: ["insulation", "fiberglass", "foam"] },
    { code: "MAT-DRAIN", description: "DRAINS", category: "M" as const, keywords: ["drain", "floor drain", "roof drain"] },
  ]
};

export const AUTOMATION_RULES: AutomationRule[] = [
  {
    pattern: /storm|drain/i,
    field: "system",
    codes: { material: "MAT-PIPE-CI", labor: "2214" },
    description: "Storm drainage systems"
  },
  {
    pattern: /overflow/i,
    field: "system",
    codes: { material: "MAT-PIPE-CI", labor: "2214" },
    description: "Overflow drainage"
  },
  {
    pattern: /domestic|water/i,
    field: "system",
    codes: { material: "MAT-PIPE-CU", labor: "2213" },
    description: "Domestic water systems"
  },
  {
    pattern: /waste|vent|dwv/i,
    field: "system",
    codes: { material: "MAT-PIPE-CI", labor: "2212" },
    description: "Waste and vent systems"
  },
  {
    pattern: /cast iron|ci|no-hub/i,
    field: "materialDesc",
    codes: { material: "MAT-PIPE-CI" },
    description: "Cast iron materials"
  },
  {
    pattern: /copper|cu/i,
    field: "materialDesc",
    codes: { material: "MAT-PIPE-CU" },
    description: "Copper materials"
  },
  {
    pattern: /pvc|plastic/i,
    field: "materialDesc",
    codes: { material: "MAT-PIPE-PVC" },
    description: "PVC materials"
  },
  {
    pattern: /fitting|elbow|tee|bend|coupling/i,
    field: "itemName",
    codes: { material: "MAT-FITT" },
    description: "Pipe fittings"
  },
  {
    pattern: /valve|gate|ball|check/i,
    field: "itemName",
    codes: { material: "MAT-VALV" },
    description: "Valves"
  },
  {
    pattern: /hanger|support|strap|clamp/i,
    field: "itemType",
    codes: { material: "MAT-HANG", labor: "2220" },
    description: "Hangers and supports"
  },
  {
    pattern: /p1|p2|park|garage|below/i,
    field: "floor",
    codes: { labor: "2211" },
    description: "Below grade work"
  },
  {
    pattern: /roof|penthouse/i,
    field: "floor",
    codes: { labor: "2214" },
    description: "Roof level work"
  }
];