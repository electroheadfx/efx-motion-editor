// 61-16 Task 2 (G-4 / CR-02), widened by 61-21 (WR-05) — the keyboard-owner
// target predicate.
//
// The vector overlay's keydown listener is bound in the CAPTURE phase, so it
// sees every keystroke in the Studio before the focused control does. Before
// either vector key handler runs, the listener asks this predicate whether the
// event target owns its own keystrokes: a text field (Enter submits, Delete
// edits) or any focusable control (Enter activates it, Delete reaches it).
// When it does, the vector listeners stand down and prevent nothing.
//
// Dependency-free on purpose. No DOM global, no type-identity check, no import:
// the overlay is a leaf module and must stay callable from a node-environment
// test (the Studio's `isPhysicsPaintShortcutTarget` needs a real DOM and is
// deliberately NOT reused here). Every check is duck-typed on the target.
const KEYBOARD_OWNED_SELECTOR = 'input, textarea, select, [contenteditable="true"], button, a[href], [role="button"], [role="menuitem"], [role="link"], [role="tab"]';

/**
 * Does this event target own its own keystrokes?
 *
 * True for INPUT / TEXTAREA / SELECT (case-insensitively), a contenteditable
 * node (via the flag or an ancestor walk), and any focused control matching the
 * selector above — button, link, role=button/menuitem/link/tab — including any
 * descendant of one. False for everything else: null, a non-object, an unknown
 * node, and a target whose ancestor walk throws.
 */
export function isKeyboardOwnedTarget(target: unknown): boolean {
  if (target === null || target === undefined || typeof target !== 'object') return false;
  const candidate = target as {
    tagName?: unknown;
    isContentEditable?: unknown;
    closest?: unknown;
  };
  const tagName = typeof candidate.tagName === 'string' ? candidate.tagName.toLowerCase() : '';
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') return true;
  if (candidate.isContentEditable === true) return true;
  if (typeof candidate.closest !== 'function') return false;
  try {
    return Boolean((candidate.closest as (selector: string) => unknown)(KEYBOARD_OWNED_SELECTOR));
  } catch {
    // A detached node cannot walk its ancestors; it owns nothing.
    return false;
  }
}
