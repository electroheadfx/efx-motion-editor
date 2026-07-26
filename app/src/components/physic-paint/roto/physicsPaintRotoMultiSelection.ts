/**
 * Pure multi-selection reducers for Physics Paint Roto real keys (Phase 37).
 *
 * Identity contract (D-05/D-19): selection identity is the stable `keyId`
 * only. Frame numbers, legacy dual-frame fields, and projected/generated
 * ownership never enter this module — callers pass the store-ordered real-key
 * identity list, so physical-frame ordering and real-key-only membership are
 * guaranteed by construction.
 *
 * Ownership contract (Pattern 5): the selection set and anchor are
 * session-local controller state (Studio Signals). They never persist, never
 * cross the bridge, and never join the physical document allowlist — only the
 * single `selectedKeyId` does.
 *
 * This module is intentionally free of Preact and store imports so the
 * reducers stay pure and trivially auditable.
 */

/** Session-local multi-selection state: the selected real-key identities plus the range-extension anchor. */
export interface RotoKeySelectionState {
  readonly selectedKeyIds: readonly string[];
  readonly anchorKeyId: string | null;
}

/**
 * Select-all reducer (D-03/D-05): returns every real-key identity in the
 * given store order. The anchor is the current editing key when it is a known
 * identity, else the first identity. Empty input yields an empty selection
 * and never fabricates an identity.
 */
export function selectAllRotoKeyIds(
  orderedRealKeyIds: readonly string[],
  currentKeyId: string | null,
): RotoKeySelectionState {
  if (orderedRealKeyIds.length === 0) return { selectedKeyIds: [], anchorKeyId: null };
  const anchorKeyId = currentKeyId !== null && orderedRealKeyIds.includes(currentKeyId)
    ? currentKeyId
    : orderedRealKeyIds[0];
  return { selectedKeyIds: [...orderedRealKeyIds], anchorKeyId };
}
