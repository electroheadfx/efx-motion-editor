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
  createDryEvent,
  type AquarelleDryEvent,
  type AquarelleStrokePayload,
  type AquarelleTool,
} from '@efxlab/efx-watercolor/payload';
import {
  NEUTRAL_TOOL_OVERRIDES,
  findTip,
  toolOverridesFromTip,
  type AquarelleToolOverrides,
} from '@efxlab/efx-watercolor/brushes';

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
export const aquarelleSelectedTipId = signal<string | null>(null);
export const aquarelleToolOverrides = signal<AquarelleToolOverrides>({
  ...NEUTRAL_TOOL_OVERRIDES,
});

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
 */
export function selectAquarelleTip(tipId: string | null): void {
  const tip = tipId ? findTip(tipId) : undefined;
  const nextId = tip ? tip.id : null;
  if (aquarelleSelectedTipId.value === nextId) return;
  aquarelleSelectedTipId.value = nextId;
  aquarelleToolOverrides.value = tip
    ? toolOverridesFromTip(tip)
    : { ...NEUTRAL_TOOL_OVERRIDES };
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

export type AquarelleDrySink = (event: AquarelleDryEvent) => void;
const drySinks = new Set<AquarelleDrySink>();

export function onAquarelleDry(sink: AquarelleDrySink): () => void {
  drySinks.add(sink);
  return () => {
    drySinks.delete(sink);
  };
}

/**
 * Fire a recorded Dry event (D-15) onto the record path.
 * `tick` is the host-grid tick; recordedOrder is the shared
 * ordering key (Date.now() until the Studio record clock owns it).
 */
export function emitAquarelleDry(tick: number): AquarelleDryEvent {
  const event = createDryEvent(Math.max(0, Math.trunc(tick)), Date.now());
  for (const sink of drySinks) sink(event);
  return event;
}
