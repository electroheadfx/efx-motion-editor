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
const engineSource = readFileSync(
  new URL('../../../packages/efx-physic-paint/src/engine/EfxPaintEngine.ts', import.meta.url),
  'utf8',
);
const rotoFrameDrawSource = readFileSync(new URL('./rotoFrameDraw.ts', import.meta.url), 'utf8');
const studioSource = readFileSync(
  new URL('../components/physic-paint/PhysicsPaintStudio.tsx', import.meta.url),
  'utf8',
);
const topBarSource = readFileSync(
  new URL('../components/physic-paint/view/PhysicsPaintTopBar.tsx', import.meta.url),
  'utf8',
);
const settingsSource = readFileSync(
  new URL('../components/physic-paint/engine/physicsPaintStudioSettings.ts', import.meta.url),
  'utf8',
);
const typesSource = readFileSync(new URL('../types/physicPaint.ts', import.meta.url), 'utf8');
const documentSource = readFileSync(
  new URL('../efx-paint/document/efxPaintDocument.ts', import.meta.url),
  'utf8',
);

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

// 260925-iy6 UAT follow-up — "the tooth must appear on the paint you work on".
// The active track was the one surface structurally excluded from the seam, so
// single-track painting was 100% flat and the user needed a hidden dummy track
// to see grain. These pins lock the live-dry overlay (the engine's dry canvas
// composited as the active track's live contribution BEFORE the paper pass, so
// the tooth lands ONCE on the mixed paint) and the paperGrain removal.
describe('260925-iy6 UAT follow-up — live-dry overlay + paperGrain removal', () => {
  it('U1 the pass gate keys on kind === paper && grainStrength > 0 — never paperGrain', () => {
    // The old gate was `kind === 'paper' && metadata.paperGrain && grainStrength > 0`
    // while the tile probe keyed on metadata.background — a silent-disable trap.
    expect(storeSource).toMatch(/kind === 'paper' && passSource\.metadata\.grainStrength > 0/);
    expect(storeSource).not.toMatch(/metadata\.paperGrain &&/);
  });

  it('U2 _resolveFlattenedFrame takes a liveOverlay and composites it BEFORE applyPaperPass', () => {
    expect(storeSource).toMatch(/function _resolveFlattenedFrame\([\s\S]*?liveOverlay/);
    const overlayDraw = storeSource.indexOf('drawImage(liveOverlay');
    const pass = storeSource.indexOf('applyPaperPass(');
    expect(overlayDraw).toBeGreaterThanOrEqual(0);
    expect(pass).toBeGreaterThan(overlayDraw);
  });

  it('U3 the live-overlay path bypasses the flattened memo (result depends on live pixels)', () => {
    // The memo .set must be guarded so a live-overlay build is never cached.
    expect(storeSource).toMatch(/if \(!liveOverlay\)[\s\S]{0,80}flattenedMemo\.set\(/);
  });

  it('U4 the Studio handler bumps physicPaintVersion at finalize (monitor redraw trigger)', () => {
    const handler = studioSource.indexOf('canvasCompletedMutationImplRef.current = ');
    expect(handler).toBeGreaterThanOrEqual(0);
    const body = studioSource.slice(handler, handler + 600);
    expect(body).toContain('physicPaintVersion.value++');
  });

  it('U5 the engine exposes a NON-flushing dry-canvas getter', () => {
    // getCanvas() flushes pending finalizations (capture path); the monitor's
    // live-overlay read must not force-flush every draw.
    expect(engineSource).toMatch(/getDryCanvas\(\)[^}]*return this\.dualCanvas\.dryCanvas/);
    const getter = engineSource.indexOf('getDryCanvas()');
    const body = engineSource.slice(getter, getter + 200);
    expect(body).not.toContain('flushPendingStrokeFinalizations');
  });

  it('U6 paperGrain is gone from types, settings, fallback, and rotoFrameDraw', () => {
    expect(typesSource).not.toMatch(/paperGrain/);
    expect(settingsSource).not.toMatch(/paperGrain/);
    expect(documentSource).not.toMatch(/paperGrain/);
    expect(rotoFrameDrawSource).not.toMatch(/paperGrain/);
  });

  it('U7 drawDeterministicPaperGrain is DELETED (no procedural grain, 260925-dso)', () => {
    expect(rotoFrameDrawSource).not.toMatch(/drawDeterministicPaperGrain/);
  });

  it('U8 the Paper-grain control is gone from the TopBar', () => {
    expect(topBarSource).not.toMatch(/PAPER_GRAIN_OPTIONS/);
    expect(topBarSource).not.toMatch(/onPaperGrainChange/);
  });

  it('U9 grain-strength writes go through setRotoBackgroundMetadata synchronously', () => {
    // Mirror of handleGrainScaleChange: the write must clear both memos and bump
    // the version clock, not rely on the deferred useRotoBackgroundMetadataSync.
    const handler = studioSource.indexOf('handleGrainStrengthChange');
    expect(handler).toBeGreaterThanOrEqual(0);
    const body = studioSource.slice(handler, handler + 500);
    expect(body).toContain('setRotoBackgroundMetadata');
  });
});
