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
} from './physicsPaintRotoPhysicalModel';
import {
  projectPhysicPaintRotoPhysicalTimeline,
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

export function selectRotoTimelineView(input: RotoTimelineSelectorInput): RotoTimelineView {
  const model = createRotoSourceDisplayModelLegacy({
    realSourceFrames: selectRealSourceFrames(input.cachedRotoFrames),
    settings: normalizeTimelineSettings(input.interpolationSettings),
  });
  const projection = getRotoDisplayProjectionLegacy(model);
  const realKeyDisplayFrames = projection.realKeys.map((key) => key.displayFrame);
  const occupiedRotoFrames = normalizeFrameNumbers(realKeyDisplayFrames);
  const savedRotoFrames = realKeyDisplayFrames.map((frame) => ({ frame, saved: true, label: `Frame ${frame}` }));
  const cachedRotoFrames = [...(input.cachedRotoFrames ?? [])];
  const currentRealKey = projection.realKeys.find((frame) => frame.displayFrame === input.currentFrame);
  const currentGeneratedFrame = projection.generatedFrames.find((frame) => frame.displayFrame === input.currentFrame);
  const cachedCurrentGeneratedFrame = cachedRotoFrames.find((frame) => frame.source === 'generated-interpolation' && frame.appFrame === input.currentFrame);
  const currentFrameIsGenerated = Boolean(currentGeneratedFrame || cachedCurrentGeneratedFrame);
  const currentFrameOwnerSourceFrame = currentRealKey?.sourceFrame
    ?? currentGeneratedFrame?.fromSourceFrame
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
 * Select the physical timeline view from the store's validated physical records,
 * canonical interpolation state, bounded capacity, current navigation frame,
 * and selected keyId. Derives semantic cells, selection, and ordered records from
 * one shared projection seam.
 */
export function selectRotoPhysicalTimelineView(input: RotoPhysicalTimelineViewSelectorInput): RotoPhysicalTimelineView {
  const { realKeyRecords, interpolation, capacity, currentAppFrame, selectedKeyId } = input;

  const identities = realKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
  const projectionResult = projectPhysicPaintRotoPhysicalTimeline({
    identities,
    capacity,
    interpolationEnabled: interpolation.enabled,
  });

  if (!projectionResult.ok) {
    // Fail closed: return an empty physical view with no projection.
    const emptyCell: RotoPhysicalTimelineCell = { kind: 'empty', appFrame: currentAppFrame };
    return {
      orderedRealKeyRecords: realKeyRecords,
      physicalCells: [],
      generatedCells: [],
      orderedKeyIds: [],
      currentCell: emptyCell,
      selectedKeyId: null,
      selectedRealKey: null,
      selectedAppFrame: null,
      currentAppFrame,
      interpolation,
      capacity,
      projection: null,
    };
  }

  const projection = projectionResult.projection;
  const currentCell = projection.cells.find((cell) => cell.appFrame === currentAppFrame)
    ?? { kind: 'empty' as const, appFrame: currentAppFrame };

  const selectedRealKey = selectedKeyId !== null
    ? realKeyRecords.find((record) => record.keyId === selectedKeyId) ?? null
    : null;
  const selectedAppFrame = selectedRealKey?.appFrame ?? null;

  return {
    orderedRealKeyRecords: realKeyRecords,
    physicalCells: projection.cells,
    generatedCells: projection.generatedCells,
    orderedKeyIds: projection.orderedKeyIds,
    currentCell,
    selectedKeyId,
    selectedRealKey,
    selectedAppFrame,
    currentAppFrame,
    interpolation,
    capacity,
    projection,
  };
}
