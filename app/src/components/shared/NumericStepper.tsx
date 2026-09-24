import { useEffect, useRef } from 'preact/hooks';
import { Minus, Plus } from 'lucide-preact';
import type { ComponentChildren, JSX } from 'preact';
import { startCoalescing, stopCoalescing } from '../../lib/history';

/**
 * 52.2-03 (D-23/D-24), reshaped by 260924-ffd: the shared `− [field] +`
 * numeric treatment.
 *
 * One component owns the layout and the commit contract for every numeric
 * field in the app. The contract has THREE tiers (260924-ffd):
 *
 * 1. CLASSIC DEFAULT — no `step`, no `presets`: every press moves by exactly
 *    ±1 and the display is an integer. Passing an explicit `step` keeps the
 *    classic constant-step behaviour (T-52.2-08 clamp + round, hold-to-
 *    repeat, coalescing brackets).
 * 2. PRESETS — a first-class `presets` menu (sole consumer today: fps,
 *    FPS_PRESETS): presses walk the ascending list, ends clamp with visibly
 *    DISABLED buttons (checked at render AND in the handlers), typed commits
 *    snap to the nearest entry (ties toward the lower entry), and off-list
 *    live values display as-is until the first +/− which snaps in the
 *    direction of travel. Integer display is forced — never a decimal point.
 *    Supersedes D-24 (fps step 0.5 → OBSOLETE).
 * 3. EXPLICIT DECIMAL OPT-IN — an explicit sub-unit `step` (0.01, 0.5) plus
 *    the OPT-IN exception options `resolveStep`/`freeEntry` (sole consumer:
 *    paper grain scale, 260924-d6l): the effective step resolves from the
 *    live value and typed commits clamp without a grid snap. Omitting the
 *    exception options yields classic constant-step behaviour.
 *
 * Constraint-injection contract (260924-d6l): each call site injects the
 * field's declared constraints, and those constraints are the whole contract
 * by default; guarded by the contract pins in NumericStepper.test.tsx.
 *
 * The press gesture is bracketed by `startCoalescing`/`stopCoalescing` so a
 * held button collapses to a single undo entry (same discipline as the label
 * drag-to-scrub in NumericInput). In preset mode, reaching a list end during
 * a hold runs that cleanup inside `stepBy` so module-global coalescing can
 * never strand (260924-ffd Pitfall 1).
 */

/** Delay before a held − / + button starts repeating (D-24: hold-to-repeat after a short delay). */
export const NUMERIC_STEPPER_REPEAT_DELAY_MS = 400;

/** Interval between repeat steps once the hold delay has elapsed. */
export const NUMERIC_STEPPER_REPEAT_INTERVAL_MS = 60;

const BUTTON_ICON_SIZE = 12;

export interface NumericStepperProps {
  /** Controlled value — the stepper never owns domain state. */
  value: number;
  /** Called once per committed step (button press, hold-repeat, or field commit). */
  onChange: (value: number) => void;
  /**
   * The field's own step — the classic constant-step contract. Optional since
   * 260924-ffd: when omitted (and no `presets` are given), every press moves
   * by exactly ±1 and the display is an integer. When `resolveStep`/`freeEntry`
   * are omitted, every press moves by exactly this step and typed commits snap
   * to its grid.
   */
  step?: number;
  /**
   * PRESET MODE (260924-ffd; supersedes D-24 fps step 0.5) — an ascending
   * list of legal values (sole consumer today: fps via FPS_PRESETS). Presses
   * walk the list (an off-list base snaps to the nearest entry in the
   * direction of travel), ends clamp with visibly disabled buttons, typed
   * commits snap to the nearest entry (ties toward the lower entry), and the
   * display is forced to integers. Takes precedence over `step`.
   */
  presets?: readonly number[];
  /**
   * OPT-IN exception (sole consumer: paper grain scale) — the effective step
   * for each emission is resolved from the LIVE base value, so a
   * hold-to-repeat crossing a band boundary switches step mid-hold instead of
   * keeping the press-start step. Falls back to `step` when absent (classic
   * constant-step contract, 260924-d6l).
   */
  resolveStep?: (value: number) => number;
  /**
   * OPT-IN exception (sole consumer: paper grain scale) — typed commits clamp
   * to min/max without snapping to the step grid (free numbers). When absent,
   * typed commits snap to the field's step grid (T-52.2-08).
   */
  freeEntry?: boolean;
  min?: number;
  max?: number;
  /** Display decimals for the default formatter (step >= 1 → integer, else up to 3). */
  precision?: number;
  ariaLabel: string;
  disabled?: boolean;
  /** Renders `aria-disabled` on the field (the Studio guarded-pattern contract). */
  ariaDisabled?: boolean;
  /**
   * Runs in addition to the stepper's own focus/blur handling — the Studio
   * guarded-pattern sites hang their styled tooltip off the field's focus.
   */
  onFocus?: (event?: FocusEvent) => void;
  onBlur?: () => void;
  /** Extra description id for the field (Studio guarded-reason copy). */
  ariaDescribedBy?: string;
  class?: string;
  inputClass?: string;
  inputStyle?: JSX.CSSProperties;
  buttonClass?: string;
  buttonStyle?: JSX.CSSProperties;
  /** Optional leading content — the NumericInput label + drag-to-scrub wrapper. */
  children?: ComponentChildren;
}

/** The 3-decimal display rule carried over from NumericInput.formatDisplay. */
export function formatStepperValue(
  value: number,
  step: number,
  precision?: number,
  presets?: readonly number[],
): string {
  // Preset mode forces an integer display (260924-ffd P3): a menu of legal
  // values never shows a decimal point or a trailing .0.
  const decimals = presets && presets.length > 0 ? 0 : (precision ?? (step >= 1 ? 0 : 3));
  if (decimals <= 0) return String(Math.round(value));
  // Show up to `decimals` places, strip trailing zeros
  const fixed = value.toFixed(decimals);
  return fixed.replace(/\.?0+$/, '') || '0';
}

/** Snap to the field's step grid, kill float noise, then clamp to min/max. */
function clampToStep(value: number, step: number, min?: number, max?: number): number {
  const snapped = step > 0 ? Math.round(value / step) * step : value;
  let next = Number(snapped.toFixed(6));
  if (min != null) next = Math.max(min, next);
  if (max != null) next = Math.min(max, next);
  return next;
}

/**
 * Parse a typed field value. European keyboards produce the decimal comma
 * ("2,2") — normalize it to "2.2" before parseFloat, which would otherwise
 * stop at the comma and silently truncate to 2. Unparseable → NaN.
 */
export function parseStepperInput(raw: string): number {
  return parseFloat(raw.replace(',', '.'));
}

export interface StepperCommitOptions {
  step: number;
  /**
   * PRESET MODE (260924-ffd): parse → finite → nearest-entry snap (ties toward
   * the lower entry) → clamp to the list ends. Takes precedence over
   * `freeEntry`/`step`; the classic T-52.2-08 path below is untouched.
   */
  presets?: readonly number[];
  resolveStep?: (value: number) => number;
  /** Typed commits clamp to min/max WITHOUT the step-grid snap (grain scale). */
  freeEntry?: boolean;
  min?: number;
  max?: number;
}

/**
 * Next preset in `direction` from `base`, or `undefined` at the list end.
 * The list is ascending by contract (FPS_PRESETS); an off-list base snaps to
 * the nearest entry in the direction of travel (260924-ffd).
 */
function nextPresetFrom(presets: readonly number[], base: number, direction: 1 | -1): number | undefined {
  if (direction === 1) return presets.find((entry) => entry > base);
  for (let index = presets.length - 1; index >= 0; index -= 1) {
    if (presets[index] < base) return presets[index];
  }
  return undefined;
}

/** Nearest preset to `base`, ties toward the lower entry (ascending list). */
function nearestPreset(presets: readonly number[], base: number): number {
  let best = presets[0];
  let bestDistance = Math.abs(base - best);
  for (const entry of presets) {
    const distance = Math.abs(base - entry);
    if (distance < bestDistance || (distance === bestDistance && entry < best)) {
      best = entry;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Resolve a typed field value to the number the field commits: comma-tolerant
 * parse, then either free clamp (freeEntry) or the shared snap-to-step path
 * (T-52.2-08). Unparseable input returns null so the caller can revert.
 */
export function commitStepperInput(raw: string, options: StepperCommitOptions): number | null {
  const parsed = parseStepperInput(raw);
  if (!Number.isFinite(parsed)) return null;
  if (options.presets && options.presets.length > 0) {
    // Preset mode (260924-ffd Pitfall 5): nearest entry, ties toward the
    // lower entry, then clamp to the list ends.
    const snapped = nearestPreset(options.presets, parsed);
    const minEntry = Math.min(...options.presets);
    const maxEntry = Math.max(...options.presets);
    return Math.min(maxEntry, Math.max(minEntry, snapped));
  }
  if (options.freeEntry) {
    let next = parsed;
    if (options.min != null) next = Math.max(options.min, next);
    if (options.max != null) next = Math.min(options.max, next);
    // Match the display rule (max 3 decimals) so the stored value never
    // drifts from what the field shows after commit.
    return Number(next.toFixed(3));
  }
  const effectiveStep = options.resolveStep ? options.resolveStep(parsed) : options.step;
  return clampToStep(parsed, effectiveStep, options.min, options.max);
}

const WRAPPER_STYLE: JSX.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '3px',
  minWidth: 0,
};

const BASE_BUTTON_STYLE: JSX.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '20px',
  height: '20px',
  flexShrink: 0,
  padding: 0,
  border: '1px solid var(--sidebar-border-unselected, rgba(127, 131, 138, 0.55))',
  borderRadius: '4px',
  background: 'var(--sidebar-input-bg, rgba(127, 131, 138, 0.18))',
  color: 'var(--sidebar-text-secondary, inherit)',
  cursor: 'pointer',
  lineHeight: 1,
  userSelect: 'none',
  touchAction: 'none',
};

const BASE_INPUT_STYLE: JSX.CSSProperties = {
  flex: '1 1 0',
  minWidth: 0,
  width: '100%',
  padding: '4px 6px',
  border: '1px solid var(--sidebar-border-unselected, rgba(127, 131, 138, 0.55))',
  borderRadius: '4px',
  background: 'var(--sidebar-input-bg, rgba(127, 131, 138, 0.18))',
  color: 'var(--sidebar-text-primary, inherit)',
  fontSize: '12px',
  textAlign: 'center',
  fontVariantNumeric: 'tabular-nums',
  outline: 'none',
};

export function NumericStepper({
  value,
  onChange,
  step = 1,
  presets,
  resolveStep,
  freeEntry,
  min,
  max,
  precision,
  ariaLabel,
  disabled = false,
  ariaDisabled,
  onFocus,
  onBlur,
  ariaDescribedBy,
  class: className,
  inputClass,
  inputStyle,
  buttonClass,
  buttonStyle,
  children,
}: NumericStepperProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const delayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pressing = useRef(false);

  const display = formatStepperValue(value, step, precision, presets);

  // Preset end state, computed per render from the LIVE value: the button at
  // a list end is visibly disabled (260924-ffd — locked decision: disabled,
  // not a silent no-op).
  const atPresetEnd = (direction: 1 | -1): boolean =>
    presets != null && presets.length > 0 && nextPresetFrom(presets, value, direction) === undefined;
  const decrementAtEnd = atPresetEnd(-1);
  const incrementAtEnd = atPresetEnd(1);

  /**
   * Handler-side end check (260924-ffd): same rule as the render-time
   * disabled flag, but evaluated against the typed text when it is parseable
   * (the existing base-resolution behaviour of `stepBy`). Classic mode always
   * returns true.
   */
  const canStepInDirection = (direction: 1 | -1): boolean => {
    if (presets == null || presets.length === 0) return true;
    const typed = parseStepperInput(inputRef.current?.value ?? '');
    const base = Number.isFinite(typed) ? typed : value;
    return nextPresetFrom(presets, base, direction) !== undefined;
  };

  // Stop condition for the hold-to-repeat loop (efx-preact-reactivity rule 7):
  // the pointer release/cancel/leave handlers below, and this unmount cleanup.
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

  /** Every emission route funnels through here: presets walk or snap+clamp. */
  const stepBy = (direction: 1 | -1) => {
    const typed = parseStepperInput(inputRef.current?.value ?? '');
    const base = Number.isFinite(typed) ? typed : value;
    if (presets && presets.length > 0) {
      const next = nextPresetFrom(presets, base, direction);
      if (next === undefined) {
        // Pitfall 1 (260924-ffd): at-end detection mid-hold must run press-end
        // cleanup inside stepBy — the end button may already be disabled and
        // swallow the DOM release, which would strand module-global coalescing.
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
    // Component-level disable OR a preset list end in this direction: refuse
    // the press entirely (the end button is already visibly disabled).
    if (disabled || !canStepInDirection(direction)) return;
    // Keep the field's focus/caret: pressing a button is not a blur.
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
    // A pointer press already stepped on pointerdown; only a keyboard/AT
    // activation (detail === 0) steps here.
    if (disabled || event.detail !== 0 || !canStepInDirection(direction)) return;
    stepBy(direction);
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

  const resolvedButtonStyle = buttonStyle ? { ...BASE_BUTTON_STYLE, ...buttonStyle } : BASE_BUTTON_STYLE;
  const resolvedButtonClass = buttonClass ? `numeric-stepper-button ${buttonClass}` : 'numeric-stepper-button';

  return (
    <div class={className ? `numeric-stepper ${className}` : 'numeric-stepper'} style={WRAPPER_STYLE}>
      {children}
      <button
        type="button"
        class={resolvedButtonClass}
        style={resolvedButtonStyle}
        tabIndex={-1}
        disabled={disabled || decrementAtEnd}
        aria-label={`Decrease ${ariaLabel}`}
        onPointerDown={handlePressStart(-1)}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onClick={handleClick(-1)}
      >
        <Minus size={BUTTON_ICON_SIZE} aria-hidden="true" />
      </button>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        class={inputClass ? `numeric-stepper-input ${inputClass}` : 'numeric-stepper-input'}
        style={inputStyle ? { ...BASE_INPUT_STYLE, ...inputStyle } : BASE_INPUT_STYLE}
        value={display}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-disabled={ariaDisabled ? 'true' : undefined}
        aria-describedby={ariaDescribedBy}
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
      <button
        type="button"
        class={resolvedButtonClass}
        style={resolvedButtonStyle}
        tabIndex={-1}
        disabled={disabled || incrementAtEnd}
        aria-label={`Increase ${ariaLabel}`}
        onPointerDown={handlePressStart(1)}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onClick={handleClick(1)}
      >
        <Plus size={BUTTON_ICON_SIZE} aria-hidden="true" />
      </button>
    </div>
  );
}
