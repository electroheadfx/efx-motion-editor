import { Pipette } from 'lucide-preact';
import { cursorVisible, cursorX, cursorY } from '../engine/AquarelleCanvasLayer';
import { aquarellePickerActive } from './aquarelleColorPicker';

/**
 * 261030-cnq: the picker pointer. The live canvas hides the OS cursor
 * (`cursor: none`) and the brush ring is a DOM element inside the isolated
 * tracks group, so the picker cannot reuse either: this visor is rendered as a
 * sibling of the tracks group, above the reference overlay, and shows the
 * lucide `Pipette` at the shell-relative pointer point with a 1px tip dot at
 * the exact sampled pixel.
 *
 * `left`/`top` are the sheet's offset inside the canvas stack (the measured
 * canvas bounds), because the cursor signals are shell-relative.
 */
export function AquarellePickerVisor(props: { left: number; top: number }) {
  if (!aquarellePickerActive.value) return null;
  if (!cursorVisible.value) return null;
  return (
    <div
      class="physics-paint-picker-visor"
      aria-hidden="true"
      style={{ left: `${props.left + cursorX.value}px`, top: `${props.top + cursorY.value}px` }}
    >
      <Pipette size={20} />
      <span class="physics-paint-picker-visor-tip" />
    </div>
  );
}
