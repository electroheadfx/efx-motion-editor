// ============================================================
//  HOLD-WET (261123-pee) — the live Studio sheet never auto-dries.
//
//  Family: source-scan on the existing setup (vitest has no WebGL2, so no
//  target can be created and no texel read back here). The byte-level proof
//  lives in probe/wet-hold (post-sleep gate open, pickup retained, the
//  settled export is a capture in both the asleep and the awake window) and
//  in the artist's live UAT rows.
//
//  Laws pinned here:
//   1. `setHoldWet` is the ONE hold authority. While held, decay is bypassed
//      READER-SIDE (wetDecay + the advectWet uDecay uniform), sleep() keeps
//      `wetPeak`, and `awakeUntil()` ALSO bounds the awake window after the
//      last wet input at the visible settle cap (261123-vkb: the sim sleeps at
//      that cap with no fix and no decay — no wake loop) while `wetUntil()`
//      and its natural window stay byte-identical (the unheld branch).
//   2. The automatic fix (settle cap) never dries a held sheet; the explicit
//      Dry clears the hold and clears last-touch AFTER the pool-0 snapshot of
//      the 'dry' step (pinned end-to-end in lastTouch.test.ts).
//   3. `settleForCapture` is the capture-path settle: the same tick law
//      through `beginSettle(rect, save)` with no beginStep, no protectHistory,
//      no clearLastTouch and no hold write — a capture can never push an
//      unledgered engine step.
//   4. `exportSettledCanvas` is the non-mutating settled export: raw only for
//      a REAL in-flight stroke (`this.stroke`, NEVER the simulated `active`),
//      drives an in-flight Dry to completion, otherwise captures / settles /
//      exports and ALWAYS restores; no engine step, no hold write.
//   5. `SheetSnapshot` carries `wetPeak` + `wetAgo` and `restoreSheet`
//      restores `painted` / `wetPeak` / `lastWet` — an adopted wet sheet
//      blends on the next stroke and stays dryable.
//   6. `historyRevision` bumps only past a real stack move in `travel()`, the
//      signal the live Dry settle-capture timer invalidates on.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')

/** Slice the engine source between two literal anchors; throws when absent. */
function sliceBetween(source: string, startAnchor: string, endAnchor: string): string {
  const start = source.indexOf(startAnchor)
  expect(start, `anchor not found: ${startAnchor}`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf(endAnchor, start + startAnchor.length)
  expect(end, `anchor not found after start: ${endAnchor}`).toBeGreaterThan(start)
  return source.slice(start, end)
}

// ---------------------------------------------------------------------------
// 1. The one hold authority
// ---------------------------------------------------------------------------

describe('the hold flag is the one authority (261123-pee)', () => {
  it('declares exactly one holdWet field and one public setter that only assigns', () => {
    const declarations = ENGINE_SOURCE.match(/private holdWet = false;/g) ?? []
    expect(declarations).toHaveLength(1)
    const setter = sliceBetween(ENGINE_SOURCE, 'setHoldWet(held: boolean) {', '\n  }')
    expect(setter.includes('this.holdWet = held;'), 'the setter only assigns the flag').toBe(true)
    // No other method writes the flag directly — the setter and fix()'s
    // explicit-Dry clear are the only two writers.
    const writes = ENGINE_SOURCE.match(/this\.holdWet = (?!held;)/g) ?? []
    expect(writes).toHaveLength(1)
  })

  it('exposes isFixing as the raw fix-timer read', () => {
    expect(ENGINE_SOURCE).toContain('get isFixing(): boolean { return this.fixTimer > 0; }')
  })

  it('bypasses wetDecay while held and not fixing, and leaves dryTau untouched', () => {
    const decay = sliceBetween(ENGINE_SOURCE, 'private wetDecay() {', '/** Time (ms) until standing water')
    expect(
      decay.includes('return this.holdWet && this.fixTimer <= 0 ? 1 : Math.exp('),
      'the held sheet keeps its water (a fix still flash-dries)',
    ).toBe(true)
    const tau = sliceBetween(ENGINE_SOURCE, 'private dryTau() {', 'private wetDecay() {')
    expect(tau.includes('this.params.dry'), 'the DRY slider still owns the tau').toBe(true)
  })

  it('uses the same bypass for the advectWet uDecay uniform in step()', () => {
    expect(ENGINE_SOURCE).toContain(
      'gl.uniform1f(P.advectWet.u.uDecay, this.holdWet && !fixing ? 1 : Math.exp(-dt / this.dryTau()));',
    )
  })

  it('keeps wetPeak across sleep() when held — and only a zero write exists', () => {
    const sleep = sliceBetween(ENGINE_SOURCE, 'private sleep() {', '/* -------------------------------------------------------------- display */')
    expect(sleep.includes('if (!this.holdWet) this.wetPeak = 0;'), 'the peak survives a held sleep').toBe(true)
    expect(
      (sleep.match(/this\.wetPeak = 0;/g) ?? []).length,
      'the peak zero is the only one and it is guarded',
    ).toBe(1)
    // Everything else the sleep does stays: the sim must still go idle.
    expect(sleep.includes('this.active = null;'), 'the sim still sleeps').toBe(true)
    expect(sleep.includes('this.flowSpeed = 0;'), 'velocity bookkeeping is untouched').toBe(true)
  })

  it('routes every awake site through awakeUntil() and keeps wetUntil() byte-identical', () => {
    const awake = sliceBetween(ENGINE_SOURCE, 'get isAwake(): boolean {', 'get hasStandingWater(): boolean {')
    expect(
      awake.includes('(this.stroke !== null || this.fixTimer > 0 || now < this.minAwakeUntil || now < this.awakeUntil())'),
      'isAwake reads the held awake window',
    ).toBe(true)
    const until = sliceBetween(ENGINE_SOURCE, 'private wetUntil() {', 'private beginStep(')
    expect(until.includes('return this.lastWet + this.dryTau() * Math.log(this.wetPeak / WET_THRESHOLD) * 1000;')).toBe(true)
    // HOLD-WET (261123-vkb): the ONE awake-window helper. Unheld returns the
    // natural window exactly; held is the strict min of that window and the
    // visible settle cap measured from `lastWet` (percent in, ticks out).
    const helper = sliceBetween(ENGINE_SOURCE, 'private awakeUntil() {', '/** Time (ms) until standing water')
    expect(helper.includes('if (!this.holdWet) return this.wetUntil();'), 'the unheld branch is today\'s window').toBe(true)
    expect(
      helper.includes('return Math.min(this.wetUntil(), this.lastWet + aquarelleVisibleSettleTicks(this.params.dry * 100) * SETTLE_TICK_MS);'),
      'the held branch is the strict min at the visible settle cap',
    ).toBe(true)
    const a = ENGINE_SOURCE.match(/\(this\.stroke !== null \|\| this\.fixTimer > 0 \|\| now < this\.minAwakeUntil \|\| now < this\.awakeUntil\(\)\)/g) ?? []
    const b = ENGINE_SOURCE.match(/\(this\.stroke !== null \|\| this\.fixTimer > 0 \|\| clockNow < this\.minAwakeUntil \|\| clockNow < this\.awakeUntil\(\)\)/g) ?? []
    expect(a, 'isAwake + tick() awake expressions read awakeUntil').toHaveLength(2)
    expect(b, 'the rAF awake expression reads awakeUntil').toHaveLength(1)
    const retired = ENGINE_SOURCE.match(/(?:now|clockNow) < this\.wetUntil\(\)/g) ?? []
    expect(retired, 'the retired wetUntil awake comparisons are gone').toHaveLength(0)
  })

  it('passes the hold into the Water gate', () => {
    const gate = sliceBetween(ENGINE_SOURCE, 'get hasStandingWater(): boolean {', 'get hasPaint(): boolean {')
    expect(gate.includes('held: this.holdWet,'), 'the gate reads the hold').toBe(true)
    expect(gate.includes('fixing: this.fixTimer > 0,'), 'the gate still reads the fix').toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 2. The Dry step and the automatic refusal
// ---------------------------------------------------------------------------

describe('fix() — the Dry step (261123-pee)', () => {
  it('refuses the automatic fix while held, before the painted/fixing guard', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'fix(auto = false): boolean {', 'cancelAutoFix(): boolean {')
    const autoRefusal = body.indexOf('if (auto) { if (this.holdWet) return false; }')
    const guard = body.indexOf('if (!this.painted || this.fixTimer > 0) return false;')
    expect(autoRefusal, 'the automatic call is refused first').toBeGreaterThan(-1)
    expect(guard, 'the painted/fixing guard survives').toBeGreaterThan(autoRefusal)
  })

  it('lifts the hold on the explicit Dry', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'fix(auto = false): boolean {', 'cancelAutoFix(): boolean {')
    expect(body.includes('else this.holdWet = false;'), 'an explicit Dry lifts the hold').toBe(true)
  })

  it('opens the dry step, then the settle tail with save = true, then clears last-touch', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'fix(auto = false): boolean {', 'cancelAutoFix(): boolean {')
    const stepAt = body.indexOf("this.beginStep('dry', 'Dry');")
    const settleAt = body.indexOf('this.beginSettle(this.painted, true);')
    const clearAt = body.indexOf('this.clearLastTouch();')
    expect(stepAt, 'the step opens first').toBeGreaterThan(-1)
    expect(settleAt, 'the settle tail runs inside the step').toBeGreaterThan(stepAt)
    expect(clearAt, 'the clear lands after the pool-0 snapshot').toBeGreaterThan(settleAt)
  })

  it('factors the shared tail into beginSettle(rect, save) with no step of its own', () => {
    const tail = sliceBetween(ENGINE_SOURCE, 'private beginSettle(rect: Rect, save: boolean) {', 'fix(auto = false): boolean {')
    expect(tail.includes('this.fixTimer = FIX_DURATION;')).toBe(true)
    expect(tail.includes('this.touch(rect, true, save);')).toBe(true)
    expect(tail.includes('this.schedule();')).toBe(true)
    expect(tail.includes('beginStep'), 'the tail never opens a step').toBe(false)
    expect(tail.includes('clearLastTouch'), 'the tail never clears last-touch').toBe(false)
    // save = true is reserved for the caller that just opened a step.
    const callers = ENGINE_SOURCE.match(/this\.beginSettle\(/g) ?? []
    expect(callers, 'three callers: fix (save), settleForCapture, exportSettledCanvas').toHaveLength(3)
    expect((ENGINE_SOURCE.match(/this\.beginSettle\([^)]*, true\)/g) ?? [])).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// 3. The capture-path settle is step-free
// ---------------------------------------------------------------------------

describe('settleForCapture() — the no-step capture settle (261123-pee)', () => {
  it('starts the same tick law through beginSettle(rect, false)', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'settleForCapture(): boolean {', 'exportSettledCanvas(): HTMLCanvasElement | null {')
    expect(body.includes('if (!this.painted || this.fixTimer > 0) return false;')).toBe(true)
    expect(body.includes('this.beginSettle(this.painted, false);')).toBe(true)
    expect(body.includes('return true;')).toBe(true)
  })

  it('refuses during a REAL in-flight stroke (settling would abort it)', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'settleForCapture(): boolean {', 'exportSettledCanvas(): HTMLCanvasElement | null {')
    const strokeGuard = body.indexOf('if (this.stroke !== null) return false;')
    const paintGuard = body.indexOf('if (!this.painted || this.fixTimer > 0) return false;')
    expect(strokeGuard, 'the stroke gate mirrors the settled export').toBeGreaterThan(-1)
    expect(paintGuard).toBeGreaterThan(strokeGuard)
  })

  it('opens no step, protects nothing, clears nothing and writes no hold', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'settleForCapture(): boolean {', 'exportSettledCanvas(): HTMLCanvasElement | null {')
    expect(body.includes('beginStep'), 'no engine history step').toBe(false)
    expect(body.includes('protectHistory'), 'no history protect').toBe(false)
    expect(body.includes('clearLastTouch'), 'the last-touch clear stays inside the recorded Dry').toBe(false)
    expect(body.includes('setHoldWet'), 'the hold lift lives in the layer wrapper').toBe(false)
    expect(body.includes('holdWet ='), 'no hold write').toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. The non-mutating settled export
// ---------------------------------------------------------------------------

describe('exportSettledCanvas() — the settled export (261123-pee)', () => {
  it('guards the raw path on the real in-flight stroke, never the simulated region', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'exportSettledCanvas(): HTMLCanvasElement | null {', '/** Wipe the paint as one undo step.')
    expect(body.length, 'exportSettledCanvas is a bounded method').toBeGreaterThan(0)
    expect(body.includes('if (this.stroke !== null) return this.exportCanvas(\'transparent\');')).toBe(true)
    // `active` is the simulated region: non-null for the whole awake window
    // after a stroke and during any fix. A guard keyed on it would export the
    // raw wet sheet right after every stroke.
    expect(body.includes('this.active'), 'the raw guard never reads the simulated region').toBe(false)
  })

  it('drives an in-flight explicit Dry to completion before exporting', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'exportSettledCanvas(): HTMLCanvasElement | null {', '/** Wipe the paint as one undo step.')
    expect(body.includes('if (this.fixTimer > 0) {')).toBe(true)
    expect(body.includes('for (let i = 0; i < maxTicks && this.fixTimer > 0; i++) this.tick(1 / 60);')).toBe(true)
    expect(body.includes('const maxTicks = Math.ceil(FIX_DURATION * 60) + 1;')).toBe(true)
  })

  it('keeps the cheap raw path for a blank or settled sheet', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'exportSettledCanvas(): HTMLCanvasElement | null {', '/** Wipe the paint as one undo step.')
    expect(body.includes("if (this.painted === null || !this.hasStandingWater) return this.exportCanvas('transparent');")).toBe(true)
  })

  it('settles a wet sheet through the no-step tail and ALWAYS restores it', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'exportSettledCanvas(): HTMLCanvasElement | null {', '/** Wipe the paint as one undo step.')
    const captureAt = body.indexOf('const snap = this.captureSheet();')
    const settleAt = body.indexOf('this.beginSettle(this.painted, false);')
    const finallyAt = body.indexOf('} finally {')
    const restoreAt = body.indexOf('this.restoreSheet(snap);')
    expect(captureAt, 'the sheet is captured before the settle').toBeGreaterThan(-1)
    expect(settleAt, 'the same tail, never the explicit Dry').toBeGreaterThan(captureAt)
    expect(finallyAt, 'the restore is unconditional').toBeGreaterThan(settleAt)
    expect(restoreAt, 'the captured sheet goes back').toBeGreaterThan(finallyAt)
    expect(body.includes('fix('), 'the settled export never calls the explicit Dry').toBe(false)
  })

  it('opens no engine step, clears nothing and writes no hold', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'exportSettledCanvas(): HTMLCanvasElement | null {', '/** Wipe the paint as one undo step.')
    expect(body.includes('beginStep'), 'no engine history step').toBe(false)
    expect(body.includes('protectHistory'), 'no history protect').toBe(false)
    expect(body.includes('clearLastTouch'), 'no last-touch clear').toBe(false)
    expect(body.includes('setHoldWet'), 'no hold write').toBe(false)
    expect(body.includes('holdWet ='), 'no hold write').toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 5. Wet truth across the sheet cache
// ---------------------------------------------------------------------------

describe('the wet truth in SheetSnapshot (261123-pee)', () => {
  it('declares wetPeak + wetAgo beside the whole/bristle record', () => {
    const iface = sliceBetween(ENGINE_SOURCE, 'export interface SheetSnapshot {', 'export interface DocState {')
    expect(iface.includes('wetPeak: number;')).toBe(true)
    expect(iface.includes('wetAgo: number;')).toBe(true)
  })

  it('captures the peak and the water AGE (never an absolute stamp)', () => {
    const capture = sliceBetween(ENGINE_SOURCE, 'captureSheet(): SheetSnapshot {', 'restoreSheet(s: SheetSnapshot): boolean {')
    expect(capture.includes('wetPeak: this.wetPeak,')).toBe(true)
    expect(
      capture.includes('wetAgo: Number.isFinite(this.lastWet) ? (this.clock() - this.lastWet) / 1000 : Infinity'),
      'the age is a clock distance, Infinity when never wet',
    ).toBe(true)
  })

  it('restores painted / wetPeak / lastWet so an adopted wet sheet is dryable and wet', () => {
    const body = sliceBetween(ENGINE_SOURCE, 'restoreSheet(s: SheetSnapshot): boolean {', '/** Replace the painting with a saved one. History starts afresh. */')
    const uploadAt = body.indexOf('this.uploadWhole(whole);')
    const paintedAt = body.indexOf('this.painted = whole.rect ? { ...whole.rect } : null;')
    expect(paintedAt, 'a restored painted rect makes fix() a real step').toBeGreaterThan(uploadAt)
    expect(body.includes('this.wetPeak = s.wetPeak ?? 0;')).toBe(true)
    expect(body.includes('this.lastWet = Number.isFinite(s.wetAgo) ? this.clock() - s.wetAgo * 1000 : -Infinity;')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 6. The history-move signal behind the Dry-timer invalidation
// ---------------------------------------------------------------------------

describe('historyRevision (261123-pee)', () => {
  it('declares one counter and one read-only getter', () => {
    expect((ENGINE_SOURCE.match(/private historyMoves = 0;/g) ?? [])).toHaveLength(1)
    expect(ENGINE_SOURCE).toContain('get historyRevision(): number { return this.historyMoves; }')
  })

  it('exposes the pending step kinds for the Dry ledger alignment guard (CR-01)', () => {
    expect(ENGINE_SOURCE).toContain('get peekUndoKind(): StepKind | null { return this.history.peekUndo()?.kind ?? null; }')
    expect(ENGINE_SOURCE).toContain('get peekRedoKind(): StepKind | null { return this.history.peekRedo()?.kind ?? null; }')
  })

  it('bumps ONLY past a real stack move in travel()', () => {
    const travel = sliceBetween(ENGINE_SOURCE, "private travel(dir: 'undo' | 'redo'", 'private notifyHistory()')
    const movedAt = travel.indexOf('if (!res) return;')
    const bumpAt = travel.indexOf('this.historyMoves++;')
    expect(movedAt, 'the no-op move returns first').toBeGreaterThan(-1)
    expect(bumpAt, 'a real move bumps the revision').toBeGreaterThan(movedAt)
    // One bump, nowhere else: an undo+redo pair returns to the same depth, so
    // the counter (not history.entries().index) is what a timer can trust.
    expect((ENGINE_SOURCE.match(/this\.historyMoves\+\+/g) ?? [])).toHaveLength(1)
  })
})
