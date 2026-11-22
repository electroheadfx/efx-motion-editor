// ============================================================
//  AquarelleGlobalsPanel — the medium dropdown, the context-driven
//  parameter groups + Reset. This is the Paint-tab content.
//
//  Phase 64 (D-01/D-07/D-22): the panel LEADS with the five-item
//  medium dropdown, then the slider rows below it. quick 261122-gys:
//  a pick binds a preset of the picked group AND applies the whole
//  record in one move (pickAquarelleMedium), then closes — the
//  label, the rows and the brush always describe the same medium,
//  and the selected name is shown truthfully, with no "edited"
//  marker.
//
//  quick 261121-mtu: the flat twelve-row list is gone. The rows
//  and their six group headings come from ONE pure selector,
//  `visibleAquarelleParamGroups(activeTool, selectedMediumId)`
//  (`aquarelleParamVisibility.ts`, spec §8). The law is the
//  ACTIVE TOOL plus the ACTIVE MEDIUM, never the tool alone:
//  the paint tools show the medium's rows (Refill hidden for
//  acrylic AND watercolor — decision B), the Water tool shows its
//  fluid set, and the Eraser shows the Lift row alone. Group
//  headings render only when non-empty, in the fixed order
//  Medium · Paint & reservoir · Drying · Edge · Watercolor only ·
//  Eraser.
//
//  Param keys stay water/load/flow/bleed/edge/granulation/dry/
//  viscosity/body/feather/pickup/refill/emboss — `body` rides the
//  bag and the Reset law but has NO row (post-UAT 2026-11-22: the
//  compositor's alpha is max(pigment-darkness, cover), so Body is
//  invisible for every pigmented paint and only reads on near-white
//  pigments). `size` is NOT here — the shared Size slider owns it
//  (D-05). Hiding a row never removes its key: the Reset write set
//  is the full row table minus Lift plus the hidden Body key.
//
//  Reset restores playground DEFAULT_PARAMS (0..1) ×100 onto the
//  app 0-100 slider band for every non-size row (and the hidden
//  Body key) via the one record-path seam (setAquarelleParam),
//  EXCEPT Refill in the acrylic context, which resets to 0 (the
//  acrylic record's value — the row is hidden there, decision B).
//  Never writes size (top-bar Brush size owns it, Q1a /
//  T-261017-WMW-01) and never writes lift.
//
//  The Brush response block lives in BrushResponsePanel (I-02).
// ============================================================

import type { TargetedMouseEvent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { DEFAULT_PARAMS, DEFAULT_MEDIUM_ID, MEDIUMS, mediumById } from '@efxlab/efx-watercolor';
import { RuleSectionHeader } from '../../shared/RuleSectionHeader';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  aquarelleActiveTool,
  aquarelleMediumMenuAnchor,
  aquarelleMediumMenuOpen,
  aquarelleParams,
  aquarelleSelectedMediumId,
  pickAquarelleMedium,
  setAquarelleMediumMenuOpen,
  setAquarelleParam,
  type AquarelleGlobalKey,
} from './aquarelleRecordState';
import {
  AQUARELLE_PARAM_ROWS,
  visibleAquarelleParamGroups,
} from './aquarelleParamVisibility';
import {
  commitAquarelleSelectionParam,
  commitAquarelleSelectionParams,
} from './aquarellePaintControls';

/** Keys with no visible row that the Reset law still restores. Body's
 *  opacity story is real for near-white pigments and the recorded bag must
 *  land back on the canonical default, even though its row is hidden.
 *  `lift` is the reverse: it HAS a row (Eraser context) but Reset never
 *  writes it (the eraser strength is not a global default). */
const RESET_ONLY_KEYS: readonly AquarelleGlobalKey[] = Object.freeze(['body'] as const);

const GLOBAL_MIN = 0;
const GLOBAL_MAX = 100;

function GlobalSlider(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  const min = props.min ?? GLOBAL_MIN;
  const max = props.max ?? GLOBAL_MAX;
  return (
    <div class="physics-paint-option-row">
      <SliderStepper
        label={props.label}
        value={Math.max(min, Math.min(max, props.value))}
        onChange={props.onChange}
        onCommit={props.onCommit}
        step={1}
        min={min}
        max={max}
        ariaLabel={props.label}
      />
    </div>
  );
}

export function AquarelleGlobalsPanel() {
  // Narrow signal reads (efx-preact-reactivity rule 5) — each .value
  // read subscribes this panel to that signal only.
  const params = aquarelleParams.value;
  const activeTool = aquarelleActiveTool.value;
  const selectedMediumId = aquarelleSelectedMediumId.value;
  const menuOpen = aquarelleMediumMenuOpen.value;
  const menuAnchor = aquarelleMediumMenuAnchor.value;
  const menuRef = useRef<HTMLDivElement>(null);

  // Phase 64 (D-01/D-07): the popover close contract mirrors
  // PhysicsPaintTextureMenu — captured pointerdown and Escape listeners only
  // while open, removed on close. The trigger owns its own toggle, so its
  // pointerdown must not race this close.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-aquarelle-medium-trigger]')) return;
      setAquarelleMediumMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setAquarelleMediumMenuOpen(false);
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [menuOpen]);

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

  // I-01 Reset: playground DEFAULT_PARAMS (0..1) mapped onto the app 0-100
  // slider band (×100), written once per non-size key through the one seam.
  // quick 261121-mtu: the key set is the FULL row table minus Lift (decision
  // B hides Refill for acrylic/watercolor, but a hidden row still owns its
  // key — hiding is exposure, never storage). In the acrylic context Refill
  // resets to 0, the record's own value; every other medium resets to the
  // canonical 60, so a medium NEVER forces 0 outside the acrylic context.
  // Never writes size (top-bar Brush size owns it, Q1a / T-261017-WMW-01).
  // The hidden Body key resets too (RESET_ONLY_KEYS), so a medium pick's
  // body never survives a Reset. The same values leave as ONE selection
  // patch after the live writes, so Reset costs at most one undo entry and
  // no selection is a no-op.
  const onReset = () => {
    const next: Record<string, number> = {};
    const acrylic = aquarelleSelectedMediumId.value === 'acrylic';
    const keys = [
      ...AQUARELLE_PARAM_ROWS.filter((row) => row.key !== 'lift').map((row) => row.key),
      ...RESET_ONLY_KEYS,
    ];
    for (const key of keys) {
      const value = acrylic && key === 'refill' ? 0 : Math.round(DEFAULT_PARAMS[key] * 100);
      next[key] = value;
      setAquarelleParam(key, value);
    }
    void commitAquarelleSelectionParams(next);
  };

  // Phase 64: the trigger toggles with its own viewport anchor (event handler
  // only — never a render-body write). A second press closes.
  const toggleMediumMenu = (event: TargetedMouseEvent<HTMLButtonElement>) => {
    if (menuOpen) {
      setAquarelleMediumMenuOpen(false);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setAquarelleMediumMenuOpen(true, { left: rect.left, top: rect.bottom + 6 });
  };

  const selectedMedium =
    mediumById(selectedMediumId ?? DEFAULT_MEDIUM_ID) ?? MEDIUMS[0];
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
  // Same viewport clamp as the brush and texture popovers (212px + 8px gutter).
  const menuLeft = menuAnchor === null ? 8 : Math.max(8, Math.min(menuAnchor.left, viewportWidth - 220));
  const menuMaxHeight =
    menuAnchor === null ? 320 : Math.max(120, viewportHeight - menuAnchor.top - 8);

  // quick 261121-mtu: the ONE source of rendered rows and headings — a pure,
  // side-effect-free selector over (active tool, selected medium).
  const groups = visibleAquarelleParamGroups(activeTool, selectedMediumId);

  return (
    <div class="physics-paint-option-group" data-testid="aquarelle-globals-panel">
      <div class="physics-paint-option-row" data-testid="aquarelle-medium-row">
        <button
          type="button"
          data-testid="aquarelle-medium-trigger"
          data-aquarelle-medium-trigger
          class="physics-paint-text-button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: '8px',
          }}
          onClick={toggleMediumMenu}
        >
          <span>Medium</span>
          <span data-testid="aquarelle-medium-name">{selectedMedium.name}</span>
        </button>
      </div>

      {menuOpen && menuAnchor !== null ? (
        <div
          ref={menuRef}
          class="physics-paint-brush-menu"
          role="menu"
          aria-label="Medium"
          data-testid="aquarelle-medium-menu"
          style={{
            left: `${menuLeft}px`,
            top: `${menuAnchor.top}px`,
            maxHeight: `${menuMaxHeight}px`,
            overflowY: 'auto',
          }}
        >
          <div class="physics-paint-brush-menu-list">
            {MEDIUMS.map((medium) => {
              const active = medium.id === selectedMediumId;
              return (
                <button
                  key={medium.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  class={`physics-paint-brush-menu-item${active ? ' active' : ''}`}
                  data-testid={`aquarelle-medium-item-${medium.id}`}
                  onClick={() => {
                    // quick 261122-gys: a pick binds a preset of the picked
                    // group AND applies its record (D-03: re-picking restores
                    // a drifted record — the store decides what is written).
                    pickAquarelleMedium(medium.id);
                    setAquarelleMediumMenuOpen(false);
                  }}
                >
                  <span class="physics-paint-brush-menu-name">{medium.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

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
              onChange={onGlobalChange(row.key)}
              onCommit={onGlobalCommit(row.key)}
            />
          ))}
        </div>
      ))}

      <button
        type="button"
        data-testid="aquarelle-params-reset"
        onClick={onReset}
        class="physics-paint-text-button"
        style={{
          display: 'block',
          width: '100%',
          marginTop: '8px',
        }}
      >
        Reset
      </button>
    </div>
  );
}
