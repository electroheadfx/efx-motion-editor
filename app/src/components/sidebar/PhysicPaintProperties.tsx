import { useEffect, useState } from 'preact/hooks';
import { ChevronDown } from 'lucide-preact';
import type { BlendMode, Layer } from '../../types/layer';
import type { PhysicPaintApplyResult } from '../../types/physicPaint';
import { layerStore } from '../../stores/layerStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { getDocument as getEfxPaintDocument } from '../../stores/efxPaintStore';
import { physicPaintStore, physicPaintVersion } from '../../stores/physicPaintStore';
import { timelineStore } from '../../stores/timelineStore';
import { openPhysicPaintForLayer, PHYSIC_PAINT_APPLY_RESULT_EVENT } from '../../lib/physicPaintBridge';
import { SliderStepper } from '../shared/SliderStepper';

/** Section heading reads like a field label (no wide tracking). */
function PaintSectionLabel({ text }: { text: string }) {
  return (
    <span class="text-[11px] font-semibold" style={{ color: 'var(--sidebar-text-secondary)' }}>{text}</span>
  );
}

interface PhysicPaintPropertiesProps {
  layer: Layer;
}

const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PhysicPaintProperties({ layer }: PhysicPaintPropertiesProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);

  // Subscribe to explicit rendered-output invalidation while keeping Map storage non-reactive.
  physicPaintVersion.value;

  const currentFrame = timelineStore.currentFrame.value;
  const sourceLayerId = layer.source.type === 'physic-paint' ? layer.source.layerId : layer.id;
  const validContext = layer.type === 'physic-paint' && layer.source.type === 'physic-paint' && Number.isInteger(currentFrame) && currentFrame >= 0;
  // 46-01: runtime state is per-track; this sidebar reads the document's ACTIVE track.
  const activeTrackId = layer.type === 'physic-paint' && layer.source.type === 'physic-paint'
    ? (getEfxPaintDocument(sourceLayerId)?.activeTrackId ?? '')
    : '';
  const hasCurrentRotoFrame = validContext ? Boolean(physicPaintStore.getFrame(sourceLayerId, activeTrackId, currentFrame)) : false;

  // Display-only identity: layer.id stays the persisted identifier everywhere else.
  const parentLayerSequence = sequenceStore.sequences.value.find((sequence) => (
    sequence.layers.some((candidate) => candidate.id === layer.id)
  ));
  const physicPaintOrdinal = parentLayerSequence
    ? parentLayerSequence.layers.filter((candidate) => candidate.type === 'physic-paint')
      .findIndex((candidate) => candidate.id === layer.id) + 1
    : 1;
  const displayName = layer.name.trim() || `Physics paint ${physicPaintOrdinal}`;
  useEffect(() => {
    const handleApplyResult = (event: Event) => {
      const result = (event as CustomEvent<PhysicPaintApplyResult>).detail;
      if (!result || result.layerId !== sourceLayerId) return;

      if (!result.ok) {
        setErrorMessage(result.error || 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.');
        return;
      }

      setErrorMessage(null);
    };

    window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleApplyResult);
    return () => window.removeEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleApplyResult);
  }, [sourceLayerId]);

  const handleOpenCanvas = async () => {
    if (!validContext || opening) return;

    setOpening(true);
    setErrorMessage(null);

    console.info('[PhysicPaintProperties] open canvas clicked', { layerId: layer.id });
    const result = await openPhysicPaintForLayer(layer);

    console.info('[PhysicPaintProperties] open canvas result', result);
    setOpening(false);
    if (!result.ok) {
      setErrorMessage(result.error || 'Physics paint is not ready. Check that the layer, frame, canvas, and app bridge are available, then try again.');
    }
  };

  const handleRowBodyDoubleClick = (event: MouseEvent) => {
    event.stopPropagation();
    handleOpenCanvas();
  };

  const handleNameLabelDoubleClick = (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const deleteCurrentRotoFrame = () => {
    if (!validContext || !hasCurrentRotoFrame) return;
    physicPaintStore.removeFrameRange(sourceLayerId, activeTrackId, currentFrame, 1);
    setErrorMessage(null);
  };



  return (
    <div class="px-3 py-2 space-y-8 text-[13px]" style={{ color: 'var(--sidebar-text-primary)' }}>
      <div class="space-y-1">
        <PaintSectionLabel text="Physics Paint" />
        <div
          class="rounded px-2 py-2 space-y-1 cursor-pointer"
          style={{ backgroundColor: 'var(--sidebar-input-bg)', borderLeft: '2px solid var(--color-accent)' }}
          onDblClick={handleRowBodyDoubleClick}
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold" style={{ color: 'var(--sidebar-text-secondary)' }}>Layer</span>
            <span class="text-[11px] truncate" title={displayName} onDblClick={handleNameLabelDoubleClick}>{displayName}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold" style={{ color: 'var(--sidebar-text-secondary)' }}>Current frame</span>
            <span class="text-[11px] tabular-nums">{currentFrame}</span>
          </div>
        </div>
      </div>

      <div class="flex items-end gap-3">
        <div class="flex flex-1 min-w-0 flex-col gap-1">
          <span class="flex h-[17px] items-center text-[11px] font-semibold" style={{ color: 'var(--sidebar-text-secondary)' }}>
            Blend mode
          </span>
          <div class="relative">
            <select
              class="w-full h-[22px] leading-[22px] text-[11px] rounded px-2 py-0 outline-none cursor-pointer appearance-none pr-5"
              style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)', borderRadius: '6px' }}
              value={layer.blendMode}
              onChange={(event) => {
                layerStore.updateLayerVisual(layer.id, {
                  blendMode: (event.target as HTMLSelectElement).value as BlendMode,
                });
              }}
            >
              {BLEND_MODES.map((mode) => (
                <option key={mode} value={mode}>{capitalize(mode)}</option>
              ))}
            </select>
            <ChevronDown size={10} class="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--sidebar-text-secondary)' }} />
          </div>
        </div>
        <SliderStepper
          label="Opacity"
          value={Math.round(layer.opacity * 100)}
          step={1}
          min={0}
          max={100}
          ariaLabel="Opacity"
          onChange={(next) => {
            layerStore.updateLayerVisual(layer.id, { opacity: next / 100 });
          }}
        />
      </div>

      <div class="space-y-2">
        <div class="space-y-2">
          <button
            type="button"
            class="w-full rounded px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
            disabled={!validContext || opening}
            title="Open Roto paint at the current editor frame."
            onClick={handleOpenCanvas}
          >
            {opening ? 'Opening Roto paint...' : 'Roto paint'}
          </button>
          {hasCurrentRotoFrame ? (
            <button
              type="button"
              class="w-full rounded px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--color-error-text)' }}
              disabled={!validContext}
              title="Delete the Roto paint frame at the current editor frame."
              onClick={deleteCurrentRotoFrame}
            >
              Delete Roto
            </button>
          ) : null}
        </div>

        {!validContext && (
          <div class="text-[11px] leading-5" style={{ color: '#f59e0b' }}>
            Select a physics paint layer and frame first.
          </div>
        )}
        {errorMessage && (
          <div class="text-[11px] leading-5" style={{ color: 'var(--color-error-text)' }}>
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}
