/**
 * debug studio-reopen-empty-boot (2026-09-21) — the LAUNCH PACK bytes law.
 *
 * THE BUG. After a Studio-origin change (repro: hide/show the photo reference),
 * closing and reopening the Studio boots an EMPTY window (engine not ready,
 * Tracks 0, black canvas) until the whole app restarts. The chain:
 *
 *   1. the child's docSync push is STRUCTURALLY reference-only — bytes are
 *      withheld to the digest-keyed `changedBytes` channel, and for a digest
 *      the receiver is known to hold (`documentSyncSentDigests` marks, seeded
 *      by the apply channel) they are withheld entirely;
 *   2. the parent receive handler MIRRORS the pushed persisted-shape document
 *      into the PARENT RUNTIME (`mirrorRotoPhysicalDocument`), replacing the
 *      byte-carrying runtime records with media-only ones. The guard always
 *      mismatches (runtime revision is byte-terms, the pushed one media-terms),
 *      so the mirror fires on the first accepted push. The 2026-09-22
 *      preservation (LEG 5) stops this REPLACEMENT for every reference whose
 *      digest the runtime bytes verify — the legs below stay the net for a
 *      runtime that genuinely holds no pixels;
 *   3. `createPhysicPaintLaunchContext` builds the launch pack from that runtime
 *      with NO launch-leg materialization — the launch pack is one of the three
 *      declared byte-requiring consumers (`efxPaintMediaMaterialize.ts`), which
 *      only the PROJECT-OPEN leg materializes;
 *   4. the child's launch hydration tolerates the reference-only record (loud
 *      per-key warning) — but the very next line runs `recordsAsRuntimeFrames`
 *      → `requirePhysicPaintRotoInlineBytes` THROWS inside the synchronous
 *      launch-context setter, the launch replacement handoff aborts, and the
 *      Studio shell stays at its pre-launch render forever.
 *
 * WHAT THIS FILE PINS.
 *  - LEG 1 — the launch DOOR: over a runtime that holds no pixels (the open
 *    leg's shape, `referenceOnlyRecord`), `openPhysicPaintCanvas` (the
 *    production entry the properties panel calls) must hand the child a pack
 *    whose active-track record carries inline bytes — resolved through the
 *    digest-verified native read, or straight from the bridged byte map when
 *    the receiver already holds the digest (no IO). RED at base: the door
 *    ships reference-only.
 *  - LEG 2 — the seed TOLERANCE: `recordsAsRuntimeFrames` keeps its strict
 *    publishing contract (a reference-only record on the publish path still
 *    throws), and the tolerant launch-seed helper the Studio boots through
 *    SKIPS a reference-only record (missing content, like the hydration's
 *    skipped alpha canvas) instead of bricking the Studio. RED at base: the
 *    tolerant helper does not exist.
 *  - LEG 3 — the honest failures: with no package root AND no bridged bytes,
 *    the launch door still opens (never blocks a launch) and the failure is
 *    reported per key — the record stays reference-only, the tolerant seed
 *    carries the boot.
 *  - LEG 4 — the display-persistence fix (A) at the integration level: the
 *    display-only push (the same runtime document, reference toggled) REGISTERS
 *    parent-side. Both pushes project the same collections, so the pushed
 *    document is revision-identical to the parent's current one — a register
 *    guard comparing the bare canonical revision dedupes the display change
 *    (its root cause), while the sync fingerprint registers it.
 *  - LEG 5 — the receiver's runtime SHAPE (debug layer-2-ref-mismatch,
 *    2026-09-22): a reference-shaped push preserves the runtime's inline bytes
 *    when the pushed digest verifies them, so the physical-edit ref expansion
 *    (and the apply's revision gate) keep a byte-shaped authority — and the
 *    launch door needs no IO at all. RED at base: the push leaves the runtime
 *    reference-shaped and every first physical edit on the layer is refused.
 *
 * FIDELITY NOTES, stated. The Studio component cannot be mounted in vitest
 * (Tauri window + engine deps): the component's launch seed is driven through
 * the exact exported helper its updater calls. The child's push uses the child
 * realm's REAL transport, and the parent applies through the REAL installed
 * listener fed the real emitted wire payload — no hand-built intermediate.
 * The delivered-digest mark reproduces the production case that started this:
 * the key was painted in-session (bytes delivered by the apply channel), so
 * the later display push ships its reference with NO byte channel at all.
 * The chain drives TWO pushes (reference visible → hidden) so the display
 * toggle is the only difference between the parent's registered document and
 * the incoming one — the live precondition of the display-persistence defect.
 */

import { createHash } from 'node:crypto';
import { testWebpBytes } from '../testUtils/testWebpBytes';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitTo = vi.hoisted(() => vi.fn(async (_target: string, _event: string, _payload: unknown): Promise<void> => undefined));
const invoke = vi.hoisted(() => vi.fn(async () => undefined));
const performanceRecord = vi.hoisted(() => vi.fn());
const { readFrameMediaMock } = vi.hoisted(() => ({ readFrameMediaMock: vi.fn() }));

vi.mock('@tauri-apps/api/event', () => ({ emitTo }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('../components/physic-paint/performance/physicsPaintPerformanceTrace', () => ({
  recordPhysicsPaintPerformance: performanceRecord,
}));
vi.mock('./ipc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./ipc')>()),
  ipcEfxPaintReadFrameMedia: readFrameMediaMock,
}));

import {
  recordsAsRuntimeFrames,
  recordsAsRuntimeFramesToleratingReferences,
} from '../components/physic-paint/hooks/useRotoFramePersistenceCoordinator';
import type {
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoRealKeyRecord,
} from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';
import { buildPhysicPaintRotoPhysicalRevision } from '../components/physic-paint/roto/physicsPaintRotoPhysicalModel';

const LAYER = 'launchpack-layer';
const TRACK = 'launchpack-track';
const KEY = 'launchpack-key-1';
const KEY_2 = 'launchpack-key-2';
const REF = 'launchpack-ref-photo-1';
const PACKAGE_DIR = '/tmp/launchpack-package';
const BYTES = testWebpBytes('launchpack-key-1');
const DIGEST = createHash('sha256').update(BYTES).digest('hex');
const MEDIA = {
  relativePath: `frames/${LAYER}/${KEY}.webp`,
  digest: DIGEST,
  width: 4,
  height: 4,
} as const;
const INTERPOLATION = { enabled: false, mode: 'duplicate' as const };
const FRAME = 1;

type DocumentsModule = typeof import('../efx-paint/document/efxPaintDocument');
type PhysicPaintModule = typeof import('../stores/physicPaintStore');
type EfxPaintModule = typeof import('../stores/efxPaintStore');
type TransportModule = typeof import('../components/physic-paint/bridge/physicsPaintBridgeTransport');
type SequenceModule = typeof import('../stores/sequenceStore');

interface Realm {
  readonly documents: DocumentsModule;
  readonly physic: PhysicPaintModule;
  readonly efx: EfxPaintModule;
  readonly transport: TransportModule;
}

type SyncHandler = (event: { detail?: unknown }) => void;

function stubWindow(): Map<string, SyncHandler> {
  const installed = new Map<string, SyncHandler>();
  Object.defineProperty(globalThis, 'window', {
    value: {
      addEventListener: (name: string, fn: unknown) => { installed.set(name, fn as SyncHandler); },
      removeEventListener: (name: string) => { installed.delete(name); },
      location: { origin: 'http://localhost' },
      open: () => ({ focus: () => undefined }),
    },
    writable: true,
    configurable: true,
  });
  return installed;
}

const byteRecord = (): PhysicPaintRotoRealKeyRecord => ({
  kind: 'real-key',
  keyId: KEY,
  appFrame: FRAME,
  payload: { frameIndex: 0, appFrame: FRAME, bytes: BYTES, width: 4, height: 4 },
});

/**
 * The runtime shape the open leg can leave (52.2-13 doctrine): the reference
 * with no pixels. The launch pack is a declared byte-requiring consumer, so
 * the door must re-materialize it — the legs below pin exactly that.
 */
const referenceOnlyRecord = (): PhysicPaintRotoRealKeyRecord => ({
  kind: 'real-key',
  keyId: KEY,
  appFrame: FRAME,
  payload: { frameIndex: 0, appFrame: FRAME, media: MEDIA },
});

function physical(
  realKeyRecords: readonly PhysicPaintRotoRealKeyRecord[],
): PhysicPaintRotoPhysicalDocument {
  return {
    capacity: 24,
    realKeyRecords,
    interpolation: INTERPOLATION,
    scriptMotion: { deformation: 0, position: 0 },
    background: null,
    selectedKeyId: null,
    cursorAppFrame: 0,
    revision: buildPhysicPaintRotoPhysicalRevision(realKeyRecords, INTERPOLATION, [], []),
    loopClips: [],
    incomingInterpolationBreakKeyIds: [],
  } as PhysicPaintRotoPhysicalDocument;
}

/**
 * One layer document over ONE track carrying the given physical. `base` lets
 * the parent's registered document share the child base's background identity —
 * so the sync guard sees exactly the display-preference difference the user's
 * repro produced, not an accidental identity change.
 */
function layerDocument(
  documents: DocumentsModule,
  physicalValue: PhysicPaintRotoPhysicalDocument,
  photoReference: ReturnType<DocumentsModule['createEfxPaintDocument']>['photoReference'],
  base?: ReturnType<DocumentsModule['createEfxPaintDocument']>,
) {
  const baseDocument = base ?? documents.createEfxPaintDocument(LAYER);
  return {
    ...baseDocument,
    activeTrackId: TRACK,
    photoReference,
    tracks: [{ ...baseDocument.tracks[0], id: TRACK, rotoPhysical: physicalValue }],
  };
}

const photoReferenceWith = (visibleInStudio: boolean) => ({
  id: 'launchpack-photo-ref',
  sourceFrameRefs: [REF],
  revision: 0,
  visibleInStudio,
  opacity: 1,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  transformLocked: false,
});

const physicLayer = () => ({
  id: LAYER,
  name: 'Physic Paint',
  type: 'physic-paint',
  visible: true,
  opacity: 1,
  blendMode: 'normal',
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
  source: { type: 'physic-paint', layerId: LAYER },
});

function seedParentSequence(sequence: SequenceModule): void {
  sequence.sequenceStore.sequences.value = [{
    id: 'launchpack-parent-sequence',
    kind: 'fx',
    name: 'launchpack parent authority',
    fps: 24,
    width: 1920,
    height: 1080,
    keyPhotos: [],
    layers: [physicLayer()],
    inFrame: 0,
    outFrame: 60,
  }] as never;
}

const originalWindow = globalThis.window;

describe('launch pack bytes after a Studio-origin push (debug studio-reopen-empty-boot)', () => {
  let child: Realm;
  let parent: Realm;
  let parentBridge: typeof import('./physicPaintBridge');
  let parentSequence: SequenceModule;
  let installed: Map<string, SyncHandler>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    emitTo.mockClear();
    performanceRecord.mockClear();
    readFrameMediaMock.mockReset();

    // The CHILD realm (Studio webview) — its own transport module instance
    // owns the delivered-digest marks the real child accumulated.
    child = {
      documents: await import('../efx-paint/document/efxPaintDocument'),
      physic: await import('../stores/physicPaintStore'),
      efx: await import('../stores/efxPaintStore'),
      transport: await import('../components/physic-paint/bridge/physicsPaintBridgeTransport'),
    };

    // The PARENT realm (main webview) — a second, independent instance set.
    vi.resetModules();
    parent = {
      documents: await import('../efx-paint/document/efxPaintDocument'),
      physic: await import('../stores/physicPaintStore'),
      efx: await import('../stores/efxPaintStore'),
      transport: await import('../components/physic-paint/bridge/physicsPaintBridgeTransport'),
    };
    parentBridge = await import('./physicPaintBridge');
    parentSequence = await import('../stores/sequenceStore');

    installed = stubWindow();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
    parent.physic._setPhysicPaintPackageDirProvider(null);
    delete (globalThis as { window?: unknown }).window;
    Object.defineProperty(globalThis, 'window', { value: originalWindow, writable: true, configurable: true });
    vi.resetModules();
  });

  /**
   * The receive half of the chain, exactly as the product runs it: the child's
   * real sender emits (mocked wire), the parent's real installed listener
   * receives the emitted payload — TWICE.
   *
   * Push 1 ships the document as the previous session left it (reference
   * VISIBLE); push 2 is the user's display toggle (HIDDEN) over the SAME
   * runtime document, so the two shipped projections differ ONLY in
   * `photoReference.visibleInStudio`. That is the live precondition of the
   * display-persistence fix: the pushed document is revision-identical to the
   * parent's current one, so a register guard comparing the bare canonical
   * revision dedupes it, while one comparing the sync fingerprint registers it.
   *
   * Returns the poison state of the parent runtime — the precondition every
   * launch assertion below depends on — plus the display preference the
   * parent's live document holds after both pushes.
   */
  const driveDisplayChangePush = async (seed: 'bytes' | 'reference-only' = 'bytes'): Promise<{
    wireCarriedByteChannel: boolean;
    runtimeRecordAfterPush: PhysicPaintRotoRealKeyRecord | null;
    parentRegisteredDisplayPreference: boolean | null;
  }> => {
    const base = child.documents.createEfxPaintDocument(LAYER);
    // ONE runtime document for both pushes: the display toggle is the ONLY
    // difference between the two shipped documents.
    const physicalValue = physical([byteRecord()]);
    // In-session reality: this key's bytes were delivered to the parent by the
    // apply channel earlier, so both syncs withhold them from the byte channel.
    await child.transport.markEfxPaintDocumentSyncFrameDelivered(LAYER, TRACK, KEY, BYTES);

    // The parent: its runtime holds the bytes the apply channel delivered, and
    // its registered document is whatever the last push installed. The
    // `reference-only` seed is the open leg's shape — a record whose file could
    // not be materialized — which the door must still heal.
    parent.efx.reset();
    parent.physic.physicPaintStore.reset();
    const runtimeSeed = parent.physic.physicPaintStore.replaceRotoPhysicalDocument(
      LAYER,
      TRACK,
      physical(seed === 'bytes' ? [byteRecord()] : [referenceOnlyRecord()]),
    );
    if (!runtimeSeed.ok) throw new Error(`runtime seed failed: ${runtimeSeed.error}`);

    const unlisten = await parentBridge.installPhysicPaintEfxPaintDocumentListener();
    const handler = installed.get(parentBridge.PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT);
    const lastEmittedPayload = (): { changedBytes?: unknown } | null => {
      const wireCall = emitTo.mock.calls[emitTo.mock.calls.length - 1];
      return (wireCall ? wireCall[2] : null) as { changedBytes?: unknown } | null;
    };

    // Push 1 — the previous session's state: the reference is VISIBLE.
    await child.transport.sendEfxPaintDocumentSync(
      layerDocument(child.documents, physicalValue, photoReferenceWith(true), base) as never,
      'Tauri',
    );
    handler?.({ detail: lastEmittedPayload() });

    // Push 2 — the user's display change: the reference is HIDDEN.
    emitTo.mockClear();
    await child.transport.sendEfxPaintDocumentSync(
      layerDocument(child.documents, physicalValue, photoReferenceWith(false), base) as never,
      'Tauri',
    );
    const wirePayload = lastEmittedPayload();
    handler?.({ detail: wirePayload });
    unlisten();
    // The runtime mirror is async (the inline-byte preservation verifies
    // digests), so the runtime state below is read only after it settles.
    await parentBridge.awaitPendingPhysicPaintRuntimeMirror();

    const runtimeRecord = parent.physic.physicPaintStore.getRotoRealKeyRecords(LAYER, TRACK)[0] ?? null;
    return {
      wireCarriedByteChannel: wirePayload !== null && wirePayload.changedBytes !== undefined,
      runtimeRecordAfterPush: runtimeRecord,
      parentRegisteredDisplayPreference: parent.efx.getDocument(LAYER)?.photoReference?.visibleInStudio ?? null,
    };
  };

  const carrierPhysical = (document: unknown): PhysicPaintRotoPhysicalDocument | null => {
    const tracks = (document as { tracks?: readonly { id: string; rotoPhysical: PhysicPaintRotoPhysicalDocument | null }[] } | null)?.tracks ?? [];
    const active = tracks.find((track) => track.id === TRACK) ?? null;
    return active?.rotoPhysical ?? null;
  };

  const carrierRecord = (document: unknown): PhysicPaintRotoRealKeyRecord | null =>
    carrierPhysical(document)?.realKeyRecords[0] ?? null;

  it('LEG 1: the launch door hands the child a pack whose record carries inline bytes when the runtime is reference-only', async () => {
    readFrameMediaMock.mockResolvedValue({ ok: true, data: { bytes: BYTES, digest: DIGEST } });
    parent.physic._setPhysicPaintPackageDirProvider(() => PACKAGE_DIR);
    seedParentSequence(parentSequence);

    const push = await driveDisplayChangePush('reference-only');
    // The precondition, asserted so harness drift fails loudly instead of
    // silently disarming the pin: the push withheld the byte channel AND the
    // runtime holds the reference only — the byte-requiring pack must be
    // healed by the door.
    expect({
      wireCarriedByteChannel: push.wireCarriedByteChannel,
      runtimeRecordIsReferenceOnly:
        push.runtimeRecordAfterPush !== null
        && push.runtimeRecordAfterPush.payload.bytes === undefined
        && push.runtimeRecordAfterPush.payload.media !== undefined,
    }, 'scenario precondition: the display-change push is reference-only and the runtime holds no pixels for the key').toEqual({
      wireCarriedByteChannel: false,
      runtimeRecordIsReferenceOnly: true,
    });

    const opened = await parentBridge.openPhysicPaintCanvas({ layer: physicLayer() as never, frame: FRAME });
    if (!opened.ok) throw new Error(`launch door refused: ${opened.error}`);
    const carried = carrierRecord(opened.data.document);
    const carriedDoc = carrierPhysical(opened.data.document);

    let seedError: string | null = null;
    let seededFrames: unknown[] = [];
    try {
      seededFrames = carriedDoc === null ? [] : recordsAsRuntimeFrames(carriedDoc);
    } catch (error) {
      seedError = error instanceof Error ? error.message : String(error);
    }

    expect({
      doorOpened: opened.ok,
      carriedRecordPresent: carried !== null,
      carriedRecordCarriesBytes: carried !== null && carried.payload.bytes instanceof Uint8Array,
      carriedBytesAreTheKeyBytes: carried !== null && carried.payload.bytes === BYTES,
      childLaunchSeedThrew: seedError,
      childLaunchSeedFrameCount: seededFrames.length,
      digestVerifiedRead: readFrameMediaMock.mock.calls.map((call) => call as unknown[]),
    }, 'the launch pack is a declared byte-requiring consumer: with a reference-only runtime, the door must re-materialize the bytes (digest-verified) before the child seeds its launch.').toEqual({
      doorOpened: true,
      carriedRecordPresent: true,
      carriedRecordCarriesBytes: true,
      carriedBytesAreTheKeyBytes: true,
      childLaunchSeedThrew: null,
      childLaunchSeedFrameCount: 1,
      digestVerifiedRead: [[PACKAGE_DIR, `frames/${LAYER}/${KEY}.webp`]],
    });
  });

  it('LEG 1b: bridged bytes already held resolve WITHOUT a file read, and the unresolved record never blocks the launch', async () => {
    seedParentSequence(parentSequence);

    // The receiver was asked for the digest and the Studio re-shipped the
    // bytes: they sit in the bridged byte map, undecoded, with NO package root
    // in this window either — the door must resolve them without any IO.
    await driveDisplayChangePush('reference-only');
    const installedBytes = await parent.physic.installFrameMediaBytes(BYTES, DIGEST);
    expect(installedBytes.ok).toBe(true);

    const opened = await parentBridge.openPhysicPaintCanvas({ layer: physicLayer() as never, frame: FRAME });
    if (!opened.ok) throw new Error(`launch door refused: ${opened.error}`);
    const carried = carrierRecord(opened.data.document);
    const carriedDoc = carrierPhysical(opened.data.document);

    let tolerantSeedError: string | null = null;
    let tolerantFrames: unknown[] = [];
    try {
      tolerantFrames = carriedDoc === null ? [] : recordsAsRuntimeFramesToleratingReferences(carriedDoc);
    } catch (error) {
      tolerantSeedError = error instanceof Error ? error.message : String(error);
    }

    expect({
      doorOpened: opened.ok,
      bridgedBytesResolvedTheCarrier: carried !== null && carried.payload.bytes === BYTES,
      noFileReadWasIssued: readFrameMediaMock.mock.calls.length,
      tolerantSeedThrew: tolerantSeedError,
      tolerantSeedFrameCount: tolerantFrames.length,
    }, 'a held digest resolves in memory (no IO); leg 3 (no package root, no bridged bytes) is covered below.').toEqual({
      doorOpened: true,
      bridgedBytesResolvedTheCarrier: true,
      noFileReadWasIssued: 0,
      tolerantSeedThrew: null,
      tolerantSeedFrameCount: 1,
    });
  });

  it('LEG 3: no package root and no bridged bytes — the door still opens, the failure is named per key, and the tolerant seed carries the boot', async () => {
    seedParentSequence(parentSequence);
    await driveDisplayChangePush('reference-only');

    const opened = await parentBridge.openPhysicPaintCanvas({ layer: physicLayer() as never, frame: FRAME });
    if (!opened.ok) throw new Error(`launch door refused: ${opened.error}`);
    const carried = carrierRecord(opened.data.document);
    const carriedDoc = carrierPhysical(opened.data.document);

    let tolerantSeedError: string | null = null;
    let tolerantFrames: unknown[] = [];
    try {
      tolerantFrames = carriedDoc === null ? [] : recordsAsRuntimeFramesToleratingReferences(carriedDoc);
    } catch (error) {
      tolerantSeedError = error instanceof Error ? error.message : String(error);
    }

    expect({
      doorOpened: opened.ok,
      carrierStaysReferenceOnly: carried !== null && carried.payload.bytes === undefined && carried.payload.media !== undefined,
      tolerantSeedThrew: tolerantSeedError,
      tolerantSeedFrameCount: tolerantFrames.length,
      loudWarnMentionedTheKey: warn.mock.calls.some((call) => call.join(' ').includes(`frames/${LAYER}/${KEY}.webp`)),
    }, 'an unresolvable frame is loud, per key, and never blocks the launch — the frame renders as missing content (the open-leg doctrine, quick-260913-52r G).').toEqual({
      doorOpened: true,
      carrierStaysReferenceOnly: true,
      tolerantSeedThrew: null,
      tolerantSeedFrameCount: 0,
      loudWarnMentionedTheKey: true,
    });
  });

  it('LEG 2: the publishing seed stays strict while the tolerant launch seed skips a reference-only record', async () => {
    const referenceOnlySibling: PhysicPaintRotoRealKeyRecord = {
      kind: 'real-key',
      keyId: KEY_2,
      appFrame: FRAME + 1,
      payload: {
        frameIndex: 0,
        appFrame: FRAME + 1,
        media: { ...MEDIA, relativePath: `frames/${LAYER}/${KEY_2}.webp` },
      },
    };
    const document = physical([byteRecord(), referenceOnlySibling]);

    let strictError: string | null = null;
    try {
      recordsAsRuntimeFrames(document);
    } catch (error) {
      strictError = error instanceof Error ? error.message : String(error);
    }
    const tolerantFrames = recordsAsRuntimeFramesToleratingReferences(document);

    expect({
      strictSeedThrew: strictError,
      tolerantSeedFrameCount: tolerantFrames.length,
      tolerantSeedKeptTheByteRecord: tolerantFrames.length === 2
        ? null
        : (tolerantFrames[0] as { bytes?: unknown } | undefined)?.bytes === BYTES,
    }, 'the publish path keeps its contract (a reference-only record there is still a violation); the boot seed must not brick on one.').toEqual({
      strictSeedThrew: 'Roto physical real-key payload carries no inline raster bytes (reference-only record on a runtime path).',
      tolerantSeedFrameCount: 1,
      tolerantSeedKeptTheByteRecord: true,
    });
  });

  it('LEG 4 (display-persistence): the display-only push registers parent-side', async () => {
    // The chain's two pushes differ ONLY in photoReference.visibleInStudio, so
    // the bare canonical revision of the pushed document EQUALS the parent's
    // current one (the revision excludes the display fields by design) — the
    // parent register guard must compare the sync fingerprint, not the
    // revision, or the display choice is silently dropped from the parent's
    // live document (the display-persistence defect).
    const push = await driveDisplayChangePush();

    expect({
      parentRegisteredDisplayPreference: push.parentRegisteredDisplayPreference,
    }, 'the parent register guard must accept a display-only change: the pushed document carries the preference the parent does not yet hold.').toEqual({
      parentRegisteredDisplayPreference: false,
    });
  });

  /**
   * debug layer-2-ref-mismatch (2026-09-22): the mirror must RECONSTRUCT the
   * runtime shape, not adopt the wire projection. The child compacts every
   * unchanged record of its next physical edit to a byte-token ref, and only a
   * byte-shaped parent can expand it — against a reference-shaped runtime every
   * first edit after a Studio launch on a layer was refused ("no longer matches
   * the parent document content"). Preserving the bytes also means the launch
   * door needs no IO at all.
   */
  it('LEG 5 (no poison): a reference-shaped push keeps the runtime inline bytes whose digest it verifies', async () => {
    seedParentSequence(parentSequence);

    const push = await driveDisplayChangePush();

    expect({
      wireCarriedByteChannel: push.wireCarriedByteChannel,
      runtimeRecordCarriesBytes: push.runtimeRecordAfterPush?.payload.bytes === BYTES,
    }, 'the mirror preserves inline bytes the pushed digest verifies — a byte-shaped runtime is what the physical-edit ref expansion and the apply revision gate read.').toEqual({
      wireCarriedByteChannel: false,
      runtimeRecordCarriesBytes: true,
    });

    const opened = await parentBridge.openPhysicPaintCanvas({ layer: physicLayer() as never, frame: FRAME });
    if (!opened.ok) throw new Error(`launch door refused: ${opened.error}`);
    const carried = carrierRecord(opened.data.document);

    expect({
      carriedBytesAreTheKeyBytes: carried !== null && carried.payload.bytes === BYTES,
      frameMediaReads: readFrameMediaMock.mock.calls.length,
    }, 'the preserved bytes survive into the launch pack with no package root and no file read.').toEqual({
      carriedBytesAreTheKeyBytes: true,
      frameMediaReads: 0,
    });
  });
});
