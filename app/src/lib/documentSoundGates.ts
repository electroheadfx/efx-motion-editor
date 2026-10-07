import type { AudioTrack } from '../types/audio';
import type { DocumentSoundClip, EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import {
  resolveTrackPlayback,
  type EfxPaintTrackPlaybackResolution,
} from '../components/physic-paint/audio/efxPaintAudioPreviewContext';

/**
 * 52.5-01a (Q3, D-11/D-14, STUDIO-MIX-01): pure gates and adapters for the
 * Studio document-clip leg (analog: resolveTrackPlayback — every gate this
 * slice adds is a unit-tested pure function, T-52.5-03 mitigation).
 *
 * Q3 / mix-don't-contend contract:
 * - the MAIN-track leg is gated by the session toggle AND the modal
 *   "Preview main app too" toggle (AND composition),
 * - the document CLIP leg is gated by NEITHER toggle — it mixes.
 */

/**
 * Q3 (STUDIO-MIX-01): effective main-in-preview = session toggle AND modal
 * preview-main toggle. Truth table lives in documentSoundGates.test.ts.
 */
export function studioMainLegEnabled(previewMainApp: boolean, sessionToggleOn: boolean): boolean {
  return previewMainApp && sessionToggleOn;
}

/**
 * Q3: the document clip leg is a constant OPEN gate — neither the session
 * toggle nor the modal preview-main toggle ever silences the clip (documented
 * constant, asserted by the truth-table row in documentSoundGates.test.ts).
 */
export function studioClipLegEnabled(): boolean {
  return true;
}

/**
 * Resolve the registered document sound for a transported clip section —
 * fail-closed: absent document, absent sound, or a clipId that does not name
 * the registered sound all resolve to null (the clip never dispatches from a
 * mismatched carrier, T-52.5-08).
 */
export function resolveDocumentSoundClip(
  document: EfxPaintDocument | null,
  section: { clipId: string } | null,
): DocumentSoundClip | null {
  if (!section) return null;
  const sound = document?.sound ?? null;
  if (!sound || sound.id !== section.clipId) return null;
  return sound;
}

/**
 * Map the document sound onto the locked resolveTrackPlayback truth table —
 * the clip is a track whose timeline position is `startFrame`, whose trim is
 * the source in/out, and which never slips (slipOffset 0) and never mutes
 * here (the clip leg is ungated; soundInOutput is a main-editor/export gate).
 */
export function resolveClipPlayback(
  sound: DocumentSoundClip,
  cursorFrame: number,
  playbackRangeEnd: number,
  projectFps: number,
): EfxPaintTrackPlaybackResolution {
  return resolveTrackPlayback(
    {
      offsetFrame: sound.startFrame,
      inFrame: sound.inFrame,
      outFrame: sound.outFrame,
      slipOffset: 0,
      muted: false,
    },
    cursorFrame,
    playbackRangeEnd,
    projectFps,
  );
}

/**
 * Build the AudioTrack-compatible record the engine consumes unchanged: the
 * engine's gain + applyFadeSchedule math applies the clip's volume and fades
 * as-is (D-14). Volume scales the document's integer percent (0-100) to the
 * engine's linear 0-1 range. `filePath` stays empty — the child never holds a
 * filesystem path for the clip (D-04/52.2 references-only discipline); the
 * decoded buffer is keyed by `sound.id` from the closed documentAudio section.
 */
export function toDocumentSoundAudioTrack(
  sound: DocumentSoundClip,
  assetUrl: string,
  fps: number,
): AudioTrack {
  void assetUrl; // the buffer was decoded from this URL; the engine reads it by id only
  return {
    id: sound.id,
    audioAssetId: sound.sourceId,
    name: sound.relativePath,
    filePath: '',
    relativePath: sound.relativePath,
    originalFilename: sound.relativePath.split('/').pop() ?? sound.relativePath,
    offsetFrame: sound.startFrame,
    inFrame: sound.inFrame,
    outFrame: sound.outFrame,
    volume: sound.volume / 100, // D-14: integer percent 0-100 -> linear 0-1
    muted: false,
    fadeInFrames: sound.fadeInFrames,
    fadeOutFrames: sound.fadeOutFrames,
    fadeInCurve: sound.fadeInCurve,
    fadeOutCurve: sound.fadeOutCurve,
    sampleRate: 0,
    duration: Math.max(0, (sound.outFrame - sound.inFrame) / Math.max(1, fps)),
    channelCount: 0,
    order: 0,
    trackHeight: 44,
    slipOffset: 0,
    totalFramesInFile: sound.outFrame,
    bpm: null,
    beatOffsetFrames: 0,
    beatMarkers: [],
    showBeatMarkers: false,
  };
}
