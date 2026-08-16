export interface KeyRailFocusElementLike {
  readonly isConnected: boolean;
}

export interface KeyRailFocusActiveElementLike {
  readonly tagName: string;
}

/**
 * Decides whether a Key Rail commit (Delete/Undo/Redo) orphaned DOM focus.
 * When the focused rail button is removed, the browser drops focus to body;
 * a live control (toolbar Delete, a roto cell, another rail) keeps focus and
 * must not be stolen. Mirrors the rail-commit precedent's timeline-container
 * fallback (D-24).
 */
export function shouldRestoreOrphanedKeyRailFocus(
  lastFocusedElement: KeyRailFocusElementLike | null,
  activeElement: KeyRailFocusActiveElementLike | null,
): boolean {
  return lastFocusedElement !== null
    && !lastFocusedElement.isConnected
    && activeElement !== null
    && activeElement.tagName === 'BODY';
}
