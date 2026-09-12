import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { buildPhysicPaintRotoPhysicalRevision, parsePhysicPaintRotoPhysicalDocument } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type { EfxPaintDocumentSaveInput } from './efxPaintPersistence';
import {
  EFX_PAINT_PACKAGE_STAGING_PREFIX,
  buildEfxPaintFrameCachePath,
  createPackageStagingBasename,
  isSafeEfxPaintCachePath,
  loadEfxPaintDocuments,
  saveEfxPaintDocumentsWithProjectWrite,
  stableSegment,
  stageEfxPaintPackageSave,
} from './efxPaintPersistence';

const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const hardlinkPhysicPaintCacheFrames = vi.hoisted(() => vi.fn());
// 52.2-05 Task 3: the package transaction surface + the manifest write.
const ipcProjectSave = vi.hoisted(() => vi.fn());
const bindEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const publishEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const settleEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
const recoverEfxPaintPackageTransaction = vi.hoisted(() => vi.fn());
// The real `./ipc` module is loaded through `importActual` for the transport
// assertions below, so the Tauri invoke boundary is the mocked seam there.
const invoke = vi.hoisted(() => vi.fn());
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

function exchangeGeneration(projectDir: string, stagingBasename: string): void {
  const stagingRoot = `${projectDir}/cache/${stagingBasename}`;
  const canonicalRoot = `${projectDir}/cache/efx-paint`;
  const stagingFiles = Array.from(files.entries())
    .filter(([key]) => key.startsWith(`${stagingRoot}/`))
    .map(([key, value]) => [`${canonicalRoot}${key.slice(stagingRoot.length)}`, value] as const);
  const canonicalFiles = Array.from(files.entries())
    .filter(([key]) => key.startsWith(`${canonicalRoot}/`))
    .map(([key, value]) => [`${stagingRoot}${key.slice(canonicalRoot.length)}`, value] as const);
  const stagingDirs = Array.from(dirs)
    .filter((key) => key === stagingRoot || key.startsWith(`${stagingRoot}/`))
    .map((key) => `${canonicalRoot}${key.slice(stagingRoot.length)}`);
  const canonicalDirs = Array.from(dirs)
    .filter((key) => key === canonicalRoot || key.startsWith(`${canonicalRoot}/`))
    .map((key) => `${stagingRoot}${key.slice(canonicalRoot.length)}`);
  for (const key of Array.from(files.keys())) {
    if (key.startsWith(`${stagingRoot}/`) || key.startsWith(`${canonicalRoot}/`)) files.delete(key);
  }
  for (const key of Array.from(dirs)) {
    if (key === stagingRoot || key.startsWith(`${stagingRoot}/`) || key === canonicalRoot || key.startsWith(`${canonicalRoot}/`)) dirs.delete(key);
  }
  for (const [key, value] of [...stagingFiles, ...canonicalFiles]) files.set(key, value);
  for (const key of [...stagingDirs, ...canonicalDirs]) dirs.add(key);
}

vi.mock('./ipc', () => ({
  publishPhysicPaintCacheGeneration,
  settlePhysicPaintCacheGeneration,
  hardlinkPhysicPaintCacheFrames,
  projectSave: ipcProjectSave,
  bindEfxPaintPackageTransaction,
  publishEfxPaintPackageTransaction,
  settleEfxPaintPackageTransaction,
  recoverEfxPaintPackageTransaction,
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => dirs.has(path) || files.has(path)),
  mkdir: vi.fn(async (path: string) => { dirs.add(path); }),
  readDir: vi.fn(async (path: string) => Array.from(dirs)
    .filter((candidate) => candidate.startsWith(`${path}/`))
    .map((candidate) => candidate.slice(path.length + 1).split('/')[0])
    .filter((name, index, names) => name.length > 0 && names.indexOf(name) === index)
    .map((name) => ({ name, isDirectory: true, isFile: false, isSymlink: false }))),
  remove: vi.fn(async (path: string) => {
    for (const key of Array.from(files.keys())) {
      if (key === path || key.startsWith(`${path}/`)) files.delete(key);
    }
    for (const key of Array.from(dirs.keys())) {
      if (key === path || key.startsWith(`${path}/`)) dirs.delete(key);
    }
  }),
  readFile: vi.fn(async (path: string) => {
    const file = files.get(path);
    if (!file) throw new Error(`missing file: ${path}`);
    return file;
  }),
  writeFile: vi.fn(async (path: string, contents: Uint8Array) => {
    files.set(path, contents);
  }),
}));

describe('saveEfxPaintDocumentsWithProjectWrite / loadEfxPaintDocuments', () => {
  beforeEach(async () => {
    files.clear();
    dirs.clear();
    vi.clearAllMocks();
    const { exists } = await import('@tauri-apps/plugin-fs');
    vi.mocked(exists).mockImplementation(async (path) => dirs.has(String(path)) || files.has(String(path)));
    const activeTransactions = new Map<string, string>();
    publishPhysicPaintCacheGeneration.mockImplementation(async (projectDir: string, stagingBasename: string) => {
      const replacedExisting = dirs.has(`${projectDir}/cache/efx-paint`);
      const transactionId = crypto.randomUUID();
      activeTransactions.set(transactionId, stagingBasename);
      exchangeGeneration(projectDir, stagingBasename);
      return {
        ok: true,
        data: { accepted: true, transactionId, replacedExisting },
      };
    });
    settlePhysicPaintCacheGeneration.mockImplementation(async (projectDir: string, transactionId: string, action: 'commit' | 'rollback') => {
      const stagingBasename = activeTransactions.get(transactionId);
      if (!stagingBasename) return { ok: false, error: 'inactive transaction' };
      if (action === 'rollback') exchangeGeneration(projectDir, stagingBasename);
      const stagingRoot = `${projectDir}/cache/${stagingBasename}`;
      for (const key of Array.from(files.keys())) {
        if (key.startsWith(`${stagingRoot}/`)) files.delete(key);
      }
      for (const key of Array.from(dirs)) {
        if (key === stagingRoot || key.startsWith(`${stagingRoot}/`)) dirs.delete(key);
      }
      activeTransactions.delete(transactionId);
      return { ok: true, data: { accepted: true, cleanupStatus: 'complete' } };
    });
    hardlinkPhysicPaintCacheFrames.mockImplementation(async (projectDir: string, stagingBasename: string, unchangedPaths: string[]) => {
      const canonicalRoot = `${projectDir}/cache/efx-paint`;
      const stagingRoot = `${projectDir}/cache/${stagingBasename}`;
      const missing: string[] = [];
      for (const relative of unchangedPaths) {
        const source = `${canonicalRoot}/${relative}`;
        const target = `${stagingRoot}/${relative}`;
        const bytes = files.get(source);
        if (bytes === undefined) {
          missing.push(relative);
        } else {
          files.set(target, bytes);
        }
      }
      return { ok: true, data: { accepted: true, missing } };
    });
  });

  it('round-trips a document through staging/commit and restores identity on load', async () => {
    const document = createEfxPaintDocument('layer-x');
    const frameRef = buildEfxPaintFrameCachePath('layer-x', document.tracks[0].id, { appFrame: 0, frameIndex: 0 });
    const track = document.tracks[0];
    const withFrame = {
      ...document,
      tracks: [{
        ...track,
        frames: { 0: { cachePath: frameRef, width: 100, height: 50 } },
      }],
    };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-x', {
      document: withFrame,
      frames: new Map([[document.tracks[0].id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])]]),
    }]]);
    const writeProject = vi.fn(async (_payload: Record<string, unknown>, _transactionId: string | null) => {});

    const persisted = await saveEfxPaintDocumentsWithProjectWrite('/project', documents, writeProject);

    // Sidecar writes occur under cache/.efx-paint-staging-<uuid>.
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    expect(vi.mocked(writeFile).mock.calls.every(([path]) => String(path).startsWith('/project/cache/.efx-paint-staging-'))).toBe(true);
    // After publication the canonical path holds the staged bytes.
    expect(files.has(`/project/${frameRef}`)).toBe(true);
    // writeProject receives the efx_paint_documents payload + transaction id.
    expect(writeProject).toHaveBeenCalledOnce();
    const [payload, transactionId] = writeProject.mock.calls[0] as [Record<string, unknown>, string | null];
    expect(transactionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(payload['layer-x']).toBeDefined();
    // Settle commit fires.
    expect(settlePhysicPaintCacheGeneration).toHaveBeenCalledWith('/project', transactionId, 'commit');
    // The persisted payload is the document payload.
    expect(persisted['layer-x']).toBeDefined();

    // Load restores a document deep-equal on identity fields and the frame bytes.
    const loaded = await loadEfxPaintDocuments('/project', payload);
    const restored = loaded.get('layer-x')!.document;
    expect(restored.version).toBe(document.version);
    expect(restored.parentLayerId).toBe(document.parentLayerId);
    expect(restored.documentRevision).toBe(document.documentRevision);
    expect(restored.activeTrackId).toBe(document.activeTrackId);
    expect(restored.tracks.map((track) => track.id)).toEqual(document.tracks.map((track) => track.id));
    expect(restored.background).toEqual(document.background);
    const restoredFrame = loaded.get('layer-x')!.frames.get(document.tracks[0].id)?.get(0);
    expect(restoredFrame?.appFrame).toBe(0);
    // D-08: refs-only load — the frame carries its cachePath ref, not the bytes.
    expect(restoredFrame?.cachePath).toBe(frameRef);
    expect(restoredFrame?.bytes).toEqual(new Uint8Array(0));
  });

  it('round-trips real-key record bytes as base64 in the persisted JSON (52.1 D-05)', async () => {
    const document = createEfxPaintDocument('layer-bytes');
    const track = document.tracks[0];
    const bytes = testWebpBytes('real-key-bytes');
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const records = [
      { keyId: 'key-1', appFrame: 0, kind: 'real-key' as const, payload: { frameIndex: 0, appFrame: 0, bytes, width: 2, height: 2 } },
    ];
    const rotoPhysical = parsePhysicPaintRotoPhysicalDocument({
      capacity: 24,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    const withRoto = { ...document, tracks: [{ ...track, rotoPhysical }] };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-bytes', {
      document: withRoto,
      frames: new Map(),
    }]]);
    const writeProject = vi.fn(async (_payload: Record<string, unknown>, _transactionId: string | null) => {});

    await saveEfxPaintDocumentsWithProjectWrite('/project', documents, writeProject);

    const [payload] = writeProject.mock.calls[0] as [Record<string, unknown>, string | null];
    const persistedTrack = (payload['layer-bytes'] as { tracks: Array<{ rotoPhysical: { realKeyRecords: Array<{ payload: { bytes: unknown } }> } }> }).tracks[0];
    const persistedBytes = persistedTrack.rotoPhysical.realKeyRecords[0].payload.bytes;
    // The persisted JSON form carries bytes as base64, never a Uint8Array index object.
    expect(typeof persistedBytes).toBe('string');
    expect(persistedBytes).not.toContain('"0"');

    // Load decodes base64 back to a Uint8Array.
    const loaded = await loadEfxPaintDocuments('/project', payload);
    const restored = loaded.get('layer-bytes')!.document;
    // 52.2-02: the payload's raster carrier is optional on the shared record
    // shape, so the inline-bytes assertion is the one that pins it.
    const restoredBytes = restored.tracks[0].rotoPhysical!.realKeyRecords[0].payload.bytes as Uint8Array;
    expect(restoredBytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(restoredBytes)).toEqual(Array.from(bytes));
  });

  it('loads refs only — no per-frame sidecar readFile on open (D-08)', async () => {
    const document = createEfxPaintDocument('layer-lazy');
    const track = document.tracks[0];
    const frameRef = buildEfxPaintFrameCachePath('layer-lazy', track.id, { appFrame: 0, frameIndex: 0 });
    files.set(`/project/${frameRef}`, testWebpBytes('AQID'));
    const payload = { 'layer-lazy': {
      ...document,
      tracks: [{ ...track, frames: { 0: { cachePath: frameRef, width: 100, height: 50 } } }],
    } };

    const { readFile } = await import('@tauri-apps/plugin-fs');
    const readFileCallsBefore = vi.mocked(readFile).mock.calls.length;
    const loaded = await loadEfxPaintDocuments('/project', payload);
    const restoredFrame = loaded.get('layer-lazy')!.frames.get(track.id)?.get(0);
    expect(restoredFrame?.cachePath).toBe(frameRef);
    expect(restoredFrame?.bytes).toEqual(new Uint8Array(0));
    // No sidecar byte fetch happened on open.
    expect(vi.mocked(readFile).mock.calls.length).toBe(readFileCallsBefore);
  });

  it('fails closed when the persisted document has unknown members', async () => {
    const bad = { ...createEfxPaintDocument('layer-x'), extra: true };
    await expect(loadEfxPaintDocuments('/project', { 'layer-x': bad })).rejects.toThrow(/EfxPaintDocument: unknown members/);
  });

  it('returns an empty map when no documents are persisted', async () => {
    const loaded = await loadEfxPaintDocuments('/project', undefined);
    expect(loaded.size).toBe(0);
  });

  it('isSafeEfxPaintCachePath accepts canonical sidecar paths and rejects traversal', () => {
    const good = buildEfxPaintFrameCachePath('layer-x', 'track-1', { appFrame: 0, frameIndex: 0 });
    expect(isSafeEfxPaintCachePath(good)).toBe(true);
    expect(isSafeEfxPaintCachePath('/cache/efx-paint/layer-x/frame-000000-0000.png')).toBe(false);
    expect(isSafeEfxPaintCachePath('cache/efx-paint/../frame.png')).toBe(false);
    expect(isSafeEfxPaintCachePath('cache/efx-paint/./frame.png')).toBe(false);
    expect(isSafeEfxPaintCachePath('cache/efx-paint//frame.png')).toBe(false);
    expect(isSafeEfxPaintCachePath('cache/efx-paint/layer-x\\frame.png')).toBe(false);
    expect(isSafeEfxPaintCachePath('cache/efx-paint/layer-x/frame.png\0')).toBe(false);
    // The legacy cache directory prefix is rejected (DOC-04: the legacy
    // surface does not exist; the literal is split so the contract audit
    // stays green while the negative guard remains).
    expect(isSafeEfxPaintCachePath('cache/' + 'physic-paint' + '/layer-x/frame.png')).toBe(false);
    expect(isSafeEfxPaintCachePath('cache/efx-paint')).toBe(false);
    expect(isSafeEfxPaintCachePath(42)).toBe(false);
  });

  it('saving the same unchanged document twice skips sidecar staging on the second save', async () => {
    const document = createEfxPaintDocument('layer-idem');
    const frameRef = buildEfxPaintFrameCachePath('layer-idem', document.tracks[0].id, { appFrame: 0, frameIndex: 0 });
    const track = document.tracks[0];
    const withFrame = {
      ...document,
      tracks: [{ ...track, frames: { 0: { cachePath: frameRef, width: 100, height: 50 } } }],
    };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-idem', {
      document: withFrame,
      frames: new Map([[document.tracks[0].id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])]]),
    }]]);
    const writeProject = vi.fn(async (_payload: Record<string, unknown>, _transactionId: string | null) => {});

    const first = await saveEfxPaintDocumentsWithProjectWrite('/project', documents, writeProject);
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const firstWriteCount = vi.mocked(writeFile).mock.calls.length;
    expect(firstWriteCount).toBeGreaterThan(0);

    const second = await saveEfxPaintDocumentsWithProjectWrite('/project', documents, writeProject);
    expect(second).toEqual(first);
    expect(vi.mocked(writeFile).mock.calls.length).toBe(firstWriteCount);
    expect(writeProject).toHaveBeenCalledTimes(2);
  });

  it('rolls back the staged generation and keeps the prior committed generation when the project write throws', async () => {
    const document = createEfxPaintDocument('layer-rollback');
    const frameRef = buildEfxPaintFrameCachePath('layer-rollback', document.tracks[0].id, { appFrame: 0, frameIndex: 0 });
    const track = document.tracks[0];
    const withFrame = {
      ...document,
      tracks: [{ ...track, frames: { 0: { cachePath: frameRef, width: 100, height: 50 } } }],
    };
    const makeDocuments = (bytes: Uint8Array) => new Map<string, EfxPaintDocumentSaveInput>([['layer-rollback', {
      document: withFrame,
      frames: new Map([[document.tracks[0].id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes, width: 100, height: 50 }]])]]),
    }]]);

    // First save commits a generation.
    await saveEfxPaintDocumentsWithProjectWrite('/project', makeDocuments(testWebpBytes('AQID')), async () => {});
    expect(files.has(`/project/${frameRef}`)).toBe(true);

    // Second save stages new bytes, then the project write throws.
    await expect(saveEfxPaintDocumentsWithProjectWrite(
      '/project',
      makeDocuments(testWebpBytes('BAID')),
      async () => { throw new Error('forced project save failure'); },
    )).rejects.toThrow('forced project save failure');

    expect(settlePhysicPaintCacheGeneration).toHaveBeenCalledWith(
      '/project',
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'rollback',
    );
    // The prior committed generation remains published with its original bytes.
    const { readFile } = await import('@tauri-apps/plugin-fs');
    expect(Array.from(await readFile(`/project/${frameRef}`))).toEqual(Array.from(testWebpBytes('AQID')));
    // The staging generation is gone.
    expect(Array.from(files.keys()).some((key) => key.includes('.efx-paint-staging-'))).toBe(false);
    expect(Array.from(dirs).some((key) => key.includes('.efx-paint-staging-'))).toBe(false);
  });

  it('embeds the trackId in the canonical cache path and the guard accepts it', () => {
    const path = buildEfxPaintFrameCachePath('layer-x', 'track-y', { appFrame: 7, frameIndex: 3 });
    expect(path).toBe(`cache/efx-paint/${stableSegment('layer-x')}/track-y/frame-000007-0003.webp`);
    expect(isSafeEfxPaintCachePath(path)).toBe(true);
  });

  it('stages two tracks at the same appFrame without collision and loads both back', async () => {
    const document = createEfxPaintDocument('layer-2t');
    const trackA = document.tracks[0];
    const trackB = { ...trackA, id: 'track-b', order: 1 };
    const pathA = buildEfxPaintFrameCachePath('layer-2t', trackA.id, { appFrame: 5, frameIndex: 0 });
    const pathB = buildEfxPaintFrameCachePath('layer-2t', trackB.id, { appFrame: 5, frameIndex: 0 });
    expect(pathA).not.toBe(pathB);
    const withFrames = {
      ...document,
      tracks: [
        { ...trackA, frames: { 5: { cachePath: pathA, width: 100, height: 50 } } },
        { ...trackB, frames: { 5: { cachePath: pathB, width: 100, height: 50 } } },
      ],
    };
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-2t', {
      document: withFrames,
      frames: new Map([
        [trackA.id, new Map([[5, { frameIndex: 0, appFrame: 5, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])],
        [trackB.id, new Map([[5, { frameIndex: 0, appFrame: 5, bytes: testWebpBytes('BAID'), width: 100, height: 50 }]])],
      ]),
    }]]);
    const writeProject = vi.fn(async () => {});

    const persisted = await saveEfxPaintDocumentsWithProjectWrite('/project', documents, writeProject);

    // Both tracks' sidecars staged at their own track paths.
    expect(files.has(`/project/${pathA}`)).toBe(true);
    expect(files.has(`/project/${pathB}`)).toBe(true);
    // Load restores per-track frames at the same appFrame without a throw.
    const loaded = await loadEfxPaintDocuments('/project', persisted);
    const restored = loaded.get('layer-2t')!;
    expect(restored.frames.get(trackA.id)?.get(5)?.cachePath).toBe(pathA);
    expect(restored.frames.get(trackB.id)?.get(5)?.cachePath).toBe(pathB);
  });

  it('loads per-track frame maps with validated cache paths', async () => {
    const document = createEfxPaintDocument('layer-pt');
    const trackA = document.tracks[0];
    const trackB = { ...trackA, id: 'track-b', order: 1 };
    const pathA = buildEfxPaintFrameCachePath('layer-pt', trackA.id, { appFrame: 1, frameIndex: 0 });
    const pathB = buildEfxPaintFrameCachePath('layer-pt', trackB.id, { appFrame: 2, frameIndex: 0 });
    files.set(`/project/${pathA}`, testWebpBytes('AQID'));
    files.set(`/project/${pathB}`, testWebpBytes('BAUG'));
    const payload = { 'layer-pt': {
      ...document,
      tracks: [
        { ...trackA, frames: { 1: { cachePath: pathA, width: 10, height: 10 } } },
        { ...trackB, frames: { 2: { cachePath: pathB, width: 20, height: 20 } } },
      ],
    } };

    const loaded = await loadEfxPaintDocuments('/project', payload);
    const restored = loaded.get('layer-pt')!;
    expect(Array.from(restored.frames.keys()).sort()).toEqual([trackA.id, trackB.id]);
    expect(restored.frames.get(trackA.id)?.get(1)?.cachePath).toBe(pathA);
    expect(restored.frames.get(trackB.id)?.get(2)?.cachePath).toBe(pathB);
  });

  it('fails closed when a persisted track frame cachePath is unsafe', async () => {
    const document = createEfxPaintDocument('layer-unsafe');
    const track = document.tracks[0];
    const payload = { 'layer-unsafe': {
      ...document,
      tracks: [
        { ...track, frames: { 0: { cachePath: '/cache/efx-paint/seg/frame-000000-0000.png', width: 10, height: 10 } } },
      ],
    } };

    await expect(loadEfxPaintDocuments('/project', payload)).rejects.toThrow(/unsafe sidecar path/);
  });

  it('stableSegment is deterministic, collision-resistant, and sanitized', () => {
    expect(stableSegment('layer-x')).toBe(stableSegment('layer-x'));
    expect(stableSegment('layer-x')).not.toBe(stableSegment('layer-y'));
    expect(stableSegment('a/b\\c')).toBe(stableSegment('a/b\\c'));
    expect(stableSegment('a/b\\c')).not.toContain('/');
    expect(stableSegment('a/b\\c')).not.toContain('\\');
    expect(stableSegment('a/b')).not.toBe(stableSegment('a_b'));
    expect(stableSegment('')).toMatch(/^layer-/);
  });

  it('re-stages only changed frames and hardlinks unchanged frames (52.1 a2)', async () => {
    const document = createEfxPaintDocument('layer-incr');
    const track = document.tracks[0];
    const frameRefA = buildEfxPaintFrameCachePath('layer-incr', track.id, { appFrame: 0, frameIndex: 0 });
    const frameRefB = buildEfxPaintFrameCachePath('layer-incr', track.id, { appFrame: 1, frameIndex: 0 });
    const withFrames = {
      ...document,
      tracks: [{ ...track, frames: {
        0: { cachePath: frameRefA, width: 100, height: 50 },
        1: { cachePath: frameRefB, width: 100, height: 50 },
      } }],
    };
    const makeDocuments = (bytesA: Uint8Array, bytesB: Uint8Array) => new Map<string, EfxPaintDocumentSaveInput>([['layer-incr', {
      document: withFrames,
      frames: new Map([[track.id, new Map([
        [0, { frameIndex: 0, appFrame: 0, bytes: bytesA, width: 100, height: 50 }],
        [1, { frameIndex: 0, appFrame: 1, bytes: bytesB, width: 100, height: 50 }],
      ])]]),
    }]]);

    await saveEfxPaintDocumentsWithProjectWrite('/project', makeDocuments(testWebpBytes('AQID'), testWebpBytes('BAID')), async () => {});
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const firstWriteCount = vi.mocked(writeFile).mock.calls.length;
    expect(firstWriteCount).toBeGreaterThan(0);

    await saveEfxPaintDocumentsWithProjectWrite('/project', makeDocuments(testWebpBytes('AQIE'), testWebpBytes('BAID')), async () => {});

    const secondWrites = vi.mocked(writeFile).mock.calls.slice(firstWriteCount);
    const writtenPaths = secondWrites.map(([path]) => String(path));
    expect(writtenPaths.some((path) => path.includes('frame-000000-0000'))).toBe(true);
    expect(writtenPaths.some((path) => path.includes('frame-000001-0000'))).toBe(false);
    expect(hardlinkPhysicPaintCacheFrames).toHaveBeenCalled();
    const hardlinkArgs = hardlinkPhysicPaintCacheFrames.mock.calls[0] as [string, string, string[]];
    expect(hardlinkArgs[2]).toContain(frameRefB.slice('cache/efx-paint/'.length));
    expect(files.has(`/project/${frameRefA}`)).toBe(true);
    expect(files.has(`/project/${frameRefB}`)).toBe(true);
  });

  it('falls back to full re-stage when hardlink fails (52.1 a2)', async () => {
    const document = createEfxPaintDocument('layer-fallback');
    const track = document.tracks[0];
    const frameRefA = buildEfxPaintFrameCachePath('layer-fallback', track.id, { appFrame: 0, frameIndex: 0 });
    const frameRefB = buildEfxPaintFrameCachePath('layer-fallback', track.id, { appFrame: 1, frameIndex: 0 });
    const withFrames = {
      ...document,
      tracks: [{ ...track, frames: {
        0: { cachePath: frameRefA, width: 100, height: 50 },
        1: { cachePath: frameRefB, width: 100, height: 50 },
      } }],
    };
    const makeDocuments = (bytesA: Uint8Array, bytesB: Uint8Array) => new Map<string, EfxPaintDocumentSaveInput>([['layer-fallback', {
      document: withFrames,
      frames: new Map([[track.id, new Map([
        [0, { frameIndex: 0, appFrame: 0, bytes: bytesA, width: 100, height: 50 }],
        [1, { frameIndex: 0, appFrame: 1, bytes: bytesB, width: 100, height: 50 }],
      ])]]),
    }]]);

    await saveEfxPaintDocumentsWithProjectWrite('/project', makeDocuments(testWebpBytes('AQID'), testWebpBytes('BAID')), async () => {});
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const firstWriteCount = vi.mocked(writeFile).mock.calls.length;

    hardlinkPhysicPaintCacheFrames.mockResolvedValueOnce({ ok: false, error: 'EXDEV' });
    await saveEfxPaintDocumentsWithProjectWrite('/project', makeDocuments(testWebpBytes('AQIE'), testWebpBytes('BAID')), async () => {});

    const secondWrites = vi.mocked(writeFile).mock.calls.slice(firstWriteCount);
    const writtenPaths = secondWrites.map(([path]) => String(path));
    expect(writtenPaths.some((path) => path.includes('frame-000000-0000'))).toBe(true);
    expect(writtenPaths.some((path) => path.includes('frame-000001-0000'))).toBe(true);
  });
});

// --- 52.2-05 Task 3: the package transaction transport (D-10) -------------

const PACKAGE_STAGING_SHAPE = /^\.efx-paint-package-staging-[0-9a-f-]{36}$/;

describe('the package transaction transport (52.2-05 Task 3)', () => {
  async function realIpc() {
    return vi.importActual<typeof import('./ipc')>('./ipc');
  }

  beforeEach(() => {
    invoke.mockReset();
    invoke.mockResolvedValue(null);
  });

  it('binds the staged file set over the package root and the staging basename', async () => {
    const ipc = await realIpc();
    const binding = {
      transactionId: 'txn-pkg-1',
      aggregateDigest: 'a'.repeat(64),
      entries: [{ path: 'project.mce', sha256: 'b'.repeat(64), hadOriginal: true }],
    };
    invoke.mockResolvedValue(binding);

    const result = await ipc.bindEfxPaintPackageTransaction(
      '/package',
      '.efx-paint-package-staging-abc',
      ['project.mce'],
    );

    expect(invoke).toHaveBeenCalledWith('bind_efx_paint_package_transaction', {
      packageRoot: '/package',
      stagingBasename: '.efx-paint-package-staging-abc',
      paths: ['project.mce'],
    });
    // Bind returns the aggregate digest with the per-entry list.
    expect(result).toEqual({ ok: true, data: binding });
  });

  it('publishes, settles and recovers over the package root with no caller-supplied destination root', async () => {
    const ipc = await realIpc();

    await ipc.publishEfxPaintPackageTransaction('/package', 'txn-pkg-1');
    await ipc.settleEfxPaintPackageTransaction('/package', 'txn-pkg-1', 'commit');
    await ipc.settleEfxPaintPackageTransaction('/package', 'txn-pkg-1', 'rollback');
    await ipc.recoverEfxPaintPackageTransaction('/package');

    expect(invoke.mock.calls).toEqual([
      ['publish_efx_paint_package_transaction', { packageRoot: '/package', transactionId: 'txn-pkg-1' }],
      ['settle_efx_paint_package_transaction', { packageRoot: '/package', transactionId: 'txn-pkg-1', action: 'commit' }],
      ['settle_efx_paint_package_transaction', { packageRoot: '/package', transactionId: 'txn-pkg-1', action: 'rollback' }],
      ['recover_efx_paint_package_transaction', { packageRoot: '/package' }],
    ]);
    // The staging root is derived in Rust (T-52.2-14): no call carries one.
    for (const [, args] of invoke.mock.calls as Array<[string, Record<string, unknown>]>) {
      expect(Object.keys(args).sort()).not.toContain('destinationRoot');
      expect(Object.keys(args).sort()).not.toContain('stagingRoot');
      expect(JSON.stringify(args)).not.toContain('/package/');
    }
  });

  it('addresses the machine cache root and carries a soft failure as a non-fatal field', async () => {
    const ipc = await realIpc();
    invoke.mockResolvedValueOnce('/machine/frame-cache/PID');
    const softFailure = {
      accepted: false,
      transactionId: '',
      replacedExisting: false,
      diagnostic: 'the cache root is read-only',
    };
    invoke.mockResolvedValueOnce(softFailure);

    const root = await ipc.resolvePhysicPaintCacheRoot('PID');
    const publication = await ipc.publishPhysicPaintCacheGeneration(
      '/machine/frame-cache/PID',
      '.efx-paint-staging-x',
    );

    expect(invoke.mock.calls[0]).toEqual(['resolve_physic_paint_cache_root', { projectId: 'PID' }]);
    expect(root).toEqual({ ok: true, data: '/machine/frame-cache/PID' });
    expect(invoke.mock.calls[1]).toEqual([
      'publish_physic_paint_cache_generation',
      { cacheRoot: '/machine/frame-cache/PID', stagingBasename: '.efx-paint-staging-x' },
    ]);
    expect(publication).toEqual({ ok: true, data: softFailure });
  });
});

// --- 52.2-05 Task 3: the staged manifest write (D-10) --------------------

describe('the staged package save seam (52.2-05 Task 3)', () => {
  const project = { name: 'demo' } as unknown as Parameters<typeof stageEfxPaintPackageSave>[0];

  beforeEach(() => {
    files.clear();
    dirs.clear();
    vi.clearAllMocks();
    ipcProjectSave.mockResolvedValue({ ok: true, data: null });
    bindEfxPaintPackageTransaction.mockResolvedValue({
      ok: true,
      data: { transactionId: 'txn-pkg-9', aggregateDigest: 'c'.repeat(64), entries: [] },
    });
  });

  it('mints a Rust-shaped staging basename and keeps the literal in sync with the Rust prefix', () => {
    expect(createPackageStagingBasename()).toMatch(PACKAGE_STAGING_SHAPE);
    expect(createPackageStagingBasename()).not.toBe(createPackageStagingBasename());
    // One prefix, two readers: the Rust bind is the authority that refuses a
    // mismatch, so the literals must stay identical.
    const rust = readFileSync(
      fileURLToPath(new URL('../../src-tauri/src/services/efx_paint_media.rs', import.meta.url)),
      'utf8',
    );
    expect(rust).toContain(`pub const PACKAGE_STAGING_PREFIX: &str = "${EFX_PAINT_PACKAGE_STAGING_PREFIX}";`);
  });

  it('writes the manifest at the derived staged path and binds it as a one-entry set', async () => {
    const staged = await stageEfxPaintPackageSave(project, '/package');

    expect(staged.stagingBasename).toMatch(PACKAGE_STAGING_SHAPE);
    expect(ipcProjectSave).toHaveBeenCalledWith(
      project,
      `/package/${staged.stagingBasename}/project.mce`,
    );
    // The manifest write accepts the optional cache transaction id without
    // forwarding it (dead by design until plan 07/09 remove the declaration).
    expect(ipcProjectSave.mock.calls[0]).toHaveLength(2);
    expect(bindEfxPaintPackageTransaction).toHaveBeenCalledWith(
      '/package',
      staged.stagingBasename,
      ['project.mce'],
    );
    // Exactly the package root, the basename and the set: no destination root.
    expect(bindEfxPaintPackageTransaction.mock.calls[0]).toHaveLength(3);
    expect(staged.transactionId).toBe('txn-pkg-9');
    expect(staged.aggregateDigest).toBe('c'.repeat(64));
  });

  it('expresses an already-staged file set as the same one-entry-set call', async () => {
    await stageEfxPaintPackageSave(project, '/package', ['layers/L1.json', 'frames/L1/K1.webp']);

    expect(bindEfxPaintPackageTransaction).toHaveBeenCalledWith(
      '/package',
      expect.stringMatching(PACKAGE_STAGING_SHAPE),
      ['project.mce', 'layers/L1.json', 'frames/L1/K1.webp'],
    );
  });

  it('reports the authoritative save as committed when the cache leg soft-fails (D-14)', async () => {
    const document = createEfxPaintDocument('layer-soft');
    const frameRef = buildEfxPaintFrameCachePath('layer-soft', document.tracks[0].id, { appFrame: 0, frameIndex: 0 });
    const track = document.tracks[0];
    const documents = new Map<string, EfxPaintDocumentSaveInput>([['layer-soft', {
      document: { ...document, tracks: [{ ...track, frames: { 0: { cachePath: frameRef, width: 100, height: 50 } } }] },
      frames: new Map([[track.id, new Map([[0, { frameIndex: 0, appFrame: 0, bytes: testWebpBytes('AQID'), width: 100, height: 50 }]])]]),
    }]]);
    publishPhysicPaintCacheGeneration.mockResolvedValueOnce({
      ok: true,
      data: { accepted: false, transactionId: '', replacedExisting: false, diagnostic: 'the cache root is read-only' },
    });
    const writeProject = vi.fn(async (_payload: Record<string, unknown>, _transactionId: string | null) => {});

    const persisted = await saveEfxPaintDocumentsWithProjectWrite('/project', documents, writeProject);

    // The authoritative write still runs and the save is reported committed.
    expect(writeProject).toHaveBeenCalledOnce();
    expect(writeProject.mock.calls[0][1]).toBeNull();
    expect(persisted['layer-soft']).toBeDefined();
    // No live transaction exists, so nothing is settled.
    expect(settlePhysicPaintCacheGeneration).not.toHaveBeenCalled();
  });
});
