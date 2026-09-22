/**
 * A key whose frame file could not be read at project open stays reference-only.
 * The launch tolerates it by design (quick-260913-52r G: warned per key, "the
 * frame renders as missing content") and installs the record so its key and rail
 * stay correct — which makes a reference-only record REACHABLE in the runtime
 * document for the first time.
 *
 * The strict consumers are therefore split by contract:
 *  - the PUBLISH seed refuses it loudly (debug studio-reopen-empty-boot LEG 2 —
 *    a door-materialization regression must not go unnoticed), and
 *  - the projections the Studio runs at BOOT must skip it instead, because a
 *    throw there kills the boot render: the strip's onion projection runs in a
 *    render memo over the same rail records, so refusing leaves the Studio an
 *    empty window with the engine never ready.
 */
import { describe, expect, it } from 'vitest';
import { recordsAsRuntimeFrames } from './useRotoFramePersistenceCoordinator';
import { projectRotoOnionPreviewFrames } from '../roto/rotoOnionPreview';
import type {
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoPhysicalRenderSource,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';

const withBytes = {
  kind: 'real-key',
  keyId: 'key-with-bytes',
  appFrame: 4,
  payload: { frameIndex: 0, appFrame: 4, bytes: new Uint8Array([1, 2, 3]), width: 4, height: 4 },
} as unknown as PhysicPaintRotoRealKeyRecord;

const referenceOnly = {
  kind: 'real-key',
  keyId: 'key-reference-only',
  appFrame: 9,
  payload: {
    frameIndex: 1,
    appFrame: 9,
    media: { relativePath: 'frames/layer/key.webp', digest: 'abcd', width: 4, height: 4 },
  },
} as unknown as PhysicPaintRotoRealKeyRecord;

const document = {
  revision: 3,
  realKeyRecords: [withBytes, referenceOnly],
} as unknown as PhysicPaintRotoPhysicalDocument;

const renderSource = (record: PhysicPaintRotoRealKeyRecord): PhysicPaintRotoPhysicalRenderSource => ({
  kind: 'real',
  keyId: record.keyId,
  appFrame: record.appFrame,
  renderedFrame: record.payload,
  contentRevision: 'rev-1',
  cacheRevision: `rev-1:real:${record.keyId}`,
}) as unknown as PhysicPaintRotoPhysicalRenderSource;

describe('runtime projections and a reference-only record', () => {
  it('the PUBLISH seed stays strict by contract (a violation must stay loud)', () => {
    // debug studio-reopen-empty-boot LEG 2: the publish path keeps refusing, so
    // a door-materialization regression cannot go unnoticed. Only the boot seed
    // tolerates.
    expect(() => recordsAsRuntimeFrames(document)).toThrow(/carries no inline raster bytes/);
  });

  it('the onion projection skips it instead of refusing the strip', () => {
    const frames = projectRotoOnionPreviewFrames({
      currentFrame: 9,
      isPlaying: false,
      onion: { enabled: true, previous: true, next: true, count: 1, opacity: 0.5 },
      realKeyRecords: [withBytes, referenceOnly],
      getRenderSource: (appFrame) => (appFrame === 4 ? renderSource(withBytes) : renderSource(referenceOnly)),
    });

    expect(frames.map((frame) => frame.frame)).toEqual([4]);
  });
});
