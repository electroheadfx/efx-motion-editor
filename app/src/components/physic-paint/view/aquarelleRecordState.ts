// ============================================================
//  aquarelleRecordState — the ONE aquarelle record-path commit
//  seam (56-07). Live param bag + selected tip multipliers +
//  active tool; snapshot at record time, never at play time
//  (AQUA-04 / D-08 / R1.7).
//
//  Setters are compare-then-write (efx-preact-reactivity rule 3)
//  so a same-value commit is a no-op (no undo record, no revision
//  bump). The snapshot is the sole params channel — never a
//  second bag.
// ============================================================

import { signal } from '@preact/signals';
import {
  DIFFUSION_CAP,
  createDryEvent,
  isAquarelleDryEvent,
  toStudioStroke,
  type AquarelleDryEvent,
  type AquarellePayloadEvent,
  type AquarelleStroke,
  type AquarelleStrokePayload,
  type AquarelleTool,
} from '@efxlab/efx-watercolor/payload';
import {
  NEUTRAL_TOOL_OVERRIDES,
  findTip,
  toolOverridesFromTip,
  type AquarelleToolOverrides,
} from '@efxlab/efx-watercolor/brushes';
import { BRUSH_PRESETS } from '@efxlab/efx-watercolor';
import {
  buildKeyIdentityFrameMap,
  type KeyIdentityFrameRecord,
} from '../roto/keyIdentityFrameMap';

/** The 8 AQUA-04 globals. `size` maps to the shared Size slider (D-05). */
export interface AquarelleGlobalParams {
  size: number;
  water: number;
  load: number;
  flow: number;
  bleed: number;
  dry: number;
  edge: number;
  granulation: number;
}

export type AquarelleGlobalKey = keyof AquarelleGlobalParams;

export const AQUARELLE_GLOBAL_KEYS: readonly AquarelleGlobalKey[] = Object.freeze([
  'size',
  'water',
  'load',
  'flow',
  'bleed',
  'dry',
  'edge',
  'granulation',
] as const);

export const DEFAULT_AQUARELLE_PARAMS: Readonly<AquarelleGlobalParams> = Object.freeze({
  size: 12,
  water: 50,
  load: 50,
  flow: 50,
  bleed: 50,
  dry: 50,
  edge: 50,
  granulation: 50,
});

/** D-08 multiplier band. */
export const MULTIPLIER_MIN = 0.5;
export const MULTIPLIER_MAX = 2.0;
export const MULTIPLIER_DEFAULT = 1.0;

export const aquarelleParams = signal<AquarelleGlobalParams>({
  ...DEFAULT_AQUARELLE_PARAMS,
});
export const aquarelleActiveTool = signal<AquarelleTool>('brush');
// I-11 follow-up: Studio opens on ROUND so the Settings tab has a usable
// response out of the box (the preset's own shape lives in BRUSH_PRESETS;
// the multiplier bag starts neutral).
export const aquarelleSelectedTipId = signal<string | null>('round');
export const aquarelleToolOverrides = signal<AquarelleToolOverrides>({
  ...NEUTRAL_TOOL_OVERRIDES,
});

/**
 * Per-brush response memory (I-11 / D). The active bag above is the one
 * consumer contract; this store keeps each brush's edits keyed by brush id
 * so switching brushes no longer resets them to neutral.
 */
export const aquarelleBrushResponseMemory = signal<
  Readonly<Record<string, AquarelleToolOverrides>>
>({});

/** Compare-then-write (efx-preact-reactivity rule 3). */
export function setAquarelleParam(key: AquarelleGlobalKey, value: number): void {
  if (!Number.isFinite(value)) return;
  const current = aquarelleParams.value;
  if (current[key] === value) return;
  aquarelleParams.value = { ...current, [key]: value };
}

export function setAquarelleTool(tool: AquarelleTool): void {
  if (aquarelleActiveTool.value === tool) return;
  aquarelleActiveTool.value = tool;
}

/**
 * Select a tip and load its per-brush multipliers into the Brush
 * response surface (D-07 / R1.7). A null id clears the selection
 * and resets multipliers to neutral.
 *
 * 261017-xa0 I-03: a pick may also be a bare playground `BRUSH_PRESETS`
 * id (`round`, `flat`, …). Presets carry their own shape via
 * `buildBrush`, so a preset hit loads the neutral multiplier bag and
 * keeps the id. Any successful non-null pick also forces the active
 * tool back to `brush` (user directive 2026-10-16) — picking while
 * Water / Pen / Lift is active returns the surface to Brush.
 */
export function selectAquarelleTip(tipId: string | null): void {
  const tip = tipId ? findTip(tipId) : undefined;
  const preset = !tip && tipId
    ? BRUSH_PRESETS.find((b) => b.id === tipId)
    : undefined;
  const nextId = tip ? tip.id : preset ? preset.id : null;
  // A successful pick is a brush-tool variant pick — flip the tool first
  // so a re-pick of the already-selected id still returns to Brush.
  if (nextId !== null) setAquarelleTool('brush');
  const currentId = aquarelleSelectedTipId.value;
  if (currentId === nextId) return;

  // I-11: remember the outgoing brush's edits before loading the next one.
  if (currentId !== null) {
    const memory = aquarelleBrushResponseMemory.value;
    const existing = memory[currentId];
    const active = aquarelleToolOverrides.value;
    if (!existing || !overridesEqual(existing, active)) {
      aquarelleBrushResponseMemory.value = {
        ...memory,
        [currentId]: { ...active },
      };
    }
  }

  aquarelleSelectedTipId.value = nextId;
  const remembered = nextId ? aquarelleBrushResponseMemory.value[nextId] : undefined;
  aquarelleToolOverrides.value = remembered
    ? { ...remembered }
    : tip
      ? toolOverridesFromTip(tip)
      : { ...NEUTRAL_TOOL_OVERRIDES };
}

function overridesEqual(
  a: AquarelleToolOverrides,
  b: AquarelleToolOverrides,
): boolean {
  return (
    a.tip === b.tip &&
    a.aspect === b.aspect &&
    a.rotation === b.rotation &&
    a.sizeCurve === b.sizeCurve &&
    a.scatter === b.scatter &&
    a.capacity === b.capacity &&
    a.grain === b.grain &&
    a.wetRound === b.wetRound
  );
}

export function setAquarelleMultiplier(
  field: keyof AquarelleToolOverrides,
  value: number,
): void {
  if (!Number.isFinite(value)) return;
  const clamped = Math.max(MULTIPLIER_MIN, Math.min(MULTIPLIER_MAX, value));
  const current = aquarelleToolOverrides.value;
  if (current[field] === clamped) return;
  aquarelleToolOverrides.value = { ...current, [field]: clamped };
}

/**
 * D-08 effective-value readout: global × multiplier.
 * Pure so the panel and the pin share one formula.
 */
export function effectiveMultiplierValue(global: number, multiplier: number): number {
  return global * multiplier;
}

/**
 * Related global for each multiplier's effective readout.
 * `null` = no global pairing (readout uses neutral base 1).
 */
export const MULTIPLIER_BASE_KEYS: Readonly<
  Record<keyof AquarelleToolOverrides, AquarelleGlobalKey | null>
> = Object.freeze({
  tip: 'size',
  aspect: 'size',
  rotation: null,
  sizeCurve: 'size',
  scatter: 'size',
  capacity: 'load',
  grain: 'granulation',
  wetRound: 'water',
});

/** Human-readable multiplier row labels (toolOverride field names). */
export const MULTIPLIER_LABELS: Readonly<Record<keyof AquarelleToolOverrides, string>> =
  Object.freeze({
    tip: 'Tip',
    aspect: 'Aspect',
    rotation: 'Rotation',
    sizeCurve: 'SizeCurve',
    scatter: 'Scatter',
    capacity: 'Capacity',
    grain: 'Grain',
    wetRound: 'Wet round',
  });

/** Record-time snapshot of the live bag (AQUA-04 / R1.7). */
export function snapshotAquarelleRecord(): {
  params: Record<string, number>;
  toolOverrides: AquarelleToolOverrides;
  brushId: string;
  tool: AquarelleTool;
} {
  const live = aquarelleParams.value;
  const params: Record<string, number> = {};
  for (const key of AQUARELLE_GLOBAL_KEYS) {
    params[key] = live[key];
  }
  return {
    params,
    toolOverrides: { ...aquarelleToolOverrides.value },
    brushId: aquarelleSelectedTipId.value ?? '',
    tool: aquarelleActiveTool.value,
  };
}

/** Build an AquarelleStrokePayload from the live bag (record-time snapshot). */
export function buildAquarelleStrokePayload(
  extra?: Partial<AquarelleStrokePayload>,
): AquarelleStrokePayload {
  const snap = snapshotAquarelleRecord();
  return {
    tool: snap.tool,
    color: null,
    params: snap.params,
    brushId: snap.brushId,
    toolOverrides: snap.toolOverrides,
    timestamp: 0,
    ...extra,
  };
}

/**
 * Stroke-end record store (56-11 supersedes the params-only seam).
 * The live aquarelle surface calls `recordAquarelleStroke` at stroke
 * end with the full AquarelleStroke (points + ticks + params). The
 * PlayScript bake projection reads it back so the aquarelle engine
 * replays the exact marks the user painted.
 *
 * FRAME-ANCHOR LAW (quick-261024-m20): every recorded stroke and its projected
 * timeline entry are anchored to their edit frame's KEY IDENTITY, not to the
 * number. An accepted physical replace (force-spacing, ripple, deletion)
 * remaps `playFrame` onto the surviving key's next appFrame through the shared
 * `buildKeyIdentityFrameMap` — registry, projected entries and the payload
 * timeline stay in lockstep. A key that disappeared drops its script from the
 * SESSION only: the snapshot retained union keeps the file content and an
 * explicit purge remains the only destructive path. A malformed layout fails
 * closed (null, nothing mutated). Dry events carry no frame anchor and are
 * never touched.
 */
const recordedStrokes = new Map<number, AquarelleStroke>();
/** The projected timeline entry per stroke, so a measured cuisson can patch it. */
const recordedStrokeEntries = new Map<number, ReturnType<typeof toStudioStroke>>();

/**
 * 261022-pim: the recorded-stroke revision. Bumps whenever the stroke SET or
 * its frame anchors change (record, delete, restore, key-identity remap) —
 * the narrow select overlay leaf reads it so it re-lists outlines without the
 * Studio body subscribing to the map.
 */
export const aquarelleStrokesRevision = signal(0);

/** Compare-free internal bump — every caller already changed the stroke set. */
export function bumpAquarelleStrokesRevision(): void {
  aquarelleStrokesRevision.value += 1;
}

/**
 * 261022-ujp: creation-order serials for the stack badges. Per edit frame and
 * never reused — a deleted stroke keeps its number, so the survivors never
 * renumber and the id is a stable handle on a stroke (restacking does not
 * touch it). Assigned at record time; a loaded script assigns on first listing
 * in registry order, which is the recorded order the load preserved.
 */
const aquarelleStrokeSerials = new Map<number, number>();
const aquarelleFrameSerialCounters = new Map<number, number>();

export function aquarelleStrokeSerial(mutationId: number, playFrame: number): number {
  const existing = aquarelleStrokeSerials.get(mutationId);
  if (existing !== undefined) return existing;
  const frame = Number.isFinite(playFrame) ? playFrame : 0;
  const next = (aquarelleFrameSerialCounters.get(frame) ?? 0) + 1;
  aquarelleFrameSerialCounters.set(frame, next);
  aquarelleStrokeSerials.set(mutationId, next);
  return next;
}

/**
 * 261022-pim: mutationIds removed from the SCRIPT. The engine-1 guide stroke
 * stays in the engine's ledger (capture order and paint barriers remain
 * stable); the markers are what the select surface, the capture projection,
 * and the script-playback fallback honor.
 */
const deletedAquarelleStrokeIds = new Set<number>();

export function markAquarelleStrokeDeleted(mutationId: number): void {
  deletedAquarelleStrokeIds.add(mutationId);
}

export function isAquarelleStrokeDeleted(mutationId: number): boolean {
  return deletedAquarelleStrokeIds.has(mutationId);
}

export function clearAquarelleStrokeDeletion(mutationId: number): void {
  deletedAquarelleStrokeIds.delete(mutationId);
}

/**
 * Read-only view of the recorded stroke registry, in recording order.
 * Select/hit-test/outline all walk this — never a second registry.
 */
export function getRecordedAquarelleStrokeEntries(): ReadonlyMap<number, AquarelleStroke> {
  return recordedStrokes;
}

/**
 * 261022-tv1: one captured registry pair — the LIVE stroke object and the
 * LIVE timeline-entry object. Snapshots hold these references on purpose: a
 * move replaces objects (never mutates them), so restoring a snapshot puts
 * the exact pre-move objects back.
 */
export type AquarelleStrokeRegistryPair = readonly [
  mutationId: number,
  stroke: AquarelleStroke,
  entry: ReturnType<typeof toStudioStroke>,
];

export interface AquarelleStrokeRegistrySnapshot {
  readonly pairs: readonly AquarelleStrokeRegistryPair[];
}

/**
 * Capture the recorded-stroke registry in Map insertion order (the hit-test
 * walks it newest-last). The timeline entry is the SAME object pushed onto
 * `payloadTimeline`, so capturing it keeps the two stores in lockstep.
 */
export function captureAquarelleStrokeRegistry(): AquarelleStrokeRegistrySnapshot {
  const pairs: AquarelleStrokeRegistryPair[] = [];
  for (const [mutationId, stroke] of recordedStrokes) {
    const entry = recordedStrokeEntries.get(mutationId);
    if (!entry) continue;
    pairs.push([mutationId, stroke, entry]);
  }
  return { pairs };
}

/**
 * Restore the captured registry exactly: both maps are cleared and re-set in
 * the captured order (`Map.set` on a fresh map keeps insertion order, so
 * newest-first hit-testing stays stable).
 */
export function restoreAquarelleStrokeRegistry(
  snapshot: AquarelleStrokeRegistrySnapshot,
): void {
  recordedStrokes.clear();
  recordedStrokeEntries.clear();
  for (const [mutationId, stroke, entry] of snapshot.pairs) {
    recordedStrokes.set(mutationId, stroke);
    recordedStrokeEntries.set(mutationId, entry);
  }
}

/**
 * 261022-tv1 / 261024-mz5: translate one recorded stroke OR the whole
 * selection (and its payload-timeline entry) by a document-UV delta.
 * Everything else — ticks, recordedOrder, cuisson, traceSeed, playFrame,
 * params, the record clock — is untouched. Returns the number of changed
 * strokes; unknown/deleted ids are ignored and an empty batch bumps nothing.
 *
 * Objects are REPLACED, never mutated in place: an aquarelle script snapshot
 * keeps the live event references (that is what lets a measured cuisson patch
 * survive a swap), so an in-place translate would also translate the captured
 * `before` side and undo could never restore the origin. The new entry is
 * written at the SAME index so replay order is preserved.
 */
export function translateAquarelleStrokesInScript(
  mutationIds: readonly number[],
  dxUv: number,
  dyUv: number,
): number {
  if (!Number.isFinite(dxUv) || !Number.isFinite(dyUv)) return 0;
  if (dxUv === 0 && dyUv === 0) return 0;

  // Resolve every target BEFORE mutating: an unknown/deleted/out-of-timeline
  // id is ignored, and an all-unknown batch touches nothing.
  const targets: Array<{
    mutationId: number;
    stroke: AquarelleStroke;
    entry: ReturnType<typeof toStudioStroke>;
    index: number;
  }> = [];
  for (const mutationId of mutationIds) {
    const stroke = recordedStrokes.get(mutationId);
    const entry = recordedStrokeEntries.get(mutationId);
    if (!stroke || !entry || deletedAquarelleStrokeIds.has(mutationId)) continue;
    const index = payloadTimeline.indexOf(entry);
    if (index < 0) continue;
    if (targets.some((target) => target.mutationId === mutationId)) continue;
    targets.push({ mutationId, stroke, entry, index });
  }
  if (targets.length === 0) return 0;

  for (const { mutationId, stroke, entry, index } of targets) {
    const movedStroke: AquarelleStroke = {
      ...stroke,
      points: stroke.points.map((strokePoint) => ({
        x: strokePoint.x + dxUv,
        y: strokePoint.y + dyUv,
        p: strokePoint.p,
        tx: strokePoint.tx,
        ty: strokePoint.ty,
        tw: strokePoint.tw,
      })),
    };
    const movedEntry: ReturnType<typeof toStudioStroke> = {
      ...entry,
      pts: entry.pts.map((strokePoint) => ({
        ...strokePoint,
        x: strokePoint.x + dxUv,
        y: strokePoint.y + dyUv,
      })),
    };

    recordedStrokes.set(mutationId, movedStroke);
    recordedStrokeEntries.set(mutationId, movedEntry);
    // SAME index — replay order is preserved (no splice, only a replace).
    payloadTimeline[index] = movedEntry;
  }
  bumpAquarelleStrokesRevision();
  return targets.length;
}

/** Single-stroke wrapper — one stroke of the batch path. */
export function translateAquarelleStrokeInScript(
  mutationId: number,
  dxUv: number,
  dyUv: number,
): boolean {
  return translateAquarelleStrokesInScript([mutationId], dxUv, dyUv) > 0;
}

/** Stack-step direction: `back` = one step behind, `forward` = one step in front. */
export type AquarelleStackStepDirection = 'back' | 'forward';

/**
 * 261022-ujp: step one recorded stroke through the payload timeline — swap it
 * with the nearest non-deleted stroke of the same edit frame in the requested
 * direction.
 *
 * The payload timeline IS the watercolor paint order, so the two entries trade
 * places. The RECORDING SLOT (`recordedOrder` / `timestamp`) trades places with
 * them: the bake derives each stroke's start tick from that clock and clamps it
 * so strokes never overlap, so a moved stroke left carrying a timestamp that
 * disagrees with its new neighbour collapses the settle gap — it is then
 * replayed into a still-wet puddle and the water absorbs it (2-stroke repro:
 * send the blue underpainting behind the pink stroke and the blue vanishes).
 * Everything else on the stroke (points, ticks, playFrame, cuisson) is
 * untouched.
 *
 * Entries and strokes are REPLACED, never mutated in place: an aquarelle script
 * snapshot holds the live object references, so a mutation would also rewrite
 * the captured `before` side and undo could never restore it.
 *
 * Dry events are sheet actions with no frame anchor (D-15), so they keep their
 * absolute timeline index and are simply walked past. The registry Map
 * insertion order is never reordered — hit-testing walks it newest-last.
 *
 * Refuses unknown, deleted, out-of-timeline, and already-at-that-end ids
 * without touching the revision.
 */
export function stepAquarelleStrokeInScript(
  mutationId: number,
  direction: AquarelleStackStepDirection,
): boolean {
  const entry = recordedStrokeEntries.get(mutationId);
  if (!entry || deletedAquarelleStrokeIds.has(mutationId)) return false;
  const index = payloadTimeline.indexOf(entry);
  if (index < 0) return false;

  const step = direction === 'back' ? -1 : 1;
  let partnerIndex = -1;
  let partnerId: number | undefined;
  for (let candidate = index + step; candidate >= 0 && candidate < payloadTimeline.length; candidate += step) {
    const event = payloadTimeline[candidate]!;
    // Dry is a sheet action with no frame anchor (D-15): never a swap partner.
    if (isAquarelleDryEvent(event)) continue;
    if (event.playFrame !== entry.playFrame) continue;
    const candidateId = (event.engine as AquarelleStrokePayload).mutationId;
    if (candidateId === undefined || deletedAquarelleStrokeIds.has(candidateId)) continue;
    partnerIndex = candidate;
    partnerId = candidateId;
    break;
  }
  if (partnerIndex < 0 || partnerId === undefined) return false;

  const partnerEntry = payloadTimeline[partnerIndex]!;
  if (isAquarelleDryEvent(partnerEntry)) return false;
  const movedSlot = entry.recordedOrder;
  const partnerSlot = partnerEntry.recordedOrder;

  const movedReplacement = withRecordedSlot(entry, partnerSlot);
  const partnerReplacement = withRecordedSlot(partnerEntry, movedSlot);
  payloadTimeline[index] = partnerReplacement;
  payloadTimeline[partnerIndex] = movedReplacement;

  const movedStroke = recordedStrokes.get(mutationId);
  if (movedStroke) recordedStrokes.set(mutationId, { ...movedStroke, timestamp: partnerSlot });
  const partnerStroke = recordedStrokes.get(partnerId);
  if (partnerStroke) recordedStrokes.set(partnerId, { ...partnerStroke, timestamp: movedSlot });

  recordedStrokeEntries.set(mutationId, movedReplacement);
  recordedStrokeEntries.set(partnerId, partnerReplacement);

  bumpAquarelleStrokesRevision();
  return true;
}

/** One timeline entry re-stamped into another recording slot (new object). */
function withRecordedSlot(
  entry: ReturnType<typeof toStudioStroke>,
  recordedOrder: number,
): ReturnType<typeof toStudioStroke> {
  return {
    ...entry,
    recordedOrder,
    engine: { ...entry.engine, timestamp: recordedOrder },
  };
}

/** 261022-ujp: one step behind (toward the bottom of the paint stack). */
export function sendAquarelleStrokeBackwardInScript(mutationId: number): boolean {
  return stepAquarelleStrokeInScript(mutationId, 'back');
}

/** 261022-ujp: one step in front (toward the top of the paint stack). */
export function sendAquarelleStrokeForwardInScript(mutationId: number): boolean {
  return stepAquarelleStrokeInScript(mutationId, 'forward');
}

/**
 * Remove one recorded stroke OR the whole selection from the SCRIPT
 * (261022-pim / 261024-mz5). The engine-1 guide strokes stay in the engine's
 * ledger (capture order + paint barriers remain stable); the markers plus the
 * timeline splices are the script mutation the capture and every replay path
 * honor. Returns the number of removed strokes; unknown/already-deleted ids
 * are ignored and bump nothing.
 */
export function deleteAquarelleStrokesFromScript(
  mutationIds: readonly number[],
): number {
  const removed: number[] = [];
  for (const mutationId of mutationIds) {
    if (removed.includes(mutationId)) continue;
    const stroke = recordedStrokes.get(mutationId);
    const entry = recordedStrokeEntries.get(mutationId);
    if (!stroke || !entry || deletedAquarelleStrokeIds.has(mutationId)) continue;
    markAquarelleStrokeDeleted(mutationId);
    const index = payloadTimeline.indexOf(entry);
    if (index >= 0) payloadTimeline.splice(index, 1);
    removed.push(mutationId);
  }
  if (removed.length === 0) return 0;
  bumpAquarelleStrokesRevision();
  return removed.length;
}

/** Single-stroke wrapper — one stroke of the batch path (a second click is a no-op). */
export function deleteAquarelleStrokeFromScript(mutationId: number): boolean {
  return deleteAquarelleStrokesFromScript([mutationId]) > 0;
}

/**
 * quick-261023-ors: purge ONE key's aquarelle script (the confirmed per-key
 * purge on the Memory tab). Every non-Dry timeline event whose `playFrame`
 * equals `frame` leaves the timeline together with its registry entry,
 * projected entry, deletion marker and creation serial; the frame's serial
 * counter restarts. Dry is a sheet action with no frame anchor (D-15), so it
 * keeps its place — and the record clock is NOT reset, so later strokes keep
 * the tick cursor the session already reached.
 *
 * The engine's guide strokes are untouched, exactly like
 * `deleteAquarelleStrokeFromScript`: the script (record state) is what the
 * purge removes, never the painted pixels.
 *
 * Walks the timeline backwards so each splice is stable. Returns the number
 * of events removed and bumps the revision ONCE, only when something left.
 */
export function purgeAquarelleFrameScript(frame: number): number {
  let removed = 0;
  for (let index = payloadTimeline.length - 1; index >= 0; index -= 1) {
    const event = payloadTimeline[index]!;
    if (isAquarelleDryEvent(event)) continue;
    if (event.playFrame !== frame) continue;
    payloadTimeline.splice(index, 1);
    const mutationId = (event.engine as AquarelleStrokePayload).mutationId;
    if (mutationId !== undefined) {
      recordedStrokes.delete(mutationId);
      recordedStrokeEntries.delete(mutationId);
      deletedAquarelleStrokeIds.delete(mutationId);
      aquarelleStrokeSerials.delete(mutationId);
    }
    removed += 1;
  }
  if (removed === 0) return 0;
  aquarelleFrameSerialCounters.delete(frame);
  bumpAquarelleStrokesRevision();
  return removed;
}

/**
 * quick-261023-ors: purge the ACTIVE RAIL's aquarelle script (the confirmed
 * clear-all). Removes every stroke identity — timeline events AND registry
 * entries, including already-deleted tombstones and orphaned entries that no
 * timeline event references — while every Dry event stays (sheet actions are
 * not per-rail script). All per-frame serial counters clear; the record clock
 * is not reset.
 *
 * Returns the number of distinct stroke identities removed and bumps the
 * revision ONCE, only when something left.
 */
export function purgeAllAquarelleKeyScripts(): number {
  const removedIds = new Set<number>(recordedStrokes.keys());
  for (let index = payloadTimeline.length - 1; index >= 0; index -= 1) {
    const event = payloadTimeline[index]!;
    if (isAquarelleDryEvent(event)) continue;
    payloadTimeline.splice(index, 1);
    const mutationId = (event.engine as AquarelleStrokePayload).mutationId;
    if (mutationId !== undefined) removedIds.add(mutationId);
  }
  recordedStrokes.clear();
  recordedStrokeEntries.clear();
  deletedAquarelleStrokeIds.clear();
  aquarelleStrokeSerials.clear();
  aquarelleFrameSerialCounters.clear();
  if (removedIds.size === 0) return 0;
  bumpAquarelleStrokesRevision();
  return removedIds.size;
}

/**
 * Undo half of a delete (261022-pim): unmark the stroke and reinsert its
 * timeline entry at the recorded index. Bumps the revision.
 */
export function restoreAquarelleStrokeInScript(
  mutationId: number,
  atIndex: number,
): boolean {
  const entry = recordedStrokeEntries.get(mutationId);
  if (!entry || !deletedAquarelleStrokeIds.has(mutationId)) return false;
  clearAquarelleStrokeDeletion(mutationId);
  const clamped = Math.max(
    0,
    Math.min(payloadTimeline.length, Math.trunc(atIndex)),
  );
  if (!payloadTimeline.includes(entry)) payloadTimeline.splice(clamped, 0, entry);
  bumpAquarelleStrokesRevision();
  return true;
}

export function recordAquarelleStroke(
  mutationId: number,
  stroke: AquarelleStroke,
): void {
  // The payload projection reads the id from the stroke itself, so the registry
  // entry must carry it — a stroke recorded without an id would fall out of
  // every `engine.mutationId` walk (stack position, capture, replay filters).
  const recorded = stroke.mutationId === mutationId ? stroke : { ...stroke, mutationId };
  recordedStrokes.set(mutationId, recorded);
  // Creation-order serial FIRST so the badge number can never reshuffle.
  aquarelleStrokeSerial(mutationId, recorded.playFrame ?? 0);
  // The record clock advances by the stroke's own tick span so the next
  // Dry lands after it on the host grid (toStudioStroke: ticks = max(1, pts-1)).
  advanceRecordClock(Math.max(1, recorded.points.length - 1));
  const entry = toStudioStroke(recorded);
  recordedStrokeEntries.set(mutationId, entry);
  payloadTimeline.push(entry);
  bumpAquarelleStrokesRevision();
}

/**
 * quick-261023-l35: seed the whole record state from a decoded snapshot.
 *
 * This is a SESSION SEED, not a capture: the timeline is replaced wholesale
 * (strokes, registry, deletion markers, serials), then every decoded event is
 * rebuilt into the exact live shapes the record path produces — the raw
 * `AquarelleStroke` from its engine payload plus `pts`, and its timeline entry
 * from the SAME `toStudioStroke` projection. The projected entry object is the
 * one pushed onto the timeline, so the `payloadTimeline.indexOf(entry)`
 * invariant used by translate/stack-step survives a restore.
 *
 * The record clock is advanced exactly as the recording session did: by each
 * stroke's tick span, and to every Dry event's absolute tick. Dry sinks are
 * left attached (they are live listeners, not content).
 *
 * Returns the highest restored `mutationId` (0 when none) so the caller can
 * reserve the engine's mutation clock past every restored identity.
 */
export function restoreAquarelleRecordTimeline(
  events: readonly AquarellePayloadEvent[],
): number {
  recordedStrokes.clear();
  recordedStrokeEntries.clear();
  deletedAquarelleStrokeIds.clear();
  aquarelleStrokeSerials.clear();
  aquarelleFrameSerialCounters.clear();
  payloadTimeline.length = 0;
  recordClockTick = 0;

  let maxMutationId = 0;
  for (const event of events) {
    if (isAquarelleDryEvent(event)) {
      payloadTimeline.push(event);
      recordClockTick = Math.max(recordClockTick, Math.max(0, Math.trunc(event.tick)));
      continue;
    }
    const engine = event.engine as AquarelleStrokePayload;
    const stroke: AquarelleStroke = {
      tool: engine.tool,
      color: engine.color,
      params: { ...engine.params },
      brushId: engine.brushId,
      points: event.pts.map((point) => ({
        x: point.x,
        y: point.y,
        p: point.p,
        tx: point.tx,
        ty: point.ty,
        tw: point.tw,
      })),
      toolOverrides: engine.toolOverrides ? { ...engine.toolOverrides } : undefined,
      mutationId: engine.mutationId,
      diffusionFrames: engine.diffusionFrames,
      timestamp: engine.timestamp,
      playFrame: engine.playFrame,
    };
    const entry = toStudioStroke(stroke);
    payloadTimeline.push(entry);
    const mutationId = engine.mutationId;
    if (mutationId !== undefined) {
      recordedStrokes.set(mutationId, stroke.mutationId === mutationId ? stroke : { ...stroke, mutationId });
      recordedStrokeEntries.set(mutationId, entry);
      aquarelleStrokeSerial(mutationId, entry.playFrame ?? 0);
      maxMutationId = Math.max(maxMutationId, mutationId);
    }
    advanceRecordClock(Math.max(1, entry.pts.length - 1));
  }
  bumpAquarelleStrokesRevision();
  return maxMutationId;
}

/**
 * quick-261023-l35: clear the record state to empty (track switch / Studio
 * disposal). The record clock restarts at 0. The revision bumps once, and only
 * when something was actually cleared — a reset on an already-empty store is a
 * no-op (efx-preact-reactivity rule 3). Dry sinks stay attached.
 */
export interface AquarelleRecordRemapResult {
  /** Recorded strokes whose playFrame anchor changed. */
  moved: number;
  /** Recorded strokes whose key disappeared (or whose frame is unowned). */
  dropped: number;
}

/**
 * quick-261024-m20: move the whole watercolor record state onto the next
 * physical key layout by KEY IDENTITY (key-spacing-script-loss). Force-spacing
 * rewrites appFrames but keeps key IDs, so every recorded stroke, its projected
 * timeline entry and its playFrame anchors move with the surviving key.
 *
 * SESSION-ONLY: a key that disappeared drops its entries from this store; the
 * snapshot controller's retained union keeps them in the authoritative file
 * (no purge is called here and no file is written).
 *
 * Objects are REPLACED, never mutated in place: an aquarelle script snapshot
 * holds the live references, so the pre-remap side must stay intact for undo.
 * The same projected-entry object serves both the registry and the timeline
 * (`payloadTimeline.indexOf(entry)` survives). Dry events carry no frame anchor
 * (D-15) and are pushed through verbatim, preserving identity and order.
 *
 * Returns null for a malformed layout (duplicate keyId or appFrame on either
 * side) without mutating anything. A no-op layout mutates nothing and does not
 * bump the revision; an effective remap bumps it exactly once.
 */
export function remapAquarelleScriptsForRecords(
  before: readonly KeyIdentityFrameRecord[],
  after: readonly KeyIdentityFrameRecord[],
): AquarelleRecordRemapResult | null {
  const frameRemap = buildKeyIdentityFrameMap(before, after);
  if (frameRemap === null) return null;

  const nextStrokes = new Map<number, AquarelleStroke>();
  const nextEntries = new Map<number, ReturnType<typeof toStudioStroke>>();
  const droppedIds = new Set<number>();
  let moved = 0;
  let dropped = 0;
  let entryReplaced = 0;

  for (const [mutationId, stroke] of recordedStrokes) {
    const anchor = stroke.playFrame ?? 0;
    const nextFrame = frameRemap.get(anchor);
    if (nextFrame === undefined) {
      dropped += 1;
      droppedIds.add(mutationId);
      continue;
    }
    if (nextFrame !== anchor) {
      moved += 1;
      nextStrokes.set(mutationId, { ...stroke, playFrame: nextFrame });
    } else {
      nextStrokes.set(mutationId, stroke);
    }
    const entry = recordedStrokeEntries.get(mutationId);
    if (!entry) continue;
    if ((entry.playFrame ?? 0) === nextFrame) {
      nextEntries.set(mutationId, entry);
      continue;
    }
    entryReplaced += 1;
    nextEntries.set(mutationId, {
      ...entry,
      playFrame: nextFrame,
      engine: { ...entry.engine, playFrame: nextFrame },
    });
  }

  const nextTimeline: AquarellePayloadEvent[] = [];
  let timelineChanged = false;
  for (const event of payloadTimeline) {
    if (isAquarelleDryEvent(event)) {
      nextTimeline.push(event);
      continue;
    }
    const mutationId = (event.engine as AquarelleStrokePayload).mutationId;
    if (mutationId !== undefined) {
      if (droppedIds.has(mutationId)) {
        timelineChanged = true;
        continue;
      }
      const entry = nextEntries.get(mutationId);
      if (!entry) {
        // An identity with no projected entry cannot stay in lockstep.
        timelineChanged = true;
        continue;
      }
      if (entry !== event) timelineChanged = true;
      nextTimeline.push(entry);
      continue;
    }
    // A timeline-only stroke (no identity) follows its own anchor or leaves.
    const anchor = event.playFrame ?? 0;
    const nextFrame = frameRemap.get(anchor);
    if (nextFrame === undefined) {
      timelineChanged = true;
      continue;
    }
    if (nextFrame === anchor) {
      nextTimeline.push(event);
      continue;
    }
    timelineChanged = true;
    nextTimeline.push({
      ...event,
      playFrame: nextFrame,
      engine: { ...event.engine, playFrame: nextFrame },
    });
  }

  const nextCounters = new Map<number, number>();
  for (const [frame, serial] of aquarelleFrameSerialCounters) {
    const nextFrame = frameRemap.get(frame);
    if (nextFrame === undefined) continue;
    nextCounters.set(nextFrame, serial);
  }
  const countersUnchanged = nextCounters.size === aquarelleFrameSerialCounters.size
    && [...nextCounters].every(
      ([frame, serial]) => aquarelleFrameSerialCounters.get(frame) === serial,
    );
  const timelineUnchanged = !timelineChanged
    && nextTimeline.length === payloadTimeline.length
    && nextTimeline.every((event, index) => event === payloadTimeline[index]);

  if (
    moved === 0
    && dropped === 0
    && entryReplaced === 0
    && timelineUnchanged
    && countersUnchanged
  ) {
    return { moved, dropped };
  }

  recordedStrokes.clear();
  for (const [mutationId, stroke] of nextStrokes) recordedStrokes.set(mutationId, stroke);
  recordedStrokeEntries.clear();
  for (const [mutationId, entry] of nextEntries) recordedStrokeEntries.set(mutationId, entry);
  for (const mutationId of droppedIds) {
    deletedAquarelleStrokeIds.delete(mutationId);
    aquarelleStrokeSerials.delete(mutationId);
  }
  aquarelleFrameSerialCounters.clear();
  for (const [frame, serial] of nextCounters) aquarelleFrameSerialCounters.set(frame, serial);
  payloadTimeline.length = 0;
  for (const event of nextTimeline) payloadTimeline.push(event);
  bumpAquarelleStrokesRevision();
  return { moved, dropped };
}

export function resetAquarelleRecordState(): void {
  const hadContent =
    payloadTimeline.length > 0 ||
    recordedStrokes.size > 0 ||
    recordedStrokeEntries.size > 0 ||
    deletedAquarelleStrokeIds.size > 0 ||
    recordClockTick !== 0;
  recordedStrokes.clear();
  recordedStrokeEntries.clear();
  deletedAquarelleStrokeIds.clear();
  aquarelleStrokeSerials.clear();
  aquarelleFrameSerialCounters.clear();
  payloadTimeline.length = 0;
  recordClockTick = 0;
  if (hadContent) bumpAquarelleStrokesRevision();
}

/**
 * Play-vs-paint fidelity: replace the launch cuisson heuristic with the
 * engine's MEASURED awake window (ticks the live sheet actually diffused
 * after the stroke ended). Replays then cook each stroke for as long as the
 * real paint did instead of stopping at 2.75 s — the under-bloomed look.
 */
export function setAquarelleStrokeDiffusionFrames(
  mutationId: number,
  frames: number,
): void {
  const stroke = recordedStrokes.get(mutationId);
  if (!stroke) return;
  const capped = Math.max(0, Math.min(DIFFUSION_CAP, Math.trunc(frames)));
  stroke.diffusionFrames = capped;
  const entry = recordedStrokeEntries.get(mutationId);
  if (entry) {
    entry.cuisson = capped;
    (entry.engine as AquarelleStrokePayload).diffusionFrames = capped;
  }
}

export function getRecordedAquarelleStroke(
  mutationId: number,
): AquarelleStroke | undefined {
  return recordedStrokes.get(mutationId);
}

/** Params-only view of a recorded stroke (PlayScript fallback seam). */
export function getRecordedAquarellePayload(
  mutationId: number,
): AquarelleStrokePayload | undefined {
  const stroke = recordedStrokes.get(mutationId);
  if (!stroke) return undefined;
  return {
    tool: stroke.tool,
    color: stroke.color,
    params: { ...stroke.params },
    brushId: stroke.brushId,
    toolOverrides: stroke.toolOverrides ? { ...stroke.toolOverrides } : undefined,
    mutationId: stroke.mutationId,
    diffusionFrames: stroke.diffusionFrames,
    timestamp: stroke.timestamp,
    playFrame: stroke.playFrame,
  };
}

export type AquarelleDrySink = (event: AquarelleDryEvent) => void;
const drySinks = new Set<AquarelleDrySink>();

export function onAquarelleDry(sink: AquarelleDrySink): () => void {
  drySinks.add(sink);
  return () => {
    drySinks.delete(sink);
  };
}

/**
 * Studio record clock (DATA-03 / D-15). One monotonic integer host-grid
 * tick cursor for the whole recording session: every recorded stroke
 * advances it by its own tick span, so a Dry lands at the position the
 * user actually pressed it — never a hardcoded 0.
 *
 * This is the "Studio record clock" 56-07 deferred: it owns the Dry
 * `tick`, and `recordedOrder` stays Date.now() for the (tick,
 * recordedOrder) tiebreak until the clock owns that too.
 */
let recordClockTick = 0;

/** Current host-grid tick of the Studio record clock. */
export function aquarelleRecordClock(): number {
  return recordClockTick;
}

/** Advance the record clock by one recorded stroke's tick span. */
function advanceRecordClock(ticks: number): void {
  recordClockTick += Math.max(0, Math.trunc(ticks));
}

/**
 * The ONE payload timeline (D-16): strokes and Dry events interleaved in
 * recording order. Replay walks this list and re-applies every Dry
 * between strokes (AQUA-06) — no second events array, no flag on the
 * next stroke.
 */
const payloadTimeline: AquarellePayloadEvent[] = [];

/** Recorded Dry events on the payload timeline, in recording order. */
export function getRecordedAquarelleDryEvents(): readonly AquarelleDryEvent[] {
  return payloadTimeline.filter(
    (event): event is AquarelleDryEvent => isAquarelleDryEvent(event),
  );
}

/**
 * The whole recorded payload timeline in recording order (D-16 one
 * union) — replay reads this so it can re-apply every Dry between
 * strokes exactly where the user fired it (AQUA-06).
 */
export function getRecordedAquarellePayloadTimeline(): readonly AquarellePayloadEvent[] {
  return payloadTimeline;
}

/**
 * The replay list for ONE edit frame (261022-pim): the frame's recorded
 * strokes in recording order plus every Dry event. Dry is a sheet action
 * with no frame anchor (D-15), so it stays global — the same shape the
 * engine-capture path produced. Deleted strokes are already spliced out of
 * the timeline; the marker is honored too so a stale read can never
 * resurrect one.
 *
 * This is the delete/replay source of truth: the live engine's guide
 * strokes may be gone after an Apply refresh, but the recorded timeline is
 * the script.
 */
export function getAquarelleEventsForFrame(
  playFrame: number,
): readonly AquarellePayloadEvent[] {
  return payloadTimeline.filter((event) => {
    if (isAquarelleDryEvent(event)) return true;
    if (event.playFrame !== playFrame) return false;
    const mutationId = (event.engine as AquarelleStrokePayload).mutationId;
    return mutationId === undefined || !deletedAquarelleStrokeIds.has(mutationId);
  });
}

/**
 * Fire a recorded Dry event (D-15) onto the record path.
 * `tick` is the host-grid tick from the Studio record clock;
 * recordedOrder is the shared ordering key (Date.now() until the
 * Studio record clock owns it too).
 *
 * Both halves of the one event leave here: the sinks reach the live
 * vendor engine (force-dry) and the event is appended to the payload
 * timeline so replay re-applies it (AQUA-06).
 */
export function emitAquarelleDry(tick: number = aquarelleRecordClock()): AquarelleDryEvent {
  const event = createDryEvent(Math.max(0, Math.trunc(tick)), Date.now());
  payloadTimeline.push(event);
  for (const sink of drySinks) sink(event);
  return event;
}
