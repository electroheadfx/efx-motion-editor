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
 *   `unreadable`, `wrong-size`, `digest-mismatch`, `refused`). Four local
 *   classes complete it: `invalid-entry` (the record fails the package
 *   carrier law), `invalid-asset-ref` (a valid record with no resolvable
 *   `brushes/<sha256>.webp` ref), `batch-failed` (the whole call refused,
 *   which degrades every requested tip rather than aborting the open) and
 *   `builtin-id` (the id names one of the three app-owned built-in tips, so
 *   the entry is refused rather than allowed to shadow a shipped tip).
 *
 * ONE NORMALIZATION LAW (CR-01 / TIP-15)
 *   `normalizeProjectBrushTip` is the ONE admission law both producers apply:
 *   the open loader (below) and the catalog payload producer. It refuses a
 *   built-in id and projects the record onto exactly the wire member set with
 *   `category` pinned to `'custom'`, so a project tip the package carrier
 *   accepted can never be a shape the Studio's strict wire guard refuses.
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
  | 'batch-failed'
  | 'builtin-id';

/** One logged degradation: the tip id (best-effort when the record is bad) and why. */
export interface ProjectBrushSetFailure {
  readonly tipId: string;
  readonly reason: ProjectBrushSetFailureReason;
}

/**
 * One tip the open will LIST. An unavailable tip keeps its entry with
 * `digest`/`mask` null so the library can grey it (D-18); only a healthy tip
 * carries a verified content address and its decoded 36,864-byte mask.
 */
export interface ProjectBrushSetEntry {
  readonly tip: AquarelleTip;
  readonly digest: string | null;
  readonly mask: Uint8Array | null;
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
 * The whole outcome of one open's brush read. `entries` lists EVERY validated
 * tip in snapshot order — healthy entries carry a verified digest and mask,
 * unavailable ones carry nulls so the library can grey them. `masks` /
 * `assets` cover the healthy tips only; `unavailableTipIds` and `failures`
 * name every degradation.
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
 * The ONE project-tip normality law (CR-01 / T-63-25 / TIP-13 / TIP-15).
 *
 * One law, applied by BOTH producers — the open loader (`tipFromRaw` below)
 * and the Studio catalog payload producer (`buildBrushCatalogPayload`):
 *   Wire projection: the record is rebuilt from the named members only and
 *   `category` is pinned to `'custom'`. The projection mirrors
 *   `AQUARELLE_TIP_MEMBER_KEYS` in `types/physicPaint.ts`, so the sender can
 *   never emit a shape `isCustomTipWire` refuses — the strict wire law
 *   stands and the senders become conforming (never the reverse). `asset`
 *   rides only when it is present; it never invents a carrier member.
 *
 * quick 261116-inu: the built-in refusal is gone with the compile-time
 * built-in textures — every tip this path admits is a machine-library row.
 * This module is deleted whole in Task 4; the decoupling exists so this
 * task's boundary compiles without the deleted exports.
 */
export function normalizeProjectBrushTip(tip: AquarelleTip): AquarelleTip | null {
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
    ...(tip.asset === undefined ? {} : { asset: tip.asset }),
  };
}

/**
 * Narrow one snapshot record to a tip, total. A record whose ONLY carrier
 * violation is its `asset` member (missing, wrong shape, or an untrusted
 * path) is still a valid tip: the member is dropped and the record re-validated
 * so the tip can be LISTED with a null mask. Any other violation — a retired
 * `mask` member, a bad field, a foreign carrier field — still yields null
 * (the carrier law of 63-04 stands; the applier never sees an untrusted tip).
 * BOTH branches pass through `normalizeProjectBrushTip`, so what the open
 * admits is what the Studio wire accepts (CR-01).
 */
function tipFromRaw(raw: unknown): AquarelleTip | null {
  const direct = asTipRecord(raw, 'package');
  if (direct !== null) return normalizeProjectBrushTip(direct);
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, 'asset')) return null;
  const { asset: _asset, ...withoutAsset } = record;
  const revalidated = asTipRecord(withoutAsset, 'package');
  return revalidated === null ? null : normalizeProjectBrushTip(revalidated);
}

/** One listed tip before the read: a candidate carries its ref and digest. */
interface PlannedTip {
  readonly tip: AquarelleTip;
  readonly ref: string | null;
  readonly digest: string | null;
}

/**
 * Load one project's brush set from its manifest snapshot. Total: every
 * malformed record and every failed read degrades that tip, never the open;
 * the returned arrays are immutable copies owned by the caller. Every
 * validated tip is LISTED, in snapshot order, so an unavailable one can be
 * greyed rather than silently vanish (D-18); only a healthy tip reaches
 * `masks` / `assets` and the paint registry.
 */
export async function loadProjectBrushSet(
  packageDir: string,
  snapshot: MceBrushPackSnapshot | undefined,
  readPort: ProjectBrushSetReadPort = ipcEfxPaintReadBrushAssets,
): Promise<ProjectBrushSet> {
  if (snapshot === undefined || !Array.isArray(snapshot.entries)) return EMPTY_SET;

  const failures: ProjectBrushSetFailure[] = [];
  const unavailable: string[] = [];
  const planned: PlannedTip[] = [];
  const refs: { id: string; relativePath: string }[] = [];
  const seen = new Set<string>();

  for (const raw of snapshot.entries) {
    const rawId = readTipId(raw);
    const tip = tipFromRaw(raw);
    if (tip === null) {
      failures.push(Object.freeze({ tipId: rawId, reason: 'invalid-entry' as const }));
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
    if (digest === null) {
      // Listed with a null mask: the library greys it, the registry skips it.
      planned.push(Object.freeze({ tip, ref: null, digest: null }));
      unavailable.push(tip.id);
      failures.push(Object.freeze({ tipId: tip.id, reason: 'invalid-asset-ref' as const }));
      continue;
    }
    const relativePath = tip.asset as string;
    planned.push(Object.freeze({ tip, ref: relativePath, digest }));
    refs.push({ id: tip.id, relativePath });
  }

  const healthy = new Map<string, { digest: string; mask: Uint8Array; webp: Uint8Array }>();

  if (refs.length > 0) {
    const read = await readPort(packageDir, refs);
    if (!read.ok) {
      // The whole call failed: every requested tip degrades. The open proceeds
      // with the built-ins plus its other stores — never an aborted project.
      for (const ref of refs) {
        unavailable.push(ref.id);
        failures.push(Object.freeze({ tipId: ref.id, reason: 'batch-failed' as const }));
      }
    } else {
      const byId = new Map<string, EfxPaintBrushAssetReadEntry>();
      for (const result of read.data) {
        if (!byId.has(result.id)) byId.set(result.id, result);
      }
      for (const plannedTip of planned) {
        if (plannedTip.ref === null || plannedTip.digest === null) continue;
        const id = plannedTip.tip.id;
        const result = byId.get(id);
        if (result === undefined) {
          // No answer for a requested id is a contract violation: fail closed.
          unavailable.push(id);
          failures.push(Object.freeze({ tipId: id, reason: 'refused' as const }));
          continue;
        }
        if (!result.ok) {
          unavailable.push(id);
          failures.push(Object.freeze({ tipId: id, reason: result.reason }));
          continue;
        }
        if (result.mask.length !== TIP_MASK_BYTES) {
          unavailable.push(id);
          failures.push(Object.freeze({ tipId: id, reason: 'wrong-size' as const }));
          continue;
        }
        if (result.digest !== plannedTip.digest) {
          // Content addressing is the mask's identity: a mismatch means the
          // file no longer carries the ref's bytes, so it must not become
          // live paint.
          unavailable.push(id);
          failures.push(Object.freeze({ tipId: id, reason: 'digest-mismatch' as const }));
          continue;
        }
        healthy.set(id, { digest: plannedTip.digest, mask: result.mask, webp: result.webp });
      }
    }
  }

  const entries: ProjectBrushSetEntry[] = [];
  const masks: ProjectBrushSetMask[] = [];
  const assets: ProjectBrushSetAsset[] = [];
  for (const plannedTip of planned) {
    const live = healthy.get(plannedTip.tip.id);
    if (live === undefined) {
      entries.push(Object.freeze({ tip: plannedTip.tip, digest: null, mask: null }));
      continue;
    }
    entries.push(Object.freeze({ tip: plannedTip.tip, digest: live.digest, mask: live.mask }));
    masks.push(Object.freeze({ id: plannedTip.tip.id, mask: live.mask }));
    assets.push(Object.freeze({ digest: live.digest, webp: live.webp }));
  }

  return Object.freeze({
    entries: Object.freeze(entries),
    masks: Object.freeze(masks),
    unavailableTipIds: Object.freeze(unavailable),
    assets: Object.freeze(assets),
    failures: Object.freeze(failures),
  });
}
