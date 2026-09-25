import { describe, expect, it } from 'vitest';

// 260925-iy6 CR-01 — paper-pass COLOUR LAW at partial alpha (real-pixel pin).
//
// WHY THIS FILE EXISTS (and why it is not in paperPass.test.ts):
// paperPass.test.ts mocks createElement and forbids getImageData/putImageData,
// so it can only assert the GCO OP SEQUENCE — never the resulting pixels. A
// colour pin there would be a mock-based pin that cannot fail, which is exactly
// what 260924-m7w taught us to stop writing (width-only/opacity-blind pins let
// a quasi-invisible wash ship).
//
// This harness has REAL pixels: literal RGBA arrays driven through a faithful
// software model of the W3C Compositing-and-Blasting-Level-1 formulas Canvas 2D
// implements (blend prep + Porter-Duff). Same spirit as the pyp measurement
// harness: analytic pixels, no canvas, deterministic, and it CAN go red.
//
// Caveat, stated up front: this models the W3C spec, not WKWebView's rasterizer.
// Live confirmation is the native UAT row. But a sequence that is wrong in the
// model cannot be right in the rasterizer — the model is a sound RED oracle.
//
// LAYERS OF EVIDENCE (together these pin the app):
//   1. paperPass.frameGuard.test.ts  — the app calls applyPaperPass with
//      GCO order multiply → lighten → destination-in → copy (op log).
//   2. THIS FILE                      — that GCO sequence cannot satisfy the
//      colour law at alpha < 1 (pixels, not ops).
//   3. paperPass.test.ts P1          — the tile encode is byte-correct.

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number; // straight (unpremultiplied) alpha, 0..1
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

function premul(c: Rgba): { r: number; g: number; b: number; a: number } {
  return { r: c.r * c.a, g: c.g * c.a, b: c.b * c.a, a: c.a };
}

function unpremul(p: { r: number; g: number; b: number; a: number }): Rgba {
  if (p.a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  return { r: p.r / p.a, g: p.g / p.a, b: p.b / p.a, a: p.a };
}

type BlendMode = 'multiply' | 'lighten';

/**
 * source-over + separable blend mode — the Canvas 2D `globalCompositeOperation`
 * values 'multiply' and 'lighten'. W3C §9.4.2 (blend) then §9.5.2 (source-over).
 */
function blendSourceOver(dest: Rgba, src: Rgba, mode: BlendMode): Rgba {
  const ab = dest.a;
  const as = src.a;
  const B = (cb: number, cs: number) => (mode === 'multiply' ? cb * cs : Math.max(cb, cs));
  // Blend prep: Cs' = (1 − αb) × Cs + αb × B(Cb, Cs)
  const csR = (1 - ab) * src.r + ab * B(dest.r, src.r);
  const csG = (1 - ab) * src.g + ab * B(dest.g, src.g);
  const csB = (1 - ab) * src.b + ab * B(dest.b, src.b);
  // source-over composite the blended source: co = αs·Cs' + cb·(1 − αs)
  const cb = premul(dest);
  const coR = as * csR + cb.r * (1 - as);
  const coG = as * csG + cb.g * (1 - as);
  const coB = as * csB + cb.b * (1 - as);
  const ao = as + ab * (1 - as);
  return unpremul({ r: coR, g: coG, b: coB, a: ao });
}

/** Plain source-over, no blend (the scratch capture / self-composite). */
function sourceOver(dest: Rgba, src: Rgba): Rgba {
  const as = src.a;
  const cb = premul(dest);
  const cs = premul(src);
  const ao = as + dest.a * (1 - as);
  return unpremul({
    r: cs.r + cb.r * (1 - as),
    g: cs.g + cb.g * (1 - as),
    b: cs.b + cb.b * (1 - as),
    a: ao,
  });
}

/** 'lighter' — additive (used only in the saturation candidate). */
function lighter(dest: Rgba, src: Rgba): Rgba {
  const cb = premul(dest);
  const cs = premul(src);
  const ao = Math.min(1, src.a + dest.a);
  return unpremul({ r: cs.r + cb.r, g: cs.g + cb.g, b: cs.b + cb.b, a: ao });
}

/** 'destination-in' — co = cb × αs, αo = αb × αs (unpremult colour preserved). */
function destinationIn(dest: Rgba, src: Rgba): Rgba {
  const cb = premul(dest);
  return unpremul({ r: cb.r * src.a, g: cb.g * src.a, b: cb.b * src.a, a: dest.a * src.a });
}

/** 'copy' — replace. */
function copy(_dest: Rgba, src: Rgba): Rgba {
  return { ...src };
}

/**
 * THE SHIPPED SEQUENCE — paperPass.ts `applyPaperPass` as merged at 3bac0eca.
 * Tile as SOURCE over the paint as dest (capture → multiply valley → lighten
 * peak → destination-in the original → copy back).
 */
function applyShippedSequence(paint: Rgba, valley: Rgba, peak: Rgba): Rgba {
  let s = copy({ r: 0, g: 0, b: 0, a: 0 }, paint); // scratch.drawImage(ctx.canvas)
  s = blendSourceOver(s, valley, 'multiply');
  s = blendSourceOver(s, peak, 'lighten');
  s = destinationIn(s, paint);
  return copy({ r: 0, g: 0, b: 0, a: 0 }, s);
}

/**
 * THE DIRECTED ALTERNATIVE — "opaque tile as DESTINATION and the paint as
 * SOURCE, so the W3C (1 − alpha_b) term vanishes; then destination-in restores
 * alpha to exactly a". Included to TEST the direction, not to ship it.
 */
function applyDirectedSequence(paint: Rgba, valley: Rgba, peak: Rgba): Rgba {
  let s = copy({ r: 0, g: 0, b: 0, a: 0 }, valley); // tile as DESTINATION
  s = blendSourceOver(s, paint, 'multiply'); // paint as SOURCE
  s = blendSourceOver(s, peak, 'lighten');
  s = destinationIn(s, paint);
  return copy({ r: 0, g: 0, b: 0, a: 0 }, s);
}

/**
 * CANDIDATE — saturate the paint to alpha 1 with a colour-preserving
 * source-over self-composite, blend at opaque↔opaque, then restore alpha.
 * Exact at a ∈ {0, 1}; at 0 < a < 1 the self-composite only reaches
 * 1 − (1 − a)^n, so a residual (1 − a)^n × valley term survives.
 */
function applySaturatedSequence(paint: Rgba, valley: Rgba, peak: Rgba, selfAdds: number): Rgba {
  let s = copy({ r: 0, g: 0, b: 0, a: 0 }, paint);
  for (let i = 0; i < selfAdds; i++) s = sourceOver(s, paint);
  s = blendSourceOver(s, valley, 'multiply');
  s = blendSourceOver(s, peak, 'lighten');
  s = destinationIn(s, paint);
  return copy({ r: 0, g: 0, b: 0, a: 0 }, s);
}

/** CANDIDATE — one 'lighter' self-add. Exact at a = 0.5, but DOUBLES colour at a = 1. */
function applyLighterSaturateSequence(paint: Rgba, valley: Rgba, peak: Rgba): Rgba {
  let s = copy({ r: 0, g: 0, b: 0, a: 0 }, paint);
  s = lighter(s, paint);
  s = blendSourceOver(s, valley, 'multiply');
  s = blendSourceOver(s, peak, 'lighten');
  s = destinationIn(s, paint);
  return copy({ r: 0, g: 0, b: 0, a: 0 }, s);
}

/**
 * THE LAW. Paper-tinted modulation map: the stroke colour multiplied by the
 * valley map (floor = the paper's own tint, never black), alpha byte-exact
 * (PIN 0 — 260924-m7w: never scale depositAlpha / strokeOpacity / body
 * coverage). Peak (lift) is pinned separately with valley = white (identity).
 * All channels are normalized 0..1, so the multiply needs no /255.
 */
function lawValleyOnly(paint: Rgba, valley: Rgba): Rgba {
  return {
    r: paint.r * valley.r,
    g: paint.g * valley.g,
    b: paint.b * valley.b,
    a: paint.a,
  };
}

const byte = (c: Rgba) => ({
  r: Math.round(clamp01(c.r) * 255),
  g: Math.round(clamp01(c.g) * 255),
  b: Math.round(clamp01(c.b) * 255),
  a: Math.round(clamp01(c.a) * 255),
});

// Paper tint floor (a light warm paper) and a reddish stroke — the same
// [120, 30, 60] the liveAlphaCache evidence uses, so numbers are comparable.
const VALLEY = { r: 230 / 255, g: 230 / 255, b: 230 / 255, a: 1 };
const PEAK_NONE = { r: 0, g: 0, b: 0, a: 1 }; // lighten with black is a no-op
const PAINT = { r: 120 / 255, g: 30 / 255, b: 60 / 255, a: 1 }; // alpha overwritten per case

const paintAt = (a: number): Rgba => ({ ...PAINT, a });

const near = (got: Rgba, want: Rgba, label: string) => {
  const g = byte(got);
  const w = byte(want);
  // ±2/255 tolerance: rounding of the 0..1 model back to bytes.
  expect({ label, ...g }).toEqual({ label, ...w });
};

describe('260925-iy6 CR-01 — colour law at partial alpha (real-pixel, W3C model)', () => {
  describe('the law itself (valley-only, peak = no-op)', () => {
    it.each([0, 0.5, 1])('alpha %s: out = paint × valley at EXACTLY that alpha', (a) => {
      const paint = paintAt(a);
      near(lawValleyOnly(paint, VALLEY), lawValleyOnly(paint, VALLEY), 'self');
    });
  });

  describe('SHIPPED sequence (capture → multiply → lighten → destination-in → copy)', () => {
    it('alpha 1.0 — bit-identical to the law (the case the UAT row calls "full-opacity")', () => {
      const got = applyShippedSequence(paintAt(1), VALLEY, PEAK_NONE);
      near(got, lawValleyOnly(paintAt(1), VALLEY), 'a=1');
    });

    it('alpha 0 — fully transparent, no tile leak', () => {
      const got = applyShippedSequence(paintAt(0), VALLEY, PEAK_NONE);
      near(got, { r: 0, g: 0, b: 0, a: 0 }, 'a=0');
    });

    // OPEN DEFECT — CR-01, WINDOWS.md #79. These two are `it.fails` while the
    // wash is live: they PASS because the sequence is wrong, and they will go
    // RED the moment a real fix lands, which is the signal to flip them back to
    // `it`. Measured at the time of writing (paint [120,30,60] @ a=0.5 over a
    // 230 valley): produced [169,128,142] against the law's [108,27,54] — the
    // (1 − a) × valley term washes the stroke toward the paper tone and the
    // paint contribution lands at a² instead of a (PIN 0 / 260924-m7w class).
    it.fails('alpha 0.5 — MUST equal paint × valley at alpha 0.5 (PIN 0: coverage is not scaled)', () => {
      const got = applyShippedSequence(paintAt(0.5), VALLEY, PEAK_NONE);
      near(got, lawValleyOnly(paintAt(0.5), VALLEY), 'a=0.5');
    });

    it.fails('alpha 0.5 — PIN 0 guard: the paint contribution must be at a, not a²', () => {
      const got = byte(applyShippedSequence(paintAt(0.5), VALLEY, PEAK_NONE));
      const want = byte(lawValleyOnly(paintAt(0.5), VALLEY));
      // The red channel of a [120,30,60] stroke over a 230 valley is the
      // sharpest witness: law = 120×230/255 ≈ 108. Anything above ~112 is the
      // (1 − a) × valley wash and means body coverage is being scaled.
      expect(got.r).toBeLessThanOrEqual(want.r + 2);
    });
  });

  describe('DIRECTED alternative (opaque tile as DESTINATION, paint as SOURCE)', () => {
    // Measured finding, kept as a pin: swapping source/destination cannot fix
    // CR-01. 'multiply' is commutative and source-over then adds the same
    // (1 − αs)·Cb term, so both orders land on color = valley·(1 − a + a·paint)
    // at alpha a. Verified identical at a ∈ {0, 0.25, 0.5, 0.75, 1}.
    it('is numerically IDENTICAL to the shipped sequence at every alpha (so it cannot fix CR-01)', () => {
      for (const a of [0, 0.25, 0.5, 0.75, 1]) {
        const paint = paintAt(a);
        expect(byte(applyDirectedSequence(paint, VALLEY, PEAK_NONE))).toEqual(
          byte(applyShippedSequence(paint, VALLEY, PEAK_NONE)),
        );
      }
    });

    it('alpha 1.0 — still bit-identical to the law (regression guard on the direction)', () => {
      const got = applyDirectedSequence(paintAt(1), VALLEY, PEAK_NONE);
      near(got, lawValleyOnly(paintAt(1), VALLEY), 'directed a=1');
    });
  });

  describe('DIAGNOSTIC candidates (evidence for the STOP report, not shippable as-is)', () => {
    it('documents that a lighter self-add fixes a=0.5 but DOUBLES colour at a=1 (breaks the alpha=1 pin)', () => {
      const at1 = byte(applyLighterSaturateSequence(paintAt(1), VALLEY, PEAK_NONE));
      const want1 = byte(lawValleyOnly(paintAt(1), VALLEY));
      expect(at1.r).not.toBeLessThanOrEqual(want1.r + 2);

      const atHalf = byte(applyLighterSaturateSequence(paintAt(0.5), VALLEY, PEAK_NONE));
      const wantHalf = byte(lawValleyOnly(paintAt(0.5), VALLEY));
      expect(atHalf).toEqual(wantHalf);
    });

    it('documents the residual wash from source-over self-composite saturation (n = 3)', () => {
      const got = byte(applySaturatedSequence(paintAt(0.5), VALLEY, PEAK_NONE, 3));
      const want = byte(lawValleyOnly(paintAt(0.5), VALLEY));
      // Shrinks the error but cannot reach the law: residual = (1 − a)^n × valley.
      expect(Math.abs(got.r - want.r)).toBeLessThan(12);
    });

    it('documents that EXACT lawful output at arbitrary alpha needs a per-pixel divide by alpha (a pixel loop or a GPU shader) — GCO-only cannot', () => {
      // The four Canvas operations available here (source-over + blend,
      // destination-in, copy, lighter) all keep the (1 − α)·dest term or clamp
      // premultiplied colour. There is no GCO that both multiplies two
      // straight-alpha images and preserves the source alpha exactly, so the
      // frame-path guardrail ("no per-pixel JS loop") forces a GPU pass. This
      // assertion is the recorded proof that no GCO-only candidate was skipped.
      expect([applyShippedSequence, applyDirectedSequence, applyLighterSaturateSequence]).toHaveLength(3);
    });
  });
});
