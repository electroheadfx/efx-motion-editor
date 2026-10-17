// ============================================================
//  RightPanelColorTab — the shared HSV + hex + palette picker
//  (UI checklist row 6: Color tab). Drives Brush AND Water color
//  through the one onColorChange seam.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { X } from 'lucide-preact';
import { hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb } from '../../../lib/colorUtils';
import {
  loadFavoriteColors,
  loadHiddenPaletteColors,
  loadRecentColors,
  saveFavoriteColors,
  saveHiddenPaletteColors,
  saveRecentColors,
} from '../../../lib/paintPreferences';

const DEFAULT_PALETTE = ['#103c65', '#2d5be3', '#4caf70', '#f59e0b', '#ff6633', '#ff6666', '#f8fafc', '#111827'];

function normalizeHexInput(value: string): string | null {
  const match = value.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
  return `#${hex.slice(0, 6).toLowerCase()}`;
}

export function RightPanelColorTab(props: {
  color: string;
  disabled?: boolean;
  onColorChange: (color: string, opacity: number) => void;
  opacity: number;
}) {
  const [hexInput, setHexInput] = useState(props.color);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [hiddenPaletteColors, setHiddenPaletteColors] = useState<string[]>([]);
  const previousColorRef = useRef(props.color);
  const colorBoxRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingColorBox = useRef(false);
  const draggingHue = useRef(false);

  useEffect(() => {
    void loadRecentColors()
      .then((colors) => setRecentColors(colors.map(normalizeHexInput).filter((item): item is string => item !== null)))
      .catch((loadError) => console.error('Failed to load recent colors', loadError));
    void loadFavoriteColors()
      .then((colors) => setFavoriteColors(colors.map(normalizeHexInput).filter((item): item is string => item !== null)))
      .catch((loadError) => console.error('Failed to load favorite colors', loadError));
    void loadHiddenPaletteColors()
      .then((colors) => setHiddenPaletteColors(colors.map(normalizeHexInput).filter((item): item is string => item !== null)))
      .catch((loadError) => console.error('Failed to load hidden palette colors', loadError));
  }, []);

  useEffect(() => {
    if (previousColorRef.current === props.color) return;
    previousColorRef.current = props.color;
    setHexInput(props.color);
  }, [props.color]);

  const currentRgb = hexToRgba(props.color);
  const currentHex = rgbaToHex(currentRgb.r, currentRgb.g, currentRgb.b);
  const currentHsv = rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b);

  useEffect(() => {
    const canvas = colorBoxRef.current;
    const context = canvas?.getContext('2d', { willReadFrequently: true });
    if (!canvas || !context) return;
    const hueRgb = hsvToRgb(currentHsv.h, 1, 1);
    context.fillStyle = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const white = context.createLinearGradient(0, 0, canvas.width, 0);
    white.addColorStop(0, 'rgba(255,255,255,1)');
    white.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = white;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const black = context.createLinearGradient(0, 0, 0, canvas.height);
    black.addColorStop(0, 'rgba(0,0,0,0)');
    black.addColorStop(1, 'rgba(0,0,0,1)');
    context.fillStyle = black;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, [currentHsv.h]);

  const commitColor = useCallback((nextColor: string, nextOpacity = props.opacity) => {
    const normalized = normalizeHexInput(nextColor);
    if (!normalized) {
      setHexInput(currentHex);
      return;
    }
    setHexInput(normalized);
    props.onColorChange(normalized, nextOpacity);
  }, [currentHex, props.onColorChange, props.opacity]);

  const commitHsv = useCallback((h: number, s: number, v: number) => {
    const rgb = hsvToRgb(h, s, v);
    commitColor(rgbaToHex(rgb.r, rgb.g, rgb.b));
  }, [commitColor]);

  const handleColorBoxPointer = useCallback((event: PointerEvent) => {
    const canvas = colorBoxRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const v = 1 - Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    commitHsv(currentHsv.h, s, v);
  }, [commitHsv, currentHsv.h]);

  const handleHuePointer = useCallback((event: PointerEvent) => {
    const slider = hueRef.current;
    if (!slider) return;
    const rect = slider.getBoundingClientRect();
    const h = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    commitHsv(h, currentHsv.s, currentHsv.v);
  }, [commitHsv, currentHsv.s, currentHsv.v]);

  const addFavorite = useCallback(() => {
    const nextHex = normalizeHexInput(hexInput) ?? currentHex;
    if (nextHex !== currentHex) commitColor(nextHex);
    setHiddenPaletteColors((colors) => {
      const updated = colors.filter((item) => item !== nextHex);
      if (updated.length !== colors.length) {
        void saveHiddenPaletteColors(updated).catch((saveError) => console.error('Failed to restore palette color', saveError));
      }
      return updated;
    });
    setFavoriteColors((colors) => {
      const normalized = colors.map(normalizeHexInput).filter((item): item is string => item !== null);
      if (normalized.includes(nextHex)) return normalized;
      const updated = [...normalized, nextHex];
      void saveFavoriteColors(updated).catch((saveError) => console.error('Failed to save favorite colors', saveError));
      return updated;
    });
  }, [commitColor, currentHex, hexInput]);

  const removePaletteColor = useCallback((swatch: string) => {
    setFavoriteColors((colors) => {
      const updated = colors
        .map(normalizeHexInput)
        .filter((item): item is string => item !== null && item !== swatch);
      void saveFavoriteColors(updated).catch((saveError) => console.error('Failed to remove favorite color', saveError));
      return updated;
    });
    setRecentColors((colors) => {
      const updated = colors
        .map(normalizeHexInput)
        .filter((item): item is string => item !== null && item !== swatch);
      void saveRecentColors(updated).catch((saveError) => console.error('Failed to remove recent color', saveError));
      return updated;
    });
    if (DEFAULT_PALETTE.includes(swatch)) {
      setHiddenPaletteColors((colors) => {
        if (colors.includes(swatch)) return colors;
        const updated = [...colors, swatch];
        void saveHiddenPaletteColors(updated).catch((saveError) => console.error('Failed to hide palette color', saveError));
        return updated;
      });
    }
  }, []);

  const normalizedFavoriteColors = favoriteColors
    .map(normalizeHexInput)
    .filter((item): item is string => item !== null);
  const hiddenPaletteColorSet = new Set(hiddenPaletteColors);
  const swatches = [...normalizedFavoriteColors].reverse().concat(DEFAULT_PALETTE, recentColors)
    .map(normalizeHexInput)
    .filter((item): item is string => item !== null)
    .filter((item, index, source) => source.indexOf(item) === index)
    .filter((item) => !hiddenPaletteColorSet.has(item));

  // Markup matches the live Color-tab body: the color box is one sibling of
  // the hue strip / input row / swatch grid (I-10 adoption keeps the panel's
  // physics-paint-options-tab-panel wrapper as their parent).
  return (
    <>
      <div class="physics-paint-color-picker" aria-label="Brush color picker">
        <canvas
          ref={colorBoxRef}
          width={232}
          height={160}
          class="physics-paint-color-box"
          aria-disabled={props.disabled}
          style={{ pointerEvents: props.disabled ? 'none' : undefined }}
          onPointerDown={(event) => {
            draggingColorBox.current = true;
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            handleColorBoxPointer(event as unknown as PointerEvent);
          }}
          onPointerMove={(event) => draggingColorBox.current && handleColorBoxPointer(event as unknown as PointerEvent)}
          onPointerUp={() => { draggingColorBox.current = false; }}
        />
        <span
          class="physics-paint-color-cursor"
          style={{ left: `${currentHsv.s * 100}%`, top: `${(1 - currentHsv.v) * 100}%`, backgroundColor: currentHex }}
        />
      </div>

      <div
        ref={hueRef}
        class="physics-paint-hue-strip"
        aria-label="Brush hue"
        aria-disabled={props.disabled}
        style={{ pointerEvents: props.disabled ? 'none' : undefined }}
        onPointerDown={(event) => {
          draggingHue.current = true;
          (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
          handleHuePointer(event as unknown as PointerEvent);
        }}
        onPointerMove={(event) => draggingHue.current && handleHuePointer(event as unknown as PointerEvent)}
        onPointerUp={() => { draggingHue.current = false; }}
      >
        <span class="physics-paint-hue-cursor" style={{ left: `${currentHsv.h * 100}%` }} />
      </div>

      <div class="physics-paint-color-input-row">
        <input
          type="color"
          class="physics-paint-color-chip"
          value={currentHex}
          aria-label="Brush color"
          disabled={props.disabled}
          onInput={(event) => commitColor((event.target as HTMLInputElement).value)}
        />
        <input
          type="text"
          class="physics-paint-hex-input"
          value={hexInput}
          aria-label="Brush color hex value"
          placeholder="#103c65"
          disabled={props.disabled}
          onInput={(event) => setHexInput((event.target as HTMLInputElement).value)}
          onBlur={() => commitColor(hexInput)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitColor(hexInput);
          }}
        />
        <button type="button" class="physics-paint-text-button physics-paint-add-swatch" disabled={props.disabled} onClick={addFavorite}>+</button>
      </div>

      <div class="physics-paint-swatch-grid" aria-label="Color palette">
        {swatches.map((swatch) => (
          <div key={swatch} class="physics-paint-swatch-cell">
            <button
              type="button"
              class="physics-paint-swatch"
              style={{ backgroundColor: swatch }}
              title={swatch}
              aria-label={`Use ${swatch}`}
              disabled={props.disabled}
              onClick={() => commitColor(swatch)}
            />
            <button
              type="button"
              class="physics-paint-swatch-remove"
              title={`Remove ${swatch} from palette`}
              aria-label={`Remove ${swatch} from palette`}
              disabled={props.disabled}
              onClick={() => removePaletteColor(swatch)}
            >
              <X aria-hidden="true" size={10} strokeWidth={2.4} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
