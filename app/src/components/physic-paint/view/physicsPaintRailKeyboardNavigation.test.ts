import { describe, expect, it, vi } from 'vitest';
import {
  applyRailRovingTabIndex,
  dispatchRailTargetKeyDown,
  findAdjacentRail,
  getRailsInCanonicalOrder,
  roveRailTargetFocus,
} from './physicsPaintRailKeyboardNavigation';

interface FakeRail {
  id: string;
  firstFrame: number;
  tabIndex: number;
  focused: boolean;
  focus(): void;
  getAttribute(name: string): string | null;
}

function rail(firstFrame: number, id: string): FakeRail {
  return {
    id,
    firstFrame,
    tabIndex: 0,
    focused: false,
    focus() {
      this.focused = true;
    },
    getAttribute(name: string) {
      return name === 'data-rail-first-frame' ? String(this.firstFrame) : null;
    },
  };
}

interface FakeScope {
  rails: readonly FakeRail[];
  scroller: FakeRail | null;
  querySelectorAll(): FakeRail[];
  closest(selector: string): FakeRail | null;
}

function lane(rails: readonly FakeRail[], scroller: FakeRail | null = null): FakeScope {
  return {
    rails,
    scroller,
    querySelectorAll: () => [...rails],
    closest: (selector: string) => (selector === '.physics-paint-timeline-scroll' ? scroller : null),
  };
}

function keyEvent(key: string, overrides: Record<string, unknown> = {}) {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  return {
    event: {
      key,
      shiftKey: false,
      preventDefault,
      stopPropagation,
      ...overrides,
    },
    preventDefault,
    stopPropagation,
  };
}

describe('shared rail roving keyboard navigation (43.4 defect 9)', () => {
  it('orders mixed rails by first-key frame so cycling interleaves Key → Motion → Key → Static', () => {
    const keyA = rail(2, 'key-a');
    const motion = rail(4, 'motion');
    const keyB = rail(6, 'key-b');
    const statik = rail(8, 'static');
    const rails = getRailsInCanonicalOrder(lane([statik, keyA, motion, keyB])) as FakeRail[];
    expect(rails.map((r) => r.id)).toEqual(['key-a', 'motion', 'key-b', 'static']);
    expect(rails[0]).toBe(keyA);
    expect(rails[1]).toBe(motion);
    expect(rails[2]).toBe(keyB);
    expect(rails[3]).toBe(statik);
  });

  it('ArrowRight chains across mixed rails and ArrowLeft walks back', () => {
    const keyA = rail(2, 'key-a');
    const motion = rail(4, 'motion');
    const keyB = rail(6, 'key-b');
    const statik = rail(8, 'static');
    const scope = lane([keyA, motion, keyB, statik]);
    expect(findAdjacentRail(getRailsInCanonicalOrder(scope), keyA, 1)).toBe(motion);
    expect(findAdjacentRail(getRailsInCanonicalOrder(scope), motion, 1)).toBe(keyB);
    expect(findAdjacentRail(getRailsInCanonicalOrder(scope), keyB, 1)).toBe(statik);
    expect(findAdjacentRail(getRailsInCanonicalOrder(scope), statik, -1)).toBe(keyB);

    const { event } = keyEvent('ArrowRight');
    dispatchRailTargetKeyDown(event, scope, keyA);
    expect(keyB.focused).toBe(false);
    expect(motion.focused).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(event.stopPropagation).toHaveBeenCalledOnce();
  });

  it('stays put at the first/last rail with no wrap and never descends into frame navigation', () => {
    const keyA = rail(2, 'key-a');
    const statik = rail(8, 'static');
    const scope = lane([keyA, statik]);
    const right = keyEvent('ArrowRight');
    dispatchRailTargetKeyDown(right.event, scope, statik);
    expect(statik.focused).toBe(false);
    expect(right.preventDefault).toHaveBeenCalledOnce();
    expect(right.stopPropagation).toHaveBeenCalledOnce();

    const left = keyEvent('ArrowLeft');
    dispatchRailTargetKeyDown(left.event, scope, keyA);
    expect(keyA.focused).toBe(false);
    expect(left.preventDefault).toHaveBeenCalledOnce();
    expect(left.stopPropagation).toHaveBeenCalledOnce();
  });

  it('Tab roves to the next rail and exits to the stable scroller at the boundary', () => {
    const keyA = rail(2, 'key-a');
    const motion = rail(4, 'motion');
    const scroller = rail(-1, 'scroller');
    const scope = lane([keyA, motion], scroller);

    const tab = keyEvent('Tab');
    dispatchRailTargetKeyDown(tab.event, scope, keyA);
    expect(motion.focused).toBe(true);
    expect(tab.preventDefault).toHaveBeenCalledOnce();

    const exitTab = keyEvent('Tab');
    dispatchRailTargetKeyDown(exitTab.event, scope, motion);
    expect(scroller.focused).toBe(true);
    expect(exitTab.preventDefault).toHaveBeenCalledOnce();

    const backShiftTab = keyEvent('Tab', { shiftKey: true });
    dispatchRailTargetKeyDown(backShiftTab.event, scope, keyA);
    expect(scroller.focused).toBe(true);
  });

  it('roves the single tab stop onto the focused rail', () => {
    const keyA = rail(2, 'key-a');
    const motion = rail(4, 'motion');
    const statik = rail(8, 'static');
    const scope = lane([keyA, motion, statik]);
    roveRailTargetFocus(scope, motion);
    expect(motion.tabIndex).toBe(0);
    expect(keyA.tabIndex).toBe(-1);
    expect(statik.tabIndex).toBe(-1);
    applyRailRovingTabIndex([keyA, motion, statik], statik);
    expect(statik.tabIndex).toBe(0);
    expect(keyA.tabIndex).toBe(-1);
    expect(motion.tabIndex).toBe(-1);
  });
});
