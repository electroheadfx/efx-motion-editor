import { describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from './efxPaintDocument';
import { parseEfxPaintDocument } from './efxPaintDocumentParsers';
import {
  buildPhysicPaintRotoPhysicalRevision,
  parsePhysicPaintRotoPhysicalDocument,
} from '../../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

/**
 * 52-02 (D-15 / RVL-06): the mode-free PhotoReferenceTrack round-trip. The
 * `PhotoReferenceMode` flag is removed entirely (clean break, Phase 45
 * no-compat) — a mode-free track parses and round-trips byte-identically, a
 * legacy mode-bearing record is rejected fail-closed (unknown member throws,
 * never normalized), and the reveal rail record (railKind 'reveal') round-trips
 * through the physical-level parser without loss.
 */

/** A mode-free PhotoReferenceTrack (D-15): the v1.0 schema carries no mode field. */
function modeFreePhotoReferenceTrack(): Record<string, unknown> {
  return {
    id: 'photo-track-1',
    sourceFrameRefs: ['shot_1', 'shot_2'],
    revision: 0,
    visibleInStudio: true,
    opacity: 0.5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    transformLocked: true,
  };
}

function documentWithPhotoReference(track: unknown): Record<string, unknown> {
  const document = JSON.parse(JSON.stringify(createEfxPaintDocument('layer-abc'))) as Record<string, unknown>;
  document.photoReference = track;
  return document;
}

describe('mode-free PhotoReferenceTrack round-trip (52-02, D-15 / RVL-06)', () => {
  it('parses a mode-free PhotoReferenceTrack and round-trips byte-identically (RVL-06)', () => {
    const document = documentWithPhotoReference(modeFreePhotoReferenceTrack());
    const parsed = parseEfxPaintDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed).toEqual(document);
    expect(parsed.photoReference).not.toHaveProperty('mode');
  });

  it('rejects a legacy mode-bearing PhotoReferenceTrack fail-closed (unknown member throws)', () => {
    for (const mode of ['reference-only', 'reveal-source', 'masked-transform-source']) {
      const legacy = { ...modeFreePhotoReferenceTrack(), mode };
      expect(() => parseEfxPaintDocument(documentWithPhotoReference(legacy))).toThrow(/unknown members/);
    }
  });
});

describe('reveal rail record round-trip through the physical-level parser (52-02)', () => {
  /** Minimal valid PNG data URL (real signature bytes) for canonical payloads. */
  const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

  const realKey = (keyId: string, appFrame: number) => ({
    kind: 'real-key' as const,
    keyId,
    appFrame,
    payload: { frameIndex: 0, appFrame, dataUrl: pngDataUrl(`payload-${keyId}`), width: 10, height: 10 },
  });

  const SOURCE_KEY_IDS = ['k1', 'k2', 'k3', 'k4', 'k5'];
  const sourceRecords = () => [0, 3, 6, 9, 12].map((appFrame, index) => realKey(SOURCE_KEY_IDS[index], appFrame));

  /** A reveal rail Loop Clip record (52-01, D-03): railKind 'reveal' + script provenance. */
  const revealRail = () => ({
    loopId: 'reveal-1',
    placementStart: 10,
    sourceKeyIds: [...SOURCE_KEY_IDS],
    repeat: 1 as number | 'infinity',
    mode: 'progressive' as const,
    railKind: 'reveal' as const,
    scriptId: 'script-1',
    motion: { deformation: 0, position: 0 },
    overrideColor: null,
  });

  const baseDocument = (loopClips?: unknown) => {
    const realKeyRecords = sourceRecords();
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    // The canonical fingerprint covers loopClips. Malformed fixtures get a
    // placeholder revision: the document parser rejects the malformed member
    // before the revision check runs.
    const revision = (() => {
      try {
        return buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, Array.isArray(loopClips) ? loopClips : []);
      } catch {
        return 'invalid-fixture-revision';
      }
    })();
    return {
      capacity: 600,
      realKeyRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision,
      incomingInterpolationBreakKeyIds: [],
      ...(loopClips !== undefined ? { loopClips } : {}),
    };
  };

  it('round-trips a railKind reveal Loop Clip through the physical-level parser without loss', () => {
    const document = baseDocument([revealRail()]);
    const parsed = parsePhysicPaintRotoPhysicalDocument(document);
    expect(parsed.loopClips).toHaveLength(1);
    expect(parsed.loopClips[0].railKind).toBe('reveal');
    expect(parsed.loopClips[0].mode).toBe('progressive');
    expect(parsed.loopClips[0].scriptId).toBe('script-1');
    expect(parsed.loopClips[0].placementStart).toBe(10);
    expect(parsed.loopClips[0].sourceKeyIds).toEqual(SOURCE_KEY_IDS);
    expect(parsed.loopClips[0].overrideColor).toBeNull();
  });

  it('rejects an unknown railKind fail-closed (allowlist)', () => {
    const document = baseDocument([{ ...revealRail(), railKind: 'mask' }]);
    expect(() => parsePhysicPaintRotoPhysicalDocument(document)).toThrow();
  });
});
