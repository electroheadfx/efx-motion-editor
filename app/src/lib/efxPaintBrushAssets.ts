/**
 * efxPaintBrushAssets — the remembered brush-mask bytes a package save copies
 * (63-04 Task 2 / D-10 / D-11 / D-13 / T-63-12).
 *
 * WHAT THIS OWNS
 *   · `rememberedBytes` — every stored `brushes/<sha256>.webp` body the
 *     session has in hand, keyed by its content-addressing digest. The import
 *     path remembers what the native encoder produced; the save leg copies it.
 *     NOTHING here encodes, decodes or re-derives a mask — save is a copy, so
 *     save -> reopen stays byte-identical (D-11).
 *   · `writtenByRoot` — per PACKAGE ROOT, the digests already committed there.
 *     Pending is a root-scoped question: an asset written to project A is
 *     still owed to project B (Save As), and a failed save marks nothing.
 *
 * WHY NOT A SIGNAL STORE
 *   This is save-transaction bookkeeping, not UI state: no component reads it
 *   and it lives and dies with the persistence funnel (the analog is
 *   `savedFrameTokens` in efxPaintPersistence, not a Preact store).
 *
 * CONTENT ADDRESSING
 *   A digest IS the SHA-256 of the bytes under it. Re-remembering the same
 *   digest with a different body is a contract violation (a caller bug or a
 *   hash collision), so it is refused loudly instead of silently overwriting.
 *   Bodies are stored and handed back as copies: a caller mutating a returned
 *   buffer can never change what the next save stages.
 */

import {
  BRUSH_ASSET_DIGEST_PATTERN,
  buildBrushAssetRelativePath,
  parseBrushAssetRelativePath,
} from './efxPaintPackage';

/** One asset a save must copy: its canonical path and the exact stored bytes. */
export interface EfxPaintBrushAssetWrite {
  readonly relativePath: string;
  readonly bytes: Uint8Array;
}

/** digest → the exact stored WebP bytes (a private copy, never the caller's). */
const rememberedBytes = new Map<string, Uint8Array>();

/** package root → the digests already committed under it. */
const writtenByRoot = new Map<string, Set<string>>();

function assertDigest(digest: unknown): asserts digest is string {
  if (typeof digest !== 'string' || !BRUSH_ASSET_DIGEST_PATTERN.test(digest)) {
    throw new Error('EFX Paint brush asset: a digest must be 64 lower-case hex characters.');
  }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

/**
 * Remember one stored asset body under its content-addressing digest. The
 * import path calls this once per imported/read tip; a repeated identical call
 * is a no-op, and a different body under an existing digest is refused (the
 * stem must remain the hash of the bytes).
 */
export function rememberBrushAsset(digest: string, bytes: Uint8Array): void {
  assertDigest(digest);
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new Error(`EFX Paint brush asset "${digest}" carries no bytes.`);
  }
  const existing = rememberedBytes.get(digest);
  if (existing !== undefined) {
    if (bytesEqual(existing, bytes)) return;
    throw new Error(
      `EFX Paint brush asset "${digest}" was already remembered with different bytes; content addressing forbids it.`,
    );
  }
  rememberedBytes.set(digest, bytes.slice());
}

/** The stored bytes for one digest, as a copy; `undefined` when never seen. */
export function brushAssetBytes(digest: string): Uint8Array | undefined {
  const stored = rememberedBytes.get(digest);
  return stored === undefined ? undefined : stored.slice();
}

/**
 * Record that these digests are committed under one package root. Called only
 * AFTER the package transaction commits: a rollback leaves every asset pending
 * so the next save re-stages exactly what the failed one staged.
 */
export function markBrushAssetsWritten(packageDir: string, digests: readonly string[]): void {
  if (typeof packageDir !== 'string' || packageDir.length === 0) {
    throw new Error('EFX Paint brush assets: a write mark needs its package root.');
  }
  if (digests.length === 0) return;
  let written = writtenByRoot.get(packageDir);
  if (written === undefined) {
    written = new Set<string>();
    writtenByRoot.set(packageDir, written);
  }
  for (const digest of digests) {
    assertDigest(digest);
    written.add(digest);
  }
}

/**
 * The assets one package root still owes: every remembered digest the root has
 * not committed, as `{relativePath, bytes}` copies sorted by path so the write
 * set is deterministic. `[]` is the true no-op answer (nothing to stage).
 */
export function pendingBrushAssets(packageDir: string): readonly EfxPaintBrushAssetWrite[] {
  if (typeof packageDir !== 'string' || packageDir.length === 0) {
    throw new Error('EFX Paint brush assets: pending needs its package root.');
  }
  const written = writtenByRoot.get(packageDir);
  const pending: EfxPaintBrushAssetWrite[] = [];
  for (const [digest, bytes] of rememberedBytes) {
    if (written?.has(digest)) continue;
    pending.push(Object.freeze({ relativePath: buildBrushAssetRelativePath(digest), bytes: bytes.slice() }));
  }
  pending.sort((left, right) => (left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0));
  return Object.freeze(pending);
}

/** Project close / switch and test isolation: forget every body and every mark. */
export function resetBrushAssets(): void {
  rememberedBytes.clear();
  writtenByRoot.clear();
}

/**
 * Read an entry's `asset` ref back to its digest: exactly
 * `brushes/<64 lower-case hex>.webp`, or null. The fail-closed reader lives in
 * `efxPaintPackage` (one parser for the whole package boundary); this alias is
 * the brush-asset module's public door to it.
 */
export function brushAssetDigestFromPath(asset: unknown): string | null {
  return parseBrushAssetRelativePath(asset);
}
