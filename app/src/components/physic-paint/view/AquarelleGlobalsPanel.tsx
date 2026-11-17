// ============================================================
//  AquarelleGlobalsPanel — the medium dropdown, the 8 watercolor
//  globals + Reset. This is the Paint-tab content.
//
//  Phase 64 (D-01/D-07): the panel LEADS with the five-item
//  medium dropdown, then the eight slider rows below it. A pick
//  applies the whole record in one move (applyAquarelleMedium)
//  and closes; the selected name is shown truthfully, with no
//  "edited" marker.
//
//  Labels and row order follow the playground SettingsPanel
//  (Water, Pigment, Flow, Bleed, Edges, Grain, Dry speed), with
//  Phase 64's Viscosity appended LAST. Param keys stay
//  water/load/flow/bleed/edge/granulation/dry/viscosity.
//  `size` is NOT here — the shared Size slider owns it (D-05).
//
//  Reset restores playground DEFAULT_PARAMS (0..1) ×100 onto the
//  app 0-100 slider band for every non-size row via the one
//  record-path seam (setAquarelleParam). Never writes size
//  (top-bar Brush size owns it, Q1a / T-261017-WMW-01).
//
//  The Brush response block lives in BrushResponsePanel (I-02).
// ============================================================

import type { TargetedMouseEvent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { DEFAULT_PARAMS, DEFAULT_MEDIUM_ID, MEDIUMS, mediumById } from '@efxlab/efx-watercolor';
import { SliderStepper } from '../../shared/SliderStepper';
import {
  aquarelleMediumMenuAnchor,
  aquarelleMediumMenuOpen,
  aquarelleParams,
  aquarelleSelectedMediumId,
  applyAquarelleMedium,
  setAquarelleMediumMenuOpen,
  setAquarelleParam,
  type AquarelleGlobalKey,
} from './aquarelleRecordState';
import {
  commitAquarelleSelectionParam,
  commitAquarelleSelectionParams,
} from './aquarellePaintControls';

/** Module-only global rows (D-05 / I-01 playground order + Phase 64 Viscosity).
 *  `size` is NOT here — shared Size owns it. Viscosity is appended LAST: 64-04
 *  appends Emboss after it and 64-06 inserts Body between the two. */
const GLOBAL_ROWS: ReadonlyArray<{ key: AquarelleGlobalKey; label: string }> = Object.freeze([
  { key: 'water', label: 'Water' },
  { key: 'load', label: 'Pigment' },
  { key: 'flow', label: 'Flow' },
  { key: 'bleed', label: 'Bleed' },
  { key: 'edge', label: 'Edges' },
  { key: 'granulation', label: 'Grain' },
  { key: 'dry', label: 'Dry speed' },
  { key: 'viscosity', label: 'Viscosity' },
]);

const GLOBAL_MIN = 0;
const GLOBAL_MAX = 100;

function GlobalSlider(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  return (
    <div class="physics-paint-option-row">
      <SliderStepper
        label={props.label}
        value={Math.max(GLOBAL_MIN, Math.min(GLOBAL_MAX, props.value))}
        onChange={props.onChange}
        onCommit={props.onCommit}
        step={1}
        min={GLOBAL_MIN}
        max={GLOBAL_MAX}
        ariaLabel={props.label}
      />
    </div>
  );
}

export function AquarelleGlobalsPanel() {
  // Narrow signal reads (efx-preact-reactivity rule 5) — each .value
  // read subscribes this panel to that signal only.
  const params = aquarelleParams.value;
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
  const onGlobalCommit = (key: AquarelleGlobalKey) => (value: number) => {
    void commitAquarelleSelectionParam(key, value);
  };

  // I-01 Reset: playground DEFAULT_PARAMS (0..1) mapped onto the app 0-100
  // slider band (×100), written once per non-size row through the one seam.
  // Never writes size (top-bar Brush size owns it, Q1a / T-261017-WMW-01).
  // The same values leave as ONE selection patch after the live writes,
  // so Reset costs at most one undo entry and no selection is a no-op.
  const onReset = () => {
    const next: Record<string, number> = {};
    for (const row of GLOBAL_ROWS) {
      const value = Math.round(DEFAULT_PARAMS[row.key] * 100);
      next[row.key] = value;
      setAquarelleParam(row.key, value);
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
                    // D-03: a pick always applies — the store decides whether
                    // anything is written, so re-picking restores the record.
                    applyAquarelleMedium(medium.id);
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

      {GLOBAL_ROWS.map((row) => (
        <GlobalSlider
          key={String(row.key)}
          label={row.label}
          value={params[row.key]}
          onChange={onGlobalChange(row.key)}
          onCommit={onGlobalCommit(row.key)}
        />
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
