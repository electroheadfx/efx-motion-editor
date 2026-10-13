import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Layer } from '../types/layer';
import { defaultTransform } from '../types/layer';
import type { Sequence } from '../types/sequence';
import { imageStore } from '../stores/imageStore';

// 261012-kxg (VID-04): headless legs for the export video readiness seam.
// Node environment discipline (vitest.config.ts has no environment key): the
// DOM surface is faked with vi.stubGlobal and FakeVideo is installed as BOTH
// document.createElement('video') and the global HTMLVideoElement so the
// instanceof checks in previewRenderer match instances produced by the
// document stub. These legs PIN the contract (fix-before-tests carve-out:
// live export behavior was validated first, then pinned here).

vi.mock('../stores/paintStore', () => ({
  paintStore: { getFrame: vi.fn(() => null) },
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
    fps: { peek: () => 24, value: 24 },
  },
}));

const { decodeWebpFrame: decodeWebpFrameMock } = vi.hoisted(() => ({ decodeWebpFrame: vi.fn() }));
vi.mock('../lib/webpFrameCodec', () => ({ decodeWebpFrame: decodeWebpFrameMock }));

import {
  PreviewRenderer,
  VIDEO_READY_TIMEOUT_MS,
} from './previewRenderer';

// ---------------------------------------------------------------------------
// FakeVideo harness — module-scope videoMode drives construction behavior:
// 'ready' fires loadeddata (readyState 2) on the next macrotask after src is
// set; 'error' fires 'error'; 'silent' schedules nothing (hung file, used by
// the timeout/abort legs). The currentTime setter always marks seeking on a
// real change; mode 'silent' skips the auto-'seeked' schedule so the seek
// can hang until the test dispatches it (B2) or the bound trips (B4).
// ---------------------------------------------------------------------------

type VideoMode = 'ready' | 'error' | 'silent';
let videoMode: VideoMode = 'ready';
const createdVideos: FakeVideo[] = [];

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

  get src(): string {
    return this.currentSrc;
  }

  set src(value: string) {
    this.currentSrc = value;
    if (videoMode === 'silent') return;
    setTimeout(() => {
      if (videoMode === 'ready') {
        this.readyState = 2;
        this.dispatchEvent(new Event('loadeddata'));
      } else if (videoMode === 'error') {
        this.dispatchEvent(new Event('error'));
      }
    }, 0);
  }

  get currentTime(): number {
    return this.time;
  }

  set currentTime(value: number) {
    if (value === this.time) return;
    this.time = value;
    this.seeking = true;
    if (videoMode === 'silent') return; // hung seek: no auto-'seeked'
    setTimeout(() => {
      this.seeking = false;
      this.dispatchEvent(new Event('seeked'));
    }, 0);
  }

  pause(): void {}
  load(): void {}
  removeAttribute(name: string): void {
    if (name === 'src') this.currentSrc = '';
  }
}

class TestCanvas {
  width = 4;
  height = 3;
  clientWidth = 0;
  clientHeight = 0;
  offsetWidth = 0;
  offsetHeight = 0;
  getContext(contextId: string): unknown {
    if (contextId !== '2d') return null;
    return {
      save() {}, restore() {}, scale() {}, translate() {}, rotate() {},
      clearRect() {}, setTransform() {}, fillRect() {}, fillText() {},
      drawImage() {}, getImageData: (_x: number, _y: number, w: number, h: number) =>
        ({ data: new Uint8ClampedArray(w * h * 4) }),
    };
  }
}

function makeVideoLayer(): Layer {
  return {
    id: 'video-layer',
    name: 'Vidéo SUPP',
    type: 'video',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'video', videoAssetId: 'va-1' },
  } as Layer;
}

function makeVideoSequence(): Sequence {
  return {
    id: 'seq-1',
    kind: 'content',
    extrapolation: 'hold',
    name: 'Seq',
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makeVideoLayer()],
  };
}

function seedVideoAssets(): void {
  imageStore.videoAssets.value = [
    { id: 'va-1', name: 'HyperEspaceSUPP.mov', path: '/Movies/HyperEspaceSUPP.mov' },
  ];
}

let renderer: PreviewRenderer;

beforeEach(() => {
  videoMode = 'ready';
  createdVideos.length = 0;
  decodeWebpFrameMock.mockReset();
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', {
    createElement: (tag: string) => {
      if (tag === 'canvas') return new TestCanvas();
      if (tag === 'video') {
        const video = new FakeVideo();
        createdVideos.push(video);
        return video;
      }
      return {};
    },
  });
  vi.stubGlobal('HTMLVideoElement', FakeVideo);
  vi.stubGlobal('HTMLImageElement', class {});
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
  renderer = new PreviewRenderer(new TestCanvas() as unknown as HTMLCanvasElement);
});

afterEach(() => {
  imageStore.videoAssets.value = [];
  renderer.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('261012-kxg export video readiness (VID-04)', () => {
  // --- A: initial readiness (preloadVideos) ---

  it('A1: resolves when the video reaches readyState 2 and leaves the element registered', async () => {
    seedVideoAssets();

    await renderer.preloadVideos([makeVideoSequence()]);

    expect(createdVideos).toHaveLength(1);
    expect(createdVideos[0].readyState).toBe(2);
  });

  // LOOP-persist audit (WARNING-2): the export gate reads
  // VideoAsset.sourceFrameCount. At preload time duration is still 0 when
  // resolveVideoSource first runs, so the count must be re-probed AFTER
  // settle or a reopen -> export that never previews falls back to
  // MAX_SAFE_INTEGER and disagrees with the seek path.
  it('A1b: caches sourceFrameCount on the VideoAsset after preload settle', async () => {
    seedVideoAssets();

    await renderer.preloadVideos([makeVideoSequence()]);

    // FakeVideo.duration = 10, projectStore.fps = 24 -> 240 frames.
    const asset = imageStore.videoAssets.peek().find((v) => v.id === 'va-1');
    expect(asset?.sourceFrameCount).toBe(240);
  });

  it('A2: a video that fires error rejects naming the clip (fail-closed)', async () => {
    seedVideoAssets();
    videoMode = 'error';

    await expect(renderer.preloadVideos([makeVideoSequence()]))
      .rejects.toThrow(/Vidéo SUPP/);
  });

  it('A3: a missing videoAsset row rejects naming the clip (fail-closed)', async () => {
    // No imageStore.videoAssets row for va-1 — resolveVideoSource returns
    // before registering the element.
    await expect(renderer.preloadVideos([makeVideoSequence()]))
      .rejects.toThrow(/Vidéo SUPP/);
  });

  // --- B: seek completion (settleVideoSeeks) ---

  it('B1: resolves false with no listeners when every element is ready and not seeking', async () => {
    seedVideoAssets();
    await renderer.preloadVideos([makeVideoSequence()]);
    const video = createdVideos[0];
    const addListener = vi.spyOn(video, 'addEventListener');

    await expect(renderer.settleVideoSeeks()).resolves.toBe(false);

    expect(addListener).not.toHaveBeenCalled();
  });

  it('B2: does not resolve while a seek is in flight; resolves true once seeked fires', async () => {
    seedVideoAssets();
    await renderer.preloadVideos([makeVideoSequence()]);
    const video = createdVideos[0];
    // Hang the next seek: seeking flips true, no auto-'seeked' scheduled.
    videoMode = 'silent';
    video.currentTime = 2.5;
    expect(video.seeking).toBe(true);

    let settled = false;
    const pending = renderer.settleVideoSeeks().then((didWait) => {
      settled = true;
      return didWait;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(settled).toBe(false);

    // The seek completes out-of-band (as a real video would).
    video.seeking = false;
    video.dispatchEvent(new Event('seeked'));

    await expect(pending).resolves.toBe(true);
  });

  it('B3: aborting the signal mid-wait rejects with Export cancelled', async () => {
    seedVideoAssets();
    videoMode = 'silent'; // never becomes ready
    const controller = new AbortController();

    const pending = renderer.preloadVideos([makeVideoSequence()], controller.signal);
    const expectation = expect(pending).rejects.toThrow('Export cancelled');
    setTimeout(() => controller.abort(), 0);
    await expectation;
  });

  it('B4: a video that never becomes ready rejects naming the clip at the 30s bound', async () => {
    seedVideoAssets();
    videoMode = 'silent'; // hung file: readyState never advances
    vi.useFakeTimers();

    const pending = renderer.preloadVideos([makeVideoSequence()]);
    const expectation = expect(pending).rejects.toThrow(/Vidéo SUPP/);
    await vi.advanceTimersByTimeAsync(VIDEO_READY_TIMEOUT_MS);
    await expectation;
  });
});
