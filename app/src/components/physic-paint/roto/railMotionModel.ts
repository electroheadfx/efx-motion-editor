/**
 * Rail motion model (Phase 59).
 *
 * Pure, persistence-agnostic types, value domains, UI conversions, and the
 * canonical channel authority. Every rail (Standard, Motion, Static, Reveal,
 * and bare Key Rails) can carry motion through this model; the record is
 * keyed by the durable rail identity so it survives rail-kind changes.
 *
 * This module must stay free of document wiring: plans 59-03 and later add
 * the persisted collection and the canonical term that consumes it. Nothing
 * here imports `physicsPaintRotoPhysicalModel.ts` (that module will import
 * this one), so the guards below are intentionally module-local.
 */

export type PhysicPaintRotoRailMotionChannelId =
  | 'position-x'
  | 'position-y'
  | 'scale'
  | 'rotation'
  | 'opacity';

export type PhysicPaintRotoRailMotionEasing = 'hold' | 'ease';

export interface PhysicPaintRotoRailMotionKey {
  readonly frame: number;
  readonly value: number;
  readonly easing: PhysicPaintRotoRailMotionEasing;
  readonly wiggle: number;
}

export interface PhysicPaintRotoRailMotionChannel {
  readonly id: PhysicPaintRotoRailMotionChannelId;
  readonly keys: readonly PhysicPaintRotoRailMotionKey[];
}

export interface PhysicPaintRotoRailMotionRecord {
  readonly railId: string;
  readonly anchorKeyId: string;
  readonly channels: readonly PhysicPaintRotoRailMotionChannel[];
}

/**
 * One pure edit step. `set-key` addresses a single axis; a Position edit
 * writes both axes atomically and may carry the sibling axis value the
 * evaluator produced (`pairedValue`).
 */
export type PhysicPaintRotoRailMotionEdit =
  | {
    readonly kind: 'animate';
    readonly railId: string;
    readonly anchorKeyId: string;
    readonly frame: number;
  }
  | {
    readonly kind: 'set-key';
    readonly railId: string;
    readonly channel: PhysicPaintRotoRailMotionChannelId;
    readonly frame: number;
    readonly value: number;
    readonly easing?: PhysicPaintRotoRailMotionEasing;
    readonly wiggle?: number;
    readonly pairedValue?: number;
  }
  | {
    readonly kind: 'remove-key';
    readonly railId: string;
    readonly channel: PhysicPaintRotoRailMotionChannelId;
    readonly frame: number;
  }
  | {
    readonly kind: 'add-channel';
    readonly railId: string;
    readonly channel: PhysicPaintRotoRailMotionChannelId;
    /** Required only when the rail carries no record yet — creates it. */
    readonly anchorKeyId?: string;
  }
  | {
    readonly kind: 'remove-channel';
    readonly railId: string;
    readonly channel: PhysicPaintRotoRailMotionChannelId;
  };

/** Position values are bounded to plus or minus one million pixels. */
export const RAIL_MOTION_POSITION_LIMIT_PX = 1_000_000;

/** Frames and wiggle amounts are bounded to one million. */
export const RAIL_MOTION_FRAME_LIMIT = 1_000_000;
export const RAIL_MOTION_WIGGLE_LIMIT = 1_000_000;

/**
 * The fixed channel order (D-13). Position is presented as one grouped lane
 * whose two model channels always travel together (D-11, D-12).
 */
export const PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER: readonly PhysicPaintRotoRailMotionChannelId[] = Object.freeze([
  'position-x',
  'position-y',
  'scale',
  'rotation',
  'opacity',
]);

export const PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY: readonly PhysicPaintRotoRailMotionRecord[] = Object.freeze([]);

const RAIL_MOTION_CHANNEL_ID_SET: ReadonlySet<string> = new Set(PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER);

const RAIL_MOTION_PERCENT_CHANNEL_IDS: ReadonlySet<PhysicPaintRotoRailMotionChannelId> = new Set([
  'scale',
  'opacity',
]);

const RAIL_MOTION_EASING_VALUES: ReadonlySet<string> = new Set(['hold', 'ease']);

/** Parser caps (T-59-05): enforced before any allocation-heavy work. */
const RAIL_MOTION_MAX_RECORDS = 512;
const RAIL_MOTION_MAX_CHANNELS_PER_RECORD = 5;
const RAIL_MOTION_MAX_KEYS_PER_CHANNEL = 4096;
const RAIL_MOTION_ID_MAX_LENGTH = 128;

const RAIL_MOTION_RECORD_KEYS: ReadonlySet<string> = new Set(['railId', 'anchorKeyId', 'channels']);
const RAIL_MOTION_CHANNEL_KEYS: ReadonlySet<string> = new Set(['id', 'keys']);
const RAIL_MOTION_KEY_KEYS: ReadonlySet<string> = new Set(['frame', 'value', 'easing', 'wiggle']);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isBoundedRailMotionId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= RAIL_MOTION_ID_MAX_LENGTH;
}

function isRailMotionChannelId(value: unknown): value is PhysicPaintRotoRailMotionChannelId {
  return typeof value === 'string' && RAIL_MOTION_CHANNEL_ID_SET.has(value);
}

function isRailMotionEasing(value: unknown): value is PhysicPaintRotoRailMotionEasing {
  return typeof value === 'string' && RAIL_MOTION_EASING_VALUES.has(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRailMotionFrame(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= RAIL_MOTION_FRAME_LIMIT;
}

function isRailMotionWiggle(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= 0
    && value <= RAIL_MOTION_WIGGLE_LIMIT;
}

/**
 * Value domains (D-09):
 * - Position: finite, plus or minus 1,000,000 px.
 * - Scale: finite and strictly positive.
 * - Rotation: any finite number, including negatives and beyond 360, no wrap.
 * - Opacity: the inclusive 0..1 fraction.
 */
export function railMotionValueIsValid(
  channelId: PhysicPaintRotoRailMotionChannelId,
  value: number,
): boolean {
  if (!isRailMotionChannelId(channelId) || !isFiniteNumber(value)) return false;

  switch (channelId) {
    case 'position-x':
    case 'position-y':
      return Math.abs(value) <= RAIL_MOTION_POSITION_LIMIT_PX;
    case 'scale':
      return value > 0;
    case 'rotation':
      return true;
    case 'opacity':
      return value >= 0 && value <= 1;
    default:
      return false;
  }
}

/** Converts a model value to its UI unit: px, percent, degrees, percent. */
export function railMotionValueToUi(
  channelId: PhysicPaintRotoRailMotionChannelId,
  value: number,
): number {
  return RAIL_MOTION_PERCENT_CHANNEL_IDS.has(channelId) ? value * 100 : value;
}

/** Converts a UI value back to its model unit. Rotation never wraps. */
export function railMotionValueFromUi(
  channelId: PhysicPaintRotoRailMotionChannelId,
  uiValue: number,
): number {
  return RAIL_MOTION_PERCENT_CHANNEL_IDS.has(channelId) ? uiValue / 100 : uiValue;
}

function canonicalizeRailMotionKey(
  channelId: PhysicPaintRotoRailMotionChannelId,
  key: PhysicPaintRotoRailMotionKey,
): PhysicPaintRotoRailMotionKey {
  if (!isFiniteNumber(key.frame) || !Number.isInteger(key.frame)) {
    throw new Error(`PhysicPaintRotoRailMotions: frame ${String(key.frame)} in channel "${channelId}" is not a finite integer`);
  }
  if (key.frame < 0 || key.frame > RAIL_MOTION_FRAME_LIMIT) {
    throw new Error(`PhysicPaintRotoRailMotions: frame ${key.frame} in channel "${channelId}" is outside 0..${RAIL_MOTION_FRAME_LIMIT}`);
  }
  if (!isRailMotionEasing(key.easing)) {
    throw new Error(`PhysicPaintRotoRailMotions: easing "${String(key.easing)}" in channel "${channelId}" is not hold or ease`);
  }
  if (!isFiniteNumber(key.wiggle) || key.wiggle < 0 || key.wiggle > RAIL_MOTION_WIGGLE_LIMIT) {
    throw new Error(`PhysicPaintRotoRailMotions: wiggle ${String(key.wiggle)} in channel "${channelId}" is outside 0..${RAIL_MOTION_WIGGLE_LIMIT}`);
  }
  if (!railMotionValueIsValid(channelId, key.value)) {
    throw new Error(`PhysicPaintRotoRailMotions: value ${String(key.value)} is outside the channel domain for "${channelId}"`);
  }

  return Object.freeze({
    frame: key.frame,
    value: key.value,
    easing: key.easing,
    wiggle: key.wiggle,
  });
}

/**
 * Canonicalizes a channel collection: fixed channel order, keys by frame
 * ascending, deeply frozen, and never the input reference.
 *
 * D-12: Position is grouped. `position-x` and `position-y` are both present
 * or both absent, and when present they carry an identical frame set.
 */
export function canonicalizeRailMotionChannels(
  channels: readonly PhysicPaintRotoRailMotionChannel[],
): readonly PhysicPaintRotoRailMotionChannel[] {
  const byId = new Map<PhysicPaintRotoRailMotionChannelId, PhysicPaintRotoRailMotionChannel>();

  for (const channel of channels) {
    if (!isRailMotionChannelId(channel.id)) {
      throw new Error(`PhysicPaintRotoRailMotions: unknown channel id "${String(channel.id)}"`);
    }
    if (byId.has(channel.id)) {
      throw new Error(`PhysicPaintRotoRailMotions: duplicate channel id "${channel.id}"`);
    }
    if (channel.keys.length === 0) {
      throw new Error(`PhysicPaintRotoRailMotions: channel "${channel.id}" must carry at least one key`);
    }

    const seenFrames = new Set<number>();
    for (const key of channel.keys) {
      if (seenFrames.has(key.frame)) {
        throw new Error(`PhysicPaintRotoRailMotions: duplicate frame ${key.frame} in channel "${channel.id}"`);
      }
      seenFrames.add(key.frame);
    }

    byId.set(channel.id, channel);
  }

  const positionX = byId.get('position-x');
  const positionY = byId.get('position-y');
  if ((positionX === undefined) !== (positionY === undefined)) {
    throw new Error('PhysicPaintRotoRailMotions: position-x and position-y must both be present or both absent');
  }
  if (positionX !== undefined && positionY !== undefined) {
    const xFrames = positionX.keys.map((key) => key.frame).sort((left, right) => left - right);
    const yFrames = positionY.keys.map((key) => key.frame).sort((left, right) => left - right);
    const framesMatch = xFrames.length === yFrames.length && xFrames.every((frame, index) => frame === yFrames[index]);
    if (!framesMatch) {
      throw new Error('PhysicPaintRotoRailMotions: position-x and position-y must carry an identical frame set');
    }
  }

  const ordered = PHYSIC_PAINT_ROTO_RAIL_MOTION_CHANNEL_ORDER
    .map((id) => byId.get(id))
    .filter((channel): channel is PhysicPaintRotoRailMotionChannel => channel !== undefined)
    .map((channel) => Object.freeze({
      id: channel.id,
      keys: Object.freeze(
        [...channel.keys]
          .sort((left, right) => left.frame - right.frame)
          .map((key) => canonicalizeRailMotionKey(channel.id, key)),
      ),
    }));

  return Object.freeze(ordered);
}

function parseRailMotionChannel(
  value: unknown,
  railId: string,
  channelIndex: number,
): PhysicPaintRotoRailMotionChannel {
  if (!isRecord(value)) {
    throw new Error(`PhysicPaintRotoRailMotions: record "${railId}" channel at index ${channelIndex} must be a plain object.`);
  }
  if (!hasOnlyAllowedKeys(value, RAIL_MOTION_CHANNEL_KEYS)) {
    throw new Error(`PhysicPaintRotoRailMotions: record "${railId}" channel at index ${channelIndex} has unknown members; expected exactly id, keys.`);
  }

  const id = value.id;
  if (!isRailMotionChannelId(id)) {
    throw new Error(`PhysicPaintRotoRailMotions: unknown channel id "${String(id)}" in record "${railId}".`);
  }

  const rawKeys = value.keys;
  if (!Array.isArray(rawKeys)) {
    throw new Error(`PhysicPaintRotoRailMotions: channel "${id}" in record "${railId}" keys must be an array.`);
  }
  if (rawKeys.length === 0) {
    throw new Error(`PhysicPaintRotoRailMotions: channel "${id}" in record "${railId}" must carry at least one key.`);
  }
  if (rawKeys.length > RAIL_MOTION_MAX_KEYS_PER_CHANNEL) {
    throw new Error(`PhysicPaintRotoRailMotions: channel "${id}" in record "${railId}" must carry at most ${RAIL_MOTION_MAX_KEYS_PER_CHANNEL} keys.`);
  }

  const seenFrames = new Set<number>();
  const keys = rawKeys.map((rawKey, keyIndex): PhysicPaintRotoRailMotionKey => {
    if (!isRecord(rawKey)) {
      throw new Error(`PhysicPaintRotoRailMotions: channel "${id}" in record "${railId}" key at index ${keyIndex} must be a plain object.`);
    }
    if (!hasOnlyAllowedKeys(rawKey, RAIL_MOTION_KEY_KEYS)) {
      throw new Error(`PhysicPaintRotoRailMotions: channel "${id}" in record "${railId}" key at index ${keyIndex} has unknown members; expected exactly frame, value, easing, wiggle.`);
    }

    const frame = rawKey.frame;
    if (!isRailMotionFrame(frame)) {
      throw new Error(`PhysicPaintRotoRailMotions: channel "${id}" in record "${railId}" has an invalid frame ${String(frame)}; expected an integer in 0..${RAIL_MOTION_FRAME_LIMIT}.`);
    }
    if (seenFrames.has(frame)) {
      throw new Error(`PhysicPaintRotoRailMotions: duplicate frame ${frame} in channel "${id}" of record "${railId}".`);
    }
    seenFrames.add(frame);

    const keyValue = rawKey.value;
    if (typeof keyValue !== 'number' || !railMotionValueIsValid(id, keyValue)) {
      throw new Error(`PhysicPaintRotoRailMotions: value ${String(keyValue)} is outside the channel domain for "${id}" in record "${railId}".`);
    }

    const easing = rawKey.easing;
    if (!isRailMotionEasing(easing)) {
      throw new Error(`PhysicPaintRotoRailMotions: invalid easing ${String(easing)} in channel "${id}" of record "${railId}"; expected hold or ease.`);
    }

    const wiggle = rawKey.wiggle;
    if (!isRailMotionWiggle(wiggle)) {
      throw new Error(`PhysicPaintRotoRailMotions: invalid wiggle ${String(wiggle)} in channel "${id}" of record "${railId}"; expected a finite number in 0..${RAIL_MOTION_WIGGLE_LIMIT}.`);
    }

    return { frame, value: keyValue, easing, wiggle };
  });

  return { id, keys };
}

/**
 * Reconstructs the persisted rail motion collection from untrusted input.
 *
 * Fail-closed: no silent clamp, drop, merge or repair. Returns the shared
 * frozen empty constant for an empty array. Check order keeps errors
 * actionable: collection shape and cap, per-record allowlist and identity,
 * channels, keys, then the grouped-Position pairing.
 */
export function parsePhysicPaintRotoRailMotions(
  value: unknown,
): readonly PhysicPaintRotoRailMotionRecord[] {
  if (!Array.isArray(value)) {
    throw new Error('PhysicPaintRotoRailMotions: expected an array of rail motion records.');
  }
  if (value.length > RAIL_MOTION_MAX_RECORDS) {
    throw new Error(`PhysicPaintRotoRailMotions: too many records (${value.length}); at most ${RAIL_MOTION_MAX_RECORDS} are supported.`);
  }
  if (value.length === 0) return PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY;

  const seenRailIds = new Set<string>();
  const records: PhysicPaintRotoRailMotionRecord[] = [];

  value.forEach((entry, recordIndex) => {
    if (!isRecord(entry)) {
      throw new Error(`PhysicPaintRotoRailMotions: record at index ${recordIndex} must be a plain object.`);
    }
    if (!hasOnlyAllowedKeys(entry, RAIL_MOTION_RECORD_KEYS)) {
      throw new Error(`PhysicPaintRotoRailMotions: record at index ${recordIndex} has unknown members; expected exactly railId, anchorKeyId, channels.`);
    }

    const railId = entry.railId;
    if (!isBoundedRailMotionId(railId)) {
      throw new Error(`PhysicPaintRotoRailMotions: record at index ${recordIndex} has an invalid railId; expected a non-empty string of at most ${RAIL_MOTION_ID_MAX_LENGTH} characters.`);
    }
    if (seenRailIds.has(railId)) {
      throw new Error(`PhysicPaintRotoRailMotions: duplicate railId "${railId}".`);
    }
    seenRailIds.add(railId);

    const anchorKeyId = entry.anchorKeyId;
    if (!isBoundedRailMotionId(anchorKeyId)) {
      throw new Error(`PhysicPaintRotoRailMotions: record "${railId}" has an invalid anchorKeyId; expected a non-empty string of at most ${RAIL_MOTION_ID_MAX_LENGTH} characters.`);
    }

    const rawChannels = entry.channels;
    if (!Array.isArray(rawChannels)) {
      throw new Error(`PhysicPaintRotoRailMotions: record "${railId}" channels must be an array.`);
    }
    if (rawChannels.length === 0) {
      throw new Error(`PhysicPaintRotoRailMotions: record "${railId}" must carry at least one channel; remove the record instead.`);
    }
    if (rawChannels.length > RAIL_MOTION_MAX_CHANNELS_PER_RECORD) {
      throw new Error(`PhysicPaintRotoRailMotions: record "${railId}" must carry at most ${RAIL_MOTION_MAX_CHANNELS_PER_RECORD} channels.`);
    }

    const seenChannelIds = new Set<PhysicPaintRotoRailMotionChannelId>();
    const parsedChannels = rawChannels.map((rawChannel, channelIndex) => {
      const parsed = parseRailMotionChannel(rawChannel, railId, channelIndex);
      if (seenChannelIds.has(parsed.id)) {
        throw new Error(`PhysicPaintRotoRailMotions: duplicate channel id "${parsed.id}" in record "${railId}".`);
      }
      seenChannelIds.add(parsed.id);
      return parsed;
    });

    const channels = canonicalizeRailMotionChannels(parsedChannels);

    records.push(Object.freeze({ railId, anchorKeyId, channels }));
  });

  records.sort((left, right) => (
    left.railId < right.railId ? -1 : left.railId > right.railId ? 1 : 0
  ));

  return Object.freeze(records);
}

/**
 * Allocates a fresh durable `railId` for a rail that starts carrying motion.
 *
 * Rail identity is a different namespace from drawing-key identity: this
 * seam exists so a future migration can tell the two apart.
 */
export function createPhysicPaintRotoRailId(): string {
  return crypto.randomUUID();
}

function compareRailMotionRecords(
  left: PhysicPaintRotoRailMotionRecord,
  right: PhysicPaintRotoRailMotionRecord,
): number {
  return left.railId < right.railId ? -1 : left.railId > right.railId ? 1 : 0;
}

function canonicalizeRailMotionRecords(
  records: readonly PhysicPaintRotoRailMotionRecord[],
): readonly PhysicPaintRotoRailMotionRecord[] {
  if (records.length === 0) return PHYSIC_PAINT_ROTO_RAIL_MOTIONS_EMPTY;

  const canonical: PhysicPaintRotoRailMotionRecord[] = records.map((entry) => Object.freeze({
    railId: entry.railId,
    anchorKeyId: entry.anchorKeyId,
    channels: canonicalizeRailMotionChannels(entry.channels),
  }));
  canonical.sort(compareRailMotionRecords);
  return Object.freeze(canonical);
}

function railMotionPositionSibling(
  channelId: PhysicPaintRotoRailMotionChannelId,
): PhysicPaintRotoRailMotionChannelId | null {
  if (channelId === 'position-x') return 'position-y';
  if (channelId === 'position-y') return 'position-x';
  return null;
}

function railMotionIdentityValue(channelId: PhysicPaintRotoRailMotionChannelId): number {
  switch (channelId) {
    case 'position-x':
    case 'position-y':
    case 'rotation':
      return 0;
    case 'scale':
    case 'opacity':
      return 1;
    default:
      return 0;
  }
}

/**
 * The value the channel holds at `frame` without interpolation: the outgoing
 * key value, else the incoming key value (endpoint hold), else the identity.
 */
function railMotionStepValueAt(
  keys: readonly PhysicPaintRotoRailMotionKey[],
  frame: number,
): number {
  let previous: PhysicPaintRotoRailMotionKey | null = null;
  let next: PhysicPaintRotoRailMotionKey | null = null;
  for (const key of keys) {
    if (key.frame <= frame && (previous === null || key.frame > previous.frame)) previous = key;
    if (key.frame >= frame && (next === null || key.frame < next.frame)) next = key;
  }
  return previous?.value ?? next?.value ?? 0;
}

function upsertRailMotionKey(
  keys: readonly PhysicPaintRotoRailMotionKey[],
  frame: number,
  value: number,
  easing: PhysicPaintRotoRailMotionEasing | undefined,
  wiggle: number | undefined,
): readonly PhysicPaintRotoRailMotionKey[] {
  const existingIndex = keys.findIndex((entry) => entry.frame === frame);
  if (existingIndex < 0) {
    return [
      ...keys,
      { frame, value, easing: easing ?? 'ease', wiggle: wiggle ?? 0 },
    ];
  }
  return keys.map((entry, index) => (index === existingIndex
    ? { frame, value, easing: easing ?? entry.easing, wiggle: wiggle ?? entry.wiggle }
    : entry));
}

function replaceRailMotionRecord(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  index: number,
  next: PhysicPaintRotoRailMotionRecord,
): readonly PhysicPaintRotoRailMotionRecord[] {
  const nextRecords = records.map((entry, entryIndex) => (entryIndex === index ? next : entry));
  return canonicalizeRailMotionRecords(nextRecords);
}

function assertRailMotionEditChannel(channel: PhysicPaintRotoRailMotionChannelId): void {
  if (!isRailMotionChannelId(channel)) {
    throw new Error(`PhysicPaintRotoRailMotions: unknown channel id "${String(channel)}" in edit.`);
  }
}

function assertRailMotionEditFrame(frame: number): void {
  if (!isRailMotionFrame(frame)) {
    throw new Error(`PhysicPaintRotoRailMotions: invalid frame ${String(frame)} in edit; expected an integer in 0..${RAIL_MOTION_FRAME_LIMIT}.`);
  }
}

function assertRailMotionEditValue(
  channel: PhysicPaintRotoRailMotionChannelId,
  value: number,
): void {
  if (typeof value !== 'number' || !railMotionValueIsValid(channel, value)) {
    throw new Error(`PhysicPaintRotoRailMotions: value ${String(value)} is outside the channel domain for "${channel}" in edit.`);
  }
}

function applyAnimateEdit(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  edit: Extract<PhysicPaintRotoRailMotionEdit, { kind: 'animate' }>,
): readonly PhysicPaintRotoRailMotionRecord[] {
  if (!isBoundedRailMotionId(edit.railId)) {
    throw new Error('PhysicPaintRotoRailMotions: invalid railId in animate edit.');
  }
  // D-04: a rail that already carries a record is never re-seeded.
  if (records.some((entry) => entry.railId === edit.railId)) return records;
  if (!isBoundedRailMotionId(edit.anchorKeyId)) {
    throw new Error('PhysicPaintRotoRailMotions: invalid anchorKeyId in animate edit.');
  }
  assertRailMotionEditFrame(edit.frame);

  const seedChannel = (
    id: 'position-x' | 'position-y',
  ): PhysicPaintRotoRailMotionChannel => ({
    id,
    keys: [{ frame: edit.frame, value: 0, easing: 'ease', wiggle: 0 }],
  });

  return canonicalizeRailMotionRecords([
    ...records,
    {
      railId: edit.railId,
      anchorKeyId: edit.anchorKeyId,
      channels: [seedChannel('position-x'), seedChannel('position-y')],
    },
  ]);
}

function applySetKeyEdit(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  edit: Extract<PhysicPaintRotoRailMotionEdit, { kind: 'set-key' }>,
): readonly PhysicPaintRotoRailMotionRecord[] {
  const recordIndex = records.findIndex((entry) => entry.railId === edit.railId);
  if (recordIndex < 0) return records;

  assertRailMotionEditChannel(edit.channel);
  assertRailMotionEditFrame(edit.frame);
  assertRailMotionEditValue(edit.channel, edit.value);
  if (edit.easing !== undefined && !isRailMotionEasing(edit.easing)) {
    throw new Error(`PhysicPaintRotoRailMotions: invalid easing "${String(edit.easing)}" in set-key edit.`);
  }
  if (edit.wiggle !== undefined && !isRailMotionWiggle(edit.wiggle)) {
    throw new Error(`PhysicPaintRotoRailMotions: invalid wiggle ${String(edit.wiggle)} in set-key edit.`);
  }

  const record = records[recordIndex];
  // D-08: a channel that carries no motion never mutates silently.
  if (!record.channels.some((entry) => entry.id === edit.channel)) return records;

  const siblingId = railMotionPositionSibling(edit.channel);
  if (siblingId !== null && edit.pairedValue !== undefined) {
    assertRailMotionEditValue(siblingId, edit.pairedValue);
  }

  const channels = record.channels.map((entry) => {
    if (entry.id === edit.channel) {
      return {
        id: entry.id,
        keys: upsertRailMotionKey(entry.keys, edit.frame, edit.value, edit.easing, edit.wiggle),
      };
    }
    if (siblingId === null || entry.id !== siblingId) return entry;

    const existing = entry.keys.find((key) => key.frame === edit.frame);
    if (existing !== undefined) {
      if (edit.pairedValue === undefined) return entry;
      return {
        id: entry.id,
        keys: entry.keys.map((key) => (key.frame === edit.frame
          ? { ...key, value: edit.pairedValue as number }
          : key)),
      };
    }

    const siblingValue = edit.pairedValue ?? railMotionStepValueAt(entry.keys, edit.frame);
    return {
      id: entry.id,
      keys: [
        ...entry.keys,
        { frame: edit.frame, value: siblingValue, easing: edit.easing ?? 'ease', wiggle: 0 },
      ],
    };
  });

  return replaceRailMotionRecord(records, recordIndex, { ...record, channels });
}

function applyRemoveKeyEdit(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  edit: Extract<PhysicPaintRotoRailMotionEdit, { kind: 'remove-key' }>,
): readonly PhysicPaintRotoRailMotionRecord[] {
  const recordIndex = records.findIndex((entry) => entry.railId === edit.railId);
  if (recordIndex < 0) return records;

  assertRailMotionEditChannel(edit.channel);
  assertRailMotionEditFrame(edit.frame);

  const record = records[recordIndex];
  const addressed = record.channels.find((entry) => entry.id === edit.channel);
  if (addressed === undefined) return records;
  if (!addressed.keys.some((key) => key.frame === edit.frame)) return records;

  const siblingId = railMotionPositionSibling(edit.channel);
  const channels: PhysicPaintRotoRailMotionChannel[] = [];
  for (const entry of record.channels) {
    const grouped = entry.id === edit.channel || (siblingId !== null && entry.id === siblingId);
    if (!grouped) {
      channels.push(entry);
      continue;
    }
    const keys = entry.keys.filter((key) => key.frame !== edit.frame);
    if (keys.length > 0) channels.push({ id: entry.id, keys });
  }

  // D-15: key -> channel when empty -> record when no channels remain.
  if (channels.length === 0) {
    return canonicalizeRailMotionRecords(records.filter((_, index) => index !== recordIndex));
  }
  return replaceRailMotionRecord(records, recordIndex, { ...record, channels });
}

function applyAddChannelEdit(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  edit: Extract<PhysicPaintRotoRailMotionEdit, { kind: 'add-channel' }>,
): readonly PhysicPaintRotoRailMotionRecord[] {
  const recordIndex = records.findIndex((entry) => entry.railId === edit.railId);

  assertRailMotionEditChannel(edit.channel);

  const siblingId = railMotionPositionSibling(edit.channel);
  const groupedIds: readonly PhysicPaintRotoRailMotionChannelId[] = siblingId === null
    ? [edit.channel]
    : ['position-x', 'position-y'];
  if (recordIndex >= 0 && records[recordIndex].channels.some((entry) => groupedIds.includes(entry.id))) {
    return records;
  }

  const seedKey = (value: number): PhysicPaintRotoRailMotionKey => ({
    frame: 0,
    value,
    easing: 'hold',
    wiggle: 0,
  });

  const seeds: PhysicPaintRotoRailMotionChannel[] = siblingId === null
    ? [{ id: edit.channel, keys: [seedKey(railMotionIdentityValue(edit.channel))] }]
    : [
      { id: 'position-x', keys: [seedKey(0)] },
      { id: 'position-y', keys: [seedKey(0)] },
    ];

  // 261107: adding a channel is what makes a rail animatable, so an unknown
  // rail CREATES its record here (no separate Animate step, no default
  // Position channel). The anchor is required only for that creation.
  if (recordIndex < 0) {
    if (edit.anchorKeyId === undefined || !isBoundedRailMotionId(edit.anchorKeyId)) {
      return records;
    }
    return canonicalizeRailMotionRecords([
      ...records,
      { railId: edit.railId, anchorKeyId: edit.anchorKeyId, channels: seeds },
    ]);
  }

  const record = records[recordIndex];
  return replaceRailMotionRecord(records, recordIndex, {
    ...record,
    channels: [...record.channels, ...seeds],
  });
}

function applyRemoveChannelEdit(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  edit: Extract<PhysicPaintRotoRailMotionEdit, { kind: 'remove-channel' }>,
): readonly PhysicPaintRotoRailMotionRecord[] {
  const recordIndex = records.findIndex((entry) => entry.railId === edit.railId);
  if (recordIndex < 0) return records;

  assertRailMotionEditChannel(edit.channel);

  const record = records[recordIndex];
  const siblingId = railMotionPositionSibling(edit.channel);
  const groupedIds: readonly PhysicPaintRotoRailMotionChannelId[] = siblingId === null
    ? [edit.channel]
    : ['position-x', 'position-y'];
  if (!record.channels.some((entry) => groupedIds.includes(entry.id))) return records;

  const remaining = record.channels.filter((entry) => !groupedIds.includes(entry.id));
  if (remaining.length === 0) {
    return canonicalizeRailMotionRecords(records.filter((_, index) => index !== recordIndex));
  }
  return replaceRailMotionRecord(records, recordIndex, { ...record, channels: remaining });
}

/**
 * Applies one pure edit to the rail motion collection.
 *
 * Never mutates its input and returns the same reference when nothing
 * changed. Edits on an unknown rail are quiet no-ops (a stale UI read),
 * except `animate`, which creates the record. Invalid values throw; the
 * store action catches and refuses them.
 */
export function applyRailMotionEditToCollection(
  records: readonly PhysicPaintRotoRailMotionRecord[],
  edit: PhysicPaintRotoRailMotionEdit,
): readonly PhysicPaintRotoRailMotionRecord[] {
  switch (edit.kind) {
    case 'animate':
      return applyAnimateEdit(records, edit);
    case 'set-key':
      return applySetKeyEdit(records, edit);
    case 'remove-key':
      return applyRemoveKeyEdit(records, edit);
    case 'add-channel':
      return applyAddChannelEdit(records, edit);
    case 'remove-channel':
      return applyRemoveChannelEdit(records, edit);
    default:
      throw new Error(`PhysicPaintRotoRailMotions: unknown edit kind "${String((edit as { kind?: unknown }).kind)}".`);
  }
}
