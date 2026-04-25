import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pad activity codes to exactly 4 characters with trailing zeros. */
export function normalizeActivityCode(code: string): string {
  if (!code) return '0000';
  return code.padStart(4, '0');
}

/**
 * Compose a 4-character multitrade ACT segment in BUILDING-FIRST format.
 *
 * Produces e.g. "BA01" (building BA, level 1), "BA0R" (building BA, roof),
 * "MD02" (building MD, level 2). This replaces the legacy level-first format
 * ("01BA") which fragmented buildings on Excel sort.
 *
 * Inputs:
 *   bldgSuffix  — building identifier with leading zeros stripped (e.g. "BA", "B2", "MD").
 *                  Must be 1-2 chars. Callers MUST gate on length ≤ 2 before invoking.
 *   levelPrefix — 2-char level prefix from extractMultitradeLevelPrefix /
 *                  extractLevelPrefixFromPattern (e.g. "01", "02", "0R", "00").
 *
 * Behavior:
 *   - Empty bldgSuffix → "0000" (preserves the empty-strip short-circuit from
 *     the legacy memoizedLaborSummary code; e.g. when buildingAct was "0000").
 *   - Missing or "00" levelPrefix → flat building ACT, left-padded to 4 chars
 *     (e.g. "BA" → "00BA"). This matches the "no extractable level" fallback.
 *   - Otherwise → bldgSuffix + levelPrefix (building-first), guaranteed 4 chars
 *     because both inputs are pre-normalized to their padded widths.
 *
 * Invariant: bldgSuffix.length ≤ 2. Throws if violated. This is a regression
 * alarm for future callers that forget the strip-and-gate pattern; with all
 * five active assembly sites gating correctly, the throw never fires in
 * practice. If you hit this in production, the caller is broken — fix the
 * caller, do not soften the helper.
 */
export function composeMultitradeActivity(
  bldgSuffix: string,
  levelPrefix?: string | null
): string {
  if (!bldgSuffix) return '0000';
  if (bldgSuffix.length > 2) {
    throw new Error(
      `[composeMultitradeActivity] bldgSuffix must be ≤2 chars, got "${bldgSuffix}" (length ${bldgSuffix.length}). ` +
      `Caller must gate on length before calling. See src/lib/utils.ts.`
    );
  }
  if (!levelPrefix || levelPrefix === '00') {
    return bldgSuffix.padStart(4, '0');
  }
  return bldgSuffix + levelPrefix;
}
