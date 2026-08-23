import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultTransform, type Layer } from '../types/layer';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES, type PhysicPaintRotoCacheFrame } from '../types/physicPaint';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore } from '../stores/physicPaintStore';
import { projectStore } from '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  applyPhysicPaintPayload,
  getPhysicPaintRotoAuthority,
  installPhysicPaintRotoAuthorityListener,
  PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT,
  PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT,
} from './physicPaintBridge';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
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

const frame = (sourceFrame: number, dataUrl = `data:image/png;base64,${sourceFrame}`) => ({ frameIndex: 0, appFrame: sourceFrame, sourceFrame, dataUrl, source: 'real-key' as const, width: 10, height: 10 });
const layer = (): Layer => ({ id: 'layer-1', name: 'Physics Paint', type: 'physic-paint', visible: true, opacity: 1, blendMode: 'normal', transform: defaultTransform(), source: { type: 'physic-paint', layerId: 'layer-1' } });

const UNTOUCHED_DATA_URL = `data:image/png;base64,${btoa('untouched')}`;

/** Seed the canonical physical real-key document the parent authority reads. */
function seedPhysicalRecords(keys: Array<{ keyId: string; appFrame: number; dataUrl: string }>): void {
  const records = keys.map((key) => ({
    keyId: key.keyId,
    appFrame: key.appFrame,
    kind: 'real-key' as const,
    payload: { frameIndex: 0, appFrame: key.appFrame, dataUrl: key.dataUrl, width: 10, height: 10 },
  }));
  const interpolation = { enabled: false, mode: 'duplicate' as const };
  const result = physicPaintStore.replaceRotoPhysicalDocument('layer-1', TEST_TRACK_ID, {
    capacity: 600,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, []),
  });
  if (!result.ok) throw new Error(result.error);
}

function installProject() {
  const candidate = layer();
  vi.spyOn(layerStore.layers, 'peek').mockReturnValue([candidate]);
  vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([]);
  vi.spyOn(projectStore.projectContextId, 'peek').mockReturnValue('11111111-1111-4111-8111-111111111111');
  sequenceStore.add({ id: 'seq-1', kind: 'fx', name: 'FX', fps: 24, width: 100, height: 100, keyPhotos: [], layers: [candidate], inFrame: 0, outFrame: 10 });
  return candidate;
}

function batch(overrides: Record<string, unknown> = {}) {
  const authority = getPhysicPaintRotoAuthority({ operationId: 'revision', projectContextId: '11111111-1111-4111-8111-111111111111', layerId: 'layer-1', canonicalStart: 4, trackId: TEST_TRACK_ID });
  if (!authority.ok || authority.frames.length === 0) throw new Error('authority must expose the seeded physical keys');
  return {
    kind: 'replace-roto-key-frames'as const, trackId: TEST_TRACK_ID, operationId: `commit-${crypto.randomUUID()}`, projectContextId: '11111111-1111-4111-8111-111111111111', layerId: 'layer-1', startFrame: 4,
    frameCount: 2, expectedLayerEndExclusive: 600, expectedRotoRevision: authority.rotoRevision,
    frames: [authority.frames[0], frame(4, 'data:image/png;base64,new-4'), frame(5, 'data:image/png;base64,new-5')],
    rotoBackground: { background: 'canvas2' as const, paperGrain: 'canvas3', grainStrength: 0.65 },
    rotoInterpolationSettings: { enabled: true, inBetweenCount: 1, mode: 'duplicate' as const, deform: 0, position: 0 },
    ...overrides,
  };
}

describe('Play Script parent authority and complete-set bridge', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerDocument(makeTrackDocument('layer-1'));
    sequenceStore.sequences.value = [];
    installProject();
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 1, frame(1, UNTOUCHED_DATA_URL));
    seedPhysicalRecords([{ keyId: 'key-1', appFrame: 1, dataUrl: UNTOUCHED_DATA_URL }]);
  });
  afterEach(() => { vi.restoreAllMocks(); physicPaintStore.reset(); sequenceStore.sequences.value = []; resetEfxPaintStore(); vi.unstubAllGlobals(); });

  it('returns current operation-correlated capacity, real keys, and revision', () => {
    const result = getPhysicPaintRotoAuthority({ operationId: 'authority-1', projectContextId: '11111111-1111-4111-8111-111111111111', layerId: 'layer-1', canonicalStart: 4, trackId: TEST_TRACK_ID });
    // 43.4 defect 1: the authority remaining is the child document capacity,
    // never the stale main-editor display outFrame (10 here).
    expect(result).toMatchObject({ operationId: 'authority-1', ok: true, canonicalStart: 4, layerEndExclusive: 600, capacity: 596, projectContextId: '11111111-1111-4111-8111-111111111111', layerId: 'layer-1' });
    expect(result.rotoRevision).not.toBe('');
    expect(result.frames).toEqual([expect.objectContaining({ appFrame: 1, source: 'real-key' })]);
  });

  it('authorizes canonical source ownership when the same numbered display frame is generated', () => {
    physicPaintStore.upsertRealRotoKeyFrame('layer-1', TEST_TRACK_ID, 0, frame(0));
    physicPaintStore.setRotoInterpolationSettings('layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 });

    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 1)).toMatchObject({ appFrame: 1, source: 'generated-interpolation' });
    expect(physicPaintStore.getRotoFrame('layer-1', TEST_TRACK_ID, 3)).toMatchObject({ appFrame: 3, sourceFrame: 1, source: 'real-key' });
    expect(getPhysicPaintRotoAuthority({ operationId: 'canonical-source-1', projectContextId: '11111111-1111-4111-8111-111111111111', layerId: 'layer-1', canonicalStart: 1, trackId: TEST_TRACK_ID })).toMatchObject({ ok: true, canonicalStart: 1 });
  });

  it('fails closed without positive remaining sequence capacity and caps large valid ranges', () => {
    const authority = (operationId: string, canonicalStart: number) => getPhysicPaintRotoAuthority({
      operationId,
      projectContextId: '11111111-1111-4111-8111-111111111111',
      layerId: 'layer-1',
      canonicalStart,
      trackId: TEST_TRACK_ID,
    });

    sequenceStore.sequences.value = [];
    expect(authority('missing-sequence', 4)).toMatchObject({ ok: false, capacity: 0 });

    sequenceStore.add({ id: 'seq-no-boundary', kind: 'fx', name: 'FX', fps: 24, width: 100, height: 100, keyPhotos: [], layers: [layer()], inFrame: 0 });
    expect(authority('missing-boundary', 4)).toMatchObject({ ok: false, capacity: 0 });

    sequenceStore.sequences.value = [];
    sequenceStore.add({ id: 'seq-boundary', kind: 'fx', name: 'FX', fps: 24, width: 100, height: 100, keyPhotos: [], layers: [layer()], inFrame: 0, outFrame: 10 });
    // 43.4 defect 1: a start at or past the stale display outFrame is genuine
    // free space under the child document's capacity authority — it no longer
    // fails closed.
    expect(authority('at-boundary', 10)).toMatchObject({ ok: true, capacity: PHYSIC_PAINT_MAX_APPLY_FRAMES - 10, layerEndExclusive: PHYSIC_PAINT_MAX_APPLY_FRAMES });
    expect(authority('beyond-boundary', 11)).toMatchObject({ ok: true, capacity: PHYSIC_PAINT_MAX_APPLY_FRAMES - 11, layerEndExclusive: PHYSIC_PAINT_MAX_APPLY_FRAMES });

    sequenceStore.sequences.value = [];
    sequenceStore.add({ id: 'seq-large', kind: 'fx', name: 'FX', fps: 24, width: 100, height: 100, keyPhotos: [], layers: [layer()], inFrame: 0, outFrame: PHYSIC_PAINT_MAX_APPLY_FRAMES + 100 });
    expect(authority('large-valid-range', 4)).toMatchObject({ ok: true, capacity: PHYSIC_PAINT_MAX_APPLY_FRAMES - 4, layerEndExclusive: PHYSIC_PAINT_MAX_APPLY_FRAMES });
  });

  it('rejects stale project, generated display mutations, stale revisions, duplicate, incomplete, and over-capacity batches', () => {
    expect(getPhysicPaintRotoAuthority({ operationId: 'wrong-project', projectContextId: 'other', layerId: 'layer-1', canonicalStart: 4, trackId: TEST_TRACK_ID }).ok).toBe(false);
    physicPaintStore.replaceGeneratedRotoCache('layer-1', TEST_TRACK_ID, [{ ...frame(4), source: 'generated-interpolation', nearestRealKeyFrame: 1 }]);
    expect(applyPhysicPaintPayload({ kind: 'delete-roto-frame', trackId: TEST_TRACK_ID, operationId: 'generated-display-delete', layerId: 'layer-1', startFrame: 4 })).toMatchObject({ ok: false });
    physicPaintStore.replaceGeneratedRotoCache('layer-1', TEST_TRACK_ID, []);
    expect(applyPhysicPaintPayload(batch({ expectedRotoRevision: 'stale' }))).toMatchObject({ ok: false });
    expect(applyPhysicPaintPayload(batch({ frames: [frame(1), frame(4), frame(4)] }))).toMatchObject({ ok: false, error: 'Play Script batch contains duplicate real keys.' });
    expect(applyPhysicPaintPayload(batch({ frames: [frame(1), frame(4)] }))).toMatchObject({ ok: false, error: 'Play Script batch is incomplete.' });
    expect(applyPhysicPaintPayload(batch({ frameCount: PHYSIC_PAINT_MAX_APPLY_FRAMES }))).toMatchObject({ ok: false, error: 'Play Script exceeds the current layer capacity.' });
  });

  it('rejects omission, modification, and injection outside the affected destination range', () => {
    seedPhysicalRecords([
      { keyId: 'key-1', appFrame: 1, dataUrl: UNTOUCHED_DATA_URL },
      { keyId: 'key-20', appFrame: 20, dataUrl: `data:image/png;base64,${btoa('far-key')}` },
    ]);
    const frameSource = (candidate: PhysicPaintRotoCacheFrame) => candidate.sourceFrame ?? candidate.appFrame;
    const authority = getPhysicPaintRotoAuthority({ operationId: 'complete-set', projectContextId: '11111111-1111-4111-8111-111111111111', layerId: 'layer-1', canonicalStart: 4, trackId: TEST_TRACK_ID });
    const untouchedFarKey = authority.frames.find((candidate) => frameSource(candidate) === 20);
    if (!untouchedFarKey || !authority.frames[0]) throw new Error('authority must expose the seeded physical keys');
    const base = { expectedRotoRevision: authority.rotoRevision, frames: [authority.frames[0], frame(4, 'data:image/png;base64,new-4'), frame(5, 'data:image/png;base64,new-5'), untouchedFarKey] };

    expect(applyPhysicPaintPayload(batch({ ...base, frames: base.frames.filter((candidate) => frameSource(candidate) !== 20) }))).toMatchObject({ ok: false, error: 'Play Script batch changed or omitted an unrelated real key.' });
    expect(applyPhysicPaintPayload(batch({ ...base, frames: base.frames.map((candidate) => frameSource(candidate) === 20 ? { ...candidate, dataUrl: 'data:image/png;base64,changed' } : candidate) }))).toMatchObject({ ok: false, error: 'Play Script batch changed or omitted an unrelated real key.' });
    expect(applyPhysicPaintPayload(batch({ ...base, frames: base.frames.map((candidate) => frameSource(candidate) === 20 ? { ...candidate, onionDataUrl: 'data:image/png;base64,changed-onion' } : candidate) }))).toMatchObject({ ok: false, error: 'Play Script batch changed or omitted an unrelated real key.' });
    expect(applyPhysicPaintPayload(batch({ ...base, frames: base.frames.map((candidate) => frameSource(candidate) === 20 ? { ...candidate, sourceFrame: 21, appFrame: 21 } : candidate) }))).toMatchObject({ ok: false, error: 'Play Script batch changed or omitted an unrelated real key.' });
    expect(applyPhysicPaintPayload(batch({ ...base, frames: [...base.frames, frame(30, 'data:image/png;base64,injected')] }))).toMatchObject({ ok: false, error: 'Play Script batch contains an unexpected out-of-range real key.' });
    expect(applyPhysicPaintPayload(batch(base))).toMatchObject({ ok: true, appliedFrameCount: 4 });
  });

  it('returns the original result for an exact retry and rejects altered operation ID collisions', () => {
    const operationId = 'stable-operation-id';
    const original = batch({ operationId });
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoKeyFrames');
    const first = applyPhysicPaintPayload(original);
    const retry = applyPhysicPaintPayload(original);

    expect(first).toMatchObject({ ok: true, operationId, appliedFrameCount: 3 });
    expect(retry).toEqual(first);
    expect(replace).toHaveBeenCalledOnce();
    expect(applyPhysicPaintPayload({ ...original, frames: original.frames.map((candidate) => candidate.sourceFrame === 4 ? { ...candidate, dataUrl: 'data:image/png;base64,collision' } : candidate) })).toMatchObject({ ok: false, error: 'Operation ID was already used for a different payload.' });
    expect(applyPhysicPaintPayload({ ...original, layerId: 'other-layer' })).toMatchObject({ ok: false, error: 'Operation ID was already used for a different payload.' });
    expect(applyPhysicPaintPayload({ ...original, startFrame: 3 })).toMatchObject({ ok: false, error: 'Operation ID was already used for a different payload.' });
    expect(applyPhysicPaintPayload({ kind: 'delete-roto-frame', trackId: TEST_TRACK_ID, operationId, layerId: 'layer-1', startFrame: 4 })).toMatchObject({ ok: false, error: 'Operation ID was already used for a different payload.' });
    expect(replace).toHaveBeenCalledOnce();
  });

  it('replaces the whole real-key set, retains untouched keys, regenerates once, and persists background', () => {
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoKeyFrames');
    const result = applyPhysicPaintPayload(batch());
    expect(result).toMatchObject({ ok: true, kind: 'replace-roto-key-frames', appliedFrameCount: 3 });
    expect(replace).toHaveBeenCalledOnce();
    expect(physicPaintStore.getRealRotoKeyFrames('layer-1', TEST_TRACK_ID)).toEqual([1, 4, 5]);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    expect(physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID).rotoPhysical?.background).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
    expect(physicPaintStore.getRotoCacheFrames('layer-1', TEST_TRACK_ID).filter((candidate) => candidate.source === 'generated-interpolation')).toHaveLength(2);
  });

  it('keeps transparent background transparent through batch persistence', () => {
    const transparent = { background: 'transparent' as const, paperGrain: 'canvas1', grainStrength: 0 };
    expect(applyPhysicPaintPayload(batch({ rotoBackground: transparent })).ok).toBe(true);
    expect(physicPaintStore.getRotoBackgroundMetadata('layer-1', TEST_TRACK_ID)).toEqual(transparent);
    expect(physicPaintStore.extractRuntimeStateForDocument('layer-1', TEST_TRACK_ID).rotoPhysical?.background).toEqual(transparent);
  });

  it('installs the browser parent authority listener and replies to the correlated child source', async () => {
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal('window', { location: { origin: 'http://localhost' }, addEventListener: vi.fn((name: string, listener: EventListener) => listeners.set(name, listener)), removeEventListener: vi.fn((name: string) => listeners.delete(name)) });
    const cleanup = await installPhysicPaintRotoAuthorityListener();
    const postMessage = vi.fn();
    listeners.get('message')?.({ origin: 'http://localhost', source: { postMessage }, data: { type: PHYSIC_PAINT_ROTO_AUTHORITY_REQUEST_EVENT, payload: { operationId: 'message-1', projectContextId: '11111111-1111-4111-8111-111111111111', layerId: 'layer-1', canonicalStart: 4, trackId: TEST_TRACK_ID } } } as unknown as Event);
    await vi.waitFor(() => expect(postMessage).toHaveBeenCalledWith({ type: PHYSIC_PAINT_ROTO_AUTHORITY_RESULT_EVENT, payload: expect.objectContaining({ operationId: 'message-1', ok: true }) }, 'http://localhost'));
    cleanup(); expect(listeners.has('message')).toBe(false);
  });
});
