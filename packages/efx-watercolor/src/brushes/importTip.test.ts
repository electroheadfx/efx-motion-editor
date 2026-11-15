// ============================================================
//  63-05 Task 2 — import caps, header sniffing and the named
//  failure (TIP-02 / TIP-04 / TIP-10 / T-63-16).
//
//  Laws pinned here:
//    1. IMPORT_TIP_MAX_BYTES is enforced on the File BEFORE its
//       bytes are read; exactly 64 MB is allowed.
//    2. IMPORT_TIP_MAX_PIXELS is enforced on header dimensions
//       BEFORE the decode; exactly 64 MP is allowed.
//    3. A truncated PNG IHDR / a JPEG with no SOF is refused as
//       unreadable and never throws.
//    4. The decode port must return exactly 192×192 RGBA; any
//       other size is unreadable.
//    5. deriveMask is the ONE conversion; the mask reaches the
//       registration port as 36,864 bytes.
//    6. Single-flight serializes concurrent imports and every
//       outcome (including a rejection) is delivered.
//
//  Assertion style: scalar predicates so TAP diagnostics stay
//  one-line and the RED evidence classifier can parse the report.
// ============================================================

import { describe, expect, it } from 'vitest'
import { TIP_SIZE } from '../playground/brushes'
import { TIP_MASK_BYTES } from './deriveMask'
import { NEUTRAL_TOOL_OVERRIDES, type AquarelleTip } from './tips'
import {
  IMPORT_TIP_MAX_BYTES,
  IMPORT_TIP_MAX_PIXELS,
  importTip,
  readImageDimensions,
  type ImportTipFile,
  type ImportTipPorts,
} from './importTip'

const TIP_PIXELS = TIP_SIZE * TIP_SIZE
const RGBA_BYTES = TIP_PIXELS * 4

// ---------------------------------------------------------------------------
// Fixtures — hand-built headers with valid magic and declared extents.
// ---------------------------------------------------------------------------

/** PNG signature + a valid 13-byte IHDR chunk carrying width/height. */
function pngWithSize(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes[8] = 0
  bytes[9] = 0
  bytes[10] = 0
  bytes[11] = 13
  bytes.set([0x49, 0x48, 0x44, 0x52], 12)
  bytes[16] = (width >>> 24) & 0xff
  bytes[17] = (width >>> 16) & 0xff
  bytes[18] = (width >>> 8) & 0xff
  bytes[19] = width & 0xff
  bytes[20] = (height >>> 24) & 0xff
  bytes[21] = (height >>> 16) & 0xff
  bytes[22] = (height >>> 8) & 0xff
  bytes[23] = height & 0xff
  return bytes
}

/** JPEG SOI + APP0 + SOF0 declaring width/height. */
function jpegWithSize(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x04, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (height >>> 8) & 0xff, height & 0xff,
    (width >>> 8) & 0xff, width & 0xff,
  ])
}

function fileOf(bytes: Uint8Array, name: string, declaredSize = bytes.length): ImportTipFile {
  return {
    name,
    size: declaredSize,
    arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
  }
}

function transparentRgba(): Uint8Array {
  return new Uint8Array(RGBA_BYTES)
}

function alphaRgba(alpha: number): Uint8Array {
  const rgba = new Uint8Array(RGBA_BYTES)
  for (let pixel = 0; pixel < TIP_PIXELS; pixel += 1) {
    rgba[pixel * 4] = 200
    rgba[pixel * 4 + 1] = 100
    rgba[pixel * 4 + 2] = 50
    rgba[pixel * 4 + 3] = alpha
  }
  return rgba
}

function makeTip(name: string): AquarelleTip {
  return { id: 'wc/custom-package-test', category: 'custom', name, ...NEUTRAL_TOOL_OVERRIDES }
}

interface StubPortOptions {
  /** One result per decode call; `undefined` yields a transparent RGBA buffer. */
  readonly rgbaResults?: Array<Uint8Array | null>
  readonly onEnter?: () => void
  readonly onExit?: () => void
}

function stubPorts(options: StubPortOptions = {}): {
  ports: ImportTipPorts
  decodeCalls: () => number
  registered: Array<{ mask: Uint8Array; name: string }>
} {
  let calls = 0
  const registered: Array<{ mask: Uint8Array; name: string }> = []
  const ports: ImportTipPorts = {
    decode: async () => {
      const index = calls
      calls += 1
      options.onEnter?.()
      await new Promise((resolve) => setTimeout(resolve, 1))
      options.onExit?.()
      if (options.rgbaResults !== undefined) {
        return options.rgbaResults[index] === undefined ? null : options.rgbaResults[index]!
      }
      return transparentRgba()
    },
    register: async ({ mask, name }) => {
      registered.push({ mask, name })
      return makeTip(name)
    },
  }
  return { ports, decodeCalls: () => calls, registered }
}

// ---------------------------------------------------------------------------
// readImageDimensions — structural, bounded, total
// ---------------------------------------------------------------------------

describe('readImageDimensions', () => {
  it('reads PNG IHDR width and height', () => {
    expect(readImageDimensions(pngWithSize(1920, 1080))).toEqual({ width: 1920, height: 1080 })
  })

  it('reads JPEG SOF0 width and height', () => {
    expect(readImageDimensions(jpegWithSize(640, 480))).toEqual({ width: 640, height: 480 })
  })

  it('returns null for a truncated IHDR', () => {
    expect(readImageDimensions(pngWithSize(64, 64).slice(0, 20))).toBe(null)
  })

  it('returns null for a JPEG with no SOF segment', () => {
    expect(readImageDimensions(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(null)
  })

  it('returns null for foreign bytes and for empty input', () => {
    expect(readImageDimensions(new TextEncoder().encode('<svg></svg>'))).toBe(null)
    expect(readImageDimensions(new Uint8Array(0))).toBe(null)
  })

  it('declares the oversize frame it was given (caps are the caller’s law)', () => {
    expect(readImageDimensions(pngWithSize(8000, 9000))).toEqual({ width: 8000, height: 9000 })
  })
})

// ---------------------------------------------------------------------------
// Caps — each one runs before the step it guards
// ---------------------------------------------------------------------------

describe('importTip caps', () => {
  it('allows a file of exactly 64 MB and proceeds to decode', async () => {
    const { ports, decodeCalls } = stubPorts()
    const file: ImportTipFile = {
      name: 'at-cap.png',
      size: IMPORT_TIP_MAX_BYTES,
      arrayBuffer: async () => pngWithSize(64, 64).slice().buffer as ArrayBuffer,
    }
    const result = await importTip(file, ports)
    expect(result.ok).toBe(true)
    expect(decodeCalls()).toBe(1)
  })

  it('refuses a file one byte over the cap before arrayBuffer is called', async () => {
    let arrayBufferCalls = 0
    const { ports, decodeCalls } = stubPorts()
    const file: ImportTipFile = {
      name: 'over-cap.png',
      size: IMPORT_TIP_MAX_BYTES + 1,
      arrayBuffer: async () => {
        arrayBufferCalls += 1
        return new ArrayBuffer(0)
      },
    }
    const result = await importTip(file, ports)
    expect(result).toEqual({ ok: false, reason: 'too-large' })
    expect(arrayBufferCalls).toBe(0)
    expect(decodeCalls()).toBe(0)
  })

  it('refuses a PNG declaring 8000×9000 (72 MP) before decode', async () => {
    const { ports, decodeCalls } = stubPorts()
    const result = await importTip(fileOf(pngWithSize(8000, 9000), 'huge.png'), ports)
    expect(result).toEqual({ ok: false, reason: 'too-many-pixels' })
    expect(decodeCalls()).toBe(0)
  })

  it('allows a PNG declaring 8000×8000 (exactly 64 MP)', async () => {
    const { ports, decodeCalls } = stubPorts()
    const result = await importTip(fileOf(pngWithSize(8000, 8000), 'at-cap.png'), ports)
    expect(result.ok).toBe(true)
    expect(decodeCalls()).toBe(1)
    expect(IMPORT_TIP_MAX_PIXELS).toBe(64_000_000)
  })

  it('refuses a JPEG whose SOF declares an oversize frame before decode', async () => {
    const { ports, decodeCalls } = stubPorts()
    const result = await importTip(fileOf(jpegWithSize(8000, 9000), 'huge.jpg'), ports)
    expect(result).toEqual({ ok: false, reason: 'too-many-pixels' })
    expect(decodeCalls()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Named failures — never a throw
// ---------------------------------------------------------------------------

describe('importTip refusals', () => {
  it('refuses a truncated PNG IHDR as unreadable without throwing', async () => {
    const { ports, decodeCalls } = stubPorts()
    const result = await importTip(fileOf(pngWithSize(64, 64).slice(0, 20), 'cut.png'), ports)
    expect(result).toEqual({ ok: false, reason: 'unreadable-image' })
    expect(decodeCalls()).toBe(0)
  })

  it('refuses a decode port returning anything but 192×192 RGBA', async () => {
    const { ports } = stubPorts({ rgbaResults: [new Uint8Array(8 * 8 * 4)] })
    const result = await importTip(fileOf(pngWithSize(64, 64), 'small.png'), ports)
    expect(result).toEqual({ ok: false, reason: 'unreadable-image' })
  })

  it('refuses when the decode port fails', async () => {
    const { ports } = stubPorts({ rgbaResults: [null] })
    const result = await importTip(fileOf(pngWithSize(64, 64), 'broken.png'), ports)
    expect(result).toEqual({ ok: false, reason: 'unreadable-image' })
  })

  it('refuses when reading the File rejects instead of throwing', async () => {
    const { ports } = stubPorts()
    const file: ImportTipFile = {
      name: 'io.png',
      size: 24,
      arrayBuffer: async () => Promise.reject(new Error('io failure')),
    }
    const result = await importTip(file, ports)
    expect(result).toEqual({ ok: false, reason: 'unreadable-image' })
  })

  it('refuses when the registration port returns null', async () => {
    const { ports } = stubPorts()
    const refusing: ImportTipPorts = {
      decode: ports.decode,
      register: async () => null,
    }
    const result = await importTip(fileOf(pngWithSize(64, 64), 'refused.png'), refusing)
    expect(result).toEqual({ ok: false, reason: 'registration-refused' })
  })
})

// ---------------------------------------------------------------------------
// Derivation — deriveMask is the ONE conversion
// ---------------------------------------------------------------------------

describe('importTip derivation', () => {
  it('hands the registration port a 36,864-byte mask derived from the RGBA', async () => {
    const { ports, registered } = stubPorts({ rgbaResults: [alphaRgba(3)] })
    const result = await importTip(fileOf(pngWithSize(64, 64), 'alpha.png'), ports)
    expect(result.ok).toBe(true)
    expect(registered).toHaveLength(1)
    expect(registered[0]!.mask.length).toBe(TIP_MASK_BYTES)
    expect(registered[0]!.mask.every((value) => value === 3)).toBe(true)
    expect(registered[0]!.name).toBe('alpha.png')
  })
})

// ---------------------------------------------------------------------------
// Single-flight — concurrent imports queue, nothing is lost
// ---------------------------------------------------------------------------

describe('importTip single-flight', () => {
  it('serializes concurrent imports and delivers every outcome in order', async () => {
    let active = 0
    let maxActive = 0
    const { ports, decodeCalls } = stubPorts({
      rgbaResults: [transparentRgba(), null, transparentRgba()],
      onEnter: () => {
        active += 1
        maxActive = Math.max(maxActive, active)
      },
      onExit: () => {
        active -= 1
      },
    })
    const [first, second, third] = await Promise.all([
      importTip(fileOf(pngWithSize(64, 64), 'a.png'), ports),
      importTip(fileOf(pngWithSize(64, 64), 'b.png'), ports),
      importTip(fileOf(pngWithSize(64, 64), 'c.png'), ports),
    ])
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    expect(third.ok).toBe(true)
    expect(maxActive).toBe(1)
    expect(decodeCalls()).toBe(3)
  })
})
