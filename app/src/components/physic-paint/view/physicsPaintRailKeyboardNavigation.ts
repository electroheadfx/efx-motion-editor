/**
 * Shared rail roving keyboard navigation (43.4 defect 9). One contract for
 * every rail family (Key/Motion/Static): the lane's rail targets form a single
 * roving tab stop ordered by canonical first-key frame, so Tab and ArrowLeft/
 * ArrowRight cycle focus rail-to-rail across ALL types and never descend into
 * frame cells. At the first/last rail, arrows stay put (no wrap) and Tab exits
 * to the stable timeline scroller (a non-cell control). Frame-level arrow
 * cycling stays in the Studio keyboard dispatcher (selection-gated, real keys
 * only).
 */
export const RAIL_TARGET_SELECTOR = '.physics-paint-rail-target';
export const RAIL_LANE_SELECTOR = '.physics-paint-lane';
export const RAIL_SCROLLER_SELECTOR = '.physics-paint-timeline-scroll';
const RAIL_FIRST_FRAME_ATTR = 'data-rail-first-frame';

export interface RailTargetLike {
  tabIndex: number;
  focus(): void;
  getAttribute(name: string): string | null;
}

export interface RailNavigationScope {
  querySelectorAll(selector: string): Iterable<RailTargetLike>;
  closest(selector: string): RailTargetLike | null;
}

export interface RailKeyNavigationEvent {
  readonly key: string;
  readonly shiftKey?: boolean;
  preventDefault(): void;
  stopPropagation(): void;
}

export function getRailsInCanonicalOrder(scope: RailNavigationScope): RailTargetLike[] {
  return [...scope.querySelectorAll(RAIL_TARGET_SELECTOR)].sort((left, right) => {
    const leftFrame = Number(left.getAttribute(RAIL_FIRST_FRAME_ATTR) ?? Number.POSITIVE_INFINITY);
    const rightFrame = Number(right.getAttribute(RAIL_FIRST_FRAME_ATTR) ?? Number.POSITIVE_INFINITY);
    if (leftFrame !== rightFrame) return leftFrame - rightFrame;
    // Stable sort preserves DOM order for ties (Key Rails before Motion/Static).
    return 0;
  });
}

export function findAdjacentRail(
  rails: readonly RailTargetLike[],
  current: RailTargetLike,
  direction: -1 | 1,
): RailTargetLike | null {
  const index = rails.indexOf(current);
  if (index === -1) return null;
  return rails[index + direction] ?? null;
}

export function applyRailRovingTabIndex(rails: readonly RailTargetLike[], current: RailTargetLike): void {
  for (const rail of rails) rail.tabIndex = rail === current ? 0 : -1;
}

export function roveRailTargetFocus(scope: RailNavigationScope, current: RailTargetLike): void {
  applyRailRovingTabIndex(getRailsInCanonicalOrder(scope), current);
}

/**
 * Handles ArrowLeft/ArrowRight/Tab on a focused rail target. Returns true when
 * the event was consumed (cycle to an adjacent rail, or exit the group at the
 * boundary); returns false so the rail's per-type Escape/Space/Enter handling
 * continues untouched.
 */
export function dispatchRailTargetKeyDown(
  event: RailKeyNavigationEvent,
  scope: RailNavigationScope,
  current: RailTargetLike,
): boolean {
  const key = event.key;
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    event.preventDefault();
    event.stopPropagation();
    const next = findAdjacentRail(getRailsInCanonicalOrder(scope), current, key === 'ArrowRight' ? 1 : -1);
    if (next) next.focus();
    return true;
  }
  if (key === 'Tab') {
    event.preventDefault();
    event.stopPropagation();
    const next = findAdjacentRail(getRailsInCanonicalOrder(scope), current, event.shiftKey === true ? -1 : 1);
    if (next) next.focus();
    else {
      const scroller = scope.closest(RAIL_SCROLLER_SELECTOR);
      (scroller ?? current).focus();
    }
    return true;
  }
  return false;
}
