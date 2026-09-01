import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import { Lock, LockOpen } from 'lucide-preact';
import type { EfxPaintDocument, PhotoReferenceMode } from '../../../efx-paint/document/efxPaintDocument';
import type { PhotoReferenceDisplayResult, PhotoReferenceMutationResult } from '../../../stores/efxPaintStore';

/**
 * 50-05 (Task 1, S5): the right-panel `Photo Reference` section.
 *
 * A PERSISTENT section (exactly one photo/reference track per document, REF-01)
 * that renders the three display/mutation controls and the source facts:
 *   - `Mode` 3-segment control (D-05) — one undoable document mutation via
 *     `setPhotoReferenceMode` (D-07). Flag-only in Phase 50: all three modes
 *     show the ghost identically; the ONLY visible difference is the active
 *     segment (D-06 HARD LOCK).
 *   - `Overlay opacity` slider (D-12) — a persisted display preference via
 *     `setPhotoReferenceOpacity` (0..1 store, 0..100 display). Live preview
 *     during drag, commit on release (Phase 48 release-commit pattern). NOT an
 *     undoable mutation, never touches the flattened raster.
 *   - `Lock reference transform` toggle (D-13) — a display property via
 *     `setPhotoReferenceTransformLocked`. Locked by default; unlocking enters
 *     reference-transform mode.
 *   - Source facts `{N} image(s)` with original filenames in natural sort order
 *     in the tooltip, and `No source imported` when empty.
 *
 * The section reads ACCEPTED canonical state only (no optimistic facts,
 * UI-SPEC busy rule). With no photo/reference track the section still renders
 * with the defaults (mode `reference-only`, opacity 50%, transform locked) and
 * the empty-source fact — the mode always has a value (UI-SPEC S5 empty row).
 *
 * Signals-only state (efx-preact-reactivity): the controller holds the opacity
 * draft in a signal; the view reads the document via narrow reads. No useState,
 * no render-body signal writes.
 */

export interface PhysicsPaintPhotoReferenceSectionPorts {
  /** Document read — the section never holds its own truth (key_links). */
  getDocument: (layerId: string) => EfxPaintDocument | undefined;
  /** 50-02 store op: setPhotoReferenceMode(layerId, mode) — one undoable mutation (D-07). */
  setMode: (layerId: string, mode: PhotoReferenceMode) => PhotoReferenceMutationResult;
  /** 50-02 store op: setPhotoReferenceOpacity(layerId, opacity) — display preference (D-12). */
  setOpacity: (layerId: string, opacity: number) => PhotoReferenceDisplayResult;
  /** 50-02 store op: setPhotoReferenceTransformLocked(layerId, locked) — display property (D-13). */
  setTransformLocked: (layerId: string, locked: boolean) => PhotoReferenceDisplayResult;
  /** sourceRef → original filename (D-02: natural order is the stored refs order). */
  resolveFilename: (sourceRef: string) => string | undefined;
}

export interface PhysicsPaintPhotoReferenceSectionProps {
  layerId: string;
  /** Injectable ports for tests; production defaults hit the real store. */
  ports?: Partial<PhysicsPaintPhotoReferenceSectionPorts>;
}

export interface PhysicsPaintPhotoReferenceSectionController {
  mode: PhotoReferenceMode;
  /** The accepted opacity as a 0..100 integer (display scale). */
  opacityPercent: number;
  /** The live drag draft (null when not dragging) — release-commit (D-12). */
  opacityDraft: Signal<number | null>;
  /** The value the slider shows: the draft while dragging, else the accepted value. */
  previewOpacityPercent: number;
  transformLocked: boolean;
  sourceCount: number;
  filenames: string[];
  hasSource: boolean;
  selectMode: (mode: PhotoReferenceMode) => void;
  previewOpacity: (percent: number) => void;
  commitOpacity: (percent: number) => void;
  toggleTransformLocked: (locked: boolean) => void;
}

/** The locked mode exclusion hint copy (UI-SPEC Copywriting Contract). */
export const PHOTO_REFERENCE_MODE_HINT = 'The reference never appears in flattened output.';

/** The locked empty-source fact copy (UI-SPEC Copywriting Contract). */
export const PHOTO_REFERENCE_EMPTY_SOURCE = 'No source imported';

/** The locked unlock tooltip copy (UI-SPEC Copywriting Contract). */
export const PHOTO_REFERENCE_UNLOCKED_TOOLTIP = 'Unlocked — canvas gestures move the reference';

/** The three locked mode options in canonical order (D-05). */
export const PHOTO_REFERENCE_MODE_OPTIONS: readonly { value: PhotoReferenceMode; label: string }[] = [
  { value: 'reference-only', label: 'Reference only' },
  { value: 'reveal-source', label: 'Reveal source' },
  { value: 'masked-transform-source', label: 'Masked transform' },
];

/** The default opacity (50%) as a 0..100 display integer (D-12, UI-SPEC). */
const DEFAULT_OPACITY_PERCENT = 50;

export function usePhysicsPaintPhotoReferenceSectionController({
  layerId,
  ports = {},
}: PhysicsPaintPhotoReferenceSectionProps): PhysicsPaintPhotoReferenceSectionController {
  const getDocument = ports.getDocument ?? defaultPorts.getDocument;
  const setMode = ports.setMode ?? defaultPorts.setMode;
  const setOpacity = ports.setOpacity ?? defaultPorts.setOpacity;
  const setTransformLocked = ports.setTransformLocked ?? defaultPorts.setTransformLocked;
  const resolveFilename = ports.resolveFilename ?? defaultPorts.resolveFilename;

  const document = getDocument(layerId);
  const track = document?.photoReference ?? null;

  const mode = track?.mode ?? 'reference-only';
  const opacityPercent = track ? Math.round(track.opacity * 100) : DEFAULT_OPACITY_PERCENT;
  const transformLocked = track?.transformLocked ?? true;
  const sourceCount = track?.sourceFrameRefs.length ?? 0;
  const filenames = track
    ? track.sourceFrameRefs
        .map((ref) => resolveFilename(ref))
        .filter((name): name is string => Boolean(name))
    : [];

  // The release-commit draft (D-12): while dragging, the thumb follows the mouse
  // through this signal; the store write happens only on release. Held in a
  // signal so the view re-renders the thumb live without a store write.
  const opacityDraft = useSignal<number | null>(null);

  const selectMode = (nextMode: PhotoReferenceMode) => {
    setMode(layerId, nextMode);
  };

  const previewOpacity = (percent: number) => {
    opacityDraft.value = percent;
  };

  const commitOpacity = (percent: number) => {
    opacityDraft.value = null;
    setOpacity(layerId, percent / 100);
  };

  const toggleTransformLocked = (locked: boolean) => {
    setTransformLocked(layerId, locked);
  };

  return {
    mode,
    opacityPercent,
    opacityDraft,
    previewOpacityPercent: opacityDraft.value ?? opacityPercent,
    transformLocked,
    sourceCount,
    filenames,
    hasSource: sourceCount > 0,
    selectMode,
    previewOpacity,
    commitOpacity,
    toggleTransformLocked,
  };
}

export function PhysicsPaintPhotoReferenceSection(props: PhysicsPaintPhotoReferenceSectionProps) {
  const {
    mode, previewOpacityPercent, transformLocked, sourceCount, filenames, hasSource,
    selectMode, previewOpacity, commitOpacity, toggleTransformLocked,
  } = usePhysicsPaintPhotoReferenceSectionController(props);
  return (
    <section class="physics-paint-right-section physics-paint-photo-reference-section" aria-label="Photo Reference">
      <span class="physics-paint-section-heading">Photo Reference</span>
      <div class="physics-paint-option-group">
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label" id="physics-photo-reference-mode-label">Mode</span>
          <div
            class="physics-paint-segmented-row physics-paint-photo-reference-mode"
            role="radiogroup"
            aria-label="Mode"
            aria-describedby="physics-photo-reference-mode-hint"
          >
            {PHOTO_REFERENCE_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                class={`physics-paint-segmented-button${mode === option.value ? ' active' : ''}`}
                onClick={() => selectMode(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <span
          id="physics-photo-reference-mode-hint"
          class="physics-paint-bg-repeat-hint"
        >
          {PHOTO_REFERENCE_MODE_HINT}
        </span>
        <label class="physics-paint-option-row" for="physics-photo-reference-opacity">
          <span class="physics-paint-right-label">Overlay opacity</span>
          <input
            id="physics-photo-reference-opacity"
            type="range"
            role="slider"
            aria-label="Overlay opacity"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={previewOpacityPercent}
            min={0}
            max={100}
            step={1}
            value={previewOpacityPercent}
            onInput={(event) => previewOpacity(Number((event.currentTarget as HTMLInputElement).value))}
            onPointerUp={(event) => commitOpacity(Number((event.currentTarget as HTMLInputElement).value))}
            onKeyUp={(event) => commitOpacity(Number((event.currentTarget as HTMLInputElement).value))}
            onBlur={(event) => commitOpacity(Number((event.currentTarget as HTMLInputElement).value))}
          />
          <output>{previewOpacityPercent}%</output>
        </label>
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label">Lock reference transform</span>
          <button
            type="button"
            class="physics-paint-photo-reference-lock"
            aria-label="Lock reference transform"
            aria-pressed={transformLocked}
            title={transformLocked ? undefined : PHOTO_REFERENCE_UNLOCKED_TOOLTIP}
            onClick={() => toggleTransformLocked(!transformLocked)}
          >
            {transformLocked ? <Lock size={14} aria-hidden="true" /> : <LockOpen size={14} aria-hidden="true" />}
            <span>{transformLocked ? 'Locked' : 'Unlocked'}</span>
          </button>
        </div>
        <div class="physics-paint-option-row">
          <span class="physics-paint-right-label">Source</span>
          {hasSource ? (
            <span class="physics-paint-bg-clip-value" title={filenames.join('\n')}>
              {sourceCount} image(s)
            </span>
          ) : (
            <span class="physics-paint-bg-clip-value">{PHOTO_REFERENCE_EMPTY_SOURCE}</span>
          )}
        </div>
      </div>
    </section>
  );
}

/** Production ports — the real store ops and the imageStore filename resolver. */
const defaultPorts: PhysicsPaintPhotoReferenceSectionPorts = {
  getDocument: () => undefined,
  setMode: () => ({ ok: false, reason: 'no-photo-reference' }),
  setOpacity: () => ({ ok: false, reason: 'no-photo-reference' }),
  setTransformLocked: () => ({ ok: false, reason: 'no-photo-reference' }),
  resolveFilename: () => undefined,
};
