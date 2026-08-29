/**
 * Phase 48-05 (D-05): the program monitor — the Studio's narrow leaf canvas
 * that presents the flattened composite (CMP-01). The Studio consumes the SAME
 * shared composition path as main preview and export (Pitfall 8 closed by
 * construction): this component's only math is "which frame do I show".
 *
 * The 38.1-D-01 live-surface pattern: props are concrete values (layerId,
 * currentFrame, isPlaying, activeTrackId, width, height); the component
 * subscribes to the store version clocks in ITS OWN effect — never the Studio
 * root render body — and draws the flattened raster into its canvas.
 *
 * Two modes, selected by the isPlaying prop:
 *   1. playback / program-monitor — draw getFlattenedFrame(layerId, frame)'s
 *      renderedFrame (the full composite INCLUDING the active track). The
 *      frame advances per playback tick through the playbackTick signal
 *      reference (38.1-D-01): currentFrame is constant during playback, so the
 *      tick's appFrame resolves the actually-playing frame.
 *   2. editing base — draw the composite of the participating set EXCLUDING
 *      the active track (getFlattenedFrameExcluding), because the live engine
 *      canvas stacked above supplies the active track's in-progress pixels and
 *      including it would double-apply semi-transparent strokes (T-48-16,
 *      D-05). A hidden or non-soloed-under-solo track never appears in either
 *      mode (the 48-01 truth table filters it before this component exists).
 *
 * The draw is idempotent: drawing the same flattened cacheKey at the same size
 * twice is a no-op (compare-then-draw guard on the derived drawn key). A
 * pending decode (getFlattenedFrame returns null this tick) keeps the last
 * drawn frame — no flicker-to-blank. The component never filters tracks itself
 * and never runs its own composition path (CMP-01 single path).
 *
 * Task 2 (D-09): a second narrow effect publishes the current frame's missing-
 * source report to the status capsule through onMissingSourcesChange — compare-
 * then-write in both directions (steady missing fires once, cleared restores
 * once), gated on !isPlaying and reading the FULL including path so active-track
 * Hold sources are still reported. The caller maps the summary to the capsule.
 *
 * 48-06 (UAT-E): only genuine dangling sources publish — an entry whose
 * missingRefs is non-empty (a loop ref that cannot resolve to real content).
 * An empty refs entry (a track with no content at this frame — normal end of
 * rail) is absence, not a missing source, and never raises the capsule.
 */
import { useEffect, useRef } from 'preact/hooks';
import type { Signal } from '@preact/signals';
import { efxPaintVersion } from '../../../stores/efxPaintStore';
import { physicPaintStore, physicPaintVersion } from '../../../stores/physicPaintStore';
import type { RotoCachedPlaybackTick } from '../hooks/useRotoCachedPlayback';
import type { RenderedFramePayload } from '../roto/rotoCanvasFrames';

/**
 * One missing-source publication summary (the Task 2 D-09 capsule seam). The
 * monitor owns the compare-then-write publication law keyed by
 * `${frame}:${missingCount}:${firstTrackId}` so a steady missing state fires
 * exactly once and a cleared state restores exactly once; the caller maps the
 * summary to the status-capsule copy (setApplyStatus('error') + the fixed
 * 'Missing source on N track(s) — first: <name or id>' message). 48-06 (UAT-E):
 * the summary only ever covers genuine dangling sources — entries whose
 * missingRefs is non-empty — never empty-coverage frames.
 */
export interface EfxPaintProgramMonitorMissingSummary {
  readonly frame: number;
  readonly missingCount: number;
  readonly firstTrackId: string;
}

export interface PhysicsPaintProgramMonitorProps {
  readonly layerId: string | null;
  readonly currentFrame: number;
  readonly isPlaying: boolean;
  readonly activeTrackId: string | null;
  readonly width: number;
  readonly height: number;
  /**
   * 38.1-D-01: the per-tick playback signal passed as a signal REFERENCE
   * (never .value-read by the Studio root). Only this leaf reads it, in its
   * own render body, to resolve the playing frame during active playback.
   */
  readonly playbackTick?: Signal<RotoCachedPlaybackTick<RenderedFramePayload> | null> | null;
  /**
   * Task 2 (D-09) capsule seam: publish/clear the current frame's missing-source
   * report. The monitor owns the compare-then-write publication state (a steady
   * missing report fires exactly once, a cleared report restores exactly once);
   * the caller maps the summary to the status capsule (error status + the fixed
   * English copy). Only genuine dangling sources (non-empty missingRefs) ever
   * publish — an empty-coverage frame is absence, not a missing source. Leave
   * undefined to disable the publication entirely.
   */
  readonly onMissingSourcesChange?: (summary: EfxPaintProgramMonitorMissingSummary | null) => void;
}

const EMPTY_EXCLUDED_TRACKS: ReadonlySet<string> = new Set();

/**
 * The compare-then-write publication sentinel for the CLEARED capsule state
 * (D-09). A missing report publishes `${frame}:${missingCount}:${firstTrackId}`;
 * an empty report publishes this sentinel. Both directions are compare-then-write
 * against the last published key so a steady missing state fires exactly once
 * and a cleared state restores exactly once (idempotent setter law). The ref
 * STARTS at the sentinel so an initially-clean frame publishes nothing.
 */
const CLEARED_PUBLICATION_KEY = '__cleared__';

export function PhysicsPaintProgramMonitor(props: PhysicsPaintProgramMonitorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Compare-then-draw guard: the derived drawn key of the raster currently on
  // the canvas. Re-running the effect on a version-clock bump with an unchanged
  // flattened cacheKey is a no-op (drawing the same key twice draws once).
  const drawnKeyRef = useRef<string | null>(null);
  // Compare-then-write guard for the D-09 capsule publication. Starts at the
  // cleared sentinel so an initially-clean frame publishes nothing; a steady
  // missing state fires exactly once, a cleared state restores exactly once.
  const publishedMissingKeyRef = useRef<string>(CLEARED_PUBLICATION_KEY);

  // 38.1-D-01: the playback frame resolves through the tick signal — read in
  // THIS leaf's render body (subscribes only this narrow canvas, never the
  // Studio), falling back to currentFrame when idle or no tick has fired yet.
  const playbackAppFrame = props.playbackTick?.value?.appFrame ?? null;
  const resolvedFrame = props.isPlaying && playbackAppFrame !== null ? playbackAppFrame : props.currentFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { layerId } = props;
    if (!layerId) return;
    const record = props.isPlaying
      ? physicPaintStore.getFlattenedFrame(layerId, resolvedFrame)
      : physicPaintStore.getFlattenedFrameExcluding(
          layerId,
          resolvedFrame,
          props.activeTrackId ? new Set([props.activeTrackId]) : EMPTY_EXCLUDED_TRACKS,
        );
    // Pending decode: the store returns null this tick. Keep the last drawn
    // frame — no flicker-to-blank; the next version-clock bump re-runs the
    // effect and draws the completed raster.
    if (!record) return;
    const drawnKey = `${record.cacheKey}@${canvas.width}x${canvas.height}`;
    if (drawnKeyRef.current === drawnKey) return;
    // The flattened dataUrl is complete when the record exists (every track
    // decode finished store-side); only the browser image decode may still be
    // pending. Mark the drawn key BEFORE the load so a stale onload can never
    // overwrite a newer frame, and a synchronous decode (test stubs / hot
    // decodes) draws in the same tick.
    drawnKeyRef.current = drawnKey;
    const image = new Image();
    image.onload = () => {
      if (drawnKeyRef.current !== drawnKey) return;
      const liveCanvas = canvasRef.current;
      if (!liveCanvas) return;
      const liveCtx = liveCanvas.getContext('2d');
      if (!liveCtx) return;
      liveCtx.clearRect(0, 0, liveCanvas.width, liveCanvas.height);
      liveCtx.drawImage(image, 0, 0, liveCanvas.width, liveCanvas.height);
    };
    image.onerror = () => {
      // A failed decode draws nothing this tick; the next clock bump retries.
      if (drawnKeyRef.current === drawnKey) drawnKeyRef.current = null;
    };
    image.src = record.renderedFrame.dataUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the store
    // version clocks are read inside the effect's dep array (narrow leaf
    // subscription, never the Studio root); resolvedFrame is the exact
    // playback/editing frame this effect draws.
  }, [props.layerId, resolvedFrame, props.isPlaying, props.activeTrackId, props.width, props.height, physicPaintVersion.value, efxPaintVersion.value]);

  // Task 2 (D-09): the missing-source capsule publication — a narrow effect
  // (this leaf, never the Studio root render body) that reads the current
  // frame's flattened result missing report. It reads the FULL including path
  // (getFlattenedFrame, NOT getFlattenedFrameExcluding) so an active-track Hold
  // source missing is still reported, and it is gated on !isPlaying — currentFrame
  // is constant during playback, so per-tick publish storms are impossible (the
  // per-tick flattened result already carries the report for the drawing path).
  // BOTH directions compare-then-write against the last published key
  // (`${frame}:${missing.length}:${firstTrackId}`, or the cleared sentinel): a
  // steady missing state fires exactly once and a cleared state restores exactly
  // once (idempotent setter law; no render-body writes). A pending decode
  // (getFlattenedFrame null) leaves the capsule unchanged — unknown, not cleared.
  useEffect(() => {
    if (props.isPlaying || !props.onMissingSourcesChange) return;
    const { layerId } = props;
    if (!layerId) return;
    const record = physicPaintStore.getFlattenedFrame(layerId, resolvedFrame);
    if (!record) return; // pending decode — keep the capsule as-is
    const missing = record.missing;
    // 48-06 (UAT-E): only GENUINE dangling sources raise the capsule — an entry
    // whose missingRefs is non-empty (a loop ref that cannot resolve to real
    // content, e.g. a severed Hold or a deleted source key). An empty refs
    // entry (a track that simply has no content at this frame — a rail ending,
    // a frame past every key) is normal absence: informational at most, never a
    // missing-source alert. The flattened record still reports BOTH kinds (the
    // raw D-09 accounting pinned store-side); this seam filters the user-facing
    // publication only.
    const dangling = missing.filter((entry) => entry.missingRefs.length > 0);
    if (dangling.length > 0) {
      const firstTrackId = dangling[0].trackId;
      const nextKey = `${resolvedFrame}:${dangling.length}:${firstTrackId}`;
      if (publishedMissingKeyRef.current === nextKey) return;
      publishedMissingKeyRef.current = nextKey;
      props.onMissingSourcesChange({
        frame: resolvedFrame,
        missingCount: dangling.length,
        firstTrackId,
      });
    } else if (publishedMissingKeyRef.current !== CLEARED_PUBLICATION_KEY) {
      publishedMissingKeyRef.current = CLEARED_PUBLICATION_KEY;
      props.onMissingSourcesChange(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the store version
    // clocks are read inside the effect's dep array (narrow leaf subscription,
    // never the Studio root); resolvedFrame is the exact editing frame whose
    // missing report this effect publishes.
  }, [props.layerId, resolvedFrame, props.isPlaying, props.onMissingSourcesChange, physicPaintVersion.value, efxPaintVersion.value]);

  return (
    <canvas
      ref={canvasRef}
      class="physics-paint-program-monitor"
      width={props.width}
      height={props.height}
      aria-hidden="true"
    />
  );
}
