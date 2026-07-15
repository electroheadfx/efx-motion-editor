import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchPhysicsPaintStudioKeyDown, isPhysicsPaintShortcutTarget } from './physicsPaintStudioKeyboard';

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

describe('Physics Paint Undo/Redo shortcuts', () => {
  it.each([
    [{ metaKey: true, shiftKey: true, key: 'z' }, 'redo'],
    [{ ctrlKey: true, shiftKey: true, key: 'Z' }, 'redo'],
    [{ ctrlKey: true, key: 'y' }, 'redo'],
    [{ metaKey: true, key: 'z' }, 'undo'],
    [{ ctrlKey: true, key: 'z' }, 'undo'],
  ])('dispatches $1 exclusively to $2', (init, expected) => {
    vi.stubGlobal('HTMLElement', TestHTMLElement);
    const preventDefault = vi.fn();
    const actions = {
      undo: vi.fn(), redo: vi.fn(), stopPreview: vi.fn(), savePlay: vi.fn(), toggleShortcuts: vi.fn(),
      toggleRotoPlayback: vi.fn(), navigateRotoFrame: vi.fn(), toggleOnion: vi.fn(), adjustOnionCount: vi.fn(),
      findCachedPlayFrames: vi.fn(), playPreview: vi.fn(),
    };
    dispatchPhysicsPaintStudioKeyDown({ target: null, preventDefault, metaKey: false, ctrlKey: false, shiftKey: false, ...init } as unknown as KeyboardEvent,
      { currentFrame: 0, framesToApply: 1, isPlaying: false, savedPlayCacheDirty: false, workflowMode: 'roto' }, actions, []);
    expect(actions[expected as 'undo' | 'redo']).toHaveBeenCalledOnce();
    expect(actions[expected === 'undo' ? 'redo' : 'undo']).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

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
