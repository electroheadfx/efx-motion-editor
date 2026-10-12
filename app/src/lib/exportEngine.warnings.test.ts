import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { exportStore } from '../stores/exportStore';
import { imageStore } from '../stores/imageStore';
import { defaultTransform, type Layer } from '../types/layer';
import type { Sequence } from '../types/sequence';
import type { FrameEntry } from '../types/timeline';

// 53.1-05 Task 2 (D-06 / D-14): named export gap warnings that NEVER abort.
//
// A visible clip with an authoritative out < N must produce exactly one named
// warning carrying the clip name and the exact uncovered range, while the
// export still completes and writes 0..N-1. errorMessage keeps abort semantics
// (SND-02); a gap is a valid compositional state and must not throw, must not
// set error status, and must not withhold the deliverable. An untrimmed clip
// (absent outFrame) never gaps and must stay silent.
//
// Harness discipline: same recording-stub shape as exportEngine.test.ts
// (hoisted fm + sequences, mocked IPC / projectStore / exportRenderer) —
// do not invent a second mock stack. getOverlaySkipRange is the real frameMap
// helper so the warning range cannot drift from the timeline hatch source.

const hoisted = vi.hoisted(() => ({
  fm: [] as FrameEntry[],
  sequences: [] as Sequence[],
  activeSequenceId: 'seq-1',
}));

vi.mock('./ipc', () => ({
  exportCreateDir: vi.fn(async () => ({ ok: true as const, data: '/tmp/efx-export-warnings-test' })),
  exportWritePng: vi.fn(async () => ({ ok: true as const })),
  exportCheckFfmpeg: vi.fn(async () => ({ ok: true as const, data: true })),
  exportDownloadFfmpeg: vi.fn(async () => ({ ok: true as const })),
  exportEncodeVideo: vi.fn(async () => ({ ok: true as const })),
  exportCleanupPngs: vi.fn(async () => ({ ok: true as const })),
  exportCleanupFile: vi.fn(async () => ({ ok: true as const })),
  assetUrl: (path: string) => path,
}));

vi.mock('./frameMap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./frameMap')>();
  return {
    frameMap: { peek: () => hoisted.fm },
    crossDissolveOverlaps: { peek: () => [] },
    getTimelineOverlaySequenceOutFrame: (seq: { outFrame?: number }, fallback: number) =>
      seq.outFrame ?? fallback,
    resolveOverlaySample: (
      clip: { inFrame?: number; outFrame?: number },
      globalFrame: number,
      N: number,
    ) => {
      const inFrame = clip.inFrame ?? 0;
      const outFrame = clip.outFrame ?? N;
      if (globalFrame < inFrame || globalFrame >= outFrame) return { kind: 'skip' as const };
      return { kind: 'sample' as const, localFrame: globalFrame - inFrame };
    },
    // Real single coverage-gap definition (D-05/D-06/D-12) — the warning range
    // is exactly the timeline hatch range by construction.
    getOverlaySkipRange: actual.getOverlaySkipRange,
  };
});

vi.mock('../stores/sequenceStore', () => ({
  sequenceStore: {
    sequences: { peek: () => hoisted.sequences },
    activeSequenceId: { peek: () => hoisted.activeSequenceId },
  },
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    name: { peek: () => 'Gap Warnings Project' },
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
    fps: { peek: () => 15 },
    dirPath: { peek: () => '/proj' },
  },
}));

vi.mock('../stores/audioStore', () => ({ audioStore: { tracks: { peek: () => [] } } }));
vi.mock('../stores/soloStore', () => ({ soloStore: { soloEnabled: { peek: () => false } } }));
vi.mock('./audioEngine', () => ({ audioEngine: { getBuffer: () => null } }));
vi.mock('./exportSidecar', () => ({ generateJsonSidecar: () => '{}', generateFcpxml: () => '' }));
vi.mock('./audioExportMixer', () => ({ renderMixedAudio: vi.fn(async () => new Uint8Array()) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }));
vi.mock('../stores/paintStore', () => ({ paintStore: { getFrame: vi.fn(() => null) } }));
vi.mock('./physicPaintFlush', () => ({ requestPhysicPaintFlush: vi.fn(async () => true) }));

vi.mock('./exportRenderer', () => ({
  renderGlobalFrame: vi.fn(),
  renderFrameWithMotionBlur: vi.fn(),
  preloadExportImages: vi.fn(async () => {}),
}));

import { startExport } from './exportEngine';
import {
  renderGlobalFrame as renderGlobalFrameMock,
} from './exportRenderer';
import { exportWritePng as exportWritePngMock } from './ipc';

// --- Fixtures ----------------------------------------------------------------

function makeFm(length: number): FrameEntry[] {
  return Array.from({ length }, (_, i) => ({
    globalFrame: i,
    sequenceId: 'content-1',
    keyPhotoId: `kp-${i}`,
    imageId: `img-${i}`,
    layerId: 'base',
  })) as unknown as FrameEntry[];
}

function makeVideoLayer(name: string): Layer {
  return {
    id: `layer-${name}`,
    name,
    type: 'video',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'video', videoAssetId: 'va-1' },
  };
}

/** Trimmed content-overlay with an authoritative exclusive out (D-04). */
function makeTrimmedOverlay(name: string, outFrame: number): Sequence {
  return {
    id: `seq-${name}`,
    name,
    kind: 'content-overlay',
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makeVideoLayer(name)],
    inFrame: 0,
    outFrame,
    extrapolation: 'hold',
  };
}

/** Untrimmed content-overlay — absent outFrame = follows N, never gaps (D-04). */
function makeUntrimmedOverlay(name: string): Sequence {
  return {
    id: `seq-${name}`,
    name,
    kind: 'content-overlay',
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makeVideoLayer(name)],
    inFrame: 0,
    extrapolation: 'hold',
  };
}

function makeContentSequence(N: number): Sequence {
  return {
    id: 'content-1',
    name: 'Base',
    kind: 'content',
    width: 4,
    height: 3,
    keyPhotos: Array.from({ length: N }, (_, i) => ({
      id: `kp-${i}`,
      imageId: `img-${i}`,
      holdFrames: 1,
    })),
    layers: [],
    extrapolation: 'hold',
  };
}

// --- FakeVideo harness (same discipline as exportEngine.test.ts VID-04) ------
// previewRenderer.preloadVideos is fail-closed on unregistered/unready video;
// the warning contract must be measured on a READY export, so the video source
// is registered and the fake element reports loadeddata.

class FakeVideo extends EventTarget {
  readyState = 0;
  seeking = false;
  duration = 10;
  error: { code: number } | null = null;
  videoWidth = 4;
  videoHeight = 3;
  preload = '';
  muted = false;
  playsInline = false;
  private currentSrc = '';
  private time = 0;

  get src(): string { return this.currentSrc; }
  set src(value: string) {
    this.currentSrc = value;
    setTimeout(() => {
      this.readyState = 2;
      this.dispatchEvent(new Event('loadeddata'));
    }, 0);
  }
  get currentTime(): number { return this.time; }
  set currentTime(value: number) {
    this.time = value;
    this.seeking = true;
    setTimeout(() => {
      this.seeking = false;
      this.dispatchEvent(new Event('seeked'));
    }, 0);
  }
  pause(): void {}
  load(): void {}
  removeAttribute(name: string): void { if (name === 'src') this.currentSrc = ''; }
}

class TestCanvas {
  width = 4;
  height = 3;
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;
  getContext(contextId: string) {
    if (contextId !== '2d') return null;
    return {
      fillStyle: '',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      save() {},
      restore() {},
      scale() {},
      clearRect() {},
      setTransform() {},
      fillRect() {},
      drawImage() {},
      fillText() {},
    };
  }
  toBlob(cb: (b: Blob | null) => void): void {
    cb(new Blob(['png'], { type: 'image/png' }));
  }
}

beforeEach(() => {
  hoisted.fm = [];
  hoisted.sequences = [];
  vi.clearAllMocks();
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', {
    createElement: (tag: string) =>
      tag === 'canvas' ? new TestCanvas() : tag === 'video' ? new FakeVideo() : {},
    hidden: true,
  });
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
  vi.stubGlobal('HTMLImageElement', class {});
  vi.stubGlobal('HTMLVideoElement', FakeVideo);
  exportStore.resetProgress();
  exportStore.outputFolder.value = '/tmp/efx-export-warnings-test';
  exportStore.includeAudio.value = false;
  exportStore.selectedSequenceOnly.value = false;
  exportStore.motionBlurEnabled.value = false;
  exportStore.format.value = 'png';
  imageStore.videoAssets.value = [
    { id: 'va-1', name: 'nebula.mov', path: '/Movies/nebula.mov' },
  ];
});

afterEach(() => {
  imageStore.videoAssets.value = [];
  vi.unstubAllGlobals();
});

// --- RED contract (D-06 / D-14) ---------------------------------------------

describe('export gap warnings (D-06/D-14)', () => {
  it('trimmed visible clip with out < N produces exactly one named warning with clip name and range', async () => {
    const N = 18;
    hoisted.fm = makeFm(N);
    hoisted.sequences = [
      makeContentSequence(N),
      makeTrimmedOverlay('nebula.mov', 16),
    ];

    await startExport();

    const warnings = exportStore.progress.peek().warnings;
    expect(warnings).toHaveLength(1);
    // Clip name AND the exact uncovered range (inclusive frames 16..17).
    expect(warnings[0]).toContain('nebula.mov');
    expect(warnings[0]).toContain('16');
    expect(warnings[0]).toContain('17');
    expect(warnings[0]).toMatch(/16\.\.17/);
  });

  it('export still completes and reports 0..N-1 frame output while the warning is present', async () => {
    const N = 18;
    hoisted.fm = makeFm(N);
    hoisted.sequences = [
      makeContentSequence(N),
      makeTrimmedOverlay('nebula.mov', 16),
    ];

    await startExport();

    const p = exportStore.progress.peek();
    expect(p.status).toBe('complete');
    expect(p.totalFrames).toBe(N);
    expect(p.currentFrame).toBe(N);
    expect(p.warnings).toHaveLength(1);
    // 0..N-1 written — one render per exported frame, export length law intact.
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(N);
    expect(exportWritePngMock).toHaveBeenCalled();
  });

  it('gap path leaves errorMessage null and does not throw', async () => {
    const N = 18;
    hoisted.fm = makeFm(N);
    hoisted.sequences = [
      makeContentSequence(N),
      makeTrimmedOverlay('nebula.mov', 16),
    ];

    await expect(startExport()).resolves.toBeUndefined();

    const p = exportStore.progress.peek();
    // Non-abort contract is measured ON the gap path: a warning must be present
    // (otherwise this would pass trivially with no gap handling at all).
    expect(p.warnings).toHaveLength(1);
    expect(p.errorMessage).toBeNull();
    expect(p.status).not.toBe('error');
  });

  it('untrimmed clip (absent outFrame) produces no gap warning', async () => {
    const N = 18;
    hoisted.fm = makeFm(N);
    hoisted.sequences = [
      makeContentSequence(N),
      makeUntrimmedOverlay('nebula.mov'),
    ];

    await startExport();

    const p = exportStore.progress.peek();
    expect(p.status).toBe('complete');
    expect(p.warnings).toEqual([]);
    expect(p.errorMessage).toBeNull();
  });
});
