// ============================================================
//  61-16 Task 2 (G-4 / CR-02) — the text-entry target predicate.
//
//  Laws pinned here:
//    - the predicate is dependency-free: no DOM global, no
//      `instanceof`, no import — so it runs in the node test
//      environment and the overlay's window listener can call it
//      without pulling a real DOM in (a `.test.ts` file, never
//      `.test.tsx`);
//    - every text-entry shape answers true: INPUT / TEXTAREA /
//      SELECT (case-insensitively) and contenteditable, whether
//      the flag or a `closest()` walk reports it;
//    - everything else — null, undefined, a plain object, a
//      string, a non-editable element — answers false, so the
//      vector keys keep working on the canvas and the overlay.
// ============================================================
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isTextEntryTarget } from './shortcutTextTarget';
// 61-21 (WR-05): the widened predicate is exercised through the module
// surface, so the pin observes the module's ONE exported yield predicate.
import * as shortcutTextTargetSurface from './shortcutTextTarget';

describe('shortcutTextTarget — the text-entry predicate (61-16)', () => {
  it('is false for every non-element target', () => {
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget(undefined)).toBe(false);
    expect(isTextEntryTarget({})).toBe(false);
    expect(isTextEntryTarget('div')).toBe(false);
    expect(isTextEntryTarget(7)).toBe(false);
  });

  it('is true for every form tag, case-insensitively', () => {
    expect(isTextEntryTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'input' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'SELECT' })).toBe(true);
  });

  it('is true for a contenteditable element, by flag or by a closest() hit', () => {
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'DIV', closest: () => ({}) })).toBe(true);
    expect(isTextEntryTarget({ tagName: 'DIV', closest: () => null })).toBe(false);
    expect(isTextEntryTarget({ tagName: 'DIV', isContentEditable: false })).toBe(false);
  });

  it('answers false and never throws when closest() throws', () => {
    const detached = {
      tagName: 'DIV',
      closest: () => {
        throw new Error('detached');
      },
    };
    expect(() => isTextEntryTarget(detached)).not.toThrow();
    expect(isTextEntryTarget(detached)).toBe(false);
  });

  it('the source carries no DOM global and no instanceof (the leaf law)', () => {
    const source = readFileSync(resolve(__dirname, './shortcutTextTarget.ts'), 'utf8');
    expect(source).not.toContain('instanceof');
    expect(source).not.toContain('HTMLElement');
    expect(source).not.toContain('document.');
    expect(source).not.toContain('window.');
    expect(source).not.toMatch(/^import /m);
  });
});

// 61-21 (WR-05): the capture-phase listener owns Enter/Escape/Delete for the
// canvas, so any target that owns its OWN keystrokes must stand it down. A
// focused control is such a target even though it is not a text field: Enter
// activates the button and Delete/Backspace edit the control, never the path.
describe('61-21 WR-05 — the focusable-control yield', () => {
  const isKeyboardOwnedTargetFromModule = (
    shortcutTextTargetSurface as unknown as {
      isKeyboardOwnedTarget?: (target: unknown) => boolean;
    }
  ).isKeyboardOwnedTarget;

  it('is true for every focusable non-text control the listener must yield to', () => {
    expect(typeof isKeyboardOwnedTargetFromModule).toBe('function');
    // A real focused control answers its own ancestor walk; the fake answers the
    // selector query the same way, so the pin observes the predicate's matching.
    const controlTarget = (token: string) => ({
      tagName: 'DIV',
      closest: (selector: string) => (selector.includes(token) ? {} : null),
    });
    for (const token of [
      'button',
      'a[href]',
      '[role="button"]',
      '[role="menuitem"]',
      '[role="link"]',
      '[role="tab"]',
    ]) {
      expect(isKeyboardOwnedTargetFromModule!(controlTarget(token)), token).toBe(true);
    }
    // The canvas owns no keystrokes: the vector keys keep working there.
    expect(isKeyboardOwnedTargetFromModule!({ tagName: 'DIV', closest: () => null })).toBe(false);
    expect(isKeyboardOwnedTargetFromModule!({ tagName: 'CANVAS', closest: () => null })).toBe(false);
  });

  it('covers the six focusable controls and the shipped text-entry four in one selector', () => {
    const source = readFileSync(resolve(__dirname, './shortcutTextTarget.ts'), 'utf8');
    const selector = /const \w+_SELECTOR = '([^']+)'/.exec(source)?.[1] ?? '';
    for (const token of [
      'input',
      'textarea',
      'select',
      '[contenteditable="true"]',
      'button',
      'a[href]',
      '[role="button"]',
      '[role="menuitem"]',
      '[role="link"]',
      '[role="tab"]',
    ]) {
      expect(selector, token).toContain(token);
    }
    // One constant, one predicate: no second selector grows beside it.
    expect(source.match(/_SELECTOR = '/g) ?? []).toHaveLength(1);
  });

  it('stays dependency-free: no DOM global and no type-identity reference', () => {
    const source = readFileSync(resolve(__dirname, './shortcutTextTarget.ts'), 'utf8');
    expect(source).not.toContain('document');
    expect(source).not.toContain('window');
    expect(source).not.toContain('HTMLElement');
    expect(source).not.toContain('Element');
    expect(source).not.toContain('instanceof');
  });
});
