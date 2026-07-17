// ============================================================
//  AnimationPlayer — Frame-based stroke replay engine
//  Timed playback delegates all ordering and revelation to the
//  shared progressive schedule used by offline consumers.
// ============================================================

import type { EfxPaintEngine } from '../engine/EfxPaintEngine'
import type { AnimationConfig, AnimationState, FrameStroke } from './types'
import type { PaintStroke } from '../types'
import { transformRecordedStrokeForHeldPose } from './recordedStrokeMotion'
import { buildProgressiveStrokeSchedule, getProgressiveFrameStrokes } from './progressiveStrokeSchedule'

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

  play(config: AnimationConfig): void {
    this.config = config
    this.playing = true
    this.currentFrame = 0
    this.engine.setInputLocked(true)
    this.engine.setAnimationMode(true)
    this.frameStrokes = buildProgressiveStrokeSchedule(this.engine.getStrokes(), config.frameCount)
    this.lastFrameTime = 0
    this.rafId = requestAnimationFrame(this.tick)
  }

  stop(): void {
    this.playing = false
    cancelAnimationFrame(this.rafId)
    this.engine.renderAllStrokes()
    this.engine.setAnimationMode(false)
    this.engine.setInputLocked(false)
  }

  isPlaying(): boolean {
    return this.playing
  }

  getState(): AnimationState {
    return {
      playing: this.playing,
      currentFrame: this.currentFrame,
      totalFrames: this.config?.frameCount ?? 0,
    }
  }

  private tick = (timestamp: number): void => {
    if (!this.playing || !this.config) return
    if (this.lastFrameTime === 0) this.lastFrameTime = timestamp

    const frameDuration = 1000 / this.config.fps
    if (timestamp - this.lastFrameTime >= frameDuration) {
      this.lastFrameTime = timestamp - ((timestamp - this.lastFrameTime) % frameDuration)
      this.renderFrame(this.currentFrame)
      this.config.onFrame?.(this.currentFrame, this.engine.exportCompositeCanvas())
      this.currentFrame += 1

      if (this.currentFrame >= this.config.frameCount) {
        this.playing = false
        this.engine.renderAllStrokes()
        this.engine.setAnimationMode(false)
        this.engine.setInputLocked(false)
        this.config.onComplete?.()
        return
      }
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  private renderFrame(frameIndex: number): void {
    this.engine.renderPartialStrokes(getProgressiveFrameStrokes(
      this.frameStrokes,
      frameIndex,
      (stroke, destinationFrame, strokeIndex) => this.prepareRenderStroke(stroke, destinationFrame, strokeIndex),
    ))
  }

  private prepareRenderStroke(stroke: PaintStroke, frameIndex: number, strokeIndex: number): PaintStroke {
    const wiggle = this.config?.wiggle
    return this.applyStrokeStyleOverride(transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: frameIndex,
      strokeIndex,
      deformation: wiggle?.strokeDeformation ?? 0,
      position: wiggle?.strokePosition ?? 0,
    }))
  }

  private applyStrokeStyleOverride(stroke: PaintStroke): PaintStroke {
    const override = this.config?.strokeStyleOverride
    if (!override) return stroke
    return {
      ...stroke,
      tool: override.tool,
      color: override.color,
      params: { ...stroke.params, ...override.params },
      physicsMode: override.physicsMode ?? null,
    }
  }
}
