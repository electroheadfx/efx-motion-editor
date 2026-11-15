// ============================================================
//  builtinTips — the three compile-time texture tips (D-06 .. D-09, TIP-13).
//
//  These tips ship on EVERY install: they come from constants in
//  `builtinTipMasks.generated.ts`, never from a project file, a
//  file path or a runtime generator. `maskRegistry` seeds from
//  `BUILTIN_TIP_MASKS` at module load and `resetMaskRegistry()`
//  restores exactly this set, so a project that never imported a
//  tip still resolves them after close / New Project (D-20).
//
//  `BUILTIN_TIPS` and `BUILTIN_TIP_MASKS` are SEPARATE exports on
//  purpose: the tip records are what the catalog / library surface
//  imports, the mask entries are what the registry installs. No
//  later plan re-declares, renames or copies these three ids — a
//  project entry set is a different list that never contains them.
//
//  The generated module is written by `builtinBake.test.ts` from
//  the user-supplied source art through the shared derivation law
//  (`deriveMask`, D-09) and the bake-only contrast stretch
//  (`normalizeMaskContrast`, D-08). Never hand-edit it.
//
//  Fail-closed (T-63-14): every constant is length-checked at
//  module load — a malformed constant throws here instead of
//  reaching the registry as a wrong-sized mask.
// ============================================================

import { TIP_MASK_BYTES } from './deriveMask'
import { NEUTRAL_TOOL_OVERRIDES, type AquarelleTip } from './tips'
import {
  BRISTLE_MASK_BASE64,
  CHALK_MASK_BASE64,
  SPONGE_MASK_BASE64,
} from './builtinTipMasks.generated'

/** One built-in mask entry: the tip id and its decoded 192×192 mask. */
export interface BuiltinTipMask {
  readonly id: string
  readonly mask: Uint8Array
}

/** D-07 mapping: source asset constant → tip id → label. */
const BUILTIN_DEFS = [
  { id: 'wc/builtin-bristle', name: 'Bristle fan', constant: BRISTLE_MASK_BASE64 },
  { id: 'wc/builtin-chalk', name: 'Chalk grain', constant: CHALK_MASK_BASE64 },
  { id: 'wc/builtin-sponge', name: 'Sponge', constant: SPONGE_MASK_BASE64 },
] as const

/** Decode one base64 constant into the exact TIP_MASK_BYTES mask, or throw. */
function decodeMask(id: string, constant: string): Uint8Array {
  const binary = atob(constant)
  if (binary.length !== TIP_MASK_BYTES) {
    throw new Error(
      `built-in tip ${id}: mask constant decodes to ${binary.length} bytes, expected ${TIP_MASK_BYTES}`,
    )
  }
  const mask = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) mask[i] = binary.charCodeAt(i)
  return mask
}

/**
 * The three built-in tip records (D-07 ids and labels, neutral
 * multipliers, category `texture`). Frozen: the catalog and the
 * library read them, never own them.
 */
export const BUILTIN_TIPS: readonly AquarelleTip[] = Object.freeze(
  BUILTIN_DEFS.map((def) =>
    Object.freeze({
      id: def.id,
      category: 'texture' as const,
      name: def.name,
      ...NEUTRAL_TOOL_OVERRIDES,
    }),
  ),
)

/**
 * The three built-in masks, decoded ONCE at module load. The
 * registry seeds and resets from exactly this array — this is
 * the compile-time source no project file can remove.
 */
export const BUILTIN_TIP_MASKS: readonly BuiltinTipMask[] = Object.freeze(
  BUILTIN_DEFS.map((def) =>
    Object.freeze({
      id: def.id,
      mask: decodeMask(def.id, def.constant),
    }),
  ),
)
