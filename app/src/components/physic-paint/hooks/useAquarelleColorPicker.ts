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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disarmAquarellePicker();
    };
  }, []);
}
