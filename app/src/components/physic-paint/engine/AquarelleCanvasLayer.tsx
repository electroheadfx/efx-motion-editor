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
//  RECORD (56-12): points are document uv (y up) on the 60 Hz
//  tick grid; params are the CANONICAL AQUA-04 globals (never the
//  mapped 0..1 bag). Live and bake both map through
//  toEngineParams() so they cannot drift (A1/A2).
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
  PAPERS,
  pigmentFromHex,
  toEngineParams,
  WatercolorEngine,
  type PaperPreset,
  type Tool,
} from '@efxlab/efx-watercolor';
import type { AquarellePoint, AquarelleStroke, AquarelleTool } from '@efxlab/efx-watercolor';
import {
  aquarelleActiveTool,
  aquarelleParams,
  aquarelleSelectedTipId,
  aquarelleToolOverrides,
  onAquarelleDry,
  snapshotAquarelleRecord,
} from '../view/aquarelleRecordState';
import { aquarelleSelectMode } from '../view/aquarelleStrokeSelection';
import { temporaryMove } from '../view/physicsPaintTemporaryErase';
import { AquarelleStrokeOverlay } from './AquarelleStrokeOverlay';

/** Host tick grid (toStudioStroke law: pts[].tick = sample index). */
const HOST_TICK_HZ = 60;
const HOST_TICK_MS = 1000 / HOST_TICK_HZ;

/** Engine.ts FIX_DURATION (1.2s) — Dry bakes the wet pigment over this window. */
const FIX_SETTLE_MS = 1200;

// ============================================================
//  Brush-size preview cursor (UI checklist row 1). Same dual-ring
//  family as engine-1's drawBrushCursor: dark under-stroke +
//  white over-stroke, crosshair fallback under 8px. The ring
//  follows the top-bar Brush size (aquarelleParams.size). DOM
//  refs only — no state, no effect (efx-preact-reactivity).
// ============================================================

const CURSOR_CROSSHAIR_SIZE = 23;
const cursorX = signal(-1);
const cursorY = signal(-1);
const cursorVisible = signal(false);

function AquarelleBrushCursor(): JSX.Element | null {
  // 261022-pim: select mode (rail toggle) or a held Cmd hides the paint-size
  // ring — the stroke overlay owns the pointer in both. Narrow leaf read.
  if (aquarelleSelectMode.value || temporaryMove.value) return null;
  const x = cursorX.value;
  const y = cursorY.value;
  const visible = cursorVisible.value;
  if (!visible || x < 0) return null;

  const brushSize = aquarelleParams.value.size;
  const showCircle = brushSize >= 8;
  const size = showCircle ? brushSize : CURSOR_CROSSHAIR_SIZE;
  const r = size / 2 - 1.5;

  return (
    <div
      class="aquarelle-brush-cursor"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${x - size / 2}px`,
        top: `${y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      {showCircle ? (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible', display: 'block' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#111111" strokeWidth={3} vectorEffect="non-scaling-stroke" />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ffffff" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
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
      )}
    </div>
  );
}

type RawSample = { x: number; y: number; p: number; tx: number; ty: number; t: number };

/**
 * Resample a pointer path onto the 60 Hz tick grid so recorded
 * sample spacing matches the bake's stepTick spacing (A1).
 */
function resampleToTickGrid(samples: readonly RawSample[]): AquarellePoint[] {
  if (samples.length === 0) return [];
  if (samples.length === 1) {
    const s = samples[0]!;
    return [{ x: s.x, y: s.y, p: s.p, tx: s.tx, ty: s.ty, tw: 0 }];
  }
  const start = samples[0]!.t;
  const end = samples[samples.length - 1]!.t;
  const totalTicks = Math.max(1, Math.round((end - start) / HOST_TICK_MS));
  const out: AquarellePoint[] = [];
  let cursor = 0;
  for (let i = 0; i <= totalTicks; i += 1) {
    const target = start + i * HOST_TICK_MS;
    while (cursor < samples.length - 2 && samples[cursor + 1]!.t < target) cursor += 1;
    const a = samples[cursor]!;
    const b = samples[Math.min(cursor + 1, samples.length - 1)]!;
    const span = b.t - a.t;
    const u = span > 0 ? Math.max(0, Math.min(1, (target - a.t) / span)) : 0;
    out.push({
      x: a.x + (b.x - a.x) * u,
      y: a.y + (b.y - a.y) * u,
      p: a.p + (b.p - a.p) * u,
      tx: a.tx + (b.tx - a.tx) * u,
      ty: a.ty + (b.ty - a.ty) * u,
      tw: 0,
    });
  }
  return out;
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

function applyLiveConfig(engine: WatercolorEngine): void {
  engine.setParams(toEngineParams(aquarelleParams.value));
  engine.setTool(aquarelleActiveTool.value as Tool);
  engine.setBrush(
    buildBrushForStroke(brushIdForSelection(), aquarelleToolOverrides.value),
  );
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
  disabled?: boolean;
  onStrokeEnd?: (stroke: AquarelleStroke) => void;
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
  onCaptureFrame?: (playFrame: number, snapshot: () => HTMLCanvasElement | null) => void;
  /**
   * NAV FLUSH (paint-cache-empty-frame-on-key): registers a synchronous
   * flush-capture the Studio navigation calls BEFORE flushLivePixels. The rAF
   * poll's frame-leave capture runs one rAF AFTER scheduleRotoStartFramePropagation,
   * which is AFTER the navigation flush has drained — the late capture then sits
   * in CAPTURE_PRODUCE_QUIET_MS and the return-to-key read shows the pre-capture
   * cache (the intermittent empty frame). Mirrors onNativePenInputReady.
   */
  onFlushCaptureReady?: (flushCapture: (() => void) | null) => void;
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
   */
  onResetSheetReady?: (resetSheet: () => void) => void;
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
}) {
  const engineRef = useRef<WatercolorEngine | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const disabledRef = useRef(props.disabled ?? false);
  const colorRef = useRef(props.color ?? '#103c65');
  const widthRef = useRef(props.width);
  const heightRef = useRef(props.height);
  const getPlayFrameRef = useRef(props.getPlayFrame);
  const getPaperIdRef = useRef(props.getPaperId);
  const onStrokeEndRef = useRef(props.onStrokeEnd);
  const onStrokeSettledRef = useRef(props.onStrokeSettled);
  const onCaptureFrameRef = useRef(props.onCaptureFrame);
  const onFlushCaptureReadyRef = useRef(props.onFlushCaptureReady);
  const onSheetSessionEndRef = useRef(props.onSheetSessionEnd);
  const onResetSheetReadyRef = useRef(props.onResetSheetReady);
  const onDeleteStrokesRef = useRef(props.onDeleteStrokes);
  const onMoveStrokesRef = useRef(props.onMoveStrokes);
  disabledRef.current = props.disabled ?? false;
  colorRef.current = props.color ?? '#103c65';
  widthRef.current = props.width;
  heightRef.current = props.height;
  getPlayFrameRef.current = props.getPlayFrame;
  getPaperIdRef.current = props.getPaperId;
  onStrokeEndRef.current = props.onStrokeEnd;
  onStrokeSettledRef.current = props.onStrokeSettled;
  onCaptureFrameRef.current = props.onCaptureFrame;
  onFlushCaptureReadyRef.current = props.onFlushCaptureReady;
  onSheetSessionEndRef.current = props.onSheetSessionEnd;
  onResetSheetReadyRef.current = props.onResetSheetReady;
  onDeleteStrokesRef.current = props.onDeleteStrokes;
  onMoveStrokesRef.current = props.onMoveStrokes;

  // FRAME SCOPE: the sheet previews ONE edit frame. Changing frames must never
  // leak the previous frame's paint (the user saw the same paint on every
  // Studio frame). The cache owns the other frames. Detected in the rAF signal
  // poll below — never a useEffect (efx-preact-reactivity).
  const lastPlayFrameRef = useRef(props.getPlayFrame());

  // Engine mount/unmount rides a Preact callback ref (efx-preact-reactivity:
  // no useEffect). A key change on width/height remounts the canvas element,
  // which re-runs this ref with null then the new node.
  const attachEngine = useCallback((canvas: HTMLCanvasElement | null) => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    engineRef.current = null;
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
          onStrokeEnd() {
            painting = false;
            lastWetAt = performance.now();
            settleCapArmed = false;
            const carrier = engine as unknown as { __samples?: RawSample[] };
            const raw = carrier.__samples ?? [];
            carrier.__samples = [];
            const points = resampleToTickGrid(raw);
            if (points.length === 0) return;
            const snap = snapshotAquarelleRecord();
            const stroke: AquarelleStroke = {
              tool: toolForSelection(),
              color: colorRef.current,
              // CANONICAL AQUA-04 globals — never the mapped bag.
              params: { ...snap.params },
              brushId: snap.brushId || brushIdForSelection(),
              points,
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

    // COMPOSITOR LAYER: exact-fit pointer mapping (no fit margin) + pigment
    // display on transparent (the document fond is the compositor's — v1.0).
    engine.setCompositorLayer(true);

    applyLiveConfig(engine);
    engine.setPigment(pigmentFromHex(colorRef.current));
    // F3: deposit grain follows the Studio paper (R2.3) — never the vendor default.
    let lastPaperId = '';
    const applyPaper = () => {
      const paperId = getPaperIdRef.current();
      if (paperId === lastPaperId) return;
      lastPaperId = paperId;
      engine.setPaper(paperPresetForStudioId(paperId));
    };
    applyPaper();

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
    const flushCapture = () => {
      if (!engine.hasPaint) return;
      onCaptureFrameRef.current?.(lastPlayFrameRef.current, snapshot);
    };
    onFlushCaptureReadyRef.current?.(flushCapture);

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
      engine.cancelAutoFix();
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
        if (getPlayFrameRef.current() !== dryPlayFrame) return;
        if (!engine.hasPaint) return;
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
    const resetSheet = () => {
      stampPendingSettle();
      onSheetSessionEndRef.current?.();
      engine.clear();
      painting = false;
      lastWetAt = 0;
      settleCapArmed = false;
      wasAwake = false;
    };
    onResetSheetReadyRef.current?.(resetSheet);
    const tick = () => {
      const playFrame = getPlayFrameRef.current();
      if (lastPlayFrameRef.current !== playFrame) {
        // CACHE WRITE: leaving a frame lands whatever the sheet holds before
        // the wipe — never a blank sheet over existing cache.
        if (engine.hasPaint) {
          onCaptureFrameRef.current?.(lastPlayFrameRef.current, snapshot);
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
        onCaptureFrameRef.current?.(playFrame, snapshot);
      }
      // PLAY FIDELITY: the sheet slept — the stroke's real diffusion window
      // is now known; record it as its cuisson for the replay.
      if (wasAwake && !awake) stampPendingSettle();
      wasAwake = awake;
      if (!disabledRef.current) {
        applyLiveConfig(engine);
        engine.setPigment(pigmentFromHex(colorRef.current));
        applyPaper();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    cleanupRef.current = () => {
      // Unregister the flush seam: the engine is about to die, and a stale
      // closure accessing it would fail the save/close flush.
      onFlushCaptureReadyRef.current?.(null);
      window.removeEventListener('pointerdown', reopenSettleOnPaint, true);
      offDry();
      offDryCapture();
      for (const timer of pendingSettleTimers) window.clearTimeout(timer);
      pendingSettleTimers.clear();
      cancelAnimationFrame(raf);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const style: CSSProperties = {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    pointerEvents: props.disabled ? 'none' : 'auto',
    touchAction: 'none',
  };

  return (
    <div
      class="aquarelle-live-layer"
      style={{ position: 'absolute', inset: '0' }}
      onPointerMove={(event) => {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        cursorX.value = event.clientX - rect.left;
        cursorY.value = event.clientY - rect.top;
        if (!cursorVisible.value) cursorVisible.value = true;
      }}
      onPointerLeave={() => {
        cursorVisible.value = false;
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
      />
      <AquarelleBrushCursor />
    </div>
  );
}
