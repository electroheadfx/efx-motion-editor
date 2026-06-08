import { useCallback, useEffect, useRef, useState } from 'preact/hooks'
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'
import type { EfxPaintEngine } from '@efxlab/efx-physic-paint'
import { AnimationPlayer } from '../../src/animation/AnimationPlayer'
import { Toolbar } from './Toolbar'

const CANVAS_MOUNT_ERROR = 'Unable to mount standalone paint demo: canvas wrapper did not create a canvas'

function CanvasMountProbe(props: { onEngineReady: (engine: EfxPaintEngine) => void }) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [mountError, setMountError] = useState<string | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (!shellRef.current?.querySelector('canvas')) {
        setMountError(CANVAS_MOUNT_ERROR)
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div class="demo-canvas-shell" ref={shellRef}>
      <EfxPaintCanvas
        width={1000}
        height={650}
        papers={[
          { name: 'canvas1', url: '/img/paper_1.jpg' },
          { name: 'canvas2', url: '/img/paper_2.jpg' },
          { name: 'canvas3', url: '/img/paper_3.jpg' },
        ]}
        defaultPaper="canvas1"
        class="paint-canvas"
        onEngineReady={(engine) => {
          engine.setTool('paint')
          setMountError(null)
          props.onEngineReady(engine)
        }}
      />
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  )
}

export function App() {
  const [engine, setEngine] = useState<EfxPaintEngine | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [animFrame, setAnimFrame] = useState(0)
  const [animTotal, setAnimTotal] = useState(0)
  const playerRef = useRef<AnimationPlayer | null>(null)

  useEffect(() => {
    if (!engine) return

    playerRef.current = new AnimationPlayer(engine)
    return () => {
      playerRef.current?.stop()
      playerRef.current = null
    }
  }, [engine])

  const handlePlay = useCallback((frameCount: number, fps: number) => {
    if (!playerRef.current) return

    setIsPlaying(true)
    setAnimTotal(frameCount)
    setAnimFrame(0)
    playerRef.current.play({
      frameCount,
      fps,
      onFrame: (frameIndex) => setAnimFrame(frameIndex),
      onComplete: () => setIsPlaying(false),
    })
  }, [])

  const handleStop = useCallback(() => {
    if (!playerRef.current) return

    playerRef.current.stop()
    setIsPlaying(false)
  }, [])

  return (
    <main class="demo-shell">
      <header class="demo-header">
        <h1>@efxlab/efx-physic-paint standalone demo</h1>
        <p class="demo-status">Vite demo / public Preact API / no editor runtime</p>
      </header>
      <CanvasMountProbe onEngineReady={setEngine} />
      {engine && (
        <Toolbar
          engine={engine}
          onPlay={handlePlay}
          onStop={handleStop}
          isPlaying={isPlaying}
          animFrame={animFrame}
          animTotal={animTotal}
        />
      )}
    </main>
  )
}
