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

/**
 * D-02 collapse: the selection reduces to exactly the single current editing
 * key. While any real key exists the caller guarantees a non-null current, so
 * the selection never empties; a null current (no real keys) yields empty.
 */
export function collapseRotoKeySelection(currentKeyId: string | null): RotoKeySelectionState {
  return currentKeyId === null
    ? { selectedKeyIds: [], anchorKeyId: null }
    : { selectedKeyIds: [currentKeyId], anchorKeyId: currentKeyId };
}

/** Result of a reducer that may also resolve a new current editing key. */
export interface RotoKeySelectionCurrentResult {
  readonly state: RotoKeySelectionState;
  readonly currentKeyId: string | null;
}

/**
 * D-01 Cmd/Ctrl-click toggle, fail-closed on unknown identities:
 * - absent keyId: added (set kept in the given identity order, never
 *   duplicated) and becomes the anchor; current editing key unchanged.
 * - present keyId: removed — but removal that would empty the set no-ops
 *   (D-02 never-empty). When the removed key was the current editing key and
 *   others remain, the next selected key in identity order becomes current
 *   (fallback: previous). When the removed key was the anchor, the anchor
 *   falls back to the current key.
 */
export function toggleRotoKeySelection(
  state: RotoKeySelectionState,
  orderedRealKeyIds: readonly string[],
  keyId: string,
  currentKeyId: string | null,
): RotoKeySelectionCurrentResult {
  if (!orderedRealKeyIds.includes(keyId)) return { state, currentKeyId };
  if (!state.selectedKeyIds.includes(keyId)) {
    const selectedKeyIds = orderedRealKeyIds.filter(
      (id) => id === keyId || state.selectedKeyIds.includes(id),
    );
    return { state: { selectedKeyIds, anchorKeyId: keyId }, currentKeyId };
  }
  const remaining = orderedRealKeyIds.filter(
    (id) => id !== keyId && state.selectedKeyIds.includes(id),
  );
  if (remaining.length === 0) return { state, currentKeyId };
  let nextCurrentKeyId = currentKeyId;
  if (currentKeyId === keyId) {
    const removedIndex = orderedRealKeyIds.indexOf(keyId);
    nextCurrentKeyId = remaining.find((id) => orderedRealKeyIds.indexOf(id) > removedIndex)
      ?? remaining[remaining.length - 1]
      ?? null;
  }
  const anchorKeyId = state.anchorKeyId === keyId ? nextCurrentKeyId : state.anchorKeyId;
  return { state: { selectedKeyIds: remaining, anchorKeyId }, currentKeyId: nextCurrentKeyId };
}

/**
 * D-01 Shift-click range extension, fail-closed on unknown identities:
 * selects the contiguous run of real keys from the anchor to the target
 * inclusive over the ordered identity list (generated/empty cells excluded by
 * construction). The anchor is unchanged so repeated shift-clicks re-extend
 * from the same anchor; the target becomes the current editing key.
 * A null/unknown anchor or unknown target leaves state unchanged and reports
 * a null current (no current-key change requested).
 */
export function extendRotoKeySelectionRange(
  state: RotoKeySelectionState,
  orderedRealKeyIds: readonly string[],
  targetKeyId: string,
): RotoKeySelectionCurrentResult {
  const anchorKeyId = state.anchorKeyId;
  if (
    !orderedRealKeyIds.includes(targetKeyId)
    || anchorKeyId === null
    || !orderedRealKeyIds.includes(anchorKeyId)
  ) {
    return { state, currentKeyId: null };
  }
  const anchorIndex = orderedRealKeyIds.indexOf(anchorKeyId);
  const targetIndex = orderedRealKeyIds.indexOf(targetKeyId);
  const from = Math.min(anchorIndex, targetIndex);
  const to = Math.max(anchorIndex, targetIndex);
  return {
    state: { selectedKeyIds: orderedRealKeyIds.slice(from, to + 1), anchorKeyId },
    currentKeyId: targetKeyId,
  };
}

/**
 * D-17 post-acceptance selection aftermath, keyed on the accepted operation
 * kind (plain `string` so this module compiles standalone before the
 * operation-kind union is extended):
 * - 'move-key-group': the moved set stays selected; the anchor moves to the
 *   accepted (grabbed) key, which the existing single-selection sync has
 *   already made current.
 * - 'force-spacing': the set is unchanged — keyIds survive retiming.
 * - 'paste-key-group': the pasted set (keyIds present in the accepted
 *   after-map but absent from the before-map, appFrame-ordered) becomes the
 *   selection; the anchor is the accepted selectedKeyId — the earliest
 *   pasted key's fresh keyId, so the earliest pasted key is the current
 *   editing key (38-04; 37 D-06/D-17 pattern). Absent or empty
 *   `acceptedAddedKeyIds` falls through to the default collapse.
 * - 'delete-key-group': collapse to the accepted survivor (D-14).
 * - every other kind (single-key ops, undo, redo, paste, duplicate, insert,
 *   play-script): collapse to the single accepted selectedKeyId (A4).
 */
export function resolvePostAcceptanceRotoSelection(input: {
  readonly operationKind: string;
  readonly acceptedSelectedKeyId: string | null;
  readonly state: RotoKeySelectionState;
  readonly currentKeyId: string | null;
  /**
   * KeyIds present in the accepted after-map but absent from the before-map,
   * appFrame-ordered (computed by the caller from the accepted before/after
   * record diff). Only consumed by the 'paste-key-group' branch; every other
   * operation kind ignores it.
   */
  readonly acceptedAddedKeyIds?: readonly string[];
}): RotoKeySelectionState {
  const { operationKind, acceptedSelectedKeyId, state } = input;
  if (operationKind === 'move-key-group') {
    return { selectedKeyIds: state.selectedKeyIds, anchorKeyId: acceptedSelectedKeyId };
  }
  if (operationKind === 'force-spacing') {
    return state;
  }
  if (operationKind === 'paste-key-group' && input.acceptedAddedKeyIds && input.acceptedAddedKeyIds.length > 0) {
    return { selectedKeyIds: [...input.acceptedAddedKeyIds], anchorKeyId: acceptedSelectedKeyId };
  }
  return collapseRotoKeySelection(acceptedSelectedKeyId);
}

/** Preserve active Group Rail identity while settling accepted physical-key selection. */
export function resolvePostAcceptanceRotoStudioSelection(input: {
  readonly selectedLoopClipIds: readonly string[];
  readonly selectedLoopClipId: string | null;
  readonly operationKind: string;
  readonly acceptedSelectedKeyId: string | null;
  readonly keySelection: RotoKeySelectionState;
  readonly currentKeyId: string | null;
  readonly acceptedAddedKeyIds?: readonly string[];
}): Readonly<{
  selectedLoopClipIds: readonly string[];
  selectedLoopClipId: string | null;
  keySelection: RotoKeySelectionState;
}> {
  const railSelectionActive = input.selectedLoopClipIds.length > 0;
  return {
    selectedLoopClipIds: input.selectedLoopClipIds,
    selectedLoopClipId: input.selectedLoopClipId,
    keySelection: railSelectionActive
      ? { selectedKeyIds: [], anchorKeyId: null }
      : resolvePostAcceptanceRotoSelection({
        operationKind: input.operationKind,
        acceptedSelectedKeyId: input.acceptedSelectedKeyId,
        state: input.keySelection,
        currentKeyId: input.currentKeyId,
        acceptedAddedKeyIds: input.acceptedAddedKeyIds,
      }),
  };
}
