import { describe, expect, it, vi } from 'vitest';
import {
  applyRailRovingTabIndex,
  dispatchRailTargetKeyDown,
  findAdjacentRail,
  focusRailTargetOnPointerSelection,
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
  closest(selector: string): FakeScope | null;
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
    closest: () => null,
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

  // 43.6 matrix row 8: with an active rail set the shared machinery already
  // visits set members in canonical first-frame order and falls through to
  // non-member rails and the scroller exit — no set-aware focus code exists.
  it('visits set members in canonical first-frame order and falls through outside the set', () => {
    const r2 = rail(2, 'r2');
    const r4 = rail(4, 'r4');
    const r6 = rail(6, 'r6');
    const r8 = rail(8, 'r8');
    const r10 = rail(10, 'r10');
    const scroller = rail(-1, 'scroller');
    const scope = lane([r2, r4, r6, r8, r10], scroller);
    const all = [r2, r4, r6, r8, r10, scroller];
    const resetFocus = () => { all.forEach((candidate) => { candidate.focused = false; }); };
    const walk = (from: FakeRail, key: string): FakeRail | null => {
      resetFocus();
      const { event } = keyEvent(key);
      dispatchRailTargetKeyDown(event, scope, from);
      return all.find((candidate) => candidate.focused) ?? null;
    };

    // Members at frames 2, 6, 10; non-members at 4 and 8 interleave.
    expect(walk(r2, 'ArrowRight')).toBe(r4);
    expect(walk(r4, 'ArrowRight')).toBe(r6);
    expect(walk(r6, 'ArrowRight')).toBe(r8);
    expect(walk(r8, 'ArrowRight')).toBe(r10);
    // Past the last member the cycle falls through to the ordinary scroller
    // exit with no wrap.
    const { event } = keyEvent('ArrowRight');
    dispatchRailTargetKeyDown(event, scope, r10);
    expect(r10.focused).toBe(false);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});

// 43.4 defect 10: a direct pointer click on ANY rail family must move DOM
// focus to the clicked rail's target button (identical for Key/Motion/Static),
// so the shared :focus ring paints immediately instead of depending on the
// browser's native button-click-focus behavior.
describe('pointer-click focus on every rail family (43.4 defect 10)', () => {
  it('moves DOM focus to the clicked rail target and roves the tab stop onto it', () => {
    const keyA = rail(2, 'key-a');
    const motion = rail(4, 'motion');
    const scope = lane([keyA, motion]);
    const clicked = Object.assign(keyA, {
      closest: (selector: string) => (selector === '.physics-paint-lane' ? scope : null),
    });
    focusRailTargetOnPointerSelection({ currentTarget: clicked as unknown as EventTarget });
    expect(keyA.focused).toBe(true);
    expect(keyA.tabIndex).toBe(0);
    expect(motion.tabIndex).toBe(-1);
  });

  it('leaves focus untouched when the click target has no rail-lane ancestor', () => {
    const keyA = rail(2, 'key-a');
    focusRailTargetOnPointerSelection({
      currentTarget: Object.assign(keyA, { closest: () => null }) as unknown as EventTarget,
    });
    expect(keyA.focused).toBe(false);
  });

  it('leaves focus untouched for programmatic dispatches without a currentTarget', () => {
    const keyA = rail(2, 'key-a');
    focusRailTargetOnPointerSelection({ currentTarget: null });
    expect(keyA.focused).toBe(false);
  });
});
