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
import { BUILTIN_TIPS, buildBrushPackSnapshot, type AquarelleTip } from '@efxlab/efx-watercolor';
import type { MceBrushPackSnapshot } from '../types/project';

/** The imported tips of the open project (empty on a project with no imports). */
const customBrushTipsSignal = signal<readonly AquarelleTip[]>([]);

/**
 * Tip ids whose stored asset failed to resolve on this open. Derived state, not
 * project data: it is replaced as a whole on every open and cleared on close.
 */
const unavailableTipIdsSignal = signal<ReadonlySet<string>>(new Set());

/** Monotonic mutation counter for derived-cache keying (D-20 / G-2 analog). */
const brushCatalogGenerationSignal = signal(0);

/** The imported tips of the open project, read-only (mutate via the setters). */
export const customBrushTips: ReadonlySignal<readonly AquarelleTip[]> = customBrushTipsSignal;

/** The per-open unavailable id set, read-only (replace via the one setter). */
export const unavailableTipIds: ReadonlySignal<ReadonlySet<string>> = unavailableTipIdsSignal;

/** How many imported tips are currently listed but unavailable to paint with. */
export const unavailableTipCount = computed(() => unavailableTipIdsSignal.value.size);

/** Monotonic catalog mutation counter; never bumped by a no-op write. */
export const brushCatalogGeneration: ReadonlySignal<number> = brushCatalogGenerationSignal;

/**
 * The full catalog in display order: the three built-ins from `BUILTIN_TIPS`
 * first, then the project's customs in insertion order. A fresh install with
 * no project still lists exactly the three built-ins (TIP-13).
 */
export function listAquarelleBrushTips(): readonly AquarelleTip[] {
  return [...BUILTIN_TIPS, ...customBrushTipsSignal.value];
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
 */
export function addCustomBrushTip(entry: AquarelleTip): void {
  batch(() => {
    customBrushTipsSignal.value = [...customBrushTipsSignal.value, entry];
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

/** Close / New Project / project switch: customs and the unavailable set reset. */
export function resetAquarelleBrushCatalog(): void {
  const hadCustoms = customBrushTipsSignal.value.length > 0;
  const hadUnavailable = unavailableTipIdsSignal.value.size > 0;
  if (!hadCustoms && !hadUnavailable) return;
  batch(() => {
    customBrushTipsSignal.value = [];
    unavailableTipIdsSignal.value = new Set();
    brushCatalogGenerationSignal.value += 1;
  });
}

/**
 * The `.mce` root `brushPack` value: entries over CUSTOM tips only, each with
 * its package-relative `asset` ref (validated by the pack builder). Returns
 * `null` when there are no customs — the caller must then omit the key
 * entirely rather than emit an empty pack (D-10). Built-in ids can never
 * appear here: they are not part of the custom list and are never persisted.
 */
export function buildProjectBrushPack(): MceBrushPackSnapshot | null {
  const customs = customBrushTipsSignal.value;
  if (customs.length === 0) return null;
  const snapshot = buildBrushPackSnapshot(customs);
  if (snapshot === null) return null;
  return { kind: snapshot.kind, entries: [...snapshot.entries] };
}
