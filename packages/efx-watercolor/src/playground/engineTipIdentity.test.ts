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

  it('lift() prefers the host-bound liftBrush over the textured brush', () => {
    expect(ENGINE_SOURCE).toContain('const b = this.liftBrush ?? this.brush')
    expect(ENGINE_SOURCE).toContain('setLiftBrush(b: Brush | null)')
  })
})
