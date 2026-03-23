import {signal, batch} from '@preact/signals';
import type {AudioTrack} from '../types/audio';
import {pushAction} from '../lib/history';
import {detectBPM} from '../lib/bpmDetector';
import {computeBeatMarkers} from '../lib/beatMarkerEngine';
import {audioEngine} from '../lib/audioEngine';

const tracks = signal<AudioTrack[]>([]);
const selectedTrackId = signal<string | null>(null);
const beatMarkersVisible = signal(true);
const snapToBeatsEnabled = signal(false);

// markDirty callback pattern (same as sequenceStore)
let _markDirty: (() => void) | null = null;
export function _setAudioMarkDirtyCallback(fn: () => void) {
  _markDirty = fn;
}
function markDirty() {
  _markDirty?.();
}

/** Capture a snapshot of current state for undo/redo closures. */
function snapshot() {
  return {tracks: structuredClone(tracks.peek()), selected: selectedTrackId.peek()};
}

/** Restore a previously captured snapshot. Also marks project dirty. */
function restore(snap: {tracks: AudioTrack[]; selected: string | null}) {
  batch(() => {
    tracks.value = snap.tracks;
    selectedTrackId.value = snap.selected;
  });
  markDirty();
}

export const audioStore = {
  tracks,
  selectedTrackId,

  addTrack(track: AudioTrack): void {
    const before = snapshot();
    tracks.value = [...tracks.value, track];
    selectedTrackId.value = track.id;
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Add audio track "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  removeTrack(trackId: string): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return;
    const before = snapshot();
    tracks.value = tracks.value.filter(t => t.id !== trackId);
    if (selectedTrackId.value === trackId) {
      selectedTrackId.value = null;
    }
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Remove audio track "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  updateTrack(trackId: string, updates: Partial<AudioTrack>): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return;
    const before = snapshot();
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, ...updates} : t,
    );
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Update audio track "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  selectTrack(trackId: string | null): void {
    selectedTrackId.value = trackId;
  },

  setVolume(trackId: string, volume: number): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return;
    const before = snapshot();
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, volume} : t,
    );
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Set volume on "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  setMuted(trackId: string, muted: boolean): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return;
    const before = snapshot();
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, muted} : t,
    );
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Toggle mute on "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  setOffset(trackId: string, offsetFrame: number): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return;
    const before = snapshot();
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, offsetFrame} : t,
    );
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Move audio track "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  setInOut(trackId: string, inFrame: number, outFrame: number): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return;
    const before = snapshot();
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, inFrame, outFrame} : t,
    );
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Trim audio track "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  setFades(trackId: string, fadeInFrames: number, fadeOutFrames: number): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return;
    const before = snapshot();
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, fadeInFrames, fadeOutFrames} : t,
    );
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Set fades on "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  reorderTracks(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return;
    const arr = [...tracks.value];
    if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) return;
    const before = snapshot();
    const [moved] = arr.splice(fromIndex, 1);
    arr.splice(toIndex, 0, moved);
    // Update order fields to match new positions
    tracks.value = arr.map((t, i) => ({...t, order: i}));
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: 'Reorder audio tracks',
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  setTrackHeight(trackId: string, height: number): void {
    const clamped = Math.max(28, Math.min(120, height));
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, trackHeight: clamped} : t,
    );
    // No undo for continuous resize; no markDirty needed for transient UI state
  },

  setSlipOffset(trackId: string, slipOffset: number): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track) return;
    const before = snapshot();
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, slipOffset} : t,
    );
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Slip audio in "${track.name}"`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Update track fields without pushing undo (for batch ops like auto-arrange). */
  updateTrackSilent(trackId: string, updates: Partial<AudioTrack>): void {
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {...t, ...updates} : t,
    );
    markDirty();
  },

  /** Auto-detect BPM from audio buffer and set markers on track.
   *  totalFramesCount must be passed to avoid circular dep (audioStore -> frameMap -> audioStore). */
  async detectAndSetBPM(trackId: string, fps: number, totalFramesCount?: number): Promise<void> {
    const buffer = audioEngine.getBuffer(trackId);
    if (!buffer) return;
    const channelData = buffer.getChannelData(0);
    const result = detectBPM(channelData, buffer.sampleRate);
    const total = totalFramesCount ?? Math.ceil(buffer.duration * fps);
    const markers = computeBeatMarkers(result.bpm, 0, fps, total);
    const before = snapshot();
    tracks.value = tracks.value.map(t =>
      t.id === trackId ? {
        ...t,
        bpm: result.bpm,
        beatOffsetFrames: 0,
        beatMarkers: markers,
        showBeatMarkers: true,
      } : t,
    );
    markDirty();
    const after = snapshot();
    pushAction({
      id: crypto.randomUUID(),
      description: `Detect BPM (${result.bpm})`,
      timestamp: Date.now(),
      undo: () => restore(before),
      redo: () => restore(after),
    });
  },

  /** Recalculate beat markers when BPM or offset changes.
   *  totalFramesCount must be passed to avoid circular dep (audioStore -> frameMap -> audioStore). */
  recalculateBeatMarkers(trackId: string, fps: number, totalFramesCount?: number): void {
    const track = tracks.value.find(t => t.id === trackId);
    if (!track || track.bpm == null) return;
    const total = totalFramesCount ?? Math.ceil(track.duration * fps);
    const markers = computeBeatMarkers(track.bpm, track.beatOffsetFrames, fps, total);
    this.updateTrackSilent(trackId, {beatMarkers: markers});
  },

  beatMarkersVisible,
  snapToBeatsEnabled,

  toggleBeatMarkers(): void {
    beatMarkersVisible.value = !beatMarkersVisible.value;
  },

  toggleSnapToBeats(): void {
    snapToBeatsEnabled.value = !snapToBeatsEnabled.value;
  },

  reset(): void {
    batch(() => {
      tracks.value = [];
      selectedTrackId.value = null;
    });
  },

  getTrack(trackId: string): AudioTrack | undefined {
    return tracks.value.find(t => t.id === trackId);
  },
};
