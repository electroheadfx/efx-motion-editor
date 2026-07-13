import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowStripFrameMarker } from '../view/PhysicsPaintWorkflowStrip';
import {
  createRotoSourceDisplayModel,
  getRotoDisplayProjection,
  type RotoDisplayProjection,
  type RotoSourceDisplayModel,
} from '../roto/rotoSourceDisplayModel';

export interface RotoTimelineSelectorInput {
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  interpolationSettings?: Partial<PhysicPaintRotoInterpolationSettings> | null;
  currentFrame: number;
}

export type RotoTimelineSelectionKind = 'real-key' | 'generated-interpolation' | 'empty';

export interface RotoTimelineView {
  model: RotoSourceDisplayModel;
  projection: RotoDisplayProjection;
  occupiedRotoFrames: number[];
  savedRotoFrames: PhysicsPaintWorkflowStripFrameMarker[];
  cachedRotoFrames: PhysicPaintRotoCacheFrame[];
  currentFrameSelectionKind: RotoTimelineSelectionKind;
  currentFrameOwnerSourceFrame: number | null;
  currentFrameIsGenerated: boolean;
}

export function selectRealCachedRotoFrames(contextCachedRotoFrames: readonly PhysicPaintRotoCacheFrame[] | undefined): PhysicPaintRotoCacheFrame[] {
  return contextCachedRotoFrames
    ?.filter((frame) => frame.source === 'real-key')
    .map((frame) => {
      const sourceFrame = frame.sourceFrame ?? frame.appFrame;
      const displayFrame = frame.displayFrame ?? frame.appFrame;
      return { ...frame, appFrame: displayFrame, source: 'real-key', sourceFrame, displayFrame };
    }) ?? [];
}

export function selectProjectedRealCachedRotoFrames(
  contextCachedRotoFrames: readonly PhysicPaintRotoCacheFrame[] | undefined,
  projection: RotoDisplayProjection,
): PhysicPaintRotoCacheFrame[] {
  const framesBySource = new Map(selectRealCachedRotoFrames(contextCachedRotoFrames)
    .map((frame) => [frame.sourceFrame ?? frame.appFrame, frame]));
  return projection.realKeys.flatMap((key) => {
    const frame = framesBySource.get(key.sourceFrame);
    return frame ? [{ ...frame, appFrame: key.displayFrame, sourceFrame: key.sourceFrame, displayFrame: key.displayFrame }] : [];
  });
}

export function selectRealCachedRotoSourceFrameNumbers(contextCachedRotoFrames: readonly PhysicPaintRotoCacheFrame[] | undefined): number[] {
  return contextCachedRotoFrames
    ?.filter((frame) => frame.source === 'real-key')
    .map((frame) => frame.sourceFrame ?? frame.appFrame)
    .sort((a, b) => a - b) ?? [];
}

export function selectRotoTimelineView(input: RotoTimelineSelectorInput): RotoTimelineView {
  const model = createRotoSourceDisplayModel({
    realSourceFrames: selectRealSourceFrames(input.cachedRotoFrames),
    settings: normalizeTimelineSettings(input.interpolationSettings),
  });
  const projection = getRotoDisplayProjection(model);
  const realKeyDisplayFrames = projection.realKeys.map((key) => key.displayFrame);
  const occupiedRotoFrames = normalizeFrameNumbers(realKeyDisplayFrames);
  const savedRotoFrames = realKeyDisplayFrames.map((frame) => ({ frame, saved: true, label: `Frame ${frame}` }));
  const cachedRotoFrames = [...(input.cachedRotoFrames ?? [])];
  const currentGeneratedFrame = projection.generatedFrames.find((frame) => frame.displayFrame === input.currentFrame);
  const cachedCurrentGeneratedFrame = cachedRotoFrames.find((frame) => frame.source === 'generated-interpolation' && frame.appFrame === input.currentFrame);
  const currentFrameIsGenerated = Boolean(currentGeneratedFrame || cachedCurrentGeneratedFrame);
  const currentFrameOwnerSourceFrame = currentGeneratedFrame?.fromSourceFrame
    ?? cachedCurrentGeneratedFrame?.fromSourceFrame
    ?? cachedCurrentGeneratedFrame?.sourceFrame
    ?? null;
  const currentFrameSelectionKind: RotoTimelineSelectionKind = realKeyDisplayFrames.includes(input.currentFrame)
    ? 'real-key'
    : currentFrameIsGenerated
      ? 'generated-interpolation'
      : 'empty';

  return {
    model,
    projection,
    occupiedRotoFrames,
    savedRotoFrames,
    cachedRotoFrames,
    currentFrameSelectionKind,
    currentFrameOwnerSourceFrame,
    currentFrameIsGenerated,
  };
}

export function selectRealSourceFrames(cachedRotoFrames: readonly PhysicPaintRotoCacheFrame[] | undefined): number[] {
  return Array.from(new Set((cachedRotoFrames ?? [])
    .filter((frame) => frame.source === 'real-key')
    .map((frame) => frame.sourceFrame ?? frame.appFrame)
    .filter((frame) => Number.isInteger(frame) && frame >= 0)))
    .sort((a, b) => a - b);
}

function normalizeFrameNumbers(frames: readonly number[]): number[] {
  return Array.from(new Set(frames.filter((frame) => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
}

function normalizeTimelineSettings(settings: Partial<PhysicPaintRotoInterpolationSettings> | null | undefined): PhysicPaintRotoInterpolationSettings {
  const inBetweenCount = settings?.inBetweenCount;
  const deform = settings?.deform;
  const position = settings?.position;
  return {
    enabled: settings?.enabled === true,
    inBetweenCount: Number.isInteger(inBetweenCount) && inBetweenCount !== undefined && inBetweenCount >= 1 ? inBetweenCount : 1,
    mode: settings?.mode === 'blend' ? 'blend' : 'duplicate',
    deform: Number.isInteger(deform) && deform !== undefined ? deform : 0,
    position: Number.isInteger(position) && position !== undefined ? position : 0,
    ...(settings?.segmentSpacingOverrides ? { segmentSpacingOverrides: settings.segmentSpacingOverrides } : {}),
  };
}
