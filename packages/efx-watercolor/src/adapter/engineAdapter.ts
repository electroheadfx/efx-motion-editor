// ============================================================
//  createAquarelleEngineAdapter — engine-2's EngineAdapter<P>
//  plug point (HOST-02 / D-19). engineId 'efx-watercolor' is
//  already named in the host EngineId union.
//
//  payloadCodec.parse is total and fail-closed (null on any
//  malformed input, never throws) — the host never reads P
//  (T-56-03 mitigation).
// ============================================================

import type {
  EngineAdapter,
  EngineId,
  StudioPoint,
  StudioStroke,
} from '@efxlab/efx-paint-host'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import { toStudioStroke } from '../payload/toStudioStroke'
import { depositStroke } from '../engine/deposit'
import type { DepositCanvas } from '../engine/deposit'
import type { AquarelleToolOverrides } from '../brushes/tips'
import { findTip, TIPS } from '../brushes/tips'

export interface AquarelleAdapterOptions {
  width?: number
  height?: number
  canvas?: HTMLCanvasElement | DepositCanvas
}

const TOOL_OVERRIDE_KEYS = [
  'tip',
  'aspect',
  'rotation',
  'sizeCurve',
  'scatter',
  'capacity',
  'grain',
  'wetRound',
] as const

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

function isPoint(v: unknown): v is StudioPoint {
  if (typeof v !== 'object' || v === null) return false
  const p = v as Record<string, unknown>
  return (
    isFiniteNumber(p['x']) &&
    isFiniteNumber(p['y']) &&
    isFiniteNumber(p['p']) &&
    isFiniteNumber(p['tx']) &&
    isFiniteNumber(p['ty']) &&
    isFiniteNumber(p['tw']) &&
    isFiniteNumber(p['tick'])
  )
}

function isToolOverrides(v: unknown): v is AquarelleToolOverrides {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  for (const key of TOOL_OVERRIDE_KEYS) {
    const value = o[key]
    if (value !== undefined && !isFiniteNumber(value)) return false
  }
  return true
}

/**
 * Total, fail-closed parse (EngineAdapter contract). Returns null on ANY
 * malformed input and never throws — a malformed payload must never reach
 * the sim (threat register T-56-03).
 */
function parseStroke(raw: unknown): StudioStroke<AquarelleStrokePayload> | null {
  if (typeof raw !== 'object' || raw === null) return null
  const s = raw as Record<string, unknown>

  if (!Array.isArray(s['pts'])) return null
  if (!s['pts'].every(isPoint)) return null
  if (!isFiniteNumber(s['ticks']) || s['ticks'] < 1) return null
  if (!isFiniteNumber(s['cuisson']) || s['cuisson'] < 0) return null
  if (!('motion' in s)) return null
  if (typeof s['brushId'] !== 'string') return null
  if (!isToolOverrides(s['toolOverrides'])) return null
  if (!isFiniteNumber(s['traceSeed'])) return null
  if (!isFiniteNumber(s['recordedOrder'])) return null
  if (!('playFrame' in s)) return null
  if (!('color' in s)) return null

  const engine = s['engine']
  if (typeof engine !== 'object' || engine === null) return null
  const e = engine as Record<string, unknown>
  if (typeof e['tool'] !== 'string') return null
  if (typeof e['brushId'] !== 'string') return null
  if (typeof e['params'] !== 'object' || e['params'] === null) return null
  if (typeof e['timestamp'] !== 'number' || !Number.isFinite(e['timestamp'])) return null

  return raw as StudioStroke<AquarelleStrokePayload>
}

function serializeStroke(raw: unknown): StudioStroke<AquarelleStrokePayload> {
  if (typeof raw === 'object' && raw !== null && Array.isArray((raw as Record<string, unknown>)['pts'])) {
    const parsed = parseStroke(raw)
    if (parsed) return parsed
  }
  throw new TypeError('payloadCodec.serialize: expected a StudioStroke<AquarelleStrokePayload>')
}

export function createAquarelleEngineAdapter(
  options: AquarelleAdapterOptions = {},
): EngineAdapter<AquarelleStrokePayload> {
  const engineId: EngineId = 'efx-watercolor'
  const strokes: StudioStroke<AquarelleStrokePayload>[] = []
  const width = options.width ?? 0
  const height = options.height ?? 0
  const canvas = options.canvas
  let disposed = false

  const depositAll = (limit?: number): void => {
    if (disposed || !canvas) return
    const tip = TIPS[0]
    if (!tip) return
    const count = limit === undefined ? strokes.length : Math.min(limit, strokes.length)
    for (let i = 0; i < count; i++) {
      const stroke = strokes[i]
      if (!stroke) continue
      const strokeTip = findTip(stroke.brushId) ?? tip
      depositStroke(canvas, stroke, strokeTip, { width, height })
    }
  }

  return {
    engineId,
    payloadCodec: {
      serialize: serializeStroke,
      parse: parseStroke,
    },
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
        if (!existing) strokes.push(entry.stroke)
      }
      depositAll()
    },
    renderAllStrokes(): void {
      depositAll()
    },
    exportCompositeCanvas(): HTMLCanvasElement {
      return canvas as unknown as HTMLCanvasElement
    },
    applyStroke(stroke: StudioStroke<AquarelleStrokePayload>): void {
      if (disposed) return
      const parsed = parseStroke(stroke)
      if (!parsed) return
      strokes.push(parsed)
      if (!canvas) return
      const tip = findTip(parsed.brushId) ?? TIPS[0]
      if (!tip) return
      depositStroke(canvas, parsed, tip, { width, height })
    },
    stepTick(_tick: number): void {
      /* cuisson ticks — diffusion/drying lands in 56-03 */
    },
    captureFrame(): CanvasImageSource {
      return canvas as unknown as CanvasImageSource
    },
    dispose(): void {
      disposed = true
      strokes.length = 0
    },
  }
}

// Re-exported so callers can build a projection without importing payload directly.
export { toStudioStroke }
