// ============================================================
//  261108-d5o — the shared four-glyph easing control.
//
//  One pure, hook-free, props-driven control serves BOTH
//  surfaces (the tool strip's "Selected Motion key" group and
//  the floating Motion sheet's key-mode row). It is invoked
//  DIRECTLY here and walks the returned button vnodes — no
//  vnode-walker indirection, because the component reads
//  nothing but its props.
//
//  Laws pinned here:
//    exactly four buttons in RAIL_MOTION_EASING_ORDER order
//    ASCII glyphs <> [] () =, each glyph aria-hidden
//    word accessible names + a title per glyph
//    aria-pressed true ONLY for the current value
//    disabled => aria-disabled; describedById applies only
//                 while disabled (never a dangling reference)
//    onClick selects its own token; a disabled control never
//                 calls onSelect
//    no store, signal, hook or component-state import
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import {
  RAIL_MOTION_EASING_ORDER,
  type PhysicPaintRotoRailMotionEasing,
} from '../roto/railMotionModel';
import {
  PhysicsPaintRailMotionEasingControl,
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

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node !== 'object') return String(node);
  return textOf((node as TestVNode).props?.children);
}

describe('261108-d5o shared rail-motion easing control', () => {
  it('renders exactly four buttons in RAIL_MOTION_EASING_ORDER with ASCII glyphs', () => {
    const buttons = render();
    expect(buttons).toHaveLength(4);
    expect(buttons.every((button) => button.type === 'button')).toBe(true);
    expect(buttons.map((button) => button.props['data-rail-motion-easing']))
      .toEqual([...RAIL_MOTION_EASING_ORDER]);
    // The literal glyphs — '<>' and '()' must never be parsed as JSX syntax.
    expect(buttons.map(textOf)).toEqual(['<>', '[]', '()', '=']);
    // Each button's glyph text sits inside an aria-hidden span, so the
    // accessible name is the word, never the punctuation.
    for (const button of buttons) {
      const glyph = button.props.children as TestVNode;
      expect(glyph.type).toBe('span');
      expect(glyph.props?.['aria-hidden']).toBe('true');
    }
  });

  it('names each easing with words and titles its glyph', () => {
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

  it('is pure: no store, signal, hook or component-state import', () => {
    expect(CONTROL_SOURCE).not.toMatch(/physicPaintStore/);
    expect(CONTROL_SOURCE).not.toMatch(/@preact\/signals/);
    expect(CONTROL_SOURCE).not.toMatch(/preact\/hooks/);
    expect(CONTROL_SOURCE).not.toMatch(/useState|useSignal|useComputed/);
    // The easing order and its type are the only external dependency.
    expect(CONTROL_SOURCE).toContain("from '../roto/railMotionModel'");
  });

  it('exports the props contract the two hosts wire', () => {
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
