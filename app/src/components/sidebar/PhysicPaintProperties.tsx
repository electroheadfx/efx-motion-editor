import { useEffect, useState } from 'preact/hooks';
import { ChevronDown } from 'lucide-preact';
import type { BlendMode, Layer } from '../../types/layer';
import type { PhysicPaintApplyResult, PhysicPaintWorkflowMode } from '../../types/physicPaint';
import { layerStore } from '../../stores/layerStore';
import { physicPaintStore, physicPaintVersion } from '../../stores/physicPaintStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { timelineStore } from '../../stores/timelineStore';
import { projectStore } from '../../stores/projectStore';
import { openPhysicPaintCanvas, PHYSIC_PAINT_APPLY_RESULT_EVENT } from '../../lib/physicPaintBridge';
import { SectionLabel } from '../shared/SectionLabel';

interface PhysicPaintPropertiesProps {
  layer: Layer;
}

const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PhysicPaintProperties({ layer }: PhysicPaintPropertiesProps) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [openingMode, setOpeningMode] = useState<PhysicPaintWorkflowMode | null>(null);

  // Subscribe to explicit rendered-output invalidation while keeping Map storage non-reactive.
  physicPaintVersion.value;

  const currentFrame = timelineStore.currentFrame.value;
  const sourceLayerId = layer.source.type === 'physic-paint' ? layer.source.layerId : layer.id;
  const validContext = layer.type === 'physic-paint' && layer.source.type === 'physic-paint' && Number.isInteger(currentFrame) && currentFrame >= 0;
  const activePlayRange = validContext ? physicPaintStore.findPlayScriptRangeAtFrame(sourceLayerId, currentFrame) : null;
  const hasCurrentRotoFrame = validContext ? Boolean(physicPaintStore.getFrame(sourceLayerId, currentFrame)) : false;
  const hasOutput = validContext ? physicPaintStore.hasOutput(sourceLayerId) : false;
  useEffect(() => {
    const handleApplyResult = (event: Event) => {
      const result = (event as CustomEvent<PhysicPaintApplyResult>).detail;
      if (!result || result.layerId !== sourceLayerId) return;

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
  }, [sourceLayerId]);

  const handleOpenCanvas = async (mode: PhysicPaintWorkflowMode) => {
    const currentFrame = timelineStore.currentFrame.value;
    if (!validContext || openingMode || (mode === 'roto' && activePlayRange)) return;

    setOpeningMode(mode);
    setStatusMessage(mode === 'roto' ? 'Opening Roto paint...' : 'Opening Play paint...');
    setErrorMessage(null);

    console.info('[PhysicPaintProperties] open canvas clicked', { layerId: layer.id, frame: currentFrame, requestedWorkflowMode: mode });
    const result = await openPhysicPaintCanvas({
      layer,
      frame: currentFrame,
      canvas: {
        width: projectStore.width.value,
        height: projectStore.height.value,
      },
      fps: projectStore.fps.value,
      requestedWorkflowMode: mode,
    });

    console.info('[PhysicPaintProperties] open canvas result', result);
    setOpeningMode(null);
    if (result.ok) {
      if (mode === 'roto') {
        setStatusMessage(`Opened Roto paint at frame ${result.data.startFrame}.`);
      } else {
        const startFrame = result.data.playStartFrame ?? result.data.startFrame;
        const frameCount = result.data.playFrameCount ?? 1;
        const endFrame = startFrame + frameCount - 1;
        const previewFrame = result.data.previewFrame ?? 0;
        setStatusMessage(`Opened Play paint range ${startFrame}–${endFrame} at preview frame ${previewFrame}.`);
      }
    } else {
      setStatusMessage(null);
      setErrorMessage(result.error || 'Physics paint is not ready. Check that the layer, frame, canvas, and app bridge are available, then try again.');
    }
  };

  const deleteCurrentRotoFrame = () => {
    if (!validContext || !hasCurrentRotoFrame) return;
    physicPaintStore.removeFrameRange(sourceLayerId, currentFrame, 1);
    setErrorMessage(null);
    setStatusMessage(`Deleted Roto paint frame ${currentFrame}.`);
  };

  const deleteActivePlayRange = () => {
    if (!validContext || !activePlayRange) return;
    physicPaintStore.removeFrameRange(sourceLayerId, activePlayRange.startFrame, activePlayRange.frameCount);
    physicPaintStore.removePlayScriptRange(sourceLayerId, activePlayRange.id);
    const endFrame = activePlayRange.startFrame + activePlayRange.frameCount - 1;
    setErrorMessage(null);
    setStatusMessage(`Deleted Play paint range ${activePlayRange.startFrame}–${endFrame}.`);
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
        <SectionLabel text="Compositing" />
        <div class="flex items-center gap-3">
          <div class="relative shrink-0" style={{ width: '90px' }}>
            <select
              class="w-full text-[11px] rounded px-2 py-[3px] outline-none cursor-pointer appearance-none pr-5"
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
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(layer.opacity * 100)}
              class="flex-1 min-w-0 h-1 accent-(--color-accent) cursor-pointer"
              onPointerDown={startCoalescing}
              onPointerUp={stopCoalescing}
              onInput={(event) => {
                layerStore.updateLayerVisual(layer.id, {
                  opacity: parseInt((event.target as HTMLInputElement).value, 10) / 100,
                });
              }}
            />
            <span class="text-[11px] w-8 text-right shrink-0" style={{ color: 'var(--sidebar-text-primary)' }}>
              {Math.round(layer.opacity * 100)}%
            </span>
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
        {activePlayRange ? (
          <div class="space-y-2">
            <button
              type="button"
              class="w-full rounded px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
              disabled={!validContext || openingMode !== null}
              title="Open Play paint for the active script range."
              onClick={() => handleOpenCanvas('play')}
            >
              {openingMode === 'play' ? 'Opening Play paint...' : 'Play paint'}
            </button>
            <button
              type="button"
              class="w-full rounded px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--color-error-text)' }}
              disabled={!validContext}
              title="Delete the active Play paint script range."
              onClick={deleteActivePlayRange}
            >
              Delete Play
            </button>
          </div>
        ) : hasCurrentRotoFrame ? (
          <div class="space-y-2">
            <button
              type="button"
              class="w-full rounded px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
              disabled={!validContext || openingMode !== null}
              title="Open Roto paint at the current editor frame."
              onClick={() => handleOpenCanvas('roto')}
            >
              {openingMode === 'roto' ? 'Opening Roto paint...' : 'Roto paint'}
            </button>
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
          </div>
        ) : (
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              class="w-full rounded px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
              disabled={!validContext || openingMode !== null}
              title={validContext ? 'Open Roto paint at the current editor frame.' : 'Select a physics paint layer and frame first.'}
              onClick={() => handleOpenCanvas('roto')}
            >
              {openingMode === 'roto' ? 'Opening Roto paint...' : 'Roto paint'}
            </button>
            <button
              type="button"
              class="w-full rounded px-3 py-2 text-[12px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
              disabled={!validContext || openingMode !== null}
              title={validContext ? 'Open Play paint at the current editor frame.' : 'Select a physics paint layer and frame first.'}
              onClick={() => handleOpenCanvas('play')}
            >
              {openingMode === 'play' ? 'Opening Play paint...' : 'Play paint'}
            </button>
          </div>
        )}

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
