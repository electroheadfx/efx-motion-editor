import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { createEfxPaintDocument, type EfxPaintDocument, type InternalPaintTrack } from '../efx-paint/document/efxPaintDocument';
import {
  buildPhysicPaintRotoPhysicalRevision,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { materializePackageRotoMediaBytes } from './efxPaintMediaMaterialize';
import type { EfxPaintLoadedDocument } from './efxPaintPersistence';

const { readFrameMediaMock } = vi.hoisted(() => ({ readFrameMediaMock: vi.fn() }));

vi.mock('./ipc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ipc')>()),
  ipcEfxPaintReadFrameMedia: readFrameMediaMock,
}));

const PACKAGE_DIR = '/tmp/materialize-package';
const LAYER = 'layer-g';
const digestOf = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };

function record(keyId: string, appFrame: number, digest: string): unknown {
  return {
    kind: 'real-key',
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      media: { relativePath: `frames/${LAYER}/${keyId}.webp`, digest, width: 4, height: 4 },
      width: 4,
      height: 4,
    },
  };
}

function physical(realKeyRecords: unknown[], groupOverrideRecords: unknown[] = []) {
  return {
    capacity: 24,
    realKeyRecords,
    groupOverrideRecords,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
    revision: buildPhysicPaintRotoPhysicalRevision(
      realKeyRecords as never,
      INTERPOLATION,
      [],
      [],
      groupOverrideRecords as never,
    ),
  };
}

function track(id: string, overrides: Partial<Omit<InternalPaintTrack, 'id'>> = {}): InternalPaintTrack {
  return {
    id,
    name: id,
    order: 0,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal',
    revision: 0,
    frames: {},
    rotoPhysical: null,
    loopClips: [],
    ...overrides,
  };
}

function documentOf(tracks: InternalPaintTrack[]): EfxPaintDocument {
  const base = createEfxPaintDocument(LAYER);
  return { ...base, activeTrackId: tracks[0]?.id ?? base.activeTrackId, tracks };
}

function loadedOf(document: EfxPaintDocument): ReadonlyMap<string, EfxPaintLoadedDocument> {
  return new Map([[LAYER, { document, frames: new Map(), cacheLocations: new Map() }]]);
}

describe('quick-260913-52r (G): package roto media materialization at open', () => {
  beforeEach(() => {
    readFrameMediaMock.mockReset();
  });

  it('materializes both collections and recomputes the track revision', async () => {
    const realBytes = testWebpBytes('real');
    const overrideBytes = testWebpBytes('override');
    readFrameMediaMock.mockImplementation(async (_packageDir: string, relativePath: string) => {
      if (relativePath.endsWith('key-real.webp')) return { ok: true, data: { bytes: realBytes, digest: digestOf(realBytes) } };
      return { ok: true, data: { bytes: overrideBytes, digest: digestOf(overrideBytes) } };
    });
    const document = documentOf([
      track('track-a', {
        rotoPhysical: physical(
          [record('key-real', 0, digestOf(realBytes))],
          [record('override-1', 1, digestOf(overrideBytes))],
        ) as never,
      }),
      track('track-b'),
    ]);
    const originalRevision = document.tracks[0]!.rotoPhysical!.revision;

    const result = await materializePackageRotoMediaBytes(loadedOf(document), PACKAGE_DIR);

    expect(result.failures).toEqual([]);
    expect(result.materializedKeys).toBe(2);
    expect(readFrameMediaMock).toHaveBeenCalledWith(PACKAGE_DIR, `frames/${LAYER}/key-real.webp`);
    expect(readFrameMediaMock).toHaveBeenCalledWith(PACKAGE_DIR, `frames/${LAYER}/override-1.webp`);

    const runtime = result.runtimeDocuments.get(LAYER)!;
    const runtimePhysical = runtime.tracks[0]!.rotoPhysical!;
    const materializedReal = runtimePhysical.realKeyRecords[0]!;
    expect(materializedReal.payload.bytes).toBe(realBytes);
    expect(materializedReal.payload.media).toBeUndefined();
    expect(runtimePhysical.groupOverrideRecords![0]!.payload.bytes).toBe(overrideBytes);
    // The recomputed revision reflects the carrier change: it equals the
    // builder over the materialized collections (never the reference-only one).
    expect(runtimePhysical.revision).not.toBe(originalRevision);
    expect(runtimePhysical.revision).toBe(buildPhysicPaintRotoPhysicalRevision(
      runtimePhysical.realKeyRecords,
      INTERPOLATION,
      [],
      [],
      runtimePhysical.groupOverrideRecords ?? [],
    ));
    // A track without rotoPhysical passes through untouched.
    expect(runtime.tracks[1]!.rotoPhysical).toBeNull();
    // The loaded (persisted) document is never mutated: it stays reference-only.
    expect(document.tracks[0]!.rotoPhysical!.realKeyRecords[0]!.payload.bytes).toBeUndefined();
    expect(document.tracks[0]!.rotoPhysical!.realKeyRecords[0]!.payload.media).toBeDefined();
  });

  it('a missing file is reported per key and keeps the record reference-only', async () => {
    readFrameMediaMock.mockResolvedValue({ ok: false, error: { kind: 'missing' } });
    const digest = digestOf(testWebpBytes('gone'));
    const document = documentOf([track('track-a', { rotoPhysical: physical([record('key-missing', 0, digest)]) as never })]);

    const result = await materializePackageRotoMediaBytes(loadedOf(document), PACKAGE_DIR);

    expect(result.materializedKeys).toBe(0);
    expect(result.failures).toEqual([
      Object.freeze({
        layerId: LAYER,
        trackId: 'track-a',
        collection: 'real-key',
        keyId: 'key-missing',
        relativePath: `frames/${LAYER}/key-missing.webp`,
        reason: 'missing',
      }),
    ]);
    const runtimePhysical = result.runtimeDocuments.get(LAYER)!.tracks[0]!.rotoPhysical!;
    expect(runtimePhysical.realKeyRecords[0]!.payload.media).toBeDefined();
    expect(runtimePhysical.realKeyRecords[0]!.payload.bytes).toBeUndefined();
  });

  it('a digest mismatch is refused per key — the record is never given unverified bytes', async () => {
    const bytes = testWebpBytes('tampered');
    readFrameMediaMock.mockResolvedValue({ ok: true, data: { bytes, digest: 'f'.repeat(64) } });
    const document = documentOf([track('track-a', { rotoPhysical: physical([record('key-tampered', 0, 'a'.repeat(64))]) as never })]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const result = await materializePackageRotoMediaBytes(loadedOf(document), PACKAGE_DIR);

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]!.reason).toBe('digest-mismatch');
    const runtimePhysical = result.runtimeDocuments.get(LAYER)!.tracks[0]!.rotoPhysical!;
    expect(runtimePhysical.realKeyRecords[0]!.payload.bytes).toBeUndefined();
    expect(runtimePhysical.realKeyRecords[0]!.payload.media).toBeDefined();
    warn.mockRestore();
  });
});
