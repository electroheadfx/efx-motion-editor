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
//  Idempotency (63-05): this package no longer mints ids — the
//  main-realm handler does, so two identical imports stay two
//  catalog rows over one content-addressed asset (that pin lives
//  in app/src/lib/efxPaintBrushImport.test.ts). Single-flight:
//  concurrent imports queue, never interleave.
//
//  Assertion style: scalar predicates (boolean/primitive toBe) so
//  TAP diagnostics stay one-line and the RED evidence classifier
//  can parse the report — vitest's object dumps break strict TAP.
// ============================================================

import { describe, expect, it } from 'vitest'
import { TIP_MASK_EDGE } from './deriveMask'
import type { AquarelleTip, AquarelleToolOverrides } from './tips'
import { NEUTRAL_TOOL_OVERRIDES, TIPS } from './tips'
import { asTipRecord, buildBrushPackSnapshot, parseBrushPackSnapshot } from './pack'
import {
  importTip,
  IMPORT_TIP_FAILURE_COPY,
  type ImportTipFile,
  type ImportTipPorts,
} from './importTip'

// ---------------------------------------------------------------------------
// Fixtures — magic-correct heads with declared extents (63-05: the import
// path reads PNG IHDR / JPEG SOF before any decode, so a bare signature is
// no longer a legal fixture).
// ---------------------------------------------------------------------------

/** PNG signature + a valid IHDR chunk declaring width×height. */
function pngWithSize(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes[11] = 13
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  bytes[18] = (width >>> 8) & 0xff
  bytes[19] = width & 0xff
  bytes[22] = (height >>> 8) & 0xff
  bytes[23] = height & 0xff
  return bytes
}

/** JPEG SOI + APP0 + SOF0 declaring width×height. */
function jpegWithSize(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >>> 8) & 0xff, height & 0xff,
    (width >>> 8) & 0xff, width & 0xff,
  ])
}

const PNG_BYTES = pngWithSize(64, 64)
const JPG_BYTES = jpegWithSize(64, 48)
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

/** A File-shaped fixture whose bytes are the supplied header. */
function fileOf(bytes: Uint8Array, name: string): ImportTipFile {
  return {
    name,
    size: bytes.length,
    arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
  }
}

/**
 * The two injected ports. `decodeOk=false` behaves like a corrupt
 * body. onEnter/onExit bracket the decode so concurrency is
 * observable — the stub yields a macrotask mid-decode so
 * unserialized imports would overlap and push maxActive above 1.
 */
function stubPorts(opts?: {
  decodeOk?: boolean
  onEnter?: () => void
  onExit?: () => void
}): { ports: ImportTipPorts; decodeCalls: () => number } {
  let calls = 0
  const ports: ImportTipPorts = {
    decode: async () => {
      calls += 1
      opts?.onEnter?.()
      await new Promise((resolve) => setTimeout(resolve, 1))
      opts?.onExit?.()
      if (opts?.decodeOk === false) return null
      return new Uint8Array(TIP_MASK_EDGE * TIP_MASK_EDGE * 4)
    },
    register: async ({ name }) => ({
      id: 'wc/custom-package-test',
      category: 'custom',
      name,
      ...NEUTRAL_TOOL_OVERRIDES,
    }),
  }
  return { ports, decodeCalls: () => calls }
}

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
  it('accepts PNG bytes and returns the registered Custom tip', async () => {
    const { ports, decodeCalls } = stubPorts()
    const result = await importTip(fileOf(PNG_BYTES, 'my-brush.png'), ports)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tip.category).toBe('custom')
    expect(result.tip.name).toBe('my-brush.png')
    const allNumeric = PROPERTY_FIELDS.every((field) => typeof result.tip[field] === 'number')
    expect(allNumeric).toBe(true)
    expect(decodeCalls()).toBe(1)
  })

  it('accepts JPG bytes and returns an ok tip', async () => {
    const { ports } = stubPorts()
    const result = await importTip(fileOf(JPG_BYTES, 'scan.jpg'), ports)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.tip.category).toBe('custom')
  })

  it('rejects garbage bytes with the named failure and does not throw', async () => {
    const { ports, decodeCalls } = stubPorts()
    const result = await importTip(fileOf(GARBAGE_BYTES, 'noise.bin'), ports)
    expect(isRejected(result)).toBe(true)
    expect(decodeCalls()).toBe(0)
  })

  it('rejects SVG text with the named failure (magic sniff, never a decode)', async () => {
    const { ports, decodeCalls } = stubPorts()
    const result = await importTip(fileOf(SVG_BYTES, 'icon.svg'), ports)
    expect(isRejected(result)).toBe(true)
    expect(decodeCalls()).toBe(0)
  })

  it('rejects an empty buffer with the named failure', async () => {
    const { ports } = stubPorts()
    const result = await importTip(fileOf(new Uint8Array(0), 'empty.png'), ports)
    expect(isRejected(result)).toBe(true)
  })

  it('maps a decoder failure to the named failure (never throws)', async () => {
    const { ports } = stubPorts({ decodeOk: false })
    const result = await importTip(fileOf(PNG_BYTES, 'corrupt.png'), ports)
    expect(isRejected(result)).toBe(true)
  })

  it('exported failure copy matches the UI-SPEC refusal line', () => {
    expect(IMPORT_TIP_FAILURE_COPY).toBe(
      'Import failed — this file is not a readable PNG or JPG. Nothing changed.',
    )
  })

  it('is single-flight: concurrent imports queue and never interleave mid-decode', async () => {
    let active = 0
    let maxActive = 0
    const { ports, decodeCalls } = stubPorts({
      onEnter: () => {
        active += 1
        maxActive = Math.max(maxActive, active)
      },
      onExit: () => {
        active -= 1
      },
    })
    const [a, b, c] = await Promise.all([
      importTip(fileOf(PNG_BYTES, 'a.png'), ports),
      importTip(fileOf(JPG_BYTES, 'b.jpg'), ports),
      importTip(fileOf(PNG_BYTES, 'c.png'), ports),
    ])
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(c.ok).toBe(true)
    expect(maxActive).toBe(1)
    expect(decodeCalls()).toBe(3)
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

// ---------------------------------------------------------------------------
// The ONE carrier (quick 261116-inu / T-63-06)
//
// The project (`.mce`) carrier is gone: a tip record is metadata plus the
// script carrier's inline `maskDataUrl` (trimmed by the next task). An `asset`
// ref is refused outright, and a member literally named `mask` is the retired
// D-23 shape.
// ---------------------------------------------------------------------------

describe('brush pack carrier (quick 261116-inu: script only)', () => {
  const DIGEST = 'a'.repeat(64)
  const ASSET = `brushes/${DIGEST}.webp`

  function customTip(id: string, extra: Record<string, unknown> = {}): AquarelleTip {
    return { ...makeTip(id, 'custom', 'Custom'), ...extra } as AquarelleTip
  }

  function parseEntries(entries: unknown[]): unknown {
    return parseBrushPackSnapshot({ kind: 'efx-watercolor', entries })
  }

  it('refuses an entry carrying a package asset ref, whatever its shape', () => {
    const badRefs = [
      ASSET,
      `brushes/${DIGEST}.png`,
      `frames/${DIGEST}.webp`,
      `brushes/${DIGEST.toUpperCase()}.webp`,
      `../brushes/${DIGEST}.webp`,
      '',
    ]
    const allRejected = badRefs.every(
      (asset) => buildBrushPackSnapshot([customTip('wc/custom-bad', { asset })]) === null,
    )
    expect(allRejected).toBe(true)
    expect(parseEntries([customTip('wc/custom-bad', { asset: ASSET })]) === null).toBe(true)
  })

  it('accepts and round-trips an entry carrying the script maskDataUrl', () => {
    const scriptTip = customTip('wc/custom-script', {
      maskDataUrl: 'data:image/png;base64,AA',
    })
    const built = buildBrushPackSnapshot([scriptTip])
    expect(built === null).toBe(false)
    if (built !== null) {
      const entry = built.entries[0] as Record<string, unknown>
      expect(entry.maskDataUrl ?? null).toBe('data:image/png;base64,AA')
    }
    const parsed = parseBrushPackSnapshot(built)
    expect(parsed === null).toBe(false)
    if (parsed === null || built === null) return
    expect(deepEqual(parsed.entries, built.entries)).toBe(true)
  })

  it('refuses the retired inline mask member', () => {
    expect(parseEntries([customTip('wc/custom-mask2', { mask: 'AAAA' })]) === null).toBe(true)
    expect(buildBrushPackSnapshot([customTip('wc/custom-mask3', { mask: 'AAAA' })]) === null).toBe(
      true,
    )
  })

  it('refuses a non-string maskDataUrl', () => {
    const bad = customTip('wc/custom-bad-url', { maskDataUrl: 42 })
    expect(buildBrushPackSnapshot([bad]) === null).toBe(true)
    expect(parseEntries([bad]) === null).toBe(true)
  })

  it('asTipRecord refuses an asset member and accepts a maskDataUrl entry', () => {
    expect(asTipRecord(customTip('wc/custom-as', { asset: ASSET })) === null).toBe(true)
    const scriptTip = customTip('wc/custom-as-script', { maskDataUrl: 'data:image/png;base64,AA' })
    expect(asTipRecord(scriptTip) === null).toBe(false)
  })
})
