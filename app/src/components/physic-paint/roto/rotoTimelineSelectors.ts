import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import type { PhysicsPaintWorkflowStripFrameMarker } from '../view/PhysicsPaintWorkflowStrip';
import {
  getExpandedRotoRealKeyFrames,
  normalizeRotoSegmentSpacingOverrides,
  type RotoExpandedRealKeyFrame,
  type RotoInterpolationSettings,
} from './physicsPaintRotoWorkflow';
import type {
  PhysicPaintRotoRealKeyRecord,
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoLoopClip,
} from './physicsPaintRotoPhysicalModel';
import {
  derivePhysicPaintRotoLoopRanges,
  projectPhysicPaintRotoPhysicalTimeline,
  resolvePhysicPaintRotoLoopFrame,
  type PhysicPaintRotoFrameResolution,
  type PhysicPaintRotoLoopResolutionContext,
  type PhysicPaintRotoPhysicalTimelineProjection,
} from './physicsPaintRotoPhysicalResolver';
import type { RotoPhysicalTimelineCell } from './rotoPhysicalTimelinePorts';

// Inlined source/display model helpers (formerly from rotoSourceDisplayModel.ts).
// These remain temporarily for the legacy selectRotoTimelineView function and
// will be removed when all callers migrate to selectRotoPhysicalTimelineView.

interface RotoSourceDisplayModel {
  realSourceFrames: number[];
  settings: RotoInterpolationSettings;
}

interface RotoDisplayProjection {
  cells: RotoExpandedRealKeyFrame[];
  realKeys: Extract<RotoExpandedRealKeyFrame, { kind: 'real-key' }>[];
  generatedFrames: Extract<RotoExpandedRealKeyFrame, { kind: 'generated-interpolation' }>[];
}

function normalizeRealSourceFrames(frames: readonly number[]): number[] {
  return Array.from(new Set(frames.filter((frame) => Number.isInteger(frame) && frame >= 0))).sort((a, b) => a - b);
}

function createRotoSourceDisplayModelLegacy(input: { realSourceFrames: readonly number[]; settings: RotoInterpolationSettings }): RotoSourceDisplayModel {
  const realSourceFrames = normalizeRealSourceFrames(input.realSourceFrames);
  const settings: RotoInterpolationSettings = {
    ...input.settings,
    segmentSpacingOverrides: normalizeRotoSegmentSpacingOverrides(input.settings.segmentSpacingOverrides, realSourceFrames),
  };
  return { realSourceFrames, settings };
}

function getRotoDisplayProjectionLegacy(
  model: RotoSourceDisplayModel,
  settingsPatch: Partial<RotoInterpolationSettings> = {},
): RotoDisplayProjection {
  const settings: RotoInterpolationSettings = {
    ...model.settings,
    ...settingsPatch,
    segmentSpacingOverrides: normalizeRotoSegmentSpacingOverrides(
      settingsPatch.segmentSpacingOverrides ?? model.settings.segmentSpacingOverrides,
      model.realSourceFrames,
    ),
  };
  const cells = settings.enabled === true
    ? getExpandedRotoRealKeyFrames(model.realSourceFrames, settings)
    : model.realSourceFrames.map((sourceFrame) => ({ sourceFrame, frame: sourceFrame, displayFrame: sourceFrame, kind: 'real-key' as const }));
  return {
    cells,
    realKeys: cells.filter((cell): cell is Extract<RotoExpandedRealKeyFrame, { kind: 'real-key' }> => cell.kind === 'real-key'),
    generatedFrames: cells.filter((cell): cell is Extract<RotoExpandedRealKeyFrame, { kind: 'generated-interpolation' }> => cell.kind === 'generated-interpolation'),
  };
}

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

/**
 * Structural (frame-independent) half of the legacy source/display view:
 * model, projection, and marker/cache lists derived solely from cached frames
 * and interpolation settings. Keeps reference identity across pure frame
 * changes so downstream memos stop recomputing per frame (38.1 D-07).
 */
export interface RotoLegacyTimelineStructuralView {
  readonly model: RotoSourceDisplayModel;
  readonly projection: RotoDisplayProjection;
  readonly realKeyDisplayFrames: number[];
  readonly occupiedRotoFrames: number[];
  readonly savedRotoFrames: PhysicsPaintWorkflowStripFrameMarker[];
  readonly cachedRotoFrames: PhysicPaintRotoCacheFrame[];
}

export function selectRotoLegacyTimelineStructuralView(input: {
  cachedRotoFrames?: readonly PhysicPaintRotoCacheFrame[];
  interpolationSettings?: Partial<PhysicPaintRotoInterpolationSettings> | null;
}): RotoLegacyTimelineStructuralView {
  const model = createRotoSourceDisplayModelLegacy({
    realSourceFrames: selectRealSourceFrames(input.cachedRotoFrames),
    settings: normalizeTimelineSettings(input.interpolationSettings),
  });
  const projection = getRotoDisplayProjectionLegacy(model);
  const realKeyDisplayFrames = projection.realKeys.map((key) => key.displayFrame);
  const occupiedRotoFrames = normalizeFrameNumbers(realKeyDisplayFrames);
  const savedRotoFrames = realKeyDisplayFrames.map((frame) => ({ frame, saved: true, label: `Frame ${frame}` }));
  const cachedRotoFrames = [...(input.cachedRotoFrames ?? [])];
  return { model, projection, realKeyDisplayFrames, occupiedRotoFrames, savedRotoFrames, cachedRotoFrames };
}

/**
 * Frame-dependent assembly for the legacy view: cheap `find`/`includes`
 * lookups over the structural view for the current frame. Values are
 * byte-identical to the pre-split selector for identical inputs (38.1 D-09).
 */
export function assembleRotoTimelineView(
  structural: RotoLegacyTimelineStructuralView,
  currentFrame: number,
): RotoTimelineView {
  const { model, projection, realKeyDisplayFrames, occupiedRotoFrames, savedRotoFrames, cachedRotoFrames } = structural;
  const currentRealKey = projection.realKeys.find((frame) => frame.displayFrame === currentFrame);
  const currentGeneratedFrame = projection.generatedFrames.find((frame) => frame.displayFrame === currentFrame);
  const cachedCurrentGeneratedFrame = cachedRotoFrames.find((frame) => frame.source === 'generated-interpolation' && frame.appFrame === currentFrame);
  const currentFrameIsGenerated = Boolean(currentGeneratedFrame || cachedCurrentGeneratedFrame);
  const currentFrameOwnerSourceFrame = currentRealKey?.sourceFrame
    ?? currentGeneratedFrame?.fromSourceFrame
    ?? cachedCurrentGeneratedFrame?.fromSourceFrame
    ?? cachedCurrentGeneratedFrame?.sourceFrame
    ?? null;
  const currentFrameSelectionKind: RotoTimelineSelectionKind = realKeyDisplayFrames.includes(currentFrame)
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

export function selectRotoTimelineView(input: RotoTimelineSelectorInput): RotoTimelineView {
  return assembleRotoTimelineView(selectRotoLegacyTimelineStructuralView(input), input.currentFrame);
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

// ---------------------------------------------------------------------------
// Physical timeline view (D-01/D-02/D-10/D-12).
//
// These selectors source all state from the store's validated physical records
// and the shared `projectPhysicPaintRotoPhysicalTimeline` seam. They expose
// semantic current-cell state for real, generated, and empty physical cells
// without source/display projection, owner-source fields, or cached-frame
// ownership authority.
// ---------------------------------------------------------------------------

/**
 * Input for the physical timeline view selector.
 */
export interface RotoPhysicalTimelineViewSelectorInput {
  /** Ordered real-key records from the store's physical record ownership. */
  readonly realKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  /** Canonical interpolation state from the store. */
  readonly interpolation: PhysicPaintRotoInterpolationState;
  /** Bounded physical frame capacity. */
  readonly capacity: number;
  /** Current direct physical navigation frame. */
  readonly currentAppFrame: number;
  /** Selected stable `keyId`, or null when no real key is selected. */
  readonly selectedKeyId: string | null;
}

/**
 * Physical timeline view: semantic current-cell state, selected identity/record/
 * frame, ordered real records, exact generated cells, bounded physical cells,
 * and marker presentation derived from one projection.
 */
export interface RotoPhysicalTimelineView {
  readonly orderedRealKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly physicalCells: readonly RotoPhysicalTimelineCell[];
  readonly generatedCells: readonly RotoPhysicalTimelineCell[];
  readonly orderedKeyIds: readonly string[];
  readonly currentCell: RotoPhysicalTimelineCell;
  readonly selectedKeyId: string | null;
  readonly selectedRealKey: PhysicPaintRotoRealKeyRecord | null;
  readonly selectedAppFrame: number | null;
  readonly currentAppFrame: number;
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly capacity: number;
  readonly projection: PhysicPaintRotoPhysicalTimelineProjection | null;
}

/**
 * Structural (frame-independent) half of the physical timeline view: the
 * shared projection seam plus every field derived solely from identities,
 * interpolation, and capacity. Keeps reference identity across pure frame or
 * selection changes (38.1 D-07).
 */
export interface RotoPhysicalTimelineStructuralView {
  readonly orderedRealKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly physicalCells: readonly RotoPhysicalTimelineCell[];
  readonly generatedCells: readonly RotoPhysicalTimelineCell[];
  readonly orderedKeyIds: readonly string[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly capacity: number;
  readonly projection: PhysicPaintRotoPhysicalTimelineProjection | null;
  /**
   * Phase 43: compact per-loop interval derivation plus the real-key frame
   * index backing the lazy per-frame resolution query (D-26/D-32). Structural
   * — rebuilt only when records, loopClips, parent end, or capacity change.
   */
  readonly loopResolution: PhysicPaintRotoLoopResolutionContext;
}

export function selectRotoPhysicalTimelineStructuralView(input: {
  readonly realKeyRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolation: PhysicPaintRotoInterpolationState;
  readonly capacity: number;
  /** Phase 43 additive Loop Clip collection; absent means empty (D-29). */
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  /**
   * Parent sequence end (exclusive). Defaults to the physical capacity for
   * the Studio-owned physical timeline; the main editor passes the live
   * parent end so infinity loops track it dynamically (D-25).
   */
  readonly parentEndExclusive?: number;
}): RotoPhysicalTimelineStructuralView {
  const { realKeyRecords, interpolation, capacity } = input;

  const identities = realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
  const projectionResult = projectPhysicPaintRotoPhysicalTimeline({
    identities,
    capacity,
    interpolationEnabled: interpolation.enabled,
  });

  if (!projectionResult.ok) {
    // Fail closed: structural empty view with no projection and no loops.
    return {
      orderedRealKeyRecords: realKeyRecords,
      physicalCells: [],
      generatedCells: [],
      orderedKeyIds: [],
      interpolation,
      capacity,
      projection: null,
      loopResolution: derivePhysicPaintRotoLoopRanges({
        identities: [],
        loopClips: [],
        parentEndExclusive: 0,
        capacity: 1,
        interpolationEnabled: interpolation.enabled,
      }),
    };
  }

  const projection = projectionResult.projection;
  return {
    orderedRealKeyRecords: realKeyRecords,
    physicalCells: projection.cells,
    generatedCells: projection.generatedCells,
    orderedKeyIds: projection.orderedKeyIds,
    interpolation,
    capacity,
    projection,
    loopResolution: derivePhysicPaintRotoLoopRanges({
      identities,
      loopClips: input.loopClips ?? [],
      parentEndExclusive: input.parentEndExclusive ?? capacity,
      capacity,
      interpolationEnabled: interpolation.enabled,
    }),
  };
}

/**
 * Frame/selection assembly for the physical view: cheap `find` lookups over
 * the structural view. Values are byte-identical to the pre-split selector
 * for identical inputs (38.1 D-09); the fail-closed empty-view branch is
 * preserved verbatim.
 */
export function assembleRotoPhysicalTimelineView(
  structural: RotoPhysicalTimelineStructuralView,
  input: {
    readonly currentAppFrame: number;
    readonly selectedKeyId: string | null;
  },
): RotoPhysicalTimelineView {
  const { currentAppFrame, selectedKeyId } = input;

  if (structural.projection === null) {
    // Fail closed: return an empty physical view with no projection.
    const emptyCell: RotoPhysicalTimelineCell = { kind: 'empty', appFrame: currentAppFrame };
    return {
      orderedRealKeyRecords: structural.orderedRealKeyRecords,
      physicalCells: structural.physicalCells,
      generatedCells: structural.generatedCells,
      orderedKeyIds: structural.orderedKeyIds,
      currentCell: emptyCell,
      selectedKeyId: null,
      selectedRealKey: null,
      selectedAppFrame: null,
      currentAppFrame,
      interpolation: structural.interpolation,
      capacity: structural.capacity,
      projection: null,
    };
  }

  const currentCell = structural.physicalCells.find((cell) => cell.appFrame === currentAppFrame)
    ?? { kind: 'empty' as const, appFrame: currentAppFrame };

  const selectedRealKey = selectedKeyId !== null
    ? structural.orderedRealKeyRecords.find((record) => record.keyId === selectedKeyId) ?? null
    : null;
  const selectedAppFrame = selectedRealKey?.appFrame ?? null;

  return {
    orderedRealKeyRecords: structural.orderedRealKeyRecords,
    physicalCells: structural.physicalCells,
    generatedCells: structural.generatedCells,
    orderedKeyIds: structural.orderedKeyIds,
    currentCell,
    selectedKeyId,
    selectedRealKey,
    selectedAppFrame,
    currentAppFrame,
    interpolation: structural.interpolation,
    capacity: structural.capacity,
    projection: structural.projection,
  };
}

/**
 * Select the physical timeline view from the store's validated physical records,
 * canonical interpolation state, bounded capacity, current navigation frame,
 * and selected keyId. Derives semantic cells, selection, and ordered records from
 * one shared projection seam.
 */
export function selectRotoPhysicalTimelineView(input: RotoPhysicalTimelineViewSelectorInput): RotoPhysicalTimelineView {
  return assembleRotoPhysicalTimelineView(selectRotoPhysicalTimelineStructuralView(input), input);
}

// ---------------------------------------------------------------------------
// Phase 43: linked Loop Clip frame-resolution consumers (HOLD-05, Pitfall 7).
//
// The typed frame-resolution union ('real' | 'linked' | 'linked-unresolved' |
// 'empty') is consumed here with explicit arms and a never-fallback
// exhaustiveness guard: adding a future resolution kind is a compile-time
// error at these switches, so no consumer can silently treat a virtual
// occurrence as a key (D-23/D-11).
// ---------------------------------------------------------------------------

/**
 * Key-interaction eligibility derived from the typed frame resolution. Only
 * a 'real' frame yields a selectable/draggable key identity; 'linked' and
 * 'linked-unresolved' virtual occurrences produce no key selection, no drag
 * start, and no Force Spacing eligibility (D-23/D-11).
 */
export interface RotoFrameKeyInteraction {
  readonly keySelectable: boolean;
  readonly dragEligible: boolean;
  readonly selectedKeyId: string | null;
}

export function getRotoFrameKeyInteraction(resolution: PhysicPaintRotoFrameResolution): RotoFrameKeyInteraction {
  switch (resolution.kind) {
    case 'real':
      return { keySelectable: true, dragEligible: true, selectedKeyId: resolution.keyId };
    case 'linked':
      // Virtual occurrence: presentation-only, never a key (D-23).
      return { keySelectable: false, dragEligible: false, selectedKeyId: null };
    case 'linked-generated':
      return { keySelectable: false, dragEligible: false, selectedKeyId: null };
    case 'linked-gap':
      return { keySelectable: false, dragEligible: false, selectedKeyId: null };
    case 'linked-unresolved':
      // Error-state virtual occurrence: equally non-selectable (D-31).
      return { keySelectable: false, dragEligible: false, selectedKeyId: null };
    case 'empty':
      return { keySelectable: false, dragEligible: false, selectedKeyId: null };
    default: {
      const exhaustive: never = resolution;
      throw new Error(`Unhandled Roto frame resolution kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Resolve the lazy per-frame contract for exactly the requested visible
 * frames — one query per visible frame, O(visible frames × log loops), never
 * proportional to any loop's effective range (D-32). The Studio strip calls
 * this with its viewport window; the query parameter is injectable so specs
 * can spy the query count.
 */
export function resolveRotoVisibleFrameResolutions(
  context: PhysicPaintRotoLoopResolutionContext,
  visibleFrames: readonly number[],
  query: (context: PhysicPaintRotoLoopResolutionContext, appFrame: number) => PhysicPaintRotoFrameResolution = resolvePhysicPaintRotoLoopFrame,
): ReadonlyMap<number, PhysicPaintRotoFrameResolution> {
  const resolutions = new Map<number, PhysicPaintRotoFrameResolution>();
  for (const frame of visibleFrames) {
    resolutions.set(frame, query(context, frame));
  }
  return resolutions;
}
