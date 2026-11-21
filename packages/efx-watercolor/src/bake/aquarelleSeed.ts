// ============================================================
//  aquarelleSeed — LIVE-SEED (post-UAT 2026-11-21)
//
//  The live sheet must be continuous with the committed paint: the
//  stroke's own carrier taps (ink / cover / last-touch) then read the
//  committed base exactly as a re-bake's do, so Pickup 100 over a
//  committed base shows the picked-up hue on the FIRST live paint.
//
//  The seed is a REPLAY of the committed script through the same bake
//  feed path the commit uses (`createAquarelleBake` over the injected
//  LIVE engine), settled with the app's capped law. The engine is held
//  in manual mode and driven on a private seed clock; at the seed's end
//  ONE mode-switched clock closure hands the engine to real time with no
//  `setClock` re-base, so the seeded last-touch stamps start at ~0 age
//  and grow with the artist's real pause — exactly the bake's law.
//
//  Undo: the seed is the committed base, not an artist action. It runs
//  with `setStepRecording(false)`, so no Dry/Stroke step is pushed and
//  no history tile is written (Engine.beginStep / protectHistory).
// ============================================================

import { createAquarelleEngineAdapter } from '../adapter/engineAdapter'
import type { AquarellePayloadEvent } from '../payload/dryEvent'
import type { WatercolorEngine } from '../playground/Engine'
import { createAquarelleBake } from './aquarelleBake'

export interface AquarelleSeedOptions {
  /** The LIVE engine — the one the artist paints on. Never destroyed here. */
  engine: WatercolorEngine
  /** The committed script for the bound frame (Dry events + strokes). */
  events: readonly AquarellePayloadEvent[]
  width?: number
  height?: number
}

export interface AquarelleSeedResult {
  readonly ok: boolean
  readonly reason?: 'cancelled' | 'failed'
  /** Wall time of the whole seed (replay + settle), ms — diagnostics. */
  readonly seedMs: number
  /** Why a failed seed failed (diagnostics only — never thrown). */
  readonly error?: unknown
}

export interface AquarelleSeedHandle {
  readonly done: Promise<AquarelleSeedResult>
  /** Abort the replay. The engine is still handed back to the host. */
  cancel(): void
}

/** `performance.now()` where available (monotonic), `Date.now()` otherwise. */
function readNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

/**
 * Replay `events` into the live engine, then hand the engine back to real
 * time. The caller must own the engine's input surface for the seed's
 * duration (the seeding flag): pointer strokes must not start mid-replay.
 */
export function seedAquarelleEngine(options: AquarelleSeedOptions): AquarelleSeedHandle {
  const { engine, events } = options
  const startedAt = readNow()

  // ONE clock closure, two modes. While seeding, the bake advances `seedMs`
  // (deterministic, exactly the adapter's virtual clock). After the handoff
  // the same closure reads `seedEndMs + real time since the handoff`. No
  // second setClock: the engine's timeBaseMs is re-based once, at install,
  // and every seeded last-touch stamp stays continuous across the flip —
  // ages start at ~0 at handoff and grow with the artist's real pause.
  let seedMode = true
  let seedMs = 0
  let seedEndMs = 0
  let realBase = 0
  const clockNow = () => (seedMode ? seedMs : seedEndMs + (readNow() - realBase))
  const clockAdvance = (ms: number) => {
    if (seedMode && Number.isFinite(ms) && ms > 0) seedMs += ms
  }

  engine.setManual(true)
  engine.setStepRecording(false)
  engine.setClock(clockNow)
  // The replay precondition: a naked sheet on the artist's own paper. The
  // bake's own reset seam — never an undo step, never a paper re-roll.
  engine.resetSheet()

  const adapter = createAquarelleEngineAdapter({
    engine,
    clock: { now: clockNow, advance: clockAdvance },
    width: options.width,
    height: options.height,
  })
  const bake = createAquarelleBake(adapter, {
    width: options.width,
    height: options.height,
    frameCount: 1,
    // The seed captures no frame — the live sheet IS the output.
    encodeWebp: async () => new Uint8Array(0),
    // FREEZE FIX (2026-11-22): the seed replays the WHOLE committed script on
    // the live engine — without slicing it owns the main thread for the replay
    // (1.8 s at 240 samples, more for a real script) and the Studio freezes
    // after every lift and frame change. Yield between samples/ticks; the
    // engine is in manual mode, so the seeded state is unchanged.
    yieldToHostMs: 8,
  })

  let cancelled = false
  const handoff = () => {
    seedEndMs = seedMs
    realBase = readNow()
    seedMode = false
    engine.setStepRecording(true)
    engine.setManual(false)
  }

  const done = (async (): Promise<AquarelleSeedResult> => {
    try {
      const result = await bake.bake(events)
      if (!result.ok) {
        return { ok: false, reason: result.reason, seedMs: readNow() - startedAt }
      }
      return { ok: true, seedMs: readNow() - startedAt }
    } catch (error) {
      return { ok: false, reason: 'failed', seedMs: readNow() - startedAt, error }
    } finally {
      // Always hand the engine back: a cancelled or failed seed must not
      // leave the live surface frozen in manual mode or polluting undo.
      handoff()
      adapter.dispose()
      bake.dispose()
    }
  })()

  return {
    done,
    cancel(): void {
      if (cancelled) return
      cancelled = true
      bake.interrupt()
    },
  }
}
