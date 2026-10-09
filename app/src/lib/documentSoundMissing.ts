/**
 * 261009-ofk — disk-based missing-file detection for document sound clips.
 *
 * A clip is MISSING when the file at its `sourcePath` does not resolve on
 * disk (never "not inside the .mce package"). The helpers are dependency-free
 * so the Studio resolver, tests, and any future consumer share one law.
 */

/**
 * Is the given sourcePath in the missing set?
 * `null` (not probed yet) reports present — no false-missing flash at boot.
 */
export function isSoundSourceMissing(
  missing: ReadonlySet<string> | null,
  sourcePath: string,
): boolean {
  if (missing === null) return false;
  return missing.has(sourcePath);
}

/**
 * Probe each distinct sourcePath and collect the ones that do not resolve.
 * A probe failure (throw) counts as missing — fail-closed.
 */
export async function collectMissingSoundSourcePaths(
  sourcePaths: readonly string[],
  probeResolves: (sourcePath: string) => Promise<boolean>,
): Promise<ReadonlySet<string>> {
  const distinct = [...new Set(sourcePaths)];
  const missing = new Set<string>();
  for (const sourcePath of distinct) {
    try {
      const resolves = await probeResolves(sourcePath);
      if (!resolves) missing.add(sourcePath);
    } catch {
      missing.add(sourcePath);
    }
  }
  return missing;
}
