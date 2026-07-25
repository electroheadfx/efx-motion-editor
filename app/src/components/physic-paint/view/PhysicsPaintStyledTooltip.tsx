import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

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

export interface PhysicsPaintStyledTooltipProps {
  id?: string;
  visible: boolean;
  children: ComponentChildren;
}

/**
 * Dark-pill tooltip surface. Renders nothing while hidden. Content is always
 * Preact text children — controller-supplied reason strings are never
 * injected as HTML (T-36.15-01).
 */
export function PhysicsPaintStyledTooltip(props: PhysicsPaintStyledTooltipProps) {
  if (!props.visible) return null;
  return (
    <span id={props.id} role="tooltip" class="physics-paint-styled-tooltip">
      {props.children}
    </span>
  );
}
