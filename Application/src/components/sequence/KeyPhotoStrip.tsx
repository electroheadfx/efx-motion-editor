import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import Sortable from 'sortablejs';
import {Camera, Square, Blend, Pipette, X, Plus, Minus} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {imageStore} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';
import {trackLayouts} from '../../lib/frameMap';
import {playbackEngine} from '../../lib/playbackEngine';
import {getTopLayerId} from '../../lib/layerSelection';
import {getActiveKeyPhotoIndex} from '../../lib/keyPhotoNav';

// === Color conversion utilities ===

function hexToRgba(hex: string): {r: number; g: number; b: number; a: number} {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i);
  if (!m) return {r: 0, g: 0, b: 0, a: 1};
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
    a: m[4] !== undefined ? parseInt(m[4], 16) / 255 : 1,
  };
}

function rgbaToHex(r: number, g: number, b: number, _a?: number): string {
  const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r: number, g: number, b: number): {h: number; s: number; l: number} {
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

function hslToRgb(h: number, s: number, l: number): {r: number; g: number; b: number} {
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

// === HSV helpers for the color area ===

function rgbToHsv(r: number, g: number, b: number): {h: number; s: number; v: number} {
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

function hsvToRgb(h: number, s: number, v: number): {r: number; g: number; b: number} {
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

/** Key photo strip with thumbnails, hold duration editing, click-to-select + SortableJS drag reorder */
export function KeyPhotoStrip() {
  const activeSeq = sequenceStore.getActiveSequence();

  if (!activeSeq) {
    return (
      <div class="px-3 py-3 text-center">
        <span class="text-[10px]" style={{color: 'var(--sidebar-text-secondary)'}}>
          Select a sequence to view key photos
        </span>
      </div>
    );
  }

  if (activeSeq.keyPhotos.length === 0) {
    return (
      <div class="px-3 py-3 text-center">
        <button
          class="text-[10px] hover:underline cursor-pointer"
          style={{ color: 'var(--color-accent)' }}
          onClick={() => uiStore.setEditorMode('imported')}
        >
          + Add photos
        </button>
      </div>
    );
  }

  return (
    <div class="px-2 py-2">
      <KeyPhotoStripInline sequenceId={activeSeq.id} />
    </div>
  );
}

/** Inline key photo strip rendered inside a SequenceItem card */
export function KeyPhotoStripInline({sequenceId}: {sequenceId: string}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeSeq = sequenceStore.getById(sequenceId);
  const keyPhotos = activeSeq?.keyPhotos ?? [];

  // Read displayFrame for auto-scroll (only changes when NOT playing, or on stop)
  const displayFrame = timelineStore.displayFrame.value;

  // Compute active key photo index from displayFrame
  const layouts = trackLayouts.peek();
  const track = layouts.find(t => t.sequenceId === sequenceId);
  const activeKpIndex = track ? getActiveKeyPhotoIndex(track.keyPhotoRanges, displayFrame) : -1;

  // Auto-scroll strip to keep active key photo visible
  useEffect(() => {
    // Only auto-scroll when NOT playing
    if (timelineStore.isPlaying.peek()) return;
    if (!stripRef.current) return;

    const currentLayouts = trackLayouts.peek();
    const currentTrack = currentLayouts.find(t => t.sequenceId === sequenceId);
    if (!currentTrack) return;

    const kpIndex = getActiveKeyPhotoIndex(currentTrack.keyPhotoRanges, displayFrame);
    if (kpIndex < 0) return;

    const child = stripRef.current.children[kpIndex] as HTMLElement;
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [displayFrame, sequenceId]);

  // Convert vertical wheel to horizontal scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!stripRef.current) return;
    if (e.deltaY !== 0) {
      e.preventDefault();
      stripRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // SortableJS drag-and-drop reorder
  useEffect(() => {
    if (!stripRef.current) return;
    const instance = Sortable.create(stripRef.current, {
      animation: 150,
      ghostClass: 'opacity-30',
      forceFallback: true,
      fallbackClass: 'opacity-30',
      direction: 'horizontal',
      onEnd(evt) {
        const { oldIndex, newIndex, item, from } = evt;
        if (oldIndex != null && newIndex != null && oldIndex !== newIndex) {
          // Revert SortableJS DOM mutation so Preact can re-render correctly
          from.removeChild(item);
          from.insertBefore(item, from.children[oldIndex] ?? null);
          sequenceStore.reorderKeyPhotos(sequenceId, oldIndex, newIndex);
        }
      },
    });
    return () => instance.destroy();
  }, [keyPhotos.length, sequenceId]);

  return (
    <div
      ref={stripRef}
      class="flex gap-1 overflow-x-auto scrollbar-hidden p-0.5"
      onWheel={handleWheel}
      onClick={() => {
        sequenceStore.clearKeyPhotoSelection();
      }}
    >
      {keyPhotos.map((kp, index) => (
        <KeyPhotoCard
          key={kp.id}
          sequenceId={sequenceId}
          keyPhotoId={kp.id}
          imageId={kp.imageId}
          holdFrames={kp.holdFrames}
          isActiveByFrame={index === activeKpIndex}
          solidColor={kp.solidColor}
          isTransparent={kp.isTransparent}
        />
      ))}
    </div>
  );
}

/** Full-featured color picker modal with RGBA, HSL, HEX modes */
type ColorMode = 'hex' | 'rgba' | 'hsl';

interface ColorPickerModalProps {
  color: string;
  onLiveChange: (color: string) => void;
  onCommit: (color: string) => void;
  onClose: () => void;
}

function ColorPickerModal({color, onLiveChange, onCommit, onClose}: ColorPickerModalProps) {
  const initialColor = useRef(color);
  const rgba = hexToRgba(color);
  const hsv = rgbToHsv(rgba.r, rgba.g, rgba.b);
  const hsl = rgbToHsl(rgba.r, rgba.g, rgba.b);

  const [hue, setHue] = useState(hsv.h);
  const [sat, setSat] = useState(hsv.s);
  const [val, setVal] = useState(hsv.v);
  const [mode, setMode] = useState<ColorMode>('hex');
  const [hexInput, setHexInput] = useState(color);
  const [rInput, setRInput] = useState(String(rgba.r));
  const [gInput, setGInput] = useState(String(rgba.g));
  const [bInput, setBInput] = useState(String(rgba.b));
  const [hInput, setHInput] = useState(String(Math.round(hsl.h * 360)));
  const [sInput, setSInput] = useState(String(Math.round(hsl.s * 100)));
  const [lInput, setLInput] = useState(String(Math.round(hsl.l * 100)));

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

  // Live preview as user drags
  useEffect(() => {
    onLiveChange(currentHex);
  }, [currentHex]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onLiveChange(initialColor.current);
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, onLiveChange]);

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
      const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
      setHue(hsv.h); setSat(hsv.s); setVal(hsv.v);
    }
  }, [hInput, sInput, lInput]);

  const handleApply = useCallback(() => {
    onCommit(currentHex);
    onClose();
  }, [currentHex, onCommit, onClose]);

  const handleCancel = useCallback(() => {
    onLiveChange(initialColor.current);
    onClose();
  }, [onLiveChange, onClose]);

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
    `px-2 py-1 text-[10px] rounded cursor-pointer transition-colors ${mode === m ? 'bg-[var(--color-accent)] text-white font-medium' : 'text-[var(--sidebar-text-secondary)] hover:text-[var(--sidebar-text-primary)]'}`;

  return (
    <div
      class="fixed inset-0 flex items-center justify-center z-50"
      onClick={handleCancel}
    >
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/50" />

      {/* Modal */}
      <div
        class="relative rounded-xl shadow-2xl p-5 flex flex-col gap-4"
        style={{
          width: '300px',
          backgroundColor: 'var(--sidebar-panel-bg)',
          border: '1px solid var(--sidebar-border-unselected)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold" style={{color: 'var(--sidebar-text-primary)'}}>Color Picker</span>
          <button
            class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#ffffff15] transition-colors cursor-pointer"
            onClick={handleCancel}
            title="Close"
          >
            <X size={12} style={{color: 'var(--sidebar-text-secondary)'}} />
          </button>
        </div>

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

        {/* Color preview + current/initial */}
        <div class="flex gap-2 items-center">
          <div class="flex rounded overflow-hidden" style={{width: '48px', height: '24px'}}>
            <div style={{flex: 1, backgroundColor: currentHex}} title="Current" />
            <div style={{flex: 1, backgroundColor: initialColor.current}} title="Original" />
          </div>
          <span class="text-[10px] font-mono" style={{color: 'var(--sidebar-text-primary)'}}>{currentHex.toUpperCase()}</span>
        </div>

        {/* Mode tabs */}
        <div class="flex gap-1 items-center">
          <button class={modeButtonClass('hex')} onClick={() => setMode('hex')}>HEX</button>
          <button class={modeButtonClass('rgba')} onClick={() => setMode('rgba')}>RGBA</button>
          <button class={modeButtonClass('hsl')} onClick={() => setMode('hsl')}>HSL</button>
        </div>

        {/* Mode-specific inputs */}
        {mode === 'hex' && (
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

        {mode === 'rgba' && (
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

        {mode === 'hsl' && (
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

        {/* Action buttons */}
        <div class="flex items-center justify-end gap-2 pt-1">
          <button
            class="h-7 rounded-md px-3 text-[11px] cursor-pointer transition-colors hover:bg-[#ffffff10]"
            style={{color: 'var(--sidebar-text-secondary)'}}
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            class="h-7 rounded-md px-4 text-[11px] font-medium text-white cursor-pointer transition-colors hover:brightness-110"
            style={{backgroundColor: 'var(--color-accent)'}}
            onClick={handleApply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hold frames popover with +/- buttons and number input */
interface FramesPopoverProps {
  holdFrames: number;
  onCommit: (frames: number) => void;
  onClose: () => void;
}

function FramesPopover({holdFrames, onCommit, onClose}: FramesPopoverProps) {
  const [value, setValue] = useState(holdFrames);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (value !== holdFrames) onCommit(value);
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, onCommit, value, holdFrames]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const clamp = (n: number) => Math.max(1, Math.min(999, n));

  const handleDecrement = useCallback(() => {
    setValue(v => {
      const next = clamp(v - 1);
      onCommit(next);
      return next;
    });
  }, [onCommit]);

  const handleIncrement = useCallback(() => {
    setValue(v => {
      const next = clamp(v + 1);
      onCommit(next);
      return next;
    });
  }, [onCommit]);

  const handleInputCommit = useCallback(() => {
    const clamped = clamp(value);
    setValue(clamped);
    onCommit(clamped);
  }, [value, onCommit]);

  return (
    <div
      ref={popoverRef}
      class="absolute z-50 rounded-lg shadow-xl p-2 flex flex-col gap-1.5"
      style={{
        bottom: '100%',
        right: 0,
        marginBottom: '4px',
        backgroundColor: 'var(--sidebar-panel-bg)',
        border: '1px solid var(--sidebar-border-unselected)',
        minWidth: '120px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span class="text-[9px] font-medium" style={{color: 'var(--sidebar-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
        Hold Frames
      </span>
      <div class="flex items-center gap-1">
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-[#ffffff15]"
          style={{backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)'}}
          onClick={handleDecrement}
          title="Decrease frames"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min={1}
          max={999}
          value={value}
          class="flex-1 h-7 rounded-md px-2 border-0 outline-none text-center font-mono"
          style={{
            fontSize: '12px',
            backgroundColor: 'var(--sidebar-input-bg)',
            color: 'var(--sidebar-text-primary)',
            minWidth: '40px',
          }}
          onInput={(e) => {
            const parsed = parseInt((e.target as HTMLInputElement).value, 10);
            if (!isNaN(parsed)) setValue(parsed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleInputCommit();
            if (e.key === 'Escape') onClose();
          }}
          onBlur={handleInputCommit}
        />
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-[#ffffff15]"
          style={{backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)'}}
          onClick={handleIncrement}
          title="Increase frames"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

interface KeyPhotoCardProps {
  sequenceId: string;
  keyPhotoId: string;
  imageId: string;
  holdFrames: number;
  isActiveByFrame: boolean;
  solidColor?: string;
  isTransparent?: boolean;
}

function KeyPhotoCard({
  sequenceId,
  keyPhotoId,
  imageId,
  holdFrames,
  isActiveByFrame,
  solidColor,
  isTransparent,
}: KeyPhotoCardProps) {
  const [framesPopoverOpen, setFramesPopoverOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isSolidEntry = !!solidColor || !!isTransparent;
  const image = !isSolidEntry ? imageStore.getById(imageId) : undefined;
  const thumbUrl = image ? assetUrl(image.thumbnail_path) : null;

  return (
    <div
      class={`group h-14 rounded-md relative shrink-0 bg-cover bg-center overflow-hidden cursor-pointer${isActiveByFrame ? ' ring-2 ring-[var(--color-accent)]' : ''}`}
      style={{
        width: 'auto',
        minWidth: '56px',
        height: '56px',
        backgroundColor: isTransparent ? '#B0B0B0' : solidColor ? solidColor : 'var(--sidebar-input-bg)',
        opacity: isActiveByFrame ? 1 : 0.7,
        ...(isTransparent ? {
          backgroundImage: 'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
        } : thumbUrl ? {backgroundImage: `url(${thumbUrl})`, aspectRatio: 'auto'} : {}),
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Select key photo (for Delete key targeting)
        sequenceStore.selectKeyPhoto(keyPhotoId);

        // Auto-select top-most layer (bidirectional sync)
        const seq = sequenceStore.getById(sequenceId);
        if (seq) {
          const topLayerId = getTopLayerId(seq);
          if (topLayerId) {
            layerStore.setSelected(topLayerId);
            uiStore.selectLayer(topLayerId);
          }
        }

        // Seek playhead to key photo start frame
        const seekLayouts = trackLayouts.peek();
        const seekTrack = seekLayouts.find(t => t.sequenceId === sequenceId);
        if (seekTrack) {
          const range = seekTrack.keyPhotoRanges.find(r => r.keyPhotoId === keyPhotoId);
          if (range) {
            playbackEngine.seekToFrame(range.startFrame);
          }
          timelineStore.ensureTrackVisible(sequenceId);
        }
      }}
    >
      {/* Placeholder icon when no image and not a solid/transparent entry */}
      {!thumbUrl && !isSolidEntry && (
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[10px]" style={{color: 'var(--sidebar-text-secondary)'}}>?</span>
        </div>
      )}

      {/* Top-left: Solid/Transparent toggle (per D-11) — only for solid entries, visible on hover */}
      {isSolidEntry && (
        <button
          class="absolute top-0.5 left-0.5 w-3.5 h-3.5 flex items-center justify-center bg-[#00000080] hover:bg-[#000000AA] rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            sequenceStore.toggleKeyEntryTransparent(sequenceId, keyPhotoId);
          }}
          title={isTransparent ? 'Switch to solid color' : 'Switch to transparent'}
        >
          {isTransparent ? <Blend size={10} color="white" /> : <Square size={10} color="white" />}
        </button>
      )}

      {/* Bottom-left: Pipette color picker (per D-10, D-12) — hidden when transparent */}
      {isSolidEntry && !isTransparent && (
        <button
          class="absolute bottom-0.5 left-0.5 w-3.5 h-3.5 flex items-center justify-center bg-[#00000080] hover:bg-[#000000AA] rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(!pickerOpen);
          }}
          title="Pick color"
        >
          <Pipette size={10} color="white" />
        </button>
      )}
      {/* Color picker modal rendered at top level (fixed positioning) */}
      {pickerOpen && (
        <ColorPickerModal
          color={solidColor || '#000000'}
          onLiveChange={(c) => {
            sequenceStore.updateKeySolidColorLive(sequenceId, keyPhotoId, c);
          }}
          onCommit={(c) => {
            sequenceStore.updateKeySolidColor(sequenceId, keyPhotoId, c);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* Delete button on hover */}
      <button
        class="absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center bg-[#000000AA] rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          sequenceStore.removeKeyPhoto(sequenceId, keyPhotoId);
        }}
        title="Remove key photo"
      >
        <X size={10} color="white" />
      </button>

      {/* Hold frames badge — click opens frames popover */}
      <div class="absolute bottom-0.5 right-0.5">
        <button
          class="text-[9px] bg-[#00000080] text-white rounded px-1 py-0 cursor-pointer hover:bg-[#000000AA]"
          onClick={(e) => {
            e.stopPropagation();
            setFramesPopoverOpen(!framesPopoverOpen);
          }}
          title="Click to edit hold frames"
        >
          {holdFrames}f
        </button>
        {framesPopoverOpen && (
          <FramesPopover
            holdFrames={holdFrames}
            onCommit={(frames) => {
              sequenceStore.updateHoldFrames(sequenceId, keyPhotoId, frames);
            }}
            onClose={() => setFramesPopoverOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

/** Split add button — Camera (top) to add key photo, Square (bottom) to add key solid (per D-05, D-06, D-07) */
export function AddKeyPhotoButton({sequenceId}: {sequenceId: string}) {
  return (
    <div class="flex flex-col shrink-0 rounded overflow-hidden" style={{ width: '24px', height: '56px' }}>
      <button
        class="flex-1 flex items-center justify-center hover:brightness-125 transition-colors cursor-pointer"
        style={{ backgroundColor: '#3A3A50', color: 'var(--sidebar-text-secondary)' }}
        onClick={() => uiStore.setEditorMode('imported')}
        aria-label="Add key photo"
        title="Add photo from imported images"
      >
        <Camera size={12} />
      </button>
      <button
        class="flex-1 flex items-center justify-center hover:brightness-125 transition-colors cursor-pointer"
        style={{ backgroundColor: '#3A3A50', color: 'var(--sidebar-text-secondary)', borderTop: '1px solid #2A2A3A' }}
        onClick={() => sequenceStore.addKeySolid(sequenceId)}
        aria-label="Add key solid"
        title="Add solid color entry"
      >
        <Square size={12} />
      </button>
    </div>
  );
}
