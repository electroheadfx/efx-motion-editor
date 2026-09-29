// ============================================================
//  paint.depositSourceShape.test.ts — 52.4-04 permanent gate
//  file: the source-shape rules that make the salt-and-pepper
//  mechanism unable to return.
//
//  Six gates over comment-stripped source (readFileSync + string
//  rules only — no export seam, no production diff, no pixel
//  access in this file):
//    G1 non-seeded-rng        — paint.ts whole file + footprintLanes.ts
//    G2 per-pixel-read/write  — drawBristleFootprint body slice +
//                               footprintLanes.ts (REGION-SCOPED:
//                               paint.ts's pre-existing wet-composite
//                               and pickup-snapshot getImageData sites
//                               are never scanned)
//    G3 non-constant-alpha    — every globalAlpha RHS in the footprint
//                               body + lane builder must be the
//                               STREAK_ALPHA x opac whitelist only
//                               (D-11 source shape)
//    G4 paper-read            — no sampleH/sampleHFn/0.72/paper token
//                               in footprint body or lane builder (D-14)
//    G5 width-gauge-shape     — WIDTH_FLOOR + MAX_TRACE_WIDTH clamp
//                               present, traceShapeNoise channel 0
//                               only, gauge arc-keyed (D-12 a/b)
//    G6 deposit-law-constant  — wet-layer.ts keeps const
//                               DEPOSIT_KEEP_TIER = 70, drying.ts
//                               keeps const DRY_ALPHA_THRESHOLD = 1
//
//  Structure per gate: (a) real-source test reading the actual
//  files — green at birth post-52.4-01/02, recorded honestly;
//  (b) negative control feeding a synthetic snippet containing the
//  forbidden term — fails against the zero-stub (valid RED),
//  proves the gate has teeth (threat T-52.4-04-02).
//
//  RED state (Task 1): collectShapeViolations is a zero-stub
//  returning [] — real gates pass, negative controls fail.
//  GREEN (Task 2): the rule engine is implemented inline.
// ============================================================

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// ---------------------------------------------------------------
// Local helpers (inside the gate file — no production export seam)
// ---------------------------------------------------------------

/**
 * Removes line and block comments (string/template-aware so `//`
 * inside string literals survives) so comment prose can never
 * self-invalidate a gate — verify-gate hygiene per PATTERNS §3.
 * Comment characters become spaces; newlines are preserved.
 */
function stripComments(src: string): string {
  let out = ''
  let i = 0
  while (i < src.length) {
    const c = src[i]
    const next = src[i + 1]
    if (c === '"' || c === "'" || c === '`') {
      // String/template literal: copy verbatim (handles escapes).
      const quote = c
      out += c
      i++
      while (i < src.length) {
        const s = src[i]
        out += s
        if (s === '\\') {
          out += src[i + 1] ?? ''
          i += 2
          continue
        }
        i++
        if (s === quote) break
      }
      continue
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        out += ' '
        i++
      }
      continue
    }
    if (c === '/' && next === '*') {
      out += '  '
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' '
        i++
      }
      if (i < src.length) {
        out += '  '
        i += 2
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/**
 * Clones the 52.4-01 source-shape anchor: indexOf on
 * `export function <exportName>` then slice to the next
 * `\nexport function` — the SAME slice expression, never a second
 * one (plan key_links).
 */
function sliceFunctionBody(src: string, exportName: string): string {
  const start = src.indexOf(`export function ${exportName}`)
  if (start < 0) throw new Error(`source-shape anchor not found: export function ${exportName}`)
  const end = src.indexOf('\nexport function', start + 10)
  return src.slice(start, end > -1 ? end : undefined)
}

/**
 * The rule engine: stripComments over each entry body, apply the
 * six rules by entry label, return every violated stable label.
 *
 * RED zero-stub (Task 1): returns [] so every real-source gate
 * compiles and passes while only the negative controls fail.
 * GREEN (Task 2): the rules below are implemented in the body.
 *
 * Entry labels (source identity): 'paint.ts', 'drawBristleFootprint',
 * 'footprintLanes.ts', 'wet-layer.ts', 'drying.ts'.
 * Violation labels: non-seeded-rng, per-pixel-read, per-pixel-write,
 * non-constant-alpha, paper-read, width-gauge-shape,
 * deposit-law-constant.
 */
function collectShapeViolations(input: { label: string; body: string }[]): string[] {
  void input // RED zero-stub — replaced by the rule engine in Task 2
  return []
}

// ---------------------------------------------------------------
// Real-source entries — the four files the gates stand over
// ---------------------------------------------------------------

function readRealEntries(): { label: string; body: string }[] {
  const paintSrc = readFileSync(new URL('./paint.ts', import.meta.url), 'utf8')
  const lanesSrc = readFileSync(new URL('./footprintLanes.ts', import.meta.url), 'utf8')
  const wetSrc = readFileSync(new URL('../core/wet-layer.ts', import.meta.url), 'utf8')
  const drySrc = readFileSync(new URL('../core/drying.ts', import.meta.url), 'utf8')
  return [
    { label: 'paint.ts', body: paintSrc },
    { label: 'drawBristleFootprint', body: sliceFunctionBody(paintSrc, 'drawBristleFootprint') },
    { label: 'footprintLanes.ts', body: lanesSrc },
    { label: 'wet-layer.ts', body: wetSrc },
    { label: 'drying.ts', body: drySrc },
  ]
}

// ---------------------------------------------------------------
// Real-source gates — GREEN AT BIRTH post-52.4-01/02 (recorded
// honestly; never manufactured red)
// ---------------------------------------------------------------

describe('deposit source-shape gates — real sources', () => {
  it('G1 non-seeded-rng: comment-stripped paint.ts and footprintLanes.ts contain no Math.random', () => {
    const violations = collectShapeViolations(readRealEntries()).filter((l) => l === 'non-seeded-rng')
    expect(violations).toEqual([])
  })

  it('G2 per-pixel pass: the drawBristleFootprint body slice and footprintLanes.ts contain no getImageData/putImageData (region-scoped — paint.ts composite readbacks out of scope)', () => {
    const entries = readRealEntries()
    const slice = entries.find((e) => e.label === 'drawBristleFootprint')!
    expect(slice.body.startsWith('export function drawBristleFootprint')).toBe(true)
    const violations = collectShapeViolations(entries).filter(
      (l) => l === 'per-pixel-read' || l === 'per-pixel-write',
    )
    expect(violations).toEqual([])
  })

  it('G3 constant alpha: every globalAlpha RHS in the footprint body and lane builder is the STREAK_ALPHA/opac whitelist only', () => {
    const violations = collectShapeViolations(readRealEntries()).filter((l) => l === 'non-constant-alpha')
    expect(violations).toEqual([])
  })

  it('G4 paper law: no sampleH/sampleHFn/0.72/paper read in the footprint body or lane builder (D-14)', () => {
    const violations = collectShapeViolations(readRealEntries()).filter((l) => l === 'paper-read')
    expect(violations).toEqual([])
  })

  it('G5 width-gauge shape: WIDTH_FLOOR + MAX_TRACE_WIDTH clamp present, traceShapeNoise channel 0 only, gauge arc-keyed (D-12 a/b)', () => {
    const violations = collectShapeViolations(readRealEntries()).filter((l) => l === 'width-gauge-shape')
    expect(violations).toEqual([])
  })

  it('G6 deposit-law constants: wet-layer.ts keeps const DEPOSIT_KEEP_TIER = 70 and drying.ts keeps const DRY_ALPHA_THRESHOLD = 1', () => {
    const violations = collectShapeViolations(readRealEntries()).filter((l) => l === 'deposit-law-constant')
    expect(violations).toEqual([])
  })
})

// ---------------------------------------------------------------
// Negative controls — one per gate label; a synthetic snippet
// containing the forbidden term MUST yield its stable violation
// label. These FAIL against the zero-stub (valid RED) and prove
// each gate has teeth.
// ---------------------------------------------------------------

describe('deposit source-shape negative controls (gate teeth)', () => {
  it('G1 control: a synthetic paint or lane source with Math.random yields non-seeded-rng', () => {
    const violations = collectShapeViolations([
      { label: 'paint.ts', body: 'export function drawBristleFootprint() {\n  const r = Math.random()\n  return r\n}' },
      { label: 'footprintLanes.ts', body: 'export const JITTER = Math.random()' },
    ])
    expect(violations.filter((l) => l === 'non-seeded-rng')).toHaveLength(2)
  })

  it('G2 control: a synthetic footprint body with a pixel readback yields per-pixel-read and with a pixel writeback yields per-pixel-write', () => {
    const read = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'export function drawBristleFootprint() {\n  const px = ctx.getImageData(0, 0, 1, 1)\n  return px\n}' },
    ])
    expect(read).toContain('per-pixel-read')
    const write = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'export function drawBristleFootprint() {\n  ctx.putImageData(image, 0, 0)\n}' },
    ])
    expect(write).toContain('per-pixel-write')
  })

  it('G3 control: a non-whitelisted globalAlpha RHS yields non-constant-alpha; the STREAK_ALPHA x opac whitelist yields none', () => {
    const bad = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'ctx.globalAlpha = STREAK_ALPHA * opac * noiseAmt' },
    ])
    expect(bad).toContain('non-constant-alpha')
    const pressure = collectShapeViolations([
      { label: 'footprintLanes.ts', body: 'ctx.globalAlpha = 0.5 * pressure' },
    ])
    expect(pressure).toContain('non-constant-alpha')
    const good = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'ctx.globalAlpha = STREAK_ALPHA * opac' },
      { label: 'footprintLanes.ts', body: 'ctx.globalAlpha = params.opac' },
    ])
    expect(good.filter((l) => l === 'non-constant-alpha')).toEqual([])
  })

  it('G4 control: sampleH, sampleHFn, the 0.72 threshold and a paper token each yield paper-read', () => {
    for (const snippet of ['const h = sampleH(x)', 'const h = sampleHFn(x)', 'if (h > 0.72) cut()', 'const t = paperTexture(x)']) {
      const violations = collectShapeViolations([
        { label: 'drawBristleFootprint', body: snippet },
      ])
      expect(violations).toContain('paper-read')
    }
  })

  it('G5 control: a body missing the width clamp, a channel-1 noise call and a non-arc gauge key each yield width-gauge-shape', () => {
    const noClamp = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'const lw = clamp(value, 0.5, 2)' },
    ])
    expect(noClamp).toContain('width-gauge-shape')
    const channel1 = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'const g = clamp(lw * traceShapeNoise(seed, arc[ci] * NW_ARC_SCALE, bi, 1), WIDTH_FLOOR, MAX_TRACE_WIDTH)' },
    ])
    expect(channel1).toContain('width-gauge-shape')
    const sampleIndexKey = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'const g = clamp(lw * traceShapeNoise(seed, ci * NW_ARC_SCALE, bi, 0), WIDTH_FLOOR, MAX_TRACE_WIDTH)' },
    ])
    expect(sampleIndexKey).toContain('width-gauge-shape')
  })

  it('G6 control: a wet-layer source without the keep tier or a drying source with a changed dry-alpha threshold yields deposit-law-constant', () => {
    const wet = collectShapeViolations([
      { label: 'wet-layer.ts', body: 'export function transfer() {\n  return 1\n}' },
    ])
    expect(wet).toContain('deposit-law-constant')
    const wetChanged = collectShapeViolations([
      { label: 'wet-layer.ts', body: 'const DEPOSIT_KEEP_TIER = 80' },
    ])
    expect(wetChanged).toContain('deposit-law-constant')
    const dryChanged = collectShapeViolations([
      { label: 'drying.ts', body: 'const DRY_ALPHA_THRESHOLD = 2' },
    ])
    expect(dryChanged).toContain('deposit-law-constant')
  })
})
