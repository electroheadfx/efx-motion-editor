// 61-16 Task 2 (G-4 / CR-02) — the text-entry target predicate.
//
// The vector overlay's keydown listener lives on `window` in the CAPTURE phase,
// so it sees every keystroke in the Studio before the focused element does.
// Before either vector key handler runs, the listener asks this predicate
// whether the event target is a place the user types: if it is, Enter submits
// the dialog, Delete/Backspace edit the text, and nothing is prevented.
//
// Dependency-free on purpose. No DOM global, no type-identity check, no import:
// the overlay is a leaf module and must stay callable from a node-environment
// test (the Studio's `isPhysicsPaintShortcutTarget` needs a real DOM and is
// deliberately NOT reused here). Every check is duck-typed on the target.
const TEXT_ENTRY_SELECTOR = 'input, textarea, select, [contenteditable="true"]';

/**
 * Is this event target a text-entry surface?
 *
 * True for INPUT / TEXTAREA / SELECT (case-insensitively), a contenteditable
 * element (via the flag or a `closest()` walk), and any descendant of one.
 * False for everything else — including null, a non-object, an unknown
 * element, and a target whose `closest()` throws.
 */
export function isTextEntryTarget(target: unknown): boolean {
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
    return Boolean((candidate.closest as (selector: string) => unknown)(TEXT_ENTRY_SELECTOR));
  } catch {
    // A detached node cannot walk its ancestors; it is not a text field.
    return false;
  }
}
