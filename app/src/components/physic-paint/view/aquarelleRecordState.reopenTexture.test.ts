// @vitest-environment node
// ============================================================
//  Gap G-63-5 (63-15) — a recorded texture survives the per-track
//  Studio snapshot and reaches the Save Script serializer.
//
//  The UAT artifact proved every recorded stroke's `engine.textureId`
//  was gone before Save ever ran: the AQTL body inside each SNP1
//  `.snap` neither encoded nor decoded it, and
//  `restoreAquarelleRecordTimeline` replaces `payloadTimeline`
//  wholesale on every Studio boot / layer switch / track reseed.
//
//  This suite drives the REAL chain:
//
//    recordAquarelleStroke -> getAquarelleEventsForFrame
//      -> encodeStudioScriptSnapshot -> decodeStudioScriptSnapshot
//      -> restoreAquarelleRecordTimeline -> getAquarelleEventsForFrame
//      -> serializeAquarelleRotoScript
//
//  `captureFrameScript` reads exactly this `getAquarelleEventsForFrame`
//  result for BOTH the Save and the Copy leg, so the serializer
//  assertion is the save carrier's own precondition.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AquarellePayloadEvent,
  AquarellePoint,
  AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  decodeStudioScriptSnapshot,
  encodeStudioScriptSnapshot,
  type StudioScriptSnapshotIdentity,
} from '../performance/studioScriptSnapshotCodec';
import { serializeAquarelleRotoScript } from '../roto/physicsPaintRotoScriptSchema';
import {
  getAquarelleEventsForFrame,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
  setAquarelleSelectedTextureId,
} from './aquarelleRecordState';

const ID = 71501;
const FRAME = 601;
const TEXTURE_ID = 'wc/custom-abc';

const IDENTITY: StudioScriptSnapshotIdentity = {
  projectId: 'project-63-15',
  layerId: 'layer-63-15',
  trackId: 'track-63-15',
};

/** A structurally valid 1x1 VP8L WebP (physicsPaintRotoScriptLibrary.test.ts:59). */
const WEBP = 'data:image/webp;base64,UklGRhIAAABXRUJQVlA4TAUAAAAvAAAAAAA=';

function point(x: number, y: number, p: number): AquarellePoint {
  return { x, y, p, tx: 10, ty: -10, tw: 5 };
}

function stroke(mutationId: number, overrides: Partial<AquarelleStroke> = {}): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points: [point(0, 0, -1), point(1, 1, 1)],
    mutationId,
    timestamp: mutationId,
    playFrame: FRAME,
    ...overrides,
  };
}

type StrokeEvent = Exclude<AquarellePayloadEvent, { kind: 'dry' }>;

function strokeEventAt(timeline: readonly AquarellePayloadEvent[]): StrokeEvent {
  const event = timeline[0];
  if (!event || 'kind' in event) {
    throw new Error('expected exactly one stroke event');
  }
  return event;
}

/** The production snapshot chain: encode SNP1 -> decode -> restore. */
function snapshotCycle(): void {
  const bytes = encodeStudioScriptSnapshot({
    ...IDENTITY,
    watercolorEvents: getAquarelleEventsForFrame(FRAME),
  });
  const decoded = decodeStudioScriptSnapshot(bytes, IDENTITY);
  restoreAquarelleRecordTimeline(decoded.watercolorEvents);
}

/** What Save Script serializes from the current store state. */
function savedDocument(events: readonly AquarellePayloadEvent[]) {
  return serializeAquarelleRotoScript({
    id: '6f1d2c33-9a4b-4c55-8f6e-3e0d4a2b1c77',
    name: 'Texture carrier',
    createdAt: '2026-11-15T00:00:00Z',
    updatedAt: '2026-11-15T00:00:00Z',
    source: {
      projectName: 'Project',
      layerId: 'layer-1',
      layerName: 'Ink',
      sourceFrame: 4,
      displayFrame: 4,
      width: 1600,
      height: 900,
      background: { background: 'white' as const, grainStrength: 0 },
    },
    thumbnail: {
      mimeType: 'image/webp' as const,
      width: 1,
      height: 1,
      quality: 0.8,
      dataUrl: WEBP,
    },
    events,
  });
}

const engineOf = (document: ReturnType<typeof savedDocument>, index = 0): object =>
  document.strokes[index]!.engine as object;

describe('G-63-5 — a recorded texture survives the per-track snapshot and reaches Save', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
    // The pick is module state the record reset does not clear.
    setAquarelleSelectedTextureId(null);
  });

  it('keeps engine.textureId through record, the SNP1 cycle and the saved document', () => {
    recordAquarelleStroke(ID, stroke(ID, { textureId: TEXTURE_ID }));

    // The record leg is faithful: the projection carries the axis.
    expect(strokeEventAt(getAquarelleEventsForFrame(FRAME)).engine.textureId).toBe(TEXTURE_ID);

    snapshotCycle();

    // The restore leg must hand the save capture the same id.
    const restored = strokeEventAt(getAquarelleEventsForFrame(FRAME));
    expect(restored.engine.textureId).toBe(TEXTURE_ID);

    // Save Script serializes exactly this capture; the document carries it.
    const document = savedDocument(getAquarelleEventsForFrame(FRAME));
    expect((engineOf(document) as { textureId?: string }).textureId).toBe(TEXTURE_ID);
  });

  it('adds no textureId key to a textureless stroke anywhere in the same chain', () => {
    recordAquarelleStroke(ID, stroke(ID));

    expect('textureId' in strokeEventAt(getAquarelleEventsForFrame(FRAME)).engine).toBe(false);

    snapshotCycle();

    expect('textureId' in strokeEventAt(getAquarelleEventsForFrame(FRAME)).engine).toBe(false);

    const document = savedDocument(getAquarelleEventsForFrame(FRAME));
    expect('textureId' in engineOf(document)).toBe(false);
  });

  it('reopens the texture carrier byte-identically across a second cycle', () => {
    recordAquarelleStroke(ID, stroke(ID, { textureId: TEXTURE_ID }));

    const firstBytes = encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: getAquarelleEventsForFrame(FRAME),
    });
    const firstCycle = decodeStudioScriptSnapshot(firstBytes, IDENTITY);
    restoreAquarelleRecordTimeline(firstCycle.watercolorEvents);
    const firstEvents = getAquarelleEventsForFrame(FRAME);
    expect(strokeEventAt(firstEvents).engine.textureId).toBe(TEXTURE_ID);

    const secondBytes = encodeStudioScriptSnapshot({
      ...IDENTITY,
      watercolorEvents: firstEvents,
    });
    expect(secondBytes).toEqual(firstBytes);

    const secondCycle = decodeStudioScriptSnapshot(secondBytes, IDENTITY);
    restoreAquarelleRecordTimeline(secondCycle.watercolorEvents);
    expect(strokeEventAt(getAquarelleEventsForFrame(FRAME))).toEqual(strokeEventAt(firstEvents));
  });
});
