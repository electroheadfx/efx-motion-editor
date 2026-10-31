/**
 * Quick 261031-qps (Quick B): the ONE durable-base authority for every script
 * target — creation Apply, raster-key edits, Run Script stacking, source
 * occurrences, frame overrides and reopened rails.
 *
 * A durable base is the key's pre-script pixel cache: the pixels a script bake
 * must multiply-composite OVER (or the proven absence of any, `null`). Using a
 * payload as a base when the key already has recorded strokes would compose the
 * script over its own flattened output (doubling) or erase paint the run never
 * owned, so this module walks a fixed, fail-closed order:
 *
 *   1. reveal axis — a reveal-owned key's picture is wash × placed reference,
 *      never a pixel base; it resolves `reveal` before any store is consulted.
 *   2. persisted SNAP durable base of the resolution key (`null` = known-empty).
 *   3. session durable base of the resolution key (recovered bases live here and
 *      stay session-only; they never claim a persist pin).
 *   4. no base recorded AND no recorded strokes on the resolution key's own
 *      canonical frame → the current payload IS the pre-script cache; pin it
 *      (`persistPin: true`). An absent payload is proven known-empty.
 *   5. otherwise `durable-base-unknown` — the payload is never used.
 *
 * The `hasRecordedStrokes` callback is the caller's responsibility to wire to
 * the STROKES-ONLY predicate `hasAquarelleScriptForFrame`. The frame-global,
 * Dry-inclusive `getAquarelleEventsForFrame` probe must never drive this
 * decision: a Dry-only timeline still counts as "no recorded strokes", so the
 * raster under it is the pre-script cache and takes the pin path.
 *
 * Callers that receive `ok: false` perform ZERO writes (no frame staging, no
 * recording, no commit). This module is pure: it reads through the injected
 * lookups and never mutates them.
 */
export interface ScriptBaseEntry {
  /** `null` is a PROVEN empty base (the script is the key's whole content). */
  readonly bytes: ArrayBuffer | null;
}

export interface ScriptBaseLookup {
  /** The persisted SNAP v5 durable base of the key (recorded at its first stroke). */
  persistedDurableBase(keyId: string): ScriptBaseEntry | undefined;
  /** The launch-session base of the key (includes recovered, session-only bases). */
  sessionDurableBase(keyId: string): ScriptBaseEntry | undefined;
  /** STROKES-ONLY: `hasAquarelleScriptForFrame(keyId's canonical frame)`. */
  hasRecordedStrokes(keyId: string): boolean;
  /** The key's current payload, when the caller can read one. */
  currentPayload(keyId: string): ArrayBuffer | null | undefined;
  /** True when the key belongs to a Reveal rail (railKind 'reveal'). */
  isRevealKey(keyId: string): boolean;
}

export type ScriptBaseResolution =
  | { readonly ok: true; readonly kind: 'known-empty'; readonly persistPin: boolean }
  | { readonly ok: true; readonly kind: 'bytes'; readonly bytes: ArrayBuffer; readonly persistPin: boolean }
  | { readonly ok: true; readonly kind: 'reveal'; readonly persistPin: false }
  | { readonly ok: false; readonly reason: 'durable-base-unknown' };

export const SCRIPT_BASE_UNKNOWN_REASON = 'durable-base-unknown' as const;

const UNKNOWN: ScriptBaseResolution = Object.freeze({
  ok: false,
  reason: SCRIPT_BASE_UNKNOWN_REASON,
}) as ScriptBaseResolution;

function entryResolution(entry: ScriptBaseEntry): ScriptBaseResolution {
  return entry.bytes === null
    ? { ok: true, kind: 'known-empty', persistPin: false }
    : { ok: true, kind: 'bytes', bytes: entry.bytes, persistPin: false };
}

/**
 * Resolve the durable base of `resolutionKeyId` (the SOURCE key for occurrences
 * and overrides — the caller maps the composite to its source key BEFORE this
 * call, so a composite payload can never become a base).
 */
export function resolveScriptBase(
  resolutionKeyId: string | null | undefined,
  lookup: ScriptBaseLookup,
): ScriptBaseResolution {
  if (typeof resolutionKeyId !== 'string' || resolutionKeyId.length === 0) return UNKNOWN;

  // 1. The reveal axis is never a pixel base — evaluate it before any store.
  if (lookup.isRevealKey(resolutionKeyId)) {
    return { ok: true, kind: 'reveal', persistPin: false };
  }

  // 2./3. A recorded base always wins, persisted before recovered.
  const persisted = lookup.persistedDurableBase(resolutionKeyId);
  if (persisted !== undefined) return entryResolution(persisted);
  const session = lookup.sessionDurableBase(resolutionKeyId);
  if (session !== undefined) return entryResolution(session);

  // 4. Only a key with NO recorded strokes may supply its own payload.
  if (lookup.hasRecordedStrokes(resolutionKeyId)) return UNKNOWN;
  const payload = lookup.currentPayload(resolutionKeyId);
  if (payload === null || payload === undefined) {
    return { ok: true, kind: 'known-empty', persistPin: true };
  }
  return { ok: true, kind: 'bytes', bytes: payload, persistPin: true };
}
