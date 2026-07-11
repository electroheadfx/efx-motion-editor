import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPhysicsPaintShortcutTarget } from './physicsPaintStudioKeyboard';

class TestHTMLElement {
  tagName: string;
  isContentEditable: boolean;
  private readonly closestMatch: Element | null;

  constructor(tagName: string, options: { contentEditable?: boolean; closestMatch?: Element | null } = {}) {
    this.tagName = tagName.toUpperCase();
    this.isContentEditable = options.contentEditable ?? false;
    this.closestMatch = options.closestMatch ?? null;
  }

  closest(): Element | null {
    return this.closestMatch;
  }
}

describe('isPhysicsPaintShortcutTarget', () => {
  const originalHTMLElement = globalThis.HTMLElement;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('HTMLElement', originalHTMLElement);
  });

  it('allows non-element and regular element targets', () => {
    vi.stubGlobal('HTMLElement', TestHTMLElement);

    expect(isPhysicsPaintShortcutTarget(null)).toBe(true);
    expect(isPhysicsPaintShortcutTarget(new EventTarget())).toBe(true);
    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('div') as unknown as EventTarget)).toBe(true);
  });

  it.each(['input', 'textarea', 'select'])('blocks direct %s targets', (tagName) => {
    vi.stubGlobal('HTMLElement', TestHTMLElement);

    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement(tagName) as unknown as EventTarget)).toBe(false);
  });

  it('blocks contenteditable elements and descendants of editable controls', () => {
    vi.stubGlobal('HTMLElement', TestHTMLElement);
    const editableAncestor = new TestHTMLElement('div') as unknown as Element;

    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('div', { contentEditable: true }) as unknown as EventTarget)).toBe(false);
    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('span', { closestMatch: editableAncestor }) as unknown as EventTarget)).toBe(false);
  });
});
