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
//  downscales once to 192×192 with imageSmoothingQuality 'high'
//  and returns RGBA; deriveMask is the only conversion to a mask.
//  Tests and other hosts inject their own decoder.
//
//  Idempotency (pinned, D-16): this package no longer mints ids.
//  Registration is a PORT too — the main-realm handler names the
//  tip, appends it to the project catalog and mints a fresh id
//  per import (app/src/lib/efxPaintBrushImport.ts). Two imports
//  of identical bytes therefore stay two catalog rows while the
//  content-addressed asset dedupes to one file.
//
//  Concurrency (pinned): importTip is single-flight — concurrent
//  calls queue behind one another and never interleave mid-write.
//
//  Totality (T-56-10): every refusal is a named result; no path
//  throws into the UI layer.
// ============================================================

import { TIP_SIZE } from '../playground/brushes'
import { deriveMask } from './deriveMask'
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
 * Decode port: source bytes → exactly TIP_SIZE × TIP_SIZE RGBA
 * (TIP_SIZE² × 4 bytes). Null means the decode failed; any other
 * length is treated as unreadable by the caller.
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

/**
 * Read the declared dimensions from a PNG IHDR or a JPEG SOF0/1/2
 * segment. Purely structural, bounded, and total: null on anything
 * truncated, otherwise malformed, or foreign. Never throws.
 */
export function readImageDimensions(bytes: Uint8Array): ImportedImageDimensions | null {
  throw new Error('readImageDimensions is not implemented yet (63-05 RED)')
}

/** Copy raw bytes into a fresh ArrayBuffer-backed view (BlobPart-safe). */
function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.length))
  copy.set(bytes)
  return copy
}

/**
 * Production decode port: decode through the browser decoder only
 * (createImageBitmap, Image+decode fallback), draw once into a
 * 192×192 canvas with high-quality smoothing, and return RGBA.
 * The source image is released, never retained.
 */
export async function decodeRgbaAtTipSize(bytes: Uint8Array): Promise<Uint8Array | null> {
  throw new Error('decodeRgbaAtTipSize is not implemented yet (63-05 RED)')
}

// Single-flight queue — one import in flight at a time; callers
// queue, never interleave mid-write (flagged assumption).
let importChain: Promise<unknown> = Promise.resolve()

/**
 * Import a custom PNG/JPG brush tip.
 *
 * Checks the size cap before reading, the pixel cap before decoding,
 * derives the mask through the ONE conversion, then hands it to the
 * injected registration port. Total: resolves to a named failure on
 * every refusal. Never throws.
 */
export function importTip(file: ImportTipFile, ports: ImportTipPorts): Promise<ImportTipResult> {
  throw new Error('importTip is not implemented yet (63-05 RED)')
}
