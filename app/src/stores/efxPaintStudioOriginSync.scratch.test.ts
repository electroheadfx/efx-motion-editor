/**
 * quick-260921-ffh — the TWO-REALM chain harness for the three Studio-origin
 * document surfaces (reference selection, background-image keyframes, (+)
 * tracks).
 *
 * WHY THIS FILE EXISTS. quick-260921-e21 diagnosed the loss as the child PUSH
 * WIRING, shipped a fix, and was falsified by native UAT on 2026-09-21: the
 * three surfaces are STILL lost on a plain Studio close while paint strokes
 * persist. e21's probes were GREEN at base for exactly the reason its theory
 * could not be falsified: they drove the store APIs and then each downstream
 * link IN ISOLATION, so they never entered the composition the real app
 * performs. This harness closes the four fidelity gaps the plan names:
 *
 *   FG-1 — the push guard is IN the loop: every push-shaped probe routes its
 *          document through `createDocumentSyncPushGuard().evaluate(...)`,
 *          exactly as `pushLiveProjection` does. Never a document handed
 *          straight to the transport.
 *   FG-2 — every push-shaped probe obtains its document from
 *          `serializeRuntimeIntoDocument(layerId)`, never a hand-built one,
 *          and diffs the document ACROSS that call.
 *   FG-3 — TWO real module instances (child = Studio webview, parent = main
 *          webview) obtained with `vi.resetModules()` + dynamic import. No
 *          module-level state can leak between them; the realm control is
 *          asserted, not assumed.
 *   FG-4 — the teardown sequence's decisions (close gate, clear placement,
 *          guard outcome) are driven with the real inputs for the state each
 *          surface leaves behind.
 *
 * WHAT THIS FILE CANNOT DO, AND SAYS SO. The Studio component cannot be
 * mounted in vitest (Tauri window + engine deps), so the three surfaces are
 * driven as the REAL UI HANDLERS drive them — their call sequences read off
 * `PhysicsPaintStudio.tsx` and reproduced on the child realm's store — not by
 * clicking a rendered control. And no unit leg can prove a real cross-webview
 * `emitTo` delivery or a real `onCloseRequested`; that boundary is the native
 * UAT rows, owned by the user.
 */

import { signal } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const emitTo = vi.hoisted(() => vi.fn(async (_target: string, _event: string, _payload: unknown): Promise<void> => undefined));
const invoke = vi.hoisted(() => vi.fn(async () => undefined));
const performanceRecord = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/event', () => ({ emitTo }));
vi.mock('@tauri-apps/api/core', () => ({ invoke }));
vi.mock('../components/physic-paint/performance/physicsPaintPerformanceTrace', () => ({
  recordPhysicsPaintPerformance: performanceRecord,
}));

type EfxPaintModule = typeof import('./efxPaintStore');
type PhysicPaintModule = typeof import('./physicPaintStore');
type DocumentsModule = typeof import('../efx-paint/document/efxPaintDocument');
type RevisionModule = typeof import('../efx-paint/document/efxPaintDocumentRevision');
type TransportModule = typeof import('../components/physic-paint/bridge/physicsPaintBridgeTransport');
type GuardModule = typeof import('../components/physic-paint/bridge/documentSyncPushGuard');

/** One webview realm: its OWN module instances, never shared with the other. */
interface Realm {
  readonly documents: DocumentsModule;
  readonly revision: RevisionModule;
  readonly efx: EfxPaintModule;
  readonly physic: PhysicPaintModule;
  readonly transport: TransportModule;
  readonly guard: GuardModule;
}

const LAYER = 'layer-ffh';
const TRACK1 = 'ffh-track-1';
const REF_REFS = ['ffh-ref-photo-1'];
const BG_REFS = ['ffh-bg-ref-1'];
const BG_START_FRAME = 4;

interface SurfaceCarrier {
  photoReference?: { sourceFrameRefs: readonly string[] } | null;
  background: { clips: readonly { startFrame: number; sourceFrameRefs: readonly string[] }[] };
  tracks: readonly { id: string; frames: Record<number, unknown> }[];
}

/** Mirror of `physicsPaintBridgeTransport.test.ts#baseDocument`, in-realm. */
function buildBaseDocument(documents: DocumentsModule, layerId: string, trackId: string) {
  const base = documents.createEfxPaintDocument(layerId);
  return { ...base, activeTrackId: trackId, tracks: [{ ...base.tracks[0], id: trackId }] };
}

type SyncHandler = (event: { detail?: unknown }) => void;

function stubWindow(): Map<string, SyncHandler> {
  const installed = new Map<string, SyncHandler>();
  Object.defineProperty(globalThis, 'window', {
    value: {
      addEventListener: (name: string, fn: unknown) => { installed.set(name, fn as SyncHandler); },
      removeEventListener: (name: string) => { installed.delete(name); },
      location: { origin: 'http://localhost' },
    },
    writable: true,
    configurable: true,
  });
  return installed;
}

const probes: Record<string, unknown> = {};
const remember = (key: string, value: unknown): void => {
  probes[key] = value;
  console.log(`[ffh][${key}] ${JSON.stringify(value)}`);
};

describe('Studio-origin document surfaces through the real child→parent chain (quick-260921-ffh)', () => {
  let child: Realm;
  let parent: Realm;
  let parentBridge: typeof import('../lib/physicPaintBridge');
  let parentSequenceStore: typeof import('./sequenceStore');
  let installed: Map<string, SyncHandler>;

  beforeEach(async () => {
    emitTo.mockClear();
    performanceRecord.mockClear();
    for (const key of Object.keys(probes)) delete probes[key];

    // FG-3: the CHILD realm (Studio webview).
    child = {
      documents: await import('../efx-paint/document/efxPaintDocument'),
      revision: await import('../efx-paint/document/efxPaintDocumentRevision'),
      efx: await import('./efxPaintStore'),
      physic: await import('./physicPaintStore'),
      transport: await import('../components/physic-paint/bridge/physicsPaintBridgeTransport'),
      guard: await import('../components/physic-paint/bridge/documentSyncPushGuard'),
    };

    // FG-3: the PARENT realm (main webview) — a SECOND, independent set of
    // module instances. e21 faked this with a mid-test reset; that shape is
    // exactly what lets module-level state leak past a probe.
    vi.resetModules();
    parent = {
      documents: await import('../efx-paint/document/efxPaintDocument'),
      revision: await import('../efx-paint/document/efxPaintDocumentRevision'),
      efx: await import('./efxPaintStore'),
      physic: await import('./physicPaintStore'),
      transport: await import('../components/physic-paint/bridge/physicsPaintBridgeTransport'),
      guard: await import('../components/physic-paint/bridge/documentSyncPushGuard'),
    };
    parentBridge = await import('../lib/physicPaintBridge');
    parentSequenceStore = await import('./sequenceStore');

    installed = stubWindow();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
    vi.resetModules();
  });

  it('diagnoses each surface through the composition the product runs, and records the raw probe output', async () => {
    // ----- STEP 0 — the realm control (FG-3) ------------------------------
    child.efx.reset();
    parent.efx.reset();
    child.efx.registerDocument(buildBaseDocument(child.documents, LAYER, TRACK1));
    const realmIsolation = {
      separateInstances: child.efx.getDocument(LAYER) !== parent.efx.getDocument(LAYER),
      separateEfxVersionSignals: child.efx.efxPaintVersion !== parent.efx.efxPaintVersion,
      separatePhysicStores: child.physic.physicPaintStore !== parent.physic.physicPaintStore,
      childDocumentVisibleInChild: child.efx.getDocument(LAYER) !== null,
      childDocumentVisibleInParent: parent.efx.getDocument(LAYER) !== null,
    };
    // The harness must FAIL LOUDLY if the two realms share a module instance:
    // a mutation written only in the child must be invisible to the parent.
    expect(realmIsolation.separateInstances).toBe(true);
    expect(realmIsolation.separateEfxVersionSignals).toBe(true);
    expect(realmIsolation.separatePhysicStores).toBe(true);
    expect(realmIsolation.childDocumentVisibleInChild).toBe(true);
    expect(realmIsolation.childDocumentVisibleInParent).toBe(false);
    remember('realmIsolation', realmIsolation);

    const readRevision = (realm: Realm): string | null => {
      const document = realm.efx.getDocument(LAYER);
      return document ? realm.revision.buildEfxPaintDocumentRevision(document) : null;
    };
    const carriesPhotoRef = (document: SurfaceCarrier): boolean =>
      document.photoReference?.sourceFrameRefs.join(',') === REF_REFS.join(',');
    const carriesClip = (document: SurfaceCarrier): boolean =>
      document.background.clips.some((clip) => clip.startFrame === BG_START_FRAME && clip.sourceFrameRefs.join(',') === BG_REFS.join(','));
    const carriesTrack = (document: SurfaceCarrier, trackId: string): boolean =>
      trackId.length > 0 && document.tracks.some((track) => track.id === trackId);

    // ----- STEP 1 — the three surfaces, as their REAL handlers drive them ---
    // `handleConfirmReferencePicker` (:4298-4329): setPhotoReferenceSource,
    //   then recordBackgroundEdit(descriptor) — a ledger-only push, verified by
    //   reading useRotoPhysicalEditHistory.ts:712-717 (appliedRef.push +
    //   trimAppliedHistory + discardRedoHistory + publishAvailability; ZERO
    //   document writes) — then the reference hydration + picker.cancel().
    // `handleConfirmBackgroundPicker` (:4209-4285): addBackgroundClip with the
    //   placement frame, then hydrateBackgroundSourceImagesFromLibrary on the
    //   accepted document, then getFlattenedFrame(landingFrame).
    // `handleAddTrack` (:2866-2875): addTrack THEN setActiveTrackId — TWO
    //   mutations, not one.
    const versionAt = (): number => child.efx.efxPaintVersion.value;

    const beforeRef = { version: versionAt(), revision: readRevision(child) };
    const refResult = child.efx.setPhotoReferenceSource(LAYER, [...REF_REFS]);
    const refDescriptor = refResult.ok ? refResult.descriptor : null;
    const afterRefMutation = { version: versionAt(), revision: readRevision(child), ok: refResult.ok };

    const beforeClip = { version: versionAt(), revision: readRevision(child) };
    const clipResult = child.efx.addBackgroundClip(LAYER, {
      startFrame: BG_START_FRAME,
      sourceFrameRefs: [...BG_REFS],
      repeat: { mode: 'finite', count: 1 },
    });
    const clipDescriptor = clipResult.ok ? clipResult.descriptor : null;
    const acceptedAfterClip = child.efx.getDocument(LAYER);
    const clipHydration = acceptedAfterClip
      ? await child.physic.hydrateBackgroundSourceImagesFromLibrary(acceptedAfterClip, { images: [], projectDir: '/ffh-project' })
          .then((result) => ({ ok: true as const, missing: result.missing.length }))
          .catch((error: unknown) => ({ ok: false as const, error: error instanceof Error ? error.message : String(error) }))
      : { ok: true as const, missing: 0 };
    // The handler's third step reads the flattened composite — a browser-canvas
    // read that cannot run under vitest's node environment (same boundary class
    // as the unmountable component). Recorded, never silently skipped.
    let clipFlattenedError: string | null = null;
    let clipFlattened: unknown = null;
    try {
      clipFlattened = child.physic.physicPaintStore.getFlattenedFrame(LAYER, BG_START_FRAME, false);
    } catch (error) {
      clipFlattenedError = error instanceof Error ? error.message : String(error);
    }
    const afterClipMutation = { version: versionAt(), revision: readRevision(child), ok: clipResult.ok };

    const beforeTrack = { version: versionAt(), revision: readRevision(child) };
    const addResult = child.efx.addTrack(LAYER);
    const addedTrackId = addResult.ok ? addResult.trackId : '';
    const activationAccepted = addResult.ok ? child.efx.setActiveTrackId(LAYER, addResult.trackId) : false;
    const afterTrackMutation = { version: versionAt(), revision: readRevision(child), ok: addResult.ok, activationAccepted };

    const childDocumentAfterMutations = child.efx.getDocument(LAYER)!;
    remember('step1_surfaceMutations', {
      note: 'Substituted for the mounted component: these are the handler call sequences read off PhysicsPaintStudio.tsx and reproduced on the child realm store. The component cannot be mounted in vitest (Tauri window/engine deps), so no click path is driven.',
      handlerSources: {
        reference: 'PhysicsPaintStudio.tsx:4298-4329 handleConfirmReferencePicker',
        background: 'PhysicsPaintStudio.tsx:4209-4285 handleConfirmBackgroundPicker',
        track: 'PhysicsPaintStudio.tsx:2866-2875 handleAddTrack',
      },
      reference: {
        before: beforeRef,
        after: afterRefMutation,
        versionBumped: afterRefMutation.version > beforeRef.version,
        revisionChanged: afterRefMutation.revision !== beforeRef.revision,
        descriptorKind: refDescriptor?.operationKind ?? null,
        recordedOnLedgerByHandler: refDescriptor !== null,
      },
      background: {
        before: beforeClip,
        after: afterClipMutation,
        versionBumped: afterClipMutation.version > beforeClip.version,
        revisionChanged: afterClipMutation.revision !== beforeClip.revision,
        descriptorKind: clipDescriptor?.operationKind ?? null,
        hydration: clipHydration,
        flattenedFramePresent: clipFlattened !== null,
        flattenedFrameError: clipFlattenedError,
      },
      track: {
        before: beforeTrack,
        after: afterTrackMutation,
        versionBumped: afterTrackMutation.version > beforeTrack.version,
        revisionChanged: afterTrackMutation.revision !== beforeTrack.revision,
        addedTrackId,
      },
      childDocumentCarries: {
        photoReference: carriesPhotoRef(childDocumentAfterMutations),
        backgroundClip: carriesClip(childDocumentAfterMutations),
        addedTrack: carriesTrack(childDocumentAfterMutations, addedTrackId),
      },
      childDocumentRevision: childDocumentAfterMutations.documentRevision,
      childDocumentTrackCount: childDocumentAfterMutations.tracks.length,
    });

    // ----- STEP 2 — FG-2, the serialize diff -------------------------------
    // The push does not send `child.getEfxPaintDocument` — it sends whatever
    // `serializeRuntimeIntoDocument` RETURNS, and that call write-backs into
    // `_documents` (efxPaintStore.ts:1726-1733). Diff the document ACROSS it.
    const docBeforeSerialize = child.efx.getDocument(LAYER)!;
    const revisionBeforeSerialize = child.revision.buildEfxPaintDocumentRevision(docBeforeSerialize);
    const documentRevisionBeforeSerialize = docBeforeSerialize.documentRevision;
    let serializeThrew: string | null = null;
    let serialized: SurfaceCarrier | null = null;
    try {
      serialized = child.efx.serializeRuntimeIntoDocument(LAYER) as unknown as SurfaceCarrier;
    } catch (error) {
      serializeThrew = error instanceof Error ? error.message : String(error);
    }
    const docAfterSerialize = child.efx.getDocument(LAYER)!;
    remember('step2_serializeDiff', {
      note: 'd1 = revision of the child document BEFORE serialize, d2 = revision of the document serialize RETURNED, d3 = revision of the child document AFTER the call (the write-back). A d3 that lost a surface is the FG-2 finding.',
      serializeThrew,
      d1_revisionBefore: revisionBeforeSerialize,
      d2_revisionReturned: serialized ? child.revision.buildEfxPaintDocumentRevision(serialized) : null,
      d3_revisionAfterWriteBack: child.revision.buildEfxPaintDocumentRevision(docAfterSerialize),
      documentRevisionBefore: documentRevisionBeforeSerialize,
      documentRevisionAfter: docAfterSerialize.documentRevision,
      documentRevisionBumped: docAfterSerialize.documentRevision !== documentRevisionBeforeSerialize,
      returnedIsStoredObject: serialized === docAfterSerialize,
      returnedCarries: serialized
        ? {
            photoReference: carriesPhotoRef(serialized),
            backgroundClip: carriesClip(serialized),
            addedTrack: carriesTrack(serialized, addedTrackId),
          }
        : null,
      storedAfterCarries: {
        photoReference: carriesPhotoRef(docAfterSerialize),
        backgroundClip: carriesClip(docAfterSerialize),
        addedTrack: carriesTrack(docAfterSerialize, addedTrackId),
      },
    });

    // ----- STEP 3 — FG-1, the guard IN the loop ----------------------------
    // The exact composition pushLiveProjection runs (:3922-3931), plus the
    // CALLER CONTRACT every caller obeys (:4024 close, :4048 debounce, :4081
    // gesture): the dirty flag is cleared BEFORE the call, so a null return is
    // a mutation consumed with NO send and NO re-mark.
    const guard = child.guard.createDocumentSyncPushGuard();
    const dirty = signal(false);
    const callerSequence: Array<Record<string, unknown>> = [];
    const driveCaller = (label: string): Record<string, unknown> => {
      dirty.value = true; // the mutation effect (PhysicsPaintStudio.tsx:4002-4005)
      const dirtyBeforeCall = dirty.peek();
      dirty.value = false; // the caller's clear (:4024 / :4048 / :4081)
      let document: unknown = null;
      let threw: string | null = null;
      try {
        document = guard.evaluate(
          () => child.efx.serializeRuntimeIntoDocument(LAYER),
          () => child.efx.efxPaintVersion.peek(),
        );
      } catch (error) {
        threw = error instanceof Error ? error.message : String(error);
      }
      const outcome = {
        label,
        dirtyBeforeCall,
        dirtyAfterClear: dirty.peek(),
        guardReturnedNull: document === null,
        threw,
        documentStillOwed: dirty.peek(),
      };
      callerSequence.push(outcome);
      return outcome;
    };
    const firstCall = driveCaller('first evaluate (the push the caller believed it was making)');
    emitTo.mockClear();
    const secondCall = driveCaller('second evaluate on the SAME guard (the push serialize re-fires the dirty effect — the re-entrant shape)');
    remember('step3_guardInTheLoop', {
      note: 'A null from evaluate paired with a cleared documentSyncDirty is the H2 drop shape: the caller cleared the flag the line before, nothing re-marks it, and no send occurs.',
      callerContract: {
        close: 'PhysicsPaintStudio.tsx:4023-4026',
        debounce: ':4047-4050',
        gesture: ':4080-4083',
      },
      firstCall,
      secondCall,
      emitCountDuringGuardCalls: emitTo.mock.calls.length,
    });

    // ----- STEP 4 — the crossing, against a LIVE parent --------------------
    // Stop using a hand-fed handler: the child's REAL sender puts the payload
    // on the (mocked) wire, and the parent's REAL listener — installed in the
    // parent realm — receives it.
    const socketDocument = child.efx.serializeRuntimeIntoDocument(LAYER);
    emitTo.mockClear();
    let sendError: string | null = null;
    try {
      await child.transport.sendEfxPaintDocumentSync(socketDocument, 'Tauri');
    } catch (error) {
      sendError = error instanceof Error ? error.message : String(error);
    }
    const wireCall = emitTo.mock.calls[emitTo.mock.calls.length - 1];
    const wirePayload = wireCall ? wireCall[2] : null;

    // The parent holds the launch-state document — the shape a second Studio
    // launch would have left before this session's push arrives.
    parent.efx.reset();
    parent.physic.physicPaintStore.reset();
    parent.efx.registerDocument(buildBaseDocument(parent.documents, LAYER, TRACK1));
    const parentRevisionBefore = readRevision(parent);
    const parentDocumentBefore = parent.efx.getDocument(LAYER)!;

    const unlisten = await parentBridge.installPhysicPaintEfxPaintDocumentListener();
    const handler = installed.get(parentBridge.PHYSIC_PAINT_EFX_PAINT_DOCUMENT_EVENT);
    const handlerInstalled = typeof handler === 'function';
    handler?.({ detail: wirePayload });
    const parentDocumentAfter = parent.efx.getDocument(LAYER)!;
    const parentRevisionAfter = readRevision(parent);
    unlisten();
    remember('step4_crossing', {
      note: 'The child realm built and sent the document through the real sender; the parent realm applied it through the real installed listener. A skipped apply is a verdict datum — record it as one.',
      sendError,
      emittedEvent: wireCall ? wireCall[1] : null,
      emittedTarget: wireCall ? wireCall[0] : null,
      handlerInstalled,
      handlerEventNames: Array.from(installed.keys()),
      revisionGuardPath: {
        parentRevisionBefore,
        parentRevisionAfter,
        idempotencyEarlyReturnFired: parentRevisionBefore === parentRevisionAfter,
      },
      parentIdentityChanged: parentDocumentBefore !== parentDocumentAfter,
      parentAfterCarries: {
        photoReference: carriesPhotoRef(parentDocumentAfter),
        backgroundClip: carriesClip(parentDocumentAfter),
        addedTrack: carriesTrack(parentDocumentAfter, addedTrackId),
      },
      parentTrackCount: parentDocumentAfter.tracks.length,
      parentDocumentRevision: parentDocumentAfter.documentRevision,
    });

    // ----- STEP 5 — the reopen carrier -------------------------------------
    parentSequenceStore.sequenceStore.sequences.value = [{
      id: 'ffh-parent-sequence',
      kind: 'fx',
      name: 'ffh parent authority',
      fps: 24,
      width: 1920,
      height: 1080,
      keyPhotos: [],
      layers: [{
        id: LAYER,
        name: 'Physic Paint',
        type: 'physic-paint',
        visible: true,
        opacity: 1,
        blendMode: 'normal',
        transform: { x: 0, y: 0, scale: 1, rotation: 0 },
        source: { type: 'physic-paint', layerId: LAYER },
      }],
      inFrame: 0,
      outFrame: 60,
    }] as never;
    let carrierError: string | null = null;
    let carrierDocument: SurfaceCarrier | null = null;
    try {
      const carrier = parentBridge.createPhysicPaintLaunchContext(
        {
          id: LAYER,
          name: 'Physic Paint',
          type: 'physic-paint',
          visible: true,
          opacity: 1,
          blendMode: 'normal',
          transform: { x: 0, y: 0, scale: 1, rotation: 0 },
          source: { type: 'physic-paint', layerId: LAYER },
        } as never,
        0,
      );
      carrierDocument = (carrier.document ?? null) as SurfaceCarrier | null;
    } catch (error) {
      carrierError = error instanceof Error ? error.message : String(error);
    }
    remember('step5_reopenCarrier', {
      note: 'createPhysicPaintLaunchContext builds `{ ...baseDocument, tracks }` from the PARENT realm document and fails closed if that cannot parse. It can only carry what the parent already holds.',
      carrierError,
      carrierCarries: carrierDocument
        ? {
            photoReference: carriesPhotoRef(carrierDocument),
            backgroundClip: carriesClip(carrierDocument),
            addedTrack: carriesTrack(carrierDocument, addedTrackId),
          }
        : null,
      carriedTrackCount: carrierDocument ? carrierDocument.tracks.length : null,
    });

    // ----- STEP 6 — FG-4, teardown ----------------------------------------
    // The plan requires the gate evaluated for the state each surface's
    // MUTATION leaves — not for the post-success state step 3/4 left behind.
    // The mutation effect (:4002-4005) sets the flag on the version bump, so
    // the post-mutation state is `true` with nothing yet consumed.
    const postMutationDirty = signal(false);
    const gateForSurface = (label: string): Record<string, unknown> => {
      postMutationDirty.value = false;
      postMutationDirty.value = true; // the mutation effect (:4002-4005)
      const dirtyAtClose = postMutationDirty.peek();
      const failures = 0;
      const gateWouldFire = dirtyAtClose || failures > 0;
      let flushWouldClear = false;
      let flushWouldPush = false;
      if (dirtyAtClose || failures > 0) {
        // flushDocumentSyncRef.current (:4013-4027): mode gate, then clear INSIDE it
        const layerIdPresent = true;
        const mode: string = 'Tauri';
        if (layerIdPresent && (mode === 'Tauri' || mode === 'Browser fallback')) {
          postMutationDirty.value = false;
          flushWouldClear = true;
          flushWouldPush = true;
        }
      }
      return { label, dirtyAtClose, failureStreak: failures, gateWouldFire, flushWouldClear, flushWouldPush, dirtyAfterFlush: postMutationDirty.peek() };
    };
    remember('step6_teardown', {
      note: 'Term (a) is the close gate as PhysicsPaintStudio.tsx:1919 composes it. Terms the mounted component owns (engine stroke count, pending live pixels, playback settings) cannot be evaluated here; the DOCUMENT-SYNC term — the one this defect rides — is evaluated for the state each surface left.',
      gateForTheStateEachMutationLeaves: [
        gateForSurface('reference selection (setPhotoReferenceSource)'),
        gateForSurface('background clip (addBackgroundClip)'),
        gateForSurface('(+) track (addTrack + setActiveTrackId)'),
      ],
      closePaths: [
        'header Close: PhysicsPaintStudio.tsx:1943-1947 handleWorkflowClose → getCurrentWindow().close() → onCloseRequested',
        'OS window close: onCloseRequested directly',
        'usePhysicsPaintCloseFlush (bridge/usePhysicsPaintParentBridge.ts:28-51) is the single handler for all of them',
      ],
      gateComposition: 'workflowMode === "roto" && Boolean(strokeCount || hasPendingLivePixels || playbackHasPending || pendingDocumentSyncRef.current())',
      workflowModeConstant: 'PhysicsPaintStudio.tsx:797 `const workflowMode = "roto" as const` — the workflowMode term is ALWAYS true',
      documentSyncTerm: {
        source: 'PhysicsPaintStudio.tsx:4012 — pendingDocumentSyncRef.current = () => documentSyncDirty.peek() || documentSyncPushFailuresRef.current > 0',
        dirtyAfterStep3CallerSequence: dirty.peek(),
        failureStreak: 0,
        gateWouldFire: dirty.peek() === true,
      },
      flushBodyDecisions: {
        source: 'PhysicsPaintStudio.tsx:4013-4027 flushDocumentSyncRef.current',
        clearsInsideModeGate: true,
        modeGate: 'layerId && (mode === "Tauri" || mode === "Browser fallback")',
        clearsThenPushes: true,
      },
      guardOutcomeForTheClosePush: secondCall.guardReturnedNull === true
        ? 'the close flush would call pushLiveProjection and consume the change with NO send (guard returns null)'
        : 'the close flush would attempt a real send',
    });

    // ----- STEP 7 — H4, the strokes contrast, with evidence ----------------
    emitTo.mockClear();
    const strokePayload = {
      operationId: 'ffh-stroke-1',
      kind: 'apply-canvas',
      layerId: LAYER,
      startFrame: 0,
      frames: [],
    } as never;
    let strokeError: string | null = null;
    try {
      await child.transport.sendPhysicPaintApplyPayload(strokePayload, 'Tauri');
    } catch (error) {
      strokeError = error instanceof Error ? error.message : String(error);
    }
    const strokeCall = emitTo.mock.calls[emitTo.mock.calls.length - 1];
    remember('step7_strokesContrast', {
      stroke: {
        direction: 'child→main',
        sender: 'sendPhysicPaintApplyPayload (components/physic-paint/bridge/physicsPaintBridgeTransport.ts:420)',
        event: 'physic-paint:apply (lib/physicPaintBridge.ts:89)',
        ackPair: 'physic-paint:apply-result (lib/physicPaintBridge.ts:90) — the parent answers, correlated by operationId',
        callSites: ['PhysicsPaintStudio.tsx:1469 (physical edits)', ':841 (cache payload)', ':1866'],
        gatedByDirtyFlag: false,
        debounced: false,
        closeFlushRequired: false,
        emittedEvent: strokeCall ? strokeCall[1] : null,
        emitError: strokeError,
      },
      studioOriginSurfaces: {
        direction: 'child→main',
        sender: 'sendEfxPaintDocumentSync (components/physic-paint/bridge/physicsPaintBridgeTransport.ts:323), reached only through documentSyncDirty → the scheduler/close flush → the push guard → serializeRuntimeIntoDocument',
        event: 'physic-paint:efx-paint-document (lib/physicPaintBridge.ts:97)',
        ackPair: null,
        gatedByDirtyFlag: true,
        debounced: '2000ms debounce (non-gesture) / 2500ms gesture-quiet (gesture)',
        closeFlushRequired: true,
        guardInTheLoop: true,
      },
    });

    // ----- STEP 8 — the re-arm's reachability (the verdict's link) ----------
    // pushLiveProjection reads the guard ONCE per render into a const
    // (:3909-3913) and calls THAT const (:3922). Its failure path re-arms by
    // writing the REF (:3981) and re-marks dirty (:3984) — but that write is a
    // no-op when the flag is already true, which is the normal case: the push's
    // own serialize calls _notifyChange() and re-armed it. So the bounded retry
    // can run with NO render in between, against the OLD guard, whose latch
    // holds the fingerprint the FAILED send already claimed. Duplicate →
    // evaluate returns null (:3938) → no send, no re-mark — and the caller had
    // already cleared the flag (:4024 / :4048 / :4081).
    //
    // MODELLED WINDOW, stated: the retry here is driven with no re-render
    // between the failure and the retry — the window the product leaves open
    // whenever the failure is followed by no other render (a quiet Studio: no
    // input, no version bump, no other signal write). The CONTROL below drives
    // the identical retry through the re-armed ref — what a render in that
    // window would have handed the component, and what the fix must achieve —
    // so the two differ ONLY in the staleness, never in the guard's semantics.
    const readGuard = (ref: { current: ReturnType<GuardModule['createDocumentSyncPushGuard']> }) => ref.current;
    const surfaceChecks: Array<Record<string, unknown>> = [];
    for (const surface of ['reference', 'background', 'track'] as const) {
      emitTo.mockClear();
      const guardRef = { current: child.guard.createDocumentSyncPushGuard() };
      const captured = readGuard(guardRef); // :3913
      const owed = signal(true);
      owed.value = false; // the caller's clear (:4024 / :4048 / :4081)
      let firstDocument: unknown = null;
      try {
        firstDocument = captured.evaluate(
          () => child.efx.serializeRuntimeIntoDocument(LAYER),
          () => child.efx.efxPaintVersion.peek(),
        );
      } catch { firstDocument = null; }
      emitTo.mockRejectedValueOnce(new Error('ffh: simulated bridge failure on the push'));
      let sendError: string | null = null;
      await child.transport.sendEfxPaintDocumentSync(firstDocument, 'Tauri')
        .catch((error: unknown) => { sendError = error instanceof Error ? error.message : String(error); });
      // The failure path (:3976-3986): re-arm the REF, re-mark dirty.
      guardRef.current = child.guard.createDocumentSyncPushGuard();
      owed.value = true;
      emitTo.mockClear();
      // The bounded retry, with no render in between — the component still holds `captured`.
      owed.value = false;
      let retryReturnedNull = false;
      let retryThrew: string | null = null;
      try {
        retryReturnedNull = captured.evaluate(
          () => child.efx.serializeRuntimeIntoDocument(LAYER),
          () => child.efx.efxPaintVersion.peek(),
        ) === null;
      } catch (error) {
        retryThrew = error instanceof Error ? error.message : String(error);
      }
      const retryEmitCount = emitTo.mock.calls.length;
      const owedAfterRetry = owed.peek();
      // Control: the identical retry through the re-armed ref.
      let controlReturnedNull: boolean | null = null;
      let controlEmitCount = 0;
      try {
        const controlDocument = guardRef.current.evaluate(
          () => child.efx.serializeRuntimeIntoDocument(LAYER),
          () => child.efx.efxPaintVersion.peek(),
        );
        controlReturnedNull = controlDocument === null;
        if (controlDocument !== null) {
          await child.transport.sendEfxPaintDocumentSync(controlDocument, 'Tauri');
        }
        controlEmitCount = emitTo.mock.calls.length - retryEmitCount;
      } catch { /* recorded as null */ }
      surfaceChecks.push({
        surface,
        firstPushSent: firstDocument !== null,
        sendError,
        rearmWroteTheRefNotTheCapturedConst: guardRef.current !== captured,
        retryAgainstTheCapturedConst: { returnedNull: retryReturnedNull, threw: retryThrew, emitCount: retryEmitCount, owedAfterRetry },
        controlRetryAgainstTheRearmedRef: { returnedNull: controlReturnedNull, emitCount: controlEmitCount },
      });
    }
    remember('step8_rearmReachability', {
      note: 'A failed push arms a retry the component cannot reach: the re-arm writes the ref (:3981) while the decision reads the render-captured const (:3913/:3922). The retry then sees the failed content as a duplicate and consumes it — no send, no re-mark.',
      modelledWindow: 'no re-render between the failure and the retry (a quiet Studio). The control pads exactly that window with a ref re-read.',
      surfaceChecks,
    });
  });
});
