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
 * 52.2-08: the former carrier allowlist is gone — the pre-52.2 opaque paint
 * carrier is deleted from both models, so the clean-break surface has one
 * fewer loophole and this file one fewer exemption.
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

/**
 * 52.1 (D-19): the frame-transport forbidden tokens — the base64/PNG frame
 * runtime surface that must be retired. The base64 PNG prefix, the synchronous
 * canvas string export, the JS PNG encode/decode helpers, the base64 bridge
 * helpers, and the string-keyed cache names.
 */
const FRAME_TRANSPORT_FORBIDDEN_TOKENS = [
  'data:image/png',
  'toDataURL',
  'encodePngDataUrl',
  'decodePngDataUrl',
  'bytesToBase64',
  'base64ToBytes',
  '_compositorImageCache',
  '_rotoAlphaCanvasRegistry',
  // 52.1 Save Action regression: the retired thumbnail-encode event relay.
  // Thumbnail bytes cross the Tauri boundary as a raw invoke body (D-05/D-07),
  // never over the JSON event bridge, which index-objects the Uint8Array and
  // orphans the request.
  'PHYSIC_PAINT_THUMBNAIL_ENCODE',
  'physic-paint:thumbnail-encode',
  'installPhysicPaintThumbnailEncodeListener',
];

/**
 * Exact relative paths allowed to reference the frame-transport tokens:
 *   - the import/export interchange path (D-01) — PNG survives as
 *     import/export interchange via the browser's own encoder
 *     (rotoAlphaCanvasRegistry.ts canvasToPngBytes);
 *   - the JSON transport boundary (52.1-03 decision "base64 at the JSON
 *     persistence boundary only") — bytesToBase64 serializes Uint8Array
 *     across the Tauri emitTo JSON hop (webpBytes.ts, types/physicPaint.ts,
 *     physicsPaintRotoScriptThumbnail.ts);
 *   - the decode IPC response leg (52.1 quick fix 3d1cb4d3): the Rust
 *     `decode_webp_frame` response returns its RGBA base64-encoded — a raw
 *     response body degrades to a JSON number array on macOS (~33 MB
 *     marshalled per 1920x1080 frame, ~3.4 s measured 2026-09-11); the
 *     request leg stays raw (webpFrameCodec.ts);
 *   - the package media response leg (52.2-08): `ipcEfxPaintReadFrameMedia`
 *     decodes the base64 body the native per-key read command returns — the
 *     read-back leg plan 09 resolves pixels from `payload.media` through;
 *   - this contract file (it must name the tokens to detect them).
 */
const FRAME_TRANSPORT_ALLOWLIST = new Set([
  'app/src/lib/rotoAlphaCanvasRegistry.ts',
  'app/src/lib/webpBytes.ts',
  'app/src/lib/webpFrameCodec.ts',
  'app/src/types/physicPaint.ts',
  'app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts',
  'app/src/lib/ipc.ts',
  'app/src/efx-paint/efxPaintCleanBreakContract.test.ts',
]);

const FIXTURES_DIR = 'app/src/efx-paint/document/__fixtures__';

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

function isTestFile(relPath: string): boolean {
  return /\.(test|spec)\.(ts|tsx|js|jsx|mjs|cjs)$/.test(relPath);
}

function scanForTokens(
  tokens: string[],
  isAllowed: (relPath: string) => boolean,
  options: { skipTestFiles?: boolean } = {},
): TokenMatch[] {
  const matches: TokenMatch[] = [];
  for (const root of SCAN_ROOTS) {
    for (const file of walkFiles(root)) {
      const relPath = relative(REPO_ROOT, file);
      if (isAllowed(relPath)) continue;
      if (options.skipTestFiles && isTestFile(relPath)) continue;
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

  it('forbids the frame-transport tokens outside the allowlist (D-19)', () => {
    const matches = scanForTokens(
      FRAME_TRANSPORT_FORBIDDEN_TOKENS,
      (relPath) => FRAME_TRANSPORT_ALLOWLIST.has(relPath),
      { skipTestFiles: true },
    );
    expect(
      matches,
      `Frame-transport surface still reachable (deletion checklist):\n${formatMatches(matches)}`,
    ).toEqual([]);
  });
});
