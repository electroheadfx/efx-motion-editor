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
import { displayFS, liftFS, stampFS } from './shaders'
import * as shaderModule from './shaders'

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

  it('displayFS mode 4 reads uCover and derives the coverage alpha', () => {
    // Source pins report the missing LITERAL, never the shader source: a raw
    // `toContain` dumps displayFS into the TAP report and breaks its format.
    const pin = (needle: string) =>
      expect(displayFS.includes(needle), `missing shader text: ${needle}`).toBe(true)
    pin('uniform sampler2D uCover;')
    pin('float darkAlpha = 1.0 - tMin;')
    pin('float alpha = clamp(max(darkAlpha, cov), 0.0, 1.0);')
  })
})
