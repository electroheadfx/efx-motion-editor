import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { EfxPaintEngine } from './EfxPaintEngine'

// 260925-iy6 UAT round 4 ("ralentissements quand je change de grain strenght"):
// applyBackgroundFallbackToEngine re-fires on every efxPaintVersion bump, so a
// grain-strength slider tick paid setBgMode's flush + full stroke replay plus
// two more flushes. All three setters must early-return when nothing changed.
// Harness precedent: EfxPaintEngine.paperHeight.test.ts.

type EngineInternals = EfxPaintEngine & Record<string, any>

function createHarness() {
  const engine = Object.create(EfxPaintEngine.prototype) as EngineInternals
  Object.assign(engine, {
    requestRender: vi.fn(),
    flushPendingStrokeFinalizations: vi.fn(),
    displayCompositeDirty: false,
    currentPaperKey: 'canvas1',
    paperTextures: new Map<string, { heightMap: Float32Array }>(),
    width: 4,
    height: 4,
    texHeight: null,
    paperHeight: null,
    physicsHeightMap: null,
    state: { bgMode: 'canvas1', embossStrength: 0.45, wetPaper: true },
    bgData: null,
    bgCtx: null,
    bgCanvas: null,
    redrawPreviewBase: vi.fn(),
    dualCanvas: { dryCtx: { clearRect: vi.fn(), drawImage: vi.fn() } },
    visibleBackgroundSuppressed: true,
    clearWetLayer: vi.fn(),
    fluid: { u: { fill: vi.fn() }, v: { fill: vi.fn() }, u0: { fill: vi.fn() }, v0: { fill: vi.fn() }, p: { fill: vi.fn() }, div: { fill: vi.fn() } },
    allActions: [],
    redrawAll: vi.fn(),
  })
  return engine
}

const engineSource = readFileSync(new URL('./EfxPaintEngine.ts', import.meta.url), 'utf8')

describe('260925-iy6 background setters are idempotent', () => {
  it('setBgMode early-returns on an unchanged mode without flushing or replaying', () => {
    const engine = createHarness()
    engine.setBgMode('canvas1')
    expect(engine.flushPendingStrokeFinalizations).not.toHaveBeenCalled()
    expect(engine.redrawAll).not.toHaveBeenCalled()
  })

  it('setPaperGrain early-returns on an unchanged (key, height map) pair', () => {
    const engine = createHarness()
    engine.paperHeight = null
    engine.setPaperGrain('canvas1')
    expect(engine.flushPendingStrokeFinalizations).not.toHaveBeenCalled()
  })

  it('setPaperGrain still lands a late-arriving texture for the same key', () => {
    // A call made before loadPaperTexture resolves sets the key with a null
    // map; the post-load setPaperGrain must NOT early-return.
    const engine = createHarness()
    engine.currentPaperKey = 'canvas1'
    engine.paperHeight = null
    const heightMap = new Float32Array([0.5])
    engine.paperTextures.set('canvas1', { heightMap })
    engine.setPaperGrain('canvas1')
    expect(engine.paperHeight).toBe(heightMap)
  })

  it('setEmbossStrength never flushes pending finalizations', () => {
    const engine = createHarness()
    engine.setEmbossStrength(0.9)
    expect(engine.state.embossStrength).toBe(0.9)
    expect(engine.flushPendingStrokeFinalizations).not.toHaveBeenCalled()
  })

  it('CONTROL: the setters still write through when the value actually changes', () => {
    const engine = createHarness()
    engine.setEmbossStrength(0.9)
    expect(engine.requestRender).toHaveBeenCalled()
    const grain = createHarness()
    grain.paperTextures.set('canvas2', { heightMap: new Float32Array([0.5]) })
    grain.setPaperGrain('canvas2')
    expect(grain.currentPaperKey).toBe('canvas2')
    expect(grain.flushPendingStrokeFinalizations).toHaveBeenCalled()
  })

  it('P4(c)-style guard: setEmbossStrength carries no flush call in its body', () => {
    const body = engineSource.slice(engineSource.indexOf('setEmbossStrength'), engineSource.indexOf('setEmbossStrength') + 320)
    expect(body).not.toContain('flushPendingStrokeFinalizations')
  })
})
