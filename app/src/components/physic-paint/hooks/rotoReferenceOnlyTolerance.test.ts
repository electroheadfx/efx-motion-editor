/**
 * The tolerant launch (quick-260913-52r G) installs carried reference-only
 * records into the runtime document when a key's package file could not be
 * read — warned per key at the door, "the frame renders as missing content".
 *
 * Every runtime projection that reads pixels must therefore SKIP such a record
 * rather than refuse the whole document: refusing leaves the Studio unable to
 * boot at all (the rejection lands in the async launch chain, so the window
 * comes up empty with the engine never ready).
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

describe('runtime projections tolerate a reference-only record', () => {
  it('the cache-frame projection skips it instead of refusing the document', () => {
    const frames = recordsAsRuntimeFrames(document);

    expect(frames.map((frame) => frame.appFrame)).toEqual([4]);
    expect(frames).toHaveLength(1);
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
