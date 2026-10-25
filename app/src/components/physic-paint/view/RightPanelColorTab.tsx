// ============================================================
//  RightPanelColorTab — the shared HSV + hex + palette picker
//  (UI checklist row 6: Color tab). Drives Brush AND Water color
//  through the one onColorChange seam.
// ============================================================

import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
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
  /**
   * 261024-p5q: the ONE commit boundary per picker gesture (box/hue release,
   * color-chip change, hex Enter/blur, swatch click). Live moves still flow
   * through onColorChange only. Optional — the sidebar and every existing
   * consumer keep their exact behavior when it is absent.
   */
  onColorCommit?: (color: string, opacity: number) => void;
  opacity: number;
}) {
  const [hexInput, setHexInput] = useState(props.color);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [hiddenPaletteColors, setHiddenPaletteColors] = useState<string[]>([]);
  const [selectedSwatch, setSelectedSwatch] = useState<string | null>(null);
  const previousColorRef = useRef(props.color);
  const lastColorRef = useRef(normalizeHexInput(props.color) ?? props.color);
  const colorBoxRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const swatchGridRef = useRef<HTMLDivElement>(null);
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
    const normalized = normalizeHexInput(props.color);
    if (normalized) lastColorRef.current = normalized;
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

  const commitColor = useCallback((nextColor: string, nextOpacity = props.opacity): string | null => {
    const normalized = normalizeHexInput(nextColor);
    if (!normalized) {
      setHexInput(currentHex);
      return null;
    }
    setHexInput(normalized);
    lastColorRef.current = normalized;
    props.onColorChange(normalized, nextOpacity);
    return normalized;
  }, [currentHex, props.onColorChange, props.opacity]);

  /**
   * 261025-co0: a committed color change edits the selected palette entry in
   * place (favorite, recent, or built-in default). Commit-only — never on a
   * live drag, and a no-op when the color is unchanged.
   */
  const rewriteSelectedSwatch = useCallback((nextColor: string) => {
    const previousColor = selectedSwatch;
    const normalizedNext = normalizeHexInput(nextColor);
    if (!previousColor || !normalizedNext || previousColor === normalizedNext) return;
    setFavoriteColors((colors) => {
      const normalized = colors.map(normalizeHexInput).filter((item): item is string => item !== null);
      if (!normalized.includes(previousColor)) return normalized;
      const updated = normalized
        .map((item) => (item === previousColor ? normalizedNext : item))
        .filter((item, index, source) => source.indexOf(item) === index);
      void saveFavoriteColors(updated).catch((saveError) => console.error('Failed to rewrite favorite color', saveError));
      return updated;
    });
    setRecentColors((colors) => {
      const normalized = colors.map(normalizeHexInput).filter((item): item is string => item !== null);
      if (!normalized.includes(previousColor)) return normalized;
      const updated = normalized
        .map((item) => (item === previousColor ? normalizedNext : item))
        .filter((item, index, source) => source.indexOf(item) === index);
      void saveRecentColors(updated).catch((saveError) => console.error('Failed to rewrite recent color', saveError));
      return updated;
    });
    if (DEFAULT_PALETTE.includes(previousColor)) {
      // The existing hide-default convention: the built-in disappears and the
      // replacement becomes the newest favorite.
      setHiddenPaletteColors((colors) => {
        if (colors.includes(previousColor)) return colors;
        const updated = [...colors, previousColor];
        void saveHiddenPaletteColors(updated).catch((saveError) => console.error('Failed to hide palette color', saveError));
        return updated;
      });
      setFavoriteColors((colors) => {
        const normalized = colors.map(normalizeHexInput).filter((item): item is string => item !== null);
        if (normalized.includes(normalizedNext)) return normalized;
        const updated = [...normalized, normalizedNext];
        void saveFavoriteColors(updated).catch((saveError) => console.error('Failed to save favorite colors', saveError));
        return updated;
      });
    }
    // Keep the selection on the entry that now holds the new color so a
    // following Delete removes the updated swatch.
    setSelectedSwatch(normalizedNext);
  }, [selectedSwatch]);

  /** One commit-boundary emission; live moves never reach it. */
  const emitColorCommit = useCallback((color: string, options?: { fromSwatch?: boolean }) => {
    const normalized = normalizeHexInput(color);
    if (!normalized) return;
    // A swatch click passes fromSwatch so a stale selectedSwatch closure can
    // never rewrite the previously selected swatch.
    if (!options?.fromSwatch) rewriteSelectedSwatch(normalized);
    props.onColorCommit?.(normalized, props.opacity);
  }, [props.onColorCommit, props.opacity, rewriteSelectedSwatch]);

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
    if (nextHex !== currentHex) {
      if (commitColor(nextHex)) emitColorCommit(nextHex);
    }
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
  }, [commitColor, currentHex, emitColorCommit, hexInput]);

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

  /**
   * 261025-co0: palette-owned Delete/Backspace. Focus inside the grid means
   * the key deletes the selected swatch — the global tinykeys handler
   * (lib/shortcuts.ts only suppresses INPUT/TEXTAREA/SELECT, not buttons) and
   * the document-level Studio router are both stopped here so a stroke, clip,
   * or layer can never be deleted by the same press.
   */
  const handleSwatchGridKeyDown = useCallback((event: KeyboardEvent) => {
    if (props.disabled) return;
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (!selectedSwatch || event.repeat) return;
    removePaletteColor(selectedSwatch);
    setSelectedSwatch(null);
    swatchGridRef.current?.focus();
  }, [props.disabled, removePaletteColor, selectedSwatch]);

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
          onPointerUp={() => {
            if (!draggingColorBox.current) return;
            draggingColorBox.current = false;
            emitColorCommit(lastColorRef.current);
          }}
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
        onPointerUp={() => {
          if (!draggingHue.current) return;
          draggingHue.current = false;
          emitColorCommit(lastColorRef.current);
        }}
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
          onChange={() => emitColorCommit(lastColorRef.current)}
        />
        <input
          type="text"
          class="physics-paint-hex-input"
          value={hexInput}
          aria-label="Brush color hex value"
          placeholder="#103c65"
          disabled={props.disabled}
          onInput={(event) => setHexInput((event.target as HTMLInputElement).value)}
          onBlur={() => {
            if (commitColor(hexInput)) emitColorCommit(lastColorRef.current);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              if (commitColor(hexInput)) emitColorCommit(lastColorRef.current);
            }
          }}
        />
        <button type="button" class="physics-paint-text-button physics-paint-add-swatch" disabled={props.disabled} onClick={addFavorite}>+</button>
      </div>

      <div
        ref={swatchGridRef}
        class="physics-paint-swatch-grid"
        aria-label="Color palette"
        tabIndex={-1}
        onKeyDown={handleSwatchGridKeyDown}
      >
        {swatches.map((swatch) => (
          <div key={swatch} class="physics-paint-swatch-cell">
            <button
              type="button"
              class="physics-paint-swatch"
              style={{ backgroundColor: swatch }}
              title={swatch}
              aria-label={`Use ${swatch}`}
              aria-pressed={selectedSwatch === swatch}
              disabled={props.disabled}
              onClick={(event) => {
                (event.currentTarget as HTMLElement).focus();
                setSelectedSwatch((current) => (current === swatch ? null : swatch));
                if (commitColor(swatch)) emitColorCommit(swatch, { fromSwatch: true });
              }}
            />
          </div>
        ))}
      </div>
    </>
  );
}
