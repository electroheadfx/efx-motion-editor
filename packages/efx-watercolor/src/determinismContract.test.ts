// ============================================================
//  Determinism + dependency-direction standing pins (56-01).
//
//  Family: paintVersionDisciplineContract / hostGenericityRoundTrip /
//  mceFieldContract — a normal vitest `.test.ts` on the existing
//  setup, no new config. Source-scan + replay contract only.
//
//  Laws pinned here:
//    R1.5 / D-20  same script ⇒ same pixels; no unseeded RNG in the
//                 deposit or payload path
//    D-29 / P1    engine-2 never imports engine-1 (clean-room)
// ============================================================

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { hashMutationId } from '@efxlab/efx-paint-host'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import { createAquarelleEngineAdapter } from './adapter/engineAdapter'
import type { AquarelleStrokePayload } from './payload/toStudioStroke'
import { toStudioStroke } from './payload/toStudioStroke'

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENGINE_DIR = join(PKG_DIR, 'src', 'engine')
const PAYLOAD_DIR = join(PKG_DIR, 'src', 'payload')

function collectSources(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...collectSources(full))
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

function sourceText(dir: string): string {
  return collectSources(dir)
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n')
}

// ---------------------------------------------------------------------------
// Mock canvas (same idiom as engineAdapter.test.ts / fakeEngine2Fixture)
// ---------------------------------------------------------------------------

function makeMockCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement
  pixels: Uint8ClampedArray
} {
  const pixels = new Uint8ClampedArray(width * height * 4)
  const canvasRef: Record<string, unknown> = {
    width,
    height,
    getContext: (id: string) => {
      if (id !== '2d') return null
      return {
        canvas: canvasRef,
        getImageData: (_x: number, _y: number, w: number, h: number) => ({
          width: w,
          height: h,
          data: pixels.slice(0, w * h * 4),
        }),
        putImageData: (imageData: { data: Uint8ClampedArray }) => {
          pixels.set(imageData.data.subarray(0, pixels.length))
        },
      }
    },
  }
  return { canvas: canvasRef as unknown as HTMLCanvasElement, pixels }
}

function makeStroke(): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color: '#2244aa',
    params: { size: 12, water: 50, flow: 50 },
    brushId: 'wc/round-medium',
    points: [
      { x: 20, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 28, y: 32, p: 0.6, tx: 0, ty: 0, tw: 0 },
      { x: 36, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 44, y: 32, p: 0.4, tx: 0, ty: 0, tw: 0 },
    ],
    mutationId: 42,
    timestamp: 1000,
  })
}

function replayBytes(): Uint8ClampedArray {
  const width = 64
  const height = 64
  const { canvas, pixels } = makeMockCanvas(width, height)
  const adapter = createAquarelleEngineAdapter({ width, height, canvas })
  adapter.applyStroke(makeStroke())
  for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)
  adapter.captureFrame()
  const copy = pixels.slice()
  adapter.dispose()
  return copy
}

// ---------------------------------------------------------------------------
// 1. Double-replay byte-equality (R1.5 / D-20)
// ---------------------------------------------------------------------------

describe('determinism contract', () => {
  it('applyStroke/stepTick/captureFrame twice on fresh adapters yields identical bytes', () => {
    const a = replayBytes()
    const b = replayBytes()
    expect(a.length).toBe(b.length)
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true)
  })

  it('projects traceSeed = hashMutationId so replays share one seed law', () => {
    const stroke = makeStroke()
    expect(stroke.traceSeed).toBe(hashMutationId(42))
    const again = makeStroke()
    expect(again.traceSeed).toBe(stroke.traceSeed)
  })
})

// ---------------------------------------------------------------------------
// 2. Source-scan gate — no unseeded RNG in engine/ or payload/
// ---------------------------------------------------------------------------

describe('unseeded RNG source scan', () => {
  it('src/engine and src/payload contain zero Math.random occurrences', () => {
    const engine = sourceText(ENGINE_DIR)
    const payload = sourceText(PAYLOAD_DIR)
    expect(engine.includes('Math.random')).toBe(false)
    expect(payload.includes('Math.random')).toBe(false)
  })

  it('src/engine and src/payload contain zero crypto.getRandomValues occurrences', () => {
    const engine = sourceText(ENGINE_DIR)
    const payload = sourceText(PAYLOAD_DIR)
    expect(engine.includes('crypto.getRandomValues')).toBe(false)
    expect(payload.includes('crypto.getRandomValues')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 3. Dependency-direction pin (D-29 / P1) — engine-2 never pulls engine-1
// ---------------------------------------------------------------------------

describe('dependency-direction contract', () => {
  it('package.json dependencies omit engine 1 and include host + spectral', () => {
    const pkg = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const deps = pkg.dependencies ?? {}
    expect(deps['@efxlab/efx-physic-paint']).toBeUndefined()
    expect(deps['@efxlab/efx-paint-host']).toBeDefined()
    expect(deps['@efxlab/efx-spectral']).toBeDefined()
  })

  it('no source file under src/ imports engine 1', () => {
    const all = collectSources(join(PKG_DIR, 'src')).map((f) => readFileSync(f, 'utf8')).join('\n')
    expect(all.includes('@efxlab/efx-physic-paint')).toBe(false)
    expect(all.includes('efx-physic-paint')).toBe(false)
  })
})
