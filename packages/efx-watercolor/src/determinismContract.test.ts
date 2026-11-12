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
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { hashMutationId, mixStrokeSeed } from '@efxlab/efx-paint-host'
import type { StudioStroke } from '@efxlab/efx-paint-host/animation'
import { createAquarelleEngineAdapter } from './adapter/engineAdapter'
import type { AquarelleStrokePayload } from './payload/toStudioStroke'
import { toStudioStroke } from './payload/toStudioStroke'

// ---------------------------------------------------------------------------
// Deterministic engine stand-in for the replay arm (61-07)
//
// vitest has no WebGL2, so the real WatercolorEngine constructor throws and
// the adapter runs engine-less: the mock 2D canvas would then return an
// all-zero buffer and NO cross-mode difference could ever be observed. The
// replay arm therefore swaps in a deterministic stand-in whose exported bytes
// are a pure function of the script it was fed — including the render mode,
// which the adapter passes at the ONE scriptBegin call. That pins the law
// this file owns: the mode is part of the deterministic replay INPUT
// (VEC-06 / D-12). The real-pixel proof (edge transition, per-global
// independence) lives in probe/vector-spine `--scenario ribbon`.
// ---------------------------------------------------------------------------

const replayEngine = vi.hoisted(() => {
  interface FakeCanvas2D {
    createImageData: (
      width: number,
      height: number,
    ) => { width: number; height: number; data: Uint8ClampedArray }
    putImageData: (
      image: { width: number; height: number; data: Uint8ClampedArray },
      x: number,
      y: number,
    ) => void
  }

  interface FakeCanvas {
    width: number
    height: number
    getContext: (id: string) => FakeCanvas2D | null
  }

  class FakeWatercolorEngine {
    paperTexture = 1
    isAwake = false
    private readonly surface: FakeCanvas
    private readonly dabs: Array<{ x: number; y: number; p: number }> = []

    constructor(surface: FakeCanvas) {
      this.surface = surface
    }

    setManual(): void {}
    setClock(): void {}
    setRandom(): void {}
    setPaper(): void {}
    setParams(): void {}
    setBrush(): void {}
    setPigment(): void {}
    setTool(): void {}

    scriptBegin(
      _tool: string,
      x: number,
      y: number,
      p: number,
      _step?: string,
      _maxRadius?: number,
      _tiltX?: number,
      _tiltY?: number,
      _widthScale?: number,
    ): boolean {
      this.dabs.push({ x, y, p })
      return true
    }

    scriptMove(x: number, y: number, p: number): void {
      this.dabs.push({ x, y, p })
    }

    scriptEnd(): void {}
    tick(): void {}
    fix(): void {}
    destroy(): void {}

    resetSheet(): void {
      this.dabs.length = 0
    }

    /** Export one deterministic pixel per fed sample. */
    exportCanvas(): FakeCanvas {
      const ctx = this.surface.getContext('2d')
      if (!ctx) return this.surface
      const image = ctx.createImageData(this.surface.width, this.surface.height)
      for (const dab of this.dabs) {
        const px =
          ((Math.trunc(dab.x) % this.surface.width) + this.surface.width) % this.surface.width
        const py =
          ((Math.trunc(dab.y) % this.surface.height) + this.surface.height) % this.surface.height
        const at = (py * this.surface.width + px) * 4
        image.data[at] = 0x11
        image.data[at + 1] = Math.min(255, Math.max(0, Math.round(dab.p * 255)))
        image.data[at + 2] = this.dabs.length & 0xff
        image.data[at + 3] = 255
      }
      ctx.putImageData(image, 0, 0)
      return this.surface
    }
  }

  return { FakeWatercolorEngine }
})

vi.mock('./playground/Engine', () => ({
  WatercolorEngine: replayEngine.FakeWatercolorEngine,
}))

const PKG_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ENGINE_DIR = join(PKG_DIR, 'src', 'engine')
const PAYLOAD_DIR = join(PKG_DIR, 'src', 'payload')
// 61-02: the vector spine lands in src/vector, so the unseeded-RNG scan must
// read it from the same commit — otherwise a draw there would go unpunished.
const VECTOR_DIR = join(PKG_DIR, 'src', 'vector')
// 261030-v1t: the per-frame paint salt lives in the HOST package (the one
// determinism surface both engines share) — scan its source too.
const HOST_TRACE_SEED = resolve(PKG_DIR, '..', 'efx-paint-host', 'src', 'util', 'traceSeed.ts')

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

/**
 * 261030-v1t: the host traceSeed module NAMES `Math.random` in its doc
 * comments (the law it forbids). A raw substring scan would flag prose, so
 * strip comments before scanning for real nondeterministic sources.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
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
        createImageData: (w: number, h: number) => ({
          width: w,
          height: h,
          data: new Uint8ClampedArray(w * h * 4),
        }),
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

const PAPER_SEED = 0xc0ffee

/** mulberry32 — the same generator the adapter installs. */
function seededRandom(seed: number): () => number {
  let state = (seed | 0) || 1
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * 61-07: the constructor draws `paperSeed` from Math.random before the
 * adapter installs its own RNG — pin it around every construction or the
 * replay digests mean nothing.
 */
function withSeededMathRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random
  const rng = seededRandom(seed)
  Math.random = () => rng()
  try {
    return fn()
  } finally {
    Math.random = original
  }
}

function replayBytes(): Uint8ClampedArray {
  const width = 64
  const height = 64
  const { canvas, pixels } = makeMockCanvas(width, height)
  const adapter = withSeededMathRandom(PAPER_SEED, () =>
    createAquarelleEngineAdapter({ width, height, canvas }),
  )
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
  it('scans a non-empty src/vector root — a rename cannot silently empty the scan', () => {
    expect(statSync(VECTOR_DIR).isDirectory()).toBe(true)
    const sources = collectSources(VECTOR_DIR)
    expect(sources.length).toBeGreaterThan(0)
    expect(sources.some((file) => basename(file) === 'spine.ts')).toBe(true)
  })

  it('src/engine, src/payload and src/vector contain zero Math.random occurrences', () => {
    const engine = sourceText(ENGINE_DIR)
    const payload = sourceText(PAYLOAD_DIR)
    const vector = sourceText(VECTOR_DIR)
    expect(engine.includes('Math.random')).toBe(false)
    expect(payload.includes('Math.random')).toBe(false)
    expect(vector.includes('Math.random')).toBe(false)
  })

  it('src/engine, src/payload and src/vector contain zero crypto.getRandomValues occurrences', () => {
    const engine = sourceText(ENGINE_DIR)
    const payload = sourceText(PAYLOAD_DIR)
    const vector = sourceText(VECTOR_DIR)
    expect(engine.includes('crypto.getRandomValues')).toBe(false)
    expect(payload.includes('crypto.getRandomValues')).toBe(false)
    expect(vector.includes('crypto.getRandomValues')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 4. 261030-v1t — the per-frame paint salt stays pure
//    The salted seed rides configure() every replay; a stray nondeterministic
//    source there would break same-script-same-pixels reproduction.
// ---------------------------------------------------------------------------

describe('paint seed salt contract (261030-v1t)', () => {
  it('the host traceSeed module carries no Math.random, crypto or clock source', () => {
    const source = stripComments(readFileSync(HOST_TRACE_SEED, 'utf8'))
    expect(source.includes('Math.random')).toBe(false)
    expect(source.includes('crypto.getRandomValues')).toBe(false)
    expect(source.includes('Date.now')).toBe(false)
    expect(source.includes('performance.now')).toBe(false)
  })

  it('pins the same literal in the engine package as the host pins in its own suite', () => {
    expect(mixStrokeSeed(hashMutationId(42), 3)).toBe(179180383)
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
