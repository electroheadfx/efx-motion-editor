import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'PhysicsPaintAudioModalView.tsx'), 'utf8');

describe('PhysicsPaintAudioModalView Gain field (261008-ful)', () => {
  it('renders field 4 as a NumericStepper (step 5, clamped) committing through commitGain', () => {
    const start = source.indexOf('{/* 4.');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf('{/* 5-6.', start);
    expect(end).toBeGreaterThan(start);
    const gainField = source.slice(start, end);
    expect(gainField).toContain('<NumericStepper');
    expect(gainField).toContain('step={5}');
    expect(gainField).toContain('min={-100}');
    expect(gainField).toContain('max={100}');
    expect(gainField).toContain('value={previewGain}');
    expect(gainField).toContain('onChange={(value) => commitGain(value)}');
  });

  it('removes the native range slider and the stale contract wording entirely', () => {
    expect(source).not.toContain('type="range"');
    expect(source).not.toContain('native range');
    expect(source).not.toContain('previewGainInput');
  });

  it('keeps the updated contract comment and the signed readout copy verbatim', () => {
    expect(source).toContain('NumericStepper step 5');
    expect(source).toContain('previewGain > 0 ? `+${previewGain}` : `${previewGain}`');
    expect(source).toContain('AUDIO_GAIN_LABEL');
  });
});
