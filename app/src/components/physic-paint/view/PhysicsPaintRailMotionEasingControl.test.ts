// ============================================================
//  261108-d5o / 261108-gh0 / 261108-gh0 UAT — the shared easing table.
//
//  One pure, hook-free, props-driven control serves every easing
//  surface. It is invoked DIRECTLY here and walks the returned
//  vnodes — no vnode-walker indirection, because the component
//  reads nothing but its props.
//
//  Laws pinned here:
//    one row per easing, display order stop-motion → ease → hold →
//      linear (the model's persistence order is NOT the display order)
//    ONE exported lucide mapping — linear Diamond, hold Square,
//      ease Squircle, stop-motion Triangle — filled, size 12
//    every row offers TWO targets: [Key N] and [All]
//    word names + a title per row
//    the active row carries the ▸ marker; its [Key N] is aria-pressed
//    keyFrame null => the per-key target is labelled "Key" and disabled
//    disabled / disabledAll => aria-disabled, describedById only while
//      the matching target is disabled (never a dangling reference)
//    onSelect receives (token, 'key' | 'all')
//    no store, signal, hook or component-state import
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { Diamond, Square, Squircle, Triangle } from 'lucide-preact';
import { RAIL_MOTION_EASING_ORDER } from '../roto/railMotionModel';
import {
  PhysicsPaintRailMotionEasingControl,
  RAIL_MOTION_EASING_DISPLAY_ORDER,
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

function collect(node: unknown, out: TestVNode[] = []): TestVNode[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  const vnode = node as TestVNode;
  out.push(vnode);
  if (vnode.props?.children !== undefined) collect(vnode.props.children, out);
  return out;
}

function render(overrides: Partial<PhysicsPaintRailMotionEasingControlProps> = {}): TestVNode {
  return PhysicsPaintRailMotionEasingControl({
    value: 'ease',
    onSelect: () => {},
    keyFrame: 5,
    ...overrides,
  }) as unknown as TestVNode;
}

function rows(tree: TestVNode): TestVNode[] {
  return collect(tree).filter(
    (node) => node.props?.['data-rail-motion-easing-row'] !== undefined,
  );
}

function targetButtons(row: TestVNode): TestVNode[] {
  return collect(row).filter(
    (node) => node.props?.['data-rail-motion-easing-target'] !== undefined,
  );
}

describe('261108-gh0 shared rail-motion easing table', () => {
  it('exports ONE frozen icon mapping in model order', () => {
    const mapping = RAIL_MOTION_EASING_ICONS;
    expect(Object.isFrozen(mapping)).toBe(true);
    expect(Object.keys(mapping)).toEqual([...RAIL_MOTION_EASING_ORDER]);
    expect(mapping.linear).toBe(Diamond);
    expect(mapping.hold).toBe(Square);
    expect(mapping.ease).toBe(Squircle);
    expect(mapping['stop-motion']).toBe(Triangle);
  });

  it('renders four rows in the display order, each with a filled icon and two targets', () => {
    const list = rows(render());
    expect(list.map((row) => row.props['data-rail-motion-easing-row']))
      .toEqual([...RAIL_MOTION_EASING_DISPLAY_ORDER]);
    expect([...RAIL_MOTION_EASING_DISPLAY_ORDER]).toEqual([
      'stop-motion', 'ease', 'hold', 'linear',
    ]);

    list.forEach((row) => {
      const token = row.props['data-rail-motion-easing-row'] as keyof typeof RAIL_MOTION_EASING_ICONS;
      const wrapper = collect(row).find(
        (node) => (node.props?.class as string | undefined) === 'physics-paint-motion-easing-icon',
      );
      expect(wrapper, `${token} renders its icon cell`).toBeDefined();
      expect(wrapper!.props?.['aria-hidden']).toBe('true');
      const icon = collect(wrapper).find(
        (node) => node.type === RAIL_MOTION_EASING_ICONS[token],
      );
      expect(icon, `${token} renders its mapped icon`).toBeDefined();
      expect(icon!.props?.size).toBe(12);
      expect(icon!.props?.fill).toBe('currentColor');

      const targets = targetButtons(row);
      expect(targets).toHaveLength(2);
      expect(targets.map((button) => button.props['data-rail-motion-easing-target']))
        .toEqual([`${token}-key`, `${token}-all`]);
    });
  });

  it('names each easing with words and titles both targets', () => {
    const list = rows(render());
    expect(collect(render()).filter(
      (node) => (node.props?.class as string | undefined) === 'physics-paint-motion-easing-name',
    ).map((node) => node.props.children)).toEqual([
      'Stop motion', 'Ease', 'Hold', 'Linear',
    ]);

    list.forEach((row) => {
      const token = row.props['data-rail-motion-easing-row'] as string;
      const word = token === 'stop-motion' ? 'Stop motion' : token === 'ease'
        ? 'Ease'
        : token === 'hold' ? 'Hold' : 'Linear';
      const [key, all] = targetButtons(row);
      expect(key.props['aria-label']).toBe(`${word} on the selected key`);
      expect(all.props['aria-label']).toBe(`${word} on all keys`);
      expect(String(key.props['title']).toLowerCase()).toContain(word.toLowerCase());
      expect(String(all.props['title']).toLowerCase()).toContain(word.toLowerCase());
    });
  });

  it('marks ONLY the current easing and shows the ▸ marker on that row', () => {
    for (const token of RAIL_MOTION_EASING_DISPLAY_ORDER) {
      const list = rows(render({ value: token }));
      expect(list.map((row) => row.props['data-active'])).toEqual(
        RAIL_MOTION_EASING_DISPLAY_ORDER.map((entry) => (entry === token ? 'true' : 'false')),
      );
      const markers = collect(render({ value: token })).filter(
        (node) => (node.props?.class as string | undefined) === 'physics-paint-motion-easing-current',
      );
      expect(markers.map((node) => node.props.children)).toEqual(
        RAIL_MOTION_EASING_DISPLAY_ORDER.map((entry) => (entry === token ? '▸' : '')),
      );
    }
  });

  it('labels the per-key target with the actual key frame', () => {
    const keyed = targetButtons(rows(render({ keyFrame: 5 }))[0]!);
    expect(keyed[0]!.props.children).toBe('Key 5');
    expect(keyed[0]!.props['aria-disabled']).toBeUndefined();

    // Property mode: no key to write — the button says "Key" and is inert.
    const propertyValue = targetButtons(rows(render({ keyFrame: null }))[0]!);
    expect(propertyValue[0]!.props.children).toBe('Key');
    expect(propertyValue[0]!.props['aria-disabled']).toBe('true');
  });

  it('sends the target with the token and honours the disabled flags', () => {
    const onSelect = vi.fn();
    const tree = render({ onSelect, keyFrame: 5 });
    const list = rows(tree);
    const [keyButton, allButton] = targetButtons(list[0]!);
    (keyButton.props['onClick'] as () => void)();
    expect(onSelect).toHaveBeenLastCalledWith('stop-motion', 'key');
    (allButton.props['onClick'] as () => void)();
    expect(onSelect).toHaveBeenLastCalledWith('stop-motion', 'all');

    const keyDisabled = vi.fn();
    const keyTree = render({ onSelect: keyDisabled, keyFrame: null });
    for (const button of targetButtons(rows(keyTree)[0]!)) {
      if (button.props['data-rail-motion-easing-target'] === 'stop-motion-key') {
        expect(button.props['aria-disabled']).toBe('true');
      }
    }
    const [disabledKey, enabledAll] = targetButtons(rows(keyTree)[0]!);
    (disabledKey.props['onClick'] as () => void)();
    expect(keyDisabled).not.toHaveBeenCalled();
    (enabledAll.props['onClick'] as () => void)();
    expect(keyDisabled).toHaveBeenLastCalledWith('stop-motion', 'all');

    const allDisabled = vi.fn();
    const allTree = render({ onSelect: allDisabled, disabledAll: true });
    for (const button of targetButtons(rows(allTree)[0]!)) {
      if (button.props['data-rail-motion-easing-target'] === 'stop-motion-all') {
        (button.props['onClick'] as () => void)();
      }
    }
    expect(allDisabled).not.toHaveBeenCalled();
  });

  it('publishes each disabled reason only on the target it disables', () => {
    const tree = render({
      keyFrame: null,
      disabledAll: true,
      describedById: 'key-reason',
      describedByIdAll: 'all-reason',
    });
    const [keyButton, allButton] = targetButtons(rows(tree)[0]!);
    expect(keyButton.props['aria-describedby']).toBe('key-reason');
    expect(allButton.props['aria-describedby']).toBe('all-reason');

    // Enabled targets never carry a dangling reference.
    const enabled = render({ keyFrame: 5 });
    expect(targetButtons(rows(enabled)[0]!).every(
      (button) => button.props['aria-describedby'] === undefined,
    )).toBe(true);
  });

  it('derives optional test ids from the prefix', () => {
    const prefixed = render({ testIdPrefix: 'motion-easing' });
    expect(targetButtons(rows(prefixed)[0]!).map((button) => button.props['data-testid']))
      .toEqual(['motion-easing-stop-motion-key', 'motion-easing-stop-motion-all']);
    expect(targetButtons(rows(render())[0]!).every(
      (button) => button.props['data-testid'] === undefined,
    )).toBe(true);
  });

  it('is pure: lucide is the only icon dependency and no store, signal, hook or state import exists', () => {
    expect(CONTROL_SOURCE).toContain("from 'lucide-preact'");
    expect(CONTROL_SOURCE).not.toMatch(/physicPaintStore/);
    expect(CONTROL_SOURCE).not.toMatch(/@preact\/signals/);
    expect(CONTROL_SOURCE).not.toMatch(/preact\/hooks/);
    expect(CONTROL_SOURCE).not.toMatch(/useState|useSignal|useComputed/);
    expect(CONTROL_SOURCE).toContain("from '../roto/railMotionModel'");
    expect(CONTROL_SOURCE).toContain('RAIL_MOTION_EASING_ICONS');
  });
});
