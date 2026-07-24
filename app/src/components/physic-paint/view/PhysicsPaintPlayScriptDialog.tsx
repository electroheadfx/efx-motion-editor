import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { RotoPlayScriptController } from '../roto/physicsPaintRotoPlayScriptController';

export interface PhysicsPaintPlayScriptDialogProps {
  playScript: RotoPlayScriptController;
  returnFocusRef: RefObject<HTMLButtonElement>;
}

export function PhysicsPaintPlayScriptDialog({
  playScript,
  returnFocusRef,
}: PhysicsPaintPlayScriptDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousOpen = useRef(false);
  const confirmationOpen = playScript.confirmationOpen.value;

  useEffect(() => {
    if (confirmationOpen) inputRef.current?.focus();
    else if (previousOpen.current) returnFocusRef.current?.focus();
    previousOpen.current = confirmationOpen;
  }, [confirmationOpen, returnFocusRef]);

  if (!confirmationOpen) return null;

  return (
    <div
      ref={dialogRef}
      class="physics-paint-play-script-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="physics-play-script-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          playScript.cancel();
          return;
        }
        if (event.key === 'Enter' && !playScript.validationError.value && !playScript.canCancel.value) {
          event.preventDefault();
          void playScript.confirm();
          return;
        }
        if (event.key !== 'Tab') return;
        const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input:not(:disabled), button:not(:disabled), [tabindex]:not([tabindex="-1"])') ?? []);
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <div class="physics-paint-play-script-surface">
        <div class="physics-paint-play-script-content">
          <strong id="physics-play-script-title">Play Script</strong>
          <span>Max {playScript.capacity.value}{playScript.destinationRange.value ? ` · ${playScript.destinationRange.value}` : ''}</span>
          <label for="physics-play-script-count">Frames</label>
          <input
            ref={inputRef}
            id="physics-play-script-count"
            inputMode="numeric"
            value={playScript.countText.value}
            disabled={playScript.canCancel.value}
            aria-invalid={Boolean(playScript.validationError.value)}
            aria-describedby="physics-play-script-help physics-play-script-error"
            onInput={(event) => {
              playScript.countText.value = (event.currentTarget as HTMLInputElement).value;
            }}
          />
          <span id="physics-play-script-help">Enter a positive integer or Max.</span>
          {playScript.validationError.value ? <span id="physics-play-script-error" class="physics-paint-script-inline-error">{playScript.validationError.value}</span> : null}
          {playScript.progress.value ? <progress max={playScript.progress.value.total} value={playScript.progress.value.completed}>{playScript.progress.value.completed}/{playScript.progress.value.total}</progress> : null}
          {playScript.error.value ? <span class="physics-paint-script-inline-error">{playScript.error.value}</span> : null}
        </div>
        <div class="physics-paint-play-script-actions">
          <button type="button" onClick={playScript.cancel}>{playScript.canCancel.value ? 'Cancel generation' : 'Cancel'}</button>
          {!playScript.canCancel.value ? <button type="button" disabled={Boolean(playScript.validationError.value)} onClick={() => { void playScript.confirm(); }}>Generate</button> : null}
        </div>
      </div>
    </div>
  );
}
