// ============================================================
//  The coverage channel's lifecycle (Phase 64, plan 64-14) — the
//  three bounded limitations Spike 001 declared.
//
//  Family: source-scan on the existing setup. vitest has no WebGL2, so the
//  byte-level proof (a wet covering stroke moves with its pigment, undo
//  restores the field, Lift destroys it) lives in the probe's captures and
//  committed baselines. What a source scan CAN prove is pinned below.
//
//  Every assertion runs on COMMENT-STRIPPED source: the landed code explains
//  the laws in prose, so a raw grep could be satisfied by a comment alone.
//
//  Laws pinned here:
//   task 1 — advection
//   1. `advectCoverFS` declares only the uniforms it reads and no keep
//      factor: coverage never decays through the settle.
//   2. Its mobility gate, near-zero guard, back-trace, brush-weighted
//      diffusion and edge term are the SAME literals `advectInkFS` uses.
//   3. The program registers outside the pinned 23-entry literal.
//   4. `step()` draws it into the cover write half and swaps, after the ink
//      swap and before the dirty union.
//
//   task 2 — undo, whole-document transport, resize
//   5. `LayerId` carries `'cover'`; pool 0 has five formats with coverage
//      last; `snapshotLayers()` and `travel()`'s pool-0 map agree, entry for
//      entry (a parsed length check, so a sixth channel cannot drift).
//   6. `captureWhole` reads the cover field at one channel and `uploadWhole`
//      writes it into BOTH halves.
//
//   task 3 — Lift
//   7. `lift()` draws `this.cover.read` after the fixed draw and before
//      `drawRelief`, inside the already-enabled blend pair, with no new
//      uniform and the touch / pool-1 protection still ahead of every draw.
//
//   64-20 — the film-presence gate
//   8. Coverage transport is scaled by the display's OWN reconstruction of the
//      combined film: `filmPresence` inlines `displayBasisGLSL()` and the
//      display's granulation literal, with the paper-white scan's 250/255 line
//      as two derived constants. No second basis, no keep, no edge term; a
//      texel whose film leaves paper-white transports nothing and keeps its
//      value exactly.
//   9. The DEPOSIT is deliberately UNGATED (64-20, revised): `coverMaskFS`
//      writes its committed union coverage exactly as before. The plan's fix
//      is the transport gate — "the deposit is already clean" — and a deposit
//      gate evaluated on the dab's own TRANSIENT film starved a legitimate
//      partial cover (the white-over-blue Body-60 gain fell to 0). One
//      definition, exactly two inclusions: transport and clearance.
//   10. `filmPresence` measures its luma on the scan's OWN 8-bit grid: the
//      reconstructed sRGB channels are quantized to bytes before the mean, so
//      the gate's line and the scan's "byte mean >= 250" are one test.
//   11. The CAPTURE-TIME CLEARANCE (64-20 decision A) is the second inclusion:
//      at the export boundary only — never displayFS's interactive output —
//      the pigment capture's coverage alpha is zeroed exactly where the final
//      film's presence is exactly 0; every kept texel passes through
//      byte-identical (a binary step, never a scale, and the display's own
//      RGB is never re-derived). It is scoped to texels that actually carry
//      coverage (cov > 0), so a Body-0 export — whose alpha is the pigment's
//      own darkness — stays byte-identical.
//
//   261125-kvl — the per-stroke layer's lifecycle (Task 5)
//   12. `openLayer` runs at BOTH stroke-creation sites (scriptBegin and the
//      pointerdown handler), and nowhere else — a stroke opened on one seam
//      and not the other merges on one drive and leaks on the other.
//   13. `commitLayer(s)` runs in the ending branch BEFORE the stroke is
//      dropped and before the end callbacks, merges only the stroke it owns,
//      and is a no-op when no layer is open. The merge itself draws once.
//   14. Every abandon path discards (never merges): clear, resetSheet,
//      abortStroke and travel. `discardLayer` is guarded by `layerOpen` and
//      never touches a nulled field, so a recreate path that nulls first can
//      still call it.
//   15. Every recreate path forgets the layer BEFORE disposing/allocating its
//      targets (createDocument, resizeDocument, applyWhole, restore), because
//      `ensureLayer` skips re-allocation while any field survives; the lazy
//      set joins `docTargets()`, so disposal and the sheet wipe reach it.
//   16. `layerStrokeActive` reads `params.edgeFade` live and requires the
//      bristle Brush with a bristle response — the SAME predicate at stroke
//      start, every dab and the merge.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { displayFS } from './shaders'

const HERE = dirname(fileURLToPath(import.meta.url))
const RAW_ENGINE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const RAW_SHADERS = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')

/** Remove block and line comments so prose can neither satisfy nor trip a pin. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/[^\n]*/g, '')
}

const ENGINE = stripComments(RAW_ENGINE)
const SHADERS = stripComments(RAW_SHADERS)

/** Slice the source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

// Source pins report the missing LITERAL, never the whole source: a raw
// `toContain` would dump the file into the RED report and break its format.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

/** Count non-overlapping occurrences, so "one definition" is arithmetic. */
function countOccurrences(source: string, needle: string): number {
  let count = 0
  let from = source.indexOf(needle)
  while (from >= 0) {
    count += 1
    from = source.indexOf(needle, from + needle.length)
  }
  return count
}

const ADVECT_COVER = () => sliceBetween(SHADERS, 'export const advectCoverFS', '`;')
const ADVECT_INK = () => sliceBetween(SHADERS, 'export const advectInkFS', '`;')
// displayFS is emitted by displaySource(false) (261125-kvl Task 4); the export
// is the shipped compositor's exact shader text.
const DISPLAY = () => displayFS
const FILM_PRESENCE = () => sliceBetween(SHADERS, 'const FILM_PRESENCE =', '`;')
const COVER_MASK = () => sliceBetween(SHADERS, 'export const coverMaskFS', '`;')
const COVER_CLEAR = () => sliceBetween(SHADERS, 'export const coverClearFS', '`;')
const READBACK = () => sliceBetween(ENGINE, 'private readback(', 'resize()')
const CLEAR_PASS = () => sliceBetween(ENGINE, 'private clearPaperWhiteCoverage(', 'private readback(')
const STEP = () => sliceBetween(ENGINE, 'private step(dt: number)', 'private trimActive()')
const LIFT = () =>
  sliceBetween(
    ENGINE,
    'private lift(x: number, y: number, r: number, angle: number, amount: number)',
    'private dryTau()',
  )
const DEPOSIT = () => sliceBetween(ENGINE, 'private coverageDeposit(', 'private brushWet(')

/** Index of the first occurrence of `needle` at or after `from`; throws when absent. */
function firstIndexAfter(source: string, needle: string, from = 0): number {
  const at = source.indexOf(needle, from)
  expect(at, `anchor not found: ${needle}`).toBeGreaterThanOrEqual(0)
  return at
}

/**
 * Count the top-level comma-separated entries of the bracket group opening at
 * `openAt`. Commas nested inside a child entry (the travel map's pairs) do not
 * count, so a desynchronised layer list is caught by arithmetic, not by a
 * hand-maintained number.
 */
function countTopLevelEntries(source: string, openAt: number): number {
  let depth = 0
  let entries = 1
  for (let i = openAt; i < source.length; i++) {
    const ch = source[i]
    if (ch === '[' || ch === '(' || ch === '{') depth += 1
    else if (ch === ']' || ch === ')' || ch === '}') {
      depth -= 1
      if (depth === 0) return entries
    } else if (ch === ',' && depth === 1) {
      entries += 1
    }
  }
  throw new Error(`unterminated bracket group at ${openAt}`)
}

describe('the coverage advect program (64-14 task 1)', () => {
  it('declares only the uniforms it reads, with a single clamped output', () => {
    const cover = ADVECT_COVER()
    expectContains(cover, 'layout(location=0) out vec4 o0;')
    // 64-20: the paper stays declared here; the combined film's four channels
    // and the display's granulation moved into the shared FILM_PRESENCE
    // snippet, so the transport and the clearance read one declaration.
    expectContains(cover, 'uniform sampler2D uVelocity, uCover, uWet, uPaper;')
    expectContains(cover, 'uniform vec2 uSimTexel, uTexel;')
    expectContains(cover, 'uniform float uDt, uBleed, uEdge, uAspect;')
    expectContains(cover, 'uniform vec3 uBrush;')
    const film = FILM_PRESENCE()
    expectContains(film, 'uniform sampler2D uInkA, uInkB, uFixedA, uFixedB;')
    expectContains(film, 'uniform float uGranulation;')
    // T-64-41 / the no-decay prohibition: no keep factor, no settle term.
    expectNotContains(cover, 'uKeep')
    expectNotContains(cover, 'uSettle')
    // Coverage is a committed alpha in [0, 1]: the transported sum is clamped,
    // scaled per texel by the film's presence.
    expectContains(cover, 'clamp(c + dC * p, 0.0, 1.0)')
  })

  it('shares the ink law literals: mobility, near-zero guard, back-trace, fluxes', () => {
    const cover = ADVECT_COVER()
    const ink = ADVECT_INK()
    for (const source of [cover, ink]) {
      expectContains(source, 'float mobility(float w){ return smoothstep(0.02, 0.45, w); }')
      expectContains(source, 'if (m < 0.002)')
      expectContains(source, 'vec2 coord = vUv - uDt * vel * uSimTexel * m;')
      expectContains(source, 'float diffusion = clamp(uBleed * (0.25 + 1.3 * brush) * 0.3, 0.0, 0.15);')
      expectContains(source, 'float e = clamp(edge * (w - wn), -0.08, 0.08) * g;')
      for (const off of [
        'face(vec2( uTexel.x, 0.0)',
        'face(vec2(-uTexel.x, 0.0)',
        'face(vec2(0.0,  uTexel.y)',
        'face(vec2(0.0, -uTexel.y)',
      ]) {
        expectContains(source, off)
      }
    }
    // The single channel's own expressions: the unchanged early return, the
    // semi-Lagrangian mix gated by the film's presence, and the face
    // accumulation on one scalar.
    expectContains(cover, 'if (m < 0.002){ o0 = vec4(C); return; }')
    expectContains(cover, 'float c = mix(C, texture(uCover, coord).x, m * p);')
    expectContains(cover, 'dC += d * (Cn - C) - (e > 0.0 ? e * C : e * Cn);')
  })

  it("gates transport on the display's own film reconstruction (64-20)", () => {
    const cover = ADVECT_COVER()
    const film = FILM_PRESENCE()
    const display = DISPLAY()
    expectContains(cover, '${FILM_PRESENCE}')
    // The scan's own line and its margin, derived once from 250 of 255 luma.
    expectContains(film, 'const float PAPER_WHITE = 250.0 / 255.0;')
    expectContains(film, 'const float PAPER_WHITE_RAMP = 5.0 / 255.0;')
    expectContains(film, 'float filmPresence(vec2 uv){')
    // Main computes the presence after the near-zero guard and scales with it.
    expectContains(cover, 'float p = filmPresence(vUv);')
    // ONE granulation literal: the display's own expression, in the snippet
    // the display and both coverage programs share.
    for (const source of [film, display]) {
      expectContains(source, '1.0 + uGranulation * (0.5 - paper.g) * 2.2')
    }
    // ONE reconstruction: the display's own Kubelka-Munk basis block.
    expectContains(film, '${displayBasisGLSL()}')
    // The gate ignores the display's edge darkening on purpose: its k is
    // gran * (1 + uEdgeDarken * edge) >= gran, so the gate is no darker than
    // the display, and a texel it lets transport cannot read paper-white.
    expectNotContains(film, 'uEdgeDarken')
    expectNotContains(cover, 'uEdgeDarken')
  })

  it('registers the program outside the pinned 23-entry literal', () => {
    expectContains(ENGINE, 'this.programs.advectCover = this.g.program(S.advectCoverFS);')
    const bodyCoverAt = ENGINE.indexOf('this.programs.bodyCover = this.g.program(S.bodyCoverFS);')
    const advectCoverAt = ENGINE.indexOf('this.programs.advectCover = this.g.program(S.advectCoverFS);')
    expect(bodyCoverAt).toBeGreaterThanOrEqual(0)
    expect(advectCoverAt).toBeGreaterThan(bodyCoverAt)
  })
})

describe('the cover pass in step() (64-14 task 1)', () => {
  it('draws into the write half and swaps, after the ink swap and before the dirty union', () => {
    const step = STEP()
    const inkSwap = step.indexOf('g.draw(this.ink.write, rect); this.ink.swap();')
    const bind = step.indexOf('P.advectCover.bind();')
    const draw = step.indexOf('g.draw(this.cover.write, rect); this.cover.swap();')
    const dirty = step.indexOf('this.dirty = union(this.dirty, rect);')
    expect(inkSwap, 'the ink advect draw+swap').toBeGreaterThanOrEqual(0)
    expect(bind, 'the cover pass bind').toBeGreaterThan(inkSwap)
    expect(draw, 'the cover draw+swap').toBeGreaterThan(bind)
    expect(dirty, 'the dirty union').toBeGreaterThan(draw)
  })

  it('binds the same velocity, wet and texel locals the ink advect used, and no keep', () => {
    const step = STEP()
    const block = sliceBetween(step, 'P.advectCover.bind();', 'this.cover.swap()')
    expectContains(block, 'g.bindTex(0, vel.read.tex[0])')
    expectContains(block, 'g.bindTex(1, this.cover.read.tex[0])')
    expectContains(block, 'g.bindTex(2, this.wet.read.tex[0])')
    // 64-20: the combined film — the mobile ink AFTER its swap (post-advect)
    // plus the single fixed target — and the paper the display granulates on.
    expectContains(block, 'g.bindTex(3, this.ink.read.tex[0])')
    expectContains(block, 'g.bindTex(4, this.ink.read.tex[1])')
    expectContains(block, 'g.bindTex(5, this.fixed.tex[0])')
    expectContains(block, 'g.bindTex(6, this.fixed.tex[1])')
    expectContains(block, 'g.bindTex(7, this.paper.tex[0])')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uGranulation, this.params.granulation * 0.55);')
    expectContains(block, 'gl.uniform2fv(P.advectCover.u.uSimTexel, simTexel);')
    expectContains(block, 'gl.uniform2fv(P.advectCover.u.uTexel, texel);')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uDt, dt);')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uBleed, this.params.bleed);')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uEdge, this.params.edge * 1.4);')
    expectContains(block, 'gl.uniform1f(P.advectCover.u.uAspect, this.dw / this.dh);')
    expectContains(block, 'gl.uniform3f(P.advectCover.u.uBrush, this.brushNow.x, this.brushNow.y, this.brushNow.r);')
    // The settlement's keep factor belongs to the ink's pigment only.
    expectNotContains(block, 'uKeep')
  })
})

describe('coverage rides the document lifecycle (64-14 task 2)', () => {
  it("adds 'cover' to LayerId after 'relief'", () => {
    // 64-24 appends 'lastTouch' after 'cover'; the cover entry stays present.
    expectContains(
      ENGINE,
      "export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet' | 'relief' | 'cover' | 'lastTouch';",
    )
  })

  it('gives pool 0 six formats with coverage last and the last-touch layer fifth', () => {
    const alloc = sliceBetween(ENGINE, 'private allocateHistory()', 'private docTargets()')
    expectContains(alloc, 'formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R, HALF_FLOAT_R, FLOAT_R, HALF_FLOAT_R]')
  })

  it('returns six snapshotLayers() views with the cover read half last', () => {
    const snap = sliceBetween(ENGINE, 'private snapshotLayers()', 'private drawSplat(')
    expectContains(
      snap,
      'return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0], this.lastTouch.read.views[0], this.cover.read.views[0]];',
    )
  })

  it("lists the cover pair last in travel()'s pool-0 layer map", () => {
    const travel = sliceBetween(ENGINE, "private travel(dir: 'undo' | 'redo'", 'const res = dir ===')
    expectContains(
      travel,
      '[[ink.read.views[0], ink.write.views[0]], [ink.read.views[1], ink.write.views[1]], [wet.read.views[0], wet.write.views[0]], [this.relief.views[0]], [this.lastTouch.read.views[0], this.lastTouch.write.views[0]], [this.cover.read.views[0], this.cover.write.views[0]]],',
    )
  })

  it('reads cover in captureWhole and uploads it into both halves', () => {
    const whole = sliceBetween(ENGINE, 'private captureWhole()', 'private applyWhole(')
    expectContains(whole, 'cover: read(this.cover.read.views[0], 1),')
    expectContains(
      whole,
      'for (const t of [this.cover.read, this.cover.write]) up(t.tex[0], gl.RED, whole.layers.cover);',
    )
  })

  it('keeps the three positional lists the same length — six entries, last-touch fifth, cover last', () => {
    const alloc = sliceBetween(ENGINE, 'private allocateHistory()', 'private docTargets()')
    const formatsAt = firstIndexAfter(alloc, 'formats: [')
    const formats = countTopLevelEntries(alloc, formatsAt + 'formats: '.length)

    const snap = sliceBetween(ENGINE, 'private snapshotLayers()', 'private drawSplat(')
    const snapshotAt = firstIndexAfter(snap, 'return [')
    const snapshot = countTopLevelEntries(snap, snapshotAt + 'return '.length)

    const travel = sliceBetween(ENGINE, "private travel(dir: 'undo' | 'redo'", 'const res = dir ===')
    const layersAt = firstIndexAfter(travel, 'const layers = [')
    const poolOpen = firstIndexAfter(travel, '[', layersAt + 'const layers = '.length + 1)
    const travelPool0 = countTopLevelEntries(travel, poolOpen)

    expect(formats, 'allocateHistory pool-0 formats').toBe(6)
    expect(snapshot, 'snapshotLayers() entries').toBe(6)
    expect(travelPool0, "travel() pool-0 layer entries").toBe(6)
    // One arithmetic gate instead of three hand-maintained numbers: a seventh
    // channel added to only some of the lists fails here.
    expect(formats).toBe(snapshot)
    expect(snapshot).toBe(travelPool0)
  })
})

describe('Lift destroys coverage (64-14 task 3)', () => {
  it('draws the cover field after fixed and before relief, under the bound program', () => {
    const lift = LIFT()
    const fixedDraw = firstIndexAfter(lift, 'g.draw(this.fixed, rect);')
    const coverDraw = firstIndexAfter(lift, 'g.draw(this.cover.read, rect);')
    const reliefDraw = firstIndexAfter(lift, 'this.drawRelief(')
    expect(coverDraw, 'the cover draw follows the fixed draw').toBeGreaterThan(fixedDraw)
    expect(reliefDraw, 'drawRelief follows the cover draw').toBeGreaterThan(coverDraw)
  })

  it('sits inside the blend pair and adds no uniform after the fixed draw', () => {
    const lift = LIFT()
    const blendOn = firstIndexAfter(lift, 'gl.enable(gl.BLEND);')
    const fixedDraw = firstIndexAfter(lift, 'g.draw(this.fixed, rect);')
    const coverDraw = firstIndexAfter(lift, 'g.draw(this.cover.read, rect);')
    const reliefDraw = firstIndexAfter(lift, 'this.drawRelief(')
    const blendOff = firstIndexAfter(lift, 'gl.disable(gl.BLEND);')
    expect(fixedDraw).toBeGreaterThan(blendOn)
    expect(coverDraw).toBeGreaterThan(fixedDraw)
    expect(reliefDraw).toBeGreaterThan(coverDraw)
    expect(blendOff).toBeGreaterThan(reliefDraw)
    // The uAmount last written before the fixed draw is the paint amount —
    // exactly what coverage must lose. A uniform here would re-scale it.
    const between = lift.slice(fixedDraw, reliefDraw)
    expectNotContains(between, 'uniform')
  })

  it('touches and protects pool 1 before the first draw', () => {
    const lift = LIFT()
    const firstDraw = lift.indexOf('g.draw(this.ink.read, rect);')
    expect(firstDraw, 'the first lift draw').toBeGreaterThanOrEqual(0)
    const preamble = lift.slice(0, firstDraw)
    expectContains(preamble, 'this.touch(rect);')
    // Lift reaches fixed pigment, so the fixed pool is saved before its draw —
    // through the LIVE-SEED guarded form (setStepRecording(false) suppresses).
    expectContains(preamble, 'this.protectHistory(1,')
  })
})

describe('the film gate keeps ONE reconstruction (64-20 decision A)', () => {
  it('includes the one FILM_PRESENCE definition from the transport and the clearance only', () => {
    expectContains(ADVECT_COVER(), '${FILM_PRESENCE}')
    expectNotContains(COVER_MASK(), '${FILM_PRESENCE}')
    // 64-20 decision A: the capture-time clearance is the second inclusion —
    // still ONE definition, so transport and clearance share a single
    // criterion. The basis and granulation counts stay at two because the
    // snippet carries each once, beside displayFS's own copy.
    expectContains(COVER_CLEAR(), '${FILM_PRESENCE}')
    expect(countOccurrences(SHADERS, 'const FILM_PRESENCE =')).toBe(1)
    expect(countOccurrences(SHADERS, '${FILM_PRESENCE}')).toBe(2)
    expect(countOccurrences(SHADERS, '${displayBasisGLSL()}')).toBe(2)
    expect(countOccurrences(SHADERS, '1.0 + uGranulation * (0.5 - paper.g) * 2.2')).toBe(2)
  })

  it('writes the committed union coverage with no film gate', () => {
    const mask = COVER_MASK()
    expectContains(mask, 'float m = footprintMask();')
    expectContains(mask, 'o0 = vec4(uAmount * (1.0 - exp(-uDensity * m)));')
    // The deposit gate was evaluated on the dab's own TRANSIENT film — the
    // ink it was still laying down — and starved a legitimate partial cover
    // (white-over-blue Body 60: gain 0.08 -> 0). The census is closed at the
    // capture boundary instead, where the FINAL film is known: the clearance
    // zeroes exactly the coverage-bearing paper-white texels, by construction.
    expectNotContains(mask, 'filmPresence')
    expectNotContains(mask, 'uGranulation')
    expectNotContains(mask, '${FILM_PRESENCE}')
  })

  it('keeps the union blend and binds no film on the deposit draw', () => {
    const deposit = DEPOSIT()
    const block = sliceBetween(deposit, 'const m = this.programs.coverMask;', 'g.draw(this.cover.read, rect);')
    expectContains(block, 'gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);')
    expectContains(block, 'gl.uniform1f(m.u.uAmount, amount);')
    expectContains(block, 'gl.uniform1f(m.u.uDensity, density);')
    // No film, no granulation: an ungated union draw reads only its own
    // footprint and the two paint amounts.
    expectNotContains(block, 'uInkA')
    expectNotContains(block, 'uInkB')
    expectNotContains(block, 'uFixedA')
    expectNotContains(block, 'uFixedB')
    expectNotContains(block, 'uGranulation')
  })
})

describe("the gate runs on the scan's own 8-bit grid (64-20 decision B)", () => {
  it('quantizes the reconstructed sRGB channels to bytes before the mean', () => {
    const film = FILM_PRESENCE()
    expectContains(film, 'vec3 q = floor(s * 255.0 + 0.5) / 255.0;')
    expectContains(film, 'float luma = (q.r + q.g + q.b) / 3.0;')
    expectContains(film, 'return 1.0 - smoothstep(PAPER_WHITE - PAPER_WHITE_RAMP, PAPER_WHITE, luma);')
    // The continuous mean is the form the scan's byte comparison disagreed
    // with: a texel at 249.6/255 kept a nonzero trickle while reading byte 250.
    expectNotContains(film, '(s.r + s.g + s.b) / 3.0')
  })
})

describe('the capture-time clearance closes the census (64-20 decision A)', () => {
  it('defines ONE clearance program on the shared FILM_PRESENCE snippet', () => {
    const clear = COVER_CLEAR()
    // The same criterion the transport uses — one definition, two inclusions
    // (the arithmetic lives in the gate-shape test above).
    expectContains(clear, '${FILM_PRESENCE}')
    expectContains(clear, 'uniform sampler2D uSrc, uPaper, uCover;')
    expectContains(clear, 'float p = filmPresence(vUv);')
    // A BINARY clear: the alpha is zeroed exactly where the presence is
    // exactly 0 and passes through untouched everywhere else. A partial scale
    // would have let the export's un-premultiply re-derive (and inflate) the
    // pigment at every cleared texel.
    expectContains(clear, 'o0 = vec4(src.rgb, src.a * (1.0 - cleared));')
    // The display's own RGBA is the only colour source: the clearance never
    // reconstructs the film's colour or repaints the pigment.
    expectContains(clear, 'vec4 src = texture(uSrc, vUv);')
  })

  it('scopes the clear to COVERAGE, so Body 0 exports stay byte-identical', () => {
    const clear = COVER_CLEAR()
    expectContains(clear, 'float cov = texture(uCover, vUv).x;')
    // The alpha a paper-white film must not keep is the coverage part of
    // max(darkness, cover). With cov == 0 the texel carries no coverage at
    // all — its alpha is the pigment's own faint darkness, which the exported
    // pigment layer keeps exactly (MED-20: neutral-pigment and watercolor-50
    // are byte-identical, no baseline edit).
    expectContains(clear, 'float cleared = (p < 0.0001 && cov > 0.0) ? 1.0 : 0.0;')
    // A darkness-only texel cannot be a census texel: paper-white film bounds
    // `1 - min(rgb)` at 15/255, far below the scan's 0.5 alpha line, so every
    // counted texel is coverage-bearing and the census still closes.
    expectNotContains(clear, 'uKeep')
    expectNotContains(clear, 'uSettle')
  })

  it('runs at the capture boundary only, never on the interactive compositor', () => {
    expectContains(ENGINE, 'this.programs.coverClear = this.g.program(S.coverClearFS);')
    const readback = READBACK()
    // Pigment capture only: every other export mode reads the display's output
    // exactly as before.
    expectContains(readback, 'if (mode === MODE.pigment)')
    expectContains(readback, 'this.clearPaperWhiteCoverage(')
    // render() draws displayFS straight to the canvas for the live compositor;
    // the clearance must not leak into that path.
    const render = sliceBetween(ENGINE, 'private render()', 'private schedule()')
    expectNotContains(render, 'coverClear')
    expectNotContains(render, 'clearPaperWhiteCoverage')
    // The pass reads the very film the gate reconstructs: the live ink pair,
    // the fixed pair, the sheet — with the display's own granulation.
    const pass = CLEAR_PASS()
    expectContains(pass, 'g.bindTex(0, source)')
    expectContains(pass, 'g.bindTex(2, this.ink.read.tex[0])')
    expectContains(pass, 'g.bindTex(3, this.ink.read.tex[1])')
    expectContains(pass, 'g.bindTex(4, this.fixed.tex[0])')
    expectContains(pass, 'g.bindTex(5, this.fixed.tex[1])')
    // The coverage scope reads the live committed cover field — the same one
    // displayFS samples for mode 4's alpha.
    expectContains(pass, 'g.bindTex(6, this.cover.read.tex[0])')
    expectContains(pass, 'gl.uniform1f(p.u.uGranulation, this.params.granulation * 0.55);')
  })

  it("leaves displayFS's law untouched — the clearance is not a display mode", () => {
    const display = DISPLAY()
    expectNotContains(display, 'coverClear')
    expectContains(display, 'o = vec4(pigment * alpha * shade, alpha);')
  })
})

const SCRIPT_BEGIN = () =>
  sliceBetween(ENGINE, 'scriptBegin(tool: Tool, x: number, y: number, pressure: number,', 'this.queue.push({ x, y, p: scriptPressure')
const POINTERDOWN = () =>
  sliceBetween(ENGINE, 'this.stroke = {\n        pointerId: e.pointerId', 'this.pushSample(e);')
const COMMIT_LAYER = () => sliceBetween(ENGINE, 'private commitLayer(s: Stroke) {', 'private bindLayerAlpha(')
const DISCARD_LAYER = () => sliceBetween(ENGINE, 'private discardLayer() {', 'private forgetLayer() {')
const FORGET_LAYER = () => sliceBetween(ENGINE, 'private forgetLayer() {', 'private commitLayer(s: Stroke) {')
const ENSURE_LAYER = () => sliceBetween(ENGINE, 'private ensureLayer() {', 'private openLayer(')
const LAYER_STROKE_ACTIVE = () =>
  sliceBetween(ENGINE, 'private layerStrokeActive(s: Stroke): boolean {', 'private ensureLayer()')
const DOC_TARGETS = () => sliceBetween(ENGINE, 'private docTargets(): Target[] {', 'private layerTargets()')

describe('the stroke layer opens at both stroke-creation sites (261125-kvl task 5)', () => {
  it('calls openLayer exactly twice — once per creation seam, nowhere else', () => {
    expect(countOccurrences(ENGINE, 'this.openLayer(this.stroke);')).toBe(2)
    // scriptBegin: the scripted stroke is created, then the layer decision runs
    // right after the history step and before the first sample is queued.
    const script = SCRIPT_BEGIN()
    expectContains(script, "this.beginStep('script', step);")
    expectContains(script, 'this.openLayer(this.stroke);')
    expect(script.indexOf('this.openLayer(this.stroke);')).toBeGreaterThan(
      script.indexOf("this.beginStep('script', step);"),
    )
    // pointerdown: the live stroke is created and the layer decision runs BEFORE
    // the history step opens (the dabs land in the step the stroke just began).
    const pointer = POINTERDOWN()
    expectContains(pointer, 'this.openLayer(this.stroke);')
    expect(pointer.indexOf('this.openLayer(this.stroke);')).toBeGreaterThan(pointer.indexOf('pointerId: e.pointerId'))
    expect(pointer.indexOf('this.openLayer(this.stroke);')).toBeLessThan(
      pointer.indexOf("this.beginStep('stroke', STROKE_LABEL[tool]);"),
    )
  })

  it('gates the decision on the live Edge amount, the bristle Brush and a bristle response', () => {
    const predicate = LAYER_STROKE_ACTIVE()
    expectContains(
      predicate,
      'return this.params.edgeFade > 0 && s.tool === \'brush\' && isBristleResponse(this.brush);',
    )
    // Read live, never captured at open: a mid-stroke amount change moves the
    // display and the merge together.
    expectNotContains(predicate, 'bristleContent')
  })

  it('allocates each of the five targets once and skips while every field survives', () => {
    const ensure = ENSURE_LAYER()
    expectContains(ensure, 'if (this.layerAllocated && this.layerInk !== null && this.layerFilm !== null')
    expectContains(ensure, '&& this.layerRelief !== null && this.mergeRelief !== null) return;')
    expectContains(ensure, 'this.layerInk = g.double(this.dw, this.dh, [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA], gl.LINEAR);')
    expectContains(ensure, 'this.layerFilm = g.target(this.dw, this.dh, [HALF_FLOAT_R, HALF_FLOAT_R], gl.NEAREST);')
    expectContains(ensure, 'this.layerRelief = g.target(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);')
    expectContains(ensure, 'this.mergeRelief = g.target(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);')
    expectContains(ensure, 'this.layerAllocated = true;')
  })
})

describe('the stroke end commits the layer exactly once (261125-kvl task 5)', () => {
  it('runs in the ending branch before the stroke is dropped and before the callbacks', () => {
    expect(countOccurrences(ENGINE, 'this.commitLayer(s);')).toBe(1)
    const ending = firstIndexAfter(ENGINE, 'if (s.ending) {')
    const commit = firstIndexAfter(ENGINE, 'this.commitLayer(s);', ending)
    const dropped = firstIndexAfter(ENGINE, 'this.stroke = null;', commit)
    const endTool = firstIndexAfter(ENGINE, 'this.callbacks.onStrokeTool?.(null);', dropped)
    const endStroke = firstIndexAfter(ENGINE, 'this.callbacks.onStrokeEnd?.(s.tool);', endTool)
    // The end callbacks only fire for a live pointer — a scripted drive settles
    // through the tick, never through the pointer's callback pair.
    expectContains(ENGINE.slice(commit, endStroke), 'if (s.pointerId !== SCRIPT_POINTER) {')
    expect(commit).toBeGreaterThan(ending)
    expect(dropped).toBeGreaterThan(commit)
    expect(endTool).toBeGreaterThan(dropped)
    expect(endStroke).toBeGreaterThan(endTool)
  })

  it('merges only the stroke it owns, once, and is inert with no layer open', () => {
    const body = COMMIT_LAYER()
    expectContains(body, 'if (!this.layerOpen) return;')
    // A foreign stroke's layer is discarded, never merged.
    expectContains(body, 'if (this.layerStroke !== s) {')
    expectContains(body, 'this.discardLayer();')
    expectContains(body, 'if (rect) this.mergeStrokeLayer(rect);')
    // ONE merge call site in the commit — the counter advances by exactly one.
    expect(countOccurrences(body, 'this.mergeStrokeLayer(rect);')).toBe(1)
  })
})

describe('every abandon path discards the layer (261125-kvl task 5)', () => {
  it('discards in clear, resetSheet, abortStroke and travel', () => {
    const clear = sliceBetween(ENGINE, 'clear() {', 'resetSheet() {')
    expectContains(clear, 'this.discardLayer();')
    const reset = sliceBetween(ENGINE, 'resetSheet() {', 'abortStroke() {')
    expectContains(reset, 'this.discardLayer();')
    const abort = sliceBetween(ENGINE, 'abortStroke() {', 'undo() {')
    expectContains(abort, 'this.discardLayer();')
    const travel = sliceBetween(ENGINE, "private travel(dir: 'undo' | 'redo'", 'const res = dir ===')
    expectContains(travel, 'this.discardLayer();')
    // Each is a discard BEFORE the state move that would strand the film:
    // clear and resetSheet drop the stroke first, then discard; abort and
    // travel do the same.
    expect(clear.indexOf('this.discardLayer();')).toBeGreaterThan(clear.indexOf('this.stroke = null;'))
    expect(reset.indexOf('this.discardLayer();')).toBeGreaterThan(reset.indexOf('this.stroke = null;'))
    expect(abort.indexOf('this.discardLayer();')).toBeGreaterThan(abort.indexOf('this.stroke = null;'))
    expect(travel.indexOf('this.discardLayer();')).toBeGreaterThan(travel.indexOf('this.stroke = null;'))
  })

  it('is idempotent and never clears a nulled target', () => {
    const body = DISCARD_LAYER()
    const guard = body.indexOf('if (this.layerOpen) {')
    expect(guard).toBeGreaterThanOrEqual(0)
    // The guard's closing brace at the method's own indent (the earlier `}`
    // in `const { g } = this;` is destructuring, not the block's end).
    const close = body.indexOf('\n    }', guard)
    expect(close).toBeGreaterThan(guard)
    // Every clear sits INSIDE the guard, on the non-null assertion the guard
    // proves; nothing after the guard touches a target.
    for (const clear of [
      'g.clearTarget(this.layerInk!.read);',
      'g.clearTarget(this.layerInk!.write);',
      'g.clearTarget(this.layerFilm!);',
      'g.clearTarget(this.layerRelief!);',
    ]) {
      const at = body.indexOf(clear)
      expect(at, clear).toBeGreaterThan(guard)
      expect(at, clear).toBeLessThan(close)
    }
    // The bookkeeping resets run unconditionally, after the guard — a second
    // call finds layerOpen false and only re-nulls.
    for (const reset of ['this.layerOpen = false;', 'this.layerStroke = null;', 'this.layerRect = null;']) {
      expect(body.indexOf(reset), reset).toBeGreaterThan(close)
    }
    // Exactly the two ink halves are asserted non-null, both inside the guard —
    // no third use can reach a nulled field.
    expect(countOccurrences(body, 'this.layerInk!')).toBe(2)
  })
})

describe('every recreate path forgets the layer first (261125-kvl task 5)', () => {
  it('forgets before disposing/allocating in createDocument', () => {
    const body = sliceBetween(ENGINE, 'private createDocument([w, h]: [number, number]) {', 'this.paperSeed =')
    const forget = body.indexOf('this.forgetLayer();')
    expect(forget).toBeGreaterThanOrEqual(0)
    expect(forget).toBeLessThan(body.indexOf('this.g.disposeTargets();'))
    expect(forget).toBeLessThan(body.indexOf('this.allocateTargets();'))
    expect(forget).toBeLessThan(body.indexOf('this.allocateHistory();'))
  })

  it('forgets before allocating in resizeDocument, and captures the old set first', () => {
    const body = sliceBetween(ENGINE, 'resizeDocument(w: number, h: number) {', 'const sx = Math.max(0, -ox)')
    const forget = body.indexOf('this.forgetLayer();')
    expect(forget).toBeGreaterThanOrEqual(0)
    // The old set is captured BEFORE the fields are nulled, so the layer
    // targets ride `docTargets()` into the disposal at the method's end.
    expect(body.indexOf('const old = { targets: this.docTargets(),')).toBeGreaterThanOrEqual(0)
    expect(body.indexOf('const old = { targets: this.docTargets(),')).toBeLessThan(forget)
    expect(forget).toBeLessThan(body.indexOf('this.allocateTargets();'))
    expect(forget).toBeLessThan(body.indexOf('this.history.beginBoundary({ kind: \'resize\''))
  })

  it('forgets before allocating and disposing in applyWhole', () => {
    const body = sliceBetween(ENGINE, 'private applyWhole(whole: WholeDoc, paperOrigin: [number, number]) {', 'this.history.resize(')
    const forget = body.indexOf('this.forgetLayer();')
    expect(forget).toBeGreaterThanOrEqual(0)
    expect(forget).toBeLessThan(body.indexOf('this.allocateTargets();'))
    expect(forget).toBeLessThan(body.indexOf('old.forEach(t => this.g.disposeTarget(t));'))
  })

  it('forgets before disposing/allocating in restore, and nulls the stroke', () => {
    const body = sliceBetween(ENGINE, 'restore(s: DocumentSnapshot) {', 'this.resetPaintState();')
    const forget = body.indexOf('this.forgetLayer();')
    expect(forget).toBeGreaterThanOrEqual(0)
    expect(body.indexOf('this.stroke = null;')).toBeGreaterThanOrEqual(0)
    expect(forget).toBeLessThan(body.indexOf('this.g.disposeTargets();'))
    expect(forget).toBeLessThan(body.indexOf('this.allocateTargets();'))
    expect(forget).toBeLessThan(body.indexOf('this.allocateHistory();'))
  })

  it('joins docTargets() through layerTargets(), before the pinned cover tail', () => {
    const targets = DOC_TARGETS()
    expectContains(targets, '...this.layerTargets(),')
    // Coverage must stay LAST: the sheet-wipe and disposal order pins it.
    expect(targets.indexOf('...this.layerTargets(),')).toBeLessThan(targets.indexOf('this.cover.read, this.cover.write]'))
    const layerTargets = sliceBetween(ENGINE, 'private layerTargets(): Target[] {', 'private ensureLayer()')
    for (const entry of ['this.layerInk.read', 'this.layerInk.write', 'this.layerFilm', 'this.layerRelief', 'this.mergeRelief']) {
      expectContains(layerTargets, entry)
    }
    // Empty while unallocated — docTargets() must never carry a null.
    expectContains(layerTargets, 'if (this.layerInk === null || this.layerFilm === null || this.layerRelief === null || this.mergeRelief === null) return [];')
  })

  it('forgetLayer() nulls every field and clears the allocation latch', () => {
    const body = FORGET_LAYER()
    for (const reset of [
      'this.layerInk = null;',
      'this.layerFilm = null;',
      'this.layerRelief = null;',
      'this.mergeRelief = null;',
      'this.layerOpen = false;',
      'this.layerStroke = null;',
      'this.layerRect = null;',
      'this.layerAllocated = false;',
    ]) {
      expectContains(body, reset)
    }
    // Forget never frees: disposal belongs to the caller's target walk.
    expectNotContains(body, 'deleteTexture')
    expectNotContains(body, 'disposeTarget')
  })
})
