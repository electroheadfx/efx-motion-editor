export interface KeyRailSegment {
  readonly firstKeyId: string;
  readonly keyIds: readonly string[];
  readonly firstKeyFrame: number;
  readonly lastKeyFrame: number;
}

export interface DeriveKeyRailSegmentsInput {
  readonly orderedRealKeys: readonly {
    readonly keyId: string;
    readonly appFrame: number;
  }[];
  readonly incomingInterpolationBreakKeyIds: ReadonlySet<string>;
  readonly groupOwnedKeyIds: ReadonlySet<string>;
}

function freezeSegment(
  keyIds: readonly string[],
  firstKeyFrame: number,
  lastKeyFrame: number,
): KeyRailSegment {
  const frozenKeyIds = Object.freeze([...keyIds]) as readonly string[];
  return Object.freeze({
    firstKeyId: frozenKeyIds[0],
    keyIds: frozenKeyIds,
    firstKeyFrame,
    lastKeyFrame,
  }) as KeyRailSegment;
}

/**
 * Pure projection of ordinary real keys into maximal Key Rail segments. Group
 * ownership closes the current segment; an incoming break starts a new segment
 * immediately before its owning key. Empty physical frames are absent from the
 * input and therefore remain inside the surrounding half-open rail span.
 */
export function deriveKeyRailSegments(
  input: DeriveKeyRailSegmentsInput,
): readonly KeyRailSegment[] {
  const segments: KeyRailSegment[] = [];
  let currentKeyIds: readonly string[] = [];
  let currentFirstKeyFrame: number | null = null;
  let currentLastKeyFrame: number | null = null;

  const flushCurrent = (): void => {
    if (currentKeyIds.length === 0 || currentFirstKeyFrame === null || currentLastKeyFrame === null) return;
    segments.push(freezeSegment(currentKeyIds, currentFirstKeyFrame, currentLastKeyFrame));
    currentKeyIds = [];
    currentFirstKeyFrame = null;
    currentLastKeyFrame = null;
  };

  for (const key of input.orderedRealKeys) {
    if (input.groupOwnedKeyIds.has(key.keyId)) {
      flushCurrent();
      continue;
    }

    if (currentKeyIds.length > 0 && input.incomingInterpolationBreakKeyIds.has(key.keyId)) {
      flushCurrent();
    }

    if (currentKeyIds.length === 0) {
      currentFirstKeyFrame = key.appFrame;
    }
    currentKeyIds = [...currentKeyIds, key.keyId];
    currentLastKeyFrame = key.appFrame;
  }

  flushCurrent();
  return Object.freeze(segments) as readonly KeyRailSegment[];
}

function buildKeyRailIdentityCopy(segment: KeyRailSegment, selected: boolean): string {
  const prefix = selected ? 'Selected Key Rail' : 'Key Rail';
  return segment.keyIds.length === 1
    ? `${prefix} — frame ${segment.firstKeyFrame}, 1 key.`
    : `${prefix} — frames ${segment.firstKeyFrame}–${segment.lastKeyFrame}, ${segment.keyIds.length} keys.`;
}

export function buildKeyRailBaseCopy(segment: KeyRailSegment): string {
  return buildKeyRailIdentityCopy(segment, false);
}

export interface SelectedKeyRailCopyAvailability {
  readonly dragUnavailableReason?: string | null;
  readonly deleteUnavailableReason?: string | null;
}

export function buildSelectedKeyRailCopy(
  segment: KeyRailSegment,
  availability: SelectedKeyRailCopyAvailability = {},
  setSentence: string | null = null,
): string {
  const dragCopy = availability.dragUnavailableReason ?? 'Drag to move.';
  const deleteCopy = availability.deleteUnavailableReason
    ?? (segment.keyIds.length === 1
      ? 'Delete removes this rail.'
      : 'Delete removes all keys in this rail.');
  // 43.6 M1: the set sentence (with its leading space) appends to the existing
  // Selected form when this rail is a set member.
  return `${buildKeyRailIdentityCopy(segment, true)} ${dragCopy} ${deleteCopy}${setSentence ?? ''}`;
}

export interface ResolvePhysicPaintPushAnchorInput {
  readonly keyIdByAppFrame: ReadonlyMap<number, string>;
  readonly loopIdByAppFrame: ReadonlyMap<number, string>;
  readonly keyRailSegments: readonly KeyRailSegment[];
}

/**
 * 43.5-05 smoke fix: resolve ANY non-empty cell to its containing Rail anchor.
 * A real key resolves to its own keyId (which derivePhysicPaintPushSet then
 * maps to its containing Key Rail or Group); a linked occurrence inside a Group
 * resolves to the Group loopId; a generated in-between frame resolves to the
 * first key of the Key Rail segment that spans it (so the resolver derives the
 * SAME segment from that anchorKeyId). Empty/gap frames resolve null — the
 * not-allowed cursor and the no-drag preflight both key off this.
 */
export function resolvePhysicPaintPushAnchor(
  frame: number,
  input: ResolvePhysicPaintPushAnchorInput,
): { readonly kind: 'key' | 'loop'; readonly id: string } | null {
  const keyId = input.keyIdByAppFrame.get(frame) ?? null;
  if (keyId !== null) return { kind: 'key', id: keyId };
  const loopId = input.loopIdByAppFrame.get(frame) ?? null;
  if (loopId !== null) return { kind: 'loop', id: loopId };
  const segment = input.keyRailSegments.find(
    (candidate) => frame >= candidate.firstKeyFrame && frame <= candidate.lastKeyFrame,
  );
  if (segment !== undefined) return { kind: 'key', id: segment.firstKeyId };
  return null;
}
