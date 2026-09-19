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
//     todo contracts per the quick's binding escalation clause.
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
import {
  renderGlobalFrame as renderGlobalFrameMock,
  renderFrameWithMotionBlur as renderFrameWithMotionBlurMock,
} from './exportRenderer';

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

  // --- Reinstated RED contracts (260919-azh verdict: NEVER-WIRED) ------------
  //
  // On 2026-09-19 both cases failed exactly as written (C: frameMap [] length 0
  // vs expected 5; D: status 'error' with 'No frames to export (timeline is
  // empty)' vs expected 'complete') while every runtime probe passed —
  // getRotoRealKeyRecords = 5 records, getRotoPhysicalEndFrame = 5,
  // document.activeTrackId = 'track-1' — exonerating the 52.2 reference-only
  // document hypothesis. No existing read returned wrong data; the paint-only
  // enumeration branch was never designed (frameMap.ts:16-47 materializes
  // FrameEntry objects only from content keyPhotos; the tail pad at :42-45 can
  // only replicate an existing content entry).
  //
  // 2026-09-19: reinstated as active `it` contracts under Phase 52.3 plan 01
  // per D-01..D-10 — the FrameEntry discriminated union (D-01), the paint
  // enumeration branch (D-04/D-05), and the D-06 canvas clear turn them green.
  it('Case C — paint-only export enumeration (frameMap materializes physic-paint frames without a content sequence)', () => {
    // fx physic-paint sequence inFrame 0 / outFrame 5 with runtime real keys at
    // appFrames 0..4 and NO content sequence anywhere (outFrame 5 and roto end
    // 5 agree, so N=5 is unambiguous).
    sequenceStore.sequences.value = [makeFxPaintSequence('fx-c', LAYER, 0, 5)];
    installRotoDocument(LAYER, [0, 1, 2, 3, 4]);

    expect(frameMap.value).toHaveLength(5);
  });

  it('Case D — paint-only export completes with N rendered frames (FrameEntry ownership + canvas-clear lifecycle)', async () => {
    // Same arrange as Case C.
    sequenceStore.sequences.value = [makeFxPaintSequence('fx-d', LAYER, 0, 5)];
    installRotoDocument(LAYER, [0, 1, 2, 3, 4]);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(5);
    expect(exportStore.progress.peek().errorMessage).not.toBe('No frames to export (timeline is empty)');
  });

  it('Case E (D-08): selectedSequenceOnly with an active FX sequence exports that sequence’s paint entries to completion', async () => {
    // Re-pinned under Phase 52.3 (D-08): paint-only arrange — the fx sequence’s
    // paint-kind entries carry its sequenceId, so the existing
    // fm.filter(e => e.sequenceId === activeId) predicate now matches them.
    sequenceStore.sequences.value = [makeFxPaintSequence('fx-e', LAYER, 0, 5)];
    installRotoDocument(LAYER, [0, 1, 2, 3, 4]);
    sequenceStore.activeSequenceId.value = 'fx-e';
    exportStore.setSelectedSequenceOnly(true);

    await startExport();

    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderGlobalFrameMock).toHaveBeenCalledTimes(5);
    expect(frameMap.value.filter((e) => e.sequenceId === 'fx-e')).toHaveLength(5);
  });

  it('Case E2 (D-02/D-03 characterization): a mixed project with fx active + selectedSequenceOnly still refuses with the locked copy', async () => {
    // ORIGINAL mixed arrange preserved (Pitfall 4: amend, never delete). D-02
    // keeps content winning per frame and D-03 keeps the tail-pad hold, so in a
    // mixed project every entry is content-owned by content-e and the D-08
    // filter (the existing sequenceId predicate, unchanged) matches zero
    // entries for fx-e — the refusal stays reachable here by design.
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

    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe('No frames to export (timeline is empty)');
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
  });

  it('D-10 negative: a genuinely empty timeline (no content AND no paint) still refuses with the locked copy', async () => {
    sequenceStore.sequences.value = [];

    await startExport();

    expect(exportStore.progress.peek().status).toBe('error');
    expect(exportStore.progress.peek().errorMessage).toBe('No frames to export (timeline is empty)');
    expect(renderGlobalFrameMock).not.toHaveBeenCalled();
  });

  it('Case D (motion-blur variant): paint-only export completes through the motion-blur render path', async () => {
    // Pitfall 6 pin: motion blur sub-frames floor to the same dense entry and
    // the D-06 clear stays gated on !hasContentEntry, so a blurred paint-only
    // export completes with one motion-blur call per frame.
    sequenceStore.sequences.value = [makeFxPaintSequence('fx-d-mb', LAYER, 0, 5)];
    installRotoDocument(LAYER, [0, 1, 2, 3, 4]);
    exportStore.motionBlurEnabled.value = true;

    await startExport();

    expect(exportStore.progress.peek().status).toBe('complete');
    expect(renderFrameWithMotionBlurMock).toHaveBeenCalledTimes(5);
  });
});
