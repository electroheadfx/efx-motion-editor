import { Blend, ChevronFirst, ChevronLast, ChevronsLeft, ChevronsRight, Play, RotateCcw, Square } from 'lucide-preact';

import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  getRotoCellFill, getRotoCellViewModel,
  getMissingRotoFrameStatusLabel,
  type PhysicsPaintOnionState,
  type RotoCellViewModel, type RotoMissingFrameStatusKind,
} from './physicsPaintWorkflowPresentation';
import {
  PHYSIC_PAINT_MAX_APPLY_FRAMES,
  getExpandedRotoRealKeyFrames, getRotoInterpolationSpanFrames, type RotoInterpolationSettings,
} from '../roto/physicsPaintRotoWorkflow';
import type { PhysicPaintRotoCacheFrame } from '../../../types/physicPaint';
import type { RotoKeyUtilityActionState } from '../roto/physicsPaintRotoKeyController';
import type { RotoScriptClipboardController } from '../roto/physicsPaintRotoScriptClipboard';

const GENERATED_ROTO_TITLE_TEMPLATE = 'Generated frame {frame} — render-only.';
const GENERATED_ROTO_DISABLED_STATUS_TEMPLATE = 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.';
const INTERPOLATION_ENABLED_STATUS = 'Generated in-betweens on — render-only frames refresh from real keys.';
const INTERPOLATION_DISABLED_STATUS = 'Generated in-betweens off — real Roto keys only.';
const ROTO_KEY_BUSY_STATUS_TEMPLATE = 'Finish the current key action before using key tools.';
type RotoKeyUtilityAction = 'insert' | 'duplicate' | 'copy' | 'paste' | 'delete';
export interface PhysicsPaintWorkflowRotoKeyState {
  actionAvailability: RotoKeyUtilityActionState;
  hasCopiedRotoKey: boolean;
}

export type PhysicsPaintWorkflowRotoScriptState = Pick<RotoScriptClipboardController,
  | 'availability'
  | 'hasCopiedScript'
  | 'copiedSourceFrame'
  | 'copiedStrokeCount'
  | 'applying'
  | 'applyProgress'
  | 'status'
  | 'error'
>;
const ROTO_CELL_LEGEND_ITEMS = [
  { label: 'Empty', className: 'roto-fill-empty' },
  { label: 'Cached', className: 'roto-fill-cached' },
  { label: 'Generated', className: 'roto-fill-generated' },
  { label: 'Background only', className: 'roto-fill-background-only' },
];

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
  currentFrame: number;
  isPlaying: boolean;
  ready?: boolean;
  occupiedRotoFrames?: number[];
  savedRotoFrames?: PhysicsPaintWorkflowStripFrameMarker[];
  cachedRotoFrames?: PhysicPaintRotoCacheFrame[];
  rotoInterpolationSettings?: RotoInterpolationSettings;
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
  isRotoCachedPlaybackActive?: boolean;
  onRotoInterpolationEnabledChange?: (enabled: boolean) => void;
  onRotoInterpolationCountChange?: (count: number) => void;
  onDuplicateRotoKey?: () => void;
  onInsertRotoFrame?: () => void;
  onDeleteRotoFrame?: () => void;
  onCopyRotoFrame?: () => void;
  onPasteRotoFrame?: () => void;
  hasCopiedRotoKey?: boolean;
  keyActionInFlight?: boolean;
  mutationLocked?: boolean;
  rotoKeyState?: PhysicsPaintWorkflowRotoKeyState;
  rotoScript?: PhysicsPaintWorkflowRotoScriptState;
  onCopyRotoScript?: () => void;
  onApplyRotoScript?: () => void;
  onDiscardRotoScript?: () => void;
  onNavigateToSyncedFrame: (frame: number) => void;
  onGoToFirstFrame: () => void;
  onGoToPreviousFrame: () => void;
  onGoToNextFrame: () => void;
  onGoToLastFrame: () => void;
  onOnionChange: (onion: PhysicsPaintOnionState) => void;
}

const VIRTUAL_TIMELINE_FRAME_COUNT = 120;
const RULER_STEP = 3;

function buildFrameCells(currentFrame: number): number[] {
  const visibleCount = VIRTUAL_TIMELINE_FRAME_COUNT;
  const maxStart = Math.max(0, currentFrame - Math.floor(visibleCount / 2));
  const start = Math.max(0, Math.min(maxStart, currentFrame));
  return Array.from({ length: visibleCount }, (_, index) => start + index);
}

function buildRulerTicks(frameCells: number[]): number[] {
  return frameCells.filter((frame) => frame % RULER_STEP === 0);
}



function isOccupiedFrame(frames: number[] | undefined, frame: number): boolean {
  return Boolean(frames?.includes(frame));
}

function isSavedFrame(markers: PhysicsPaintWorkflowStripFrameMarker[] | undefined, frame: number): boolean {
  return Boolean(markers?.some(marker => marker.frame === frame && marker.saved !== false && marker.source !== 'generated-interpolation'));
}

function getRealRotoFrames(occupiedFrames: number[] | undefined, savedFrames: PhysicsPaintWorkflowStripFrameMarker[] | undefined, cachedFrames: PhysicPaintRotoCacheFrame[] | undefined): number[] {
  return Array.from(new Set([
    ...(occupiedFrames ?? []),
    ...(savedFrames ?? []).filter(marker => marker.source !== 'generated-interpolation').map(marker => marker.frame),
    ...(cachedFrames ?? []).filter(marker => marker.source !== 'generated-interpolation').map(marker => marker.appFrame),
  ])).filter(frame => Number.isInteger(frame) && frame >= 0).sort((a, b) => a - b);
}

function normalizeRotoCacheForDisabledInterpolation(cachedFrames: PhysicPaintRotoCacheFrame[] | undefined): PhysicPaintRotoCacheFrame[] {
  return (cachedFrames ?? [])
    .filter(frame => frame.source !== 'generated-interpolation')
    .map((frame) => {
      if (frame.source !== 'real-key') return { ...frame };
      const sourceFrame = frame.sourceFrame ?? frame.appFrame;
      return { ...frame, appFrame: sourceFrame, sourceFrame, displayFrame: sourceFrame };
    })
    .sort((a, b) => a.appFrame - b.appFrame || a.frameIndex - b.frameIndex);
}

function getDisplayRotoCacheFrames(cachedFrames: PhysicPaintRotoCacheFrame[] | undefined, interpolationEnabled: boolean): PhysicPaintRotoCacheFrame[] {
  return interpolationEnabled ? [...(cachedFrames ?? [])] : normalizeRotoCacheForDisabledInterpolation(cachedFrames);
}

function getSelectedRotoCustomSpanStatus(currentFrame: number, settings: RotoInterpolationSettings): string | null {
  const customSpan = settings.segmentSpacingOverrides?.find((override) => (
    currentFrame >= override.fromSourceFrame && currentFrame <= override.toSourceFrame
  ));
  return customSpan ? `Custom span: ${customSpan.inBetweenCount} in-betweens` : null;
}

function getRotoFillClass(fill: ReturnType<typeof getRotoCellFill>): string {
  return fill === 'cached-only' ? 'roto-fill-cached-only' : 'roto-fill-empty';
}

export function PhysicsPaintWorkflowStrip(props: PhysicsPaintWorkflowStripProps) {
  const [pressedRotoKeyAction, setPressedRotoKeyAction] = useState<RotoKeyUtilityAction | null>(null);
  const [scrollbar, setScrollbar] = useState({ left: 0, width: 0, visible: false });
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const interpolationSettings = props.rotoInterpolationSettings ?? { enabled: false, inBetweenCount: 1, mode: 'duplicate' as const, deform: 0, position: 0 };
  const interpolationEnabled = interpolationSettings.enabled === true;
  const displayCachedRotoFrames = useMemo(() => getDisplayRotoCacheFrames(props.cachedRotoFrames, interpolationEnabled), [interpolationEnabled, props.cachedRotoFrames]);
  const materializedGeneratedRotoFrames = useMemo(() => interpolationEnabled ? displayCachedRotoFrames.filter(frame => frame.source === 'generated-interpolation').map(frame => frame.appFrame) : [], [displayCachedRotoFrames, interpolationEnabled]);
  const hasMaterializedGeneratedRotoFrames = interpolationEnabled && materializedGeneratedRotoFrames.length > 0;
  const realCachedRotoFrames = useMemo(() => displayCachedRotoFrames.filter(frame => frame.source === 'real-key'), [displayCachedRotoFrames]);
  const realCachedRotoFrameNumbers = useMemo(() => realCachedRotoFrames.map(frame => frame.appFrame), [realCachedRotoFrames]);
  const displayOccupiedRotoFrames = useMemo(() => !interpolationEnabled && realCachedRotoFrames.length > 0 ? realCachedRotoFrameNumbers : props.occupiedRotoFrames, [interpolationEnabled, props.occupiedRotoFrames, realCachedRotoFrameNumbers, realCachedRotoFrames.length]);
  const displaySavedRotoFrames = useMemo(() => !interpolationEnabled && realCachedRotoFrames.length > 0 ? realCachedRotoFrameNumbers.map((frame) => ({ frame, saved: true, label: `Frame ${frame}` })) : props.savedRotoFrames, [interpolationEnabled, props.savedRotoFrames, realCachedRotoFrameNumbers, realCachedRotoFrames.length]);
  const realRotoFrames = useMemo(() => (hasMaterializedGeneratedRotoFrames || (!interpolationEnabled && realCachedRotoFrames.length > 0)) ? realCachedRotoFrameNumbers : getRealRotoFrames(displayOccupiedRotoFrames, displaySavedRotoFrames, displayCachedRotoFrames), [displayCachedRotoFrames, displayOccupiedRotoFrames, displaySavedRotoFrames, hasMaterializedGeneratedRotoFrames, interpolationEnabled, realCachedRotoFrameNumbers, realCachedRotoFrames.length]);
  const expandedRealRotoFrames = useMemo(() => hasMaterializedGeneratedRotoFrames ? realRotoFrames.map(frame => ({ sourceFrame: frame, frame })) : getExpandedRotoRealKeyFrames(realRotoFrames, interpolationSettings), [hasMaterializedGeneratedRotoFrames, interpolationSettings, realRotoFrames]);
  const interpolationConnectors = useMemo(() => hasMaterializedGeneratedRotoFrames ? [] : getRotoInterpolationSpanFrames(realRotoFrames, interpolationSettings), [hasMaterializedGeneratedRotoFrames, interpolationSettings, realRotoFrames]);
  const generatedRotoFrames = useMemo(() => hasMaterializedGeneratedRotoFrames ? materializedGeneratedRotoFrames : interpolationConnectors.map(connector => connector.frame), [hasMaterializedGeneratedRotoFrames, interpolationConnectors, materializedGeneratedRotoFrames]);
  const expandedCurrentFrame = expandedRealRotoFrames.find(key => key.sourceFrame === props.currentFrame)?.frame ?? props.currentFrame;
  const frameCells = useMemo(() => buildFrameCells(expandedCurrentFrame), [expandedCurrentFrame]);
  const rotoRulerTicks = useMemo(() => buildRulerTicks(frameCells), [frameCells]);
  const visibleInBetweenCount = Math.max(1, Math.trunc(Number(interpolationSettings.inBetweenCount) || 1));
  const hasGeneratedInBetweens = interpolationConnectors.length > 0;
  const interpolationStatus = interpolationSettings.enabled
    ? hasGeneratedInBetweens
      ? INTERPOLATION_ENABLED_STATUS
      : 'Generated in-betweens on — save at least two real Roto keys.'
    : INTERPOLATION_DISABLED_STATUS;
  const currentRotoCell = getRotoCellViewModel({ frame: props.currentFrame, currentFrame: props.currentFrame, cachedFrames: displayCachedRotoFrames });
  const rotoMissingStatusLabel = props.rotoMissingFrameStatusKind ? getMissingRotoFrameStatusLabel({ frame: props.currentFrame, kind: props.rotoMissingFrameStatusKind }) : null;
  const currentRotoFill = getRotoCellFill(props.currentFrame, realCachedRotoFrames);
  const isCurrentRealRotoKey = realRotoFrames.includes(props.currentFrame) && currentRotoCell.isEditableTarget !== false;
  const sessionKeyAvailability = props.rotoKeyState?.actionAvailability;
  const scriptAvailability = props.rotoScript?.availability.value;
  const scriptStatus = props.rotoScript?.status.value ?? null;
  const keyUtilitiesDisabledByBusyState = props.ready === false || Boolean(props.mutationLocked) || Boolean(props.keyActionInFlight) || Boolean(sessionKeyAvailability?.busy);
  const interpolationControlsDisabled = props.ready === false || Boolean(props.mutationLocked);
  const canUseSourceRotoKey = isCurrentRealRotoKey && !keyUtilitiesDisabledByBusyState;
  const canInsertRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canInsert || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canDuplicateRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canDuplicate || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canCopyRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canCopy || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  const canPasteRotoKey = sessionKeyAvailability ? sessionKeyAvailability.canPaste && props.ready !== false : Boolean(props.hasCopiedRotoKey) && !keyUtilitiesDisabledByBusyState;
  const canDeleteRotoKey = sessionKeyAvailability ? (sessionKeyAvailability.canDelete || canUseSourceRotoKey) && props.ready !== false : canUseSourceRotoKey;
  function handleRotoPlaybackFpsInput(event: Event) {
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value)) props.onRotoPlaybackFpsChange?.(value);
  }

  function handleRotoInterpolationCountInput(event: Event) {
    if (props.mutationLocked) return;
    const value = Number((event.currentTarget as HTMLInputElement).value);
    if (Number.isFinite(value)) props.onRotoInterpolationCountChange?.(Math.max(1, Math.min(PHYSIC_PAINT_MAX_APPLY_FRAMES, Math.trunc(value))));
  }

  function handleRotoCellClick(frame: number, vm: RotoCellViewModel) {
    if (vm.baseMeaning === 'generated' || vm.isEditableTarget === false) {
      props.onNavigateToSyncedFrame(frame);
      return;
    }
    props.onNavigateToSyncedFrame(frame);
  }

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
    if (sessionKeyAvailability?.busy) return sessionKeyAvailability.disabledReason ?? 'Finish the current key action before using key tools.'.replace('{frame}', String(props.currentFrame));
    if (keyUtilitiesDisabledByBusyState) return 'Finish the current key action before using key tools.'.replace('{frame}', String(props.currentFrame));
    if (currentRotoCell.baseMeaning === 'generated' || currentRotoCell.isEditableTarget === false) return 'Generated frame {frame} is render-only. Use timeline navigation or playback; edit a real Roto key to paint.'.replace('{frame}', String(currentRotoCell.frame));
    if (action === 'paste') return sessionKeyAvailability?.pasteDisabledReason ?? 'Copy a real Roto key before pasting.';
    if (action === 'insert') return 'Select a real Roto key to insert.';
    if (action === 'duplicate') return 'Select a real Roto key to duplicate.';
    if (action === 'copy') return 'Select a real Roto key to copy.';
    return 'Select a real Roto key to delete.';
  }

  function runRotoKeyUtilityAction(action: RotoKeyUtilityAction, enabled: boolean, callback: (() => void) | undefined) {
    if (enabled) {
      callback?.();
      return;
    }
    if (!props.statusMessage) {
      // Disabled native buttons do not emit clicks; keep this copy source near the buttons
      // so the existing status stack can mirror the same reason when Studio supplies it.
      getRotoKeyUtilityDisabledMessage(action);
    }
  }

  function endRotoKeyPress(action: RotoKeyUtilityAction) {
    setTimeout(() => setPressedRotoKeyAction((pressed) => pressed === action ? null : pressed), 120);
  }

  function getRotoKeyButtonPressProps(action: RotoKeyUtilityAction) {
    return {
      'data-pressed': pressedRotoKeyAction === action,
      onPointerDown: () => setPressedRotoKeyAction(action),
      onPointerUp: () => endRotoKeyPress(action),
      onPointerCancel: () => endRotoKeyPress(action),
      onPointerLeave: () => endRotoKeyPress(action),
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key === ' ' || event.key === 'Enter') setPressedRotoKeyAction(action);
      },
      onKeyUp: (event: KeyboardEvent) => {
        if (event.key === ' ' || event.key === 'Enter') endRotoKeyPress(action);
      },
    };
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

  useEffect(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    updateScrollbar();
    const observer = new ResizeObserver(updateScrollbar);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);
    return () => observer.disconnect();
  }, [frameCells, updateScrollbar]);

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

  return (
    <section class="physics-paint-workflow-strip" aria-label="Physics Paint workflow strip">
      <div class="physics-paint-workflow-header">
        <div class="physics-paint-mode-label" aria-label="Selected Physics Paint mode">
          Roto #1
        </div>

        <div class="physics-paint-workflow-animation">
            <div class="physics-paint-mode-controls">
              <button type="button" class="physics-paint-nav-button" aria-label="Go to first frame" onClick={props.onGoToFirstFrame}><ChevronFirst size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to previous frame" onClick={props.onGoToPreviousFrame}><ChevronsLeft size={15} /></button>
              <button type="button" class={`physics-paint-nav-button physics-paint-roto-transport ${props.isRotoCachedPlaybackActive ? 'active' : ''}`} aria-label={props.isRotoCachedPlaybackActive ? 'Stop cached Roto playback' : 'Play cached Roto frames'} disabled={props.ready === false || !props.rotoCachedPlaybackAvailable || !props.onToggleRotoPlayback} onClick={props.onToggleRotoPlayback}>{props.isRotoCachedPlaybackActive ? <Square size={15} /> : <Play size={15} />}</button>
              <output class="physics-paint-current-frame">{props.currentFrame}</output>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to next frame" onClick={props.onGoToNextFrame}><ChevronsRight size={15} /></button>
              <button type="button" class="physics-paint-nav-button" aria-label="Go to last frame" onClick={props.onGoToLastFrame}><ChevronLast size={15} /></button>
              {props.onRotoInterpolationEnabledChange ? (
                <div class="physics-paint-roto-interpolation-controls" title={interpolationStatus}>
                  <label class="physics-paint-roto-interpolation-toggle">
                    <input type="checkbox" aria-label="Enable generated in-betweens" checked={Boolean(interpolationSettings.enabled)} disabled={interpolationControlsDisabled} onChange={(event) => {
                      if (props.mutationLocked) return;
                      props.onRotoInterpolationEnabledChange?.((event.currentTarget as HTMLInputElement).checked);
                    }} />
                  </label>
                  <label class="physics-paint-roto-interpolation-count" title="Generated in-betweens">
                    <Blend size={14} aria-hidden="true" />
                    <input type="number" min="1" max={PHYSIC_PAINT_MAX_APPLY_FRAMES} step="1" value={visibleInBetweenCount} aria-label="Generated in-between frames per real-key pair" disabled={interpolationControlsDisabled || !interpolationSettings.enabled} onInput={handleRotoInterpolationCountInput} />
                  </label>
                </div>
              ) : null}
              <button type="button" class={`physics-paint-nav-button physics-paint-roto-loop-toggle ${props.rotoCachedPlaybackLoop ? 'active' : ''}`} aria-label="Loop cached Roto playback" aria-pressed={Boolean(props.rotoCachedPlaybackLoop)} disabled={props.ready === false || !props.onRotoPlaybackLoopChange} onClick={() => props.onRotoPlaybackLoopChange?.(!props.rotoCachedPlaybackLoop)}><RotateCcw size={15} /></button>
              <label class="physics-paint-roto-fps-control">
                <span>fps</span>
                <input type="number" min="1" max="60" step="0.5" value={props.rotoCachedPlaybackFps ?? props.projectFps ?? 1} aria-label="Cached Roto playback frames per second" disabled={props.ready === false} onInput={handleRotoPlaybackFpsInput} />
              </label>
            </div>
          </div>
        <div class="physics-paint-state-actions" aria-hidden="true" />
      </div>

      <div class="physics-paint-timeline" aria-label="Physics Paint timeline">
        <div ref={timelineScrollRef} class="physics-paint-timeline-scroll" onScroll={updateScrollbar}>
          <div class="physics-paint-ruler" style={{ width: '1800px', minWidth: '1800px' }} aria-hidden="true">
            {rotoRulerTicks.map(frame => (
              <span key={frame} class="physics-paint-ruler-tick">{frame}</span>
            ))}
          </div>

            <div class="physics-paint-lane">
              <div class="physics-paint-roto-cells" role="row">
                {frameCells.map(frame => {
                  const syntheticGeneratedFrame = generatedRotoFrames.includes(frame)
                    ? [{ frameIndex: 0, appFrame: frame, dataUrl: 'data:image/png;base64,', source: 'generated-interpolation' as const }]
                    : [];
                  const cachedFramesForDisplay = syntheticGeneratedFrame.length > 0 && !displayCachedRotoFrames.some(candidate => candidate.appFrame === frame) ? syntheticGeneratedFrame : displayCachedRotoFrames;
                  const vm = getRotoCellViewModel({
                    frame,
                    currentFrame: expandedCurrentFrame,
                    cachedFrames: cachedFramesForDisplay,
                  });
                  const fill = getRotoCellFill(frame, realCachedRotoFrames);
                  const isDisplayRealKey = realCachedRotoFrameNumbers.includes(frame);
                  const generatedTitle = vm.baseMeaning === 'generated' || vm.isEditableTarget === false ? getGeneratedRotoTitle(frame) : null;
                  return (
                    <button
                      key={frame}
                      class={`physics-paint-roto-cell ${getRotoFillClass(fill)} ${vm.fillClass} ${isDisplayRealKey || isOccupiedFrame(displayOccupiedRotoFrames, frame) ? 'occupied' : ''} ${isDisplayRealKey || isSavedFrame(displaySavedRotoFrames, frame) ? 'saved' : ''} ${vm.overlays.includes('dirty') ? 'dirty' : ''} ${vm.overlays.includes('pending') ? 'pending' : ''} ${vm.overlays.includes('current') ? 'current' : ''}`}
                      aria-label={generatedTitle ?? vm.ariaLabel}
                      title={generatedTitle ?? vm.title}
                      onClick={() => handleRotoCellClick(frame, vm)}
                    >
                      <span>{frame}</span>
                    </button>
                  );
                })}
                {interpolationConnectors.map(connector => (
                  <span
                    key={`${connector.fromFrame}-${connector.toFrame}-${connector.ordinal}`}
                    class={`physics-paint-roto-interpolation-connector connector-count-${connector.total}`}
                    data-from-frame={connector.fromFrame}
                    data-to-frame={connector.toFrame}
                    data-generated-frame={connector.frame}
                    aria-hidden="true"
                  />
                ))}

              </div>
              <div class="physics-paint-roto-key-utilities" role="group" aria-label={`Roto key utilities for frame ${props.currentFrame}`}>
                <span class="physics-paint-roto-key-context" aria-hidden="true">Key {props.currentFrame}</span>
                <button type="button" class="physics-paint-roto-key-button" aria-label={`Insert blank Roto key before frame ${props.currentFrame}`} disabled={!canInsertRotoKey} {...getRotoKeyButtonPressProps('insert')} onClick={() => runRotoKeyUtilityAction('insert', canInsertRotoKey, props.onInsertRotoFrame)}>Insert</button>
                <button type="button" class="physics-paint-roto-key-button" aria-label={`Duplicate Roto key at frame ${props.currentFrame}`} disabled={!canDuplicateRotoKey} {...getRotoKeyButtonPressProps('duplicate')} onClick={() => runRotoKeyUtilityAction('duplicate', canDuplicateRotoKey, props.onDuplicateRotoKey)}>Dup</button>
                <button type="button" class="physics-paint-roto-key-button" aria-label={`Copy Roto key at frame ${props.currentFrame}`} disabled={!canCopyRotoKey} {...getRotoKeyButtonPressProps('copy')} onClick={() => runRotoKeyUtilityAction('copy', canCopyRotoKey, props.onCopyRotoFrame)}>Copy</button>
                <button type="button" class="physics-paint-roto-key-button" aria-label={`Paste Roto key to frame ${props.currentFrame}`} disabled={!canPasteRotoKey} {...getRotoKeyButtonPressProps('paste')} onClick={() => runRotoKeyUtilityAction('paste', canPasteRotoKey, props.onPasteRotoFrame)}>Paste</button>
                <button type="button" class="physics-paint-roto-key-button destructive" aria-label={`Delete Roto key at frame ${props.currentFrame}`} disabled={!canDeleteRotoKey} {...getRotoKeyButtonPressProps('delete')} onClick={() => runRotoKeyUtilityAction('delete', canDeleteRotoKey, props.onDeleteRotoFrame)}>Delete</button>
                <button type="button" class="physics-paint-roto-key-button" aria-label="Copy Roto paint script" title={scriptAvailability?.copyDisabledReason ?? 'Copy the mounted Roto paint script'} disabled={!scriptAvailability?.canCopy} onClick={props.onCopyRotoScript}>Copy Script</button>
                <button type="button" class="physics-paint-roto-key-button" aria-label="Apply Roto paint script" title={scriptAvailability?.applyDisabledReason ?? 'Apply the copied Roto paint script'} disabled={!scriptAvailability?.canApply} onClick={props.onApplyRotoScript}>Apply Script</button>
                <button type="button" class="physics-paint-roto-key-button destructive" aria-label="Discard copied Roto paint script" title="Discard the copied Roto paint script" disabled={!props.rotoScript?.hasCopiedScript.value || Boolean(scriptAvailability?.busy)} onClick={props.onDiscardRotoScript}>Discard Script</button>
              </div>
            </div>
        </div>
        {scrollbar.visible ? (
          <div class="physics-paint-timeline-scrollbar" onPointerDown={(event) => handleTimelineScrollbarPointerDown(event as unknown as PointerEvent)}>
            <span
              class="physics-paint-timeline-scrollbar-thumb"
              style={{ left: `${scrollbar.left}px`, width: `${scrollbar.width}px` }}
            />
          </div>
        ) : null}
      </div>

        <div class="physics-paint-roto-status-stack">
          <div class="physics-paint-roto-cell-legend" aria-label="Roto cell states">
            <span class="physics-paint-roto-cell-legend-title">Roto cell states</span>
            {ROTO_CELL_LEGEND_ITEMS.map(item => (
              <span key={item.label} class="physics-paint-roto-cell-legend-item">
                <span class={`physics-paint-roto-cell-swatch ${item.className}`} aria-hidden="true" />
                <span>{item.label}</span>
              </span>
            ))}
          </div>
          <p class="physics-paint-roto-status">{rotoMissingStatusLabel ?? currentRotoCell.label}</p>
          {props.onRotoInterpolationEnabledChange ? <p class="physics-paint-roto-interpolation-status">{interpolationStatus}</p> : null}
          {getSelectedRotoCustomSpanStatus(props.currentFrame, interpolationSettings) ? <p class="physics-paint-roto-custom-span-status">{getSelectedRotoCustomSpanStatus(props.currentFrame, interpolationSettings)}</p> : null}
          <p class="physics-paint-roto-interpolation-status">{'Generated frame {frame} is render-only. Completed real-key paint is cached automatically.'}</p>
          {currentRotoCell.baseMeaning === 'generated' || currentRotoCell.isEditableTarget === false ? <p class="physics-paint-roto-key-status">{getGeneratedRotoDisabledStatus(currentRotoCell.frame)}</p> : null}
          {keyUtilitiesDisabledByBusyState ? <p class="physics-paint-roto-key-status">{getRotoKeyBusyStatus(props.currentFrame)}</p> : null}
          {currentRotoFill === 'cached-only' ? (
            <>
              <p class="physics-paint-roto-key-status">Cached reference</p>
              <p class="physics-paint-roto-interpolation-status">Cached reference: repaintable, not stroke-editable.</p>
            </>
          ) : null}
          {props.statusMessage ? <p class="physics-paint-roto-interpolation-status">{props.statusMessage}</p> : null}
          {scriptStatus ? <p class="physics-paint-roto-interpolation-status">{scriptStatus}</p> : null}
          {props.rotoCachedPlaybackStatus ? <p class="physics-paint-roto-playback-status">{props.rotoCachedPlaybackStatus}</p> : null}
        </div>

   </section>
  );
}
