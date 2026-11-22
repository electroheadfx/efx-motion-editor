// ============================================================
//  aquarelleSheetSignature — the sheet cache's SCRIPT identity (IN-05).
//
//  KEY = CACHE (efx-studio-paint): the sheet cache may only restore a
//  cached sheet under the exact SCRIPT it was captured under. The shipped
//  signature hashed event count, mutation id and point count, but those are
//  accidents of the recorder — a moved point, a changed width/flow, a new
//  colour, a texture rotation, a remapped play frame or a Dry tick left the
//  identity unchanged, so the key restored pixels the current script would
//  not paint. The identity is therefore a canonical digest of the WHOLE
//  event list.
//
//  The digest is a deliberate SUPERSET of the deposit inputs: over-
//  invalidating the cache costs one blank key over its cached image (visible,
//  recoverable), while under-invalidating restores stale pixels (the IN-05
//  defect). Hashing every event field is the safe side of that asymmetry.
//
//  CANONICAL and TOTAL:
//    - nested records are walked with SORTED keys, so the identity is the
//      values, never their construction history;
//    - every value carries a type tag and strings/keys are length-prefixed,
//      so distinct values cannot encode to the same byte stream;
//    - absent and explicit-`undefined` members encode identically (both
//      absent); NaN/±Infinity get their own markers; cycles get a marker —
//      the encoder never throws;
//    - the result is an unsigned 32-bit integer (FNV-1a, the shipped offset
//      basis and prime), the contract `takeSheet`'s comparison expects.
//
//  Never use JSON.stringify as the digest input: key order would make the
//  identity depend on construction history and non-finite values would
//  throw. Never hash counts or ids alone again.
// ============================================================

import type { AquarellePayloadEvent } from '@efxlab/efx-watercolor';

/** FNV-1a 32-bit — the shipped offset basis and prime. */
const FNV_OFFSET_BASIS = 2166136261;
const FNV_PRIME = 16777619;

interface DigestState {
  hash: number;
}

function writeCode(digest: DigestState, code: number): void {
  digest.hash = Math.imul(digest.hash ^ (code & 0xffff), FNV_PRIME) >>> 0;
}

function writeText(digest: DigestState, text: string): void {
  for (let index = 0; index < text.length; index += 1) {
    writeCode(digest, text.charCodeAt(index));
  }
}

/** Length-prefixed text — `<length>:<chars>` is an injective framing. */
function writeFrame(digest: DigestState, tag: string, text: string): void {
  writeText(digest, tag);
  writeText(digest, String(text.length));
  writeText(digest, ':');
  writeText(digest, text);
}

function writeNumber(digest: DigestState, value: number): void {
  // Non-finite values get their own markers so a malformed payload still
  // contributes an identity instead of throwing.
  if (Number.isNaN(value)) {
    writeText(digest, 'n:NaN;');
    return;
  }
  if (value === Number.POSITIVE_INFINITY) {
    writeText(digest, 'n:+Inf;');
    return;
  }
  if (value === Number.NEGATIVE_INFINITY) {
    writeText(digest, 'n:-Inf;');
    return;
  }
  // Shortest round-trip string; `String(-0) === '0'` (sign of zero is
  // not a deposit-affecting distinction).
  writeText(digest, 'n:');
  writeText(digest, String(value));
  writeText(digest, ';');
}

function writeValue(digest: DigestState, value: unknown, seen: WeakSet<object>): void {
  switch (typeof value) {
    case 'string':
      writeFrame(digest, 's:', value);
      return;
    case 'number':
      writeNumber(digest, value);
      return;
    case 'boolean':
      writeText(digest, value ? 'b:1;' : 'b:0;');
      return;
    case 'undefined':
      writeText(digest, 'u:');
      return;
    case 'bigint':
      writeText(digest, 'g:');
      writeText(digest, value.toString());
      writeText(digest, ';');
      return;
    case 'symbol':
      writeText(digest, 'y:');
      writeText(digest, String(value));
      writeText(digest, ';');
      return;
    case 'function':
      writeText(digest, 'f:');
      writeText(digest, String(value));
      writeText(digest, ';');
      return;
    default:
      break;
  }
  if (value === null) {
    writeText(digest, 'z:');
    return;
  }
  const record = value as object;
  if (seen.has(record)) {
    writeText(digest, 'c:');
    return;
  }
  seen.add(record);
  if (Array.isArray(value)) {
    // Elements are walked by index; a hole and an explicit `undefined`
    // both encode as the absent marker, so index order alone matters.
    writeText(digest, 'a:');
    const list = value as readonly unknown[];
    for (let index = 0; index < list.length; index += 1) {
      writeValue(digest, list[index], seen);
    }
    seen.delete(record);
    return;
  }
  // Plain-record walk. Sorted keys: construction order is not identity.
  // An explicit `undefined` member is skipped exactly like an absent one.
  writeText(digest, 'o:');
  let keys: string[] = [];
  try {
    keys = Object.keys(record).sort();
  } catch {
    keys = [];
  }
  const members = record as Record<string, unknown>;
  for (const key of keys) {
    let member: unknown;
    try {
      member = members[key];
    } catch {
      // An unreadable member still contributes its own identity instead of
      // aborting the whole walk.
      writeText(digest, 'k:');
      writeFrame(digest, 's:', key);
      writeText(digest, 'e:');
      continue;
    }
    if (member === undefined) continue;
    writeText(digest, 'k:');
    writeFrame(digest, 's:', key);
    writeValue(digest, member, seen);
  }
  seen.delete(record);
}

/**
 * Whether `events` is a script the sheet cache may park or restore (IN-02).
 *
 * The cache's law is symmetric: every sheet it remembers is a sheet it can
 * later take. An empty event list digests fine but identifies no script, so
 * it is never parked and never restored — rememberSheet and restoreCachedSheet
 * ask this ONE question so the two answers cannot drift apart.
 *
 * Lives beside `aquarelleSheetSignature` because the module that owns what a
 * script's identity is also owns whether there is a script at all. Total on
 * malformed payloads: anything that is not an array is not a script.
 */
export function hasCacheableScript(
  events: unknown,
): events is readonly AquarellePayloadEvent[] {
  return Array.isArray(events) && events.length > 0;
}

/**
 * Canonical digest of one frame's whole event list — the sheet cache's key.
 * Order-stable (values, never key insertion order), total (never throws) and
 * an unsigned 32-bit integer like the shipped function.
 */
export function aquarelleSheetSignature(events: readonly AquarellePayloadEvent[]): number {
  const digest: DigestState = { hash: FNV_OFFSET_BASIS };
  // Encoding version: a future change to the byte stream must miss every
  // entry captured under the old one, never compare as equal by accident.
  writeText(digest, 'v1:');
  writeValue(digest, events, new WeakSet<object>());
  return digest.hash >>> 0;
}
