// 261017-nnu — the engine paper host: one generator, thin cache, no wash.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const engineCtor = vi.hoisted(() => vi.fn());
vi.mock('@efxlab/efx-watercolor', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@efxlab/efx-watercolor')>();
  return {
    ...actual,
    WatercolorEngine: engineCtor,
  };
});

import {
  getEnginePaperHeight,
  getEnginePaperSheet,
  resetEnginePaperSheetForTests,
} from './enginePaperSheet';

function fakeSheet(width: number, height: number): HTMLCanvasElement {
  return { width, height } as HTMLCanvasElement;
}

beforeEach(() => {
  resetEnginePaperSheetForTests();
  if (typeof globalThis.document === 'undefined') {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement: () => ({}) },
    });
  }
  engineCtor.mockReset();
  engineCtor.mockImplementation(() => ({
    paperSheet: vi.fn((preset: unknown, width: number, height: number) => {
      if (!preset) return null;
      return fakeSheet(width, height);
    }),
    paperHeight: vi.fn((preset: unknown, width: number, height: number) => {
      if (!preset) return null;
      return new Float32Array(width * height).fill(0.5);
    }),
  }));
});

describe('enginePaperSheet cache', () => {
  it('a repeat of the same key returns the identical canvas object', () => {
    const a = getEnginePaperSheet('paper/cold-press', 64, 64, 1);
    const b = getEnginePaperSheet('paper/cold-press', 64, 64, 1);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });

  it('a repeat of the same height key returns the identical Float32Array', () => {
    const a = getEnginePaperHeight('paper/cold-press', 32, 32, 1);
    const b = getEnginePaperHeight('paper/cold-press', 32, 32, 1);
    expect(a).not.toBeNull();
    expect(b).toBe(a);
  });

  it('different size or scale is a different cache entry', () => {
    const base = getEnginePaperSheet('paper/cold-press', 64, 64, 1);
    const scaled = getEnginePaperSheet('paper/cold-press', 64, 64, 2);
    const resized = getEnginePaperSheet('paper/cold-press', 32, 32, 1);
    expect(scaled).not.toBe(base);
    expect(resized).not.toBe(base);
  });

  it('null on unknown / real ids (jpg arm stays the caller side)', () => {
    expect(getEnginePaperSheet('paper/real-1', 64, 64, 1)).toBeNull();
    expect(getEnginePaperSheet('canvas1', 64, 64, 1)).toBeNull();
    expect(getEnginePaperSheet('paper/nope', 64, 64, 1)).toBeNull();
    expect(getEnginePaperSheet('', 64, 64, 1)).toBeNull();
    expect(getEnginePaperHeight('paper/real-1', 64, 64, 1)).toBeNull();
  });

  it('hostile sizes are fail-soft null, never a throw', () => {
    expect(getEnginePaperSheet('paper/cold-press', 0, 64, 1)).toBeNull();
    expect(getEnginePaperSheet('paper/cold-press', 64, -1, 1)).toBeNull();
    expect(getEnginePaperHeight('paper/cold-press', 64, 64, 0)).toBeNull();
  });

  it('reset drops both maps and the engine', () => {
    const first = getEnginePaperSheet('paper/cold-press', 16, 16, 1);
    expect(first).not.toBeNull();
    resetEnginePaperSheetForTests();
    const second = getEnginePaperSheet('paper/cold-press', 16, 16, 1);
    expect(second).not.toBeNull();
    expect(second).not.toBe(first);
    expect(engineCtor).toHaveBeenCalledTimes(2);
  });
});

describe('single-paper-generator contract (261017-nnu)', () => {
  const appSrc = resolve(__dirname, '..');
  const pkgSrc = resolve(__dirname, '../../../packages/efx-watercolor/src');

  function collect(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) collect(full, out);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it('the deleted duplicate module names are gone from the source tree', () => {
    // Fragmented so this pin file does not trip its own grep.
    const banned = [
      ['playground', 'PaperField'].join(''),
      ['paperField', 'Gl'].join(''),
      ['paperSheet', 'Field'].join(''),
      ['paperSheet', 'Client'].join(''),
      ['paperSheet', 'Warmup'].join(''),
      ['paperSheet', 'worker'].join('.'),
      ['renderPaperSheet', 'Gl'].join(''),
      ['usePaperSheet', 'Warmup'].join(''),
    ];
    const files = [...collect(appSrc), ...collect(pkgSrc)];
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const name of banned) {
        if (text.includes(name)) hits.push(`${file}: ${name}`);
      }
    }
    expect(hits.join('\n')).toBe('');
  });

  it('paperSheetFS carries PAPER_COLOUR + TO_SRGB and no wash mix', () => {
    const shaders = readFileSync(
      resolve(__dirname, '../../../packages/efx-watercolor/src/playground/shaders.ts'),
      'utf8',
    );
    const start = shaders.indexOf('export const paperSheetFS');
    expect(start).toBeGreaterThan(0);
    const body = shaders.slice(start, shaders.indexOf('`;', start));
    expect(body).toContain('PAPER_COLOUR');
    expect(body).toContain('TO_SRGB');
    expect(body).toContain('toSRGB(c)');
    // The swatch-only granulating corner treatment never reaches the sheet.
    expect(body).not.toContain('wash');
    expect(body).not.toContain('smoothstep(0.6, 0.605, x)');
    expect(body).not.toContain('tide');
  });

  it('paperSwatchFS keeps its wash (swatch-only treatment stays put)', () => {
    const shaders = readFileSync(
      resolve(__dirname, '../../../packages/efx-watercolor/src/playground/shaders.ts'),
      'utf8',
    );
    const start = shaders.indexOf('export const paperSwatchFS');
    const body = shaders.slice(start, shaders.indexOf('export const paperSheetFS'));
    expect(body).toContain('float wash = smoothstep(0.6, 0.605, x);');
  });

  it('drawPaper is public on the engine (no private modifier on the method)', () => {
    const engine = readFileSync(
      resolve(__dirname, '../../../packages/efx-watercolor/src/playground/Engine.ts'),
      'utf8',
    );
    expect(engine).toMatch(/\n  drawPaper\(/);
    expect(engine).not.toMatch(/\n  private drawPaper\(/);
    expect(engine).toMatch(/\n  paperSheet\(/);
    expect(engine).toMatch(/\n  paperHeight\(/);
    expect(engine).toContain('paperSheet: this.g.program(S.paperSheetFS)');
  });
});
