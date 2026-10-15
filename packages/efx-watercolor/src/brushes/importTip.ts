// ============================================================
//  Custom tip import (56-04 / AQUA-03 / T-56-10).
//
//  Untrusted image bytes enter the pack here. The sniff is a
//  magic-byte check (PNG 89 50 4E 47 / JPG FF D8 FF) before any
//  decode, so SVG and arbitrary garbage never reach the decoder.
//  Decode rides the browser decoder only (createImageBitmap,
//  Image+decode fallback) — no eval, no third-party image lib.
//  Every failure returns the named result; this module never
//  throws into the UI layer (T-56-10).
//
//  Idempotency (pinned): the same PNG bytes twice yield two tips
//  with distinct ids — no silent dedupe. The id is derived from
//  a monotonic import counter mixed with a content digest so it
//  is fresh per import and stable once assigned.
//
//  Concurrency (pinned): importTip is single-flight — concurrent
//  calls queue behind one another and never interleave mid-write.
// ============================================================

import type { AquarelleTip, AquarelleToolOverrides } from './tips'
import { NEUTRAL_TOOL_OVERRIDES } from './tips'

/** Discriminated import result — never a throw into the UI layer. */
export type ImportTipResult =
  | { ok: true; tip: AquarelleTip }
  | { ok: false; reason: 'unreadable-image' }

/** UI-SPEC refusal copy — the Brushes docker shows this verbatim. */
export const IMPORT_TIP_FAILURE_COPY =
  'Import failed — this file is not a readable PNG or JPG. Nothing changed.'

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

/**
 * Content digest over the raw bytes — FNV-1a, the same family the
 * host traceSeed law uses (D-25). Only used to salt the fresh id,
 * never as a dedupe key.
 */
function contentDigest(bytes: Uint8Array): number {
  let hash = 2166136261
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes[i]
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/** Monotonic import counter — the no-silent-dedupe nonce. */
let importCounter = 0

function freshCustomId(bytes: Uint8Array): string {
  importCounter += 1
  // Mix the counter in so identical bytes still produce distinct ids.
  const digest = (contentDigest(bytes) ^ Math.imul(importCounter, 0x9e3779b1)) >>> 0
  return `wc/custom-${digest.toString(16).padStart(8, '0')}`
}

/** Decoded image extent — enough to know the decode really happened. */
interface DecodedExtent {
  width: number
  height: number
}

/**
 * Copy raw bytes into a fresh ArrayBuffer-backed view. The incoming
 * Uint8Array may be a SharedArrayBuffer view (Uint8Array<ArrayBufferLike>),
 * which BlobPart rejects — the copy narrows to Uint8Array<ArrayBuffer>.
 */
function toBlobPart(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.length))
  copy.set(bytes)
  return copy
}

async function decodeWithCreateImageBitmap(bytes: Uint8Array): Promise<DecodedExtent | null> {
  const decode = (globalThis as { createImageBitmap?: (b: Blob) => Promise<unknown> })
    .createImageBitmap
  if (typeof decode !== 'function') return null
  const blob = new Blob([toBlobPart(bytes)])
  const bitmap = (await decode(blob)) as { width?: number; height?: number }
  return {
    width: typeof bitmap?.width === 'number' ? bitmap.width : 0,
    height: typeof bitmap?.height === 'number' ? bitmap.height : 0,
  }
}

async function decodeWithImageElement(bytes: Uint8Array): Promise<DecodedExtent | null> {
  const ImageCtor = (globalThis as { Image?: new () => HTMLImageElement }).Image
  if (typeof ImageCtor !== 'function') return null
  const blob = new Blob([toBlobPart(bytes)])
  const url = URL.createObjectURL(blob)
  try {
    const img = new ImageCtor()
    img.src = url
    await img.decode()
    return {
      width: typeof img.naturalWidth === 'number' ? img.naturalWidth : 0,
      height: typeof img.naturalHeight === 'number' ? img.naturalHeight : 0,
    }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Decode via the browser decoder only (T-56-10): createImageBitmap
 * first, Image+decode() as the fallback. Returns null on any failure
 * — a corrupt body with a valid magic head must not throw.
 */
async function decodeImage(bytes: Uint8Array): Promise<DecodedExtent | null> {
  try {
    const viaBitmap = await decodeWithCreateImageBitmap(bytes)
    if (viaBitmap) return viaBitmap
    return await decodeWithImageElement(bytes)
  } catch {
    return null
  }
}

function makeCustomTip(fileName: string, bytes: Uint8Array): AquarelleTip {
  const multipliers: AquarelleToolOverrides = { ...NEUTRAL_TOOL_OVERRIDES }
  return Object.freeze({
    id: freshCustomId(bytes),
    category: 'custom' as const,
    name: fileName,
    ...multipliers,
  })
}

async function importTipNow(bytes: Uint8Array, fileName: string): Promise<ImportTipResult> {
  // Magic sniff first — SVG and arbitrary garbage never reach a decoder.
  const kind = sniffImageKind(bytes)
  if (kind === null) return { ok: false, reason: 'unreadable-image' }

  const extent = await decodeImage(bytes)
  if (extent === null) return { ok: false, reason: 'unreadable-image' }

  return { ok: true, tip: makeCustomTip(fileName, bytes) }
}

// Single-flight queue — one import in flight at a time; callers
// queue, never interleave mid-write (flagged assumption).
let importChain: Promise<unknown> = Promise.resolve()

/**
 * Import a custom PNG/JPG brush tip.
 *
 * Total: resolves to the named failure on anything that is not a
 * readable PNG/JPG. Never throws.
 */
export function importTip(bytes: Uint8Array, fileName: string): Promise<ImportTipResult> {
  const run = importChain.then(
    () => importTipNow(bytes, fileName),
    () => importTipNow(bytes, fileName),
  )
  // Keep the chain alive even if a turn rejects (importTipNow never does,
  // but the queue must not wedge on an unexpected throw).
  importChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}
