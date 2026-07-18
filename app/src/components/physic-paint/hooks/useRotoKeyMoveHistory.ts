import { useCallback, useEffect, useRef } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import type { CompletedPaintMutation, PaintHistoryAvailability, SerializedProject } from '@efxlab/efx-physic-paint';
import type { PhysicPaintRotoCacheFrame, PhysicPaintRotoInterpolationSettings } from '../../../types/physicPaint';
import type { RenderedFramePayload } from '../roto/rotoCanvasFrames';

export interface RotoKeyMoveHistoryIdentity {
  launchOperationId: string;
  layerId: string;
}

export interface RotoKeyMoveSnapshot<TEditable = SerializedProject> {
  identity: RotoKeyMoveHistoryIdentity;
  realKeyFrames: PhysicPaintRotoCacheFrame[];
  cachedRotoFrames: PhysicPaintRotoCacheFrame[];
  interpolationSettings: PhysicPaintRotoInterpolationSettings;
  frameStates: Map<number, TEditable>;
  previewFrames: Map<number, RenderedFramePayload>;
  capturedFrames: Map<number, RenderedFramePayload>;
  dirtyFrames: Set<number>;
  liveOverlayActionCounts: Map<number, number>;
  editableFrames: number[];
  selectedSourceFrame: number;
  selectedDisplayFrame: number;
  engineState: SerializedProject | null;
  cachedReferenceUrl: string | null;
  cachedRepaintBaseFrame: RenderedFramePayload | null;
}

interface RotoKeyMoveCommand<TEditable> {
  kind: 'move';
  before: RotoKeyMoveSnapshot<TEditable>;
  after: RotoKeyMoveSnapshot<TEditable>;
}

interface PaintBarrier {
  kind: 'paint';
  mutationId: number;
}

type RotoHistoryEntry<TEditable> = RotoKeyMoveCommand<TEditable> | PaintBarrier;

export function useRotoKeyMoveHistory<TEditable>(input: {
  identity: RotoKeyMoveHistoryIdentity | null;
  availability: Signal<PaintHistoryAvailability>;
  replaySnapshot: (snapshot: RotoKeyMoveSnapshot<TEditable>, label: string) => Promise<boolean>;
  undoPaint: () => boolean;
  redoPaint: () => boolean;
}) {
  const appliedRef = useRef<RotoHistoryEntry<TEditable>[]>([]);
  const redoRef = useRef<RotoHistoryEntry<TEditable>[]>([]);
  const paintAvailabilityRef = useRef<PaintHistoryAvailability>({ undo: 0, redo: 0 });
  const busyRef = useRef(false);
  const inputRef = useRef(input);
  inputRef.current = input;

  const publishAvailability = useCallback(() => {
    inputRef.current.availability.value = {
      undo: appliedRef.current.length,
      redo: redoRef.current.length,
    };
  }, []);

  const reconcilePaintBarriers = useCallback((availability: PaintHistoryAvailability) => {
    paintAvailabilityRef.current = availability;
    const trimOldestPaint = (entries: RotoHistoryEntry<TEditable>[], maximum: number) => {
      let paintCount = entries.filter((entry) => entry.kind === 'paint').length;
      if (paintCount <= maximum) return entries;
      return entries.filter((entry) => {
        if (entry.kind !== 'paint' || paintCount <= maximum) return true;
        paintCount -= 1;
        return false;
      });
    };
    appliedRef.current = trimOldestPaint(appliedRef.current, Math.min(10, availability.undo));
    redoRef.current = trimOldestPaint(redoRef.current, Math.min(10, availability.redo));
    publishAvailability();
  }, [publishAvailability]);

  const observePaintMutation = useCallback((mutationId: number, kind: CompletedPaintMutation['kind']) => {
    if (!Number.isInteger(mutationId) || mutationId < 0 || kind === 'undo' || kind === 'redo' || kind === 'clear') return;
    if (appliedRef.current.some((entry) => entry.kind === 'paint' && entry.mutationId === mutationId)) return;
    appliedRef.current.push({ kind: 'paint', mutationId });
    let paintCount = appliedRef.current.filter((entry) => entry.kind === 'paint').length;
    const maximum = Math.min(10, paintAvailabilityRef.current.undo);
    if (paintCount > maximum) {
      appliedRef.current = appliedRef.current.filter((entry) => {
        if (entry.kind !== 'paint' || paintCount <= maximum) return true;
        paintCount -= 1;
        return false;
      });
    }
    redoRef.current = [];
    publishAvailability();
  }, [publishAvailability]);

  const recordAcceptedMove = useCallback((before: RotoKeyMoveSnapshot<TEditable>, after: RotoKeyMoveSnapshot<TEditable>) => {
    appliedRef.current.push({ kind: 'move', before, after });
    redoRef.current = [];
    publishAvailability();
  }, [publishAvailability]);

  const undo = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    const entry = appliedRef.current[appliedRef.current.length - 1];
    if (!entry) return false;
    if (entry.kind === 'paint') {
      appliedRef.current.pop();
      redoRef.current.push(entry);
      const changed = inputRef.current.undoPaint();
      if (!changed) {
        redoRef.current.pop();
        appliedRef.current.push(entry);
        publishAvailability();
        return false;
      }
      publishAvailability();
      return true;
    }
    busyRef.current = true;
    try {
      if (!await inputRef.current.replaySnapshot(entry.before, `Moved key ${entry.after.selectedDisplayFrame} back to frame ${entry.before.selectedDisplayFrame}.`)) return false;
      appliedRef.current.pop();
      redoRef.current.push(entry);
      publishAvailability();
      return true;
    } finally {
      busyRef.current = false;
    }
  }, [publishAvailability]);

  const redo = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    const entry = redoRef.current[redoRef.current.length - 1];
    if (!entry) return false;
    if (entry.kind === 'paint') {
      redoRef.current.pop();
      appliedRef.current.push(entry);
      const changed = inputRef.current.redoPaint();
      if (!changed) {
        appliedRef.current.pop();
        redoRef.current.push(entry);
        publishAvailability();
        return false;
      }
      publishAvailability();
      return true;
    }
    busyRef.current = true;
    try {
      if (!await inputRef.current.replaySnapshot(entry.after, `Moved key ${entry.before.selectedDisplayFrame} to frame ${entry.after.selectedDisplayFrame}.`)) return false;
      redoRef.current.pop();
      appliedRef.current.push(entry);
      publishAvailability();
      return true;
    } finally {
      busyRef.current = false;
    }
  }, [publishAvailability]);

  useEffect(() => {
    appliedRef.current = [];
    redoRef.current = [];
    paintAvailabilityRef.current = { undo: 0, redo: 0 };
    busyRef.current = false;
    publishAvailability();
  }, [input.identity?.launchOperationId, input.identity?.layerId, publishAvailability]);

  return {
    busyRef,
    observePaintMutation,
    recordAcceptedMove,
    reconcilePaintBarriers,
    undo,
    redo,
  };
}
