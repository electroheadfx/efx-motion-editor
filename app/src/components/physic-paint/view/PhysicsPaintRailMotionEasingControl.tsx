// ============================================================
//  261108-d5o / 261108-gh0 — the shared four-icon easing control.
//
//  ONE props-driven control is rendered by every easing surface
//  (the floating Motion sheet's key-mode row today). It owns no
//  grouping element — each host supplies its own group label —
//  and it reads nothing but its props: no store, no signal, no
//  hook, no state.
//
//  261108-gh0: the ASCII glyphs became lucide icons and the
//  mapping is exported once, so the lane markers reuse the SAME
//  table instead of declaring a second token→icon map:
//    linear -> Diamond   hold -> Square
//    ease -> Squircle    stop-motion -> Triangle
//  Each icon is aria-hidden; the accessible name is the word.
// ============================================================

import { Diamond, Square, Squircle, Triangle, type LucideIcon } from 'lucide-preact';
import {
  RAIL_MOTION_EASING_ORDER,
  type PhysicPaintRotoRailMotionEasing,
} from '../roto/railMotionModel';

export interface PhysicsPaintRailMotionEasingControlProps {
  /** The easing of the selected Motion key (never a default: the key owns it). */
  readonly value: PhysicPaintRotoRailMotionEasing;
  /** Called with the clicked token; the current token is re-selectable. */
  readonly onSelect: (easing: PhysicPaintRotoRailMotionEasing) => void;
  /** True when the command layer refuses the edit; every button greys out. */
  readonly disabled: boolean;
  /** The live reason span id; applied only while disabled (never dangling). */
  readonly describedById?: string;
  /** Optional test-id stem: each button becomes `${testIdPrefix}-${token}`. */
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

const EASING_LABEL: Readonly<Record<PhysicPaintRotoRailMotionEasing, string>> = Object.freeze({
  linear: 'Linear motion key',
  hold: 'Hold motion key',
  ease: 'Ease motion key',
  'stop-motion': 'Stop motion key',
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
  return RAIL_MOTION_EASING_ORDER.map((token) => {
    const Icon = RAIL_MOTION_EASING_ICONS[token];
    const disabledReasonId = props.disabled ? props.describedById : undefined;
    return (
      <button
        key={token}
        type="button"
        class="physics-paint-roto-key-icon-button"
        data-rail-motion-easing={token}
        data-testid={props.testIdPrefix ? `${props.testIdPrefix}-${token}` : undefined}
        aria-label={EASING_LABEL[token]}
        aria-pressed={props.value === token ? 'true' : 'false'}
        aria-disabled={props.disabled ? 'true' : undefined}
        aria-describedby={disabledReasonId}
        title={EASING_TITLE[token]}
        onClick={() => {
          if (props.disabled) return;
          props.onSelect(token);
        }}
      >
        <Icon size={12} aria-hidden="true" />
      </button>
    );
  });
}
