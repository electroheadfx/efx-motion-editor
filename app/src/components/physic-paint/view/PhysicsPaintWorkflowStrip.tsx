import { AlignHorizontalSpaceAround, BetweenVerticalStart, Blend, ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, ClipboardCopy, ClipboardPaste, CopyPlus, Info, ListChecks, MoveHorizontal, Play, Plus, RotateCcw, Scissors, Square, SquareSplitHorizontal, ToolCase, Trash2, Volume2, VolumeX, X } from 'lucide-preact';

import type { ComponentChildren, RefObject } from 'preact';
import { createPortal, memo } from 'preact/compat';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useSignal, type Signal } from '@preact/signals';
import type { RotoCachedPlaybackTick } from '../hooks/useRotoCachedPlayback';
import { PhysicsPaintStyledTooltip, useStyledTooltip } from './PhysicsPaintStyledTooltip';
import {
  collectRotoDragVacatedAppFrames,
  collectRotoGroupDragGapPreviewAppFrames,
  getRotoAcceptedCellFillClass,
  getRotoCellFill, getRotoCellPresentationViewModel, getRotoCellViewModel,
  getRotoCellSelectedTooltipCopy,
  getRotoCellStateTooltipCopy,
  getRotoDragPreviewViewModel,
  getRotoResolutionCellTooltipCopy,
  getRotoResolutionCellTooltipKind,
  getRotoStatusCapsuleIdleContext,
  getRotoStatusCapsuleViewModel,
  type PhysicsPaintOnionState,
  type RotoCellSemanticTooltipKind,
  type RotoCellViewModel, type RotoMissingFrameStatusKind,
  type RotoDragPreviewViewModel,
} from './physicsPaintWorkflowPresentation';
import { PHYSIC_PAINT_MAX_APPLY_FRAMES } from '../../../types/physicPaint';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { RotoKeyUtilityActionState } from '../roto/physicsPaintRotoKeyController';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';
import type {
  PhysicPaintRotoInterpolationState,
  PhysicPaintRotoLoopClip,
  PhysicPaintRotoPhysicalDocument,
  PhysicPaintRotoRealKeyRecord,
} from '../roto/physicsPaintRotoPhysicalModel';
import {
  classifyPhysicPaintRotoGroupFrameTarget,
  type PhysicPaintRotoGroupFrameTarget,
} from '../roto/physicsPaintRotoGroupLifecycle';
import {
  clampPhysicPaintPushDestination,
  derivePhysicPaintPushSet,
  resolvePhysicPaintRotoGroupEffectiveEnd,
  type PhysicPaintRotoGroupDragClampInput,
  type PhysicPaintRotoKeyRailDragClampInput,
  type PhysicPaintRotoLoopResolutionContext,
} from '../roto/physicsPaintRotoPhysicalResolver';
import {
  getRotoFrameKeyInteraction,
  buildRotoSpacingProxySourceIndex,
  resolveRotoVisibleFrameResolutions,
  resolveRotoVisibleSpacingProxies,
} from '../roto/rotoTimelineSelectors';
import type {
  PhysicsPaintRotoSpacingProxy,
  PhysicsPaintRotoSpacingSelection,
  PhysicsPaintRotoSpacingSelectionGesture,
} from '../roto/physicsPaintRotoSpacingSelection';
import type { RotoPhysicalTimelineCell } from '../roto/rotoPhysicalTimelinePorts';
import { PhysicsPaintLoopClipRail } from './PhysicsPaintLoopClipRail';
import { PhysicsPaintKeyRail } from './PhysicsPaintKeyRail';
import {
  disarmPushTool,
  isPushToolArmed,
  togglePushTool,
} from './physicsPaintPushArmedTool';
import { deriveKeyRailSegments, type KeyRailSegment } from './physicsPaintKeyRailPresentation';
import { shouldRestoreOrphanedKeyRailFocus } from './physicsPaintKeyRailFocus';
import type { GroupRailDragPreviewState } from '../hooks/usePhysicsPaintGroupRailDrag';
import type { KeyRailDragPreviewState } from '../hooks/usePhysicsPaintKeyRailDrag';
import {
  usePhysicsPaintPushDrag,
  type PushDragGhostState,
  type PushDragSessionApi,
  type PushToolDirection,
} from '../hooks/usePhysicsPaintPushDrag';
import {
  projectPhysicsPaintGroupProductReason,
  type PhysicsPaintLoopClipPresentation,
} from './physicsPaintLoopClipPresentation';
import type {
  RotoDragPublication,
  RotoDragPreparationResult,
  RotoDragTarget,
  RotoDragTargetSignature,
  RotoKeyRailDragPublication,
  RotoKeyRailSelection,
  RotoPhysicalTimelineActionBundle,
  RotoPushIntentDescriptor,
  RotoPushPublication,
} from '../hooks/useRotoTimelineActions';
import { mapRotoPushProductReason } from '../hooks/useRotoTimelineActions';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';

const GENERATED_ROTO_TITLE_TEMPLATE = 'Generated frame {frame} — render-only.';
const GENERATED_ROTO_DISABLED_STATUS_TEMPLATE = 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.';
const INTERPOLATION_ENABLED_STATUS = 'Generated in-betweens on — render-only frames refresh from real keys.';
const INTERPOLATION_DISABLED_STATUS = 'Generated in-betweens off — real Roto keys only.';
const ROTO_KEY_BUSY_STATUS_TEMPLATE = 'Finish the current key action before using key tools.';
/**
 * Internal zero-delta drop sentinel (43.5-05, D-15): a release that returned
 * to the origin publishes NOTHING — the onRejected port filters it silently.
 * Never surfaced as product copy; the resolver's mapped no-space copy owns the
 * real rejection strings.
 */
const PUSH_DROP_NOOP = 'push-drop-noop';
/**
 * Presentation-only structural view of a push-set Rail (43.5-05 Task 2). The
 * resolver's PushRail interface is intentionally not exported; the strip needs
 * only the geometry + kind facts for hover/ghost paint, so this structural type
 * is assignment-compatible with the resolver's movedRails (D-17 — the set
 * membership still derives from the shared pure derivation, never re-derived
 * here).
 */
interface PushPreviewRail {
  readonly kind: 'key-rail' | 'group';
  readonly id: string;
  readonly intervalStart: number;
  readonly intervalEndExclusive: number;
  readonly clip?: PhysicPaintRotoLoopClip;
}

/** Inactive ghost fallback (mirrors the hook's frozen sentinel). */
const PUSH_GHOST_INACTIVE: PushDragGhostState = Object.freeze({
  active: false,
  deltaFrames: 0,
  blockedEdge: null,
});

/** Empty gap-preview set shared by every non-drag render. */
const EMPTY_PUSH_GAP_PREVIEW_FRAMES: ReadonlySet<number> = new Set<number>();
type RotoKeyUtilityAction = 'insert' | 'duplicate' | 'copy' | 'paste' | 'delete';
export interface PhysicsPaintWorkflowRotoKeyState {
  actionAvailability: RotoKeyUtilityActionState;
  hasCopiedRotoKey: boolean;
}

export type PhysicsPaintWorkflowRotoScriptState = Pick<RotoScriptClipboardController,
  | 'availability'
  | 'hasCopiedScript'
  | 'copiedAppFrame'
  | 'copiedStrokeCount'
  | 'applying'
  | 'applyProgress'
  | 'status'
  | 'error'
>;

export interface PhysicsPaintWorkflowStripFrameMarker {
  frame: number;
  saved?: boolean;
  label?: string;
  source?: 'real-key' | 'generated-interpolation';
}

export interface PhysicsPaintWorkflowOnionPreviewFrame {
  frame: number;
  dataUrl: string;
  direction: 'previous' | 'next';
  distance: number;
  source: 'roto';
  kind?: 'stroke-preview' | 'cached-composite';
}

export interface PhysicsPaintWorkflowStripProps {
  workflowLabel?: string;
  currentFrame: number;
  isPlaying: boolean;
  ready?: boolean;
  occupiedRotoFrames?: number[];
  savedRotoFrames?: PhysicsPaintWorkflowStripFrameMarker[];
  cachedRotoFrames?: PhysicPaintRotoCacheFrame[];
  rotoInterpolationEnabled?: boolean;
  rotoInterpolationMode?: PhysicPaintRotoInterpolationState['mode'];
  rotoInterpolationPending?: boolean;
  statusMessage?: string | null;
  rotoMissingFrameStatusKind?: RotoMissingFrameStatusKind | null;
  onion: PhysicsPaintOnionState;
  onionPreviewFrames?: PhysicsPaintWorkflowOnionPreviewFrame[];
  showOnionHiddenDuringPreview?: boolean;
  rotoCachedPlaybackAvailable?: boolean;
  rotoCachedPlaybackStatus?: string | null;
  rotoCachedPlaybackLoop?: boolean;
  rotoCachedPlaybackFps?: number;
  projectFps?: number;
  onToggleRotoPlayback?: () => void;
  onRotoPlaybackLoopChange?: (loop: boolean) => void;
  onRotoPlaybackFpsChange?: (fps: number) => void;
  /**
   * 41-04 (D-12..D-14): session-local Audio Preview toggle. State defaults On
   * per session (never persisted); the intent routes through the monitor's
   * single control funnel for immediate mid-playback effect.
   */
  audioPreviewEnabled?: boolean;
  onAudioPreviewToggle?: () => void;
  isRotoCachedPlaybackActive?: boolean;
  /**
   * 38.1-D-01 per-tick playback surface, passed through as a signal reference.
   * Read ONLY by the nav-pill current-frame output child during active
   * playback — never .value-read in the strip body (that would subscribe all
   * ~120 cells per tick).
   */
  rotoCachedPlaybackTick?: Signal<RotoCachedPlaybackTick | null> | null;
  onRotoInterpolationEnabledChange?: (enabled: boolean) => void;
  onRotoInterpolationModeChange?: (mode: PhysicPaintRotoInterpolationState['mode']) => void;
  /** + Key header action: promote the current frame to an empty real key. */
  onAddRotoKey?: () => void;
  onDuplicateRotoKey?: () => void;
  onInsertRotoFrame?: () => void;
  onDeleteRotoFrame?: () => void;
  /** Stable physical timeline action bundle (D-05/D-06/D-09). */
  rotoPhysicalActions?: RotoPhysicalTimelineActionBundle;
  /** Controller-owned multi-selection set (37-02 signal). The strip never mutates or reorders it (D-05). */
  rotoSelectedKeyIds?: readonly string[];
  /** Nullable primary real-key identity; absent after replacement-style Select All. */
  rotoPrimarySelectedKeyId?: string | null;
  /** Session-only exact source-position selection shared across equivalent Loop Clip occurrences. */
  rotoSpacingSelection?: PhysicsPaintRotoSpacingSelection | null;
  /** Plain/toggle/range selection intent for one exact Loop Clip source position. */
  onSelectRotoSpacingProxy?: (proxy: PhysicsPaintRotoSpacingProxy, gesture: PhysicsPaintRotoSpacingSelectionGesture) => void;
  /** Ordinary real-key selection clears the disjoint spacing-proxy selection. */
  onClearRotoSpacingSelection?: () => void;
  /** Empty-frame navigation clears active ordinary key selection. */
  onClearRotoKeySelection?: () => void;
  /** Cmd/Ctrl-click toggle intent on a real-key cell (D-01). Never navigates. */
  onToggleRotoKeySelection?: (keyId: string) => void;
  /** Plain-click collapse intent: reduce the multi-selection to the clicked key (D-02). */
  onCollapseRotoSelectionToKey?: (keyId: string) => void;
  /**
   * Release-time group-drag reject publication (D-07/D-09, 37-03 contract):
   * fires exactly once when a group session is released on a resolver-level
   * invalid target — concise capsule copy plus the full resolver detail.
   */
  onRotoGroupDragRejected?: (reason: string, detail: string) => void;
  /** Shift-click range-selection intent on a real-key cell (D-01). Never navigates. */
  onExtendRotoKeySelection?: (keyId: string) => void;
  /** Select All guarded icon route (D-03) — shares the Studio callback with Cmd/Ctrl+A. */
  onSelectAllRotoKeys?: () => void;
  onCopyRotoFrame?: () => void;
  onCutRotoFrame?: () => void;
  onScissorKeyRail?: () => void;
  onPasteRotoFrame?: () => void;
  /** Physical real-key records for identity-based Drag targeting (D-01/D-07). */
  rotoKeyRecords?: readonly PhysicPaintRotoRealKeyRecord[];
  /** Accepted lifecycle Groups used to distinguish owned deletion gaps from unrelated empty cells. */
  rotoLoopClips?: readonly PhysicPaintRotoLoopClip[];
  /** Accepted stable real-key owners of incoming interpolation breaks. */
  rotoIncomingInterpolationBreakKeyIds?: readonly string[];
  /** Complete bounded `0 .. capacity - 1` physical projection and horizontal extent authority. */
  rotoPhysicalCells: readonly RotoPhysicalTimelineCell[];
  /**
   * Phase 43: prepared loop resolution context (one compact interval record
   * per Loop Clip). When present, the strip resolves the lazy per-frame
   * contract for its VISIBLE window only (D-32); linked occurrences keep
   * their existing cell-state semantics and are never key-selectable or
   * draggable (D-18/D-23). Absent means no loops — behavior is byte-identical
   * to the pre-43 strip.
   */
  rotoLoopResolutionContext?: PhysicPaintRotoLoopResolutionContext | null;
  /** Accepted product facts keyed by the same canonical Loop Clip identity. */
  rotoLoopPresentations?: ReadonlyMap<string, PhysicsPaintLoopClipPresentation>;
  /** Selected Group Rails in canonical placement order. */
  selectedRotoLoopClipIds?: readonly string[];
  /** Passive Groups linked to the active Action; never operation scope. */
  linkedRotoLoopClipIds?: readonly string[];
  /** Product name used only by passive linked-rail accessibility copy. */
  linkedRotoActionName?: string | null;
  /** Rail selection intent; null clears rail mode before physical selection. */
  onSelectRotoLoopClip?: (
    loopId: string | null,
    gesture?: PhysicsPaintRotoSpacingSelectionGesture,
  ) => void;
  /** Session-only exact Key Rail identity; never persisted or bridged. */
  selectedRotoKeyRail?: RotoKeyRailSelection | null;
  /** Plain-only Key Rail selection intent. */
  onSelectRotoKeyRail?: (selection: RotoKeyRailSelection) => void;
  /** Key Rail rejection copy publisher for the shared status capsule. */
  onRotoKeyRailDragRejected?: (reason?: string, detail?: string) => void;
  /** 43.5-05: Push rejection copy publisher (status channel). Fires on a
   *  release-time resolver rejection; zero-delta no-op drops are filtered
   *  inside the strip (D-15) and never reach this channel. */
  onRotoPushDragRejected?: (reason?: string, detail?: string) => void;
  /** Accepted parent boundary used by the canonical Key Rail clamp. */
  rotoParentEndExclusive?: number;
  /** Existing Studio-local Loop Edit controller port (D-37/D-39). */
  onOpenRotoLoopEdit?: (loopId: string) => Promise<unknown>;
  rotoDragContextKey?: string;
  hasCopiedRotoKey?: boolean;
  keyActionInFlight?: boolean;
  mutationLocked?: boolean;
  rotoKeyState?: PhysicsPaintWorkflowRotoKeyState;
  rotoScript?: PhysicsPaintWorkflowRotoScriptState;
  /** Header Close affordance — Studio routes through the guarded close-flush path. */
  onClose?: () => void;
  onNavigateToSyncedFrame: (frame: number) => void;
  onGoToFirstFrame: () => void;
  onGoToPreviousFrame: () => void;
  onGoToNextFrame: () => void;
  onGoToLastFrame: () => void;
  onOnionChange: (onion: PhysicsPaintOnionState) => void;
}

const RULER_STEP = 3;
const ROTO_CELL_WIDTH_PX = 18;
const EMPTY_LOOP_PRESENTATIONS: ReadonlyMap<string, PhysicsPaintLoopClipPresentation> = new Map();
const EMPTY_SPACING_PROXIES: ReadonlyMap<number, PhysicsPaintRotoSpacingProxy> = new Map();
const EMPTY_CACHED_ROTO_FRAMES: readonly PhysicPaintRotoCacheFrame[] = [];
const EMPTY_STRING_IDS: readonly string[] = [];
const NOOP_KEY_RAIL_SELECTION = (_selection: RotoKeyRailSelection): void => {};

function buildRulerTicks(frameCells: number[]): number[] {
  return frameCells.filter((frame) => frame % RULER_STEP === 0);
}

interface RotoTimelineStructuralIndex {
  readonly frameCells: number[];
  readonly physicalCellByAppFrame: ReadonlyMap<number, RotoPhysicalTimelineCell>;
  readonly generatedRotoFrames: readonly number[];
  readonly cachedFrameByAppFrame: ReadonlyMap<number, PhysicPaintRotoCacheFrame>;
  readonly realCachedFrameSet: ReadonlySet<number>;
  readonly lifecycleTargetByAppFrame: ReadonlyMap<number, PhysicPaintRotoGroupFrameTarget>;
}

/**
 * The strip's sole physical extent boundary. A projection is safe to render
 * only when every array position names that same physical frame; otherwise a
 * partial, duplicate, or reordered input could silently create a second extent.
 */
export function buildRotoTimelineStructuralIndex(
  physicalCells: readonly RotoPhysicalTimelineCell[],
  cachedFrames: readonly PhysicPaintRotoCacheFrame[],
  acceptedGroupDocument: Pick<PhysicPaintRotoPhysicalDocument, 'realKeyRecords' | 'loopClips'>,
  classifyTarget: typeof classifyPhysicPaintRotoGroupFrameTarget = classifyPhysicPaintRotoGroupFrameTarget,
): RotoTimelineStructuralIndex {
  if (physicalCells.length === 0 || physicalCells.length > PHYSIC_PAINT_MAX_APPLY_FRAMES) {
    throw new Error(`Invalid Roto physical projection length: expected 1 to ${PHYSIC_PAINT_MAX_APPLY_FRAMES} cells.`);
  }
  const frameCells: number[] = [];
  const physicalCellByAppFrame = new Map<number, RotoPhysicalTimelineCell>();
  const generatedRotoFrames: number[] = [];
  const cachedFrameByAppFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  const realCachedFrameSet = new Set<number>();
  for (const cachedFrame of cachedFrames) {
    const existing = cachedFrameByAppFrame.get(cachedFrame.appFrame);
    if (!existing || (existing.source !== 'real-key' && cachedFrame.source === 'real-key')) {
      cachedFrameByAppFrame.set(cachedFrame.appFrame, cachedFrame);
    }
    if (cachedFrame.source === 'real-key') realCachedFrameSet.add(cachedFrame.appFrame);
  }

  const lifecycleTargetByAppFrame = new Map<number, PhysicPaintRotoGroupFrameTarget>();
  for (let appFrame = 0; appFrame < physicalCells.length; appFrame += 1) {
    const cell = physicalCells[appFrame];
    if (!cell || cell.appFrame !== appFrame) {
      throw new Error(`Invalid Roto physical projection at index ${appFrame}: expected appFrame ${appFrame}.`);
    }
    frameCells.push(appFrame);
    physicalCellByAppFrame.set(appFrame, cell);
    if (cell.kind === 'generated') {
      generatedRotoFrames.push(appFrame);
      if (!cachedFrameByAppFrame.has(appFrame)) {
        cachedFrameByAppFrame.set(appFrame, {
          frameIndex: 0,
          appFrame,
          dataUrl: 'data:image/png;base64,',
          source: 'generated-interpolation',
        });
      }
    }
    lifecycleTargetByAppFrame.set(appFrame, classifyTarget({
      document: acceptedGroupDocument,
      appFrame,
    }));
  }
  return { frameCells, physicalCellByAppFrame, generatedRotoFrames, cachedFrameByAppFrame, realCachedFrameSet, lifecycleTargetByAppFrame };
}



function isSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[] | undefined, frame: number): boolean {
  return Boolean(markers?.some(marker => marker.frame === frame && marker.saved !== false && marker.source !== 'generated-interpolation'));
}

/**
 * Shared guarded-action tooltip copy (36.15-08, UAT Gap D). The tooltip shows
 * only the description or 'unavailable: {verbatim controller reason}' — the
 * Plan 01 '{Action} — ' tool-name prefix is dropped because every bottom-row
 * action now carries a short visible label next to its icon.
 */
function buildGuardedActionTooltipCopy(description: string, disabledReason: string | null): string {
  return disabledReason ? `unavailable: ${disabledReason}` : description;
}

type RotoDragCandidateKind = 'empty' | 'real-key' | 'generated' | 'outside' | 'locked';
interface RotoDragPreviewState {
  movedKeyId: string;
  sourceAppFrame: number;
  publication: RotoDragPublication | null;
  candidateKind: RotoDragCandidateKind;
  candidateValid: boolean;
  error: string | null;
  pending: boolean;
  /** True when the gesture session is a group drag (selection >= 2 containing the grabbed key). */
  groupDrag: boolean;
  /** Resolver-supplied blocked destination frames for the blocked-target preview (D-08); null otherwise. */
  conflictingAppFrames: readonly number[] | null;
}

interface RotoDragGestureSession {
  pointerId: number;
  movedKeyId: string;
  sourceAppFrame: number;
  sourceElement: HTMLButtonElement;
  originX: number;
  originY: number;
  latestX: number;
  latestY: number;
  started: boolean;
  groupDrag: boolean;
  candidateTarget: RotoDragTarget | null;
  candidateKind: RotoDragCandidateKind;
  candidateValid: boolean;
  candidateError: string | null;
  /** Group-preparation failure detail retained for release-time publication (D-07/D-09); null on single-key paths. */
  candidateConflicts: readonly number[] | null;
  candidateDetail: string | null;
  publication: RotoDragPublication | null;
  rafId: number | null;
  lastRafTime: number | null;
  validityKey: string;
  cleanup: () => void;
}

const ROTO_DRAG_THRESHOLD_PX = 6;
const ROTO_EDGE_SCROLL_ZONE_PX = 32;
const ROTO_EDGE_SCROLL_MIN_PX_PER_SECOND = 40;
const ROTO_EDGE_SCROLL_MAX_PX_PER_SECOND = 160;

/**
 * Identity-based target signature equality (D-09). Two targets are equal when
 * their kind, resolved appFrame (for physical-cell), and targetKeyId (for
 * before-key/after-key) all match. The strip uses this to require that the
 * pointer-up release target matches the retained publication's target
 * signature before committing — preventing stale or sliding-target commits.
 */
function targetSignaturesEqual(
  target: RotoDragTarget,
  signature: RotoDragTargetSignature,
): boolean {
  if (target.kind !== signature.kind) return false;
  if (target.kind === 'physical-cell') {
    if (signature.kind !== 'physical-cell') return false;
    return (target.appFrame ?? null) === (signature.appFrame ?? null);
  }
  // before-key / after-key
  if (signature.kind === 'physical-cell') return false;
  return (target.targetKeyId ?? null) === (signature.targetKeyId ?? null);
}

/**
 * Locate a mounted Roto key cell by its opaque bounded key identity (CR-04).
 * Key IDs are opaque resolver strings; interpolating them into a CSS
 * attribute selector can throw for valid CSS-string edge cases, so the lookup
 * compares `dataset.rotoKeyId` directly instead of building a selector.
 */
function findRotoKeyCellByKeyId(scroller: HTMLElement, keyId: string): HTMLElement | null {
  for (const cell of scroller.querySelectorAll<HTMLElement>('[data-roto-key-id]')) {
    if (cell.dataset.rotoKeyId === keyId) return cell;
  }
  return null;
}

function getRotoDragFeedback(preview: RotoDragPreviewState | null): string | null {
  if (!preview) return null;
  if (preview.pending) {
    return preview.publication
      ? getRotoDragPreviewViewModel(preview.publication.proposal, { committing: true }).conciseStatus
      : 'Committing Roto key move...';
  }
  if (!preview.candidateValid || !preview.publication) return preview.error;
  return getRotoDragPreviewViewModel(preview.publication.proposal).conciseStatus;
}

/**
 * 38.1-D-01 live surface 2: the minimal current-frame indicator — the EXISTING
 * nav-pill element `<output class="physics-paint-current-frame">` (Open
 * Question 1 RESOLVED: element, class, and placement pinned, unchanged).
 * During active cached playback it reads the per-tick playback appFrame signal
 * (only this child re-renders per tick); otherwise it shows props.currentFrame
 * exactly as before. The signal is never read when playback is inactive, so an
 * idle strip holds zero per-tick subscriptions.
 */
function RotoPlaybackCurrentFrameOutput(props: { currentFrame: Signal<number>; playbackActive: boolean; playbackTick: Signal<RotoCachedPlaybackTick | null> | null | undefined }) {
  const playbackAppFrame = props.playbackActive ? props.playbackTick?.value?.appFrame ?? null : null;
  return <output class="physics-paint-current-frame">{playbackAppFrame ?? props.currentFrame.value}</output>;
}

function PhysicsPaintWorkflowLiveStatus(props: { capsuleText: Signal<string> }) {
  const tooltip = useStyledTooltip();
  const capsuleText = props.capsuleText.value;
  return (
    <div
      class="physics-paint-status-capsule"
      role="status"
      aria-live="polite"
      onPointerEnter={tooltip.onPointerEnter}
      onPointerLeave={tooltip.onPointerLeave}
    >
      <Info size={16} aria-hidden="true" />
      <span class="physics-paint-status-capsule-text">{capsuleText}</span>
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="top">{capsuleText}</PhysicsPaintStyledTooltip>
    </div>
  );
}

interface PhysicsPaintWorkflowStaticChromeProps {
  currentFrame: Signal<number>;
  capsuleText: Signal<string>;
  ready: boolean;
  playbackAvailable: boolean;
  playbackActive: boolean;
  playbackTick: Signal<RotoCachedPlaybackTick | null> | null | undefined;
  playbackLoop: boolean;
  playbackFps: number;
  projectFps: number;
  interpolationEnabled: boolean;
  interpolationMode: PhysicPaintRotoInterpolationState['mode'];
  interpolationPending: boolean;
  interpolationControlsDisabled: boolean;
  interpolationStatus: string;
  onTogglePlayback?: () => void;
  onPlaybackLoopChange?: (loop: boolean) => void;
  onPlaybackFpsChange?: (fps: number) => void;
  /** 41-04 (D-12/D-13): session-local Audio Preview toggle state + intent. */
  audioPreviewEnabled?: boolean;
  onAudioPreviewToggle?: () => void;
  onInterpolationEnabledChange?: (enabled: boolean) => void;
  onInterpolationModeChange?: (mode: PhysicPaintRotoInterpolationState['mode']) => void;
  onGoToFirstFrame: () => void;
  onGoToPreviousFrame: () => void;
  onGoToNextFrame: () => void;
  onGoToLastFrame: () => void;
  onClose?: () => void;
  mutationLocked: boolean;
  /** 43.5-02 Task 2: relocated Key Spacing form ports (bottom-row verbatim).
   *  The form renders inside the toolbox popover's second section with the
   *  exact guards/pending/disabled idioms; state authority stays in the
   *  timeline — the static chrome never mirrors interpolation or spacing. */
  forceSpacingInput: string;
  forceSpacingControlsPresent: boolean;
  canApplyForceSpacing: boolean;
  forceSpacingActionDisabledReason: string | null;
  onForceSpacingInput?: (event: Event) => void;
  onForceSpacingSubmit?: (event: Event) => void;
}

/**
 * 43.5-02 smoke fix 1 (BLOCKER): a surface whose subtree must never trigger
 * popover dismissal. Structural type (contains method) so plain node-testable
 * objects can stand in for live DOM elements.
 */
export interface ToolboxPopoverDismissSurface {
  contains(target: EventTarget | null): boolean;
}

/**
 * True when `target` sits outside the document tree — a native WKWebView select
 * popup artifact: the OS-drawn listbox delivers pointerdown targets that are no
 * longer attached to the document. Such a target can never be proved inside a
 * popover surface, so dismissing on it would swallow the selection apply.
 */
export function defaultIsDetachedTarget(target: EventTarget | null): boolean {
  return typeof Node !== 'undefined'
    && target instanceof Node
    && typeof document !== 'undefined'
    && !document.contains(target);
}

/**
 * Classifies an outside-pointerdown dismissal (43.5-02 smoke fix 1). The popover
 * is portaled to document.body, so `anchor.contains` alone cannot prove an
 * interior hit — the panel and every surface portaled out of it (e.g. the native
 * select's detached popup) must be listed as surfaces too. Dismisses only when
 * the target is provably outside every registered surface; a detached target
 * never dismisses (its containment cannot be proved).
 */
export function shouldDismissToolboxPopover(
  target: EventTarget | null,
  surfaces: readonly (ToolboxPopoverDismissSurface | null)[],
  isDetached: (target: EventTarget | null) => boolean = defaultIsDetachedTarget,
): boolean {
  if (target === null) return true;
  if (isDetached(target)) return false;
  return !surfaces.some((surface) => surface !== null && surface.contains(target));
}

export interface ToolboxPopoverPlacement {
  left: number;
  top: number;
}

/**
 * Pure viewport placement for the toolbox popover (43.5-02 smoke fix 2): the
 * panel right-aligns to the anchor button's right edge and extends LEFT over the
 * strip, clamped 8px inside the strip's horizontal bounds so it never covers the
 * Actions sidebar lane (Studio grid column 3). The bottom edge sits
 * `gapAboveStrip` (4px) above the strip top.
 */
export function computeToolboxPopoverPlacement(options: {
  anchorRect: DOMRect;
  stripRect: DOMRect;
  panelSize: { width: number; height: number };
  gapAboveStrip?: number;
  viewportMargin?: number;
}): ToolboxPopoverPlacement {
  const margin = options.viewportMargin ?? 8;
  const gap = options.gapAboveStrip ?? 4;
  const minLeft = Math.max(margin, options.stripRect.left + margin);
  const maxRight = Math.max(
    minLeft + options.panelSize.width,
    options.stripRect.right - margin,
  );
  const left = Math.max(
    minLeft,
    Math.min(
      options.anchorRect.right - options.panelSize.width,
      maxRight - options.panelSize.width,
    ),
  );
  const top = Math.max(margin, options.stripRect.top - gap - options.panelSize.height);
  return { left, top };
}

/**
 * 43.5-02 (D-01/D-05): the ToolCase toolbox popover — a Studio-local, non-modal
 * dialog portaled to document.body so the shared horizontal scroller can never
 * clip it (RESEARCH Open Question 3). Renders entirely above the workflow strip
 * with its bottom edge 4px above the strip top, right edge aligned to the anchor
 * button's right edge and clamped 8px inside the strip so it never covers the
 * Actions sidebar lane (43.5-02 smoke fix 2). The owning chrome passes its own
 * panel ref so dismissal classification can prove interior hits through the
 * portal (43.5-02 smoke fix 1). No focus trap, no backdrop, no automatic focus
 * move; dismissal is handled by the owning chrome (outside pointerdown / Escape
 * window capture listeners) so the dispatcher keeps its layering guarantee. Must
 * stay transform/filter-free: the relocated interpolation tooltip is
 * position:fixed and must keep the viewport as its containing block.
 */
function PhysicsPaintToolboxPopover(props: {
  anchorRef: RefObject<HTMLSpanElement>;
  panelRef: RefObject<HTMLDivElement>;
  open: boolean;
  ariaLabel: string;
  children: ComponentChildren;
}) {
  useLayoutEffect(() => {
    const panel = props.panelRef.current;
    const anchor = props.anchorRef.current;
    if (!props.open || !panel || !anchor) return;
    const panelSize = { width: panel.offsetWidth, height: panel.offsetHeight };
    const anchorRect = anchor.getBoundingClientRect();
    const strip = anchor.closest('.physics-paint-workflow-strip');
    const stripRect = strip ? strip.getBoundingClientRect() : anchorRect;
    const placement = computeToolboxPopoverPlacement({ anchorRect, stripRect, panelSize });
    panel.style.left = `${placement.left}px`;
    panel.style.top = `${placement.top}px`;
    panel.style.visibility = 'visible';
  });

  if (!props.open) return null;
  const panel = (
    <div
      ref={props.panelRef}
      id="physics-paint-toolbox-popover"
      class="physics-paint-toolbox-popover"
      role="dialog"
      aria-modal="false"
      aria-label={props.ariaLabel}
      style={{ visibility: 'hidden' }}
    >
      {props.children}
    </div>
  );
  if (typeof document !== 'undefined') return createPortal(panel, document.body);
  return panel;
}

function PhysicsPaintWorkflowStaticChromeImpl(props: PhysicsPaintWorkflowStaticChromeProps) {
  recordPhysicsPaintPerformanceCounter('render.workflowStaticChrome');
  const closeTooltip = useStyledTooltip();
  const interpolationTooltip = useStyledTooltip();
  const audioPreviewTooltip = useStyledTooltip();
  const toolboxTooltip = useStyledTooltip();
  // 43.5-02 Task 2: the relocated Key Spacing form owns its tooltip here,
  // beside the other popover-internal tooltips.
  const forceSpacingTooltip = useStyledTooltip();
  // 43.5-02 (D-01/D-02): toolbox popover toggle + self-contained dismissal.
  // Outside pointerdown and Escape dismiss it via window capture-phase listeners
  // registered ONLY while open; no focus trap, no backdrop, no automatic focus
  // move. The Escape listener calls stopImmediatePropagation so popover dismissal
  // wins over the Studio bubble-phase dispatcher's collapseRotoSelection
  // (Pitfall 2: one Escape handles at most one layer).
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const toolboxAnchorRef = useRef<HTMLSpanElement | null>(null);
  // 43.5-02 smoke fix 1: the owning chrome keeps the portaled panel ref so the
  // outside-pointerdown classifier can prove interior hits through the portal.
  const toolboxPanelRef = useRef<HTMLDivElement>(null);
  // 43.5-02 smoke fix 4: opening/closing the popover suppresses the relocated
  // interpolation tooltip — a tooltip left visible across the open transition
  // would measure the panel at its unpositioned end-of-body location (bottom-left
  // of the window) and float disconnected from any hovered control.
  const closeToolboxPopover = useCallback(() => {
    interpolationTooltip.hide();
    setToolboxOpen(false);
  }, []);
  useEffect(() => {
    if (!toolboxOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      // 43.5-02 smoke fix 1 (BLOCKER): the popover is portaled to document.body
      // and the native select popup is detached from it, so a lone
      // anchor.contains check dismisses on interior/portaled hits. Every surface
      // that must never dismiss (anchor wrapper, panel, portaled listbox
      // surfaces) is registered and a detached target is treated as unprovable.
      if (shouldDismissToolboxPopover(
        event.target,
        [toolboxAnchorRef.current, toolboxPanelRef.current],
      )) closeToolboxPopover();
    };
    const onEscapeKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopImmediatePropagation();
      closeToolboxPopover();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onEscapeKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onEscapeKeyDown, true);
    };
  }, [toolboxOpen]);
  function handleRotoPlaybackFpsInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value)) props.onPlaybackFpsChange?.(value);
  }
  function handleInterpolationModeChange(event: Event) {
    const mode = (event.currentTarget as HTMLSelectElement).value;
    if (mode !== 'duplicate' && mode !== 'blend') return;
    props.onInterpolationModeChange?.(mode);
  }
  return (
    <div class="physics-paint-workflow-header">
      <div class="physics-paint-pill physics-paint-pill--navigation physics-paint-roto-navigation-controls" role="group" aria-label="Roto frame navigation">
        <button type="button" class="physics-paint-nav-button" aria-label="Go to first frame" onClick={props.onGoToFirstFrame}><ChevronFirst size={15} /></button>
        <button type="button" class="physics-paint-nav-button" aria-label="Go to previous frame" onClick={props.onGoToPreviousFrame}><ChevronsLeft size={15} /></button>
        <button type="button" class={`physics-paint-nav-button physics-paint-roto-transport ${props.playbackActive ? 'active' : ''}`} aria-label={props.playbackActive ? 'Stop cached Roto playback' : 'Play cached Roto frames'} disabled={!props.ready || !props.playbackAvailable || !props.onTogglePlayback} onClick={props.onTogglePlayback}>{props.playbackActive ? <Square size={15} /> : <Play size={15} />}</button>
        <RotoPlaybackCurrentFrameOutput currentFrame={props.currentFrame} playbackActive={props.playbackActive} playbackTick={props.playbackTick} />
        <button type="button" class="physics-paint-nav-button" aria-label="Go to next frame" onClick={props.onGoToNextFrame}><ChevronsRight size={15} /></button>
        <button type="button" class="physics-paint-nav-button" aria-label="Go to last frame" onClick={props.onGoToLastFrame}><ChevronLast size={15} /></button>
      </div>
      <div class="physics-paint-pill physics-paint-pill--playback physics-paint-roto-playback-controls" role="group" aria-label="Roto playback settings">
        <button type="button" class={`physics-paint-nav-button physics-paint-roto-loop-toggle ${props.playbackLoop ? 'active' : ''}`} aria-label="Loop cached Roto playback" aria-pressed={props.playbackLoop} disabled={!props.ready || !props.onPlaybackLoopChange} onClick={() => props.onPlaybackLoopChange?.(!props.playbackLoop)}><RotateCcw size={15} /></button>
        {props.onAudioPreviewToggle ? (
          <span
            class="physics-paint-audio-preview-toggle-anchor"
            onPointerEnter={audioPreviewTooltip.onPointerEnter}
            onPointerLeave={audioPreviewTooltip.onPointerLeave}
          >
            {/* 41-04 (D-12): session-local Audio Preview toggle — guarded icon
                with styled tooltip, mirroring the loop-toggle button pattern. */}
            <button
              type="button"
              class={`physics-paint-nav-button physics-paint-audio-preview-toggle ${props.audioPreviewEnabled ? 'active' : ''}`}
              aria-label={props.audioPreviewEnabled ? 'Disable audio preview' : 'Enable audio preview'}
              aria-pressed={props.audioPreviewEnabled === true}
              disabled={!props.ready}
              onFocus={audioPreviewTooltip.onFocus}
              onBlur={audioPreviewTooltip.onBlur}
              onClick={() => { audioPreviewTooltip.hide(); props.onAudioPreviewToggle?.(); }}
            >
              {props.audioPreviewEnabled ? <Volume2 size={15} aria-hidden="true" /> : <VolumeX size={15} aria-hidden="true" />}
            </button>
            <PhysicsPaintStyledTooltip visible={audioPreviewTooltip.visible} region="bottom">{props.audioPreviewEnabled ? 'Audio preview On — click to mute monitoring' : 'Audio preview Off — click to hear monitoring'}</PhysicsPaintStyledTooltip>
          </span>
        ) : null}
        <label class="physics-paint-roto-fps-control"><span>fps</span><input type="number" min="1" max="60" step="0.5" value={props.playbackFps || props.projectFps || 1} aria-label="Cached Roto playback frames per second" disabled={!props.ready} onInput={handleRotoPlaybackFpsInput} /></label>
      </div>
      <PhysicsPaintWorkflowLiveStatus capsuleText={props.capsuleText} />
      <span
        class="physics-paint-roto-key-icon-action physics-paint-toolbox-button-anchor"
        ref={toolboxAnchorRef}
        onPointerEnter={toolboxTooltip.onPointerEnter}
        onPointerLeave={toolboxTooltip.onPointerLeave}
      >
        <button
          type="button"
          class={`physics-paint-roto-key-icon-button physics-paint-toolbox-toggle${toolboxOpen ? ' physics-paint-toolbox-toggle-open' : ''}`}
          aria-label={props.interpolationEnabled ? 'Timeline tools, interpolation on' : 'Timeline tools, interpolation off'}
          aria-haspopup="dialog"
          aria-expanded={toolboxOpen}
          aria-controls={toolboxOpen ? 'physics-paint-toolbox-popover' : undefined}
          onFocus={toolboxTooltip.onFocus}
          onBlur={toolboxTooltip.onBlur}
          onClick={() => { toolboxTooltip.hide(); interpolationTooltip.hide(); setToolboxOpen((open) => !open); }}
        >
          <span class="physics-paint-toolbox-badge-anchor">
            <ToolCase size={18} aria-hidden="true" />
            {props.interpolationEnabled ? <span class="physics-paint-toolbox-badge" aria-hidden="true" /> : null}
          </span>
          <span class="physics-paint-roto-key-icon-label">Tools</span>
        </button>
        <PhysicsPaintStyledTooltip visible={toolboxTooltip.visible} region="bottom">
          {buildGuardedActionTooltipCopy('Open timeline tools — Interpolation and Key Spacing.', null)}
        </PhysicsPaintStyledTooltip>
      </span>
      {props.onInterpolationEnabledChange ? (
        <PhysicsPaintToolboxPopover anchorRef={toolboxAnchorRef} panelRef={toolboxPanelRef} open={toolboxOpen} ariaLabel="Timeline tools">
          <div class="physics-paint-toolbox-section">
            <div class="physics-paint-toolbox-section-heading">Interpolation</div>
            <div class="physics-paint-pill physics-paint-pill--interpolation physics-paint-roto-interpolation-controls" role="group" aria-label="Roto interpolation settings" data-enabled={props.interpolationEnabled ? 'true' : 'false'} data-pending={props.interpolationPending ? 'true' : 'false'} onPointerEnter={interpolationTooltip.onPointerEnter} onPointerLeave={interpolationTooltip.onPointerLeave}>
              <button type="button" class={`physics-paint-roto-interpolation-toggle ${props.interpolationEnabled ? 'active' : ''}`} aria-label={props.interpolationEnabled ? 'Disable generated in-betweens' : 'Enable generated in-betweens'} aria-pressed={props.interpolationEnabled} aria-busy={props.interpolationPending ? 'true' : undefined} disabled={props.interpolationControlsDisabled} onClick={() => { if (props.mutationLocked || props.interpolationPending) return; props.onInterpolationEnabledChange?.(!props.interpolationEnabled); }}><Blend size={15} aria-hidden="true" /></button>
              <label class="physics-paint-roto-interpolation-mode"><select class="physics-paint-roto-interpolation-select" value={props.interpolationMode} aria-label="Interpolation mode" disabled={props.interpolationControlsDisabled || !props.onInterpolationModeChange} onChange={handleInterpolationModeChange}><option value="duplicate">Frame duplicate</option><option value="blend">Frame blending</option></select></label>
              <PhysicsPaintStyledTooltip visible={interpolationTooltip.visible} region="top">{props.interpolationStatus}</PhysicsPaintStyledTooltip>
            </div>
          </div>
          <div class="physics-paint-toolbox-divider" />
          <div class="physics-paint-toolbox-section">
            <div class="physics-paint-toolbox-section-heading">Key Spacing</div>
            {props.forceSpacingControlsPresent ? (
              <span class="physics-paint-roto-key-icon-action" onPointerEnter={forceSpacingTooltip.onPointerEnter} onPointerLeave={forceSpacingTooltip.onPointerLeave}>
                <form
                  class="physics-paint-pill physics-paint-pill--apply-spacing physics-paint-roto-force-spacing-controls"
                  aria-label="Set Key Space"
                  onSubmit={props.onForceSpacingSubmit}
                >
                  <AlignHorizontalSpaceAround size={18} aria-hidden="true" />
                  <span class="physics-paint-roto-key-icon-label">Key spacing</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={props.forceSpacingInput}
                    aria-label="Empty frames between real keys"
                    aria-disabled={!props.canApplyForceSpacing ? 'true' : undefined}
                    aria-describedby={!props.canApplyForceSpacing && props.forceSpacingActionDisabledReason ? 'roto-key-action-reason-spacing' : undefined}
                    onFocus={forceSpacingTooltip.onFocus}
                    onBlur={forceSpacingTooltip.onBlur}
                    onInput={(event) => {
                      if (!props.canApplyForceSpacing) return;
                      props.onForceSpacingInput?.(event);
                    }}
                  />
                  <button
                    type="submit"
                    class="physics-paint-roto-force-spacing-apply"
                    aria-label="Apply force spacing"
                    aria-disabled={!props.canApplyForceSpacing ? 'true' : undefined}
                    onFocus={forceSpacingTooltip.onFocus}
                    onBlur={forceSpacingTooltip.onBlur}
                  >Apply</button>
                </form>
                {!props.canApplyForceSpacing && props.forceSpacingActionDisabledReason ? (
                  <span id="roto-key-action-reason-spacing" class="physics-paint-sr-only">{props.forceSpacingActionDisabledReason}</span>
                ) : null}
                <PhysicsPaintStyledTooltip visible={forceSpacingTooltip.visible} region="bottom">
                  {buildGuardedActionTooltipCopy('Set empty physical frames between real Roto keys', props.forceSpacingActionDisabledReason)}
                </PhysicsPaintStyledTooltip>
              </span>
            ) : null}
          </div>
        </PhysicsPaintToolboxPopover>
      ) : null}
      <div class="physics-paint-state-actions">
        <span class="physics-paint-roto-key-icon-action" onPointerEnter={closeTooltip.onPointerEnter} onPointerLeave={closeTooltip.onPointerLeave}>
          <button type="button" class="physics-paint-roto-key-icon-button" aria-label="Close" onFocus={closeTooltip.onFocus} onBlur={closeTooltip.onBlur} onClick={() => { closeTooltip.hide(); props.onClose?.(); }}><X size={15} aria-hidden="true" /></button>
          <PhysicsPaintStyledTooltip visible={closeTooltip.visible} region="top">Close</PhysicsPaintStyledTooltip>
        </span>
      </div>
    </div>
  );
}

const PhysicsPaintWorkflowStaticChrome = memo(PhysicsPaintWorkflowStaticChromeImpl);

interface RotoTimelineCellButtonProps {
  frame: number;
  vm: RotoCellViewModel;
  cellClass: string;
  semanticKind: 'empty' | 'real-key' | 'generated';
  cellKeyId: string | null;
  dragEligible: boolean;
  startsInterpolationSegment: boolean;
  ariaLabel: string;
  ariaSelected?: boolean;
  tooltipCopy: string;
  onCellPointerDown: (event: PointerEvent, frame: number, keyId: string) => void;
  onCellClick: (frame: number, vm: RotoCellViewModel, event: MouseEvent) => void;
}

/**
 * Per-cell derivation bundle (38.1-04, Option A — 38.1-D-08 link 2, RESEARCH
 * Pattern 3). Each entry holds the expensive per-cell derivations for one
 * frame: `getRotoCellViewModel` (whose per-call cachedFrames filter/find scan
 * is O(N)) and `getRotoCellFill` (O(N) some). `currentFrame` feeds nothing in
 * these derivations except the view model's `current` overlay, so a pure
 * frame change invalidates ONLY the previously-current and newly-current
 * entries; every other entry serves the byte-identical cached value.
 */
interface RotoCellDerivation {
  vm: RotoCellViewModel;
  fill: ReturnType<typeof getRotoCellFill>;
}

interface RotoCellDerivationCache {
  physicalCellByAppFrame: ReadonlyMap<number, RotoPhysicalTimelineCell>;
  cachedFrameByAppFrame: ReadonlyMap<number, PhysicPaintRotoCacheFrame>;
  realCachedFrameSet: ReadonlySet<number>;
  currentFrame: number;
  entries: Map<number, RotoCellDerivation>;
}

/**
 * One physical-frame cell with its own styled-tooltip controller (D-16/C-06).
 * Hooks cannot run inside the physical-cell map in the strip body, so each cell is
 * a child component owning one `useStyledTooltip` instance. The button keeps
 * every `data-roto-*` attribute, class hook, and drag handler verbatim — only
 * the native `title` is retired in favor of the styled tooltip (Pitfall 4).
 */
function RotoTimelineCellButtonImpl(props: RotoTimelineCellButtonProps) {
  recordPhysicsPaintPerformanceCounter('render.rotoTimelineCellButton');
  const tooltip = useStyledTooltip();
  return (
    <span
      class="physics-paint-roto-cell-anchor"
      onPointerEnter={tooltip.onPointerEnter}
      onPointerLeave={tooltip.onPointerLeave}
    >
      <button
        type="button"
        class={props.cellClass}
        data-roto-app-frame={props.frame}
        data-roto-kind={props.semanticKind}
        data-roto-key-id={props.cellKeyId ?? undefined}
        aria-label={props.ariaLabel}
        aria-selected={props.ariaSelected === true ? 'true' : undefined}
        onPointerDown={props.dragEligible && props.cellKeyId !== null
          ? (event) => {
              tooltip.hide();
              props.onCellPointerDown(event as unknown as PointerEvent, props.frame, props.cellKeyId as string);
            }
          : undefined}
        onFocus={tooltip.onFocus}
        onBlur={tooltip.onBlur}
        onClick={(event) => {
          tooltip.hide();
          props.onCellClick(props.frame, props.vm, event as unknown as MouseEvent);
        }}
      >
        {props.startsInterpolationSegment ? (
          <span class="physics-paint-roto-segment-start-cut" aria-hidden="true" />
        ) : null}
        <span>{props.frame}</span>
      </button>
      <PhysicsPaintStyledTooltip visible={tooltip.visible} region="bottom">{props.tooltipCopy}</PhysicsPaintStyledTooltip>
    </span>
  );
}

const RotoTimelineCellButton = memo(RotoTimelineCellButtonImpl);

export function PhysicsPaintWorkflowStrip(props: PhysicsPaintWorkflowStripProps) {
  recordPhysicsPaintPerformanceCounter('render.workflowStrip');
  const [scrollbar, setScrollbar] = useState({ left: 0, width: 0, visible: false });
  const [rotoDragPreview, setRotoDragPreview] = useState<RotoDragPreviewState | null>(null);
  // Group Rail drag preview (plan 03): session-only publication surfaced by the
  // rail's session hook, consumed for the gap preview paint only (Pitfall 5).
  const [rotoGroupDragPreview, setRotoGroupDragPreview] = useState<GroupRailDragPreviewState | null>(null);
  const [rotoKeyRailDragPreview, setRotoKeyRailDragPreview] = useState<
    KeyRailDragPreviewState<RotoKeyRailDragPublication> | null
  >(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const timelineContentRef = useRef<HTMLDivElement>(null);
  const rotoDragGestureRef = useRef<RotoDragGestureSession | null>(null);
  const rotoCellDerivationCacheRef = useRef<RotoCellDerivationCache | null>(null);
  const suppressNextRotoClickRef = useRef(false);
  const mountedRef = useRef(true);
  // 43.4 defect 6: the last focused Key Rail button and its timeline container,
  // so a Delete/Undo/Redo commit that removes the button can restore focus to
  // the stable container instead of leaving it orphaned on body.
  const lastFocusedKeyRailRef = useRef<{ element: HTMLElement; container: HTMLElement | null } | null>(null);
  const currentFrameSignal = useSignal(props.currentFrame);
  if (currentFrameSignal.peek() !== props.currentFrame) currentFrameSignal.value = props.currentFrame;
  const interpolationEnabled = props.rotoInterpolationEnabled === true;
  const interpolationMode = props.rotoInterpolationMode ?? 'duplicate';
  const currentPhysicalCells = props.rotoPhysicalCells;
  const rotoKeyRecords = props.rotoKeyRecords ?? [];
  const realKeyOrderById = useMemo(
    () => new Map([...rotoKeyRecords]
      .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId))
      .map((record, index) => [record.keyId, index] as const)),
    [props.rotoKeyRecords],
  );
  const incomingInterpolationBreakKeyIds = props.rotoIncomingInterpolationBreakKeyIds ?? EMPTY_STRING_IDS;
  const incomingInterpolationBreakKeyIdSet = useMemo(
    () => new Set(incomingInterpolationBreakKeyIds),
    [incomingInterpolationBreakKeyIds],
  );
  const acceptedGroupDocument = useMemo<Pick<PhysicPaintRotoPhysicalDocument, 'realKeyRecords' | 'loopClips'>>(() => ({
    realKeyRecords: props.rotoKeyRecords ?? [],
    loopClips: props.rotoLoopClips ?? [],
  }), [props.rotoKeyRecords, props.rotoLoopClips]);
  const cachedRotoFrames = props.cachedRotoFrames ?? EMPTY_CACHED_ROTO_FRAMES;
  const structuralIndex = useMemo(
    () => buildRotoTimelineStructuralIndex(currentPhysicalCells, cachedRotoFrames, acceptedGroupDocument),
    [currentPhysicalCells, cachedRotoFrames, acceptedGroupDocument],
  );
  const { frameCells, physicalCellByAppFrame, generatedRotoFrames, cachedFrameByAppFrame, realCachedFrameSet, lifecycleTargetByAppFrame } = structuralIndex;
  const rotoLaneWidthPx = frameCells.length * ROTO_CELL_WIDTH_PX;
  const rotoRulerTicks = useMemo(() => buildRulerTicks(frameCells), [frameCells]);
  // Phase 43 loop resolution (Pitfall 7, D-32): the lazy per-frame contract
  // is queried for exactly the represented physical extent (frameCells) — one
  // query per capacity-bounded frame, never proportional to any loop's effective range. Null
  // when no loop context is supplied (pre-43 byte-identical path).
  const loopResolutionContext = props.rotoLoopResolutionContext ?? null;
  const keyRailGroupOwnedKeyIds = useMemo(() => {
    const owned = new Set<string>();
    for (const clip of props.rotoLoopClips ?? []) {
      clip.sourceKeyIds.forEach((keyId) => owned.add(keyId));
      (clip.frameOverrides ?? []).forEach((override) => owned.add(override.keyId));
    }
    return owned;
  }, [props.rotoLoopClips]);
  const keyRailSegments = useMemo(() => deriveKeyRailSegments({
    orderedRealKeys: [...rotoKeyRecords]
      .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId)),
    incomingInterpolationBreakKeyIds: new Set(props.rotoIncomingInterpolationBreakKeyIds ?? []),
    groupOwnedKeyIds: keyRailGroupOwnedKeyIds,
  }), [rotoKeyRecords, props.rotoIncomingInterpolationBreakKeyIds, keyRailGroupOwnedKeyIds]);
  // 43.4 defect 6: record the focused Key Rail button so a commit that removes
  // it (Delete/Undo/Redo) can restore focus to the stable timeline container.
  const handleKeyRailFocus = useCallback((element: HTMLElement) => {
    lastFocusedKeyRailRef.current = { element, container: timelineScrollRef.current };
  }, []);
  useEffect(() => {
    const lastFocused = lastFocusedKeyRailRef.current;
    if (lastFocused && shouldRestoreOrphanedKeyRailFocus(lastFocused.element, document.activeElement)) {
      lastFocused.container?.focus();
      lastFocusedKeyRailRef.current = null;
    }
  }, [keyRailSegments]);
  const visibleFrameResolutions = useMemo(
    () => loopResolutionContext === null
      ? null
      : resolveRotoVisibleFrameResolutions(loopResolutionContext, frameCells),
    [loopResolutionContext, frameCells],
  );
  const spacingProxySourceIndex = useMemo(
    () => loopResolutionContext === null ? null : buildRotoSpacingProxySourceIndex(loopResolutionContext, frameCells.length),
    [loopResolutionContext, frameCells.length],
  );
  const visibleSpacingProxies = useMemo(
    () => loopResolutionContext === null
      ? null
      : resolveRotoVisibleSpacingProxies(loopResolutionContext, frameCells, visibleFrameResolutions!, spacingProxySourceIndex!),
    [loopResolutionContext, frameCells, visibleFrameResolutions, spacingProxySourceIndex],
  );
  const loopSourceFrameCountById = useMemo(
    () => new Map((loopResolutionContext?.ranges ?? []).map((range) => [range.loopId, range.sourceFrameCount] as const)),
    [loopResolutionContext],
  );
  const loopBoundaryFrames = useMemo(() => {
    const starts = new Set<number>();
    const ends = new Set<number>();
    const extents = new Map<string, { start: number; endExclusive: number }>();
    for (const range of loopResolutionContext?.ranges ?? []) {
      const current = extents.get(range.loopId);
      const endExclusive = range.requestedEnd === 'infinity'
        ? range.effectiveEnd
        : range.requestedEnd;
      if (current) {
        current.start = Math.min(current.start, range.phaseOrigin);
        current.endExclusive = Math.max(current.endExclusive, endExclusive);
      } else {
        extents.set(range.loopId, { start: range.phaseOrigin, endExclusive });
      }
    }
    for (const extent of extents.values()) {
      if (extent.endExclusive <= extent.start) continue;
      starts.add(extent.start);
      ends.add(extent.endExclusive - 1);
    }
    return { starts, ends };
  }, [loopResolutionContext]);
  // Per-cell derivation cache update (38.1-04, Option A — 38.1-D-08 link 2,
  // RESEARCH Pattern 3). Full invalidation on ANY structural identity change
  // (the physical-cell Map or the cached-frame arrays — realCachedRotoFrames
  // is memoized from cachedRotoFrames, so its identity tracks it). On a pure
  // currentFrame change ONLY the previously-current and newly-current entries
  // are dropped: `currentFrame` reaches `getRotoCellViewModel` solely through
  // the `current` overlay (frame === currentFrame), so every other entry
  // stays byte-valid. Drag preview, selection, and saved-marker state are
  // read per-render in the cell loop below and are NOT cache inputs.
  const activeCellDerivationCache = rotoCellDerivationCacheRef.current;
  if (
    activeCellDerivationCache === null ||
    activeCellDerivationCache.physicalCellByAppFrame !== physicalCellByAppFrame ||
    activeCellDerivationCache.cachedFrameByAppFrame !== cachedFrameByAppFrame
  ) {
    rotoCellDerivationCacheRef.current = {
      physicalCellByAppFrame,
      cachedFrameByAppFrame,
      realCachedFrameSet,
      currentFrame: props.currentFrame,
      entries: new Map(),
    };
  } else if (activeCellDerivationCache.currentFrame !== props.currentFrame) {
    activeCellDerivationCache.entries.delete(activeCellDerivationCache.currentFrame);
    activeCellDerivationCache.entries.delete(props.currentFrame);
    activeCellDerivationCache.currentFrame = props.currentFrame;
  }
  const getRotoCellDerivation = (frame: number): RotoCellDerivation => {
    const cache = rotoCellDerivationCacheRef.current as RotoCellDerivationCache;
    const cached = cache.entries.get(frame);
    if (cached) return cached;
    // Byte-identical to the pre-cache cell-loop derivation: same inputs, same
    // pure helpers, same argument order — only WHEN it runs changed (D-09).
    const cachedFramesForCell = cache.cachedFrameByAppFrame;
    const vm = getRotoCellViewModel({
      frame,
      currentFrame: props.currentFrame,
      cachedFrames: cachedFramesForCell,
    });
    const fill = getRotoCellFill(frame, cache.realCachedFrameSet);
    const derivation: RotoCellDerivation = { vm, fill };
    cache.entries.set(frame, derivation);
    return derivation;
  };
  const hasGeneratedInBetweens = generatedRotoFrames.length > 0;
  const interpolationStatus = interpolationEnabled
    ? hasGeneratedInBetweens
      ? INTERPOLATION_ENABLED_STATUS
      : 'Generated in-betweens on — save at least two real Roto keys.'
    : INTERPOLATION_DISABLED_STATUS;
  const currentSemanticCell = physicalCellByAppFrame.get(props.currentFrame) ?? null;
  const currentRotoCell = getRotoCellViewModel({ frame: props.currentFrame, currentFrame: props.currentFrame, cachedFrames: cachedFrameByAppFrame });
  const isCurrentRealRotoKey = currentSemanticCell?.kind === 'real';
  const sessionKeyAvailability = props.rotoKeyState?.actionAvailability;
  const physicalActions = props.rotoPhysicalActions;
  const physicalInsertAvailable = physicalActions?.canInsertFrame.value ?? false;
  const physicalDeleteAvailable = physicalActions?.canDeleteFrame.value ?? false;
  const physicalScissorAvailable = physicalActions?.canScissor.value ?? false;
  const physicalInsertDisabledReason = physicalActions?.insertDisabledReason.value ?? null;
  const insertRotoKeyDescription = physicalActions?.insertTooltipDescription.value ?? 'Insert key before';
  const physicalDeleteDisabledReason = physicalActions?.deleteDisabledReason.value ?? null;
  const deleteRotoScopeLabel = physicalActions?.deleteScopeLabel.value ?? 'Delete Frame';
  const physicalScissorDisabledReason = physicalActions?.scissorDisabledReason.value ?? null;
  const forceSpacingInput = physicalActions?.forceSpacingInput.value ?? '1';
  const forceSpacingAvailable = physicalActions?.canApplyForceSpacing.value ?? false;
  const forceSpacingDisabledReason = physicalActions?.forceSpacingDisabledReason.value ?? null;
  // Set Key Space guarded action (36.15-08): the relocated bottom-row form uses
  // the same guarded-icon contract as the other row actions — no native
  // disabled/title; the submit handler keeps its verbatim mutation-lock guard.
  const canApplyForceSpacingAction = forceSpacingAvailable && props.ready !== false && !props.mutationLocked;
  const forceSpacingActionDisabledReason = canApplyForceSpacingAction
    ? null
    : forceSpacingDisabledReason ?? 'Finish the current key action before using key tools.';
  const scriptStatus = props.rotoScript?.status.value ?? null;
  const keyUtilitiesDisabledByBusyState = props.ready === false || Boolean(props.mutationLocked) || Boolean(props.keyActionInFlight) || Boolean(sessionKeyAvailability?.busy) || Boolean(rotoDragPreview?.pending);
  const interpolationControlsDisabled = props.ready === false || Boolean(props.mutationLocked) || Boolean(props.rotoInterpolationPending);
  const canUseSourceRotoKey = isCurrentRealRotoKey && !keyUtilitiesDisabledByBusyState;
  const canInsertRotoKey = physicalActions ? physicalInsertAvailable && props.ready !== false : (sessionKeyAvailability ? (sessionKeyAvailability.canInsert || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey);
  const canDuplicateRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canDuplicate || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canCopyRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canCopy || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canPasteRotoKey = sessionKeyAvailability ? sessionKeyAvailability.canPaste && props.ready !== false : Boolean(props.hasCopiedRotoKey) && !keyUtilitiesDisabledByBusyState;
  const canDeleteRotoKey = physicalActions ? physicalDeleteAvailable && props.ready !== false : (sessionKeyAvailability ? (sessionKeyAvailability.canDelete || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey);
  const canScissorRotoKey = Boolean(physicalActions)
    && physicalScissorAvailable
    && props.ready !== false
    && !keyUtilitiesDisabledByBusyState;
  const scissorRotoKeyDisabledReason = canScissorRotoKey
    ? null
    : physicalScissorDisabledReason ?? 'Scissor is unavailable.';
  const physicalDragAvailable = physicalActions?.canDragKey.value ?? false;
  const rotoDragLocked = keyUtilitiesDisabledByBusyState || !physicalActions || !physicalDragAvailable;
  // Guarded-icon-action availability reasons (D-12): verbatim controller ports
  // via getRotoKeyUtilityDisabledMessage (which defers to physicalActions /
  // sessionKeyAvailability reasons) and scriptAvailability reason ports. The
  // view never shortens, re-derives, or infers these reasons.
  const insertRotoKeyDisabledReason = canInsertRotoKey ? null : getRotoKeyUtilityDisabledMessage('insert');
  const duplicateRotoKeyDisabledReason = canDuplicateRotoKey ? null : getRotoKeyUtilityDisabledMessage('duplicate');
  // + Key availability flows from the physical action bundle's reactive port
  // (launch, pending, current-frame occupancy) plus the shared busy lock; the
  // disabled reason stays verbatim from the controller port (D-12).
  const canAddRotoKey = Boolean(physicalActions) && physicalActions!.canAddEmptyKey.value && props.ready !== false && !keyUtilitiesDisabledByBusyState;
  const addRotoKeyDisabledReason = canAddRotoKey
    ? null
    : keyUtilitiesDisabledByBusyState || props.ready === false
      ? 'Finish the current key action before using key tools.'
      : physicalActions?.addEmptyKeyDisabledReason.value ?? 'Adding a Roto key is unavailable.';
  const copyRotoKeyDisabledReason = canCopyRotoKey ? null : getRotoKeyUtilityDisabledMessage('copy');
  const pasteRotoKeyDisabledReason = canPasteRotoKey ? null : getRotoKeyUtilityDisabledMessage('paste');
  const deleteRotoKeyDisabledReason = canDeleteRotoKey ? null : getRotoKeyUtilityDisabledMessage('delete');
  // Cut (quick 260731-9l0): enabled only when BOTH copy and delete
  // availability hold; the disabled tooltip shows the underlying copy or
  // delete controller reason verbatim.
  const canCutRotoKey = canCopyRotoKey && canDeleteRotoKey;
  const cutRotoKeyDisabledReason = canCutRotoKey ? null : (copyRotoKeyDisabledReason ?? deleteRotoKeyDisabledReason);
  // Select All guarded icon (37-04; D-03): availability flows from the 37-03
  // canSelectAllKeys / selectAllKeysDisabledReason computeds plus the shared
  // busy lock; the disabled reason stays verbatim from the controller port
  // (36.15 D-28 — aria-disabled only, never the native disabled attribute).
  const canSelectAllRotoKeys = (physicalActions?.canSelectAllKeys.value ?? false) && props.ready !== false && !keyUtilitiesDisabledByBusyState;
  const selectAllDisabledReason = canSelectAllRotoKeys
    ? null
    : keyUtilitiesDisabledByBusyState && physicalActions?.canSelectAllKeys.value
      ? ROTO_KEY_BUSY_STATUS_TEMPLATE
      : physicalActions?.selectAllKeysDisabledReason.value ?? 'Select all keys is unavailable.';
  // Directional Push tool (43.5-05 design revision): ONE Push tool,
  // selection-first. The explicit anchor is the selected Rail (Key/Motion/
  // Static) — key/cell selection alone does NOT enable it. The button is
  // enabled only when exactly one Rail is selected and the strip is not
  // mutation-locked; otherwise disabled with a guarded tooltip.
  const pushAnchor = useMemo(() => {
    if (props.selectedRotoKeyRail) {
      return { kind: 'key' as const, id: props.selectedRotoKeyRail.firstKeyId };
    }
    if (props.selectedRotoLoopClipIds && props.selectedRotoLoopClipIds.length === 1) {
      return { kind: 'loop' as const, id: props.selectedRotoLoopClipIds[0] };
    }
    return null;
  }, [props.selectedRotoKeyRail, props.selectedRotoLoopClipIds]);
  const pushToolDisabled = keyUtilitiesDisabledByBusyState || !physicalActions || pushAnchor === null;
  const pushToolDisabledReason = pushToolDisabled
    ? (pushAnchor === null ? 'Select a Rail to push.' : ROTO_KEY_BUSY_STATUS_TEMPLATE)
    : null;
  const pushArmed = isPushToolArmed();
  const pushArmedClass = pushArmed ? ' physics-paint-push-tool-armed' : '';
  // 43.5-05 Defect 1: the anchor is bound to the selected Rail's identity at
  // ARM time (not re-resolved at drag position). Captured here so the drag
  // session and the pre-highlight always use the exact rail that armed the tool.
  const armedAnchorRef = useRef<{ readonly kind: 'key' | 'loop'; readonly id: string } | null>(null);
  // If the selection is cleared or changes type while armed, disarm — the tool
  // must never push a stale anchor. The effect also clears the captured anchor
  // whenever the tool is disarmed through any path (Escape, cancel, other
  // toolbar action, re-click).
  useEffect(() => {
    if (!pushArmed) {
      armedAnchorRef.current = null;
      return;
    }
    const armedAnchor = armedAnchorRef.current;
    if (armedAnchor === null) return;
    if (pushAnchor === null || pushAnchor.kind !== armedAnchor.kind || pushAnchor.id !== armedAnchor.id) {
      armedAnchorRef.current = null;
      disarmPushTool();
    }
  }, [pushAnchor, pushArmed]);
  const insertKeyTooltip = useStyledTooltip();
  const addKeyTooltip = useStyledTooltip();
  const duplicateKeyTooltip = useStyledTooltip();
  const copyKeyTooltip = useStyledTooltip();
  const cutKeyTooltip = useStyledTooltip();
  const scissorKeyTooltip = useStyledTooltip();
  const pasteKeyTooltip = useStyledTooltip();
  const deleteKeyTooltip = useStyledTooltip();
  const selectAllTooltip = useStyledTooltip();
  const pushTooltip = useStyledTooltip();
  const keyIdByAppFrame = useMemo(() => {
    const map = new Map<number, string>();
    for (const record of rotoKeyRecords) map.set(record.appFrame, record.keyId);
    return map;
  }, [rotoKeyRecords]);
  // ── 43.5-05 directional Push armed-tool session wiring ─────────────────────
  // The push session is gesture + presentation only; resolver/store/model enter
  // exclusively through the session hook's injected ports (T-43.5-02). Armed
  // state lives in the sibling session-only module (D-19). pushPaintTick
  // re-renders the strip so the hook's internal presentation Signals are read
  // fresh — the hook returns .value reads, and the tick subscribes the
  // component to their changes (CLAUDE.md Preact rule: no useEffect-mirrored
  // state).
  const pushPaintTick = useSignal(0);
  // Blocked-direction verdict while a drag is live (43.5-05 design revision):
  // the dragged direction has zero valid movement (frame-0/capacity flush or
  // straddle) — the guarded tooltip shows for that direction only and the other
  // direction stays available (the tool stays armed).
  const pushDragBlocked = useSignal<{ readonly reason?: string; readonly detail?: string } | null>(null);
  // 43.5-05 Defect 2: the blocked-direction tooltip anchors to the pointer
  // position (viewport coords captured by the hook's onBlocked) — never to an
  // unrelated panel element. A zero-size anchor span is positioned here and the
  // tooltip's layout effect reads its rect.
  const pushBlockedPointer = useSignal<{ readonly x: number; readonly y: number } | null>(null);
  const pushBlockedAnchorRef = useRef<HTMLSpanElement | null>(null);
  const pushSessionRef = useRef<{
    /** Locked by the drag direction on drag start; null until then. */
    direction: PushToolDirection | null;
    anchor: { readonly kind: 'key' | 'loop'; readonly id: string } | null;
    // The moved set's rails, derived for the locked direction in clampDestination
    // from the shared pure derivation (D-17). Ghost paint translates each
    // original interval by the hook's clamped signed delta — the set membership
    // is never re-derived in the view (Pitfall 4).
    movedRails: readonly PushPreviewRail[];
    movedSetBounds: { readonly firstFrame: number; readonly lastEndExclusive: number };
    proposedSignedDelta: number;
    clampFailed: boolean;
  } | null>(null);
  const pushDragApiRef = useRef<PushDragSessionApi<RotoPushPublication> | null>(null);
  // ── 43.5-05 design revision: armed anchor pre-highlight ───────────────────
  // The anchor is the selected Rail (explicit at arm time), so the
  // pre-highlight paints as soon as armed — no per-frame hover resolution. The
  // selected Rail shows the prospective-set treatment; on drag start the
  // direction locks and the per-rail ghosts take over.
  const pushArmedAnchorRail = useMemo<PushPreviewRail | null>(() => {
    if (!pushArmed) return null;
    if (props.selectedRotoKeyRail) {
      const segment = keyRailSegments.find((s) => s.firstKeyId === props.selectedRotoKeyRail!.firstKeyId);
      if (segment) {
        return {
          kind: 'key-rail',
          id: segment.firstKeyId,
          intervalStart: segment.firstKeyFrame,
          intervalEndExclusive: segment.lastKeyFrame + 1,
        };
      }
    }
    if (props.selectedRotoLoopClipIds && props.selectedRotoLoopClipIds.length === 1) {
      const loopId = props.selectedRotoLoopClipIds[0];
      const range = loopResolutionContext?.ranges.find((r) => r.loopId === loopId);
      const clip = props.rotoLoopClips?.find((c) => c.loopId === loopId);
      if (range && clip) {
        return {
          kind: 'group',
          id: loopId,
          intervalStart: range.placementStart,
          intervalEndExclusive: range.effectiveEnd,
          clip,
        };
      }
    }
    return null;
  }, [pushArmed, props.selectedRotoKeyRail, keyRailSegments, props.selectedRotoLoopClipIds, loopResolutionContext, props.rotoLoopClips]);
  const pushDragApi = usePhysicsPaintPushDrag<RotoPushPublication>({
    projectDestination: ({ originClientX, clientX }) => {
      // Raw SIGNED frame delta (positive = right, negative = left). The hook
      // derives the drag direction from the sign and clamps to the locked
      // direction — the resolver clamp consumes frame deltas, never raw CSS
      // pixels (divide by the 18px frame pitch and round).
      return Math.round((clientX - originClientX) / ROTO_CELL_WIDTH_PX);
    },
    clampDestination: (proposedDeltaFrames, direction) => {
      const session = pushSessionRef.current;
      if (!session || session.anchor === null) return { deltaFrames: 0, blockedEdge: null };
      session.direction = direction;
      // Derive the moved set for the locked drag direction from the shared pure
      // authority (D-17). The anchor is the selected Rail (explicit at arm time).
      const setResult = derivePhysicPaintPushSet({
        ...(session.anchor.kind === 'key' ? { anchorKeyId: session.anchor.id } : { anchorLoopId: session.anchor.id }),
        direction,
        identities: [...rotoKeyRecords]
          .sort((left, right) => left.appFrame - right.appFrame || left.keyId.localeCompare(right.keyId)),
        loopRanges: loopResolutionContext?.ranges ?? [],
        loopClips: props.rotoLoopClips ?? [],
        incomingInterpolationBreakKeyIds,
      });
      if (!setResult.ok || setResult.straddle !== null) {
        session.movedRails = [];
        session.movedSetBounds = { firstFrame: 0, lastEndExclusive: 0 };
        session.clampFailed = true;
        return { deltaFrames: 0, blockedEdge: direction === 'right' ? 'right' : 'left' };
      }
      session.movedRails = setResult.movedRails;
      session.movedSetBounds = setResult.movedSetBounds;
      const outer: 'right' | 'left' = direction;
      const clampResult = clampPhysicPaintPushDestination({
        direction,
        proposedDeltaFrames,
        movedSetBounds: setResult.movedSetBounds,
        leftBoundary: setResult.leftBoundary,
        capacity: frameCells.length,
      });
      session.proposedSignedDelta = proposedDeltaFrames;
      if (!clampResult.ok) {
        // Zero valid movement: forward the PROPOSED (nonzero) delta to prepare
        // so the resolver produces the no-space copy — never the D-15
        // zero-delta no-change copy. preview-is-the-commit (D-14) still holds:
        // the resolver clamp is the single delta authority.
        session.clampFailed = true;
        return { deltaFrames: 0, blockedEdge: outer };
      }
      session.clampFailed = false;
      return {
        deltaFrames: clampResult.deltaFrames,
        blockedEdge: clampResult.deltaFrames === proposedDeltaFrames ? null : outer,
      };
    },
    prepareAtDestination: (clampedDeltaFrames, direction) => {
      const session = pushSessionRef.current;
      if (!session || session.anchor === null) return { ok: false, reason: 'push-unavailable' };
      session.direction = direction;
      const deltaToPrepare = session.clampFailed
        ? Math.abs(session.proposedSignedDelta)
        : Math.abs(clampedDeltaFrames);
      // Release returned to the origin: publish nothing (D-15). The no-op
      // sentinel is filtered by onRejected below and never surfaces as copy.
      if (!session.clampFailed && deltaToPrepare === 0) return { ok: false, reason: PUSH_DROP_NOOP };
      const anchor = session.anchor;
      const descriptor: RotoPushIntentDescriptor = {
        direction,
        deltaFrames: deltaToPrepare,
        ...(anchor.kind === 'key' ? { anchorKeyId: anchor.id } : { anchorLoopId: anchor.id }),
      };
      return physicalActions?.prepareRotoPush(descriptor) ?? { ok: false, reason: 'push-unavailable' };
    },
    onDropCommit: (publication) => physicalActions?.commitRotoPush(publication) ?? Promise.resolve(false),
    onCancel: () => {
      // A cancelled drag (Escape/pointercancel/lostpointercapture) disarms the
      // tool; a rejected drop keeps it armed (UI-SPEC).
      pushDragBlocked.value = null;
      pushBlockedPointer.value = null;
      disarmPushTool();
    },
    onRejected: (reason, detail) => {
      pushDragBlocked.value = null;
      pushBlockedPointer.value = null;
      if (reason === PUSH_DROP_NOOP) return;
      props.onRotoPushDragRejected?.(reason, detail);
    },
    onBlocked: (reason, detail, pointer) => {
      // Blocked direction while the drag is live: show the guarded tooltip for
      // that direction only, anchored to the pointer (43.5-05 Defect 2). The
      // other direction stays available (tool armed).
      pushDragBlocked.value = { reason, detail };
      pushBlockedPointer.value = pointer ? { x: pointer.clientX, y: pointer.clientY } : null;
      pushPaintTick.value += 1;
    },
    onPreviewChange: (preview) => {
      if (preview === null) {
        pushDragBlocked.value = null;
        pushBlockedPointer.value = null;
      }
      pushPaintTick.value += 1;
    },
    clearClickSequence: () => {},
    windowLike: undefined,
  });
  pushDragApiRef.current = pushDragApi;
  // ── 43.5-05 Task 2 drag preview reads (T5/T6) ─────────────────────────────
  // The hook's ghost/preview Signals are read fresh on every render; the
  // pushPaintTick signal (bumped in onPreviewChange) subscribes the component
  // to their changes. Ghost destination is NEVER recomputed here — the hook's
  // clamped signed delta is the single authority (D-14, preview-is-the-commit).
  const pushDragGhost = pushDragApiRef.current?.ghost ?? PUSH_GHOST_INACTIVE;
  const pushDragPreview = pushDragApiRef.current?.preview ?? null;
  // Gap preview (T5): the retained publication's opened-gap interval previews
  // as ordinary roto-fill-empty cells, byte-identical to the 43.2/43.3/43.4 gap
  // treatment. Class application only — no new DOM nodes.
  const pushGapPreviewAppFrames = useMemo(() => {
    const preview = pushDragApiRef.current?.preview ?? null;
    if (preview === null || preview.publication.gapInterval === null) return EMPTY_PUSH_GAP_PREVIEW_FRAMES;
    const frames = new Set<number>();
    for (let frame = preview.publication.gapInterval.firstFrame; frame <= preview.publication.gapInterval.lastFrame; frame += 1) {
      frames.add(frame);
    }
    return frames;
  }, [pushPaintTick.value]);
  // Live drag readout (T6): the single product-reason mapper owns the string
  // (D-15) — no copy literal duplicated in the strip. Published to the status
  // capsule ONLY during the drag (ghost.active); hover produces no status-line
  // change (D-13).
  const pushDragFeedback = pushDragGhost.active && pushDragPreview !== null
    ? mapRotoPushProductReason({
        kind: 'live',
        direction: pushDragPreview.publication.intent.direction,
        signedDeltaFrames: pushDragPreview.publication.clampedDeltaFrames,
        beforeRange: pushDragPreview.publication.beforeRange,
        afterRange: pushDragPreview.publication.afterRange,
        gapInterval: pushDragPreview.publication.gapInterval,
      })
    : null;
  // Lane capture-phase pointer-down: the armed push session wins over the
  // cell/rail drag handlers below it (PUSH-08 — push originates exclusively
  // from armed state). Resolution is UI-derived anchor only; set membership,
  // attachment, and straddle derive from canonical facts in the resolver
  // (T-43.5-02, Pitfall 4/6).
  const handleLanePushPointerDownCapture = useCallback((event: PointerEvent) => {
    if (!isPushToolArmed()) return;
    if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    // While armed, the push gesture owns the lane — stop propagation so
    // cell/rail pointer-down handlers (selection, drags, Scissor arming) never
    // fire. Plain clicks still navigate via the click capture handler below.
    event.stopPropagation();
    const laneElement = timelineContentRef.current;
    if (!laneElement || frameCells.length === 0) return;
    // The pointer must have landed INSIDE the lane — never the sibling ruler or
    // any chrome above it. A pointer-down on the ruler must never start a push.
    if (!(event.target instanceof Element) || !laneElement.contains(event.target)) return;
    // The anchor is the selected Rail bound at arm time (43.5-05 Defect 1) —
    // no per-frame resolution. The direction is chosen by the drag on drag
    // start. If the selection was cleared while armed, the effect disarmed the
    // tool, so the captured anchor is always the rail that armed it.
    const anchor = armedAnchorRef.current;
    if (anchor === null) return;
    pushSessionRef.current = {
      direction: null,
      anchor,
      movedRails: [],
      movedSetBounds: { firstFrame: 0, lastEndExclusive: 0 },
      proposedSignedDelta: 0,
      clampFailed: false,
    };
    pushDragApiRef.current?.onPointerDown(event);
  }, [isPushToolArmed, armedAnchorRef, frameCells]);

  const handleLanePushClickCapture = useCallback((event: MouseEvent) => {
    const armed = isPushToolArmed();
    const suppressed = pushDragApiRef.current?.consumeClickSuppression() ?? false;
    if (!armed && !suppressed) return;
    event.preventDefault();
    event.stopPropagation();
    // Smoke contract revision: while armed, a plain click moves the playback
    // cursor ONLY — never selection. The click is swallowed so cell/rail click
    // handlers (selection gestures) never fire; the cursor navigates to the
    // clicked frame. A post-drop click (suppression armed past the 4px
    // threshold) is swallowed without navigation (D-09).
    if (armed && !suppressed) {
      const laneElement = timelineContentRef.current;
      if (laneElement && frameCells.length > 0) {
        const relativeX = event.clientX - laneElement.getBoundingClientRect().left;
        const frame = Math.floor(relativeX / ROTO_CELL_WIDTH_PX);
        if (frame >= 0 && frame < frameCells.length) {
          props.onNavigateToSyncedFrame?.(frame);
        }
      }
    }
  }, [frameCells, props.onNavigateToSyncedFrame]);
  // Controller-owned selection set (37-02; D-05): read-only here, never
  // reordered, never derived from frames or DOM order.
  const rotoSelectedKeyIdSet = useMemo(() => new Set(props.rotoSelectedKeyIds ?? []), [props.rotoSelectedKeyIds]);
  const rotoSpacingSelectedSourceKeyIdSet = useMemo(
    () => new Set(props.rotoSpacingSelection?.selectedSourceKeyIds ?? []),
    [props.rotoSpacingSelection],
  );
  // Structural memo (38.1-04, 38.1-D-08 link 2): the O(N) template-string
  // build now recomputes only when one of the five values it interpolates
  // changes identity — never on unrelated renders (drag preview ticks,
  // scrollbar updates). The produced string is byte-identical to the
  // pre-memo construction; effect/callback deps compare it by value as
  // before.
  const rotoDragValidityKey = useMemo(
    () => `${props.rotoDragContextKey ?? 'none'}:${frameCells[0] ?? -1}:${frameCells[frameCells.length - 1] ?? -1}:${currentPhysicalCells.map((cell) => `${cell.kind}@${cell.appFrame}`).join(',')}:${rotoDragLocked ? 1 : 0}:${rotoKeyRecords.map((record) => `${record.keyId}@${record.appFrame}`).join(',')}`,
    [props.rotoDragContextKey, frameCells, currentPhysicalCells, rotoDragLocked, rotoKeyRecords],
  );
  const rotoDragFeedback = getRotoDragFeedback(rotoDragPreview);
  const resolverApprovedGeneratedTarget = Boolean(rotoDragPreview?.candidateValid && rotoDragPreview.candidateKind === 'generated');
  const rotoDragPreviewViewModel: RotoDragPreviewViewModel | null = rotoDragPreview?.publication
    ? getRotoDragPreviewViewModel(rotoDragPreview.publication.proposal, { committing: rotoDragPreview.pending })
    : null;
  const rotoDragVacatedAppFrames = useMemo(() => {
    if (!rotoDragPreview?.publication) return new Set<number>();
    return collectRotoDragVacatedAppFrames(currentPhysicalCells, rotoDragPreview.publication.proposal);
  }, [currentPhysicalCells, rotoDragPreview]);
  // Group-drag clamp inputs (plan 03, D-05): the static facts the plan-02 pure
  // clamp authority needs, derived from canonical document facts only — never a
  // UI-supplied attachment flag (Pitfall 4). The session hook fills in the live
  // proposed destination and calls the shared clamp so preview-is-the-commit
  // holds by construction.
  const getRotoGroupDragClampInput = useCallback((
    loopId: string,
  ): Omit<PhysicPaintRotoGroupDragClampInput, 'proposedDestinationPlacementStart'> | null => {
    if (loopResolutionContext === null) return null;
    const clip = props.rotoLoopClips?.find((candidate) => candidate.loopId === loopId);
    if (!clip) return null;
    const draggedRanges = loopResolutionContext.ranges.filter((range) => range.loopId === loopId);
    const phaseOrigin = clip.phaseOrigin ?? clip.placementStart;
    const effectiveEnd = resolvePhysicPaintRotoGroupEffectiveEnd(clip, draggedRanges);
    return {
      clip,
      draggedInterval: { phaseOrigin, effectiveEnd },
      identities: rotoKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
      loopRanges: loopResolutionContext.ranges,
      capacity: currentPhysicalCells.length,
    };
  }, [loopResolutionContext, props.rotoLoopClips, rotoKeyRecords, currentPhysicalCells]);
  // Group-drag gap preview (UI-SPEC G3): vacated + destination-gap frames from
  // the rail session's retained publication, painted as ordinary roto-fill-empty
  // cells byte-identical to the 43.2 deleted-Group-gap treatment (D-02).
  const rotoGroupDragGapPreviewAppFrames = useMemo(() => {
    if (!rotoGroupDragPreview) return new Set<number>();
    const clip = props.rotoLoopClips?.find((candidate) => candidate.loopId === rotoGroupDragPreview.publication.loopId);
    if (!clip) return new Set<number>();
    return collectRotoGroupDragGapPreviewAppFrames(
      currentPhysicalCells,
      rotoGroupDragPreview.publication.proposal,
      clip,
    );
  }, [rotoGroupDragPreview, props.rotoLoopClips, currentPhysicalCells]);
  const getRotoKeyRailDragClampInput = useCallback((
    segment: KeyRailSegment,
  ): Omit<PhysicPaintRotoKeyRailDragClampInput, 'proposedDestinationFirstKeyAppFrame'> => ({
    memberKeyIds: segment.keyIds,
    firstKeyFrame: segment.firstKeyFrame,
    lastKeyFrame: segment.lastKeyFrame,
    identities: rotoKeyRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
    loopRanges: loopResolutionContext?.ranges ?? [],
    capacity: currentPhysicalCells.length,
  }), [rotoKeyRecords, loopResolutionContext, props.rotoParentEndExclusive, currentPhysicalCells.length]);
  // Key Rail gap preview is presentation-only. The retained publication owns
  // both the vacated edge and the exact accepted destination; null preview from
  // commit, cancel, or rejection synchronously clears this entire Set.
  const rotoKeyRailDragGapPreviewAppFrames = useMemo(() => {
    if (!rotoKeyRailDragPreview) return new Set<number>();
    const frames = new Set<number>();
    const publication = rotoKeyRailDragPreview.publication;
    const vacated = rotoKeyRailDragPreview.publication.vacatedInterval;
    if (vacated) {
      for (let frame = vacated.phaseOrigin; frame < vacated.effectiveEnd; frame += 1) frames.add(frame);
    }
    const movedFrame = rotoKeyRailDragPreview.publication.destinationFirstKeyAppFrame;
    const occupied = publication.proposal.cells
      .filter((cell) => cell.kind === 'real' || cell.kind === 'generated')
      .map((cell) => cell.appFrame);
    let predecessor = -1;
    for (const frame of occupied) {
      if (frame < movedFrame && frame > predecessor) predecessor = frame;
    }
    if (predecessor >= 0) {
      for (let frame = predecessor + 1; frame < movedFrame; frame += 1) frames.add(frame);
    }
    return frames;
  }, [rotoKeyRailDragPreview]);
  // Header status capsule (D-15/D-18/D-19): one prioritized line derived
  // render-time from EXISTING props/signal reads only — no new controller
  // state, no effect copying props into local state (key_links). The ambient
  // feed (Phase 38 D-09) is the same kind of direct derivation: the locked
  // current-cell context line from `currentSemanticCell` + `props.currentFrame`
  // via the pure helper — no signal, no memo, no effect. Feedback
  // recency is static wiring metadata: playback status reflects the latest
  // transport interaction, then script apply status, then the generated-frame
  // guard hint; the pure selector owns the priority grammar itself.
  const generatedGuardStatus = !resolverApprovedGeneratedTarget && (currentRotoCell.baseMeaning === 'generated' || currentRotoCell.isEditableTarget === false)
    ? getGeneratedRotoDisabledStatus(currentRotoCell.frame)
    : null;
  const capsuleText = getRotoStatusCapsuleViewModel({
    pendingOperation: pushDragFeedback ?? rotoDragFeedback ?? (keyUtilitiesDisabledByBusyState ? getRotoKeyBusyStatus(props.currentFrame) : null),
    savingIndicator: props.statusMessage ?? null,
    feedback: [
      { text: props.rotoCachedPlaybackStatus ?? null, recency: 2 },
      { text: scriptStatus, recency: 1 },
      { text: generatedGuardStatus, recency: 0 },
    ],
    ambient: getRotoStatusCapsuleIdleContext({
      cellKind: currentSemanticCell?.kind ?? null,
      frame: props.currentFrame,
    }),
  });
  const capsuleTextSignal = useSignal(capsuleText);
  if (capsuleTextSignal.peek() !== capsuleText) capsuleTextSignal.value = capsuleText;
  // 43.5-02 Task 2: the relocated Key Spacing form lives inside the memoized
  // static chrome, so the handlers it wires must keep stable identity (same
  // guard bodies as the bottom-row version — byte-identical behavior).
  const handleForceSpacingInput = useCallback((event: Event) => {
    physicalActions?.setForceSpacingInput((event.currentTarget as HTMLInputElement).value);
  }, [physicalActions]);

  const handleForceSpacingSubmit = useCallback((event: Event) => {
    event.preventDefault();
    if (props.ready === false || props.mutationLocked || !forceSpacingAvailable) return;
    void physicalActions?.applyForceSpacing();
  }, [physicalActions, forceSpacingAvailable, props.ready, props.mutationLocked]);

  const rotoCellClickStateRef = useRef({
    keyIdByAppFrame,
    rotoSelectedKeyIdSet,
    spacingProxyByAppFrame: visibleSpacingProxies ?? EMPTY_SPACING_PROXIES,
    onNavigateToSyncedFrame: props.onNavigateToSyncedFrame,
    onSelectRotoSpacingProxy: props.onSelectRotoSpacingProxy,
    onClearRotoSpacingSelection: props.onClearRotoSpacingSelection,
    onClearRotoKeySelection: props.onClearRotoKeySelection,
    onSelectRotoLoopClip: props.onSelectRotoLoopClip,
    onToggleRotoKeySelection: props.onToggleRotoKeySelection,
    onExtendRotoKeySelection: props.onExtendRotoKeySelection,
    onCollapseRotoSelectionToKey: props.onCollapseRotoSelectionToKey,
  });
  rotoCellClickStateRef.current = {
    keyIdByAppFrame,
    rotoSelectedKeyIdSet,
    spacingProxyByAppFrame: visibleSpacingProxies ?? EMPTY_SPACING_PROXIES,
    onNavigateToSyncedFrame: props.onNavigateToSyncedFrame,
    onSelectRotoSpacingProxy: props.onSelectRotoSpacingProxy,
    onClearRotoSpacingSelection: props.onClearRotoSpacingSelection,
    onClearRotoKeySelection: props.onClearRotoKeySelection,
    onSelectRotoLoopClip: props.onSelectRotoLoopClip,
    onToggleRotoKeySelection: props.onToggleRotoKeySelection,
    onExtendRotoKeySelection: props.onExtendRotoKeySelection,
    onCollapseRotoSelectionToKey: props.onCollapseRotoSelectionToKey,
  };
  const handleRotoTimelineCellClick = useCallback((frame: number, vm: RotoCellViewModel, event: MouseEvent) => {
    if (suppressNextRotoClickRef.current) {
      suppressNextRotoClickRef.current = false;
      return;
    }
    const current = rotoCellClickStateRef.current;
    current.onSelectRotoLoopClip?.(null);
    const spacingProxy = current.spacingProxyByAppFrame.get(frame) ?? null;
    if (spacingProxy !== null) {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
        current.onSelectRotoSpacingProxy?.(spacingProxy, 'toggle');
        return;
      }
      if (event.shiftKey && !event.metaKey && !event.ctrlKey) {
        current.onSelectRotoSpacingProxy?.(spacingProxy, 'range');
        return;
      }
      if (!event.metaKey && !event.ctrlKey && !event.shiftKey) {
        current.onSelectRotoSpacingProxy?.(spacingProxy, 'plain');
        current.onNavigateToSyncedFrame(frame);
        return;
      }
    }
    if (vm.baseMeaning === 'generated' || vm.isEditableTarget === false) {
      current.onNavigateToSyncedFrame(frame);
      return;
    }
    // Selection gestures (D-01/D-02; Pitfall 6): real-key cells only —
    // generated/empty cells already returned above. Modifier branches never
    // steal navigation and never arm a drag session (the pointer-down guard
    // rejects modifier presses, so a modifier-click is selection-only).
    const cellKeyId = current.keyIdByAppFrame.get(frame) ?? null;
    if (cellKeyId === null) {
      current.onClearRotoKeySelection?.();
      current.onClearRotoSpacingSelection?.();
      current.onNavigateToSyncedFrame(frame);
      return;
    }
    current.onClearRotoSpacingSelection?.();
    if (cellKeyId !== null && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
      current.onToggleRotoKeySelection?.(cellKeyId);
      return;
    }
    if (cellKeyId !== null && event.shiftKey && !event.metaKey && !event.ctrlKey) {
      current.onExtendRotoKeySelection?.(cellKeyId);
      return;
    }
    if (cellKeyId !== null && !event.metaKey && !event.ctrlKey && !event.shiftKey && current.rotoSelectedKeyIdSet.size >= 2) {
      current.onCollapseRotoSelectionToKey?.(cellKeyId);
    }
    current.onNavigateToSyncedFrame(frame);
  }, []);

  function getGeneratedRotoTitle(frame: number): string {
    return GENERATED_ROTO_TITLE_TEMPLATE.replace('{frame}', String(frame));
  }

  function getGeneratedRotoDisabledStatus(frame: number): string {
    return GENERATED_ROTO_DISABLED_STATUS_TEMPLATE.replace('{frame}', String(frame));
  }

  function getRotoKeyBusyStatus(frame: number): string {
    return ROTO_KEY_BUSY_STATUS_TEMPLATE.replace('{frame}', String(frame));
  }

  function getRotoKeyUtilityDisabledMessage(action: RotoKeyUtilityAction): string {
    if (action === 'insert' && physicalActions) return physicalInsertDisabledReason ?? 'Insert is unavailable.';
    if (action === 'delete' && physicalActions) return physicalDeleteDisabledReason ?? 'Delete is unavailable.';
    if (sessionKeyAvailability?.busy) return sessionKeyAvailability.disabledReason ?? 'Finish the current key action before using key tools.'.replace('{frame}', String(props.currentFrame));
    if (keyUtilitiesDisabledByBusyState) return 'Finish the current key action before using key tools.'.replace('{frame}', String(props.currentFrame));
    if (currentRotoCell.baseMeaning === 'generated' || currentRotoCell.isEditableTarget === false) return 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.'.replace('{frame}', String(currentRotoCell.frame));
    if (action === 'paste') return sessionKeyAvailability?.pasteDisabledReason ?? 'Copy a real Roto key before pasting.';
    if (action === 'insert') return 'Select a real Roto key to insert.';
    if (action === 'duplicate') return 'Select a real Roto key to duplicate.';
    if (action === 'copy') return 'Select a real Roto key to copy.';
    return 'Select a real Roto key to delete.';
  }

  const updateScrollbar = useCallback(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const { clientWidth, scrollLeft, scrollWidth } = el;
    const visible = scrollWidth > clientWidth + 1;
    if (!visible) {
      setScrollbar({ left: 0, width: 0, visible: false });
      return;
    }
    const thumbWidth = Math.max(120, (clientWidth / scrollWidth) * clientWidth);
    const thumbRange = clientWidth - thumbWidth;
    const scrollRange = scrollWidth - clientWidth;
    setScrollbar({
      left: scrollRange > 0 ? (scrollLeft / scrollRange) * thumbRange : 0,
      width: thumbWidth,
      visible,
    });
  }, []);

  const classifyRotoDragTarget = useCallback((clientX: number, clientY: number, movedKeyId: string, sourceAppFrame: number): {
    target: RotoDragTarget | null;
    kind: RotoDragCandidateKind;
    valid: boolean;
    error: string | null;
  } => {
    const invalid = (kind: RotoDragCandidateKind, error: string): { target: null; kind: RotoDragCandidateKind; valid: false; error: string | null } => ({ target: null, kind, valid: false, error });
    const scroller = timelineScrollRef.current;
    if (!scroller || rotoDragLocked) return invalid('locked', physicalActions?.dragDisabledReason.value ?? 'Finish the current key action before moving a Roto key.');
    const rect = scroller.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return invalid('outside', 'Move the Roto key onto a visible timeline frame.');
    const hit = document.elementFromPoint(clientX, clientY);
    const cell = hit instanceof Element ? hit.closest<HTMLElement>('[data-roto-app-frame]') : null;
    if (!cell || !scroller.contains(cell)) return invalid('outside', 'Move the Roto key onto a visible timeline frame.');
    const appFrameAttr = cell.dataset.rotoAppFrame;
    const appFrame = Number(appFrameAttr);
    if (!Number.isInteger(appFrame) || appFrame < 0) return invalid('outside', 'Move the Roto key onto a visible timeline frame.');
    const cellKind = cell.dataset.rotoKind === 'generated' ? 'generated' : cell.dataset.rotoKind === 'real-key' ? 'real-key' : 'empty';
    if (cellKind === 'real-key') {
      const targetKeyId = cell.dataset.rotoKeyId;
      if (!targetKeyId) return invalid('real-key', 'The occupied Roto key identity is unavailable.');
      if (targetKeyId === movedKeyId) {
        // Self-target: resolver would return changed:false; do not publish.
        return invalid('real-key', 'Move the Roto key to a different position.');
      }
      // Occupied before/after boundary: compare pointer X with the cell's
      // midpoint. The resolver converts the stable target identity into the
      // adjacent physical anchor required by the active move operation.
      const cellRect = cell.getBoundingClientRect();
      const midpoint = cellRect.left + cellRect.width / 2;
      const boundary: 'before-key' | 'after-key' = clientX <= midpoint ? 'before-key' : 'after-key';
      return {
        target: { kind: boundary, targetKeyId },
        kind: 'real-key',
        valid: true,
        error: null,
      };
    }
    // Empty/generated whole-cell target (D-23).
    if (appFrame === sourceAppFrame) {
      // Self-target via physical-cell: resolver would return changed:false.
      return invalid('empty', 'Move the Roto key to a different position.');
    }
    return {
      target: { kind: 'physical-cell', appFrame },
      kind: cellKind === 'generated' ? 'generated' : 'empty',
      valid: true,
      error: null,
    };
  }, [frameCells, keyIdByAppFrame, physicalActions, rotoDragLocked]);

  const updateRotoDragCandidate = useCallback((session: RotoDragGestureSession) => {
    const candidate = classifyRotoDragTarget(session.latestX, session.latestY, session.movedKeyId, session.sourceAppFrame);
    session.candidateTarget = candidate.target;
    session.candidateKind = candidate.kind;
    session.candidateValid = candidate.valid;
    session.candidateError = candidate.valid ? null : candidate.error;
    session.candidateConflicts = null;
    session.candidateDetail = null;
    session.publication = null;
    if (candidate.valid && candidate.target && physicalActions) {
      const preparation: RotoDragPreparationResult = session.groupDrag
        ? physicalActions.prepareRotoKeyGroupDrag(session.movedKeyId, candidate.target)
        : physicalActions.prepareRotoKeyDrag(session.movedKeyId, candidate.target);
      if (preparation.ok) {
        session.publication = preparation.publication;
      } else {
        session.candidateValid = false;
        session.candidateError = preparation.reason;
        // Group-preparation failure detail (D-07/D-08): retained for the
        // blocked-target preview and the release-time reject publication.
        // Hover re-runs publish nothing (37-03 contract).
        if (session.groupDrag) {
          session.candidateConflicts = preparation.conflictingAppFrames ?? null;
          session.candidateDetail = preparation.detail ?? null;
        }
      }
    }
    if (!session.started) return;
    setRotoDragPreview({
      movedKeyId: session.movedKeyId,
      sourceAppFrame: session.sourceAppFrame,
      publication: session.publication,
      candidateKind: session.candidateKind,
      candidateValid: session.candidateValid,
      error: session.candidateError,
      pending: false,
      groupDrag: session.groupDrag,
      conflictingAppFrames: session.candidateConflicts,
    });
  }, [classifyRotoDragTarget, physicalActions]);

  const startRotoEdgeScroll = useCallback((session: RotoDragGestureSession) => {
    if (session.rafId !== null) return;
    const tick = (timestamp: number) => {
      const active = rotoDragGestureRef.current;
      if (!active || active !== session || !active.started) return;
      const scroller = timelineScrollRef.current;
      if (!scroller) {
        active.cleanup();
        return;
      }
      const rect = scroller.getBoundingClientRect();
      const leftDepth = Math.max(0, Math.min(ROTO_EDGE_SCROLL_ZONE_PX, rect.left + ROTO_EDGE_SCROLL_ZONE_PX - active.latestX));
      const rightDepth = Math.max(0, Math.min(ROTO_EDGE_SCROLL_ZONE_PX, active.latestX - (rect.right - ROTO_EDGE_SCROLL_ZONE_PX)));
      const direction = leftDepth > 0 ? -1 : rightDepth > 0 ? 1 : 0;
      const depth = Math.max(leftDepth, rightDepth);
      const previousTime = active.lastRafTime ?? timestamp;
      active.lastRafTime = timestamp;
      if (direction !== 0 && depth > 0) {
        const ratio = depth / ROTO_EDGE_SCROLL_ZONE_PX;
        const speed = ROTO_EDGE_SCROLL_MIN_PX_PER_SECOND + (ROTO_EDGE_SCROLL_MAX_PX_PER_SECOND - ROTO_EDGE_SCROLL_MIN_PX_PER_SECOND) * ratio;
        const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
        const nextScroll = Math.max(0, Math.min(maxScroll, scroller.scrollLeft + direction * speed * Math.min(0.05, (timestamp - previousTime) / 1000)));
        if (nextScroll !== scroller.scrollLeft) {
          scroller.scrollLeft = nextScroll;
          updateScrollbar();
          updateRotoDragCandidate(active);
        }
      }
      active.rafId = window.requestAnimationFrame(tick);
    };
    session.rafId = window.requestAnimationFrame(tick);
  }, [updateRotoDragCandidate, updateScrollbar]);

  const handleRotoCellPointerDownCurrent = useCallback((event: PointerEvent, sourceAppFrame: number, movedKeyId: string) => {
    // Modifier presses never arm a drag session (Pitfall 6): Cmd/Ctrl/Shift
    // clicks are selection gestures handled by handleRotoCellClick.
    if (!event.isPrimary || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || rotoDragLocked || !physicalActions || rotoDragGestureRef.current) return;
    const sourceElement = event.currentTarget as HTMLButtonElement;
    // Group drag arming (D-06): grabbing a real key that is part of a
    // >= 2 selection starts a group session; grabbing an unselected real
    // key while a multi-selection exists first collapses the selection to
    // that key and follows the unchanged single-key path (UI-SPEC).
    const selectedSet = new Set(props.rotoSelectedKeyIds ?? []);
    const groupDrag = selectedSet.size >= 2 && selectedSet.has(movedKeyId);
    if (!groupDrag && selectedSet.size >= 2 && !selectedSet.has(movedKeyId)) {
      props.onCollapseRotoSelectionToKey?.(movedKeyId);
    }
    let active = true;
    const session: RotoDragGestureSession = {
      pointerId: event.pointerId,
      movedKeyId,
      sourceAppFrame,
      sourceElement,
      originX: event.clientX,
      originY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
      started: false,
      groupDrag,
      candidateTarget: null,
      candidateKind: 'outside',
      candidateValid: false,
      candidateError: null,
      candidateConflicts: null,
      candidateDetail: null,
      publication: null,
      rafId: null,
      lastRafTime: null,
      validityKey: rotoDragValidityKey,
      cleanup: () => {},
    };
    const clearSuppressionSoon = () => window.setTimeout(() => { suppressNextRotoClickRef.current = false; }, 0);
    // Focus restoration helpers (D-24). On cancellation or failed settlement,
    // restore focus to the source keyId when it still exists after rollback;
    // if it no longer exists (launch replaced), leave focus on the timeline
    // container rather than guessing a nearest frame.
    const restoreSourceFocus = () => {
      if (!mountedRef.current) return;
      const scroller = timelineScrollRef.current;
      if (!scroller) return;
      const sourceCell = findRotoKeyCellByKeyId(scroller, session.movedKeyId);
      if (sourceCell) {
        sourceCell.focus();
      } else {
        // Source identity no longer mounted (launch replaced/disposed). Leave
        // focus on the stable timeline container rather than guessing.
        scroller.focus();
      }
    };
    const cleanup = () => {
      if (!active) return;
      active = false;
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('keydown', handleEscape, true);
      sourceElement.removeEventListener('lostpointercapture', handleLostPointerCapture);
      if (session.rafId !== null) window.cancelAnimationFrame(session.rafId);
      session.rafId = null;
      if (sourceElement.hasPointerCapture(session.pointerId)) sourceElement.releasePointerCapture(session.pointerId);
      if (rotoDragGestureRef.current === session) rotoDragGestureRef.current = null;
      // Always clear the transient preview on cleanup. The valid-release
      // pointer-up path sets its pending preview AFTER cleanup so the
      // committing state survives. Every other path (invalid release,
      // Escape, pointercancel, lostpointercapture, validity-key change,
      // unmount) clears the preview here. Idempotent across repeat calls.
      if (mountedRef.current) setRotoDragPreview(null);
    };
    const beginDrag = () => {
      if (session.started) return;
      session.started = true;
      try {
        sourceElement.setPointerCapture(session.pointerId);
      } catch {
        session.started = false;
        cleanup();
        return;
      }
      suppressNextRotoClickRef.current = true;
      updateRotoDragCandidate(session);
      startRotoEdgeScroll(session);
    };
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== session.pointerId || rotoDragGestureRef.current !== session) return;
      session.latestX = moveEvent.clientX;
      session.latestY = moveEvent.clientY;
      if (!session.started && Math.hypot(session.latestX - session.originX, session.latestY - session.originY) >= ROTO_DRAG_THRESHOLD_PX) beginDrag();
      if (session.started) {
        moveEvent.preventDefault();
        updateRotoDragCandidate(session);
      }
    };
    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== session.pointerId || rotoDragGestureRef.current !== session) return;
      session.latestX = upEvent.clientX;
      session.latestY = upEvent.clientY;
      if (!session.started) {
        cleanup();
        return;
      }
      upEvent.preventDefault();
      // Re-hit-test the release target and require signature equality with
      // the retained publication (D-09). A changed, missing, invalid, or
      // stale release target cancels rather than committing an unseen
      // proposal.
      const release = classifyRotoDragTarget(session.latestX, session.latestY, session.movedKeyId, session.sourceAppFrame);
      const retainedPublication = session.publication;
      const releaseMatchesRetained = release.valid && release.target !== null && retainedPublication !== null && targetSignaturesEqual(release.target, retainedPublication.targetSignature);
      if (!releaseMatchesRetained) {
        cleanup();
        clearSuppressionSoon();
        // Release-time group-drag reject publication (D-07/D-09, 37-03
        // contract): fires exactly once per rejected group release and only
        // for resolver-level failures (candidateDetail non-null).
        // Classification-level invalids (outside/locked) and single-key
        // releases stay silent exactly as before.
        if (session.groupDrag && session.candidateDetail !== null) {
          props.onRotoGroupDragRejected?.(session.candidateError ?? 'Move rejected — key in the way', session.candidateDetail);
        }
        // Restore focus to the source identity (D-24). No coordinator call.
        restoreSourceFocus();
        return;
      }
      // Keep the exact complete proposal visible as committing while the
      // coordinator acknowledges the mutation (D-09/D-24). Set the pending
      // preview AFTER cleanup so it survives cleanup's preview clear.
      cleanup();
      if (mountedRef.current) {
        setRotoDragPreview({
          movedKeyId: session.movedKeyId,
          sourceAppFrame: session.sourceAppFrame,
          publication: retainedPublication,
          candidateKind: session.candidateKind,
          candidateValid: true,
          error: null,
          pending: true,
          groupDrag: session.groupDrag,
          conflictingAppFrames: session.candidateConflicts,
        });
      }
      clearSuppressionSoon();
      const commitPublication = session.groupDrag
        ? physicalActions!.commitRotoKeyGroupDrag(retainedPublication!)
        : physicalActions!.commitRotoKeyDrag(retainedPublication!);
      void commitPublication.then((accepted) => {
        if (!mountedRef.current) return;
        setRotoDragPreview(null);
        if (!accepted) {
          // Failed settlement: restore focus to the source identity after
          // complete rollback (D-24). No history command is recorded.
          restoreSourceFocus();
          return;
        }
        // Focus follows the moved identity at its accepted appFrame (D-24).
        // The proposal IS the accepted state (coordinator revalidates and
        // accepts it unchanged), so proposal.mapping is authoritative.
        const movedAppFrame = retainedPublication!.proposal.mapping.get(session.movedKeyId) ?? null;
        if (movedAppFrame === null) return;
        const scroller = timelineScrollRef.current;
        const targetCell = scroller ? findRotoKeyCellByKeyId(scroller, session.movedKeyId) : null;
        if (targetCell) {
          targetCell.focus();
        } else {
          // Fallback: focus the cell at the accepted appFrame.
          timelineScrollRef.current?.querySelector<HTMLElement>(`[data-roto-app-frame="${movedAppFrame}"]`)?.focus();
        }
      }).catch(() => {
        if (mountedRef.current) {
          setRotoDragPreview(null);
          restoreSourceFocus();
        }
      });
    };
    const handlePointerCancel = (cancelEvent: PointerEvent) => {
      if (cancelEvent.pointerId !== session.pointerId) return;
      cleanup();
      clearSuppressionSoon();
      // pointercancel is a non-committing cancellation (D-24).
      restoreSourceFocus();
    };
    const handleLostPointerCapture = () => {
      if (rotoDragGestureRef.current !== session) return;
      cleanup();
      clearSuppressionSoon();
      // lostpointercapture is a non-committing cancellation (D-24).
      restoreSourceFocus();
    };
    const handleEscape = (keyEvent: KeyboardEvent) => {
      if (keyEvent.key !== 'Escape' || rotoDragGestureRef.current !== session || !session.started) return;
      keyEvent.preventDefault();
      keyEvent.stopImmediatePropagation();
      cleanup();
      clearSuppressionSoon();
      // Escape is a non-committing cancellation (D-24).
      restoreSourceFocus();
    };
    session.cleanup = cleanup;
    rotoDragGestureRef.current = session;
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('keydown', handleEscape, true);
    sourceElement.addEventListener('lostpointercapture', handleLostPointerCapture);
  }, [classifyRotoDragTarget, physicalActions, props.rotoSelectedKeyIds, props.onCollapseRotoSelectionToKey, props.onRotoGroupDragRejected, rotoDragLocked, rotoDragValidityKey, startRotoEdgeScroll, updateRotoDragCandidate]);
  const rotoCellPointerDownRef = useRef(handleRotoCellPointerDownCurrent);
  rotoCellPointerDownRef.current = handleRotoCellPointerDownCurrent;
  const handleRotoTimelineCellPointerDown = useCallback((event: PointerEvent, frame: number, keyId: string) => {
    rotoCellPointerDownRef.current(event, frame, keyId);
  }, []);

  useEffect(() => {
    const active = rotoDragGestureRef.current;
    if (active && active.validityKey !== rotoDragValidityKey) active.cleanup();
  }, [rotoDragValidityKey]);

  useEffect(() => () => {
    mountedRef.current = false;
    rotoDragGestureRef.current?.cleanup();
  }, []);

  useEffect(() => {
    const el = timelineScrollRef.current;
    const content = timelineContentRef.current;
    if (!el || !content) return;
    updateScrollbar();
    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(el);
    observer.observe(content);
    recordPhysicsPaintPerformanceCounter('observer.timeline.resize.install');
    return () => {
      recordPhysicsPaintPerformanceCounter('observer.timeline.resize.cleanup');
      observer.disconnect();
    };
  }, [updateScrollbar]);

  useLayoutEffect(() => {
    updateScrollbar();
  }, [frameCells, currentPhysicalCells, updateScrollbar]);

  // Plain-wheel horizontal scrolling (38-10, 38.1-06 deferred follow-up #2):
  // a vertical wheel delta over the timeline scroller drives scrollLeft.
  // Guards, in order: Shift+wheel returns immediately (the browser's native
  // shift-wheel horizontal mapping keeps working byte-identically); a
  // horizontally dominant delta returns immediately (trackpad two-finger pans
  // keep fully native behavior — no preventDefault, no writes). Line-mode
  // wheels (e.g. Firefox) are normalized at 16px per line. The
  // handler writes DOM scrollLeft ONLY — never a state setter — so the custom
  // thumb follows through the existing native scroll -> onScroll ->
  // updateScrollbar path (single sync path, no double derivation, no rAF
  // throttle, zero render-path timing change per 38.1 D-04). Wheel events at
  // the scroll extremes are still consumed while hovering the strip: page
  // scroll-while-hovering-the-strip would be surprising. Listener discipline
  // matches the styled-tooltip Escape listener (38-05): one registration on
  // the scroller element only, removed in cleanup, mountedRef-guarded.
  useLayoutEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    const handleTimelineWheel = (event: WheelEvent) => {
      if (!mountedRef.current) return;
      if (event.shiftKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      el.scrollLeft += event.deltaY * (event.deltaMode === 1 ? 16 : 1);
    };
    el.addEventListener('wheel', handleTimelineWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleTimelineWheel);
  }, []);

  function handleTimelineScrollbarPointerDown(event: PointerEvent) {
    const el = timelineScrollRef.current;
    const target = event.currentTarget as HTMLElement;
    if (!el) return;
    const rect = target.getBoundingClientRect();
    const thumbLeft = scrollbar.left;
    const thumbRight = scrollbar.left + scrollbar.width;
    const pointerX = event.clientX - rect.left;
    const thumbOffset = pointerX >= thumbLeft && pointerX <= thumbRight ? pointerX - thumbLeft : scrollbar.width / 2;
    const scrollFromPointer = (clientX: number) => {
      const x = Math.max(0, Math.min(rect.width - scrollbar.width, clientX - rect.left - thumbOffset));
      const maxScroll = el.scrollWidth - el.clientWidth;
      const maxThumb = rect.width - scrollbar.width;
      el.scrollLeft = maxThumb > 0 ? (x / maxThumb) * maxScroll : 0;
      updateScrollbar();
    };
    target.setPointerCapture(event.pointerId);
    scrollFromPointer(event.clientX);
    const handlePointerMove = (moveEvent: PointerEvent) => scrollFromPointer(moveEvent.clientX);
    const handlePointerUp = (upEvent: PointerEvent) => {
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener('pointermove', handlePointerMove);
      target.removeEventListener('pointerup', handlePointerUp);
      target.removeEventListener('pointercancel', handlePointerUp);
    };
    target.addEventListener('pointermove', handlePointerMove);
    target.addEventListener('pointerup', handlePointerUp);
    target.addEventListener('pointercancel', handlePointerUp);
  }

  // Blocked-direction verdict while a drag is live: the dragged direction has
  // zero valid movement — the not-allowed cursor + guarded tooltip show for
  // that direction only, and the other direction stays available (tool armed).
  const pushHoverInvalid = pushDragBlocked.value !== null;
  const pushHoverGuardCopy = pushDragBlocked.value?.reason ?? '';
  const isSelectedPushRail = (rail: PushPreviewRail): boolean => {
    if (rail.kind === 'key-rail') {
      return props.selectedRotoKeyRail?.firstKeyId === rail.id;
    }
    return (props.selectedRotoLoopClipIds ?? []).includes(rail.id);
  };
  const pushHoverRailKindClass = (rail: PushPreviewRail): string => {
    if (rail.kind === 'key-rail') return ' key-rail';
    return rail.clip?.mode === 'static' ? ' mode-static' : '';
  };
  const pushGhostRailKindClass = (rail: PushPreviewRail): string => {
    if (rail.kind === 'key-rail') return ' key-rail';
    return rail.clip?.mode === 'static' ? ' mode-static' : '';
  };
  return (
    <section
      class={`physics-paint-workflow-strip${pushArmed ? ' physics-paint-push-armed' : ''}`}
      data-push-paint-tick={pushPaintTick.value}
      aria-label="Physics Paint workflow strip"
    >
      <PhysicsPaintWorkflowStaticChrome
        currentFrame={currentFrameSignal}
        capsuleText={capsuleTextSignal}
        ready={props.ready !== false}
        playbackAvailable={Boolean(props.rotoCachedPlaybackAvailable)}
        playbackActive={Boolean(props.isRotoCachedPlaybackActive)}
        playbackTick={props.rotoCachedPlaybackTick}
        playbackLoop={Boolean(props.rotoCachedPlaybackLoop)}
        playbackFps={props.rotoCachedPlaybackFps ?? 0}
        projectFps={props.projectFps ?? 1}
        interpolationEnabled={interpolationEnabled}
        interpolationMode={interpolationMode}
        interpolationPending={Boolean(props.rotoInterpolationPending)}
        interpolationControlsDisabled={interpolationControlsDisabled}
        interpolationStatus={interpolationStatus}
        onTogglePlayback={props.onToggleRotoPlayback}
        onPlaybackLoopChange={props.onRotoPlaybackLoopChange}
        onPlaybackFpsChange={props.onRotoPlaybackFpsChange}
        audioPreviewEnabled={props.audioPreviewEnabled}
        onAudioPreviewToggle={props.onAudioPreviewToggle}
        onInterpolationEnabledChange={props.onRotoInterpolationEnabledChange}
        onInterpolationModeChange={props.onRotoInterpolationModeChange}
        onGoToFirstFrame={props.onGoToFirstFrame}
        onGoToPreviousFrame={props.onGoToPreviousFrame}
        onGoToNextFrame={props.onGoToNextFrame}
        onGoToLastFrame={props.onGoToLastFrame}
        onClose={props.onClose}
        mutationLocked={Boolean(props.mutationLocked)}
        forceSpacingInput={forceSpacingInput}
        forceSpacingControlsPresent={Boolean(physicalActions)}
        canApplyForceSpacing={canApplyForceSpacingAction}
        forceSpacingActionDisabledReason={forceSpacingActionDisabledReason}
        onForceSpacingInput={handleForceSpacingInput}
        onForceSpacingSubmit={handleForceSpacingSubmit}
      />

      <div class="physics-paint-timeline" aria-label="Physics Paint timeline">
        <div ref={timelineScrollRef} class="physics-paint-timeline-scroll" tabIndex={-1} onScroll={updateScrollbar}>
          <div class="physics-paint-ruler" style={{ width: `${rotoLaneWidthPx}px`, minWidth: `${rotoLaneWidthPx}px` }} aria-hidden="true">
            {rotoRulerTicks.map(frame => (
              <span key={frame} class="physics-paint-ruler-tick">{frame}</span>
            ))}
          </div>

            <div
              ref={timelineContentRef}
              class="physics-paint-lane"
              data-push-armed={pushArmed ? 'true' : undefined}
              data-push-hover-invalid={pushHoverInvalid ? 'true' : undefined}
              onPointerDownCapture={handleLanePushPointerDownCapture}
              onClickCapture={handleLanePushClickCapture}
              style={{
                width: `${rotoLaneWidthPx}px`,
                minWidth: `${rotoLaneWidthPx}px`,
                gridTemplateColumns: `${rotoLaneWidthPx}px`,
              }}
            >
              {keyRailSegments.length > 0 ? (
                <PhysicsPaintKeyRail
                  segments={keyRailSegments}
                  visibleFrameWindow={{ startFrame: frameCells[0]!, endFrameExclusive: frameCells[frameCells.length - 1]! + 1 }}
                  framePitch={ROTO_CELL_WIDTH_PX}
                  selectedKeyRail={props.selectedRotoKeyRail ?? null}
                  onSelectKeyRail={props.onSelectRotoKeyRail ?? NOOP_KEY_RAIL_SELECTION}
                  prepareKeyRailDrag={physicalActions?.prepareKeyRailDrag}
                  commitKeyRailDrag={physicalActions?.commitKeyRailDrag}
                  getClampInput={getRotoKeyRailDragClampInput}
                  onKeyRailDragRejected={props.onRotoKeyRailDragRejected}
                  onPreviewChange={setRotoKeyRailDragPreview}
                  dragUnavailableReason={keyUtilitiesDisabledByBusyState
                    ? ROTO_KEY_BUSY_STATUS_TEMPLATE
                    : undefined}
                  deleteUnavailableReason={deleteRotoKeyDisabledReason}
                  busy={keyUtilitiesDisabledByBusyState}
                  onRailFocus={handleKeyRailFocus}
                />
              ) : null}
              {loopResolutionContext !== null
                && loopResolutionContext.ranges.length > 0
                && props.onSelectRotoLoopClip
                && props.onOpenRotoLoopEdit ? (
                <PhysicsPaintLoopClipRail
                  ranges={loopResolutionContext.ranges}
                  presentations={props.rotoLoopPresentations ?? EMPTY_LOOP_PRESENTATIONS}
                  visibleFrameWindow={{ startFrame: frameCells[0]!, endFrameExclusive: frameCells[frameCells.length - 1]! + 1 }}
                  framePitch={ROTO_CELL_WIDTH_PX}
                  selectedLoopClipIds={props.selectedRotoLoopClipIds ?? []}
                  linkedLoopClipIds={props.linkedRotoLoopClipIds ?? []}
                  linkedActionName={props.linkedRotoActionName ?? null}
                  onSelectLoopClip={props.onSelectRotoLoopClip}
                  onOpenLoopEdit={props.onOpenRotoLoopEdit}
                  prepareRotoGroupDrag={physicalActions?.prepareRotoGroupDrag}
                  commitRotoGroupDrag={physicalActions?.commitRotoGroupDrag}
                  getClampInput={getRotoGroupDragClampInput}
                  onRotoGroupDragRejected={(reason, detail) => props.onRotoGroupDragRejected?.(reason, detail ?? '')}
                  onPreviewChange={setRotoGroupDragPreview}
                />
              ) : null}
              <div
                class="physics-paint-roto-cells"
                role="row"
                style={{ gridTemplateColumns: `repeat(${frameCells.length}, ${ROTO_CELL_WIDTH_PX}px)` }}
              >
                {frameCells.map(frame => {
                  const semanticCell = physicalCellByAppFrame.get(frame) ?? null;
                  const isGenerated = semanticCell?.kind === 'generated';
                  // Phase 43: lazy per-frame resolution for this visible cell
                  // (null when no loop context is supplied). Exhaustive mappers
                  // gate every virtual linked occurrence out of selection/drag
                  // (D-11/D-23) while preserving the existing cell-state fill
                  // (D-18). The local badge/aria predicate intentionally groups
                  // the four linked variants as presentation-only occurrences.
                  const frameResolution = visibleFrameResolutions?.get(frame) ?? null;
                  const spacingProxy = visibleSpacingProxies?.get(frame) ?? null;
                  const isSpacingProxySelected = spacingProxy !== null
                    && props.rotoSpacingSelection?.sourceCycleId === spacingProxy.sourceCycleId
                    && rotoSpacingSelectedSourceKeyIdSet.has(spacingProxy.sourceKeyId);
                  const isLoopBoundaryStart = loopBoundaryFrames.starts.has(frame);
                  const isLoopBoundaryEnd = loopBoundaryFrames.ends.has(frame);
                  const hasLinkedLoopBadge = frameResolution?.kind === 'linked'
                    || frameResolution?.kind === 'linked-generated'
                    || frameResolution?.kind === 'linked-gap'
                    || frameResolution?.kind === 'linked-unresolved';
                  const isLinkedRepeat = frameResolution?.kind === 'linked-unresolved'
                    || ((frameResolution?.kind === 'linked'
                      || frameResolution?.kind === 'linked-generated'
                      || frameResolution?.kind === 'linked-gap')
                      && frameResolution.repeatInstance > 0);
                  const isLinkedRepeatSourceKey = frameResolution?.kind === 'linked'
                    && frameResolution.repeatInstance > 0
                    && !isGenerated;
                  const linkedLoopClass = isLinkedRepeat
                    ? isLinkedRepeatSourceKey ? 'roto-linked-repeat roto-linked-repeat-source-key' : 'roto-linked-repeat'
                    : frameResolution?.kind === 'linked-generated' || (frameResolution?.kind === 'linked' && isGenerated)
                      ? 'roto-linked-source-generated'
                      : frameResolution?.kind === 'linked' ? 'roto-linked-source-key'
                        : frameResolution?.kind === 'linked-gap' ? 'roto-linked-source-gap'
                          : '';
                  const frameInteraction = frameResolution === null ? null : getRotoFrameKeyInteraction(frameResolution);
                  // Cached per-cell derivation (38.1-04, Option A): recomputed
                  // for at most the previous+new current cells on a pure frame
                  // change; the value is byte-identical to the pre-cache
                  // inline derivation.
                  const { vm, fill } = getRotoCellDerivation(frame);
                  const isPhysicalRealKey = semanticCell?.kind === 'real';
                  const lifecycleTarget = lifecycleTargetByAppFrame.get(frame)!;
                  const fillClass = getRotoAcceptedCellFillClass({
                    lifecycleTargetKind: lifecycleTarget.kind,
                    resolutionKind: frameResolution?.kind ?? 'empty',
                    isPhysicalRealKey,
                    fill,
                    viewModelFillClass: vm.fillClass,
                  });
                  const isOccupiedRealKey = isPhysicalRealKey;
                  const semanticKind = isGenerated ? 'generated' : isOccupiedRealKey ? 'real-key' : 'empty';
                  const generatedTitle = isGenerated ? getGeneratedRotoTitle(frame) : null;
                  const cellKeyId = semanticCell?.kind === 'real' ? semanticCell.keyId : keyIdByAppFrame.get(frame) ?? null;
                  const dragEligible = isPhysicalRealKey && spacingProxy === null && !rotoDragLocked && frameInteraction?.dragEligible !== false;
                  // Identity-based Drag preview (D-07/D-21/D-22/D-23/D-24).
                  const previewCell = rotoDragPreviewViewModel?.cellsByAppFrame.get(frame) ?? null;
                  const isDragSource = rotoDragPreview?.sourceAppFrame === frame && rotoDragPreview?.movedKeyId === cellKeyId;
                  const isDragMoved = previewCell?.role === 'moved';
                  const isDragShifted = previewCell?.role === 'shifted';
                  const isDragTarget = previewCell?.role === 'target';
                  const isDragGenerated = previewCell?.role === 'generated';
                  const isDragVacated = rotoDragVacatedAppFrames.has(frame);
                  const isDragCommitting = Boolean(rotoDragPreview?.pending && rotoDragPreviewViewModel);
                  const hasTargetFeedback = Boolean(rotoDragFeedback && (isDragMoved || isDragShifted || isDragTarget || isDragGenerated || isDragVacated || isDragSource));
                  const dragLabel = hasTargetFeedback
                    ? (previewCell?.ariaLabel ?? rotoDragFeedback ?? vm.ariaLabel)
                    : dragEligible ? `${vm.ariaLabel} Drag this real Roto key to an empty frame.` : generatedTitle ?? vm.ariaLabel;
                  const existingCellTooltipKind: RotoCellSemanticTooltipKind = isPhysicalRealKey
                    ? 'real-key'
                    : isGenerated
                      ? 'generated'
                      : vm.baseMeaning === 'cached'
                        ? 'cached'
                        : vm.baseMeaning === 'background-only'
                          ? 'background-only'
                          : 'empty';
                  // D-18: linked cells keep their existing cell-state fill,
                  // while tooltip/aria copy comes from the typed resolution and
                  // the one compact loopId → source-frame-count index above.
                  const cellTooltipKind: RotoCellSemanticTooltipKind = frameResolution === null
                    ? existingCellTooltipKind
                    : getRotoResolutionCellTooltipKind(frameResolution, existingCellTooltipKind);
                  const baseCellTooltipCopy = frameResolution === null
                    ? getRotoCellStateTooltipCopy(existingCellTooltipKind)
                    : getRotoResolutionCellTooltipCopy(frameResolution, existingCellTooltipKind, loopSourceFrameCountById);
                  // Real keys use primary-versus-complete selection treatment;
                  // non-real cells keep the cursor unless Select All owns selection.
                  const isCurrentFrame = vm.overlays.includes('current');
                  const isPrimarySelected = !isSpacingProxySelected
                    && cellKeyId !== null
                    && props.rotoPrimarySelectedKeyId === cellKeyId;
                  const isSecondarySelected = !isSpacingProxySelected
                    && cellKeyId !== null
                    && rotoSelectedKeyIdSet.has(cellKeyId)
                    && rotoSelectedKeyIdSet.size >= 2
                    && !isPrimarySelected;
                  const hasReplacementSelection = props.rotoPrimarySelectedKeyId === null && rotoSelectedKeyIdSet.size >= 2;
                  const hasCurrentTreatment = cellKeyId === null ? isCurrentFrame && !hasReplacementSelection : isPrimarySelected;
                  const cellBaseTooltipCopy = isSpacingProxySelected
                    ? projectPhysicsPaintGroupProductReason('spacing-source-selected')
                    : isSecondarySelected
                      ? getRotoCellSelectedTooltipCopy(cellTooltipKind)
                      : baseCellTooltipCopy;
                  const cellBaseAriaLabel = isSpacingProxySelected
                    ? `${baseCellTooltipCopy} · Frame ${frame}. ${projectPhysicsPaintGroupProductReason('spacing-source-selected')}`
                    : hasLinkedLoopBadge
                      ? `${baseCellTooltipCopy} · Frame ${frame}`
                      : isSecondarySelected
                        ? `${dragLabel} Selected.`
                        : dragLabel;
                  const cellPresentation = getRotoCellPresentationViewModel({
                    kind: hasLinkedLoopBadge ? 'linked' : isPhysicalRealKey ? 'real' : isGenerated ? 'generated' : 'empty',
                    keyId: cellKeyId,
                    orderedRealKeyIds: realKeyOrderById,
                    incomingInterpolationBreakKeyIds: incomingInterpolationBreakKeyIdSet,
                    baseCopy: cellBaseTooltipCopy,
                    ariaLabel: cellBaseAriaLabel,
                  });
                  const cellAriaLabel = cellPresentation.ariaLabel;
                  const cellTooltipCopy = cellPresentation.tooltipCopy;
                  // UI-SPEC G3: Group-drag gap-preview frames paint as ordinary
                  // roto-fill-empty cells, byte-identical to the 43.2 deleted-Group
                  // gap treatment (D-02). Class application only — no new DOM nodes.
                  const isRotoGroupDragGapPreview = rotoGroupDragGapPreviewAppFrames.has(frame);
                  const isRotoKeyRailDragGapPreview = rotoKeyRailDragGapPreviewAppFrames.has(frame);
                  // 43.5-05 Task 2 (T5): the push would-open gap previews as
                  // ordinary roto-fill-empty cells, byte-identical to the
                  // 43.2/43.3/43.4 gap treatment (D-12 preview obligation).
                  const isPushGapPreview = pushGapPreviewAppFrames.has(frame);
                  const effectiveFillClass = isRotoGroupDragGapPreview || isRotoKeyRailDragGapPreview || isPushGapPreview
                    ? 'roto-fill-empty' : fillClass;
                  const cellClass = `physics-paint-roto-cell ${effectiveFillClass} ${hasLinkedLoopBadge ? `roto-linked-loop-badge ${linkedLoopClass}` : ''} ${cellPresentation.startsInterpolationSegment ? 'starts-interpolation-segment' : ''} ${isLoopBoundaryStart ? 'roto-loop-boundary-start' : ''} ${isLoopBoundaryEnd ? 'roto-loop-boundary-end' : ''} ${isOccupiedRealKey ? 'occupied' : ''} ${isPhysicalRealKey || isSavedFrame(props.savedRotoFrames, frame) ? 'saved' : ''} ${vm.overlays.includes('dirty') ? 'dirty' : ''} ${vm.overlays.includes('pending') ? 'pending' : ''} ${hasCurrentTreatment ? 'current' : ''} ${isSecondarySelected ? 'selected' : ''} ${isSpacingProxySelected ? 'roto-spacing-proxy-selected' : ''} ${dragEligible ? 'roto-drag-eligible' : ''} ${isDragSource ? 'roto-drag-source' : ''} ${isDragMoved ? 'roto-drag-moved' : ''} ${isDragShifted ? 'roto-drag-shifted' : ''} ${isDragTarget ? 'roto-drag-target' : ''} ${isDragGenerated ? 'roto-drag-generated' : ''} ${isDragVacated ? 'roto-drag-vacated' : ''} ${isDragTarget && previewCell?.targetBoundary === 'before' ? 'roto-drag-target-before' : ''} ${isDragTarget && previewCell?.targetBoundary === 'after' ? 'roto-drag-target-after' : ''} ${rotoDragPreview && !rotoDragPreview.candidateValid && rotoDragPreview.publication === null && (isDragMoved || isDragSource) ? 'roto-drag-target-invalid' : ''} ${rotoDragPreview?.groupDrag && rotoDragPreview.conflictingAppFrames?.includes(frame) ? 'roto-drag-target-blocked' : ''} ${rotoDragPreview?.groupDrag && !rotoDragPreview.candidateValid && isDragSource ? 'roto-drag-cannot-drop' : ''} ${isDragCommitting ? 'roto-drag-committing' : ''}`;
                  return (
                    <RotoTimelineCellButton
                      key={frame}
                      frame={frame}
                      vm={vm}
                      cellClass={cellClass}
                      semanticKind={semanticKind}
                      cellKeyId={cellKeyId}
                      dragEligible={dragEligible}
                      startsInterpolationSegment={cellPresentation.startsInterpolationSegment}
                      ariaLabel={cellAriaLabel}
                      ariaSelected={isSpacingProxySelected || isSecondarySelected}
                      tooltipCopy={cellTooltipCopy}
                      onCellPointerDown={handleRotoTimelineCellPointerDown}
                      onCellClick={handleRotoTimelineCellClick}
                    />
                  );
                })}
              </div>
              {/* 43.5-05 design revision: armed anchor pre-highlight — the
                  selected Rail shows the prospective-set treatment as soon as
                  armed (the direction is chosen by the drag, so no pivot tick
                  until the drag locks it). On drag start the per-rail ghosts
                  take over. */}
              {pushArmedAnchorRail !== null && !pushDragGhost.active ? (
                <div class="physics-paint-push-hover-layer" aria-hidden="true">
                  <span
                    class={`physics-paint-push-hover-rail${pushHoverRailKindClass(pushArmedAnchorRail)}`}
                    style={{
                      left: `${(pushArmedAnchorRail.intervalStart - frameCells[0]) * ROTO_CELL_WIDTH_PX}px`,
                      width: `${Math.max(ROTO_CELL_WIDTH_PX, (pushArmedAnchorRail.intervalEndExclusive - pushArmedAnchorRail.intervalStart) * ROTO_CELL_WIDTH_PX)}px`,
                    }}
                  />
                </div>
              ) : null}
              {/* 43.5-05 Task 2 push ghost layer (T5): every moved-set rail
                  ghosts at 55% kind-color opacity at the clamped destination
                  (original interval + the hook's clamped signed delta — rigid
                  translation, never recomputed here); the clamped blocked edge
                  paints the 2x12px #FF6B6B bar on the set's outermost ghost
                  edge. Originals stay at 100% until exact parent
                  acknowledgement (Pitfall 9). */}
              {pushDragGhost.active ? (
                <div class="physics-paint-push-ghost-layer" aria-hidden="true">
                  {pushSessionRef.current?.movedRails.map((rail) => {
                    if (isSelectedPushRail(rail)) return null;
                    const left = (rail.intervalStart + pushDragGhost.deltaFrames - frameCells[0]) * ROTO_CELL_WIDTH_PX;
                    const width = Math.max(ROTO_CELL_WIDTH_PX, (rail.intervalEndExclusive - rail.intervalStart) * ROTO_CELL_WIDTH_PX);
                    return (
                      <span
                        key={rail.id}
                        class={`physics-paint-push-ghost${pushGhostRailKindClass(rail)}`}
                        style={{ left: `${left}px`, width: `${width}px` }}
                      />
                    );
                  })}
                  {pushDragGhost.blockedEdge !== null && pushSessionRef.current !== null ? (
                    <span
                      class="physics-paint-push-blocked-edge"
                      style={{
                        left: `${(pushDragGhost.blockedEdge === 'left'
                          ? pushSessionRef.current.movedSetBounds.firstFrame
                          : pushSessionRef.current.movedSetBounds.lastEndExclusive) * ROTO_CELL_WIDTH_PX
                          + pushDragGhost.deltaFrames * ROTO_CELL_WIDTH_PX
                          - (pushDragGhost.blockedEdge === 'right' ? 2 : 0)
                          - frameCells[0] * ROTO_CELL_WIDTH_PX}px`,
                      }}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
        </div>
        <div
          class="physics-paint-roto-action-row"
          onClickCapture={(event) => {
            // D-06/D-20: ANY other toolbar action disarms an armed Push tool —
            // except the Push buttons themselves, which own the arm/disarm
            // toggle. The Push pill lives in this row, so the guard is scoped
            // to the push-button class only.
            if (event.target instanceof Element && !event.target.closest('.physics-paint-push-tool-button')) {
              disarmPushTool();
            }
          }}
        >
              <div class="physics-paint-roto-key-identity" role="group" aria-label={`Roto layer ${props.workflowLabel ?? 'PPaint'} key ${props.currentFrame}`}>
                <span class="physics-paint-roto-key-layer">{props.workflowLabel ?? 'PPaint'}</span>
                <span class="physics-paint-roto-key-context" aria-hidden="true">Key {props.currentFrame}</span>
              </div>
              <div class="physics-paint-roto-key-utilities" role="group" aria-label={`Roto key tools for frame ${props.currentFrame}`}>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={addKeyTooltip.onPointerEnter} onPointerLeave={addKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Add key"
                    aria-disabled={!canAddRotoKey ? 'true' : undefined}
                    aria-describedby={!canAddRotoKey && addRotoKeyDisabledReason ? 'roto-key-action-reason-add' : undefined}
                    onFocus={addKeyTooltip.onFocus}
                    onBlur={addKeyTooltip.onBlur}
                    onClick={() => {
                      addKeyTooltip.hide();
                      if (!canAddRotoKey) return;
                      props.onAddRotoKey?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canAddRotoKey) event.preventDefault();
                    }}
                  >
                    <Plus size={18} aria-hidden="true" />
                    <span class="physics-paint-roto-key-icon-label">Key</span>
                  </button>
                  {!canAddRotoKey && addRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-add" class="physics-paint-sr-only">{addRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={addKeyTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy('Add key', addRotoKeyDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={insertKeyTooltip.onPointerEnter} onPointerLeave={insertKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label={insertRotoKeyDescription}
                    aria-disabled={!canInsertRotoKey ? 'true' : undefined}
                    aria-describedby={!canInsertRotoKey && insertRotoKeyDisabledReason ? 'roto-key-action-reason-insert' : undefined}
                    onFocus={insertKeyTooltip.onFocus}
                    onBlur={insertKeyTooltip.onBlur}
                    onClick={() => {
                      insertKeyTooltip.hide();
                      if (!canInsertRotoKey) return;
                      props.onInsertRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canInsertRotoKey) event.preventDefault();
                    }}
                  >
                    <BetweenVerticalStart size={18} aria-hidden="true" />
                    <span class="physics-paint-roto-key-icon-label">Insert</span>
                  </button>
                  {!canInsertRotoKey && insertRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-insert" class="physics-paint-sr-only">{insertRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={insertKeyTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy(insertRotoKeyDescription, insertRotoKeyDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={duplicateKeyTooltip.onPointerEnter} onPointerLeave={duplicateKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Duplicate key"
                    aria-disabled={!canDuplicateRotoKey ? 'true' : undefined}
                    aria-describedby={!canDuplicateRotoKey && duplicateRotoKeyDisabledReason ? 'roto-key-action-reason-duplicate' : undefined}
                    onFocus={duplicateKeyTooltip.onFocus}
                    onBlur={duplicateKeyTooltip.onBlur}
                    onClick={() => {
                      duplicateKeyTooltip.hide();
                      if (!canDuplicateRotoKey) return;
                      props.onDuplicateRotoKey?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canDuplicateRotoKey) event.preventDefault();
                    }}
                  >
                    <CopyPlus size={18} aria-hidden="true" />
                    <span class="physics-paint-roto-key-icon-label">Duplicate</span>
                  </button>
                  {!canDuplicateRotoKey && duplicateRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-duplicate" class="physics-paint-sr-only">{duplicateRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={duplicateKeyTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy('Duplicate key', duplicateRotoKeyDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={copyKeyTooltip.onPointerEnter} onPointerLeave={copyKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Copy key"
                    aria-disabled={!canCopyRotoKey ? 'true' : undefined}
                    aria-describedby={!canCopyRotoKey && copyRotoKeyDisabledReason ? 'roto-key-action-reason-copy' : undefined}
                    onFocus={copyKeyTooltip.onFocus}
                    onBlur={copyKeyTooltip.onBlur}
                    onClick={() => {
                      copyKeyTooltip.hide();
                      if (!canCopyRotoKey) return;
                      props.onCopyRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canCopyRotoKey) event.preventDefault();
                    }}
                  >
                    <ClipboardCopy size={18} aria-hidden="true" />
                    <span class="physics-paint-roto-key-icon-label">Copy</span>
                  </button>
                  {!canCopyRotoKey && copyRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-copy" class="physics-paint-sr-only">{copyRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={copyKeyTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy('Copy key', copyRotoKeyDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={cutKeyTooltip.onPointerEnter} onPointerLeave={cutKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Cut key"
                    aria-disabled={!canCutRotoKey ? 'true' : undefined}
                    aria-describedby={!canCutRotoKey && cutRotoKeyDisabledReason ? 'roto-key-action-reason-cut' : undefined}
                    onFocus={cutKeyTooltip.onFocus}
                    onBlur={cutKeyTooltip.onBlur}
                    onClick={() => {
                      cutKeyTooltip.hide();
                      if (!canCutRotoKey) return;
                      props.onCutRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canCutRotoKey) event.preventDefault();
                    }}
                  >
                    <Scissors size={18} aria-hidden="true" />
                    <span class="physics-paint-roto-key-icon-label">Cut</span>
                  </button>
                  {!canCutRotoKey && cutRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-cut" class="physics-paint-sr-only">{cutRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={cutKeyTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy('Cut key', cutRotoKeyDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={scissorKeyTooltip.onPointerEnter} onPointerLeave={scissorKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Split Key Rail"
                    aria-disabled={!canScissorRotoKey ? 'true' : undefined}
                    aria-describedby={!canScissorRotoKey && scissorRotoKeyDisabledReason ? 'roto-key-action-reason-scissor' : undefined}
                    onFocus={scissorKeyTooltip.onFocus}
                    onBlur={scissorKeyTooltip.onBlur}
                    onClick={() => {
                      scissorKeyTooltip.hide();
                      if (!canScissorRotoKey) return;
                      props.onScissorKeyRail?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canScissorRotoKey) event.preventDefault();
                    }}
                  >
                    <SquareSplitHorizontal size={18} aria-hidden="true" />
                    <span class="physics-paint-roto-key-icon-label">Scissor</span>
                  </button>
                  {!canScissorRotoKey && scissorRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-scissor" class="physics-paint-sr-only">{scissorRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={scissorKeyTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy('Split the Key Rail before this key.', scissorRotoKeyDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={pasteKeyTooltip.onPointerEnter} onPointerLeave={pasteKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Paste key"
                    aria-disabled={!canPasteRotoKey ? 'true' : undefined}
                    aria-describedby={!canPasteRotoKey && pasteRotoKeyDisabledReason ? 'roto-key-action-reason-paste' : undefined}
                    onFocus={pasteKeyTooltip.onFocus}
                    onBlur={pasteKeyTooltip.onBlur}
                    onClick={() => {
                      pasteKeyTooltip.hide();
                      if (!canPasteRotoKey) return;
                      props.onPasteRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canPasteRotoKey) event.preventDefault();
                    }}
                  >
                    <ClipboardPaste size={18} aria-hidden="true" />
                    <span class="physics-paint-roto-key-icon-label">Paste</span>
                  </button>
                  {!canPasteRotoKey && pasteRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-paste" class="physics-paint-sr-only">{pasteRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={pasteKeyTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy('Paste key', pasteRotoKeyDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={selectAllTooltip.onPointerEnter} onPointerLeave={selectAllTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button"
                    aria-label="Select all keys"
                    aria-disabled={!canSelectAllRotoKeys ? 'true' : undefined}
                    aria-describedby={!canSelectAllRotoKeys && selectAllDisabledReason ? 'roto-key-action-reason-select-all' : undefined}
                    onFocus={selectAllTooltip.onFocus}
                    onBlur={selectAllTooltip.onBlur}
                    onClick={() => {
                      selectAllTooltip.hide();
                      if (!canSelectAllRotoKeys) return;
                      props.onSelectAllRotoKeys?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canSelectAllRotoKeys) event.preventDefault();
                    }}
                  >
                    <ListChecks size={18} aria-hidden="true" />
                    <span class="physics-paint-roto-key-icon-label">All</span>
                  </button>
                  {!canSelectAllRotoKeys && selectAllDisabledReason ? (
                    <span id="roto-key-action-reason-select-all" class="physics-paint-sr-only">{selectAllDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={selectAllTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy('Select all keys', selectAllDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={deleteKeyTooltip.onPointerEnter} onPointerLeave={deleteKeyTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class="physics-paint-roto-key-icon-button destructive"
                    aria-label={deleteRotoScopeLabel}
                    aria-disabled={!canDeleteRotoKey ? 'true' : undefined}
                    aria-describedby={!canDeleteRotoKey && deleteRotoKeyDisabledReason ? 'roto-key-action-reason-delete' : undefined}
                    onFocus={deleteKeyTooltip.onFocus}
                    onBlur={deleteKeyTooltip.onBlur}
                    onClick={() => {
                      deleteKeyTooltip.hide();
                      if (!canDeleteRotoKey) return;
                      props.onDeleteRotoFrame?.();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && !canDeleteRotoKey) event.preventDefault();
                    }}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                  {!canDeleteRotoKey && deleteRotoKeyDisabledReason ? (
                    <span id="roto-key-action-reason-delete" class="physics-paint-sr-only">{deleteRotoKeyDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={deleteKeyTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy(deleteRotoScopeLabel, deleteRotoKeyDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
              </div>
              <div class="physics-paint-push-tool-group" role="group" aria-label="Push tool">
                <span class="physics-paint-roto-key-icon-action" onPointerEnter={pushTooltip.onPointerEnter} onPointerLeave={pushTooltip.onPointerLeave}>
                  <button
                    type="button"
                    class={`physics-paint-roto-key-icon-button physics-paint-push-tool-button${pushArmedClass}`}
                    aria-label="Push"
                    aria-pressed={pushArmed ? 'true' : 'false'}
                    aria-disabled={pushToolDisabled ? 'true' : undefined}
                    aria-describedby={pushToolDisabled ? 'roto-key-action-reason-push' : undefined}
                    onFocus={pushTooltip.onFocus}
                    onBlur={pushTooltip.onBlur}
                    onClick={() => {
                      pushTooltip.hide();
                      if (pushToolDisabled) return;
                      // Bind the anchor to the selected Rail at arm time
                      // (43.5-05 Defect 1) — never re-resolved at drag position.
                      if (!isPushToolArmed()) armedAnchorRef.current = pushAnchor;
                      togglePushTool();
                    }}
                    onKeyDown={(event) => {
                      if ((event.key === 'Enter' || event.key === ' ') && pushToolDisabled) event.preventDefault();
                    }}
                  >
                    <MoveHorizontal size={18} aria-hidden="true" />
                  </button>
                  {pushToolDisabled ? (
                    <span id="roto-key-action-reason-push" class="physics-paint-sr-only">{pushToolDisabledReason}</span>
                  ) : null}
                  <PhysicsPaintStyledTooltip visible={pushTooltip.visible} region="bottom">
                    {buildGuardedActionTooltipCopy('Push the selected Rail and everything after it. Drag right to move them right; drag left to move them left.', pushToolDisabledReason)}
                  </PhysicsPaintStyledTooltip>
                </span>
              </div>
            </div>
        <div class="physics-paint-timeline-scrollbar" onPointerDown={(event) => handleTimelineScrollbarPointerDown(event as unknown as PointerEvent)}>
          {scrollbar.visible ? (
            <span
              class="physics-paint-timeline-scrollbar-thumb"
              style={{ left: `${scrollbar.left}px`, width: `${scrollbar.width}px` }}
            />
          ) : null}
        </div>
      </div>

      {/* 43.5-05 design revision: blocked-direction guard tooltip — while a
          drag is live in a blocked direction (frame-0/capacity flush or
          straddle) the mapped reason shows verbatim (one copy owner —
          mapRotoPushProductReason). Anchored to the pointer position
          (43.5-05 Defect 2) via a zero-size viewport-fixed span, never to an
          unrelated panel element. Portaled to document.body so the timeline
          scroller cannot clip it. */}
      <span
        ref={pushBlockedAnchorRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: `${pushBlockedPointer.value?.x ?? 0}px`,
          top: `${pushBlockedPointer.value?.y ?? 0}px`,
          width: 0,
          height: 0,
        }}
      />
      <PhysicsPaintStyledTooltip visible={pushDragBlocked.value !== null} region="bottom" anchorRef={pushBlockedAnchorRef} topmost>
        {pushHoverGuardCopy}
      </PhysicsPaintStyledTooltip>
   </section>
  );
}
