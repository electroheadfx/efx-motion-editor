import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { RotoPlayScriptController, RotoPlayScriptMode } from '../roto/physicsPaintRotoPlayScriptController';
import { InlineColorPicker } from '../../sidebar/InlineColorPicker';
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

// 0-100 clamp mirroring the Motion panel convention (PanelSlider/clampWiggleValue).
function clampMotionValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(value)));
}

export function PhysicsPaintPlayScriptDialog({
  playScript,
  returnFocusRef,
}: PhysicsPaintPlayScriptDialogProps) {
  recordPhysicsPaintPerformanceCounter('render.playScriptDialog');
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousOpen = useRef(false);
  // Pitfall 3 / D-09: InlineColorPicker fires onChange on mount. The pick handler stays disarmed
  // until a genuine user interaction (pointer/key) inside the picker well, so opening the picker
  // never creates an override — only a deliberate pick does.
  const pickerArmedRef = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
            <span class="physics-paint-play-script-group-label" id="physics-play-script-override-label">Color</span>
            <div class="physics-paint-play-script-override-row" aria-labelledby="physics-play-script-override-label">
              <button
                type="button"
                class="physics-paint-play-script-override-swatch"
                disabled={busy}
                onClick={() => {
                  pickerArmedRef.current = false;
                  setPickerOpen((open) => !open);
                }}
              >
                {playScript.overrideEnabled.value && playScript.overrideColor.value ? (
                  <>
                    <span class="physics-paint-play-script-override-chip" style={{ backgroundColor: playScript.overrideColor.value }} />
                    {playScript.overrideColor.value}
                  </>
                ) : 'Original colors'}
              </button>
              {playScript.overrideEnabled.value ? (
                <button
                  type="button"
                  class="physics-paint-play-script-override-reset"
                  disabled={busy}
                  onClick={() => {
                    playScript.overrideEnabled.value = false;
                    setPickerOpen(false);
                  }}
                >
                  Original colors
                </button>
              ) : null}
            </div>
            {pickerOpen ? (
              <div
                class="physics-paint-play-script-picker-well"
                onPointerDownCapture={() => { pickerArmedRef.current = true; }}
                onKeyDownCapture={() => { pickerArmedRef.current = true; }}
              >
                <InlineColorPicker
                  color={playScript.overrideColor.value ?? '#ffffff'}
                  opacity={1}
                  onChange={(color) => {
                    if (!pickerArmedRef.current) return;
                    playScript.overrideColor.value = color;
                    playScript.overrideEnabled.value = true;
                    setPickerOpen(false);
                  }}
                  onClose={() => setPickerOpen(false)}
                />
              </div>
            ) : null}
          </div>
          <div class="physics-paint-play-script-section">
            <span class="physics-paint-play-script-group-label">Motion</span>
            <label class="physics-paint-play-script-slider-row" for="physics-play-script-motion-deformation">
              <span>Deformation</span>
              <input
                id="physics-play-script-motion-deformation"
                type="range"
                min={0}
                max={100}
                value={playScript.dialogMotion.value.deformation}
                disabled={busy}
                onInput={(event) => {
                  playScript.dialogMotion.value = { ...playScript.dialogMotion.value, deformation: clampMotionValue(Number((event.currentTarget as HTMLInputElement).value)) };
                }}
              />
              <output>{playScript.dialogMotion.value.deformation}</output>
            </label>
            <label class="physics-paint-play-script-slider-row" for="physics-play-script-motion-position">
              <span>Position</span>
              <input
                id="physics-play-script-motion-position"
                type="range"
                min={0}
                max={100}
                value={playScript.dialogMotion.value.position}
                disabled={busy}
                onInput={(event) => {
                  playScript.dialogMotion.value = { ...playScript.dialogMotion.value, position: clampMotionValue(Number((event.currentTarget as HTMLInputElement).value)) };
                }}
              />
              <output>{playScript.dialogMotion.value.position}</output>
            </label>
            <button
              type="button"
              class="physics-paint-play-script-motion-reset"
              disabled={busy}
              onClick={() => playScript.resetDialogMotion()}
            >
              Reset to Motion defaults
            </button>
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
        </div>
        {playScript.error.value ? <span class="physics-paint-script-inline-error physics-paint-play-script-dialog-error">{playScript.error.value}</span> : null}
        <div class="physics-paint-play-script-actions">
          <button type="button" onClick={playScript.cancel}>{playScript.canCancel.value ? 'Cancel generation' : 'Cancel'}</button>
          {!playScript.canCancel.value ? <button type="button" disabled={Boolean(playScript.validationError.value)} onClick={() => { void playScript.confirm(); }}>Generate</button> : null}
        </div>
      </div>
    </div>
  );
}
