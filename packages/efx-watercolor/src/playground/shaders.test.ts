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
import { liftFS, stampFS } from './shaders'

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

  it('liftFS keeps the tip-shaped erase for Lift and offers the solid-core cover profile', () => {
    // uCover = 0 (Lift's own erase) is the original soft, tip-shaped profile.
    expect(liftFS).toContain('uniform float uAspect, uRadius, uAmount, uTipAspect, uRound, uCover;')
    expect(liftFS).toContain('float soft = exp(-pow(dot(q, q), 2.0)) * mix(t, 1.0, uRound);')
    expect(liftFS).toContain('float core = 1.0 - smoothstep(0.35, 1.0, dot(q, q));')
    expect(liftFS).toContain('float f = uAmount * mix(soft, core, uCover);')
  })
})
