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

function AquarelleBrushCursor(): JSX.Element {
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
 */
const STUDIO_PAPER_TO_PRESET: Readonly<Record<string, string>> = Object.freeze({
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

function paperPresetForStudioId(studioId: string): PaperPreset {
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
   * CACHE WRITE seam (56-12): invoked when the composited sheet must land in
   * the WebP cache — at stroke end and once Dry has settled. The snapshot
   * factory is resolved later by captureLivePixels (52.1 deferred-copy law).
   */
  onCaptureFrame?: (playFrame: number, snapshot: () => HTMLCanvasElement | null) => void;
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
  const onCaptureFrameRef = useRef(props.onCaptureFrame);
  disabledRef.current = props.disabled ?? false;
  colorRef.current = props.color ?? '#103c65';
  widthRef.current = props.width;
  heightRef.current = props.height;
  getPlayFrameRef.current = props.getPlayFrame;
  getPaperIdRef.current = props.getPaperId;
  onStrokeEndRef.current = props.onStrokeEnd;
  onCaptureFrameRef.current = props.onCaptureFrame;

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

    let engine: WatercolorEngine;
    try {
      engine = new WatercolorEngine(
        canvas,
        null,
        {
          onStrokeSample(sample) {
            const sink = (engine as unknown as { __samples?: RawSample[] }).__samples;
            if (sink) sink.push(sample);
          },
          onStrokeEnd() {
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
              // Bake window: wetter paint keeps diffusing longer (D-19, cap 600).
              diffusionFrames: Math.round(30 + 270 * (1 - (snap.params['dry'] ?? 50) / 100)),
              timestamp: Date.now(),
              // FRAME SCOPE: the stroke is anchored to the edit frame this sheet
              // previews. toStudioStroke maps this to StudioStroke.playFrame.
              playFrame: getPlayFrameRef.current(),
            };
            onStrokeEndRef.current?.(stroke);
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

    // D-15: user-initiated Dry is one event with two ends. The record end
    // (aquarelleRecordState) already appended it to the payload timeline;
    // this is the LIVE end — force-dry the wet sheet so the paint stops
    // moving right where the user pressed Dry. No second channel.
    const offDry = onAquarelleDry(() => {
      engine.fix();
    });

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
    const tick = () => {
      const playFrame = getPlayFrameRef.current();
      if (lastPlayFrameRef.current !== playFrame) {
        // CACHE WRITE: leaving a frame lands whatever the sheet holds before
        // the wipe — never a blank sheet over existing cache.
        if (engine.hasPaint) {
          onCaptureFrameRef.current?.(lastPlayFrameRef.current, snapshot);
        }
        lastPlayFrameRef.current = playFrame;
        engine.clear();
        // The new frame starts clean — a settle capture here would write the
        // empty sheet over that frame's cache.
        wasAwake = false;
      }
      // CACHE WRITE (settle): the dry (concentrated) look, not the wet stroke.
      const awake = engine.isAwake;
      if (wasAwake && !awake && engine.hasPaint) {
        onCaptureFrameRef.current?.(playFrame, snapshot);
      }
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
      <AquarelleBrushCursor />
    </div>
  );
}
