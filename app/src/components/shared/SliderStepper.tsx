import { useEffect, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ComponentChildren, JSX } from 'preact';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import {
  commitStepperInput,
  formatStepperValue,
  parseStepperInput,
  NUMERIC_STEPPER_REPEAT_DELAY_MS,
  NUMERIC_STEPPER_REPEAT_INTERVAL_MS,
} from './NumericStepper';

/**
 * SPECS/slider-stepper — the blended slider+stepper ("BLENDED — VALUE ON TOP").
 *
 * One component owns every slider and stepper surface: the value readout sits
 * ON TOP of the bar (editable, same commit contract as NumericStepper), and the
 * bar itself mixes the two gestures — the middle is the slider track, the bare
 * `−` / `+` glyphs at either end are the stepper. The glyphs are text, never
 * boxed buttons (the mock's Minus/Plus nodes are plain text divs).
 *
 * The commit contract is NumericStepper's: step grid, presets, resolveStep /
 * freeEntry, EU-comma parse, coalescing brackets. `max` clamps commits; when a
 * field has no upper bound the call site passes `sliderMax` for the TRACK only,
 * so dragging gets a range without tightening the commit law.
 */

export interface SliderStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  presets?: readonly number[];
  resolveStep?: (value: number) => number;
  freeEntry?: boolean;
  min?: number;
  /** Commit clamp — unchanged semantics from NumericStepper. */
  max?: number;
  /** Track range floor (defaults to `min`). Display only. */
  sliderMin?: number;
  /**
   * Track range ceiling (defaults to `max`). Display only — dragging clamps to
   * it, typed commits still honour `max` (which may be unbounded).
   */
  sliderMax?: number;
  precision?: number;
  ariaLabel: string;
  disabled?: boolean;
  ariaDisabled?: boolean;
  onFocus?: (event?: FocusEvent) => void;
  onBlur?: () => void;
  /**
   * Commit the drag only on release (48-06: track opacity recomposites the
   * surface). The knob still follows the pointer through a local draft.
   */
  commitOnRelease?: boolean;
  /** Second row under the bar — the fade-curve select lives here. */
  below?: ComponentChildren;
  id?: string;
  class?: string;
}

const FIELD_STYLE: JSX.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: '1 1 0',
  minWidth: 0,
};

const LABEL_ROW_STYLE: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '6px',
  minHeight: '17px',
};

const LABEL_CELL_STYLE: JSX.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
};

/** Follows the sidebar theme; the fallback keeps the pre-quick Studio gray. */
const LABEL_STYLE: JSX.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08px',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/** The value reads as an input box sitting next to the label (SPECS snapshot). */
const VALUE_STYLE: JSX.CSSProperties = {
  width: '46px',
  height: '17px',
  boxSizing: 'border-box',
  flexShrink: 0,
  border: '1px solid var(--sidebar-border-unselected, rgba(159, 165, 174, 0.55))',
  outline: 'none',
  background: 'var(--sidebar-input-bg, rgba(127, 131, 138, 0.18))',
  borderRadius: '3px',
  padding: '0 5px',
  fontSize: '11px',
  fontWeight: 600,
  textAlign: 'center',
  color: 'var(--sidebar-text-primary, #eceff2)',
  fontVariantNumeric: 'tabular-nums',
};

const BAR_ROW_STYLE: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

/** Second row under the bar (fade-curve select) — kept clear of the bar. */
const BELOW_STYLE: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  minWidth: 0,
  marginTop: '4px',
};

/**
 * The one box-drawing element: 22px, radius 4. OPAQUE (UAT): the mock's
 * translucent gray washed out over the audio modal's frosted (blur+saturate)
 * backdrop — the paper bled through and inverted the bar's look. Follows the
 * sidebar input-bg theme var; the `#4c4e51` fallback is the pre-quick composite
 * over `#3e3f41` (0.22 × rgb(127,131,138) over #3e3f41), so Studio (which does
 * not define the var) renders byte-identical.
 */
const BAR_STYLE: JSX.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  boxSizing: 'border-box',
  flex: '1 1 0',
  minWidth: 0,
  height: '22px',
  padding: '0 2px',
  borderRadius: '4px',
  background: 'var(--sidebar-input-bg, #4c4e51)',
};

/** 30px hit cell — the glyph inside carries no box of its own. */
const CELL_STYLE: JSX.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '30px',
  height: '20px',
  flexShrink: 0,
  border: 'none',
  background: 'transparent',
  padding: 0,
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  fontSize: '13px',
  lineHeight: 1,
  cursor: 'pointer',
  userSelect: 'none',
  touchAction: 'none',
};

const TRACK_STYLE: JSX.CSSProperties = {
  position: 'relative',
  flex: '1 1 0',
  height: '100%',
  minWidth: 0,
  touchAction: 'none',
  cursor: 'pointer',
};

/* Centered on the track midline so the rail shares the −/+ glyph row (UAT:
   fixed px offsets left the line ~1px above the glyph centers). */
const TRACK_LINE_STYLE: JSX.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 'calc(50% - 2px)',
  height: '4px',
  width: '100%',
  borderRadius: '2px',
  background: 'var(--sidebar-border-unselected, #363c47)',
};

const PROGRESS_STYLE: JSX.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 'calc(50% - 2px)',
  height: '4px',
  borderRadius: '2px',
  background: 'var(--color-accent, #2f67e8)',
};

const KNOB_STYLE: JSX.CSSProperties = {
  position: 'absolute',
  top: 'calc(50% - 5.5px)',
  width: '11px',
  height: '11px',
  borderRadius: '9999px',
  background: 'var(--sidebar-slider-thumb, #f1f3f5)',
  outline: '1px solid #ffffff',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
};

function clampToStep(value: number, step: number, min?: number, max?: number): number {
  const snapped = step > 0 ? Math.round(value / step) * step : value;
  let next = Number(snapped.toFixed(6));
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

function nextPresetFrom(presets: readonly number[], base: number, direction: 1 | -1): number | undefined {
  if (direction === 1) return presets.find((entry) => entry > base);
  for (let index = presets.length - 1; index >= 0; index -= 1) {
    if (presets[index] < base) return presets[index];
  }
  return undefined;
}

export function SliderStepper({
  label,
  value,
  onChange,
  step = 1,
  presets,
  resolveStep,
  freeEntry,
  min,
  max,
  sliderMin,
  sliderMax,
  precision,
  ariaLabel,
  disabled = false,
  ariaDisabled,
  onFocus,
  onBlur,
  commitOnRelease,
  below,
  id,
  class: className,
}: SliderStepperProps): JSX.Element {
  const valueRef = useRef<HTMLInputElement | null>(null);
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressing = useRef(false);
  const dragging = useRef(false);
  /** commitOnRelease: the knob's draft while dragging (null = not dragging).
   *  Held in a ref-wrapped signal so it survives re-renders (48-06). */
  const draftRef = useRef(signal<number | null>(null));
  const draft = draftRef.current;

  const display = formatStepperValue(value, step, precision, presets);

  const trackFloor = sliderMin ?? min ?? 0;
  const trackCeiling = sliderMax ?? max ?? Math.max(value, trackFloor + 1);
  const trackSpan = trackCeiling - trackFloor;

  const atPresetEnd = (direction: 1 | -1): boolean =>
    presets != null && presets.length > 0 && nextPresetFrom(presets, value, direction) === undefined;

  useEffect(() => () => {
    if (delayTimer.current !== null) clearTimeout(delayTimer.current);
    if (repeatTimer.current !== null) clearInterval(repeatTimer.current);
  }, []);

  const clearRepeat = () => {
    if (delayTimer.current !== null) {
      clearTimeout(delayTimer.current);
      delayTimer.current = null;
    }
    if (repeatTimer.current !== null) {
      clearInterval(repeatTimer.current);
      repeatTimer.current = null;
    }
  };

  const stepBy = (direction: 1 | -1) => {
    const typed = parseStepperInput(valueRef.current?.value ?? '');
    const base = Number.isFinite(typed) ? typed : value;
    if (presets && presets.length > 0) {
      const next = nextPresetFrom(presets, base, direction);
      if (next === undefined) {
        clearRepeat();
        pressing.current = false;
        stopCoalescing();
        return;
      }
      if (next !== value) onChange(next);
      return;
    }
    const effectiveStep = resolveStep ? resolveStep(base) : step;
    const next = clampToStep(base + direction * effectiveStep, effectiveStep, min, max);
    if (next !== value) onChange(next);
  };

  const handlePressStart = (direction: 1 | -1) => (event: JSX.TargetedPointerEvent<HTMLButtonElement>) => {
    if (disabled || (presets != null && presets.length > 0 && nextPresetFrom(presets, value, direction) === undefined)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressing.current = true;
    clearRepeat();
    startCoalescing();
    stepBy(direction);
    delayTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => stepBy(direction), NUMERIC_STEPPER_REPEAT_INTERVAL_MS);
    }, NUMERIC_STEPPER_REPEAT_DELAY_MS);
  };

  const handlePressEnd = () => {
    if (!pressing.current) return;
    pressing.current = false;
    clearRepeat();
    stopCoalescing();
  };

  const handleClick = (direction: 1 | -1) => (event: JSX.TargetedMouseEvent<HTMLButtonElement>) => {
    if (disabled || event.detail !== 0) return;
    if (presets != null && presets.length > 0 && nextPresetFrom(presets, value, direction) === undefined) return;
    stepBy(direction);
  };

  /** Map a pointer x to the track value, snapped to the commit grid. */
  const valueFromPointer = (track: HTMLElement, clientX: number): number | null => {
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return null;
    const rawFraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = trackFloor + rawFraction * trackSpan;
    if (presets && presets.length > 0) {
      let best = presets[0];
      let bestDistance = Math.abs(raw - best);
      for (const entry of presets) {
        const distance = Math.abs(raw - entry);
        if (distance < bestDistance || (distance === bestDistance && entry < best)) {
          best = entry;
          bestDistance = distance;
        }
      }
      return best;
    }
    const effectiveStep = resolveStep ? resolveStep(raw) : step;
    return clampToStep(raw, effectiveStep, min, max);
  };

  const emitTrackValue = (next: number | null) => {
    if (next === null) return;
    if (commitOnRelease) {
      draft.value = next;
      return;
    }
    if (next !== value) onChange(next);
  };

  const handleTrackPointerDown = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (disabled || trackSpan <= 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging.current = true;
    startCoalescing();
    emitTrackValue(valueFromPointer(event.currentTarget, event.clientX));
  };

  const handleTrackPointerMove = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    emitTrackValue(valueFromPointer(event.currentTarget, event.clientX));
  };

  const handleTrackPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (commitOnRelease && draft.value !== null) {
      const next = draft.value;
      draft.value = null;
      if (next !== value) onChange(next);
    }
    stopCoalescing();
  };

  const commitInput = (element: HTMLInputElement) => {
    const next = commitStepperInput(element.value, { step, presets, resolveStep, freeEntry, min, max });
    if (next !== null) {
      if (next !== value) onChange(next);
      element.value = formatStepperValue(next, step, precision, presets);
    } else {
      element.value = display;
    }
  };

  // 48-06: while a release-commit drag is live the knob follows `draft.value`
  // (a signal, so the move re-renders it) — the parent value only moves on release.
  const shownFraction = (() => {
    const shown = draft.value ?? value;
    const span = trackSpan;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, (shown - trackFloor) / span));
  })();

  return (
    <div id={id} class={className ? `slider-stepper ${className}` : 'slider-stepper'} style={FIELD_STYLE} data-testid="slider-stepper">
      <div class="slider-stepper-label-row" style={LABEL_ROW_STYLE}>
        <div class="slider-stepper-label-cell" style={LABEL_CELL_STYLE}>
          <span class="slider-stepper-label" style={LABEL_STYLE}>{label}</span>
        </div>
        <input
          ref={valueRef}
          type="text"
          inputMode="decimal"
          class="slider-stepper-value"
          style={VALUE_STYLE}
          value={display}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-disabled={ariaDisabled ? 'true' : undefined}
          data-testid="slider-stepper-value"
          onFocus={(event) => {
            startCoalescing();
            onFocus?.(event);
          }}
          onBlur={(event) => {
            commitInput(event.currentTarget);
            stopCoalescing();
            onBlur?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              commitInput(event.currentTarget);
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              event.currentTarget.value = display;
              event.currentTarget.blur();
            }
          }}
        />
      </div>
      <div class="slider-stepper-bar-row" style={BAR_ROW_STYLE}>
        <div class="slider-stepper-bar" style={BAR_STYLE} data-testid="slider-stepper-bar">
          <button
            type="button"
            class="slider-stepper-cell"
            style={CELL_STYLE}
            tabIndex={-1}
            disabled={disabled || atPresetEnd(-1)}
            aria-label={`Decrease ${ariaLabel}`}
            data-testid="slider-stepper-minus"
            onPointerDown={handlePressStart(-1)}
            onPointerUp={handlePressEnd}
            onPointerCancel={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onClick={handleClick(-1)}
          >
            {'−'}
          </button>
          <div
            class="slider-stepper-track"
            style={TRACK_STYLE}
            data-testid="slider-stepper-track"
            onPointerDown={handleTrackPointerDown}
            onPointerMove={handleTrackPointerMove}
            onPointerUp={handleTrackPointerUp}
            onPointerCancel={handleTrackPointerUp}
          >
            <div class="slider-stepper-track-line" style={TRACK_LINE_STYLE} />
            <div
              class="slider-stepper-progress"
              style={{ ...PROGRESS_STYLE, width: `calc((100% - 11px) * ${shownFraction} + 5.5px)` }}
            />
            <div
              class="slider-stepper-knob"
              style={{ ...KNOB_STYLE, left: `calc((100% - 11px) * ${shownFraction})` }}
            />
          </div>
          <button
            type="button"
            class="slider-stepper-cell"
            style={CELL_STYLE}
            tabIndex={-1}
            disabled={disabled || atPresetEnd(1)}
            aria-label={`Increase ${ariaLabel}`}
            data-testid="slider-stepper-plus"
            onPointerDown={handlePressStart(1)}
            onPointerUp={handlePressEnd}
            onPointerCancel={handlePressEnd}
            onPointerLeave={handlePressEnd}
            onClick={handleClick(1)}
          >
            {'+'}
          </button>
        </div>
      </div>
      {below ? (
        <div class="slider-stepper-below" style={BELOW_STYLE} data-testid="slider-stepper-below">
          {below}
        </div>
      ) : null}
    </div>
  );
}
