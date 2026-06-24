import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact';
import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';
import { AnimationPlayer, type AnimationWiggleConfig } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintApplyPayload, PhysicPaintApplyResult, PhysicPaintLaunchContext, PhysicPaintPlayRenderOptionsSnapshot, PhysicPaintRotoBackgroundMetadata } from '../../types/physicPaint';
import { PHYSIC_PAINT_DEFAULT_APPLY_FRAMES, clampPhysicPaintFrameCount, isPhysicPaintApplyResultMessage, isPhysicPaintLaunchContext, type PhysicPaintRenderedFrame, type PhysicPaintRotoCacheFrame, type PhysicPaintRotoInterpolationSettings } from '../../types/physicPaint';
import { PHYSIC_PAINT_APPLY_EVENT, PHYSIC_PAINT_APPLY_RESULT_EVENT, PHYSIC_PAINT_LAUNCH_EVENT } from '../../lib/physicPaintBridge';
import { physicPaintStore } from '../../stores/physicPaintStore';
import { downloadPhysicsPaintState, parsePhysicsPaintStateFile } from './physicsPaintSessionFile';
import { buildPhysicsPaintDebugManifest, buildPhysicsPaintStillExport } from './physicsPaintDevExport';
import { clampOnionCount, getPreviewFps, isPhysicsPaintDevExportEnabled, PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE, type PhysicsPaintOnionState, type PhysicsPaintWorkflowMode } from './physicsPaintWorkflowState';
import { applyRotoKeyUtilityTransactionToLocalState, type RotoKeyUtilityActiveRestore, type RotoKeyUtilityTransaction } from './physicsPaintRotoKeyController';
import { createRotoSession, type RotoSessionActionResult, type RotoSessionEffect } from './physicsPaintRotoSession';
import { PhysicsPaintRightPanel } from './PhysicsPaintRightPanel';
import { PhysicsPaintToolRail } from './PhysicsPaintToolRail';
import { PhysicsPaintTopBar } from './PhysicsPaintTopBar';
import { PhysicsPaintWorkflowStrip, type PhysicsPaintWorkflowOnionPreviewFrame, type PhysicsPaintWorkflowStripFrameMarker } from './PhysicsPaintWorkflowStrip';
import './physicsPaintStudio.css';

const CANVAS_MOUNT_ERROR = 'Unable to mount physics paint canvas: canvas wrapper did not create a canvas';
const DEFAULT_CANVAS_WIDTH = 1000;
const DEFAULT_CANVAS_HEIGHT = 650;
const DEFAULT_PLAY_WIGGLE: AnimationWiggleConfig = { strokeDeformation: 0, strokePosition: 0 };
const DEFAULT_ONION_STATE: PhysicsPaintOnionState = { enabled: false, previous: true, next: false, count: 1, opacity: 50 };
const ONION_DEPTH_OPACITY = [0.5, 0.25, 0.15] as const;
const PLAY_LIMIT_TOAST_DISMISS_MS = 5000;
type BridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable';
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error';
type RotoClosePromptState = 'idle' | 'prompt' | 'saving' | 'error';
type RenderedFramePayload = PhysicPaintRenderedFrame;
type SerializedPhysicsPaintProject = ReturnType<EfxPaintEngine['save']>;
type PreviewBackgroundEngine = EfxPaintEngine & {
  setBackgroundImageUrl: (dataUrl: string) => void;
  resetBackground: () => void;
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
  if (context.workflowMode === 'play') return context;
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

function getPlayFrameEditAssignments(state: SerializedPhysicsPaintProject): Map<number, number> {
  const assignments = new Map<number, number>();
  state.strokes.forEach((stroke, index) => {
    const playFrame = stroke.playFrame;
    if (typeof playFrame === 'number' && Number.isInteger(playFrame) && playFrame >= 0) assignments.set(index, playFrame);
  });
  return assignments;
}

function getPlayFrameCountFromAssignments(assignments: Map<number, number>, fallback: number): number {
  if (assignments.size === 0) return fallback;
  return clampPhysicPaintFrameCount(Math.max(...assignments.values()) + 1);
}

function getRealCachedRotoFrames(context: PhysicPaintLaunchContext | null): PhysicPaintRenderedFrame[] {
  return context?.cachedRotoFrames?.filter((frame) => frame.source === 'real-key') ?? [];
}

function getRealCachedRotoFrameNumbers(context: PhysicPaintLaunchContext | null): number[] {
  return getRealCachedRotoFrames(context).map((frame) => frame.appFrame).sort((a, b) => a - b);
}

function getSavedRotoMarkersFromLaunchContext(context: PhysicPaintLaunchContext | null): PhysicsPaintWorkflowStripFrameMarker[] {
  return getRealCachedRotoFrameNumbers(context).map((frame) => ({ frame, saved: true, label: `Frame ${frame}` }));
}

function upsertCachedRotoCacheFrame(frames: PhysicPaintRotoCacheFrame[] | undefined, renderedFrame: RenderedFramePayload, backgroundOnly: boolean, onionFrame?: RenderedFramePayload | null): PhysicPaintRotoCacheFrame[] {
  const cachedFrame: PhysicPaintRotoCacheFrame = {
    ...renderedFrame,
    source: 'real-key',
    ...(backgroundOnly ? { backgroundOnly: true } : {}),
    ...(onionFrame?.dataUrl ? { onionDataUrl: onionFrame.dataUrl } : {}),
  };
  return [
    ...(frames ?? []).filter((frame) => frame.appFrame !== renderedFrame.appFrame),
    cachedFrame,
  ].sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex);
}

function removeCachedRotoCacheFrame(frames: PhysicPaintRotoCacheFrame[] | undefined, appFrame: number): PhysicPaintRotoCacheFrame[] {
  return (frames ?? []).filter((frame) => frame.appFrame !== appFrame);
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
  setLocalPlayPreviewFrame?.(getLaunchPreviewFrame(context));
  setSavedPlayCacheDirty?.(getLaunchWorkflowMode(context) === 'play' && context.playCacheStatus !== 'cached');
  setPlayWiggle?.(normalizePlayWiggle(context.playRenderOptions?.motion ?? context.playMotion));
  if (context.playRenderOptions) setSettings?.(applyRenderOptionsSnapshotToSettings(context.playRenderOptions));
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

function CanvasMountProbe(props: { width: number; height: number; onEngineReady: (engine: EfxPaintEngine) => void; onCanvasMounted: (mounted: boolean) => void; onNativePenInputReady: (handler: (input: { pressure: number; tiltX?: number; tiltY?: number }) => void) => void; getStrokeMetadata?: () => { playFrame?: number } | null | undefined }) {
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
        getStrokeMetadata={props.getStrokeMetadata}
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

function shouldPersistRotoFrame(state: ReturnType<EfxPaintEngine['save']>): boolean {
  return state.strokes.length > 0 || state.settings.bgMode !== 'transparent';
}

function isBackgroundOnlyRotoFrame(state: ReturnType<EfxPaintEngine['save']>): boolean {
  return state.strokes.length === 0 && state.settings.bgMode !== 'transparent';
}

function hasEditableRotoContent(state: ReturnType<EfxPaintEngine['save']>): boolean {
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

function buildRotoFrameFromCanvas(canvas: HTMLCanvasElement, appFrame: number, size?: { width: number; height: number }): RenderedFramePayload {
  const outputCanvas = size ? drawCanvasAtSize(canvas, size) : canvas;
  return {
    frameIndex: 0,
    appFrame,
    dataUrl: outputCanvas.toDataURL('image/png'),
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
  return buildRotoFrameFromCanvas(engine.exportCompositeCanvas(), appFrame, { width, height });
}

function buildRotoOnionPreviewFrame(engine: EfxPaintEngine, appFrame: number, width: number, height: number): RenderedFramePayload {
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
  const [onion, setOnion] = useState<PhysicsPaintOnionState>(DEFAULT_ONION_STATE);
  const [playWiggle, setPlayWiggle] = useState<AnimationWiggleConfig>(() => normalizePlayWiggle(launchContext?.playMotion ?? DEFAULT_PLAY_WIGGLE));
  const [savedRotoFrames, setSavedRotoFrames] = useState<PhysicsPaintWorkflowStripFrameMarker[]>(() => getSavedRotoMarkersFromLaunchContext(launchContext));
  const [occupiedRotoFrames, setOccupiedRotoFrames] = useState<number[]>(() => getRealCachedRotoFrameNumbers(launchContext));
  const [editableRotoFrames, setEditableRotoFrames] = useState<number[]>([]);
  const [rotoSavingFrame, setRotoSavingFrame] = useState<number | null>(null);
  const [latestPlayFrames, setLatestPlayFrames] = useState<RenderedFramePayload[]>([]);
  const [playFramesVersion, setPlayFramesVersion] = useState(0);
  const [localPlayPreviewFrame, setLocalPlayPreviewFrame] = useState(() => getLaunchPreviewFrame(launchContext));
  const [cachedPlayPreviewUrl, setCachedPlayPreviewUrl] = useState<string | null>(null);
  const [cachedRotoReferenceUrl, setCachedRotoReferenceUrl] = useState<string | null>(null);
  const [isRotoCachedPlaybackActive, setIsRotoCachedPlaybackActive] = useState(false);
  const [cachedRotoPlaybackFrame, setCachedRotoPlaybackFrame] = useState<RenderedFramePayload | null>(null);
  const [rotoCachedPlaybackStatus, setRotoCachedPlaybackStatus] = useState<string | null>(null);
  const [rotoKeyActionInFlight, setRotoKeyActionInFlight] = useState(false);
  const [rotoSessionVersion, setRotoSessionVersion] = useState(0);
  const [savedPlayCacheDirty, setSavedPlayCacheDirty] = useState(false);
  const [playLimitToast, setPlayLimitToast] = useState<string | null>(null);
  const [rotoClosePromptState, setRotoClosePromptState] = useState<RotoClosePromptState>('idle');
  const [rotoClosePromptMessage, setRotoClosePromptMessage] = useState<string | null>(null);
  const [shortcutsVisible, setShortcutsVisible] = useState(false);
  const playerRef = useRef<AnimationPlayer | null>(null);
  const rotoFrameStatesRef = useRef<Map<number, ReturnType<EfxPaintEngine['save']>>>(new Map());
  const rotoPreviewFramesRef = useRef<Map<number, RenderedFramePayload>>(new Map());
  const latestPlayFramesRef = useRef<RenderedFramePayload[]>([]);
  const cachedPreviewTimerRef = useRef<number | null>(null);
  const rotoCachedPlaybackTimerRef = useRef<number | null>(null);
  const playFrameEditBaselineRef = useRef<{ frame: number; strokeCount: number } | null>(null);
  const playFrameEditAssignmentsRef = useRef<Map<number, number>>(new Map());
  const workflowModeRef = useRef<PhysicsPaintWorkflowMode>(workflowMode);
  const localPlayPreviewFrameRef = useRef(localPlayPreviewFrame);
  const activeOperationIdRef = useRef<string | null>(null);
  const pendingApplyRef = useRef<Pick<PhysicPaintApplyPayload, 'operationId' | 'kind' | 'startFrame'> | null>(null);
  const pendingRotoKeyActionMessageRef = useRef<string | null>(null);
  const closeAfterApplyOperationIdRef = useRef<string | null>(null);
  const closeAfterRotoSaveRequestedRef = useRef(false);
  const closeGuardBypassRef = useRef(false);
  const applyTimeoutRef = useRef<number | null>(null);
  const nativePenInputHandlerRef = useRef<((input: { pressure: number; tiltX?: number; tiltY?: number }) => void) | null>(null);
  const engineRef = useRef<EfxPaintEngine | null>(null);
  const pendingRotoAdvanceRef = useRef<number | null>(null);
  const saveOnLeaveSourceFrameRef = useRef<number | null>(null);
  const saveOnLeaveRenderedFrameRef = useRef<{ renderedFrame: RenderedFramePayload; backgroundOnly: boolean; onionFrame?: RenderedFramePayload | null } | null>(null);
  const saveOnLeaveDeleteFrameRef = useRef<number | null>(null);
  const dirtyRotoFramesRef = useRef<Set<number>>(new Set());
  const rotoFlushInFlightRef = useRef<Promise<PhysicPaintApplyPayload | null> | null>(null);

  const canvasWidth = launchContext?.width ?? DEFAULT_CANVAS_WIDTH;
  const canvasHeight = launchContext?.height ?? DEFAULT_CANVAS_HEIGHT;
  const canvasKey = `${canvasWidth}x${canvasHeight}`;
  const currentFrame = launchContext?.startFrame ?? 0;
  const previewFps = getPreviewFps(launchContext?.fps);
  const actionContext = useMemo<PhysicsPaintActionContext | null>(() => {
    if (!engine || !launchContext) return null;
    return { engine, launchContext, bridgeMode };
  }, [bridgeMode, engine, launchContext]);
  const rotoSession = useMemo(() => createRotoSession({
    currentFrame,
    realKeyFrames: getRealCachedRotoFrames(launchContext).map((frame): PhysicPaintRotoCacheFrame => ({ ...frame, source: 'real-key' })),
    cachedRotoFrames: launchContext?.cachedRotoFrames,
    dirtyFrames: dirtyRotoFramesRef.current,
    canvasSize: { width: canvasWidth, height: canvasHeight },
    keyActionInFlight: rotoKeyActionInFlight,
    applyStatus,
    flushInFlight: Boolean(rotoFlushInFlightRef.current),
    buildBlankRotoFrame: (frame): PhysicPaintRotoCacheFrame => ({ ...buildBlankRotoFrame(canvasWidth, canvasHeight, frame), source: 'real-key' }),
  }), [applyStatus, canvasHeight, canvasWidth, currentFrame, launchContext?.cachedRotoFrames, rotoKeyActionInFlight, rotoSessionVersion]);
  const rotoInputDisabled = workflowMode === 'roto' && Boolean(saveOnLeaveSourceFrameRef.current) && applyStatus === 'applying';

  useEffect(() => {
    setEngine(null);
    setCanvasMounted(false);
  }, [canvasKey]);

  const resetRotoSessionForLaunch = useCallback((context: PhysicPaintLaunchContext, options: { preserveCloseAfterRotoSave?: boolean } = {}) => {
    if (getLaunchWorkflowMode(context) !== 'roto') return;
    dirtyRotoFramesRef.current.clear();
    rotoFrameStatesRef.current.clear();
    rotoPreviewFramesRef.current.clear();
    pendingRotoAdvanceRef.current = null;
    saveOnLeaveSourceFrameRef.current = null;
    saveOnLeaveRenderedFrameRef.current = null;
    saveOnLeaveDeleteFrameRef.current = null;
    if (!options.preserveCloseAfterRotoSave) {
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      closeGuardBypassRef.current = false;
      pendingApplyRef.current = null;
    }
    rotoFlushInFlightRef.current = null;
    if (rotoCachedPlaybackTimerRef.current) {
      window.clearInterval(rotoCachedPlaybackTimerRef.current);
      rotoCachedPlaybackTimerRef.current = null;
    }
    setEditableRotoFrames([]);
    setRotoSessionVersion((version) => version + 1);
    setRotoSavingFrame(null);
    setCachedRotoReferenceUrl(null);
    setCachedRotoPlaybackFrame(null);
    setIsRotoCachedPlaybackActive(false);
    if (!options.preserveCloseAfterRotoSave) {
      setRotoClosePromptState('idle');
      setRotoClosePromptMessage(null);
    }
    setSavedRotoFrames(getSavedRotoMarkersFromLaunchContext(context));
    setOccupiedRotoFrames(getRealCachedRotoFrameNumbers(context));
  }, []);

  useEffect(() => {
    engineRef.current = engine;
  }, [engine]);

  useEffect(() => {
    workflowModeRef.current = workflowMode;
  }, [workflowMode]);

  useEffect(() => {
    localPlayPreviewFrameRef.current = localPlayPreviewFrame;
  }, [localPlayPreviewFrame]);

  useEffect(() => {
    setSavedRotoFrames(getSavedRotoMarkersFromLaunchContext(launchContext));
    setOccupiedRotoFrames(getRealCachedRotoFrameNumbers(launchContext));
  }, [launchContext?.cachedRotoFrames]);

  const getStrokeMetadata = useCallback(() => {
    if (workflowModeRef.current !== 'play') return null;
    const playFrame = localPlayPreviewFrameRef.current;
    return Number.isInteger(playFrame) && playFrame >= 0 ? { playFrame } : null;
  }, []);

  useEffect(() => {
    detectBridgeMode().then(setBridgeMode).catch(() => setBridgeMode('Unavailable'));
  }, []);

  const applyIncomingLaunchContext = useCallback((context: PhysicPaintLaunchContext) => {
    const preserveCloseAfterRotoSave = closeAfterRotoSaveRequestedRef.current;
    resetRotoSessionForLaunch(context, { preserveCloseAfterRotoSave });
    applyLaunchContext(context, setLaunchContext, setFramesToApply, setWorkflowMode, setLocalPlayPreviewFrame, setSavedPlayCacheDirty, setPlayWiggle, setSettings);
    const readyEngine = engineRef.current;
    if (readyEngine && getLaunchWorkflowMode(context) === 'roto') loadCachedRotoReferenceFrame(context.startFrame, readyEngine as PreviewBackgroundEngine, context);
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
  }, [resetRotoSessionForLaunch]);

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
    if (!engine || !launchContext?.playRenderOptions) return;
    const options = launchContext.playRenderOptions;
    engine.setTool(options.tool === 'erase' ? 'erase' : 'paint');
    engine.setPhysicsMode(options.tool === 'physics-paint' ? 'local' : null);
    engine.setColorHex(options.color);
    engine.setBrushOpacity(options.opacity);
    engine.setBrushSize(options.brushSize);
    engine.setBgMode(options.background);
    engine.setPaperGrain(options.paperGrain);
    engine.setEmbossStrength(options.grainStrength);
  }, [engine, launchContext?.playRenderOptions]);

  useEffect(() => {
    return () => {
      if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current);
      pendingRotoAdvanceRef.current = null;
      saveOnLeaveSourceFrameRef.current = null;
      saveOnLeaveRenderedFrameRef.current = null;
      saveOnLeaveDeleteFrameRef.current = null;
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      closeGuardBypassRef.current = false;
      if (cachedPreviewTimerRef.current) window.clearInterval(cachedPreviewTimerRef.current);
      if (rotoCachedPlaybackTimerRef.current) window.clearInterval(rotoCachedPlaybackTimerRef.current);
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

  const persistRotoBackgroundMetadata = useCallback(() => {
    if (!launchContext || workflowMode !== 'roto') return;
    physicPaintStore.setRotoBackgroundMetadata(launchContext.layerId, buildRotoBackgroundMetadata(settings));
  }, [launchContext, settings, workflowMode]);

  useEffect(() => {
    persistRotoBackgroundMetadata();
  }, [persistRotoBackgroundMetadata]);

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
    if (engine && workflowMode === 'play' && cachedFrame?.dataUrl) (engine as PreviewBackgroundEngine).setBackgroundImageUrl(cachedFrame.dataUrl);
    return Boolean(cachedFrame);
  }

  function getCachedPlayFramesForRange(frameCount: number): RenderedFramePayload[] | null {
    if (!launchContext || savedPlayCacheDirty) return null;
    const safeFrameCount = clampPhysicPaintFrameCount(frameCount);
    const frames = Array.from({ length: safeFrameCount }, (_, index) => findCachedPlayPreviewFrame(index));
    return frames.every(Boolean) ? frames as RenderedFramePayload[] : null;
  }

  function findCachedRotoReferenceFrame(appFrame: number, context: PhysicPaintLaunchContext | null = launchContext): RenderedFramePayload | null {
    if (!context) return null;
    return rotoPreviewFramesRef.current.get(appFrame)
      ?? context.cachedRotoFrames?.find((frame) => frame.appFrame === appFrame && frame.source === 'real-key')
      ?? physicPaintStore.getFrame(context.layerId, appFrame);
  }

  function loadCachedRotoReferenceFrame(
    appFrame: number,
    targetEngine: PreviewBackgroundEngine | null = engine as PreviewBackgroundEngine | null,
    context: PhysicPaintLaunchContext | null = launchContext,
  ): boolean {
    if (!targetEngine || getLaunchWorkflowMode(context) !== 'roto' || dirtyRotoFramesRef.current.has(appFrame)) {
      setCachedRotoReferenceUrl(null);
      return false;
    }
    const cachedFrame = findCachedRotoReferenceFrame(appFrame, context);
    setCachedRotoReferenceUrl(cachedFrame?.dataUrl ?? null);
    targetEngine.resetBackground();
    if (cachedFrame?.dataUrl) targetEngine.clear();
    return Boolean(cachedFrame);
  }

  function buildTransientRotoBackgroundFrame(appFrame: number): RenderedFramePayload | null {
    const metadata = launchContext ? physicPaintStore.getRotoBackgroundMetadata(launchContext.layerId) : null;
    if (!metadata || metadata.background === 'transparent') return null;
    return {
      frameIndex: 0,
      appFrame,
      dataUrl: `data:application/x-efx-roto-background,${encodeURIComponent(JSON.stringify(metadata))}`,
      width: launchContext?.width,
      height: launchContext?.height,
    };
  }

  function findCachedRotoPlaybackFrame(appFrame: number): RenderedFramePayload | null {
    return findCachedRotoReferenceFrame(appFrame) ?? buildTransientRotoBackgroundFrame(appFrame);
  }

  function getRotoCachedPlaybackFrames(): Array<RenderedFramePayload | null> {
    if (!launchContext) return [];
    const frames = new Set<number>();
    physicPaintStore.getFrames(launchContext.layerId).forEach((_, frame) => frames.add(frame));
    launchContext.cachedRotoFrames?.forEach((frame) => {
      if (frame.source === 'real-key') frames.add(frame.appFrame);
    });
    rotoPreviewFramesRef.current.forEach((_, frame) => frames.add(frame));
    savedRotoFrames.forEach((marker) => {
      if (marker.saved !== false) frames.add(marker.frame);
    });
    occupiedRotoFrames.forEach((frame) => frames.add(frame));
    frames.add(currentFrame);
    return [...frames].sort((a, b) => a - b).map((frame) => findCachedRotoPlaybackFrame(frame));
  }

  useEffect(() => {
    if (workflowMode !== 'play') return;
    if (savedPlayCacheDirty) return;
    loadCachedPlayPreviewFrame(localPlayPreviewFrame);
  }, [engine, launchContext, localPlayPreviewFrame, savedPlayCacheDirty, workflowMode]);

  useEffect(() => {
    if (workflowMode !== 'roto') return;
    loadCachedRotoReferenceFrame(currentFrame);
  }, [currentFrame, engine, launchContext, workflowMode]);

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
    const cachedFrame = savedPlayCacheDirty ? null : findCachedPlayPreviewFrame(localPlayPreviewFrame);
    if (cachedFrame?.dataUrl) (engine as PreviewBackgroundEngine).setBackgroundImageUrl(cachedFrame.dataUrl);
    if (cachedPlayPreviewUrl) setCachedPlayPreviewUrl(null);
    setSavedPlayCacheDirty(true);
    markSelectedPlayCacheDirty();
  }, [cachedPlayPreviewUrl, capturePendingPlayFrameEdits, engine, localPlayPreviewFrame, markSelectedPlayCacheDirty, savedPlayCacheDirty, workflowMode]);

  const showPlayLimitToast = useCallback((message: string) => {
    setPlayLimitToast(message);
  }, []);

  useEffect(() => {
    if (!playLimitToast) return;
    const timeout = window.setTimeout(() => setPlayLimitToast(null), PLAY_LIMIT_TOAST_DISMISS_MS);
    return () => window.clearTimeout(timeout);
  }, [playLimitToast]);

  const updatePlayFrameCount = useCallback((frameCount: number) => {
    const limit = launchContext?.maxPlayFrameCount;
    const safeFrameCount = Math.min(clampPhysicPaintFrameCount(frameCount), limit ?? Number.POSITIVE_INFINITY);
    if (limit !== undefined && frameCount > limit) showPlayLimitToast(launchContext?.maxPlayFrameCountReason ?? `Play duration limited to ${limit} frames.`);
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
  }, [launchContext?.maxPlayFrameCount, launchContext?.maxPlayFrameCountReason, markSelectedPlayCacheDirty, showPlayLimitToast, workflowMode]);

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

  const syncPendingRotoFrames = useCallback(() => {
    setRotoSessionVersion((version) => version + 1);
  }, []);

  const addEditableRotoFrame = useCallback((frame: number) => {
    setEditableRotoFrames((frames) => addOccupiedRotoFrame(frames, frame));
  }, []);

  const removeEditableRotoFrame = useCallback((frame: number) => {
    setEditableRotoFrames((frames) => frames.filter((editableFrame) => editableFrame !== frame));
  }, []);

  const stopRotoCachedPlayback = useCallback(() => {
    if (rotoCachedPlaybackTimerRef.current) {
      window.clearInterval(rotoCachedPlaybackTimerRef.current);
      rotoCachedPlaybackTimerRef.current = null;
    }
    setIsRotoCachedPlaybackActive(false);
    setCachedRotoPlaybackFrame(null);
  }, []);

  const upsertCachedRotoFrameInLaunchContext = useCallback((renderedFrame: RenderedFramePayload, backgroundOnly: boolean, onionFrame?: RenderedFramePayload | null) => {
    setLaunchContext((current) => current ? {
      ...current,
      cachedRotoFrames: upsertCachedRotoCacheFrame(current.cachedRotoFrames, renderedFrame, backgroundOnly, onionFrame),
    } : current);
  }, []);

  const removeCachedRotoFrameFromLaunchContext = useCallback((appFrame: number) => {
    setLaunchContext((current) => current ? {
      ...current,
      cachedRotoFrames: removeCachedRotoCacheFrame(current.cachedRotoFrames, appFrame),
    } : current);
  }, []);

  const markCurrentRotoFrameDirty = useCallback(() => {
    if (workflowMode !== 'roto') return;
    const appFrame = currentFrame;
    dirtyRotoFramesRef.current.add(appFrame);
    setCachedRotoReferenceUrl(null);
    setCachedRotoPlaybackFrame(null);
    (engine as PreviewBackgroundEngine | null)?.resetBackground?.();
    syncPendingRotoFrames();
  }, [currentFrame, engine, syncPendingRotoFrames, workflowMode]);

  const beginRotoFrameEdit = useCallback(() => {
    stopRotoCachedPlayback();
    markCurrentRotoFrameDirty();
  }, [markCurrentRotoFrameDirty, stopRotoCachedPlayback]);

  const clearActiveSource = useCallback(() => {
    if (!engine || !launchContext) return;
    engine.clear();
    if (workflowMode === 'roto') {
      rotoFrameStatesRef.current.delete(currentFrame);
      rotoPreviewFramesRef.current.delete(currentFrame);
      dirtyRotoFramesRef.current.add(currentFrame);
      syncPendingRotoFrames();
      setOccupiedRotoFrames((frames) => frames.filter((frame) => frame !== currentFrame));
      removeEditableRotoFrame(currentFrame);
      setSavedRotoFrames((frames) => frames.filter((frame) => frame.frame !== currentFrame));
      setCachedRotoReferenceUrl(null);
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
  }, [currentFrame, engine, framesToApply, launchContext, markSelectedPlayCacheDirty, removeEditableRotoFrame, syncPendingRotoFrames, workflowMode]);

  const dryPaint = useCallback(() => {
    engine?.forceDry();
  }, [engine]);

  const snapshotCurrentRotoFrame = useCallback(() => {
    if (!engine || !launchContext) return false;
    const appFrame = currentFrame;
    if (cachedRotoReferenceUrl && !dirtyRotoFramesRef.current.has(appFrame)) {
      rotoFrameStatesRef.current.delete(appFrame);
      rotoPreviewFramesRef.current.delete(appFrame);
      removeEditableRotoFrame(appFrame);
      return false;
    }
    const currentState = engine.save();
    if (!shouldPersistRotoFrame(currentState)) {
      rotoFrameStatesRef.current.delete(appFrame);
      rotoPreviewFramesRef.current.delete(appFrame);
      setOccupiedRotoFrames((frames) => frames.filter((occupiedFrame) => occupiedFrame !== appFrame));
      removeEditableRotoFrame(appFrame);
      return false;
    }
    rotoFrameStatesRef.current.set(appFrame, currentState);
    rotoPreviewFramesRef.current.set(appFrame, buildRotoOnionPreviewFrame(engine, appFrame, canvasWidth, canvasHeight));
    setOccupiedRotoFrames((frames) => addOccupiedRotoFrame(frames, appFrame));
    if (hasEditableRotoContent(currentState)) addEditableRotoFrame(appFrame);
    else removeEditableRotoFrame(appFrame);
    return true;
  }, [addEditableRotoFrame, cachedRotoReferenceUrl, canvasHeight, canvasWidth, currentFrame, engine, launchContext, removeEditableRotoFrame]);

  const toggleRotoCachedPlayback = useCallback(() => {
    if (isRotoCachedPlaybackActive) {
      stopRotoCachedPlayback();
      setRotoCachedPlaybackStatus('Cached Roto playback stopped.');
      return;
    }
    const cachedFrames = getRotoCachedPlaybackFrames();
    if (cachedFrames.length === 0) {
      setRotoCachedPlaybackStatus('No cached Roto frames yet. Missing frames play transparent/background.');
      return;
    }
    const missingCount = cachedFrames.filter((frame) => !frame).length;
    let frameIndex = 0;
    setIsRotoCachedPlaybackActive(true);
    setIsPlaying(true);
    setAnimTotal(cachedFrames.length);
    setRotoCachedPlaybackStatus(missingCount > 0
      ? `Playing cached Roto frames. ${missingCount} missing frame(s). Missing frames play transparent/background.`
      : `Playing ${cachedFrames.length} cached Roto frame(s). Missing frames play transparent/background.`);
    const showNextCachedRotoFrame = () => {
      const cachedFrame = cachedFrames[frameIndex];
      setAnimFrame(frameIndex);
      setCachedRotoPlaybackFrame(cachedFrame ?? null);
      frameIndex += 1;
      if (frameIndex >= cachedFrames.length) {
        if (rotoCachedPlaybackTimerRef.current) window.clearInterval(rotoCachedPlaybackTimerRef.current);
        rotoCachedPlaybackTimerRef.current = null;
        setIsRotoCachedPlaybackActive(false);
        setIsPlaying(false);
      }
    };
    showNextCachedRotoFrame();
    if (cachedFrames.length > 1) {
      rotoCachedPlaybackTimerRef.current = window.setInterval(showNextCachedRotoFrame, 1000 / previewFps);
    }
  }, [currentFrame, isRotoCachedPlaybackActive, launchContext, occupiedRotoFrames, previewFps, savedRotoFrames, stopRotoCachedPlayback]);

  const playPreview = useCallback((frameCount: number) => {
    if (!playerRef.current || !engine) return;
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
    capturePendingPlayFrameEdits();
    const previewState = annotatePlayFrameStrokes(engine.save(), playFrameEditAssignmentsRef.current);
    (engine as PreviewBackgroundEngine).resetBackground();
    engine.load(previewState);
    playerRef.current.play({
      frameCount: safeFrameCount,
      fps: previewFps,
      wiggle: playWiggle,
      onFrame: (frameIndex) => setAnimFrame(frameIndex),
      onComplete: () => setIsPlaying(false),
    });
  }, [capturePendingPlayFrameEdits, engine, playWiggle, previewFps]);

  const stopPreview = useCallback(() => {
    if (cachedPreviewTimerRef.current) {
      window.clearInterval(cachedPreviewTimerRef.current);
      cachedPreviewTimerRef.current = null;
    }
    stopRotoCachedPlayback();
    if (!playerRef.current) {
      setIsPlaying(false);
      return;
    }
    playerRef.current.stop();
    setIsPlaying(false);
  }, [stopRotoCachedPlayback]);

  const closePhysicsPaintWindow = useCallback(async () => {
    try {
      const windowApi = await import('@tauri-apps/api/window');
      const appWindow = windowApi.getCurrentWindow();
      if (typeof appWindow.close === 'function') {
        await appWindow.close();
        return;
      }
    } catch {
      // Browser fallback below is expected outside Tauri.
    }
    window.close();
  }, []);

  const startApplyTimeout = useCallback((operationId: string) => {
    if (applyTimeoutRef.current) window.clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = window.setTimeout(() => {
      if (activeOperationIdRef.current !== operationId) return;
      const saveOnLeaveSourceFrame = saveOnLeaveSourceFrameRef.current;
      const message = saveOnLeaveSourceFrame !== null
        ? `Could not save frame ${saveOnLeaveSourceFrame}. Stay on this frame and try navigating again to retry.`
        : 'Could not apply physics paint output. The main editor did not return an apply result.';
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
      if (saveOnLeaveSourceFrame !== null) {
        dirtyRotoFramesRef.current.add(saveOnLeaveSourceFrame);
        syncPendingRotoFrames();
      }
      saveOnLeaveSourceFrameRef.current = null;
      saveOnLeaveRenderedFrameRef.current = null;
      saveOnLeaveDeleteFrameRef.current = null;
      setRotoSavingFrame(null);
      if (closeAfterApplyOperationIdRef.current === operationId) {
        setRotoClosePromptState('error');
        setRotoClosePromptMessage('Could not save before closing. The main editor did not return an apply result.');
        closeAfterApplyOperationIdRef.current = null;
      }
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      pendingRotoKeyActionMessageRef.current = null;
      pendingRotoAdvanceRef.current = null;
      applyTimeoutRef.current = null;
    }, 5000);
  }, [syncPendingRotoFrames]);

  const flushRotoFrame = useCallback(async (frame: number, options: { force?: boolean; advanceToFrame?: number | null; onPayload?: (payload: PhysicPaintApplyPayload) => void } = {}) => {
    if (!actionContext || !Number.isInteger(frame) || frame < 0) return null;
    if (!options.force && !dirtyRotoFramesRef.current.has(frame)) return null;
    if (rotoFlushInFlightRef.current) return rotoFlushInFlightRef.current;

    const flushPromise = (async () => {
      const { engine, launchContext, bridgeMode } = actionContext;
      const liveState = engine.save();
      const previousState = frame === currentFrame ? null : liveState;
      const editableState = frame === currentFrame
        ? liveState
        : rotoFrameStatesRef.current.get(frame);
      if (!editableState || !shouldPersistRotoFrame(editableState)) {
        try {
          setApplyStatus('applying');
          setApplyMessage('Saving current frame…');
          setLastError(null);
          const operationId = `${launchContext.operationId}:delete-roto:${frame}:${Date.now()}`;
          activeOperationIdRef.current = operationId;
          pendingRotoAdvanceRef.current = options.advanceToFrame ?? null;
          if (rotoSession.savingFrame.value !== frame && options.advanceToFrame !== null && options.advanceToFrame !== undefined) {
            void rotoSession.requestFrame(options.advanceToFrame);
          }
          const payload: PhysicPaintApplyPayload = {
            operationId,
            kind: 'delete-roto-frame',
            layerId: launchContext.layerId,
            startFrame: frame,
          };
          pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: frame };
          options.onPayload?.(payload);
          await sendPhysicPaintApplyPayload(payload, bridgeMode);
          if (saveOnLeaveSourceFrameRef.current === frame) {
            saveOnLeaveDeleteFrameRef.current = frame;
          } else {
            dirtyRotoFramesRef.current.delete(frame);
            removeCachedRotoFrameFromLaunchContext(frame);
          }
          syncPendingRotoFrames();
          startApplyTimeout(operationId);
          return payload;
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
          setApplyStatus('error');
          setApplyMessage(message);
          setLastError(message);
          pendingRotoAdvanceRef.current = null;
          pendingApplyRef.current = null;
          saveOnLeaveSourceFrameRef.current = null;
          saveOnLeaveRenderedFrameRef.current = null;
          saveOnLeaveDeleteFrameRef.current = null;
          setRotoSavingFrame(null);
          return null;
        }
      }

      try {
        if (frame !== currentFrame) engine.load(editableState);
        rotoFrameStatesRef.current.set(frame, editableState);
        setCachedRotoReferenceUrl(null);
        (engine as PreviewBackgroundEngine).resetBackground();
        const backgroundOnly = isBackgroundOnlyRotoFrame(editableState);
        const renderedFrame = buildRotoOutputFrame(engine, frame, canvasWidth, canvasHeight);
        const onionFrame = backgroundOnly ? null : buildRotoOnionPreviewFrame(engine, frame, canvasWidth, canvasHeight);
        rotoPreviewFramesRef.current.set(frame, onionFrame ?? renderedFrame);
        setOccupiedRotoFrames((frames) => addOccupiedRotoFrame(frames, frame));
        if (backgroundOnly) {
          removeEditableRotoFrame(frame);
        } else {
          addEditableRotoFrame(frame);
        }
        setApplyStatus('applying');
        setApplyMessage('Saving current frame…');
        setLastError(null);
        const operationId = `${launchContext.operationId}:canvas:${frame}:${Date.now()}`;
        activeOperationIdRef.current = operationId;
        pendingRotoAdvanceRef.current = options.advanceToFrame ?? null;
        const payload: PhysicPaintApplyPayload = {
          operationId,
          kind: 'apply-canvas',
          layerId: launchContext.layerId,
          startFrame: frame,
          editableState,
          renderedFrame,
          ...(backgroundOnly ? { backgroundOnly: true } : {}),
          ...(onionFrame?.dataUrl ? { onionDataUrl: onionFrame.dataUrl } : {}),
        };
        pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: frame };
        if (rotoSession.savingFrame.value !== frame && options.advanceToFrame !== null && options.advanceToFrame !== undefined) {
          void rotoSession.requestFrame(options.advanceToFrame);
        }
        options.onPayload?.(payload);
        await sendPhysicPaintApplyPayload(payload, bridgeMode);
        if (saveOnLeaveSourceFrameRef.current === frame) {
          saveOnLeaveRenderedFrameRef.current = { renderedFrame, backgroundOnly, onionFrame };
        } else {
          dirtyRotoFramesRef.current.delete(frame);
          upsertCachedRotoFrameInLaunchContext(renderedFrame, backgroundOnly, onionFrame);
        }
        syncPendingRotoFrames();
        startApplyTimeout(operationId);
        return payload;
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
        setApplyStatus('error');
        setApplyMessage(message);
        setLastError(message);
        pendingRotoAdvanceRef.current = null;
        saveOnLeaveSourceFrameRef.current = null;
        saveOnLeaveRenderedFrameRef.current = null;
        saveOnLeaveDeleteFrameRef.current = null;
        setRotoSavingFrame(null);
        return null;
      } finally {
        if (previousState) engine.load(previousState);
        rotoFlushInFlightRef.current = null;
      }
    })();

    rotoFlushInFlightRef.current = flushPromise;
    return flushPromise;
  }, [actionContext, addEditableRotoFrame, canvasHeight, canvasWidth, currentFrame, removeCachedRotoFrameFromLaunchContext, removeEditableRotoFrame, rotoSession, startApplyTimeout, syncPendingRotoFrames, upsertCachedRotoFrameInLaunchContext]);

  const navigateToSyncedFrame = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    if (rotoFlushInFlightRef.current || applyStatus === 'applying') return false;
    stopRotoCachedPlayback();
    setCachedRotoReferenceUrl(null);
    setCachedRotoPlaybackFrame(null);
    if (engine && launchContext) {
      snapshotCurrentRotoFrame();
      const nextState = rotoFrameStatesRef.current.get(frame);
      if (nextState) {
        engine.load(nextState);
      } else {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame);
      }
    }
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [applyStatus, bridgeMode, engine, launchContext, snapshotCurrentRotoFrame, stopRotoCachedPlayback]);

  const openSyncedRotoFrameAfterSave = useCallback(async (frame: number) => {
    if (!Number.isInteger(frame) || frame < 0) return false;
    stopRotoCachedPlayback();
    setCachedRotoReferenceUrl(null);
    setCachedRotoPlaybackFrame(null);
    if (engine && launchContext) {
      const nextState = rotoFrameStatesRef.current.get(frame);
      if (nextState) {
        engine.load(nextState);
      } else {
        (engine as PreviewBackgroundEngine).resetBackground();
        engine.clear();
        loadCachedRotoReferenceFrame(frame);
      }
    }
    setLaunchContext((current) => current ? { ...current, startFrame: frame } : current);
    await sendPhysicPaintFrameSyncMessage(frame, bridgeMode);
    return true;
  }, [bridgeMode, engine, launchContext, stopRotoCachedPlayback]);

  const syncRotoKeyFrameLists = useCallback((frames: number[], cacheFrames?: readonly PhysicPaintRotoCacheFrame[]) => {
    setOccupiedRotoFrames(frames);
    setSavedRotoFrames((markers) => frames.map((frame) => markers.find(marker => marker.frame === frame) ?? { frame, saved: true, label: `Frame ${frame}` }));
    if (!cacheFrames) return;
    setLaunchContext((current) => current ? {
      ...current,
      cachedRotoFrames: [...cacheFrames].sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex),
    } : current);
  }, []);

  const persistRotoKeyFrameTransaction = useCallback(async (transaction: RotoKeyUtilityTransaction) => {
    if (!launchContext || actionContext?.bridgeMode === 'Unavailable') throw new Error('App bridge is not connected.');
    if (transaction.realKeyFrames.length !== transaction.realKeyFrameNumbers.length) throw new Error('Roto key cache is incomplete after the action.');
    const operationId = `${launchContext.operationId}:roto-keys:${Date.now()}`;
    const payload: PhysicPaintApplyPayload = {
      operationId,
      kind: 'replace-roto-key-frames',
      layerId: launchContext.layerId,
      startFrame: transaction.activeFrame,
      frames: transaction.realKeyFrames,
    };
    activeOperationIdRef.current = operationId;
    pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: payload.startFrame };
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

  const applyRotoKeyUtilityTransaction = useCallback((transaction: RotoKeyUtilityTransaction) => {
    if (!launchContext) return;
    const nextLocalState = applyRotoKeyUtilityTransactionToLocalState({
      editableStates: rotoFrameStatesRef.current,
      previewFrames: rotoPreviewFramesRef.current,
      transaction,
    });
    rotoFrameStatesRef.current = nextLocalState.editableStates as Map<number, ReturnType<EfxPaintEngine['save']>>;
    rotoPreviewFramesRef.current = nextLocalState.previewFrames as Map<number, RenderedFramePayload>;
    syncRotoKeyFrameLists(transaction.realKeyFrameNumbers, transaction.realKeyFrames);
  }, [launchContext, syncRotoKeyFrameLists]);

  const executeRotoSessionEffects = useCallback(async (effects: readonly RotoSessionEffect[]) => {
    for (const effect of effects) {
      switch (effect.type) {
        case 'saveFrame': {
          saveOnLeaveSourceFrameRef.current = effect.frame;
          setRotoSavingFrame(effect.frame);
          pendingRotoAdvanceRef.current = effect.after.type === 'navigate' ? effect.after.frame : null;
          setApplyStatus('applying');
          const actionCopy = effect.after.type === 'keyAction' ? effect.after.operation : null;
          setApplyMessage(effect.reason === 'beforeNavigate'
            ? `Saving frame ${effect.frame} before navigation...`
            : `Saving frame ${effect.frame} before ${actionCopy ?? 'key action'}...`);
          const payload = await flushRotoFrame(effect.frame, { force: true, advanceToFrame: effect.after.type === 'navigate' ? effect.after.frame : null });
          if (!payload) {
            const failed = rotoSession.onSaveFailed(effect.frame, effect.reason === 'beforeNavigate' ? 'Stay on this frame and try navigating again to retry.' : `${actionCopy ?? 'Key action'} was cancelled.`);
            dirtyRotoFramesRef.current = new Set(failed.ok ? rotoSession.dirtyFrames.value : rotoSession.dirtyFrames.value);
            syncPendingRotoFrames();
            setRotoSavingFrame(null);
            setApplyStatus('error');
            if (failed.message) setApplyMessage(failed.message);
          }
          break;
        }
        case 'replaceKeys':
          applyRotoKeyUtilityTransaction(effect.transaction);
          for (const frame of effect.transaction.cleanup.generatedFrames) physicPaintStore.removeFrameRange(launchContext?.layerId ?? '', frame, 1);
          for (const frame of effect.transaction.cleanup.deletedFrames) physicPaintStore.removeRealRotoKeyFrame(launchContext?.layerId ?? '', frame);
          await persistRotoKeyFrameTransaction(effect.transaction);
          break;
        case 'restoreFrame':
          restoreRotoFrameFromSessionEffect(effect);
          break;
        case 'clearCanvas':
          setCachedRotoReferenceUrl(null);
          if (engine && effect.frame === currentFrame) {
            (engine as PreviewBackgroundEngine).resetBackground();
            engine.clear();
          }
          break;
        case 'showCachedReference':
          setCachedRotoReferenceUrl(effect.frameData.dataUrl);
          break;
        case 'navigate':
          await openSyncedRotoFrameAfterSave(effect.frame);
          break;
        case 'clearGeneratedFrames':
          for (const frame of effect.frames) if (launchContext) physicPaintStore.removeFrameRange(launchContext.layerId, frame, 1);
          break;
        case 'clearCachedReferences':
          for (const frame of effect.frames) removeCachedRotoFrameFromLaunchContext(frame);
          break;
        case 'clearDeletedFrames':
          for (const frame of effect.frames) if (launchContext) physicPaintStore.removeRealRotoKeyFrame(launchContext.layerId, frame);
          break;
        default: {
          const exhaustive: never = effect;
          throw new Error(`Unknown Roto session effect: ${JSON.stringify(exhaustive)}`);
        }
      }
    }
  }, [applyRotoKeyUtilityTransaction, currentFrame, engine, flushRotoFrame, launchContext, openSyncedRotoFrameAfterSave, persistRotoKeyFrameTransaction, removeCachedRotoFrameFromLaunchContext, restoreRotoFrameFromSessionEffect, rotoSession, syncPendingRotoFrames]);

  const runRotoSessionResult = useCallback(async (result: RotoSessionActionResult) => {
    if (!result.ok) {
      if (result.message) setApplyMessage(result.message);
      return;
    }
    setRotoKeyActionInFlight(true);
    try {
      await executeRotoSessionEffects(result.effects);
      if (result.message) setApplyMessage(result.message);
      setLastError(null);
      dirtyRotoFramesRef.current = new Set(rotoSession.dirtyFrames.value);
      syncPendingRotoFrames();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not complete Roto session action. ${detail}`;
      pendingRotoKeyActionMessageRef.current = null;
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    } finally {
      setRotoKeyActionInFlight(false);
      setRotoSavingFrame(null);
    }
  }, [executeRotoSessionEffects, rotoSession, syncPendingRotoFrames]);

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

  const handleApplyResult = useCallback((detail: PhysicPaintApplyResult | null | undefined) => {
    if (!detail || detail.operationId !== activeOperationIdRef.current) return;
    const pendingApply = pendingApplyRef.current;
    const shouldCloseAfterSave = closeAfterApplyOperationIdRef.current === detail.operationId || (closeAfterRotoSaveRequestedRef.current && pendingApply?.operationId === detail.operationId);
    if (!pendingApply || detail.kind !== pendingApply.kind || detail.startFrame !== pendingApply.startFrame) {
      setApplyStatus('error');
      setApplyMessage('Ignored mismatched physics paint apply result. Try saving again.');
      setLastError('Ignored mismatched physics paint apply result. Try saving again.');
      return;
    }
    if (applyTimeoutRef.current) {
      window.clearTimeout(applyTimeoutRef.current);
      applyTimeoutRef.current = null;
    }
    activeOperationIdRef.current = null;
    pendingApplyRef.current = null;

    if (!detail.ok) {
      const saveOnLeaveSourceFrame = saveOnLeaveSourceFrameRef.current;
      const message = saveOnLeaveSourceFrame !== null
        ? `Could not save frame ${saveOnLeaveSourceFrame}. Stay on this frame and try navigating again to retry.`
        : 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.';
      pendingRotoAdvanceRef.current = null;
      pendingRotoKeyActionMessageRef.current = null;
      saveOnLeaveSourceFrameRef.current = null;
      saveOnLeaveRenderedFrameRef.current = null;
      saveOnLeaveDeleteFrameRef.current = null;
      setRotoSavingFrame(null);
      if (saveOnLeaveSourceFrame !== null) {
        const failed = rotoSession.onSaveFailed(saveOnLeaveSourceFrame, 'Stay on this frame and try navigating again to retry.');
        dirtyRotoFramesRef.current = new Set(rotoSession.dirtyFrames.value);
        syncPendingRotoFrames();
        if (failed.message) setApplyMessage(failed.message);
      }
      if (shouldCloseAfterSave) {
        closeAfterApplyOperationIdRef.current = null;
        closeAfterRotoSaveRequestedRef.current = false;
        setRotoClosePromptState('error');
        setRotoClosePromptMessage('Could not save before closing. Keep the window open and try again.');
      }
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
    if (detail.kind === 'replace-roto-key-frames') {
      setApplyMessage(pendingRotoKeyActionMessageRef.current ?? 'Saved Roto key changes.');
      pendingRotoKeyActionMessageRef.current = null;
    } else if (detail.kind === 'update-play-render-options') {
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
    } else {
      const frame = detail.startFrame;
      const nextFrame = pendingRotoAdvanceRef.current;
      const deletedFrame = saveOnLeaveDeleteFrameRef.current === frame;
      if (saveOnLeaveSourceFrameRef.current === frame && saveOnLeaveRenderedFrameRef.current) {
        upsertCachedRotoFrameInLaunchContext(saveOnLeaveRenderedFrameRef.current.renderedFrame, saveOnLeaveRenderedFrameRef.current.backgroundOnly, saveOnLeaveRenderedFrameRef.current.onionFrame);
      } else if (deletedFrame) {
        removeCachedRotoFrameFromLaunchContext(frame);
      }
      const saved = rotoSession.savingFrame.value === frame ? rotoSession.onSaveSucceeded(frame) : null;
      dirtyRotoFramesRef.current.delete(frame);
      if (saved) dirtyRotoFramesRef.current = new Set(rotoSession.dirtyFrames.value);
      syncPendingRotoFrames();
      if (saved?.effects.length) void executeRotoSessionEffects(saved.effects);
      if (deletedFrame) {
        setSavedRotoFrames((frames) => frames.filter((savedFrame) => savedFrame.frame !== frame));
        setOccupiedRotoFrames((frames) => frames.filter((occupiedFrame) => occupiedFrame !== frame));
        removeEditableRotoFrame(frame);
      } else {
        setSavedRotoFrames((frames) => [
          ...frames.filter((savedFrame) => savedFrame.frame !== frame),
          { frame, saved: true, label: `Frame ${frame}` },
        ].sort((a, b) => a.frame - b.frame));
      }
      pendingRotoAdvanceRef.current = null;
      saveOnLeaveSourceFrameRef.current = null;
      saveOnLeaveRenderedFrameRef.current = null;
      saveOnLeaveDeleteFrameRef.current = null;
      setRotoSavingFrame(null);
      if (nextFrame !== null) {
        void openSyncedRotoFrameAfterSave(nextFrame).then(() => {
          setApplyMessage(`Saved roto frame ${frame}. Advanced to frame ${nextFrame}.`);
        });
      } else {
        setApplyMessage('Saved current frame');
      }
      if (shouldCloseAfterSave) {
        closeGuardBypassRef.current = true;
        void closePhysicsPaintWindow();
      }
    }
  }, [canvasHeight, canvasWidth, closePhysicsPaintWindow, executeRotoSessionEffects, openSyncedRotoFrameAfterSave, rotoSession, syncPendingRotoFrames, upsertCachedRotoFrameInLaunchContext]);

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

  const saveRotoFrame = useCallback(async (advanceToFrame: number | null = null, options: { onPayload?: (payload: PhysicPaintApplyPayload) => void } = {}) => {
    if (!readyToApply) return null;
    snapshotCurrentRotoFrame();
    dirtyRotoFramesRef.current.add(currentFrame);
    syncPendingRotoFrames();
    return flushRotoFrame(currentFrame, { force: true, advanceToFrame, onPayload: options.onPayload });
  }, [currentFrame, flushRotoFrame, readyToApply, snapshotCurrentRotoFrame, syncPendingRotoFrames]);

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
      pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: payload.startFrame };
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      const changed = JSON.stringify(launchContext.playRenderOptions ?? null) !== JSON.stringify(renderOptions);
      setLaunchContext((current) => current ? {
        ...withoutRotoGapLimit(current),
        playRenderOptions: renderOptions,
        playMotion: renderOptions.motion,
        playCacheStatus: changed ? 'stale' : current.playCacheStatus,
        cachedPlayFrames: changed ? [] : current.cachedPlayFrames,
      } : current);
      if (changed) {
        latestPlayFramesRef.current = [];
        setLatestPlayFrames([]);
        setCachedPlayPreviewUrl(null);
        setSavedPlayCacheDirty(true);
        setPlayFramesVersion((version) => version + 1);
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
    if (!actionContext || !readyToApply || !playerRef.current) return null;
    const { engine, launchContext, bridgeMode } = actionContext;
    const frameCount = clampPhysicPaintFrameCount(framesToApply);
    const playStartFrame = getActivePlayStartFrame(launchContext, currentFrame);
    const renderOptions = buildPlayRenderOptionsSnapshot(settings, playWiggle);
    capturePendingPlayFrameEdits();
    const editableState = annotatePlayFrameStrokes(engine.save(), playFrameEditAssignmentsRef.current);
    (engine as PreviewBackgroundEngine).resetBackground();
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
        renderOptions,
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
        playRenderOptions: renderOptions,
        cachedPlayFrames: frames,
        previewFrame: 0,
      } : current);
      pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: payload.startFrame };
      await sendPhysicPaintApplyPayload(payload, bridgeMode);
      startApplyTimeout(operationId);
      return payload;
    } catch (error) {
      playerRef.current?.stop();
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
  }, [actionContext, capturePendingPlayFrameEdits, currentFrame, framesToApply, playWiggle, previewFps, readyToApply, settings, startApplyTimeout]);

  const savePendingRotoFrames = useCallback(async () => {
    snapshotCurrentRotoFrame();
    const frames = Array.from(dirtyRotoFramesRef.current).sort((a, b) => a - b);
    if (frames.length === 0) return null;
    let lastPayload: PhysicPaintApplyPayload | null = null;
    for (const frame of frames) {
      const payload = await flushRotoFrame(frame, { force: true });
      if (payload) lastPayload = payload;
    }
    return lastPayload;
  }, [flushRotoFrame, snapshotCurrentRotoFrame]);

  const requireCurrentRealRotoKey = useCallback(() => {
    const actionState = rotoSession.actionAvailability.value;
    if (actionState.currentIsRealKey) return true;
    setApplyMessage(actionState.disabledReason ?? 'Key utilities require a real Roto key. Generated in-betweens are render-only.');
    return false;
  }, [rotoSession]);

  const duplicateRotoKey = useCallback(() => {
    if (rotoKeyActionInFlight || Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying') return;
    if (!requireCurrentRealRotoKey()) return;
    snapshotCurrentRotoFrame();
    void runRotoSessionResult(rotoSession.duplicateKey());
  }, [applyStatus, requireCurrentRealRotoKey, rotoKeyActionInFlight, rotoSession, runRotoSessionResult, snapshotCurrentRotoFrame]);

  const insertRotoFrame = useCallback(() => {
    if (rotoKeyActionInFlight || Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying') return;
    if (!requireCurrentRealRotoKey()) return;
    snapshotCurrentRotoFrame();
    void runRotoSessionResult(rotoSession.insertBlankKey());
  }, [applyStatus, requireCurrentRealRotoKey, rotoKeyActionInFlight, rotoSession, runRotoSessionResult, snapshotCurrentRotoFrame]);

  const deleteRotoFrame = useCallback(() => {
    if (rotoKeyActionInFlight || Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying') return;
    if (!requireCurrentRealRotoKey()) return;
    snapshotCurrentRotoFrame();
    void runRotoSessionResult(rotoSession.deleteKey());
  }, [applyStatus, requireCurrentRealRotoKey, rotoKeyActionInFlight, rotoSession, runRotoSessionResult, snapshotCurrentRotoFrame]);

  const copyRotoFrame = useCallback(() => {
    if (rotoKeyActionInFlight || Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying') return;
    if (!requireCurrentRealRotoKey()) return;
    snapshotCurrentRotoFrame();
    void runRotoSessionResult(rotoSession.copyKey());
  }, [applyStatus, requireCurrentRealRotoKey, rotoKeyActionInFlight, rotoSession, runRotoSessionResult, snapshotCurrentRotoFrame]);

  const pasteRotoFrame = useCallback(() => {
    if (rotoKeyActionInFlight || Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying') return;
    snapshotCurrentRotoFrame();
    void runRotoSessionResult(rotoSession.pasteKey());
  }, [applyStatus, rotoKeyActionInFlight, rotoSession, runRotoSessionResult, snapshotCurrentRotoFrame]);

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
        if (workflowMode === 'play') {
          const assignments = getPlayFrameEditAssignments(state);
          const frameCount = getPlayFrameCountFromAssignments(assignments, framesToApply);
          const previewFrame = assignments.values().next().value ?? 0;
          playFrameEditAssignmentsRef.current = assignments;
          playFrameEditBaselineRef.current = { frame: previewFrame, strokeCount: state.strokes.length };
          latestPlayFramesRef.current = [];
          setLatestPlayFrames([]);
          setCachedPlayPreviewUrl(null);
          setSavedPlayCacheDirty(true);
          setLocalPlayPreviewFrame(previewFrame);
          setFramesToApply(frameCount);
          setPlayFramesVersion((version) => version + 1);
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
    const addOnionCandidate = (frame: RenderedFramePayload & Partial<Pick<PhysicPaintRotoCacheFrame, 'backgroundOnly' | 'onionDataUrl' | 'source'>>) => {
      if (frame.source && frame.source !== 'real-key') return;
      if (frame.backgroundOnly) return;
      candidates.set(frame.appFrame, typeof frame.onionDataUrl === 'string'
        ? { ...frame, dataUrl: frame.onionDataUrl, onionKind: 'stroke-preview' }
        : { ...frame, onionKind: frame.source === 'real-key' ? 'cached-composite' : 'stroke-preview' });
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
      pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: payload.startFrame };
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
      pendingApplyRef.current = null;
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
    const renderOptions = buildPlayRenderOptionsSnapshot(settings, playWiggle);
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
      renderOptions,
    };
    try {
      setApplyStatus('applying');
      setApplyMessage('Applying physics paint output...');
      setLastError(null);
      activeOperationIdRef.current = operationId;
      pendingApplyRef.current = { operationId, kind: payload.kind, startFrame: payload.startFrame };
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
        playRenderOptions: renderOptions,
        cachedPlayFrames: [],
        previewFrame: 0,
      } : current);
      setWorkflowMode('play');
    } catch (error) {
      activeOperationIdRef.current = null;
      pendingApplyRef.current = null;
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`;
      setApplyStatus('error');
      setApplyMessage(message);
      setLastError(message);
    }
  }, [actionContext, currentFrame, framesToApply, playWiggle, settings, startApplyTimeout]);

  useEffect(() => {
    const handleBeforeUnload = (_event: BeforeUnloadEvent) => {
      if (workflowMode !== 'roto') return;
      snapshotCurrentRotoFrame();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [snapshotCurrentRotoFrame, workflowMode]);

  const closeWithoutSavingRotoFrame = useCallback(() => {
    closeAfterApplyOperationIdRef.current = null;
    closeGuardBypassRef.current = true;
    setRotoClosePromptState('idle');
    setRotoClosePromptMessage(null);
    void closePhysicsPaintWindow();
  }, [closePhysicsPaintWindow]);

  const cancelRotoClose = useCallback(() => {
    closeAfterApplyOperationIdRef.current = null;
    closeGuardBypassRef.current = false;
    setRotoClosePromptState('idle');
    setRotoClosePromptMessage(null);
  }, []);

  const saveAndCloseRotoFrame = useCallback(async () => {
    if (closeAfterRotoSaveRequestedRef.current) return;
    closeAfterRotoSaveRequestedRef.current = true;
    closeGuardBypassRef.current = true;
    setRotoClosePromptState('idle');
    setRotoClosePromptMessage(null);
    try {
      const payload = await saveRotoFrame(null, {
        onPayload: (payload) => {
          closeAfterApplyOperationIdRef.current = payload.operationId;
          if (payload.kind === 'apply-canvas') payload.closeWindowAfterApply = true;
        },
      });
      if (!payload?.operationId) {
        closeAfterApplyOperationIdRef.current = null;
        closeAfterRotoSaveRequestedRef.current = false;
        closeGuardBypassRef.current = false;
        setRotoClosePromptState('error');
        setRotoClosePromptMessage('Could not save before closing. Try Save current, then close again.');
      }
    } catch (error) {
      closeAfterApplyOperationIdRef.current = null;
      closeAfterRotoSaveRequestedRef.current = false;
      closeGuardBypassRef.current = false;
      const detail = error instanceof Error ? error.message : String(error);
      setRotoClosePromptState('error');
      setRotoClosePromptMessage(`Could not save before closing. ${detail}`);
    }
  }, [saveRotoFrame]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const installCloseHandler = async () => {
      try {
        const windowApi = await import('@tauri-apps/api/window');
        const appWindow = windowApi.getCurrentWindow();
        if (typeof appWindow.onCloseRequested !== 'function') return;
        unlisten = await appWindow.onCloseRequested(async (event) => {
          if (disposed || workflowMode !== 'roto') return;
          if (closeGuardBypassRef.current || closeAfterRotoSaveRequestedRef.current) return;
          snapshotCurrentRotoFrame();
          const isCurrentRotoFrameDirty = workflowMode === 'roto' && dirtyRotoFramesRef.current.has(currentFrame);
          if (!isCurrentRotoFrameDirty) return;
          event.preventDefault();
          setRotoClosePromptState('prompt');
          setRotoClosePromptMessage(null);
        });
        if (disposed) unlisten?.();
      } catch (error) {
        console.warn('[PhysicsPaintStudio] Tauri close listener unavailable', error);
      }
    };
    void installCloseHandler();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [currentFrame, snapshotCurrentRotoFrame, workflowMode]);

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
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        const nextFrame = event.shiftKey
          ? findAdjacentSavedFrame(savedRotoFrames, currentFrame, direction)
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
  }, [currentFrame, framesToApply, isPlaying, playPreview, requestRotoFrameNavigation, savePlay, saveRotoFrame, savedPlayCacheDirty, savedRotoFrames, stopPreview, undo, workflowMode]);

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

  useEffect(() => {
    if (workflowMode !== 'roto') stopRotoCachedPlayback();
  }, [stopRotoCachedPlayback, workflowMode]);

  const updateRotoInterpolationSettings = useCallback((patch: Partial<PhysicPaintRotoInterpolationSettings>) => {
    if (!launchContext) return;
    const settings = {
      ...physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
      ...patch,
    };
    physicPaintStore.setRotoInterpolationSettings(launchContext.layerId, settings);
    physicPaintStore.regenerateRotoInterpolationCache(launchContext.layerId);
    setLaunchContext((current) => current ? {
      ...current,
      cachedRotoFrames: physicPaintStore.getRotoCacheFrames(launchContext.layerId),
      rotoInterpolationSettings: physicPaintStore.getRotoInterpolationSettings(launchContext.layerId),
    } : current);
    setRotoCachedPlaybackStatus(settings.enabled
      ? 'Generated interpolation frames are render-only. Connector lines mark in-between spans.'
      : 'Interpolation disabled. Generated in-betweens cleared.');
  }, [launchContext]);

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
    const highestSavedFrame = savedRotoFrames.reduce((max, frame) => Math.max(max, frame.frame), 0);
    const playEndFrame = latestPlayFrames.reduce((max, frame) => Math.max(max, frame.appFrame), 0);
    void requestRotoFrameNavigation(Math.max(currentFrame, highestSavedFrame, playEndFrame, framesToApply - 1));
  }, [currentFrame, framesToApply, latestPlayFrames, requestRotoFrameNavigation, savedRotoFrames]);

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
            cachedRotoPlaybackUrl={cachedRotoPlaybackFrame?.dataUrl ?? null}
            inputDisabled={rotoInputDisabled}
            inputDisabledMessage="Saving current Roto frame…"
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
            <CanvasMountProbe
              key={canvasKey}
              width={canvasWidth}
              height={canvasHeight}
              onEngineReady={(readyEngine) => {
                setEngine(readyEngine);
                if (workflowMode === 'roto') loadCachedRotoReferenceFrame(currentFrame, readyEngine as PreviewBackgroundEngine);
              }}
              onCanvasMounted={setCanvasMounted}
              onNativePenInputReady={(handler) => {
                nativePenInputHandlerRef.current = handler;
              }}
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
          occupiedRotoFrames={occupiedRotoFrames}
          savedRotoFrames={savedRotoFrames}
          cachedRotoFrames={launchContext?.cachedRotoFrames}
          editableRotoFrames={editableRotoFrames}
          pendingRotoFrames={rotoSession.dirtyFrames.value}
          rotoSaveInFlight={Boolean(rotoFlushInFlightRef.current) || applyStatus === 'applying'}
          keyActionInFlight={rotoKeyActionInFlight}
          rotoSavingFrame={rotoSavingFrame}
          rotoCachedPlaybackAvailable={rotoCachedPlaybackAvailable}
          rotoCachedPlaybackStatus={rotoCachedPlaybackStatus}
          isRotoCachedPlaybackActive={isRotoCachedPlaybackActive}
          onToggleRotoPlayback={toggleRotoCachedPlayback}
          rotoInterpolationSettings={launchContext ? physicPaintStore.getRotoInterpolationSettings(launchContext.layerId) : undefined}
          onRotoInterpolationEnabledChange={(enabled) => updateRotoInterpolationSettings({ enabled })}
          onRotoInterpolationCountChange={(inBetweenCount) => updateRotoInterpolationSettings({ inBetweenCount })}
          onRotoInterpolationModeChange={(mode) => updateRotoInterpolationSettings({ mode })}
          onRotoInterpolationMotionChange={updateRotoInterpolationSettings}
          onDuplicateRotoKey={duplicateRotoKey}
          onInsertRotoFrame={insertRotoFrame}
          onDeleteRotoFrame={deleteRotoFrame}
          onCopyRotoFrame={copyRotoFrame}
          onPasteRotoFrame={pasteRotoFrame}
          hasCopiedRotoKey={rotoSession.copiedKey.value !== null}
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
