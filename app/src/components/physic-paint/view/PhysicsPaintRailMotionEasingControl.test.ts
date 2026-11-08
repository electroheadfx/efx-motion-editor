// ============================================================
//  261108-d5o / 261108-gh0 — the shared four-icon easing control.
//
//  One pure, hook-free, props-driven control serves BOTH
//  surfaces (the floating Motion sheet's key-mode row and any
//  future host). It is invoked DIRECTLY here and walks the
//  returned button vnodes — no vnode-walker indirection,
//  because the component reads nothing but its props.
//
//  Laws pinned here:
//    exactly four buttons in RAIL_MOTION_EASING_ORDER order
//    ONE exported lucide mapping — linear Diamond, hold Square,
//      ease Squircle, stop-motion Triangle
//    each button's ONLY child is the mapped icon at size 12,
//      aria-hidden so the accessible name stays the word
//    word accessible names + a title per icon
//    aria-pressed true ONLY for the current value
//    disabled => aria-disabled; describedById applies only
//                 while disabled (never a dangling reference)
//    onClick selects its own token; a disabled control never
//                 calls onSelect
//    no store, signal, hook or component-state import;
//      lucide-preact is the only new dependency
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { Diamond, Square, Squircle, Triangle } from 'lucide-preact';
import {
  RAIL_MOTION_EASING_ORDER,
  type PhysicPaintRotoRailMotionEasing,
} from '../roto/railMotionModel';
import {
  PhysicsPaintRailMotionEasingControl,
  RAIL_MOTION_EASING_ICONS,
  type PhysicsPaintRailMotionEasingControlProps,
} from './PhysicsPaintRailMotionEasingControl';

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

const CONTROL_SOURCE = readFileSync(
  fileURLToPath(new URL('./PhysicsPaintRailMotionEasingControl.tsx', import.meta.url)),
  'utf8',
);

const EXPECTED_ICONS = ['Diamond', 'Square', 'Squircle', 'Triangle'] as const;

function render(
  overrides: Partial<PhysicsPaintRailMotionEasingControlProps> = {},
): TestVNode[] {
  return PhysicsPaintRailMotionEasingControl({
    value: 'ease',
    onSelect: () => {},
    disabled: false,
    ...overrides,
  }) as unknown as TestVNode[];
}

describe('261108-gh0 shared rail-motion easing control', () => {
  it('exports ONE frozen icon mapping in easing order', () => {
    const mapping = RAIL_MOTION_EASING_ICONS;
    expect(Object.isFrozen(mapping)).toBe(true);
    expect(Object.keys(mapping)).toEqual([...RAIL_MOTION_EASING_ORDER]);
    expect(mapping.linear).toBe(Diamond);
    expect(mapping.hold).toBe(Square);
    expect(mapping.ease).toBe(Squircle);
    expect(mapping['stop-motion']).toBe(Triangle);
  });

  it('renders exactly four buttons in RAIL_MOTION_EASING_ORDER, each with ONE icon child', () => {
    const buttons = render();
    expect(buttons).toHaveLength(4);
    expect(buttons.every((button) => button.type === 'button')).toBe(true);
    expect(buttons.map((button) => button.props['data-rail-motion-easing']))
      .toEqual([...RAIL_MOTION_EASING_ORDER]);

    buttons.forEach((button, index) => {
      const children = button.props.children as unknown;
      expect(Array.isArray(children), `${EXPECTED_ICONS[index]} is the only child`).toBe(false);
      const icon = children as TestVNode;
      expect(icon.type).toBe(RAIL_MOTION_EASING_ICONS[RAIL_MOTION_EASING_ORDER[index]!]);
      expect(icon.props?.size).toBe(12);
      expect(icon.props?.['aria-hidden']).toBe('true');
    });
  });

  it('names each easing with words and titles its icon', () => {
    const buttons = render();
    expect(buttons.map((button) => button.props['aria-label'])).toEqual([
      'Linear motion key',
      'Hold motion key',
      'Ease motion key',
      'Stop motion key',
    ]);
    RAIL_MOTION_EASING_ORDER.forEach((token, index) => {
      const title = String(buttons[index].props['title']).toLowerCase();
      expect(title, `${token} names its easing in the title`).toContain(
        token === 'stop-motion' ? 'stop motion' : token,
      );
    });
  });

  it('marks ONLY the current easing pressed', () => {
    for (const value of RAIL_MOTION_EASING_ORDER) {
      const buttons = render({ value });
      expect(buttons.map((button) => button.props['aria-pressed'])).toEqual(
        RAIL_MOTION_EASING_ORDER.map((token) => (token === value ? 'true' : 'false')),
      );
    }
  });

  it('selects its own token and never calls onSelect while disabled', () => {
    const onSelect = vi.fn();
    const buttons = render({ onSelect });
    (buttons[3].props['onClick'] as () => void)();
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenLastCalledWith('stop-motion');

    const disabledSelect = vi.fn();
    const disabled = render({ onSelect: disabledSelect, disabled: true });
    for (const button of disabled) (button.props['onClick'] as () => void)();
    expect(disabledSelect).not.toHaveBeenCalled();
  });

  it('publishes disabled state and a describedby reason only while disabled', () => {
    const enabled = render();
    expect(enabled.every((button) => button.props['aria-disabled'] === undefined)).toBe(true);
    expect(enabled.every((button) => button.props['aria-describedby'] === undefined)).toBe(true);

    const disabled = render({ disabled: true, describedById: 'motion-easing-reason' });
    expect(disabled.every((button) => button.props['aria-disabled'] === 'true')).toBe(true);
    expect(disabled.every((button) => button.props['aria-describedby'] === 'motion-easing-reason'))
      .toBe(true);

    // Disabled without a live reason: no dangling aria-describedby.
    const reasonless = render({ disabled: true });
    expect(reasonless.every((button) => button.props['aria-describedby'] === undefined)).toBe(true);
  });

  it('derives optional test ids from the prefix', () => {
    const prefixed = render({ testIdPrefix: 'motion-easing' });
    expect(prefixed.map((button) => button.props['data-testid'])).toEqual(
      RAIL_MOTION_EASING_ORDER.map((token) => `motion-easing-${token}`),
    );
    expect(render().every((button) => button.props['data-testid'] === undefined)).toBe(true);
  });

  it('is pure: lucide is the only icon dependency and no store, signal, hook or state import exists', () => {
    expect(CONTROL_SOURCE).toContain("from 'lucide-preact'");
    expect(CONTROL_SOURCE).not.toMatch(/physicPaintStore/);
    expect(CONTROL_SOURCE).not.toMatch(/@preact\/signals/);
    expect(CONTROL_SOURCE).not.toMatch(/preact\/hooks/);
    expect(CONTROL_SOURCE).not.toMatch(/useState|useSignal|useComputed/);
    // The easing order and its type are the only model dependency.
    expect(CONTROL_SOURCE).toContain("from '../roto/railMotionModel'");
    // 261108-gh0: the icon tokens are declared exactly ONCE, here.
    expect(CONTROL_SOURCE).toContain('RAIL_MOTION_EASING_ICONS');
  });

  it('exports the props contract the hosts wire', () => {
    const props: PhysicsPaintRailMotionEasingControlProps = {
      value: 'linear' as PhysicPaintRotoRailMotionEasing,
      onSelect: () => {},
      disabled: false,
      describedById: undefined,
      testIdPrefix: undefined,
    };
    expect(props.value).toBe('linear');
  });
});
