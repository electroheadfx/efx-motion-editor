import type { Result } from './ipc';
import type { Layer } from '../types/layer';
import type { PhysicPaintLaunchContext } from '../types/physicPaint';
import { isPhysicPaintLaunchContext } from '../types/physicPaint';

export const PHYSIC_PAINT_LAUNCH_EVENT = 'physic-paint:launch';

const PHYSIC_PAINT_WINDOW_LABEL = 'efx-physic-paint';
const PHYSIC_PAINT_FALLBACK_PATH = '/physics-paint';

export interface PhysicPaintCanvasSize {
  width?: number;
  height?: number;
}

export interface PhysicPaintOpenRequest {
  layer: Layer | null | undefined;
  frame: number | null | undefined;
  canvas?: PhysicPaintCanvasSize | null;
}

interface TauriWebviewWindow {
  new (label: string, options: Record<string, unknown>): TauriWindowInstance;
  getByLabel?: (label: string) => Promise<TauriWindowInstance | null> | TauriWindowInstance | null;
}

interface TauriWindowInstance {
  setFocus?: () => Promise<void> | void;
  show?: () => Promise<void> | void;
  emit?: (event: string, payload?: unknown) => Promise<void> | void;
  once?: (event: string, handler: (event: unknown) => void) => Promise<() => void> | (() => void) | void;
}

interface TauriEventApi {
  emitTo?: (target: string, event: string, payload?: unknown) => Promise<void>;
}

export function createPhysicPaintLaunchContext(
  layer: Layer,
  frame: number,
  canvas?: PhysicPaintCanvasSize | null,
): PhysicPaintLaunchContext {
  return {
    operationId: `physic-paint-${Date.now()}-${crypto.randomUUID()}`,
    layerId: layer.id,
    layerName: layer.name,
    startFrame: Math.max(0, Math.trunc(frame)),
    ...(isFinitePositiveNumber(canvas?.width) ? { width: canvas.width } : {}),
    ...(isFinitePositiveNumber(canvas?.height) ? { height: canvas.height } : {}),
  };
}

export async function openPhysicPaintCanvas(request: PhysicPaintOpenRequest): Promise<Result<PhysicPaintLaunchContext>> {
  try {
    const validation = validateOpenRequest(request);
    if (!validation.ok) return validation;

    const context = createPhysicPaintLaunchContext(validation.data.layer, validation.data.frame, request.canvas);
    if (!isPhysicPaintLaunchContext(context)) {
      return { ok: false, error: 'Invalid physics paint launch context' };
    }

    const tauriResult = await tryOpenTauriPhysicPaintWindow(context);
    if (tauriResult.ok) return { ok: true, data: context };

    const browserResult = openBrowserFallback(context);
    if (!browserResult.ok) return browserResult;

    return { ok: true, data: context };
  } catch (error) {
    return { ok: false, error: `Could not open physics paint canvas: ${String(error)}` };
  }
}

function validateOpenRequest(request: PhysicPaintOpenRequest): Result<{ layer: Layer; frame: number }> {
  const layer = request.layer;
  if (!layer || layer.type !== 'physic-paint' || layer.source.type !== 'physic-paint') {
    return { ok: false, error: 'Select a physic-paint layer before opening the physics paint canvas' };
  }

  const frame = request.frame;
  if (typeof frame !== 'number' || !Number.isFinite(frame) || frame < 0) {
    return { ok: false, error: 'Select a valid frame before opening the physics paint canvas' };
  }

  return { ok: true, data: { layer, frame: Math.trunc(frame) } };
}

async function tryOpenTauriPhysicPaintWindow(context: PhysicPaintLaunchContext): Promise<Result<null>> {
  if (!isTauriRuntime()) {
    return { ok: false, error: 'Tauri runtime unavailable' };
  }

  try {
    const [{ WebviewWindow }, eventApi] = await Promise.all([
      import('@tauri-apps/api/webviewWindow') as Promise<{ WebviewWindow: TauriWebviewWindow }>,
      import('@tauri-apps/api/event') as Promise<TauriEventApi>,
    ]);

    const existing = await WebviewWindow.getByLabel?.(PHYSIC_PAINT_WINDOW_LABEL);
    if (existing) {
      await existing.show?.();
      await existing.setFocus?.();
      await existing.emit?.(PHYSIC_PAINT_LAUNCH_EVENT, context);
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_LAUNCH_EVENT, context);
      return { ok: true, data: null };
    }

    const url = buildPhysicsPaintUrl(context);
    const win = new WebviewWindow(PHYSIC_PAINT_WINDOW_LABEL, {
      url,
      title: 'EFX Physics Paint',
      width: 1280,
      height: 900,
      minWidth: 960,
      minHeight: 640,
      focus: true,
    });

    await win.once?.('tauri://created', async () => {
      await win.emit?.(PHYSIC_PAINT_LAUNCH_EVENT, context);
      await eventApi.emitTo?.(PHYSIC_PAINT_WINDOW_LABEL, PHYSIC_PAINT_LAUNCH_EVENT, context);
    });

    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

function openBrowserFallback(context: PhysicPaintLaunchContext): Result<null> {
  if (typeof window === 'undefined' || typeof window.open !== 'function') {
    return { ok: false, error: 'No browser window API is available for physics paint canvas' };
  }

  const opened = window.open(buildPhysicsPaintUrl(context), PHYSIC_PAINT_WINDOW_LABEL, 'noopener,noreferrer,width=1280,height=900');
  if (!opened) {
    return { ok: false, error: 'Physics paint window was blocked or could not be opened' };
  }

  opened.focus?.();
  return { ok: true, data: null };
}

function buildPhysicsPaintUrl(context: PhysicPaintLaunchContext): string {
  const encodedContext = encodeURIComponent(JSON.stringify(context));
  const baseUrl = typeof window !== 'undefined' && window.location?.origin
    ? new URL(PHYSIC_PAINT_FALLBACK_PATH, window.location.origin)
    : new URL(PHYSIC_PAINT_FALLBACK_PATH, 'http://localhost');
  baseUrl.searchParams.set('context', encodedContext);
  return `${baseUrl.pathname}${baseUrl.search}`;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isFinitePositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
