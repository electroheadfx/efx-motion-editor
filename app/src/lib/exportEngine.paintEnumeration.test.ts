import { testWebpBytes } from '../testUtils/testWebpBytes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  physicPaintStore,
  _setPhysicPaintMarkDirtyCallback,
} from '../stores/physicPaintStore';
import {
  getDocument as getEfxPaintDocument,
  registerDocument,
  reset as resetEfxPaintStore,
} from '../stores/efxPaintStore';
import { sequenceStore } from '../stores/sequenceStore';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { exportStore } from '../stores/exportStore';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import type {
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { defaultTransform, type Layer } from '../types/layer';
import type { Sequence } from '../types/sequence';

// 260919-azh — paint-export enumeration discrimination matrix.
//
// Phase 53 acceptance blocker: export fails with 'No frames to export
// (timeline is empty)' (exportEngine.ts:152-156) while preview/canvas/timeline
// render the painted content fine. This matrix discriminates the two candidate
// diagnoses:
//   - BROKEN-READ: an existing read returns wrong data at runtime (52.2-era
//     divergence between the reference-only registered document and the
//     byte-carrying runtime projection) — repairable in-quick.
//   - NEVER-WIRED: the paint-only enumeration branch (FrameEntry semantics,
//     range derivation) was never designed — Phase 53 scope; Cases C/D park as
//     it.todo contracts per the quick's binding escalation clause.
//
// Harness discipline: copied verbatim from exportEngine.test.ts (same mocks,
// same TestCanvas stub) with ONE deliberate difference — './frameMap' and
// '../stores/sequenceStore' are NOT mocked: the real computed reading the real
// stores is the subject under test. Node env, vitest run only.

vi.mock('./ipc', () => ({
  exportCreateDir: vi.fn(async () => ({ ok: true as const, data: '/tmp/efx-export-paint-enum' })),
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
    name: { peek: () => 'Paint Enum Export' },
    width: { peek: () => 4, value: 4 },
    height: { peek: () => 3, value: 3 },
    fps: { peek: () => 24 },
  },
}));

vi.mock('../stores/soloStore', () => ({ soloStore: { soloEnabled: { peek: () => false } } }));
vi.mock('../stores/paintStore', () => ({ paintStore: { getFrame: vi.fn(() => null) } }));
vi.mock('./audioEngine', () => ({ audioEngine: { getBuffer: () => null } }));
vi.mock('./exportSidecar', () => ({ generateJsonSidecar: () => '{}', generateFcpxml: () => '' }));
vi.mock('./audioExportMixer', () => ({ renderMixedAudio: vi.fn(async () => new Uint8Array()) }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => ({ label: 'main' }) }));

vi.mock('./exportRenderer', () => ({
  renderGlobalFrame: vi.fn(),
  renderFrameWithMotionBlur: vi.fn(),
  preloadExportImages: vi.fn(async () => {}),
}));

import { startExport } from './exportEngine';
import { frameMap } from './frameMap';
import { renderGlobalFrame as renderGlobalFrameMock } from './exportRenderer';

// --- Minimal canvas harness (copied verbatim from exportEngine.test.ts) ---

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

// --- Store fixtures (shapes reused from frameMap.test.ts) ---

const LAYER = 'paint-enum-layer';
const TEST_TRACK_ID = 'track-1';

function makeTrackDocument(layerId: string): EfxPaintDocument {
  const document = createEfxPaintDocument(layerId);
  const track = document.tracks[0];
  return {
    ...document,
    activeTrackId: TEST_TRACK_ID,
    tracks: [{ ...track, id: TEST_TRACK_ID, frames: {}, rotoPhysical: null, loopClips: [] }],
  };
}

function makeContentSequence(id: string, keyPhotos: any[]): Sequence {
  return {
    id,
    name: id,
    kind: 'content',
    fps: 24,
    width: 4,
    height: 3,
    keyPhotos,
    layers: [],
  } as Sequence;
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

function makeFxPaintSequence(id: string, layerId: string, inFrame: number, outFrame: number): Sequence {
  return {
    id,
    name: id,
    kind: 'fx',
    fps: 24,
    width: 4,
    height: 3,
    keyPhotos: [],
    layers: [makePhysicPaintLayer(layerId)],
    inFrame,
    outFrame,
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
  exportStore.outputFolder.value = '/tmp/efx-export-paint-enum';
  exportStore.includeAudio.value = false;
  exportStore.selectedSequenceOnly.value = false;
  exportStore.motionBlurEnabled.value = false;
  exportStore.format.value = 'png';
});

afterEach(() => {
  physicPaintStore.reset();
  resetEfxPaintStore();
  vi.unstubAllGlobals();
});

describe('paint-export enumeration discrimination (260919-azh)', () => {
  it('Control A (sub-discriminant baseline): a content-only project exports exactly its content frame count', async () => {
    sequenceStore.sequences.value = [
      makeContentSequence('content-a', [
        { id: 'kp-a0', imageId: 'img-a0', holdFrames: 1 },
        { id: 'kp-a1', imageId: 'img-a1', holdFrames: 1 },
        { id: 'kp-a2', imageId: 'img-a2', holdFrames: 1 },
      ]),
    ];

    expect(frameMap.value).toHaveLength(3);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(3);
  });

  it('Control B (wired-leg pin): content + physic-paint FX tail-pads the export to the roto end frame', async () => {
    sequenceStore.sequences.value = [
      makeContentSequence('content-b', [
        { id: 'kp-b0', imageId: 'img-b0', holdFrames: 1 },
        { id: 'kp-b1', imageId: 'img-b1', holdFrames: 1 },
        { id: 'kp-b2', imageId: 'img-b2', holdFrames: 1 },
      ]),
      makeFxPaintSequence('fx-b', LAYER, 0, 3),
    ];
    installRotoDocument(LAYER, [0, 4, 8]);

    // Mirrors frameMap.test.ts:285-346 at the export level: real keys at
    // appFrames 0, 4, 8 extend the required count to 9; tail padding over the
    // content entries materializes the extension.
    expect(frameMap.value).toHaveLength(9);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(9);
  });

  it('Case C (RED contract): a paint-only timeline enumerates its physic-paint frames in frameMap', () => {
    // fx physic-paint sequence inFrame 0 / outFrame 5 with runtime real keys at
    // appFrames 0..4 and NO content sequence anywhere. outFrame 5 and the roto
    // end frame 5 agree, so N=5 is unambiguous.
    sequenceStore.sequences.value = [makeFxPaintSequence('fx-c', LAYER, 0, 5)];
    installRotoDocument(LAYER, [0, 1, 2, 3, 4]);

    // In-test probes (PASS today, self-diagnosing): the runtime reads carry the
    // real keys regardless of the registered document's carrier shape. If any
    // probe fails, the 52.2 runtime-divergence hypothesis is CONFIRMED in-test
    // and the failing probe names the BROKEN-READ site.
    expect(physicPaintStore.getRotoRealKeyRecords(LAYER, TEST_TRACK_ID)).toHaveLength(5);
    expect(physicPaintStore.getRotoPhysicalEndFrame(LAYER, TEST_TRACK_ID)).toBe(5);
    expect(getEfxPaintDocument(LAYER)?.activeTrackId).toBe(TEST_TRACK_ID);

    // RED today: frameMap materializes entries only from content keyPhotos
    // (frameMap.ts:16-47); with zero content entries the tail-padding loop is
    // guarded on tailEntry existing (frameMap.ts:42-45) and never fires, so
    // the computed stays empty even though getTimelineRequiredFrameCount
    // returns 5 (frameMap.ts:244-259).
    expect(frameMap.value).toHaveLength(5);
  });

  it('Case D (RED contract): a paint-only project exports its N physic-paint frames', async () => {
    sequenceStore.sequences.value = [makeFxPaintSequence('fx-d', LAYER, 0, 5)];
    installRotoDocument(LAYER, [0, 1, 2, 3, 4]);

    await startExport();

    // RED today: startExport hard-errors at exportEngine.ts:152-156 because the
    // enumerated frame map is empty (Case C), so status is 'error' with the
    // locked copy instead of 'complete' after 5 rendered frames.
    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(5);
    expect(exportStore.progress.peek().errorMessage).not.toBe('No frames to export (timeline is empty)');
  });

  it('Case E (characterization): selectedSequenceOnly with an active FX sequence filters every frame out', async () => {
    sequenceStore.sequences.value = [
      makeContentSequence('content-e', [
        { id: 'kp-e0', imageId: 'img-e0', holdFrames: 1 },
        { id: 'kp-e1', imageId: 'img-e1', holdFrames: 1 },
        { id: 'kp-e2', imageId: 'img-e2', holdFrames: 1 },
      ]),
      makeFxPaintSequence('fx-e', LAYER, 0, 5),
    ];
    installRotoDocument(LAYER, [0, 1, 2, 3, 4]);
    sequenceStore.activeSequenceId.value = 'fx-e';
    exportStore.setSelectedSequenceOnly(true);

    await startExport();

    // PASSES today: no FrameEntry ever carries the fx sequence id, so the
    // selectedSequenceOnly filter (exportEngine.ts:145-150) empties the map and
    // startExport hard-errors with the locked copy. Characterizes the filter
    // gap without designing its fix (Phase 53).
    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe('No frames to export (timeline is empty)');
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
  });
});
