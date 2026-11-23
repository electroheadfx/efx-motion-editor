// ============================================================
//  The recorded sheet seed — engine seam (Phase 64-21, MED-02).
//
//  Family: source-scan on the existing setup — no new config. vitest
//  has no WebGL2, so no paper can be drawn and no grain read back
//  here; what a source scan CAN prove is pinned below, and the
//  byte-level proof (a pinned seed reproduces on a fresh engine, an
//  unpinned sheet diverges) lives in probe/watercolor-opacity's
//  determinism report, which is why the pin exists at all.
//
//  Laws pinned here:
//   1. ONE roll, in createDocument: the pin wins and `this.rng()` only
//      runs when no pin is set — the constructor-time Math.random roll
//      that made replay equality fail (spike 002) is gone.
//   2. setPaperSeed is compare-then-write: a non-finite seed clears the
//      pin, an unchanged seed returns without drawing, a real change
//      stores the pin, redraws the paper with the current preset and
//      redraws the sheet — never touching params, the deposit, undo
//      history or any render target.
//   3. resetSheet and setPaper NEVER re-roll the seed: a replay's
//      wiped or re-papered sheet keeps the same grain.
//   4. The seed reaches the grain shader as uSeed on every paper draw,
//      and the snapshot carries it so a restore keeps the sheet.
//   5. getPaperSeed hands out the seed actually in force; the three
//      writer sites above are the only `this.paperSeed =` assignments.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')

/** Slice the source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

// Source pins report the missing LITERAL, never the whole source.
function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function expectNotContains(source: string, needle: string): void {
  expect(source.includes(needle), `unexpected source text: ${needle}`).toBe(false)
}

describe('engine sheet seed (64-21, MED-02)', () => {
  it('declares one seed field and one nullable pin', () => {
    expect((ENGINE_SOURCE.match(/private paperSeed = 0;/g) ?? [])).toHaveLength(1)
    expect((ENGINE_SOURCE.match(/private paperSeedPin: number \| null = null;/g) ?? [])).toHaveLength(1)
  })

  it('rolls the seed once, in createDocument, and the pin wins', () => {
    // The pin decides; the engine roll is only the fallback — this is the
    // determinism fix itself (a replay sets the pin before the first stroke).
    expectContains(ENGINE_SOURCE, 'this.paperSeed = this.paperSeedPin ?? this.rng();')
    // No unconditional re-roll may survive beside it.
    expect((ENGINE_SOURCE.match(/this\.paperSeed\s*=\s*this\.rng\(\)/g) ?? [])).toHaveLength(0)
  })

  it('setPaperSeed clears on non-finite, no-ops on unchanged, redraws on change', () => {
    const body = sliceBetween(
      ENGINE_SOURCE,
      'setPaperSeed(seed: number | null) {',
      'getPaperSeed(): number',
    )
    // Non-finite (and null) clear the pin instead of writing a bad seed.
    expectContains(body, "const pinned = typeof seed === 'number' && Number.isFinite(seed) ? seed : null;")
    // Compare-then-write: an unchanged pin and unchanged in-force seed draw nothing.
    expectContains(
      body,
      'if (pinned === this.paperSeedPin && (pinned === null || this.paperSeed === pinned)) return;',
    )
    expectContains(body, 'this.paperSeedPin = pinned;')
    expectContains(body, 'if (pinned === null) return;')
    expectContains(body, 'this.paperSeed = pinned;')
    // A real change regenerates the sheet with the CURRENT preset/scale/origin
    // and redraws the sheet.
    expectContains(body, 'this.drawPaper(this.paper, this.paperOrigin, this.paperScale);')
    expectContains(body, 'this.redraw();')
    // Order: store the pin, then the clear exit, then the real write.
    expect(body.indexOf('this.paperSeedPin = pinned;')).toBeLessThan(
      body.indexOf('if (pinned === null) return;'),
    )
    expect(body.indexOf('if (pinned === null) return;')).toBeLessThan(
      body.indexOf('this.paperSeed = pinned;'),
    )
    // Render-only: params, the deposit, undo history and the targets are never
    // touched (no target may be recreated by a seed change).
    expectNotContains(body, 'this.params')
    expectNotContains(body, 'deposit')
    expectNotContains(body, 'protect(')
    expectNotContains(body, 'this.history')
    expectNotContains(body, 'g.double')
    expectNotContains(body, 'allocateTargets')
  })

  it('resetSheet never re-rolls or rewrites the seed', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'resetSheet() {', 'abortStroke() {')
    expectNotContains(body, 'paperSeed')
    expectNotContains(body, 'this.rng()')
  })

  it('setPaper never re-rolls or rewrites the seed', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'setPaper(p: PaperPreset) {', 'paperSwatch(p: PaperPreset')
    expectNotContains(body, 'paperSeed')
    expectNotContains(body, 'this.rng()')
  })

  it('getPaperSeed returns the seed actually in force', () => {
    expectContains(ENGINE_SOURCE, 'getPaperSeed(): number { return this.paperSeed; }')
  })

  it('writes the seed in exactly three places: creation, restore and the setter', () => {
    // `(?!=)` keeps the `this.paperSeed === pinned` comparison out of the count.
    const writes = [...ENGINE_SOURCE.matchAll(/this\.paperSeed\s*=(?!=)/g)]
    expect(writes).toHaveLength(3)
  })

  it('feeds uSeed on every paper draw and carries the seed in the snapshot', () => {
    const draw = sliceBetween(
      ENGINE_SOURCE,
      'drawPaper(t: Target, offset: [number, number], scale: number, preset = this.paperPreset) {',
      'setTool(t: Tool) {',
    )
    expectContains(draw, 'gl.uniform1f(f.u.uSeed, this.paperSeed);')
    // The snapshot round-trip: a saved/restored sheet keeps its grain.
    expectContains(
      ENGINE_SOURCE,
      'paper: { id: this.paperPreset.id, seed: this.paperSeed, origin: [...this.paperOrigin], scale: this.paperScale, strength: this.paperStrength },',
    )
    expectContains(ENGINE_SOURCE, 'this.paperSeed = s.paper.seed;')
  })
})
