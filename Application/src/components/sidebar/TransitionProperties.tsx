import { useState } from 'preact/hooks';
import { Trash2 } from 'lucide-preact';
import { sequenceStore } from '../../stores/sequenceStore';
import { uiStore, type TransitionSelection } from '../../stores/uiStore';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import { ColorPickerModal } from '../shared/ColorPickerModal';
import type { FadeMode } from '../../types/sequence';
import type { EasingType } from '../../types/layer';

interface TransitionPropertiesProps {
  selection: NonNullable<TransitionSelection>;
}

export function TransitionProperties({ selection }: TransitionPropertiesProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const allSeqs = sequenceStore.sequences.value;
  const seq = allSeqs.find(s => s.id === selection.sequenceId);
  if (!seq) return null;

  // GL transition properties handled by Plan 03 — bail out here
  if (selection.type === 'gl-transition') return null;

  // After the gl-transition guard above, type is narrowed to TransitionType
  const selType = selection.type as 'fade-in' | 'fade-out' | 'cross-dissolve';

  const transition = selType === 'fade-in' ? seq.fadeIn
    : selType === 'fade-out' ? seq.fadeOut
    : seq.crossDissolve;
  if (!transition) return null;

  const isCrossDissolve = selType === 'cross-dissolve';

  const totalFrames = seq.kind === 'content'
    ? seq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0)
    : (seq.outFrame ?? 100) - (seq.inFrame ?? 0);
  const maxDuration = Math.max(1, Math.floor(totalFrames / 2));
  const isFxSeq = seq.kind !== 'content';

  const sectionTitle = selType === 'fade-in' ? 'FADE IN'
    : selType === 'fade-out' ? 'FADE OUT'
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
              sequenceStore.updateTransition(selection.sequenceId, selType, { duration: v });
            }}
          />
          <div class="relative shrink-0" style={{ width: '90px' }}>
            <select
              class="w-full text-[11px] rounded px-2 py-[3px] outline-none cursor-pointer appearance-none pr-5"
              style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)', borderRadius: '6px' }}
              value={transition.curve}
              onChange={(e: Event) => {
                const target = e.target as HTMLSelectElement;
                sequenceStore.updateTransition(selection.sequenceId, selType, { curve: target.value as EasingType });
              }}
            >
              <option value="linear">Linear</option>
              <option value="ease-in">Ease In</option>
              <option value="ease-out">Ease Out</option>
              <option value="ease-in-out">Ease In-Out</option>
            </select>
          </div>
        </div>

        {/* Row 2: Mode toggle — content sequences only (FX always use transparency) */}
        {!isCrossDissolve && !isFxSeq && (
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
                  sequenceStore.updateTransition(selection.sequenceId, selType, { mode: 'transparency' as FadeMode });
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
                  sequenceStore.updateTransition(selection.sequenceId, selType, { mode: 'solid' as FadeMode });
                }}
              >
                Solid
              </button>
            </div>
            {transition.mode === 'solid' && (
              <>
                <div
                  class="w-6 h-6 rounded cursor-pointer shrink-0 border border-[var(--sidebar-border-unselected)]"
                  style={{ backgroundColor: transition.color || '#000000' }}
                  onClick={() => setColorPickerOpen(true)}
                  title="Pick color"
                />
                {colorPickerOpen && (
                  <ColorPickerModal
                    color={transition.color || '#000000'}
                    onCommit={(c) => {
                      sequenceStore.updateTransition(selection.sequenceId, selType, { color: c });
                    }}
                    onClose={() => setColorPickerOpen(false)}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* Row 3: Remove */}
        <div class="flex items-center" style={{ gap: '16px' }}>
          <button
            class="flex items-center gap-1.5 rounded px-2 py-[3px] text-[11px] hover:brightness-125 transition-colors"
            style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-secondary)' }}
            onClick={() => {
              sequenceStore.removeTransition(selection.sequenceId, selType);
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
