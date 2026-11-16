// ============================================================
//  engineTipIdentity — the GPU tip cache and the lift brush
//  (quick-261115-oh9).
//
//  Two laws this file exists to keep from regressing, both invisible
//  to a unit test that never creates a WebGL context:
//
//   1. `tipTexture` caches the uploaded tip by `brushTipCacheKey`
//      (response id + texture id), NOT by `brush.id` alone. The bug
//      that motivated the quick: under the two-axis law `id` is the
//      RESPONSE, so a response-only key reused the first uploaded
//      tip forever — the reported "I can't change the texture, it
//      always the same".
//   2. `lift()` erases with `liftBrush` when the host bound one. A
//      pen's eraser end lifts while the Brush tool (and its textured
//      brush) is selected; without the override the live erase wore
//      the texture while the punch and the bake erased the response
//      tip.
//
//  The key law itself is pinned behaviourally in brushBridge.test.ts
//  (two textures on one response produce two different keys); this
//  file pins that the engine actually USES that key.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ENGINE_SOURCE = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), 'Engine.ts'),
  'utf8',
)

describe('GPU tip identity (quick-261115-oh9)', () => {
  it('tipTexture keys on brushTipCacheKey, never on the response id alone', () => {
    expect(ENGINE_SOURCE).toContain('const key = brushTipCacheKey(b)')
    expect(ENGINE_SOURCE).toContain('this.tipTextures.get(key)')
    expect(ENGINE_SOURCE).toContain('this.tipTextures.set(key, t)')
    // The inverted law: a bare `b.id` lookup is the bug this quick fixed.
    expect(ENGINE_SOURCE).not.toContain('this.tipTextures.get(b.id)')
  })

  it('forgetBrush drops every tip a response owns, not one key', () => {
    expect(ENGINE_SOURCE).toContain('key !== id && !key.startsWith(prefix)')
  })

  it('clearTipTextures exists for a mask replaced under an unchanged id (WR-02)', () => {
    // The cache keys on ids alone, but the registry can replace the BYTES
    // under an id. The host sweeps once per mask-registry generation.
    expect(ENGINE_SOURCE).toContain('clearTipTextures()')
    expect(ENGINE_SOURCE).toContain('for (const t of this.tipTextures.values()) this.gl.deleteTexture(t)')
    expect(ENGINE_SOURCE).toContain('this.tipTextures.clear()')
  })

  it('lift() prefers the host-bound liftBrush over the textured brush', () => {
    expect(ENGINE_SOURCE).toContain('const b = this.liftBrush ?? this.brush')
    expect(ENGINE_SOURCE).toContain('setLiftBrush(b: Brush | null)')
  })
})

describe('tip sampling quality and the rotation bind (quick 261116-inu / Task 10)', () => {
  it('mipmaps the 512 tip at the ONE texture-creation site and filters it trilinearly', () => {
    expect(ENGINE_SOURCE).toContain('gl.generateMipmap(gl.TEXTURE_2D)')
    expect(ENGINE_SOURCE).toContain(
      'gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)',
    )
    expect(ENGINE_SOURCE).toContain(
      'gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)',
    )
  })

  it('binds uTipRotation in drawStamp and lift from the brush degrees', () => {
    const bindings = ENGINE_SOURCE.split('uTipRotation').length - 1
    expect(bindings, 'stamp + lift bindings').toBe(2)
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(p.u.uTipRotation, (b.textureRotation ?? 0) * DEG)',
    )
  })
})
