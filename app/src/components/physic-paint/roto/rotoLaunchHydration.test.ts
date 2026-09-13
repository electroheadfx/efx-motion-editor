import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PhysicPaintRotoPhysicalDocument } from './physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from './physicsPaintRotoPhysicalModel';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { hydrateRotoPhysicalLaunchContext } from './rotoLaunchHydration';
import { prepareRotoPhysicalRealKeyFrames } from './rotoCanvasFrames';
import { testWebpBytes } from '../../../testUtils/testWebpBytes';

vi.mock('./rotoCanvasFrames', () => ({
  prepareRotoPhysicalRealKeyFrames: vi.fn(async () => {}),
}));

const rotoRecord = (keyId: string, appFrame: number) => ({
  kind: 'real-key' as const,
  keyId,
  appFrame,
  payload: { frameIndex: appFrame, appFrame, bytes: testWebpBytes(keyId), width: 10, height: 10 },
});

describe('hydrateRotoPhysicalLaunchContext multi-track install', () => {
  it('installs EVERY carried track rotoPhysical, not just the active one', async () => {
    const LAYER_ID = 'layer-1';
    physicPaintStore.reset();
    physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID, 'track-1',
      [rotoRecord('t1-key-1', 0)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    physicPaintStore.replaceRotoPhysicalRecords(
      LAYER_ID, 'track-2',
      [rotoRecord('t2-key-1', 2)],
      { enabled: false, mode: 'duplicate' },
      600,
    );
    const track1Physical = physicPaintStore.getRotoPhysicalDocument(LAYER_ID, 'track-1')!;
    const track2Physical = physicPaintStore.getRotoPhysicalDocument(LAYER_ID, 'track-2')!;
    const base = createEfxPaintDocument(LAYER_ID);
    const context: PhysicPaintLaunchContext = {
      operationId: 'op-1',
      layerId: LAYER_ID,
      startFrame: track1Physical.cursorAppFrame,
      document: {
        ...base,
        activeTrackId: 'track-1',
        tracks: [
          { ...base.tracks[0], id: 'track-1', name: 'Paint 1', rotoPhysical: track1Physical },
          { ...base.tracks[0], id: 'track-2', name: 'Paint 2', rotoPhysical: track2Physical },
        ],
      },
    };
    const installed: string[] = [];
    const store = {
      replaceRotoPhysicalDocument: (_layerId: string, trackId: string, value: unknown) => {
        installed.push(trackId);
        return { ok: true as const, document: value as PhysicPaintRotoPhysicalDocument };
      },
    };
    const result = await hydrateRotoPhysicalLaunchContext(context, store);
    expect(result.ok).toBe(true);
    // Both tracks install — the strip renders every track's cells from the
    // child's runtime, so a non-active track with keys must not show empty.
    expect(installed).toEqual(['track-1', 'track-2']);
    // The returned document is the ACTIVE track's install (the launch
    // authority — its cursor/selection were overridden to the requested frame).
    if (result.ok) {
      expect(result.document.realKeyRecords.map((record) => record.keyId)).toEqual(['t1-key-1']);
    }
  });

  it('a reference-only key never kills the launch: prep skips it loudly and every track still installs (quick-260913-52r G)', async () => {
    const LAYER_ID = 'layer-g';
    physicPaintStore.reset();
    const bytesRecord = rotoRecord('key-bytes', 0);
    const mediaRecord = {
      kind: 'real-key' as const,
      keyId: 'key-media',
      appFrame: 1,
      payload: {
        frameIndex: 1,
        appFrame: 1,
        media: { relativePath: `frames/${LAYER_ID}/key-media.webp`, digest: 'a'.repeat(64), width: 10, height: 10 },
        width: 10,
        height: 10,
      },
    };
    const records = [bytesRecord, mediaRecord];
    const physical: PhysicPaintRotoPhysicalDocument = {
      capacity: 24,
      realKeyRecords: records as never,
      groupOverrideRecords: [],
      interpolation: { enabled: false, mode: 'duplicate' },
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      revision: buildPhysicPaintRotoPhysicalRevision(records as never, { enabled: false, mode: 'duplicate' }, [], [], []),
    } as never;
    const base = createEfxPaintDocument(LAYER_ID);
    const context: PhysicPaintLaunchContext = {
      operationId: 'op-g',
      layerId: LAYER_ID,
      startFrame: physical.cursorAppFrame,
      document: {
        ...base,
        activeTrackId: 'track-1',
        tracks: [{ ...base.tracks[0], id: 'track-1', name: 'Paint 1', rotoPhysical: physical }],
      },
    };
    const installed: string[] = [];
    const store = {
      replaceRotoPhysicalDocument: (_layerId: string, trackId: string, value: unknown) => {
        installed.push(trackId);
        return { ok: true as const, document: value as PhysicPaintRotoPhysicalDocument };
      },
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const prepMock = vi.mocked(prepareRotoPhysicalRealKeyFrames);
    prepMock.mockClear();

    const result = await hydrateRotoPhysicalLaunchContext(context, store);

    // The launch SURVIVES a reference-only record: the structural install
    // still runs and the prep receives only the byte-carrying records.
    expect(result.ok).toBe(true);
    expect(installed).toEqual(['track-1']);
    expect(prepMock).toHaveBeenCalledTimes(1);
    expect(prepMock.mock.calls[0]![0].map((record) => record.keyId)).toEqual(['key-bytes']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('key-media'));
    warnSpy.mockRestore();
  });
});
