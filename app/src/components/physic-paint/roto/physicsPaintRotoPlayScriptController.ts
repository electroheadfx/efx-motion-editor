import { computed, effect, signal, type ReadonlySignal, type Signal } from '@preact/signals';
import type {
  PhysicPaintLaunchContext,
  PhysicPaintRotoAuthorityResult,
  PhysicPaintRotoBackgroundMetadata,
  PhysicPaintRotoCacheFrame,
  PhysicPaintRotoPhysicalEditRecord,
  PhysicPaintRotoPhysicalEditSemanticDelta,
} from '../../../types/physicPaint';
import type { RotoScriptLibraryController } from './physicsPaintRotoScriptLibrary';
import {
  buildPhysicPaintRotoPhysicalRevision,
  createPhysicPaintRotoKeyId,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  type PhysicPaintRotoKeyIdentity,
  type PhysicPaintRotoLoopClip,
  type PhysicPaintRotoPhysicalDocument,
  type PhysicPaintRotoRealKeyRecord,
} from './physicsPaintRotoPhysicalModel';
import { proposePhysicPaintRotoRegenerateGroup } from './physicsPaintRotoGroupLifecycle';
import {
  derivePhysicPaintRotoLoopRanges,
  derivePhysicPaintRotoLoopShortenPreflight,
  resolvePhysicPaintRotoGroupEffectiveEnd,
} from './physicsPaintRotoPhysicalResolver';
import type { RotoTimelineSelectionKind } from './rotoTimelineSelectors';
import { renderRotoPlayScriptFrames } from './physicsPaintRotoPlayScriptRenderer';
import { isRotoPngDataUrl } from './rotoCanvasFrames';

export type RotoPlayScriptPhase = 'idle' | 'preparing' | 'rendering' | 'committing' | 'regenerating' | 'complete' | 'cancelled' | 'failed';

export type RotoPlayScriptMode = 'progressive' | 'static';

/** 43-06 dialog modes (D-01/D-02): apply is the Phase 42 generation surface. */
export type RotoPlayScriptDialogMode = 'apply' | 'loop-edit' | 'source-edit';

/** 52-05 (G-52-3): the Create Rail dialog tabs — Paint Rail or Reveal Photo Rail. */
export type RotoPlayScriptRailTab = 'paint' | 'reveal';

/** 52-05 (G-52-3): input to the create-reveal-rail port — creation IS the first bake (D-11). */
export interface RotoRevealRailCreateInput {
  readonly layerId: string;
  readonly trackId: string;
  readonly scriptId: string;
  readonly variant: 'progressive' | 'static';
  readonly startFrame: number;
  readonly frameCount: number;
  /** The repeat law surfaced at creation (D-08) — same semantics as the Paint Rail. */
  readonly repeat: number | 'infinity';
  /** The creation-time motion wiggle feeding the bake (D-09 — both variants). */
  readonly motion: Readonly<{ deformation: number; position: number }>;
  readonly signal: AbortSignal;
  readonly onProgress?: (completed: number, total: number) => void;
}

/** 52-05 (G-52-3): closed result of the create-reveal-rail port; reason is display-ready copy. */
export type RotoRevealRailCreateResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

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
  readonly interpolationEnabled: boolean;
}

/** S4 match result (D-05, Q2): the existing identical source cycle. */
export interface RotoPlayScriptIdenticalSourceCycle {
  readonly sourceKeyIds: readonly string[];
  readonly loopCount: number;
  readonly sourceStart: number;
}

export interface RotoPlayScriptRegenerateAffectedGroup {
  readonly groupId: string;
  readonly name: string;
  readonly range: string;
}

/** Frozen G3a disclosure prepared from one accepted Action/document authority pair. */
export interface RotoPlayScriptRegenerateImpact {
  readonly actionId: string;
  readonly actionRevision: string;
  readonly actionHash: string;
  readonly documentRevision: string;
  readonly initiatingGroupId: string;
  readonly groupName: string;
  readonly groupType: 'Motion' | 'Static';
  readonly restoredRange: string;
  readonly locallyPaintedFrameCount: number;
  readonly deletedFrameCount: number;
  readonly deletedFrameRanges: string;
  readonly fragmentCount: number;
  readonly gapRanges: string;
  readonly affectedGroups: readonly RotoPlayScriptRegenerateAffectedGroup[];
  readonly sourceCacheEffects: string;
  readonly storedSettings: Readonly<{
    mode: RotoPlayScriptMode;
    motion: { readonly deformation: number; readonly position: number };
    overrideColor: string | null;
    sourceKeyIds: readonly string[];
  }>;
}

export type RotoPlayScriptSemanticDelta = Extract<
  PhysicPaintRotoPhysicalEditSemanticDelta,
  { readonly kind: 'play-script' }
>;

export type RotoRegenerateGroupSemanticDelta = Extract<
  PhysicPaintRotoPhysicalEditSemanticDelta,
  { readonly kind: 'regenerate-group' }
>;

interface RotoGeneratedPhysicalPublicationBase {
  readonly expectedLaunch: { readonly operationId: string; readonly layerId: string };
  readonly expectedRevision: string;
  readonly records: readonly PhysicPaintRotoRealKeyRecord[];
  readonly interpolationEnabled: boolean;
  readonly interpolationMode: PhysicPaintRotoAuthorityResult['interpolationMode'];
  readonly rotoBackground: PhysicPaintRotoBackgroundMetadata;
  readonly selectedKeyId: string | null;
  readonly selectedAppFrame: number | null;
}

export interface RotoPlayScriptPhysicalPublication extends RotoGeneratedPhysicalPublicationBase {
  readonly semanticDelta: RotoPlayScriptSemanticDelta;
  readonly loopClips?: readonly PhysicPaintRotoLoopClip[];
  /** 52 UAT (AM-4): the full staged incoming-break collection. Present ONLY on
   *  a genuinely new-cycle Play Script Apply (rail creation) — the fresh
   *  cycle's first key registers the leading break so no prior rail can
   *  interpolate into it. Absent on repair/regenerate/source-edit and the
   *  S4 link path, which pass the document's breaks through untouched. */
  readonly incomingInterpolationBreakKeyIds?: readonly string[];
}

export interface RotoRegenerateGroupPhysicalPublication extends RotoGeneratedPhysicalPublicationBase {
  readonly semanticDelta: RotoRegenerateGroupSemanticDelta;
  readonly groupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[];
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
}

export type RotoGeneratedPhysicalPublication =
  | RotoPlayScriptPhysicalPublication
  | RotoRegenerateGroupPhysicalPublication;

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
  /** 47-01: resolve the DOCUMENT's current active track — the launch snapshot
   * is stale after an in-place track switch (row click / add / duplicate). */
  getActiveTrackId: (layerId: string) => string;
  getSelection: () => { kind: RotoTimelineSelectionKind; keyId: string | null; appFrame: number };
  getMotion: () => { deformation: number; position: number };
  // D-08R: the ONLY override-color resolution path — reads the live Studio brush color
  // (settings.color; sole writer setBrushColor). Read at confirm time and at the first-open
  // summary compose; the value is never stored dialog-side (D-10/D-18).
  getBrushColor: () => string;
  getBackgroundMetadata: () => PhysicPaintRotoBackgroundMetadata;
  getOperationLocked: () => boolean;
  getSize: () => { width: number; height: number };
  /**
   * Phase 43 (D-06): durable Loop Clip collection for the preflight shorten
   * warning. Absent port = pre-43 empty collection (no warning ever).
   */
  getRotoLoopClips?: () => readonly PhysicPaintRotoLoopClip[];
  /** Accepted local document snapshot used only to open Loop Edit immediately. */
  getLoopEditSnapshot?: (placementStart: number) => RotoPlayScriptLoopEditSnapshot | null;
  /** Complete accepted physical document used for Group lifecycle preparation and stale checks. */
  getPhysicalDocument?: () => PhysicPaintRotoPhysicalDocument | null;
  availabilityRevision?: ReadonlySignal<number>;
  /* ---- 52-05 (G-52-3): the Reveal Photo Rail tab ports ---- */
  /** True when the layer has a photo reference with a source — the D-12 creation guard. */
  hasPhotoReference?: () => boolean;
  /** Bumped on every document mutation so the reference guard re-resolves live. */
  photoReferenceRevision?: ReadonlySignal<number>;
  /** Guard action: open the Photo Reference modal so the user places a source, then return. */
  openPhotoReference?: () => void;
  /** The create-reveal-rail mutation (Plan 01) — creation IS the first bake (D-11). */
  createReveal?: (input: RotoRevealRailCreateInput) => Promise<RotoRevealRailCreateResult>;
  /** The script's natural duration at the current motion parameters (D-20); null → default. */
  getScriptNaturalDuration?: (scriptId: string) => number | null;
  requestAuthority: (operationId: string, start: number) => Promise<PhysicPaintRotoAuthorityResult>;
  commit: (
    publication: RotoGeneratedPhysicalPublication,
    revalidateUnderLease?: () => Promise<string | null>,
  ) => Promise<RotoPlayScriptCommitResult>;
  stopPlayback: () => void;
  log: (message: string, error?: boolean) => void;
}

export interface RotoPlayScriptController {
  confirmationOpen: Signal<boolean>;
  countText: Signal<string>;
  max: Signal<boolean>;
  lastFiniteCount: Signal<string>;
  capacity: Signal<number>;
  /** The span start snapshotted at dialog open (the playhead frame — D-20). */
  canonicalStart: ReadonlySignal<number | null>;
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
  /** Exact guarded reason for the current Group Regenerate target. */
  regenerateDisabledReason: ReadonlySignal<string | null>;
  /** Frozen G3a facts; null until exact preparation succeeds. */
  regenerateImpact: ReadonlySignal<RotoPlayScriptRegenerateImpact | null>;
  /** True for every Play Script Apply; Repeat changes duration, not capsule creation. */
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
  /* ---- 52-05 (G-52-3): the Create Rail dialog tabs ---- */
  /** The active creation tab (apply mode only); edit modes always render the Paint surface. */
  railTab: Signal<RotoPlayScriptRailTab>;
  /** The Reveal tab's span-length draft — defaults to the script's natural duration (D-20). */
  revealCountText: Signal<string>;
  /** The Reveal tab's parsed span length (capacity-bounded, same law as the Paint tab). */
  parsedRevealCount: ReadonlySignal<{ count: number | null; error: string | null }>;
  /** The Reveal tab's Frames validation error, or null. */
  revealValidationError: ReadonlySignal<string | null>;
  /** Live D-12 guard fact: a photo reference with a source is placed on the layer. */
  revealReferencePlaced: ReadonlySignal<boolean>;
  /** Switch the creation tab; switching to Reveal re-defaults the span from the script. */
  setRailTab: (tab: RotoPlayScriptRailTab) => void;
  /** Guard action: open the Photo Reference modal so the user places a source, then return. */
  requestPhotoReference: () => void;
  openConfirmation: (options?: { railTab?: RotoPlayScriptRailTab }) => Promise<void>;
  closeConfirmation: () => void;
  confirm: () => Promise<boolean>;
  cancel: () => void;
  setMax: (enabled: boolean) => void;
  setInfinity: (enabled: boolean) => void;
  resetDialogMotion: () => void;
  dispose: () => void;
}

export function createRotoPlayScriptController(ports: RotoPlayScriptControllerPorts): RotoPlayScriptController {
  const confirmationOpen = signal(false);
  const countText = signal('3');
  const max = signal(false);
  const lastFiniteCount = signal('3');
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
  const regenerateDisabledReason = signal<string | null>(null);
  const regenerateImpact = signal<RotoPlayScriptRegenerateImpact | null>(null);
  const linkChoice = signal<'link' | 'create'>('link');
  /* ---- 52-05 (G-52-3): the Create Rail dialog tabs ----
     The Reveal Photo Rail tab carries its own span-length draft (defaulting to
     the selected script's natural duration — D-20) while the variant, repeat,
     and motion wiggle ride the SAME signals as the Paint tab (one mutation law). */
  const railTab = signal<RotoPlayScriptRailTab>('paint');
  const revealCountText = signal(String(DEFAULT_REVEAL_FRAME_COUNT));
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
  const parsedCount = computed(() => max.value
    ? capacity.value > 0
      ? { count: capacity.value, error: null }
      : { count: null, error: 'No real-key capacity remains.' }
    : parseCount(countText.value, capacity.value));
  const validationError = computed(() => parsedCount.value.error);
  /* 52-05 (G-52-3): the active tab's cycle length drives the shared repeat
     parsing, the destination range, and the Requested/Effective summary. */
  const parsedRevealCount = computed(() => parseCount(revealCountText.value, capacity.value));
  const revealValidationError = computed(() => parsedRevealCount.value.error);
  const activeParsedCount = computed(() => (railTab.value === 'reveal' && dialogMode.value === 'apply' ? parsedRevealCount.value : parsedCount.value));
  const revealReferencePlaced = computed(() => {
    ports.photoReferenceRevision?.value;
    return ports.hasPhotoReference?.() ?? false;
  });
  const destinationRange = computed(() => {
    const start = canonicalStart.value;
    const count = activeParsedCount.value.count;
    return start === null || count === null ? null : `F${start}–F${start + count - 1}`;
  });
  const canCancel = computed(() => phase.value === 'preparing' || phase.value === 'rendering');
  // D-06 preflight substrate: the authority snapshot captured at dialog open.
  // confirm() revalidates the physical revision before commit, so this
  // snapshot is guaranteed current whenever the warning is shown.
  const loopPreflightSnapshot = signal<{
    readonly identities: readonly PhysicPaintRotoKeyIdentity[];
    readonly parentEndExclusive: number;
    readonly capacity: number;
    readonly interpolationEnabled: boolean;
  } | null>(null);
  const parsedRepeat = computed(() => {
    let cycleDuration = activeParsedCount.value.count;
    if (dialogMode.value === 'loop-edit') {
      const targetId = loopEditTargetId.value;
      const target = targetId === null ? null : currentLoopClips().find((clip) => clip.loopId === targetId) ?? null;
      const snapshot = loopPreflightSnapshot.value;
      if (target && snapshot) {
        cycleDuration = derivePhysicPaintRotoLoopRanges({
          identities: snapshot.identities,
          loopClips: currentLoopClips(),
          capacity: snapshot.capacity,
          interpolationEnabled: snapshot.interpolationEnabled,
        }).ranges.find((range) => range.loopId === target.loopId)?.cycleLength ?? cycleDuration;
      }
    }
    return parseRepeat(repeatText.value, cycleDuration);
  });
  const repeatError = computed(() => (infinity.value ? null : parsedRepeat.value.error));
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
      capacity: snapshot.capacity,
      destinationStart: start,
      destinationCount: count,
      interpolationEnabled: snapshot.interpolationEnabled,
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
      const draftRepeat: number | 'infinity' | null = infinity.value ? 'infinity' : parsedRepeat.value.count;
      if (draftRepeat === null) return null;
      const loopClips = currentLoopClips().map((clip) => (clip.loopId === target.loopId ? { ...clip, repeat: draftRepeat } : clip));
      const context = derivePhysicPaintRotoLoopRanges({
        identities: snapshot.identities,
        loopClips,
        capacity: snapshot.capacity,
        interpolationEnabled: snapshot.interpolationEnabled,
      });
      const range = context.ranges.find((entry) => entry.loopId === target.loopId);
      if (!range) return null;
      const cycleDuration = range.cycleLength;
      const effective = range.effectiveEnd - range.placementStart;
      if (draftRepeat === 'infinity') return `Cycle ${cycleDuration}f × ∞ · Effective: ${effective}f`;
      const requested = cycleDuration * draftRepeat;
      return range.truncated
        ? `Requested: ${requested}f (${cycleDuration}f × ${draftRepeat}) · Effective: ${effective}f — shortened by the next clip`
        : `Requested: ${requested}f (${cycleDuration}f × ${draftRepeat}) · Effective: ${effective}f`;
    }
    const cycle = activeParsedCount.value.count;
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
  const loopIntentActive = computed(() => dialogMode.value === 'apply');
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
      countText.value = '3';
      lastFiniteCount.value = '3';
      max.value = false;
      repeatText.value = '1';
      infinity.value = false;
    }
  });

  function setMax(enabled: boolean): void {
    if (enabled) {
      // Preserve the last VALID finite frame count; an invalid disabled draft never overwrites it.
      if (parseCount(countText.peek(), capacity.peek()).count !== null) lastFiniteCount.value = countText.peek();
      max.value = true;
    } else {
      countText.value = lastFiniteCount.peek();
      max.value = false;
    }
  }

  function setInfinity(enabled: boolean): void {
    if (enabled) {
      // Preserve the last VALID finite repeat; an invalid draft never overwrites it (Pitfall 7).
      if (parseRepeat(repeatText.peek(), activeParsedCount.peek().count).count !== null) lastFiniteRepeat.value = repeatText.peek();
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

  /* 52-05 (G-52-3): switching to the Reveal Photo Rail tab re-defaults the span
     from the selected script's natural duration (D-20) and runs the reference
     guard PROACTIVELY — no reference → the Photo Reference modal opens directly
     so the user places a source and returns to this dialog (never a silent
     disabled state, never a bare error). */
  function setRailTab(tab: RotoPlayScriptRailTab): void {
    if (isBusyPhase(phase.peek())) return;
    railTab.value = tab;
    if (tab !== 'reveal') return;
    const selectedId = ports.library.selectedId.peek();
    revealCountText.value = String((selectedId ? ports.getScriptNaturalDuration?.(selectedId) : null) ?? DEFAULT_REVEAL_FRAME_COUNT);
    if (!revealReferencePlaced.peek()) ports.openPhotoReference?.();
  }

  function requestPhotoReference(): void {
    ports.openPhotoReference?.();
  }

  // D-08R single resolution path: Original colors (override disabled) → null; Custom color →
  // the CURRENT brush-color port value, validated defensively (T-42-05-01) — a malformed port
  // value falls back to null (Original-colors behavior), mirroring existing input discipline.
  function resolveOverrideColor(): string | null {
    if (!overrideEnabled.peek()) return null;
    return normalizeBrushColor(ports.getBrushColor());
  }

  async function openConfirmation(options?: { railTab?: RotoPlayScriptRailTab }): Promise<void> {
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
        interpolationEnabled: authority.interpolationEnabled,
      };
      // 43-06: every apply-mode open resets the loop-mode state.
      dialogMode.value = 'apply';
      loopEditTargetId.value = null;
      sourceEditRepairId.value = null;
      linkChoice.value = 'link';
      countText.value = '3';
      lastFiniteCount.value = '3';
      max.value = false;
      dialogMotion.value = { ...ports.getMotion() };
      // 52-05 (G-52-3): the open entry picks the tab — the track rail-creation
      // flow's Reveal item opens directly on the Reveal Photo Rail tab. The
      // reveal span defaults to the selected script's natural duration (D-20).
      railTab.value = options?.railTab ?? 'paint';
      const selectedScriptId = ports.library.selectedId.peek();
      revealCountText.value = String((selectedScriptId ? ports.getScriptNaturalDuration?.(selectedScriptId) : null) ?? DEFAULT_REVEAL_FRAME_COUNT);
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
      interpolationEnabled: snapshot.interpolationEnabled,
    };
    canonicalStart.value = destination;
    capacity.value = snapshot.remainingCapacity;
    layerEndExclusive.value = snapshot.layerEndExclusive;
    // mode first: the Static / Hold first-time defaults effect fires synchronously
    // on the mode write, so the prefill assignments below always land after it.
    mode.value = loop.mode;
    dialogMode.value = mode_;
    railTab.value = 'paint'; // 52-05: edit modes always render the Paint surface
    if (loopEditTargetId.peek() === loop.loopId) loopEditTargetId.value = null;
    loopEditTargetId.value = loop.loopId;
    sourceEditRepairId.value = repair ? loop.loopId : null;
    linkChoice.value = 'link';
    countText.value = String(loop.sourceKeyIds.length);
    lastFiniteCount.value = countText.value;
    max.value = false;
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
      interpolationEnabled: authority.interpolationEnabled,
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

  function isRegenerableLifecycleShape(group: PhysicPaintRotoLoopClip): group is PhysicPaintRotoLoopClip & Required<Pick<
    PhysicPaintRotoLoopClip,
    'syncState' | 'provenanceState' | 'phaseOrigin' | 'originalEndExclusive' | 'visibleRanges' | 'frameOverrides'
  >> {
    return group.syncState !== undefined
      && group.provenanceState !== undefined
      && group.phaseOrigin !== undefined
      && group.originalEndExclusive !== undefined
      && group.visibleRanges !== undefined
      && group.frameOverrides !== undefined;
  }

  function compactFrameRanges(ranges: readonly { readonly start: number; readonly endExclusive: number }[]): string {
    if (ranges.length === 0) return 'None';
    return ranges.map((range) => range.endExclusive === range.start + 1
      ? `F${range.start}`
      : `F${range.start}–F${range.endExclusive - 1}`).join(', ');
  }

  function deletedRangesFor(group: PhysicPaintRotoLoopClip & Required<Pick<
    PhysicPaintRotoLoopClip,
    'phaseOrigin' | 'originalEndExclusive' | 'visibleRanges'
  >>): readonly { readonly start: number; readonly endExclusive: number }[] {
    const deleted: Array<{ start: number; endExclusive: number }> = [];
    let cursor = group.phaseOrigin;
    for (const range of group.visibleRanges) {
      if (cursor < range.start) deleted.push({ start: cursor, endExclusive: range.start });
      cursor = Math.max(cursor, range.endExclusive);
    }
    if (cursor < group.originalEndExclusive) deleted.push({ start: cursor, endExclusive: group.originalEndExclusive });
    return Object.freeze(deleted.map((range) => Object.freeze(range)));
  }

  function actionSnapshotHash(snapshot: unknown): string {
    const value = JSON.stringify(snapshot);
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return `action-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function groupRegenerateReason(group: PhysicPaintRotoLoopClip, document: PhysicPaintRotoPhysicalDocument | null): string | null {
    if (ports.library.busy.peek() || ports.getOperationLocked() || isBusyPhase(phase.peek())) return 'Finish the current Rail operation.';
    if (!isRegenerableLifecycleShape(group)) return 'Regenerate unavailable — Rail source is unresolved.';
    if (group.syncState === 'synchronized') return 'Already synchronized with Action.';
    if (group.provenanceState !== 'attached' || !group.scriptId) return 'Regenerate unavailable — Action detached.';
    const action = ports.library.rows.peek().find((row) => row.id === group.scriptId);
    if (!action) return 'Regenerate unavailable — Source Action unavailable.';
    if (!document || document.revision.length === 0) return 'Regenerate unavailable — Rail source is unresolved.';
    const records = new Set(document.realKeyRecords.map((record) => record.keyId));
    if (group.sourceKeyIds.length === 0 || group.sourceKeyIds.some((keyId) => !records.has(keyId))) {
      return 'Regenerate unavailable — Rail source is unresolved.';
    }
    const owned = new Set(group.sourceKeyIds);
    for (const candidate of document.loopClips) {
      if (candidate.loopId === group.loopId) continue;
      const overlaps = candidate.sourceKeyIds.some((keyId) => owned.has(keyId));
      if (!overlaps) continue;
      if (!sameOrderedIds(candidate.sourceKeyIds, group.sourceKeyIds)
        || !isRegenerableLifecycleShape(candidate)
        || candidate.scriptId !== group.scriptId
        || candidate.provenanceState !== 'attached') {
        return 'Regenerate unavailable — Rail source sharing is ambiguous.';
      }
    }
    return null;
  }

  async function openGroupRegenerate(group: PhysicPaintRotoLoopClip & Required<Pick<
    PhysicPaintRotoLoopClip,
    'syncState' | 'provenanceState' | 'phaseOrigin' | 'originalEndExclusive' | 'visibleRanges' | 'frameOverrides'
  >>): Promise<RotoPlayScriptLoopOpResult> {
    const document = ports.getPhysicalDocument?.() ?? null;
    const reason = groupRegenerateReason(group, document);
    regenerateDisabledReason.value = reason;
    regenerateImpact.value = null;
    if (reason || !document || !group.scriptId || !group.motion) return rejectLoopOp(reason ?? 'Regenerate unavailable — Rail source is unresolved.');
    const action = ports.library.rows.peek().find((row) => row.id === group.scriptId);
    if (!action) return rejectLoopOp('Regenerate unavailable — Source Action unavailable.');
    ports.stopPlayback();
    phase.value = 'preparing';
    status.value = 'Preparing Rail Regenerate…';
    error.value = null;
    try {
      const snapshot = await ports.library.loadSnapshot(group.scriptId);
      if (!snapshot) return rejectLoopOp('Regenerate unavailable — Source Action unavailable.');
      const currentDocument = ports.getPhysicalDocument?.() ?? null;
      if (!currentDocument || currentDocument.revision !== document.revision) {
        return rejectLoopOp('Regenerate rejected — physical Rail document changed.');
      }
      const currentAction = ports.library.rows.peek().find((row) => row.id === group.scriptId);
      if (!currentAction || currentAction.revision !== action.revision) {
        return rejectLoopOp('Regenerate rejected — saved Action changed.');
      }
      const sourceStart = document.realKeyRecords.find((record) => record.keyId === group.sourceKeyIds[0])?.appFrame;
      if (sourceStart === undefined) return rejectLoopOp('Regenerate unavailable — Rail source is unresolved.');
      const affected = document.loopClips
        .filter((candidate) => sameOrderedIds(candidate.sourceKeyIds, group.sourceKeyIds)
          && candidate.scriptId === group.scriptId
          && isRegenerableLifecycleShape(candidate)
          && candidate.provenanceState === 'attached')
        .sort((left, right) => left.phaseOrigin! - right.phaseOrigin! || left.loopId.localeCompare(right.loopId));
      const deletedRanges = deletedRangesFor(group);
      const actionHash = actionSnapshotHash(snapshot);
      const affectedGroups = Object.freeze(affected.map((candidate) => Object.freeze({
        groupId: candidate.loopId,
        name: `Rail at F${candidate.phaseOrigin!}`,
        range: `F${candidate.phaseOrigin!}–F${candidate.originalEndExclusive! - 1}`,
      })));
      regenerateImpact.value = Object.freeze({
        actionId: group.scriptId,
        actionRevision: action.revision,
        actionHash,
        documentRevision: document.revision,
        initiatingGroupId: group.loopId,
        groupName: `Rail at F${group.phaseOrigin}`,
        groupType: group.mode === 'progressive' ? 'Motion' : 'Static',
        restoredRange: `F${group.phaseOrigin}–F${group.originalEndExclusive - 1}`,
        locallyPaintedFrameCount: group.frameOverrides.length,
        deletedFrameCount: deletedRanges.reduce((count, range) => count + range.endExclusive - range.start, 0),
        deletedFrameRanges: compactFrameRanges(deletedRanges),
        fragmentCount: group.visibleRanges.length,
        gapRanges: compactFrameRanges(deletedRanges),
        affectedGroups,
        sourceCacheEffects: affectedGroups.length > 1
          ? 'Rebuilds the saved Action source cycle and refreshes every affected Rail cache.'
          : 'Rebuilds the saved Action source cycle and refreshes the Rail cache.',
        storedSettings: Object.freeze({
          mode: group.mode,
          motion: Object.freeze({ ...group.motion }),
          overrideColor: group.overrideColor ?? null,
          sourceKeyIds: Object.freeze([...group.sourceKeyIds]),
        }),
      });
      const loopEditSnapshot = ports.getLoopEditSnapshot?.(sourceStart) ?? null;
      if (!loopEditSnapshot) return rejectLoopOp('The accepted local Roto physical document is unavailable.');
      prefillEditMode(group, loopEditSnapshot, sourceStart, 'source-edit', false);
      confirmationOpen.value = true;
      phase.value = 'idle';
      status.value = `Rail Regenerate · ${regenerateImpact.value.restoredRange}`;
      return { ok: true, reason: null };
    } catch (cause) {
      fail(cause);
      return { ok: false, reason: cause instanceof Error ? cause.message : String(cause) };
    }
  }

  async function openSourceEdit(loopId: string): Promise<RotoPlayScriptLoopOpResult> {
    const loop = currentLoopClips().find((clip) => clip.loopId === loopId);
    if (!loop) return rejectLoopOp(`Loop Clip "${loopId}" no longer exists.`);
    if (isRegenerableLifecycleShape(loop)) return openGroupRegenerate(loop);
    const guard = loopOpGuard();
    if (guard) return { ok: false, reason: guard };
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
    const document = ports.getPhysicalDocument?.() ?? null;
    if (document?.selectedKeyId) {
      const record = authority.physicalRecords.find((entry) => entry.keyId === document.selectedKeyId);
      if (record) return { selectedKeyId: record.keyId, selectedAppFrame: record.appFrame };
    }
    if (document) return { selectedKeyId: null, selectedAppFrame: null };
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
    rotoBackground: PhysicPaintRotoBackgroundMetadata;
  }): RotoPlayScriptPhysicalPublication {
    const { authority, anchor, loopClips, expectedLaunch, rotoBackground } = input;
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
      rotoBackground,
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
        rotoBackground: { ...ports.getBackgroundMetadata() },
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
    const targetId = loopEditTargetId.peek();
    const target = targetId === null
      ? null
      : currentLoopClips().find((clip) => clip.loopId === targetId) ?? null;
    if (dialogMode.peek() !== 'loop-edit' || !target) return false;
    if (loopOpGuard() !== null || repeatError.peek() !== null) return false;
    const draftRepeat: number | 'infinity' | null = infinity.peek() ? 'infinity' : parsedRepeat.peek().count;
    if (draftRepeat === null) return false;
    if (draftRepeat === target.repeat) { closeConfirmation(); return true; } // no phantom history entry
    const snapshot = loopPreflightSnapshot.peek();
    const currentLoops = currentLoopClips();
    const cycleDuration = snapshot
      ? derivePhysicPaintRotoLoopRanges({
          identities: snapshot.identities,
          loopClips: currentLoops,
          capacity: snapshot.capacity,
          interpolationEnabled: snapshot.interpolationEnabled,
        }).ranges.find((range) => range.loopId === target.loopId)?.cycleLength ?? target.sourceKeyIds.length
      : target.sourceKeyIds.length;
    let rebuiltLifecycle: Pick<PhysicPaintRotoLoopClip, 'originalEndExclusive' | 'visibleRanges'> | null = null;
    if (target.phaseOrigin !== undefined
      && target.originalEndExclusive !== undefined
      && target.visibleRanges !== undefined) {
      const originalEndExclusive = draftRepeat === 'infinity'
        ? (() => {
            if (!snapshot) return target.originalEndExclusive!;
            const draftLoops = currentLoops.map((clip) => (clip.loopId === target.loopId
              ? { ...clip, repeat: draftRepeat }
              : clip));
            const targetRanges = derivePhysicPaintRotoLoopRanges({
              identities: snapshot.identities,
              loopClips: draftLoops,
              capacity: snapshot.capacity,
              interpolationEnabled: snapshot.interpolationEnabled,
            }).ranges.filter((range) => range.loopId === target.loopId);
            const draftTarget = draftLoops.find((clip) => clip.loopId === target.loopId);
            return draftTarget
              ? resolvePhysicPaintRotoGroupEffectiveEnd(draftTarget, targetRanges)
              : target.originalEndExclusive!;
          })()
        : target.phaseOrigin + cycleDuration * draftRepeat;
      if (target.frameOverrides?.some((override) => override.appFrame >= originalEndExclusive)) {
        fail(new Error('Repeat cannot remove locally painted Rail frames. Regenerate the Rail first.'));
        return false;
      }
      const visibleRanges = target.visibleRanges.flatMap((range) => {
        const start = Math.max(target.phaseOrigin!, range.start);
        const endExclusive = Math.min(originalEndExclusive, range.endExclusive);
        return endExclusive > start ? [{ start, endExclusive }] : [];
      });
      if (originalEndExclusive > target.originalEndExclusive) {
        const last = visibleRanges[visibleRanges.length - 1];
        if (last?.endExclusive === target.originalEndExclusive) {
          visibleRanges[visibleRanges.length - 1] = { ...last, endExclusive: originalEndExclusive };
        } else {
          visibleRanges.push({
            start: target.originalEndExclusive,
            endExclusive: originalEndExclusive,
          });
        }
      }
      if (visibleRanges.length === 0) {
        fail(new Error('Repeat cannot remove every surviving Rail frame.'));
        return false;
      }
      rebuiltLifecycle = { originalEndExclusive, visibleRanges };
    }
    const stagedLoops = currentLoops.map((clip) => (clip.loopId === target.loopId
      ? { ...clip, repeat: draftRepeat, ...(rebuiltLifecycle ?? {}) }
      : clip));
    const result = await runLoopOp(
      target.loopId,
      () => stagedLoops,
      `Loop updated · Cycle ${cycleDuration}f × ${draftRepeat === 'infinity' ? '∞' : draftRepeat}`,
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
          capacity: authority.physicalCapacity,
          interpolationEnabled: authority.interpolationEnabled,
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
    if (railTab.peek() === 'reveal') return confirmReveal();
    return confirmGeneration();
  }

  /* 52-05 (G-52-3): the Reveal Photo Rail confirm — creation IS the first bake
     (D-11), routed through the SAME create-reveal-rail mutation as every reveal
     path (the rail lands baked, one undo entry). The D-12 reference guard is
     proactive: no reference → the Photo Reference modal opens so the user places
     a source and returns; never a silent disabled state, never a bare error.
     The bake rides the shared phase/abort machinery, so the footer's
     "Cancel generation" aborts mid-span with no keys written (D-11). */
  async function confirmReveal(): Promise<boolean> {
    const selectedId = ports.library.selectedId.peek();
    const context = ports.getLaunchContext();
    const start = canonicalStart.peek();
    const count = parsedRevealCount.peek().count;
    if (disposed || !selectedId || !context?.project || start === null || count === null || repeatError.peek() !== null) return false;
    if (disabledReason.peek()) return false;
    if (!revealReferencePlaced.peek()) { ports.openPhotoReference?.(); return false; }
    if (!ports.createReveal) return false;
    const repeatDraft: number | 'infinity' | null = infinity.peek() ? 'infinity' : parsedRepeat.peek().count;
    if (repeatDraft === null) return false;
    const acceptedGeneration = ++generation;
    abortController = new AbortController();
    const bakeSignal = abortController.signal;
    ports.stopPlayback();
    phase.value = 'rendering'; progress.value = { completed: 0, total: count }; status.value = `Baking 0 / ${count}`; error.value = null;
    // G-52-10: a createReveal REJECTION must land in 'failed' (a closeable
    // state) — propagating it would leave phase stuck at 'rendering' while
    // closeConfirmation refuses to close during a busy phase.
    try {
      const result = await ports.createReveal({
        layerId: context.layerId,
        trackId: ports.getActiveTrackId(context.layerId),
        scriptId: selectedId,
        variant: mode.peek(),
        startFrame: start,
        frameCount: count,
        repeat: repeatDraft,
        motion: { ...dialogMotion.peek() },
        signal: bakeSignal,
        onProgress: (completed, total) => { if (generation === acceptedGeneration) { progress.value = { completed, total }; status.value = `Baking ${completed} / ${total}`; } },
      });
      if (disposed || generation !== acceptedGeneration || bakeSignal.aborted) {
        if (!disposed) { phase.value = 'cancelled'; progress.value = null; status.value = 'Reveal bake cancelled'; error.value = null; ports.log(status.value); }
        return false;
      }
      abortController = null;
      if (!result.ok) {
        phase.value = 'failed'; progress.value = null; status.value = 'Reveal Rail failed'; error.value = result.reason; ports.log(result.reason, true);
        return false;
      }
      const bakedMotion = { ...dialogMotion.peek() };
      hasSuccessfulGeneration = true;
      appliedSummaryLine1.value = `${mode.peek() === 'static' ? 'Reveal Static' : 'Reveal Motion'} · Motion ${bakedMotion.deformation}/${bakedMotion.position}`;
      appliedSummaryLine2.value = `F${start} · Reveal rail baked · Cycle ${count}f × ${repeatDraft === 'infinity' ? '∞' : repeatDraft}`;
      phase.value = 'complete'; progress.value = { completed: count, total: count };
      status.value = `Reveal Rail complete · ${count} frames`;
      confirmationOpen.value = false; ports.log(status.value); return true;
    } catch (cause) {
      if (disposed) return false;
      if (isAbort(cause) || bakeSignal.aborted) {
        if (generation === acceptedGeneration) { phase.value = 'cancelled'; progress.value = null; status.value = 'Reveal bake cancelled'; error.value = null; ports.log(status.value); }
        return false;
      }
      if (generation === acceptedGeneration) {
        const message = cause instanceof Error ? cause.message : String(cause);
        phase.value = 'failed'; progress.value = null; status.value = 'Reveal Rail failed'; error.value = message; ports.log(message, true);
      }
      return false;
    } finally { if (generation === acceptedGeneration) abortController = null; }
  }

  async function confirmGeneration(): Promise<boolean> {
    const isSourceEdit = dialogMode.peek() === 'source-edit';
    const editTarget = isSourceEdit ? loopEditTarget.peek() : null;
    const repairId = isSourceEdit ? sourceEditRepairId.peek() : null;
    const preparedRegenerate = isSourceEdit && repairId === null ? regenerateImpact.peek() : null;
    // Source-edit/repair render the PROVENANCE script (D-02/D-31); apply renders the library selection.
    const selectedId = isSourceEdit ? (editTarget?.scriptId ?? null) : ports.library.selectedId.peek();
    const context = ports.getLaunchContext();
    const start = canonicalStart.peek();
    const count = parsedCount.peek().count;
    const startingSelection = ports.getSelection();
    if (disposed || !selectedId || !context?.project || start === null || count === null || repeatError.peek() !== null) return false;
    if (isSourceEdit) {
      if (!editTarget || loopOpGuard() !== null) return false;
      if (preparedRegenerate) {
        const currentAction = ports.library.rows.peek().find((row) => row.id === preparedRegenerate.actionId);
        if (!currentAction || currentAction.revision !== preparedRegenerate.actionRevision) {
          fail(new Error('Regenerate rejected — saved Action changed.'));
          return false;
        }
        const currentDocument = ports.getPhysicalDocument?.() ?? null;
        if (!currentDocument || currentDocument.revision !== preparedRegenerate.documentRevision) {
          fail(new Error('Regenerate rejected — physical Rail document changed.'));
          return false;
        }
        if (count !== preparedRegenerate.storedSettings.sourceKeyIds.length) {
          fail(new Error('Regenerate rejected — stored Rail settings changed.'));
          return false;
        }
        const currentTarget = currentDocument.loopClips.find((group) => group.loopId === preparedRegenerate.initiatingGroupId);
        const reason = currentTarget ? groupRegenerateReason(currentTarget, currentDocument) : 'Regenerate unavailable — Rail source is unresolved.';
        if (reason) {
          fail(new Error(reason));
          return false;
        }
      }
    } else if (disabledReason.peek() || startingSelection.appFrame !== start) return false;

    const acceptedGeneration = ++generation;
    abortController = new AbortController();
    ports.stopPlayback();
    phase.value = 'preparing'; progress.value = null; status.value = 'Preparing Play Script…'; error.value = null;
    try {
      const authority = await ports.requestAuthority(nextOperationId('confirm'), start);
      assertCurrent(acceptedGeneration);
      if (!authority.ok || count > authority.capacity) throw new Error(authority.error ?? 'Requested frame count exceeds current capacity.');
      const motion = preparedRegenerate
        ? { ...preparedRegenerate.storedSettings.motion }
        : { ...dialogMotion.peek() };
      const renderMode = preparedRegenerate ? preparedRegenerate.storedSettings.mode : mode.peek();
      // Regenerate restores the frozen accepted Group settings. Apply and legacy
      // Source Edit retain their existing confirm-time color behavior.
      const renderOverrideColor = preparedRegenerate
        ? preparedRegenerate.storedSettings.overrideColor
        : resolveOverrideColor();
      const rotoBackground = { ...ports.getBackgroundMetadata() };

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
          rotoBackground,
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
      if (preparedRegenerate) {
        const currentAction = ports.library.rows.peek().find((row) => row.id === preparedRegenerate.actionId);
        if (!currentAction || currentAction.revision !== preparedRegenerate.actionRevision
          || actionSnapshotHash(snapshot) !== preparedRegenerate.actionHash) {
          throw new Error('Regenerate rejected — saved Action changed.');
        }
      }
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
      if (preparedRegenerate) {
        const currentDocument = ports.getPhysicalDocument?.() ?? null;
        const currentAction = ports.library.rows.peek().find((row) => row.id === preparedRegenerate.actionId);
        if (!currentDocument || currentDocument.revision !== preparedRegenerate.documentRevision) {
          throw new Error('Regenerate rejected — physical Rail document changed.');
        }
        if (!currentAction || currentAction.revision !== preparedRegenerate.actionRevision) {
          throw new Error('Regenerate rejected — saved Action changed.');
        }
      }
      // D-06: refresh the preflight substrate from the revalidated authority so
      // the warning surfaced on the confirm path is computed against the exact
      // pre-commit physical state (revision equality above makes this a
      // no-cost refresh of an identical snapshot).
      loopPreflightSnapshot.value = {
        identities: commitAuthority.physicalRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        parentEndExclusive: commitAuthority.layerEndExclusive,
        capacity: commitAuthority.physicalCapacity,
        interpolationEnabled: commitAuthority.interpolationEnabled,
      };
      const currentSelection = ports.getSelection();
      if (!isSourceEdit && (
        ports.library.selectedId.peek() !== selectedId
        || currentSelection.kind === 'generated-interpolation'
        || currentSelection.appFrame !== start
        || currentSelection.keyId !== startingSelection.keyId
      )) throw new Error('Play Script start, physical key identity, or selected preset changed before commit.');
      const sourceEditDestinationAppFrames = isSourceEdit && !repairId && editTarget && count === editTarget.sourceKeyIds.length
        ? editTarget.sourceKeyIds.map((keyId) => {
            const record = commitAuthority.physicalRecords.find((candidate) => candidate.keyId === keyId);
            if (!record) throw new Error('Source cycle identity changed before commit.');
            return record.appFrame;
          })
        : undefined;
      if (sourceEditDestinationAppFrames
        && sourceEditDestinationAppFrames.some((appFrame, index) => index > 0 && sourceEditDestinationAppFrames[index - 1]! >= appFrame)) {
        throw new Error('Source cycle timing changed before commit.');
      }
      const basePublication = buildPhysicalPublication({
        authority: commitAuthority,
        staged,
        start,
        count,
        ...(sourceEditDestinationAppFrames ? { destinationAppFrames: sourceEditDestinationAppFrames } : {}),
        expectedLaunch: { operationId: context.operationId, layerId: context.layerId },
        rotoBackground,
      });
      // 43-06: loop state rides the SAME staged publication (HOLD-03 — no
      // second commit path). Same-count Source Edit maps the rendered outputs
      // back onto the current ordered source positions; count-changing flows
      // retain the existing contiguous regeneration behavior.
      const cycleAppFrames = sourceEditDestinationAppFrames ?? Array.from({ length: count }, (_, index) => start + index);
      const recordByAppFrame = new Map(basePublication.records.map((record) => [record.appFrame, record]));
      const cycleKeyIds = cycleAppFrames.map((appFrame) => {
        const record = recordByAppFrame.get(appFrame);
        if (!record) throw new Error(`Committed source cycle is missing frame ${appFrame}.`);
        return record.keyId;
      });
      let loopClips: readonly PhysicPaintRotoLoopClip[] | undefined;
      /** 52 UAT (AM-4): staged breaks for a NEW-cycle Apply — absent otherwise. */
      let publicationIncomingInterpolationBreakKeyIds: readonly string[] | undefined;
      let regeneratedRecords: readonly PhysicPaintRotoRealKeyRecord[] | null = null;
      let regeneratedGroupOverrideRecords: readonly PhysicPaintRotoRealKeyRecord[] | null = null;
      let regenerateSemanticDelta: RotoRegenerateGroupSemanticDelta | null = null;
      if (repairId) {
        // D-31 repair: regenerate + retarget the loop's sourceKeyIds atomically.
        loopClips = currentLoopClips().map((clip) => (clip.loopId === repairId
          ? { ...clip, sourceKeyIds: Object.freeze([...cycleKeyIds]), mode: renderMode, scriptId: selectedId, motion: { ...motion }, overrideColor: renderOverrideColor }
          : clip));
      } else if (isSourceEdit && editTarget && preparedRegenerate) {
        const acceptedDocument = ports.getPhysicalDocument?.() ?? null;
        if (!acceptedDocument || acceptedDocument.revision !== preparedRegenerate.documentRevision) {
          throw new Error('Regenerate rejected — physical Rail document changed.');
        }
        let proposalDocument: PhysicPaintRotoPhysicalDocument = {
          ...acceptedDocument,
          realKeyRecords: basePublication.records,
          revision: buildPhysicPaintRotoPhysicalRevision(
            basePublication.records,
            acceptedDocument.interpolation,
            acceptedDocument.loopClips,
            acceptedDocument.incomingInterpolationBreakKeyIds,
            acceptedDocument.groupOverrideRecords,
          ),
        };
        for (const affected of preparedRegenerate.affectedGroups) {
          const proposal = proposePhysicPaintRotoRegenerateGroup({
            document: proposalDocument,
            groupId: affected.groupId,
            expectedActionRevision: preparedRegenerate.actionRevision,
            currentActionRevision: preparedRegenerate.actionRevision,
          });
          if (!proposal.ok) throw new Error(`Regenerate rejected — ${proposal.reason}.`);
          proposalDocument = proposal.proposal;
        }
        const retainedOverrideKeyIds = new Set(
          (proposalDocument.groupOverrideRecords ?? []).map((record) => record.keyId),
        );
        regenerateSemanticDelta = Object.freeze({
          kind: 'regenerate-group',
          groupId: preparedRegenerate.initiatingGroupId,
          expectedActionRevision: preparedRegenerate.actionRevision,
          cleanupKeyIds: Object.freeze((acceptedDocument.groupOverrideRecords ?? [])
            .map((record) => record.keyId)
            .filter((keyId) => !retainedOverrideKeyIds.has(keyId))
            .sort()),
          previousRevision: acceptedDocument.revision,
          nextRevision: proposalDocument.revision,
        });
        loopClips = proposalDocument.loopClips;
        regeneratedRecords = proposalDocument.realKeyRecords;
        regeneratedGroupOverrideRecords = proposalDocument.groupOverrideRecords ?? [];
      } else if (isSourceEdit && editTarget) {
        // Legacy Source Edit updates every pre-lifecycle loop sharing the cycle.
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
        // 52 UAT (AM-4): a new rail never receives incoming interpolation —
        // the cycle's FIRST committed key owns the leading break so a previous
        // rail's last real key cannot interpolate forward into it. Any break
        // owner whose record the new cycle's span replaced is pruned (the
        // parent's parsePhysicPaintRotoIncomingInterpolationBreakKeyIds rejects
        // orphans fail-closed); a re-Apply over the SAME span keeps exactly one
        // leading break on the preserved first key identity.
        const survivingKeyIds = new Set(basePublication.records.map((record) => record.keyId));
        const currentBreakOwners = ports.getPhysicalDocument?.()?.incomingInterpolationBreakKeyIds ?? [];
        const prunedBreaks = currentBreakOwners.filter((keyId) => survivingKeyIds.has(keyId));
        const leadingKeyId = cycleKeyIds[0];
        publicationIncomingInterpolationBreakKeyIds = prunedBreaks.includes(leadingKeyId)
          ? prunedBreaks
          : Object.freeze([...prunedBreaks, leadingKeyId]);
      }
      const publicationRecords = regeneratedRecords ?? basePublication.records;
      const publication: RotoGeneratedPhysicalPublication = regenerateSemanticDelta
        ? {
            ...basePublication,
            records: publicationRecords,
            groupOverrideRecords: regeneratedGroupOverrideRecords ?? [],
            semanticDelta: regenerateSemanticDelta,
            ...resolvePublicationSelection(commitAuthority),
            loopClips: loopClips ?? [],
          }
        : isSourceEdit
          ? {
              ...basePublication,
              records: publicationRecords,
              semanticDelta: {
                ...basePublication.semanticDelta,
                proposedRecords: publicationRecords.map(toPhysicalEditRecord),
                preserveSelection: true,
              },
              ...resolvePublicationSelection(commitAuthority),
              ...(loopClips ? { loopClips } : {}),
            }
          : {
              ...basePublication,
              ...(loopClips ? { loopClips } : {}),
              ...(publicationIncomingInterpolationBreakKeyIds
                ? { incomingInterpolationBreakKeyIds: publicationIncomingInterpolationBreakKeyIds }
                : {}),
            };
      phase.value = 'committing';
      status.value = preparedRegenerate ? 'Committing Rail Regenerate…' : 'Committing Play Script…';
      abortController = null;
      const revalidateUnderLease = preparedRegenerate ? async (): Promise<string | null> => {
        const currentDocument = ports.getPhysicalDocument?.() ?? null;
        if (!currentDocument || currentDocument.revision !== preparedRegenerate.documentRevision) {
          return 'Regenerate rejected — physical Rail document changed.';
        }
        const currentAction = ports.library.rows.peek().find((row) => row.id === preparedRegenerate.actionId);
        if (!currentAction || currentAction.revision !== preparedRegenerate.actionRevision) {
          return 'Regenerate rejected — saved Action changed.';
        }
        const currentSnapshot = await ports.library.loadSnapshot(preparedRegenerate.actionId);
        if (!currentSnapshot || actionSnapshotHash(currentSnapshot) !== preparedRegenerate.actionHash) {
          return 'Regenerate rejected — saved Action changed.';
        }
        return null;
      } : undefined;
      const result = await ports.commit(publication, revalidateUnderLease);
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
      phase.value = 'complete';
      progress.value = { completed: count, total: count };
      status.value = preparedRegenerate
        ? `Rail Regenerate complete · ${preparedRegenerate.affectedGroups.length} Rail${preparedRegenerate.affectedGroups.length === 1 ? '' : 's'}`
        : `Play Script complete · ${count} frames`;
      confirmationOpen.value = false; ports.log(status.value); return true;
    } catch (cause) {
      if (isAbort(cause)) { phase.value = 'cancelled'; status.value = 'Play Script cancelled'; error.value = null; ports.log(status.value); }
      else fail(cause);
      return false;
    } finally { if (generation === acceptedGeneration) abortController = null; }
  }

  function assertPublicationAck(publication: RotoGeneratedPhysicalPublication, result: Extract<RotoPlayScriptCommitResult, { ok: true }>): void {
    const acknowledgedSelectedAppFrame = result.selectedKeyId === null ? null : result.selectedAppFrame;
    if (result.interpolationMode !== publication.interpolationMode
      || result.selectedKeyId !== publication.selectedKeyId
      || acknowledgedSelectedAppFrame !== publication.selectedAppFrame
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
    confirmationOpen, countText, max, lastFiniteCount, capacity, canonicalStart, mode, overrideEnabled, dialogMotion, repeatText, infinity, lastFiniteRepeat, layerEndExclusive, parsedRepeat, repeatError, loopReadout, loopShortenPreflight, appliedSummary: { line1: appliedSummaryLine1, line2: appliedSummaryLine2 }, destinationRange, validationError, disabledReason, phase, progress, status, error, canCancel,
    dialogMode, loopEditTargetId, loopEditTarget, loopEditSourceStart, sourceEditSharedLoopCount, regenerateDisabledReason, regenerateImpact, loopIntentActive, identicalSourceCycle, linkChoice,
    openLoopEdit, openSourceEdit, repairLoop, updateLoop, unlinkLoop, duplicateLinkedLoop, relinkLoop, findIdenticalSourceCycle,
    railTab, revealCountText, parsedRevealCount, revealValidationError, revealReferencePlaced, setRailTab, requestPhotoReference,
    openConfirmation, closeConfirmation, confirm, cancel, setMax, setInfinity, resetDialogMotion, dispose: () => { disposed = true; generation += 1; stopStaticDefaults(); abortController?.abort(); abortController = null; },
  };
}

function parseCount(value: string, capacity: number): { count: number | null; error: string | null } {
  const text = value.trim();
  if (!text || !/^\d+$/.test(text)) return { count: null, error: 'Enter a positive integer.' };
  const count = Number(text);
  if (!Number.isSafeInteger(count) || count <= 0) return { count: null, error: 'Enter a positive integer.' };
  if (count > capacity) return { count: null, error: `Maximum available count is ${capacity}.` };
  return { count, error: null };
}

/** 52-05 (G-52-3): the reveal span default when the script's natural duration is unknown (D-20). */
const DEFAULT_REVEAL_FRAME_COUNT = 3;

/* ---- 52-05 (G-52-3): the reveal fail-closed copy (52 UI-SPEC Copywriting Contract) ---- */

/** The locked empty-reference guard copy. */
export const REVEAL_UNAVAILABLE_NO_REFERENCE_COPY = 'Reveal unavailable — no reference placed. Place a reference to replay.';

/** The locked deleted-script fail-closed copy. */
export const REVEAL_UNAVAILABLE_SCRIPT_DELETED_COPY = 'Reveal unavailable — script deleted. Re-link a script to replay.';

/** Map a create-reveal-rail rejection reason to the locked fail-closed copy (D-12/D-13). */
export function mapRevealRailRejectionReason(reason: string): string {
  switch (reason) {
    case 'no-photo-reference':
      return REVEAL_UNAVAILABLE_NO_REFERENCE_COPY;
    case 'script-not-found':
      return REVEAL_UNAVAILABLE_SCRIPT_DELETED_COPY;
    case 'no-track':
      return 'Reveal unavailable — no target track.';
    case 'script-loader-unavailable':
      return 'Reveal unavailable — script library is not ready.';
    case 'invalid-variant':
      return 'Reveal unavailable — invalid variant.';
    case 'invalid-span':
      return 'Reveal unavailable — invalid span.';
    case 'bake-failed':
      return 'Reveal bake failed. Nothing changed.';
    case 'loop-clip-failed':
      return 'Reveal rail creation failed. Nothing changed.';
    default:
      return 'Reveal unavailable — no document.';
  }
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
  readonly destinationAppFrames?: readonly number[];
  readonly expectedLaunch: RotoPlayScriptPhysicalPublication['expectedLaunch'];
  readonly rotoBackground: PhysicPaintRotoBackgroundMetadata;
}): RotoPlayScriptPhysicalPublication {
  const { authority, staged, start, count, destinationAppFrames, expectedLaunch, rotoBackground } = input;
  const targetAppFrames = destinationAppFrames ?? Array.from({ length: count }, (_, index) => start + index);
  const affectedStartAppFrame = targetAppFrames[0] ?? start;
  const affectedEndAppFrame = targetAppFrames[targetAppFrames.length - 1] ?? start + count - 1;
  if (count <= 0
    || targetAppFrames.length !== count
    || targetAppFrames.some((appFrame, index) => !Number.isInteger(appFrame)
      || appFrame < 0
      || (index > 0 && targetAppFrames[index - 1]! >= appFrame))
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
  for (let index = 0; index < targetAppFrames.length; index += 1) {
    const stagedAppFrame = start + index;
    const appFrame = targetAppFrames[index];
    const frame = stagedByFrame.get(stagedAppFrame);
    if (!frame) throw new Error(`Rendered Play Script output is missing frame ${stagedAppFrame}.`);
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
  const selected = currentByFrame.get(affectedStartAppFrame);
  if (!selected) throw new Error('Play Script start destination is missing from the physical proposal.');
  const proposedRecords = records.map(toPhysicalEditRecord);
  return {
    expectedLaunch,
    expectedRevision: authority.physicalRevision,
    records,
    interpolationEnabled: authority.interpolationEnabled,
    interpolationMode: authority.interpolationMode,
    rotoBackground,
    semanticDelta: {
      kind: 'play-script',
      affectedStartAppFrame,
      affectedEndAppFrame,
      expectedLayerCapacity: authority.physicalCapacity,
      expectedLayerEndExclusive: authority.layerEndExclusive,
      proposedRecords,
      freshKeyIds,
    },
    selectedKeyId: selected.keyId,
    selectedAppFrame: affectedStartAppFrame,
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
