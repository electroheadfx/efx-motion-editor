// ============================================================
//  AquarelleCanvasLayer — the Water color live surface on the
//  shared Studio canvas (56-11 / 56-12).
//
//  The simulation and display are the MIT Watercolor Playground
//  engine (vendored in @efxlab/efx-watercolor/playground). It owns
//  pointer input, the fluid/liquid physics, brush tips and the
//  paper composite — this component mounts it, keeps the tool +
//  param signals in sync, and records the stroke at stroke end.
//
//  RECORD (56-12 / quick 261116-rp): every raw pointer sample is kept in
//  document uv (y up) with its REAL 60 Hz tick offset — repeats and gaps
//  included — because the deposit is spacing along the raw path. Params are
//  the CANONICAL AQUA-04 globals (never the mapped 0..1 bag). Live and bake
//  both map through toEngineParams() so they cannot drift (A1/A2).
//
//  PHYSIC PAINT STUDIO modal only. Never the inline EFX Paint
//  editor, never p5.brush.
// ============================================================

import type { CSSProperties, JSX } from 'preact';
import { signal } from '@preact/signals';
import { useCallback, useRef } from 'preact/hooks';
import {
  aquarelleVisibleSettleTicks,
  buildBrushForStroke,
  DEFAULT_PAPER,
  engineToolForAquarelleTool,
  maskGeneration,
  PAPERS,
  pigmentFromHex,
  strokeRandomForMutationId,
  toEngineParams,
  WatercolorEngine,
  type AquarellePayloadEvent,
  type PaperPreset,
  type SheetSnapshot,
} from '@efxlab/efx-watercolor';
import type {
  AquarellePoint,
  AquarelleStroke,
  AquarelleTool,
  LightSettings,
  VectorAnchor,
} from '@efxlab/efx-watercolor';
import {
  aquarelleActiveCanonicalSize,
  aquarelleActiveTipId,
  aquarelleActiveTool,
  aquarelleBrushForActiveTool,
  aquarelleParams,
  aquarelleSelectedTipId,
  getRecordedAquarelleStrokeEntries,
  onAquarelleDry,
  snapshotAquarelleRecord,
} from '../view/aquarelleRecordState';
import { libraryRowFor } from '../../../stores/aquarelleBrushCatalog';
import { aquarelleSelectMode } from '../view/aquarelleStrokeSelection';
import { aquarellePickerActive } from '../view/aquarelleColorPicker';
import { frozenCacheVisible } from '../view/scriptStrokeEdition';
import { isFullyOpaqueRaster } from '../../../lib/rasterAlpha';
import { clearAquarelleWetPaint, setAquarelleHasWetPaint } from '../view/aquarelleWetPaintGate';
import type { ScriptStrokeTransform } from '../view/scriptStrokeEdition';
import { buildVectorStroke, type VectorPathCommit } from '../view/vectorPathHandles';
import { clearVectorDraft } from '../view/vectorPathSession';
import { AquarelleStrokeOverlay } from './AquarelleStrokeOverlay';
import { VectorPathOverlay } from './VectorPathOverlay';
import { createAquarelleEnginePort, type AquarelleEnginePort } from './aquarelleEnginePort';
import {
  aquarelleFootprintFor,
  cursorPreviewPressure,
  footprintCssSize,
} from './aquarelleFootprint';
import { aquarelleSheetSignature, hasCacheableScript } from './aquarelleSheetSignature';
// debug-watercolor-loop-render-split (DEV ONLY): names the trigger that did or
// did not reach the Studio capture handler. Installs nothing in production.
import { recordAquarelleRenderSplitEvent } from '../performance/aquarelleRenderSplitCapture';

/** Host tick grid: a raw pointer sample's time is quantized onto it (quick 261116-rp). */
const HOST_TICK_HZ = 60;
const HOST_TICK_MS = 1000 / HOST_TICK_HZ;

/** Engine.ts FIX_DURATION (1.2s) — Dry bakes the wet pigment over this window. */
const FIX_SETTLE_MS = 1200;

// ============================================================
//  Footprint cursor (261028-k03c D6). Same dual-ring family as
//  engine-1's drawBrushCursor — dark under-stroke + white
//  over-stroke, crosshair fallback under 8 CSS px — but the ring
//  now shows the ENGINE's footprint law (aquarelleFootprint.ts):
//  the true radius for the active tool, the tip's aspect, and the
//  rotation the engine would use (including the live pen-tilt
//  azimuth for fixed-rotation tips). DOM refs + module variables
//  only — no state, no effect (efx-preact-reactivity).
// ============================================================

const CURSOR_CROSSHAIR_SIZE = 23;
/** 261030-cnq: exported for the picker visor, which renders ABOVE the tracks
 *  group (outside its stacking context) at the same shell-relative point. */
export const cursorX = signal(-1);
export const cursorY = signal(-1);
export const cursorVisible = signal(false);
/**
 * 261028-k03c WR-01: the footprint inputs below (tilt, pressure, buttons,
 * pointer type, movement angle, layer height) are module variables, and an
 * EQUAL cursorX/cursorY write does not notify — a stationary pen whose
 * pressure or tilt changes would leave the ring stale. This version is bumped
 * compare-then-write only when one of those inputs actually changes; the
 * cursor component reads it so the ring re-renders without a pointer move.
 */
const cursorStateVersion = signal(0);
/** Displayed layer height in CSS px (Engine.updateCursor's view.h / dpr). */
let cursorLayerHeight = 0;
/** Previous pointer sample — the follow-rotation movement direction. */
let lastPointerX: number | null = null;
let lastPointerY: number | null = null;
let lastPointerMoveAngle = 0;
let lastPointerTiltX = 0;
let lastPointerTiltY = 0;
let lastPointerType = 'mouse';
let lastPointerButtons = 0;
let lastPointerPressure = 0;

/**
 * Opaque-sheet law (2026-10-26): MODE.transparent is OPAQUE white where the
 * sheet holds no pigment. Under source-over (the new track law) a blank live
 * sheet would cover the cached base it sits over and read as bare paper. The
 * canvas renders transparent until the engine holds paint — opacity, not
 * visibility, so the canvas keeps owning the pointer (first stroke).
 * Written only on change by the rAF poll (efx-preact-reactivity).
 */
const aquarelleLivePaint = signal(false);

/**
 * LIVE OVER COMMITTED (2026-11-21): true while the live canvas is rendering
 * the WHOLE composite (committed sheet x the session's ink, through the
 * engine's coverage law) and the committed cached base must step aside.
 * The live canvas then shows the base itself, so keeping the cached base
 * underneath would count the same blue twice — a translucent yellow that
 * darkens the layer below (the artist's report). Display-only; the cached
 * base canvas stays mounted (no decode loss).
 */
export const aquarelleBaseCompositedLive = signal(false);

/**
 * LIVE-SEED (2026-11-21): true while the live sheet HOLDS the committed paint
 * as engine state (ink/fixed/cover/lastTouch), seeded by replaying the frame
 * script through the bake's own adapter feed path. The stroke's own touch pass
 * then re-wets the base exactly as the bake does — the pickup law needs the
 * base IN the sheet, not under it. While seeded: the underlay stays unbound
 * (the sheet carries the base itself), the cached base steps aside under the
 * same never-stack law, and the Studio's ordinary capture merges with a null
 * base (the exported sheet already contains it). Written only on change.
 */
export const aquarelleSheetSeeded = signal(false);

/**
 * 261030-cnq: the ring is MOUNTED by the canvas stack (a sibling of the
 * reference overlay), not by this layer — inside the isolated tracks group its
 * z-index is trapped below the photo overlay, so at high overlay opacity the
 * pointer disappeared behind the photo. The signals stay module-private here;
 * the export is only the component.
 */
export function AquarelleBrushCursor(): JSX.Element | null {
  // Select mode hides the paint-size ring — the stroke overlay owns the
  // pointer. Narrow leaf read.
  if (aquarelleSelectMode.value) return null;
  // 261030-cnq: the color picker replaces the ring with the Pipette visor.
  if (aquarellePickerActive.value) return null;
  const x = cursorX.value;
  const y = cursorY.value;
  const visible = cursorVisible.value;
  // WR-01: subscribe to stationary footprint-input changes (tilt/pressure/
  // pointer type/layer height), which no x/y write would notify.
  void cursorStateVersion.value;
  if (!visible || x < 0) return null;

  const tool = aquarelleActiveTool.value;
  // 261028-k03c D6: the ring IS the engine's footprint — the same radius law,
  // the same tip/aspect, the same rotation (including the live pen-tilt
  // azimuth for a fixed-rotation tip), scaled by the displayed layer height.
  // quick 261116-inu / Task 8: and the same ACTIVE canonical — with the split,
  // the eraser ring follows the lift size, never the paint slider.
  const selection = aquarelleBrushForActiveTool();
  const footprint = aquarelleFootprintFor({
    tool,
    tipId: aquarelleActiveTipId(),
    textureId: selection.textureId,
    toolOverrides: selection.toolOverrides,
    size: aquarelleActiveCanonicalSize(),
    pressure: cursorPreviewPressure(lastPointerType, lastPointerButtons, lastPointerPressure),
    moveAngle: lastPointerMoveAngle,
    tiltX: lastPointerTiltX,
    tiltY: lastPointerTiltY,
  });
  const { width, height } = footprintCssSize(footprint, cursorLayerHeight);
  const longAxis = Math.max(width, height);

  if (!(longAxis >= 8)) {
    // Crosshair fallback — a ring this small would be a dot.
    return (
      <div
        class="aquarelle-brush-cursor"
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: `${x - CURSOR_CROSSHAIR_SIZE / 2}px`,
          top: `${y - CURSOR_CROSSHAIR_SIZE / 2}px`,
          width: `${CURSOR_CROSSHAIR_SIZE}px`,
          height: `${CURSOR_CROSSHAIR_SIZE}px`,
          pointerEvents: 'none',
          zIndex: 50,
        }}
      >
        <svg width={CURSOR_CROSSHAIR_SIZE} height={CURSOR_CROSSHAIR_SIZE} viewBox={`0 0 ${CURSOR_CROSSHAIR_SIZE} ${CURSOR_CROSSHAIR_SIZE}`} style={{ overflow: 'visible', display: 'block' }}>
          <g stroke="#111111" strokeWidth={3} vectorEffect="non-scaling-stroke">
            <line x1={0} y1={11.5} x2={10} y2={11.5} />
            <line x1={13} y1={11.5} x2={23} y2={11.5} />
            <line x1={11.5} y1={0} x2={11.5} y2={10} />
            <line x1={11.5} y1={13} x2={11.5} y2={23} />
          </g>
          <g stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke">
            <line x1={0} y1={11.5} x2={10} y2={11.5} />
            <line x1={13} y1={11.5} x2={23} y2={11.5} />
            <line x1={11.5} y1={0} x2={11.5} y2={10} />
            <line x1={11.5} y1={13} x2={11.5} y2={23} />
          </g>
        </svg>
      </div>
    );
  }

  const inset = 1.5;
  const innerW = Math.max(0, width - inset * 2);
  const innerH = Math.max(0, height - inset * 2);
  // The shared footprint law already carries the engine's rounded flag
  // (aspect < ROUNDED_ASPECT) — never re-derive the threshold here.
  const rounded = footprint.rounded;
  return (
    <div
      class="aquarelle-brush-cursor"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${x - width / 2}px`,
        top: `${y - height / 2}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: 'none',
        zIndex: 50,
        // Document space is y up, the screen y down: mirror Engine.updateCursor.
        transform: `rotate(${-footprint.angle}rad)`,
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible', display: 'block' }}>
        {rounded ? (
          <>
            <rect x={inset} y={inset} width={innerW} height={innerH} rx={height * 0.4} fill="none" stroke="#111111" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <rect x={inset} y={inset} width={innerW} height={innerH} rx={height * 0.4} fill="none" stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </>
        ) : (
          <>
            <ellipse cx={width / 2} cy={height / 2} rx={innerW / 2} ry={innerH / 2} fill="none" stroke="#111111" strokeWidth={3} vectorEffect="non-scaling-stroke" />
            <ellipse cx={width / 2} cy={height / 2} rx={innerW / 2} ry={innerH / 2} fill="none" stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
    </div>
  );
}

type RawSample = { x: number; y: number; p: number; tx: number; ty: number; t: number };

/**
 * quick 261116-rp: record EVERY raw pointer sample with its real 60 Hz tick
 * offset. The old linear 60 Hz resample kept the tick grid but flattened the
 * path between ticks — the engine deposits dabs by arc length, so a slow
 * stroke's between-tick tremor (the dabs the live sheet actually made) was
 * lost and every replay came out about twice as light. Ticks may repeat (a
 * fast pointer reports several samples inside one tick) and may skip (a
 * resting pointer); both are real and the bake feeds samples by their own
 * tick, so the raw path is the only faithful recording.
 */
function recordRawSamples(samples: readonly RawSample[]): {
  points: AquarellePoint[];
  pointTicks: number[];
} {
  if (samples.length === 0) return { points: [], pointTicks: [] };
  const start = samples[0]!.t;
  const points: AquarellePoint[] = [];
  const pointTicks: number[] = [];
  for (const sample of samples) {
    points.push({ x: sample.x, y: sample.y, p: sample.p, tx: sample.tx, ty: sample.ty, tw: 0 });
    pointTicks.push(Math.max(0, Math.round((sample.t - start) / HOST_TICK_MS)));
  }
  return { points, pointTicks };
}

function brushIdForSelection(): string {
  return aquarelleSelectedTipId.value ?? 'wc/round-medium';
}

/**
 * F3 (R2.3): the Studio paper id drives the aquarelle engine's DEPOSIT grain
 * (granulation / dry-brush tooth). The display paper stays the Studio fond
 * (paperPass) — never the vendor's own paper composite.
 * Exported in 261017-fz3 so the bake path (bakeAquarelleScript) can reuse the
 * same map — one source for studio-id → PaperPreset.
 */
export const STUDIO_PAPER_TO_PRESET: Readonly<Record<string, string>> = Object.freeze({
  'paper/cold-press': 'cold',
  'paper/hot-press': 'hot',
  'paper/rough': 'rough',
  'paper/khadi': 'khadi',
  'paper/washi': 'washi',
  'paper/laid': 'laid',
  'paper/canvas': 'canvas',
  'paper/toned-sand': 'toned',
  'paper/kraft': 'kraft',
  'paper/student': 'cellulose',
});

export function paperPresetForStudioId(studioId: string): PaperPreset {
  // Q5a: paper/real-1..3 have no procedural preset — fall back to cold.
  const presetId = STUDIO_PAPER_TO_PRESET[studioId] ?? 'cold';
  return PAPERS.find((p) => p.id === presetId) ?? DEFAULT_PAPER;
}

function toolForSelection(): AquarelleTool {
  return aquarelleActiveTool.value;
}

/**
 * quick-261115-oh9 / WR-02: the last mask-registry generation this layer
 * applied. The engine's GPU tip cache keys on ids, but a registry change can
 * replace the BYTES under an unchanged id — sweep the uploads once per
 * generation, exactly like the chip and footprint caches.
 */
let appliedMaskGeneration = -1;

function applyLiveConfig(
  engine: WatercolorEngine,
  getLight?: () => LightSettings | undefined,
  getPaperSeed?: () => number | undefined,
): void {
  const generation = maskGeneration();
  if (generation !== appliedMaskGeneration) {
    appliedMaskGeneration = generation;
    engine.clearTipTextures();
  }
  // quick 261116-inu / Task 8: `toEngineParams(...).size` IS the lift footprint
  // carrier (Engine.radius('lift') reads `this.params.size` via sizeMult, never
  // the lift brush's size). Feed it the ACTIVE tool's canonical — the paint
  // canonical for paint strokes, the lift canonical while erasing — so the
  // live eraser cannot keep following the paint slider after the split.
  engine.setParams(
    toEngineParams({ ...aquarelleParams.value, size: aquarelleActiveCanonicalSize() }),
  );
  // 261121-mtu: the payload union is five members, the engine's is four. The
  // explicit mapping (watercolor → brush) is the ONLY path a payload tool
  // takes into the engine — never a cast, so 'watercolor' can never reach a
  // `tool === 'brush'` engine branch as itself.
  engine.setTool(engineToolForAquarelleTool(aquarelleActiveTool.value));
  // 261028-k03c: the live brush is the SAME selection law the record uses
  // (`aquarelleBrushForActiveTool`), so a Lift stroke's live erase, its
  // recorded brushId and the bake can never disagree. `brushIdForSelection`
  // stays as the historical stroke-end fallback only.
  const selection = aquarelleBrushForActiveTool();
  engine.setBrush(buildBrushForStroke(selection.brushId, {
    // quick-261115-oh9: the live brush binds the same (response, texture)
    // pair the record stores. The eraser selection reports null here.
    textureId: selection.textureId,
    // quick 261116-inu: the library row supplies the default rotation for the
    // NEXT stroke; the live tip must preview the same orientation it stamps.
    textureRotation:
      selection.textureId !== null
        ? libraryRowFor(selection.textureId)?.textureRotation ?? 0
        : null,
    overrides: selection.toolOverrides,
  }));
  // quick-261115-oh9: a pen's ERASER END lifts while the Brush tool — and its
  // textured brush — is bound. Bind the response's own untextured tip too, so
  // the live erase silhouette is the one the punch and the bake erase (the
  // record drops the texture on a lift for the same reason).
  engine.setLiftBrush(selection.textureId === null
    ? null
    : buildBrushForStroke(selection.brushId || 'filbert', {
      // IN-04: the punch resolves an empty response id to filbert
      // (`liftShapeForStroke`), so the live lift must not fall through to
      // `presetFor('')` → round.
      textureId: null,
      overrides: selection.toolOverrides,
    }));
  // 64-07 (MED-17): the layer document's emboss light is render state, read
  // live through the getter on every frame. Absent leaves the engine default
  // in force; `setLight` is compare-then-write (64-04), so an unchanged triple
  // costs three numeric comparisons and nothing else.
  const light = getLight?.();
  if (light) engine.setLight(light);
  // 64-21 (MED-02): the document's sheet seed, read live through the getter —
  // `setPaperSeed` is compare-then-write and never re-creates targets, so an
  // unchanged seed costs one comparison per frame.
  const paperSeed = getPaperSeed?.();
  if (paperSeed !== undefined) engine.setPaperSeed(paperSeed);
}

export function AquarelleCanvasLayer(props: {
  width: number;
  height: number;
  color: string;
  /**
   * FRAME SCOPE: live getter for the Studio edit frame this sheet previews.
   * A getter (not a value prop) keeps the canvas-mount memo stable across
   * frame navigation while the rAF poll still sees the live frame.
   */
  getPlayFrame: () => number;
  /** F3: Studio paper id → the engine's deposit-grain preset (R2.3). */
  getPaperId: () => string;
  /**
   * F3 parity (261027 UAT round 9): the Studio paper's grain strength is the
   * engine's deposit-grain strength. The bake already applies it; leaving the
   * live sheet on the engine default made the live wash and its re-bake run on
   * different tooth and lose density after Move/Apply.
   */
  getPaperGrainStrength?: () => number;
  /**
   * 64-07 (MED-17): the paint-layer document's emboss light — a getter so the
   * per-frame applyLiveConfig reads the LIVE document without a second signal
   * and without invalidating the canvas-mount memo. Absent leaves the engine
   * default in force.
   */
  getLight?: () => LightSettings | undefined;
  /**
   * 64-21 (MED-02): the paint-layer document's sheet seed — a getter on the
   * same terms as `getLight`, so the live sheet paints on the grain the
   * document records (or derives). Absent leaves the engine's own roll in
   * force.
   */
  getPaperSeed?: () => number | undefined;
  disabled?: boolean;
  onStrokeEnd?: (stroke: AquarelleStroke) => void;
  /**
   * LIVE-SEED PARITY (post-UAT 2026-11-21): the capture-phase pointerdown that
   * precedes the engine's own canvas handler asks the Studio for this stroke's
   * mutation id, then seeds the engine with the exact per-stroke key the
   * re-bake's configure() derives from it. A move/edit re-bake then reproduces
   * the live texture instead of re-rolling it. Null keeps the engine's stream.
   */
  onStrokeWillStart?: () => number | null;
  /**
   * 261028-k03 D3/D2: every Lift refusal (Script OFF with a script, group
   * frame, unknown pre-script base, no displayable paint) is decided by the
   * Studio's preflight and applied HERE, in the capture phase — before
   * `cancelAutoFix` and before the engine's own canvas pointerdown. The
   * stroke-end check would already have erased the live sheet and recorded
   * the event. `getLiftBlocked` returns the refusal copy, or null to proceed.
   */
  getLiftBlocked?: () => string | null;
  onLiftBlocked?: (message: string) => void;
  /**
   * 261028-k03b: every Lift dab the ENGINE applied, in document uv (y up) with
   * the footprint radius in document heights and the effective erase amount.
   * The Studio previews the same dab on the cached base so a lift on a cooked
   * frame erases while the user draws. Only lift strokes emit.
   * 261028-k03c: `angle` (radians, y up — the engine's uAxis) rides along so
   * the preview reproduces the erased tip shape; this layer forwards it
   * unchanged and never re-derives it.
   */
  onLiftDab?: (x: number, y: number, r: number, amount: number, angle: number) => void;
  /**
   * PLAY FIDELITY (play-vs-paint): the sheet went to sleep and the last
   * recorded stroke diffused for `ticks` host-grid ticks since it ended.
   * The record path stamps that measured window as the stroke's cuisson so
   * a replay cooks it exactly as long as the live paint did.
   */
  onStrokeSettled?: (stroke: AquarelleStroke, ticks: number) => void;
  /**
   * CACHE WRITE seam (56-12): invoked when the composited sheet must land in
   * the WebP cache — at stroke end and once Dry has settled. The snapshot
   * factory is resolved later by captureLivePixels (52.1 deferred-copy law).
   */
  onCaptureFrame?: (playFrame: number, snapshot: () => HTMLCanvasElement | null, captureTrackId?: string) => void;
  /**
   * NAV FLUSH (paint-cache-empty-frame-on-key): registers a synchronous
   * flush-capture the Studio navigation calls BEFORE flushLivePixels. The rAF
   * poll's frame-leave capture runs one rAF AFTER scheduleRotoStartFramePropagation,
   * which is AFTER the navigation flush has drained — the late capture then sits
   * in CAPTURE_PRODUCE_QUIET_MS and the return-to-key read shows the pre-capture
   * cache (the intermittent empty frame). Mirrors onNativePenInputReady.
   */
  onFlushCaptureReady?: (flushCapture: ((captureTrackId?: string) => void) | null) => void;
  /**
   * SAVE-PATH seam (261026-nvq): registers the current edit frame's composited
   * sheet factory — the SAME `snapshot` closure the cache capture resolves,
   * never a second readback. The sheet is MODE.transparent OPAQUE
   * transmittance (white = no pigment), so a consumer must multiply it over
   * its background. Null on cleanup; mirrors onFlushCaptureReady.
   */
  onSnapshotReady?: (snapshot: (() => HTMLCanvasElement | null) | null) => void;
  /**
   * CACHE MERGE BASE (aquarelle-cache-lost-on-return): a new sheet session
   * begins when the edit frame changes and the engine is cleared. The next
   * session's first capture must re-read the cache as its multiply base — a
   * base pinned before the previous session's commit would drop that paint
   * when the new session's sheet is merged over it.
   */
  onSheetSessionEnd?: () => void;
  /**
   * Quick 261019-mj2 Task 3: registers a same-frame sheet reset. The Studio's
   * generated-cell self-promotion calls it synchronously before dispatching
   * the blank key, so the old generated display never leaks into the stroke.
   * Mirrors the frame-change branch minus the lastPlayFrame update.
   * 64-15: a reset is both halves again — the session bookkeeping AND the
   * pixel wipe. The split registration and the stroke-generation getter were
   * cover-only (the deferred-wipe seam) and retired with the punch
   * architecture.
   */
  onResetSheetReady?: (resetSheet: () => void) => void;
  /**
   * 2026-11-23: the layer hands out its SHEET-ADOPTION seam (null on unmount).
   * A re-render (Apply, a script edit, the artist's manual rebake) passes its
   * bake engine's EXACT sheet here; the live engine restores it, so painting
   * over the committed paint blends and picks up like a fresh bake — with no
   * stroke replay and no per-paint rebake.
   */
  onAdoptSheetReady?: (adopt: ((frame: number, sheet: SheetSnapshot) => boolean) | null) => void;
  /**
   * 261022-pim / 261024-mz5: Alt+click on an outlined stroke (or the whole
   * selected set). The Studio deletes them from the recorded script and
   * re-bakes through the shared Apply path.
   */
  onDeleteStrokes?: (mutationIds: readonly number[]) => void;
  /**
   * 261022-tv1 / 261024-mz5: a committed drag release. The Studio translates
   * every recorded stroke of the selection + its timeline entry and re-bakes
   * through the shared Apply path.
   */
  onMoveStrokes?: (mutationIds: readonly number[], dxPx: number, dyPx: number) => void;
  /**
   * 261024-mz5: a committed corner-scale / rotate release. The Studio
   * transforms every recorded stroke of the selection + its timeline entry in
   * UV space and re-bakes through the shared Apply path.
   */
  onTransformStrokes?: (mutationIds: readonly number[], transform: ScriptStrokeTransform) => void;
  /**
   * 61-10 (VEC-02): one completed path-edit gesture. The overlay asks for the
   * edit; the Studio owns the history entry and the refusal. The layer only
   * forwards the numeric id and the FULL next anchor list.
   */
  onEditVectorPath?: (mutationId: number, anchors: readonly VectorAnchor[]) => void;
  /**
   * ENGINE PORT (261027-klx Wave 3, Option A): the ONE narrow typed surface
   * Roto + the Studio may hold over the watercolor engine. Published once per
   * engine instance after construction; nulled on cleanup. Consumers must keep
   * this exact object — the Roto clipboard keys accepted-target lookups by
   * port identity, so a second port over the same engine reads null.
   */
  onEnginePortReady?: (port: AquarelleEnginePort | null) => void;
  /**
   * LIVE OVER COMMITTED (2026-11-21): the committed sheet this session's ink
   * paints over — the same URL the cached base layer displays. The engine
   * multiplies it under the live film (linear transmittance), so the first
   * render shows exactly what the capture merge will store and a re-bake
   * reproduces. Null when the frame has no committed paint.
   */
  underlayUrl?: string | null;
  /**
   * LIVE-SEED (2026-11-21): the committed frame script (the commit bake's own
   * event list, grid-normalised identically). Read once per seed; the layer
   * replays it into the live engine through the bake's adapter path so the
   * sheet holds the committed paint. Empty / null when the frame has none.
   * 2026-11-22: takes the FRAME so the layer can also read a frame it is
   * leaving (the sheet cache's signature) — a frame number is not identity,
   * so every cache restore is validated against it.
   */
  getSeedEvents?: (frame: number) => readonly AquarellePayloadEvent[] | null;
}) {
  const engineRef = useRef<WatercolorEngine | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const disabledRef = useRef(props.disabled ?? false);
  const colorRef = useRef(props.color ?? '#103c65');
  const widthRef = useRef(props.width);
  const heightRef = useRef(props.height);
  const getPlayFrameRef = useRef(props.getPlayFrame);
  const getPaperIdRef = useRef(props.getPaperId);
  const getPaperGrainStrengthRef = useRef(props.getPaperGrainStrength);
  const getLightRef = useRef(props.getLight);
  const getPaperSeedRef = useRef(props.getPaperSeed);
  const onStrokeEndRef = useRef(props.onStrokeEnd);
  const onStrokeWillStartRef = useRef(props.onStrokeWillStart);
  const getLiftBlockedRef = useRef(props.getLiftBlocked);
  const onLiftBlockedRef = useRef(props.onLiftBlocked);
  const onLiftDabRef = useRef(props.onLiftDab);
  const onStrokeSettledRef = useRef(props.onStrokeSettled);
  const onCaptureFrameRef = useRef(props.onCaptureFrame);
  const onFlushCaptureReadyRef = useRef(props.onFlushCaptureReady);
  const onSnapshotReadyRef = useRef(props.onSnapshotReady);
  const onSheetSessionEndRef = useRef(props.onSheetSessionEnd);
  const onResetSheetReadyRef = useRef(props.onResetSheetReady);
  const onAdoptSheetReadyRef = useRef(props.onAdoptSheetReady);
  const onDeleteStrokesRef = useRef(props.onDeleteStrokes);
  const onMoveStrokesRef = useRef(props.onMoveStrokes);
  const onTransformStrokesRef = useRef(props.onTransformStrokes);
  const onEditVectorPathRef = useRef(props.onEditVectorPath);
  const onEnginePortReadyRef = useRef(props.onEnginePortReady);
  const underlayUrlRef = useRef<string | null>(props.underlayUrl ?? null);
  const getSeedEventsRef = useRef(props.getSeedEvents);
  disabledRef.current = props.disabled ?? false;
  colorRef.current = props.color ?? '#103c65';
  widthRef.current = props.width;
  heightRef.current = props.height;
  getPlayFrameRef.current = props.getPlayFrame;
  getPaperIdRef.current = props.getPaperId;
  getPaperGrainStrengthRef.current = props.getPaperGrainStrength;
  getLightRef.current = props.getLight;
  getPaperSeedRef.current = props.getPaperSeed;
  onStrokeEndRef.current = props.onStrokeEnd;
  onStrokeWillStartRef.current = props.onStrokeWillStart;
  getLiftBlockedRef.current = props.getLiftBlocked;
  onLiftBlockedRef.current = props.onLiftBlocked;
  onLiftDabRef.current = props.onLiftDab;
  onStrokeSettledRef.current = props.onStrokeSettled;
  onCaptureFrameRef.current = props.onCaptureFrame;
  onFlushCaptureReadyRef.current = props.onFlushCaptureReady;
  onSnapshotReadyRef.current = props.onSnapshotReady;
  onSheetSessionEndRef.current = props.onSheetSessionEnd;
  onResetSheetReadyRef.current = props.onResetSheetReady;
  onAdoptSheetReadyRef.current = props.onAdoptSheetReady;
  onDeleteStrokesRef.current = props.onDeleteStrokes;
  onMoveStrokesRef.current = props.onMoveStrokes;
  onTransformStrokesRef.current = props.onTransformStrokes;
  onEditVectorPathRef.current = props.onEditVectorPath;
  onEnginePortReadyRef.current = props.onEnginePortReady;
  underlayUrlRef.current = props.underlayUrl ?? null;
  getSeedEventsRef.current = props.getSeedEvents;

  // FRAME SCOPE: the sheet previews ONE edit frame. Changing frames must never
  // leak the previous frame's paint (the user saw the same paint on every
  // Studio frame). The cache owns the other frames. Detected in the rAF signal
  // poll below — never a useEffect (efx-preact-reactivity).
  const lastPlayFrameRef = useRef(props.getPlayFrame());

  // 61-09 (VEC-01 / VEC-07): the vector-half's commit seam. The overlay hands
  // ONE finished path; this assembles the complete stroke from the SAME
  // snapshot / selection expressions the hand-painted `onStrokeEnd` literal
  // below uses, then forwards it to the SAME `onStrokeEnd` seam — so a vector
  // stroke costs exactly one revision bump and gains no bake authority.
  const handleVectorCommit = useCallback((commit: VectorPathCommit) => {
    const snap = snapshotAquarelleRecord();
    const stroke = buildVectorStroke(commit, {
      color: colorRef.current,
      params: { ...snap.params },
      brushId: snap.brushId || brushIdForSelection(),
      // quick-261115-oh9: the texture axis rides the same conditional-spread
      // law the stroke-end literal uses.
      ...(snap.textureId !== null ? { textureId: snap.textureId } : {}),
      // quick 261116-inu: the vector stroke records the same library-default
      // rotation the hand-painted literal records.
      ...(snap.textureRotation !== undefined
        ? { textureRotation: snap.textureRotation }
        : {}),
      toolOverrides: { ...snap.toolOverrides },
      tool: toolForSelection(),
      diffusionFrames: aquarelleVisibleSettleTicks(snap.params['dry'] ?? 50),
      timestamp: Date.now(),
      // FRAME SCOPE: anchored to the edit frame this sheet previews.
      playFrame: getPlayFrameRef.current(),
    });
    onStrokeEndRef.current?.(stroke);
  }, []);

  // Engine mount/unmount rides a Preact callback ref (efx-preact-reactivity:
  // no useEffect). A key change on width/height remounts the canvas element,
  // which re-runs this ref with null then the new node.
  const attachEngine = useCallback((canvas: HTMLCanvasElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    engineRef.current = null;
    // ENGINE PORT: no live engine until the constructor below succeeds, so a
    // consumer must not be able to reach the previous (or a half-built) one.
    onEnginePortReadyRef.current?.(null);
    if (!canvas) return;

    // PLAY FIDELITY: the last recorded stroke awaiting its measured settle
    // window (stamped when the sheet sleeps or the frame changes).
    let pendingSettle: { stroke: AquarelleStroke; endedAt: number } | null = null;
    const stampPendingSettle = () => {
      const pending = pendingSettle;
      if (!pending) return;
      pendingSettle = null;
      const ticks = Math.round((performance.now() - pending.endedAt) / HOST_TICK_MS);
      onStrokeSettledRef.current?.(pending.stroke, ticks);
    };

    // 261019c VISIBLE SETTLE CAP (user decision): the wash force-dries at the
    // same short window the bake uses, so the live sheet, its cache capture,
    // and the Play end key keep the denser look instead of cooking to the
    // engine's washed-out full awake state.
    let painting = false;
    let lastWetAt = 0;
    let settleCapArmed = false;

    let engine: WatercolorEngine;
    try {
      engine = new WatercolorEngine(
        canvas,
        null,
        {
          onStrokeSample(sample) {
            painting = true;
            lastWetAt = performance.now();
            settleCapArmed = false;
            const sink = (engine as unknown as { __samples?: RawSample[] }).__samples;
            if (sink) sink.push(sample);
          },
          // 261028-k03b: the exact dab the engine erased with — the cached
          // base preview punches the same numbers, so what the user sees
          // during the stroke is what the live pass applied.
          onLiftDab(x, y, r, amount, angle) {
            onLiftDabRef.current?.(x, y, r, amount, angle);
          },
          onStrokeEnd(tool, reliefOnly) {
            painting = false;
            lastWetAt = performance.now();
            settleCapArmed = false;
            const carrier = engine as unknown as { __samples?: RawSample[] };
            const raw = carrier.__samples ?? [];
            carrier.__samples = [];
            const recorded = recordRawSamples(raw);
            if (recorded.points.length === 0) return;
            const snap = snapshotAquarelleRecord();
            // 61-07 (D-14): the record-time mode resolves from the SAME brush
            // id this literal stores, so the stamp and the brushId can never
            // disagree about what the live stroke deposited.
            const recordedBrushId = snap.brushId || brushIdForSelection();
            // The ENGINE-resolved tool for THIS stroke — never the carried
            // selection. It also gates the texture: the eraser has none.
            const recordedTool = (tool ?? toolForSelection()) as AquarelleTool;
            const stroke: AquarelleStroke = {
              // 261028-k03: the ENGINE resolves the live tool for THIS stroke
              // (stylus eraser end, pen barrel, finger-water) and hands it to
              // onStrokeEnd. Record that, not the selection, or a re-bake
              // replays a brush where the user erased. Never carry it across
              // strokes: the engine emits only on a change.
              tool: recordedTool,
              color: colorRef.current,
              // CANONICAL AQUA-04 globals — never the mapped bag.
              params: { ...snap.params },
              brushId: recordedBrushId,
              points: recorded.points,
              // quick 261116-rp: every raw pointer sample's real tick. The
              // projection carries these to pts[].tick so the bake can feed
              // the same path the live sheet deposited.
              pointTicks: recorded.pointTicks,
              // quick-261115-oh9: written ONLY when a texture is selected, so
              // an untextured stroke keeps its exact pre-texture key set. A
              // LIFT stroke never carries one: the eraser has no texture, and
              // the punch/bake would ignore it while a replay would not.
              ...(recordedTool !== 'lift' && snap.textureId !== null
                ? { textureId: snap.textureId }
                : {}),
              // quick 261116-inu: the recorded rotation rides the same
              // lift-gated conditional spread as its texture.
              ...(recordedTool !== 'lift' && snap.textureRotation !== undefined
                ? { textureRotation: snap.textureRotation }
                : {}),
              // Quick 261123-jak: the engine's stroke-start Shift latch rides
              // the record ONLY when set, so an ordinary stroke keeps its
              // exact key set — and a re-render replays the smoothing.
              ...(reliefOnly === true ? { reliefOnly: true } : {}),
              toolOverrides: { ...snap.toolOverrides },
              // Visible settle window (D-19, cap 600) — the SAME cap the live
              // sheet force-dries at and the bake replays.
              diffusionFrames: aquarelleVisibleSettleTicks(snap.params['dry'] ?? 50),
              timestamp: Date.now(),
              // FRAME SCOPE: the stroke is anchored to the edit frame this sheet
              // previews. toStudioStroke maps this to StudioStroke.playFrame.
              playFrame: getPlayFrameRef.current(),
            };
            onStrokeEndRef.current?.(stroke);
            // PLAY FIDELITY: remember the stroke until the sheet sleeps; the
            // measured awake window becomes its recorded cuisson (below).
            pendingSettle = { stroke, endedAt: performance.now() };
            // CACHE WRITE (settle) owns the commit — a stroke-end capture would
            // land the WET (washed) sheet. The rAF poll watches engine.isAwake
            // and captures the concentrated dry look.
          },
        },
        [widthRef.current, heightRef.current],
      );
    } catch {
      // No WebGL2 / float targets — leave the canvas blank rather than crash the Studio.
      return;
    }
    (engine as unknown as { __samples?: RawSample[] }).__samples = [];
    engineRef.current = engine;
    // ENGINE PORT (261027-klx): ONE port per engine instance. Roto and the
    // Studio must both hold this object — the accepted-target WeakMap is keyed
    // by port identity, so a second port reads every lookup as null.
    onEnginePortReadyRef.current?.(createAquarelleEnginePort(() => engineRef.current));

    // 261027-gh9e NATIVE PRESSURE BRIDGE: on macOS a tablet often reaches the
    // webview as pointerType 'mouse' with no pressure. The Rust side reads the
    // device and emits `tablet:pressure` (the same event the engine-1 brush
    // consumes); forward it so Water color responds to the pen.
    let penBridgeDisposed = false;
    let disposePenBridge: (() => void) | undefined;
    void (async () => {
      try {
        const eventApi = await import('@tauri-apps/api/event');
        if (typeof eventApi.listen !== 'function') return;
        const unlisten = await eventApi.listen<{ pressure: number; tilt_x: number; tilt_y: number }>(
          'tablet:pressure',
          (event) => {
            engine.updateNativePenInput({
              pressure: event.payload.pressure,
              tiltX: event.payload.tilt_x,
              tiltY: event.payload.tilt_y,
            });
          },
        );
        if (penBridgeDisposed) unlisten();
        else disposePenBridge = unlisten;
      } catch {
        // Browser/dev without the native bridge: pointer pressure still works.
      }
    })();

    // COMPOSITOR LAYER: exact-fit pointer mapping (no fit margin) + pigment
    // display on transparent (the document fond is the compositor's — v1.0).
    engine.setCompositorLayer(true);

    applyLiveConfig(engine, getLightRef.current, getPaperSeedRef.current);
    engine.setPigment(pigmentFromHex(colorRef.current));
    // F3: deposit grain follows the Studio paper (R2.3) — never the vendor
    // default. 261027 UAT round 9: the STRENGTH is half of that law; the bake
    // applies it, so the live sheet must too or a re-bake changes the wash.
    let lastPaperId = '';
    let lastPaperStrength = -1;
    const applyPaper = () => {
      const paperId = getPaperIdRef.current();
      const strength = getPaperGrainStrengthRef.current?.();
      const nextStrength =
        typeof strength === 'number' && Number.isFinite(strength)
          ? Math.max(0, Math.min(1, strength))
          : -1;
      if (paperId === lastPaperId && nextStrength === lastPaperStrength) return;
      lastPaperId = paperId;
      lastPaperStrength = nextStrength;
      engine.setPaper(paperPresetForStudioId(paperId));
      if (nextStrength >= 0) engine.paperTexture = nextStrength;
    };
    applyPaper();

    // KEY = CACHE (2026-11-22, artist law): a key OPENS on its committed
    // cache. The live sheet is NEVER rebuilt by replaying recorded strokes —
    // not on a key change, not after a lift, not on Studio open. The only
    // sheet a key can start with is one THIS session captured when the artist
    // left that key; every other key starts on a blank sheet over its cached
    // image (the display underlay), exactly like the app's cache law.
    const SHEET_CACHE_MAX_FRAMES = 3;
    const SHEET_CACHE_MAX_BYTES = 256 * 1024 * 1024;
    interface CachedSheet { signature: number; sheet: SheetSnapshot; bytes: number }
    const sheetCache = new Map<number, CachedSheet>();
    const sheetBytes = (sheet: SheetSnapshot): number => {
      let total = 0;
      for (const layer of Object.values(sheet.whole.layers)) total += layer.byteLength;
      return total;
    };
    // IN-05 (KEY = CACHE): the cache key is the frame's SCRIPT identity — a
    // canonical digest of the WHOLE event list (aquarelleSheetSignature), so
    // a key can only restore a sheet captured under the exact current script.
    // Counts alone are not identity: a moved point or a changed param has to
    // change the key, or the key opens stale pixels.
    const rememberSheet = (frame: number, signature: number, sheet: SheetSnapshot) => {
      const bytes = sheetBytes(sheet);
      // One sheet over half the budget would evict everything else for a
      // single frame — that key simply opens on its cached image.
      if (bytes > SHEET_CACHE_MAX_BYTES / 2) return;
      sheetCache.delete(frame);
      sheetCache.set(frame, { signature, sheet, bytes });
      let total = 0;
      for (const entry of sheetCache.values()) total += entry.bytes;
      while (sheetCache.size > SHEET_CACHE_MAX_FRAMES || total > SHEET_CACHE_MAX_BYTES) {
        const oldest = sheetCache.keys().next();
        if (oldest.done) break;
        const entry = sheetCache.get(oldest.value);
        if (entry) total -= entry.bytes;
        sheetCache.delete(oldest.value);
      }
    };
    const takeSheet = (frame: number, signature: number): SheetSnapshot | null => {
      const entry = sheetCache.get(frame);
      if (!entry) return null;
      if (entry.signature !== signature) {
        // The frame's script changed since the capture — the sheet is stale.
        sheetCache.delete(frame);
        return null;
      }
      sheetCache.delete(frame);
      sheetCache.set(frame, entry);
      return entry.sheet;
    };

    // Apply this session's captured sheet for `frame`, when its script still
    // matches the capture. No replay happens here — either the exact sheet is
    // uploaded or the key opens blank over its cache.
    const restoreCachedSheet = (frame: number, events: unknown): boolean => {
      // IN-02: the ONE emptiness decision, shared with both remember sites —
      // a script this refuses is never parked either.
      if (!hasCacheableScript(events)) return false;
      const cached = takeSheet(frame, aquarelleSheetSignature(events));
      if (!cached || !engine.restoreSheet(cached)) return false;
      aquarelleSheetSeeded.value = true;
      return true;
    };

    // LIVE OVER COMMITTED (2026-11-21): the engine's underlay is the frame's
    // DISPLAYED committed sheet — the same bytes the cached base layer shows.
    // URL changes ride the rAF poll (no effect); the stroke-settings cache eye
    // hides it exactly like the cached base layer's display-only hide. A
    // legacy real-alpha frame is not a transmittance sheet (the cached base
    // draws it raw), so it never becomes an underlay.
    let appliedUnderlayUrl: string | null = null;
    let appliedUnderlayVisible = true;
    let underlayApplied = false;
    let underlayToken = 0;
    const syncUnderlay = () => {
      // A RESTORED sheet (this session's capture) CARRIES the committed base
      // in its own ink / cover channels — binding the display underlay over
      // it would multiply the base under its own copy. A blank sheet keeps
      // the key's cached image as the display base (the app's cache law).
      const seeded = aquarelleSheetSeeded.value;
      const url = seeded ? null : underlayUrlRef.current;
      const visible = seeded ? false : frozenCacheVisible.value;
      if (url === appliedUnderlayUrl && visible === appliedUnderlayVisible) return;
      appliedUnderlayUrl = url;
      appliedUnderlayVisible = visible;
      const token = ++underlayToken;
      if (!url || !visible) {
        underlayApplied = false;
        engine.setUnderlay(null);
        return;
      }
      const image = new Image();
      image.onload = () => {
        if (token !== underlayToken) return;
        const opaque = isFullyOpaqueRaster(image);
        underlayApplied = opaque;
        engine.setUnderlay(opaque ? image : null);
      };
      image.onerror = () => {
        if (token !== underlayToken) return;
        underlayApplied = false;
        engine.setUnderlay(null);
      };
      image.src = url;
    };
    // KEY = CACHE: the session starts on the key's cached image (the
    // underlay) with a blank sheet — never on a replay.
    syncUnderlay();

    // REFIT (261027 UAT round 4, Bug 3): the engine captures dpr + canvasSize
    // + view at construction (`fitCanvas`) and maps EVERY pointer through
    // them (`toUv`). The canvas CSS box can change later without remounting
    // this element — a Studio window/panel resize, or a DPR change when the
    // window moves across displays — and the stale capture then paints ~200
    // px away from the pen until Studio reopens. Observe both drifts and call
    // the engine's public resize(), which re-captures the live box.
    let lastBoxWidth = 0;
    let lastBoxHeight = 0;
    let lastDpr = 0;
    const refitIfDrifted = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (rect.width === lastBoxWidth && rect.height === lastBoxHeight && dpr === lastDpr) return;
      lastBoxWidth = rect.width;
      lastBoxHeight = rect.height;
      lastDpr = dpr;
      engine.resize();
    };
    const resizeObserver = new ResizeObserver(refitIfDrifted);
    resizeObserver.observe(canvas);
    let dprQuery: MediaQueryList | null = null;
    const onDprChange = () => {
      dprQuery?.removeEventListener('change', onDprChange);
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprQuery.addEventListener('change', onDprChange);
      refitIfDrifted();
    };
    onDprChange();

    // CACHE WRITE: the composited sheet (transparent background — A5 export
    // law). Resolved later by captureLivePixels (52.1 deferred-copy law).
    const snapshot = () => {
      try {
        return engine.exportCanvas('transparent');
      } catch {
        return null;
      }
    };

    // NAV FLUSH: synchronous pre-leave capture the Studio navigation calls
    // before flushLivePixels. The rAF poll's frame-change capture runs one rAF
    // after scheduleRotoStartFramePropagation — i.e. AFTER the navigation flush
    // has already drained — so without this the capture is queued too late and
    // sits in CAPTURE_PRODUCE_QUIET_MS (the empty-frame-on-return race).
    // A track switch flushes AFTER the document's active track moved: the
    // caller passes the OUTGOING track so its sheet commits to its own key.
    const flushCapture = (captureTrackId?: string) => {
      const hasPaint = engine.hasPaint;
      recordAquarelleRenderSplitEvent('layer-capture', {
        trigger: 'flush',
        playFrame: lastPlayFrameRef.current,
        hasPaint,
        invoked: hasPaint,
      });
      if (!hasPaint) return;
      onCaptureFrameRef.current?.(lastPlayFrameRef.current, snapshot, captureTrackId);
    };
    onFlushCaptureReadyRef.current?.(flushCapture);

    // SAVE PATH (261026-nvq): register the SAME composited-sheet factory the
    // cache capture resolves. A separate `exportCanvas` read would be a second
    // readback and could diverge; the engine is configured above, so this is
    // the first moment the export reflects the live mode + paper.
    onSnapshotReadyRef.current?.(snapshot);

    // D-15: user-initiated Dry is one event with two ends. The record end
    // (aquarelleRecordState) already appended it to the payload timeline;
    // this is the LIVE end — force-dry the wet sheet so the paint stops
    // moving right where the user pressed Dry. No second channel.
    const offDry = onAquarelleDry(() => {
      settleCapArmed = true;
      engine.fix();
    });

    // BLEND REOPEN: the settle cap's fix bakes the mobile pigment into the paper,
    // and fixed pigment cannot be moved by a later water stroke — wet-on-wet
    // blending died after a pause. A new stroke reopens the cap fix (the engine
    // restores the pre-fix wet state) so the sheet is blendable again. Capture
    // on window so this runs BEFORE the engine's own canvas pointerdown.
    const reopenSettleOnPaint = (event: PointerEvent) => {
      if (event.target !== canvas || event.button === 1) return;
      // 261028-k03 D3/D2: every Lift refusal (Script OFF with a script, group
      // frame, unknown pre-script base, no displayable paint) must happen at
      // POINTERDOWN — the only place that keeps the gesture out of the engine.
      // A stroke-end check would already have erased the live sheet and left a
      // recorded event behind. A stylus eraser end (`buttons & 32`) is a lift
      // gesture even when the selected tool is brush; the engine resolves it.
      const liftGesture = toolForSelection() === 'lift'
        || (event.pointerType === 'pen' && (event.buttons & 32) === 32);
      const refusal = liftGesture ? getLiftBlockedRef.current?.() ?? null : null;
      if (refusal !== null) {
        event.preventDefault();
        event.stopPropagation();
        onLiftBlockedRef.current?.(refusal);
        return;
      }
      engine.cancelAutoFix();
      // LIVE-SEED PARITY (post-UAT 2026-11-21): this capture listener runs
      // BEFORE the engine's own canvas pointerdown, so the stream is keyed
      // before the first dab. The Studio draws the id here because stroke end
      // must accept THAT id — a fresh allocation would re-roll every re-bake.
      // `painting` is the palm-rejection guard: a second pointer during a
      // stroke must never re-key the bristles already depositing.
      if (!painting && !disabledRef.current) {
        const mutationId = onStrokeWillStartRef.current?.() ?? null;
        if (mutationId !== null) engine.setRandom(strokeRandomForMutationId(mutationId));
      }
    };
    window.addEventListener('pointerdown', reopenSettleOnPaint, true);

    // CACHE WRITE (Dry settle): fix() bakes the wet pigment over FIX_DURATION.
    // A second sink keeps the Dry wiring above untouched — this one only
    // schedules the cache commit of the settled sheet. Stamped with the Dry-time
    // frame so a navigation during settle never commits the next frame's sheet.
    const pendingSettleTimers = new Set<number>();
    const offDryCapture = onAquarelleDry(() => {
      const dryPlayFrame = getPlayFrameRef.current();
      const timer = window.setTimeout(() => {
        pendingSettleTimers.delete(timer);
        const frameChanged = getPlayFrameRef.current() !== dryPlayFrame;
        const hasPaint = engine.hasPaint;
        recordAquarelleRenderSplitEvent('layer-capture', {
          trigger: 'dry',
          playFrame: dryPlayFrame,
          hasPaint,
          frameChanged,
          invoked: !frameChanged && hasPaint,
        });
        if (frameChanged) return;
        if (!hasPaint) return;
        onCaptureFrameRef.current?.(dryPlayFrame, snapshot);
      }, FIX_SETTLE_MS);
      pendingSettleTimers.add(timer);
    });

    // Tool / params / tip / color are Preact signals — poll on rAF while mounted.
    // FRAME SCOPE rides the same poll: a playFrame change wipes the sheet so the
    // preview never leaks the previous edit frame's paint.
    let raf = 0;
    let wasAwake = engine.isAwake;
    // Quick 261019-mj2 Task 3: same-frame reset registration for the Studio's
    // generated-cell self-promotion. Same work as the frame-change branch
    // below EXCEPT the lastPlayFrame update (this is the same frame).
    // quick 261117-tq7 (rev 4, UAT round 4): the reset is registered in two
    // halves so the cover can keep the SESSION bookkeeping synchronous while
    // deferring only the pixel wipe until the committed base is on screen.
    const endSheetSession = () => {
      stampPendingSettle();
      onSheetSessionEndRef.current?.();
    };
    const clearSheetPaint = () => {
      engine.clear();
      painting = false;
      lastWetAt = 0;
      settleCapArmed = false;
      wasAwake = false;
    };
    const resetSheet = () => {
      endSheetSession();
      clearSheetPaint();
      // KEY = CACHE: a reset (Apply, lift, track switch) wipes the sheet. The
      // key continues on its committed cached image (the underlay) — the
      // sheet is never rebuilt from recorded strokes.
      aquarelleSheetSeeded.value = false;
    };
    onResetSheetReadyRef.current?.(resetSheet);
    // 2026-11-23: adopt a re-render's EXACT bake sheet into the LIVE engine.
    // The artist's re-render is the base rebuild; painting on it must blend
    // and pick up like a fresh bake WITHOUT replaying the script and WITHOUT
    // a rebake per stroke. The sheet carries last-touch AGES (the engine
    // re-stamps them on this clock), so wetness survives the engine hop.
    const adoptSheet = (frame: number, sheet: SheetSnapshot): boolean => {
      if (frame !== getPlayFrameRef.current()) return false;
      if (!engine.restoreSheet(sheet)) return false;
      aquarelleSheetSeeded.value = true;
      painting = false;
      lastWetAt = 0;
      settleCapArmed = false;
      wasAwake = false;
      const events = getSeedEventsRef.current?.(frame) ?? null;
      if (hasCacheableScript(events)) rememberSheet(frame, aquarelleSheetSignature(events), sheet);
      return true;
    };
    onAdoptSheetReadyRef.current?.(adoptSheet);
    const tick = () => {
      const playFrame = getPlayFrameRef.current();
      if (lastPlayFrameRef.current !== playFrame) {
        // CACHE WRITE: leaving a frame lands whatever the sheet holds before
        // the wipe — never a blank sheet over existing cache.
        const leavingHasPaint = engine.hasPaint;
        recordAquarelleRenderSplitEvent('layer-capture', {
          trigger: 'frame-leave',
          playFrame: lastPlayFrameRef.current,
          nextPlayFrame: playFrame,
          hasPaint: leavingHasPaint,
          invoked: leavingHasPaint,
        });
        if (leavingHasPaint) {
          onCaptureFrameRef.current?.(lastPlayFrameRef.current, snapshot);
          // SHEET CACHE (no replay): the sheet the artist is leaving is
          // exactly the state they will expect on return — keep it with the
          // script signature it was built from so the return can upload it.
          const leavingFrame = lastPlayFrameRef.current;
          const leavingEvents = getSeedEventsRef.current?.(leavingFrame) ?? null;
          if (hasCacheableScript(leavingEvents)) {
            rememberSheet(leavingFrame, aquarelleSheetSignature(leavingEvents), engine.captureSheet());
          }
        }
        // PLAY FIDELITY: the sheet is about to be wiped — stamp the measured
        // settle window for a stroke whose cooking never reached sleep.
        stampPendingSettle();
        // aquarelle-cache-lost-on-return: the sheet session ends here. The
        // next session's first capture must re-read the CACHE as its multiply
        // base — the base pinned for the old session predates its commit and
        // would drop that paint when the new sheet merges over it.
        onSheetSessionEndRef.current?.();
        lastPlayFrameRef.current = playFrame;
        engine.clear();
        // The new frame starts clean — a settle capture here would write the
        // empty sheet over that frame's cache.
        painting = false;
        lastWetAt = 0;
        settleCapArmed = false;
        wasAwake = false;
        // KEY = CACHE: a key this session already visited uploads its own
        // captured sheet (an upload, never a replay). Every other key opens
        // blank over its committed cached image — the underlay binds below.
        const frameEvents = getSeedEventsRef.current?.(playFrame) ?? null;
        aquarelleSheetSeeded.value = restoreCachedSheet(playFrame, frameEvents);
      }
      // VISIBLE SETTLE CAP: no wet input for the cap window → force-dry. The
      // fix bakes over 1.2 s and sleeps, so the settle capture lands the
      // denser wash the bake's capped end frame holds. The cap fix is marked
      // AUTO: the next stroke reopens it (see reopenSettleOnPaint) so it can
      // still blend; an explicit Dry stays permanent.
      if (!painting && !settleCapArmed && lastWetAt > 0 && engine.isAwake) {
        const capMs = aquarelleVisibleSettleTicks(aquarelleParams.value.dry) * HOST_TICK_MS;
        if (performance.now() - lastWetAt >= capMs) {
          settleCapArmed = true;
          engine.fix(true);
        }
      }
      // CACHE WRITE (settle): the dry (concentrated) look, not the wet stroke.
      const awake = engine.isAwake;
      if (wasAwake && !awake && engine.hasPaint) {
        recordAquarelleRenderSplitEvent('layer-capture', {
          trigger: 'settle',
          playFrame,
          hasPaint: true,
          invoked: true,
        });
        onCaptureFrameRef.current?.(playFrame, snapshot);
      } else if (wasAwake && !awake) {
        recordAquarelleRenderSplitEvent('layer-capture', {
          trigger: 'settle',
          playFrame,
          hasPaint: false,
          invoked: false,
        });
      }
      // PLAY FIDELITY: the sheet slept — the stroke's real diffusion window
      // is now known; record it as its cuisson for the replay.
      if (wasAwake && !awake) stampPendingSettle();
      wasAwake = awake;
      if (!disabledRef.current) {
        applyLiveConfig(engine, getLightRef.current, getPaperSeedRef.current);
        engine.setPigment(pigmentFromHex(colorRef.current));
        applyPaper();
      }
      // URL / cache-eye changes: compare-then-write, so an unchanged frame
      // costs one string and one signal read per tick.
      syncUnderlay();
      // EMPTY SHEET GATE: hide the opaque white sheet until it holds paint.
      // Read AFTER the frame-change clear above so a new sheet starts hidden
      // in the same tick (opacity keeps the canvas interactive). A blank key
      // shows its cached image through the underlay.
      const painted = engine.hasPaint;
      if (aquarelleLivePaint.value !== painted) aquarelleLivePaint.value = painted;
      // The live canvas carries the committed sheet itself once the underlay
      // is applied OR the sheet was restored from this session's capture —
      // the cached base must not stack under it (double count).
      const baseCompositedLive = painted && (underlayApplied || aquarelleSheetSeeded.value);
      if (aquarelleBaseCompositedLive.value !== baseCompositedLive) {
        aquarelleBaseCompositedLive.value = baseCompositedLive;
      }
      // WATER GATE (261029-lel): publish the standing-water truth from the ONE
      // place that holds the live engine. The `!painting` guard is the "never
      // flip mid-stroke" law — a stroke in flight is never sampled, and the
      // stroke end publishes on the very next frame (the tick always re-schedules).
      if (!painting) setAquarelleHasWetPaint(engine.hasStandingWater);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    cleanupRef.current = () => {
      // Unregister the flush seam: the engine is about to die, and a stale
      // closure accessing it would fail the save/close flush.
      onFlushCaptureReadyRef.current?.(null);
      penBridgeDisposed = true;
      disposePenBridge?.();
      // SAVE PATH (261026-nvq): drop the snapshot seam too — a later Save must
      // never call a closure holding the destroyed engine.
      onSnapshotReadyRef.current?.(null);
      // SHEET ADOPTION: the seam closes over the engine — drop it before the
      // engine dies so a late re-render can never restore into a dead sheet.
      onAdoptSheetReadyRef.current?.(null);
      window.removeEventListener('pointerdown', reopenSettleOnPaint, true);
      resizeObserver.disconnect();
      dprQuery?.removeEventListener('change', onDprChange);
      offDry();
      offDryCapture();
      for (const timer of pendingSettleTimers) window.clearTimeout(timer);
      pendingSettleTimers.clear();
      cancelAnimationFrame(raf);
      // ENGINE PORT: drop the typed surface BEFORE the engine dies so no
      // consumer can call into a destroyed instance.
      onEnginePortReadyRef.current?.(null);
      engine.destroy();
      engineRef.current = null;
      // The next mount starts on a blank sheet — never inherit painted state.
      aquarelleLivePaint.value = false;
      aquarelleBaseCompositedLive.value = false;
      aquarelleSheetSeeded.value = false;
      clearAquarelleWetPaint();
    };
  }, []);

  const style: CSSProperties = {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: props.disabled ? 'none' : 'auto',
    touchAction: 'none',
    // EMPTY SHEET GATE: nothing painted yet → let the cached base / lower
    // tracks show through (an opaque white transmittance sheet would cover
    // them under source-over). Opacity keeps the canvas as the pointer target.
    opacity: aquarelleLivePaint.value ? 1 : 0,
  };

  return (
    <div
      class="aquarelle-live-layer"
      style={{ position: 'absolute', inset: '0' }}
      onPointerEnter={(event) => {
        // 261028-k03c D6: the footprint is scaled by the DISPLAYED rect height.
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        if (rect.height > 0 && cursorLayerHeight !== rect.height) {
          cursorLayerHeight = rect.height;
          cursorStateVersion.value += 1;
        }
        // 261030-cnq: seed the pointer from the ENTER event too, so the ring /
        // picker visor appears on the first frame over the sheet instead of
        // waiting for the first pointermove.
        cursorX.value = event.clientX - rect.left;
        cursorY.value = event.clientY - rect.top;
        if (!cursorVisible.value) cursorVisible.value = true;
      }}
      onPointerMove={(event) => {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        // WR-01: compare-then-write — the version bumps ONLY when a footprint
        // input actually changed (a stationary pen tilt/pressure sample).
        let footprintInputsChanged = false;
        if (rect.height > 0 && cursorLayerHeight !== rect.height) {
          cursorLayerHeight = rect.height;
          footprintInputsChanged = true;
        }
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        // Follow-rotation needs a direction: track it from consecutive samples
        // in the DOCUMENT frame (y up), like Engine's stroke.dx/dy.
        if (lastPointerX !== null && lastPointerY !== null) {
          const dx = x - lastPointerX;
          const dy = y - lastPointerY;
          if (Math.hypot(dx, dy) >= 0.5) {
            const moveAngle = Math.atan2(-dy, dx);
            if (moveAngle !== lastPointerMoveAngle) {
              lastPointerMoveAngle = moveAngle;
              footprintInputsChanged = true;
            }
          }
        }
        lastPointerX = x;
        lastPointerY = y;
        if (event.tiltX !== lastPointerTiltX) {
          lastPointerTiltX = event.tiltX;
          footprintInputsChanged = true;
        }
        if (event.tiltY !== lastPointerTiltY) {
          lastPointerTiltY = event.tiltY;
          footprintInputsChanged = true;
        }
        if (event.pointerType !== lastPointerType) {
          lastPointerType = event.pointerType;
          footprintInputsChanged = true;
        }
        if (event.buttons !== lastPointerButtons) {
          lastPointerButtons = event.buttons;
          footprintInputsChanged = true;
        }
        if (event.pressure !== lastPointerPressure) {
          lastPointerPressure = event.pressure;
          footprintInputsChanged = true;
        }
        cursorX.value = x;
        cursorY.value = y;
        if (!cursorVisible.value) cursorVisible.value = true;
        if (footprintInputsChanged) cursorStateVersion.value += 1;
      }}
      onPointerLeave={() => {
        cursorVisible.value = false;
        lastPointerX = null;
        lastPointerY = null;
      }}
    >
      <canvas
        key={`${props.width}x${props.height}`}
        ref={attachEngine}
        class="aquarelle-live-canvas"
        width={props.width}
        height={props.height}
        style={style}
        aria-label="Water color canvas"
      />
      {/* 261022-pim: select surface ABOVE the vendor canvas (it owns the
          pointer while active, so nothing paints) and BELOW the cursor. */}
      <AquarelleStrokeOverlay
        width={props.width}
        height={props.height}
        getPlayFrame={() => getPlayFrameRef.current()}
        onDeleteStrokes={(mutationIds) => onDeleteStrokesRef.current?.(mutationIds)}
        onMoveStrokes={(mutationIds, dxPx, dyPx) => onMoveStrokesRef.current?.(mutationIds, dxPx, dyPx)}
        onTransformStrokes={(mutationIds, transform) => onTransformStrokesRef.current?.(mutationIds, transform)}
      />
      {/* 61-09 (VEC-01 / VEC-07): the vector draw surface, directly above the
          stroke overlay. It owns gesture only — the commit lands on the ONE
          stroke-end seam (handleVectorCommit), never on a record/bake call. */}
      <VectorPathOverlay
        width={props.width}
        height={props.height}
        getPlayFrame={() => getPlayFrameRef.current()}
        getRecordedStrokes={getRecordedAquarelleStrokeEntries}
        onCommitPath={handleVectorCommit}
        onCancelPath={clearVectorDraft}
        onPathEdit={(mutationId, anchors) => onEditVectorPathRef.current?.(mutationId, anchors)}
      />
      {/* 261030-cnq: the brush ring is mounted by the canvas stack — above the
          reference overlay, which used to cover it inside this group. */}
    </div>
  );
}
