/**
 * aquarelleBrushCatalog — the project-scoped brush-tip catalog (63-04 /
 * TIP-11 / TIP-13 / D-10 / D-20).
 *
 * WHAT THIS OWNS
 *   · `customBrushTips`    — the imported tips of the OPEN project. Backed by
 *                            `customTips`-style module state, but owned by the
 *                            project instead of the docker UI, so a save can
 *                            emit the pack (see `buildProjectBrushPack`).
 *   · `unavailableTipIds`  — the per-open set of ids whose stored asset could
 *                            not be resolved. REPLACE-ONLY: one setter,
 *                            `replaceUnavailableTipIds`, mirrors D-20 (an open
 *                            replaces, a close resets) and can never be
 *                            appended to by accident.
 *   · `brushCatalogGeneration` — bumped on every real mutation so derived
 *                            readers can key a cache (maskGeneration analog).
 *
 * WHY THIS LIVES IN `app/src/stores/` (recorded relocation)
 *   PATTERNS.md G-N classifies `aquarelleBrushCatalog` under
 *   `app/src/components/physic-paint/view/` (analogs: `BrushesDocker.tsx`'s
 *   `customTips` module signal and `aquarelleRecordState.ts`). This module is
 *   placed in `app/src/stores/` instead because BOTH realms import it — the
 *   main window publishes the catalog into the `.mce`, the Studio child
 *   applies it — and every other cross-realm store in the project lives under
 *   `app/src/stores/`. The two analogs supply the signal conventions, not the
 *   directory; the move is deliberate, not drift.
 *
 * TRUTH SOURCE
 *   The three built-ins ALWAYS come from `BUILTIN_TIPS` (63-03) and are never
 *   stored in a project: `buildProjectBrushPack` returns entries over CUSTOM
 *   tips only, and `null` when there are none, so a project with no imports
 *   omits the `brushPack` key entirely (D-10).
 *
 * Preact signals only (no `useState`); every setter compares before writing and
 * is idempotent — a repeated state application bumps nothing.
 */

import { batch, computed, signal, type ReadonlySignal } from '@preact/signals';
import {
  BUILTIN_TIP_MASKS,
  BUILTIN_TIPS,
  TIP_MASK_BYTES,
  buildBrushPackSnapshot,
  registerMask,
  replaceMaskRegistry,
  resetMaskRegistry,
  resolveMask,
  type AquarelleTip,
} from '@efxlab/efx-watercolor';
import type { MceBrushPackSnapshot } from '../types/project';
import type { BrushLibraryEntry } from '../lib/ipc';
import type {
  PhysicPaintBrushCatalogEntry,
  PhysicPaintBrushCatalogPayload,
} from '../types/physicPaint';
import {
  brushAssetBytes,
  brushAssetDigestFromPath,
  markBrushAssetsWritten,
  rememberBrushAsset,
  resetBrushAssets,
} from '../lib/efxPaintBrushAssets';
import { decodeBridgeBase64, encodeBridgeBase64 } from '../lib/webpBytes';
import { normalizeProjectBrushTip, type ProjectBrushSet } from '../lib/efxPaintBrushSet';

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
 * The full catalog in display order: the three built-ins from `BUILTIN_TIPS`
 * first, then the project's customs in insertion order. A fresh install with
 * no project still lists exactly the three built-ins (TIP-13).
 */
export function listAquarelleBrushTips(): readonly AquarelleTip[] {
  return [...BUILTIN_TIPS, ...customBrushTipsSignal.value];
}

/**
 * Register ONE mask a loaded Roto script carries (63-08 / TIP-14 / D-14 /
 * T-63-23). REGISTRY ONLY — never a catalog row, never an unavailable id,
 * never a stored asset: a script's tips paint for this session but must not
 * become project data. The next project open replaces the whole registry and
 * a close resets it to the three built-ins, so nothing a script registered
 * survives a project switch. Returns false (and writes nothing) unless the
 * mask is exactly `TIP_MASK_BYTES` long — the engine's own fail-closed law.
 */
export function registerScriptMask(id: string, mask: Uint8Array): boolean {
  return registerMask(id, mask);
}

/**
 * Resolve one tip id against the catalog: built-ins first, then project
 * customs. `null` when the id is unknown to this install/project, which is the
 * caller's signal to degrade to the neutral round fallback (one warning).
 */
export function resolveCatalogTip(id: string): AquarelleTip | null {
  for (const tip of BUILTIN_TIPS) {
    if (tip.id === id) return tip;
  }
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

/** The machine library's rows, read-only (mutate via the setters). */
export const libraryRows: ReadonlySignal<readonly AquarelleLibraryRow[]> = libraryRowsSignal;

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
  if (unchanged) return;
  batch(() => {
    libraryRowsSignal.value = next;
    customBrushTipsSignal.value = next.map((entry) => entry.tip);
    brushCatalogGenerationSignal.value += 1;
  });
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

/**
 * Close / New Project (63-07 / D-20 / TIP-17 / T-63-21): back to exactly the
 * three built-ins. The customs and the unavailable set clear (one catalog
 * generation bump when anything changed), the mask registry returns to the
 * built-in masks only, the stored-asset cache empties, and the Studio receives
 * the resulting snapshot. Idempotent: a repeated reset writes no state.
 */
export function resetAquarelleBrushState(): void {
  resetAquarelleBrushCatalog();
  resetMaskRegistry();
  resetBrushAssets();
  brushCatalogPublisher();
}

// ---------------------------------------------------------------------------
// 63-07 (D-17 / D-18 / D-20 / TIP-07): apply ONE open's brush set.
//
// The main realm is the only realm that reads package assets; this function
// installs what `loadProjectBrushSet` decoded. It is REPLACE-ONLY by
// construction — the set IS the project's state, so opening B overwrites A's
// customs, registry rows and unavailable set in one batch, and an empty set
// restores exactly the three built-ins (T-63-21).
// ---------------------------------------------------------------------------

/**
 * Apply the open project's decoded brush set: replace the customs, replace the
 * mask registry (built-ins first, then this set's masks), replace the
 * unavailable set, and remember every stored WebP body so a later save copies
 * it verbatim (D-11 / TIP-07). The bytes are also marked written for THIS
 * package root: the open read them from the package, so a save without an
 * import stages nothing.
 *
 * A body the content-addressed cache refuses (a different payload under an
 * already-remembered digest) is logged, never thrown: the tip's mask is still
 * live for painting, and a subsequent save cannot copy that asset.
 */
export function applyProjectBrushSet(set: ProjectBrushSet, packageRoot: string): void {
  const masks: { id: string; mask: Uint8Array }[] = [...BUILTIN_TIP_MASKS];
  for (const entry of set.masks) masks.push({ id: entry.id, mask: entry.mask });
  batch(() => {
    replaceCustomBrushTips(set.entries.map((entry) => entry.tip));
    replaceMaskRegistry(masks);
    replaceUnavailableTipIds(set.unavailableTipIds);
  });
  const written: string[] = [];
  for (const asset of set.assets) {
    try {
      rememberBrushAsset(asset.digest, asset.webp);
      written.push(asset.digest);
    } catch (error) {
      console.error(
        `[aquarelleBrushCatalog] open: stored brush asset "${asset.digest}" was refused by the asset cache — ${String(error)}. The tip's mask stays registered, but a later save cannot copy its stored bytes.`,
      );
    }
  }
  markBrushAssetsWritten(packageRoot, written);
  // The Studio paints and saves from THIS snapshot: one push per applied open.
  brushCatalogPublisher();
}

/**
 * The `.mce` root `brushPack` value: entries over CUSTOM tips only, each with
 * its package-relative `asset` ref (validated by the pack builder). Returns
 * `null` when there are no customs — the caller must then omit the key
 * entirely rather than emit an empty pack (D-10). Built-in ids can never
 * appear here: they are not part of the custom list and are never persisted.
 *
 * WR-07 / T-63-27 (D-18): the whole-list fast path is unchanged, but a
 * refusal no longer erases the pack. When `buildBrushPackSnapshot` refuses the
 * list, each tip is retried ALONE in insertion order — the first entry for an
 * id wins — so a validation failure costs exactly the offending tip and every
 * other imported tip still persists. Each dropped tip is logged by id with its
 * class (invalid record / duplicate id); `null` is returned only when nothing
 * survives (the project then omits the key, as today).
 */
export function buildProjectBrushPack(): MceBrushPackSnapshot | null {
  const customs = customBrushTipsSignal.value;
  if (customs.length === 0) return null;
  const snapshot = buildBrushPackSnapshot(customs);
  if (snapshot !== null) return { kind: snapshot.kind, entries: [...snapshot.entries] };

  // Per-entry fallback (D-18): one bad entry degrades alone, never the set.
  const seen = new Set<string>();
  const entries: unknown[] = [];
  let kind: string | null = null;
  for (const tip of customs) {
    const single = buildBrushPackSnapshot([tip]);
    if (single === null) {
      console.error(
        `[aquarelleBrushCatalog] save: dropping brush tip "${tip.id}" — the record fails the package carrier law (invalid record).`,
      );
      continue;
    }
    if (seen.has(tip.id)) {
      console.error(
        `[aquarelleBrushCatalog] save: dropping duplicate brush tip "${tip.id}" — the first inserted entry is kept.`,
      );
      continue;
    }
    seen.add(tip.id);
    if (kind === null) kind = single.kind;
    entries.push(...single.entries);
  }
  if (entries.length === 0) return null;
  return { kind: kind as string, entries };
}

// ---------------------------------------------------------------------------
// 63-05 (D-20 / T-63-04): the cross-realm catalog snapshot.
//
// The Studio webview is a separate JS context whose module instances start
// empty and are re-created on every layer switch, so a push to the window
// cannot update its stores. The catalog therefore travels as ONE full
// snapshot: the main realm builds it here, and the Studio applies it into its
// OWN `aquarelleBrushCatalog`, `maskRegistry` and `efxPaintBrushAssets`
// instances with `applyBrushCatalogPayload`. Building and applying live next
// to the store they read/write so the two halves cannot drift; the payload
// type itself is a leaf type import (erased at build time), never a cycle.
// ---------------------------------------------------------------------------

/**
 * The MAIN realm's snapshot of the open project's custom tips. Each entry
 * carries its decoded mask and its stored WebP bytes when this realm has
 * them; an unavailable tip travels with neither (its id also rides
 * `unavailableTipIds`). Built-ins never travel — both realms derive them from
 * `BUILTIN_TIPS` / `BUILTIN_TIP_MASKS`.
 *
 * CR-01 / T-63-25: every tip is projected through `normalizeProjectBrushTip`,
 * the SAME admission law the open loader applies. A tip the store somehow
 * holds in a shape the strict wire guard refuses (foreign category, stray
 * member, or a built-in id) is normalized, or dropped, HERE — so one such tip
 * can never refuse the Studio's snapshot whole.
 */
export function buildBrushCatalogPayload(contextId: string): PhysicPaintBrushCatalogPayload {
  const entries: PhysicPaintBrushCatalogEntry[] = [];
  for (const tip of customBrushTipsSignal.value) {
    const normalized = normalizeProjectBrushTip(tip);
    if (normalized === null) continue;
    const mask = resolveMask(normalized.id);
    const digest = brushAssetDigestFromPath(normalized.asset);
    const webp = digest === null ? undefined : brushAssetBytes(digest);
    entries.push({
      tip: normalized,
      ...(mask === null ? {} : { maskBase64: encodeBridgeBase64(mask) }),
      ...(webp === undefined ? {} : { webpBase64: encodeBridgeBase64(webp) }),
    });
  }
  return {
    contextId,
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
 * registry (built-ins first, then the payload's decoded masks), unavailable
 * set and remembered asset bytes, then let the setters bump
 * `brushCatalogGeneration` for every real change. Replace-only by
 * construction — a second payload without a prior id leaves that id
 * unresolvable and unlisted. Never appends, never throws on one bad entry
 * (the wire guard refuses a malformed payload whole; this defensive branch
 * degrades a single undecodable mask to unavailable instead).
 */
export function applyBrushCatalogPayload(payload: PhysicPaintBrushCatalogPayload): void {
  const entries: AquarelleTip[] = [];
  const masks: { id: string; mask: Uint8Array }[] = [...BUILTIN_TIP_MASKS];
  const unavailable = new Set<string>(payload.unavailableTipIds);
  for (const entry of payload.entries) {
    const tip = { ...entry.tip };
    entries.push(tip);
    if (entry.maskBase64 !== undefined) {
      const mask = decodeBase64OrNull(entry.maskBase64);
      if (mask !== null && mask.length === TIP_MASK_BYTES) {
        masks.push({ id: tip.id, mask });
      } else {
        unavailable.add(tip.id);
      }
    }
    if (entry.webpBase64 !== undefined) {
      const digest = brushAssetDigestFromPath(tip.asset);
      const webp = decodeBase64OrNull(entry.webpBase64);
      if (digest !== null && webp !== null) {
        try {
          rememberBrushAsset(digest, webp);
        } catch {
          // A conflicting body under the same digest is refused loudly by the
          // asset cache; the already-remembered bytes stay authoritative.
        }
      }
    }
  }
  batch(() => {
    replaceCustomBrushTips(entries);
    replaceMaskRegistry(masks);
    replaceUnavailableTipIds([...unavailable]);
    // WR-03: this realm instance applied a catalog snapshot. From here on an
    // empty custom list means the project has no imports (known-empty), not
    // that the push never arrived — the save leg relies on that distinction.
    // Compare before writing so a repeated payload changes no state at all.
    if (!brushCatalogSyncedSignal.value) brushCatalogSyncedSignal.value = true;
  });
}
