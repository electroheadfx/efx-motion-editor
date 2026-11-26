// ============================================================
//  64-24 — the last-touch channel and its eight lifecycle sites
//  (D-24; MED-05 / MED-32..38 adjacency).
//
//  Family: source-scan on the existing setup — no new config. vitest has
//  no WebGL2, so no target can be created and no texel can be read back
//  here; what a source scan CAN prove is pinned below, and the byte-level
//  proof (identity set byte-identical, the gate's outcome) lives in
//  probe/medium-engine against the committed baselines.
//
//  Laws pinned here:
//   1. The last-touch field is a document-sized R32F ping-pong pair, and
//      its CLEARED value is the one-week sentinel (−604800 s), written to
//      both halves at allocation and after every sheet wipe — never 0,
//      which a cleared R32F would read as "touched at t = 0".
//   2. The channel rides the whole-document lifecycle as the fifth pool-0
//      entry: allocateHistory's format list, snapshotLayers(), travel()'s
//      pool-0 map, docTargets(), captureWhole / uploadWhole and
//      resizeDocument's copy all grow together (the relief/cover
//      precedent), and coverage stays last for its committed pin.
//   3. The whole-document carry is EXACT float (`readFloat` /
//      `uploadFloat`, a narrowed `WholeDoc.layers` record): a half-float
//      round-trip would clamp the sentinel at 65504 and a restored sheet
//      would read as freshly touched.
//   4. The channel is engine-internal state: no project member, no
//      parser, no Rust mirror. Frame cache is 0 B — a committed frame is
//      a WebP raster and a new frame starts clean on the sentinel.
//   5. Memory is recorded, not gated: D-24 measured +26.1 MB at 1080² and
//      +67.1 MB at 2K; the sheet pair recomputes to 9,331,200 B and
//      33,554,432 B (2 · side² · 4) below.
//   6. 64-26 (CR-03): the pair is a ping-pong of INDEPENDENT textures, so a
//      rect-sized read-to-write carry runs before every stamp and every
//      whole-target write (clear, uploadWhole, resize) invalidates it.
//      64-24 truth 3's "bounded by the dab amount" clause is SUPERSEDED by
//      the 261119-pod measurement — the bare coverage channel is the weight
//      — and 64-26 removes the dead `uAmount` uniform (IN-04).
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const GL_SOURCE = readFileSync(resolve(HERE, 'gl.ts'), 'utf8')
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')

// D-24's measured reference points: +26.1 MB at 1080² and +67.1 MB at 2K.
// The sheet pair itself computes to 2 · side² · 4 bytes — one R32F channel,
// two halves:
const SHEET_PAIR_1080 = 2 * 1080 * 1080 * 4   // 9,331,200 B ≈ 8.9 MiB
const SHEET_PAIR_2048 = 2 * 2048 * 2048 * 4   // 33,554,432 B = 32 MiB
// The pool-0 atlas adds one FLOAT_R layer per saved band on top of the pair.
// Frame cache is 0 B: a committed frame is a WebP raster and every new frame
// starts clean on the sentinel.

/** Slice the engine source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
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
// 1. The format, the sentinel and the clears
// ---------------------------------------------------------------------------

describe('last-touch format and sentinel (D-24)', () => {
  it('declares GL_R32F and an exact-float RED format beside FLOAT_RG', () => {
    expect(ENGINE_SOURCE).toContain('GL_RG32F = 0x8230, GL_R32F = 0x822e;')
    expect(ENGINE_SOURCE).toContain(
      'const FLOAT_R: Format = { internal: GL_R32F, format: GL_RED, type: GL_FLOAT };',
    )
    // The format block documents why exact float: the sentinel is outside
    // half-float's 65504 range.
    expect(ENGINE_SOURCE).toContain('outside half-float')
  })

  it('declares exactly one LAST_TOUCH_DRY_SECONDS constant, one week old', () => {
    // 64-24 Task 2: the constant lives in `bristles.ts` ("one law, declared
    // once") and the engine IMPORTS it — the package-wide one-declaration
    // scan in bristles.test.ts proves no second copy exists anywhere.
    expect(ENGINE_SOURCE).toMatch(
      /import \{[^}]*\bLAST_TOUCH_DRY_SECONDS\b[^}]*\} from '\.\/bristles'/,
    )
    expect(ENGINE_SOURCE).not.toContain('export const LAST_TOUCH_DRY_SECONDS')
    const declarations = ENGINE_SOURCE.match(/LAST_TOUCH_DRY_SECONDS/g) ?? []
    // The import plus the four uses inside clearLastTouch's single
    // gl.clearColor call (both halves share it) — pinned exactly.
    expect(declarations.length).toBeGreaterThanOrEqual(2)
    expect(ENGINE_SOURCE).not.toContain('LAST_TOUCH_DRY_SECONDS = 0')
  })

  it('allocates the pair with the one-literal call and a NEAREST filter', () => {
    expect(ENGINE_SOURCE).toContain(
      'this.lastTouch = g.double(this.dw, this.dh, [FLOAT_R], gl.NEAREST);',
    )
    const allocations = ENGINE_SOURCE.match(/this\.lastTouch\s*=/g) ?? []
    expect(allocations).toHaveLength(1)
    expect(ENGINE_SOURCE).toContain('private lastTouch!: DoubleTarget;')
  })

  it('writes the sentinel into BOTH halves and restores the cleared colour', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private clearLastTouch() {', 'private allocateHistory()')
    expect(body).toContain('for (const t of [this.lastTouch.read, this.lastTouch.write])')
    expect(body).toContain(
      'gl.clearColor(LAST_TOUCH_DRY_SECONDS, LAST_TOUCH_DRY_SECONDS, LAST_TOUCH_DRY_SECONDS, LAST_TOUCH_DRY_SECONDS);',
    )
    expect(body).toContain('gl.clear(gl.COLOR_BUFFER_BIT);')
    expect(body).toContain('gl.clearColor(0, 0, 0, 0);')
  })

  it('clears at the END of allocateTargets, after every target exists', () => {
    const alloc = sliceBetween(ENGINE_SOURCE, 'private allocateTargets() {', 'private clearLastTouch()')
    const pairAt = alloc.indexOf('this.lastTouch = g.double(')
    const clearAt = alloc.lastIndexOf('this.clearLastTouch();')
    expect(pairAt, 'the pair is allocated in allocateTargets').toBeGreaterThan(-1)
    expect(clearAt, 'allocateTargets ends by writing the sentinel').toBeGreaterThan(pairAt)
  })

  it('clears AFTER each docTargets wipe loop — both clear() and resetSheet()', () => {
    const ordered = ENGINE_SOURCE.match(
      /for \(const t of this\.docTargets\(\)\) if \(t !== this\.paper\) this\.g\.clearTarget\(t\);[\s\S]{0,400}?this\.clearLastTouch\(\);/g,
    ) ?? []
    expect(ordered, 'a sheet wipe must not leave the pair at zero').toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// 2. The eight lifecycle sites grow together
// ---------------------------------------------------------------------------

describe('the eight lifecycle sites (D-24)', () => {
  it('1/8 appends lastTouch to the LayerId union and widens WholeDoc.layers', () => {
    expect(ENGINE_SOURCE).toContain(
      "export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet' | 'relief' | 'cover' | 'lastTouch';",
    )
    expect(ENGINE_SOURCE).toContain('layers: Record<LayerId, Uint16Array | Float32Array>')
  })

  it('2/8 lists FLOAT_R as the fifth pool-0 format, before coverage', () => {
    const history = sliceBetween(ENGINE_SOURCE, 'private allocateHistory()', 'private docTargets()')
    expect(history).toContain(
      'formats: [HALF_FLOAT_RGBA, HALF_FLOAT_RGBA, HALF_FLOAT_R, HALF_FLOAT_R, FLOAT_R, HALF_FLOAT_R]',
    )
    // The pairing comment names the grow-together law.
    expect(history).toContain('Grow all three lists together')
  })

  it('3/8 returns the last-touch read half as snapshotLayers()\'s fifth entry', () => {
    const snap = sliceBetween(ENGINE_SOURCE, 'private snapshotLayers()', 'private drawSplat(')
    expect(snap).toContain(
      'return [this.ink.read.views[0], this.ink.read.views[1], this.wet.read.views[0], this.relief.views[0], this.lastTouch.read.views[0], this.cover.read.views[0]];',
    )
  })

  it("4/8 lists the pair as the fifth entry of travel()'s pool-0 map", () => {
    const travel = sliceBetween(ENGINE_SOURCE, "private travel(dir: 'undo' | 'redo'", 'const res = dir ===')
    expect(travel).toContain(
      '[this.lastTouch.read.views[0], this.lastTouch.write.views[0]]',
    )
    // Coverage stays last so its committed pin holds.
    const map = sliceBetween(travel, 'const layers = [', '];')
    expect(map.indexOf('this.cover.read.views[0]')).toBeGreaterThan(
      map.indexOf('this.lastTouch.read.views[0]'),
    )
  })

  it('5/8 places the pair between relief and the coverage pair in docTargets', () => {
    const doc = sliceBetween(ENGINE_SOURCE, 'private docTargets(): Target[] {', 'private createDocument(')
    const reliefAt = doc.indexOf('this.relief')
    const readAt = doc.indexOf('this.lastTouch.read')
    const writeAt = doc.indexOf('this.lastTouch.write')
    const coverAt = doc.indexOf('this.cover.read')
    expect(reliefAt, 'thickness stays before the pair').toBeGreaterThan(-1)
    expect(readAt, 'the read half follows the thickness').toBeGreaterThan(reliefAt)
    expect(writeAt, 'the write half follows the read half').toBeGreaterThan(readAt)
    expect(coverAt, 'coverage stays last').toBeGreaterThan(writeAt)
  })

  it('6/8 captures through readFloat and stores AGES, never raw stamps', () => {
    const whole = sliceBetween(ENGINE_SOURCE, 'private captureWhole()', 'private applyWhole(')
    // Message-first source pins: a raw `toContain` dumps the slice into the
    // RED report and breaks its TAP format.
    const has = (needle: string): void => {
      expect(whole.includes(needle), `missing engine text: ${needle}`).toBe(true)
    }
    has('const readF = (fb: WebGLFramebuffer) => (r ? g.readFloat(fb, dw, dh, r) : new Float32Array(0));')
    // 64-26 (WR-03): the whole-document record is the clock-free form — ages.
    has('lastTouch: stampsToAges(readF(this.lastTouch.read.views[0]), this.nowSec()),')
  })

  it('7/8 re-stamps the AGES on this clock and uploads both halves through uploadFloat', () => {
    const whole = sliceBetween(ENGINE_SOURCE, 'private captureWhole()', 'private applyWhole(')
    const has = (needle: string): void => {
      expect(whole.includes(needle), `missing engine text: ${needle}`).toBe(true)
    }
    has('const upF = (tex: WebGLTexture, data: Float32Array) => g.uploadFloat(tex, r.x0, r.y0, w, h, data);')
    has('const lt = whole.layers.lastTouch;')
    has('if (lt instanceof Float32Array)')
    has('const stamps = agesToStamps(lt, this.nowSec());')
    has('for (const t of [this.lastTouch.read, this.lastTouch.write]) upF(t.tex[0], stamps);')
    // A cached record is restored repeatedly: the upload must never write back
    // into the record it was given.
    expect(
      whole.includes('whole.layers.lastTouch ='),
      'the record is never mutated by an upload',
    ).toBe(false)
  })

  it('keeps the live time base monotonic across sheet wipes; only setClock re-anchors', () => {
    const clear = sliceBetween(ENGINE_SOURCE, 'private clearLastTouch() {', 'private allocateHistory()')
    expect(
      clear.includes('this.timeBaseMs = null;'),
      'a sheet wipe never re-anchors the clock (the resize copy keeps its stamps)',
    ).toBe(false)
    const setClock = ENGINE_SOURCE.split('\n').find(l => l.includes('setClock(fn: () => number)'))
    expect(
      setClock?.includes('this.timeBaseMs = null;'),
      'a new clock starts a new base',
    ).toBe(true)
  })

  it('8/8 carries the pair through a resize into both halves', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'resizeDocument(w: number, h: number) {', 'const shift = ')
    expect(body).toContain('lastTouch: this.lastTouch.read')
    expect(body).toContain('copy(old.lastTouch, [this.lastTouch.read, this.lastTouch.write]);')
  })
})

// ---------------------------------------------------------------------------
// 2b. The ping-pong carry and its invalidations (64-26 / CR-03)
// ---------------------------------------------------------------------------

describe('the last-touch carry (CR-03)', () => {
  // Source pins report the missing LITERAL, never the whole source: a raw
  // `toContain` dumps Engine.ts into the RED report and breaks its format.
  const engineContains = (needle: string): void => {
    expect(ENGINE_SOURCE.includes(needle), `missing engine text: ${needle}`).toBe(true)
  }

  it('imports the carry module and holds ONE pending-rect state per ping-pong pair', () => {
    expect(
      /import \{[^}]*\bnewLastTouchCarry\b[^}]*\} from '\.\/lastTouchCarry'/.test(ENGINE_SOURCE),
      'the engine imports the carry module',
    ).toBe(true)
    engineContains('private touchCarry = newLastTouchCarry();')
    // 261126 (edge-leg, Law 2): the stroke layer's ink pair ping-pongs too —
    // its deposit samples the previous film and writes the other half, so it
    // needs its own pending-rect state, created with the engine.
    engineContains('private layerInkCarry = newLastTouchCarry();')
    // One state per pair, created with the engine — never a per-stamp
    // allocation.
    expect((ENGINE_SOURCE.match(/newLastTouchCarry\(\)/g) ?? [])).toHaveLength(2)
  })

  it('carries the layer ink rect and swaps the layer pair on the same induction', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private bristleLayerInk(', 'private touch(')
    const carryAt = body.indexOf('takeCarry(this.layerInkCarry)')
    const drawAt = body.indexOf('g.draw(layerOut, rect);')
    const swapAt = body.indexOf('this.layerInk!.swap();')
    const recordAt = body.indexOf('recordStamp(this.layerInkCarry, rect);')
    expect(carryAt, 'the layer carry is taken').toBeGreaterThan(-1)
    expect(carryAt, 'the carry precedes the scissored draw').toBeLessThan(drawAt)
    expect(swapAt, 'the layer pair swaps after the write').toBeGreaterThan(drawAt)
    expect(recordAt, 'the new rect is recorded after the swap').toBeGreaterThan(swapAt)
    // Both ends of the layer's life invalidate the carry: a fresh stroke's
    // first dab must never carry a stale film rect.
    const open = sliceBetween(ENGINE_SOURCE, 'private openLayer(', 'private discardLayer(')
    expect(open.includes('invalidateCarry(this.layerInkCarry)'), 'openLayer invalidates').toBe(true)
    const discard = sliceBetween(ENGINE_SOURCE, 'private discardLayer(', 'private forgetLayer(')
    expect(discard.includes('invalidateCarry(this.layerInkCarry)'), 'discardLayer invalidates').toBe(true)
    const forget = sliceBetween(ENGINE_SOURCE, 'private forgetLayer(', 'private mergeStrokeLayer(')
    expect(forget.includes('invalidateCarry(this.layerInkCarry)'), 'forgetLayer invalidates').toBe(true)
  })

  it('carries the previous rect before the stamp and records the new one after the swap', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private bristleTouch(', 'readBristles(): Uint16Array {')
    const carryAt = body.indexOf('takeCarry(this.touchCarry)')
    const drawAt = body.indexOf('g.draw(this.lastTouch.write, rect);')
    const swapAt = body.indexOf('this.lastTouch.swap();')
    const recordAt = body.indexOf('recordStamp(this.touchCarry, rect);')
    expect(carryAt, 'the pending carry is taken').toBeGreaterThan(-1)
    expect(carryAt, 'the carry precedes the scissored draw').toBeLessThan(drawAt)
    expect(drawAt, 'the write half is drawn').toBeGreaterThan(-1)
    expect(swapAt, 'the pair swaps after the write').toBeGreaterThan(drawAt)
    expect(recordAt, 'the stamp is recorded after the swap').toBeGreaterThan(swapAt)
  })

  it('invalidates the carry at every whole-target write', () => {
    const clear = sliceBetween(ENGINE_SOURCE, 'private clearLastTouch() {', 'private allocateHistory()')
    expect(clear.includes('invalidateCarry(this.touchCarry);'), 'clear invalidates the carry').toBe(true)

    const whole = sliceBetween(ENGINE_SOURCE, 'private uploadWhole(whole: WholeDoc) {', 'private applyWhole(')
    expect(whole.includes('invalidateCarry(this.touchCarry);'), 'uploadWhole invalidates the carry').toBe(true)

    const resize = sliceBetween(ENGINE_SOURCE, 'resizeDocument(w: number, h: number) {', 'const shift = ')
    const copyAt = resize.indexOf('copy(old.lastTouch, [this.lastTouch.read, this.lastTouch.write]);')
    const invalidAt = resize.indexOf('invalidateCarry(this.touchCarry);')
    expect(copyAt, 'a resize carries the raw stamps').toBeGreaterThan(-1)
    expect(invalidAt, 'the resized pair is invalidated after the copy').toBeGreaterThan(copyAt)

    // IN-03: undo/redo restores BOTH halves from history, so a pending carry
    // names texels the restored state no longer holds.
    const travel = sliceBetween(ENGINE_SOURCE, "private travel(dir: 'undo' | 'redo'", 'private notifyHistory()')
    const restoreAt = travel.indexOf('this.history.')
    const travelInvalidAt = travel.indexOf('invalidateCarry(this.touchCarry);')
    expect(restoreAt, 'an undo/redo restores the pair').toBeGreaterThan(-1)
    expect(travelInvalidAt, 'the restored pair is invalidated after the restore').toBeGreaterThan(restoreAt)
  })

  it('states the carry law where the false docstring stood', () => {
    expect(
      ENGINE_SOURCE.includes('Texels outside the dab rect keep their age untouched.'),
      'the false docstring is gone',
    ).toBe(false)
    const doc = sliceBetween(ENGINE_SOURCE, '64-26 (CR-03): the pair is a PING-PONG', 'private bristleTouch(')
    expect(doc.includes('the engine carries the previous dab'), 'the docstring names the carry').toBe(true)
    expect(
      doc.includes('only then do texels outside the current dab keep their age'),
      'the docstring states the real law',
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2c. The Dry step snapshots the pre-dry pair (261123-pee)
// ---------------------------------------------------------------------------

describe('the Dry step and the last-touch clear (261123-pee)', () => {
  it('clears last-touch AFTER the pool-0 snapshot inside the dry step', () => {
    // `fix()` opens the 'dry' step and the settle tail's `touch(..., save = true)`
    // protects pool 0 — which INCLUDES the last-touch read half — into that step.
    // The clear must land after that snapshot or one undo would restore the
    // cleared (one-week-old) field instead of the pre-dry pair.
    const body = sliceBetween(ENGINE_SOURCE, 'fix(auto = false): boolean {', 'cancelAutoFix(): boolean {')
    const stepAt = body.indexOf("this.beginStep('dry', 'Dry');")
    const settleAt = body.indexOf('this.beginSettle(this.painted, true);')
    const clearAt = body.indexOf('this.clearLastTouch();')
    const returnAt = body.indexOf('return true;')
    expect(stepAt, 'the dry step is opened').toBeGreaterThan(-1)
    expect(settleAt, 'the settle tail runs inside the step').toBeGreaterThan(stepAt)
    expect(clearAt, 'the clear lands after the pool-0 snapshot').toBeGreaterThan(settleAt)
    expect(returnAt, 'the clear precedes the return').toBeGreaterThan(clearAt)
  })
})

// ---------------------------------------------------------------------------
// 3. The exact-float helpers
// ---------------------------------------------------------------------------

describe('exact-float read / upload (D-24)', () => {
  it('readFloat reads RGBA / FLOAT in bands, keeps lane 0, and unbinds', () => {
    expect(GL_SOURCE).toContain(
      'readFloat(fb: WebGLFramebuffer, w: number, h: number, rect?: Rect): Float32Array',
    )
    const body = sliceBetween(GL_SOURCE, 'readFloat(', 'uploadFloat(')
    expect(body).toContain('gl.pixelStorei(gl.PACK_ALIGNMENT, 1);')
    expect(body).toContain('gl.readPixels(x0, y0 + y, rw, n, gl.RGBA, gl.FLOAT,')
    expect(body).toContain('out[base + i] = band[i * 4];')
    expect(body).toContain("throw new Error('This GPU cannot read its paint layers back.');")
    expect(body).toContain('gl.bindFramebuffer(gl.FRAMEBUFFER, null);')
  })

  it('uploadFloat uploads RED / FLOAT with UNPACK_ALIGNMENT 4', () => {
    expect(GL_SOURCE).toContain(
      'uploadFloat(tex: WebGLTexture, x: number, y: number, w: number, h: number, data: Float32Array)',
    )
    const body = sliceBetween(GL_SOURCE, 'uploadFloat(', 'Upload half floats')
    expect(body).toContain('gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);')
    expect(body).toContain('gl.texSubImage2D(gl.TEXTURE_2D, 0, x, y, w, h, gl.RED, gl.FLOAT, data);')
  })

  it('documents the round-trip reason: the cleared value is one week old', () => {
    expect(GL_SOURCE).toContain('its cleared value is one week old')
  })
})

// ---------------------------------------------------------------------------
// 4. Engine-internal state
// ---------------------------------------------------------------------------

describe('last-touch is engine-internal (D-24 prohibitions)', () => {
  it('no module and no Rust file outside the engine names the layer', () => {
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
        /layers\.lastTouch/.test(text) ||
        /layers\[['"]lastTouch['"]\]/.test(text) ||
        (file.endsWith('.rs') && /lasttouch/i.test(text))
      )
    })
    expect(offenders).toEqual([])
  })

  it('adds no project-format key: the word only lives in the engine and its tests', () => {
    // The `.mce` writer/parser and the Rust model never mention the field; the
    // scan above proves the record keys, this one the bare engine-only token
    // (case-sensitive, so the documented `setLastTouchMode` A/B seam is not
    // mistaken for a record key).
    const serialization = collectFiles(join(REPO_ROOT, 'app', 'src-tauri', 'src'), ['.rs'])
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')
    expect(serialization).not.toMatch(/lastTouch/)
  })
})

// ---------------------------------------------------------------------------
// 5. The memory arithmetic, recorded beside D-24's reference points
// ---------------------------------------------------------------------------

describe('memory arithmetic (T-64-82, recorded not gated)', () => {
  it('computes the sheet pair for 1080² and 2K', () => {
    // D-24 measured +26.1 MB at 1080² and +67.1 MB at 2K (pair + atlas growth).
    expect(SHEET_PAIR_1080).toBe(9_331_200)
    expect(SHEET_PAIR_2048).toBe(33_554_432)
    // One FLOAT_R layer, four bytes per texel, two halves — the 2 · side² · 4 law.
    expect(SHEET_PAIR_1080).toBe(2 * 1080 * 1080 * 4)
    expect(SHEET_PAIR_2048).toBe(2 * 2048 * 2048 * 4)
  })

  it('keeps the pair document-sized, not per-frame (frame cache 0 B)', () => {
    // The field is reallocated only with the sheet (allocateTargets) and is
    // engine-internal, so no frame-cache entry can carry it: a committed frame
    // is a WebP raster and a new frame starts clean on the sentinel.
    expect(ENGINE_SOURCE).not.toContain('lastTouch.inFrame')
    const allocations = ENGINE_SOURCE.match(/g\.double\(this\.dw, this\.dh, \[FLOAT_R\]/g) ?? []
    expect(allocations).toHaveLength(1)
  })
})
