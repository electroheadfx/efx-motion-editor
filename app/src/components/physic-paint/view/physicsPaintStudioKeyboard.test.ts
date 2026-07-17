import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchPhysicsPaintStudioKeyDown, isPhysicsPaintShortcutTarget } from './physicsPaintStudioKeyboard';

class TestHTMLElement {
  tagName: string;
  isContentEditable: boolean;
  private readonly closestMatch: Element | null;
  constructor(tagName: string, options: { contentEditable?: boolean; closestMatch?: Element | null } = {}) {
    this.tagName = tagName.toUpperCase(); this.isContentEditable = options.contentEditable ?? false; this.closestMatch = options.closestMatch ?? null;
  }
  closest(): Element | null { return this.closestMatch; }
}

function actions() {
  return { undo: vi.fn(), redo: vi.fn(), toggleShortcuts: vi.fn(), toggleRotoPlayback: vi.fn(), navigateRotoFrame: vi.fn(), toggleOnion: vi.fn(), adjustOnionCount: vi.fn() };
}

describe('Physics Paint Undo/Redo shortcuts', () => {
  it.each([
    [{ metaKey: true, shiftKey: true, key: 'z' }, 'redo'], [{ ctrlKey: true, shiftKey: true, key: 'Z' }, 'redo'],
    [{ ctrlKey: true, key: 'y' }, 'redo'], [{ metaKey: true, key: 'z' }, 'undo'], [{ ctrlKey: true, key: 'z' }, 'undo'],
  ])('dispatches history shortcut exclusively', (init, expected) => {
    vi.stubGlobal('HTMLElement', TestHTMLElement);
    const preventDefault = vi.fn(); const handlers = actions();
    dispatchPhysicsPaintStudioKeyDown({ target: null, preventDefault, metaKey: false, ctrlKey: false, shiftKey: false, ...init } as unknown as KeyboardEvent,
      { currentFrame: 0, isPlaying: false, mutationLocked: false }, handlers, []);
    expect(handlers[expected as 'undo' | 'redo']).toHaveBeenCalledOnce();
    expect(handlers[expected === 'undo' ? 'redo' : 'undo']).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('keeps cached Roto playback on the Space shortcut', () => {
    vi.stubGlobal('HTMLElement', TestHTMLElement);
    const preventDefault = vi.fn(); const handlers = actions();
    dispatchPhysicsPaintStudioKeyDown({ target: null, preventDefault, key: ' ', metaKey: false, ctrlKey: false, shiftKey: false } as unknown as KeyboardEvent,
      { currentFrame: 4, isPlaying: false, mutationLocked: false }, handlers, []);
    expect(handlers.toggleRotoPlayback).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

describe('isPhysicsPaintShortcutTarget', () => {
  const originalHTMLElement = globalThis.HTMLElement;
  afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal('HTMLElement', originalHTMLElement); });
  it('allows regular targets and blocks editable controls', () => {
    vi.stubGlobal('HTMLElement', TestHTMLElement);
    expect(isPhysicsPaintShortcutTarget(null)).toBe(true);
    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('div') as unknown as EventTarget)).toBe(true);
    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('input') as unknown as EventTarget)).toBe(false);
    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('div', { contentEditable: true }) as unknown as EventTarget)).toBe(false);
  });
});
