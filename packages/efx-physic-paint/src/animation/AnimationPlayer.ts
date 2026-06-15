// ============================================================
//  AnimationPlayer — Frame-based stroke replay engine
//  Separate class wrapping EfxPaintEngine (per D-07).
//  Allocates strokes sequentially in recorded order,
//  renders point-by-point progressively (D-02), fires onFrame
//  callback per frame (D-06), plays once then stops (D-05).
// ============================================================

import type { EfxPaintEngine } from '../engine/EfxPaintEngine'
import type { AnimationConfig, AnimationState, FrameStroke } from './types'
import type { PaintStroke, PenPoint } from '../types'

const STOP_MOTION_HOLD_FRAMES = 2
const MOVE_AMPLITUDE_PX = 12
const DEFORM_AMPLITUDE_PX = 8

export class AnimationPlayer {
  private readonly engine: EfxPaintEngine

  private config: AnimationConfig | null = null
  private playing = false
  private currentFrame = 0
  private rafId = 0
  private lastFrameTime = 0
  private frameStrokes: FrameStroke[] = []

  constructor(engine: EfxPaintEngine) {
    this.engine = engine
  }

  // ================================================================
  //  PUBLIC API
  // ================================================================

  /** Start playback (per D-03, D-05, D-11) */
  play(config: AnimationConfig): void {
    this.config = config
    this.playing = true
    this.currentFrame = 0

    // Lock painting input during playback (per D-11)
    this.engine.setInputLocked(true)

    // Pause engine render loop compositing (AnimationPlayer controls rendering)
    this.engine.setAnimationMode(true)

    // Get strokes and precompute frame distribution
    const strokes = this.engine.getStrokes()
    this.distributeStrokes(strokes, config.frameCount)

    // Start rAF loop
    this.lastFrameTime = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  /** Stop playback and show final painting (per D-04) */
  stop(): void {
    this.playing = false
    cancelAnimationFrame(this.rafId)

    // Render complete painting (per D-04: stop shows final result)
    this.engine.renderAllStrokes()

    // Resume engine render loop
    this.engine.setAnimationMode(false)

    // Unlock painting input
    this.engine.setInputLocked(false)
  }

  /** Check if animation is currently playing */
  isPlaying(): boolean {
    return this.playing
  }

  /** Get current animation state (for UI consumption) */
  getState(): AnimationState {
    return {
      playing: this.playing,
      currentFrame: this.currentFrame,
      totalFrames: this.config?.frameCount ?? 0,
    }
  }

  // ================================================================
  //  PRIVATE — Frame Distribution
  // ================================================================

  /** Allocate strokes to contiguous frame ranges in recorded order. */
  private distributeStrokes(strokes: PaintStroke[], totalFrames: number): void {
    const usableFrames = Math.max(1, Math.trunc(totalFrames))

    if (strokes.length === 0) {
      this.frameStrokes = []
      return
    }

    if (strokes.length > usableFrames) {
      // More strokes than frames means some strokes must share frames; spread
      // those shared frames across the whole range instead of the final frame.
      // Explicit Play-frame annotations are user edits and must win over the
      // automatic recorded-order distribution, otherwise strokes painted while
      // inspecting a Play frame appear at the end of dense scripts.
      this.frameStrokes = strokes.map((stroke, index) => {
        const playFrameAnchor = getPlayFrameAnchor(stroke, usableFrames)
        const frame = playFrameAnchor ?? Math.max(0, Math.min(
          usableFrames - 1,
          Math.ceil(((index + 1) * usableFrames) / strokes.length) - 1,
        ))

        return {
          stroke,
          startFrame: frame,
          endFrame: frame,
          pointsPerFrame: Math.max(1, stroke.points.length),
        }
      })
      return
    }

    const weights = strokes.map(stroke => Math.max(1, stroke.points.length))
    const remainingWeights = new Array<number>(strokes.length)
    let runningWeight = 0
    for (let index = strokes.length - 1; index >= 0; index -= 1) {
      runningWeight += weights[index]
      remainingWeights[index] = runningWeight
    }
    let allocatedFrames = 0
    const playFrameCursors = new Map<number, number>()

    this.frameStrokes = strokes.map((stroke, index) => {
      const playFrameAnchor = getPlayFrameAnchor(stroke, usableFrames)
      const remainingStrokeCount = strokes.length - index
      const latestStartFrame = playFrameAnchor === null
        ? Math.max(allocatedFrames, usableFrames - remainingStrokeCount)
        : Math.max(0, usableFrames - remainingStrokeCount)
      const requestedStartFrame = playFrameAnchor === null
        ? allocatedFrames
        : playFrameCursors.get(playFrameAnchor) ?? playFrameAnchor
      const startFrame = Math.min(
        usableFrames - 1,
        Math.min(requestedStartFrame, latestStartFrame),
      )
      const remainingFrames = Math.max(1, usableFrames - startFrame)
      const weightedExactFrames = (weights[index] / Math.max(1, remainingWeights[index])) * remainingFrames
      let frameSpan = Math.max(1, Math.floor(weightedExactFrames))

      if (index === strokes.length - 1) {
        frameSpan = remainingFrames
      } else {
        // Reserve at least one frame for each later stroke when the duration allows it.
        const laterStrokeCount = strokes.length - index - 1
        const maxSpanBeforeLaterStrokes = Math.max(1, remainingFrames - laterStrokeCount)
        frameSpan = Math.min(frameSpan, maxSpanBeforeLaterStrokes)
      }

      const endFrame = Math.min(usableFrames - 1, startFrame + frameSpan - 1)
      allocatedFrames = Math.max(allocatedFrames, endFrame + 1)
      if (playFrameAnchor !== null) playFrameCursors.set(playFrameAnchor, endFrame + 1)
      const pointCount = stroke.points.length
      const pointsPerFrame = Math.max(1, Math.ceil(pointCount / Math.max(1, endFrame - startFrame + 1)))

      return { stroke, startFrame, endFrame, pointsPerFrame }
    })
  }

  // ================================================================
  //  PRIVATE — Frame Scheduling (rAF with fps accumulator)
  // ================================================================

  /** rAF tick — arrow function for correct `this` binding */
  private tick = (timestamp: number): void => {
    if (!this.playing || !this.config) return

    if (this.lastFrameTime === 0) {
      this.lastFrameTime = timestamp
    }

    const frameDuration = 1000 / this.config.fps

    if (timestamp - this.lastFrameTime >= frameDuration) {
      // Drift correction
      this.lastFrameTime = timestamp - ((timestamp - this.lastFrameTime) % frameDuration)

      // Render and fire callback with the full visible output (dry + wet overlay)
      this.renderFrame(this.currentFrame)
      this.config.onFrame?.(this.currentFrame, this.engine.exportCompositeCanvas())

      this.currentFrame++

      // Per D-05: play once, stop at last frame
      if (this.currentFrame >= this.config.frameCount) {
        this.playing = false

        // Ensure final frame shows complete painting
        this.engine.renderAllStrokes()
        this.engine.setAnimationMode(false)
        this.engine.setInputLocked(false)

        this.config.onComplete?.()
        return
      }
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  // ================================================================
  //  PRIVATE — Frame Rendering (per D-02)
  // ================================================================

  /** Render all strokes up to and including those active at frameIndex */
  private renderFrame(frameIndex: number): void {
    // Build the strokes-to-render list with point count limits
    const strokesToRender: Array<{ stroke: PaintStroke; pointCount: number }> = []

    for (let strokeIndex = 0; strokeIndex < this.frameStrokes.length; strokeIndex += 1) {
      const fs = this.frameStrokes[strokeIndex]
      if (fs.endFrame < frameIndex) {
        // Fully rendered — include with all points
        strokesToRender.push({ stroke: this.prepareRenderStroke(fs.stroke, frameIndex, strokeIndex), pointCount: fs.stroke.points.length })
      } else if (fs.startFrame <= frameIndex && fs.endFrame >= frameIndex) {
        // Partially rendered — compute how many points to show
        const framesIntoStroke = frameIndex - fs.startFrame + 1
        const pointCount = Math.min(
          fs.stroke.points.length,
          fs.pointsPerFrame * framesIntoStroke,
        )
        strokesToRender.push({ stroke: this.prepareRenderStroke(fs.stroke, frameIndex, strokeIndex), pointCount })
      }
      // Skip strokes where startFrame > frameIndex (not yet started)
    }

    // Delegate to engine for actual rendering
    this.engine.renderPartialStrokes(strokesToRender)
  }

  private prepareRenderStroke(stroke: PaintStroke, frameIndex: number, strokeIndex: number): PaintStroke {
    return this.applyStrokeStyleOverride(this.applyWiggle(stroke, frameIndex, strokeIndex))
  }

  private applyWiggle(stroke: PaintStroke, frameIndex: number, strokeIndex: number): PaintStroke {
    const wiggle = this.config?.wiggle
    const deformation = clampPercent(wiggle?.strokeDeformation) / 100
    const position = clampPercent(wiggle?.strokePosition) / 100

    if (deformation === 0 && position === 0) return stroke

    const seed = hashStroke(stroke, strokeIndex)
    const poseFrame = quantizeStopMotionFrame(frameIndex)
    const positionAmplitude = position * MOVE_AMPLITUDE_PX
    const deformationAmplitude = deformation * DEFORM_AMPLITUDE_PX
    const offsetX = positionAmplitude === 0 ? 0 : poseNoise(seed, poseFrame, 0) * positionAmplitude
    const offsetY = positionAmplitude === 0 ? 0 : poseNoise(seed, poseFrame, 1) * positionAmplitude

    return {
      ...stroke,
      points: stroke.points.map((point, pointIndex) => applyStopMotionPose(point, pointIndex, seed, poseFrame, offsetX, offsetY, deformationAmplitude)),
    }
  }

  private applyStrokeStyleOverride(stroke: PaintStroke): PaintStroke {
    const override = this.config?.strokeStyleOverride
    if (!override) return stroke

    return {
      ...stroke,
      tool: override.tool,
      color: override.color,
      params: {
        ...stroke.params,
        ...override.params,
      },
      physicsMode: override.physicsMode ?? null,
    }
  }
}

function clampPercent(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, value))
}

function hashStroke(stroke: PaintStroke, strokeIndex: number): number {
  const source = `${strokeIndex}:${stroke.timestamp}:${stroke.color ?? ''}:${stroke.points.length}`
  let hash = 2166136261
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function getPlayFrameAnchor(stroke: PaintStroke, usableFrames: number): number | null {
  if (!Number.isInteger(stroke.playFrame) || stroke.playFrame === undefined || stroke.playFrame < 0) return null
  return Math.min(usableFrames - 1, stroke.playFrame)
}

function quantizeStopMotionFrame(frameIndex: number): number {
  return Math.floor(Math.max(0, frameIndex) / STOP_MOTION_HOLD_FRAMES)
}

function applyStopMotionPose(
  point: PenPoint,
  pointIndex: number,
  seed: number,
  poseFrame: number,
  offsetX: number,
  offsetY: number,
  deformationAmplitude: number,
): PenPoint {
  if (deformationAmplitude === 0) {
    return { ...point, x: point.x + offsetX, y: point.y + offsetY }
  }

  const deformationX = poseNoise(seed, poseFrame, 11 + pointIndex * 2) * deformationAmplitude
  const deformationY = poseNoise(seed, poseFrame, 12 + pointIndex * 2) * deformationAmplitude
  return {
    ...point,
    x: point.x + offsetX + deformationX,
    y: point.y + offsetY + deformationY,
  }
}

function poseNoise(seed: number, poseFrame: number, channel: number): number {
  let hash = seed ^ Math.imul(poseFrame + 1, 374761393) ^ Math.imul(channel + 1, 668265263)
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177)
  hash ^= hash >>> 16
  return ((hash >>> 0) / 0xffffffff) * 2 - 1
}
