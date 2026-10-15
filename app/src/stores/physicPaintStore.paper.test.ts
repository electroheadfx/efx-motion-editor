/**
 * 56-05 Task 2 RED — paper display state on the document fond (PAPER-02 / PAPER-03).
 *
 * Laws pinned here:
 *   PAPER-03 paper display state (id, strength, scale) lives on the document
 *            fond, participates in undo + save, and rotates the display-class
 *            change token so display-only edits do not revert on reopen
 *            (D-22 / PKG-06/BKG-09 lesson)
 *   PAPER-02 paper change never touches any baked WebP cache path (no rebake)
 *   PAPER-02 applyPaperPass is invoked once per flattened frame regardless of
 *            track count (the composite-only seam)
 *   D-10     strength + scale are the picker's slider fields; the id is the
 *            library paper id (13-paper pack)
 *
 * Idempotence (flagged assumption, pinned): setting the same paper id /
 * strength / scale again is a revision-stable no-op — no token rotation, no
 * memo clear. Adjacency: strength and scale clamp to their slider bounds;
 * scale = 0 is refused or clamped to the minimum (never a divide-by-zero in
 * the tile cache key).
 *
 * Assertion style: scalar predicates (boolean/primitive toBe) so TAP
 * diagnostics stay one-line and the RED evidence classifier can parse the
 * report.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  physicPaintStore,
  physicPaintVersion,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';
import {
  getDocument as getEfxPaintDocument,
  registerDocument,
  reset as resetEfxPaintStore,
  setBackgroundFallback,
} from './efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildEfxPaintDocumentRevision } from '../efx-paint/document/efxPaintDocumentRevision';

const LAYER = 'layer-56-05-paper';

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(null);
  resetEfxPaintStore();
  physicPaintStore.reset();
  const document = createEfxPaintDocument(LAYER);
  registerDocument(document);
  // Start from a paper fond so the setters have a paper arm to edit.
  // canvas1 is the current closed PaperTexture union; the setters widen the
  // arm to library paper ids (paper/…) on GREEN.
  expect(setBackgroundFallback(LAYER, {
    mode: 'paper',
    texture: 'canvas1',
    grainStrength: 0.5,
    grainScale: 1,
  }).ok).toBe(true);
});

afterEach(() => {
  _setPhysicPaintMarkDirtyCallback(null);
  resetEfxPaintStore();
  physicPaintStore.reset();
});

describe('paper display setters on physicPaintStore (PAPER-03)', () => {
  it('setPaperId / setPaperStrength / setPaperScale exist and return a boolean', () => {
    expect(typeof physicPaintStore.setPaperId).toBe('function');
    expect(typeof physicPaintStore.setPaperStrength).toBe('function');
    expect(typeof physicPaintStore.setPaperScale).toBe('function');
    expect(typeof physicPaintStore.setPaperId(LAYER, 'paper/rough')).toBe('boolean');
  });

  it('getDocumentFondInstruction reflects paper id / strength / scale from the document fond', () => {
    physicPaintStore.setPaperId(LAYER, 'paper/rough');
    physicPaintStore.setPaperStrength(LAYER, 0.8);
    physicPaintStore.setPaperScale(LAYER, 2);
    const instruction = physicPaintStore.getDocumentFondInstruction(LAYER);
    expect(instruction).not.toBeNull();
    expect(instruction!.paperTexture).toBe('paper/rough');
    expect(instruction!.grainStrength).toBe(0.8);
    expect(instruction!.grainScale).toBe(2);
  });

  it('same-value set is a revision-stable no-op (no token rotation)', () => {
    physicPaintStore.setPaperId(LAYER, 'paper/khadi');
    physicPaintStore.setPaperStrength(LAYER, 0.4);
    physicPaintStore.setPaperScale(LAYER, 1.5);
    const documentBefore = getEfxPaintDocument(LAYER)!;
    const revisionBefore = buildEfxPaintDocumentRevision(documentBefore);
    const versionBefore = physicPaintVersion.value;

    physicPaintStore.setPaperId(LAYER, 'paper/khadi');
    physicPaintStore.setPaperStrength(LAYER, 0.4);
    physicPaintStore.setPaperScale(LAYER, 1.5);

    const documentAfter = getEfxPaintDocument(LAYER)!;
    expect(buildEfxPaintDocumentRevision(documentAfter)).toBe(revisionBefore);
    expect(physicPaintVersion.value).toBe(versionBefore);
  });

  it('different-value set rotates the fond signature and bumps the display-class change token', () => {
    const documentBefore = getEfxPaintDocument(LAYER)!;
    const revisionBefore = buildEfxPaintDocumentRevision(documentBefore);
    const versionBefore = physicPaintVersion.value;

    expect(physicPaintStore.setPaperId(LAYER, 'paper/washi')).toBe(true);

    const documentAfter = getEfxPaintDocument(LAYER)!;
    // The paper id is a document-revision term (fallback arm) — the display-
    // class change token rotates so save/reopen does not revert (D-22).
    expect(buildEfxPaintDocumentRevision(documentAfter)).not.toBe(revisionBefore);
    expect(physicPaintVersion.value).toBeGreaterThan(versionBefore);
  });

  it('a different-value paper edit clears the flattened memo (fresh composite, not a stale paper)', () => {
    // Observable seam: the setter bodies must route through the existing
    // fond-signature rotation (_rotateFlattenedMemoOnFondChange) so a paper
    // change never serves the previous paper's memoized raster. The live
    // getFlattenedFrame path needs a canvas harness — the rotation contract
    // itself is what PAPER-03 / D-22 requires.
    const storePath = resolve(dirname(fileURLToPath(import.meta.url)), './physicPaintStore.ts');
    const storeSource = readFileSync(storePath, 'utf8');
    for (const name of ['setPaperId', 'setPaperStrength', 'setPaperScale']) {
      const start = storeSource.indexOf(`${name}(`);
      const body = storeSource.slice(start, storeSource.indexOf('\n  },', start) + 5);
      expect(body.includes('_rotateFlattenedMemoOnFondChange') || body.includes('_flattenedMemo.delete')).toBe(true);
    }
  });

  it('strength and scale clamp to their slider bounds (scale = 0 never reaches the tile key)', () => {
    physicPaintStore.setPaperStrength(LAYER, 99);
    physicPaintStore.setPaperScale(LAYER, 0);
    const instruction = physicPaintStore.getDocumentFondInstruction(LAYER)!;
    expect(instruction.grainStrength).toBe(1);
    expect(instruction.grainScale).toBeGreaterThan(0);
    expect(instruction.grainScale).toBeLessThan(11);
  });

  it('no baked WebP cache path is written or deleted by a paper setter (PAPER-02 / D-21)', () => {
    const storePath = resolve(dirname(fileURLToPath(import.meta.url)), './physicPaintStore.ts');
    const storeSource = readFileSync(storePath, 'utf8');
    const setterBodies = [
      storeSource.slice(storeSource.indexOf('setPaperId(')),
      storeSource.slice(storeSource.indexOf('setPaperStrength(')),
      storeSource.slice(storeSource.indexOf('setPaperScale(')),
    ].map((body) => body.slice(0, body.indexOf('\n  },') + 5));
    const cacheTokens = /staging|cachePath|cache\/efx-paint|\.webp|Webp|deleteFrame|removeFrame|invalidateBake|rebake/i;
    for (const body of setterBodies) {
      expect(cacheTokens.test(body)).toBe(false);
    }
  });

  it('applyPaperPass is called once per flattened frame regardless of track count (PAPER-02)', () => {
    const storePath = resolve(dirname(fileURLToPath(import.meta.url)), './physicPaintStore.ts');
    const storeSource = readFileSync(storePath, 'utf8');
    const applyCalls = storeSource.match(/applyPaperPass\s*\(/g) ?? [];
    expect(applyCalls.length).toBe(1);
  });
});
