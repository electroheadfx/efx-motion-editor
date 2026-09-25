import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// 260925-iy6 — Task 1 RED pins: structural guards for the frame/export seam.
//
// The pass must exist at EXACTLY ONE place (_resolveFlattenedFrame, between the
// composite and the fond draw) so preview, program monitor, and export cannot
// drift into a second implementation — the dual-pipeline failure 260925-dso (9a)
// just deleted. The store also stays free of pixel-array canvas APIs (the
// real-time playback guardrail), and the two shared inputs (the package
// conditioner export + the raw texture getter) are pinned as exports.

const storeSource = readFileSync(new URL('../stores/physicPaintStore.ts', import.meta.url), 'utf8');
const exportRendererSource = readFileSync(new URL('./exportRenderer.ts', import.meta.url), 'utf8');
const previewRendererSource = readFileSync(new URL('./previewRenderer.ts', import.meta.url), 'utf8');
const packageIndexSource = readFileSync(
  new URL('../../../packages/efx-physic-paint/src/index.ts', import.meta.url),
  'utf8',
);
const paperRasterSource = readFileSync(new URL('./projectPaperRaster.ts', import.meta.url), 'utf8');

const PIXEL_ARRAY_API = /getImageData|putImageData/;

function occurrences(source: string, needle: string): number {
  return source.split(needle).length - 1;
}

describe('260925-iy6 frame/export guard', () => {
  it('P4(a) the store contains EXACTLY ONE applyPaperPass call site', () => {
    expect(occurrences(storeSource, 'applyPaperPass(')).toBe(1);
  });

  it('P4(b) ordering: compositeFrame → applyPaperPass → fond draw', () => {
    const composite = storeSource.indexOf('const result = compositeFrame(');
    const pass = storeSource.indexOf('applyPaperPass(');
    const fond = storeSource.indexOf('fondCtx.drawImage(');
    // Raw indexOf comparisons — a missing middle term yields -1 and FAILS.
    expect(composite).toBeGreaterThanOrEqual(0);
    expect(pass).toBeGreaterThan(composite);
    expect(fond).toBeGreaterThan(pass);
  });

  it('P4(c) CONTROL: the store has zero pixel-array canvas APIs anywhere (base-green)', () => {
    expect(storeSource.match(PIXEL_ARRAY_API) ?? []).toEqual([]);
  });

  it('P4(d) CONTROL: export/preview carry no second implementation and stay on the seam', () => {
    expect(occurrences(exportRendererSource, 'applyPaperPass')).toBe(0);
    expect(occurrences(previewRendererSource, 'applyPaperPass')).toBe(0);
    expect(previewRendererSource).toContain('getFlattenedFrame(');
    expect(exportRendererSource).toContain('renderGlobalFrame(');
  });

  it('P4(e) the package exports conditionHeightMap for the shared conditioner', () => {
    expect(packageIndexSource).toMatch(/export\s*\{[^}]*\bconditionHeightMap\b[^}]*\}/);
  });

  it('P4(e) projectPaperRaster exports the raw texture getter and the grain-scale normalizer', () => {
    expect(paperRasterSource).toMatch(/export function getProjectPaperTextureImage/);
    expect(paperRasterSource).toMatch(/export function normalizeGrainScale/);
  });

  // UAT 260925-iy6 row 1 counter-test (c). The paper pass lives ONLY in
  // _resolveFlattenedFrame, and the active track's live engine canvas stacked
  // above the monitor never routes through it (D-05 / T-48-16). So the tooth is
  // unreachable on the surface you paint on — but it MUST appear the moment a
  // track stops being the active one. That guarantee is exactly "both getters
  // delegate to the one seam": getFlattenedFrameExcluding (edit base, other
  // tracks) and getFlattenedFrame (playback / preview / export, full composite)
  // have to share it. Without this pin, a future parallel resolve path would
  // silently drop the tooth from the non-active tracks and no colour test would
  // notice (the same class of miss as 260924-m7w's opacity-blind pins).
  it('P4(f) both flattened getters delegate to the ONE _resolveFlattenedFrame seam', () => {
    expect(occurrences(storeSource, 'return _resolveFlattenedFrame(')).toBe(2);
    const including = storeSource.indexOf('getFlattenedFrame(layerId: string, frame: number, includeFond = true)');
    const excluding = storeSource.indexOf('getFlattenedFrameExcluding(');
    const seam = storeSource.indexOf('function _resolveFlattenedFrame');
    expect(including).toBeGreaterThanOrEqual(0);
    expect(excluding).toBeGreaterThanOrEqual(0);
    expect(seam).toBeGreaterThanOrEqual(0);
  });
});
