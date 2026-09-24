import { useCallback } from 'preact/hooks';
import { blurStore } from '../../stores/blurStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { NumericStepper } from './NumericStepper';

/** Small numeric input with the shared − [field] + treatment (52.2-03 D-23/D-24).
 *  Label is draggable: click-drag left/right on the label to scrub the value by step increments
 *  (or, in preset mode — 260924-ffd — one list entry per 4 px, clamped at the ends).
 *  The field itself (display format, clamp, commit on Enter/blur) lives in NumericStepper. */

/** Nearest list index to `value`, ties toward the lower entry (ascending list). */
function nearestPresetIndex(presets: readonly number[], value: number): number {
  let best = 0;
  let bestDistance = Math.abs(presets[0] - value);
  for (let index = 1; index < presets.length; index += 1) {
    const distance = Math.abs(presets[index] - value);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  }
  return best;
}

export function NumericInput({
  label,
  value,
  step,
  presets,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  /** Classic constant step — optional since 260924-ffd (defaults to 1 in the arithmetic, never NaN). */
  step?: number;
  /** PRESET MODE (260924-ffd): the label scrub walks this list, one entry per 4 px, clamped at the ends. */
  presets?: readonly number[];
  min?: number;
  max?: number;
  onChange: (val: number) => void;
}) {
  // Label drag-to-scrub: drag left/right on label to change value
  const handleLabelPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    startCoalescing();
    // Bypass blur during drag for performance
    let restoreBlur = false;
    if (!blurStore.isBypassed()) {
      blurStore.toggleBypass();
      restoreBlur = true;
    }
    let startX = e.clientX;
    let currentVal = value;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      // Every 4px of movement = 1 step (or 1 preset entry in preset mode)
      const steps = Math.trunc(dx / 4);
      if (steps !== 0) {
        startX += steps * 4;
        let newVal: number;
        if (presets && presets.length > 0) {
          // Preset mode (260924-ffd): index walk clamped at the list ends.
          const index = Math.min(
            presets.length - 1,
            Math.max(0, nearestPresetIndex(presets, currentVal) + steps),
          );
          newVal = presets[index];
        } else {
          // Classic mode: default step 1 before the arithmetic (never NaN).
          const effectiveStep = step ?? 1;
          newVal = currentVal + steps * effectiveStep;
          // Round to avoid floating-point drift
          newVal = Math.round(newVal / effectiveStep) * effectiveStep;
          if (min != null) newVal = Math.max(min, newVal);
          if (max != null) newVal = Math.min(max, newVal);
        }
        currentVal = newVal;
        onChange(newVal);
      }
    };

    const onUp = () => {
      stopCoalescing();
      if (restoreBlur) blurStore.toggleBypass();
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [value, step, presets, min, max, onChange]);

  return (
    <div class="flex items-center gap-4 flex-1 min-w-0">
      <span
        class="shrink-0 whitespace-nowrap select-none cursor-ew-resize"
        style={{width: '48px', fontSize: '12px', fontWeight: 500, color: 'var(--sidebar-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis'}}
        data-interactive
        onPointerDown={handleLabelPointerDown}
      >
        {label}
      </span>
      <NumericStepper
        class="flex-1 min-w-0"
        value={value}
        onChange={onChange}
        step={step}
        presets={presets}
        min={min}
        max={max}
        ariaLabel={label}
        inputClass="flex-1 min-w-0 w-full rounded outline-none"
        inputStyle={{
          fontSize: '12px',
          fontWeight: 400,
          color: 'var(--sidebar-text-primary)',
          backgroundColor: 'var(--sidebar-input-bg)',
          borderRadius: '4px',
          padding: '6px 10px',
          border: 'none',
          textAlign: 'left',
        }}
      />
    </div>
  );
}
