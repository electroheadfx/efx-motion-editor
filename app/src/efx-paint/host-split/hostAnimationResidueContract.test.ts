import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * HOST-01 clean-break residue + package-surface lock pin (55-09).
 *
 * 55-02 moved animation/ + traceSeed/noise into `@efxlab/efx-paint-host` as ONE
 * atomic change set (old directory deleted, 13 consumer sites re-pointed, dual
 * `./animation` export dropped). This pin locks that move as a lasting
 * invariant so a future regression fails loudly in the suite:
 *
 *   (1) the retired engine-1 animation subpath specifier has zero matches
 *       under app/ and packages/ source;
 *   (2) engine-1's package.json publishes no `./animation` export key and
 *       declares `@efxlab/efx-paint-host` as `workspace:*`;
 *   (3) engine-1's tsup.config.ts has no `animation` entry;
 *   (4) `packages/efx-physic-paint/src/animation/` does not exist;
 *   (5) `packages/efx-paint-host/src/animation/` exists with its `index.ts`.
 *
 * Comment stripping (the readFileSync idiom of `grep -v` header-comment
 * filtering) runs before every zero-match gate so comment prose — including
 * the header of THIS file naming the retired subpath — cannot self-invalidate
 * the count. The needle is also assembled at runtime so the contiguous
 * specifier never appears in this file's code, only in comments.
 *
 * Family: paintVersionDisciplineContract / efxPaintCleanBreakContract /
 * preSplitGoldenParity — normal `.test.ts`, existing vitest setup, no one-off
 * config. Test-only: this plan touches no production source. A red pin is a
 * 55-02 execution gap — open a gap against 55-02, do not re-point imports
 * here (55-09 must never unbreak 55-02).
 *
 * PINS_GREEN_AT_BIRTH: green at birth on the post-move tree. Manufacturing a
 * red by breaking production code would be theater — the matcher self-test
 * below proves detection on an in-memory plant instead.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '../../..');
const REPO_ROOT = resolve(APP_ROOT, '..');

/**
 * The retired engine-1 animation subpath, assembled at runtime so this file's
 * source never carries the contiguous specifier outside comments. Equivalent
 * to: @efxlab/efx-physic-paint/animation
 */
const ENGINE1_ANIMATION_SUBPATH = ['@efxlab/efx-physic-paint', 'animation'].join('/');

/** Host-owned subpath that remains legal (the move's destination). */
const HOST_ANIMATION_SUBPATH = ['@efxlab/efx-paint-host', 'animation'].join('/');

const ENGINE1_PACKAGE_JSON = resolve(REPO_ROOT, 'packages/efx-physic-paint/package.json');
const ENGINE1_TSUP_CONFIG = resolve(REPO_ROOT, 'packages/efx-physic-paint/tsup.config.ts');
const ENGINE1_ANIMATION_DIR = resolve(REPO_ROOT, 'packages/efx-physic-paint/src/animation');
const HOST_ANIMATION_INDEX = resolve(REPO_ROOT, 'packages/efx-paint-host/src/animation/index.ts');

const TEXT_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'html',
  'css',
]);

const SCAN_ROOTS = [
  resolve(APP_ROOT, 'src'),
  resolve(APP_ROOT, 'src-tauri/src'),
  resolve(REPO_ROOT, 'packages/efx-physic-paint/src'),
  resolve(REPO_ROOT, 'packages/efx-paint-host/src'),
];

/**
 * Exact relative paths allowed to carry the retired subpath specifier in code.
 * This pin must name the needle to detect it; nothing else may reference it.
 */
const ALLOWLIST = new Set([
  'app/src/efx-paint/host-split/hostAnimationResidueContract.test.ts',
]);

function walkFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
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
 * Stateful comment stripper: removes `//` line comments and block comments
 * (multi-line state tracked across calls) while preserving string literals so
 * an import specifier inside a string is NOT mistaken for a comment. This is
 * the header-comment filtering the zero-match gate requires — comment prose
 * naming the retired subpath cannot self-invalidate the count.
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

interface SubpathMatch {
  file: string;
  line: number;
}

/**
 * Count occurrences of the retired subpath in a single source string AFTER
 * comment stripping. Shared by the repo-walk gate and the matcher self-test.
 */
function countSubpathMatches(source: string, needle: string): number {
  const strip = createCommentStripper();
  let count = 0;
  for (const line of source.split('\n')) {
    const code = strip(line);
    let from = 0;
    for (;;) {
      const at = code.indexOf(needle, from);
      if (at === -1) break;
      count += 1;
      from = at + needle.length;
    }
  }
  return count;
}

function scanForSubpath(needle: string): SubpathMatch[] {
  const matches: SubpathMatch[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walkFiles(root)) {
      const relPath = relative(REPO_ROOT, file);
      if (ALLOWLIST.has(relPath)) continue;
      const source = readFileSync(file, 'utf8');
      const count = countSubpathMatches(source, needle);
      if (count > 0) {
        matches.push({ file: relPath, line: count });
      }
    }
  }
  return matches;
}

function formatMatches(matches: SubpathMatch[]): string {
  if (matches.length === 0) return 'no matches';
  return matches.map((m) => `  ${m.file} (${m.line} occurrence(s))`).join('\n');
}

describe('HOST-01 animation residue + package-surface lock pin (55-09)', () => {
  it('PINS_GREEN_AT_BIRTH: the standing residue pin is green on the post-move tree', () => {
    // Honest record: 55-02's atomic move+re-point landed, so this pin is born
    // green. A future engine-1 animation subpath regression flips it.
    const matches = scanForSubpath(ENGINE1_ANIMATION_SUBPATH);
    expect(
      matches,
      `Engine-1 animation subpath residue found (55-02 gap — open a gap, do not re-point here):\n${formatMatches(matches)}`,
    ).toEqual([]);
  });

  it('detects a planted engine-1 animation-subpath specifier in sample source', () => {
    // Matcher self-test: an in-memory plant must be caught. This proves
    // detection without mutating the tree (green-at-birth is not theater).
    const planted = [
      `import { AnimationPlayer } from '${ENGINE1_ANIMATION_SUBPATH}';`,
      `export { transformRecordedStrokeForHeldPose } from '${ENGINE1_ANIMATION_SUBPATH}';`,
    ].join('\n');
    expect(countSubpathMatches(planted, ENGINE1_ANIMATION_SUBPATH)).toBe(2);

    // Header-comment prose naming the retired subpath must NOT count.
    const commentOnly = [
      '// The retired engine-1 animation subpath lives at',
      `// ${ENGINE1_ANIMATION_SUBPATH}`,
      '/* another mention: ' + ENGINE1_ANIMATION_SUBPATH + ' */',
    ].join('\n');
    expect(countSubpathMatches(commentOnly, ENGINE1_ANIMATION_SUBPATH)).toBe(0);

    // The host-owned subpath must NOT trip the engine-1 needle.
    const hostImport = `import { AnimationPlayer } from '${HOST_ANIMATION_SUBPATH}';`;
    expect(countSubpathMatches(hostImport, ENGINE1_ANIMATION_SUBPATH)).toBe(0);
  });

  it('engine-1 package.json publishes no ./animation export and depends on @efxlab/efx-paint-host as workspace:*', () => {
    const raw = readFileSync(ENGINE1_PACKAGE_JSON, 'utf8');
    const pkg = JSON.parse(raw) as {
      exports?: Record<string, unknown>;
      dependencies?: Record<string, string>;
    };

    expect(
      pkg.exports && Object.prototype.hasOwnProperty.call(pkg.exports, './animation'),
      'engine-1 package.json must not publish an exports["./animation"] key (55-02 deleted the dual subpath; re-adding it is the regression this pin locks)',
    ).toBe(false);

    expect(
      pkg.dependencies?.['@efxlab/efx-paint-host'],
      'engine-1 must declare @efxlab/efx-paint-host as a workspace:* dependency (the move destination)',
    ).toBe('workspace:*');
  });

  it('engine-1 tsup.config.ts has no animation entry', () => {
    const raw = readFileSync(ENGINE1_TSUP_CONFIG, 'utf8');
    const strip = createCommentStripper();
    const code = raw
      .split('\n')
      .map((line) => strip(line))
      .join('\n');

    // An `animation:` object key is the tsup entry this pin forbids. The
    // host-owned package keeps its own animation entry; engine-1 must not.
    const entryKey = /\banimation\s*:/;
    expect(
      entryKey.test(code),
      'packages/efx-physic-paint/tsup.config.ts must not declare an `animation` entry (the old subpath build target)',
    ).toBe(false);
  });

  it('engine-1 src/animation/ is deleted and host src/animation/index.ts exists', () => {
    expect(
      existsSync(ENGINE1_ANIMATION_DIR),
      'packages/efx-physic-paint/src/animation/ must not exist (55-02 deleted the directory as part of the atomic move)',
    ).toBe(false);

    expect(
      existsSync(HOST_ANIMATION_INDEX),
      'packages/efx-paint-host/src/animation/index.ts must exist (the move destination owns animation/)',
    ).toBe(true);
  });
});
