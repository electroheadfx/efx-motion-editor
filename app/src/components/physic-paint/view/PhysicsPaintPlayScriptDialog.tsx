import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { RotoPlayScriptController, RotoPlayScriptMode } from '../roto/physicsPaintRotoPlayScriptController';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';

export interface PhysicsPaintPlayScriptDialogProps {
  playScript: RotoPlayScriptController;
  returnFocusRef: RefObject<HTMLButtonElement>;
}

// D-05: locked mode options, labels, and helper copy (42-UI-SPEC Copywriting Contract).
const PLAY_SCRIPT_MODES: ReadonlyArray<{ value: RotoPlayScriptMode; label: string; helper: string }> = [
  { value: 'progressive', label: 'Progressive', helper: 'The drawing builds stroke by stroke across frames.' },
  { value: 'static', label: 'Static / Hold', helper: 'The complete drawing is applied to every cycle frame.' },
];

export function PhysicsPaintPlayScriptDialog({
  playScript,
  returnFocusRef,
}: PhysicsPaintPlayScriptDialogProps) {
  recordPhysicsPaintPerformanceCounter('render.playScriptDialog');
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

  const busy = playScript.canCancel.value;
  const activeMode = PLAY_SCRIPT_MODES.find((option) => option.value === playScript.mode.value) ?? PLAY_SCRIPT_MODES[0];

  // W3C APG radio pattern (D-05): arrow keys move focus AND check with wrap-around; the checked
  // option is the group's single Tab stop via roving tabindex (integrates with the trap query).
  const onModeKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (playScript.canCancel.value) return;
    const currentIndex = PLAY_SCRIPT_MODES.findIndex((option) => option.value === playScript.mode.value);
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + delta + PLAY_SCRIPT_MODES.length) % PLAY_SCRIPT_MODES.length;
    playScript.mode.value = PLAY_SCRIPT_MODES[nextIndex].value;
    const radios = (event.currentTarget as HTMLElement | null)?.querySelectorAll?.('[role="radio"]');
    (radios?.[nextIndex] as HTMLElement | undefined)?.focus?.();
  };

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
        <div class="physics-paint-play-script-header">
          <strong id="physics-play-script-title">Play Script</strong>
          <span>Max {playScript.capacity.value}{playScript.destinationRange.value ? ` · ${playScript.destinationRange.value}` : ''}</span>
        </div>
        <div class="physics-paint-play-script-content">
          <div class="physics-paint-play-script-section">
            <div
              class="physics-paint-play-script-mode-group"
              role="radiogroup"
              aria-label="Mode"
              aria-describedby="physics-play-script-mode-helper"
              onKeyDown={onModeKeyDown}
            >
              {PLAY_SCRIPT_MODES.map((option) => {
                const checked = playScript.mode.value === option.value;
                return (
                  <div
                    key={option.value}
                    class="physics-paint-play-script-mode-option"
                    role="radio"
                    aria-checked={checked}
                    aria-disabled={busy}
                    tabIndex={!busy && checked ? 0 : -1}
                    onClick={(event) => {
                      if (playScript.canCancel.value) return;
                      playScript.mode.value = option.value;
                      (event.currentTarget as HTMLElement | null)?.focus?.();
                    }}
                  >
                    {option.label}
                  </div>
                );
              })}
            </div>
            <span id="physics-play-script-mode-helper" class="physics-paint-play-script-mode-helper">{activeMode.helper}</span>
          </div>
          <div class="physics-paint-play-script-section">
            <label for="physics-play-script-count">{playScript.mode.value === 'static' ? 'Cycle frames' : 'Frames'}</label>
            <input
              ref={inputRef}
              id="physics-play-script-count"
              inputMode="numeric"
              value={playScript.countText.value}
              disabled={busy}
              aria-invalid={Boolean(playScript.validationError.value)}
              aria-describedby="physics-play-script-help physics-play-script-error"
              onInput={(event) => {
                playScript.countText.value = (event.currentTarget as HTMLInputElement).value;
              }}
            />
            <span id="physics-play-script-help">Enter a positive integer or Max.</span>
            {playScript.validationError.value ? <span id="physics-play-script-error" class="physics-paint-script-inline-error">{playScript.validationError.value}</span> : null}
          </div>
          <div class="physics-paint-play-script-section">
            <label for="physics-play-script-repeat">Repeat</label>
            <div class="physics-paint-play-script-repeat-row">
              <input
                id="physics-play-script-repeat"
                inputMode="numeric"
                value={playScript.repeatText.value}
                disabled={busy || playScript.infinity.value}
                aria-invalid={Boolean(playScript.repeatError.value)}
                aria-describedby="physics-play-script-repeat-help physics-play-script-repeat-error"
                onInput={(event) => {
                  playScript.repeatText.value = (event.currentTarget as HTMLInputElement).value;
                }}
              />
              <label class="physics-paint-play-script-infinity-toggle">
                <input
                  type="checkbox"
                  checked={playScript.infinity.value}
                  disabled={busy}
                  onChange={(event) => playScript.setInfinity((event.currentTarget as HTMLInputElement).checked)}
                />
                Infinity
              </label>
            </div>
            <span id="physics-play-script-repeat-help" class="physics-paint-play-script-repeat-help">Enter a positive integer.</span>
            {playScript.repeatError.value ? <span id="physics-play-script-repeat-error" class="physics-paint-script-inline-error">{playScript.repeatError.value}</span> : null}
            {playScript.loopReadout.value ? <p class="physics-paint-play-script-loop-readout">{playScript.loopReadout.value}</p> : null}
          </div>
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
