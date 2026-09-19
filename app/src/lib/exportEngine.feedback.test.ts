import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from '../stores/physicPaintStore';
import { reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import { exportStore } from '../stores/exportStore';
import type { Sequence } from '../types/sequence';
import type { FrameEntry } from '../types/timeline';

// 260919-sns: pin the export feedback contract — clicking Export must surface
// 'Preparing export...' synchronously (before the Studio flush await resolves),
// frame counts must stay truthful once the frame map is known, and a cancel
// clicked during the flush window must survive (never wiped by a later
// resetProgress). Node env, vitest run only; no jsdom, no config changes. The
// mock block and canvas harness are copied verbatim from exportEngine.test.ts;
// the ONLY addition is the './physicPaintFlush' mock — a bare deferred promise
// (no setTimeout inside it) whose resolve is captured into hoisted.flushResolve
// so each test controls exactly when the flush completes.

const hoisted = vi.hoisted(() => ({
  fm: [] as FrameEntry[],
  sequences: [] as Sequence[],
  activeSequenceId: 'seq-1',
  projectWidth: 4,
  projectHeight: 3,
  flushResolve: null as null | ((value: boolean) => void),
}));

vi.mock('./ipc', () => ({
  exportCreateDir: vi.fn(async () => ({ ok: true as const, data: '/tmp/efx-export-preflight-test' })),
  exportWritePng: vi.fn(async () => ({ ok: true as const })),
  exportCheckFfmpeg: vi.fn(async () => ({ ok: true as const, data: true })),
  exportDownloadFfmpeg: vi.fn(async () => ({ ok: true as const })),
  exportEncodeVideo: vi.fn(async () => ({ ok: true as const })),
  exportCleanupPngs: vi.fn(async () => ({ ok: true as const })),
  exportCleanupFile: vi.fn(async () => ({ ok: true as const })),
  assetUrl: (path: string) => path,
}));

vi.mock('./frameMap', () => ({
  frameMap: { peek: () => hoisted.fm },
  crossDissolveOverlaps: { peek: () => [] },
  getTimelineOverlaySequenceOutFrame: (seq: { outFrame?: number }, fallback: number) => seq.outFrame ?? fallback,
}));

vi.mock('../stores/sequenceStore', () => ({
  sequenceStore: {
    sequences: { peek: () => hoisted.sequences },
    activeSequenceId: { peek: () => hoisted.activeSequenceId },
  },
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    name: { peek: () => 'Multi-Track Export Project' },
    width: { peek: () => hoisted.projectWidth, value: hoisted.projectWidth },
    height: { peek: () => hoisted.projectHeight, value: hoisted.projectHeight },
    fps: { peek: () => 24 },
  },
}));

vi.mock('../stores/audioStore', () => ({ audioStore: { tracks: { peek: () => [] } } }));
vi.mock('../stores/soloStore', () => ({ soloStore: { soloEnabled: { peek: () => false } } }));
vi.mock('./audioEngine', () => ({ audioEngine: { getBuffer: () => null } }));
vi.mock('./exportSidecar', () => ({ generateJsonSidecar: () => '{}', generateFcpxml: () => '' }));
vi.mock('./audioExportMixer', () => ({ renderMixedAudio: vi.fn(async () => new Uint8Array()) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }));
vi.mock('../stores/paintStore', () => ({ paintStore: { getFrame: vi.fn(() => null) } }));

vi.mock('./exportRenderer', () => ({
  renderGlobalFrame: vi.fn(),
  renderFrameWithMotionBlur: vi.fn(),
  preloadExportImages: vi.fn(async () => {}),
}));

vi.mock('./physicPaintFlush', () => ({
  requestPhysicPaintFlush: vi.fn(() => new Promise<boolean>((resolve) => { hoisted.flushResolve = resolve; })),
}));

import { startExport } from './exportEngine';

// --- Minimal canvas harness (verbatim from exportEngine.test.ts) ---

class RecordingCanvasContext {
  operations: Array<{ type: string }> = [];
  fillStyle = '#000000';
  globalAlpha = 1;
  globalCompositeOperation: GlobalCompositeOperation = 'source-over';
  font = '';
  textAlign = 'left';
  textBaseline = 'alphabetic';

  save(): void { this.operations.push({ type: 'save' }); }
  restore(): void { this.operations.push({ type: 'restore' }); }
  scale(): void { this.operations.push({ type: 'scale' }); }
  clearRect(): void { this.operations.push({ type: 'clearRect' }); }
  setTransform(): void { /* recorded paths never assert transforms */ }
  fillRect(..._args: number[]): void { this.operations.push({ type: 'fillRect' }); }
  drawImage(..._args: unknown[]): void { this.operations.push({ type: 'drawImage' }); }
  fillText(_text: string, ..._args: number[]): void { this.operations.push({ type: 'fillText' }); }
}

class TestCanvas {
  width = 4;
  height = 3;
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;

  getContext(contextId: string): RecordingCanvasContext | null {
    return contextId === '2d' ? new RecordingCanvasContext() : null;
  }

  toBlob(callback: (blob: Blob | null) => void): void {
    callback(new Blob(['png-bytes'], { type: 'image/png' }));
  }
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
  resetEfxPaintStore();
  exportStore.resetProgress();
  exportStore.outputFolder.value = '/tmp/efx-export-feedback';
  hoisted.fm = [{ kind: 'content', globalFrame: 0, sequenceId: 'seq-1', keyPhotoId: 'kp', imageId: '', localFrame: 0 }];
  hoisted.sequences = [{ id: 'seq-1', name: 'Seq', kind: 'content', fps: 24, width: 4, height: 3, keyPhotos: [], layers: [] } as Sequence];
  hoisted.flushResolve = null;
  vi.clearAllMocks();
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', { createElement: (tag: string) => tag === 'canvas' ? new TestCanvas() : {} });
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
  vi.stubGlobal('HTMLImageElement', class {});
  vi.stubGlobal('HTMLVideoElement', class {});
});

afterEach(() => {
  physicPaintStore.reset();
  vi.unstubAllGlobals();
});

describe('export feedback immediacy (260919-sns)', () => {
  it("writes 'preparing' synchronously on click, before the flush resolves", async () => {
    const p = startExport();
    // Synchronous assertion — no tick, no await: the click itself must surface
    // the preparing stage even though the Studio flush is still pending.
    expect(exportStore.progress.peek().status).toBe('preparing');
    hoisted.flushResolve!(true);
    await p;
    expect(exportStore.progress.peek().status).toBe('complete');
  });

  it('keeps frame counts truthful once the frame map is known', async () => {
    const p = startExport();
    expect(exportStore.progress.peek().status).toBe('preparing');
    hoisted.flushResolve!(true);
    await p;
    expect(exportStore.progress.peek().totalFrames).toBe(hoisted.fm.length);
  });

  it('honors a cancel clicked during the flush window at the first checkpoint', async () => {
    const p = startExport();
    // The cancel lands while the flush is still pending (the invisible window
    // on pre-fix code). No intermediate 'preparing' assertion here: the pinned
    // RED for this case is the cancel-wipe defect itself — pre-fix, the
    // resetProgress after the flush resolves wipes the flag and the export
    // runs on to 'complete' instead of 'cancelled'.
    exportStore.cancel();
    hoisted.flushResolve!(true);
    await p;
    expect(exportStore.progress.peek().status).toBe('cancelled');
  });
});
