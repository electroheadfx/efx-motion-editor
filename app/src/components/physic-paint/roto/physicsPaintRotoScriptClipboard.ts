import { computed, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import { toStudioStroke, fromStudioStroke, type CompletedPaintMutation, type PaintStroke } from '@efxlab/efx-physic-paint';
import { transformRecordedStrokeForHeldPose } from '@efxlab/efx-paint-host/animation';
import {
  isAquarelleDryEvent,
  toStudioStroke as aquarelleToStudioStroke,
  type AquarellePayloadEvent,
} from '@efxlab/efx-watercolor/payload';
import type { PhysicPaintRenderedFrame, PhysicPaintRotoBackgroundMetadata } from '../../../types/physicPaint';
import { getRecordedAquarellePayloadTimeline, getRecordedAquarelleStroke, isAquarelleStrokeDeleted } from '../view/aquarelleRecordState';
import { freezeRecordedStrokeGroups, normalizeLogicalBrushes, type RecordedStrokeGroup } from '../view/recordedStrokeGroups';
import type { RotoTimelineSelectionKind } from './rotoTimelineSelectors';

// 261023-g4p: the projection and its group type live in ONE module
// (view/recordedStrokeGroups) so the brush script store reuses the same
// implementation. Re-exported here under the same names — no consumer change.
export { normalizeLogicalBrushes };
export type { RecordedStrokeGroup };

export interface RotoScriptSourceSnapshot {
  selectionKind: RotoTimelineSelectionKind;
  layerId: string | null;
  keyId: string | null;
  appFrame: number;
}

export interface RotoScriptPhysicalTarget {
  keyId: string;
  appFrame: number;
  /**
   * 261026 (watercolor-loop-render-split, axis 1): the PROJECTION identity the
   * async currency guard compares against. On a group occurrence the publish
   * key is the override key while the projection cell stays the underlying
   * source key; comparing `keyId` would refuse a legitimate override publish.
   * Absent = the target key IS the projection identity (ordinary keys).
   */
  sourceKeyId?: string | null;
  /**
   * 261026 axis 2: the group SOURCE key whose payload is the durable
   * pixel-only base for a script re-bake. When set, the publish callback must
   * multiply-composite the baked sheet over that base before publishing; when
   * the base cannot be resolved the publish fails closed.
   */
  durableBaseKeyId?: string | null;
  /**
   * 261026 (third pass, ORDINARY KEYS): the key's own durable pixel-only base —
   * the payload as of the FIRST sheet session in which its watercolor script
   * began (the "cached key" paint under the wash). Ordinary keys have no
   * separate source key, so the base travels as BYTES for the publish
   * composite.
   *
   * Semantics: PRESENT (Uint8Array) = known base, multiply-composite the bake
   * over it; PRESENT (null) = known to have no base paint, the script is the
   * key's complete content (raw bake); ABSENT/undefined = base UNKNOWN (e.g. a
   * scripted key after reopen) → the publish MUST fail closed and never erase
   * the key's cached paint.
   */
  durableBaseBytes?: Uint8Array | null;
}

export interface RotoScriptSourceProvenance {
  sessionId: string;
  layerId: string;
  sourceFrame: number;
}

export interface RotoScriptPublicationIdentity {
  operationId: string;
  layerId: string;
  cachedBase: PhysicPaintRenderedFrame | null;
  background: PhysicPaintRotoBackgroundMetadata;
}

export interface RotoPaintScript {
  provenance: Readonly<RotoScriptSourceProvenance>;
  sourceFrame: number;
  sourceDisplayFrame: number;
  sourceRevision: number;
  brushes: readonly Readonly<RecordedStrokeGroup>[];
  /**
   * 56-08: the envelope engine discriminator. Absent = engine-1
   * ('efx-physic-paint'), which is the byte-stable default. Present as
   * 'efx-watercolor' routes the Play Script bake through the aquarelle
   * consume branch (flush-survives-navigation, AQUA-07).
   */
  engineId?: string;
  /**
   * 261018-odm: the persisted aquarelle payload timeline (strokes + Dry,
   * recorded order). Present for aquarelle documents so Play Script Apply
   * can rebuild the timeline without the in-memory record map.
   */
  aquarelleEvents?: readonly AquarellePayloadEvent[];
}

export interface RotoScriptActionAvailability {
  canCopy: boolean;
  canApply: boolean;
  canApplyReplacement: boolean;
  canDiscard: boolean;
  copyDisabledReason: string | null;
  applyDisabledReason: string | null;
  replacementApplyDisabledReason: string | null;
  discardDisabledReason: string | null;
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

export interface RotoScriptEnginePort {
  getStrokes: () => PaintStroke[];
  getStrokeCount?: () => number;
  /**
   * quick 261027-klx: the watercolor sheet seam may legitimately have no
   * pixels yet (null). A nullable result must never be replaced by a blank
   * canvas — the capture bails out instead (see captureScriptForPersistence).
   */
  copyLiveAlphaCanvas?: () => HTMLCanvasElement | null;
  enqueueRecordedStroke: (group: Readonly<RecordedStrokeGroup>) => number;
  flushPendingStrokeFinalizations?: () => void;
  setInputLocked: (locked: boolean) => void;
}

export interface RotoScriptPersistenceCapture {
  script: RotoPaintScript;
  scriptAlphaCanvas: HTMLCanvasElement;
  /**
   * 261026-nvq: the live aquarelle sheet (MODE.transparent OPAQUE
   * transmittance, white = no pigment) for the capture's source frame. Present
   * only when `script.aquarelleEvents` is present and the host's ink gate
   * accepted the sheet. In-memory only — never persisted; the thumbnail source
   * for aquarelle saves, drawn with multiply by the encoder.
   */
  aquarelleAlphaCanvas?: HTMLCanvasElement;
}

export interface RotoScriptClipboardControllerPorts {
  sessionId?: string;
  getEngine: () => RotoScriptEnginePort | null;
  getSource: () => RotoScriptSourceSnapshot;
  getMotion: () => { deformation: number; position: number };
  getPublicationIdentity?: () => RotoScriptPublicationIdentity | null;
  prepareTarget: (source: RotoScriptSourceSnapshot) => Promise<RotoScriptPhysicalTarget | null>;
  flushSourcePublication?: (appFrame: number) => Promise<void>;
  /**
   * 261026-nvq SAVE-PATH seam: the live aquarelle sheet for the current edit
   * frame. Called EAGERLY by captureScriptForPersistence — the sheet is
   * frame-scoped and a frame change during the drain clears it. Returns null
   * when the host has no sheet (module unmounted) or the ink gate rejected a
   * blank sheet, in which case the engine alpha canvas stays the thumbnail.
   */
  captureAquarelleCanvas?: () => HTMLCanvasElement | null;
  /**
   * 261018: aquarelle Apply seam. When the script carries `aquarelleEvents`,
   * applyScript routes through this (aquarelle engine replay + wash publish)
   * instead of engine-1 `enqueueRecordedStroke` — engine-1 draws only the
   * guide line, never the wash.
   */
  applyAquarelleEvents?: (input: {
    events: readonly AquarellePayloadEvent[];
    target: RotoScriptPhysicalTarget;
    /**
     * 261022 Apply parity: per-fully-fed-stroke progress (cumulative
     * completed, stroke-event total — Dry excluded). Same pill contract as
     * brush-mode Apply.
     */
    onProgress?: (completed: number, total: number) => void;
  }) => Promise<boolean>;
  onFirstAcceptedBrush?: () => void;
  setNavigationLocked?: (locked: boolean) => void;
}

export interface RotoScriptAcceptedTarget extends RotoScriptPhysicalTarget {
  publishPixels: boolean;
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
  /** 261023-cxc: the live source identity the apply seam will accept. */
  source: ReadonlySignal<RotoScriptSourceSnapshot>;
  hasCopiedScript: ReadonlySignal<boolean>;
  copiedAppFrame: ReadonlySignal<number | null>;
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
  /** 261022-pim: re-bake the LIVE captured script (delete) without the clipboard. */
  applyCurrentScript: () => Promise<boolean>;
  /** 261022-pim: re-bake a recorded aquarelle timeline for the current source.
   *  The timeline is the script — no engine capture, so repeated deletes keep
   *  working after an Apply refresh clears the guide strokes. */
  applyAquarelleTimeline: (events: readonly AquarellePayloadEvent[]) => Promise<boolean>;
  /**
   * 261023-cxc: dispatch a PROVIDED script at the current source through the
   * shared apply seam. No clipboard read and no clipboard write — the
   * transient script lives only in the Duplicate sequence's closure.
   */
  applyProvidedScript: (script: RotoPaintScript) => Promise<boolean>;
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
  destinationKeyId: string;
  destinationAppFrame: number;
  publicationIdentity: RotoScriptPublicationIdentity | null;
  expectedMutationIds: Set<number>;
  consumedMutationIds: Set<number>;
  completed: number;
  nextBrushIndex: number;
  cancelled: boolean;
  cancellationReason: 'user' | 'invalidated' | null;
  failure: RotoScriptOperationError | null;
  /** Raw cause of a mid-burst enqueue throw. Materialized into `failure` at
   *  close time so the partial-failure message counts the brushes that actually
   *  completed (in a burst, in-flight completions land AFTER the throw). */
  enqueueFailureCause: unknown;
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

const DISCARD_REASONS = {
  missing: 'Copy a Roto paint script before discarding it.',
  busy: 'Finish the current script operation before discarding.',
} as const;

export function createRotoScriptClipboardController(ports: RotoScriptClipboardControllerPorts): RotoScriptClipboardController {
  const clipboard = signal<RotoPaintScript | null>(null);
  const hasCopiedScript = computed(() => clipboard.value !== null);
  const copiedAppFrame = computed(() => clipboard.value?.sourceFrame ?? null);
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
  /** The engine that took the navigation lease — completeNavigation MUST
   *  release it even if engineState has since gone null (I-09 busy-lease
   *  leak: a skipped endOperation left busy stuck true and every later
   *  prepareNavigation silently returned false). */
  let navigationLockEngine: RotoScriptEnginePort | null = null;
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
      : source.selectionKind === 'generated-interpolation'
        ? COPY_REASONS.generated
        : source.selectionKind !== 'real-key' || !hasBrushes
          ? COPY_REASONS.empty
          : null;
    const replacementApplyDisabledReason = unavailable
      ? APPLY_REASONS.busy
      : source.selectionKind === 'generated-interpolation'
        ? APPLY_REASONS.generated
        : null;
    const applyDisabledReason = replacementApplyDisabledReason ?? (clipboard.value === null ? APPLY_REASONS.missing : null);
    const discardDisabledReason = unavailable
      ? DISCARD_REASONS.busy
      : clipboard.value === null
        ? DISCARD_REASONS.missing
        : null;
    return {
      canCopy: copyDisabledReason === null,
      canApply: applyDisabledReason === null,
      canApplyReplacement: replacementApplyDisabledReason === null,
      canDiscard: discardDisabledReason === null,
      copyDisabledReason,
      applyDisabledReason,
      replacementApplyDisabledReason,
      discardDisabledReason,
      busy: busy.value,
    };
  });

  function refreshSourceHasBrushes(engine = engineState.peek()): void {
    sourceHasBrushes.value = Boolean(engine && (engine.getStrokeCount ? engine.getStrokeCount() > 0 : engine.getStrokes().some((stroke) => stroke.points.length > 0)));
  }

  function sourceLayerId(source: RotoScriptSourceSnapshot): string {
    return source.layerId ?? 'unmounted-layer';
  }

  function provenanceFor(source: RotoScriptSourceSnapshot): RotoScriptSourceProvenance {
    return { sessionId, layerId: sourceLayerId(source), sourceFrame: source.appFrame };
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

  function endOperation(engine: RotoScriptEnginePort | null): void {
    pendingOperationCount = Math.max(0, pendingOperationCount - 1);
    if (engine) {
      lockedEngines.delete(engine);
      engine.setInputLocked(false);
    }
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
    clipboard.value = deepFreezeScript({ provenance, sourceFrame: source.appFrame, sourceDisplayFrame: source.appFrame, sourceRevision, brushes });
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
      await ports.flushSourcePublication?.(source.appFrame);
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
    if (disposed || disposalRequested) return null;
    const engine = engineState.peek();
    if (!engine) return null;
    // Refresh BEFORE the canCopy gate: hasBrushes is only written on mutation
    // completion, so a stroke that is still queued reads as "no brushes" and
    // Save bails before the drain below can finish it (invisible failure — the
    // library status is the only reporter and it has no reader).
    refreshSourceHasBrushes(engine);
    if (!availability.value.canCopy) return null;
    // SAVE PATH (261026-nvq): read the live aquarelle sheet EAGERLY, before the
    // first await below. The sheet is frame-scoped — a frame change during the
    // drain clears it — so a deferred read would save an empty sheet.
    const aquarelleAlphaCanvas = ports.captureAquarelleCanvas?.() ?? null;
    const source = sourceState.peek();
    const acceptedEngineGeneration = engineGeneration;
    const acceptedLaunchGeneration = launchGeneration;
    beginOperation(engine);
    try {
      await drainAcceptedMutations(engine);
      await ports.flushSourcePublication?.(source.appFrame);
      if (disposed || disposalRequested || engineState.peek() !== engine || engineGeneration !== acceptedEngineGeneration || launchGeneration !== acceptedLaunchGeneration) return null;
      const brushes = normalizeLogicalBrushes(engine.getStrokes());
      if (brushes.length === 0 || !engine.copyLiveAlphaCanvas) return null;
      // quick 261027-klx: call the seam ONCE. A null sheet is a real "no
      // pixels yet" answer — bail out rather than substituting a blank canvas.
      const scriptAlphaCanvas = engine.copyLiveAlphaCanvas();
      if (scriptAlphaCanvas === null) return null;
      // 261018-odm: when EVERY captured primary has a recorded AquarelleStroke,
      // attach the aquarelle payload timeline so the save path serializes the
      // efx-watercolor variant. A mixed engine-1 + watercolor key keeps the
      // engine-1 serialize path (aquarelleEvents stays absent).
      const aquarelleEvents = buildAquarelleEventsFromCapture(brushes);
      const script = deepFreezeScript({
        provenance: provenanceFor(source), sourceFrame: source.appFrame, sourceDisplayFrame: source.appFrame,
        sourceRevision: sourceRevision + 1, brushes,
        ...(aquarelleEvents ? { aquarelleEvents } : {}),
      });
      return {
        script,
        scriptAlphaCanvas,
        // 261026-nvq: attach the sheet only for an aquarelle script — a mixed
        // key keeps today's engine-1 thumbnail source, and a blank sheet (ink
        // gate returned null) falls back to the engine canvas.
        ...(aquarelleEvents !== undefined && aquarelleAlphaCanvas !== null ? { aquarelleAlphaCanvas } : {}),
      };
    } catch (cause) {
      error.value = operationError('copy', 'copy-drain-failed', 'Save Script could not finish accepted paint work', cause);
      return null;
    } finally { endOperation(engine); }
  }

  function sameSourceIdentity(left: RotoScriptSourceSnapshot, right: RotoScriptSourceSnapshot): boolean {
    return left.selectionKind === right.selectionKind
      && left.layerId === right.layerId
      && left.keyId === right.keyId
      && left.appFrame === right.appFrame;
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
      ...(script.engineId !== undefined ? { engineId: script.engineId } : {}),
      ...(script.aquarelleEvents !== undefined ? { aquarelleEvents: script.aquarelleEvents.map((event) => isAquarelleDryEvent(event) ? { ...event } : {
        pts: event.pts.map((point) => ({ ...point })),
        ticks: event.ticks,
        cuisson: event.cuisson,
        motion: event.motion,
        brushId: event.brushId,
        toolOverrides: { ...event.toolOverrides },
        traceSeed: event.traceSeed,
        recordedOrder: event.recordedOrder,
        playFrame: event.playFrame,
        color: event.color,
        engine: { ...event.engine },
      }) } : {}),
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
    // A mid-burst enqueue throw is reported here, once the in-flight brushes
    // have drained, so the message reflects the real completed count. Any
    // accepted brush makes it a partial failure; a first-brush throw keeps the
    // enqueue-failed contract.
    if (!operation.failure && operation.enqueueFailureCause !== null) {
      const acceptedAny = operation.expectedMutationIds.size > 0;
      operation.failure = operationError(
        'apply',
        acceptedAny ? 'apply-partial-failure' : 'apply-enqueue-failed',
        acceptedAny
          ? `Apply Script stopped after ${operation.completed} of ${operation.script.brushes.length} brushes`
          : 'Apply Script could not enqueue its first brush',
        operation.enqueueFailureCause,
      );
    }
    const complete = async () => {
      let applied = success && !operation.cancelled;
      try {
        if (applied) await ports.flushSourcePublication?.(operation.destinationAppFrame);
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
      primary: fromStudioStroke(transformRecordedStrokeForHeldPose(toStudioStroke(brush.primary), {
        destinationSourceFrame: operation.destinationAppFrame,
        strokeIndex: brushIndex,
        deformation: motion.deformation,
        position: motion.position,
      })),
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
        keyId: operation.destinationKeyId,
        appFrame: operation.destinationAppFrame,
        publishPixels: operation.nextBrushIndex === operation.script.brushes.length,
        publicationIdentity: operation.publicationIdentity ?? undefined,
      });
    } catch (cause) {
      // Stop the burst at the first throw; the error itself is materialized in
      // finishApply so its counts include the in-flight brushes. A burst can
      // leave those brushes running — their completions close the operation
      // instead of finishing past them. Nothing in flight → close now.
      operation.enqueueFailureCause = cause;
      if (operation.expectedMutationIds.size === operation.consumedMutationIds.size) finishApply(operation, false);
    }
  }

  function discardScript(): void {
    if (disposed || disposalRequested || busy.peek()) return;
    clipboard.value = null;
    status.value = null;
    error.value = null;
  }

  async function applyScript(): Promise<boolean> {
    if (disposed || disposalRequested || !availability.value.canApply) return false;
    const engine = engineState.peek();
    const script = clipboard.value;
    const source = sourceState.value;
    if (!engine || !script || source.selectionKind === 'generated-interpolation') return false;
    error.value = null;
    beginOperation(engine);
    return dispatchApply(script, source, engine);
  }

  /**
   * 261022-pim: Apply the LIVE captured script (the Alt+click delete re-bake).
   * Same gates as copy — a real-key source with recorded strokes, not busy,
   * not disposed — but no clipboard requirement: the script is captured from
   * the current engine exactly like captureScriptForPersistence and dispatched
   * through the shared pipeline. The reusable clipboard is never written.
   */
  async function applyCurrentScript(): Promise<boolean> {
    if (disposed || disposalRequested) return false;
    const engine = engineState.peek();
    if (!engine) return false;
    const source = sourceState.peek();
    if (source.selectionKind === 'generated-interpolation') return false;
    refreshSourceHasBrushes(engine);
    if (!sourceHasBrushes.value || busy.peek()) return false;
    const acceptedEngineGeneration = engineGeneration;
    const acceptedLaunchGeneration = launchGeneration;
    error.value = null;
    beginOperation(engine);
    let dispatched = false;
    try {
      await drainAcceptedMutations(engine);
      await ports.flushSourcePublication?.(source.appFrame);
      if (
        disposed
        || disposalRequested
        || engineState.peek() !== engine
        || engineGeneration !== acceptedEngineGeneration
        || launchGeneration !== acceptedLaunchGeneration
      ) {
        return false;
      }
      const brushes = normalizeLogicalBrushes(engine.getStrokes());
      if (brushes.length === 0) return false;
      const aquarelleEvents = buildAquarelleEventsFromCapture(brushes);
      if (!aquarelleEvents || !ports.applyAquarelleEvents) {
        status.value = 'Failed';
        error.value = operationError(
          'apply',
          'apply-partial-failure',
          'Apply Current Script requires a fully recorded watercolor script.',
        );
        return false;
      }
      const script = deepFreezeScript({
        provenance: provenanceFor(source),
        sourceFrame: source.appFrame,
        sourceDisplayFrame: source.appFrame,
        sourceRevision: sourceRevision + 1,
        brushes,
        aquarelleEvents,
      });
      // Dispatch owns its own endOperation — skip the failure-path release.
      dispatched = true;
      return await dispatchApply(script, source, engine, { forceAquarelle: true });
    } catch (cause) {
      if (!disposalRequested && launchGeneration === acceptedLaunchGeneration) {
        status.value = 'Failed';
        error.value = operationError(
          'apply',
          'apply-partial-failure',
          'Apply Current Script could not capture the recorded strokes.',
          cause,
        );
      }
      return false;
    } finally {
      if (!dispatched) endOperation(engine);
    }
  }

  /**
   * 261022-pim: re-bake a recorded aquarelle timeline for the current source.
   *
   * Delete must not depend on the live engine's guide strokes: a completed
   * Apply refreshes the display and the engine no longer holds them, so a
   * second delete captured nothing and refused silently. The recorded payload
   * timeline IS the script — build the dispatch from it directly and reuse
   * the same `dispatchApply` bake/publish/progress path.
   *
   * Only the source gates apply here; there is no brush capture and no
   * clipboard write. An empty list is legal (every stroke deleted) and bakes
   * a blank sheet through the aquarelle branch.
   */
  async function applyAquarelleTimeline(
    events: readonly AquarellePayloadEvent[],
  ): Promise<boolean> {
    if (disposed || disposalRequested) return false;
    const engine = engineState.peek();
    if (!engine) return false;
    const source = sourceState.peek();
    if (source.selectionKind === 'generated-interpolation') return false;
    if (busy.peek() || !ports.applyAquarelleEvents) return false;
    const acceptedEngineGeneration = engineGeneration;
    const acceptedLaunchGeneration = launchGeneration;
    error.value = null;
    beginOperation(engine);
    let dispatched = false;
    try {
      await ports.flushSourcePublication?.(source.appFrame);
      if (
        disposed
        || disposalRequested
        || engineState.peek() !== engine
        || engineGeneration !== acceptedEngineGeneration
        || launchGeneration !== acceptedLaunchGeneration
      ) {
        return false;
      }
      // deepFreezeScript freezes every event it receives — clone first so the
      // live payload timeline (and its in-place cuisson patches) stays mutable.
      const eventsForScript = events.map((event) => isAquarelleDryEvent(event)
        ? { ...event }
        : {
            ...event,
            pts: event.pts.map((point) => ({ ...point })),
            engine: { ...event.engine },
          });
      const script = deepFreezeScript({
        provenance: provenanceFor(source),
        sourceFrame: source.appFrame,
        sourceDisplayFrame: source.appFrame,
        sourceRevision: sourceRevision + 1,
        brushes: [],
        aquarelleEvents: eventsForScript,
      });
      dispatched = true;
      return await dispatchApply(script, source, engine, { forceAquarelle: true });
    } catch (cause) {
      if (!disposalRequested && launchGeneration === acceptedLaunchGeneration) {
        status.value = 'Failed';
        error.value = operationError(
          'apply',
          'apply-partial-failure',
          'Apply Aquarelle Timeline could not replay the recorded strokes.',
          cause,
        );
      }
      return false;
    } finally {
      if (!dispatched) endOperation(engine);
    }
  }

  /**
   * 261023-cxc: Duplicate's script path. Apply a script captured from the
   * SOURCE key at the CURRENT source (the promoted duplicate destination).
   * Same ownership and dispatch as `applyCurrentScript`, but no clipboard
   * read, no clipboard write, and no engine capture — the transient script
   * lives only in the duplicate sequence's closure.
   */
  async function applyProvidedScript(script: RotoPaintScript): Promise<boolean> {
    if (disposed || disposalRequested) return false;
    const engine = engineState.peek();
    if (!engine) return false;
    const source = sourceState.peek();
    if (source.selectionKind === 'generated-interpolation') return false;
    if (busy.peek()) return false;
    // A zero-brush engine-1 dispatch would open an operation no completion can
    // settle (it would latch `busy` forever). The aquarelle branch is the one
    // legal empty-brush dispatch.
    const usesAquarelle = Boolean(
      script.aquarelleEvents
      && script.aquarelleEvents.length > 0
      && ports.applyAquarelleEvents,
    );
    if (!usesAquarelle && script.brushes.length === 0) return false;
    error.value = null;
    // dispatchApply owns endOperation on every exit.
    beginOperation(engine);
    return dispatchApply(script, source, engine);
  }

  /**
   * 261022-pim: the ONE shared Apply dispatch. Apply Script (clipboard) and
   * Apply Current Script (live capture after a delete) both land here, so the
   * bake, the progress pill, publication and display reconcile cannot drift.
   * `options.forceAquarelle` keeps a fully-deleted watercolor script on the
   * aquarelle path (an empty event list must bake a blank sheet, never fall
   * back to the engine-1 brush burst and repaint deleted guides).
   */
  async function dispatchApply(
    script: RotoPaintScript,
    source: RotoScriptSourceSnapshot,
    engine: RotoScriptEnginePort,
    options?: { forceAquarelle?: boolean },
  ): Promise<boolean> {
    const acceptedEngineGeneration = engineGeneration;
    const acceptedLaunchGeneration = launchGeneration;
    let target: RotoScriptPhysicalTarget | null = null;
    try {
      target = await ports.prepareTarget(source);
    } catch (cause) {
      status.value = 'Failed';
      error.value = operationError('apply', 'apply-empty-target-failed', 'Apply Script could not prepare the physical destination', cause);
    }
    const currentSource = sourceState.peek();
    const targetIsCurrent = Boolean(
      target
      && target.appFrame === source.appFrame
      && currentSource.layerId === source.layerId
      && currentSource.appFrame === target.appFrame
      && currentSource.selectionKind !== 'generated-interpolation'
      // 261026 axis 1: compare the PROJECTION identity. On an override frame
      // the publish key is the override key while the mounted source keeps the
      // underlying source key; a navigation/source change still refuses.
      && (currentSource.selectionKind !== 'real-key' || currentSource.keyId === (target.sourceKeyId ?? target.keyId)),
    );
    if (
      !target
      || !targetIsCurrent
      || disposed
      || disposalRequested
      || engineState.peek() !== engine
      || engineGeneration !== acceptedEngineGeneration
      || launchGeneration !== acceptedLaunchGeneration
    ) {
      if (!error.peek()) {
        status.value = 'Failed';
        error.value = operationError('apply', 'apply-empty-target-failed', 'Apply Script could not prepare the destination as an accepted physical Roto key.');
      }
      endOperation(engine);
      return false;
    }

    // 261018: aquarelle scripts replay through the aquarelle engine (wash,
    // bleed, granulation), not engine-1 (which draws only the guide line).
    // 261022-pim: a DEFINED event list stays aquarelle even when empty (all
    // strokes deleted) — forceAquarelle is set by the live-capture channel.
    const aquarelleEvents = script.aquarelleEvents;
    if (
      aquarelleEvents
      && ports.applyAquarelleEvents
      && (aquarelleEvents.length > 0 || options?.forceAquarelle)
    ) {
      // 261022: the aquarelle Apply bake runs ONE output frame, so the pill
      // must advance per FULLY FED STROKE — the same 0/N → N/N report brush
      // mode drives. Dry events are timeline actions, never progress (D-15).
      const aquarelleStrokeTotal = countAquarelleStrokeEvents(aquarelleEvents);
      let progressSettled = false;
      const publishAquarelleProgress = (completed: number, total: number): void => {
        // AQUA-07: the bake survives navigation, so a progress callback can
        // land after the launch was replaced or the Studio disposed. Those
        // must never write the pill or the status line.
        if (progressSettled || disposed || disposalRequested || launchGeneration !== acceptedLaunchGeneration) return;
        if (!Number.isFinite(completed)) return;
        const reportedTotal = Number.isFinite(total) && total > 0 ? Math.trunc(total) : aquarelleStrokeTotal;
        if (reportedTotal <= 0) return;
        const clamped = Math.min(reportedTotal, Math.max(0, Math.trunc(completed)));
        applyProgressState.value = { completed: clamped, total: reportedTotal };
        status.value = `Applying ${clamped}/${reportedTotal}`;
      };
      if (aquarelleStrokeTotal > 0) {
        applyProgressState.value = { completed: 0, total: aquarelleStrokeTotal };
        status.value = `Applying 0/${aquarelleStrokeTotal}`;
      } else {
        status.value = 'Applying';
      }
      try {
        const ok = await ports.applyAquarelleEvents({
          events: aquarelleEvents,
          target,
          onProgress: publishAquarelleProgress,
        });
        if (!disposalRequested && launchGeneration === acceptedLaunchGeneration) {
          status.value = ok ? 'Applied' : 'Failed';
          if (!ok) error.value = operationError('apply', 'apply-partial-failure', 'Apply Script could not paint the aquarelle wash.');
          else error.value = null;
        }
        endOperation(engine);
        return ok;
      } catch (cause) {
        if (!disposalRequested && launchGeneration === acceptedLaunchGeneration) {
          status.value = 'Failed';
          error.value = operationError('apply', 'apply-partial-failure', 'Apply Script could not paint the aquarelle wash.', cause);
        }
        endOperation(engine);
        return false;
      } finally {
        // Unconditional: a stale pill must never survive the operation
        // (brush-mode finishApply clears the signal the same way).
        progressSettled = true;
        applyProgressState.value = null;
      }
    }

    applyProgressState.value = { completed: 0, total: script.brushes.length };
    status.value = `Applying 0/${script.brushes.length}`;
    return new Promise((resolve) => {
      let settleOperation = () => {};
      const settled = new Promise<void>((settle) => { settleOperation = settle; });
      const operation: ActiveApplyOperation = {
        id: acceptedEngineGeneration,
        engine,
        launchGeneration: acceptedLaunchGeneration,
        script,
        destinationKeyId: target.keyId,
        destinationAppFrame: target.appFrame,
        publicationIdentity: ports.getPublicationIdentity?.() ?? null,
        expectedMutationIds: new Set(),
        consumedMutationIds: new Set(),
        completed: 0,
        nextBrushIndex: 0,
        cancelled: false,
        cancellationReason: null,
        failure: null,
        enqueueFailureCause: null,
        publishUi: true,
        finishing: false,
        settled,
        settle: settleOperation,
        resolve,
      };
      activeApply = operation;
      // The whole burst enqueues up front: the engine's scripted-stroke
      // coalescing (allScripted → bounded multi-stroke flush turns) drains the
      // queue, so Apply paints in fast multi-stroke bursts instead of pacing
      // one brush per completion round-trip. The loop stops on
      // invalidation/failure via enqueueNextBrush's own guards.
      while (
        activeApply === operation
        && !operation.cancelled
        && !operation.enqueueFailureCause
        && operation.nextBrushIndex < operation.script.brushes.length
      ) {
        enqueueNextBrush(operation);
      }
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
      // Every brush was enqueued up front — finish once all expected mutations
      // are consumed. This also closes mid-burst invalidation/enqueue
      // failures: their in-flight completions still land here and end the
      // operation.
      if (operation.consumedMutationIds.size === operation.expectedMutationIds.size) {
        finishApply(operation, !operation.cancelled && !operation.failure && operation.completed === operation.script.brushes.length);
      }
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
    if (targetFrame === sourceState.peek().appFrame) return true;
    const engine = engineState.peek();
    if (!engine) return true;
    navigationLockHeld = true;
    navigationLockEngine = engine;
    beginOperation(engine);
    return true;
  }

  function completeNavigation(): void {
    if (!navigationLockHeld) return;
    navigationLockHeld = false;
    // I-09: release the lease on the engine that TOOK it — never on
    // engineState.peek(), which can be null after an engine swap/detach and
    // used to skip endOperation entirely (busy stuck true forever).
    // endOperation tolerates a null engine so the busy lease always drops.
    endOperation(navigationLockEngine ?? engineState.peek());
    navigationLockEngine = null;
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
      await ports.flushSourcePublication?.(operation.destinationAppFrame);
      return;
    }
    const engine = engineState.peek();
    const source = sourceState.peek();
    if (engine && (engine.getStrokeCount?.() ?? engine.getStrokes().length) > 0) await drainAcceptedMutations(engine);
    await ports.flushSourcePublication?.(source.appFrame);
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
    await ports.flushSourcePublication?.(source.appFrame);
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
    source: sourceState,
    hasCopiedScript,
    copiedAppFrame,
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
    applyCurrentScript,
    applyAquarelleTimeline,
    applyProvidedScript,
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

/** 261022: Apply progress denominator — stroke events only, Dry excluded. */
function countAquarelleStrokeEvents(events: readonly AquarellePayloadEvent[]): number {
  let count = 0;
  for (const event of events) {
    if (!isAquarelleDryEvent(event)) count += 1;
  }
  return count;
}

function cloneStroke(stroke: Readonly<PaintStroke>): PaintStroke {
  return { ...stroke, points: stroke.points.map((point) => ({ ...point })), params: { ...stroke.params } };
}

function deepFreezeScript(script: RotoPaintScript): RotoPaintScript {
  Object.freeze(script.provenance);
  // 261023-g4p: the brush half of the freeze is the ONE shared helper.
  script.brushes = freezeRecordedStrokeGroups(script.brushes);
  if (script.aquarelleEvents) {
    for (const event of script.aquarelleEvents) {
      if (!isAquarelleDryEvent(event)) {
        Object.freeze(event.pts);
        Object.freeze(event.engine);
      }
      Object.freeze(event);
    }
    Object.freeze(script.aquarelleEvents);
  }
  return Object.freeze(script);
}

/**
 * 261018-odm: build the aquarelle payload timeline from the captured
 * primaries. Returns undefined when any primary lacks a recorded
 * AquarelleStroke (mixed key) so the engine-1 serialize path stays.
 */
function buildAquarelleEventsFromCapture(brushes: readonly Readonly<RecordedStrokeGroup>[]): AquarellePayloadEvent[] | undefined {
  const captured = new Set<number>();
  for (const brush of brushes) {
    const chain = [brush.primary, ...(brush.continuations ?? [])];
    for (const stroke of chain) {
      const mutationId = stroke.mutationId;
      const recorded = mutationId !== undefined ? getRecordedAquarelleStroke(mutationId) : undefined;
      // Presence gate law: a missing record means a MIXED engine-1 key — the
      // serialize path must stay engine-1. A deleted stroke is different: its
      // record is present (presence stays true) but it is removed from the
      // script by the marker, so it is skipped in the projection below WITHOUT
      // tripping the fallback.
      if (!recorded) return undefined;
      if (mutationId !== undefined) captured.add(mutationId);
    }
  }

  // 261022-ujp: project in LIVE PAYLOAD-TIMELINE order, not engine capture
  // order. A stroke stack step reorders the timeline; inheriting the engine's
  // acceptance order here would silently undo the user's stacking on Apply
  // Script and Save. Dry events ride at their exact timeline position (they
  // are sheet actions, not captured strokes). The captured brush set only
  // decides WHICH strokes are projected.
  const projected: AquarellePayloadEvent[] = [];
  for (const event of getRecordedAquarellePayloadTimeline()) {
    if (isAquarelleDryEvent(event)) {
      projected.push(event);
      continue;
    }
    const mutationId = (event.engine as { mutationId?: number }).mutationId;
    if (mutationId === undefined || !captured.has(mutationId)) continue;
    if (isAquarelleStrokeDeleted(mutationId)) continue;
    const recorded = getRecordedAquarelleStroke(mutationId);
    if (!recorded) continue;
    projected.push(aquarelleToStudioStroke(recorded));
  }
  return projected;
}
