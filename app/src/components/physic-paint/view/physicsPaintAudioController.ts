import { useSignal } from '@preact/signals';
import type { Signal } from '@preact/signals';
import type { DocumentSoundClip, EfxPaintDocument } from '../../../efx-paint/document/efxPaintDocument';
import {
  efxPaintVersion,
  setDocumentSound,
  type DocumentSoundResult,
} from '../../../stores/efxPaintStore';

/**
 * 52.5-01b — the Document sound modal controller (D-05 single control
 * surface, signals-only per efx-preact-reactivity: NO useState, no render-body
 * signal writes). Follows `physicsPaintPhotoReferenceController`:
 *   - reads ACCEPTED canonical state from the store (no optimistic facts —
 *     UI-SPEC busy rule; the controller never holds its own clip truth),
 *   - holds ONLY transient drafts in signals: the volume release-commit draft,
 *     the two-step Remove arm, the `Reading audio…` busy flag and the decode
 *     error copy,
 *   - every field commit routes through the ONE `setDocumentSound` member
 *     setter (SYNC-01): commit/settle only, never mid-drag; invalid entries
 *     (volume outside 0-100, fades below 0 or fractional) are never committed
 *     — the prior accepted value stays (E8/E9, T-52.5-12),
 *   - the toggles invert from a LIVE document read at click time so the
 *     reverse click can never re-send a stale captured value (50-UAT fix).
 *
 * Import/Replace INTENTS leave through the view's `onImportRequest` port
 * (PhysicsPaintStudio opens the shared BackgroundAssetPickerView with kind
 * 'audio' — D-02/D-03, wired in task 2). The completed import lands here via
 * `applyImportedSource`, which builds the clip defaults (fresh: startFrame 0,
 * inFrame 0, outFrame = duration × fps, volume 100, fades 0, both toggles ON;
 * replace: source swap with position/in-out preserved and outFrame clamped to
 * a shorter source) and commits through the same setter. The clip's `enabled`
 * switch is the studio-layer sound (52.5 UAT round 2) — ON by default.
 */

export interface PhysicsPaintAudioControllerPorts {
  /** Document read — the controller never holds its own truth. */
  getDocument: (layerId: string) => EfxPaintDocument | undefined;
  /** The one member setter (D-01/SYNC-01). */
  setSound: (layerId: string, sound: DocumentSoundClip | null) => DocumentSoundResult;
  /** Project fps for import defaults (outFrame = durationSec × fps). */
  getFps: () => number;
  /**
   * Missing-reference probe (CMP-05 fail-closed): true when the clip's
   * `relativePath` no longer resolves inside the .mce package. Default false;
   * the Studio wires the real resolver.
   */
  isSoundMissing: (sound: DocumentSoundClip) => boolean;
}

export interface PhysicsPaintAudioControllerProps {
  layerId: string;
  /** Injectable ports for tests; production defaults hit the real store. */
  ports?: Partial<PhysicsPaintAudioControllerPorts>;
}

export interface PhysicsPaintAudioController {
  /** The accepted clip (null = empty state). Narrow store read. */
  sound: DocumentSoundClip | null;
  /** Filename fact for the file row (basename of relativePath). */
  filename: string | null;
  /** True when a clip exists but its package reference no longer resolves. */
  missing: boolean;
  /** `Reading audio…` busy flag — disables Import/Replace/Remove/fields. */
  busy: boolean;
  /** Decode-failure state — the view maps it to the contracted error copy. */
  decodeError: boolean;
  /** Volume draft while dragging (null = not dragging) — release-commit. */
  volumeDraft: Signal<number | null>;
  /** The value the slider shows: draft while dragging, else accepted. */
  previewVolume: number;
  /** Two-step Remove arm state (`Remove` → `Confirm remove?`). */
  removeArmed: boolean;
  /** Live drag preview for the volume slider (no store write). */
  previewVolumeInput: (percent: number) => void;
  /** Commit the volume on release — integer 0..100 or the prior value stays. */
  commitVolume: (percent: number) => void;
  /** Commit Fade in / Fade out frames (integer >= 0). */
  commitFadeIn: (frames: number) => void;
  commitFadeOut: (frames: number) => void;
  /** Commit fade curves (`linear` | `exponential` | `logarithmic`). */
  commitFadeInCurve: (curve: SoundFadeCurve) => void;
  commitFadeOutCurve: (curve: SoundFadeCurve) => void;
  /** Commit the source trim bounds (frames; out > in, 1-frame minimum span). */
  commitInFrame: (frames: number) => void;
  commitOutFrame: (frames: number) => void;
  /** Invert the studio-layer sound switch from the LIVE document. */
  toggleEnabled: () => void;
  /** Two-step remove: first call arms, second commits sound: null. */
  requestRemove: () => void;
  confirmRemove: () => void;
  /** Revert the Remove arm ("reverts on any other action"). */
  disarmRemove: () => void;
  /** Busy-flag drivers for the import/decode flow (task 2 wiring). */
  beginReading: () => void;
  endReading: () => void;
  /** Surface the decode-failure copy (E1/E10 error path). */
  reportDecodeError: () => void;
  clearError: () => void;
  /**
   * Commit a completed Import/Replace: builds the clip defaults (fresh or
   * replace-with-clamp) and writes through the one setter. Invalid / absent
   * document leaves the prior value untouched.
   */
  applyImportedSource: (source: ImportedSoundSource) => DocumentSoundResult;
}

export type SoundFadeCurve = 'linear' | 'exponential' | 'logarithmic';

/** A confirmed shared-gallery audio asset, post-import (D-03 seam). */
export interface ImportedSoundSource {
  /** The gallery asset id (PhysicPaintAudioAssetRef.id). */
  sourceId: string;
  /** Package-relative `audio/` path (01a reference discipline). */
  relativePath: string;
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

export function isValidVolume(percent: number): boolean {
  return Number.isInteger(percent) && percent >= 0 && percent <= 100;
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

/** Fresh import defaults: position 0, full source span, volume 100, fades 0, enabled ON. */
export function buildFreshSoundClip(source: ImportedSoundSource, fps: number): DocumentSoundClip {
  const sourceFrames = Math.max(1, Math.ceil(source.durationSec * Math.max(1, fps)));
  return {
    id: crypto.randomUUID(),
    sourceId: source.sourceId,
    relativePath: source.relativePath,
    sourceRevision: source.sourceRevision ?? 0,
    startFrame: 0,
    inFrame: 0,
    outFrame: sourceFrames,
    volume: 100,
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
    relativePath: source.relativePath,
    sourceRevision: source.sourceRevision ?? 0,
    inFrame,
    outFrame,
  };
}

/* ----------------------------------------------------------------------------
 * Controller.
 * ------------------------------------------------------------------------- */

export function usePhysicsPaintAudioController({
  layerId,
  ports = {},
}: PhysicsPaintAudioControllerProps): PhysicsPaintAudioController {
  const getDocument = ports.getDocument ?? defaultPorts.getDocument;
  // Narrow read of the store version clock so the modal re-renders on a store
  // write even when its parent is memo-blocked (rd4 Lock/Visible fix class).
  efxPaintVersion.value;
  const setSound = ports.setSound ?? defaultPorts.setSound;
  const getFps = ports.getFps ?? defaultPorts.getFps;
  const isSoundMissing = ports.isSoundMissing ?? defaultPorts.isSoundMissing;

  const document = getDocument(layerId);
  const sound = document?.sound ?? null;

  const filename = sound ? sound.relativePath.split('/').pop() ?? sound.relativePath : null;
  const missing = sound !== null && isSoundMissing(sound);

  const volumeDraft = useSignal<number | null>(null);
  const removeArmed = useSignal(false);
  const busy = useSignal(false);
  const decodeError = useSignal(false);

  const disarmRemove = () => {
    if (removeArmed.value) removeArmed.value = false;
  };

  const patchSound = (patch: Partial<DocumentSoundClip>): DocumentSoundResult => {
    const current = getDocument(layerId)?.sound ?? null;
    if (!current) return { ok: false, reason: 'no-document' };
    return setSound(layerId, { ...current, ...patch });
  };

  const previewVolumeInput = (percent: number) => {
    volumeDraft.value = percent;
  };

  const commitVolume = (percent: number) => {
    volumeDraft.value = null;
    disarmRemove();
    if (!isValidVolume(percent)) return; // prior accepted value stays (E8)
    patchSound({ volume: percent });
  };

  const commitFadeIn = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return; // prior accepted value stays (E9)
    patchSound({ fadeInFrames: frames });
  };

  const commitFadeOut = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return;
    patchSound({ fadeOutFrames: frames });
  };

  const commitFadeInCurve = (curve: SoundFadeCurve) => {
    disarmRemove();
    if (!isValidFadeCurve(curve)) return;
    patchSound({ fadeInCurve: curve });
  };

  const commitFadeOutCurve = (curve: SoundFadeCurve) => {
    disarmRemove();
    if (!isValidFadeCurve(curve)) return;
    patchSound({ fadeOutCurve: curve });
  };

  const commitInFrame = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return;
    const current = getDocument(layerId)?.sound;
    if (!current) return;
    // 1-frame minimum span: in may never meet or pass out.
    if (frames >= current.outFrame) return;
    patchSound({ inFrame: frames });
  };

  const commitOutFrame = (frames: number) => {
    disarmRemove();
    if (!isValidFadeFrames(frames)) return;
    const current = getDocument(layerId)?.sound;
    if (!current) return;
    if (frames <= current.inFrame) return;
    patchSound({ outFrame: frames });
  };

  const toggleEnabled = () => {
    disarmRemove();
    const current = getDocument(layerId)?.sound;
    if (!current) return;
    setSound(layerId, { ...current, enabled: !current.enabled });
  };

  const requestRemove = () => {
    if (!sound) return;
    removeArmed.value = true;
  };

  const confirmRemove = () => {
    removeArmed.value = false;
    if (!sound) return;
    setSound(layerId, null);
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
    const current = getDocument(layerId)?.sound ?? null;
    const fps = getFps();
    const next = current === null
      ? buildFreshSoundClip(source, fps)
      : buildReplacedSoundClip(current, source, fps);
    const result = setSound(layerId, next);
    if (result.ok) {
      decodeError.value = false;
      removeArmed.value = false;
    }
    return result;
  };

  return {
    sound,
    filename,
    missing,
    busy: busy.value,
    decodeError: decodeError.value,
    volumeDraft,
    previewVolume: volumeDraft.value ?? sound?.volume ?? 100,
    removeArmed: removeArmed.value,
    previewVolumeInput,
    commitVolume,
    commitFadeIn,
    commitFadeOut,
    commitFadeInCurve,
    commitFadeOutCurve,
    commitInFrame,
    commitOutFrame,
    toggleEnabled,
    requestRemove,
    confirmRemove,
    disarmRemove,
    beginReading,
    endReading,
    reportDecodeError,
    clearError,
    applyImportedSource,
  };
}

/** Production ports — the real store (the view injects the wiring ports). */
const defaultPorts: PhysicsPaintAudioControllerPorts = {
  getDocument: () => undefined,
  setSound: setDocumentSound,
  getFps: () => 12,
  isSoundMissing: () => false,
};
