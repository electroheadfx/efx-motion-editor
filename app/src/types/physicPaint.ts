import type { SerializedProject } from '@efxlab/efx-physic-paint';

export const PHYSIC_PAINT_MAX_APPLY_FRAMES = 600;
export const PHYSIC_PAINT_DEFAULT_APPLY_FRAMES = 4;

export const PHYSIC_PAINT_MIN_APPLY_FRAMES = 1;
const RENDERED_DATA_URL_PREFIX = 'data:image/png';
const FORBIDDEN_APPLY_FIELDS = new Set(['engine', 'internals']);

export type PhysicPaintApplyKind = 'apply-canvas' | 'delete-roto-frame' | 'replace-roto-key-frames' | 'apply-play-canvas' | 'convert-play-to-roto' | 'convert-roto-to-play' | 'update-play-render-options';
export type PhysicPaintWorkflowMode = 'roto' | 'play';
export type PhysicPaintEditableSource = 'roto' | 'play';

export type PhysicPaintPlayScriptRangeSource = 'play';
export type PhysicPaintPlayScriptCacheStatus = 'cached' | 'stale' | 'missing';
export type PhysicPaintPlayRenderTool = 'normal-paint' | 'physics-paint' | 'erase';
export type PhysicPaintPlayBackgroundMode = 'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3' | 'photo';
export type PhysicPaintRotoFrameSource = 'real-key' | 'generated-interpolation' | 'background-only-support';
export type PhysicPaintRotoInterpolationMode = 'duplicate' | 'blend';
export type PhysicPaintRotoBackgroundMode = 'transparent' | 'white' | 'canvas1' | 'canvas2' | 'canvas3';

export interface PhysicPaintRotoBackgroundMetadata {
  background: PhysicPaintRotoBackgroundMode;
  paperGrain: string;
  grainStrength: number;
  color?: string;
}

export interface PhysicPaintPlayMotionSettings {
  strokeDeformation: number;
  strokePosition: number;
}

export interface PhysicPaintRotoInterpolationSettings {
  enabled: boolean;
  inBetweenCount: number;
  mode: PhysicPaintRotoInterpolationMode;
  deform: number;
  position: number;
}

export interface PhysicPaintRotoCacheFrame extends PhysicPaintRenderedFrame {
  source: PhysicPaintRotoFrameSource;
  nearestRealKeyFrame?: number;
  backgroundOnly?: boolean;
  onionDataUrl?: string;
}

export interface PhysicPaintPlayRenderOptionsSnapshot {
  tool: PhysicPaintPlayRenderTool;
  color: string;
  opacity: number;
  brushSize: number;
  background: PhysicPaintPlayBackgroundMode;
  paperGrain: string;
  grainStrength: number;
  motion: PhysicPaintPlayMotionSettings;
}

export interface PhysicPaintPlayScriptRange {
  id: string;
  startFrame: number;
  frameCount: number;
  editableState: SerializedProject;
  source?: PhysicPaintPlayScriptRangeSource;
  cacheStatus?: PhysicPaintPlayScriptCacheStatus;
  motion?: PhysicPaintPlayMotionSettings;
  renderOptions?: PhysicPaintPlayRenderOptionsSnapshot;
}

export interface PhysicPaintWorkflowMetadata {
  workflowMode: PhysicPaintWorkflowMode;
  playStartFrame?: number;
  playFrameCount?: number;
  editableSource?: PhysicPaintEditableSource;
  playScriptRanges?: PhysicPaintPlayScriptRange[];
  playMotion?: PhysicPaintPlayMotionSettings;
  rotoBackground?: PhysicPaintRotoBackgroundMetadata;
}

export interface PhysicPaintLaunchContext {
  operationId: string;
  layerId: string;
  startFrame: number;
  layerName?: string;
  width?: number;
  height?: number;
  fps?: number;
  requestedWorkflowMode?: PhysicPaintWorkflowMode;
  workflowMode?: PhysicPaintWorkflowMode;
  playStartFrame?: number;
  playFrameCount?: number;
  editableSource?: PhysicPaintEditableSource;
  editableState?: SerializedProject;
  selectedPlayScriptId?: string;
  playCacheStatus?: PhysicPaintPlayScriptCacheStatus;
  playMotion?: PhysicPaintPlayMotionSettings;
  playRenderOptions?: PhysicPaintPlayRenderOptionsSnapshot;
  rotoBackground?: PhysicPaintRotoBackgroundMetadata;
  previewFrame?: number;
  cachedPlayFrames?: PhysicPaintRenderedFrame[];
  cachedRotoFrames?: PhysicPaintRotoCacheFrame[];
  rotoInterpolationSettings?: PhysicPaintRotoInterpolationSettings;
  maxPlayFrameCount?: number;
  maxPlayFrameCountReason?: string;
}

export interface PhysicPaintFrameSyncMessage {
  type: 'physic-paint:seek-frame';
  frame: number;
}

export interface PhysicPaintRenderedFrame {
  /** Generated sequence-local frame index. For still applies this is 0. */
  frameIndex: number;
  /** Editor timeline frame that should receive this rendered output. */
  appFrame: number;
  /** Rendered PNG output only. Editable stroke/engine state is never transported here. */
  dataUrl: string;
  width?: number;
  height?: number;
  /** Roto cache provenance; generated frames are render-only and never editable. */
  source?: PhysicPaintRotoFrameSource;
  nearestRealKeyFrame?: number;
}

export interface PhysicPaintApplyCanvasPayload {
  kind: 'apply-canvas';
  operationId: string;
  layerId: string;
  startFrame: number;
  renderedFrame: PhysicPaintRenderedFrame;
  editableState: SerializedProject;
  backgroundOnly?: boolean;
  onionDataUrl?: string;
  closeWindowAfterApply?: boolean;
}

export interface PhysicPaintDeleteRotoFramePayload {
  kind: 'delete-roto-frame';
  operationId: string;
  layerId: string;
  startFrame: number;
}

export interface PhysicPaintReplaceRotoKeyFramesPayload {
  kind: 'replace-roto-key-frames';
  operationId: string;
  layerId: string;
  startFrame: number;
  frames: PhysicPaintRotoCacheFrame[];
}

export interface PhysicPaintApplyPlayCanvasPayload {
  kind: 'apply-play-canvas';
  operationId: string;
  layerId: string;
  startFrame: number;
  frameCount: number;
  frames: PhysicPaintRenderedFrame[];
  editableState: SerializedProject;
  playScriptId?: string;
  playMotion?: PhysicPaintPlayMotionSettings;
  renderOptions?: PhysicPaintPlayRenderOptionsSnapshot;
}

export interface PhysicPaintConvertPlayToRotoPayload {
  kind: 'convert-play-to-roto';
  operationId: string;
  layerId: string;
  startFrame: number;
  frameCount: number;
  frames: PhysicPaintRenderedFrame[];
  editableState: SerializedProject;
}

export interface PhysicPaintConvertRotoToPlayPayload {
  kind: 'convert-roto-to-play';
  operationId: string;
  layerId: string;
  startFrame: number;
  frameCount: number;
  editableState: SerializedProject;
  playScriptId?: string;
  playMotion?: PhysicPaintPlayMotionSettings;
  renderOptions?: PhysicPaintPlayRenderOptionsSnapshot;
}

export interface PhysicPaintUpdatePlayRenderOptionsPayload {
  kind: 'update-play-render-options';
  operationId: string;
  layerId: string;
  startFrame: number;
  playScriptId: string;
  renderOptions: PhysicPaintPlayRenderOptionsSnapshot;
}

export type PhysicPaintApplyPayload = PhysicPaintApplyCanvasPayload | PhysicPaintDeleteRotoFramePayload | PhysicPaintReplaceRotoKeyFramesPayload | PhysicPaintApplyPlayCanvasPayload | PhysicPaintConvertPlayToRotoPayload | PhysicPaintConvertRotoToPlayPayload | PhysicPaintUpdatePlayRenderOptionsPayload;

export interface PhysicPaintApplyResult {
  operationId: string;
  kind: PhysicPaintApplyKind;
  layerId: string;
  startFrame: number;
  appliedFrameCount: number;
  ok: boolean;
  error?: string;
}

export interface PhysicPaintApplyResultMessage {
  type: 'physic-paint:apply-result';
  payload: PhysicPaintApplyResult;
}

export interface PhysicPaintReadinessState {
  ready: boolean;
  engineReady: boolean;
  canvasMounted: boolean;
  hasLaunchContext: boolean;
  bridgeAvailable: boolean;
  applying: boolean;
  missingReasons: string[];
  lastError?: string;
}

export function clampPhysicPaintFrameCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return PHYSIC_PAINT_DEFAULT_APPLY_FRAMES;
  const integer = Math.trunc(numeric);
  if (integer < PHYSIC_PAINT_MIN_APPLY_FRAMES) return PHYSIC_PAINT_MIN_APPLY_FRAMES;
  if (integer > PHYSIC_PAINT_MAX_APPLY_FRAMES) return PHYSIC_PAINT_MAX_APPLY_FRAMES;
  return integer;
}

export function isPhysicPaintLaunchContext(value: unknown): value is PhysicPaintLaunchContext {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.operationId) &&
    isNonEmptyString(value.layerId) &&
    isNonNegativeInteger(value.startFrame) &&
    optionalNumber(value.width) &&
    optionalNumber(value.height) &&
    optionalPositiveNumber(value.fps) &&
    optionalWorkflowMode(value.requestedWorkflowMode) &&
    optionalWorkflowMode(value.workflowMode) &&
    optionalNonNegativeInteger(value.playStartFrame) &&
    optionalFrameCount(value.playFrameCount) &&
    optionalEditableSource(value.editableSource) &&
    optionalNonEmptyString(value.selectedPlayScriptId) &&
    optionalPlayScriptCacheStatus(value.playCacheStatus) &&
    optionalPlayMotion(value.playMotion) &&
    optionalPlayRenderOptions(value.playRenderOptions) &&
    optionalRotoBackgroundMetadata(value.rotoBackground) &&
    optionalNonNegativeInteger(value.previewFrame) &&
    optionalRenderedFrames(value.cachedPlayFrames) &&
    optionalRotoCacheFrames(value.cachedRotoFrames) &&
    optionalRotoInterpolationSettings(value.rotoInterpolationSettings) &&
    optionalFrameCount(value.maxPlayFrameCount) &&
    (value.maxPlayFrameCountReason === undefined || typeof value.maxPlayFrameCountReason === 'string') &&
    (value.layerName === undefined || typeof value.layerName === 'string') &&
    (value.editableState === undefined || isSerializedProject(value.editableState))
  );
}

export function isPhysicPaintFrameSyncMessage(value: unknown): value is PhysicPaintFrameSyncMessage {
  return Boolean(
    isRecord(value) &&
      value.type === 'physic-paint:seek-frame' &&
      isNonNegativeInteger(value.frame)
  );
}

export function isPhysicPaintPlayRenderOptionsSnapshot(value: unknown): value is PhysicPaintPlayRenderOptionsSnapshot {
  if (!isRecord(value)) return false;
  return (
    (value.tool === 'normal-paint' || value.tool === 'physics-paint' || value.tool === 'erase') &&
    isNonEmptyString(value.color) &&
    isPercentInteger(value.opacity) &&
    isPositiveInteger(value.brushSize) &&
    optionalPlayBackgroundMode(value.background) &&
    isNonEmptyString(value.paperGrain) &&
    typeof value.grainStrength === 'number' &&
    Number.isFinite(value.grainStrength) &&
    value.grainStrength >= 0 &&
    value.grainStrength <= 1 &&
    optionalPlayMotion(value.motion)
  );
}

export function isPhysicPaintApplyPayload(value: unknown): value is PhysicPaintApplyPayload {
  if (!isRecord(value) || containsForbiddenApplyField(value)) return false;

  if (!isBaseApplyPayload(value)) return false;

  if (value.kind === 'update-play-render-options') {
    return isNonEmptyString(value.playScriptId) && isPhysicPaintPlayRenderOptionsSnapshot(value.renderOptions);
  }

  if (value.kind === 'delete-roto-frame') return true;

  if (value.kind === 'replace-roto-key-frames') {
    return Array.isArray(value.frames) && value.frames.every((frame) => isPhysicPaintRotoCacheFrame(frame) && frame.source === 'real-key');
  }

  if (!isSerializedProject(value.editableState)) return false;

  if (value.kind === 'apply-canvas') {
    return isPhysicPaintRenderedFrame(value.renderedFrame, value.startFrame, 0) &&
      (value.backgroundOnly === undefined || typeof value.backgroundOnly === 'boolean') &&
      (value.onionDataUrl === undefined || isRenderedPngDataUrl(value.onionDataUrl)) &&
      (value.closeWindowAfterApply === undefined || typeof value.closeWindowAfterApply === 'boolean');
  }

  if (value.kind === 'apply-play-canvas' || value.kind === 'convert-play-to-roto') {
    const frameCount = value.frameCount;
    const frames = value.frames;
    if (typeof frameCount !== 'number' || !Number.isInteger(frameCount)) return false;
    if (frameCount < PHYSIC_PAINT_MIN_APPLY_FRAMES || frameCount > PHYSIC_PAINT_MAX_APPLY_FRAMES) return false;
    if (!Array.isArray(frames) || frames.length !== frameCount) return false;
    return frames.every((frame, index) => isPhysicPaintRenderedFrame(frame, value.startFrame + index, index));
  }

  if (value.kind === 'convert-roto-to-play') {
    const frameCount = value.frameCount;
    if (typeof frameCount !== 'number' || !Number.isInteger(frameCount)) return false;
    return frameCount >= PHYSIC_PAINT_MIN_APPLY_FRAMES && frameCount <= PHYSIC_PAINT_MAX_APPLY_FRAMES;
  }

  return false;
}

export function normalizePhysicPaintPlayScriptRanges(value: unknown): PhysicPaintPlayScriptRange[] | null {
  if (!Array.isArray(value)) return null;

  const ranges: PhysicPaintPlayScriptRange[] = [];
  const ids = new Set<string>();

  for (const candidate of value) {
    if (!isRecord(candidate)) return null;
    if (!isNonEmptyString(candidate.id)) return null;
    if (ids.has(candidate.id)) return null;
    if (!isNonNegativeInteger(candidate.startFrame)) return null;
    const frameCount = candidate.frameCount;
    if (typeof frameCount !== 'number' || !Number.isInteger(frameCount)) return null;
    if (frameCount < PHYSIC_PAINT_MIN_APPLY_FRAMES || frameCount > PHYSIC_PAINT_MAX_APPLY_FRAMES) return null;
    if (!isSerializedProject(candidate.editableState)) return null;
    if (candidate.source !== undefined && candidate.source !== 'play') return null;
    if (candidate.cacheStatus !== undefined && candidate.cacheStatus !== 'cached' && candidate.cacheStatus !== 'stale' && candidate.cacheStatus !== 'missing') return null;
    if (!optionalPlayMotion(candidate.motion)) return null;
    if (!optionalPlayRenderOptions(candidate.renderOptions)) return null;

    ids.add(candidate.id);
    ranges.push({
      id: candidate.id,
      startFrame: candidate.startFrame,
      frameCount,
      editableState: structuredClone(candidate.editableState),
      ...(candidate.source ? { source: candidate.source } : {}),
      ...(candidate.cacheStatus ? { cacheStatus: candidate.cacheStatus } : {}),
      ...(candidate.motion ? { motion: normalizePlayMotion(candidate.motion) } : {}),
      ...(candidate.renderOptions ? { renderOptions: normalizePlayRenderOptions(candidate.renderOptions) } : {}),
    });
  }

  ranges.sort((a, b) => a.startFrame - b.startFrame || a.id.localeCompare(b.id));

  let previousEnd = -1;
  for (const range of ranges) {
    if (range.startFrame <= previousEnd) return null;
    previousEnd = range.startFrame + range.frameCount - 1;
  }

  return ranges;
}

export function isPhysicPaintRotoCacheFrame(value: unknown): value is PhysicPaintRotoCacheFrame {
  if (!isPhysicPaintRenderedFrame(value)) return false;
  if (!isRecord(value)) return false;
  if (value.source !== 'real-key' && value.source !== 'generated-interpolation' && value.source !== 'background-only-support') return false;
  if (value.source === 'background-only-support' && value.backgroundOnly !== true) return false;
  if (!optionalNonNegativeInteger(value.nearestRealKeyFrame)) return false;
  if (value.onionDataUrl !== undefined && !isRenderedPngDataUrl(value.onionDataUrl)) return false;
  return value.backgroundOnly === undefined || typeof value.backgroundOnly === 'boolean';
}

export function isPhysicPaintRotoInterpolationSettings(value: unknown): value is PhysicPaintRotoInterpolationSettings {
  if (!isRecord(value)) return false;
  return (
    typeof value.enabled === 'boolean' &&
    isRotoInBetweenFrameCount(value.inBetweenCount) &&
    (value.mode === 'duplicate' || value.mode === 'blend') &&
    isPercentInteger(value.deform) &&
    isPercentInteger(value.position)
  );
}

export function isPhysicPaintRotoBackgroundMetadata(value: unknown): value is PhysicPaintRotoBackgroundMetadata {
  if (!isRecord(value)) return false;
  return (
    (value.background === 'transparent' || value.background === 'white' || value.background === 'canvas1' || value.background === 'canvas2' || value.background === 'canvas3') &&
    isNonEmptyString(value.paperGrain) &&
    typeof value.grainStrength === 'number' &&
    Number.isFinite(value.grainStrength) &&
    value.grainStrength >= 0 &&
    value.grainStrength <= 1 &&
    (value.color === undefined || typeof value.color === 'string')
  );
}

export function isPhysicPaintApplyResult(value: unknown): value is PhysicPaintApplyResult {
  if (!isRecord(value)) return false;
  return (
    isNonEmptyString(value.operationId) &&
    (value.kind === 'apply-canvas' || value.kind === 'delete-roto-frame' || value.kind === 'replace-roto-key-frames' || value.kind === 'apply-play-canvas' || value.kind === 'convert-play-to-roto' || value.kind === 'convert-roto-to-play' || value.kind === 'update-play-render-options') &&
    isNonEmptyString(value.layerId) &&
    isNonNegativeInteger(value.startFrame) &&
    isNonNegativeInteger(value.appliedFrameCount) &&
    typeof value.ok === 'boolean' &&
    (value.error === undefined || typeof value.error === 'string')
  );
}

export function isPhysicPaintApplyResultMessage(value: unknown): value is PhysicPaintApplyResultMessage {
  return Boolean(
    isRecord(value) &&
      value.type === 'physic-paint:apply-result' &&
      isPhysicPaintApplyResult(value.payload)
  );
}

function isBaseApplyPayload(value: Record<string, unknown>): value is Record<string, unknown> & {
  kind: PhysicPaintApplyKind;
  operationId: string;
  layerId: string;
  startFrame: number;
} {
  return (
    (value.kind === 'apply-canvas' || value.kind === 'delete-roto-frame' || value.kind === 'replace-roto-key-frames' || value.kind === 'apply-play-canvas' || value.kind === 'convert-play-to-roto' || value.kind === 'convert-roto-to-play' || value.kind === 'update-play-render-options') &&
    isNonEmptyString(value.operationId) &&
    isNonEmptyString(value.layerId) &&
    isNonNegativeInteger(value.startFrame) &&
    optionalNonEmptyString(value.playScriptId) &&
    optionalPlayMotion(value.playMotion) &&
    optionalPlayRenderOptions(value.renderOptions)
  );
}

export function isPhysicPaintRenderedFrame(value: unknown, expectedAppFrame?: number, expectedFrameIndex?: number): value is PhysicPaintRenderedFrame {
  if (!isRecord(value)) return false;
  if (!isNonNegativeInteger(value.frameIndex)) return false;
  if (!isNonNegativeInteger(value.appFrame)) return false;
  if (expectedFrameIndex !== undefined && value.frameIndex !== expectedFrameIndex) return false;
  if (expectedAppFrame !== undefined && value.appFrame !== expectedAppFrame) return false;
  if (!isRenderedPngDataUrl(value.dataUrl)) return false;
  if (value.source !== undefined && value.source !== 'real-key' && value.source !== 'generated-interpolation' && value.source !== 'background-only-support') return false;
  return optionalNumber(value.width) && optionalNumber(value.height);
}

function containsForbiddenApplyField(value: Record<string, unknown>): boolean {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_APPLY_FIELDS.has(key)) return true;
  }
  return false;
}

export function isSerializedProject(value: unknown): value is SerializedProject {
  if (!isRecord(value)) return false;
  if (value.version !== 2) return false;
  if (typeof value.width !== 'number' || !Number.isFinite(value.width) || value.width <= 0) return false;
  if (typeof value.height !== 'number' || !Number.isFinite(value.height) || value.height <= 0) return false;
  if (!Array.isArray(value.strokes)) return false;
  if (!isRecord(value.settings)) return false;
  return value.strokes.every(isSerializedStroke);
}

function isSerializedStroke(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.tool !== 'string') return false;
  if (!Array.isArray(value.pts)) return false;
  if (value.color !== null && typeof value.color !== 'string') return false;
  if (!isRecord(value.params)) return false;
  if (typeof value.time !== 'number' || !Number.isFinite(value.time)) return false;
  if (value.playFrame !== undefined && !isNonNegativeInteger(value.playFrame)) return false;
  if (value.physicsMode !== undefined && value.physicsMode !== 'local' && value.physicsMode !== null) return false;
  return value.pts.every((point) => Array.isArray(point) && point.length === 7 && point.every((entry) => typeof entry === 'number' && Number.isFinite(entry)));
}

function isRenderedPngDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(RENDERED_DATA_URL_PREFIX) && value.includes(',');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value));
}

function optionalPositiveNumber(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isFinite(value) && value > 0);
}

function optionalWorkflowMode(value: unknown): boolean {
  return value === undefined || value === 'roto' || value === 'play';
}

function optionalEditableSource(value: unknown): boolean {
  return value === undefined || value === 'roto' || value === 'play';
}

function optionalPlayScriptCacheStatus(value: unknown): boolean {
  return value === undefined || value === 'cached' || value === 'stale' || value === 'missing';
}

function optionalNonEmptyString(value: unknown): boolean {
  return value === undefined || isNonEmptyString(value);
}

function optionalNonNegativeInteger(value: unknown): boolean {
  return value === undefined || isNonNegativeInteger(value);
}

function optionalRenderedFrames(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((frame) => isPhysicPaintRenderedFrame(frame)));
}

function optionalRotoCacheFrames(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((frame) => isPhysicPaintRotoCacheFrame(frame)));
}

function optionalRotoInterpolationSettings(value: unknown): boolean {
  return value === undefined || isPhysicPaintRotoInterpolationSettings(value);
}

function optionalFrameCount(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= PHYSIC_PAINT_MIN_APPLY_FRAMES && value <= PHYSIC_PAINT_MAX_APPLY_FRAMES);
}

function optionalPlayMotion(value: unknown): value is PhysicPaintPlayMotionSettings | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  return isPercentInteger(value.strokeDeformation) && isPercentInteger(value.strokePosition);
}

function optionalPlayRenderOptions(value: unknown): value is PhysicPaintPlayRenderOptionsSnapshot | undefined {
  return value === undefined || isPhysicPaintPlayRenderOptionsSnapshot(value);
}

function optionalRotoBackgroundMetadata(value: unknown): value is PhysicPaintRotoBackgroundMetadata | undefined {
  return value === undefined || isPhysicPaintRotoBackgroundMetadata(value);
}

function optionalPlayBackgroundMode(value: unknown): value is PhysicPaintPlayBackgroundMode {
  return value === 'transparent' || value === 'white' || value === 'canvas1' || value === 'canvas2' || value === 'canvas3' || value === 'photo';
}

function normalizePlayMotion(value: PhysicPaintPlayMotionSettings): PhysicPaintPlayMotionSettings {
  return {
    strokeDeformation: clampPercentInteger(value.strokeDeformation),
    strokePosition: clampPercentInteger(value.strokePosition),
  };
}

function normalizePlayRenderOptions(value: PhysicPaintPlayRenderOptionsSnapshot): PhysicPaintPlayRenderOptionsSnapshot {
  return {
    tool: value.tool,
    color: value.color,
    opacity: value.opacity,
    brushSize: value.brushSize,
    background: value.background,
    paperGrain: value.paperGrain,
    grainStrength: value.grainStrength,
    motion: normalizePlayMotion(value.motion),
  };
}

function isPercentInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

function isRotoInBetweenFrameCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= PHYSIC_PAINT_MAX_APPLY_FRAMES;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function clampPercentInteger(value: unknown): number {
  if (!isPercentInteger(value)) return 0;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
