// ============================================================
//  maskRegistry — module-level engine registry of derived tip masks (D-20).
//
//  quick 261116-inu / spec 04: the MACHINE brush library is the only
//  source of textures. There are no compile-time built-ins left, so the
//  registry starts EMPTY and is filled from the library scan (boot, one
//  replacement) or from a script's inline masks. The engine
//  (buildBrushForStroke) resolves the TEXTURE id here — a response id
//  never enters this registry. A resolved mask replaces the footprint of
//  whichever RESPONSE preset the stroke names; an unresolved texture id
//  falls back to that preset's own procedural tip.
//
//  Preact-free by law — the package core never imports a signal
//  library. Module state only, with an explicit generation counter
//  so derived caches (cursor footprint, stroke thumbs) can key on
//  it and notice a replaced mask under an unchanged id.
//
//  Contract: `resolveMask` returns the EXACT array that was
//  registered (identity), so the live path and the bake path share
//  one allocation per tip.
//
//  Fail-closed (T-63-02): a mask whose length is not exactly
//  TIP_MASK_BYTES is refused at every write seam — never stored,
//  never silently substituted. `replaceMaskRegistry` refuses such
//  entries individually (D-18: one bad tip must not abort the
//  rest of the set); callers that own the degradation warning
//  validate before calling.
// ============================================================

import { TIP_MASK_BYTES } from './deriveMask'

const masks = new Map<string, Uint8Array>()

let generation = 0

/** True when the id/mask pair is writable: non-empty id, exact byte length. */
function isWritable(id: unknown, mask: unknown): mask is Uint8Array {
  if (typeof id !== 'string' || id.length === 0) return false
  if (!(mask instanceof Uint8Array)) return false
  return mask.length === TIP_MASK_BYTES
}

/**
 * Register (or overwrite) one mask. False and NO mutation unless the
 * id is non-empty and the mask is exactly TIP_MASK_BYTES long.
 */
export function registerMask(id: string, mask: Uint8Array): boolean {
  if (!isWritable(id, mask)) return false
  masks.set(id, mask)
  generation += 1
  return true
}

/**
 * Replace the whole registry (a library scan or payload — REPLACES, never
 * appends). Every prior entry is dropped, including ids absent from the new
 * set. Wrong-length entries are refused individually; valid siblings install.
 */
export function replaceMaskRegistry(entries: readonly { id: string; mask: Uint8Array }[]): void {
  masks.clear()
  for (const entry of entries) {
    if (!isWritable(entry.id, entry.mask)) continue
    masks.set(entry.id, entry.mask)
  }
  generation += 1
}

/**
 * Reset to EMPTY (test isolation and any environment that owns no library
 * rows). There are no built-ins to restore: the machine library scan fills
 * the registry. Always bumps.
 */
export function resetMaskRegistry(): void {
  replaceMaskRegistry([])
}

/** The registered mask for an id (identity contract), or null. */
export function resolveMask(id: string): Uint8Array | null {
  return masks.get(id) ?? null
}

/** Registered ids in insertion order (a fresh array; reads never mutate). */
export function listRegisteredMaskIds(): string[] {
  return [...masks.keys()]
}

/** Monotonic mutation counter — the one change signal derived caches key on. */
export function maskGeneration(): number {
  return generation
}
