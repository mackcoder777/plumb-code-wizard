import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';

/**
 * Invariant scan, not a unit test.
 *
 * React Query matches invalidation keys by prefix, so a key that differs from
 * its reading useQuery by one character invalidates nothing, reports no error,
 * and fails silently. Five such keys shipped at once (#12); the append path had
 * three, which is why "Add File" inserted rows, showed a success toast, and
 * left the screen unchanged.
 *
 * A per-hook unit test would not have caught that -- the bug is a mismatch
 * BETWEEN files. So this walks the tree and checks the whole set at once.
 */

const SRC = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__') continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** First segment of a queryKey array, when it is a string literal. */
const FIRST_SEGMENT = /queryKey:\s*\[\s*(['"])([^'"]+)\1/;
/** A queryKey whose first segment is not a literal -- a const or a spread. */
const NON_LITERAL = /queryKey:\s*\[\s*(?!['"])[^\]]/;

interface KeyUse { file: string; line: number; key: string }

function collect(): { reads: Set<string>; invalidations: KeyUse[]; skipped: KeyUse[] } {
  const reads = new Set<string>();
  const invalidations: KeyUse[] = [];
  const skipped: KeyUse[] = [];

  for (const file of walk(SRC)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      const literal = line.match(FIRST_SEGMENT);
      const isRead = /useQuery\(|useInfiniteQuery\(/.test(line) ||
        // useQuery({ ... }) commonly puts queryKey on the following line
        (i > 0 && /useQuery\(|useInfiniteQuery\(/.test(lines[i - 1]));
      const isInvalidation = /invalidateQueries|refetchQueries|removeQueries|cancelQueries/.test(line);

      if (literal) {
        const rel = path.relative(SRC, file);
        if (isInvalidation) invalidations.push({ file: rel, line: i + 1, key: literal[2] });
        else if (isRead) reads.add(literal[2]);
      } else if (NON_LITERAL.test(line) && isInvalidation) {
        skipped.push({ file: path.relative(SRC, file), line: i + 1, key: line.trim() });
      }
    });
  }
  return { reads, invalidations, skipped };
}

describe('query key parity', () => {
  const { reads, invalidations, skipped } = collect();

  it('finds the query keys it is supposed to be checking', () => {
    // Guards the scan itself. If a refactor changes how queryKeys are written,
    // these regexes could silently match nothing and the suite would go green
    // while checking zero invariants.
    expect(reads.size).toBeGreaterThan(5);
    expect(invalidations.length).toBeGreaterThan(5);
  });

  it('every literal invalidation key matches a declared read key', () => {
    const orphans = invalidations.filter(inv => !reads.has(inv.key));
    const detail = orphans
      .map(o => `  ${o.file}:${o.line} invalidates '${o.key}' — no useQuery declares it`)
      .join('\n');
    expect(orphans, `Dead invalidation keys found:\n${detail}\n\nDeclared read keys: ${[...reads].sort().join(', ')}`)
      .toEqual([]);
  });

  it('reports the keys it could not check statically', () => {
    // Not a failure: keys built from consts or spreads (e.g. [TABLE, projectId])
    // cannot be resolved without evaluating the module. Named here so the
    // scan's coverage is visible rather than silently partial -- a green run
    // above does NOT mean every invalidation was verified.
    if (skipped.length > 0) {
      console.info(
        `[queryKeyParity] ${skipped.length} non-literal invalidation key(s) not statically checkable:\n` +
        skipped.map(s => `  ${s.file}:${s.line}`).join('\n')
      );
    }
    expect(Array.isArray(skipped)).toBe(true);
  });
});
