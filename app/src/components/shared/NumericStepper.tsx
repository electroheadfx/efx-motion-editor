import type { ComponentChildren, JSX } from 'preact';

/** Delay before a held − / + button starts repeating (D-24: hold-to-repeat after a short delay). */
export const NUMERIC_STEPPER_REPEAT_DELAY_MS = 400;

/** Interval between repeat steps once the hold delay has elapsed. */
export const NUMERIC_STEPPER_REPEAT_INTERVAL_MS = 60;

export interface NumericStepperProps {
  /** Controlled value — the stepper never owns domain state. */
  value: number;
  /** Called once per committed step (button press, hold-repeat, or field commit). */
  onChange: (value: number) => void;
  /** The field's own step (D-24: fps 0.5, everything else keeps its current step). */
  step: number;
  min?: number;
  max?: number;
  /** Display decimals for the default formatter (step >= 1 → integer, else up to 3). */
  precision?: number;
  ariaLabel: string;
  disabled?: boolean;
  /** Renders `aria-disabled` on the field (the Studio guarded-pattern contract). */
  ariaDisabled?: boolean;
  class?: string;
  inputClass?: string;
  inputStyle?: JSX.CSSProperties;
  buttonClass?: string;
  buttonStyle?: JSX.CSSProperties;
  /** Optional leading content — the NumericInput label + drag-to-scrub wrapper. */
  children?: ComponentChildren;
}

export function NumericStepper(_props: NumericStepperProps): JSX.Element | null {
  return null;
}
