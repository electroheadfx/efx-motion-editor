// ============================================================
//  LIVE-SEED (post-UAT 2026-11-21) — the seed replay's undo and
//  clock laws.
//
//  The live sheet is seeded by replaying the committed script
//  through the bake's own adapter feed path on the LIVE engine
//  (`seedAquarelleEngine`). That replay is the committed base,
//  not an artist action, so it must never touch the undo memory,
//  and it must hand the engine back on one continuous clock.
//
//  Laws pinned here:
//   1. `Engine.setStepRecording(false)` makes `beginStep` AND every
//      `history.protect` call a no-op — every protect site routes
//      through `protectHistory`, so one missed site cannot write
//      tiles into the step below the seed.
//   2. `recordChange` (paper / reference) is suppressed the same way.
//   3. `aquarelleSeed.ts` turns recording off BEFORE the replay and
//      back on in the handoff (finally), on the LIVE engine, with
//      ONE mode-switched clock closure and no second `setClock`.
//   4. The adapter's injected-engine mode never installs its own
//      clock/RNG and never destroys the engine; `dispose()` is a
//      no-op for the injected instance.
//
//  Runtime proof of the seeded surface (final pixels vs the re-bake)
//  lives in probe/pickup-collapse — vitest is blind to WebGL.
// ============================================================

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createAquarelleEngineAdapter } from '../adapter/engineAdapter'
import type { WatercolorEngine } from './Engine'

const HERE = dirname(fileURLToPath(import.meta.url))

const ENGINE_SOURCE = readFileSync(resolve(HERE, 'Engine.ts'), 'utf8')
const SEED_SOURCE = readFileSync(resolve(HERE, '../bake/aquarelleSeed.ts'), 'utf8')
const ADAPTER_SOURCE = readFileSync(resolve(HERE, '../adapter/engineAdapter.ts'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve(HERE, '../index.ts'), 'utf8')

function expectContains(source: string, needle: string): void {
  expect(source.includes(needle), `missing source text: ${needle}`).toBe(true)
}

function countOccurrences(source: string, needle: string): number {
  return source.split(needle).length - 1
}

describe('the undo suppression seam (setStepRecording)', () => {
  it('defaults to recording and exposes the toggle', () => {
    expectContains(ENGINE_SOURCE, 'private stepRecording = true;')
    expectContains(ENGINE_SOURCE, 'setStepRecording(on: boolean) {')
    expectContains(ENGINE_SOURCE, 'this.stepRecording = on;')
  })

  it('guards beginStep before the history push', () => {
    const step = ENGINE_SOURCE.slice(
      ENGINE_SOURCE.indexOf('private beginStep('),
      ENGINE_SOURCE.indexOf('private step(dt: number)'),
    )
    expectContains(step, 'if (!this.stepRecording) return;')
    expect(step.indexOf('if (!this.stepRecording) return;')).toBeLessThan(
      step.indexOf('this.history.begin('),
    )
  })

  it('guards recordChange the same way', () => {
    const change = ENGINE_SOURCE.slice(
      ENGINE_SOURCE.indexOf('recordChange(kind: StepKind'),
      ENGINE_SOURCE.indexOf('snapshot(): DocumentSnapshot'),
    )
    expectContains(change, 'if (!this.stepRecording) return;')
    expect(change.indexOf('if (!this.stepRecording) return;')).toBeLessThan(
      change.indexOf('this.history.begin('),
    )
  })

  it('routes EVERY history.protect call through the guarded helper', () => {
    // The helper itself holds the one and only direct call.
    expect(countOccurrences(ENGINE_SOURCE, 'this.history.protect(')).toBe(1)
    const helper = ENGINE_SOURCE.slice(
      ENGINE_SOURCE.indexOf('private protectHistory('),
      ENGINE_SOURCE.indexOf('private step(dt: number)'),
    )
    expectContains(helper, 'if (!this.stepRecording) return;')
    expectContains(helper, 'this.history.protect(p, rect, layers);')
    // The five protecting sites (fix, clear x2, cover, touch, lift) all call it.
    expect(countOccurrences(ENGINE_SOURCE, 'this.protectHistory(')).toBeGreaterThanOrEqual(6)
  })
})

describe('the seed replay law (aquarelleSeed)', () => {
  it('turns recording off before the replay and restores in the handoff', () => {
    expectContains(SEED_SOURCE, 'engine.setStepRecording(false)')
    expect(SEED_SOURCE.indexOf('engine.setStepRecording(false)')).toBeLessThan(
      SEED_SOURCE.indexOf('createAquarelleEngineAdapter('),
    )
    const handoff = SEED_SOURCE.slice(
      SEED_SOURCE.indexOf('const handoff = () => {'),
      SEED_SOURCE.indexOf('const done = (async'),
    )
    expectContains(handoff, 'engine.setStepRecording(true)')
    expectContains(handoff, 'engine.setManual(false)')
  })

  it('installs ONE mode-switched clock before the replay and never re-bases it', () => {
    expect(countOccurrences(SEED_SOURCE, 'engine.setClock(')).toBe(1)
    expect(SEED_SOURCE.indexOf('engine.setClock(clockNow)')).toBeLessThan(
      SEED_SOURCE.indexOf('createAquarelleEngineAdapter('),
    )
    expectContains(SEED_SOURCE, 'const clockNow = () => (seedMode ? seedMs : seedEndMs + (readNow() - realBase))')
    expectContains(SEED_SOURCE, 'const handoff = () => {')
    expectContains(SEED_SOURCE, 'seedEndMs = seedMs')
    expectContains(SEED_SOURCE, 'seedMode = false')
  })

  it('replays through the bake law on the injected live engine, one frame', () => {
    expectContains(SEED_SOURCE, 'createAquarelleEngineAdapter({')
    expectContains(SEED_SOURCE, 'engine,')
    expectContains(SEED_SOURCE, 'clock: { now: clockNow, advance: clockAdvance },')
    expectContains(SEED_SOURCE, 'createAquarelleBake(adapter, {')
    expectContains(SEED_SOURCE, 'frameCount: 1,')
    expectContains(SEED_SOURCE, 'engine.setManual(true)')
    // The naked-sheet precondition is the bake's own reset seam.
    expectContains(SEED_SOURCE, 'engine.resetSheet()')
  })

  it('is exported from the MAIN entry only (the lean bake chunk stays lean)', () => {
    expectContains(INDEX_SOURCE, "export * from './bake/aquarelleSeed'")
  })
})

describe('the seed orchestration at runtime (no WebGL)', () => {
  it('owns the engine for the replay and hands it back even when the bake fails', async () => {
    // A Proxy engine records every engine call. The bake is given no events,
    // so its WebGL work fails closed — which is exactly the path that must
    // still restore recording + manual mode (the finally/handoff law).
    const { seedAquarelleEngine } = await import('../bake/aquarelleSeed')
    const calls: string[] = []
    const stub = new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'then') return undefined
          return (..._args: unknown[]) => {
            calls.push(String(prop))
            return undefined
          }
        },
      },
    ) as unknown as WatercolorEngine
    const handle = seedAquarelleEngine({ engine: stub, events: [], width: 8, height: 8 })
    const result = await handle.done
    expect(typeof result.ok).toBe('boolean')
    // The ONE install: manual mode, recording off, one clock, the naked sheet.
    expect(calls.filter((c) => c === 'setClock')).toHaveLength(1)
    expect(calls.indexOf('setManual')).toBeLessThan(calls.indexOf('setStepRecording'))
    expect(calls.indexOf('setStepRecording')).toBeLessThan(calls.indexOf('setClock'))
    expect(calls.indexOf('setClock')).toBeLessThan(calls.indexOf('resetSheet'))
    // The handoff ALWAYS runs (finally): recording back on, manual back off.
    const lastRecording = calls.lastIndexOf('setStepRecording')
    const lastManual = calls.lastIndexOf('setManual')
    expect(calls[lastRecording]).toBe('setStepRecording')
    expect(calls[lastManual]).toBe('setManual')
    expect(calls.lastIndexOf('setManual')).toBeGreaterThan(calls.lastIndexOf('setStepRecording'))
    // The LIVE engine is never destroyed by the seed.
    expect(calls).not.toContain('destroy')
  })
})

describe('the adapter injected-engine mode', () => {
  it('pins the seams in source', () => {
    expectContains(ADAPTER_SOURCE, 'engine?: WatercolorEngine')
    expectContains(ADAPTER_SOURCE, 'clock?: { now(): number; advance(ms: number): void }')
    expectContains(ADAPTER_SOURCE, 'if (!injectedEngine) engine?.destroy()')
  })

  it('never destroys the injected engine and never installs its own clock', () => {
    const calls: string[] = []
    const stub = new Proxy(
      {},
      {
        get: (_target, prop) => {
          if (prop === 'then') return undefined
          return (..._args: unknown[]) => {
            calls.push(String(prop))
            return undefined
          }
        },
      },
    ) as unknown as WatercolorEngine
    const adapter = createAquarelleEngineAdapter({ engine: stub, width: 8, height: 8 })
    adapter.dispose()
    expect(calls).not.toContain('destroy')
    expect(calls).not.toContain('setClock')
    expect(calls).not.toContain('setRandom')
    expect(calls).not.toContain('setManual')
    expect(calls).not.toContain('setPaper')
  })
})
