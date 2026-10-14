import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Pure source/text contract assertions for the paintVersion bump+subscribe
// discipline (D-11 / RUN-05). Preact 11 defers effect cleanups; this project
// deliberately does not depend on cleanup for correctness. This pin keeps the
// bump+subscribe shape from being "modernized" away into a cleanup-based
// correctness pattern. Source scan only — no DOM mount (releaseContract style).

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const PAINT_OVERLAY = join(APP_DIR, 'src', 'components', 'canvas', 'PaintOverlay.tsx');
const PHYSIC_PAINT_STORE = join(APP_DIR, 'src', 'stores', 'physicPaintStore.ts');
const PAINT_STORE = join(APP_DIR, 'src', 'stores', 'paintStore.ts');

const paintOverlay = readFileSync(PAINT_OVERLAY, 'utf8');
const physicPaintStore = readFileSync(PHYSIC_PAINT_STORE, 'utf8');
const paintStore = readFileSync(PAINT_STORE, 'utf8');

/**
 * A READ of the paintVersion clock: `paintStore.paintVersion.value` NOT
 * followed by an increment, decrement, or assignment. A write form
 * (`value++`, `value = …`) must never satisfy the subscribe assertion —
 * a write-in-effect is the OOM-loop class D-11 exists to prevent, and a
 * substring match on the bare `.value` text silently accepts it.
 */
const SUBSCRIBE_READ = /paintStore\.paintVersion\.value(?!\s*(?:\+\+|--|[+\-*/%]?=))/;

/**
 * Find `useEffect` blocks in a source string by scanning brace depth from each
 * `useEffect(` start. Returns the full block text (body + closing) so callers
 * can assert both the effect body and the trailing dep array.
 */
function useEffectBlocks(source: string): string[] {
  const blocks: string[] = [];
  const needle = 'useEffect(';
  let from = 0;
  for (;;) {
    const start = source.indexOf(needle, from);
    if (start === -1) break;
    // Walk forward to the matching close paren of useEffect(...)
    let depth = 0;
    let i = source.indexOf('(', start + needle.length - 1);
    const openAt = i;
    if (openAt === -1) break;
    for (; i < source.length; i++) {
      const ch = source[i];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          blocks.push(source.slice(start, i + 1));
          from = i + 1;
          break;
        }
      }
    }
    if (depth !== 0) break; // unbalanced — stop rather than loop
  }
  return blocks;
}

/**
 * An effect is a bump+subscribe consumer of paintVersion when its body reads
 * `paintStore.paintVersion.value` (the subscribe side) AND its dep array lists
 * that same `.value` read (identity-stable dep of the version clock).
 * Extract the dep array as the last bracket group of the block.
 */
function depArray(block: string): string {
  const lastBracket = block.lastIndexOf('[');
  if (lastBracket === -1) return '';
  // Walk to matching close bracket
  let depth = 0;
  for (let i = lastBracket; i < block.length; i++) {
    if (block[i] === '[') depth++;
    else if (block[i] === ']') {
      depth--;
      if (depth === 0) return block.slice(lastBracket, i + 1);
    }
  }
  return block.slice(lastBracket);
}

/** Body = everything before the dep array (the effect callback). */
function effectBody(block: string): string {
  const deps = depArray(block);
  const idx = deps ? block.lastIndexOf(deps) : block.length;
  return block.slice(0, idx);
}

describe('paintVersion discipline contract (D-11 / RUN-05)', () => {
  it('PaintOverlay.tsx has a bump+subscribe effect: body reads paintStore.paintVersion.value and the dep array lists that same read', () => {
    // The requestPreview idiom D-11 protects:
    //   useEffect(() => {
    //     const _v = paintStore.paintVersion.value; // subscribe to changes
    //     ...
    //   }, [paintStore.paintVersion.value]);
    const blocks = useEffectBlocks(paintOverlay);
    expect(
      blocks.length,
      `PaintOverlay.tsx must contain at least one useEffect (found ${blocks.length})`,
    ).toBeGreaterThan(0);

    const subscribers = blocks.filter((block) => {
      const body = effectBody(block);
      const deps = depArray(block);
      return SUBSCRIBE_READ.test(body) && SUBSCRIBE_READ.test(deps);
    });

    expect(
      subscribers.length,
      'PaintOverlay.tsx must keep at least one effect that reads paintStore.paintVersion.value in the effect body AND lists that same .value read in the dep array (the requestPreview idiom; D-11 forbids rewriting this into a cleanup-based correctness pattern)',
    ).toBeGreaterThan(0);

    // Named-surface message so a failure names the scanned file.
    expect(paintOverlay, 'PaintOverlay.tsx source scan').toMatch(SUBSCRIBE_READ);
  });

  it('physicPaintStore.ts bumpTrackRevision still increments the version clock (entry.paint.value++, entry.roto.value++, physicPaintVersion.value++)', () => {
    // Extract the bumpTrackRevision function body so the scan is scoped to the
    // named helper rather than any other bump site in the file.
    const fnStart = physicPaintStore.indexOf('export function bumpTrackRevision');
    expect(
      fnStart,
      'physicPaintStore.ts must still export bumpTrackRevision (the RUN-05 bump helper)',
    ).toBeGreaterThanOrEqual(0);

    // Slice to the next top-level export/function boundary after the helper.
    const after = physicPaintStore.slice(fnStart);
    const nextBoundary = after.indexOf('\nexport ', 1);
    const fnBody = nextBoundary === -1 ? after : after.slice(0, nextBoundary);

    expect(
      fnBody,
      'physicPaintStore.ts bumpTrackRevision must still do entry.paint.value++',
    ).toContain('entry.paint.value++');
    expect(
      fnBody,
      'physicPaintStore.ts bumpTrackRevision must still do entry.roto.value++',
    ).toContain('entry.roto.value++');
    expect(
      fnBody,
      'physicPaintStore.ts bumpTrackRevision must still do physicPaintVersion.value++',
    ).toContain('physicPaintVersion.value++');
  });

  it('paintStore.ts _notifyVisualChange still does paintVersion.value++', () => {
    const fnStart = paintStore.indexOf('function _notifyVisualChange');
    expect(
      fnStart,
      'paintStore.ts must still define _notifyVisualChange (the centralized visual-change notifier)',
    ).toBeGreaterThanOrEqual(0);

    const after = paintStore.slice(fnStart);
    const nextBoundary = after.indexOf('\nfunction ', 1);
    const fnBody = nextBoundary === -1 ? after : after.slice(0, nextBoundary);

    expect(
      fnBody,
      'paintStore.ts _notifyVisualChange must still do paintVersion.value++',
    ).toContain('paintVersion.value++');
  });

  it('physicPaintStore.ts setRotoPlaybackSettings early-returns before any write when the incoming value equals the current one (compare-then-write)', () => {
    // Skill rule 3: "called 1000× with the same value, does it bump 0 times?" must be yes.
    // Reference pattern: setRotoPlaybackSettings.
    const marker = 'setRotoPlaybackSettings(';
    const at = physicPaintStore.indexOf(marker);
    expect(
      at,
      'physicPaintStore.ts must still define setRotoPlaybackSettings (the named compare-then-write reference)',
    ).toBeGreaterThanOrEqual(0);

    // Slice the setter body: from the marker to the next method-ish boundary.
    const after = physicPaintStore.slice(at);
    const nextBoundary = after.indexOf('\n  get', 1);
    const body = nextBoundary === -1 ? after : after.slice(0, nextBoundary);

    // Positive shape: a compare of current vs incoming, then a return before write.
    // (1) a current lookup
    expect(
      body,
      'setRotoPlaybackSettings must still look up the current value before writing',
    ).toMatch(/current\s*=/);
    // (2) a compare-then-return of the equality fields (loop + fps)
    expect(
      body,
      'setRotoPlaybackSettings must still compare current.loop/current.fps to the incoming settings and return false before any write (idempotent setter — no bump on a no-op)',
    ).toMatch(/current\?\.loop === settings\.loop/);
    // (3) the idempotence guard's own `return false` — NOT the first `return
    // false` in the body (that is the validation guard above the compare).
    // Search from the equality compare so deleting the guard makes this RED.
    const guardCompareIdx = body.search(/current\?\.loop === settings\.loop/);
    expect(guardCompareIdx, 'setRotoPlaybackSettings equality compare must exist').toBeGreaterThanOrEqual(0);
    const guardReturnIdx = body.indexOf('return false', guardCompareIdx);
    const writeIdx = body.search(/\.set\(/);
    expect(
      guardReturnIdx,
      'setRotoPlaybackSettings must still early-return false right after the equality compare (idempotence guard — the validation return does not count)',
    ).toBeGreaterThanOrEqual(0);
    expect(
      writeIdx,
      'setRotoPlaybackSettings must still write via Map.set after the guard',
    ).toBeGreaterThan(guardReturnIdx);
  });

  it('physicPaintStore.ts setRotoBackgroundMetadata early-returns before any write when the multi-field value equals the current one (compare-then-write)', () => {
    // The stronger compare-then-write reference: multi-field equality guard
    // that returns before any revision bump.
    const marker = 'setRotoBackgroundMetadata(';
    const at = physicPaintStore.indexOf(marker);
    expect(
      at,
      'physicPaintStore.ts must still define setRotoBackgroundMetadata (the stronger compare-then-write reference)',
    ).toBeGreaterThanOrEqual(0);

    const after = physicPaintStore.slice(at);
    const nextBoundary = after.indexOf('\n  get', 1);
    const body = nextBoundary === -1 ? after : after.slice(0, nextBoundary);

    // Positive shape: current lookup + multi-field equality + return before write.
    expect(
      body,
      'setRotoBackgroundMetadata must still look up the current value before writing',
    ).toMatch(/current\s*=/);
    expect(
      body,
      'setRotoBackgroundMetadata must still compare current.background to next.background (multi-field equality guard)',
    ).toContain('current.background === next.background');
    expect(
      body,
      'setRotoBackgroundMetadata must still early-return on unchanged value before any write or revision bump',
    ).toMatch(/return;/);
    // The early return must come BEFORE the write (.set() and before bumpTrackRevision
    const returnIdx = body.search(/return;/);
    const writeIdx = body.search(/\.set\(/);
    const bumpIdx = body.indexOf('bumpTrackRevision');
    expect(
      returnIdx,
      'setRotoBackgroundMetadata must have a bare early return on unchanged value',
    ).toBeGreaterThanOrEqual(0);
    expect(
      writeIdx,
      'setRotoBackgroundMetadata must still write via Map.set after the guard',
    ).toBeGreaterThan(returnIdx);
    expect(
      bumpIdx,
      'setRotoBackgroundMetadata must still call bumpTrackRevision after the guard (never before)',
    ).toBeGreaterThan(returnIdx);
  });
});
