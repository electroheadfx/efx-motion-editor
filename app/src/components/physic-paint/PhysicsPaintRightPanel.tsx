import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ToolType } from '@efxlab/efx-physic-paint';
import { hexToRgba, rgbaToHex, rgbToHsv } from '../../lib/colorUtils';
import { loadFavoriteColors, loadRecentColors, saveFavoriteColors, saveRecentColors } from '../../lib/paintPreferences';

export interface PhysicsPaintRightPanelProps {
  activeTool: ToolType;
  color: string;
  opacity: number;
  edgeDetail: number;
  pickup: number;
  spread: number;
  smoothing: number;
  eraseStrength: number;
  physicsMode: 'local' | null;
  onColorChange: (color: string, opacity: number) => void;
  onEdgeDetailChange: (value: number) => void;
  onPickupChange: (value: number) => void;
  onSpreadChange: (value: number) => void;
  onSmoothingChange: (value: number) => void;
  onEraseStrengthChange: (value: number) => void;
}

const DEFAULT_PALETTE = ['#103c65', '#2d5be3', '#4caf70', '#f59e0b', '#ff6633', '#ff6666', '#f8fafc', '#111827'];

function normalizeHexInput(value: string): string | null {
  const match = value.trim().match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) hex = hex.split('').map((char) => char + char).join('');
  return `#${hex.slice(0, 6).toLowerCase()}`;
}

function PanelSlider(props: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label class="physics-paint-option-row" for={props.id}>
      <span class="physics-paint-right-label">{props.label}</span>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        value={props.value}
        onInput={(event) => props.onChange(Number((event.target as HTMLInputElement).value))}
      />
      <output>{props.value}{props.suffix ?? ''}</output>
    </label>
  );
}

function SmoothingButton(props: { label: string; value: number; active: boolean; onSelect: (value: number) => void }) {
  return (
    <button
      type="button"
      class={`physics-paint-segmented-button${props.active ? ' active' : ''}`}
      onClick={() => props.onSelect(props.value)}
    >
      {props.label}
    </button>
  );
}

export function PhysicsPaintRightPanel({
  activeTool,
  color,
  opacity,
  edgeDetail,
  pickup,
  spread,
  smoothing,
  eraseStrength,
  physicsMode,
  onColorChange,
  onEdgeDetailChange,
  onPickupChange,
  onSpreadChange,
  onSmoothingChange,
  onEraseStrengthChange,
}: PhysicsPaintRightPanelProps) {
  const [hexInput, setHexInput] = useState(color);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const previousColorRef = useRef(color);

  useEffect(() => {
    void loadRecentColors().then(setRecentColors);
    void loadFavoriteColors().then(setFavoriteColors);
  }, []);

  useEffect(() => {
    if (previousColorRef.current === color) return;
    previousColorRef.current = color;
    setHexInput(color);
  }, [color]);

  const currentRgb = useMemo(() => hexToRgba(color), [color]);
  const currentHex = useMemo(() => rgbaToHex(currentRgb.r, currentRgb.g, currentRgb.b), [currentRgb.b, currentRgb.g, currentRgb.r]);
  const currentHsv = useMemo(() => rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b), [currentRgb.b, currentRgb.g, currentRgb.r]);
  const opacityAlpha = Math.max(0, Math.min(1, opacity / 100));

  const rememberRecent = useCallback((nextColor: string) => {
    void loadRecentColors().then((colors) => {
      const updated = [nextColor, ...colors.filter((item) => item !== nextColor)].slice(0, 16);
      void saveRecentColors(updated);
      setRecentColors(updated);
    });
  }, []);

  const commitColor = useCallback((nextColor: string, nextOpacity = opacity) => {
    const normalized = normalizeHexInput(nextColor);
    if (!normalized) {
      setHexInput(currentHex);
      return;
    }
    setHexInput(normalized);
    rememberRecent(normalized);
    onColorChange(normalized, nextOpacity);
  }, [currentHex, onColorChange, opacity, rememberRecent]);

  const addFavorite = useCallback(() => {
    void loadFavoriteColors().then((colors) => {
      if (colors.includes(currentHex)) return;
      const updated = [...colors, currentHex].slice(-24);
      void saveFavoriteColors(updated);
      setFavoriteColors(updated);
    });
  }, [currentHex]);

  const swatches = [...DEFAULT_PALETTE, ...favoriteColors, ...recentColors]
    .filter((item, index, source) => source.indexOf(item) === index)
    .slice(0, 24);

  return (
    <aside class="physics-paint-right-panel" aria-label="Physics Paint color and tool options">
      <section class="physics-paint-right-section">
        <div class="physics-paint-section-heading">Brush color</div>
        <div class="physics-paint-color-preview" aria-label="Lightweight brush color blend preview">
          <div
            class="physics-paint-color-preview-swatch"
            style={{
              background: `radial-gradient(circle at 36% 32%, rgba(255,255,255,${0.22 * opacityAlpha}), transparent 28%), ${currentHex}`,
              opacity: String(opacityAlpha),
            }}
          />
          <span class="physics-paint-color-preview-label">{Math.round(opacity)}%</span>
        </div>

        <div class="physics-paint-color-input-row">
          <input
            type="color"
            class="physics-paint-color-chip"
            value={currentHex}
            aria-label="Brush color"
            onInput={(event) => commitColor((event.target as HTMLInputElement).value)}
          />
          <input
            type="text"
            class="physics-paint-hex-input"
            value={hexInput}
            aria-label="Brush color hex value"
            placeholder="#103c65"
            onInput={(event) => setHexInput((event.target as HTMLInputElement).value)}
            onBlur={() => commitColor(hexInput)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitColor(hexInput);
            }}
          />
          <button type="button" class="physics-paint-text-button" onClick={addFavorite}>Save swatch</button>
        </div>

        <div class="physics-paint-swatch-grid" aria-label="Color palette">
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              class="physics-paint-swatch"
              style={{ backgroundColor: swatch }}
              title={swatch}
              aria-label={`Use ${swatch}`}
              onClick={() => commitColor(swatch)}
            />
          ))}
        </div>
      </section>

      <section class="physics-paint-right-section">
        <div class="physics-paint-section-heading">Tool options</div>
        <PanelSlider id="physics-edge-detail" label="Shape detail" min={0} max={100} value={edgeDetail} onChange={onEdgeDetailChange} />
        {activeTool === 'paint' ? <PanelSlider id="physics-pickup" label="Pickup" min={0} max={100} value={pickup} onChange={onPickupChange} /> : null}
        {physicsMode === 'local' ? <PanelSlider id="physics-spread" label="Spread" min={0} max={100} value={spread} onChange={onSpreadChange} /> : null}
        {activeTool === 'erase' ? <PanelSlider id="physics-erase-strength" label="Erase strength" min={0} max={100} value={eraseStrength} onChange={onEraseStrengthChange} /> : null}

        <div class="physics-paint-option-group">
          <span class="physics-paint-right-label">Brush smoothing</span>
          <div class="physics-paint-segmented-row" role="group" aria-label="Brush smoothing">
            <SmoothingButton label="Off" value={0} active={smoothing === 0} onSelect={onSmoothingChange} />
            <SmoothingButton label="Soft" value={1} active={smoothing === 1} onSelect={onSmoothingChange} />
            <SmoothingButton label="Med" value={2} active={smoothing === 2} onSelect={onSmoothingChange} />
            <SmoothingButton label="High" value={3} active={smoothing === 3} onSelect={onSmoothingChange} />
          </div>
        </div>
      </section>

      <section class="physics-paint-right-section physics-paint-readout-card">
        <div class="physics-paint-section-heading">Current mix</div>
        <div class="physics-paint-readout-row"><span>HEX</span><strong>{currentHex.toUpperCase()}</strong></div>
        <div class="physics-paint-readout-row"><span>Opacity</span><strong>{Math.round(opacity)}%</strong></div>
        <div class="physics-paint-readout-row"><span>Hue</span><strong>{Math.round(currentHsv.h * 360)}°</strong></div>
      </section>
    </aside>
  );
}
