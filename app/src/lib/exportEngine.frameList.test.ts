import { testWebpBytes } from '../testUtils/testWebpBytes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from '../stores/physicPaintStore';
import {
  registerDocument,
  reset as resetEfxPaintStore,
} from '../stores/efxPaintStore';
import { sequenceStore } from '../stores/sequenceStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { exportStore } from '../stores/exportStore';
import { imageStore } from '../stores/imageStore';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { defaultTransform, type Layer } from '../types/layer';
import type { Sequence } from '../types/sequence';
import type { FrameEntry } from '../types/timeline';

// frame-model-coherence (2026-10-12) — EXPORT FRAME-LIST TARGET-LAW CONTRACT.
//
// Asserts the TARGET laws of FRAME-MODEL.md §7 for the release-blocker repro:
//   16-frame .mov content-overlay + Studio physic-paint FX (outFrame=17
//   exclusive, fade-out ending at the clip end) -> N=17, 17 frames 0..16.
//
// Laws under assertion (grouped so later GREEN legs can flip them one law at
// a time via `vitest -t`):
//   - "fps timebase (I-4)"            — project fps is the only timebase (D-01/D-02)
//   - "tail policy (I-1/I-2)"         — untrimmed follows N; trimmed past-out is nothing (D-03/D-04)
//   - "past-source extrapolation (I-5)" — HOLD last sample / LOOP wrap (D-07/D-09)
//   - "law corroboration (unchanged)" — N-law count + exclusive outFrame gate stay green
//
// I-6 fade expectations (D-13) stay behavior pins — they are NOT law
// assertions and must not be rewritten when the law assertions flip.
//
// Harness discipline: real frameMap (N law), real sequenceStore, real
// exportRenderer.renderGlobalFrame (the overlay gate under measurement).
// Tauri IPC and the surrounding stores are mocked; PreviewRenderer is a
// recording stub passed into renderGlobalFrame — layer presence is the set of
// layers handed to renderFrame per frame, and the fps/localFrame arguments
// are the timebase / sample-index quantities under law. Node env, vitest run.

vi.mock('./ipc', () => ({
  exportCreateDir: vi.fn(async () => ({ ok: true as const, data: '/tmp/efx-export-frame-list' })),
  exportWritePng: vi.fn(async () => ({ ok: true as const })),
  exportCheckFfmpeg: vi.fn(async () => ({ ok: true as const, data: true })),
  exportDownloadFfmpeg: vi.fn(async () => ({ ok: true as const })),
  exportEncodeVideo: vi.fn(async () => ({ ok: true as const })),
  exportCleanupPngs: vi.fn(async () => ({ ok: true as const })),
  exportCleanupFile: vi.fn(async () => ({ ok: true as const })),
  assetUrl: (path: string) => path,
}));

vi.mock('../stores/projectStore', () => ({
  projectStore: {
    name: { peek: () => 'Frame List Repro' },
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
    fps: { peek: () => 15 },
    dirPath: { peek: () => '/proj' },
  },
}));

vi.mock('../stores/soloStore', () => ({ soloStore: { soloEnabled: { peek: () => false } } }));
vi.mock('../stores/paintStore', () => ({ paintStore: { getFrame: vi.fn(() => null) } }));
vi.mock('./audioEngine', () => ({ audioEngine: { getBuffer: () => null } }));
vi.mock('./exportSidecar', () => ({ generateJsonSidecar: () => '{}', generateFcpxml: () => '' }));
vi.mock('./audioExportMixer', () => ({ renderMixedAudio: vi.fn(async () => new Uint8Array()) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }));
vi.mock('./physicPaintFlush', () => ({ requestPhysicPaintFlush: vi.fn(async () => true) }));

import { renderGlobalFrame } from './exportRenderer';
import { frameMap, getTimelineOverlaySequenceOutFrame } from './frameMap';

// --- Recording PreviewRenderer stub ------------------------------------------
// Stands in for PreviewRenderer.renderFrame: records every renderFrame call's
// layers + opacity + fps + localFrame so per-frame layer presence, fade
// opacity, timebase, and sample index are measurable without a real canvas.

interface RecordedRender {
  layerIds: string[];
  layerTypes: string[];
  opacity: number;
  clearCanvas: boolean;
  globalFrame: number;
  physicPaintFrame: number;
  localFrame: number;
  fps: number;
}

function makeRecordingRenderer(): {
  renderFrame: (
    layers: Layer[],
    frame: number,
    frames: FrameEntry[],
    fps: number,
    clearCanvas?: boolean,
    sequenceOpacity?: number,
    globalFrame?: number,
    physicPaintFrame?: number,
  ) => void;
  calls: RecordedRender[];
} {
  const calls: RecordedRender[] = [];
  return {
    calls,
    renderFrame(
      layers: Layer[],
      frame: number,
      _frames: FrameEntry[],
      fps: number,
      clearCanvas = true,
      sequenceOpacity = 1.0,
      globalFrame?: number,
      physicPaintFrame?: number,
    ): void {
      calls.push({
        layerIds: layers.map((l) => l.id),
        layerTypes: layers.map((l) => l.type),
        opacity: sequenceOpacity,
        clearCanvas,
        globalFrame: globalFrame ?? -1,
        physicPaintFrame: physicPaintFrame ?? -1,
        localFrame: frame,
        fps,
      });
    },
  };
}

// --- Minimal canvas harness (same discipline as exportEngine.paintEnumeration) ---

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

// --- Store fixtures -----------------------------------------------------------

const LAYER = 'frame-list-paint-layer';
const TEST_TRACK_ID = 'track-1';
const VIDEO_LAYER_ID = 'video-layer';

/** The repro's media source: a 16-frame .mov (source samples 0..15). */
const SOURCE_FRAME_COUNT = 16;

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

function makePhysicPaintLayer(layerId: string): Layer {
  return {
    id: layerId,
    name: 'Physic Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId },
  };
}

function makeVideoLayer(): Layer {
  return {
    id: VIDEO_LAYER_ID,
    name: 'HyperEspaceSUPP',
    type: 'video',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'video', videoAssetId: 'va-1' },
  };
}

/**
 * Video content-overlay covering [0, 16) — outFrame exclusive.
 * Dropped per-sequence fps (D-01): project fps is the only timebase.
 */
function makeVideoOverlaySequence(): Sequence {
  return {
    id: 'video-overlay',
    name: 'HyperEspaceSUPP',
    kind: 'content-overlay',
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makeVideoLayer()],
    inFrame: 0,
    outFrame: 16,
    extrapolation: 'hold',
  };
}

/**
 * Untrimmed video content-overlay (absent outFrame = follows N, D-04).
 * Hand-built so the factory's import-time outFrame freeze (I-2) is not in play.
 */
function makeUntrimmedVideoOverlaySequence(): Sequence {
  return {
    id: 'video-overlay',
    name: 'HyperEspaceSUPP',
    kind: 'content-overlay',
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makeVideoLayer()],
    inFrame: 0,
    extrapolation: 'hold',
  };
}

/**
 * Video content-overlay spanning [0, 17) so the clip is IN RANGE at frame 16
 * while the 16-frame source is exhausted — isolates I-5 (past-source) from
 * I-1/I-2 (past-out).
 */
function makePastSourceVideoOverlaySequence(extrapolation: 'hold' | 'loop'): Sequence {
  return {
    id: 'video-overlay',
    name: 'HyperEspaceSUPP',
    kind: 'content-overlay',
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makeVideoLayer()],
    inFrame: 0,
    outFrame: 17,
    extrapolation,
  };
}

/** Studio physic-paint FX covering [0, 17) — fade-out ends at the clip end (tick 17). */
function makePaintFxSequence(): Sequence {
  return {
    id: 'paint-fx',
    name: 'Studio Paint',
    kind: 'fx',
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makePhysicPaintLayer(LAYER)],
    inFrame: 0,
    outFrame: 17,
    extrapolation: 'hold',
    fadeOut: {
      type: 'fade-out',
      duration: 3,
      curve: 'linear',
      mode: 'transparency',
      color: '#000000',
    },
  };
}

function makeRotoRecord(keyId: string, appFrame: number): PhysicPaintRotoRealKeyRecord {
  return {
    keyId,
    appFrame,
    kind: 'real-key',
    payload: {
      frameIndex: 0,
      appFrame,
      bytes: testWebpBytes(String(appFrame).padStart(4, 'A')),
      width: 4,
      height: 3,
    },
  };
}

function installRotoDocument(layerId: string, recordFrames: readonly number[]): void {
  registerDocument(makeTrackDocument(layerId));
  const records = recordFrames.map((appFrame) => makeRotoRecord(`key-${appFrame}`, appFrame));
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const loopClips: PhysicPaintRotoLoopClip[] = [];
  const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, TEST_TRACK_ID, {
    capacity: 120,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    loopClips,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
  });
  if (!result.ok) throw new Error(result.error);
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  sequenceStore.reset();
  physicPaintStore.reset();
  resetEfxPaintStore();
  vi.clearAllMocks();
  vi.stubGlobal('window', { devicePixelRatio: 1 });
  vi.stubGlobal('document', { createElement: (tag: string) => tag === 'canvas' ? new TestCanvas() : {} });
  vi.stubGlobal('HTMLCanvasElement', TestCanvas);
  vi.stubGlobal('HTMLImageElement', class {});
  vi.stubGlobal('HTMLVideoElement', class {});
  exportStore.resetProgress();
  exportStore.outputFolder.value = '/tmp/efx-export-frame-list';
  exportStore.includeAudio.value = false;
  exportStore.selectedSequenceOnly.value = false;
  exportStore.motionBlurEnabled.value = false;
  exportStore.format.value = 'png';
  imageStore.videoAssets.value = [
    // 16-frame .mov: the export gate needs the source length to apply I-5
    // past-source extrapolation (53.1-03 feeds the real count).
    { id: 'va-1', name: 'HyperEspaceSUPP.mov', path: '/Movies/HyperEspaceSUPP.mov', sourceFrameCount: SOURCE_FRAME_COUNT },
  ];
});

afterEach(() => {
  physicPaintStore.reset();
  resetEfxPaintStore();
  imageStore.videoAssets.value = [];
  vi.unstubAllGlobals();
});

/**
 * Repro arrange: video content-overlay + paint FX out=17.
 * Roto keys at appFrames 0..16 so the paint is a real render source on every
 * frame of its span (including the tail frame 16).
 */
function arrangeRepro(videoSeq: Sequence = makeVideoOverlaySequence()): void {
  sequenceStore.sequences.value = [videoSeq, makePaintFxSequence()];
  installRotoDocument(LAYER, Array.from({ length: 17 }, (_, i) => i));
}

/**
 * I-2 arrange via the REAL factory: import the video overlay while the
 * timeline is 16 frames long (createContentOverlaySequence freezes outFrame
 * at import), then grow N to 17 with the paint FX. The untrimmed law says the
 * overlay follows N; the freeze is the I-2 root.
 */
function arrangeReproUntrimmedViaFactory(): void {
  sequenceStore.createContentOverlaySequence('HyperEspaceSUPP', makeVideoLayer(), SOURCE_FRAME_COUNT);
  const paint = sequenceStore.createFxSequence('Studio Paint', makePhysicPaintLayer(LAYER), 17, {
    outFrame: 17,
  });
  sequenceStore.sequences.value = sequenceStore.sequences.value.map((s) =>
    s.id === paint.id
      ? {
          ...s,
          fadeOut: {
            type: 'fade-out' as const,
            duration: 3,
            curve: 'linear' as const,
            mode: 'transparency' as const,
            color: '#000000',
          },
        }
      : s,
  );
  installRotoDocument(LAYER, Array.from({ length: 17 }, (_, i) => i));
}

type Recording = ReturnType<typeof makeRecordingRenderer>;

/** Drive the export loop's render call for every frame the export writes. */
function renderAllFrames(): Recording {
  const fm = frameMap.value;
  const seqs = sequenceStore.sequences.value;
  const recorder = makeRecordingRenderer();
  const canvas = new TestCanvas() as unknown as HTMLCanvasElement;
  for (let frame = 0; frame < fm.length; frame++) {
    renderGlobalFrame(recorder as never, canvas, frame, fm, seqs, [], false);
  }
  return recorder;
}

/**
 * Presence = which layers were handed to renderFrame while rendering that
 * global frame. The overlay pass runs one renderFrame per surviving overlay.
 */
function presenceFor(recorder: Recording, globalFrame: number) {
  const calls = recorder.calls.filter((c) => c.globalFrame === globalFrame);
  const ids = new Set<string>();
  const types = new Set<string>();
  for (const call of calls) {
    for (const id of call.layerIds) ids.add(id);
    for (const type of call.layerTypes) types.add(type);
  }
  return { ids, types, calls };
}

/** The renderFrame call that carried a given layer on a given global frame. */
function callForLayer(recorder: Recording, globalFrame: number, layerId: string): RecordedRender | undefined {
  return recorder.calls.find((c) => c.globalFrame === globalFrame && c.layerIds.includes(layerId));
}

describe('fps timebase (I-4)', () => {
  it('every renderFrame call receives project fps 15, not any per-sequence 24', () => {
    arrangeRepro();
    const recorder = renderAllFrames();

    expect(recorder.calls.length).toBeGreaterThan(0);
    for (const call of recorder.calls) {
      expect(call.fps, `renderFrame fps at global ${call.globalFrame}`).toBe(15);
    }
  });

  it('frame 15 maps to 1.0s at project fps 15 (not 0.625s from a 24fps-era sequence fps)', () => {
    arrangeRepro();
    const recorder = renderAllFrames();
    const fpsUsed = recorder.calls[0].fps;

    // Same formula as previewRenderer video seek: targetTime = frame / fps (D-02).
    const seekTimeAtFrame15 = 15 / fpsUsed;
    expect(seekTimeAtFrame15).toBeCloseTo(1.0, 5);
    expect(seekTimeAtFrame15).not.toBeCloseTo(0.625, 5);
  });
});

describe('tail policy (I-1/I-2)', () => {
  it('untrimmed content-overlay (absent outFrame) covers every frame 0..N-1 including the last', () => {
    arrangeRepro(makeUntrimmedVideoOverlaySequence());
    const fm = frameMap.value;
    expect(fm).toHaveLength(17);

    const recorder = renderAllFrames();

    // Target law: untrimmed = base layer = follows N. Video + paint on the
    // tail frame 16 in the repro shape — never a silent black frame (I-1).
    const f16 = presenceFor(recorder, 16);
    expect(f16.ids.has(VIDEO_LAYER_ID)).toBe(true);
    expect(f16.ids.has(LAYER)).toBe(true);

    for (let frame = 0; frame <= 16; frame++) {
      const presence = presenceFor(recorder, frame);
      expect(presence.ids.has(VIDEO_LAYER_ID), `untrimmed video should cover frame ${frame}`).toBe(true);
      expect(presence.ids.has(LAYER), `paint should cover frame ${frame}`).toBe(true);
    }
  });

  it('factory-imported untrimmed overlay follows N after a sibling grows the timeline (I-2 freeze is the bug)', () => {
    // Import while the timeline is 16 frames; the paint FX then grows N to 17.
    arrangeReproUntrimmedViaFactory();
    const fm = frameMap.value;
    expect(fm).toHaveLength(17);

    const recorder = renderAllFrames();
    const f16 = presenceFor(recorder, 16);
    expect(f16.ids.has(VIDEO_LAYER_ID), 'untrimmed overlay must follow N past its import-time end').toBe(true);
  });

  it('trimmed clip with out < N is absent past its exclusive out, and the uncovered range is exactly [16, 17)', () => {
    arrangeRepro(makeVideoOverlaySequence());
    const fm = frameMap.value;
    expect(fm).toHaveLength(17);

    const recorder = renderAllFrames();

    // Exclusive law unchanged: outFrame=16 covers 0..15; past out = nothing.
    const uncovered: number[] = [];
    for (let frame = 0; frame < fm.length; frame++) {
      if (!presenceFor(recorder, frame).ids.has(VIDEO_LAYER_ID)) uncovered.push(frame);
    }
    // Named range: frames 16..16 (out=16 exclusive, N=17) — the same range a
    // gap marker / export warning must name (D-05/D-06/D-12).
    expect(uncovered).toEqual([16]);

    // Paint still covers the whole span.
    for (let frame = 0; frame <= 16; frame++) {
      expect(presenceFor(recorder, frame).ids.has(LAYER), `paint should cover frame ${frame}`).toBe(true);
    }
  });
});

describe('past-source extrapolation (I-5)', () => {
  it('past the media source with default hold the last source sample is present', () => {
    // Clip spans [0, 17) so frame 16 is IN RANGE but past the 16-frame source.
    // extrapolation rides the real Sequence field (D-07) — no cast helper.
    arrangeRepro(makePastSourceVideoOverlaySequence('hold'));
    const recorder = renderAllFrames();

    const f15 = callForLayer(recorder, 15, VIDEO_LAYER_ID);
    const f16 = callForLayer(recorder, 16, VIDEO_LAYER_ID);
    expect(f15).toBeDefined();
    expect(f16).toBeDefined();

    // Last source sample is source index 15 (SOURCE_FRAME_COUNT - 1).
    expect(f15!.localFrame).toBe(15);
    expect(f16!.localFrame, 'HOLD keeps the last source sample past the media source').toBe(
      SOURCE_FRAME_COUNT - 1,
    );
  });

  it('with loop the sample index wraps past the media source', () => {
    arrangeRepro(makePastSourceVideoOverlaySequence('loop'));
    const recorder = renderAllFrames();

    const f16 = callForLayer(recorder, 16, VIDEO_LAYER_ID);
    expect(f16).toBeDefined();
    // 16 mod 16 = 0 — the sample index wraps.
    expect(f16!.localFrame, 'LOOP wraps the sample index past the media source').toBe(0);
  });
});

describe('law corroboration (unchanged)', () => {
  it('N law: frameMap enumerates exactly 17 frames (0..16) for video out=16 + paint out=17', () => {
    arrangeRepro();

    // Prediction: N = max(video out 16, paint out 17) = 17.
    expect(frameMap.value).toHaveLength(17);
    expect(frameMap.value.map((e) => e.globalFrame)).toEqual(
      Array.from({ length: 17 }, (_, i) => i),
    );
  });

  it('overlay outFrame gate is exclusive (corroboration of the law under measurement)', () => {
    arrangeRepro();
    const seqs = sequenceStore.sequences.value;
    const video = seqs.find((s) => s.id === 'video-overlay')!;
    const paint = seqs.find((s) => s.id === 'paint-fx')!;

    // Exclusive law: outFrame=16 covers 0..15; outFrame=17 covers 0..16.
    expect(getTimelineOverlaySequenceOutFrame(video, 17)).toBe(16);
    expect(getTimelineOverlaySequenceOutFrame(paint, 17)).toBe(17);
  });
});

// I-6 fade behavior pin (D-13) — NOT one of the four laws. Expectations are
// byte-stable and must not be rewritten when the law assertions flip.
it('I-6 sub-finding: paint fade-out reaches opacity 0 on the clip’s last frame (index 16)', () => {
  arrangeRepro();
  const recorder = renderAllFrames();

  // The paint FX render call carries the fade opacity as sequenceOpacity.
  const paintOpacityAt = (globalFrame: number): number | null => {
    const call = callForLayer(recorder, globalFrame, LAYER);
    return call ? call.opacity : null;
  };

  const opacity15 = paintOpacityAt(15);
  const opacity16 = paintOpacityAt(16);

  // fadeOut.duration=3 over a 17-frame clip: active on local 14..16.
  // local 15 (global 15): framesFromEnd = 1 → t = 1/3.
  // local 16 (global 16): framesFromEnd = 0 → t = 0 → opacity 0.
  expect(opacity16).not.toBeNull();
  expect(opacity16).toBeCloseTo(0, 5);
  expect(opacity15).not.toBeNull();
  expect(opacity15!).toBeGreaterThan(0);
  expect(opacity15!).toBeLessThan(1);

  // MEASURED I-6 verdict: renderFrame IS called for paint on frame 16 (the
  // layer is in range) but with fade opacity 0 — the fade ramp does reach 0
  // exactly on the clip's last frame as coded. A visible paint-on-black on
  // the true last frame would therefore require a different fade object /
  // duration / solid mode than this repro's fade-out ending at tick 17.
});
