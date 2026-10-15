// ============================================================
//  RED/GREEN coverage for typed host script refusals (D-09/D-11/D-14).
//  Host stays UI-free: codes only, never a user-facing sentence.
// ============================================================

import { describe, expect, it } from 'vitest'
import type { HostScriptRefusal, HostScriptRefusalCode } from './refusal'

type ClassifyFn = (raw: unknown) => HostScriptRefusalCode | null

async function loadClassify(): Promise<ClassifyFn | undefined> {
  try {
    const mod = await import('./refusal')
    return (mod as { classifyEnvelopeParseFailure?: ClassifyFn }).classifyEnvelopeParseFailure
  } catch {
    return undefined
  }
}

const LEGACY_KIND = 'efx-physics-paint-roto-script'
const ENVELOPE_KIND = 'efx-studio-paint-script'

function envelopeHeader(engineId: string): Record<string, unknown> {
  return {
    kind: ENVELOPE_KIND,
    schemaVersion: 1,
    engineId,
    id: '123e4567-e89b-42d3-a456-426614174000',
    name: 'Preset',
    createdAt: '2026-07-16T12:00:00.000Z',
    updatedAt: '2026-07-16T12:00:00.000Z',
    source: { projectName: 'P', layerId: 'l', layerName: 'L', sourceFrame: 0, displayFrame: 0, width: 1, height: 1 },
    thumbnail: { mimeType: 'image/webp', width: 1, height: 1, quality: 0.8, dataUrl: 'data:image/webp;base64,AA==' },
    brushPack: { kind: 'efx-physic-paint', entries: [] },
    strokes: [],
  }
}

describe('host script refusal codes (D-09 UI-free / D-14 clean break)', () => {
  it('./refusal must export classifyEnvelopeParseFailure', async () => {
    const classify = await loadClassify()
    expect(classify, './refusal must export classifyEnvelopeParseFailure').toBeTypeOf('function')
  })

  it('classifyEnvelopeParseFailure maps a legacy-kind object to unreadable-legacy-script', async () => {
    const classify = await loadClassify()
    expect(classify).toBeTypeOf('function')
    expect(classify!({ kind: LEGACY_KIND, schemaVersion: 1, brushes: [] })).toBe('unreadable-legacy-script')
    expect(classify!({ kind: LEGACY_KIND })).toBe('unreadable-legacy-script')
  })

  it('classifyEnvelopeParseFailure maps an unknown engineId to unknown-engine-id', async () => {
    const classify = await loadClassify()
    expect(classify).toBeTypeOf('function')
    expect(classify!({ ...envelopeHeader('other-engine') })).toBe('unknown-engine-id')
  })

  it('classifyEnvelopeParseFailure maps garbage to malformed-engine-payload', async () => {
    const classify = await loadClassify()
    expect(classify).toBeTypeOf('function')
    expect(classify!(null)).toBe('malformed-engine-payload')
    expect(classify!(undefined)).toBe('malformed-engine-payload')
    expect(classify!('nope')).toBe('malformed-engine-payload')
    expect(classify!({})).toBe('malformed-engine-payload')
    expect(classify!({ kind: ENVELOPE_KIND })).toBe('malformed-engine-payload')
    expect(classify!({ ...envelopeHeader('efx-physic-paint'), schemaVersion: 2 })).toBe('malformed-engine-payload')
    expect(classify!({ ...envelopeHeader('efx-physic-paint'), id: 'not-a-uuid' })).toBe('malformed-engine-payload')
  })

  it('classifyEnvelopeParseFailure returns null when the envelope header parses', async () => {
    const classify = await loadClassify()
    expect(classify).toBeTypeOf('function')
    expect(classify!({ ...envelopeHeader('efx-physic-paint') })).toBeNull()
    expect(classify!({ ...envelopeHeader('efx-watercolor') })).toBeNull()
    expect(classify!({ ...envelopeHeader('efx-krita') })).toBeNull()
  })

  it('HostScriptRefusal carries code + optional detail and no user-facing English sentence field', async () => {
    // Constructing a refusal-shaped object is the contract under test (UI-free).
    // The module may not exist yet (RED) — the assertion below is the named door.
    const classify = await loadClassify()
    expect(classify, './refusal must export classifyEnvelopeParseFailure before refusal shape can be pinned').toBeTypeOf('function')
    const refusal: HostScriptRefusal = { code: 'unreadable-legacy-script' }
    expect(Object.keys(refusal).sort()).toEqual(['code'])
    const withDetail: HostScriptRefusal = { code: 'malformed-engine-payload', detail: 'kind' }
    expect(Object.keys(withDetail).sort()).toEqual(['code', 'detail'])
    expect(typeof withDetail.detail).toBe('string')
    for (const forbidden of ['message', 'error', 'sentence', 'text', 'label', 'title', 'description'] as const) {
      expect(forbidden in refusal).toBe(false)
    }
  })
})
