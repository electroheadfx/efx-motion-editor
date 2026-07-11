import {
  PHYSIC_PAINT_DEFAULT_APPLY_FRAMES,
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  PHYSIC_PAINT_MIN_APPLY_FRAMES,
  type PhysicPaintRotoSegmentSpacingOverride,
} from '../../../types/physicPaint';

export type RotoInterpolationMode = 'duplicate' | 'hold' | 'blend' | 'alpha-blend';

export interface RotoSegmentSpacingOverride {
  fromSourceFrame: number;
  toSourceFrame: number;
  inBetweenCount: number;
}

export interface RotoInterpolationSettings {
  enabled?: boolean;
  inBetweenCount?: number;
  mode?: RotoInterpolationMode;
  position?: number;
  deform?: number;
  segmentSpacingOverrides?: readonly (RotoSegmentSpacingOverride | PhysicPaintRotoSegmentSpacingOverride)[];
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

export interface RotoFarEmptyDisplaySaveTarget {
  displayFrame: number;
  sourceFrame: number;
  previousSegmentOverride: RotoSegmentSpacingOverride | null;
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

export function getExpandedRotoRealKeyFrames(realKeys: number[], settings: RotoInterpolationSettings): RotoExpandedRealKeyFrame[] {
  const sourceKeys = normalizeRealRotoKeyFrames(realKeys);
  const interpolationEnabled = settings.enabled === true;
  const globalInBetweenCount = interpolationEnabled ? clampPositiveInteger(settings.inBetweenCount, 1) : 0;
  const overrides = normalizeRotoSegmentSpacingOverrides(settings.segmentSpacingOverrides, sourceKeys);
  const mode = normalizeRotoInterpolationMode(settings.mode);
  const expanded: RotoExpandedRealKeyFrame[] = [];
  let displayFrame = 0;

  sourceKeys.forEach((sourceFrame, index) => {
    if (index === 0 && sourceFrame > 0) displayFrame = sourceFrame;
    expanded.push({ sourceFrame, frame: displayFrame, displayFrame, kind: 'real-key' });
    const toSourceFrame = sourceKeys[index + 1];
    const isLastSourceKey = index >= sourceKeys.length - 1;
    const override = getSegmentOverride(sourceFrame, toSourceFrame, overrides);
    const shouldGenerateSpan = interpolationEnabled && globalInBetweenCount > 0 && (!isLastSourceKey || sourceKeys.length > 2);
    const inBetweenCount = shouldGenerateSpan
      ? override?.inBetweenCount ?? globalInBetweenCount
      : 0;
    if (shouldGenerateSpan) {
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
      return;
    }

    if (!isLastSourceKey) displayFrame = override ? displayFrame + override.inBetweenCount : toSourceFrame;
  });

  return expanded;
}

export function getRotoInterpolationSpanFrames(realKeys: number[], settings: RotoInterpolationSettings): RotoInterpolationSpanFrame[] {
  if (settings.enabled !== true) return [];
  return getExpandedRotoRealKeyFrames(realKeys, settings).filter((frame): frame is RotoInterpolationSpanFrame => frame.kind === 'generated-interpolation');
}

export function inferRotoSegmentSpacingOverrides(realKeys: number[], settings: RotoInterpolationSettings): RotoSegmentSpacingOverride[] {
  if (settings.enabled !== true) return [];
  const sourceKeys = normalizeRealRotoKeyFrames(realKeys);
  const globalInBetweenCount = clampPositiveInteger(settings.inBetweenCount, 1);
  const overrides: RotoSegmentSpacingOverride[] = [];
  for (let index = 0; index < sourceKeys.length - 1; index++) {
    const fromSourceFrame = sourceKeys[index];
    const toSourceFrame = sourceKeys[index + 1];
    const sourceGap = toSourceFrame - fromSourceFrame;
    if (sourceGap > globalInBetweenCount) {
      overrides.push({ fromSourceFrame, toSourceFrame, inBetweenCount: clampRotoInBetweenCount(sourceGap) });
    }
  }
  return overrides;
}

export function normalizeRotoSegmentSpacingOverrides(value: unknown, realKeys?: readonly number[]): RotoSegmentSpacingOverride[] {
  if (!Array.isArray(value)) return [];
  const adjacentSegments = realKeys ? getAdjacentSourceSegments(normalizeRealRotoKeyFrames([...realKeys])) : null;
  const seen = new Set<string>();
  const overrides: RotoSegmentSpacingOverride[] = [];
  for (const candidate of value) {
    if (!isRecord(candidate)) continue;
    if (!isNonNegativeInteger(candidate.fromSourceFrame) || !isNonNegativeInteger(candidate.toSourceFrame)) continue;
    if (candidate.toSourceFrame <= candidate.fromSourceFrame) continue;
    if (!isPositiveFrameCount(candidate.inBetweenCount)) continue;
    const key = `${candidate.fromSourceFrame}:${candidate.toSourceFrame}`;
    if (seen.has(key)) continue;
    if (adjacentSegments && !adjacentSegments.has(key)) continue;
    seen.add(key);
    overrides.push({
      fromSourceFrame: candidate.fromSourceFrame,
      toSourceFrame: candidate.toSourceFrame,
      inBetweenCount: candidate.inBetweenCount,
    });
  }
  return overrides.sort((a, b) => a.fromSourceFrame - b.fromSourceFrame || a.toSourceFrame - b.toSourceFrame);
}

export function getSourceRotoFrameForDisplayFrame(displayFrame: number, realKeys: number[], settings: RotoInterpolationSettings, mode: 'existing-or-next' | 'existing-only' = 'existing-or-next'): number | null {
  if (!isNonNegativeInteger(displayFrame)) return null;
  const sourceKeys = normalizeRealRotoKeyFrames(realKeys);
  const entry = getExpandedRotoRealKeyFrames(sourceKeys, settings).find((candidate) => candidate.kind === 'real-key' && candidate.displayFrame === displayFrame);
  if (entry?.kind === 'real-key') return entry.sourceFrame;
  if (mode === 'existing-only') return null;
  if (settings.enabled === true && sourceKeys.length > 0) {
    const realEntries = getExpandedRotoRealKeyFrames(sourceKeys, settings).filter((candidate): candidate is Extract<RotoExpandedRealKeyFrame, { kind: 'real-key' }> => candidate.kind === 'real-key');
    const lastDisplayFrame = realEntries[realEntries.length - 1]?.displayFrame ?? -1;
    if (displayFrame === lastDisplayFrame + clampPositiveInteger(settings.inBetweenCount, 1) + 1) return Math.max(...sourceKeys) + 1;
    return resolveRotoFarEmptyDisplaySaveTarget(displayFrame, sourceKeys, settings).sourceFrame;
  }
  return displayFrame;
}

export function resolveRotoFarEmptyDisplaySaveTarget(displayFrame: number, realKeys: number[], settings: RotoInterpolationSettings): RotoFarEmptyDisplaySaveTarget {
  const safeDisplayFrame = clampNonNegativeInteger(displayFrame, 0);
  const sourceKeys = normalizeRealRotoKeyFrames(realKeys);
  if (settings.enabled !== true || sourceKeys.length === 0) {
    return { displayFrame: safeDisplayFrame, sourceFrame: safeDisplayFrame, previousSegmentOverride: null };
  }
  const realEntries = getExpandedRotoRealKeyFrames(sourceKeys, settings).filter((entry): entry is Extract<RotoExpandedRealKeyFrame, { kind: 'real-key' }> => entry.kind === 'real-key');
  const previous = [...realEntries].reverse().find((entry) => entry.displayFrame < safeDisplayFrame) ?? realEntries[realEntries.length - 1];
  if (!previous) return { displayFrame: safeDisplayFrame, sourceFrame: safeDisplayFrame, previousSegmentOverride: null };
  const globalInBetweenCount = clampPositiveInteger(settings.inBetweenCount, 1);
  const normalNextDisplayFrame = previous.displayFrame + globalInBetweenCount + 1;
  if (safeDisplayFrame === normalNextDisplayFrame) {
    return {
      displayFrame: safeDisplayFrame,
      sourceFrame: previous.sourceFrame + 1,
      previousSegmentOverride: null,
    };
  }
  const generatedInBetweenCount = clampRotoInBetweenCount(Math.max(1, safeDisplayFrame - previous.displayFrame - 1));
  const sourceFrame = previous.sourceFrame + generatedInBetweenCount;
  return {
    displayFrame: safeDisplayFrame,
    sourceFrame,
    previousSegmentOverride: {
      fromSourceFrame: previous.sourceFrame,
      toSourceFrame: sourceFrame,
      inBetweenCount: generatedInBetweenCount,
    },
  };
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
function normalizeRealRotoKeyFrames(realKeys: number[]): number[] {
  return Array.from(new Set(realKeys.filter(frame => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
}

function normalizeSelectedRealKey(selectedFrame: number, sortedKeys: number[]): number {
  if (sortedKeys.length === 0) return clampNonNegativeInteger(selectedFrame, 0);
  if (sortedKeys.includes(selectedFrame)) return selectedFrame;
  return getNearestRealRotoKeyFrame(selectedFrame, sortedKeys) ?? sortedKeys[0];
}

function getSegmentOverride(fromSourceFrame: number, toSourceFrame: number | undefined, overrides: readonly RotoSegmentSpacingOverride[]): RotoSegmentSpacingOverride | undefined {
  if (toSourceFrame === undefined) return undefined;
  return overrides.find((candidate) => candidate.fromSourceFrame === fromSourceFrame && candidate.toSourceFrame === toSourceFrame);
}

function getAdjacentSourceSegments(sourceKeys: readonly number[]): Set<string> {
  const segments = new Set<string>();
  for (let index = 0; index < sourceKeys.length - 1; index++) {
    segments.add(`${sourceKeys[index]}:${sourceKeys[index + 1]}`);
  }
  return segments;
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

function clampRotoInBetweenCount(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 1;
  const integer = Math.trunc(numeric);
  if (integer < PHYSIC_PAINT_MIN_APPLY_FRAMES) return PHYSIC_PAINT_MIN_APPLY_FRAMES;
  if (integer > PHYSIC_PAINT_MAX_APPLY_FRAMES) return PHYSIC_PAINT_MAX_APPLY_FRAMES;
  return integer;
}

function isPositiveFrameCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= PHYSIC_PAINT_MIN_APPLY_FRAMES && value <= PHYSIC_PAINT_MAX_APPLY_FRAMES;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

