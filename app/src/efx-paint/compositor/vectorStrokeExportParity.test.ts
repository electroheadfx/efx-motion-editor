// @vitest-environment node
// ============================================================
//  61-14 Task 1 (VEC-06 / D-14) — draw, save, reopen: the bake
//  inputs come back deep-equal.
//
//  The bake consumes the PROJECTION's output, never the live
//  recorded stroke, so the seams that can silently drop a width
//  factor or an anchor list are:
//
//    recorded AquarelleStroke -> toStudioStroke (61-03)
//      -> AQTL v2 encode/decode (61-05)
//      -> restoreAquarelleRecordTimeline -> toStudioStroke
//
//  This file drives the REAL chain end to end — the saved event
//  list is read from the record store (what Save serialises) and
//  the reopened entries are read back from the restored store
//  (what the next bake receives). Deep equality is exact because
//  every fixture value is quantisation-exact for the codec:
//    - uv endpoints 0/1 (u16 round trip), the -1 pressure
//      sentinel, tilt multiples of 1/50 (i16 round trip);
//    - binary32-exact anchor coordinates (0.25/0.5/0.75/0.125/1/0)
//      and Math.fround width factors (f32 round trip).
//  A failure therefore names a real dropped field, never a
//  rounding artefact.
//
//  Per the plan's law, none of these assertions may be relaxed to
//  make the suite pass: a parity failure is a defect in the seam
//  it names.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  toStudioStroke,
  type AquarelleAnchor,
  type AquarellePayloadEvent,
  type AquarellePoint,
  type AquarelleStroke,
} from '@efxlab/efx-watercolor/payload';
import {
  decodeScriptTimelineBinary,
  encodeScriptTimelineBinary,
} from '../../components/physic-paint/performance/scriptTimelineCodec';
import { encodeStudioScriptSnapshot } from '../../components/physic-paint/performance/studioScriptSnapshotCodec';
import {
  getRecordedAquarellePayloadTimeline,
  recordAquarelleStroke,
  resetAquarelleRecordState,
  restoreAquarelleRecordTimeline,
} from '../../components/physic-paint/view/aquarelleRecordState';
import {
  beginAquarellePathEdit,
  restoreAquarelleEditSnapshot,
} from '../../components/physic-paint/view/aquarelleStrokeSelection';
import {
  draftMode,
  setDraftMode,
  setWireframeMode,
  wireframeMode,
} from '../../components/physic-paint/view/scriptStrokeEdition';
import { projectLayerDocument } from '../../lib/efxPaintPersistence';
import { createEfxPaintDocument } from '../document/efxPaintDocument';

type AquarelleTimelineStroke = ReturnType<typeof toStudioStroke>;

/** Non-default sample fields — every value is codec-exact. */
function point(x: number, y: number, p: number): AquarellePoint {
  return { x, y, p, tx: 10, ty: -10, tw: 5 };
}

/** Existing record-fixture style (aquarelleRecordState.transform.test.ts). */
function stroke(
  mutationId: number,
  overrides: Partial<AquarelleStroke> = {},
): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12, water: 30 },
    brushId: 'round',
    points: [point(0, 0, -1), point(1, 1, 1)],
    mutationId,
    timestamp: mutationId,
    playFrame: 601,
    ...overrides,
  };
}

/** One `auto` anchor carrying the sparse 1.8 width, one `bezier` with handles. */
const VECTOR_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.25, y: 0.5, kind: 'auto', width: Math.fround(1.8) },
  { x: 0.75, y: 0.125, kind: 'bezier', in: { x: 0.5, y: 0.5 }, out: { x: 1, y: 0 } },
];

/** The post-gesture anchor list — one node nudged, everything else stable. */
const MOVED_ANCHORS: readonly AquarelleAnchor[] = [
  { x: 0.3, y: 0.5, kind: 'auto', width: Math.fround(1.8) },
  { x: 0.75, y: 0.125, kind: 'bezier', in: { x: 0.5, y: 0.5 }, out: { x: 1, y: 0 } },
];

/** The persisted-bytes pipeline this phase must keep free of session state. */
const PERSISTENCE_PATH_FILES = [
  'src/components/physic-paint/performance/scriptTimelineCodec.ts',
  'src/components/physic-paint/performance/studioScriptSnapshotCodec.ts',
  'src/efx-paint/compositor/efxPaintCompositeCache.ts',
  'src/efx-paint/compositor/efxPaintCompositor.ts',
  'src/lib/efxPaintPersistence.ts',
  'src/lib/exportEngine.ts',
  '../packages/efx-watercolor/src/payload/toStudioStroke.ts',
  '../packages/efx-watercolor/src/payload/vectorPath.ts',
  '../packages/efx-watercolor/src/bake/aquarelleBake.ts',
] as const;

const SESSION_ONLY_IDENTIFIERS = [
  'wireframeMode',
  'pathEditMutationId',
  'vectorPenActive',
] as const;

/** app/ — the cache test's own root idiom, reused so the scan paths stay stable. */
const APP_ROOT = resolve(__dirname, '../../..');

function readAppSource(relativePath: string): string {
  return readFileSync(resolve(APP_ROOT, relativePath), 'utf8');
}

/**
 * Save then reopen through the shipped chain. `restoreAquarelleRecordTimeline`
 * replaces the whole store, so the returned timeline is exactly what the next
 * frame's bake would receive after an app restart.
 */
function reopen(events: readonly AquarellePayloadEvent[]): readonly AquarellePayloadEvent[] {
  const bytes = encodeScriptTimelineBinary(events);
  restoreAquarelleRecordTimeline(decodeScriptTimelineBinary(bytes));
  return getRecordedAquarellePayloadTimeline();
}

function strokeEntryAt(
  timeline: readonly AquarellePayloadEvent[],
  index = 0,
): AquarelleTimelineStroke {
  const event = timeline[index];
  if (!event || 'kind' in event) {
    throw new Error(`expected a stroke event at timeline index ${index}`);
  }
  return event;
}

describe('61-14 vector stroke export parity', () => {
  beforeEach(() => {
    resetAquarelleRecordState();
  });

  it('reopen parity: a vector stroke keeps its pts and anchor list', () => {
    recordAquarelleStroke(
      201,
      stroke(201, { brushId: 'wc/round-medium', anchors: VECTOR_ANCHORS }),
    );
    const saved = [...getRecordedAquarellePayloadTimeline()];
    const savedEntry = strokeEntryAt(saved);

    const reopened = reopen(saved);
    expect(reopened).toHaveLength(1);
    const reopenedEntry = strokeEntryAt(reopened);

    // Whole-entry equality first: any dropped field fails here with a diff.
    expect(reopenedEntry).toStrictEqual(savedEntry);

    // Named fields separately so a failure names what the seam dropped.
    expect(reopenedEntry.pts, 'pts length').toHaveLength(savedEntry.pts.length);
    for (const [index, source] of savedEntry.pts.entries()) {
      const restored = reopenedEntry.pts[index]!;
      expect(restored.x, `pts[${index}].x`).toBe(source.x);
      expect(restored.y, `pts[${index}].y`).toBe(source.y);
      expect(restored.tick, `pts[${index}].tick`).toBe(source.tick);
    }
    expect(reopenedEntry.engine.anchors, 'engine.anchors').toStrictEqual(
      savedEntry.engine.anchors,
    );

    // The projected anchor shapes, named field by field.
    const anchors = reopenedEntry.engine.anchors!;
    expect(anchors).toHaveLength(2);
    expect(anchors[0]).toStrictEqual({
      x: 0.25,
      y: 0.5,
      kind: 'auto',
      width: Math.fround(1.8),
    });
    expect(anchors[1]).toStrictEqual({
      x: 0.75,
      y: 0.125,
      kind: 'bezier',
      in: { x: 0.5, y: 0.5 },
      out: { x: 1, y: 0 },
    });
  });

  it('reopen parity: a uniform-width path reopens with no width key', () => {
    recordAquarelleStroke(
      203,
      stroke(203, {
        brushId: 'wc/round-medium',
        anchors: [
          { x: 0, y: 0, kind: 'auto', width: 1 },
          { x: 1, y: 1, kind: 'bezier' },
        ],
      }),
    );
    const savedEntry = strokeEntryAt(getRecordedAquarellePayloadTimeline());
    // The sparse law already dropped the explicit 1.0 at projection time.
    expect('width' in savedEntry.engine.anchors![0]!).toBe(false);

    const reopenedEntry = strokeEntryAt(reopen([...getRecordedAquarellePayloadTimeline()]));
    expect(reopenedEntry).toStrictEqual(savedEntry);
    const anchors = reopenedEntry.engine.anchors!;
    expect(anchors[0]).toStrictEqual({ x: 0, y: 0, kind: 'auto' });
    expect(anchors[1]).toStrictEqual({ x: 1, y: 1, kind: 'bezier' });
    expect('width' in anchors[0]!).toBe(false);
    expect('width' in anchors[1]!).toBe(false);
  });

  it('reopen parity: a default hand-painted stroke keeps its exact pre-phase shape', () => {
    // No anchors: the pre-vector stroke shape (REL-02).
    recordAquarelleStroke(205, stroke(205));
    const savedEntry = strokeEntryAt(getRecordedAquarellePayloadTimeline());
    expect('anchors' in savedEntry.engine).toBe(false);

    const reopenedEntry = strokeEntryAt(reopen([...getRecordedAquarellePayloadTimeline()]));
    expect(reopenedEntry).toStrictEqual(savedEntry);
    expect('anchors' in reopenedEntry.engine).toBe(false);
  });

  it('reopen parity: the engine event count and order match the source', () => {
    recordAquarelleStroke(
      211,
      stroke(211, { brushId: 'wc/round-medium', anchors: VECTOR_ANCHORS }),
    );
    recordAquarelleStroke(213, stroke(213));
    recordAquarelleStroke(
      215,
      stroke(215, { brushId: 'wc/round-medium' }),
    );
    const saved = [...getRecordedAquarellePayloadTimeline()];
    const savedIds = saved.map((event) => strokeEntryAt([event]).engine.mutationId);

    const reopened = reopen(saved);
    expect(reopened).toHaveLength(saved.length);
    expect(reopened.map((event) => strokeEntryAt([event]).engine.mutationId)).toStrictEqual(
      savedIds,
    );
    expect(savedIds).toStrictEqual([211, 213, 215]);
  });

  it('sparse width factors [1.8, absent, 0.4] reopen exactly and a uniform factor stores no key', () => {
    recordAquarelleStroke(
      231,
      stroke(231, {
        brushId: 'wc/round-medium',
        anchors: [
          { x: 0, y: 0, kind: 'auto', width: Math.fround(1.8) },
          { x: 0.5, y: 0.5, kind: 'auto' },
          { x: 1, y: 1, kind: 'bezier', width: Math.fround(0.4) },
        ],
      }),
    );
    const savedEntry = strokeEntryAt(getRecordedAquarellePayloadTimeline());
    const reopenedEntry = strokeEntryAt(reopen([...getRecordedAquarellePayloadTimeline()]));
    expect(reopenedEntry).toStrictEqual(savedEntry);

    // The exact three-element shape, including the absent middle factor.
    const anchors = reopenedEntry.engine.anchors!;
    expect(anchors).toHaveLength(3);
    expect(anchors).toStrictEqual([
      { x: 0, y: 0, kind: 'auto', width: Math.fround(1.8) },
      { x: 0.5, y: 0.5, kind: 'auto' },
      { x: 1, y: 1, kind: 'bezier', width: Math.fround(0.4) },
    ]);
    expect(anchors[0]!.width).toBe(Math.fround(1.8));
    expect('width' in anchors[1]!).toBe(false);
    expect(anchors[2]!.width).toBe(Math.fround(0.4));

    // An explicit 1.0 is a uniform factor: absent, never stored (D-10).
    resetAquarelleRecordState();
    recordAquarelleStroke(
      233,
      stroke(233, {
        anchors: [
          { x: 0, y: 0, kind: 'auto', width: 1 },
          { x: 1, y: 1, kind: 'auto' },
        ],
      }),
    );
    const uniformEntry = strokeEntryAt(reopen([...getRecordedAquarellePayloadTimeline()]));
    expect('width' in uniformEntry.engine.anchors![0]!).toBe(false);
    expect('width' in uniformEntry.engine.anchors![1]!).toBe(false);
  });

  it('a path edit, undone then redone, yields byte-identical bake inputs', () => {
    recordAquarelleStroke(
      251,
      stroke(251, { brushId: 'wc/round-medium', anchors: VECTOR_ANCHORS }),
    );
    const beforeSerialised = JSON.stringify(strokeEntryAt(getRecordedAquarellePayloadTimeline()));

    const editId = beginAquarellePathEdit(251, MOVED_ANCHORS);
    expect(editId).not.toBeNull();
    const postEditEntry = strokeEntryAt(getRecordedAquarellePayloadTimeline());
    const postEditSerialised = JSON.stringify(postEditEntry);
    // Sanity: the edit really landed before the history round trip.
    expect(postEditSerialised).not.toBe(beforeSerialised);
    expect(postEditEntry.engine.anchors![0]!.x).toBe(0.3);

    // Undo restores the pre-edit bytes, redo the post-edit bytes — compared as
    // serialised strings, never by object identity.
    expect(restoreAquarelleEditSnapshot(editId!, 'undo')).not.toBeNull();
    expect(JSON.stringify(strokeEntryAt(getRecordedAquarellePayloadTimeline()))).toBe(
      beforeSerialised,
    );

    expect(restoreAquarelleEditSnapshot(editId!, 'redo')).not.toBeNull();
    expect(JSON.stringify(strokeEntryAt(getRecordedAquarellePayloadTimeline()))).toBe(
      postEditSerialised,
    );
  });

  it('the codec is deterministic: two encodes match byte for byte and two decodes match entry for entry', () => {
    recordAquarelleStroke(
      241,
      stroke(241, { brushId: 'wc/round-medium', anchors: VECTOR_ANCHORS }),
    );
    const saved = [...getRecordedAquarellePayloadTimeline()];

    const firstBytes = encodeScriptTimelineBinary(saved);
    const secondBytes = encodeScriptTimelineBinary(saved);
    expect(firstBytes.byteLength).toBeGreaterThan(0);
    expect(secondBytes).toStrictEqual(firstBytes);

    const firstDecoded = decodeScriptTimelineBinary(firstBytes);
    const secondDecoded = decodeScriptTimelineBinary(secondBytes);
    expect(secondDecoded).toHaveLength(saved.length);
    expect(secondDecoded).toStrictEqual(firstDecoded);
  });

  it('view flags never reach the persisted bytes: wireframe on and off serialise identically', () => {
    recordAquarelleStroke(
      261,
      stroke(261, { brushId: 'wc/round-medium', anchors: VECTOR_ANCHORS }),
    );
    recordAquarelleStroke(263, stroke(263, { brushId: 'wc/round-medium' }));
    const events = [...getRecordedAquarellePayloadTimeline()];
    // ONE document: the flag toggle must be the only variable between the two
    // serialisations (createEfxPaintDocument mints fresh ids per call).
    const document = createEfxPaintDocument('layer-1');

    const serialiseLayerDocument = () =>
      JSON.stringify(projectLayerDocument(document, () => undefined));
    const serialiseSnapshot = () =>
      encodeStudioScriptSnapshot({
        projectId: 'project-1',
        layerId: 'layer-1',
        trackId: 'track-1',
        watercolorEvents: events,
        watercolorKeyAnchors: [{ mutationId: 261, keyId: 'key-1' }],
        durableBases: [],
        railCleanupDone: false,
      });

    setDraftMode(false);
    setWireframeMode(false);
    const documentBytesOff = serialiseLayerDocument();
    const snapshotBytesOff = serialiseSnapshot();
    expect(documentBytesOff.length).toBeGreaterThan(0);
    expect(snapshotBytesOff.byteLength).toBeGreaterThan(0);

    setWireframeMode(true);
    // Prove the flags flipped before asserting the bytes did not move.
    expect(wireframeMode.value).toBe(true);
    expect(draftMode.value).toBe(true);
    expect(serialiseLayerDocument()).toBe(documentBytesOff);
    expect(serialiseSnapshot()).toStrictEqual(snapshotBytesOff);

    setWireframeMode(false);
    setDraftMode(false);
    expect(wireframeMode.value).toBe(false);
    expect(serialiseLayerDocument()).toBe(documentBytesOff);
    expect(serialiseSnapshot()).toStrictEqual(snapshotBytesOff);

    // Neither the layer sub-file nor the snapshot container names view state.
    expect(documentBytesOff).not.toContain('wireframe');
    expect(documentBytesOff).not.toContain('draftMode');
    const snapshotText = new TextDecoder().decode(snapshotBytesOff);
    expect(snapshotText).not.toContain('wireframe');
    expect(snapshotText).not.toContain('draftMode');
  });

  it('no persistence-path module references a session-only identifier', () => {
    const scanned = PERSISTENCE_PATH_FILES.map((path) => ({
      path,
      source: readAppSource(path),
    }));
    // Report the scanned count so an empty scan can never pass vacuously.
    expect(scanned).toHaveLength(PERSISTENCE_PATH_FILES.length);
    expect(scanned.length).toBeGreaterThan(0);
    for (const { path, source } of scanned) {
      expect(source.length, `${path} must be non-empty`).toBeGreaterThan(0);
      for (const identifier of SESSION_ONLY_IDENTIFIERS) {
        expect(source.includes(identifier), `${path} must not reference ${identifier}`).toBe(false);
      }
    }
  });
});
