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
//                               body + lane builder must be the SINGLE
//                               fill whitelist (STREAK_ALPHA x opac) only;
//                               the under-pass constant (SOFT_EDGE_ALPHA)
//                               is a violation (R7c: one fill alpha, the
//                               silhouette under-pass is gone — 260929-m2z
//                               amendment of the 260929-j47 two-alpha rule)
//    G4 paper-read            — no sampleH/sampleHFn/0.72/paper token
//                               in footprint body or lane builder (D-14)
//    G5 width-gauge-shape     — R7 single-clamp width law: WIDTH_FLOOR +
//                               CORE_MAX_TRACE_WIDTH present, the soft-pass
//                               tokens (SOFT_EDGE_ALPHA / MAX_TRACE_WIDTH)
//                               absent, and traceShapeNoise channel 0 only,
//                               gauge arc-keyed (D-12 a/b; 260929-m2z
//                               amendment of the 260929-j47 two-clamp rule)
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
//  RED state (Task 1): collectShapeViolations was a zero-stub
//  returning [] — real gates passed, negative controls failed.
//  GREEN (Task 2): the rule engine is implemented inline; all six
//  negative controls flag their synthetic violations and every
//  real-source gate stays green.
//
//  260929-m2z (R7 amendment): G3/G5 moved from the 260929-j47
//  two-pass/two-clamp rules to the R7 single-fill / single-clamp
//  rules — at RED the amended G3/G5 fail against the still-stroked
//  production body; G1/G2/G4/G6 test code is byte-unchanged.
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
 * Split a call's argument list on top-level commas (paren/bracket
 * aware) — used by the G5 traceShapeNoise argument rules.
 */
function splitTopLevelArgs(src: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of src) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  out.push(cur)
  return out
}

/**
 * G5 — width-gauge shape (D-12 a/b, R7 single-clamp law 260929-m2z):
 * the WIDTH_FLOOR + CORE_MAX_TRACE_WIDTH clamp pair must be present, the
 * soft-pass tokens (SOFT_EDGE_ALPHA under-pass / MAX_TRACE_WIDTH soft
 * ceiling) are violations — coverage is one filled outline per fibre with
 * ONE clamp — every traceShapeNoise call must read channel 0 (never the
 * alpha channel 1), and the gauge key must be the arc table (or arcSlot)
 * — never the sample index.
 */
function widthGaugeViolated(body: string): boolean {
  if (!body.includes('WIDTH_FLOOR') || !body.includes('CORE_MAX_TRACE_WIDTH')) return true
  // Single-clamp law (R7): the soft-under pass is gone, so its constant
  // and its raised ceiling may not appear in the footprint body at all.
  // Word-boundary regex: plain includes() would match the
  // CORE_MAX_TRACE_WIDTH substring.
  if (body.includes('SOFT_EDGE_ALPHA') || /\bMAX_TRACE_WIDTH\b/.test(body)) return true
  const re = /traceShapeNoise\s*\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    let depth = 1
    let j = m.index + m[0].length
    while (j < body.length && depth > 0) {
      if (body[j] === '(') depth++
      else if (body[j] === ')') depth--
      j++
    }
    const inner = body.slice(m.index + m[0].length, depth === 0 ? j - 1 : body.length)
    const args = splitTopLevelArgs(inner)
    const key = (args[1] ?? '').trim()
    const channel = (args[3] ?? '').trim()
    if (channel !== '0') return true
    if (!/arc\s*\[/.test(key) && !/arcSlot/.test(key)) return true
  }
  return false
}

/**
 * G3 — every globalAlpha assignment RHS must consist only of the
 * STREAK_ALPHA / opac whitelist (digits, parentheses and `*` allowed).
 * Any pressure, velocity, arc-length or noise identifier in an RHS is
 * D-11's forbidden source shape, and the under-pass constant
 * (SOFT_EDGE_ALPHA) is forbidden outright — R7: ONE fill alpha (the
 * silhouette under-pass is gone, 260929-m2z).
 */
function alphaRhsViolated(body: string): boolean {
  // Single-fill whitelist (R7): only the core streak constant may form
  // an alpha RHS (digits / parens / '*' allowed as glue only). The
  // 260929-j47 two-alpha whitelist is retired with the under-pass.
  const whitelist = /^(?:\s*(?:STREAK_ALPHA|params\.opac|opac|\d+(?:\.\d+)?|[()*]))+$/
  for (const m of body.matchAll(/globalAlpha\s*=\s*([^;\n}]+)/g)) {
    if (!whitelist.test(m[1].trim())) return true
  }
  return false
}

/**
 * The rule engine: stripComments over each entry body, apply the six
 * rules scoped to the entry's source identity, return every violated
 * stable label.
 *
 * Entry labels (source identity): 'paint.ts', 'drawBristleFootprint',
 * 'footprintLanes.ts', 'wet-layer.ts', 'drying.ts'.
 * Violation labels: non-seeded-rng, per-pixel-read, per-pixel-write,
 * non-constant-alpha, paper-read, width-gauge-shape,
 * deposit-law-constant.
 *
 * Region scoping (never widen): G2/G3/G4 scan only the footprint body
 * slice and footprintLanes.ts — paint.ts's pre-existing wet-composite
 * and pickup-snapshot getImageData sites are out of scope, and the
 * paper rule never scans paint.ts whole-file (paperHeight plumbing
 * lives outside the footprint). G5 is footprint-body only. G1 covers
 * paint.ts whole-file (which includes the footprint body) + lanes.
 */
function collectShapeViolations(input: { label: string; body: string }[]): string[] {
  const out: string[] = []
  for (const { label, body: raw } of input) {
    const body = stripComments(raw)

    // G1 — non-seeded RNG (paint.ts whole file + footprint body + lanes)
    if (label === 'paint.ts' || label === 'drawBristleFootprint' || label === 'footprintLanes.ts') {
      if (/Math\.random\s*\(/.test(body)) out.push('non-seeded-rng')
    }

    // G2 + G3 + G4 — region-scoped to the footprint body and lane builder
    if (label === 'drawBristleFootprint' || label === 'footprintLanes.ts') {
      if (/\bgetImageData\s*\(/.test(body)) out.push('per-pixel-read')
      if (/\bputImageData\s*\(/.test(body)) out.push('per-pixel-write')
      if (alphaRhsViolated(body)) out.push('non-constant-alpha')
      if (/\bsampleH\b|\bsampleHFn\b|0\.72|\bpaper/.test(body)) out.push('paper-read')
    }

    // G5 — width-gauge shape (footprint body only)
    if (label === 'drawBristleFootprint' && widthGaugeViolated(body)) {
      out.push('width-gauge-shape')
    }

    // G6 — deposit-law constants (D-08 keep-gate, dry threshold).
    // 260930-wm6: DEPOSIT_KEEP_TIER's VALUE is now a named look lever
    // (user decision 2026-10-01 — one eye-tuned pass, native UAT by eye),
    // so G6 pins its SHAPE (a named const holding an integer literal —
    // never inlined at call sites, never a computed expression). The value
    // bound lives in core/lookLawDigest.test.ts. DRY_ALPHA_THRESHOLD is
    // not a look lever and stays pinned to the byte.
    if (label === 'wet-layer.ts' && !/const\s+DEPOSIT_KEEP_TIER\s*=\s*\d+\b/.test(body)) {
      out.push('deposit-law-constant')
    }
    if (label === 'drying.ts' && !/const\s+DRY_ALPHA_THRESHOLD\s*=\s*1\b/.test(body)) {
      out.push('deposit-law-constant')
    }
  }
  return out
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

  it('G3 constant alpha (single-fill, R7): every globalAlpha RHS in the footprint body and lane builder is the STREAK_ALPHA/opac whitelist only — the under-pass constant is a violation', () => {
    const violations = collectShapeViolations(readRealEntries()).filter((l) => l === 'non-constant-alpha')
    expect(violations).toEqual([])
  })

  it('G4 paper law: no sampleH/sampleHFn/0.72/paper read in the footprint body or lane builder (D-14)', () => {
    const violations = collectShapeViolations(readRealEntries()).filter((l) => l === 'paper-read')
    expect(violations).toEqual([])
  })

  it('G5 width-gauge shape (R7 single-clamp): WIDTH_FLOOR + CORE_MAX_TRACE_WIDTH clamp present, soft-pass tokens absent, traceShapeNoise channel 0 only, gauge arc-keyed (D-12 a/b)', () => {
    const violations = collectShapeViolations(readRealEntries()).filter((l) => l === 'width-gauge-shape')
    expect(violations).toEqual([])
  })

  it('G6 deposit-law constants: wet-layer.ts keeps const DEPOSIT_KEEP_TIER as a named integer lever and drying.ts keeps const DRY_ALPHA_THRESHOLD = 1', () => {
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

  it('G3 control: a non-whitelisted globalAlpha RHS yields non-constant-alpha, the under-pass constant (the old two-alpha good-case) now FAILS, and the STREAK_ALPHA x opac whitelist yields none', () => {
    const bad = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'ctx.globalAlpha = STREAK_ALPHA * opac * noiseAmt' },
    ])
    expect(bad).toContain('non-constant-alpha')
    const pressure = collectShapeViolations([
      { label: 'footprintLanes.ts', body: 'ctx.globalAlpha = 0.5 * pressure' },
    ])
    expect(pressure).toContain('non-constant-alpha')
    // R7 (260929-m2z): the under-pass RHS was the j47 GOOD case — it is
    // now the failing control (the silhouette under-pass is forbidden).
    const underPass = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'ctx.globalAlpha = SOFT_EDGE_ALPHA * opac' },
    ])
    expect(underPass).toContain('non-constant-alpha')
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

  it('G5 control: a body missing the width clamp pair, a body keeping a soft-pass token, a channel-1 noise call and a non-arc gauge key each yield width-gauge-shape; the single-clamp form yields none', () => {
    const noClamp = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'const lw = clamp(value, 0.5, 2)' },
    ])
    expect(noClamp).toContain('width-gauge-shape')
    // R7 single-clamp (260929-m2z): the soft-under ceiling is forbidden —
    // a body that still clamps into MAX_TRACE_WIDTH (even with the core
    // pair present) is a width-gauge-shape violation.
    const softCeiling = collectShapeViolations([
      {
        label: 'drawBristleFootprint',
        body: 'const s = clamp(raw, WIDTH_FLOOR, MAX_TRACE_WIDTH)\nconst c = clamp(raw, WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH)',
      },
    ])
    expect(softCeiling).toContain('width-gauge-shape')
    const singleClamp = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'const c = clamp(raw, WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH)' },
    ])
    expect(singleClamp.filter((l) => l === 'width-gauge-shape')).toEqual([])
    const channel1 = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'const g = clamp(lw * traceShapeNoise(seed, arc[ci] * NW_ARC_SCALE, bi, 1), WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH)' },
    ])
    expect(channel1).toContain('width-gauge-shape')
    const sampleIndexKey = collectShapeViolations([
      { label: 'drawBristleFootprint', body: 'const g = clamp(lw * traceShapeNoise(seed, ci * NW_ARC_SCALE, bi, 0), WIDTH_FLOOR, CORE_MAX_TRACE_WIDTH)' },
    ])
    expect(sampleIndexKey).toContain('width-gauge-shape')
  })

  it('G6 control: a wet-layer source without a named keep tier, or one holding a computed value, or a drying source with a changed dry-alpha threshold yields deposit-law-constant', () => {
    const wet = collectShapeViolations([
      { label: 'wet-layer.ts', body: 'export function transfer() {\n  return 1\n}' },
    ])
    expect(wet).toContain('deposit-law-constant')
    const wetComputed = collectShapeViolations([
      { label: 'wet-layer.ts', body: 'const DEPOSIT_KEEP_TIER = computeTier()' },
    ])
    expect(wetComputed).toContain('deposit-law-constant')
    const wetLet = collectShapeViolations([
      { label: 'wet-layer.ts', body: 'let DEPOSIT_KEEP_TIER = 70' },
    ])
    expect(wetLet).toContain('deposit-law-constant')
    const dryChanged = collectShapeViolations([
      { label: 'drying.ts', body: 'const DRY_ALPHA_THRESHOLD = 2' },
    ])
    expect(dryChanged).toContain('deposit-law-constant')
  })
})
