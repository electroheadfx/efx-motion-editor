import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact';
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint';
import { AnimationPlayer } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintLaunchContext } from '../../types/physicPaint';
import { clampPhysicPaintFrameCount, isPhysicPaintLaunchContext, type PhysicPaintRenderedFrame } from '../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT } from '../../lib/physicPaintBridge';
import { PhysicsPaintStudioToolbar, type PhysicsPaintStudioToolbarSettings } from './PhysicsPaintStudioToolbar';
import { downloadPhysicsPaintState, parsePhysicsPaintStateFile } from './physicsPaintSessionFile';
import { buildPhysicsPaintDebugManifest, buildPhysicsPaintStillExport } from './physicsPaintDevExport';
import { getPreviewFps } from './physicsPaintWorkflowState';
import './physicsPaintStudio.css';

const CANVAS_MOUNT_ERROR = 'Unable to mount physics paint canvas: canvas wrapper did not create a canvas';
const DEFAULT_CANVAS_WIDTH = 1000;
const DEFAULT_CANVAS_HEIGHT = 650;

type BridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable';
type ApplyKind = 'apply-canvas' | 'apply-play-canvas';
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';

type RenderedFramePayload = PhysicPaintRenderedFrame;

interface PhysicsPaintActionContext {
  engine: EfxPaintEngine;
  launchContext: PhysicPaintLaunchContext;
  bridgeMode: BridgeMode;
}

interface PhysicPaintApplyPayload {
  operationId: string;
  kind: ApplyKind;
  layerId: string;
  startFrame: number;
  editableState: ReturnType<EfxPaintEngine['save']>;
  renderedFrame?: RenderedFramePayload;
  frameCount?: number;
  frames?: RenderedFramePayload[];
}

interface PhysicPaintApplyResult {
  operationId: string;
  ok?: boolean;
  success?: boolean;
  kind?: ApplyKind;
  frame?: number;
  startFrame?: number;
  count?: number;
  frameCount?: number;
  appliedFrameCount?: number;
  error?: string;
  detail?: string;
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

function parseLaunchContext(location: Location): PhysicPaintLaunchContext | null {
  const params = new URLSearchParams(location.search);
  appendParams(params, location.hash);

  const encodedContext = nonEmptyParam(params, 'context');
  if (encodedContext) {
    try {
      const parsed = JSON.parse(decodeURIComponent(encodedContext));
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
    startFrame,
    layerName: nonEmptyParam(params, 'layerName', 'name') ?? undefined,
    width: Number.isFinite(width) && width > 0 ? width : undefined,
    height: Number.isFinite(height) && height > 0 ? height : undefined,
    fps: Number.isFinite(fps) && fps > 0 ? fps : undefined,
  };
}

async function detectBridgeMode(): Promise<BridgeMode> {
  try {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emit === 'function') return 'Tauri';
  } catch {
    // Browser fallback below is expected outside Tauri.
  }

  if (typeof window !== 'undefined' && (window.opener || typeof window.dispatchEvent === 'function')) {
    return 'Browser fallback';
  }

  return 'Unavailable';
}

async function sendPhysicPaintFrameSyncMessage(frame: number, bridgeMode: BridgeMode): Promise<void> {
  const message = { type: 'physic-paint:seek-frame' as const, frame };
  if (bridgeMode === 'Tauri') {
    try {
      const eventApi = await import('@tauri-apps/api/event');
      await eventApi.emit?.('physic-paint:seek-frame', message);
      await eventApi.emitTo?.('main', 'physic-paint:seek-frame', message);
      return;
    } catch {
      // Browser fallback below keeps development and non-Tauri windows synced.
    }
  }
  window.opener?.postMessage?.(message, '*');
  window.dispatchEvent?.(new MessageEvent('message', { data: message }));
}

async function sendPhysicPaintApplyPayload(payload: PhysicPaintApplyPayload, bridgeMode: BridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emitTo !== 'function') throw new Error('Tauri event emitTo API is unavailable');
    await eventApi.emitTo('main', PHYSIC_PAINT_APPLY_EVENT, payload);
    return;
  }

  if (bridgeMode === 'Browser fallback') {
    const event = new CustomEvent(PHYSIC_PAINT_APPLY_EVENT, { detail: payload });
    let delivered = false;
    try {
      window.opener?.dispatchEvent(event);
      delivered = Boolean(window.opener);
    } catch {
      delivered = false;
    }
    window.dispatchEvent(new CustomEvent(PHYSIC_PAINT_APPLY_EVENT, { detail: payload }));
    if (!delivered && typeof window.dispatchEvent !== 'function') throw new Error('Browser fallback bridge is unavailable');
    return;
  }

  throw new Error('App bridge is not connected');
}

function CanvasMountProbe(props: { width: number; height: number; onEngineReady: (engine: EfxPaintEngine) => void; onCanvasMounted: (mounted: boolean) => void; onNativePenInputReady: (handler: (input: { pressure: number; tiltX?: number; tiltY?: number }) => void) => void }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [mountError, setMountError] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const mounted = Boolean(shellRef.current?.querySelector('canvas'));
      props.onCanvasMounted(mounted);
      if (!mounted) setMountError(CANVAS_MOUNT_ERROR);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div class="demo-canvas-shell" ref={shellRef}>
      <EfxPaintCanvas
        width={props.width}
        height={props.height}
        papers={[
          { name: 'canvas1', url: '/img/paper_1.jpg' },
          { name: 'canvas2', url: '/img/paper_2.jpg' },
          { name: 'canvas3', url: '/img/paper_3.jpg' },
        ]}
        defaultPaper="canvas1"
        class="paint-canvas"
        onNativePenInputReady={props.onNativePenInputReady}
        onEngineReady={(engine) => {
          engine.setTool('paint');
          setMountError(null);
          props.onCanvasMounted(true);
          props.onEngineReady(engine);
        }}
      />
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  );
}

export function PhysicsPaintStudio() {
  const [engine, setEngine] = useState<EfxPaintEngine | null>(null);
  const [canvasMounted, setCanvasMounted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [animFrame, setAnimFrame] = useState(0);
  const [animTotal, setAnimTotal] = useState(0);
  const [launchContext, setLaunchContext] = useState<PhysicPaintLaunchContext | null>(() => parseLaunchContext(window.location));
  const [bridgeMode, setBridgeMode] = useState<BridgeMode>('Unavailable');
  const [lastError, setLastError] = useState<string | null>(null);
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle');
  const [applyMessage, setApplyMessage] = useState<string | null>(null);
  const [framesToApply, setFramesToApply] = useState(120);
  const [settings, setSettings] = useState<PhysicsPaintStudioToolbarSettings>({
    tool: 'paint',
    color: '#103c65',
    size: 6,
    opacity: 100,
    physicsMode: 'local',
  });
  const playerRef = useRef<AnimationPlayer | null>(null);
  const activeOperationIdRef = useRef<string | null>(null);
  const applyTimeoutRef = useRef<number | null>(null);
  const nativePenInputHandlerRef = useRef<((input: { pressure: number; tiltX?: number; tiltY?: number }) => void) | null>(null);

  const canvasWidth = launchContext?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = launchContext?.height ?? DEFAULT_CANVAS_HEIGHT;
  const previewFps = getPreviewFps(launchContext?.fps);
  const actionContext = useMemo<PhysicsPaintActionContext | null>(() => {
    if (!engine || !launchContext) return null;
    return { engine, launchContext, bridgeMode };
  }, [bridgeMode, engine, launchContext]);

  useEffect(() => {
    detectBridgeMode().then(setBridgeMode).catch(() => setBridgeMode('Unavailable'));
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const installTabletPressureListener = async () => {
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen<{ pressure: number; tilt_x: number; tilt_y: number }>('tablet:pressure', (event) => {
          nativePenInputHandlerRef.current?.({
            pressure: event.payload.pressure,
            tiltX: event.payload.tilt_x,
            tiltY: event.payload.tilt_y,
          });
        });
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] native tablet pressure listener unavailable', error);
      }
    };

    void installTabletPressureListener();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const installLaunchListener = async () => {
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen(PHYSIC_PAINT_LAUNCH_EVENT, (event) => {
          if (isPhysicPaintLaunchContext(event.payload)) {
            console.info('[PhysicsPaintStudio] launch context received', event.payload);
            setLaunchContext(event.payload);
            setApplyStatus('idle');
            setApplyMessage(null);
            setLastError(null);
            activeOperationIdRef.current = null;
          } else {
            console.warn('[PhysicsPaintStudio] invalid launch context', event.payload);
          }
        });
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri launch listener unavailable', error);
      }
    };

    void installLaunchListener();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!engine) return;
    playerRef.current = new AnimationPlayer(engine);
    if (launchContext?.editableState) {
      try {
        engine.load(launchContext.editableState);
      } catch (error) {
        console.error('[PhysicsPaintStudio] failed to restore editable state', error);
        setLastError('Could not restore the previous physics paint state for this layer.');
      }
    }
    return () => {
      playerRef.current?.stop();
      playerRef.current = null;
    };
  }, [engine, launchContext?.editableState]);

  useEffect(() => {
    return () => {
      if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current);
    };
  }, []);

  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
    if (!detail || detail.operationId !== activeOperationIdRef.current) return;
    if (applyTimeoutRef.current) {
      window.clearTimeout(applyTimeoutRef.current);
      applyTimeoutRef.current = null;
    }
    activeOperationIdRef.current = null;

    const ok = detail.ok ?? detail.success ?? false;
    if (!ok) {
      const message = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
      const diagnostic = detail.detail || detail.error;
      setApplyStatus('error');
      setApplyMessage(diagnostic ? `${message} ${diagnostic}` : message);
      setLastError(diagnostic ? `${message} ${diagnostic}` : message);
      return;
    }

    setApplyStatus('success');
    setLastError(null);
    if ((detail.kind ?? 'apply-canvas') === 'apply-play-canvas') {
      const count = detail.appliedFrameCount ?? detail.count ?? detail.frameCount ?? framesToApply;
      const frame = detail.startFrame ?? launchContext?.startFrame ?? 0;
      const endFrame = frame + Math.max(0, count - 1);
      setApplyMessage(`Saved play range: ${count} frames from ${frame} to ${endFrame} at ${canvasWidth}×${canvasHeight}.`);
    } else {
      const frame = detail.frame ?? detail.startFrame ?? launchContext?.startFrame ?? 0;
      setApplyMessage(`Applied to frame ${frame}`);
    }
  }, [canvasHeight, canvasWidth, framesToApply, launchContext?.startFrame]);

  useEffect(() => {
    const handleResult = (event: Event) => {
      handleApplyResult((event as CustomEvent<PhysicPaintApplyResult>).detail);
    };

    window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleResult);
    return () => window.removeEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleResult);
  }, [handleApplyResult]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const installApplyResultListener = async () => {
      if (bridgeMode !== 'Tauri') return;
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen(PHYSIC_PAINT_APPLY_RESULT_EVENT, (event) => {
          handleApplyResult(event.payload as PhysicPaintApplyResult);
        });
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri apply-result listener unavailable', error);
      }
    };

    void installApplyResultListener();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [bridgeMode, handleApplyResult]);

  const missingConditions = useMemo(() => {
    const missing: string[] = [];
    if (!engine) missing.push('Engine is still initializing');
    if (!canvasMounted) missing.push('Canvas is still mounting');
    if (!launchContext) missing.push('No app layer context received');
    if (bridgeMode === 'Unavailable') missing.push('App bridge is not connected');
    if (applyStatus === 'applying' || isPlaying) missing.push('Apply operation is still running');
    return missing;
  }, [applyStatus, bridgeMode, canvasMounted, engine, isPlaying, launchContext]);

  const readyToApply = missingConditions.length === 0;

  const playPreview = useCallback((frameCount: number) => {
    if (!playerRef.current) return;
    const safeFrameCount = clampPhysicPaintFrameCount(frameCount);
    setIsPlaying(true);
    setAnimTotal(safeFrameCount);
    setAnimFrame(0);
    setApplyMessage(`Previewing ${safeFrameCount} frames at ${previewFps} fps.`);
    playerRef.current.play({
      frameCount: safeFrameCount,
      fps: previewFps,
      onFrame: (frameIndex) => setAnimFrame(frameIndex),
      onComplete: () => setIsPlaying(false),
    });
  }, [previewFps]);

  const stopPreview = useCallback(() => {
    if (!playerRef.current) return;
    playerRef.current.stop();
    setIsPlaying(false);
  }, []);

  const startApplyTimeout = useCallback((operationId: string) => {
    if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = window.setTimeout(() => {
      if (activeOperationIdRef.current !== operationId) return;
      setApplyStatus('error');
      setApplyMessage('Could not apply physics paint output. The main editor did not return an apply result.');
      setLastError('The main editor did not return an apply result.');
      activeOperationIdRef.current = null;
      applyTimeoutRef.current = null;
    }, 5000);
  }, []);

  const saveRotoFrame = useCallback(async () => {
    if (!actionContext || !readyToApply) return null;
    const { engine, launchContext, bridgeMode } = actionContext;

    try {
      setApplyStatus('applying');
      setApplyMessage('Applying physics paint output...');
      setLastError(null);
      const operationId = `${launchContext.operationId}:canvas:${Date.now()}`;
      activeOperationIdRef.current = operationId;
      const canvas = engine.exportCompositeCanvas();
      const payload: PhysicPaintApplyPayload = {
        operationId,
        kind: 'apply-canvas',
        layerId: launchContext.layerId,
        startFrame: launchContext.startFrame,
        editableState: engine.save(),
        renderedFrame: {
          frameIndex: 0,
          appFrame: launchContext.startFrame,
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
        },
      };
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      return payload;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return null;
    }
  }, [actionContext, readyToApply, startApplyTimeout]);

  const savePlay = useCallback(async () => {
    if (!actionContext || !readyToApply || !playerRef.current) return null;
    const { engine, launchContext, bridgeMode } = actionContext;
    const frameCount = clampPhysicPaintFrameCount(framesToApply);

    try {
      setApplyStatus('applying');
      setApplyMessage('Applying physics paint output...');
      setLastError(null);
      setIsPlaying(true);
      setAnimTotal(frameCount);
      setAnimFrame(0);
      const operationId = `${launchContext.operationId}:play:${Date.now()}`;
      activeOperationIdRef.current = operationId;

      const frames = await new Promise<RenderedFramePayload[]>((resolve, reject) => {
        const captured: RenderedFramePayload[] = [];
        const timeout = window.setTimeout(() => reject(new Error('Timed out while generating physics paint frames')), Math.max(15000, frameCount * 1000));
        playerRef.current?.play({
          frameCount,
          fps: previewFps,
          onFrame: (frameIndex: number, canvas: HTMLCanvasElement) => {
            setAnimFrame(frameIndex);
            captured.push({
              frameIndex,
              appFrame: launchContext.startFrame + frameIndex,
              dataUrl: canvas.toDataURL('image/png'),
              width: canvas.width,
              height: canvas.height,
            });
          },
          onComplete: () => {
            window.clearTimeout(timeout);
            setIsPlaying(false);
            resolve(captured);
          },
        });
      });

      const payload: PhysicPaintApplyPayload = {
        operationId,
        kind: 'apply-play-canvas',
        layerId: launchContext.layerId,
        startFrame: launchContext.startFrame,
        frameCount,
        frames,
        editableState: engine.save(),
      };
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      return payload;
    } catch (error) {
      setIsPlaying(false);
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return null;
    }
  }, [actionContext, framesToApply, previewFps, readyToApply, startApplyTimeout]);

  const navigateToSyncedFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    return true;
  }, [bridgeMode]);

  const saveRotoFrameAndAdvance = useCallback(async () => {
    const payload = await saveRotoFrame();
    if (!payload?.renderedFrame) return;
    const nextFrame = payload.startFrame + 1;
    const synced = await navigateToSyncedFrame(nextFrame);
    if (synced) {
      setApplyMessage(`Saved roto frame ${payload.startFrame}. Advanced to frame ${nextFrame}.`);
    }
  }, [navigateToSyncedFrame, saveRotoFrame]);

  const saveEditableState = useCallback(async () => {
    if (!engine) return;
    try {
      const message = await downloadPhysicsPaintState(engine.save());
      setApplyStatus('success');
      setApplyMessage(message);
      setLastError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    }
  }, [engine]);

  const loadEditableState = useCallback((event: Event) => {
    if (!engine) return;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const state = parsePhysicsPaintStateFile(String(reader.result ?? ''));
        engine.load(state);
        setApplyStatus('success');
        setApplyMessage('Loaded editable JSON state.');
        setLastError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setApplyStatus('error');
        setApplyMessage(message);
        setLastError(message);
      }
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }, [engine]);

  const exportDebugProof = useCallback(() => {
    if (!engine || !launchContext) return;
    try {
      const canvas = engine.exportCompositeCanvas();
      const frame: RenderedFramePayload = {
        frameIndex: 0,
        appFrame: launchContext.startFrame,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      };
      const still = buildPhysicsPaintStillExport(frame);
      const manifest = buildPhysicsPaintDebugManifest({
        layerId: launchContext.layerId,
        operationId: `${launchContext.operationId}:debug:${Date.now()}`,
        startFrame: launchContext.startFrame,
        frameCount: 1,
        frames: [frame],
        fps: previewFps,
      });
      setApplyStatus('success');
      setApplyMessage(`Debug proof ready: ${still.file} and ${manifest.file}.`);
      setLastError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    }
  }, [engine, launchContext, previewFps]);

  const diagnostics = [
    ['Layer', launchContext ? `${launchContext.layerName ? `${launchContext.layerName} / ` : ''}${launchContext.layerId}` : 'No app layer context received'],
    ['Start frame', launchContext ? String(launchContext.startFrame) : 'Unavailable'],
    ['Canvas size', `${canvasWidth} × ${canvasHeight}`],
    ['Engine ready', engine ? 'Ready' : 'Initializing'],
    ['Canvas mounted', canvasMounted ? 'Mounted' : 'Canvas is still mounting'],
    ['Active tool', settings.tool],
    ['Color', settings.color],
    ['Brush size', String(settings.size)],
    ['Opacity', `${settings.opacity}%`],
    ['Physics mode', settings.physicsMode === 'local' ? 'Local' : 'Global/manual'],
    ['Bridge transport mode', bridgeMode],
    ['Last error', lastError ?? 'None'],
  ];

  return (
    <main class="demo-shell">
      <header class="demo-header">
        <h1>EFX Physics Paint Studio</h1>
        <p class="demo-status">Tauri app route / library integration</p>
      </header>
      <CanvasMountProbe
        width={canvasWidth}
        height={canvasHeight}
        onEngineReady={setEngine}
        onCanvasMounted={setCanvasMounted}
        onNativePenInputReady={(handler) => {
          nativePenInputHandlerRef.current = handler;
        }}
      />
      {engine && (
        <PhysicsPaintStudioToolbar
          engine={engine}
          onPlay={(frameCount) => playPreview(frameCount)}
          onStop={stopPreview}
          isPlaying={isPlaying}
          animFrame={animFrame}
          animTotal={animTotal}
          onSettingsChange={setSettings}
          onError={(message) => setLastError(message)}
        />
      )}
      <section class={`diagnostics-panel ${readyToApply ? 'ready' : 'not-ready'}`} aria-live="polite">
        <div class="diagnostics-header">
          <span class={`ready-badge ${readyToApply ? 'ready' : 'not-ready'}`}>
            {readyToApply ? 'Ready to apply' : 'Not ready to apply'}
          </span>
          {applyStatus === 'applying' ? <span class="busy-copy">Applying physics paint output...</span> : null}
          {applyMessage ? <span class={`apply-feedback ${applyStatus}`}>{applyMessage}</span> : null}
        </div>

        {!readyToApply ? (
          <ul class="missing-list">
            {missingConditions.map((condition) => <li key={condition}>{condition}</li>)}
          </ul>
        ) : null}

        <div class="diagnostics-grid">
          {diagnostics.map(([label, value]) => (
            <div class="diagnostic-item" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div class="apply-controls">
          <label for="frames-to-apply">Frames to apply</label>
          <input
            id="frames-to-apply"
            type="number"
            min={1}
            max={600}
            value={framesToApply}
            onInput={(event) => setFramesToApply(clampPhysicPaintFrameCount(Number((event.target as HTMLInputElement).value)))}
          />
          <button class="apply-button" disabled={!readyToApply} onClick={saveRotoFrameAndAdvance}>Save roto frame</button>
          <button class="apply-button" disabled={!readyToApply} onClick={savePlay}>Save play</button>
          <button class="apply-button" disabled={!engine} onClick={saveEditableState}>Save state</button>
          <label class="apply-button" aria-disabled={!engine}>
            Load state
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={loadEditableState} disabled={!engine} />
          </label>
          <button class="apply-button" disabled={!engine || !launchContext} onClick={exportDebugProof}>Export debug proof</button>
        </div>
      </section>
    </main>
  );
}
