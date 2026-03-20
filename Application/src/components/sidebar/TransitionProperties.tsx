import { Trash2 } from 'lucide-preact';
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

  const totalFrames = seq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0);
  const maxDuration = Math.max(1, Math.floor(totalFrames / 2));

  const sectionTitle = selection.type === 'fade-in' ? 'FADE IN'
    : selection.type === 'fade-out' ? 'FADE OUT'
    : 'CROSS DISSOLVE';

  return (
    <div class="flex flex-col gap-1.5 px-2">
      <SectionLabel text={sectionTitle} />

      {/* Line 1: Duration + Curve */}
      <div class="flex items-center gap-1">
        <div class="flex-1">
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
        </div>
        <select
          class="text-[10px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-1 py-[3px] w-[72px]"
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

      {/* Line 2: Mode toggle — fade-in/fade-out only */}
      {!isCrossDissolve && (
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-[var(--color-text-muted)] w-[34px] shrink-0">Mode</span>
          <div class="flex gap-0.5 flex-1">
            <button
              class={`text-[10px] px-2 py-0.5 rounded flex-1 ${
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
              class={`text-[10px] px-2 py-0.5 rounded flex-1 ${
                transition.mode === 'solid'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-input)] text-[var(--color-text-muted)]'
              }`}
              onClick={() => {
                sequenceStore.updateTransition(selection.sequenceId, selection.type, { mode: 'solid' as FadeMode });
              }}
            >
              Solid
            </button>
          </div>
          {transition.mode === 'solid' && (
            <input
              type="color"
              value={transition.color}
              class="w-5 h-5 rounded cursor-pointer shrink-0"
              onInput={(e: Event) => {
                const target = e.target as HTMLInputElement;
                sequenceStore.updateTransition(selection.sequenceId, selection.type, { color: target.value });
              }}
            />
          )}
        </div>
      )}

      {/* Line 3: Remove button */}
      <button
        class="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-error-text)] rounded px-1 py-0.5 self-start"
        onClick={() => {
          sequenceStore.removeTransition(selection.sequenceId, selection.type);
          uiStore.selectTransition(null);
        }}
        title="Remove transition"
      >
        <Trash2 size={11} />
        Remove
      </button>
    </div>
  );
}
