// ============================================================
//  AnimationPlayer — Frame-based stroke replay engine
//  Separate class wrapping EfxPaintEngine (per D-07).
//  Allocates strokes sequentially in recorded order,
//  renders point-by-point progressively (D-02), fires onFrame
//  callback per frame (D-06), plays once then stops (D-05).
// ============================================================

import type { EfxPaintEngine } from '../engine/EfxPaintEngine'
import type { AnimationConfig, AnimationState, FrameStroke } from './types'
import type { PaintStroke } from '../types'
import { transformRecordedStrokeForHeldPose } from './recordedStrokeMotion'

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

  /** Allocate strokes to contiguous frame ranges in playback order. */
  private distributeStrokes(strokes: PaintStroke[], totalFrames: number): void {
    const usableFrames = Math.max(1, Math.trunc(totalFrames))

    if (strokes.length === 0) {
      this.frameStrokes = []
      return
    }

    const scheduledStrokes = orderStrokesForPlayback(strokes, usableFrames)
    const sourceAnchors = new Map(strokes.map((stroke) => [stroke, getPlayFrameAnchor(stroke, usableFrames)]))
    if (scheduledStrokes.length > usableFrames) {
      for (const scheduledStroke of scheduledStrokes) {
        if (scheduledStroke.playFrameAnchor === null) {
          scheduledStroke.playFrameAnchor = sourceAnchors.get(scheduledStroke.stroke) ?? null
        }
      }
      this.frameStrokes = scheduledStrokes.map(({ stroke, playFrameAnchor }, index) => {
        const startFrame = playFrameAnchor ?? Math.min(usableFrames - 1, Math.floor((index * (usableFrames + 1)) / scheduledStrokes.length))
        const endFrame = playFrameAnchor === null ? startFrame : usableFrames - 1
        const pointsPerFrame = Math.max(1, Math.ceil(stroke.points.length / Math.max(1, endFrame - startFrame + 1)))
        return { stroke, startFrame, endFrame, pointsPerFrame }
      })
      return
    }

    const weights = scheduledStrokes.map(({ stroke }) => Math.max(1, stroke.points.length))
    const remainingWeights = new Array<number>(scheduledStrokes.length)
    let runningWeight = 0
    for (let index = scheduledStrokes.length - 1; index >= 0; index -= 1) {
      runningWeight += weights[index]
      remainingWeights[index] = runningWeight
    }
    let allocatedFrames = 0
    const playFrameCursors = new Map<number, number>()

    this.frameStrokes = scheduledStrokes.map(({ stroke, playFrameAnchor }, index) => {
      const remainingStrokeCount = scheduledStrokes.length - index
      const latestStartFrame = playFrameAnchor === null
        ? usableFrames - 1
        : Math.max(0, usableFrames - remainingStrokeCount)
      const requestedStartFrame = playFrameAnchor === null
        ? allocatedFrames
        : playFrameCursors.get(playFrameAnchor) ?? playFrameAnchor
      const startFrame = Math.min(
        usableFrames - 1,
        Math.min(requestedStartFrame, latestStartFrame),
      )
      const remainingFrames = Math.max(1, usableFrames - startFrame)
      const remainingFrameBudget = playFrameAnchor === null
        ? Math.max(1, usableFrames - allocatedFrames)
        : remainingFrames
      const weightedExactFrames = (weights[index] / Math.max(1, remainingWeights[index])) * remainingFrameBudget
      let frameSpan = Math.max(1, Math.floor(weightedExactFrames))

      if (index === scheduledStrokes.length - 1) {
        frameSpan = remainingFrames
      } else if (playFrameAnchor !== null) {
        const laterStrokeCount = scheduledStrokes.length - index - 1
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
    return transformRecordedStrokeForHeldPose(stroke, {
      destinationSourceFrame: frameIndex,
      strokeIndex,
      deformation: wiggle?.strokeDeformation ?? 0,
      position: wiggle?.strokePosition ?? 0,
    })
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

function orderStrokesForPlayback(strokes: PaintStroke[], usableFrames: number): Array<{ stroke: PaintStroke; playFrameAnchor: number | null }> {
  const scheduled = strokes.map((stroke, sourceIndex) => ({ stroke, sourceIndex, playFrameAnchor: getPlayFrameAnchor(stroke, usableFrames) }))
  const orderedByRecording = [...scheduled].sort(compareAnchoredPlaybackOrder)

  if (!hasSourceOrderInsertion(scheduled)) {
    return orderedByRecording.map(({ stroke, playFrameAnchor }) => ({ stroke, playFrameAnchor }))
  }

  const insertedSourceStart = getInsertedSourceStart(scheduled)
  const base = scheduled
    .filter(({ sourceIndex }) => sourceIndex < insertedSourceStart)
    .sort(compareAnchoredPlaybackOrder)
  if (base.length === 0) return orderedByRecording.map(({ stroke, playFrameAnchor }) => ({ stroke, playFrameAnchor }))

  const playbackOrder = [...base]
  const appended = scheduled
    .filter(({ sourceIndex }) => sourceIndex >= insertedSourceStart)
    .sort(comparePlayFrameInsertionOrder)
  const insertedByTarget = new Map<number, number>()

  for (const inserted of appended) {
    const targetIndex = getInsertionTargetIndex(inserted, playbackOrder, usableFrames)
    const offset = inserted.playFrameAnchor === null ? 0 : insertedByTarget.get(targetIndex) ?? 0
    playbackOrder.splice(targetIndex + offset, 0, inserted)
    if (inserted.playFrameAnchor !== null) insertedByTarget.set(targetIndex, offset + 1)
  }

  return playbackOrder.map(({ stroke }) => ({ stroke, playFrameAnchor: null }))
}

type ScheduledStroke = { stroke: PaintStroke; sourceIndex: number; playFrameAnchor: number | null }

function hasSourceOrderInsertion(scheduled: ScheduledStroke[]): boolean {
  return scheduled.some(({ sourceIndex, playFrameAnchor }) => playFrameAnchor !== null && playFrameAnchor > 0 && sourceIndex > playFrameAnchor)
}

function getInsertedSourceStart(scheduled: ScheduledStroke[]): number {
  return scheduled.find(({ sourceIndex, playFrameAnchor }) => playFrameAnchor !== null && playFrameAnchor > 0 && sourceIndex > playFrameAnchor)?.sourceIndex ?? scheduled.length
}

function compareAnchoredPlaybackOrder(a: ScheduledStroke, b: ScheduledStroke): number {
  return compareStrokeRecordingTime(a, b) || comparePlayFrameAnchor(a, b)
}

function comparePlayFrameAnchor(a: ScheduledStroke, b: ScheduledStroke): number {
  const aFrame = a.playFrameAnchor ?? Number.POSITIVE_INFINITY
  const bFrame = b.playFrameAnchor ?? Number.POSITIVE_INFINITY
  return aFrame - bFrame
}

function comparePlayFrameInsertionOrder(a: ScheduledStroke, b: ScheduledStroke): number {
  return comparePlayFrameAnchor(a, b) || compareStrokeRecordingTime(a, b)
}

function compareStrokeRecordingTime(a: ScheduledStroke, b: ScheduledStroke): number {
  const aTime = Number.isFinite(a.stroke.timestamp) ? a.stroke.timestamp : a.sourceIndex
  const bTime = Number.isFinite(b.stroke.timestamp) ? b.stroke.timestamp : b.sourceIndex
  return aTime - bTime || a.sourceIndex - b.sourceIndex
}

function getInsertionTargetIndex(inserted: ScheduledStroke, playbackOrder: ScheduledStroke[], usableFrames: number): number {
  if (inserted.playFrameAnchor !== null) return Math.min(inserted.playFrameAnchor, playbackOrder.length)

  const timestampTarget = playbackOrder.findIndex(candidate => compareStrokeRecordingTime(inserted, candidate) < 0)
  return timestampTarget === -1 ? playbackOrder.length : Math.min(timestampTarget, usableFrames)
}

function getPlayFrameAnchor(stroke: PaintStroke, usableFrames: number): number | null {
  if (!Number.isInteger(stroke.playFrame) || stroke.playFrame === undefined || stroke.playFrame < 0) return null
  return Math.min(usableFrames - 1, stroke.playFrame)
}

