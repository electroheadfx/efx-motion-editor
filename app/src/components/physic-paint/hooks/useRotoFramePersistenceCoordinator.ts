import { useCallback, useRef } from 'preact/hooks';
import type { BgMode } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import type { PhysicPaintRotoPhysicalDocument, PhysicPaintRotoPhysicalRenderSource, PhysicPaintRotoRealKeyPayload, PhysicPaintRotoRealKeyRecord } from '../roto/physicsPaintRotoPhysicalModel';
import { buildBlankRotoFrame, encodeRotoFrameFromCanvas, type RenderedFramePayload } from '../roto/rotoCanvasFrames';
import { mergeCachedRotoAlphaFrame } from '../roto/physicsPaintRotoAlphaMerge';
import { createRotoLivePixelCacheTransactions, type RotoLivePixelIdentity } from '../roto/rotoLivePixelCacheTransactions';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { useRotoEditBufferController } from './useRotoEditBufferController';
import { useRotoReferenceController } from './useRotoReferenceController';
import { isPhysicsPaintProfilingEnabled, recordPhysicsPaintPerformance } from '../performance/physicsPaintPerformanceTrace';

interface RotoPersistenceStorePort {
  getRotoPhysicalDocument: (layerId: string) => PhysicPaintRotoPhysicalDocument | null;
  getRotoPhysicalContentRevision: (layerId: string) => string | null;
  getRotoRealKeyRecord: (layerId: string, keyId: string) => PhysicPaintRotoRealKeyRecord | null;
  getRotoRealKeyRecordByAppFrame: (layerId: string, appFrame: number) => PhysicPaintRotoRealKeyRecord | null;
  getRotoPhysicalRenderSource: (layerId: string, appFrame: number) => PhysicPaintRotoPhysicalRenderSource | null;
  updateRotoPhysicalRealKeyPayload: (layerId: string, keyId: string, expectedContentRevision: string, payload: PhysicPaintRotoRealKeyPayload, diagnostics?: { mutationId?: number; record: typeof recordPhysicsPaintPerformance }) => { ok: true; changed: boolean; contentRevision: string } | { ok: false; error: string };
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
  setApplyMessage: (message: string) => void;
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

function encodeLaunchPhysical(document: PhysicPaintRotoPhysicalDocument) {
  return {
    capacity: document.capacity,
    records: document.realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame, payload: record.payload })),
    interpolationEnabled: document.interpolation.enabled,
    scriptMotion: document.scriptMotion,
    background: document.background,
    selectedKeyId: document.selectedKeyId,
    cursorAppFrame: document.cursorAppFrame,
    revision: document.revision,
  };
}

export function useRotoFramePersistenceCoordinator(input: UseRotoFramePersistenceCoordinatorInput) {
  const editBuffer = useRotoEditBufferController<ReturnType<import('@efxlab/efx-physic-paint').EfxPaintEngine['save']>, RenderedFramePayload>();
  const confirmedFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map());
  const livePixelTransactionsRef = useRef(createRotoLivePixelCacheTransactions());
  const buffer = editBuffer.bufferRef.current;
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

  const publishCurrentDocument = useCallback((layerId: string, launchId: string) => {
    const document = inputRef.current.store.getRotoPhysicalDocument(layerId);
    if (!document) return;
    const frames = recordsAsRuntimeFrames(document);
    inputRef.current.latestFramesRef.current = frames;
    confirmedFramesRef.current = new Map(frames.map((frame) => [frame.appFrame, frame]));
    inputRef.current.setLaunchContext((current) => current && current.layerId === layerId && current.operationId === launchId
      ? { ...current, startFrame: document.cursorAppFrame, rotoPhysical: encodeLaunchPhysical(document), cachedRotoFrames: frames }
      : current);
  }, []);

  const reference = useRotoReferenceController<RenderedFramePayload>({
    workflowMode: input.workflowMode,
    settingsBackground: input.backgroundMode,
    getPhysicalRenderSource: (appFrame) => inputRef.current.launchContext
      ? inputRef.current.store.getRotoPhysicalRenderSource(inputRef.current.launchContext.layerId, appFrame)
      : null,
    previewFrames: buffer.previewFrames,
    dirtyFrames: buffer.dirtyFrames,
    liveOverlayActionCounts: buffer.liveOverlayActionCounts,
    syncPending: () => inputRef.current.syncPending(),
    setApplyMessage: (message) => inputRef.current.setApplyMessage(message),
  });

  const upsertCachedFrame = useCallback((renderedFrame: RenderedFramePayload, backgroundOnly: boolean, _onionFrame?: RenderedFramePayload | null, _interpolationSettings?: PhysicPaintRotoInterpolationSettings, expectedLayerId?: string, mutationId?: number, expectedOperationId?: string, background?: PhysicPaintRotoBackgroundMetadata, expectedKeyId?: string, expectedContentRevision?: string) => {
    const launch = inputRef.current.launchContext;
    const layerId = expectedLayerId ?? launch?.layerId;
    const launchId = expectedOperationId ?? launch?.operationId;
    if (!layerId || !launchId) return false;
    const record = expectedKeyId
      ? inputRef.current.store.getRotoRealKeyRecord(layerId, expectedKeyId)
      : inputRef.current.store.getRotoRealKeyRecordByAppFrame(layerId, renderedFrame.appFrame);
    const contentRevision = expectedContentRevision ?? inputRef.current.store.getRotoPhysicalContentRevision(layerId);
    if (!record || !contentRevision || record.appFrame !== renderedFrame.appFrame) return false;
    const update = inputRef.current.store.updateRotoPhysicalRealKeyPayload(layerId, record.keyId, contentRevision, {
      frameIndex: renderedFrame.frameIndex,
      appFrame: record.appFrame,
      dataUrl: renderedFrame.dataUrl,
      ...(renderedFrame.width !== undefined ? { width: renderedFrame.width } : {}),
      ...(renderedFrame.height !== undefined ? { height: renderedFrame.height } : {}),
    }, isPhysicsPaintProfilingEnabled() ? { mutationId, record: recordPhysicsPaintPerformance } : undefined);
    if (!update.ok || !update.changed) return false;
    const accepted = {
      ...renderedFrame,
      appFrame: record.appFrame,
      keyId: record.keyId,
      contentRevision: update.contentRevision,
      cacheRevision: `${update.contentRevision}:real:${record.keyId}`,
    };
    confirmedFramesRef.current.set(record.appFrame, accepted);
    editBuffer.acceptPixelCache(record.appFrame);
    publishCurrentDocument(layerId, launchId);
    const identity: RotoLivePixelIdentity = { launchId, layerId, keyId: record.keyId, contentRevision: update.contentRevision, appFrame: record.appFrame };
    queueParentPayload(identity, {
      operationId: `${launchId}:live-pixels:${record.keyId}:${++parentOperationRevisionRef.current}`,
      kind: 'apply-canvas',
      layerId,
      startFrame: record.appFrame,
      renderedFrame: accepted,
      ...(backgroundOnly ? { backgroundOnly: true } : {}),
      rotoBackground: background ?? inputRef.current.getBackgroundMetadata(),
    }, mutationId);
    return true;
  }, [editBuffer, publishCurrentDocument, queueParentPayload]);

  const captureLivePixels = useCallback((capture: {
    layerId: string;
    keyId: string;
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
    const record = inputRef.current.store.getRotoRealKeyRecord(capture.layerId, capture.keyId);
    const contentRevision = inputRef.current.store.getRotoPhysicalContentRevision(capture.layerId);
    if (!record || !contentRevision || record.appFrame !== capture.appFrame) return Promise.resolve(false);
    const identity: RotoLivePixelIdentity = { launchId, layerId: capture.layerId, keyId: record.keyId, contentRevision, appFrame: record.appFrame };
    return livePixelTransactionsRef.current.capture({
      identity,
      mutationId: capture.mutationId,
      resolveCurrent: () => getCurrentIdentity(capture.layerId, launchId, record.keyId),
      recordPerformance: isPhysicsPaintProfilingEnabled() ? recordPhysicsPaintPerformance : undefined,
      produce: () => capture.cachedBase
        ? mergeCachedRotoAlphaFrame(capture.cachedBase, capture.liveAlphaCanvas, record.appFrame, capture.size, capture.mutationId)
        : encodeRotoFrameFromCanvas(capture.liveAlphaCanvas, record.appFrame, capture.size, capture.mutationId),
      commit: (rendered, current) => {
        upsertCachedFrame({ ...rendered, appFrame: current.appFrame }, capture.backgroundOnly === true, undefined, undefined, capture.layerId, capture.mutationId, launchId, capture.background, record.keyId, contentRevision);
      },
    });
  }, [getCurrentIdentity, upsertCachedFrame]);

  const invalidateLivePixels = useCallback((appFrame: number) => {
    const launch = inputRef.current.launchContext;
    if (!launch) return 0;
    const record = inputRef.current.store.getRotoRealKeyRecordByAppFrame(launch.layerId, appFrame);
    return record ? livePixelTransactionsRef.current.invalidate({ launchId: launch.operationId, layerId: launch.layerId, keyId: record.keyId }) : 0;
  }, []);

  const removeCachedFrame = useCallback((appFrame: number) => {
    const launch = inputRef.current.launchContext;
    if (!launch) return;
    const record = inputRef.current.store.getRotoRealKeyRecordByAppFrame(launch.layerId, appFrame);
    if (record) livePixelTransactionsRef.current.invalidate({ launchId: launch.operationId, layerId: launch.layerId, keyId: record.keyId });
    confirmedFramesRef.current.delete(appFrame);
    reference.clearCachedRotoReferenceUrl();
  }, [reference.clearCachedRotoReferenceUrl]);

  const clearCurrentFrame = useCallback((keyId: string, appFrame: number, size: { width: number; height: number }) => {
    const launch = inputRef.current.launchContext;
    if (!launch) return false;
    const record = inputRef.current.store.getRotoRealKeyRecord(launch.layerId, keyId);
    const contentRevision = inputRef.current.store.getRotoPhysicalContentRevision(launch.layerId);
    if (!record || record.appFrame !== appFrame || !contentRevision) return false;
    livePixelTransactionsRef.current.invalidate({ launchId: launch.operationId, layerId: launch.layerId, keyId });
    const blank = buildBlankRotoFrame(size.width, size.height, appFrame);
    return upsertCachedFrame(blank, true, undefined, undefined, launch.layerId, undefined, launch.operationId, inputRef.current.getBackgroundMetadata(), keyId, contentRevision);
  }, [upsertCachedFrame]);

  const flushLivePixels = useCallback(async (appFrame?: number): Promise<void> => {
    const launch = inputRef.current.launchContext;
    const record = launch && appFrame !== undefined ? inputRef.current.store.getRotoRealKeyRecordByAppFrame(launch.layerId, appFrame) : null;
    const identity = launch && record ? { launchId: launch.operationId, layerId: launch.layerId, keyId: record.keyId } : undefined;
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
  }, [getCurrentIdentity, queueParentPayload]);

  const syncCurrentPhysicalDocument = useCallback(() => {
    const launch = inputRef.current.launchContext;
    if (launch) publishCurrentDocument(launch.layerId, launch.operationId);
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
