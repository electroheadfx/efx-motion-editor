import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultTransform, type Layer } from '../types/layer';
import { layerStore } from '../stores/layerStore';
import { physicPaintStore } from '../stores/physicPaintStore';
import { projectStore } from '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';
import { getDocument, registerDocument, reset as resetEfxPaintStore } from '../stores/efxPaintStore';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import { createEfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  buildEfxPaintDocumentRevision,
  buildEfxPaintTrackRevision,
} from '../efx-paint/document/efxPaintDocumentRevision';
import { isPhysicPaintRotoAuthorityRequest } from '../types/physicPaint';
import {
  buildPhysicPaintRotoPhysicalRevision,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import {
  getPhysicPaintRotoAuthority,
  getPhysicPaintRotoAuthorityFromUnknown,
} from './physicPaintBridge';

// 46-04 Task 1: the async PlayScript commit authority is three-dimensional —
// every request/result carries trackId plus the deterministic trackRevision and
// documentRevision; getPhysicPaintRotoAuthority revalidates parent → document →
// track and fails closed at the first mismatch (D-19/D-20, TRK-05).
// Node env, vitest run only; no jsdom, no config changes.

const LAYER = 'authority-layer';
const TRACK_A = 'track-a';
const TRACK_B = 'track-b';

const makePayload = (appFrame: number, tag: string) => ({
  frameIndex: 0,
  appFrame,
  dataUrl: `data:image/png;base64,${btoa(tag)}`,
  width: 4,
  height: 4,
});

const makeRecord = (keyId: string, appFrame: number, tag: string): PhysicPaintRotoRealKeyRecord => ({
  kind: 'real-key',
  keyId,
  appFrame,
  payload: makePayload(appFrame, tag),
});

/** Canonical two-track document (46-03 fixture pattern): A carries the seeded
 *  records when given, B stays empty. */
function makeTwoTrackDocument(
  activeTrackId: string,
  aRecords: readonly PhysicPaintRotoRealKeyRecord[] = [],
): EfxPaintDocument {
  const base = createEfxPaintDocument(LAYER);
  const trackA = Object.freeze({
    ...base.tracks[0],
    id: TRACK_A,
    name: 'Track A',
    order: 0,
    rotoPhysical: Object.freeze({
      capacity: 100,
      realKeyRecords: Object.freeze([...aRecords]),
      interpolation: Object.freeze({ enabled: false, mode: 'duplicate' as const }),
      scriptMotion: Object.freeze({ deformation: 0, position: 0 }),
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(aRecords, { enabled: false, mode: 'duplicate' }, [], []),
      loopClips: Object.freeze([]),
      incomingInterpolationBreakKeyIds: Object.freeze([]),
    }) as PhysicPaintRotoPhysicalDocument,
  });
  const trackB = Object.freeze({
    ...base.tracks[0],
    id: TRACK_B,
    name: 'Track B',
    order: 1,
  });
  return Object.freeze({
    ...base,
    activeTrackId,
    tracks: Object.freeze([trackA, trackB]),
  });
}

function registerTwoTrackDocument(activeTrackId: string, aRecords: readonly PhysicPaintRotoRealKeyRecord[] = []): void {
  registerDocument(makeTwoTrackDocument(activeTrackId, aRecords));
}

const physicLayer = (): Layer => ({
  id: LAYER,
  name: 'Physics Paint',
  type: 'physic-paint',
  visible: true,
  opacity: 1,
  blendMode: 'normal',
  transform: defaultTransform(),
  source: { type: 'physic-paint', layerId: LAYER },
});

function mockParentAuthority(candidate: Layer): void {
  vi.spyOn(layerStore.layers, 'peek').mockReturnValue([candidate]);
  vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([]);
  sequenceStore.sequences.value = [{
    id: 'authority-parent-sequence',
    kind: 'fx',
    name: 'Authority parent',
    fps: 24,
    width: 1920,
    height: 1080,
    keyPhotos: [],
    layers: [candidate],
    inFrame: 0,
    outFrame: 600,
  }];
}

const originalWindow = globalThis.window;

describe('three-dimensional Roto authority (46-04 Task 1)', () => {
  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    Object.defineProperty(globalThis, 'window', {
      value: {
        open: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        location: { origin: 'http://localhost:1420' },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('echoes the requested trackId on success — never the active track', () => {
    // The document's ACTIVE track is B; the request names A and must be honored.
    registerTwoTrackDocument(TRACK_B, [makeRecord('key-a-0', 0, 'a@0')]);
    mockParentAuthority(physicLayer());

    const authority = getPhysicPaintRotoAuthority({
      operationId: 'auth-echo',
      projectContextId: projectStore.projectContextId.peek(),
      layerId: LAYER,
      canonicalStart: 5,
      trackId: TRACK_A,
    });
    expect(authority.ok).toBe(true);
    expect(authority.trackId).toBe(TRACK_A);
    expect(authority.capacity).toBeGreaterThan(0);
  });

  it('fails closed on a foreign trackId — no active-track fallback, no auto-create', () => {
    registerTwoTrackDocument(TRACK_A, [makeRecord('key-a-0', 0, 'a@0')]);
    mockParentAuthority(physicLayer());

    const authority = getPhysicPaintRotoAuthority({
      operationId: 'auth-foreign',
      projectContextId: projectStore.projectContextId.peek(),
      layerId: LAYER,
      canonicalStart: 5,
      trackId: 'foreign-track',
    });
    expect(authority.ok).toBe(false);
    expect(authority.error).toBe('Track is unavailable.');
    expect(authority.capacity).toBe(0);
    expect(authority.physicalCapacity).toBe(0);
    expect(authority.trackId).toBe('foreign-track');
    expect(authority.trackRevision).toBe('');
    // The document was reachable, so the closed failure carries the document term.
    expect(authority.documentRevision).toBe(buildEfxPaintDocumentRevision(getDocument(LAYER)!));
  });

  it('returns deterministic per-track and document revision terms; editing track A moves only A', () => {
    registerTwoTrackDocument(TRACK_A, [makeRecord('key-a-0', 0, 'a@0')]);
    mockParentAuthority(physicLayer());

    const authorityA = () => getPhysicPaintRotoAuthority({
      operationId: 'auth-terms-a',
      projectContextId: projectStore.projectContextId.peek(),
      layerId: LAYER,
      canonicalStart: 5,
      trackId: TRACK_A,
    });
    const authorityB = () => getPhysicPaintRotoAuthority({
      operationId: 'auth-terms-b',
      projectContextId: projectStore.projectContextId.peek(),
      layerId: LAYER,
      canonicalStart: 5,
      trackId: TRACK_B,
    });
    const document = getDocument(LAYER)!;
    const authA = authorityA();
    const authB = authorityB();
    expect(authA.ok).toBe(true);
    expect(authA.trackRevision).toBe(buildEfxPaintTrackRevision(document.tracks.find((track) => track.id === TRACK_A)));
    expect(authA.documentRevision).toBe(buildEfxPaintDocumentRevision(document));
    expect(authB.ok).toBe(true);
    expect(authB.trackRevision).toBe(buildEfxPaintTrackRevision(document.tracks.find((track) => track.id === TRACK_B)));

    // A document-level edit of track A's records changes A's term only.
    registerTwoTrackDocument(TRACK_A, [makeRecord('key-a-1', 1, 'a@1')]);
    const editedA = authorityA();
    const untouchedB = authorityB();
    expect(editedA.trackRevision).not.toBe(authA.trackRevision);
    expect(untouchedB.trackRevision).toBe(authB.trackRevision);
  });

  it('rejects a malformed request (missing or non-string trackId) before store state is touched', () => {
    const base = { operationId: 'auth-malformed', projectContextId: 'project-1', layerId: LAYER, canonicalStart: 0 };
    expect(isPhysicPaintRotoAuthorityRequest({ ...base })).toBe(false);
    expect(isPhysicPaintRotoAuthorityRequest({ ...base, trackId: 42 })).toBe(false);
    expect(isPhysicPaintRotoAuthorityRequest({ ...base, trackId: '   ' })).toBe(false);

    const result = getPhysicPaintRotoAuthorityFromUnknown({ ...base, trackId: 42 });
    expect(result.ok).toBe(false);
    expect(result.capacity).toBe(0);
    expect(result.physicalCapacity).toBe(0);
    expect(result.trackId).toBe('');
    expect(result.trackRevision).toBe('');
    expect(result.documentRevision).toBe('');
    expect(result.error).toBe('Malformed Roto authority request.');
  });

  it('envelope extraction carries a foreign trackId into the closed failure result', () => {
    // Not a valid authority request (extra key) — the FromUnknown path extracts
    // the envelope and must keep the trackId in the closed failure.
    const payload = {
      operationId: 'auth-envelope',
      projectContextId: 'project-1',
      layerId: LAYER,
      canonicalStart: 0,
      trackId: 'foreign-track',
      extraField: true,
    };
    expect(isPhysicPaintRotoAuthorityRequest(payload)).toBe(false);
    const result = getPhysicPaintRotoAuthorityFromUnknown(payload);
    expect(result.ok).toBe(false);
    expect(result.trackId).toBe('foreign-track');
    expect(result.capacity).toBe(0);
    expect(result.error).toBe('Malformed Roto authority request.');
  });
});
