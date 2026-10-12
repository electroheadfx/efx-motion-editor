import type {AudioTrack, FadeCurve} from '../types/audio';
import {signal} from '@preact/signals';
import { FADE_OUT_FLOOR, sampleFadeCurve } from './fadeCurves';

/**
 * 261012-exn (SND-01) visible decode-diagnostic channel — mirrors
 * imageStore.importErrors' pattern: a plain string list rendered by the
 * timeline's error strip. Idempotent appends; cleared by audioStore.reset()
 * on project close so stale playback refusals never survive the project.
 */
export const audioDecodeErrors = signal<string[]>([]);

/** Record a named decode/playback refusal (deduped — repeated presses do not grow the list). */
export function addAudioDecodeError(message: string): void {
  if (audioDecodeErrors.value.includes(message)) return;
  audioDecodeErrors.value = [...audioDecodeErrors.value, message];
}

/** Clear the refusal list (project close / explicit reset). */
export function clearAudioDecodeErrors(): void {
  audioDecodeErrors.value = [];
}

/** Named refusal message — the track/clip name must appear verbatim. */
function refusalMessage(track: AudioTrack, reason: string): string {
  return `Audio "${track.name}" not played: ${reason}.`;
}

/**
 * Web Audio API wrapper for audio decode, playback, volume, and fade scheduling.
 *
 * Key patterns:
 * - AudioContext created lazily on first user gesture (pitfall 1)
 * - New AudioBufferSourceNode per play() call (one-shot, pitfall 2)
 * - Fade automation via GainNode scheduled values
 *
 * 261012-exn (SND-01) decode-readiness contract: play() and playDelayed()
 * await an in-flight decode (pendingDecodes registry) before starting, record
 * a named refusal through audioDecodeErrors on any failure, and NEVER reject
 * their returned promise — fire-and-forget at every playback call site is
 * therefore safe, and playbackEngine plus the Studio audio monitor inherit
 * one identical behavior with zero per-realm forks.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private sources: Map<string, AudioBufferSourceNode> = new Map();
  private gains: Map<string, GainNode> = new Map();
  private buffers: Map<string, AudioBuffer> = new Map();
  /** In-flight decode promises keyed by trackId — the seam play/playDelayed await (261012-exn). */
  private pendingDecodes: Map<string, Promise<AudioBuffer>> = new Map();

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
    // Register the WHOLE chained promise (cache-set included) so a play()
    // racing this decode awaits the buffer, not just the raw decodeAudioData.
    const pending = ctx.decodeAudioData(arrayBuffer).then(audioBuffer => {
      this.buffers.set(trackId, audioBuffer);
      return audioBuffer;
    });
    this.pendingDecodes.set(trackId, pending);
    try {
      return await pending;
    } finally {
      // Compare-before-delete: an older decode settling late must never
      // evict a newer in-flight decode for the same id.
      if (this.pendingDecodes.get(trackId) === pending) {
        this.pendingDecodes.delete(trackId);
      }
    }
  }

  /** Get cached AudioBuffer for a track. */
  getBuffer(trackId: string): AudioBuffer | undefined {
    return this.buffers.get(trackId);
  }

  /**
   * Buffer resolution shared by BOTH play methods (261012-exn SND-01): a
   * synchronous cache hit returns immediately; on a miss it awaits the
   * in-flight decode (pendingDecodes), re-checks the cache, and on any
   * failure — absent, rejected, or settled without a buffer — records a
   * named refusal and returns null. Never throws.
   */
  private async resolveBufferForPlay(trackId: string, track: AudioTrack): Promise<AudioBuffer | null> {
    const immediate = this.buffers.get(trackId);
    if (immediate) return immediate;

    const pending = this.pendingDecodes.get(trackId);
    if (pending) {
      try {
        await pending;
      } catch {
        addAudioDecodeError(refusalMessage(track, 'decode failed'));
        return null;
      }
    }

    const resolved = this.buffers.get(trackId);
    if (resolved) return resolved;

    addAudioDecodeError(refusalMessage(track, 'no decoded buffer'));
    return null;
  }

  /**
   * Play audio for a track starting at the given offset.
   * Creates a fresh AudioBufferSourceNode (one-shot pattern).
   *
   * 261012-exn: async never-reject — the buffer-present fast path reaches
   * source.start synchronously (no await executed); on a decode miss it awaits
   * the in-flight decode or records a named refusal; every failure is caught
   * inside so the returned promise NEVER rejects (fire-and-forget safe).
   */
  async play(trackId: string, offsetSeconds: number, track: AudioTrack, fps: number, maxDurationSec?: number): Promise<void> {
    try {
      const ctx = this.ensureContext();
      // `??` short-circuits: a present buffer skips the await entirely, so the
      // happy path stays effectively synchronous (playbackEngine scrub law).
      const buffer = this.buffers.get(trackId) ?? (await this.resolveBufferForPlay(trackId, track));
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
    } catch (err) {
      // Never reject: every failure lands in the visible refusal list.
      addAudioDecodeError(refusalMessage(track, err instanceof Error ? err.message : String(err)));
    }
  }

  /**
   * Schedule audio to start after a delay (for tracks that begin after the playhead).
   * Uses Web Audio API's `when` parameter for sample-accurate timing.
   *
   * 261012-exn: async never-reject — the same decode-readiness contract as
   * play(); the scheduling anchor is captured BEFORE awaiting a decode so a
   * slow decode cannot push the scheduled start past the caller's intent.
   */
  async playDelayed(trackId: string, delaySec: number, offsetSeconds: number, track: AudioTrack, fps: number, maxDurationSec?: number): Promise<void> {
    try {
      const ctx = this.ensureContext();
      // Anchor captured before any await (decode readiness must not drift it).
      const anchorTime = ctx.currentTime;
      const buffer = this.buffers.get(trackId) ?? (await this.resolveBufferForPlay(trackId, track));
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
      const scheduledStart = anchorTime + delaySec;
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
    } catch (err) {
      // Never reject: every failure lands in the visible refusal list.
      addAudioDecodeError(refusalMessage(track, err instanceof Error ? err.message : String(err)));
    }
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

  /**
   * Read-only probe: whether a live AudioContext currently exists (41-05 D-08
   * release orchestration — no playback behavior change).
   */
  hasContext(): boolean {
    return this.ctx !== null && this.ctx.state !== 'closed';
  }

  /**
   * Close and discard the AudioContext (D-08 window-close release).
   * Idempotent: a no-op when no context exists or it is already closed —
   * ctx.close() on a closed context rejects, so the reference is dropped
   * first and the close is guarded by a state check plus try/catch. A closed
   * context is never reused: a later ensureContext() creates a fresh one.
   */
  async closeContext(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    this.ctx = null;
    if (ctx.state === 'closed') return;
    try {
      await ctx.close();
    } catch (_) {
      // Closed concurrently — already discarded above.
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
   * - setValueCurveAtTime of the sampled fadeCurves law for EVERY curve
   *   (exponential, logarithmic, linear) — the audible ramp matches the
   *   drawn overlay (261010-ht0 F3). No linear-ramp stand-in.
   *
   * Note: fade-out targets FADE_OUT_FLOOR (0.001) so AudioParam never
   * receives a zero edge.
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

    // Fade-in: sample the remaining loudness slice so a partial entry (playback
    // joins inside the fade) starts mid-curve. setValueCurveAtTime for every
    // curve — the audible ramp matches the drawn overlay (261010-ht0 F3).
    if (hasFadeIn) {
      const fadeProgress = Math.min(1, Math.max(0, visibleOffset / fadeInSec));
      const remaining = fadeInSec - visibleOffset;
      const curveArray = sampleFadeCurve(track.fadeInCurve, 'in', fadeProgress, 1, vol);
      gain.gain.setValueCurveAtTime(curveArray, audioStartTime, remaining);
    } else {
      gain.gain.setValueAtTime(vol, audioStartTime);
    }

    // Fade-out
    if (hasFadeOut) {
      const fadeOutStart = effectiveEnd - fadeOutSec;
      if (fadeOutStart > audioStartTime) {
        gain.gain.setValueAtTime(vol, fadeOutStart);
        this.applyRamp(gain, vol, fadeOutStart, effectiveEnd, track.fadeOutCurve);
      }
    }
  }

  /**
   * Apply a sampled fade-out ramp (fadeShape law, floored at 0.001) via
   * setValueCurveAtTime. No linear-ramp stand-in for any curve.
   */
  private applyRamp(
    gain: GainNode,
    vol: number,
    startTime: number,
    endTime: number,
    curve: FadeCurve,
  ): void {
    const duration = Math.max(0, endTime - startTime);
    if (duration === 0) {
      gain.gain.setValueAtTime(FADE_OUT_FLOOR, endTime);
      return;
    }
    const curveArray = sampleFadeCurve(curve, 'out', 0, 1, vol);
    gain.gain.setValueCurveAtTime(curveArray, startTime, duration);
  }
}

export const audioEngine = new AudioEngine();
