import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
import type { AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintRotoBackgroundMetadata } from '../../types/physicPaint';
import { PHYSIC_PAINT_DEFAULT_APPLY_FRAMES, clampPhysicPaintFrameCount, isPhysicPaintApplyResultMessage, isPhysicPaintLaunchContext, type PhysicPaintRenderedFrame, type PhysicPaintRotoCacheFrame, type PhysicPaintRotoInterpolationSettings } from '../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT } from '../../lib/physicPaintBridge';
import { physicPaintStore, registerRotoAlphaCanvasFrame } from '../../stores/physicPaintStore';
import { downloadPhysicsPaintState, parsePhysicsPaintStateFile } from './physicsPaintSessionFile';
import { buildPhysicsPaintDebugManifest, buildPhysicsPaintStillExport } from './physicsPaintDevExport';
import { clampOnionCount, getPreviewFps, getSourceRotoFrameForDisplayFrame, isPhysicsPaintDevExportEnabled, type PhysicsPaintOnionState, type PhysicsPaintWorkflowMode } from './physicsPaintWorkflowState';
import type { RotoKeyUtilityActiveRestore, RotoKeyUtilityTransaction } from './physicsPaintRotoKeyController';
import type { RotoSessionEffect } from './physicsPaintRotoSession';
import { mergeCachedRotoAlphaFrame } from './physicsPaintRotoAlphaMerge';
import { PhysicsPaintRightPanel } from './PhysicsPaintRightPanel';
import { PhysicsPaintToolRail } from './PhysicsPaintToolRail';
import { PhysicsPaintTopBar } from './PhysicsPaintTopBar';
import { PhysicsPaintWorkflowStrip, type PhysicsPaintWorkflowOnionPreviewFrame, type PhysicsPaintWorkflowStripFrameMarker } from './PhysicsPaintWorkflowStrip';
import { useRotoTimelineActions } from './useRotoTimelineActions';
import { useRotoTimelineModel } from './useRotoTimelineModel';
import { selectRealCachedRotoFrames, selectRealCachedRotoSourceFrameNumbers } from './rotoTimelineSelectors';
import { refreshRotoInterpolationCache, removeCachedRotoCacheFrame, upsertCachedRotoCacheFrame } from './rotoCacheTransactions';
import { hydrateRotoLaunchContext, seedRotoLaunchRealKeys } from './rotoLaunchHydration';
import { useRotoKeyUtilities, type RotoKeyUtilitiesInput } from './useRotoKeyUtilities';
import { useRotoCachedPlayback } from './useRotoCachedPlayback';
import { useRotoReferenceController } from './useRotoReferenceController';
import { useRotoApplyLifecycle } from './useRotoApplyLifecycle';
import { useRotoApplyResultController } from './useRotoApplyResultController';
import { useRotoCloseLifecycle } from './useRotoCloseLifecycle';
import { useRotoSaveController } from './useRotoSaveController';
import { useRotoEditBufferController } from './useRotoEditBufferController';
import { usePlayEditCacheController } from './usePlayEditCacheController';
import { getActivePlayStartFrame, getLaunchPlayPreviewFrame, getPlayFrameCountFromAssignments, getPlayFrameEditAssignments, normalizePlayWiggle } from './playFrameTransactions';
import { applyRenderedPlayCache, markPlayLaunchCacheStale, normalizePlayMotionUpdate, resolvePlayFrameCountUpdate, resolvePlayOptionsUpdate } from './playLifecycleTransactions';
import { usePlayPreviewController } from './usePlayPreviewController';
import { useRotoPlayConversionController } from './useRotoPlayConversionController';
import { PhysicsPaintCanvasMount } from './PhysicsPaintCanvasMount';
import { DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT, DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH, getPhysicsPaintWorkingSize, resizePhysicsPaintState } from './physicsPaintCanvasSizing';
import { usePhysicsPaintEngineLifecycle } from './usePhysicsPaintEngineLifecycle';
import './physicsPaintStudio.css';
const DEFAULT_PLAY_WIGGLE: AnimationWiggleConfig = { strokeDeformation: 0, strokePosition: 0 };
const DEFAULT_ONION_STATE: PhysicsPaintOnionState = { enabled: false, previous: true, next: false, count: 1, opacity: 50 };
const ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15] as const;
const PLAY_LIMIT_TOAST_DISMISS_MS = 5000;
type BridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable';
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type RenderedFramePayload = PhysicPaintRenderedFrame & Partial<Pick<PhysicPaintRotoCacheFrame, 'sourceFrame' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame' | 'interpolationT' | 'backgroundOnly' | 'onionDataUrl'>>;
type PreviewBackgroundEngine = EfxPaintEngine & {
  setBackgroundImageUrl: (dataUrl: string) => void;
  resetBackground: () => void;
  setPreviewBaseImageUrl: (dataUrl: string) => void;
  clearPreviewBaseImage: () => void;
};

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

function withoutRotoGapLimit(context: PhysicPaintLaunchContext): PhysicPaintLaunchContext {
  if (context.workflowMode === 'play') return context;
  const next = { ...context };
  delete next.maxPlayFrameCount;
  delete next.maxPlayFrameCountReason;
  return next;
}

function getRotoOnionAnchorDisplayFrame(frame: RenderedFramePayload & Partial<Pick<PhysicPaintRotoCacheFrame, 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame'>>): number {
  return frame.displayFrame ?? frame.appFrame;
}

function applyLaunchContext(
  context: PhysicPaintLaunchContext,
  setLaunchContext: (context: PhysicPaintLaunchContext) => void,
  setFramesToApply: (frameCount: number) => void,
  setWorkflowMode: (mode: PhysicsPaintWorkflowMode) => void,
  setLocalPlayPreviewFrame?: (frame: number) => void,
  setSavedPlayCacheDirty?: (dirty: boolean) => void,
  setPlayWiggle?: (wiggle: AnimationWiggleConfig) => void,
  setSettings?: (settings: PhysicsPaintStudioSettings) => void,
) {
  setLaunchContext(context);
  setFramesToApply(clampPhysicPaintFrameCount(context.playFrameCount ?? PHYSIC_PAINT_DEFAULT_APPLY_FRAMES));
  setWorkflowMode(getLaunchWorkflowMode(context));
  setLocalPlayPreviewFrame?.(getLaunchPlayPreviewFrame(context));
  setSavedPlayCacheDirty?.(getLaunchWorkflowMode(context) === 'play' && context.playCacheStatus !== 'cached');
  setPlayWiggle?.(normalizePlayWiggle(context.playRenderOptions?.motion ?? context.playMotion));
  if (context.playRenderOptions) setSettings?.(applyRenderOptionsSnapshotToSettings(context.playRenderOptions));
  else if (getLaunchWorkflowMode(context) === 'roto' && context.rotoBackground) setSettings?.(applyRotoBackgroundMetadataToSettings(context.rotoBackground));
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

function shouldPersistRotoFrame(state: ReturnType<EfxPaintEngine['save']>): boolean {
  return state.strokes.length > 0 || state.settings.bgMode !== 'transparent';
}

function isBackgroundOnlyRotoFrame(state: ReturnType<EfxPaintEngine['save']>): boolean {
  return state.strokes.length === 0 && state.settings.bgMode !== 'transparent';
}

function addOccupiedRotoFrame(frames: number[], frame: number): number[] {
  return [...new Set([...frames, frame])].sort((a, b) => a - b);
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

function buildRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number, size?: { width: number; height: number }): RenderedFramePayload {
  const outputCanvas = size ? drawCanvasAtSize(canvas, size) : canvas;
  const dataUrl = outputCanvas.toDataURL('image/png');
  registerRotoAlphaCanvasFrame(dataUrl, outputCanvas);
  return {
    frameIndex: 0,
    appFrame,
    dataUrl,
    width: outputCanvas.width,
    height: outputCanvas.height,
  };
}

function drawCanvasAtSize(canvas: HTMLCanvasElement, size: { width: number; height: number }): HTMLCanvasElement {
  if (canvas.width === size.width && canvas.height === size.height) return canvas;
  const output = document.createElement('canvas');
  output.width = size.width;
  output.height = size.height;
  const context = output.getContext('2d');
  context?.drawImage(canvas, 0, 0, size.width, size.height);
  return output;
}

function buildBlankRotoFrame(width: number, height: number, appFrame: number): RenderedFramePayload {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return buildRotoFrameFromCanvas(canvas, appFrame);
}

function buildRotoOutputFrame(engine: EfxPaintEngine, appFrame: number, width: number, height: number): RenderedFramePayload {
  return buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame, { width, height });
}

function getOnionFrameOpacity(distance: number): number {
  return ONION_DEPTH_OPACITY[Math.max(0, Math.min(ONION_DEPTH_OPACITY.length - 1, distance - 1))];
}

function PhysicsPaintCanvasStack(props: { children: ComponentChildren; cachedPlayPreviewUrl?: string | null; cachedRotoReferenceUrl?: string | null; cachedRotoPlaybackUrl?: string | null; inputDisabled?: boolean; inputDisabledMessage?: string; onionOverlay: ComponentChildren; onInputIntent?: () => void }) {
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
          {props.cachedRotoReferenceUrl ? <img class="physics-paint-cached-roto-reference" src={props.cachedRotoReferenceUrl} alt="" /> : null}
          {props.cachedPlayPreviewUrl ? <img class="physics-paint-cached-play-preview" src={props.cachedPlayPreviewUrl} alt="" /> : null}
          {props.cachedRotoPlaybackUrl ? <img class="physics-paint-cached-play-preview" src={props.cachedRotoPlaybackUrl} alt="" /> : null}
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

function getRenderTool(settings: PhysicsPaintStudioSettings): PhysicPaintPlayRenderOptionsSnapshot['tool'] {
  if (settings.tool === 'erase') return 'erase';
  return settings.physicsMode === 'local' ? 'physics-paint' : 'normal-paint';
}

function buildPlayRenderOptionsSnapshot(settings: PhysicsPaintStudioSettings, motion: AnimationWiggleConfig): PhysicPaintPlayRenderOptionsSnapshot {
  return {
    tool: getRenderTool(settings),
    color: settings.color,
    opacity: settings.opacity,
    brushSize: settings.size,
    background: settings.background,
    paperGrain: settings.paperGrain,
    grainStrength: settings.grainStrength,
    motion: normalizePlayWiggle(motion),
  };
}

function buildRotoBackgroundMetadata(settings: PhysicsPaintStudioSettings): PhysicPaintRotoBackgroundMetadata {
  const background = settings.background === 'photo' ? 'transparent' : settings.background;
  return {
    background,
    paperGrain: settings.paperGrain,
    grainStrength: settings.grainStrength,
    ...(background === 'white' ? { color: '#ffffff' } : {}),
  };
}

function applyRenderOptionsSnapshotToSettings(snapshot: PhysicPaintPlayRenderOptionsSnapshot): PhysicsPaintStudioSettings {
  return {
    ...makeInitialSettings(),
    tool: snapshot.tool === 'erase' ? 'erase' : 'paint',
    physicsMode: snapshot.tool === 'physics-paint' ? 'local' : null,
    color: snapshot.color,
    opacity: snapshot.opacity,
    size: snapshot.brushSize,
    background: snapshot.background,
    paperGrain: snapshot.paperGrain,
    grainStrength: snapshot.grainStrength,
  };
}

function applyRotoBackgroundMetadataToSettings(metadata: PhysicPaintRotoBackgroundMetadata): PhysicsPaintStudioSettings {
  return {
    ...makeInitialSettings(),
    background: metadata.background,
    paperGrain: metadata.paperGrain,
    grainStrength: metadata.grainStrength,
  };
}

export function PhysicsPaintStudio() {
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
  const [onion, setOnion] = useState<PhysicsPaintOnionState>(DEFAULT_ONION_STATE);
  const [playWiggle, setPlayWiggle] = useState<AnimationWiggleConfig>(() => normalizePlayWiggle(launchContext?.playMotion ?? DEFAULT_PLAY_WIGGLE));
  const rotoEditBuffer = useRotoEditBufferController<ReturnType<EfxPaintEngine['save']>, RenderedFramePayload>();
  const editableRotoFrames = rotoEditBuffer.editableFrames;
  const rotoFrameStatesRef = { get current() { return rotoEditBuffer.bufferRef.current.frameStates; }, set current(states) { rotoEditBuffer.replaceFrameStates(states); } };
  const rotoPreviewFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.previewFrames; }, set current(frames) { rotoEditBuffer.replacePreviewFrames(frames); } };
  const rotoCapturedFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.capturedFrames; } };
  const liveRotoOverlayActionCountRef = { get current() { return rotoEditBuffer.bufferRef.current.liveOverlayActionCounts; } };
  const dirtyRotoFramesRef = { get current() { return rotoEditBuffer.bufferRef.current.dirtyFrames; }, set current(frames) { rotoEditBuffer.replaceDirtyFrames(frames); } };
  const [rotoSavingFrame, setRotoSavingFrame] = useState<number | null>(null);
  const [playLimitToast, setPlayLimitToast] = useState<string | null>(null);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const confirmedCachedRotoFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map());
  const workflowModeRef = useRef<PhysicsPaintWorkflowMode>(workflowMode);
  const pendingRotoKeyActionMessageRef = useRef<string | null>(null);
  const closeGuardBypassRef = useRef(false);
  const saveOnLeaveRenderedFrameRef = useRef<{ renderedFrame: RenderedFramePayload; backgroundOnly: boolean; onionFrame?: RenderedFramePayload | null } | null>(null);
  const pendingCachedRotoMergeFrameRef = useRef<{ frame: number; renderedFrame: RenderedFramePayload; backgroundOnly: boolean; onionFrame?: RenderedFramePayload | null } | null>(null);
  const saveOnLeaveDeleteFrameRef = useRef<number | null>(null);
  const rotoKeyUtilitiesExternalRef = useRef<(Pick<RotoKeyUtilitiesInput<ReturnType<EfxPaintEngine['save']>, RenderedFramePayload>, 'syncRotoKeyFrameLists' | 'applyRotoKeyFrames' | 'persistRotoKeyFrameTransaction' | 'handleSaveFrameEffect' | 'restoreFrame' | 'clearCanvas' | 'navigate' | 'clearCachedReferenceFrame'> & { resetSession: () => void }) | null>(null);
  const rotoFlushInFlightRef = useRef<Promise<PhysicPaintApplyPayload | null> | null>(null);
  const resetRotoCachedPlaybackRef = useRef<() => void>(() => {});
  const syncPendingRotoFrames = useCallback(() => {
    rotoKeyUtilitiesExternalRef.current?.resetSession();
  }, []);
  const {
    activeOperationIdRef,
    pendingApplyRef,
    closeAfterApplyOperationIdRef,
    closeAfterRotoSaveRequestedRef,
    pendingRotoAdvanceRef,
    saveOnLeaveSourceFrameRef,
    registerPendingApply,
    clearActiveApply,
    matchApplyResult,
    startApplyTimeout,
  } = useRotoApplyLifecycle({
    onTimeout: (transition) => {
      setApplyStatus('error');
      setApplyMessage(transition.message);
      setLastError(transition.message);
      if (transition.saveOnLeaveSourceFrame !== null) {
        dirtyRotoFramesRef.current.add(transition.saveOnLeaveSourceFrame);
        syncPendingRotoFrames();
      }
      saveOnLeaveRenderedFrameRef.current = null;
      pendingCachedRotoMergeFrameRef.current = null;
      saveOnLeaveDeleteFrameRef.current = null;
      setRotoSavingFrame(null);
      if (transition.closeFailed) {
        setRotoClosePromptState('error');
        setRotoClosePromptMessage(transition.closeMessage);
        closeAfterApplyOperationIdRef.current = null;
      }
      pendingRotoKeyActionMessageRef.current = null;
    },
  });

  const projectCanvasWidth = launchContext?.width ?? DEFAULT_PHYSICS_PAINT_CANVAS_WIDTH;
  const projectCanvasHeight = launchContext?.height ?? DEFAULT_PHYSICS_PAINT_CANVAS_HEIGHT;
  const workingCanvasSize = getPhysicsPaintWorkingSize(projectCanvasWidth, projectCanvasHeight);
  const canvasWidth = workingCanvasSize.width;
  const canvasHeight = workingCanvasSize.height;
  const paperTextureScale = canvasWidth / projectCanvasWidth;
  const canvasKey = `${canvasWidth}x${canvasHeight}`;
  const {
    engine,
    engineRef,
    canvasMounted,
    setCanvasMounted,
    handleEngineReady,
    handleNativePenInputReady,
  } = usePhysicsPaintEngineLifecycle({
    canvasKey,
    canvasWidth,
    canvasHeight,
    launchContext,
    setLastError,
    clearExternalState: () => {
      pendingRotoAdvanceRef.current = null;
      saveOnLeaveSourceFrameRef.current = null;
      saveOnLeaveRenderedFrameRef.current = null;
      saveOnLeaveDeleteFrameRef.current = null;
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      closeGuardBypassRef.current = false;
      pendingCachedRotoMergeFrameRef.current = null;
    },
  });
  const currentFrame = launchContext?.startFrame ?? 0;
  const previewFps = getPreviewFps(launchContext?.fps);
  const actionContext = useMemo<PhysicsPaintActionContext | null>(() => {
    if (!engine || !launchContext) return null;
    return { engine, launchContext, bridgeMode };
  }, [bridgeMode, engine, launchContext]);
  const playEditCache = usePlayEditCacheController<RenderedFramePayload>({
    launchContext,
    currentFrame,
    workflowMode,
    engine,
    getStoredFrame: (layerId, appFrame) => physicPaintStore.getFrame(layerId, appFrame),
    setApplyMessage,
  });
  const {
    latestFrames: latestPlayFrames,
    latestFramesRef: latestPlayFramesRef,
    framesVersion: playFramesVersion,
    localPreviewFrame: localPlayPreviewFrame,
    localPreviewFrameRef,
    cachedPreviewUrl: cachedPlayPreviewUrl,
    cacheDirty: savedPlayCacheDirty,
    setLatestFrames: setLatestPlayFrames,
    setLocalPreviewFrame: setLocalPlayPreviewFrame,
    setCachedPreviewUrl: setCachedPlayPreviewUrl,
    setCacheDirty: setSavedPlayCacheDirty,
    bumpFramesVersion: bumpPlayFramesVersion,
    loadCachedPreviewFrame: loadCachedPlayPreviewFrame,
    getCachedFramesForRange: getCachedPlayFramesForRange,
    markSelectedCacheDirty: markSelectedPlayCacheDirty,
    capturePendingFrameEdits: capturePendingPlayFrameEdits,
    beginFrameEdit: beginPlayFrameEdit,
    previewLocalFrame: previewLocalPlayFrame,
    annotateState: annotatePlayState,
    resetFrameEdits: resetPlayFrameEdits,
    restoreFrameEdits: restorePlayFrameEdits,
  } = playEditCache;
  const resolveRotoSourceFrameForDisplayFrame = useCallback((displayFrame: number) => {
    if (!launchContext) return displayFrame;
    return getSourceRotoFrameForDisplayFrame(
      displayFrame,
      selectRealCachedRotoSourceFrameNumbers(launchContext?.cachedRotoFrames),
      physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
    ) ?? displayFrame;
  }, [launchContext]);
  const rotoTimelineModel = useRotoTimelineModel({
    cachedRotoFrames: launchContext?.cachedRotoFrames,
    interpolationSettings: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined,
    currentFrame,
  });
  const rotoTimelineActions = useRotoTimelineActions({
    getModel: () => rotoTimelineModel.view.value.model,
    getStoreRealKeyFrames: () => launchContext ? selectRealCachedRotoSourceFrameNumbers(launchContext.cachedRotoFrames) : [],
    getCurrentSettings: () => launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : { enabled: false, inBetweenCount: 1, mode: 'duplicate', deform: 0, position: 0 },
    setInterpolationSettings: (settings) => {
      if (!launchContext) return settings;
      physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, settings);
      return physicPaintStore.getRotoInterpolationSettings(launchContext.layerId);
    },
    getStoreRotoFrames: () => launchContext ? physicPaintStore.getRotoCacheFrames(launchContext.layerId) : [],
    getFailureStatus: () => launchContext ? physicPaintStore.getRotoInterpolationFailureStatus(launchContext.layerId) : null,
  });
  const timelineOccupiedRotoFrames = rotoTimelineModel.occupiedRotoFrames.value;
  const timelineSavedRotoFrames = rotoTimelineModel.savedRotoFrames.value;
  const timelineCachedRotoFrames = rotoTimelineModel.cachedRotoFrames.value;
  const currentFrameIsGeneratedRoto = workflowMode === 'roto' && rotoTimelineModel.currentFrameIsGenerated.value;
  const rotoInputDisabled = workflowMode === 'roto' && ((Boolean(saveOnLeaveSourceFrameRef.current) && applyStatus === 'applying') || currentFrameIsGeneratedRoto);
  const rotoReferenceController = useRotoReferenceController<RenderedFramePayload>({
    workflowMode,
    settingsBackground: settings.background,
    cachedRotoFrames: launchContext?.cachedRotoFrames,
    previewFrames: rotoPreviewFramesRef.current,
    confirmedFrames: confirmedCachedRotoFramesRef.current,
    dirtyFrames: dirtyRotoFramesRef.current,
    liveOverlayActionCounts: liveRotoOverlayActionCountRef.current,
    getRotoFrame: (appFrame) => launchContext ? physicPaintStore.getRotoFrame(launchContext.layerId, appFrame) : null,
    getFrame: (appFrame) => launchContext ? physicPaintStore.getFrame(launchContext.layerId, appFrame) : null,
    syncPending: () => rotoKeyUtilitiesExternalRef.current?.resetSession(),
    setApplyMessage,
  });
  const {
    cachedRotoReferenceUrl,
    cachedRotoRepaintBaseFrame,
    setCachedRotoReferenceUrl,
    setCachedRotoRepaintBaseFrame,
    clearCachedRotoReferenceUrl,
    resetCachedRotoReference,
    findCachedRotoDisplayFrame,
    loadCachedRotoReferenceFrame,
  } = rotoReferenceController;

  const resetRotoSessionForLaunch = useCallback((context: PhysicPaintLaunchContext, options: { preserveCloseAfterRotoSave?: boolean } = {}) => {
    if (getLaunchWorkflowMode(context) !== 'roto') return;
    rotoEditBuffer.resetForLaunch();
    confirmedCachedRotoFramesRef.current = new Map(selectRealCachedRotoFrames(context.cachedRotoFrames).map((frame) => [frame.appFrame, frame]));
    pendingRotoAdvanceRef.current = null;
    saveOnLeaveSourceFrameRef.current = null;
    saveOnLeaveRenderedFrameRef.current = null;
    pendingCachedRotoMergeFrameRef.current = null;
    saveOnLeaveDeleteFrameRef.current = null;
    if (!options.preserveCloseAfterRotoSave) {
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      closeGuardBypassRef.current = false;
      pendingApplyRef.current = null;
    }
    rotoFlushInFlightRef.current = null;
    resetRotoCachedPlaybackRef.current();
    rotoKeyUtilitiesExternalRef.current?.resetSession();
    setRotoSavingFrame(null);
    resetCachedRotoReference();
    if (!options.preserveCloseAfterRotoSave) {
      setRotoClosePromptState('idle');
      setRotoClosePromptMessage(null);
    }
  }, []);

  useEffect(() => {
    workflowModeRef.current = workflowMode;
  }, [workflowMode]);

  const getStrokeMetadata = useCallback(() => {
    if (workflowModeRef.current !== 'play') return null;
    const playFrame = localPreviewFrameRef.current;
    return Number.isInteger(playFrame) && playFrame >= 0 ? { playFrame } : null;
  }, []);

  useEffect(() => {
    detectBridgeMode().then(setBridgeMode).catch(() => setBridgeMode('Unavailable'));
  }, []);

  const applyIncomingLaunchContext = useCallback((context: PhysicPaintLaunchContext) => {
    const hydratedContext = hydrateRotoLaunchContext(context, physicPaintStore);
    const preserveCloseAfterRotoSave = closeAfterRotoSaveRequestedRef.current;
    resetRotoSessionForLaunch(hydratedContext, { preserveCloseAfterRotoSave });
    applyLaunchContext(hydratedContext, setLaunchContext, setFramesToApply, setWorkflowMode, setLocalPlayPreviewFrame, setSavedPlayCacheDirty, setPlayWiggle, setSettings);
    const readyEngine = engineRef.current;
    if (readyEngine && getLaunchWorkflowMode(hydratedContext) === 'roto') loadCachedRotoReferenceFrame(hydratedContext.startFrame, readyEngine as PreviewBackgroundEngine);
    if (!preserveCloseAfterRotoSave) {
      setApplyStatus('idle');
      setApplyMessage(null);
      setLastError(null);
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      closeAfterApplyOperationIdRef.current = null;
      closeGuardBypassRef.current = false;
      setRotoClosePromptState('idle');
      setRotoClosePromptMessage(null);
    }
  }, [loadCachedRotoReferenceFrame, resetRotoSessionForLaunch]);

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
            applyIncomingLaunchContext(storedContext);
          }
        }

        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        unlisten = await eventApi.listen(PHYSIC_PAINT_LAUNCH_EVENT, (event) => {
          if (isPhysicPaintLaunchContext(event.payload)) {
            console.info('[PhysicsPaintStudio] launch context received', event.payload);
            applyIncomingLaunchContext(event.payload);
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
  }, [applyIncomingLaunchContext]);

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

  const rotoKeyUtilities = useRotoKeyUtilities<ReturnType<EfxPaintEngine['save']>, RenderedFramePayload>({
    currentFrame,
    realKeyFrames: selectRealCachedRotoFrames(launchContext?.cachedRotoFrames),
    cachedRotoFrames: launchContext?.cachedRotoFrames,
    dirtyFrames: dirtyRotoFramesRef.current,
    canvasSize: { width: canvasWidth, height: canvasHeight },
    applyStatus,
    flushInFlight: Boolean(rotoFlushInFlightRef.current),
    buildBlankRotoFrame: (frame): PhysicPaintRotoCacheFrame => ({ ...buildBlankRotoFrame(canvasWidth, canvasHeight, frame), source: 'real-key' }),
    resolveSourceFrameForDisplayFrame: resolveRotoSourceFrameForDisplayFrame,
    resolvePasteTargetForDisplayFrame: (displayFrame) => launchContext ? rotoTimelineActions.saveRealKeyAtDisplayFrame(displayFrame).target : null,
    segmentSpacingOverrides: launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId).segmentSpacingOverrides : undefined,
    getEditableStates: () => rotoFrameStatesRef.current,
    setEditableStates: (states) => { rotoFrameStatesRef.current = states; },
    getPreviewFrames: () => rotoPreviewFramesRef.current,
    setPreviewFrames: (frames) => { rotoPreviewFramesRef.current = frames as Map<number, RenderedFramePayload>; },
    getEditableState: (frame) => rotoFrameStatesRef.current.get(frame) ?? null,
    setDirtyFrames: (frames) => { dirtyRotoFramesRef.current = frames; },
    syncPendingRotoFrames,
    syncRotoKeyFrameLists: (cacheFrames) => rotoKeyUtilitiesExternalRef.current?.syncRotoKeyFrameLists(cacheFrames),
    applyRotoKeyFrames: (transaction) => rotoKeyUtilitiesExternalRef.current?.applyRotoKeyFrames(transaction) ?? [],
    persistRotoKeyFrameTransaction: (transaction) => rotoKeyUtilitiesExternalRef.current?.persistRotoKeyFrameTransaction(transaction) ?? Promise.resolve(),
    handleSaveFrameEffect: (effect, session) => rotoKeyUtilitiesExternalRef.current?.handleSaveFrameEffect(effect, session) ?? Promise.resolve(false),
    restoreFrame: (effect) => rotoKeyUtilitiesExternalRef.current?.restoreFrame(effect),
    clearCanvas: (frame) => rotoKeyUtilitiesExternalRef.current?.clearCanvas(frame),
    showCachedReference: (frame) => setCachedRotoReferenceUrl(frame.dataUrl),
    navigate: (frame) => rotoKeyUtilitiesExternalRef.current?.navigate(frame) ?? Promise.resolve(),
    clearGeneratedFrame: (frame) => { if (launchContext) physicPaintStore.removeFrameRange(launchContext.layerId, frame, 1); },
    clearCachedReferenceFrame: (frame) => rotoKeyUtilitiesExternalRef.current?.clearCachedReferenceFrame(frame),
    clearDeletedFrame: (frame) => { if (launchContext) physicPaintStore.removeRealRotoKeyFrame(launchContext.layerId, frame); },
    snapshotCurrentRotoFrame: () => { snapshotCurrentRotoFrame(); },
    setApplyMessage,
    setApplyStatus,
    setLastError,
    setRotoSavingFrame,
  });
  const rotoSession = rotoKeyUtilities.session;
  const executeRotoSessionEffects = rotoKeyUtilities.executeSessionEffects;
  const runRotoSessionResult = rotoKeyUtilities.runSessionResult;
  const duplicateRotoKey = rotoKeyUtilities.duplicateKey;
  const insertRotoFrame = rotoKeyUtilities.insertBlankKey;
  const deleteRotoFrame = rotoKeyUtilities.deleteKey;
  const copyRotoFrame = rotoKeyUtilities.copyKey;
  const pasteRotoFrame = rotoKeyUtilities.pasteKey;

  const undo = useCallback(() => {
    engine?.undo();
    if (workflowMode === 'roto' && cachedRotoRepaintBaseFrame?.appFrame === currentFrame) {
      const result = rotoEditBuffer.undoOverlay(currentFrame);
      if (result === 'empty') {
        rotoSession.markLiveOverlayEmpty(currentFrame);
        syncPendingRotoFrames();
      }
    }
  }, [cachedRotoRepaintBaseFrame, currentFrame, engine, rotoSession, syncPendingRotoFrames, workflowMode]);

  const persistRotoBackgroundMetadata = useCallback(() => {
    if (!launchContext || workflowMode !== 'roto') return;
    physicPaintStore.setRotoBackgroundMetadata(launchContext.layerId, buildRotoBackgroundMetadata(settings));
  }, [launchContext, settings, workflowMode]);

  useEffect(() => {
    persistRotoBackgroundMetadata();
  }, [persistRotoBackgroundMetadata]);

  function findCachedRotoPlaybackFrame(appFrame: number): RenderedFramePayload | null {
    return findCachedRotoDisplayFrame(appFrame);
  }

  function getRotoCachedPlaybackFrames(): Array<{ appFrame: number; frame: RenderedFramePayload | null }> {
    return rotoSession.playbackFrameNumbers.value.map((appFrame) => ({ appFrame, frame: findCachedRotoPlaybackFrame(appFrame) }));
  }

  const rotoCachedPlayback = useRotoCachedPlayback({
    initialFps: getPreviewFps(launchContext?.fps),
    workflowMode,
    getFrames: getRotoCachedPlaybackFrames,
    onStart: (frameCount) => setAnimTotal(frameCount),
    onFrame: (frameIndex, appFrame) => {
      setAnimFrame(frameIndex);
      setLaunchContext((current) => current ? { ...current, startFrame: appFrame } : current);
    },
    setIsPlaying,
  });
  resetRotoCachedPlaybackRef.current = rotoCachedPlayback.resetForLaunch;
  const playPreviewController = usePlayPreviewController<RenderedFramePayload>({
    engine,
    previewFps,
    wiggle: playWiggle,
    getCachedFrames: getCachedPlayFramesForRange,
    capturePendingFrameEdits: capturePendingPlayFrameEdits,
    annotateState: annotatePlayState,
    setCachedPreviewUrl: setCachedPlayPreviewUrl,
    setApplyMessage,
    stopRotoPlayback: rotoCachedPlayback.stop,
    setIsPlaying,
    setAnimFrame,
    setAnimTotal,
  });
  const playPreview = playPreviewController.preview;
  const stopPreview = playPreviewController.stop;

  const missingConditions = useMemo(() => {
    const missing: string[] = [];
    if (!engine) missing.push('Engine is still initializing');
    if (!canvasMounted) missing.push('Canvas is still mounting');
    if (!launchContext) missing.push('No app layer context received');
    if (bridgeMode === 'Unavailable') missing.push('App bridge is not connected');
    if (applyStatus === 'applying' || (isPlaying && !rotoCachedPlayback.isActive)) missing.push('Apply operation is still running');
    return missing;
  }, [applyStatus, bridgeMode, canvasMounted, engine, isPlaying, launchContext, rotoCachedPlayback.isActive]);

  const readyToApply = missingConditions.length === 0;

  useEffect(() => {
    if (workflowMode !== 'play') return;
    if (savedPlayCacheDirty) return;
    loadCachedPlayPreviewFrame(localPlayPreviewFrame);
  }, [engine, launchContext, localPlayPreviewFrame, savedPlayCacheDirty, workflowMode]);

  useEffect(() => {
    if (workflowMode !== 'roto') return;
    loadCachedRotoReferenceFrame(currentFrame, engine as PreviewBackgroundEngine | null);
  }, [currentFrame, engine, loadCachedRotoReferenceFrame, launchContext, workflowMode]);

  const showPlayLimitToast = useCallback((message: string) => {
    setPlayLimitToast(message);
  }, []);

  useEffect(() => {
    if (!playLimitToast) return;
    const timeout = window.setTimeout(() => setPlayLimitToast(null), PLAY_LIMIT_TOAST_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [playLimitToast]);

  const updatePlayFrameCount = useCallback((frameCount: number) => {
    const update = resolvePlayFrameCountUpdate({
      requestedFrameCount: frameCount,
      maxFrameCount: launchContext?.maxPlayFrameCount,
      maxFrameCountReason: launchContext?.maxPlayFrameCountReason,
    });
    if (update.limitMessage) showPlayLimitToast(update.limitMessage);
    setFramesToApply(update.frameCount);
    if (workflowMode !== 'play') return;
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setLaunchContext((current) => current ? markPlayLaunchCacheStale(current, { playFrameCount: update.frameCount }) : current);
  }, [launchContext?.maxPlayFrameCount, launchContext?.maxPlayFrameCountReason, markSelectedPlayCacheDirty, showPlayLimitToast, workflowMode]);

  const updatePlayWiggle = useCallback((wiggle: AnimationWiggleConfig) => {
    const normalized = normalizePlayMotionUpdate(wiggle);
    setPlayWiggle(normalized);
    if (workflowMode !== 'play') return;
    setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
    setLaunchContext((current) => current ? markPlayLaunchCacheStale(current, { playMotion: normalized }) : current);
  }, [markSelectedPlayCacheDirty, workflowMode]);

  const addEditableRotoFrame = rotoEditBuffer.addEditableFrame;
  const removeEditableRotoFrame = rotoEditBuffer.removeEditableFrame;

  const upsertCachedRotoFrameInLaunchContext = useCallback((renderedFrame: RenderedFramePayload, backgroundOnly: boolean, onionFrame?: RenderedFramePayload | null, interpolationSettings?: PhysicPaintRotoInterpolationSettings) => {
    const sourceFrame = renderedFrame.sourceFrame ?? renderedFrame.appFrame;
    const normalizedRenderedFrame = { ...renderedFrame, appFrame: sourceFrame };
    confirmedCachedRotoFramesRef.current.set(sourceFrame, normalizedRenderedFrame);
    setLaunchContext((current) => {
      if (!current) return current;
      const previousDisplayFrame = current.startFrame;
      const frameForCache = { ...normalizedRenderedFrame, source: 'real-key' as const, sourceFrame, displayFrame: sourceFrame };
      physicPaintStore.upsertRealRotoKeyFrame(current.layerId, sourceFrame, frameForCache, backgroundOnly);
      if (interpolationSettings) physicPaintStore.setRotoInterpolationSettings(current.layerId, interpolationSettings);
      const manualFrames = upsertCachedRotoCacheFrame(current.cachedRotoFrames, frameForCache, backgroundOnly, onionFrame);
      const storeFrames = physicPaintStore.getRotoCacheFrames(current.layerId);
      const settings = physicPaintStore.getRotoInterpolationSettings(current.layerId);
      const refreshedRotoFrames = settings.enabled && storeFrames.length > 0 ? storeFrames : manualFrames;
      const nextDisplayFrame = refreshedRotoFrames.find((frame) => frame.source === 'real-key' && (frame.sourceFrame ?? frame.appFrame) === sourceFrame)?.appFrame ?? sourceFrame;
      confirmedCachedRotoFramesRef.current = new Map(refreshedRotoFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
      rotoEditBuffer.setEditableFrameList((frames) => {
        const withoutStaleFrames = frames.filter((frame) => frame !== previousDisplayFrame && frame !== sourceFrame && frame !== nextDisplayFrame);
        return backgroundOnly ? withoutStaleFrames : addOccupiedRotoFrame(withoutStaleFrames, nextDisplayFrame);
      });
      return {
        ...current,
        startFrame: nextDisplayFrame,
        cachedRotoFrames: refreshedRotoFrames,
        rotoInterpolationSettings: settings,
      };
    });
  }, []);

  const removeCachedRotoFrameFromLaunchContext = useCallback((appFrame: number) => {
    confirmedCachedRotoFramesRef.current.delete(appFrame);
    setLaunchContext((current) => current ? {
      ...current,
      cachedRotoFrames: removeCachedRotoCacheFrame(current.cachedRotoFrames, appFrame),
    } : current);
  }, []);

  const markCurrentRotoFrameDirty = useCallback(() => {
    if (workflowMode !== 'roto') return;
    if (currentFrameIsGeneratedRoto) {
      setApplyMessage(`Generated frame ${currentFrame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.`);
      return;
    }
    const appFrame = currentFrame;
    rotoEditBuffer.markDirty(appFrame);
    rotoSession.markLiveOverlayDirty(appFrame);
    clearCachedRotoReferenceUrl();
    rotoCachedPlayback.stop();
    (engine as PreviewBackgroundEngine | null)?.resetBackground?.();
    syncPendingRotoFrames();
  }, [clearCachedRotoReferenceUrl, currentFrame, currentFrameIsGeneratedRoto, engine, rotoSession, syncPendingRotoFrames, workflowMode]);

  const beginRotoFrameEdit = useCallback(() => {
    rotoCachedPlayback.stop();
    markCurrentRotoFrameDirty();
  }, [markCurrentRotoFrameDirty, rotoCachedPlayback.stop]);

  const clearActiveSource = useCallback(() => {
    if (!engine || !launchContext) return;
    engine.clear();
    if (workflowMode === 'roto') {
      if (cachedRotoRepaintBaseFrame?.appFrame === currentFrame) {
        rotoEditBuffer.clearCachedOverlay(currentFrame);
        rotoSession.markLiveOverlayEmpty(currentFrame);
        syncPendingRotoFrames();
        setApplyStatus('success');
        setApplyMessage(`Cleared live repaint strokes for frame ${currentFrame}; cached base preserved.`);
        return;
      }
      rotoEditBuffer.clearFrame(currentFrame);
      syncPendingRotoFrames();
      if (!cachedRotoRepaintBaseFrame) setCachedRotoReferenceUrl(null);
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
  }, [cachedRotoRepaintBaseFrame, currentFrame, engine, framesToApply, launchContext, markSelectedPlayCacheDirty, removeEditableRotoFrame, rotoSession, syncPendingRotoFrames, workflowMode]);

  const dryPaint = useCallback(() => {
    engine?.forceDry();
  }, [engine]);

  const snapshotCurrentRotoFrame = useCallback(() => {
    if (!engine || !launchContext) return false;
    const appFrame = currentFrame;
    const currentState = engine.save();
    const hasCachedReference = Boolean(cachedRotoReferenceUrl || cachedRotoRepaintBaseFrame?.appFrame === appFrame);
    const shouldCapture = !(hasCachedReference && !dirtyRotoFramesRef.current.has(appFrame)) && shouldPersistRotoFrame(currentState);
    const capturedFrame = shouldCapture
      ? buildRotoFrameFromCanvas(exportTransparentStrokeCanvas(engine), appFrame, { width: canvasWidth, height: canvasHeight })
      : buildBlankRotoFrame(canvasWidth, canvasHeight, appFrame);
    return rotoEditBuffer.snapshotFrame({
      frame: appFrame,
      state: currentState,
      capturedFrame,
      hasCachedReference,
      shouldPersist: shouldPersistRotoFrame(currentState),
    });
  }, [addEditableRotoFrame, cachedRotoReferenceUrl, cachedRotoRepaintBaseFrame, canvasHeight, canvasWidth, currentFrame, engine, launchContext, removeEditableRotoFrame]);

  const { flushRotoFrame, saveRotoFrame, savePendingRotoFrames } = useRotoSaveController({
    getActionContext: () => actionContext,
    getCurrentFrame: () => currentFrame,
    getReadyToApply: () => readyToApply,
    getCurrentFrameIsGenerated: () => currentFrameIsGeneratedRoto,
    getCachedRepaintFrame: (frame) => cachedRotoRepaintBaseFrame?.appFrame === frame ? cachedRotoRepaintBaseFrame : null,
    getEditableState: (frame) => rotoFrameStatesRef.current.get(frame),
    setEditableState: (frame, state) => { rotoFrameStatesRef.current.set(frame, state); },
    getCapturedFrame: (frame) => rotoCapturedFramesRef.current.get(frame),
    deleteCapturedFrame: (frame) => { rotoCapturedFramesRef.current.delete(frame); },
    setPreviewFrame: (frame, renderedFrame) => { rotoPreviewFramesRef.current.set(frame, renderedFrame); },
    dirtyFramesRef: dirtyRotoFramesRef,
    flushInFlightRef: rotoFlushInFlightRef,
    pendingAdvanceRef: pendingRotoAdvanceRef,
    saveOnLeaveSourceFrameRef,
    saveOnLeaveRenderedFrameRef,
    pendingCachedMergeFrameRef: pendingCachedRotoMergeFrameRef,
    saveOnLeaveDeleteFrameRef,
    resolveSourceFrame: resolveRotoSourceFrameForDisplayFrame,
    getInterpolationSettings: (layerId) => physicPaintStore.getRotoInterpolationSettings(layerId),
    getBackgroundMetadata: () => buildRotoBackgroundMetadata(settings),
    saveRealKeyAtDisplayFrame: rotoTimelineActions.saveRealKeyAtDisplayFrame,
    snapshotCurrentFrame: snapshotCurrentRotoFrame,
    renderFrame: async ({ engine: saveEngine, editableState, capturedFrame, cachedRepaintBase, frame, sourceFrame }) => {
      const backgroundOnly = isBackgroundOnlyRotoFrame(editableState);
      const liveAlphaCanvas = exportTransparentStrokeCanvas(saveEngine);
      const renderedFrame = cachedRepaintBase
        ? await mergeCachedRotoAlphaFrame(cachedRepaintBase, liveAlphaCanvas, sourceFrame, { width: canvasWidth, height: canvasHeight })
        : { ...(capturedFrame ?? buildRotoOutputFrame(saveEngine, frame, canvasWidth, canvasHeight)), appFrame: sourceFrame };
      return { renderedFrame, backgroundOnly, onionFrame: backgroundOnly ? null : renderedFrame, cachedRepaint: Boolean(cachedRepaintBase) };
    },
    resetBackground: (saveEngine) => { (saveEngine as PreviewBackgroundEngine).resetBackground(); },
    addEditableFrame: addEditableRotoFrame,
    removeEditableFrame: removeEditableRotoFrame,
    removeCachedFrame: removeCachedRotoFrameFromLaunchContext,
    upsertCachedFrame: (save, interpolationSettings) => upsertCachedRotoFrameInLaunchContext(save.renderedFrame, save.backgroundOnly, save.onionFrame, interpolationSettings),
    setCachedReferenceUrl: setCachedRotoReferenceUrl,
    restoreCachedRepaintFrame: setCachedRotoRepaintBaseFrame,
    requestSessionFrame: (frame) => { void rotoSession.requestFrame(frame); },
    getSessionSavingFrame: () => rotoSession.savingFrame.value,
    registerPendingApply,
    sendApplyPayload: sendPhysicPaintApplyPayload,
    startApplyTimeout,
    syncPendingFrames: syncPendingRotoFrames,
    setApplyStatus,
    setApplyMessage,
    setLastError,
    setSavingFrame: setRotoSavingFrame,
  });

  const {
    rotoClosePromptState,
    rotoClosePromptMessage,
    setRotoClosePromptState,
    setRotoClosePromptMessage,
    closePhysicsPaintWindow,
    closeWithoutSavingRotoFrame,
    cancelRotoClose,
    saveAndCloseRotoFrame,
  } = useRotoCloseLifecycle({
    workflowMode,
    currentFrame,
    dirtyFramesRef: dirtyRotoFramesRef,
    closeGuardBypassRef,
    closeAfterApplyOperationIdRef,
    closeAfterRotoSaveRequestedRef,
    snapshotCurrentRotoFrame,
    saveCurrentRotoFrame: (options) => saveRotoFrame(null, options),
  });

  const navigateToSyncedFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    if (rotoFlushInFlightRef.current || applyStatus === 'applying') return false;
    rotoCachedPlayback.stop();
    clearCachedRotoReferenceUrl();
    if (engine && launchContext) {
      snapshotCurrentRotoFrame();
      const nextState = rotoFrameStatesRef.current.get(frame);
      if (nextState) {
        engine.load(nextState);
      } else {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
    }
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [applyStatus, bridgeMode, engine, launchContext, snapshotCurrentRotoFrame, rotoCachedPlayback.stop]);

  const openSyncedRotoFrameAfterSave = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    rotoCachedPlayback.stop();
    clearCachedRotoReferenceUrl();
    if (engine && launchContext) {
      const nextState = rotoFrameStatesRef.current.get(frame);
      if (nextState) {
        engine.load(nextState);
      } else {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame, engine as PreviewBackgroundEngine);
      }
    }
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [bridgeMode, engine, launchContext, rotoCachedPlayback.stop]);

  const syncRotoKeyFrameLists = useCallback((cacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => {
    if (!cacheFrames) return;
    confirmedCachedRotoFramesRef.current = new Map(cacheFrames.filter((frame) => frame.source === 'real-key').map((frame) => [frame.appFrame, frame]));
    setLaunchContext((current) => current ? {
      ...current,
      cachedRotoFrames: [...cacheFrames].sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex),
    } : current);
  }, []);

  const applyRotoKeyFrames = useCallback((transaction: RotoKeyUtilityTransaction) => {
    if (!launchContext) return [];
    if (transaction.segmentSpacingOverrides) physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, { segmentSpacingOverrides: [...transaction.segmentSpacingOverrides] });
    physicPaintStore.replaceRotoKeyFrames({
      operationId: `${launchContext.operationId}:local-roto-keys:${Date.now()}`,
      kind: 'replace-roto-key-frames',
      layerId: launchContext.layerId,
      startFrame: transaction.activeFrame,
      frames: transaction.realKeyFrames,
    });
    return physicPaintStore.getRotoCacheFrames(launchContext.layerId);
  }, [launchContext]);

  const persistRotoKeyFrameTransaction = useCallback(async (transaction: RotoKeyUtilityTransaction) => {
    if (!launchContext || actionContext?.bridgeMode === 'Unavailable') throw new Error('App bridge is not connected.');
    if (transaction.realKeyFrames.length !== transaction.realKeyFrameNumbers.length) throw new Error('Roto key cache is incomplete after the action.');
    const operationId = `${launchContext.operationId}:roto-keys:${Date.now()}`;
    const payload: PhysicPaintApplyPayload & { rotoInterpolationSettings: PhysicPaintRotoInterpolationSettings } = {
      operationId,
      kind: 'replace-roto-key-frames',
      layerId: launchContext.layerId,
      startFrame: transaction.activeFrame,
      frames: transaction.realKeyFrames,
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
    };
    activeOperationIdRef.current = operationId;
    registerPendingApply(payload);
    pendingRotoKeyActionMessageRef.current = transaction.successMessage;
    setApplyStatus('applying');
    setApplyMessage('Saving Roto key changes...');
    await sendPhysicPaintApplyPayload(payload, actionContext?.bridgeMode ?? 'Unavailable');
    startApplyTimeout(operationId);
  }, [actionContext?.bridgeMode, launchContext, startApplyTimeout]);

  const restoreRotoFrameFromSessionEffect = useCallback((effect: Extract<RotoSessionEffect, { type: 'restoreFrame' }>) => {
    const restore: RotoKeyUtilityActiveRestore = effect.restore;
    if (restore.kind === 'blank-real-key' || restore.kind === 'clear-blank') {
      setCachedRotoReferenceUrl(null);
      if (engine && effect.frame === currentFrame) {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
      }
    } else if (restore.kind === 'load-real-key' && engine && effect.frame === currentFrame) {
      setCachedRotoReferenceUrl(null);
      loadCachedRotoReferenceFrame(restore.frame, engine as PreviewBackgroundEngine);
    }
  }, [currentFrame, engine]);

  rotoKeyUtilitiesExternalRef.current = {
    resetSession: rotoKeyUtilities.resetSession,
    syncRotoKeyFrameLists,
    applyRotoKeyFrames,
    persistRotoKeyFrameTransaction,
    handleSaveFrameEffect: async (effect) => {
      saveOnLeaveSourceFrameRef.current = effect.frame;
      setRotoSavingFrame(effect.frame);
      pendingRotoAdvanceRef.current = effect.after.type === 'navigate' ? effect.after.frame : null;
      setApplyStatus('applying');
      const actionCopy = effect.after.type === 'keyAction' ? effect.after.operation : null;
      setApplyMessage(effect.reason === 'beforeNavigate'
        ? `Saving frame ${effect.frame} before navigation...`
        : `Saving frame ${effect.frame} before ${actionCopy ?? 'key action'}...`);
      return Boolean(await flushRotoFrame(effect.frame, { force: true, advanceToFrame: effect.after.type === 'navigate' ? effect.after.frame : null }));
    },
    restoreFrame: restoreRotoFrameFromSessionEffect,
    clearCanvas: (frame) => {
      setCachedRotoReferenceUrl(null);
      if (engine && frame === currentFrame) {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
      }
    },
    navigate: openSyncedRotoFrameAfterSave,
    clearCachedReferenceFrame: removeCachedRotoFrameFromLaunchContext,
  };

  const requestRotoFrameNavigation = useCallback(async (targetFrame: number) => {
    if (!Number.isInteger(targetFrame) || targetFrame < 0) return false;
    if (workflowMode !== 'roto') return navigateToSyncedFrame(targetFrame);
    const saveOnLeaveSourceFrame = saveOnLeaveSourceFrameRef.current;
    if (saveOnLeaveSourceFrame !== null && activeOperationIdRef.current) {
      pendingRotoAdvanceRef.current = targetFrame;
      return false;
    }
    snapshotCurrentRotoFrame();
    const result = rotoSession.requestFrame(targetFrame);
    if (!result.ok) {
      if (result.message) setApplyMessage(result.message);
      return false;
    }
    if (result.effects.some((effect) => effect.type === 'navigate')) {
      await executeRotoSessionEffects(result.effects);
      return true;
    }
    await runRotoSessionResult(result);
    return result.effects.some((effect) => effect.type === 'saveFrame');
  }, [executeRotoSessionEffects, navigateToSyncedFrame, rotoSession, runRotoSessionResult, snapshotCurrentRotoFrame, workflowMode]);

  const { handleRotoApplyResult } = useRotoApplyResultController({
    pendingKeyActionMessageRef: pendingRotoKeyActionMessageRef,
    pendingAdvanceRef: pendingRotoAdvanceRef,
    saveOnLeaveSourceFrameRef,
    saveOnLeaveRenderedFrameRef,
    pendingCachedMergeFrameRef: pendingCachedRotoMergeFrameRef,
    saveOnLeaveDeleteFrameRef,
    dirtyFramesRef: dirtyRotoFramesRef,
    capturedFramesRef: rotoCapturedFramesRef,
    frameStatesRef: rotoFrameStatesRef,
    liveOverlayActionCountsRef: liveRotoOverlayActionCountRef,
    closeAfterApplyOperationIdRef,
    closeAfterRotoSaveRequestedRef,
    closeGuardBypassRef,
    getSessionSavingFrame: () => rotoSession.savingFrame.value,
    onSessionSaveFailed: rotoSession.onSaveFailed,
    onSessionSaveSucceeded: rotoSession.onSaveSucceeded,
    getSessionDirtyFrames: () => rotoSession.dirtyFrames.value,
    executeSessionEffects: executeRotoSessionEffects,
    syncPendingFrames: syncPendingRotoFrames,
    upsertCachedFrame: (save) => upsertCachedRotoFrameInLaunchContext(save.renderedFrame, save.backgroundOnly, save.onionFrame),
    removeCachedFrame: removeCachedRotoFrameFromLaunchContext,
    removeEditableFrame: removeEditableRotoFrame,
    setCachedReferenceUrl: setCachedRotoReferenceUrl,
    setCachedRepaintBaseFrame: setCachedRotoRepaintBaseFrame,
    getEngine: () => engine,
    getCurrentFrame: () => currentFrame,
    getBackgroundMode: () => settings.background,
    restorePreviewBase: (saveEngine, dataUrl) => { (saveEngine as PreviewBackgroundEngine).setPreviewBaseImageUrl(dataUrl); },
    openFrameAfterSave: async (frame) => { await openSyncedRotoFrameAfterSave(frame); },
    closeWindow: closePhysicsPaintWindow,
    setApplyStatus,
    setApplyMessage,
    setLastError,
    setSavingFrame: setRotoSavingFrame,
    setClosePromptState: setRotoClosePromptState,
    setClosePromptMessage: setRotoClosePromptMessage,
  });

  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
    const transition = matchApplyResult(detail);
    if (transition.type === 'ignore') return;
    if (transition.type === 'mismatch') {
      setApplyStatus('error');
      setApplyMessage(transition.message);
      setLastError(transition.message);
      return;
    }
    if (handleRotoApplyResult(transition)) return;

    const shouldCloseAfterSave = transition.shouldCloseAfterSave;
    detail = transition.detail;
    if (!transition.ok) {
      const message = transition.message ?? 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
      const diagnostic = detail.error;
      setApplyStatus('error');
      setApplyMessage(diagnostic ? `${message} ${diagnostic}` : message);
      setLastError(diagnostic ? `${message} ${diagnostic}` : message);
      return;
    }

    if (shouldCloseAfterSave) {
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      setRotoClosePromptState('idle');
      setRotoClosePromptMessage(null);
    }
    setApplyStatus('success');
    setLastError(null);
    if (detail.kind === 'update-play-render-options') {
      setApplyMessage(detail.appliedFrameCount > 0 ? 'Play options updated. Cached frames cleared; use Render play.' : 'Play options already up to date.');
    } else if (detail.kind === 'apply-play-canvas') {
      const count = detail.appliedFrameCount;
      const frame = detail.startFrame;
      const endFrame = frame + Math.max(0, count - 1);
      setApplyMessage(`Saved play range: ${count} frames from ${frame} to ${endFrame} at ${canvasWidth}×${canvasHeight}.`);
    } else if (detail.kind === 'convert-play-to-roto') {
      setApplyMessage(`Converted ${detail.appliedFrameCount} Play frames to Roto frames.`);
    } else if (detail.kind === 'convert-roto-to-play') {
      const endFrame = detail.startFrame + Math.max(0, detail.appliedFrameCount - 1);
      setApplyMessage(`Converted Roto frames ${detail.startFrame}–${endFrame} to the current Play canvas source.`);
    }
  }, [canvasHeight, canvasWidth, handleRotoApplyResult, matchApplyResult]);

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

  const updateSelectedPlayOptions = useCallback(async () => {
    if (!actionContext || workflowMode !== 'play') return null;
    const { launchContext, bridgeMode } = actionContext;
    const scriptId = launchContext.selectedPlayScriptId;
    if (!scriptId) {
      setApplyStatus('error');
      setApplyMessage('No saved Play script is selected to update.');
      return null;
    }
    const renderOptions = buildPlayRenderOptionsSnapshot(settings, playWiggle);
    const operationId = `${launchContext.operationId}:update-play-options:${Date.now()}`;
    const payload: PhysicPaintApplyPayload = {
      kind: 'update-play-render-options',
      operationId,
      layerId: launchContext.layerId,
      startFrame: getActivePlayStartFrame(launchContext, currentFrame),
      playScriptId: scriptId,
      renderOptions,
    };
    try {
      setApplyStatus('applying');
      setApplyMessage('Updating Play options...');
      setLastError(null);
      activeOperationIdRef.current = operationId;
      registerPendingApply(payload);
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      const update = resolvePlayOptionsUpdate({ context: launchContext, renderOptions });
      const changed = update.changed;
      setLaunchContext((current) => current ? resolvePlayOptionsUpdate({ context: current, renderOptions }).context : current);
      if (changed) {
        latestPlayFramesRef.current = [];
        setLatestPlayFrames([]);
        setCachedPlayPreviewUrl(null);
        setSavedPlayCacheDirty(true);
        bumpPlayFramesVersion();
        setApplyMessage('Play options updated. Cached frames cleared; use Render play.');
      } else {
        setApplyMessage('Play options already up to date.');
      }
      return payload;
    } catch (error) {
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not update Play options. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return null;
    }
  }, [actionContext, currentFrame, playWiggle, settings, startApplyTimeout, workflowMode]);

  const savePlay = useCallback(async () => {
    if (!actionContext || !readyToApply) return null;
    const { engine, launchContext, bridgeMode } = actionContext;
    const frameCount = clampPhysicPaintFrameCount(framesToApply);
    const playStartFrame = getActivePlayStartFrame(launchContext, currentFrame);
    const renderOptions = buildPlayRenderOptionsSnapshot(settings, playWiggle);
    capturePendingPlayFrameEdits();
    const editableState = annotatePlayState(engine.save());
    (engine as PreviewBackgroundEngine).resetBackground();
    engine.load(editableState);

    try {
      setApplyStatus('applying');
      setApplyMessage('Applying physics paint output...');
      setLastError(null);
      const operationId = `${launchContext.operationId}:play:${Date.now()}`;
      activeOperationIdRef.current = operationId;

      const frames = await playPreviewController.renderFrames({ frameCount, startFrame: playStartFrame });

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
        renderOptions,
      };
      latestPlayFramesRef.current = frames;
      setLatestPlayFrames(frames);
      setCachedPlayPreviewUrl(frames[0]?.dataUrl ?? null);
      setSavedPlayCacheDirty(false);
      setLocalPlayPreviewFrame(0);
      bumpPlayFramesVersion();
      resetPlayFrameEdits();
      setLaunchContext((current) => current ? applyRenderedPlayCache({
        context: current,
        currentFrame,
        frameCount,
        frames,
        motion: playWiggle,
        renderOptions,
      }) : current);
      registerPendingApply(payload);
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      return payload;
    } catch (error) {
      playPreviewController.stopPlayOnly();
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      setIsPlaying(false);
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      return null;
    }
  }, [actionContext, capturePendingPlayFrameEdits, currentFrame, framesToApply, playPreviewController.renderFrames, playPreviewController.stopPlayOnly, playWiggle, readyToApply, settings, startApplyTimeout]);

  const saveEditableState = useCallback(async () => {
    if (!engine) return;
    try {
      if (workflowMode === 'play') capturePendingPlayFrameEdits();
      const editableState = workflowMode === 'play'
        ? annotatePlayState(engine.save())
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
        const state = resizePhysicsPaintState(parsePhysicsPaintStateFile(String(reader.result ?? '')), canvasWidth, canvasHeight);
        engine.load(state);
        if (workflowMode === 'play') {
          const assignments = getPlayFrameEditAssignments(state);
          const frameCount = getPlayFrameCountFromAssignments(assignments, framesToApply);
          const previewFrame = assignments.values().next().value ?? 0;
          restorePlayFrameEdits(assignments, previewFrame, state.strokes.length);
          setLatestPlayFrames([]);
          setCachedPlayPreviewUrl(null);
          setSavedPlayCacheDirty(true);
          setLocalPlayPreviewFrame(previewFrame);
          setFramesToApply(frameCount);
          bumpPlayFramesVersion();
          setLaunchContext((current) => current ? {
            ...withoutRotoGapLimit(current),
            workflowMode: 'play',
            editableSource: 'play',
            playFrameCount: frameCount,
            playCacheStatus: 'stale',
            cachedPlayFrames: [],
            previewFrame,
          } : current);
        }
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
  }, [engine, framesToApply, workflowMode]);

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
    const candidates = new Map<number, RenderedFramePayload & { onionKind?: PhysicsPaintWorkflowOnionPreviewFrame['kind'] }>();
    const frames: PhysicsPaintWorkflowOnionPreviewFrame[] = [];
    const addOnionCandidate = (frame: RenderedFramePayload & Partial<Pick<PhysicPaintRotoCacheFrame, 'backgroundOnly' | 'onionDataUrl' | 'source' | 'displayFrame' | 'fromSourceFrame' | 'toSourceFrame'>>) => {
      if (frame.source && frame.source !== 'real-key') return;
      if (frame.backgroundOnly) return;
      const anchorFrame = getRotoOnionAnchorDisplayFrame(frame);
      candidates.set(anchorFrame, typeof frame.onionDataUrl === 'string'
        ? { ...frame, appFrame: anchorFrame, source: 'real-key', dataUrl: frame.onionDataUrl, onionKind: 'stroke-preview' }
        : { ...frame, appFrame: anchorFrame, source: 'real-key', onionKind: frame.source === 'real-key' ? 'cached-composite' : 'stroke-preview' });
    };
    const addFrame = (frame: RenderedFramePayload & { onionKind?: PhysicsPaintWorkflowOnionPreviewFrame['kind'] }, direction: 'previous' | 'next', distance: number) => {
      frames.push({
        frame: frame.appFrame,
        dataUrl: frame.dataUrl,
        direction,
        distance,
        source: 'roto',
        kind: frame.onionKind,
      });
    };
    for (const frame of launchContext.cachedRotoFrames ?? []) addOnionCandidate(frame);
    for (const frame of physicPaintStore.getRotoCacheFrames(launchContext.layerId)) addOnionCandidate(frame);
    for (const [frameNumber, frame] of rotoPreviewFramesRef.current) {
      if (dirtyRotoFramesRef.current.has(frameNumber) || !candidates.has(frameNumber)) addOnionCandidate(frame);
    }
    const previousFrames = [...candidates.values()]
      .filter((frame) => frame.appFrame < currentFrame)
      .sort((a, b) => b.appFrame - a.appFrame)
      .slice(0, count);
    const nextFrames = [...candidates.values()]
      .filter((frame) => frame.appFrame > currentFrame)
      .sort((a, b) => a.appFrame - b.appFrame)
      .slice(0, count);
    previousFrames.forEach((frame, index) => addFrame(frame, 'previous', index + 1));
    nextFrames.forEach((frame, index) => addFrame(frame, 'next', index + 1));
    return frames.sort((a, b) => b.distance - a.distance);
  }, [currentFrame, isPlaying, launchContext, onion.count]);

  const { convertPlayToRoto, convertRotoToPlay } = useRotoPlayConversionController({
    getActionContext: () => actionContext,
    getCurrentFrame: () => currentFrame,
    getRequestedFrameCount: () => framesToApply,
    getLatestPlayFrames: () => latestPlayFramesRef.current,
    getPlayWiggle: () => playWiggle,
    getRenderOptions: () => buildPlayRenderOptionsSnapshot(settings, playWiggle),
    registerPendingApply,
    startApplyTimeout,
    clearActiveApply,
    sendApplyPayload: sendPhysicPaintApplyPayload,
    getCachedRotoFrames: (layerId) => physicPaintStore.getRotoCacheFrames(layerId),
    setFrame: (layerId, frame, renderedFrame) => physicPaintStore.setFrame(layerId, frame, renderedFrame),
    setEditableState: (layerId, state) => physicPaintStore.setEditableState(layerId, state),
    removeFrameRange: (layerId, startFrame, frameCount) => physicPaintStore.removeFrameRange(layerId, startFrame, frameCount),
    resetLatestPlayFrames: () => {
      latestPlayFramesRef.current = [];
      setLatestPlayFrames([]);
    },
    resetPlayPreview: () => setCachedPlayPreviewUrl(null),
    markPlayCacheDirty: () => setSavedPlayCacheDirty(true),
    resetPlayFrameEdits,
    setLaunchContext,
    setWorkflowMode,
    setApplyStatus,
    setApplyMessage,
    setLastError,
  });

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
      else void saveRotoFrame(null);
      return;
    }
    if (event.key === '?' || (event.shiftKey && event.key === '/')) {
      event.preventDefault();
      setShortcutsVisible((visible) => !visible);
      return;
    }

    if (workflowMode === 'roto') {
      if (event.key === ' ') {
        event.preventDefault();
        rotoCachedPlayback.toggle();
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const nextFrame = event.shiftKey
          ? findAdjacentSavedFrame(timelineSavedRotoFrames, currentFrame, direction)
          : Math.max(0, currentFrame + direction);
        if (nextFrame !== null) void requestRotoFrameNavigation(nextFrame);
        return;
      }
      if (key === 'g') {
        event.preventDefault();
        void requestRotoFrameNavigation(currentFrame);
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
        void saveRotoFrame(null);
        return;
      }
    }

    if (workflowMode === 'play' && (event.key === ' ' || event.key === 'Enter')) {
      event.preventDefault();
      if (isPlaying) stopPreview();
      else if (!savedPlayCacheDirty && getCachedPlayFramesForRange(framesToApply)) playPreview(framesToApply);
      else void savePlay();
    }
  }, [currentFrame, framesToApply, isPlaying, playPreview, requestRotoFrameNavigation, savePlay, saveRotoFrame, savedPlayCacheDirty, stopPreview, timelineSavedRotoFrames, rotoCachedPlayback.toggle, undo, workflowMode]);

  const onionPreviewFrames = buildOnionPreviewFrames().filter((frame) => (
    (frame.direction === 'previous' && onion.previous) || (frame.direction === 'next' && onion.next)
  ));
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
  const rotoCachedPlaybackAvailable = workflowMode === 'roto' && Boolean(launchContext) && getRotoCachedPlaybackFrames().some(Boolean);

  const updateRotoInterpolationSettings = useCallback((patch: Partial<PhysicPaintRotoInterpolationSettings>) => {
    if (!launchContext) return;
    seedRotoLaunchRealKeys(launchContext, physicPaintStore);
    const transaction = rotoTimelineActions.updateInterpolationSettings(currentFrame, patch);
    const cacheRefresh = refreshRotoInterpolationCache(
      launchContext.cachedRotoFrames,
      physicPaintStore.getRotoCacheFrames(launchContext.layerId),
      transaction.settings.enabled,
    );
    if (!transaction.settings.enabled) {
      rotoEditBuffer.setEditableFrameList((frames) => frames.filter((frame) => cacheRefresh.realDisplayFrames.includes(frame)));
      confirmedCachedRotoFramesRef.current = new Map(cacheRefresh.confirmedRealKeys);
    }
    setLaunchContext((current) => current ? {
      ...current,
      startFrame: transaction.nextCurrentFrame,
      cachedRotoFrames: cacheRefresh.frames,
      rotoInterpolationSettings: transaction.settings,
    } : current);
    if (transaction.nextCurrentFrame !== currentFrame) void sendPhysicPaintFrameSyncMessage(transaction.nextCurrentFrame, bridgeMode);
    const payload: PhysicPaintApplyPayload = {
      kind: 'update-roto-interpolation-settings',
      operationId: `${launchContext.operationId}:roto-interpolation:${Date.now()}`,
      layerId: launchContext.layerId,
      startFrame: transaction.nextCurrentFrame,
      settings: transaction.settings,
    };
    void sendPhysicPaintApplyPayload(payload, bridgeMode).catch((error) => {
      const message = `Could not sync interpolation settings to EFX Motion. ${error instanceof Error ? error.message : String(error)}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    });
    setApplyStatus(transaction.failureStatus ? 'error' : 'success');
    setApplyMessage(transaction.status);
    setLastError(transaction.failureStatus);
    rotoCachedPlayback.setStatus(transaction.status);
  }, [bridgeMode, currentFrame, launchContext, rotoCachedPlayback.setStatus, rotoTimelineActions]);

  const goToFirstFrame = useCallback(() => {
    void requestRotoFrameNavigation(0);
  }, [requestRotoFrameNavigation]);

  const goToPreviousFrame = useCallback(() => {
    void requestRotoFrameNavigation(Math.max(0, currentFrame - 1));
  }, [currentFrame, requestRotoFrameNavigation]);

  const goToNextFrame = useCallback(() => {
    void requestRotoFrameNavigation(currentFrame + 1);
  }, [currentFrame, requestRotoFrameNavigation]);

  const goToLastFrame = useCallback(() => {
    const highestSavedFrame = timelineSavedRotoFrames.reduce((max, frame) => Math.max(max, frame.frame), 0);
    const playEndFrame = latestPlayFrames.reduce((max, frame) => Math.max(max, frame.appFrame), 0);
    void requestRotoFrameNavigation(Math.max(currentFrame, highestSavedFrame, playEndFrame, framesToApply - 1));
  }, [currentFrame, framesToApply, latestPlayFrames, requestRotoFrameNavigation, timelineSavedRotoFrames]);

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
          onBrushSizeChange={setBrushSize}
          onOpacityChange={setBrushOpacity}
          onBackgroundChange={setBackground}
          onPaperGrainChange={setPaperGrain}
          onGrainStrengthChange={setGrainStrength}
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
          {playLimitToast ? (
            <div class="physics-paint-canvas-toast" role="status" aria-live="polite">
              <span>{playLimitToast}</span>
              <button type="button" aria-label="Dismiss Play duration warning" onClick={() => setPlayLimitToast(null)}>×</button>
            </div>
          ) : null}
          <PhysicsPaintCanvasStack
            cachedPlayPreviewUrl={cachedPlayPreviewUrl}
            cachedRotoReferenceUrl={cachedRotoReferenceUrl}
            cachedRotoPlaybackUrl={rotoCachedPlayback.frame?.dataUrl ?? null}
            inputDisabled={rotoInputDisabled}
            inputDisabledMessage={currentFrameIsGeneratedRoto ? `Generated frame ${currentFrame} is render-only.` : 'Saving current Roto frame…'}
            onInputIntent={workflowMode === 'play' ? beginPlayFrameEdit : beginRotoFrameEdit}
            onionOverlay={onion.enabled && onionPreviewFrames.length > 0 ? onionPreviewFrames.map((frame) => (
              <img
                key={`${frame.direction}-${frame.source}-${frame.frame}-${frame.distance}`}
                class={`physics-paint-onion-frame ${frame.kind === 'cached-composite' ? 'physics-paint-onion-cached-composite' : frame.direction === 'previous' ? 'physics-paint-onion-prev' : 'physics-paint-onion-next'}`}
                src={frame.dataUrl}
                style={{ opacity: getOnionFrameOpacity(frame.distance) }}
                alt=""
              />
            )) : null}
          >
            <PhysicsPaintCanvasMount
              key={canvasKey}
              width={canvasWidth}
              height={canvasHeight}
              paperTextureScale={paperTextureScale}
              onEngineReady={(readyEngine) => {
                handleEngineReady(readyEngine);
                if (workflowMode === 'roto') loadCachedRotoReferenceFrame(currentFrame, readyEngine as PreviewBackgroundEngine);
              }}
              onCanvasMounted={setCanvasMounted}
              onNativePenInputReady={handleNativePenInputReady}
              getStrokeMetadata={getStrokeMetadata}
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
              devExportEnabled={isPhysicsPaintDevExportEnabled(import.meta.env)}
              devExportBusy={applyStatus === 'applying'}
              applyStatus={applyStatus}
              applyMessage={applyMessage}
              error={lastError}
              onExportDebugProof={exportDebugProof}
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
          maxPlayFrameCount={launchContext?.maxPlayFrameCount}
          maxPlayFrameCountReason={launchContext?.maxPlayFrameCountReason}
          playCacheStatus={currentPlayCacheStatus}
          onPlayLimit={showPlayLimitToast}
          isPlaying={isPlaying}
          ready={readyToApply}
          occupiedRotoFrames={timelineOccupiedRotoFrames}
          savedRotoFrames={timelineSavedRotoFrames}
          cachedRotoFrames={timelineCachedRotoFrames}
          editableRotoFrames={editableRotoFrames}
          pendingRotoFrames={rotoSession.dirtyFrames.value}
          rotoSaveInFlight={Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying'}
          keyActionInFlight={rotoKeyUtilities.keyActionInFlight}
          rotoSavingFrame={rotoSavingFrame}
          rotoCachedPlaybackAvailable={rotoCachedPlaybackAvailable}
          rotoCachedPlaybackStatus={rotoCachedPlayback.status}
          rotoCachedPlaybackLoop={rotoCachedPlayback.loop}
          rotoCachedPlaybackFps={rotoCachedPlayback.fps}
          projectFps={previewFps}
          isRotoCachedPlaybackActive={rotoCachedPlayback.isActive}
          onToggleRotoPlayback={rotoCachedPlayback.toggle}
          onRotoPlaybackLoopChange={rotoCachedPlayback.setLoop}
          onRotoPlaybackFpsChange={rotoCachedPlayback.updateFps}
          rotoInterpolationSettings={launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined}
          onRotoInterpolationEnabledChange={(enabled) => updateRotoInterpolationSettings({ enabled })}
          onRotoInterpolationCountChange={(inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount })}
          onDuplicateRotoKey={duplicateRotoKey}
          onInsertRotoFrame={insertRotoFrame}
          onDeleteRotoFrame={deleteRotoFrame}
          onCopyRotoFrame={copyRotoFrame}
          onPasteRotoFrame={pasteRotoFrame}
          hasCopiedRotoKey={rotoSession.copiedKey.value !== null}
          rotoKeyState={{ actionAvailability: rotoSession.actionAvailability.value, hasCopiedRotoKey: rotoSession.copiedKey.value !== null }}
          playPublicationSummary={applyStatus === 'success' ? applyMessage : null}
          statusMessage={isPlaying ? `Previewing ${animFrame + 1} / ${animTotal}` : (applyStatus !== 'success' ? applyMessage : null)}
          onion={onion}
          onionPreviewFrames={onionPreviewFrames}
          showOnionHiddenDuringPreview={onion.enabled && isPlaying}
          missingPlayFramesForConversion={missingPlayFramesForConversion}
          onSaveRotoFrame={() => { void saveRotoFrame(null); }}
          onSavePendingRotoFrames={savePendingRotoFrames}
          onSavePlay={savePlay}
          onUpdatePlayOptions={updateSelectedPlayOptions}
          onFrameCountChange={updatePlayFrameCount}
          onPlayPreview={playPreview}
          onStopPreview={stopPreview}
          onPreviewPlayFrame={previewLocalPlayFrame}
          onNavigateToSyncedFrame={(frame) => { void requestRotoFrameNavigation(frame); }}
          onGoToFirstFrame={goToFirstFrame}
          onGoToPreviousFrame={goToPreviousFrame}
          onGoToNextFrame={goToNextFrame}
          onGoToLastFrame={goToLastFrame}
          onInspectPlayFrame={previewLocalPlayFrame}
          onOnionChange={setOnion}
          onConvertPlayToRoto={convertPlayToRoto}
          onConvertRotoToPlay={convertRotoToPlay}
        />

        {rotoClosePromptState !== 'idle' ? (
          <div class="physics-paint-confirmation physics-paint-roto-close-confirmation" role="dialog" aria-modal="true" aria-labelledby="physics-paint-roto-close-title">
            <div class="physics-paint-confirmation-card">
              <h2 id="physics-paint-roto-close-title">Close unsaved Roto frame?</h2>
              <p>The current Roto frame has unsaved changes. Choose whether to discard this edit, keep working, or save before closing.</p>
              {rotoClosePromptMessage ? (
                <p class={`physics-paint-roto-close-message ${rotoClosePromptState === 'error' ? 'error' : ''}`} role="status" aria-live="polite">{rotoClosePromptMessage}</p>
              ) : null}
              <div class="physics-paint-confirmation-actions">
                <button class="physics-paint-text-button destructive" type="button" disabled={rotoClosePromptState === 'saving'} onClick={closeWithoutSavingRotoFrame}>Close without saving</button>
                <button class="physics-paint-text-button" type="button" disabled={rotoClosePromptState === 'saving'} onClick={cancelRotoClose}>Cancel</button>
                <button class="physics-paint-text-button primary" type="button" disabled={rotoClosePromptState === 'saving'} onClick={saveAndCloseRotoFrame}>Close saving</button>
              </div>
            </div>
          </div>
        ) : null}

        {shortcutsVisible ? (
          <aside class="physics-paint-shortcuts-help" aria-label="Physics Paint shortcuts">
            <strong>Physics Paint shortcuts</strong>
            <span>Cmd+Z undo · Cmd+S save active workflow · Esc stop preview · ? help</span>
            <span>Roto: arrows navigate · O onion · [ ] onion count · Save current caches the painted frame</span>
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
