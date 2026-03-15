import {createPortal} from 'preact/compat';
import {keyframeStore} from '../../stores/keyframeStore';
import type {EasingType} from '../../types/layer';

const EASING_OPTIONS: { value: EasingType; label: string; icon: string }[] = [
  { value: 'linear', label: 'Linear', icon: '/' },
  { value: 'ease-in', label: 'Ease In', icon: ')' },
  { value: 'ease-out', label: 'Ease Out', icon: '(' },
  { value: 'ease-in-out', label: 'Ease In-Out', icon: 'S' },
];

interface KeyframePopoverProps {
  layerId: string;
  frame: number;  // sequence-local frame
  x: number;      // screen X position
  y: number;      // screen Y position
  onClose: () => void;
}

export function KeyframePopover({ layerId, frame, x, y, onClose }: KeyframePopoverProps) {
  // Find the current easing for this keyframe
  const keyframes = keyframeStore.activeLayerKeyframes.value;
  const kf = keyframes.find(k => k.frame === frame);
  const currentEasing = kf?.easing ?? 'ease-in-out';

  const handleSelect = (easing: EasingType) => {
    keyframeStore.setEasing(layerId, frame, easing);
    onClose();
  };

  // Close on click outside
  const handleBackdropClick = (e: MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return createPortal(
    <>
      {/* Invisible backdrop to catch clicks outside */}
      <div
        class="fixed inset-0 z-[999]"
        onClick={handleBackdropClick}
      />
      {/* Popover menu */}
      <div
        class="fixed z-[1000] bg-[var(--color-bg-menu)] border border-[var(--color-bg-divider)] rounded-lg shadow-xl py-1 min-w-[140px]"
        style={{ left: `${x}px`, top: `${y + 10}px` }}
      >
        <div class="px-3 py-1.5 text-[9px] font-semibold text-[var(--color-text-dimmer)] uppercase tracking-wider">
          Interpolation
        </div>
        {EASING_OPTIONS.map(opt => (
          <button
            key={opt.value}
            class={`w-full text-left px-3 py-1.5 text-[11px] hover:bg-[var(--color-bg-input)] transition-colors flex items-center gap-2 ${
              currentEasing === opt.value ? 'text-[#FFD700] font-medium' : 'text-[var(--color-text-button)]'
            }`}
            onClick={() => handleSelect(opt.value)}
          >
            <span class="w-4 text-center font-mono text-[10px] text-[var(--color-text-muted)]">{opt.icon}</span>
            {opt.label}
            {currentEasing === opt.value && (
              <span class="ml-auto text-[#FFD700]">&#10003;</span>
            )}
          </button>
        ))}
      </div>
    </>,
    document.body
  );
}
