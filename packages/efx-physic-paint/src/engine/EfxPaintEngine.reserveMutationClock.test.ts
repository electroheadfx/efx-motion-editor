// ============================================================
//  quick-261023-l35 — EfxPaintEngine.reserveMutationClock.
//
//  The Studio restores a watercolor script whose mutationIds came
//  from a PREVIOUS window's engine (its own counter restarts at 1).
//  Without a reservation the first new stroke would reuse a restored
//  id and silently overwrite that registry entry.
//
//  These cells drive the real `enqueueRecordedStroke` -> `acceptStroke`
//  id assignment on a prototype harness (the attachBaseline precedent);
//  only the render/history side-effects are stubbed, so the observable
//  is the id the engine actually hands out.
// ============================================================

import { describe, expect, it } from 'vitest'
import { EfxPaintEngine } from './EfxPaintEngine'
import type { RecordedStrokeGroup } from './EfxPaintEngine'
import type { PaintStroke } from '../types'

type EngineInternals = EfxPaintEngine & Record<string, unknown>

function recordedGroup(): RecordedStrokeGroup {
  const primary: PaintStroke = {
    tool: 'paint',
    points: [{ x: 4, y: 6, p: 0.5, tx: 0, ty: 0, tw: 0, spd: 0.1 }],
    color: '#112233',
    params: {
      size: 12,
      opacity: 80,
      pressure: 50,
      waterAmount: 40,
      dryAmount: 30,
      edgeDetail: 20,
      pickup: 10,
      eraseStrength: 100,
      antiAlias: 1,
    },
    timestamp: 0,
  }
  return { primary }
}

/** Prototype harness: real id assignment, stubbed render/history effects. */
function engineHarness(): EfxPaintEngine {
  const engine = Object.create(EfxPaintEngine.prototype) as EngineInternals
  Object.assign(engine, {
    nextMutationId: 1,
    requestRender: () => undefined,
    pushAcceptedActions: () => undefined,
    strokeHasPenInput: () => false,
    notifyHistoryAvailability: () => undefined,
    markStrokeHandoffComplete: () => undefined,
    scheduleStrokeFinalization: () => undefined,
    undoStack: [],
    redoStack: [],
    historyEntries: [],
    historyIndex: 0,
    pendingStrokeFinalizations: [],
  })
  return engine as EfxPaintEngine
}

describe('EfxPaintEngine.reserveMutationClock', () => {
  it('makes the next enqueued stroke start at the reserved id', () => {
    const engine = engineHarness()
    engine.reserveMutationClock(42)
    expect(engine.enqueueRecordedStroke(recordedGroup())).toBe(42)
    expect(engine.enqueueRecordedStroke(recordedGroup())).toBe(43)
  })

  it('never moves the clock backwards', () => {
    const engine = engineHarness()
    engine.reserveMutationClock(10)
    const first = engine.enqueueRecordedStroke(recordedGroup())
    engine.reserveMutationClock(5)
    expect(engine.enqueueRecordedStroke(recordedGroup())).toBe(first + 1)
  })

  it('ignores non-positive and non-integer arguments', () => {
    for (const invalid of [0, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const engine = engineHarness()
      engine.reserveMutationClock(invalid)
      expect(engine.enqueueRecordedStroke(recordedGroup())).toBe(1)
    }
  })

  it('is idempotent at the same reservation', () => {
    const engine = engineHarness()
    engine.reserveMutationClock(7)
    engine.reserveMutationClock(7)
    expect(engine.enqueueRecordedStroke(recordedGroup())).toBe(7)
  })
})
