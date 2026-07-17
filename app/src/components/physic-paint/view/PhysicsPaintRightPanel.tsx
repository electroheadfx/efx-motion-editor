import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ToolType } from '@efxlab/efx-physic-paint';
import { hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb } from '../../../lib/colorUtils';
import { loadFavoriteColors, loadRecentColors, saveFavoriteColors } from '../../../lib/paintPreferences';
import { clampOnionCount, clampOnionOpacity, type PhysicsPaintApplyStatus, type PhysicsPaintOnionState } from './physicsPaintWorkflowPresentation';
import { PhysicsPaintScriptsPanel, type PhysicsPaintScriptsPanelProps } from './PhysicsPaintScriptsPanel';

export interface PhysicsPaintPlayWiggleSettings {
  strokeDeformation: number;
  strokePosition: number;
}

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
  onion: PhysicsPaintOnionState;
  onionDisabled?: boolean;
  engineControlsDisabled?: boolean;
  playWiggle: PhysicsPaintPlayWiggleSettings;
  onColorChange: (color: string, opacity: number) => void;
  onEdgeDetailChange: (value: number) => void;
  onPickupChange: (value: number) => void;
  onSpreadChange: (value: number) => void;
  onSmoothingChange: (value: number) => void;
  onEraseStrengthChange: (value: number) => void;
  onOnionChange: (onion: PhysicsPaintOnionState) => void;
  onPlayWiggleChange: (wiggle: PhysicsPaintPlayWiggleSettings) => void;
  devExportEnabled?: boolean;
  devExportBusy?: boolean;
  applyStatus?: PhysicsPaintApplyStatus;
  applyMessage?: string | null;
  error?: string | null;
  onExportDebugProof?: () => void;
  onSaveState: () => void;
  onLoadState: (event: Event) => void;
  scripts: PhysicsPaintScriptsPanelProps;
}

const DEFAULT_PALETTE = ['#103c65', '#2d5be3', '#4caf70', '#f59e0b', '#ff6633', '#ff6666', '#f8fafc', '#111827'];

export function getPhysicsPaintSessionControlState(mutationLocked: boolean) {
  return {
    saveDisabled: mutationLocked,
    loadDisabled: mutationLocked,
    loadClass: `physics-paint-text-button physics-paint-load-state${mutationLocked ? ' disabled-control' : ''}`,
  };
}

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
  disabled?: boolean;
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
        disabled={props.disabled}
        onInput={(event) => props.onChange(Number((event.target as HTMLInputElement).value))}
      />
      <output>{props.value}{props.suffix ?? ''}</output>
    </label>
  );
}

function clampWiggleValue(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(numeric)));
}

function SmoothingButton(props: { label: string; value: number; active: boolean; disabled?: boolean; onSelect: (value: number) => void }) {
  return (
    <button
      type="button"
      class={`physics-paint-segmented-button${props.active ? ' active' : ''}`}
      disabled={props.disabled}
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
  onion,
  onionDisabled = false,
  engineControlsDisabled = false,
  playWiggle,
  onColorChange,
  onEdgeDetailChange,
  onPickupChange,
  onSpreadChange,
  onSmoothingChange,
  onEraseStrengthChange,
  onOnionChange,
  onPlayWiggleChange,
  devExportEnabled = false,
  devExportBusy = false,
  applyStatus = 'idle',
  applyMessage,
  error,
  onExportDebugProof,
  onSaveState,
  onLoadState,
  scripts,
}: PhysicsPaintRightPanelProps) {
  const [hexInput, setHexInput] = useState(color);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [colorTab, setColorTab] = useState<'brush' | 'log'>('brush');
  const [optionsTab, setOptionsTab] = useState<'tool' | 'onion' | 'motion' | 'scripts'>('tool');
  const previousColorRef = useRef(color);
  const colorBoxRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingColorBox = useRef(false);
  const draggingHue = useRef(false);
  const logVisible = Boolean(devExportEnabled || applyMessage || error || applyStatus === 'applying');
  const sessionControls = getPhysicsPaintSessionControlState(engineControlsDisabled);

  useEffect(() => {
    void loadRecentColors().then(setRecentColors);
    void loadFavoriteColors().then(setFavoriteColors);
  }, []);

  useEffect(() => {
    if (previousColorRef.current === color) return;
    previousColorRef.current = color;
    setHexInput(color);
  }, [color]);

  useEffect(() => {
    if (!logVisible && colorTab === 'log') setColorTab('brush');
  }, [colorTab, logVisible]);

  const currentRgb = useMemo(() => hexToRgba(color), [color]);
  const currentHex = useMemo(() => rgbaToHex(currentRgb.r, currentRgb.g, currentRgb.b), [currentRgb.b, currentRgb.g, currentRgb.r]);
  const currentHsv = useMemo(() => rgbToHsv(currentRgb.r, currentRgb.g, currentRgb.b), [currentRgb.b, currentRgb.g, currentRgb.r]);
  useEffect(() => {
    const canvas = colorBoxRef.current;
    const context = canvas?.getContext('2d');
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

  const commitColor = useCallback((nextColor: string, nextOpacity = opacity) => {
    const normalized = normalizeHexInput(nextColor);
    if (!normalized) {
      setHexInput(currentHex);
      return;
    }
    setHexInput(normalized);
    onColorChange(normalized, nextOpacity);
  }, [currentHex, onColorChange, opacity]);

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

  const onionCount = clampOnionCount(onion.count);
  const onionOpacity = clampOnionOpacity(onion.opacity);
  const updateOnion = (next: Partial<PhysicsPaintOnionState>) => {
    onOnionChange({
      ...onion,
      ...next,
      count: clampOnionCount(next.count ?? onion.count),
      opacity: clampOnionOpacity(next.opacity ?? onion.opacity),
    });
  };
  const updatePlayWiggle = (key: keyof PhysicsPaintPlayWiggleSettings, value: unknown) => {
    onPlayWiggleChange({
      ...playWiggle,
      [key]: clampWiggleValue(value),
    });
  };

  return (
    <aside class="physics-paint-right-panel" aria-label="Physics Paint color and tool options">
      <section class="physics-paint-right-section physics-paint-single-tab-section">
        <div class="physics-paint-options-tabs physics-paint-single-tab" role="tablist" aria-label="Brush color panel">
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-brush ${colorTab === 'brush' ? 'active' : ''}`}
            role="tab"
            aria-selected={colorTab === 'brush'}
            onClick={() => setColorTab('brush')}
          >
            Brush color
          </button>
          {logVisible ? (
            <button
              type="button"
              class={`physics-paint-options-tab physics-paint-tab-log ${colorTab === 'log' ? 'active' : ''}`}
              role="tab"
              aria-selected={colorTab === 'log'}
              onClick={() => setColorTab('log')}
            >
              LOG
            </button>
          ) : null}
        </div>
        {colorTab === 'brush' ? (
          <div class="physics-paint-options-tab-panel physics-paint-single-tab-panel" role="tabpanel" aria-label="Brush color">
            <div class="physics-paint-color-picker" aria-label="Brush color picker">
              <canvas
                ref={colorBoxRef}
                width={232}
                height={160}
                class="physics-paint-color-box"
                aria-disabled={engineControlsDisabled}
                style={{ pointerEvents: engineControlsDisabled ? 'none' : undefined }}
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
              aria-disabled={engineControlsDisabled}
              style={{ pointerEvents: engineControlsDisabled ? 'none' : undefined }}
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
                disabled={engineControlsDisabled}
                onInput={(event) => commitColor((event.target as HTMLInputElement).value)}
              />
              <input
                type="text"
                class="physics-paint-hex-input"
                value={hexInput}
                aria-label="Brush color hex value"
                placeholder="#103c65"
                disabled={engineControlsDisabled}
                onInput={(event) => setHexInput((event.target as HTMLInputElement).value)}
                onBlur={() => commitColor(hexInput)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitColor(hexInput);
                }}
              />
              <button type="button" class="physics-paint-text-button physics-paint-add-swatch" disabled={engineControlsDisabled} onClick={addFavorite}>+</button>
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
                  disabled={engineControlsDisabled}
                  onClick={() => commitColor(swatch)}
                />
              ))}
            </div>
          </div>
        ) : logVisible ? (
          <div class="physics-paint-options-tab-panel physics-paint-single-tab-panel physics-paint-log-tab-panel" role="tabpanel" aria-label="Log">
            <span class="physics-paint-right-label">Log</span>
            <div class="physics-paint-log-messages" aria-live="polite">
              {applyStatus === 'applying' ? <p class="physics-paint-log-message applying">Applying...</p> : null}
              {applyMessage ? <p class={`physics-paint-log-message ${applyStatus}`}>{applyMessage}</p> : null}
              {error ? <p class="physics-paint-log-message error">{error}</p> : null}
            </div>
            {devExportEnabled ? (
              <button type="button" class="physics-paint-text-button physics-paint-dev-export" disabled={devExportBusy || !onExportDebugProof} onClick={onExportDebugProof}>
                Export PNGs + manifest
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      <div class="physics-paint-options-tabs physics-paint-options-tabs-navigation" role="tablist" aria-label="Physics Paint option panels">
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-tool ${optionsTab === 'tool' ? 'active' : ''}`}
            role="tab"
            aria-selected={optionsTab === 'tool'}
            onClick={() => setOptionsTab('tool')}
          >
            Tool
          </button>
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-onion ${optionsTab === 'onion' ? 'active' : ''}`}
            role="tab"
            aria-selected={optionsTab === 'onion'}
            onClick={() => setOptionsTab('onion')}
          >
            Onion
          </button>
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-motion ${optionsTab === 'motion' ? 'active' : ''}`}
            role="tab"
            aria-selected={optionsTab === 'motion'}
            onClick={() => setOptionsTab('motion')}
          >
            Motion
          </button>
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-scripts ${optionsTab === 'scripts' ? 'active' : ''}`}
            role="tab"
            aria-selected={optionsTab === 'scripts'}
            onClick={() => { setOptionsTab('scripts'); void scripts.library.enterScripts(); }}
          >
            Scripts
          </button>
      </div>

      <section class="physics-paint-right-section physics-paint-options-tabs-section">
        {optionsTab === 'tool' ? (
          <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-tool" role="tabpanel" aria-label="Tool">
            <PanelSlider id="physics-edge-detail" label="Shape detail" min={0} max={100} value={edgeDetail} onChange={onEdgeDetailChange} disabled={engineControlsDisabled} />
            {activeTool === 'paint' ? <PanelSlider id="physics-pickup" label="Color blending" min={0} max={100} value={pickup} onChange={onPickupChange} disabled={engineControlsDisabled} /> : null}
            {physicsMode === 'local' ? <PanelSlider id="physics-spread" label="Spread" min={0} max={100} value={spread} onChange={onSpreadChange} disabled={engineControlsDisabled} /> : null}
            {activeTool === 'erase' ? <PanelSlider id="physics-erase-strength" label="Erase strength" min={0} max={100} value={eraseStrength} onChange={onEraseStrengthChange} disabled={engineControlsDisabled} /> : null}

            <div class="physics-paint-option-group">
              <span class="physics-paint-right-label">Brush smoothing</span>
              <div class="physics-paint-segmented-row" role="group" aria-label="Brush smoothing">
                <SmoothingButton label="Off" value={0} disabled={engineControlsDisabled} active={smoothing === 0} onSelect={onSmoothingChange} />
                <SmoothingButton label="Soft" value={1} disabled={engineControlsDisabled} active={smoothing === 1} onSelect={onSmoothingChange} />
                <SmoothingButton label="Med" value={2} disabled={engineControlsDisabled} active={smoothing === 2} onSelect={onSmoothingChange} />
                <SmoothingButton label="High" value={3} disabled={engineControlsDisabled} active={smoothing === 3} onSelect={onSmoothingChange} />
              </div>
            </div>
            <div class="physics-paint-option-actions">
              <button class="physics-paint-text-button" disabled={sessionControls.saveDisabled} onClick={onSaveState}>Save state</button>
              <label class={sessionControls.loadClass} aria-disabled={sessionControls.loadDisabled}>
                Load state
                <input type="file" accept=".json" disabled={sessionControls.loadDisabled} onChange={onLoadState} />
              </label>
            </div>
          </div>
        ) : optionsTab === 'onion' ? (
          <div class={`physics-paint-options-tab-panel physics-paint-options-tab-panel-onion physics-paint-onion-tab-panel${onionDisabled ? ' disabled-control' : ''}`} role="tabpanel" aria-label="Onion skin controls">
            <label class="physics-paint-onion-toggle-row">
              <input type="checkbox" checked={onion.enabled} disabled={onionDisabled} onChange={(event) => updateOnion({ enabled: (event.currentTarget as HTMLInputElement).checked })} />
              <span>Onion skin</span>
            </label>
            <div class="physics-paint-onion-toggle-grid">
              <label><input type="checkbox" checked={onion.previous} disabled={onionDisabled} onChange={(event) => updateOnion({ previous: (event.currentTarget as HTMLInputElement).checked })} /> Previous</label>
              <label><input type="checkbox" checked={onion.next} disabled={onionDisabled} onChange={(event) => updateOnion({ next: (event.currentTarget as HTMLInputElement).checked })} /> Next</label>
            </div>
            <label class="physics-paint-option-row physics-paint-onion-value-row" for="physics-onion-count">
              <span class="physics-paint-right-label">Onion frames</span>
              <input id="physics-onion-count" type="range" min={1} max={3} value={onionCount} disabled={onionDisabled} onInput={(event) => updateOnion({ count: Number((event.currentTarget as HTMLInputElement).value) })} />
              <output>{onionCount}</output>
            </label>
            <label class="physics-paint-option-row physics-paint-onion-value-row" for="physics-onion-opacity">
              <span class="physics-paint-right-label">Onion value</span>
              <input id="physics-onion-opacity" type="range" min={0} max={100} step={1} value={onionOpacity} disabled={onionDisabled} onInput={(event) => updateOnion({ opacity: Number((event.currentTarget as HTMLInputElement).value) })} />
              <output>{onionOpacity}%</output>
            </label>
          </div>
        ) : optionsTab === 'motion' ? (
          <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-motion" role="tabpanel" aria-label="Motion controls">
            <PanelSlider id="physics-play-deform" label="Deform" min={0} max={100} value={playWiggle.strokeDeformation} onChange={(value) => updatePlayWiggle('strokeDeformation', value)} />
            <PanelSlider id="physics-play-move" label="Move" min={0} max={100} value={playWiggle.strokePosition} onChange={(value) => updatePlayWiggle('strokePosition', value)} />
          </div>
        ) : (
          <PhysicsPaintScriptsPanel {...scripts} />
        )}
      </section>
    </aside>
  );
}
