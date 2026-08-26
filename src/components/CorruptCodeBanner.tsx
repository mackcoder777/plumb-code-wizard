import React, { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';

interface SystemMapping {
  id: string;
  system_name: string;
  cost_head: string;
}

interface CorruptCodeBannerProps {
  systemMappings: SystemMapping[];
}

/**
 * `system_mappings.cost_head` has TWO legitimate shapes, both actively written:
 *
 *   "STRM"       — a bare cost head (SystemMappingTab)
 *   "COPR|STRM"  — the documented "material|labor" pair (the apply path in Index)
 *
 * The pipe is the documented separator, NOT corruption. Anything whose
 * pipe-separated segments are alphanumeric is a well-formed value.
 *
 * This banner REPORTS and never rewrites. Cost heads are the PM's decision
 * (CLAUDE.md §20), and the previous "repair" was destructive twice over:
 *
 *   - It stripped non-alphanumerics, turning {"laborCode":"STRM"} into the
 *     meaningless-but-alphanumeric `laborCodeSTRM` — which then passed this
 *     banner's own check, silencing the warning while leaving the row wrong.
 *   - It flagged every pipe as corruption and "cleaned" by keeping only the
 *     segment after the last pipe, so a correct "COPR|STRM" became "STRM",
 *     silently discarding the material code. That damage scaled with how many
 *     mappings the PM had actually applied.
 *
 * A value this component cannot confidently reconstruct is surfaced for a human
 * to resolve. Where the intended value IS recoverable it is shown as text only,
 * so the PM can act on it — no write path exists here.
 */
const SEGMENT = /^[A-Za-z0-9]*$/;

function inspect(mapping: SystemMapping): {
  corrupt: boolean;
  issue: string;
  expected: string | null;
} {
  const raw = mapping.cost_head ?? '';
  const trimmed = raw.trim();

  // The known corruption: an object reached the column and was serialized.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let expected: string | null = null;
    try {
      const parsed = JSON.parse(trimmed);
      const labor = parsed?.laborCode;
      const material = parsed?.materialCode;
      if (typeof labor === 'string' && labor) {
        expected = material ? `${material}|${labor}` : labor;
      }
    } catch {
      // Unparseable — report it as-is rather than guess.
    }
    return { corrupt: true, issue: 'serialized object, not a cost head', expected };
  }

  if (raw !== trimmed) {
    return { corrupt: true, issue: 'leading or trailing whitespace', expected: trimmed };
  }

  // Pipe-separated segments must each be alphanumeric (either shape).
  const segments = trimmed.split('|');
  if (!segments.every(seg => SEGMENT.test(seg))) {
    return { corrupt: true, issue: 'unexpected characters', expected: null };
  }

  return { corrupt: false, issue: '', expected: null };
}

export const CorruptCodeBanner: React.FC<CorruptCodeBannerProps> = ({ systemMappings }) => {
  const flagged = useMemo(
    () => systemMappings.map(m => ({ ...m, ...inspect(m) })).filter(m => m.corrupt),
    [systemMappings]
  );

  if (flagged.length === 0) return null;

  return (
    <div className="bg-destructive/10 border border-destructive/30 text-destructive px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">
          ⚠️ {flagged.length} malformed cost head{flagged.length > 1 ? 's' : ''} detected
        </p>
        <p className="text-xs mt-1 text-destructive/80">
          These system mappings hold a value that is not a cost head. They are reported, not
          repaired — cost-head assignment is yours. Re-assign the system, or have the stored
          value corrected directly.
        </p>
        <ul className="text-xs mt-1 space-y-0.5">
          {flagged.slice(0, 5).map(m => (
            <li key={m.id} className="font-mono">
              {m.system_name}: <span className="line-through">{m.cost_head}</span>
              {m.expected && (
                <> — expected <span className="font-bold">{m.expected}</span></>
              )}
              <span className="text-destructive/60 ml-1">({m.issue})</span>
            </li>
          ))}
          {flagged.length > 5 && (
            <li className="text-destructive/60">…and {flagged.length - 5} more</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default CorruptCodeBanner;
