import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

export const STYLED_TOOLTIP_DELAY_MS = 1000;

export interface StyledTooltipController {
  visible: boolean;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  hide: () => void;
}

/**
 * Shared styled-tooltip controller (D-14/D-17).
 *
 * - Pointer hover shows the tooltip only after exactly `delayMs` (1000ms) —
 *   never instantly; pointerleave cancels a pending show and dismisses.
 * - Keyboard focus shows immediately (guarded reasons must be reachable
 *   without a pointer); blur hides.
 * - Escape hides; the window keydown listener is registered only while the
 *   tooltip is visible (same listener discipline as the strip drag session:
 *   idempotent cleanup plus a mountedRef guard).
 * - `hide()` is called on activation so the tooltip never lingers after the
 *   guarded action runs.
 */
export function useStyledTooltip(delayMs: number = STYLED_TOOLTIP_DELAY_MS): StyledTooltipController {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const escapeHandlerRef = useRef<((event: KeyboardEvent) => void) | null>(null);
  const mountedRef = useRef(true);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function removeEscapeListener() {
    if (escapeHandlerRef.current !== null && typeof window !== 'undefined') {
      window.removeEventListener('keydown', escapeHandlerRef.current);
      escapeHandlerRef.current = null;
    }
  }

  function hide() {
    clearTimer();
    removeEscapeListener();
    if (mountedRef.current) setVisible(false);
  }

  function show() {
    if (!mountedRef.current) return;
    setVisible(true);
    if (typeof window === 'undefined' || escapeHandlerRef.current !== null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') hide();
    };
    escapeHandlerRef.current = handleKeyDown;
    window.addEventListener('keydown', handleKeyDown);
  }

  function onPointerEnter() {
    clearTimer();
    timerRef.current = setTimeout(show, delayMs);
  }

  function onPointerLeave() {
    hide();
  }

  function onFocus() {
    clearTimer();
    show();
  }

  function onBlur() {
    hide();
  }

  useEffect(() => () => {
    mountedRef.current = false;
    clearTimer();
    removeEscapeListener();
  }, []);

  return { visible, onPointerEnter, onPointerLeave, onFocus, onBlur, hide };
}

export type TooltipRegion = 'top' | 'bottom' | 'left-edge' | 'right-edge';
export type TooltipDirection = 'above' | 'below' | 'left' | 'right';

export const TOOLTIP_VIEWPORT_MARGIN = 8;
export const TOOLTIP_PILL_MAX_WIDTH = 280;

/** Gap between the anchor edge and the pill, occupied by the notch (D-13). */
const TOOLTIP_NOTCH_GAP = 6;
/** Notch triangle base is 10px (UI-SPEC locked 10x6). */
const TOOLTIP_NOTCH_BASE = 10;

export interface TooltipPlacement {
  direction: TooltipDirection;
  left: number;
  top: number;
  notchOffset: number;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Pure viewport placement for the shared styled tooltip (D-11/D-12/D-13).
 *
 * - Preferred direction is opposite-of-region: bottom-of-UI anchors render
 *   above, top-of-UI below, right-edge anchors to the left, left-edge to the
 *   right.
 * - Flips to the opposite direction when the preferred side lacks room
 *   between the anchor and the viewport edge (8px margin + 6px notch gap).
 * - The pill is centered on the anchor along the cross axis, then clamped
 *   inside the viewport with the locked 8px margin on all sides.
 * - notchOffset tracks the anchor center AFTER clamping (never the pill
 *   center) and is itself clamped so the notch stays inside the pill's
 *   rounded ends.
 *
 * Reads no element state — the anchor rect and pill size are parameters so
 * the function stays unit-testable; only the viewport size is read from the
 * window global.
 */
export function computeTooltipPlacement(
  anchorRect: DOMRect,
  region: TooltipRegion,
  pillSize: { width: number; height: number },
): TooltipPlacement {
  const margin = TOOLTIP_VIEWPORT_MARGIN;
  const gap = TOOLTIP_NOTCH_GAP;
  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight;

  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  const anchorCenterY = anchorRect.top + anchorRect.height / 2;

  const preferred: TooltipDirection =
    region === 'bottom' ? 'above'
      : region === 'top' ? 'below'
        : region === 'right-edge' ? 'left'
          : 'right';

  let direction = preferred;
  if (preferred === 'above' && anchorRect.top - gap - pillSize.height < margin) {
    direction = 'below';
  } else if (preferred === 'below' && anchorRect.bottom + gap + pillSize.height > viewportHeight - margin) {
    direction = 'above';
  } else if (preferred === 'left' && anchorRect.left - gap - pillSize.width < margin) {
    direction = 'right';
  } else if (preferred === 'right' && anchorRect.right + gap + pillSize.width > viewportWidth - margin) {
    direction = 'left';
  }

  let left: number;
  let top: number;
  if (direction === 'above') {
    left = anchorCenterX - pillSize.width / 2;
    top = anchorRect.top - gap - pillSize.height;
  } else if (direction === 'below') {
    left = anchorCenterX - pillSize.width / 2;
    top = anchorRect.bottom + gap;
  } else if (direction === 'left') {
    left = anchorRect.left - gap - pillSize.width;
    top = anchorCenterY - pillSize.height / 2;
  } else {
    left = anchorRect.right + gap;
    top = anchorCenterY - pillSize.height / 2;
  }

  left = clampValue(left, margin, viewportWidth - pillSize.width - margin);
  top = clampValue(top, margin, viewportHeight - pillSize.height - margin);

  const isVertical = direction === 'above' || direction === 'below';
  const crossSize = isVertical ? pillSize.width : pillSize.height;
  // Keep the notch inside the pill's rounded ends: the fully rounded end caps
  // span half the pill height on the horizontal cross axis; on the vertical
  // cross axis the notch half-base is the meaningful bound.
  const endPad = isVertical ? pillSize.height / 2 : TOOLTIP_NOTCH_BASE / 2;
  const rawOffset = isVertical ? anchorCenterX - left : anchorCenterY - top;
  const notchOffset = clampValue(rawOffset, endPad, crossSize - endPad);

  return { direction, left, top, notchOffset };
}

export interface PhysicsPaintStyledTooltipProps {
  id?: string;
  visible: boolean;
  /**
   * UI region of the anchor — the pill renders on the opposite side (D-11).
   * Optional during the 38-05 mount-conversion sequence; defaults to
   * 'bottom' (renders above), matching the legacy default outcome. Made
   * required once every mount declares its region.
   */
  region?: TooltipRegion;
  children: ComponentChildren;
}

/**
 * Dark-pill tooltip surface. Renders nothing while hidden. Content is always
 * Preact text children — controller-supplied reason strings are never
 * injected as HTML (T-36.15-01).
 *
 * Viewport-positioned (D-12): while visible, the pill reads its anchor
 * wrapper's getBoundingClientRect() after every render — viewport
 * coordinates absorb strip horizontal scroll — and is placed through
 * computeTooltipPlacement. The containing-block audit found no transformed,
 * filtered, or containing ancestor for any mount, so `position: fixed`
 * resolves against the viewport with the pill rendered in place (no portal).
 * Coordinates and the direction class are written straight onto the element
 * before paint — no state is copied into a render cycle.
 */
export function PhysicsPaintStyledTooltip(props: PhysicsPaintStyledTooltipProps) {
  const pillRef = useRef<HTMLSpanElement | null>(null);

  useLayoutEffect(() => {
    const pill = pillRef.current;
    if (!props.visible || !pill) return;
    const anchor = pill.parentElement;
    if (!anchor) return;
    const pillSize = { width: pill.offsetWidth, height: pill.offsetHeight };
    const placement = computeTooltipPlacement(
      anchor.getBoundingClientRect(),
      props.region ?? 'bottom',
      pillSize,
    );
    pill.style.left = `${placement.left}px`;
    pill.style.top = `${placement.top}px`;
    pill.className = `physics-paint-styled-tooltip physics-paint-styled-tooltip--${placement.direction}`;
    // The pill's locked overflow clipping would hide an absolutely positioned
    // notch child, so the notch escapes via viewport-fixed positioning: its
    // edge point is the anchor-center projection on the pill's control-facing
    // edge, derived from the post-clamp placement.
    const notchX = placement.direction === 'left'
      ? placement.left + pillSize.width
      : placement.direction === 'right'
        ? placement.left
        : placement.left + placement.notchOffset;
    const notchY = placement.direction === 'above'
      ? placement.top + pillSize.height
      : placement.direction === 'below'
        ? placement.top
        : placement.top + placement.notchOffset;
    pill.style.setProperty('--tooltip-notch-x', `${notchX}px`);
    pill.style.setProperty('--tooltip-notch-y', `${notchY}px`);
    pill.style.visibility = 'visible';
  });

  if (!props.visible) return null;
  return (
    <span
      ref={pillRef}
      id={props.id}
      role="tooltip"
      class="physics-paint-styled-tooltip"
      style={{ visibility: 'hidden' }}
    >
      <span class="physics-paint-styled-tooltip-notch" aria-hidden="true" />
      {props.children}
    </span>
  );
}
