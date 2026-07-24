import { computed, signal, type Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import { selectRotoTimelineView, type RotoTimelineSelectionKind, type RotoTimelineView } from '../roto/rotoTimelineSelectors';
import { selectRotoPhysicalTimelineView, type RotoPhysicalTimelineView } from '../roto/rotoTimelineSelectors';
import {
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  type PhysicPaintRotoRealKeyRecord,
  type PhysicPaintRotoInterpolationState,
} from '../roto/physicsPaintRotoPhysicalModel';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';

export interface RotoTimelineModelInput {
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  interpolationSettings?: Partial<PhysicPaintRotoInterpolationSettings> | null;
  currentFrame: number;
  /** Physical real-key records from the store (D-01/D-10). */
  rotoKeyRecords?: readonly PhysicPaintRotoRealKeyRecord[];
  /** Canonical interpolation state from the store (D-02). */
  rotoInterpolationState?: PhysicPaintRotoInterpolationState;
  /** Bounded physical frame capacity. */
  capacity?: number;
  /** Selected stable keyId, or null when no real key is selected. */
  selectedKeyId?: string | null;
}

export interface RotoTimelineModel {
  // Legacy source/display view (retained temporarily for unchanged callers).
  view: Signal<RotoTimelineView>;
  occupiedRotoFrames: Signal<number[]>;
  savedRotoFrames: Signal<RotoTimelineView['savedRotoFrames']>;
  cachedRotoFrames: Signal<PhysicPaintRotoCacheFrame[]>;
  currentFrameSelectionKind: Signal<RotoTimelineSelectionKind>;
  currentFrameOwnerSourceFrame: Signal<number | null>;
  currentFrameIsGenerated: Signal<boolean>;
  // Physical timeline view (D-01/D-02/D-10/D-12).
  physicalView: Signal<RotoPhysicalTimelineView>;
  currentCell: Signal<RotoPhysicalTimelineCell>;
  selectedKeyId: Signal<string | null>;
  selectedRealKey: Signal<PhysicPaintRotoRealKeyRecord | null>;
  selectedAppFrame: Signal<number | null>;
  orderedRealKeyRecords: Signal<readonly PhysicPaintRotoRealKeyRecord[]>;
  generatedCells: Signal<readonly RotoPhysicalTimelineCell[]>;
  physicalCells: Signal<readonly RotoPhysicalTimelineCell[]>;
}

export function createRotoTimelineModel(input: RotoTimelineModelInput): RotoTimelineModel {
  const source = signal(input);
  const view = computed(() => selectRotoTimelineView(source.value));
  const physicalView = computed(() => selectRotoPhysicalTimelineView({
    realKeyRecords: source.value.rotoKeyRecords ?? [],
    interpolation: source.value.rotoInterpolationState ?? PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
    capacity: source.value.capacity ?? 1,
    currentAppFrame: source.value.currentFrame,
    selectedKeyId: source.value.selectedKeyId ?? null,
  }));
  return {
    view,
    occupiedRotoFrames: computed(() => view.value.occupiedRotoFrames),
    savedRotoFrames: computed(() => view.value.savedRotoFrames),
    cachedRotoFrames: computed(() => view.value.cachedRotoFrames),
    currentFrameSelectionKind: computed(() => view.value.currentFrameSelectionKind),
    currentFrameOwnerSourceFrame: computed(() => view.value.currentFrameOwnerSourceFrame),
    currentFrameIsGenerated: computed(() => view.value.currentFrameIsGenerated),
    physicalView,
    currentCell: computed(() => physicalView.value.currentCell),
    selectedKeyId: computed(() => physicalView.value.selectedKeyId),
    selectedRealKey: computed(() => physicalView.value.selectedRealKey),
    selectedAppFrame: computed(() => physicalView.value.selectedAppFrame),
    orderedRealKeyRecords: computed(() => physicalView.value.orderedRealKeyRecords),
    generatedCells: computed(() => physicalView.value.generatedCells),
    physicalCells: computed(() => physicalView.value.physicalCells),
  };
}

export function useRotoTimelineModel(input: RotoTimelineModelInput): RotoTimelineModel {
  return useMemo(() => createRotoTimelineModel(input), [input.cachedRotoFrames, input.currentFrame, input.interpolationSettings, input.rotoKeyRecords, input.rotoInterpolationState, input.capacity, input.selectedKeyId]);
}