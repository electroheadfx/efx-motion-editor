import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import {X} from 'lucide-preact';
import type {GradientData, GradientStop} from '../../types/sequence';
import {createDefaultGradient} from '../../types/sequence';
import {GradientBar, buildGradientCSS} from './GradientBar';

// === Color conversion utilities ===

export function hexToRgba(hex: string): {r: number; g: number; b: number; a: number} {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
  if (!m) return {r: 0, g: 0, b: 0, a: 1};
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
    a: m[4] !== undefined ? parseInt(m[4], 16) / 255 : 1,
  };
}

export function rgbaToHex(r: number, g: number, b: number, _a?: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToHsl(r: number, g: number, b: number): {h: number; s: number; l: number} {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return {h: 0, s: 0, l};
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return {h, s, l};
}

export function hslToRgb(h: number, s: number, l: number): {r: number; g: number; b: number} {
  if (s === 0) {
    const v = Math.round(l * 255);
    return {r: v, g: v, b: v};
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): {h: number; s: number; v: number} {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (max !== min) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return {h, s, v};
}

export function hsvToRgb(h: number, s: number, v: number): {r: number; g: number; b: number} {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return {r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255)};
}

// === ColorPickerModal component ===

type ColorMode = 'hex' | 'rgba' | 'hsl';
type FillMode = 'solid' | 'gradient';

export interface ColorPickerModalProps {
  color: string;
  onLiveChange?: (color: string) => void;
  onCommit: (color: string) => void;
  onClose: () => void;
  // Gradient mode props (all optional for backward compat)
  gradient?: GradientData;
  onGradientChange?: (gradient: GradientData) => void;
  onGradientLiveChange?: (gradient: GradientData) => void;
  showGradientMode?: boolean;  // false by default for backward compat
}

export function ColorPickerModal({
  color, onLiveChange, onCommit, onClose,
  gradient, onGradientChange, onGradientLiveChange, showGradientMode,
}: ColorPickerModalProps) {
  const rgba = hexToRgba(color);
  const hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
  const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);

  const [hue, setHue] = useState(hsv.h);
  const [sat, setSat] = useState(hsv.s);
  const [val, setVal] = useState(hsv.v);
  const [colorInputMode, setColorInputMode] = useState<ColorMode>('hex');
  const [hexInput, setHexInput] = useState(color);
  const [rInput, setRInput] = useState(String(rgba.r));
  const [gInput, setGInput] = useState(String(rgba.g));
  const [bInput, setBInput] = useState(String(rgba.b));
  const [hInput, setHInput] = useState(String(Math.round(hsl.h * 360)));
  const [sInput, setSInput] = useState(String(Math.round(hsl.s * 100)));
  const [lInput, setLInput] = useState(String(Math.round(hsl.l * 100)));

  // Gradient state
  const [fillMode, setFillMode] = useState<FillMode>(gradient ? 'gradient' : 'solid');
  const [gradientState, setGradientState] = useState<GradientData>(
    gradient ?? createDefaultGradient(),
  );
  const [selectedStopIndex, setSelectedStopIndex] = useState(0);

  const areaRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingArea = useRef(false);
  const draggingHue = useRef(false);

  // Derive current color from HSV
  const currentRgb = hsvToRgb(hue, sat, val);
  const currentHex = rgbaToHex(currentRgb.r, currentRgb.g, currentRgb.b);
  const currentHsl = rgbToHsl(currentRgb.r, currentRgb.g, currentRgb.b);

  // Sync text inputs whenever HSV changes
  useEffect(() => {
    setHexInput(currentHex);
    setRInput(String(currentRgb.r));
    setGInput(String(currentRgb.g));
    setBInput(String(currentRgb.b));
    setHInput(String(Math.round(currentHsl.h * 360)));
    setSInput(String(Math.round(currentHsl.s * 100)));
    setLInput(String(Math.round(currentHsl.l * 100)));
  }, [hue, sat, val]);

  // Live preview as user drags (solid mode only)
  useEffect(() => {
    if (fillMode === 'solid' && onLiveChange) onLiveChange(currentHex);
  }, [currentHex, fillMode]);

  // Sync HSV picker with selected gradient stop color when in gradient mode
  useEffect(() => {
    if (fillMode === 'gradient' && gradientState.stops[selectedStopIndex]) {
      const stopColor = gradientState.stops[selectedStopIndex].color;
      const stopRgba = hexToRgba(stopColor);
      const stopHsv = rgbToHsv(stopRgba.r, stopRgba.g, stopRgba.b);
      setHue(stopHsv.h);
      setSat(stopHsv.s);
      setVal(stopHsv.v);
    }
  }, [selectedStopIndex, fillMode]);

  // Update selected stop color when HSV changes in gradient mode
  useEffect(() => {
    if (fillMode !== 'gradient') return;
    const stop = gradientState.stops[selectedStopIndex];
    if (!stop) return;
    // Avoid infinite loop: only update if color actually changed
    if (stop.color === currentHex) return;
    const newStops = gradientState.stops.map((s: GradientStop, i: number) =>
      i === selectedStopIndex ? {...s, color: currentHex} : s,
    );
    const newGradient = {...gradientState, stops: newStops};
    setGradientState(newGradient);
    if (onGradientLiveChange) onGradientLiveChange(newGradient);
  }, [currentHex, fillMode, selectedStopIndex]);

  // Close on Escape — commits current color (no cancel/revert)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Commit current state and close
        if (fillMode === 'gradient') {
          if (onGradientChange) onGradientChange(gradientState);
        } else {
          onCommit(currentHex);
        }
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onCommit, onGradientChange, fillMode, currentHex, gradientState]);

  // Color area interaction (saturation-X, value-Y)
  const handleAreaPointer = useCallback((e: PointerEvent) => {
    if (!areaRef.current) return;
    const rect = areaRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    setSat(x);
    setVal(1 - y);
  }, []);

  const handleAreaDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    draggingArea.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handleAreaPointer(e);
  }, [handleAreaPointer]);

  const handleAreaMove = useCallback((e: PointerEvent) => {
    if (draggingArea.current) handleAreaPointer(e);
  }, [handleAreaPointer]);

  const handleAreaUp = useCallback(() => {
    draggingArea.current = false;
  }, []);

  // Hue slider interaction
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
  }, []);

  // Commit hex from text input
  const commitHex = useCallback(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) {
      const rgb = hexToRgba(hexInput);
      const h = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(h.h); setSat(h.s); setVal(h.v);
    } else {
      setHexInput(currentHex);
    }
  }, [hexInput, currentHex]);

  // Commit RGBA from text inputs
  const commitRgba = useCallback(() => {
    const r = parseInt(rInput, 10), g = parseInt(gInput, 10), b = parseInt(bInput, 10);
    if ([r, g, b].every(v => !isNaN(v) && v >= 0 && v <= 255)) {
      const h = rgbToHsv(r, g, b);
      setHue(h.h); setSat(h.s); setVal(h.v);
    }
  }, [rInput, gInput, bInput]);

  // Commit HSL from text inputs
  const commitHsl = useCallback(() => {
    const h = parseInt(hInput, 10), s = parseInt(sInput, 10), l = parseInt(lInput, 10);
    if (!isNaN(h) && h >= 0 && h <= 360 && !isNaN(s) && s >= 0 && s <= 100 && !isNaN(l) && l >= 0 && l <= 100) {
      const rgb = hslToRgb(h / 360, s / 100, l / 100);
      const hsv2 = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(hsv2.h); setSat(hsv2.s); setVal(hsv2.v);
    }
  }, [hInput, sInput, lInput]);

  // Handle fill mode switch
  const handleFillModeSwitch = useCallback((newMode: FillMode) => {
    if (newMode === fillMode) return;
    if (newMode === 'gradient') {
      // Solid -> Gradient: use current solid color as first stop
      const newGradient: GradientData = {
        type: 'linear',
        stops: [
          {color: currentHex, position: 0},
          {color: '#ffffff', position: 1},
        ],
        angle: 180,
      };
      setGradientState(newGradient);
      setSelectedStopIndex(0);
      if (onGradientLiveChange) onGradientLiveChange(newGradient);
    } else {
      // Gradient -> Solid: use first stop's color
      const firstColor = gradientState.stops[0]?.color ?? '#000000';
      const rgb = hexToRgba(firstColor);
      const h = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(h.h); setSat(h.s); setVal(h.v);
      if (onLiveChange) onLiveChange(firstColor);
    }
    setFillMode(newMode);
  }, [fillMode, currentHex, gradientState, onLiveChange, onGradientLiveChange]);

  // Gradient controls handlers
  const handleGradientTypeChange = useCallback((type: 'linear' | 'radial' | 'conic') => {
    const newGradient = {...gradientState, type};
    setGradientState(newGradient);
    if (onGradientLiveChange) onGradientLiveChange(newGradient);
  }, [gradientState, onGradientLiveChange]);

  const handleGradientAngleChange = useCallback((angle: number) => {
    const newGradient = {...gradientState, angle};
    setGradientState(newGradient);
    if (onGradientLiveChange) onGradientLiveChange(newGradient);
  }, [gradientState, onGradientLiveChange]);

  const handleGradientCenterChange = useCallback((axis: 'centerX' | 'centerY', value: number) => {
    const newGradient = {...gradientState, [axis]: value};
    setGradientState(newGradient);
    if (onGradientLiveChange) onGradientLiveChange(newGradient);
  }, [gradientState, onGradientLiveChange]);

  const handleStopsChange = useCallback((stops: GradientStop[]) => {
    const newGradient = {...gradientState, stops};
    setGradientState(newGradient);
    if (onGradientLiveChange) onGradientLiveChange(newGradient);
  }, [gradientState, onGradientLiveChange]);

  // Hue color for the area background
  const hueRgb = hsvToRgb(hue, 1, 1);
  const hueBg = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;

  const inputStyle = {
    fontSize: '11px',
    backgroundColor: 'var(--sidebar-input-bg)',
    color: 'var(--sidebar-text-primary)',
  };

  const labelStyle = {
    fontSize: '9px',
    color: 'var(--sidebar-text-secondary)',
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  };

  const modeButtonClass = (m: ColorMode) =>
    `px-2 py-1 text-[10px] rounded cursor-pointer transition-colors ${colorInputMode === m ? 'bg-(--color-accent) text-white font-medium' : 'text-(--sidebar-text-secondary) hover:text-(--sidebar-text-primary)'}`;

  const fillModeButtonClass = (m: FillMode) =>
    `flex-1 text-[11px] py-1 rounded cursor-pointer transition-colors ${
      fillMode === m
        ? 'bg-(--color-accent) text-white'
        : 'bg-(--color-bg-input) text-(--color-text-secondary) hover:text-white'
    }`;

  const isGradientMode = fillMode === 'gradient';
  const modalWidth = isGradientMode ? '340px' : '300px';

  // Close handler: commit current color then close
  const handleClose = useCallback(() => {
    if (fillMode === 'gradient') {
      if (onGradientChange) onGradientChange(gradientState);
    } else {
      onCommit(currentHex);
    }
    onClose();
  }, [currentHex, onCommit, onClose, fillMode, gradientState, onGradientChange]);

  return createPortal(
    <div
      class="fixed inset-0 z-50"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Transparent click-catcher backdrop (no dark overlay) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          background: 'transparent',
        }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        class="relative rounded-xl shadow-2xl p-5 flex flex-col gap-4"
        style={{
          width: modalWidth,
          backgroundColor: 'var(--sidebar-panel-bg)',
          border: '1px solid var(--sidebar-border-unselected)',
          zIndex: 1000,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold" style={{color: 'var(--sidebar-text-primary)'}}>Color Picker</span>
          <button
            class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#ffffff15] transition-colors cursor-pointer"
            onClick={handleClose}
            title="Close"
          >
            <X size={12} style={{color: 'var(--sidebar-text-secondary)'}} />
          </button>
        </div>

        {/* Solid / Gradient toggle (only when showGradientMode is true) */}
        {showGradientMode && (
          <div class="flex gap-1">
            <button
              class={fillModeButtonClass('solid')}
              onClick={() => handleFillModeSwitch('solid')}
            >
              Solid
            </button>
            <button
              class={fillModeButtonClass('gradient')}
              onClick={() => handleFillModeSwitch('gradient')}
            >
              Gradient
            </button>
          </div>
        )}

        {/* Gradient controls (only in gradient mode) */}
        {isGradientMode && showGradientMode && (
          <div class="flex flex-col gap-3">
            {/* Gradient preview */}
            <div
              class="rounded-lg"
              style={{
                width: '100%',
                height: '40px',
                background: buildGradientCSS(
                  gradientState.stops,
                  gradientState.type,
                  gradientState.angle,
                  gradientState.centerX,
                  gradientState.centerY,
                ),
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />

            {/* Gradient type selector */}
            <div class="flex flex-col gap-1">
              <span style={labelStyle}>Type</span>
              <select
                class="w-full rounded px-2 py-1.5 border-0 outline-none text-[11px] cursor-pointer"
                style={{
                  backgroundColor: 'var(--sidebar-input-bg)',
                  color: 'var(--sidebar-text-primary)',
                }}
                value={gradientState.type}
                onChange={(e) => handleGradientTypeChange((e.target as HTMLSelectElement).value as 'linear' | 'radial' | 'conic')}
              >
                <option value="linear">Linear</option>
                <option value="radial">Radial</option>
                <option value="conic">Conic</option>
              </select>
            </div>

            {/* Gradient bar with draggable stops */}
            <div class="flex flex-col gap-1">
              <span style={labelStyle}>Color Stops</span>
              <GradientBar
                stops={gradientState.stops}
                gradientType={gradientState.type}
                angle={gradientState.angle}
                centerX={gradientState.centerX}
                centerY={gradientState.centerY}
                onStopsChange={handleStopsChange}
                onStopSelect={setSelectedStopIndex}
                selectedStopIndex={selectedStopIndex}
              />
              <span class="text-[9px] mt-0.5" style={{color: 'var(--sidebar-text-secondary)'}}>
                Click bar to add stop. Right-click or double-click handle to remove.
              </span>
            </div>

            {/* Angle control (for linear and conic) */}
            {(gradientState.type === 'linear' || gradientState.type === 'conic') && (
              <div class="flex flex-col gap-1">
                <span style={labelStyle}>Angle</span>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={gradientState.angle ?? (gradientState.type === 'linear' ? 180 : 0)}
                    class="w-full rounded px-2 py-1.5 border-0 outline-none font-mono"
                    style={inputStyle}
                    onInput={(e) => handleGradientAngleChange(Number((e.target as HTMLInputElement).value))}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span class="text-[10px] shrink-0" style={{color: 'var(--sidebar-text-secondary)'}}>deg</span>
                </div>
              </div>
            )}

            {/* Center controls (for radial and conic) */}
            {(gradientState.type === 'radial' || gradientState.type === 'conic') && (
              <div class="grid grid-cols-2 gap-2">
                <div class="flex flex-col gap-1">
                  <span style={labelStyle}>Center X</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round((gradientState.centerX ?? 0.5) * 100)}
                    class="w-full rounded px-2 py-1.5 border-0 outline-none font-mono"
                    style={inputStyle}
                    onInput={(e) => handleGradientCenterChange('centerX', Number((e.target as HTMLInputElement).value) / 100)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div class="flex flex-col gap-1">
                  <span style={labelStyle}>Center Y</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.round((gradientState.centerY ?? 0.5) * 100)}
                    class="w-full rounded px-2 py-1.5 border-0 outline-none font-mono"
                    style={inputStyle}
                    onInput={(e) => handleGradientCenterChange('centerY', Number((e.target as HTMLInputElement).value) / 100)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            )}

            {/* Separator before selected stop color picker */}
            <div style={{borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px'}}>
              <span style={labelStyle}>Selected Stop Color</span>
            </div>
          </div>
        )}

        {/* Color area (saturation-value) */}
        <div
          ref={areaRef}
          class="relative rounded-lg cursor-crosshair"
          style={{
            width: '100%',
            height: '160px',
            background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueBg})`,
          }}
          onPointerDown={handleAreaDown}
          onPointerMove={handleAreaMove}
          onPointerUp={handleAreaUp}
        >
          {/* Cursor indicator */}
          <div
            class="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none"
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
            height: '14px',
            background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)',
          }}
          onPointerDown={handleHueDown}
          onPointerMove={handleHueMove}
          onPointerUp={handleHueUp}
        >
          <div
            class="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-md pointer-events-none"
            style={{
              left: `${hue * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: `hsl(${Math.round(hue * 360)}, 100%, 50%)`,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
            }}
          />
        </div>

        {/* Color preview (solid mode only) */}
        {!isGradientMode && (
          <div class="flex gap-2 items-center">
            <div class="rounded" style={{width: '24px', height: '24px', backgroundColor: currentHex}} />
            <span class="text-[10px] font-mono" style={{color: 'var(--sidebar-text-primary)'}}>{currentHex.toUpperCase()}</span>
          </div>
        )}

        {/* Mode tabs (both solid and gradient modes) */}
        <div class="flex gap-1 items-center">
          <button class={modeButtonClass('hex')} onClick={() => setColorInputMode('hex')}>HEX</button>
          <button class={modeButtonClass('rgba')} onClick={() => setColorInputMode('rgba')}>RGBA</button>
          <button class={modeButtonClass('hsl')} onClick={() => setColorInputMode('hsl')}>HSL</button>
        </div>

        {/* Mode-specific inputs */}
        {colorInputMode === 'hex' && (
          <div class="flex flex-col gap-1">
            <span style={labelStyle}>Hex</span>
            <input
              type="text"
              value={hexInput}
              class="w-full rounded px-2 py-1.5 border-0 outline-none font-mono"
              style={inputStyle}
              placeholder="#000000"
              onInput={(e) => setHexInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitHex(); }}
              onBlur={commitHex}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {colorInputMode === 'rgba' && (
          <div class="grid grid-cols-3 gap-2">
            {[
              {label: 'R', value: rInput, set: setRInput, commit: commitRgba},
              {label: 'G', value: gInput, set: setGInput, commit: commitRgba},
              {label: 'B', value: bInput, set: setBInput, commit: commitRgba},
            ].map(({label, value, set, commit}) => (
              <div class="flex flex-col gap-1" key={label}>
                <span style={labelStyle}>{label}</span>
                <input
                  type="number"
                  min={0}
                  max={255}
                  value={value}
                  class="w-full rounded px-2 py-1.5 border-0 outline-none font-mono"
                  style={inputStyle}
                  onInput={(e) => set((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
                  onBlur={commit}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </div>
        )}

        {colorInputMode === 'hsl' && (
          <div class="grid grid-cols-3 gap-2">
            {[
              {label: 'H', value: hInput, set: setHInput, commit: commitHsl, max: 360, unit: '\u00B0'},
              {label: 'S', value: sInput, set: setSInput, commit: commitHsl, max: 100, unit: '%'},
              {label: 'L', value: lInput, set: setLInput, commit: commitHsl, max: 100, unit: '%'},
            ].map(({label, value, set, commit, max}) => (
              <div class="flex flex-col gap-1" key={label}>
                <span style={labelStyle}>{label}</span>
                <input
                  type="number"
                  min={0}
                  max={max}
                  value={value}
                  class="w-full rounded px-2 py-1.5 border-0 outline-none font-mono"
                  style={inputStyle}
                  onInput={(e) => set((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
                  onBlur={commit}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ))}
          </div>
        )}

      </div>
    </div>,
    document.body,
  );
}
