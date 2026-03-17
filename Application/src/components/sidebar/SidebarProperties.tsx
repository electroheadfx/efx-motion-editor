import { useEffect } from 'preact/hooks';
import { ChevronDown } from 'lucide-preact';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
import { KeyframeNavBar } from './KeyframeNavBar';
import { InlineInterpolation } from './InlineInterpolation';
import { layerStore } from '../../stores/layerStore';
import { keyframeStore } from '../../stores/keyframeStore';
import { timelineStore } from '../../stores/timelineStore';
import { blurStore } from '../../stores/blurStore';
import { startCoalescing, stopCoalescing } from '../../lib/history';
import { isFxLayer } from '../../types/layer';
import type { Layer, BlendMode, KeyframeValues } from '../../types/layer';

const BLEND_MODES: BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];

// Track whether to restore blur after range slider drag
let _rangeBlurRestore = false;

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function SidebarProperties({ layer }: { layer: Layer }) {
  // Keyframe display values logic
  const kfDisplayValues = keyframeStore.displayValues.value;
  const hasKeyframes = !isFxLayer(layer) && !layer.isBase
    && layer.keyframes && layer.keyframes.length > 0;
  const showKfValues = hasKeyframes && kfDisplayValues;
  const isOnKf = keyframeStore.isOnKeyframe.value;

  // Transient edit routing: when a layer has keyframes and the playhead is NOT on a keyframe,
  // edits write to transientOverrides; when ON a keyframe, edits update layerStore + keyframe.
  const handleKeyframeEdit = hasKeyframes ? (field: keyof KeyframeValues, value: number) => {
    if (isOnKf) {
      // ON a keyframe: update layer state AND update keyframe values
      if (field === 'opacity') {
        layerStore.updateLayer(layer.id, { opacity: value });
      } else if (field === 'blur') {
        layerStore.updateLayer(layer.id, { blur: value });
      } else {
        // Transform fields: x, y, scaleX, scaleY, rotation
        layerStore.updateLayer(layer.id, {
          transform: { ...layer.transform, [field]: value },
        });
      }
      // Also update the keyframe at this frame
      keyframeStore.addKeyframe(layer.id, timelineStore.currentFrame.peek());
    } else {
      // BETWEEN keyframes: transient edit only -- does NOT touch layerStore
      keyframeStore.setTransientValue(field, value);
    }
  } : undefined;

  const opacityPercent = Math.round(
    (showKfValues ? kfDisplayValues!.opacity : layer.opacity) * 100,
  );

  // Clear transient overrides and deselect keyframe diamonds when frame changes (scrub/seek)
  useEffect(() => {
    void timelineStore.currentFrame.value;
    keyframeStore.clearTransientOverrides();
    keyframeStore.clearSelection();
  }, [timelineStore.currentFrame.value]);

  // Uniform Scale helper
  const scaleX = showKfValues ? kfDisplayValues!.scaleX : layer.transform.scaleX;
  const scaleY = showKfValues ? kfDisplayValues!.scaleY : layer.transform.scaleY;
  const uniformScale = (scaleX + scaleY) / 2;

  // Update transform helper (wraps handleKeyframeEdit for transform fields)
  const updateTransform = (field: string, value: number) => {
    if (handleKeyframeEdit) {
      handleKeyframeEdit(field as keyof KeyframeValues, value);
    } else {
      layerStore.updateLayer(layer.id, {
        transform: { ...layer.transform, [field]: value },
      });
    }
  };

  // Check if any keyframe diamonds are selected (for blend/interpolation swap)
  const hasSelectedDiamonds = keyframeStore.selectedKeyframeFrames.value.size > 0;

  return (
    <div class="px-3 py-2 space-y-3">
      {/* Keyframe nav bar + Blur slider (same row, gap 16px per Pencil spec) -- only for non-base layers */}
      {!layer.isBase && (
        <div class="flex items-center gap-3">
          <KeyframeNavBar layer={layer} />
          <div class="flex items-center flex-1 min-w-0 gap-2">
            <span class="shrink-0" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sidebar-text-secondary)' }}>Blur</span>
            <input
              type="range"
              min="0" max="100" step="1"
              value={Math.round((showKfValues ? kfDisplayValues!.blur : (layer.blur ?? 0)) * 100)}
              class="flex-1 min-w-0 h-1 cursor-pointer"
              style={{ accentColor: 'var(--color-accent)' }}
              data-interactive
              onPointerDown={() => {
                startCoalescing();
                if (!blurStore.isBypassed()) { blurStore.toggleBypass(); _rangeBlurRestore = true; }
              }}
              onPointerUp={() => {
                stopCoalescing();
                if (_rangeBlurRestore) { blurStore.toggleBypass(); _rangeBlurRestore = false; }
              }}
              onInput={(e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                if (handleKeyframeEdit) handleKeyframeEdit('blur', val);
                else layerStore.updateLayer(layer.id, { blur: val });
              }}
            />
            <span class="shrink-0" style={{ fontSize: '12px', fontWeight: 400, color: 'var(--sidebar-text-primary)' }}>
              {(showKfValues ? kfDisplayValues!.blur : (layer.blur ?? 0)).toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Blend + Opacity (single row) OR Interpolation (swapped when diamond selected) */}
      {hasSelectedDiamonds ? (
        <InlineInterpolation />
      ) : (
        <div class="flex items-center gap-3">
          {/* Blend dropdown */}
          {layer.isBase ? (
            <div
              class="shrink-0 flex items-center justify-between rounded px-2 py-[3px]"
              style={{ width: '90px', backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)', fontSize: '11px' }}
            >
              <span>Normal</span>
              <ChevronDown size={10} style={{ color: 'var(--sidebar-text-secondary)', opacity: 0.4 }} />
            </div>
          ) : (
            <div class="relative shrink-0" style={{ width: '90px' }}>
              <select
                class="w-full text-[11px] rounded px-2 py-[3px] outline-none cursor-pointer appearance-none pr-5"
                style={{ backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)', borderRadius: '6px' }}
                value={layer.blendMode}
                onChange={(e) => {
                  layerStore.updateLayer(layer.id, {
                    blendMode: (e.target as HTMLSelectElement).value as BlendMode,
                  });
                }}
              >
                {BLEND_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {capitalize(mode)}
                  </option>
                ))}
              </select>
              <ChevronDown size={10} class="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--sidebar-text-secondary)' }} />
            </div>
          )}

          {/* Opacity slider + percentage (fills remaining space) */}
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <input
              type="range"
              min="0"
              max="100"
              value={opacityPercent}
              class="flex-1 min-w-0 h-1 accent-[var(--color-accent)] cursor-pointer"
              onPointerDown={() => {
                startCoalescing();
                if (!blurStore.isBypassed()) { blurStore.toggleBypass(); _rangeBlurRestore = true; }
              }}
              onPointerUp={() => {
                stopCoalescing();
                if (_rangeBlurRestore) { blurStore.toggleBypass(); _rangeBlurRestore = false; }
              }}
              onInput={(e) => {
                const val = parseInt((e.target as HTMLInputElement).value, 10) / 100;
                if (handleKeyframeEdit) {
                  handleKeyframeEdit('opacity', val);
                } else {
                  layerStore.updateLayer(layer.id, { opacity: val });
                }
              }}
            />
            <span class="text-[11px] w-8 text-right shrink-0" style={{ color: 'var(--sidebar-text-primary)' }}>{opacityPercent}%</span>
          </div>
        </div>
      )}

      {/* Transform section (flex rows, gap-10 vertical, gap-16 horizontal per Pencil spec) */}
      <div style={{ paddingTop: '12px' }}>
        <SectionLabel text="TRANSFORM" />
        <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
          <div class="flex items-center" style={{ gap: '16px' }}>
            <NumericInput label="X" value={showKfValues ? kfDisplayValues!.x : layer.transform.x} step={1}
              onChange={(val) => updateTransform('x', val)} />
            <NumericInput label="Y" value={showKfValues ? kfDisplayValues!.y : layer.transform.y} step={1}
              onChange={(val) => updateTransform('y', val)} />
          </div>
          <div class="flex items-center" style={{ gap: '16px' }}>
            <NumericInput label="Scale" value={uniformScale} step={0.01} min={0.01}
              onChange={(val) => { updateTransform('scaleX', val); updateTransform('scaleY', val); }} />
            <NumericInput label="Rot" value={showKfValues ? kfDisplayValues!.rotation : layer.transform.rotation} step={1}
              onChange={(val) => updateTransform('rotation', val)} />
          </div>
          <div class="flex items-center" style={{ gap: '16px' }}>
            <NumericInput label="SX" value={scaleX} step={0.01} min={0.01}
              onChange={(val) => updateTransform('scaleX', val)} />
            <NumericInput label="SY" value={scaleY} step={0.01} min={0.01}
              onChange={(val) => updateTransform('scaleY', val)} />
          </div>
        </div>
      </div>

      {/* Crop section (flex rows, same alignment as Transform) */}
      <div style={{ paddingTop: '12px' }}>
        <SectionLabel text="CROP" />
        <div class="flex flex-col" style={{ gap: '10px', marginTop: '6px' }}>
          <div class="flex items-center" style={{ gap: '16px' }}>
            <NumericInput label="T" value={layer.transform.cropTop} step={0.01} min={0} max={1}
              onChange={(val) => layerStore.updateLayer(layer.id, { transform: { ...layer.transform, cropTop: Math.max(0, Math.min(1, val)) } })} />
            <NumericInput label="R" value={layer.transform.cropRight} step={0.01} min={0} max={1}
              onChange={(val) => layerStore.updateLayer(layer.id, { transform: { ...layer.transform, cropRight: Math.max(0, Math.min(1, val)) } })} />
          </div>
          <div class="flex items-center" style={{ gap: '16px' }}>
            <NumericInput label="B" value={layer.transform.cropBottom} step={0.01} min={0} max={1}
              onChange={(val) => layerStore.updateLayer(layer.id, { transform: { ...layer.transform, cropBottom: Math.max(0, Math.min(1, val)) } })} />
            <NumericInput label="L" value={layer.transform.cropLeft} step={0.01} min={0} max={1}
              onChange={(val) => layerStore.updateLayer(layer.id, { transform: { ...layer.transform, cropLeft: Math.max(0, Math.min(1, val)) } })} />
          </div>
        </div>
      </div>
    </div>
  );
}
