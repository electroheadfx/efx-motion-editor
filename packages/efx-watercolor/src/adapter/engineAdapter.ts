// ============================================================
//  createAquarelleEngineAdapter — engine-2's EngineAdapter<P>
//  plug point (HOST-02 / D-19). engineId 'efx-watercolor' is
//  already named in the host EngineId union.
//
//  payloadCodec is the 56-06 script codec (one payload union,
//  D-16) — parse is total and fail-closed (null on any
//  malformed input, never throws) — the host never reads P
//  (T-56-03 mitigation).
//
//  Play/bake path (56-12, one engine per script): replay runs
//  on the vendored WatercolorEngine — the SAME simulation the
//  live canvas paints with. One stepping law live == bake:
//  each integer tick feeds that tick's recorded sample through
//  the engine stamp path, then engine.tick(HOST_DT) advances
//  the fluid. Dry events call engine.fix() at their recorded
//  tick (D-15). Frame indices never force-dry (P4 / D-28).
//
//  Points are document uv (y up) — the engine's native space —
//  so live and bake cannot drift. Params are the CANONICAL
//  AQUA-04 globals mapped through toEngineParams(); never the
//  mapped 0..1 bag.
// ============================================================

import type {
  EngineAdapter,
  EngineId,
  StudioStroke,
} from '@efxlab/efx-paint-host'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import { toStudioStroke } from '../payload/toStudioStroke'
import {
  isAquarelleDryEvent,
  type AquarelleDryEvent,
  type AquarellePayloadEvent,
} from '../payload/dryEvent'
import { payloadCodec } from '../payload/codec'
import { WatercolorEngine, type Tool } from '../playground/Engine'
import { toEngineParams } from '../playground/params'
import { buildBrushForStroke } from '../playground/brushBridge'
import { pigmentFromHex } from '../playground/spectral'
import { DEFAULT_PAPER, PAPERS, type PaperPreset } from '../playground/papers'
import type { AquarelleBakePaper } from '../bake/aquarelleBake'

/** Host tick grid — 60 Hz, integer ticks (Q2 / DATA-03). */
export const HOST_TICK_HZ = 60
const HOST_DT = 1 / HOST_TICK_HZ

export interface AquarelleAdapterOptions {
  width?: number
  height?: number
  canvas?: HTMLCanvasElement
  /**
   * 261017-fz3: resolved Studio paper preset (paperPresetForStudioId, app-side).
   * The adapter calls engine.setPaper + engine.paperTexture before the first
   * applyStroke so the deposit carries the Studio paper's tooth. Q5a cold
   * fallback for paper/real-* stays in paperPresetForStudioId (app-side).
   */
  paperPreset?: PaperPreset
  /** Paper strength 0..1 — engine.paperTexture (deposit grain visibility). */
  paperStrength?: number
}

/**
 * Accept an in-memory stroke/Dry (play path) by round-tripping it
 * through the script codec — same fail-closed validation the host
 * sees, plus the D-19 diffusion clamp.
 */
function acceptEvent(raw: unknown): AquarellePayloadEvent | null {
  if (typeof raw !== 'object' || raw === null) return null
  if (isAquarelleDryEvent(raw)) {
    return payloadCodec.parse(payloadCodec.serialize(raw))
  }
  return payloadCodec.parse(payloadCodec.serialize(raw as AquarellePayloadEvent))
}

/** mulberry32 — same family the vendor tip generator uses. */
function seededRandom(seed: number): () => number {
  let state = (seed | 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const AQUARELLE_TOOL_SET = new Set<Tool>(['brush', 'water', 'pen', 'lift'])

function asTool(raw: string): Tool {
  return AQUARELLE_TOOL_SET.has(raw as Tool) ? (raw as Tool) : 'brush'
}

export function createAquarelleEngineAdapter(
  options: AquarelleAdapterOptions = {},
): EngineAdapter<AquarelleStrokePayload> {
  const engineId: EngineId = 'efx-watercolor'
  const strokes: StudioStroke<AquarelleStrokePayload>[] = []
  const width = Math.max(1, Math.trunc(options.width ?? 0))
  const height = Math.max(1, Math.trunc(options.height ?? 0))
  let disposed = false

  // The vendor engine owns a WebGL2 surface. Bake runs on an offscreen
  // canvas at document resolution (A5: transparent where unpainted).
  const canvas =
    options.canvas ??
    (typeof document !== 'undefined' ? document.createElement('canvas') : null)
  if (canvas && width > 0 && height > 0) {
    canvas.width = width
    canvas.height = height
  }

  let engine: WatercolorEngine | null = null
  if (canvas) {
    try {
      engine = new WatercolorEngine(canvas, null, {}, width > 0 && height > 0 ? [width, height] : null)
      engine.setManual(true)
    } catch {
      // No WebGL2 / float targets — fail closed at applyStroke, never crash the host.
      engine = null
    }
  }

  // Virtual clock + seeded RNG so two bakes of one script match (A2).
  let virtualNow = 0
  const advanceClock = (ms: number) => {
    virtualNow += ms
  }
  engine?.setClock(() => virtualNow)
  engine?.setRandom(seededRandom(1))

  // 261017-fz3: paper feeds the engine BEFORE the first applyStroke so the
  // replayed deposit carries the Studio paper's tooth / granulation.
  const applyPaper = (paper: AquarelleBakePaper | undefined, preset?: PaperPreset): void => {
    if (!engine) return
    const resolved = preset
      ?? (paper ? PAPERS.find((p) => p.id === (paper.paperId.includes('/') ? 'cold' : paper.paperId)) ?? DEFAULT_PAPER : undefined)
    if (resolved) engine.setPaper(resolved)
    const strength = paper?.grainStrength
    if (typeof strength === 'number' && Number.isFinite(strength)) {
      engine.paperTexture = strength < 0 ? 0 : strength > 1 ? 1 : strength
    }
  }
  applyPaper(undefined, options.paperPreset)
  if (typeof options.paperStrength === 'number' && engine) {
    engine.paperTexture = options.paperStrength < 0 ? 0 : options.paperStrength > 1 ? 1 : options.paperStrength
  }

  /** Pending stroke being walked on the tick grid. */
  let active: {
    stroke: StudioStroke<AquarelleStrokePayload>
    index: number
    started: boolean
  } | null = null

  const configure = (stroke: StudioStroke<AquarelleStrokePayload>): void => {
    if (!engine) return
    const payload = stroke.engine
    engine.setParams(toEngineParams(payload.params))
    engine.setBrush(buildBrushForStroke(payload.brushId ?? stroke.brushId, payload.toolOverrides ?? stroke.toolOverrides))
    const hex = stroke.color ?? payload.color
    if (typeof hex === 'string' && hex.length > 0) engine.setPigment(pigmentFromHex(hex))
    engine.setTool(asTool(payload.tool))
    // traceSeed is the D-20 per-stroke determinism key.
    engine.setRandom(seededRandom(stroke.traceSeed || 1))
  }

  /** User-initiated Dry (D-15) — wet-state fix at the event's tick. */
  const applyDry = (): void => {
    if (!engine) return
    engine.fix()
    // Drain the fix flash synchronously so the next stroke starts dry.
    for (let i = 0; i < 30; i += 1) {
      advanceClock(1000 * HOST_DT)
      engine.tick(HOST_DT)
    }
  }

  /** Feed the next recorded sample for the active stroke, if its tick has arrived. */
  const feedDueSample = (timelineTick: number): void => {
    if (!engine || !active) return
    const pts = active.stroke.pts
    // pts[].tick is the sample index on the host grid (toStudioStroke law).
    while (active.index < pts.length && pts[active.index]!.tick <= timelineTick) {
      const p = pts[active.index]!
      active.index += 1
      advanceClock(1000 * HOST_DT)
      if (!active.started) {
        active.started = true
        engine.scriptBegin(asTool(active.stroke.engine.tool), p.x, p.y, p.p, 'Stroke')
      } else {
        engine.scriptMove(p.x, p.y, p.p, virtualNow)
      }
    }
    if (active.index >= pts.length && active.started) {
      engine.scriptEnd()
    }
  }

  return {
    engineId,
    // 261017-fz3: the bake calls setPaper before the first applyStroke (the
    // EngineAdapter interface has no paper seam — optional extension).
    setPaper(paper: AquarelleBakePaper): void {
      applyPaper(paper)
    },
    // The 56-06 codec covers the one payload union (strokes + Dry).
    // The host EngineAdapter type is stroke-shaped because the host
    // never reads P and never sees Dry — cast through unknown at this
    // seam only (T-56-17: host never inspects the engine slot).
    payloadCodec: {
      serialize: (raw: unknown) => payloadCodec.serialize(raw as AquarellePayloadEvent),
      parse: (raw: unknown) => payloadCodec.parse(raw),
    } as unknown as EngineAdapter<AquarelleStrokePayload>['payloadCodec'],
    setInputLocked(_locked: boolean): void {
      /* live playback surface — AnimationPlayer wiring lands in a later plan */
    },
    setAnimationMode(_mode: boolean): void {
      /* live playback surface — AnimationPlayer wiring lands in a later plan */
    },
    getStrokes(): readonly StudioStroke<AquarelleStrokePayload>[] {
      return strokes
    },
    renderPartialStrokes(
      strokeData: ReadonlyArray<{ stroke: StudioStroke<AquarelleStrokePayload>; pointCount: number }>,
    ): void {
      if (disposed) return
      for (const entry of strokeData) {
        const existing = strokes.find((s) => s.traceSeed === entry.stroke.traceSeed)
        if (!existing) {
          strokes.push(entry.stroke)
          configure(entry.stroke)
          active = { stroke: entry.stroke, index: 0, started: false }
          // Walk every recorded sample immediately — partial preview.
          feedDueSample(Number.MAX_SAFE_INTEGER)
          advanceClock(1000 * HOST_DT)
          engine?.tick(HOST_DT)
        }
      }
    },
    renderAllStrokes(): void {
      if (disposed || !engine) return
      for (const stroke of strokes) {
        configure(stroke)
        active = { stroke, index: 0, started: false }
        feedDueSample(Number.MAX_SAFE_INTEGER)
        advanceClock(1000 * HOST_DT)
        engine.tick(HOST_DT)
      }
      active = null
    },
    exportCompositeCanvas(): HTMLCanvasElement {
      const out = engine?.exportCanvas('transparent') ?? canvas
      if (!out) throw new Error('createAquarelleEngineAdapter: no canvas to export — pass options.canvas')
      return out as HTMLCanvasElement
    },
    applyStroke(stroke: StudioStroke<AquarelleStrokePayload>): void {
      if (disposed) return
      // Dry is a distinguished payload union member (D-16) — one
      // applyStroke seam, wet-state fix at the recorded tick.
      if (isAquarelleDryEvent(stroke)) {
        applyDry()
        return
      }
      const parsed = acceptEvent(stroke)
      if (!parsed || isAquarelleDryEvent(parsed)) return
      strokes.push(parsed)
      if (!engine) return
      configure(parsed)
      active = { stroke: parsed, index: 0, started: false }
      // Bake contract: applyStroke deposits the whole stroke. Feed every
      // recorded sample on the tick grid, then flush the stamp path once.
      feedDueSample(Number.MAX_SAFE_INTEGER)
      advanceClock(1000 * HOST_DT)
      engine.tick(HOST_DT)
    },
    stepTick(_tick: number): void {
      if (disposed || !engine) return
      // Integer ticks only (DATA-03). Frame indices never force-dry (P4).
      // Diffusion only — the stroke landed in applyStroke.
      advanceClock(1000 * HOST_DT)
      engine.tick(HOST_DT)
    },
    captureFrame(): CanvasImageSource {
      const frame = engine?.exportCanvas('transparent') ?? canvas
      if (!frame) throw new Error('createAquarelleEngineAdapter: no canvas to capture — pass options.canvas')
      return frame as CanvasImageSource
    },
    dispose(): void {
      disposed = true
      strokes.length = 0
      active = null
      engine?.destroy()
      engine = null
    },
  }
}

// Re-exported so callers can build a projection without importing payload directly.
export { toStudioStroke }
