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
 * Rust's `f64` Display never uses exponent notation, while ECMAScript's
 * `String(number)` switches to it at `|v| >= 1e21` or `< 1e-6`. Both languages
 * already emit the shortest round-trip digits, so expanding the exponent into
 * positional form makes the two encoders agree byte-for-byte. Without this the
 * same document hashes differently per language and every prepare fails the
 * Rust hash gate.
 */
function expandExponent(text: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?e([+-]\d+)$/i.exec(text);
  if (match === null) return text;
  const sign = match[1]!;
  const integerDigits = match[2]!;
  const fractionDigits = match[3] ?? '';
  const digits = integerDigits + fractionDigits;
  const pointIndex = integerDigits.length + Number(match[4]!);
  if (pointIndex <= 0) return `${sign}0.${'0'.repeat(-pointIndex)}${digits}`;
  if (pointIndex >= digits.length) {
    return `${sign}${digits}${'0'.repeat(pointIndex - digits.length)}`;
  }
  return `${sign}${digits.slice(0, pointIndex)}.${digits.slice(pointIndex)}`;
}

export function encodeCanonicalNumber(value: number): string {
  // `Object.is` because `String(-0)` is '0' while Rust's Display emits '-0'.
  const text = Object.is(value, -0) ? '-0' : expandExponent(String(value));
  return `n${text};`;
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
