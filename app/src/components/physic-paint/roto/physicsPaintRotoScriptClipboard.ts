import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import { transformRecordedStrokeForHeldPose } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import type { RotoSaveRealKeyTransaction } from './rotoKeyTransactions';
import type { RotoTimelineSelectionKind } from './rotoTimelineSelectors';

export interface RotoScriptSourceSnapshot {
  workflowMode: 'play' | 'roto';
  selectionKind: RotoTimelineSelectionKind;
  sourceFrame: number;
  displayFrame: number;
}

export interface RotoScriptPublicationIdentity {
  operationId: string;
  layerId: string;
  cachedBase: (PhysicPaintRenderedFrame & { sourceFrame?: number }) | null;
  background: PhysicPaintRotoBackgroundMetadata;
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
  getPublicationIdentity?: () => RotoScriptPublicationIdentity | null;
  prepareEmptyTarget: () => RotoSaveRealKeyTransaction | null;
  onFirstAcceptedBrush?: () => void;
  setNavigationLocked?: (locked: boolean) => void;
}

export interface RotoScriptAcceptedTarget {
  sourceFrame: number;
  displayFrame: number;
  interpolationSettings?: RotoSaveRealKeyTransaction['interpolationSettings'];
  publicationIdentity?: RotoScriptPublicationIdentity;
}

export interface RotoScriptClipboardController {
  clipboard: Signal<RotoPaintScript | null>;
  status: Signal<string | null>;
  availability: ReadonlySignal<RotoScriptActionAvailability>;
  mutationLocked: ReadonlySignal<boolean>;
  copyScript: () => Promise<boolean>;
  applyScript: () => Promise<boolean>;
  observeCompletedMutation: (engine: RotoScriptEnginePort, mutation: CompletedPaintMutation) => void;
  updateEngine: (engine: RotoScriptEnginePort | null) => void;
  updateSource: (source: RotoScriptSourceSnapshot) => void;
  notifySourceRevision: () => void;
  prepareNavigation: (targetFrame: number) => Promise<boolean>;
  completeNavigation: () => void;
  cancelApply: () => void;
  getAcceptedTarget: (engine: RotoScriptEnginePort, mutationId: number) => RotoScriptAcceptedTarget | null;
  prepareLaunchReplacement: () => Promise<void>;
  completeLaunchReplacement: () => void;
  prepareEngineDisposal: (engine: RotoScriptEnginePort) => Promise<void>;
  dispose: () => Promise<void>;
}

interface ActiveApplyOperation {
  id: number;
  engine: RotoScriptEnginePort;
  launchGeneration: number;
  script: RotoPaintScript;
  destinationSourceFrame: number;
  destinationDisplayFrame: number;
  publicationIdentity: RotoScriptPublicationIdentity | null;
  preparedTarget: RotoSaveRealKeyTransaction | null;
  expectedMutationIds: Set<number>;
  consumedMutationIds: Set<number>;
  completed: number;
  nextBrushIndex: number;
  cancelled: boolean;
  publishUi: boolean;
  resolve: (success: boolean) => void;
}

interface CompletionWaiter {
  settle: () => void;
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
  const mutationLocked = signal(false);
  const sourceContentRevision = signal(0);
  const completedMutationIds = new WeakMap<RotoScriptEnginePort, Set<number>>();
  const completionWaiters = new WeakMap<RotoScriptEnginePort, Map<number, Set<CompletionWaiter>>>();
  const sourceState = signal<RotoScriptSourceSnapshot>(ports.getSource());
  const engineState = signal<RotoScriptEnginePort | null>(ports.getEngine());
  const acceptedTargets = new WeakMap<RotoScriptEnginePort, Map<number, RotoScriptAcceptedTarget>>();
  const lockedEngines = new Set<RotoScriptEnginePort>();
  let boundSourceFrame: number | null = null;
  let sourceRevision = 0;
  let engineGeneration = 0;
  let launchGeneration = 0;
  let activeApply: ActiveApplyOperation | null = null;
  let disposed = false;
  let disposalRequested = false;
  let navigationLockHeld = false;
  let pendingOperationCount = 0;
  let resolveDisposal: (() => void) | null = null;
  let disposalPromise: Promise<void> | null = null;

  const availability = computed<RotoScriptActionAvailability>(() => {
    const source = sourceState.value;
    const engine = engineState.value;
    sourceContentRevision.value;
    const hasBrushes = Boolean(engine && normalizeLogicalBrushes(engine.getStrokes()).length > 0);
    const unavailable = disposalRequested || busy.value;
    const copyDisabledReason = unavailable
      ? COPY_REASONS.busy
      : source.workflowMode !== 'roto'
        ? COPY_REASONS.wrongMode
        : source.selectionKind === 'generated-interpolation'
          ? COPY_REASONS.generated
          : source.selectionKind !== 'real-key' || !hasBrushes
            ? COPY_REASONS.empty
            : null;
    const applyDisabledReason = unavailable
      ? APPLY_REASONS.busy
      : source.workflowMode !== 'roto'
        ? APPLY_REASONS.wrongMode
        : source.selectionKind === 'generated-interpolation'
          ? APPLY_REASONS.generated
          : clipboard.value === null
            ? APPLY_REASONS.missing
            : null;
    return { canCopy: copyDisabledReason === null, canApply: applyDisabledReason === null, copyDisabledReason, applyDisabledReason, busy: busy.value };
  });

  function bumpSourceContentRevision(): void {
    sourceContentRevision.value += 1;
  }

  function beginOperation(engine: RotoScriptEnginePort): void {
    pendingOperationCount += 1;
    mutationLocked.value = true;
    lockedEngines.add(engine);
    engine.setInputLocked(true);
    const currentEngine = engineState.peek();
    if (currentEngine && currentEngine !== engine) {
      lockedEngines.add(currentEngine);
      currentEngine.setInputLocked(true);
    }
    ports.setNavigationLocked?.(true);
    busy.value = true;
  }

  function endOperation(engine: RotoScriptEnginePort): void {
    pendingOperationCount = Math.max(0, pendingOperationCount - 1);
    lockedEngines.delete(engine);
    engine.setInputLocked(false);
    if (pendingOperationCount === 0 && !navigationLockHeld) {
      for (const lockedEngine of lockedEngines) lockedEngine.setInputLocked(false);
      lockedEngines.clear();
      ports.setNavigationLocked?.(false);
      mutationLocked.value = false;
      busy.value = false;
      finalizeDisposalIfReady();
    }
  }

  function finalizeDisposalIfReady(): void {
    if (!disposalRequested || pendingOperationCount > 0 || activeApply) return;
    disposed = true;
    clipboard.value = null;
    status.value = null;
    boundSourceFrame = null;
    sourceRevision = 0;
    resolveDisposal?.();
    resolveDisposal = null;
  }

  function completedIdsFor(engine: RotoScriptEnginePort): Set<number> {
    let ids = completedMutationIds.get(engine);
    if (!ids) {
      ids = new Set<number>();
      completedMutationIds.set(engine, ids);
    }
    return ids;
  }

  function waiterMapFor(engine: RotoScriptEnginePort): Map<number, Set<CompletionWaiter>> {
    let waiters = completionWaiters.get(engine);
    if (!waiters) {
      waiters = new Map<number, Set<CompletionWaiter>>();
      completionWaiters.set(engine, waiters);
    }
    return waiters;
  }

  function resolveCompletion(engine: RotoScriptEnginePort, mutationId: number): void {
    completedIdsFor(engine).add(mutationId);
    const engineWaiters = completionWaiters.get(engine);
    const waiters = engineWaiters?.get(mutationId);
    if (!waiters) return;
    engineWaiters?.delete(mutationId);
    for (const waiter of waiters) waiter.settle();
  }

  function waitForMutation(engine: RotoScriptEnginePort, mutationId: number): Promise<void> {
    if (completedIdsFor(engine).has(mutationId)) return Promise.resolve();
    return new Promise((settle) => {
      const engineWaiters = waiterMapFor(engine);
      const waiters = engineWaiters.get(mutationId) ?? new Set<CompletionWaiter>();
      waiters.add({ settle });
      engineWaiters.set(mutationId, waiters);
    });
  }

  async function drainAcceptedMutations(engine: Pick<RotoScriptEnginePort, 'getStrokes'> & RotoScriptEnginePort): Promise<void> {
    const pendingIds = Array.from(new Set(engine.getStrokes()
      .map((stroke) => stroke.mutationId)
      .filter((mutationId): mutationId is number => Number.isInteger(mutationId))));
    await Promise.all(pendingIds.map((mutationId) => waitForMutation(engine, mutationId)));
  }

  function snapshotBoundSource(engine: Pick<RotoScriptEnginePort, 'getStrokes'>, source: RotoScriptSourceSnapshot, publishCopiedStatus = true): boolean {
    const brushes = normalizeLogicalBrushes(engine.getStrokes());
    if (brushes.length === 0) {
      if (boundSourceFrame === source.sourceFrame) clipboard.value = null;
      return false;
    }
    sourceRevision += 1;
    boundSourceFrame = source.sourceFrame;
    clipboard.value = deepFreezeScript({ sourceFrame: source.sourceFrame, sourceDisplayFrame: source.displayFrame, sourceRevision, brushes });
    if (publishCopiedStatus) status.value = `Copied ${brushes.length}`;
    return true;
  }

  async function copyScript(): Promise<boolean> {
    if (disposed || disposalRequested || !availability.value.canCopy) return false;
    const engine = engineState.peek();
    if (!engine) return false;
    const source = sourceState.value;
    const acceptedEngineGeneration = engineGeneration;
    const acceptedLaunchGeneration = launchGeneration;
    beginOperation(engine);
    try {
      await drainAcceptedMutations(engine);
      if (disposed || disposalRequested || engineState.peek() !== engine || engineGeneration !== acceptedEngineGeneration || launchGeneration !== acceptedLaunchGeneration) return false;
      return snapshotBoundSource(engine, source);
    } catch {
      if (!disposalRequested && launchGeneration === acceptedLaunchGeneration) status.value = 'Failed';
      return false;
    } finally {
      endOperation(engine);
    }
  }

  function refreshBoundSourceAfterApply(operation: ActiveApplyOperation, terminalStatus: string): void {
    if (operation.completed > 0 && launchGeneration === operation.launchGeneration) {
      const source = sourceState.peek();
      if (engineState.peek() === operation.engine
        && source.workflowMode === 'roto'
        && source.selectionKind === 'real-key'
        && source.sourceFrame === boundSourceFrame) {
        snapshotBoundSource(operation.engine, source, false);
      }
    }
    if (operation.publishUi && launchGeneration === operation.launchGeneration && !disposalRequested) status.value = terminalStatus;
  }

  function finishApply(operation: ActiveApplyOperation, success: boolean): void {
    if (activeApply !== operation) return;
    activeApply = null;
    const applied = success && !operation.cancelled;
    refreshBoundSourceAfterApply(operation, applied ? `Applied ${operation.completed}` : 'Failed');
    operation.resolve(applied);
    endOperation(operation.engine);
    finalizeDisposalIfReady();
  }

  function enqueueNextBrush(operation: ActiveApplyOperation): void {
    if (activeApply !== operation) return;
    if (operation.cancelled || disposalRequested || launchGeneration !== operation.launchGeneration || engineState.peek() !== operation.engine || engineGeneration !== operation.id) {
      operation.cancelled = true;
      if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
      return;
    }
    if (operation.nextBrushIndex >= operation.script.brushes.length) {
      finishApply(operation, operation.completed === operation.script.brushes.length);
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
    if (activeApply !== operation || operation.cancelled || launchGeneration !== operation.launchGeneration) {
      operation.cancelled = true;
      if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
      return;
    }
    try {
      const mutationId = operation.engine.enqueueRecordedStroke(transformed);
      if (operation.nextBrushIndex === 0) ports.onFirstAcceptedBrush?.();
      operation.nextBrushIndex += 1;
      operation.expectedMutationIds.add(mutationId);
      let targets = acceptedTargets.get(operation.engine);
      if (!targets) {
        targets = new Map<number, RotoScriptAcceptedTarget>();
        acceptedTargets.set(operation.engine, targets);
      }
      targets.set(mutationId, {
        sourceFrame: operation.destinationSourceFrame,
        displayFrame: operation.destinationDisplayFrame,
        interpolationSettings: operation.preparedTarget?.interpolationSettings,
        publicationIdentity: operation.publicationIdentity ?? undefined,
      });
    } catch {
      finishApply(operation, false);
    }
  }

  function applyScript(): Promise<boolean> {
    if (disposed || disposalRequested || !availability.value.canApply) return Promise.resolve(false);
    const engine = engineState.peek();
    const script = clipboard.value;
    const source = sourceState.value;
    if (!engine || !script || source.selectionKind === 'generated-interpolation') return Promise.resolve(false);
    const preparedTarget = source.selectionKind === 'empty' ? ports.prepareEmptyTarget() : null;
    if (source.selectionKind === 'empty' && !preparedTarget) {
      status.value = 'Failed';
      return Promise.resolve(false);
    }
    const destinationSourceFrame = preparedTarget?.sourceFrameOverride ?? source.sourceFrame;
    const destinationDisplayFrame = preparedTarget?.target.displayFrame ?? source.displayFrame;
    beginOperation(engine);
    status.value = `Applying 0/${script.brushes.length}`;
    return new Promise((resolve) => {
      const operation: ActiveApplyOperation = {
        id: engineGeneration,
        engine,
        launchGeneration,
        script,
        destinationSourceFrame,
        destinationDisplayFrame,
        publicationIdentity: ports.getPublicationIdentity?.() ?? null,
        preparedTarget,
        expectedMutationIds: new Set(),
        consumedMutationIds: new Set(),
        completed: 0,
        nextBrushIndex: 0,
        cancelled: false,
        publishUi: true,
        resolve,
      };
      activeApply = operation;
      enqueueNextBrush(operation);
    });
  }

  function refreshBoundSource(): void {
    if (disposed || disposalRequested || activeApply) return;
    const source = sourceState.value;
    const engine = engineState.peek();
    if (!engine || source.workflowMode !== 'roto' || source.selectionKind !== 'real-key' || source.sourceFrame !== boundSourceFrame) return;
    snapshotBoundSource(engine, source);
  }

  function observeCompletedMutation(engine: RotoScriptEnginePort, mutation: CompletedPaintMutation): void {
    resolveCompletion(engine, mutation.mutationId);
    if (engineState.peek() === engine) bumpSourceContentRevision();
    const operation = activeApply;
    if (operation
      && operation.engine === engine
      && operation.expectedMutationIds.has(mutation.mutationId)
      && !operation.consumedMutationIds.has(mutation.mutationId)) {
      operation.consumedMutationIds.add(mutation.mutationId);
      operation.completed += 1;
      if (!operation.cancelled && operation.publishUi && launchGeneration === operation.launchGeneration) {
        status.value = `Applying ${operation.completed}/${operation.script.brushes.length}`;
      }
      queueMicrotask(() => enqueueNextBrush(operation));
      return;
    }
    if (engineState.peek() === engine) refreshBoundSource();
  }

  function updateEngine(engine: RotoScriptEnginePort | null): void {
    const previousEngine = engineState.peek();
    if (previousEngine === engine) return;
    engineGeneration += 1;
    engineState.value = engine;
    bumpSourceContentRevision();
    if (engine && busy.peek()) {
      lockedEngines.add(engine);
      engine.setInputLocked(true);
    }
    if (activeApply?.engine === previousEngine) {
      activeApply.cancelled = true;
      if (activeApply.expectedMutationIds.size === activeApply.consumedMutationIds.size) finishApply(activeApply, false);
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
    if (disposed || disposalRequested || !Number.isInteger(targetFrame) || targetFrame < 0 || activeApply || busy.peek()) return false;
    const source = sourceState.value;
    if (boundSourceFrame === null || source.sourceFrame !== boundSourceFrame || targetFrame === source.displayFrame) return true;
    const engine = engineState.peek();
    if (!engine) return false;
    const acceptedEngineGeneration = engineGeneration;
    const acceptedLaunchGeneration = launchGeneration;
    navigationLockHeld = true;
    beginOperation(engine);
    try {
      await drainAcceptedMutations(engine);
      if (disposed || disposalRequested || engineState.peek() !== engine || engineGeneration !== acceptedEngineGeneration || launchGeneration !== acceptedLaunchGeneration) {
        completeNavigation();
        return false;
      }
      snapshotBoundSource(engine, source);
      return true;
    } catch {
      if (!disposalRequested && launchGeneration === acceptedLaunchGeneration) status.value = 'Failed';
      completeNavigation();
      return false;
    }
  }

  function completeNavigation(): void {
    if (!navigationLockHeld) return;
    navigationLockHeld = false;
    const engine = engineState.peek();
    if (engine) endOperation(engine);
  }

  function cancelApply(): void {
    const operation = activeApply;
    if (!operation || operation.cancelled) return;
    operation.cancelled = true;
    if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
  }

  function getAcceptedTarget(engine: RotoScriptEnginePort, mutationId: number): RotoScriptAcceptedTarget | null {
    const targets = acceptedTargets.get(engine);
    const target = targets?.get(mutationId) ?? null;
    targets?.delete(mutationId);
    return target;
  }

  async function prepareLaunchReplacement(): Promise<void> {
    launchGeneration += 1;
    const operation = activeApply;
    if (operation) {
      operation.cancelled = true;
      operation.publishUi = false;
      if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
    }
    const engine = operation?.engine ?? engineState.peek();
    if (operation && engine) {
      const pendingIds = Array.from(operation.expectedMutationIds).filter((mutationId) => !operation.consumedMutationIds.has(mutationId));
      await Promise.all(pendingIds.map((mutationId) => waitForMutation(engine, mutationId)));
    } else if (engine && engine.getStrokes().length > 0) {
      await drainAcceptedMutations(engine);
    }
  }

  function completeLaunchReplacement(): void {
    clipboard.value = null;
    status.value = null;
    boundSourceFrame = null;
    sourceRevision = 0;
    bumpSourceContentRevision();
  }

  async function prepareEngineDisposal(engine: RotoScriptEnginePort): Promise<void> {
    if (activeApply?.engine === engine) {
      activeApply.cancelled = true;
      activeApply.publishUi = false;
    }
    if (engine.getStrokes().length > 0) await drainAcceptedMutations(engine);
  }

  function dispose(): Promise<void> {
    if (disposalPromise) return disposalPromise;
    disposalRequested = true;
    launchGeneration += 1;
    const operation = activeApply;
    if (operation) {
      operation.cancelled = true;
      operation.publishUi = false;
      if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
    }
    disposalPromise = new Promise<void>((resolve) => { resolveDisposal = resolve; });
    finalizeDisposalIfReady();
    return disposalPromise;
  }

  return {
    clipboard,
    status,
    availability,
    mutationLocked,
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
    prepareLaunchReplacement,
    completeLaunchReplacement,
    prepareEngineDisposal,
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
  return groups.map((group) => ({ primary: cloneStroke(group.primary), continuations: group.continuations?.map(cloneStroke) }));
}

function cloneStroke(stroke: Readonly<PaintStroke>): PaintStroke {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })), params: { ...stroke.params } };
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
