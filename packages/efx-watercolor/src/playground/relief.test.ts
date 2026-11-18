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
function extractBracket(text: string, openIndex: number): string {
  expect(text[openIndex], `expected '[' at index ${openIndex}`).toBe('[')
  let depth = 0
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '[') depth += 1
    else if (text[i] === ']') {
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
    // too; the thickness keeps its single view and sits immediately before it.
    const last = entries.length - 1
    expect(entries[last]).toBe('this.cover.write')
    expect(entries[last - 1]).toBe('this.cover.read')
    expect(entries[last - 2]).toBe('this.relief')
    expect(entries.filter((entry) => entry.includes('relief'))).toHaveLength(1)
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
  it("keeps pool 0's formats, snapshotLayers() and the undo layer map the same length with coverage fifth and last", () => {
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
      '[this.cover.read.views[0], this.cover.write.views[0]]',
    ])

    // The three lists are positionally paired: equal length, same last index.
    expect(snapshot).toHaveLength(formats.length)
    expect(pool0).toHaveLength(formats.length)
    expect(snapshot[snapshot.length - 1]).toBe('this.cover.read.views[0]')
    expect(pool0[pool0.length - 1]).toBe('[this.cover.read.views[0], this.cover.write.views[0]]')
    // The thickness stays a single framebuffer, not a ping-pong pair:
    // History.swap reads fbs[0] and writes every framebuffer in the entry.
    expect(pool0[pool0.length - 2]).toBe('[this.relief.views[0]]')
    expect(pool0[pool0.length - 2]!.match(/views\[0\]/g)).toHaveLength(1)
    // Coverage is the one double-buffered document layer in pool 0: its entry
    // carries both halves, so an advection write cannot outrun undo.
    expect(pool0[pool0.length - 1]!.match(/views\[0\]/g)).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 3. WholeDoc carry, and the resize copy
// ---------------------------------------------------------------------------

describe('WholeDoc carry (MED-18.adjacency)', () => {
  it("adds 'relief' to the LayerId union and the WholeDoc layer record", () => {
    // 64-14 appends 'cover' after 'relief'; the relief entry must stay present.
    expect(ENGINE_SOURCE).toContain(
      "export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet' | 'relief' | 'cover';",
    )
    // WholeDoc.layers is Record<LayerId, Uint16Array>, so the union is the record.
    expect(ENGINE_SOURCE).toContain('layers: Record<LayerId, Uint16Array>')
  })

  it('captures the layer as a single channel and uploads it back as gl.RED', () => {
    expect(ENGINE_SOURCE).toContain('relief: read(this.relief.views[0], 1)')
    expect(ENGINE_SOURCE).toContain('up(this.relief.tex[0], gl.RED, whole.layers.relief);')
  })

  it('copies the overlapping thickness forward on a resize', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'resizeDocument(w: number, h: number) {', 'const shift = ')
    expect(body).toContain('relief: this.relief')
    expect(body).toContain('copy(old.relief, [this.relief]);')
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
        (file.endsWith('.rs') && /relief/i.test(text))
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
    const wetAt = brush.indexOf('if (wet > 0) this.brushWet(')
    expect(seam, 'the spec-06 seam comment is missing').toBeGreaterThanOrEqual(0)
    expect(inkAt).toBeGreaterThan(seam)
    expect(reliefAt).toBeGreaterThan(inkAt)
    expect(wetAt).toBeGreaterThan(reliefAt)
    expect(brush).toContain(
      'if (reliefAmount > 0) this.brushRelief(dx, dy, dr, angle, reliefAmount, dryness, grainThr);',
    )
  })

  it('blends the deposit additively and draws only into the thickness target', () => {
    const brushRelief = sliceBetween(ENGINE_SOURCE, 'private brushRelief(', 'private brushInk(')
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

  it('draws relief from exactly two call sites: the guarded deposit and the Lift erosion', () => {
    expect(ENGINE_SOURCE.match(/this\.brushRelief\(/g) ?? []).toHaveLength(1)
    expect(ENGINE_SOURCE.match(/this\.drawRelief\(/g) ?? []).toHaveLength(2)
    const brush = sliceBetween(ENGINE_SOURCE, "case 'brush': {", "case 'water': {")
    expect(brush.match(/this\.brushRelief\(/g) ?? []).toHaveLength(1)
  })
})
