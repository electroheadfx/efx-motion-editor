// ============================================================
//  AquarelleGlobalsPanel — the tool dropdown, the brush-response
//  dropdown, the context-driven parameter groups + Reset. This is the
//  Paint-tab content.
//
//  Phase 64 (D-01/D-07/D-22): the panel LEADS with Reset, then the
//  dropdown, then the tab's fixed top rows (Brush size and Grain,
//  supplied by the right panel), then the context groups.
//  2026-11-27 (artist's live ruling): the Medium dropdown becomes the
//  five-tool selector (Medium · Watercolor · Water · Pen · Eraser) with
//  a single label, and a second dropdown below it picks the BRUSH
//  RESPONSE the active tool exposes. quick 261122-gys stays true: a
//  re-pick of the ACTIVE paint tool restores a drifted medium record
//  (pickAquarelleMedium); a switch applies the record inside
//  selectAquarellePaintTool. The selected names are shown truthfully,
//  with no "edited" marker.
//
//  quick 261121-mtu: the flat twelve-row list is gone. The rows
//  and their seven group headings come from ONE pure selector,
//  `visibleAquarelleParamGroups(activeTool, selectedMediumId)`
//  (`aquarelleParamVisibility.ts`, spec §8). The law is the
//  ACTIVE TOOL plus the ACTIVE MEDIUM, never the tool alone:
//  the paint tools show the medium's rows (Refill hidden for
//  acrylic AND watercolor — decision B), the Water tool shows its
//  fluid set, and the Eraser shows the Lift row alone. Group
//  headings render only when non-empty, in the fixed order
//  Medium · Paint & reservoir · Drying · Noise · Watercolor only ·
//  Relief · Eraser (2026-11-27: the Transparency group is retired — one
//  global Transparency row now sits in Paint & reservoir under Pickup;
//  Relief is the Medium (acrylic) context's Emboss section).
//
//  Param keys stay water/load/flow/bleed/edge/granulation/dry/
//  viscosity/body/feather/pickup/refill/emboss — `body` rides the
//  bag and the Reset law but has NO row (post-UAT 2026-11-22: the
//  compositor's alpha is max(pigment-darkness, cover), so Body is
//  invisible for every pigmented paint and only reads on near-white
//  pigments). `size` is NOT here — the shared Size slider owns it
//  (D-05). Hiding a row never removes its key: Reset restores the
//  active medium record's full fourteen-key set.
//
//  Reset (quick 261122-gys) restores the ACTIVE MEDIUM RECORD — all
//  fourteen keys including `wetSeconds` — through the one
//  record-path seam (setAquarelleParam), then forwards the same
//  values as ONE selection batch (one undo entry; no selection is a
//  no-op). The ×100 playground DEFAULT_PARAMS law is retired. Never
//  writes size (top-bar Brush size owns it, Q1a / T-261017-WMW-01)
//  and never writes lift. No per-medium special case — the acrylic
//  Refill 0 lives in its record, not in a Reset branch.
//
//  The Brush response block lives in BrushResponsePanel (I-02).
// ============================================================

import type { ComponentChildren, TargetedMouseEvent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { DEFAULT_MEDIUM_ID, MEDIUMS, mediumById } from '@efxlab/efx-watercolor';
import { RuleSectionHeader } from '../../shared/RuleSectionHeader';
import { SliderStepper } from '../../shared/SliderStepper';
import { AQUARELLE_TOOL_LABELS, AQUARELLE_TOOL_ORDER } from './AquarelleToolRow';
import {
  aquarelleActiveTool,
  aquarelleParams,
  aquarelleResponseMenuAnchor,
  aquarelleResponseMenuOpen,
  aquarelleSelectedMediumId,
  aquarelleSelectedTipId,
  aquarelleToolMenuAnchor,
  aquarelleToolMenuOpen,
  pickAquarelleMedium,
  selectAquarellePaintTool,
  setAquarelleParam,
  setAquarelleResponseMenuOpen,
  setAquarelleToolMenuOpen,
  type AquarelleGlobalKey,
} from './aquarelleRecordState';
import { visibleAquarelleParamGroups } from './aquarelleParamVisibility';
import {
  commitAquarelleSelectionParam,
  commitAquarelleSelectionParams,
  pickAquarelleBrush,
} from './aquarellePaintControls';
import { brushGroupsForTool, brushPresetsForTool } from './brushToolFamily';
import { aquarelleHasWetPaint } from './aquarelleWetPaintGate';
import {
  aquarelleSelectionEditActive,
  setAquarelleSelectMode,
} from './aquarelleStrokeSelection';

const GLOBAL_MIN = 0;
const GLOBAL_MAX = 100;

function GlobalSlider(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  /** The stored value is transparency; the row shows opacity (max = opaque). */
  invert?: boolean;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  const min = props.min ?? GLOBAL_MIN;
  const max = props.max ?? GLOBAL_MAX;
  const stored = Math.max(min, Math.min(max, props.value));
  // 2026-11-27 (artist's live ruling): the Opacity row stores transparency
  // (0 = opaque) and renders opacity (100 = opaque). Only this surface flips;
  // the stored keys, the records, the per-stroke bag and the engine keep the
  // shipped transparency semantics, so existing strokes and their replay are
  // untouched.
  const shown = props.invert === true ? max + min - stored : stored;
  const toStored = (value: number) => (props.invert === true ? max + min - value : value);
  return (
    <div class="physics-paint-option-row aquarelle-param-row">
      <SliderStepper
        label={props.label}
        value={shown}
        onChange={(value) => props.onChange(toStored(value))}
        onCommit={(value) => props.onCommit?.(toStored(value))}
        step={1}
        min={min}
        max={max}
        ariaLabel={props.label}
      />
    </div>
  );
}

export function AquarelleGlobalsPanel(props: { children?: ComponentChildren } = {}) {
  // Narrow signal reads (efx-preact-reactivity rule 5) — each .value
  // read subscribes this panel to that signal only.
  const params = aquarelleParams.value;
  const activeTool = aquarelleActiveTool.value;
  const selectedMediumId = aquarelleSelectedMediumId.value;
  const selectedTipId = aquarelleSelectedTipId.value;
  const toolMenuOpen = aquarelleToolMenuOpen.value;
  const toolMenuAnchor = aquarelleToolMenuAnchor.value;
  const responseMenuOpen = aquarelleResponseMenuOpen.value;
  const responseMenuAnchor = aquarelleResponseMenuAnchor.value;
  const wetAvailable = aquarelleHasWetPaint.value;
  const toolMenuRef = useRef<HTMLDivElement>(null);
  const responseMenuRef = useRef<HTMLDivElement>(null);

  // Phase 64 (D-01/D-07): the popover close contract mirrors
  // PhysicsPaintTextureMenu — captured pointerdown and Escape listeners only
  // while a menu is open, removed on close. Each trigger owns its own toggle,
  // so its pointerdown must not race this close (both carry the shared
  // popover-trigger marker).
  useEffect(() => {
    if (!toolMenuOpen && !responseMenuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (
        toolMenuRef.current?.contains(target) === true ||
        responseMenuRef.current?.contains(target) === true
      )) {
        return;
      }
      if (target instanceof Element && target.closest('[data-aquarelle-popover-trigger]')) {
        return;
      }
      setAquarelleToolMenuOpen(false);
      setAquarelleResponseMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAquarelleToolMenuOpen(false);
      setAquarelleResponseMenuOpen(false);
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [toolMenuOpen, responseMenuOpen]);

  const onGlobalChange = (key: AquarelleGlobalKey) => (value: number) => {
    setAquarelleParam(key, value);
  };

  // quick 261111-ucf: a slider RELEASE edits the selected paint strokes
  // once. onChange above stays the continuous live path and never commits.
  // quick 261121-mtu: the Lift row is the Eraser context's only row, and its
  // release edits LIFT strokes — the commit seam picks the filter from the
  // key (`lift` vs `paint`), so this call site stays key-agnostic.
  const onGlobalCommit = (key: AquarelleGlobalKey) => (value: number) => {
    void commitAquarelleSelectionParam(key, value);
  };

  // I-01 Reset (quick 261122-gys): restores the ACTIVE MEDIUM RECORD — the
  // same record the Medium label resolves — through the one record seam
  // (setAquarelleParam), then forwards the same fourteen values as ONE
  // selection patch (at most one undo entry; no selection is a no-op). This
  // retires the ×100 playground DEFAULT_PARAMS law and the acrylic refill-0
  // branch (Refill 0 lives in the Acrylic record). Never writes size (top-bar
  // Brush size owns it, Q1a / T-261017-WMW-01) and never writes lift.
  const onReset = () => {
    const record = mediumById(aquarelleSelectedMediumId.value ?? DEFAULT_MEDIUM_ID) ?? MEDIUMS[0];
    const next: Record<string, number> = { ...record.params };
    for (const [key, value] of Object.entries(next)) {
      setAquarelleParam(key as AquarelleGlobalKey, value);
    }
    void commitAquarelleSelectionParams(next);
  };

  // Phase 64: a trigger toggles with its own viewport anchor (event handler
  // only — never a render-body write), and opening one closes the other. A
  // second press closes.
  const toggleToolMenu = (event: TargetedMouseEvent<HTMLButtonElement>) => {
    if (toolMenuOpen) {
      setAquarelleToolMenuOpen(false);
      return;
    }
    setAquarelleResponseMenuOpen(false);
    const rect = event.currentTarget.getBoundingClientRect();
    setAquarelleToolMenuOpen(true, { left: rect.left, top: rect.bottom + 6 });
  };

  const toggleResponseMenu = (event: TargetedMouseEvent<HTMLButtonElement>) => {
    if (responseMenuOpen) {
      setAquarelleResponseMenuOpen(false);
      return;
    }
    setAquarelleToolMenuOpen(false);
    const rect = event.currentTarget.getBoundingClientRect();
    setAquarelleResponseMenuOpen(true, { left: rect.left, top: rect.bottom + 6 });
  };

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  // Same viewport clamp as the brush and texture popovers (212px + 8px gutter).
  const menuLeft = (anchor: { left: number } | null) =>
    anchor === null ? 8 : Math.max(8, Math.min(anchor.left, viewportWidth - 220));
  const menuMaxHeight = (anchor: { top: number } | null) =>
    anchor === null ? 320 : Math.max(120, viewportHeight - anchor.top - 8);

  // 2026-11-27 (artist's live ruling): the response dropdown follows the TOOL.
  // Only the paint tools own a family — Medium shows every non-watercolor
  // preset, Watercolor its own group; Water / Pen / Eraser carry no family, so
  // the row is absent for them. A tip outside the family (a stale pick, a
  // utility-tool pick) shows the family's first preset, which is also what the
  // menu marks, so the label and the checked item can never disagree.
  const responseVisible = activeTool === 'brush' || activeTool === 'watercolor';
  const toolResponses = brushPresetsForTool(activeTool);
  const shownResponse = responseVisible
    ? toolResponses.find((preset) => preset.id === selectedTipId) ?? toolResponses[0]
    : undefined;

  // quick 261121-mtu: the ONE source of rendered rows and headings — a pure,
  // side-effect-free selector over (active tool, selected medium).
  const groups = visibleAquarelleParamGroups(activeTool, selectedMediumId);

  return (
    <div class="physics-paint-option-group" data-testid="aquarelle-globals-panel">
      {/* 2026-11-27 (artist's live ruling): the Paint tab opens with Reset,
          then the Tool dropdown, then the Brush response dropdown (paint tools
          only), then the tab's fixed top rows (Brush size and Grain, supplied
          by the right panel as children), then the context-driven groups. */}
      <button
        type="button"
        data-testid="aquarelle-params-reset"
        onClick={onReset}
        class="physics-paint-text-button"
        style={{
          display: 'block',
          width: '100%',
        }}
      >
        Reset
      </button>

      <div class="physics-paint-option-row" data-testid="aquarelle-tool-row">
        <button
          type="button"
          data-testid="aquarelle-tool-trigger"
          data-aquarelle-popover-trigger
          class="physics-paint-text-button"
          aria-haspopup="menu"
          aria-expanded={toolMenuOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: '8px',
          }}
          onClick={toggleToolMenu}
        >
          <span>Tool</span>
          <span data-testid="aquarelle-tool-name">{AQUARELLE_TOOL_LABELS[activeTool]}</span>
        </button>
      </div>

      {toolMenuOpen && toolMenuAnchor !== null ? (
        <div
          ref={toolMenuRef}
          class="physics-paint-brush-menu"
          role="menu"
          aria-label="Tool"
          data-testid="aquarelle-tool-menu"
          style={{
            left: `${menuLeft(toolMenuAnchor)}px`,
            top: `${toolMenuAnchor.top}px`,
            maxHeight: `${menuMaxHeight(toolMenuAnchor)}px`,
            overflowY: 'auto',
          }}
        >
          <div class="physics-paint-brush-menu-list">
            {AQUARELLE_TOOL_ORDER.map((id) => {
              const active = id === activeTool;
              // 261029-lel: Water only acts on live standing water — grey it
              // while the sheet is dry (same gate as the row and the shortcut).
              const waterGated = id === 'water' && !wetAvailable;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  disabled={waterGated}
                  class={`physics-paint-brush-menu-item${active ? ' active' : ''}`}
                  data-testid={`aquarelle-tool-item-${id}`}
                  title={waterGated ? 'Water (W) — needs standing water' : undefined}
                  onClick={() => {
                    // The early return keeps the dry-sheet law true even when
                    // a caller invokes the handler directly.
                    if (id === 'water' && !aquarelleHasWetPaint.peek()) return;
                    const wasActive = aquarelleActiveTool.peek() === id;
                    setAquarelleToolMenuOpen(false);
                    // 261022-pim: picking a paint tool returns to painting.
                    setAquarelleSelectMode(false);
                    // quick 261121-mtu: the ONE tool-pick seam (same as the row).
                    selectAquarellePaintTool(id);
                    // quick 261122-gys stays true: re-picking the ACTIVE paint
                    // tool restores a drifted medium record; a switch already
                    // applied the record inside the seam.
                    if (wasActive && (id === 'brush' || id === 'watercolor')) {
                      pickAquarelleMedium(brushGroupsForTool(id)[0]!);
                    }
                  }}
                >
                  <span class="physics-paint-brush-menu-name">{AQUARELLE_TOOL_LABELS[id]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {shownResponse !== undefined ? (
        <div class="physics-paint-option-row" data-testid="aquarelle-response-row">
          <button
            type="button"
            data-testid="aquarelle-response-trigger"
            data-aquarelle-popover-trigger
            class="physics-paint-text-button"
            aria-haspopup="menu"
            aria-expanded={responseMenuOpen}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              gap: '8px',
            }}
            onClick={toggleResponseMenu}
          >
            <span>Brush response</span>
            <span data-testid="aquarelle-response-name">{shownResponse.name}</span>
          </button>
        </div>
      ) : null}

      {shownResponse !== undefined && responseMenuOpen && responseMenuAnchor !== null ? (
        <div
          ref={responseMenuRef}
          class="physics-paint-brush-menu"
          role="menu"
          aria-label="Brush response"
          data-testid="aquarelle-response-menu"
          style={{
            left: `${menuLeft(responseMenuAnchor)}px`,
            top: `${responseMenuAnchor.top}px`,
            maxHeight: `${menuMaxHeight(responseMenuAnchor)}px`,
            overflowY: 'auto',
          }}
        >
          <div class="physics-paint-brush-menu-list">
            {toolResponses.map((preset) => {
              const active = preset.id === shownResponse.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  class={`physics-paint-brush-menu-item${active ? ' active' : ''}`}
                  data-testid={`aquarelle-response-item-${preset.id}`}
                  title={preset.hint}
                  onClick={() => {
                    setAquarelleResponseMenuOpen(false);
                    // 261029-eur WR-03: leave Select mode before the pick
                    // UNLESS a non-empty selection is armed — the same law
                    // the library card follows.
                    if (!aquarelleSelectionEditActive()) setAquarelleSelectMode(false);
                    void pickAquarelleBrush(preset.id);
                  }}
                >
                  <span class="physics-paint-brush-menu-name">{preset.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* The tab's fixed top rows from the right panel: the shared Brush size
          control (write-through) and, right after it, the Grain control —
          available under every medium (2026-11-27 artist's ruling). */}
      {props.children}
      <GlobalSlider
        label="Grain"
        value={params.granulation}
        onChange={onGlobalChange('granulation')}
        onCommit={onGlobalCommit('granulation')}
      />

      {groups.map((group) => (
        <div key={group.id} data-testid={`aquarelle-param-group-${group.id}`}>
          <RuleSectionHeader text={group.label} />
          {group.rows.map((row) => (
            <GlobalSlider
              key={String(row.key)}
              label={row.label}
              value={params[row.key]}
              min={row.min}
              max={row.max}
              invert={row.invert === true}
              onChange={onGlobalChange(row.key)}
              onCommit={onGlobalCommit(row.key)}
            />
          ))}
        </div>
      ))}

    </div>
  );
}
