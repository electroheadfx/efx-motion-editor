/**
 * 261017-mz9 Task 1 pins: the pixel-mass cap and the pure CPU field generator.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  capFieldSize,
  generatePaperSheetCpu,
  PAPER_FIELD_MAX_LONG_SIDE,
} from './paperSheetField';

const root = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('261017-mz9 capFieldSize', () => {
  it('clamps 1920x1080 to 1024x576 (aspect preserved, long side capped)', () => {
    expect(capFieldSize(1920, 1080)).toEqual({ fieldWidth: 1024, fieldHeight: 576 });
  });

  it('clamps portrait on its height (1080x1920 -> 576x1024)', () => {
    expect(capFieldSize(1080, 1920)).toEqual({ fieldWidth: 576, fieldHeight: 1024 });
  });

  it('leaves an already-small request unchanged', () => {
    expect(capFieldSize(64, 32)).toEqual({ fieldWidth: 64, fieldHeight: 32 });
    expect(capFieldSize(1024, 576)).toEqual({ fieldWidth: 1024, fieldHeight: 576 });
  });

  it('never enlarges the request and floors both sides at 1', () => {
    expect(capFieldSize(10, 4)).toEqual({ fieldWidth: 10, fieldHeight: 4 });
    expect(capFieldSize(0, 0)).toEqual({ fieldWidth: 1, fieldHeight: 1 });
    expect(capFieldSize(-5, 10)).toEqual({ fieldWidth: 1, fieldHeight: 1 });
    expect(capFieldSize(Number.NaN, 10)).toEqual({ fieldWidth: 1, fieldHeight: 1 });
    expect(capFieldSize(3.9, 2.2)).toEqual({ fieldWidth: 3, fieldHeight: 2 });
  });

  it('PAPER_FIELD_MAX_LONG_SIDE is one named constant at 1024', () => {
    expect(PAPER_FIELD_MAX_LONG_SIDE).toBe(1024);
  });
});

describe('261017-mz9 generatePaperSheetCpu', () => {
  it('returns null on unknown id', () => {
    expect(generatePaperSheetCpu('paper/nope', 8, 8, 1)).toBeNull();
    expect(generatePaperSheetCpu('', 8, 8, 1)).toBeNull();
    expect(generatePaperSheetCpu('canvas1', 8, 8, 1)).toBeNull();
  });

  it('returns null on hostile size', () => {
    expect(generatePaperSheetCpu('paper/cold-press', 0, 8, 1)).toBeNull();
    expect(generatePaperSheetCpu('paper/cold-press', 8, -1, 1)).toBeNull();
    expect(generatePaperSheetCpu('paper/cold-press', 4.5, 8, 1)).toBeNull();
  });

  it('produces opaque RGBA at the requested field size', () => {
    const pixels = generatePaperSheetCpu('paper/cold-press', 8, 4, 1);
    expect(pixels).not.toBeNull();
    expect(pixels!.length).toBe(8 * 4 * 4);
    // Opaque paperColour sRGB — alpha is always 255.
    for (let i = 3; i < pixels!.length; i += 4) expect(pixels![i]).toBe(255);
  });

  it('two different presets produce different bytes at the same field size', () => {
    const cold = generatePaperSheetCpu('paper/cold-press', 16, 16, 1)!;
    const rough = generatePaperSheetCpu('paper/rough', 16, 16, 1)!;
    expect(Array.from(cold.subarray(0, 64))).not.toEqual(Array.from(rough.subarray(0, 64)));
  });

  it('uScale is computed from the capped field height (source-scan)', () => {
    const src = source('src/lib/paperSheetField.ts');
    expect(src).toContain('PAPER_UNITS / (fieldHeight * normalized)');
    expect(src).not.toContain('PAPER_UNITS / (height * normalized)');
  });
});
