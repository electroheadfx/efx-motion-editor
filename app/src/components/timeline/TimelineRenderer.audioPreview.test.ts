import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./TimelineRenderer.ts', import.meta.url)),
  'utf8',
);

/** Slice just drawAudioTrack (step 1..10) so pins cannot match the Studio stain path. */
function drawAudioTrackSource(): string {
  const start = source.indexOf('private drawAudioTrack(');
  const end = source.indexOf('private drawRuler(', start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('drawAudioTrack Studio-style overlays (261010-en9 R3)', () => {
  it('imports the soundBandGeometry overlay helpers', () => {
    expect(source).toContain('soundGainLineY');
    expect(source).toContain('soundGainLineSpan');
    expect(source).toContain('soundFadeInPathD');
    expect(source).toContain('soundFadeOutPathD');
    expect(source).toContain("from '../physic-paint/view/soundBandGeometry'");
  });

  it('maps editor linear volume through dbToGain(linearToDb(...)) at the call site', () => {
    expect(source).toContain('dbToGain(linearToDb(');
    expect(source).toMatch(/from '\.\.\/\.\.\/lib\/audioGain'/);
  });

  it('strokes Path2D fade overlays and a gain line instead of gradients', () => {
    const draw = drawAudioTrackSource();
    expect(draw).toContain('soundGainLineY(');
    expect(draw).toContain('soundGainLineSpan(');
    expect(draw).toContain('soundFadeInPathD(');
    expect(draw).toContain('soundFadeOutPathD(');
    expect(draw).toContain('new Path2D(');
    // The two step-9 linear-gradient fades are gone from drawAudioTrack.
    expect(draw).not.toContain('createLinearGradient');
  });

  it('keeps waveform fill, centerline, and edge lines unchanged in treatment', () => {
    const draw = drawAudioTrackSource();
    expect(draw).toContain('audioCenterline');
    expect(draw).toContain('audioWaveform');
    expect(draw).toContain('audioWaveformMuted');
  });
});
