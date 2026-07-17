import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type { CompletedPaintMutation, PaintStroke } from '@efxlab/efx-physic-paint';
import { transformRecordedStrokeForHeldPose } from '@efxlab/efx-physic-paint/animation';
import type { PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import type { RotoSaveRealKeyTransaction, RotoSelectedFrameClaim } from './rotoKeyTransactions';
import type { RotoTimelineSelectionKind } from './rotoTimelineSelectors';

export interface RotoScriptSourceSnapshot {
  workflowMode: 'play' | 'roto';
  selectionKind: RotoTimelineSelectionKind;
  layerId?: string | null;
  sourceFrame: number;
  displayFrame: number;
}

export interface RotoScriptSourceProvenance {
  sessionId: string;
  layerId: string;
  sourceFrame: number;
}

export interface RotoScriptPublicationIdentity {
  operationId: string;
  layerId: string;
  cachedBase: (PhysicPaintRenderedFrame & { sourceFrame?: number }) | null;
  background: PhysicPaintRotoBackgroundMetadata;
}

export interface RotoPaintScript {
  provenance: Readonly<RotoScriptSourceProvenance>;
  sourceFrame: number;
  sourceDisplayFrame: number;
  sourceRevision: number;
  brushes: readonly Readonly<RecordedStrokeGroup>[];
}

export interface RotoScriptActionAvailability {
  canCopy: boolean;
  canApply: boolean;
  canApplyReplacement: boolean;
  copyDisabledReason: string | null;
  applyDisabledReason: string | null;
  replacementApplyDisabledReason: string | null;
  busy: boolean;
}

export type RotoScriptOperationErrorCode =
  | 'copy-drain-failed'
  | 'copy-source-invalidated'
  | 'apply-empty-target-failed'
  | 'apply-enqueue-failed'
  | 'apply-cancelled'
  | 'apply-partial-failure'
  | 'apply-invalidated';

export interface RotoScriptOperationError {
  operation: 'copy' | 'apply';
  code: RotoScriptOperationErrorCode;
  message: string;
  cause?: string;
}

export interface RecordedStrokeGroup {
  primary: Readonly<PaintStroke>;
  continuations?: readonly Readonly<PaintStroke>[];
}

export interface RotoScriptEnginePort {
  getStrokes: () => PaintStroke[];
  getStrokeCount?: () => number;
  copyLiveAlphaCanvas?: () => HTMLCanvasElement;
  enqueueRecordedStroke: (group: Readonly<RecordedStrokeGroup>) => number;
  flushPendingStrokeFinalizations?: () => void;
  setInputLocked: (locked: boolean) => void;
}

export interface RotoScriptPersistenceCapture {
  script: RotoPaintScript;
  scriptAlphaCanvas: HTMLCanvasElement;
}

export interface RotoScriptClipboardControllerPorts {
  sessionId?: string;
  getEngine: () => RotoScriptEnginePort | null;
  getSource: () => RotoScriptSourceSnapshot;
  getMotion: () => { deformation: number; position: number };
  getPublicationIdentity?: () => RotoScriptPublicationIdentity | null;
  claimEmptyTarget?: () => RotoSelectedFrameClaim | null;
  prepareEmptyTarget?: () => RotoSelectedFrameClaim | RotoSaveRealKeyTransaction | null;
  flushSourcePublication?: (sourceFrame: number) => Promise<void>;
  onFirstAcceptedBrush?: () => void;
  setNavigationLocked?: (locked: boolean) => void;
}

export interface RotoScriptAcceptedTarget {
  sourceFrame: number;
  displayFrame: number;
  publishPixels: boolean;
  interpolationSettings?: RotoSelectedFrameClaim['interpolationSettings'];
  publicationIdentity?: RotoScriptPublicationIdentity;
}

export interface PreparedRotoScriptLoadAndApply {
  readonly preparationId: symbol;
}

export enum RotoScriptClipboardReplacementOutcome {
  Replaced = 'replaced',
  Rejected = 'rejected',
  Stale = 'stale',
}

export interface RotoScriptClipboardController {
  clipboard: Signal<RotoPaintScript | null>;
  hasCopiedScript: ReadonlySignal<boolean>;
  copiedSourceFrame: ReadonlySignal<number | null>;
  copiedStrokeCount: ReadonlySignal<number>;
  applying: ReadonlySignal<boolean>;
  applyProgress: ReadonlySignal<{ completed: number; total: number } | null>;
  status: Signal<string | null>;
  error: Signal<RotoScriptOperationError | null>;
  availability: ReadonlySignal<RotoScriptActionAvailability>;
  mutationLocked: ReadonlySignal<boolean>;
  copyScript: () => Promise<boolean>;
  captureScriptForPersistence: () => Promise<RotoScriptPersistenceCapture | null>;
  replaceClipboardFromPersisted: (script: RotoPaintScript, preparation?: PreparedRotoScriptLoadAndApply) => RotoScriptClipboardReplacementOutcome;
  prepareScriptLoadAndApply: () => PreparedRotoScriptLoadAndApply | null;
  applyPreparedScript: (preparation: PreparedRotoScriptLoadAndApply) => Promise<boolean>;
  cancelPreparedScriptLoadAndApply: (preparation: PreparedRotoScriptLoadAndApply) => void;
  applyScript: () => Promise<boolean>;
  discardScript: () => void;
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
  preparedTarget: RotoSelectedFrameClaim | null;
  expectedMutationIds: Set<number>;
  consumedMutationIds: Set<number>;
  completed: number;
  nextBrushIndex: number;
  cancelled: boolean;
  cancellationReason: 'user' | 'invalidated' | null;
  failure: RotoScriptOperationError | null;
  publishUi: boolean;
  finishing: boolean;
  settled: Promise<void>;
  settle: () => void;
  resolve: (success: boolean) => void;
}

interface CompletionWaiter {
  settle: () => void;
}

interface ActivePreparedScriptLoadAndApply extends PreparedRotoScriptLoadAndApply {
  engine: RotoScriptEnginePort;
  source: RotoScriptSourceSnapshot;
  engineGeneration: number;
  launchGeneration: number;
  released: boolean;
}

const COPY_REASONS = {
  wrongMode: 'Copy Script is available only in Roto mode.',
  generated: 'Generated frames are render-only and cannot be copied as scripts.',
  empty: 'Paint at least one brush on a real Roto key before copying its script.',
  busy: 'Finish the current script operation before copying.',
} as const;

let nextRotoScriptSessionId = 1;

const APPLY_REASONS = {
  wrongMode: 'Apply Script is available only in Roto mode.',
  generated: 'Generated frames are render-only and cannot receive a script.',
  missing: 'Copy a Roto paint script before applying it.',
  busy: 'Finish the current script operation before applying another script.',
} as const;

export function createRotoScriptClipboardController(ports: RotoScriptClipboardControllerPorts): RotoScriptClipboardController {
  const clipboard = signal<RotoPaintScript | null>(null);
  const hasCopiedScript = computed(() => clipboard.value !== null);
  const copiedSourceFrame = computed(() => clipboard.value?.sourceFrame ?? null);
  const copiedStrokeCount = computed(() => clipboard.value?.brushes.length ?? 0);
  const applyProgressState = signal<{ completed: number; total: number } | null>(null);
  const applying = computed(() => applyProgressState.value !== null);
  const applyProgress = computed(() => applyProgressState.value);
  const status = signal<string | null>(null);
  const error = signal<RotoScriptOperationError | null>(null);
  const busy = signal(false);
  const mutationLocked = signal(false);
  const sourceHasBrushes = signal(false);
  const completedMutationIds = new WeakMap<RotoScriptEnginePort, Set<number>>();
  const completionWaiters = new WeakMap<RotoScriptEnginePort, Map<number, Set<CompletionWaiter>>>();
  const sourceState = signal<RotoScriptSourceSnapshot>(ports.getSource());
  const engineState = signal<RotoScriptEnginePort | null>(ports.getEngine());
  const acceptedTargets = new WeakMap<RotoScriptEnginePort, Map<number, RotoScriptAcceptedTarget>>();
  const lockedEngines = new Set<RotoScriptEnginePort>();
  const sessionId = ports.sessionId ?? `roto-script-session-${nextRotoScriptSessionId++}`;
  let sourceRevision = 0;
  let engineGeneration = 0;
  let launchGeneration = 0;
  let activeApply: ActiveApplyOperation | null = null;
  let preparedScriptLoadAndApply: ActivePreparedScriptLoadAndApply | null = null;
  let disposed = false;
  let disposalRequested = false;
  let navigationLockHeld = false;
  let pendingOperationCount = 0;
  let resolveDisposal: (() => void) | null = null;
  let disposalPromise: Promise<void> | null = null;

  refreshSourceHasBrushes(engineState.peek());

  const availability = computed<RotoScriptActionAvailability>(() => {
    const source = sourceState.value;
    const engine = engineState.value;
    const hasBrushes = Boolean(engine && sourceHasBrushes.value);
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
    const replacementApplyDisabledReason = unavailable
      ? APPLY_REASONS.busy
      : source.workflowMode !== 'roto'
        ? APPLY_REASONS.wrongMode
        : source.selectionKind === 'generated-interpolation'
          ? APPLY_REASONS.generated
          : null;
    const applyDisabledReason = replacementApplyDisabledReason ?? (clipboard.value === null ? APPLY_REASONS.missing : null);
    return {
      canCopy: copyDisabledReason === null,
      canApply: applyDisabledReason === null,
      canApplyReplacement: replacementApplyDisabledReason === null,
      copyDisabledReason,
      applyDisabledReason,
      replacementApplyDisabledReason,
      busy: busy.value,
    };
  });

  function refreshSourceHasBrushes(engine = engineState.peek()): void {
    sourceHasBrushes.value = Boolean(engine && (engine.getStrokeCount ? engine.getStrokeCount() > 0 : engine.getStrokes().some((stroke) => stroke.points.length > 0)));
  }

  function sourceLayerId(source: RotoScriptSourceSnapshot): string {
    return source.layerId ?? 'legacy-mounted-layer';
  }

  function provenanceFor(source: RotoScriptSourceSnapshot): RotoScriptSourceProvenance {
    return { sessionId, layerId: sourceLayerId(source), sourceFrame: source.sourceFrame };
  }

  function errorCause(cause: unknown): string | undefined {
    if (cause instanceof Error && cause.message.trim()) return cause.message;
    if (typeof cause === 'string' && cause.trim()) return cause;
    return undefined;
  }

  function operationError(
    operation: RotoScriptOperationError['operation'],
    code: RotoScriptOperationErrorCode,
    message: string,
    cause?: unknown,
  ): RotoScriptOperationError {
    const safeCause = errorCause(cause);
    return safeCause ? { operation, code, message: `${message}: ${safeCause}`, cause: safeCause } : { operation, code, message };
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
    applyProgressState.value = null;
    status.value = null;
    error.value = null;
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
    engine.flushPendingStrokeFinalizations?.();
    const pendingIds = Array.from(new Set(engine.getStrokes()
      .map((stroke) => stroke.mutationId)
      .filter((mutationId): mutationId is number => Number.isInteger(mutationId))));
    await Promise.all(pendingIds.map((mutationId) => waitForMutation(engine, mutationId)));
  }

  function snapshotBoundSource(engine: Pick<RotoScriptEnginePort, 'getStrokes'>, source: RotoScriptSourceSnapshot, publishCopiedStatus = true): boolean {
    const provenance = provenanceFor(source);
    const brushes = normalizeLogicalBrushes(engine.getStrokes());
    if (brushes.length === 0) return false;
    sourceRevision += 1;
    clipboard.value = deepFreezeScript({ provenance, sourceFrame: source.sourceFrame, sourceDisplayFrame: source.displayFrame, sourceRevision, brushes });
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
    error.value = null;
    beginOperation(engine);
    try {
      await drainAcceptedMutations(engine);
      await ports.flushSourcePublication?.(source.sourceFrame);
      if (disposed || disposalRequested || engineState.peek() !== engine || engineGeneration !== acceptedEngineGeneration || launchGeneration !== acceptedLaunchGeneration) {
        if (!disposalRequested && launchGeneration === acceptedLaunchGeneration) {
          status.value = 'Failed';
          error.value = operationError('copy', 'copy-source-invalidated', 'Copy Script could not finish because its mounted source changed.');
        }
        return false;
      }
      const copied = snapshotBoundSource(engine, source);
      if (copied) error.value = null;
      return copied;
    } catch (cause) {
      if (!disposalRequested && launchGeneration === acceptedLaunchGeneration) {
        status.value = 'Failed';
        error.value = operationError('copy', 'copy-drain-failed', 'Copy Script could not finish accepted paint work', cause);
      }
      return false;
    } finally {
      endOperation(engine);
    }
  }

  async function captureScriptForPersistence(): Promise<RotoScriptPersistenceCapture | null> {
    if (disposed || disposalRequested || !availability.value.canCopy) return null;
    const engine = engineState.peek();
    if (!engine) return null;
    const source = sourceState.peek();
    const acceptedEngineGeneration = engineGeneration;
    const acceptedLaunchGeneration = launchGeneration;
    beginOperation(engine);
    try {
      await drainAcceptedMutations(engine);
      await ports.flushSourcePublication?.(source.sourceFrame);
      if (disposed || disposalRequested || engineState.peek() !== engine || engineGeneration !== acceptedEngineGeneration || launchGeneration !== acceptedLaunchGeneration) return null;
      const brushes = normalizeLogicalBrushes(engine.getStrokes());
      if (brushes.length === 0 || !engine.copyLiveAlphaCanvas) return null;
      const script = deepFreezeScript({ provenance: provenanceFor(source), sourceFrame: source.sourceFrame, sourceDisplayFrame: source.displayFrame, sourceRevision: sourceRevision + 1, brushes });
      return { script, scriptAlphaCanvas: engine.copyLiveAlphaCanvas() };
    } catch (cause) {
      error.value = operationError('copy', 'copy-drain-failed', 'Save Script could not finish accepted paint work', cause);
      return null;
    } finally { endOperation(engine); }
  }

  function sameSourceIdentity(left: RotoScriptSourceSnapshot, right: RotoScriptSourceSnapshot): boolean {
    return left.workflowMode === right.workflowMode
      && left.selectionKind === right.selectionKind
      && left.layerId === right.layerId
      && left.sourceFrame === right.sourceFrame
      && left.displayFrame === right.displayFrame;
  }

  function isPreparedScriptLoadAndApplyValid(preparation: ActivePreparedScriptLoadAndApply): boolean {
    return !preparation.released
      && !disposed
      && !disposalRequested
      && engineState.peek() === preparation.engine
      && engineGeneration === preparation.engineGeneration
      && launchGeneration === preparation.launchGeneration
      && sameSourceIdentity(sourceState.peek(), preparation.source);
  }

  function releasePreparedScriptLoadAndApply(preparation: ActivePreparedScriptLoadAndApply): void {
    if (preparation.released) return;
    preparation.released = true;
    if (preparedScriptLoadAndApply === preparation) preparedScriptLoadAndApply = null;
    endOperation(preparation.engine);
  }

  function invalidatePreparedScriptLoadAndApply(): void {
    if (preparedScriptLoadAndApply) releasePreparedScriptLoadAndApply(preparedScriptLoadAndApply);
  }

  function replaceClipboardFromPersisted(script: RotoPaintScript, preparation?: PreparedRotoScriptLoadAndApply): RotoScriptClipboardReplacementOutcome {
    const activePreparation = preparedScriptLoadAndApply;
    if (preparation && (preparation !== activePreparation || !activePreparation || !isPreparedScriptLoadAndApplyValid(activePreparation))) {
      return RotoScriptClipboardReplacementOutcome.Stale;
    }
    if (disposed || disposalRequested || !script.brushes.length) return RotoScriptClipboardReplacementOutcome.Rejected;
    if (activePreparation) {
      if (preparation !== activePreparation) return RotoScriptClipboardReplacementOutcome.Rejected;
    } else if (busy.peek()) {
      return RotoScriptClipboardReplacementOutcome.Rejected;
    }
    clipboard.value = deepFreezeScript({
      provenance: { ...script.provenance }, sourceFrame: script.sourceFrame, sourceDisplayFrame: script.sourceDisplayFrame,
      sourceRevision: ++sourceRevision,
      brushes: script.brushes.map((brush) => ({ primary: cloneStroke(brush.primary), continuations: brush.continuations?.map(cloneStroke) })),
    });
    status.value = null; error.value = null;
    return RotoScriptClipboardReplacementOutcome.Replaced;
  }

  function prepareScriptLoadAndApply(): PreparedRotoScriptLoadAndApply | null {
    if (disposed || disposalRequested || preparedScriptLoadAndApply || !availability.value.canApplyReplacement) return null;
    const engine = engineState.peek();
    if (!engine) return null;
    const preparation: ActivePreparedScriptLoadAndApply = {
      preparationId: Symbol('roto-script-load-and-apply'),
      engine,
      source: { ...sourceState.peek() },
      engineGeneration,
      launchGeneration,
      released: false,
    };
    preparedScriptLoadAndApply = preparation;
    beginOperation(engine);
    return preparation;
  }

  function cancelPreparedScriptLoadAndApply(preparation: PreparedRotoScriptLoadAndApply): void {
    if (preparedScriptLoadAndApply !== preparation) return;
    releasePreparedScriptLoadAndApply(preparedScriptLoadAndApply);
  }

  function applyPreparedScript(preparation: PreparedRotoScriptLoadAndApply): Promise<boolean> {
    const activePreparation = preparedScriptLoadAndApply;
    if (!activePreparation || activePreparation !== preparation) return Promise.resolve(false);
    const valid = isPreparedScriptLoadAndApplyValid(activePreparation);
    releasePreparedScriptLoadAndApply(activePreparation);
    if (!valid) return Promise.resolve(false);
    return applyScript();
  }

  function publishApplyStatus(operation: ActiveApplyOperation, terminalStatus: string): void {
    if (operation.publishUi && launchGeneration === operation.launchGeneration && !disposalRequested) status.value = terminalStatus;
  }

  function finishApply(operation: ActiveApplyOperation, success: boolean): void {
    if (activeApply !== operation || operation.finishing) return;
    operation.finishing = true;
    const complete = async () => {
      let applied = success && !operation.cancelled;
      try {
        if (applied) await ports.flushSourcePublication?.(operation.destinationSourceFrame);
      } catch (cause) {
        applied = false;
        operation.failure = operationError('apply', 'apply-partial-failure', `Apply Script pixels could not be published after ${operation.completed} brushes`, cause);
      }
      applied = applied && !operation.cancelled && launchGeneration === operation.launchGeneration && engineState.peek() === operation.engine;
      if (activeApply !== operation) return;
      activeApply = null;
      applyProgressState.value = null;
      publishApplyStatus(operation, applied ? `Applied ${operation.completed}` : 'Failed');
      if (operation.publishUi && launchGeneration === operation.launchGeneration && !disposalRequested) {
        if (applied) {
          error.value = null;
        } else {
          error.value = operation.failure ?? (operation.cancellationReason === 'user'
            ? operationError('apply', 'apply-cancelled', `Apply Script was cancelled after ${operation.completed} of ${operation.script.brushes.length} brushes completed.`)
            : operation.completed > 0
              ? operationError('apply', 'apply-partial-failure', `Apply Script stopped after ${operation.completed} of ${operation.script.brushes.length} brushes.`)
              : operationError('apply', 'apply-invalidated', 'Apply Script could not finish because its mounted target changed.'));
        }
      }
      operation.resolve(applied);
      operation.settle();
      endOperation(operation.engine);
      finalizeDisposalIfReady();
    };
    void complete();
  }

  function enqueueNextBrush(operation: ActiveApplyOperation): void {
    if (activeApply !== operation) return;
    if (operation.cancelled || disposalRequested || launchGeneration !== operation.launchGeneration || engineState.peek() !== operation.engine || engineGeneration !== operation.id) {
      operation.cancelled = true;
      operation.cancellationReason ??= 'invalidated';
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
      operation.cancellationReason ??= 'invalidated';
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
        publishPixels: operation.nextBrushIndex === operation.script.brushes.length,
        interpolationSettings: operation.preparedTarget?.interpolationSettings,
        publicationIdentity: operation.publicationIdentity ?? undefined,
      });
    } catch (cause) {
      operation.failure = operationError(
        'apply',
        operation.completed > 0 ? 'apply-partial-failure' : 'apply-enqueue-failed',
        operation.completed > 0
          ? `Apply Script stopped after ${operation.completed} of ${operation.script.brushes.length} brushes`
          : 'Apply Script could not enqueue its first brush',
        cause,
      );
      finishApply(operation, false);
    }
  }

  function discardScript(): void {
    if (disposed || disposalRequested || busy.peek()) return;
    clipboard.value = null;
    status.value = null;
    error.value = null;
  }

  function applyScript(): Promise<boolean> {
    if (disposed || disposalRequested || !availability.value.canApply) return Promise.resolve(false);
    const engine = engineState.peek();
    const script = clipboard.value;
    const source = sourceState.value;
    if (!engine || !script || source.selectionKind === 'generated-interpolation') return Promise.resolve(false);
    error.value = null;
    let preparedTarget: RotoSelectedFrameClaim | null = null;
    if (source.selectionKind === 'empty') {
      try {
        const claimedTarget = ports.claimEmptyTarget?.() ?? ports.prepareEmptyTarget?.() ?? null;
        preparedTarget = claimedTarget && 'target' in claimedTarget
          ? {
            sourceFrame: claimedTarget.sourceFrameOverride,
            displayFrame: claimedTarget.target.displayFrame,
            interpolationSettings: claimedTarget.interpolationSettings,
          }
          : claimedTarget;
      } catch (cause) {
        status.value = 'Failed';
        error.value = operationError('apply', 'apply-empty-target-failed', 'Apply Script could not prepare the empty destination', cause);
        return Promise.resolve(false);
      }
      if (!preparedTarget) {
        status.value = 'Failed';
        error.value = operationError('apply', 'apply-empty-target-failed', 'Apply Script could not prepare the empty destination as a real Roto key.');
        return Promise.resolve(false);
      }
    }
    const destinationSourceFrame = preparedTarget?.sourceFrame ?? source.sourceFrame;
    const destinationDisplayFrame = preparedTarget?.displayFrame ?? source.displayFrame;
    beginOperation(engine);
    applyProgressState.value = { completed: 0, total: script.brushes.length };
    status.value = `Applying 0/${script.brushes.length}`;
    return new Promise((resolve) => {
      let settleOperation = () => {};
      const settled = new Promise<void>((settle) => { settleOperation = settle; });
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
        cancellationReason: null,
        failure: null,
        publishUi: true,
        finishing: false,
        settled,
        settle: settleOperation,
        resolve,
      };
      activeApply = operation;
      enqueueNextBrush(operation);
    });
  }

  function observeCompletedMutation(engine: RotoScriptEnginePort, mutation: CompletedPaintMutation): void {
    resolveCompletion(engine, mutation.mutationId);
    if (engineState.peek() === engine) refreshSourceHasBrushes();
    const operation = activeApply;
    if (operation
      && operation.engine === engine
      && operation.expectedMutationIds.has(mutation.mutationId)
      && !operation.consumedMutationIds.has(mutation.mutationId)) {
      operation.consumedMutationIds.add(mutation.mutationId);
      operation.completed += 1;
      applyProgressState.value = { completed: operation.completed, total: operation.script.brushes.length };
      if (!operation.cancelled && operation.publishUi && launchGeneration === operation.launchGeneration) {
        status.value = `Applying ${operation.completed}/${operation.script.brushes.length}`;
      }
      queueMicrotask(() => enqueueNextBrush(operation));
      return;
    }
  }

  function updateEngine(engine: RotoScriptEnginePort | null): void {
    const previousEngine = engineState.peek();
    if (previousEngine === engine) return;
    invalidatePreparedScriptLoadAndApply();
    engineGeneration += 1;
    engineState.value = engine;
    refreshSourceHasBrushes();
    if (engine && busy.peek()) {
      lockedEngines.add(engine);
      engine.setInputLocked(true);
    }
    if (activeApply?.engine === previousEngine) {
      activeApply.cancelled = true;
      activeApply.cancellationReason = 'invalidated';
      if (activeApply.expectedMutationIds.size === activeApply.consumedMutationIds.size) finishApply(activeApply, false);
    }
  }

  function updateSource(source: RotoScriptSourceSnapshot): void {
    const current = sourceState.peek();
    if (sameSourceIdentity(current, source)) return;
    invalidatePreparedScriptLoadAndApply();
    sourceState.value = source;
  }

  function notifySourceRevision(): void {
    refreshSourceHasBrushes();
  }

  async function prepareNavigation(targetFrame: number): Promise<boolean> {
    if (disposed || disposalRequested || !Number.isInteger(targetFrame) || targetFrame < 0 || activeApply || busy.peek()) return false;
    if (targetFrame === sourceState.peek().displayFrame) return true;
    const engine = engineState.peek();
    if (!engine) return true;
    navigationLockHeld = true;
    beginOperation(engine);
    return true;
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
    operation.cancellationReason = 'user';
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
    invalidatePreparedScriptLoadAndApply();
    const operation = activeApply;
    if (operation) {
      operation.launchGeneration = launchGeneration;
      await operation.settled;
      await ports.flushSourcePublication?.(operation.destinationSourceFrame);
      return;
    }
    const engine = engineState.peek();
    const source = sourceState.peek();
    if (engine && (engine.getStrokeCount?.() ?? engine.getStrokes().length) > 0) await drainAcceptedMutations(engine);
    await ports.flushSourcePublication?.(source.sourceFrame);
  }

  function completeLaunchReplacement(): void {
    applyProgressState.value = null;
    status.value = null;
    error.value = null;
    refreshSourceHasBrushes();
  }

  async function prepareEngineDisposal(engine: RotoScriptEnginePort): Promise<void> {
    invalidatePreparedScriptLoadAndApply();
    if (activeApply?.engine === engine) {
      activeApply.cancelled = true;
      activeApply.cancellationReason = 'invalidated';
      activeApply.publishUi = false;
    }
    const source = sourceState.peek();
    if ((engine.getStrokeCount?.() ?? engine.getStrokes().length) > 0) await drainAcceptedMutations(engine);
    await ports.flushSourcePublication?.(source.sourceFrame);
  }

  function dispose(): Promise<void> {
    if (disposalPromise) return disposalPromise;
    disposalRequested = true;
    launchGeneration += 1;
    invalidatePreparedScriptLoadAndApply();
    const operation = activeApply;
    if (operation) {
      operation.cancelled = true;
      operation.cancellationReason = 'invalidated';
      operation.publishUi = false;
      if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
    }
    disposalPromise = new Promise<void>((resolve) => { resolveDisposal = resolve; });
    finalizeDisposalIfReady();
    return disposalPromise;
  }

  return {
    clipboard,
    hasCopiedScript,
    copiedSourceFrame,
    copiedStrokeCount,
    applying,
    applyProgress,
    status,
    error,
    availability,
    mutationLocked,
    copyScript,
    captureScriptForPersistence,
    replaceClipboardFromPersisted,
    prepareScriptLoadAndApply,
    applyPreparedScript,
    cancelPreparedScriptLoadAndApply,
    applyScript,
    discardScript,
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
  Object.freeze(script.provenance);
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
