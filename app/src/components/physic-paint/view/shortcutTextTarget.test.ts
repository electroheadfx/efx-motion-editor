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
