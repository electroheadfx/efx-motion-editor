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

// frame-model-coherence (2026-10-12) — AUTOMATED EXPORT FRAME-LIST MEASUREMENT.
//
// Measurement only, NO fix code. Asserts the export's frame LIST (count +
// per-frame layer presence) for the release-blocker repro:
//   16-frame .mov content-overlay (outFrame=16 exclusive) + Studio physic-paint
//   FX (outFrame=17 exclusive, fade-out ending at the clip end) -> N=17,
//   17 frames 0..16; frame 15 = video+paint; frame 16 = paint only (video
//   gated at its exclusive outFrame). Also measures the I-6 fade-opacity
//   sub-finding: paint opacity on the last frame given fade-out reaches 0.
//
// Harness discipline: real frameMap (N law), real sequenceStore, real
// exportRenderer.renderGlobalFrame (the overlay gate under measurement).
// Tauri IPC and the surrounding stores are mocked; PreviewRenderer is a
// recording stub passed into renderGlobalFrame — layer presence is the set of
// layers handed to renderFrame per frame. Node env, vitest run only.

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
// layers + opacity so per-frame layer presence and fade opacity are measurable
// without a real canvas draw.

interface RecordedRender {
  layerIds: string[];
  layerTypes: string[];
  opacity: number;
  clearCanvas: boolean;
  globalFrame: number;
  physicPaintFrame: number;
}

function makeRecordingRenderer(): {
  renderFrame: (...args: unknown[]) => void;
  calls: RecordedRender[];
} {
  const calls: RecordedRender[] = [];
  return {
    calls,
    renderFrame(
      layers: Layer[],
      _frame: number,
      _frames: FrameEntry[],
      _fps: number,
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

/** Video content-overlay covering [0, 16) — outFrame exclusive. */
function makeVideoOverlaySequence(): Sequence {
  return {
    id: 'video-overlay',
    name: 'HyperEspaceSUPP',
    kind: 'content-overlay',
    fps: 24,
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makeVideoLayer()],
    inFrame: 0,
    outFrame: 16,
  };
}

/** Studio physic-paint FX covering [0, 17) — fade-out ends at the clip end (tick 17). */
function makePaintFxSequence(): Sequence {
  return {
    id: 'paint-fx',
    name: 'Studio Paint',
    kind: 'fx',
    fps: 24,
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makePhysicPaintLayer(LAYER)],
    inFrame: 0,
    outFrame: 17,
    fadeOut: { type: 'fade-out', duration: 3, curve: 'linear' },
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
    { id: 'va-1', name: 'HyperEspaceSUPP.mov', path: '/Movies/HyperEspaceSUPP.mov' },
  ];
});

afterEach(() => {
  physicPaintStore.reset();
  resetEfxPaintStore();
  imageStore.videoAssets.value = [];
  vi.unstubAllGlobals();
});

/**
 * Repro arrange: video content-overlay out=16 + paint FX out=17.
 * Roto keys at appFrames 0..16 so the paint is a real render source on every
 * frame of its span (including the tail frame 16).
 */
function arrangeRepro(): void {
  sequenceStore.sequences.value = [makeVideoOverlaySequence(), makePaintFxSequence()];
  installRotoDocument(LAYER, Array.from({ length: 17 }, (_, i) => i));
}

describe('export frame-LIST measurement (frame-model-coherence)', () => {
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

  it('frame LIST: 17 frames; frames 0/1/15 = video+paint; frame 16 = paint only (video gated)', () => {
    arrangeRepro();
    const fm = frameMap.value;
    const seqs = sequenceStore.sequences.value;
    expect(fm).toHaveLength(17);

    const recorder = makeRecordingRenderer();
    const canvas = new TestCanvas() as unknown as HTMLCanvasElement;

    // Drive the export loop's render call for every frame the export writes.
    for (let frame = 0; frame < fm.length; frame++) {
      renderGlobalFrame(
        recorder as never,
        canvas,
        frame,
        fm,
        seqs,
        [],
        false,
      );
    }

    // --- MEASURED per-frame layer presence ---------------------------------
    // Presence = which layers were handed to renderFrame while rendering that
    // global frame. The overlay pass runs one renderFrame per surviving overlay.
    const presenceFor = (globalFrame: number) => {
      const calls = recorder.calls.filter((c) => c.globalFrame === globalFrame);
      const ids = new Set<string>();
      const types = new Set<string>();
      for (const call of calls) {
        for (const id of call.layerIds) ids.add(id);
        for (const type of call.layerTypes) types.add(type);
      }
      return { ids, types, calls };
    };

    const f0 = presenceFor(0);
    const f1 = presenceFor(1);
    const f15 = presenceFor(15);
    const f16 = presenceFor(16);

    // First two frames: video + paint.
    expect(f0.ids.has(VIDEO_LAYER_ID)).toBe(true);
    expect(f0.ids.has(LAYER)).toBe(true);
    expect(f1.ids.has(VIDEO_LAYER_ID)).toBe(true);
    expect(f1.ids.has(LAYER)).toBe(true);

    // Frame 15 (last video frame): video + paint.
    expect(f15.ids.has(VIDEO_LAYER_ID)).toBe(true);
    expect(f15.ids.has(LAYER)).toBe(true);

    // Frame 16 (tail): paint ONLY — video gated at outFrame=16 exclusive.
    expect(f16.ids.has(LAYER)).toBe(true);
    expect(f16.ids.has(VIDEO_LAYER_ID)).toBe(false);

    // Every frame in 0..15 must carry the video; only 16 drops it.
    for (let frame = 0; frame <= 15; frame++) {
      expect(presenceFor(frame).ids.has(VIDEO_LAYER_ID), `frame ${frame} should carry video`).toBe(true);
    }
    // Every frame in 0..16 must carry the paint.
    for (let frame = 0; frame <= 16; frame++) {
      expect(presenceFor(frame).ids.has(LAYER), `frame ${frame} should carry paint`).toBe(true);
    }
  });

  it('I-6 sub-finding: paint fade-out reaches opacity 0 on the clip’s last frame (index 16)', () => {
    arrangeRepro();
    const fm = frameMap.value;
    const seqs = sequenceStore.sequences.value;

    const recorder = makeRecordingRenderer();
    const canvas = new TestCanvas() as unknown as HTMLCanvasElement;

    for (let frame = 0; frame < fm.length; frame++) {
      renderGlobalFrame(recorder as never, canvas, frame, fm, seqs, [], false);
    }

    // The paint FX render call carries the fade opacity as sequenceOpacity.
    const paintOpacityAt = (globalFrame: number): number | null => {
      const call = recorder.calls.find(
        (c) => c.globalFrame === globalFrame && c.layerIds.includes(LAYER),
      );
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

  it('frame LIST summary (measured values pinned): count 17, indices 0..16, video 0..15, paint 0..16', () => {
    arrangeRepro();
    const fm = frameMap.value;
    const seqs = sequenceStore.sequences.value;
    const recorder = makeRecordingRenderer();
    const canvas = new TestCanvas() as unknown as HTMLCanvasElement;
    for (let frame = 0; frame < fm.length; frame++) {
      renderGlobalFrame(recorder as never, canvas, frame, fm, seqs, [], false);
    }

    const videoFrames: number[] = [];
    const paintFrames: number[] = [];
    for (let frame = 0; frame < fm.length; frame++) {
      const calls = recorder.calls.filter((c) => c.globalFrame === frame);
      const ids = new Set(calls.flatMap((c) => c.layerIds));
      if (ids.has(VIDEO_LAYER_ID)) videoFrames.push(frame);
      if (ids.has(LAYER)) paintFrames.push(frame);
    }

    // MEASURED vs PREDICTED — the frame LIST itself.
    expect(fm).toHaveLength(17);
    expect(videoFrames).toEqual(Array.from({ length: 16 }, (_, i) => i)); // 0..15
    expect(paintFrames).toEqual(Array.from({ length: 17 }, (_, i) => i)); // 0..16
  });
});
