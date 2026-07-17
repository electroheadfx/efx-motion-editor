import type { PhysicPaintLaunchContext } from '../../../types/physicPaint';
import { isPhysicPaintLaunchContext } from '../../../types/physicPaint';

export interface PhysicsPaintLaunchStateSetters<Settings> {
  setLaunchContext: (context: PhysicPaintLaunchContext) => void;
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

export function applyPhysicsPaintLaunchContext<Settings>(
  context: PhysicPaintLaunchContext,
  setters: PhysicsPaintLaunchStateSetters<Settings>,
  resolveSettings: (context: PhysicPaintLaunchContext) => Settings | null,
): void {
  setters.setLaunchContext(context);
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

  return {
    layerId,
    operationId,
    project: {
      name: nonEmptyParam(params, 'projectName') ?? 'Untitled Project',
      saved: nonEmptyParam(params, 'projectSaved') === 'true',
      contextId: nonEmptyParam(params, 'projectContextId') ?? operationId,
    },
    startFrame,
    layerName: nonEmptyParam(params, 'layerName', 'name') ?? undefined,
    width: Number.isFinite(width) && width > 0 ? width : undefined,
    height: Number.isFinite(height) && height > 0 ? height : undefined,
    fps: Number.isFinite(fps) && fps > 0 ? fps : undefined,
  };
}
