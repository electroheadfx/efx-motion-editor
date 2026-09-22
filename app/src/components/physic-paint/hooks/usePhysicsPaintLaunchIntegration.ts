import { useCallback, useEffect, useRef, type Dispatch, type MutableRef, type StateUpdater } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintLaunchContext, PhysicPaintRotoPlaybackSettings } from '../../../types/physicPaint';
import type { PendingPhysicPaintApply } from './usePhysicsPaintApplyResultController';
import {
  physicPaintStore,
  hydrateBackgroundSourceImagesFromLibrary,
  hydrateReferenceSourceImagesFromLibrary,
} from '../../../stores/physicPaintStore';
import { applyPhysicsPaintLaunchContext } from '../bridge/physicsPaintLaunchContext';
import { handleEfxPaintAudioContextEvent } from '../audio/efxPaintAudioMonitor';
import { installEfxPaintAudioPlaybackStateListener } from '../audio/efxPaintAudioOwnership';
import { applyBackgroundFallbackToSettings, type PhysicsPaintStudioSettings } from '../engine/physicsPaintStudioSettings';
import { hydrateRotoPhysicalLaunchContext } from '../roto/rotoLaunchHydration';
import { registerDocument } from '../../../stores/efxPaintStore';
import { imageStore } from '../../../stores/imageStore';
import { requestImageLibrary } from '../../../lib/physicPaintBridge';
import { readEfxPaintSessionDocumentCheckpoint } from '../bridge/physicsPaintBridgeTransport';
import { useEfxPaintAudioContextBridge, usePhysicsPaintLaunchBridge, usePhysicsPaintProjectContextBridge } from '../bridge/usePhysicsPaintParentBridge';
import { createPhysicsPaintProjectContextSettlement, type PhysicsPaintProjectContextSettlement } from './physicsPaintProjectContextSettlement';

type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type PreviewBackgroundEngine = EfxPaintEngine & { setBackgroundImageUrl: (dataUrl: string) => void; resetBackground: () => void; setPreviewBaseImageUrl: (dataUrl: string) => void; clearPreviewBaseImage: () => void };

export interface PhysicsPaintLaunchReplacementCoordinator {
  request: (context: PhysicPaintLaunchContext) => void;
  dispose: () => void;
}

export function createPhysicsPaintLaunchReplacementCoordinator(input: {
  prepareReplacement: () => Promise<void>;
  applyLatest: (context: PhysicPaintLaunchContext) => void | Promise<void>;
}): PhysicsPaintLaunchReplacementCoordinator {
  let latest: PhysicPaintLaunchContext | null = null;
  let running = false;
  let disposed = false;

  const run = async () => {
    if (running || disposed || !latest) return;
    const requestedContext = latest;
    running = true;
    try {
      await input.prepareReplacement();
      if (disposed) return;
      const context = latest;
      latest = null;
      if (context) await input.applyLatest(context);
    } catch (error) {
      if (latest === requestedContext) latest = null;
      console.error('[PhysicsPaintStudio] launch replacement handoff failed', error);
    } finally {
      running = false;
      if (!disposed && latest) void run();
    }
  };

  return {
    request: (context) => {
      if (disposed) return;
      latest = context;
      void run();
    },
    dispose: () => {
      disposed = true;
      latest = null;
    },
  };
}

interface LaunchLifecyclePorts {
  pendingFrameSyncRef: MutableRef<number | null>;
  pendingApplyRef: MutableRef<PendingPhysicPaintApply | null>;
  activeOperationIdRef: MutableRef<string | null>;
  prepareScriptLaunchReplacement: () => Promise<void>;
  preparePlaybackSettingsLaunchReplacement: () => Promise<void>;
  completeScriptLaunchReplacement: () => void;
  cancelPhysicalEditForLaunch: () => void;
  disposePhysicalEditSettlement: () => void;
}

interface LaunchStatePorts {
  setLaunchContext: Dispatch<StateUpdater<PhysicPaintLaunchContext | null>>;
  setSettings: Dispatch<StateUpdater<PhysicsPaintStudioSettings>>;
  setApplyStatus: Dispatch<StateUpdater<ApplyStatus>>;
  setApplyMessage: Dispatch<StateUpdater<string | null>>;
  setLastError: Dispatch<StateUpdater<string | null>>;
}

export function usePhysicsPaintLaunchIntegration(input: {
  engineRef: MutableRef<EfxPaintEngine | null>;
  lifecycle: LaunchLifecyclePorts;
  state: LaunchStatePorts;
  peekLaunchContext: () => PhysicPaintLaunchContext | null;
  resetPersistenceForLaunch: () => void;
  resetNavigationForLaunchRef: MutableRef<(settings: PhysicPaintRotoPlaybackSettings) => void>;
  hydratePlaybackSettingsForLaunch: (context: PhysicPaintLaunchContext, settings: PhysicPaintRotoPlaybackSettings) => void;
  resetCachedReference: () => void;
  loadCachedReferenceFrame: (frame: number, engine?: PreviewBackgroundEngine) => void;
  onSettledLaunchContext?: (context: PhysicPaintLaunchContext) => void;
}) {
  const getStrokeMetadata = useCallback(() => null, []);

  const resetRotoSessionForLaunch = useCallback((context: PhysicPaintLaunchContext) => {
    const playbackSettings = context.rotoPlayback ?? {
      loop: false,
      fps: Math.max(1, Math.min(60, context.fps ?? 12)),
    };
    input.resetPersistenceForLaunch();
    input.lifecycle.pendingApplyRef.current = null;
    input.resetNavigationForLaunchRef.current(playbackSettings);
    input.hydratePlaybackSettingsForLaunch(context, playbackSettings);
    input.resetCachedReference();
  }, [input]);

  const applySettledLaunchContext = useCallback(async (context: PhysicPaintLaunchContext) => {
    input.lifecycle.pendingFrameSyncRef.current = null;
    input.lifecycle.completeScriptLaunchReplacement();
    input.lifecycle.cancelPhysicalEditForLaunch();

    // Crash-recovery: after a compositor-death reload, the sessionStorage
    // checkpoint (written on every document push) is fresher than the launch
    // context's carried document. It is consumed only by the launch that wrote
    // it — an earlier session's checkpoint is never substituted into a newer
    // launch (quick-260913-52r H).
    const sessionDocument = readEfxPaintSessionDocumentCheckpoint(context.operationId);
    const hydrationContext = sessionDocument ? { ...context, document: sessionDocument } : context;
    const hydration = await hydrateRotoPhysicalLaunchContext(hydrationContext, physicPaintStore);
    if (!hydration.ok) {
      // quick-260913-52r (G): a failed launch hydration used to be state-only
      // (zero console output) — surface it loudly; a Studio that cannot
      // hydrate must never look like a silently dead window.
      console.error('[PhysicsPaintStudio] Roto physical launch hydration failed:', hydration.error);
      input.state.setLastError(hydration.error);
      input.state.setApplyStatus('error');
      input.state.setApplyMessage(hydration.error);
      return;
    }

    // 49-06 (UAT round 2): the child realm's imageStore is a SEPARATE instance
    // from the main webview's — it only gains images via the picker's import.
    // Load the project library into it BEFORE the document registration so the
    // background source hydration (`imageStore.getById`) resolves EXISTING
    // library refs and every reopened clip (a fresh session's imageStore is
    // empty, so getById returned undefined and the hydration skipped every ref
    // — the reopened clip stayed invisible).
    const library = await requestImageLibrary();
    if (library.ok && library.projectDir) {
      imageStore.loadFromMceImages(library.images, library.projectDir);
    }
    // The carried v1.0 document IS the session: install it into the child's
    // efxPaintStore so the session-file save path resolves the document.
    if (hydration.context.document) {
      registerDocument(hydration.context.document);
      // 49-06 (UAT round 7): hydrate the background source bytes on launch —
      // registerDocument alone leaves the runtime registry empty, so every
      // reopened Bg clip resolves 'missing' and the canvas stays paper fond
      // until a fresh import re-hydrates all refs (the user's round-7 report:
      // "re-open → Bg rails did NOT render; creating a new bg rail worked for
      // all"). The library was loaded above; run the hydration WITH the
      // library fallback so EXISTING refs register and the render is restored.
      const launchLibrary = library.ok && library.projectDir
        ? { images: library.images, projectDir: library.projectDir }
        : undefined;
      void hydrateBackgroundSourceImagesFromLibrary(hydration.context.document, launchLibrary);
      // 50-UAT (round-2 report): the SAME reopen gap existed for the photo
      // reference — registerDocument alone leaves `_referenceSourceImages`
      // empty, so every reopened reference resolves 'missing' and the ghost
      // stays invisible until a fresh Replace re-warms the registry. Run the
      // parallel reference hydration WITH the library fallback so reopened
      // references render again.
      void hydrateReferenceSourceImagesFromLibrary(hydration.context.document, launchLibrary);
    }
    resetRotoSessionForLaunch(hydration.context);
    // 49-04 (UAT fix): hydrate the Studio settings from the DOCUMENT FALLBACK
    // (the single authority), not the carried per-track roto background — the
    // selector must agree with the engine and monitor fond before the first
    // click. The launch IS the document (D-03), so the fallback is carried.
    // quick-260922-jss: the launch settle is the only moment a project-context
    // payload that arrived while this launch was still settling can reach a
    // published context (the one-shot read-only pull races this async path).
    // The settle moves `.project` and nothing else, which is why every other
    // read below keeps reading `hydration.context` / `hydration.document`.
    const settledContext = settlementRef.current?.settle(hydration.context) ?? hydration.context;
    applyPhysicsPaintLaunchContext(settledContext, input.state, (launch) => {
      const fallback = launch.document?.background?.fallback;
      return fallback ? applyBackgroundFallbackToSettings(fallback) : null;
    });
    // 41-02 (D-01): hydrate the audio preview from the launch section through
    // the SAME single funnel the live push events use (G-52-9 silent-scrub
    // fix): the strict revision guard AND the monitor's applyRevisionedContext
    // — which runs prepare() (fetch+decode, sets the monitor context). The
    // bare store guard left the monitor unprepared until the first Play, so
    // scrubAt bailed on its !context gate and idle scrub was silent. Absent
    // section = no audio.
    if (hydration.context.audioPreview) {
      void handleEfxPaintAudioContextEvent(hydration.context.audioPreview);
    }
    const readyEngine = input.engineRef.current;
    if (readyEngine) input.loadCachedReferenceFrame(hydration.document.cursorAppFrame, readyEngine as PreviewBackgroundEngine);
    input.state.setApplyStatus('idle');
    input.state.setApplyMessage(null);
    input.state.setLastError(null);
    input.lifecycle.activeOperationIdRef.current = null;
    input.lifecycle.pendingApplyRef.current = null;
    input.onSettledLaunchContext?.(settledContext);
  }, [input, resetRotoSessionForLaunch]);

  const prepareReplacementRef = useRef(async () => {
    await input.lifecycle.prepareScriptLaunchReplacement();
    await input.lifecycle.preparePlaybackSettingsLaunchReplacement();
  });
  const applySettledLaunchContextRef = useRef(applySettledLaunchContext);
  prepareReplacementRef.current = async () => {
    await input.lifecycle.prepareScriptLaunchReplacement();
    await input.lifecycle.preparePlaybackSettingsLaunchReplacement();
  };
  applySettledLaunchContextRef.current = applySettledLaunchContext;
  // quick-260922-jss: the project-context round trip runs through its own
  // controller (physicsPaintProjectContextSettlement.ts) so both arrival orders
  // — payload before the settle, payload after it — land the same way. `input`
  // is a fresh literal on every render, so the controller's ports read it
  // through a ref, the same idiom as applySettledLaunchContextRef above.
  const settlementInputRef = useRef(input);
  settlementInputRef.current = input;
  const settlementRef = useRef<PhysicsPaintProjectContextSettlement | null>(null);
  if (!settlementRef.current) {
    settlementRef.current = createPhysicsPaintProjectContextSettlement({
      peekLaunchContext: () => settlementInputRef.current.peekLaunchContext(),
      applyContext: (context) => {
        settlementInputRef.current.state.setLaunchContext(context);
        settlementInputRef.current.onSettledLaunchContext?.(context);
      },
    });
  }
  const coordinatorRef = useRef<PhysicsPaintLaunchReplacementCoordinator | null>(null);
  if (!coordinatorRef.current) {
    coordinatorRef.current = createPhysicsPaintLaunchReplacementCoordinator({
      prepareReplacement: () => prepareReplacementRef.current(),
      applyLatest: (context) => applySettledLaunchContextRef.current(context),
    });
  }
  const disposePhysicalEditSettlementRef = useRef(input.lifecycle.disposePhysicalEditSettlement);
  disposePhysicalEditSettlementRef.current = input.lifecycle.disposePhysicalEditSettlement;
  useEffect(() => () => {
    coordinatorRef.current?.dispose();
    disposePhysicalEditSettlementRef.current();
  }, []);
  const applyIncomingLaunchContext = useCallback((context: PhysicPaintLaunchContext) => {
    coordinatorRef.current?.request(context);
  }, []);

  usePhysicsPaintLaunchBridge(applyIncomingLaunchContext);
  // 41-03 (D-02/D-03): live main-editor audio changes arrive as revisioned
  // push events on the same channel/discipline as launch; the funnel applies
  // newer-only and restarts mid-playback at the current Paint cursor.
  useEfxPaintAudioContextBridge(handleEfxPaintAudioContextEvent);
  // 41-04 (D-05..D-07): main-editor playback-state broadcasts feed the
  // first-player-wins ownership guard (suppress + note + auto-resume). One
  // listener per event, same install idiom as the sibling bridges.
  useEffect(() => installEfxPaintAudioPlaybackStateListener(), []);
  // The bridge's callback type carries `undefined` (it is typed off the optional
  // launch field) while its validation gate only ever hands over a real payload.
  usePhysicsPaintProjectContextBridge((project) => { if (project) settlementRef.current?.accept(project); });
  return { getStrokeMetadata };
}
