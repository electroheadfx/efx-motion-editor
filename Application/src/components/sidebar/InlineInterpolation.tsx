import { keyframeStore } from '../../stores/keyframeStore';
import { layerStore } from '../../stores/layerStore';
import type { EasingType } from '../../types/layer';

const EASING_OPTIONS: { value: EasingType; label: string }[] = [
  { value: 'linear', label: 'Linear' },
  { value: 'ease-in', label: 'Ease In' },
  { value: 'ease-out', label: 'Ease Out' },
  { value: 'ease-in-out', label: 'Ease In-Out' },
];

export function InlineInterpolation() {
  const selectedFrames = keyframeStore.selectedKeyframeFrames.value;
  const layerId = layerStore.selectedLayerId.value;
  if (!layerId || selectedFrames.size === 0) return null;

  // Get the easing of the first selected keyframe
  const keyframes = keyframeStore.activeLayerKeyframes.value;
  const firstFrame = [...selectedFrames][0];
  const kf = keyframes.find(k => k.frame === firstFrame);
  const currentEasing = kf?.easing ?? 'ease-in-out';

  const handleSelect = (easing: EasingType) => {
    for (const frame of selectedFrames) {
      keyframeStore.setEasing(layerId, frame, easing);
    }
  };

  return (
    <div class="space-y-1.5">
      <span style="font-size: 11px; font-weight: 600; color: var(--sidebar-text-secondary); letter-spacing: 2px">
        INTERPOLATION
      </span>
      <div class="flex flex-wrap gap-1">
        {EASING_OPTIONS.map(opt => (
          <button
            key={opt.value}
            class="px-2 py-1 rounded text-[11px] transition-colors"
            style={{
              backgroundColor: currentEasing === opt.value
                ? 'var(--sidebar-selected-layer-bg)'
                : 'var(--sidebar-input-bg)',
              color: currentEasing === opt.value
                ? 'var(--sidebar-text-primary)'
                : 'var(--sidebar-text-button)',
              fontWeight: currentEasing === opt.value ? 600 : 400,
            }}
            onClick={() => handleSelect(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
