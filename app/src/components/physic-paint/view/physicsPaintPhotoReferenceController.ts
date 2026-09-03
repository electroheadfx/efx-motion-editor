import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import type {
  PhotoReferenceDisplayResult,
  PhotoReferenceMutationResult,
  RevealRailMutationRejectionReason,
  RevealRailMutationResult,
} from '../../../stores/efxPaintStore';

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
  /* ---- 52-04 (D-16/D-19): the reveal-rail creation flow ports ---- */
  /** The document's current active track id — the reveal rail's target (D-19). */
  getActiveTrackId: (layerId: string) => string | null;
  /** The SCRIPTS library rows, UNFILTERED — scripts carry no kind field (D-26). */
  getScriptRows: () => readonly RevealScriptRow[];
  /** The create-reveal-rail mutation from Plan 01 — creation IS the first bake (D-11). */
  createReveal: (layerId: string, input: RevealCreateInput) => Promise<RevealRailMutationResult>;
  /** The current playhead/cursor frame — the default rail span start (D-20). */
  getCurrentFrame: () => number;
  /** The script's natural duration at the current motion parameters (D-20). */
  getScriptNaturalDuration: (scriptId: string) => number | null;
}

/** 52-04: the reveal rail variant (D-03/D-26) — mirrors RotoPlayScriptMode. */
export type RevealRailVariant = 'progressive' | 'static';

/** 52-04: one SCRIPTS library row projected for the reveal picker (unfiltered — D-26). */
export interface RevealScriptRow {
  readonly id: string;
  readonly name: string;
  readonly brushCount: number;
  readonly thumbnail: { readonly dataUrl: string; readonly width: number; readonly height: number };
}

/** 52-04: input to the create-reveal-rail mutation (Plan 01) — creation IS the first bake (D-11). */
export interface RevealCreateInput {
  readonly trackId: string;
  readonly scriptId: string;
  readonly variant: RevealRailVariant;
  readonly startFrame: number;
  readonly frameCount: number;
  readonly onProgress?: (completed: number, total: number) => void;
}

export interface PhysicsPaintPhotoReferenceControllerProps {
  layerId: string;
  /** Injectable ports for tests; production defaults hit the real store. */
  ports?: Partial<PhysicsPaintPhotoReferencePorts>;
  /** 52-04 (D-19): pre-open the reveal-creation surface — the track rail-creation
   *  flow entry (the modal's "Reveal with script…" button opens it directly). */
  revealCreationRequested?: boolean;
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
  /* ---- 52-04 (D-16/D-19): the reveal-rail creation flow state machine ---- */
  /** The SCRIPTS library rows the picker shows (unfiltered — D-26). */
  revealScriptRows: readonly RevealScriptRow[];
  /** True while the reveal-creation surface is open (the SCRIPTS picker + variant). */
  revealCreationOpen: Signal<boolean>;
  /** The selected library script id (null until the user picks one). */
  revealScriptId: Signal<string | null>;
  /** The creation-time variant (D-26) — fixed at creation, never changes after (D-21). */
  revealVariant: Signal<RevealRailVariant>;
  /** The span start — the playhead frame snapshotted when the surface opens (D-20, G-52-2c). */
  revealSpanStart: Signal<number>;
  /** The span length — editable, defaults to the script's natural duration (G-52-2c). */
  revealFrameCount: Signal<number>;
  /** The bake onProgress bar (completed/total) — creation IS the first bake (D-11). */
  revealProgress: Signal<{ completed: number; total: number } | null>;
  /** True while the create+bake mutation is running. */
  revealBusy: Signal<boolean>;
  /** The fail-closed rejection copy (D-12/D-13), or null when no error. */
  revealError: Signal<string | null>;
  /** Open the reveal-creation surface (the "Reveal with script…" entry, D-16). */
  openRevealCreation: () => void;
  /** Select a library script in the picker (unfiltered — D-26). */
  selectRevealScript: (scriptId: string) => void;
  /** Set the creation-time variant (D-26). */
  setRevealVariant: (variant: RevealRailVariant) => void;
  /** Set the editable span length (G-52-2c) — validated at creation time. */
  setRevealFrameCount: (frames: number) => void;
  /** Create the reveal rail on the current track AND bake it in one action (D-11). */
  createRevealRail: () => Promise<void>;
  /** Close the reveal-creation surface without creating. */
  cancelRevealCreation: () => void;
}

/** The locked empty-source fact copy (UI-SPEC Copywriting Contract). */
export const PHOTO_REFERENCE_EMPTY_SOURCE = 'No source imported';

/** The locked unlock tooltip copy (UI-SPEC Copywriting Contract). */
export const PHOTO_REFERENCE_UNLOCKED_TOOLTIP = 'Unlocked — canvas gestures move the reference';

/* ---- 52-04 (D-16/D-19): the reveal-rail creation flow copy (UI-SPEC Copywriting Contract) ---- */

/** The locked primary CTA copy (UI-SPEC Copywriting Contract). */
export const REVEAL_WITH_SCRIPT_COPY = 'Reveal with script…';

/** The locked empty-source gate copy (UI-SPEC Copywriting Contract). */
export const REVEAL_UNAVAILABLE_NO_REFERENCE_COPY = 'Reveal unavailable — no reference placed. Place a reference to replay.';

/** The locked deleted-script fail-closed copy (UI-SPEC Copywriting Contract). */
export const REVEAL_UNAVAILABLE_SCRIPT_DELETED_COPY = 'Reveal unavailable — script deleted. Re-link a script to replay.';

/** The locked variant labels (D-03/D-26 — mirror the PlayScript Motion/Static duality). */
export const REVEAL_VARIANT_OPTIONS: ReadonlyArray<{ value: RevealRailVariant; label: string; helper: string }> = [
  { value: 'progressive', label: 'Reveal / Motion', helper: 'The reveal extends frame after frame across the span.' },
  { value: 'static', label: 'Reveal / Static', helper: 'Every frame carries the entire revealed photo with per-frame brush variation.' },
];

/** The default rail span (D-20) when the script's natural duration is unknown — mirrors the PlayScript dialog default. */
const DEFAULT_REVEAL_FRAME_COUNT = 3;

/** The default opacity (50%) as a 0..100 display integer (D-12, UI-SPEC). */
const DEFAULT_OPACITY_PERCENT = 50;

export function usePhysicsPaintPhotoReferenceController({
  layerId,
  ports = {},
  revealCreationRequested = false,
}: PhysicsPaintPhotoReferenceControllerProps): PhysicsPaintPhotoReferenceController {
  const getDocument = ports.getDocument ?? defaultPorts.getDocument;
  const setOpacity = ports.setOpacity ?? defaultPorts.setOpacity;
  const setTransformLocked = ports.setTransformLocked ?? defaultPorts.setTransformLocked;
  const setVisible = ports.setVisible ?? defaultPorts.setVisible;
  const clearReference = ports.clearReference ?? defaultPorts.clearReference;
  const resolveFilename = ports.resolveFilename ?? defaultPorts.resolveFilename;
  const getActiveTrackId = ports.getActiveTrackId ?? defaultPorts.getActiveTrackId;
  const getScriptRows = ports.getScriptRows ?? defaultPorts.getScriptRows;
  const createReveal = ports.createReveal ?? defaultPorts.createReveal;
  const getCurrentFrame = ports.getCurrentFrame ?? defaultPorts.getCurrentFrame;
  const getScriptNaturalDuration = ports.getScriptNaturalDuration ?? defaultPorts.getScriptNaturalDuration;

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

  /* ---- 52-04 (D-16/D-19): the reveal-rail creation flow state machine ----
     Signals only (efx-preact-reactivity): the flow's open/script/variant/
     progress/busy/error state lives here; the dialog is a thin render shell.
     Creation IS the first bake (D-11): createRevealRail calls the Plan 01
     create-reveal-rail mutation with the onProgress bar, and the rail lands
     baked. The variant is fixed at creation (D-21); the picker is unfiltered
     (D-26). */
  const revealCreationOpen = useSignal(revealCreationRequested);
  const revealScriptId = useSignal<string | null>(null);
  const revealVariant = useSignal<RevealRailVariant>('progressive');
  // G-52-2c: the span is visible and editable at creation. The start is the
  // playhead frame snapshotted when the surface opens (D-20); the length
  // defaults to the selected script's natural duration and is re-defaulted on
  // each script pick so the user always sees what will bake.
  const revealSpanStart = useSignal(0);
  const revealFrameCount = useSignal(DEFAULT_REVEAL_FRAME_COUNT);
  const revealProgress = useSignal<{ completed: number; total: number } | null>(null);
  const revealBusy = useSignal(false);
  const revealError = useSignal<string | null>(null);
  const revealScriptRows = getScriptRows();

  const openRevealCreation = () => {
    if (revealBusy.value) return;
    revealCreationOpen.value = true;
    revealError.value = null;
    revealProgress.value = null;
    revealSpanStart.value = getCurrentFrame();
    const selected = revealScriptId.value;
    revealFrameCount.value = (selected ? getScriptNaturalDuration(selected) : null) ?? DEFAULT_REVEAL_FRAME_COUNT;
  };

  const selectRevealScript = (scriptId: string) => {
    if (revealBusy.value) return;
    revealScriptId.value = scriptId;
    revealError.value = null;
    revealFrameCount.value = getScriptNaturalDuration(scriptId) ?? DEFAULT_REVEAL_FRAME_COUNT;
  };

  const setRevealVariant = (variant: RevealRailVariant) => {
    if (revealBusy.value) return;
    revealVariant.value = variant;
  };

  const setRevealFrameCount = (frames: number) => {
    if (revealBusy.value) return;
    revealFrameCount.value = frames;
  };

  const createRevealRail = async () => {
    if (revealBusy.value) return;
    const scriptId = revealScriptId.value;
    if (!scriptId) return;
    const trackId = getActiveTrackId(layerId);
    if (!trackId) return;
    const startFrame = revealSpanStart.value;
    const frameCount = revealFrameCount.value;
    if (!Number.isInteger(frameCount) || frameCount < 1) {
      revealError.value = mapRevealRejectionReason('invalid-span');
      return;
    }
    revealBusy.value = true;
    revealError.value = null;
    revealProgress.value = null;
    const result = await createReveal(layerId, {
      trackId,
      scriptId,
      variant: revealVariant.value,
      startFrame,
      frameCount,
      onProgress: (completed, total) => {
        revealProgress.value = { completed, total };
      },
    });
    revealBusy.value = false;
    revealProgress.value = null;
    if (result.ok) {
      revealCreationOpen.value = false;
      revealScriptId.value = null;
    } else {
      revealError.value = mapRevealRejectionReason(result.reason);
    }
  };

  const cancelRevealCreation = () => {
    if (revealBusy.value) return;
    revealCreationOpen.value = false;
    revealScriptId.value = null;
    revealError.value = null;
    revealProgress.value = null;
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
    revealScriptRows,
    revealCreationOpen,
    revealScriptId,
    revealVariant,
    revealSpanStart,
    revealFrameCount,
    revealProgress,
    revealBusy,
    revealError,
    openRevealCreation,
    selectRevealScript,
    setRevealVariant,
    setRevealFrameCount,
    createRevealRail,
    cancelRevealCreation,
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
  getActiveTrackId: () => null,
  getScriptRows: () => [],
  createReveal: () => Promise.resolve({ ok: false, reason: 'no-document' }),
  getCurrentFrame: () => 0,
  getScriptNaturalDuration: () => null,
};

/** 52-04: map a create-reveal-rail rejection to the locked fail-closed copy (D-12/D-13). */
function mapRevealRejectionReason(reason: RevealRailMutationRejectionReason): string {
  switch (reason) {
    case 'no-photo-reference':
      return REVEAL_UNAVAILABLE_NO_REFERENCE_COPY;
    case 'script-not-found':
      return REVEAL_UNAVAILABLE_SCRIPT_DELETED_COPY;
    case 'no-track':
      return 'Reveal unavailable — no target track.';
    case 'script-loader-unavailable':
      return 'Reveal unavailable — script library is not ready.';
    case 'invalid-variant':
      return 'Reveal unavailable — invalid variant.';
    case 'invalid-span':
      return 'Reveal unavailable — invalid span.';
    case 'bake-failed':
      return 'Reveal bake failed. Nothing changed.';
    case 'loop-clip-failed':
      return 'Reveal rail creation failed. Nothing changed.';
    case 'no-document':
      return 'Reveal unavailable — no document.';
  }
}
