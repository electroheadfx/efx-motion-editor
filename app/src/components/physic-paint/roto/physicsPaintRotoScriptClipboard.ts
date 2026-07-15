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
  onFirstAcceptedBrush?: () => void;
  setNavigationLocked?: (locked: boolean) => void;
}

export interface RotoScriptAcceptedTarget {
  sourceFrame: number;
  displayFrame: number;
  interpolationSettings?: RotoSaveRealKeyTransaction['interpolationSettings'];
}

export interface RotoScriptClipboardController {
  clipboard: Signal<RotoPaintScript | null>;
  status: Signal<string | null>;
  availability: ReadonlySignal<RotoScriptActionAvailability>;
  copyScript: () => Promise<boolean>;
  applyScript: () => Promise<boolean>;
  observeCompletedMutation: (mutation: CompletedPaintMutation) => void;
  updateEngine: (engine: RotoScriptEnginePort | null) => void;
  updateSource: (source: RotoScriptSourceSnapshot) => void;
  notifySourceRevision: () => void;
  prepareNavigation: (targetFrame: number) => Promise<boolean>;
  completeNavigation: () => void;
  cancelApply: () => void;
  getAcceptedTarget: (mutationId: number) => RotoScriptAcceptedTarget | null;
  resetForLaunch: () => void;
  dispose: () => void;
}

interface ActiveApplyOperation {
  id: number;
  script: RotoPaintScript;
  destinationSourceFrame: number;
  preparedTarget: RotoSaveRealKeyTransaction | null;
  expectedMutationIds: Set<number>;
  consumedMutationIds: Set<number>;
  completed: number;
  nextBrushIndex: number;
  cancelled: boolean;
  resolve: (success: boolean) => void;
}

interface CompletionWaiter {
  generation: number;
  settle: (completed: boolean) => void;
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
  const sourceContentRevision = signal(0);
  const completedMutationIds = new Set<number>();
  const completionWaiters = new Map<number, Set<CompletionWaiter>>();
  const sourceState = signal<RotoScriptSourceSnapshot>(ports.getSource());
  const engineState = signal<RotoScriptEnginePort | null>(ports.getEngine());
  const acceptedTargets = new Map<number, RotoScriptAcceptedTarget>();
  let boundSourceFrame: number | null = null;
  let sourceRevision = 0;
  let operationGeneration = 0;
  let activeApply: ActiveApplyOperation | null = null;
  let nextOperationId = 1;
  let disposed = false;
  let navigationLockHeld = false;

  const availability = computed<RotoScriptActionAvailability>(() => {
    const source = sourceState.value;
    const engine = engineState.value;
    sourceContentRevision.value;
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
    engineState.peek()?.setInputLocked(locked);
    ports.setNavigationLocked?.(locked);
    busy.value = locked;
  }

  function bumpSourceContentRevision(): void {
    sourceContentRevision.value += 1;
  }

  function resolveCompletion(mutationId: number): void {
    completedMutationIds.add(mutationId);
    const waiters = completionWaiters.get(mutationId);
    if (!waiters) return;
    completionWaiters.delete(mutationId);
    for (const waiter of waiters) waiter.settle(waiter.generation === operationGeneration);
  }

  function settleCompletionWaiters(): void {
    operationGeneration += 1;
    for (const waiters of completionWaiters.values()) {
      for (const waiter of waiters) waiter.settle(false);
    }
    completionWaiters.clear();
  }

  function waitForMutation(mutationId: number, generation: number): Promise<boolean> {
    if (generation !== operationGeneration) return Promise.resolve(false);
    if (completedMutationIds.has(mutationId)) return Promise.resolve(true);
    return new Promise((settle) => {
      const waiters = completionWaiters.get(mutationId) ?? new Set<CompletionWaiter>();
      waiters.add({ generation, settle });
      completionWaiters.set(mutationId, waiters);
    });
  }

  async function drainAcceptedMutations(engine: Pick<RotoScriptEnginePort, 'getStrokes'>): Promise<boolean> {
    const generation = operationGeneration;
    const pendingIds = Array.from(new Set(engine.getStrokes()
      .map((stroke) => stroke.mutationId)
      .filter((mutationId): mutationId is number => Number.isInteger(mutationId))));
    const results = await Promise.all(pendingIds.map((mutationId) => waitForMutation(mutationId, generation)));
    return generation === operationGeneration && results.every(Boolean);
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
    const engine = engineState.peek();
    if (!engine) return false;
    const source = sourceState.value;
    setInteractionLock(true);
    try {
      if (!await drainAcceptedMutations(engine) || disposed) return false;
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
    const applied = success && !operation.cancelled;
    status.value = applied ? `Applied ${operation.completed}` : 'Failed';
    if (operation.completed > 0) refreshBoundSource();
    operation.resolve(applied);
  }

  function enqueueNextBrush(operation: ActiveApplyOperation): void {
    if (disposed || activeApply !== operation) return;
    if (operation.cancelled) {
      if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
      return;
    }
    if (operation.nextBrushIndex >= operation.script.brushes.length) {
      finishApply(operation, operation.completed === operation.script.brushes.length);
      return;
    }
    const engine = engineState.peek();
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
      if (operation.nextBrushIndex === 0) ports.onFirstAcceptedBrush?.();
      operation.nextBrushIndex += 1;
      operation.expectedMutationIds.add(mutationId);
      acceptedTargets.set(mutationId, {
        sourceFrame: operation.destinationSourceFrame,
        displayFrame: operation.preparedTarget?.target.displayFrame ?? sourceState.peek().displayFrame,
        interpolationSettings: operation.preparedTarget?.interpolationSettings,
      });
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
    if (source.selectionKind === 'empty' && !preparedTarget) {
      status.value = 'Failed';
      return Promise.resolve(false);
    }
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
    const engine = engineState.peek();
    if (!engine || source.workflowMode !== 'roto' || source.selectionKind !== 'real-key' || source.sourceFrame !== boundSourceFrame) return;
    snapshotBoundSource(engine, source);
  }

  function observeCompletedMutation(mutation: CompletedPaintMutation): void {
    resolveCompletion(mutation.mutationId);
    bumpSourceContentRevision();
    const operation = activeApply;
    if (operation
      && operation.expectedMutationIds.has(mutation.mutationId)
      && !operation.consumedMutationIds.has(mutation.mutationId)) {
      operation.consumedMutationIds.add(mutation.mutationId);
      operation.completed += 1;
      if (!operation.cancelled) status.value = `Applying ${operation.completed}/${operation.script.brushes.length}`;
      queueMicrotask(() => enqueueNextBrush(operation));
      return;
    }
    refreshBoundSource();
  }

  function updateEngine(engine: RotoScriptEnginePort | null): void {
    const previousEngine = engineState.peek();
    if (previousEngine === engine) return;
    previousEngine?.setInputLocked(false);
    engineState.value = engine;
    bumpSourceContentRevision();
    if (!engine) {
      settleCompletionWaiters();
      if (activeApply) {
        activeApply.cancelled = true;
        finishApply(activeApply, false);
      } else if (busy.peek()) {
        navigationLockHeld = false;
        ports.setNavigationLocked?.(false);
        busy.value = false;
      }
    }
  }

  function updateSource(source: RotoScriptSourceSnapshot): void {
    const current = sourceState.peek();
    if (current.workflowMode === source.workflowMode
      && current.selectionKind === source.selectionKind
      && current.sourceFrame === source.sourceFrame
      && current.displayFrame === source.displayFrame) return;
    sourceState.value = source;
  }

  function notifySourceRevision(): void {
    bumpSourceContentRevision();
    refreshBoundSource();
  }

  async function prepareNavigation(targetFrame: number): Promise<boolean> {
    if (disposed || !Number.isInteger(targetFrame) || targetFrame < 0 || activeApply || busy.peek()) return false;
    const source = sourceState.value;
    if (boundSourceFrame === null || source.sourceFrame !== boundSourceFrame || targetFrame === source.displayFrame) return true;
    const engine = engineState.peek();
    if (!engine) return false;
    navigationLockHeld = true;
    setInteractionLock(true);
    try {
      if (!await drainAcceptedMutations(engine) || disposed) return false;
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
    if (!operation || operation.cancelled) return;
    operation.cancelled = true;
    if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
  }

  function getAcceptedTarget(mutationId: number): RotoScriptAcceptedTarget | null {
    const target = acceptedTargets.get(mutationId) ?? null;
    acceptedTargets.delete(mutationId);
    return target;
  }

  function resetForLaunch(): void {
    settleCompletionWaiters();
    const operation = activeApply;
    if (operation) {
      operation.cancelled = true;
      activeApply = null;
      operation.resolve(false);
    }
    clipboard.value = null;
    status.value = null;
    boundSourceFrame = null;
    sourceRevision = 0;
    completedMutationIds.clear();
    acceptedTargets.clear();
    navigationLockHeld = false;
    engineState.peek()?.setInputLocked(false);
    ports.setNavigationLocked?.(false);
    busy.value = false;
    bumpSourceContentRevision();
  }

  function dispose(): void {
    resetForLaunch();
    disposed = true;
  }

  return {
    clipboard,
    status,
    availability,
    copyScript,
    applyScript,
    observeCompletedMutation,
    updateEngine,
    updateSource,
    notifySourceRevision,
    prepareNavigation,
    completeNavigation,
    cancelApply,
    getAcceptedTarget,
    resetForLaunch,
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
