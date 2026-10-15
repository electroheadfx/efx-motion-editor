// ============================================================
//  Brush pack — standing pins (56-04 / AQUA-03).
//
//  Laws pinned here:
//    R1.7   brush set is a project asset: stable ids + numeric
//           toolOverrides, snapshot travels in .mce (D-23)
//    D-07   categories are a data-model field, not display grouping
//    T-56-10 importTip is total — named failure, never a throw
//    T-56-12 parseBrushPackSnapshot is total and fail-closed
//
//  Idempotency (flagged assumption, pinned): importing the same
//  PNG bytes twice creates two tips with distinct ids — no silent
//  dedupe. Single-flight: concurrent imports queue, never interleave.
//
//  Assertion style: scalar predicates (boolean/primitive toBe) so
//  TAP diagnostics stay one-line and the RED evidence classifier
//  can parse the report — vitest's object dumps break strict TAP.
// ============================================================

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AquarelleTip, AquarelleToolOverrides } from './tips'
import { TIPS } from './tips'
import { buildBrushPackSnapshot, parseBrushPackSnapshot } from './pack'
import { importTip, IMPORT_TIP_FAILURE_COPY } from './importTip'

// ---------------------------------------------------------------------------
// Fixtures — magic-byte correct heads, decoder stubbed per test (T-56-10).
// ---------------------------------------------------------------------------

/** PNG signature 89 50 4E 47 0D 0A 1A 0A. */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
/** JPEG signature FF D8 FF. */
const JPG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])
/** Random non-image bytes. */
const GARBAGE_BYTES = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
/** SVG is text — must be rejected by magic sniff, never decoded. */
const SVG_BYTES = new TextEncoder().encode(
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"></svg>',
)

const PROPERTY_FIELDS: ReadonlyArray<keyof AquarelleToolOverrides> = [
  'tip',
  'aspect',
  'rotation',
  'sizeCurve',
  'scatter',
  'capacity',
  'grain',
  'wetRound',
]

function isRejected(result: Awaited<ReturnType<typeof importTip>>): boolean {
  return result.ok === false && result.reason === 'unreadable-image'
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function makeTip(
  id: string,
  category: AquarelleTip['category'],
  name: string,
  props: Partial<AquarelleToolOverrides> = {},
): AquarelleTip {
  return {
    id,
    category,
    name,
    tip: 1,
    aspect: 1,
    rotation: 1,
    sizeCurve: 1,
    scatter: 1,
    capacity: 1,
    grain: 1,
    wetRound: 1,
    ...props,
  } as AquarelleTip
}

/**
 * Stub the browser decoder. ok=false rejects like a corrupt body.
 * onEnter/onExit bracket the decode so concurrency is observable —
 * the stub yields a macrotask mid-decode so unserialized imports
 * would overlap and push maxActive above 1.
 */
function stubDecoder(
  ok: boolean,
  opts?: { onEnter?: () => void; onExit?: () => void },
): void {
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => {
      opts?.onEnter?.()
      await new Promise((resolve) => setTimeout(resolve, 1))
      opts?.onExit?.()
      if (!ok) throw new Error('decode failed')
      return { width: 8, height: 8 }
    }),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ---------------------------------------------------------------------------
// Base tip pack — 14 categorized tips, full property surface (R1.7 / D-07)
// ---------------------------------------------------------------------------

describe('base tip pack', () => {
  it('TIPS contains exactly 14 base tips', () => {
    expect(TIPS).toHaveLength(14)
  })

  it('every base tip has non-empty id, name, and category', () => {
    const allNamed = TIPS.every(
      (tip) => tip.id.length > 0 && tip.name.length > 0 && tip.category.length > 0,
    )
    expect(allNamed).toBe(true)
  })

  it('every base tip carries all 8 property fields as numbers', () => {
    const allNumeric = TIPS.every((tip) =>
      PROPERTY_FIELDS.every(
        (field) => typeof tip[field] === 'number' && Number.isFinite(tip[field] as number),
      ),
    )
    expect(allNumeric).toBe(true)
  })

  it('exposes categories round / flat / texture / experimental in the data model', () => {
    const present = new Set(TIPS.map((tip) => tip.category))
    expect(
      present.has('round') &&
        present.has('flat') &&
        present.has('texture') &&
        present.has('experimental'),
    ).toBe(true)
  })

  it('every tip category is part of the declared data-model union', () => {
    const allowed = new Set(['round', 'flat', 'texture', 'experimental', 'custom'])
    expect(TIPS.every((tip) => allowed.has(tip.category))).toBe(true)
  })

  it('tip ids are unique within the pack', () => {
    const ids = TIPS.map((tip) => tip.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('base tip ids follow the wc/<category>-<name> stable-id convention', () => {
    expect(TIPS.every((tip) => /^wc\/(round|flat|texture|experimental)-[a-z0-9-]+$/.test(tip.id))).toBe(
      true,
    )
  })
})

// ---------------------------------------------------------------------------
// importTip — PNG/JPG ok, everything else named failure, never throws
// ---------------------------------------------------------------------------

describe('importTip', () => {
  it('accepts PNG bytes and returns a Custom tip with a fresh wc/custom- id', async () => {
    stubDecoder(true)
    const result = await importTip(PNG_BYTES, 'my-brush.png')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tip.category).toBe('custom')
    expect(/^wc\/custom-[0-9a-f]{8}$/.test(result.tip.id)).toBe(true)
    expect(result.tip.name).toBe('my-brush.png')
    const allNumeric = PROPERTY_FIELDS.every((field) => typeof result.tip[field] === 'number')
    expect(allNumeric).toBe(true)
  })

  it('accepts JPG bytes and returns an ok tip', async () => {
    stubDecoder(true)
    const result = await importTip(JPG_BYTES, 'scan.jpg')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tip.category).toBe('custom')
    expect(/^wc\/custom-[0-9a-f]{8}$/.test(result.tip.id)).toBe(true)
  })

  it('rejects garbage bytes with the named failure and does not throw', async () => {
    stubDecoder(true)
    const result = await importTip(GARBAGE_BYTES, 'noise.bin')
    expect(isRejected(result)).toBe(true)
  })

  it('rejects SVG text with the named failure (magic sniff, never a decode)', async () => {
    let decoderCalls = 0
    stubDecoder(true, {
      onEnter: () => {
        decoderCalls += 1
      },
    })
    const result = await importTip(SVG_BYTES, 'icon.svg')
    expect(isRejected(result)).toBe(true)
    expect(decoderCalls).toBe(0)
  })

  it('rejects an empty buffer with the named failure', async () => {
    stubDecoder(true)
    const result = await importTip(new Uint8Array(0), 'empty.png')
    expect(isRejected(result)).toBe(true)
  })

  it('maps a decoder failure to the named failure (never throws)', async () => {
    stubDecoder(false)
    const result = await importTip(PNG_BYTES, 'corrupt.png')
    expect(isRejected(result)).toBe(true)
  })

  it('exported failure copy matches the UI-SPEC refusal line', () => {
    expect(IMPORT_TIP_FAILURE_COPY).toBe(
      'Import failed — this file is not a readable PNG or JPG. Nothing changed.',
    )
  })

  it('importing the same bytes twice yields two tips with distinct ids (no silent dedupe)', async () => {
    stubDecoder(true)
    const first = await importTip(PNG_BYTES, 'twin.png')
    const second = await importTip(PNG_BYTES, 'twin.png')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.tip.id === second.tip.id).toBe(false)
  })

  it('is single-flight: concurrent imports queue and never interleave mid-decode', async () => {
    let active = 0
    let maxActive = 0
    stubDecoder(true, {
      onEnter: () => {
        active += 1
        maxActive = Math.max(maxActive, active)
      },
      onExit: () => {
        active -= 1
      },
    })
    const [a, b, c] = await Promise.all([
      importTip(PNG_BYTES, 'a.png'),
      importTip(JPG_BYTES, 'b.jpg'),
      importTip(PNG_BYTES, 'c.png'),
    ])
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(c.ok).toBe(true)
    expect(maxActive).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// BrushPackSnapshot — serializable, round-trips, fail-closed on duplicates
// ---------------------------------------------------------------------------

describe('brush pack snapshot', () => {
  it('buildBrushPackSnapshot returns kind efx-watercolor with entries deep-equal to the tips', () => {
    const snapshot = buildBrushPackSnapshot(TIPS)
    expect(snapshot === null).toBe(false)
    if (snapshot === null) return
    expect(snapshot.kind).toBe('efx-watercolor')
    expect(deepEqual(snapshot.entries, TIPS)).toBe(true)
  })

  it('snapshot is JSON-serializable without loss (mce carrier prep)', () => {
    const snapshot = buildBrushPackSnapshot(TIPS)
    expect(snapshot === null).toBe(false)
    if (snapshot === null) return
    const revived = JSON.parse(JSON.stringify(snapshot))
    expect(deepEqual(revived, snapshot)).toBe(true)
  })

  it('parseBrushPackSnapshot round-trips a built snapshot deep-equal', () => {
    const snapshot = buildBrushPackSnapshot(TIPS)
    expect(snapshot === null).toBe(false)
    if (snapshot === null) return
    const parsed = parseBrushPackSnapshot(snapshot)
    expect(parsed === null).toBe(false)
    if (parsed === null) return
    expect(deepEqual(parsed, snapshot)).toBe(true)
  })

  it('an empty entries array is a valid snapshot (parse total)', () => {
    const built = buildBrushPackSnapshot([])
    expect(built === null).toBe(false)
    if (built === null) return
    expect(built.kind).toBe('efx-watercolor')
    expect(built.entries.length).toBe(0)
    const parsed = parseBrushPackSnapshot({ kind: 'efx-watercolor', entries: [] })
    expect(parsed === null).toBe(false)
    if (parsed === null) return
    expect(parsed.entries.length).toBe(0)
  })

  it('entries round-trip in insertion order; category comes from the field, never position', () => {
    const interleaved = [
      makeTip('wc/round-a', 'round', 'A'),
      makeTip('wc/texture-a', 'texture', 'B'),
      makeTip('wc/flat-a', 'flat', 'C'),
      makeTip('wc/round-b', 'round', 'D'),
    ]
    const snapshot = buildBrushPackSnapshot(interleaved)
    expect(snapshot === null).toBe(false)
    if (snapshot === null) return
    const builtIds = snapshot.entries.map((entry) => (entry as AquarelleTip).id).join(',')
    expect(builtIds).toBe('wc/round-a,wc/texture-a,wc/flat-a,wc/round-b')
    const parsed = parseBrushPackSnapshot(snapshot)
    expect(parsed === null).toBe(false)
    if (parsed === null) return
    const parsedCategories = parsed.entries.map((entry) => (entry as AquarelleTip).category).join(',')
    expect(parsedCategories).toBe('round,texture,flat,round')
  })

  it('buildBrushPackSnapshot fails closed on duplicate ids (never a silent overwrite)', () => {
    const dup = [
      makeTip('wc/round-dup', 'round', 'One'),
      makeTip('wc/round-dup', 'round', 'Two'),
    ]
    expect(buildBrushPackSnapshot(dup) === null).toBe(true)
  })

  it('parseBrushPackSnapshot fails closed on duplicate entry ids', () => {
    const raw = {
      kind: 'efx-watercolor',
      entries: [makeTip('wc/round-dup', 'round', 'One'), makeTip('wc/round-dup', 'round', 'Two')],
    }
    expect(parseBrushPackSnapshot(raw) === null).toBe(true)
  })

  it('parseBrushPackSnapshot is total over malformed shapes (null, never a throw)', () => {
    const malformed: unknown[] = [
      null,
      undefined,
      42,
      'efx-watercolor',
      [],
      {},
      { kind: 'other-pack', entries: [] },
      { kind: 'efx-watercolor' },
      { kind: 'efx-watercolor', entries: 'nope' },
      { kind: 'efx-watercolor', entries: [null] },
      { kind: 'efx-watercolor', entries: [{ id: 'x' }] },
      {
        kind: 'efx-watercolor',
        entries: [
          {
            id: '',
            category: 'round',
            name: 'Empty id',
            tip: 1,
            aspect: 1,
            rotation: 1,
            sizeCurve: 1,
            scatter: 1,
            capacity: 1,
            grain: 1,
            wetRound: 1,
          },
        ],
      },
    ]
    const allNull = malformed.every((raw) => parseBrushPackSnapshot(raw) === null)
    expect(allNull).toBe(true)
  })
})
