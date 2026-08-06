import { computed, signal, type Signal } from '@preact/signals';
import { useMemo } from 'preact/hooks';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import type { RotoTimelineSelectionKind, RotoTimelineView, RotoPhysicalTimelineView } from '../roto/rotoTimelineSelectors';
import {
  assembleRotoPhysicalTimelineView,
  assembleRotoTimelineView,
  selectRotoLegacyTimelineStructuralView,
  selectRotoPhysicalTimelineStructuralView,
} from '../roto/rotoTimelineSelectors';
import {
  PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
  type PhysicPaintRotoRealKeyRecord,
  type PhysicPaintRotoInterpolationState,
  type PhysicPaintRotoLoopClip,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  resolvePhysicPaintRotoLoopFrame,
  type PhysicPaintRotoFrameResolution,
  type PhysicPaintRotoLoopResolutionContext,
} from '../roto/physicsPaintRotoPhysicalResolver';
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
  /** Phase 43 additive Loop Clip collection; absent means empty (D-29). */
  rotoLoopClips?: readonly PhysicPaintRotoLoopClip[];
  /** Parent sequence end (exclusive); defaults to capacity (D-25). */
  rotoParentEndExclusive?: number;
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
  /**
   * Phase 43: structurally derived loop resolution context (one compact
   * interval record per Loop Clip plus the real-key frame index). Rebuilt
   * only when records/loopClips/parent end/capacity change (D-32).
   */
  loopResolutionContext: Signal<PhysicPaintRotoLoopResolutionContext>;
  /**
   * Lazy per-frame resolution returning the single typed contract 'real' |
   * 'linked' | 'linked-unresolved' | 'empty' (audit finding 3). This model
   * deliberately never branches on the resolution kind — kind handling lives
   * in the exhaustiveness-guarded consumer helpers (Pitfall 7).
   */
  getFrameResolution(appFrame: number): PhysicPaintRotoFrameResolution;
  // Additive write seam (38.1 D-07): frame/selection writes update the
  // persistent graph in place; the structural projection is never rebuilt.
  // Writes are equality-guarded against the current peeked value (Pitfall 3).
  setCurrentFrame(frame: number): void;
  setSelectedKeyId(keyId: string | null): void;
}

export function createRotoTimelineModel(input: RotoTimelineModelInput): RotoTimelineModel {
  // Structural inputs: records, interpolation, capacity, cached frames, and
  // interpolation settings. Frame/selection live in their own signals so a
  // navigation frame change never rebuilds the structural projection.
  const structuralInput = signal({
    cachedRotoFrames: input.cachedRotoFrames,
    interpolationSettings: input.interpolationSettings,
    rotoKeyRecords: input.rotoKeyRecords,
    rotoInterpolationState: input.rotoInterpolationState,
    capacity: input.capacity,
    rotoLoopClips: input.rotoLoopClips,
    rotoParentEndExclusive: input.rotoParentEndExclusive,
  });
  const currentFrame = signal(input.currentFrame);
  const selectedKeyIdInput = signal(input.selectedKeyId ?? null);

  const legacyStructural = computed(() => selectRotoLegacyTimelineStructuralView(structuralInput.value));
  const physicalStructural = computed(() => selectRotoPhysicalTimelineStructuralView({
    realKeyRecords: structuralInput.value.rotoKeyRecords ?? [],
    interpolation: structuralInput.value.rotoInterpolationState ?? PHYSIC_PAINT_ROTO_INTERPOLATION_DISABLED,
    capacity: structuralInput.value.capacity ?? 1,
    loopClips: structuralInput.value.rotoLoopClips,
    parentEndExclusive: structuralInput.value.rotoParentEndExclusive,
  }));

  const view = computed(() => assembleRotoTimelineView(legacyStructural.value, currentFrame.value));
  const physicalView = computed(() => assembleRotoPhysicalTimelineView(physicalStructural.value, {
    currentAppFrame: currentFrame.value,
    selectedKeyId: selectedKeyIdInput.value,
  }));

  return {
    view,
    occupiedRotoFrames: computed(() => legacyStructural.value.occupiedRotoFrames),
    savedRotoFrames: computed(() => legacyStructural.value.savedRotoFrames),
    cachedRotoFrames: computed(() => legacyStructural.value.cachedRotoFrames),
    currentFrameSelectionKind: computed(() => view.value.currentFrameSelectionKind),
    currentFrameOwnerSourceFrame: computed(() => view.value.currentFrameOwnerSourceFrame),
    currentFrameIsGenerated: computed(() => view.value.currentFrameIsGenerated),
    physicalView,
    currentCell: computed(() => physicalView.value.currentCell),
    selectedKeyId: computed(() => physicalView.value.selectedKeyId),
    selectedRealKey: computed(() => physicalView.value.selectedRealKey),
    selectedAppFrame: computed(() => physicalView.value.selectedAppFrame),
    orderedRealKeyRecords: computed(() => physicalStructural.value.orderedRealKeyRecords),
    generatedCells: computed(() => physicalStructural.value.generatedCells),
    physicalCells: computed(() => physicalStructural.value.physicalCells),
    loopResolutionContext: computed(() => physicalStructural.value.loopResolution),
    getFrameResolution(appFrame: number): PhysicPaintRotoFrameResolution {
      return resolvePhysicPaintRotoLoopFrame(physicalStructural.value.loopResolution, appFrame);
    },
    setCurrentFrame(frame: number): void {
      if (currentFrame.peek() !== frame) currentFrame.value = frame;
    },
    setSelectedKeyId(keyId: string | null): void {
      if (selectedKeyIdInput.peek() !== keyId) selectedKeyIdInput.value = keyId;
    },
  };
}

export function useRotoTimelineModel(input: RotoTimelineModelInput): RotoTimelineModel {
  // Structural input identity alone recreates the graph; frame and selection
  // inputs are deliberately absent from the dependency array (38.1 D-07).
  const model = useMemo(() => createRotoTimelineModel(input), [
    input.cachedRotoFrames,
    input.interpolationSettings,
    input.rotoKeyRecords,
    input.rotoInterpolationState,
    input.capacity,
    input.rotoLoopClips,
    input.rotoParentEndExclusive,
  ]);
  // Sync frame/selection into the persistent graph through the guarded write
  // seam, at the top of the hook body — never in an effect, never downstream.
  // Equality guards make these writes no-ops when the values are unchanged.
  model.setCurrentFrame(input.currentFrame);
  model.setSelectedKeyId(input.selectedKeyId ?? null);
  return model;
}
