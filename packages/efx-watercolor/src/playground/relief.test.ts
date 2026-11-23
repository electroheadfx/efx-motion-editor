// ============================================================
//  Paint thickness field + relief deposit pins (Phase 64,
//  MED-14 / MED-16 / MED-18).
//
//  Family: source-scan on the existing setup — no new config. vitest
//  has no WebGL2, so no uniform can be read back and no target can be
//  created here; what a source scan CAN prove is pinned below, and the
//  byte-level proof (neutral default inert, emboss deposit invisible
//  to the pigment) lives in probe/medium-engine against
//  baselines/neutral-identity.json.
//
//  Laws pinned here:
//   1. One document-resolution HALF_FLOAT_R target holds paint
//      thickness beside the other document targets, and the sheet
//      wipe clears it with them.
//   2. Pool 0's format list, snapshotLayers()'s return and the pool-0
//      entry of the undo layer map stay positionally paired — the
//      thickness view is the same last entry in all three.
//   3. WholeDoc carries the layer (single-channel capture, gl.RED
//      upload), and a resize copies the overlapping thickness.
//   4. Thickness is engine-internal state: no persistence module and
//      no Rust file names it.
//   5. reliefFS declares exactly the stamp footprint uniforms plus
//      uAmount, with the same paper-tooth gate and tip-rotation law.
//   6. The deposit is one per dab, inside the brush callback, after the
//      ink and before the wet branch, additive and guarded at emboss 0;
//      its depth follows the pen pressure between EMBOSS_PRESS_FLOOR
//      and 1; Lift erodes with the same rect and amount.
//   7. No step, fill, pen or vector path reads or writes the target.
//   8. Post-UAT 2026-11-21: a bristle response deposits thickness through
//      the gather's REAL coverage (bristleReliefFS), never the solid base
//      footprint — the footprint boundary lit as a seam inside the mark.
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const SHADERS_SOURCE = readFileSync(resolve(HERE, 'shaders.ts'), 'utf8')
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')

/** Slice the engine source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

/** The inside of the bracket that opens at `openIndex` (balanced). */
function extractBracket(text: string, openIndex: number, open = '[', close = ']'): string {
  expect(text[openIndex], `expected '${open}' at index ${openIndex}`).toBe(open)
  let depth = 0
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === open) depth += 1
    else if (text[i] === close) {
      depth -= 1
      if (depth === 0) return text.slice(openIndex + 1, i)
    }
  }
  throw new Error('extractBracket: unbalanced brackets')
}

/** Split an array body on its TOP-LEVEL commas, so nested lists stay whole. */
function splitTopLevel(inner: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''
  for (const c of inner) {
    if (c === '[' || c === '(' || c === '{') depth += 1
    if (c === ']' || c === ')' || c === '}') depth -= 1
    if (c === ',' && depth === 0) {
      out.push(current.trim())
      current = ''
      continue
    }
    current += c
  }
  if (current.trim().length > 0) out.push(current.trim())
  return out
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

/** Walk every file under `dir` whose name ends with one of `exts`. */
function collectFiles(dir: string, exts: readonly string[]): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectFiles(full, exts))
    else if (exts.some((ext) => entry.endsWith(ext))) out.push(full)
  }
  return out
}

// ---------------------------------------------------------------------------
// 1. The thickness target and its place among the document targets
// ---------------------------------------------------------------------------

describe('thickness target allocation (MED-14)', () => {
  it('allocates exactly one document-resolution HALF_FLOAT_R target in allocateTargets', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private allocateTargets() {', 'private allocateHistory()')
    const allocations = body.match(/this\.relief\s*=\s*g\.target\([^\n]*/g) ?? []
    expect(allocations).toHaveLength(1)
    expect(allocations[0]).toBe('this.relief = g.target(this.dw, this.dh, [HALF_FLOAT_R], gl.LINEAR);')
    // One target and no second thickness-like allocation anywhere in the file.
    const all = ENGINE_SOURCE.match(/this\.relief\s*=/g) ?? []
    expect(all).toHaveLength(1)
  })

  it('declares the private field beside the other document targets', () => {
    const declarations = ENGINE_SOURCE.match(/private relief!: Target;/g) ?? []
    expect(declarations).toHaveLength(1)
  })

  it('lists the coverage pair LAST in docTargets, with the thickness immediately before it', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private docTargets(): Target[] {', 'private createDocument(')
    const openIndex = body.indexOf('return [')
    expect(openIndex).toBeGreaterThanOrEqual(0)
    const entries = splitTopLevel(extractBracket(body, openIndex + 'return '.length))
    // SPIKE 001: the coverage pair closes the list, so the sheet wipe clears it
    // too. 64-24: the last-touch pair sits immediately before it, and the
    // thickness keeps its single view immediately before that.
    const last = entries.length - 1
    expect(entries[last]).toBe('this.cover.write')
    expect(entries[last - 1]).toBe('this.cover.read')
    expect(entries[last - 2]).toBe('this.lastTouch.write')
    expect(entries[last - 3]).toBe('this.lastTouch.read')
    expect(entries[last - 4]).toBe('this.relief')
    expect(entries.filter((entry) => entry.includes('relief'))).toHaveLength(1)
    expect(entries.filter((entry) => entry.includes('lastTouch'))).toHaveLength(2)
    // clear() and resetSheet() both wipe every non-paper document target.
    const wipes = ENGINE_SOURCE.match(
      /for \(const t of this\.docTargets\(\)\) if \(t !== this\.paper\) this\.g\.clearTarget\(t\);/g,
    ) ?? []
    expect(wipes).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 2. The positional undo pairing (MED-18)
// ---------------------------------------------------------------------------

describe('undo pool pairing (MED-18)', () => {
  it("keeps pool 0's formats, snapshotLayers() and the undo layer map the same length with last-touch fifth and coverage last", () => {
    // Pool 0's formats, from allocateHistory().
    const historyBody = sliceBetween(ENGINE_SOURCE, 'private allocateHistory() {', 'private docTargets()')
    const formatsAt = historyBody.indexOf('formats: [')
    expect(formatsAt, 'pool 0 formats array not found').toBeGreaterThanOrEqual(0)
    const formats = splitTopLevel(extractBracket(historyBody, formatsAt + 'formats: '.length))
    expect(formats).toEqual([
      'HALF_FLOAT_RGBA',
      'HALF_FLOAT_RGBA',
      'HALF_FLOAT_R',
      'HALF_FLOAT_R',
      'FLOAT_R',
      'HALF_FLOAT_R',
    ])

    // snapshotLayers()'s return, in protect() order.
    const snapshotBody = sliceBetween(ENGINE_SOURCE, 'private snapshotLayers() {', 'private drawSplat(')
    const returnAt = snapshotBody.indexOf('return [')
    expect(returnAt, 'snapshotLayers return array not found').toBeGreaterThanOrEqual(0)
    const snapshot = splitTopLevel(extractBracket(snapshotBody, returnAt + 'return '.length))
    expect(snapshot).toEqual([
      'this.ink.read.views[0]',
      'this.ink.read.views[1]',
      'this.wet.read.views[0]',
      'this.relief.views[0]',
      'this.lastTouch.read.views[0]',
      'this.cover.read.views[0]',
    ])

    // travel()'s pool-0 layer map entry.
    const travelBody = sliceBetween(ENGINE_SOURCE, 'private travel(', 'private notifyHistory()')
    const layersAt = travelBody.indexOf('const layers = [')
    expect(layersAt, 'travel layer map not found').toBeGreaterThanOrEqual(0)
    const pools = splitTopLevel(extractBracket(travelBody, layersAt + 'const layers = '.length))
    expect(pools).toHaveLength(2)
    const pool0 = splitTopLevel(extractBracket(pools[0]!, 0))
    expect(pool0).toEqual([
      '[ink.read.views[0], ink.write.views[0]]',
      '[ink.read.views[1], ink.write.views[1]]',
      '[wet.read.views[0], wet.write.views[0]]',
      '[this.relief.views[0]]',
      '[this.lastTouch.read.views[0], this.lastTouch.write.views[0]]',
      '[this.cover.read.views[0], this.cover.write.views[0]]',
    ])

    // The three lists are positionally paired: equal length, same last index.
    expect(snapshot).toHaveLength(formats.length)
    expect(pool0).toHaveLength(formats.length)
    expect(snapshot[snapshot.length - 1]).toBe('this.cover.read.views[0]')
    expect(pool0[pool0.length - 1]).toBe('[this.cover.read.views[0], this.cover.write.views[0]]')
    // 64-24: the last-touch read half is the fifth entry in every list.
    expect(formats[formats.length - 2]).toBe('FLOAT_R')
    expect(snapshot[snapshot.length - 2]).toBe('this.lastTouch.read.views[0]')
    expect(pool0[pool0.length - 2]).toBe('[this.lastTouch.read.views[0], this.lastTouch.write.views[0]]')
    // The thickness stays a single framebuffer, not a ping-pong pair:
    // History.swap reads fbs[0] and writes every framebuffer in the entry.
    expect(pool0[pool0.length - 3]).toBe('[this.relief.views[0]]')
    expect(pool0[pool0.length - 3]!.match(/views\[0\]/g)).toHaveLength(1)
    // Coverage and the last-touch memory are pool 0's two double-buffered
    // document layers: each entry carries both halves, so an advection or a
    // touch write cannot outrun undo.
    expect(pool0[pool0.length - 1]!.match(/views\[0\]/g)).toHaveLength(2)
    expect(pool0[pool0.length - 2]!.match(/views\[0\]/g)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 3. WholeDoc carry, and the resize copy
// ---------------------------------------------------------------------------

describe('WholeDoc carry (MED-18.adjacency)', () => {
  it("adds 'relief' to the LayerId union and the WholeDoc layer record", () => {
    // 64-14 appends 'cover' after 'relief' and 64-24 appends 'lastTouch'; the
    // relief entry must stay present.
    expect(ENGINE_SOURCE).toContain(
      "export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet' | 'relief' | 'cover' | 'lastTouch';",
    )
    // WholeDoc.layers is Record<LayerId, Uint16Array | Float32Array> (64-24
    // widens it for the exact-float last-touch layer), so the union is the record.
    expect(ENGINE_SOURCE).toContain('layers: Record<LayerId, Uint16Array | Float32Array>')
  })

  it('captures the layer as a single channel and uploads it back as gl.RED', () => {
    expect(ENGINE_SOURCE).toContain('relief: read(this.relief.views[0], 1)')
    expect(ENGINE_SOURCE).toContain('up(this.relief.tex[0], gl.RED, whole.layers.relief);')
  })

  it('copies the overlapping thickness forward on a resize', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'resizeDocument(w: number, h: number) {', 'const shift = ')
    expect(body).toContain('relief: this.relief')
    expect(body).toContain('copy(old.relief, [this.relief]);')
    // 64-24: the last-touch pair rides the same resize copy into both halves
    // (the read half is the source, exactly like coverage).
    expect(body).toContain('lastTouch: this.lastTouch.read')
    expect(body).toContain('copy(old.lastTouch, [this.lastTouch.read, this.lastTouch.write]);')
  })
})

// ---------------------------------------------------------------------------
// 4. Thickness is engine-internal: nothing persisted names it
// ---------------------------------------------------------------------------

describe('engine-only state (MED-14 prohibitions)', () => {
  it('no module and no Rust file outside the engine names the thickness layer', () => {
    const roots = [
      join(REPO_ROOT, 'packages', 'efx-watercolor', 'src'),
      join(REPO_ROOT, 'app', 'src'),
      join(REPO_ROOT, 'app', 'src-tauri', 'src'),
    ]
    const offEngine = roots
      .flatMap((root) => (statSync(root).isDirectory() ? collectFiles(root, ['.ts', '.tsx', '.rs']) : []))
      .filter((file) => file !== resolve(HERE, 'Engine.ts') && !file.endsWith('.test.ts') && !file.endsWith('.test.tsx'))

    const offenders = offEngine.filter((file) => {
      const text = readFileSync(file, 'utf8')
      return (
        /layers\.relief/.test(text) ||
        /layers\[['"]relief['"]\]/.test(text) ||
        (file.endsWith('.rs') && /relief/i.test(text)) ||
        // 64-24 (D-24): the last-touch channel is engine state too — no
        // parser, Rust file or app module may name it (frame cache 0 B).
        /layers\.lastTouch/.test(text) ||
        /layers\[['"]lastTouch['"]\]/.test(text) ||
        (file.endsWith('.rs') && /lasttouch/i.test(text))
      )
    })
    expect(offenders).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// 5. The relief shader mirrors stampFS's footprint
// ---------------------------------------------------------------------------

// The footprint half of stampFS — one source both programs must declare, so a
// tip change can never diverge between the pigment stamp and the deposit.
const FOOTPRINT_UNIFORMS = [
  'uAspect', 'uAxis', 'uGrain', 'uGrainThr', 'uJitter', 'uPaper', 'uPoint',
  'uRadius', 'uRough', 'uRound', 'uTip', 'uTipAspect', 'uTipRotation',
].sort()
const PAPER_GATE = 'f *= mix(1.0, smoothstep(uGrainThr - 0.08, uGrainThr + 0.08, h), uGrain);'
const ROTATION_FORMULA = 'vec2 tq = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));'

describe('reliefFS (MED-14)', () => {
  it('declares exactly the stamp footprint uniforms plus uAmount, and one output', () => {
    const stamp = uniformNames(shaderSource('stampFS'))
    const relief = uniformNames(shaderSource('reliefFS'))
    // stampFS = the footprint + the two colour outputs.
    expect(stamp).toEqual([...FOOTPRINT_UNIFORMS, 'uColor0', 'uColor1'].sort())
    // reliefFS = the same footprint + the deposit amount, nothing else.
    expect(relief).toEqual([...FOOTPRINT_UNIFORMS, 'uAmount'].sort())
    expect(shaderSource('reliefFS')).not.toContain('layout(location=1)')
    expect(shaderSource('reliefFS')).toContain('o0 = vec4(uAmount * f);')
  })

  it('applies the same paper-tooth gate, rotation and dry re-threshold as stampFS', () => {
    const stamp = shaderSource('stampFS')
    const relief = shaderSource('reliefFS')
    expect(stamp).toContain(PAPER_GATE)
    expect(relief).toContain(PAPER_GATE)
    expect(relief).toContain(ROTATION_FORMULA)
    expect(relief).toContain('float th = uRough * 0.45;')
    expect(relief).toContain('float dry = smoothstep(th, th + 0.02, t);')
    expect(relief).toContain('float sharp = mix(t, dry, step(0.0001, uRough));')
  })
})

// ---------------------------------------------------------------------------
// 6. The per-dab deposit and the Lift erosion
// ---------------------------------------------------------------------------

describe('relief deposit (MED-14)', () => {
  it('binds the footprint from one private helper shared by the stamp and the relief draw', () => {
    expect(ENGINE_SOURCE.match(/private bindFootprint\(/g) ?? []).toHaveLength(1)
    expect(ENGINE_SOURCE).toContain('relief: this.g.program(S.reliefFS),')
    const drawStamp = sliceBetween(ENGINE_SOURCE, 'private drawStamp(', 'private drawRelief(')
    expect(drawStamp).toContain('this.bindFootprint(')
    // The stamp no longer binds the footprint uniforms itself.
    expect(drawStamp).not.toContain('gl.uniform1f(p.u.uTipAspect')
    const drawRelief = sliceBetween(ENGINE_SOURCE, 'private drawRelief(', 'private brushRelief(')
    expect(drawRelief).toContain('this.bindFootprint(')
    expect(drawRelief).toContain('gl.uniform1f(p.u.uAmount, amount);')
    expect(drawRelief).toContain('g.draw(this.relief, rect)')
  })

  it('deposits once per dab inside the brush callback, after the ink and before the wet branch', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    // Post-UAT: a light touch lays a thin film, full pressure the delivered
    // depth; the factor never exceeds 1, so the emboss cannot exceed the
    // (reduced) full-press look.
    expect(ENGINE_SOURCE).toContain('const EMBOSS_PRESS_FLOOR = 0.15;')
    expect(brush).toContain(
      'const embossPress = EMBOSS_PRESS_FLOOR + (1 - EMBOSS_PRESS_FLOOR) * clamp(pr, 0, 1);',
    )
    expect(brush).toContain('const reliefAmount = P.emboss * amount * RELIEF_GAIN * embossPress;')
    const seam = brush.indexOf("// spec 06: the cover pass draws here, before this dab's deposit")
    const inkAt = brush.indexOf('this.brushInk(')
    const reliefAt = brush.indexOf('this.brushRelief(')
    // Quick 261123-kpy: the wet pass is skipped for a modifier dab, so its
    // line carries the guard — the order is unchanged.
    const wetAt = brush.indexOf('if (s.relief === null && wet > 0) this.brushWet(')
    expect(seam, 'the spec-06 seam comment is missing').toBeGreaterThanOrEqual(0)
    expect(inkAt).toBeGreaterThan(seam)
    expect(reliefAt).toBeGreaterThan(inkAt)
    expect(wetAt).toBeGreaterThan(reliefAt)
    // Post-UAT 2026-11-21: a bristle response deposits through the gather's
    // real coverage; every other response keeps reliefFS's footprint. Quick
    // 261123-jak: the value passed is the SIGNED amount.
    expect(brush).toContain(
      'if (bristle) this.bristleReliefPass(dx, dy, dr, angle, reliefSigned, contactPr, alongPx, this.bristleEndCap);',
    )
    expect(brush).toContain(
      'else this.brushRelief(dx, dy, dr, angle, reliefSigned, dryness, grainThr);',
    )
  })

  it('blends the deposit additively and draws only into the thickness target', () => {
    const brushRelief = sliceBetween(ENGINE_SOURCE, 'private brushRelief(', 'private reliefErode(')
    expect(brushRelief).toContain('gl.enable(gl.BLEND);')
    expect(brushRelief).toContain('gl.blendEquation(gl.FUNC_ADD);')
    expect(brushRelief).toContain('gl.blendFunc(gl.ONE, gl.ONE);')
    expect(brushRelief).toContain('this.drawRelief(')
    expect(brushRelief).not.toContain('this.ink')
    // brushInk already protected the identical rect in this same callback.
    expect(brushRelief).not.toContain('touch(')
  })

  it('Lift erodes thickness with the same rect and amount under ZERO / ONE_MINUS_SRC_COLOR', () => {
    const lift = sliceBetween(ENGINE_SOURCE, 'private lift(', 'private dryTau()')
    expect(lift).toContain('gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);')
    const fixedAt = lift.indexOf('g.draw(this.fixed, rect)')
    const reliefAt = lift.indexOf('this.drawRelief(')
    const offAt = lift.indexOf('gl.disable(gl.BLEND);')
    expect(fixedAt).toBeGreaterThanOrEqual(0)
    expect(reliefAt).toBeGreaterThan(fixedAt)
    expect(offAt).toBeGreaterThan(reliefAt)
    expect(lift).toContain('this.drawRelief(amount, x, y, r, angle, 0, 0, b, rect, 0, 0);')
  })
})

// ---------------------------------------------------------------------------
// 7. Thickness never flows, and no other tool deposits it
// ---------------------------------------------------------------------------

describe('thickness never flows (MED-14 prohibitions)', () => {
  it('no step, fill or pen path reads or writes the thickness target', () => {
    const step = sliceBetween(ENGINE_SOURCE, 'private step(dt: number) {', 'private drawDisplay(')
    expect(step, 'the fluid step must not touch thickness').not.toContain('this.relief')
    const fill = sliceBetween(ENGINE_SOURCE, 'fillStep(from: number', 'fillEnd()')
    expect(fill, 'the bucket fill must not touch thickness').not.toContain('this.relief')
    const pen = sliceBetween(ENGINE_SOURCE, "case 'pen': {", "case 'lift': {")
    expect(pen.toLowerCase(), 'a pen stroke deposits no thickness').not.toContain('relief')
    const vector = collectFiles(join(REPO_ROOT, 'packages', 'efx-watercolor', 'src', 'vector'), ['.ts'])
      .filter((file) => !file.endsWith('.test.ts'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    expect(vector, 'a vector stroke deposits no thickness').not.toContain('relief')
  })

  it('draws relief from exactly three drawRelief sites: the deposit, the signed erode and the Lift erosion', () => {
    expect(ENGINE_SOURCE.match(/this\.brushRelief\(/g) ?? []).toHaveLength(1)
    expect(ENGINE_SOURCE.match(/this\.drawRelief\(/g) ?? []).toHaveLength(3)
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expect(brush.match(/this\.brushRelief\(/g) ?? []).toHaveLength(1)
    // Post-UAT 2026-11-21: the bristle thickness deposit is the gather's
    // coverage, called once from the same guarded slot.
    expect(ENGINE_SOURCE.match(/this\.bristleReliefPass\(/g) ?? []).toHaveLength(1)
    expect(brush.match(/this\.bristleReliefPass\(/g) ?? []).toHaveLength(1)
    // Quick 261123-hr5: the signed erode pair, called once each from the
    // negative half of the same signed slot.
    expect(ENGINE_SOURCE.match(/this\.reliefErode\(/g) ?? []).toHaveLength(1)
    expect(ENGINE_SOURCE.match(/this\.bristleReliefErode\(/g) ?? []).toHaveLength(1)
    expect(brush.match(/this\.reliefErode\(/g) ?? []).toHaveLength(1)
    expect(brush.match(/this\.bristleReliefErode\(/g) ?? []).toHaveLength(1)
  })
})

// Post-UAT (2026-11-21) — the emboss must follow the REAL bristle mark.
// reliefFS's solid base-footprint boundary sat inside a feathered, hairy
// stroke and lit as a dark/white seam at big sizes. The bristle response now
// deposits thickness through a third BRISTLE_GATHER consumer whose mask is the
// gather's own coverage — the exact weight the ink deposit moved by.
describe('bristleReliefFS — thickness follows the real bristle mark', () => {
  it('composes the ONE gather snippet and writes uAmount × coverage to one output', () => {
    const relief = shaderSource('bristleReliefFS')
    expect(relief).toContain('${BRISTLE_GATHER}')
    expect(relief).toContain('uniform float uAmount;')
    expect(relief).toContain('float a = clamp(gatherBristle(vUv).coverage, 0.0, 1.0);')
    expect(relief).toContain('o0 = vec4(uAmount * a);')
    expect(relief).not.toContain('layout(location=1)')
    // The deposit's own square cull, never a wider stamp rect.
    expect(relief).toContain('if (abs(q.x) > 1.15 || abs(q.y) > 1.15) discard;')
  })

  it('registers outside the pinned literal and binds the shared gather', () => {
    expect(ENGINE_SOURCE).toContain(
      'this.programs.bristleRelief = this.g.program(S.bristleReliefFS);',
    )
    const pass = sliceBetween(
      ENGINE_SOURCE,
      'private bristleReliefPass(',
      'private reliefErode(',
    )
    expect(pass).toContain('this.bindGather(p, x, y, r, angle, pr, alongPx, endCap);')
    expect(pass).toContain('gl.uniform1f(p.u.uAmount!, amount);')
    expect(pass).toContain('gl.blendFunc(gl.ONE, gl.ONE);')
    expect(pass).toContain('g.draw(this.relief, this.stampRect(x, y, r, this.dw, this.dh, 1.6));')
    // It draws the thickness target only: no ink, no coverage, no snapshot.
    expect(pass).not.toContain('this.ink')
    expect(pass).not.toContain('this.cover')
    expect(pass).not.toContain('bristleSnapshot(')
  })
})

// ---------------------------------------------------------------------------
// 9. Signed emboss (quick 261123-hr5): the negative half SUBTRACTS thickness
// ---------------------------------------------------------------------------

// The artist's row spans -15..15: negative smooths a dry impasto and keeps the
// paint. The erode is the Lift blend law (destination minus the relief mask),
// gated ONLY by the recorded emboss sign — paint never auto-erodes the relief
// under its own coverage (GAP-1). Undo rides the dab's own touch: both erode
// passes draw after brushInk / bristleInk protected the identical rect, so no
// new protection site exists.
describe('signed emboss (quick 261123-hr5)', () => {
  it('declares the signed erode gain beside the Lift erode constant', () => {
    expect(ENGINE_SOURCE).toContain('const RELIEF_ERODE = 0.5;')
    expect(ENGINE_SOURCE).toMatch(/const RELIEF_ERODE_NEGATIVE = [0-9.]+;/)
  })

  // Quick 261123-kpy moved the branch operand from `reliefAmount` to the
  // polarity latch (the relief-only inversion) and guarded the wet pass; every
  // relation this pin states is unchanged.
  it('branches on the sign after the untouched positive deposit, before the wet pass', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    const positiveAt = brush.indexOf('if (reliefSigned > 0) {')
    const erodeAt = brush.indexOf('else if (reliefSigned < 0) {')
    const wetAt = brush.indexOf('if (s.relief === null && wet > 0) this.brushWet(')
    expect(positiveAt, 'positive deposit gate missing').toBeGreaterThanOrEqual(0)
    expect(erodeAt, 'signed erode branch missing').toBeGreaterThan(positiveAt)
    expect(wetAt, 'wet pass missing after the signed slot').toBeGreaterThan(erodeAt)
    const erodeBranch = brush.slice(erodeAt, wetAt)
    // The slider path keeps the hr5 clamp verbatim; the modifier path grades
    // through the pure law so a light touch is not a one-dab wipe.
    expect(erodeBranch).toContain('? Math.min(1, -reliefSigned * RELIEF_ERODE_NEGATIVE)')
    expect(erodeBranch).toContain(' : reliefModifierErodeAmount(reliefModifierBand);')
    expect(erodeBranch).toContain(
      'if (bristle) this.bristleReliefErode(dx, dy, dr, angle, erodeAmount, contactPr, alongPx, this.bristleEndCap);',
    )
    expect(erodeBranch).toContain(
      'else this.reliefErode(dx, dy, dr, angle, erodeAmount, dryness, grainThr);',
    )
    // GAP-1: the erode is gated by the recorded sign only — no coverage, no
    // ink and no settled-pigment term may appear in the branch.
    expect(erodeBranch).not.toContain('this.cover')
    expect(erodeBranch).not.toContain('this.ink')
    expect(erodeBranch).not.toContain('this.fixed')
  })

  it('subtracts thickness in reliefErode under ZERO / ONE_MINUS_SRC_COLOR into the thickness target only', () => {
    const erode = sliceBetween(ENGINE_SOURCE, 'private reliefErode(', 'private bristleReliefErode(')
    expect(erode).toContain('gl.enable(gl.BLEND);')
    expect(erode).toContain('gl.blendEquation(gl.FUNC_ADD);')
    expect(erode).toContain('gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);')
    expect(erode).toContain('this.drawRelief(amount, x, y, r, angle, grain, grainThr);')
    expect(erode).not.toContain('this.ink')
    expect(erode).not.toContain('this.fixed')
    expect(erode).not.toContain('this.cover')
    // brushInk already protected the identical rect in this same callback.
    expect(erode).not.toContain('touch(')
  })

  it('subtracts through the bristle gather for a bristle response, thickness target only', () => {
    const erode = sliceBetween(ENGINE_SOURCE, 'private bristleReliefErode(', 'private brushInk(')
    expect(erode).toContain('const p = this.programs.bristleRelief;')
    expect(erode).toContain('this.bindGather(p, x, y, r, angle, pr, alongPx, endCap);')
    expect(erode).toContain('gl.uniform1f(p.u.uAmount!, amount);')
    expect(erode).toContain('gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);')
    expect(erode).toContain('g.draw(this.relief, this.stampRect(x, y, r, this.dw, this.dh, 1.6));')
    expect(erode).not.toContain('this.ink')
    expect(erode).not.toContain('this.cover')
    expect(erode).not.toContain('bristleSnapshot(')
  })
})

// ---------------------------------------------------------------------------
// 10. Modifier relief (quick 261123-kpy): a pressure-driven polarity latched at
//     stroke start — Shift erodes, Cmd deposits, and NOTHING is painted.
// ---------------------------------------------------------------------------

// The artist's gesture: hold Shift (erode) or Cmd (deposit) at pointerdown
// with the brush tool and the stroke flattens or lifts an existing impasto
// without adding a single pigment byte. The latch is stroke-START only on the
// RESOLVED tool — Shift wins when both are held — and carries NO Emboss gate:
// the magnitude never reads the slider, so the modifier works at Emboss 0. The
// magnitude is pressure-only; a pressureless pointer is the recorded
// per-sample `p < 0` sentinel, which is EXACTLY full strength. A modifier dab
// takes its OWN ink-rect undo protection because no paint pass ran to protect
// it. The pigment-identity proof is the `emboss-relief-modifier` probe; these
// pins carry the source law.
describe('modifier relief (quick 261123-kpy)', () => {
  it('declares the polarity and the pressureless sentinel on Stroke, and no reliefOnly', () => {
    const strokeInterface = sliceBetween(ENGINE_SOURCE, 'interface Stroke {', '/** 61-04 / T-61-11')
    expect(strokeInterface).toContain('relief: ReliefMode | null;')
    expect(strokeInterface).toContain('pressureless: boolean;')
    expect(strokeInterface).not.toContain('reliefOnly')
  })

  it('latches the polarity ONCE at pointerdown from the resolved tool, with no Emboss gate', () => {
    const pointerdown = sliceBetween(
      ENGINE_SOURCE,
      "on(c, 'pointerdown', e => {",
      "on(c, 'pointermove', e => {",
    )
    // Shift wins when both modifiers are held; Alt never reaches here (the
    // color picker consumes it capture-phase). The latch reads the RESOLVED
    // tool, so a mid-stroke modifier change cannot flip the stroke.
    expect(pointerdown).toContain(
      "const relief: ReliefMode | null = tool === 'brush' ? (e.shiftKey ? 'erode' : e.metaKey ? 'deposit' : null) : null;",
    )
    // NO Emboss gate: the modifier magnitude never reads the slider, so the
    // gesture works at Emboss 0.
    expect(pointerdown).not.toContain('this.params.emboss')
    expect(pointerdown).toContain('relief,')
    expect(pointerdown).toContain('pressureless: false,')
    // Exactly two Stroke literals exist (pointerdown and scriptBegin); both
    // carry the fields, so no stroke path can leave them undefined.
    // scriptBegin normalizes its optional parameter to the stroke's null
    // sentinel — a bare `relief,` cannot satisfy `ReliefMode | null` under
    // strict TS, so THAT literal is pinned exactly in its own row below.
    expect(ENGINE_SOURCE.match(/^\s*pressureless: false,$/gm) ?? []).toHaveLength(2)
    expect(ENGINE_SOURCE.match(/^\s*relief: relief \?\? null,$/gm) ?? []).toHaveLength(1)
  })

  it('accepts a trailing relief on scriptBegin and records it on the scripted stroke', () => {
    expect(ENGINE_SOURCE).toContain('pigment?: Pigment, relief?: ReliefMode): boolean {')
    const scriptBegin = sliceBetween(ENGINE_SOURCE, 'scriptBegin(tool: Tool,', 'scriptMove(x: number,')
    expect(scriptBegin).toContain('relief: relief ?? null,')
    expect(scriptBegin).toContain('pressureless: false,')
  })

  it('records the per-sample pressureless sentinel in both consume branches', () => {
    // The recorded `p < 0` marker is the ONLY authority — never pointerType —
    // so a replayed bag reproduces the live magnitude exactly.
    const consume = sliceBetween(ENGINE_SOURCE, 'private processInput(dt: number) {', 'this.queue = [];')
    expect(consume.match(/s\.pressureless = q\.p < 0;/g) ?? []).toHaveLength(2)
    const firstPrAt = consume.indexOf('s.pr = this.pressureOf(s, q.p);')
    const firstPressurelessAt = consume.indexOf('s.pressureless = q.p < 0;')
    const secondPressurelessAt = consume.indexOf('s.pressureless = q.p < 0;', firstPressurelessAt + 1)
    const steadyPrAt = consume.indexOf('const pr = this.pressureOf(s, q.p);')
    expect(firstPrAt, 'the start-dab pressure read is missing').toBeGreaterThanOrEqual(0)
    expect(firstPressurelessAt).toBeGreaterThan(firstPrAt)
    expect(secondPressurelessAt).toBeGreaterThan(firstPressurelessAt)
    expect(steadyPrAt).toBeGreaterThan(secondPressurelessAt)
  })

  it('keeps the normal amount literal untouched and resolves the modifier through the pure law', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    // The hr5 positive-path law: the amount literal is byte-identical.
    expect(brush).toContain('const reliefAmount = P.emboss * amount * RELIEF_GAIN * embossPress;')
    expect(brush).toContain('const reliefSigned = s.relief === null')
    // Pressure-only band: the embossPress floor curve for a real pen, the
    // recorded pressureless sentinel as exactly full strength. The band is in
    // Emboss-slider units (1..3) and rides the SAME `amount * RELIEF_GAIN`
    // delivery the slider path uses, so a modifier stroke acts exactly like
    // Emboss set to that number — never like the slider pegged at 15.
    expect(brush).toContain(
      'reliefModifierMagnitude(reliefModifierPress(embossPress, s.pressureless))',
    )
    expect(brush).toContain(
      'reliefModifierSigned(s.relief, reliefModifierBand * amount * RELIEF_GAIN)',
    )
    expect(ENGINE_SOURCE).toContain("from './reliefModifier'")
  })

  it('skips every paint, water and carrier write behind ONE polarity guard', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expect(brush).toContain('if (s.relief === null && (coverAmount > 0 || bristle)) {')
    expect(brush).toContain('if (s.relief === null) this.carrierPass(')
    expect(brush).toContain('if (s.relief === null && moving && b.water > 0) this.splatVelocity(')
    const blockAt = brush.indexOf('if (s.relief === null) {')
    expect(blockAt, 'the one paint block guard is missing').toBeGreaterThanOrEqual(0)
    const body = extractBracket(brush, brush.indexOf('{', blockAt), '{', '}')
    expect(body).toContain('this.coverPass(')
    expect(body).toContain('this.bristleInk(')
    expect(body).toContain('this.coverageDeposit(')
    expect(body).toContain('this.brushInk(')
    expect(body).toContain('this.bristleTouch(')
    // The wet pass is guarded by the same literal family (the hr5 ordering
    // anchors above read it too).
    expect(brush).toContain('if (s.relief === null && wet > 0) this.brushWet(')
  })

  it('takes its own touch on the ink-pass rects before the relief draw, both polarities', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    const touchAt = brush.indexOf(
      'if (s.relief !== null && reliefSigned !== 0) this.touch(this.stampRect(dx, dy, dr, this.dw, this.dh, bristle ? 1.6 : 1.5));',
    )
    const positiveAt = brush.indexOf('if (reliefSigned > 0) {')
    expect(touchAt, 'the modifier own-protection line is missing').toBeGreaterThanOrEqual(0)
    expect(positiveAt).toBeGreaterThan(touchAt)
  })

  it('reads the signed branch from reliefSigned and skips the wet pass for a modifier dab', () => {
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expect(brush).toContain('if (reliefSigned > 0) {')
    const erodeAt = brush.indexOf('else if (reliefSigned < 0) {')
    const wetAt = brush.indexOf('if (s.relief === null && wet > 0) this.brushWet(')
    expect(erodeAt).toBeGreaterThan(-1)
    expect(wetAt).toBeGreaterThan(erodeAt)
    const erodeBranch = brush.slice(erodeAt, wetAt)
    expect(erodeBranch).toContain('? Math.min(1, -reliefSigned * RELIEF_ERODE_NEGATIVE)')
    expect(erodeBranch).toContain('if (s.relief !== null) this.modifierReliefErode(')
    expect(erodeBranch).not.toContain('this.cover')
    expect(erodeBranch).not.toContain('this.ink')
    expect(erodeBranch).not.toContain('this.fixed')
  })

  it('draws a modifier dab on a SMOOTH footprint that saturates, never the paint one', () => {
    // UAT 2026-11-23: the paint footprint gates its output by paper tooth,
    // re-thresholds the tip and jitters it per dab. Ink normally lands through
    // the same gates, so the relief hides inside the paint; with no ink at all
    // those gates put isolated dark specks on the film. The modifier draw must
    // therefore drop every one of them and cap the height with MAX blending.
    const relief = sliceBetween(ENGINE_SOURCE, 'private modifierRelief(', 'private modifierReliefErode(')
    // round 1, grain 0, grainThr 0, brush, rough 0, jitter 0
    expect(relief).toContain('this.bindFootprint(p, x, y, r, angle, 1, 0, 0, this.brush, 0, 0)')
    expect(relief).toContain('gl.blendEquation(gl.MAX)')
    expect(relief).not.toContain('gl.blendEquation(gl.FUNC_ADD)')

    const erode = sliceBetween(ENGINE_SOURCE, 'private modifierReliefErode(', 'private bristleReliefPass(')
    expect(erode).toContain('this.bindFootprint(p, x, y, r, angle, 1, 0, 0, this.brush, 0, 0)')
    expect(erode).toContain('gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR)')

    // Both modifier draws are routed from the dab, for BOTH brush kinds — a
    // relief-only pass has no gather to look like, so bristle takes the same
    // smooth footprint instead of the gather's painted coverage.
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expect(brush).toContain('if (s.relief !== null) this.modifierRelief(dx, dy, dr, angle, reliefSigned);')
    expect(brush).toContain('if (s.relief !== null) this.modifierReliefErode(dx, dy, dr, angle, erodeAmount);')
  })

  it('reports the latched polarity beside the tool at stroke end', () => {
    expect(ENGINE_SOURCE).toContain('onStrokeEnd?(tool: Tool, relief?: ReliefMode): void;')
    expect(ENGINE_SOURCE).toContain('this.callbacks.onStrokeEnd?.(s.tool, s.relief ?? undefined);')
  })
})
