import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Layer } from '../../types/layer';
import type { PhysicPaintApplyResult } from '../../types/physicPaint';
import { physicPaintStore, physicPaintVersion } from '../../stores/physicPaintStore';
import { sequenceStore } from '../../stores/sequenceStore';
import { timelineStore } from '../../stores/timelineStore';
import { openPhysicPaintCanvas, PHYSIC_PAINT_APPLY_RESULT_EVENT } from '../../lib/physicPaintBridge';
import { SectionLabel } from '../shared/SectionLabel';

interface PhysicPaintPropertiesProps {
  layer: Layer;
}

export function PhysicPaintProperties({ layer }: PhysicPaintPropertiesProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  // Subscribe to explicit rendered-output invalidation while keeping Map storage non-reactive.
  physicPaintVersion.value;

  const currentFrame = timelineStore.currentFrame.value;
  const validContext = layer.type === 'physic-paint' && layer.source.type === 'physic-paint' && Number.isInteger(currentFrame) && currentFrame >= 0;
  const hasOutput = validContext ? physicPaintStore.hasOutput(layer.id) : false;
  const activeSequence = useMemo(() => {
    const activeSequenceId = sequenceStore.activeSequenceId.value;
    return activeSequenceId ? sequenceStore.sequences.value.find((seq) => seq.id === activeSequenceId) ?? null : null;
  }, [sequenceStore.activeSequenceId.value, sequenceStore.sequences.value]);

  useEffect(() => {
    const handleApplyResult = (event: Event) => {
      const result = (event as CustomEvent<PhysicPaintApplyResult>).detail;
      if (!result || result.layerId !== layer.id) return;

      if (!result.ok) {
        setErrorMessage(result.error || 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.');
        return;
      }

      setErrorMessage(null);
      setStatusMessage(result.kind === 'apply-play-canvas'
        ? `Applied ${result.appliedFrameCount} frames starting at frame ${result.startFrame}`
        : `Applied to frame ${result.startFrame}`);
    };

    window.addEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleApplyResult);
    return () => window.removeEventListener(PHYSIC_PAINT_APPLY_RESULT_EVENT, handleApplyResult);
  }, [layer.id]);

  const handleOpenCanvas = async () => {
    if (!validContext || isOpening) return;

    setIsOpening(true);
    setStatusMessage(null);
    setErrorMessage(null);

    console.info('[PhysicPaintProperties] open canvas clicked', { layerId: layer.id, frame: currentFrame });
    const result = await openPhysicPaintCanvas({
      layer,
      frame: currentFrame,
      canvas: activeSequence ? { width: activeSequence.width, height: activeSequence.height } : undefined,
    });

    console.info('[PhysicPaintProperties] open canvas result', result);
    setIsOpening(false);
    if (result.ok) {
      setStatusMessage(`Opened physics paint canvas for frame ${result.data.startFrame}.`);
    } else {
      setErrorMessage(result.error || 'Physics paint is not ready. Check that the layer, frame, canvas, and app bridge are available, then try again.');
    }
  };

  return (
    <div class="px-3 py-2 space-y-3 text-[13px]" style={{ color: 'var(--sidebar-text-primary)' }}>
      <div class="space-y-1">
        <SectionLabel text="Physics Paint" />
        <div class="rounded px-2 py-2 space-y-1" style={{ backgroundColor: 'var(--sidebar-input-bg)' }}>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold" style={{ color: 'var(--sidebar-text-secondary)' }}>Layer</span>
            <span class="text-[11px] truncate" title={layer.name}>{layer.name}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold" style={{ color: 'var(--sidebar-text-secondary)' }}>Layer ID</span>
            <span class="text-[10px] truncate font-mono" title={layer.id}>{layer.id}</span>
          </div>
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-semibold" style={{ color: 'var(--sidebar-text-secondary)' }}>Current frame</span>
            <span class="text-[11px] tabular-nums">{currentFrame}</span>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        <SectionLabel text="Rendered Output" />
        {hasOutput ? (
          <div class="space-y-1">
            <div class="rounded px-2 py-2 text-[11px] flex items-center gap-2" style={{ backgroundColor: 'rgba(76, 175, 112, 0.14)', color: 'var(--sidebar-dot-green)' }}>
              <span class="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--sidebar-dot-green)' }} />
              Physics paint output is available for this layer.
            </div>
            <div class="text-[11px] leading-5" style={{ color: '#f59e0b' }}>
              This frame already has physics paint output. Applying will replace it.
            </div>
          </div>
        ) : (
          <div class="rounded px-2 py-2 space-y-1" style={{ backgroundColor: 'var(--sidebar-input-bg)' }}>
            <div class="text-[12px] font-semibold">No physics paint output yet</div>
            <div class="text-[11px] leading-5" style={{ color: 'var(--sidebar-text-secondary)' }}>
              Open the physics paint canvas, paint in the standalone window, then apply the rendered result to this layer.
            </div>
          </div>
        )}
      </div>

      <div class="space-y-2">
        <SectionLabel text="Standalone Canvas" />
        <button
          type="button"
          class="w-full rounded px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          disabled={!validContext || isOpening}
          title={validContext ? 'Open the standalone physics paint canvas' : 'Select a physics paint layer and frame first.'}
          onClick={handleOpenCanvas}
        >
          {isOpening ? 'Opening physics paint canvas...' : '[open fx paint canvas]'}
        </button>

        {!validContext && (
          <div class="text-[11px] leading-5" style={{ color: '#f59e0b' }}>
            Select a physics paint layer and frame first.
          </div>
        )}
        {statusMessage && (
          <div class="text-[11px] leading-5" style={{ color: 'var(--sidebar-dot-green)' }}>
            {statusMessage}
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
