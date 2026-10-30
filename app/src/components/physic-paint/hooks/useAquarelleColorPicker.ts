// ============================================================
//  261030-cnq — the temporary (Alt-hold) picker arming hook.
//
//  One effect, one responsibility: mirror the Alt key into the picker
//  signal and guarantee a lost keyup can never leave a stuck temporary
//  picker (window blur / document hide both release it). No state, no
//  signal read, no render-body write.
// ============================================================

import { useEffect } from 'preact/hooks';
import { disarmAquarellePicker, setAquarellePickerAltHeld } from '../view/aquarelleColorPicker';

export function useAquarelleColorPicker(): void {
  useEffect(() => {
    disarmAquarellePicker();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setAquarellePickerAltHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Alt') setAquarellePickerAltHeld(false);
    };
    // A window that lost focus never sees the Alt keyup — release here so
    // the next canvas click paints instead of sampling.
    const handleBlur = () => setAquarellePickerAltHeld(false);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') setAquarellePickerAltHeld(false);
    };
    // CAPTURE phase: focused dialogs in the Studio (the Photo Reference dialog)
    // call `event.stopPropagation()` on keydown, which would otherwise keep
    // Alt from ever reaching a window bubble listener — the picker then never
    // arms while that dialog has focus. Capture on window runs first, so no
    // descendant can swallow it.
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disarmAquarellePicker();
    };
  }, []);
}
