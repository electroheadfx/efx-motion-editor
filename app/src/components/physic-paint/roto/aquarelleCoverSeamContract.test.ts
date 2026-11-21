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
//  What replaces it is the ENGINE'S OWN DAB LAW at the capture seam
//  (2026-11-21, the artist's live-vs-committed report):
//
//    exportCanvas('transparent') — the opaque transmittance sheet (white =
//      no pigment; its alpha is darkness, what the ink gate consumes).
//    exportCanvas('coverage')    — the cover field: the union of every dab's
//      `a`. The engine attenuates the settled paint under a dab by (1 - a)
//      (bristleInk draws 1/1b), so the committed base survives under the
//      session's stroke by exactly (1 - cover).
//
//  The merge (`coverage-composite`) stores
//    t' = t_sheet x t_base^(1 - cover)
//  in linear light — a full-core dab (cover 1) replaces the base, a bristle
//  gap (cover 0) keeps it. Replaying the whole script (the re-render the
//  artist approves) applies the same law; a full transmittance product reads
//  dark, and the old pigment-alpha lerp replaced the base wholesale.
//
//  The `pigment-alpha` law (t' = a*C + (1-a)*t_base) remains for the
//  Roto-owned composites that do not replay the whole script (Lift punches,
//  Apply over group bases); the ordinary paint capture no longer uses it.
//
//  Every absence assertion runs on a comment-stripped copy: a deleted
//  symbol's name may still be explained in prose, never in code.
//
//  Task 3 closes the cross-file loop this plan owns: a brush records and
//  captures like any other stroke, the Lift stays the ONE punch caller, the
//  four punch-architecture root causes are unreachable, the medium record
//  still carries its per-stroke params bag (including `body`), and the mode-4
//  program is the single screen/commit renderer (MED-38, narrowed).
// ============================================================

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
const layer = readFileSync(resolve(__dirname, '../engine/AquarelleCanvasLayer.tsx'), 'utf8');
const mount = readFileSync(resolve(__dirname, '../engine/PhysicsPaintCanvasMount.tsx'), 'utf8');
const baseLayer = readFileSync(resolve(__dirname, '../engine/AquarelleCachedBaseLayer.tsx'), 'utf8');
const bus = readFileSync(resolve(__dirname, './aquarelleLiftPreview.ts'), 'utf8');
const punchLib = readFileSync(resolve(__dirname, './aquarelleLiftErase.ts'), 'utf8');
const record = readFileSync(resolve(__dirname, '../view/aquarelleRecordState.ts'), 'utf8');
const merge = readFileSync(resolve(__dirname, './physicsPaintRotoAlphaMerge.ts'), 'utf8');

/** Strip `//` line comments and block comments; keep code and strings. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/gm, '$1');
}

const studioCode = stripComments(studio);
const layerCode = stripComments(layer);
const mountCode = stripComments(mount);
const baseLayerCode = stripComments(baseLayer);
const busCode = stripComments(bus);
const punchLibCode = stripComments(punchLib);
const recordCode = stripComments(record);
const mergeCode = stripComments(merge);

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

describe('the capture seam stores the multiply of the live sheet and the base', () => {
  it('never exports a second coverage canvas for the merge', () => {
    expect(countOccurrences(studioCode, "exportCanvas('pigment')")).toBe(0);
    expect(studioCode).not.toContain('liveCoverageCanvas');
    expect(studioCode).not.toContain('isFullyOpaqueRaster');
  });

  it('hands the transparent sheet to the merge with the multiply law', () => {
    const call = captureCall();
    // One sheet, one law: the stored format IS the merge input.
    expect(call).toContain('liveAlphaCanvas,');
    expect(call).toContain('cachedBase,');
    expect(call).toContain("mergeBlend: 'coverage-composite',");
    expect(call).toContain('size: { width: canvasWidth, height: canvasHeight },');
    // The alpha-blind gate keeps measuring the transparent transmittance.
    expect(studioCode).toContain('const ink = measureAquarelleCanvasInk(liveAlphaCanvas);');
  });

  it('keeps the save path and the clipboard on the transparent snapshot', () => {
    expect(studioCode).toContain('copyLiveAlphaCanvas: () => aquarelleSnapshotRef.current?.() ?? null,');
    expect(studioCode).toContain('const canvas = aquarelleSnapshotRef.current?.() ?? null;');
    expect(studioCode).toContain("aquarelleEnginePortRef.current?.exportCanvas('transparent') ?? null");
    expect(countOccurrences(studioCode, "exportCanvas('transparent'")).toBe(2);
  });
});

describe('the cover preview and footprint plumbing is gone from the canvas stack', () => {
  it('carries no cover dab channel and no cached-base-applied hook', () => {
    expect(layerCode).not.toContain('onCoverDab');
    expect(mountCode).not.toContain('onCoverDab');
    expect(mountCode).not.toContain('onAquarelleCoverDab');
    expect(studioCode).not.toContain('onAquarelleCoverDab');
    expect(mountCode).not.toContain('onAquarelleCachedBaseApplied');
    expect(studioCode).not.toContain('onAquarelleCachedBaseApplied');
    expect(baseLayerCode).not.toContain('onApplied');
    // The Lift channel and its five-argument dab survive byte-identically.
    expect(layerCode).toContain('onLiftDab?: (x: number, y: number, r: number, amount: number, angle: number) => void;');
    expect(mountCode).toContain(
      'onLiftDab={(x, y, r, amount, angle) => onAquarelleLiftDabRef.current?.(x, y, r, amount, angle)}',
    );
    expect(studioCode).toContain('onAquarelleLiftDab: handleAquarelleLiftDab,');
  });

  it('registers the reset with one argument and still performs both halves', () => {
    expect(layerCode).toContain('onResetSheetReady?: (resetSheet: () => void) => void;');
    expect(layerCode).toContain('onResetSheetReadyRef.current?.(resetSheet);');
    expect(layerCode).not.toContain('onResetSheetReadyRef.current?.(resetSheet,');
    // The reset's implementation stays: session bookkeeping + pixel wipe.
    const resetWindow = slice(
      layerCode,
      'const resetSheet = () => {',
      'onResetSheetReadyRef.current?.(resetSheet);',
    );
    expect(resetWindow).toContain('endSheetSession();');
    expect(resetWindow).toContain('clearSheetPaint();');
    expect(layerCode).not.toContain('strokeGeneration');
    // The mount's prop and forwarding are one-argument too.
    expect(mountCode).toContain('onAquarelleResetSheetReady?: (resetSheet: () => void) => void;');
    expect(mountCode).toContain(
      'onResetSheetReady={(resetSheet) => onAquarelleResetSheetReadyRef.current?.(resetSheet)}',
    );
    expect(mountCode).not.toContain('strokeGeneration');
    // The Studio registers the reset alone and keeps no cover-only ref.
    expect(studioCode).toContain('const handleAquarelleResetSheetReady = useCallback((resetSheet: () => void) => {');
    for (const gone of [
      'aquarelleClearSheetPaintRef',
      'aquarelleEndSheetSessionRef',
      'aquarelleCachedBaseAppliedRef',
      'aquarelleStrokeGenerationRef',
      'handleAquarelleCachedBaseApplied',
    ]) {
      expect(studioCode, `cover-only Studio ref survives: ${gone}`).not.toContain(gone);
    }
    expect(studioCode).toContain('aquarelleResetSheetRef.current = resetSheet;');
  });

  it('keeps the preview bus begin a one-argument call', () => {
    expect(busCode).toContain('begin(frame: number): void;');
    expect(busCode).toContain('export function beginAquarelleLiftPreview(frame: number): void {');
    expect(busCode).toContain('previewSink?.begin(frame);');
    expect(busCode).not.toContain("'deposit'");
    expect(busCode).not.toContain('profile');
    expect(busCode).not.toContain('density');
    expect(baseLayerCode).not.toContain('profileRef');
    expect(baseLayerCode).not.toContain("'deposit'");
    expect(baseLayerCode).toContain('begin(frame) {');
    // The tip shape resolution survives; the cover's deposit shape is gone.
    expect(baseLayerCode).toContain('liftShapeForStroke(selection)');
    expect(baseLayerCode).not.toContain('coverShapeForBrush');
    // One decode per URL, untouched.
    expect(countOccurrences(baseLayerCode, 'image.src = props.url;')).toBe(1);
  });

  it('keeps only the Lift law in the punch library', () => {
    for (const gone of [
      'coverShapeForBrush',
      'CoverBrushSelection',
      'LiftCoverageProfile',
      "'deposit'",
      'density',
      'profile',
      'stampJitterUv',
      'smoothstep01',
    ]) {
      expect(punchLibCode, `deposit plumbing survives: ${gone}`).not.toContain(gone);
    }
    const buildSignature = slice(punchLibCode, 'export function buildLiftCoverage(', '): LiftCoverage {');
    expect(buildSignature).toContain('shape?: LiftFootprintShape,');
    // The tip laws stay byte-identical.
    expect(punchLibCode).toContain(
      'f = one.amount * Math.exp(-(d * d)) * (mask * (1 - LIFT_TIP_ROUND) + LIFT_TIP_ROUND);',
    );
    expect(punchLibCode).toContain('f = one.amount * Math.exp(-(d * d));');
    expect(punchLibCode).toContain('buildLiftCoverage(dabs, width, height, shape);');
    expect(punchLibCode).toContain('punchTransmittanceCanvas(source, dabs, options.shape, stats)');
  });
});

describe('the brush path records then captures and never punches', () => {
  it('orders the ledger allocation, the record and the Lift-only dispatch', () => {
    const handler = strokeEnd();
    const allocate = handler.indexOf('paintMutationLedger.allocateStrokeMutation(');
    const recorded = handler.indexOf(
      'recordAquarelleStrokeWhenEnabled(recordsScript, mutationId, { ...stroke, mutationId }, capturedKeyId);',
    );
    const dispatch = handler.indexOf(
      "if (liftPlan?.kind === 'erase') void runAquarelleLiftErase(liftPlan, stroke, liftGestureDabs);",
    );
    expect(allocate).toBeGreaterThanOrEqual(0);
    expect(recorded).toBeGreaterThan(allocate);
    expect(dispatch).toBeGreaterThan(recorded);
    // A Lift plan exists only for a lift stroke — a brush can never enter a
    // transaction of its own.
    expect(handler).toContain("const liftPlan = stroke.tool === 'lift'");
    // The brush's pixels commit through the ordinary capture, never an inline
    // enqueue at stroke end.
    expect(handler).not.toContain('captureLivePixels(');
    // The record precedes the ordinary capture's enqueue in the source.
    const enqueue = studioCode.indexOf('const work = rotoPersistenceRef.current.captureLivePixels({');
    expect(enqueue).toBeGreaterThan(studioCode.indexOf(
      'recordAquarelleStrokeWhenEnabled(recordsScript, mutationId, { ...stroke, mutationId }, capturedKeyId);',
    ));
  });

  it('pins the punch call sites to the Lift transaction', () => {
    // Five punch calls: the Lift's recover / durable / composite / base /
    // durable re-read legs — every one inside runAquarelleLiftErase.
    expect(countOccurrences(studioCode, 'punchTransmittanceBytes(')).toBe(5);
    expect(countOccurrences(erase(), 'punchTransmittanceBytes(')).toBe(5);
    expect(countOccurrences(punchLibCode, 'export async function punchTransmittanceBytes(')).toBe(1);
  });

  it('keeps every baseCanvas argument on the Lift path and the merge laws named', () => {
    // The only `baseCanvas:` arguments in the Studio are the Lift's two
    // commits; the ordinary capture passes none — its sheet is the stored
    // transmittance, never a punched canvas.
    expect(countOccurrences(studioCode, 'baseCanvas:')).toBe(2);
    expect(countOccurrences(erase(), 'baseCanvas:')).toBe(2);
    expect(captureCall()).not.toContain('baseCanvas');
    // 2026-11-21: the ordinary paint capture stores the transmittance product;
    // the two Lift commits keep the Roto pigment-alpha law (a punch is not a
    // replayed script).
    expect(countOccurrences(studioCode, "mergeBlend: 'pigment-alpha'")).toBe(2);
    expect(countOccurrences(erase(), "mergeBlend: 'pigment-alpha'")).toBe(2);
    // One capture request + its display diagnostic.
    expect(countOccurrences(studioCode, "mergeBlend: 'coverage-composite'")).toBe(2);
    // The post-ack display swap that punched the cached base is unreachable.
    for (const gone of [
      'aquarelleCachedBaseAppliedRef',
      'handleAquarelleCachedBaseApplied',
      'onAquarelleCachedBaseApplied',
    ]) {
      expect(studioCode, `post-ack swap channel survives: ${gone}`).not.toContain(gone);
    }
  });
});

describe('the medium record is unchanged', () => {
  it('records the per-stroke params bag and body like any other param', () => {
    expect(recordCode).toContain('export function snapshotAquarelleRecord(): {');
    expect(recordCode).toContain('params: Record<string, number>;');
    expect(recordCode).toContain('for (const key of AQUARELLE_GLOBAL_KEYS) {');
    expect(recordCode).toContain('params[key] = live[key];');
    // `body` rides the ONE global key list — no special case anywhere.
    const keys = slice(recordCode, 'export const AQUARELLE_GLOBAL_KEYS', '] as const);');
    expect(keys).toContain("'body',");
    expect(recordCode).not.toContain('params.body');
    // The Studio reaches the record through the ordinary stroke-end call.
    expect(studioCode).toContain(
      'recordAquarelleStrokeWhenEnabled(recordsScript, mutationId, { ...stroke, mutationId }, capturedKeyId);',
    );
  });
});

describe('MED-38 (narrowed): one display program, one stored format', () => {
  it('leaves the Studio with no pigment export call site at all', () => {
    expect(countOccurrences(studioCode, "exportCanvas('pigment')")).toBe(0);
  });

  it('keeps the merge module to the three named laws, one conversion each', () => {
    expect(mergeCode).toContain(
      "export type RotoAlphaMergeBlend = 'source-over' | 'pigment-alpha' | 'coverage-composite';",
    );
    expect(mergeCode).toContain("if (blend === 'pigment-alpha' || blend === 'coverage-composite') {");
    expect(mergeCode).toContain("if (blend === 'coverage-composite') {");
    expect(mergeCode).toContain(
      'transmittanceSourceToPigmentAlpha(scriptAlphaCanvas) ?? scriptAlphaCanvas',
    );
    expect(countOccurrences(mergeCode, 'transmittanceSourceToPigmentAlpha(')).toBe(1);
  });

  it('carries no second transmittance-to-pigment conversion in the Studio', () => {
    expect(studioCode).not.toContain('transmittanceSourceToPigmentAlpha');
  });
});
