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

function makeOutput(): RuntimePhysicPaintOutput[] {
  return [{
    layer_id: 'physic layer/1',
    frames: [{
      frameIndex: 0,
      appFrame: 12,
      dataUrl: 'data:image/png;base64,AQID',
      width: 100,
      height: 50,
    }],
    workflow_mode: 'roto',
    editable_source: 'roto',
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
      cache_path: 'cache/physic-paint/physic_layer_1/frame-000012-0000.png',
      width: 100,
      height: 50,
    }]);
    expect(JSON.stringify(persisted)).not.toContain('data:image/png');
    expect(files.has('/project/cache/physic-paint/physic_layer_1/frame-000012-0000.png')).toBe(true);
  });

  it('hydrates cached frames back to runtime data URLs', async () => {
    const persisted = await savePhysicPaintData('/project', makeOutput());

    const hydrated = await loadPhysicPaintData('/project', persisted);

    expect(hydrated?.[0].frames[0]).toMatchObject({
      appFrame: 12,
      frameIndex: 0,
      dataUrl: 'data:image/png;base64,AQID',
    });
  });

  it('stores transparent Roto onion frames as project cache files', async () => {
    const output = makeOutput();
    output[0].roto_cache_metadata = [{
      ...output[0].frames[0],
      source: 'real-key',
      onionDataUrl: 'data:image/png;base64,BAUG',
    }];

    const persisted = await savePhysicPaintData('/project', output);

    expect(persisted[0].roto_cache_metadata?.[0]).toMatchObject({
      appFrame: 12,
      source: 'real-key',
      cache_path: 'cache/physic-paint/physic_layer_1/frame-000012-0000.png',
      onion_cache_path: 'cache/physic-paint/physic_layer_1/onion-000012-0000.png',
    });
    expect(JSON.stringify(persisted)).not.toContain('data:image/png');
    expect(files.has('/project/cache/physic-paint/physic_layer_1/onion-000012-0000.png')).toBe(true);

    const hydrated = await loadPhysicPaintData('/project', persisted);
    expect(hydrated?.[0].roto_cache_metadata?.[0].onionDataUrl).toBe('data:image/png;base64,BAUG');
  });

  it('hydrates persisted real Roto keys and settings while ignoring generated metadata without cache files', async () => {
    files.set('/project/cache/physic-paint/physic_layer_1/frame-000000-0000.png', new Uint8Array([1, 2, 3]));
    files.set('/project/cache/physic-paint/physic_layer_1/frame-000001-0000.png', new Uint8Array([4, 5, 6]));
    files.set('/project/cache/physic-paint/physic_layer_1/frame-000002-0000.png', new Uint8Array([7, 8, 9]));

    const hydrated = await loadPhysicPaintData('/project', [{
      layer_id: 'physic layer/1',
      frames: [
        { frameIndex: 0, appFrame: 0, cache_path: 'cache/physic-paint/physic_layer_1/frame-000000-0000.png', width: 100, height: 50 },
        { frameIndex: 0, appFrame: 1, cache_path: 'cache/physic-paint/physic_layer_1/frame-000001-0000.png', width: 100, height: 50 },
        { frameIndex: 0, appFrame: 2, cache_path: 'cache/physic-paint/physic_layer_1/frame-000002-0000.png', width: 100, height: 50 },
      ],
      workflow_mode: 'roto',
      editable_source: 'roto',
      roto_cache_metadata: [
        { frameIndex: 0, appFrame: 0, source: 'real-key' },
        { frameIndex: 0, appFrame: 4, source: 'real-key', sourceFrame: 1 },
        { frameIndex: 0, appFrame: 8, source: 'real-key', sourceFrame: 2 },
        { frameIndex: 0, appFrame: 11, source: 'generated-interpolation', fromSourceFrame: 2 },
      ],
      roto_interpolation_settings: { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 },
    }]);

    expect(hydrated?.[0].roto_interpolation_settings).toEqual({ enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 });
    expect(hydrated?.[0].roto_cache_metadata?.map((frame) => ({ appFrame: frame.appFrame, sourceFrame: frame.sourceFrame, source: frame.source }))).toEqual([
      { appFrame: 0, sourceFrame: undefined, source: 'real-key' },
      { appFrame: 4, sourceFrame: 1, source: 'real-key' },
      { appFrame: 8, sourceFrame: 2, source: 'real-key' },
    ]);
  });

  it('skips unsafe persisted cache paths while loading project data', async () => {
    files.set('/secret.png', new Uint8Array([1, 2, 3]));
    files.set('/project/cache/physic-paint/physic_layer_1/frame-000012-0000.png', new Uint8Array([4, 5, 6]));

    const hydrated = await loadPhysicPaintData('/project', [{
      layer_id: 'physic layer/1',
      frames: [
        { frameIndex: 0, appFrame: 10, cache_path: '../secret.png', width: 100, height: 50 },
        { frameIndex: 0, appFrame: 11, cache_path: '/secret.png', width: 100, height: 50 },
        { frameIndex: 0, appFrame: 12, cache_path: 'cache/physic-paint/physic_layer_1/frame-000012-0000.png', width: 100, height: 50 },
      ],
      roto_cache_metadata: [
        { frameIndex: 0, appFrame: 10, cache_path: '../secret.png', width: 100, height: 50, source: 'real-key' },
        { frameIndex: 0, appFrame: 12, cache_path: 'cache/physic-paint/physic_layer_1/frame-000012-0000.png', width: 100, height: 50, source: 'real-key' },
      ],
      workflow_mode: 'roto',
      editable_source: 'roto',
    }]);

    expect(hydrated?.[0].frames.map((frame) => frame.appFrame)).toEqual([12]);
    expect(hydrated?.[0].roto_cache_metadata?.map((frame) => frame.appFrame)).toEqual([12]);
    expect(hydrated?.[0].frames[0].dataUrl).toBe('data:image/png;base64,BAUG');
  });

  it('skips malformed outputs without frames while loading old project data', async () => {
    const persisted = await savePhysicPaintData('/project', makeOutput());
    const malformed = { layer_id: 'broken-layer', workflow_mode: 'play' } as never;

    const hydrated = await loadPhysicPaintData('/project', [malformed, ...persisted]);

    expect(hydrated).toHaveLength(1);
    expect(hydrated?.[0].layer_id).toBe('physic layer/1');
  });

  it('rejects non-PNG runtime frames instead of serializing inline data', async () => {
    const output = makeOutput();
    output[0].frames[0].dataUrl = 'data:text/plain;base64,AQID';

    await expect(savePhysicPaintData('/project', output)).rejects.toThrow('not a PNG data URL');
  });
});
