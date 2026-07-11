import { useCallback } from 'preact/hooks';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintApplyPayload, PhysicPaintLaunchContext, PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintRenderedFrame } from '../../../types/physicPaint';
import {
  buildRotoToPlayConversionPayload,
  planPlayToRotoConversion,
  transitionPlayToRotoContext,
  transitionRotoToPlayContext,
} from '../roto/rotoPlayConversionTransactions';

type BridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable';
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';

export interface RotoPlayConversionControllerInput<TFrame extends PhysicPaintRenderedFrame> {
  getActionContext: () => { engine: EfxPaintEngine; launchContext: PhysicPaintLaunchContext; bridgeMode: BridgeMode } | null;
  getCurrentFrame: () => number;
  getRequestedFrameCount: () => number;
  getLatestPlayFrames: () => readonly TFrame[];
  getPlayWiggle: () => AnimationWiggleConfig;
  getRenderOptions: () => PhysicPaintPlayRenderOptionsSnapshot;
  registerPendingApply: (payload: PhysicPaintApplyPayload) => void;
  startApplyTimeout: (operationId: string) => void;
  clearActiveApply: () => void;
  sendApplyPayload: (payload: PhysicPaintApplyPayload, bridgeMode: BridgeMode) => Promise<void>;
  getCachedRotoFrames: (layerId: string) => PhysicPaintLaunchContext['cachedRotoFrames'];
  setFrame: (layerId: string, frame: number, renderedFrame: TFrame) => void;
  setEditableState: (layerId: string, state: ReturnType<EfxPaintEngine['save']>) => void;
  removeFrameRange: (layerId: string, startFrame: number, frameCount: number) => void;
  resetLatestPlayFrames: () => void;
  resetPlayPreview: () => void;
  markPlayCacheDirty: () => void;
  resetPlayFrameEdits: () => void;
  setLaunchContext: (update: (current: PhysicPaintLaunchContext | null) => PhysicPaintLaunchContext | null) => void;
  setWorkflowMode: (mode: 'roto' | 'play') => void;
  setApplyStatus: (status: ApplyStatus) => void;
  setApplyMessage: (message: string) => void;
  setLastError: (message: string | null) => void;
  now?: () => number;
}

const APPLYING_MESSAGE = 'Applying physics paint output...';

export function useRotoPlayConversionController<TFrame extends PhysicPaintRenderedFrame>(input: RotoPlayConversionControllerInput<TFrame>) {
  const fail = useCallback((error: unknown) => {
    input.clearActiveApply();
    const detail = error instanceof Error ? error.message : String(error);
    const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
    input.setApplyStatus('error');
    input.setApplyMessage(message);
    input.setLastError(message);
  }, [input]);

  const startApply = useCallback(async (payload: PhysicPaintApplyPayload, bridgeMode: BridgeMode) => {
    input.setApplyStatus('applying');
    input.setApplyMessage(APPLYING_MESSAGE);
    input.setLastError(null);
    input.registerPendingApply(payload);
    await input.sendApplyPayload(payload, bridgeMode);
    input.startApplyTimeout(payload.operationId);
  }, [input]);

  const convertPlayToRoto = useCallback(async () => {
    const actionContext = input.getActionContext();
    if (!actionContext) return;
    const plan = planPlayToRotoConversion({
      launchContext: actionContext.launchContext,
      currentFrame: input.getCurrentFrame(),
      requestedFrameCount: input.getRequestedFrameCount(),
      latestFrames: input.getLatestPlayFrames(),
      editableState: actionContext.engine.save(),
      now: (input.now ?? Date.now)(),
    });
    if (plan.type === 'missing-frames') {
      input.setApplyStatus('error');
      input.setApplyMessage(plan.message);
      input.setLastError(plan.message);
      return;
    }
    try {
      await startApply(plan.payload, actionContext.bridgeMode);
      for (const frame of plan.expectedFrames) {
        const renderedFrame = plan.payload.frames.find((candidate) => candidate.appFrame === frame);
        if (renderedFrame) input.setFrame(actionContext.launchContext.layerId, frame, renderedFrame as TFrame);
      }
      input.setLaunchContext((current) => current
        ? transitionPlayToRotoContext({ context: current, cachedRotoFrames: input.getCachedRotoFrames(current.layerId) })
        : current);
      input.resetLatestPlayFrames();
      input.setWorkflowMode('roto');
    } catch (error) {
      fail(error);
    }
  }, [fail, input, startApply]);

  const convertRotoToPlay = useCallback(async () => {
    const actionContext = input.getActionContext();
    if (!actionContext) return;
    const playWiggle = input.getPlayWiggle();
    const renderOptions = input.getRenderOptions();
    const payload = buildRotoToPlayConversionPayload({
      launchContext: actionContext.launchContext,
      currentFrame: input.getCurrentFrame(),
      requestedFrameCount: input.getRequestedFrameCount(),
      editableState: actionContext.engine.save(),
      playMotion: playWiggle,
      renderOptions,
      now: (input.now ?? Date.now)(),
    });
    try {
      await startApply(payload, actionContext.bridgeMode);
      input.setEditableState(actionContext.launchContext.layerId, payload.editableState);
      input.removeFrameRange(actionContext.launchContext.layerId, payload.startFrame, payload.frameCount);
      input.resetLatestPlayFrames();
      input.resetPlayPreview();
      input.markPlayCacheDirty();
      input.resetPlayFrameEdits();
      input.setLaunchContext((current) => current
        ? transitionRotoToPlayContext({
          context: current,
          startFrame: payload.startFrame,
          frameCount: payload.frameCount,
          playMotion: playWiggle,
          renderOptions,
          cachedRotoFrames: input.getCachedRotoFrames(current.layerId),
        })
        : current);
      input.setWorkflowMode('play');
    } catch (error) {
      fail(error);
    }
  }, [fail, input, startApply]);

  return { convertPlayToRoto, convertRotoToPlay };
}
