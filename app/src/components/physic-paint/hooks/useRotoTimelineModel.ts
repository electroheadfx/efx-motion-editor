import { computed, signal, type Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { selectRotoTimelineView, type RotoTimelineSelectionKind, type RotoTimelineView } from '../roto/rotoTimelineSelectors';
import type { PhysicPaintRotoRealKeyRecord, PhysicPaintRotoInterpolationState } from '../roto/physicsPaintRotoPhysicalModel';

export interface RotoTimelineModelInput {
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  interpolationSettings?: Partial<PhysicPaintRotoInterpolationSettings> | null;
  currentFrame: number;
  /** Physical real-key records from the store (D-01/D-10). Consumed by Task 3 migration. */
  rotoKeyRecords?: readonly PhysicPaintRotoRealKeyRecord[];
  /** Enabled-only interpolation state from the store (D-02). Consumed by Task 3 migration. */
  rotoInterpolationState?: PhysicPaintRotoInterpolationState;
}

export interface RotoTimelineModel {
  view: Signal<RotoTimelineView>;
  occupiedRotoFrames: Signal<number[]>;
  savedRotoFrames: Signal<RotoTimelineView['savedRotoFrames']>;
  cachedRotoFrames: Signal<PhysicPaintRotoCacheFrame[]>;
  currentFrameSelectionKind: Signal<RotoTimelineSelectionKind>;
  currentFrameOwnerSourceFrame: Signal<number | null>;
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
    currentFrameSelectionKind: computed(() => view.value.currentFrameSelectionKind),
    currentFrameOwnerSourceFrame: computed(() => view.value.currentFrameOwnerSourceFrame),
    currentFrameIsGenerated: computed(() => view.value.currentFrameIsGenerated),
  };
}

export function useRotoTimelineModel(input: RotoTimelineModelInput): RotoTimelineModel {
  return useMemo(() => createRotoTimelineModel(input), [input.cachedRotoFrames, input.currentFrame, input.interpolationSettings]);
}
