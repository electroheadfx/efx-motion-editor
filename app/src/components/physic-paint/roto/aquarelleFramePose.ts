import { transformRecordedStrokeForHeldPose, type StudioPoint, type StudioStroke } from '@efxlab/efx-paint-host/animation';

/**
 * Rigid held pose for a flattened aquarelle sheet. The fluid sheet is
 * cumulative, so deposited pigment cannot be re-warped inside the sim; the
 * sheet's diagonal is run through the SAME shared stroke law as one synthetic
 * stroke (identical seed hashing, ±12px position, ±8px deformation and the
 * 2-frame hold), and the two posed corners define a similarity transform
 * (translation + rotation + uniform scale) applied to the whole sheet.
 *
 * Deterministic: the transform depends only on the destination frame and the
 * motion percentages.
 */
export interface AquarelleSheetMotion {
  readonly deformation: number;
  readonly position: number;
  /** 261030-ey9: integer percent 0-100; absent reads as 0. */
  readonly rotation?: number;
  /** 261030-ey9: integer percent 0-100; absent reads as 0. */
  readonly scale?: number;
}

/** 261030-ey9: every pose consumer classifies rotation-only/scale-only as motion. */
export function isSheetMotionZero(motion: Readonly<AquarelleSheetMotion>): boolean {
  return (motion.deformation ?? 0) === 0
    && (motion.position ?? 0) === 0
    && (motion.rotation ?? 0) === 0
    && (motion.scale ?? 0) === 0;
}

export interface AquarelleSheetPose {
  readonly centerX: number;
  readonly centerY: number;
  readonly rotation: number;
  readonly scale: number;
}

export function computeAquarelleSheetPose(
  width: number,
  height: number,
  destinationSourceFrame: number,
  motion: Readonly<AquarelleSheetMotion>,
): AquarelleSheetPose | null {
  if (isSheetMotionZero(motion)) return null;
  const shadow = createSheetShadowStroke(width, height);
  const posed = transformRecordedStrokeForHeldPose(shadow, {
    destinationSourceFrame,
    strokeIndex: 0,
    deformation: motion.deformation,
    position: motion.position,
    // The two-corner shadow's centroid is the canvas centre, so the rigid
    // channels pivot exactly like the sheet does.
    rotation: motion.rotation,
    scale: motion.scale,
  });
  const baseStart = shadow.pts[0]!;
  const baseEnd = shadow.pts[1]!;
  const posedStart = posed.pts[0]!;
  const posedEnd = posed.pts[1]!;
  const baseX = baseEnd.x - baseStart.x;
  const baseY = baseEnd.y - baseStart.y;
  const posedX = posedEnd.x - posedStart.x;
  const posedY = posedEnd.y - posedStart.y;
  return {
    centerX: (posedStart.x + posedEnd.x) / 2,
    centerY: (posedStart.y + posedEnd.y) / 2,
    rotation: Math.atan2(baseX * posedY - baseY * posedX, baseX * posedX + baseY * posedY),
    scale: Math.hypot(posedX, posedY) / Math.hypot(baseX, baseY),
  };
}

export function drawAquarelleSheetPose(
  frame: CanvasImageSource,
  width: number,
  height: number,
  pose: Readonly<AquarelleSheetPose>,
  background: AquarelleSheetBackground = 'transparent',
  /**
   * 261030-ey9: optional pivot override. The reveal Photo wiggle poses the
   * finished composite around the PLACED photo's own centre (size/2 +
   * transform*zoom), not the canvas centre. Absent keeps the exact
   * `translate(pose.centerX, pose.centerY)` operand every recorded-canvas pin
   * compares; a supplied pivot translates to `pivot + (pose.center − frame/2)`.
   */
  pivot?: Readonly<{ x: number; y: number }>,
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) throw new Error('Could not pose aquarelle frame: 2D context unavailable.');
  // Paint frames are opaque MODE.transparent TRANSMITTANCE (white = no
  // pigment), so the posed margins must stay white/opaque or the compositor
  // stops probing them as transmittance. Reveal coverage is pigment alpha, so
  // its margins stay transparent.
  if (background === 'white') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
  }
  // The pivot must move BOTH operands: the translate target AND the draw origin.
  // Translate alone leaves the frame drawn about its own centre, so the image
  // keeps the constant offset sR(pivot − frame centre) — the whole composite
  // would jump by the placed photo's offset. Drawing at −pivot makes the
  // mapping pivot + (pose.center − frame/2) + sR(p − pivot): identical to the
  // no-pivot path when rotation/scale are 0, and a true pivot rotation otherwise.
  let drawX = -width / 2;
  let drawY = -height / 2;
  if (pivot) {
    context.translate(pivot.x + pose.centerX - width / 2, pivot.y + pose.centerY - height / 2);
    drawX = -pivot.x;
    drawY = -pivot.y;
  } else {
    context.translate(pose.centerX, pose.centerY);
  }
  context.rotate(pose.rotation);
  context.scale(pose.scale, pose.scale);
  context.drawImage(frame, drawX, drawY, width, height);
  return output;
}

export type AquarelleSheetBackground = 'transparent' | 'white';

/**
 * Non-rigid held pose for the flattened sheet. A rigid similarity cannot bend
 * a straight stroke, so the sheet is split into horizontal bands and each
 * band's top/bottom edges take the per-point offset of a vertical shadow
 * stroke run through the SAME held-pose law. Adjacent bands share their
 * boundary offsets (piecewise-affine), so the deformation is continuous — the
 * already-drawn stroke boils instead of staying straight.
 *
 * Paint frames are opaque transmittance, so the white background plus band
 * overlaps are harmless; reveal coverage keeps the rigid pose (no seams).
 */
const DEFORM_BAND_COUNT = 16;

export function drawAquarelleSheetDeform(
  frame: CanvasImageSource,
  width: number,
  height: number,
  destinationSourceFrame: number,
  motion: Readonly<AquarelleSheetMotion>,
  background: AquarelleSheetBackground,
): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const context = output.getContext('2d');
  if (!context) throw new Error('Could not deform aquarelle frame: 2D context unavailable.');
  if (background === 'white') {
    context.fillStyle = '#fff';
    context.fillRect(0, 0, width, height);
  }
  const bandCount = DEFORM_BAND_COUNT;
  const shadow = createVerticalShadowStroke(width, height, bandCount + 1);
  const posed = transformRecordedStrokeForHeldPose(shadow, {
    destinationSourceFrame,
    strokeIndex: 0,
    deformation: motion.deformation,
    position: motion.position,
  });
  const offsets = posed.pts.map((point, index) => ({
    dx: point.x - shadow.pts[index]!.x,
    dy: point.y - shadow.pts[index]!.y,
  }));
  const bandHeight = height / bandCount;
  for (let band = 0; band < bandCount; band += 1) {
    const y0 = band * bandHeight;
    const top = offsets[band]!;
    const bottom = offsets[band + 1]!;
    const shearX = (bottom.dx - top.dx) / bandHeight;
    const scaleY = 1 + (bottom.dy - top.dy) / bandHeight;
    const translateX = top.dx - shearX * y0;
    const translateY = top.dy - (scaleY - 1) * y0;
    // 1px overlap hides the rasterization seam between bands; the paint
    // source is opaque transmittance, so the double draw is harmless.
    const sourceY = Math.max(0, y0 - 1);
    const sourceBottom = Math.min(height, y0 + bandHeight + 1);
    const sourceHeight = sourceBottom - sourceY;
    context.save();
    context.setTransform(1, 0, shearX, scaleY, translateX, translateY);
    context.drawImage(frame, 0, sourceY, width, sourceHeight, 0, sourceY, width, sourceHeight);
    context.restore();
  }
  return output;
}

/**
 * 261030-ey9: the outer RIGID pass of the two-pass design. Returns the frame
 * unchanged (identity) when rotation and scale are both zero, so the deform
 * path stays byte-identical at zero; otherwise runs the rotation/scale-only
 * sheet pose over the already-deformed frame.
 */
export function applyAquarelleSheetRigidWiggle(
  frame: CanvasImageSource,
  width: number,
  height: number,
  destinationSourceFrame: number,
  motion: Readonly<AquarelleSheetMotion>,
  background: AquarelleSheetBackground = 'transparent',
): CanvasImageSource {
  const rotation = motion.rotation ?? 0;
  const scale = motion.scale ?? 0;
  if (rotation === 0 && scale === 0) return frame;
  const pose = computeAquarelleSheetPose(width, height, destinationSourceFrame, {
    deformation: 0,
    position: 0,
    rotation,
    scale,
  });
  if (!pose) return frame;
  return drawAquarelleSheetPose(frame, width, height, pose, background);
}

/**
 * Bake seam: poses each captured progressive frame at its OUTPUT frame.
 * Two passes — the band deform boils the sheet when deformation/position are
 * set, then the outer rigid pass rotates/scales the result. The extra canvas
 * is never allocated when rotation and scale are zero.
 */
export function createAquarelleDeformPoser(
  size: Readonly<{ width: number; height: number }>,
  motion: Readonly<AquarelleSheetMotion>,
  startFrame: number,
  background: AquarelleSheetBackground,
): ((frame: CanvasImageSource, frameIndex: number) => CanvasImageSource) | undefined {
  if (isSheetMotionZero(motion)) return undefined;
  return (frame, frameIndex) => {
    const destinationSourceFrame = startFrame + frameIndex;
    const deformed = (motion.deformation === 0 && motion.position === 0)
      ? frame
      : drawAquarelleSheetDeform(frame, size.width, size.height, destinationSourceFrame, motion, background);
    return applyAquarelleSheetRigidWiggle(deformed, size.width, size.height, destinationSourceFrame, motion, background);
  };
}

function createVerticalShadowStroke(width: number, height: number, pointCount: number): StudioStroke<null> {
  const points: StudioPoint[] = [];
  for (let index = 0; index < pointCount; index += 1) {
    const t = pointCount <= 1 ? 0 : index / (pointCount - 1);
    points.push({ x: width / 2, y: t * height, p: 0, tx: 0, ty: 0, tw: 0, tick: 0 });
  }
  return {
    pts: points,
    ticks: 1,
    cuisson: 0,
    motion: null,
    brushId: '',
    toolOverrides: {},
    traceSeed: 0,
    recordedOrder: 1,
    playFrame: null,
    color: null,
    engine: null,
  };
}

function createSheetShadowStroke(width: number, height: number): StudioStroke<null> {
  const corner = (x: number, y: number): StudioPoint => ({ x, y, p: 0, tx: 0, ty: 0, tw: 0, tick: 0 });
  return {
    pts: [corner(0, 0), corner(width, height)],
    ticks: 1,
    cuisson: 0,
    motion: null,
    brushId: '',
    toolOverrides: {},
    traceSeed: 0,
    recordedOrder: 1,
    playFrame: null,
    color: null,
    engine: null,
  };
}
