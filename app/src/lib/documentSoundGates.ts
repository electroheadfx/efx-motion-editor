import type { AudioTrack } from '../types/audio';
import type { DocumentSoundClip, EfxPaintDocument } from '../efx-paint/document/efxPaintDocument';
import type { Sequence } from '../types/sequence';
import {
  resolveTrackPlayback,
  type EfxPaintTrackPlaybackResolution,
} from '../components/physic-paint/audio/efxPaintAudioPreviewContext';
import { dbToLinear, gainToDb } from './audioGain';

/**
 * 52.5-01a (Q3, D-11/D-14, STUDIO-MIX-01), revised by 52.5 UAT round 2: pure
 * gates and adapters for the Studio document-clip leg (analog:
 * resolveTrackPlayback — every gate this slice adds is a unit-tested pure
 * function, T-52.5-03 mitigation).
 *
 * Gate contract (UAT round 2 — one switch, two legs):
 * - the MAIN-track leg is gated by the SESSION monitoring toggle alone (the
 *   modal never touches the main app's audio),
 * - the document CLIP leg is gated by the clip's `enabled` switch alone (ON =
 *   audible in Studio + main playback + export; OFF = silent everywhere).
 */

/**
 * Effective main-in-preview = the session monitoring toggle. Truth table lives
 * in documentSoundGates.test.ts.
 */
export function studioMainLegEnabled(sessionToggleOn: boolean): boolean {
  return sessionToggleOn;
}

/**
 * The document clip leg rides the clip's own `enabled` switch (52.5 UAT round
 * 2) — never the session monitoring toggle, never the main app's audio state.
 */
export function studioClipLegEnabled(enabled: boolean): boolean {
  return enabled;
}

/**
 * Resolve the registered document clip for a transported clip section —
 * fail-closed: absent document, empty list, or a clipId that names no member
 * of `audios[]` all resolve to null (the clip never dispatches from a
 * mismatched carrier, T-52.5-08). The `clipId` is the PLACED-CLIP id — matched
 * against `clip.id`, never `sourceId` (261008-ig1, D-01 two identities).
 */
export function resolveDocumentSoundClip(
  document: EfxPaintDocument | null,
  section: { clipId: string } | null,
): DocumentSoundClip | null {
  if (!section || !document) return null;
  return document.audios.find((clip) => clip.id === section.clipId) ?? null;
}

/**
 * Map the document sound onto the locked resolveTrackPlayback truth table —
 * the clip is a track whose timeline position is `startFrame`, whose trim is
 * the source in/out, and which carries its own slipOffset (261010-en9 R6,
 * engine sign) and never mutes here (the `enabled` gate is applied by the
 * caller, before resolution).
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
      slipOffset: sound.slipOffset,
      muted: false,
    },
    cursorFrame,
    playbackRangeEnd,
    projectFps,
  );
}

/**
 * Build the AudioTrack-compatible record the engine consumes unchanged: the
 * engine's gain + applyFadeSchedule math applies the clip's gain and fades
 * as-is (D-14). Gain maps -100..+100 through the dB bridge (gain/5 dB) onto
 * true linear amplitude: 0 is unity, -100 is 0.1, +100 is 10 (261010-bkv).
 * `filePath` stays empty — the child never holds a
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
    name: sound.sourcePath,
    filePath: '',
    originalFilename: sound.sourcePath.split('/').pop() ?? sound.sourcePath,
    offsetFrame: sound.startFrame,
    inFrame: sound.inFrame,
    outFrame: sound.outFrame,
    volume: dbToLinear(gainToDb(sound.gain)), // 261010-bkv: gain/5 dB -> true linear amplitude
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
    slipOffset: sound.slipOffset,
    totalFramesInFile: sound.outFrame,
    bpm: null,
    beatOffsetFrames: 0,
    beatMarkers: [],
    showBeatMarkers: false,
  };
}

/**
 * One collected clip: the placed clip, the layer that owns it, the fx sequence
 * that composites that layer, and the clip's GLOBAL timeline start.
 *
 * Frame-space law (52.5-02): `sound.startFrame` is DOCUMENT-LOCAL — the Studio
 * band's `appFrame` cells, bounded by `rotoParentEndExclusive` (the document
 * capacity). A clip's global timeline start is `sequence.inFrame + startFrame`,
 * the same rebasing frameMap applies (`localFrame = globalFrame - seq.inFrame`)
 * and getTimelineOverlaySequenceOutFrame applies to roto ends
 * (`seq.inFrame + rotoEnd`).
 */
export interface DocumentSoundClipEntry {
  readonly layerId: string;
  readonly sound: DocumentSoundClip;
  readonly sequence: Sequence;
  /** Global timeline frame the clip starts at. */
  readonly timelineStartFrame: number;
}

/**
 * Collect every placed document clip across the fx sequences (52.5-02,
 * MAIN-MIX-01, retargeted by 261008-ig1). Membership mirrors frameMap's
 * overlay predicate shape — a physic-paint layer on a non-fx sequence is not an
 * overlay and is never collected — deduped by layer id at the SEQUENCE layer
 * list, then one entry per clip in the layer's `audios[]` (a layer carrying
 * several clips contributes several entries, in list order). Pure: callers
 * inject `efxPaintStore.getDocument` so the same read serves main playback and
 * export.
 *
 * Deliberately NOT filtered by visibility: a hidden fx sequence still yields its
 * entry so `mainPlaybackClipEnabled` can apply the D-13 composite gate (and
 * pin it in a test) rather than the collection silently dropping rows.
 */
export function collectDocumentSoundClips(
  sequences: readonly Sequence[],
  getDocument: (layerId: string) => EfxPaintDocument | null,
): DocumentSoundClipEntry[] {
  const entries: DocumentSoundClipEntry[] = [];
  const seenLayerIds = new Set<string>();
  for (const sequence of sequences) {
    if (sequence.kind !== 'fx') continue;
    for (const layer of sequence.layers) {
      if (layer.type !== 'physic-paint') continue;
      const layerId = layer.source.type === 'physic-paint' ? layer.source.layerId : layer.id;
      if (seenLayerIds.has(layerId)) continue;
      seenLayerIds.add(layerId);
      for (const sound of getDocument(layerId)?.audios ?? []) {
        entries.push({
          layerId,
          sound,
          sequence,
          timelineStartFrame: (sequence.inFrame ?? 0) + sound.startFrame,
        });
      }
    }
  }
  return entries;
}

/**
 * D-13 composite gate (Q5/A1 CONFIRMED): a physic-paint layer contributes to
 * the main editor's output only when its fx sequence is in the composite —
 * visible AND not soloed. Solo is the main editor's global "only base content"
 * switch: `renderGlobalFrame` skips overlay sequences entirely when soloActive
 * (exportRenderer.ts:334-335) and physic-paint layers ride fx sequences
 * (frameMap.ts:60), so solo ON puts the layer OUT of the composite and its clip
 * must be inaudible. `physicsPaintSoloArm.ts` is the separate Studio session arm
 * and plays no part in this gate.
 */
export function layerInComposite(sequenceVisible: boolean, soloActive: boolean): boolean {
  return sequenceVisible && !soloActive;
}

/**
 * The main-editor clip leg (D-12 + D-13, MAIN-MIX-01): the clip dispatches iff
 * it exists, its own `enabled` switch is ON (UAT round 2 — ON = audible in
 * Studio + main playback + export; OFF = silent everywhere), AND its layer is in
 * the composite. Sound follows the composite exactly like the layer's pixels.
 */
export function mainPlaybackClipEnabled(
  sound: DocumentSoundClip | null,
  sequenceVisible: boolean,
  soloActive: boolean,
): boolean {
  return sound !== null && sound.enabled && layerInComposite(sequenceVisible, soloActive);
}

/**
 * Export inclusion (D-12, EXPORT-01): the clip ships iff it exists and its own
 * `enabled` switch is ON. D-11 is proven by construction — the preview-mix
 * toggle is preview-only, so it is not a parameter here and can never gate
 * export (`exportClipEnabled` reads the clip alone).
 */
export function exportClipEnabled(sound: DocumentSoundClip | null): boolean {
  return sound !== null && sound.enabled;
}

/** A clip resolved for export: its place on the global timeline + a path-safe reference. */
export interface DocumentSoundExportClip {
  readonly sound: DocumentSoundClip;
  /** Absolute disk-path reference (the efxasset read boundary judges resolution). */
  readonly filePath: string;
  /** Global timeline start (`sequence.inFrame + sound.startFrame`). */
  readonly timelineStartFrame: number;
}

/**
 * The export mixer's entry list (D-12/D-14, EXPORT-01): main tracks unchanged,
 * plus one `toDocumentSoundAudioTrack` entry per export-enabled clip appended in
 * collection order (one per layer). Returns [] when `includeAudio` is off so a
 * preview-only flag or a stray clip can never reach `renderMixedAudio`'s input.
 *
 * `offsetFrame` is the clip's GLOBAL start — the mixer schedules
 * `startTimeSec = offsetFrame / fps` on the export timeline, so the Studio
 * adapter's document-local value would misplace the clip.
 */
export function buildExportMixEntries(
  includeAudio: boolean,
  tracks: readonly AudioTrack[],
  clipEntries: readonly DocumentSoundExportClip[],
  fps: number,
): AudioTrack[] {
  if (!includeAudio) return [];
  const entries: AudioTrack[] = [...tracks];
  for (const { sound, filePath, timelineStartFrame } of clipEntries) {
    if (!exportClipEnabled(sound)) continue;
    entries.push({
      ...toDocumentSoundAudioTrack(sound, filePath, fps),
      offsetFrame: timelineStartFrame,
      filePath,
    });
  }
  return entries;
}
