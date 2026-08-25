import { describe, expect, it, vi } from 'vitest';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PhysicPaintRotoPhysicalDocument } from './physicsPaintRotoPhysicalModel';
import { createEfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import { physicPaintStore } from '../../../stores/physicPaintStore';
import { hydrateRotoPhysicalLaunchContext } from './rotoLaunchHydration';

vi.mock('./rotoCanvasFrames', () => ({
  prepareRotoPhysicalRealKeyPngs: vi.fn(async () => {}),
}));

const pngDataUrl = (label: string) => `data:image/png;base64,${btoa(`${String.fromCharCode(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)}${label}`)}`;

const rotoRecord = (keyId: string, appFrame: number) => ({
  kind: 'real-key' as const,
  keyId,
  appFrame,
  payload: { frameIndex: appFrame, appFrame, dataUrl: pngDataUrl(keyId), width: 10, height: 10 },
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
});
