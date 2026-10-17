/**
 * 261017-mz9 Task 1 pins: bundler worker form, in-flight dedup, capture writer.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PAPER_SHEET_CAPTURE_PATH,
  proceduralSheetRequestKey,
  requestProceduralSheet,
  resetPaperSheetClientForTests,
} from './paperSheetClient';

const root = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

type FakeWorkerListener = (event: { data: unknown }) => void;

const workerRuntime = vi.hoisted(() => ({
  posts: [] as unknown[],
  messageListeners: [] as FakeWorkerListener[],
  errorListeners: [] as Array<(event: unknown) => void>,
  reset() {
    this.posts = [];
    this.messageListeners = [];
    this.errorListeners = [];
  },
}));

class FakeWorker {
  addEventListener(type: string, listener: FakeWorkerListener) {
    if (type === 'message') workerRuntime.messageListeners.push(listener);
    if (type === 'error') workerRuntime.errorListeners.push(listener as (event: unknown) => void);
  }
  postMessage(message: unknown) {
    workerRuntime.posts.push(message);
  }
  terminate() {}
}

const ipcRuntime = vi.hoisted(() => ({
  writes: [] as Array<{ dirPath: string; filename: string; data: number[] }>,
  reset() {
    this.writes = [];
  },
}));

vi.mock('./ipc', () => ({
  exportWritePng: async (dirPath: string, filename: string, data: number[]) => {
    ipcRuntime.writes.push({ dirPath, filename, data });
    return { ok: true };
  },
}));

function respond(response: unknown): void {
  for (const listener of [...workerRuntime.messageListeners]) listener({ data: response });
}

async function flushCapture(): Promise<void> {
  await vi.waitFor(() => {
    expect(ipcRuntime.writes.length).toBeGreaterThanOrEqual(1);
  });
}

const REQUEST = {
  paperTexture: 'paper/cold-press',
  width: 1920,
  height: 1080,
  grainScale: 1,
};

beforeEach(() => {
  workerRuntime.reset();
  ipcRuntime.reset();
  resetPaperSheetClientForTests();
  Object.assign(globalThis, { Worker: FakeWorker });
});

afterEach(() => {
  resetPaperSheetClientForTests();
});

describe('261017-mz9 paperSheetClient', () => {
  it('source-scan: the worker entry is referenced via the bundler worker form', () => {
    const src = source('src/lib/paperSheetClient.ts');
    expect(src).toContain("new Worker(new URL('./paperSheet.worker.ts', import.meta.url), { type: 'module' })");
  });

  it('source-scan: one capture writer exists and names /tmp/efx-paper-sheet-capture.json', () => {
    const src = source('src/lib/paperSheetClient.ts');
    expect(src).toContain("'/tmp/efx-paper-sheet-capture.json'");
    expect(src).toContain(PAPER_SHEET_CAPTURE_PATH);
    expect(PAPER_SHEET_CAPTURE_PATH).toBe('/tmp/efx-paper-sheet-capture.json');
  });

  it('request key matches the fond cache string shape', () => {
    expect(proceduralSheetRequestKey(REQUEST)).toBe('paper/cold-press|1|1920x1080|1');
    expect(proceduralSheetRequestKey({ ...REQUEST, grainScale: 2 })).toBe('paper/cold-press|1|1920x1080|2');
    expect(proceduralSheetRequestKey({ ...REQUEST, grainScale: Number.NaN })).toBe('paper/cold-press|1|1920x1080|1');
  });

  it('dedup: two concurrent requests with the same key share one worker post', async () => {
    const first = requestProceduralSheet(REQUEST);
    const second = requestProceduralSheet(REQUEST);
    expect(workerRuntime.posts).toHaveLength(1);
    expect(workerRuntime.posts[0]).toMatchObject({
      requestKey: 'paper/cold-press|1|1920x1080|1',
      paperTexture: 'paper/cold-press',
      width: 1920,
      height: 1080,
      grainScale: 1,
    });

    const pixels = new Uint8ClampedArray(4);
    pixels.set([10, 20, 30, 255]);
    respond({
      requestKey: 'paper/cold-press|1|1920x1080|1',
      path: 'worker-gpu',
      fieldWidth: 1024,
      fieldHeight: 576,
      durationMs: 12,
      pixels: pixels.buffer,
    });

    const [a, b] = await Promise.all([first, second]);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
    expect(a!.path).toBe('worker-gpu');
    expect(a!.fieldWidth).toBe(1024);
    expect(a!.fieldHeight).toBe(576);
  });

  it('writes one capture row per settled generation (path, requested WxH, field WxH, duration)', async () => {
    const promise = requestProceduralSheet(REQUEST);
    const pixels = new Uint8ClampedArray(8);
    respond({
      requestKey: 'paper/cold-press|1|1920x1080|1',
      path: 'worker-cpu',
      fieldWidth: 1024,
      fieldHeight: 576,
      durationMs: 34,
      pixels: pixels.buffer,
    });
    await promise;
    await flushCapture();

    const last = ipcRuntime.writes[ipcRuntime.writes.length - 1];
    expect(last.dirPath).toBe('/tmp');
    expect(last.filename).toBe('efx-paper-sheet-capture.json');
    const rows = JSON.parse(String.fromCharCode(...last.data)) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      path: 'worker-cpu',
      requestedWidth: 1920,
      requestedHeight: 1080,
      fieldWidth: 1024,
      fieldHeight: 576,
      durationMs: 34,
    });
  });

  it('a repeat of the same key is a cache hit logged once, with no second worker post', async () => {
    const first = requestProceduralSheet(REQUEST);
    const pixels = new Uint8ClampedArray(8);
    respond({
      requestKey: 'paper/cold-press|1|1920x1080|1',
      path: 'worker-gpu',
      fieldWidth: 1024,
      fieldHeight: 576,
      durationMs: 8,
      pixels: pixels.buffer,
    });
    await first;

    const second = await requestProceduralSheet(REQUEST);
    const third = await requestProceduralSheet(REQUEST);
    expect(second).not.toBeNull();
    expect(third).toBe(second);
    expect(workerRuntime.posts).toHaveLength(1);

    await vi.waitFor(() => {
      const last = ipcRuntime.writes[ipcRuntime.writes.length - 1];
      const rows = JSON.parse(String.fromCharCode(...last.data)) as Array<{ path: string }>;
      expect(rows.map((row) => row.path)).toEqual(['worker-gpu', 'cache-hit']);
    });
  });

  it('a worker failure resolves null and never rejects', async () => {
    const promise = requestProceduralSheet(REQUEST);
    respond({
      requestKey: 'paper/cold-press|1|1920x1080|1',
      path: 'worker-cpu',
      fieldWidth: 1,
      fieldHeight: 1,
      durationMs: 0,
      pixels: null,
    });
    await expect(promise).resolves.toBeNull();
  });
});
