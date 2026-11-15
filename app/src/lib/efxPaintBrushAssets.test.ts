/**
 * 63-04 / Task 2 — the module state that makes a brush-tip save a COPY of
 * stored bytes (D-11 / T-63-12).
 *
 * Laws pinned here:
 *   1. A remembered asset that was never written to a package root is pending
 *      for that root; after `markBrushAssetsWritten` it is not pending there.
 *   2. Pending is PER PACKAGE ROOT: writing to root A never marks the asset
 *      written for root B (Save As must re-stage every asset).
 *   3. `pendingBrushAssets` answers the canonical `brushes/<sha256>.webp`
 *      path, sorted, with defensive copies — a caller mutating a returned
 *      buffer cannot change what the next save stages.
 *   4. Intake is fail-closed: a non-digest id, an empty body, or a second
 *      body for the same content-addressed digest is refused.
 *   5. `brushAssetDigestFromPath` is the one reader of an entry's `asset` ref
 *      and accepts exactly `brushes/<64 lower-case hex>.webp`.
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  brushAssetBytes,
  brushAssetDigestFromPath,
  markBrushAssetsWritten,
  pendingBrushAssets,
  rememberBrushAsset,
  resetBrushAssets,
} from './efxPaintBrushAssets';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const ROOT_A = '/projects/alpha';
const ROOT_B = '/projects/beta';

function bytes(...values: number[]): Uint8Array {
  return Uint8Array.from(values);
}

function assetPath(digest: string): string {
  return `brushes/${digest}.webp`;
}

afterEach(() => {
  resetBrushAssets();
});

describe('efxPaintBrushAssets — pending per package root', () => {
  it('a remembered asset is pending for a root until it is marked written there', () => {
    rememberBrushAsset(DIGEST_A, bytes(1, 2, 3));
    expect(brushAssetBytes(DIGEST_A)).toEqual(bytes(1, 2, 3));

    const pending = pendingBrushAssets(ROOT_A);
    expect(pending).toHaveLength(1);
    expect(pending[0].relativePath).toBe(assetPath(DIGEST_A));
    expect(pending[0].bytes).toEqual(bytes(1, 2, 3));

    markBrushAssetsWritten(ROOT_A, [DIGEST_A]);
    expect(pendingBrushAssets(ROOT_A)).toHaveLength(0);
  });

  it('pending is per package root: root B still owes an asset written to root A', () => {
    rememberBrushAsset(DIGEST_A, bytes(9));
    markBrushAssetsWritten(ROOT_A, [DIGEST_A]);

    expect(pendingBrushAssets(ROOT_A)).toHaveLength(0);
    const forB = pendingBrushAssets(ROOT_B);
    expect(forB).toHaveLength(1);
    expect(forB[0].relativePath).toBe(assetPath(DIGEST_A));
  });

  it('pending is sorted by relative path and survives a root that never saw a mark', () => {
    rememberBrushAsset(DIGEST_B, bytes(2));
    rememberBrushAsset(DIGEST_A, bytes(1));
    expect(pendingBrushAssets(ROOT_A).map((asset) => asset.relativePath)).toEqual([
      assetPath(DIGEST_A),
      assetPath(DIGEST_B),
    ]);
  });

  it('returns defensive copies: mutating one cannot change what the next save stages', () => {
    rememberBrushAsset(DIGEST_A, bytes(1, 2, 3));
    const pending = pendingBrushAssets(ROOT_A);
    pending[0].bytes[0] = 99;
    expect(pendingBrushAssets(ROOT_A)[0].bytes).toEqual(bytes(1, 2, 3));

    const direct = brushAssetBytes(DIGEST_A);
    expect(direct).not.toBe(undefined);
    direct![0] = 77;
    expect(pendingBrushAssets(ROOT_A)[0].bytes).toEqual(bytes(1, 2, 3));
  });

  it('reset clears the remembered bytes and every per-root mark', () => {
    rememberBrushAsset(DIGEST_A, bytes(1));
    markBrushAssetsWritten(ROOT_A, [DIGEST_A]);
    resetBrushAssets();

    expect(brushAssetBytes(DIGEST_A)).toBe(undefined);
    expect(pendingBrushAssets(ROOT_A)).toHaveLength(0);
  });
});

describe('efxPaintBrushAssets — fail-closed intake (D-11)', () => {
  it('refuses an id that is not a full lower-case sha256', () => {
    expect(() => rememberBrushAsset('not-a-digest', bytes(1))).toThrow();
    expect(() => rememberBrushAsset('A'.repeat(64), bytes(1))).toThrow();
    expect(() => rememberBrushAsset(DIGEST_A.slice(0, 63), bytes(1))).toThrow();
  });

  it('refuses an empty body', () => {
    expect(() => rememberBrushAsset(DIGEST_A, new Uint8Array())).toThrow();
  });

  it('refuses a second body for the same content-addressed digest', () => {
    rememberBrushAsset(DIGEST_A, bytes(1, 2, 3));
    // Identical bytes are an idempotent re-remember.
    rememberBrushAsset(DIGEST_A, bytes(1, 2, 3));
    expect(brushAssetBytes(DIGEST_A)).toEqual(bytes(1, 2, 3));
    // A different body under the same stem would break content addressing.
    expect(() => rememberBrushAsset(DIGEST_A, bytes(4, 5, 6))).toThrow();
  });
});

describe('efxPaintBrushAssets — brushAssetDigestFromPath', () => {
  it('accepts exactly the canonical package brush path', () => {
    expect(brushAssetDigestFromPath(assetPath(DIGEST_A))).toBe(DIGEST_A);
  });

  it('returns null for every other shape', () => {
    expect(brushAssetDigestFromPath(undefined)).toBe(null);
    expect(brushAssetDigestFromPath('')).toBe(null);
    expect(brushAssetDigestFromPath(`frames/${DIGEST_A}.webp`)).toBe(null);
    expect(brushAssetDigestFromPath(`brushes/${DIGEST_A}.png`)).toBe(null);
    expect(brushAssetDigestFromPath(`brushes/${'A'.repeat(64)}.webp`)).toBe(null);
    expect(brushAssetDigestFromPath(`brushes/${DIGEST_A}`)).toBe(null);
    expect(brushAssetDigestFromPath(`brushes/nested/${DIGEST_A}.webp`)).toBe(null);
    expect(brushAssetDigestFromPath(`../brushes/${DIGEST_A}.webp`)).toBe(null);
    expect(brushAssetDigestFromPath(`/brushes/${DIGEST_A}.webp`)).toBe(null);
  });
});
