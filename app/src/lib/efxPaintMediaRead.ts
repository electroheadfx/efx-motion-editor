/**
 * 52.2-09 (D-13): the read leg of the package media pair — resolve a persisted
 * `FrameMediaReference` back to a decoded `ImageBitmap`.
 *
 * The resolver is deliberately store-free: the LRU, the decode function and
 * the package root all arrive as parameters, so the module is testable without
 * a store and the compositor seam keeps ownership of the two-format sniff and
 * the version bump (52.1 behavior).
 *
 * Contract:
 * - the LRU key is the persisted DIGEST, never the path or the keyId, so the
 *   same raster referenced by several keys decodes once (T-52.2-31);
 * - the digest the native read returns is compared with the recorded digest
 *   BEFORE any decode and BEFORE any LRU write — a mismatch yields
 *   `{ kind: 'refused', reason: 'digest-mismatch' }` with no bitmap and no
 *   cache entry (T-52.2-29);
 * - a missing file yields `{ kind: 'missing' }`, which the caller maps to the
 *   Phase 49 slate — never an empty bitmap claiming to be content (T-52.2-32);
 * - the input is a reference, so a real key's media and a group override's
 *   media resolve through the identical path with no collection branch.
 */
import type { EfxPaintMediaRejectionLabel } from './ipc';
import type { FrameMediaReference } from './efxPaintPackage';

/**
 * The slice of the byte-budgeted frame LRU this module needs (52.1 D-08..D-12).
 * `FrameLru` satisfies it structurally; keeping the surface structural is what
 * lets the tests inject a fake without importing the store graph.
 */
export interface FrameMediaLru {
  get(key: string): ImageBitmap | undefined;
  put(key: string, bitmap: ImageBitmap, width: number, height: number): void;
}

/**
 * The decode step, injected. The caller passes the compositor seam's existing
 * logic (two-format sniff + 52.1 decode path), so decoding media goes through
 * one place, never around it. A `null` result means the bytes could not be
 * decoded — the resolver turns that into a refusal and caches nothing.
 */
export type FrameMediaDecode = (bytes: Uint8Array) => Promise<ImageBitmap | null>;

/**
 * Why a reference was refused. `digest-mismatch` and `decode-failed` are this
 * module's own verdicts; the other members are the native refusal labels
 * (T-52.2-03) passed through unchanged, plus `io` for every other failure.
 */
export type FrameMediaRefusalReason =
  | 'digest-mismatch'
  | 'decode-failed'
  | 'io'
  | EfxPaintMediaRejectionLabel;

/** The discriminated result of resolving one media reference. */
export type FrameMediaResolution =
  | { readonly kind: 'bitmap'; readonly bitmap: ImageBitmap; readonly width: number; readonly height: number }
  | { readonly kind: 'missing' }
  | { readonly kind: 'refused'; readonly reason: FrameMediaRefusalReason };

export interface FrameMediaResolveInput {
  /** The package root the reference is relative to. */
  readonly packageDir: string;
  /** The persisted reference: where the pixels live plus their SHA-256. */
  readonly reference: FrameMediaReference;
  /** The session's decoded-frame cache, keyed by digest here. */
  readonly lru: FrameMediaLru;
  /** The injected decode step (the compositor seam's existing logic). */
  readonly decode: FrameMediaDecode;
}

/**
 * Resolve one media reference: LRU (by digest) → native read → digest
 * verification → decode → LRU write under the verified digest.
 */
export async function resolveFrameMediaBitmap(
  _input: FrameMediaResolveInput,
): Promise<FrameMediaResolution> {
  // RED stub (52.2-09 Task 1): the flow lands in the GREEN commit; until then
  // every case in efxPaintMediaRead.test.ts fails on its own assertion.
  return { kind: 'refused', reason: 'notARegularFile' };
}
