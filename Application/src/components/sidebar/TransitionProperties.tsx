import { sequenceStore } from '../../stores/sequenceStore';
import { uiStore, type TransitionSelection } from '../../stores/uiStore';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import type { FadeMode } from '../../types/sequence';
import type { EasingType } from '../../types/layer';

interface TransitionPropertiesProps {
  selection: NonNullable<TransitionSelection>;
}

export function TransitionProperties({ selection }: TransitionPropertiesProps) {
  const allSeqs = sequenceStore.sequences.value;
  const seq = allSeqs.find(s => s.id === selection.sequenceId);
  if (!seq) return null;

  const transition = selection.type === 'fade-in' ? seq.fadeIn
    : selection.type === 'fade-out' ? seq.fadeOut
    : seq.crossDissolve;
  if (!transition) return null;

  const isCrossDissolve = selection.type === 'cross-dissolve';

  // Compute max duration: half the sequence total frames
  const totalFrames = seq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0);
  const maxDuration = Math.max(1, Math.floor(totalFrames / 2));

  const sectionTitle = selection.type === 'fade-in' ? 'FADE IN'
    : selection.type === 'fade-out' ? 'FADE OUT'
    : 'CROSS DISSOLVE';

  return (
    <div class="flex flex-col gap-2 px-2">
      <SectionLabel text={sectionTitle} />

      {/* Row 1: Duration (per D-22) */}
      <NumericInput
        label="Duration"
        value={transition.duration}
        min={1}
        max={maxDuration}
        step={1}
        onChange={(v: number) => {
          sequenceStore.updateTransition(selection.sequenceId, selection.type, { duration: v });
        }}
      />

      {/* Row 2: Mode toggle -- fade-in/fade-out only (per D-23, D-26) */}
      {!isCrossDissolve && (
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">Mode</span>
          <div class="flex gap-0.5">
            <button
              class={`text-[10px] px-2 py-1 rounded ${
                transition.mode === 'transparency'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'
              }`}
              onClick={() => {
                sequenceStore.updateTransition(selection.sequenceId, selection.type, { mode: 'transparency' as FadeMode });
              }}
            >
              Transparency
            </button>
            <button
              class={`text-[10px] px-2 py-1 rounded ${
                transition.mode === 'solid'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'
              }`}
              onClick={() => {
                sequenceStore.updateTransition(selection.sequenceId, selection.type, { mode: 'solid' as FadeMode });
              }}
            >
              Solid Color
            </button>
          </div>
        </div>
      )}

      {/* Row 3: Color picker -- visible only in Solid mode (per D-24) */}
      {!isCrossDissolve && transition.mode === 'solid' && (
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">Color</span>
          <input
            type="color"
            value={transition.color}
            class="w-6 h-6 rounded cursor-pointer"
            onInput={(e: Event) => {
              const target = e.target as HTMLInputElement;
              sequenceStore.updateTransition(selection.sequenceId, selection.type, { color: target.value });
            }}
          />
        </div>
      )}

      {/* Row 4: Curve dropdown (per D-25) */}
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">Curve</span>
        <select
          class="flex-1 text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-1 py-0.5"
          value={transition.curve}
          onChange={(e: Event) => {
            const target = e.target as HTMLSelectElement;
            sequenceStore.updateTransition(selection.sequenceId, selection.type, { curve: target.value as EasingType });
          }}
        >
          <option value="linear">Linear</option>
          <option value="ease-in">Ease In</option>
          <option value="ease-out">Ease Out</option>
          <option value="ease-in-out">Ease In-Out</option>
        </select>
      </div>

      {/* Row 5: Remove Transition button */}
      <button
        class="text-[10px] text-[var(--color-error-text)] hover:bg-[var(--color-error-bg)] rounded px-2 py-1 text-left mt-1"
        onClick={() => {
          sequenceStore.removeTransition(selection.sequenceId, selection.type);
          uiStore.selectTransition(null);
        }}
      >
        Remove Transition
      </button>
    </div>
  );
}
