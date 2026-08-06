import { beforeEach, describe, expect, it } from 'vitest';
import {
  physicPaintStore,
  physicPaintVersion,
  rotoPhysicalRevision,
  _setPhysicPaintMarkDirtyCallback,
} from './physicPaintStore';
import type {
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

// 43-04 Task 2 (HOLD-04): one-resolved-raster-per-frame compositing proof for a
// committed static/hold generation. The generated keys are paint content of the
// opened parent Paint layer and every destination frame resolves through the
// canonical store seam (getRotoPhysicalRenderSource) to exactly one rendered
// raster. Hardening spec against shipped machinery — expected to PASS on first
// run; a RED result routes through the bounded deviation protocol.

const LAYER = 'layer-hold-composite';
const CAPACITY = 12;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

/** Minimal valid PNG data URL (real signature bytes) for canonical payloads. */
const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

function payload(appFrame: number, tag: string): PhysicPaintRotoRealKeyPayload {
  return { frameIndex: 0, appFrame, dataUrl: pngDataUrl(tag), width: 10, height: 10 };
}

function record(keyId: string, appFrame: number, tag: string): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, tag) };
}

/**
 * The document state AFTER a committed static/hold generation on frames 4-6:
 * the pre-existing source key at frame 0 plus the three generated hold keys,
 * committed in deterministic ascending frame order by the staged atomic commit.
 */
function committedHoldRecords(): PhysicPaintRotoRealKeyRecord[] {
  return [
    record('key-source', 0, 'source'),
    record('key-hold-4', 4, 'hold-4'),
    record('key-hold-5', 5, 'hold-5'),
    record('key-hold-6', 6, 'hold-6'),
  ];
}

function installCommittedGeneration(): void {
  const result = physicPaintStore.replaceRotoPhysicalRecords(LAYER, committedHoldRecords(), INTERPOLATION, CAPACITY);
  expect(result.ok).toBe(true);
}

describe('physicPaintStore roto hold composite (HOLD-04)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
  });

  it('every destination frame resolves via getRotoPhysicalRenderSource to exactly one rendered raster owned by the parent Paint layer', () => {
    installCommittedGeneration();
    const contentRevision = physicPaintStore.getRotoPhysicalContentRevision(LAYER);
    expect(contentRevision).toEqual(expect.stringMatching(/^physical-/));

    for (const appFrame of [4, 5, 6]) {
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, appFrame);
      expect(source, `frame ${appFrame} resolves`).not.toBeNull();
      expect(source?.kind).toBe('real');
      if (source?.kind !== 'real') throw new Error(`frame ${appFrame} must resolve to a real render source`);
      expect(source.layerId).toBe(LAYER); // owned by the opened parent Paint layer
      expect(source.appFrame).toBe(appFrame);
      expect(source.keyId).toBe(`key-hold-${appFrame}`);
      expect(source.contentRevision).toBe(contentRevision);
      expect(source.cacheRevision).toBe(`${contentRevision}:real:key-hold-${appFrame}`);
      // Exactly one resolved raster per frame — the canonical committed payload
      // itself, not a copy or a second composite.
      const stored = physicPaintStore.getRotoRealKeyRecord(LAYER, `key-hold-${appFrame}`);
      expect(stored).not.toBeNull();
      expect(source.renderedFrame).toBe(stored?.payload);
      expect(source?.renderedFrame.dataUrl).toBe(pngDataUrl(`hold-${appFrame}`));
      expect(source?.renderedFrame.appFrame).toBe(appFrame);
    }
  });

  it('frames outside the committed hold range resolve to no raster', () => {
    installCommittedGeneration();
    for (const appFrame of [1, 2, 3, 7, 8, 11]) {
      expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, appFrame), `frame ${appFrame} is empty`).toBeNull();
    }
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, -1)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource(LAYER, 4.5)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource('absent-layer', 4)).toBeNull();
    // The pre-existing source key still resolves as its own single raster.
    const preexisting = physicPaintStore.getRotoPhysicalRenderSource(LAYER, 0);
    if (preexisting?.kind !== 'real') throw new Error('pre-existing source key must resolve to a real render source');
    expect(preexisting.keyId).toBe('key-source');
  });

  it('re-committing the identical static/hold record set is a byte-identical no-op (idempotent re-application)', () => {
    installCommittedGeneration();
    const revisionBefore = physicPaintStore.getRotoPhysicalContentRevision(LAYER);
    const projectionBefore = physicPaintStore.getRotoPhysicalProjection(LAYER);
    const physicalRevisionBefore = rotoPhysicalRevision.value;
    const visualVersionBefore = physicPaintVersion.value;

    const reapplied = physicPaintStore.replaceRotoPhysicalRecords(LAYER, committedHoldRecords(), INTERPOLATION, CAPACITY);
    expect(reapplied.ok).toBe(true);

    expect(physicPaintStore.getRotoPhysicalContentRevision(LAYER)).toBe(revisionBefore);
    expect(physicPaintStore.getRotoPhysicalProjection(LAYER)).toBe(projectionBefore);
    expect(rotoPhysicalRevision.value).toBe(physicalRevisionBefore);
    expect(physicPaintVersion.value).toBe(visualVersionBefore);
    // Every destination frame still resolves to the same single raster.
    for (const appFrame of [4, 5, 6]) {
      const source = physicPaintStore.getRotoPhysicalRenderSource(LAYER, appFrame);
      if (source?.kind !== 'real') throw new Error(`Expected a real render source at frame ${appFrame}.`);
      expect(source.renderedFrame.dataUrl).toBe(pngDataUrl(`hold-${appFrame}`));
    }
  });

  it('committed hold keys are stored and read back in deterministic ascending frame order', () => {
    // Install out of order; the canonical read path is always ascending.
    const shuffled = [
      record('key-hold-6', 6, 'hold-6'),
      record('key-hold-4', 4, 'hold-4'),
      record('key-source', 0, 'source'),
      record('key-hold-5', 5, 'hold-5'),
    ];
    const result = physicPaintStore.replaceRotoPhysicalRecords(LAYER, shuffled, INTERPOLATION, CAPACITY);
    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER).map((entry) => entry.appFrame)).toEqual([0, 4, 5, 6]);
  });
});
