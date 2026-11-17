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
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
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

  it('lists the thickness target LAST in docTargets, so the sheet wipe clears it', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'private docTargets(): Target[] {', 'private createDocument(')
    const openIndex = body.indexOf('return [')
    expect(openIndex).toBeGreaterThanOrEqual(0)
    const entries = splitTopLevel(extractBracket(body, openIndex + 'return '.length))
    expect(entries[entries.length - 1]).toBe('this.relief')
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
  it("keeps pool 0's formats, snapshotLayers() and the undo layer map the same length with thickness last", () => {
    // Pool 0's formats, from allocateHistory().
    const historyBody = sliceBetween(ENGINE_SOURCE, 'private allocateHistory() {', 'private docTargets()')
    const formatsAt = historyBody.indexOf('formats: [')
    expect(formatsAt, 'pool 0 formats array not found').toBeGreaterThanOrEqual(0)
    const formats = splitTopLevel(extractBracket(historyBody, formatsAt + 'formats: '.length))
    expect(formats).toEqual(['HALF_FLOAT_RGBA', 'HALF_FLOAT_RGBA', 'HALF_FLOAT_R', 'HALF_FLOAT_R'])

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
    ])

    // The three lists are positionally paired: equal length, same last index.
    expect(snapshot).toHaveLength(formats.length)
    expect(pool0).toHaveLength(formats.length)
    expect(snapshot[snapshot.length - 1]).toBe('this.relief.views[0]')
    expect(pool0[pool0.length - 1]).toBe('[this.relief.views[0]]')
    // A single framebuffer, not a ping-pong pair: History.swap reads fbs[0]
    // and writes every framebuffer in the entry.
    expect(pool0[pool0.length - 1]!.match(/views\[0\]/g)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 3. WholeDoc carry, and the resize copy
// ---------------------------------------------------------------------------

describe('WholeDoc carry (MED-18.adjacency)', () => {
  it("adds 'relief' to the LayerId union and the WholeDoc layer record", () => {
    expect(ENGINE_SOURCE).toContain(
      "export type LayerId = 'inkA' | 'inkB' | 'fixedA' | 'fixedB' | 'wet' | 'relief';",
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
