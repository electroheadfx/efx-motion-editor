import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * DOC-04 clean-break grep contract (Phase 45-07).
 *
 * The audit standard is "the code does not exist" (D-02): this test walks
 * app/src, app/src-tauri/src, and packages/efx-physic-paint/src and proves
 * that no reference to the legacy one-track Physic Paint persistence/format
 * surface remains outside the explicit allowlist. The RED failure list of
 * this test IS the deletion checklist for the phase.
 *
 * Comment-stripping: every line is passed through a stateful stripper that
 * removes `//` line comments and `/* ... *​/` block comments (tracking
 * multi-line block state) while preserving string literals, so header prose
 * cannot self-invalidate the audit and URLs inside strings are not mistaken
 * for comments.
 *
 * Allowlist (exact relative paths, 11-token check): the gate detection
 * module must reference legacy tokens to detect them; nothing else may.
 *   - app/src/efx-paint/document/efxPaintCleanBreak.ts
 *   - app/src/efx-paint/document/efxPaintCleanBreak.test.ts
 *   - app/src/efx-paint/document/__fixtures__/* (legacy-shaped committed fixtures)
 *   - app/src/efx-paint/efxPaintCleanBreakContract.test.ts (this file)
 *
 * Carrier check: 'physic_paint_outputs' remains present as the OPAQUE
 * presence carrier for the gate (45-02 design) — declared in
 * models/project.rs and types/project.ts, referenced by the gate module and
 * its fixtures, and named by the Rust carrier mechanics (the struct
 * construction in commands/project.rs and the opaque round-trip proof in
 * project_io.rs, where the field must be named to construct/assert the
 * struct). It must never appear in a TS reader, renderer, or serializer
 * (stores/lib/components) or in any other test file.
 */

const APP_ROOT = resolve(__dirname, '../..');
const REPO_ROOT = resolve(APP_ROOT, '..');

const SCAN_ROOTS = [
  resolve(APP_ROOT, 'src'),
  resolve(APP_ROOT, 'src-tauri/src'),
  resolve(REPO_ROOT, 'packages/efx-physic-paint/src'),
];

const TEXT_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'rs', 'json', 'html', 'css']);

/** The 11 legacy persistence/format tokens (DOC-04 inventory). */
const FORBIDDEN_TOKENS = [
  'physicPaintPersistence',
  'cache/physic-paint',
  '.physic-paint-staging-',
  'McePhysicPaintOutput',
  'McePhysicPaintCachedFrame',
  'McePhysicPaintRotoPlaybackSettings',
  'toMceOutputs',
  'loadFromMceOutputs',
  'efx-paint-state-',
  'SerializedProject',
  'isSerializedProject',
];

/** Exact relative paths allowed to reference the 11 forbidden tokens. */
const ALLOWLIST = new Set([
  'app/src/efx-paint/document/efxPaintCleanBreak.ts',
  'app/src/efx-paint/document/efxPaintCleanBreak.test.ts',
  'app/src/efx-paint/efxPaintCleanBreakContract.test.ts',
]);

const FIXTURES_DIR = 'app/src/efx-paint/document/__fixtures__';

/** Files allowed to reference the 'physic_paint_outputs' carrier token. */
const CARRIER_ALLOWLIST = new Set([
  'app/src-tauri/src/models/project.rs',
  'app/src/types/project.ts',
  'app/src/efx-paint/document/efxPaintCleanBreak.ts',
  'app/src/efx-paint/document/efxPaintCleanBreak.test.ts',
  'app/src/efx-paint/efxPaintCleanBreakContract.test.ts',
  'app/src-tauri/src/commands/project.rs',
  'app/src-tauri/src/services/project_io.rs',
]);

function walkFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkFiles(full));
    } else if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name).slice(1))) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Stateful comment stripper: removes `//` line comments and `/* ... *​/`
 * block comments (multi-line state tracked across calls) while preserving
 * string literals so `//` inside a string is not treated as a comment.
 */
function createCommentStripper(): (line: string) => string {
  let inBlockComment = false;
  return (line: string): string => {
    let out = '';
    let i = 0;
    let inString: "'" | '"' | '`' | null = null;
    while (i < line.length) {
      const ch = line[i];
      const next = line[i + 1];
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i += 2;
        } else {
          i += 1;
        }
        continue;
      }
      if (inString !== null) {
        out += ch;
        if (ch === '\\' && next !== undefined) {
          out += next;
          i += 2;
          continue;
        }
        if (ch === inString) inString = null;
        i += 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i += 2;
        continue;
      }
      if (ch === '/' && next === '/') break;
      if (ch === "'" || ch === '"' || ch === '`') {
        inString = ch;
        out += ch;
        i += 1;
        continue;
      }
      out += ch;
      i += 1;
    }
    return out;
  };
}

interface TokenMatch {
  file: string;
  line: number;
  token: string;
}

function scanForTokens(tokens: string[], isAllowed: (relPath: string) => boolean): TokenMatch[] {
  const matches: TokenMatch[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walkFiles(root)) {
      const relPath = relative(REPO_ROOT, file);
      if (isAllowed(relPath)) continue;
      const strip = createCommentStripper();
      const lines = readFileSync(file, 'utf8').split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const code = strip(lines[i]);
        for (const token of tokens) {
          if (code.includes(token)) {
            matches.push({ file: relPath, line: i + 1, token });
          }
        }
      }
    }
  }
  return matches;
}

function formatMatches(matches: TokenMatch[]): string {
  if (matches.length === 0) return 'no matches';
  const byFile = new Map<string, string[]>();
  for (const m of matches) {
    const entry = `${m.file}:${m.line}: ${m.token}`;
    const list = byFile.get(m.file) ?? [];
    list.push(entry);
    byFile.set(m.file, list);
  }
  return [...byFile.entries()]
    .map(([file, entries]) => `${file}\n    ${entries.join('\n    ')}`)
    .join('\n');
}

describe('DOC-04 clean-break grep contract', () => {
  it('forbids the 11 legacy persistence/format tokens outside the allowlist', () => {
    const matches = scanForTokens(FORBIDDEN_TOKENS, (relPath) =>
      ALLOWLIST.has(relPath) || relPath.startsWith(`${FIXTURES_DIR}/`),
    );
    expect(
      matches,
      `Legacy persistence/format surface still reachable (deletion checklist):\n${formatMatches(matches)}`,
    ).toEqual([]);
  });

  it('confines the physic_paint_outputs carrier to its declared locations', () => {
    const matches = scanForTokens(['physic_paint_outputs'], (relPath) =>
      CARRIER_ALLOWLIST.has(relPath) || relPath.startsWith(`${FIXTURES_DIR}/`),
    );
    expect(
      matches,
      `physic_paint_outputs carrier referenced outside its declared locations (reader/renderer/serializer?):\n${formatMatches(matches)}`,
    ).toEqual([]);
  });

  it('keeps the 4 removed launch-payload fields out of PhysicPaintLaunchContext', () => {
    const source = readFileSync(resolve(APP_ROOT, 'src/types/physicPaint.ts'), 'utf8');
    const lines = source.split('\n');
    const start = lines.findIndex((line) => line.includes('export interface PhysicPaintLaunchContext {'));
    expect(start, 'PhysicPaintLaunchContext interface declaration not found').toBeGreaterThanOrEqual(0);

    // Slice the interface body: declaration line through its closing brace.
    const strip = createCommentStripper();
    let depth = 0;
    let end = start;
    for (let i = start; i < lines.length; i += 1) {
      const code = strip(lines[i]);
      for (const ch of code) {
        if (ch === '{') depth += 1;
        else if (ch === '}') depth -= 1;
      }
      if (depth === 0) {
        end = i;
        break;
      }
    }
    const body = lines.slice(start, end + 1).join('\n');
    const removedFields = ['editableState', 'rotoPhysical', 'cachedRotoFrames', 'rotoInterpolationSettings'];
    const present = removedFields.filter((field) => body.includes(field));
    expect(
      present,
      `Removed launch-payload fields crept back into PhysicPaintLaunchContext (lines ${start + 1}-${end + 1}): ${present.join(', ')}`,
    ).toEqual([]);
  });
});
