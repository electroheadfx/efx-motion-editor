import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { presetForPaperId, renderPaperSheet } from '@efxlab/efx-watercolor/papers';
import {
  PAPER_FIELD_FS,
  PAPER_LIGHT_FS,
  PAPER_SHEET_FS,
  renderPaperSheetGl,
  resetPaperFieldGlForTests,
} from './paperFieldGl';

const root = resolve(__dirname, '../..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');

afterEach(() => {
  resetPaperFieldGlForTests();
  vi.restoreAllMocks();
});

describe('261017-lny paperFieldGl oracle GLSL', () => {
  it('source-scan: uBump, lit 1.3 / 0.25, and the fbm mat2 survive in the shader text', () => {
    const src = source('src/lib/paperFieldGl.ts');
    // paperLightFS call-site constant + lit law (shaders.ts:505)
    expect(src).toContain('uBump');
    expect(PAPER_LIGHT_FS).toContain('* 1.3 +');
    expect(PAPER_LIGHT_FS).toContain('* 0.25');
    expect(PAPER_LIGHT_FS).toContain('vec3 L = normalize(vec3(-0.5, 0.6, 0.62));');
    // fbm octave rotation (shaders.ts:299)
    expect(PAPER_FIELD_FS).toContain('mat2(0.8, -0.6, 0.6, 0.8)');
    // coordinate law (shaders.ts:474)
    expect(PAPER_FIELD_FS).toContain('(vUv * uRes + uOffset) * uScale');
    // Engine.ts:833 bump law is applied by the host, not folded into the shader
    expect(src).toContain('(preset.bump * 1.4) / scale');
  });

  it('source-scan: PAPER_COLOUR + TO_SRGB ride the sheet pass at uTexture = 1', () => {
    expect(PAPER_SHEET_FS).toContain('paperColour(paper, uPaperTint)');
    expect(PAPER_SHEET_FS).toContain('toSRGB(c)');
    expect(PAPER_SHEET_FS).toContain('uTexture');
    const src = source('src/lib/paperFieldGl.ts');
    expect(src).toContain("gl.uniform1f(uniform(gl, res.sheetProgram, 'uTexture'), 1)");
  });
});

describe('261017-lny renderPaperSheetGl null-on-failure contract', () => {
  it('returns null (never throws) when WebGL2 is unavailable', () => {
    const canvas = { getContext: () => null, addEventListener: () => {} };
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { createElement: () => canvas },
    });
    try {
      resetPaperFieldGlForTests();
      const preset = presetForPaperId('paper/cold-press')!;
      expect(() => renderPaperSheetGl(8, 8, 1, 1, preset)).not.toThrow();
      expect(renderPaperSheetGl(8, 8, 1, 1, preset)).toBeNull();
    } finally {
      if (previousDocument === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument });
      }
    }
  });

  it('returns null for hostile sizes / scale / seed without touching GL', () => {
    const preset = presetForPaperId('paper/cold-press')!;
    expect(renderPaperSheetGl(0, 8, 1, 1, preset)).toBeNull();
    expect(renderPaperSheetGl(8, -1, 1, 1, preset)).toBeNull();
    expect(renderPaperSheetGl(8, 8, 0, 1, preset)).toBeNull();
    expect(renderPaperSheetGl(8, 8, Number.NaN, 1, preset)).toBeNull();
    expect(renderPaperSheetGl(8, 8, 1, Number.NaN, preset)).toBeNull();
  });

  it('CPU fallback entry (renderPaperSheet) remains exported and reachable from the package entry', async () => {
    const papers = await import('@efxlab/efx-watercolor/papers');
    expect(typeof papers.renderPaperSheet).toBe('function');
    expect(typeof renderPaperSheet).toBe('function');
    const preset = presetForPaperId('paper/cold-press')!;
    const rgba = renderPaperSheet(4, 4, 1, 1, preset);
    expect(rgba).toBeInstanceOf(Uint8ClampedArray);
    expect(rgba.length).toBe(4 * 4 * 4);
    // opaque paperColour sheet
    expect(rgba[3]).toBe(255);
  });
});
