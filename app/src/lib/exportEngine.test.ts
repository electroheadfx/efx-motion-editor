import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from '../stores/physicPaintStore';
import { registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument, InternalPaintTrack } from '../efx-paint/document/efxPaintDocument';
import { exportStore } from '../stores/exportStore';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyPayload,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { defaultTransform, type Layer } from '../types/layer';
import type { Sequence } from '../types/sequence';
import type { FrameEntry } from '../types/timeline';

// 48-03 Task 3 (CMP-05): the export preflight (findUnresolvedExportLoop) must
// scan ALL participating Paint tracks per the 48-01 truth table — no longer
// only the document's activeTrackId — so an unresolvable Hold loop on a visible
// non-active track still blocks export with the locked error message, while
// hidden tracks and tracks excluded by a solo never false-block. Node env,
// vitest run only; no jsdom, no config changes. The physic-paint store is real;
// Tauri IPC, the frameMap signal, and the surrounding stores are mocked (same
// discipline as exportEngine.loops.test.ts).

const hoisted = vi.hoisted(() => ({
  fm: [] as FrameEntry[],
  sequences: [] as Sequence[],
  activeSequenceId: 'seq-1',
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
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
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

import { startExport } from './exportEngine';
import {
  renderGlobalFrame as renderGlobalFrameMock,
  renderFrameWithMotionBlur as renderFrameWithMotionBlurMock,
  preloadExportImages as preloadExportImagesMock,
} from './exportRenderer';
import { exportCreateDir as exportCreateDirMock } from './ipc';

// --- Minimal canvas harness (same discipline as exportEngine.loops.test.ts) ---

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

// --- Store fixtures (same discipline as physicPaintStore.rotoLoopClips.test.ts) ---

const LAYER = 'roto-preflight-layer';
const CAPACITY = 30;
const INTERPOLATION = { enabled: false, mode: 'duplicate' } as const;

function payload(appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyPayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: `data:image/png;base64,${btoa(`preflight:${appFrame}:${tag}`)}`,
    width: 4,
    height: 3,
  };
}

function record(keyId: string, appFrame: number, tag = 'base'): PhysicPaintRotoRealKeyRecord {
  return { kind: 'real-key', keyId, appFrame, payload: payload(appFrame, tag) };
}

function loopClip(
  loopId: string,
  placementStart: number,
  sourceKeyIds: readonly string[],
  repeat: number | 'infinity',
): PhysicPaintRotoLoopClip {
  return { loopId, placementStart, sourceKeyIds, repeat, mode: 'progressive' };
}

function install(
  trackId: string,
  records: readonly PhysicPaintRotoRealKeyRecord[],
  loops: readonly PhysicPaintRotoLoopClip[],
  capacity = CAPACITY,
): void {
  const recordsResult = physicPaintStore.replaceRotoPhysicalRecords(LAYER, trackId, records, INTERPOLATION, capacity);
  if (!recordsResult.ok) throw new Error(recordsResult.error);
  const loopsResult = physicPaintStore.replaceRotoPhysicalLoopClips(LAYER, trackId, loops);
  if (!loopsResult.ok) throw new Error(loopsResult.error);
}

// --- Two-track document fixtures (48-03: the preflight scans participating tracks) ---

function makeTrack(id: string, order: number, overrides: Partial<InternalPaintTrack> = {}): InternalPaintTrack {
  return {
    id,
    name: id,
    order,
    visible: true,
    solo: false,
    opacity: 1,
    blendMode: 'normal' as const,
    revision: 0,
    frames: {},
    rotoPhysical: null,
    loopClips: [],
    ...overrides,
  };
}

function makeTwoTrackDocument(
  layerId: string,
  trackA: Partial<InternalPaintTrack> = {},
  trackB: Partial<InternalPaintTrack> = {},
): EfxPaintDocument {
  const base = createEfxPaintDocument(layerId);
  return {
    ...base,
    activeTrackId: 'track-1',
    tracks: [makeTrack('track-1', 0, trackA), makeTrack('track-2', 1, trackB)],
  } as unknown as EfxPaintDocument;
}

function makeRotoLayer(): Layer {
  return {
    id: LAYER,
    name: 'Roto',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: LAYER },
  };
}

function makeSequence(layers: Layer[]): Sequence {
  return {
    id: 'seq-1',
    kind: 'content',
    name: 'Seq',
    fps: 24,
    width: 4,
    height: 3,
    keyPhotos: [],
    layers,
  };
}

function makeFm(count: number): FrameEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    globalFrame: index,
    sequenceId: 'seq-1',
    keyPhotoId: 'kp',
    imageId: '',
    localFrame: index,
  }));
}

beforeEach(() => {
  _setPhysicPaintMarkDirtyCallback(() => {});
  physicPaintStore.reset();
  resetEfxPaintStore();
  exportStore.resetProgress();
  exportStore.outputFolder.value = '/tmp/efx-export-preflight';
  exportStore.includeAudio.value = false;
  exportStore.selectedSequenceOnly.value = false;
  exportStore.motionBlurEnabled.value = false;
  exportStore.format.value = 'png';
  hoisted.fm = [];
  hoisted.sequences = [makeSequence([makeRotoLayer()])];
  hoisted.activeSequenceId = 'seq-1';
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

describe('export preflight scans all participating tracks (48-03, CMP-05)', () => {
  it('blocks when a visible NON-active track holds an unresolvable Hold loop in the export range', async () => {
    registerDocument(makeTwoTrackDocument(LAYER));
    install('track-1', [record('A0', 0)], []);
    // Track B (track-2) is visible but NOT the active track; its unresolvable
    // loop [10, 14) over cycle [A, missing-1] must still block export.
    install('track-2', [record('A', 0)], [loopClip('loop-b', 10, ['A', 'missing-1'], 2)]);
    hoisted.fm = makeFm(16);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe(
      'Export blocked — Group at frame 10 references a missing source frame (11). Repair or unlink the Group, then export again.',
    );
    expect(exportCreateDirMock).not.toHaveBeenCalled();
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
    expect(renderFrameWithMotionBlurMock).not.toHaveBeenCalled();
    expect(preloadExportImagesMock).not.toHaveBeenCalled();
  });

  it('does not block on a hidden track’s unresolvable loop (scan set equals participating set)', async () => {
    registerDocument(makeTwoTrackDocument(LAYER, {}, { visible: false }));
    install('track-1', [record('A0', 0)], []);
    install('track-2', [record('A', 0)], [loopClip('loop-b', 10, ['A', 'missing-1'], 2)]);
    hoisted.fm = makeFm(16);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(16);
  });

  it('solo narrows the scan to the soloed visible track (a visible-not-soloed track cannot block)', async () => {
    registerDocument(makeTwoTrackDocument(LAYER, { solo: true }, { visible: true, solo: false }));
    install('track-1', [record('A0', 0)], []);
    install('track-2', [record('A', 0)], [loopClip('loop-b', 10, ['A', 'missing-1'], 2)]);
    hoisted.fm = makeFm(16);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(16);
  });

  it('preserves the locked error copy and earliest-global ordering across participating tracks', async () => {
    registerDocument(makeTwoTrackDocument(LAYER));
    // Active track holds the earliest unresolvable loop; the non-active track
    // holds a later one. The preflight names the earliest global placement and
    // keeps the pre-change locked message copy byte-identical.
    install('track-1', [record('A', 0)], [loopClip('loop-early', 6, ['A', 'missing-early'], 2)]);
    install('track-2', [record('B0', 0)], [loopClip('loop-late', 20, ['B0', 'missing-late'], 2)]);
    hoisted.fm = makeFm(30);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe(
      'Export blocked — Group at frame 6 references a missing source frame (7). Repair or unlink the Group, then export again.',
    );
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
  });
});

describe('exportEngine', () => {
  describe('formatFrameFilename', () => {
    it.todo('zero-pads frame number to 4 digits by default');
    it.todo('uses more digits when totalFrames >= 10000');
    it.todo('sanitizes project name (replaces special chars with _)');
    it.todo('applies naming pattern correctly');
  });

  describe('startExport', () => {
    it.todo('returns error when no output folder selected');
    it.todo('returns error when timeline is empty');
    it.todo('updates progress status through lifecycle');
    it.todo('respects cancel signal between frames');
  });

  describe('resumeExport', () => {
    it.todo('starts from resumeFromFrame when available');
  });
});
