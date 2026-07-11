import { computed, signal, type Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { selectRotoTimelineView, type RotoTimelineView } from '../roto/rotoTimelineSelectors';

export interface RotoTimelineModelInput {
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  interpolationSettings?: Partial<PhysicPaintRotoInterpolationSettings> | null;
  currentFrame: number;
}

export interface RotoTimelineModel {
  view: Signal<RotoTimelineView>;
  occupiedRotoFrames: Signal<number[]>;
  savedRotoFrames: Signal<RotoTimelineView['savedRotoFrames']>;
  cachedRotoFrames: Signal<PhysicPaintRotoCacheFrame[]>;
  currentFrameIsGenerated: Signal<boolean>;
}

export function createRotoTimelineModel(input: RotoTimelineModelInput): RotoTimelineModel {
  const source = signal(input);
  const view = computed(() => selectRotoTimelineView(source.value));
  return {
    view,
    occupiedRotoFrames: computed(() => view.value.occupiedRotoFrames),
    savedRotoFrames: computed(() => view.value.savedRotoFrames),
    cachedRotoFrames: computed(() => view.value.cachedRotoFrames),
    currentFrameIsGenerated: computed(() => view.value.currentFrameIsGenerated),
  };
}

export function useRotoTimelineModel(input: RotoTimelineModelInput): RotoTimelineModel {
  return useMemo(() => createRotoTimelineModel(input), [input.cachedRotoFrames, input.currentFrame, input.interpolationSettings]);
}
