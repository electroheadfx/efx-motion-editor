import { useEffect } from 'preact/hooks';
import { NumericInput } from '../shared/NumericInput';
import { SectionLabel } from '../shared/SectionLabel';
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

/** [+ Keyframe] / [Update] button for content layers with keyframe support */
function KeyframeButton({ layer }: { layer: Layer }) {
  // Only show for content layers (not FX, not base)
  if (isFxLayer(layer) || layer.isBase) return null;

  const isOnKf = keyframeStore.isOnKeyframe.value;

  return (
    <button
      class={`text-[10px] px-2 py-[3px] rounded font-medium transition-colors ${
        isOnKf
          ? 'bg-[#FFD700] text-black hover:bg-[#E5C000]'
          : 'bg-[var(--color-accent)] text-white hover:opacity-80'
      }`}
      title={isOnKf ? 'Update keyframe at this frame' : 'Add keyframe at this frame'}
      onClick={() => {
        const globalFrame = timelineStore.currentFrame.peek();
        keyframeStore.addKeyframe(layer.id, globalFrame);
      }}
    >
      {isOnKf ? '\u25C6 Update' : '+ Keyframe'}
    </button>
  );
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

  // Clear transient overrides when frame changes
  useEffect(() => {
    void timelineStore.currentFrame.value;
    keyframeStore.clearTransientOverrides();
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

  return (
    <div class="overflow-y-auto px-3 py-2 space-y-3">
      {/* Keyframe button row (not for base layer) */}
      {!layer.isBase && (
        <div class="flex items-center justify-between">
          <KeyframeButton layer={layer} />
        </div>
      )}

      {/* Blend + Opacity section */}
      <div class="space-y-1.5">
        <SectionLabel text="BLEND" />
        {layer.isBase ? (
          <span class="text-[11px] text-[var(--color-text-dim)]">Normal</span>
        ) : (
          <select
            class="w-full text-[11px] bg-[var(--color-bg-input)] text-[var(--color-text-button)] rounded px-2 py-[3px] outline-none cursor-pointer"
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
        )}

        <SectionLabel text="OPACITY" />
        <div class="flex items-center gap-1.5">
          <input
            type="range"
            min="0"
            max="100"
            value={opacityPercent}
            class="flex-1 h-1 accent-[var(--color-accent)] cursor-pointer"
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
          <span class="text-[11px] text-[var(--color-text-button)] w-8 text-right">{opacityPercent}%</span>
        </div>
      </div>

      {/* Transform section (two-column grid) */}
      <div class="space-y-1.5">
        <SectionLabel text="TRANSFORM" />
        <div class="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <NumericInput label="X" value={showKfValues ? kfDisplayValues!.x : layer.transform.x} step={1}
            onChange={(val) => updateTransform('x', val)} />
          <NumericInput label="Y" value={showKfValues ? kfDisplayValues!.y : layer.transform.y} step={1}
            onChange={(val) => updateTransform('y', val)} />
          <NumericInput label="Scale" value={uniformScale} step={0.01} min={0.01}
            onChange={(val) => { updateTransform('scaleX', val); updateTransform('scaleY', val); }} />
          <NumericInput label="Rot" value={showKfValues ? kfDisplayValues!.rotation : layer.transform.rotation} step={1}
            onChange={(val) => updateTransform('rotation', val)} />
          <NumericInput label="SX" value={scaleX} step={0.01} min={0.01}
            onChange={(val) => updateTransform('scaleX', val)} />
          <NumericInput label="SY" value={scaleY} step={0.01} min={0.01}
            onChange={(val) => updateTransform('scaleY', val)} />
        </div>
      </div>

      {/* Crop section (two-column grid) */}
      <div class="space-y-1.5">
        <SectionLabel text="CROP" />
        <div class="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <NumericInput label="T" value={layer.transform.cropTop} step={0.01} min={0} max={1}
            onChange={(val) => layerStore.updateLayer(layer.id, { transform: { ...layer.transform, cropTop: Math.max(0, Math.min(1, val)) } })} />
          <NumericInput label="R" value={layer.transform.cropRight} step={0.01} min={0} max={1}
            onChange={(val) => layerStore.updateLayer(layer.id, { transform: { ...layer.transform, cropRight: Math.max(0, Math.min(1, val)) } })} />
          <NumericInput label="B" value={layer.transform.cropBottom} step={0.01} min={0} max={1}
            onChange={(val) => layerStore.updateLayer(layer.id, { transform: { ...layer.transform, cropBottom: Math.max(0, Math.min(1, val)) } })} />
          <NumericInput label="L" value={layer.transform.cropLeft} step={0.01} min={0} max={1}
            onChange={(val) => layerStore.updateLayer(layer.id, { transform: { ...layer.transform, cropLeft: Math.max(0, Math.min(1, val)) } })} />
        </div>
      </div>

      {/* Blur section */}
      <div class="space-y-1.5">
        <SectionLabel text="BLUR" />
        <NumericInput label="Radius"
          value={showKfValues ? kfDisplayValues!.blur : (layer.blur ?? 0)}
          step={0.01} min={0} max={1}
          onChange={(val) => {
            if (handleKeyframeEdit) handleKeyframeEdit('blur', val);
            else layerStore.updateLayer(layer.id, { blur: val });
          }} />
      </div>
    </div>
  );
}
