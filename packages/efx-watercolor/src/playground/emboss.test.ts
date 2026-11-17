// ============================================================
//  Paint thickness lighting + engine light state (Phase 64,
//  MED-15 / MED-18).
//
//  Family: source-scan on the existing setup — no new config. vitest has
//  no WebGL2, so no uniform can be read back and no frame can be drawn
//  here; what a source scan CAN prove is pinned below, and the byte-level
//  proof (emboss 0 and light intensity 0 each reproduce the pre-milestone
//  render) lives in probe/medium-engine against
//  baselines/neutral-identity.json.
//
//  Laws pinned here:
//   1. displayFS samples the thickness field once plus its four one-texel
//      neighbours in document space and builds the same central-difference
//      normal paperLightFS uses.
//   2. The lit delta keeps the `- L.z` zero-gradient subtraction and the
//      intensity only multiplies, so a flat or unlit field shades to
//      exactly 1.0 on every mode.
//   3. uFlat gates the lit delta only (a region pick reads the unshaded
//      sheet), and no second flat uniform exists.
//   4. Engine holds the light in degrees, clamps it, rejects non-finite
//      input, redraws only on a real change and never touches params or
//      the deposit.
//   5. DEFAULT_LIGHT reconstructs paperLightFS's fixed light direction.
//   6. The thickness sampler binds at texture unit 7 and the four light
//      uniforms are set on every display draw, in radians.
//   7. Mode 4 derives pigment alpha from the unshaded reconstruction.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const SHADERS_SOURCE = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve(HERE, 'index.ts'), 'utf8')

/** Slice the source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

/** The template-literal body of one exported shader in shaders.ts. */
function shaderSource(name: string): string {
  const decl = SHADERS_SOURCE.indexOf(`export const ${name} = `)
  expect(decl, `shader ${name} not declared`).toBeGreaterThanOrEqual(0)
  const open = SHADERS_SOURCE.indexOf('`', decl)
  const close = SHADERS_SOURCE.indexOf('`;', open + 1)
  expect(open, `shader ${name} template literal not opened`).toBeGreaterThan(decl)
  expect(close, `shader ${name} template literal not closed`).toBeGreaterThan(open)
  return SHADERS_SOURCE.slice(open + 1, close)
}

/** Every uniform name a shader source declares, sorted (grouped declarations split). */
function uniformNames(source: string): string[] {
  const names: string[] = []
  const re = /uniform\s+(?:sampler2D|float|vec2|vec3|vec4|int)\s+([^;]+);/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source)) !== null) {
    for (const name of match[1]!.split(',')) names.push(name.trim())
  }
  return names.sort()
}

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump the shader into the RED report and break its format.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

// The label is spelled out rather than derived from the pattern: a regex
// literal in a failure message trips the TAP report's YAML strictness.
function expectMatches(source: string, pattern: RegExp, label: string): void {
  expect(pattern.test(source), `missing source pattern: ${label}`).toBe(true)
}

// ---------------------------------------------------------------------------
// 1. The emboss block in the display composite
// ---------------------------------------------------------------------------

describe('displayFS emboss block (MED-15)', () => {
  it('declares the thickness sampler and exactly four light uniforms, and reuses uFlat', () => {
    const source = shaderSource('displayFS')
    expectContains(source, 'uniform sampler2D uRelief;')
    expectContains(source, 'uniform float uLightAzimuth, uLightElevation, uLightIntensity, uReliefBump;')
    const names = uniformNames(source)
    for (const name of ['uRelief', 'uLightAzimuth', 'uLightElevation', 'uLightIntensity', 'uReliefBump']) {
      expect(names, `uniform ${name} not declared`).toContain(name)
    }
    // One flat gate serves the declaration, the binding and the formula.
    expect(names.filter((name) => name.toLowerCase().includes('flat'))).toEqual(['uFlat'])
  })

  it('derives the normal from the same one-texel central difference as paperLightFS', () => {
    const source = shaderSource('displayFS')
    expectContains(source, 'float c = texture(uRelief, uv).x;')
    expectContains(source, 'texture(uRelief, uv - vec2(uTexel.x, 0.0)).x')
    expectContains(source, 'texture(uRelief, uv + vec2(uTexel.x, 0.0)).x')
    expectContains(source, 'texture(uRelief, uv - vec2(0.0, uTexel.y)).x')
    expectContains(source, 'texture(uRelief, uv + vec2(0.0, uTexel.y)).x')
    expectContains(source, 'vec3 n = normalize(vec3((l - r) * uReliefBump, (b - t) * uReliefBump, 1.0));')
    // The same law paperLightFS lights the paper with: one fixed texel radius.
    expectContains(shaderSource('paperLightFS'), 'vec3 n = normalize(vec3((l - r) * uBump, (b - t) * uBump, 1.0));')
  })

  it('samples the gradient in document space, so zoom and pan cannot move the shade', () => {
    const source = shaderSource('displayFS')
    // Canvas pixels reach the shading only through ONE document-uv mapping...
    expectContains(source, 'vec2 uv = (gl_FragCoord.xy - uView.xy) / uView.zw;')
    const block = sliceBetween(source, 'float shade = 1.0;', 'if (uMode == 4){')
    // ...and the four neighbours are one DOCUMENT texel away, never one canvas
    // pixel, so a zoom or pan changes the sampling footprint but not the
    // document-space gradient it measures (no shimmer, no crawl).
    expectNotContains(block, 'uView')
    expectNotContains(block, 'uDpr')
    for (const offset of [
      'uv - vec2(uTexel.x, 0.0)',
      'uv + vec2(uTexel.x, 0.0)',
      'uv - vec2(0.0, uTexel.y)',
      'uv + vec2(0.0, uTexel.y)',
    ]) {
      expectContains(block, `texture(uRelief, ${offset}).x`)
    }
    // uTexel is the document texel (1/dw, 1/dh), set at the one display
    // boundary — never a zoom- or dpr-derived step.
    expectContains(ENGINE_SOURCE, 'gl.uniform2f(p.u.uTexel, 1 / this.dw, 1 / this.dh);')
  })

  it('keeps the - L.z zero-gradient term and makes the intensity a multiplier only', () => {
    const source = shaderSource('displayFS')
    expectContains(source, 'float litDelta = uLightIntensity * (dot(n, L) - L.z) * uReliefBump * EMBOSS_GAIN;')
    // An additive offset would brighten a flat field; the emboss is a gradient term.
    expect(/litDelta\s*=\s*uLightIntensity\s*\+/.test(source), 'litDelta must multiply, never offset').toBe(false)
    // The unlit fallback is exactly 1.0, and the clamp ceiling is a named constant.
    expectContains(source, 'float shade = 1.0;')
    expectContains(source, 'const float EMBOSS_GAIN = 2.0;')
    expectContains(source, 'const float EMBOSS_SHADE_MAX = 1.5;')
    expectContains(source, 'shade = clamp(1.0 + litDelta * (1.0 - uFlat), 0.0, EMBOSS_SHADE_MAX);')
    // The shade is computed AFTER the granulation gate, so k never sees it.
    expect(source.indexOf('a *= k; b *= k;')).toBeLessThan(source.indexOf('float shade = 1.0;'))
  })

  it('reconstructs the unit light vector from the two angles, in radians, at the engine boundary', () => {
    const source = shaderSource('displayFS')
    expectContains(source, 'vec3 L = normalize(vec3(')
    expectContains(source, 'cos(uLightElevation) * cos(uLightAzimuth),')
    expectContains(source, 'cos(uLightElevation) * sin(uLightAzimuth),')
    expectContains(source, 'sin(uLightElevation)));')
    // The engine hands the shader radians; the shader never converts again.
    expectNotContains(source, 'radians(')
  })

  it('shades rgb once before the transmittance early return, and mode 4 derives alpha from the unshaded reconstruction', () => {
    const source = shaderSource('displayFS')
    expectContains(source, 'rgb *= shade;')
    const shadeAt = source.indexOf('rgb *= shade;')
    expect(shadeAt).toBeGreaterThan(source.indexOf('${displayBasisGLSL()}'))
    // 64-08 retired the gouache mix; the shade still lands on rgb exactly once,
    // after the reconstruction and before every consumer that reads it.
    expect(shadeAt).toBeLessThan(source.indexOf('if (uMode == 2){'))
    expect(source.match(/rgb \*= shade;/g) ?? []).toHaveLength(1)

    // Mode 4's early return reads the unshaded rgb and scales only the
    // premultiplied colour; alpha is byte-for-byte untouched.
    expect(source.indexOf('if (uMode == 4){')).toBeLessThan(shadeAt)
    const mode4 = sliceBetween(source, 'if (uMode == 4){', 'rgb *= shade;')
    expectContains(mode4, 'vec3 t = toSRGB(rgb);')
    expectNotContains(mode4, 'toSRGB(rgb * shade)')
    expectContains(mode4, 'o = vec4(pigment * alpha * shade, alpha);')
    expect(/alpha\s*\*=\s*shade/.test(mode4), 'alpha must never be scaled by the shade').toBe(false)

    // Mode 2 keeps its early return, on the shaded rgb.
    expect(source.indexOf('if (uMode == 2){')).toBeGreaterThan(shadeAt)
  })
})

// ---------------------------------------------------------------------------
// 2. The engine light state
// ---------------------------------------------------------------------------

describe('engine light state (MED-15)', () => {
  it('exports LightSettings in degrees and the default that reconstructs the paper light', () => {
    expectContains(
      ENGINE_SOURCE,
      'export interface LightSettings { azimuth: number; elevation: number; intensity: number }',
    )
    expectContains(
      ENGINE_SOURCE,
      'export const DEFAULT_LIGHT: LightSettings = { azimuth: 129.8, elevation: 38.45, intensity: 1 };',
    )
    const field = ENGINE_SOURCE.match(/private light: LightSettings = \{[^}]*\};/g) ?? []
    expect(field).toHaveLength(1)
  })

  it('reconstructs normalize(vec3(-0.5, 0.6, 0.62)) within a rounding tolerance', async () => {
    const mod = await import('./Engine')
    const light = mod.DEFAULT_LIGHT
    expect(light).toBeDefined()
    const az = (light.azimuth * Math.PI) / 180
    const el = (light.elevation * Math.PI) / 180
    const reconstructed = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)]
    const target = [-0.5, 0.6, 0.62]
    const length = Math.hypot(target[0]!, target[1]!, target[2]!)
    for (let i = 0; i < 3; i += 1) expect(reconstructed[i]).toBeCloseTo(target[i]! / length, 3)
    expect(light.intensity).toBe(1)
  })

  it('clamps, wraps, rejects non-finite input and redraws only on a real change', () => {
    const body = sliceBetween(
      ENGINE_SOURCE,
      'setLight(next: Partial<LightSettings>) {',
      'getLight(): LightSettings',
    )
    expectContains(body, 'Number.isFinite(next.azimuth)')
    expectContains(body, 'DEFAULT_LIGHT.azimuth')
    expectContains(body, 'azimuth: ((azimuth % 360) + 360) % 360,')
    expectContains(body, 'elevation: clamp(elevation, 0, 90),')
    expectContains(body, 'intensity: clamp(intensity, 0, 4),')
    expectContains(
      body,
      'if (resolved.azimuth === this.light.azimuth && resolved.elevation === this.light.elevation && resolved.intensity === this.light.intensity) return;',
    )
    expectContains(body, 'this.light = resolved;')
    expectContains(body, 'this.redraw();')
    // Render-only: params, the deposit and the undo history are never touched.
    expectNotContains(body, 'this.params')
    expectNotContains(body, 'deposit')
    expect(/protect\(|this\.history/.test(body), 'the light never enters undo history').toBe(false)
    // The getter hands out a copy, so no caller can mutate engine state.
    const getter = sliceBetween(ENGINE_SOURCE, 'getLight(): LightSettings', 'setPaper(')
    expectContains(getter, 'return { ...this.light };')
  })

  it('is the only writer of the light state', () => {
    const writes = [...ENGINE_SOURCE.matchAll(/this\.light\s*=/g)].map((m) => m.index ?? 0)
    expect(writes).toHaveLength(1)
    const bodyStart = ENGINE_SOURCE.indexOf('setLight(next: Partial<LightSettings>) {')
    const bodyEnd = ENGINE_SOURCE.indexOf('getLight(): LightSettings')
    expect(writes[0]).toBeGreaterThan(bodyStart)
    expect(writes[0]).toBeLessThan(bodyEnd)
  })

  it('binds the thickness sampler at unit 7 and sets the four light uniforms on every draw', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private drawDisplay(', 'private render() {')
    expectContains(body, 'g.bindTex(7, this.relief.tex[0])')
    for (const name of ['uLightAzimuth', 'uLightElevation', 'uLightIntensity', 'uReliefBump']) {
      expectContains(body, `p.u.${name}`)
    }
    // Units 0..7, no collision: ink 0-1, fixed 2-3, wet 4, paper 5, ref 6, relief 7.
    const binds = [...body.matchAll(/g\.bindTex\((\d+),/g)].map((match) => Number(match[1]))
    expect(binds).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    // Degrees become radians once, at this boundary.
    expect(body.match(/Math\.PI\) \/ 180/g) ?? []).toHaveLength(2)
    // The bump is a fixed document-space scale, never a zoom-dependent value.
    expectContains(ENGINE_SOURCE, 'const RELIEF_BUMP = 1.0;')
    expectContains(body, 'gl.uniform1f(p.u.uReliefBump, RELIEF_BUMP);')
  })
})

// ---------------------------------------------------------------------------
// 3. The package barrel carries the light surface
// ---------------------------------------------------------------------------

describe('package barrel (MED-15)', () => {
  it('exports DEFAULT_LIGHT as a value and LightSettings as a type', () => {
    expectMatches(INDEX_SOURCE, /export \{[^}]*DEFAULT_LIGHT[^}]*\} from '\.\/Engine'/, 'DEFAULT_LIGHT value export')
    expectMatches(INDEX_SOURCE, /export type \{[^}]*LightSettings[^}]*\} from '\.\/Engine'/, 'LightSettings type export')
  })
})
