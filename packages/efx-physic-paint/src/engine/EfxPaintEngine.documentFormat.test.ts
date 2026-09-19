import { afterEach, describe, expect, it, vi } from 'vitest'
import { EfxPaintEngine } from './EfxPaintEngine'

type EngineInternals = EfxPaintEngine & Record<string, any>

/**
 * Distinct pre-v1.0 unsupported copy (same semantics as the app-side
 * LOAD_STATE_UNSUPPORTED_VERSION_COPY): a recognized legacy version:2
 * session is rejected explicitly, never converted or partially read.
 */
const UNSUPPORTED_COPY = 'This file is a pre-v1.0 Physics Paint session, which v1.0.0 does not support. Choose a state file exported from the current version of Physics Paint.'
/** Generic invalid copy for malformed or unrecognized payloads. */
const INVALID_COPY = 'This file is not a valid Physics Paint state JSON. Choose a state file exported from Physics Paint.'

afterEach(() => {
  vi.restoreAllMocks()
})

function makeRecordedStroke(overrides: Record<string, unknown> = {}) {
  return {
    mutationId: 800,
    tool: 'paint',
    points: [
      { x: 1, y: 2, p: 0.25, tx: 3, ty: 4, tw: 5, spd: 6 },
      { x: 7, y: 8, p: 0.75, tx: 9, ty: 10, tw: 11, spd: 12 },
    ],
    color: '#123456',
    params: { size: 6, opacity: 100, pressure: 70, waterAmount: 50, dryAmount: 30, edgeDetail: 4, pickup: 0, eraseStrength: 50, antiAlias: 0 },
    timestamp: 1234,
    hasPenInput: true,
    playFrame: 7,
    physicsMode: 'local',
    ...overrides,
  }
}

function createEngineHarness() {
  const engine = Object.create(EfxPaintEngine.prototype) as EngineInternals
  Object.assign(engine, {
    width: 1920,
    height: 1080,
    allActions: [],
    state: { bgMode: 'canvas1', embossStrength: 0.45, wetPaper: true },
    currentPaperKey: 'canvas1',
    paperTextures: new Map(),
    undoStack: [],
    redoStack: [],
    historyEntries: [],
    historyIndex: 0,
    flushPendingStrokeFinalizations: vi.fn(),
    notifyHistoryAvailability: vi.fn(),
    redrawAll: vi.fn(),
    setPaperGrain: vi.fn((key: string) => { engine.currentPaperKey = key }),
  })
  return engine
}

/** Well-formed legacy pre-v1.0 session shape (version: 2, strokes/settings). */
const legacyState = {
  version: 2,
  width: 1000,
  height: 650,
  strokes: [],
  settings: { bgMode: 'canvas1', paperGrain: 'canvas1', embossStrength: 0.45, wetPaper: true },
}

describe('EfxPaintEngine v1.0 document format', () => {
  it('save() emits a v1.0 document-shaped payload and load() restores engine state from the default track', () => {
    const engine = createEngineHarness()
    engine.allActions = [makeRecordedStroke()]
    const document = engine.save()
    expect(document.version).toBe(1)
    expect(document.parentLayerId).toBe('standalone')
    expect(document.documentRevision).toBe(0)
    expect(document.activeTrackId).toBe('track-1')
    expect(document.tracks).toHaveLength(1)
    expect(document.tracks[0]).toMatchObject({
      id: 'track-1',
      name: 'Track 1',
      order: 0,
      visible: true,
      solo: false,
      opacity: 1,
      blendMode: 'normal',
      revision: 0,
    })
    expect(document.tracks[0].strokes).toHaveLength(1)
    expect(document.tracks[0].strokes?.[0]).toMatchObject({
      tool: 'paint',
      color: '#123456',
      time: 1234,
      hasPenInput: true,
      playFrame: 7,
      physicsMode: 'local',
    })
    expect(document.tracks[0].settings).toMatchObject({
      bgMode: 'canvas1',
      paperGrain: 'canvas1',
      embossStrength: 0.45,
      wetPaper: true,
    })
    expect(document.background).toMatchObject({ fallback: { mode: 'transparent' }, visible: true })
    expect(document.photoReference).toBeNull()
    expect(document.compositeRevision).toBe(0)

    const restored = createEngineHarness()
    restored.load(document)
    expect(restored.allActions).toHaveLength(1)
    expect(restored.allActions[0]).toMatchObject({
      tool: 'paint',
      color: '#123456',
      timestamp: 1234,
      hasPenInput: true,
      playFrame: 7,
      physicsMode: 'local',
    })
    expect(restored.allActions[0].points).toEqual([
      { x: 1, y: 2, p: 0.25, tx: 3, ty: 4, tw: 5, spd: 6 },
      { x: 7, y: 8, p: 0.75, tx: 9, ty: 10, tw: 11, spd: 12 },
    ])
    expect(restored.state.embossStrength).toBe(0.45)
    expect(restored.state.wetPaper).toBe(true)
    expect(restored.currentPaperKey).toBe('canvas1')
  })

  it('load() rejects a legacy version:2 payload with the distinct pre-v1.0 unsupported error', () => {
    const engine = createEngineHarness()
    expect(() => engine.load(legacyState as never)).toThrow(UNSUPPORTED_COPY)
    expect(UNSUPPORTED_COPY).toContain('pre-v1.0')
    expect(UNSUPPORTED_COPY).not.toBe(INVALID_COPY)
    expect(engine.allActions).toEqual([])
  })

  it('load() rejects malformed payloads fail-closed with the generic invalid error before mutating state', () => {
    const engine = createEngineHarness()
    expect(() => engine.load({ version: 1 } as never)).toThrow(INVALID_COPY)
    expect(() => engine.load({
      version: 1,
      parentLayerId: 'x',
      documentRevision: 0,
      activeTrackId: 'track-1',
      tracks: [],
      background: { id: 'bg', clips: [], fallback: { mode: 'transparent' }, visible: true, revision: 0 },
      photoReference: null,
      compositeRevision: 0,
      unknownMember: true,
    } as never)).toThrow(INVALID_COPY)
    expect(() => engine.load({
      version: 1,
      parentLayerId: 'x',
      documentRevision: 0,
      activeTrackId: 'missing',
      tracks: [{ id: 'track-1', name: 'Track 1', order: 0, visible: true, solo: false, opacity: 1, blendMode: 'normal', revision: 0 }],
      background: { id: 'bg', clips: [], fallback: { mode: 'transparent' }, visible: true, revision: 0 },
      photoReference: null,
      compositeRevision: 0,
    } as never)).toThrow(INVALID_COPY)
    expect(engine.allActions).toEqual([])
  })
})
