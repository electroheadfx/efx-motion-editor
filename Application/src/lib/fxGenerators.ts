import { Random } from '@efxlab/motion-canvas-core';
import type { LayerSourceData } from '../types/layer';

// Extract FX source types for function signatures
type GrainSource = Extract<LayerSourceData, { type: 'generator-grain' }>;
type ParticlesSource = Extract<LayerSourceData, { type: 'generator-particles' }>;
type LinesSource = Extract<LayerSourceData, { type: 'generator-lines' }>;
type DotsSource = Extract<LayerSourceData, { type: 'generator-dots' }>;
type VignetteSource = Extract<LayerSourceData, { type: 'generator-vignette' }>;

/**
 * Derive the effective seed for a generator effect.
 * When lockSeed is true, the seed is deterministic (same seed+frame = same pattern).
 * When unlocked, the seed varies with wall-clock time for fresh randomness each render.
 */
function effectiveSeed(lockSeed: boolean, seed: number, frame: number): number {
  return lockSeed ? seed + frame : performance.now() + frame;
}

/**
 * Draw film grain effect -- random dots of varying brightness and alpha.
 * Uses normalized coordinates scaled to canvas dimensions for resolution independence.
 */
export function drawGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: GrainSource,
  frame: number,
): void {
  const rng = new Random(effectiveSeed(params.lockSeed, params.seed, frame));
  const dotCount = Math.floor(width * height * params.density * 0.01);

  for (let i = 0; i < dotCount; i++) {
    const x = rng.nextFloat(0, width);
    const y = rng.nextFloat(0, height);
    const alpha = rng.nextFloat(0, params.intensity);
    const brightness = rng.nextInt(0, 2) === 0 ? 0 : 255;

    ctx.fillStyle = `rgba(${brightness},${brightness},${brightness},${alpha})`;
    ctx.fillRect(Math.floor(x), Math.floor(y), params.size, params.size);
  }
}

/**
 * Draw floating particles -- white circles drifting across the frame.
 * Base positions are seeded; animation offset derived from frame * speed.
 */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: ParticlesSource,
  frame: number,
): void {
  const rng = new Random(effectiveSeed(params.lockSeed, params.seed, frame));

  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = 'white';

  for (let i = 0; i < params.count; i++) {
    // Normalized base position + frame-based drift
    const baseX = rng.nextFloat(0, 1);
    const baseY = rng.nextFloat(0, 1);
    const driftX = (frame * params.speed * 0.002 * (rng.nextFloat(-1, 1))) % 1;
    const driftY = (frame * params.speed * 0.001 * (rng.nextFloat(-1, 1))) % 1;

    // Wrap coordinates to stay within canvas
    const x = ((baseX + driftX) % 1 + 1) % 1 * width;
    const y = ((baseY + driftY) % 1 + 1) % 1 * height;
    const size = rng.nextFloat(params.sizeMin, params.sizeMax);

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw random lines/strokes -- white lines with random angles and lengths.
 */
export function drawLines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: LinesSource,
  frame: number,
): void {
  const rng = new Random(effectiveSeed(params.lockSeed, params.seed, frame));
  const maxDim = Math.max(width, height);

  ctx.save();
  ctx.strokeStyle = 'white';
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = params.thickness;

  for (let i = 0; i < params.count; i++) {
    const startX = rng.nextFloat(0, width);
    const startY = rng.nextFloat(0, height);
    const angle = rng.nextFloat(0, Math.PI * 2);
    const length = rng.nextFloat(params.lengthMin * maxDim, params.lengthMax * maxDim);

    const endX = startX + Math.cos(angle) * length;
    const endY = startY + Math.sin(angle) * length;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draw animated dots -- white filled circles with random sizes and drift.
 */
export function drawDots(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: DotsSource,
  frame: number,
): void {
  const rng = new Random(effectiveSeed(params.lockSeed, params.seed, frame));

  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = 'white';

  for (let i = 0; i < params.count; i++) {
    // Normalized base position + frame-based drift
    const baseX = rng.nextFloat(0, 1);
    const baseY = rng.nextFloat(0, 1);
    const driftX = (frame * params.speed * 0.003 * rng.nextFloat(-1, 1)) % 1;
    const driftY = (frame * params.speed * 0.002 * rng.nextFloat(-1, 1)) % 1;

    // Wrap coordinates
    const x = ((baseX + driftX) % 1 + 1) % 1 * width;
    const y = ((baseY + driftY) % 1 + 1) % 1 * height;
    const size = rng.nextFloat(params.sizeMin, params.sizeMax);

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

/**
 * Draw vignette effect -- radial gradient darkening from center to edges.
 * Deterministic (no frame/seed needed).
 */
export function drawVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  params: VignetteSource,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.sqrt(cx * cx + cy * cy);
  const innerRadius = maxRadius * params.size;

  const gradient = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, maxRadius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(params.softness, `rgba(0,0,0,${params.intensity * 0.5})`);
  gradient.addColorStop(1, `rgba(0,0,0,${params.intensity})`);

  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
