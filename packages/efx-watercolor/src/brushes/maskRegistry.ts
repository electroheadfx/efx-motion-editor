// ============================================================
//  maskRegistry — module-level engine registry of derived tip masks (D-20).
//
//  The engine (buildBrushForStroke) resolves a brushId here BEFORE
//  any preset lookup. The app feeds it: import registers one mask,
//  project open REPLACES the whole set (never appends), project
//  close / New Project resets it. The reset state is the three
//  compile-time built-in tips (63-03 / D-20): the module seeds
//  from BUILTIN_TIP_MASKS at load and `resetMaskRegistry()` is
//  `replaceMaskRegistry(BUILTIN_TIP_MASKS)`, so a project that
//  never imported a tip always resolves the built-ins.
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
//
//  Reserved ids (WR-05 / T-63-31): the three built-in ids are
//  unshadowable. `registerMask` refuses them outright, and
//  `replaceMaskRegistry` admits one only with the exact
//  `BUILTIN_TIP_MASKS` allocation, so script data or a foreign
//  package entry can never replace a shipped texture for the
//  session.
// ============================================================

import { TIP_MASK_BYTES } from './deriveMask'
import { BUILTIN_TIP_MASKS } from './builtinTips'

const masks = new Map<string, Uint8Array>()

/**
 * The reserved built-in set, built ONCE at module load: id -> the exact
 * compile-time allocation. It is the one authority for both write laws —
 * `registerMask` refuses every id in it, and `replaceMaskRegistry` admits a
 * built-in id only when the entry's mask IS that allocation (WR-05 / T-63-31:
 * script or package data can never alter a shipped texture for the session).
 * Derived from `BUILTIN_TIP_MASKS` alone — the set is never widened.
 */
const builtinMasksById = new Map<string, Uint8Array>(
  BUILTIN_TIP_MASKS.map((builtin): [string, Uint8Array] => [builtin.id, builtin.mask]),
)

for (const builtin of BUILTIN_TIP_MASKS) {
  masks.set(builtin.id, builtin.mask)
}

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
 *
 * RESERVED IDS (WR-05): the three compile-time built-in ids are refused
 * outright — before the writable check — with a warning naming the id, no
 * map write and no generation bump. A script's `brushPack` or a foreign
 * package entry named after a built-in therefore can never replace the
 * shipped texture for the session; only `replaceMaskRegistry` with the
 * exact `BUILTIN_TIP_MASKS` allocation (i.e. `resetMaskRegistry`) installs
 * one. Custom ids register exactly as before.
 */
export function registerMask(id: string, mask: Uint8Array): boolean {
  if (builtinMasksById.has(id)) {
    console.warn(
      `[maskRegistry] refused to register "${id}" — built-in tip ids are reserved; only the compile-time BUILTIN_TIP_MASKS allocation may install one.`,
    )
    return false
  }
  if (!isWritable(id, mask)) return false
  masks.set(id, mask)
  generation += 1
  return true
}

/**
 * Replace the whole registry (project open — REPLACES, never appends).
 * Every prior entry is dropped, including ids absent from the new set.
 * Wrong-length entries are refused individually; valid siblings install.
 *
 * BUILT-IN IDS (WR-05): a built-in id is admitted ONLY with the identical
 * compile-time `BUILTIN_TIP_MASKS` allocation (which is exactly what
 * `resetMaskRegistry` passes). A foreign array under that id — equal bytes
 * included, since bytes equality is not identity — is logged and skipped, so
 * a project or payload entry can never shadow a shipped texture. Custom ids
 * are unaffected.
 */
export function replaceMaskRegistry(entries: readonly { id: string; mask: Uint8Array }[]): void {
  masks.clear()
  for (const entry of entries) {
    const builtin = builtinMasksById.get(entry.id)
    if (builtin !== undefined) {
      if (entry.mask !== builtin) {
        console.warn(
          `[maskRegistry] refused to replace built-in tip "${entry.id}" — only the compile-time BUILTIN_TIP_MASKS allocation may seed a built-in id; the entry was skipped.`,
        )
        continue
      }
      masks.set(entry.id, builtin)
      continue
    }
    if (!isWritable(entry.id, entry.mask)) continue
    masks.set(entry.id, entry.mask)
  }
  generation += 1
}

/**
 * Reset to the built-in set (project close / New Project, D-20).
 * Never empty: the three compile-time built-ins always resolve.
 * Always bumps.
 */
export function resetMaskRegistry(): void {
  replaceMaskRegistry(BUILTIN_TIP_MASKS)
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
