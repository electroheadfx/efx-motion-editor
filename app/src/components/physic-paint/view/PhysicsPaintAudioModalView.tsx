import { useEffect, useRef } from 'preact/hooks';
import { AudioWaveform, Trash2, X } from 'lucide-preact';
import { NumericInput } from '../../shared/NumericInput';
import type { PhysicsPaintAudioController, SoundFadeCurve } from './physicsPaintAudioController';

/**
 * 52.5-01b — the floating `Document sound` dialog (D-05 single control
 * surface). Pattern: `PhysicsPaintPhotoReferenceDialog` / Play Script floating
 * dialog — NO backdrop, NO Tab trap, Escape closes, close button, focus
 * captured on open and restored to the launcher on close, header drag
 * repositions (photo-ref precedent). Width 300px (UI-SPEC spacing exception).
 *
 * Copywriting Contract (52.5-UI-SPEC — verbatim, never interpolated, defined
 * here because this component renders it):
 *
 *   `Document sound` · `Import sound` · `Replace…` · `No sound yet` ·
 *   `Import a dialogue or foley clip for this animation — WAV, MP3, AAC, or FLAC.` ·
 *   `Reading audio…` · `Remove` → `Confirm remove?` ·
 *   `Remove sound? Position, trims, volume, and fades are discarded from this document.` ·
 *   `Couldn't read this audio file. Use WAV, MP3, AAC, or FLAC, or replace the clip.` ·
 *   `Sound file is missing from the project. Replace it to restore the clip.` ·
 *   `Volume` (readout `NN%`) · `Fade in` · `Fade out` (curves `linear`,
 *   `exponential`, `logarithmic`) · `Sound in output` · `Preview main app too`
 *
 * Field order top-to-bottom is a verbatim contract (52.5-UI-SPEC Audio modal):
 *   1. header: AudioWaveform 15px + `Document sound` + close X
 *   2. file row (filename + `Replace…`) OR the empty-state block
 *      (`No sound yet` / body / `Import sound`) OR the error copy
 *   3. `Remove` — two-step inline confirm (`Confirm remove?` + confirm copy)
 *   4. `Volume` — native range 0-100 step 1 + NN% readout (release-commit)
 *   5. `Fade in` — NumericInput + curve select
 *   6. `Fade out` — NumericInput + curve select
 *   7. toggle row: `Sound in output` | `Preview main app too` (aria-pressed)
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

export const AUDIO_MODAL_TITLE = 'Document sound';
export const AUDIO_EMPTY_HEADING = 'No sound yet';
export const AUDIO_EMPTY_BODY = 'Import a dialogue or foley clip for this animation — WAV, MP3, AAC, or FLAC.';
export const AUDIO_IMPORT_CTA = 'Import sound';
export const AUDIO_REPLACE_CTA = 'Replace…';
export const AUDIO_LOADING = 'Reading audio…';
export const AUDIO_REMOVE = 'Remove';
export const AUDIO_REMOVE_ARMED = 'Confirm remove?';
export const AUDIO_REMOVE_CONFIRM_COPY = 'Remove sound? Position, trims, volume, and fades are discarded from this document.';
export const AUDIO_ERROR_DECODE = "Couldn't read this audio file. Use WAV, MP3, AAC, or FLAC, or replace the clip.";
export const AUDIO_ERROR_MISSING = 'Sound file is missing from the project. Replace it to restore the clip.';
export const AUDIO_VOLUME_LABEL = 'Volume';
export const AUDIO_FADE_IN_LABEL = 'Fade in';
export const AUDIO_FADE_OUT_LABEL = 'Fade out';
export const AUDIO_TOGGLE_IN_OUTPUT = 'Sound in output';
export const AUDIO_TOGGLE_PREVIEW_MAIN = 'Preview main app too';

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
  /** Import/Replace intent — opens the shared gallery with kind 'audio'. */
  onImportRequest: () => void;
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
    sound, filename, missing, busy, decodeError, previewVolume, removeArmed,
    previewVolumeInput, commitVolume, commitFadeIn, commitFadeOut,
    commitFadeInCurve, commitFadeOutCurve, toggleSoundInOutput,
    togglePreviewMainApp, requestRemove, confirmRemove, disarmRemove,
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
      }}
    >
      <div
        ref={surfaceRef}
        class="physics-paint-photo-reference-surface physics-paint-audio-surface"
        style={{ width: '300px' }}
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
          {sound === null ? (
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
                onClick={withDisarm(onImportRequest)}
                disabled={controlsDisabled}
              >
                <AudioWaveform size={13} aria-hidden="true" />
                <span>{busy ? AUDIO_LOADING : AUDIO_IMPORT_CTA}</span>
              </button>
            </div>
          ) : (
            <>
              {/* 2b. File row + Replace… */}
              <div class="physics-paint-photo-reference-source">
                <span class="physics-paint-photo-reference-label">File</span>
                <span class="physics-paint-photo-reference-label-spacer" aria-hidden="true" />
                <span class="physics-paint-photo-reference-chip" title={filename ?? undefined}>
                  <span class="physics-paint-audio-filename">{filename}</span>
                </span>
                <button
                  type="button"
                  class="physics-paint-photo-reference-import"
                  onClick={withDisarm(onImportRequest)}
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

              {/* 3. Remove — two-step inline confirm */}
              <div class="physics-paint-photo-reference-actions">
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
                {removeArmed ? (
                  <p class="physics-paint-audio-confirm-copy" data-testid="audio-remove-confirm-copy">
                    {AUDIO_REMOVE_CONFIRM_COPY}
                  </p>
                ) : null}
              </div>

              {/* 4. Volume — native range, release-commit (AudioProperties precedent) */}
              <div class="physics-paint-audio-row">
                <div class="physics-paint-photo-reference-opacity-labels">
                  <span class="physics-paint-photo-reference-label">{AUDIO_VOLUME_LABEL}</span>
                  <span class="physics-paint-photo-reference-label-spacer" aria-hidden="true" />
                  <output>{previewVolume}%</output>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={previewVolume}
                  aria-label={AUDIO_VOLUME_LABEL}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={previewVolume}
                  aria-disabled={controlsDisabled}
                  disabled={controlsDisabled}
                  style={{ width: '100%', accentColor: 'var(--color-accent, #2D5BE3)', cursor: 'pointer' }}
                  onInput={(event) => previewVolumeInput(Number((event.currentTarget as HTMLInputElement).value))}
                  onPointerUp={(event) => commitVolume(Number((event.currentTarget as HTMLInputElement).value))}
                  onKeyUp={(event) => commitVolume(Number((event.currentTarget as HTMLInputElement).value))}
                  onBlur={(event) => commitVolume(Number((event.currentTarget as HTMLInputElement).value))}
                />
              </div>

              {/* 5. Fade in — NumericInput (label scrubs the value) + curve select */}
              <div class="physics-paint-audio-row physics-paint-audio-fade">
                <NumericInput
                  label={AUDIO_FADE_IN_LABEL}
                  value={sound.fadeInFrames}
                  step={1}
                  min={0}
                  onChange={(value) => commitFadeIn(value)}
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

              {/* 6. Fade out — NumericInput + curve select */}
              <div class="physics-paint-audio-row physics-paint-audio-fade">
                <NumericInput
                  label={AUDIO_FADE_OUT_LABEL}
                  value={sound.fadeOutFrames}
                  step={1}
                  min={0}
                  onChange={(value) => commitFadeOut(value)}
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

              {/* 7. Toggle row — two aria-pressed photo-ref-style buttons */}
              <div class="physics-paint-photo-reference-toggles">
                <button
                  type="button"
                  class="physics-paint-photo-reference-toggle"
                  aria-label={AUDIO_TOGGLE_IN_OUTPUT}
                  aria-pressed={sound.soundInOutput}
                  aria-disabled={controlsDisabled}
                  disabled={controlsDisabled}
                  onClick={toggleSoundInOutput}
                >
                  <span>{AUDIO_TOGGLE_IN_OUTPUT}</span>
                </button>
                <button
                  type="button"
                  class="physics-paint-photo-reference-toggle"
                  aria-label={AUDIO_TOGGLE_PREVIEW_MAIN}
                  aria-pressed={sound.previewMainApp}
                  aria-disabled={controlsDisabled}
                  disabled={controlsDisabled}
                  onClick={togglePreviewMainApp}
                >
                  <span>{AUDIO_TOGGLE_PREVIEW_MAIN}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
