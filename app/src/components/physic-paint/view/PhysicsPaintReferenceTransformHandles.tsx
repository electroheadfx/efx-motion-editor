import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { beginInteraction, endInteraction, markInteractionActive } from '../bridge/gestureIdleScheduler';
import type { PhotoReferenceTransform } from '../../../efx-paint/document/efxPaintDocument';
import {
  efxPaintVersion,
  getDocument,
  setBackgroundTransform,
  setPhotoReferenceTransform,
} from '../../../stores/efxPaintStore';
import { physicPaintStore, physicPaintVersion } from '../../../stores/physicPaintStore';
import { computeEfxPaintBackgroundBaseDrawSize } from '../../../efx-paint/compositor/efxPaintCompositor';
import { getBackgroundBounds, getReferenceBounds } from './PhysicsPaintReferenceTransform';
import {
  getHandlePositions,
  hitTestHandles,
  getRotationZone,
  pointInPolygon,
  getCursorForHandle,
} from '../../canvas/transformHandles';
import type { HandleType, LayerBounds } from '../../canvas/transformHandles';
import {
  mergeRailMotionDraft,
  writeMotionTransformAtCursor,
  type RailMotionTransformValues,
} from '../roto/railMotionCommands';
import type { RailMotionRailView } from '../roto/railMotionIdentity';
import type { PhysicPaintRotoRailMotionRecord } from '../roto/railMotionModel';
import { railMotionValueFromUi, railMotionValueToUi } from '../roto/railMotionModel';

/**
 * 50-05 (Task 2, S4): the interactive reference transform handles on the
 * monitor surface. Reuses the main editor `TransformOverlay` PATTERN
 * (counter-scaled fixed screen-pixel handles, drag-to-move body hit, corner
 * scale handles, rotation handle) but writes to the reference DISPLAY
 * properties via `setPhotoReferenceTransform` — NOT to `layerStore` /
 * `keyframeStore` (the reference is not a layer, D-13).
 *
 * Locked by default (D-13): while `transformLocked` is true the overlay has no
 * handles and no canvas grab — painting works normally. Unlocking enters
 * reference-transform mode: drag moves the reference, corner handles scale, the
 * rotation handle rotates; the overlay's `pointerEvents: all` intercepts
 * painting gestures. The transform is applied identically in all three modes
 * (what you align is what Reveal will reveal) and NEVER affects the flattened
 * raster or export (D-13, D-06).
 *
 * The geometry reads ACCEPTED canonical state only (no optimistic changes):
 * the bounds are computed from `track.transform` (the accepted display
 * transform) and the resolved source image's natural dimensions, in WORKING
 * space (the same space the ghost draws in — see `getReferenceBounds`). The
 * image dimensions come from the shared decode-once cache
 * (`physicPaintStore.getDecodedImage`, G-52-5) and are held in a signal (no
 * useState — efx-preact-reactivity); while `transformLocked` is true (the
 * default) the effect skips the resolution entirely — the handles are
 * invisible in that state, so no decode work runs.
 *
 * 260922-rd4 (STEP B): ONE required `target` discriminator — `'photo-reference'`
 * reads/writes the photo track via `getReferenceBounds` /
 * `setPhotoReferenceTransform`; `'background'` reads/writes
 * `document.background` via `getBackgroundBounds` (contain-fit × clip-scale
 * base) / `setBackgroundTransform`. The gesture state machine, threshold,
 * apply bodies, SVG markup, and counter-scaling are UNCHANGED — only the
 * read/write endpoints are target-dispatched (one component, no fork).
 */

/**
 * 260922-rd4: the ONE handles target discriminator (no default — every mount
 * passes it). 59-13 adds `'rail-motion'` as a third, additive branch: it reads
 * the rail's evaluated transform and writes the motion collection, never a
 * document display transform.
 */
export type PhysicsPaintTransformHandleTarget = 'photo-reference' | 'background' | 'rail-motion';

/**
 * 59-13: the rail-motion payload. The Studio supplies the mounted 59-06 view
 * (railId non-null — the mount gate), the track's motion records, the app-frame
 * cursor, the evaluated DISPLAY-unit transform at that cursor, the command
 * layer's availability verdict, and the two callbacks that commit / report.
 */
export interface PhysicsPaintRailMotionGizmoProps {
  readonly records: readonly PhysicPaintRotoRailMotionRecord[];
  readonly view: RailMotionRailView;
  readonly cursorFrame: number;
  readonly evaluated: RailMotionTransformValues;
  readonly availability: { readonly enabled: boolean; readonly reason: string | null };
  /**
   * True only when the RAIL itself is selected. When the context comes from a
   * selected drawing key, the box interior stays paint-transparent (only the
   * outline and the handles are hit targets), so a key selection never blocks
   * the brush.
   */
  readonly interiorInteractive: boolean;
  readonly commit: (records: readonly PhysicPaintRotoRailMotionRecord[]) => void;
  readonly report: (reason: string) => void;
}

export interface PhysicsPaintReferenceTransformHandlesProps {
  /** Required discriminator — inline union so the reuse pin sees it literally. */
  readonly target: 'photo-reference' | 'background' | 'rail-motion';
  readonly layerId: string | null;
  readonly currentFrame: number;
  readonly isPlaying: boolean;
  readonly width: number;
  readonly height: number;
  readonly zoom: number;
  /** rail-motion only; the legacy targets ignore it. */
  readonly railMotion?: PhysicsPaintRailMotionGizmoProps | null;
}

interface DragState {
  mode: 'none' | 'pending' | 'move' | 'scale' | 'rotate';
  startClientX: number;
  startClientY: number;
  startTransform: PhotoReferenceTransform;
  handleType?: HandleType;
  startBounds?: LayerBounds;
}

const DRAG_THRESHOLD = 4; // pixels

const IDENTITY_TRANSFORM: PhotoReferenceTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };

export function PhysicsPaintReferenceTransformHandles(props: PhysicsPaintReferenceTransformHandlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageSize = useSignal<{ w: number; h: number } | null>(null);
  // 59-13: the session-only rail-motion draft. Pointer moves write HERE and
  // nowhere else; exactly one store mutation commits at pointer-up. It is a
  // signal (never useState) and it never enters the document or a store.
  const draftTransform = useSignal<RailMotionTransformValues | null>(null);
  const dragRef = useRef<DragState>({
    mode: 'none',
    startClientX: 0,
    startClientY: 0,
    startTransform: IDENTITY_TRANSFORM,
  });

  const { target, layerId, currentFrame, isPlaying, width, height, zoom } = props;
  const railMotion = target === 'rail-motion' ? props.railMotion ?? null : null;

  // 260922-rd4 (STEP B): target-dispatched setter — the ONE write endpoint the
  // gesture bodies call. Same three apply* functions, no duplicated gesture.
  // 59-13: the rail-motion branch writes the SESSION DRAFT only — no document
  // setter, no store, no revision bump until handlePointerUp commits once.
  function writeTransform(next: PhotoReferenceTransform, railValues?: RailMotionTransformValues) {
    if (target === 'rail-motion') {
      if (railValues !== undefined) {
        draftTransform.value = mergeRailMotionDraft(draftTransform.value, railValues);
      }
      return;
    }
    if (!layerId) return;
    if (target === 'background') setBackgroundTransform(layerId, next);
    else setPhotoReferenceTransform(layerId, next);
  }

  // Resolve the source image's natural dimensions (photo) or the contain-fit ×
  // clip-scale base draw size (background) through the shared decode-once cache
  // (G-52-5 — never a per-effect `new Image()` decode; the cache's onload bump
  // of physicPaintVersion re-fires this effect). Gated on !isPlaying, a present
  // layerId, AND !transformLocked — the handles are invisible while locked (the
  // default), so no decode work runs at all. A missing track / missing source /
  // pending or failed decode clears the size (fail-closed — no handles without
  // a resolved source, D-04).
  useEffect(() => {
    // 59-13: a rail motion is relative to the PROJECT canvas — the neutral draw
    // rect is the whole project frame, so the base is the working size divided
    // by the project→working zoom. No document, image decode or frame loop.
    if (target === 'rail-motion') {
      imageSize.value = {
        w: zoom > 0 ? width / zoom : width,
        h: zoom > 0 ? height / zoom : height,
      };
      return;
    }
    if (isPlaying || !layerId) {
      imageSize.value = null;
      return;
    }
    const document = getDocument(layerId);
    if (!document) {
      imageSize.value = null;
      return;
    }
    if (target === 'background') {
      if (document.background.transformLocked) {
        imageSize.value = null;
        return;
      }
      const source = physicPaintStore.getBackgroundSourceAt(layerId, currentFrame);
      if (!source) {
        imageSize.value = null;
        return;
      }
      const image = physicPaintStore.getDecodedImage(source.bytes);
      if (image === null) {
        imageSize.value = null;
        return;
      }
      // PROJECT-space base = contain-fit × clip scale — the compositor's ONE
      // formula (computeEfxPaintBackgroundBaseDrawSize). The handles props are
      // WORKING size; project size recovers via zoom = paperTextureScale.
      const projectSize = {
        width: zoom > 0 ? width / zoom : width,
        height: zoom > 0 ? height / zoom : height,
      };
      const base = computeEfxPaintBackgroundBaseDrawSize(
        image.width,
        image.height,
        projectSize,
        source.scale,
      );
      imageSize.value = { w: base.width, h: base.height };
      return;
    }
    const track = document.photoReference;
    if (!track || track.sourceFrameRefs.length === 0 || track.transformLocked) {
      imageSize.value = null;
      return;
    }
    const verdict = physicPaintStore.getReferenceSourceFrameVerdict(layerId, currentFrame);
    if (!verdict) {
      imageSize.value = null;
      return;
    }
    const image = physicPaintStore.getDecodedImage(verdict.bytes);
    imageSize.value = image === null ? null : { w: image.width, h: image.height };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the store version
    // clocks are read inside the effect's dep array (narrow leaf subscription,
    // never the Studio root); a source/transform/lock change re-resolves the
    // size, and the cache's decode-complete bump re-fires for a pending decode.
    // width/height/zoom ride along so a canvas resize re-fits the background
    // contain-fit base (photo natural dims don't depend on them, re-run is a
    // cheap cache-hit).
  }, [target, layerId, currentFrame, isPlaying, width, height, zoom, efxPaintVersion.value, physicPaintVersion.value]);

  // Read accepted display state by target (narrow reads, no render-body writes).
  // 59-13: rail motion reads NO document — its source is the evaluated motion
  // transform at the cursor, overlaid by the session draft while dragging.
  const document = target === 'rail-motion' ? null : layerId ? getDocument(layerId) : null;
  const track = target === 'rail-motion'
    ? null
    : target === 'background'
      ? document?.background ?? null
      : document?.photoReference ?? null;
  const transformLocked = target === 'rail-motion' ? false : track?.transformLocked ?? true;
  const evaluatedRailTransform: PhotoReferenceTransform = railMotion === null
    ? IDENTITY_TRANSFORM
    : {
      x: railMotion.evaluated.position?.x ?? 0,
      y: railMotion.evaluated.position?.y ?? 0,
      scaleX: railMotionValueFromUi('scale', railMotion.evaluated.scale ?? 100),
      scaleY: railMotionValueFromUi('scale', railMotion.evaluated.scale ?? 100),
      rotation: railMotion.evaluated.rotation ?? 0,
    };
  // 59-13: the session draft is a PARTIAL of display-unit channel values; the
  // geometry always needs a full transform, so absent channels fall back to the
  // evaluated transform at the cursor (the gesture's start state).
  const draftRail = draftTransform.value;
  const transform: PhotoReferenceTransform = target === 'rail-motion'
    ? (draftRail === null
      ? evaluatedRailTransform
      : {
        x: draftRail.position?.x ?? evaluatedRailTransform.x,
        y: draftRail.position?.y ?? evaluatedRailTransform.y,
        scaleX: draftRail.scale !== undefined
          ? railMotionValueFromUi('scale', draftRail.scale)
          : evaluatedRailTransform.scaleX,
        scaleY: draftRail.scale !== undefined
          ? railMotionValueFromUi('scale', draftRail.scale)
          : evaluatedRailTransform.scaleY,
        rotation: draftRail.rotation ?? evaluatedRailTransform.rotation,
      })
    : track?.transform ?? IDENTITY_TRANSFORM;

  // Locked / playing / unavailable / no resolved size / no track → no handles,
  // no grab. The rail-motion gate is the 59-13 command-layer verdict, so an
  // un-animated rail or an out-of-span playhead renders nothing to drag.
  const railMotionUnavailable = target === 'rail-motion'
    && (railMotion === null || !railMotion.availability.enabled);
  if (railMotionUnavailable || transformLocked || isPlaying || !imageSize.value || (target !== 'rail-motion' && !track)) {
    return (
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      />
    );
  }

  // Bounds endpoint is target-dispatched onto the SHARED core: photo base =
  // natural source size; background base = contain-fit × clip-scale (already
  // project-space in imageSize for the background path).
  const bounds = target === 'background'
    ? getBackgroundBounds(transform, imageSize.value.w, imageSize.value.h, zoom, width, height)
    : getReferenceBounds(transform, imageSize.value.w, imageSize.value.h, zoom, width, height);
  const handles = getHandlePositions(bounds, zoom);
  // 59-13: the rail-motion gizmo exposes move, CORNER scale and rotate only.
  // A uniform `scale` channel is the whole model, so edge (per-axis) handles
  // would have no honest target — they are not hit-tested and not rendered.
  const interactiveHandles = target === 'rail-motion'
    ? handles.filter((handle) => handle.type.startsWith('corner'))
    : handles;

  const [tl, tr, br, bl] = bounds.corners;
  const polyPoints = `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`;

  // Counter-scaled fixed screen-pixel handle geometry (TransformOverlay pattern).
  const strokeWidth = 1.5 / zoom;
  const cornerSize = 8 / zoom;
  const edgeSize = 6 / zoom;

  // 50-UAT (D-13 spec gap fix): the VISIBLE rotation handle — a stem + circle
  // above the top-edge midpoint along the box's outward normal, counter-scaled
  // to a fixed 20px stem / 5px knob on screen. The corner rotation zones stay
  // (drag near a corner also rotates); the knob makes rotation discoverable.
  const topMid = { x: (tl.x + tr.x) / 2, y: (tl.y + tr.y) / 2 };
  const normalX = topMid.x - bounds.center.x;
  const normalY = topMid.y - bounds.center.y;
  const normalLen = Math.hypot(normalX, normalY) || 1;
  const rotHandle = {
    x: topMid.x + (normalX / normalLen) * (20 / zoom),
    y: topMid.y + (normalY / normalLen) * (20 / zoom),
  };
  const rotHandleRadius = 5 / zoom;
  const rotHandleHitRadius = 8 / zoom;

  function getWorkingPointFromClient(clientX: number, clientY: number): { x: number; y: number } {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left) * (width / rect.width),
      y: (clientY - rect.top) * (height / rect.height),
    };
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    const point = getWorkingPointFromClient(e.clientX, e.clientY);

    // 50-UAT (D-13 spec): the visible rotation knob is a direct rotate target —
    // checked BEFORE the corner/edge handles and the corner rotation zone.
    const rotDx = point.x - rotHandle.x;
    const rotDy = point.y - rotHandle.y;
    if (rotDx * rotDx + rotDy * rotDy <= rotHandleHitRadius * rotHandleHitRadius) {
      e.preventDefault();
      dragRef.current = {
        mode: 'pending',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTransform: { ...transform },
        handleType: 'rotate',
        startBounds: bounds,
      };
      beginInteraction(e.pointerId);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    const handleHit = hitTestHandles(point, interactiveHandles, zoom);
    if (handleHit) {
      e.preventDefault();
      dragRef.current = {
        mode: 'pending',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTransform: { ...transform },
        handleType: handleHit,
        startBounds: bounds,
      };
      beginInteraction(e.pointerId);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (getRotationZone(point, bounds, zoom)) {
      e.preventDefault();
      dragRef.current = {
        mode: 'pending',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTransform: { ...transform },
        handleType: 'rotate',
        startBounds: bounds,
      };
      beginInteraction(e.pointerId);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if (pointInPolygon(point, bounds.corners)) {
      e.preventDefault();
      dragRef.current = {
        mode: 'pending',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startTransform: { ...transform },
        startBounds: bounds,
      };
      beginInteraction(e.pointerId);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
  }

  function handlePointerMove(e: PointerEvent) {
    const state = dragRef.current;
    if (state.mode === 'none') return;
    markInteractionActive();

    if (state.mode === 'pending') {
      const dist = Math.hypot(e.clientX - state.startClientX, e.clientY - state.startClientY);
      if (dist < DRAG_THRESHOLD) return;
      if (state.handleType === 'rotate') {
        dragRef.current = { ...state, mode: 'rotate' };
      } else if (state.handleType) {
        dragRef.current = { ...state, mode: 'scale' };
      } else {
        dragRef.current = { ...state, mode: 'move' };
      }
    }

    const current = dragRef.current;
    if (current.mode === 'move') applyMove(e, current);
    else if (current.mode === 'scale') applyScale(e, current);
    else if (current.mode === 'rotate') applyRotation(e, current);
  }

  function applyMove(e: PointerEvent, state: DragState) {
    const start = getWorkingPointFromClient(state.startClientX, state.startClientY);
    const current = getWorkingPointFromClient(e.clientX, e.clientY);
    const dx = (current.x - start.x) / zoom;
    const dy = (current.y - start.y) / zoom;
    const next = {
      ...state.startTransform,
      x: state.startTransform.x + dx,
      y: state.startTransform.y + dy,
    };
    writeTransform(next, { position: { x: next.x, y: next.y } });
  }

  function applyScale(e: PointerEvent, state: DragState) {
    if (!state.startBounds) return;
    const mouse = getWorkingPointFromClient(e.clientX, e.clientY);
    const startMouse = getWorkingPointFromClient(state.startClientX, state.startClientY);
    const center = state.startBounds.center;

    const startDist = Math.hypot(startMouse.x - center.x, startMouse.y - center.y);
    const currentDist = Math.hypot(mouse.x - center.x, mouse.y - center.y);
    if (startDist < 1) return;
    const scaleFactor = currentDist / startDist;

    const ht = state.handleType;
    if (ht?.startsWith('corner')) {
      const next = {
        ...state.startTransform,
        scaleX: state.startTransform.scaleX * scaleFactor,
        scaleY: state.startTransform.scaleY * scaleFactor,
      };
      // Corner scale is uniform; the motion model has ONE `scale` channel, so
      // the display-unit percent comes from scaleX (the two stay equal here).
      writeTransform(next, { scale: railMotionValueToUi('scale', next.scaleX) });
    } else if (ht === 'edge-left' || ht === 'edge-right') {
      const rad = (state.startTransform.rotation * Math.PI) / 180;
      const axisX = Math.cos(rad);
      const axisY = Math.sin(rad);
      const startProj = (startMouse.x - center.x) * axisX + (startMouse.y - center.y) * axisY;
      const currProj = (mouse.x - center.x) * axisX + (mouse.y - center.y) * axisY;
      if (Math.abs(startProj) < 1) return;
      const factor = currProj / startProj;
      writeTransform({
        ...state.startTransform,
        scaleX: state.startTransform.scaleX * factor,
      });
    } else if (ht === 'edge-top' || ht === 'edge-bottom') {
      const rad = (state.startTransform.rotation * Math.PI) / 180;
      const axisX = -Math.sin(rad);
      const axisY = Math.cos(rad);
      const startProj = (startMouse.x - center.x) * axisX + (startMouse.y - center.y) * axisY;
      const currProj = (mouse.x - center.x) * axisX + (mouse.y - center.y) * axisY;
      if (Math.abs(startProj) < 1) return;
      const factor = currProj / startProj;
      writeTransform({
        ...state.startTransform,
        scaleY: state.startTransform.scaleY * factor,
      });
    }
  }

  function applyRotation(e: PointerEvent, state: DragState) {
    if (!state.startBounds) return;
    const mouse = getWorkingPointFromClient(e.clientX, e.clientY);
    const startMouse = getWorkingPointFromClient(state.startClientX, state.startClientY);
    const center = state.startBounds.center;

    const currentAngle = Math.atan2(mouse.y - center.y, mouse.x - center.x);
    const startAngle = Math.atan2(startMouse.y - center.y, startMouse.x - center.x);
    const deltaAngle = ((currentAngle - startAngle) * 180) / Math.PI;

    const next = {
      ...state.startTransform,
      rotation: state.startTransform.rotation + deltaAngle,
    };
    // Degrees, exactly as sampled — no normalization, no wrap (D-13).
    writeTransform(next, { rotation: next.rotation });
  }

  function handlePointerUp(e: PointerEvent) {
    const gestureEnded = dragRef.current.mode !== 'none';
    if (gestureEnded) endInteraction(e.pointerId);
    // 59-13: the ONE rail-motion commit. The draft accumulated by the pointer
    // moves is settled through the pure command; a refusal discards it and
    // reports the reason, leaving the document byte-identical.
    if (target === 'rail-motion') {
      const draft = draftTransform.value;
      draftTransform.value = null;
      if (gestureEnded && draft !== null && railMotion !== null) {
        const result = writeMotionTransformAtCursor({
          records: railMotion.records,
          view: railMotion.view,
          cursorFrame: railMotion.cursorFrame,
          values: draft,
        });
        if (result.ok) railMotion.commit(result.records);
        else railMotion.report(result.reason);
      }
    }
    dragRef.current = {
      mode: 'none',
      startClientX: 0,
      startClientY: 0,
      startTransform: IDENTITY_TRANSFORM,
    };
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may not be active.
    }
  }

  // 59-13: a cancelled gesture never commits — the draft is discarded and the
  // interaction clock is released exactly like pointer-up.
  function handlePointerCancel(e: PointerEvent) {
    draftTransform.value = null;
    if (dragRef.current.mode !== 'none') endInteraction(e.pointerId);
    dragRef.current = {
      mode: 'none',
      startClientX: 0,
      startClientY: 0,
      startTransform: IDENTITY_TRANSFORM,
    };
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may not be active.
    }
  }

  // 50-UAT (bounds-only capture): the overlay container is pointer-events NONE
  // so painting outside the reference passes through to the engine canvas. The
  // SVG children (bounds polygon, rotation-zone circles, handle rects) are the
  // ONLY hit targets — each carries pointer-events: all and bubbles to the SVG
  // root's handlers. The handler logic (hitTestHandles → getRotationZone →
  // pointInPolygon) is unchanged; the SVG hit-testing only decides WHETHER the
  // event fires at all.
  return (
    <div
      ref={containerRef}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-label={target === 'background'
        ? 'Background transform'
        : target === 'rail-motion' ? 'Rail motion transform' : 'Reference transform'}
    >
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <polygon
          points={polyPoints}
          fill="transparent"
          stroke="#4A90D9"
          stroke-width={strokeWidth}
          vector-effect="non-scaling-stroke"
          style={{
            // A key-selected fallback keeps the interior free for painting:
            // only the outline can start a move drag.
            pointerEvents: railMotion !== null && railMotion.interiorInteractive === false
              ? 'visibleStroke'
              : 'all',
            cursor: railMotion !== null && railMotion.interiorInteractive === false
              ? 'default'
              : 'move',
          }}
        />
        {/* 50-UAT (D-13 spec): the VISIBLE rotation handle — a decorative stem
            (pointer-events none, pass-through) plus an interactive knob that
            enters rotate mode (handlePointerDown's direct rotation target). */}
        <line
          x1={topMid.x}
          y1={topMid.y}
          x2={rotHandle.x}
          y2={rotHandle.y}
          stroke="#4A90D9"
          stroke-width={strokeWidth}
          vector-effect="non-scaling-stroke"
          aria-hidden="true"
        />
        <circle
          cx={rotHandle.x}
          cy={rotHandle.y}
          r={rotHandleRadius}
          fill="white"
          stroke="#4A90D9"
          stroke-width={strokeWidth}
          vector-effect="non-scaling-stroke"
          style={{ pointerEvents: 'all', cursor: getCursorForHandle(null, true, transform.rotation) }}
        />
        {/* Rotation-zone hit circles — one per corner, radius = the 15px screen
            rotation zone (getRotationZone). Transparent fill + pointer-events
            all; the handler disambiguates rotate vs move by pointInPolygon. */}
        {bounds.corners.map((corner, index) => (
          <circle
            key={`rotation-zone-${index}`}
            cx={corner.x}
            cy={corner.y}
            r={15 / zoom}
            fill="transparent"
            style={{ pointerEvents: 'all', cursor: 'grab' }}
          />
        ))}
        {handles.filter((h) => h.type.startsWith('corner')).map((h) => (
          <rect
            key={h.type}
            x={h.x - cornerSize / 2}
            y={h.y - cornerSize / 2}
            width={cornerSize}
            height={cornerSize}
            fill="white"
            stroke="#4A90D9"
            stroke-width={strokeWidth}
            vector-effect="non-scaling-stroke"
            style={{ pointerEvents: 'all' }}
          />
        ))}
        {target === 'rail-motion' ? null : handles.filter((h) => h.type.startsWith('edge')).map((h) => (
          <rect
            key={h.type}
            x={h.x - edgeSize / 2}
            y={h.y - edgeSize / 2}
            width={edgeSize}
            height={edgeSize}
            fill="white"
            stroke="#4A90D9"
            stroke-width={strokeWidth}
            vector-effect="non-scaling-stroke"
            style={{ pointerEvents: 'all' }}
          />
        ))}
      </svg>
    </div>
  );
}
