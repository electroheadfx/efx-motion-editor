import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
  clampPhysicPaintFrameCount,
  type PhysicPaintRotoCacheFrame,
} from '../../types/physicPaint';

export type PhysicsPaintWorkflowMode = 'roto' | 'play';
export type PhysicsPaintApplyStatus = 'idle' | 'applying' | 'success' | 'error';
export type PhysicsPaintEngineStatusTone = 'ready' | 'not-ready' | 'error';
export type RotoCellFill = 'empty' | 'cached-only' | 'editable-session';
export type RotoCellBaseMeaning = 'empty' | 'cached' | 'editable-current' | 'generated' | 'background-only';
export type RotoCellOverlay = 'current' | 'dirty' | 'pending';
export type RotoCellState = 'Empty' | 'Cached' | 'Current' | 'Generated' | 'Background only';
export type RotoMissingFrameStatusKind = 'transparent' | 'background-only-interior' | 'background-only-dynamic';

export interface RotoMissingFrameStatus {
  kind: RotoMissingFrameStatusKind;
  label: string;
}

export interface RotoCellViewModel {
  frame: number;
  baseMeaning: RotoCellBaseMeaning;
  overlays: RotoCellOverlay[];
  state: RotoCellState;
  label: string;
  title: string;
  ariaLabel: string;
  fillClass: string;
  isEditableTarget: boolean;
  isCurrent: boolean;
  isDirty: boolean;
  isPending: boolean;
}

export interface RotoCellViewModelInput {
  frame: number;
  currentFrame?: number;
  cachedFrames?: readonly PhysicPaintRotoCacheFrame[] | ReadonlySet<number> | readonly number[];
  editableFrames?: readonly number[] | ReadonlySet<number>;
  pendingFrames?: readonly number[] | ReadonlySet<number>;
  isSaving?: boolean;
}

const ROTO_CELL_STATES: Record<RotoCellBaseMeaning, RotoCellState> = {
  empty: 'Empty',
  cached: 'Cached',
  'editable-current': 'Current',
  generated: 'Generated',
  'background-only': 'Background only',
};

const ROTO_CELL_FILL_CLASSES: Record<RotoCellBaseMeaning, string> = {
  empty: 'roto-fill-empty',
  cached: 'roto-fill-cached',
  'editable-current': 'roto-fill-editable-current',
  generated: 'roto-fill-generated',
  'background-only': 'roto-fill-background-only',
};

const EDITABLE_ROTO_CELL_MEANINGS = new Set<RotoCellBaseMeaning>(['empty', 'cached', 'editable-current', 'background-only']);

export type PhysicsPaintWorkflowAction =
  | 'save-active-source'
  | 'clear-active-source'
  | 'convert-play-to-roto'
  | 'convert-roto-to-play'
  | 'inspect-play-range'
  | 'move-play-marker';

export interface PhysicsPaintOnionState {
  enabled: boolean;
  previous: boolean;
  next: boolean;
  count: number;
  opacity: number;
}

export interface PhysicsPaintPlayRange {
  startFrame: number;
  endFrame: number;
  frameCount: number;
  currentFrame: number;
  markerRatio: number;
}

export type RotoInterpolationMode = 'duplicate' | 'hold' | 'blend' | 'alpha-blend';

export interface RotoInterpolationSettings {
  enabled?: boolean;
  inBetweenCount?: number;
  mode?: RotoInterpolationMode;
  position?: number;
  deform?: number;
}

export interface RotoInterpolationSpanFrame {
  fromFrame: number;
  toFrame: number;
  frame: number;
  displayFrame: number;
  generatedFrame: number;
  ordinal: number;
  total: number;
  t: number;
  sourceFrame: number;
  fromSourceFrame: number;
  toSourceFrame?: number;
  sourceFromFrame?: number;
  sourceToFrame?: number;
  mode: Extract<RotoInterpolationMode, 'duplicate' | 'blend'>;
  kind: 'generated-interpolation';
  renderOnly: true;
}

export type RotoExpandedRealKeyFrame =
  | {
      sourceFrame: number;
      frame: number;
      displayFrame: number;
      kind: 'real-key';
    }
  | RotoInterpolationSpanFrame;

export interface RotoDuplicateKeyResult {
  sourceFrame: number;
  targetFrame: number;
  frames: number[];
  shiftedFrames: number[];
}

export interface RotoInsertKeyResult {
  targetFrame: number;
  frames: number[];
  shiftedFrames: number[];
}

export interface RotoDeleteKeyResult {
  removedFrame: number | null;
  frames: number[];
  shiftedFrames: number[];
}

export interface RotoReplaceKeyResult {
  targetFrame: number;
  frames: number[];
  replaced: boolean;
}

export interface RotoKeySourceEligibilityInput {
  frame: number;
  realKeys: readonly number[];
  generatedFrames?: readonly number[] | ReadonlySet<number>;
}

export interface RotoKeyPasteTargetEligibilityInput {
  frame: number;
  hasCopiedRealKey: boolean;
  generatedFrames?: readonly number[] | ReadonlySet<number>;
}

export const PLAY_TO_ROTO_MISSING_FRAMES_MESSAGE = 'Save or regenerate Play output before converting it to roto frames.';

export function clampOnionCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  const integer = Math.trunc(numeric);
  if (integer < 1) return 1;
  if (integer > 3) return 3;
  return integer;
}

export function clampOnionOpacity(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 60;
  const integer = Math.trunc(numeric);
  if (integer < 10) return 10;
  if (integer > 100) return 100;
  return integer;
}

export function getActivePrimaryActionLabel(mode: PhysicsPaintWorkflowMode): 'Save current' | 'Save play' {
  return mode === 'play' ? 'Save play' : 'Save current';
}

export function getRotoCellFill(
  frame: number,
  cachedFrames: readonly PhysicPaintRotoCacheFrame[] | ReadonlySet<number> | readonly number[] | undefined,
  editableFrames: readonly number[] | ReadonlySet<number> | undefined,
): RotoCellFill {
  if (hasFrame(editableFrames, frame)) return 'editable-session';
  if (hasCachedRotoFrame(cachedFrames, frame)) return 'cached-only';
  return 'empty';
}

export function getRotoCellViewModel({
  frame,
  currentFrame,
  cachedFrames,
  editableFrames,
  pendingFrames,
  isSaving = false,
}: RotoCellViewModelInput): RotoCellViewModel {
  const safeFrame = Number.isInteger(frame) && frame >= 0 ? frame : 0;
  const cachedFrame = getCachedRotoFrame(cachedFrames, frame);
  const baseMeaning = getRotoCellBaseMeaning(frame, cachedFrame, editableFrames);
  const isCurrent = Number.isInteger(frame) && frame >= 0 && frame === currentFrame;
  const isDirty = hasFrame(pendingFrames, frame);
  const isPending = isDirty && isSaving;
  const overlays: RotoCellOverlay[] = [];
  if (isCurrent) overlays.push('current');
  if (isDirty) overlays.push('dirty');
  if (isPending) overlays.push('pending');
  const label = getRotoCellStateLabel(safeFrame, baseMeaning, overlays);
  const state = getRotoCellState(baseMeaning);

  return {
    frame: safeFrame,
    baseMeaning,
    overlays,
    state,
    label,
    title: label,
    ariaLabel: label,
    fillClass: ROTO_CELL_FILL_CLASSES[baseMeaning],
    isEditableTarget: EDITABLE_ROTO_CELL_MEANINGS.has(baseMeaning),
    isCurrent,
    isDirty,
    isPending,
  };
}

export function getRotoCellStateLabel(frame: number, baseMeaning: RotoCellBaseMeaning, overlays: readonly RotoCellOverlay[]): string {
  if (overlays.includes('pending')) return `Saving frame ${frame}...`;
  if (overlays.includes('dirty')) return `Unsaved changes on frame ${frame}`;

  if (baseMeaning === 'empty') return `No Roto content on frame ${frame}`;
  if (baseMeaning === 'cached') return `Cached frame ${frame}`;
  if (baseMeaning === 'editable-current') return `Frame ${frame}: Current`;
  if (baseMeaning === 'generated') return `Generated frame ${frame} (render-only)`;
  return `Background only on frame ${frame}`;
}

export function getRotoMissingFrameStatus({ frame, kind }: { frame: number; kind: RotoMissingFrameStatusKind }): RotoMissingFrameStatus {
  return { kind, label: getMissingRotoFrameStatusLabel({ frame, kind }) };
}

export function getMissingRotoFrameStatusLabel({ frame, kind }: { frame: number; kind: RotoMissingFrameStatusKind }): string {
  const safeFrame = clampNonNegativeInteger(frame, 0);
  if (kind === 'transparent') return `Frame ${safeFrame}: transparent missing Roto frame`;
  if (kind === 'background-only-interior') return `Frame ${safeFrame}: background only between real Roto keys`;
  return `Frame ${safeFrame}: background only from current paper setting`;
}

export function getRotoReplacementSuccessLabel(frame: number): string {
  return `Frame ${clampNonNegativeInteger(frame, 0)} saved as a real Roto key`;
}

export function getRotoPendingLabel(hasPending: boolean, isSaving: boolean, savingFrame?: number | null): string | null {
  if (isSaving) {
    if (typeof savingFrame === 'number' && Number.isInteger(savingFrame) && savingFrame >= 0) return `Saving frame ${savingFrame}…`;
    return 'Saving current frame…';
  }
  if (hasPending) return 'Unsaved changes — click Save current to cache';
  return null;
}

export function getPhysicsPaintSourceLabel(mode: PhysicsPaintWorkflowMode): 'Roto #1' | 'Play #2' {
  return mode === 'play' ? 'Play #2' : 'Roto #1';
}

export function requiresDestructiveConfirmation(action: PhysicsPaintWorkflowAction, mode: PhysicsPaintWorkflowMode): boolean {
  if (action === 'convert-play-to-roto' || action === 'convert-roto-to-play') return true;
  if (action === 'clear-active-source') return mode === 'play';
  return false;
}

export function getPhysicsPaintEngineStatusTone({
  ready,
  error,
}: {
  ready: boolean;
  error?: string | null;
  applyStatus?: PhysicsPaintApplyStatus;
}): PhysicsPaintEngineStatusTone {
  if (ready) return 'ready';
  return error ? 'error' : 'not-ready';
}

export function isPhysicsPaintDevExportEnabled(env: { DEV?: boolean; MODE?: string }): boolean {
  return env.DEV === true || env.MODE === 'development';
}

export function getPreviewFps(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 24;
  const integer = Math.trunc(numeric);
  return integer > 0 ? integer : 24;
}

export function getPlayRangeMarker(startFrame: number, frameCount: number, currentFrame: number): PhysicsPaintPlayRange {
  const safeStartFrame = clampNonNegativeInteger(startFrame, 0);
  const safeFrameCount = clampPhysicPaintFrameCount(frameCount);
  const endFrame = safeStartFrame + safeFrameCount - 1;
  const safeCurrentFrame = clampNonNegativeInteger(currentFrame, safeStartFrame);
  const clampedCurrentFrame = clampNumber(safeCurrentFrame, safeStartFrame, endFrame);
  const denominator = Math.max(1, safeFrameCount - 1);

  return {
    startFrame: safeStartFrame,
    endFrame,
    frameCount: safeFrameCount,
    currentFrame: clampedCurrentFrame,
    markerRatio: (clampedCurrentFrame - safeStartFrame) / denominator,
  };
}

export function getExpandedRotoRealKeyFrames(realKeys: number[], settings: RotoInterpolationSettings): RotoExpandedRealKeyFrame[] {
  const sourceKeys = normalizeRealRotoKeyFrames(realKeys);
  const inBetweenCount = settings.enabled === true ? clampPositiveInteger(settings.inBetweenCount, 1) : 0;
  const mode = normalizeRotoInterpolationMode(settings.mode);
  const expanded: RotoExpandedRealKeyFrame[] = [];
  let displayFrame = 0;

  sourceKeys.forEach((sourceFrame, index) => {
    if (index === 0 && sourceFrame > 0) displayFrame = sourceFrame;
    expanded.push({ sourceFrame, frame: displayFrame, displayFrame, kind: 'real-key' });
    if (settings.enabled === true && inBetweenCount > 0 && (index < sourceKeys.length - 1 || sourceKeys.length > 2)) {
      const toSourceFrame = sourceKeys[index + 1];
      for (let ordinal = 1; ordinal <= inBetweenCount; ordinal++) {
        const generatedFrame = displayFrame + ordinal;
        expanded.push({
          sourceFrame,
          fromFrame: displayFrame,
          toFrame: displayFrame + inBetweenCount + 1,
          frame: generatedFrame,
          displayFrame: generatedFrame,
          generatedFrame,
          ordinal,
          total: inBetweenCount,
          t: ordinal / (inBetweenCount + 1),
          fromSourceFrame: sourceFrame,
          toSourceFrame,
          sourceFromFrame: sourceFrame,
          sourceToFrame: toSourceFrame,
          mode,
          kind: 'generated-interpolation',
          renderOnly: true,
        });
      }
      displayFrame += inBetweenCount + 1;
    } else if (index < sourceKeys.length - 1) {
      displayFrame = sourceKeys[index + 1];
    }
  });

  return expanded;
}

export function getRotoInterpolationSpanFrames(realKeys: number[], settings: RotoInterpolationSettings): RotoInterpolationSpanFrame[] {
  if (settings.enabled !== true) return [];
  return getExpandedRotoRealKeyFrames(realKeys, settings).filter((frame): frame is RotoInterpolationSpanFrame => frame.kind === 'generated-interpolation');
}

export function getSourceRotoFrameForDisplayFrame(displayFrame: number, realKeys: number[], settings: RotoInterpolationSettings, mode: 'existing-or-next' | 'existing-only' = 'existing-or-next'): number | null {
  if (!isNonNegativeInteger(displayFrame)) return null;
  const sourceKeys = normalizeRealRotoKeyFrames(realKeys);
  const entry = getExpandedRotoRealKeyFrames(sourceKeys, settings).find((candidate) => candidate.kind === 'real-key' && candidate.displayFrame === displayFrame);
  if (entry?.kind === 'real-key') return entry.sourceFrame;
  if (mode === 'existing-only') return null;
  if (settings.enabled === true && displayFrame > 0 && sourceKeys.length > 0) return Math.max(...sourceKeys) + 1;
  return displayFrame;
}

export function getNearestRealRotoKeyFrame(frame: number, realKeys: number[]): number | null {
  const sortedKeys = normalizeRealRotoKeyFrames(realKeys);
  if (sortedKeys.length === 0) return null;
  const target = clampNonNegativeInteger(frame, 0);
  return sortedKeys.reduce((nearest, candidate) => {
    const nearestDistance = Math.abs(nearest - target);
    const candidateDistance = Math.abs(candidate - target);
    if (candidateDistance < nearestDistance) return candidate;
    return nearest;
  }, sortedKeys[0]);
}

export function duplicateRotoKeyFrame(realKeys: number[], selectedFrame: number): RotoDuplicateKeyResult {
  const sortedKeys = normalizeRealRotoKeyFrames(realKeys);
  const sourceFrame = normalizeSelectedRealKey(selectedFrame, sortedKeys);
  const targetFrame = sourceFrame + 1;
  const shiftedFrames = sortedKeys.filter(frame => frame >= targetFrame);
  const shiftedSet = new Set(shiftedFrames);
  const nextFrames = sortedKeys
    .map(frame => shiftedSet.has(frame) ? frame + 1 : frame)
    .concat(targetFrame);
  return {
    sourceFrame,
    targetFrame,
    frames: normalizeRealRotoKeyFrames(nextFrames),
    shiftedFrames,
  };
}

export function insertRotoKeyFrame(realKeys: number[], selectedFrame: number): RotoInsertKeyResult {
  const sortedKeys = normalizeRealRotoKeyFrames(realKeys);
  const targetFrame = clampNonNegativeInteger(selectedFrame, 0);
  const shiftedFrames = sortedKeys.filter(frame => frame >= targetFrame);
  const shiftedSet = new Set(shiftedFrames);
  const nextFrames = sortedKeys
    .map(frame => shiftedSet.has(frame) ? frame + 1 : frame)
    .concat(targetFrame);
  return {
    targetFrame,
    frames: normalizeRealRotoKeyFrames(nextFrames),
    shiftedFrames,
  };
}

export function deleteRotoKeyFrame(realKeys: number[], selectedFrame: number): RotoDeleteKeyResult {
  const sortedKeys = normalizeRealRotoKeyFrames(realKeys);
  const removedFrame = sortedKeys.includes(selectedFrame) ? selectedFrame : null;
  if (removedFrame === null) return { removedFrame, frames: sortedKeys, shiftedFrames: [] };
  const shiftedFrames = sortedKeys.filter(frame => frame > removedFrame);
  return {
    removedFrame,
    frames: normalizeRealRotoKeyFrames(sortedKeys
      .filter(frame => frame !== removedFrame)
      .map(frame => frame > removedFrame ? frame - 1 : frame)),
    shiftedFrames,
  };
}

export function replaceRotoKeyFrame(realKeys: number[], targetFrame: number): RotoReplaceKeyResult {
  const sortedKeys = normalizeRealRotoKeyFrames(realKeys);
  const safeTargetFrame = clampNonNegativeInteger(targetFrame, 0);
  const replaced = sortedKeys.includes(safeTargetFrame);
  return {
    targetFrame: safeTargetFrame,
    frames: normalizeRealRotoKeyFrames([...sortedKeys, safeTargetFrame]),
    replaced,
  };
}

export function canUseRotoKeySource({ frame, realKeys }: RotoKeySourceEligibilityInput): boolean {
  if (!isNonNegativeInteger(frame)) return false;
  return normalizeRealRotoKeyFrames([...realKeys]).includes(frame);
}

export function canPasteRotoKeyTarget({ frame, hasCopiedRealKey }: RotoKeyPasteTargetEligibilityInput): boolean {
  return hasCopiedRealKey && isNonNegativeInteger(frame);
}

export {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
};

function getRotoCellBaseMeaning(
  frame: number,
  cachedFrame: PhysicPaintRotoCacheFrame | null,
  editableFrames: readonly number[] | ReadonlySet<number> | undefined,
): RotoCellBaseMeaning {
  if (hasFrame(editableFrames, frame)) return 'editable-current';
  if (cachedFrame?.source === 'background-only-support' || cachedFrame?.backgroundOnly === true) return 'background-only';
  if (cachedFrame?.source === 'real-key') return 'cached';
  if (cachedFrame?.source === 'generated-interpolation') return 'generated';
  return 'empty';
}

function getRotoCellState(baseMeaning: RotoCellBaseMeaning): RotoCellState {
  return ROTO_CELL_STATES[baseMeaning];
}

function hasFrame(frames: readonly number[] | ReadonlySet<number> | undefined, frame: number): boolean {
  if (!Number.isInteger(frame) || frame < 0 || !frames) return false;
  if (typeof (frames as ReadonlySet<number>).has === 'function') return (frames as ReadonlySet<number>).has(frame);
  return (frames as readonly number[]).includes(frame);
}

function hasCachedRotoFrame(
  frames: readonly PhysicPaintRotoCacheFrame[] | ReadonlySet<number> | readonly number[] | undefined,
  frame: number,
): boolean {
  if (!Number.isInteger(frame) || frame < 0 || !frames) return false;
  if (typeof (frames as ReadonlySet<number>).has === 'function') return (frames as ReadonlySet<number>).has(frame);
  return (frames as readonly (PhysicPaintRotoCacheFrame | number)[]).some((entry) => typeof entry === 'number' ? entry === frame : entry.appFrame === frame);
}

function getCachedRotoFrame(
  frames: readonly PhysicPaintRotoCacheFrame[] | ReadonlySet<number> | readonly number[] | undefined,
  frame: number,
): PhysicPaintRotoCacheFrame | null {
  if (!Number.isInteger(frame) || frame < 0 || !frames) return null;
  if (typeof (frames as ReadonlySet<number>).has === 'function') {
    return (frames as ReadonlySet<number>).has(frame) ? createSyntheticRotoCacheFrame(frame) : null;
  }
  const entries = (frames as readonly (PhysicPaintRotoCacheFrame | number)[]).filter((candidate) => typeof candidate === 'number' ? candidate === frame : candidate.appFrame === frame);
  const entry = entries.find((candidate) => typeof candidate === 'number' || candidate.source === 'real-key') ?? entries[0];
  if (entry === undefined) return null;
  return typeof entry === 'number' ? createSyntheticRotoCacheFrame(entry) : entry;
}

function createSyntheticRotoCacheFrame(frame: number): PhysicPaintRotoCacheFrame {
  return {
    frameIndex: 0,
    appFrame: frame,
    dataUrl: 'data:image/png;base64,',
    source: 'real-key',
  };
}

function normalizeRealRotoKeyFrames(realKeys: number[]): number[] {
  return Array.from(new Set(realKeys.filter(frame => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
}

function normalizeSelectedRealKey(selectedFrame: number, sortedKeys: number[]): number {
  if (sortedKeys.length === 0) return clampNonNegativeInteger(selectedFrame, 0);
  if (sortedKeys.includes(selectedFrame)) return selectedFrame;
  return getNearestRealRotoKeyFrame(selectedFrame, sortedKeys) ?? sortedKeys[0];
}

function normalizeRotoInterpolationMode(mode: RotoInterpolationSettings['mode']): Extract<RotoInterpolationMode, 'duplicate' | 'blend'> {
  if (mode === 'duplicate' || mode === 'hold') return 'duplicate';
  return 'blend';
}

function clampNonNegativeInteger(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.trunc(numeric));
}

function clampPositiveInteger(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.trunc(numeric));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function clampNumber(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
