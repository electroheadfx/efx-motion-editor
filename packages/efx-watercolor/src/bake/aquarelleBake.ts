// ============================================================
//  aquarelleBake — the createBakeHost consumer (56-08, D-21).
//
//  Never re-ports the queue (55 D-21): every turn is submitted
//  to createBakeHost in mode 'flush-survives-navigation' so a
//  long fluid cuisson survives leaving the frame (AQUA-07).
//
//  Pattern properties preserved from finalizationQueue /
//  bakeHost:
//    - BOUNDED TURNS: BAKE_TURN_CONCURRENCY = 2 slot pool
//    - GENERATION-STALE commit guard: a cancelled turn never
//      commits (publish is the commit body)
//    - beginFlush() forced-flush escape for nav/close/save/export
//    - NEVER-REJECTING produce/commit: a bad bake is `failed`
//      data, not a dead fiber
//
//  Bake-window law (D-19 / AQUA-05): the window is per-stroke
//  `diffusionFrames` clamped to DIFFUSION_CAP = 600 — never
//  inferred from wall clock. stepTick never force-dries (P4).
//  Dry events (D-15) fire in recorded order between stroke
//  turns on the same adapter chain. One captured WebP frame per
//  stroke (zero-diffusionFrames → single frame). Unpainted
//  pixels stay alpha 0 (AQUA-08) — the adapter never clears.
// ============================================================

import {
  BAKE_TURN_CONCURRENCY,
  createBakeHost,
  type BakeTurnOutcome,
  type EngineAdapter,
  type StudioStroke,
} from '@efxlab/efx-paint-host'
import {
  buildProgressiveStrokeSchedule,
  getProgressiveFrameStrokes,
} from '@efxlab/efx-paint-host/animation'
import {
  DIFFUSION_CAP,
  type AquarelleStrokePayload,
} from '../payload/toStudioStroke'
import { isAquarelleDryEvent, type AquarelleDryEvent, type AquarellePayloadEvent } from '../payload/dryEvent'

/** One committed WebP frame from a bake turn. */
export interface AquarelleBakeFrame {
  /** Index of the source event in the baked script timeline. */
  readonly eventIndex: number
  /** Index among stroke turns only (Dry events do not increment). */
  readonly strokeIndex: number
  /** Cuisson tick at capture (0 = post-deposit, before any stepTick). */
  readonly tick: number
  /** WebP bytes — the cache publication unit (AQUA-08: alpha 0 unpainted). */
  readonly bytes: Uint8Array
  readonly width: number
  readonly height: number
}

export type AquarelleBakeEncoder = (
  frame: CanvasImageSource,
  width: number,
  height: number,
) => Promise<Uint8Array> | Uint8Array

/**
 * 261017-fz3: the Studio paper a bake must deposit with. `paperId` is the
 * Studio id (fingerprint term); `grainStrength` feeds the engine's
 * `paperTexture` setter; `grainScale` is the display-fond scale (fingerprint
 * term only — deposit grain does not take it).
 */
export interface AquarelleBakePaper {
  readonly paperId: string
  readonly grainStrength: number
  readonly grainScale: number
}

/**
 * 261017-fz3: cache-key term for the aquarelle WebP frames. A paper change
 * (id, strength, OR scale) must differ so stale frames are a miss.
 */
export function aquarellePaperCacheFingerprint(paper: AquarelleBakePaper): string {
  return `paper:${paper.paperId}|str:${paper.grainStrength}|scl:${paper.grainScale}`
}

export interface AquarelleBakeOptions {
  /** WebP encoder. Defaults to canvas.toDataURL when available. */
  encodeWebp?: AquarelleBakeEncoder
  concurrency?: number
  width?: number
  height?: number
  /** Called only for committed turns — a cancelled turn never reaches this. */
  onCommit?: (frame: AquarelleBakeFrame) => void
  /** 261017-fz3: Studio paper — setPaper before replay + cache fingerprint. */
  paper?: AquarelleBakePaper
  /**
   * 261018 progressive Play: when set, bake() emits exactly `frameCount`
   * frames with stroke length growing across the span (the same
   * buildProgressiveStrokeSchedule law engine-1 Play uses) instead of one
   * cumulative frame per stroke. Dry events fire at the next stroke's
   * startFrame; diffusion stepTicks run every frame so the wash develops.
   */
  frameCount?: number
}

export type AquarelleBakeResult =
  | { readonly ok: true; readonly frames: readonly AquarelleBakeFrame[] }
  | { readonly ok: false; readonly reason: 'cancelled' | 'failed' }

export interface AquarelleBake {
  bake(events: readonly AquarellePayloadEvent[]): Promise<AquarelleBakeResult>
  /** Resolves after in-flight turns settle; overlapping calls share one drain. */
  flush(): Promise<void>
  /** Forced-flush escape (nav/close/save/export); returns a once-only release. */
  beginFlush(): () => void
  /** Does NOT abort flush-survives-navigation turns (D-21 / AQUA-07). */
  dispose(): void
  /** Cancels every live turn — a cancelled turn never commits. */
  interrupt(): void
  readonly inFlight: number
}

/** Engine cap policy (D-19) — clamp before stepTick, never trust the bag. */
function clampCuisson(raw: number | undefined): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(DIFFUSION_CAP, Math.trunc(raw))
}

/** Host tick grid (DATA-03) — the recorded timeline's unit. */
const HOST_TICK_MS = 1000 / 60

/**
 * Safety bound for the final cook-to-sleep: 60 s of sim time. The engine's
 * awake gate normally sleeps well before this; the bound only keeps a
 * pathological wet state from stalling the bake.
 */
const SETTLE_MAX_TICKS = 3600

function readSize(frame: CanvasImageSource): { width: number; height: number } {
  const carrier = frame as { width?: number; height?: number }
  return { width: carrier.width ?? 0, height: carrier.height ?? 0 }
}

/** DOM fallback encoder — the app injects the Rust-backed one (R4.2). */
async function defaultEncodeWebp(frame: CanvasImageSource): Promise<Uint8Array> {
  const carrier = frame as { toDataURL?: (type?: string) => string }
  if (typeof carrier.toDataURL !== 'function') {
    throw new Error('createAquarelleBake: no WebP encoder available — pass options.encodeWebp')
  }
  const dataUrl = carrier.toDataURL('image/webp')
  const comma = dataUrl.indexOf(',')
  const binary = atob(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function createAquarelleBake(
  adapter: EngineAdapter<AquarelleStrokePayload>,
  options: AquarelleBakeOptions = {},
): AquarelleBake {
  // D-21: consume createBakeHost — never re-port the finalizationQueue.
  const host = createBakeHost({
    concurrency: Math.max(1, Math.floor(options.concurrency ?? BAKE_TURN_CONCURRENCY)),
  })
  const encodeWebp = options.encodeWebp ?? ((frame) => defaultEncodeWebp(frame))
  const onCommit = options.onCommit

  // Adapter mutations are serialized: applyStroke / stepTick / captureFrame
  // never interleave mid-capture ("a third turn waits, never interleaves
  // mid-capture"). Encoding stays free to overlap inside the 2-slot pool.
  let adapterChain: Promise<unknown> = Promise.resolve()
  const scheduleAdapter = <T>(work: () => T | Promise<T>): Promise<T> => {
    const run = adapterChain.then(work)
    adapterChain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  let sharedFlush: Promise<void> | null = null

  /**
   * 261019 recorded-timeline replay: every stroke records its wall-clock END
   * (`recordedOrder`) and its own duration (`ticks`), so the bake can rebuild
   * the artist's REAL session cadence — including the idle gaps between
   * strokes. The old point-weight schedule compressed those gaps, so later
   * strokes landed on a still-soaked sheet and the Play bloomed wider and
   * denser than the paint. Returns null when the timing fields are unusable;
   * the shared schedule is then the fallback.
   */
  const buildRecordedTimeline = (
    strokes: readonly StudioStroke<AquarelleStrokePayload>[],
  ): { readonly stroke: StudioStroke<AquarelleStrokePayload>; readonly beginTick: number; readonly endTick: number }[] | null => {
    if (strokes.length === 0) return null
    const entries: { stroke: StudioStroke<AquarelleStrokePayload>; beginTick: number; endTick: number }[] = []
    let originMs: number | null = null
    let previousEnd = 0
    for (const stroke of strokes) {
      const endMs = stroke.recordedOrder
      if (typeof endMs !== 'number' || !Number.isFinite(endMs) || endMs <= 0) return null
      const durationTicks = Math.max(1, Math.trunc(stroke.ticks))
      if (originMs === null) originMs = endMs - durationTicks * HOST_TICK_MS
      const rawBegin = Math.round((endMs - durationTicks * HOST_TICK_MS - originMs) / HOST_TICK_MS)
      if (!Number.isFinite(rawBegin)) return null
      // Live strokes never overlap; a clock hiccup collapses the gap, never
      // reorders the paint.
      const beginTick = Math.max(previousEnd, Math.max(0, rawBegin))
      entries.push({ stroke, beginTick, endTick: beginTick + durationTicks })
      previousEnd = beginTick + durationTicks
    }
    return entries
  }

  /**
   * 261018 progressive Play: one captured frame per OUTPUT frame, with stroke
   * length growing across the span. When the recorded timing is available the
   * span maps onto the artist's real session clock (start at frame 0, real
   * gaps between strokes); otherwise the shared point-weight schedule runs.
   * Dry events fire at the next stroke's first frame (D-15: between stroke
   * turns). The FINAL frame cooks until the engine sleeps — the same settled
   * state the live cache captures — so the end key matches the paint even
   * when the script was saved before its measured settle landed.
   */
  const bakeProgressive = async (
    events: readonly AquarellePayloadEvent[],
    frameCount: number,
  ): Promise<AquarelleBakeResult> => {
    const frames: AquarelleBakeFrame[] = []
    const outcomes: Promise<BakeTurnOutcome>[] = []
    let commitBarrier: Promise<void> = Promise.resolve()
    const frameSpan = Math.max(1, Math.trunc(frameCount))
    const awakeProbe = adapter as EngineAdapter<AquarelleStrokePayload> & { isAwake?: () => boolean }

    if (options.paper) {
      const paper = options.paper
      void scheduleAdapter(() => {
        const seam = adapter as EngineAdapter<AquarelleStrokePayload> & {
          setPaper?: (p: AquarelleBakePaper) => void
        }
        seam.setPaper?.(paper)
      })
    }

    const strokes: StudioStroke<AquarelleStrokePayload>[] = []
    for (const event of events) {
      if (!isAquarelleDryEvent(event)) strokes.push(event as StudioStroke<AquarelleStrokePayload>)
    }
    const timed = buildRecordedTimeline(strokes)
    const schedule = timed ? [] : buildProgressiveStrokeSchedule(strokes, frameSpan)

    // Each Dry fires before the next stroke's first frame (recorded order).
    const startFrameOf = new Map<StudioStroke<AquarelleStrokePayload>, number>()
    let timelineEnd = 0
    if (timed) {
      const lastEntry = timed[timed.length - 1]!
      const settleEstimate = clampCuisson(
        lastEntry.stroke.cuisson || (lastEntry.stroke.engine as { diffusionFrames?: number } | undefined)?.diffusionFrames,
      )
      timelineEnd = Math.max(1, lastEntry.endTick + settleEstimate)
      const frameForTick = (tick: number) => Math.max(0, Math.min(
        frameSpan - 1,
        Math.ceil((tick * frameSpan) / timelineEnd) - 1,
      ))
      for (const entry of timed) startFrameOf.set(entry.stroke, frameForTick(entry.beginTick))
    } else {
      for (const entry of schedule) startFrameOf.set(entry.stroke, entry.startFrame)
    }
    const drysByFrame = new Map<number, AquarelleDryEvent[]>()
    let pendingDrys: AquarelleDryEvent[] = []
    for (const event of events) {
      if (isAquarelleDryEvent(event)) {
        pendingDrys.push(event)
        continue
      }
      const frame = startFrameOf.get(event as StudioStroke<AquarelleStrokePayload>)
      if (frame !== undefined && pendingDrys.length > 0) {
        const list = drysByFrame.get(frame) ?? []
        list.push(...pendingDrys)
        drysByFrame.set(frame, list)
        pendingDrys = []
      }
    }
    if (pendingDrys.length > 0) {
      const frame = Math.max(0, frameSpan - 1)
      const list = drysByFrame.get(frame) ?? []
      list.push(...pendingDrys)
      drysByFrame.set(frame, list)
    }

    // Fallback schedule budget: diffusion spread across the span so the wash
    // develops in view (only used when the recorded timing is unavailable).
    let totalCuisson = 0
    for (const stroke of strokes) {
      totalCuisson += clampCuisson(
        stroke.cuisson || (stroke.engine as { diffusionFrames?: number } | undefined)?.diffusionFrames,
      )
    }
    const diffusionPerFrame = Math.max(1, Math.ceil(totalCuisson / frameSpan))
    const lastStroke = strokes[strokes.length - 1]
    const lastStrokeCuisson = lastStroke
      ? clampCuisson(
          lastStroke.cuisson || (lastStroke.engine as { diffusionFrames?: number } | undefined)?.diffusionFrames,
        )
      : 0
    const lastStrokeStart = lastStroke ? startFrameOf.get(lastStroke) ?? 0 : 0
    const lastStrokeCatchUp = Math.max(
      0,
      lastStrokeCuisson - diffusionPerFrame * (frameSpan - lastStrokeStart),
    )

    let previousWindowEnd = 0
    const fedCounts = new Map<StudioStroke<AquarelleStrokePayload>, number>()

    for (let frameIndex = 0; frameIndex < frameSpan; frameIndex += 1) {
      for (const dry of drysByFrame.get(frameIndex) ?? []) {
        void scheduleAdapter(() => {
          adapter.applyStroke(dry as unknown as StudioStroke<AquarelleStrokePayload>)
        })
      }

      let frameStrokes: { stroke: StudioStroke<AquarelleStrokePayload>; pointCount: number }[]
      let tickBudget: number
      if (timed) {
        const windowEnd = frameIndex === frameSpan - 1
          ? timelineEnd
          : Math.max(previousWindowEnd, Math.round(((frameIndex + 1) * timelineEnd) / frameSpan))
        frameStrokes = []
        let newSamples = 0
        for (const entry of timed) {
          if (entry.beginTick > windowEnd) break
          const pointCount = Math.min(entry.stroke.pts.length, windowEnd - entry.beginTick + 1)
          if (pointCount <= 0) continue
          const fed = fedCounts.get(entry.stroke) ?? 0
          if (pointCount > fed) newSamples += pointCount - fed
          frameStrokes.push({ stroke: entry.stroke, pointCount })
        }
        // The adapter ticks once per fed sample; the rest of the window is
        // pure fluid time (the idle gaps the live sheet actually lived).
        tickBudget = Math.max(0, windowEnd - previousWindowEnd - newSamples)
        for (const entry of frameStrokes) fedCounts.set(entry.stroke, entry.pointCount)
        previousWindowEnd = windowEnd
      } else {
        frameStrokes = getProgressiveFrameStrokes(schedule, frameIndex)
        tickBudget = frameIndex === frameSpan - 1
          ? diffusionPerFrame + lastStrokeCatchUp
          : diffusionPerFrame
      }

      const framePromise = scheduleAdapter(() => {
        adapter.renderPartialStrokes(frameStrokes)
        for (let tick = 0; tick < tickBudget; tick += 1) {
          adapter.stepTick(tick)
        }
        // End-frame law: cook the last frame until the sheet sleeps — the
        // engine's own definition of the settled look the live cache captures.
        if (frameIndex === frameSpan - 1 && typeof awakeProbe.isAwake === 'function') {
          for (let guard = 0; guard < SETTLE_MAX_TICKS && awakeProbe.isAwake(); guard += 1) {
            adapter.stepTick(guard)
          }
        }
        return adapter.captureFrame()
      })

      const myBarrier = commitBarrier
      let releaseBarrier!: () => void
      commitBarrier = new Promise<void>((resolve) => {
        releaseBarrier = resolve
      })

      const outcome = host.submit<AquarelleBakeFrame>({
        mode: 'flush-survives-navigation',
        produce: async () => {
          const frame = await framePromise
          const fallback = readSize(frame)
          const width = options.width ?? fallback.width
          const height = options.height ?? fallback.height
          const bytes = await encodeWebp(frame, width, height)
          return {
            eventIndex: frameIndex,
            strokeIndex: frameIndex,
            tick: tickBudget,
            bytes,
            width,
            height,
          }
        },
        commit: (value) =>
          myBarrier.then(() => {
            frames.push(value)
            onCommit?.(value)
            return true
          }),
      })
      void outcome.then(
        () => releaseBarrier(),
        () => releaseBarrier(),
      )
      outcomes.push(outcome)
    }

    const settled = await Promise.all(outcomes)
    await adapterChain

    if (settled.some((o) => o === 'cancelled' || o === 'stale')) {
      return { ok: false, reason: 'cancelled' }
    }
    if (settled.some((o) => o === 'failed' || o === 'rejected')) {
      return { ok: false, reason: 'failed' }
    }
    return { ok: true, frames }
  }

  const flush = (): Promise<void> => {
    // Overlapping flush() calls share one drain outcome (AQUA-05 / 52.2-15).
    if (sharedFlush) return sharedFlush
    sharedFlush = (async () => {
      const release = host.beginFlush()
      try {
        await host.drain()
      } finally {
        release()
      }
    })().finally(() => {
      sharedFlush = null
    })
    return sharedFlush
  }

  const bake = async (events: readonly AquarellePayloadEvent[]): Promise<AquarelleBakeResult> => {
    if (options.frameCount && options.frameCount > 0) {
      return bakeProgressive(events, Math.floor(options.frameCount))
    }
    const frames: AquarelleBakeFrame[] = []
    const outcomes: Promise<BakeTurnOutcome>[] = []
    // FIFO commit barrier: a later stroke never commits before an earlier one,
    // even when its encode finishes first. Released when each turn settles
    // (committed OR cancelled) so a cancelled head never wedges the tail.
    let commitBarrier: Promise<void> = Promise.resolve()
    let strokeIndex = 0

    // 261017-fz3: paper feeds the engine BEFORE the first applyStroke so the
    // replayed deposit carries the Studio paper's tooth / granulation. The
    // adapter's optional setPaper seam keeps EngineAdapter unchanged.
    if (options.paper) {
      const paper = options.paper
      void scheduleAdapter(() => {
        const seam = adapter as EngineAdapter<AquarelleStrokePayload> & {
          setPaper?: (p: AquarelleBakePaper) => void
        }
        seam.setPaper?.(paper)
      })
    }

    for (let eventIndex = 0; eventIndex < events.length; eventIndex += 1) {
      const event = events[eventIndex]
      if (!event) continue

      if (isAquarelleDryEvent(event)) {
        // D-15: Dry fires in recorded order BETWEEN stroke turns — same
        // adapter chain, so it lands after earlier produce and before later.
        // applyStroke is the adapter's one Dry seam (D-16 one-payload-union).
        void scheduleAdapter(() => {
          adapter.applyStroke(event as unknown as StudioStroke<AquarelleStrokePayload>)
        })
        continue
      }

      const stroke = event as StudioStroke<AquarelleStrokePayload>
      const myStrokeIndex = strokeIndex
      strokeIndex += 1
      // `||` not `??`: a stroke projected with cuisson 0 still falls back to
      // the engine slot's diffusionFrames, so the fluid sim runs its window.
      const cuisson = clampCuisson(
        stroke.cuisson || (stroke.engine as { diffusionFrames?: number } | undefined)?.diffusionFrames,
      )

      // Reserve the adapter slot NOW so chain order is walk order, not
      // produce-start order (the host defers produce behind the slot take).
      const framePromise = scheduleAdapter(() => {
        adapter.applyStroke(stroke)
        // Bake-window law: stepTick across the stroke's own cuisson only.
        // Frame indices never force-dry (P4 / D-28).
        for (let tick = 0; tick < cuisson; tick += 1) {
          adapter.stepTick(tick)
        }
        return adapter.captureFrame()
      })

      const myBarrier = commitBarrier
      let releaseBarrier!: () => void
      commitBarrier = new Promise<void>((resolve) => {
        releaseBarrier = resolve
      })

      const outcome = host.submit<AquarelleBakeFrame>({
        // AQUA-07 / D-21: long cuisson survives navigation and dispose().
        mode: 'flush-survives-navigation',
        produce: async () => {
          const frame = await framePromise
          const fallback = readSize(frame)
          const width = options.width ?? fallback.width
          const height = options.height ?? fallback.height
          const bytes = await encodeWebp(frame, width, height)
          return {
            eventIndex,
            strokeIndex: myStrokeIndex,
            tick: cuisson,
            bytes,
            width,
            height,
          }
        },
        // Publish IS the commit body — the host's generation-stale guard is
        // what keeps a cancelled/interrupted turn from reaching here (T-56-24).
        commit: (value) =>
          myBarrier.then(() => {
            frames.push(value)
            onCommit?.(value)
            return true
          }),
      })
      // Always advance the FIFO barrier once the turn settles, committed or not.
      void outcome.then(
        () => releaseBarrier(),
        () => releaseBarrier(),
      )
      outcomes.push(outcome)
    }

    const settled = await Promise.all(outcomes)
    // Dry events after the last stroke are not awaited by any turn.
    await adapterChain

    if (settled.some((o) => o === 'cancelled' || o === 'stale')) {
      return { ok: false, reason: 'cancelled' }
    }
    if (settled.some((o) => o === 'failed' || o === 'rejected')) {
      return { ok: false, reason: 'failed' }
    }
    return { ok: true, frames }
  }

  return {
    bake,
    flush,
    beginFlush: () => host.beginFlush(),
    // D-21: dispose() keeps flush-survives-navigation turns running. The
    // navigation escape is beginFlush()/flush(), never an abort.
    dispose: () => host.dispose(),
    interrupt: () => host.interrupt(),
    get inFlight(): number {
      return host.inFlight
    },
  }
}
