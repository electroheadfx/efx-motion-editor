import { useCallback, useRef } from 'preact/hooks';
import type { BgMode } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import type { PhysicPaintRotoPhysicalDocument, PhysicPaintRotoPhysicalRenderableSource, PhysicPaintRotoPhysicalRenderSource, PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import { classifyPhysicPaintRotoGroupFrameTarget } from '../roto/physicsPaintRotoGroupLifecycle';
import { buildBlankRotoFrame, encodeRotoFrameFromCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { mergeCachedRotoAlphaFrame } from '../roto/physicsPaintRotoAlphaMerge';
import { createRotoLivePixelCacheTransactions, type RotoLivePixelIdentity } from '../roto/rotoLivePixelCacheTransactions';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { useRotoEditBufferController } from './useRotoEditBufferController';
import { useRotoReferenceController } from './useRotoReferenceController';
import type { RotoGroupFramePaintExecuteInput } from './useRotoPhysicalEditCoordinator';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from '../performance/physicsPaintPerformanceTrace';

/** regression-refresh-multi-paint Layer 1: after a live-pixel capture fails
 * (superseded by a mid-sequence revision advance, or the frame vanished), the
 * caller must NOT fall back to reloading the frame from the stale cache — that
 * reload re-serves a PARTIAL render over the newer settled base. The frame's
 * authoritative content is captured by the sequence's own capture at the settled
 * revision; the superseded capture is dropped (the transaction's matchesIdentity
 * gate prevents any stale-document commit — COW preserved). Returns false always:
 * the stale fallback reload is removed. */
export function shouldReloadRotoFrameAfterFailedCapture(): boolean {
  return false;
}

interface RotoPersistenceStorePort {
  getRotoPhysicalDocument: (layerId: string) => PhysicPaintRotoPhysicalDocument | null;
  getRotoPhysicalContentRevision: (layerId: string) => string | null;
  /** regression-refresh-multi-paint Layer 2: resolve the monotonic CONTENT token
   * of a content revision. Threaded into every reference load so the engine's
   * preview-base seam orders paints by CONTENT newness, never issue order. */
  resolveContentToken: (contentRevision: string | null | undefined) => number;
  getRotoRealKeyRecord: (layerId: string, keyId: string) => PhysicPaintRotoRealKeyRecord | null;
  getRotoRealKeyRecordByAppFrame: (layerId: string, appFrame: number) => PhysicPaintRotoRealKeyRecord | null;
  getRotoPhysicalRenderSource: (layerId: string, appFrame: number) => PhysicPaintRotoPhysicalRenderSource | null;
  updateRotoPhysicalRealKeyPayload: (layerId: string, keyId: string, expectedContentRevision: string, payload: PhysicPaintRotoRealKeyPayload, diagnostics?: { mutationId?: number; record: typeof recordPhysicsPaintPerformance }) => { ok: true; changed: boolean; contentRevision: string } | { ok: false; error: string };
}

export interface RotoPhysicalPaintRouteInput {
  readonly document: PhysicPaintRotoPhysicalDocument;
  readonly projectContextId: string;
  readonly layerId: string;
  readonly launchOperationId: string;
  readonly appFrame: number;
  readonly expectedKeyId?: string;
  readonly renderedPayload: PhysicPaintRotoRealKeyPayload;
  readonly createOverrideKeyId: () => string;
  readonly diagnostics?: { mutationId?: number; record: typeof recordPhysicsPaintPerformance };
}

export interface RotoPhysicalPaintRoutePorts {
  readonly updateOrdinaryKey: (
    layerId: string,
    keyId: string,
    expectedContentRevision: string,
    payload: PhysicPaintRotoRealKeyPayload,
    diagnostics?: { mutationId?: number; record: typeof recordPhysicsPaintPerformance },
  ) => { ok: true; changed: boolean; contentRevision: string } | { ok: false; error: string };
  readonly executePhysicalEdit: (input: RotoGroupFramePaintExecuteInput) => Promise<boolean>;
}

export type RotoPhysicalPaintRouteResult =
  | Readonly<{ ok: true; kind: 'ordinary-key'; keyId: string; contentRevision: string }>
  | Readonly<{ ok: true; kind: 'group-frame'; groupId: string; appFrame: number }>
  | Readonly<{ ok: false; reason: 'stale-target' | 'unresolved-target' | 'ambiguous-target' | 'empty-target' | 'lease-or-settlement-rejected' }>;

export type RotoCompletedPaintTarget =
  | Readonly<{ kind: 'ordinary-key'; keyId: string; appFrame: number }>
  | Readonly<{ kind: 'group-frame'; groupId: string; appFrame: number; expectedKeyId?: string }>
  | Readonly<{ kind: 'empty' }>
  | Readonly<{ kind: 'blocked' }>;

export function resolveRotoLivePixelIdentityKey(
  document: PhysicPaintRotoPhysicalDocument,
  appFrame: number,
): string | null {
  const target = classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame });
  switch (target.kind) {
    case 'ordinary-key':
      return target.keyId;
    case 'source-occurrence':
    case 'generated-occurrence':
    case 'override':
    case 'group-gap':
      return `group:${target.groupId}:phase:${target.cycleOffset}`;
    case 'empty':
    case 'unresolved-group':
    case 'ambiguous-group':
      return null;
    default: {
      const exhaustive: never = target;
      throw new Error(`Unhandled live-pixel identity target: ${JSON.stringify(exhaustive)}`);
    }
  }
}

export function resolveRotoCompletedGroupPaintTarget(
  document: PhysicPaintRotoPhysicalDocument,
  appFrame: number,
  currentCellKeyId: string | null,
): RotoCompletedPaintTarget {
  const target = classifyPhysicPaintRotoGroupFrameTarget({ document, appFrame });
  switch (target.kind) {
    case 'ordinary-key':
      return currentCellKeyId !== null && currentCellKeyId !== target.keyId
        ? Object.freeze({ kind: 'blocked' })
        : Object.freeze({ kind: 'ordinary-key', keyId: target.keyId, appFrame });
    case 'source-occurrence':
      return Object.freeze({
        kind: 'group-frame',
        groupId: target.groupId,
        appFrame,
        expectedKeyId: target.sourceKeyId,
      });
    case 'override':
      return Object.freeze({
        kind: 'group-frame',
        groupId: target.groupId,
        appFrame,
        expectedKeyId: target.keyId,
      });
    case 'generated-occurrence':
    case 'group-gap':
      return Object.freeze({ kind: 'group-frame', groupId: target.groupId, appFrame });
    case 'empty':
      return Object.freeze({ kind: 'empty' });
    case 'unresolved-group':
    case 'ambiguous-group':
      return Object.freeze({ kind: 'blocked' });
    default: {
      const exhaustive: never = target;
      throw new Error(`Unhandled completed Group Paint target: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Classify one accepted Paint destination before any store/cache publication.
 * Ordinary real keys retain the direct payload seam; every lifecycle Group
 * occurrence dispatches the source-phase COW operation through the acknowledged
 * physical coordinator. Unresolved and mismatched targets fail closed.
 */
export async function routeRotoPhysicalPaintFrame(
  input: RotoPhysicalPaintRouteInput,
  ports: RotoPhysicalPaintRoutePorts,
): Promise<RotoPhysicalPaintRouteResult> {
  if (input.renderedPayload.appFrame !== input.appFrame) {
    return Object.freeze({ ok: false, reason: 'stale-target' });
  }
  const target = classifyPhysicPaintRotoGroupFrameTarget({
    document: input.document,
    appFrame: input.appFrame,
  });
  if (target.kind === 'ordinary-key') {
    if (input.expectedKeyId !== undefined && input.expectedKeyId !== target.keyId) {
      return Object.freeze({ ok: false, reason: 'stale-target' });
    }
    const update = ports.updateOrdinaryKey(
      input.layerId,
      target.keyId,
      input.document.revision,
      input.renderedPayload,
      input.diagnostics,
    );
    if (!update.ok || !update.changed) {
      return Object.freeze({ ok: false, reason: 'lease-or-settlement-rejected' });
    }
    return Object.freeze({
      ok: true,
      kind: 'ordinary-key',
      keyId: target.keyId,
      contentRevision: update.contentRevision,
    });
  }
  if (target.kind === 'unresolved-group') {
    return Object.freeze({ ok: false, reason: 'unresolved-target' });
  }
  if (target.kind === 'ambiguous-group') {
    return Object.freeze({ ok: false, reason: 'ambiguous-target' });
  }
  if (target.kind === 'empty') {
    return Object.freeze({ ok: false, reason: 'empty-target' });
  }

  const expectedTargetKeyId = target.kind === 'override'
    ? target.keyId
    : target.kind === 'source-occurrence'
      ? target.sourceKeyId
      : undefined;
  if (input.expectedKeyId !== undefined
    && expectedTargetKeyId !== undefined
    && input.expectedKeyId !== expectedTargetKeyId) {
    return Object.freeze({ ok: false, reason: 'stale-target' });
  }
  const overrideKeyId = target.kind === 'override'
    ? target.keyId
    : input.createOverrideKeyId();
  const accepted = await ports.executePhysicalEdit(Object.freeze({
    operationKind: 'paint-group-frame',
    expectedLaunch: { operationId: input.launchOperationId, layerId: input.layerId },
    groupId: target.groupId,
    appFrame: input.appFrame,
    overrideKeyId,
    renderedPayload: input.renderedPayload,
  }));
  return accepted
    ? Object.freeze({ ok: true, kind: 'group-frame', groupId: target.groupId, appFrame: input.appFrame })
    : Object.freeze({ ok: false, reason: 'lease-or-settlement-rejected' });
}

export interface UseRotoFramePersistenceCoordinatorInput {
  workflowMode: PhysicsPaintWorkflowMode;
  backgroundMode: BgMode;
  launchContext: PhysicPaintLaunchContext | null;
  latestFramesRef: { current: PhysicPaintRotoCacheFrame[] };
  setLaunchContext: (update: (current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null) => void;
  store: RotoPersistenceStorePort;
  syncPending: () => void;
  getBackgroundMetadata: () => PhysicPaintRotoBackgroundMetadata;
  sendCachePayload: (payload: PhysicPaintApplyPayload) => Promise<void>;
  executePhysicalEdit: (input: RotoGroupFramePaintExecuteInput) => Promise<boolean>;
  createOverrideKeyId?: () => string;
  setApplyMessage: (message: string) => void;
}

/**
 * D-28 / audit finding 6: the 'loop-placeholder' render-source variant is
 * NEVER Paint content. The persistence coordinator explicitly rejects it from
 * every cache pathway — no durable-cache write, no persisted metadata, no
 * cache ownership for that frame. The never-fallback arm keeps a future
 * render-source variant a compile-time error at this consumer (Pitfall 7
 * convention).
 */
export function rejectRotoLoopPlaceholderSource(
  source: PhysicPaintRotoPhysicalRenderSource | null,
): PhysicPaintRotoPhysicalRenderableSource | null {
  if (source === null) return null;
  switch (source.kind) {
    case 'loop-placeholder':
      return null;
    case 'real':
    case 'generated':
      return source;
    default: {
      const exhaustive: never = source;
      throw new Error(`Unhandled Roto physical render-source kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

function recordsAsRuntimeFrames(document: PhysicPaintRotoPhysicalDocument): PhysicPaintRotoCacheFrame[] {
  return document.realKeyRecords.map((record) => ({
    ...record.payload,
    appFrame: record.appFrame,
    source: 'real-key' as const,
    keyId: record.keyId,
    contentRevision: document.revision,
    cacheRevision: `${document.revision}:real:${record.keyId}`,
  }));
}

export function encodeRotoPhysicalLaunchDocument(
  document: PhysicPaintRotoPhysicalDocument,
  layerEndExclusive: number,
) {
  return {
    capacity: document.capacity,
    layerEndExclusive,
    records: document.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame, payload: record.payload })),
    groupOverrideRecords: (document.groupOverrideRecords ?? [])
      .map((record) => ({ keyId: record.keyId, appFrame: record.appFrame, payload: record.payload })),
    interpolationEnabled: document.interpolation.enabled,
    interpolationMode: document.interpolation.mode,
    scriptMotion: document.scriptMotion,
    background: document.background,
    selectedKeyId: document.selectedKeyId,
    cursorAppFrame: document.cursorAppFrame,
    revision: document.revision,
    loopClips: document.loopClips,
    incomingInterpolationBreakKeyIds: document.incomingInterpolationBreakKeyIds,
  };
}

export function useRotoFramePersistenceCoordinator(input: UseRotoFramePersistenceCoordinatorInput) {
  const editBuffer = useRotoEditBufferController<ReturnType<import('@efxlab/efx-physic-paint').EfxPaintEngine['save']>, RenderedFramePayload>();
  const confirmedFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map());
  const livePixelTransactionsRef = useRef(createRotoLivePixelCacheTransactions());
  const parentDeliveryRef = useRef<Map<string, Promise<void>>>(new Map());
  const parentDeliveryErrorRef = useRef<Map<string, unknown>>(new Map());
  const failedParentPayloadRef = useRef<Map<string, { identity: RotoLivePixelIdentity; payload: PhysicPaintApplyPayload }>>(new Map());
  const parentOperationRevisionRef = useRef(0);
  const previousLaunchRef = useRef<{ launchId: string; layerId: string } | null>(null);
  const inputRef = useRef(input);
  inputRef.current = input;

  const queueParentPayload = useCallback((identity: RotoLivePixelIdentity, payload: PhysicPaintApplyPayload, mutationId?: number) => {
    const deliveryKey = `${identity.launchId}:${identity.layerId}:${identity.keyId}`;
    const previous = parentDeliveryRef.current.get(deliveryKey) ?? Promise.resolve();
    const profiling = isPhysicsPaintProfilingEnabled();
    const queuedAt = profiling ? performance.now() : 0;
    const delivery = previous.catch(() => undefined).then(async () => {
      const deliveryStartedAt = profiling ? performance.now() : 0;
      if (profiling) recordPhysicsPaintPerformance({ stage: 'bridge-queue-wait', category: 'scheduled-wait', durationMs: deliveryStartedAt - queuedAt, timestamp: deliveryStartedAt, mutationId, sourceFrame: identity.appFrame });
      const launch = inputRef.current.launchContext;
      const currentRecord = inputRef.current.store.getRotoRealKeyRecord(identity.layerId, identity.keyId);
      const currentRevision = inputRef.current.store.getRotoPhysicalContentRevision(identity.layerId);
      if (!launch
        || launch.operationId !== identity.launchId
        || launch.layerId !== identity.layerId
        || !currentRecord
        || currentRecord.appFrame !== identity.appFrame
        || currentRevision !== identity.contentRevision) return;
      await inputRef.current.sendCachePayload(payload);
      parentDeliveryErrorRef.current.delete(deliveryKey);
      failedParentPayloadRef.current.delete(deliveryKey);
      if (profiling) recordPhysicsPaintPerformance({ stage: 'bridge-delivery', category: 'async-elapsed', durationMs: performance.now() - deliveryStartedAt, timestamp: performance.now(), mutationId, sourceFrame: identity.appFrame });
    }).catch((error) => {
      console.error('[PhysicsPaintStudio] Roto cache delivery failed', error);
      parentDeliveryErrorRef.current.set(deliveryKey, error);
      failedParentPayloadRef.current.set(deliveryKey, { identity, payload });
    });
    parentDeliveryRef.current.set(deliveryKey, delivery);
    void delivery.then(() => {
      if (parentDeliveryRef.current.get(deliveryKey) === delivery) parentDeliveryRef.current.delete(deliveryKey);
    });
  }, []);

  const getCurrentIdentity = useCallback((layerId: string, launchId: string, keyId: string): RotoLivePixelIdentity | null => {
    const launch = inputRef.current.launchContext;
    if (!launch || launch.operationId !== launchId || launch.layerId !== layerId) return null;
    const record = inputRef.current.store.getRotoRealKeyRecord(layerId, keyId);
    const contentRevision = inputRef.current.store.getRotoPhysicalContentRevision(layerId);
    if (!record || !contentRevision) return null;
    return { launchId, layerId, keyId, contentRevision, appFrame: record.appFrame };
  }, []);

  const publishCurrentDocument = useCallback((
    layerId: string,
    launchId: string,
    options?: { preserveRuntimeCaches?: boolean },
  ) => {
    const document = inputRef.current.store.getRotoPhysicalDocument(layerId);
    if (!document) return;
    const frames = recordsAsRuntimeFrames(document);
    inputRef.current.latestFramesRef.current = frames;
    if (!options?.preserveRuntimeCaches) {
      confirmedFramesRef.current = new Map(frames.map((frame) => [frame.appFrame, frame]));
    }
    inputRef.current.setLaunchContext((current) => current
      && current.layerId === layerId
      && current.operationId === launchId
      && current.rotoPhysical
      ? {
          ...current,
          startFrame: document.cursorAppFrame,
          rotoPhysical: encodeRotoPhysicalLaunchDocument(
            document,
            current.rotoPhysical.layerEndExclusive,
          ),
          cachedRotoFrames: frames,
        }
      : current);
  }, []);

  const reference = useRotoReferenceController<RenderedFramePayload>({
    workflowMode: input.workflowMode,
    settingsBackground: input.backgroundMode,
    // D-28: the reference/cache lookup passes through the explicit
    // placeholder rejection arm — a placeholder frame can never become a
    // cached reference, a repaint base, or a durable-cache write.
    getPhysicalRenderSource: (appFrame) => rejectRotoLoopPlaceholderSource(inputRef.current.launchContext
      ? inputRef.current.store.getRotoPhysicalRenderSource(inputRef.current.launchContext.layerId, appFrame)
      : null),
    getPreviewFrames: () => editBuffer.bufferRef.current.previewFrames,
    getDirtyFrames: () => editBuffer.bufferRef.current.dirtyFrames,
    getLiveOverlayActionCounts: () => editBuffer.bufferRef.current.liveOverlayActionCounts,
    syncPending: () => inputRef.current.syncPending(),
    setApplyMessage: (message) => inputRef.current.setApplyMessage(message),
    resolveContentToken: (contentRevision) => inputRef.current.store.resolveContentToken(contentRevision),
  });

  const upsertCachedFrame = useCallback(async (renderedFrame: RenderedFramePayload, backgroundOnly: boolean, _onionFrame?: RenderedFramePayload | null, _interpolationSettings?: PhysicPaintRotoInterpolationSettings, expectedLayerId?: string, mutationId?: number, expectedOperationId?: string, background?: PhysicPaintRotoBackgroundMetadata, expectedKeyId?: string, expectedContentRevision?: string) => {
    const launch = inputRef.current.launchContext;
    const layerId = expectedLayerId ?? launch?.layerId;
    const launchId = expectedOperationId ?? launch?.operationId;
    const projectContextId = launch?.project?.contextId;
    if (!layerId || !launchId || !projectContextId) return false;
    const document = inputRef.current.store.getRotoPhysicalDocument(layerId);
    const contentRevision = expectedContentRevision ?? inputRef.current.store.getRotoPhysicalContentRevision(layerId);
    if (!document || !contentRevision || document.revision !== contentRevision) return false;
    const route = await routeRotoPhysicalPaintFrame({
      document,
      projectContextId,
      layerId,
      launchOperationId: launchId,
      appFrame: renderedFrame.appFrame,
      expectedKeyId,
      renderedPayload: {
        frameIndex: renderedFrame.frameIndex,
        appFrame: renderedFrame.appFrame,
        dataUrl: renderedFrame.dataUrl,
        ...(renderedFrame.width !== undefined ? { width: renderedFrame.width } : {}),
        ...(renderedFrame.height !== undefined ? { height: renderedFrame.height } : {}),
      },
      createOverrideKeyId: inputRef.current.createOverrideKeyId ?? (() => crypto.randomUUID()),
      diagnostics: isPhysicsPaintProfilingEnabled() ? { mutationId, record: recordPhysicsPaintPerformance } : undefined,
    }, {
      updateOrdinaryKey: inputRef.current.store.updateRotoPhysicalRealKeyPayload,
      executePhysicalEdit: inputRef.current.executePhysicalEdit,
    });
    if (!route.ok) return false;
    if (route.kind === 'group-frame') {
      // Group COW publication, cache settlement, canvas reconciliation, and
      // history are all deferred to the matching physical acknowledgement.
      return true;
    }
    const accepted = {
      ...renderedFrame,
      keyId: route.keyId,
      contentRevision: route.contentRevision,
      cacheRevision: `${route.contentRevision}:real:${route.keyId}`,
    };
    confirmedFramesRef.current.set(renderedFrame.appFrame, accepted);
    editBuffer.acceptPixelCache(renderedFrame.appFrame);
    publishCurrentDocument(layerId, launchId);
    const identity: RotoLivePixelIdentity = { launchId, layerId, keyId: route.keyId, contentRevision: route.contentRevision, appFrame: renderedFrame.appFrame };
    queueParentPayload(identity, {
      operationId: `${launchId}:live-pixels:${route.keyId}:${++parentOperationRevisionRef.current}`,
      kind: 'apply-canvas',
      layerId,
      startFrame: renderedFrame.appFrame,
      renderedFrame: accepted,
      ...(backgroundOnly ? { backgroundOnly: true } : {}),
      rotoBackground: background ?? inputRef.current.getBackgroundMetadata(),
    }, mutationId);
    return true;
  }, [editBuffer, publishCurrentDocument, queueParentPayload]);

  const captureLivePixels = useCallback((capture: {
    layerId: string;
    keyId?: string;
    appFrame: number;
    liveAlphaCanvas: HTMLCanvasElement;
    cachedBase: RenderedFramePayload | null;
    size: { width: number; height: number };
    mutationId?: number;
    interpolationSettings?: PhysicPaintRotoInterpolationSettings;
    backgroundOnly?: boolean;
    operationId?: string;
    background?: PhysicPaintRotoBackgroundMetadata;
  }) => {
    const launch = inputRef.current.launchContext;
    const launchId = capture.operationId ?? launch?.operationId;
    if (!launchId) return Promise.resolve(false);
    const document = inputRef.current.store.getRotoPhysicalDocument(capture.layerId);
    const contentRevision = inputRef.current.store.getRotoPhysicalContentRevision(capture.layerId);
    if (!document || !contentRevision || document.revision !== contentRevision) return Promise.resolve(false);
    const identityKey = resolveRotoLivePixelIdentityKey(document, capture.appFrame);
    if (identityKey === null) return Promise.resolve(false);
    const identity: RotoLivePixelIdentity = {
      launchId,
      layerId: capture.layerId,
      keyId: identityKey,
      contentRevision,
      appFrame: capture.appFrame,
    };
    return livePixelTransactionsRef.current.capture({
      identity,
      mutationId: capture.mutationId,
      resolveCurrent: () => {
        const currentDocument = inputRef.current.store.getRotoPhysicalDocument(capture.layerId);
        const currentRevision = inputRef.current.store.getRotoPhysicalContentRevision(capture.layerId);
        if (!currentDocument || currentRevision !== contentRevision) return null;
        const currentIdentityKey = resolveRotoLivePixelIdentityKey(currentDocument, capture.appFrame);
        return currentIdentityKey === identityKey ? identity : null;
      },
      recordPerformance: isPhysicsPaintProfilingEnabled() ? recordPhysicsPaintPerformance : undefined,
      produce: () => capture.cachedBase
        ? mergeCachedRotoAlphaFrame(capture.cachedBase, capture.liveAlphaCanvas, capture.appFrame, capture.size, capture.mutationId)
        : encodeRotoFrameFromCanvas(capture.liveAlphaCanvas, capture.appFrame, capture.size, capture.mutationId),
      commit: (rendered, current) => upsertCachedFrame(
        { ...rendered, appFrame: current.appFrame },
        capture.backgroundOnly === true,
        undefined,
        undefined,
        capture.layerId,
        capture.mutationId,
        launchId,
        capture.background,
        capture.keyId,
        contentRevision,
      ),
    });
  }, [getCurrentIdentity, upsertCachedFrame]);

  const resolveFrameIdentityInput = useCallback((appFrame: number) => {
    const launch = inputRef.current.launchContext;
    if (!launch) return null;
    const document = inputRef.current.store.getRotoPhysicalDocument(launch.layerId);
    if (!document) return null;
    const keyId = resolveRotoLivePixelIdentityKey(document, appFrame);
    return keyId === null
      ? null
      : { launchId: launch.operationId, layerId: launch.layerId, keyId };
  }, []);

  const invalidateLivePixels = useCallback((appFrame: number) => {
    const identity = resolveFrameIdentityInput(appFrame);
    return identity ? livePixelTransactionsRef.current.invalidate(identity) : 0;
  }, [resolveFrameIdentityInput]);

  const removeCachedFrame = useCallback((appFrame: number) => {
    const identity = resolveFrameIdentityInput(appFrame);
    if (identity) livePixelTransactionsRef.current.invalidate(identity);
    confirmedFramesRef.current.delete(appFrame);
    reference.clearCachedRotoReferenceUrl();
  }, [reference.clearCachedRotoReferenceUrl, resolveFrameIdentityInput]);

  const clearCurrentFrame = useCallback((keyId: string, appFrame: number, size: { width: number; height: number }) => {
    const launch = inputRef.current.launchContext;
    if (!launch) return false;
    const record = inputRef.current.store.getRotoRealKeyRecord(launch.layerId, keyId);
    const contentRevision = inputRef.current.store.getRotoPhysicalContentRevision(launch.layerId);
    if (!record || record.appFrame !== appFrame || !contentRevision) return false;
    livePixelTransactionsRef.current.invalidate({ launchId: launch.operationId, layerId: launch.layerId, keyId });
    const blank = buildBlankRotoFrame(size.width, size.height, appFrame);
    void upsertCachedFrame(blank, true, undefined, undefined, launch.layerId, undefined, launch.operationId, inputRef.current.getBackgroundMetadata(), keyId, contentRevision);
    return true;
  }, [upsertCachedFrame]);

  const flushLivePixels = useCallback(async (appFrame?: number): Promise<void> => {
    const identity = appFrame === undefined ? undefined : resolveFrameIdentityInput(appFrame) ?? undefined;
    await livePixelTransactionsRef.current.flush(identity);
    const deliveryKeys = identity ? [`${identity.launchId}:${identity.layerId}:${identity.keyId}`] : [...parentDeliveryRef.current.keys()];
    for (const key of deliveryKeys) {
      await parentDeliveryRef.current.get(key);
      const error = parentDeliveryErrorRef.current.get(key);
      if (error === undefined) continue;
      const failed = failedParentPayloadRef.current.get(key);
      if (!failed) throw error;
      parentDeliveryErrorRef.current.delete(key);
      const currentIdentity = getCurrentIdentity(failed.identity.layerId, failed.identity.launchId, failed.identity.keyId);
      if (!currentIdentity
        || currentIdentity.contentRevision !== failed.identity.contentRevision
        || currentIdentity.appFrame !== failed.identity.appFrame) {
        failedParentPayloadRef.current.delete(key);
        continue;
      }
      queueParentPayload(currentIdentity, failed.payload);
      await parentDeliveryRef.current.get(key);
      if (parentDeliveryErrorRef.current.has(key)) throw parentDeliveryErrorRef.current.get(key);
    }
  }, [getCurrentIdentity, queueParentPayload, resolveFrameIdentityInput]);

  const syncCurrentPhysicalDocument = useCallback((options?: { preserveRuntimeCaches?: boolean }) => {
    const launch = inputRef.current.launchContext;
    if (launch) publishCurrentDocument(launch.layerId, launch.operationId, options);
  }, [publishCurrentDocument]);

  const resetForLaunch = useCallback(() => {
    const previous = previousLaunchRef.current;
    if (previous) livePixelTransactionsRef.current.invalidateLaunch(previous.launchId, previous.layerId);
    const launch = inputRef.current.launchContext;
    previousLaunchRef.current = launch ? { launchId: launch.operationId, layerId: launch.layerId } : null;
    editBuffer.resetForLaunch();
    confirmedFramesRef.current = new Map();
    reference.resetCachedRotoReference();
    if (launch) publishCurrentDocument(launch.layerId, launch.operationId);
  }, [editBuffer, publishCurrentDocument, reference.resetCachedRotoReference]);

  return {
    editBuffer,
    confirmedFramesRef,
    reference,
    upsertCachedFrame,
    captureLivePixels,
    invalidateLivePixels,
    flushLivePixels,
    hasPendingLivePixels: () => livePixelTransactionsRef.current.hasPending() || parentDeliveryRef.current.size > 0 || parentDeliveryErrorRef.current.size > 0,
    removeCachedFrame,
    clearCurrentFrame,
    syncCurrentPhysicalDocument,
    resetForLaunch,
  };
}
