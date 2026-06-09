import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { EfxPaintCanvas } from '@efxlab/efx-physic-paint/preact'
import type { EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint'
import { AnimationPlayer } from '@efxlab/efx-physic-paint/animation'
import { Toolbar, type ToolbarSettings } from './Toolbar'

const CANVAS_MOUNT_ERROR = 'Unable to mount standalone paint demo: canvas wrapper did not create a canvas'
const APPLY_EVENT = 'physic-paint:apply'
const APPLY_RESULT_EVENT = 'physic-paint:apply-result'
const DEFAULT_APPLY_FRAMES = 120
const MIN_APPLY_FRAMES = 1
const MAX_APPLY_FRAMES = 600

type BridgeMode = 'Tauri' | 'Browser fallback' | 'Unavailable'
type ApplyKind = 'apply-canvas' | 'apply-play-canvas'
type ApplyStatus = 'idle' | 'applying' | 'success' | 'error'

interface LaunchContext {
  layerId: string
  layerName?: string
  startFrame: number
  operationId: string
  width?: number
  height?: number
}

interface RenderedFramePayload {
  frameIndex: number
  appFrame: number
  dataUrl: string
  width?: number
  height?: number
}

interface PhysicPaintApplyPayload {
  operationId: string
  kind: ApplyKind
  layerId: string
  startFrame: number
  renderedFrame?: RenderedFramePayload
  frameCount?: number
  frames?: RenderedFramePayload[]
}

interface PhysicPaintApplyResult {
  operationId: string
  ok?: boolean
  success?: boolean
  kind?: ApplyKind
  frame?: number
  startFrame?: number
  count?: number
  frameCount?: number
  error?: string
  detail?: string
}

const clampNumber = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

const nonEmptyParam = (params: URLSearchParams, ...keys: string[]) => {
  for (const key of keys) {
    const value = params.get(key)
    if (value && value.trim().length > 0) return value.trim()
  }
  return null
}

const appendParams = (target: URLSearchParams, raw: string) => {
  const trimmed = raw.replace(/^[?#]/, '')
  if (!trimmed) return
  const params = new URLSearchParams(trimmed)
  params.forEach((value, key) => target.set(key, value))
}

function parseLaunchContext(location: Location): LaunchContext | null {
  const params = new URLSearchParams(location.search)
  appendParams(params, location.hash)

  const layerId = nonEmptyParam(params, 'layerId', 'layer', 'physicPaintLayerId')
  const operationId = nonEmptyParam(params, 'operationId', 'op', 'requestId')
  const startFrameRaw = nonEmptyParam(params, 'startFrame', 'frame', 'currentFrame')
  const startFrame = Number(startFrameRaw)

  if (!layerId || !operationId || !Number.isInteger(startFrame) || startFrame < 0) {
    return null
  }

  const width = Number(nonEmptyParam(params, 'width', 'w'))
  const height = Number(nonEmptyParam(params, 'height', 'h'))

  return {
    layerId,
    operationId,
    startFrame,
    layerName: nonEmptyParam(params, 'layerName', 'name') ?? undefined,
    width: Number.isFinite(width) && width > 0 ? width : undefined,
    height: Number.isFinite(height) && height > 0 ? height : undefined,
  }
}

async function detectBridgeMode(): Promise<BridgeMode> {
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>
    const eventApi = await dynamicImport<{ emit?: unknown }>('@tauri-apps/api/event')
    if (typeof eventApi.emit === 'function') return 'Tauri'
  } catch {
    // Browser/dev fallback below is expected outside Tauri.
  }

  if (typeof window !== 'undefined' && (window.opener || typeof window.dispatchEvent === 'function')) {
    return 'Browser fallback'
  }

  return 'Unavailable'
}

async function sendPhysicPaintApplyPayload(payload: PhysicPaintApplyPayload, bridgeMode: BridgeMode): Promise<void> {
  if (bridgeMode === 'Tauri') {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as <T>(specifier: string) => Promise<T>
    const eventApi = await dynamicImport<{ emit?: (event: string, payload?: unknown) => Promise<void> }>('@tauri-apps/api/event')
    if (typeof eventApi.emit !== 'function') {
      throw new Error('Tauri event emit API is unavailable')
    }
    await eventApi.emit(APPLY_EVENT, payload)
    return
  }

  if (bridgeMode === 'Browser fallback') {
    const event = new CustomEvent(APPLY_EVENT, { detail: payload })
    let delivered = false
    try {
      window.opener?.dispatchEvent(event)
      delivered = Boolean(window.opener)
    } catch {
      delivered = false
    }
    window.dispatchEvent(new CustomEvent(APPLY_EVENT, { detail: payload }))
    if (!delivered && typeof window.dispatchEvent !== 'function') {
      throw new Error('Browser fallback bridge is unavailable')
    }
    return
  }

  throw new Error('App bridge is not connected')
}

function CanvasMountProbe(props: { onEngineReady: (engine: EfxPaintEngine) => void; onCanvasMounted: (mounted: boolean) => void }) {
  const shellRef = useRef<HTMLDivElement>(null)
  const [mountError, setMountError] = useState<string | null>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const mounted = Boolean(shellRef.current?.querySelector('canvas'))
      props.onCanvasMounted(mounted)
      if (!mounted) {
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
          props.onCanvasMounted(true)
          props.onEngineReady(engine)
        }}
      />
      {mountError ? <p class="demo-error">{mountError}</p> : null}
    </div>
  )
}

export function App() {
  const [engine, setEngine] = useState<EfxPaintEngine | null>(null)
  const [canvasMounted, setCanvasMounted] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [animFrame, setAnimFrame] = useState(0)
  const [animTotal, setAnimTotal] = useState(0)
  const [launchContext] = useState<LaunchContext | null>(() => parseLaunchContext(window.location))
  const [bridgeMode, setBridgeMode] = useState<BridgeMode>('Unavailable')
  const [lastError, setLastError] = useState<string | null>(null)
  const [applyStatus, setApplyStatus] = useState<ApplyStatus>('idle')
  const [applyMessage, setApplyMessage] = useState<string | null>(null)
  const [framesToApply, setFramesToApply] = useState(DEFAULT_APPLY_FRAMES)
  const [settings, setSettings] = useState<ToolbarSettings>({
    tool: 'paint',
    color: '#103c65',
    size: 6,
    opacity: 100,
    physicsMode: 'local',
  })
  const playerRef = useRef<AnimationPlayer | null>(null)
  const activeOperationIdRef = useRef<string | null>(null)

  useEffect(() => {
    detectBridgeMode().then(setBridgeMode).catch(() => setBridgeMode('Unavailable'))
  }, [])

  useEffect(() => {
    if (!engine) return

    playerRef.current = new AnimationPlayer(engine)
    return () => {
      playerRef.current?.stop()
      playerRef.current = null
    }
  }, [engine])

  useEffect(() => {
    const handleResult = (event: Event) => {
      const detail = (event as CustomEvent<PhysicPaintApplyResult>).detail
      if (!detail || detail.operationId !== activeOperationIdRef.current) return

      const ok = detail.ok ?? detail.success ?? false
      if (!ok) {
        const message = 'Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame.'
        const diagnostic = detail.detail || detail.error
        setApplyStatus('error')
        setApplyMessage(diagnostic ? `${message} ${diagnostic}` : message)
        setLastError(diagnostic ? `${message} ${diagnostic}` : message)
        return
      }

      setApplyStatus('success')
      setLastError(null)
      if ((detail.kind ?? 'apply-canvas') === 'apply-play-canvas') {
        const count = detail.count ?? detail.frameCount ?? framesToApply
        const frame = detail.startFrame ?? launchContext?.startFrame ?? 0
        setApplyMessage(`Applied ${count} frames starting at frame ${frame}`)
      } else {
        const frame = detail.frame ?? detail.startFrame ?? launchContext?.startFrame ?? 0
        setApplyMessage(`Applied to frame ${frame}`)
      }
    }

    window.addEventListener(APPLY_RESULT_EVENT, handleResult)
    return () => window.removeEventListener(APPLY_RESULT_EVENT, handleResult)
  }, [framesToApply, launchContext?.startFrame])

  const missingConditions = useMemo(() => {
    const missing: string[] = []
    if (!engine) missing.push('Engine is still initializing')
    if (!canvasMounted) missing.push('Canvas is still mounting')
    if (!launchContext) missing.push('No app layer context received')
    if (bridgeMode === 'Unavailable') missing.push('App bridge is not connected')
    if (applyStatus === 'applying' || isPlaying) missing.push('Apply operation is still running')
    return missing
  }, [applyStatus, bridgeMode, canvasMounted, engine, isPlaying, launchContext])

  const readyToApply = missingConditions.length === 0

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

  const applyCanvas = useCallback(async () => {
    if (!engine || !launchContext || !readyToApply) return

    try {
      setApplyStatus('applying')
      setApplyMessage('Applying physics paint output...')
      setLastError(null)
      const operationId = `${launchContext.operationId}:canvas:${Date.now()}`
      activeOperationIdRef.current = operationId
      const canvas = engine.getDisplayCanvas()
      const payload: PhysicPaintApplyPayload = {
        operationId,
        kind: 'apply-canvas',
        layerId: launchContext.layerId,
        startFrame: launchContext.startFrame,
        renderedFrame: {
          frameIndex: 0,
          appFrame: launchContext.startFrame,
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
        },
      }
      await sendPhysicPaintApplyPayload(payload, bridgeMode)
      setApplyStatus('success')
      setApplyMessage(`Applied to frame ${launchContext.startFrame}`)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`
      setApplyStatus('error')
      setApplyMessage(message)
      setLastError(message)
    }
  }, [bridgeMode, engine, launchContext, readyToApply])

  const applyPlayCanvas = useCallback(async () => {
    if (!engine || !launchContext || !readyToApply || !playerRef.current) return

    const frameCount = clampNumber(framesToApply, MIN_APPLY_FRAMES, MAX_APPLY_FRAMES, DEFAULT_APPLY_FRAMES)

    try {
      setApplyStatus('applying')
      setApplyMessage('Applying physics paint output...')
      setLastError(null)
      setIsPlaying(true)
      setAnimTotal(frameCount)
      setAnimFrame(0)
      const operationId = `${launchContext.operationId}:play:${Date.now()}`
      activeOperationIdRef.current = operationId

      const frames = await new Promise<RenderedFramePayload[]>((resolve, reject) => {
        const captured: RenderedFramePayload[] = []
        const timeout = window.setTimeout(() => reject(new Error('Timed out while generating physics paint frames')), Math.max(15000, frameCount * 1000))
        playerRef.current?.play({
          frameCount,
          fps: 24,
          onFrame: (frameIndex: number, canvas: HTMLCanvasElement) => {
            setAnimFrame(frameIndex)
            const i = frameIndex
            captured.push({
              frameIndex: i,
              appFrame: launchContext.startFrame + i,
              dataUrl: canvas.toDataURL('image/png'),
              width: canvas.width,
              height: canvas.height,
            })
          },
          onComplete: () => {
            window.clearTimeout(timeout)
            setIsPlaying(false)
            resolve(captured)
          },
        })
      })

      const payload: PhysicPaintApplyPayload = {
        operationId,
        kind: 'apply-play-canvas',
        layerId: launchContext.layerId,
        startFrame: launchContext.startFrame,
        frameCount,
        frames,
      }
      await sendPhysicPaintApplyPayload(payload, bridgeMode)
      setApplyStatus('success')
      setApplyMessage(`Applied ${frames.length} frames starting at frame ${launchContext.startFrame}`)
    } catch (err) {
      setIsPlaying(false)
      const detail = err instanceof Error ? err.message : String(err)
      const message = `Could not apply physics paint output. Keep the standalone open and try again from the current layer/frame. ${detail}`
      setApplyStatus('error')
      setApplyMessage(message)
      setLastError(message)
    }
  }, [bridgeMode, engine, framesToApply, launchContext, readyToApply])

  const diagnostics = [
    ['Layer', launchContext ? `${launchContext.layerName ? `${launchContext.layerName} / ` : ''}${launchContext.layerId}` : 'No app layer context received'],
    ['Start frame', launchContext ? String(launchContext.startFrame) : 'Unavailable'],
    ['Engine ready', engine ? 'Ready' : 'Initializing'],
    ['Canvas mounted', canvasMounted ? 'Mounted' : 'Canvas is still mounting'],
    ['Active tool', settings.tool],
    ['Color', settings.color],
    ['Brush size', String(settings.size)],
    ['Opacity', `${settings.opacity}%`],
    ['Physics mode', settings.physicsMode === 'local' ? 'Local' : 'Global/manual'],
    ['Bridge transport mode', bridgeMode],
    ['Last error', lastError ?? 'None'],
  ]

  return (
    <main class="demo-shell">
      <header class="demo-header">
        <h1>@efxlab/efx-physic-paint standalone demo</h1>
        <p class="demo-status">Vite demo / public Preact API / no editor runtime</p>
      </header>
      <CanvasMountProbe onEngineReady={setEngine} onCanvasMounted={setCanvasMounted} />
      {engine && (
        <Toolbar
          engine={engine}
          onPlay={handlePlay}
          onStop={handleStop}
          isPlaying={isPlaying}
          animFrame={animFrame}
          animTotal={animTotal}
          onSettingsChange={setSettings}
          onError={(message) => setLastError(message)}
        />
      )}
      <section class={`diagnostics-panel ${readyToApply ? 'ready' : 'not-ready'}`} aria-live="polite">
        <div class="diagnostics-header">
          <span class={`ready-badge ${readyToApply ? 'ready' : 'not-ready'}`}>
            {readyToApply ? 'Ready to apply' : 'Not ready to apply'}
          </span>
          {applyStatus === 'applying' ? <span class="busy-copy">Applying physics paint output...</span> : null}
          {applyMessage ? <span class={`apply-feedback ${applyStatus}`}>{applyMessage}</span> : null}
        </div>

        {!readyToApply ? (
          <ul class="missing-list">
            {missingConditions.map((condition) => <li key={condition}>{condition}</li>)}
          </ul>
        ) : null}

        <div class="diagnostics-grid">
          {diagnostics.map(([label, value]) => (
            <div class="diagnostic-item" key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>

        <div class="apply-controls">
          <label for="frames-to-apply">Frames to apply</label>
          <input
            id="frames-to-apply"
            type="number"
            min={MIN_APPLY_FRAMES}
            max={MAX_APPLY_FRAMES}
            value={framesToApply}
            onInput={(e) => setFramesToApply(clampNumber(Number((e.target as HTMLInputElement).value), MIN_APPLY_FRAMES, MAX_APPLY_FRAMES, DEFAULT_APPLY_FRAMES))}
          />
          <button class="apply-button" disabled={!readyToApply} onClick={applyCanvas}>[apply canvas]</button>
          <button class="apply-button" disabled={!readyToApply} onClick={applyPlayCanvas}>[apply play canvas]</button>
        </div>
      </section>
    </main>
  )
}
