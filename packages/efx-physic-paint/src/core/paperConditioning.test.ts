import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as paperModule from './paper'

// 260925-dso — Pin 3: loaded paper height must be detail-normalized — mean-centred
// to 0.5, contrast clamped to +/-0.40 (output band [0.10, 0.90]) — and loadPaperTexture
// must pipe its red-channel extraction through the conditioner.
// Namespace import keeps the file loadable at RED (the export does not exist at base);
// the first leg pins the missing export with a real assertion.
const conditionHeightMap = (paperModule as Record<string, unknown>)[
  'conditionHeightMap'
] as ((raw: Float32Array) => Float32Array) | undefined

const paperSource = readFileSync(new URL('./paper.ts', import.meta.url), 'utf8')

function symmetricInput(): Float32Array {
  const raw = new Float32Array(256)
  for (let i = 0; i < 256; i++) raw[i] = 0.7 + (((i % 17) - 8) / 80)
  return raw
}

describe('260925-dso — paper height conditioning', () => {
  it('exports conditionHeightMap from core/paper.ts', () => {
    expect(typeof conditionHeightMap).toBe('function')
  })

  it('(a) mean-centres a non-clamping input to 0.5', () => {
    const out = conditionHeightMap!(symmetricInput())
    const mean = out.reduce((sum, v) => sum + v, 0) / out.length
    expect(mean).toBeCloseTo(0.5, 4)
  })

  it('(b) clamps contrast to +/-0.40: every output within [0.10, 0.90]', () => {
    const raw = new Float32Array(100)
    for (let i = 0; i < 100; i++) raw[i] = i % 4 === 0 ? 0.1 : 0.9
    const out = conditionHeightMap!(raw)
    for (const v of out) {
      expect(v).toBeGreaterThanOrEqual(0.1 - 1e-6)
      expect(v).toBeLessThanOrEqual(0.9 + 1e-6)
    }
  })

  it('(c) rank-monotone: a non-decreasing input yields a non-decreasing output', () => {
    const raw = new Float32Array(64)
    for (let i = 0; i < 64; i++) raw[i] = i / 63
    const out = conditionHeightMap!(raw)
    for (let i = 1; i < out.length; i++) {
      expect(out[i]).toBeGreaterThanOrEqual(out[i - 1])
    }
  })

  it('(d) idempotent on the symmetric input', () => {
    const raw = symmetricInput()
    const once = conditionHeightMap!(raw)
    const twice = conditionHeightMap!(once)
    expect(twice.length).toBe(once.length)
    for (let i = 0; i < once.length; i++) {
      expect(twice[i]).toBeCloseTo(once[i], 6)
    }
  })

  it("(e) source shape: loadPaperTexture pipes its extraction through conditionHeightMap", () => {
    const start = paperSource.indexOf('export function loadPaperTexture')
    expect(start).toBeGreaterThanOrEqual(0)
    const end = paperSource.indexOf('export function sampleH', start)
    const body = paperSource.slice(start, end > start ? end : undefined)
    expect(body).toContain('conditionHeightMap')
  })
})
