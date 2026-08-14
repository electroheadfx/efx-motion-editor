import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimePhysicPaintOutput } from '../types/project';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { loadPhysicPaintData, savePhysicPaintDataWithProjectWrite } from './physicPaintPersistence';

const publishPhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const settlePhysicPaintCacheGeneration = vi.hoisted(() => vi.fn());
const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

function exchangeGeneration(projectDir: string, stagingBasename: string): void {
  const stagingRoot = `${projectDir}/cache/${stagingBasename}`;
  const canonicalRoot = `${projectDir}/cache/physic-paint`;
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
}));

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

function savePhysicPaintData(
  projectDir: string,
  outputs: RuntimePhysicPaintOutput[] | undefined,
) {
  return savePhysicPaintDataWithProjectWrite(projectDir, outputs, async () => {});
}

function makeOutput(appFrame = 12): RuntimePhysicPaintOutput[] {
  return [{
    layer_id: 'physic layer/1',
    frames: [{
      frameIndex: 0,
      appFrame,
      dataUrl: 'data:image/png;base64,AQID',
      width: 100,
      height: 50,
    }],
  }];
}

const GROUP_FIELD_PARTICIPATION = [
  { field: 'syncState', value: 'modified' },
  { field: 'provenanceState', value: 'detached' },
  { field: 'phaseOrigin', value: 3 },
  { field: 'originalEndExclusive', value: 30 },
  { field: 'visibleRanges', value: [{ start: 0, endExclusive: 7 }, { start: 8, endExclusive: 25 }] },
  { field: 'frameOverrides', value: [{ appFrame: 7, keyId: 'override-8' }] },
] as const;

const lifecycleRecords = () => [
  { keyId: 'key-0', appFrame: 0 },
  { keyId: 'key-3', appFrame: 3 },
].map(({ keyId, appFrame }) => ({
  keyId,
  appFrame,
  kind: 'real-key' as const,
  payload: {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`real-${keyId}`)}`,
    width: 100,
    height: 50,
  },
}));

const completeLifecycleGroup = () => ({
  loopId: 'loop-1',
  placementStart: 0,
  sourceKeyIds: ['key-0', 'key-3'],
  repeat: 2,
  mode: 'progressive' as const,
  syncState: 'modified' as const,
  provenanceState: 'detached' as const,
  phaseOrigin: 0,
  originalEndExclusive: 25,
  visibleRanges: [{ start: 0, endExclusive: 7 }, { start: 8, endExclusive: 25 }],
  frameOverrides: [{ appFrame: 8, keyId: 'override-8' }],
});

function makeLifecyclePhysicalOutput(loopClip: unknown = completeLifecycleGroup()): RuntimePhysicPaintOutput[] {
  const records = lifecycleRecords();
  const groupOverrideRecords = [{ keyId: 'override-8', appFrame: 8 }].map(({ keyId, appFrame }) => ({
    keyId,
    appFrame,
    kind: 'real-key' as const,
    payload: {
      frameIndex: 0,
      appFrame,
      dataUrl: `data:image/png;base64,${btoa(`real-${keyId}`)}`,
      width: 100,
      height: 50,
    },
  }));
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const loopClips = [loopClip];
  return [{
    layer_id: 'physic layer/1',
    frames: [],
    roto_physical: {
      capacity: 600,
      realKeyRecords: records,
      groupOverrideRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: (() => {
        try {
          return buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, [], groupOverrideRecords);
        } catch {
          return 'invalid-group-revision';
        }
      })(),
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    } as never,
  }];
}

describe('physicPaintPersistence', () => {
  it('scopes the main window to project-local data only, never the whole filesystem', () => {
    const capability = JSON.parse(readFileSync(
      fileURLToPath(new URL('../../src-tauri/capabilities/default.json', import.meta.url)),
      'utf8',
    ));
    const scope = capability.permissions.find((permission: unknown) => (
      typeof permission === 'object'
      && permission !== null
      && (permission as { identifier?: unknown }).identifier === 'fs:scope'
    ));
    const paths = scope.allow.map((entry: { path: string }) => entry.path);

    expect(paths).not.toContain('**');
    expect(paths).not.toContain('$HOME/**');
    expect(paths).not.toContain('$DESKTOP/**');
    expect(paths).not.toContain('$DOCUMENT/**');
    expect(paths).not.toContain('$DOWNLOAD/**');
    for (const required of [
      '**/cache',
      '**/cache/physic-paint',
      '**/cache/physic-paint/**',
      '**/cache/.physic-paint-staging-*',
      '**/cache/.physic-paint-staging-*/**',
      '**/paint',
      '**/paint/**',
      '**/audio',
      '**/audio/**',
      '**/videos',
      '**/videos/**',
      '**/images/**',
    ]) {
      expect(paths).toContain(required);
    }
    // Dialog-picked paths (state JSON, import sources, .mce targets) are
    // runtime-granted by the dialog plugin, never capability-granted.
    expect(capability.permissions).toContain('dialog:allow-open');
    expect(capability.permissions).toContain('dialog:allow-save');
    // The standalone Physics Paint window keeps zero filesystem access.
    const paintCapability = JSON.parse(readFileSync(
      fileURLToPath(new URL('../../src-tauri/capabilities/physics-paint.json', import.meta.url)),
      'utf8',
    ));
    expect(JSON.stringify(paintCapability.permissions)).not.toContain('fs:');
  });

  beforeEach(async () => {
    files.clear();
    dirs.clear();
    vi.clearAllMocks();
    const { exists } = await import('@tauri-apps/plugin-fs');
    vi.mocked(exists).mockImplementation(async (path) => dirs.has(String(path)) || files.has(String(path)));
    const activeTransactions = new Map<string, string>();
    publishPhysicPaintCacheGeneration.mockImplementation(async (projectDir: string, stagingBasename: string) => {
      const replacedExisting = dirs.has(`${projectDir}/cache/physic-paint`);
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
  });

  it('restores the previous canonical cache when the project file write rejects', async () => {
    const oldPath = '/project/cache/physic-paint/existing/frame.png';
    const oldBytes = new Uint8Array([9, 8, 7]);
    dirs.add('/project/cache/physic-paint');
    dirs.add('/project/cache/physic-paint/existing');
    files.set(oldPath, oldBytes);

    await expect(savePhysicPaintDataWithProjectWrite('/project', makeOutput(90), async () => {
      throw new Error('forced project save failure');
    })).rejects.toThrow('forced project save failure');

    expect(files.get(oldPath)).toEqual(oldBytes);
    expect(settlePhysicPaintCacheGeneration).toHaveBeenCalledWith(
      '/project',
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'rollback',
    );

    await savePhysicPaintData('/project', makeOutput(90));
    expect(publishPhysicPaintCacheGeneration).toHaveBeenCalledTimes(2);
  });

  it('removes an uncommitted first cache generation when the project file write rejects', async () => {
    await expect(savePhysicPaintDataWithProjectWrite('/project', makeOutput(89), async () => {
      throw new Error('forced first project save failure');
    })).rejects.toThrow('forced first project save failure');

    expect(dirs.has('/project/cache/physic-paint')).toBe(false);
    expect(Array.from(files.keys()).some((path) => path.startsWith('/project/cache/physic-paint/'))).toBe(false);
    expect(settlePhysicPaintCacheGeneration).toHaveBeenCalledWith(
      '/project',
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      'rollback',
    );
  });

  it('keeps the previous canonical cache when a staged sidecar write fails', async () => {
    const oldPath = '/project/cache/physic-paint/existing/frame.png';
    const oldBytes = new Uint8Array([9, 8, 7]);
    dirs.add('/project/cache/physic-paint');
    dirs.add('/project/cache/physic-paint/existing');
    files.set(oldPath, oldBytes);
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    vi.mocked(writeFile).mockRejectedValueOnce(new Error('forced staged write failure'));

    await expect(savePhysicPaintData('/project', makeOutput(91))).rejects.toThrow('forced staged write failure');

    expect(publishPhysicPaintCacheGeneration).not.toHaveBeenCalled();
    expect(files.get(oldPath)).toEqual(oldBytes);
  });

  it('never probes generated staging paths through allow-exists', async () => {
    const { exists } = await import('@tauri-apps/plugin-fs');
    vi.mocked(exists).mockImplementation(async (path) => {
      if (String(path).includes('/cache/.physic-paint-staging-')) {
        throw new Error(`forbidden path: ${path}, maybe it is not allowed on the scope for allow-exists permission in your capability file`);
      }
      return dirs.has(String(path)) || files.has(String(path));
    });

    const persisted = await savePhysicPaintData('/project', makeOutput(95));

    expect(persisted[0].frames[0].cache_path).toMatch(/^cache\/physic-paint\//);
    expect(publishPhysicPaintCacheGeneration).toHaveBeenCalledOnce();
    expect(vi.mocked(exists).mock.calls.every(([path]) => !String(path).includes('/cache/.physic-paint-staging-'))).toBe(true);
  });

  it('stores rendered frames in the project cache and serializes only cache paths', async () => {
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const persisted = await savePhysicPaintData('/project', makeOutput());

    expect(persisted[0].frames).toEqual([{
      frameIndex: 0,
      appFrame: 12,
      cache_path: expect.stringMatching(/^cache\/physic-paint\/physic_layer_1-[0-9a-f]{8}\/frame-000012-0000\.png$/),
      width: 100,
      height: 50,
    }]);
    expect(JSON.stringify(persisted)).not.toContain('data:image/png');
    expect(JSON.stringify(persisted)).not.toContain('.physic-paint-staging-');
    expect(Array.from(files.keys()).some(path => /^\/project\/cache\/physic-paint\/physic_layer_1-[0-9a-f]{8}\/frame-000012-0000\.png$/.test(path))).toBe(true);
    expect(publishPhysicPaintCacheGeneration).toHaveBeenCalledTimes(1);
    const [projectDir, stagingBasename] = publishPhysicPaintCacheGeneration.mock.calls[0];
    expect(projectDir).toBe('/project');
    expect(stagingBasename).toMatch(/^\.physic-paint-staging-[a-zA-Z0-9_-]+$/);
    expect(vi.mocked(writeFile).mock.calls.every(([path]) => String(path).startsWith(`/project/cache/${stagingBasename}/`))).toBe(true);
    expect(Math.max(...vi.mocked(writeFile).mock.invocationCallOrder)).toBeLessThan(
      publishPhysicPaintCacheGeneration.mock.invocationCallOrder[0],
    );
  });

  it('rejects a native publication error without replacing canonical authority or caching the failed output', async () => {
    const oldPath = '/project/cache/physic-paint/existing/frame.png';
    files.set(oldPath, new Uint8Array([4, 5, 6]));
    dirs.add('/project/cache/physic-paint');
    dirs.add('/project/cache/physic-paint/existing');
    publishPhysicPaintCacheGeneration.mockResolvedValueOnce({
      ok: false,
      error: 'forced exchange failure',
    });

    await expect(savePhysicPaintData('/project', makeOutput(92))).rejects.toThrow('forced exchange failure');

    expect(files.get(oldPath)).toEqual(new Uint8Array([4, 5, 6]));
    expect(Array.from(files.keys()).some((path) => path.includes('.physic-paint-staging-'))).toBe(false);

    await savePhysicPaintData('/project', makeOutput(92));
    expect(publishPhysicPaintCacheGeneration).toHaveBeenCalledTimes(2);
  });

  it('keeps a successful project/cache pair accepted when commit cleanup acknowledgement fails', async () => {
    settlePhysicPaintCacheGeneration.mockResolvedValueOnce({
      ok: false,
      error: 'forced cleanup acknowledgement failure',
    });

    const writeProject = vi.fn(async () => {});
    const persisted = await savePhysicPaintDataWithProjectWrite('/project', makeOutput(88), writeProject);

    expect(writeProject).toHaveBeenCalledOnce();
    expect(persisted[0].frames[0].cache_path).toMatch(/^cache\/physic-paint\//);
    expect(Array.from(files.keys()).some((path) => path.startsWith('/project/cache/physic-paint/'))).toBe(true);

    await savePhysicPaintData('/project', makeOutput(88));
    expect(publishPhysicPaintCacheGeneration).toHaveBeenCalledOnce();
  });

  it('accepts deferred cleanup after project commit and retains canonical metadata', async () => {
    settlePhysicPaintCacheGeneration.mockResolvedValueOnce({
      ok: true,
      data: {
        accepted: true,
        cleanupStatus: 'deferred',
        cleanupDiagnostic: 'forced cleanup deferral',
      },
    });

    const persisted = await savePhysicPaintData('/project', makeOutput(93));

    expect(persisted[0].frames[0].cache_path).toMatch(/^cache\/physic-paint\//);
    expect(JSON.stringify(persisted)).not.toContain('.physic-paint-staging-');
    expect(Array.from(files.keys()).some((path) => path.includes('/cache/physic-paint/'))).toBe(true);
  });

  it('does not let renderer cleanup delete a native-owned rollback generation', async () => {
    const rollbackGeneration = '/project/cache/.physic-paint-staging-active';
    dirs.add('/project/cache');
    dirs.add(rollbackGeneration);
    files.set(`${rollbackGeneration}/old.png`, new Uint8Array([1]));

    await savePhysicPaintData('/project', makeOutput(94));

    expect(dirs.has(rollbackGeneration)).toBe(true);
    expect(files.has(`${rollbackGeneration}/old.png`)).toBe(true);
  });

  it('removes the project Physics Paint cache when no outputs remain', async () => {
    await savePhysicPaintData('/project', makeOutput(13));
    expect(dirs.has('/project/cache/physic-paint')).toBe(true);
    expect(Array.from(files.keys()).some(path => path.startsWith('/project/cache/physic-paint/physic_layer_1-'))).toBe(true);

    const persisted = await savePhysicPaintData('/project', []);

    expect(persisted).toEqual([]);
    expect(dirs.has('/project/cache/physic-paint')).toBe(false);
    expect(Array.from(files.keys()).some(path => path.startsWith('/project/cache/physic-paint/'))).toBe(false);
  });

  it('hydrates cached frames back to runtime data URLs', async () => {
    const persisted = await savePhysicPaintData('/project', makeOutput(14));

    const hydrated = await loadPhysicPaintData('/project', persisted);

    expect(hydrated?.[0].frames[0]).toMatchObject({
      appFrame: 14,
      frameIndex: 0,
      dataUrl: 'data:image/png;base64,AQID',
    });
  });

  it('hydrates persisted real Roto keys and settings from the canonical physical document', async () => {
    const { buildPhysicPaintRotoPhysicalRevision } = await import('../components/physic-paint/roto/physicsPaintRotoPhysicalModel');
    const records = [0, 4, 8].map((appFrame) => ({
      keyId: `key-${appFrame}`,
      appFrame,
      kind: 'real-key' as const,
      payload: { frameIndex: 0, appFrame, dataUrl: `data:image/png;base64,${btoa(`real-${appFrame}`)}`, width: 100, height: 50 },
    }));
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const runtime = [{
      layer_id: 'physic layer/1',
      frames: [],
      roto_physical: {
        capacity: 600,
        realKeyRecords: records,
        interpolation,
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        selectedKeyId: null,
        cursorAppFrame: 0,
        revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
        loopClips: [],
        incomingInterpolationBreakKeyIds: [],
      },
    }];

    const persisted = await savePhysicPaintData('/project', runtime);

    // Only sidecar cache paths are serialized for physical payloads; no data URLs and no generated metadata.
    expect(JSON.stringify(persisted)).not.toContain('data:image/png');
    expect(JSON.stringify(persisted)).not.toContain('generated-interpolation');
    expect(persisted[0].roto_physical?.realKeyRecords.map((record) => record.appFrame)).toEqual([0, 4, 8]);

    const hydrated = await loadPhysicPaintData('/project', persisted);

    expect(hydrated?.[0].roto_physical?.interpolation).toEqual({ enabled: true, mode: 'duplicate' });
    expect(hydrated?.[0].roto_physical?.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame, dataUrl: record.payload.dataUrl }))).toEqual([
      { keyId: 'key-0', appFrame: 0, dataUrl: `data:image/png;base64,${btoa('real-0')}` },
      { keyId: 'key-4', appFrame: 4, dataUrl: `data:image/png;base64,${btoa('real-4')}` },
      { keyId: 'key-8', appFrame: 8, dataUrl: `data:image/png;base64,${btoa('real-8')}` },
    ]);
  });

  it('loads a literal pre-43.2 finite Group through the persistence seam', async () => {
    files.set(
      '/project/cache/physic-paint/legacy/key-000000-key-0.png',
      new Uint8Array([1, 2, 3]),
    );

    const hydrated = await loadPhysicPaintData('/project', [{
      layer_id: 'legacy-layer',
      frames: [],
      roto_physical: {
        capacity: 16,
        realKeyRecords: [{
          kind: 'real-key',
          keyId: 'key-0',
          appFrame: 0,
          payload: {
            frameIndex: 0,
            appFrame: 0,
            cache_path: 'cache/physic-paint/legacy/key-000000-key-0.png',
            width: 100,
            height: 50,
          },
        }],
        interpolation: { enabled: false, mode: 'duplicate' },
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        selectedKeyId: null,
        cursorAppFrame: 0,
        revision: 'physical-163-beed993b',
        loopClips: [{
          loopId: 'loop-legacy',
          placementStart: 0,
          sourceKeyIds: ['key-0'],
          repeat: 2,
          mode: 'progressive',
        }],
        incomingInterpolationBreakKeyIds: [],
      },
    }]);

    expect(hydrated?.[0].roto_physical).toMatchObject({
      revision: 'physical-225-6e46481e',
      loopClips: [{
        loopId: 'loop-legacy',
        placementStart: 0,
        sourceKeyIds: ['key-0'],
        repeat: 2,
        mode: 'progressive',
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 0,
        originalEndExclusive: 2,
        visibleRanges: [{ start: 0, endExclusive: 2 }],
        frameOverrides: [],
      }],
    });
  });

  it('rejects changed legacy Group content that retains the historical revision', async () => {
    files.set(
      '/project/cache/physic-paint/legacy/key-000000-key-0.png',
      new Uint8Array([1, 2, 3]),
    );

    await expect(loadPhysicPaintData('/project', [{
      layer_id: 'legacy-layer',
      frames: [],
      roto_physical: {
        capacity: 16,
        realKeyRecords: [{
          kind: 'real-key',
          keyId: 'key-0',
          appFrame: 0,
          payload: {
            frameIndex: 0,
            appFrame: 0,
            cache_path: 'cache/physic-paint/legacy/key-000000-key-0.png',
            width: 100,
            height: 50,
          },
        }],
        interpolation: { enabled: false, mode: 'duplicate' },
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        selectedKeyId: null,
        cursorAppFrame: 0,
        revision: 'physical-163-beed993b',
        loopClips: [{
          loopId: 'loop-legacy',
          placementStart: 0,
          sourceKeyIds: ['key-0'],
          repeat: 3,
          mode: 'progressive',
        }],
        incomingInterpolationBreakKeyIds: [],
      },
    }])).rejects.toThrow('PhysicPaintRotoPhysicalDocument: canonical revision mismatch.');
  });

  it('preserves every Group lifecycle field and the override real-key sidecar through save/reopen', async () => {
    const persisted = await savePhysicPaintData('/project', makeLifecyclePhysicalOutput());
    const persistedDocument = persisted[0].roto_physical!;

    expect(persistedDocument.loopClips).toEqual([completeLifecycleGroup()]);
    expect(JSON.stringify(persistedDocument)).not.toContain('data:image/png');
    const overrideRecord = persistedDocument.groupOverrideRecords?.find((record) => record.keyId === 'override-8');
    expect(overrideRecord?.payload.cache_path).toMatch(/override-000008-override-8-[0-9a-f]{8}\.png$/);
    expect(Array.from(files.keys()).some((path) => /override-000008-override-8-[0-9a-f]{8}\.png$/.test(path))).toBe(true);

    const hydrated = await loadPhysicPaintData('/project', persisted);
    expect(hydrated?.[0].roto_physical?.loopClips).toEqual([completeLifecycleGroup()]);
    expect(hydrated?.[0].roto_physical?.groupOverrideRecords?.find((record) => record.keyId === 'override-8')?.payload.dataUrl)
      .toBe(`data:image/png;base64,${btoa('real-override-8')}`);
  });

  it('preserves a layer-local F30 Infinity boundary inside an F600 physical document through save/reopen', async () => {
    const infinityGroup = {
      ...completeLifecycleGroup(),
      repeat: 'infinity' as const,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 0, endExclusive: 7 }, { start: 8, endExclusive: 30 }],
    };

    const persisted = await savePhysicPaintData('/project', makeLifecyclePhysicalOutput(infinityGroup));
    expect(persisted[0].roto_physical).toMatchObject({
      capacity: 600,
      loopClips: [infinityGroup],
    });

    const hydrated = await loadPhysicPaintData('/project', persisted);
    expect(hydrated?.[0].roto_physical).toMatchObject({
      capacity: 600,
      loopClips: [infinityGroup],
    });
  });

  it.each(GROUP_FIELD_PARTICIPATION)('rejects a persisted Group carrying only the $field lifecycle field', async ({ field, value }) => {
    const partialGroup = {
      loopId: 'loop-1', placementStart: 0, sourceKeyIds: ['key-0', 'key-3'], repeat: 2, mode: 'progressive', [field]: value,
    };
    await expect(savePhysicPaintData('/project', makeLifecyclePhysicalOutput(partialGroup))).rejects.toThrow();
  });

  it('rejects unsafe persisted cache paths instead of reading them', async () => {
    files.set('/secret.png', new Uint8Array([1, 2, 3]));
    const { readFile } = await import('@tauri-apps/plugin-fs');

    await expect(loadPhysicPaintData('/project', [{
      layer_id: 'physic layer/1',
      frames: [
        { frameIndex: 0, appFrame: 10, cache_path: '../secret.png', width: 100, height: 50 },
      ],
    }])).rejects.toThrow('Persisted Physics Paint frame in layer "physic layer/1" has invalid placement or path.');
    await expect(loadPhysicPaintData('/project', [{
      layer_id: 'physic layer/1',
      frames: [
        { frameIndex: 0, appFrame: 11, cache_path: '/secret.png', width: 100, height: 50 },
      ],
    }])).rejects.toThrow('Persisted Physics Paint frame in layer "physic layer/1" has invalid placement or path.');
    expect(readFile).not.toHaveBeenCalledWith('/secret.png');
    expect(readFile).not.toHaveBeenCalledWith('/project/../secret.png');
  });

  it('rejects malformed outputs without frames instead of hydrating partial state', async () => {
    const persisted = await savePhysicPaintData('/project', makeOutput(15));
    const malformed = { layer_id: 'broken-layer', workflow_mode: 'play' } as never;

    await expect(loadPhysicPaintData('/project', [malformed, ...persisted])).rejects.toThrow('Persisted Physics Paint output is not a closed physical output.');

    const hydrated = await loadPhysicPaintData('/project', persisted);
    expect(hydrated).toHaveLength(1);
    expect(hydrated?.[0].layer_id).toBe('physic layer/1');
  });

  it('rejects non-PNG runtime frames instead of serializing inline data', async () => {
    const output = makeOutput();
    output[0].frames[0].dataUrl = 'data:text/plain;base64,AQID';

    await expect(savePhysicPaintData('/project', output)).rejects.toThrow('Invalid Physics Paint frame in layer "physic layer/1".');
  });
});
