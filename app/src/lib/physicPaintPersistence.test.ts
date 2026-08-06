import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RuntimePhysicPaintOutput } from '../types/project';
import { loadPhysicPaintData, savePhysicPaintData } from './physicPaintPersistence';

const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async (path: string) => dirs.has(path) || files.has(path)),
  mkdir: vi.fn(async (path: string) => { dirs.add(path); }),
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

describe('physicPaintPersistence', () => {
  beforeEach(() => {
    files.clear();
    dirs.clear();
  });

  it('stores rendered frames in the project cache and serializes only cache paths', async () => {
    const persisted = await savePhysicPaintData('/project', makeOutput());

    expect(persisted[0].frames).toEqual([{
      frameIndex: 0,
      appFrame: 12,
      cache_path: expect.stringMatching(/^cache\/physic-paint\/physic_layer_1-[0-9a-f]{8}\/frame-000012-0000\.png$/),
      width: 100,
      height: 50,
    }]);
    expect(JSON.stringify(persisted)).not.toContain('data:image/png');
    expect(Array.from(files.keys()).some(path => /^\/project\/cache\/physic-paint\/physic_layer_1-[0-9a-f]{8}\/frame-000012-0000\.png$/.test(path))).toBe(true);
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
        revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation),
        loopClips: [],
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
