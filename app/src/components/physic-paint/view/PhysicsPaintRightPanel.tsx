import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { signal, type Signal } from '@preact/signals';
import { GripHorizontal, X } from 'lucide-preact';
import type { ToolType } from '@efxlab/efx-physic-paint';
import { hexToRgba, rgbaToHex, rgbToHsv, hsvToRgb } from '../../../lib/colorUtils';
import {
  loadFavoriteColors,
  loadHiddenPaletteColors,
  loadRecentColors,
  saveFavoriteColors,
  saveHiddenPaletteColors,
  saveRecentColors,
} from '../../../lib/paintPreferences';
import { clampOnionCount, clampOnionOpacity, type PhysicsPaintOnionState } from './physicsPaintWorkflowPresentation';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import { PhysicsPaintScriptsPanel, type PhysicsPaintScriptsPanelProps } from './PhysicsPaintScriptsPanel';
import { PhysicsPaintBackgroundClipSection, type PhysicsPaintBackgroundClipSectionProps } from './PhysicsPaintBackgroundClipSection';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import type { BlendMode } from '../../../efx-paint/document/efxPaintDocument';

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
  trackName: string;
  trackOpacity: number;
  trackBlendMode: BlendMode;
  onTrackOpacityChange: (opacity: number) => void;
  onTrackBlendChange: (mode: BlendMode) => void;
  scripts: PhysicsPaintScriptsPanelProps;
  /**
   * 49-06 (S5): the `Background Clip` properties section. Mutually exclusive
   * with the Track section — a selected Bg clip shows the clip section, a
   * track-only selection shows the Track section (UI-SPEC right-panel rows).
   */
  backgroundClipSection?: PhysicsPaintBackgroundClipSectionProps;
  /**
   * 49-06 (UAT round 2): the tool-pane tab signal, owned by the Studio so a
   * Paint track selection returns the panel to Track option and a Bg rail
   * selection opens the Background option tab (a THIRD tab — it never replaces
   * Track option). The right panel reads `.value` in its render body (the
   * 38-11 signal-bypasses-memo pattern) and writes it on tab clicks.
   */
  toolTab?: Signal<'paint' | 'track' | 'background'>;
}

/** The five BlendMode values offered by the track Blend select (TML-04). */
const TRACK_BLEND_MODES: readonly BlendMode[] = ['normal', 'screen', 'multiply', 'overlay', 'add'];

const DEFAULT_PALETTE = ['#103c65', '#2d5be3', '#4caf70', '#f59e0b', '#ff6633', '#ff6666', '#f8fafc', '#111827'];

/** Minimum sidebar section share (%) — every section keeps at least this much
 *  of the flexible height when its neighbors are resized (36.15-12, Gap H-4). */
const MIN_PANE_SPLIT = 15;

/** Default sidebar shares (36.15-13, UAT Gap I-2; trimmed 36.15 Gap J): brush
 *  color 425×0.85=361.25 : tool 213 : scripts/onion/motion 340×0.8=272 — as
 *  ratios of the content height (sidebar height minus the two fixed 32px grab
 *  handles). Proportional shares, not absolute pixels. */
const DEFAULT_SHARE_SUM = 361.25 + 213 + 272;
const DEFAULT_BRUSH_SPLIT = (361.25 / DEFAULT_SHARE_SUM) * 100;
const DEFAULT_TOOL_SPLIT = (213 / DEFAULT_SHARE_SUM) * 100;

export function createPhysicsPaintPaneResizeDrag(options: {
  target: HTMLElement;
  pointerId: number;
  resize: (clientY: number) => void;
}): () => void {
  const { target, pointerId, resize } = options;
  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    target.removeEventListener('pointermove', handleMove);
    target.removeEventListener('pointerup', handleEnd);
    target.removeEventListener('pointercancel', handleEnd);
    target.removeEventListener('lostpointercapture', cleanup);
    if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId);
  };
  const handleMove = (event: PointerEvent) => {
    if (event.pointerId === pointerId) resize(event.clientY);
  };
  const handleEnd = (event: PointerEvent) => {
    if (event.pointerId === pointerId) cleanup();
  };
  target.addEventListener('pointermove', handleMove);
  target.addEventListener('pointerup', handleEnd);
  target.addEventListener('pointercancel', handleEnd);
  target.addEventListener('lostpointercapture', cleanup);
  return cleanup;
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
  step?: number;
  disabled?: boolean;
  /**
   * 48-06 (UAT): commit the value only when the thumb is RELEASED (the native
   * change event), not on every input move. The thumb still follows the mouse
   * through a local signal draft; the parent's value only updates on release.
   * Used by the track opacity slider, whose commit recomposites the surface.
   */
  commitOnRelease?: boolean;
}) {
  // The track opacity (0..1) can arrive out of range from the document;
  // the slider display always clamps to the declared min/max (47-03 TML-04).
  const clampedValue = Math.max(props.min, Math.min(props.max, props.value));
  // 48-06 (UAT): while commitOnRelease is dragging, the thumb position lives in
  // this signal draft (held in a ref so it survives re-renders without React
  // state) so the slider stays responsive; the committed value (and the
  // parent's recomposite) only happens on release.
  const draftRef = useRef(signal<number | null>(null));
  const draft = draftRef.current;
  const displayValue = draft.value ?? clampedValue;
  return (
    <label class="physics-paint-option-row" for={props.id}>
      <span class="physics-paint-right-label">{props.label}</span>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={displayValue}
        disabled={props.disabled}
        onInput={(event) => {
          const next = Number((event.target as HTMLInputElement).value);
          if (props.commitOnRelease) {
            draft.value = next;
          } else {
            props.onChange(next);
          }
        }}
        // 48-06 (UAT): the release commit is on pointerup/keyup/blur — NOT the
        // native change event, which WebKit fires on EVERY move for range
        // inputs (a Tauri/WebKit app would otherwise recomposite per pixel).
        onPointerUp={(event) => {
          if (!props.commitOnRelease) return;
          const next = Number((event.currentTarget as HTMLInputElement).value);
          draft.value = null;
          props.onChange(next);
        }}
        onKeyUp={(event) => {
          if (!props.commitOnRelease) return;
          const next = Number((event.currentTarget as HTMLInputElement).value);
          draft.value = null;
          props.onChange(next);
        }}
        onBlur={(event) => {
          if (!props.commitOnRelease) return;
          const next = Number((event.currentTarget as HTMLInputElement).value);
          draft.value = null;
          props.onChange(next);
        }}
      />
      <output>{displayValue}{props.suffix ?? ''}</output>
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

// 38-11: the Studio render path mounts this panel through the preact/compat
// memo wrapper in MemoizedPhysicsPaintRightPanel.ts — a startFrame-only
// Studio render feeds referentially stable props (38-11 identity memo in the
// Studio), the default shallow compare returns equal, and Preact skips this
// subtree. Signal-backed controllers (scripts.library/playScript/rotoScript)
// are read internally via .value, so ScriptsPanel signal updates bypass the
// memo and keep flowing.
// 38-11 fix: this module deliberately does NOT import preact/compat (see
// MemoizedPhysicsPaintRightPanel.ts for why). The named export stays the
// directly-callable implementation the palette contract tests invoke.
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
  trackName,
  trackOpacity,
  trackBlendMode,
  onTrackOpacityChange,
  onTrackBlendChange,
  scripts,
  backgroundClipSection,
  toolTab: toolTabSignal,
}: PhysicsPaintRightPanelProps) {
  recordPhysicsPaintPerformanceCounter('render.rightPanelImpl');
  // 49-06 (S5): the selected Bg clip id drives the Background-tab exclusivity.
  // The signal read subscribes this memoized panel to selection changes (the
  // 38-11 signal-bypasses-memo pattern) so a rail click flips the section.
  const selectedBackgroundClipId = backgroundClipSection?.selectedBackgroundClipId.value ?? null;
  const [hexInput, setHexInput] = useState(color);
  const [recentColors, setRecentColors] = useState<string[]>([]);
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [hiddenPaletteColors, setHiddenPaletteColors] = useState<string[]>([]);
  // Scripts is the FIRST tab of its group and default-open (36.15-11, UAT
  // Gap G-4).
  const [optionsTab, setOptionsTab] = useState<'scripts' | 'onion' | 'motion'>('scripts');
  // 47 UAT: the tool pane's Paint/Track tabs are MANUAL ONLY — tool changes
  // and paint activity never move the tab (an earlier auto-select fought a
  // periodic paint-revision event and reverted the user's choice ~1s later).
  // 49-06 (UAT round 2): the tab signal is Studio-owned so a Paint track
  // selection returns to Track option and a Bg rail selection opens the
  // Background option tab. A selected Bg clip FORCES the Background tab; the
  // Paint/Track tabs stay manual otherwise.
  const toolTab = toolTabSignal?.value ?? 'paint';
  // A selected Bg clip FORCES the Background tab; a stale 'background' tab with
  // no selection (e.g. the clip was deleted) falls back to Track option.
  const effectiveToolTab = selectedBackgroundClipId ? 'background' : (toolTab === 'background' ? 'track' : toolTab);
  const setToolTab = (tab: 'paint' | 'track' | 'background') => {
    if (toolTabSignal) toolTabSignal.value = tab;
  };
  // Clicking a Paint/Track tab while a Bg clip is selected clears the selection
  // so the click is responsive (the Background tab is forced by the selection).
  const selectToolTab = (tab: 'paint' | 'track') => {
    setToolTab(tab);
    if (backgroundClipSection) backgroundClipSection.selectedBackgroundClipId.value = null;
  };
  // Three resizable sections (36.15-12, UAT Gap H-4; default shares from
  // 36.15-13 Gap I-2, trimmed by Gap J): brush color, tool, and
  // Scripts/Onion/Motion take 361.25:213:272 of the content height by default;
  // the scripts section takes the remaining 100 - brushSplit - toolSplit.
  const [brushSplit, setBrushSplit] = useState(DEFAULT_BRUSH_SPLIT);
  const [toolSplit, setToolSplit] = useState(DEFAULT_TOOL_SPLIT);
  const previousColorRef = useRef(color);
  const paneLayoutRef = useRef<HTMLDivElement>(null);
  const activePaneResizeCleanupRef = useRef<(() => void) | null>(null);
  const colorBoxRef = useRef<HTMLCanvasElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingColorBox = useRef(false);
  const draggingHue = useRef(false);

  // Scripts is default-open: run the same project scripts folder scan that
  // clicking the Scripts tab performs (36.15-11, UAT Gap G-4).
  const enterScripts = scripts.library.enterScripts;
  useEffect(() => {
    void enterScripts();
  }, [enterScripts]);

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

  useEffect(() => () => {
    activePaneResizeCleanupRef.current?.();
    activePaneResizeCleanupRef.current = null;
  }, []);

  useEffect(() => {
    if (previousColorRef.current === color) return;
    previousColorRef.current = color;
    setHexInput(color);
  }, [color]);

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

  const startPaneResize = useCallback((event: PointerEvent, handle: 'brush' | 'tool') => {
    event.preventDefault();
    const layout = paneLayoutRef.current;
    if (!layout) return;
    activePaneResizeCleanupRef.current?.();
    const target = event.currentTarget as HTMLElement;
    const rect = layout.getBoundingClientRect();
    target.setPointerCapture(event.pointerId);
    const startBrush = brushSplit;
    const startTool = toolSplit;

    const resize = (clientY: number) => {
      const split = ((clientY - rect.top) / rect.height) * 100;
      if (handle === 'brush') {
        // Handle 1 resizes its two neighbors (brush/tool); scripts is untouched.
        const total = startBrush + startTool;
        const nextBrush = Math.max(MIN_PANE_SPLIT, Math.min(total - MIN_PANE_SPLIT, split));
        setBrushSplit(nextBrush);
        setToolSplit(total - nextBrush);
      } else {
        // Handle 2 resizes tool/scripts; the brush section is untouched.
        const nextTool = Math.max(MIN_PANE_SPLIT, Math.min(100 - startBrush - MIN_PANE_SPLIT, split - startBrush));
        setToolSplit(nextTool);
      }
    };
    resize(event.clientY);
    const cleanup = createPhysicsPaintPaneResizeDrag({ target, pointerId: event.pointerId, resize });
    activePaneResizeCleanupRef.current = () => {
      cleanup();
      if (activePaneResizeCleanupRef.current) activePaneResizeCleanupRef.current = null;
    };
  }, [brushSplit, toolSplit]);

  const normalizedFavoriteColors = favoriteColors
    .map(normalizeHexInput)
    .filter((item): item is string => item !== null);
  const hiddenPaletteColorSet = new Set(hiddenPaletteColors);
  const swatches = [...normalizedFavoriteColors].reverse().concat(DEFAULT_PALETTE, recentColors)
    .map(normalizeHexInput)
    .filter((item): item is string => item !== null)
    .filter((item, index, source) => source.indexOf(item) === index)
    .filter((item) => !hiddenPaletteColorSet.has(item));

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
      <div
        ref={paneLayoutRef}
        class="physics-paint-right-pane-layout"
        style={{ gridTemplateRows: `minmax(0, ${brushSplit}fr) 32px minmax(0, ${toolSplit}fr) 32px minmax(0, ${100 - brushSplit - toolSplit}fr)` }}
      >
        <div class="physics-paint-right-pane physics-paint-right-pane-primary">
          <SidebarScrollArea class="physics-paint-right-pane-scroll-area" interactive>
            <div class="physics-paint-right-pane-content">
          <section class="physics-paint-right-section physics-paint-single-tab-section">
          <div class="physics-paint-options-tab-panel physics-paint-single-tab-panel">
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
                <div key={swatch} class="physics-paint-swatch-cell">
                  <button
                    type="button"
                    class="physics-paint-swatch"
                    style={{ backgroundColor: swatch }}
                    title={swatch}
                    aria-label={`Use ${swatch}`}
                    disabled={engineControlsDisabled}
                    onClick={() => commitColor(swatch)}
                  />
                  <button
                    type="button"
                    class="physics-paint-swatch-remove"
                    title={`Remove ${swatch} from palette`}
                    aria-label={`Remove ${swatch} from palette`}
                    disabled={engineControlsDisabled}
                    onClick={() => removePaletteColor(swatch)}
                  >
                    <X aria-hidden="true" size={10} strokeWidth={2.4} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          </section>
            </div>
          </SidebarScrollArea>
        </div>

        <div
          class="physics-paint-right-pane-resizer"
          role="separator"
          aria-label="Resize brush color and tool sections"
          aria-orientation="horizontal"
          aria-valuemin={15}
          aria-valuemax={Math.round(brushSplit + toolSplit - MIN_PANE_SPLIT)}
          aria-valuenow={Math.round(brushSplit)}
          tabIndex={0}
          onPointerDown={(event) => startPaneResize(event as unknown as PointerEvent, 'brush')}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const delta = event.key === 'ArrowDown' ? 5 : -5;
            const total = brushSplit + toolSplit;
            const nextBrush = Math.max(MIN_PANE_SPLIT, Math.min(total - MIN_PANE_SPLIT, brushSplit + delta));
            setBrushSplit(nextBrush);
            setToolSplit(total - nextBrush);
          }}
        >
          <GripHorizontal aria-hidden="true" size={18} strokeWidth={1.8} />
        </div>

        <div class="physics-paint-right-pane physics-paint-right-pane-tools">
          <div class="physics-paint-options-tabs physics-paint-options-tabs-tool" role="tablist" aria-label="Physics Paint tool option panels">
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-paint-option${effectiveToolTab === 'paint' ? ' active' : ''}`}
            role="tab"
            aria-selected={effectiveToolTab === 'paint'}
            onClick={() => selectToolTab('paint')}
          >
            Paint option
          </button>
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-track-option${effectiveToolTab === 'track' ? ' active' : ''}`}
            role="tab"
            aria-selected={effectiveToolTab === 'track'}
            onClick={() => selectToolTab('track')}
          >
            Track option
          </button>
          {/* 49-06 (UAT round 2): the Background option tab is a THIRD tab shown
              only while a Bg clip is selected — it never replaces Track option.
              A selected clip forces it active; selecting a Paint track (or
              clicking Paint/Track) clears the selection and returns to Track. */}
          {selectedBackgroundClipId ? (
            <button
              type="button"
              class="physics-paint-options-tab physics-paint-tab-background-option active"
              role="tab"
              aria-selected
              onClick={() => setToolTab('background')}
            >
              Background option
            </button>
          ) : null}
      </div>
          <SidebarScrollArea class="physics-paint-right-pane-scroll-area" interactive>
            <div class="physics-paint-right-pane-content">
      <section class="physics-paint-right-section physics-paint-options-tabs-section">
        {effectiveToolTab === 'paint' ? (
          <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-tool" role="tabpanel" aria-label="Paint options">
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
          </div>
        ) : effectiveToolTab === 'background' ? (
          // 49-06 (S5): a selected Bg clip shows the Background Clip properties
          // section in its OWN tab. Keyed by clip id so a selection change
          // remounts the section with fresh draft state (no effect-driven sync).
          <PhysicsPaintBackgroundClipSection key={selectedBackgroundClipId} {...backgroundClipSection!} />
        ) : (
          <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-track" role="tabpanel" aria-label="Track options">
            <div class="physics-paint-option-group">
              <span class="physics-paint-right-label">Track: {trackName}</span>
              <PanelSlider id="physics-track-opacity" label="Opacity" min={0} max={1} step={0.01} value={trackOpacity} onChange={onTrackOpacityChange} commitOnRelease />
              <label class="physics-paint-option-row" for="physics-track-blend">
                <span class="physics-paint-right-label">Blend</span>
                <select
                  id="physics-track-blend"
                  class="physics-paint-roto-interpolation-select"
                  value={trackBlendMode}
                  onChange={(event) => onTrackBlendChange((event.currentTarget as HTMLSelectElement).value as BlendMode)}
                >
                  {TRACK_BLEND_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
          </section>
            </div>
          </SidebarScrollArea>
        </div>

        <div
          class="physics-paint-right-pane-resizer"
          role="separator"
          aria-label="Resize tool and scripts sections"
          aria-orientation="horizontal"
          aria-valuemin={15}
          aria-valuemax={Math.round(100 - brushSplit - MIN_PANE_SPLIT)}
          aria-valuenow={Math.round(toolSplit)}
          tabIndex={0}
          onPointerDown={(event) => startPaneResize(event as unknown as PointerEvent, 'tool')}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
            event.preventDefault();
            const delta = event.key === 'ArrowDown' ? 5 : -5;
            setToolSplit(Math.max(MIN_PANE_SPLIT, Math.min(100 - brushSplit - MIN_PANE_SPLIT, toolSplit + delta)));
          }}
        >
          <GripHorizontal aria-hidden="true" size={18} strokeWidth={1.8} />
        </div>

        <div class="physics-paint-right-pane physics-paint-right-pane-secondary">
          <div class="physics-paint-options-tabs physics-paint-options-tabs-navigation" role="tablist" aria-label="Physics Paint option panels">
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-scripts ${optionsTab === 'scripts' ? 'active' : ''}`}
            role="tab"
            aria-selected={optionsTab === 'scripts'}
            onClick={() => { setOptionsTab('scripts'); void scripts.library.enterScripts(); }}
          >
            Actions
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
      </div>
          <SidebarScrollArea class="physics-paint-right-pane-scroll-area" interactive>
            <div class="physics-paint-right-pane-content">
      <section class="physics-paint-right-section physics-paint-options-tabs-section">
        {optionsTab === 'scripts' ? (
          <PhysicsPaintScriptsPanel {...scripts} />
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
        ) : null}
          </section>
            </div>
          </SidebarScrollArea>
        </div>
      </div>
    </aside>
  );
}
