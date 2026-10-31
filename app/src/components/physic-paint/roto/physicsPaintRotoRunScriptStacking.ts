import type {
  PhysicPaintRotoGroupFrameOverride,
  PhysicPaintRotoGroupVisibleRange,
  PhysicPaintRotoKeyIdentity,
  PhysicPaintRotoLoopClip,
} from './physicsPaintRotoPhysicalModel';
import type { PhysicPaintRotoLoopRange } from './physicsPaintRotoPhysicalResolver';

/**
 * Quick 261031-i54 (Quick A): Run Script stacking onto an EXISTING Paint rail.
 *
 * ONE pure decision authority for the stack destination. It adapts the canonical
 * `derivePhysicPaintRotoLoopRanges` output (never re-derives membership or
 * ranges), maps the playhead to the source-cycle offset, plans the extend-only
 * cycle growth, resolves the next boundary with its explicit collision offers,
 * and builds the unclamped rail lifecycle. No Preact, no DOM, no timers, no
 * capacity: a silent capacity clamp is exactly the failure the lifecycle helper
 * exists to prevent (the caller compares `requestedRailEndExclusive` with the
 * parent end and routes any overflow through the explicit Truncate / Cancel
 * offers).
 *
 * Scope guard: flag-off Keep script ON, the durable-base authority seam, Reveal
 * rail stacking and frame-override bases belong to Quick B and are absent here
 * by design — an override inside the written span REFUSES with zero writes.
 */

/** One resolved Paint rail, grouped from its canonical per-fragment ranges. */
export interface RunScriptRailView {
  readonly clipId: string;
  readonly railKind: 'playscript' | 'reveal';
  readonly placementStart: number;
  readonly effectiveEnd: number;
  readonly phaseOrigin: number;
  readonly cycleLength: number;
  readonly repeat: number | 'infinity';
  readonly sourceKeyIds: readonly string[];
  readonly sourceOffsets: readonly number[];
  /** Physical app frames of the rail's locally painted override keys. */
  readonly frameOverrideAppFrames: readonly number[];
  readonly keyScriptEdits: boolean;
  readonly truncated: boolean;
}

/**
 * The canonical derivation context plus the real-key index used to resolve
 * `frameOverrides` key ids to physical app frames. Either index shape is
 * accepted (`identities` from the edit snapshot, `keyIdByAppFrame` from the
 * derived resolution context).
 */
export interface RunScriptRailContext {
  readonly ranges: readonly PhysicPaintRotoLoopRange[];
  readonly identities?: readonly PhysicPaintRotoKeyIdentity[];
  readonly keyIdByAppFrame?: ReadonlyMap<number, string>;
}

export type RunScriptDestination =
  | { readonly kind: 'create' }
  | {
      readonly kind: 'stack';
      readonly rail: RunScriptRailView;
      /** The live playhead frame that selected the rail. */
      readonly appFrame: number;
      /** Source-cycle offset the playhead maps to. */
      readonly cycleOffset: number;
      /** First written frame: a SOURCE-cycle physical frame, never the occurrence frame. */
      readonly runStartAppFrame: number;
      readonly repeatInstance: number;
    }
  | { readonly kind: 'refuse'; readonly reason: 'ambiguous-rail' | 'reveal-target' };

export interface RunScriptStackExtension {
  readonly writeAppFrames: readonly number[];
  readonly newCycleLength: number;
  readonly appendedSlots: readonly number[];
  readonly grew: number;
}

export interface RunScriptSourceKeyEntry {
  readonly keyId: string;
  readonly offset: number;
}

export type RunScriptStackBlocker = 'other-rail' | 'real-key' | 'parent-end' | 'target-end' | 'open';

export type RunScriptCollisionOffer = 'cancel' | 'truncate' | 'overwrite';

export interface RunScriptRealKeyFrame {
  readonly keyId: string;
  readonly appFrame: number;
}

export interface RunScriptStackBoundary {
  readonly boundaryExclusive: number;
  readonly blocker: RunScriptStackBlocker;
  readonly victimClipId: string | null;
  readonly collision: boolean;
  readonly freeCount: number;
  readonly offers: readonly RunScriptCollisionOffer[];
  readonly overrideInSpan: boolean;
  readonly frameOverrideRefusal: 'frame-override' | null;
  readonly targetEndAtBoundary: boolean;
}

export type RunScriptStackLifecycle = Pick<
  PhysicPaintRotoLoopClip,
  'syncState' | 'provenanceState' | 'phaseOrigin' | 'originalEndExclusive' | 'visibleRanges' | 'frameOverrides'
>;

export interface RunScriptStackLifecycleSource {
  readonly syncState?: 'synchronized' | 'modified';
  readonly provenanceState?: 'attached' | 'detached';
  readonly phaseOrigin?: number;
  readonly originalEndExclusive?: number;
  readonly visibleRanges?: readonly PhysicPaintRotoGroupVisibleRange[];
  readonly frameOverrides?: readonly PhysicPaintRotoGroupFrameOverride[];
}

export interface RunScriptStackLifecyclePlan {
  readonly lifecycle: RunScriptStackLifecycle | null;
  readonly requestedRailEndExclusive: number;
}

export interface RunScriptStackReadout {
  readonly spanLabel: string;
  readonly offsetLabel: string;
  readonly outcomeLabel: string;
}

/** Keep script defaults ON for a flag-on stack destination (Quick B owns flag-off). */
export const RUN_SCRIPT_KEEP_SCRIPT_DEFAULT = true;

/** Overwrite copy: the victim rail is removed, never "shortened". */
export const RUN_SCRIPT_OVERWRITE_COPY = 'Removes the other rail; its keys stay as ordinary keys.';

const BLOCKER_RANK: Readonly<Record<Exclude<RunScriptStackBlocker, 'open'>, number>> = {
  'other-rail': 0,
  'real-key': 1,
  'parent-end': 2,
  'target-end': 3,
};

const OFFERS_BY_BLOCKER: Readonly<Record<Exclude<RunScriptStackBlocker, 'open'>, readonly RunScriptCollisionOffer[]>> = {
  'other-rail': Object.freeze(['cancel', 'truncate', 'overwrite'] as const),
  'real-key': Object.freeze(['cancel', 'truncate'] as const),
  'parent-end': Object.freeze(['cancel', 'truncate'] as const),
  'target-end': Object.freeze(['cancel', 'truncate'] as const),
};

function buildAppFrameByKeyId(context: RunScriptRailContext): Map<string, number> {
  const map = new Map<string, number>();
  for (const identity of context.identities ?? []) map.set(identity.keyId, identity.appFrame);
  if (context.keyIdByAppFrame) {
    for (const [appFrame, keyId] of context.keyIdByAppFrame) map.set(keyId, appFrame);
  }
  return map;
}

/**
 * Group the canonical ranges into one view per Loop Clip. Unresolved ranges
 * (dangling source keys) are skipped, so an unrepairable rail degrades to the
 * create path instead of accepting a write it cannot re-resolve.
 */
export function toRunScriptRailViews(input: {
  readonly clips: readonly PhysicPaintRotoLoopClip[];
  readonly context: RunScriptRailContext;
}): readonly RunScriptRailView[] {
  const appFrameByKeyId = buildAppFrameByKeyId(input.context);
  const views: RunScriptRailView[] = [];
  for (const clip of input.clips) {
    const resolved = input.context.ranges
      .filter((range) => range.loopId === clip.loopId && range.unresolved === null)
      .slice()
      .sort((left, right) => left.placementStart - right.placementStart);
    if (resolved.length === 0) continue;
    const anchor = resolved[0]!;
    const effectiveEnd = resolved.reduce(
      (max, range) => Math.max(max, range.effectiveEnd),
      resolved[0]!.effectiveEnd,
    );
    const overrideFrames = (clip.frameOverrides ?? [])
      .map((override) => appFrameByKeyId.get(override.keyId))
      .filter((frame): frame is number => frame !== undefined)
      .sort((left, right) => left - right)
      .filter((frame, index, frames) => index === 0 || frames[index - 1] !== frame);
    views.push(Object.freeze({
      clipId: clip.loopId,
      railKind: clip.railKind === 'reveal' ? 'reveal' : 'playscript',
      placementStart: anchor.placementStart,
      effectiveEnd,
      phaseOrigin: anchor.phaseOrigin,
      cycleLength: anchor.cycleLength,
      repeat: anchor.repeat,
      sourceKeyIds: Object.freeze([...anchor.sourceKeyIds]),
      sourceOffsets: Object.freeze([...anchor.sourceOffsets]),
      frameOverrideAppFrames: Object.freeze(overrideFrames),
      keyScriptEdits: clip.keyScriptEdits === true,
      truncated: resolved.some((range) => range.truncated),
    }) as RunScriptRailView);
  }
  views.sort((left, right) => left.placementStart - right.placementStart || left.clipId.localeCompare(right.clipId));
  return Object.freeze(views);
}

/**
 * Playhead membership only. Exactly one containing rail resolves to 'stack';
 * two or more fail closed ('ambiguous-rail') before the reveal refusal.
 * Outside every rail the create path stays byte-identical to today.
 */
export function resolveRunScriptDestination(input: {
  readonly appFrame: number;
  readonly rails: readonly RunScriptRailView[];
}): RunScriptDestination {
  const containing = input.rails.filter(
    (rail) => rail.placementStart <= input.appFrame && input.appFrame < rail.effectiveEnd,
  );
  if (containing.length === 0) return Object.freeze({ kind: 'create' }) as RunScriptDestination;
  if (containing.length > 1) {
    return Object.freeze({ kind: 'refuse', reason: 'ambiguous-rail' }) as RunScriptDestination;
  }
  const rail = containing[0]!;
  if (rail.railKind === 'reveal') {
    return Object.freeze({ kind: 'refuse', reason: 'reveal-target' }) as RunScriptDestination;
  }
  if (rail.cycleLength <= 0 || input.appFrame < rail.phaseOrigin) {
    return Object.freeze({ kind: 'create' }) as RunScriptDestination;
  }
  const offset = input.appFrame - rail.phaseOrigin;
  const cycleOffset = ((offset % rail.cycleLength) + rail.cycleLength) % rail.cycleLength;
  return Object.freeze({
    kind: 'stack',
    rail,
    appFrame: input.appFrame,
    cycleOffset,
    runStartAppFrame: rail.phaseOrigin + cycleOffset,
    repeatInstance: Math.floor(offset / rail.cycleLength),
  }) as RunScriptDestination;
}

/**
 * Extend-only cycle growth. A run reaching past the cycle end appends source
 * slots and grows the cycle; the cycle never shrinks.
 */
export function planRunScriptStackExtension(input: {
  readonly runStartAppFrame: number;
  readonly cycleLength: number;
  readonly cycleOffset: number;
  readonly count: number;
}): RunScriptStackExtension {
  const count = Math.max(0, input.count);
  const writeAppFrames = Array.from({ length: count }, (_, index) => input.runStartAppFrame + index);
  const newCycleLength = Math.max(input.cycleLength, input.cycleOffset + count);
  const appendedSlots = Array.from(
    { length: Math.max(0, newCycleLength - input.cycleLength) },
    (_, index) => input.cycleLength + index,
  );
  return Object.freeze({
    writeAppFrames: Object.freeze(writeAppFrames),
    newCycleLength,
    appendedSlots: Object.freeze(appendedSlots),
    grew: newCycleLength - input.cycleLength,
  }) as RunScriptStackExtension;
}

/**
 * Merge every touched key into the ordered source cycle. Existing order is
 * preserved on offset ties; an already present key keeps its existing entry;
 * inputs are never mutated.
 */
export function mergeStackedSourceKeyIds(
  existing: readonly RunScriptSourceKeyEntry[],
  incoming: readonly RunScriptSourceKeyEntry[],
): readonly RunScriptSourceKeyEntry[] {
  const seen = new Set(existing.map((entry) => entry.keyId));
  const merged = existing.map((entry) => ({ keyId: entry.keyId, offset: entry.offset }));
  for (const entry of incoming) {
    if (seen.has(entry.keyId)) continue;
    seen.add(entry.keyId);
    merged.push({ keyId: entry.keyId, offset: entry.offset });
  }
  return Object.freeze(
    merged
      .map((entry, index) => ({ entry, index }))
      .sort((left, right) => left.entry.offset - right.entry.offset || left.index - right.index)
      .map(({ entry }) => Object.freeze({ keyId: entry.keyId, offset: entry.offset }) as RunScriptSourceKeyEntry),
  );
}

interface BoundaryCandidate {
  readonly frame: number;
  readonly kind: Exclude<RunScriptStackBlocker, 'open'>;
  readonly victimClipId: string | null;
}

/**
 * The next boundary from the canonical blocker list. The target's own later
 * occurrence fragments never block. Its own truncated effectiveEnd is a
 * lowest-rank candidate: an other-rail / real-key / parent-end candidate on the
 * same frame keeps its classification (and Overwrite offer); 'target-end' wins
 * only when nothing canonical sits there. A frame override inside the requested
 * written span refuses outright with no offers.
 */
export function resolveRunScriptStackBoundary(input: {
  readonly runStartAppFrame: number;
  readonly requestedCount: number;
  readonly newCycleEndExclusive: number;
  readonly targetClipId: string;
  readonly rails: readonly RunScriptRailView[];
  readonly parentEndExclusive: number;
  readonly ownedKeyIds: readonly string[];
  readonly frameOverrideAppFrames: readonly number[];
  readonly realKeyAppFrames: readonly RunScriptRealKeyFrame[];
}): RunScriptStackBoundary {
  const owned = new Set(input.ownedKeyIds);
  const overrideFrames = new Set(input.frameOverrideAppFrames);
  let winner: BoundaryCandidate = {
    frame: input.parentEndExclusive,
    kind: 'parent-end',
    victimClipId: null,
  };
  const consider = (candidate: BoundaryCandidate): void => {
    if (candidate.frame < winner.frame) {
      winner = candidate;
      return;
    }
    if (candidate.frame === winner.frame && BLOCKER_RANK[candidate.kind] < BLOCKER_RANK[winner.kind]) {
      winner = candidate;
    }
  };
  for (const rail of input.rails) {
    if (rail.clipId === input.targetClipId) continue;
    if (rail.placementStart < input.runStartAppFrame) continue;
    consider({ frame: rail.placementStart, kind: 'other-rail', victimClipId: rail.clipId });
  }
  for (const key of input.realKeyAppFrames) {
    if (key.appFrame < input.runStartAppFrame) continue;
    if (owned.has(key.keyId)) continue;
    if (overrideFrames.has(key.appFrame)) continue;
    consider({ frame: key.appFrame, kind: 'real-key', victimClipId: null });
  }
  const targetView = input.rails.find((rail) => rail.clipId === input.targetClipId) ?? null;
  const targetEnd = targetView !== null && targetView.truncated ? targetView.effectiveEnd : null;
  if (targetEnd !== null) {
    consider({ frame: targetEnd, kind: 'target-end', victimClipId: null });
  }

  const overrideInSpan = input.frameOverrideAppFrames.some(
    (frame) => frame >= input.runStartAppFrame && frame < input.runStartAppFrame + input.requestedCount,
  );
  const open = winner.frame === Number.POSITIVE_INFINITY;
  const blocker: RunScriptStackBlocker = open ? 'open' : winner.kind;
  const offers = overrideInSpan || open ? Object.freeze([] as RunScriptCollisionOffer[]) : OFFERS_BY_BLOCKER[winner.kind];
  return Object.freeze({
    boundaryExclusive: winner.frame,
    blocker,
    victimClipId: open ? null : winner.victimClipId,
    collision: input.newCycleEndExclusive > winner.frame,
    freeCount: Math.max(0, winner.frame - input.runStartAppFrame),
    offers,
    overrideInSpan,
    frameOverrideRefusal: overrideInSpan ? 'frame-override' : null,
    targetEndAtBoundary: targetEnd !== null && winner.frame === targetEnd,
  }) as RunScriptStackBoundary;
}

/**
 * The rail lifecycle after the run: grow to the repeat-extended natural end,
 * NEVER shrink, NEVER consult capacity. `requestedRailEndExclusive` is the
 * unclamped ask — the caller routes any parent-end overflow through the
 * explicit Truncate / Cancel offers. Infinity clips stay lifecycle-less.
 */
export function planRunScriptStackLifecycle(input: {
  readonly existing: RunScriptStackLifecycleSource | null | undefined;
  readonly phaseOrigin: number;
  readonly newCycleLength: number;
  readonly repeat: number | 'infinity';
}): RunScriptStackLifecyclePlan {
  if (input.repeat === 'infinity') {
    return Object.freeze({
      lifecycle: null,
      requestedRailEndExclusive: Number.POSITIVE_INFINITY,
    }) as RunScriptStackLifecyclePlan;
  }
  const requestedRailEndExclusive = input.phaseOrigin + input.newCycleLength * input.repeat;
  const previousEnd = input.existing?.originalEndExclusive ?? 0;
  const originalEndExclusive = Math.max(previousEnd, requestedRailEndExclusive);
  const existingRanges = input.existing?.visibleRanges ?? [];
  let visibleRanges: PhysicPaintRotoGroupVisibleRange[];
  if (existingRanges.length === 0) {
    visibleRanges = [{ start: input.phaseOrigin, endExclusive: originalEndExclusive }];
  } else {
    visibleRanges = existingRanges
      .map((range) => ({
        start: Math.max(input.phaseOrigin, range.start),
        endExclusive: Math.min(originalEndExclusive, range.endExclusive),
      }))
      .filter((range) => range.endExclusive > range.start);
    if (originalEndExclusive > previousEnd) {
      const last = visibleRanges[visibleRanges.length - 1];
      if (last?.endExclusive === previousEnd) {
        visibleRanges[visibleRanges.length - 1] = { start: last.start, endExclusive: originalEndExclusive };
      } else {
        visibleRanges.push({ start: previousEnd, endExclusive: originalEndExclusive });
      }
    }
    if (visibleRanges.length === 0) {
      visibleRanges = [{ start: input.phaseOrigin, endExclusive: originalEndExclusive }];
    }
  }
  const frameOverrides = (input.existing?.frameOverrides ?? []).map((override) => Object.freeze({
    appFrame: override.appFrame,
    keyId: override.keyId,
  }) as PhysicPaintRotoGroupFrameOverride);
  return Object.freeze({
    lifecycle: Object.freeze({
      syncState: input.existing?.syncState ?? 'synchronized',
      provenanceState: input.existing?.provenanceState ?? 'attached',
      phaseOrigin: input.phaseOrigin,
      originalEndExclusive,
      visibleRanges: Object.freeze(visibleRanges.map((range) => Object.freeze({
        start: range.start,
        endExclusive: range.endExclusive,
      }) as PhysicPaintRotoGroupVisibleRange)),
      frameOverrides: Object.freeze(frameOverrides),
    }) as RunScriptStackLifecycle,
    requestedRailEndExclusive,
  }) as RunScriptStackLifecyclePlan;
}

/** Dialog readout: resolved span, source-cycle offset, extension/truncation. */
export function buildRunScriptStackReadout(input: {
  readonly runStartAppFrame: number;
  readonly count: number;
  readonly cycleOffset: number;
  readonly grew: number;
  readonly truncated: boolean;
  readonly frameOverrideRefusal?: 'frame-override' | null;
}): RunScriptStackReadout {
  const lastFrame = input.runStartAppFrame + Math.max(0, input.count - 1);
  const outcomeLabel = input.frameOverrideRefusal === 'frame-override'
    ? 'Run refused: a frame override sits inside this span.'
    : input.truncated
      ? 'Truncated at the next boundary.'
      : input.grew > 0
        ? `Extends the cycle by ${input.grew} ${input.grew === 1 ? 'frame' : 'frames'}.`
        : 'Stacks onto the existing cycle.';
  return Object.freeze({
    spanLabel: `F${input.runStartAppFrame}–F${lastFrame}`,
    offsetLabel: `Source cycle +${input.cycleOffset}`,
    outcomeLabel,
  }) as RunScriptStackReadout;
}
