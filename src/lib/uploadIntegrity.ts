/**
 * Row-count reconciliation for the Excel upload path.
 *
 * The parse worker filters rows as it reads (skipping short rows, and rows with
 * no system or no drawing), then reports `totalRows` as its POST-filter count
 * and streams the same rows out in chunks. The main thread maps each chunk 1:1
 * and concatenates. So the assembled length must equal the reported total
 * exactly -- there is no legitimate path that drops or adds a row between the
 * two numbers.
 *
 * That makes any mismatch a transport or assembly fault: a chunk lost or
 * applied twice. It is worth checking precisely because it is otherwise
 * invisible. A short upload produces a smaller dataset, a smaller budget, and
 * an export that looks exactly like a correct one -- which is the failure mode
 * this codebase keeps producing in other forms.
 *
 * Kept as a pure function rather than inline so the invariant can be tested
 * without standing up a Worker, a Blob URL and a 12,000-row workbook.
 */
export function describeRowCountMismatch(
  assembled: number,
  reported: number,
): string | null {
  if (!Number.isFinite(reported) || reported < 0) {
    return `Upload aborted: the parser reported an invalid row count (${reported}).`;
  }
  if (assembled === reported) return null;

  const diff = assembled - reported;
  const detail = diff < 0
    ? `${Math.abs(diff).toLocaleString()} row(s) were lost in transfer`
    : `${diff.toLocaleString()} row(s) were duplicated in transfer`;

  return `Upload aborted: assembled ${assembled.toLocaleString()} rows but the ` +
    `parser reported ${reported.toLocaleString()} — ${detail}. ` +
    `Nothing was saved. Please retry the upload.`;
}
