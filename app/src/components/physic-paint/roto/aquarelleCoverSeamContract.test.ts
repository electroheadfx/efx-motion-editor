// ============================================================
//  aquarelleCoverSeamContract — the cover seam's ABSENCE and the
//  capture sheet split (Phase 64, Spike 001, plan 64-15).
//
//  The rev-4 Body cover PUNCHED the cached base outside the engine:
//
//    engine onCoverDab -> AquarelleCanvasLayer -> PhysicsPaintCanvasMount
//      -> Studio handleAquarelleCoverDab -> beginAquarelleLiftPreview(frame,
//      'deposit') -> buildLiftCoverage(..., 'deposit')
//    stroke end -> planAquarelleCoverErase (mode: 'cover') -> the SAME
//      runAquarelleLiftErase -> punchTransmittanceBytes(...,
//      { profile: 'deposit' }) -> captureLivePixels
//
//  That architecture is gone. 64-13/64-14 gave the engine a pigment
//  coverage channel: a Brush deposit composites INSIDE the pigment layer
//  (`ink <- ink*(1-a) + C*a`, `cover <- cover*(1-a) + a`), and a Lift
//  destroys the same coverage with its own dabs. The app therefore has
//  no cover transaction, no cover dab channel and no deposit footprint —
//  a brush stroke is recorded and settled like any other stroke.
//
//  What replaces it is a SHEET SPLIT at the capture seam. The engine
//  exports two canvases with two different meanings:
//
//    exportCanvas('transparent') — the opaque transmittance sheet. Its
//      alpha is darkness, which is exactly what the alpha-blind ink gate
//      and the stored sheet (`liveAlphaCanvas`) consume.
//    exportCanvas('pigment') — the mode-4 coverage-aware compositor
//      view, whose real alpha is `clamp(max(1 - tMin, cov), 0, 1)`.
//
//  The capture handler exports the coverage sheet eagerly (same turn as
//  the transparent snapshot, before any await) and hands it to the
//  `pigment-alpha` merge while the ink gate keeps measuring the
//  transparent canvas. A blank mode-4 sheet would read as MAXIMUM ink to
//  the transparent gate, so the two canvases can never be swapped.
//
//  The merge converts a fully OPAQUE raster as transmittance (re-deriving
//  the darkness alpha); a real-alpha sheet returns null from
//  transmittanceSourceToPigmentAlpha and is drawn raw, compositing
//  a*C + (1-a)*B over the white-filled base. The capture handler must
//  therefore guard with isFullyOpaqueRaster and fall back to the
//  transparent snapshot when the export is unexpectedly opaque.
//
//  Every absence assertion runs on a comment-stripped copy: a deleted
//  symbol's name may still be explained in prose, never in code.
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
const port = readFileSync(resolve(__dirname, '../engine/aquarelleEnginePort.ts'), 'utf8');

/** Strip `//` line comments and block comments; keep code and strings. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}

const studioCode = stripComments(studio);
const portCode = stripComments(port);

function slice(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

function countOccurrences(source: string, literal: string): number {
  return source.split(literal).length - 1;
}

const strokeEnd = () => slice(
  studioCode,
  'const handleAquarelleStrokeEnd = useCallback(',
  'const handleAquarelleStrokeSettled',
);
/** The whole lift transaction, from its declaration to the stroke-end handler. */
const erase = () => slice(
  studioCode,
  'const runAquarelleLiftErase = useCallback(',
  'const handleAquarelleStrokeEnd = useCallback(',
);
/** The eager coverage export added beside the transparent snapshot. */
const coverageExport = () => slice(
  studioCode,
  'const exportedCoverage',
  'const ink = measureAquarelleCanvasInk(',
);
/** The captureLivePixels argument object (sheet slot included). */
const captureCall = () => slice(
  studioCode,
  'const work = rotoPersistenceRef.current.captureLivePixels({',
  "recordAquarelleRenderSplitEvent('capture-enqueue'",
);

describe('the cover seam is gone from the Studio', () => {
  it('carries none of the deleted cover symbols', () => {
    for (const gone of [
      'planAquarelleCoverErase',
      'handleAquarelleCoverDab',
      'aquarelleCoverPreviewPlanRef',
      'aquarelleCoverGestureDabsRef',
      'coverGestureDabs',
      'coverPlan',
      "mode: 'cover'",
      "mode === 'cover'",
      'AQUARELLE_COVER_FAILURE_MESSAGE',
      "beginAquarelleLiftPreview(frame, 'deposit')",
      "'deposit'",
      'coverShapeForBrush',
    ]) {
      expect(studioCode, `deleted cover symbol survives: ${gone}`).not.toContain(gone);
    }
  });

  it('has exactly the Lift call site and no brush-side runAquarelleLiftErase', () => {
    const handler = strokeEnd();
    expect(countOccurrences(handler, 'runAquarelleLiftErase(')).toBe(1);
    expect(handler).toContain(
      "if (liftPlan?.kind === 'erase') void runAquarelleLiftErase(liftPlan, stroke, liftGestureDabs);",
    );
    expect(handler).not.toContain('runAquarelleLiftErase(cover');
    // The Lift's own once-per-stroke dab capture survives.
    expect(handler).toContain('aquarelleLiftGestureDabsRef.current.splice(0)');
  });
});

describe('the Lift transaction stays the only punch path', () => {
  it('keeps every punchTransmittanceBytes occurrence inside runAquarelleLiftErase', () => {
    const eraseStart = studioCode.indexOf('const runAquarelleLiftErase = useCallback(');
    const eraseEnd = studioCode.indexOf('const handleAquarelleStrokeEnd = useCallback(');
    expect(eraseStart).toBeGreaterThanOrEqual(0);
    expect(eraseEnd).toBeGreaterThan(eraseStart);
    const eraseWindow = erase();
    expect(eraseWindow).toContain('punchTransmittanceBytes(');
    // Outside the transaction there is no punch caller — only the import.
    expect(studioCode.slice(0, eraseStart)).not.toContain('punchTransmittanceBytes(');
    expect(studioCode.slice(eraseEnd)).not.toContain('punchTransmittanceBytes(');
    expect(studioCode).toContain(
      "import { collectLiftDabs, liftShapeForStroke, punchTransmittanceBytes, type LiftDab } from './roto/aquarelleLiftErase';",
    );
  });

  it('keeps the Lift tip-shape resolution and the refusal helpers', () => {
    const eraseWindow = erase();
    expect(eraseWindow).toContain('liftShapeForStroke(stroke)');
    expect(studioCode).toContain('function measureAquarelleCanvasInk(');
    expect(studioCode).toContain('passesAquarelleCaptureInkGate(');
    expect(studioCode).toContain('hasUsableFrameBytes(');
    expect(studioCode).toContain('AQUARELLE_LIFT_FAILURE_MESSAGE');
    expect(studioCode).toContain('AQUARELLE_LIFT_PERMANENT_MESSAGE');
  });
});

describe('the capture seam exports the coverage sheet eagerly', () => {
  it('adds pigment to the export union and exports it through the port ref', () => {
    expect(portCode).toContain(
      "export type AquarelleExportBackground = 'transparent' | 'paper' | 'white' | 'pigment';",
    );
    expect(studioCode).toContain("import { isFullyOpaqueRaster } from '../../lib/rasterAlpha';");
    const window = coverageExport();
    expect(window).toContain("aquarelleEnginePortRef.current?.exportCanvas('pigment')");
    // A real-alpha sheet is the only legal sheet: a fully opaque export is
    // converted as transmittance, so it must fall back to the transparent one.
    expect(window).toContain('!isFullyOpaqueRaster(exportedCoverage)');
    expect(window).toContain(': liveAlphaCanvas');
    expect(countOccurrences(studioCode, "exportCanvas('pigment')")).toBe(1);
  });

  it('hands the coverage canvas to the merge and the transparent one to the ink gate', () => {
    const call = captureCall();
    expect(call).toContain('liveCoverageCanvas,');
    expect(call).not.toContain('liveAlphaCanvas');
    expect(call).toContain('cachedBase,');
    expect(call).toContain("mergeBlend: 'pigment-alpha',");
    expect(call).toContain('size: { width: canvasWidth, height: canvasHeight },');
    // The alpha-blind gate keeps measuring the transparent transmittance.
    expect(studioCode).toContain('const ink = measureAquarelleCanvasInk(liveAlphaCanvas);');
    expect(studioCode).not.toContain('measureAquarelleCanvasInk(liveCoverageCanvas)');
  });

  it('keeps the save path and the clipboard on the transparent snapshot', () => {
    expect(studioCode).toContain('copyLiveAlphaCanvas: () => aquarelleSnapshotRef.current?.() ?? null,');
    expect(studioCode).toContain('const canvas = aquarelleSnapshotRef.current?.() ?? null;');
    expect(studioCode).toContain("aquarelleEnginePortRef.current?.exportCanvas('transparent') ?? null");
    expect(countOccurrences(studioCode, "exportCanvas('transparent'")).toBe(2);
  });
});
