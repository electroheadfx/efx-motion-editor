// ============================================================
//  AnimationPlayer — Frame-based stroke replay engine
//  Separate class wrapping EfxPaintEngine (per D-07).
//  Maps stroke timestamps to frames proportionally (D-01),
//  renders point-by-point progressively (D-02), fires onFrame
//  callback per frame (D-06), plays once then stops (D-05).
// ============================================================

import type { EfxPaintEngine } from '../engine/EfxPaintEngine'
import type { AnimationConfig, AnimationState, FrameStroke } from './types'
import type { PaintStroke } from '../types'

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
  //  PRIVATE — Frame Distribution (per D-01)
  // ================================================================

  /** Map stroke timestamps to frame ranges proportionally */
  private distributeStrokes(strokes: PaintStroke[], totalFrames: number): void {
    if (strokes.length === 0) {
      this.frameStrokes = []
      return
    }

    const minTime = strokes[0].timestamp
    const maxTime = strokes[strokes.length - 1].timestamp
    const duration = maxTime - minTime || 1 // avoid division by zero for single stroke

    this.frameStrokes = strokes.map(stroke => {
      const ratio = (stroke.timestamp - minTime) / duration
      const startFrame = Math.floor(ratio * (totalFrames - 1))
      const pointCount = stroke.points.length

      // Per D-02 (point-by-point): baseline ~8 points per frame
      const framesNeeded = Math.max(1, Math.ceil(pointCount / 8))
      const endFrame = Math.min(totalFrames - 1, startFrame + framesNeeded - 1)
      const pointsPerFrame = Math.ceil(pointCount / (endFrame - startFrame + 1))

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

      // Render and fire callback
      this.renderFrame(this.currentFrame)
      this.config.onFrame?.(this.currentFrame, this.engine.getDisplayCanvas())

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

    for (const fs of this.frameStrokes) {
      if (fs.endFrame < frameIndex) {
        // Fully rendered — include with all points
        strokesToRender.push({ stroke: fs.stroke, pointCount: fs.stroke.points.length })
      } else if (fs.startFrame <= frameIndex && fs.endFrame >= frameIndex) {
        // Partially rendered — compute how many points to show
        const framesIntoStroke = frameIndex - fs.startFrame + 1
        const pointCount = Math.min(
          fs.stroke.points.length,
          fs.pointsPerFrame * framesIntoStroke,
        )
        strokesToRender.push({ stroke: fs.stroke, pointCount })
      }
      // Skip strokes where startFrame > frameIndex (not yet started)
    }

    // Delegate to engine for actual rendering
    this.engine.renderPartialStrokes(strokesToRender)
  }
}
