import { useEffect, useRef } from 'preact/hooks';
import { Minus, Plus } from 'lucide-preact';
import type { ComponentChildren, JSX } from 'preact';
import { startCoalescing, stopCoalescing } from '../../lib/history';

/**
 * 52.2-03 (D-23/D-24): the shared `− [field] +` numeric treatment.
 *
 * One component owns the layout and the commit contract for every numeric
 * field in the app: the field's own `step`, its `min`/`max` clamp, keyboard
 * editing, and hold-to-repeat after a short delay. Every emission — button
 * press, repeat, or typed commit — passes the SAME clamp + round-to-step path
 * (T-52.2-08), so no path can produce an out-of-range or off-grid value.
 *
 * The press gesture is bracketed by `startCoalescing`/`stopCoalescing` so a
 * held button collapses to a single undo entry (same discipline as the label
 * drag-to-scrub in NumericInput).
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
  /** The field's own step (D-24: fps 0.5, everything else keeps its current step). */
  step: number;
  /**
   * Variable-step fields (grain scale): the effective step for each emission is
   * resolved from the LIVE base value, so a hold-to-repeat crossing a band
   * boundary switches step mid-hold instead of keeping the press-start step.
   * Falls back to `step` when absent.
   */
  resolveStep?: (value: number) => number;
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
export function formatStepperValue(value: number, step: number, precision?: number): string {
  const decimals = precision ?? (step >= 1 ? 0 : 3);
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
  step,
  resolveStep,
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

  const display = formatStepperValue(value, step, precision);

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

  /** Every emission route funnels through here: snap to step, clamp, compare. */
  const stepBy = (direction: 1 | -1) => {
    const typed = parseFloat(inputRef.current?.value ?? '');
    const base = Number.isFinite(typed) ? typed : value;
    const effectiveStep = resolveStep ? resolveStep(base) : step;
    const next = clampToStep(base + direction * effectiveStep, effectiveStep, min, max);
    if (next !== value) onChange(next);
  };

  const handlePressStart = (direction: 1 | -1) => (event: JSX.TargetedPointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
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
    if (disabled || event.detail !== 0) return;
    stepBy(direction);
  };

  const commitInput = (element: HTMLInputElement) => {
    const parsed = parseFloat(element.value);
    if (Number.isFinite(parsed)) {
      const effectiveStep = resolveStep ? resolveStep(parsed) : step;
      const next = clampToStep(parsed, effectiveStep, min, max);
      if (next !== value) onChange(next);
      element.value = formatStepperValue(next, step, precision);
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
        disabled={disabled}
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
        disabled={disabled}
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
