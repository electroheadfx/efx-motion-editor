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

/**
 * Numbers encode as their IEEE-754 binary64 bit pattern, 16 lowercase hex
 * digits, big-endian — the Rust mirror emits `value.to_bits()` in the same
 * form.
 *
 * Decimal formatting is NOT usable here. Rust's `f64` Display and ECMAScript's
 * `String(number)` disagree in three reachable ways: exponent notation
 * (`1e21` / `1e-7`), negative zero (`-0` vs `0`), and shortest-roundtrip tie
 * breaking (Rust rounds half away from zero, ECMAScript half to even, so
 * `-890236549097760.25` formats as `.3` in one language and `.2` in the
 * other). Any of them forks the document revision between TypeScript and Rust
 * and makes every prepare fail the Rust hash gate. The bit pattern is exact,
 * total, and identical in both languages by construction.
 */
export function encodeCanonicalNumber(value: number): string {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  let hex = '';
  for (let index = 0; index < 8; index += 1) {
    hex += view.getUint8(index).toString(16).padStart(2, '0');
  }
  return `n${hex};`;
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
