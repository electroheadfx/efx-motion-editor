// ============================================================
//  EfxPaintCanvas — Preact Wrapper Component
//  Thin wrapper delegating to EfxPaintEngine via useRef+useEffect.
//  Sub-path export: @efxlab/efx-physic-paint/preact (D-06/D-09)
// ============================================================

import { useRef, useEffect } from 'preact/hooks'
import type { FunctionalComponent } from 'preact'
import { EfxPaintEngine } from './engine/EfxPaintEngine'
import type { EngineConfig, NativePenInput } from './types'
import type { CompletedPaintMutation, PaintPerformanceSample } from './engine/EfxPaintEngine'

export interface EfxPaintCanvasProps extends EngineConfig {
  width?: number
  height?: number
  class?: string
  onEngineReady?: (engine: EfxPaintEngine) => void
  onNativePenInputReady?: (handler: (input: NativePenInput) => void) => void
  onCompletedMutation?: (mutation: CompletedPaintMutation) => void
  onPerformanceSample?: (sample: PaintPerformanceSample) => void
}

/**
 * EfxPaintCanvas — Preact component that creates and manages an EfxPaintEngine instance.
 *
 * Usage:
 * ```tsx
 * <EfxPaintCanvas
 *   width={1000}
 *   height={650}
 *   papers={[{ name: 'canvas1', url: '/img/paper_1.jpg' }]}
 *   onEngineReady={(engine) => { engine.setTool('paint') }}
 * />
 * ```
 */
export const EfxPaintCanvas: FunctionalComponent<EfxPaintCanvasProps> = (props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<EfxPaintEngine | null>(null)
  const completedMutationRef = useRef(props.onCompletedMutation)
  const performanceSampleRef = useRef(props.onPerformanceSample)
  completedMutationRef.current = props.onCompletedMutation
  performanceSampleRef.current = props.onPerformanceSample

  useEffect(() => {
    if (!containerRef.current) return
    const engine = new EfxPaintEngine(containerRef.current, {
      width: props.width,
      height: props.height,
      papers: props.papers,
      defaultPaper: props.defaultPaper,
      paperTextureScale: props.paperTextureScale,
      getStrokeMetadata: props.getStrokeMetadata,
    })
    engineRef.current = engine
    engine.setCompletedMutationListener((mutation) => completedMutationRef.current?.(mutation))
    engine.setPerformanceListener(performanceSampleRef.current ? (sample) => performanceSampleRef.current?.(sample) : null)
    props.onNativePenInputReady?.((input) => engine.updateNativePenInput(input))

    // Await async init (paper texture loading) before signaling ready
    engine.init().then(() => {
      props.onEngineReady?.(engine)
    })

    return () => {
      engine.setCompletedMutationListener(null)
      engine.setPerformanceListener(null)
      engine.destroy()
      engineRef.current = null
    }
  }, [])

  return (
    <div
      ref={containerRef}
      class={props.class}
      style={{ maxWidth: '100%', width: `${props.width || 1000}px`, aspectRatio: `${props.width || 1000} / ${props.height || 650}` }}
    />
  )
}
