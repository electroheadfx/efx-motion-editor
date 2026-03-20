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
    <div class="px-3 py-2 space-y-3">
      <SectionLabel text={sectionTitle} />

      <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
        {/* Row 1: Duration + Curve */}
        <div class="flex items-center" style={{ gap: '16px' }}>
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
          <div class="relative shrink-0" style={{ width: '90px' }}>
            <select
              class="w-full text-[11px] rounded px-2 py-[3px] outline-none cursor-pointer appearance-none pr-5"
              style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)', borderRadius: '6px' }}
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
        </div>

        {/* Row 2: Mode toggle — fade-in/fade-out only */}
        {!isCrossDissolve && (
          <div class="flex items-center" style={{ gap: '16px' }}>
            <span class="shrink-0" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sidebar-text-secondary)', width: '34px' }}>Mode</span>
            <div class="flex gap-1 flex-1">
              <button
                class={`text-[11px] px-2 py-[3px] rounded flex-1 ${
                  transition.mode === 'transparency'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--sidebar-text-primary)]'
                }`}
                style={transition.mode !== 'transparency' ? { backgroundColor: 'var(--sidebar-input-bg)' } : undefined}
                onClick={() => {
                  sequenceStore.updateTransition(selection.sequenceId, selection.type, { mode: 'transparency' as FadeMode });
                }}
              >
                Transparency
              </button>
              <button
                class={`text-[11px] px-2 py-[3px] rounded flex-1 ${
                  transition.mode === 'solid'
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'text-[var(--sidebar-text-primary)]'
                }`}
                style={transition.mode !== 'solid' ? { backgroundColor: 'var(--sidebar-input-bg)' } : undefined}
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
                class="w-6 h-6 rounded cursor-pointer shrink-0"
                onInput={(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  sequenceStore.updateTransition(selection.sequenceId, selection.type, { color: target.value });
                }}
              />
            )}
          </div>
        )}

        {/* Row 3: Remove */}
        <div class="flex items-center" style={{ gap: '16px' }}>
          <button
            class="flex items-center gap-1.5 rounded px-2 py-[3px] text-[11px] hover:brightness-125 transition-colors"
            style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-secondary)' }}
            onClick={() => {
              sequenceStore.removeTransition(selection.sequenceId, selection.type);
              uiStore.selectTransition(null);
            }}
            title="Remove transition"
          >
            <Trash2 size={12} />
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}
