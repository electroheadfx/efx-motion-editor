/**
 * aquarelleBrushCatalog — the MACHINE-scoped brush-texture catalog
 * (quick 261116-inu / spec 04; supersedes the project-scoped 63-04 store).
 *
 * WHAT THIS OWNS
 *   · `libraryRows`        — one row per `catalog.json` entry under
 *                            `~/.config/efx-motion/brushes/`: the tip half plus
 *                            the library-only `digest` and `textureRotation`.
 *   · `customBrushTips`    — the tip list the surfaces render (the Default chip
 *                            is the strip's own `null` entry, never a row).
 *   · `unavailableTipIds`  — the ids whose stored file is missing or unusable
 *                            on this machine. REPLACE-ONLY.
 *   · `libraryRevision`    — a monotonic counter bumped once per REAL library
 *                            mutation; the cross-realm payload's staleness key.
 *   · `brushCatalogGeneration` — bumped on every real mutation so derived
 *                            readers can key a cache (maskGeneration analog).
 *
 * WHY THIS LIVES IN `app/src/stores/`
 *   BOTH realms import it — the main window owns the library and publishes the
 *   snapshot, the Studio child applies it — and every other cross-realm store
 *   in the project lives under `app/src/stores/`.
 *
 * TRUTH SOURCE
 *   The machine library's `catalog.json` is the one truth. Nothing here is
 *   project data: opening, closing or creating a project never clears it.
 *
 * Preact signals only (no `useState`); every setter compares before writing and
 * is idempotent — a repeated state application bumps nothing.
 */

import { batch, computed, signal, type ReadonlySignal } from '@preact/signals';
import {
  TIP_MASK_BYTES,
  registerMask,
  replaceMaskRegistry,
  resolveMask,
  type AquarelleTip,
} from '@efxlab/efx-watercolor';
import type { BrushLibraryEntry } from '../lib/ipc';
import type {
  PhysicPaintBrushCatalogEntry,
  PhysicPaintBrushCatalogPayload,
} from '../types/physicPaint';
import { decodeBridgeBase64, encodeBridgeBase64 } from '../lib/webpBytes';
import { builtinMaskEntries } from './builtinBrushTips';

/** The imported tips of the open project (empty on a project with no imports). */
const customBrushTipsSignal = signal<readonly AquarelleTip[]>([]);

/**
 * Tip ids whose stored asset failed to resolve on this open. Derived state, not
 * project data: it is replaced as a whole on every open and cleared on close.
 */
const unavailableTipIdsSignal = signal<ReadonlySet<string>>(new Set());

/** Monotonic mutation counter for derived-cache keying (D-20 / G-2 analog). */
const brushCatalogGenerationSignal = signal(0);

/**
 * WR-03: whether THIS realm instance has applied at least one catalog
 * snapshot. An empty `customBrushTips` is ambiguous — a project that imported
 * nothing looks exactly like a realm whose payload never arrived — so the
 * save leg consults this flag before attributing a missing mask to the wrong
 * cause. Deliberately NOT cleared by `resetAquarelleBrushCatalog`: closing a
 * project leaves the catalog empty-but-known, not un-delivered.
 */
const brushCatalogSyncedSignal = signal(false);

/** The imported tips of the open project, read-only (mutate via the setters). */
export const customBrushTips: ReadonlySignal<readonly AquarelleTip[]> = customBrushTipsSignal;

/** The per-open unavailable id set, read-only (replace via the one setter). */
export const unavailableTipIds: ReadonlySignal<ReadonlySet<string>> = unavailableTipIdsSignal;

/** How many imported tips are currently listed but unavailable to paint with. */
export const unavailableTipCount = computed(() => unavailableTipIdsSignal.value.size);

/** Monotonic catalog mutation counter; never bumped by a no-op write. */
export const brushCatalogGeneration: ReadonlySignal<number> = brushCatalogGenerationSignal;

/**
 * Whether this realm instance has ever applied a catalog payload (WR-03).
 * False only until the first `applyBrushCatalogPayload`; empty-after-delivery
 * still reads true.
 */
export const brushCatalogSynced: ReadonlySignal<boolean> = brushCatalogSyncedSignal;

/**
 * The MAIN realm's installed catalog transport (63-07 / TIP-17). This module
 * cannot import `physicPaintBridge` — the bridge imports THIS module for
 * `buildBrushCatalogPayload` — so the bridge's main-realm installer calls
 * `_setBrushCatalogPublisher` once at boot with
 * `publishPhysicPaintBrushCatalog`. Every project-scoped catalog mutation then
 * pushes the snapshot a Studio needs to paint and to save a script. Default is
 * a no-op: the Studio realm never owns project catalog state, and unit tests
 * opt in.
 */
export type BrushCatalogPublisher = () => void;
let brushCatalogPublisher: BrushCatalogPublisher = () => {};

/**
 * Install the one publisher every catalog change calls; returns the previous
 * one so the installer (or a test) can restore it. Named with the `_set*`
 * convention of the cross-store wiring callbacks in projectStore.
 */
export function _setBrushCatalogPublisher(publisher: BrushCatalogPublisher): BrushCatalogPublisher {
  const previous = brushCatalogPublisher;
  brushCatalogPublisher = publisher;
  return previous;
}

/**
 * The full catalog in display order: the machine library's rows in insertion
 * order. There are no compile-time built-ins (quick 261116-inu / spec 04) —
 * the surfaces' Default chip is their own `null` entry, never a catalog row,
 * so a fresh install with an empty library lists nothing here.
 */
export function listAquarelleBrushTips(): readonly AquarelleTip[] {
  return customBrushTipsSignal.value;
}

/**
 * Register ONE mask a loaded Roto script carries (63-08 / TIP-14 / D-14 /
 * T-63-23). REGISTRY ONLY — never a catalog row, never an unavailable id,
 * never a stored asset: a script's tips paint for this session but must not
 * become library data. A library replacement swaps the registry wholesale, so
 * nothing a script registered survives one. Returns false (and writes nothing)
 * unless the mask is exactly `TIP_MASK_BYTES` long — the engine's own
 * fail-closed law.
 */
export function registerScriptMask(id: string, mask: Uint8Array): boolean {
  return registerMask(id, mask);
}

/**
 * Resolve one tip id against the machine library's rows. `null` when the id is
 * unknown on this machine, which is the caller's signal to degrade to the
 * neutral round fallback (one warning).
 */
export function resolveCatalogTip(id: string): AquarelleTip | null {
  for (const tip of customBrushTipsSignal.value) {
    if (tip.id === id) return tip;
  }
  return null;
}

/**
 * Append one imported tip (D-16: a re-import of identical bytes yields a
 * DISTINCT entry — no silent dedupe; ids are minted by the import path).
 *
 * @deprecated The machine library's content-addressed rows go through
 * `upsertLibraryRow`; nothing mints ids any more.
 */
export function addCustomBrushTip(entry: AquarelleTip): void {
  batch(() => {
    customBrushTipsSignal.value = [...customBrushTipsSignal.value, entry];
    brushCatalogGenerationSignal.value += 1;
  });
}

// ---------------------------------------------------------------------------
// Machine library rows (quick 261116-inu / spec 04).
//
// The catalog stops being project data: one row per `catalog.json` entry,
// keyed by the content-derived tip id. `digest` and `textureRotation` are the
// library-only fields the tip record cannot carry (its wire guard has an exact
// member set). `libraryRowToTip` is the ONLY place an `AquarelleTip` is derived
// from a library row.
// ---------------------------------------------------------------------------

/** One library entry as this realm holds it: the tip half plus the two library-only fields. */
export interface AquarelleLibraryRow {
  readonly tip: AquarelleTip;
  /** SHA-256 of the stored WebP — 64 lower-case hex. */
  readonly digest: string;
  /** Projected-texture orientation, integer DEGREES in -180..180. */
  readonly textureRotation: number;
}

const libraryRowsSignal = signal<readonly AquarelleLibraryRow[]>([]);

/**
 * Monotonic library mutation counter: bumped once per REAL library change (an
 * import, a boot replacement, a future delete or rotation). It is the
 * cross-realm payload's staleness key — never a project identity.
 */
const libraryRevisionSignal = signal(0);

/** The machine library's rows, read-only (mutate via the setters). */
export const libraryRows: ReadonlySignal<readonly AquarelleLibraryRow[]> = libraryRowsSignal;

/** How many real library mutations this realm has recorded. */
export const libraryRevision: ReadonlySignal<number> = libraryRevisionSignal;

/**
 * ROW → TIP MAPPING. Copies exactly the tip members (`id`, `category`, `name`
 * and the eight multipliers) and NEVER the library-only `digest`,
 * `textureRotation` or `createdAt`. `BrushLibraryEntry` carries no `category`,
 * and `AquarelleTip` requires one, so imports land in `custom` — the only
 * category a machine library entry can have.
 */
export function libraryRowToTip(row: BrushLibraryEntry): AquarelleTip {
  return Object.freeze({
    id: row.id,
    category: 'custom' as const,
    name: row.name,
    tip: row.tip,
    aspect: row.aspect,
    rotation: row.rotation,
    sizeCurve: row.sizeCurve,
    scatter: row.scatter,
    capacity: row.capacity,
    grain: row.grain,
    wetRound: row.wetRound,
  });
}

/** The two library-only fields for one tip id; `null` when the id is not a library row. */
export function libraryRowFor(id: string): { digest: string; textureRotation: number } | null {
  for (const row of libraryRowsSignal.value) {
    if (row.tip.id === id) return { digest: row.digest, textureRotation: row.textureRotation };
  }
  return null;
}

/**
 * The reverse lookup: the tip id one digest belongs to, `null` when no row
 * carries it. quick 261116-inu / Task 6: the child resolves the digest's id
 * BEFORE asking for a delete — after the mutation and its catalog pull the row
 * is gone, and the post-delete selection law needs the id the child knew.
 */
export function tipIdForDigest(digest: string): string | null {
  for (const row of libraryRowsSignal.value) {
    if (row.digest === digest) return row.tip.id;
  }
  return null;
}

function sameLibraryRow(a: AquarelleLibraryRow, b: AquarelleLibraryRow): boolean {
  return (
    a.digest === b.digest
    && a.textureRotation === b.textureRotation
    && a.tip.id === b.tip.id
    && a.tip.category === b.tip.category
    && a.tip.name === b.tip.name
    && a.tip.tip === b.tip.tip
    && a.tip.aspect === b.tip.aspect
    && a.tip.rotation === b.tip.rotation
    && a.tip.sizeCurve === b.tip.sizeCurve
    && a.tip.scatter === b.tip.scatter
    && a.tip.capacity === b.tip.capacity
    && a.tip.grain === b.tip.grain
    && a.tip.wetRound === b.tip.wetRound
  );
}

/**
 * Upsert ONE library row keyed by its content-derived id. Re-importing the
 * same bytes resolves to the SAME row (no duplicate append). Compare-then-
 * write: an unchanged row bumps nothing. Bumps `brushCatalogGeneration` once
 * for a real change.
 */
export function upsertLibraryRow(row: AquarelleLibraryRow): void {
  const next: AquarelleLibraryRow[] = [];
  let replaced = false;
  let unchanged = false;
  for (const current of libraryRowsSignal.value) {
    if (current.tip.id !== row.tip.id) {
      next.push(current);
      continue;
    }
    if (!replaced && sameLibraryRow(current, row)) unchanged = true;
    replaced = true;
    next.push(row);
  }
  if (!replaced) next.push(row);
  // quick 261116-inu / Task 6: a row arriving WITH a resolvable mask is usable
  // again — re-importing bytes that were previously deleted must clear the id
  // from `unavailable` (a delete flags it; the flag would otherwise disable a
  // perfectly good chip for the rest of the session).
  const unavailable = unavailableTipIdsSignal.value;
  const clearing = unavailable.has(row.tip.id) && resolveMask(row.tip.id) !== null;
  if (unchanged && !clearing) return;
  batch(() => {
    if (!unchanged) {
      libraryRowsSignal.value = next;
      customBrushTipsSignal.value = next.map((entry) => entry.tip);
      brushCatalogGenerationSignal.value += 1;
      libraryRevisionSignal.value += 1;
    }
    if (clearing) {
      const nextUnavailable = new Set(unavailable);
      nextUnavailable.delete(row.tip.id);
      unavailableTipIdsSignal.value = nextUnavailable;
    }
  });
}

/**
 * REPLACE the whole machine library (boot scan / cross-realm payload). Never
 * appends. An identical row list AND an identical unavailable set is a no-op —
 * a repeated payload writes nothing and bumps no revision.
 */
export function replaceLibraryEntries(
  rows: readonly AquarelleLibraryRow[],
  unavailable: readonly string[] = [],
): void {
  const nextRows = [...rows];
  const currentRows = libraryRowsSignal.value;
  const rowsChanged =
    nextRows.length !== currentRows.length
    || nextRows.some((row, index) => !sameLibraryRow(row, currentRows[index]!));
  const nextUnavailable = new Set(unavailable);
  const currentUnavailable = unavailableTipIdsSignal.value;
  const unavailableChanged =
    nextUnavailable.size !== currentUnavailable.size
    || [...nextUnavailable].some((id) => !currentUnavailable.has(id));
  if (!rowsChanged && !unavailableChanged) return;
  batch(() => {
    if (rowsChanged) {
      libraryRowsSignal.value = nextRows;
      customBrushTipsSignal.value = nextRows.map((row) => row.tip);
    }
    if (unavailableChanged) unavailableTipIdsSignal.value = nextUnavailable;
    brushCatalogGenerationSignal.value += 1;
    // Boot is a real library change: the machine catalog now has an identity
    // the Studio can compare against. One bump per replacement.
    libraryRevisionSignal.value += 1;
  });
}

/** Push the current snapshot through the installed publisher (no-op until wired). */
export function publishBrushCatalog(): void {
  brushCatalogPublisher();
}

/**
 * Replace the whole custom set (project open / pack rehydrate). Never appends:
 * an open replaces, exactly like `replaceAvailable` laws elsewhere (D-20).
 * An identical list is a no-op — a repeated rehydrate writes nothing.
 */
export function replaceCustomBrushTips(entries: readonly AquarelleTip[]): void {
  const next = [...entries];
  const current = customBrushTipsSignal.value;
  if (
    next.length === current.length
    && next.every((tip, index) => tip === current[index])
  ) {
    return;
  }
  batch(() => {
    customBrushTipsSignal.value = next;
    brushCatalogGenerationSignal.value += 1;
  });
}

/**
 * The ONE writer of the unavailable set. Replace-only by construction: the
 * argument IS the new set, so `[]` clears it and a second call can never
 * append to the first. An identical set is a no-op.
 */
export function replaceUnavailableTipIds(ids: readonly string[]): void {
  const next = new Set(ids);
  const current = unavailableTipIdsSignal.value;
  if (next.size === current.size && [...next].every((id) => current.has(id))) {
    return;
  }
  batch(() => {
    unavailableTipIdsSignal.value = next;
    brushCatalogGenerationSignal.value += 1;
  });
}

/** Reset every catalog signal to empty (tests and explicit rebuilds). */
export function resetAquarelleBrushCatalog(): void {
  const hadCustoms = customBrushTipsSignal.value.length > 0;
  const hadUnavailable = unavailableTipIdsSignal.value.size > 0;
  const hadRows = libraryRowsSignal.value.length > 0;
  if (!hadCustoms && !hadUnavailable && !hadRows) return;
  batch(() => {
    customBrushTipsSignal.value = [];
    libraryRowsSignal.value = [];
    unavailableTipIdsSignal.value = new Set();
    brushCatalogGenerationSignal.value += 1;
  });
}

// ---------------------------------------------------------------------------
// 63-05 (D-20 / T-63-04): the cross-realm catalog snapshot.
//
// The Studio webview is a separate JS context whose module instances start
// empty and are re-created on every layer switch, so a push to the window
// cannot update its stores. The catalog therefore travels as ONE full
// snapshot: the main realm builds it here, and the Studio applies it into its
// OWN `aquarelleBrushCatalog` and `maskRegistry` instances with
// `applyBrushCatalogPayload`. Building and applying live next to the store
// they read/write so the two halves cannot drift; the payload type itself is
// a leaf type import (erased at build time), never a cycle.
// ---------------------------------------------------------------------------

/**
 * Project a tip onto exactly the wire member set (`AQUARELLE_TIP_MEMBER_KEYS`
 * in `types/physicPaint.ts`). The library owns the row shape, so this is the
 * ONE sender-side projection: a machine library row is ALWAYS a custom
 * texture (never a response), so `category` is pinned to `custom` exactly as
 * the wire guard requires.
 */
function wireTip(tip: AquarelleTip): AquarelleTip {
  return {
    id: tip.id,
    category: 'custom',
    name: tip.name,
    tip: tip.tip,
    aspect: tip.aspect,
    rotation: tip.rotation,
    sizeCurve: tip.sizeCurve,
    scatter: tip.scatter,
    capacity: tip.capacity,
    grain: tip.grain,
    wetRound: tip.wetRound,
  };
}

/**
 * The MAIN realm's snapshot of the machine library. Each entry carries its
 * content address (`digest`), its integer-degree `textureRotation`, and its
 * decoded mask. A row whose mask is missing from the registry travels with no
 * mask leg — its id also rides `unavailableTipIds`.
 */
export function buildBrushCatalogPayload(libraryRevision: number): PhysicPaintBrushCatalogPayload {
  const entries: PhysicPaintBrushCatalogEntry[] = [];
  for (const row of libraryRowsSignal.value) {
    const tip = wireTip(row.tip);
    const mask = resolveMask(tip.id);
    entries.push({
      tip,
      digest: row.digest,
      textureRotation: row.textureRotation,
      ...(mask === null ? {} : { maskBase64: encodeBridgeBase64(mask) }),
    });
  }
  return {
    libraryRevision,
    entries,
    unavailableTipIds: [...unavailableTipIdsSignal.value],
  };
}

function decodeBase64OrNull(value: string): Uint8Array | null {
  try {
    return decodeBridgeBase64(value);
  } catch {
    return null;
  }
}

/**
 * The STUDIO realm's one application path: replace this realm's customs, mask
 * registry (the payload's decoded masks UNIONED with the bundled app assets
 * this realm registered at boot) and unavailable set, then let the setters
 * bump `brushCatalogGeneration` for every real change. quick 261127-uxj: the
 * bundled Wootha tips are APP ASSETS, not payload entries — a payload
 * application replaces the registry, so the union is what keeps them
 * registered in the Studio realm; the payload itself stays user-library-only.
 * Replace-only by construction — a second payload without a prior id leaves
 * that id unresolvable and unlisted. Never appends, never throws on one bad
 * entry (the wire guard refuses a malformed payload whole; this defensive
 * branch degrades a single undecodable mask to unavailable instead).
 */
export function applyBrushCatalogPayload(payload: PhysicPaintBrushCatalogPayload): void {
  const rows: AquarelleLibraryRow[] = [];
  const masks: { id: string; mask: Uint8Array }[] = [];
  const unavailable = new Set<string>(payload.unavailableTipIds);
  for (const entry of payload.entries) {
    const tip = { ...entry.tip };
    rows.push({ tip, digest: entry.digest, textureRotation: entry.textureRotation });
    if (entry.maskBase64 !== undefined) {
      const mask = decodeBase64OrNull(entry.maskBase64);
      if (mask !== null && mask.length === TIP_MASK_BYTES) {
        masks.push({ id: tip.id, mask });
      } else {
        unavailable.add(tip.id);
      }
    }
  }
  batch(() => {
    replaceLibraryEntries(rows, [...unavailable]);
    // The bundled defaults ride EVERY registry replacement: the payload owns
    // the user masks, never the app's own assets.
    replaceMaskRegistry([...masks, ...builtinMaskEntries()]);
    // WR-03: this realm instance applied a catalog snapshot. From here on an
    // empty custom list means the machine library has no rows (known-empty),
    // not that the push never arrived — the save leg relies on that
    // distinction. Compare before writing so a repeated payload changes no
    // state at all.
    if (!brushCatalogSyncedSignal.value) brushCatalogSyncedSignal.value = true;
    // Adopt the MAIN realm's revision: the child's reads are only stale when
    // the owner's count differs. A replacement bump above is superseded here.
    if (libraryRevisionSignal.value !== payload.libraryRevision) {
      libraryRevisionSignal.value = payload.libraryRevision;
    }
  });
}
