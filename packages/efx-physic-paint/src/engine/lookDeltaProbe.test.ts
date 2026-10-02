// 261002 look-delta probe — pins the sampler math and the five-moment
// sequencing. The signature law that names the writer is only as good as
// these, so they are real-value pins rather than mock assertions.

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createLookDeltaProbe,
  srcOverStraight,
  LOOK_DELTA_MOMENTS,
  type LookDeltaMomentSample,
  type LookDeltaPixelRead,
  type LookDeltaReport,
  type LookDeltaRgba,
} from './lookDeltaProbe'

const BLACK_OPAQUE: LookDeltaRgba = { r: 0, g: 0, b: 0, a: 255 }
const WHITE_OPAQUE: LookDeltaRgba = { r: 255, g: 255, b: 255, a: 255 }
const CLEAR: LookDeltaRgba = { r: 0, g: 0, b: 0, a: 0 }

function fakePixel(rgba: LookDeltaRgba): LookDeltaPixelRead {
  return {
    visible: rgba,
    visibleJs: rgba,
    previewBase: CLEAR,
    dry: CLEAR,
    display: rgba,
  }
}

describe('srcOverStraight', () => {
  it('keeps an opaque source over anything', () => {
    expect(srcOverStraight(BLACK_OPAQUE, WHITE_OPAQUE)).toEqual(WHITE_OPAQUE)
  })

  it('keeps a clear source invisible', () => {
    expect(srcOverStraight(WHITE_OPAQUE, CLEAR)).toEqual(WHITE_OPAQUE)
  })

  it('drops a clear destination under an opaque source', () => {
    expect(srcOverStraight(CLEAR, BLACK_OPAQUE)).toEqual(BLACK_OPAQUE)
  })

  it('blends 50% black over white to mid grey at full alpha', () => {
    const out = srcOverStraight(WHITE_OPAQUE, { r: 0, g: 0, b: 0, a: 128 })
    expect(out.a).toBe(255)
    // as=128/255 -> (0*as + 255*(1-as))/1 = 255*(1-128/255) ~= 127
    expect(out.r).toBeGreaterThanOrEqual(126)
    expect(out.r).toBeLessThanOrEqual(128)
    expect(out.g).toBe(out.r)
    expect(out.b).toBe(out.r)
  })

  it('averages two half-alpha greys toward the lighter side', () => {
    const out = srcOverStraight({ r: 0, g: 0, b: 0, a: 128 }, { r: 255, g: 255, b: 255, a: 128 })
    expect(out.a).toBeGreaterThan(128)
    expect(out.a).toBeLessThanOrEqual(255)
  })
})

describe('createLookDeltaProbe sequencing', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  function harness() {
    let clock = 0
    let inputClock = 0
    const readPixel = vi.fn((_x: number, _y: number) => fakePixel({ r: 10, g: 20, b: 30, a: 40 }))
    const reports: LookDeltaReport[] = []
    const probe = createLookDeltaProbe({
      readPixel,
      readInputClock: () => inputClock,
      now: () => clock,
      onReport: (report) => { reports.push(report) },
    })
    return {
      probe,
      reports,
      readPixel,
      tick: (ms: number) => { clock += ms },
      nudgeInput: () => { inputClock += 1 },
    }
  }

  const META = {
    appFrame: 7,
    mutationId: 42,
    strokePointCount: 5,
    brushRadius: 12,
    physicsMode: 'local',
    localSpreadStrength: 65,
  }

  it('records m1 at the pinned pixel without flushing', () => {
    const h = harness()
    h.probe.beginStroke(12.6, 8.4, META)
    expect(h.readPixel).toHaveBeenCalledWith(13, 8)
    // write-once law: capturing a sample is not a reason to serialize + IPC.
    expect(h.reports).toHaveLength(0)
    const run = h.probe.report().runs[0]
    expect(run.pin).toEqual({ x: 13, y: 8 })
    expect(run.samples.map((s) => s.moment)).toEqual(['m1-ribbon'])
    expect(run.samples[0].physicsMode).toBe('local')
    expect(run.samples[0].localSpreadStrength).toBe(65)
    expect(h.probe.report().signatureLaw).toHaveLength(4)
  })

  it('fills m2 then m3 then m4 in order across the drain', () => {
    vi.useFakeTimers()
    const h = harness()
    h.probe.beginStroke(10, 10, META)
    h.tick(16)
    h.probe.markOutlineLook()
    h.tick(400)
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    h.tick(2000)
    vi.advanceTimersByTime(2000)

    const samples = h.probe.report().runs[0].samples as LookDeltaMomentSample[]
    expect(samples.map((s) => s.moment)).toEqual(LOOK_DELTA_MOMENTS.slice(0, 4))
    expect(samples[0].dtFromM1Ms).toBe(0)
    expect(samples[2].dtFromM1Ms).toBe(416)
    const m4 = samples[3]
    expect(m4.dtFromM1Ms).toBe(2416)
    expect(m4.hadInputSinceAnchor).toBe(false)
  })

  it('flags m4 when input landed inside the 2 s window', () => {
    vi.useFakeTimers()
    const h = harness()
    h.probe.beginStroke(10, 10, META)
    h.probe.markOutlineLook()
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    h.nudgeInput()
    vi.advanceTimersByTime(2000)

    const samples = h.probe.report().runs[0].samples as LookDeltaMomentSample[]
    expect(samples.at(-1)!.moment).toBe('m4-settled+2s')
    expect(samples.at(-1)!.hadInputSinceAnchor).toBe(true)
  })

  it('ignores a composite with nothing armed', () => {
    const h = harness()
    h.probe.beginStroke(10, 10, META)
    h.probe.onCompositeLanded()
    expect(h.probe.report().runs[0].samples.map((s) => s.moment)).toEqual(['m1-ribbon'])
  })

  it('never fills m2 after the settled look has landed', () => {
    const h = harness()
    h.probe.beginStroke(10, 10, META)
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    h.probe.markOutlineLook()
    expect(h.probe.report().runs[0].samples.map((s) => s.moment)).toEqual(['m1-ribbon', 'm3-settled'])
  })

  it('needs a base clear before m5 can land', () => {
    const h = harness()
    h.probe.beginStroke(10, 10, META)
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    h.probe.markReturnApplied({ appFrame: 7, generation: 3, explicit: true })
    expect(h.probe.report().runs[0].samples.map((s) => s.moment)).toEqual(['m1-ribbon', 'm3-settled'])
    expect(h.reports).toHaveLength(0)

    h.probe.noteBaseCleared()
    h.probe.markReturnApplied({ appFrame: 7, generation: 3, explicit: true })
    const samples = h.probe.report().runs[0].samples as LookDeltaMomentSample[]
    expect(samples.map((s) => s.moment)).toEqual(['m1-ribbon', 'm3-settled', 'm5-return'])
    expect(samples.at(-1)!.appliedPreviewBase).toEqual({ appFrame: 7, generation: 3, explicit: true })
  })

  it('matches on a null appFrame on both sides (sessions without playFrame)', () => {
    // The original gate bailed on `info.appFrame === null`, which made m5
    // unsatisfiable in exactly the sessions where the cache symptom was
    // reported. Both-null is a match; only a real neighbour-key frame refuses.
    const h = harness()
    h.probe.beginStroke(10, 10, { ...META, appFrame: null })
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    h.probe.noteBaseCleared()
    h.probe.markReturnApplied({ appFrame: null, generation: null, explicit: false })
    const samples = h.probe.report().runs[0].samples as LookDeltaMomentSample[]
    expect(samples.map((s) => s.moment)).toContain('m5-return')
    expect(samples.at(-1)!.appliedPreviewBase).toEqual({ appFrame: null, generation: null, explicit: false })
  })

  it('refuses an m5 for a different appFrame (leaving to a neighbour key)', () => {
    const h = harness()
    h.probe.beginStroke(10, 10, META)
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    h.probe.noteBaseCleared()
    h.probe.markReturnApplied({ appFrame: 99, generation: 3, explicit: false })
    expect(h.probe.report().runs[0].samples.map((s) => s.moment)).toEqual(['m1-ribbon', 'm3-settled'])

    h.probe.markReturnApplied({ appFrame: 7, generation: 4, explicit: false })
    expect(h.probe.report().runs[0].samples.map((s) => s.moment)).toContain('m5-return')
  })

  it('arms each mutationId independently and lands them on one composite', () => {
    const h = harness()
    h.probe.beginStroke(10, 10, { ...META, mutationId: 1 })
    h.probe.beginStroke(50, 50, { ...META, mutationId: 2, appFrame: 8 })
    h.probe.armSettled(1)
    h.probe.armSettled(2)
    h.probe.onCompositeLanded()
    const report = h.probe.report()
    expect(report.runs).toHaveLength(2)
    expect(report.runs[0].samples.map((s) => s.moment)).toContain('m3-settled')
    expect(report.runs[1].samples.map((s) => s.moment)).toContain('m3-settled')
  })

  it('bounds the retained runs', () => {
    const h = harness()
    for (let i = 0; i < 12; i++) h.probe.beginStroke(i, i, { ...META, mutationId: i })
    expect(h.probe.report().runs.length).toBeLessThanOrEqual(8)
  })

  it('flushes once when m5 lands and not again on dispose', () => {
    vi.useFakeTimers()
    const h = harness()
    h.probe.beginStroke(10, 10, { ...META, appFrame: null })
    h.tick(16)
    h.probe.markOutlineLook()
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    vi.advanceTimersByTime(2000)
    h.probe.noteBaseCleared()
    h.probe.markReturnApplied({ appFrame: null, generation: 1, explicit: true })

    // The whole five-moment run is one write.
    expect(h.reports).toHaveLength(1)
    expect(h.reports[0].runs[0].samples.map((s) => s.moment)).toEqual(LOOK_DELTA_MOMENTS)

    h.probe.dispose()
    expect(h.reports).toHaveLength(1)
  })

  it('flushes on dispose when the session never returned to the key', () => {
    const h = harness()
    h.probe.beginStroke(10, 10, META)
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    expect(h.reports).toHaveLength(0)

    h.probe.dispose()
    expect(h.reports).toHaveLength(1)
    expect(h.reports[0].runs[0].samples.map((s) => s.moment)).toEqual(['m1-ribbon', 'm3-settled'])
  })

  it('is a no-op after dispose', () => {
    vi.useFakeTimers()
    const h = harness()
    h.probe.beginStroke(10, 10, META)
    h.probe.armSettled(META.mutationId)
    h.probe.onCompositeLanded()
    h.probe.dispose()
    // dispose flushed the m1+m3 that were in flight; nothing more may land.
    const after = h.reports.length
    vi.advanceTimersByTime(5000)
    h.probe.markOutlineLook()
    h.probe.onCompositeLanded()
    h.probe.markReturnApplied({ appFrame: 7, generation: 9, explicit: true })
    expect(h.reports.length).toBe(after)
    expect(h.reports.at(-1)!.runs[0].samples.map((s) => s.moment)).toEqual(['m1-ribbon', 'm3-settled'])
  })
})
