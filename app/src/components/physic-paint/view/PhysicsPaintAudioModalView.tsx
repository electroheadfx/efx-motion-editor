import { useEffect, useRef } from 'preact/hooks';
import { AudioWaveform, Trash2, Volume2, VolumeX, X } from 'lucide-preact';
import { NumericStepper } from '../../shared/NumericStepper';
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
 *   `Remove sound? Position, trims, gain, and fades are discarded from this document.` ·
 *   `Couldn't read this audio file. Use WAV, MP3, AAC, or FLAC, or replace the clip.` ·
 *   `Sound file is missing from the project. Replace it to restore the clip.` ·
 *   `Gain` (readout `-NN..+NN`, 0 = unity) · `Fade in` · `Fade out` (frames; curves `linear`,
 *   `exponential`, `logarithmic`) · `In` · `Out` (frames) · `On` / `Off`
 *
 * Field order top-to-bottom is a verbatim contract (52.5-UI-SPEC Audio modal):
 *   1. header: AudioWaveform 15px + `Document sound` + close X
 *   2. file row (filename + `Replace…`) OR the empty-state block
 *      (`No sound yet` / body / `Import sound`) OR the error copy
 *   3. `Remove` — two-step inline confirm (`Confirm remove?` + confirm copy)
 *   4. `Gain` — NumericStepper step 5, -100..100 (per-step commit) + signed readout
 *   5-6. `Fade in` | `Fade out` — one row, 2 columns, values in FRAMES
 *        (integer >= 0, no 99 cap) + curve select under each stepper
 *   7. `In` | `Out` — source trim in frames (2 columns, 1-frame minimum span)
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
export const AUDIO_REMOVE_CONFIRM_COPY = 'Remove sound? Position, trims, gain, and fades are discarded from this document.';
export const AUDIO_ERROR_DECODE = "Couldn't read this audio file. Use WAV, MP3, AAC, or FLAC, or replace the clip.";
export const AUDIO_ERROR_MISSING = 'Sound file is missing from the project. Replace it to restore the clip.';
export const AUDIO_GAIN_LABEL = 'Gain';
export const AUDIO_FADE_IN_LABEL = 'Fade in';
export const AUDIO_FADE_OUT_LABEL = 'Fade out';
export const AUDIO_IN_LABEL = 'In';
export const AUDIO_OUT_LABEL = 'Out';
export const AUDIO_ENABLE_ON = 'On';
export const AUDIO_ENABLE_OFF = 'Off';
/** 52.5 UAT: the main-app-audio preview toggle (header, preview-only). */
export const AUDIO_MAIN_APP_AUDIO_ON = 'Main app audio On — preview only, click to mute';
export const AUDIO_MAIN_APP_AUDIO_OFF = 'Main app audio Off — preview only, click to hear';
export const AUDIO_MAIN_APP_AUDIO_ARIA_ON = 'Mute main app audio in the Studio preview';
export const AUDIO_MAIN_APP_AUDIO_ARIA_OFF = 'Hear main app audio in the Studio preview';

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
  /**
   * 52.5 UAT: "hear the MAIN APP's audio while previewing in the Studio" — a
   * SECOND, independent switch from the clip's `enabled` row below. Preview-
   * only: it never touches main-editor playback or the exported mix (those
   * always carry the clip AND the main tracks). Session state shared with the
   * strip's Audio Preview toggle (one signal, two surfaces); defaults Off so
   * the Studio previews the studio sound alone. Lives in the header so it is
   * reachable even in the empty state (before any clip is imported).
   */
  mainAppAudioEnabled: boolean;
  onToggleMainAppAudio: () => void;
}

export function PhysicsPaintAudioModalView({
  open,
  controller,
  onClose,
  onImportRequest,
  mainAppAudioEnabled,
  onToggleMainAppAudio,
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
    sound, filename, missing, busy, decodeError, previewGain, removeArmed,
    commitGain, commitFadeIn, commitFadeOut,
    commitFadeInCurve, commitFadeOutCurve, commitInFrame, commitOutFrame,
    toggleEnabled, requestRemove, confirmRemove, disarmRemove,
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
          {/* 52.5 UAT: main-app-audio preview toggle. SECOND switch, unrelated
              to the clip's `enabled` row — it only decides whether the MAIN
              APP's tracks are heard underneath in the Studio preview (default
              Off = the Studio previews the studio sound alone). Preview-only:
              main-editor playback and the exported mix always carry both. */}
          <button
            type="button"
            class="physics-paint-audio-preview-toggle"
            aria-label={mainAppAudioEnabled ? AUDIO_MAIN_APP_AUDIO_ARIA_ON : AUDIO_MAIN_APP_AUDIO_ARIA_OFF}
            aria-pressed={mainAppAudioEnabled}
            title={mainAppAudioEnabled ? AUDIO_MAIN_APP_AUDIO_ON : AUDIO_MAIN_APP_AUDIO_OFF}
            data-testid="audio-modal-main-app-audio"
            onClick={onToggleMainAppAudio}
          >
            {mainAppAudioEnabled ? <Volume2 size={13} aria-hidden="true" /> : <VolumeX size={13} aria-hidden="true" />}
          </button>
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

              {/* 3. Remove + On/Off — one line (UAT round 2). The switch is the
                  studio-layer sound: ON = the clip is audible in Studio, in the
                  main app, and in export; OFF = silent everywhere. It never
                  touches the main app's audio tracks. */}
              <div class="physics-paint-audio-enable-row">
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
                  <span>{sound.enabled ? AUDIO_ENABLE_ON : AUDIO_ENABLE_OFF}</span>
                </button>
              </div>
              {removeArmed ? (
                <p class="physics-paint-audio-confirm-copy" data-testid="audio-remove-confirm-copy">
                  {AUDIO_REMOVE_CONFIRM_COPY}
                </p>
              ) : null}

              {/* 4. Gain — NumericStepper step 5, -100..100 (per-step commit) + signed readout */}
              <div class="physics-paint-audio-row">
                <div class="physics-paint-photo-reference-opacity-labels">
                  <span class="physics-paint-photo-reference-label">{AUDIO_GAIN_LABEL}</span>
                  <span class="physics-paint-photo-reference-label-spacer" aria-hidden="true" />
                  <output>{previewGain > 0 ? `+${previewGain}` : `${previewGain}`}</output>
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

              {/* 5-6. Fade in | Fade out — one row, 2 columns (UAT). Values are
                  FRAMES (the model field is fadeInFrames); the unit is in the
                  label so it never reads as seconds. Integer >= 0, no 99 cap. */}
              <div class="physics-paint-audio-grid">
                <div class="physics-paint-audio-field">
                  <span class="physics-paint-audio-field-label">{AUDIO_FADE_IN_LABEL} (frames)</span>
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
                <div class="physics-paint-audio-field">
                  <span class="physics-paint-audio-field-label">{AUDIO_FADE_OUT_LABEL} (frames)</span>
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

              {/* 7. In | Out — source trim in FRAMES (UAT round 2: the end of the
                  clip was unreachable on the 6px trim zones). 1-frame minimum
                  span: an entry that would invert the span never commits. */}
              <div class="physics-paint-audio-grid">
                <div class="physics-paint-audio-field">
                  <span class="physics-paint-audio-field-label">{AUDIO_IN_LABEL} (frames)</span>
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
                <div class="physics-paint-audio-field">
                  <span class="physics-paint-audio-field-label">{AUDIO_OUT_LABEL} (frames)</span>
                  <NumericStepper
                    class="physics-paint-audio-field-stepper"
                    value={sound.outFrame}
                    step={1}
                    min={sound.inFrame + 1}
                    onChange={(value) => commitOutFrame(value)}
                    ariaLabel="Out frames"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
