import { useState } from 'preact/hooks';
import { Trash2 } from 'lucide-preact';
import { sequenceStore } from '../../stores/sequenceStore';
import { uiStore, type TransitionSelection } from '../../stores/uiStore';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import { ColorPickerModal } from '../shared/ColorPickerModal';
import { getShaderById } from '../../lib/shaderLibrary';
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

  // GL transition editing panel
  if (selection.type === 'gl-transition') {
    const glt = seq.glTransition;
    if (!glt) return null;
    const shaderDef = getShaderById(glt.shaderId);
    if (!shaderDef) return null;

    // Max duration considers BOTH sequences since overlap spans the boundary.
    // Half extends into outgoing, half into incoming.
    const outFrames = seq.kind === 'content'
      ? seq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0)
      : (seq.outFrame ?? 100) - (seq.inFrame ?? 0);
    const contentSeqs = allSeqs.filter(s => s.kind === 'content');
    const seqIdx = contentSeqs.findIndex(s => s.id === seq.id);
    const nextSeq = seqIdx >= 0 ? contentSeqs[seqIdx + 1] : undefined;
    const inFrames = nextSeq
      ? nextSeq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0)
      : outFrames;
    const maxDuration = Math.max(1, 2 * Math.floor(Math.min(outFrames, inFrames) / 2));

    return (
      <div class="px-3 py-2 space-y-3">
        <SectionLabel text="GL TRANSITION" />

        <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
          {/* Shader name — clickable to reopen browser for swapping (D-04) */}
          <button
            class="text-left text-[11px] font-medium px-2 py-1 rounded hover:bg-(--color-bg-hover-item) cursor-pointer transition-colors"
            style={{ color: 'var(--sidebar-text-primary)', backgroundColor: 'var(--sidebar-input-bg)', borderRadius: '6px' }}
            onClick={() => { uiStore.shaderBrowserInitialTab.value = 'transition'; uiStore.setEditorMode('shader-browser'); }}
            title="Click to swap transition"
          >
            {shaderDef.name}
          </button>

          {/* Duration + Curve row */}
          <div class="flex items-center" style={{ gap: '16px' }}>
            <NumericInput
              label="Duration"
              value={glt.duration}
              min={1}
              max={maxDuration}
              step={1}
              onChange={(v: number) => {
                sequenceStore.updateGlTransition(selection.sequenceId, { duration: v });
              }}
            />
            <div class="relative shrink-0" style={{ width: '90px' }}>
              <select
                class="w-full text-[11px] rounded px-2 py-[3px] outline-none cursor-pointer appearance-none pr-5"
                style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)', borderRadius: '6px' }}
                value={glt.curve}
                onChange={(e: Event) => {
                  sequenceStore.updateGlTransition(selection.sequenceId, { curve: (e.target as HTMLSelectElement).value as EasingType });
                }}
              >
                <option value="linear">Linear</option>
                <option value="ease-in">Ease In</option>
                <option value="ease-out">Ease Out</option>
                <option value="ease-in-out">Ease In-Out</option>
                <option value="ease-in-cubic">Ease In Cubic</option>
                <option value="ease-out-cubic">Ease Out Cubic</option>
                <option value="ease-in-out-cubic">Ease In-Out Cubic</option>
              </select>
            </div>
          </div>

          {/* Shader parameters — sliders and color pickers (per D-11) */}
          {shaderDef.params.filter(p => !p.hidden).map(p => {
            if (p.colorGroup) {
              // Color picker for grouped R/G/B params
              const groupParams = shaderDef.params.filter(gp => gp.colorGroup === p.colorGroup);
              if (groupParams[0]?.key !== p.key) return null; // only render once per group
              const r = glt.params[groupParams[0]?.key] ?? groupParams[0]?.default ?? 0;
              const g = glt.params[groupParams[1]?.key] ?? groupParams[1]?.default ?? 0;
              const b = glt.params[groupParams[2]?.key] ?? groupParams[2]?.default ?? 0;
              return (
                <div key={p.colorGroup} class="flex items-center" style={{ gap: '8px' }}>
                  <span class="text-[10px]" style={{ color: 'var(--sidebar-text-secondary)', width: '60px' }}>
                    {p.colorGroup}
                  </span>
                  <button
                    class="w-6 h-6 rounded border cursor-pointer"
                    style={{
                      backgroundColor: `rgb(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)})`,
                      borderColor: 'var(--color-border-subtle)',
                    }}
                    onClick={() => setColorPickerOpen(true)}
                  />
                  {colorPickerOpen && (
                    <ColorPickerModal
                      color={`#${Math.round(r*255).toString(16).padStart(2,'0')}${Math.round(g*255).toString(16).padStart(2,'0')}${Math.round(b*255).toString(16).padStart(2,'0')}`}
                      onCommit={(hex) => {
                        const rr = parseInt(hex.slice(1,3), 16) / 255;
                        const gg = parseInt(hex.slice(3,5), 16) / 255;
                        const bb = parseInt(hex.slice(5,7), 16) / 255;
                        const newParams = { ...glt.params };
                        if (groupParams[0]) newParams[groupParams[0].key] = rr;
                        if (groupParams[1]) newParams[groupParams[1].key] = gg;
                        if (groupParams[2]) newParams[groupParams[2].key] = bb;
                        sequenceStore.updateGlTransitionParams(selection.sequenceId, newParams);
                      }}
                      onClose={() => setColorPickerOpen(false)}
                    />
                  )}
                </div>
              );
            }
            return (
              <div key={p.key} class="flex items-center" style={{ gap: '8px' }}>
                <span class="text-[10px]" style={{ color: 'var(--sidebar-text-secondary)', width: '60px' }}>
                  {p.label}
                </span>
                <input
                  type="range"
                  min={p.min ?? 0}
                  max={p.max ?? 1}
                  step={p.step ?? 0.01}
                  value={glt.params[p.key] ?? p.default}
                  class="flex-1"
                  style={{ accentColor: '#8B5CF6' }}
                  onInput={(e: Event) => {
                    const val = parseFloat((e.target as HTMLInputElement).value);
                    const newParams = { ...glt.params, [p.key]: val };
                    sequenceStore.updateGlTransitionParams(selection.sequenceId, newParams);
                  }}
                />
                <span class="text-[10px] w-8 text-right" style={{ color: 'var(--sidebar-text-dim)' }}>
                  {(glt.params[p.key] ?? p.default).toFixed(1)}
                </span>
              </div>
            );
          })}

          {/* Remove button */}
          <button
            class="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded cursor-pointer transition-colors hover:bg-red-500/20 text-red-400"
            onClick={() => {
              sequenceStore.removeGlTransition(selection.sequenceId);
              uiStore.selectTransition(null);
            }}
          >
            <Trash2 size={12} />
            Remove Transition
          </button>
        </div>
      </div>
    );
  }

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
                    ? 'bg-(--color-accent) text-white'
                    : 'text-(--sidebar-text-primary)'
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
                    ? 'bg-(--color-accent) text-white'
                    : 'text-(--sidebar-text-primary)'
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
                  class="w-6 h-6 rounded cursor-pointer shrink-0 border border-(--sidebar-border-unselected)"
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
