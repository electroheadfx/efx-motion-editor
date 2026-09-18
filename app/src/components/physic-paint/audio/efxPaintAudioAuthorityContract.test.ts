import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AUDIO-01 authority-boundary contract (Phase 51).
 *
 * The EFX Paint child audio module is read-only monitoring of the main
 * editor: the child never imports main-editor audio state or playback logic.
 * That boundary was documented only in code comments
 * (efxPaintAudioMonitor.ts:25, efxPaintAudioPreviewContext.ts:14,
 * efxPaintAudioOwnership.ts:14) and pinned by no automated gate — the
 * 260902-cfa plan's success criteria name it explicitly ("no
 * audioStore/timelineStore/playbackEngine import in the child (AUDIO-01)").
 *
 * This scan walks every production file under this directory (test/spec files
 * excluded) and fails on any import that RESOLVES to one of:
 *   - app/src/stores/audioStore
 *   - app/src/stores/timelineStore
 *   - app/src/lib/playbackEngine
 * resolved from relative specifiers (any depth), the "@/*" tsconfig alias, or
 * nested index resolution.
 *
 * Comments are stripped with the stateful stripper idiom from
 * app/src/efx-paint/efxPaintCleanBreakContract.test.ts so the three module
 * header comments literally naming the forbidden modules cannot self-invalidate
 * the audit. String literals are preserved so import specifiers survive.
 *
 * The positive/negative control test at the bottom feeds synthetic source
 * through the same detector — a scanner that silently matches nothing cannot
 * make the contract pass.
 */

const AUDIO_DIR = __dirname;
const APP_ROOT = resolve(AUDIO_DIR, '../../../..');
const SRC_ROOT = resolve(APP_ROOT, 'src');

/** Absolute, extension-less module stems the child must never import. */
const FORBIDDEN_MODULE_STEMS = [
  resolve(SRC_ROOT, 'stores/audioStore'),
  resolve(SRC_ROOT, 'stores/timelineStore'),
  resolve(SRC_ROOT, 'lib/playbackEngine'),
];

/** Import/export/dynamic-import/require specifier forms (per line, post-strip). */
const SPECIFIER_PATTERNS = [
  /\bfrom\s*(['"])([^'"]+)\1/g,
  /\bimport\s*(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
  /\brequire\s*\(\s*(['"])([^'"]+)\1\s*\)/g,
];

interface SourceFile {
  path: string;
  source: string;
}

interface ForbiddenImport {
  file: string;
  line: number;
  specifier: string;
  resolvedTo: string;
}

/**
 * Stateful comment stripper: removes `//` line comments and `/* ... *​/`
 * block comments (multi-line state tracked across lines) while preserving
 * string literals, so header prose cannot self-invalidate the audit and
 * import specifiers survive.
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

function stripModuleExtension(candidate: string): string {
  return candidate.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/i, '');
}

/** Resolve a specifier to its module stem, or null for bare package imports. */
function resolveSpecifier(filePath: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith('@/')) {
    base = resolve(SRC_ROOT, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    base = resolve(dirname(filePath), specifier);
  } else {
    return null;
  }
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  const found = candidates.find((candidate) => existsSync(candidate));
  return stripModuleExtension(found ?? base);
}

function findForbiddenImports(files: SourceFile[]): ForbiddenImport[] {
  const violations: ForbiddenImport[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const lines = file.source.split(/\r?\n/);
    const strip = createCommentStripper();
    for (let i = 0; i < lines.length; i += 1) {
      const code = strip(lines[i]);
      for (const pattern of SPECIFIER_PATTERNS) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(code)) !== null) {
          const specifier = match[2];
          const resolved = resolveSpecifier(file.path, specifier);
          if (resolved === null || !FORBIDDEN_MODULE_STEMS.includes(resolved)) continue;
          const key = `${file.path}:${i + 1}:${specifier}:${resolved}`;
          if (seen.has(key)) continue;
          seen.add(key);
          violations.push({
            file: relative(APP_ROOT, file.path),
            line: i + 1,
            specifier,
            resolvedTo: relative(APP_ROOT, resolved),
          });
        }
      }
    }
  }
  return violations;
}

function formatViolations(violations: ForbiddenImport[]): string {
  if (violations.length === 0) return 'no matches';
  return violations
    .map((v) => `  ${v.file}:${v.line} -> '${v.specifier}' resolves to ${v.resolvedTo}`)
    .join('\n');
}

/** Every production .ts/.tsx under the audio directory; test/spec excluded. */
function collectProductionSourceFiles(): SourceFile[] {
  const files: SourceFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__fixtures__') continue;
        walk(full);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
        files.push({ path: full, source: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(AUDIO_DIR);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

describe('AUDIO-01 authority boundary: child audio module never imports main-editor audio state', () => {
  it('keeps every production file under physic-paint/audio free of audioStore/timelineStore/playbackEngine imports', () => {
    const files = collectProductionSourceFiles();

    // Anti-trivial guard: the scan must actually cover the production module.
    expect(
      files.map((file) => basename(file.path)),
      'scan coverage regressed: the four production modules must be scanned',
    ).toEqual(
      expect.arrayContaining([
        'efxPaintAudioMonitor.ts',
        'efxPaintAudioPreviewContext.ts',
        'efxPaintAudioPreviewStore.ts',
        'efxPaintAudioOwnership.ts',
      ]),
    );
    expect(files.some((file) => /\.(test|spec)\./.test(basename(file.path)))).toBe(false);

    const violations = findForbiddenImports(files);
    expect(
      violations,
      `AUDIO-01 violated — the child audio module imports main-editor audio state/engine:\n${formatViolations(violations)}`,
    ).toEqual([]);
  });

  it('detector control: catches relative, aliased, dynamic and require imports; ignores comments and unrelated modules', () => {
    const syntheticPath = join(AUDIO_DIR, 'efxPaintAudioSyntheticControl.ts');
    const source = [
      "// import { audioStore } from '../../../stores/audioStore';",
      "/* import { timelineStore } from '@/stores/timelineStore'; */",
      "import { audioEngine } from '../../../lib/audioEngine';",
      "import { audioStore } from '../../../stores/audioStore';",
      "import { timelineStore } from '@/stores/timelineStore';",
      "import { playbackEngine } from '../../../lib/playbackEngine';",
      "const engine = await import('../../../lib/playbackEngine');",
      "const legacy = require('../../../lib/playbackEngine.js');",
      "export { seekToFrame } from '../../../lib/playbackEngine';",
      "import { playbackEngineTypes } from '../../../lib/playbackEngineTypes';",
    ].join('\n');

    const violations = findForbiddenImports([{ path: syntheticPath, source }]);

    expect(violations.map((violation) => [violation.line, violation.resolvedTo])).toEqual([
      [4, 'src/stores/audioStore'],
      [5, 'src/stores/timelineStore'],
      [6, 'src/lib/playbackEngine'],
      [7, 'src/lib/playbackEngine'],
      [8, 'src/lib/playbackEngine'],
      [9, 'src/lib/playbackEngine'],
    ]);
  });
});
