import { useCallback, type MutableRef } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintRotoBackgroundMetadata, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import {
  buildApplyCanvasPayload,
  buildDeleteRotoFramePayload,
  guardRotoFlush,
  guardRotoSaveFrame,
  resolveRotoSaveSourceFrame,
  selectRotoEditableState,
  shouldPersistRotoFrame,
  sortedDirtyRotoFrames,
  type RotoEditableState,
  type RotoFlushOptions,
  type RotoRenderedFrame,
} from '../roto/rotoSaveTransactions';

interface RotoRenderedSave {
  renderedFrame: RotoRenderedFrame;
  backgroundOnly: boolean;
  onionFrame?: RotoRenderedFrame | null;
}

interface RotoRenderedPlan extends RotoRenderedSave {
  cachedRepaint: boolean;
}

export interface RotoSaveControllerInput {
  getActionContext: () => { engine: EfxPaintEngine; launchContext: PhysicPaintLaunchContext; bridgeMode: 'Tauri' | 'Browser fallback' | 'Unavailable' } | null;
  getCurrentFrame: () => number;
  getReadyToApply: () => boolean;
  getCurrentFrameIsGenerated: () => boolean;
  getCachedRepaintFrame: (frame: number) => RotoRenderedFrame | null;
  getEditableState: (frame: number) => RotoEditableState | undefined;
  setEditableState: (frame: number, state: RotoEditableState) => void;
  getCapturedFrame: (frame: number) => RotoRenderedFrame | undefined;
  deleteCapturedFrame: (frame: number) => void;
  setPreviewFrame: (frame: number, renderedFrame: RotoRenderedFrame) => void;
  dirtyFramesRef: MutableRef<Set<number>>;
  flushInFlightRef: MutableRef<Promise<PhysicPaintApplyPayload | null> | null>;
  pendingAdvanceRef: MutableRef<number | null>;
  saveOnLeaveSourceFrameRef: MutableRef<number | null>;
  saveOnLeaveRenderedFrameRef: MutableRef<RotoRenderedSave | null>;
  pendingCachedMergeFrameRef: MutableRef<(RotoRenderedSave & { frame: number }) | null>;
  saveOnLeaveDeleteFrameRef: MutableRef<number | null>;
  resolveSourceFrame: (frame: number) => number;
  getInterpolationSettings: (layerId: string) => PhysicPaintRotoInterpolationSettings;
  getBackgroundMetadata: () => PhysicPaintRotoBackgroundMetadata;
  saveRealKeyAtDisplayFrame: (frame: number) => { sourceFrameOverride: number; interpolationSettings: PhysicPaintRotoInterpolationSettings };
  snapshotCurrentFrame: () => boolean;
  renderFrame: (input: { engine: EfxPaintEngine; editableState: RotoEditableState; capturedFrame?: RotoRenderedFrame; cachedRepaintBase: RotoRenderedFrame | null; frame: number; sourceFrame: number }) => Promise<RotoRenderedPlan>;
  resetBackground: (engine: EfxPaintEngine) => void;
  addEditableFrame: (frame: number) => void;
  removeEditableFrame: (frame: number) => void;
  removeCachedFrame: (frame: number) => void;
  upsertCachedFrame: (save: RotoRenderedSave, interpolationSettings?: PhysicPaintRotoInterpolationSettings) => void;
  setCachedReferenceUrl: (url: string | null) => void;
  restoreCachedRepaintFrame: (frame: RotoRenderedFrame) => void;
  requestSessionFrame: (frame: number) => void;
  getSessionSavingFrame: () => number | null;
  registerPendingApply: (payload: PhysicPaintApplyPayload) => void;
  sendApplyPayload: (payload: PhysicPaintApplyPayload, bridgeMode: 'Tauri' | 'Browser fallback' | 'Unavailable') => Promise<void>;
  startApplyTimeout: (operationId: string) => void;
  syncPendingFrames: () => void;
  setApplyStatus: (status: 'idle' | 'applying' | 'success' | 'error') => void;
  setApplyMessage: (message: string) => void;
  setLastError: (message: string | null) => void;
  setSavingFrame: (frame: number | null) => void;
  now?: () => number;
}

export function useRotoSaveController(input: RotoSaveControllerInput) {
  const flushRotoFrame = useCallback(async (frame: number, options: RotoFlushOptions = {}) => {
    const guard = guardRotoFlush({
      hasActionContext: Boolean(input.getActionContext()),
      frame,
      force: options.force,
      dirty: input.dirtyFramesRef.current.has(frame),
      inFlight: Boolean(input.flushInFlightRef.current),
    });
    if (guard.type === 'in-flight') return input.flushInFlightRef.current;
    if (guard.type !== 'flush') return null;

    const flushPromise = (async () => {
      const actionContext = input.getActionContext();
      if (!actionContext) return null;
      const { engine, launchContext, bridgeMode } = actionContext;
      const liveState = engine.save();
      const { editableState, previousState } = selectRotoEditableState({
        frame,
        currentFrame: input.getCurrentFrame(),
        liveState,
        storedState: input.getEditableState(frame),
      });
      const sourceFrame = resolveRotoSaveSourceFrame(frame, options.sourceFrameOverride, input.resolveSourceFrame(frame));

      if (!editableState || !shouldPersistRotoFrame(editableState)) {
        try {
          input.setApplyStatus('applying');
          input.setApplyMessage('Saving current frame…');
          input.setLastError(null);
          const payload = buildDeleteRotoFramePayload({ launchContext, frame, sourceFrame, now: (input.now ?? Date.now)() });
          input.pendingAdvanceRef.current = options.advanceToFrame ?? null;
          if (input.getSessionSavingFrame() !== frame && options.advanceToFrame !== null && options.advanceToFrame !== undefined) input.requestSessionFrame(options.advanceToFrame);
          input.registerPendingApply(payload);
          options.onPayload?.(payload);
          await input.sendApplyPayload(payload, bridgeMode);
          if (input.saveOnLeaveSourceFrameRef.current === frame) input.saveOnLeaveDeleteFrameRef.current = frame;
          else {
            input.dirtyFramesRef.current.delete(frame);
            input.removeCachedFrame(frame);
          }
          input.syncPendingFrames();
          input.startApplyTimeout(payload.operationId);
          return payload;
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
          input.setApplyStatus('error');
          input.setApplyMessage(message);
          input.setLastError(message);
          input.pendingAdvanceRef.current = null;
          input.saveOnLeaveSourceFrameRef.current = null;
          input.saveOnLeaveRenderedFrameRef.current = null;
          input.pendingCachedMergeFrameRef.current = null;
          input.saveOnLeaveDeleteFrameRef.current = null;
          input.setSavingFrame(null);
          return null;
        }
      }

      try {
        const capturedFrame = input.getCapturedFrame(frame);
        const cachedRepaintBase = input.getCachedRepaintFrame(frame);
        if (!capturedFrame && frame !== input.getCurrentFrame()) engine.load(editableState);
        input.setEditableState(frame, editableState);
        if (!cachedRepaintBase) input.setCachedReferenceUrl(null);
        if (!capturedFrame) input.resetBackground(engine);
        const save = await input.renderFrame({ engine, editableState, capturedFrame, cachedRepaintBase, frame, sourceFrame });
        input.setPreviewFrame(sourceFrame, save.onionFrame ?? save.renderedFrame);
        if (save.backgroundOnly) input.removeEditableFrame(frame);
        else input.addEditableFrame(frame);
        input.setApplyStatus('applying');
        input.setApplyMessage(save.cachedRepaint ? `Merged new paint into frame ${frame}.` : 'Saving current frame…');
        input.setLastError(null);
        const payload = buildApplyCanvasPayload({
          launchContext,
          frame,
          sourceFrame,
          editableState,
          renderedFrame: save.renderedFrame,
          backgroundMetadata: input.getBackgroundMetadata(),
          interpolationSettings: options.rotoInterpolationSettings ?? input.getInterpolationSettings(launchContext.layerId),
          backgroundOnly: save.backgroundOnly,
          onionFrame: save.onionFrame ?? null,
          now: (input.now ?? Date.now)(),
        });
        input.registerPendingApply(payload);
        input.pendingAdvanceRef.current = options.advanceToFrame ?? null;
        if (input.getSessionSavingFrame() !== frame && options.advanceToFrame !== null && options.advanceToFrame !== undefined) input.requestSessionFrame(options.advanceToFrame);
        options.onPayload?.(payload);
        await input.sendApplyPayload(payload, bridgeMode);
        if (input.saveOnLeaveSourceFrameRef.current === frame) input.saveOnLeaveRenderedFrameRef.current = save;
        else {
          input.dirtyFramesRef.current.delete(frame);
          input.deleteCapturedFrame(frame);
          if (save.cachedRepaint) input.pendingCachedMergeFrameRef.current = { frame, ...save };
          else input.upsertCachedFrame(save, options.rotoInterpolationSettings);
        }
        input.syncPendingFrames();
        input.startApplyTimeout(payload.operationId);
        return payload;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const cachedRepaintBase = input.getCachedRepaintFrame(frame);
        const message = cachedRepaintBase
          ? `Could not merge frame ${frame} — edits are still open. ${detail}`
          : `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
        input.setApplyStatus('error');
        input.setApplyMessage(message);
        input.setLastError(message);
        if (cachedRepaintBase) {
          input.setCachedReferenceUrl(null);
          input.restoreCachedRepaintFrame(cachedRepaintBase);
        }
        input.dirtyFramesRef.current.add(frame);
        input.syncPendingFrames();
        input.pendingAdvanceRef.current = null;
        input.saveOnLeaveSourceFrameRef.current = null;
        input.saveOnLeaveRenderedFrameRef.current = null;
        input.saveOnLeaveDeleteFrameRef.current = null;
        input.setSavingFrame(null);
        return null;
      } finally {
        if (previousState) engine.load(previousState);
        input.flushInFlightRef.current = null;
      }
    })();

    input.flushInFlightRef.current = flushPromise;
    return flushPromise;
  }, [input]);

  const saveRotoFrame = useCallback(async (advanceToFrame: number | null = null, options: Pick<RotoFlushOptions, 'onPayload'> = {}) => {
    const currentFrame = input.getCurrentFrame();
    if (!input.getReadyToApply() || !input.getActionContext()) return null;
    const saveTransaction = input.getCurrentFrameIsGenerated() ? null : input.saveRealKeyAtDisplayFrame(currentFrame);
    const snapshotHasLiveOverlay = saveTransaction ? input.snapshotCurrentFrame() : false;
    const guard = guardRotoSaveFrame({
      readyToApply: input.getReadyToApply(),
      hasLaunchContext: Boolean(input.getActionContext()),
      currentFrame,
      generated: input.getCurrentFrameIsGenerated(),
      cachedRepaint: Boolean(input.getCachedRepaintFrame(currentFrame)),
      dirty: input.dirtyFramesRef.current.has(currentFrame),
      snapshotHasLiveOverlay,
    });
    if (guard.type === 'generated') {
      input.setApplyStatus('idle');
      input.setApplyMessage(guard.message);
      return null;
    }
    if (guard.type === 'no-new-paint') {
      input.setApplyStatus('success');
      input.setApplyMessage(guard.message);
      return null;
    }
    if (guard.type !== 'save' || !saveTransaction) return null;
    input.dirtyFramesRef.current.add(currentFrame);
    input.syncPendingFrames();
    return flushRotoFrame(currentFrame, {
      force: true,
      advanceToFrame,
      sourceFrameOverride: saveTransaction.sourceFrameOverride,
      rotoInterpolationSettings: saveTransaction.interpolationSettings,
      onPayload: options.onPayload,
    });
  }, [flushRotoFrame, input]);

  const savePendingRotoFrames = useCallback(async () => {
    input.snapshotCurrentFrame();
    const frames = sortedDirtyRotoFrames(input.dirtyFramesRef.current);
    if (frames.length === 0) return null;
    let lastPayload: PhysicPaintApplyPayload | null = null;
    for (const frame of frames) {
      const payload = await flushRotoFrame(frame, { force: true });
      if (payload) lastPayload = payload;
    }
    return lastPayload;
  }, [flushRotoFrame, input]);

  return { flushRotoFrame, saveRotoFrame, savePendingRotoFrames };
}
