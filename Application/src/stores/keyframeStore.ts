import {signal, computed, effect} from '@preact/signals';
import type {Keyframe, KeyframeValues, EasingType} from '../types/layer';
import {extractKeyframeValues} from '../types/layer';
import {interpolateAt} from '../lib/keyframeEngine';
import {layerStore} from './layerStore';
import {timelineStore} from './timelineStore';
import {sequenceStore} from './sequenceStore';
import {trackLayouts} from '../lib/frameMap';

// --- Signals ---

/** Frames of selected keyframe diamonds (sequence-local offsets) */
const selectedKeyframeFrames = signal<Set<number>>(new Set());

/** Transient property overrides for edits between keyframes.
 *  When the playhead is NOT on a keyframe frame and the user edits a property,
 *  the edit writes here instead of layerStore. Cleared on frame change. */
const transientOverrides = signal<KeyframeValues | null>(null);

// --- Helpers ---

/** Find the sequence that owns a layer by ID, and its start frame */
function findLayerContext(layerId: string): { sequenceId: string; startFrame: number } | null {
  const seqs = sequenceStore.sequences.peek();
  const layouts = trackLayouts.peek();
  for (const seq of seqs) {
    if (seq.layers.some(l => l.id === layerId)) {
      if (seq.kind === 'fx' || seq.kind === 'content-overlay') {
        // FX and content overlay: startFrame is inFrame (global timeline position)
        return { sequenceId: seq.id, startFrame: seq.inFrame ?? 0 };
      }
      // Content sequence: use trackLayouts for start frame
      const layout = layouts.find(t => t.sequenceId === seq.id);
      return { sequenceId: seq.id, startFrame: layout?.startFrame ?? 0 };
    }
  }
  return null;
}

/** Get the selected animatable layer (null if none or base) */
function getSelectedAnimatableLayer() {
  const layerId = layerStore.selectedLayerId.value;
  if (!layerId) return null;
  const seqs = sequenceStore.sequences.value;
  for (const seq of seqs) {
    const layer = seq.layers.find(l => l.id === layerId);
    if (layer && !layer.isBase) return { layer, sequenceId: seq.id };
  }
  return null;
}

/** Compute the sequence-local frame for the selected layer at the current global frame */
function getLocalFrame(): number {
  const layerId = layerStore.selectedLayerId.value;
  if (!layerId) return 0;
  const ctx = findLayerContext(layerId);
  if (!ctx) return 0;
  return timelineStore.displayFrame.value - ctx.startFrame;
}

// --- Computed signals ---

/** Keyframes array for the currently selected animatable layer (empty if none/base) */
const activeLayerKeyframes = computed<Keyframe[]>(() => {
  const info = getSelectedAnimatableLayer();
  if (!info) return [];
  return info.layer.keyframes ?? [];
});

/** Interpolated values at the current playhead position for the selected layer */
const interpolatedValues = computed<KeyframeValues | null>(() => {
  const kfs = activeLayerKeyframes.value;
  if (kfs.length === 0) return null;
  const localFrame = getLocalFrame();
  return interpolateAt(kfs, localFrame);
});

/** True when the current frame exactly matches a keyframe frame for the selected layer */
const isOnKeyframe = computed<boolean>(() => {
  const kfs = activeLayerKeyframes.value;
  if (kfs.length === 0) return false;
  const localFrame = getLocalFrame();
  return kfs.some(k => k.frame === localFrame);
});

/** Display values: transientOverrides if non-null, otherwise interpolatedValues.
 *  This is what PropertiesPanel reads to show the current values. */
const displayValues = computed<KeyframeValues | null>(() => {
  const overrides = transientOverrides.value;
  if (overrides) return overrides;
  return interpolatedValues.value;
});

// --- Frame-change side effect: clear transient overrides when frame changes ---

let _lastFrame = timelineStore.displayFrame.peek();
effect(() => {
  const frame = timelineStore.displayFrame.value;
  if (frame !== _lastFrame) {
    _lastFrame = frame;
    transientOverrides.value = null;
  }
});

// --- Store ---

export const keyframeStore = {
  // Signals
  selectedKeyframeFrames,
  transientOverrides,

  // Computed
  activeLayerKeyframes,
  interpolatedValues,
  isOnKeyframe,
  displayValues,

  // --- CRUD Methods ---

  /** Add a keyframe at the given global frame for the given layer.
   *  Uses transientOverrides if non-null, otherwise extracts current layer values. */
  addKeyframe(layerId: string, globalFrame: number) {
    const ctx = findLayerContext(layerId);
    if (!ctx) return;

    const localFrame = globalFrame - ctx.startFrame;

    // Get snapshot values
    const seqs = sequenceStore.sequences.peek();
    const seq = seqs.find(s => s.id === ctx.sequenceId);
    const layer = seq?.layers.find(l => l.id === layerId);
    if (!layer) return;

    let values: KeyframeValues;
    const overrides = transientOverrides.peek();
    if (overrides) {
      values = { ...overrides };
    } else {
      values = extractKeyframeValues(layer);
    }

    const newKf: Keyframe = {
      frame: localFrame,
      easing: 'ease-in-out',
      values,
    };

    // Upsert: update if frame exists, insert sorted if new
    const existing = (layer.keyframes ?? []).slice();
    const idx = existing.findIndex(k => k.frame === localFrame);
    if (idx >= 0) {
      existing[idx] = newKf;
    } else {
      existing.push(newKf);
      existing.sort((a, b) => a.frame - b.frame);
    }

    layerStore.updateLayer(layerId, { keyframes: existing });

    // Clear transient overrides after committing
    transientOverrides.value = null;
  },

  /** Remove keyframes at given frame offsets from a layer */
  removeKeyframes(layerId: string, frames: number[]) {
    const seqs = sequenceStore.sequences.peek();
    let layer: import('../types/layer').Layer | undefined;
    for (const seq of seqs) {
      layer = seq.layers.find(l => l.id === layerId);
      if (layer) break;
    }
    if (!layer) return;

    const frameSet = new Set(frames);
    const filtered = (layer.keyframes ?? []).filter(k => !frameSet.has(k.frame));
    layerStore.updateLayer(layerId, { keyframes: filtered });
  },

  /** Move a keyframe from one frame offset to another.
   *  Prevents moving to a frame that already has a keyframe. */
  moveKeyframe(layerId: string, fromFrame: number, toFrame: number) {
    const seqs = sequenceStore.sequences.peek();
    let layer: import('../types/layer').Layer | undefined;
    for (const seq of seqs) {
      layer = seq.layers.find(l => l.id === layerId);
      if (layer) break;
    }
    if (!layer) return;

    const keyframes = (layer.keyframes ?? []).slice();
    // Prevent moving to an occupied frame
    if (keyframes.some(k => k.frame === toFrame)) return;

    const idx = keyframes.findIndex(k => k.frame === fromFrame);
    if (idx < 0) return;

    keyframes[idx] = { ...keyframes[idx], frame: toFrame };
    keyframes.sort((a, b) => a.frame - b.frame);
    layerStore.updateLayer(layerId, { keyframes });
  },

  /** Update the easing type on a specific keyframe */
  setEasing(layerId: string, frame: number, easing: EasingType) {
    const seqs = sequenceStore.sequences.peek();
    let layer: import('../types/layer').Layer | undefined;
    for (const seq of seqs) {
      layer = seq.layers.find(l => l.id === layerId);
      if (layer) break;
    }
    if (!layer) return;

    const keyframes = (layer.keyframes ?? []).map(k =>
      k.frame === frame ? { ...k, easing } : k,
    );
    layerStore.updateLayer(layerId, { keyframes });
  },

  // --- Selection ---

  /** Clear keyframe selection */
  clearSelection() {
    selectedKeyframeFrames.value = new Set();
  },

  /** Select a keyframe by frame. If additive (shift-click), toggle in set; otherwise replace. */
  selectKeyframe(frame: number, additive: boolean) {
    if (additive) {
      const next = new Set(selectedKeyframeFrames.peek());
      if (next.has(frame)) {
        next.delete(frame);
      } else {
        next.add(frame);
      }
      selectedKeyframeFrames.value = next;
    } else {
      selectedKeyframeFrames.value = new Set([frame]);
    }
  },

  // --- Transient Overrides ---

  /** Update a single field in transientOverrides.
   *  If transientOverrides is null, initializes from interpolatedValues first. */
  setTransientValue(field: Exclude<keyof KeyframeValues, 'sourceOverrides'>, value: number) {
    let current = transientOverrides.peek();
    if (!current) {
      const interp = interpolatedValues.peek();
      if (!interp) return; // No keyframes -> nothing to override
      current = { ...interp };
    } else {
      current = { ...current };
    }
    current[field] = value;
    transientOverrides.value = current;
  },

  /** Update a single FX source field in transientOverrides.sourceOverrides.
   *  If transientOverrides is null, initializes from interpolatedValues first. */
  setTransientSourceValue(field: string, value: number) {
    let current = transientOverrides.peek();
    if (!current) {
      const interp = interpolatedValues.peek();
      if (!interp) return; // No keyframes -> nothing to override
      current = { ...interp, sourceOverrides: { ...(interp.sourceOverrides ?? {}) } };
    } else {
      current = { ...current, sourceOverrides: { ...(current.sourceOverrides ?? {}) } };
    }
    current.sourceOverrides![field] = value;
    transientOverrides.value = current;
  },

  /** Clear transient overrides */
  clearTransientOverrides() {
    transientOverrides.value = null;
  },
};
