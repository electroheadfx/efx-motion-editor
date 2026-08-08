import { computed, effect, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type {
  PhysicPaintLaunchContext,
  PhysicPaintRotoAuthorityResult,
  PhysicPaintRotoCacheFrame,
  PhysicPaintRotoPhysicalEditRecord,
  PhysicPaintRotoPhysicalEditSemanticDelta,
} from '../../../types/physicPaint';
import type { RotoScriptLibraryController } from './physicsPaintRotoScriptLibrary';
import {
  createPhysicPaintRotoKeyId,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  type PhysicPaintRotoKeyIdentity,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { derivePhysicPaintRotoLoopRanges, derivePhysicPaintRotoLoopShortenPreflight } from './physicsPaintRotoPhysicalResolver';
import type { RotoTimelineSelectionKind } from './rotoTimelineSelectors';
import { renderRotoPlayScriptFrames } from './physicsPaintRotoPlayScriptRenderer';
import { isRotoPngDataUrl } from './rotoCanvasFrames';

export type RotoPlayScriptPhase = 'idle' | 'preparing' | 'rendering' | 'committing' | 'regenerating' | 'complete' | 'cancelled' | 'failed';

export type RotoPlayScriptMode = 'progressive' | 'static';

/** 43-06 dialog modes (D-01/D-02): apply is the Phase 42 generation surface. */
export type RotoPlayScriptDialogMode = 'apply' | 'loop-edit' | 'source-edit';

/** Uniform result for the atomic loop ops — a rejection always names its reason. */
export interface RotoPlayScriptLoopOpResult {
  readonly ok: boolean;
  readonly reason: string | null;
}

/** Accepted child-side facts sufficient to open Loop Edit without parent authority. */
export interface RotoPlayScriptLoopEditSnapshot {
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
  readonly physicalCapacity: number;
  readonly layerEndExclusive: number;
  readonly remainingCapacity: number;
}

/** S4 match result (D-05, Q2): the existing identical source cycle. */
export interface RotoPlayScriptIdenticalSourceCycle {
  readonly sourceKeyIds: readonly string[];
  readonly loopCount: number;
  readonly sourceStart: number;
}

export type RotoPlayScriptSemanticDelta = Extract<
  PhysicPaintRotoPhysicalEditSemanticDelta,
  { readonly kind: 'play-script' }
>;

export interface RotoPlayScriptPhysicalPublication {
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly expectedRevision: string;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolationEnabled: boolean;
  readonly interpolationMode: PhysicPaintRotoAuthorityResult['interpolationMode'];
  readonly semanticDelta: RotoPlayScriptSemanticDelta;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
  /**
   * Complete staged Loop Clip collection (43-06). Present exactly when the op
   * changes loop state (apply-time loop creation, Update/Unlink/Duplicate/
   * Repair/Relink); absent preserves the layer's current collection.
   */
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
}

export type RotoPlayScriptCommitResult =
  | {
      readonly ok: true;
      readonly operationId: string;
      readonly acceptedRevision: string;
      readonly records: readonly PhysicPaintRotoRealKeyRecord[];
      readonly interpolationMode: PhysicPaintRotoAuthorityResult['interpolationMode'];
      readonly selectedKeyId: string | null;
      readonly selectedAppFrame: number | null;
      /** Echo of the submitted loopClips collection when the publication carried one. */
      readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
    }
  | { readonly ok: false; readonly error: string };

/** Q2 matching input for the S4 identical-source-cycle query. */
export interface RotoPlayScriptSourceCycleMatchInput {
  readonly scriptId: string;
  readonly mode: RotoPlayScriptMode;
  readonly cycleLength: number;
  readonly motion: { readonly deformation: number; readonly position: number };
  readonly overrideColor: string | null;
  readonly start: number;
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
}

export interface RotoPlayScriptControllerPorts {  library: RotoScriptLibraryController;
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  getSelection: () => { kind: RotoTimelineSelectionKind; keyId: string | null; appFrame: number };
  getMotion: () => { deformation: number; position: number };
  // D-08R: the ONLY override-color resolution path — reads the live Studio brush color
  // (settings.color; sole writer setBrushColor). Read at confirm time and at the first-open
  // summary compose; the value is never stored dialog-side (D-10/D-18).
  getBrushColor: () => string;
  getOperationLocked: () => boolean;
  getSize: () => { width: number; height: number };
  /**
   * Phase 43 (D-06): durable Loop Clip collection for the preflight shorten
   * warning. Absent port = pre-43 empty collection (no warning ever).
   */
  getRotoLoopClips?: () => readonly PhysicPaintRotoLoopClip[];
  /** Accepted local document snapshot used only to open Loop Edit immediately. */
  getLoopEditSnapshot?: (placementStart: number) => RotoPlayScriptLoopEditSnapshot | null;
  availabilityRevision?: ReadonlySignal<number>;
  requestAuthority: (operationId: string, start: number) => Promise<PhysicPaintRotoAuthorityResult>;
  commit: (publication: RotoPlayScriptPhysicalPublication) => Promise<RotoPlayScriptCommitResult>;
  stopPlayback: () => void;
  log: (message: string, error?: boolean) => void;
}

export interface RotoPlayScriptController {
  confirmationOpen: Signal<boolean>;
  countText: Signal<string>;
  capacity: Signal<number>;
  mode: Signal<RotoPlayScriptMode>;
  overrideEnabled: Signal<boolean>;
  dialogMotion: Signal<{ deformation: number; position: number }>;
  repeatText: Signal<string>;
  infinity: Signal<boolean>;
  lastFiniteRepeat: Signal<string>;
  layerEndExclusive: Signal<number | null>;
  parsedRepeat: ReadonlySignal<{ count: number | null; error: string | null }>;
  repeatError: ReadonlySignal<string | null>;
  loopReadout: ReadonlySignal<string | null>;
  /**
   * D-06 preflight shorten warning: the locked line
   * `This operation will shorten {N} linked loop(s), starting at frame {F}.`
   * when the pending destination range intersects an existing loop's effective
   * range; null otherwise. Advisory only — confirm never blocks on it.
   */
  loopShortenPreflight: ReadonlySignal<string | null>;
  appliedSummary: { line1: Signal<string>; line2: Signal<string> };
  destinationRange: ReadonlySignal<string | null>;
  validationError: ReadonlySignal<string | null>;
  disabledReason: ReadonlySignal<string | null>;
  phase: Signal<RotoPlayScriptPhase>;
  progress: Signal<{ completed: number; total: number } | null>;
  status: Signal<string | null>;
  error: Signal<string | null>;
  canCancel: ReadonlySignal<boolean>;
  // --- 43-06 loop modes and loop ops (D-01/D-02/D-03/D-05/D-10/D-31) ---
  /** Active dialog mode; 'apply' is the Phase 42 generation surface. */
  dialogMode: Signal<RotoPlayScriptDialogMode>;
  /** Target Loop Clip identity for loop-edit/source-edit; null in apply mode. */
  loopEditTargetId: Signal<string | null>;
  /** The resolved target record from the durable collection (null when absent). */
  loopEditTarget: ReadonlySignal<PhysicPaintRotoLoopClip | null>;
  /** Resolved first source-key frame of the target loop; null when dangling. */
  loopEditSourceStart: ReadonlySignal<number | null>;
  /** Loops sharing the target's source cycle (target included) — the S3 {N}. */
  sourceEditSharedLoopCount: ReadonlySignal<number>;
  /** True when the apply draft expresses loop intent (repeat > 1 or Infinity). */
  loopIntentActive: ReadonlySignal<boolean>;
  /** S4 match — non-null only in apply mode with loop intent and an identical cycle. */
  identicalSourceCycle: ReadonlySignal<RotoPlayScriptIdenticalSourceCycle | null>;
  /** S4 selection; consulted only when identicalSourceCycle is non-null. */
  linkChoice: Signal<'link' | 'create'>;
  openLoopEdit: (loopId: string) => Promise<RotoPlayScriptLoopOpResult>;
  openSourceEdit: (loopId: string) => Promise<RotoPlayScriptLoopOpResult>;
  repairLoop: (loopId: string) => Promise<RotoPlayScriptLoopOpResult>;
  updateLoop: () => Promise<boolean>;
  unlinkLoop: (loopId: string) => Promise<RotoPlayScriptLoopOpResult>;
  duplicateLinkedLoop: (loopId: string, destinationStart: number) => Promise<RotoPlayScriptLoopOpResult>;
  relinkLoop: (loopId: string, targetKeyIds: readonly string[]) => Promise<RotoPlayScriptLoopOpResult>;
  findIdenticalSourceCycle: (input: RotoPlayScriptSourceCycleMatchInput) => RotoPlayScriptIdenticalSourceCycle | null;
  openConfirmation: () => Promise<void>;
  closeConfirmation: () => void;
  confirm: () => Promise<boolean>;
  cancel: () => void;
  setInfinity: (enabled: boolean) => void;
  resetDialogMotion: () => void;
  dispose: () => void;
}

export function createRotoPlayScriptController(ports: RotoPlayScriptControllerPorts): RotoPlayScriptController {
  const confirmationOpen = signal(false);
  const countText = signal('Max');
  const capacity = signal(0);
  const canonicalStart = signal<number | null>(null);
  const mode = signal<RotoPlayScriptMode>('progressive');
  const overrideEnabled = signal(false);
  const dialogMotion = signal<{ deformation: number; position: number }>({ deformation: 0, position: 0 });
  const repeatText = signal('1');
  const infinity = signal(false);
  const lastFiniteRepeat = signal('1');
  const layerEndExclusive = signal<number | null>(null);
  const appliedSummaryLine1 = signal('Progressive · Original colors · Motion 0/0');
  const appliedSummaryLine2 = signal('No frames generated yet');
  let hasSuccessfulGeneration = false;
  const phase = signal<RotoPlayScriptPhase>('idle');
  const progress = signal<{ completed: number; total: number } | null>(null);
  const status = signal<string | null>(null);
  const error = signal<string | null>(null);
  // 43-06 loop modes (D-01/D-02): apply is the default Phase 42 surface.
  const dialogMode = signal<RotoPlayScriptDialogMode>('apply');
  const loopEditTargetId = signal<string | null>(null);
  const sourceEditRepairId = signal<string | null>(null);
  const linkChoice = signal<'link' | 'create'>('link');
  let generation = 0;
  let abortController: AbortController | null = null;
  let disposed = false;

  const disabledReason = computed(() => {
    ports.availabilityRevision?.value;
    if (!ports.library.selected.value) return 'Select a project script first.';
    if (ports.library.busy.value) return 'Finish the current script library operation.';
    if (ports.getOperationLocked() || isBusyPhase(phase.value)) return 'Finish the current Roto operation.';
    const context = ports.getLaunchContext();
    if (!context?.project?.saved) return 'Save the project first.';
    const selection = ports.getSelection();
    if (selection.kind === 'generated-interpolation') return `Generated frame ${selection.appFrame} is render-only. Select an empty frame or a real Roto key to generate a Play Script.`;
    return null;
  });
  const parsedCount = computed(() => parseCount(countText.value, capacity.value));
  const validationError = computed(() => parsedCount.value.error);
  const destinationRange = computed(() => {
    const start = canonicalStart.value;
    const count = parsedCount.value.count;
    return start === null || count === null ? null : `F${start}–F${start + count - 1}`;
  });
  const canCancel = computed(() => phase.value === 'preparing' || phase.value === 'rendering');
  const parsedRepeat = computed(() => parseRepeat(repeatText.value, parsedCount.value.count));
  const repeatError = computed(() => (infinity.value ? null : parsedRepeat.value.error));
  // D-06 preflight substrate: the authority snapshot captured at dialog open.
  // confirm() revalidates the physical revision before commit, so this
  // snapshot is guaranteed current whenever the warning is shown.
  const loopPreflightSnapshot = signal<{
    readonly identities: readonly PhysicPaintRotoKeyIdentity[];
    readonly parentEndExclusive: number;
    readonly capacity: number;
  } | null>(null);
  const loopShortenPreflight = computed(() => {
    const snapshot = loopPreflightSnapshot.value;
    const start = canonicalStart.value;
    const count = parsedCount.value.count;
    if (snapshot === null || start === null || count === null) return null;
    const loopClips = ports.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
    if (loopClips.length === 0) return null;
    // Pitfall 4: the warning derives ONLY from the shared 43-02 interval
    // derivation — never controller-local boundary math.
    const preflight = derivePhysicPaintRotoLoopShortenPreflight({
      identities: snapshot.identities,
      loopClips,
      parentEndExclusive: snapshot.parentEndExclusive,
      capacity: snapshot.capacity,
      destinationStart: start,
      destinationCount: count,
    });
    if (preflight === null) return null;
    return `This operation will shorten ${preflight.affectedLoopCount} linked loop(s), starting at frame ${preflight.earliestShortenFrame}.`;
  });
  const loopReadout = computed(() => {
    // 43-06 (Pitfall 4): loop-edit mode derives Requested/Effective from the
    // shared 43-02 interval derivation with the DRAFT repeat substituted —
    // never controller-local boundary math.
    if (dialogMode.value === 'loop-edit') {
      const target = loopEditTarget.value;
      const snapshot = loopPreflightSnapshot.value;
      if (!target || !snapshot) return null;
      const cycle = target.sourceKeyIds.length;
      const draftRepeat: number | 'infinity' | null = infinity.value ? 'infinity' : parsedRepeat.value.count;
      if (draftRepeat === null) return null;
      const loopClips = currentLoopClips().map((clip) => (clip.loopId === target.loopId ? { ...clip, repeat: draftRepeat } : clip));
      const context = derivePhysicPaintRotoLoopRanges({
        identities: snapshot.identities,
        loopClips,
        parentEndExclusive: snapshot.parentEndExclusive,
        capacity: snapshot.capacity,
      });
      const range = context.ranges.find((entry) => entry.loopId === target.loopId);
      if (!range) return null;
      const effective = range.effectiveEnd - range.placementStart;
      if (draftRepeat === 'infinity') return `Cycle ${cycle}f × ∞ · Effective: ${effective}f`;
      const requested = cycle * draftRepeat;
      return range.truncated
        ? `Requested: ${requested}f (${cycle}f × ${draftRepeat}) · Effective: ${effective}f — shortened by the next clip`
        : `Requested: ${requested}f (${cycle}f × ${draftRepeat}) · Effective: ${effective}f`;
    }
    const cycle = parsedCount.value.count;
    const start = canonicalStart.value;
    const layerEnd = layerEndExclusive.value;
    if (cycle === null || start === null || layerEnd === null) return null;
    const boundary = layerEnd - start;
    if (infinity.value) return `Cycle ${cycle}f × ∞ · Effective: ${boundary}f`;
    const repeat = parsedRepeat.value.count;
    if (repeat === null) return null;
    const requested = cycle * repeat;
    const effective = Math.min(requested, boundary);
    return effective === requested
      ? `Requested: ${requested}f (${cycle}f × ${repeat}) · Effective: ${requested}f`
      : `Requested: ${requested}f (${cycle}f × ${repeat}) · Effective: ${effective}f — shortened by the next clip`;
  });

  // --- 43-06 loop-mode computeds ---
  const loopEditTarget = computed(() => {
    const id = loopEditTargetId.value;
    if (!id) return null;
    return currentLoopClips().find((clip) => clip.loopId === id) ?? null;
  });
  const loopEditSourceStart = computed(() => {
    const target = loopEditTarget.value;
    const snapshot = loopPreflightSnapshot.value;
    if (!target || !snapshot) return null;
    const identity = snapshot.identities.find((entry) => entry.keyId === target.sourceKeyIds[0]);
    return identity ? identity.appFrame : null;
  });
  const sourceEditSharedLoopCount = computed(() => {
    const target = loopEditTarget.value;
    if (!target) return 0;
    return currentLoopClips().filter((clip) => sameOrderedIds(clip.sourceKeyIds, target.sourceKeyIds)).length;
  });
  const loopIntentActive = computed(() => infinity.value || (parsedRepeat.value.count !== null && parsedRepeat.value.count > 1));
  const identicalSourceCycle = computed<RotoPlayScriptIdenticalSourceCycle | null>(() => {
    if (dialogMode.value !== 'apply' || !loopIntentActive.value) return null;
    const selectedId = ports.library.selectedId.value;
    const start = canonicalStart.value;
    const cycleLength = parsedCount.value.count;
    const snapshot = loopPreflightSnapshot.value;
    if (!selectedId || start === null || cycleLength === null || !snapshot) return null;
    const draftOverride = overrideEnabled.value ? normalizeBrushColor(ports.getBrushColor()) : null;
    return findIdenticalSourceCycle({
      scriptId: selectedId,
      mode: mode.value,
      cycleLength,
      motion: dialogMotion.value,
      overrideColor: draftOverride,
      start,
      loopClips: currentLoopClips(),
      identities: snapshot.identities,
    });
  });

  function currentLoopClips(): readonly PhysicPaintRotoLoopClip[] {
    return ports.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  }

  function findIdenticalSourceCycle(input: RotoPlayScriptSourceCycleMatchInput): RotoPlayScriptIdenticalSourceCycle | null {
    const frameByKeyId = new Map(input.identities.map((entry) => [entry.keyId, entry.appFrame]));
    const motionZero = input.motion.deformation === 0 && input.motion.position === 0;
    for (const clip of input.loopClips) {
      if (clip.scriptId === undefined || !clip.motion) continue; // no provenance → never matches
      if (clip.scriptId !== input.scriptId) continue;
      if (clip.mode !== input.mode) continue;
      if (clip.sourceKeyIds.length !== input.cycleLength) continue;
      if (clip.motion.deformation !== input.motion.deformation || clip.motion.position !== input.motion.position) continue;
      if ((clip.overrideColor ?? null) !== input.overrideColor) continue;
      const frames = clip.sourceKeyIds.map((keyId) => frameByKeyId.get(keyId));
      if (frames.some((frame) => frame === undefined)) continue; // never link to an unresolved cycle
      const sourceStart = frames[0]!;
      // Pitfall 6: with Motion nonzero the held-pose transform is seeded by the
      // absolute destination frame, so only a cycle generated AT this start is
      // pixel-identical; with Motion 0/0 the transform is identity.
      if (!motionZero && sourceStart !== input.start) continue;
      const loopCount = input.loopClips.filter((candidate) => sameOrderedIds(candidate.sourceKeyIds, clip.sourceKeyIds)).length;
      return { sourceKeyIds: Object.freeze([...clip.sourceKeyIds]), loopCount, sourceStart };
    }
    return null;
  }

  // D-15: first-time Static / Hold defaults apply once per session; later mode switches keep session values.
  let staticDefaultsApplied = false;
  const stopStaticDefaults = effect(() => {
    if (mode.value === 'static' && !staticDefaultsApplied) {
      staticDefaultsApplied = true;
      countText.value = '1';
      repeatText.value = '1';
      infinity.value = false;
    }
  });

  function setInfinity(enabled: boolean): void {
    if (enabled) {
      // Preserve the last VALID finite repeat; an invalid draft never overwrites it (Pitfall 7).
      if (parseRepeat(repeatText.peek(), parsedCount.peek().count).count !== null) lastFiniteRepeat.value = repeatText.peek();
      infinity.value = true;
    } else {
      repeatText.value = lastFiniteRepeat.peek();
      infinity.value = false;
    }
  }

  // D-06: the ONLY reset path the dialog calls — re-reads the CURRENT Motion defaults port; never writes anywhere.
  function resetDialogMotion(): void {
    dialogMotion.value = { ...ports.getMotion() };
  }

  // D-08R single resolution path: Original colors (override disabled) → null; Custom color →
  // the CURRENT brush-color port value, validated defensively (T-42-05-01) — a malformed port
  // value falls back to null (Original-colors behavior), mirroring existing input discipline.
  function resolveOverrideColor(): string | null {
    if (!overrideEnabled.peek()) return null;
    return normalizeBrushColor(ports.getBrushColor());
  }

  async function openConfirmation(): Promise<void> {
    if (disposed || disabledReason.peek()) return;
    ports.stopPlayback();
    const selected = ports.getSelection();
    const operationId = nextOperationId('authority');
    phase.value = 'preparing'; status.value = 'Preparing Play Script…'; error.value = null;
    try {
      const authority = await ports.requestAuthority(operationId, selected.appFrame);
      if (!authority.ok) throw new Error(authority.error ?? 'Parent authority is unavailable.');
      canonicalStart.value = authority.canonicalStart;
      capacity.value = authority.capacity;
      layerEndExclusive.value = authority.layerEndExclusive;
      loopPreflightSnapshot.value = {
        identities: authority.physicalRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        parentEndExclusive: authority.layerEndExclusive,
        capacity: authority.physicalCapacity,
      };
      // 43-06: every apply-mode open resets the loop-mode state.
      dialogMode.value = 'apply';
      loopEditTargetId.value = null;
      sourceEditRepairId.value = null;
      linkChoice.value = 'link';
      countText.value = 'Max';
      dialogMotion.value = { ...ports.getMotion() };
      if (!hasSuccessfulGeneration) {
        // First-time defaults refresh: before the first successful Generate line 1 tracks the
        // current defaults (mode/override untouched at first open, Motion from the defaults port,
        // override color resolved live from the brush-color port — D-08R).
        appliedSummaryLine1.value = composeSummaryLine1(mode.peek(), resolveOverrideColor(), dialogMotion.peek());
      }
      confirmationOpen.value = true;
      phase.value = 'idle'; status.value = `Max ${authority.capacity} · F${authority.canonicalStart}–F${authority.layerEndExclusive - 1}`;
    } catch (cause) { fail(cause); }
  }

  // --- 43-06 loop-edit / source-edit opens (D-01/D-02/D-31) ---

  function loopEditOpenGuard(): string | null {
    if (disposed) return 'The Play Script controller is disposed.';
    if (ports.library.busy.peek()) return 'Finish the current script library operation.';
    if (ports.getOperationLocked() || isBusyPhase(phase.peek())) return 'Finish the current Roto operation.';
    if (!ports.getLaunchContext()?.project) return 'The project context is unavailable.';
    return null;
  }

  function loopOpGuard(): string | null {
    if (disposed) return 'The Play Script controller is disposed.';
    if (ports.getOperationLocked() || isBusyPhase(phase.peek())) return 'Finish the current Roto operation.';
    const context = ports.getLaunchContext();
    if (!context?.project?.saved) return 'Save the project first.';
    return null;
  }

  function rejectLoopOp(reason: string): RotoPlayScriptLoopOpResult {
    phase.value = 'idle'; status.value = null;
    error.value = null;
    ports.log(reason, true);
    return { ok: false, reason };
  }

  /** Shared prefill for the two edit modes (D-01/D-02 locked field semantics). */
  function prefillEditMode(loop: PhysicPaintRotoLoopClip, snapshot: RotoPlayScriptLoopEditSnapshot, destination: number, mode_: RotoPlayScriptDialogMode, repair: boolean): void {
    loopPreflightSnapshot.value = {
      identities: snapshot.identities,
      parentEndExclusive: snapshot.layerEndExclusive,
      capacity: snapshot.physicalCapacity,
    };
    canonicalStart.value = destination;
    capacity.value = snapshot.remainingCapacity;
    layerEndExclusive.value = snapshot.layerEndExclusive;
    // mode first: the Static / Hold first-time defaults effect fires synchronously
    // on the mode write, so the prefill assignments below always land after it.
    mode.value = loop.mode;
    dialogMode.value = mode_;
    loopEditTargetId.value = loop.loopId;
    sourceEditRepairId.value = repair ? loop.loopId : null;
    linkChoice.value = 'link';
    countText.value = String(loop.sourceKeyIds.length);
    if (loop.motion) dialogMotion.value = { ...loop.motion };
    overrideEnabled.value = (loop.overrideColor ?? null) !== null;
    if (loop.repeat === 'infinity') {
      infinity.value = true; // repeatText keeps the preserved finite draft (Pitfall 7)
    } else {
      infinity.value = false;
      repeatText.value = String(loop.repeat);
      lastFiniteRepeat.value = String(loop.repeat);
    }
  }

  function snapshotFromAuthority(authority: PhysicPaintRotoAuthorityResult): RotoPlayScriptLoopEditSnapshot {
    return {
      identities: authority.physicalRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
      physicalCapacity: authority.physicalCapacity,
      layerEndExclusive: authority.layerEndExclusive,
      remainingCapacity: authority.capacity,
    };
  }

  async function openLoopEdit(loopId: string): Promise<RotoPlayScriptLoopOpResult> {
    const guard = loopEditOpenGuard();
    if (guard) return { ok: false, reason: guard };
    const loop = currentLoopClips().find((clip) => clip.loopId === loopId);
    if (!loop) return rejectLoopOp(`Loop Clip "${loopId}" no longer exists.`);
    const snapshot = ports.getLoopEditSnapshot?.(loop.placementStart) ?? null;
    if (!snapshot) return rejectLoopOp('The accepted local Roto physical document is unavailable.');
    ports.stopPlayback();
    phase.value = 'preparing'; status.value = 'Preparing Loop Clip…'; error.value = null;
    prefillEditMode(loop, snapshot, loop.placementStart, 'loop-edit', false);
    confirmationOpen.value = true;
    phase.value = 'idle'; status.value = `Loop Clip · F${loop.placementStart} · Cycle ${loop.sourceKeyIds.length}f`;
    return { ok: true, reason: null };
  }

  async function openSourceEdit(loopId: string): Promise<RotoPlayScriptLoopOpResult> {
    const guard = loopOpGuard();
    if (guard) return { ok: false, reason: guard };
    const loop = currentLoopClips().find((clip) => clip.loopId === loopId);
    if (!loop) return rejectLoopOp(`Loop Clip "${loopId}" no longer exists.`);
    if (loop.scriptId === undefined || !loop.motion) {
      return rejectLoopOp('This Loop Clip has no source-cycle provenance and cannot be source-edited.');
    }
    ports.stopPlayback();
    phase.value = 'preparing'; status.value = 'Preparing source cycle…'; error.value = null;
    try {
      const authority = await ports.requestAuthority(nextOperationId('source-edit'), loop.placementStart);
      if (!authority.ok) throw new Error(authority.error ?? 'Parent authority is unavailable.');
      const existingKeyIds = new Set(authority.physicalRecords.map((record) => record.keyId));
      if (loop.sourceKeyIds.some((keyId) => !existingKeyIds.has(keyId))) {
        return rejectLoopOp('This Loop Clip references missing source frames. Use Repair loop to regenerate the source cycle.');
      }
      const sourceStart = authority.physicalRecords.find((record) => record.keyId === loop.sourceKeyIds[0])!.appFrame;
      prefillEditMode(loop, snapshotFromAuthority(authority), sourceStart, 'source-edit', false);
      confirmationOpen.value = true;
      phase.value = 'idle'; status.value = `Source cycle · F${sourceStart} · Cycle ${loop.sourceKeyIds.length}f`;
      return { ok: true, reason: null };
    } catch (cause) {
      fail(cause);
      return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
    }
  }

  async function repairLoop(loopId: string): Promise<RotoPlayScriptLoopOpResult> {
    const guard = loopOpGuard();
    if (guard) return { ok: false, reason: guard };
    const loop = currentLoopClips().find((clip) => clip.loopId === loopId);
    if (!loop) return rejectLoopOp(`Loop Clip "${loopId}" no longer exists.`);
    if (loop.scriptId === undefined || !loop.motion) {
      return rejectLoopOp('This Loop Clip has no source-cycle provenance and cannot be repaired.');
    }
    ports.stopPlayback();
    phase.value = 'preparing'; status.value = 'Preparing loop repair…'; error.value = null;
    try {
      const authority = await ports.requestAuthority(nextOperationId('repair'), loop.placementStart);
      if (!authority.ok) throw new Error(authority.error ?? 'Parent authority is unavailable.');
      // Fail-closed (guarded-operation precedent): the regeneration destination
      // must not overlap real keys this loop does not own — the unresolved
      // record stays verbatim on rejection (D-31).
      const cycleLength = loop.sourceKeyIds.length;
      const owned = new Set(loop.sourceKeyIds);
      const overlap = authority.physicalRecords.filter((record) => record.appFrame >= loop.placementStart
        && record.appFrame < loop.placementStart + cycleLength
        && !owned.has(record.keyId));
      if (overlap.length > 0) {
        return rejectLoopOp(`Repair destination F${loop.placementStart}–F${loop.placementStart + cycleLength - 1} overlaps ${overlap.length} real key(s) not owned by this loop. Move or delete them first.`);
      }
      prefillEditMode(loop, snapshotFromAuthority(authority), loop.placementStart, 'source-edit', true);
      confirmationOpen.value = true;
      phase.value = 'idle'; status.value = `Repair loop · F${loop.placementStart} · Cycle ${cycleLength}f`;
      return { ok: true, reason: null };
    } catch (cause) {
      fail(cause);
      return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
    }
  }

  // --- 43-06 atomic loop ops through the ONE existing commit port (D-03/D-05/D-10/D-31) ---

  function resolvePublicationSelection(authority: PhysicPaintRotoAuthorityResult): { selectedKeyId: string | null; selectedAppFrame: number | null } {
    const selection = ports.getSelection();
    if (selection.kind === 'real-key' && selection.keyId) {
      const record = authority.physicalRecords.find((entry) => entry.keyId === selection.keyId && entry.appFrame === selection.appFrame);
      if (record) return { selectedKeyId: record.keyId, selectedAppFrame: record.appFrame };
    }
    return { selectedKeyId: null, selectedAppFrame: null };
  }

  function buildLoopOnlyPublication(input: {
    authority: PhysicPaintRotoAuthorityResult;
    anchor: number;
    loopClips: readonly PhysicPaintRotoLoopClip[];
    expectedLaunch: RotoPlayScriptPhysicalPublication['expectedLaunch'];
  }): RotoPlayScriptPhysicalPublication {
    const { authority, anchor, loopClips, expectedLaunch } = input;
    const records = authority.physicalRecords.map((record) => ({
      kind: 'real-key' as const,
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: clonePhysicalPayload(record.payload),
    }));
    const selection = resolvePublicationSelection(authority);
    return {
      expectedLaunch,
      expectedRevision: authority.physicalRevision,
      records,
      interpolationEnabled: authority.interpolationEnabled,
      interpolationMode: authority.interpolationMode,
      semanticDelta: {
        kind: 'play-script',
        // Empty affected range convention: the op changes loop state only.
        affectedStartAppFrame: anchor,
        affectedEndAppFrame: anchor - 1,
        expectedLayerCapacity: authority.physicalCapacity,
        expectedLayerEndExclusive: authority.layerEndExclusive,
        proposedRecords: records.map(toPhysicalEditRecord),
        freshKeyIds: [],
        loopOnly: true,
      },
      selectedKeyId: selection.selectedKeyId,
      selectedAppFrame: selection.selectedAppFrame,
      loopClips,
    };
  }

  async function runLoopOp(
    loopId: string,
    prepare: (loop: PhysicPaintRotoLoopClip, authority: PhysicPaintRotoAuthorityResult) => readonly PhysicPaintRotoLoopClip[] | string,
    statusLine: string,
  ): Promise<RotoPlayScriptLoopOpResult> {
    const guard = loopOpGuard();
    if (guard) return { ok: false, reason: guard };
    const loop = currentLoopClips().find((clip) => clip.loopId === loopId);
    if (!loop) return rejectLoopOp(`Loop Clip "${loopId}" no longer exists.`);
    const context = ports.getLaunchContext()!;
    ports.stopPlayback();
    phase.value = 'preparing'; status.value = statusLine; error.value = null;
    try {
      const authority = await ports.requestAuthority(nextOperationId('loop-op'), loop.placementStart);
      if (!authority.ok) throw new Error(authority.error ?? 'Parent authority is unavailable.');
      const prepared = prepare(loop, authority);
      if (typeof prepared === 'string') return rejectLoopOp(prepared);
      const publication = buildLoopOnlyPublication({
        authority,
        anchor: loop.placementStart,
        loopClips: prepared,
        expectedLaunch: { operationId: context.operationId, layerId: context.layerId },
      });
      phase.value = 'committing'; status.value = statusLine;
      const result = await ports.commit(publication);
      if (!result.ok) throw new Error(result.error || 'Parent rejected the Loop Clip operation.');
      assertPublicationAck(publication, result);
      phase.value = 'complete'; status.value = statusLine;
      ports.log(statusLine);
      return { ok: true, reason: null };
    } catch (cause) {
      fail(cause);
      return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
    }
  }

  async function updateLoop(): Promise<boolean> {
    const target = loopEditTarget.peek();
    if (dialogMode.peek() !== 'loop-edit' || !target) return false;
    if (loopOpGuard() !== null || repeatError.peek() !== null) return false;
    const draftRepeat: number | 'infinity' | null = infinity.peek() ? 'infinity' : parsedRepeat.peek().count;
    if (draftRepeat === null) return false;
    if (draftRepeat === target.repeat) { closeConfirmation(); return true; } // no phantom history entry
    const cycle = target.sourceKeyIds.length;
    const result = await runLoopOp(
      target.loopId,
      (loop) => currentLoopClips().map((clip) => (clip.loopId === loop.loopId ? { ...clip, repeat: draftRepeat } : clip)),
      `Loop updated · Cycle ${cycle}f × ${draftRepeat === 'infinity' ? '∞' : draftRepeat}`,
    );
    if (result.ok) confirmationOpen.value = false;
    return result.ok;
  }

  function unlinkLoop(loopId: string): Promise<RotoPlayScriptLoopOpResult> {
    return runLoopOp(
      loopId,
      (loop) => currentLoopClips().filter((clip) => clip.loopId !== loop.loopId),
      'Loop Clip unlinked — source keys remain ordinary Roto keys.',
    );
  }

  async function duplicateLinkedLoop(loopId: string, destinationStart: number): Promise<RotoPlayScriptLoopOpResult> {
    if (!Number.isSafeInteger(destinationStart) || destinationStart < 0) {
      return { ok: false, reason: 'Choose a non-negative integer destination start frame.' };
    }
    return runLoopOp(
      loopId,
      (loop, authority) => {
        const clips = currentLoopClips();
        // D-14: same-start collisions compare placementStart — never hidden order.
        if (clips.some((clip) => clip.placementStart === destinationStart)) {
          return `Another Loop Clip already starts at frame ${destinationStart}.`;
        }
        const context = derivePhysicPaintRotoLoopRanges({
          identities: authority.physicalRecords.map(({ keyId, appFrame }) => ({ keyId, appFrame })),
          loopClips: clips,
          parentEndExclusive: authority.layerEndExclusive,
          capacity: authority.physicalCapacity,
        });
        const container = context.ranges.find((range) => range.placementStart < destinationStart && destinationStart < range.effectiveEnd);
        if (container) {
          return `Frame ${destinationStart} lies inside the effective range of another Loop Clip. Choose a destination outside every loop's effective range.`;
        }
        const duplicate: PhysicPaintRotoLoopClip = {
          ...loop,
          loopId: createPhysicPaintRotoKeyId(),
          placementStart: destinationStart,
          sourceKeyIds: Object.freeze([...loop.sourceKeyIds]),
        };
        return Object.freeze([...clips, duplicate]);
      },
      'Linked loop duplicated — shares the existing source cycle.',
    );
  }

  function relinkLoop(loopId: string, targetKeyIds: readonly string[]): Promise<RotoPlayScriptLoopOpResult> {
    if (!Array.isArray(targetKeyIds) || targetKeyIds.length === 0 || targetKeyIds.some((keyId) => typeof keyId !== 'string' || keyId.length === 0)) {
      return Promise.resolve({ ok: false, reason: 'Choose a non-empty existing source cycle to relink to.' });
    }
    return runLoopOp(
      loopId,
      (loop, authority) => {
        const existing = new Set(authority.physicalRecords.map((record) => record.keyId));
        const missing = targetKeyIds.filter((keyId) => !existing.has(keyId));
        if (missing.length > 0) {
          return `Relink target contains keyId(s) that are not real Roto keys on this Paint layer: ${missing.join(', ')}.`;
        }
        // D-30: cycle length and requested duration re-derive from the new
        // sourceKeyIds; no source key or asset is modified (D-31).
        return currentLoopClips().map((clip) => (clip.loopId === loop.loopId ? { ...clip, sourceKeyIds: Object.freeze([...targetKeyIds]) } : clip));
      },
      'Loop Clip relinked to the chosen source cycle.',
    );
  }

  async function confirm(): Promise<boolean> {
    if (dialogMode.peek() === 'loop-edit') return updateLoop();
    return confirmGeneration();
  }
  async function confirmGeneration(): Promise<boolean> {
    const isSourceEdit = dialogMode.peek() === 'source-edit';
    const editTarget = isSourceEdit ? loopEditTarget.peek() : null;
    const repairId = isSourceEdit ? sourceEditRepairId.peek() : null;
    // Source-edit/repair render the PROVENANCE script (D-02/D-31); apply renders the library selection.
    const selectedId = isSourceEdit ? (editTarget?.scriptId ?? null) : ports.library.selectedId.peek();
    const context = ports.getLaunchContext();
    const start = canonicalStart.peek();
    const count = parsedCount.peek().count;
    const startingSelection = ports.getSelection();
    if (disposed || !selectedId || !context?.project || start === null || count === null || repeatError.peek() !== null) return false;
    if (isSourceEdit) {
      if (!editTarget || loopOpGuard() !== null) return false;
    } else if (disabledReason.peek() || startingSelection.appFrame !== start) return false;

    const acceptedGeneration = ++generation;
    abortController = new AbortController();
    ports.stopPlayback();
    phase.value = 'preparing'; progress.value = null; status.value = 'Preparing Play Script…'; error.value = null;
    try {
      const authority = await ports.requestAuthority(nextOperationId('confirm'), start);
      assertCurrent(acceptedGeneration);
      if (!authority.ok || count > authority.capacity) throw new Error(authority.error ?? 'Requested frame count exceeds current capacity.');
      const motion = { ...dialogMotion.peek() };
      const renderMode = mode.peek();
      // D-08R: snapshot the CURRENT brush color via the port at confirm time. Later brush-color
      // changes never retroactively alter generated frames or the success-only summary.
      const renderOverrideColor = resolveOverrideColor();

      // 43-06 S4 (D-05): Link to existing cycle — one loop-only atomic commit,
      // NO regeneration; the new Loop Clip shares the matched sourceKeyIds.
      // The branch engages only when the S4 choice was actually offered.
      if (!isSourceEdit && linkChoice.peek() === 'link' && loopIntentActive.peek() && identicalSourceCycle.peek() !== null) {
        const freshMatch = findIdenticalSourceCycle({
          scriptId: selectedId,
          mode: renderMode,
          cycleLength: count,
          motion,
          overrideColor: renderOverrideColor,
          start,
          loopClips: currentLoopClips(),
          identities: authority.physicalRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        });
        if (!freshMatch) throw new Error('The identical source cycle changed before commit.');
        const linkedLoop: PhysicPaintRotoLoopClip = {
          loopId: createPhysicPaintRotoKeyId(),
          placementStart: start,
          sourceKeyIds: freshMatch.sourceKeyIds,
          repeat: infinity.peek() ? 'infinity' : parsedRepeat.peek().count!,
          mode: renderMode,
          scriptId: selectedId,
          motion: { ...motion },
          overrideColor: renderOverrideColor,
        };
        const publication = buildLoopOnlyPublication({
          authority,
          anchor: start,
          loopClips: Object.freeze([...currentLoopClips(), linkedLoop]),
          expectedLaunch: { operationId: context.operationId, layerId: context.layerId },
        });
        phase.value = 'committing'; status.value = 'Linking Loop Clip…'; abortController = null;
        const result = await ports.commit(publication);
        assertCurrent(acceptedGeneration);
        if (!result.ok) throw new Error(result.error || 'Parent rejected the Loop Clip link.');
        assertPublicationAck(publication, result);
        const appliedSummary = composeAppliedSummary({ mode: renderMode, overrideColor: renderOverrideColor, motion, start, count });
        appliedSummaryLine1.value = appliedSummary.line1;
        appliedSummaryLine2.value = `F${start} · Linked to the existing source cycle · Cycle ${count}f × ${infinity.peek() ? '∞' : parsedRepeat.peek().count}`;
        hasSuccessfulGeneration = true;
        phase.value = 'complete'; progress.value = null; status.value = 'Loop Clip linked';
        confirmationOpen.value = false; ports.log(status.value); return true;
      }

      const snapshot = await ports.library.loadSnapshot(selectedId);
      assertCurrent(acceptedGeneration);
      if (!snapshot || (!isSourceEdit && ports.library.selectedId.peek() !== selectedId)) throw new Error('Selected script changed or could not be reloaded.');
      const existingFrames = new Map(authority.frames.map((frame) => [frame.appFrame, frame]));
      phase.value = 'rendering'; progress.value = { completed: 0, total: count }; status.value = `Rendering 0 / ${count}`;
      const staged = await renderRotoPlayScriptFrames({
        script: snapshot, frameCount: count, canonicalStart: start, motion, mode: renderMode, overrideColor: renderOverrideColor, existingFrames, size: ports.getSize(), signal: abortController.signal,
        onProgress: (completed, total) => { if (generation === acceptedGeneration) { progress.value = { completed, total }; status.value = `Rendering ${completed} / ${total}`; } },
      });
      assertCurrent(acceptedGeneration);
      const commitAuthority = await ports.requestAuthority(nextOperationId('commit-check'), start);
      assertCurrent(acceptedGeneration);
      if (!commitAuthority.ok
        || commitAuthority.capacity < count
        || commitAuthority.physicalRevision !== authority.physicalRevision
        || commitAuthority.physicalCapacity !== authority.physicalCapacity
        || commitAuthority.layerEndExclusive !== authority.layerEndExclusive) throw new Error('Roto authority changed before commit.');
      // D-06: refresh the preflight substrate from the revalidated authority so
      // the warning surfaced on the confirm path is computed against the exact
      // pre-commit physical state (revision equality above makes this a
      // no-cost refresh of an identical snapshot).
      loopPreflightSnapshot.value = {
        identities: commitAuthority.physicalRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        parentEndExclusive: commitAuthority.layerEndExclusive,
        capacity: commitAuthority.physicalCapacity,
      };
      const currentSelection = ports.getSelection();
      if (!isSourceEdit && (
        ports.library.selectedId.peek() !== selectedId
        || currentSelection.kind === 'generated-interpolation'
        || currentSelection.appFrame !== start
        || currentSelection.keyId !== startingSelection.keyId
      )) throw new Error('Play Script start, physical key identity, or selected preset changed before commit.');
      const basePublication = buildPhysicalPublication({
        authority: commitAuthority,
        staged,
        start,
        count,
        expectedLaunch: { operationId: context.operationId, layerId: context.layerId },
      });
      // 43-06: loop state rides the SAME staged publication (HOLD-03 — no
      // second commit path). The committed cycle keyIds are the records in the
      // affected range in frame order (occupied destinations keep identities).
      const cycleKeyIds = basePublication.records
        .filter((record) => record.appFrame >= start && record.appFrame <= start + count - 1)
        .map((record) => record.keyId);
      let loopClips: readonly PhysicPaintRotoLoopClip[] | undefined;
      if (repairId) {
        // D-31 repair: regenerate + retarget the loop's sourceKeyIds atomically.
        loopClips = currentLoopClips().map((clip) => (clip.loopId === repairId
          ? { ...clip, sourceKeyIds: Object.freeze([...cycleKeyIds]), mode: renderMode, scriptId: selectedId, motion: { ...motion }, overrideColor: renderOverrideColor }
          : clip));
      } else if (isSourceEdit && editTarget) {
        // D-02: regeneration updates EVERY linked Loop Clip referencing the
        // source cycle — retarget to the committed cycle keyIds; the target's
        // own repeat draft rides the same commit.
        loopClips = currentLoopClips().map((clip) => {
          if (!sameOrderedIds(clip.sourceKeyIds, editTarget.sourceKeyIds)) return clip;
          const draftRepeat: number | 'infinity' | null = infinity.peek() ? 'infinity' : parsedRepeat.peek().count;
          return {
            ...clip,
            sourceKeyIds: Object.freeze([...cycleKeyIds]),
            mode: renderMode,
            scriptId: selectedId,
            motion: { ...motion },
            overrideColor: renderOverrideColor,
            ...(clip.loopId === editTarget.loopId && draftRepeat !== null ? { repeat: draftRepeat } : {}),
          };
        });
      } else if (!isSourceEdit && loopIntentActive.peek()) {
        // D-09: new loops are created via Play Script Apply — the loop
        // references the freshly committed cycle keyIds.
        const newLoop: PhysicPaintRotoLoopClip = {
          loopId: createPhysicPaintRotoKeyId(),
          placementStart: start,
          sourceKeyIds: Object.freeze([...cycleKeyIds]),
          repeat: infinity.peek() ? 'infinity' : parsedRepeat.peek().count!,
          mode: renderMode,
          scriptId: selectedId,
          motion: { ...motion },
          overrideColor: renderOverrideColor,
        };
        loopClips = Object.freeze([...currentLoopClips(), newLoop]);
      }
      const publication: RotoPlayScriptPhysicalPublication = isSourceEdit
        ? {
            ...basePublication,
            // Opened from a Loop Clip, not a timeline selection — preserve it.
            semanticDelta: { ...basePublication.semanticDelta, preserveSelection: true },
            ...resolvePublicationSelection(commitAuthority),
            ...(loopClips ? { loopClips } : {}),
          }
        : { ...basePublication, ...(loopClips ? { loopClips } : {}) };
      phase.value = 'committing'; status.value = 'Committing Play Script…'; abortController = null;
      const result = await ports.commit(publication);
      assertCurrent(acceptedGeneration);
      if (!result.ok) throw new Error(result.error || 'Parent rejected the Play Script batch.');
      assertPublicationAck(publication, result);
      // Single appliedSummary assignment site: composed atomically from the options snapshot and
      // destination actually committed for THIS generation — never from live dialog draft values.
      const appliedSummary = composeAppliedSummary({ mode: renderMode, overrideColor: renderOverrideColor, motion, start, count });
      appliedSummaryLine1.value = appliedSummary.line1;
      appliedSummaryLine2.value = repairId
        ? `F${start}–F${start + count - 1} · Loop repaired — source cycle regenerated`
        : isSourceEdit
          ? `F${start}–F${start + count - 1} · Source cycle regenerated · ${sourceEditSharedLoopCount.peek()} linked loop(s) updated`
          : appliedSummary.line2;
      hasSuccessfulGeneration = true;
      phase.value = 'regenerating'; status.value = 'Regenerating interpolation…';
      ports.stopPlayback();
      phase.value = 'complete'; progress.value = { completed: count, total: count }; status.value = `Play Script complete · ${count} frames`;
      confirmationOpen.value = false; ports.log(status.value); return true;
    } catch (cause) {
      if (isAbort(cause)) { phase.value = 'cancelled'; status.value = 'Play Script cancelled'; error.value = null; ports.log(status.value); }
      else fail(cause);
      return false;
    } finally { if (generation === acceptedGeneration) abortController = null; }
  }

  function assertPublicationAck(publication: RotoPlayScriptPhysicalPublication, result: Extract<RotoPlayScriptCommitResult, { ok: true }>): void {
    if (result.interpolationMode !== publication.interpolationMode
      || result.selectedKeyId !== publication.selectedKeyId
      || result.selectedAppFrame !== publication.selectedAppFrame
      || !samePhysicalRecords(result.records, publication.records)) throw new Error('Parent returned a mismatched Play Script acknowledgement.');
    if (publication.loopClips !== undefined && !sameLoopClipCollections(result.loopClips, publication.loopClips)) {
      throw new Error('Parent returned a mismatched Loop Clip acknowledgement.');
    }
  }

  function closeConfirmation(): void { if (!isBusyPhase(phase.peek())) confirmationOpen.value = false; }
  function cancel(): void { if (canCancel.peek()) { generation += 1; abortController?.abort(); abortController = null; } else closeConfirmation(); }
  function fail(cause: unknown): void { const message = cause instanceof Error ? cause.message : String(cause); phase.value = 'failed'; progress.value = null; status.value = 'Play Script failed'; error.value = message; ports.log(message, true); }
  function assertCurrent(expected: number): void { if (disposed || generation !== expected) throw new DOMException('Play Script generation cancelled.', 'AbortError'); }
  function nextOperationId(kind: string): string { return `roto-play-script-${kind}-${Date.now()}-${crypto.randomUUID()}`; }

  return {
    confirmationOpen, countText, capacity, mode, overrideEnabled, dialogMotion, repeatText, infinity, lastFiniteRepeat, layerEndExclusive, parsedRepeat, repeatError, loopReadout, loopShortenPreflight, appliedSummary: { line1: appliedSummaryLine1, line2: appliedSummaryLine2 }, destinationRange, validationError, disabledReason, phase, progress, status, error, canCancel,
    dialogMode, loopEditTargetId, loopEditTarget, loopEditSourceStart, sourceEditSharedLoopCount, loopIntentActive, identicalSourceCycle, linkChoice,
    openLoopEdit, openSourceEdit, repairLoop, updateLoop, unlinkLoop, duplicateLinkedLoop, relinkLoop, findIdenticalSourceCycle,
    openConfirmation, closeConfirmation, confirm, cancel, setInfinity, resetDialogMotion, dispose: () => { disposed = true; generation += 1; stopStaticDefaults(); abortController?.abort(); abortController = null; },
  };
}

function parseCount(value: string, capacity: number): { count: number | null; error: string | null } {
  const text = value.trim();
  if (!text) return { count: null, error: 'Enter a positive integer or Max.' };
  if (/^max$/i.test(text)) return capacity > 0 ? { count: capacity, error: null } : { count: null, error: 'No real-key capacity remains.' };
  if (!/^\d+$/.test(text)) return { count: null, error: 'Enter a positive integer or Max.' };
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count <= 0) return { count: null, error: 'Enter a positive integer or Max.' };
  if (count > capacity) return { count: null, error: `Maximum available count is ${capacity}.` };
  return { count, error: null };
}

// Accepts only the canonical #rrggbb form produced by the Studio brush settings; anything else
// (empty, named colors, short hex, non-string junk) is treated as no override.
function normalizeBrushColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function composeSummaryLine1(mode: RotoPlayScriptMode, overrideColor: string | null, motion: Readonly<{ deformation: number; position: number }>): string {  const modeLabel = mode === 'static' ? 'Static / Hold' : 'Progressive';
  return `${modeLabel} · ${overrideColor ? `Override ${overrideColor}` : 'Original colors'} · Motion ${motion.deformation}/${motion.position}`;
}

function composeAppliedSummary(input: {
  readonly mode: RotoPlayScriptMode;
  readonly overrideColor: string | null;
  readonly motion: Readonly<{ deformation: number; position: number }>;
  readonly start: number;
  readonly count: number;
}): { line1: string; line2: string } {
  return {
    line1: composeSummaryLine1(input.mode, input.overrideColor, input.motion),
    line2: `F${input.start}–F${input.start + input.count - 1} · ${input.count} frames generated`,
  };
}

function parseRepeat(value: string, cycleLength: number | null): { count: number | null; error: string | null } {
  const text = value.trim();
  if (!text || !/^\d+$/.test(text)) return { count: null, error: 'Enter a positive integer.' };
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count <= 0) return { count: null, error: 'Enter a positive integer.' };
  // Safe-product bound derived BEFORE any multiplication from the CURRENT cycle value, so the
  // accepted cycle × repeat product is always a safe integer. When the cycle field is temporarily
  // unparseable the frames validation already blocks confirm, so the product check is skipped.
  if (cycleLength !== null && cycleLength > 0) {
    const maxRepeat = Math.floor(Number.MAX_SAFE_INTEGER / cycleLength);
    if (count > maxRepeat) return { count: null, error: 'Repeat is too large for this cycle length.' };
  }
  return { count, error: null };
}

function buildPhysicalPublication(input: {
  readonly authority: PhysicPaintRotoAuthorityResult;
  readonly staged: readonly PhysicPaintRotoCacheFrame[];
  readonly start: number;
  readonly count: number;
  readonly expectedLaunch: RotoPlayScriptPhysicalPublication['expectedLaunch'];
}): RotoPlayScriptPhysicalPublication {
  const { authority, staged, start, count, expectedLaunch } = input;
  const affectedEndAppFrame = start + count - 1;
  if (count <= 0
    || affectedEndAppFrame >= authority.layerEndExclusive
    || affectedEndAppFrame >= authority.physicalCapacity
    || staged.length !== count) throw new Error('Rendered Play Script range does not match current physical capacity.');

  const currentByFrame = new Map<number, PhysicPaintRotoRealKeyRecord>();
  const currentKeyIds = new Set<string>();
  for (const record of authority.physicalRecords) {
    if (currentByFrame.has(record.appFrame) || currentKeyIds.has(record.keyId)) throw new Error('Parent authority returned duplicate physical Roto identity.');
    currentKeyIds.add(record.keyId);
    currentByFrame.set(record.appFrame, {
      kind: 'real-key',
      keyId: record.keyId,
      appFrame: record.appFrame,
      payload: clonePhysicalPayload(record.payload),
    });
  }

  const stagedByFrame = new Map<number, PhysicPaintRotoCacheFrame>();
  for (const frame of staged) {
    if (!Number.isInteger(frame.appFrame)
      || frame.appFrame < start
      || frame.appFrame > affectedEndAppFrame
      || stagedByFrame.has(frame.appFrame)
      || !isRotoPngDataUrl(frame.dataUrl)) throw new Error('Rendered Play Script output is incomplete or is not a valid PNG.');
    stagedByFrame.set(frame.appFrame, frame);
  }

  const freshKeyIds: string[] = [];
  for (let appFrame = start; appFrame <= affectedEndAppFrame; appFrame += 1) {
    const frame = stagedByFrame.get(appFrame);
    if (!frame) throw new Error(`Rendered Play Script output is missing frame ${appFrame}.`);
    const existing = currentByFrame.get(appFrame);
    const keyId = existing?.keyId ?? createPhysicPaintRotoKeyId();
    if (!existing) {
      if (currentKeyIds.has(keyId)) throw new Error('Fresh Play Script identity collides with an existing physical key.');
      currentKeyIds.add(keyId);
      freshKeyIds.push(keyId);
    }
    currentByFrame.set(appFrame, {
      kind: 'real-key',
      keyId,
      appFrame,
      payload: {
        frameIndex: frame.frameIndex,
        appFrame,
        dataUrl: frame.dataUrl,
        ...(frame.width !== undefined ? { width: frame.width } : {}),
        ...(frame.height !== undefined ? { height: frame.height } : {}),
      },
    });
  }

  const records = [...currentByFrame.values()].sort((left, right) => left.appFrame - right.appFrame);
  const selected = currentByFrame.get(start);
  if (!selected) throw new Error('Play Script start destination is missing from the physical proposal.');
  const proposedRecords = records.map(toPhysicalEditRecord);
  return {
    expectedLaunch,
    expectedRevision: authority.physicalRevision,
    records,
    interpolationEnabled: authority.interpolationEnabled,
    interpolationMode: authority.interpolationMode,
    semanticDelta: {
      kind: 'play-script',
      affectedStartAppFrame: start,
      affectedEndAppFrame,
      expectedLayerCapacity: authority.physicalCapacity,
      expectedLayerEndExclusive: authority.layerEndExclusive,
      proposedRecords,
      freshKeyIds,
    },
    selectedKeyId: selected.keyId,
    selectedAppFrame: start,
  };
}

function clonePhysicalPayload(payload: PhysicPaintRotoPhysicalEditRecord['payload']): PhysicPaintRotoPhysicalEditRecord['payload'] {
  return {
    frameIndex: payload.frameIndex,
    appFrame: payload.appFrame,
    dataUrl: payload.dataUrl,
    ...(payload.width !== undefined ? { width: payload.width } : {}),
    ...(payload.height !== undefined ? { height: payload.height } : {}),
  };
}

function toPhysicalEditRecord(record: PhysicPaintRotoRealKeyRecord): PhysicPaintRotoPhysicalEditRecord {
  return {
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: clonePhysicalPayload(record.payload),
  };
}

function samePhysicalRecords(
  left: readonly PhysicPaintRotoRealKeyRecord[],
  right: readonly PhysicPaintRotoRealKeyRecord[],
): boolean {
  return left.length === right.length && left.every((record, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && record.keyId === candidate.keyId
      && record.appFrame === candidate.appFrame
      && record.payload.frameIndex === candidate.payload.frameIndex
      && record.payload.appFrame === candidate.payload.appFrame
      && record.payload.dataUrl === candidate.payload.dataUrl
      && record.payload.width === candidate.payload.width
      && record.payload.height === candidate.payload.height;
  });
}

function isBusyPhase(phase: RotoPlayScriptPhase): boolean { return phase === 'preparing' || phase === 'rendering' || phase === 'committing' || phase === 'regenerating'; }
function isAbort(error: unknown): boolean { return error instanceof DOMException && error.name === 'AbortError'; }

/** Ordered keyId-list equality — the source-cycle sharing identity (D-05). */
function sameOrderedIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((keyId, index) => keyId === right[index]);
}

/** Field-exact Loop Clip collection comparison for the commit acknowledgement. */
function sameLoopClipCollections(
  left: readonly PhysicPaintRotoLoopClip[] | undefined,
  right: readonly PhysicPaintRotoLoopClip[],
): boolean {
  if (!left || left.length !== right.length) return false;
  return left.every((clip, index) => {
    const candidate = right[index];
    return candidate !== undefined
      && clip.loopId === candidate.loopId
      && clip.placementStart === candidate.placementStart
      && sameOrderedIds(clip.sourceKeyIds, candidate.sourceKeyIds)
      && clip.repeat === candidate.repeat
      && clip.mode === candidate.mode
      && clip.scriptId === candidate.scriptId
      && (clip.motion === undefined) === (candidate.motion === undefined)
      && (clip.motion === undefined
        || (clip.motion.deformation === candidate.motion!.deformation && clip.motion.position === candidate.motion!.position))
      && (clip.overrideColor ?? null) === (candidate.overrideColor ?? null);
  });
}
