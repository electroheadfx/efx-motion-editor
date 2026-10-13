import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { AudioTrack } from '../types/audio';
import { renderMixedAudio } from './audioExportMixer';
import { audioEngine } from './audioEngine';

/**
 * 261010-ht0 F3 — export fade law must match preview: every curve is applied
 * via setValueCurveAtTime of the sampled fadeCurves array. No linear-ramp
 * stand-in for logarithmic (or any other curve).
 */

const readSource = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('audioExportMixer — sampled setValueCurveAtTime ramps (F3)', () => {
  const source = readSource('./audioExportMixer.ts');

  it('imports the shared fadeCurves law (no private shape table)', () => {
    expect(source).toContain("from './fadeCurves'");
    expect(source).toContain('sampleFadeCurve');
  });

  it('schedules setValueCurveAtTime for the fade-out ramp', () => {
    expect(source).toContain('setValueCurveAtTime');
    expect(source).toContain("sampleFadeCurve(curve, 'out'");
  });

  it('schedules setValueCurveAtTime for the fade-in ramp', () => {
    expect(source).toContain("sampleFadeCurve(track.fadeInCurve, 'in'");
  });

  it('keeps no linearRampToValueAtTime stand-in', () => {
    expect(source).not.toContain('linearRampToValueAtTime');
    expect(source).not.toContain('exponentialRampToValueAtTime');
  });

  it('fade-out targets the 0.001 floor constant from fadeCurves', () => {
    expect(source).toContain('FADE_OUT_FLOOR');
    expect(source).not.toMatch(/applyRamp\(\s*gain,\s*0\.001/);
  });
});

// ---------------------------------------------------------------------------
// 261012-exn Task 1 (RED): mixer buffer pre-scan (SND-02).
//
// renderMixedAudio must reject with a message naming the missing clip BEFORE
// it constructs `new OfflineAudioContext` — that ordering is what makes this
// leg runnable headless in node: today the constructor line runs first and the
// rejection is `OfflineAudioContext is not defined`, which never names the
// clip. The source-scan suite above stays byte-untouched.
// ---------------------------------------------------------------------------

describe('261012-exn mixer buffer pre-scan (SND-02)', () => {
  function makeMixTrack(id: string, name: string): AudioTrack {
    return {
      id,
      name,
      offsetFrame: 0,
      inFrame: 0,
      outFrame: 24,
      slipOffset: 0,
      muted: false,
      volume: 1,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      fadeInCurve: 'linear',
      fadeOutCurve: 'linear',
    } as unknown as AudioTrack;
  }

  beforeEach(() => {
    vi.spyOn(audioEngine, 'getBuffer').mockImplementation(
      (id: string) => (id === 'good-1' ? ({ duration: 10 } as AudioBuffer) : undefined),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects naming the missing clip before any OfflineAudioContext is constructed', async () => {
    await expect(
      renderMixedAudio(
        [makeMixTrack('good-1', 'Good.wav'), makeMixTrack('bad-1', 'Broken Vocals.wav')],
        24,
        1,
      ),
      'the rejection must name the missing clip — never a bare OfflineAudioContext ReferenceError',
    ).rejects.toThrow(/Broken Vocals\.wav/);
  });
});

// ---------------------------------------------------------------------------
// 261013-ctd export mux duration pad (EXP-01).
//
// The mixer's anti-cut-off duration pad stays INTERNAL. The export mux duration
// law truncates the longer stream at mux time in ffmpeg (option 2), never by
// dropping the pad. This source-scan pin is green-at-birth — it guards the
// brief's do-not-touch law, it is not the RED leg.
// ---------------------------------------------------------------------------

describe('261013-ctd export mux duration pad (EXP-01)', () => {
  it('keeps the anti-cut-off duration pad expression', () => {
    const source = readSource('./audioExportMixer.ts');
    expect(source).toContain('totalDurationSec + 0.5');
  });
});
