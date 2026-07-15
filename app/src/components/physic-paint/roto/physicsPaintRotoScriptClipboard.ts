import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import { transformRecordedStrokeForHeldPose } from '@efxlab/efx-physic-paint/animation';
import type { RotoSaveRealKeyTransaction } from './rotoKeyTransactions';
import type { RotoTimelineSelectionKind } from './rotoTimelineSelectors';

export interface RotoScriptSourceSnapshot {
  workflowMode: 'play' | 'roto';
  selectionKind: RotoTimelineSelectionKind;
  sourceFrame: number;
  displayFrame: number;
}

export interface RotoPaintScript {
  sourceFrame: number;
  sourceDisplayFrame: number;
  sourceRevision: number;
  brushes: readonly Readonly<RecordedStrokeGroup>[];
}

export interface RotoScriptActionAvailability {
  canCopy: boolean;
  canApply: boolean;
  copyDisabledReason: string | null;
  applyDisabledReason: string | null;
  busy: boolean;
}

export interface RecordedStrokeGroup {
  primary: Readonly<PaintStroke>;
  continuations?: readonly Readonly<PaintStroke>[];
}

export interface RotoScriptEnginePort {
  getStrokes: () => PaintStroke[];
  enqueueRecordedStroke: (group: Readonly<RecordedStrokeGroup>) => number;
  setInputLocked: (locked: boolean) => void;
}

export interface RotoScriptClipboardControllerPorts {
  getEngine: () => RotoScriptEnginePort | null;
  getSource: () => RotoScriptSourceSnapshot;
  getMotion: () => { deformation: number; position: number };
  prepareEmptyTarget: () => RotoSaveRealKeyTransaction | null;
  setNavigationLocked?: (locked: boolean) => void;
}

export interface RotoScriptClipboardController {
  clipboard: Signal<RotoPaintScript | null>;
  status: Signal<string | null>;
  availability: ReadonlySignal<RotoScriptActionAvailability>;
  copyScript: () => Promise<boolean>;
  applyScript: () => Promise<boolean>;
  observeCompletedMutation: (mutation: CompletedPaintMutation) => void;
  updateSource: (source: RotoScriptSourceSnapshot) => void;
  notifySourceRevision: () => void;
  prepareNavigation: (targetFrame: number) => Promise<boolean>;
  completeNavigation: () => void;
  cancelApply: () => void;
  getAcceptedTarget: (mutationId: number) => RotoSaveRealKeyTransaction | null;
  dispose: () => void;
}

interface ActiveApplyOperation {
  id: number;
  script: RotoPaintScript;
  destinationSourceFrame: number;
  preparedTarget: RotoSaveRealKeyTransaction | null;
  expectedMutationIds: Set<number>;
  consumedMutationIds: Set<number>;
  acceptedTargetByMutationId: Map<number, RotoSaveRealKeyTransaction>;
  completed: number;
  nextBrushIndex: number;
  cancelled: boolean;
  resolve: (success: boolean) => void;
}

const COPY_REASONS = {
  wrongMode: 'Copy Script is available only in Roto mode.',
  generated: 'Generated frames are render-only and cannot be copied as scripts.',
  empty: 'Paint at least one brush on a real Roto key before copying its script.',
  busy: 'Finish the current script operation before copying.',
} as const;

const APPLY_REASONS = {
  wrongMode: 'Apply Script is available only in Roto mode.',
  generated: 'Generated frames are render-only and cannot receive a script.',
  missing: 'Copy a Roto paint script before applying it.',
  busy: 'Finish the current script operation before applying another script.',
} as const;

export function createRotoScriptClipboardController(ports: RotoScriptClipboardControllerPorts): RotoScriptClipboardController {
  const clipboard = signal<RotoPaintScript | null>(null);
  const status = signal<string | null>(null);
  const busy = signal(false);
  const completedMutationIds = new Set<number>();
  const completionWaiters = new Map<number, Set<() => void>>();
  const sourceState = signal<RotoScriptSourceSnapshot>(ports.getSource());
  const acceptedTargets = new Map<number, RotoSaveRealKeyTransaction>();
  let boundSourceFrame: number | null = null;
  let sourceRevision = 0;
  let activeApply: ActiveApplyOperation | null = null;
  let nextOperationId = 1;
  let disposed = false;
  let navigationLockHeld = false;

  const availability = computed<RotoScriptActionAvailability>(() => {
    const source = sourceState.value;
    const engine = ports.getEngine();
    const hasBrushes = Boolean(engine && normalizeLogicalBrushes(engine.getStrokes()).length > 0);
    const copyDisabledReason = busy.value
      ? COPY_REASONS.busy
      : source.workflowMode !== 'roto'
        ? COPY_REASONS.wrongMode
        : source.selectionKind === 'generated-interpolation'
          ? COPY_REASONS.generated
          : source.selectionKind !== 'real-key' || !hasBrushes
            ? COPY_REASONS.empty
            : null;
    const applyDisabledReason = busy.value
      ? APPLY_REASONS.busy
      : source.workflowMode !== 'roto'
        ? APPLY_REASONS.wrongMode
        : source.selectionKind === 'generated-interpolation'
          ? APPLY_REASONS.generated
          : clipboard.value === null
            ? APPLY_REASONS.missing
            : null;
    return {
      canCopy: copyDisabledReason === null,
      canApply: applyDisabledReason === null,
      copyDisabledReason,
      applyDisabledReason,
      busy: busy.value,
    };
  });

  function setInteractionLock(locked: boolean): void {
    ports.getEngine()?.setInputLocked(locked);
    ports.setNavigationLocked?.(locked);
    busy.value = locked;
  }

  function resolveCompletion(mutationId: number): void {
    completedMutationIds.add(mutationId);
    const waiters = completionWaiters.get(mutationId);
    if (!waiters) return;
    completionWaiters.delete(mutationId);
    for (const resolve of waiters) resolve();
  }

  function waitForMutation(mutationId: number): Promise<void> {
    if (completedMutationIds.has(mutationId)) return Promise.resolve();
    return new Promise((resolve) => {
      const waiters = completionWaiters.get(mutationId) ?? new Set<() => void>();
      waiters.add(resolve);
      completionWaiters.set(mutationId, waiters);
    });
  }

  async function drainAcceptedMutations(engine: Pick<RotoScriptEnginePort, 'getStrokes'>): Promise<void> {
    const pendingIds = Array.from(new Set(engine.getStrokes()
      .map((stroke) => stroke.mutationId)
      .filter((mutationId): mutationId is number => Number.isInteger(mutationId))));
    await Promise.all(pendingIds.map(waitForMutation));
  }

  function snapshotBoundSource(engine: Pick<RotoScriptEnginePort, 'getStrokes'>, source: RotoScriptSourceSnapshot): boolean {
    const brushes = normalizeLogicalBrushes(engine.getStrokes());
    if (brushes.length === 0) {
      if (boundSourceFrame === source.sourceFrame) clipboard.value = null;
      return false;
    }
    sourceRevision += 1;
    boundSourceFrame = source.sourceFrame;
    clipboard.value = deepFreezeScript({
      sourceFrame: source.sourceFrame,
      sourceDisplayFrame: source.displayFrame,
      sourceRevision,
      brushes,
    });
    status.value = `Copied ${brushes.length}`;
    return true;
  }

  async function copyScript(): Promise<boolean> {
    if (disposed || !availability.value.canCopy) return false;
    const engine = ports.getEngine();
    if (!engine) return false;
    const source = sourceState.value;
    setInteractionLock(true);
    try {
      await drainAcceptedMutations(engine);
      if (disposed) return false;
      return snapshotBoundSource(engine, source);
    } catch {
      status.value = 'Failed';
      return false;
    } finally {
      if (!disposed) setInteractionLock(false);
    }
  }

  function finishApply(operation: ActiveApplyOperation, success: boolean): void {
    if (activeApply !== operation) return;
    activeApply = null;
    setInteractionLock(false);
    if (!operation.cancelled) status.value = success ? `Applied ${operation.completed}` : 'Failed';
    operation.resolve(success && !operation.cancelled);
  }

  function enqueueNextBrush(operation: ActiveApplyOperation): void {
    if (disposed || activeApply !== operation || operation.cancelled) return;
    if (operation.nextBrushIndex >= operation.script.brushes.length) {
      finishApply(operation, operation.completed === operation.script.brushes.length);
      return;
    }
    const engine = ports.getEngine();
    if (!engine) {
      finishApply(operation, false);
      return;
    }
    const brushIndex = operation.nextBrushIndex;
    const brush = operation.script.brushes[brushIndex];
    const motion = ports.getMotion();
    const transformed: RecordedStrokeGroup = {
      primary: transformRecordedStrokeForHeldPose(brush.primary, {
        destinationSourceFrame: operation.destinationSourceFrame,
        strokeIndex: brushIndex,
        deformation: motion.deformation,
        position: motion.position,
      }),
      continuations: brush.continuations?.map(cloneStroke),
    };
    try {
      const mutationId = engine.enqueueRecordedStroke(transformed);
      operation.nextBrushIndex += 1;
      operation.expectedMutationIds.add(mutationId);
      if (operation.preparedTarget) {
        operation.acceptedTargetByMutationId.set(mutationId, operation.preparedTarget);
        acceptedTargets.set(mutationId, operation.preparedTarget);
      }
    } catch {
      finishApply(operation, false);
    }
  }

  function applyScript(): Promise<boolean> {
    if (disposed || !availability.value.canApply) return Promise.resolve(false);
    const script = clipboard.value;
    const source = sourceState.value;
    if (!script || source.selectionKind === 'generated-interpolation') return Promise.resolve(false);
    const preparedTarget = source.selectionKind === 'empty' ? ports.prepareEmptyTarget() : null;
    const destinationSourceFrame = preparedTarget?.sourceFrameOverride ?? source.sourceFrame;
    setInteractionLock(true);
    status.value = `Applying 0/${script.brushes.length}`;
    return new Promise((resolve) => {
      const operation: ActiveApplyOperation = {
        id: nextOperationId++,
        script,
        destinationSourceFrame,
        preparedTarget,
        expectedMutationIds: new Set(),
        consumedMutationIds: new Set(),
        acceptedTargetByMutationId: new Map(),
        completed: 0,
        nextBrushIndex: 0,
        cancelled: false,
        resolve,
      };
      activeApply = operation;
      enqueueNextBrush(operation);
    });
  }

  function refreshBoundSource(): void {
    if (disposed || activeApply) return;
    const source = sourceState.value;
    const engine = ports.getEngine();
    if (!engine || source.workflowMode !== 'roto' || source.selectionKind !== 'real-key' || source.sourceFrame !== boundSourceFrame) return;
    snapshotBoundSource(engine, source);
  }

  function observeCompletedMutation(mutation: CompletedPaintMutation): void {
    resolveCompletion(mutation.mutationId);
    const operation = activeApply;
    if (operation
      && !operation.cancelled
      && operation.expectedMutationIds.has(mutation.mutationId)
      && !operation.consumedMutationIds.has(mutation.mutationId)) {
      operation.consumedMutationIds.add(mutation.mutationId);
      operation.completed += 1;
      status.value = `Applying ${operation.completed}/${operation.script.brushes.length}`;
      queueMicrotask(() => enqueueNextBrush(operation));
      return;
    }
    refreshBoundSource();
  }

  function updateSource(source: RotoScriptSourceSnapshot): void {
    sourceState.value = source;
  }

  function notifySourceRevision(): void {
    refreshBoundSource();
  }

  async function prepareNavigation(targetFrame: number): Promise<boolean> {
    if (disposed || !Number.isInteger(targetFrame) || targetFrame < 0 || activeApply) return false;
    const source = sourceState.value;
    if (boundSourceFrame === null || source.sourceFrame !== boundSourceFrame || targetFrame === source.displayFrame) return true;
    const engine = ports.getEngine();
    if (!engine) return false;
    navigationLockHeld = true;
    setInteractionLock(true);
    try {
      await drainAcceptedMutations(engine);
      if (disposed) return false;
      snapshotBoundSource(engine, source);
      return true;
    } catch {
      status.value = 'Failed';
      completeNavigation();
      return false;
    }
  }

  function completeNavigation(): void {
    if (!navigationLockHeld) return;
    navigationLockHeld = false;
    if (!disposed && !activeApply) setInteractionLock(false);
  }

  function cancelApply(): void {
    const operation = activeApply;
    if (!operation) return;
    operation.cancelled = true;
    finishApply(operation, false);
  }

  function getAcceptedTarget(mutationId: number): RotoSaveRealKeyTransaction | null {
    const target = acceptedTargets.get(mutationId) ?? null;
    acceptedTargets.delete(mutationId);
    return target;
  }

  function dispose(): void {
    disposed = true;
    const operation = activeApply;
    if (operation) {
      operation.cancelled = true;
      activeApply = null;
      operation.resolve(false);
    }
    clipboard.value = null;
    status.value = null;
    boundSourceFrame = null;
    completionWaiters.clear();
    completedMutationIds.clear();
    acceptedTargets.clear();
    navigationLockHeld = false;
    ports.getEngine()?.setInputLocked(false);
    ports.setNavigationLocked?.(false);
    busy.value = false;
  }

  return {
    clipboard,
    status,
    availability,
    copyScript,
    applyScript,
    observeCompletedMutation,
    updateSource,
    notifySourceRevision,
    prepareNavigation,
    completeNavigation,
    cancelApply,
    getAcceptedTarget,
    dispose,
  };
}

export function normalizeLogicalBrushes(strokes: readonly PaintStroke[]): Readonly<RecordedStrokeGroup>[] {
  const groups: RecordedStrokeGroup[] = [];
  for (const stroke of strokes) {
    if (stroke.points.length > 0) {
      groups.push({ primary: cloneStroke(stroke), continuations: [] });
      continue;
    }
    if (stroke.diffusionFrames !== undefined && groups.length > 0) {
      const current = groups[groups.length - 1];
      current.continuations = [...(current.continuations ?? []), cloneStroke(stroke)];
    }
  }
  return groups.map((group) => ({
    primary: cloneStroke(group.primary),
    continuations: group.continuations?.map(cloneStroke),
  }));
}

function cloneStroke(stroke: Readonly<PaintStroke>): PaintStroke {
  return {
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
    params: { ...stroke.params },
  };
}

function deepFreezeScript(script: RotoPaintScript): RotoPaintScript {
  for (const brush of script.brushes) {
    for (const point of brush.primary.points) Object.freeze(point);
    Object.freeze(brush.primary.points);
    Object.freeze(brush.primary.params);
    Object.freeze(brush.primary);
    for (const continuation of brush.continuations ?? []) {
      Object.freeze(continuation.points);
      Object.freeze(continuation.params);
      Object.freeze(continuation);
    }
    if (brush.continuations) Object.freeze(brush.continuations);
    Object.freeze(brush);
  }
  Object.freeze(script.brushes);
  return Object.freeze(script);
}
