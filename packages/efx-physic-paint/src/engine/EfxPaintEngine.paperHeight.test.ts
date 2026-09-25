import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { EfxPaintEngine } from './EfxPaintEngine'

// 260925-dso — Pin 2: grain-off and texture-load-failure must leave paperHeight
// flat (null). No procedural fbm height map anywhere.
// Harness precedent: EfxPaintEngine.cooperativeFinalization.contract.red.test.ts
// (Object.create(prototype) + Object.assign private-poking).

type EngineInternals = EfxPaintEngine & Record<string, any>

function createHarness() {
  const engine = Object.create(EfxPaintEngine.prototype) as EngineInternals
  Object.assign(engine, {
    requestRender: vi.fn(),
    flushPendingStrokeFinalizations: vi.fn(),
    displayCompositeDirty: false,
    currentPaperKey: '',
    paperTextures: new Map<string, { heightMap: Float32Array }>(),
    width: 4,
    height: 4,
    texHeight: null,
    paperHeight: null,
    physicsHeightMap: null,
  })
  return engine
}

const paperSource = readFileSync(new URL('../core/paper.ts', import.meta.url), 'utf8')
const engineSource = readFileSync(new URL('./EfxPaintEngine.ts', import.meta.url), 'utf8')

describe('260925-dso — physics height field is flat without a paper', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("setPaperGrain('') (grain-off encoding) leaves paperHeight null", () => {
    const engine = createHarness()
    engine.setPaperGrain('')
    expect(engine.paperHeight).toBeNull()
  })

  it('setPaperGrain on a key absent from paperTextures (failed load) leaves paperHeight null', () => {
    const engine = createHarness()
    engine.setPaperGrain('texture-load-failed-key')
    expect(engine.paperHeight).toBeNull()
  })

  it('control: a loaded texture returns its exact heightMap on paperHeight, texHeight, and physicsHeightMap', () => {
    const engine = createHarness()
    const heightMap = new Float32Array(16).fill(0.5)
    engine.paperTextures.set('canvas1', { heightMap })
    engine.setPaperGrain('canvas1')
    expect(engine.paperHeight).toBe(heightMap)
    expect(engine.texHeight).toBe(heightMap)
    expect(engine.physicsHeightMap).toBe(heightMap)
  })

  it('source shape: the procedural fbm generator is gone from paper.ts and unimported by the engine', () => {
    expect(paperSource).not.toMatch(/export function ensureHeightMap/)
    expect(engineSource).not.toContain('ensureHeightMap')
  })
})
