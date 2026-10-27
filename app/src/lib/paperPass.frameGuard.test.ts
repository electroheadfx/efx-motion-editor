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
const compositorSource = readFileSync(
  new URL('../efx-paint/compositor/efxPaintCompositor.ts', import.meta.url),
  'utf8',
);
const exportRendererSource = readFileSync(new URL('./exportRenderer.ts', import.meta.url), 'utf8');
const previewRendererSource = readFileSync(new URL('./previewRenderer.ts', import.meta.url), 'utf8');
const paperConditioningSource = readFileSync(new URL('./paperConditioning.ts', import.meta.url), 'utf8');
const paperRasterSource = readFileSync(new URL('./projectPaperRaster.ts', import.meta.url), 'utf8');
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

  it('P4(e) the app-owned conditioner exports conditionHeightMap for the shared condenser', () => {
    // quick 261027-klx: the conditioner is app-owned now (engine-1 is being
    // removed). The pinned law is the export itself, not the package.
    expect(paperConditioningSource).toMatch(/export function conditionHeightMap/);
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
    // 261027 (studio-strokes-lost-redraw): getFlattenedFrameSlice adds two
    // more delegations — the below/above slice call and its fail-open full
    // composite — so the watercolor sandwich rides the SAME paper-pass seam
    // instead of forking a parallel resolve path.
    expect(occurrences(storeSource, 'return _resolveFlattenedFrame(')).toBe(4);
    // The getter gained the session `soloTrackId` argument, so anchor on the
    // call-shaped literal (occurs once, at the definition) instead of the old
    // parameter list.
    expect(occurrences(storeSource, 'getFlattenedFrame(')).toBe(1);
    const including = storeSource.indexOf('getFlattenedFrame(');
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
  it('U1 the pass gate is paper kind + grainStrength > 0, and never an opaque transmittance sheet', () => {
    // The old gate was `kind === 'paper' && metadata.paperGrain && grainStrength > 0`
    // while the tile probe keyed on metadata.background — a silent-disable trap.
    // 2026-10-26 opaque-sheet parity: the gate is `shouldApplyPaperPass`, which
    // also refuses aquarelle transmittance (the editor speckle the Studio never
    // showed). paperGrain must never come back.
    expect(storeSource).not.toMatch(/metadata\.paperGrain &&/);
    expect(storeSource).toContain('shouldApplyPaperPass({');
    // The transmittance probe runs BETWEEN the composite and the pass: it is
    // the pre-fond alpha signature, unavailable once the fond multiplies.
    const composite = storeSource.indexOf('const result = compositeFrame(');
    const probe = storeSource.indexOf('const transmittanceSheet = isFullyOpaqueRaster(');
    const pass = storeSource.indexOf('applyPaperPass(');
    expect(composite).toBeGreaterThanOrEqual(0);
    expect(probe).toBeGreaterThan(composite);
    expect(pass).toBeGreaterThan(probe);
  });

  it('U1b ROUND 2: converted pigment-alpha composites are re-keyed into the pass gate', () => {
    // After the pigment-alpha conversion the composite is no longer fully
    // opaque, so the stored-sheet probe alone would let the tooth back onto
    // the watercolor. The store must pass the explicit conversion signal.
    expect(storeSource).toMatch(/shouldApplyPaperPass\(\{[\s\S]{0,240}?transmittanceTrackConverted/);
    // One conversion law: the decision is pure and lives outside the store.
    expect(storeSource).toContain('shouldConvertTransmittanceTracks({');
    expect(storeSource).toContain('transmittanceSourceToPigmentAlpha(');
    // The RAW per-track memo must never serve a converting composite: the
    // compositor reads it before the resolve port, which would bypass the
    // converted rasters (hard mask returns).
    expect(storeSource).toContain('trackRasterMemo: convertTransmittanceTracks ? undefined : trackRasterMemo');
  });

  it('U2 _resolveFlattenedFrame threads the liveOverlay into the compositor AT the track slot, before applyPaperPass', () => {
    // studio-multi-track-only-active: the overlay is no longer appended after
    // the composite (which made the selected track always topmost). It rides
    // the compositor's ordered track loop, which still runs BEFORE the pass.
    expect(storeSource).toMatch(/function _resolveFlattenedFrame\([\s\S]*?liveOverlay/);
    expect(storeSource).toMatch(/engineOverlay:\s*liveOverlay[\s\S]{0,160}?trackId/);
    const composite = storeSource.indexOf('const result = compositeFrame(');
    const pass = storeSource.indexOf('applyPaperPass(');
    expect(composite).toBeGreaterThanOrEqual(0);
    expect(pass).toBeGreaterThan(composite);
    expect(compositorSource).toMatch(/engineOverlay/);
    expect(compositorSource).toMatch(/drawImage\(ports\.engineOverlay!\.raster/);
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
