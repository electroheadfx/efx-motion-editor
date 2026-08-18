/**
 * Pure multi-rail selection SET reducers for Physics Paint Roto (Phase 43.6).
 *
 * Identity contract (D-01/D-05): rail-set identity is the stable cross-type
 * identity only — `{ kind: 'loop', loopId }` for Loop Rails and
 * `{ kind: 'key-rail', firstKeyId }` for Key Rails. Frame numbers, physical
 * ordering, and membership are derived by the caller; this module never
 * fabricates an identity and never invents a fallback scope.
 *
 * Ownership contract (Pattern 5): the rail set is session-local controller
 * state (Studio Signals). It never persists, never crosses the bridge, and
 * never joins the physical document allowlist or the canonical revision
 * fingerprint.
 *
 * This module is intentionally free of Preact and store imports so the
 * reducers stay pure and trivially auditable.
 */

/** Cross-type rail identity: a Loop Rail (Group) or a Key Rail segment. */
export type RailSetIdentity =
  | { readonly kind: 'loop'; readonly loopId: string }
  | { readonly kind: 'key-rail'; readonly firstKeyId: string };

/** Session-local rail-set state: the selected identities plus the range-extension anchor. */
export interface RailSetSelectionState {
  readonly members: readonly RailSetIdentity[];
  readonly anchor: RailSetIdentity | null;
}

/** Gesture vocabulary. 'range' and 'union' are implemented in Task 2. */
export type RailSetGesture = 'plain' | 'toggle' | 'range' | 'union';

export interface DeriveRailSetOrderInput {
  readonly keyRailSegments: readonly {
    readonly firstKeyId: string;
    readonly firstKeyFrame: number;
  }[];
  readonly loopRanges: readonly {
    readonly loopId: string;
    readonly placementStart: number;
  }[];
}

function isBoundedKeyId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 256;
}

function isLoopIdentity(value: unknown): value is { readonly kind: 'loop'; readonly loopId: string } {
  return typeof value === 'object' && value !== null
    && (value as { kind?: unknown }).kind === 'loop'
    && isBoundedKeyId((value as { loopId?: unknown }).loopId);
}

function isKeyRailIdentity(value: unknown): value is { readonly kind: 'key-rail'; readonly firstKeyId: string } {
  return typeof value === 'object' && value !== null
    && (value as { kind?: unknown }).kind === 'key-rail'
    && isBoundedKeyId((value as { firstKeyId?: unknown }).firstKeyId);
}

function isRailSetIdentity(value: unknown): value is RailSetIdentity {
  return isLoopIdentity(value) || isKeyRailIdentity(value);
}

function identityKey(identity: RailSetIdentity): string {
  return identity.kind === 'loop' ? `loop:${identity.loopId}` : `key-rail:${identity.firstKeyId}`;
}

function sameIdentity(left: RailSetIdentity, right: RailSetIdentity): boolean {
  return identityKey(left) === identityKey(right);
}

function validOrderedIdentities(orderedIdentities: readonly RailSetIdentity[]): boolean {
  if (!Array.isArray(orderedIdentities) || orderedIdentities.length === 0) return false;
  const seen = new Set<string>();
  for (const identity of orderedIdentities) {
    if (!isRailSetIdentity(identity)) return false;
    const key = identityKey(identity);
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

function freezeRailSetSelection(
  members: readonly RailSetIdentity[],
  anchor: RailSetIdentity | null,
): RailSetSelectionState {
  return Object.freeze({
    members: Object.freeze([...members]),
    anchor,
  });
}

/**
 * The single canonical cross-type ordering authority (D-01; one ordering
 * authority across gestures, copy, and focus). Merges Key Rail segments
 * (identity `{ kind: 'key-rail', firstKeyId }`, sort key firstKeyFrame) and
 * loop ranges (identity `{ kind: 'loop', loopId }`, sort key placementStart,
 * deduped by loopId using the earliest placementStart) into one list sorted by
 * canonical first frame ascending. Ties break by kind ('key-rail' before
 * 'loop') then identity id ascending — deterministic.
 */
export function deriveRailSetOrder(input: DeriveRailSetOrderInput): readonly RailSetIdentity[] {
  const frameByIdentity = new Map<string, number>();
  const identities: RailSetIdentity[] = [];
  const seen = new Set<string>();

  for (const segment of input.keyRailSegments) {
    if (!isBoundedKeyId(segment.firstKeyId)) continue;
    const identity: RailSetIdentity = { kind: 'key-rail', firstKeyId: segment.firstKeyId };
    const key = identityKey(identity);
    if (seen.has(key)) continue;
    seen.add(key);
    frameByIdentity.set(key, segment.firstKeyFrame);
    identities.push(identity);
  }

  const loopFrameByLoopId = new Map<string, number>();
  for (const range of input.loopRanges) {
    if (!isBoundedKeyId(range.loopId)) continue;
    const current = loopFrameByLoopId.get(range.loopId);
    if (current === undefined || range.placementStart < current) {
      loopFrameByLoopId.set(range.loopId, range.placementStart);
    }
  }
  for (const [loopId, placementStart] of loopFrameByLoopId) {
    const identity: RailSetIdentity = { kind: 'loop', loopId };
    const key = identityKey(identity);
    if (seen.has(key)) continue;
    seen.add(key);
    frameByIdentity.set(key, placementStart);
    identities.push(identity);
  }

  return Object.freeze([...identities].sort((left, right) => {
    const leftFrame = frameByIdentity.get(identityKey(left)) ?? Number.POSITIVE_INFINITY;
    const rightFrame = frameByIdentity.get(identityKey(right)) ?? Number.POSITIVE_INFINITY;
    if (leftFrame !== rightFrame) return leftFrame - rightFrame;
    if (left.kind !== right.kind) return left.kind === 'key-rail' ? -1 : 1;
    if (left.kind === 'loop' && right.kind === 'loop') {
      return left.loopId.localeCompare(right.loopId);
    }
    if (left.kind === 'key-rail' && right.kind === 'key-rail') {
      return left.firstKeyId.localeCompare(right.firstKeyId);
    }
    return 0;
  })) as readonly RailSetIdentity[];
}

/**
 * D-01/D-03/D-04/D-05 gesture reducer, fail-closed on unknown/malformed
 * identities and non-unique orderings:
 * - 'plain': returns a fresh one-member set with the clicked identity as anchor.
 * - 'toggle': adds an absent identity (anchor unchanged) or removes a present
 *   one (anchor falls back to the first ordered member when the anchor was
 *   removed); toggling off the last member returns null (empty = no rail
 *   selection scope, D-05).
 * - 'range': replaces the set with the ordered anchor-to-target slice; anchor
 *   unchanged (D-01/D-02).
 * - 'union': adds the ordered anchor-to-target slice to the current set,
 *   de-duplicated; anchor unchanged; already-selected members stay selected
 *   (D-03).
 * 'range'/'union' with no valid anchor (null selection, null/unknown anchor)
 * leave the state unchanged — matching the Phase 37 range precedent.
 */
export function updatePhysicsPaintRotoRailSetSelection(
  selection: RailSetSelectionState | null,
  orderedIdentities: readonly RailSetIdentity[],
  target: RailSetIdentity,
  gesture: RailSetGesture,
): RailSetSelectionState | null {
  if (!isRailSetIdentity(target)) return selection;
  if (!validOrderedIdentities(orderedIdentities)) return selection;
  if (!orderedIdentities.some((identity) => sameIdentity(identity, target))) return selection;
  if (gesture === 'plain') {
    return freezeRailSetSelection([target], target);
  }
  if (gesture === 'toggle') {
    const current = reconcileRailSetSelection(selection, orderedIdentities);
    if (current === null) {
      return freezeRailSetSelection([target], target);
    }
    const members = current.members.filter((identity) => !sameIdentity(identity, target));
    if (members.length === current.members.length) {
      const added = orderedIdentities.filter((identity) => (
        sameIdentity(identity, target)
        || current.members.some((member) => sameIdentity(member, identity))
      ));
      return freezeRailSetSelection(added, current.anchor);
    }
    if (members.length === 0) return null;
    const anchor = current.anchor !== null
      && members.some((identity) => sameIdentity(identity, current.anchor as RailSetIdentity))
      ? current.anchor
      : members[0];
    return freezeRailSetSelection(members, anchor);
  }
  if (gesture === 'range' || gesture === 'union') {
    const current = reconcileRailSetSelection(selection, orderedIdentities);
    if (current === null || current.anchor === null) return selection;
    const anchorIndex = orderedIdentities.findIndex((identity) => sameIdentity(identity, current.anchor as RailSetIdentity));
    if (anchorIndex === -1) return selection;
    const targetIndex = orderedIdentities.findIndex((identity) => sameIdentity(identity, target));
    const from = Math.min(anchorIndex, targetIndex);
    const to = Math.max(anchorIndex, targetIndex);
    const slice = orderedIdentities.slice(from, to + 1);
    if (gesture === 'range') {
      return freezeRailSetSelection(slice, current.anchor);
    }
    const members = orderedIdentities.filter((identity) => (
      slice.some((member) => sameIdentity(member, identity))
      || current.members.some((member) => sameIdentity(member, identity))
    ));
    return freezeRailSetSelection(members, current.anchor);
  }
  return selection;
}

/**
 * D-05/Pitfall 2 fail-closed reconcile: returns null when the selection is
 * null, any member is absent from the ordered list, or identities are
 * malformed/duplicated — clear the invalid set, never invent a fallback scope.
 * A valid set keeps its anchor when the anchor is still a member, else falls
 * back to the first ordered member.
 */
export function reconcileRailSetSelection(
  selection: RailSetSelectionState | null,
  orderedIdentities: readonly RailSetIdentity[],
): RailSetSelectionState | null {
  if (selection === null) return null;
  if (!validOrderedIdentities(orderedIdentities)) return null;
  if (selection.anchor !== null && !isRailSetIdentity(selection.anchor)) return null;
  const members: RailSetIdentity[] = [];
  const seen = new Set<string>();
  for (const member of selection.members) {
    if (!isRailSetIdentity(member)) return null;
    const key = identityKey(member);
    if (seen.has(key)) return null;
    seen.add(key);
    if (!orderedIdentities.some((identity) => sameIdentity(identity, member))) return null;
    members.push(member);
  }
  if (members.length === 0) return null;
  const anchor = selection.anchor !== null
    && members.some((identity) => sameIdentity(identity, selection.anchor as RailSetIdentity))
    ? selection.anchor
    : members[0];
  return freezeRailSetSelection(members, anchor);
}
