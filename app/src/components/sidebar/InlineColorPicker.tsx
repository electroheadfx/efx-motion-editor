import {useState, useEffect, useRef, useCallback} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import {X, Plus} from 'lucide-preact';
import {
  hexToRgba, rgbaToHex, rgbToHsl, hslToRgb,
  rgbToHsv, hsvToRgb, rgbToCmyk, cmykToRgb,
} from '../../lib/colorUtils';
import {loadRecentColors, saveRecentColors, loadFavoriteColors, saveFavoriteColors} from '../../lib/paintPreferences';

type ColorMode = 'Box' | 'TSL' | 'RVB' | 'CMYK';

export interface InlineColorPickerProps {
  color: string;
  opacity: number;
  onChange: (color: string, opacity: number) => void;
  onClose: () => void;
}

export function InlineColorPicker({color, opacity, onChange, onClose}: InlineColorPickerProps) {
  const rgba = hexToRgba(color);
  const initHsv = rgbToHsv(rgba.r, rgba.g, rgba.b);

  const [mode, setMode] = useState<ColorMode>('Box');
  const [hue, setHue] = useState(initHsv.h);
  const [sat, setSat] = useState(initHsv.s);
  const [val, setVal] = useState(initHsv.v);
  const [alpha, setAlpha] = useState(opacity);
  const [hexInput, setHexInput] = useState(color);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingCanvas = useRef(false);
  const draggingHue = useRef(false);

  // Guard to distinguish external prop changes from internal user interactions
  const isExternalUpdate = useRef(false);
  const prevColorRef = useRef(color);
  const prevOpacityRef = useRef(opacity);

  // Load swatches on mount
  useEffect(() => {
    loadRecentColors().then(setRecentColors);
    loadFavoriteColors().then(setFavoriteColors);
  }, []);

  // Sync from external color prop changes (only when prop actually changes from outside)
  useEffect(() => {
    if (prevColorRef.current === color && prevOpacityRef.current === opacity) return;
    prevColorRef.current = color;
    prevOpacityRef.current = opacity;

    isExternalUpdate.current = true;
    const r = hexToRgba(color);
    const h = rgbToHsv(r.r, r.g, r.b);
    setHue(h.h); setSat(h.s); setVal(h.v);
    setAlpha(opacity);
    setHexInput(color);
    // Reset flag after microtask (after React batches state updates)
    queueMicrotask(() => { isExternalUpdate.current = false; });
  }, [color, opacity]);

  // Derive current color
  const currentRgb = hsvToRgb(hue, sat, val);
  const currentHex = rgbaToHex(currentRgb.r, currentRgb.g, currentRgb.b);
  const currentHsl = rgbToHsl(currentRgb.r, currentRgb.g, currentRgb.b);
  const currentCmyk = rgbToCmyk(currentRgb.r, currentRgb.g, currentRgb.b);

  // Fire onChange only on USER interactions (not external prop sync)
  useEffect(() => {
    if (isExternalUpdate.current) return; // Skip if this was triggered by prop sync
    const hex = rgbaToHex(hsvToRgb(hue, sat, val).r, hsvToRgb(hue, sat, val).g, hsvToRgb(hue, sat, val).b);
    setHexInput(hex);
    onChange(hex, alpha);
  }, [hue, sat, val, alpha]);

  // Draw HSV square
  useEffect(() => {
    if (mode !== 'Box' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    // Hue background
    const hueRgb = hsvToRgb(hue, 1, 1);
    ctx.fillStyle = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
    ctx.fillRect(0, 0, w, h);

    // White gradient (left to right = saturation)
    const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(0, 0, w, h);

    // Black gradient (top to bottom = value)
    const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(0, 0, w, h);
  }, [hue, mode]);

  // Add to recent (debounced on interaction end)
  const addToRecent = useCallback((c: string) => {
    loadRecentColors().then(recents => {
      const updated = [c, ...recents.filter(r => r !== c)].slice(0, 16);
      saveRecentColors(updated);
      setRecentColors(updated);
    });
  }, []);

  // Canvas pointer handlers (HSV square)
  const handleCanvasPointer = useCallback((e: PointerEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setSat(x);
    setVal(1 - y);
  }, []);

  const handleCanvasDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingCanvas.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleCanvasPointer(e);
  }, [handleCanvasPointer]);

  const handleCanvasMove = useCallback((e: PointerEvent) => {
    if (draggingCanvas.current) handleCanvasPointer(e);
  }, [handleCanvasPointer]);

  const handleCanvasUp = useCallback(() => {
    draggingCanvas.current = false;
    addToRecent(currentHex);
  }, [addToRecent, currentHex]);

  // Hue slider handlers
  const handleHuePointer = useCallback((e: PointerEvent) => {
    if (!hueRef.current) return;
    const rect = hueRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHue(x);
  }, []);

  const handleHueDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingHue.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleHuePointer(e);
  }, [handleHuePointer]);

  const handleHueMove = useCallback((e: PointerEvent) => {
    if (draggingHue.current) handleHuePointer(e);
  }, [handleHuePointer]);

  const handleHueUp = useCallback(() => {
    draggingHue.current = false;
    addToRecent(currentHex);
  }, [addToRecent, currentHex]);

  // Hex input commit
  const commitHex = useCallback(() => {
    const cleaned = hexInput.trim();
    const match = cleaned.match(/^#?([0-9a-fA-F]{3,8})$/);
    if (match) {
      let hex = match[1];
      // Expand 3/4 digit shorthand
      if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
      else if (hex.length === 4) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]+hex[3]+hex[3];
      if (hex.length >= 6) {
        const fullHex = `#${hex.substring(0, 6)}`;
        const rgb = hexToRgba(fullHex);
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
        setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
        if (hex.length === 8) {
          setAlpha(parseInt(hex.substring(6, 8), 16) / 255);
        }
        addToRecent(fullHex);
      }
    } else {
      setHexInput(currentHex);
    }
  }, [hexInput, currentHex, addToRecent]);

  // Apply color from swatch
  const applyFromSwatch = useCallback((c: string) => {
    const rgb = hexToRgba(c);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
  }, []);

  // Add current color to favorites
  const addToFavorites = useCallback(() => {
    loadFavoriteColors().then(favs => {
      if (favs.includes(currentHex)) return;
      const updated = [...favs, currentHex];
      saveFavoriteColors(updated);
      setFavoriteColors(updated);
    });
  }, [currentHex]);

  // Remove from favorites
  const removeFromFavorites = useCallback((c: string) => {
    loadFavoriteColors().then(favs => {
      const updated = favs.filter(f => f !== c);
      saveFavoriteColors(updated);
      setFavoriteColors(updated);
    });
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const labelStyle = {
    fontSize: '9px',
    color: 'var(--sidebar-text-secondary)',
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  const sliderInputStyle = {
    fontSize: '11px',
    backgroundColor: 'var(--sidebar-input-bg)',
    color: 'var(--sidebar-text-primary)',
  };

  const modeButtonClass = (m: ColorMode) =>
    `px-2 py-1 text-[10px] rounded cursor-pointer transition-colors ${mode === m ? 'bg-(--color-accent) text-white font-medium' : 'text-(--sidebar-text-secondary) hover:text-(--sidebar-text-primary)'}`;

  // Render a labeled slider row
  const renderSlider = (label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void, unit?: string) => (
    <div class="flex items-center gap-2">
      <span class="text-[9px] w-5 shrink-0" style={{color: 'var(--sidebar-text-secondary)', fontWeight: 500}}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        class="flex-1 min-w-0 h-1 cursor-pointer"
        style={{accentColor: 'var(--color-accent)'}}
        onInput={(e) => onInput(parseFloat((e.target as HTMLInputElement).value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Math.round(value * (unit === '%' ? 1 : 1))}
        class="w-10 text-[10px] rounded px-1 py-0.5 outline-none text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        style={sliderInputStyle}
        onInput={(e) => {
          const v = parseFloat((e.target as HTMLInputElement).value);
          if (!isNaN(v)) onInput(Math.max(min, Math.min(max, v)));
        }}
        onClick={(e) => e.stopPropagation()}
      />
      {unit && <span class="text-[8px] w-3" style={{color: 'var(--sidebar-text-secondary)'}}>{unit}</span>}
    </div>
  );

  // Render swatch grid
  const renderSwatches = (colors: string[], label: string, isFavorite: boolean) => (
    <div class="flex flex-col gap-1">
      <div class="flex items-center justify-between">
        <span style={labelStyle}>{label}</span>
        {isFavorite && (
          <button
            class="w-4 h-4 flex items-center justify-center rounded hover:bg-[#ffffff15] cursor-pointer"
            onClick={addToFavorites}
            title="Add current color to favorites"
          >
            <Plus size={10} style={{color: 'var(--sidebar-text-secondary)'}} />
          </button>
        )}
      </div>
      <div class="flex flex-wrap gap-1">
        {colors.map((c, i) => (
          <button
            key={`${label}-${i}`}
            class="w-5 h-5 rounded border cursor-pointer shrink-0 hover:ring-1 hover:ring-white/30"
            style={{
              backgroundColor: c,
              borderColor: 'var(--color-border-subtle)',
            }}
            title={c}
            onClick={() => applyFromSwatch(c)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (isFavorite) removeFromFavorites(c);
            }}
          />
        ))}
        {colors.length === 0 && (
          <span class="text-[9px] italic" style={{color: 'var(--sidebar-text-secondary)'}}>
            {isFavorite ? 'Click + to add' : 'None yet'}
          </span>
        )}
      </div>
    </div>
  );

  // TSL mode handlers - convert from 0-360/0-100 display to internal HSV
  const setFromTsl = (h360: number, s100: number, l100: number) => {
    const rgb = hslToRgb(h360 / 360, s100 / 100, l100 / 100);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
  };

  // RVB mode handlers
  const setFromRvb = (r: number, g: number, b: number) => {
    const hsv = rgbToHsv(r, g, b);
    setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
  };

  // CMYK mode handlers
  const setFromCmyk = (c: number, m: number, y: number, k: number) => {
    const rgb = cmykToRgb(c / 100, m / 100, y / 100, k / 100);
    const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
    setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
  };

  return createPortal(
    <div
      class="fixed flex flex-col gap-2 rounded-xl shadow-2xl p-3 z-40"
      style={{
        width: '260px',
        left: '60px',
        top: '80px',
        backgroundColor: 'var(--sidebar-panel-bg)',
        border: '1px solid var(--sidebar-border-unselected)',
        maxHeight: 'calc(100vh - 100px)',
        overflowY: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header: Mode tabs + close */}
      <div class="flex items-center justify-between gap-1">
        <div class="flex gap-0.5">
          {(['Box', 'TSL', 'RVB', 'CMYK'] as ColorMode[]).map(m => (
            <button key={m} class={modeButtonClass(m)} onClick={() => setMode(m)}>{m}</button>
          ))}
        </div>
        <button
          class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#ffffff15] transition-colors cursor-pointer shrink-0"
          onClick={onClose}
          title="Close"
        >
          <X size={12} style={{color: 'var(--sidebar-text-secondary)'}} />
        </button>
      </div>

      {/* Mode content */}
      {mode === 'Box' && (
        <div class="flex flex-col gap-2">
          {/* HSV square */}
          <canvas
            ref={canvasRef}
            width={232}
            height={160}
            class="rounded-lg cursor-crosshair w-full"
            style={{height: '160px'}}
            onPointerDown={handleCanvasDown}
            onPointerMove={handleCanvasMove}
            onPointerUp={handleCanvasUp}
          />
          {/* Cursor indicator on top of canvas */}
          <div class="relative" style={{marginTop: '-164px', height: '160px', pointerEvents: 'none'}}>
            <div
              class="absolute w-3 h-3 rounded-full border-2 border-white shadow-md"
              style={{
                left: `${sat * 100}%`,
                top: `${(1 - val) * 100}%`,
                transform: 'translate(-50%, -50%)',
                backgroundColor: currentHex,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
              }}
            />
          </div>

          {/* Hue slider */}
          <div
            ref={hueRef}
            class="relative rounded-full cursor-pointer"
            style={{
              width: '100%',
              height: '12px',
              background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
            }}
            onPointerDown={handleHueDown}
            onPointerMove={handleHueMove}
            onPointerUp={handleHueUp}
          >
            <div
              class="absolute w-3 h-3 rounded-full border-2 border-white shadow-md pointer-events-none"
              style={{
                left: `${hue * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: `hsl(${Math.round(hue * 360)}, 100%, 50%)`,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
              }}
            />
          </div>

          {/* Alpha slider */}
          {renderSlider('A', Math.round(alpha * 100), 0, 100, 1, (v) => setAlpha(v / 100), '%')}
        </div>
      )}

      {mode === 'TSL' && (
        <div class="flex flex-col gap-1.5">
          {renderSlider('H', Math.round(currentHsl.h * 360), 0, 360, 1, (v) => setFromTsl(v, Math.round(currentHsl.s * 100), Math.round(currentHsl.l * 100)))}
          {renderSlider('S', Math.round(currentHsl.s * 100), 0, 100, 1, (v) => setFromTsl(Math.round(currentHsl.h * 360), v, Math.round(currentHsl.l * 100)), '%')}
          {renderSlider('L', Math.round(currentHsl.l * 100), 0, 100, 1, (v) => setFromTsl(Math.round(currentHsl.h * 360), Math.round(currentHsl.s * 100), v), '%')}
          {renderSlider('A', Math.round(alpha * 100), 0, 100, 1, (v) => setAlpha(v / 100), '%')}
        </div>
      )}

      {mode === 'RVB' && (
        <div class="flex flex-col gap-1.5">
          {renderSlider('R', currentRgb.r, 0, 255, 1, (v) => setFromRvb(v, currentRgb.g, currentRgb.b))}
          {renderSlider('G', currentRgb.g, 0, 255, 1, (v) => setFromRvb(currentRgb.r, v, currentRgb.b))}
          {renderSlider('B', currentRgb.b, 0, 255, 1, (v) => setFromRvb(currentRgb.r, currentRgb.g, v))}
          {renderSlider('A', Math.round(alpha * 100), 0, 100, 1, (v) => setAlpha(v / 100), '%')}
        </div>
      )}

      {mode === 'CMYK' && (
        <div class="flex flex-col gap-1.5">
          {renderSlider('C', Math.round(currentCmyk.c * 100), 0, 100, 1, (v) => setFromCmyk(v, Math.round(currentCmyk.m * 100), Math.round(currentCmyk.y * 100), Math.round(currentCmyk.k * 100)), '%')}
          {renderSlider('M', Math.round(currentCmyk.m * 100), 0, 100, 1, (v) => setFromCmyk(Math.round(currentCmyk.c * 100), v, Math.round(currentCmyk.y * 100), Math.round(currentCmyk.k * 100)), '%')}
          {renderSlider('Y', Math.round(currentCmyk.y * 100), 0, 100, 1, (v) => setFromCmyk(Math.round(currentCmyk.c * 100), Math.round(currentCmyk.m * 100), v, Math.round(currentCmyk.k * 100)), '%')}
          {renderSlider('K', Math.round(currentCmyk.k * 100), 0, 100, 1, (v) => setFromCmyk(Math.round(currentCmyk.c * 100), Math.round(currentCmyk.m * 100), Math.round(currentCmyk.y * 100), v), '%')}
          {renderSlider('A', Math.round(alpha * 100), 0, 100, 1, (v) => setAlpha(v / 100), '%')}
        </div>
      )}

      {/* HEX input (all modes) */}
      <div class="flex items-center gap-2">
        <span class="text-[9px] w-6 shrink-0" style={{color: 'var(--sidebar-text-secondary)', fontWeight: 500}}>HEX</span>
        <input
          type="text"
          value={hexInput}
          class="flex-1 rounded px-2 py-1 border-0 outline-none font-mono text-[11px]"
          style={sliderInputStyle}
          placeholder="#000000"
          onInput={(e) => setHexInput((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitHex(); }}
          onBlur={commitHex}
          onClick={(e) => e.stopPropagation()}
        />
        <div
          class="w-5 h-5 rounded border shrink-0"
          style={{backgroundColor: currentHex, borderColor: 'var(--color-border-subtle)'}}
          title="Current color"
        />
      </div>

      {/* Swatches separator */}
      <div style={{borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '2px', paddingTop: '4px'}}>
        {renderSwatches(recentColors, 'Recent', false)}
      </div>
      <div>
        {renderSwatches(favoriteColors, 'Favorites', true)}
      </div>
    </div>,
    document.body,
  );
}
