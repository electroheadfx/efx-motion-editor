/**
 * RED scaffold (63-04 Task 2 / D-11 / T-63-12).
 *
 * Signatures only, so the test suite loads and fails on BEHAVIOR rather than on
 * a missing module (#3770 INVALID_RED avoidance). The GREEN commit fills in the
 * module state: remembered WebP bytes keyed by digest, plus a per-package-root
 * written set so a save copies stored bytes and never re-encodes.
 */

export interface EfxPaintBrushAssetWrite {
  readonly relativePath: string;
  readonly bytes: Uint8Array;
}

function notImplemented(): never {
  throw new Error('efxPaintBrushAssets: not implemented (63-04 Task 2 RED scaffold)');
}

export function rememberBrushAsset(_digest: string, _bytes: Uint8Array): void {
  notImplemented();
}

export function brushAssetBytes(_digest: string): Uint8Array | undefined {
  return notImplemented();
}

export function markBrushAssetsWritten(_packageDir: string, _digests: readonly string[]): void {
  notImplemented();
}

export function pendingBrushAssets(_packageDir: string): readonly EfxPaintBrushAssetWrite[] {
  return notImplemented();
}

export function resetBrushAssets(): void {
  notImplemented();
}

export function brushAssetDigestFromPath(_asset: unknown): string | null {
  return notImplemented();
}
