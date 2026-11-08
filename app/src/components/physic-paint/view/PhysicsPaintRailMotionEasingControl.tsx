// ============================================================
//  261108-d5o — the shared four-glyph easing control.
//
//  ONE props-driven control is rendered by BOTH easing surfaces:
//  the tool strip's "Selected Motion key" group and the floating
//  Motion sheet's key-mode row. It owns no grouping element —
//  each host supplies its own group label — and it reads nothing
//  but its props: no store, no signal, no hook, no state.
//
//  Glyphs are ASCII and deliberately punctuation-only so the
//  four easings stay scannable in a 26px button band:
//    linear '<>'   hold '[]'   ease '()'   stop-motion '='
//  Each glyph is aria-hidden; the accessible name is the word.
// ============================================================

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

const EASING_GLYPH: Readonly<Record<PhysicPaintRotoRailMotionEasing, string>> = Object.freeze({
  linear: '<>',
  hold: '[]',
  ease: '()',
  'stop-motion': '=',
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
        <span aria-hidden="true">{EASING_GLYPH[token]}</span>
      </button>
    );
  });
}
