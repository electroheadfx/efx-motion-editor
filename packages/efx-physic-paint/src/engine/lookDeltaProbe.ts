// ============================================================
//  261002 look-delta probe — MEASURE-ONLY. No product change.
//
//  The judged surface is the STUDIO PAINT CANVAS: the browser's
//  source-over of the three stacked DOM canvases
//  (previewBase z1 -> dry z2 -> display z3) — exactly the pixel
//  the eye reads while painting. The Program Monitor's
//  getBakedCanvas (previewBase + dry, NO wet) is out of scope.
//
//  READ-ONLY LAW (2026-10-01 residual-writer lesson): a probe
//  samples backing stores and nothing else. It must NEVER call
//  copyLiveAlphaCanvas / getDisplayCanvas / getBakedCanvas /
//  compositeDisplayNow / renderVisibleWetLayer — all of those
//  recomposite the display and would repaint-inject at precisely
//  the moments being measured. Here a read is one 1x1 getImageData
//  per layer plus three 1x1 drawImage blits into a probe-owned
//  scratch. Sources are only ever read.
//
//  FIVE MOMENTS per stroke, one pinned pixel:
//    m1 end-of-gesture ribbon   (live previewStroke still on display)
//    m2 outline on screen       (queued ribbon replaces the live one)
//    m3 settled land            (outline replaced by the settled look)
//    m4 m3 + 2 s no input       (post-land writer detector)
//    m5 on-return after leaving the key (capture/reload writer detector)
//
//  SIGNATURE LAW (the verdict is read off these, not guessed):
//    m3 != m4                       -> true post-land writer, name it
//    m3 = m4 != m5                  -> capture/reload writer
//    m3 = m4 = m5 but != m2         -> the swap itself (preview vs settled)
//    m1 fuller than m3              -> depositRoom/fluid look delta
//                                     (R1 knobs FROZEN, do not retune)
// ============================================================

export interface LookDeltaRgba {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

/** The judged Studio-paint-canvas pixel plus its three layer contributions. */
export interface LookDeltaPixelRead {
  /** browser source-over(previewBase, dry, display) — what the eye reads. */
  readonly visible: LookDeltaRgba
  /** the same composite recomputed from straight-alpha samples (cross-check). */
  readonly visibleJs: LookDeltaRgba
  readonly previewBase: LookDeltaRgba
  readonly dry: LookDeltaRgba
  readonly display: LookDeltaRgba
}

export type LookDeltaMoment =
  | 'm1-ribbon'
  | 'm2-outline'
  | 'm3-settled'
  | 'm4-settled+2s'
  | 'm5-return'

export const LOOK_DELTA_MOMENTS: readonly LookDeltaMoment[] = [
  'm1-ribbon',
  'm2-outline',
  'm3-settled',
  'm4-settled+2s',
  'm5-return',
]

export interface LookDeltaMomentSample {
  readonly moment: LookDeltaMoment
  readonly atMs: number
  readonly dtFromM1Ms: number
  readonly pixel: LookDeltaPixelRead
  readonly physicsMode: string | null
  readonly localSpreadStrength: number
  /** m4 only — false proves the 2 s window was genuinely input-free. */
  readonly hadInputSinceAnchor?: boolean
  /** m5 only — which preview-base apply produced this look. */
  readonly appliedPreviewBase?: LookDeltaAppliedBase
}

export interface LookDeltaAppliedBase {
  readonly appFrame: number | null
  readonly generation: number | null
  readonly explicit: boolean
}

export interface LookDeltaStrokeMeta {
  readonly appFrame: number | null
  readonly mutationId: number
  readonly strokePointCount: number
  readonly brushRadius: number
  readonly physicsMode: string | null
  readonly localSpreadStrength: number
}

export interface LookDeltaRun {
  readonly runId: number
  readonly pin: { readonly x: number; readonly y: number }
  readonly meta: LookDeltaStrokeMeta
  readonly samples: LookDeltaMomentSample[]
}

export interface LookDeltaReport {
  readonly schema: 'efx-look-delta/1'
  readonly quick: '261002-look-delta'
  readonly writtenAt: string
  readonly signatureLaw: readonly string[]
  readonly runs: readonly LookDeltaRun[]
}

export const LOOK_DELTA_SIGNATURE_LAW: readonly string[] = [
  'm3 != m4 -> true post-land writer, name it',
  'm3 = m4 != m5 -> capture/reload writer',
  'm3 = m4 = m5 but != m2 -> the swap itself (preview vs settled)',
  'm1 fuller than m3 -> depositRoom/fluid look delta; R1 knobs FROZEN',
]

export interface LookDeltaSources {
  readonly previewBaseCanvas: HTMLCanvasElement
  readonly dryCanvas: HTMLCanvasElement
  readonly displayCanvas: HTMLCanvasElement
}

const ZERO: LookDeltaRgba = { r: 0, g: 0, b: 0, a: 0 }

function read1x1(ctx: CanvasRenderingContext2D, x: number, y: number): LookDeltaRgba {
  try {
    const d = ctx.getImageData(x, y, 1, 1).data
    return { r: d[0], g: d[1], b: d[2], a: d[3] }
  } catch {
    return ZERO
  }
}

/**
 * Straight-alpha source-over, the closed form of what the compositor does.
 * Recorded alongside the browser composite as a self-check: if the two ever
 * disagree, the gap is premultiply/rounding and is itself the finding.
 */
export function srcOverStraight(dst: LookDeltaRgba, src: LookDeltaRgba): LookDeltaRgba {
  const as = src.a / 255
  const ad = dst.a / 255
  const ao = as + ad * (1 - as)
  if (ao <= 0) return ZERO
  const w = (1 - as) * ad
  return {
    r: Math.round((src.r * as + dst.r * w) / ao),
    g: Math.round((src.g * as + dst.g * w) / ao),
    b: Math.round((src.b * as + dst.b * w) / ao),
    a: Math.round(ao * 255),
  }
}

/**
 * Read the judged Studio-paint-canvas pixel at (x, y) plus each layer's own
 * contribution. READ-ONLY: the three sources are blitted 1x1 into a scratch
 * this function owns; no engine surface is recomposited.
 */
export function readStudioPixel(
  scratch: HTMLCanvasElement,
  sources: LookDeltaSources,
  x: number,
  y: number,
): LookDeltaPixelRead {
  const sctx = scratch.getContext('2d', { willReadFrequently: true })
  const pctx = sources.previewBaseCanvas.getContext('2d', { willReadFrequently: true })
  const dctx = sources.dryCanvas.getContext('2d', { willReadFrequently: true })
  const lctx = sources.displayCanvas.getContext('2d', { willReadFrequently: true })
  const previewBase = pctx ? read1x1(pctx, x, y) : ZERO
  const dry = dctx ? read1x1(dctx, x, y) : ZERO
  const display = lctx ? read1x1(lctx, x, y) : ZERO
  let visible = ZERO
  if (sctx) {
    sctx.clearRect(0, 0, 1, 1)
    sctx.globalCompositeOperation = 'source-over'
    sctx.globalAlpha = 1
    sctx.imageSmoothingEnabled = false
    try {
      sctx.drawImage(sources.previewBaseCanvas, x, y, 1, 1, 0, 0, 1, 1)
      sctx.drawImage(sources.dryCanvas, x, y, 1, 1, 0, 0, 1, 1)
      sctx.drawImage(sources.displayCanvas, x, y, 1, 1, 0, 0, 1, 1)
      visible = read1x1(sctx, 0, 0)
    } catch {
      visible = ZERO
    }
  }
  return {
    visible,
    visibleJs: srcOverStraight(srcOverStraight(previewBase, dry), display),
    previewBase,
    dry,
    display,
  }
}

export interface LookDeltaProbeInput {
  readPixel: (x: number, y: number) => LookDeltaPixelRead
  readInputClock: () => number
  now: () => number
  onReport: (report: LookDeltaReport) => void
}

export interface LookDeltaProbe {
  beginStroke: (pinX: number, pinY: number, meta: LookDeltaStrokeMeta) => void
  markOutlineLook: () => void
  armSettled: (mutationId: number) => void
  onCompositeLanded: () => void
  /** clearPreviewBaseImage ran — the key was left (or the base wiped). */
  noteBaseCleared: () => void
  markReturnApplied: (info: LookDeltaAppliedBase) => void
  report: () => LookDeltaReport
  dispose: () => void
}

const M4_DELAY_MS = 2000
/** Bounded so an always-on listener cannot grow runs without limit. */
const MAX_RUNS = 8

export function createLookDeltaProbe(input: LookDeltaProbeInput): LookDeltaProbe {
  const runs: LookDeltaRun[] = []
  /** Input clock sampled at m3 — m4's "no input" window opens there, not at m1. */
  const settledInputClock = new Map<number, number>()
  const armedSettled = new Set<number>()
  const timers = new Set<ReturnType<typeof setTimeout>>()
  /** Set by clearPreviewBaseImage; consumed by the run that fills m5. */
  let baseClearedSinceSettle = false
  let runSeq = 0

  const build = (): LookDeltaReport => ({
    schema: 'efx-look-delta/1',
    quick: '261002-look-delta',
    writtenAt: new Date().toISOString(),
    signatureLaw: LOOK_DELTA_SIGNATURE_LAW,
    runs: runs.map((run) => ({
      runId: run.runId,
      pin: { ...run.pin },
      meta: { ...run.meta },
      samples: run.samples.map((sample) => ({ ...sample, pixel: { ...sample.pixel } })),
    })),
  })

  // FLUSH-ONLY LAW: onReport is the "write me" signal, not a per-sample
  // stream. Emitting on every capture made the app serialize the whole
  // report and ship a ~30k-element array over Tauri IPC four times per
  // stroke — main-thread work landing inside the 400 ms idle gate and the
  // fluid ticks, i.e. inside the very race being measured. Samples stay in
  // memory; a flush happens on m5 and on dispose.
  let dirty = false
  let disposed = false

  const emit = () => {
    dirty = false
    input.onReport(build())
  }

  const capture = (run: LookDeltaRun, moment: LookDeltaMoment, extra?: Partial<LookDeltaMomentSample>) => {
    if (disposed) return
    if (run.samples.some((sample) => sample.moment === moment)) return
    const atMs = input.now()
    const anchor = run.samples.find((sample) => sample.moment === 'm1-ribbon')?.atMs ?? atMs
    run.samples.push({
      moment,
      atMs,
      dtFromM1Ms: Math.round((atMs - anchor) * 100) / 100,
      pixel: input.readPixel(run.pin.x, run.pin.y),
      physicsMode: run.meta.physicsMode,
      localSpreadStrength: run.meta.localSpreadStrength,
      ...(extra ?? {}),
    })
    dirty = true
  }

  return {
    beginStroke(pinX, pinY, meta) {
      if (disposed) return
      runSeq += 1
      const run: LookDeltaRun = {
        runId: runSeq,
        pin: { x: Math.round(pinX), y: Math.round(pinY) },
        meta: { ...meta },
        samples: [],
      }
      runs.push(run)
      while (runs.length > MAX_RUNS) runs.shift()
      capture(run, 'm1-ribbon')
    },

    /** Every queued outline is on screen in the same frame — one look for all pins. */
    markOutlineLook() {
      if (disposed) return
      for (const run of runs) {
        if (
          run.samples.some((s) => s.moment === 'm1-ribbon')
          && !run.samples.some((s) => s.moment === 'm2-outline')
          && !run.samples.some((s) => s.moment === 'm3-settled')
        ) {
          capture(run, 'm2-outline')
        }
      }
    },

    /**
     * The 30 ms composite throttle merges strokes completed in one turn into a
     * single canvas update — several arms resolve against one landed composite.
     */
    armSettled(mutationId) {
      if (disposed) return
      armedSettled.add(mutationId)
    },

    onCompositeLanded() {
      if (disposed) return
      if (armedSettled.size === 0) return
      const settledIds = [...armedSettled]
      armedSettled.clear()
      for (const run of runs) {
        if (!settledIds.includes(run.meta.mutationId)) continue
        capture(run, 'm3-settled')
        const runId = run.runId
        settledInputClock.set(runId, input.readInputClock())
        const handle = setTimeout(() => {
          timers.delete(handle)
          const target = runs.find((candidate) => candidate.runId === runId)
          if (!target) return
          capture(target, 'm4-settled+2s', {
            hadInputSinceAnchor: input.readInputClock() !== settledInputClock.get(runId),
          })
        }, M4_DELAY_MS)
        timers.add(handle)
      }
    },

    noteBaseCleared() {
      if (disposed) return
      baseClearedSinceSettle = true
    },

    /**
     * m5 is the painted key's OWN cache coming back after a leave. Two gates:
     * a base clear must have happened (the key was left — excludes a same-frame
     * completion-guard repair) and the applied appFrame must be the run's own
     * (leaving to a neighbour key must not fill it).
     *
     * appFrame matching is equality, null included. The first version bailed
     * out on `info.appFrame === null`, which made m5 unsatisfiable in any
     * session without playFrame — exactly the sessions where the cache
     * symptom was reported. Both-null is a match; only a real neighbour-key
     * frame (a different number) refuses.
     */
    markReturnApplied(info) {
      if (disposed) return
      if (!baseClearedSinceSettle) return
      let filled = 0
      for (const run of runs) {
        if (info.appFrame !== run.meta.appFrame) continue
        if (run.samples.some((s) => s.moment === 'm3-settled') && !run.samples.some((s) => s.moment === 'm5-return')) {
          capture(run, 'm5-return', { appliedPreviewBase: { ...info } })
          filled += 1
        }
      }
      if (filled > 0) {
        baseClearedSinceSettle = false
        emit()
      }
    },

    report: build,

    dispose() {
      for (const handle of timers) clearTimeout(handle)
      timers.clear()
      // Final flush only if something landed since the last emit: m1..m4 are
      // in memory even if the session never returned to the key, but if m5
      // already flushed, a second write here would just be duplicate IPC.
      if (dirty) emit()
      disposed = true
    },
  }
}
