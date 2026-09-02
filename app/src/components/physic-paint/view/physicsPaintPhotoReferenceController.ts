import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type { PhotoReferenceDisplayResult, PhotoReferenceMutationResult } from '../../../stores/efxPaintStore';

/**
 * 50-05 (S5): the Photo Reference controller — the shared state machine behind
 * the floating Photo Reference dialog (50-UAT modal redesign). Kept as a
 * controller module (no component) so the dialog owns the render surface while
 * the controller owns the display/mutation controls and the source facts:
 *   - `Overlay opacity` slider (D-12) — a persisted display preference via
 *     `setPhotoReferenceOpacity` (0..1 store, 0..100 display). Live preview
 *     during drag, commit on release (Phase 48 release-commit pattern). NOT an
 *     undoable mutation, never touches the flattened raster.
 *   - `Lock reference transform` toggle (D-13) — a display property via
 *     `setPhotoReferenceTransformLocked`. Locked by default; unlocking enters
 *     reference-transform mode.
 *   - `Show in studio` toggle (D-11) — a display property via
 *     `setPhotoReferenceVisible`.
 *   - Source facts `{N} image(s)` with original filenames in natural sort order
 *     in the tooltip, and `No source imported` when empty.
 *
 * The Phase 50 `Mode` 3-segment control is REMOVED entirely (52-02, D-15 clean
 * break) — the `PhotoReferenceMode` flag no longer exists; the reveal rail
 * bakes the reference as placed regardless of any mode.
 *
 * The controller reads ACCEPTED canonical state only (no optimistic facts,
 * UI-SPEC busy rule). With no photo/reference track it still reports the
 * defaults (opacity 50%, transform locked, visible).
 *
 * Signals-only state (efx-preact-reactivity): the controller holds the opacity
 * draft in a signal; the view reads the document via narrow reads. No useState,
 * no render-body signal writes.
 *
 * The two boolean toggles invert from a LIVE `getDocument` read at click time
 * (never from a render-captured closure) so a toggle is always reversible — the
 * second click can never re-send the stale first value (50-UAT round 2 fix).
 */

export interface PhysicsPaintPhotoReferencePorts {
  /** Document read — the controller never holds its own truth. */
  getDocument: (layerId: string) => EfxPaintDocument | undefined;
  /** 50-02 store op: setPhotoReferenceOpacity(layerId, opacity) — display preference (D-12). */
  setOpacity: (layerId: string, opacity: number) => PhotoReferenceDisplayResult;
  /** 50-02 store op: setPhotoReferenceTransformLocked(layerId, locked) — display property (D-13). */
  setTransformLocked: (layerId: string, locked: boolean) => PhotoReferenceDisplayResult;
  /** 50-02 store op: setPhotoReferenceVisible(layerId, visible) — display property (D-11). */
  setVisible: (layerId: string, visible: boolean) => PhotoReferenceDisplayResult;
  /** 50-02 store op: clearPhotoReference(layerId) — one undoable mutation (D-03 remove). */
  clearReference: (layerId: string) => PhotoReferenceMutationResult;
  /** sourceRef → original filename (D-02: natural order is the stored refs order). */
  resolveFilename: (sourceRef: string) => string | undefined;
}

export interface PhysicsPaintPhotoReferenceControllerProps {
  layerId: string;
  /** Injectable ports for tests; production defaults hit the real store. */
  ports?: Partial<PhysicsPaintPhotoReferencePorts>;
}

export interface PhysicsPaintPhotoReferenceController {
  /** The accepted opacity as a 0..100 integer (display scale). */
  opacityPercent: number;
  /** The live drag draft (null when not dragging) — release-commit (D-12). */
  opacityDraft: Signal<number | null>;
  /** The value the slider shows: the draft while dragging, else the accepted value. */
  previewOpacityPercent: number;
  transformLocked: boolean;
  /** The accepted Studio visibility (D-11). */
  visibleInStudio: boolean;
  sourceCount: number;
  filenames: string[];
  hasSource: boolean;
  previewOpacity: (percent: number) => void;
  commitOpacity: (percent: number) => void;
  /** Invert the lock from the LIVE document (always reversible, 50-UAT fix). */
  toggleTransformLocked: () => void;
  /** Invert the visibility from the LIVE document (always reversible, 50-UAT fix). */
  toggleVisible: () => void;
  removeReference: () => void;
}

/** The locked empty-source fact copy (UI-SPEC Copywriting Contract). */
export const PHOTO_REFERENCE_EMPTY_SOURCE = 'No source imported';

/** The locked unlock tooltip copy (UI-SPEC Copywriting Contract). */
export const PHOTO_REFERENCE_UNLOCKED_TOOLTIP = 'Unlocked — canvas gestures move the reference';

/** The default opacity (50%) as a 0..100 display integer (D-12, UI-SPEC). */
const DEFAULT_OPACITY_PERCENT = 50;

export function usePhysicsPaintPhotoReferenceController({
  layerId,
  ports = {},
}: PhysicsPaintPhotoReferenceControllerProps): PhysicsPaintPhotoReferenceController {
  const getDocument = ports.getDocument ?? defaultPorts.getDocument;
  const setOpacity = ports.setOpacity ?? defaultPorts.setOpacity;
  const setTransformLocked = ports.setTransformLocked ?? defaultPorts.setTransformLocked;
  const setVisible = ports.setVisible ?? defaultPorts.setVisible;
  const clearReference = ports.clearReference ?? defaultPorts.clearReference;
  const resolveFilename = ports.resolveFilename ?? defaultPorts.resolveFilename;

  const document = getDocument(layerId);
  const track = document?.photoReference ?? null;

  const opacityPercent = track ? Math.round(track.opacity * 100) : DEFAULT_OPACITY_PERCENT;
  const transformLocked = track?.transformLocked ?? true;
  const visibleInStudio = track?.visibleInStudio ?? true;
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

  const previewOpacity = (percent: number) => {
    opacityDraft.value = percent;
  };

  const commitOpacity = (percent: number) => {
    opacityDraft.value = null;
    setOpacity(layerId, percent / 100);
  };

  // 50-UAT fix: invert from a LIVE read so the reverse click always sends the
  // opposite of the current accepted value — never a render-captured stale one.
  const toggleTransformLocked = () => {
    const doc = getDocument(layerId);
    const current = doc?.photoReference?.transformLocked ?? true;
    setTransformLocked(layerId, !current);
  };

  const toggleVisible = () => {
    const doc = getDocument(layerId);
    const current = doc?.photoReference?.visibleInStudio ?? true;
    setVisible(layerId, !current);
  };

  const removeReference = () => {
    clearReference(layerId);
  };

  return {
    opacityPercent,
    opacityDraft,
    previewOpacityPercent: opacityDraft.value ?? opacityPercent,
    transformLocked,
    visibleInStudio,
    sourceCount,
    filenames,
    hasSource: sourceCount > 0,
    previewOpacity,
    commitOpacity,
    toggleTransformLocked,
    toggleVisible,
    removeReference,
  };
}

/** Production ports — the real store ops and the imageStore filename resolver. */
const defaultPorts: PhysicsPaintPhotoReferencePorts = {
  getDocument: () => undefined,
  setOpacity: () => ({ ok: false, reason: 'no-photo-reference' }),
  setTransformLocked: () => ({ ok: false, reason: 'no-photo-reference' }),
  setVisible: () => ({ ok: false, reason: 'no-photo-reference' }),
  clearReference: () => ({ ok: false, reason: 'no-photo-reference' }),
  resolveFilename: () => undefined,
};
