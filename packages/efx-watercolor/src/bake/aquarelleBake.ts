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

/** 261029-bks: which replay law a bake took. */
export type AquarelleBakePath = 'timed' | 'fallback' | 'legacy'

/**
 * 261029-bks: one diagnostics record per `bake()`, emitted exactly once on
 * every path (timed / fallback / legacy, a cancelled or failed bake included).
 * Carries SCALAR counters and timings only — never pixels, canvases, data URLs
 * or script content (T-bks-01).
 *
 * Counter law (one reading — do not invent a second):
 *
 * - `timelineTicks`: the timed path sums each window's tick span (`tickBudget`
 *   per frame); the fallback path sums `tickBudget`; the legacy path sums the
 *   clamped cuisson per stroke.
 * - `simulatedTicks`: ACTUAL `stepTick` invocations made by the bake on the
 *   adapter — gap-walk steps, the fallback diffusion steps, the legacy cuisson
 *   steps and the end-frame settle steps. It EXCLUDES the sample ticks (they
 *   run inside the adapter's `renderPartialStrokes`/`feedDueSample`, never
 *   through `stepTick`) and the adapter-internal Dry drain (30 clock+tick pairs
 *   inside `applyDry`). This is the CONTEXT-locked definition; `settleTicks`
 *   is the subset of these calls owned by the settle law.
 * - `skippedGapTicks`: clock-only ticks advanced by `skipTicks`.
 * - `settleTicks`: end-frame settle `stepTick` calls (`FIX_SETTLE_TICKS` on the
 *   fix bake, the guard count on the cook-to-sleep). Subset of
 *   `simulatedTicks`.
 * - `gapCount`: gap ranges with `toTick > fromTick` walked by `stepGap`.
 * - Invariant the tests pin (per gap, not global): for every gap `[a,b)`,
 *   `stepTick` calls with an index inside `[a,b)` plus `skippedGapTicks` for
 *   that gap equals `b − a`, and the virtual clock is strictly equal to the
 *   no-skip run. There is NO global `timelineTicks === simulatedTicks +
 *   skippedGapTicks` identity: sample ticks run inside the adapter (never
 *   through `stepTick`), `buildRecordedTimeline` clamps `beginTick` to
 *   `previousEnd` so clamp-adjacent strokes can feed more samples than the
 *   window span, and the settle steps sit outside every window span.
 *   `skippedGapTicks === 0` on the fallback and legacy paths.
 * - `bakeMs`: wall time from `bake()` entry to its return; `encodeMs`:
 *   accumulated `encodeWebp` wall time (cumulative across frames; overlapping
 *   encodes may double-count — document it, do not "fix" it).
 */
export interface AquarelleBakeDiagnostics {
  readonly path: AquarelleBakePath
  readonly timelineTicks: number
  readonly simulatedTicks: number
  readonly skippedGapTicks: number
  readonly gapCount: number
  readonly settleTicks: number
  readonly bakeMs: number
  readonly encodeMs: number
}

/** Non-exported mutable working copy — the per-call accumulator. */
type MutableBakeDiagnostics = {
  -readonly [K in keyof AquarelleBakeDiagnostics]: AquarelleBakeDiagnostics[K]
}

/** 261030-np9: one stroke paired with the output frame the bake started it on. */
export interface AquarelleStrokeFrameAnchor {
  readonly stroke: StudioStroke<AquarelleStrokePayload>
  readonly startFrame: number
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
  /**
   * 261026 Motion wiggle (the Play dialog's deformation + position). The
   * aquarelle sheet is cumulative — deposited pigment cannot be re-warped
   * inside the sim — so the pose is applied to each CAPTURED progressive
   * frame instead. Receives the 0-based OUTPUT frame index; the caller adds
   * its absolute start frame. Returning the input frame is allowed (identity).
   */
  poseFrame?: (frame: CanvasImageSource, frameIndex: number) => CanvasImageSource
  /**
   * 261022 Apply parity: fires only during progressive replay (a bake with
   * `frameCount` set), once per FULLY FED stroke event, cumulative from 1 to
   * the stroke-event count. Dry events are not counted. It runs inside the
   * bake turn, so a throw would fail the bake — the consumer must only
   * perform guarded writes and never throw. When `frameCount` is 1 the bake
   * yields to the host between strokes so the UI can paint; the committed
   * image and the stepped tick sequence are identical to a run without it.
   */
  onStrokeFed?: (completed: number, total: number) => void
  /**
   * 261029-bks: exactly once per `bake()` — every path (timed / fallback /
   * legacy), cancelled and failed bakes included. It can never throw into the
   * bake: a throwing consumer is swallowed (T-bks-02), so the consumer must
   * not rely on its own errors surfacing.
   */
  onDiagnostics?: (d: AquarelleBakeDiagnostics) => void
  /**
   * 261030-np9: the per-stroke start-frame mapping the bake ACTUALLY used
   * (timed and fallback paths alike), in script order, reported once per
   * `bake()`. It can never throw into the bake: a throwing consumer is
   * swallowed (T-bks-02), so the consumer must not rely on its own errors
   * surfacing.
   */
  onStrokeFrameAnchors?: (anchors: readonly AquarelleStrokeFrameAnchor[]) => void
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

/**
 * 261019c Studio override (user decision 2026-10-19): the sheet force-dries
 * after this VISIBLE settle window instead of cooking through the engine's
 * full awake window — the fully settled wash diffuses until it looks washed
 * out. The live sheet, its cache capture, and the aquarelle bake share this
 * cap so all three keep the denser look the artist sees while painting.
 * Dry Speed still scales it (higher dry % = shorter window); dry 50 → 165
 * ticks ≈ 2.75 s.
 */
export function aquarelleVisibleSettleTicks(dryPercent: number): number {
  const dry = typeof dryPercent === 'number' && Number.isFinite(dryPercent)
    ? Math.max(0, Math.min(100, dryPercent))
    : 50
  return Math.round(30 + 270 * (1 - dry / 100))
}

/** Engine FIX_DURATION (1.2 s) on the host tick grid — the force-dry bake. */
const FIX_SETTLE_TICKS = Math.round(1.2 * 60)

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

/**
 * 261022: yield to the host task queue so a progress write can paint between
 * strokes. `MessageChannel` posts a MACROtask in every webview we run in
 * (WebKit included). `requestAnimationFrame` must NEVER be used here — it
 * stops for a hidden window, and an Apply may outlive the Studio's
 * visibility. `setTimeout(0)` is the fallback where MessageChannel is absent.
 */
function yieldToHost(): Promise<void> {
  if (typeof MessageChannel === 'function') {
    return new Promise<void>((resolve) => {
      const channel = new MessageChannel()
      channel.port1.onmessage = () => {
        channel.port1.close()
        channel.port2.close()
        resolve()
      }
      channel.port2.postMessage(0)
    })
  }
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

/**
 * 261029-bks: wall clock for diagnostics. `performance.now()` where available
 * (monotonic, sub-ms), `Date.now()` otherwise.
 */
function readNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
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

  /**
   * 261029-bks: the ONE counting wrapper. Every bulk `stepTick` site binds a
   * `stepTimeline` from this factory, so `simulatedTicks` counts every step
   * the bake drives on the adapter and nothing else.
   */
  const countedStep = (d: MutableBakeDiagnostics) => (tick: number): void => {
    d.simulatedTicks += 1
    adapter.stepTick(tick)
  }

  /**
   * 261029-bks: emit the per-bake record exactly once. A throwing consumer is
   * swallowed — it must never fail, cancel or corrupt a bake (T-bks-02).
   */
  const emitDiagnostics = (d: MutableBakeDiagnostics, startedAt: number): void => {
    d.bakeMs = readNow() - startedAt
    const consumer = options.onDiagnostics
    if (!consumer) return
    try {
      consumer(d)
    } catch {
      /* T-bks-02: a throwing diagnostics consumer is swallowed. */
    }
  }

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
    diagnostics: MutableBakeDiagnostics,
  ): Promise<AquarelleBakeResult> => {
    const frames: AquarelleBakeFrame[] = []
    const outcomes: Promise<BakeTurnOutcome>[] = []
    let commitBarrier: Promise<void> = Promise.resolve()
    const frameSpan = Math.max(1, Math.trunc(frameCount))
    // 261029-bks: the optional adapter seams. `skipTicks` is an optional
    // EXTENSION of the host EngineAdapter (detected by cast) — the host
    // interface itself is unchanged.
    const seams = adapter as EngineAdapter<AquarelleStrokePayload> & {
      isAwake?: () => boolean
      fix?: () => void
      skipTicks?: (fromTick: number, toTick: number) => void
    }

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
    const timedBase = buildRecordedTimeline(strokes)
    diagnostics.path = timedBase ? 'timed' : 'fallback'
    const schedule = timedBase ? [] : buildProgressiveStrokeSchedule(strokes, frameSpan)

    // 261029-bks: skip only when BOTH seams exist — an older adapter (or any
    // test double) keeps its exact tick law and receives NO probes.
    const canSkip = typeof seams.skipTicks === 'function' && typeof seams.isAwake === 'function'
    const stepTimeline = countedStep(diagnostics)

    /**
     * 261029-bks: walk one idle gap `[fromTick, toTick)` on the recorded
     * timeline. Probe BEFORE each step: while awake the tick runs on the
     * engine; the tick that first observes sleep still runs (mandatory
     * boundary tick — its `sleep()`/`render()` flush must not be lost), is
     * re-checked once, and only then is the remainder advanced clock-only.
     * Never reads or mutates any walker's cursor; never crosses a Dry, a
     * window bound or the settle law (the caller owns the bounds).
     */
    function stepGap(fromTick: number, toTick: number): void {
      if (toTick <= fromTick) return
      diagnostics.gapCount += 1
      let tick = fromTick
      while (tick < toTick) {
        if (canSkip && !seams.isAwake!()) {
          // Mandatory boundary tick: the tick that first observes sleep.
          stepTimeline(tick)
          tick += 1
          if (tick >= toTick) return
          if (!seams.isAwake!()) {
            const skipFrom = tick
            seams.skipTicks!(skipFrom, toTick)
            diagnostics.skippedGapTicks += toTick - skipFrom
            tick = toTick
          }
          continue
        }
        stepTimeline(tick)
        tick += 1
      }
    }

    // 261022 Apply parity: one cumulative progress step per fully fed stroke.
    // Keyed by stroke identity because a stroke can be re-fed in larger
    // chunks on later windows — only its first completion counts.
    const onStrokeFed = options.onStrokeFed
    const fedStrokes = new Set<StudioStroke<AquarelleStrokePayload>>()
    let fedStrokeCount = 0
    const strokeTotal = strokes.length
    const reportFed = async (stroke: StudioStroke<AquarelleStrokePayload>): Promise<void> => {
      if (!onStrokeFed || fedStrokes.has(stroke)) return
      fedStrokes.add(stroke)
      fedStrokeCount += 1
      onStrokeFed(fedStrokeCount, strokeTotal)
      // Apply (one output frame) yields so the progress write paints. Play's
      // multi-frame bakes already yield per captured frame — never add a
      // macrotask per stroke there.
      if (frameSpan === 1 && fedStrokeCount < strokeTotal) await yieldToHost()
    }

    // 261019b: frames follow SAMPLE progress, not wall-clock time. The session
    // clock includes the settle tail (often seconds) and the idle gaps, so a
    // uniform-time split finished short strokes inside the first frame — the
    // animation showed whole strokes appearing instead of drawing. Frames are
    // now allocated by drawn samples; the gaps/settle are simulated inside the
    // frame that reaches them, and the final frame keeps the settle cook.
    const sampleTicks: number[] = []
    if (timedBase) {
      for (const entry of timedBase) {
        for (let index = 0; index < entry.stroke.pts.length; index += 1) {
          sampleTicks.push(entry.beginTick + index)
        }
      }
    }
    const drawFrameSpan = Math.max(1, frameSpan - 1)

    // Each Dry fires before the next stroke's first frame (recorded order).
    const startFrameOf = new Map<StudioStroke<AquarelleStrokePayload>, number>()
    const timed = timedBase
    let timelineEnd = 0
    // True when the settle hit the visible cap (the live sheet force-dries) —
    // a naturally shorter sleep already baked itself and must not be fixed.
    let settleCapped = false
    if (timedBase) {
      const lastEntry = timedBase[timedBase.length - 1]!
      const lastStrokeDry = (lastEntry.stroke.engine as { params?: { dry?: number } } | undefined)?.params?.dry
      const settleCap = aquarelleVisibleSettleTicks(typeof lastStrokeDry === 'number' ? lastStrokeDry : 50)
      // 261019c: never cook past the visible settle cap — the measured awake
      // window (often far longer) is the washed-out state the user rejected.
      // A shorter measured window still wins.
      const rawSettle = clampCuisson(
        lastEntry.stroke.cuisson || (lastEntry.stroke.engine as { diffusionFrames?: number } | undefined)?.diffusionFrames,
      )
      settleCapped = rawSettle <= 0 || rawSettle >= settleCap
      const settleEstimate = Math.min(rawSettle || settleCap, settleCap)
      // The last SAMPLE sits at endTick (ticks = pts - 1) — the timeline must
      // cover one more tick so a zero-settle stroke can still feed it.
      timelineEnd = Math.max(
        1,
        lastEntry.endTick + settleEstimate,
        lastEntry.beginTick + lastEntry.stroke.pts.length,
      )
      const frameForTick = (tick: number) => Math.max(0, Math.min(
        frameSpan - 1,
        Math.ceil((tick * frameSpan) / timelineEnd) - 1,
      ))
      for (const entry of timedBase) startFrameOf.set(entry.stroke, frameForTick(entry.beginTick))
    } else {
      for (const entry of schedule) startFrameOf.set(entry.stroke, entry.startFrame)
    }
    const drysByFrame = new Map<number, AquarelleDryEvent[]>()
    // Timed path: a Dry rides with the stroke that follows it in recorded
    // order and fires at that stroke's first SAMPLE (not the frame start).
    // A trailing Dry (no stroke after it) fires after the last samples.
    const drysBeforeStroke = new Map<StudioStroke<AquarelleStrokePayload>, AquarelleDryEvent[]>()
    const trailingDrys: AquarelleDryEvent[] = []
    let pendingDrys: AquarelleDryEvent[] = []
    for (const event of events) {
      if (isAquarelleDryEvent(event)) {
        pendingDrys.push(event)
        continue
      }
      const stroke = event as StudioStroke<AquarelleStrokePayload>
      if (timed) {
        if (pendingDrys.length > 0) {
          drysBeforeStroke.set(stroke, pendingDrys)
          pendingDrys = []
        }
        continue
      }
      const frame = startFrameOf.get(stroke)
      if (frame !== undefined && pendingDrys.length > 0) {
        const list = drysByFrame.get(frame) ?? []
        list.push(...pendingDrys)
        drysByFrame.set(frame, list)
        pendingDrys = []
      }
    }
    if (pendingDrys.length > 0) {
      if (timed) trailingDrys.push(...pendingDrys)
      else {
        const frame = Math.max(0, frameSpan - 1)
        const list = drysByFrame.get(frame) ?? []
        list.push(...pendingDrys)
        drysByFrame.set(frame, list)
      }
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
      const isFinalFrame = frameIndex === frameSpan - 1
      const windowStart = previousWindowEnd
      let frameStrokes: { stroke: StudioStroke<AquarelleStrokePayload>; pointCount: number }[] = []
      let tickBudget = 0
      let windowEnd = previousWindowEnd
      if (timed) {
        if (isFinalFrame || sampleTicks.length === 0) {
          windowEnd = isFinalFrame
            ? Math.max(previousWindowEnd, timelineEnd)
            : Math.max(previousWindowEnd, Math.round(((frameIndex + 1) * timelineEnd) / frameSpan))
        } else {
          const target = Math.min(
            sampleTicks.length,
            Math.max(1, Math.ceil(((frameIndex + 1) / drawFrameSpan) * sampleTicks.length)),
          )
          // +1 because the window bound is exclusive: a sample at tick T is fed
          // when windowEnd > T (each tick is simulated exactly once).
          windowEnd = Math.min(timelineEnd, Math.max(previousWindowEnd, sampleTicks[target - 1]! + 1))
        }
        tickBudget = Math.max(0, windowEnd - previousWindowEnd)
        previousWindowEnd = windowEnd
        diagnostics.timelineTicks += tickBudget
      } else {
        for (const dry of drysByFrame.get(frameIndex) ?? []) {
          void scheduleAdapter(() => {
            adapter.applyStroke(dry as unknown as StudioStroke<AquarelleStrokePayload>)
          })
        }
        frameStrokes = getProgressiveFrameStrokes(schedule, frameIndex)
        tickBudget = isFinalFrame
          ? diffusionPerFrame + lastStrokeCatchUp
          : diffusionPerFrame
        diagnostics.timelineTicks += tickBudget
      }

      const framePromise = scheduleAdapter(async () => {
        if (timed) {
          // TRUE TICK ORDER: a window's samples must land at their recorded
          // tick — idle fluid time BEFORE a stroke is stepped before its
          // samples, never after. Feeding a whole window's samples at the
          // window start (then idling) landed later strokes on a wetter sheet
          // than the live paint lived, which bloomed Play shapes wider.
          // Samples are only ever fed between strokes, so interleaving at
          // stroke-chunk granularity is exact.
          let cursor = windowStart
          for (const entry of timed) {
            if (entry.beginTick > windowEnd) break
            const pointCount = Math.min(entry.stroke.pts.length, windowEnd - entry.beginTick)
            if (pointCount <= 0) {
              // A zero-point stroke is fully fed by definition. A window that
              // has NOT opened yet (beginTick === windowEnd) is not progress.
              if (entry.stroke.pts.length === 0) await reportFed(entry.stroke)
              continue
            }
            const fed = fedCounts.get(entry.stroke) ?? 0
            if (pointCount <= fed) continue
            const firstTick = entry.beginTick + fed
            stepGap(cursor, firstTick)
            if (fed === 0) {
              for (const dry of drysBeforeStroke.get(entry.stroke) ?? []) {
                adapter.applyStroke(dry as unknown as StudioStroke<AquarelleStrokePayload>)
              }
            }
            // The adapter ticks once per fed sample.
            adapter.renderPartialStrokes([{ stroke: entry.stroke, pointCount }])
            cursor = firstTick + (pointCount - fed)
            fedCounts.set(entry.stroke, pointCount)
            if (pointCount >= entry.stroke.pts.length) await reportFed(entry.stroke)
          }
          // A user Dry after the last stroke settles at the end of the span.
          if (isFinalFrame && trailingDrys.length > 0) {
            // The Dry fires AFTER the clock reaches windowEnd (its fix + 30
            // ticks unchanged) — the gap may skip, the Dry never moves.
            stepGap(cursor, windowEnd)
            cursor = windowEnd
            for (const dry of trailingDrys) {
              adapter.applyStroke(dry as unknown as StudioStroke<AquarelleStrokePayload>)
            }
          }
          stepGap(cursor, windowEnd)
        } else {
          adapter.renderPartialStrokes(frameStrokes)
          for (const entry of frameStrokes) {
            if (entry.pointCount >= entry.stroke.pts.length) await reportFed(entry.stroke)
          }
          for (let tick = 0; tick < tickBudget; tick += 1) {
            stepTimeline(tick)
          }
        }
        // End-frame law: force-dry at the visible settle cap — the same fix()
        // the live sheet runs at its cap — and bake the fix window. The
        // resulting state is the live cache's denser capture. Adapters without
        // the seam (older / test doubles) keep the cook-to-sleep fallback.
        if (isFinalFrame) {
          // The settle law is NEVER skipped (truth table row 5).
          const fixSeam = seams.fix
          if (settleCapped && typeof fixSeam === 'function') {
            fixSeam.call(adapter)
            for (let tick = 0; tick < FIX_SETTLE_TICKS; tick += 1) {
              stepTimeline(tick)
              diagnostics.settleTicks += 1
            }
          } else if (typeof seams.isAwake === 'function') {
            const awake = seams.isAwake
            for (let guard = 0; guard < SETTLE_MAX_TICKS && awake(); guard += 1) {
              stepTimeline(guard)
              diagnostics.settleTicks += 1
            }
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
          const captured = await framePromise
          const frame = options.poseFrame ? options.poseFrame(captured, frameIndex) : captured
          const fallback = readSize(frame)
          const width = options.width ?? fallback.width
          const height = options.height ?? fallback.height
          const encodeStartedAt = readNow()
          const bytes = await encodeWebp(frame, width, height)
          diagnostics.encodeMs += readNow() - encodeStartedAt
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
    const startedAt = readNow()
    // 261029-bks: one accumulator per bake() — a shared one would let
    // overlapping bakes read each other's counters.
    const diagnostics: MutableBakeDiagnostics = {
      path: 'legacy',
      timelineTicks: 0,
      simulatedTicks: 0,
      skippedGapTicks: 0,
      gapCount: 0,
      settleTicks: 0,
      bakeMs: 0,
      encodeMs: 0,
    }
    // The legacy branch's counted step site lives in this scope.
    const stepTimeline = countedStep(diagnostics)
    try {
      if (options.frameCount && options.frameCount > 0) {
        return await bakeProgressive(events, Math.floor(options.frameCount), diagnostics)
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
          diagnostics.timelineTicks += cuisson
          for (let tick = 0; tick < cuisson; tick += 1) {
            stepTimeline(tick)
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
            const encodeStartedAt = readNow()
            const bytes = await encodeWebp(frame, width, height)
            diagnostics.encodeMs += readNow() - encodeStartedAt
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
    } finally {
      // Exactly once per bake() — a cancelled or failed bake reports too.
      emitDiagnostics(diagnostics, startedAt)
    }
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
