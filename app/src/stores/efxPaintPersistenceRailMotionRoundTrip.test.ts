/**
 * Phase 59-03 (MOTN-12 / REL-02 / REL-03): rail-motion save → reopen is
 * byte-identical.
 *
 * This test is the ONLY enforcement of the paint payload's persistence
 * contract: `mceFieldContract.test.ts` covers the `Mce*` interfaces only and
 * never sees `rotoPhysical`. Deleting this file as "redundant" against that
 * contract silently re-opens the exact defect class this plan closes — a
 * collection that parses but is absent from the runtime read disappears on
 * reopen, with every model-level test still green.
 *
 * The reopen path is the real one: serialize the runtime into a document,
 * parse it through the fail-closed document parser, register it into fresh
 * stores, hydrate the runtime maps, then serialize again. Both serializations
 * are compared as full JSON strings, character by character.
 */

import { testWebpBytes } from '../testUtils/testWebpBytes';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { parseEfxPaintDocument } from '../efx-paint/document/efxPaintDocumentParsers';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { PhysicPaintRenderedFrame } from '../types/physicPaint';
import { _setPhysicPaintMarkDirtyCallback, physicPaintStore } from './physicPaintStore';
import {
  _setEfxPaintMarkDirtyCallback,
  hydrateRuntimeFromDocument,
  registerDocument,
  reset,
  serializeRuntimeIntoDocument,
} from './efxPaintStore';

const LAYER_ID = 'layer-59-03-roundtrip';
const TRACK_ID = 'track-1';
const INTERPOLATION = Object.freeze({ enabled: false, mode: 'duplicate' as const });

function makeTrackDocument(): EfxPaintDocument {
  const document = createEfxPaintDocument(LAYER_ID);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TRACK_ID,
    tracks: [{ ...track, id: TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

const keyRecord = (keyId: string, appFrame: number) => ({
  kind: 'real-key' as const,
  keyId,
  appFrame,
  payload: {
    frameIndex: appFrame,
    appFrame,
    bytes: testWebpBytes(keyId),
    width: 10,
    height: 10,
  },
});

const RECORDS = [keyRecord('key-1', 0), keyRecord('key-2', 4)];

/** One canonical rail-motion record: grouped Position (D-12), one anchor key. */
const RAIL_A = {
  railId: 'rail-a',
  anchorKeyId: 'key-1',
  channels: [
    {
      id: 'position-x' as const,
      keys: [
        { frame: 0, value: 0, easing: 'ease' as const, wiggle: 0 },
        { frame: 4, value: 40, easing: 'ease' as const, wiggle: 0 },
      ],
    },
    {
      id: 'position-y' as const,
      keys: [
        { frame: 0, value: 0, easing: 'ease' as const, wiggle: 0 },
        { frame: 4, value: -20, easing: 'ease' as const, wiggle: 0 },
      ],
    },
  ],
};

describe('59-03: rail-motion persistence round-trip (save → reopen byte identity)', () => {
  beforeEach(() => {
    _setPhysicPaintMarkDirtyCallback(() => {});
    _setEfxPaintMarkDirtyCallback(() => {});
    physicPaintStore.reset();
    reset();
  });

  it('serialize → parse → register → hydrate → serialize is byte-identical', () => {
    registerDocument(makeTrackDocument());

    const installed = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID,
      TRACK_ID,
      RECORDS,
      INTERPOLATION,
      32,
    );
    expect(installed.ok).toBe(true);
    const motionSet = physicPaintStore.replaceRotoPhysicalRailMotions(LAYER_ID, TRACK_ID, [RAIL_A]);
    expect(motionSet.ok).toBe(true);

    // Save boundary: the runtime projection the package writer consumes.
    const first = serializeRuntimeIntoDocument(LAYER_ID);
    const firstJson = JSON.stringify(first);
    expect(first.tracks[0].rotoPhysical?.railMotions).toEqual([RAIL_A]);

    // Reopen boundary: fresh stores, fail-closed parse, real hydrate path.
    physicPaintStore.reset();
    reset();
    const parsed = parseEfxPaintDocument(first);
    registerDocument(parsed);
    hydrateRuntimeFromDocument(parsed, new Map<string, Map<number, PhysicPaintRenderedFrame>>());

    // The runtime read carries the collection...
    expect(physicPaintStore.getRotoPhysicalRailMotions(LAYER_ID, TRACK_ID)).toEqual([RAIL_A]);

    // ...and the second serialization is the SAME string, byte for byte.
    const second = serializeRuntimeIntoDocument(LAYER_ID);
    expect(JSON.stringify(second)).toBe(firstJson);

    // Reopening did not materialize a second copy, reorder channels or
    // renumber frames: every scalar survives verbatim.
    const reopened = second.tracks[0].rotoPhysical?.railMotions;
    expect(reopened).toHaveLength(1);
    expect(reopened?.[0].railId).toBe('rail-a');
    expect(reopened?.[0].anchorKeyId).toBe('key-1');
    expect(reopened?.[0].channels.map((channel) => channel.id)).toEqual(['position-x', 'position-y']);
    expect(reopened?.[0].channels[0].keys.map((key) => key.frame)).toEqual([0, 4]);
    expect(reopened?.[0].channels[0].keys.map((key) => key.value)).toEqual([0, 40]);
    expect(reopened?.[0].channels[1].keys.map((key) => key.value)).toEqual([0, -20]);
  });

  it('an untouched document stays byte-identical across the same round trip', () => {
    registerDocument(makeTrackDocument());
    const installed = physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID,
      TRACK_ID,
      RECORDS,
      INTERPOLATION,
      32,
    );
    expect(installed.ok).toBe(true);

    const first = serializeRuntimeIntoDocument(LAYER_ID);
    expect(first.tracks[0].rotoPhysical?.railMotions).toEqual([]);

    physicPaintStore.reset();
    reset();
    const parsed = parseEfxPaintDocument(first);
    registerDocument(parsed);
    hydrateRuntimeFromDocument(parsed, new Map<string, Map<number, PhysicPaintRenderedFrame>>());

    expect(JSON.stringify(serializeRuntimeIntoDocument(LAYER_ID))).toBe(JSON.stringify(first));
  });
});
