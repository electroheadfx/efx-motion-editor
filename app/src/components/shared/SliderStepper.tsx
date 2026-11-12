import { useEffect, useRef } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ComponentChildren, CSSProperties, JSX, Ref, TargetedInputEvent, TargetedMouseEvent, TargetedPointerEvent } from 'preact';
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
  /**
   * quick 261111-tul: the gesture commit boundary. `onChange` stays a
   * continuous value stream; `onCommit` fires exactly once per gesture at the
   * release boundaries — track pointerup/pointercancel, typed Enter, typed
   * blur, ± press end and keyboard activation — and carries the value the
   * gesture actually reached, never the possibly-stale `value` prop. It fires
   * even when the committed value equals `value` (Selection commits bind to
   * the live brush, not to the selection), and never for Escape, a disabled
   * control, a preset-list end, or a gesture that computed no value. With
   * `onCommit` absent every existing emission, guard, coalescing bracket and
   * rendered output stays byte-identical.
   */
  onCommit?: (value: number) => void;
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
  /** The editable value box — dialogs focus it on open. */
  inputRef?: Ref<HTMLInputElement>;
  /** Marks the value box invalid; the error text itself lives outside the field. */
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
  onFocus?: (event?: FocusEvent) => void;
  onBlur?: () => void;
  /**
   * Commit the drag only on release (48-06: track opacity recomposites the
   * surface). The knob still follows the pointer through a local draft.
   */
  commitOnRelease?: boolean;
  /**
   * quick 261105-sk3: emit through the shared commit law on every `input`
   * event instead of only on blur/Enter. Default OFF — every other consumer
   * keeps today's commit-on-blur contract. While typing, the raw text owns
   * the value box so a clamp or formatted rewrite never lands mid-word;
   * blur/Enter still run the authoritative parse + clamp + rewrite.
   */
  commitOnInput?: boolean;
  /**
   * quick 261024-p5q: the selected strokes disagree. The readout shows
   * "Mixed", the track neutralizes, and the equality guard is bypassed in
   * every emission path so the first gesture always writes — including a
   * release that lands exactly on the representative value. Every non-mixed
   * path stays byte-identical.
   */
  mixed?: boolean;
  /**
   * 261024-p5q UAT: typed commits and ± steps accept values outside
   * min..max. The track still spans min..max (the knob pins at the end), so
   * the UI states the range without rejecting an out-of-range entry.
   */
  allowOutOfRangeEntry?: boolean;
  /** Second row under the bar — the fade-curve select lives here. */
  below?: ComponentChildren;
  id?: string;
  class?: string;
}

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  flex: '1 1 0',
  minWidth: 0,
};

const LABEL_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: '6px',
  minHeight: '17px',
};

const LABEL_CELL_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  minWidth: 0,
};

/** Follows the sidebar theme; the fallback keeps the pre-quick Studio gray. */
const LABEL_STYLE: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.08px',
  color: 'var(--sidebar-text-secondary, #9aa5b1)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

/** The value reads as an input box sitting next to the label (SPECS snapshot). */
const VALUE_STYLE: CSSProperties = {
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

/** quick 261024-p5q: the undetermined readout (mixed selection). */
const MIXED_DISPLAY = 'Mixed';

/** Inline mixed treatment on the existing value box — no CSS file change. */
const MIXED_VALUE_STYLE: CSSProperties = {
  color: '#ef4444',
  fontStyle: 'italic',
};

const BAR_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

/** Second row under the bar (fade-curve select) — kept clear of the bar. */
const BELOW_STYLE: CSSProperties = {
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
const BAR_STYLE: CSSProperties = {
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
const CELL_STYLE: CSSProperties = {
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
  /* Optical centering: the −/+ glyphs sit ~2px low inside the font's line box. */
  transform: 'translateY(-2px)',
};

const TRACK_STYLE: CSSProperties = {
  position: 'relative',
  flex: '1 1 0',
  height: '100%',
  minWidth: 0,
  touchAction: 'none',
  cursor: 'pointer',
};

/* Centered on the track midline so the rail shares the −/+ glyph row (UAT:
   fixed px offsets left the line ~1px above the glyph centers). */
const TRACK_LINE_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 'calc(50% - 2px)',
  height: '4px',
  width: '100%',
  borderRadius: '2px',
  background: 'var(--sidebar-border-unselected, #363c47)',
};

const PROGRESS_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 'calc(50% - 2px)',
  height: '4px',
  borderRadius: '2px',
  background: 'var(--color-accent, #2f67e8)',
};

const KNOB_STYLE: CSSProperties = {
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
  onCommit,
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
  inputRef,
  ariaInvalid,
  ariaDescribedBy,
  onFocus,
  onBlur,
  commitOnRelease,
  commitOnInput = false,
  mixed = false,
  allowOutOfRangeEntry = false,
  below,
  id,
  class: className,
}: SliderStepperProps): JSX.Element {
  const valueRef = useRef<HTMLInputElement | null>(null);
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressing = useRef(false);
  const dragging = useRef(false);
  /** quick 261105-sk3: the raw text while typing (null = not typing). The
   *  controlled `value` prop must never clamp or reformat a half-typed number,
   *  so the draft owns the box until blur/Enter/Escape clears it. Preact 11
   *  patches `dom.value` only when the vnode value differs from the live DOM
   *  value (diff/index.js), so returning the draft keeps the box untouched. */
  const liveDraft = useRef<string | null>(null);
  /** commitOnRelease: the knob's draft while dragging (null = not dragging).
   *  Held in a ref-wrapped signal so it survives re-renders (48-06). */
  const draftRef = useRef(signal<number | null>(null));
  const draft = draftRef.current;
  // The 261111-tul gesture refs are allocated AFTER `draftRef` on purpose:
  // they are handler-only state, so keeping the render-read refs at their
  // pre-quick hook offsets keeps the dialog harness's traversal band stable.
  /** quick 261111-tul: the Enter/Escape marker. Enter already committed and
   *  Escape must not commit, so the blur each one triggers consumes the marker
   *  and stays silent. Cleared per gesture (onFocus resets it, and a blur
   *  always consumes it), so it can never suppress a later gesture's commit. */
  const suppressBlurCommit = useRef(false);
  /** quick 261111-tul: the live track gesture's last computed value. The
   *  release commits THIS, never the `value` prop — the parent may not have
   *  re-rendered the last move into the prop yet (T-TUL-01). */
  const lastTrackValue = useRef<number | null>(null);
  /** quick 261111-tul: the last value a ± press gesture reached (repeat ticks
   *  included), committed once at press end. Cleared at press start and read
   *  before the press-end early return, so the second press-end route
   *  (pointerup + pointerleave) finds null (T-TUL-02). */
  const pressValue = useRef<number | null>(null);

  const display = mixed ? MIXED_DISPLAY : formatStepperValue(value, step, precision, presets);
  /** quick 261105-sk3: the draft wins while typing so the clamp/formatted
   *  display can never rewrite the box mid-word. */
  const inputValue = commitOnInput && liveDraft.current !== null ? liveDraft.current : display;

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

  /** Returns the value this step reached, or null when no step ran (the
   *  preset-list end already performed its cleanup). The equality guard still
   *  governs `onChange` only: the returned value feeds the gesture commit even
   *  when it equals `value` (the equal-value law). */
  const stepBy = (direction: 1 | -1): number | null => {
    const typed = parseStepperInput(valueRef.current?.value ?? '');
    const base = Number.isFinite(typed) ? typed : value;
    if (presets && presets.length > 0) {
      const next = nextPresetFrom(presets, base, direction);
      if (next === undefined) {
        clearRepeat();
        pressing.current = false;
        stopCoalescing();
        return null;
      }
      if (next !== value || mixed) onChange(next);
      return next;
    }
    const effectiveStep = resolveStep ? resolveStep(base) : step;
    const next = allowOutOfRangeEntry
      ? clampToStep(base + direction * effectiveStep, effectiveStep)
      : clampToStep(base + direction * effectiveStep, effectiveStep, min, max);
    if (next !== value || mixed) onChange(next);
    return next;
  };

  const handlePressStart = (direction: 1 | -1) => (event: TargetedPointerEvent<HTMLButtonElement>) => {
    // Reset FIRST so a disabled / preset-end press can never inherit the
    // previous gesture's value (T-TUL-03).
    pressValue.current = null;
    if (disabled || (presets != null && presets.length > 0 && nextPresetFrom(presets, value, direction) === undefined)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pressing.current = true;
    clearRepeat();
    startCoalescing();
    pressValue.current = stepBy(direction);
    delayTimer.current = setTimeout(() => {
      repeatTimer.current = setInterval(() => {
        const stepped = stepBy(direction);
        // A null return means the preset end already ran its cleanup; keep
        // the last value the hold actually reached.
        if (stepped !== null) pressValue.current = stepped;
      }, NUMERIC_STEPPER_REPEAT_INTERVAL_MS);
    }, NUMERIC_STEPPER_REPEAT_DELAY_MS);
  };

  const handlePressEnd = () => {
    // Read and clear BEFORE the early return: one commit per press gesture,
    // including hold-to-repeat, while the follow-on pointerup/pointerleave
    // route finds null and adds nothing (T-TUL-02).
    const committed = pressValue.current;
    pressValue.current = null;
    if (onCommit && committed !== null) onCommit(committed);
    if (!pressing.current) return;
    pressing.current = false;
    clearRepeat();
    stopCoalescing();
  };

  const handleClick = (direction: 1 | -1) => (event: TargetedMouseEvent<HTMLButtonElement>) => {
    if (disabled || event.detail !== 0) return;
    if (presets != null && presets.length > 0 && nextPresetFrom(presets, value, direction) === undefined) return;
    // Keyboard/AT activation has no press lifecycle: its single step commits
    // immediately. A real click (detail !== 0) returned above and belongs to
    // the pointer path, so it never double-commits here.
    const stepped = stepBy(direction);
    if (onCommit && stepped !== null) onCommit(stepped);
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
    // The gesture value is recorded on ONE boundary whether or not the knob
    // follows a local draft, so release behaves identically with commitOnRelease.
    if (onCommit) lastTrackValue.current = next;
    if (commitOnRelease) {
      draft.value = next;
      return;
    }
    if (next !== value || mixed) onChange(next);
  };

  const handleTrackPointerDown = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (disabled || trackSpan <= 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging.current = true;
    lastTrackValue.current = null;
    startCoalescing();
    emitTrackValue(valueFromPointer(event.currentTarget, event.clientX));
  };

  const handleTrackPointerMove = (event: TargetedPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    emitTrackValue(valueFromPointer(event.currentTarget, event.clientX));
  };

  const handleTrackPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (commitOnRelease && draft.value !== null) {
      const next = draft.value;
      draft.value = null;
      if (next !== value || mixed) onChange(next);
    }
    // pointercancel routes here too (the track wires it to this handler): a
    // cancelled drag commits the value it reached — the gesture already
    // applied it live through onChange, so the commit only mirrors a real
    // change. A gesture that computed no value leaves the ref null: silence.
    const committed = lastTrackValue.current;
    lastTrackValue.current = null;
    if (onCommit && committed !== null) onCommit(committed);
    stopCoalescing();
  };

  /** The one commit-option object — blur/Enter and the live input path must
   *  share it so a typed emit can never diverge from the authoritative parse
   *  (quick 261105-sk3, T-261105-SK3-01). */
  const commitOptions = () => ({
    step,
    presets,
    resolveStep,
    freeEntry,
    min: allowOutOfRangeEntry ? undefined : min,
    max: allowOutOfRangeEntry ? undefined : max,
  });

  /** Returns the value the typed commit reports (quick 261111-tul). An
   *  unparseable entry reports the displayed/unchanged `value` — the box
   *  reverts, so the commit reports what the box now shows. A parseable entry
   *  reports the committed value even when it equals `value`: the equal-value
   *  law belongs to `onCommit`, while `onChange` keeps its equality guard. */
  const commitInput = (element: HTMLInputElement): number => {
    const next = commitStepperInput(element.value, commitOptions());
    if (next !== null) {
      if (next !== value || mixed) onChange(next);
      element.value = formatStepperValue(next, step, precision, presets);
      liveDraft.current = null;
      return next;
    }
    element.value = display;
    liveDraft.current = null;
    return value;
  };

  /** quick 261105-sk3: the live commit. The raw text is stored FIRST so empty
   *  and unparseable input also stays in the box; the emit then runs through
   *  the same commit law as blur. Never assigns `element.value`. */
  const handleLiveInput = (event: TargetedInputEvent<HTMLInputElement>) => {
    const element = event.currentTarget;
    liveDraft.current = element.value;
    const next = commitStepperInput(element.value, commitOptions());
    if (next === null) return;
    if (next !== value || mixed) onChange(next);
  };

  // 48-06: while a release-commit drag is live the knob follows `draft.value`
  // (a signal, so the move re-renders it) — the parent value only moves on release.
  // 261024-p5q: a mixed selection is neutral until the first draft exists.
  const neutralMixed = mixed && draft.value === null;
  const shownFraction = (() => {
    if (neutralMixed) return 0;
    const shown = draft.value ?? value;
    const span = trackSpan;
    if (span <= 0) return 0;
    return Math.min(1, Math.max(0, (shown - trackFloor) / span));
  })();

  const rootClass = [
    'slider-stepper',
    mixed ? 'slider-stepper-mixed' : null,
    className ?? null,
  ].filter((token): token is string => token !== null).join(' ');

  const assignValueInput = (element: HTMLInputElement | null) => {
    valueRef.current = element;
    if (typeof inputRef === 'function') inputRef(element);
    else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = element;
  };

  return (
    <div id={id} class={rootClass} style={FIELD_STYLE} data-testid="slider-stepper">
      <div class="slider-stepper-label-row" style={LABEL_ROW_STYLE}>
        <div class="slider-stepper-label-cell" style={LABEL_CELL_STYLE}>
          <span class="slider-stepper-label" style={LABEL_STYLE}>{label}</span>
        </div>
        <input
          ref={assignValueInput}
          type="text"
          inputMode="decimal"
          class="slider-stepper-value"
          style={mixed ? { ...VALUE_STYLE, ...MIXED_VALUE_STYLE } : VALUE_STYLE}
          value={inputValue}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-disabled={ariaDisabled ? 'true' : undefined}
          aria-invalid={ariaInvalid ? 'true' : undefined}
          aria-describedby={ariaDescribedBy}
          data-testid="slider-stepper-value"
          onFocus={(event) => {
            // A marker orphaned by a blur that never fired (e.g. the element
            // left the document) must not swallow this gesture's commit.
            suppressBlurCommit.current = false;
            startCoalescing();
            onFocus?.(event);
          }}
          onBlur={(event) => {
            const committed = commitInput(event.currentTarget);
            // Enter/Escape already settled this gesture: the blur they trigger
            // consumes the marker instead of committing a second time.
            const suppressed = suppressBlurCommit.current;
            suppressBlurCommit.current = false;
            if (onCommit && !suppressed) onCommit(committed);
            stopCoalescing();
            onBlur?.();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              const committed = commitInput(event.currentTarget);
              suppressBlurCommit.current = true;
              if (onCommit) onCommit(committed);
              event.currentTarget.blur();
            } else if (event.key === 'Escape') {
              event.currentTarget.value = display;
              liveDraft.current = null;
              // Escape is a refusal, never a commit — silence its blur too.
              suppressBlurCommit.current = true;
              event.currentTarget.blur();
            }
          }}
          {...(commitOnInput ? { onInput: handleLiveInput } : {})}
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
              style={{
                ...PROGRESS_STYLE,
                width: neutralMixed
                  ? '0px'
                  : `calc((100% - 11px) * ${shownFraction} + 5.5px)`,
              }}
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
