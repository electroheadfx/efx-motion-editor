/**
 * Clean-break refusal gate (Phase 45-03, reworked by 52.2-08 / D-08).
 *
 * v1.0.0 intentionally does not open, migrate, or render pre-52.2 projects.
 * The project is a package (`Name.mce/` directory whose `project.mce` manifest
 * carries `formatVersion`), so this module is the single parse-time gate: a
 * pure, contract-testable scan over the raw parsed manifest JSON, run before
 * any UI or store hydration (D-06, Pitfall F2 / RESEARCH Pitfall 10).
 *
 * What changed in 52.2 (D-04/D-08): the gate no longer scans for a legacy
 * paint-output carrier — the format is discriminated by `formatVersion`, the
 * ONE literal shared with the writer (`PKG_FORMAT_VERSION`, imported from
 * `app/src/lib/efxPaintPackage.ts`) and by the path layout (a plain file was
 * the pre-52.2 shape: `<dir>/<name>.mce` used to be a file, never a package).
 *
 * Contract (D-05/D-06/D-07/D-08):
 * - Pure: never mutates the parsed manifest, never reads sidecar files, never
 *   touches the filesystem, never performs IPC.
 * - Non-throwing scan: any input (null, array, string, nested garbage) returns
 *   a reason or null — it never raises. True parse corruption stays the
 *   open/serde concern.
 * - Fixed precedence, documented and deterministic: an unreadable/absent
 *   manifest first, then the plain-file layout, then the format version
 *   (absent ⇒ older format; different ⇒ mismatch naming found and required).
 *   The FIRST matching reason is returned; the same input always yields the
 *   same reason.
 * - Reasons are terminal: no auto-fix, migration hint, converter branch, or
 *   stripped-copy suggestion (D-07). The dialog copy is identical for every
 *   reason.
 */

import { PKG_FORMAT_VERSION } from '../../lib/efxPaintPackage';

/**
 * Typed reason a pre-52.2 project is rejected, consumed by the 45-05 dialog.
 * The name is retained for the dialog contract (`efxPaintRejectionDialog.ts`);
 * every kind it can carry is a package-format rejection.
 */
export type LegacyPhysicPaintRejection =
  | { readonly kind: 'not-a-package-manifest' }
  | { readonly kind: 'old-project-layout' }
  | { readonly kind: 'missing-format-version' }
  | { readonly kind: 'unsupported-format-version'; readonly found: number; readonly required: number };

/**
 * What the caller knows about the path it is opening without doing any IO
 * (the gate itself never touches the filesystem).
 */
export interface PackageFormatGateOptions {
  /** `'file'` is the pre-52.2 layout (`<dir>/<name>.mce` was a plain file). */
  readonly pathKind: 'file' | 'directory';
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Return the first package-format rejection reason for a raw parsed `.mce`
 * manifest, or null when the project passes the gate.
 *
 * Fixed precedence:
 *  1. an unreadable/absent manifest (`not-a-package-manifest`);
 *  2. a plain-file path (`old-project-layout` — the pre-52.2 layout, no
 *     package directory to read);
 *  3. an absent or non-numeric `formatVersion` (`missing-format-version` —
 *     the older format, which predates the package manifest);
 *  4. a different `formatVersion` (`unsupported-format-version`, naming the
 *     found value and `PKG_FORMAT_VERSION`).
 */
export function findPackageFormatRejection(
  manifest: unknown,
  options: PackageFormatGateOptions,
): LegacyPhysicPaintRejection | null {
  // 1. Unreadable/absent manifest: nothing below can be judged.
  if (!isPlainRecord(manifest)) return { kind: 'not-a-package-manifest' };

  // 2. The layout: a plain file is the pre-52.2 shape, whatever it claims.
  if (options.pathKind === 'file') return { kind: 'old-project-layout' };

  // 3. No usable format version: a pre-52.2 project file.
  const formatVersion = manifest.formatVersion;
  if (typeof formatVersion !== 'number') return { kind: 'missing-format-version' };

  // 4. A different package format: name both values so a future migration can
  //    be diagnosed from the typed reason.
  if (formatVersion !== PKG_FORMAT_VERSION) {
    return { kind: 'unsupported-format-version', found: formatVersion, required: PKG_FORMAT_VERSION };
  }

  return null;
}
