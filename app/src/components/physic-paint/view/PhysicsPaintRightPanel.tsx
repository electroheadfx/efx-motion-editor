import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import { type Signal } from '@preact/signals';
import { GripHorizontal } from 'lucide-preact';
import type { ToolType } from '@efxlab/efx-physic-paint';
import { type PhysicsPaintOnionState } from './physicsPaintWorkflowPresentation';
import { SidebarScrollArea } from '../../sidebar/SidebarScrollArea';
import { PhysicsPaintScriptsPanel, type PhysicsPaintScriptsPanelProps } from './PhysicsPaintScriptsPanel';
import { PhysicsPaintBackgroundClipSection, type PhysicsPaintBackgroundClipSectionProps } from './PhysicsPaintBackgroundClipSection';
import { PhysicsPaintAudioListSection, type AudioSectionPorts } from './PhysicsPaintAudioListSection';
import { recordPhysicsPaintPerformanceCounter } from '../performance/physicsPaintPerformanceTrace';
import type { BlendMode } from '../../../efx-paint/document/efxPaintDocument';
import { activeModule } from '../../shared/activeModule';
import { SliderStepper } from '../../shared/SliderStepper';
import { aquarelleParams } from './aquarelleRecordState';
import { WatercolorModuleSection } from './WatercolorModuleSection';
import { BrushModuleSection } from './BrushModuleSection';
import { RightPanelColorTab } from './RightPanelColorTab';
import { RightPanelBrushTab } from './RightPanelBrushTab';
import { RightPanelSettingsTab } from './RightPanelSettingsTab';
import { RightPanelPaperTab } from './RightPanelPaperTab';
import { RightPanelTrackTab } from './RightPanelTrackTab';
import { RightPanelOnionTab, RightPanelMotionTab } from './RightPanelOnionMotionTabs';
import type { StudioBackgroundMode } from '../engine/physicsPaintStudioSettings';

export interface PhysicsPaintPlayWiggleSettings {
  strokeDeformation: number;
  strokePosition: number;
}

export interface PhysicsPaintRightPanelProps {
  activeTool: ToolType;
  color: string;
  opacity: number;
  /**
   * 261018-f15 C2: the Paint-tab size/opacity pair is a second home over the
   * SAME state the top bar writes (setAquarelleParam size/load in watercolor,
   * setBrushSize/setBrushOpacity otherwise). These are the top-bar routers —
   * never a second setter.
   */
  brushSize: number;
  onBrushSizeChange: (value: number) => void;
  onOpacityChange: (value: number) => void;
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
  /** History actions — routed from the tool rail; the retired top-pane Actions tab is gone (261018-cy1). */
  onUndo: () => void;
  onRedo: () => void;
  onClearFrame: () => void;
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
   * Track option). 261008-ryq: the Audio tab is a fourth, manual tab. The
   * right panel reads `.value` in its render body (the 38-11 signal-bypasses-
   * memo pattern) and writes it on tab clicks.
   */
  toolTab?: Signal<'paint' | 'track' | 'background' | 'audio'>;
  /**
   * 261008-ryq Task 1: the sidebar Audio-tab list ports (lazy controller
   * resolution + select/import intents) — identity-stable ref from the Studio
   * (backgroundClipSectionPortsRef precedent).
   */
  audioSectionPorts?: AudioSectionPorts;
  /**
   * 56-05 (D-09..D-12 / PAPER-03) + 261017-vcn I-04 remainder: paper +
   * background display state for the shared-panel Paper section. State lives
   * on the document fond; these are the controls' read/write ports. The Paper
   * tab is the SINGLE home for paper + background (Q6 grain pair at the top,
   * Transparent + White arms, then the locked 13-cell grid).
   */
  paperId?: string;
  background?: StudioBackgroundMode;
  grainStrength?: number;
  grainScale?: number;
  onPaperIdChange?: (id: string) => void;
  onBackgroundChange?: (mode: StudioBackgroundMode) => void;
  onGrainStrengthChange?: (value: number) => void;
  onGrainScaleChange?: (scale: number) => void;
}

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

const TOP_PANE_TAB_LABELS: Readonly<
  Record<'color' | 'brush' | 'settings' | 'paper', string>
> = Object.freeze({
  color: 'Color',
  brush: 'Brush',
  settings: 'Settings',
  paper: 'Paper',
});

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
// 261018-0ox I-10: each tab body lives in its RightPanel*Tab component —
// this shell owns the pane layout, tab row, and tool-pane routing only.
export function PhysicsPaintRightPanel({
  activeTool,
  color,
  opacity,
  brushSize,
  onBrushSizeChange,
  onOpacityChange,
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
  audioSectionPorts,
  toolTab: toolTabSignal,
  paperId,
  background,
  grainStrength,
  grainScale,
  onPaperIdChange,
  onBackgroundChange,
  onGrainStrengthChange,
  onGrainScaleChange,
}: PhysicsPaintRightPanelProps) {
  recordPhysicsPaintPerformanceCounter('render.rightPanelImpl');
  // 49-06 (S5): the selected Bg clip id drives the Background-tab exclusivity.
  // The signal read subscribes this memoized panel to selection changes (the
  // 38-11 signal-bypasses-memo pattern) so a rail click flips the section.
  const selectedBackgroundClipId = backgroundClipSection?.selectedBackgroundClipId.value ?? null;
  // 261018-cy1: the top-pane tab list is mode-derived. Brush mode offers
  // Color + Paper; watercolor mode adds Brush + Settings (I-11 / D). The
  // retired top-pane Actions entry is gone in every mode (the bottom-pane
  // scripts tab keeps its label).
  const isWatercolorModule = activeModule.value === 'watercolor';
  const topPaneTabs = (
    isWatercolorModule
      ? ['color', 'brush', 'settings', 'paper']
      : ['color', 'paper']
  ) as ReadonlyArray<'color' | 'brush' | 'settings' | 'paper'>;
  // A stale 'brush'/'settings' selection falls back to the Color body when the
  // module leaves watercolor — derived in render, never via an effect.
  const [topPaneTab, setTopPaneTab] =
    useState<'color' | 'brush' | 'settings' | 'paper'>('color');
  const effectiveTopPaneTab: 'color' | 'brush' | 'settings' | 'paper' =
    (topPaneTab === 'brush' || topPaneTab === 'settings') && !isWatercolorModule
      ? 'color'
      : topPaneTab;
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
  const setToolTab = (tab: 'paint' | 'track' | 'background' | 'audio') => {
    if (toolTabSignal) toolTabSignal.value = tab;
  };
  // Clicking a Paint/Track/Audio tab while a Bg clip is selected clears the
  // selection so the click is responsive (the Background tab is forced by the
  // selection).
  const selectToolTab = (tab: 'paint' | 'track' | 'audio') => {
    setToolTab(tab);
    if (backgroundClipSection) backgroundClipSection.selectedBackgroundClipId.value = null;
  };
  // Three resizable sections (36.15-12, UAT Gap H-4; default shares from
  // 36.15-13 Gap I-2, trimmed by Gap J): brush color, tool, and
  // Scripts/Onion/Motion take 361.25:213:272 of the content height by default;
  // the scripts section takes the remaining 100 - brushSplit - toolSplit.
  const [brushSplit, setBrushSplit] = useState(DEFAULT_BRUSH_SPLIT);
  const [toolSplit, setToolSplit] = useState(DEFAULT_TOOL_SPLIT);
  const paneLayoutRef = useRef<HTMLDivElement>(null);
  const activePaneResizeCleanupRef = useRef<(() => void) | null>(null);

  // Scripts is default-open: run the same project scripts folder scan that
  // clicking the Scripts tab performs (36.15-11, UAT Gap G-4).
  const enterScripts = scripts.library.enterScripts;
  useEffect(() => {
    void enterScripts();
  }, [enterScripts]);

  useEffect(() => () => {
    activePaneResizeCleanupRef.current?.();
    activePaneResizeCleanupRef.current = null;
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

  return (
    <aside class="physics-paint-right-panel" aria-label="Physics Paint color and tool options">
      <div
        ref={paneLayoutRef}
        class="physics-paint-right-pane-layout"
        style={{ gridTemplateRows: `minmax(0, ${brushSplit}fr) 32px minmax(0, ${toolSplit}fr) 32px minmax(0, ${100 - brushSplit - toolSplit}fr)` }}
      >
        <div class="physics-paint-right-pane physics-paint-right-pane-primary">
          <div class="physics-paint-options-tabs physics-paint-options-tabs-top" role="tablist" aria-label="Top pane panels">
            {topPaneTabs.map((tab) => (
              <button
                key={tab}
                type="button"
                class={`physics-paint-options-tab physics-paint-tab-top-${tab}${effectiveTopPaneTab === tab ? ' active' : ''}`}
                role="tab"
                aria-selected={effectiveTopPaneTab === tab}
                onClick={() => setTopPaneTab(tab)}
              >
                {TOP_PANE_TAB_LABELS[tab]}
              </button>
            ))}
          </div>
          <SidebarScrollArea class="physics-paint-right-pane-scroll-area" interactive>
            <div class="physics-paint-right-pane-content">
          <section class="physics-paint-right-section physics-paint-single-tab-section">
          {topPaneTab === 'brush' && isWatercolorModule ? (
            <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-flat physics-paint-options-tab-panel-brush" role="tabpanel" aria-label="Brush">
              <RightPanelBrushTab />
            </div>
          ) : topPaneTab === 'settings' && isWatercolorModule ? (
            <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-flat physics-paint-options-tab-panel-settings" role="tabpanel" aria-label="Settings">
              <RightPanelSettingsTab />
            </div>
          ) : topPaneTab === 'paper' ? (
            <div class="physics-paint-options-tab-panel physics-paint-options-tab-panel-flat" role="tabpanel" aria-label="Paper">
              <RightPanelPaperTab
                paperId={paperId}
                background={background}
                grainStrength={grainStrength}
                grainScale={grainScale}
                onPaperIdChange={onPaperIdChange}
                onBackgroundChange={onBackgroundChange}
                onGrainStrengthChange={onGrainStrengthChange}
                onGrainScaleChange={onGrainScaleChange}
                disabled={engineControlsDisabled}
              />
            </div>
          ) : (
          <div class="physics-paint-options-tab-panel physics-paint-single-tab-panel">
            <RightPanelColorTab
              color={color}
              opacity={opacity}
              disabled={engineControlsDisabled}
              onColorChange={onColorChange}
            />
          </div>
          )}
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
            Paint
          </button>
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-track-option${effectiveToolTab === 'track' ? ' active' : ''}`}
            role="tab"
            aria-selected={effectiveToolTab === 'track'}
            onClick={() => selectToolTab('track')}
          >
            Track
          </button>
          {/* 261008-ryq: the Audio tab lists every placed clip (the list moved
              out of the Document sound modal). Manual like Paint/Track — it
              clears a selected Bg clip on click. */}
          <button
            type="button"
            class={`physics-paint-options-tab physics-paint-tab-audio-option${effectiveToolTab === 'audio' ? ' active' : ''}`}
            role="tab"
            aria-selected={effectiveToolTab === 'audio'}
            onClick={() => selectToolTab('audio')}
          >
            Audio
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
            {/* 261018-f15 C2: Brush size + Opacity pair at the TOP of the Paint
                tab — a second home over the SAME handlers the top bar uses
                (write-through, never a second setter). Display rules match the
                top bar: live aquarelle size in watercolor, settings otherwise. */}
            <div class="paint-tab-size-opacity" data-paint-tab-size-opacity style={{ display: 'flex', flexDirection: 'column', gap: '11px', paddingBottom: '8px' }}>
              <SliderStepper
                id="paint-tab-brush-size"
                label="Brush size"
                value={activeModule.value === 'watercolor' ? aquarelleParams.value.size : brushSize}
                step={1}
                min={1}
                max={80}
                ariaLabel="Brush size"
                onChange={onBrushSizeChange}
              />
              <SliderStepper
                id="paint-tab-brush-opacity"
                label="Opacity"
                value={activeModule.value === 'watercolor' ? aquarelleParams.value.load : opacity}
                step={1}
                min={10}
                max={100}
                ariaLabel="Opacity"
                onChange={onOpacityChange}
              />
            </div>
            {/* 56-02 (D-05) / 261017-w4x I-05 (Q3): MODULE-ONLY block — drains
                per activeModule. The shared Opacity option-group left with I-05. */}
            {activeModule.value === 'watercolor' ? (
              <WatercolorModuleSection />
            ) : (
              <BrushModuleSection
                activeTool={activeTool}
                edgeDetail={edgeDetail}
                pickup={pickup}
                spread={spread}
                smoothing={smoothing}
                eraseStrength={eraseStrength}
                physicsMode={physicsMode}
                engineControlsDisabled={engineControlsDisabled}
                onEdgeDetailChange={onEdgeDetailChange}
                onPickupChange={onPickupChange}
                onSpreadChange={onSpreadChange}
                onSmoothingChange={onSmoothingChange}
                onEraseStrengthChange={onEraseStrengthChange}
              />
            )}
          </div>
        ) : effectiveToolTab === 'background' ? (
          // 49-06 (S5): a selected Bg clip shows the Background Clip properties
          // section in its OWN tab. Keyed by clip id so a selection change
          // remounts the section with fresh draft state (no effect-driven sync).
          <PhysicsPaintBackgroundClipSection key={selectedBackgroundClipId} {...backgroundClipSection!} />
        ) : effectiveToolTab === 'audio' ? (
          // 261008-ryq: explicit arm BEFORE the track fallback so the Audio tab
          // can never fall through to Track (T-261008-RYQ-04).
          audioSectionPorts ? <PhysicsPaintAudioListSection ports={audioSectionPorts} /> : null
        ) : (
          <RightPanelTrackTab
            trackName={trackName}
            trackOpacity={trackOpacity}
            trackBlendMode={trackBlendMode}
            onTrackOpacityChange={onTrackOpacityChange}
            onTrackBlendChange={onTrackBlendChange}
          />
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
          {optionsTab === 'scripts' ? (
            <PhysicsPaintScriptsPanel {...scripts} />
          ) : (
          <SidebarScrollArea class="physics-paint-right-pane-scroll-area" interactive>
            <div class="physics-paint-right-pane-content">
      <section class="physics-paint-right-section physics-paint-options-tabs-section">
        {optionsTab === 'onion' ? (
          <RightPanelOnionTab
            onion={onion}
            onionDisabled={onionDisabled}
            onOnionChange={onOnionChange}
          />
        ) : optionsTab === 'motion' ? (
          <RightPanelMotionTab
            playWiggle={playWiggle}
            onPlayWiggleChange={onPlayWiggleChange}
          />
        ) : null}
          </section>
            </div>
          </SidebarScrollArea>
          )}
        </div>
      </div>
    </aside>
  );
}
