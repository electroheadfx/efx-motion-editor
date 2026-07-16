import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { PHYSIC_PAINT_DEFAULT_APPLY_FRAMES, clampPhysicPaintFrameCount, isPhysicPaintLaunchContext } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowMode } from '../view/physicsPaintWorkflowPresentation';
import { getLaunchPlayPreviewFrame, normalizePlayWiggle } from '../play/playFrameTransactions';

export interface PhysicsPaintLaunchStateSetters<Settings> {
  setLaunchContext: (context: PhysicPaintLaunchContext) => void;
  setFramesToApply: (frameCount: number) => void;
  setWorkflowMode: (mode: PhysicsPaintWorkflowMode) => void;
  setLocalPlayPreviewFrame: (frame: number) => void;
  setSavedPlayCacheDirty: (dirty: boolean) => void;
  setPlayWiggle: (wiggle: AnimationWiggleConfig) => void;
  setSettings: (settings: Settings) => void;
}

const nonEmptyParam = (params: URLSearchParams, ...keys: string[]) => {
  for (const key of keys) {
    const value = params.get(key);
    if (value && value.trim().length > 0) return value.trim();
  }
  return null;
};

const appendParams = (target: URLSearchParams, raw: string) => {
  const trimmed = raw.replace(/^[?#]/, '');
  if (!trimmed) return;
  const params = new URLSearchParams(trimmed);
  params.forEach((value, key) => target.set(key, value));
};

export function getLaunchWorkflowMode(context: PhysicPaintLaunchContext | null): PhysicsPaintWorkflowMode {
  if (context?.workflowMode === 'play' || context?.editableSource === 'play') return 'play';
  return 'roto';
}

export function applyPhysicsPaintLaunchContext<Settings>(
  context: PhysicPaintLaunchContext,
  setters: PhysicsPaintLaunchStateSetters<Settings>,
  resolveSettings: (context: PhysicPaintLaunchContext) => Settings | null,
): void {
  setters.setLaunchContext(context);
  setters.setFramesToApply(clampPhysicPaintFrameCount(context.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES));
  setters.setWorkflowMode(getLaunchWorkflowMode(context));
  setters.setLocalPlayPreviewFrame(getLaunchPlayPreviewFrame(context));
  setters.setSavedPlayCacheDirty(getLaunchWorkflowMode(context) === 'play' && context.playCacheStatus !== 'cached');
  setters.setPlayWiggle(normalizePlayWiggle(context.playRenderOptions?.motion ?? context.playMotion));
  const settings = resolveSettings(context);
  if (settings) setters.setSettings(settings);
}

export function parsePhysicsPaintLaunchContext(location: Location): PhysicPaintLaunchContext | null {
  const params = new URLSearchParams(location.search);
  appendParams(params, location.hash);

  const encodedContext = nonEmptyParam(params, 'context');
  if (encodedContext) {
    try {
      const parsed = JSON.parse(encodedContext);
      if (isPhysicPaintLaunchContext(parsed)) return parsed;
    } catch {
      // Continue with flat query/hash parameters.
    }
  }

  const layerId = nonEmptyParam(params, 'layerId', 'layer', 'physicPaintLayerId');
  const operationId = nonEmptyParam(params, 'operationId', 'op', 'requestId');
  const startFrameRaw = nonEmptyParam(params, 'startFrame', 'frame', 'currentFrame');
  const startFrame = Number(startFrameRaw);
  if (!layerId || !operationId || !Number.isInteger(startFrame) || startFrame < 0) return null;

  const width = Number(nonEmptyParam(params, 'width', 'w'));
  const height = Number(nonEmptyParam(params, 'height', 'h'));
  const fps = Number(nonEmptyParam(params, 'fps'));
  const workflowMode = nonEmptyParam(params, 'workflowMode');
  const playStartFrame = Number(nonEmptyParam(params, 'playStartFrame'));
  const playFrameCount = Number(nonEmptyParam(params, 'playFrameCount'));
  const editableSource = nonEmptyParam(params, 'editableSource');
  const previewFrame = Number(nonEmptyParam(params, 'previewFrame'));

  return {
    layerId,
    operationId,
    project: {
      name: nonEmptyParam(params, 'projectName') ?? 'Untitled Project',
      saved: nonEmptyParam(params, 'projectSaved') === 'true',
    },
    startFrame,
    layerName: nonEmptyParam(params, 'layerName', 'name') ?? undefined,
    width: Number.isFinite(width) && width > 0 ? width : undefined,
    height: Number.isFinite(height) && height > 0 ? height : undefined,
    fps: Number.isFinite(fps) && fps > 0 ? fps : undefined,
    workflowMode: workflowMode === 'play' ? 'play' : 'roto',
    playStartFrame: Number.isInteger(playStartFrame) && playStartFrame >= 0 ? playStartFrame : undefined,
    playFrameCount: Number.isInteger(playFrameCount) && playFrameCount > 0 ? playFrameCount : undefined,
    editableSource: editableSource === 'play' ? 'play' : editableSource === 'roto' ? 'roto' : undefined,
    selectedPlayScriptId: nonEmptyParam(params, 'selectedPlayScriptId', 'playScriptId') ?? undefined,
    previewFrame: Number.isInteger(previewFrame) && previewFrame >= 0 ? previewFrame : undefined,
  };
}
