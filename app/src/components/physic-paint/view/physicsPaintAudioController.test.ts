import { describe, expect, it } from 'vitest';
import {
  buildFreshSoundClip,
  buildReplacedSoundClip,
  isValidFadeFrames,
  isValidGain,
  type ImportedSoundSource,
} from './physicsPaintAudioController';

/**
 * 52.5 UAT round 2 — the Document sound field laws. Pure validators + import
 * builders only (the controller hook needs a Preact context; its commit path
 * is `isValid*` then the one `setDocumentSound` setter, whose own
 * `_isValidSoundClip` accepts any non-negative integer fade).
 */

const SOURCE: ImportedSoundSource = {
  sourceId: 'asset-1',
  relativePath: 'audio/sound.wav',
  sourceRevision: 1,
  durationSec: 10,
};

describe('isValidFadeFrames (T-52.5-12 — frames, integer >= 0, NO 99 cap)', () => {
  it('accepts multi-digit frame counts the UAT report could not enter', () => {
    expect(isValidFadeFrames(99)).toBe(true);
    expect(isValidFadeFrames(100)).toBe(true);
    expect(isValidFadeFrames(250)).toBe(true);
    expect(isValidFadeFrames(0)).toBe(true);
  });

  it('rejects fractional and negative entries — the prior value stays', () => {
    expect(isValidFadeFrames(-1)).toBe(false);
    expect(isValidFadeFrames(1.5)).toBe(false);
    expect(isValidFadeFrames(Number.NaN)).toBe(false);
  });
});

describe('isValidGain (signed integer -100..100)', () => {
  it('accepts the full slider range and rejects the edges outside it', () => {
    expect(isValidGain(-100)).toBe(true);
    expect(isValidGain(0)).toBe(true);
    expect(isValidGain(100)).toBe(true);
    expect(isValidGain(101)).toBe(false);
    expect(isValidGain(-101)).toBe(false);
    expect(isValidGain(10.5)).toBe(false);
  });
});

describe('import defaults (fresh + replace-with-clamp)', () => {
  it('fresh import spans the source at project fps (10s x 24 = 240 frames)', () => {
    const clip = buildFreshSoundClip(SOURCE, 24);
    expect(clip.startFrame).toBe(0);
    expect(clip.inFrame).toBe(0);
    expect(clip.outFrame).toBe(240);
    expect(clip.gain).toBe(0);
    expect(clip.enabled).toBe(true);
  });

  it('replace keeps position/in-out and clamps outFrame to a shorter source', () => {
    const current = {
      id: 'sound-clip-1',
      sourceId: 'asset-1',
      relativePath: 'audio/sound.wav',
      sourceRevision: 1,
      startFrame: 48,
      inFrame: 12,
      outFrame: 200,
      gain: 0,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      fadeInCurve: 'linear' as const,
      fadeOutCurve: 'linear' as const,
      enabled: true,
    };
    const shorter: ImportedSoundSource = { ...SOURCE, durationSec: 2 };
    const clip = buildReplacedSoundClip(current, shorter, 24);
    expect(clip.startFrame).toBe(48);
    expect(clip.inFrame).toBe(12);
    expect(clip.outFrame).toBe(48);
  });

  it('replace on a source shorter than the in point folds to a 1-frame tail span', () => {
    const current = {
      id: 'sound-clip-1',
      sourceId: 'asset-1',
      relativePath: 'audio/sound.wav',
      sourceRevision: 1,
      startFrame: 0,
      inFrame: 100,
      outFrame: 120,
      gain: 0,
      fadeInFrames: 0,
      fadeOutFrames: 0,
      fadeInCurve: 'linear' as const,
      fadeOutCurve: 'linear' as const,
      enabled: true,
    };
    const shorter: ImportedSoundSource = { ...SOURCE, durationSec: 1 };
    const clip = buildReplacedSoundClip(current, shorter, 24);
    expect(clip.inFrame).toBe(23);
    expect(clip.outFrame).toBe(24);
  });
});
