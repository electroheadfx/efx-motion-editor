/**
 * efxPaintBrushSet — the project-open leg of the brush-tip pipeline
 * (63-07 / TIP-07 / TIP-12 / TIP-17 / D-17 / D-18).
 *
 * WHAT THIS OWNS
 *   `loadProjectBrushSet` turns the `.mce` root `brushPack` into the state an
 *   open can apply: the validated package entries paired with their decoded
 *   36,864-byte masks, the unavailable ids, the stored WebP bodies, and the
 *   per-tip failures the caller logs. It mirrors `efxPaintMediaMaterialize`:
 *   ONE native batch read for the whole set, failures collected (never
 *   thrown) so one bad tip costs exactly one tip (D-18), and no mask is ever
 *   re-derived on open — the native command decodes the stored asset behind
 *   its pre-decode dimension guard (T-63-20).
 *
 * ORDERING LAW (D-17)
 *   `projectStore.openProject` awaits this loader BEFORE the close/reset step
 *   and applies its result AFTER that step and BEFORE `hydrateFromMce`, so the
 *   paint surface never exists in a half-registered state (TIP-12).
 *
 * FAILURE VOCABULARY
 *   The five per-entry reasons come from the native read (`missing`,
 *   `unreadable`, `wrong-size`, `digest-mismatch`, `refused`). Three local
 *   classes complete it: `invalid-entry` (the record fails the package
 *   carrier law), `invalid-asset-ref` (a valid record with no resolvable
 *   `brushes/<sha256>.webp` ref) and `batch-failed` (the whole call refused,
 *   which degrades every requested tip rather than aborting the open).
 *
 * NEVER APPENDS, NEVER THROWS
 *   The returned set IS the project's state: replacing the catalog and the
 *   registry with it is the only application path (`applyProjectBrushSet`),
 *   so a project's tips can never accumulate on top of another project's.
 */

import { TIP_MASK_BYTES, asTipRecord, type AquarelleTip } from '@efxlab/efx-watercolor';
import type { MceBrushPackSnapshot } from '../types/project';
import {
  ipcEfxPaintReadBrushAssets,
  type EfxPaintBrushAssetReadEntry,
  type EfxPaintBrushAssetReadReason,
  type EfxPaintMediaFailure,
  type Result,
} from './ipc';
import { brushAssetDigestFromPath } from './efxPaintBrushAssets';

/** Why one tip could not be materialized on this open. */
export type ProjectBrushSetFailureReason =
  | EfxPaintBrushAssetReadReason
  | 'invalid-entry'
  | 'invalid-asset-ref'
  | 'batch-failed';

/** One logged degradation: the tip id (best-effort when the record is bad) and why. */
export interface ProjectBrushSetFailure {
  readonly tipId: string;
  readonly reason: ProjectBrushSetFailureReason;
}

/** One healthy tip: its validated record, its content address and decoded mask. */
export interface ProjectBrushSetEntry {
  readonly tip: AquarelleTip;
  readonly digest: string;
  readonly mask: Uint8Array;
}

/** One registry row the open contributes (built-ins are added by the applier). */
export interface ProjectBrushSetMask {
  readonly id: string;
  readonly mask: Uint8Array;
}

/** One stored asset body, remembered so a save copies it without re-encoding. */
export interface ProjectBrushSetAsset {
  readonly digest: string;
  readonly webp: Uint8Array;
}

/**
 * The whole outcome of one open's brush read. `entries` / `masks` / `assets`
 * cover the healthy tips; `unavailableTipIds` and `failures` cover the rest.
 */
export interface ProjectBrushSet {
  readonly entries: readonly ProjectBrushSetEntry[];
  readonly masks: readonly ProjectBrushSetMask[];
  readonly unavailableTipIds: readonly string[];
  readonly assets: readonly ProjectBrushSetAsset[];
  readonly failures: readonly ProjectBrushSetFailure[];
}

/**
 * The one native read the open performs. Injectable so the loader's law is
 * testable without the Tauri boundary; the default is the batch command that
 * reads, digest-verifies and decodes the whole set in ONE call (D-17).
 */
export type ProjectBrushSetReadPort = (
  packageDir: string,
  entries: readonly { id: string; relativePath: string }[],
) => Promise<Result<EfxPaintBrushAssetReadEntry[], EfxPaintMediaFailure>>;

/** The honest empty answer: a project with no `brushPack` imports nothing. */
const EMPTY_SET: ProjectBrushSet = Object.freeze({
  entries: Object.freeze([]) as readonly ProjectBrushSetEntry[],
  masks: Object.freeze([]) as readonly ProjectBrushSetMask[],
  unavailableTipIds: Object.freeze([]) as readonly string[],
  assets: Object.freeze([]) as readonly ProjectBrushSetAsset[],
  failures: Object.freeze([]) as readonly ProjectBrushSetFailure[],
});

/** The raw record's id when it carries a usable one — for the failure log only. */
function readTipId(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null) return '<malformed>';
  const id = (raw as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : '<malformed>';
}

/**
 * Load one project's brush set from its manifest snapshot. Total: every
 * malformed record and every failed read degrades that tip, never the open;
 * the returned arrays are immutable copies owned by the caller.
 */
export async function loadProjectBrushSet(
  packageDir: string,
  snapshot: MceBrushPackSnapshot | undefined,
  readPort: ProjectBrushSetReadPort = ipcEfxPaintReadBrushAssets,
): Promise<ProjectBrushSet> {
  if (snapshot === undefined || !Array.isArray(snapshot.entries)) return EMPTY_SET;

  const failures: ProjectBrushSetFailure[] = [];
  const tips: AquarelleTip[] = [];
  const refs: { id: string; relativePath: string }[] = [];
  const seen = new Set<string>();

  for (const raw of snapshot.entries) {
    const tip = asTipRecord(raw, 'package');
    if (tip === null) {
      failures.push(Object.freeze({ tipId: readTipId(raw), reason: 'invalid-entry' as const }));
      continue;
    }
    if (seen.has(tip.id)) {
      // Fail-closed: a duplicate id never overwrites the first (the pack
      // builder refuses duplicates whole; this per-entry path keeps the open).
      failures.push(Object.freeze({ tipId: tip.id, reason: 'invalid-entry' as const }));
      continue;
    }
    seen.add(tip.id);
    const digest = tip.asset === undefined ? null : brushAssetDigestFromPath(tip.asset);
    if (digest === null || tip.asset === undefined) {
      failures.push(Object.freeze({ tipId: tip.id, reason: 'invalid-asset-ref' as const }));
      continue;
    }
    tips.push(tip);
    refs.push({ id: tip.id, relativePath: tip.asset });
  }

  if (refs.length === 0) {
    return Object.freeze({
      entries: Object.freeze([]) as readonly ProjectBrushSetEntry[],
      masks: Object.freeze([]) as readonly ProjectBrushSetMask[],
      unavailableTipIds: Object.freeze([]) as readonly string[],
      assets: Object.freeze([]) as readonly ProjectBrushSetAsset[],
      failures: Object.freeze(failures),
    });
  }

  const read = await readPort(packageDir, refs);
  if (!read.ok) {
    // The whole call failed: every requested tip degrades. The open proceeds
    // with the built-ins plus its other stores — never an aborted project.
    const unavailable = refs.map((ref) => ref.id);
    const refused = refs.map((ref) =>
      Object.freeze({ tipId: ref.id, reason: 'batch-failed' as const }),
    );
    return Object.freeze({
      entries: Object.freeze([]) as readonly ProjectBrushSetEntry[],
      masks: Object.freeze([]) as readonly ProjectBrushSetMask[],
      unavailableTipIds: Object.freeze(unavailable),
      assets: Object.freeze([]) as readonly ProjectBrushSetAsset[],
      failures: Object.freeze([...failures, ...refused]),
    });
  }

  const byId = new Map<string, EfxPaintBrushAssetReadEntry>();
  for (const result of read.data) {
    if (!byId.has(result.id)) byId.set(result.id, result);
  }

  const entries: ProjectBrushSetEntry[] = [];
  const masks: ProjectBrushSetMask[] = [];
  const assets: ProjectBrushSetAsset[] = [];
  const unavailable: string[] = [];

  for (const tip of tips) {
    const result = byId.get(tip.id);
    if (result === undefined) {
      // No answer for a requested id is a contract violation: fail closed.
      unavailable.push(tip.id);
      failures.push(Object.freeze({ tipId: tip.id, reason: 'refused' as const }));
      continue;
    }
    if (!result.ok) {
      unavailable.push(tip.id);
      failures.push(Object.freeze({ tipId: tip.id, reason: result.reason }));
      continue;
    }
    if (result.mask.length !== TIP_MASK_BYTES) {
      unavailable.push(tip.id);
      failures.push(Object.freeze({ tipId: tip.id, reason: 'wrong-size' as const }));
      continue;
    }
    const digest = brushAssetDigestFromPath(tip.asset);
    if (digest === null) {
      unavailable.push(tip.id);
      failures.push(Object.freeze({ tipId: tip.id, reason: 'invalid-asset-ref' as const }));
      continue;
    }
    if (result.digest !== digest) {
      // Content addressing is the mask's identity: a mismatch means the file
      // no longer carries the ref's bytes, so it must not become live paint.
      unavailable.push(tip.id);
      failures.push(Object.freeze({ tipId: tip.id, reason: 'digest-mismatch' as const }));
      continue;
    }
    entries.push(Object.freeze({ tip, digest, mask: result.mask }));
    masks.push(Object.freeze({ id: tip.id, mask: result.mask }));
    assets.push(Object.freeze({ digest, webp: result.webp }));
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    masks: Object.freeze(masks),
    unavailableTipIds: Object.freeze(unavailable),
    assets: Object.freeze(assets),
    failures: Object.freeze(failures),
  });
}
