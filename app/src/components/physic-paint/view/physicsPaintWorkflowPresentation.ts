import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type {
  PhysicPaintRotoFrameResolution,
  PhysicPaintRotoPhysicalCell,
  PhysicPaintRotoPhysicalEditProposal,
  PhysicPaintRotoPhysicalIdentityChange,
} from '../roto/physicsPaintRotoPhysicalResolver';

export type PhysicsPaintWorkflowMode = 'roto';
export type PhysicsPaintApplyStatus = 'idle' | 'applying' | 'success' | 'error';
export type PhysicsPaintEngineStatusTone = 'ready' | 'not-ready' | 'error';
export type RotoCellFill = 'empty' | 'cached-only';
export type RotoCellBaseMeaning = 'empty' | 'cached' | 'generated' | 'background-only';
export type RotoCellOverlay = 'current' | 'dirty' | 'pending';
export type RotoCellState = 'Empty' | 'Cached' | 'Generated' | 'Background only';
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
  pendingFrames?: readonly number[] | ReadonlySet<number>;
  isSaving?: boolean;
}

const ROTO_CELL_STATES: Record<RotoCellBaseMeaning, RotoCellState> = {
  empty: 'Empty',
  cached: 'Cached',
  generated: 'Generated',
  'background-only': 'Background only',
};

const ROTO_CELL_FILL_CLASSES: Record<RotoCellBaseMeaning, string> = {
  empty: 'roto-fill-empty',
  cached: 'roto-fill-cached',
  generated: 'roto-fill-generated',
  'background-only': 'roto-fill-background-only',
};

const EDITABLE_ROTO_CELL_MEANINGS = new Set<RotoCellBaseMeaning>(['empty', 'cached', 'background-only']);

export interface PhysicsPaintOnionState {
  enabled: boolean;
  previous: boolean;
  next: boolean;
  count: number;
  opacity: number;
}
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
  if (!Number.isFinite(numeric)) return 30;
  const integer = Math.trunc(numeric);
  if (integer < 0) return 0;
  if (integer > 100) return 100;
  return integer;
}

export function getRotoCellFill(
  frame: number,
  cachedFrames: readonly PhysicPaintRotoCacheFrame[] | ReadonlySet<number> | readonly number[] | undefined,
): RotoCellFill {
  if (hasCachedRotoFrame(cachedFrames, frame)) return 'cached-only';
  return 'empty';
}

export function getRotoCellViewModel({
  frame,
  currentFrame,
  cachedFrames,
  pendingFrames,
  isSaving = false,
}: RotoCellViewModelInput): RotoCellViewModel {
  const safeFrame = Number.isInteger(frame) && frame >= 0 ? frame : 0;
  const cachedFrame = getCachedRotoFrame(cachedFrames, frame);
  const baseMeaning = getRotoCellBaseMeaning(cachedFrame);
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

// ---------------------------------------------------------------------------
// Header status capsule (Plan 36.15-05, D-15/D-18/D-19; idle context per
// Phase 38 D-08/D-09).
//
// A single prioritized line replaces the retired multi-line status stack:
// pending operation > saving indicator > guard/action feedback > ambient
// current-cell context, with the caller-supplied ambient line shown when
// nothing higher-priority exists. When the ambient input is absent or blank,
// the capsule shows nothing — there is no static filler line (D-08). Within
// the guard/action feedback class the most recent line wins (recency
// metadata supplied by the caller; declaration order is the fallback).
//
// The selector is pure: the strip passes already-resolved strings read from
// its existing props/signal ports. It never reads stores, signals, or props
// objects directly, and every returned line renders as Preact text children
// only (T-36.15-08).
// ---------------------------------------------------------------------------

export interface RotoStatusCapsuleFeedbackCandidate {
  /** Candidate line; null/blank candidates are ignored. */
  text: string | null | undefined;
  /**
   * Most-recent-wins metadata inside the feedback class. Higher values win;
   * candidates without recency fall back to their declaration index, and ties
   * resolve to the later candidate.
   */
  recency?: number;
}

export interface RotoStatusCapsuleInput {
  /** Pending operation line (highest priority): busy copy, drag commit copy. */
  pendingOperation?: string | null;
  /** Saving indicator line. */
  savingIndicator?: string | null;
  /** Guard/action feedback lines with recency metadata. */
  feedback?: readonly RotoStatusCapsuleFeedbackCandidate[];
  /** Ambient current-cell context line; when absent/blank the capsule is empty. */
  ambient?: string | null;
}

export function getRotoStatusCapsuleViewModel(input: RotoStatusCapsuleInput = {}): string {
  const pendingOperation = trimCapsuleLine(input.pendingOperation);
  if (pendingOperation !== null) return pendingOperation;
  const savingIndicator = trimCapsuleLine(input.savingIndicator);
  if (savingIndicator !== null) return savingIndicator;
  let winnerText: string | null = null;
  let winnerRecency = Number.NEGATIVE_INFINITY;
  (input.feedback ?? []).forEach((candidate, index) => {
    const text = trimCapsuleLine(candidate.text);
    if (text === null) return;
    const recency = candidate.recency ?? index;
    if (winnerText === null || recency >= winnerRecency) {
      winnerText = text;
      winnerRecency = recency;
    }
  });
  if (winnerText !== null) return winnerText;
  const ambient = trimCapsuleLine(input.ambient);
  return ambient ?? '';
}

function trimCapsuleLine(line: string | null | undefined): string | null {
  if (typeof line !== 'string') return null;
  const trimmed = line.trim();
  return trimmed.length > 0 ? trimmed : null;
}

// ---------------------------------------------------------------------------
// Idle current-cell context line (Phase 38 D-09).
//
// The capsule's lowest rung describes the cell under the playhead, derived
// render-time by the strip from `currentSemanticCell` + `props.currentFrame`
// and fed through the selector's `ambient` slot. The mapping below is the
// UI-SPEC locked vocabulary — real key, generated interpolation, or empty.
// Pure: no store/signal/props reads; returns display strings only
// (T-36.15-08).
// ---------------------------------------------------------------------------

export function getRotoStatusCapsuleIdleContext({
  cellKind,
  frame,
}: {
  cellKind: 'real' | 'generated' | 'empty' | null;
  frame: number;
}): string | null {
  if (cellKind === 'real') return `Real Roto key · Frame ${frame}`;
  if (cellKind === 'generated') return `Generated frame · Frame ${frame}`;
  if (cellKind === 'empty') return `Empty frame · Frame ${frame}`;
  return null;
}

// ---------------------------------------------------------------------------
// Per-cell state tooltip copy (Plan 36.15-05, D-16/C-06).
//
// The retired bottom cell-states legend is compensated by exact per-cell copy
// routed through the shared styled tooltip. These five strings are the whole
// vocabulary — the strip maps each cell's semantic kind to one of them.
// ---------------------------------------------------------------------------

export type RotoCellSemanticTooltipKind = 'real-key' | 'generated' | 'cached' | 'background-only' | 'empty';

export const ROTO_CELL_STATE_TOOLTIP_COPY: Record<RotoCellSemanticTooltipKind, string> = {
  'real-key': 'Real key',
  generated: 'Generated — render-only',
  cached: 'Cached',
  'background-only': 'Background only',
  empty: 'Empty',
};

export function getRotoCellStateTooltipCopy(kind: RotoCellSemanticTooltipKind): string {
  return ROTO_CELL_STATE_TOOLTIP_COPY[kind];
}

export const ROTO_STARTS_INTERPOLATION_SEGMENT_COPY = 'Starts a new interpolation segment';

export type RotoCellPresentationKind = 'real' | 'generated' | 'linked' | 'empty';

export interface RotoCellPresentationViewModelInput {
  readonly kind: RotoCellPresentationKind;
  readonly keyId: string | null;
  readonly orderedRealKeyIds: readonly string[];
  readonly incomingInterpolationBreakKeyIds: readonly string[];
  readonly baseCopy: string;
}

export interface RotoCellPresentationViewModel {
  readonly startsInterpolationSegment: boolean;
  readonly tooltipCopy: string;
  readonly ariaLabel: string;
}

/**
 * Projects accepted interpolation-break ownership into the existing physical
 * cell description. Ownership stays dormant while its real key is first and
 * becomes visible whenever that key has an ordered predecessor. Global
 * interpolation state is intentionally absent from this presentation input.
 */
export function getRotoCellPresentationViewModel({
  kind,
  keyId,
  orderedRealKeyIds,
  incomingInterpolationBreakKeyIds,
  baseCopy,
}: RotoCellPresentationViewModelInput): RotoCellPresentationViewModel {
  const startsInterpolationSegment = kind === 'real'
    && keyId !== null
    && orderedRealKeyIds.indexOf(keyId) > 0
    && incomingInterpolationBreakKeyIds.includes(keyId);
  const descriptiveCopy = startsInterpolationSegment
    ? `${baseCopy} · ${ROTO_STARTS_INTERPOLATION_SEGMENT_COPY}`
    : baseCopy;

  return {
    startsInterpolationSegment,
    tooltipCopy: descriptiveCopy,
    ariaLabel: descriptiveCopy,
  };
}

/**
 * Map the Phase 43 typed frame-resolution union onto the EXISTING cell-state
 * vocabulary (D-18): linked repetition cells keep their current
 * empty/cached/generated FILL semantics — no new first-class cell state ships
 * in the strip. Product tooltip and aria copy are derived separately from the
 * typed linked resolution below. `existing` is the semantic kind the strip
 * already derived from the physical cell plus cache state. The never-fallback makes
 * a future resolution kind a compile-time error here (Pitfall 7).
 */
export function getRotoResolutionCellTooltipKind(
  resolution: PhysicPaintRotoFrameResolution,
  existing: RotoCellSemanticTooltipKind,
): RotoCellSemanticTooltipKind {
  switch (resolution.kind) {
    case 'real':
      return 'real-key';
    case 'linked':
      return existing;
    case 'linked-generated':
      return existing;
    case 'linked-gap':
      return existing;
    case 'linked-unresolved':
      return existing;
    case 'empty':
      return existing;
    default: {
      const exhaustive: never = resolution;
      throw new Error(`Unhandled Roto frame resolution kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/** Product tooltip copy for the typed frame-resolution contract. */
export function getRotoResolutionCellTooltipCopy(
  resolution: PhysicPaintRotoFrameResolution,
  existing: RotoCellSemanticTooltipKind,
  sourceFrameCountByLoopId: ReadonlyMap<string, number>,
): string {
  const sourceSpanCopy = (
    loopId: string,
    leftSourceIndex: number,
    rightSourceIndex: number,
  ): string => {
    const sourceFrameCount = sourceFrameCountByLoopId.get(loopId);
    return sourceFrameCount === undefined
      ? `Between source frames ${leftSourceIndex + 1} and ${rightSourceIndex + 1}`
      : `Between source frames ${leftSourceIndex + 1} and ${rightSourceIndex + 1} of ${sourceFrameCount}`;
  };
  switch (resolution.kind) {
    case 'real':
      return ROTO_CELL_STATE_TOOLTIP_COPY['real-key'];
    case 'linked': {
      const sourceFrameCount = sourceFrameCountByLoopId.get(resolution.loopId);
      const sourceCopy = sourceFrameCount === undefined
        ? `Source frame ${resolution.sourceIndex + 1}`
        : `Source frame ${resolution.sourceIndex + 1} of ${sourceFrameCount}`;
      return `Linked · Repeat ${resolution.repeatInstance + 1} · ${sourceCopy}`;
    }
    case 'linked-generated':
      return `Linked generated · Repeat ${resolution.repeatInstance + 1} · ${sourceSpanCopy(resolution.loopId, resolution.leftSourceIndex, resolution.rightSourceIndex)}`;
    case 'linked-gap':
      return `Linked gap · Repeat ${resolution.repeatInstance + 1} · ${sourceSpanCopy(resolution.loopId, resolution.leftSourceIndex, resolution.rightSourceIndex)}`;
    case 'linked-unresolved': {
      const missingCount = resolution.missingSourceKeyIds.length;
      return `Linked loop unresolved · ${missingCount} source frame${missingCount === 1 ? '' : 's'} missing`;
    }
    case 'empty':
      return ROTO_CELL_STATE_TOOLTIP_COPY[existing];
    default: {
      const exhaustive: never = resolution;
      throw new Error(`Unhandled Roto frame resolution kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

/**
 * Secondary multi-selection tooltip copy (37-04; D-04; 37-UI-SPEC copywriting
 * contract). The current editing key keeps its `Real key` copy via the
 * `.current` treatment; every other selected real key shows `Selected key`,
 * composed with its semantic base when the base differs from 'real-key'
 * (e.g. `Selected key — cached`). Pure function over the shared vocabulary.
 */
export function getRotoCellSelectedTooltipCopy(base: RotoCellSemanticTooltipKind): string {
  if (base === 'real-key') return 'Selected key';
  return `Selected key — ${ROTO_CELL_STATE_TOOLTIP_COPY[base].toLowerCase()}`;
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

function getRotoCellBaseMeaning(cachedFrame: PhysicPaintRotoCacheFrame | null): RotoCellBaseMeaning {
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

function clampNonNegativeInteger(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.trunc(numeric));
}

// ---------------------------------------------------------------------------
// Single-key ripple Drag presentation helpers (Plan 36.14-07).
//
// Per D-22: the preview must render the complete resolver-proposed mapping —
// moved identity, every shifted real key, and re-derived generated cells —
// rather than a destination-only marker. Per D-21/D-23: occupied targets
// expose a transient before/after caret, while empty/generated destinations
// use whole-cell target treatment. Per D-24: selection and focus follow the
// moved identity at its proposed appFrame.
//
// These helpers are pure: they take a resolver proposal plus the current
// physical cells and produce cell-level presentation metadata. They never
// calculate edit semantics, destination frames, or ripple mappings.
// ---------------------------------------------------------------------------

/**
 * Role of a visible physical cell within an active Drag preview.
 * - `moved`: the dragged identity at its proposed final appFrame.
 * - `shifted`: a real key whose appFrame changed because of the ripple.
 * - `target`: the occupied target identity (preserved, not overwritten).
 * - `generated`: a strict-interior generated cell from the proposal.
 * - `vacated`: a cell emptied by the cut (no longer real or generated).
 * - `idle`: unchanged by this proposal.
 */
export type RotoDragCellRole =
  | 'moved'
  | 'shifted'
  | 'target'
  | 'generated'
  | 'vacated'
  | 'idle';

/**
 * Presentation view model for one visible cell during an active Drag preview.
 * The `role` drives CSS state; `targetBoundary` adds the before/after caret
 * direction for occupied targets; `ariaLabel`/`title` carry concise accessible
 * copy that agrees with the proposal metadata.
 */
export interface RotoDragCellPreviewViewModel {
  readonly appFrame: number;
  readonly kind: PhysicPaintRotoPhysicalCell['kind'];
  readonly keyId: string | null;
  readonly role: RotoDragCellRole;
  readonly targetBoundary: 'before' | 'after' | null;
  readonly ariaLabel: string;
  readonly title: string;
}

/**
 * Presentation view model for the active Drag preview, derived solely from
 * the retained resolver proposal. The view consumes `cellsByAppFrame` to
 * render each visible cell's final kind/keyId, `movedKeyId`/`targetKeyId` for
 * identity-based focus and caret placement, and `boundary` for concise
 * status copy.
 */
export interface RotoDragPreviewViewModel {
  readonly movedKeyId: string;
  readonly movedAppFrame: number;
  readonly targetKind: 'physical-cell' | 'before-key' | 'after-key';
  readonly targetKeyId: string | null;
  readonly targetAppFrame: number | null;
  /**
   * Pre-drag appFrame of the occupied target identity, used for concise
   * before/after status copy that references the frame the user is currently
   * pointing at (D-21). Falls back to the post-proposal appFrame when the
   * target is unchanged.
   */
  readonly targetPreDragAppFrame: number | null;
  readonly boundary: 'before' | 'after' | null;
  readonly cellsByAppFrame: ReadonlyMap<number, RotoDragCellPreviewViewModel>;
  readonly conciseStatus: string;
  readonly committing: boolean;
}

const DRAG_MOVED_LABEL_TEMPLATE = 'Moving Roto key to frame {frame}.';
const DRAG_MOVED_AFTER_OCCUPIED_LABEL_TEMPLATE = 'Insert Roto key after the key at frame {frame}.';
const DRAG_MOVED_BEFORE_OCCUPIED_LABEL_TEMPLATE = 'Insert Roto key before the key at frame {frame}.';
const DRAG_SHIFTED_LABEL_TEMPLATE = 'Ripple-shifted to frame {frame}.';
const DRAG_VACATED_LABEL_TEMPLATE = 'Vacated frame {frame}.';
const DRAG_GENERATED_LABEL_TEMPLATE = 'Generated frame {frame}.';

/**
 * Project the retained resolver proposal into a pure Drag preview view model.
 * The result is consumed by the workflow strip to render the complete proposed
 * physical cells, moved/shifted identities, occupied target caret, and concise
 * accessible status copy without re-deriving edit semantics.
 *
 * `committing` flags the pending state where the proposal is still visible
 * while the coordinator acknowledges the mutation; the caller sets it from
 * the strip's pointer-up lifecycle, not from the proposal itself.
 */
export function getRotoDragPreviewViewModel(
  proposal: PhysicPaintRotoPhysicalEditProposal,
  options: { committing?: boolean } = {},
): RotoDragPreviewViewModel {
  const drag = proposal.drag;
  if (!drag) {
    throw new Error('RotoDragPreviewViewModel requires a move-key proposal with drag metadata.');
  }
  const movedKeyId = drag.movedKeyId;
  // Complete moved identity set (37-04; D-06/D-22): group publications carry
  // drag.movedKeyIds; single-key proposals fall back to the grabbed identity.
  const movedSet = new Set(drag.movedKeyIds ?? [drag.movedKeyId]);
  const movedAppFrame = proposal.mapping.get(movedKeyId) ?? drag.resolvedInsertionAppFrame;
  const targetKind = drag.targetKind;
  const targetKeyId = drag.targetKeyId;
  const targetAppFrame = targetKeyId === null ? null : (proposal.mapping.get(targetKeyId) ?? null);

  const changesByKeyId = new Map<string, PhysicPaintRotoPhysicalIdentityChange>();
  for (const change of proposal.changes) {
    changesByKeyId.set(change.keyId, change);
  }
  // Pre-drag appFrame of the target identity (D-21). When the target shifted
  // because of the ripple, use its `beforeAppFrame`; otherwise fall back to
  // its post-proposal appFrame (unchanged target).
  const targetPreDragAppFrame = targetKeyId === null
    ? null
    : changesByKeyId.get(targetKeyId)?.beforeAppFrame ?? targetAppFrame;
  const boundary: 'before' | 'after' | null = targetKind === 'before-key' ? 'before' : targetKind === 'after-key' ? 'after' : null;

  const cellsByAppFrame = new Map<number, RotoDragCellPreviewViewModel>();
  for (const cell of proposal.cells) {
    const appFrame = cell.appFrame;
    let role: RotoDragCellRole = 'idle';
    let keyId: string | null = null;
    if (cell.kind === 'real') {
      keyId = cell.keyId;
      if (movedSet.has(cell.keyId)) {
        role = 'moved';
      } else if (targetKeyId !== null && cell.keyId === targetKeyId) {
        // Occupied target identity takes precedence over shifted (D-07/D-21).
        // The target may shift its appFrame because of the ripple, but it is
        // never overwritten, replaced, or swapped.
        role = 'target';
      } else if (changesByKeyId.has(cell.keyId)) {
        role = 'shifted';
      }
    } else if (cell.kind === 'generated') {
      role = 'generated';
    } else if (cell.kind === 'empty') {
      // A cell that was real/generated in the current state but is empty in
      // the proposal is vacated. The caller's current cells drive that
      // comparison; here we mark proposal-only empties as idle and let the
      // strip mark vacated cells by diffing against current cells.
      role = 'idle';
    }
    const targetBoundary = role === 'target' ? boundary : null;
    const label = buildDragCellLabel(role, appFrame, targetBoundary);
    cellsByAppFrame.set(appFrame, {
      appFrame,
      kind: cell.kind,
      keyId,
      role,
      targetBoundary,
      ariaLabel: label,
      title: label,
    });
  }

  const conciseStatus = buildDragConciseStatus(targetKind, movedAppFrame, targetPreDragAppFrame, boundary);
  return {
    movedKeyId,
    movedAppFrame,
    targetKind,
    targetKeyId,
    targetAppFrame,
    targetPreDragAppFrame,
    boundary,
    cellsByAppFrame,
    conciseStatus,
    committing: Boolean(options.committing),
  };
}

function buildDragConciseStatus(
  targetKind: 'physical-cell' | 'before-key' | 'after-key',
  movedAppFrame: number,
  targetPreDragAppFrame: number | null,
  boundary: 'before' | 'after' | null,
): string {
  if (targetKind === 'physical-cell') {
    return DRAG_MOVED_LABEL_TEMPLATE.replace('{frame}', String(movedAppFrame));
  }
  // Occupied before/after boundary text references the target identity's
  // current (pre-drag) frame so the copy matches the cell the user is
  // pointing at (D-21). Fall back to the moved appFrame if the target's
  // pre-drag frame is unavailable.
  const frame = targetPreDragAppFrame ?? movedAppFrame;
  if (boundary === 'before') {
    return DRAG_MOVED_BEFORE_OCCUPIED_LABEL_TEMPLATE.replace('{frame}', String(frame));
  }
  return DRAG_MOVED_AFTER_OCCUPIED_LABEL_TEMPLATE.replace('{frame}', String(frame));
}

function buildDragCellLabel(
  role: RotoDragCellRole,
  appFrame: number,
  targetBoundary: 'before' | 'after' | null,
): string {
  if (role === 'moved') {
    return DRAG_MOVED_LABEL_TEMPLATE.replace('{frame}', String(appFrame));
  }
  if (role === 'shifted') {
    return DRAG_SHIFTED_LABEL_TEMPLATE.replace('{frame}', String(appFrame));
  }
  if (role === 'vacated') {
    return DRAG_VACATED_LABEL_TEMPLATE.replace('{frame}', String(appFrame));
  }
  if (role === 'generated') {
    return DRAG_GENERATED_LABEL_TEMPLATE.replace('{frame}', String(appFrame));
  }
  if (role === 'target') {
    return targetBoundary === 'before'
      ? DRAG_MOVED_BEFORE_OCCUPIED_LABEL_TEMPLATE.replace('{frame}', String(appFrame))
      : DRAG_MOVED_AFTER_OCCUPIED_LABEL_TEMPLATE.replace('{frame}', String(appFrame));
  }
  return `Frame ${appFrame}`;
}

/**
 * Diff the current physical cells against the proposal to mark vacated cells.
 * A cell that was `real` or `generated` in the current state but is `empty` in
 * the proposal is vacated by the cut-and-insert ripple. Returns a set of
 * appFrames to mark as vacated in the strip's rendering.
 */
export function collectRotoDragVacatedAppFrames(
  currentCells: readonly PhysicPaintRotoPhysicalCell[],
  proposal: PhysicPaintRotoPhysicalEditProposal,
): Set<number> {
  const currentOccupied = new Set<number>();
  for (const cell of currentCells) {
    if (cell.kind === 'real' || cell.kind === 'generated') {
      currentOccupied.add(cell.appFrame);
    }
  }
  const proposalOccupied = new Set<number>();
  for (const cell of proposal.cells) {
    if (cell.kind === 'real' || cell.kind === 'generated') {
      proposalOccupied.add(cell.appFrame);
    }
  }
  const vacated = new Set<number>();
  for (const frame of currentOccupied) {
    if (!proposalOccupied.has(frame)) vacated.add(frame);
  }
  return vacated;
}