import { useEffect, useRef } from 'preact/hooks';
import { AudioWaveform, Trash2, Volume2, X } from 'lucide-preact';
import { NumericStepper } from '../../shared/NumericStepper';
import type { PhysicsPaintAudioController, SoundFadeCurve } from './physicsPaintAudioController';
import { isPhysicsPaintShortcutTarget } from './physicsPaintStudioKeyboard';

/**
 * 52.5-01b — the floating `Document sound` dialog (D-05 single control
 * surface), re-flowed to the locked mock SPECS/modal-audio-new by 261009-6ee.
 * Pattern: `PhysicsPaintPhotoReferenceDialog` / Play Script floating
 * dialog — NO backdrop, NO Tab trap, Escape closes, close button, focus
 * captured on open and restored to the launcher on close, header drag
 * repositions (photo-ref precedent). Width 340px (mock-locked).
 *
 * Copywriting Contract (52.5-UI-SPEC — verbatim, never interpolated, defined
 * here because this component renders it):
 *
 *   `Document sounds` · `Import sound` · `Replace…` · `No sound yet` ·
 *   `Import a dialogue or foley clip for this animation — WAV, MP3, AAC, or FLAC.` ·
 *   `Reading audio…` · `Remove` → `Confirm remove?` ·
 *   `Remove sound? Position, trims, gain, and fades are discarded from this document.` ·
 *   `Couldn't read this audio file. Use WAV, MP3, AAC, or FLAC, or replace the clip.` ·
 *   `Sound file is missing from the project. Replace it to restore the clip.` ·
 *   `Position` (frames) · `Gain` (-100..+100, `0 = unity`) · `Fade in` ·
 *   `Fade out` (frames; curves `linear`, `exponential`, `logarithmic`) ·
 *   `Trim in` · `Trim out` (frames) · `TIMING` · `SOUND` · `On` / `Off`
 *
 * Field order top-to-bottom is a verbatim contract (SPECS/modal-audio-new,
 * locked by 261009-6ee): the modal edits ONLY the selected clip — the clip
 * LIST lives in the sidebar Audio tab:
 *   1. header: AudioWaveform 15px + `Document sounds` + close X (title + close
 *      ONLY — this modal carries no preview button)
 *   2. `File` label ABOVE the file row (filename chip + `Replace…`) OR the
 *      empty-state block (`No sound yet` / body / `Import sound`, zero clips)
 *      OR the error copy
 *   3. `TIMING` section header (uppercase micro-label + 1px rule)
 *   4. `Position` (frames) — NumericStepper step 1, integer >= 0, no upper
 *      clamp (commitStartFrame)
 *   5. `Trim in` (frames) — NumericStepper (commitInFrame, 1-frame minimum span)
 *   6. `Trim out` (frames) — NumericStepper (commitOutFrame, 1-frame minimum span)
 *   7. `SOUND` section header
 *   8. `Gain` + hint `0 = unity` — NumericStepper step 5, -100..100 (commitGain)
 *   9. `Fade in` (frames) — NumericStepper step 1 min 0 + curve select BESIDE
 *      (commitFadeIn)
 *   10. `Fade out` (frames) — same row shape (commitFadeOut)
 *   11. footer — LEFT enabled pill (`On`/`Off`, Volume2 icon when on) toggling
 *       sound.enabled, RIGHT `Remove` two-step (requestRemove/confirmRemove)
 *       with AUDIO_REMOVE_CONFIRM_COPY at the footer
 *
 * 261009-6ee one-switch deviation (locked): the mock's header preview button
 * is dropped — the footer enabled pill is this modal's ONLY audio switch. The
 * main-app-audio preview surface lives on the Studio strip's Audio Preview
 * toggle; its copy constants moved to efxPaintAudioPreviewStore.ts.
 *
 * The component is a thin render shell over the signals-only
 * `physicsPaintAudioController` (accepted canonical state only; no useState,
 * no render-body signal writes). The controller INSTANCE is built by
 * PhysicsPaintStudio and passed in — the gallery Confirm flow lives in the
 * Studio and must drive the SAME signal instance the modal renders
 * (beginReading → decode → applyImportedSource → endReading). Import/Replace
 * raise `onImportRequest` — PhysicsPaintStudio opens the SHARED
 * BackgroundAssetPickerView with kind 'audio' (D-02/D-03 — this modal never
 * talks to a file dialog itself). Toggles gate audio only: they never touch
 * the stain, the bar, or pixels.
 */

/* ----------------------------------------------------------------------------
 * Copywriting Contract (52.5-UI-SPEC — verbatim, never interpolated).
 * ------------------------------------------------------------------------- */

export const AUDIO_MODAL_TITLE = 'Document sounds';
export const AUDIO_EMPTY_HEADING = 'No sound yet';
export const AUDIO_EMPTY_BODY = 'Import a dialogue or foley clip for this animation — WAV, MP3, AAC, or FLAC.';
export const AUDIO_IMPORT_CTA = 'Import sound';
export const AUDIO_REPLACE_CTA = 'Replace…';
export const AUDIO_LOADING = 'Reading audio…';
export const AUDIO_REMOVE = 'Remove';
export const AUDIO_REMOVE_ARMED = 'Confirm remove?';
export const AUDIO_REMOVE_CONFIRM_COPY = 'Remove sound? Position, trims, gain, and fades are discarded from this document.';
export const AUDIO_ERROR_DECODE = "Couldn't read this audio file. Use WAV, MP3, AAC, or FLAC, or replace the clip.";
export const AUDIO_ERROR_MISSING = 'Sound file is missing from the project. Replace it to restore the clip.';
export const AUDIO_POSITION_LABEL = 'Position';
export const AUDIO_GAIN_LABEL = 'Gain';
export const AUDIO_FADE_IN_LABEL = 'Fade in';
export const AUDIO_FADE_OUT_LABEL = 'Fade out';
export const AUDIO_IN_LABEL = 'Trim in';
export const AUDIO_OUT_LABEL = 'Trim out';
export const AUDIO_GAIN_HINT = '0 = unity';
export const AUDIO_SECTION_TIMING = 'TIMING';
export const AUDIO_SECTION_SOUND = 'SOUND';
export const AUDIO_ENABLE_ON = 'On';
export const AUDIO_ENABLE_OFF = 'Off';

const FADE_CURVE_OPTIONS: readonly SoundFadeCurve[] = ['linear', 'exponential', 'logarithmic'];

export interface PhysicsPaintAudioModalViewProps {
  /** Dialog visibility (owned by the Studio — set from the strip launcher). */
  open: boolean;
  /**
   * The Studio-built controller instance — the modal renders ONLY its
   * accepted state (no useState, no render-body signal writes).
   */
  controller: PhysicsPaintAudioController;
  /** Close intent (Escape, header X). */
  onClose: () => void;
  /**
   * Import/Replace intent — opens the shared gallery with kind 'audio'.
   * `append` (Import) always adds a fresh clip; `replace` (Replace…) swaps the
   * SELECTED clip's source (261008-ig1 Task 2 — D-01/D-02).
   */
  onImportRequest: (mode: 'append' | 'replace') => void;
}

export function PhysicsPaintAudioModalView({
  open,
  controller,
  onClose,
  onImportRequest,
}: PhysicsPaintAudioModalViewProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ pointerX: number; pointerY: number; baseX: number; baseY: number } | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const previousActiveElement = useRef<Element | null>(null);
  const previousOpen = useRef(false);

  // Focus follows the visible dialog state: on open capture the opening
  // element and focus the dialog; on close restore focus to it (photo-ref /
  // Play Script pattern — restore lands on the timeline launcher).
  useEffect(() => {
    if (open) {
      if (!previousOpen.current) previousActiveElement.current = document.activeElement;
      previousOpen.current = true;
      const timer = window.setTimeout(() => surfaceRef.current?.focus?.(), 0);
      return () => window.clearTimeout(timer);
    }
    if (previousOpen.current && previousActiveElement.current instanceof HTMLElement) {
      previousActiveElement.current.focus?.();
    }
    previousOpen.current = false;
    return undefined;
  }, [open]);

  const handleClose = () => {
    draggingRef.current = false;
    dragStart.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    onClose();
  };

  const onHeaderPointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    dragStart.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      baseX: dragOffsetRef.current.x,
      baseY: dragOffsetRef.current.y,
    };
    draggingRef.current = true;
    (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };

  const onHeaderPointerMove = (event: PointerEvent) => {
    const start = dragStart.current;
    if (!start || !draggingRef.current) return;
    const nextX = start.baseX + (event.clientX - start.pointerX);
    const nextY = start.baseY + (event.clientY - start.pointerY);
    dragOffsetRef.current = { x: nextX, y: nextY };
    const surface = surfaceRef.current;
    if (surface) surface.style.transform = `translate(${nextX}px, ${nextY}px)`;
  };

  const endHeaderDrag = () => {
    dragStart.current = null;
    draggingRef.current = false;
  };

  if (!open) return null;

  const {
    audios,
    sound, filename, missing, busy, decodeError, previewGain, removeArmed,
    commitGain, commitFadeIn, commitFadeOut,
    commitFadeInCurve, commitFadeOutCurve, commitInFrame, commitOutFrame, commitStartFrame,
    toggleEnabled, requestRemove, confirmRemove, removeSelected, disarmRemove,
  } = controller;

  const errorText = decodeError ? AUDIO_ERROR_DECODE : missing ? AUDIO_ERROR_MISSING : null;
  const controlsDisabled = busy;

  /** Any other action reverts the armed Remove (two-step confirm law). */
  const withDisarm = (action: () => void) => () => {
    disarmRemove();
    action();
  };

  return (
    <div
      class="physics-paint-photo-reference-dialog physics-paint-audio-dialog"
      role="dialog"
      aria-labelledby="physics-audio-modal-title"
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          handleClose();
        }
        // 261008-ryq: the modal-open path of the one-shot keyboard delete
        // (stopPropagation above keeps the global dispatcher out of the
        // dialog). Same gates as the dispatcher: plain key, no modifiers, no
        // repeat, and never while typing in a stepper/select field.
        if (
          (event.key === 'Backspace' || event.key === 'Delete')
          && !event.repeat
          && !event.metaKey
          && !event.ctrlKey
          && !event.altKey
          && !event.shiftKey
          && isPhysicsPaintShortcutTarget(event.target)
        ) {
          event.preventDefault();
          removeSelected();
        }
      }}
    >
      <div
        ref={surfaceRef}
        class="physics-paint-photo-reference-surface physics-paint-audio-surface"
        style={{ width: '340px' }}
        tabIndex={-1}
      >
        {/* 1. Header */}
        <div
          class="physics-paint-photo-reference-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={endHeaderDrag}
          onPointerCancel={endHeaderDrag}
        >
          <AudioWaveform size={15} class="physics-paint-photo-reference-header-icon" aria-hidden="true" />
          <strong id="physics-audio-modal-title">{AUDIO_MODAL_TITLE}</strong>
          <span class="physics-paint-photo-reference-header-spacer" aria-hidden="true" />
          {/* 261009-6ee one-switch deviation: NO preview button here — title +
              close ONLY. The footer enabled pill below is this modal's single
              audio switch; the main-app-audio preview lives on the Studio
              strip's Audio Preview toggle. */}
          <button
            type="button"
            class="physics-paint-photo-reference-close"
            aria-label="Close"
            title="Close"
            onClick={handleClose}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>

        <div class="physics-paint-photo-reference-content">
          {audios.length === 0 ? (
            /* 2a. Empty state — the only content block when no clip exists
               (E1 partial); a failed fresh import surfaces its error copy
               above it (E1/E10 error rows). */
            <div class="physics-paint-audio-empty" data-testid="audio-modal-empty">
              {errorText ? (
                <p class="physics-paint-audio-error" role="alert" data-testid="audio-modal-error">
                  {errorText}
                </p>
              ) : null}
              <div class="physics-paint-photo-reference-label">{AUDIO_EMPTY_HEADING}</div>
              <p class="physics-paint-audio-empty-body">{AUDIO_EMPTY_BODY}</p>
              <button
                type="button"
                class="physics-paint-photo-reference-import"
                onClick={withDisarm(() => onImportRequest('append'))}
                disabled={controlsDisabled}
              >
                <AudioWaveform size={13} aria-hidden="true" />
                <span>{busy ? AUDIO_LOADING : AUDIO_IMPORT_CTA}</span>
              </button>
            </div>
          ) : (
            <>
              {sound !== null ? (
            <>
              {/* 2b. File row — `File` label on its OWN line above the row; the
                  row is the filename chip (flex 1) + Replace… */}
              <div>
                <span class="physics-paint-photo-reference-label">File</span>
              </div>
              <div class="physics-paint-audio-file-row">
                <span class="physics-paint-photo-reference-chip" title={filename ?? undefined}>
                  <span class="physics-paint-audio-filename">{filename}</span>
                </span>
                <button
                  type="button"
                  class="physics-paint-photo-reference-import"
                  onClick={withDisarm(() => onImportRequest('replace'))}
                  disabled={controlsDisabled}
                >
                  <span>{busy ? AUDIO_LOADING : AUDIO_REPLACE_CTA}</span>
                </button>
              </div>
              {errorText ? (
                <p class="physics-paint-audio-error" role="alert" data-testid="audio-modal-error">
                  {errorText}
                </p>
              ) : null}

              {/* 3. TIMING section header */}
              <div class="physics-paint-audio-section">
                <span class="physics-paint-audio-section-label">{AUDIO_SECTION_TIMING}</span>
                <span class="physics-paint-audio-section-rule" aria-hidden="true" />
              </div>

              {/* 4. Position (frames) — band placement; per-step commit, integer >= 0, no upper clamp */}
              <div class="physics-paint-audio-row">
                <div class="physics-paint-audio-label-cell">
                  <span class="physics-paint-photo-reference-label">{AUDIO_POSITION_LABEL} (frames)</span>
                </div>
                <NumericStepper
                  class="physics-paint-audio-field-stepper"
                  value={sound.startFrame}
                  step={1}
                  min={0}
                  onChange={(value) => commitStartFrame(value)}
                  ariaLabel={AUDIO_POSITION_LABEL}
                  disabled={controlsDisabled}
                  ariaDisabled={controlsDisabled}
                />
              </div>

              {/* 5. Trim in (frames) — source trim start; 1-frame minimum span:
                  an entry that would invert the span never commits (max = out - 1). */}
              <div class="physics-paint-audio-row">
                <div class="physics-paint-audio-label-cell">
                  <span class="physics-paint-photo-reference-label">{AUDIO_IN_LABEL} (frames)</span>
                </div>
                <NumericStepper
                  class="physics-paint-audio-field-stepper"
                  value={sound.inFrame}
                  step={1}
                  min={0}
                  max={sound.outFrame - 1}
                  onChange={(value) => commitInFrame(value)}
                  ariaLabel="In frames"
                />
              </div>

              {/* 6. Trim out (frames) — source trim end; 1-frame minimum span
                  (min = in + 1). */}
              <div class="physics-paint-audio-row">
                <div class="physics-paint-audio-label-cell">
                  <span class="physics-paint-photo-reference-label">{AUDIO_OUT_LABEL} (frames)</span>
                </div>
                <NumericStepper
                  class="physics-paint-audio-field-stepper"
                  value={sound.outFrame}
                  step={1}
                  min={sound.inFrame + 1}
                  onChange={(value) => commitOutFrame(value)}
                  ariaLabel="Out frames"
                />
              </div>

              {/* 7. SOUND section header */}
              <div class="physics-paint-audio-section">
                <span class="physics-paint-audio-section-label">{AUDIO_SECTION_SOUND}</span>
                <span class="physics-paint-audio-section-rule" aria-hidden="true" />
              </div>

              {/* 8. Gain — NumericStepper step 5, -100..100 (per-step commit); the
                  stepper is the value display, `0 = unity` hint under the label */}
              <div class="physics-paint-audio-row">
                <div class="physics-paint-audio-label-cell">
                  <span class="physics-paint-photo-reference-label">{AUDIO_GAIN_LABEL}</span>
                  <span class="physics-paint-audio-hint">{AUDIO_GAIN_HINT}</span>
                </div>
                <NumericStepper
                  class="physics-paint-audio-field-stepper"
                  value={previewGain}
                  step={5}
                  min={-100}
                  max={100}
                  onChange={(value) => commitGain(value)}
                  ariaLabel={AUDIO_GAIN_LABEL}
                  disabled={controlsDisabled}
                  ariaDisabled={controlsDisabled}
                />
              </div>

              {/* 9. Fade in (frames) — curve select BESIDE the stepper. Values are
                  FRAMES (the model field is fadeInFrames); the unit is in the
                  label so it never reads as seconds. Integer >= 0, no 99 cap. */}
              <div class="physics-paint-audio-row">
                <div class="physics-paint-audio-label-cell">
                  <span class="physics-paint-photo-reference-label">{AUDIO_FADE_IN_LABEL} (frames)</span>
                </div>
                <div class="physics-paint-audio-controls">
                  <NumericStepper
                    class="physics-paint-audio-field-stepper"
                    value={sound.fadeInFrames}
                    step={1}
                    min={0}
                    onChange={(value) => commitFadeIn(value)}
                    ariaLabel="Fade in frames"
                  />
                  <select
                    aria-label={`${AUDIO_FADE_IN_LABEL} curve`}
                    value={sound.fadeInCurve}
                    disabled={controlsDisabled}
                    onChange={(event) => commitFadeInCurve((event.currentTarget as HTMLSelectElement).value as SoundFadeCurve)}
                  >
                    {FADE_CURVE_OPTIONS.map((curve) => (
                      <option key={curve} value={curve}>{curve}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 10. Fade out (frames) — same row shape as Fade in */}
              <div class="physics-paint-audio-row">
                <div class="physics-paint-audio-label-cell">
                  <span class="physics-paint-photo-reference-label">{AUDIO_FADE_OUT_LABEL} (frames)</span>
                </div>
                <div class="physics-paint-audio-controls">
                  <NumericStepper
                    class="physics-paint-audio-field-stepper"
                    value={sound.fadeOutFrames}
                    step={1}
                    min={0}
                    onChange={(value) => commitFadeOut(value)}
                    ariaLabel="Fade out frames"
                  />
                  <select
                    aria-label={`${AUDIO_FADE_OUT_LABEL} curve`}
                    value={sound.fadeOutCurve}
                    disabled={controlsDisabled}
                    onChange={(event) => commitFadeOutCurve((event.currentTarget as HTMLSelectElement).value as SoundFadeCurve)}
                  >
                    {FADE_CURVE_OPTIONS.map((curve) => (
                      <option key={curve} value={curve}>{curve}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 11. Footer — LEFT enabled pill (the modal's single audio switch:
                  ON = the clip is audible in Studio, in the main app, and in
                  export; OFF = silent everywhere — it never touches the main
                  app's audio tracks), RIGHT two-step Remove. */}
              <div class="physics-paint-audio-footer">
                <button
                  type="button"
                  class="physics-paint-photo-reference-toggle"
                  aria-label="Document sound on/off"
                  aria-pressed={sound.enabled}
                  aria-disabled={controlsDisabled}
                  disabled={controlsDisabled}
                  data-testid="audio-modal-enabled"
                  onClick={toggleEnabled}
                >
                  {sound.enabled ? <Volume2 size={12} aria-hidden="true" /> : null}
                  <span>{sound.enabled ? AUDIO_ENABLE_ON : AUDIO_ENABLE_OFF}</span>
                </button>
                <button
                  type="button"
                  class={`physics-paint-photo-reference-remove${removeArmed ? ' physics-paint-audio-remove-armed' : ''}`}
                  aria-label={removeArmed ? AUDIO_REMOVE_ARMED : AUDIO_REMOVE}
                  aria-pressed={removeArmed}
                  disabled={controlsDisabled}
                  onClick={() => {
                    if (removeArmed) confirmRemove();
                    else requestRemove();
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                  <span>{removeArmed ? AUDIO_REMOVE_ARMED : AUDIO_REMOVE}</span>
                </button>
              </div>
              {removeArmed ? (
                <p class="physics-paint-audio-confirm-copy" data-testid="audio-remove-confirm-copy">
                  {AUDIO_REMOVE_CONFIRM_COPY}
                </p>
              ) : null}
            </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
