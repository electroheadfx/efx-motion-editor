// ============================================================
//  Custom tip import (56-04 / AQUA-03 / T-56-10 / 63-05 Task 2).
//
//  Untrusted image bytes enter here. Two caps run before the work
//  they guard: IMPORT_TIP_MAX_BYTES (64 MB) is checked on the File
//  before its bytes are read, and IMPORT_TIP_MAX_PIXELS (64 MP) is
//  checked on header dimensions read by a bounded, hand-written
//  PNG/JPEG walk — never a decoder. The magic sniff (PNG 89 50 4E
//  47 / JPG FF D8 FF) runs first, so SVG and arbitrary garbage
//  never reach the dimension parser.
//
//  Decode is a PORT: the browser createImageBitmap / Image path
//  downscales once to TIP_MASK_EDGE×TIP_MASK_EDGE (512×512, the
//  IMPORTED mask edge — NOT the 192 procedural tip edge) with
//  imageSmoothingQuality 'high' and returns RGBA; deriveMask is
//  the only conversion to a mask. Tests and other hosts inject
//  their own decoder.
//
//  Idempotency: this package no longer mints ids. Registration is
//  a PORT too — the main-realm handler writes the mask into the
//  machine library and upserts the content-addressed row
//  (app/src/lib/efxPaintBrushImport.ts). Two imports of identical
//  bytes therefore resolve to ONE row: the id is derived from the
//  digest.
//
//  Concurrency (pinned): importTip is single-flight — concurrent
//  calls queue behind one another and never interleave mid-write.
//
//  Totality (T-56-10): every refusal is a named result; no path
//  throws into the UI layer.
// ============================================================

import { TIP_MASK_EDGE, deriveMask } from './deriveMask'
import type { AquarelleTip } from './tips'

/** 64 MB: a file larger than this is refused before its bytes are read. */
export const IMPORT_TIP_MAX_BYTES = 64 * 1024 * 1024

/** 64 MP: a header declaring more pixels is refused before decode. */
export const IMPORT_TIP_MAX_PIXELS = 64_000_000

/** Why one import was refused. One UI copy covers all of them. */
export type ImportTipFailureReason =
  | 'too-large'
  | 'too-many-pixels'
  | 'unreadable-image'
  | 'registration-refused'

/** Discriminated import result — never a throw into the UI layer. */
export type ImportTipResult =
  | { ok: true; tip: AquarelleTip }
  | { ok: false; reason: ImportTipFailureReason }

/** UI-SPEC refusal copy — the Brushes docker shows this verbatim. */
export const IMPORT_TIP_FAILURE_COPY =
  'Import failed — this file is not a readable PNG or JPG. Nothing changed.'

/** The File surface one import needs (a DOM File satisfies it). */
export interface ImportTipFile {
  readonly name: string
  readonly size: number
  readonly arrayBuffer: () => Promise<ArrayBuffer>
}

/**
 * Decode port: source bytes → exactly TIP_MASK_EDGE × TIP_MASK_EDGE
 * RGBA (TIP_MASK_BYTES × 4 bytes). Null means the decode failed;
 * any other length is treated as unreadable by the caller.
 */
export type ImportTipDecodePort = (
  bytes: Uint8Array,
) => Promise<Uint8Array | Uint8ClampedArray | null>

/**
 * Registration port: receives the derived mask and the file name,
 * returns the catalog entry the main realm created — or null when
 * it refused. The package never mints ids (D-16).
 */
export type ImportTipRegisterPort = (input: {
  readonly mask: Uint8Array
  readonly name: string
}) => Promise<AquarelleTip | null>

/** The two ports one import needs. */
export interface ImportTipPorts {
  readonly decode: ImportTipDecodePort
  readonly register: ImportTipRegisterPort
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47] as const
const JPG_MAGIC = [0xff, 0xd8, 0xff] as const

function matchesMagic(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false
  }
  return true
}

function sniffImageKind(bytes: Uint8Array): 'png' | 'jpg' | null {
  if (matchesMagic(bytes, PNG_MAGIC)) return 'png'
  if (matchesMagic(bytes, JPG_MAGIC)) return 'jpg'
  return null
}

/** Declared image extent read from the header (no decode). */
export interface ImportedImageDimensions {
  readonly width: number
  readonly height: number
}

/** Bounded JPEG segment walk: never more than this many marker hops. */
const JPEG_MAX_SEGMENT_HOPS = 64

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24)
      | (bytes[offset + 1]! << 16)
      | (bytes[offset + 2]! << 8)
      | bytes[offset + 3]!) >>> 0
  )
}

/** PNG: signature is checked by the caller; read the IHDR chunk only. */
function readPngDimensions(bytes: Uint8Array): ImportedImageDimensions | null {
  // signature (8) + IHDR length (4) + 'IHDR' (4) + width (4) + height (4)
  if (bytes.length < 24) return null
  if (readUint32BE(bytes, 8) !== 13) return null
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) return null
  const width = readUint32BE(bytes, 16)
  const height = readUint32BE(bytes, 20)
  return width > 0 && height > 0 ? { width, height } : null
}

/** JPEG: a bounded walk over the marker segments until SOF0/1/2. */
function readJpegDimensions(bytes: Uint8Array): ImportedImageDimensions | null {
  let offset = 2
  for (let hop = 0; hop < JPEG_MAX_SEGMENT_HOPS && offset + 1 < bytes.length; hop += 1) {
    if (bytes[offset] !== 0xff) return null
    let marker = bytes[offset + 1]!
    // A marker may be preceded by any number of 0xFF fill bytes.
    while (marker === 0xff && offset + 2 < bytes.length) {
      offset += 1
      marker = bytes[offset + 1]!
    }
    // Standalone markers carry no length payload.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    if (marker === 0xd9) return null // EOI before any frame header
    if (offset + 3 >= bytes.length) return null
    const length = (bytes[offset + 2]! << 8) | bytes[offset + 3]!
    if (length < 2) return null
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      // FF marker, length (2), precision (1), height (2), width (2)
      if (offset + 8 >= bytes.length) return null
      const height = (bytes[offset + 5]! << 8) | bytes[offset + 6]!
      const width = (bytes[offset + 7]! << 8) | bytes[offset + 8]!
      return width > 0 && height > 0 ? { width, height } : null
    }
    offset += 2 + length
  }
  return null
}

/**
 * Read the declared dimensions from a PNG IHDR or a JPEG SOF0/1/2
 * segment. Purely structural, bounded, and total: null on anything
 * truncated, otherwise malformed, or foreign. Never throws.
 */
export function readImageDimensions(bytes: Uint8Array): ImportedImageDimensions | null {
  const kind = sniffImageKind(bytes)
  if (kind === 'png') return readPngDimensions(bytes)
  if (kind === 'jpg') return readJpegDimensions(bytes)
  return null
}

/** Copy raw bytes into a fresh ArrayBuffer-backed view (BlobPart-safe). */
function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.length))
  copy.set(bytes)
  return copy
}

const TIP_PIXELS = TIP_MASK_EDGE * TIP_MASK_EDGE

/** Draw the decoded source once into a 512×512 canvas and read RGBA back. */
function renderIntoMaskCanvas(source: CanvasImageSource): Uint8Array | null {
  const documentRef = (globalThis as { document?: Document }).document
  if (documentRef === undefined) return null
  const canvas = documentRef.createElement('canvas')
  canvas.width = TIP_MASK_EDGE
  canvas.height = TIP_MASK_EDGE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) return null
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.clearRect(0, 0, TIP_MASK_EDGE, TIP_MASK_EDGE)
  context.drawImage(source, 0, 0, TIP_MASK_EDGE, TIP_MASK_EDGE)
  const data = context.getImageData(0, 0, TIP_MASK_EDGE, TIP_MASK_EDGE).data
  const rgba = new Uint8Array(TIP_PIXELS * 4)
  rgba.set(data)
  return rgba
}

/**
 * Production decode port: decode through the browser decoder only
 * (createImageBitmap, Image+decode fallback), draw once into a
 * 512×512 canvas with high-quality smoothing, and return RGBA.
 * The source image is released, never retained. The decoded source
 * is drawn ONCE per import — never in a draw loop.
 */
export async function decodeRgbaAtTipSize(bytes: Uint8Array): Promise<Uint8Array | null> {
  const createBitmap = (globalThis as { createImageBitmap?: (blob: Blob) => Promise<ImageBitmap> })
    .createImageBitmap
  if (typeof createBitmap === 'function') {
    let bitmap: ImageBitmap | null = null
    try {
      bitmap = await createBitmap(new Blob([toBlobPart(bytes)]))
      const rgba = renderIntoMaskCanvas(bitmap)
      if (rgba !== null) return rgba
    } catch {
      // Fall through to the Image element path.
    } finally {
      bitmap?.close()
    }
  }

  const ImageCtor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof ImageCtor !== 'function') return null
  const url = URL.createObjectURL(new Blob([toBlobPart(bytes)]))
  try {
    const image = new ImageCtor()
    image.src = url
    await image.decode()
    return renderIntoMaskCanvas(image)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Single-flight queue — one import in flight at a time; callers
// queue, never interleave mid-write (flagged assumption).
let importChain: Promise<unknown> = Promise.resolve()

async function importTipNow(file: ImportTipFile, ports: ImportTipPorts): Promise<ImportTipResult> {
  // 1. Size cap on the File — before a single byte is read.
  if (file.size > IMPORT_TIP_MAX_BYTES) return { ok: false, reason: 'too-large' }

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await file.arrayBuffer())
  } catch {
    return { ok: false, reason: 'unreadable-image' }
  }
  // A DOM File cannot lie about its size, but a foreign port can.
  if (bytes.length > IMPORT_TIP_MAX_BYTES) return { ok: false, reason: 'too-large' }

  // 2. Magic sniff before any structural parse — SVG and garbage stop here.
  if (sniffImageKind(bytes) === null) return { ok: false, reason: 'unreadable-image' }

  // 3. Pixel cap on declared header dimensions — before the decode allocates.
  const dimensions = readImageDimensions(bytes)
  if (dimensions === null) return { ok: false, reason: 'unreadable-image' }
  if (dimensions.width * dimensions.height > IMPORT_TIP_MAX_PIXELS) {
    return { ok: false, reason: 'too-many-pixels' }
  }

  // 4. Decode through the injected port; deriveMask is the ONE conversion.
  let rgba: Uint8Array | Uint8ClampedArray | null
  try {
    rgba = await ports.decode(bytes)
  } catch {
    return { ok: false, reason: 'unreadable-image' }
  }
  if (rgba === null || rgba.length !== TIP_PIXELS * 4) {
    return { ok: false, reason: 'unreadable-image' }
  }
  const mask = deriveMask(rgba)
  if (mask === null) return { ok: false, reason: 'unreadable-image' }

  // 5. Registration belongs to the realm that owns ids and the catalog.
  let tip: AquarelleTip | null
  try {
    tip = await ports.register({ mask, name: file.name })
  } catch {
    return { ok: false, reason: 'registration-refused' }
  }
  if (tip === null) return { ok: false, reason: 'registration-refused' }
  return { ok: true, tip }
}

/**
 * Import a custom PNG/JPG brush tip.
 *
 * Checks the size cap before reading, the pixel cap before decoding,
 * derives the mask through the ONE conversion, then hands it to the
 * injected registration port. Total: resolves to a named failure on
 * every refusal. Never throws.
 */
export function importTip(file: ImportTipFile, ports: ImportTipPorts): Promise<ImportTipResult> {
  const run = importChain.then(
    () => importTipNow(file, ports),
    () => importTipNow(file, ports),
  )
  // Keep the chain alive even if a turn rejects (importTipNow never does,
  // but the queue must not wedge on an unexpected throw).
  importChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
