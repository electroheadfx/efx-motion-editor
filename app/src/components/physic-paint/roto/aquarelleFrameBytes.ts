/**
 * UAT 2026-11-18: a rendered frame payload may be REFERENCE-ONLY. Its package
 * media could not be materialized at open (missing file, io, or a digest
 * mismatch), so the frame object is legal but its `bytes` is UNDEFINED.
 *
 * Every base-selection guard that answered "usable?" with `payload !== null &&
 * payload.bytes.length > …` threw `TypeError` on that record and aborted the
 * cache capture — no frame was ever written, so the paint vanished on the next
 * navigate. The test suite could not see it: the pin was a source-string
 * assertion, and every fixture carried real bytes.
 *
 * This predicate is the ONE answer to "does this frame carry pixels?". A
 * reference-only record is never usable, never a punch source, never a merge
 * base — and never throws.
 */
export function hasUsableFrameBytes(
  payload: { readonly bytes?: Uint8Array | null } | null | undefined,
  minBytesExclusive = 0,
): boolean {
  const bytes = payload?.bytes;
  return bytes instanceof Uint8Array && bytes.length > minBytesExclusive;
}
