import { useState, useCallback } from 'preact/hooks';
import { blurStore } from '../../stores/blurStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';

/** Small numeric input with local editing state -- commits on Enter/blur, reverts on Escape.
 *  Label is draggable: click-drag left/right on the label to scrub the value by step increments. */
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
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState('');
  const [isDraggingLabel, setIsDraggingLabel] = useState(false);

  const formatDisplay = useCallback(
    (v: number) => (step < 1 ? v.toFixed(2) : String(v)),
    [step],
  );

  const commitValue = useCallback(() => {
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      let clamped = parsed;
      if (min != null) clamped = Math.max(min, clamped);
      if (max != null) clamped = Math.min(max, clamped);
      if (clamped !== value) {
        onChange(clamped);
      }
    }
    setIsEditing(false);
    stopCoalescing();
  }, [localValue, min, max, value, onChange]);

  const revertValue = useCallback(() => {
    setIsEditing(false);
    stopCoalescing();
  }, []);

  // Label drag-to-scrub: drag left/right on label to change value
  const handleLabelPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    setIsDraggingLabel(true);
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
      setIsDraggingLabel(false);
      stopCoalescing();
      if (restoreBlur) blurStore.toggleBypass();
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };

    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }, [value, step, min, max, onChange]);

  return (
    <div class="flex items-center gap-1">
      <span
        class={`text-[10px] text-[var(--color-text-muted)] whitespace-nowrap select-none ${isDraggingLabel ? 'cursor-ew-resize' : 'cursor-ew-resize'}`}
        data-interactive
        onPointerDown={handleLabelPointerDown}
      >
        {label}
      </span>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={isEditing ? localValue : formatDisplay(value)}
        class="w-16 text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-2 py-[5px] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        onFocus={() => {
          setIsEditing(true);
          setLocalValue(formatDisplay(value));
          startCoalescing();
        }}
        onInput={(e) => {
          setLocalValue((e.target as HTMLInputElement).value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitValue();
            (e.target as HTMLInputElement).blur();
          } else if (e.key === 'Escape') {
            revertValue();
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={commitValue}
      />
    </div>
  );
}
