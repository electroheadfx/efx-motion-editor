import {
  PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER,
  railMotionValueToUi,
  type PhysicPaintRotoRailMotionChannelId,
  type PhysicPaintRotoRailMotionRecord,
} from '../roto/railMotionModel';
import { evaluateRailMotionChannel } from '../roto/railMotionEvaluator';

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

/**
 * 58-03 RAIL-01: the Selected Key Rail inspector shows classification facts
 * only (D-04) — never per-frame cells or loop-edit math. The projection is
 * anchor-agnostic: the caller resolves which segment is selected (a plain rail
 * or the rail-set anchor) and passes the current member count beside it.
 */
export const KEY_RAIL_EDIT_DISABLED_REASON = 'Select a single rail to edit it.';

export interface SelectedKeyRailInspectorPresentation {
  readonly firstKeyId: string;
  readonly keyIds: readonly string[];
  readonly firstKeyFrame: number;
  readonly lastKeyFrame: number;
  readonly framesLabel: string;
  readonly keysLabel: string;
  readonly typeLabel: 'Standard';
  readonly editDisabledReason: string | null;
}

export interface ProjectSelectedKeyRailInspectorOptions {
  /** Rails in the current selection; 2+ disables Edit Rail (D-03). */
  readonly setSize?: number;
}

export function projectSelectedKeyRailInspector(
  segment: KeyRailSegment,
  options: ProjectSelectedKeyRailInspectorOptions = {},
): SelectedKeyRailInspectorPresentation {
  const setSize = options.setSize ?? 1;
  return Object.freeze({
    firstKeyId: segment.firstKeyId,
    keyIds: Object.freeze([...segment.keyIds]) as readonly string[],
    firstKeyFrame: segment.firstKeyFrame,
    lastKeyFrame: segment.lastKeyFrame,
    framesLabel: `F${segment.firstKeyFrame}–F${segment.lastKeyFrame}`,
    keysLabel: String(segment.keyIds.length),
    typeLabel: 'Standard',
    editDisabledReason: setSize >= 2 ? KEY_RAIL_EDIT_DISABLED_REASON : null,
  }) as SelectedKeyRailInspectorPresentation;
}

/**
 * 59-16 (D-06/D-09): the numeric Motion inspector's ONE projection. It is the
 * frozen, unit-formatted sibling of {@link projectSelectedKeyRailInspector}:
 * it reads no store, no signal and no component, and it performs no rounding.
 * Percent channels reuse the 59-02 `railMotionValueToUi` pair, so exactly one
 * display-conversion authority exists.
 */
export type RailMotionInspectorUnit = 'px' | '%' | '°';

export interface RailMotionInspectorField {
  readonly channelId: PhysicPaintRotoRailMotionChannelId;
  readonly label: string;
  readonly unit: RailMotionInspectorUnit;
  /** Display-unit value (px / percent / degrees). */
  readonly value: number;
}

export interface RailMotionInspectorPresentation {
  readonly railId: string;
  /** Rail-local frame the values were read at and a numeric edit writes. */
  readonly frame: number;
  readonly fields: readonly RailMotionInspectorField[];
}

export interface ProjectRailMotionInspectorInput {
  /** The selected rail's motion record, or null when it carries no motion. */
  readonly record: PhysicPaintRotoRailMotionRecord | null;
  /** The selected Motion key's rail-local frame; null = no key selected. */
  readonly selectedKeyFrame: number | null;
  /** Rail-local frame whose values are projected (a numeric edit writes here). */
  readonly railLocalFrame: number;
}

const RAIL_MOTION_INSPECTOR_LABELS: Readonly<Record<PhysicPaintRotoRailMotionChannelId, string>> = Object.freeze({
  'position-x': 'Position X',
  'position-y': 'Position Y',
  scale: 'Scale',
  rotation: 'Rotation',
  opacity: 'Opacity',
});

const RAIL_MOTION_INSPECTOR_UNITS: Readonly<Record<PhysicPaintRotoRailMotionChannelId, RailMotionInspectorUnit>> = Object.freeze({
  'position-x': 'px',
  'position-y': 'px',
  scale: '%',
  rotation: '°',
  opacity: '%',
});

/**
 * Projects every channel at the read frame in the fixed D-13 order. A channel
 * keyed at that frame shows its STORED value (a key frame must never display
 * an outgoing-wiggle-perturbed evaluation); an unkeyed channel shows what the
 * 59-05 evaluator reports, which is the value a create-key edit seeds.
 */
export function projectRailMotionInspector(
  input: ProjectRailMotionInspectorInput,
): RailMotionInspectorPresentation | null {
  const { record, selectedKeyFrame } = input;
  if (record === null || selectedKeyFrame === null || !Number.isFinite(selectedKeyFrame)) return null;
  const hasKeyAtSelection = record.channels.some(
    (channel) => channel.keys.some((key) => key.frame === selectedKeyFrame),
  );
  if (!hasKeyAtSelection) return null;

  const readFrame = Number.isFinite(input.railLocalFrame) ? input.railLocalFrame : selectedKeyFrame;
  const fields = PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER.map((channelId) => {
    const channel = record.channels.find((entry) => entry.id === channelId);
    const storedKey = channel?.keys.find((key) => key.frame === readFrame) ?? null;
    const modelValue = storedKey !== null
      ? storedKey.value
      : evaluateRailMotionChannel(record, channelId, readFrame);
    return Object.freeze({
      channelId,
      label: RAIL_MOTION_INSPECTOR_LABELS[channelId],
      unit: RAIL_MOTION_INSPECTOR_UNITS[channelId],
      value: railMotionValueToUi(channelId, modelValue),
    }) as RailMotionInspectorField;
  });

  return Object.freeze({
    railId: record.railId,
    frame: readFrame,
    fields: Object.freeze(fields) as readonly RailMotionInspectorField[],
  }) as RailMotionInspectorPresentation;
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
