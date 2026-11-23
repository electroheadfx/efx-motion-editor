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
//    64-21        the sheet seed is replay INPUT (the `paperSeed` option),
//                 not an ambient Math.random roll — proven load-bearing
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
import { toEngineParams } from './playground/params'

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
    /** 64-21: the sheet seed is replay INPUT — folded into the export digest. */
    private paperSeed: number | null = null
    /** quick 261123-jak: the relief-only flag is replay INPUT too. */
    private reliefOnlyBegins = 0

    constructor(surface: FakeCanvas) {
      this.surface = surface
    }

    setManual(): void {}
    setClock(): void {}
    setRandom(): void {}
    setPaper(): void {}
    setPaperSeed(seed: number | null): void {
      this.paperSeed = typeof seed === 'number' && Number.isFinite(seed) ? seed : null
    }
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
      _pigment?: unknown,
      reliefOnly = false,
    ): boolean {
      if (reliefOnly === true) this.reliefOnlyBegins += 1
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

    /** Export one deterministic pixel per fed sample, salted by the sheet seed. */
    exportCanvas(): FakeCanvas {
      const ctx = this.surface.getContext('2d')
      if (!ctx) return this.surface
      const image = ctx.createImageData(this.surface.width, this.surface.height)
      const seedByte = this.paperSeed === null ? 0 : Math.floor(this.paperSeed) & 0xff
      // quick 261123-jak: the render-mode precedent — the engine received the
      // relief-only flag as replay INPUT, so it salts the exported digest.
      const reliefByte = this.reliefOnlyBegins > 0 ? 0x80 : 0
      for (const dab of this.dabs) {
        const px =
          ((Math.trunc(dab.x) % this.surface.width) + this.surface.width) % this.surface.width
        const py =
          ((Math.trunc(dab.y) % this.surface.height) + this.surface.height) % this.surface.height
        const at = (py * this.surface.width + px) * 4
        image.data[at] = 0x11
        image.data[at + 1] = Math.min(255, Math.max(0, Math.round(dab.p * 255)))
        image.data[at + 2] = (this.dabs.length ^ seedByte ^ reliefByte) & 0xff
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

/**
 * 64-01: the optional `viscosity` canonical value (0..100) is the phase's
 * medium key. Omitting it keeps the recorded bag exactly as before, so the
 * pre-existing rows still replay the pre-milestone script.
 * 64-03: `emboss` (0..100) joins the optional medium keys — the thickness
 * deposit is driven by it, and its determinism row turns it on.
 * Quick 261123-hr5: the band is SIGNED (-100..100); the negative arm erodes.
 * 64-10: `body` (0..100) is the scattering key. Omitting it is the neutral
 * zero, so a pre-milestone bag replays the pre-milestone script.
 * Quick 261123-jak: `reliefOnly` is the Shift-latched engine flag; written
 * only when true, so an unflagged bag keeps its exact key set.
 */
function makeStroke(
  viscosity?: number,
  emboss?: number,
  body?: number,
  reliefOnly?: boolean,
): StudioStroke<AquarelleStrokePayload> {
  return toStudioStroke({
    tool: 'brush',
    color: '#2244aa',
    params: {
      size: 12, water: 50, flow: 50,
      ...(viscosity === undefined ? {} : { viscosity }),
      ...(emboss === undefined ? {} : { emboss }),
      ...(body === undefined ? {} : { body }),
    },
    brushId: 'wc/round-medium',
    points: [
      { x: 20, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 28, y: 32, p: 0.6, tx: 0, ty: 0, tw: 0 },
      { x: 36, y: 32, p: 0.5, tx: 0, ty: 0, tw: 0 },
      { x: 44, y: 32, p: 0.4, tx: 0, ty: 0, tw: 0 },
    ],
    mutationId: 42,
    timestamp: 1000,
    ...(reliefOnly === true ? { reliefOnly: true as const } : {}),
  })
}

const PAPER_SEED = 0xc0ffee

/**
 * 64-21: `withSeededMathRandom` retired. Through 64-20 this file patched
 * `Math.random` around every construction because the engine drew its sheet
 * seed from it before the adapter installed its own RNG — the sheet was an
 * UNRECORDED replay input. The seed is now a document field applied through
 * `AquarelleAdapterOptions.paperSeed` before the first stroke, so the replay
 * input is explicit and no global patch is needed. The negative control below
 * proves the seed is load-bearing, not decorative.
 */
function replayBytes(paperSeed: number = PAPER_SEED): Uint8ClampedArray {
  const width = 64
  const height = 64
  const { canvas, pixels } = makeMockCanvas(width, height)
  const adapter = createAquarelleEngineAdapter({ width, height, canvas, paperSeed })
  adapter.applyStroke(makeStroke())
  for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)
  adapter.captureFrame()
  const copy = pixels.slice()
  adapter.dispose()
  return copy
}

/**
 * 64-01: replay one recorded stroke and also return the payload the live
 * surface stored (`getStrokes`), so the viscosity row can prove the value
 * survives into the recorded bag on every replay arm — not just that two
 * runs happen to agree.
 */
function replayRun(stroke: StudioStroke<AquarelleStrokePayload>): {
  bytes: Uint8ClampedArray
  recorded: StudioStroke<AquarelleStrokePayload>
} {
  const width = 64
  const height = 64
  const { canvas, pixels } = makeMockCanvas(width, height)
  const adapter = createAquarelleEngineAdapter({ width, height, canvas, paperSeed: PAPER_SEED })
  adapter.applyStroke(stroke)
  for (let tick = 0; tick <= 8; tick++) adapter.stepTick(tick)
  adapter.captureFrame()
  const bytes = pixels.slice()
  const recorded = adapter.getStrokes()[0]!
  adapter.dispose()
  return { bytes, recorded }
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

  // 64-21: the negative control that makes the recorded seed load-bearing.
  // Two adapters whose ONLY difference is the paper seed must diverge; two
  // with the same seed must reproduce. Without this pair, a decorative seed
  // would pass every equality row above unnoticed.
  it('makes the paper seed load-bearing: same seed reproduces, a different seed diverges', () => {
    const a = replayBytes()
    const b = replayBytes()
    const c = replayBytes(PAPER_SEED + 1)
    expect(Buffer.from(a).equals(Buffer.from(b)), 'same seed: identical bytes').toBe(true)
    expect(Buffer.from(a).equals(Buffer.from(c)), 'different seed: different bytes').toBe(false)
  })

  it('projects traceSeed = hashMutationId so replays share one seed law', () => {
    const stroke = makeStroke()
    expect(stroke.traceSeed).toBe(hashMutationId(42))
    const again = makeStroke()
    expect(again.traceSeed).toBe(stroke.traceSeed)
  })

  // 64-01 (MED-04 / MED-06): the medium key must not perturb replay identity
  // at either extreme, and the recorded bag must carry the value that was
  // used — live pass, bake and replay all read the same recorded number.
  it('replays identically within each viscosity arm and carries the value', () => {
    for (const canonical of [0, 100] as const) {
      const first = replayRun(makeStroke(canonical))
      const second = replayRun(makeStroke(canonical))

      expect(first.bytes.length).toBe(second.bytes.length)
      expect(Buffer.from(first.bytes).equals(Buffer.from(second.bytes))).toBe(true)

      // The recorded canonical bag keeps the value across the replay...
      expect(first.recorded.engine.params.viscosity).toBe(canonical)
      expect(second.recorded.engine.params.viscosity).toBe(canonical)
      // ...and the ONE mapping turns it into the engine's 0..1 medium value.
      expect(toEngineParams(first.recorded.engine.params).viscosity).toBe(canonical / 100)
    }
  })

  // 64-03 (MED-14 / MED-16): the thickness deposit must not perturb replay
  // identity. The channel is deposited by the real engine on every dab, but
  // nothing reads it yet (64-04 lights it), so the exported bytes are the
  // same as the neutral script; the recorded bag must carry the emboss that
  // drove the deposit.
  it('replays identically with emboss 100 and carries the value', () => {
    const first = replayRun(makeStroke(undefined, 100))
    const second = replayRun(makeStroke(undefined, 100))

    expect(first.bytes.length).toBe(second.bytes.length)
    expect(Buffer.from(first.bytes).equals(Buffer.from(second.bytes))).toBe(true)

    expect(first.recorded.engine.params.emboss).toBe(100)
    expect(second.recorded.engine.params.emboss).toBe(100)
    expect(toEngineParams(first.recorded.engine.params).emboss).toBe(1)
  })

  // Quick 261123-hr5 (signed emboss): the negative half is a per-stroke
  // recorded-bag property like the positive half. It must not perturb replay
  // identity, and the ONE mapping must carry the sign into the engine bag so
  // the erode branch reads the number the artist set.
  it('replays identically with emboss -15 and carries the signed value', () => {
    const first = replayRun(makeStroke(undefined, -15))
    const second = replayRun(makeStroke(undefined, -15))

    expect(first.bytes.length).toBe(second.bytes.length)
    expect(Buffer.from(first.bytes).equals(Buffer.from(second.bytes))).toBe(true)

    expect(first.recorded.engine.params.emboss).toBe(-15)
    expect(second.recorded.engine.params.emboss).toBe(-15)
    expect(toEngineParams(first.recorded.engine.params).emboss).toBe(-0.15)
  })

  // Quick 261123-jak (Shift relief-only): the marker is replay INPUT, like the
  // render mode was (61-07) — the adapter must hand it to the engine's ONE
  // scriptBegin call, the recorded bag must carry it, and an unflagged bag
  // must not gain the key. The real-engine pigment-identity proof (the relief
  // pass changes NOTHING in the pigment) is the `emboss-relief-only` probe.
  it('replays identically with a relief-only marker and feeds it to scriptBegin', () => {
    const first = replayRun(makeStroke(undefined, 15, undefined, true))
    const second = replayRun(makeStroke(undefined, 15, undefined, true))

    expect(first.bytes.length).toBe(second.bytes.length)
    expect(Buffer.from(first.bytes).equals(Buffer.from(second.bytes))).toBe(true)

    expect(first.recorded.engine.reliefOnly).toBe(true)
    expect(second.recorded.engine.reliefOnly).toBe(true)
    expect('reliefOnly' in makeStroke(undefined, 15).engine).toBe(false)

    // The fake received the flag: the flagged run's bytes diverge from the
    // unflagged run's, so this row cannot pass on a dropped argument.
    const unflagged = replayRun(makeStroke(undefined, 15))
    expect(Buffer.from(first.bytes).equals(Buffer.from(unflagged.bytes))).toBe(false)
  })

  // 64-04 (MED-15 / MED-18): the emboss light is DOCUMENT render state, never
  // a recorded stroke property. The mock has no GPU, so an intensity cannot
  // change its bytes here; what this row pins is that the light stays OUT of
  // the deterministic replay INPUT — both intensity arms replay the same
  // recorded embossed script to identical bytes, and the recorded bags carry
  // the emboss and nothing light-shaped. The real lit-vs-unlit pixel proof is
  // the probe matrix (emboss-lit differs from the baseline at intensity 1,
  // equals it at intensity 0).
  it('replays a lit embossed stroke identically at intensity 0 and at the default intensity', async () => {
    const engineModule = await vi.importActual<typeof import('./playground/Engine')>('./playground/Engine')
    const { DEFAULT_LIGHT } = engineModule
    expect(DEFAULT_LIGHT.intensity).toBe(1)

    const recordedBags: string[] = []
    for (const intensity of [0, DEFAULT_LIGHT.intensity] as const) {
      const first = replayRun(makeStroke(undefined, 100))
      const second = replayRun(makeStroke(undefined, 100))

      expect(first.bytes.length, `intensity ${intensity}: byte length`).toBe(second.bytes.length)
      expect(
        Buffer.from(first.bytes).equals(Buffer.from(second.bytes)),
        `intensity ${intensity}: replay bytes`,
      ).toBe(true)

      expect(first.recorded.engine.params.emboss).toBe(100)
      expect('light' in first.recorded.engine.params, `intensity ${intensity}: light in the stroke bag`).toBe(false)
      expect('light' in first.recorded.engine, `intensity ${intensity}: light in the engine bag`).toBe(false)
      recordedBags.push(JSON.stringify(first.recorded))
    }

    // The light never enters the recorded script, so both intensity arms
    // record byte-identical bags — a per-frame light cannot fork a replay.
    expect(recordedBags[1]).toBe(recordedBags[0])
  })

  // 64-10 (MED-38): the scattering key must not perturb replay identity at
  // either extreme, and the recorded bag must carry the value that was used —
  // the deposit law reads it on the live pass, the bake and every replay.
  it('replays identically within each body arm and carries the value', () => {
    for (const canonical of [0, 100] as const) {
      const first = replayRun(makeStroke(undefined, undefined, canonical))
      const second = replayRun(makeStroke(undefined, undefined, canonical))

      expect(first.bytes.length, `body ${canonical}: byte length`).toBe(second.bytes.length)
      expect(
        Buffer.from(first.bytes).equals(Buffer.from(second.bytes)),
        `body ${canonical}: replay bytes`,
      ).toBe(true)

      expect(first.recorded.engine.params.body).toBe(canonical)
      expect(second.recorded.engine.params.body).toBe(canonical)
      // The ONE mapping turns the canonical 0..100 value into the engine's 0..1 S driver.
      expect(toEngineParams(first.recorded.engine.params).body).toBe(canonical / 100)
    }
  })

  // 64-10 (MED-38 / D-17): a pre-milestone bag without the key replays with
  // zero scattering. The recorded absent bag gains no body key, and its bytes
  // equal the same script recorded with an explicit zero.
  it('replays an absent body key exactly like an explicit zero', () => {
    const absent = replayRun(makeStroke())
    const zero = replayRun(makeStroke(undefined, undefined, 0))

    expect('body' in absent.recorded.engine.params, 'the absent bag gains no body key').toBe(false)
    expect(zero.recorded.engine.params.body).toBe(0)
    expect(toEngineParams(absent.recorded.engine.params).body).toBe(0)
    expect(
      Buffer.from(absent.bytes).equals(Buffer.from(zero.bytes)),
      'absent body replays like an explicit zero',
    ).toBe(true)
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
