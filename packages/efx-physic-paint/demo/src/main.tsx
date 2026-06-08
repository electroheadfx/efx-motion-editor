import { render } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'
import './styles.css'

const ROOT_MOUNT_ERROR = 'Unable to mount standalone paint demo: #app root not found'
const CANVAS_MOUNT_ERROR = 'Unable to mount standalone paint demo: canvas wrapper did not create a canvas'

function CanvasMountProbe() {
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
        papers={[]}
        class="demo-canvas"
        onEngineReady={(engine) => {
          engine.setTool('paint')
          setMountError(null)
        }}
      />
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  )
}

function DemoApp() {
  return (
    <main class="demo-shell">
      <header class="demo-header">
        <h1>@efxlab/efx-physic-paint standalone demo</h1>
        <p class="demo-status">Vite demo / public Preact API / no editor runtime</p>
      </header>
      <CanvasMountProbe />
    </main>
  )
}

function mountDemo() {
  const root = document.getElementById('app')

  if (!root) {
    const error = document.createElement('p')
    error.className = 'demo-error'
    error.textContent = ROOT_MOUNT_ERROR
    document.body.append(error)
    return
  }

  render(<DemoApp />, root)
}

mountDemo()
