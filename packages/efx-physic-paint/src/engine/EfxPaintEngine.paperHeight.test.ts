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
    // save()/loadProjectData surface (documentFormat.test.ts harness precedent).
    allActions: [],
    state: { bgMode: 'canvas1', embossStrength: 0.45, wetPaper: true },
    undoStack: [],
    redoStack: [],
    historyEntries: [],
    historyIndex: 0,
    notifyHistoryAvailability: vi.fn(),
    redrawAll: vi.fn(),
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

  it("CR-01 round-trip: paperGrain '' (grain off) survives save → load — paperHeight stays null", () => {
    // Authoring side: grain explicitly turned off, then the project serialized.
    const source = createHarness()
    source.setPaperGrain('')
    expect(source.paperHeight).toBeNull()
    const document = source.save()

    // Reload side: a fresh engine that already applied its default paper
    // (loadPaperTextures applies defaultPaper / first key unconditionally).
    const reloaded = createHarness()
    const defaultHeightMap = new Float32Array(16).fill(0.5)
    reloaded.paperTextures.set('canvas1', { heightMap: defaultHeightMap })
    reloaded.setPaperGrain('canvas1')
    expect(reloaded.paperHeight).toBe(defaultHeightMap)

    reloaded.loadProjectData(document)

    // The grain-off encoding must be re-applied, not dropped by a truthy guard.
    expect(reloaded.currentPaperKey).toBe('')
    expect(reloaded.paperHeight).toBeNull()
    expect(reloaded.texHeight).toBeNull()
    expect(reloaded.physicsHeightMap).toBeNull()
  })

  it('source shape: the procedural fbm generator is gone from paper.ts and unimported by the engine', () => {
    expect(paperSource).not.toMatch(/export function ensureHeightMap/)
    expect(engineSource).not.toContain('ensureHeightMap')
  })
})
