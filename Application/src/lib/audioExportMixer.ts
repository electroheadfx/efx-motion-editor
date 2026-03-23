import type { AudioTrack, FadeCurve } from '../types/audio';
import { audioEngine } from './audioEngine';
import audioBufferToWav from 'audiobuffer-to-wav';

/**
 * Apply a gain ramp using the specified curve type.
 * Mirrors audioEngine.applyRamp logic for OfflineAudioContext.
 */
function applyRamp(
  gain: GainNode,
  targetValue: number,
  endTime: number,
  curve: FadeCurve,
): void {
  if (curve === 'exponential') {
    gain.gain.exponentialRampToValueAtTime(targetValue, endTime);
  } else {
    // 'linear' and 'logarithmic' both use linearRamp
    gain.gain.linearRampToValueAtTime(targetValue, endTime);
  }
}

/**
 * Apply fade schedule for export rendering.
 * Mirrors audioEngine.applyFadeSchedule but uses absolute OfflineAudioContext
 * timing (no currentTime dependency).
 *
 * Per D-02: reuses same fade/volume/offset logic as preview playback.
 */
function applyExportFadeSchedule(
  gain: GainNode,
  track: AudioTrack,
  fps: number,
  _sampleRate: number,
): void {
  const vol = track.muted ? 0 : track.volume;
  if (vol === 0) {
    gain.gain.setValueAtTime(0, 0);
    return;
  }

  const startTime = Math.max(0, track.offsetFrame / fps);
  const fadeInSec = track.fadeInFrames / fps;
  const fadeOutSec = track.fadeOutFrames / fps;
  const visibleDuration = (track.outFrame - track.inFrame) / fps;

  const hasFadeIn = fadeInSec > 0;
  const hasFadeOut = fadeOutSec > 0;

  if (!hasFadeIn && !hasFadeOut) {
    gain.gain.setValueAtTime(vol, startTime);
    return;
  }

  // Fade-in: start at near-zero, ramp to full volume
  if (hasFadeIn) {
    gain.gain.setValueAtTime(0.001, startTime);
    applyRamp(gain, vol, startTime + fadeInSec, track.fadeInCurve);
  } else {
    gain.gain.setValueAtTime(vol, startTime);
  }

  // Fade-out: at the end of visible range, ramp to near-zero
  // (exponentialRamp cannot target 0, so we use 0.001)
  if (hasFadeOut) {
    const fadeOutStart = startTime + visibleDuration - fadeOutSec;
    if (fadeOutStart > startTime) {
      gain.gain.setValueAtTime(vol, fadeOutStart);
      applyRamp(gain, 0.001, startTime + visibleDuration, track.fadeOutCurve);
    }
  }
}

/**
 * Pre-render all audio tracks to a single mixed WAV ArrayBuffer using OfflineAudioContext.
 * Per D-01: guarantees fades and volume match preview playback exactly.
 * Per D-02: reuses audioEngine fade/volume/offset logic (no duplicate DSP in Rust).
 *
 * @param signal - Optional AbortSignal to cancel rendering mid-flight.
 *   When aborted, rejects with a DOMException('Aborted', 'AbortError').
 *   Also includes a 60-second timeout safety net.
 */
export async function renderMixedAudio(
  tracks: AudioTrack[],
  fps: number,
  totalDurationSec: number,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  // Use 48000 Hz (professional video standard, avoids FFmpeg resampling artifacts)
  const sampleRate = 48000;
  // Pitfall 1: Math.ceil + 0.5s padding to prevent cut-off
  const totalSamples = Math.ceil((totalDurationSec + 0.5) * sampleRate);
  const offline = new OfflineAudioContext(2, totalSamples, sampleRate);

  for (const track of tracks) {
    if (track.muted) continue;
    const buffer = audioEngine.getBuffer(track.id);
    if (!buffer) continue;

    const source = offline.createBufferSource();
    source.buffer = buffer;
    const gain = offline.createGain();

    // Apply fade schedule (reuses audioEngine logic pattern)
    applyExportFadeSchedule(gain, track, fps, sampleRate);

    source.connect(gain);
    gain.connect(offline.destination);

    // Schedule source start/offset matching playback logic
    const startTimeSec = track.offsetFrame / fps;
    const sourceOffsetSec = (track.inFrame + track.slipOffset) / fps;
    const durationSec = (track.outFrame - track.inFrame) / fps;

    // Pitfall 2: when cannot be negative
    const when = Math.max(0, startTimeSec);
    const adjustedOffset = sourceOffsetSec + Math.max(0, -startTimeSec);

    if (durationSec > 0) {
      source.start(when, adjustedOffset, durationSec);
    }
  }

  // Check if already aborted before starting the render
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  // Race the offline render against abort signal and a 60s timeout safety net
  const timeoutMs = 60_000;
  const renderedBuffer = await Promise.race([
    offline.startRendering(),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Audio pre-render timed out (60s)')),
        timeoutMs,
      );
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('Aborted', 'AbortError'));
        }, { once: true });
      }
    }),
  ]);

  return audioBufferToWav(renderedBuffer);
}
