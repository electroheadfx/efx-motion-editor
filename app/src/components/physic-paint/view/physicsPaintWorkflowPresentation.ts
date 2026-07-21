import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type {
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
      if (cell.keyId === movedKeyId) {
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