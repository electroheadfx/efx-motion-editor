// ============================================================
//  261108-d5o / 261108-gh0 / 261108-gh0 UAT — the shared easing control.
//
//  ONE props-driven control is rendered by every easing surface (the
//  floating Motion sheet's Keys section today). It reads nothing but
//  its props: no store, no signal, no hook, no state.
//
//  UAT shape: one row per easing, each row offering TWO targets —
//  the selected key and every key of the motion:
//
//      ▸ ▲  Stop motion   [Key 5] [All]
//        ◠  Ease          [Key 5] [All]
//        □  Hold          [Key 5] [All]
//        ◇  Linear        [Key 5] [All]
//
//  The leading marker names the easing the selected key (or, in
//  property mode, the motion) currently uses. The lanes reuse the ONE
//  exported token→icon table instead of declaring a second map:
//    linear -> Diamond   hold -> Square
//    ease -> Squircle    stop-motion -> Triangle
// ============================================================

import { Diamond, Square, Squircle, Triangle, type LucideIcon } from 'lucide-preact';
import type { PhysicPaintRotoRailMotionEasing } from '../roto/railMotionModel';

/** Which keys a clicked row writes: the selected key, or every key. */
export type RailMotionEasingTarget = 'key' | 'all';

export interface PhysicsPaintRailMotionEasingControlProps {
  /** The easing the selection currently uses (drives the row marker). */
  readonly value: PhysicPaintRotoRailMotionEasing;
  /** Called with the clicked token AND the target the user pressed. */
  readonly onSelect: (
    easing: PhysicPaintRotoRailMotionEasing,
    target: RailMotionEasingTarget,
  ) => void;
  /**
   * The selected Motion key's frame, or null in property mode. The per-key
   * button shows it ("Key 5") and disables when null — no key to write.
   */
  readonly keyFrame: number | null;
  /** The command layer refuses the per-key edit; both buttons grey out. */
  readonly disabled?: boolean;
  /** The command layer refuses the all-keys edit. */
  readonly disabledAll?: boolean;
  /** Live reason span ids; applied only while the matching button is disabled. */
  readonly describedById?: string;
  readonly describedByIdAll?: string;
  /** Optional test-id stem: buttons become `${prefix}-${token}-key|all`. */
  readonly testIdPrefix?: string;
}

/** The ONE easing→icon table; lane markers import this, never a copy. */
export const RAIL_MOTION_EASING_ICONS: Readonly<
  Record<PhysicPaintRotoRailMotionEasing, LucideIcon>
> = Object.freeze({
  linear: Diamond,
  hold: Square,
  ease: Squircle,
  'stop-motion': Triangle,
});

/**
 * Display order only — persistence keeps the model's own order. Most stepped
 * first, most continuous last, so the column reads as an easing spectrum.
 */
export const RAIL_MOTION_EASING_DISPLAY_ORDER: readonly PhysicPaintRotoRailMotionEasing[] =
  Object.freeze(['stop-motion', 'ease', 'hold', 'linear']);

const EASING_NAME: Readonly<Record<PhysicPaintRotoRailMotionEasing, string>> = Object.freeze({
  linear: 'Linear',
  hold: 'Hold',
  ease: 'Ease',
  'stop-motion': 'Stop motion',
});

const EASING_TITLE: Readonly<Record<PhysicPaintRotoRailMotionEasing, string>> = Object.freeze({
  linear: 'Linear — constant speed through the span',
  hold: 'Hold — keeps this value until the next key',
  ease: 'Ease — smooth acceleration and deceleration',
  'stop-motion': 'Stop motion — steps at each drawn frame',
});

export function PhysicsPaintRailMotionEasingControl(
  props: PhysicsPaintRailMotionEasingControlProps,
) {
  const keyDisabled = props.disabled === true || props.keyFrame === null;
  const allDisabled = props.disabled === true || props.disabledAll === true;
  return (
    <div class="physics-paint-motion-easing-table" role="group" aria-label="Motion easing">
      {RAIL_MOTION_EASING_DISPLAY_ORDER.map((token) => {
        const Icon = RAIL_MOTION_EASING_ICONS[token];
        const active = props.value === token;
        return (
          <div
            key={token}
            class="physics-paint-motion-easing-row"
            data-rail-motion-easing-row={token}
            data-active={active ? 'true' : 'false'}
          >
            <span class="physics-paint-motion-easing-current" aria-hidden="true">
              {active ? '▸' : ''}
            </span>
            <span class="physics-paint-motion-easing-icon" aria-hidden="true">
              <Icon size={12} fill="currentColor" />
            </span>
            <span class="physics-paint-motion-easing-name">{EASING_NAME[token]}</span>
            <button
              type="button"
              class="physics-paint-motion-easing-target"
              data-rail-motion-easing-target={`${token}-key`}
              data-testid={props.testIdPrefix ? `${props.testIdPrefix}-${token}-key` : undefined}
              aria-label={`${EASING_NAME[token]} on the selected key`}
              aria-pressed={active ? 'true' : 'false'}
              aria-disabled={keyDisabled ? 'true' : undefined}
              aria-describedby={keyDisabled ? props.describedById : undefined}
              title={`${EASING_TITLE[token]} — selected key`}
              onClick={() => {
                if (keyDisabled) return;
                props.onSelect(token, 'key');
              }}
            >
              {props.keyFrame === null ? 'Key' : `Key ${props.keyFrame}`}
            </button>
            <button
              type="button"
              class="physics-paint-motion-easing-target"
              data-rail-motion-easing-target={`${token}-all`}
              data-testid={props.testIdPrefix ? `${props.testIdPrefix}-${token}-all` : undefined}
              aria-label={`${EASING_NAME[token]} on all keys`}
              aria-disabled={allDisabled ? 'true' : undefined}
              aria-describedby={allDisabled ? props.describedByIdAll : undefined}
              title={`${EASING_TITLE[token]} — every key of this motion`}
              onClick={() => {
                if (allDisabled) return;
                props.onSelect(token, 'all');
              }}
            >
              All
            </button>
          </div>
        );
      })}
    </div>
  );
}
