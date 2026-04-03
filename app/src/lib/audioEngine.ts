import type {AudioTrack, FadeCurve} from '../types/audio';

/**
 * Web Audio API wrapper for audio decode, playback, volume, and fade scheduling.
 *
 * Key patterns:
 * - AudioContext created lazily on first user gesture (pitfall 1)
 * - New AudioBufferSourceNode per play() call (one-shot, pitfall 2)
 * - Fade automation via GainNode scheduled values
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gains: Map<string, GainNode> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();

  /** Lazy-create AudioContext on first call. Resumes if suspended. */
  ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Decode raw audio data into an AudioBuffer and cache it. */
  async decode(trackId: string, arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.buffers.set(trackId, audioBuffer);
    return audioBuffer;
  }

  /** Get cached AudioBuffer for a track. */
  getBuffer(trackId: string): AudioBuffer | undefined {
    return this.buffers.get(trackId);
  }

  /**
   * Play audio for a track starting at the given offset.
   * Creates a fresh AudioBufferSourceNode (one-shot pattern).
   */
  play(trackId: string, offsetSeconds: number, track: AudioTrack, fps: number, maxDurationSec?: number): void {
    const ctx = this.ensureContext();
    const buffer = this.buffers.get(trackId);
    if (!buffer) return;

    // Stop any existing playback for this track
    this.stop(trackId);

    // Create fresh source (one-shot: each play creates a new node)
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Create gain node for volume and fades
    const gain = ctx.createGain();
    const vol = track.muted ? 0 : track.volume;
    gain.gain.value = vol;

    // Connect: source -> gain -> destination
    source.connect(gain);
    gain.connect(ctx.destination);

    // Apply fade schedule
    this.applyFadeSchedule(gain, track, ctx.currentTime, offsetSeconds, fps);

    // Compute playback duration
    // offsetSeconds already includes inFrame + slipOffset + framesIntoTrack
    // Remaining = trim duration minus how far into the trim range we are
    const inOffsetSec = (track.inFrame + track.slipOffset) / fps;
    const framesIntoTrackSec = offsetSeconds - inOffsetSec;
    const trimDurationSec = (track.outFrame - track.inFrame) / fps;
    let remainingDuration = trimDurationSec - framesIntoTrackSec;

    // Cap to timeline-imposed limit (e.g., sequence shorter than audio)
    if (maxDurationSec !== undefined && maxDurationSec < remainingDuration) {
      remainingDuration = maxDurationSec;
    }

    // Clamp offset to buffer duration to prevent silent playback
    const clampedOffset = Math.min(Math.max(0, offsetSeconds), buffer.duration - 0.001);
    if (remainingDuration > 0 && clampedOffset < buffer.duration) {
      source.start(0, clampedOffset, remainingDuration);
    }

    // Store references for stop/volume control
    this.sources.set(trackId, source);
    this.gains.set(trackId, gain);

    // Auto-cleanup when source finishes
    source.onended = () => {
      this.sources.delete(trackId);
      this.gains.delete(trackId);
      try { source.disconnect(); } catch (_) { /* already disconnected */ }
      try { gain.disconnect(); } catch (_) { /* already disconnected */ }
    };
  }

  /**
   * Schedule audio to start after a delay (for tracks that begin after the playhead).
   * Uses Web Audio API's `when` parameter for sample-accurate timing.
   */
  playDelayed(trackId: string, delaySec: number, offsetSeconds: number, track: AudioTrack, fps: number, maxDurationSec?: number): void {
    const ctx = this.ensureContext();
    const buffer = this.buffers.get(trackId);
    if (!buffer) return;

    this.stop(trackId);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    const vol = track.muted ? 0 : track.volume;
    gain.gain.value = vol;

    source.connect(gain);
    gain.connect(ctx.destination);

    // Apply fade schedule at the scheduled start time
    const scheduledStart = ctx.currentTime + delaySec;
    this.applyFadeSchedule(gain, track, scheduledStart, offsetSeconds, fps);

    const inOffsetSec = (track.inFrame + track.slipOffset) / fps;
    const framesIntoTrackSec = offsetSeconds - inOffsetSec;
    const trimDurationSec = (track.outFrame - track.inFrame) / fps;
    let remainingDuration = trimDurationSec - framesIntoTrackSec;

    if (maxDurationSec !== undefined && maxDurationSec < remainingDuration) {
      remainingDuration = maxDurationSec;
    }

    const clampedOffset = Math.min(Math.max(0, offsetSeconds), buffer.duration - 0.001);
    if (remainingDuration > 0 && clampedOffset < buffer.duration) {
      source.start(scheduledStart, clampedOffset, remainingDuration);
    }

    this.sources.set(trackId, source);
    this.gains.set(trackId, gain);

    source.onended = () => {
      this.sources.delete(trackId);
      this.gains.delete(trackId);
      try { source.disconnect(); } catch (_) { /* already disconnected */ }
      try { gain.disconnect(); } catch (_) { /* already disconnected */ }
    };
  }

  /** Stop playback for a specific track. */
  stop(trackId: string): void {
    const source = this.sources.get(trackId);
    if (source) {
      try {
        source.stop();
      } catch (_) {
        // May already be stopped
      }
      try {
        source.disconnect();
      } catch (_) {
        // May already be disconnected
      }
    }
    const gain = this.gains.get(trackId);
    if (gain) {
      try {
        gain.disconnect();
      } catch (_) {
        // May already be disconnected
      }
    }
    this.sources.delete(trackId);
    this.gains.delete(trackId);
  }

  /** Stop all active audio sources. */
  stopAll(): void {
    for (const trackId of [...this.sources.keys()]) {
      this.stop(trackId);
    }
  }

  /** Update volume for a playing track. */
  setVolume(trackId: string, volume: number): void {
    const gain = this.gains.get(trackId);
    if (gain) {
      gain.gain.value = volume;
    }
  }

  /** Remove a track completely: stop playback and clear cached buffer. */
  removeTrack(trackId: string): void {
    this.stop(trackId);
    this.buffers.delete(trackId);
  }

  /**
   * Apply gain fade schedule for fade-in and fade-out.
   *
   * Uses Web Audio API gain automation:
   * - exponentialRampToValueAtTime for 'exponential' curves
   * - linearRampToValueAtTime for 'linear' curves
   * - linearRamp as fallback for 'logarithmic' curves
   *
   * Note: exponentialRamp cannot target 0, so fade-out targets 0.001 instead.
   */
  private applyFadeSchedule(
    gain: GainNode,
    track: AudioTrack,
    audioStartTime: number,
    sourceOffset: number,
    fps: number,
  ): void {
    const vol = track.muted ? 0 : track.volume;
    if (vol === 0) {
      gain.gain.setValueAtTime(0, audioStartTime);
      return;
    }

    const fadeInSec = track.fadeInFrames / fps;
    const fadeOutSec = track.fadeOutFrames / fps;
    const visibleDuration = (track.outFrame - track.inFrame) / fps;

    // How far into the VISIBLE track portion we are (not the raw buffer position)
    const inOffsetSec = (track.inFrame + track.slipOffset) / fps;
    const visibleOffset = sourceOffset - inOffsetSec;
    const effectiveEnd = audioStartTime + visibleDuration - visibleOffset;

    // Cancel any existing scheduled values
    gain.gain.cancelScheduledValues(audioStartTime);

    const hasFadeIn = fadeInSec > 0 && visibleOffset < fadeInSec;
    const hasFadeOut = fadeOutSec > 0;

    if (!hasFadeIn && !hasFadeOut) {
      gain.gain.setValueAtTime(vol, audioStartTime);
      return;
    }

    // Fade-in
    if (hasFadeIn) {
      const fadeProgress = visibleOffset / fadeInSec;
      const startValue = Math.max(0.001, vol * fadeProgress);
      const fadeInEnd = audioStartTime + (fadeInSec - visibleOffset);

      gain.gain.setValueAtTime(startValue, audioStartTime);
      this.applyRamp(gain, vol, fadeInEnd, track.fadeInCurve);
    } else {
      gain.gain.setValueAtTime(vol, audioStartTime);
    }

    // Fade-out
    if (hasFadeOut) {
      const fadeOutStart = effectiveEnd - fadeOutSec;
      if (fadeOutStart > audioStartTime) {
        gain.gain.setValueAtTime(vol, fadeOutStart);
        this.applyRamp(gain, 0.001, effectiveEnd, track.fadeOutCurve);
      }
    }
  }

  /** Apply a ramp to the gain node using the specified curve type. */
  private applyRamp(gain: GainNode, targetValue: number, endTime: number, curve: FadeCurve): void {
    if (curve === 'exponential') {
      gain.gain.exponentialRampToValueAtTime(targetValue, endTime);
    } else {
      // 'linear' and 'logarithmic' both use linearRamp
      // (true logarithmic would need setValueCurveAtTime with a log-shaped array)
      gain.gain.linearRampToValueAtTime(targetValue, endTime);
    }
  }
}

export const audioEngine = new AudioEngine();
