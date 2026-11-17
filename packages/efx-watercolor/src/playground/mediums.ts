// ============================================================
//  mediums.ts — the five built-in paint mediums, as plain data.
//
//  A medium is `{ id, name, params }`: a frozen, serializable
//  record over exactly the ten medium keys (the canonical bag
//  minus `size` and `lift`, which the medium never writes). No
//  function, no class, no hidden behaviour — a record is a
//  parameter set, nothing more.
// ============================================================

/** The five built-in medium ids, in display order. */
export type MediumId = 'watercolor' | 'gouache' | 'pastel' | 'graphite' | 'acrylic'

/**
 * The ten keys a medium may set. `size` (a shared pixel footprint) and
 * `lift` (the eraser popover's strength) are deliberately absent: a
 * medium switch must never resize the brush or change the eraser.
 */
export type MediumParamKey =
  | 'water'
  | 'load'
  | 'flow'
  | 'bleed'
  | 'dry'
  | 'edge'
  | 'granulation'
  | 'viscosity'
  | 'body'
  | 'emboss'

/** One built-in medium: plain serializable data, frozen. */
export interface MediumRecord {
  readonly id: MediumId
  /** Display name — matches the brush-library section header (D-18). */
  readonly name: string
  readonly params: Readonly<Record<MediumParamKey, number>>
}

export const MEDIUM_IDS: ReadonlyArray<MediumId> = Object.freeze([])

export const MEDIUMS: ReadonlyArray<MediumRecord> = Object.freeze([])

export const DEFAULT_MEDIUM_ID: MediumId = 'watercolor'

/** Resolve a medium by id; null for anything unknown. Never throws. */
export function mediumById(_id: string): MediumRecord | null {
  return null
}
