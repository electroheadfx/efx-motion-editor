// ============================================================
//  aquarelleCoverFootprintParity — the Body cover's cached-base
//  punch must erase with the SAME footprint the engine deposits
//  with (quick 261117-tq7, rev 4 UAT round 3).
//
//  The engine stamps through `bodyCoverFS` -> `footprintMask()`:
//
//    * the ACTIVE brush's tip texture (`textureId` plus the recorded
//      `textureRotation`), never the neutral preset tip;
//    * the dry-media re-threshold `th = uRough * 0.45` and the cover's
//      WIDE ramp `smoothstep(th, th + 0.5, t)`;
//    * the per-dab jitter slice (`uJitter` on the GLSL hash of the dab
//      centre) so a rough tip reads a different slice every dab;
//    * the soft square-rim fade `1 - smoothstep(0.82, 1, max(|qx|,
//      |qy|))`, which keeps the underlayer mixing at the outermost rim
//      instead of drawing the dab's contour.
//
//  The punch used to resolve its shape through `liftShapeForStroke`,
//  which forces `textureId: null` (a Lift law, pinned by
//  aquarelleLiftErase.test.ts). Every Body > 0 brush stroke therefore
//  erased the cached base with the neutral procedural tip while the
//  deposit used the textured one: paper-white borders around textured
//  strokes, white gaps between adjacent strokes, white bands across
//  past paint, and hue shifts where the underlayer vanished.
//
//  Declared approximation: the engine's `uGrain`/`uGrainThr` paper-tooth
//  gate samples the GPU paper height, which the punch cannot reach. The
//  punch assumes the whole tooth is reachable (its mask is therefore >=
//  the GPU's). The GLSL hash is evaluated with float32 steps and, like
//  every GPU sin, is not bit-portable; it is deterministic here.
//
//  Pure helpers and Preact-free module stores only — node, no DOM.
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildBrushForStroke,
  registerMask,
  resetMaskRegistry,
  TIP_MASK_BYTES,
} from '@efxlab/efx-watercolor';
import {
  NEUTRAL_TOOL_OVERRIDES,
  type AquarelleTip,
} from '@efxlab/efx-watercolor/brushes';
import {
  buildLiftCoverage,
  coverShapeForBrush,
  liftShapeForStroke,
  type LiftCoverageRect,
  type LiftDab,
  type LiftFootprintShape,
} from './aquarelleLiftErase';
import {
  resetAquarelleBrushCatalog,
  upsertLibraryRow,
} from '../../../stores/aquarelleBrushCatalog';
import {
  aquarelleActiveTool,
  aquarelleBrushForActiveTool,
  aquarelleSelectedTipId,
  resetAquarelleRecordState,
  setAquarelleSelectedTextureId,
} from '../view/aquarelleRecordState';

const studio = readFileSync(resolve(__dirname, '../PhysicsPaintStudio.tsx'), 'utf8');
const baseLayer = readFileSync(resolve(__dirname, '../engine/AquarelleCachedBaseLayer.tsx'), 'utf8');

function slice(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, `missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  expect(end, `missing end marker: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

// ------------------------------------------------------------
//  The shader law, as a reference (shaders.ts `footprintMask()`),
//  so the module is pinned against the GLSL and not against itself.
// ------------------------------------------------------------

function glslSmoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** `fract(sin(dot(uPoint, vec2(12.9898, 78.233))) * 43758.5453)` (highp approx). */
function stampHash(x: number, y: number): { e0: number; e1: number } {
  const dot = Math.fround(Math.fround(x * 12.9898) + Math.fround(y * 78.233));
  const p = Math.fround(Math.fround(Math.sin(dot)) * 43758.5453);
  const e0 = p - Math.floor(p);
  const q = Math.fround(e0 * 63.7264 + 0.37);
  const e1 = q - Math.floor(q);
  return { e0, e1 };
}

/** One bilinear tap on a uv already in 0..1 (GL_LINEAR + CLAMP_TO_EDGE). */
function tipBilinearUv(tipData: Uint8Array, tipSize: number, u: number, v: number): number {
  const fx = u * tipSize - 0.5;
  const fy = v * tipSize - 0.5;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const clampIndex = (i: number): number => (i < 0 ? 0 : i >= tipSize ? tipSize - 1 : i);
  const xa = clampIndex(x0);
  const xb = clampIndex(x0 + 1);
  const ya = clampIndex(y0);
  const yb = clampIndex(y0 + 1);
  const p00 = tipData[ya * tipSize + xa] ?? 0;
  const p10 = tipData[ya * tipSize + xb] ?? 0;
  const p01 = tipData[yb * tipSize + xa] ?? 0;
  const p11 = tipData[yb * tipSize + xb] ?? 0;
  const top = p00 + (p10 - p00) * tx;
  const bottom = p01 + (p11 - p01) * tx;
  return (top + (bottom - top) * ty) / 255;
}

/**
 * `footprintMask()` for the deposit profile, minus the paper-tooth gate
 * (declared approximation: the punch has no paper height). `along`/`across`
 * are the aspect-squeezed tip-space coordinates the module already computed.
 */
function shaderDepositMask(
  shape: LiftFootprintShape,
  along: number,
  across: number,
  x: number,
  y: number,
): number {
  if (Math.abs(along) > 1 || Math.abs(across) > 1) return 0;
  const a = shape.tipRotation ?? 0;
  const tqAlong = along * Math.cos(a) - across * Math.sin(a);
  const tqAcross = along * Math.sin(a) + across * Math.cos(a);
  const { e0, e1 } = stampHash(x, y);
  const jitter = shape.stampJitter ?? 0;
  const u = Math.min(1, Math.max(0, tqAlong * 0.5 + 0.5 + (e0 - 0.5) * jitter));
  const v = Math.min(1, Math.max(0, tqAcross * 0.5 + 0.5 + (e1 - 0.5) * jitter));
  const tip = tipBilinearUv(shape.tipData, shape.tipSize, u, v);
  const th = (shape.roughness ?? 0) * 0.45;
  const ramp = glslSmoothstep(th, th + 0.5, tip);
  const rim = 1 - glslSmoothstep(0.82, 1, Math.max(Math.abs(along), Math.abs(across)));
  return ramp * rim;
}

function depositFraction(dab: LiftDab, mask: number): number {
  return dab.density !== undefined && dab.density > 0
    ? dab.amount * (1 - Math.exp(-dab.density * mask))
    : dab.amount * mask;
}

function coverageAt(
  coverage: Float32Array,
  rect: LiftCoverageRect,
  x: number,
  y: number,
): number {
  if (x < rect.x || x >= rect.x + rect.width || y < rect.y || y >= rect.y + rect.height) return 1;
  return coverage[(y - rect.y) * rect.width + (x - rect.x)]!;
}

function shapeOf(
  overrides: Partial<LiftFootprintShape> & { tipData: Uint8Array; tipSize: number },
): LiftFootprintShape {
  return { aspect: 1, angle: 0, rotation: 'fixed', ...overrides };
}

/** A 2x2 tip whose LEFT texel column is full and right column empty. */
function halfTip(): LiftFootprintShape {
  return shapeOf({
    tipData: new Uint8Array([255, 0, 255, 0]),
    tipSize: 2,
    roughness: 0,
    stampJitter: 0,
    tipRotation: 0,
  });
}

// ------------------------------------------------------------
//  coverShapeForBrush — the resolution seam
// ------------------------------------------------------------

const TEXTURE_ID = 'wc/custom-cover-parity';
const EDGE = 512;
const TEXTURE_MASK = (() => {
  const mask = new Uint8Array(TIP_MASK_BYTES);
  for (let y = 0; y < EDGE; y += 1) {
    for (let x = 0; x < EDGE; x += 1) mask[y * EDGE + x] = (x * 3 + y * 5) % 256;
  }
  return mask;
})();
const RESPONSE_ID = 'chalk';

beforeEach(() => {
  resetMaskRegistry();
  resetAquarelleBrushCatalog();
  resetAquarelleRecordState();
  registerMask(TEXTURE_ID, TEXTURE_MASK);
  aquarelleActiveTool.value = 'brush';
  aquarelleSelectedTipId.value = RESPONSE_ID;
  setAquarelleSelectedTextureId(null);
});

describe('coverShapeForBrush resolves the DEPOSIT footprint', () => {
  it('binds the recorded texture, its rotation and the dry/jitter knobs', () => {
    const selection = {
      brushId: RESPONSE_ID,
      textureId: TEXTURE_ID,
      textureRotation: 90,
      toolOverrides: NEUTRAL_TOOL_OVERRIDES,
    };
    const shape = coverShapeForBrush(selection);
    const brush = buildBrushForStroke(RESPONSE_ID, {
      textureId: TEXTURE_ID,
      textureRotation: 90,
      overrides: NEUTRAL_TOOL_OVERRIDES,
    });
    expect(shape.tipSize).toBe(brush.tipSize);
    expect(Array.from(shape.tipData)).toEqual(Array.from(brush.tipData));
    expect(shape.tipRotation).toBeCloseTo(Math.PI / 2, 12);
    expect(shape.roughness).toBeCloseTo(brush.roughness, 12);
    expect(shape.stampJitter).toBeCloseTo(brush.stampJitter, 12);
    expect(shape.aspect).toBeCloseTo(brush.aspect, 9);
    expect(shape.angle).toBeCloseTo(brush.angle * (Math.PI / 180), 9);
    expect(shape.rotation).toBe(brush.rotation);

    // The Lift resolution stays the NEUTRAL tip (its own pinned law): the
    // cover must not resolve through it.
    const lift = liftShapeForStroke(selection);
    expect(Array.from(lift.tipData)).not.toEqual(Array.from(shape.tipData));
  });

  it('falls back to the procedural tip and zero rotation when no mask resolves', () => {
    const shape = coverShapeForBrush({
      brushId: 'round',
      textureId: 'wc/custom-never-registered',
      textureRotation: 90,
      toolOverrides: NEUTRAL_TOOL_OVERRIDES,
    });
    const plain = buildBrushForStroke('round', {
      textureId: null,
      overrides: NEUTRAL_TOOL_OVERRIDES,
    });
    expect(Array.from(shape.tipData)).toEqual(Array.from(plain.tipData));
    // An unresolved texture carries no rotation anywhere downstream.
    expect(shape.tipRotation).toBe(0);
    expect(shape.roughness).toBeCloseTo(plain.roughness, 12);
    expect(shape.stampJitter).toBeCloseTo(plain.stampJitter, 12);
  });

  it('resolves an untextured brush from its response alone', () => {
    const shape = coverShapeForBrush({
      brushId: 'round',
      toolOverrides: NEUTRAL_TOOL_OVERRIDES,
    });
    const plain = buildBrushForStroke('round', { overrides: NEUTRAL_TOOL_OVERRIDES });
    expect(Array.from(shape.tipData)).toEqual(Array.from(plain.tipData));
    expect(shape.tipRotation).toBe(0);
  });

  it('the live selection carries the library row rotation the preview must use', () => {
    // quick 261116-inu: the library row is only the default for the NEXT
    // stroke — but the cover preview has no recorded stroke, so its shape
    // must resolve through the SAME selection the live engine brush binds.
    const tip: AquarelleTip = {
      id: TEXTURE_ID,
      category: 'custom',
      name: 'cover parity row',
      ...NEUTRAL_TOOL_OVERRIDES,
    };
    upsertLibraryRow({ tip, digest: 'ab'.repeat(32), textureRotation: 37 });
    setAquarelleSelectedTextureId(TEXTURE_ID);
    const selection = aquarelleBrushForActiveTool();
    expect(selection.textureId).toBe(TEXTURE_ID);
    expect(selection.textureRotation).toBe(37);
  });
});

// ------------------------------------------------------------
//  The deposit profile mirrors footprintMask()
// ------------------------------------------------------------

describe('the deposit profile mirrors the shader mask', () => {
  it('matches a reference port of footprintMask over a rotated, jittered grid', () => {
    const width = 160;
    const height = 160;
    const pattern = new Uint8Array(64);
    for (let y = 0; y < 8; y += 1) {
      for (let x = 0; x < 8; x += 1) {
        pattern[y * 8 + x] = Math.round(255 * (0.15 + (0.8 * ((x + y) % 8)) / 7));
      }
    }
    const shape = shapeOf({
      tipData: pattern,
      tipSize: 8,
      aspect: 1.5,
      tipRotation: 0.7,
      roughness: 0.35,
      stampJitter: 0.12,
    });
    const dabs: LiftDab[] = [
      { x: 0.45, y: 0.55, r: 0.12, amount: 0.9, angle: 0.3, density: 0.8 },
      { x: 0.55, y: 0.5, r: 0.1, amount: 0.7, angle: -0.4, density: 0.5 },
    ];
    const { coverage, coverageRect } = buildLiftCoverage(dabs, width, height, shape, 'deposit');

    let worst = 0;
    let inside = 0;
    for (let y = coverageRect.y; y < coverageRect.y + coverageRect.height; y += 1) {
      for (let x = coverageRect.x; x < coverageRect.x + coverageRect.width; x += 1) {
        let expected = 1;
        for (const dab of dabs) {
          const dx = x - dab.x * width;
          const dyUp = (1 - dab.y) * height - y;
          const rPx = Math.max(1, dab.r * height);
          const angle = dab.angle ?? 0;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const along = (dx * cos + dyUp * sin) / rPx;
          const across = ((-dx * sin + dyUp * cos) / rPx) / shape.aspect;
          const mask = shaderDepositMask(shape, along, across, dab.x, dab.y);
          expected *= 1 - depositFraction(dab, mask);
        }
        const actual = coverageAt(coverage, coverageRect, x, y);
        worst = Math.max(worst, Math.abs(actual - expected));
        if (expected < 0.999) inside += 1;
      }
    }
    // float32 storage rounds each stored K by up to ~6e-8.
    expect(worst, 'worst deviation from the shader port').toBeLessThan(1e-6);
    // The comparison is not vacuous: a real part of the rect is affected.
    expect(inside).toBeGreaterThan(500);
  });

  it('fades the erase at the tip square rim instead of drawing a hard contour', () => {
    const width = 200;
    const height = 200;
    const shape = shapeOf({
      tipData: new Uint8Array([255]),
      tipSize: 1,
      roughness: 0,
      stampJitter: 0,
      tipRotation: 0,
    });
    const dab: LiftDab = { x: 0.5, y: 0.5, r: 0.1, amount: 1, angle: 0 };
    const { coverage, coverageRect } = buildLiftCoverage([dab], width, height, shape, 'deposit');
    const rimAt = (q: number) => 1 - glslSmoothstep(0.82, 1, q);
    // Along the flat edge at 0.95 of the square, only the rim survives.
    const edge = coverageAt(coverage, coverageRect, 119, 100);
    const expectedEdge = 1 - (1 * rimAt(0.95));
    expect(edge).toBeCloseTo(expectedEdge, 6);
    expect(expectedEdge).toBeLessThan(0.82);
    // A diagonal at the same distance is also inside the square.
    expect(coverageAt(coverage, coverageRect, 119, 119)).toBeCloseTo(1 - rimAt(0.95), 6);
    // At 0.75 the rim has not started: the cover is total (amount 1).
    expect(coverageAt(coverage, coverageRect, 115, 115)).toBeCloseTo(0, 6);
    // At 0.82 the fade begins exactly; just past the cull nothing is erased.
    expect(coverageAt(coverage, coverageRect, 121, 100)).toBe(1);
  });

  it('applies the WIDE cover ramp at roughness 0 (a soft tip still erases)', () => {
    const width = 100;
    const height = 100;
    // A 1x1 tip of value 64: the bilinear tap reads 64/255 = 0.25098.
    const shape = shapeOf({
      tipData: new Uint8Array([64]),
      tipSize: 1,
      roughness: 0,
      stampJitter: 0,
      tipRotation: 0,
    });
    const dab: LiftDab = { x: 0.5, y: 0.5, r: 0.2, amount: 0.8, angle: 0 };
    const { coverage, coverageRect } = buildLiftCoverage([dab], width, height, shape, 'deposit');
    const tip = 64 / 255;
    const ramp = glslSmoothstep(0, 0.5, tip);
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo(1 - 0.8 * ramp, 6);
  });

  it('re-thresholds a rough tip at roughness * 0.45 and samples the ramp', () => {
    const width = 100;
    const height = 100;
    // The 2x2 half tip taps 0.5 at the centre; roughness 0.5 moves the low
    // cut to 0.225, so the mask is the ramp at 0.5, not the raw 0.5.
    const shape = shapeOf({ ...halfTip(), roughness: 0.5 });
    const dab: LiftDab = { x: 0.5, y: 0.5, r: 0.2, amount: 0.8, angle: 0, density: 1 };
    const { coverage, coverageRect } = buildLiftCoverage([dab], width, height, shape, 'deposit');
    const ramp = glslSmoothstep(0.225, 0.725, 0.5);
    expect(ramp).toBeCloseTo(0.57475, 9);
    const expected = 1 - 0.8 * (1 - Math.exp(-ramp));
    expect(coverageAt(coverage, coverageRect, 50, 50)).toBeCloseTo(expected, 6);
  });

  it('rotates the tip sampling by textureRotation without turning the silhouette', () => {
    const width = 200;
    const height = 200;
    const dab: LiftDab = { x: 0.5, y: 0.5, r: 0.1, amount: 1, angle: 0 };
    const upright = buildLiftCoverage([dab], width, height, halfTip(), 'deposit');
    const turned = buildLiftCoverage(
      [dab],
      width,
      height,
      { ...halfTip(), tipRotation: Math.PI / 2 },
      'deposit',
    );
    // (115, 85) sits ABOVE the centre (doc y is up): along = 0.75,
    // across = +0.75. Unrotated it samples the EMPTY right texel column;
    // rotated 90 degrees the tip-space x becomes -across, so it samples the
    // FULL left column (the discard square still culls on the unrotated q).
    expect(coverageAt(upright.coverage, upright.coverageRect, 115, 85)).toBe(1);
    expect(coverageAt(turned.coverage, turned.coverageRect, 115, 85)).toBeCloseTo(0, 6);
    // Mirrored below the centre the rotation samples the empty column again:
    // the sample point moves, the silhouette does not.
    expect(coverageAt(turned.coverage, turned.coverageRect, 115, 115)).toBe(1);
    // The silhouette did not turn: (121, 100) is outside the square either way.
    expect(coverageAt(turned.coverage, turned.coverageRect, 121, 100)).toBe(1);
  });

  it('shifts the sampled tip slice per dab through the stamp jitter', () => {
    const width = 200;
    const height = 200;
    // A horizontal gradient: columns read 0, 85, 170, 255.
    const gradient = new Uint8Array(16);
    for (let y = 0; y < 4; y += 1) {
      for (let x = 0; x < 4; x += 1) gradient[y * 4 + x] = x * 85;
    }
    const jittered = shapeOf({
      tipData: gradient,
      tipSize: 4,
      roughness: 0,
      stampJitter: 0.6,
      tipRotation: 0,
    });
    const flat = { ...jittered, stampJitter: 0 };
    // Pick two dab centres whose jitter hashes differ enough to land on
    // different gradient columns.
    const e0At = (x: number) => stampHash(x, 0.5).e0;
    let pair: [number, number] | null = null;
    for (let i = 0; i < 30 && pair === null; i += 1) {
      for (let j = 0; j < 30; j += 1) {
        const a = 0.2 + i * 0.02;
        const b = 0.2 + j * 0.02;
        if (Math.abs(e0At(a) - e0At(b)) > 0.4) {
          pair = [a, b];
          break;
        }
      }
    }
    expect(pair, 'found a jitter-separated pair').not.toBeNull();
    const [ax, bx] = pair!;
    const centre = (x: number) => [Math.round(x * width), Math.round((1 - 0.5) * height)] as const;

    const one = buildLiftCoverage(
      [{ x: ax, y: 0.5, r: 0.15, amount: 1, angle: 0 }],
      width,
      height,
      jittered,
      'deposit',
    );
    const two = buildLiftCoverage(
      [{ x: bx, y: 0.5, r: 0.15, amount: 1, angle: 0 }],
      width,
      height,
      jittered,
      'deposit',
    );
    const [xa, ya] = centre(ax);
    const [xb, yb] = centre(bx);
    const first = coverageAt(one.coverage, one.coverageRect, xa, ya);
    const second = coverageAt(two.coverage, two.coverageRect, xb, yb);
    expect(Math.abs(first - second)).toBeGreaterThan(0.05);

    // Without jitter the same two dabs sample the same slice.
    const flatOne = buildLiftCoverage(
      [{ x: ax, y: 0.5, r: 0.15, amount: 1, angle: 0 }],
      width,
      height,
      flat,
      'deposit',
    );
    const flatTwo = buildLiftCoverage(
      [{ x: bx, y: 0.5, r: 0.15, amount: 1, angle: 0 }],
      width,
      height,
      flat,
      'deposit',
    );
    expect(coverageAt(flatOne.coverage, flatOne.coverageRect, xa, ya)).toBeCloseTo(
      coverageAt(flatTwo.coverage, flatTwo.coverageRect, xb, yb),
      6,
    );
  });
});

// ------------------------------------------------------------
//  The seams that bind the law
// ------------------------------------------------------------

describe('the cover punches through the deposit shape', () => {
  it('the stroke-end transaction resolves coverShapeForBrush in cover mode only', () => {
    expect(studio).toContain(
      "const shape = mode === 'cover' ? coverShapeForBrush(stroke) : liftShapeForStroke(stroke);",
    );
    expect(studio).toContain('coverShapeForBrush');
  });

  it('the live preview resolves the shape by profile in begin', () => {
    const begin = slice(baseLayer, 'begin(frame, profile) {', 'dab(dab) {');
    expect(begin).toContain("profileRef.current === 'deposit'");
    expect(begin).toContain('? coverShapeForBrush(selection)');
    expect(begin).toContain(': liftShapeForStroke(selection);');
  });

  it('a blank live sheet fails the cover closed instead of committing the punch', () => {
    const coverBranch = slice(studio, "if (mode === 'cover') {", 'if (plan.scripted) {');
    expect(coverBranch).toContain('measureAquarelleCanvasInk(sheet)');
    expect(coverBranch).toContain('passesAquarelleCaptureInkGate(coverInk)');
    expect(coverBranch).toContain("stage: 'cover-blank-live-sheet'");
    // The guard runs BEFORE either base is punched: no erase can be
    // committed without the stroke's own paint on the live sheet.
    expect(coverBranch.indexOf('passesAquarelleCaptureInkGate(coverInk)')).toBeLessThan(
      coverBranch.indexOf('punchTransmittanceBytes('),
    );
  });
});
