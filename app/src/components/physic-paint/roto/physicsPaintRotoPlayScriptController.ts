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
import type { RotoPaintScript } from './physicsPaintRotoScriptClipboard';
import {
  canonicalizePhysicPaintRotoLoopClips,
  compactPhysicPaintRotoMotion,
  createPhysicPaintRotoKeyId,
  PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY,
  type PhysicPaintRotoGroupFrameOverride,
  type PhysicPaintRotoGroupVisibleRange,
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
import { isWebpBytes } from '../../../types/physicPaint';
import { encodeWebpFrame } from '../../../lib/webpFrameCodec';
import { recordAquarelleRenderSplitEvent } from '../performance/aquarelleRenderSplitCapture';
import type { EngineAdapter, StudioStroke } from '@efxlab/efx-paint-host';
import type { AquarelleStrokePayload } from '@efxlab/efx-watercolor/payload';
import { toStudioStroke, type AquarellePayloadEvent, type AquarelleStroke } from '@efxlab/efx-watercolor/payload';
import { getRecordedAquarelleDryEvents, getRecordedAquarellePayload, getRecordedAquarelleStroke, isAquarelleStrokeDeleted } from '../view/aquarelleRecordState';
import {
  createAquarelleBake as defaultCreateAquarelleBake,
  type AquarelleBake,
  type AquarelleBakeDiagnostics,
  type AquarelleBakeOptions,
  type AquarelleBakePaper,
  type AquarelleStrokeFrameAnchor,
} from '@efxlab/efx-watercolor/bake';
import { paperPresetForStudioId } from '../engine/AquarelleCanvasLayer';
import { applyAquarelleSheetRigidWiggle, createAquarelleDeformPoser, drawAquarelleSheetDeform } from './aquarelleFramePose';
import { sliceRailKeyScripts, type RailKeyScriptResult } from './physicsPaintRotoRailKeyScripts';
import {
  buildRunScriptStackReadout,
  mergeStackedSourceKeyIds,
  planRunScriptStackExtension,
  planRunScriptStackLifecycle,
  resolveRunScriptDestination,
  resolveRunScriptStackBoundary,
  toRunScriptRailViews,
  RUN_SCRIPT_KEEP_SCRIPT_DEFAULT,
  type RunScriptCollisionOffer,
  type RunScriptDestination,
  type RunScriptRailView,
  type RunScriptStackBoundary,
  type RunScriptStackReadout,
} from './physicsPaintRotoRunScriptStacking';

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
  readonly motion: Readonly<{ deformation: number; position: number; rotation?: number; scale?: number }>;
  /**
   * 261029-vbp: tint the revealed photo with the wash pigment. The mix is
   * always an integer 0-100 and 100 whenever colorize is on; creation writes
   * the pair on the rail ONLY when colorize is true.
   */
  readonly colorize: boolean;
  readonly colorizeMix: number;
  /** 261030-ey9: move photo + wash as one rigid unit per held frame. */
  readonly photoWiggle: boolean;
  /**
   * 261030-ig0: save each key's script settings. Optional so every existing
   * caller and harness omits it, absent meaning off.
   */
  readonly keyScriptEdits?: boolean;
  /**
   * 261030-v1t: one salted from-scratch replay per output frame. Optional like
   * keyScriptEdits; absent means off (today's reveal pixels exactly).
   */
  readonly paintSeedVariation?: boolean;
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

/**
 * 261031-i54: the open stack collision — the run crosses another rail's start
 * or the repeat-extended lifecycle crosses the parent end, so an explicit
 * Cancel / Truncate (default) / Overwrite choice is required. `null` when the
 * run is free. (A frame override inside the span is legal since 261031-qps.)
 */
export interface RotoPlayScriptStackCollision {
  readonly boundaryExclusive: number;
  readonly blocker: RunScriptStackBoundary['blocker'];
  readonly victimClipId: string | null;
  /** The written span would cross the boundary. */
  readonly runCollision: boolean;
  /** The repeat-extended lifecycle would cross the parent end. */
  readonly lifecycleOverflow: boolean;
  /** The parent range end the RAIL would cross (lifecycle overflow only). */
  readonly parentEndExclusive: number | null;
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
    motion: { readonly deformation: number; readonly position: number; readonly rotation?: number; readonly scale?: number };
    overrideColor: string | null;
    sourceKeyIds: readonly string[];
    /** 261030-v1t: the Group's creation flag, restored by Regenerate so the
     *  re-bake reproduces the accepted pixels. */
    paintSeedVariation: boolean;
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
  readonly motion: {
    readonly deformation: number;
    readonly position: number;
    readonly rotation?: number;
    readonly scale?: number;
  };
  readonly overrideColor: string | null;
  /** 261030-v1t: the draft per-frame paint-seed variation — a cycle only links
   *  to one baked with the same flag (different texture = different content). */
  readonly paintSeedVariation: boolean;
  readonly start: number;
  readonly loopClips: readonly PhysicPaintRotoLoopClip[];
  readonly identities: readonly PhysicPaintRotoKeyIdentity[];
}

/**
 * 261031-dm1: per-request authority options. Only the Create Rail open asks
 * for `identitiesOnly` — every byte-carrying consumer keeps the default full
 * mode by passing no options at all.
 */
export interface RotoPlayScriptAuthorityRequestOptions {
  readonly identitiesOnly?: boolean;
}

export interface RotoPlayScriptControllerPorts {  library: RotoScriptLibraryController;
  getLaunchContext: () => PhysicPaintLaunchContext | null;
  /** 47-01: resolve the DOCUMENT's current active track — the launch snapshot
   * is stale after an in-place track switch (row click / add / duplicate). */
  getActiveTrackId: (layerId: string) => string;
  getSelection: () => { kind: RotoTimelineSelectionKind; keyId: string | null; appFrame: number };
  getMotion: () => { deformation: number; position: number; rotation?: number; scale?: number };
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
  /**
   * WR-13: the scalar physical-content revision. The Studio reads it straight
   * from the store's existing signal so the availability snapshot never has to
   * parse the whole document during render.
   */
  physicalRevision?: ReadonlySignal<number>;
  /* ---- 52-05 (G-52-3): the Reveal Photo Rail tab ports ---- */
  /** True when the layer has a photo reference with a source — the D-12 creation guard. */
  hasPhotoReference?: () => boolean;
  /** Bumped on every document mutation so the reference guard re-resolves live. */
  photoReferenceRevision?: ReadonlySignal<number>;
  /** Guard action: open the Photo Reference modal so the user places a source, then return. */
  openPhotoReference?: () => void;
  /** The create-reveal-rail mutation (Plan 01) — creation IS the first bake (D-11). */
  createReveal?: (input: RotoRevealRailCreateInput) => Promise<RotoRevealRailCreateResult>;
  /**
   * 261030-np9 (D-04): the ONE recording seam for per-key rail scripts. The
   * controller decides WHICH strokes land on WHICH key (D-02) and never mints
   * mutation ids — the Studio's ledger mints them behind this port. Absent
   * port = no recording, which is the keyScriptEdits OFF path.
   */
  recordRailKeyScripts?: (input: {
    readonly keyIds: readonly string[];
    readonly slices: readonly RailKeyScriptResult[];
    /**
     * 261031-i54/261031-qps: how the slice strokes land on the key. 'replace' is
     * the flag-on Keep-script-OFF law (purge the frame and pin the known-empty
     * base); 'append' records the strokes on top of the key's existing script
     * (Keep script ON — the authority-backed union re-bake path); 'none' writes
     * nothing (a pixel-only rail with Keep OFF flattens the run over its
     * picture and never records, purges or pins).
     */
    readonly recordMode: 'append' | 'replace' | 'none';
  }) => void;
  /**
     * 261031-i54/261031-qps: the Keep-script-ON union re-bake. One batch call
     * for the whole written span — `keyIds` is slot-aligned with `slices`.
     * Each touched key's durable base resolves through the ONE authority: a
     * known-empty base publishes the raw union (recorded events + this run), a
     * bytes base multiply-composites it, and a refusal aborts the run before
     * the single commit. Fresh bases are pinned by the port before it returns.
     */
  bakeStackedRailKey?: (input: {
    readonly keyIds: readonly string[];
    readonly slices: readonly RailKeyScriptResult[];
  }) => Promise<
    | { kind: 'baked'; frames: readonly { readonly appFrame: number; readonly bytes: Uint8Array }[] }
    | { kind: 'refused'; reason: string }
  >;
  /**
   * 261031-i54 UAT: the pixel-only stack composite. A rail created without
   * per-key scripts stores PIXELS, not a script; its touched keys must be
   * composited over their CURRENT payload instead of being replaced (the old
   * replace path pinned the base empty and erased the picture). Absent port or
   * a refusal fails the whole run closed before commit.
   */
  composeStackedRailKey?: (input: {
    readonly keyId: string;
    readonly appFrame: number;
    readonly strokes: readonly AquarelleStroke[];
  }) => Promise<{ kind: 'baked'; bytes: Uint8Array } | { kind: 'refused'; reason: string }>;
  /**
   * 261031-qps (Quick B): the Reveal rail's render-only tail bake. Every
   * touched frame renders through the rail's currently placed photo reference
   * (same photo, new wash) and NO key record or interpolation break is written
   * — the controller assembles the bytes into the single publication and
   * asserts full frame coverage before commit. Absent port or a refusal fails
   * the whole run closed; plain-paper bytes never reach a reveal frame.
   */
  bakeRevealStackTail?: (input: {
    readonly slices: readonly RailKeyScriptResult[];
    readonly frames: readonly number[];
    readonly scriptEvents: readonly AquarellePayloadEvent[];
    readonly mode: 'progressive' | 'static';
    readonly motion: Readonly<{ deformation: number; position: number; rotation?: number; scale?: number }>;
    readonly colorize: boolean;
    readonly colorizeMix: number;
    readonly photoWiggle: boolean;
    readonly paintSeedVariation: boolean;
    readonly signal: AbortSignal;
    readonly onProgress?: (completed: number, total: number) => void;
  }) => Promise<
    | {
        kind: 'baked';
        frames: readonly {
          readonly appFrame: number;
          readonly frameIndex: number;
          readonly bytes: Uint8Array;
          readonly width: number;
          readonly height: number;
        }[];
        anchors: readonly AquarelleStrokeFrameAnchor[];
      }
    | { kind: 'refused'; reason: string }
  >;
  /** The script's natural duration at the current motion parameters (D-20); null → default. */
  getScriptNaturalDuration?: (scriptId: string) => number | null;
  requestAuthority: (
    operationId: string,
    start: number,
    options?: RotoPlayScriptAuthorityRequestOptions,
  ) => Promise<PhysicPaintRotoAuthorityResult>;
  commit: (
    publication: RotoGeneratedPhysicalPublication,
    revalidateUnderLease?: () => Promise<string | null>,
  ) => Promise<RotoPlayScriptCommitResult>;
  stopPlayback: () => void;
  log: (message: string, error?: boolean) => void;
  /**
   * 56-08: aquarelle bake consume branch. Defaults to createAquarelleBake
   * from @efxlab/efx-watercolor/bake (flush-survives-navigation, D-21).
   * Injectable for tests; never a second bake queue.
   */
  createAquarelleBake?: (
    adapter: EngineAdapter<AquarelleStrokePayload>,
    options?: AquarelleBakeOptions,
  ) => AquarelleBake;
  /**
   * 56-08: engine-2 adapter factory for the aquarelle bake. Absent port
   * falls back to createAquarelleEngineAdapter (lazy — keeps the fluid
   * engine out of the default UI chunk, 56-07 lean-subexport law).
   * 261017-fz3: `paper` carries the resolved Studio paper so the adapter
   * can engine.setPaper before the first applyStroke.
   */
  createAquarelleAdapter?: (size: { width: number; height: number }, paper?: AquarelleBakePaper) => EngineAdapter<AquarelleStrokePayload>;
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
  dialogMotion: Signal<{ deformation: number; position: number; rotation: number; scale: number }>;
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
  /** Target Loop Clip identity for loop-edit/source-edit; null otherwise. */
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
  /* ---- 261029-vbp: the Reveal tab colorize pair ---- */
  /** Tint the revealed photo with the script's wash pigment (off by default). */
  colorize: Signal<boolean>;
  /** Tint strength as an integer percent; 100 when colorize is enabled. */
  colorizeMix: Signal<number>;
  /** Write the flag; enabling writes the locked default mix 100. */
  setColorize: (enabled: boolean) => void;
  /** Clamp every write to an integer 0-100. */
  setColorizeMix: (value: number) => void;
  /* ---- 261030-ey9: the Reveal tab Photo wiggle ---- */
  /** Move photo + wash as one rigid unit per held frame (off by default). */
  photoWiggle: Signal<boolean>;
  /** Write the flag (event-handler path only — never a render body). */
  setPhotoWiggle: (enabled: boolean) => void;
  /* ---- 261030-ig0: per-key script editing (creation opt-in) ---- */
  /** Save each key's script settings so one key can be re-baked alone (off by default). */
  keyScriptEdits: Signal<boolean>;
  /** Write the flag; an unchanged write is a no-op (efx-preact-reactivity rule 3). */
  setKeyScriptEdits: (enabled: boolean) => void;
  /* ---- 261030-v1t: per-frame paint-seed variation (creation opt-in) ---- */
  /** Same strokes, new brush texture each frame (off by default). */
  paintSeedVariation: Signal<boolean>;
  /** Write the flag; an unchanged write is a no-op (efx-preact-reactivity rule 3). */
  setPaintSeedVariation: (enabled: boolean) => void;
  /* ---- 261031-i54: Run Script stacking onto an existing Paint rail ---- */
  /**
   * The live stacking target: resolved from the ports on every availability
   * revision (never from the dialog snapshot), so it is already correct before
   * the dialog opens and flips back to 'create' when the playhead leaves.
   */
  runDestination: ReadonlySignal<RunScriptDestination>;
  /** First written source-cycle frame; null when the destination is not a stack. */
  runStartAppFrame: ReadonlySignal<number | null>;
  /** The Task 1 boundary for the current draft count (null off the stack path). */
  stackBoundary: ReadonlySignal<RunScriptStackBoundary | null>;
  /** Free frames before the next boundary — Max and the Frames bound never use capacity. */
  stackMaxCount: ReadonlySignal<number>;
  /** The Frames stepper / header bound: stackMaxCount on a stack, capacity on creation. */
  framesMax: ReadonlySignal<number>;
  /** Resolved span, source-cycle offset and extension/truncation copy. */
  stackReadout: ReadonlySignal<RunScriptStackReadout | null>;
  /**
   * 261031-qps (Quick B): the pinned destination's rail kind. The dialog
   * composes a Reveal stack from it (Colorize / Photo wiggle / Paint seed
   * editable; Rail Type, Motion wiggle, Color and Key Script hidden).
   */
  stackRailKind: ReadonlySignal<'playscript' | 'reveal' | null>;
  /** Keep script draft — seeded ON only for a flag-on stack target, then user-owned. */
  keepScript: Signal<boolean>;
  keepScriptVisible: ReadonlySignal<boolean>;
  keepScriptEffective: ReadonlySignal<boolean>;
  keepScriptDisabledReason: ReadonlySignal<string | null>;
  /** The open collision prompt; null when the run is free or refused. */
  stackCollision: ReadonlySignal<RotoPlayScriptStackCollision | null>;
  collisionOffers: ReadonlySignal<readonly RunScriptCollisionOffer[]>;
  /** A stack destination never edits the rail's repeat — its Cycle/Never controls are hidden. */
  repeatLocked: ReadonlySignal<boolean>;
  /** The stack's seeded override color; null falls back to the live brush color. */
  stackOverrideColor: ReadonlySignal<string | null>;
  /** Adopt the app's current brush color as the stack's Custom color (no-op off a stack). */
  useBrushColor: () => void;
  setKeepScript: (enabled: boolean) => void;
  confirmStackCollision: (choice: RunScriptCollisionOffer) => Promise<boolean>;
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
  // UAT 261031-i54: the stack's color seed. The dialog owns the live brush
  // color for CREATION; a stack starts from the rail's stored color instead, so
  // opening and confirming without changes never recolors the rail by accident.
  const stackOverrideColor = signal<string | null>(null);
  const dialogMotion = signal<{ deformation: number; position: number; rotation: number; scale: number }>({ deformation: 0, position: 0, rotation: 0, scale: 0 });
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
  // 261029-vbp: colorize defaults OFF (today's reveal exactly); enabling writes
  // the locked 100 mix, and every apply-mode open resets both.
  const colorize = signal(false);
  const colorizeMix = signal(100);
  // 261030-ey9: Photo wiggle defaults OFF (today's reveal exactly); reset on
  // every apply-mode open beside colorize.
  const photoWiggle = signal(false);
  // 261030-ig0: "Save script on each key" defaults OFF (today's record); it is
  // an apply-mode CREATION setting, reset with the rest on every open — never
  // sticky across rails.
  const keyScriptEdits = signal(false);
  // 261030-v1t: per-frame paint-seed variation defaults OFF (today's pixels
  // exactly); an apply-mode CREATION setting, reset with the rest on every
  // open — never sticky across rails.
  const paintSeedVariation = signal(false);
  let generation = 0;
  let abortController: AbortController | null = null;
  let disposed = false;
  /** 56-08: live aquarelle bake (flush-survives-navigation). Survives dispose(). */
  let aquarelleBake: AquarelleBake | null = null;

  const disabledReason = computed(() => {
    ports.availabilityRevision?.value;
    if (!ports.library.selected.value) return 'Select a project script first.';
    if (ports.library.busy.value) return 'Finish the current script library operation.';
    if (ports.getOperationLocked() || isBusyPhase(phase.value)) return 'Finish the current Roto operation.';
    const context = ports.getLaunchContext();
    if (!context?.project?.saved) return 'Save the project first.';
    const selection = ports.getSelection();
    // 261031-i54: a generated frame INSIDE a rail is a valid stack start; outside
    // every rail the render-only refusal stands (destination 'create' or 'refuse').
    if (selection.kind === 'generated-interpolation' && runDestination.peek().kind !== 'stack') {
      return `Generated frame ${selection.appFrame} is render-only. Select an empty frame or a real Roto key to generate a Play Script.`;
    }
    return null;
  });
  /* 261031-i54: a stack run is bounded by the FREE SPAN before the next boundary
     (never the physical capacity), and a typed count above it must still parse so
     confirmStack raises the collision prompt instead of silently clamping. */
  const parsedCount = computed(() => {
    const destination = runDestination.value;
    if (destination.kind === 'stack') {
      if (max.value) {
        return stackMaxCount.value > 0
          ? { count: stackMaxCount.value, error: null }
          : { count: null, error: 'No free span remains before the next boundary.' };
      }
      return parseCount(countText.value, Math.max(stackMaxCount.value, capacity.value, 1));
    }
    return max.value
      ? capacity.value > 0
        ? { count: capacity.value, error: null }
        : { count: null, error: 'No real-key capacity remains.' }
      : parseCount(countText.value, capacity.value);
  });
  // 261031-qps (Quick B): a frame override inside the written span is legal —
  // its base resolves to the SOURCE key through the durable-base authority, so
  // there is no override validation error left to surface.
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
    // 261031-i54: a stack run has its own explicit collision surface — the
    // creation-time shorten advisory would describe a rail it never creates.
    if (runDestination.value.kind === 'stack') return null;
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
    // 261031-i54: a stack destination reports the RESOLVED span and the
    // source-cycle offset instead of the creation Requested/Effective pair.
    if (runDestination.value.kind === 'stack') {
      const stack = stackReadout.value;
      return stack === null ? null : `${stack.spanLabel} · ${stack.offsetLabel} · ${stack.outcomeLabel}`;
    }
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
    // 261031-i54: linking is a CREATION choice — a stack destination never
    // creates a cycle, so the Source cycle card must never surface.
    if (runDestination.value.kind === 'stack') return null;
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
      paintSeedVariation: paintSeedVariation.value,
      start,
      loopClips: currentLoopClips(),
      identities: snapshot.identities,
    });
  });

  /* ---- 261031-i54: the live stack destination (Quick A — Paint rails only) ----
     Everything below reads the LIVE ports behind `availabilityRevision`; nothing
     consults `loopPreflightSnapshot`, which is null until the dialog opens. A
     malformed derivation degrades to the create path — today's behaviour. */
  const CREATE_DESTINATION: RunScriptDestination = Object.freeze({ kind: 'create' }) as RunScriptDestination;

  interface RunScriptStackLiveContext {
    readonly destination: RunScriptDestination;
    readonly rails: readonly RunScriptRailView[];
    readonly parentEndExclusive: number;
    readonly realKeyAppFrames: readonly { readonly keyId: string; readonly appFrame: number }[];
  }

  /** A resolved stack destination plus the live facts the decision helpers need. */
  interface RunScriptStackSurface {
    readonly destination: Extract<RunScriptDestination, { kind: 'stack' }>;
    readonly rails: readonly RunScriptRailView[];
    readonly parentEndExclusive: number;
    readonly realKeyAppFrames: readonly { readonly keyId: string; readonly appFrame: number }[];
  }

  const stackContext = computed<RunScriptStackLiveContext | null>(() => {
    // The availability revision is the only change signal for the playhead: the
    // selection and the loop collection are plain port reads, so without a
    // signal read in front none of this re-evaluates when the user scrubs.
    ports.availabilityRevision?.value;
    if (dialogMode.value !== 'apply') return null;
    try {
      const loopClips = currentLoopClips();
      if (loopClips.length === 0) return null;
      const appFrame = ports.getSelection().appFrame;
      const snapshot = ports.getLoopEditSnapshot?.(appFrame) ?? null;
      const document = snapshot === null ? (ports.getPhysicalDocument?.() ?? null) : null;
      const identities: readonly PhysicPaintRotoKeyIdentity[] = snapshot !== null
        ? snapshot.identities
        : (document?.realKeyRecords ?? []).map((record) => ({ keyId: record.keyId, appFrame: record.appFrame }));
      const derivationCapacity = snapshot !== null ? snapshot.physicalCapacity : document?.capacity ?? 0;
      const interpolationEnabled = snapshot !== null ? snapshot.interpolationEnabled : document?.interpolation.enabled ?? false;
      if (identities.length === 0 || !Number.isInteger(derivationCapacity) || derivationCapacity <= 0) return null;
      const parentEndExclusive = snapshot !== null ? snapshot.layerEndExclusive : derivationCapacity;
      const derivation = derivePhysicPaintRotoLoopRanges({
        identities,
        loopClips,
        capacity: derivationCapacity,
        interpolationEnabled,
      });
      const rails = toRunScriptRailViews({ clips: loopClips, context: derivation });
      if (rails.length === 0) return null;
      return Object.freeze({
        destination: resolveRunScriptDestination({ appFrame, rails }),
        rails,
        parentEndExclusive,
        realKeyAppFrames: identities,
      }) as RunScriptStackLiveContext;
    } catch {
      return null;
    }
  });

  function stackSurfaceFrom(context: RunScriptStackLiveContext | null): RunScriptStackSurface | null {
    if (context === null || context.destination.kind !== 'stack') return null;
    return Object.freeze({
      destination: context.destination,
      rails: context.rails,
      parentEndExclusive: context.parentEndExclusive,
      realKeyAppFrames: context.realKeyAppFrames,
    }) as RunScriptStackSurface;
  }

  /* WR-01/WR-02/IN-03: the stack session is PINNED at open. Scrubbing out of the
     rail while the dialog is up must not flip the surface back to creation; the
     target rail and the run start stay the pinned ones. The live context still
     supplies the rails table and the parent end, so a concurrent edit is seen. */
  const pinnedStackDestination = signal<RunScriptStackSurface | null>(null);

  const stackSurface = computed<RunScriptStackSurface | null>(() => {
    const pinned = confirmationOpen.value && dialogMode.value === 'apply' ? pinnedStackDestination.value : null;
    const live = stackSurfaceFrom(stackContext.value);
    if (pinned === null) return live;
    return Object.freeze({
      destination: pinned.destination,
      rails: live?.rails ?? pinned.rails,
      parentEndExclusive: live?.parentEndExclusive ?? pinned.parentEndExclusive,
      realKeyAppFrames: live?.realKeyAppFrames ?? pinned.realKeyAppFrames,
    }) as RunScriptStackSurface;
  });

  const runDestination = computed<RunScriptDestination>(() => {
    const pinned = confirmationOpen.value && dialogMode.value === 'apply' ? pinnedStackDestination.value : null;
    if (pinned !== null) return pinned.destination;
    // Live destination INCLUDING the refuse states — only the stack helpers use
    // the narrowed surface.
    return stackContext.value?.destination ?? CREATE_DESTINATION;
  });

  /** First written source-cycle frame: the pinned one while the stack dialog is open. */
  const stackRailStart = computed<number | null>(() => stackSurface.value?.destination.runStartAppFrame ?? null);

  function normalizeCycleOffset(value: number, cycleLength: number): number {
    if (cycleLength <= 0) return 0;
    return ((value % cycleLength) + cycleLength) % cycleLength;
  }

  /**
   * WR-02: the LIVE view of the pinned target rail. The pinned surface keeps the
   * rail identity and run start stable while the dialog is open, but every
   * boundary/base/commit decision must read the live row, including an override
   * added while the dialog was open. Falls back to the pinned view when the live
   * table is unavailable.
   */
  function liveRailForTarget(surface: RunScriptStackSurface): RunScriptRailView {
    const clipId = surface.destination.rail.clipId;
    return surface.rails.find((rail) => rail.clipId === clipId) ?? surface.destination.rail;
  }

  function resolveStackBoundaryFor(
    surface: RunScriptStackSurface,
    runStartAppFrame: number,
    requestedCount: number,
    options?: { readonly excludeClipId?: string | null; readonly ownedKeyIds?: readonly string[] },
  ): RunScriptStackBoundary {
    const target = liveRailForTarget(surface);
    const count = Math.max(0, requestedCount);
    const excluded = options?.excludeClipId ?? null;
    return resolveRunScriptStackBoundary({
      runStartAppFrame,
      requestedCount: count,
      targetClipId: target.clipId,
      rails: excluded === null
        ? surface.rails
        : Object.freeze(surface.rails.filter((rail) => rail.clipId !== excluded)),
      parentEndExclusive: surface.parentEndExclusive,
      ownedKeyIds: [...target.sourceKeyIds, ...(options?.ownedKeyIds ?? [])],
      frameOverrideAppFrames: target.frameOverrideAppFrames,
      realKeyAppFrames: surface.realKeyAppFrames,
    });
  }

  const stackMaxCount = computed(() => {
    const surface = stackSurface.value;
    const start = stackRailStart.value;
    if (surface === null || start === null) return 0;
    return Math.max(0, resolveStackBoundaryFor(surface, start, 0).freeCount);
  });

  const stackBoundary = computed<RunScriptStackBoundary | null>(() => {
    const surface = stackSurface.value;
    const start = stackRailStart.value;
    if (surface === null || start === null) return null;
    return resolveStackBoundaryFor(surface, start, parsedCount.value.count ?? 0);
  });

  function stackTargetClip(surface: RunScriptStackSurface): PhysicPaintRotoLoopClip | null {
    const clipId = surface.destination.rail.clipId;
    return currentLoopClips().find((clip) => clip.loopId === clipId) ?? null;
  }

  /** The extend-only lifecycle for the current draft count, before any explicit Truncate clamp. */
  function planStackLifecycle(
    surface: RunScriptStackSurface,
    start: number,
    count: number,
  ): { extension: ReturnType<typeof planRunScriptStackExtension>; plan: ReturnType<typeof planRunScriptStackLifecycle> } {
    const target = surface.destination.rail;
    const cycleOffset = normalizeCycleOffset(start - target.phaseOrigin, target.cycleLength);
    const extension = planRunScriptStackExtension({
      runStartAppFrame: start,
      cycleLength: target.cycleLength,
      cycleOffset,
      count,
    });
    const plan = planRunScriptStackLifecycle({
      existing: stackTargetClip(surface),
      phaseOrigin: target.phaseOrigin,
      newCycleLength: extension.newCycleLength,
      repeat: target.repeat,
    });
    return { extension, plan };
  }

  const stackCollision = computed<RotoPlayScriptStackCollision | null>(() => {
    const surface = stackSurface.value;
    const start = stackRailStart.value;
    const boundary = stackBoundary.value;
    const count = parsedCount.value.count;
    if (surface === null || start === null || boundary === null || count === null) return null;
    const { plan } = planStackLifecycle(surface, start, count);
    // An infinity clip is already parent-bounded and stays lifecycle-less, so its
    // repeat-extended span can never overflow — the rails table owns that bound.
    const lifecycleOverflow = surface.destination.rail.repeat !== 'infinity'
      && plan.requestedRailEndExclusive > surface.parentEndExclusive;
    if (!boundary.collision && !lifecycleOverflow) return null;
    return Object.freeze({
      boundaryExclusive: boundary.boundaryExclusive,
      blocker: boundary.blocker,
      victimClipId: boundary.victimClipId,
      runCollision: boundary.collision,
      lifecycleOverflow,
      parentEndExclusive: lifecycleOverflow ? surface.parentEndExclusive : null,
    }) as RotoPlayScriptStackCollision;
  });

  const NO_COLLISION_OFFERS: readonly RunScriptCollisionOffer[] = Object.freeze([] as RunScriptCollisionOffer[]);

  /** CR-05: a victim rail carrying frame overrides cannot be removed — its overrides would dangle. */
  function victimHasFrameOverrides(surface: RunScriptStackSurface | null, victimClipId: string | null): boolean {
    if (surface === null || victimClipId === null) return false;
    const victim = surface.rails.find((rail) => rail.clipId === victimClipId) ?? null;
    return victim !== null && victim.frameOverrideAppFrames.length > 0;
  }

  /** CR-04: Overwrite is accepted ONLY for a live other-rail victim without frame overrides. */
  function overwriteChoiceValid(boundary: RunScriptStackBoundary, surface: RunScriptStackSurface | null): boolean {
    return boundary.collision
      && boundary.offers.includes('overwrite')
      && boundary.blocker === 'other-rail'
      && boundary.victimClipId !== null
      && !victimHasFrameOverrides(surface, boundary.victimClipId);
  }

  const collisionOffers = computed<readonly RunScriptCollisionOffer[]>(() => {
    const surface = stackSurface.value;
    const boundary = stackBoundary.value;
    if (boundary === null) return NO_COLLISION_OFFERS;
    const collision = stackCollision.value;
    if (collision === null) return NO_COLLISION_OFFERS;
    // A lifecycle-only overflow is a parent-end case: Cancel / Truncate, never
    // Overwrite — an unrelated rail further down must not be removable for it.
    // CR-05 filters Overwrite out when the victim rail has frame overrides.
    return Object.freeze(boundary.offers.filter((offer) => offer !== 'overwrite'
      || (collision.runCollision && !victimHasFrameOverrides(surface, boundary.victimClipId))));
  });

  const stackReadout = computed<RunScriptStackReadout | null>(() => {
    const surface = stackSurface.value;
    const start = stackRailStart.value;
    if (surface === null || start === null) return null;
    const target = surface.destination.rail;
    const count = parsedCount.value.count ?? 0;
    const { extension } = planStackLifecycle(surface, start, count);
    const collision = stackCollision.value;
    return buildRunScriptStackReadout({
      runStartAppFrame: start,
      count,
      cycleOffset: normalizeCycleOffset(start - target.phaseOrigin, target.cycleLength),
      grew: extension.grew,
      // WR-03: only the RUN crossing a boundary is a truncation; the rail's own
      // repeat-extended end crossing the parent end is a capping, reported apart.
      truncated: collision?.runCollision === true,
      parentEndOverflow: collision !== null && collision.lifecycleOverflow && !collision.runCollision,
    });
  });

  const framesMax = computed(() => Math.max(1, runDestination.value.kind === 'stack' ? stackMaxCount.value : capacity.value));

  const repeatLocked = computed(() => runDestination.value.kind === 'stack');

  /**
   * 261031-qps (Quick B): the pinned destination's rail kind — the dialog's
   * composition gate for the Reveal knob set. Reads the pinned destination
   * (`runDestination`), never the live playhead, so scrubbing cannot flip it.
   */
  const stackRailKind = computed<'playscript' | 'reveal' | null>(() => {
    const destination = runDestination.value;
    return destination.kind === 'stack' ? destination.rail.railKind : null;
  });

  /* Keep script: a draft signal the user owns, re-seeded only when the TARGET
     changes (rail identity + its persisted flag), never on an unrelated
     revision bump — so a user toggle survives the next scrub. */
  const keepScript = signal(false);
  const unionPortPresent = (): boolean => typeof ports.bakeStackedRailKey === 'function';
  const revealTailPortPresent = (): boolean => typeof ports.bakeRevealStackTail === 'function';
  /** The port the CURRENT destination's Keep ON bake runs through. */
  const stackPortPresent = computed(() => (stackRailKind.value === 'reveal' ? revealTailPortPresent() : unionPortPresent()));
  const keepScriptVisible = computed(() => runDestination.value.kind === 'stack' && stackPortPresent.value);
  // 261031-qps (Quick B): Keep script applies to EVERY existing-rail destination.
  // The persisted keyScriptEdits flag no longer gates it — a pixel-only rail is
  // seeded ON and its pre-run picture is pinned as the authority's durable base,
  // so ON appends scripts and OFF flattens, both without flipping the flag. A
  // Reveal rail needs its render-only tail port instead of the union bake.
  const keepScriptEffective = computed(() => {
    const destination = runDestination.value;
    return destination.kind === 'stack' && stackPortPresent.value && keepScript.value;
  });
  const keepScriptDisabledReason = computed(() => {
    const destination = runDestination.value;
    // Only the never-a-stack case (no bake port in this build) disables the
    // switch; every stack destination with its port can keep its scripts.
    if (destination.kind !== 'stack' || stackPortPresent.value) return null;
    return destination.rail.railKind === 'reveal'
      ? 'This build cannot re-render a Reveal rail. Nothing can be stacked onto it.'
      : 'This build cannot re-bake per-key scripts on an existing rail. The run is composited over its existing pixels.';
  });
  let keepScriptSeedKey: string | null = null;
  const seedKeepScript = effect(() => {
    // UAT 261031-i54: seed ONLY while the dialog is open. Reading the live
    // destination unconditionally re-derived every rail's ranges on each
    // playhead tick (one effect subscription per frame), which made playback
    // and scrubbing sluggish for no visible result.
    const destination = confirmationOpen.value && dialogMode.value === 'apply'
      ? runDestination.value
      : null;
    const key = destination?.kind === 'stack'
      ? `${destination.rail.clipId}:${destination.rail.keyScriptEdits === true ? 1 : 0}`
      : null;
    if (key === keepScriptSeedKey) return;
    keepScriptSeedKey = key;
    // Quick B: pixel-only rails seed ON exactly like flag-on rails — the
    // authority pins their pre-run picture, so ON is non-destructive.
    const next = destination?.kind === 'stack' ? RUN_SCRIPT_KEEP_SCRIPT_DEFAULT : false;
    if (keepScript.peek() !== next) keepScript.value = next;
  });

  /** 261031-i54: compare-then-write (efx-preact-reactivity rule 3). */
  function setKeepScript(enabled: boolean): void {
    if (keepScript.peek() === enabled) return;
    keepScript.value = enabled;
  }

  /* The explicit collision answer. Null while the prompt is open — `confirm`
     writes nothing until the user picks one of the offered choices. */
  const collisionChoice = signal<RunScriptCollisionOffer | null>(null);

  /** The live playhead must still resolve to the SAME rail at the SAME source frame. */
  function stackDestinationStillCurrent(clipId: string, start: number): boolean {
    const context = stackContext.peek();
    return context !== null
      && context.destination.kind === 'stack'
      && context.destination.rail.clipId === clipId
      && context.destination.runStartAppFrame === start;
  }

  /**
   * WR-02: the live target rail must still be the identical source cycle the
   * session pinned. A concurrent source-cycle edit (key added/removed/retimed
   * or a repeat change) that keeps the playhead on the same rail would otherwise
   * be silently overwritten by the commit's pinned merge.
   */
  function stackTargetUnchanged(surface: RunScriptStackSurface): boolean {
    const context = stackContext.peek();
    if (context === null) return false;
    const pinned = surface.destination.rail;
    const live = context.rails.find((rail) => rail.clipId === pinned.clipId) ?? null;
    return live !== null
      && live.phaseOrigin === pinned.phaseOrigin
      && sameOrderedIds(live.sourceKeyIds, pinned.sourceKeyIds)
      && live.cycleLength === pinned.cycleLength
      && live.repeat === pinned.repeat;
  }

  function currentLoopClips(): readonly PhysicPaintRotoLoopClip[] {
    return ports.getRotoLoopClips?.() ?? PHYSIC_PAINT_ROTO_LOOP_CLIPS_EMPTY;
  }

  function findIdenticalSourceCycle(input: RotoPlayScriptSourceCycleMatchInput): RotoPlayScriptIdenticalSourceCycle | null {
    const frameByKeyId = new Map(input.identities.map((entry) => [entry.keyId, entry.appFrame]));
    // 261030-ey9: ALL FOUR channels classify the cycle — a rotation-only or
    // scale-only cycle still seeds its held pose by the absolute destination
    // frame, so it is not identity.
    const motionZero = input.motion.deformation === 0 && input.motion.position === 0
      && (input.motion.rotation ?? 0) === 0 && (input.motion.scale ?? 0) === 0;
    for (const clip of input.loopClips) {
      if (clip.scriptId === undefined || !clip.motion) continue; // no provenance → never matches
      if (clip.scriptId !== input.scriptId) continue;
      if (clip.mode !== input.mode) continue;
      if (clip.sourceKeyIds.length !== input.cycleLength) continue;
      if (clip.motion.deformation !== input.motion.deformation || clip.motion.position !== input.motion.position) continue;
      if ((clip.motion.rotation ?? 0) !== (input.motion.rotation ?? 0)) continue;
      if ((clip.motion.scale ?? 0) !== (input.motion.scale ?? 0)) continue;
      if ((clip.overrideColor ?? null) !== input.overrideColor) continue;
      // 261030-v1t: a salted cycle and an unsalted cycle are different content
      // even at identical strokes — linking across the flag would show one
      // texture for a rail the dialog promised another.
      if ((clip.paintSeedVariation ?? false) !== input.paintSeedVariation) continue;
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
    // 261031-i54: a stack run never edits the rail's repeat — the controls are
    // hidden and this setter stays inert so no stray write can change it.
    if (repeatLocked.peek()) return;
    if (enabled) {
      // Preserve the last VALID finite repeat; an invalid draft never overwrites it (Pitfall 7).
      if (parseRepeat(repeatText.peek(), activeParsedCount.peek().count).count !== null) lastFiniteRepeat.value = repeatText.peek();
      infinity.value = true;
    } else {
      repeatText.value = lastFiniteRepeat.peek();
      infinity.value = false;
    }
  }

  /** 261029-vbp: write the flag; enabling sets the locked default mix 100,
   *  disabling keeps the stored mix so a re-check restores the last strength. */
  function setColorize(enabled: boolean): void {
    colorize.value = enabled;
    if (enabled) colorizeMix.value = 100;
  }

  /** 261029-vbp: the port input is always an integer 0-100 (T-quick-261029-vbp-03). */
  function setColorizeMix(value: number): void {
    colorizeMix.value = Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 100)));
  }

  /** 261030-ey9: the Reveal Photo wiggle toggle; never sticky across opens. */
  function setPhotoWiggle(enabled: boolean): void {
    photoWiggle.value = enabled;
  }

  /** 261030-ig0: compare-then-write — a repeat write of the same value must not
   *  bump any subscriber (efx-preact-reactivity rule 3). */
  function setKeyScriptEdits(enabled: boolean): void {
    if (keyScriptEdits.peek() === enabled) return;
    keyScriptEdits.value = enabled;
  }

  /** 261030-v1t: compare-then-write (efx-preact-reactivity rule 3). */
  function setPaintSeedVariation(enabled: boolean): void {
    if (paintSeedVariation.peek() === enabled) return;
    paintSeedVariation.value = enabled;
  }

  // D-06: the ONLY reset path the dialog calls — re-reads the CURRENT Motion default port; never writes anywhere.
  // 261031-i54 UAT: a stack session resets to the TARGET RAIL's stored wiggle,
  // not the group defaults — the rail is the reference the run starts from.
  function resetDialogMotion(): void {
    const destination = runDestination.peek();
    dialogMotion.value = destination.kind === 'stack' && destination.rail.motion !== undefined
      ? toDialogMotion(destination.rail.motion)
      : toDialogMotion(ports.getMotion());
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
    // The per-key script opt-in is disabled on the Reveal tab for now — a
    // Paint-tab ON must never ride invisibly into a Reveal bake.
    if (keyScriptEdits.peek()) keyScriptEdits.value = false;
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
  // UAT 261031-i54: a stack resolves its seeded rail color first, so an untouched
  // Custom color keeps the rail's stored value; "Use brush color" reseeds it.
  function resolveOverrideColor(): string | null {
    if (!overrideEnabled.peek()) return null;
    if (runDestination.peek().kind === 'stack') {
      return stackOverrideColor.peek() ?? normalizeBrushColor(ports.getBrushColor());
    }
    return normalizeBrushColor(ports.getBrushColor());
  }

  /** UAT 261031-i54: adopt the live brush color as the stack's Custom color. */
  function useBrushColor(): void {
    if (runDestination.peek().kind !== 'stack') return;
    const next = normalizeBrushColor(ports.getBrushColor());
    if (stackOverrideColor.peek() !== next) stackOverrideColor.value = next;
    if (!overrideEnabled.peek()) overrideEnabled.value = true;
  }

  async function openConfirmation(options?: { railTab?: RotoPlayScriptRailTab }): Promise<void> {
    if (disposed || disabledReason.peek()) return;
    // 261031-i54: a refused destination never opens the dialog and never asks
    // for authority. 261031-qps (Quick B): the ONLY remaining refusal is an
    // ambiguous overlap — Paint and Reveal rails alike now accept a stack.
    const destination = runDestination.peek();
    if (destination.kind === 'refuse') {
      phase.value = 'idle';
      status.value = null;
      error.value = 'Two or more rails cover this frame. Move the playhead onto exactly one rail and try again.';
      ports.log(error.peek()!, true);
      return;
    }
    ports.stopPlayback();
    const selected = ports.getSelection();
    // WR-01/WR-02/IN-03: capture the resolved stack surface BEFORE any await, so
    // the dialog session is pinned to this rail + run start even if the playhead
    // moves while the authority round-trip is in flight.
    const stackSurfaceAtOpen = destination.kind === 'stack' ? stackSurfaceFrom(stackContext.peek()) : null;
    const stackStart = destination.kind === 'stack' ? destination.runStartAppFrame : null;
    const operationId = nextOperationId('authority');
    phase.value = 'preparing'; progress.value = null; status.value = 'Preparing Play Script…'; error.value = null;
    try {
      // 261031-dm1: opening the dialog reads only scalars plus {keyId, appFrame},
      // so it asks for identities only — no WebP bytes cross the bridge.
      // 261031-i54: a stack run asks at its SOURCE-CYCLE start, never at the
      // occurrence frame the playhead happens to sit on.
      const authority = await ports.requestAuthority(operationId, stackStart ?? selected.appFrame, { identitiesOnly: true });
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
      regenerateImpact.value = null;
      linkChoice.value = 'link';
      countText.value = '3';
      lastFiniteCount.value = '3';
      max.value = false;
      dialogMotion.value = toDialogMotion(ports.getMotion());
      // 52-05 (G-52-3): the open entry picks the tab — the track rail-creation
      // flow's Reveal item opens directly on the Reveal Photo Rail tab. The
      // reveal span defaults to the selected script's natural duration (D-20).
      railTab.value = options?.railTab ?? 'paint';
      const selectedScriptId = ports.library.selectedId.peek();
      revealCountText.value = String((selectedScriptId ? ports.getScriptNaturalDuration?.(selectedScriptId) : null) ?? DEFAULT_REVEAL_FRAME_COUNT);
      // 261029-vbp: colorize is an apply-mode creation setting — reset it with
      // the rest of the apply-mode state on every open (never sticky).
      colorize.value = false;
      colorizeMix.value = 100;
      // 261030-ey9: the Photo wiggle is an apply-mode creation setting too —
      // reset on every open (colorize precedent, never sticky).
      photoWiggle.value = false;
      // 261030-ig0: still guarding the same value (rule 3) rather than writing
      // unconditionally — a reset to the default must not churn subscribers.
      if (keyScriptEdits.peek()) keyScriptEdits.value = false;
      // 261030-v1t: the per-frame paint-seed variation is an apply-mode
      // creation setting too — reset on every open (never sticky).
      if (paintSeedVariation.peek()) paintSeedVariation.value = false;
      if (!hasSuccessfulGeneration) {
        // First-time defaults refresh: before the first successful Generate line 1 tracks the
        // current defaults (mode/override untouched at first open, Motion from the defaults port,
        // override color resolved live from the brush-color port — D-08R).
        appliedSummaryLine1.value = composeSummaryLine1(mode.peek(), resolveOverrideColor(), dialogMotion.peek());
      }
      if (destination.kind === 'stack') {
        // 261031-i54: a stack run defaults its span to the selected script's
        // natural duration (creation keeps today's 3). No silent clamp — an
        // over-span count still parses and confirm raises the collision prompt.
        collisionChoice.value = null;
        pinnedStackDestination.value = stackSurfaceAtOpen;
        // UAT 261031-i54: the run's Rail Type and Motion wiggle start from the
        // rail's stored settings; the user may change them and the rail adopts
        // the run's values on confirm. Creation keeps the group defaults.
        mode.value = destination.rail.mode;
        dialogMotion.value = toDialogMotion(
          destination.rail.motion ?? { deformation: 0, position: 0 },
        );
        overrideEnabled.value = destination.rail.overrideColor !== null;
        stackOverrideColor.value = destination.rail.overrideColor;
        // 261031-qps (Quick B): a Reveal stack seeds its four editable knobs
        // from the rail's stored settings — compare-then-write (rule 3), once
        // at open, never a per-playhead-tick read. A Paint stack keeps the
        // creation defaults (all off) for these reveal-only settings.
        if (destination.rail.railKind === 'reveal') {
          if (colorize.peek() !== destination.rail.colorize) colorize.value = destination.rail.colorize;
          if (colorizeMix.peek() !== destination.rail.colorizeMix) colorizeMix.value = destination.rail.colorizeMix;
          if (photoWiggle.peek() !== destination.rail.photoWiggle) photoWiggle.value = destination.rail.photoWiggle;
          if (paintSeedVariation.peek() !== destination.rail.paintSeedVariation) paintSeedVariation.value = destination.rail.paintSeedVariation;
        }
        // WR-06/261031-qps: the stack composition comes from the rail kind, not
        // the tab — the Reveal CREATE tab must never stay selected from an
        // earlier open.
        if (railTab.peek() !== 'paint') railTab.value = 'paint';
        const natural = selectedScriptId ? ports.getScriptNaturalDuration?.(selectedScriptId) : null;
        const seeded = String(natural ?? 3);
        if (countText.peek() !== seeded) countText.value = seeded;
        lastFiniteCount.value = seeded;
        confirmationOpen.value = true;
        const runStart = stackStart ?? authority.canonicalStart;
        const seededCount = parsedCount.peek().count ?? (typeof natural === 'number' ? natural : 3);
        phase.value = 'idle';
        status.value = `Run Script onto ${destination.rail.clipId} · F${runStart}–F${runStart + seededCount - 1}`;
        return;
      }
      pinnedStackDestination.value = null;
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
    if (loop.motion) dialogMotion.value = toDialogMotion(loop.motion);
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
    if (group.syncState === 'synchronized') return 'Already synchronized with Script.';
    if (group.provenanceState !== 'attached' || !group.scriptId) return 'Regenerate unavailable — Script detached.';
    const action = ports.library.rows.peek().find((row) => row.id === group.scriptId);
    if (!action) return 'Regenerate unavailable — Source Script unavailable.';
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
    if (!action) return rejectLoopOp('Regenerate unavailable — Source Script unavailable.');
    ports.stopPlayback();
    phase.value = 'preparing';
    status.value = 'Preparing Rail Regenerate…';
    error.value = null;
    try {
      const snapshot = await ports.library.loadSnapshot(group.scriptId);
      if (!snapshot) return rejectLoopOp('Regenerate unavailable — Source Script unavailable.');
      const currentDocument = ports.getPhysicalDocument?.() ?? null;
      if (!currentDocument || currentDocument.revision !== document.revision) {
        return rejectLoopOp('Regenerate rejected — physical Rail document changed.');
      }
      const currentAction = ports.library.rows.peek().find((row) => row.id === group.scriptId);
      if (!currentAction || currentAction.revision !== action.revision) {
        return rejectLoopOp('Regenerate rejected — saved Script changed.');
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
          ? 'Rebuilds the saved Script source cycle and refreshes every affected Rail cache.'
          : 'Rebuilds the saved Script source cycle and refreshes the Rail cache.',
        storedSettings: Object.freeze({
          mode: group.mode,
          motion: Object.freeze({ ...group.motion }),
          overrideColor: group.overrideColor ?? null,
          sourceKeyIds: Object.freeze([...group.sourceKeyIds]),
          // 261030-v1t: the re-bake must reproduce the accepted pixels.
          paintSeedVariation: group.paintSeedVariation === true,
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
    assertAuthorityPayloads(authority, 'Loop Clip publication');
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
        // A finite Repeat may run past the parent end ("shortened" by the
        // resolver); the persisted Group extent must stay within capacity or
        // the document validator refuses the whole edit.
        : snapshot
          ? Math.min(target.phaseOrigin + cycleDuration * draftRepeat, snapshot.capacity)
          : target.phaseOrigin + cycleDuration * draftRepeat;
      if (target.frameOverrides?.some((override) => override.appFrame >= originalEndExclusive)) {
        fail(new Error('Cycle count cannot remove locally painted Rail frames. Regenerate the Rail first.'));
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
        fail(new Error('Cycle count cannot remove every surviving Rail frame.'));
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
        return currentLoopClips().map((clip) => (clip.loopId === loop.loopId
          ? { ...clip, sourceKeyIds: Object.freeze([...targetKeyIds]) }
          : clip));
      },
      'Loop Clip relinked to the chosen source cycle.',
    );
  }

  async function confirm(): Promise<boolean> {
    // WR-06: a stack destination outranks the tab — the Reveal branch must never
    // consume a stack confirm (the dialog hides Reveal on a stack anyway).
    if (runDestination.peek().kind === 'stack') return confirmStack();
    if (dialogMode.peek() === 'loop-edit') return updateLoop();
    if (railTab.peek() === 'reveal') return confirmReveal();
    return confirmGeneration();
  }

  /**
   * 56-08: the aquarelle consume branch. Runs the script through
   * createAquarelleBake (mode 'flush-survives-navigation') so a long fluid
   * cuisson survives leaving the frame (AQUA-07). Published frames land in
   * the same staged cache shape the timeline reads (R3.4 — cache only).
   */
  async function bakeAquarelleScript(input: {
    snapshot: RotoPaintScript;
    count: number;
    start: number;
    size: { width: number; height: number };
    acceptedGeneration: number;
    motion: { deformation: number; position: number; rotation?: number; scale?: number };
    mode: RotoPlayScriptMode;
    /** 261030-v1t: one salted from-scratch replay per output frame. */
    paintSeedVariation?: boolean;
  }): Promise<{ staged: PhysicPaintRotoCacheFrame[]; anchors: readonly AquarelleStrokeFrameAnchor[] }> {
    const { snapshot, count, start, size, acceptedGeneration, mode } = input;
    // 261030-v1t: ON re-bakes every output frame (static included) with its own
    // salted replay; OFF keeps today's one-wash static law byte-identically.
    const paintSeedVariation = input.paintSeedVariation === true;
    // 261017-fz3: paper enters the bake AND its cache key. Single source:
    // ports.getBackgroundMetadata() (never a second paper source).
    const bgMeta = ports.getBackgroundMetadata();
    const bakePaper: AquarelleBakePaper = {
      paperId: bgMeta.background,
      grainStrength: bgMeta.grainStrength,
      grainScale: bgMeta.grainScale ?? 1,
    };
    const adapter = ports.createAquarelleAdapter
      ? ports.createAquarelleAdapter(size, bakePaper)
      : await createDefaultAquarelleAdapter(size, bakePaper);
    const createBake = ports.createAquarelleBake ?? defaultCreateAquarelleBake;
    // 261022-ljt / LJT-01: per-commit progress parity with engine-1's
    // onProgress. A monotonic counter matches engine-1's `frameIndex + 1`
    // semantics on the Play path (eventIndex is an event index on the
    // non-progressive bake path) and is clamped to `count`.
    let committedFrames = 0;
    // 261030-np9 (D-01): the bake is the ONE slicing authority — it reports the
    // output frame it actually started each stroke on. Nothing below re-derives
    // a schedule.
    let anchors: readonly AquarelleStrokeFrameAnchor[] = [];
    const bake = createBake(adapter, {
      width: size.width,
      height: size.height,
      paper: bakePaper,
      encodeWebp: encodeAquarelleWebpFrame,
      // 261018 progressive Play: emit `count` frames with stroke growth across
      // the span. Static bakes ONE settled wash and derives `count` posed
      // copies below — the complete drawing on every frame (engine-1 static).
      // 261030-v1t: ON bakes `count` from-scratch replays in BOTH modes.
      frameCount: mode === 'static' && !paintSeedVariation ? 1 : count,
      ...(paintSeedVariation ? { paintSeedVariation: mode } as const : {}),
      // 261030-v1t: the ON-only cost evidence line (bake + encode + replays).
      // OFF attaches nothing and stays silent.
      ...(paintSeedVariation
        ? {
            onDiagnostics: (diagnostics: AquarelleBakeDiagnostics) => {
              ports.log(`Paint seed variation · ${diagnostics.paintSeedReplays} replays · bake ${Math.round(diagnostics.bakeMs)} ms · encode ${Math.round(diagnostics.encodeMs)} ms · ${diagnostics.simulatedTicks} simulated ticks`);
            },
          }
        : {}),
      // 261026: the cumulative sheet cannot re-warp deposits, so the pose is
      // applied to each CAPTURED progressive frame at its OUTPUT frame — this
      // is what makes already-drawn paint move with the animation.
      poseFrame: mode === 'progressive' ? createAquarelleDeformPoser(size, input.motion, start, 'white') : undefined,
      // 261022-ljt / LJT-01: consume the bake's existing per-committed-frame
      // seam so the Play dialog bar advances exactly like brush mode. AQUA-07
      // flushes (not aborts) on dispose, so commits legitimately continue
      // after Cancel/close — they must be ignored, never re-open the dialog's
      // progress. This callback runs inside the bake commit turn: a throw
      // settles that turn `rejected` and fails the whole bake, so it contains
      // only guarded signal writes.
      onCommit: () => {
        if (disposed || generation !== acceptedGeneration) return;
        committedFrames = Math.min(count, committedFrames + 1);
        progress.value = { completed: committedFrames, total: count };
        status.value = `Rendering ${committedFrames} / ${count}`;
      },
      onStrokeFrameAnchors: (next) => {
        anchors = next;
      },
    });
    aquarelleBake = bake;
    try {
      const events = aquarelleEventsFromScript(snapshot);
      const result = await bake.bake(events);
      if (disposed || generation !== acceptedGeneration) {
        throw new DOMException('Play Script generation cancelled.', 'AbortError');
      }
      if (!result.ok) {
        throw new Error(result.reason === 'cancelled'
          ? 'Aquarelle bake cancelled.'
          : 'Aquarelle bake failed. Nothing changed.');
      }
      if (mode === 'static') {
        // Static holds ONE settled wash across the span. With motion, each
        // output frame gets its own held pose so the complete drawing wiggles
        // frame to frame (engine-1 static parity).
        // 261030-v1t: ON, every held frame is its OWN complete salted replay —
        // the wash is selected per j and decoded/closed per j (never shared).
        // 261030-ey9: rotation-only / scale-only settings are MOVING too.
        const moving = input.motion.deformation !== 0 || input.motion.position !== 0
          || (input.motion.rotation ?? 0) !== 0 || (input.motion.scale ?? 0) !== 0;
        // O3: the band boil stays the deform pass; a rotation/scale-only
        // setting skips it and takes the outer rigid pass alone.
        const bandPass = input.motion.deformation !== 0 || input.motion.position !== 0;
        // OFF decodes the ONE settled wash exactly once (unchanged path).
        let sharedBitmap: ImageBitmap | null = null;
        try {
          const staged: PhysicPaintRotoCacheFrame[] = [];
          for (let j = 0; j < count; j += 1) {
            if (disposed || generation !== acceptedGeneration) {
              throw new DOMException('Play Script generation cancelled.', 'AbortError');
            }
            const base = result.frames[paintSeedVariation ? j : 0];
            if (!base) throw new Error('Aquarelle static bake produced no frame.');
            let bytes = base.bytes;
            if (moving) {
              let bitmap: ImageBitmap | null;
              if (paintSeedVariation) {
                bitmap = await createImageBitmap(new Blob([base.bytes.slice()], { type: 'image/webp' }));
              } else {
                sharedBitmap ??= await createImageBitmap(new Blob([base.bytes.slice()], { type: 'image/webp' }));
                bitmap = sharedBitmap;
              }
              try {
                const deformed = bandPass
                  ? drawAquarelleSheetDeform(bitmap, size.width, size.height, start + j, input.motion, 'white')
                  : bitmap;
                bytes = await encodeAquarelleWebpFrame(
                  applyAquarelleSheetRigidWiggle(deformed, size.width, size.height, start + j, input.motion, 'white'),
                  size.width,
                  size.height,
                );
              } finally {
                // The per-frame replay bitmap is this frame's alone.
                if (paintSeedVariation) bitmap.close();
              }
            }
            staged.push({
              frameIndex: j,
              appFrame: start + j,
              bytes,
              width: size.width,
              height: size.height,
              source: 'real-key' as const,
            });
            committedFrames = Math.max(committedFrames, Math.min(count, j + 1));
            progress.value = { completed: committedFrames, total: count };
            status.value = `Rendering ${committedFrames} / ${count}`;
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
          return { staged, anchors };
        } finally {
          sharedBitmap?.close();
        }
      }
      // 261018 progressive Play: frameCount emits exactly `count` frames with
      // stroke growth across the span. Map them 1:1 onto the output range.
      const staged: PhysicPaintRotoCacheFrame[] = result.frames.map((frame, j) => ({
        frameIndex: j,
        appFrame: start + j,
        bytes: frame.bytes,
        width: frame.width,
        height: frame.height,
        source: 'real-key' as const,
      }));
      return { staged, anchors };
    } finally {
      // Release the offscreen bake engine's WebGL surface. bake.bake() has
      // awaited every turn (including flush-survives-navigation work) before
      // this runs, so nothing still reads the adapter. Leaking one context per
      // Play starves the LIVE aquarelle canvas and its next capture can encode
      // a blank sheet — the paint cache then looks wiped.
      adapter.dispose();
    }
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
        colorize: colorize.peek(),
        colorizeMix: colorizeMix.peek(),
        photoWiggle: photoWiggle.peek(),
        // 261030-v1t: one salted from-scratch replay per output frame.
        paintSeedVariation: paintSeedVariation.peek(),
        // The per-key script opt-in is disabled on Reveal rails for now: a
        // reveal bake never records per-key scripts.
        keyScriptEdits: false,
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

  /**
   * 261031-i54 (Quick A): the stack confirm. Writes the run at its canonical
   * source-cycle frames onto the EXISTING rail, merges the cycle extend-only
   * and commits the rail's lifecycle — plus, on an explicit Overwrite, the
   * victim Loop Clip's removal — in ONE atomic publication. Nothing here reads
   * `linkChoice`, creates a Loop Clip, materializes an occurrence or writes
   * `keyScriptEdits`.
   */
  async function confirmStack(): Promise<boolean> {
    // WR-10: a confirm while a bake/commit is already in flight is a no-op.
    if (isBusyPhase(phase.peek())) return false;
    const surface = stackSurface.peek();
    if (surface === null) return false;
    const target = surface.destination.rail;
    const selectedId = ports.library.selectedId.peek();
    const launch = ports.getLaunchContext();
    const requested = parsedCount.peek().count;
    const start = surface.destination.runStartAppFrame;
    if (disposed || !selectedId || !launch?.project || requested === null) return false;
    if (disabledReason.peek()) return false;
    // WR-01/WR-02/IN-03: re-resolve the live playhead. An open session is pinned;
    // if the playhead no longer sits on the same rail at the same source frame,
    // refuse with zero writes instead of writing to a guessed destination.
    if (confirmationOpen.peek() && !stackDestinationStillCurrent(target.clipId, start)) {
      collisionChoice.value = null;
      phase.value = 'idle'; status.value = null;
      error.value = 'Play Script destination changed before commit. Nothing changed.';
      return false;
    }
    // WR-02: an open session also requires the live target rail to still be the
    // SAME source cycle — a concurrent cycle edit must refuse before any bake.
    if (confirmationOpen.peek() && !stackTargetUnchanged(surface)) {
      collisionChoice.value = null;
      phase.value = 'idle'; status.value = null;
      error.value = 'The target rail changed while the dialog was open. Nothing changed.';
      return false;
    }
    const boundary = resolveStackBoundaryFor(surface, start, requested);
    const requestedPlan = planStackLifecycle(surface, start, requested).plan;
    const lifecycleOverflow = target.repeat !== 'infinity'
      && requestedPlan.requestedRailEndExclusive > surface.parentEndExclusive;
    const needsChoice = boundary.collision || lifecycleOverflow;
    let victimClipId: string | null = null;
    let effectiveCount = requested;
    // WR-05: the explicit-Truncate cap. The rail end may GROW only to the cap —
    // min(parent end, run boundary) for a run-boundary truncation, the parent
    // end for a lifecycle-only overflow — while an already longer stored end is
    // preserved (extend-only; a Truncate never shrinks the rail).
    let lifecycleCap: number | null = null;
    // CR-04/CR-05: a stale or disallowed Overwrite choice refuses with zero writes.
    if (collisionChoice.peek() === 'overwrite' && !overwriteChoiceValid(boundary, surface)) {
      collisionChoice.value = null;
      phase.value = 'idle'; status.value = null;
      error.value = victimHasFrameOverrides(surface, boundary.victimClipId)
        ? 'Overwrite is unavailable: the other rail has frame overrides. Choose Truncate or Cancel.'
        : 'Overwrite is no longer available for this run. Choose Truncate or Cancel.';
      return false;
    }
    if (needsChoice) {
      const choice = collisionChoice.peek();
      if (choice === null) {
        phase.value = 'idle';
        status.value = 'Choose Cancel, Truncate or Overwrite to continue.';
        error.value = null;
        return false;
      }
      if (choice === 'cancel') {
        collisionChoice.value = null;
        phase.value = 'idle'; status.value = 'Run Script cancelled.'; error.value = null;
        return false;
      }
      if (choice === 'overwrite' && overwriteChoiceValid(boundary, surface)) {
        // Overwrite removes the victim rail in this same commit; its keys stay
        // as ordinary keys, so they must not block the rerun either.
        victimClipId = boundary.victimClipId;
        const victim = surface.rails.find((rail) => rail.clipId === victimClipId) ?? null;
        const rerun = resolveStackBoundaryFor(surface, start, requested, {
          excludeClipId: victimClipId,
          ownedKeyIds: victim?.sourceKeyIds ?? [],
        });
        effectiveCount = Math.min(requested, rerun.freeCount);
        if (rerun.collision) lifecycleCap = Math.min(surface.parentEndExclusive, rerun.boundaryExclusive);
      } else {
        // Truncate (the default): clip the run at the boundary and cap the rail
        // end at that same boundary — never a silent capacity cap.
        effectiveCount = Math.min(requested, boundary.freeCount);
        if (boundary.collision) lifecycleCap = Math.min(surface.parentEndExclusive, boundary.boundaryExclusive);
      }
      const clampedPlan = planStackLifecycle(surface, start, effectiveCount).plan;
      if (target.repeat !== 'infinity' && clampedPlan.requestedRailEndExclusive > surface.parentEndExclusive) {
        // Lifecycle-only overflow: the rail's repeat-extended end is capped at
        // the parent range end; an earlier run-boundary cap stays the tighter bound.
        lifecycleCap = lifecycleCap === null
          ? surface.parentEndExclusive
          : Math.min(lifecycleCap, surface.parentEndExclusive);
      }
      if (effectiveCount <= 0) {
        collisionChoice.value = null;
        phase.value = 'idle'; status.value = null;
        error.value = 'No free span remains before the next boundary. Nothing changed.';
        return false;
      }
    }

    // WR-08: extending a cycle that another rail links to would silently detach
    // that rail from the shared source cycle. Refuse BEFORE the bake.
    const writeCycleOffset = normalizeCycleOffset(start - target.phaseOrigin, target.cycleLength);
    const writeExtension = planRunScriptStackExtension({
      runStartAppFrame: start,
      cycleLength: target.cycleLength,
      cycleOffset: writeCycleOffset,
      count: effectiveCount,
    });
    if (writeExtension.grew > 0) {
      const linkedRails = currentLoopClips().filter((clip) => clip.loopId !== target.clipId
        && clip.loopId !== victimClipId
        && sameOrderedIds(clip.sourceKeyIds, target.sourceKeyIds));
      if (linkedRails.length > 0) {
        collisionChoice.value = null;
        phase.value = 'idle'; status.value = null;
        error.value = `This rail shares its source cycle with ${linkedRails.length} linked rail(s). Extending the cycle would break the link. Nothing changed.`;
        return false;
      }
    }
    const currentTarget = stackTargetClip(surface);
    if (currentTarget === null) {
      collisionChoice.value = null;
      phase.value = 'idle'; status.value = null;
      error.value = 'The target Loop Clip disappeared before commit. Nothing changed.';
      return false;
    }

    // 261031-qps (Quick B): a Reveal stack renders through the rail's placed
    // photo reference. No reference → a clear refusal with zero writes; a
    // build without the render-only port refuses too, because plain-paper
    // bytes must never land on a reveal frame.
    const isRevealTarget = currentTarget.railKind === 'reveal' || target.railKind === 'reveal';
    if (isRevealTarget) {
      const referenceRefusal = !revealTailPortPresent()
        ? 'This build cannot render a Reveal rail. Nothing changed.'
        : !(ports.hasPhotoReference?.() ?? false)
          ? 'This Reveal rail has no photo reference. Place a reference, then run again. Nothing changed.'
          : null;
      if (referenceRefusal !== null) {
        collisionChoice.value = null;
        phase.value = 'idle'; status.value = null;
        error.value = referenceRefusal;
        return false;
      }
    }

    // 261031-qps (Quick B) — the Keep-script 2x2. ON unions over the
    // authority-resolved durable base and APPENDS this run's slices on both
    // rail kinds (a pixel-only key's pre-run picture is pinned first, so ON is
    // non-destructive). OFF flattens a pixel-only rail (composite over its
    // current picture, record nothing, no purge, no pin) and keeps Quick A's
    // purge-then-replace law on a flag-on rail. A Reveal rail records the
    // revealed union on Keep ON (append) and records NOTHING on Keep OFF.
    // No branch writes the persisted keyScriptEdits flag — it is read here and
    // never adopted below.
    const flagOn = currentTarget.keyScriptEdits === true;
    const unionBake = ports.bakeStackedRailKey;
    const revealTailBake = ports.bakeRevealStackTail;
    const keepOn = keepScriptEffective.peek();
    const useUnion = !isRevealTarget && unionBake !== undefined && keepOn;
    const recordMode: 'append' | 'replace' | 'none' = isRevealTarget
      ? (keepOn ? 'append' : 'none')
      : useUnion ? 'append' : flagOn ? 'replace' : 'none';
    const acceptedGeneration = ++generation;
    abortController = new AbortController();
    const bakeSignal = abortController.signal;
    ports.stopPlayback();
    phase.value = 'preparing'; progress.value = null; status.value = 'Preparing Run Script…'; error.value = null;
    try {
      const authority = await ports.requestAuthority(nextOperationId('confirm'), start);
      assertCurrent(acceptedGeneration);
      if (!authority.ok || effectiveCount > authority.capacity) throw new Error(authority.error ?? 'Requested frame count exceeds current capacity.');
      // UAT 261031-i54: a stack run bakes with the dialog's Rail Type and Motion
      // wiggle — seeded from the rail at open, editable by the user. The target
      // adopts them below so its label, interpolation policy and Regenerate all
      // describe what was just run. Paint seed and color stay the rail's own.
      // 261031-qps (Quick B): a Reveal stack hides Rail Type, Motion wiggle and
      // Color, so its render always uses the rail's OWN stored values; the four
      // reveal knobs come from the dialog and are adopted below.
      const motion: { deformation: number; position: number; rotation?: number; scale?: number } = isRevealTarget
        ? (currentTarget.motion === undefined ? { deformation: 0, position: 0 } : { ...currentTarget.motion })
        : { ...dialogMotion.peek() };
      const renderMode = isRevealTarget ? currentTarget.mode : mode.peek();
      const renderOverrideColor = isRevealTarget ? (currentTarget.overrideColor ?? null) : resolveOverrideColor();
      const renderPaintSeedVariation = isRevealTarget
        ? paintSeedVariation.peek()
        : currentTarget.paintSeedVariation === true;
      const rotoBackground = { ...ports.getBackgroundMetadata() };
      const snapshot = await ports.library.loadSnapshot(selectedId);
      assertCurrent(acceptedGeneration);
      if (!snapshot || ports.library.selectedId.peek() !== selectedId) throw new Error('Selected script changed or could not be reloaded.');
      phase.value = 'rendering'; progress.value = { completed: 0, total: effectiveCount }; status.value = `Rendering 0 / ${effectiveCount}`;
      const baked = await bakeAquarelleScript({
        snapshot, count: effectiveCount, start, size: ports.getSize(),
        acceptedGeneration, motion, mode: renderMode, paintSeedVariation: renderPaintSeedVariation,
      });
      const staged = baked.staged;
      const anchors = baked.anchors;
      assertCurrent(acceptedGeneration);
      const commitAuthority = await ports.requestAuthority(nextOperationId('commit-check'), start);
      assertCurrent(acceptedGeneration);
      if (!commitAuthority.ok
        || commitAuthority.capacity < effectiveCount
        || commitAuthority.physicalRevision !== authority.physicalRevision
        || commitAuthority.physicalCapacity !== authority.physicalCapacity
        || commitAuthority.layerEndExclusive !== authority.layerEndExclusive) throw new Error('Roto authority changed before commit.');
      loopPreflightSnapshot.value = {
        identities: commitAuthority.physicalRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        parentEndExclusive: commitAuthority.layerEndExclusive,
        capacity: commitAuthority.physicalCapacity,
        interpolationEnabled: commitAuthority.interpolationEnabled,
      };
      // The playhead must still sit in the SAME rail at the SAME source frame:
      // a scrub during the bake re-targets the dialog and must not commit.
      if (!stackDestinationStillCurrent(target.clipId, start)) {
        throw new Error('Play Script destination changed before commit.');
      }
      const destinationAppFrames = Array.from({ length: effectiveCount }, (_, index) => start + index);
      const basePublication = buildPhysicalPublication({
        authority: commitAuthority,
        staged,
        start,
        count: effectiveCount,
        destinationAppFrames,
        expectedLaunch: { operationId: launch.operationId, layerId: launch.layerId },
        rotoBackground,
      });
      const recordByAppFrame = new Map(basePublication.records.map((record) => [record.appFrame, record]));
      const touchedKeyIds = destinationAppFrames.map((appFrame) => {
        const record = recordByAppFrame.get(appFrame);
        if (!record) throw new Error(`Committed run is missing frame ${appFrame}.`);
        return record.keyId;
      });
      const existingEntries = target.sourceKeyIds.map((keyId, index) => ({ keyId, offset: target.sourceOffsets[index] ?? index }));
      const incomingEntries = destinationAppFrames.map((appFrame, index) => ({
        keyId: touchedKeyIds[index]!,
        offset: appFrame - target.phaseOrigin,
      }));
      const mergedSourceKeyIds = mergeStackedSourceKeyIds(existingEntries, incomingEntries).map((entry) => entry.keyId);
      const lifecyclePlan = planRunScriptStackLifecycle({
        existing: currentTarget,
        phaseOrigin: target.phaseOrigin,
        newCycleLength: writeExtension.newCycleLength,
        repeat: target.repeat,
        ...(lifecycleCap === null ? {} : { cap: lifecycleCap }),
      });
      const lifecycle = lifecyclePlan.lifecycle;
      const updatedTarget: PhysicPaintRotoLoopClip = {
        // 261031-qps (Quick B): a Reveal stack replaces its stored knobs with
        // the run's (each written only when enabled); a Paint stack keeps them
        // untouched. `keyScriptEdits` is never part of this metadata.
        ...(isRevealTarget ? omitStoredRevealKnobs(currentTarget) : currentTarget),
        sourceKeyIds: Object.freeze([...mergedSourceKeyIds]),
        mode: renderMode,
        motion: compactPhysicPaintRotoMotion(motion),
        overrideColor: renderOverrideColor,
        ...(isRevealTarget && colorize.peek() ? { colorize: true as const, colorizeMix: colorizeMix.peek() } : {}),
        ...(isRevealTarget && photoWiggle.peek() ? { photoWiggle: true as const } : {}),
        ...(isRevealTarget && paintSeedVariation.peek() ? { paintSeedVariation: true as const } : {}),
        ...(lifecycle ?? {}),
      };
      const nextClips = Object.freeze(currentLoopClips()
        .filter((clip) => victimClipId === null || clip.loopId !== victimClipId)
        .map((clip) => (clip.loopId === currentTarget.loopId ? updatedTarget : clip)));
      let publication: RotoPlayScriptPhysicalPublication = {
        ...basePublication,
        semanticDelta: { ...basePublication.semanticDelta, preserveSelection: true },
        ...resolvePublicationSelection(commitAuthority),
        loopClips: nextClips,
      };
      // The per-key slices drive BOTH the union re-bake and the post-commit
      // recording; slots align with the committed destination frames.
      const slices = sliceRailKeyScripts({ anchors, frames: destinationAppFrames, mode: renderMode });
      // CR-01: a stack run with no per-key anchors has NO authority-backed
      // picture to publish. A Dry-only persisted script is schema-legal but the
      // bake reports anchors only for real brush strokes, so the slice list is
      // empty; committing the raw staged bake would overwrite every touched
      // key's existing paint with no pin and no recording. Fail closed before
      // the single commit (the reveal path keeps its own explicit refusal).
      if (!isRevealTarget && slices.length === 0) {
        throw new Error('This run produced no per-key strokes, so the rail was not changed. Nothing changed.');
      }
      if (isRevealTarget) {
        // 261031-qps (Quick B): EVERY touched frame is re-rendered through the
        // placed photo reference (same photo, new wash) — including the run's
        // appended tail. Plain-paper Paint bytes must never reach a reveal key.
        status.value = 'Rendering through the photo reference…';
        if (revealTailBake === undefined || slices.length === 0) {
          throw new Error('Reveal tail render is unavailable. Nothing changed.');
        }
        const reveal = await revealTailBake({
          slices,
          frames: destinationAppFrames,
          scriptEvents: aquarelleEventsFromScript(snapshot),
          mode: renderMode,
          motion,
          colorize: colorize.peek(),
          colorizeMix: colorizeMix.peek(),
          photoWiggle: photoWiggle.peek(),
          paintSeedVariation: paintSeedVariation.peek(),
          signal: bakeSignal,
          onProgress: (completed, total) => {
            if (disposed || generation !== acceptedGeneration) return;
            progress.value = { completed, total };
            status.value = `Rendering ${completed} / ${total}`;
          },
        });
        assertCurrent(acceptedGeneration);
        if (reveal.kind !== 'baked') throw new Error(`Reveal tail render refused: ${reveal.reason}`);
        // T-261031-QPS-03: the changed-frame set must equal the touched reveal
        // frames exactly — any extra or missing frame aborts with zero writes.
        const expectedFrames = new Set(destinationAppFrames);
        const renderedBytesByFrame = new Map<number, Uint8Array>();
        for (const frame of reveal.frames) {
          if (!expectedFrames.has(frame.appFrame) || renderedBytesByFrame.has(frame.appFrame)) {
            throw new Error(`Reveal tail render produced an unexpected frame ${frame.appFrame}. Nothing changed.`);
          }
          renderedBytesByFrame.set(frame.appFrame, frame.bytes);
        }
        const missingFrame = destinationAppFrames.find((appFrame) => !renderedBytesByFrame.has(appFrame));
        if (missingFrame !== undefined) {
          throw new Error(`Reveal tail render is missing frame ${missingFrame}. Nothing changed.`);
        }
        publication = withRecordBytes(publication, renderedBytesByFrame);
      } else if (useUnion && unionBake !== undefined && slices.length > 0) {
        status.value = 'Rebuilding key scripts…';
        // ONE batch call: the port resolves every touched key's base through
        // the authority and pins the fresh ones before returning the frames.
        const union = await unionBake({ keyIds: touchedKeyIds, slices });
        assertCurrent(acceptedGeneration);
        if (union.kind !== 'baked') throw new Error(`Keep script re-bake refused: ${union.reason}`);
        if (union.frames.length > 0) {
          publication = withRecordBytes(publication, new Map(union.frames.map((entry) => [entry.appFrame, entry.bytes])));
        }
      } else if (recordMode === 'none' && slices.length > 0) {
        // Pixel-only target with Keep OFF: draw the run over the key's CURRENT
        // payload. Nothing is recorded or pinned, so the picture stays the
        // rail's own (UAT 261031-i54).
        status.value = 'Compositing the run…';
        const compose = ports.composeStackedRailKey;
        if (!compose) throw new Error('This rail saves pixels, but this build cannot composite the run. Nothing changed.');
        const compositeBytesByFrame = new Map<number, Uint8Array>();
        for (const slice of slices) {
          const keyId = touchedKeyIds[slice.slot];
          if (keyId === undefined) continue;
          const composed = await compose({ keyId, appFrame: slice.frame, strokes: slice.strokes });
          assertCurrent(acceptedGeneration);
          if (composed.kind !== 'baked') throw new Error(`Pixel composite refused: ${composed.reason}`);
          compositeBytesByFrame.set(slice.frame, composed.bytes);
        }
        if (compositeBytesByFrame.size > 0) publication = withRecordBytes(publication, compositeBytesByFrame);
      }
      // WR-02: a run that must record can never be reported complete without
      // the recording port. Fail BEFORE the commit — never publish a run whose
      // append/replace was silently skipped.
      const recordRailKeyScripts = ports.recordRailKeyScripts;
      if (recordMode !== 'none' && recordRailKeyScripts === undefined) {
        throw new Error('This build cannot record key scripts. Nothing changed.');
      }
      phase.value = 'committing'; status.value = 'Committing Run Script…'; abortController = null;
      const result = await ports.commit(publication);
      assertCurrent(acceptedGeneration);
      if (!result.ok) throw new Error(result.error || 'Parent rejected the Run Script batch.');
      assertPublicationAck(publication, result);
      // ON appends this run's slices on both rail kinds; a flag-on rail with OFF
      // replaces them; a pixel-only rail with OFF records NOTHING (recordMode
      // 'none' skips the port entirely). `keyScriptEdits` is never written here.
      if (recordMode !== 'none') {
        if (slices.length > 0) {
          status.value = 'Recording key scripts…';
          // The recording loop is synchronous: let the footer paint the phase
          // before it starts instead of leaving the bar silently full.
          await yieldToPaint();
        }
        recordRailKeyScripts!({ keyIds: touchedKeyIds, slices, recordMode });
      }
      collisionChoice.value = null;
      hasSuccessfulGeneration = true;
      const appliedSummary = composeAppliedSummary({
        mode: renderMode,
        overrideColor: renderOverrideColor,
        motion,
        start,
        count: effectiveCount,
      });
      appliedSummaryLine1.value = appliedSummary.line1;
      appliedSummaryLine2.value = `F${start}–F${start + effectiveCount - 1} · Stacked onto the existing rail · Cycle ${writeExtension.newCycleLength}f × ${target.repeat === 'infinity' ? '∞' : target.repeat}`;
      phase.value = 'complete'; progress.value = { completed: effectiveCount, total: effectiveCount };
      status.value = `Run Script complete · ${effectiveCount} frames`;
      confirmationOpen.value = false;
      pinnedStackDestination.value = null;
      ports.log(status.value);
      return true;
    } catch (cause) {
      // CR-04: a stale explicit choice never survives a failed confirm.
      collisionChoice.value = null;
      if (isAbort(cause)) { phase.value = 'cancelled'; status.value = 'Run Script cancelled'; error.value = null; ports.log(status.value); }
      else fail(cause);
      return false;
    } finally { if (generation === acceptedGeneration) abortController = null; }
  }

  /** 261031-i54: write the explicit choice and re-run the same confirm. */
  async function confirmStackCollision(choice: RunScriptCollisionOffer): Promise<boolean> {
    // WR-10: a second click while a bake/commit is in flight is a no-op.
    if (isBusyPhase(phase.peek())) return false;
    if (collisionChoice.peek() !== choice) collisionChoice.value = choice;
    return confirmStack();
  }

  async function confirmGeneration(): Promise<boolean> {
    // 261031-i54: the playhead sits in an existing Paint rail — stack onto it.
    // Every creation branch below stays gated on the 'create' destination.
    if (runDestination.peek().kind === 'stack') return confirmStack();
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
          fail(new Error('Regenerate rejected — saved Script changed.'));
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
      // 261030-v1t: the per-frame paint-seed variation resolves ONCE for the
      // bake — Regenerate restores the frozen Group fact, legacy Source Edit
      // uses the edit target's persisted flag, Apply uses the dialog draft.
      const renderPaintSeedVariation = preparedRegenerate
        ? preparedRegenerate.storedSettings.paintSeedVariation
        : isSourceEdit ? editTarget?.paintSeedVariation === true : paintSeedVariation.peek();
      const rotoBackground = { ...ports.getBackgroundMetadata() };

      // 261030-np9 (D-01/D-05): the bake is the ONLY anchor source, so a path
      // that does not bake owns no anchors and records nothing.
      let anchors: readonly AquarelleStrokeFrameAnchor[] = [];
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
          paintSeedVariation: renderPaintSeedVariation,
          start,
          loopClips: currentLoopClips(),
          identities: authority.physicalRecords.map((record) => ({ keyId: record.keyId, appFrame: record.appFrame })),
        });
        if (!freshMatch) throw new Error('The identical source cycle changed before commit.');
        const linkedRepeat = infinity.peek() ? 'infinity' : parsedRepeat.peek().count!;
        const linkedLoop: PhysicPaintRotoLoopClip = {
          loopId: createPhysicPaintRotoKeyId(),
          placementStart: start,
          sourceKeyIds: freshMatch.sourceKeyIds,
          repeat: linkedRepeat,
          mode: renderMode,
          scriptId: selectedId,
          motion: compactPhysicPaintRotoMotion(motion),
          overrideColor: renderOverrideColor,
          // 261030-ig0 (D-03): the Link-to-existing-cycle branch is the DEFAULT
          // whenever an identical cycle exists — the opt-in must be written here
          // too or the checkbox would be silently inert on that path.
          ...(keyScriptEdits.peek() ? { keyScriptEdits: true as const } : {}),
          // 261030-v1t: the link branch is the DEFAULT whenever an identical
          // cycle exists — the flag must ride here too, or a later Regenerate /
          // Source Edit of that rail would re-bake OFF pixels.
          ...(renderPaintSeedVariation ? { paintSeedVariation: true as const } : {}),
          ...(buildNewLoopLifecycle(start, freshMatch.sourceKeyIds.length, linkedRepeat, authority.physicalCapacity) ?? {}),
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
        // 261030-np9 (D-05): the link branch reuses an existing cycle and never
        // re-bakes, so it has no anchors — the shared cycle's per-key scripts
        // stay exactly as its own apply wrote them (never purged, never
        // rewritten from a schedule this path did not produce). Recording only
        // engages when the flag is on AND a bake reported anchors.
        if (linkedLoop.keyScriptEdits === true && anchors.length > 0) {
          const linkedFrames = linkedLoop.sourceKeyIds.map((keyId) => {
            const record = authority.physicalRecords.find((candidate) => candidate.keyId === keyId);
            return record?.appFrame;
          });
          if (linkedFrames.every((frame): frame is number => frame !== undefined)) {
            ports.recordRailKeyScripts?.({
              keyIds: linkedLoop.sourceKeyIds,
              slices: sliceRailKeyScripts({ anchors, frames: linkedFrames, mode: renderMode }),
              recordMode: 'replace',
            });
          }
        }
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
          throw new Error('Regenerate rejected — saved Script changed.');
        }
      }
      phase.value = 'rendering'; progress.value = { completed: 0, total: count }; status.value = `Rendering 0 / ${count}`;
      // 56-08 consume branch: every script bakes through createAquarelleBake
      // with mode 'flush-survives-navigation' (AQUA-07 / D-21). 261027-klx:
      // watercolor is the only engine, so there is no engine-1 fallback — an
      // old Brush envelope never reaches this point (the library refuses it).
      const baked = await bakeAquarelleScript({ snapshot, count, start, size: ports.getSize(), acceptedGeneration, motion, mode: renderMode, paintSeedVariation: renderPaintSeedVariation });
      const staged = baked.staged;
      anchors = baked.anchors;
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
          throw new Error('Regenerate rejected — saved Script changed.');
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
          ? {
              ...clip,
              sourceKeyIds: Object.freeze([...cycleKeyIds]),
              mode: renderMode,
              scriptId: selectedId,
              motion: compactPhysicPaintRotoMotion(motion),
              overrideColor: renderOverrideColor,
            }
          : clip));
      } else if (isSourceEdit && editTarget && preparedRegenerate) {
        const acceptedDocument = ports.getPhysicalDocument?.() ?? null;
        if (!acceptedDocument || acceptedDocument.revision !== preparedRegenerate.documentRevision) {
          throw new Error('Regenerate rejected — physical Rail document changed.');
        }
        let proposalDocument: PhysicPaintRotoPhysicalDocument = acceptedDocument;
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
            motion: compactPhysicPaintRotoMotion(motion),
            overrideColor: renderOverrideColor,
            ...(clip.loopId === editTarget.loopId && draftRepeat !== null ? { repeat: draftRepeat } : {}),
          };
        });
      } else if (!isSourceEdit && loopIntentActive.peek()) {
        // D-09: new loops are created via Play Script Apply — the loop
        // references the freshly committed cycle keyIds.
        const newLoopRepeat = infinity.peek() ? 'infinity' : parsedRepeat.peek().count!;
        const newLoop: PhysicPaintRotoLoopClip = {
          loopId: createPhysicPaintRotoKeyId(),
          placementStart: start,
          sourceKeyIds: Object.freeze([...cycleKeyIds]),
          repeat: newLoopRepeat,
          mode: renderMode,
          scriptId: selectedId,
          motion: compactPhysicPaintRotoMotion(motion),
          overrideColor: renderOverrideColor,
          // 261030-ig0 (D-03): the creation opt-in, written ONLY when on.
          ...(keyScriptEdits.peek() ? { keyScriptEdits: true as const } : {}),
          // 261030-v1t: written ONLY when on — an OFF rail stays byte-identical.
          ...(renderPaintSeedVariation ? { paintSeedVariation: true as const } : {}),
          ...(buildNewLoopLifecycle(start, cycleKeyIds.length, newLoopRepeat, commitAuthority.physicalCapacity) ?? {}),
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
          return 'Regenerate rejected — saved Script changed.';
        }
        const currentSnapshot = await ports.library.loadSnapshot(preparedRegenerate.actionId);
        if (!currentSnapshot || actionSnapshotHash(currentSnapshot) !== preparedRegenerate.actionHash) {
          return 'Regenerate rejected — saved Script changed.';
        }
        return null;
      } : undefined;
      const result = await ports.commit(publication, revalidateUnderLease);
      assertCurrent(acceptedGeneration);
      if (!result.ok) throw new Error(result.error || 'Parent rejected the Play Script batch.');
      assertPublicationAck(publication, result);
      // 261030-np9 (D-05/D-06): a re-bake REPLACES the per-key scripts, but only
      // for a cycle whose PERSISTED flag is on — the dialog signal is a draft
      // and is never the gate. A cycle that did not opt in stays byte-identical:
      // no purge, no record, no mutation ids consumed.
      const preserveKeyScripts = (loopClips ?? currentLoopClips()).some(
        (clip) => clip.keyScriptEdits === true && sameOrderedIds(clip.sourceKeyIds, cycleKeyIds),
      );
      if (preserveKeyScripts && anchors.length > 0) {
        const keyScriptSlices = sliceRailKeyScripts({ anchors, frames: cycleAppFrames, mode: renderMode });
        // 261030-np9: the bake's anchor count and its slot distribution are the
        // only way to tell "the bake never reported this stroke" apart from
        // "the slice dropped it". Recorded once per apply.
        recordAquarelleRenderSplitEvent('rail-key-scripts', {
          start,
          count,
          mode: renderMode,
          anchors: anchors.length,
          anchorStartFrames: anchors.map((anchor) => anchor.startFrame),
          slices: keyScriptSlices.map((slice) => ({
            slot: slice.slot,
            frame: slice.frame,
            strokes: slice.strokes.length,
          })),
        });
        status.value = 'Recording key scripts…';
        // Let the footer paint this phase before the synchronous recording loop.
        await yieldToPaint();
        ports.recordRailKeyScripts?.({ keyIds: cycleKeyIds, slices: keyScriptSlices, recordMode: 'replace' });
      }
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

  function closeConfirmation(): void {
    if (isBusyPhase(phase.peek())) return;
    pinnedStackDestination.value = null;
    confirmationOpen.value = false;
  }
  function cancel(): void {
    if (canCancel.peek()) {
      generation += 1;
      abortController?.abort();
      abortController = null;
      // WR-14: the pin survives an abort. Cancelling the bake leaves the dialog
      // open on the SAME stack surface; only an explicit close (or a new open)
      // clears it. Unpinning here re-exposed the old silent no-op on create.
    } else closeConfirmation();
  }
  function fail(cause: unknown): void { const message = cause instanceof Error ? cause.message : String(cause); phase.value = 'failed'; progress.value = null; status.value = 'Play Script failed'; error.value = message; ports.log(message, true); }
  function assertCurrent(expected: number): void { if (disposed || generation !== expected) throw new DOMException('Play Script generation cancelled.', 'AbortError'); }
  function nextOperationId(kind: string): string { return `roto-play-script-${kind}-${Date.now()}-${crypto.randomUUID()}`; }

  return {
    confirmationOpen, countText, max, lastFiniteCount, capacity, canonicalStart, mode, overrideEnabled, dialogMotion, repeatText, infinity, lastFiniteRepeat, layerEndExclusive, parsedRepeat, repeatError, loopReadout, loopShortenPreflight, appliedSummary: { line1: appliedSummaryLine1, line2: appliedSummaryLine2 }, destinationRange, validationError, disabledReason, phase, progress, status, error, canCancel,
    dialogMode, loopEditTargetId, loopEditTarget, loopEditSourceStart, sourceEditSharedLoopCount, regenerateDisabledReason, regenerateImpact,
    loopIntentActive, identicalSourceCycle, linkChoice,
    openLoopEdit, openSourceEdit, repairLoop, updateLoop, unlinkLoop, duplicateLinkedLoop, relinkLoop, findIdenticalSourceCycle,
    railTab, revealCountText, parsedRevealCount, revealValidationError, revealReferencePlaced, setRailTab, requestPhotoReference,
    colorize, colorizeMix, setColorize, setColorizeMix,
    photoWiggle, setPhotoWiggle,
    keyScriptEdits, setKeyScriptEdits,
    paintSeedVariation, setPaintSeedVariation,
    /* 261031-i54: Run Script stacking onto an existing Paint rail. */
    /* 261031-qps: `stackRailKind` composes the Reveal stack card set. */
    runDestination, runStartAppFrame: stackRailStart, stackBoundary, stackMaxCount, framesMax, stackReadout, stackRailKind,
    keepScript, keepScriptVisible, keepScriptEffective, keepScriptDisabledReason, stackCollision, collisionOffers, repeatLocked,
    stackOverrideColor, useBrushColor,
    setKeepScript, confirmStackCollision,
    openConfirmation, closeConfirmation, confirm, cancel, setMax, setInfinity, resetDialogMotion,
    dispose: () => {
      disposed = true;
      generation += 1;
      stopStaticDefaults();
      seedKeepScript();
      // AQUA-07 / D-21: a long aquarelle cuisson SURVIVES dispose(). Settle
      // in-flight turns through the bake host's flush — never abort them and
      // never discard already-committed frames. The engine-1 abort below is
      // the PlayScript renderer's own dispose semantics and stays as-is.
      const liveBake = aquarelleBake;
      aquarelleBake = null;
      if (liveBake) {
        void liveBake.flush().catch(() => undefined);
      }
      abortController?.abort();
      abortController = null;
    },
  };
}

/** 261029-bks: wall clock for bake diagnostics (`performance.now` when available). */
function readNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/** Rust VP8L encoder for a squarelle bake frames — toDataURL emits lossy VP8. */
async function encodeAquarelleWebpFrame(frame: CanvasImageSource, width: number, height: number): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not create aquarelle bake encode canvas.');
  ctx.drawImage(frame, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return encodeWebpFrame({
    rgba: new Uint8Array(imageData.data.buffer, imageData.data.byteOffset, imageData.data.byteLength),
    width,
    height,
  });
}

/**
 * 261029-bks: the bake diagnostics merged with the adapter's lifecycle cost
 * (creation span + finally teardown span). The render-split payload shape.
 */
export type AquarelleApplyDiagnostics = AquarelleBakeDiagnostics & { adapterCreateMs: number };

/** 261029-bks: the record forwarded when the bake never emitted (adapter threw). */
function zeroDiagnostics(): AquarelleBakeDiagnostics {
  return {
    path: 'timed',
    timelineTicks: 0,
    simulatedTicks: 0,
    skippedGapTicks: 0,
    gapCount: 0,
    settleTicks: 0,
    bakeMs: 0,
    encodeMs: 0,
    paintSeedReplays: 0,
  };
}

/**
 * 261028-k03c D4: replay a payload timeline into ONE settled frame and return
 * its bytes. Shared by Apply and by the legacy scripted-Lift base recovery, so
 * both see exactly the same bake the script would produce.
 */
export async function bakeAquarelleEventsToFrame(input: {
  events: readonly AquarellePayloadEvent[];
  size: { width: number; height: number };
  paper: AquarelleBakePaper;
  /** 261022 Apply parity: per-fully-fed-stroke progress (Dry excluded). */
  onStrokeFed?: (completed: number, total: number) => void;
  /**
   * 261029-bks: fires exactly once on every exit (success, cancelled, failed,
   * no frames) with the bake's diagnostics merged with `adapterCreateMs`.
   * Called AFTER `bake.dispose()` and `adapter.dispose()`.
   */
  onDiagnostics?: (d: AquarelleApplyDiagnostics) => void;
}): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  const createStartedAt = readNow();
  const adapter = await createDefaultAquarelleAdapter(input.size, input.paper);
  // Creation span: the dynamic import + engine construction. The teardown
  // span is added in the finally — the field is the adapter's lifecycle cost,
  // never the whole bake.
  let adapterCreateMs = readNow() - createStartedAt;
  // A holder, not a bare let: the bake's emit runs inside a callback.
  const bakeDiagnostics: { current: AquarelleBakeDiagnostics | null } = { current: null };
  const bake = defaultCreateAquarelleBake(adapter, {
    width: input.size.width,
    height: input.size.height,
    paper: input.paper,
    encodeWebp: encodeAquarelleWebpFrame,
    // 261019: Apply is Play's end frame. The single-frame timed bake replays
    // the recorded session clock (real gaps, true sample ticks) and cooks to
    // sleep, so the applied key lands the same settled wash the lived sheet
    // reached — the old per-stroke branch stopped at the saved cuisson and
    // came out denser than the paint.
    frameCount: 1,
    onStrokeFed: input.onStrokeFed,
    onDiagnostics: (record) => {
      bakeDiagnostics.current = record;
    },
  });
  try {
    const result = await bake.bake(input.events);
    if (!result.ok) return null;
    const last = result.frames[result.frames.length - 1];
    if (!last) return null;
    await bake.flush();
    return { bytes: last.bytes, width: last.width, height: last.height };
  } finally {
    const teardownStartedAt = readNow();
    bake.dispose();
    // Release the offscreen aquarelle WebGL surface — one bake must not leave
    // a live context competing with the Studio's own sheet.
    adapter.dispose();
    adapterCreateMs += readNow() - teardownStartedAt;
    const consumer = input.onDiagnostics;
    if (consumer) {
      try {
        // The Studio's publish closure runs after this helper returned, so the
        // record is populated before anything reads it.
        consumer({ ...(bakeDiagnostics.current ?? zeroDiagnostics()), adapterCreateMs });
      } catch {
        // T-bks-02: a throwing diagnostics consumer never fails the helper.
      }
    }
  }
}

/**
 * 261018: Apply seam for aquarelle scripts — replay the payload timeline
 * through the aquarelle engine and publish the wash onto the target key.
 * Engine-1 `enqueueRecordedStroke` draws only the guide line; this runs the
 * fluid sim so the wash (bleed, granulation, tide lines) is what lands.
 *
 * 261028-k03c: publish now runs AFTER the bake helper disposed its engine — the
 * baked bytes are self-contained, so the visible behaviour is unchanged and the
 * per-frame WebGL surface is released before the caller writes the key.
 */
export async function applyAquarelleEventsToKey(input: {
  events: readonly AquarellePayloadEvent[];
  target: { keyId: string; appFrame: number };
  size: { width: number; height: number };
  paper: AquarelleBakePaper;
  /** 261022 Apply parity: per-fully-fed-stroke progress (Dry excluded). */
  onStrokeFed?: (completed: number, total: number) => void;
  /** 261029-bks: forwarded unchanged to `bakeAquarelleEventsToFrame`. */
  onDiagnostics?: (d: AquarelleApplyDiagnostics) => void;
  publish: (frame: { keyId: string; appFrame: number; bytes: Uint8Array; width: number; height: number }) => Promise<boolean>;
}): Promise<boolean> {
  const baked = await bakeAquarelleEventsToFrame({
    events: input.events,
    size: input.size,
    paper: input.paper,
    onStrokeFed: input.onStrokeFed,
    onDiagnostics: input.onDiagnostics,
  });
  if (!baked) return false;
  return input.publish({
    keyId: input.target.keyId,
    appFrame: input.target.appFrame,
    bytes: baked.bytes,
    width: baked.width,
    height: baked.height,
  });
}

/** Default engine-2 adapter — lazy so the fluid engine stays out of the UI chunk. */
async function createDefaultAquarelleAdapter(
  size: { width: number; height: number },
  paper?: AquarelleBakePaper,
): Promise<EngineAdapter<AquarelleStrokePayload> & { isAwake?: () => boolean }> {
  const { createAquarelleEngineAdapter } = await import('@efxlab/efx-watercolor');
  return createAquarelleEngineAdapter({
    width: size.width,
    height: size.height,
    paperPreset: paper ? paperPresetForStudioId(paper.paperId) : undefined,
    paperStrength: paper?.grainStrength,
  });
}

/**
 * Project a Roto script's recorded strokes onto the 56-06 payload union.
 * Engine-1 field names never leak into P — this is the engine-2 projection
 * seam (toStudioStroke field-mapping law). Dry events ride the same union
 * (D-16): they interleave with the strokes in recordedOrder so replay
 * re-applies each one between the strokes around it (AQUA-06).
 */
function aquarelleEventsFromScript(script: RotoPaintScript): AquarellePayloadEvent[] {
  // 261018-odm: persisted-first. A reloaded watercolor snapshot carries the
  // complete recorded-order timeline (strokes + Dry already interleaved) —
  // return it as-is so bake.bake has zero dependency on the in-memory map.
  if (script.aquarelleEvents && script.aquarelleEvents.length > 0) {
    return [...script.aquarelleEvents];
  }
  const events: AquarellePayloadEvent[] = [];
  const project = (stroke: RotoPaintScript['brushes'][number]['primary']): StudioStroke<AquarelleStrokePayload> => {
    const storedStroke = stroke.mutationId !== undefined
      ? getRecordedAquarelleStroke(stroke.mutationId)
      : undefined;
    const stored = stroke.mutationId !== undefined
      ? getRecordedAquarellePayload(stroke.mutationId)
      : undefined;
    const raw: AquarelleStroke = {
      tool: stored?.tool ?? 'brush',
      color: stroke.color,
      params: stored
        ? { ...stored.params }
        : {
            size: stroke.params.size,
            water: stroke.params.waterAmount,
            load: stroke.params.opacity,
            flow: 50,
            bleed: 50,
            dry: stroke.params.dryAmount,
            edge: stroke.params.edgeDetail,
            granulation: 50,
          },
      brushId: stored?.brushId || 'wc/round-medium',
      // 56-11: prefer the recorded aquarelle stroke's own points (the live
      // surface is the record source of truth). Fall back to the script's
      // points only when no aquarelle stroke was recorded for this id.
      points: storedStroke
        ? storedStroke.points.map((point) => ({
            x: point.x, y: point.y, p: point.p, tx: point.tx, ty: point.ty, tw: point.tw,
          }))
        : stroke.points.map((point) => ({
            x: point.x, y: point.y, p: point.p, tx: point.tx, ty: point.ty, tw: point.tw,
          })),
      ...(stroke.mutationId !== undefined ? { mutationId: stroke.mutationId } : {}),
      // 261019: the measured settle (recorded after the user left the sheet)
      // outranks the script's save-time cuisson — an Action saved before its
      // settle landed still replays the real diffusion window this session.
      ...(stored?.diffusionFrames !== undefined
        ? { diffusionFrames: stored.diffusionFrames }
        : stroke.diffusionFrames !== undefined
          ? { diffusionFrames: stroke.diffusionFrames }
          : {}),
      timestamp: stroke.timestamp,
      ...(stroke.playFrame !== undefined ? { playFrame: stroke.playFrame } : {}),
    };
    return toStudioStroke(raw);
  };
  // 261022-pim: a stroke deleted from the script (marker set) is absent from
  // every replay channel — including this in-memory fallback that has no
  // persisted `aquarelleEvents`.
  const isDeleted = (stroke: RotoPaintScript['brushes'][number]['primary']): boolean =>
    stroke.mutationId !== undefined && isAquarelleStrokeDeleted(stroke.mutationId);
  for (const brush of script.brushes) {
    if (!isDeleted(brush.primary)) events.push(project(brush.primary));
    for (const continuation of brush.continuations ?? []) {
      if (!isDeleted(continuation)) events.push(project(continuation));
    }
  }
  // D-15/D-16: Dry fires in recorded order between stroke turns. Both
  // members carry recordedOrder (the shared ordering key), so a stable
  // merge on it places each Dry exactly where the user pressed it.
  const drys = getRecordedAquarelleDryEvents();
  if (drys.length === 0) return events;
  const merged: AquarellePayloadEvent[] = [];
  let strokeIndex = 0;
  let dryIndex = 0;
  while (strokeIndex < events.length && dryIndex < drys.length) {
    const strokeOrder = events[strokeIndex]!.recordedOrder;
    // Stroke first on a tie — a Dry pressed in the same ms as a stroke
    // landed after it (recordedOrder is the shared ordering key).
    if (drys[dryIndex]!.recordedOrder < strokeOrder) {
      merged.push(drys[dryIndex]!);
      dryIndex += 1;
    } else {
      merged.push(events[strokeIndex]!);
      strokeIndex += 1;
    }
  }
  while (strokeIndex < events.length) {
    merged.push(events[strokeIndex]!);
    strokeIndex += 1;
  }
  while (dryIndex < drys.length) {
    merged.push(drys[dryIndex]!);
    dryIndex += 1;
  }
  return merged;
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

// 261030-ey9: every dialogMotion write funnels through here so the signal always
// carries four numeric channels, even when the source is a compact persisted record.
/** Give the dialog one paint turn before a synchronous post-commit loop. */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    const raf = (globalThis as { requestAnimationFrame?: (callback: () => void) => number }).requestAnimationFrame;
    if (typeof raf === 'function') raf(() => resolve());
    else globalThis.setTimeout(resolve, 0);
  });
}

function toDialogMotion(motion: Readonly<{ deformation: number; position: number; rotation?: number; scale?: number }>): { deformation: number; position: number; rotation: number; scale: number } {
  return {
    deformation: motion.deformation ?? 0,
    position: motion.position ?? 0,
    rotation: motion.rotation ?? 0,
    scale: motion.scale ?? 0,
  };
}

function composeSummaryLine1(
  mode: RotoPlayScriptMode,
  overrideColor: string | null,
  motion: Readonly<{ deformation: number; position: number; rotation?: number; scale?: number }>,
): string {
  const modeLabel = mode === 'static' ? 'Static / Hold' : 'Progressive';
  const rotation = motion.rotation ?? 0;
  const scale = motion.scale ?? 0;
  const rigid = [rotation !== 0 ? `Rotation ${rotation}` : '', scale !== 0 ? `Scale ${scale}` : ''].filter(Boolean).join(' · ');
  return `${modeLabel} · ${overrideColor ? `Override ${overrideColor}` : 'Original colors'} · Motion ${motion.deformation}/${motion.position}${rigid ? ` · ${rigid}` : ''}`;
}

function composeAppliedSummary(input: {
  readonly mode: RotoPlayScriptMode;
  readonly overrideColor: string | null;
  readonly motion: Readonly<{ deformation: number; position: number; rotation?: number; scale?: number }>;
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
    if (count > maxRepeat) return { count: null, error: 'Cycle count is too large for this cycle length.' };
  }
  return { count, error: null };
}

/**
 * Attach the creation-time Group lifecycle to a NEW finite Loop Clip, with the
 * requested extent CLAMPED to the physical capacity. The Play dialog (and the
 * resolver) explicitly allow a Repeat to run past the timeline end — the rail
 * readout reports "Effective: X — shortened" — but an under-specified clip
 * hydrates to the FULL requested extent (buildDefaultPhysicPaintRotoGroupLifecycle)
 * and the physical-document validator then refuses the whole Play before it is
 * dispatched ("Group ... exceeds capacity"). Stamping the clamped lifecycle at
 * creation keeps the dialog's shortening promise and the document invariant.
 * Infinity stays lifecycle-less — parse never invents one for it (260921-c7x).
 */
function buildNewLoopLifecycle(
  placementStart: number,
  cycleFrameCount: number,
  repeat: number | 'infinity',
  capacity: number,
): Pick<PhysicPaintRotoLoopClip, 'syncState' | 'provenanceState' | 'phaseOrigin' | 'originalEndExclusive' | 'visibleRanges' | 'frameOverrides'> | null {
  if (repeat === 'infinity') return null;
  const endExclusive = Math.min(placementStart + cycleFrameCount * repeat, capacity);
  return {
    syncState: 'synchronized',
    provenanceState: 'attached',
    phaseOrigin: placementStart,
    originalEndExclusive: endExclusive,
    visibleRanges: Object.freeze([Object.freeze({ start: placementStart, endExclusive })]),
    frameOverrides: Object.freeze([]),
  };
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
  assertAuthorityPayloads(authority, 'Play Script publication');
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
      || !isWebpBytes(frame.bytes)) throw new Error('Rendered Play Script output is incomplete or is not valid WebP.');
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
        bytes: frame.bytes,
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

/**
 * 261031-dm1: the two publication builders carry authority payloads into a
 * `ports.commit`. A lean result holds `{ frameIndex, appFrame }` only, so it
 * must be refused BEFORE any payload clone or record map — `clonePhysicalPayload`
 * is a shallow spread and would let the minimal payload survive silently.
 */
function assertAuthorityPayloads(authority: PhysicPaintRotoAuthorityResult, operation: string): void {
  if (authority.identitiesOnly === true) {
    throw new Error(`${operation} requires the full Roto authority; the result was identity-only.`);
  }
}

function clonePhysicalPayload(payload: PhysicPaintRotoPhysicalEditRecord['payload']): PhysicPaintRotoPhysicalEditRecord['payload'] {
  // Carrier-preserving (studio-track-physical-edits): spread keeps media-only
  // payloads intact instead of rebuilding a bytes-only shape.
  return { ...payload };
}

function toPhysicalEditRecord(record: PhysicPaintRotoRealKeyRecord): PhysicPaintRotoPhysicalEditRecord {
  return {
    keyId: record.keyId,
    appFrame: record.appFrame,
    payload: clonePhysicalPayload(record.payload),
  };
}

/**
 * 261031-qps (Quick B): a Reveal stack ADOPTS its four knobs from the run,
 * persisting each only when enabled (the existing field precedent). The rail's
 * previous values are dropped first, so toggling a knob OFF clears the stored
 * flag instead of keeping it, and an all-off run persists no knob at all —
 * byte-identical to a pre-quick rail.
 */
function omitStoredRevealKnobs(clip: PhysicPaintRotoLoopClip): PhysicPaintRotoLoopClip {
  const { colorize, colorizeMix, photoWiggle, paintSeedVariation, ...rest } = clip;
  void colorize; void colorizeMix; void photoWiggle; void paintSeedVariation;
  return rest;
}

/** Publish the post-bake bytes for the touched frames (Keep-script union or pixel composite). */
function withRecordBytes(
  publication: RotoPlayScriptPhysicalPublication,
  bytesByFrame: ReadonlyMap<number, Uint8Array>,
): RotoPlayScriptPhysicalPublication {
  const records = publication.records.map((record) => {
    const bytes = bytesByFrame.get(record.appFrame);
    return bytes === undefined ? record : { ...record, payload: { ...record.payload, bytes } };
  });
  return {
    ...publication,
    records,
    semanticDelta: { ...publication.semanticDelta, proposedRecords: records.map(toPhysicalEditRecord) },
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
      && record.payload.bytes === candidate.payload.bytes
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

/** Ordered visible-range equality — order is meaningful (fragments read left to right). */
function sameVisibleRanges(
  left: readonly PhysicPaintRotoGroupVisibleRange[] | undefined,
  right: readonly PhysicPaintRotoGroupVisibleRange[] | undefined,
): boolean {
  const leftRanges = left ?? [];
  const rightRanges = right ?? [];
  return leftRanges.length === rightRanges.length && leftRanges.every((range, index) => {
    const candidate = rightRanges[index];
    return candidate !== undefined && range.start === candidate.start && range.endExclusive === candidate.endExclusive;
  });
}

/** Ordered frame-override equality — the override key ids and frames must both match. */
function sameFrameOverrides(
  left: readonly PhysicPaintRotoGroupFrameOverride[] | undefined,
  right: readonly PhysicPaintRotoGroupFrameOverride[] | undefined,
): boolean {
  const leftOverrides = left ?? [];
  const rightOverrides = right ?? [];
  return leftOverrides.length === rightOverrides.length && leftOverrides.every((override, index) => {
    const candidate = rightOverrides[index];
    return candidate !== undefined && override.appFrame === candidate.appFrame && override.keyId === candidate.keyId;
  });
}

/**
 * Field-exact Loop Clip collection comparison for the commit acknowledgement.
 * WR-07: the lifecycle frame fields participate too — an ack that silently
 * rewrites phaseOrigin/visibleRanges/frameOverrides is a mismatch, not a pass.
 * CR-07: the two sides come from different projections — the publication is the
 * raw store collection (infinity clips are deliberately lifecycle-less), the
 * ack is the coordinator-normalized wire collection (every clip carries a
 * synthesized lifecycle). Both sides are canonicalized first so the comparison
 * pits ONE canonical shape against itself.
 * WR-12: the reveal colorize pair participates too — an ack that drops or
 * mutates it must fail, not silently replace the accepted collection.
 */
function sameLoopClipCollections(
  left: readonly PhysicPaintRotoLoopClip[] | undefined,
  right: readonly PhysicPaintRotoLoopClip[],
): boolean {
  if (!left || left.length !== right.length) return false;
  const canonicalLeft = canonicalizePhysicPaintRotoLoopClips(left);
  const canonicalRight = canonicalizePhysicPaintRotoLoopClips(right);
  return canonicalLeft.every((clip, index) => {
    const candidate = canonicalRight[index];
    return candidate !== undefined
      && clip.loopId === candidate.loopId
      && clip.placementStart === candidate.placementStart
      && sameOrderedIds(clip.sourceKeyIds, candidate.sourceKeyIds)
      && clip.repeat === candidate.repeat
      && clip.mode === candidate.mode
      && clip.scriptId === candidate.scriptId
      && (clip.railKind ?? null) === (candidate.railKind ?? null)
      && (clip.motion === undefined) === (candidate.motion === undefined)
      && (clip.motion === undefined
        || (clip.motion.deformation === candidate.motion!.deformation
          && clip.motion.position === candidate.motion!.position
          && (clip.motion.rotation ?? 0) === (candidate.motion!.rotation ?? 0)
          && (clip.motion.scale ?? 0) === (candidate.motion!.scale ?? 0)))
      && (clip.photoWiggle ?? false) === (candidate.photoWiggle ?? false)
      && (clip.keyScriptEdits ?? false) === (candidate.keyScriptEdits ?? false)
      && (clip.paintSeedVariation ?? false) === (candidate.paintSeedVariation ?? false)
      && (clip.overrideColor ?? null) === (candidate.overrideColor ?? null)
      && (clip.colorize ?? null) === (candidate.colorize ?? null)
      && (clip.colorizeMix ?? null) === (candidate.colorizeMix ?? null)
      && (clip.syncState ?? null) === (candidate.syncState ?? null)
      && (clip.provenanceState ?? null) === (candidate.provenanceState ?? null)
      && (clip.phaseOrigin ?? null) === (candidate.phaseOrigin ?? null)
      && (clip.originalEndExclusive ?? null) === (candidate.originalEndExclusive ?? null)
      && sameVisibleRanges(clip.visibleRanges, candidate.visibleRanges)
      && sameFrameOverrides(clip.frameOverrides, candidate.frameOverrides);
  });
}
