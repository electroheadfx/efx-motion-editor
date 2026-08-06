import {computed} from '@preact/signals';
import {sequenceStore} from '../stores/sequenceStore';
import {audioStore} from '../stores/audioStore';
import {physicPaintStore, physicPaintVersion} from '../stores/physicPaintStore';
import {audioPeaksCache, peaksCacheRevision} from './audioPeaksCache';
import type {FrameEntry, TrackLayout, FxTrackLayout, AudioTrackLayout, KeyPhotoRange, TimelineLoopCapsule} from '../types/timeline';
import type {GlTransition, Sequence} from '../types/sequence';
import type {Layer, LayerType, EasingType} from '../types/layer';
import {derivePhysicPaintRotoLoopRanges} from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';
import type {PhysicPaintRotoLoopResolutionContext} from '../components/physic-paint/roto/physicsPaintRotoPhysicalResolver';

/** Flattened frame array: every frame maps to a sequence, key photo, and image (GLOBAL).
 *  Cross dissolve does NOT shorten the timeline — both sequences keep all their frames.
 *  The overlap is handled visually in Preview via crossDissolveOverlaps. */
export const frameMap = computed<FrameEntry[]>(() => {
  void physicPaintVersion.value;
  const entries: FrameEntry[] = [];
  let globalFrame = 0;
  const sequences = sequenceStore.sequences.value;
  const contentSeqs = sequences.filter(s => s.kind === 'content');

  for (const seq of contentSeqs) {
    for (const kp of seq.keyPhotos) {
      for (let f = 0; f < kp.holdFrames; f++) {
        entries.push({
          globalFrame,
          sequenceId: seq.id,
          keyPhotoId: kp.id,
          imageId: kp.imageId,
          localFrame: f,
          ...(kp.solidColor ? { solidColor: kp.solidColor } : {}),
          ...(kp.isTransparent ? { isTransparent: true } : {}),
          ...(kp.gradient ? { gradient: kp.gradient } : {}),
        });
        globalFrame++;
      }
    }
  }

  const targetLength = getTimelineRequiredFrameCount(sequences, entries.length);
  const tailEntry = entries[entries.length - 1];
  while (tailEntry && entries.length < targetLength) {
    entries.push({ ...tailEntry, globalFrame: entries.length });
  }
  return entries;
});

/** Total number of frames across all sequences */
export const totalFrames = computed(() =>
  getTimelineRequiredFrameCount(sequenceStore.sequences.value, frameMap.value.length),
);

/** Frame entries for only the active sequence (used by preview renderer) */
export const activeSequenceFrames = computed<FrameEntry[]>(() => {
  const activeId = sequenceStore.activeSequenceId.value;
  if (!activeId) return [];
  return frameMap.value.filter((e) => e.sequenceId === activeId);
});

/** Global start frame of the active sequence (for converting global ↔ local) */
export const activeSequenceStartFrame = computed<number>(() => {
  const activeId = sequenceStore.activeSequenceId.value;
  if (!activeId) return 0;
  const tracks = trackLayouts.value;
  const track = tracks.find((t) => t.sequenceId === activeId);
  return track?.startFrame ?? 0;
});

/** Track layout data for timeline rendering (one track per content sequence).
 *  Simple sequential layout — cross dissolve does not alter positions. */
export const trackLayouts = computed<TrackLayout[]>(() => {
  const tracks: TrackLayout[] = [];
  let globalFrame = 0;
  const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');

  for (const seq of contentSeqs) {
    const startFrame = globalFrame;
    const ranges: KeyPhotoRange[] = [];
    for (const kp of seq.keyPhotos) {
      const kpStartFrame = globalFrame;
      globalFrame += kp.holdFrames;
      ranges.push({
        keyPhotoId: kp.id,
        imageId: kp.imageId,
        startFrame: kpStartFrame,
        endFrame: globalFrame,
        holdFrames: kp.holdFrames,
        ...(kp.solidColor ? { solidColor: kp.solidColor } : {}),
        ...(kp.isTransparent ? { isTransparent: true } : {}),
        ...(kp.gradient ? { gradient: kp.gradient } : {}),
      });
    }
    tracks.push({
      sequenceId: seq.id,
      sequenceName: seq.name,
      startFrame,
      endFrame: globalFrame,
      keyPhotoRanges: ranges,
      fadeIn: seq.fadeIn ? { duration: seq.fadeIn.duration } : undefined,
      fadeOut: seq.fadeOut ? { duration: seq.fadeOut.duration } : undefined,
      crossDissolve: seq.crossDissolve ? { duration: seq.crossDissolve.duration } : undefined,
      glTransition: seq.glTransition,
    });
  }
  return tracks;
});

/** Color palette for FX track range bars, keyed by layer type */
const FX_TRACK_COLORS: Record<string, string> = {
  'generator-grain': '#A0522D',
  'generator-particles': '#6A5ACD',
  'generator-lines': '#20B2AA',
  'generator-dots': '#DA70D6',
  'generator-vignette': '#708090',
  'adjustment-color-grade': '#CD853F',
  'generator-glsl': '#8B5CF6',
  'adjustment-glsl': '#8B5CF6',
  'paint': '#E91E63',
};
const FX_DEFAULT_COLOR = '#888888';

function getLayerId(layer: Layer): string {
  return layer.source.type === 'physic-paint' ? layer.source.layerId : layer.id;
}

/** Main-editor parent end for a physic-paint layer (43-03 flag seam): the
 *  FX sequence's AUTHORED span in layer-local frames — D-25 dynamic parent-end
 *  tracking. Deliberately NOT the roto-extended outFrame (that would make the
 *  loop's effective end circularly depend on itself). */
function getPhysicPaintAuthoredSpanFrames(seq: Sequence): number {
  const start = seq.inFrame ?? 0;
  const end = seq.outFrame ?? 100; // same fallback as getTimelineOverlaySequenceOutFrame
  return Math.max(0, end - start);
}

/** The 43-02 interval derivation read through the store with the main-editor
 *  parent end (D-25). Returns null when the layer has no Loop Clips — the
 *  caller then keeps pre-43 behavior exactly. */
function deriveMainEditorLoopRanges(layer: Layer, seq: Sequence): PhysicPaintRotoLoopResolutionContext | null {
  const layerId = getLayerId(layer);
  const loopClips = physicPaintStore.getRotoPhysicalLoopClips(layerId);
  if (loopClips.length === 0) return null;
  const records = physicPaintStore.getRotoRealKeyRecords(layerId);
  return derivePhysicPaintRotoLoopRanges({
    identities: records.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
    loopClips,
    parentEndExclusive: getPhysicPaintAuthoredSpanFrames(seq),
    capacity: physicPaintStore.getRotoPhysicalCapacity(layerId),
  });
}

/** Loop-aware display end frame on the main editor: max(last real key + 1,
 *  max loop effective end) with the sequence-authored parent end (D-25).
 *  Falls back to the store's capacity-bounded read when no loops exist. */
function getPhysicPaintRotoDisplayEndFrame(layer: Layer, seq: Sequence): number | null {
  const loopContext = deriveMainEditorLoopRanges(layer, seq);
  if (!loopContext) return physicPaintStore.getRotoPhysicalEndFrame(getLayerId(layer));
  const records = physicPaintStore.getRotoRealKeyRecords(getLayerId(layer));
  const lastRealEnd = records.length === 0 ? null : records[records.length - 1].appFrame + 1;
  let loopEnd: number | null = null;
  for (const range of loopContext.ranges) {
    loopEnd = loopEnd === null ? range.effectiveEnd : Math.max(loopEnd, range.effectiveEnd);
  }
  if (lastRealEnd === null && loopEnd === null) return null;
  return Math.max(lastRealEnd ?? 0, loopEnd ?? 0);
}

/** ONE compact capsule model per Loop Clip (D-32) — the resolver-derived
 *  interval plus per-first-cycle-cell real-key-backed classification and
 *  source payload dataUrls for ThumbnailCache drawing (D-15). */
function buildTimelineLoopCapsules(layer: Layer, seq: Sequence): TimelineLoopCapsule[] | undefined {
  const context = deriveMainEditorLoopRanges(layer, seq);
  if (!context) return undefined;
  const layerId = getLayerId(layer);
  const records = physicPaintStore.getRotoRealKeyRecords(layerId);
  const recordByKeyId = new Map(records.map((record) => [record.keyId, record]));
  const keyIdAtFrame = new Map(records.map((record) => [record.appFrame, record.keyId]));
  const clipById = new Map(physicPaintStore.getRotoPhysicalLoopClips(layerId).map((clip) => [clip.loopId, clip]));
  return context.ranges.map((range) => ({
    loopId: range.loopId,
    placementStart: range.placementStart,
    cycleLength: range.cycleLength,
    repeat: range.repeat,
    requestedEnd: range.requestedEnd,
    effectiveEnd: range.effectiveEnd,
    truncated: range.truncated,
    partialCycle: range.partialCycle,
    boundaryKind: range.boundary.kind,
    boundaryFrame: range.boundary.frame,
    mode: clipById.get(range.loopId)?.mode ?? 'progressive',
    unresolved: range.unresolved,
    firstCycleCells: range.sourceKeyIds.map((sourceKeyId, index) => {
      const record = recordByKeyId.get(sourceKeyId);
      return {
        sourceKeyId,
        sourceAppFrame: record?.appFrame ?? null,
        dataUrl: record?.payload.dataUrl ?? null,
        // Real-key-backed iff THIS source key is the real key living at this
        // presentation frame (original loop); a duplicated loop's placement
        // frames hold no source keys, so its first-cycle cells stay linked (D-15).
        realKeyBacked: keyIdAtFrame.get(range.placementStart + index) === sourceKeyId,
      };
    }),
  }));
}

function getTimelineRequiredFrameCount(sequences: readonly Sequence[], contentFrameCount: number): number {
  let required = contentFrameCount;
  for (const seq of sequences) {
    if (seq.visible === false) continue;
    const seqStart = seq.kind === 'content' ? 0 : seq.inFrame ?? 0;
    const seqEnd = seq.kind === 'content' ? contentFrameCount : seq.outFrame ?? contentFrameCount;
    required = Math.max(required, seqEnd);
    for (const layer of seq.layers) {
      if (layer.type !== 'physic-paint') continue;
      const rotoEnd = getPhysicPaintRotoDisplayEndFrame(layer, seq);
      if (rotoEnd !== null) required = Math.max(required, seqStart + rotoEnd);
    }
  }
  return required;
}

export function getTimelineOverlaySequenceOutFrame(seq: Sequence, fallbackOutFrame: number): number {
  let outFrame = seq.outFrame ?? fallbackOutFrame;
  const startFrame = seq.inFrame ?? 0;
  for (const layer of seq.layers) {
    if (layer.type !== 'physic-paint') continue;
    const rotoEnd = getPhysicPaintRotoDisplayEndFrame(layer, seq);
    if (rotoEnd !== null) outFrame = Math.max(outFrame, startFrame + rotoEnd);
  }
  return outFrame;
}

function fxColorForLayerType(type: LayerType): string {
  return FX_TRACK_COLORS[type] ?? FX_DEFAULT_COLOR;
}

/** Extract a thumbnail image ID from a content layer (for content-overlay range bar icons) */
function getThumbnailImageId(layer: Layer | undefined): string | undefined {
  if (!layer) return undefined;
  if (layer.source.type === 'static-image') return (layer.source as { imageId: string }).imageId;
  if (layer.source.type === 'image-sequence') {
    const ids = (layer.source as { imageIds: string[] }).imageIds;
    return ids.length > 0 ? ids[0] : undefined;
  }
  return undefined; // video has no thumbnail imageId
}

/** FX track layout data for timeline rendering (one track per FX or content-overlay sequence) */
export const fxTrackLayouts = computed<FxTrackLayout[]>(() => {
  physicPaintVersion.value;
  const layouts: FxTrackLayout[] = [];
  let physicPaintOrdinal = 0;
  for (const seq of sequenceStore.sequences.value) {
    if (seq.kind === 'content') continue; // content sequences render via trackLayouts
    const primaryLayer = seq.layers[0];
    let color: string;
    if (seq.kind === 'content-overlay') {
      color = primaryLayer?.type === 'static-image' ? 'var(--sidebar-dot-green)'
            : primaryLayer?.type === 'image-sequence' ? 'var(--sidebar-dot-blue)'
            : '#8B5CF6'; // video - purple
    } else {
      color = primaryLayer ? fxColorForLayerType(primaryLayer.type) : FX_DEFAULT_COLOR;
    }
    layouts.push({
      sequenceId: seq.id,
      sequenceName: seq.name,
      headerLabel: primaryLayer?.type === 'physic-paint' ? `PPaint #${++physicPaintOrdinal}` : seq.name,
      kind: seq.kind as 'fx' | 'content-overlay',
      inFrame: seq.inFrame ?? 0,
      outFrame: getTimelineOverlaySequenceOutFrame(seq, 100),
      color,
      visible: seq.visible !== false,
      thumbnailImageId: seq.kind === 'content-overlay' ? getThumbnailImageId(primaryLayer) : undefined,
      layerType: primaryLayer?.type,
      rotoKeyFrames: primaryLayer?.type === 'physic-paint'
        ? physicPaintStore.getRotoRealKeyRecords(getLayerId(primaryLayer)).map((record) => record.appFrame)
        : undefined,
      loopCapsules: primaryLayer?.type === 'physic-paint'
        ? buildTimelineLoopCapsules(primaryLayer, seq)
        : undefined,
      fadeIn: seq.fadeIn ? { duration: seq.fadeIn.duration } : undefined,
      fadeOut: seq.fadeOut ? { duration: seq.fadeOut.duration } : undefined,
    });
  }
  return layouts;
});

/** Audio track layout data for timeline rendering (one row per audio track) */
export const audioTrackLayouts = computed<AudioTrackLayout[]>(() => {
  // Read revision signal to re-evaluate when peaks are added/updated asynchronously
  peaksCacheRevision.value;
  const tracks = audioStore.tracks.value;
  const selectedId = audioStore.selectedTrackId.value;
  return tracks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(track => ({
      trackId: track.id,
      trackName: track.name,
      offsetFrame: track.offsetFrame,
      inFrame: track.inFrame,
      outFrame: track.outFrame,
      muted: track.muted,
      volume: track.volume,
      peaks: audioPeaksCache.get(track.id) ?? { tier1: new Float32Array(0), tier2: new Float32Array(0), tier3: new Float32Array(0) },
      trackHeight: track.trackHeight,
      fadeInFrames: track.fadeInFrames,
      fadeOutFrames: track.fadeOutFrames,
      fadeInCurve: track.fadeInCurve,
      fadeOutCurve: track.fadeOutCurve,
      slipOffset: track.slipOffset,
      totalAudioFrames: track.totalFramesInFile || track.outFrame,
      selected: track.id === selectedId,
      beatMarkers: track.beatMarkers,
      showBeatMarkers: track.showBeatMarkers,
      bpm: track.bpm,
    }));
});

/** Describes a cross dissolve overlap zone in shortened-timeline coordinates */
export interface CrossDissolveOverlap {
  outgoingSequenceId: string;  // sequence that's fading out
  incomingSequenceId: string;  // sequence that's fading in
  overlapStart: number;        // global frame where overlap begins (shortened timeline)
  overlapEnd: number;          // global frame where overlap ends (exclusive, shortened timeline)
  duration: number;            // frames of overlap
  curve: EasingType;           // from the crossDissolve transition
  // Local frame offsets for rendering each sequence's content during overlap
  outgoingLocalFrameStart: number;  // local frame in outgoing seq where overlap starts
  incomingLocalFrameStart: number;  // always 0 — incoming seq starts from its first frame
  /** If this overlap is a GL shader transition instead of cross-dissolve */
  glTransition?: GlTransition;
}

/** Cross dissolve overlap zones in global frame coordinates for dual-render in Preview.
 *  The overlap zone spans halfDuration frames at end of seq1 + ceil(D/2) frames at start of seq2. */
export const crossDissolveOverlaps = computed<CrossDissolveOverlap[]>(() => {
  const contentSeqs = sequenceStore.sequences.value.filter(s => s.kind === 'content');
  const overlaps: CrossDissolveOverlap[] = [];
  const tracks = trackLayouts.value;

  for (let i = 0; i < contentSeqs.length - 1; i++) {
    const outSeq = contentSeqs[i];
    // Support both crossDissolve and glTransition (mutually exclusive per D-02)
    const cd = outSeq.crossDissolve;
    const glt = outSeq.glTransition;
    if (!cd && !glt) continue;

    const duration = cd ? cd.duration : glt!.duration;
    const curve = cd ? cd.curve : glt!.curve;
    const halfDuration = Math.floor(duration / 2);
    const outTrack = tracks.find(t => t.sequenceId === outSeq.id);
    if (!outTrack) continue;

    // Overlap centered on the boundary between outgoing and incoming
    const boundary = outTrack.endFrame;
    const overlapStart = boundary - halfDuration;
    const overlapEnd = boundary + (duration - halfDuration);

    // Local frame offsets for rendering
    const outSeqTotalFrames = outSeq.keyPhotos.reduce((sum, kp) => sum + kp.holdFrames, 0);
    const outgoingLocalFrameStart = outSeqTotalFrames - halfDuration;

    overlaps.push({
      outgoingSequenceId: outSeq.id,
      incomingSequenceId: contentSeqs[i + 1].id,
      overlapStart,
      overlapEnd,
      duration,
      curve,
      outgoingLocalFrameStart,
      incomingLocalFrameStart: 0,
      ...(glt ? { glTransition: glt } : {}),
    });
  }

  return overlaps;
});
