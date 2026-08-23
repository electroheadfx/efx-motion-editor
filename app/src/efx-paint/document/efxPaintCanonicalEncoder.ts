/**
 * Shared canonical encoding primitives for deterministic revision
 * fingerprints (Phase 45-01 Task 3).
 *
 * Extracted from `physicsPaintRotoPhysicalModel.ts` so the v1.0 document
 * revision builders and the roto physical model share one encoder
 * implementation (no duplicated logic). Strings are length-prefixed so
 * payload text cannot create delimiter collisions; the FNV-1a fingerprint
 * is a non-cryptographic change-detection lease, not a security boundary.
 */

export function encodeCanonicalString(value: string): string {
  return `s${value.length}:${value};`;
}

export function encodeCanonicalNumber(value: number): string {
  return `n${String(value)};`;
}

export function encodeCanonicalOptionalNumber(value: number | undefined): string {
  return value === undefined ? 'u;' : encodeCanonicalNumber(value);
}

export function validatedBoolean(value: boolean): string {
  return value ? '1;' : '0;';
}

export function hashCanonicalPhysicalValue(source: string): string {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${source.length}-${(hash >>> 0).toString(16)}`;
}
