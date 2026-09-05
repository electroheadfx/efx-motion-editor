import { useEffect, useRef } from 'preact/hooks';
import { efxPaintVersion, getDocument } from '../../../stores/efxPaintStore';
import { physicPaintStore, physicPaintVersion } from '../../../stores/physicPaintStore';
import { drawReferenceGhost } from './PhysicsPaintReferenceGhost';

/**
 * 50-04 (S3): the reference ghost monitor-paint layer — a narrow leaf canvas
 * that draws the reference ghost ON TOP of the composite (onion-ghost family,
 * D-09) and publishes the fail-closed missing-source report (D-04).
 *
 * The 38.1-D-01 live-surface pattern: props are concrete values (layerId,
 * currentFrame, isPlaying, width, height, zoom); the component subscribes to
 * the store version clocks in ITS OWN effect — never the Studio root render
 * body — and draws the ghost into its canvas.
 *
 * Two narrow effects:
 *   1. draw — clears the canvas and calls `drawReferenceGhost`, which is a
 *      no-op when the decision is draw:false (no track, hidden, playing, or
 *      missing source). The ghost is absent during playback by not drawing
 *      (D-14) — no opacity trick, no cache entry, no export residue.
 *   2. missing-source publication — compare-then-write in both directions,
 *      gated on !isPlaying, and INDEPENDENT of the visibility preference
 *      (fail-closed reporting fires even when the overlay toggle is off). A
 *      track that exists but resolves to a null verdict (D-04) publishes
 *      `true`; a resolved source or no track publishes `false`. The caller
 *      maps the boolean to the status capsule.
 */
export interface PhysicsPaintReferenceGhostLayerProps {
  readonly layerId: string | null;
  readonly currentFrame: number;
  readonly isPlaying: boolean;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
  readonly onMissingSourceChange?: (missing: boolean) => void;
}

export function PhysicsPaintReferenceGhostLayer(props: PhysicsPaintReferenceGhostLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const publishedMissingRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { layerId } = props;
    if (!layerId) return;
    const document = getDocument(layerId);
    if (!document) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawReferenceGhost(ctx, document, props.currentFrame, props.zoom, props.isPlaying);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the store version
    // clocks are read inside the effect's dep array (narrow leaf subscription,
    // never the Studio root); a source/opacity/transform/visibility change
    // re-runs the draw.
  }, [props.layerId, props.currentFrame, props.isPlaying, props.zoom, props.width, props.height, efxPaintVersion.value, physicPaintVersion.value]);

  useEffect(() => {
    if (props.isPlaying || !props.onMissingSourceChange) return;
    const { layerId } = props;
    if (!layerId) return;
    const document = getDocument(layerId);
    if (!document) return;
    const track = document.photoReference;
    const missing = track !== null && physicPaintStore.getReferenceSourceFrameVerdict(layerId, props.currentFrame) === null;
    if (publishedMissingRef.current === missing) return;
    publishedMissingRef.current = missing;
    props.onMissingSourceChange(missing);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the store version
    // clocks are read inside the effect's dep array (narrow leaf subscription);
    // a source change re-evaluates the missing verdict.
  }, [props.layerId, props.currentFrame, props.isPlaying, props.onMissingSourceChange, efxPaintVersion.value, physicPaintVersion.value]);

  return <canvas ref={canvasRef} class="physics-paint-reference-ghost" width={props.width} height={props.height} aria-hidden="true" />;
}
