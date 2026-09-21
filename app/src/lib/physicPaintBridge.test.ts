import { testWebpBytes } from '../testUtils/testWebpBytes';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromTransportPayload, toTransportPayload } from './webpBytes';

vi.mock('./webpFrameCodec', () => ({
  decodeWebpFrame: vi.fn(),
  encodeWebpFrame: vi.fn(),
  encodeCanvasAsWebp: vi.fn(async () => {
    const seed = 'transparent-one-pixel';
    const bytes = new Uint8Array(32 + seed.length);
    bytes.set([0x52, 0x49, 0x46, 0x46], 0);
    bytes.set([0x57, 0x45, 0x42, 0x50], 8);
    bytes.set([0x56, 0x50, 0x38, 0x4c], 12);
    for (let index = 0; index < seed.length; index += 1) bytes[32 + index] = seed.charCodeAt(index) & 0xff;
    return bytes;
  }),
}));
import { defaultTransform, type Layer } from '../types/layer';
import type { AudioTrack } from '../types/audio';
import { audioStore } from '../stores/audioStore';
import { layerStore } from '../stores/layerStore';
import {
  getFrameMediaVerdict,
  hasFrameMediaBytes,
  hasRotoAlphaCanvasFrame,
  physicPaintStore,
  physicPaintVersion,
  registerRotoAlphaCanvasFrame,
  rotoPhysicalRevision,
} from '../stores/physicPaintStore';
import { projectStore } from '../stores/projectStore';
import { sequenceStore } from '../stores/sequenceStore';
import type { EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  registerDocument,
  reset as resetEfxPaintStore,
  serializeRuntimeIntoDocument,
} from '../stores/efxPaintStore';
import { timelineStore } from '../stores/timelineStore';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintRotoPhysicalEditIntent } from '../types/physicPaint';
import {
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  buildFrameBytesToken,
  isPhysicPaintApplyResult,
  isPhysicPaintRotoPhysicalEditApplyPayload,
  isPhysicPaintRotoPhysicalEditIntent,
} from '../types/physicPaint';
import {
  PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
  buildPhysicPaintRotoPhysicalRevision,
  buildPhysicPaintRotoProjectEquality,
  requirePhysicPaintRotoInlineBytes,
  parsePhysicPaintRotoPhysicalDocument,
  parsePhysicPaintRotoLoopClips,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { normalizeLoopClipForPayload } from '../components/physic-paint/hooks/useRotoPhysicalEditCoordinator';
import { resolvePhysicPaintRotoPhysicalEdit } from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import {
  proposePhysicPaintRotoActionGroupLifecycle,
  proposePhysicPaintRotoDeleteGroup,
  proposePhysicPaintRotoDeleteGroupFrame,
  proposePhysicPaintRotoDeleteRails,
  proposePhysicPaintRotoGroupFramePaint,
  proposePhysicPaintRotoRegenerateGroup,
} from '../components/physic-paint/roto/physicsPaintRotoGroupLifecycle';
import { proposeRails, type RotoRailSetCopyPayload } from '../components/physic-paint/roto/physicsPaintRotoRailSetCopy';
import { getCarriedRotoPhysical, hydrateRotoPhysicalLaunchContext } from '../components/physic-paint/roto/rotoLaunchHydration';
import { getPhysicsPaintRotoSourceCycleId } from '../components/physic-paint/roto/physicsPaintRotoSpacingSelection';
import { encodeSourceBytesForDocumentSync,
  _setPhysicPaintDocumentSyncFramePorts,
  applyCommittedReferencedActionDeletion,
  applyPhysicPaintPayload,
  awaitPendingPhysicPaintFrameMediaInstalls,
  applyPhysicPaintRotoGroupFramePaint,
  createPhysicPaintLaunchContext,
  deactivatePhysicPaintLaunch,
  expandRotoPhysicalEditRecordRefs,
  getPhysicPaintRotoAuthority,
  handlePhysicPaintFrameSyncMessage,
  installPhysicPaintApplyListener,
  installPhysicPaintAudioContextPublisher,
  installPhysicPaintAudioOwnershipListener,
  installPhysicPaintEfxPaintDocumentListener,
  installPhysicPaintFrameSyncListener,
  isPhysicPaintChildAudioClaimed,
  openPhysicPaintCanvas,
  physicPaintLaunchActive,
  PHYSIC_PAINT_APPLY_EVENT,
  PHYSIC_PAINT_APPLY_RESULT_EVENT,
  PHYSIC_PAINT_AUDIO_CONTEXT_EVENT,
  PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT,
  PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT,
  PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT,
  PHYSIC_PAINT_LAUNCH_EVENT,
  publishPhysicPaintAudioPlaybackState,
  resetPhysicPaintDocumentSyncFrameState,
} from './physicPaintBridge';
// 46-01: runtime state is per-track; tests exercise the document's ACTIVE track.
const TEST_TRACK_ID = 'track-1';

// 46-01: the launch IS the document — build a document whose ACTIVE track is
// the fixed TEST_TRACK_ID so production resolve paths read the same track
// the tests seed runtime state under.
function makeTrackDocument(layerId: string, trackId: string = TEST_TRACK_ID): EfxPaintDocument {
  return {
    version: 1,
    parentLayerId: layerId,
    documentRevision: 0,
    activeTrackId: trackId,
    tracks: [{
      id: trackId,
      name: 'Paint',
      order: 0,
      visible: true,
      solo: false,
      opacity: 1,
      blendMode: 'normal',
      revision: 0,
      frames: {},
      rotoPhysical: null,
      loopClips: [],
    }],
    background: { id: 'background-1', clips: [], fallback: { mode: 'transparent' }, visible: true, revision: 0 },
    photoReference: null,
    compositeRevision: 0,
  };
}

function registerTrackDocument(layerId: string): void {
  registerDocument(makeTrackDocument(layerId));
}

const originalWindow = globalThis.window;

const makeFrame = (frameIndex: number, appFrame: number) => ({
  frameIndex,
  appFrame,
  bytes: testWebpBytes(btoa(`frame-${frameIndex}`)),
  width: 1000,
  height: 650,
});

const makePhysicalRecord = (keyId: string, appFrame: number) => ({
  keyId,
  appFrame,
  kind: 'real-key' as const,
  payload: {
    frameIndex: 0,
    appFrame,
    bytes: testWebpBytes(btoa(`frame-${appFrame}`)),
    width: 1000,
    height: 650,
  },
});

const movePhysicalRecord = (
  record: ReturnType<typeof makePhysicalRecord>,
  appFrame: number,
) => ({
  ...record,
  appFrame,
  payload: { ...record.payload, appFrame },
});

const TRANSPARENT_ONE_PIXEL_WEBP = testWebpBytes('transparent-one-pixel');
const OPAQUE_ONE_PIXEL_WEBP = testWebpBytes('opaque-one-pixel');

function makeEmptySegmentRecord(
  keyId: string,
  appFrame: number,
  bytes = TRANSPARENT_ONE_PIXEL_WEBP,
) {
  return {
    keyId,
    appFrame,
    payload: {
      frameIndex: 0,
      appFrame,
      bytes,
      width: 1,
      height: 1,
    },
  };
}

function seedPhysicalDocument(
  layerId: string,
  records: ReturnType<typeof makePhysicalRecord>[],
  interpolation: { enabled: boolean; mode: 'duplicate' | 'blend' } = { enabled: false, mode: 'duplicate' },
  incomingInterpolationBreakKeyIds: readonly string[] = PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
): void {
  const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, TEST_TRACK_ID, {
    capacity: 600,
    realKeyRecords: records,
    interpolation,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: records[0]?.appFrame ?? 0,
    revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, [], incomingInterpolationBreakKeyIds),
    incomingInterpolationBreakKeyIds,
  });
  if (!result.ok) throw new Error(result.error);
}

function acquirePhysicalLease(
  layerId: string,
  projectContextId: string = projectStore.projectContextId.peek(),
  trackId: string = TEST_TRACK_ID,
) {
  const token = physicPaintStore.acquireRotoPhysicalOperationLease(projectContextId, layerId, trackId);
  if (!token) throw new Error(`Expected physical-operation lease for ${layerId}.`);
  return token;
}

/** The carried v1.0 document's ACTIVE track rotoPhysical (D-03 launch authority). */
function carriedRotoPhysical(context: PhysicPaintLaunchContext): PhysicPaintRotoPhysicalDocument {
  const physical = getCarriedRotoPhysical(context);
  if (!physical) throw new Error('Expected carried physical Roto document.');
  return physical;
}

/** Apply-payload records: the model's realKeyRecords minus the kind member. */
function payloadRecords(physical: PhysicPaintRotoPhysicalDocument) {
  return physical.realKeyRecords.map(({ kind: _kind, ...record }) => record);
}

function installCanonicalBlankCanvas(): void {
  vi.stubGlobal('document', {
    createElement: (tagName: string) => {
      if (tagName.toLowerCase() !== 'canvas') throw new Error(`Unexpected element request: ${tagName}`);
      return {
        width: 0,
        height: 0,
        toDataURL: () => `data:image/webp;base64,${bytesToBase64(TRANSPARENT_ONE_PIXEL_WEBP)}`,
      } as unknown as HTMLCanvasElement;
    },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary);
}



function applyCanvasPayload(overrides: Partial<PhysicPaintApplyPayload> = {}): PhysicPaintApplyPayload {
  return {
    kind: 'apply-canvas',
    trackId: TEST_TRACK_ID,
    operationId: `apply-still-${crypto.randomUUID()}`,
    layerId: 'phys-layer-1',
    startFrame: 8,
    renderedFrame: makeFrame(0, 8),
    ...overrides,
  } as PhysicPaintApplyPayload;
}



function setParentSequence(layers: Layer[], parentEndExclusive: number): void {
  sequenceStore.sequences.value = [{
    id: 'bridge-test-parent-sequence',
    kind: 'fx',
    name: 'Bridge test parent authority',
    fps: 24,
    width: 1920,
    height: 1080,
    keyPhotos: [],
    layers,
    inFrame: 0,
    outFrame: parentEndExclusive,
  }];
}

function mockLayers(layers: Layer[], parentEndExclusive: number | null = 600): void {
  vi.spyOn(layerStore.layers, 'peek').mockReturnValue(layers);
  vi.spyOn(layerStore.overlayLayers, 'peek').mockReturnValue([]);
  if (parentEndExclusive === null) sequenceStore.sequences.value = [];
  else setParentSequence(layers, parentEndExclusive);
}

function physicLayer(overrides: Partial<Layer> = {}): Layer {
  return {
    id: 'phys-layer-1',
    name: 'Physic Paint',
    type: 'physic-paint',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    transform: defaultTransform(),
    source: { type: 'physic-paint', layerId: 'phys-layer-1' },
    ...overrides,
  };
}

function makeAudioTrack(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    id: 'audio-1',
    audioAssetId: 'asset-1',
    name: 'Kick',
    filePath: '/Volumes/media/audio/kick.wav',
    relativePath: 'audio/kick.wav',
    originalFilename: 'kick.wav',
    offsetFrame: 48,
    inFrame: 0,
    outFrame: 240,
    volume: 0.8,
    muted: false,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'exponential',
    fadeOutCurve: 'exponential',
    sampleRate: 48000,
    duration: 10,
    channelCount: 2,
    order: 0,
    trackHeight: 44,
    slipOffset: 0,
    totalFramesInFile: 240,
    bpm: null,
    beatOffsetFrames: 0,
    beatMarkers: [],
    showBeatMarkers: false,
    ...overrides,
  };
}

describe('physicPaintBridge', async () => {
  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    resetPhysicPaintDocumentSyncFrameState();
    _setPhysicPaintDocumentSyncFramePorts(null);
    registerTrackDocument('phys-layer-1');
    setParentSequence([physicLayer()], 600);
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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.doUnmock('@tauri-apps/api/core');
    vi.resetModules();
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  describe('expandRotoPhysicalEditRecordRefs', () => {
    it('expands unchanged content-token refs against the parent store and leaves full records intact', () => {
      const recordA = makePhysicalRecord('A', 1);
      const recordB = makePhysicalRecord('B', 3);
      seedPhysicalDocument('phys-layer-1', [recordA, recordB]);
      const tokenA = buildFrameBytesToken(recordA.payload.bytes);

      const result = expandRotoPhysicalEditRecordRefs({
        kind: 'replace-roto-physical-map',
        layerId: 'phys-layer-1',
        trackId: TEST_TRACK_ID,
        records: [
          { keyId: 'A', appFrame: 1, refToken: tokenA },
          { keyId: 'B', appFrame: 4, payload: { frameIndex: 0, appFrame: 4, bytes: recordB.payload.bytes, width: 1000, height: 650 } },
        ],
      });

      expect('error' in result).toBe(false);
      const records = (result as { payload: { records: unknown[] } }).payload.records;
      expect(records).toHaveLength(2);
      expect(records[0]).toEqual({ keyId: 'A', appFrame: 1, payload: { ...recordA.payload, appFrame: 1 } });
      expect(records[1]).toEqual({ keyId: 'B', appFrame: 4, payload: { frameIndex: 0, appFrame: 4, bytes: recordB.payload.bytes, width: 1000, height: 650 } });
    });

    it('fails closed when a ref key is unknown to the parent document', () => {
      seedPhysicalDocument('phys-layer-1', [makePhysicalRecord('A', 1)]);

      const result = expandRotoPhysicalEditRecordRefs({
        kind: 'replace-roto-physical-map',
        layerId: 'phys-layer-1',
        trackId: TEST_TRACK_ID,
        records: [{ keyId: 'MISSING', appFrame: 1, refToken: 'tok' }],
      });

      expect('error' in result).toBe(true);
      expect((result as { error: string }).error).toContain('unknown to the parent document');
    });

    it('fails closed when a ref token no longer matches the parent content', () => {
      seedPhysicalDocument('phys-layer-1', [makePhysicalRecord('A', 1)]);

      const result = expandRotoPhysicalEditRecordRefs({
        kind: 'replace-roto-physical-map',
        layerId: 'phys-layer-1',
        trackId: TEST_TRACK_ID,
        records: [{ keyId: 'A', appFrame: 1, refToken: 'stale-token' }],
      });

      expect('error' in result).toBe(true);
      expect((result as { error: string }).error).toContain('no longer matches');
    });

    it('returns the payload unchanged when no record is a ref', () => {
      const payload = {
        kind: 'replace-roto-physical-map',
        layerId: 'phys-layer-1',
        trackId: TEST_TRACK_ID,
        records: [{ keyId: 'A', appFrame: 1, payload: { frameIndex: 0, appFrame: 1, bytes: testWebpBytes('x'), width: 1, height: 1 } }],
      };
      expect(expandRotoPhysicalEditRecordRefs(payload)).toEqual({ payload });
    });

    it('returns the payload unchanged for a non-physical payload', () => {
      const payload = { kind: 'apply-canvas', layerId: 'phys-layer-1' };
      expect(expandRotoPhysicalEditRecordRefs(payload)).toEqual({ payload });
    });
  });

  it('creates launch context with layer, frame, operation, and canvas dimensions', async () => {
    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 12, { width: 1920, height: 1080 });

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      layerName: 'Water smoke',
      startFrame: 12,
      width: 1920,
      height: 1080,
    });
    expect(context.operationId).toMatch(/^physic-paint-/);
  });

  it('creates launch context at engine-native dimensions when no canvas is provided', async () => {
    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 12);

    expect(context).toMatchObject({
      layerId: 'phys-layer-1',
      layerName: 'Water smoke',
      startFrame: 12,
    });
    expect(context.width).toBeUndefined();
    expect(context.height).toBeUndefined();
    expect(context.operationId).toMatch(/^physic-paint-/);
  });

  it('propagates the presentation workflow label without replacing the persisted layer name', async () => {
    const context = createPhysicPaintLaunchContext(
      physicLayer({ name: 'Water smoke' }),
      12,
      null,
      null,
      'PPaint #2',
    );

    expect(context.workflowLabel).toBe('PPaint #2');
    expect(context.layerName).toBe('Water smoke');
  });

  it('carries the authoritative layer end separately from physical capacity', async () => {
    const layer = physicLayer();
    sequenceStore.sequences.value = [];
    sequenceStore.add({
      id: 'parent-end-sequence',
      kind: 'fx',
      name: 'Parent end authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 40,
    });

    const context = createPhysicPaintLaunchContext(layer, 10);

    expect(carriedRotoPhysical(context)).toMatchObject({
      capacity: 40,
    });
  });

  // 260920-ji7 (CLAMP verdict, D-08): the launch-context capacity resolution
  // (physicPaintBridge.ts createPhysicPaintLaunchContext) wrote back
  // min(liveParentEnd, its own stored value), so the first launch froze the
  // layer's addressable extent and every later sequence extension was refused
  // ('No remaining Physics Paint sequence capacity is available.'). The law:
  // the bound is authorized by the LIVE parent end, floored by existing
  // content so a shrink never invalidates stored keys, and capped only by
  // PHYSIC_PAINT_MAX_APPLY_FRAMES — never by its own previous value.
  describe('sequence-extension authority (260920-ji7)', () => {
    const authorityAt = (layerId: string, canonicalStart: number) => getPhysicPaintRotoAuthority({
      operationId: `ji7-authority-${canonicalStart}`,
      projectContextId: projectStore.projectContextId.peek(),
      layerId,
      canonicalStart,
      trackId: TEST_TRACK_ID,
    });

    it('raises the layer capacity when the parent span is extended', () => {
      const layer = physicLayer();
      mockLayers([layer], 40);

      const first = createPhysicPaintLaunchContext(layer, 10);
      expect(carriedRotoPhysical(first).capacity).toBe(40);
      expect(physicPaintStore.getRotoPhysicalCapacity(layer.id, TEST_TRACK_ID)).toBe(40);

      // The user extends the sequence: span end 40 -> 80 (post-o0n the
      // span-drag path carries no timeline ceiling).
      sequenceStore.updateFxSequenceRange('bridge-test-parent-sequence', 0, 80);
      const extended = createPhysicPaintLaunchContext(layer, 10);

      expect(carriedRotoPhysical(extended).capacity).toBe(80);
      expect(physicPaintStore.getRotoPhysicalCapacity(layer.id, TEST_TRACK_ID)).toBe(80);
    });

    it('caps the capacity only at the global maximum', () => {
      const layer = physicLayer();
      mockLayers([layer], 40);
      createPhysicPaintLaunchContext(layer, 10);

      sequenceStore.updateFxSequenceRange(
        'bridge-test-parent-sequence',
        0,
        PHYSIC_PAINT_MAX_APPLY_FRAMES + 200,
      );
      const beyond = createPhysicPaintLaunchContext(layer, 10);

      expect(carriedRotoPhysical(beyond).capacity).toBe(PHYSIC_PAINT_MAX_APPLY_FRAMES);
      expect(physicPaintStore.getRotoPhysicalCapacity(layer.id, TEST_TRACK_ID)).toBe(PHYSIC_PAINT_MAX_APPLY_FRAMES);
    });

    it('follows the extension in both directions without invalidating surviving keys', () => {
      const layer = physicLayer();
      mockLayers([layer], 60);
      const records = [makePhysicalRecord('shrink-a', 0), makePhysicalRecord('shrink-b', 50)];
      seedPhysicalDocument(layer.id, records);

      const atSixty = createPhysicPaintLaunchContext(layer, 10);
      expect(carriedRotoPhysical(atSixty).capacity).toBe(60);

      // The parent span shrinks below the last stored key: the live parent end
      // is honored, but never below what the stored records need — nothing is
      // dropped to make the bound fit and the launch never throws.
      sequenceStore.updateFxSequenceRange('bridge-test-parent-sequence', 0, 30);
      const shrunk = createPhysicPaintLaunchContext(layer, 10);

      expect(carriedRotoPhysical(shrunk).capacity).toBe(51);
      expect(physicPaintStore.getRotoPhysicalCapacity(layer.id, TEST_TRACK_ID)).toBe(51);
      expect(carriedRotoPhysical(shrunk).realKeyRecords.map((record) => record.appFrame)).toEqual([0, 50]);
    });

    it('stops refusing the authority read at the frame the extension added', () => {
      const layer = physicLayer();
      mockLayers([layer], 40);
      createPhysicPaintLaunchContext(layer, 10);

      const before = authorityAt(layer.id, 60);
      expect(before.ok).toBe(false);
      expect(before.error).toBe('No remaining Physics Paint sequence capacity is available.');

      sequenceStore.updateFxSequenceRange('bridge-test-parent-sequence', 0, 80);
      createPhysicPaintLaunchContext(layer, 10);

      expect(authorityAt(layer.id, 60)).toMatchObject({
        ok: true,
        canonicalStart: 60,
        layerEndExclusive: 80,
        capacity: 20,
        physicalCapacity: 80,
      });
    });
  });

  it('launches a nonzero-inFrame sequence at its layer-local origin', async () => {
    const layer = physicLayer();
    sequenceStore.sequences.value = [];
    sequenceStore.add({
      id: 'nonzero-launch-origin-sequence',
      kind: 'fx',
      name: 'Nonzero launch origin authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 10,
      outFrame: 40,
    });

    const context = createPhysicPaintLaunchContext(layer, 10);

    expect(context).toMatchObject({ startFrame: 0 });
    expect(carriedRotoPhysical(context)).toMatchObject({
      capacity: 30,
      cursorAppFrame: 0,
    });
  });

  it('carries the parent LIVE runtime for non-active tracks — never the persisted document stale state (48-06 P1)', async () => {
    // The document's persisted rotoPhysical for the non-active track lags the
    // parent's live runtime by a whole previous session (an apply that never
    // reached a save). A child hydrated from the stale document fails every
    // parent revalidation on that track ("revision became stale"), freezing
    // it; the launch must carry the live runtime for EVERY track.
    const staleRecords = [0, 5].map((appFrame) => makePhysicalRecord(`stale-${appFrame}`, appFrame));
    const liveRecords = [0, 5, 7].map((appFrame) => makePhysicalRecord(`live-${appFrame}`, appFrame));
    const staleInterpolation = { enabled: false, mode: 'duplicate' as const };
    const liveInterpolation = { enabled: false, mode: 'duplicate' as const };
    const baseDocument = makeTrackDocument('phys-layer-1');
    registerDocument({
      ...baseDocument,
      tracks: [
        baseDocument.tracks[0],
        {
          ...baseDocument.tracks[0],
          id: 'track-2',
          name: 'Paint 1',
          order: 1,
          rotoPhysical: {
            capacity: 600,
            realKeyRecords: staleRecords,
            groupOverrideRecords: [],
            interpolation: staleInterpolation,
            scriptMotion: { deformation: 0, position: 0 },
            background: null,
            selectedKeyId: null,
            cursorAppFrame: 0,
            revision: buildPhysicPaintRotoPhysicalRevision(staleRecords, staleInterpolation, []),
            loopClips: [],
            incomingInterpolationBreakKeyIds: [],
          },
        },
      ],
    });
    const liveResult = physicPaintStore.replaceRotoPhysicalDocument('phys-layer-1', 'track-2', {
      capacity: 600,
      realKeyRecords: liveRecords,
      interpolation: liveInterpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(liveRecords, liveInterpolation, []),
      incomingInterpolationBreakKeyIds: [],
    });
    if (!liveResult.ok) throw new Error(liveResult.error);

    const context = createPhysicPaintLaunchContext(physicLayer(), 0);
    if (!context.document) throw new Error('Expected the launch context to carry the v1.0 document.');

    const carriedTrack2 = context.document.tracks.find((track) => track.id === 'track-2');
    expect(carriedTrack2?.rotoPhysical?.realKeyRecords.map((record) => record.appFrame)).toEqual([0, 5, 7]);
    expect(carriedTrack2?.rotoPhysical?.revision).toBe(
      buildPhysicPaintRotoPhysicalRevision(liveRecords, liveInterpolation, []),
    );
  });

  it('converts and clamps later global launch frames in layer-local coordinates', async () => {
    const layer = physicLayer();
    sequenceStore.sequences.value = [];
    sequenceStore.add({
      id: 'nonzero-later-launch-sequence',
      kind: 'fx',
      name: 'Nonzero later launch authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 10,
      outFrame: 40,
    });

    const withinRange = createPhysicPaintLaunchContext(layer, 25);
    const afterRange = createPhysicPaintLaunchContext(layer, 45);

    expect(withinRange).toMatchObject({ startFrame: 15 });
    expect(carriedRotoPhysical(withinRange)).toMatchObject({ cursorAppFrame: 15, capacity: 30 });
    expect(afterRange).toMatchObject({ startFrame: 29 });
    expect(carriedRotoPhysical(afterRange)).toMatchObject({ cursorAppFrame: 29, capacity: 30 });
  });

  it('launches a non-first content Sequence from its track layout origin in layer-local coordinates', async () => {
    const layer = physicLayer();
    sequenceStore.sequences.value = [{
      id: 'content-before-physical-sequence',
      kind: 'content',
      name: 'Content before physical sequence',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'content-before-key', imageId: 'image-before', holdFrames: 100 }],
      layers: [],
    }, {
      id: 'content-physical-sequence',
      kind: 'content',
      name: 'Content physical authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'content-physical-key', imageId: 'image-physical', holdFrames: 30 }],
      layers: [layer],
    }];

    const atStart = createPhysicPaintLaunchContext(layer, 100);
    const later = createPhysicPaintLaunchContext(layer, 112);

    expect(atStart).toMatchObject({ startFrame: 0 });
    expect(carriedRotoPhysical(atStart)).toMatchObject({ cursorAppFrame: 0, capacity: 30 });
    expect(later).toMatchObject({ startFrame: 12 });
    expect(carriedRotoPhysical(later)).toMatchObject({ cursorAppFrame: 12, capacity: 30 });
  });

  it('authorizes a non-first content Sequence local end over a stale stored capacity', async () => {
    const layer = physicLayer();
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 20,
      realKeyRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision([], interpolation, []),
    });
    if (!seeded.ok) throw new Error(seeded.error);
    sequenceStore.sequences.value = [{
      id: 'content-before-capacity-sequence',
      kind: 'content',
      name: 'Content before capacity sequence',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'content-before-capacity-key', imageId: 'image-before', holdFrames: 100 }],
      layers: [],
    }, {
      id: 'content-capacity-sequence',
      kind: 'content',
      name: 'Content capacity authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'content-capacity-key', imageId: 'image-capacity', holdFrames: 30 }],
      layers: [layer],
    }];

    const context = createPhysicPaintLaunchContext(layer, 125);

    // 260920-ji7: the live content Sequence end (30) authorizes the bound. The
    // stored 20 is a previously written launch value, never its own ceiling —
    // read as 20 it froze the extent and refused every later extension.
    expect(context).toMatchObject({ startFrame: 25 });
    expect(carriedRotoPhysical(context)).toMatchObject({ capacity: 30, cursorAppFrame: 25 });
  });

  it('fails closed when content timing cannot validate its matching track layout', async () => {
    const layer = physicLayer();
    sequenceStore.sequences.value = [{
      id: 'invalid-content-range-sequence',
      kind: 'content',
      name: 'Invalid content range authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'invalid-content-key', imageId: 'invalid-image', holdFrames: 0 }],
      layers: [layer],
    }];

    expect(() => createPhysicPaintLaunchContext(layer, 0))
      .toThrow('Physics Paint layer has no authoritative parent timeline range.');
  });

  it('computes Play Script authority from an already-local canonical start', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    sequenceStore.add({
      id: 'nonzero-play-script-authority-sequence',
      kind: 'fx',
      name: 'Nonzero Play Script authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 10,
      outFrame: 40,
    });

    const authority = getPhysicPaintRotoAuthority({
      operationId: 'nonzero-play-script-authority',
      projectContextId: projectStore.projectContextId.peek(),
      layerId: layer.id,
      canonicalStart: 5,
      trackId: TEST_TRACK_ID,
    });

    // 43.4 defect 1: the authority remaining is the child document capacity,
    // never the stale main-editor display outFrame.
    expect(authority).toMatchObject({
      ok: true,
      canonicalStart: 5,
      layerEndExclusive: 600,
      capacity: 595,
      physicalCapacity: 600,
    });
  });

  it('fails closed when an FX layer has missing or invalid Sequence range authority', async () => {
    const layer = physicLayer();
    sequenceStore.sequences.value = [];

    expect(() => createPhysicPaintLaunchContext(layer, 10))
      .toThrow('Physics Paint layer has no authoritative parent timeline range.');

    sequenceStore.add({
      id: 'invalid-parent-range-sequence',
      kind: 'fx',
      name: 'Invalid parent range authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 40,
      outFrame: 10,
    });

    expect(() => createPhysicPaintLaunchContext(layer, 10))
      .toThrow('Physics Paint layer has no authoritative parent timeline range.');
  });

  it('hydrates every cached Roto frame summary into launch context', async () => {
    seedPhysicalDocument('phys-layer-1', [makePhysicalRecord('key-8', 8), makePhysicalRecord('key-10', 10)], { enabled: true, mode: 'duplicate' });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 8, null, null);

    expect(context).toMatchObject({ startFrame: 8 });
    expect(carriedRotoPhysical(context)).toEqual(expect.objectContaining({
      cursorAppFrame: 8,
      selectedKeyId: 'key-8',
      interpolation: { enabled: true, mode: 'duplicate' },
    }));
    expect(carriedRotoPhysical(context).realKeyRecords).toEqual([
      expect.objectContaining({ keyId: 'key-8', appFrame: 8 }),
      expect.objectContaining({ keyId: 'key-10', appFrame: 10 }),
    ]);
    expect('editableState' in context).toBe(false);
  });

  it('retains the complete physical document through close sync and child reopen hydration', async () => {
    mockLayers([physicLayer()]);
    const records = [
      makeEmptySegmentRecord('key-0', 0, OPAQUE_ONE_PIXEL_WEBP),
      makeEmptySegmentRecord('key-16', 16, OPAQUE_ONE_PIXEL_WEBP),
      makeEmptySegmentRecord('key-32', 32),
    ].map((record) => ({ ...record, kind: 'real-key' as const }));
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const loopClips = [{
      loopId: 'loop-1',
      placementStart: 40,
      sourceKeyIds: ['key-0', 'key-16'],
      repeat: 2,
      mode: 'progressive' as const,
    }];
    const incomingInterpolationBreakKeyIds = ['key-32'];
    const seeded = physicPaintStore.replaceRotoPhysicalDocument('phys-layer-1', TEST_TRACK_ID, {
      capacity: 64,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'key-32',
      cursorAppFrame: 32,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, incomingInterpolationBreakKeyIds),
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    expect(seeded.ok).toBe(true);

    const closeSync = await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'close-sync-key-32',
      startFrame: 32,
      renderedFrame: { frameIndex: 0, appFrame: 32, bytes: TRANSPARENT_ONE_PIXEL_WEBP, width: 1, height: 1 },
      closeWindowAfterApply: true,
    }));
    expect(closeSync.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', TEST_TRACK_ID, 31)).toBeNull();
    expect(physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', TEST_TRACK_ID, 1)).toEqual(expect.objectContaining({ kind: 'generated' }));
    const parentRasterBeforeReopen = physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', TEST_TRACK_ID, 1);
    expect(parentRasterBeforeReopen).toEqual(expect.objectContaining({ kind: 'generated', appFrame: 1 }));

    const launch = createPhysicPaintLaunchContext(physicLayer(), 32);
    for (const record of records) {
      registerRotoAlphaCanvasFrame(record.payload.bytes, { width: 1, height: 1 } as HTMLCanvasElement);
    }
    const reopened = await hydrateRotoPhysicalLaunchContext(launch, physicPaintStore);

    if (!reopened.ok) throw new Error(reopened.error);
    expect(reopened.ok).toBe(true);
    expect(reopened.document).toMatchObject({
      realKeyRecords: records,
      interpolation,
      selectedKeyId: 'key-32',
      cursorAppFrame: 32,
      loopClips,
      incomingInterpolationBreakKeyIds,
    });
    expect(physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', TEST_TRACK_ID, 1)).toEqual(parentRasterBeforeReopen);
    expect(physicPaintStore.getRotoPhysicalRenderSource('phys-layer-1', TEST_TRACK_ID, 31)).toBeNull();
  });

  it('includes a defensive copy of persisted Roto paper metadata for standalone reopen', async () => {
    const metadata = { background: 'canvas2' as const, paperGrain: 'canvas3', grainStrength: 0.65 };
    physicPaintStore.setRotoBackgroundMetadata('phys-layer-1', TEST_TRACK_ID, metadata);

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 8, null, null);

    expect(carriedRotoPhysical(context).background).toEqual(metadata);
    expect(carriedRotoPhysical(context).background).not.toBe(metadata);
  });

  it('does not attach stale layer-level editable state when reopening cached-only Roto frames', async () => {
    physicPaintStore.applyCanvas(applyCanvasPayload({ startFrame: 1, renderedFrame: makeFrame(0, 1) }));
    physicPaintStore.applyCanvas(applyCanvasPayload({ operationId: 'apply-still-2', startFrame: 4, renderedFrame: makeFrame(0, 4) }));

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 1, null, null);

    expect(context).toMatchObject({ startFrame: 1 });
    expect(carriedRotoPhysical(context).realKeyRecords).toEqual([]);
    expect('editableState' in context).toBe(false);
  });

  it('36.12 D-16 rejects generated-only Roto launch targets as render-only instead of redirecting to editable state', async () => {
    seedPhysicalDocument('phys-layer-1', [makePhysicalRecord('key-12', 12), makePhysicalRecord('key-14', 14)], { enabled: true, mode: 'duplicate' });

    const context = createPhysicPaintLaunchContext(physicLayer({ name: 'Water smoke' }), 13, null, null);

    expect(context).toMatchObject({ startFrame: 13 });
    expect('editableState' in context).toBe(false);
    expect(carriedRotoPhysical(context)).toEqual(expect.objectContaining({
      cursorAppFrame: 13,
      selectedKeyId: null,
      interpolation: { enabled: true, mode: 'duplicate' },
    }));
    expect(carriedRotoPhysical(context).realKeyRecords.map((record) => record.appFrame)).toEqual([12, 14]);
  });












  it('rejects non physics paint layers before opening a window', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const result = await openPhysicPaintCanvas({ layer: physicLayer({ type: 'paint', source: { type: 'paint', layerId: 'paint-1' } }), frame: 0 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('physic-paint');
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });


  it('uses browser fallback with encoded launch context when Tauri APIs are unavailable', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);

    const result = await openPhysicPaintCanvas({
      layer: physicLayer({ name: 'Water smoke' }),
      frame: 4,
      canvas: { width: 1280, height: 720 },
      workflowLabel: ' PPaint #3 ',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.layerId).toBe('phys-layer-1');
      expect(result.data.layerName).toBe('Water smoke');
      expect(result.data.workflowLabel).toBe('PPaint #3');
      expect(result.data.startFrame).toBe(4);
    }
    expect(open).toHaveBeenCalledTimes(1);
    const url = String(open.mock.calls[0][0]);
    expect(url).toContain('/physics-paint');
    expect(url).toContain('context=');
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context).toMatchObject({ layerName: 'Water smoke', workflowLabel: 'PPaint #3' });
    expect(focus).toHaveBeenCalled();
    open.mockRestore();
  });



  it('rejects invalid launch contexts before opening a window', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);

    const result = await openPhysicPaintCanvas({
      layer: physicLayer({ source: { type: 'physic-paint', layerId: '' } }),
      frame: 4,
    });

    expect(result).toEqual({ ok: false, error: 'Could not open physics paint canvas: Error: No EFX Paint document for layer "".' });
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('exports the launch event name for the Tauri path', async () => {
    expect(PHYSIC_PAINT_LAUNCH_EVENT).toBe('physic-paint:launch');
  });

  it('exports the audio context event name for the push channel (D-01/D-02)', async () => {
    expect(PHYSIC_PAINT_AUDIO_CONTEXT_EVENT).toBe('physic-paint:audio-context');
  });

  it('exports the audio playback-state and ownership event names (41-04, D-05)', async () => {
    expect(PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT).toBe('physic-paint:audio-playback-state');
    expect(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT).toBe('physic-paint:audio-ownership');
  });

  it('publishes the main playback state with the project-context publish shape (D-05)', async () => {
    await publishPhysicPaintAudioPlaybackState(true);
    const dispatch = window.dispatchEvent as ReturnType<typeof vi.fn>;
    const events = dispatch.mock.calls
      .map(([event]) => event)
      .filter((event): event is CustomEvent => event instanceof CustomEvent && event.type === PHYSIC_PAINT_AUDIO_PLAYBACK_STATE_EVENT);
    expect(events.length).toBe(1);
    expect(events[0].detail).toEqual({ playing: true });
  });

  it('records child ownership claim/release in the main-side gate signal (D-05 symmetric guard)', async () => {
    const unlisten = await installPhysicPaintAudioOwnershipListener();
    try {
      const addListener = window.addEventListener as ReturnType<typeof vi.fn>;
      const custom = addListener.mock.calls.find(([name]) => name === PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT)?.[1] as (event: Event) => void;
      const message = addListener.mock.calls.find(([name]) => name === 'message')?.[1] as (event: MessageEvent) => void;
      expect(typeof custom).toBe('function');
      expect(typeof message).toBe('function');
      expect(isPhysicPaintChildAudioClaimed()).toBe(false);
      custom(new CustomEvent(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, { detail: { claim: true } }));
      expect(isPhysicPaintChildAudioClaimed()).toBe(true);
      // Origin-checked postMessage path: a foreign origin is ignored.
      message({ origin: 'https://foreign.example', data: { type: PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, payload: { claim: false } } } as MessageEvent);
      expect(isPhysicPaintChildAudioClaimed()).toBe(true);
      message({ origin: 'http://localhost:1420', data: { type: PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, payload: { claim: false } } } as MessageEvent);
      expect(isPhysicPaintChildAudioClaimed()).toBe(false);
      // Invalid payloads are ignored (state unchanged).
      custom(new CustomEvent(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, { detail: { claim: 'yes' } }));
      expect(isPhysicPaintChildAudioClaimed()).toBe(false);
    } finally {
      unlisten();
    }
  });

  it('registers the child-carried background source bytes on document sync so a child-added clip renders in the main composite (49-06 UAT round 11)', async () => {
    const unlisten = await installPhysicPaintEfxPaintDocumentListener();
    try {
      const addListener = window.addEventListener as ReturnType<typeof vi.fn>;
      const custom = addListener.mock.calls.find(([name]) => name === PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT)?.[1] as (event: Event) => void;
      expect(typeof custom).toBe('function');
      // Before the sync the main realm knows neither the child-added clip's
      // source ref nor its bytes.
      expect(physicPaintStore.getBackgroundSourceImageBytes('ref-shot-imported')).toBeNull();
      expect(physicPaintStore.getBackgroundFrameVerdict('phys-layer-1', 0)).toBe('gap');
      const importedBytes = testWebpBytes('aW1wb3J0ZWQtc2hvdA==');
      const encoded = encodeSourceBytesForDocumentSync(importedBytes);
      custom(new CustomEvent(PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, {
        detail: {
          document: {
            ...makeTrackDocument('phys-layer-1'),
            documentRevision: 1,
            background: {
              ...makeTrackDocument('phys-layer-1').background,
              revision: 1,
              clips: [{
                id: 'bg-clip-1',
                startFrame: 0,
                sourceFrameRefs: ['ref-shot-imported'],
                repeat: { mode: 'finite', count: 1 },
                sourceKind: 'imported-background',
                revision: 1,
              }],
            },
          },
          backgroundSources: { 'ref-shot-imported': encoded },
        },
      }));
      // The carried bytes reach the main registry AND the newly covered frame
      // resolves 'content' — the main-app flattened composite renders the
      // child-session import instead of 'missing' (the "no Bg render" symptom).
      expect(physicPaintStore.getBackgroundSourceImageBytes('ref-shot-imported')).toEqual(importedBytes);
      expect(physicPaintStore.getBackgroundFrameVerdict('phys-layer-1', 0)).toBe('content');
    } finally {
      unlisten();
    }
  });

  /**
   * 52.2-10 (D-12, T-52.2-33/34/35): the MAIN window is the receiver of the
   * Studio's document sync. With the document crossing REFERENCE-SHAPED, the
   * receiver owns exactly two jobs: decide from its own digest store which
   * rasters it lacks (no decode, no file read to answer), and pull only those.
   * A digest is the identity — a receiver that keys by keyId re-pulls on every
   * paste and mis-applies a re-delivered retry.
   */
  describe('52.2-10 receiver applies references by digest (D-12)', () => {
    const RECEIVER_LAYER = 'phys-layer-1';
    const frameDigest = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

    type ReceiverPortSpies = {
      has: ReturnType<typeof vi.fn>;
      install: ReturnType<typeof vi.fn>;
      request: ReturnType<typeof vi.fn>;
    };

    /** Inject the receiver's digest store as spy ports; `held` answers "do I have it?". */
    const injectReceiverPorts = (held: (digest: string) => boolean): ReceiverPortSpies => {
      const ports = {
        has: vi.fn((digest: string) => held(digest)),
        install: vi.fn(async (_digest: string, _bytes: Uint8Array) => ({ ok: true as const })),
        request: vi.fn((_digests: readonly string[]) => undefined),
      };
      _setPhysicPaintDocumentSyncFramePorts(ports);
      return ports;
    };

    /** A reference-shaped document (no inline raster in either collection). */
    const referenceDocument = (digests: readonly string[]): EfxPaintDocument => {
      const base = makeTrackDocument(RECEIVER_LAYER);
      const interpolation = { enabled: false, mode: 'duplicate' as const };
      const realKeyRecords = digests.map((digest, index) => ({
        kind: 'real-key' as const,
        keyId: `key-${index}`,
        appFrame: index,
        payload: {
          frameIndex: 0,
          appFrame: index,
          media: { relativePath: `frames/${RECEIVER_LAYER}/key-${index}.webp`, digest, width: 8, height: 6 },
        },
      }));
      const rotoPhysical = parsePhysicPaintRotoPhysicalDocument({
        capacity: 600,
        realKeyRecords,
        groupOverrideRecords: [],
        interpolation,
        scriptMotion: { deformation: 0, position: 0 },
        background: null,
        selectedKeyId: null,
        cursorAppFrame: 0,
        revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, interpolation, [], [], []),
        loopClips: [],
        incomingInterpolationBreakKeyIds: [],
      });
      return { ...base, documentRevision: 1, tracks: [{ ...base.tracks[0], rotoPhysical }] };
    };

    /** Install the receiver listener and hand back its document-sync entry point. */
    const openReceiver = async () => {
      const unlisten = await installPhysicPaintEfxPaintDocumentListener();
      const custom = (window.addEventListener as ReturnType<typeof vi.fn>).mock.calls
        .find(([name]) => name === PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT)?.[1] as (event: Event) => void;
      const deliver = (document: EfxPaintDocument, changedBytes?: Record<string, string>): void => {
        custom(new CustomEvent(PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT, {
          detail: changedBytes === undefined ? { document } : { document, changedBytes },
        }));
      };
      return { deliver, unlisten };
    };

    it('applying a sync whose references are all known performs zero decode and zero byte requests', async () => {
      const bytes = testWebpBytes('receiver-already-holds');
      const digest = frameDigest(bytes);
      const ports = injectReceiverPorts(() => true);

      const { deliver, unlisten } = await openReceiver();
      try {
        deliver(referenceDocument([digest]));
        await awaitPendingPhysicPaintFrameMediaInstalls();

        expect(ports.request).not.toHaveBeenCalled();
        expect(ports.install).not.toHaveBeenCalled();
      } finally {
        unlisten();
      }
    });

    it('applying a sync with one unknown digest requests exactly that digest and installs the frames once they arrive', async () => {
      const knownBytes = testWebpBytes('receiver-holds-this-one');
      const knownDigest = frameDigest(knownBytes);
      const bytes = testWebpBytes('receiver-lacks-this-one');
      const digest = frameDigest(bytes);
      const ports = injectReceiverPorts((candidate) => candidate === knownDigest);

      const { deliver, unlisten } = await openReceiver();
      try {
        deliver(referenceDocument([knownDigest, digest]));
        await awaitPendingPhysicPaintFrameMediaInstalls();

        // Exactly the missing digest is asked for — never the whole document.
        expect(ports.request).toHaveBeenCalledTimes(1);
        expect(ports.request).toHaveBeenCalledWith([digest]);
        expect(ports.install).not.toHaveBeenCalled();

        // The response carries the pixels on the digest-keyed channel.
        deliver(referenceDocument([knownDigest, digest]), { [digest]: bytesToBase64(bytes) });
        await awaitPendingPhysicPaintFrameMediaInstalls();

        expect(ports.install).toHaveBeenCalledTimes(1);
        const [installedDigest, installedBytes] = ports.install.mock.calls[0] as [string, Uint8Array];
        expect(installedDigest).toBe(digest);
        expect(Array.from(installedBytes)).toEqual(Array.from(bytes));
      } finally {
        unlisten();
      }
    });

    it('a re-delivered sync is idempotent: exactly one byte request in total across both deliveries', async () => {
      const bytes = testWebpBytes('receiver-retry');
      const digest = frameDigest(bytes);
      const ports = injectReceiverPorts(() => false);

      const { deliver, unlisten } = await openReceiver();
      try {
        deliver(referenceDocument([digest]));
        await awaitPendingPhysicPaintFrameMediaInstalls();
        deliver(referenceDocument([digest]));
        await awaitPendingPhysicPaintFrameMediaInstalls();

        // A retry storm cannot re-pull the document: content already asked for
        // (or already held) is never re-requested (T-52.2-35).
        expect(ports.request).toHaveBeenCalledTimes(1);
        expect(ports.request).toHaveBeenCalledWith([digest]);
      } finally {
        unlisten();
      }
    });

    it('refuses an entry whose bytes do not hash to the digest that carried them — recorded, never applied', async () => {
      const claimedBytes = testWebpBytes('claimed-content');
      const digest = frameDigest(claimedBytes);
      const tampered = testWebpBytes('tampered-content');

      const { deliver, unlisten } = await openReceiver();
      try {
        deliver(referenceDocument([digest]), { [digest]: bytesToBase64(tampered) });
        await awaitPendingPhysicPaintFrameMediaInstalls();

        // The digest is the identity AND the verification: a mislabelled entry
        // cannot displace correct content, and the refusal is observable.
        expect(hasFrameMediaBytes(digest)).toBe(false);
        expect(getFrameMediaVerdict(digest)).toBe('digest-mismatch');
      } finally {
        unlisten();
      }
    });

    it('REAL STORE: a verified arrival is installed under its digest and answers the known-digest query', async () => {
      const bytes = testWebpBytes('verified-arrival');
      const digest = frameDigest(bytes);

      const { deliver, unlisten } = await openReceiver();
      try {
        deliver(referenceDocument([digest]), { [digest]: bytesToBase64(bytes) });
        await awaitPendingPhysicPaintFrameMediaInstalls();

        expect(hasFrameMediaBytes(digest)).toBe(true);
        expect(getFrameMediaVerdict(digest)).toBeNull();
      } finally {
        unlisten();
      }
    });

    it('installs the raster of an applied canvas under its content digest, so a later sync answers "already held"', async () => {
      const layer = physicLayer();
      mockLayers([layer]);
      seedPhysicalDocument(layer.id, [makePhysicalRecord('key-1', 0)]);
      const bytes = testWebpBytes('applied-canvas-frame');

      const result = await applyPhysicPaintPayload(applyCanvasPayload({
        layerId: layer.id,
        startFrame: 0,
        renderedFrame: { frameIndex: 0, appFrame: 0, bytes, width: 8, height: 6 },
      }));
      expect(result.ok).toBe(true);
      await awaitPendingPhysicPaintFrameMediaInstalls();

      expect(hasFrameMediaBytes(frameDigest(bytes))).toBe(true);
    });
  });

  it('a fresh child launch clears any stale audio claim left by a previous window (D-05 lifecycle)', async () => {
    const unlisten = await installPhysicPaintAudioOwnershipListener();
    try {
      const addListener = window.addEventListener as ReturnType<typeof vi.fn>;
      const custom = addListener.mock.calls.find(([name]) => name === PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT)?.[1] as (event: Event) => void;
      custom(new CustomEvent(PHYSIC_PAINT_AUDIO_OWNERSHIP_EVENT, { detail: { claim: true } }));
      expect(isPhysicPaintChildAudioClaimed()).toBe(true);
      const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
      const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 4 });
      expect(result.ok).toBe(true);
      expect(isPhysicPaintChildAudioClaimed()).toBe(false);
      open.mockRestore();
    } finally {
      unlisten();
    }
  });

  it('(1) publishes a revisioned audio context push on every tracks change with strictly increasing revisions (D-02)', async () => {
    const dispose = installPhysicPaintAudioContextPublisher();
    try {
      const dispatch = window.dispatchEvent as ReturnType<typeof vi.fn>;
      const audioPublishes = () => dispatch.mock.calls
        .map(([event]) => event)
        .filter((event): event is CustomEvent => event instanceof CustomEvent && event.type === PHYSIC_PAINT_AUDIO_CONTEXT_EVENT);
      // The effect publishes once on install with the current (empty) state —
      // the revision counter absorbs frequency; no debounce may skip state.
      expect(audioPublishes().length).toBe(1);
      audioStore.tracks.value = [makeAudioTrack()];
      audioStore.tracks.value = [makeAudioTrack(), makeAudioTrack({ id: 'audio-2', order: 1 })];
      const publishes = audioPublishes();
      expect(publishes.length).toBe(3);
      const revisions = publishes.map((event) => (event.detail as { revision: number }).revision);
      expect(revisions[1]).toBeGreaterThan(revisions[0]);
      expect(revisions[2]).toBeGreaterThan(revisions[1]);
      // The latest publish carries the full rebuilt section (D-02).
      expect((publishes[2].detail as { tracks: unknown[] }).tracks.length).toBe(2);
    } finally {
      dispose();
      audioStore.tracks.value = [];
    }
  });

  it('does not fall back to browser open when native Tauri window command fails', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: {
        ...window,
        open: vi.fn(),
        location: { origin: 'http://localhost:1420' },
      },
      writable: true,
      configurable: true,
    });
    vi.doMock('@tauri-apps/api/core', () => ({
      isTauri: () => true,
      invoke: vi.fn().mockRejectedValue(new Error('permission denied')),
    }));
    const { openPhysicPaintCanvas: openCanvas } = await import('./physicPaintBridge');
    const { registerDocument: registerFreshDocument } = await import('../stores/efxPaintStore');
    registerFreshDocument(makeTrackDocument('phys-layer-1'));
    const { sequenceStore: nativeSequenceStore } = await import('../stores/sequenceStore');
    nativeSequenceStore.sequences.value = sequenceStore.sequences.peek();

    const result = await openCanvas({ layer: physicLayer(), frame: 4 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('permission denied');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('opens Tauri physics paint through the native command', async () => {
    const invoke = vi.fn().mockResolvedValue({
      label: 'efx-physic-paint',
      visibleBefore: false,
      minimizedBefore: false,
      visible: true,
      minimized: false,
      displaySleepAsserted: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        ...window,
        open: vi.fn(),
        location: { origin: 'http://localhost:5173' },
      },
      writable: true,
      configurable: true,
    });
    vi.doMock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));
    const { openPhysicPaintCanvas: openCanvas } = await import('./physicPaintBridge');
    const { registerDocument: registerFreshDocument } = await import('../stores/efxPaintStore');
    registerFreshDocument(makeTrackDocument('phys-layer-1'));
    const { sequenceStore: nativeSequenceStore } = await import('../stores/sequenceStore');
    nativeSequenceStore.sequences.value = sequenceStore.sequences.peek();

    const result = await openCanvas({ layer: physicLayer(), frame: 4 });

    expect(result.ok).toBe(true);
    expect(invoke).toHaveBeenCalledWith('open_physics_paint_window', {
      context: expect.objectContaining({ layerId: 'phys-layer-1', startFrame: 4 }),
    });
    expect(window.open).not.toHaveBeenCalled();
  });

  it('reports native launch failure when the Tauri window remains hidden', async () => {
    const invoke = vi.fn().mockResolvedValue({
      label: 'efx-physic-paint',
      visibleBefore: false,
      minimizedBefore: false,
      visible: false,
      minimized: false,
      displaySleepAsserted: false,
    });
    Object.defineProperty(globalThis, 'window', {
      value: {
        ...window,
        open: vi.fn(),
        location: { origin: 'http://localhost:5173' },
      },
      writable: true,
      configurable: true,
    });
    vi.doMock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke }));
    const { openPhysicPaintCanvas: openCanvas } = await import('./physicPaintBridge');
    const { registerDocument: registerFreshDocument } = await import('../stores/efxPaintStore');
    registerFreshDocument(makeTrackDocument('phys-layer-1'));
    const { sequenceStore: nativeSequenceStore } = await import('../stores/sequenceStore');
    nativeSequenceStore.sequences.value = sequenceStore.sequences.peek();

    const result = await openCanvas({ layer: physicLayer(), frame: 4 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('did not become visible');
    expect(window.open).not.toHaveBeenCalled();
  });

  it('rejects an unrelated valid Insert Slot document before parent mutation', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const currentRecords = [
      makePhysicalRecord('A', 1),
      makePhysicalRecord('B', 3),
      makePhysicalRecord('C', 5),
      makePhysicalRecord('D', 10),
    ];
    seedPhysicalDocument(layer.id, currentRecords, { enabled: true, mode: 'duplicate' }, ['C']);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 3 });

    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const canonicalRecords = [
      movePhysicalRecord(currentRecords[0], 1),
      movePhysicalRecord(currentRecords[1], 4),
      movePhysicalRecord(currentRecords[2], 6),
      movePhysicalRecord(currentRecords[3], 11),
    ].map(({ kind: _kind, ...record }) => record);

    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'reject-unrelated-insert-slot-document',
      operationKind: 'insert-slot',
      intent: { kind: 'insert-slot', selectedKeyId: 'B' },
      layerId: layer.id,
      startFrame: 3,
      launchOperationId: launch.data.operationId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: canonicalRecords,
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['C'],
      selectedKeyId: 'A',
      selectedAppFrame: 1,
    });

    expect(result.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(beforeDocument);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
  });

  it('rejects changed ordinary intent before cached success lookup', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const currentRecords = [
      makePhysicalRecord('A', 1),
      makePhysicalRecord('B', 3),
      makePhysicalRecord('C', 5),
      makePhysicalRecord('D', 10),
    ];
    seedPhysicalDocument(layer.id, currentRecords);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 3 });

    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const leaseToken = physicPaintStore.acquireRotoPhysicalOperationLease(projectStore.projectContextId.peek(), layer.id, TEST_TRACK_ID);
    if (!leaseToken) throw new Error('Expected ordinary physical-edit lease.');
    const records = [
      movePhysicalRecord(currentRecords[0], 1),
      movePhysicalRecord(currentRecords[1], 4),
      movePhysicalRecord(currentRecords[2], 6),
      movePhysicalRecord(currentRecords[3], 11),
    ].map(({ kind: _kind, ...record }) => record);
    const payload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationId: 'intent-aware-insert-slot-dedupe',
      operationKind: 'insert-slot' as const,
      leaseToken,
      intent: { kind: 'insert-slot' as const, selectedKeyId: 'B' },
      layerId: layer.id,
      startFrame: 3,
      launchOperationId: launch.data.operationId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records,
      interpolationEnabled: false,
      interpolationMode: 'duplicate' as const,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'B',
      selectedAppFrame: 4,
      cursorAppFrame: 4,
    };
    const first = await applyPhysicPaintPayload(payload);
    expect(first.ok).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const acceptedRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const changedIntent = await applyPhysicPaintPayload({
      ...payload,
      intent: { kind: 'insert-slot', selectedKeyId: 'A' },
    });

    expect(changedIntent).toMatchObject({
      ok: false,
      operationId: payload.operationId,
      error: 'Operation ID was already used for a different payload.',
    });
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(acceptedDocument);
    expect(rotoPhysicalRevision.peek()).toBe(acceptedRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
  });

  it('rejects missing, stale, cross-layer, and replayed generic lease tokens without publication', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const records = [makePhysicalRecord('A', 1), makePhysicalRecord('B', 3)];
    seedPhysicalDocument(layer.id, records);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 3 });
    expect(launch.ok).toBe(true);
    if (!launch.ok) return;

    const validToken = acquirePhysicalLease(layer.id);
    const crossLayerToken = acquirePhysicalLease('other-layer');
    const basePayload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationKind: 'move-key' as const,
      intent: {
        kind: 'move-key' as const,
        movedKeyId: 'B',
        target: { kind: 'physical-cell' as const, appFrame: 3 },
      },
      layerId: layer.id,
      startFrame: 3,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: payloadRecords(carriedRotoPhysical(launch.data)),
      interpolationEnabled: false,
      interpolationMode: 'duplicate' as const,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'B',
      selectedAppFrame: 3,
    };
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const rejected = [
      await applyPhysicPaintPayload({ ...basePayload, operationId: 'missing-generic-lease' }),
      await applyPhysicPaintPayload({
        ...basePayload,
        operationId: 'stale-generic-lease',
        leaseToken: { ...validToken, generation: validToken.generation + 100 },
      }),
      await applyPhysicPaintPayload({
        ...basePayload,
        operationId: 'cross-layer-generic-lease',
        leaseToken: crossLayerToken,
      }),
    ];
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(validToken)).toBe(true);
    rejected.push(await applyPhysicPaintPayload({
      ...basePayload,
      operationId: 'replayed-generic-lease',
      leaseToken: validToken,
    }));

    expect(rejected.every((result) => !result.ok)).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(beforeDocument);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(crossLayerToken)).toBe(true);
  });

  it('fails closed when the transported lease token tracks a different track (46-04 T-46-12)', async () => {
    // A lease token captured on track "track-foreign" must never authorize a
    // publication onto the payload's captured track: the payload validator
    // requires leaseToken.trackId === payload.trackId, and the transport seam
    // compares submittedLeaseToken.trackId with payload.trackId, so a
    // mismatched token falls through to the prepared path where it is
    // rejected — the foreign token can never publish a write.
    const layer = physicLayer();
    mockLayers([layer]);
    const records = [makePhysicalRecord('A', 1), makePhysicalRecord('B', 3)];
    seedPhysicalDocument(layer.id, records);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 3 });
    expect(launch.ok).toBe(true);
    if (!launch.ok) return;

    const foreignTrackToken = acquirePhysicalLease(layer.id, projectStore.projectContextId.peek(), 'track-foreign');
    const payload = {
      kind: 'replace-roto-physical-map' as const,
      operationId: 'foreign-track-lease-mismatch',
      trackId: TEST_TRACK_ID,
      operationKind: 'move-key' as const,
      intent: { kind: 'move-key' as const, movedKeyId: 'B', target: { kind: 'physical-cell' as const, appFrame: 4 } },
      layerId: layer.id,
      startFrame: 3,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: payloadRecords(carriedRotoPhysical(launch.data)),
      interpolationEnabled: false,
      interpolationMode: 'duplicate' as const,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'B',
      selectedAppFrame: 3,
      leaseToken: foreignTrackToken,
    };
    let listener: ((event: MessageEvent) => void) | undefined;
    const child = { postMessage: vi.fn() };
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'message') listener = cb as (event: MessageEvent) => void;
    });
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);

    await installPhysicPaintApplyListener();
    listener?.({
      origin: 'http://localhost:1420',
      data: { type: PHYSIC_PAINT_APPLY_EVENT, payload },
      source: child as unknown as MessageEventSource,
    } as MessageEvent);
    // The fallback listener applies through the asynchronous prepared-payload seam.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // The parent replied (fail closed), never published under the foreign token.
    expect(child.postMessage).toHaveBeenCalledWith({
      type: PHYSIC_PAINT_APPLY_RESULT_EVENT,
      payload: expect.objectContaining({ ok: false, operationId: payload.operationId }),
    }, 'http://localhost:1420');
    // The payload track was not written: no B write ever happened.
    expect(physicPaintStore.getRotoRealKeyRecords(layer.id, TEST_TRACK_ID)).toEqual(records);
    // The foreign-track token was never consumed by a publication lease.
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(foreignTrackToken)).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('parent-recomputes every ordinary physical mapping before publication', async () => {
    installCanonicalBlankCanvas();
    const layer = physicLayer();
    mockLayers([layer]);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    type PhysicalMapPayload = Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>;
    const baseline = [
      makePhysicalRecord('A', 1),
      makePhysicalRecord('B', 3),
      makePhysicalRecord('C', 5),
      makePhysicalRecord('D', 10),
    ];
    const blank = makeEmptySegmentRecord('blank-7', 7).payload;
    const pasteGroupEntries = [
      { payload: baseline[0].payload, sourceAppFrame: 1, sourceKeyId: 'A', newKeyId: 'paste-A' },
      { payload: baseline[2].payload, sourceAppFrame: 5, sourceKeyId: 'C', newKeyId: 'paste-C' },
    ] as const;
    const cases: readonly {
      readonly intent: PhysicPaintRotoPhysicalEditIntent;
      readonly diverge: (payload: PhysicalMapPayload) => PhysicalMapPayload;
    }[] = [
      {
        intent: { kind: 'insert-empty-segment', destinationAppFrame: 7, insertedKeyId: 'blank-7', blankPayload: blank },
        diverge: (payload) => ({ ...payload, selectedKeyId: 'A', selectedAppFrame: 1 }),
      },
      {
        intent: { kind: 'delete-key', selectedKeyId: 'B' },
        diverge: (payload) => ({
          ...payload,
          loopClips: [{ loopId: 'unrelated-delete-loop', placementStart: 20, sourceKeyIds: ['A', 'C'], repeat: 2, mode: 'static' }],
        }),
      },
      {
        intent: { kind: 'delete-key-group', keyIds: ['B', 'C'] },
        diverge: (payload) => ({ ...payload, incomingInterpolationBreakKeyIds: [] }),
      },
      {
        intent: { kind: 'move-key', movedKeyId: 'B', target: { kind: 'after-key', targetKeyId: 'C' } },
        diverge: (payload) => ({ ...payload, selectedKeyId: 'A', selectedAppFrame: 1 }),
      },
      {
        intent: { kind: 'move-key-group', movedKeyIds: ['B', 'C'], grabbedKeyId: 'B', target: { kind: 'physical-cell', appFrame: 7 } },
        diverge: (payload) => ({
          ...payload,
          records: payload.records.map((record) => record.keyId === 'A'
            ? { ...record, appFrame: 0, payload: { ...record.payload, appFrame: 0 } }
            : record),
        }),
      },
      {
        intent: { kind: 'force-spacing', emptyFrames: 2, selectedKeyId: null },
        diverge: (payload) => ({ ...payload, selectedKeyId: 'A', selectedAppFrame: 1 }),
      },
      {
        intent: { kind: 'duplicate-key', sourceKeyId: 'A', newKeyId: 'duplicate-A' },
        diverge: (payload) => ({
          ...payload,
          loopClips: [{ loopId: 'unrelated-duplicate-loop', placementStart: 20, sourceKeyIds: ['A', 'duplicate-A'], repeat: 2, mode: 'static' }],
        }),
      },
      {
        intent: { kind: 'paste-key', destinationAppFrame: 3, destinationKeyId: 'B', newKeyId: null, clipboardPayload: baseline[0].payload },
        diverge: (payload) => ({ ...payload, incomingInterpolationBreakKeyIds: [] }),
      },
      {
        intent: { kind: 'paste-key-group', destinationAppFrame: 12, entries: pasteGroupEntries },
        diverge: (payload) => ({
          ...payload,
          loopClips: [{ loopId: 'unrelated-group-paste-loop', placementStart: 20, sourceKeyIds: ['paste-A', 'paste-C'], repeat: 2, mode: 'static' }],
        }),
      },
    ];

    for (const { intent, diverge } of cases) {
      physicPaintStore.reset();
      seedPhysicalDocument(layer.id, baseline, { enabled: false, mode: 'duplicate' }, ['D']);
      const launch = await openPhysicPaintCanvas({ layer, frame: 3 });
      expect(launch.ok, intent.kind).toBe(true);
      if (!launch.ok) throw new Error(`${intent.kind} launch must resolve`);
      const leaseToken = acquirePhysicalLease(layer.id);
      const resolution = resolvePhysicPaintRotoPhysicalEdit({
        identities: baseline.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        records: baseline,
        intent,
        parentEndExclusive: carriedRotoPhysical(launch.data).capacity,
        capacity: carriedRotoPhysical(launch.data).capacity,
        interpolationEnabled: false,
        loopClips: [],
        incomingInterpolationBreakKeyIds: ['D'],
      });
      expect(resolution.ok, intent.kind).toBe(true);
      if (!resolution.ok) throw new Error(`${intent.kind} must resolve canonically`);
      const proposal = resolution.proposal;
      const canonicalRecords = (proposal.nextRecords ?? proposal.orderedKeyIds.map((keyId) => {
        const current = baseline.find((record) => record.keyId === keyId);
        const appFrame = proposal.mapping.get(keyId);
        if (!current || appFrame === undefined) throw new Error(`Missing canonical ${intent.kind} record`);
        return movePhysicalRecord(current, appFrame);
      })).map(({ kind: _kind, ...record }) => record);
      const canonicalLoopClips = proposal.nextLoopClips ?? [];
      const canonicalBreaks = proposal.nextIncomingInterpolationBreakKeyIds ?? ['D'];
      const payload = {
        kind: 'replace-roto-physical-map',
        trackId: TEST_TRACK_ID,
        operationId: `ordinary-parent-gate-${intent.kind}`,
        operationKind: intent.kind,
        intent,
        layerId: layer.id,
        leaseToken,
        startFrame: proposal.selectedAppFrame ?? 0,
        launchOperationId: launch.data.operationId,
        expectedRevision: carriedRotoPhysical(launch.data).revision,
        records: canonicalRecords,
        interpolationEnabled: false,
        interpolationMode: 'duplicate',
        loopClips: canonicalLoopClips,
        incomingInterpolationBreakKeyIds: canonicalBreaks,
        selectedKeyId: proposal.selectedKeyId,
        selectedAppFrame: proposal.selectedAppFrame,
        cursorAppFrame: proposal.selectedAppFrame ?? carriedRotoPhysical(launch.data).cursorAppFrame,
        ...(proposal.semanticDelta ? { semanticDelta: proposal.semanticDelta } : {}),
      } as PhysicalMapPayload;
      const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
      const beforeRevisionSignal = rotoPhysicalRevision.peek();
      const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

      const rejected = await applyPhysicPaintPayload(diverge(payload));

      expect(rejected.ok, `${intent.kind} divergent proposal`).toBe(false);
      expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID), intent.kind).toEqual(beforeDocument);
      expect(rotoPhysicalRevision.peek(), intent.kind).toBe(beforeRevisionSignal);
      expect(replace, intent.kind).not.toHaveBeenCalled();

      const accepted = await applyPhysicPaintPayload(payload);
      const duplicateDelivery = await applyPhysicPaintPayload(payload);

      expect(accepted.ok, `${intent.kind} canonical proposal`).toBe(true);
      expect(duplicateDelivery, intent.kind).toEqual(accepted);
      expect(replace, intent.kind).toHaveBeenCalledTimes(1);
      expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toMatchObject({
        realKeyRecords: canonicalRecords.map((record) => ({ kind: 'real-key', ...record })),
        loopClips: canonicalLoopClips,
        incomingInterpolationBreakKeyIds: canonicalBreaks,
        selectedKeyId: proposal.selectedKeyId,
        interpolation: { enabled: false, mode: 'duplicate' },
      });
      expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);
      replace.mockRestore();
    }
  });

  it('accepts and replays a moved local-boundary Infinity Group with the child-authoritative pre-move cursor', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    sequenceStore.add({
      id: 'bridge-override-move-sequence',
      kind: 'fx',
      name: 'Bridge override move authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 10,
      outFrame: 60,
    });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const records = [
      makePhysicalRecord('A', 10),
      makePhysicalRecord('B', 11),
      makePhysicalRecord('N', 30),
      makePhysicalRecord('O', 31),
    ];
    const groupOverrideRecords = [makePhysicalRecord('override-B', 11)];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const loopClips = [{
      loopId: 'loop-infinity',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity' as const,
      mode: 'static' as const,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 10, endExclusive: 30 }],
      frameOverrides: [{ appFrame: 11, keyId: 'override-B' }],
    }, {
      loopId: 'loop-next',
      placementStart: 30,
      sourceKeyIds: ['N', 'O'],
      repeat: 2 as const,
      mode: 'static' as const,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 30,
      originalEndExclusive: 34,
      visibleRanges: [{ start: 30, endExclusive: 34 }],
      frameOverrides: [],
    }];
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 50,
      realKeyRecords: records,
      groupOverrideRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 10,
      revision: buildPhysicPaintRotoPhysicalRevision(
        records,
        interpolation,
        loopClips,
        [],
        groupOverrideRecords,
      ),
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    const launch = await openPhysicPaintCanvas({ layer, frame: 20 });
    if (!launch.ok) throw new Error('Expected physical launch authority.');
    expect(launch.data).toMatchObject({ startFrame: 10 });
    expect(carriedRotoPhysical(launch.data)).toMatchObject({ cursorAppFrame: 10, capacity: 50 });
    const intent = {
      kind: 'move-group' as const,
      loopId: 'loop-infinity',
      destinationPlacementStart: 14,
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent,
      parentEndExclusive: 50,
      capacity: 50,
      interpolationEnabled: false,
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });
    if (!resolution.ok) {
      throw new Error('Expected canonical Infinity Group move proposal.');
    }
    const proposal = resolution.proposal;
    const nextLoopClips = proposal.nextLoopClips;
    if (!nextLoopClips) throw new Error('Expected moved Infinity Group clips.');
    const proposedRecords = proposal.orderedKeyIds.map((keyId) => {
      const current = records.find((record) => record.keyId === keyId);
      const appFrame = proposal.mapping.get(keyId);
      if (!current || appFrame === undefined) throw new Error(`Missing moved record ${keyId}.`);
      return movePhysicalRecord(current, appFrame);
    });
    const proposedGroupOverrideRecords = [movePhysicalRecord(groupOverrideRecords[0], 15)];
    const movedGroup = nextLoopClips.find((clip) => clip.loopId === intent.loopId);
    expect(movedGroup?.frameOverrides).toEqual([{ appFrame: 15, keyId: 'override-B' }]);
    expect(proposedGroupOverrideRecords[0]).toMatchObject({
      keyId: 'override-B',
      appFrame: 15,
      payload: { appFrame: 15 },
    });
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!beforeDocument) throw new Error('Expected pre-move physical document.');
    const childBeforeDocument = Object.freeze({
      ...beforeDocument,
      selectedKeyId: null,
      cursorAppFrame: 14,
    });
    expect(childBeforeDocument.revision).toBe(beforeDocument.revision);
    const leaseToken = acquirePhysicalLease(layer.id);

    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'move-infinity-group-with-override',
      operationKind: 'move-group',
      intent,
      layerId: layer.id,
      leaseToken,
      startFrame: 14,
      cursorAppFrame: 14,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: proposedRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: proposedGroupOverrideRecords.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: proposal.nextLoopClips,
      incomingInterpolationBreakKeyIds: proposal.nextIncomingInterpolationBreakKeyIds ?? [],
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    expect(acceptedDocument?.groupOverrideRecords).toEqual(proposedGroupOverrideRecords);
    expect(acceptedDocument?.loopClips.find((clip) => clip.loopId === 'loop-infinity')).toMatchObject({
      placementStart: 14,
      phaseOrigin: 14,
      frameOverrides: [{ appFrame: 15, keyId: 'override-B' }],
    });
    if (!acceptedDocument || !result.ok) throw new Error('Expected accepted moved document.');
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);

    const undoLease = acquirePhysicalLease(layer.id);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'move-infinity-group-with-override-undo',
      operationKind: 'undo',
      layerId: layer.id,
      leaseToken: undoLease,
      startFrame: childBeforeDocument.cursorAppFrame,
      cursorAppFrame: childBeforeDocument.cursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: acceptedDocument.revision,
      records: childBeforeDocument.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (childBeforeDocument.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: childBeforeDocument.interpolation.enabled,
      interpolationMode: childBeforeDocument.interpolation.mode,
      loopClips: childBeforeDocument.loopClips,
      incomingInterpolationBreakKeyIds: childBeforeDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: childBeforeDocument.selectedKeyId,
      selectedAppFrame: childBeforeDocument.selectedKeyId === null ? null : childBeforeDocument.cursorAppFrame,
      historyProvenance: {
        historyCommandId: 'move-infinity-group-with-override',
        historyDirection: 'undo',
        sourceRevision: acceptedDocument.revision,
        targetRevision: beforeDocument.revision,
      },
    });
    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(childBeforeDocument);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);

    const redoLease = acquirePhysicalLease(layer.id);
    const redo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'move-infinity-group-with-override-redo',
      operationKind: 'redo',
      layerId: layer.id,
      leaseToken: redoLease,
      startFrame: acceptedDocument.cursorAppFrame,
      cursorAppFrame: acceptedDocument.cursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: beforeDocument.revision,
      records: acceptedDocument.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (acceptedDocument.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: acceptedDocument.interpolation.enabled,
      interpolationMode: acceptedDocument.interpolation.mode,
      loopClips: acceptedDocument.loopClips,
      incomingInterpolationBreakKeyIds: acceptedDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: acceptedDocument.selectedKeyId,
      selectedAppFrame: acceptedDocument.selectedKeyId === null ? null : acceptedDocument.cursorAppFrame,
      historyProvenance: {
        historyCommandId: 'move-infinity-group-with-override',
        historyDirection: 'redo',
        sourceRevision: beforeDocument.revision,
        targetRevision: acceptedDocument.revision,
      },
    });
    expect(redo.ok, redo.ok ? undefined : redo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(acceptedDocument);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(redoLease)).toBe(true);
  });

  it('accepts and replays a moved Key Rail through the parent replay-target snapshot (43.4 defect 2)', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    sequenceStore.add({
      id: 'bridge-key-rail-sequence',
      kind: 'fx',
      name: 'Bridge Key Rail authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 100,
    });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const records = [
      makePhysicalRecord('A', 0),
      makePhysicalRecord('B', 2),
      makePhysicalRecord('C', 6),
      makePhysicalRecord('D', 8),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 50,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'A',
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, [], ['C'], []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['C'],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error('Expected physical launch authority.');
    const intent = {
      kind: 'move-key-rail' as const,
      memberKeyIds: ['A', 'B'],
      destinationFirstKeyAppFrame: 1,
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent,
      parentEndExclusive: 50,
      capacity: 50,
      interpolationEnabled: false,
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['C'],
    });
    if (!resolution.ok) throw new Error('Expected canonical Key Rail move proposal.');
    const proposal = resolution.proposal;
    const proposedRecords = proposal.orderedKeyIds.map((keyId) => {
      const current = records.find((record) => record.keyId === keyId);
      const appFrame = proposal.mapping.get(keyId);
      if (!current || appFrame === undefined) throw new Error(`Missing moved record ${keyId}.`);
      return movePhysicalRecord(current, appFrame);
    });
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!beforeDocument) throw new Error('Expected pre-move physical document.');
    const leaseToken = acquirePhysicalLease(layer.id);
    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'move-key-rail-commit',
      operationKind: 'move-key-rail',
      intent,
      layerId: layer.id,
      leaseToken,
      startFrame: 1,
      cursorAppFrame: 1,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: proposedRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: [],
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: proposal.nextLoopClips ?? [],
      incomingInterpolationBreakKeyIds: proposal.nextIncomingInterpolationBreakKeyIds ?? [],
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!acceptedDocument || !result.ok) throw new Error('Expected accepted moved document.');
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);

    const undoLease = acquirePhysicalLease(layer.id);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'move-key-rail-undo',
      operationKind: 'undo',
      layerId: layer.id,
      leaseToken: undoLease,
      startFrame: beforeDocument.cursorAppFrame,
      cursorAppFrame: beforeDocument.cursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: acceptedDocument.revision,
      records: beforeDocument.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (beforeDocument.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: beforeDocument.interpolation.enabled,
      interpolationMode: beforeDocument.interpolation.mode,
      loopClips: beforeDocument.loopClips,
      incomingInterpolationBreakKeyIds: beforeDocument.incomingInterpolationBreakKeyIds,
      // The replay must submit the document's pre-commit selection (the same
      // authority the parent's before snapshot captured) — 43.4 defect 2.
      selectedKeyId: beforeDocument.selectedKeyId,
      selectedAppFrame: beforeDocument.selectedKeyId === null ? null : beforeDocument.cursorAppFrame,
      historyProvenance: {
        historyCommandId: 'move-key-rail-commit',
        historyDirection: 'undo',
        sourceRevision: acceptedDocument.revision,
        targetRevision: beforeDocument.revision,
      },
    });
    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(beforeDocument);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);
  });

  it.each([
    {
      name: 'scissor',
      intent: { kind: 'scissor-key-rail' as const, breakOwnerKeyId: 'B' },
      operationKind: 'scissor-key-rail' as const,
      operationId: 'scissor-key-rail-commit',
      undoOperationId: 'scissor-key-rail-undo',
    },
    {
      name: 'delete',
      intent: { kind: 'delete-key-rail' as const, keyIds: ['A', 'B'] },
      operationKind: 'delete-key-rail' as const,
      operationId: 'delete-key-rail-commit',
      undoOperationId: 'delete-key-rail-undo',
    },
  ])('accepts and replays a $name Key Rail through the parent replay-target snapshot (43.4 defect 4)', async ({ intent, operationKind, operationId, undoOperationId }) => {
    const layer = physicLayer();
    mockLayers([layer], null);
    sequenceStore.add({
      id: `bridge-${operationKind}-sequence`,
      kind: 'fx',
      name: `Bridge ${operationKind} authority`,
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 100,
    });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const records = [
      makePhysicalRecord('A', 0),
      makePhysicalRecord('B', 2),
      makePhysicalRecord('C', 6),
      makePhysicalRecord('D', 8),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 50,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'B',
      cursorAppFrame: 2,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, [], ['C'], []),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['C'],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error('Expected physical launch authority.');
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent,
      parentEndExclusive: 50,
      capacity: 50,
      interpolationEnabled: false,
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['C'],
    });
    if (!resolution.ok) throw new Error('Expected canonical Key Rail proposal.');
    const proposal = resolution.proposal;
    const proposedRecords = proposal.orderedKeyIds.map((keyId) => {
      const current = records.find((record) => record.keyId === keyId);
      const appFrame = proposal.mapping.get(keyId);
      if (!current || appFrame === undefined) throw new Error(`Missing record ${keyId}.`);
      return movePhysicalRecord(current, appFrame);
    });
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!beforeDocument) throw new Error('Expected pre-edit physical document.');
    const leaseToken = acquirePhysicalLease(layer.id);
    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId,
      operationKind,
      intent,
      layerId: layer.id,
      leaseToken,
      startFrame: proposal.selectedAppFrame ?? beforeDocument.cursorAppFrame,
      cursorAppFrame: proposal.selectedAppFrame ?? beforeDocument.cursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: proposedRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: [],
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: proposal.nextLoopClips ?? [],
      incomingInterpolationBreakKeyIds: proposal.nextIncomingInterpolationBreakKeyIds ?? [],
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!acceptedDocument || !result.ok) throw new Error('Expected accepted document.');
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);

    const undoLease = acquirePhysicalLease(layer.id);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: undoOperationId,
      operationKind: 'undo',
      layerId: layer.id,
      leaseToken: undoLease,
      startFrame: beforeDocument.cursorAppFrame,
      cursorAppFrame: beforeDocument.cursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: acceptedDocument.revision,
      records: beforeDocument.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (beforeDocument.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: beforeDocument.interpolation.enabled,
      interpolationMode: beforeDocument.interpolation.mode,
      loopClips: beforeDocument.loopClips,
      incomingInterpolationBreakKeyIds: beforeDocument.incomingInterpolationBreakKeyIds,
      // The replay must submit the document's pre-commit selection (the same
      // authority the parent's before snapshot captured) — 43.4 defect 4.
      selectedKeyId: beforeDocument.selectedKeyId,
      selectedAppFrame: beforeDocument.selectedKeyId === null ? null : beforeDocument.cursorAppFrame,
      historyProvenance: {
        historyCommandId: operationId,
        historyDirection: 'undo',
        sourceRevision: acceptedDocument.revision,
        targetRevision: beforeDocument.revision,
      },
    });
    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(beforeDocument);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);
  });

  it('recomputes Infinity Group movement against the child document capacity (43.4 defect 1)', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    sequenceStore.sequences.value = [{
      id: 'bridge-content-before-sequence',
      kind: 'content',
      name: 'Bridge content before authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'bridge-content-before-key', imageId: 'bridge-before-image', holdFrames: 10 }],
      layers: [],
    }, {
      id: 'bridge-content-parent-end-sequence',
      kind: 'content',
      name: 'Bridge content parent end authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'bridge-content-parent-key', imageId: 'bridge-parent-image', holdFrames: 30 }],
      layers: [layer],
    }];
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const records = [
      makePhysicalRecord('A', 10),
      makePhysicalRecord('B', 12),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const loopClips = [{
      loopId: 'loop-infinity-parent-end',
      placementStart: 10,
      sourceKeyIds: ['A', 'B'],
      repeat: 'infinity' as const,
      mode: 'static' as const,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 10,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 10, endExclusive: 30 }],
      frameOverrides: [],
    }];
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 600,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 10,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, []),
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    const launch = await openPhysicPaintCanvas({ layer, frame: 20 });
    if (!launch.ok) throw new Error('Expected physical launch authority.');
    expect(launch.data).toMatchObject({ startFrame: 10 });
    expect(carriedRotoPhysical(launch.data)).toMatchObject({ capacity: 30, cursorAppFrame: 10 });
    const intent = {
      kind: 'move-group' as const,
      loopId: 'loop-infinity-parent-end',
      destinationPlacementStart: 16,
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent,
      parentEndExclusive: 30,
      // D-25/Q4 fold: the parent store capacity is the child document
      // capacity (layerEndExclusive 30), so the canonical resolution must
      // recompute against 30, never the stale seeded 600.
      capacity: 30,
      interpolationEnabled: false,
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });
    if (!resolution.ok) {
      throw new Error('Expected canonical local-F30 Infinity Group move proposal.');
    }
    const proposal = resolution.proposal;
    const nextLoopClips = proposal.nextLoopClips;
    if (!nextLoopClips) throw new Error('Expected moved local-F30 Infinity Group clips.');
    expect(nextLoopClips[0]).toMatchObject({
      placementStart: 16,
      phaseOrigin: 16,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 16, endExclusive: 30 }],
    });
    const proposedRecords = proposal.orderedKeyIds.map((keyId) => {
      const current = records.find((record) => record.keyId === keyId);
      const appFrame = proposal.mapping.get(keyId);
      if (!current || appFrame === undefined) throw new Error(`Missing moved record ${keyId}.`);
      return movePhysicalRecord(current, appFrame);
    });
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const leaseToken = acquirePhysicalLease(layer.id);

    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'move-infinity-group-at-parent-end',
      operationKind: 'move-group',
      intent,
      layerId: layer.id,
      leaseToken,
      startFrame: 16,
      cursorAppFrame: 16,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: proposedRecords.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: proposal.nextLoopClips,
      incomingInterpolationBreakKeyIds: proposal.nextIncomingInterpolationBreakKeyIds ?? [],
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    });

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)?.loopClips[0]).toMatchObject({
      placementStart: 16,
      originalEndExclusive: 30,
      visibleRanges: [{ start: 16, endExclusive: 30 }],
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).not.toEqual(beforeDocument);
    expect(rotoPhysicalRevision.peek()).not.toBe(beforeRevisionSignal);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);
  });

  it('rejects replay of an equal-revision command from another project context without mutation or publication', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const records = [
      makePhysicalRecord('A', 0),
      makePhysicalRecord('B', 10),
    ];
    seedPhysicalDocument(layer.id, records);
    projectStore.projectContextId.value = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launchA = await openPhysicPaintCanvas({ layer, frame: 10 });

    expect(launchA.ok).toBe(true);
    if (!launchA.ok) return;
    const projectALease = acquirePhysicalLease(layer.id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    const accepted = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'project-A-command',
      operationKind: 'move-key',
      intent: {
        kind: 'move-key',
        movedKeyId: 'B',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      leaseToken: projectALease,
      startFrame: 10,
      launchOperationId: launchA.data.operationId,
      projectContextId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      expectedRevision: carriedRotoPhysical(launchA.data).revision,
      records: payloadRecords(carriedRotoPhysical(launchA.data)),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'B',
      selectedAppFrame: 10,
      cursorAppFrame: 10,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok || !('acceptedRevision' in accepted)) return;
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(projectALease)).toBe(true);

    projectStore.projectContextId.value = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const launchB = await openPhysicPaintCanvas({ layer, frame: 10 });
    expect(launchB.ok).toBe(true);
    if (!launchB.ok) return;
    const projectBLease = acquirePhysicalLease(layer.id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const beforeReplay = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const dispatch = window.dispatchEvent as ReturnType<typeof vi.fn>;
    dispatch.mockClear();

    const replay = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'project-B-replay-project-A-command',
      operationKind: 'undo',
      layerId: layer.id,
      leaseToken: projectBLease,
      startFrame: 0,
      launchOperationId: launchB.data.operationId,
      projectContextId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      expectedRevision: accepted.acceptedRevision,
      records: records.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: null,
      selectedAppFrame: null,
      cursorAppFrame: 0,
      historyProvenance: {
        historyCommandId: 'project-A-command',
        historyDirection: 'undo',
        sourceRevision: accepted.acceptedRevision,
        targetRevision: carriedRotoPhysical(launchA.data).revision,
      },
    });

    expect(replay.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(beforeReplay);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(projectBLease)).toBe(true);
  });

  it('rejects null-selection replay when only the explicit cursor authority differs', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const records = [
      makePhysicalRecord('A', 0),
      makePhysicalRecord('B', 10),
    ];
    seedPhysicalDocument(layer.id, records);
    projectStore.projectContextId.value = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });

    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const commandLease = acquirePhysicalLease(layer.id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(physicPaintStore.setRotoPhysicalSelection(layer.id, TEST_TRACK_ID, null, 0)).toEqual({ ok: true });
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records,
      intent: { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null },
      parentEndExclusive: carriedRotoPhysical(launch.data).capacity,
      capacity: carriedRotoPhysical(launch.data).capacity,
      interpolationEnabled: false,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    const spacedRecords = resolution.proposal.orderedKeyIds.map((keyId) => {
      const record = records.find((candidate) => candidate.keyId === keyId);
      const appFrame = resolution.proposal.mapping.get(keyId);
      if (!record || appFrame === undefined) throw new Error(`Missing spaced record ${keyId}`);
      const { kind: _kind, ...moved } = movePhysicalRecord(record, appFrame);
      return moved;
    });
    const accepted = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'null-selection-command',
      operationKind: 'force-spacing',
      intent: { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null },
      layerId: layer.id,
      leaseToken: commandLease,
      startFrame: 4,
      launchOperationId: launch.data.operationId,
      projectContextId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: spacedRecords,
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: null,
      selectedAppFrame: null,
      cursorAppFrame: 4,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok || !('acceptedRevision' in accepted)) return;
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(commandLease)).toBe(true);
    const replayLease = acquirePhysicalLease(layer.id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    const beforeReplay = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!beforeReplay) throw new Error('Expected complete pre-rejection physical document.');
    const beforeReplayIntegrity = {
      revision: beforeReplay.revision,
      records: beforeReplay.realKeyRecords,
      groupOverrideRecords: beforeReplay.groupOverrideRecords ?? [],
      interpolation: beforeReplay.interpolation,
      loopClips: beforeReplay.loopClips,
      incomingInterpolationBreakKeyIds: beforeReplay.incomingInterpolationBreakKeyIds,
      selectedKeyId: beforeReplay.selectedKeyId,
      cursorAppFrame: beforeReplay.cursorAppFrame,
      capacity: beforeReplay.capacity,
    };
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const dispatch = window.dispatchEvent as ReturnType<typeof vi.fn>;
    dispatch.mockClear();

    const replay = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'null-selection-wrong-cursor-undo',
      operationKind: 'undo',
      layerId: layer.id,
      leaseToken: replayLease,
      startFrame: 1,
      launchOperationId: launch.data.operationId,
      projectContextId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      expectedRevision: accepted.acceptedRevision,
      records: records.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: null,
      selectedAppFrame: null,
      cursorAppFrame: 1,
      historyProvenance: {
        historyCommandId: 'null-selection-command',
        historyDirection: 'undo',
        sourceRevision: accepted.acceptedRevision,
        targetRevision: carriedRotoPhysical(launch.data).revision,
      },
    });

    expect(replay.ok).toBe(false);
    expect(replay.ok ? null : replay.error).toBe('Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical replay target snapshot does not match the original accepted command.');
    const afterReplay = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    expect(afterReplay).toEqual(beforeReplay);
    expect(afterReplay && {
      revision: afterReplay.revision,
      records: afterReplay.realKeyRecords,
      groupOverrideRecords: afterReplay.groupOverrideRecords ?? [],
      interpolation: afterReplay.interpolation,
      loopClips: afterReplay.loopClips,
      incomingInterpolationBreakKeyIds: afterReplay.incomingInterpolationBreakKeyIds,
      selectedKeyId: afterReplay.selectedKeyId,
      cursorAppFrame: afterReplay.cursorAppFrame,
      capacity: afterReplay.capacity,
    }).toEqual(beforeReplayIntegrity);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(replayLease)).toBe(true);
  });

  it('removes accepted command authorization when the layer launch authority is replaced', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const records = [
      makePhysicalRecord('A', 0),
      makePhysicalRecord('B', 10),
    ];
    seedPhysicalDocument(layer.id, records);
    projectStore.projectContextId.value = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const firstLaunch = await openPhysicPaintCanvas({ layer, frame: 10 });
    expect(firstLaunch.ok).toBe(true);
    if (!firstLaunch.ok) return;
    const commandLease = acquirePhysicalLease(layer.id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');

    const command = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'replaced-launch-command',
      operationKind: 'move-key',
      leaseToken: commandLease,
      intent: {
        kind: 'move-key',
        movedKeyId: 'B',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: firstLaunch.data.operationId,
      projectContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      expectedRevision: carriedRotoPhysical(firstLaunch.data).revision,
      records: payloadRecords(carriedRotoPhysical(firstLaunch.data)),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'B',
      selectedAppFrame: 10,
      cursorAppFrame: 10,
    });
    expect(command.ok).toBe(true);
    if (!command.ok || !('acceptedRevision' in command)) return;
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(commandLease)).toBe(true);

    const replacementLaunch = await openPhysicPaintCanvas({ layer, frame: 10 });
    expect(replacementLaunch.ok).toBe(true);
    if (!replacementLaunch.ok) return;
    const replayLease = acquirePhysicalLease(layer.id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    const beforeReplay = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const replay = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'replaced-launch-replay',
      operationKind: 'undo',
      layerId: layer.id,
      leaseToken: replayLease,
      startFrame: 0,
      launchOperationId: replacementLaunch.data.operationId,
      projectContextId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      expectedRevision: command.acceptedRevision,
      records: records.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: null,
      selectedAppFrame: null,
      cursorAppFrame: 0,
      historyProvenance: {
        historyCommandId: 'replaced-launch-command',
        historyDirection: 'undo',
        sourceRevision: command.acceptedRevision,
        targetRevision: carriedRotoPhysical(firstLaunch.data).revision,
      },
    });

    expect(replay).toMatchObject({
      ok: false,
      error: expect.stringContaining('unknown accepted command'),
    });
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(beforeReplay);
    expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    expect(replace).not.toHaveBeenCalled();
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(replayLease)).toBe(true);
  });

  it('preserves one stable-key-owned incoming interpolation break across canonical ordinary edits', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    seedPhysicalDocument(layer.id, [
      makePhysicalRecord('key-0', 0),
      makePhysicalRecord('key-10', 10),
    ], { enabled: true, mode: 'duplicate' }, ['key-10']);
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 10 });

    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const records = payloadRecords(carriedRotoPhysical(launch.data));
    const firstLease = acquirePhysicalLease(layer.id);
    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'accept-incoming-break',
      operationKind: 'move-key',
      leaseToken: firstLease,
      intent: {
        kind: 'move-key',
        movedKeyId: 'key-10',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      incomingInterpolationBreakKeyIds: ['key-10'],
      selectedKeyId: 'key-10',
      selectedAppFrame: 10,
      cursorAppFrame: 10,
    });

    expect(result).toMatchObject({
      ok: true,
      operationId: 'accept-incoming-break',
      incomingInterpolationBreakKeyIds: ['key-10'],
    });
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(firstLease)).toBe(true);
    const document = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    expect(document?.incomingInterpolationBreakKeyIds).toEqual(['key-10']);
    expect(Object.isFrozen(document?.incomingInterpolationBreakKeyIds)).toBe(true);

    const omittedLease = acquirePhysicalLease(layer.id);
    const omitted = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'retain-omitted-incoming-break',
      operationKind: 'move-key',
      leaseToken: omittedLease,
      intent: {
        kind: 'move-key',
        movedKeyId: 'key-10',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      expectedRevision: document!.revision,
      records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      selectedKeyId: 'key-10',
      selectedAppFrame: 10,
      cursorAppFrame: 10,
    });
    expect(omitted.ok).toBe(true);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(omittedLease)).toBe(true);
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layer.id, TEST_TRACK_ID)).toEqual(['key-10']);

    const retainedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)!;
    const clearedLease = acquirePhysicalLease(layer.id);
    const cleared = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'clear-explicit-incoming-break',
      operationKind: 'move-key',
      leaseToken: clearedLease,
      intent: {
        kind: 'move-key',
        movedKeyId: 'key-10',
        target: { kind: 'physical-cell', appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      expectedRevision: retainedDocument.revision,
      records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate',
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: 'key-10',
      selectedAppFrame: 10,
      cursorAppFrame: 10,
    });
    expect(cleared.ok).toBe(false);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(clearedLease)).toBe(true);
    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds(layer.id, TEST_TRACK_ID)).toEqual(['key-10']);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)?.revision).toBe(retainedDocument.revision);

    expect(physicPaintStore.getRotoPhysicalIncomingInterpolationBreakKeyIds('missing-layer', TEST_TRACK_ID)).toBe(
      PHYSIC_PAINT_ROTO_INCOMING_INTERPOLATION_BREAK_KEY_IDS_EMPTY,
    );
    const freshLayer = physicLayer({
      id: 'fresh-layer',
      source: { type: 'physic-paint', layerId: 'fresh-layer' },
    });
    setParentSequence([freshLayer], 600);
    registerTrackDocument('fresh-layer');
    const fresh = createPhysicPaintLaunchContext(freshLayer, 0);
    expect(carriedRotoPhysical(fresh).incomingInterpolationBreakKeyIds).toEqual([]);
    expect(Object.isFrozen(carriedRotoPhysical(fresh).incomingInterpolationBreakKeyIds)).toBe(true);
    open.mockRestore();
  });

  it('rejects malformed duplicate orphan or stale incoming interpolation breaks without mutation', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    seedPhysicalDocument(layer.id, [
      makePhysicalRecord('key-0', 0),
      makePhysicalRecord('key-10', 10),
    ], { enabled: true, mode: 'duplicate' }, ['key-10']);
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 10 });

    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    const basePayload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationKind: 'move-key' as const,
      intent: {
        kind: 'move-key' as const,
        movedKeyId: 'key-10',
        target: { kind: 'physical-cell' as const, appFrame: 10 },
      },
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: payloadRecords(carriedRotoPhysical(launch.data)),
      interpolationEnabled: true,
      interpolationMode: 'duplicate' as const,
      selectedKeyId: 'key-10',
      selectedAppFrame: 10,
      cursorAppFrame: 10,
    };
    const proposals: readonly { operationId: string; expectedRevision?: string; incomingInterpolationBreakKeyIds: unknown }[] = [
      { operationId: 'reject-malformed-incoming-break', incomingInterpolationBreakKeyIds: 'key-10' },
      { operationId: 'reject-duplicate-incoming-break', incomingInterpolationBreakKeyIds: ['key-10', 'key-10'] },
      { operationId: 'reject-orphan-incoming-break', incomingInterpolationBreakKeyIds: ['missing-key'] },
      { operationId: 'reject-stale-incoming-break', expectedRevision: 'physical-stale', incomingInterpolationBreakKeyIds: ['key-10'] },
    ];

    for (const proposal of proposals) {
      const result = await applyPhysicPaintPayload({
        ...basePayload,
        ...proposal,
      });
      expect(result.ok).toBe(false);
      expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(beforeDocument);
      expect(rotoPhysicalRevision.peek()).toBe(beforeRevisionSignal);
    }
    open.mockRestore();
  });

  it('validates insert-empty-segment semantics independently', async () => {
    installCanonicalBlankCanvas();
    const layer = physicLayer();
    mockLayers([layer]);
    seedPhysicalDocument(layer.id, [
      makePhysicalRecord('key-0', 0),
      makePhysicalRecord('key-10', 10),
    ], { enabled: false, mode: 'duplicate' }, ['key-10']);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 5 });

    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const leaseToken = acquirePhysicalLease(layer.id);
    const inserted = makeEmptySegmentRecord('key-5', 5);
    const records = [...payloadRecords(carriedRotoPhysical(launch.data)), inserted]
      .sort((left, right) => left.appFrame - right.appFrame);
    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'insert-empty-segment-valid',
      operationKind: 'insert-empty-segment',
      leaseToken,
      intent: {
        kind: 'insert-empty-segment',
        destinationAppFrame: 5,
        insertedKeyId: 'key-5',
        blankPayload: inserted.payload,
      },
      layerId: layer.id,
      startFrame: 5,
      launchOperationId: launch.data.operationId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records,
      interpolationEnabled: false,
      interpolationMode: 'duplicate',
      incomingInterpolationBreakKeyIds: ['key-10'],
      selectedKeyId: 'key-5',
      selectedAppFrame: 5,
      cursorAppFrame: 5,
      semanticDelta: {
        kind: 'insert-empty-segment',
        insertedKeyId: 'key-5',
        destinationAppFrame: 5,
      },
    });

    expect(result).toMatchObject({
      ok: true,
      operationId: 'insert-empty-segment-valid',
      incomingInterpolationBreakKeyIds: ['key-10'],
    });
    const accepted = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    expect(accepted).toMatchObject({
      selectedKeyId: 'key-5',
      cursorAppFrame: 5,
      interpolation: { enabled: false, mode: 'duplicate' },
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['key-10'],
    });
    expect(result.ok && 'acceptedRevision' in result ? result.acceptedRevision : null).toBe(accepted?.revision);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);
  });

  it('rejects stale false or unrelated empty-segment deltas without mutation', async () => {
    installCanonicalBlankCanvas();
    const layer = physicLayer();
    mockLayers([layer]);
    seedPhysicalDocument(layer.id, [
      makePhysicalRecord('key-0', 0),
      makePhysicalRecord('key-10', 10),
    ], { enabled: true, mode: 'duplicate' }, ['key-10']);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 12 });

    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const leaseToken = acquirePhysicalLease(layer.id);
    const inserted = makeEmptySegmentRecord('key-12', 12);
    const records = [...payloadRecords(carriedRotoPhysical(launch.data)), inserted]
      .sort((left, right) => left.appFrame - right.appFrame);
    const basePayload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationKind: 'insert-empty-segment' as const,
      intent: {
        kind: 'insert-empty-segment' as const,
        destinationAppFrame: 12,
        insertedKeyId: 'key-12',
        blankPayload: inserted.payload,
      },
      layerId: layer.id,
      leaseToken,
      startFrame: 12,
      launchOperationId: launch.data.operationId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records,
      interpolationEnabled: true,
      interpolationMode: 'duplicate' as const,
      incomingInterpolationBreakKeyIds: ['key-10', 'key-12'],
      selectedKeyId: 'key-12',
      selectedAppFrame: 12,
      cursorAppFrame: 12,
      semanticDelta: {
        kind: 'insert-empty-segment' as const,
        insertedKeyId: 'key-12',
        destinationAppFrame: 12,
      },
    };
    const proposals: readonly PhysicPaintApplyPayload[] = [
      {
        ...basePayload,
        operationId: 'reject-empty-segment-false-id',
        semanticDelta: { ...basePayload.semanticDelta, insertedKeyId: 'false-id' },
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-false-destination',
        semanticDelta: { ...basePayload.semanticDelta, destinationAppFrame: 13 },
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-non-blank',
        records: records.map((record) => record.keyId === 'key-12'
          ? makeEmptySegmentRecord('key-12', 12, OPAQUE_ONE_PIXEL_WEBP)
          : record),
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-unrelated-record',
        records: records.map((record) => record.keyId === 'key-0'
          ? { ...record, payload: { ...record.payload, bytes: OPAQUE_ONE_PIXEL_WEBP } }
          : record),
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-extra-break',
        incomingInterpolationBreakKeyIds: ['key-0', 'key-10', 'key-12'],
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-removed-break',
        incomingInterpolationBreakKeyIds: ['key-12'],
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-loop-change',
        loopClips: [{
          loopId: 'unrelated-loop',
          placementStart: 0,
          sourceKeyIds: ['key-0'],
          repeat: 2,
          mode: 'static',
        }],
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-interpolation-change',
        interpolationEnabled: false,
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-cursor-capacity-race',
        cursorAppFrame: 600,
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-capacity-race',
        records: [
          ...payloadRecords(carriedRotoPhysical(launch.data)),
          makeEmptySegmentRecord('key-600', 600),
        ],
        incomingInterpolationBreakKeyIds: ['key-10', 'key-600'],
        selectedKeyId: 'key-600',
        selectedAppFrame: 600,
        intent: {
          kind: 'insert-empty-segment',
          destinationAppFrame: 600,
          insertedKeyId: 'key-600',
          blankPayload: makeEmptySegmentRecord('key-600', 600).payload,
        },
        semanticDelta: {
          kind: 'insert-empty-segment',
          insertedKeyId: 'key-600',
          destinationAppFrame: 600,
        },
      },
      {
        ...basePayload,
        operationId: 'reject-empty-segment-stale',
        expectedRevision: 'physical-stale',
      },
    ];

    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const beforeRevisionSignal = rotoPhysicalRevision.peek();
    for (const proposal of proposals) {
      const result = await applyPhysicPaintPayload(proposal);
      expect(result.ok, proposal.operationId).toBe(false);
      expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID), proposal.operationId).toEqual(beforeDocument);
      expect(rotoPhysicalRevision.peek(), proposal.operationId).toBe(beforeRevisionSignal);
    }
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);
  });

  it('accepts Play Script and Loop Edit authority against a non-first content Sequence local end', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    sequenceStore.sequences.value = [{
      id: 'content-before-fresh-play-script',
      kind: 'content',
      name: 'Content before fresh Play Script',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'content-before-fresh-key', imageId: 'content-before-fresh-image', holdFrames: 10 }],
      layers: [],
    }, {
      id: 'content-fresh-play-script',
      kind: 'content',
      name: 'Fresh content Play Script',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [{ id: 'content-fresh-key', imageId: 'content-fresh-image', holdFrames: 30 }],
      layers: [layer],
    }];
    projectStore.filePath.value = '/tmp/fresh-play-script.mce';
    projectStore.scriptLibraryAuthority.value = '/tmp/fresh-play-script/Scripts';
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 10 });

    expect(launch.ok).toBe(true);
    if (!launch.ok || !launch.data.project) return;
    expect(launch.data).toMatchObject({ startFrame: 0 });
    expect(carriedRotoPhysical(launch.data)).toMatchObject({ cursorAppFrame: 0, capacity: 30 });
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toBeNull();
    const leaseToken = acquirePhysicalLease(layer.id, launch.data.project.contextId);

    const records = Array.from({ length: 5 }, (_, appFrame) => {
      const record = makePhysicalRecord(`generated-${appFrame}`, appFrame);
      return {
        keyId: record.keyId,
        appFrame: record.appFrame,
        payload: {
          ...record.payload,
          bytes: testWebpBytes('iVBORw0KGgo='),
        },
      };
    });
    const rotoBackground = { background: 'canvas1', paperGrain: 'canvas2', grainStrength: 0.45 } as const;
    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'fresh-progressive-play-script',
      operationKind: 'play-script',
      layerId: layer.id,
      leaseToken,
      startFrame: 0,
      launchOperationId: launch.data.operationId,
      projectContextId: launch.data.project.contextId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records,
      interpolationEnabled: carriedRotoPhysical(launch.data).interpolation.enabled,
      interpolationMode: carriedRotoPhysical(launch.data).interpolation.mode,
      rotoBackground,
      loopClips: [{
        loopId: 'fresh-progressive-loop',
        placementStart: 0,
        sourceKeyIds: records.map((record) => record.keyId),
        repeat: 2,
        mode: 'progressive',
        syncState: 'synchronized',
        provenanceState: 'attached',
        phaseOrigin: 0,
        originalEndExclusive: 10,
        visibleRanges: [{ start: 0, endExclusive: 10 }],
        frameOverrides: [],
      }],
      selectedKeyId: records[0].keyId,
      selectedAppFrame: 0,
      cursorAppFrame: 0,
      semanticDelta: {
        kind: 'play-script',
        affectedStartAppFrame: 0,
        affectedEndAppFrame: 4,
        expectedLayerCapacity: carriedRotoPhysical(launch.data).capacity,
        // 43.4 defect 1: the play-script expected end is the child document
        // capacity (the D-25/Q4 parent-end fold), never the stale
        // main-editor display outFrame.
        expectedLayerEndExclusive: carriedRotoPhysical(launch.data).capacity,
        proposedRecords: records,
        freshKeyIds: records.map((record) => record.keyId),
      },
    });

    expect(result.ok ? null : result.error).toBeNull();
    expect(result).toMatchObject({
      ok: true,
      operationId: 'fresh-progressive-play-script',
      operationKind: 'play-script',
      appliedFrameCount: 5,
    });
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toMatchObject({
      selectedKeyId: records[0].keyId,
      cursorAppFrame: 0,
      background: rotoBackground,
      loopClips: [expect.objectContaining({
        placementStart: 0,
        sourceKeyIds: records.map((record) => record.keyId),
        repeat: 2,
        mode: 'progressive',
      })],
    });
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);
    open.mockRestore();
  });

  it('applies a still payload at the start frame and returns operation-matched success', async () => {
    mockLayers([physicLayer()]);

    const result = await applyPhysicPaintPayload(applyCanvasPayload({ operationId: 'apply-still-1' }));

    expect(result).toMatchObject({
      ok: true,
      operationId: 'apply-still-1',
      kind: 'apply-canvas',
      layerId: 'phys-layer-1',
      startFrame: 8,
      appliedFrameCount: 1,
    });
    expect(physicPaintStore.getFrame('phys-layer-1', TEST_TRACK_ID, 8)?.frameIndex).toBe(0);
    expect(physicPaintStore.getFrame('phys-layer-1', TEST_TRACK_ID, 9)).toBeNull();
  });

  it('applies explicit Roto background metadata from standalone saves into the parent app store', async () => {
    mockLayers([physicLayer()]);

    const result = await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-still-explicit-bg',
      rotoBackground: { background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 },
    }));

    expect(result).toMatchObject({ ok: true, operationId: 'apply-still-explicit-bg' });
    expect(physicPaintStore.getRotoBackgroundMetadata('phys-layer-1', TEST_TRACK_ID)).toEqual({ background: 'canvas2', paperGrain: 'canvas3', grainStrength: 0.65 });
  });

  it('publishes generated Roto cache and settings through close/apply for parent preview/export', async () => {
    mockLayers([physicLayer()]);

    const first = await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-close-real-1',
      startFrame: 1,
      renderedFrame: makeFrame(0, 1),
    }));
    const second = await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-close-real-4',
      startFrame: 4,
      renderedFrame: makeFrame(0, 4),
      closeWindowAfterApply: true,
    }));
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', TEST_TRACK_ID, { enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(physicPaintStore.getRotoFrame('phys-layer-1', TEST_TRACK_ID, 2)).toEqual(expect.objectContaining({ appFrame: 2, source: 'generated-interpolation' }));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', TEST_TRACK_ID, 3)).toEqual(expect.objectContaining({ appFrame: 3, source: 'generated-interpolation' }));
    const projection = physicPaintStore.extractRuntimeStateForDocument('phys-layer-1', TEST_TRACK_ID);
    expect(projection.rotoPhysical).toBeNull();
    expect(Array.from(projection.frames.keys()).sort((a, b) => a - b)).toEqual([1, 4]);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 2, mode: 'duplicate', deform: 0, position: 0 });
  });

  it('syncs metadata-only Roto interpolation settings from standalone into parent preview/export state', async () => {
    mockLayers([physicLayer()]);
    await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-roto-real-0',
      startFrame: 0,
      renderedFrame: makeFrame(0, 0),
    }));
    await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-roto-real-1',
      startFrame: 1,
      renderedFrame: makeFrame(0, 1),
    }));
    await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-roto-real-2',
      startFrame: 2,
      renderedFrame: makeFrame(0, 2),
    }));

    const result = await applyPhysicPaintPayload({
      kind: 'update-roto-interpolation-settings',
      trackId: TEST_TRACK_ID,
      operationId: 'sync-roto-interpolation-1',
      layerId: 'phys-layer-1',
      startFrame: 1,
      settings: { enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 },
    });

    expect(result).toMatchObject({ ok: true, kind: 'update-roto-interpolation-settings', appliedFrameCount: 6 });
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 });
    expect(physicPaintStore.getRotoFrame('phys-layer-1', TEST_TRACK_ID, 8)).toEqual(expect.objectContaining({
      appFrame: 8,
      source: 'real-key',
      sourceFrame: 2,
      bytes: makeFrame(0, 2).bytes,
    }));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', TEST_TRACK_ID, 9)).toBeNull();
    const projection = physicPaintStore.extractRuntimeStateForDocument('phys-layer-1', TEST_TRACK_ID);
    expect(projection.rotoPhysical).toBeNull();
    expect(Array.from(projection.frames.keys()).sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(physicPaintStore.getRotoInterpolationSettings('phys-layer-1', TEST_TRACK_ID)).toEqual({ enabled: true, inBetweenCount: 3, mode: 'duplicate', deform: 0, position: 0 });
  });

  it('updates an existing projected real key by durable source identity when its source number is a generated display', async () => {
    mockLayers([physicLayer()]);
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', TEST_TRACK_ID, 0, makeFrame(0, 0));
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', TEST_TRACK_ID, 1, makeFrame(0, 1));
    physicPaintStore.setRotoInterpolationSettings('phys-layer-1', TEST_TRACK_ID, {
      enabled: true,
      inBetweenCount: 2,
      mode: 'duplicate',
      deform: 0,
      position: 0,
    });
    const updatedPaint = testWebpBytes('projected-source-update');

    expect(physicPaintStore.getRotoFrame('phys-layer-1', TEST_TRACK_ID, 1)).toEqual(expect.objectContaining({
      appFrame: 1,
      source: 'generated-interpolation',
    }));
    expect(physicPaintStore.getRotoFrame('phys-layer-1', TEST_TRACK_ID, 3)).toEqual(expect.objectContaining({
      appFrame: 3,
      source: 'real-key',
      sourceFrame: 1,
    }));

    const result = await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'update-projected-real-source',
      startFrame: 1,
      sourceFrame: 1,
      displayFrame: 3,
      renderedFrame: {
        ...makeFrame(0, 1),
        bytes: updatedPaint,
        source: 'real-key',
      },
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings('phys-layer-1', TEST_TRACK_ID),
    }));

    expect(result).toMatchObject({
      ok: true,
      operationId: 'update-projected-real-source',
      startFrame: 1,
      appliedFrameCount: 1,
    });
    expect(physicPaintStore.getRotoFrame('phys-layer-1', TEST_TRACK_ID, 3)).toEqual(expect.objectContaining({
      source: 'real-key',
      sourceFrame: 1,
      bytes: updatedPaint,
    }));
  });

  it('36.12 D-16 rejects generated interpolation apply-canvas targets before store mutation', async () => {
    mockLayers([physicLayer()]);
    physicPaintStore.upsertRealRotoKeyFrame('phys-layer-1', TEST_TRACK_ID, 12, makeFrame(0, 12));
    physicPaintStore.replaceGeneratedRotoCache('phys-layer-1', TEST_TRACK_ID, [{
      ...makeFrame(1, 13),
      source: 'generated-interpolation',
      nearestRealKeyFrame: 12,
    }], {
      enabled: true,
      inBetweenCount: 1,
      mode: 'blend',
      deform: 20,
      position: 30,
    });
    const applyCanvas = vi.spyOn(physicPaintStore, 'applyCanvas');

    const result = await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'apply-generated-roto-target',
      startFrame: 13,
      renderedFrame: makeFrame(0, 13),
    }));

    expect(result).toMatchObject({
      ok: false,
      operationId: 'apply-generated-roto-target',
      appliedFrameCount: 0,
      error: 'Generated frame 13 is render-only. Use timeline navigation or playback; edit a real Roto key to paint.',
    });
    expect(applyCanvas).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoCacheFrames('phys-layer-1', TEST_TRACK_ID)).toEqual(expect.arrayContaining([
      expect.objectContaining({ appFrame: 13, source: 'generated-interpolation' }),
    ]));
  });





  it('fails closed for unknown and non-physic-paint target layers', async () => {
    mockLayers([physicLayer({ id: 'paint-layer', type: 'paint', source: { type: 'paint', layerId: 'paint-layer' } })]);

    const unknown = await applyPhysicPaintPayload(applyCanvasPayload({ layerId: 'missing-layer' }));
    const wrongType = await applyPhysicPaintPayload(applyCanvasPayload({ layerId: 'paint-layer' }));

    expect(unknown.ok).toBe(false);
    expect(unknown.error).toContain('Unknown');
    expect(wrongType.ok).toBe(false);
    expect(wrongType.error).toContain('Unknown');
    expect(physicPaintStore.hasOutput('missing-layer', TEST_TRACK_ID)).toBe(false);
    expect(physicPaintStore.hasOutput('paint-layer', TEST_TRACK_ID)).toBe(false);
  });

  it('accepts hydrated physic-paint layers whose runtime source id falls back to the layer id', async () => {
    const hydratedLayer = physicLayer({
      id: 'hydrated-runtime-layer',
      source: { type: 'physic-paint' } as Layer['source'],
    });
    mockLayers([hydratedLayer]);

    const result = await applyPhysicPaintPayload(applyCanvasPayload({
      operationId: 'hydrated-runtime-fallback-op',
      layerId: 'hydrated-runtime-layer',
    }));

    expect(result).toMatchObject({
      ok: true,
      operationId: 'hydrated-runtime-fallback-op',
      layerId: 'hydrated-runtime-layer',
      appliedFrameCount: 1,
    });
    expect(physicPaintStore.getFrame('hydrated-runtime-layer', TEST_TRACK_ID, 8)?.bytes).toBeInstanceOf(Uint8Array);
  });


  it('persists and hydrates physic-paint source layer ids for apply validation', async () => {
    const layer = physicLayer({ id: 'hydrated-phys-layer', source: { type: 'physic-paint', layerId: 'hydrated-phys-layer' } });
    sequenceStore.sequences.value = [];
    sequenceStore.add({
      id: 'seq-physic-paint',
      kind: 'fx',
      name: 'Physics paint sequence',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 24,
    });
    // v1.0: layer creation registers exactly one document (AddFxMenu hook).
    registerTrackDocument('hydrated-phys-layer');

    physicPaintStore.applyCanvas(applyCanvasPayload({ layerId: 'hydrated-phys-layer', startFrame: 12, renderedFrame: makeFrame(0, 12) }) as Extract<PhysicPaintApplyPayload, { kind: 'apply-canvas' }>);

    const serialized = projectStore.buildMceProject();
    const serializedLayer = serialized.sequences[0].layers?.[0];
    expect(serializedLayer?.source).toMatchObject({
      type: 'physic-paint',
      layer_id: 'hydrated-phys-layer',
    });
    // v1.0: the legacy carrier is gone; the runtime frame travels through the document.
    expect(('physic_paint_' + 'outputs') in serialized).toBe(false);

    // v1.0 round-trip: project runtime → document (before closeProject wipes
    // the stores), then hydrate document → runtime after open. The hydrate
    // carrier is per-track (trackId → appFrame → frame) since 46-02.
    const document = serializeRuntimeIntoDocument('hydrated-phys-layer');
    const frames = physicPaintStore.getFrames('hydrated-phys-layer', TEST_TRACK_ID);
    const loadedDocuments = new Map([['hydrated-phys-layer', {
      document,
      frames: new Map([[TEST_TRACK_ID, frames]]),
      cacheLocations: new Map(),
    }]]);

    projectStore.closeProject();
    projectStore.hydrateFromMce(serialized, '/tmp/efx-physic-paint-test', loadedDocuments);
    const hydratedLayer = sequenceStore.sequences.peek()[0]?.layers[0];
    expect(hydratedLayer?.source).toEqual({ type: 'physic-paint', layerId: 'hydrated-phys-layer' });
    expect(physicPaintStore.getFrame('hydrated-phys-layer', TEST_TRACK_ID, 12)?.bytes).toBeInstanceOf(Uint8Array);

    mockLayers([hydratedLayer as Layer]);
    const result = await applyPhysicPaintPayload(applyCanvasPayload({ operationId: 'apply-still-hydrated', layerId: 'hydrated-phys-layer' }));

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      operationId: 'apply-still-hydrated',
      layerId: 'hydrated-phys-layer',
      appliedFrameCount: 1,
    });
  });

  it('rejects engine internals before store mutation', async () => {
    mockLayers([physicLayer()]);
    const applyCanvas = vi.spyOn(physicPaintStore, 'applyCanvas');

    const result = await applyPhysicPaintPayload({ ...applyCanvasPayload(), engine: {} });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid');
    expect(applyCanvas).not.toHaveBeenCalled();
  });

  it('deduplicates duplicate successful delivery for the same operation id', async () => {
    mockLayers([physicLayer()]);
    const applyCanvas = vi.spyOn(physicPaintStore, 'applyCanvas');
    const payload = applyCanvasPayload({ operationId: 'dedupe-op' });

    const first = await applyPhysicPaintPayload(payload);
    const second = await applyPhysicPaintPayload(payload);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.appliedFrameCount).toBe(1);
    expect(applyCanvas).toHaveBeenCalledTimes(1);
  });

  it.skip('closes the native physics paint window from the main apply listener after close-save payload succeeds', async () => {
    vi.resetModules();
    let listener: ((event: { payload: unknown }) => Promise<void>) | undefined;
    const emit = vi.fn().mockResolvedValue(undefined);
    const emitTo = vi.fn().mockResolvedValue(undefined);
    const destroy = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async (_event: string, handler: (event: { payload: unknown }) => Promise<void>) => {
        listener = handler;
        return vi.fn();
      }),
      emit,
      emitTo,
    }));
    vi.doMock('@tauri-apps/api/window', () => ({
      Window: { getByLabel: vi.fn(async () => ({ destroy })) },
    }));
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    const [{ layerStore: dynamicLayerStore }, { physicPaintStore: dynamicPhysicPaintStore }, { installPhysicPaintApplyListener: installListener }] = await Promise.all([
      import('../stores/layerStore'),
      import('../stores/physicPaintStore'),
      import('./physicPaintBridge'),
    ]);
    dynamicPhysicPaintStore.reset();
    vi.spyOn(dynamicLayerStore.layers, 'peek').mockReturnValue([physicLayer()]);
    vi.spyOn(dynamicLayerStore.overlayLayers, 'peek').mockReturnValue([]);

    await installListener();
    await listener?.({ payload: applyCanvasPayload({ operationId: 'close-save-op', closeWindowAfterApply: true }) });

    expect(emitTo).toHaveBeenCalledWith('efx-physic-paint', PHYSIC_PAINT_APPLY_RESULT_EVENT, expect.objectContaining({ ok: true, operationId: 'close-save-op' }));
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it('installs browser fallback listener that dispatches exactly one apply-result event', async () => {
    mockLayers([physicLayer()]);
    let listener: ((event: CustomEvent) => void) | undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === PHYSIC_PAINT_APPLY_EVENT) listener = cb as (event: CustomEvent) => void;
    });
    const remove = vi.spyOn(window, 'removeEventListener');
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);

    const cleanup = await installPhysicPaintApplyListener();
    listener?.(new CustomEvent(PHYSIC_PAINT_APPLY_EVENT, { detail: applyCanvasPayload({ operationId: 'listener-op' }) }));
    // The fallback listener applies through the asynchronous prepared-payload seam.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dispatch).toHaveBeenCalledTimes(1);
    const resultEvent = dispatch.mock.calls[0][0] as CustomEvent;
    expect(resultEvent.type).toBe(PHYSIC_PAINT_APPLY_RESULT_EVENT);
    expect(resultEvent.detail).toMatchObject({
      ok: true,
      operationId: 'listener-op',
      kind: 'apply-canvas',
      layerId: 'phys-layer-1',
      startFrame: 8,
      appliedFrameCount: 1,
    });

    cleanup();
    expect(remove).toHaveBeenCalledWith(PHYSIC_PAINT_APPLY_EVENT, expect.any(Function));
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('replies to browser fallback postMessage apply payloads through the child source', async () => {
    mockLayers([physicLayer()]);
    let listener: ((event: MessageEvent) => void) | undefined;
    const child = { postMessage: vi.fn() };
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'message') listener = cb as (event: MessageEvent) => void;
    });
    const dispatch = vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);

    await installPhysicPaintApplyListener();
    listener?.({
      origin: 'http://localhost:1420',
      data: { type: PHYSIC_PAINT_APPLY_EVENT, payload: applyCanvasPayload({ operationId: 'message-op' }) },
      source: child as unknown as MessageEventSource,
    } as MessageEvent);
    // The fallback listener applies through the asynchronous prepared-payload seam.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(child.postMessage).toHaveBeenCalledWith({
      type: PHYSIC_PAINT_APPLY_RESULT_EVENT,
      payload: expect.objectContaining({ ok: true, operationId: 'message-op', appliedFrameCount: 1 }),
    }, 'http://localhost:1420');
  });


  it('omits invalid fps so the standalone route can use its internal fallback', async () => {
    const focus = vi.fn();
    const open = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);

    const result = await openPhysicPaintCanvas({ layer: physicLayer(), frame: 4, fps: 0 });

    expect(result.ok).toBe(true);
    const url = String(open.mock.calls[0][0]);
    const parsed = new URL(url, 'http://localhost:1420');
    const context = JSON.parse(decodeURIComponent(parsed.searchParams.get('context') ?? ''));
    expect(context.fps).toBeUndefined();
    open.mockRestore();
  });

  it('handles valid D-26 frame-sync messages by seeking and ensuring visibility', async () => {
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    const handled = handlePhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 12 });

    expect(handled).toBe(true);
    expect(seek).toHaveBeenCalledWith(12);
    expect(ensureFrameVisible).toHaveBeenCalledWith(12);
  });

  it('rejects invalid D-26 frame-sync frames before mutating the timeline', async () => {
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    for (const frame of [undefined, -1, 1.5, Infinity, '12']) {
      expect(handlePhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame })).toBe(false);
    }
    expect(handlePhysicPaintFrameSyncMessage({ type: 'other', frame: 12 })).toBe(false);

    expect(seek).not.toHaveBeenCalled();
    expect(ensureFrameVisible).not.toHaveBeenCalled();
  });

  it('settles displayFrame onto the Studio-synced cursor when the launch gate clears (52.1 close-stale)', () => {
    // The child frame-sync seeks only currentFrame (the playhead); the main
    // Preview renders displayFrame. Clearing the launch gate (Studio closed)
    // must settle the render frame onto the synced cursor — otherwise the
    // canvas keeps drawing the pre-session frame until the next scrub.
    handlePhysicPaintFrameSyncMessage({ type: 'physic-paint:seek-frame', frame: 3 });
    expect(timelineStore.currentFrame.value).toBe(3);
    expect(timelineStore.displayFrame.value).not.toBe(3);

    deactivatePhysicPaintLaunch();

    expect(timelineStore.displayFrame.value).toBe(3);
    expect(physicPaintLaunchActive.value).toBe(false);
  });

  it('installs a browser message listener for D-26 frame sync and removes it on cleanup', async () => {
    let listener: ((event: MessageEvent) => void) | undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'message') listener = cb as (event: MessageEvent) => void;
    });
    const remove = vi.spyOn(window, 'removeEventListener');
    const seek = vi.spyOn(timelineStore, 'seek');
    const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

    const cleanup = await installPhysicPaintFrameSyncListener(window);
    listener?.(new MessageEvent('message', { data: { type: 'physic-paint:seek-frame', frame: 7 } }));

    expect(seek).toHaveBeenCalledWith(7);
    expect(ensureFrameVisible).toHaveBeenCalledWith(7);

    cleanup();
    expect(remove).toHaveBeenCalledWith('message', expect.any(Function));
  });

  it('installs a Tauri listen branch for D-26 frame sync in native runtime', async () => {
    let handler: ((event: { payload: unknown }) => unknown) | undefined;
    const unlisten = vi.fn();
    vi.doMock('@tauri-apps/api/event', () => ({
      listen: vi.fn(async (eventName: string, cb: (event: { payload: unknown }) => unknown) => {
        if (eventName === 'physic-paint:seek-frame') handler = cb;
        return unlisten;
      }),
    }));
    Object.defineProperty(window, '__TAURI_INTERNALS__', { value: {}, configurable: true });
    try {
      const add = vi.spyOn(window, 'addEventListener');
      const seek = vi.spyOn(timelineStore, 'seek');
      const ensureFrameVisible = vi.spyOn(timelineStore, 'ensureFrameVisible');

      const cleanup = await installPhysicPaintFrameSyncListener(window);
      handler?.({ payload: { type: 'physic-paint:seek-frame', frame: 9 } });

      expect(seek).toHaveBeenCalledWith(9);
      expect(ensureFrameVisible).toHaveBeenCalledWith(9);
      expect(add).not.toHaveBeenCalledWith('message', expect.any(Function));

      cleanup();
      expect(unlisten).toHaveBeenCalledTimes(1);
    } finally {
      delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
      vi.doUnmock('@tauri-apps/api/event');
    }
  });
});

describe('public Physics Paint transport cleanup', async () => {
  it('exposes only generic Physics Paint transport after the local Loop Clip cutover', async () => {
    const bridge = await import('./physicPaintBridge') as Record<string, unknown>;
    const transport = await import('../components/physic-paint/bridge/physicsPaintBridgeTransport') as Record<string, unknown>;
    const parentBridge = await import('../components/physic-paint/bridge/usePhysicsPaintParentBridge') as Record<string, unknown>;
    const types = await import('../types/physicPaint') as Record<string, unknown>;

    expect(bridge.openPhysicPaintCanvas).toBeTypeOf('function');
    expect(transport.sendPhysicPaintApplyPayload).toBeTypeOf('function');

    for (const name of [
      'PHYSIC_PAINT_OPEN_LOOP_EDIT_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_REQUEST_EVENT',
      'PHYSIC_PAINT_LOOP_OPERATION_RESULT_EVENT',
      'openPhysicPaintLoopEdit',
      'requestPhysicPaintLoopOperation',
    ]) expect(name in bridge).toBe(false);

    for (const name of [
      'sendPhysicPaintOpenLoopEdit',
      'sendPhysicPaintLoopOperationRequest',
      'sendPhysicPaintLoopOperationResult',
    ]) expect(name in transport).toBe(false);

    for (const name of [
      'usePhysicsPaintOpenLoopEditBridge',
      'usePhysicsPaintLoopOperationBridge',
      'createPhysicsPaintLoopOperationRequestHandler',
    ]) expect(name in parentBridge).toBe(false);

    for (const name of [
      'isPhysicPaintOpenLoopEditRequest',
      'isPhysicPaintLoopOperationRequest',
      'isPhysicPaintLoopOperationResult',
    ]) expect(name in types).toBe(false);
  });
});

describe('Phase 43.2 parent-authoritative Group lifecycle proposals', async () => {
  const projectContextId = 'abababab-abab-4bab-8bab-abababababab';

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerTrackDocument('phys-layer-1');
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
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  async function lifecycleHarness(
    operationKind: 'delete-group-frame' | 'delete-group' | 'delete-rails' | 'regenerate-group' | 'detach-action-groups' | 'delete-action-groups',
    operationId: string,
  ) {
    const layer = physicLayer();
    mockLayers([layer]);
    projectStore.projectContextId.value = projectContextId;
    const records = [
      makePhysicalRecord('source-A', 0),
      makePhysicalRecord('source-B', 2),
      makePhysicalRecord('ordinary', 20),
    ];
    const groupOverrideRecords = [makePhysicalRecord('override-5', 5)];
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const loopClips = [{
      loopId: 'group-1',
      placementStart: 0,
      sourceKeyIds: ['source-A', 'source-B'],
      repeat: 3 as const,
      mode: 'progressive' as const,
      scriptId: 'action-1',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'modified' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 0,
      originalEndExclusive: 9,
      visibleRanges: [{ start: 0, endExclusive: 9 }],
      frameOverrides: [{ appFrame: 5, keyId: 'override-5' }],
    }];
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 30,
      realKeyRecords: records,
      groupOverrideRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 5,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, ['source-B'], groupOverrideRecords),
      loopClips,
      incomingInterpolationBreakKeyIds: ['source-B'],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    registerRotoAlphaCanvasFrame(records[0].payload.bytes, { width: 1000, height: 650 } as HTMLCanvasElement);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 5 });
    if (!launch.ok) throw new Error(launch.error);
    const parentDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!parentDocument) throw new Error('Expected lifecycle document.');
    const current = Object.freeze({
      ...parentDocument,
      selectedKeyId: null,
      cursorAppFrame: 5,
    });
    const proposed = operationKind === 'delete-group-frame'
      ? proposePhysicPaintRotoDeleteGroupFrame({ document: current, groupId: 'group-1', appFrame: 5 })
      : operationKind === 'delete-group'
        ? proposePhysicPaintRotoDeleteGroup({ document: current, groupId: 'group-1' })
        : operationKind === 'regenerate-group'
          ? (() => {
              const regeneratedRecords = current.realKeyRecords.map((record) => (
                record.keyId === 'source-A' || record.keyId === 'source-B'
                  ? {
                      ...record,
                      payload: {
                        ...record.payload,
                        bytes: record.keyId === 'source-A'
                          ? OPAQUE_ONE_PIXEL_WEBP
                          : TRANSPARENT_ONE_PIXEL_WEBP,
                        width: 1,
                        height: 1,
                      },
                    }
                  : record
              ));
              const regeneratedDocument = {
                ...current,
                realKeyRecords: regeneratedRecords,
                revision: buildPhysicPaintRotoPhysicalRevision(
                  regeneratedRecords,
                  current.interpolation,
                  current.loopClips,
                  current.incomingInterpolationBreakKeyIds,
                  current.groupOverrideRecords,
                ),
              };
              const lifecycle = proposePhysicPaintRotoRegenerateGroup({
                document: regeneratedDocument,
                groupId: 'group-1',
                expectedActionRevision: 'action-revision-1',
                currentActionRevision: 'action-revision-1',
              });
              if (!lifecycle.ok) return lifecycle;
              return Object.freeze({
                ok: true as const,
                proposal: lifecycle.proposal,
                impact: Object.freeze({
                  ...lifecycle.impact,
                  previousRevision: current.revision,
                }),
              });
            })()
          : operationKind === 'delete-rails'
            ? proposePhysicPaintRotoDeleteRails({
                document: current,
                members: [
                  { kind: 'key-rail', firstKeyId: 'ordinary', keyIds: ['ordinary'] },
                ],
              })
            : proposePhysicPaintRotoActionGroupLifecycle({
                document: parentDocument,
                actionId: 'action-1',
                expectedActionRevision: 'action-revision-1',
                currentActionRevision: 'action-revision-1',
                mode: operationKind === 'detach-action-groups' ? 'detach' : 'delete',
              });
    if (!proposed.ok) throw new Error(proposed.reason);
    const leaseToken = acquirePhysicalLease(layer.id, projectContextId);
    const payload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationId,
      operationKind,
      leaseToken,
      layerId: layer.id,
      startFrame: current.cursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: current.revision,
      records: proposed.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (proposed.proposal.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: proposed.proposal.interpolation.enabled,
      interpolationMode: proposed.proposal.interpolation.mode,
      loopClips: proposed.proposal.loopClips,
      incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: proposed.proposal.selectedKeyId,
      selectedAppFrame: proposed.proposal.selectedKeyId === null ? null : proposed.proposal.cursorAppFrame,
      cursorAppFrame: proposed.proposal.cursorAppFrame,
      semanticDelta: proposed.impact,
    };
    return { layer, parentDocument, current, proposed, payload, leaseToken };
  }

  async function selectionAuthorityHarness(input: {
    placementStart: number;
    repeat: 1 | 3;
    selectionKind: 'frame' | 'group-rail';
    operationId: string;
  }) {
    const layer = physicLayer();
    mockLayers([layer]);
    projectStore.projectContextId.value = projectContextId;
    const records = [
      makePhysicalRecord('source-A', 0),
      makePhysicalRecord('source-B', 2),
      makePhysicalRecord('ordinary', 20),
    ];
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const extentEnd = input.placementStart + 3 * input.repeat;
    const group = {
      loopId: 'group-1',
      placementStart: input.placementStart,
      sourceKeyIds: ['source-A', 'source-B'],
      repeat: input.repeat,
      mode: 'progressive' as const,
      scriptId: 'action-1',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: input.placementStart,
      originalEndExclusive: extentEnd,
      visibleRanges: [{ start: input.placementStart, endExclusive: extentEnd }],
      frameOverrides: [],
    };
    const loopClips = [group];
    const parentSeed = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 30,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, ['source-B']),
      loopClips,
      incomingInterpolationBreakKeyIds: ['source-B'],
    });
    if (!parentSeed.ok) throw new Error(parentSeed.error);
    registerRotoAlphaCanvasFrame(records[0].payload.bytes, { width: 1000, height: 650 } as HTMLCanvasElement);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error(launch.error);
    const parentDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!parentDocument) throw new Error('Expected parent Group authority document.');

    const targetFrame = input.selectionKind === 'frame'
      ? input.placementStart + (input.repeat === 1 ? 0 : 1)
      : input.placementStart;
    const childCursorAppFrame = input.selectionKind === 'group-rail' ? 20 : targetFrame;
    const childDocument = Object.freeze({
      ...parentDocument,
      selectedKeyId: null,
      cursorAppFrame: childCursorAppFrame,
    });
    const operationKind = input.selectionKind === 'group-rail'
      ? 'delete-group' as const
      : 'delete-group-frame' as const;
    const proposed = operationKind === 'delete-group'
      ? proposePhysicPaintRotoDeleteGroup({ document: childDocument, groupId: group.loopId })
      : proposePhysicPaintRotoDeleteGroupFrame({
          document: childDocument,
          groupId: group.loopId,
          appFrame: targetFrame,
        });
    if (!proposed.ok) throw new Error(proposed.reason);
    const leaseToken = acquirePhysicalLease(layer.id, projectContextId);
    const payload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationId: input.operationId,
      operationKind,
      leaseToken,
      layerId: layer.id,
      startFrame: targetFrame,
      cursorAppFrame: childCursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: childDocument.revision,
      records: proposed.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: proposed.proposal.interpolation.enabled,
      interpolationMode: proposed.proposal.interpolation.mode,
      loopClips: proposed.proposal.loopClips,
      incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: proposed.proposal.selectedKeyId,
      selectedAppFrame: null,
      semanticDelta: proposed.impact,
    };
    return {
      layer,
      group,
      targetFrame,
      childCursorAppFrame,
      parentDocument,
      childDocument,
      proposed,
      leaseToken,
      payload,
    };
  }

  it.each([
    { placementStart: 0, repeat: 1 as const, selectionKind: 'frame' as const },
    { placementStart: 0, repeat: 3 as const, selectionKind: 'frame' as const },
    { placementStart: 8, repeat: 1 as const, selectionKind: 'frame' as const },
    { placementStart: 8, repeat: 3 as const, selectionKind: 'frame' as const },
    { placementStart: 0, repeat: 1 as const, selectionKind: 'group-rail' as const },
    { placementStart: 0, repeat: 3 as const, selectionKind: 'group-rail' as const },
    { placementStart: 8, repeat: 1 as const, selectionKind: 'group-rail' as const },
    { placementStart: 8, repeat: 3 as const, selectionKind: 'group-rail' as const },
  ])('accepts $selectionKind deletion with independent cursor authority at F$placementStart Repeat $repeat', async ({
    placementStart,
    repeat,
    selectionKind,
  }) => {
    const test = await selectionAuthorityHarness({
      placementStart,
      repeat,
      selectionKind,
      operationId: `selection-authority-${selectionKind}-${placementStart}-${repeat}`,
    });

    expect(test.parentDocument.revision).toBe(test.childDocument.revision);
    expect(buildPhysicPaintRotoProjectEquality(test.parentDocument)).not.toBe(
      buildPhysicPaintRotoProjectEquality(test.childDocument),
    );
    expect(test.parentDocument.loopClips[0]).toMatchObject({
      loopId: test.group.loopId,
      placementStart,
      repeat,
      phaseOrigin: placementStart,
      originalEndExclusive: placementStart + 3 * repeat,
    });
    expect(test.childDocument.selectedKeyId).toBeNull();
    expect(test.childDocument.cursorAppFrame).toBe(test.childCursorAppFrame);
    expect(test.payload.expectedRevision).toBe(test.parentDocument.revision);
    expect(physicPaintStore.isRotoPhysicalOperationAvailable(projectContextId, test.layer.id, TEST_TRACK_ID)).toBe(false);

    const result = await applyPhysicPaintPayload(test.payload as PhysicPaintApplyPayload);

    expect(result.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.proposed.proposal);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)?.cursorAppFrame).toBe(test.childCursorAppFrame);
    if (selectionKind === 'frame' && repeat === 3) {
      expect(physicPaintStore.getRotoPhysicalLoopClips(test.layer.id, TEST_TRACK_ID)[0]).toMatchObject({
        loopId: test.group.loopId,
        placementStart,
        phaseOrigin: placementStart,
        originalEndExclusive: placementStart + 9,
      });
    }
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);
    expect(physicPaintStore.isRotoPhysicalOperationAvailable(projectContextId, test.layer.id, TEST_TRACK_ID)).toBe(true);
  });

  it('restores the child-authoritative pre-delete cursor through Group Delete Undo', async () => {
    const test = await selectionAuthorityHarness({
      placementStart: 8,
      repeat: 3,
      selectionKind: 'group-rail',
      operationId: 'selection-authority-history-delete',
    });

    expect(test.parentDocument.cursorAppFrame).toBe(0);
    expect(test.childDocument.cursorAppFrame).toBe(20);

    const forward = await applyPhysicPaintPayload(test.payload as PhysicPaintApplyPayload);
    expect(forward.ok).toBe(true);
    if (!forward.ok || !('acceptedRevision' in forward)) throw new Error('Expected accepted Group deletion.');
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);

    const undoLease = acquirePhysicalLease(test.layer.id, projectContextId);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'selection-authority-history-undo',
      operationKind: 'undo',
      layerId: test.layer.id,
      leaseToken: undoLease,
      startFrame: test.childDocument.cursorAppFrame,
      launchOperationId: test.payload.launchOperationId,
      projectContextId,
      expectedRevision: test.proposed.proposal.revision,
      records: test.childDocument.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: test.childDocument.interpolation.enabled,
      interpolationMode: test.childDocument.interpolation.mode,
      loopClips: test.childDocument.loopClips,
      incomingInterpolationBreakKeyIds: test.childDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: test.childDocument.selectedKeyId,
      selectedAppFrame: null,
      cursorAppFrame: test.childDocument.cursorAppFrame,
      historyProvenance: {
        historyCommandId: test.payload.operationId,
        historyDirection: 'undo',
        sourceRevision: test.proposed.proposal.revision,
        targetRevision: test.childDocument.revision,
      },
    });

    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.childDocument);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);
  });

  it.each([
    { placementStart: 0, repeat: 1 as const, selectionKind: 'frame' as const },
    { placementStart: 0, repeat: 3 as const, selectionKind: 'frame' as const },
    { placementStart: 8, repeat: 1 as const, selectionKind: 'frame' as const },
    { placementStart: 8, repeat: 3 as const, selectionKind: 'frame' as const },
    { placementStart: 0, repeat: 1 as const, selectionKind: 'group-rail' as const },
    { placementStart: 0, repeat: 3 as const, selectionKind: 'group-rail' as const },
    { placementStart: 8, repeat: 1 as const, selectionKind: 'group-rail' as const },
    { placementStart: 8, repeat: 3 as const, selectionKind: 'group-rail' as const },
  ])('preserves rebuilt Key Spacing lifecycle and accepts $selectionKind deletion at F$placementStart Repeat $repeat', async ({
    placementStart,
    repeat,
    selectionKind,
  }) => {
    const initial = await selectionAuthorityHarness({
      placementStart,
      repeat,
      selectionKind,
      operationId: `spacing-matrix-unused-${selectionKind}-${placementStart}-${repeat}`,
    });
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(initial.leaseToken)).toBe(true);

    const spacingIntent = {
      kind: 'force-spacing' as const,
      emptyFrames: 2,
      selectedKeyId: null,
      scopeKeyIds: ['source-A', 'source-B'],
      linkedSourceSpacingScopes: [{
        sourceCycleId: getPhysicsPaintRotoSourceCycleId(['source-A', 'source-B']),
        sourceKeyIds: ['source-A', 'source-B'],
        selectedSourceKeyIds: ['source-A', 'source-B'],
      }],
    };
    const spacingResolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: initial.childDocument.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records: initial.childDocument.realKeyRecords,
      intent: spacingIntent,
      parentEndExclusive: initial.childDocument.capacity,
      capacity: initial.childDocument.capacity,
      interpolationEnabled: initial.childDocument.interpolation.enabled,
      loopClips: initial.childDocument.loopClips,
      incomingInterpolationBreakKeyIds: initial.childDocument.incomingInterpolationBreakKeyIds,
    });
    expect(
      spacingResolution.ok,
      spacingResolution.ok ? undefined : JSON.stringify(spacingResolution.failure),
    ).toBe(true);
    if (!spacingResolution.ok) throw new Error(spacingResolution.failure.text);
    const spacedRecords = initial.childDocument.realKeyRecords.map((record) => {
      const appFrame = spacingResolution.proposal.mapping.get(record.keyId) ?? record.appFrame;
      return {
        ...record,
        appFrame,
        payload: { ...record.payload, appFrame },
      };
    });
    const spacedLoopClips = spacingResolution.proposal.nextLoopClips ?? initial.childDocument.loopClips;
    const spacingLease = acquirePhysicalLease(initial.layer.id, projectContextId);
    const spacingPayload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationId: `spacing-matrix-${selectionKind}-${placementStart}-${repeat}`,
      operationKind: 'force-spacing' as const,
      intent: spacingIntent,
      leaseToken: spacingLease,
      layerId: initial.layer.id,
      startFrame: 20,
      launchOperationId: initial.payload.launchOperationId,
      projectContextId,
      expectedRevision: initial.parentDocument.revision,
      records: spacedRecords.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: initial.childDocument.interpolation.enabled,
      interpolationMode: initial.childDocument.interpolation.mode,
      loopClips: spacedLoopClips,
      incomingInterpolationBreakKeyIds: spacingResolution.proposal.nextIncomingInterpolationBreakKeyIds
        ?? initial.childDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: spacingResolution.proposal.selectedKeyId,
      selectedAppFrame: spacingResolution.proposal.selectedAppFrame,
      cursorAppFrame: 20,
      ...(spacingResolution.proposal.semanticDelta
        ? { semanticDelta: spacingResolution.proposal.semanticDelta }
        : {}),
    };

    expect(isPhysicPaintRotoPhysicalEditIntent(spacingIntent), JSON.stringify(spacingIntent)).toBe(true);
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(spacingPayload), JSON.stringify(spacingPayload)).toBe(true);
    const spacingResult = await applyPhysicPaintPayload(spacingPayload as PhysicPaintApplyPayload);
    expect(spacingResult.ok, JSON.stringify(spacingResult)).toBe(true);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(spacingLease)).toBe(true);
    const spacedParent = physicPaintStore.getRotoPhysicalDocument(initial.layer.id, TEST_TRACK_ID);
    if (!spacedParent) throw new Error('Expected accepted Key Spacing document.');
    expect(spacedParent.loopClips[0]).toMatchObject({
      loopId: initial.group.loopId,
      placementStart,
      repeat,
      phaseOrigin: placementStart,
      originalEndExclusive: placementStart + 4 * repeat,
      visibleRanges: [{ start: placementStart, endExclusive: placementStart + 4 * repeat }],
    });
    expect(spacedParent.selectedKeyId).toBeNull();
    expect(spacedParent.cursorAppFrame).toBe(20);

    const targetFrame = selectionKind === 'frame' ? placementStart + 1 : placementStart;
    const childAfterSpacing = Object.freeze({
      ...spacedParent,
      selectedKeyId: null,
      cursorAppFrame: selectionKind === 'frame' ? targetFrame : 20,
    });
    expect(childAfterSpacing.revision).toBe(spacedParent.revision);
    const deleteProposal = selectionKind === 'group-rail'
      ? proposePhysicPaintRotoDeleteGroup({ document: childAfterSpacing, groupId: initial.group.loopId })
      : proposePhysicPaintRotoDeleteGroupFrame({
          document: childAfterSpacing,
          groupId: initial.group.loopId,
          appFrame: targetFrame,
        });
    if (!deleteProposal.ok) throw new Error(deleteProposal.reason);
    const deleteLease = acquirePhysicalLease(initial.layer.id, projectContextId);
    const deletePayload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationId: `spacing-delete-${selectionKind}-${placementStart}-${repeat}`,
      operationKind: selectionKind === 'group-rail' ? 'delete-group' as const : 'delete-group-frame' as const,
      leaseToken: deleteLease,
      layerId: initial.layer.id,
      startFrame: targetFrame,
      cursorAppFrame: childAfterSpacing.cursorAppFrame,
      launchOperationId: initial.payload.launchOperationId,
      projectContextId,
      expectedRevision: spacedParent.revision,
      records: deleteProposal.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: deleteProposal.proposal.interpolation.enabled,
      interpolationMode: deleteProposal.proposal.interpolation.mode,
      loopClips: deleteProposal.proposal.loopClips,
      incomingInterpolationBreakKeyIds: deleteProposal.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: deleteProposal.proposal.selectedKeyId,
      selectedAppFrame: deleteProposal.proposal.selectedKeyId === null
        ? null
        : deleteProposal.proposal.cursorAppFrame,
      semanticDelta: deleteProposal.impact,
    };

    const deleteResult = await applyPhysicPaintPayload(deletePayload as PhysicPaintApplyPayload);
    expect(deleteResult.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(initial.layer.id, TEST_TRACK_ID)).toEqual(deleteProposal.proposal);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(deleteLease)).toBe(true);
  });

  it('leaves a rejected nonzero Group lifecycle command immediately reusable with unchanged documents, revision, history authority, and lease scope', async () => {
    const test = await selectionAuthorityHarness({
      placementStart: 8,
      repeat: 3,
      selectionKind: 'group-rail',
      operationId: 'selection-authority-rejected',
    });
    const before = physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID);
    const beforeVersion = physicPaintVersion.peek();

    const rejected = await applyPhysicPaintPayload({
      ...test.payload,
      expectedRevision: 'stale-selection-authority-revision',
    } as PhysicPaintApplyPayload);

    expect(rejected.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(before);
    expect(physicPaintVersion.peek()).toBe(beforeVersion);
    expect(physicPaintStore.isRotoPhysicalOperationAvailable(projectContextId, test.layer.id, TEST_TRACK_ID)).toBe(false);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);
    expect(physicPaintStore.isRotoPhysicalOperationAvailable(projectContextId, test.layer.id, TEST_TRACK_ID)).toBe(true);

    const retryLease = acquirePhysicalLease(test.layer.id, projectContextId);
    const accepted = await applyPhysicPaintPayload({
      ...test.payload,
      operationId: 'selection-authority-retry',
      leaseToken: retryLease,
    } as PhysicPaintApplyPayload);

    expect(accepted.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.proposed.proposal);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)?.cursorAppFrame).toBe(test.childCursorAppFrame);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(retryLease)).toBe(true);
  });

  it.each([
    'delete-group-frame',
    'delete-group',
    'delete-rails',
    'regenerate-group',
    'detach-action-groups',
    'delete-action-groups',
  ] as const)('recomputes and publishes one exact %s candidate', async (operationKind) => {
    const test = await lifecycleHarness(operationKind, `lifecycle-accepted-${operationKind}`);
    const beforeVersion = physicPaintVersion.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const result = await applyPhysicPaintPayload(test.payload as PhysicPaintApplyPayload);

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(test.layer.id, TEST_TRACK_ID, test.proposed.proposal, test.leaseToken);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.proposed.proposal);
    expect(physicPaintVersion.peek()).toBe(beforeVersion + 1);
  });

  it('recomputes every truly shared Group in one aggregate Regenerate publication', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    projectStore.projectContextId.value = projectContextId;
    const records = [
      makePhysicalRecord('source-A', 0),
      makePhysicalRecord('source-B', 2),
      makePhysicalRecord('ordinary', 20),
    ];
    const groupOverrideRecords = [
      makePhysicalRecord('override-5', 5),
      makePhysicalRecord('override-15', 15),
    ];
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const loopClips = [
      {
        loopId: 'group-1', placementStart: 0, sourceKeyIds: ['source-A', 'source-B'], repeat: 3 as const,
        mode: 'progressive' as const, scriptId: 'action-1', motion: { deformation: 0, position: 0 },
        overrideColor: null, syncState: 'modified' as const, provenanceState: 'attached' as const,
        phaseOrigin: 0, originalEndExclusive: 9, visibleRanges: [{ start: 0, endExclusive: 9 }],
        frameOverrides: [{ appFrame: 5, keyId: 'override-5' }],
      },
      {
        loopId: 'group-2', placementStart: 10, sourceKeyIds: ['source-A', 'source-B'], repeat: 2 as const,
        mode: 'static' as const, scriptId: 'action-1', motion: { deformation: 7, position: 3 },
        overrideColor: '#123456', syncState: 'modified' as const, provenanceState: 'attached' as const,
        phaseOrigin: 10, originalEndExclusive: 16, visibleRanges: [{ start: 10, endExclusive: 16 }],
        frameOverrides: [{ appFrame: 15, keyId: 'override-15' }],
      },
    ];
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 30,
      realKeyRecords: records,
      groupOverrideRecords,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 5,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, ['source-B'], groupOverrideRecords),
      loopClips,
      incomingInterpolationBreakKeyIds: ['source-B'],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 5 });
    if (!launch.ok) throw new Error(launch.error);
    const current = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!current) throw new Error('Expected shared Group document.');
    const regeneratedRecords = current.realKeyRecords.map((record) => (
      record.keyId === 'source-A' || record.keyId === 'source-B'
        ? {
            ...record,
            payload: {
              ...record.payload,
              bytes: record.keyId === 'source-A' ? OPAQUE_ONE_PIXEL_WEBP : TRANSPARENT_ONE_PIXEL_WEBP,
              width: 1,
              height: 1,
            },
          }
        : record
    ));
    let proposalDocument: PhysicPaintRotoPhysicalDocument = {
      ...current,
      realKeyRecords: regeneratedRecords,
      revision: buildPhysicPaintRotoPhysicalRevision(
        regeneratedRecords,
        current.interpolation,
        current.loopClips,
        current.incomingInterpolationBreakKeyIds,
        current.groupOverrideRecords,
      ),
    };
    for (const groupId of ['group-1', 'group-2']) {
      const proposal = proposePhysicPaintRotoRegenerateGroup({
        document: proposalDocument,
        groupId,
        expectedActionRevision: 'action-revision-1',
        currentActionRevision: 'action-revision-1',
      });
      if (!proposal.ok) throw new Error(proposal.reason);
      proposalDocument = proposal.proposal;
    }
    const leaseToken = acquirePhysicalLease(layer.id, projectContextId);
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'shared-group-regenerate',
      operationKind: 'regenerate-group',
      leaseToken,
      layerId: layer.id,
      startFrame: 5,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: current.revision,
      records: proposalDocument.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (proposalDocument.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: proposalDocument.interpolation.enabled,
      interpolationMode: proposalDocument.interpolation.mode,
      loopClips: proposalDocument.loopClips,
      incomingInterpolationBreakKeyIds: proposalDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: proposalDocument.selectedKeyId,
      selectedAppFrame: null,
      cursorAppFrame: proposalDocument.cursorAppFrame,
      semanticDelta: {
        kind: 'regenerate-group',
        groupId: 'group-1',
        expectedActionRevision: 'action-revision-1',
        cleanupKeyIds: ['override-15', 'override-5'],
        previousRevision: current.revision,
        nextRevision: proposalDocument.revision,
      },
    });

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    expect(replace).toHaveBeenCalledTimes(1);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(proposalDocument);
    expect(physicPaintStore.getRotoPhysicalLoopClips(layer.id, TEST_TRACK_ID)).toEqual([
      expect.objectContaining({
        loopId: 'group-1', mode: 'progressive', motion: { deformation: 0, position: 0 },
        overrideColor: null, syncState: 'synchronized', frameOverrides: [],
      }),
      expect.objectContaining({
        loopId: 'group-2', mode: 'static', motion: { deformation: 7, position: 3 },
        overrideColor: '#123456', syncState: 'synchronized', frameOverrides: [],
      }),
    ]);
  });

  it('restores and reapplies the complete Group deletion document through leased Undo and Redo', async () => {
    const test = await lifecycleHarness('delete-group', 'group-delete-history-matrix');
    const forward = await applyPhysicPaintPayload(test.payload as PhysicPaintApplyPayload);
    expect(forward.ok).toBe(true);
    if (!forward.ok || !('acceptedRevision' in forward)) throw new Error('Expected accepted Group deletion.');
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.proposed.proposal);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);

    const undoLease = acquirePhysicalLease(test.layer.id, projectContextId);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'group-delete-history-undo',
      operationKind: 'undo',
      layerId: test.layer.id,
      leaseToken: undoLease,
      startFrame: test.current.cursorAppFrame,
      launchOperationId: test.payload.launchOperationId,
      projectContextId,
      expectedRevision: test.proposed.proposal.revision,
      records: test.current.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (test.current.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: test.current.interpolation.enabled,
      interpolationMode: test.current.interpolation.mode,
      loopClips: test.current.loopClips,
      incomingInterpolationBreakKeyIds: test.current.incomingInterpolationBreakKeyIds,
      selectedKeyId: test.current.selectedKeyId,
      selectedAppFrame: test.current.selectedKeyId === null ? null : test.current.cursorAppFrame,
      cursorAppFrame: test.current.cursorAppFrame,
      historyProvenance: {
        historyCommandId: test.payload.operationId,
        historyDirection: 'undo',
        sourceRevision: test.proposed.proposal.revision,
        targetRevision: test.current.revision,
      },
    });
    expect(undo.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.current);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);

    const redoLease = acquirePhysicalLease(test.layer.id, projectContextId);
    const redo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'group-delete-history-redo',
      operationKind: 'redo',
      layerId: test.layer.id,
      leaseToken: redoLease,
      startFrame: test.proposed.proposal.cursorAppFrame,
      launchOperationId: test.payload.launchOperationId,
      projectContextId,
      expectedRevision: test.current.revision,
      records: test.proposed.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (test.proposed.proposal.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: test.proposed.proposal.interpolation.enabled,
      interpolationMode: test.proposed.proposal.interpolation.mode,
      loopClips: test.proposed.proposal.loopClips,
      incomingInterpolationBreakKeyIds: test.proposed.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: test.proposed.proposal.selectedKeyId,
      selectedAppFrame: test.proposed.proposal.selectedKeyId === null
        ? null
        : test.proposed.proposal.cursorAppFrame,
      cursorAppFrame: test.proposed.proposal.cursorAppFrame,
      historyProvenance: {
        historyCommandId: test.payload.operationId,
        historyDirection: 'redo',
        sourceRevision: test.current.revision,
        targetRevision: test.proposed.proposal.revision,
      },
    });
    expect(redo.ok).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.proposed.proposal);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(redoLease)).toBe(true);
  });

  it('delete-rails undo/redo restore the exact pre-delete selection set through the real bridge (G-43.6-2)', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    projectStore.projectContextId.value = projectContextId;
    sequenceStore.add({
      id: 'bridge-delete-rails-sequence',
      kind: 'fx',
      name: 'Bridge delete-rails authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 100,
    });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const records = [
      makePhysicalRecord('source-A', 0),
      makePhysicalRecord('source-B', 2),
      makePhysicalRecord('ordinary', 20),
    ];
    const interpolation = { enabled: true, mode: 'duplicate' as const };
    const loopClips = [{
      loopId: 'group-1',
      placementStart: 0,
      sourceKeyIds: ['source-A', 'source-B'],
      repeat: 3 as const,
      mode: 'progressive' as const,
      scriptId: 'action-1',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'modified' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 0,
      originalEndExclusive: 9,
      visibleRanges: [{ start: 0, endExclusive: 9 }],
      frameOverrides: [] as { appFrame: number; keyId: string }[],
    }];
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 30,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'ordinary',
      cursorAppFrame: 20,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips, ['source-B'], []),
      loopClips,
      incomingInterpolationBreakKeyIds: ['source-B'],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    registerRotoAlphaCanvasFrame(records[0].payload.bytes, { width: 1000, height: 650 } as HTMLCanvasElement);
    // Launching on frame 20 installs 'ordinary' as the live parent selection
    // through the real launch path (createPhysicPaintLaunchContext selects the
    // key at the requested frame) — the pre-delete selection under test.
    const launch = await openPhysicPaintCanvas({ layer, frame: 20 });
    if (!launch.ok) throw new Error(launch.error);
    const seededDoc = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!seededDoc) throw new Error('Expected seeded physical document.');
    expect(seededDoc.selectedKeyId).toBe('ordinary');
    expect(seededDoc.cursorAppFrame).toBe(20);

    const proposed = proposePhysicPaintRotoDeleteRails({
      document: seededDoc,
      members: [{ kind: 'key-rail', firstKeyId: 'ordinary', keyIds: ['ordinary'] }],
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error('Expected a delete-rails proposal.');
    // The POST-delete proposal selection must NOT become the before snapshot.
    expect(proposed.proposal.selectedKeyId).toBe('source-B');
    expect(proposed.proposal.cursorAppFrame).toBe(2);

    const leaseToken = acquirePhysicalLease(layer.id, projectContextId);
    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'delete-rails-accepted',
      operationKind: 'delete-rails',
      leaseToken,
      layerId: layer.id,
      startFrame: 20,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: seededDoc.revision,
      records: proposed.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (proposed.proposal.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: proposed.proposal.interpolation.enabled,
      interpolationMode: 'duplicate',
      loopClips: proposed.proposal.loopClips,
      incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: proposed.proposal.selectedKeyId,
      selectedAppFrame: proposed.proposal.cursorAppFrame,
      cursorAppFrame: proposed.proposal.cursorAppFrame,
      semanticDelta: proposed.impact,
    });
    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!acceptedDocument) throw new Error('Expected accepted delete-rails document.');
    expect(acceptedDocument.selectedKeyId).toBe('source-B');
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);

    const undoLease = acquirePhysicalLease(layer.id, projectContextId);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'undo-delete-rails-accepted',
      operationKind: 'undo',
      layerId: layer.id,
      leaseToken: undoLease,
      startFrame: seededDoc.cursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: acceptedDocument.revision,
      records: seededDoc.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (seededDoc.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: seededDoc.interpolation.enabled,
      interpolationMode: 'duplicate',
      loopClips: seededDoc.loopClips,
      incomingInterpolationBreakKeyIds: seededDoc.incomingInterpolationBreakKeyIds,
      // The undo replay submits the TRUE pre-delete selection carried by the
      // history entry's before snapshot — G-43.6-2.
      selectedKeyId: seededDoc.selectedKeyId,
      selectedAppFrame: seededDoc.selectedKeyId === null ? null : seededDoc.cursorAppFrame,
      cursorAppFrame: seededDoc.cursorAppFrame,
      historyProvenance: {
        historyCommandId: 'delete-rails-accepted',
        historyDirection: 'undo',
        sourceRevision: acceptedDocument.revision,
        targetRevision: seededDoc.revision,
      },
    });
    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(seededDoc);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);

    const redoLease = acquirePhysicalLease(layer.id, projectContextId);
    const redo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'redo-delete-rails-accepted',
      operationKind: 'redo',
      layerId: layer.id,
      leaseToken: redoLease,
      startFrame: acceptedDocument.cursorAppFrame,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: seededDoc.revision,
      records: acceptedDocument.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (acceptedDocument.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: acceptedDocument.interpolation.enabled,
      interpolationMode: 'duplicate',
      loopClips: acceptedDocument.loopClips,
      incomingInterpolationBreakKeyIds: acceptedDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: acceptedDocument.selectedKeyId,
      selectedAppFrame: acceptedDocument.selectedKeyId === null ? null : acceptedDocument.cursorAppFrame,
      cursorAppFrame: acceptedDocument.cursorAppFrame,
      historyProvenance: {
        historyCommandId: 'delete-rails-accepted',
        historyDirection: 'redo',
        sourceRevision: seededDoc.revision,
        targetRevision: acceptedDocument.revision,
      },
    });
    expect(redo.ok, redo.ok ? undefined : redo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(acceptedDocument);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(redoLease)).toBe(true);
  });

  it('settles a Rust-committed referenced Action deletion exactly once with enriched history facts', async () => {
    const test = await lifecycleHarness('detach-action-groups', 'referenced-action-committed');
    const committed = {
      schemaVersion: 1 as const, state: 'committed' as const,
      token: '123e4567-e89b-42d3-a456-426614174111', commandId: 'history-command-1', generation: 3,
      operationId: 'referenced-action-history-command-1', leaseToken: 'lease-authority-1', direction: 'forward' as const,
      mode: 'keep-groups' as const,
      authority: {
        projectContextId, layerId: test.layer.id, launchOperationId: test.payload.launchOperationId,
        actionId: 'action-1', expectedActionPresent: true, expectedActionRevision: 'action-revision-1',
        expectedPhysicalRevision: test.parentDocument.revision,
        expectedPhysicalHash: buildPhysicPaintRotoProjectEquality(test.parentDocument),
      },
      impactDigest: 'a'.repeat(64),
      retainedArtifact: {
        commandId: 'history-command-1', generation: 3, actionId: 'action-1',
        managedPath: 'scripts/action-1.efx-roto-script.json', originalRevision: 'action-revision-1', integritySha256: 'b'.repeat(64),
      },
      target: {
        physicalRevision: test.proposed.proposal.revision,
        physicalHash: buildPhysicPaintRotoProjectEquality(test.proposed.proposal),
        physicalDocument: test.proposed.proposal, selectedGroupId: null, cursorAppFrame: test.proposed.proposal.cursorAppFrame,
      },
    };
    if (!('actionId' in test.proposed.impact)) throw new Error('Expected Action lifecycle impact.');
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');
    const beforeVersion = physicPaintVersion.peek();

    const accepted = applyCommittedReferencedActionDeletion({ committed, impact: test.proposed.impact, before: test.parentDocument, leaseToken: test.leaseToken });
    const duplicate = applyCommittedReferencedActionDeletion({ committed, impact: test.proposed.impact, before: test.parentDocument, leaseToken: test.leaseToken });

    expect(accepted).toMatchObject({
      ok: true, settled: true,
      history: {
        commandId: 'history-command-1', generation: 3, direction: 'forward', mode: 'keep-groups',
        retainedArtifact: committed.retainedArtifact,
        before: { physicalRevision: test.parentDocument.revision },
        after: { physicalRevision: test.proposed.proposal.revision },
      },
    });
    expect(duplicate).toMatchObject({ ok: true, settled: false, history: accepted.ok ? accepted.history : undefined });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(physicPaintVersion.peek()).toBe(beforeVersion + 1);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.proposed.proposal);
  });

  it('settles exact Undo and Redo targets once through direction-specific leased authority', async () => {
    const test = await lifecycleHarness('delete-action-groups', 'referenced-action-directions');
    if (!('actionId' in test.proposed.impact)) throw new Error('Expected Action lifecycle impact.');
    const base = {
      schemaVersion: 1 as const,
      commandId: 'history-command-directions',
      generation: 9,
      operationId: 'referenced-action-history-command-directions',
      mode: 'delete-action-and-groups' as const,
      impactDigest: 'c'.repeat(64),
      retainedArtifact: {
        commandId: 'history-command-directions', generation: 9, actionId: 'action-1',
        managedPath: 'scripts/action-1.efx-roto-script.json', originalRevision: 'action-revision-1', integritySha256: 'd'.repeat(64),
      },
    };
    const forward = {
      ...base,
      state: 'committed' as const,
      token: '123e4567-e89b-42d3-a456-426614174201',
      leaseToken: 'forward-lease',
      direction: 'forward' as const,
      authority: {
        projectContextId, layerId: test.layer.id, launchOperationId: test.payload.launchOperationId,
        actionId: 'action-1', expectedActionPresent: true, expectedActionRevision: 'action-revision-1',
        expectedPhysicalRevision: test.parentDocument.revision,
        expectedPhysicalHash: buildPhysicPaintRotoProjectEquality(test.parentDocument),
      },
      target: {
        physicalRevision: test.proposed.proposal.revision,
        physicalHash: buildPhysicPaintRotoProjectEquality(test.proposed.proposal),
        physicalDocument: test.proposed.proposal,
        selectedGroupId: null,
        cursorAppFrame: test.proposed.proposal.cursorAppFrame,
      },
    };
    const acceptedForward = applyCommittedReferencedActionDeletion({
      committed: forward,
      impact: test.proposed.impact,
      before: test.parentDocument,
      leaseToken: test.leaseToken,
    });
    if (!acceptedForward.ok) throw new Error(`Forward setup failed: ${acceptedForward.reason}`);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);

    const undoLease = physicPaintStore.acquireRotoPhysicalOperationLease(projectContextId, test.layer.id, TEST_TRACK_ID);
    if (!undoLease) throw new Error('Expected Undo lease.');
    const undo = {
      ...base,
      state: 'committed' as const,
      token: '123e4567-e89b-42d3-a456-426614174202',
      leaseToken: 'undo-lease',
      direction: 'undo' as const,
      authority: {
        ...forward.authority,
        expectedActionPresent: false,
        expectedPhysicalRevision: acceptedForward.history.after.physicalRevision,
        expectedPhysicalHash: acceptedForward.history.after.physicalHash,
      },
      target: {
        physicalRevision: acceptedForward.history.before.physicalRevision,
        physicalHash: acceptedForward.history.before.physicalHash,
        physicalDocument: acceptedForward.history.before.document,
        selectedGroupId: acceptedForward.history.selection.beforeGroupId,
        cursorAppFrame: acceptedForward.history.before.document.cursorAppFrame,
      },
    };
    const acceptedUndo = applyCommittedReferencedActionDeletion({
      committed: undo,
      history: acceptedForward.history,
      leaseToken: undoLease,
    });
    const duplicateUndo = applyCommittedReferencedActionDeletion({
      committed: undo,
      history: acceptedForward.history,
      leaseToken: undoLease,
    });
    expect(acceptedUndo).toMatchObject({ ok: true, settled: true });
    expect(duplicateUndo).toMatchObject({ ok: true, settled: false });
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.parentDocument);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);

    const redoLease = physicPaintStore.acquireRotoPhysicalOperationLease(projectContextId, test.layer.id, TEST_TRACK_ID);
    if (!redoLease) throw new Error('Expected Redo lease.');
    const redo = {
      ...base,
      state: 'committed' as const,
      token: '123e4567-e89b-42d3-a456-426614174203',
      leaseToken: 'redo-lease',
      direction: 'redo' as const,
      authority: {
        ...forward.authority,
        expectedActionPresent: true,
        expectedPhysicalRevision: acceptedForward.history.before.physicalRevision,
        expectedPhysicalHash: acceptedForward.history.before.physicalHash,
      },
      target: {
        physicalRevision: acceptedForward.history.after.physicalRevision,
        physicalHash: acceptedForward.history.after.physicalHash,
        physicalDocument: acceptedForward.history.after.document,
        selectedGroupId: acceptedForward.history.selection.afterGroupId,
        cursorAppFrame: acceptedForward.history.after.document.cursorAppFrame,
      },
    };
    const beforeRejected = physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID);
    const rejected = applyCommittedReferencedActionDeletion({
      committed: { ...redo, generation: redo.generation + 1 },
      history: acceptedForward.history,
      leaseToken: redoLease,
    });
    expect(rejected.ok).toBe(false);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(beforeRejected);

    const acceptedRedo = applyCommittedReferencedActionDeletion({
      committed: redo,
      history: acceptedForward.history,
      leaseToken: redoLease,
    });
    expect(acceptedRedo).toMatchObject({ ok: true, settled: true });
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.proposed.proposal);
  });

  it('rejects stale, malformed, and semantically mismatched lifecycle candidates without publication', async () => {
    const variants = [
      (payload: Awaited<ReturnType<typeof lifecycleHarness>>['payload']) => ({
        ...payload,
        expectedRevision: 'stale-revision',
      }),
      (payload: Awaited<ReturnType<typeof lifecycleHarness>>['payload']) => ({
        ...payload,
        semanticDelta: { ...payload.semanticDelta, cleanupKeyIds: ['source-A'] },
      }),
      (payload: Awaited<ReturnType<typeof lifecycleHarness>>['payload']) => ({
        ...payload,
        loopClips: payload.loopClips.map((group) => ({ ...group, syncState: 'synchronized' as const })),
      }),
    ];

    for (const [index, mutate] of variants.entries()) {
      const test = await lifecycleHarness('delete-group-frame', `lifecycle-rejected-${index}`);
      const before = physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID);
      const beforeVersion = physicPaintVersion.peek();
      const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

      const result = await applyPhysicPaintPayload(mutate(test.payload) as PhysicPaintApplyPayload);

      expect(result.ok).toBe(false);
      expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(before);
      expect(physicPaintVersion.peek()).toBe(beforeVersion);
      expect(replace).not.toHaveBeenCalled();
      expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);
      vi.restoreAllMocks();
    }
  });

  it('rejects stale, malformed, and semantically mismatched delete-rails candidates with distinct errors and zero publication', async () => {
    const variants: {
      name: string;
      mutate: (payload: Awaited<ReturnType<typeof lifecycleHarness>>['payload']) => Record<string, unknown>;
      error: string;
    }[] = [
      {
        name: 'stale revision',
        mutate: (payload) => ({ ...payload, expectedRevision: 'stale-revision' }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Roto physical revision became stale before commit.',
      },
      {
        name: 'divergent members',
        mutate: (payload) => ({
          ...payload,
          semanticDelta: {
            ...payload.semanticDelta,
            members: [{ kind: 'loop', loopId: 'group-1' }],
          },
        }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Delete Rails semantic impact does not match parent recomputation.',
      },
      {
        name: 'divergent cleanupKeyIds',
        mutate: (payload) => ({
          ...payload,
          semanticDelta: { ...payload.semanticDelta, cleanupKeyIds: ['source-A'] },
        }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Delete Rails semantic impact does not match parent recomputation.',
      },
      {
        name: 'divergent records',
        mutate: (payload) => ({
          ...payload,
          records: [...payload.records, (() => {
            const { kind: _kind, ...record } = makePhysicalRecord('extra', 29);
            return record;
          })()],
        }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Delete Rails target document does not match parent recomputation.',
      },
      {
        name: 'divergent loopClips',
        mutate: (payload) => ({
          ...payload,
          loopClips: [...payload.loopClips, {
            loopId: 'group-extra',
            placementStart: 0,
            sourceKeyIds: ['source-A'],
            repeat: 1 as const,
            mode: 'progressive' as const,
            scriptId: 'action-1',
            motion: { deformation: 0, position: 0 },
            overrideColor: null,
            syncState: 'synchronized' as const,
            provenanceState: 'attached' as const,
            phaseOrigin: 0,
            originalEndExclusive: 3,
            visibleRanges: [{ start: 0, endExclusive: 3 }],
            frameOverrides: [],
          }],
        }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Delete Rails target document does not match parent recomputation.',
      },
      {
        name: 'divergent breaks',
        mutate: (payload) => ({
          ...payload,
          incomingInterpolationBreakKeyIds: ['source-A'],
        }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Delete Rails target document does not match parent recomputation.',
      },
      {
        name: 'divergent selection',
        mutate: (payload) => ({ ...payload, selectedKeyId: 'source-A', selectedAppFrame: 0 }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Delete Rails target document does not match parent recomputation.',
      },
      {
        name: 'divergent cursor',
        mutate: (payload) => ({ ...payload, cursorAppFrame: 7 }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Delete Rails target document does not match parent recomputation.',
      },
      {
        name: 'empty members',
        mutate: (payload) => ({
          ...payload,
          semanticDelta: { ...payload.semanticDelta, members: [] },
        }),
        error: 'Invalid physics paint apply payload',
      },
      {
        name: 'stale member',
        mutate: (payload) => ({
          ...payload,
          semanticDelta: {
            ...payload.semanticDelta,
            members: [{ kind: 'key-rail', firstKeyId: 'source-A', keyIds: ['source-A'] }],
          },
        }),
        error: 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. Delete Rails proposal rejected: stale-member.',
      },
    ];

    for (const [index, variant] of variants.entries()) {
      const test = await lifecycleHarness('delete-rails', `delete-rails-rejected-${index}`);
      const before = physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID);
      const beforeVersion = physicPaintVersion.peek();
      const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

      const result = await applyPhysicPaintPayload(variant.mutate(test.payload) as unknown as PhysicPaintApplyPayload);

      expect(result.ok, `${variant.name}: ${result.ok ? 'accepted' : result.error}`).toBe(false);
      expect(result.ok ? null : result.error).toBe(variant.error);
      expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(before);
      expect(physicPaintVersion.peek()).toBe(beforeVersion);
      expect(replace).not.toHaveBeenCalled();
      expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);
      vi.restoreAllMocks();
    }
  });
});

describe('Phase 43.6 parent recompute of rail-set paste (quick 260820-bjw)', async () => {
  const projectContextId = 'abababab-abab-4bab-8bab-abababababab';

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerTrackDocument('phys-layer-1');
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
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('RED: accepts a paste whose proposal + impact come from the shared pure proposer (one recompute law)', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    projectStore.projectContextId.value = projectContextId;
    sequenceStore.add({
      id: 'bridge-paste-rails-sequence',
      kind: 'fx',
      name: 'Bridge paste-rails authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 100,
    });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const records = [
      makePhysicalRecord('k0', 0),
      makePhysicalRecord('k2', 2),
      makePhysicalRecord('k6', 6),
      makePhysicalRecord('k8', 8),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 100,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 10,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, [], ['k6']),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['k6'],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    registerRotoAlphaCanvasFrame(records[0].payload.bytes, { width: 1000, height: 650 } as HTMLCanvasElement);
    const launch = await openPhysicPaintCanvas({ layer, frame: 10 });
    if (!launch.ok) throw new Error(launch.error);
    const seededDoc = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!seededDoc) throw new Error('Expected seeded physical document.');

    const leaseToken = acquirePhysicalLease(layer.id, projectContextId);

    const copyPayload = (): RotoRailSetCopyPayload => Object.freeze({
      anchorAppFrame: 0,
      // '' = legacy payload with no track context (46-03).
      sourceTrackId: '',
      members: Object.freeze([
        Object.freeze({
          kind: 'key-rail' as const,
          firstKeyId: 'k0',
          firstKeyFrame: 0,
          firstKeyOwnsIncomingBreak: false,
          entries: Object.freeze([
            Object.freeze({
              sourceKeyId: 'k0',
              sourceAppFrame: 0,
              ownsIncomingBreak: false,
              payload: { frameIndex: 0, appFrame: 0, bytes: records[0].payload.bytes, width: 1000, height: 650 },
            }),
            Object.freeze({
              sourceKeyId: 'k2',
              sourceAppFrame: 2,
              ownsIncomingBreak: false,
              payload: { frameIndex: 0, appFrame: 2, bytes: records[1].payload.bytes, width: 1000, height: 650 },
            }),
          ]),
        }),
        Object.freeze({
          kind: 'key-rail' as const,
          firstKeyId: 'k6',
          firstKeyFrame: 6,
          firstKeyOwnsIncomingBreak: true,
          entries: Object.freeze([
            Object.freeze({
              sourceKeyId: 'k6',
              sourceAppFrame: 6,
              ownsIncomingBreak: true,
              payload: { frameIndex: 0, appFrame: 6, bytes: records[2].payload.bytes, width: 1000, height: 650 },
            }),
            Object.freeze({
              sourceKeyId: 'k8',
              sourceAppFrame: 8,
              ownsIncomingBreak: false,
              payload: { frameIndex: 0, appFrame: 8, bytes: records[3].payload.bytes, width: 1000, height: 650 },
            }),
          ]),
        }),
      ]),
    });

    // The child proposal comes from the pure shared proposer — the SAME law the
    // parent recompute branch runs. Ship the proposal records + the impact
    // (which carries the frozen payload, placement facts, and the fresh
    // identity allocation) through the real bridge.
    const proposed = proposeRails({
      document: seededDoc,
      payload: copyPayload(),
      placementMode: 'paste',
      destinationAppFrame: 10,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error(`Paste proposal must resolve: ${proposed.reason}`);
    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'paste-rails-accepted',
      operationKind: 'paste',
      leaseToken,
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: seededDoc.revision,
      records: proposed.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (proposed.proposal.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: proposed.proposal.interpolation.enabled,
      interpolationMode: proposed.proposal.interpolation.mode,
      loopClips: proposed.proposal.loopClips,
      incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: proposed.proposal.selectedKeyId,
      selectedAppFrame: proposed.proposal.selectedKeyId === null ? null : proposed.proposal.cursorAppFrame,
      cursorAppFrame: proposed.proposal.cursorAppFrame,
      semanticDelta: proposed.impact,
    });

    expect(result.ok, result.ok ? undefined : result.error).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!acceptedDocument) throw new Error('Expected accepted paste document.');
    // Four fresh identities land at the preserved relative layout.
    expect(acceptedDocument.realKeyRecords).toHaveLength(8);
    // Break contract after the 260820-bjw UAT-1 boundary rules: the original
    // k6 break survives; the first pasted rail's fresh first key owns the
    // boundary break (content lies to its left); the second pasted rail's
    // fresh first key keeps the break it owned in the source set.
    const frameByKeyId = new Map(acceptedDocument.realKeyRecords.map((record) => [record.keyId, record.appFrame] as const));
    const orderedFresh = acceptedDocument.realKeyRecords
      .map((record) => record.keyId)
      .filter((keyId) => !['k0', 'k2', 'k6', 'k8'].includes(keyId))
      .sort((left, right) => frameByKeyId.get(left)! - frameByKeyId.get(right)!);
    expect(orderedFresh).toHaveLength(4);
    const orderedBreaks = [...acceptedDocument.incomingInterpolationBreakKeyIds]
      .sort((left, right) => (frameByKeyId.get(left) ?? 0) - (frameByKeyId.get(right) ?? 0));
    expect(orderedBreaks).toEqual(['k6', orderedFresh[0], orderedFresh[2]]);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);
  });

  it('RED (UAT-4): an Undo of a paste replay is accepted even though the pre-paste selection differs from the paste’s own payload selection', async () => {
    // G-43.6-2 class bug: delete-rails records its pre-op selection from the
    // current document so undo replay-target equality holds; paste must do the
    // same. Here the source rail is selected ('k0') before the paste, but the
    // paste payload ships a null selection. The history submitter replays undo
    // with the PRE-paste selection ('k0', from entry.before). If the parent
    // recorded paste's before snapshot used the payload selection (null) it
    // fails replay-target equality and silently no-ops undo.
    const layer = physicLayer();
    mockLayers([layer], null);
    projectStore.projectContextId.value = projectContextId;
    sequenceStore.add({
      id: 'bridge-paste-rails-undo-sequence',
      kind: 'fx',
      name: 'Bridge paste-rails undo authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 100,
    });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const records = [
      makePhysicalRecord('k0', 0),
      makePhysicalRecord('k2', 2),
      makePhysicalRecord('k6', 6),
      makePhysicalRecord('k8', 8),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 100,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'k0',
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, [], ['k6']),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['k6'],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    registerRotoAlphaCanvasFrame(records[0].payload.bytes, { width: 1000, height: 650 } as HTMLCanvasElement);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error(launch.error);
    const seededDoc = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!seededDoc) throw new Error('Expected seeded physical document.');
    expect(seededDoc.selectedKeyId).toBe('k0');

    const copyPayload = (): RotoRailSetCopyPayload => Object.freeze({
      anchorAppFrame: 0,
      // '' = legacy payload with no track context (46-03).
      sourceTrackId: '',
      members: Object.freeze([
        Object.freeze({
          kind: 'key-rail' as const,
          firstKeyId: 'k0',
          firstKeyFrame: 0,
          firstKeyOwnsIncomingBreak: false,
          entries: Object.freeze([
            Object.freeze({ sourceKeyId: 'k0', sourceAppFrame: 0, ownsIncomingBreak: false, payload: { frameIndex: 0, appFrame: 0, bytes: records[0].payload.bytes, width: 1000, height: 650 } }),
            Object.freeze({ sourceKeyId: 'k2', sourceAppFrame: 2, ownsIncomingBreak: false, payload: { frameIndex: 0, appFrame: 2, bytes: records[1].payload.bytes, width: 1000, height: 650 } }),
          ]),
        }),
      ]),
    });

    const proposed = proposeRails({
      document: seededDoc,
      payload: copyPayload(),
      placementMode: 'paste',
      destinationAppFrame: 10,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error(`Paste proposal must resolve: ${proposed.reason}`);
    const pasteLease = acquirePhysicalLease(layer.id, projectContextId);
    const paste = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'paste-rails-undo-target',
      operationKind: 'paste',
      leaseToken: pasteLease,
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: seededDoc.revision,
      records: proposed.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (proposed.proposal.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: proposed.proposal.interpolation.enabled,
      interpolationMode: proposed.proposal.interpolation.mode,
      loopClips: proposed.proposal.loopClips,
      incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: proposed.proposal.selectedKeyId,
      selectedAppFrame: proposed.proposal.selectedKeyId === null ? null : proposed.proposal.cursorAppFrame,
      cursorAppFrame: proposed.proposal.cursorAppFrame,
      semanticDelta: proposed.impact,
    });
    expect(paste.ok, paste.ok ? undefined : paste.error).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!acceptedDocument) throw new Error('Expected accepted paste document.');
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(pasteLease)).toBe(true);

    // Undo supplies the PRE-paste selection ('k0', from the history entry.before)
    // exactly as the coordinator/history submits it.
    const undoLease = acquirePhysicalLease(layer.id, projectContextId);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'paste-rails-undo-target-undo',
      operationKind: 'undo',
      leaseToken: undoLease,
      layerId: layer.id,
      startFrame: 0,
      cursorAppFrame: 0,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: acceptedDocument.revision,
      records: seededDoc.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (seededDoc.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: seededDoc.interpolation.enabled,
      interpolationMode: seededDoc.interpolation.mode,
      loopClips: seededDoc.loopClips,
      incomingInterpolationBreakKeyIds: seededDoc.incomingInterpolationBreakKeyIds,
      selectedKeyId: 'k0',
      selectedAppFrame: 0,
      historyProvenance: {
        historyCommandId: 'paste-rails-undo-target',
        historyDirection: 'undo',
        sourceRevision: acceptedDocument.revision,
        targetRevision: seededDoc.revision,
      },
    });
    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(seededDoc);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);
  });

  it('RED (46 UAT): a LOOP-clip paste replays its Undo target — the pre-paste document (source loop + key) is byte-restored', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    projectStore.projectContextId.value = projectContextId;
    sequenceStore.add({
      id: 'bridge-loop-paste-undo-sequence',
      kind: 'fx',
      name: 'Bridge loop-paste undo',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 100,
    });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const sourceRecord = makePhysicalRecord('k0', 0);
    const loopClip: PhysicPaintRotoLoopClip = {
      loopId: 'g1',
      placementStart: 0,
      sourceKeyIds: ['k0'],
      repeat: 2,
      mode: 'progressive',
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 4,
      visibleRanges: [{ start: 0, endExclusive: 4 }],
      frameOverrides: [],
    };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 100,
      realKeyRecords: [sourceRecord],
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: 'k0',
      cursorAppFrame: 0,
      revision: buildPhysicPaintRotoPhysicalRevision([sourceRecord], interpolation, [loopClip], []),
      loopClips: [loopClip],
      incomingInterpolationBreakKeyIds: [],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    registerRotoAlphaCanvasFrame(sourceRecord.payload.bytes, { width: 1000, height: 650 } as HTMLCanvasElement);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error(launch.error);
    const seededDoc = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!seededDoc) throw new Error('Expected seeded physical document.');

    const copyPayload = (): RotoRailSetCopyPayload => Object.freeze({
      anchorAppFrame: 0,
      sourceTrackId: '',
      members: Object.freeze([
        Object.freeze({
          kind: 'loop' as const,
          loopId: 'g1',
          placementStart: 0,
          clip: loopClip,
          effectiveEndExclusive: 4,
          repeat: 2,
        }),
      ]),
    });

    const proposed = proposeRails({
      document: seededDoc,
      payload: copyPayload(),
      placementMode: 'paste',
      destinationAppFrame: 10,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error(`Loop paste proposal must resolve: ${proposed.reason}`);
    const pasteLease = acquirePhysicalLease(layer.id, projectContextId);
    const paste = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'loop-paste-undo-target',
      operationKind: 'paste',
      leaseToken: pasteLease,
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: seededDoc.revision,
      records: proposed.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (proposed.proposal.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: proposed.proposal.interpolation.enabled,
      interpolationMode: proposed.proposal.interpolation.mode,
      loopClips: proposed.proposal.loopClips,
      incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: proposed.proposal.selectedKeyId,
      selectedAppFrame: proposed.proposal.selectedKeyId === null ? null : proposed.proposal.cursorAppFrame,
      cursorAppFrame: proposed.proposal.cursorAppFrame,
      semanticDelta: proposed.impact,
    });
    expect(paste.ok, paste.ok ? undefined : paste.error).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!acceptedDocument) throw new Error('Expected accepted loop-paste document.');
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(pasteLease)).toBe(true);

    // Undo replays the PRE-paste document (source loop + clip), exactly as the
    // coordinator/history submits entry.before.
    const undoLease = acquirePhysicalLease(layer.id, projectContextId);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'loop-paste-undo-target-undo',
      operationKind: 'undo',
      leaseToken: undoLease,
      layerId: layer.id,
      startFrame: 0,
      cursorAppFrame: 0,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: acceptedDocument.revision,
      records: seededDoc.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (seededDoc.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: seededDoc.interpolation.enabled,
      interpolationMode: seededDoc.interpolation.mode,
      loopClips: seededDoc.loopClips,
      incomingInterpolationBreakKeyIds: seededDoc.incomingInterpolationBreakKeyIds,
      selectedKeyId: 'k0',
      selectedAppFrame: 0,
      historyProvenance: {
        historyCommandId: 'loop-paste-undo-target',
        historyDirection: 'undo',
        sourceRevision: acceptedDocument.revision,
        targetRevision: seededDoc.revision,
      },
    });
    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(seededDoc);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);
  });

  it('RED: rejects a paste whose records diverge from the shared recompute with zero publication', async () => {
    const layer = physicLayer();
    mockLayers([layer], null);
    projectStore.projectContextId.value = projectContextId;
    sequenceStore.add({
      id: 'bridge-paste-rails-reject-sequence',
      kind: 'fx',
      name: 'Bridge paste-rails reject',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [layer],
      inFrame: 0,
      outFrame: 100,
    });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const records = [
      makePhysicalRecord('k0', 0),
      makePhysicalRecord('k2', 2),
      makePhysicalRecord('k6', 6),
      makePhysicalRecord('k8', 8),
    ];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 100,
      realKeyRecords: records,
      groupOverrideRecords: [],
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 10,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, [], ['k6']),
      loopClips: [],
      incomingInterpolationBreakKeyIds: ['k6'],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    registerRotoAlphaCanvasFrame(records[0].payload.bytes, { width: 1000, height: 650 } as HTMLCanvasElement);
    const launch = await openPhysicPaintCanvas({ layer, frame: 10 });
    if (!launch.ok) throw new Error(launch.error);
    const seededDoc = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!seededDoc) throw new Error('Expected seeded physical document.');
    const leaseToken = acquirePhysicalLease(layer.id, projectContextId);
    const beforeVersion = physicPaintVersion.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const payload: RotoRailSetCopyPayload = Object.freeze({
      anchorAppFrame: 0,
      // '' = same-track payload with no track context (46-03).
      sourceTrackId: '',
      members: Object.freeze([
        Object.freeze({
          kind: 'key-rail' as const,
          firstKeyId: 'k0',
          firstKeyFrame: 0,
          firstKeyOwnsIncomingBreak: false,
          entries: Object.freeze([
            Object.freeze({
              sourceKeyId: 'k0',
              sourceAppFrame: 0,
              ownsIncomingBreak: false,
              payload: { frameIndex: 0, appFrame: 0, bytes: records[0].payload.bytes, width: 1000, height: 650 },
            }),
          ]),
        }),
      ]),
    });
    const proposed = proposeRails({
      document: seededDoc,
      payload,
      placementMode: 'paste',
      destinationAppFrame: 10,
    });
    expect(proposed.ok).toBe(true);
    if (!proposed.ok) throw new Error(`Paste proposal must resolve: ${proposed.reason}`);
    // Ship the real proposal records but a delta that claims a stale
    // previousRevision — the parent authority must reject the WHOLE paste.
    const result = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'paste-rails-divergent-delta',
      operationKind: 'paste',
      leaseToken,
      layerId: layer.id,
      startFrame: 10,
      launchOperationId: launch.data.operationId,
      projectContextId,
      expectedRevision: seededDoc.revision,
      records: proposed.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: (proposed.proposal.groupOverrideRecords ?? []).map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: proposed.proposal.interpolation.enabled,
      interpolationMode: proposed.proposal.interpolation.mode,
      loopClips: proposed.proposal.loopClips,
      incomingInterpolationBreakKeyIds: proposed.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: proposed.proposal.selectedKeyId,
      selectedAppFrame: proposed.proposal.selectedKeyId === null ? null : proposed.proposal.cursorAppFrame,
      cursorAppFrame: proposed.proposal.cursorAppFrame,
      semanticDelta: { ...proposed.impact, previousRevision: 'revision-other' },
    });

    expect(result.ok, result.ok ? 'accepted' : result.error).toBe(false);
    expect(physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID)).toEqual(seededDoc);
    expect(physicPaintVersion.peek()).toBe(beforeVersion);
    expect(replace).not.toHaveBeenCalled();
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(leaseToken)).toBe(true);
  });
});

type ControlledHistoryLedger = Readonly<{
  revision: string;
  hash: string;
  document: string;
  version: number;
  historyIndex: number;
  selection: Readonly<{ groupId: string | null; appFrame: number }>;
  events: Readonly<{ replacements: number; versions: number; histories: number; selections: number }>;
}>;

function applyControlledHistoryTransition(
  accepted: ControlledHistoryLedger,
  proposal: Readonly<{
    direction: 'forward' | 'undo' | 'redo' | 'recovery';
    expectedRevision: string;
    expectedHash: string;
    nextRevision: string;
    nextHash: string;
    nextDocument: string;
    sharingResolved: boolean;
    precedenceResolved: boolean;
    nextHistoryIndex: number;
    nextSelection: Readonly<{ groupId: string | null; appFrame: number }>;
  }>,
): ControlledHistoryLedger {
  if (proposal.expectedRevision !== accepted.revision
    || proposal.expectedHash !== accepted.hash
    || !proposal.sharingResolved
    || !proposal.precedenceResolved) return accepted;
  return Object.freeze({
    revision: proposal.nextRevision,
    hash: proposal.nextHash,
    document: proposal.nextDocument,
    version: accepted.version + 1,
    historyIndex: proposal.nextHistoryIndex,
    selection: Object.freeze({ ...proposal.nextSelection }),
    events: Object.freeze({ replacements: 1, versions: 1, histories: 1, selections: 1 }),
  });
}

describe('Phase 43.2 exact accepted history and newer-document protection contract', async () => {
  const synchronized: ControlledHistoryLedger = Object.freeze({
    revision: 'revision-sync',
    hash: 'hash-sync',
    document: 'bytes:synchronized',
    version: 4,
    historyIndex: 0,
    selection: Object.freeze({ groupId: 'group-1', appFrame: 4 }),
    events: Object.freeze({ replacements: 0, versions: 0, histories: 0, selections: 0 }),
  });
  const forward = Object.freeze({
    direction: 'forward' as const,
    expectedRevision: 'revision-sync',
    expectedHash: 'hash-sync',
    nextRevision: 'revision-modified',
    nextHash: 'hash-modified',
    nextDocument: 'bytes:modified-frame-4-only',
    sharingResolved: true,
    precedenceResolved: true,
    nextHistoryIndex: 1,
    nextSelection: Object.freeze({ groupId: 'group-1', appFrame: 4 }),
  });

  it('records one replacement, version, history, and selection event for forward, Undo, and Redo', async () => {
    const modified = applyControlledHistoryTransition(synchronized, forward);
    const undone = applyControlledHistoryTransition(modified, {
      ...forward,
      direction: 'undo',
      expectedRevision: 'revision-modified',
      expectedHash: 'hash-modified',
      nextRevision: 'revision-sync',
      nextHash: 'hash-sync',
      nextDocument: 'bytes:synchronized',
      nextHistoryIndex: 0,
    });
    const redone = applyControlledHistoryTransition(undone, {
      ...forward,
      direction: 'redo',
    });

    expect(modified).toMatchObject({
      document: 'bytes:modified-frame-4-only',
      version: 5,
      historyIndex: 1,
      events: { replacements: 1, versions: 1, histories: 1, selections: 1 },
    });
    expect(undone).toMatchObject({ document: 'bytes:synchronized', historyIndex: 0 });
    expect(redone).toMatchObject({ document: 'bytes:modified-frame-4-only', historyIndex: 1 });
  });

  it('preserves exact accepted semantics for stale, ambiguous, unresolved, and newer-document recovery rejection', async () => {
    const proposals = [
      { ...forward, expectedRevision: 'revision-stale' },
      { ...forward, sharingResolved: false },
      { ...forward, precedenceResolved: false },
      {
        ...forward,
        direction: 'recovery' as const,
        expectedRevision: 'revision-sync',
        expectedHash: 'hash-sync',
      },
    ];
    const newerAccepted = Object.freeze({
      ...synchronized,
      revision: 'revision-newer',
      hash: 'hash-newer',
      document: 'bytes:newer-accepted',
      version: 9,
    });

    expect(applyControlledHistoryTransition(synchronized, proposals[0])).toBe(synchronized);
    expect(applyControlledHistoryTransition(synchronized, proposals[1])).toBe(synchronized);
    expect(applyControlledHistoryTransition(synchronized, proposals[2])).toBe(synchronized);
    expect(applyControlledHistoryTransition(newerAccepted, proposals[3])).toBe(newerAccepted);
    expect(newerAccepted.events).toEqual({ replacements: 0, versions: 0, histories: 0, selections: 0 });
    expect(newerAccepted.selection).toEqual({ groupId: 'group-1', appFrame: 4 });
  });
});

describe('Phase 43.2 leased source-phase Paint parent tracer', async () => {
  const projectContextId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerTrackDocument('phys-layer-1');
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
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  async function harness(operationId: string) {
    const layer = physicLayer();
    mockLayers([layer]);
    projectStore.projectContextId.value = projectContextId;
    const records = [makePhysicalRecord('source-A', 0), makePhysicalRecord('source-B', 1)];
    const interpolation = { enabled: false, mode: 'duplicate' as const };
    const loopClips = [{
      loopId: 'group-1',
      placementStart: 0,
      sourceKeyIds: ['source-A', 'source-B'],
      repeat: 3 as const,
      mode: 'progressive' as const,
      syncState: 'synchronized' as const,
      provenanceState: 'attached' as const,
      phaseOrigin: 0,
      originalEndExclusive: 6,
      visibleRanges: [{ start: 0, endExclusive: 6 }],
      frameOverrides: [],
    }];
    const seeded = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, {
      capacity: 30,
      realKeyRecords: records,
      interpolation,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 4,
      revision: buildPhysicPaintRotoPhysicalRevision(records, interpolation, loopClips),
      loopClips,
      incomingInterpolationBreakKeyIds: [],
    });
    if (!seeded.ok) throw new Error(seeded.error);
    registerRotoAlphaCanvasFrame(records[0].payload.bytes, { width: 1000, height: 650 } as HTMLCanvasElement);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 4 });
    if (!launch.ok) throw new Error(launch.error);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!acceptedDocument) throw new Error('Expected seeded physical document.');
    const proposalResult = proposePhysicPaintRotoGroupFramePaint({
      document: acceptedDocument,
      groupId: 'group-1',
      appFrame: 4,
      overrideKeyId: 'override-4',
      renderedPayload: makePhysicalRecord('override-4', 4).payload,
    });
    if (!proposalResult.ok) throw new Error(proposalResult.reason);
    const leaseToken = physicPaintStore.acquireRotoPhysicalOperationLease(projectContextId, layer.id, TEST_TRACK_ID);
    if (!leaseToken) throw new Error('Expected physical-operation lease.');
    return {
      layer,
      acceptedDocument,
      proposalResult,
      leaseToken,
      request: {
        operationId,
        projectContextId,
        layerId: layer.id,
        launchOperationId: launch.data.operationId,
        expectedRevision: acceptedDocument.revision,
        expectedProjectEquality: buildPhysicPaintRotoProjectEquality(acceptedDocument),
        groupId: 'group-1',
        appFrame: 4,
        overrideKeyId: 'override-4',
        renderedPayload: makePhysicalRecord('override-4', 4).payload,
        claimedCleanupKeyIds: [] as readonly string[],
        proposal: proposalResult.proposal,
        impact: proposalResult.impact,
        leaseToken,
      },
    };
  }

  it('keeps the sole store replacement closed to missing, mismatched, and replayed lease tokens', async () => {
    const test = await harness('group-paint-store-token-gate');
    const beforeDocument = physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID);
    const beforeVersion = physicPaintVersion.peek();

    expect(physicPaintStore.replaceRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID, test.proposalResult.proposal)).toEqual({
      ok: false,
      error: 'missing-token',
    });
    expect(physicPaintStore.replaceRotoPhysicalDocument(
      test.layer.id, TEST_TRACK_ID,
      test.proposalResult.proposal,
      { ...test.leaseToken, generation: test.leaseToken.generation + 1 },
    )).toEqual({ ok: false, error: 'mismatched-token' });
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);
    expect(physicPaintStore.replaceRotoPhysicalDocument(
      test.layer.id, TEST_TRACK_ID,
      test.proposalResult.proposal,
      test.leaseToken,
    )).toEqual({ ok: false, error: 'replayed-token' });
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(beforeDocument);
    expect(physicPaintVersion.peek()).toBe(beforeVersion);
  });

  it('recomputes and publishes once with one version notification and one accepted history command', async () => {
    const test = await harness('group-paint-accepted');
    const beforeVersion = physicPaintVersion.peek();
    const beforePhysicalRevision = rotoPhysicalRevision.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    const result = applyPhysicPaintRotoGroupFramePaint(test.request);

    expect(result).toEqual({ ok: true, acceptedDocument: test.proposalResult.proposal, historyCommandId: 'group-paint-accepted' });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(test.layer.id, TEST_TRACK_ID, test.proposalResult.proposal, test.leaseToken);
    expect(physicPaintVersion.peek()).toBe(beforeVersion + 1);
    expect(rotoPhysicalRevision.peek()).toBe(beforePhysicalRevision + 1);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.proposalResult.proposal);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);
  });

  it('preserves ordinary source bytes while Undo and Redo remove and restore a source-occurrence override', async () => {
    const test = await harness('group-paint-source-history');
    const sourceRecords = structuredClone(test.acceptedDocument.realKeyRecords);
    const sourcePaint = proposePhysicPaintRotoGroupFramePaint({
      document: test.acceptedDocument,
      groupId: 'group-1',
      appFrame: 0,
      overrideKeyId: 'override-source-0',
      renderedPayload: {
        ...makePhysicalRecord('override-source-0', 0).payload,
        bytes: OPAQUE_ONE_PIXEL_WEBP,
        width: 1,
        height: 1,
      },
    });
    if (!sourcePaint.ok) throw new Error(sourcePaint.reason);
    const request = {
      ...test.request,
      operationId: 'group-paint-source-history',
      appFrame: 0,
      overrideKeyId: 'override-source-0',
      renderedPayload: sourcePaint.proposal.groupOverrideRecords![0].payload,
      proposal: sourcePaint.proposal,
      impact: sourcePaint.impact,
    };

    const forward = applyPhysicPaintRotoGroupFramePaint(request);
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    expect(forward.acceptedDocument.realKeyRecords).toEqual(sourceRecords);
    expect(forward.acceptedDocument.groupOverrideRecords).toEqual(sourcePaint.proposal.groupOverrideRecords);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);

    const undoLease = acquirePhysicalLease(test.layer.id, projectContextId);
    const undo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'group-paint-source-history-undo',
      operationKind: 'undo',
      layerId: test.layer.id,
      leaseToken: undoLease,
      startFrame: test.acceptedDocument.cursorAppFrame,
      launchOperationId: request.launchOperationId,
      projectContextId,
      expectedRevision: sourcePaint.proposal.revision,
      records: test.acceptedDocument.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: [],
      interpolationEnabled: test.acceptedDocument.interpolation.enabled,
      interpolationMode: test.acceptedDocument.interpolation.mode,
      loopClips: test.acceptedDocument.loopClips,
      incomingInterpolationBreakKeyIds: test.acceptedDocument.incomingInterpolationBreakKeyIds,
      selectedKeyId: test.acceptedDocument.selectedKeyId,
      selectedAppFrame: null,
      cursorAppFrame: test.acceptedDocument.cursorAppFrame,
      historyProvenance: {
        historyCommandId: request.operationId,
        historyDirection: 'undo',
        sourceRevision: sourcePaint.proposal.revision,
        targetRevision: test.acceptedDocument.revision,
      },
    });
    expect(undo.ok, undo.ok ? undefined : undo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(test.acceptedDocument);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(undoLease)).toBe(true);

    const redoLease = acquirePhysicalLease(test.layer.id, projectContextId);
    const redo = await applyPhysicPaintPayload({
      kind: 'replace-roto-physical-map',
      trackId: TEST_TRACK_ID,
      operationId: 'group-paint-source-history-redo',
      operationKind: 'redo',
      layerId: test.layer.id,
      leaseToken: redoLease,
      startFrame: sourcePaint.proposal.cursorAppFrame,
      launchOperationId: request.launchOperationId,
      projectContextId,
      expectedRevision: test.acceptedDocument.revision,
      records: sourcePaint.proposal.realKeyRecords.map(({ kind: _kind, ...record }) => record),
      groupOverrideRecords: sourcePaint.proposal.groupOverrideRecords!.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: sourcePaint.proposal.interpolation.enabled,
      interpolationMode: sourcePaint.proposal.interpolation.mode,
      loopClips: sourcePaint.proposal.loopClips,
      incomingInterpolationBreakKeyIds: sourcePaint.proposal.incomingInterpolationBreakKeyIds,
      selectedKeyId: sourcePaint.proposal.selectedKeyId,
      selectedAppFrame: null,
      cursorAppFrame: sourcePaint.proposal.cursorAppFrame,
      historyProvenance: {
        historyCommandId: request.operationId,
        historyDirection: 'redo',
        sourceRevision: test.acceptedDocument.revision,
        targetRevision: sourcePaint.proposal.revision,
      },
    });
    expect(redo.ok, redo.ok ? undefined : redo.error).toBe(true);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(sourcePaint.proposal);
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)?.realKeyRecords).toEqual(sourceRecords);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(redoLease)).toBe(true);
  });

  it.each([
    ['stale', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, expectedRevision: 'stale-revision' })],
    ['stale', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, expectedProjectEquality: 'stale-project-equality' })],
    ['malformed', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, proposal: { ...request.proposal, loopClips: [{ ...request.proposal.loopClips[0], visibleRanges: [{ start: 0, endExclusive: 4 }, { start: 4, endExclusive: 6 }] }] } })],
    ['malformed', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, proposal: { ...request.proposal, loopClips: [{ ...request.proposal.loopClips[0], frameOverrides: [{ appFrame: 4, keyId: 'override-4' }, { appFrame: 4, keyId: 'duplicate' }] }] } })],
    ['malformed', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, proposal: { ...request.proposal, loopClips: [...request.proposal.loopClips, { ...request.proposal.loopClips[0], loopId: 'group-2', sourceKeyIds: ['source-B', 'source-A'] }] } })],
    ['unresolved-precedence', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, unresolvedPrecedence: true })],
    ['cleanup-reference-mismatch', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, claimedCleanupKeyIds: ['source-A'] })],
    ['missing-token', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, leaseToken: undefined })],
    ['mismatched-token', (request: Awaited<ReturnType<typeof harness>>['request']) => ({ ...request, leaseToken: { ...request.leaseToken, generation: request.leaseToken.generation + 1 } })],
  ] as const)(
    'rejects %s authority or proposal mismatch without document, version, selection, cursor, or canvas change',
    async (reason, mutate) => {
      const test = await harness(`group-paint-reject-${reason}-${crypto.randomUUID()}`);
      const beforeDocument = physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID);
      const beforeVersion = physicPaintVersion.peek();
      const beforePhysicalRevision = rotoPhysicalRevision.peek();
      const beforeRenderSource = physicPaintStore.getRotoPhysicalRenderSource(test.layer.id, TEST_TRACK_ID, 0);
      const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

      const result = applyPhysicPaintRotoGroupFramePaint(mutate(test.request) as never);

      expect(result).toEqual({ ok: false, reason });
      expect(replace).not.toHaveBeenCalled();
      expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(beforeDocument);
      expect(physicPaintVersion.peek()).toBe(beforeVersion);
      expect(rotoPhysicalRevision.peek()).toBe(beforePhysicalRevision);
      expect(physicPaintStore.getRotoPhysicalRenderSource(test.layer.id, TEST_TRACK_ID, 0)).toEqual(beforeRenderSource);
      expect(hasRotoAlphaCanvasFrame(requirePhysicPaintRotoInlineBytes(test.acceptedDocument.realKeyRecords[0].payload), { width: 1000, height: 650 })).toBe(true);
      expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);
    },
  );

  it('rejects changed operation content and a released token replay without a second publication', async () => {
    const test = await harness('group-paint-ledger-once');
    const accepted = applyPhysicPaintRotoGroupFramePaint(test.request);
    expect(accepted.ok).toBe(true);
    expect(physicPaintStore.releaseRotoPhysicalOperationLease(test.leaseToken)).toBe(true);
    const acceptedDocument = physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID);
    const acceptedVersion = physicPaintVersion.peek();
    const replace = vi.spyOn(physicPaintStore, 'replaceRotoPhysicalDocument');

    expect(applyPhysicPaintRotoGroupFramePaint({
      ...test.request,
      renderedPayload: { ...test.request.renderedPayload, bytes: OPAQUE_ONE_PIXEL_WEBP },
    })).toEqual({ ok: false, reason: 'changed-payload' });
    expect(applyPhysicPaintRotoGroupFramePaint(test.request)).toEqual({
      ok: false,
      reason: 'replayed-token',
    });
    expect(applyPhysicPaintRotoGroupFramePaint({
      ...test.request,
      operationId: 'group-paint-replayed-token',
      expectedRevision: test.proposalResult.proposal.revision,
      expectedProjectEquality: buildPhysicPaintRotoProjectEquality(test.proposalResult.proposal),
    })).toEqual({ ok: false, reason: 'replayed-token' });
    expect(replace).not.toHaveBeenCalled();
    expect(physicPaintStore.getRotoPhysicalDocument(test.layer.id, TEST_TRACK_ID)).toEqual(acceptedDocument);
    expect(physicPaintVersion.peek()).toBe(acceptedVersion);
  });
});

describe('Phase 43.2 UAT-13 cross-window first-paint settlement', async () => {
  const projectContextId = '13131313-1313-4313-8313-131313131313';

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    registerTrackDocument('phys-layer-1');
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
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('preserves the accepted first stroke and publishes the combined raster on the second same-frame paint', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    projectStore.projectContextId.value = projectContextId;
    const emptyRevision = buildPhysicPaintRotoPhysicalRevision(
      [],
      { enabled: false, mode: 'duplicate' },
      [],
      [],
    );
    const emptyDocument = {
      capacity: 30,
      realKeyRecords: [],
      interpolation: { enabled: false, mode: 'duplicate' as const },
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: 0,
      revision: emptyRevision,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    };
    const parentSeed = physicPaintStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, emptyDocument);
    if (!parentSeed.ok) throw new Error(parentSeed.error);
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error(launch.error);

    // A native parent and Physics Paint child own separate module registries.
    // resetModules gives this test a second real physicPaintStore instance
    // without replacing the already imported parent bridge/store above.
    vi.resetModules();
    const { physicPaintStore: childStore } = await import('../stores/physicPaintStore');
    childStore.reset();
    const childSeed = childStore.replaceRotoPhysicalDocument(layer.id, TEST_TRACK_ID, emptyDocument);
    if (!childSeed.ok) throw new Error(childSeed.error);

    const parentLease = physicPaintStore.acquireRotoPhysicalOperationLease(projectContextId, layer.id, TEST_TRACK_ID);
    if (!parentLease) throw new Error('Expected parent physical-operation lease.');
    let childLease = null as ReturnType<typeof childStore.acquireRotoPhysicalOperationLease>;
    for (let generation = 1; generation <= parentLease.generation; generation += 1) {
      const candidateLayerId = generation === parentLease.generation ? layer.id : `generation-sync-${generation}`;
      const candidate = childStore.acquireRotoPhysicalOperationLease(projectContextId, candidateLayerId, TEST_TRACK_ID);
      if (!candidate) throw new Error(`Expected child lease generation ${generation}.`);
      if (candidateLayerId === layer.id) childLease = candidate;
      else if (!childStore.releaseRotoPhysicalOperationLease(candidate)) throw new Error('Could not advance the child lease generation.');
    }
    if (!childLease) throw new Error('Expected child physical-operation lease.');
    expect(childLease).toEqual(parentLease);

    let messageListener: ((event: MessageEvent) => void) | undefined;
    const childWindow = { postMessage: vi.fn() };
    vi.spyOn(window, 'addEventListener').mockImplementation((event, callback) => {
      if (event === 'message') messageListener = callback as (event: MessageEvent) => void;
    });
    let settleResult: ((result: Awaited<ReturnType<typeof applyPhysicPaintPayload>>) => void) | null = null;
    const cleanup = await installPhysicPaintApplyListener((result) => {
      settleResult?.(result);
      settleResult = null;
    });
    const sendFromChild = (
      payload: Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }>,
    ) => new Promise<Awaited<ReturnType<typeof applyPhysicPaintPayload>>>((resolve) => {
      settleResult = resolve;
      messageListener?.({
        origin: 'http://localhost:1420',
        data: { type: PHYSIC_PAINT_APPLY_EVENT, payload },
        source: childWindow as unknown as MessageEventSource,
      } as MessageEvent);
    });

    const buildPastePayload = (
      operationId: string,
      document: NonNullable<ReturnType<typeof physicPaintStore.getRotoPhysicalDocument>>,
      leaseToken: NonNullable<typeof childLease>,
      bytes: Uint8Array,
    ): Extract<PhysicPaintApplyPayload, { kind: 'replace-roto-physical-map' }> => {
      const destination = document.realKeyRecords.find((record) => record.appFrame === 0) ?? null;
      const intent: PhysicPaintRotoPhysicalEditIntent = {
        kind: 'paste-key',
        destinationAppFrame: 0,
        destinationKeyId: destination?.keyId ?? null,
        newKeyId: destination ? null : 'frame-0',
        clipboardPayload: {
          frameIndex: 0,
          appFrame: 0,
          bytes,
          width: 1,
          height: 1,
        },
      };
      const resolution = resolvePhysicPaintRotoPhysicalEdit({
        identities: document.realKeyRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
        records: document.realKeyRecords,
        intent,
        parentEndExclusive: document.capacity,
        capacity: document.capacity,
        interpolationEnabled: document.interpolation.enabled,
        loopClips: document.loopClips,
        incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
      });
      if (!resolution.ok || !resolution.proposal.nextRecords) throw new Error('Expected canonical same-frame paste proposal.');
      return {
        kind: 'replace-roto-physical-map',
        trackId: TEST_TRACK_ID,
        operationId,
        operationKind: 'paste-key',
        intent,
        layerId: layer.id,
        leaseToken,
        startFrame: 0,
        launchOperationId: launch.data.operationId,
        projectContextId,
        expectedRevision: document.revision,
        records: resolution.proposal.nextRecords.map(({ kind: _kind, ...record }) => record),
        interpolationEnabled: document.interpolation.enabled,
        interpolationMode: document.interpolation.mode,
        loopClips: document.loopClips,
        incomingInterpolationBreakKeyIds: resolution.proposal.nextIncomingInterpolationBreakKeyIds
          ?? document.incomingInterpolationBreakKeyIds,
        selectedKeyId: resolution.proposal.selectedKeyId,
        selectedAppFrame: resolution.proposal.selectedAppFrame,
        cursorAppFrame: resolution.proposal.selectedAppFrame ?? document.cursorAppFrame,
        ...(resolution.proposal.semanticDelta ? { semanticDelta: resolution.proposal.semanticDelta } : {}),
      };
    };

    const firstStrokeRaster = TRANSPARENT_ONE_PIXEL_WEBP;
    const combinedTwoStrokeRaster = OPAQUE_ONE_PIXEL_WEBP;
    const preparedCanvas = { width: 1, height: 1 } as HTMLCanvasElement;
    registerRotoAlphaCanvasFrame(firstStrokeRaster, preparedCanvas);
    registerRotoAlphaCanvasFrame(combinedTwoStrokeRaster, preparedCanvas);
    const firstResult = await sendFromChild(buildPastePayload(
      'uat-13-first-paint-materialization',
      parentSeed.document,
      childLease,
      firstStrokeRaster,
    ));
    expect(firstResult.ok).toBe(true);

    // PhysicsPaintStudio acknowledges the accepted settlement in the child
    // registry. The native parent transport must independently complete its
    // canonical publication lease before the next child operation arrives.
    expect(childStore.releaseRotoPhysicalOperationLease(childLease)).toBe(true);
    const secondChildLease = childStore.acquireRotoPhysicalOperationLease(projectContextId, layer.id, TEST_TRACK_ID);
    if (!secondChildLease) throw new Error('Expected the second child physical-operation lease.');
    const acceptedAfterFirst = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    if (!acceptedAfterFirst) throw new Error('Expected the accepted first-stroke document.');

    const secondResult = await sendFromChild(buildPastePayload(
      'uat-13-second-same-frame-paint',
      acceptedAfterFirst,
      secondChildLease,
      combinedTwoStrokeRaster,
    ));
    const acceptedAfterSecond = physicPaintStore.getRotoPhysicalDocument(layer.id, TEST_TRACK_ID);
    const acceptedRenderSource = physicPaintStore.getRotoPhysicalRenderSource(layer.id, TEST_TRACK_ID, 0);

    expect({
      secondPublicationError: secondResult.ok ? null : secondResult.error,
      rejectedPublicationPreservedPriorAcceptedState: secondResult.ok
        || acceptedAfterSecond?.realKeyRecords[0]?.payload.bytes === firstStrokeRaster,
      acceptedRaster: acceptedAfterSecond?.realKeyRecords[0]?.payload.bytes ?? null,
      cachedRaster: acceptedRenderSource?.kind === 'real'
        ? acceptedRenderSource.renderedFrame.bytes
        : null,
      acceptedRealKeyState: acceptedRenderSource?.kind ?? null,
      acceptedSelectedKeyId: acceptedAfterSecond?.selectedKeyId ?? null,
    }).toEqual({
      secondPublicationError: null,
      rejectedPublicationPreservedPriorAcceptedState: true,
      acceptedRaster: combinedTwoStrokeRaster,
      cachedRaster: combinedTwoStrokeRaster,
      acceptedRealKeyState: 'real',
      acceptedSelectedKeyId: 'frame-0',
    });
    cleanup();
  });

  it('accepts a move-key physical edit after a JSON transport round-trip (52.1 D-05)', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const baseline = [makePhysicalRecord('A', 1), makePhysicalRecord('B', 3)];
    seedPhysicalDocument(layer.id, baseline, { enabled: false, mode: 'duplicate' });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 1 });
    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const leaseToken = acquirePhysicalLease(layer.id);
    const intent: PhysicPaintRotoPhysicalEditIntent = {
      kind: 'move-key',
      movedKeyId: 'A',
      target: { kind: 'physical-cell', appFrame: 2 },
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: baseline.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records: baseline,
      intent,
      parentEndExclusive: carriedRotoPhysical(launch.data).capacity,
      capacity: carriedRotoPhysical(launch.data).capacity,
      interpolationEnabled: false,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    const proposal = resolution.proposal;
    const canonicalRecords = (proposal.nextRecords ?? proposal.orderedKeyIds.map((keyId) => {
      const current = baseline.find((record) => record.keyId === keyId);
      const appFrame = proposal.mapping.get(keyId);
      if (!current || appFrame === undefined) throw new Error(`Missing canonical move-key record ${keyId}`);
      return movePhysicalRecord(current, appFrame);
    })).map(({ kind: _kind, ...record }) => record);
    const payload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationId: 'json-round-trip-move-key',
      operationKind: 'move-key' as const,
      intent,
      layerId: layer.id,
      leaseToken,
      startFrame: proposal.selectedAppFrame ?? 0,
      launchOperationId: launch.data.operationId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: canonicalRecords,
      interpolationEnabled: false,
      interpolationMode: 'duplicate' as const,
      loopClips: [],
      incomingInterpolationBreakKeyIds: proposal.nextIncomingInterpolationBreakKeyIds ?? [],
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
      cursorAppFrame: proposal.selectedAppFrame ?? 0,
    };

    // Simulate the Tauri emitTo JSON hop: bytes -> base64 -> JSON -> base64 -> bytes.
    const transported = JSON.parse(JSON.stringify(toTransportPayload(payload)));
    const restored = fromTransportPayload(transported);

    // The restored payload must still satisfy the closed apply-payload validator
    // (the raw JSON round-trip alone turns Uint8Array into index objects).
    expect(isPhysicPaintRotoPhysicalEditApplyPayload(restored)).toBe(true);
    expect((restored as { records: { payload: { bytes: unknown } }[] }).records[0]?.payload.bytes).toEqual(baseline[0].payload.bytes);
  });

  it('round-trips the apply RESULT through the parent->child emitTo hop (52.1 D-05)', async () => {
    const layer = physicLayer();
    mockLayers([layer]);
    const baseline = [makePhysicalRecord('A', 1), makePhysicalRecord('B', 3)];
    seedPhysicalDocument(layer.id, baseline, { enabled: false, mode: 'duplicate' });
    vi.spyOn(window, 'open').mockReturnValue({ focus: vi.fn() } as unknown as Window);
    const launch = await openPhysicPaintCanvas({ layer, frame: 1 });
    expect(launch.ok).toBe(true);
    if (!launch.ok) return;
    const leaseToken = acquirePhysicalLease(layer.id);
    const intent: PhysicPaintRotoPhysicalEditIntent = {
      kind: 'paste-key',
      destinationAppFrame: 2,
      destinationKeyId: null,
      newKeyId: 'pasted-key',
      clipboardPayload: baseline[0].payload,
    };
    const resolution = resolvePhysicPaintRotoPhysicalEdit({
      identities: baseline.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records: baseline,
      intent,
      parentEndExclusive: carriedRotoPhysical(launch.data).capacity,
      capacity: carriedRotoPhysical(launch.data).capacity,
      interpolationEnabled: false,
      loopClips: [],
      incomingInterpolationBreakKeyIds: [],
    });
    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;
    const proposal = resolution.proposal;
    const canonicalRecords = (proposal.nextRecords ?? []).map(({ kind: _kind, ...record }) => record);
    const payload = {
      kind: 'replace-roto-physical-map' as const,
      trackId: TEST_TRACK_ID,
      operationId: 'result-round-trip-paste-key',
      operationKind: 'paste-key' as const,
      intent,
      layerId: layer.id,
      leaseToken,
      startFrame: proposal.selectedAppFrame ?? 0,
      launchOperationId: launch.data.operationId,
      expectedRevision: carriedRotoPhysical(launch.data).revision,
      records: canonicalRecords,
      interpolationEnabled: false,
      interpolationMode: 'duplicate' as const,
      loopClips: [],
      incomingInterpolationBreakKeyIds: proposal.nextIncomingInterpolationBreakKeyIds ?? [],
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
      cursorAppFrame: proposal.selectedAppFrame ?? 0,
      ...(proposal.semanticDelta ? { semanticDelta: proposal.semanticDelta } : {}),
    };

    const result = await applyPhysicPaintPayload(payload);
    expect(result.ok).toBe(true);

    // Simulate the parent's emitTo JSON hop on the RESULT: bytes -> base64 ->
    // JSON -> base64 -> bytes. The child's isPhysicPaintApplyResult must accept
    // the restored result (the raw JSON round-trip alone turns the echoed
    // semanticDelta bytes into index objects and the child silently times out).
    const transported = JSON.parse(JSON.stringify(toTransportPayload(result)));
    const restored = fromTransportPayload(transported);
    expect(isPhysicPaintApplyResult(restored)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Quick 260921-c7x: live settlement-descriptor capture on the REAL stores.
//
// The cluster: a rail physical edit dies with "Ignored mismatched physics paint
// physical edit result." and then "Roto physical edit timed out." — and on a
// SECOND layer key moves are dead entirely. The settlement predicate
// (useRotoPhysicalEditCoordinator.ts:562-590) accepts a descriptor only when
// `detail.stagedRevision === pending.stagedRevision`, so any producer asymmetry
// between the child's staged revision and the parent's echoed revision makes
// EVERY edit on that track mismatch.
//
// This capture drives the real apply door (applyPhysicPaintPayload) against the
// real store with payloads built exactly as the coordinator builds them:
//   child staged revision -> buildPhysicPaintRotoPhysicalRevision(records,
//       interpolation, RAW staged clips, breaks, overrides)   (coordinator :2124)
//   wire clips            -> cloneLoopClips(RAW staged clips) (coordinator :2191)
//       = parsePhysicPaintRotoLoopClips(clips).map(normalizeLoopClipForPayload)
// Every descriptor below is recorded verbatim; the SUMMARY carries the raw run.
// ---------------------------------------------------------------------------
describe('260921-c7x physical-edit settlement descriptors', async () => {
  const SECOND_LAYER_ID = 'phys-layer-2';
  const SECOND_TRACK_ID = 'track-2';
  const CAPACITY = 60;
  const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };

  /** The exact wire transform `cloneLoopClips` applies (coordinator :655). */
  function wireLoopClips(clips: readonly PhysicPaintRotoLoopClip[]): readonly PhysicPaintRotoLoopClip[] {
    return parsePhysicPaintRotoLoopClips(clips).map((clip) => normalizeLoopClipForPayload(clip));
  }

  /**
   * The exact child revision the coordinator stages (its `stagedRevision`), over
   * whatever clip collection is handed in — raw or wire-shaped.
   */
  function childRevision(
    records: Parameters<typeof buildPhysicPaintRotoPhysicalRevision>[0],
    clips: readonly PhysicPaintRotoLoopClip[],
    breaks: readonly string[] = [],
  ): string {
    return buildPhysicPaintRotoPhysicalRevision(
      records,
      INTERPOLATION,
      clips,
      breaks,
      [],
    );
  }

  /**
   * The live shape that carries the asymmetry: an Infinity clip. Parse cannot
   * hydrate it (`buildDefaultPhysicPaintRotoGroupLifecycle` returns null for
   * `repeat: 'infinity'`), so the store keeps it lifecycle-less while the wire
   * transform synthesizes the one-cycle lifecycle the payload validator demands.
   */
  const infinityClip: PhysicPaintRotoLoopClip = {
    loopId: 'loop-infinity',
    placementStart: 0,
    sourceKeyIds: ['A', 'B'],
    repeat: 'infinity',
    mode: 'static',
  };

  /** Resolve an intent the way the coordinator does, against the live store. */
  function resolveAgainstStore(input: {
    readonly layerId: string;
    readonly trackId: string;
    readonly records: ReturnType<typeof makePhysicalRecord>[];
    readonly intent: PhysicPaintRotoPhysicalEditIntent;
    readonly parentEndExclusive: number;
    readonly capacity: number;
  }) {
    return resolvePhysicPaintRotoPhysicalEdit({
      identities: input.records.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
      records: input.records,
      intent: input.intent,
      parentEndExclusive: input.parentEndExclusive,
      capacity: input.capacity,
      interpolationEnabled: false,
      loopClips: storedClips(input.layerId, input.trackId),
      incomingInterpolationBreakKeyIds: [],
    });
  }

  /** The child's wire records: `recordsToApplyPayloadRecords` (drop `kind`). */
  function wireRecords(records: readonly { kind?: string }[]) {
    return records.map(({ kind: _kind, ...record }) => record);
  }

  /** A Phase 52 Reveal rail (kov): born lifecycle-complete, railKind 'reveal'. */
  function revealClip(endExclusive: number): PhysicPaintRotoLoopClip {
    return {
      loopId: 'reveal-rail-1',
      placementStart: 0,
      sourceKeyIds: ['bake-A', 'bake-B'],
      repeat: 1,
      mode: 'static',
      railKind: 'reveal',
      scriptId: 'action-reveal',
      motion: { deformation: 0, position: 0 },
      overrideColor: null,
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: endExclusive,
      visibleRanges: [{ start: 0, endExclusive }],
      frameOverrides: [],
    };
  }

  /**
   * Stage one edit exactly the way the coordinator stages it: resolve against
   * the live store, take the proposal's records, and take the proposal's clips
   * (`proposal.nextLoopClips ?? currentLoopClips`) — the RAW collection, which
   * is what the child hashes while the wire ships `cloneLoopClips` of it.
   */
  function stageFromProposal(input: {
    readonly layerId: string;
    readonly trackId: string;
    readonly records: ReturnType<typeof makePhysicalRecord>[];
    readonly capacity: number;
    readonly parentEndExclusive: number;
    readonly intent: PhysicPaintRotoPhysicalEditIntent;
  }) {
    const resolution = resolveAgainstStore(input);
    if (!resolution.ok) return null;
    const proposal = resolution.proposal;
    const records = proposal.nextRecords
      ?? proposal.orderedKeyIds.map((keyId) => {
        const current = input.records.find((record) => record.keyId === keyId);
        const appFrame = proposal.mapping.get(keyId);
        if (!current || appFrame === undefined) throw new Error(`Missing canonical ${keyId} record`);
        return movePhysicalRecord(current, appFrame);
      });
    const stagedClips = proposal.nextLoopClips ?? storedClips(input.layerId, input.trackId);
    return {
      intent: input.intent,
      records,
      stagedClips,
      childStagedRevision: childRevision(records, stagedClips),
      selectedKeyId: proposal.selectedKeyId,
      selectedAppFrame: proposal.selectedAppFrame,
    };
  }

  /**
   * Which ordinary intents a track carrying a rail will actually accept, and
   * which the resolver refuses outright. A refusal never reaches the settle
   * predicate at all, so the cluster's mismatch needs one of the accepted kinds.
   */
  function probeIntentBattery(input: {
    readonly layerId: string;
    readonly trackId: string;
    readonly records: ReturnType<typeof makePhysicalRecord>[];
    readonly capacity: number;
  }): { readonly accepted: readonly PhysicPaintRotoPhysicalEditIntent[]; readonly record: Record<string, string> } {
    const firstKeyId = input.records[0]?.keyId ?? 'A';
    const secondKeyId = input.records[1]?.keyId ?? firstKeyId;
    const candidates: readonly PhysicPaintRotoPhysicalEditIntent[] = [
      { kind: 'force-spacing', emptyFrames: 1, selectedKeyId: null },
      { kind: 'move-key', movedKeyId: firstKeyId, target: { kind: 'physical-cell', appFrame: 1 } },
      { kind: 'move-key-group', movedKeyIds: [firstKeyId, secondKeyId], grabbedKeyId: firstKeyId, target: { kind: 'physical-cell', appFrame: 1 } },
      { kind: 'duplicate-key', sourceKeyId: firstKeyId, newKeyId: `dup-${firstKeyId}` },
      { kind: 'delete-key', selectedKeyId: firstKeyId },
    ];
    const accepted: PhysicPaintRotoPhysicalEditIntent[] = [];
    const record: Record<string, string> = {};
    for (const intent of candidates) {
      const resolution = resolveAgainstStore({
        layerId: input.layerId,
        trackId: input.trackId,
        records: input.records,
        intent,
        parentEndExclusive: input.capacity,
        capacity: input.capacity,
      });
      record[intent.kind] = resolution.ok ? 'accepted' : resolution.failure.text;
      if (resolution.ok) accepted.push(intent);
    }
    return { accepted, record };
  }

  function seedTrack(
    layerId: string,
    trackId: string,
    records: ReturnType<typeof makePhysicalRecord>[],
    clips: readonly PhysicPaintRotoLoopClip[] = [],
    capacity = CAPACITY,
  ) {
    const result = physicPaintStore.replaceRotoPhysicalDocument(layerId, trackId, {
      capacity,
      realKeyRecords: records,
      interpolation: INTERPOLATION,
      scriptMotion: { deformation: 0, position: 0 },
      background: null,
      selectedKeyId: null,
      cursorAppFrame: records[0]?.appFrame ?? 0,
      revision: childRevision(records, clips),
      loopClips: clips,
      incomingInterpolationBreakKeyIds: [],
    });
    if (!result.ok) throw new Error(result.error);
    return result.document;
  }

  /** The live stored clip collection for a track (what the coordinator stages from). */
  function storedClips(layerId: string, trackId: string): readonly PhysicPaintRotoLoopClip[] {
    return physicPaintStore.getRotoPhysicalLoopClips(layerId, trackId);
  }

  /**
   * The parent's LIVE `currentRevision` gate (:1639) — the value `expectedRevision`
   * must equal. Derived from the STORE's clip collection, i.e. the raw shape.
   */
  function liveRevision(layerId: string, trackId: string): string {
    return physicPaintStore.getRotoPhysicalDocument(layerId, trackId)?.revision ?? '';
  }

  /**
   * Narrow a captured apply result onto the physical-edit fields the settlement
   * predicate keys on. The bridge's public return type is the wide payload
   * union, and its `error` is optional on the generic variant.
   */
  function capturedResult(result: PhysicPaintApplyResult): {
    readonly ok: boolean;
    readonly error: string | null;
    readonly stagedRevision: string;
    readonly acceptedRevision: string | null;
  } {
    const physical = result as {
      readonly ok: boolean;
      readonly error?: string;
      readonly stagedRevision?: string;
      readonly acceptedRevision?: string | null;
    };
    return {
      ok: physical.ok,
      error: physical.ok ? null : physical.error ?? null,
      stagedRevision: physical.stagedRevision ?? 'invalid-physical-revision',
      acceptedRevision: physical.acceptedRevision ?? null,
    };
  }

  /** A settleable force-spacing payload shaped exactly like the coordinator's. */
  function railEditPayload(input: {
    layerId: string;
    trackId: string;
    launchOperationId: string;
    expectedRevision: string;
    records: readonly PhysicPaintRotoRealKeyRecord[];
    wireClips: readonly PhysicPaintRotoLoopClip[];
    operationId: string;
    intent: PhysicPaintRotoPhysicalEditIntent;
    selection?: { readonly selectedKeyId: string | null; readonly selectedAppFrame: number | null };
  }) {
    return {
      kind: 'replace-roto-physical-map' as const,
      operationId: input.operationId,
      operationKind: input.intent.kind,
      intent: input.intent,
      layerId: input.layerId,
      trackId: input.trackId,
      leaseToken: acquirePhysicalLease(input.layerId, projectStore.projectContextId.peek(), input.trackId),
      startFrame: input.selection?.selectedAppFrame ?? 0,
      launchOperationId: input.launchOperationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: input.expectedRevision,
      records: input.records.map(({ kind: _kind, ...record }) => record),
      interpolationEnabled: INTERPOLATION.enabled,
      interpolationMode: INTERPOLATION.mode,
      loopClips: [...input.wireClips],
      incomingInterpolationBreakKeyIds: [],
      selectedKeyId: input.selection?.selectedKeyId ?? null,
      selectedAppFrame: input.selection?.selectedAppFrame ?? null,
      cursorAppFrame: input.selection?.selectedAppFrame ?? 0,
    };
  }

  beforeEach(() => {
    physicPaintStore.reset();
    resetEfxPaintStore();
    resetPhysicPaintDocumentSyncFrameState();
    _setPhysicPaintDocumentSyncFramePorts(null);
    registerDocument(makeTrackDocument('phys-layer-1', TEST_TRACK_ID));
    registerDocument(makeTrackDocument(SECOND_LAYER_ID, SECOND_TRACK_ID));
    mockLayers([
      physicLayer(),
      physicLayer({ id: SECOND_LAYER_ID, name: 'Physic Paint 2', source: { type: 'physic-paint', layerId: SECOND_LAYER_ID } }),
    ]);
    Object.defineProperty(globalThis, 'window', {
      value: {
        open: vi.fn().mockReturnValue({ focus: vi.fn() }),
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
    vi.doUnmock('@tauri-apps/api/core');
    vi.resetModules();
    projectStore.closeProject();
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
  });

  it('H-A: one clip collection, two canonical revisions — the parent echo is not what the child staged', async () => {
    const layer = physicLayer();
    const records = [makePhysicalRecord('A', 0), makePhysicalRecord('B', 2)];
    seedTrack('phys-layer-1', TEST_TRACK_ID, records, [infinityClip]);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error(launch.error);
    const carried = carriedRotoPhysical(launch.data);

    const stored = storedClips('phys-layer-1', TEST_TRACK_ID);
    const wire = wireLoopClips(stored);
    const rawHash = childRevision(records, stored);
    const wireHash = childRevision(records, wire);

    // The child's own proposal + staging path (coordinator :2080-:2130): resolve
    // against the live store, stage the proposal's records, and stage the
    // proposal's clips — `proposal.nextLoopClips ?? currentLoopClips` — which are
    // the STORE's raw clips for an ordinary edit.
    const battery = probeIntentBattery({
      layerId: 'phys-layer-1',
      trackId: TEST_TRACK_ID,
      records,
      capacity: carried.capacity,
    });
    const intent = battery.accepted[0];
    const staged = intent
      ? stageFromProposal({
          layerId: 'phys-layer-1',
          trackId: TEST_TRACK_ID,
          records,
          capacity: carried.capacity,
          parentEndExclusive: carried.capacity,
          intent,
        })
      : null;
    let settled: { readonly ok: boolean; readonly error: string | null; readonly stagedRevision: string; readonly acceptedRevision: string | null } | null = null;
    if (staged) {
      const result = capturedResult(await applyPhysicPaintPayload(railEditPayload({
        layerId: 'phys-layer-1',
        trackId: TEST_TRACK_ID,
        launchOperationId: launch.data.operationId,
        expectedRevision: liveRevision('phys-layer-1', TEST_TRACK_ID),
        records: staged.records,
        // The wire: `cloneLoopClips(stagedLoopClips)` (coordinator :2191).
        wireClips: wireLoopClips(staged.stagedClips),
        operationId: 'c7x-hA-infinity',
        intent: staged.intent,
        selection: { selectedKeyId: staged.selectedKeyId, selectedAppFrame: staged.selectedAppFrame },
      })));
      settled = {
        ok: result.ok,
        error: result.error,
        stagedRevision: result.stagedRevision,
        acceptedRevision: result.acceptedRevision,
      };
    }

    // RAW evidence (the SUMMARY ground truth).
    console.log('[c7x][H-A] captured descriptor', JSON.stringify({
      storedClipHasLifecycle: stored[0]?.syncState !== undefined,
      wireClipHasLifecycle: wire[0]?.syncState !== undefined,
      sameCollectionRawHash: rawHash,
      sameCollectionWireHash: wireHash,
      storeRevision: liveRevision('phys-layer-1', TEST_TRACK_ID),
      carriedRevision: carried.revision,
      resolverBattery: battery.record,
      chosenIntent: intent?.kind ?? null,
      childStagedRevision: staged?.childStagedRevision ?? null,
      settled,
    }));

    expect(stored[0]?.syncState).toBeUndefined();
    expect(wire[0]?.syncState).toBe('synchronized');
    // ONE REVISION AUTHORITY (260921-c7x): the stored raw shape and the wire
    // normalized shape are the same canonical document. Before the fix these
    // split (physical-525-* vs physical-587-*), the parent's canonical gate
    // refused the edit and echoed a revision the child never staged.
    expect(rawHash).toBe(wireHash);
    expect(settled?.ok, settled?.error ?? undefined).toBe(true);
    expect(settled?.stagedRevision).toBe(staged?.childStagedRevision);
    expect(settled?.acceptedRevision).toBe(staged?.childStagedRevision);
  });

  it('H-A: bisects which lifecycle term moves the revision', async () => {
    const records = [makePhysicalRecord('A', 0), makePhysicalRecord('B', 2)];
    const base = {
      loopId: 'loop-bisect',
      placementStart: 0,
      sourceKeyIds: ['A', 'B'],
      repeat: 2 as const,
      mode: 'static' as const,
    };
    const lifecycleComplete: PhysicPaintRotoLoopClip = {
      ...base,
      syncState: 'synchronized',
      provenanceState: 'attached',
      phaseOrigin: 0,
      originalEndExclusive: 4,
      visibleRanges: [{ start: 0, endExclusive: 4 }],
      frameOverrides: [],
    };
    const baselineHash = childRevision(records, [lifecycleComplete]);
    const bisection: Record<string, { readonly hash: string | null; readonly moved: boolean; readonly error?: string }> = {};
    const terms: readonly (readonly [string, Partial<PhysicPaintRotoLoopClip>])[] = [
      ['syncState', { syncState: 'modified' }],
      ['railKind', { railKind: 'reveal' }],
      ['provenanceState', { provenanceState: 'detached' }],
      ['phaseOrigin', { phaseOrigin: 1 }],
      ['originalEndExclusive', { originalEndExclusive: 6 }],
      ['visibleRanges', { visibleRanges: [{ start: 0, endExclusive: 6 }] }],
      ['frameOverrides', { frameOverrides: [{ appFrame: 2, keyId: 'B' }] }],
    ];
    for (const [name, patch] of terms) {
      try {
        const hash = childRevision(records, [{ ...lifecycleComplete, ...patch }]);
        bisection[name] = { hash, moved: hash !== baselineHash };
      } catch (error) {
        // A term the lifecycle guard refuses on its own is still evidence: the
        // term is part of the lifecycle block the lifecycle-less clip lacks.
        bisection[name] = {
          hash: null,
          moved: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }
    // THE BISECTION: a FINITE lifecycle-less clip and its wire shape hash the
    // same, because the canonical encoder re-parses (and so re-hydrates) every
    // finite clip before encoding.
    const finiteLifecycleLessHash = childRevision(records, [base]);
    const finiteLifecycleLessWireHash = childRevision(records, wireLoopClips([base]));
    // An INFINITY clip cannot be hydrated — `buildDefaultPhysicPaintRotoGroupLifecycle`
    // returns null for it — so the stored shape omits the lifecycle block while the
    // wire shape carries the synthesized one, and the two revisions split.
    const infinityLifecycleLessHash = childRevision(records, [infinityClip]);
    const infinityLifecycleLessWireHash = childRevision(records, wireLoopClips([infinityClip]));

    console.log('[c7x][H-A bisect] captured terms', JSON.stringify({
      baselineHash,
      finiteLifecycleLessHash,
      finiteLifecycleLessWireHash,
      finiteDiverges: finiteLifecycleLessHash !== finiteLifecycleLessWireHash,
      infinityLifecycleLessHash,
      infinityLifecycleLessWireHash,
      infinityDiverges: infinityLifecycleLessHash !== infinityLifecycleLessWireHash,
      terms: bisection,
    }));

    // Every lifecycle term is a fingerprint term; flipping any single one moves
    // the hash (terms that the lifecycle guard refuses standalone are recorded
    // with their guard error instead).
    for (const [name, entry] of Object.entries(bisection)) {
      if (entry.error) continue;
      expect(entry.moved, `${name} must be a canonical term`).toBe(true);
    }
    // The wire transform is a hash identity for finite clips...
    expect(finiteLifecycleLessWireHash).toBe(baselineHash);
    expect(finiteLifecycleLessHash).toBe(finiteLifecycleLessWireHash);
    // ...and, after 260921-c7x, for Infinity clips too: the canonical encoder
    // resolves the lifecycle through the single authority
    // (`resolvePhysicPaintRotoLoopClipLifecycle`), so a lifecycle-less clip and
    // its normalized counterpart encode as ONE document.
    expect(infinityLifecycleLessHash).toBe(infinityLifecycleLessWireHash);
  });

  it('H-B: a pre-resolution reject recomputes the revision from the wire payload', async () => {
    const layer = physicLayer();
    const records = [makePhysicalRecord('A', 0), makePhysicalRecord('B', 2)];
    seedTrack('phys-layer-1', TEST_TRACK_ID, records, [infinityClip]);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error(launch.error);
    const stored = storedClips('phys-layer-1', TEST_TRACK_ID);

    const movedRecords = [movePhysicalRecord(records[0], 1), records[1]];
    const intent: PhysicPaintRotoPhysicalEditIntent = {
      kind: 'move-key',
      movedKeyId: 'A',
      target: { kind: 'physical-cell', appFrame: 1 },
    };
    // What the CHILD staged: the moved records over its RAW staged clips.
    const childStagedRevision = childRevision(movedRecords, stored);

    // Deliberately stale: the parent rejects at the revision gate (:1687), long
    // before any proposal parsing.
    const staleResult = capturedResult(await applyPhysicPaintPayload(railEditPayload({
      layerId: 'phys-layer-1',
      trackId: TEST_TRACK_ID,
      launchOperationId: launch.data.operationId,
      expectedRevision: 'stale-revision-never-staged',
      records: movedRecords,
      wireClips: wireLoopClips(stored),
      operationId: 'c7x-hB-stale-revision',
      intent,
      selection: { selectedKeyId: 'A', selectedAppFrame: 1 },
    })));

    console.log('[c7x][H-B] captured descriptor', JSON.stringify({
      childStagedRevision,
      parentEchoStagedRevision: staleResult.stagedRevision,
      echoIsChildStaged: staleResult.stagedRevision === childStagedRevision,
      echoOverWireClips: childRevision(movedRecords, wireLoopClips(stored)),
      ok: staleResult.ok,
      error: staleResult.error,
    }));

    expect(staleResult.ok).toBe(false);
    // The pre-resolution echo is the wire recompute (proved by echoIsChildStaged
    // above). After 260921-c7x that wire recompute IS the child's staged
    // revision, so even this reject path can no longer hand the child a
    // revision it never staged — the settlement predicate sees one identity.
    expect(staleResult.stagedRevision).toBe(childStagedRevision);
  });

  it('H-B: a ref-expansion failure answers with no staged revision at all', async () => {
    const layer = physicLayer();
    const records = [makePhysicalRecord('A', 0), makePhysicalRecord('B', 2)];
    seedTrack('phys-layer-1', TEST_TRACK_ID, records, [infinityClip]);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error(launch.error);
    const leaseToken = acquirePhysicalLease('phys-layer-1');
    const movedRecords = [movePhysicalRecord(records[0], 1), records[1]];
    const intent: PhysicPaintRotoPhysicalEditIntent = {
      kind: 'move-key',
      movedKeyId: 'A',
      target: { kind: 'physical-cell', appFrame: 1 },
    };
    const payload = {
      kind: 'replace-roto-physical-map' as const,
      operationId: 'c7x-hB-ref-expansion-failure',
      operationKind: 'move-key' as const,
      intent,
      layerId: 'phys-layer-1',
      trackId: TEST_TRACK_ID,
      leaseToken,
      startFrame: 1,
      launchOperationId: launch.data.operationId,
      projectContextId: projectStore.projectContextId.peek(),
      expectedRevision: liveRevision('phys-layer-1', TEST_TRACK_ID),
      // 52.1 Part 2: unchanged records ride as content refs; a token mismatch
      // fails the expansion closed before the parent can hash anything real.
      records: [
        { keyId: 'A', appFrame: 1, refToken: 'token-mismatch' },
        wireRecords(movedRecords)[1],
      ],
      interpolationEnabled: false,
      interpolationMode: 'duplicate' as const,
      loopClips: wireLoopClips(storedClips('phys-layer-1', TEST_TRACK_ID)),
      incomingInterpolationBreakKeyIds: [] as string[],
      selectedKeyId: 'A',
      selectedAppFrame: 1,
      cursorAppFrame: 1,
    };

    let captured: Awaited<ReturnType<typeof applyPhysicPaintPayload>> | undefined;
    let listener: ((event: MessageEvent) => void) | undefined;
    const child = { postMessage: vi.fn() };
    vi.spyOn(window, 'addEventListener').mockImplementation((event, cb) => {
      if (event === 'message') listener = cb as (event: MessageEvent) => void;
    });
    vi.spyOn(window, 'dispatchEvent').mockReturnValue(true);
    await installPhysicPaintApplyListener((result) => { captured = result; });
    listener?.({
      origin: 'http://localhost:1420',
      data: { type: PHYSIC_PAINT_APPLY_EVENT, payload },
      source: child as unknown as MessageEventSource,
    } as MessageEvent);
    for (let tick = 0; tick < 3; tick += 1) await new Promise((resolve) => setTimeout(resolve, 0));

    console.log('[c7x][H-B ref] captured descriptor', JSON.stringify({
      ok: captured?.ok,
      error: (captured as { error?: string } | undefined)?.error ?? null,
      stagedRevision: (captured as { stagedRevision?: string } | undefined)?.stagedRevision ?? null,
      hasStagedRevisionField: captured !== undefined && 'stagedRevision' in captured,
    }));

    expect(captured?.ok).toBe(false);
    // The child receives a revision it never staged — the fallback recompute
    // cannot even parse the ref-shaped records it was handed.
    expect((captured as { stagedRevision?: string } | undefined)?.stagedRevision)
      .toBe('invalid-physical-revision');
  });

  it('layer-2 leg: a second layer settles with layer-1 parity', async () => {
    const layerOne = physicLayer();
    const layerTwo = physicLayer({
      id: SECOND_LAYER_ID,
      name: 'Physic Paint 2',
      source: { type: 'physic-paint', layerId: SECOND_LAYER_ID },
    });
    const layerOneRecords = [makePhysicalRecord('A', 0), makePhysicalRecord('B', 2)];
    const layerTwoRecords = [makePhysicalRecord('A', 0), makePhysicalRecord('B', 2)];
    seedTrack('phys-layer-1', TEST_TRACK_ID, layerOneRecords, []);
    seedTrack(SECOND_LAYER_ID, SECOND_TRACK_ID, layerTwoRecords, []);

    const launchOne = await openPhysicPaintCanvas({ layer: layerOne, frame: 0 });
    if (!launchOne.ok) throw new Error(launchOne.error);
    const launchTwo = await openPhysicPaintCanvas({ layer: layerTwo, frame: 0 });
    if (!launchTwo.ok) throw new Error(launchTwo.error);

    const intent: PhysicPaintRotoPhysicalEditIntent = {
      kind: 'move-key',
      movedKeyId: 'A',
      target: { kind: 'physical-cell', appFrame: 1 },
    };
    const runLayer = async (input: {
      readonly layerId: string;
      readonly trackId: string;
      readonly launchOperationId: string;
      readonly expectedRevision: string;
      readonly records: readonly PhysicPaintRotoRealKeyRecord[];
      readonly operationId: string;
    }) => capturedResult(await applyPhysicPaintPayload(railEditPayload({
      ...input,
      wireClips: [],
      intent,
      selection: { selectedKeyId: 'A', selectedAppFrame: 1 },
    })));

    const one = await runLayer({
      layerId: 'phys-layer-1',
      trackId: TEST_TRACK_ID,
      launchOperationId: launchOne.data.operationId,
      expectedRevision: carriedRotoPhysical(launchOne.data).revision,
      records: [movePhysicalRecord(layerOneRecords[0], 1), layerOneRecords[1]],
      operationId: 'c7x-layer-1',
    });
    const two = await runLayer({
      layerId: SECOND_LAYER_ID,
      trackId: SECOND_TRACK_ID,
      launchOperationId: launchTwo.data.operationId,
      expectedRevision: carriedRotoPhysical(launchTwo.data).revision,
      records: [movePhysicalRecord(layerTwoRecords[0], 1), layerTwoRecords[1]],
      operationId: 'c7x-layer-2',
    });

    console.log('[c7x][layer-2] captured descriptors', JSON.stringify({
      layerOne: { ok: one.ok, error: one.error, stagedRevision: one.stagedRevision, acceptedRevision: one.acceptedRevision },
      layerTwo: { ok: two.ok, error: two.error, stagedRevision: two.stagedRevision, acceptedRevision: two.acceptedRevision },
    }));

    // Layer/track identity must never change the settlement outcome.
    expect(one.ok, one.error ?? undefined).toBe(true);
    expect(two.ok, two.error ?? undefined).toBe(true);
    expect(two.stagedRevision).toBe(one.stagedRevision);
    expect(physicPaintStore.getRotoPhysicalDocument(SECOND_LAYER_ID, SECOND_TRACK_ID)?.realKeyRecords
      .find((record) => record.keyId === 'A')?.appFrame).toBe(1);
    // Layer 1 is untouched by layer 2's edit.
    expect(physicPaintStore.getRotoPhysicalDocument('phys-layer-1', TEST_TRACK_ID)?.realKeyRecords
      .find((record) => record.keyId === 'A')?.appFrame).toBe(1);
  });

  it('reveal probe: a reveal rail is lifecycle-complete at birth, so its wire shape is identity', async () => {
    const layer = physicLayer();
    const records = [makePhysicalRecord('bake-A', 0), makePhysicalRecord('bake-B', 2)];
    seedTrack('phys-layer-1', TEST_TRACK_ID, records, [revealClip(4)]);
    const launch = await openPhysicPaintCanvas({ layer, frame: 0 });
    if (!launch.ok) throw new Error(launch.error);
    const carried = carriedRotoPhysical(launch.data);

    const stored = storedClips('phys-layer-1', TEST_TRACK_ID);
    const battery = probeIntentBattery({
      layerId: 'phys-layer-1',
      trackId: TEST_TRACK_ID,
      records,
      capacity: carried.capacity,
    });
    const intent = battery.accepted[0];
    const staged = intent
      ? stageFromProposal({
          layerId: 'phys-layer-1',
          trackId: TEST_TRACK_ID,
          records,
          capacity: carried.capacity,
          parentEndExclusive: carried.capacity,
          intent,
        })
      : null;
    let settled: { readonly ok: boolean; readonly error: string | null; readonly stagedRevision: string } | null = null;
    if (staged) {
      const result = capturedResult(await applyPhysicPaintPayload(railEditPayload({
        layerId: 'phys-layer-1',
        trackId: TEST_TRACK_ID,
        launchOperationId: launch.data.operationId,
        expectedRevision: liveRevision('phys-layer-1', TEST_TRACK_ID),
        records: staged.records,
        wireClips: wireLoopClips(staged.stagedClips),
        operationId: 'c7x-reveal-unchanged',
        intent: staged.intent,
        selection: { selectedKeyId: staged.selectedKeyId, selectedAppFrame: staged.selectedAppFrame },
      })));
      settled = {
        ok: result.ok,
        error: result.error,
        stagedRevision: result.stagedRevision,
      };
    }

    console.log('[c7x][reveal] captured descriptor', JSON.stringify({
      railKind: stored[0]?.railKind,
      hasLifecycleAtBirth: stored[0]?.syncState !== undefined,
      normalizeReturnsSameReference: stored[0] !== undefined
        && normalizeLoopClipForPayload(stored[0]) === stored[0],
      childStagedRevision: childRevision(records, stored),
      wireRevision: childRevision(records, wireLoopClips(stored)),
      resolverBattery: battery.record,
      chosenIntent: intent?.kind ?? null,
      stagedRevisionFromProposal: staged?.childStagedRevision ?? null,
      settled,
    }));

    expect(stored[0]?.railKind).toBe('reveal');
    // Born lifecycle-complete: the wire transform is identity on it, so there is
    // exactly ONE canonical revision. Reveal identity alone is NOT the divergence.
    expect(normalizeLoopClipForPayload(stored[0]!)).toBe(stored[0]);
    expect(childRevision(records, stored)).toBe(childRevision(records, wireLoopClips(stored)));
    // THE CONTRAST with H-A: the SAME intent through the SAME gate SETTLES here,
    // because this clip has one canonical revision instead of two.
    expect(settled?.ok, settled?.error ?? undefined).toBe(true);
    expect(settled?.stagedRevision).toBe(staged?.childStagedRevision);
    // A stretched span, by contrast, is a canonical term — a stretch can never
    // ride through the settle path as an unrecomputed echo.
    expect(childRevision(records, wireLoopClips([revealClip(6)])))
      .not.toBe(childRevision(records, wireLoopClips(stored)));
  });
});
