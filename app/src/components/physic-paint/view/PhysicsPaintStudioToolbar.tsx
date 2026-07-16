import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import type { BgMode, EfxPaintEngine, ToolType } from '@efxlab/efx-physic-paint';

export interface PhysicsPaintStudioToolbarSettings {
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  physicsMode: 'local' | null;
}

interface PhysicsPaintStudioToolbarProps {
  engine: EfxPaintEngine;
  onPlay?: (frameCount: number, fps: number) => void;
  onStop?: () => void;
  isPlaying?: boolean;
  animFrame?: number;
  animTotal?: number;
  onSettingsChange?: (settings: PhysicsPaintStudioToolbarSettings) => void;
  onError?: (message: string | null) => void;
}

const INVALID_STATE_COPY = 'Could not load physics paint state. Choose a valid saved state JSON file.';
const SAVE_SUCCESS_COPY = 'Physics paint editable state saved.';
const SAVE_ERROR_COPY = 'Could not save physics paint state. Choose a writable JSON destination.';

const clampNumber = (value: number, min: number, max: number, fallback: number) => {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
};

function isSerializedProject(value: unknown): value is Parameters<EfxPaintEngine['load']>[0] {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as { version?: unknown }).version === 2 &&
      typeof (value as { width?: unknown }).width === 'number' &&
      typeof (value as { height?: unknown }).height === 'number' &&
      Array.isArray((value as { strokes?: unknown }).strokes) &&
      typeof (value as { settings?: unknown }).settings === 'object' &&
      (value as { settings?: unknown }).settings !== null,
  );
}

function Slider(props: {
  label: string;
  id: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  style?: Record<string, string>;
}) {
  return (
    <div class="g" style={props.style}>
      <label>
        {props.label} <span class="v">{props.value}</span>
      </label>
      <input
        type="range"
        id={props.id}
        min={props.min}
        max={props.max}
        value={props.value}
        onInput={(event) => props.onChange(Number((event.target as HTMLInputElement).value))}
      />
    </div>
  );
}

export function PhysicsPaintStudioToolbar({
  engine,
  onPlay,
  onStop,
  isPlaying,
  animFrame,
  animTotal,
  onSettingsChange,
  onError,
}: PhysicsPaintStudioToolbarProps) {
  const [tool, setToolState] = useState<ToolType>('paint');
  const [size, setSize] = useState(6);
  const [opacity, setOpacity] = useState(100);
  const [detail, setDetail] = useState(4);
  const [pickup, setPickup] = useState(0);
  const [eraseStr, setEraseStr] = useState(50);
  const [antiAlias, setAntiAlias] = useState(0);
  const [color, setColor] = useState('#103c65');
  const [bgMode, setBgModeState] = useState<BgMode>('canvas1');
  const [paperGrain, setPaperGrainState] = useState('canvas1');
  const [grainStr, setGrainStr] = useState(0.45);
  const [physActive, setPhysActive] = useState<'last' | 'all' | null>(null);
  const [physMode, setPhysModeState] = useState<'local' | null>('local');
  const [spreadStr, setSpreadStr] = useState(50);
  const [frameCount, setFrameCount] = useState(120);
  const [fps, setFps] = useState(24);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    engine.setColorHex(color);
    engine.setBrushSize(size);
    engine.setBrushOpacity(opacity);
    engine.setEdgeDetail(detail);
    engine.setPickup(pickup);
    engine.setEraseStrength(eraseStr);
    engine.setEmbossStrength(grainStr);
    engine.setPhysicsMode(physMode);
    engine.setLocalSpreadStrength(spreadStr);
  }, [engine]);

  useEffect(() => {
    onSettingsChange?.({ tool, color, size, opacity, physicsMode: physMode });
  }, [color, onSettingsChange, opacity, physMode, size, tool]);

  const selectTool = useCallback((nextTool: ToolType) => {
    setToolState(nextTool);
    engine.setTool(nextTool);
  }, [engine]);

  const onSize = useCallback((value: number) => { setSize(value); engine.setBrushSize(value); }, [engine]);
  const onOpacity = useCallback((value: number) => { setOpacity(value); engine.setBrushOpacity(value); }, [engine]);
  const onDetail = useCallback((value: number) => { setDetail(value); engine.setEdgeDetail(value); }, [engine]);
  const onAntiAlias = useCallback((value: number) => { setAntiAlias(value); engine.setAntiAlias(value); }, [engine]);
  const onPickup = useCallback((value: number) => { setPickup(value); engine.setPickup(value); }, [engine]);
  const onEraseStr = useCallback((value: number) => { setEraseStr(value); engine.setEraseStrength(value); }, [engine]);

  const onPhysMode = useCallback((mode: 'local' | null) => {
    setPhysModeState(mode);
    engine.setPhysicsMode(mode);
  }, [engine]);

  const onSpreadStr = useCallback((value: number) => {
    setSpreadStr(value);
    engine.setLocalSpreadStrength(value);
  }, [engine]);

  const onColor = useCallback((event: Event) => {
    const hex = (event.target as HTMLInputElement).value;
    setColor(hex);
    engine.setColorHex(hex);
  }, [engine]);

  const onBg = useCallback((mode: BgMode) => {
    setBgModeState(mode);
    engine.setBgMode(mode);
  }, [engine]);

  const onPaperGrain = useCallback((key: string) => {
    setPaperGrainState(key);
    engine.setPaperGrain(key);
  }, [engine]);

  const onGrainStr = useCallback((value: number) => {
    setGrainStr(value);
    engine.setEmbossStrength(value);
  }, [engine]);

  const physicsDown = useCallback((mode: 'last' | 'all') => {
    setPhysActive(mode);
    engine.startPhysics(mode);
  }, [engine]);

  const physicsUp = useCallback(() => {
    setPhysActive(null);
    engine.stopPhysics();
  }, [engine]);

  const onSave = useCallback(async () => {
    const data = engine.save();
    const serialized = JSON.stringify(data, null, 2);
    const filename = `efx-paint-state-${Date.now()}.json`;
    setSaveFeedback(null);

    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        throw new Error('Native state Save is available only through the parent-owned Physics Paint bridge.');
      }
    } catch (error) {
      console.error('Failed to save physics paint state:', error);
      setSaveFeedback({ type: 'error', message: SAVE_ERROR_COPY });
      onError?.(SAVE_ERROR_COPY);
      return;
    }

    try {
      const blob = new Blob([serialized], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setSaveFeedback({ type: 'success', message: SAVE_SUCCESS_COPY });
      onError?.(null);
    } catch (error) {
      console.error('Failed to save physics paint state:', error);
      setSaveFeedback({ type: 'error', message: SAVE_ERROR_COPY });
      onError?.(SAVE_ERROR_COPY);
    }
  }, [engine, onError]);

  const onLoad = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const onFileChange = useCallback((event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ''));
        if (!isSerializedProject(parsed)) throw new Error(INVALID_STATE_COPY);
        engine.load(parsed);
        setLoadError(null);
        onError?.(null);
      } catch (error) {
        console.error('Failed to load project:', error);
        setLoadError(INVALID_STATE_COPY);
        onError?.(INVALID_STATE_COPY);
      }
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }, [engine, onError]);

  const bgStyles: Record<string, Record<string, string>> = {
    transparent: { background: 'repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 0 0/8px 8px' },
    white: { background: '#fff' },
    canvas1: { background: 'url(/img/paper_1.jpg) center/cover' },
    canvas2: { background: 'url(/img/paper_2.jpg) center/cover' },
    canvas3: { background: 'url(/img/paper_3.jpg) center/cover' },
  };

  const paperStyles: Record<string, Record<string, string>> = {
    canvas1: { background: 'url(/img/paper_1.jpg) center/cover' },
    canvas2: { background: 'url(/img/paper_2.jpg) center/cover' },
    canvas3: { background: 'url(/img/paper_3.jpg) center/cover' },
  };

  return (
    <div class="tb">
      <div class="g">
        <label>Tools</label>
        <div class="row">
          <button class={tool === 'paint' ? 'active' : ''} onClick={() => selectTool('paint')}>Paint</button>
          <button class={tool === 'erase' ? 'active' : ''} onClick={() => selectTool('erase')}>Erase</button>
        </div>
      </div>
      <div class="sep" />

      <div class="g">
        <label>Color</label>
        <input type="color" class="ci" value={color} onInput={onColor} />
      </div>

      <Slider label="Size" id="sz" min={1} max={80} value={size} onChange={onSize} />
      <Slider label="Opacity" id="op" min={10} max={100} value={opacity} onChange={onOpacity} />
      <Slider label="Detail" id="ed" min={0} max={100} value={detail} onChange={onDetail} />

      <div class="g">
        <label>Smooth</label>
        <div class="row">
          {([
            { label: 'Off', value: 0 },
            { label: 'Soft', value: 1 },
            { label: 'Med', value: 2 },
            { label: 'High', value: 3 },
          ]).map(({ label, value }) => (
            <button class={`grain-btn${antiAlias === value ? ' active' : ''}`} onClick={() => onAntiAlias(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div class="sep" />

      {tool === 'paint' && <Slider label="Pickup" id="pu" min={0} max={100} value={pickup} onChange={onPickup} />}
      {tool === 'erase' && <Slider label="Strength" id="es" min={0} max={100} value={eraseStr} onChange={onEraseStr} />}
      <div class="sep" />

      <div class="g">
        <label>Background</label>
        <div class="row">
          {(['transparent', 'white', 'canvas1', 'canvas2', 'canvas3'] as BgMode[]).map((mode) => (
            <div class={`bgb${bgMode === mode ? ' active' : ''}`} style={bgStyles[mode]} title={mode} onClick={() => onBg(mode)} />
          ))}
        </div>
      </div>

      <div class="g">
        <label>Paper grain</label>
        <div class="row">
          {(['canvas1', 'canvas2', 'canvas3']).map((key) => (
            <div class={`pgb${paperGrain === key ? ' active' : ''}`} style={paperStyles[key]} title={key} onClick={() => onPaperGrain(key)} />
          ))}
        </div>
      </div>
      <div class="sep" />

      <div class="g">
        <label>Grain</label>
        <div class="row">
          {([
            { label: 'None', value: 0 },
            { label: 'Soft', value: 0.45 },
            { label: 'Med', value: 0.7 },
            { label: 'Hard', value: 0.95 },
          ]).map(({ label, value }) => (
            <button class={`grain-btn${grainStr === value ? ' active' : ''}`} onClick={() => onGrainStr(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div class="sep" />
      <div style={{ width: '100%', height: 0 }} />

      <div class="g">
        <label>Physics</label>
        <div class="row compact-row">
          <button class={physMode === 'local' ? 'active' : ''} onClick={() => onPhysMode('local')}>Local</button>
          <button class={physMode === null ? 'active' : ''} onClick={() => onPhysMode(null)}>Global</button>
        </div>
        <div class="row compact-row">
          <button
            class={physActive === 'last' ? 'physics-active' : 'physics-idle'}
            onMouseDown={() => physicsDown('last')}
            onMouseUp={physicsUp}
            onMouseLeave={physicsUp}
          >
            Last
          </button>
          <button
            class={physActive === 'all' ? 'physics-active' : 'physics-idle'}
            onMouseDown={() => physicsDown('all')}
            onMouseUp={physicsUp}
            onMouseLeave={physicsUp}
          >
            All
          </button>
          <button onClick={() => engine.forceDry()}>Dry</button>
        </div>
      </div>

      {physMode === 'local' && <Slider label="Spread" id="sprd" min={0} max={100} value={spreadStr} onChange={onSpreadStr} />}
      <div class="sep" />

      <div class="g">
        <label>Animation</label>
        <div class="row compact-row">
          <label>Frames</label>
          <input type="number" value={frameCount} min={10} max={600} onInput={(event) => setFrameCount(clampNumber(Number((event.target as HTMLInputElement).value), 10, 600, 120))} />
          <label>FPS</label>
          <input type="number" value={fps} min={1} max={60} onInput={(event) => setFps(clampNumber(Number((event.target as HTMLInputElement).value), 1, 60, 24))} />
        </div>
        <div class="row compact-row">
          <button onClick={isPlaying ? onStop : () => onPlay?.(clampNumber(frameCount, 10, 600, 120), clampNumber(fps, 1, 60, 24))}>
            {isPlaying ? 'Stop' : 'Play'}
          </button>
          {isPlaying && <span class="v">{(animFrame ?? 0) + 1} / {animTotal ?? 0}</span>}
        </div>
      </div>
      <div class="sep" />

      <button onClick={onSave}>Save state</button>
      <button onClick={onLoad} title="Loading a state file replaces the current canvas.">Load state</button>
      <input type="file" ref={fileRef} accept=".json" style={{ display: 'none' }} onChange={onFileChange} />
      {saveFeedback ? <div class={saveFeedback.type === 'error' ? 'toolbar-error' : 'toolbar-status'}>{saveFeedback.message}</div> : null}
      {loadError ? <div class="toolbar-error">{loadError}</div> : null}
      <div class="sep" />
      <button onClick={() => engine.undo()}>Undo</button>
      <button class="destructive" title="Clears the current canvas" onClick={() => engine.clear()}>Clear</button>
    </div>
  );
}
