/**
 * 52.2-02: the `.mce` package format contract (D-02, D-04, D-05, D-07).
 *
 * This module is the SINGLE source of the package's on-disk shape: the
 * format version literal the writer (plan 07) and the refusal gate (plan 08)
 * both import, the package-relative path rules, the `frames/<layerId>/<keyId>.webp`
 * media reference (D-02), and the machine-relative derived-frame cache
 * reference that keeps machine-local absolute paths out of the package (D-05).
 *
 * It is deliberately dependency-free — no imports at all — so a rescue script
 * can load the format contract standalone, and no parse path in this file can
 * reach a store, an IPC module or a component.
 *
 * Identity: `projectId` is the package's own cache-root key. It is a
 * 36-character lower-case UUID (the shape `crypto.randomUUID()` produces and
 * the shape the manifest writer stores). It is carried IN the manifest and
 * never derived from the file path, so a package opens on a different machine
 * with the same identity.
 *
 * Break note (D-08): pre-52.2 packages are refused upstream by the
 * `formatVersion` gate; there is no back-compat branch here.
 */

/** The one format version literal: the manifest carries it, nothing duplicates it. */
export const PKG_FORMAT_VERSION = 0;

export const EFX_PAINT_LAYERS_DIR = 'layers';
export const EFX_PAINT_FRAMES_DIR = 'frames';
export const EFX_PAINT_MACHINE_CACHE_DIR = 'efx-paint';

/** One layer's per-file index entry (D-04). */
export interface EfxPaintLayerIndexEntry {
  readonly layerFile: string;
  readonly documentRevision: string;
  readonly compositeRevision: string;
}

/** The `project.mce` manifest: main-editor project passthrough plus the package index (D-04). */
export interface EfxPaintPackageManifest {
  readonly formatVersion: typeof PKG_FORMAT_VERSION;
  readonly projectId: string;
  readonly efxPaint: Readonly<Record<string, EfxPaintLayerIndexEntry>>;
}

export function isSafePackageRelativePath(relativePath: unknown): relativePath is string {
  throw new Error('not implemented');
}

export function buildLayerFileRelativePath(layerId: string): string {
  throw new Error('not implemented');
}

export function buildFrameMediaRelativePath(layerId: string, keyId: string): string {
  throw new Error('not implemented');
}

export function buildMachineCacheRelativePath(layerId: string, trackId: string, appFrame: number): string {
  throw new Error('not implemented');
}

export function isSafeMachineCacheRelativePath(relativePath: unknown): relativePath is string {
  throw new Error('not implemented');
}

export function resolveMachineCachePath(machineCacheRoot: string, relativePath: unknown): string | null {
  throw new Error('not implemented');
}

export function isProjectId(value: unknown): value is string {
  throw new Error('not implemented');
}
