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
  DIFFUSION_CAP,
  type AquarelleStrokePayload,
} from '../payload/toStudioStroke'
import { isAquarelleDryEvent, type AquarellePayloadEvent } from '../payload/dryEvent'

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
