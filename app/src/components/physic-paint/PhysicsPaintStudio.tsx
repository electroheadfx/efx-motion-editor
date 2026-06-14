import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact';
import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
import { AnimationPlayer, type AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintLaunchContext } from '../../types/physicPaint';
import { PHYSIC_PAINT_DEFAULT_APPLY_FRAMES, clampPhysicPaintFrameCount, isPhysicPaintApplyResultMessage, isPhysicPaintLaunchContext, type PhysicPaintRenderedFrame } from '../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT } from '../../lib/physicPaintBridge';
import { physicPaintStore } from '../../stores/physicPaintStore';
import { downloadPhysicsPaintState, parsePhysicsPaintStateFile } from './physicsPaintSessionFile';
import { buildPhysicsPaintDebugManifest, buildPhysicsPaintStillExport } from './physicsPaintDevExport';
import { clampOnionCount, clampOnionOpacity, getPreviewFps, isPhysicsPaintDevExportEnabled, PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE, type PhysicsPaintOnionState, type PhysicsPaintWorkflowMode } from './physicsPaintWorkflowState';
import { PhysicsPaintRightPanel } from './PhysicsPaintRightPanel';
import { PhysicsPaintToolRail } from './PhysicsPaintToolRail';
import { PhysicsPaintTopBar } from './PhysicsPaintTopBar';
import { PhysicsPaintWorkflowStrip, type PhysicsPaintWorkflowOnionPreviewFrame, type PhysicsPaintWorkflowStripFrameMarker } from './PhysicsPaintWorkflowStrip';
import './physicsPaintStudio.css';

const CANVAS_MOUNT_ERROR = 'Unable to mount physics paint canvas: canvas wrapper did not create a canvas';
const DEFAULT_CANVAS_WIDTH = 1000;
const DEFAULT_CANVAS_HEIGHT = 650;
const DEFAULT_PLAY_WIGGLE: AnimationWiggleConfig = { strokeDeformation: 0, strokePosition: 0 };
type BridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable';
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type RenderedFramePayload = PhysicPaintRenderedFrame;
type SerializedPhysicsPaintProject = ReturnType<EfxPaintEngine['save']>;

type PhysicsPaintStudioSettings = {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  background: BgMode;
  paperGrain: string;
  grainStrength: number;
  edgeDetail: number;
  pickup: number;
  eraseStrength: number;
  smoothing: number;
  spread: number;
  physicsMode: 'local' | null;
  activePhysicsAction: 'last' | 'all' | null;
};

interface PhysicsPaintActionContext {
  engine: EfxPaintEngine;
  launchContext: PhysicPaintLaunchContext;
  bridgeMode: BridgeMode;
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

function getLaunchWorkflowMode(context: PhysicPaintLaunchContext | null): PhysicsPaintWorkflowMode {
  if (context?.workflowMode === 'play' || context?.editableSource === 'play') return 'play';
  return 'roto';
}

function getLaunchPreviewFrame(context: PhysicPaintLaunchContext | null): number {
  const previewFrame = context?.previewFrame;
  if (!Number.isInteger(previewFrame) || previewFrame === undefined || previewFrame < 0) return 0;
  return previewFrame;
}

function normalizePlayWiggle(value: Partial<AnimationWiggleConfig> | null | undefined): AnimationWiggleConfig {
  return {
    strokeDeformation: clampPercentInteger(value?.strokeDeformation),
    strokePosition: clampPercentInteger(value?.strokePosition),
  };
}

function clampPercentInteger(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(numeric)));
}

function getActivePlayStartFrame(context: PhysicPaintLaunchContext, fallbackFrame: number): number {
  return Number.isInteger(context.playStartFrame) && context.playStartFrame !== undefined && context.playStartFrame >= 0
    ? context.playStartFrame
    : fallbackFrame;
}

function withoutRotoGapLimit(context: PhysicPaintLaunchContext): PhysicPaintLaunchContext {
  const next = { ...context };
  delete next.maxPlayFrameCount;
  delete next.maxPlayFrameCountReason;
  return next;
}

function annotatePlayFrameStrokes(state: SerializedPhysicsPaintProject, assignments: Map<number, number>): SerializedPhysicsPaintProject {
  if (assignments.size === 0) return state;
  return {
    ...state,
    strokes: state.strokes.map((stroke, index) => {
      const playFrame = assignments.get(index);
      if (typeof playFrame !== 'number' || !Number.isInteger(playFrame) || playFrame < 0) return stroke;
      return { ...stroke, playFrame };
    }),
  };
}

function applyLaunchContext(
  context: PhysicPaintLaunchContext,
  setLaunchContext: (context: PhysicPaintLaunchContext) => void,
  setFramesToApply: (frameCount: number) => void,
  setWorkflowMode: (mode: PhysicsPaintWorkflowMode) => void,
  setLocalPlayPreviewFrame?: (frame: number) => void,
  setSavedPlayCacheDirty?: (dirty: boolean) => void,
  setPlayWiggle?: (wiggle: AnimationWiggleConfig) => void,
) {
  setLaunchContext(context);
  setFramesToApply(clampPhysicPaintFrameCount(context.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES));
  setWorkflowMode(getLaunchWorkflowMode(context));
  setLocalPlayPreviewFrame?.(getLaunchPreviewFrame(context));
  setSavedPlayCacheDirty?.(getLaunchWorkflowMode(context) === 'play' && context.playCacheStatus !== 'cached');
  setPlayWiggle?.(normalizePlayWiggle(context.playMotion));
}

function parseLaunchContext(location: Location): PhysicPaintLaunchContext | null {
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

  return {
    layerId,
    operationId,
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
    previewFrame: Number.isInteger(Number(nonEmptyParam(params, 'previewFrame'))) && Number(nonEmptyParam(params, 'previewFrame')) >= 0 ? Number(nonEmptyParam(params, 'previewFrame')) : undefined,
  };
}

async function detectBridgeMode(): Promise<BridgeMode> {
  try {
    const eventApi = await import('@tauri-apps/api/event');
    if (typeof eventApi.emit === 'function') return 'Tauri';
  } catch {
    // Browser fallback below is expected outside Tauri.
  }

  if (typeof window !== 'undefined' && window.opener) {
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
    if (!window.opener) throw new Error('Browser fallback bridge is unavailable');
    window.opener.postMessage({ type: PHYSIC_PAINT_APPLY_EVENT, payload }, window.location.origin);
    return;
  }

  throw new Error('App bridge is not connected');
}

function isPhysicsPaintShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return true;
  const tagName = target.tagName.toLowerCase();
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return false;
  if (target.isContentEditable) return false;
  return !Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
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

function hasPhysicsPaintContent(state: ReturnType<EfxPaintEngine['save']>): boolean {
  return state.strokes.length > 0;
}

function addOccupiedRotoFrame(frames: number[], frame: number): number[] {
  return [...new Set([...frames, frame])].sort((a, b) => a - b);
}

function removeOccupiedRotoFrames(frames: number[], removedFrames: number[]): number[] {
  return frames.filter((frame) => !removedFrames.includes(frame));
}

function exportTransparentStrokeCanvas(engine: EfxPaintEngine): HTMLCanvasElement {
  const state = engine.save();
  const background = state.settings.bgMode as BgMode;
  try {
    engine.setBgMode('transparent');
    return engine.exportCompositeCanvas();
  } finally {
    engine.setBgMode(background);
    engine.load(state);
  }
}

function buildRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number): RenderedFramePayload {
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
  };
}

function buildRotoOutputFrame(engine: EfxPaintEngine, appFrame: number): RenderedFramePayload {
  return buildRotoFrameFromCanvas(engine.exportCompositeCanvas(), appFrame);
}

function buildRotoOnionPreviewFrame(engine: EfxPaintEngine, appFrame: number): RenderedFramePayload {
  return buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame);
}

function PhysicsPaintCanvasStack(props: { children: ComponentChildren; cachedPlayPreviewUrl?: string | null; inputDisabled?: boolean; inputDisabledMessage?: string; onionOverlay: ComponentChildren; onInputIntent?: () => void }) {
  const stackRef = useRef<HTMLDivElement>(null);
  const [canvasBounds, setCanvasBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const stack = stackRef.current;
    if (!stack) return;
    const updateCanvasBounds = () => {
      const canvas = stack.querySelector('canvas');
      if (!(canvas instanceof HTMLCanvasElement)) return;
      const stackRect = stack.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      setCanvasBounds({
        left: canvasRect.left - stackRect.left,
        top: canvasRect.top - stackRect.top,
        width: canvasRect.width,
        height: canvasRect.height,
      });
    };
    updateCanvasBounds();
    const resizeObserver = new ResizeObserver(updateCanvasBounds);
    resizeObserver.observe(stack);
    const canvas = stack.querySelector('canvas');
    if (canvas) resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  return (
    <div class="physics-paint-canvas-stack" ref={stackRef} style={{ pointerEvents: props.inputDisabled ? 'none' : undefined }} title={props.inputDisabled ? props.inputDisabledMessage : undefined} onPointerDownCapture={props.onInputIntent}>
      {props.children}
      {canvasBounds ? (
        <div
          class="physics-paint-onion-overlay canvas-region"
          aria-hidden="true"
          style={{ left: canvasBounds.left, top: canvasBounds.top, width: canvasBounds.width, height: canvasBounds.height }}
        >
          {props.cachedPlayPreviewUrl ? <img class="physics-paint-cached-play-preview" src={props.cachedPlayPreviewUrl} alt="" /> : null}
          {props.onionOverlay}
        </div>
      ) : null}
    </div>
  );
}

function makeInitialSettings(): PhysicsPaintStudioSettings {
  return {
    tool: 'paint',
    color: '#103c65',
    size: 6,
    opacity: 100,
    background: 'canvas1',
    paperGrain: 'canvas1',
    grainStrength: 0.45,
    edgeDetail: 4,
    pickup: 0,
    eraseStrength: 50,
    smoothing: 0,
    spread: 50,
    physicsMode: 'local',
    activePhysicsAction: null,
  };
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
  const [framesToApply, setFramesToApply] = useState(() => clampPhysicPaintFrameCount(launchContext?.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES));
  const [settings, setSettings] = useState<PhysicsPaintStudioSettings>(() => makeInitialSettings());
  const [workflowMode, setWorkflowMode] = useState<PhysicsPaintWorkflowMode>(() => getLaunchWorkflowMode(launchContext));
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [onion, setOnion] = useState<PhysicsPaintOnionState>({ enabled: true, previous: true, next: true, count: 1, opacity: 60 });
  const [playWiggle, setPlayWiggle] = useState<AnimationWiggleConfig>(() => normalizePlayWiggle(launchContext?.playMotion ?? DEFAULT_PLAY_WIGGLE));
  const [savedRotoFrames, setSavedRotoFrames] = useState<PhysicsPaintWorkflowStripFrameMarker[]>([]);
  const [occupiedRotoFrames, setOccupiedRotoFrames] = useState<number[]>([]);
  const [latestPlayFrames, setLatestPlayFrames] = useState<RenderedFramePayload[]>([]);
  const [playFramesVersion, setPlayFramesVersion] = useState(0);
  const [localPlayPreviewFrame, setLocalPlayPreviewFrame] = useState(() => getLaunchPreviewFrame(launchContext));
  const [cachedPlayPreviewUrl, setCachedPlayPreviewUrl] = useState<string | null>(null);
  const [savedPlayCacheDirty, setSavedPlayCacheDirty] = useState(false);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const playerRef = useRef<AnimationPlayer | null>(null);
  const rotoFrameStatesRef = useRef<Map<number, ReturnType<EfxPaintEngine['save']>>>(new Map());
  const rotoPreviewFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map());
  const latestPlayFramesRef = useRef<RenderedFramePayload[]>([]);
  const cachedPreviewTimerRef = useRef<number | null>(null);
  const playFrameEditBaselineRef = useRef<{ frame: number; strokeCount: number } | null>(null);
  const playFrameEditAssignmentsRef = useRef<Map<number, number>>(new Map());
  const activeOperationIdRef = useRef<string | null>(null);
  const applyTimeoutRef = useRef<number | null>(null);
  const nativePenInputHandlerRef = useRef<((input: { pressure: number; tiltX?: number; tiltY?: number }) => void) | null>(null);
  const pendingRotoAdvanceRef = useRef<number | null>(null);

  const canvasWidth = launchContext?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = launchContext?.height ?? DEFAULT_CANVAS_HEIGHT;
  const currentFrame = launchContext?.startFrame ?? 0;
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
        const coreApi = await import('@tauri-apps/api/core');
        if (typeof coreApi.invoke === 'function') {
          const storedContext = await coreApi.invoke('get_physics_paint_launch_context');
          if (!disposed && isPhysicPaintLaunchContext(storedContext)) {
            console.info('[PhysicsPaintStudio] launch context fetched', storedContext);
            applyLaunchContext(storedContext, setLaunchContext, setFramesToApply, setWorkflowMode, setLocalPlayPreviewFrame, setSavedPlayCacheDirty, setPlayWiggle);
            setApplyStatus('idle');
            setApplyMessage(null);
            setLastError(null);
            activeOperationIdRef.current = null;
          }
        }

        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen(PHYSIC_PAINT_LAUNCH_EVENT, (event) => {
          if (isPhysicPaintLaunchContext(event.payload)) {
            console.info('[PhysicsPaintStudio] launch context received', event.payload);
            applyLaunchContext(event.payload, setLaunchContext, setFramesToApply, setWorkflowMode, setLocalPlayPreviewFrame, setSavedPlayCacheDirty, setPlayWiggle);
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
      if (cachedPreviewTimerRef.current) window.clearInterval(cachedPreviewTimerRef.current);
    };
  }, []);

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

  const updateSetting = useCallback(<K extends keyof PhysicsPaintStudioSettings>(key: K, value: PhysicsPaintStudioSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const selectTool = useCallback((tool: ToolType, physicsMode: 'local' | null = settings.physicsMode) => {
    if (!engine) return;
    engine.setTool(tool);
    engine.setPhysicsMode(physicsMode);
    setSettings((current) => ({ ...current, tool, physicsMode }));
  }, [engine, settings.physicsMode]);

  const setBrushColor = useCallback((color: string, opacity: number) => {
    if (!engine) return;
    engine.setColorHex(color);
    engine.setBrushOpacity(opacity);
    setSettings((current) => ({ ...current, color, opacity }));
  }, [engine]);

  const setBrushSize = useCallback((size: number) => {
    engine?.setBrushSize(size);
    updateSetting('size', size);
  }, [engine, updateSetting]);

  const setBrushOpacity = useCallback((opacity: number) => {
    engine?.setBrushOpacity(opacity);
    updateSetting('opacity', opacity);
  }, [engine, updateSetting]);

  const setBackground = useCallback((background: BgMode) => {
    engine?.setBgMode(background);
    updateSetting('background', background);
  }, [engine, updateSetting]);

  const setPaperGrain = useCallback((paperGrain: string) => {
    engine?.setPaperGrain(paperGrain);
    updateSetting('paperGrain', paperGrain);
  }, [engine, updateSetting]);

  const setGrainStrength = useCallback((grainStrength: number) => {
    engine?.setEmbossStrength(grainStrength);
    updateSetting('grainStrength', grainStrength);
  }, [engine, updateSetting]);

  const setEdgeDetail = useCallback((edgeDetail: number) => {
    engine?.setEdgeDetail(edgeDetail);
    updateSetting('edgeDetail', edgeDetail);
  }, [engine, updateSetting]);

  const setPickup = useCallback((pickup: number) => {
    engine?.setPickup(pickup);
    updateSetting('pickup', pickup);
  }, [engine, updateSetting]);

  const setSpread = useCallback((spread: number) => {
    engine?.setLocalSpreadStrength(spread);
    updateSetting('spread', spread);
  }, [engine, updateSetting]);

  const setSmoothing = useCallback((smoothing: number) => {
    engine?.setAntiAlias(smoothing);
    updateSetting('smoothing', smoothing);
  }, [engine, updateSetting]);

  const setEraseStrength = useCallback((eraseStrength: number) => {
    engine?.setEraseStrength(eraseStrength);
    updateSetting('eraseStrength', eraseStrength);
  }, [engine, updateSetting]);

  const startPhysics = useCallback((mode: 'last' | 'all') => {
    if (!engine) return;
    setSettings((current) => ({ ...current, activePhysicsAction: mode }));
    engine.startPhysics(mode);
  }, [engine]);

  const stopPhysics = useCallback(() => {
    if (!engine) return;
    setSettings((current) => ({ ...current, activePhysicsAction: null }));
    engine.stopPhysics();
  }, [engine]);

  const undo = useCallback(() => {
    engine?.undo();
  }, [engine]);

  function findCachedPlayPreviewFrame(previewFrame: number): RenderedFramePayload | null {
    if (!launchContext) return null;
    const playStartFrame = getActivePlayStartFrame(launchContext, currentFrame);
    const appFrame = playStartFrame + previewFrame;
    return latestPlayFramesRef.current.find((frame) => frame.appFrame === appFrame)
      ?? launchContext.cachedPlayFrames?.find((frame) => frame.appFrame === appFrame)
      ?? physicPaintStore.getFrame(launchContext.layerId, appFrame);
  }

  function loadCachedPlayPreviewFrame(previewFrame: number): boolean {
    if (!launchContext) return false;
    if (savedPlayCacheDirty) {
      setCachedPlayPreviewUrl(null);
      return false;
    }
    const cachedFrame = findCachedPlayPreviewFrame(previewFrame);
    setCachedPlayPreviewUrl(cachedFrame?.dataUrl ?? null);
    return Boolean(cachedFrame);
  }

  function getCachedPlayFramesForRange(frameCount: number): RenderedFramePayload[] | null {
    if (!launchContext || savedPlayCacheDirty) return null;
    const safeFrameCount = clampPhysicPaintFrameCount(frameCount);
    const frames = Array.from({ length: safeFrameCount }, (_, index) => findCachedPlayPreviewFrame(index));
    return frames.every(Boolean) ? frames as RenderedFramePayload[] : null;
  }

  useEffect(() => {
    if (workflowMode !== 'play') return;
    if (savedPlayCacheDirty) return;
    loadCachedPlayPreviewFrame(localPlayPreviewFrame);
  }, [engine, launchContext, localPlayPreviewFrame, savedPlayCacheDirty, workflowMode]);

  const markSelectedPlayCacheDirty = useCallback(() => {
    if (!launchContext?.selectedPlayScriptId) return;
    setSavedPlayCacheDirty(true);
  }, [launchContext?.selectedPlayScriptId]);

  const capturePendingPlayFrameEdits = useCallback(() => {
    if (!engine || workflowMode !== 'play') return;
    const baseline = playFrameEditBaselineRef.current;
    if (!baseline) return;
    const strokeCount = engine.getStrokeCount();
    for (let index = baseline.strokeCount; index < strokeCount; index += 1) {
      if (!playFrameEditAssignmentsRef.current.has(index)) {
        playFrameEditAssignmentsRef.current.set(index, baseline.frame);
      }
    }
    playFrameEditBaselineRef.current = { frame: baseline.frame, strokeCount };
  }, [engine, workflowMode]);

  const beginPlayFrameEdit = useCallback(() => {
    if (!engine || workflowMode !== 'play') return;
    capturePendingPlayFrameEdits();
    const strokeCount = engine.getStrokeCount();
    playFrameEditBaselineRef.current = { frame: localPlayPreviewFrame, strokeCount };
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
  }, [capturePendingPlayFrameEdits, engine, localPlayPreviewFrame, markSelectedPlayCacheDirty, workflowMode]);

  const updatePlayFrameCount = useCallback((frameCount: number) => {
    const safeFrameCount = clampPhysicPaintFrameCount(frameCount);
    setFramesToApply(safeFrameCount);
    if (workflowMode !== 'play') return;
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setLaunchContext((current) => current ? {
      ...withoutRotoGapLimit(current),
      playFrameCount: safeFrameCount,
      playCacheStatus: 'stale',
      cachedPlayFrames: [],
    } : current);
  }, [markSelectedPlayCacheDirty, workflowMode]);

  const updatePlayWiggle = useCallback((wiggle: AnimationWiggleConfig) => {
    const normalized = normalizePlayWiggle(wiggle);
    setPlayWiggle(normalized);
    if (workflowMode !== 'play') return;
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setLaunchContext((current) => current ? {
      ...withoutRotoGapLimit(current),
      playMotion: normalized,
      playCacheStatus: 'stale',
      cachedPlayFrames: [],
    } : current);
  }, [markSelectedPlayCacheDirty, workflowMode]);

  const clearActiveSource = useCallback(() => {
    if (!engine || !launchContext) return;
    engine.clear();
    if (workflowMode === 'roto') {
      rotoFrameStatesRef.current.delete(currentFrame);
      rotoPreviewFramesRef.current.delete(currentFrame);
      setOccupiedRotoFrames((frames) => frames.filter((frame) => frame !== currentFrame));
      setSavedRotoFrames((frames) => frames.filter((frame) => frame.frame !== currentFrame));
      setApplyStatus('success');
      setApplyMessage(`Cleared roto frame ${currentFrame}.`);
      return;
    }
    latestPlayFramesRef.current = [];
    setLatestPlayFrames([]);
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setApplyStatus('success');
    setApplyMessage(`Cleared Play canvas range ${currentFrame}–${currentFrame + clampPhysicPaintFrameCount(framesToApply) - 1}.`);
  }, [currentFrame, engine, framesToApply, launchContext, markSelectedPlayCacheDirty, workflowMode]);

  const dryPaint = useCallback(() => {
    engine?.forceDry();
  }, [engine]);

  const snapshotCurrentRotoFrame = useCallback(() => {
    if (!engine || !launchContext) return false;
    const appFrame = currentFrame;
    const currentState = engine.save();
    if (!hasPhysicsPaintContent(currentState)) {
      rotoFrameStatesRef.current.delete(appFrame);
      rotoPreviewFramesRef.current.delete(appFrame);
      setOccupiedRotoFrames((frames) => frames.filter((occupiedFrame) => occupiedFrame !== appFrame));
      return false;
    }
    rotoFrameStatesRef.current.set(appFrame, currentState);
    rotoPreviewFramesRef.current.set(appFrame, buildRotoOnionPreviewFrame(engine, appFrame));
    setOccupiedRotoFrames((frames) => addOccupiedRotoFrame(frames, appFrame));
    return true;
  }, [currentFrame, engine, launchContext]);

  const playPreview = useCallback((frameCount: number) => {
    if (!playerRef.current) return;
    const safeFrameCount = clampPhysicPaintFrameCount(frameCount);
    const cachedFrames = getCachedPlayFramesForRange(safeFrameCount);
    if (cachedFrames) {
      if (cachedPreviewTimerRef.current) window.clearInterval(cachedPreviewTimerRef.current);
      let frameIndex = 0;
      setIsPlaying(true);
      setAnimTotal(safeFrameCount);
      setApplyMessage(`Previewing cached ${safeFrameCount} frames at ${previewFps} fps.`);
      const showNextCachedFrame = () => {
        const cachedFrame = cachedFrames[frameIndex];
        setAnimFrame(frameIndex);
        setLocalPlayPreviewFrame(frameIndex);
        setCachedPlayPreviewUrl(cachedFrame.dataUrl);
        frameIndex += 1;
        if (frameIndex >= cachedFrames.length) {
          if (cachedPreviewTimerRef.current) window.clearInterval(cachedPreviewTimerRef.current);
          cachedPreviewTimerRef.current = null;
          setIsPlaying(false);
        }
      };
      showNextCachedFrame();
      if (cachedFrames.length > 1) {
        cachedPreviewTimerRef.current = window.setInterval(showNextCachedFrame, 1000 / previewFps);
      }
      return;
    }

    if (cachedPreviewTimerRef.current) {
      window.clearInterval(cachedPreviewTimerRef.current);
      cachedPreviewTimerRef.current = null;
    }
    setIsPlaying(true);
    setAnimTotal(safeFrameCount);
    setAnimFrame(0);
    setApplyMessage(`Previewing ${safeFrameCount} frames at ${previewFps} fps.`);
    playerRef.current.play({
      frameCount: safeFrameCount,
      fps: previewFps,
      wiggle: playWiggle,
      onFrame: (frameIndex) => setAnimFrame(frameIndex),
      onComplete: () => setIsPlaying(false),
    });
  }, [playWiggle, previewFps]);

  const stopPreview = useCallback(() => {
    if (cachedPreviewTimerRef.current) {
      window.clearInterval(cachedPreviewTimerRef.current);
      cachedPreviewTimerRef.current = null;
    }
    if (!playerRef.current) {
      setIsPlaying(false);
      return;
    }
    playerRef.current.stop();
    setIsPlaying(false);
  }, []);

  const navigateToSyncedFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    if (engine && launchContext) {
      snapshotCurrentRotoFrame();
      const nextState = rotoFrameStatesRef.current.get(frame);
      if (nextState) {
        engine.load(nextState);
      } else {
        engine.clear();
      }
    }
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    return true;
  }, [bridgeMode, engine, launchContext, snapshotCurrentRotoFrame]);

  const previewLocalPlayFrame = useCallback((frame: number) => {
    capturePendingPlayFrameEdits();
    const previewFrame = Math.max(0, Math.trunc(frame));
    setLocalPlayPreviewFrame(previewFrame);
    if (engine && workflowMode === 'play') {
      playFrameEditBaselineRef.current = { frame: previewFrame, strokeCount: engine.getStrokeCount() };
    }
    loadCachedPlayPreviewFrame(previewFrame);
    setApplyMessage(`Previewing Play frame ${previewFrame}.`);
  }, [capturePendingPlayFrameEdits, engine, loadCachedPlayPreviewFrame, workflowMode]);

  const startApplyTimeout = useCallback((operationId: string) => {
    if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = window.setTimeout(() => {
      if (activeOperationIdRef.current !== operationId) return;
      setApplyStatus('error');
      setApplyMessage('Could not apply physics paint output. The main editor did not return an apply result.');
      setLastError('The main editor did not return an apply result.');
      activeOperationIdRef.current = null;
      pendingRotoAdvanceRef.current = null;
      applyTimeoutRef.current = null;
    }, 5000);
  }, []);

  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
    if (!detail || detail.operationId !== activeOperationIdRef.current) return;
    if (applyTimeoutRef.current) {
      window.clearTimeout(applyTimeoutRef.current);
      applyTimeoutRef.current = null;
    }
    activeOperationIdRef.current = null;

    if (!detail.ok) {
      pendingRotoAdvanceRef.current = null;
      const message = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
      const diagnostic = detail.error;
      setApplyStatus('error');
      setApplyMessage(diagnostic ? `${message} ${diagnostic}` : message);
      setLastError(diagnostic ? `${message} ${diagnostic}` : message);
      return;
    }

    setApplyStatus('success');
    setLastError(null);
    if (detail.kind === 'apply-play-canvas') {
      const count = detail.appliedFrameCount;
      const frame = detail.startFrame;
      const endFrame = frame + Math.max(0, count - 1);
      setApplyMessage(`Saved play range: ${count} frames from ${frame} to ${endFrame} at ${canvasWidth}×${canvasHeight}.`);
    } else if (detail.kind === 'convert-play-to-roto') {
      setApplyMessage(`Converted ${detail.appliedFrameCount} Play frames to Roto frames.`);
    } else if (detail.kind === 'convert-roto-to-play') {
      const endFrame = detail.startFrame + Math.max(0, detail.appliedFrameCount - 1);
      setApplyMessage(`Converted Roto frames ${detail.startFrame}–${endFrame} to the current Play canvas source.`);
    } else {
      const frame = detail.startFrame;
      const nextFrame = pendingRotoAdvanceRef.current;
      setSavedRotoFrames((frames) => [
        ...frames.filter((savedFrame) => savedFrame.frame !== frame),
        { frame, saved: true, label: `Frame ${frame}` },
      ].sort((a, b) => a.frame - b.frame));
      pendingRotoAdvanceRef.current = null;
      if (nextFrame !== null) {
        void navigateToSyncedFrame(nextFrame).then((synced) => {
          if (synced) setApplyMessage(`Saved roto frame ${frame}. Advanced to frame ${nextFrame}.`);
        });
      } else {
        setApplyMessage(`Saved roto frame ${frame}.`);
      }
    }
  }, [canvasHeight, canvasWidth, navigateToSyncedFrame]);

  useEffect(() => {
    const handleResult = (event: Event) => {
      handleApplyResult((event as CustomEvent<PhysicPaintApplyResult>).detail);
    };
    const handleMessageResult = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (isPhysicPaintApplyResultMessage(event.data)) handleApplyResult(event.data.payload);
    };

    window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleResult);
    window.addEventListener('message', handleMessageResult);
    return () => {
      window.removeEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleResult);
      window.removeEventListener('message', handleMessageResult);
    };
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

  const saveRotoFrame = useCallback(async (advanceToFrame: number | null = null) => {
    if (!actionContext || !readyToApply) return null;
    const { engine, launchContext, bridgeMode } = actionContext;

    try {
      const editableState = engine.save();
      rotoFrameStatesRef.current.set(currentFrame, editableState);
      const renderedFrame = buildRotoOutputFrame(engine, currentFrame);
      rotoPreviewFramesRef.current.set(currentFrame, buildRotoOnionPreviewFrame(engine, currentFrame));
      setOccupiedRotoFrames((frames) => addOccupiedRotoFrame(frames, currentFrame));
      setApplyStatus('applying');
      setApplyMessage('Applying physics paint output...');
      setLastError(null);
      const operationId = `${launchContext.operationId}:canvas:${Date.now()}`;
      activeOperationIdRef.current = operationId;
      pendingRotoAdvanceRef.current = advanceToFrame;
      const payload: PhysicPaintApplyPayload = {
        operationId,
        kind: 'apply-canvas',
        layerId: launchContext.layerId,
        startFrame: currentFrame,
        editableState,
        renderedFrame,
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
      pendingRotoAdvanceRef.current = null;
      return null;
    }
  }, [actionContext, currentFrame, readyToApply, startApplyTimeout]);

  const savePlay = useCallback(async () => {
    if (!actionContext || !readyToApply || !playerRef.current) return null;
    const { engine, launchContext, bridgeMode } = actionContext;
    const frameCount = clampPhysicPaintFrameCount(framesToApply);
    const playStartFrame = getActivePlayStartFrame(launchContext, currentFrame);
    capturePendingPlayFrameEdits();
    const editableState = annotatePlayFrameStrokes(engine.save(), playFrameEditAssignmentsRef.current);
    engine.load(editableState);

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
          wiggle: playWiggle,
          onFrame: (frameIndex: number, canvas: HTMLCanvasElement) => {
            setAnimFrame(frameIndex);
            captured.push({
              frameIndex,
              appFrame: playStartFrame + frameIndex,
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
        startFrame: playStartFrame,
        frameCount,
        frames,
        editableState,
        playScriptId: launchContext.selectedPlayScriptId,
        playMotion: playWiggle,
      };
      latestPlayFramesRef.current = frames;
      setLatestPlayFrames(frames);
      setCachedPlayPreviewUrl(frames[0]?.dataUrl ?? null);
      setSavedPlayCacheDirty(false);
      setLocalPlayPreviewFrame(0);
      setPlayFramesVersion((version) => version + 1);
      playFrameEditAssignmentsRef.current = new Map();
      playFrameEditBaselineRef.current = null;
      setLaunchContext((current) => current ? {
        ...withoutRotoGapLimit(current),
        workflowMode: 'play',
        editableSource: 'play',
        startFrame: playStartFrame,
        playStartFrame,
        playFrameCount: frameCount,
        selectedPlayScriptId: current.selectedPlayScriptId ?? `play-${playStartFrame}-${frameCount}`,
        playCacheStatus: 'cached',
        playMotion: playWiggle,
        cachedPlayFrames: frames,
        previewFrame: 0,
      } : current);
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      return payload;
    } catch (error) {
      playerRef.current?.stop();
      activeOperationIdRef.current = null;
      setIsPlaying(false);
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return null;
    }
  }, [actionContext, capturePendingPlayFrameEdits, currentFrame, framesToApply, playWiggle, previewFps, readyToApply, startApplyTimeout]);

  const saveRotoFrameAndAdvance = useCallback(async () => {
    if (!launchContext) return;
    await saveRotoFrame(currentFrame + 1);
  }, [currentFrame, launchContext, saveRotoFrame]);

  const saveEditableState = useCallback(async () => {
    if (!engine) return;
    try {
      if (workflowMode === 'play') capturePendingPlayFrameEdits();
      const editableState = workflowMode === 'play'
        ? annotatePlayFrameStrokes(engine.save(), playFrameEditAssignmentsRef.current)
        : engine.save();
      if (workflowMode === 'play') engine.load(editableState);
      const result = await downloadPhysicsPaintState(editableState);
      if (result.status === 'cancelled') {
        setApplyStatus('idle');
        setApplyMessage(result.message);
        setLastError(null);
        return;
      }
      setApplyStatus('success');
      setApplyMessage(result.message);
      setLastError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    }
  }, [capturePendingPlayFrameEdits, engine, workflowMode]);

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
        appFrame: currentFrame,
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      };
      const still = buildPhysicsPaintStillExport(frame);
      const manifest = buildPhysicsPaintDebugManifest({
        layerId: launchContext.layerId,
        operationId: `${launchContext.operationId}:debug:${Date.now()}`,
        startFrame: currentFrame,
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
  }, [currentFrame, engine, launchContext, previewFps]);

  const buildOnionPreviewFrames = useCallback((): PhysicsPaintWorkflowOnionPreviewFrame[] => {
    if (isPlaying || !launchContext) return [];
    const count = clampOnionCount(onion.count);
    const frames: PhysicsPaintWorkflowOnionPreviewFrame[] = [];
    const addFrame = (frame: RenderedFramePayload, source: 'roto' | 'play') => {
      const distance = Math.abs(frame.appFrame - currentFrame);
      if (distance < 1 || distance > count) return;
      frames.push({
        frame: frame.appFrame,
        dataUrl: frame.dataUrl,
        direction: frame.appFrame < currentFrame ? 'previous' : 'next',
        distance,
        source,
      });
    };
    for (const frame of physicPaintStore.getFrames(launchContext.layerId).values()) {
      addFrame(frame, 'roto');
    }
    for (const frame of rotoPreviewFramesRef.current.values()) {
      addFrame(frame, 'roto');
    }
    return frames.sort((a, b) => b.distance - a.distance);
  }, [currentFrame, isPlaying, launchContext, onion.count]);

  const convertPlayToRoto = useCallback(async () => {
    if (!actionContext) return;
    const { engine, launchContext, bridgeMode } = actionContext;
    const frameCount = clampPhysicPaintFrameCount(framesToApply);
    const expectedFrames = Array.from({ length: frameCount }, (_, index) => currentFrame + index);
    const playFramesByAppFrame = new Map(latestPlayFramesRef.current.map((frame) => [frame.appFrame, frame]));
    const hasAllFrames = expectedFrames.every((frame) => playFramesByAppFrame.has(frame));
    if (!hasAllFrames) {
      setApplyStatus('error');
      setApplyMessage(PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE);
      setLastError(PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE);
      return;
    }
    const frames = expectedFrames.map((frame) => playFramesByAppFrame.get(frame)!);
    const operationId = `${launchContext.operationId}:convert-play-to-roto:${Date.now()}`;
    const payload: PhysicPaintApplyPayload = {
      operationId,
      kind: 'convert-play-to-roto',
      layerId: launchContext.layerId,
      startFrame: currentFrame,
      frameCount,
      frames,
      editableState: engine.save(),
    };
    try {
      setApplyStatus('applying');
      setApplyMessage('Applying physics paint output...');
      setLastError(null);
      activeOperationIdRef.current = operationId;
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      expectedFrames.forEach((frame) => {
        const renderedFrame = playFramesByAppFrame.get(frame);
        if (renderedFrame) physicPaintStore.setFrame(launchContext.layerId, frame, renderedFrame);
      });
      setOccupiedRotoFrames((frames) => [...new Set([...frames, ...expectedFrames])].sort((a, b) => a - b));
      setSavedRotoFrames((frames) => [
        ...frames.filter((marker) => !expectedFrames.includes(marker.frame)),
        ...expectedFrames.map((frame) => ({ frame, saved: true, label: `Frame ${frame}` })),
      ].sort((a, b) => a.frame - b.frame));
      latestPlayFramesRef.current = [];
      setLatestPlayFrames([]);
      setWorkflowMode('roto');
    } catch (error) {
      activeOperationIdRef.current = null;
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    }
  }, [actionContext, currentFrame, framesToApply, startApplyTimeout]);

  const convertRotoToPlay = useCallback(async () => {
    if (!actionContext) return;
    const { engine, launchContext, bridgeMode } = actionContext;
    const frameCount = clampPhysicPaintFrameCount(framesToApply);
    const startFrame = currentFrame;
    const endFrame = startFrame + frameCount - 1;
    const operationId = `${launchContext.operationId}:convert-roto-to-play:${Date.now()}`;
    const payload: PhysicPaintApplyPayload = {
      operationId,
      kind: 'convert-roto-to-play',
      layerId: launchContext.layerId,
      startFrame,
      frameCount,
      editableState: engine.save(),
      playScriptId: launchContext.selectedPlayScriptId,
      playMotion: playWiggle,
    };
    try {
      setApplyStatus('applying');
      setApplyMessage('Applying physics paint output...');
      setLastError(null);
      activeOperationIdRef.current = operationId;
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      physicPaintStore.setEditableState(launchContext.layerId, payload.editableState);
      physicPaintStore.removeFrameRange(launchContext.layerId, startFrame, frameCount);
      const convertedFrames = Array.from({ length: frameCount }, (_, index) => startFrame + index);
      setOccupiedRotoFrames((frames) => removeOccupiedRotoFrames(frames, convertedFrames));
      setSavedRotoFrames((frames) => frames.filter((marker) => marker.frame < startFrame || marker.frame > endFrame));
      latestPlayFramesRef.current = [];
      setLatestPlayFrames([]);
      setCachedPlayPreviewUrl(null);
      setSavedPlayCacheDirty(true);
      playFrameEditAssignmentsRef.current = new Map();
      playFrameEditBaselineRef.current = null;
      setLaunchContext((current) => current ? {
        ...withoutRotoGapLimit(current),
        workflowMode: 'play',
        editableSource: 'play',
        startFrame,
        playStartFrame: startFrame,
        playFrameCount: frameCount,
        selectedPlayScriptId: current.selectedPlayScriptId ?? `play-${startFrame}-${frameCount}`,
        playCacheStatus: 'stale',
        playMotion: playWiggle,
        cachedPlayFrames: [],
        previewFrame: 0,
      } : current);
      setWorkflowMode('play');
    } catch (error) {
      activeOperationIdRef.current = null;
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    }
  }, [actionContext, currentFrame, framesToApply, playWiggle, startApplyTimeout]);

  const handlePhysicsPaintKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isPhysicsPaintShortcutTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const meta = event.metaKey || event.ctrlKey;

    if (meta && key === 'z') {
      event.preventDefault();
      undo();
      return;
    }
    if (event.key === 'Escape') {
      if (isPlaying) {
        event.preventDefault();
        stopPreview();
      }
      return;
    }
    if (meta && key === 's') {
      event.preventDefault();
      if (workflowMode === 'play') void savePlay();
      else void saveRotoFrameAndAdvance();
      return;
    }
    if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      event.preventDefault();
      setShortcutsVisible((visible) => !visible);
      return;
    }

    if (workflowMode === 'roto') {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const nextFrame = event.shiftKey
          ? findAdjacentSavedFrame(savedRotoFrames, currentFrame, direction)
          : Math.max(0, currentFrame + direction);
        if (nextFrame !== null) void navigateToSyncedFrame(nextFrame);
        return;
      }
      if (key === 'g') {
        event.preventDefault();
        void navigateToSyncedFrame(currentFrame);
        return;
      }
      if (key === 'o') {
        event.preventDefault();
        setOnion((current) => ({ ...current, enabled: !current.enabled }));
        return;
      }
      if (event.key === '[' || event.key === ']') {
        event.preventDefault();
        setOnion((current) => ({ ...current, count: clampOnionCount(current.count + (event.key === ']' ? 1 : -1)) }));
        return;
      }
      if (meta && event.key === 'Enter') {
        event.preventDefault();
        void saveRotoFrameAndAdvance();
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        clearActiveSource();
        return;
      }
    }

    if (workflowMode === 'play' && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      if (isPlaying) stopPreview();
      else if (!savedPlayCacheDirty && getCachedPlayFramesForRange(framesToApply)) playPreview(framesToApply);
      else void savePlay();
    }
  }, [clearActiveSource, currentFrame, framesToApply, isPlaying, navigateToSyncedFrame, playPreview, savePlay, saveRotoFrameAndAdvance, savedPlayCacheDirty, savedRotoFrames, stopPreview, undo, workflowMode]);

  const onionPreviewFrames = buildOnionPreviewFrames().filter((frame) => (
    (frame.direction === 'previous' && onion.previous) || (frame.direction === 'next' && onion.next)
  ));
  const onionOpacity = clampOnionOpacity(onion.opacity) / 100;
  const missingPlayFramesForConversion = useMemo(() => {
    if (!launchContext) return true;
    const frameCount = clampPhysicPaintFrameCount(framesToApply);
    const playFramesByAppFrame = new Set(latestPlayFramesRef.current.map((frame) => frame.appFrame));
    return Array.from({ length: frameCount }, (_, index) => currentFrame + index).some((frame) => !playFramesByAppFrame.has(frame));
  }, [currentFrame, framesToApply, launchContext, playFramesVersion]);
  const currentPlayCacheStatus = workflowMode === 'play'
    ? savedPlayCacheDirty
      ? 'stale'
      : getCachedPlayFramesForRange(framesToApply)
        ? 'cached'
        : 'missing'
    : null;

  const goToFirstFrame = useCallback(() => {
    void navigateToSyncedFrame(0);
  }, [navigateToSyncedFrame]);

  const goToPreviousFrame = useCallback(() => {
    void navigateToSyncedFrame(Math.max(0, currentFrame - 1));
  }, [currentFrame, navigateToSyncedFrame]);

  const goToNextFrame = useCallback(() => {
    void navigateToSyncedFrame(currentFrame + 1);
  }, [currentFrame, navigateToSyncedFrame]);

  const goToLastFrame = useCallback(() => {
    const highestSavedFrame = savedRotoFrames.reduce((max, frame) => Math.max(max, frame.frame), 0);
    const playEndFrame = latestPlayFrames.reduce((max, frame) => Math.max(max, frame.appFrame), 0);
    void navigateToSyncedFrame(Math.max(currentFrame, highestSavedFrame, playEndFrame, framesToApply - 1));
  }, [currentFrame, framesToApply, latestPlayFrames, navigateToSyncedFrame, savedRotoFrames]);

  const requestWorkflowModeChange = useCallback((targetMode: PhysicsPaintWorkflowMode) => {
    if (targetMode === workflowMode) return;
    setWorkflowMode(targetMode);
  }, [workflowMode]);

  return (
    <main class="demo-shell">
      <section
        class={`physics-paint-studio physics-paint-layout${rightPanelCollapsed ? ' right-panel-collapsed' : ''}`}
        aria-label="EFX Physics Paint Studio"
        tabIndex={0}
        onKeyDown={(event) => handlePhysicsPaintKeyDown(event as unknown as KeyboardEvent)}
      >
        <PhysicsPaintTopBar
          brushSize={settings.size}
          opacity={settings.opacity}
          background={settings.background}
          paperGrain={settings.paperGrain}
          grainStrength={settings.grainStrength}
          ready={readyToApply}
          error={lastError}
          applyStatus={applyStatus}
          applyMessage={applyMessage}
          devExportEnabled={isPhysicsPaintDevExportEnabled(import.meta.env)}
          devExportBusy={applyStatus === 'applying'}
          onBrushSizeChange={setBrushSize}
          onOpacityChange={setBrushOpacity}
          onBackgroundChange={setBackground}
          onPaperGrainChange={setPaperGrain}
          onGrainStrengthChange={setGrainStrength}
          onExportDebugProof={exportDebugProof}
        />

        <PhysicsPaintToolRail
          activeTool={settings.tool}
          physicsMode={settings.physicsMode}
          activePhysicsAction={settings.activePhysicsAction}
          canUndo={Boolean(engine)}
          disabled={!engine}
          onSelectTool={selectTool}
          onUndo={undo}
          onClearFrame={clearActiveSource}
          onPhysicsStart={startPhysics}
          onPhysicsStop={stopPhysics}
          onDryPaint={dryPaint}
        />

        <section class="physics-paint-main physics-paint-canvas-region" aria-label="Physics Paint canvas">
          <PhysicsPaintCanvasStack
            cachedPlayPreviewUrl={cachedPlayPreviewUrl}
            onInputIntent={beginPlayFrameEdit}
            onionOverlay={onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map((frame) => (
              <img
                key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`}
                class={`physics-paint-onion-frame ${frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`}
                src={frame.dataUrl}
                style={{ opacity: Math.max(0.08, onionOpacity - frame.distance * 0.08) }}
                alt=""
              />
            )) : null}
          >
            <CanvasMountProbe
              width={canvasWidth}
              height={canvasHeight}
              onEngineReady={setEngine}
              onCanvasMounted={setCanvasMounted}
              onNativePenInputReady={(handler) => {
                nativePenInputHandlerRef.current = handler;
              }}
            />
          </PhysicsPaintCanvasStack>
        </section>

        {rightPanelCollapsed ? (
          <aside class="physics-paint-right-panel-rail" aria-label="Physics Paint right panel collapsed">
            <button
              type="button"
              class="physics-paint-panel-toggle"
              aria-label="Open brush options panel"
              title="Open brush options panel"
              onClick={() => setRightPanelCollapsed(false)}
            >
              ▸
            </button>
          </aside>
        ) : (
          <div class="physics-paint-right-panel-shell">
            <button
              type="button"
              class="physics-paint-panel-toggle"
              aria-label="Close brush options panel"
              title="Close brush options panel"
              onClick={() => setRightPanelCollapsed(true)}
            >
              ▸
            </button>
            <PhysicsPaintRightPanel
              activeTool={settings.tool}
              color={settings.color}
              opacity={settings.opacity}
              edgeDetail={settings.edgeDetail}
              pickup={settings.pickup}
              spread={settings.spread}
              smoothing={settings.smoothing}
              eraseStrength={settings.eraseStrength}
              physicsMode={settings.physicsMode}
              onion={onion}
              onionDisabled={isPlaying}
              playWiggle={playWiggle}
              onColorChange={setBrushColor}
              onEdgeDetailChange={setEdgeDetail}
              onPickupChange={setPickup}
              onSpreadChange={setSpread}
              onSmoothingChange={setSmoothing}
              onEraseStrengthChange={setEraseStrength}
              onOnionChange={setOnion}
              onPlayWiggleChange={updatePlayWiggle}
              onSaveState={saveEditableState}
              onLoadState={loadEditableState}
            />
          </div>
        )}

        <PhysicsPaintWorkflowStrip
          mode={workflowMode}
          currentFrame={currentFrame}
          startFrame={launchContext?.startFrame ?? 0}
          frameCount={framesToApply}
          currentPreviewFrame={localPlayPreviewFrame}
          maxPlayFrameCount={workflowMode === 'play' ? undefined : launchContext?.maxPlayFrameCount}
          maxPlayFrameCountReason={workflowMode === 'play' ? undefined : launchContext?.maxPlayFrameCountReason}
          playCacheStatus={currentPlayCacheStatus}
          isPlaying={isPlaying}
          ready={readyToApply}
          occupiedRotoFrames={occupiedRotoFrames}
          savedRotoFrames={savedRotoFrames}
          playPublicationSummary={applyStatus === 'success' ? applyMessage : null}
          statusMessage={isPlaying ? `Previewing ${animFrame + 1} / ${animTotal}` : (applyStatus !== 'success' ? applyMessage : null)}
          onion={onion}
          onionPreviewFrames={onionPreviewFrames}
          showOnionHiddenDuringPreview={onion.enabled && isPlaying}
          missingPlayFramesForConversion={missingPlayFramesForConversion}
          onRequestModeChange={requestWorkflowModeChange}
          onSaveRotoFrame={saveRotoFrameAndAdvance}
          onSavePlay={savePlay}
          onFrameCountChange={updatePlayFrameCount}
          onPlayPreview={playPreview}
          onStopPreview={stopPreview}
          onPreviewPlayFrame={previewLocalPlayFrame}
          onNavigateToSyncedFrame={navigateToSyncedFrame}
          onGoToFirstFrame={goToFirstFrame}
          onGoToPreviousFrame={goToPreviousFrame}
          onGoToNextFrame={goToNextFrame}
          onGoToLastFrame={goToLastFrame}
          onInspectPlayFrame={previewLocalPlayFrame}
          onOnionChange={setOnion}
          onConvertPlayToRoto={convertPlayToRoto}
          onConvertRotoToPlay={convertRotoToPlay}
        />

        {shortcutsVisible ? (
          <aside class="physics-paint-shortcuts-help" aria-label="Physics Paint shortcuts">
            <strong>Physics Paint shortcuts</strong>
            <span>Cmd+Z undo · Cmd+S save active workflow · Esc stop preview · ? help</span>
            <span>Roto: arrows navigate · O onion · [ ] onion count · Cmd+Enter save and next · Delete clear frame</span>
            <span>Play: Space/Enter preview · Cmd+S save play</span>
          </aside>
        ) : null}
      </section>
    </main>
  );
}

function findAdjacentSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[], currentFrame: number, direction: -1 | 1): number | null {
  const sorted = markers
    .filter((marker) => marker.saved !== false)
    .map((marker) => marker.frame)
    .sort((a, b) => a - b);
  if (direction < 0) {
    return [...sorted].reverse().find((frame) => frame < currentFrame) ?? null;
  }
  return sorted.find((frame) => frame > currentFrame) ?? null;
}
