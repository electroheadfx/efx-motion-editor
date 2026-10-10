import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { DocumentSoundClip, EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  addDocumentSound,
  efxPaintVersion,
  patchDocumentSound,
  removeDocumentSound,
  type DocumentSoundResult,
} from '../../../stores/efxPaintStore';
import {GAIN_DB_MAX, GAIN_DB_MIN, dbToGain, gainToDb} from '../../../lib/audioGain';

/**
 * 52.5-01b — the Document sound modal controller (D-05 single control
 * surface, signals-only per efx-preact-reactivity: NO useState, no render-body
 * signal writes). Follows `physicsPaintPhotoReferenceController`:
 *   - reads ACCEPTED canonical state from the store (no optimistic facts —
 *     UI-SPEC busy rule; the controller never holds its own clip truth),
 *   - holds ONLY transient drafts in signals: the gain release-commit draft,
 *     the two-step Remove arm, the `Reading audio…` busy flag and the decode
 *     error copy,
 *   - every field commit routes through the ONE per-clip store door for the
 *     SELECTED clip (261008-ig1 Task 2: never the list head — D-01/D-02):
 *     commit/settle only, never mid-drag; invalid entries
 *     (gain outside -100..100, fades below 0 or fractional) are never committed
 *     — the prior accepted value stays (E8/E9, T-52.5-12). Gain commits speak
 *     dB -20..+20; stored DocumentSoundClip.gain stays integer -100..+100
 *     (261010-bkv),
 *   - the toggles invert from a LIVE document read at click time so the
 *     reverse click can never re-send a stale captured value (50-UAT fix).
 *
 * Import/Replace INTENTS leave through the view's `onImportRequest(mode)` port
 * (PhysicsPaintStudio opens the shared BackgroundAssetPickerView with kind
 * 'audio' — D-02/D-03). The completed import lands here via
 * `applyImportedSource` (ALWAYS appends a fresh clip and selects it — the
 * list length grows, D-01) or `applyReplacedSource` (swaps the SELECTED
 * clip's source with position/in-out preserved and outFrame clamped to a
 * shorter source — only `Replace…` takes this path). The clip's `enabled`
 * switch is the studio-layer sound (52.5 UAT round 2) — ON by default.
 */

export interface PhysicsPaintAudioControllerPorts {
  /** Document read — the controller never holds its own truth. */
  getDocument: (layerId: string) => EfxPaintDocument | undefined;
  /** Append a fresh clip through the list door (Import — always-add). */
  addSound: (layerId: string, clip: DocumentSoundClip) => DocumentSoundResult;
  /** Patch ONE clip by id (field commits, Replace, toggles). */
  patchSound: (layerId: string, clipId: string, patch: Partial<DocumentSoundClip>) => DocumentSoundResult;
  /** Remove ONE clip by id (Remove). */
  removeSound: (layerId: string, clipId: string) => DocumentSoundResult;
  /** Project fps for import defaults (outFrame = durationSec × fps). */
  getFps: () => number;
  /**
   * Missing-reference probe (261009-ofk): true when the file at `sourcePath`
   * does not resolve on disk (never "not inside the .mce package"). Default
   * false; the Studio wires the real resolver.
   */
  isSoundMissing: (sound: DocumentSoundClip) => boolean;
}

export interface PhysicsPaintAudioControllerProps {
  layerId: string;
  /**
   * The Studio-owned selection (261008-ig1 Task 2): the controller edits
   * THIS clip, never the list head. The body reads `.value` (not `.peek()`)
   * so the modal and Studio subscribe to selection changes — a band deselect
   * updates an open modal without a reveal. Handlers are the only writers
   * (confirmRemove clears it after a committed remove; the Studio sets it on
   * select/reveal) — never a render-body write.
   */
  selectedSoundId: Signal<string | null>;
  /** Injectable ports for tests; production defaults hit the real store. */
  ports?: Partial<PhysicsPaintAudioControllerPorts>;
}

export interface PhysicsPaintAudioController {
  /** The accepted clip list (D-01 — empty = empty state). Narrow store read. */
  audios: readonly DocumentSoundClip[];
  /**
   * The Studio-owned selection signal (261008-ig1 Task 2): the modal list
   * renders it and the controller resolves the edited clip from it.
   */
  selectedSoundId: Signal<string | null>;
  /** The SELECTED clip (null = no selection). Narrow store read, never the head. */
  sound: DocumentSoundClip | null;
  /** Filename fact for the file row (basename of sourcePath). */
  filename: string | null;
  /** Project fps for seconds↔frames In/Out display (261010-bkv). */
  getFps: () => number;
  /** True when the SELECTED clip's file at sourcePath does not resolve on disk. */
  missing: boolean;
  /** Per-row missing probe — the list calls this per clip (261009-ofk). */
  isSoundMissing: (sound: DocumentSoundClip) => boolean;
  /** `Reading audio…` busy flag — disables Import/Replace/Remove/fields. */
  busy: boolean;
  /** Decode-failure state — the view maps it to the contracted error copy. */
  decodeError: boolean;
  /** Gain draft while dragging (null = not dragging) — release-commit. */
  volumeDraft: Signal<number | null>;
  /** The value the slider shows: draft while dragging, else accepted. */
  previewGain: number;
  /** Two-step Remove arm state (`Remove` → `Confirm remove?`). */
  removeArmed: boolean;
  /** Live drag preview for the gain slider in dB (no store write). */
  previewGainInput: (db: number) => void;
  /** Commit the gain on release — integer dB -20..+20; stores integer gain -100..+100. */
  commitGain: (db: number) => void;
  /** Commit Fade in / Fade out frames (integer >= 0). */
  commitFadeIn: (frames: number) => void;
  commitFadeOut: (frames: number) => void;
  /** Commit fade curves (`linear` | `exponential` | `logarithmic`). */
  commitFadeInCurve: (curve: SoundFadeCurve) => void;
  commitFadeOutCurve: (curve: SoundFadeCurve) => void;
  /** Commit the source trim bounds (frames; out > in, 1-frame minimum span). */
  commitInFrame: (frames: number) => void;
  commitOutFrame: (frames: number) => void;
  /** Commit the clip placement (startFrame): integer >= 0, NO upper clamp. */
  commitStartFrame: (frames: number) => void;
  /** Invert the studio-layer sound switch from the LIVE document. */
  toggleEnabled: () => void;
  /** Two-step remove: first call arms, second commits sound: null. */
  requestRemove: () => void;
  confirmRemove: () => void;
  /**
   * 261008-ryq: ONE-SHOT removal for the keyboard paths (Delete/Backspace on
   * the modal-open and modal-closed paths). Visible Remove buttons keep the
   * two-step requestRemove/confirmRemove arm — never a second arm.
   */
  removeSelected: () => void;
  /** Revert the Remove arm ("reverts on any other action"). */
  disarmRemove: () => void;
  /** Busy-flag drivers for the import/decode flow (task 2 wiring). */
  beginReading: () => void;
  endReading: () => void;
  /** Surface the decode-failure copy (E1/E10 error path). */
  reportDecodeError: () => void;
  clearError: () => void;
  /**
   * Commit a completed Import (append mode): builds the FRESH clip defaults
   * and appends it through the list door, then selects the new clip (D-01 —
   * the list length grows). Invalid / absent document leaves the list alone.
   */
  applyImportedSource: (source: ImportedSoundSource) => DocumentSoundResult;
  /**
   * Commit a completed Replace (replace mode): swaps the SELECTED clip's
   * source with position/in-out preserved (outFrame clamped to a shorter
   * source) through the per-clip door. No selection / absent document leaves
   * the prior value untouched.
   */
  applyReplacedSource: (source: ImportedSoundSource) => DocumentSoundResult;
}

export type SoundFadeCurve = 'linear' | 'exponential' | 'logarithmic';

/** A confirmed shared-gallery audio asset, post-import (D-03 seam). */
export interface ImportedSoundSource {
  /** The gallery asset id (PhysicPaintAudioAssetRef.id). */
  sourceId: string;
  /** Absolute on-disk path (261009-ofk disk-reference law). */
  sourcePath: string;
  /** Source revision carried by the asset ref (0 when the ref has none). */
  sourceRevision?: number;
  /** Decoded duration in seconds — outFrame = durationSec × fps. */
  durationSec: number;
}

/* ----------------------------------------------------------------------------
 * Validation (T-52.5-12) — integer ranges; invalid entries never commit.
 * The Copywriting Contract strings live in the view (literal copy in the
 * component that renders it); the controller only carries error KINDS.
 * ------------------------------------------------------------------------- */

export function isValidGain(gain: number): boolean {
  return Number.isInteger(gain) && gain >= -100 && gain <= 100;
}

/**
 * UI dB domain for commitGain: integer dB on the -20..+20 grid. Stored gain
 * stays the -100..+100 integer (dbToGain); invalid dB never commits.
 */
export function isValidGainDb(db: number): boolean {
  return Number.isInteger(db) && db >= GAIN_DB_MIN && db <= GAIN_DB_MAX;
}

export function isValidFadeFrames(frames: number): boolean {
  return Number.isInteger(frames) && frames >= 0;
}

export function isValidFadeCurve(curve: string): curve is SoundFadeCurve {
  return curve === 'linear' || curve === 'exponential' || curve === 'logarithmic';
}

/* ----------------------------------------------------------------------------
 * Import defaults (plan task 1, commit path item 4).
 * ------------------------------------------------------------------------- */

/** Fresh import defaults: position 0, full source span, gain 0, fades 0, enabled ON. */
export function buildFreshSoundClip(source: ImportedSoundSource, fps: number): DocumentSoundClip {
  const sourceFrames = Math.max(1, Math.ceil(source.durationSec * Math.max(1, fps)));
  return {
    id: crypto.randomUUID(),
    sourceId: source.sourceId,
    sourcePath: source.sourcePath,
    sourceRevision: source.sourceRevision ?? 0,
    startFrame: 0,
    inFrame: 0,
    outFrame: sourceFrames,
    gain: 0,
    fadeInFrames: 0,
    fadeOutFrames: 0,
    fadeInCurve: 'linear',
    fadeOutCurve: 'linear',
    enabled: true,
  };
}

/**
 * Replace path: source identity swaps; position and in/out are preserved
 * unless the new source is shorter, then outFrame clamps to the source length
 * (never below a 1-frame span; inFrame follows when the clamp would invert).
 */
export function buildReplacedSoundClip(
  current: DocumentSoundClip,
  source: ImportedSoundSource,
  fps: number,
): DocumentSoundClip {
  const sourceFrames = Math.max(1, Math.ceil(source.durationSec * Math.max(1, fps)));
  let inFrame = current.inFrame;
  let outFrame = Math.min(current.outFrame, sourceFrames);
  if (outFrame <= inFrame) {
    inFrame = Math.max(0, sourceFrames - 1);
    outFrame = sourceFrames;
  }
  return {
    ...current,
    sourceId: source.sourceId,
    sourcePath: source.sourcePath,
    sourceRevision: source.sourceRevision ?? 0,
    inFrame,
    outFrame,
  };
}

/**
 * 261008-ig1 Task 3 (D-03): alt+drag duplication — a FRESH placed-clip id over
 * a SHARED source identity. `id` keys the list/selection/transport; `sourceId`
 * (and `sourcePath`) stay verbatim, so peaks and the gallery stay source-
 * keyed: one decode, one bytes copy, one gallery row, one `audio/` path serve
 * both clips. Every other member is a value copy — the duplicate starts as a
 * clone of geometry + settings (start/in/out, gain, fades, enabled) so the
 * user can slide/trim it elsewhere. The origin object is never mutated.
 */
export function buildDuplicatedSoundClip(clip: DocumentSoundClip): DocumentSoundClip {
  return { ...clip, id: crypto.randomUUID() };
}

/* ----------------------------------------------------------------------------
 * Controller.
 * ------------------------------------------------------------------------- */

/** Frozen empty list constant — identity-stable across renders. */
const EMPTY_AUDIOS: readonly DocumentSoundClip[] = Object.freeze([]);

export function usePhysicsPaintAudioController({
  layerId,
  selectedSoundId,
  ports = {},
}: PhysicsPaintAudioControllerProps): PhysicsPaintAudioController {
  const getDocument = ports.getDocument ?? defaultPorts.getDocument;
  // Narrow read of the store version clock so the modal re-renders on a store
  // write even when its parent is memo-blocked (rd4 Lock/Visible fix class).
  efxPaintVersion.value;
  const addSound = ports.addSound ?? defaultPorts.addSound;
  const patchSound = ports.patchSound ?? defaultPorts.patchSound;
  const removeSound = ports.removeSound ?? defaultPorts.removeSound;
  const getFps = ports.getFps ?? defaultPorts.getFps;
  const isSoundMissing = ports.isSoundMissing ?? defaultPorts.isSoundMissing;

  const document = getDocument(layerId);
  const audios = document?.audios ?? EMPTY_AUDIOS;
  // 261008-ig1 Task 2: the modal edits the SELECTED clip (`.value`, not
  // `.peek()` — the controller subscribes to selection changes). Narrow read.
  const selectedId = selectedSoundId.value;
  const sound = selectedId !== null ? audios.find((clip) => clip.id === selectedId) ?? null : null;

  const filename = sound ? sound.sourcePath.split('/').pop() ?? sound.sourcePath : null;
  const missing = sound !== null && isSoundMissing(sound);

  const volumeDraft = useSignal<number | null>(null);
  // Armed against a STAMPED clip id, not the current selection: the no-backdrop
  // dialog lets a band press re-target selection mid-arm, and confirmRemove has
  // no undo, so a bare boolean would delete the wrong clip.
  const removeArmedClipId = useSignal<string | null>(null);
  const busy = useSignal(false);
  const decodeError = useSignal(false);

  const disarmRemove = () => {
    removeArmedClipId.value = null;
  };

  /**
   * Fail-closed per-clip commit: no document -> no-document, no/unknown
   * selection -> unknown-clip (never the list head — D-01/D-02).
   */
  const commitPatch = (patch: Partial<DocumentSoundClip>): DocumentSoundResult => {
    if (!document) return { ok: false, reason: 'no-document' };
    if (selectedId === null) return { ok: false, reason: 'unknown-clip' };
    if (!audios.some((clip) => clip.id === selectedId)) return { ok: false, reason: 'unknown-clip' };
    return patchSound(layerId, selectedId, patch);
  };

  const previewGainInput = (db: number) => {
    volumeDraft.value = db;
  };

  /** commitGain speaks dB (-20..+20); the store keeps integer gain -100..+100. */
  const commitGain = (db: number) => {
    volumeDraft.value = null;
    disarmRemove();
    if (!isValidGainDb(db)) return; // prior accepted value stays (E8)
    const gain = dbToGain(db);
    if (!isValidGain(gain)) return;
    commitPatch({ gain });
  };

  const commitFadeIn = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return; // prior accepted value stays (E9)
    commitPatch({ fadeInFrames: frames });
  };

  const commitFadeOut = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return;
    commitPatch({ fadeOutFrames: frames });
  };

  const commitFadeInCurve = (curve: SoundFadeCurve) => {
    disarmRemove();
    if (!isValidFadeCurve(curve)) return;
    commitPatch({ fadeInCurve: curve });
  };

  const commitFadeOutCurve = (curve: SoundFadeCurve) => {
    disarmRemove();
    if (!isValidFadeCurve(curve)) return;
    commitPatch({ fadeOutCurve: curve });
  };

  const commitInFrame = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return;
    if (!sound) return;
    // 1-frame minimum span: in may never meet or pass out.
    if (frames >= sound.outFrame) return;
    commitPatch({ inFrame: frames });
  };

  const commitOutFrame = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return;
    if (!sound) return;
    if (frames <= sound.inFrame) return;
    commitPatch({ outFrame: frames });
  };

  const commitStartFrame = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return; // prior accepted value stays (E8/E9)
    if (!sound) return;
    commitPatch({ startFrame: frames });
  };

  const toggleEnabled = () => {
    disarmRemove();
    if (!sound) return;
    commitPatch({ enabled: !sound.enabled });
  };

  const requestRemove = () => {
    // 261008-ryq: gate on the LIVE selection (not the render-time `sound`
    // snapshot — it predates a list-row handler's selection write, so the row
    // can select + arm in one click). Fail-closed semantics unchanged: no
    // selection or an unknown id never arms.
    const liveId = selectedSoundId.value;
    if (liveId === null) return;
    if (!audios.some((clip) => clip.id === liveId)) return;
    removeArmedClipId.value = liveId;
  };

  const confirmRemove = () => {
    const armedId = removeArmedClipId.value;
    removeArmedClipId.value = null;
    // Fail closed unless the arm still points at the live selection. The
    // no-backdrop dialog lets a band press re-target selection mid-arm, and
    // removeSound has no undo.
    const liveSelectedId = selectedSoundId.value;
    if (armedId === null || liveSelectedId === null || armedId !== liveSelectedId) return;
    const result = removeSound(layerId, armedId);
    if (result.ok) selectedSoundId.value = null;
  };

  /** 261008-ryq: the keyboard one-shot — remove the live selection in ONE
   *  step (no arm involved). Visible buttons keep the two-step path. */
  const removeSelected = () => {
    const liveId = selectedSoundId.value;
    if (liveId === null) return;
    if (!audios.some((clip) => clip.id === liveId)) return;
    const result = removeSound(layerId, liveId);
    if (result.ok) {
      selectedSoundId.value = null;
      removeArmedClipId.value = null;
    }
  };

  const beginReading = () => {
    decodeError.value = false;
    busy.value = true;
  };

  const endReading = () => {
    busy.value = false;
  };

  const reportDecodeError = () => {
    busy.value = false;
    decodeError.value = true;
  };

  const clearError = () => {
    decodeError.value = false;
  };

  const applyImportedSource = (source: ImportedSoundSource): DocumentSoundResult => {
    if (!document) return { ok: false, reason: 'no-document' };
    const fps = getFps();
    const next = buildFreshSoundClip(source, fps);
    const result = addSound(layerId, next);
    if (result.ok) {
      selectedSoundId.value = next.id;
      decodeError.value = false;
      removeArmedClipId.value = null;
    }
    return result;
  };

  const applyReplacedSource = (source: ImportedSoundSource): DocumentSoundResult => {
    if (!sound) return document ? { ok: false, reason: 'unknown-clip' } : { ok: false, reason: 'no-document' };
    const replaced = buildReplacedSoundClip(sound, source, getFps());
    const result = commitPatch({
      sourceId: replaced.sourceId,
      sourcePath: replaced.sourcePath,
      sourceRevision: replaced.sourceRevision,
      inFrame: replaced.inFrame,
      outFrame: replaced.outFrame,
    });
    if (result.ok) {
      decodeError.value = false;
      removeArmedClipId.value = null;
    }
    return result;
  };

  return {
    audios,
    selectedSoundId,
    sound,
    filename,
    getFps,
    missing,
    isSoundMissing,
    busy: busy.value,
    decodeError: decodeError.value,
    volumeDraft,
    previewGain: volumeDraft.value ?? gainToDb(sound?.gain ?? 0),
    // Getter, not a captured boolean: the arm must reflect the LIVE selection
    // at read time (a mid-arm selection change disarms the button visually).
    get removeArmed(): boolean {
      const armedId = removeArmedClipId.value;
      return armedId !== null && armedId === selectedSoundId.value;
    },
    previewGainInput,
    commitGain,
    commitFadeIn,
    commitFadeOut,
    commitFadeInCurve,
    commitFadeOutCurve,
    commitInFrame,
    commitOutFrame,
    commitStartFrame,
    toggleEnabled,
    requestRemove,
    confirmRemove,
    removeSelected,
    disarmRemove,
    beginReading,
    endReading,
    reportDecodeError,
    clearError,
    applyImportedSource,
    applyReplacedSource,
  };
}

/** Production ports — the real store (the view injects the wiring ports). */
const defaultPorts: PhysicsPaintAudioControllerPorts = {
  getDocument: () => undefined,
  addSound: (layerId, clip) => addDocumentSound(layerId, clip),
  patchSound: (layerId, clipId, patch) => patchDocumentSound(layerId, clipId, patch),
  removeSound: (layerId, clipId) => removeDocumentSound(layerId, clipId),
  getFps: () => 12,
  isSoundMissing: () => false,
};
