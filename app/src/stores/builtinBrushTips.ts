/**
 * builtinBrushTips — the 22 Wootha tips that SHIP with the app (quick
 * 261127-uxj).
 *
 * WHAT THIS OWNS
 *   The bundled default textures the Textures surfaces list between the
 *   Default chip and the user's machine-library imports. Each is a read-only
 *   APP ASSET under `app/src/assets/brush-tips/`: a 262,144-byte mask file (the
 *   engine's `TIP_MASK_BYTES`) plus an id in the `wc/default-<slug>` asset
 *   namespace. They are NOT machine-library rows: nothing here touches
 *   `customBrushTips`, `libraryRows`, `libraryRevision`, `unavailableTipIds` or
 *   the cross-realm payload — deliberately, so a bundled tip can never be
 *   deleted, rotated, script-carried or duplicated as a user import.
 *
 * PER-REALM BY CONSTRUCTION
 *   Both realms import this module, and the Studio boots its own instance, so
 *   each realm registers the bundled masks in its OWN engine registry at boot —
 *   they must not ride the cross-realm brush payload.
 *
 * LAWS
 *   · The signal starts EMPTY (`Object.freeze([])`), never pre-populated from
 *     the manifest: the surfaces list nothing until the boot load runs.
 *   · `loadBuiltinBrushTips` is single-flight and session-idempotent — one
 *     in-flight promise is shared, and a later call returns the first summary
 *     and loads nothing. It NEVER rejects: a bad entry, a missing asset, a
 *     wrong-length payload or a refused registration is skipped with one warn.
 *   · Fail-closed double gate: the bytes must be a `Uint8Array` of exactly
 *     `TIP_MASK_BYTES` AND `registerMask` must accept them.
 *   · The whole set applies in ONE `batch()` at the end, compare-then-write —
 *     identical ids and names write nothing.
 *   · `builtinMaskEntries()` is the identity-stable list of the registered
 *     pairs; the realm's registry-replacing seams (a catalog payload, a user
 *     delete) union it so bundled masks are never dropped.
 *
 * Preact signals only (no `useState`), no signal write outside the load.
 */

import { batch, signal, type ReadonlySignal } from '@preact/signals';
import { TIP_MASK_BYTES, registerMask, type AquarelleTip } from '@efxlab/efx-watercolor';
import { NEUTRAL_TOOL_OVERRIDES } from '@efxlab/efx-watercolor/brushes';
import manifest from '../assets/brush-tips/manifest.json';

/** Load bytes for ONE manifest `file` name; `null` when it cannot be read. */
export type BuiltinTipMaskPort = (file: string) => Promise<Uint8Array | null>;

/** One registered bundled pair — the exact array the registry holds. */
export interface BuiltinTipMaskEntry {
  readonly id: string;
  readonly mask: Uint8Array;
}

/** What one load achieved; `skipped` names every tip that did not register. */
export interface BuiltinBrushTipsLoadResult {
  readonly loaded: number;
  readonly skipped: readonly string[];
}

/** The empty initial value — a stable frozen identity the tests can compare. */
const EMPTY_TIPS: readonly AquarelleTip[] = Object.freeze([]);
const EMPTY_ENTRIES: readonly BuiltinTipMaskEntry[] = Object.freeze([]);

const builtinBrushTipsSignal = signal<readonly AquarelleTip[]>(EMPTY_TIPS);

/** The loaded bundled tips, read-only (mutate via the loader). */
export const builtinBrushTips: ReadonlySignal<readonly AquarelleTip[]> = builtinBrushTipsSignal;

/** The registered pairs, identity-stable across reads until a real reload. */
let loadedEntries: readonly BuiltinTipMaskEntry[] = EMPTY_ENTRIES;

/** The pairs this realm registered at boot (empty until the load runs). */
export function builtinMaskEntries(): readonly BuiltinTipMaskEntry[] {
  return loadedEntries;
}

/** One in-flight load shared by concurrent callers; the first summary wins. */
let inFlight: Promise<BuiltinBrushTipsLoadResult> | null = null;
let sessionResult: BuiltinBrushTipsLoadResult | null = null;

/**
 * The default port: the app bundle's own asset URLs. `import.meta.glob`
 * resolves every `*.mask` at build time to a URL (eager, `?url`) — the bytes
 * are fetched once per realm at boot, never inlined into the JS chunk.
 */
const maskUrls = import.meta.glob<string>('../assets/brush-tips/*.mask', {
  query: '?url',
  import: 'default',
  eager: true,
});

const urlByFile = new Map<string, string>();
for (const [path, url] of Object.entries(maskUrls)) {
  const file = path.split('/').pop();
  if (file !== undefined) urlByFile.set(file, url);
}

async function fetchBuiltinMask(file: string): Promise<Uint8Array | null> {
  const url = urlByFile.get(file);
  if (url === undefined) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }
}

/** The bundled asset namespace: never the machine library's `wc/custom-*`. */
function isValidBundledId(id: string): boolean {
  return id.startsWith('wc/default-') && !id.startsWith('wc/custom-');
}

async function loadOnce(port: BuiltinTipMaskPort): Promise<BuiltinBrushTipsLoadResult> {
  const skipped: string[] = [];
  try {
    const raw: readonly unknown[] = Array.isArray(manifest.tips) ? manifest.tips : [];
    if (raw.length === 0) {
      console.warn('[builtinBrushTips] manifest carries no tips — no bundled defaults this session');
      return { loaded: 0, skipped };
    }
    const tips: AquarelleTip[] = [];
    const entries: BuiltinTipMaskEntry[] = [];
    const seen = new Set<string>();
    for (const item of raw) {
      const record = item as { id?: unknown; name?: unknown; file?: unknown };
      const id = typeof record?.id === 'string' ? record.id : '';
      const name = typeof record?.name === 'string' ? record.name : '';
      const file = typeof record?.file === 'string' ? record.file : '';
      if (!isValidBundledId(id) || name.length === 0 || file.length === 0 || seen.has(id)) {
        console.warn('[builtinBrushTips] skipping a malformed manifest entry', item);
        skipped.push(id.length > 0 ? id : file);
        continue;
      }
      let mask: Uint8Array | null = null;
      try {
        mask = await port(file);
      } catch {
        mask = null;
      }
      if (!(mask instanceof Uint8Array) || mask.length !== TIP_MASK_BYTES) {
        console.warn(
          `[builtinBrushTips] skipping ${id}: the asset is missing or not ${TIP_MASK_BYTES} bytes`,
        );
        skipped.push(id);
        continue;
      }
      // Fail-closed double gate: the registry's own length law must also accept it.
      if (!registerMask(id, mask)) {
        console.warn(`[builtinBrushTips] skipping ${id}: the mask registry refused the asset`);
        skipped.push(id);
        continue;
      }
      seen.add(id);
      tips.push(
        Object.freeze({
          id,
          category: 'custom' as const,
          name,
          ...NEUTRAL_TOOL_OVERRIDES,
        }),
      );
      entries.push({ id, mask });
    }
    if (entries.length > 0) {
      loadedEntries = Object.freeze(entries);
      const current = builtinBrushTipsSignal.value;
      const identical =
        current.length === tips.length
        && tips.every((tip, index) => current[index]!.id === tip.id && current[index]!.name === tip.name);
      // ONE batch, compare-then-write: an identical set writes nothing.
      if (!identical) {
        batch(() => {
          builtinBrushTipsSignal.value = Object.freeze(tips);
        });
      }
    }
    return { loaded: tips.length, skipped };
  } catch (error) {
    // The boot path may never reject: rendering must not wait on bundled tips.
    console.warn('[builtinBrushTips] bundled tip load failed — continuing without them', error);
    return { loaded: 0, skipped };
  }
}

/**
 * Load the bundled tips into this realm ONCE (single-flight, session-idempotent)
 * and register every valid mask under its `wc/default-*` id. Never rejects.
 * Tests inject a port; production uses the app's own asset URLs.
 */
export async function loadBuiltinBrushTips(
  port: BuiltinTipMaskPort = fetchBuiltinMask,
): Promise<BuiltinBrushTipsLoadResult> {
  if (sessionResult !== null) return sessionResult;
  if (inFlight !== null) return inFlight;
  inFlight = loadOnce(port);
  try {
    sessionResult = await inFlight;
    return sessionResult;
  } finally {
    inFlight = null;
  }
}

/**
 * Clear the signal, the loaded pairs and the session memo (test isolation and
 * explicit rebuilds). Does not unregister masks — the registry's own reset owns
 * that, so a caller owns both halves deliberately.
 */
export function resetBuiltinBrushTips(): void {
  sessionResult = null;
  inFlight = null;
  loadedEntries = EMPTY_ENTRIES;
  if (builtinBrushTipsSignal.value.length > 0) {
    builtinBrushTipsSignal.value = EMPTY_TIPS;
  }
}
