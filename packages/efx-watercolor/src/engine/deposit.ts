// ============================================================
//  depositStroke — engine-2 pigment deposit along a stroke path.
//
//  Thin path (56-01 tracer): stamps pigment along `stroke.pts`
//  using mixSpectral for colour (subtractive, R1.2) and
//  seededRng(traceSeed, 'deposit') for any scatter — ZERO
//  unseeded RNG in this path (D-20). Unpainted pixels stay
//  untouched (alpha 0).
//
//  Full fluid physics (advection / wet-gated diffusion / tide
//  line) lands in 56-03 — this file grows in place.
// ============================================================

import { mixSpectral } from '@efxlab/efx-spectral'
import type { Rgb } from '@efxlab/efx-spectral'
import { seededRng } from '@efxlab/efx-paint-host'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import type { AquarelleStrokePayload } from '../payload/toStudioStroke'
import type { AquarelleTip } from '../brushes/tips'

export interface DepositOptions {
  width: number
  height: number
}

/** Minimal 2d context surface the deposit writes through. */
export interface DepositCanvas {
  getContext(id: '2d'): {
    getImageData(x: number, y: number, w: number, h: number): {
      width: number
      height: number
      data: Uint8ClampedArray
    }
    putImageData(
      imageData: { width: number; height: number; data: Uint8ClampedArray },
      x: number,
      y: number,
    ): void
  } | null
}

function parseHexColor(hex: string | null): Rgb {
  if (!hex) return [32, 32, 32]
  let s = hex.trim()
  if (s.startsWith('#')) s = s.slice(1)
  if (s.length === 3) s = s[0]! + s[0]! + s[1]! + s[1]! + s[2]! + s[2]!
  if (s.length !== 6) return [32, 32, 32]
  const n = Number.parseInt(s, 16)
  if (!Number.isFinite(n)) return [32, 32, 32]
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/**
 * Stamp pigment along `stroke.pts` using the given tip.
 * Unpainted pixels stay alpha 0 — only coverage under the stamp is written.
 */
export function depositStroke(
  canvas: DepositCanvas,
  stroke: StudioStroke<AquarelleStrokePayload>,
  tip: AquarelleTip,
  options: DepositOptions,
): void {
  const { width, height } = options
  if (width <= 0 || height <= 0) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const pts = stroke.pts
  if (pts.length === 0) return

  const pigment = parseHexColor(stroke.color ?? stroke.engine.color ?? null)
  const overrides = stroke.engine.toolOverrides ?? tip.defaults
  const sizeParam = stroke.engine.params['size']
  const baseRadius = Math.max(1, (Number.isFinite(sizeParam) ? Number(sizeParam) : 12) / 2)
  const radius = Math.max(1, baseRadius * (overrides.tip ?? 1))

  // Deterministic scatter — per-stroke stream, never an unseeded RNG (D-20).
  const rng = seededRng(stroke.traceSeed, 'deposit')
  const scatter = Math.max(0, (overrides.scatter ?? 1) - 1) * radius

  const image = ctx.getImageData(0, 0, width, height)
  const data = image.data

  // Stamp along the polyline, sampling densely enough to close gaps.
  const stampAt = (cx: number, cy: number, strength: number): void => {
    const r = Math.ceil(radius)
    const x0 = Math.max(0, Math.floor(cx - r))
    const x1 = Math.min(width - 1, Math.ceil(cx + r))
    const y0 = Math.max(0, Math.floor(cy - r))
    const y1 = Math.min(height - 1, Math.ceil(cy + r))
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx
        const dy = y - cy
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > radius) continue
        // Soft disc falloff — coverage 0..1.
        const coverage = (1 - dist / radius) * strength
        if (coverage <= 0) continue

        const idx = (y * width + x) * 4
        const existingAlpha = data[idx + 3] ?? 0
        if (existingAlpha <= 0) {
          // First pigment on a transparent pixel — write it directly.
          data[idx] = pigment[0]
          data[idx + 1] = pigment[1]
          data[idx + 2] = pigment[2]
          data[idx + 3] = Math.round(coverage * 255)
        } else {
          // Subtractive mix with the pigment already there (R1.2).
          const existing: Rgb = [data[idx] ?? 0, data[idx + 1] ?? 0, data[idx + 2] ?? 0]
          const mixed = mixSpectral(existing, pigment, coverage)
          data[idx] = mixed[0]
          data[idx + 1] = mixed[1]
          data[idx + 2] = mixed[2]
          data[idx + 3] = Math.min(255, Math.round(existingAlpha + coverage * 255))
        }
      }
    }
  }

  // Always stamp the recorded sample positions.
  for (const pt of pts) {
    const jx = scatter > 0 ? (rng() - 0.5) * 2 * scatter : 0
    const jy = scatter > 0 ? (rng() - 0.5) * 2 * scatter : 0
    const pressure = Number.isFinite(pt.p) ? Math.min(1, Math.max(0.15, pt.p)) : 0.5
    stampAt(pt.x + jx, pt.y + jy, pressure)
  }

  // Bridge gaps between consecutive samples so a fast stroke stays continuous.
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!
    const b = pts[i]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, radius * 0.5)))
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      stampAt(a.x + dx * t, a.y + dy * t, 0.85)
    }
  }

  ctx.putImageData(image, 0, 0)
}
