import { useCallback } from 'preact/hooks';
import { blurStore } from '../../stores/blurStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { NumericStepper } from './NumericStepper';

/** Small numeric input with the shared − [field] + treatment (52.2-03 D-23/D-24).
 *  Label is draggable: click-drag left/right on the label to scrub the value by step increments.
 *  The field itself (display format, clamp, commit on Enter/blur) lives in NumericStepper. */
export function NumericInput({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
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
      // Every 4px of movement = 1 step
      const steps = Math.trunc(dx / 4);
      if (steps !== 0) {
        startX += steps * 4;
        let newVal = currentVal + steps * step;
        // Round to avoid floating-point drift
        newVal = Math.round(newVal / step) * step;
        if (min != null) newVal = Math.max(min, newVal);
        if (max != null) newVal = Math.min(max, newVal);
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
  }, [value, step, min, max, onChange]);

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
