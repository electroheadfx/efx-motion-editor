// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Phase 60 (ZOOM-05) — the SINGLE-AUTHORITY audit for the Studio timeline pitch.
 *
 * Exactly two files own a numeric pitch:
 *   - `view/physicsPaintTimelineZoom.ts` — the live session authority;
 *   - `view/timelineRailDesign.ts`       — the base design tokens it multiplies.
 *
 * Every other `.ts` / `.tsx` file under `physic-paint/view/` and
 * `physic-paint/hooks/` is a consumer. A consumer may not declare a numeric
 * pitch constant, may not arithmetic a bare 18 into a frame projection, may not
 * read the static `TIMELINE_GEOMETRY.cellPitch` token and may not name any
 * retired pitch symbol.
 *
 * The audit fails LOUDLY rather than passing vacuously:
 *   - it asserts the scan actually found files and every named consumer;
 *   - every absence rule is proved against a seeded positive first;
 *   - the identifier rule is proved NOT to flag a comment-only mention, so the
 *     rules read code rather than documentation;
 *   - every violation is reported with its file, all at once.
 */

const VIEW_DIR = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = resolve(VIEW_DIR, '../hooks');

/** The only files allowed to contain a numeric pitch definition. */
const PERMITTED_FILES: ReadonlySet<string> = new Set([
  'view/physicsPaintTimelineZoom.ts',
  'view/timelineRailDesign.ts',
]);

/** The consumers the requirement names by hand — each must exist in the scan. */
const NAMED_CONSUMERS: readonly string[] = [
  'PhysicsPaintWorkflowStrip.tsx',
  'PhysicsPaintTrackRow.tsx',
  'TimelineMotionChannels.tsx',
  'TimelineMotionKeyDrag.tsx',
  'PhysicsPaintKeyRail.tsx',
  'PhysicsPaintLoopClipRail.tsx',
  'physicsPaintLoopClipPresentation.ts',
  'soundBandGeometry.ts',
  'timelineRailDesign.ts',
  'physicsPaintTimelineZoom.ts',
  'usePhysicsPaintRulerScrub.ts',
  'usePhysicsPaintCrossTrackDrag.ts',
];

interface ScannedSource {
  readonly name: string;
  readonly relativePath: string;
  readonly text: string;
}

function collectSources(directory: string, prefix: 'view' | 'hooks'): ScannedSource[] {
  return readdirSync(directory)
    .filter((name) => /\.(ts|tsx)$/.test(name) && !name.includes('.test.'))
    .sort()
    .map((name) => ({
      name,
      relativePath: `${prefix}/${name}`,
      text: readFileSync(resolve(directory, name), 'utf8'),
    }));
}

const SCANNED_SOURCES: readonly ScannedSource[] = [
  ...collectSources(VIEW_DIR, 'view'),
  ...collectSources(HOOKS_DIR, 'hooks'),
];

function sourceByPath(relativePath: string): ScannedSource {
  const found = SCANNED_SOURCES.find((source) => source.relativePath === relativePath);
  if (found === undefined) throw new Error(`Audit scan did not collect ${relativePath}`);
  return found;
}

/**
 * Strip `/* ... *\/` blocks and `//` line comments before any rule runs, so a
 * rule reads code and never documentation. A `//` that immediately follows a
 * `:` is a protocol inside a string, not a comment, and survives.
 */
function stripComments(code: string): string {
  let stripped = '';
  let index = 0;
  while (index < code.length) {
    const character = code[index]!;
    const next = code[index + 1];
    if (character === '/' && next === '*') {
      const end = code.indexOf('*/', index + 2);
      const block = end === -1 ? code.slice(index) : code.slice(index, end + 2);
      stripped += '\n'.repeat(block.split('\n').length - 1);
      index = end === -1 ? code.length : end + 2;
      continue;
    }
    if (character === '/' && next === '/') {
      if (stripped.endsWith(':')) {
        stripped += character;
        index += 1;
        continue;
      }
      const newline = code.indexOf('\n', index + 2);
      index = newline === -1 ? code.length : newline;
      continue;
    }
    stripped += character;
    index += 1;
  }
  return stripped;
}

/** Rule 1: no retired pitch identifier, in code, anywhere outside the owners. */
const RETIRED_IDENTIFIER_PATTERN =
  /\bROTO_CELL_WIDTH_PX\b|\bRULER_TICK_WIDTH_PX\b|\bROW_CELL_WIDTH_PX\b|\bDEFAULT_CELL_WIDTH_PX\b/g;

function findRetiredIdentifiers(code: string): string[] {
  return code.match(RETIRED_IDENTIFIER_PATTERN) ?? [];
}

/** Rule 2: no constant named for a pitch/cell width initialised with a number. */
const PITCH_CONSTANT_PATTERN =
  /\b(?:const|let|var)\s+[A-Za-z0-9_$]*(?:pitch|cell_width|cellwidth)[A-Za-z0-9_$]*\s*(?::[^=;]+)?=\s*[0-9]/gi;

function findNumericPitchConstants(code: string): string[] {
  return code.match(PITCH_CONSTANT_PATTERN) ?? [];
}

/** Rule 3: no bare 18 multiplied or divided in a frame projection. */
const BARE_EIGHTEEN_PATTERNS: readonly RegExp[] = [/[*/]\s*18\b/g, /\b18\s*\*/g];

function findBareEighteenArithmetic(code: string): string[] {
  return BARE_EIGHTEEN_PATTERNS.flatMap((pattern) => code.match(pattern) ?? []);
}

/** Rule 4: the static pitch token is read only by the file that defines it. */
const STATIC_PITCH_TOKEN_PATTERN = /\bTIMELINE_GEOMETRY\.cellPitch\b/g;

function findStaticPitchTokenReads(code: string): string[] {
  return code.match(STATIC_PITCH_TOKEN_PATTERN) ?? [];
}

describe('Phase 60 (ZOOM-05) timeline zoom single-authority audit', () => {
  it('scans the real view and hooks surface, including every named consumer', () => {
    // Vacuity guard 1: a moved path or a broken filter must fail, not pass.
    expect(SCANNED_SOURCES.length).toBeGreaterThanOrEqual(25);
    const names = SCANNED_SOURCES.map((source) => source.name);
    for (const consumer of NAMED_CONSUMERS) {
      expect(names).toContain(consumer);
    }
    // Vacuity guard 2: every scanned file actually produced content.
    for (const source of SCANNED_SOURCES) {
      expect(source.text.length, `${source.relativePath} read as empty`).toBeGreaterThan(0);
    }
    // The allowlist is exactly the two owners — never a third entry.
    expect(PERMITTED_FILES.size).toBe(2);
    for (const permitted of PERMITTED_FILES) {
      expect(sourceByPath(permitted).text.length).toBeGreaterThan(0);
    }
  });

  it('proves each absence rule against a seeded positive and a comment-only negative', () => {
    // Every rule must flag its own sample; a broken regex cannot pass silently.
    expect(findRetiredIdentifiers(stripComments('const ROTO_CELL_WIDTH_PX = 18;'))).toContain('ROTO_CELL_WIDTH_PX');
    expect(findNumericPitchConstants(stripComments('const X_CELL_WIDTH_PX = 18;'))).not.toHaveLength(0);
    expect(findBareEighteenArithmetic(stripComments('frame * 18'))).not.toHaveLength(0);
    expect(findStaticPitchTokenReads(stripComments('TIMELINE_GEOMETRY.cellPitch'))).not.toHaveLength(0);

    // The rules read code, not comments: a doc mention is not a declaration.
    const lineComment = stripComments('// const ROTO_CELL_WIDTH_PX = 18;');
    expect(lineComment).not.toContain('ROTO_CELL_WIDTH_PX');
    expect(findRetiredIdentifiers(lineComment)).toHaveLength(0);
    const blockComment = stripComments('/* const DEFAULT_CELL_WIDTH_PX = 18; */');
    expect(blockComment).not.toContain('DEFAULT_CELL_WIDTH_PX');
    expect(findRetiredIdentifiers(blockComment)).toHaveLength(0);
  });

  it('no numeric pitch constant, bare 18 or static pitch token survives outside the two owners', () => {
    const violations: string[] = [];
    for (const source of SCANNED_SOURCES) {
      if (PERMITTED_FILES.has(source.relativePath)) continue;
      const code = stripComments(source.text);
      for (const hit of findRetiredIdentifiers(code)) {
        violations.push(`${source.relativePath}: retired pitch identifier \`${hit}\``);
      }
      for (const hit of findNumericPitchConstants(code)) {
        violations.push(`${source.relativePath}: numeric pitch constant \`${hit}\``);
      }
      for (const hit of findBareEighteenArithmetic(code)) {
        violations.push(`${source.relativePath}: bare-18 frame arithmetic \`${hit}\``);
      }
      for (const hit of findStaticPitchTokenReads(code)) {
        violations.push(`${source.relativePath}: static pitch token \`${hit}\``);
      }
    }
    expect(
      violations,
      `Phase 60 ZOOM-05: numeric pitch definitions found outside ${[...PERMITTED_FILES].join(' and ')}:\n${violations.join('\n')}`,
    ).toEqual([]);
  });
});
