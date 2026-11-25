// ============================================================
//  shaders — the tip-rotation uniform (quick 261116-inu / Task 10).
//
//  The rotation turns the TEXTURE INSIDE the footprint, never the
//  footprint itself: both fragment shaders rotate the TIP-SPACE
//  sampling coordinates and keep the silhouette, the discard and the
//  radial envelope on the UNROTATED `q`. That distinction is invisible
//  to any test without a WebGL context, so it is pinned at the source.
// ============================================================

import { describe, expect, it } from 'vitest'
import { displayFS, displayLayerFS, liftFS, stampFS } from './shaders'
import * as shaderModule from './shaders'
import { displayBasisFnGLSL, displayBasisGLSL, STROKE_LAYER_BANDS } from './spectral'

const ROTATION_FORMULA = 'vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));'

describe('tip rotation uniform (quick 261116-inu / Task 10)', () => {
  it('declares uTipRotation in BOTH the stamp and the lift shader', () => {
    expect(stampFS).toContain('uniform float uTipRotation;')
    expect(liftFS).toContain('uniform float uTipRotation;')
  })

  it('stampFS rotates the sampled tip UV and keeps the discard on the unrotated q', () => {
    expect(stampFS).toContain(ROTATION_FORMULA)
    const rotateAt = stampFS.indexOf('vec2 tq =')
    const discardAt = stampFS.indexOf('if (abs(q.x) > 1.0 || abs(q.y) > 1.0) discard;')
    expect(discardAt, 'the silhouette test stays on q').toBeGreaterThan(rotateAt)
    // The sampled coordinate is the rotated one; the discard never mentions it.
    expect(stampFS).toContain('clamp(tq * 0.5 + 0.5')
    expect(stampFS).not.toContain('abs(tq.x)')
  })

  it('liftFS rotates its sampled UV and keeps the envelope on the unrotated q', () => {
    expect(liftFS).toContain(ROTATION_FORMULA)
    expect(liftFS).toContain('texture(uTip, clamp(tq * 0.5 + 0.5, 0.0, 1.0)).r')
    expect(liftFS).toContain('exp(-pow(dot(q, q), 2.0))')
    expect(liftFS).not.toContain('dot(tq, tq)')
  })

  it('liftFS keeps THE tip-shaped erase for Lift, with no cover profile of its own', () => {
    expect(liftFS).toContain('uniform float uAspect, uRadius, uAmount, uTipAspect, uRound;')
    expect(liftFS).toContain(
      'float f = uAmount * exp(-pow(dot(q, q), 2.0)) * mix(t, 1.0, uRound);',
    )
    // The Body cover has its own program (bodyCoverFS); Lift must not grow a
    // second mask branch again.
    expect(liftFS).not.toContain('uCover')
    expect(liftFS).not.toContain('smoothstep(0.35')
  })
})

// ============================================================
//  SPIKE 001 — the coverage composite shaders.
//
//  The per-dab coverage term is `a = coverAmount * (1 - exp(-K * amount * m))`
//  with K the medium's pigment-independent density: `coverDepositFS` adds
//  `C * a` after the caller attenuates the mobile ink, `coverMaskFS` unions
//  `a` into the coverage channel, and `displayFS` mode 4 reads that channel
//  as the compositor's alpha. The rev-4 `inkCoverFS` subtraction is gone.
// ============================================================
describe('coverage composite shaders (SPIKE 001)', () => {
  const exports = shaderModule as Record<string, unknown>

  it('declares coverDepositFS and coverMaskFS, and no inkCoverFS', () => {
    expect(exports.coverDepositFS, 'coverDepositFS must exist').toBeTypeOf('string')
    expect(exports.coverMaskFS, 'coverMaskFS must exist').toBeTypeOf('string')
    expect(exports.inkCoverFS, 'the rev-4 inkCoverFS must be deleted').toBeUndefined()
  })

  it('displayFS mode 4 emits the committed darkness alpha (live/committed parity)', () => {
    // 2026-11-21 (the artist's live-vs-committed report): the live compositor
    // must emit the SAME straight-alpha pigment the committed sheet converts
    // to (rasterAlpha.ts: alpha = 1 − min(t)). SPIKE 001's coverage term broke
    // that parity — Body-100 paint read opaque live and translucent once
    // committed (yellow hides blue vs multiplies to green after a re-bake).
    // Source pins report the missing LITERAL, never the shader source: a raw
    // `toContain` dumps displayFS into the TAP report and breaks its format.
    const pin = (needle: string) =>
      expect(displayFS.includes(needle), `missing shader text: ${needle}`).toBe(true)
    pin('uniform sampler2D uCover;')
    pin('float alpha = clamp(1.0 - tMin, 0.0, 1.0);')
    pin('vec3 pigment = alpha > 0.0 ? (tSrgb - vec3(1.0 - alpha)) / alpha : vec3(0.0);')
    expect(displayFS.includes('max(darkAlpha, cov)'), 'the coverage alpha term must stay retired').toBe(false)
  })

  it('displayFS mode 4 composites the committed underlay with the engine coverage law', () => {
    // 2026-11-21 (the artist's re-render): a dab REPLACES pigment
    // (`ink <- ink*(1-a) + C*a`, Engine.bristleInk draws 1/1b attenuate the
    // settled pool by the same a), so the committed base survives by
    // (1 - cover). The live compositor applies the same law — NOT a film
    // multiply, which reads dark.
    const pin = (needle: string) =>
      expect(displayFS.includes(needle), `missing shader text: ${needle}`).toBe(true)
    pin('uniform sampler2D uUnderlay;')
    pin('uniform float uUnderlayOn;')
    pin('if (uUnderlayOn > 0.5){')
    pin('vec3 tNew = fromSRGB(lit);')
    pin('vec3 tBase = fromSRGB(texture(uUnderlay, uv).rgb);')
    pin('float cov = clamp(texture(uCover, uv).x, 0.0, 1.0);')
    pin('vec3 all = min(toSRGB(tNew * pow(tBase, vec3(1.0 - cov))), vec3(1.0));')
  })
})

// ============================================================
//  261125-kvl (SPIKE 006) — the per-stroke stroke layer.
//
//  The layer's law is frozen: the lateral alpha `A = 1 - amount·t^e`, the
//  composite's `aEff = A·cover_L`, the 8-band rank-one LM encoder and the
//  storage write-back `fit/k - fixed`. The shipped compositor must not have
//  learned anything about the layer (the amount-0 path is the shipped path),
//  and the merge's compiled band list must stay exactly the spike's eight
//  indices — a uniform mask would shrink nothing.
// ============================================================
describe('stroke layer shaders (261125-kvl, SPIKE 006)', () => {
  const exports = shaderModule as Record<string, unknown>
  const merge = exports.strokeLayerMergeFS as string
  const cover = exports.bristleCoverLayerFS as string
  const clear = exports.strokeLayerClearFS as string
  const coverUnion = exports.strokeLayerCoverFS as string
  const reliefUnion = exports.strokeLayerReliefFS as string

  it('compiles the merge against exactly the eight frozen display bands', () => {
    expect(STROKE_LAYER_BANDS).toEqual([1, 3, 5, 7, 9, 10, 11, 13])
    expect(typeof merge, 'strokeLayerMergeFS must be a string').toBe('string')
    const pin = (needle: string) =>
      expect(merge.includes(needle), `missing shader text: ${needle}`).toBe(true)
    pin('const int BANDS = 8;')
    // Eight basis entries in each compiled array — a 16-entry block is the
    // uniform-mask design the spike rejected.
    const b4 = merge.match(/const vec4 B4\[BANDS\] = vec4\[BANDS\]\(([^;]*)\);/)?.[1] ?? ''
    const b3 = merge.match(/const vec3 B3\[BANDS\] = vec3\[BANDS\]\(([^;]*)\);/)?.[1] ?? ''
    expect(b4.split('vec4(').length - 1, 'eight B4 entries').toBe(8)
    expect(b3.split('vec3(').length - 1, 'eight B3 entries').toBe(8)
  })

  it('carries the frozen lateral law in the merge and both union passes', () => {
    for (const [name, src] of [
      ['merge', merge],
      ['cover', coverUnion],
      ['relief', reliefUnion],
    ] as const) {
      const pin = (needle: string) =>
        expect(src!.includes(needle), `${name} is missing shader text: ${needle}`).toBe(true)
      pin('float layerAEff(vec2 uv){')
      pin('float t = clamp((u - uEdgeStart) / max(1.0 - uEdgeStart, 1e-4), 0.0, 1.0);')
      pin('float e = exp2(2.0 * uEdgeFalloff - 1.0);')
      pin('return clamp((1.0 - uEdgeFade * pow(t, e)) * coverL, 0.0, 1.0);')
    }
    expect(coverUnion.includes('1.0 - (1.0 - texture(uCoverS, uv).x) * (1.0 - layerAEff(uv))')).toBe(true)
    expect(reliefUnion.includes('texture(uReliefS, uv).x + layerAEff(uv) * texture(uReliefL, uv).x')).toBe(true)
  })

  it('keeps the encoder frozen: rank-one Jacobian, seed mix, bounded LM, exact endpoints, /k write-back', () => {
    const pin = (needle: string) =>
      expect(merge.includes(needle), `missing shader text: ${needle}`).toBe(true)
    pin('float ha = max(1e-5, abs(x[0]) * 1e-4);')
    pin('vec4 seedA = mix(sa, la, aEff);')
    pin('if (it >= uMaxIter) break;')
    pin('if (maxResid(ca, cb, cs, tgt) < 1e-5) break;')
    pin('if (aEff >= 1.0 - 1e-4){')
    pin('if (aEff <= 1e-4){')
    pin('oA = vec4(x[0], x[1], x[2], x[3]) / k - fixedA;')
    pin('oB = vec4(x[4], x[5], x[6], max(x[7], 0.0)) / k - fixedB;')
    pin('float k = max(1.0 + uGranulation * (0.5 - texture(uPaper, uv).g) * 2.2, 1e-3);')
  })

  it('writes the layer film as two attachments: the cover lerp and the MIN lateral field', () => {
    const pin = (needle: string) =>
      expect(cover.includes(needle), `missing shader text: ${needle}`).toBe(true)
    pin('layout(location=0) out vec4 o0;')
    pin('layout(location=1) out vec4 o1;')
    pin('o0 = vec4(target, 0.0, 0.0, a);')
    pin('o1 = vec4(clamp(abs(q.x) / max(uFeatherEdge, 1e-4), 0.0, 1.0));')
    // The gather is read ONCE and the shipped guard is kept verbatim; the
    // fragment needs the record itself for `g.alpha` and the smear, so it
    // names it in a local (the structure is never widened).
    expect(cover.includes('Gathered g = gatherBristle(vUv);')).toBe(true)
    expect(cover.includes('float a = clamp(g.coverage, 0.0, 1.0);')).toBe(true)
    expect(cover.includes('if (a <= 1e-3) discard;')).toBe(true)
    // The clear pass starts the lateral field at 1 (empty), never 0 (core).
    expect(clear.includes('o0 = vec4(0.0);')).toBe(true)
    expect(clear.includes('o1 = vec4(1.0);')).toBe(true)
  })

  it('emits displayLayerFS from the same band tuples, with the shipped displayFS untouched', () => {
    // The two basis emitters read the same tables through one generator; the
    // numeric tuple list must be identical per band (16 bands × the vec4 +
    // vec3 basis + vec3 weights each band emits).
    const tuples = (src: string) =>
      [...src.matchAll(/vec([34])\(([^)]*)\)/g)].map((match) => match[2]!.trim())
    const shipped = tuples(displayBasisGLSL())
    // Six tuples per band: the scattered and the legacy branch each carry the
    // vec4 basis, the vec3 basis and the vec3 RGB weight (16 x 6).
    expect(shipped.length, 'sixteen bands x six tuples').toBe(96)
    expect(tuples(displayBasisFnGLSL()).filter((tuple) => tuple !== '0.0')).toEqual(shipped)
    const pin = (needle: string) =>
      expect(displayLayerFS.includes(needle), `displayLayerFS is missing shader text: ${needle}`).toBe(true)
    pin('uniform sampler2D uLayerA, uLayerB;')
    pin('uniform sampler2D uLayerCover;')
    pin('uniform sampler2D uLayerLateral;')
    pin('uniform sampler2D uLayerRelief;')
    pin('uniform float uEdgeFade, uEdgeStart, uEdgeFalloff;')
    // The frozen lateral law, the exact band mix and the two union fields.
    pin('float layerT = clamp((layerU - uEdgeStart) / max(1.0 - uEdgeStart, 1e-4), 0.0, 1.0);')
    pin('layerAeff = clamp((1.0 - uEdgeFade * pow(layerT, layerE)) * layerCover, 0.0, 1.0);')
    pin('rgb = mix(rgb, displayBasisBands(layerInk, layerBands, layerScatter), layerAeff);')
    pin('float cov = clamp(1.0 - (1.0 - texture(uCover, uv).x) * (1.0 - layerAeff), 0.0, 1.0);')
    pin('texture(uRelief, uv).x + layerAeff * texture(uLayerRelief, uv).x')
    // The skip guard: no layer reconstruction where the layer never covered.
    pin('if (layerCover > 1e-4){')
  })

  it('leaves the shipped displayFS and gather programs free of the layer', () => {
    for (const needle of [
      'uLayerA', 'uLayerB', 'uLayer', 'uCoverL', 'uLateral', 'uEdgeFade', 'uEdgeStart', 'uEdgeFalloff',
    ]) {
      expect(displayFS.includes(needle), `displayFS must not carry ${needle}`).toBe(false)
    }
    const deposit = exports.bristleDepositFS as string
    const shippedCover = exports.bristleCoverFS as string
    expect(deposit.includes('uEdgeFade')).toBe(false)
    expect(shippedCover.includes('uEdgeFade')).toBe(false)
    expect(shippedCover.includes('layout(location=1)'), 'struct Gathered stays unwidened').toBe(false)
  })
})
