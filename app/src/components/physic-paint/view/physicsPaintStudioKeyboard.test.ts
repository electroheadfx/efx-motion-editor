import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatchPhysicsPaintStudioKeyDown, isPhysicsPaintShortcutTarget } from './physicsPaintStudioKeyboard';

interface TestTargetOptions {
  contentEditable?: boolean;
  closestSelectors?: string[];
  modalOpen?: boolean;
}

class TestHTMLElement {
  tagName: string;
  isContentEditable: boolean;
  ownerDocument: { querySelector: (selector: string) => Element | null };
  private readonly closestSelectors: Set<string>;

  constructor(tagName: string, options: TestTargetOptions = {}) {
    this.tagName = tagName.toUpperCase();
    this.isContentEditable = options.contentEditable ?? false;
    this.closestSelectors = new Set(options.closestSelectors ?? []);
    this.ownerDocument = {
      querySelector: () => options.modalOpen ? this as unknown as Element : null,
    };
  }

  closest(selector: string): Element | null {
    const selectors = selector.split(',').map((candidate) => candidate.trim());
    return selectors.some((candidate) => this.closestSelectors.has(candidate))
      ? this as unknown as Element
      : null;
  }
}

function actions() {
  return {
    undo: vi.fn(),
    redo: vi.fn(),
    deleteRotoKey: vi.fn(),
    toggleShortcuts: vi.fn(),
    toggleRotoPlayback: vi.fn(),
    navigateRotoFrame: vi.fn(),
    toggleOnion: vi.fn(),
    adjustOnionCount: vi.fn(),
  };
}

function eventFor(key: string, target: EventTarget | null = null, overrides: Record<string, unknown> = {}) {
  const preventDefault = vi.fn();
  return {
    event: {
      target,
      preventDefault,
      key,
      repeat: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      ...overrides,
    } as unknown as KeyboardEvent,
    preventDefault,
  };
}

function dispatch(key: string, target: EventTarget | null = null, overrides: Record<string, unknown> = {}) {
  const handlers = actions();
  const keyboardEvent = eventFor(key, target, overrides);
  dispatchPhysicsPaintStudioKeyDown(
    keyboardEvent.event,
    { currentFrame: 4, isPlaying: false, mutationLocked: false },
    handlers,
    [{ frame: 1 }, { frame: 3 }, { frame: 7 }],
  );
  return { handlers, preventDefault: keyboardEvent.preventDefault };
}

beforeEach(() => {
  vi.stubGlobal('HTMLElement', TestHTMLElement);
  vi.stubGlobal('Element', TestHTMLElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Physics Paint Roto delete shortcuts', () => {
  it.each(['Backspace', 'Delete'])('dispatches %s exactly once and prevents its browser default once', (key) => {
    const { handlers, preventDefault } = dispatch(key, new TestHTMLElement('canvas') as unknown as EventTarget);

    expect(handlers.deleteRotoKey).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it.each(['Backspace', 'Delete'])('suppresses repeated and modified %s events', (key) => {
    for (const overrides of [
      { repeat: true },
      { metaKey: true },
      { ctrlKey: true },
      { altKey: true },
      { shiftKey: true },
    ]) {
      const { handlers, preventDefault } = dispatch(key, new TestHTMLElement('canvas') as unknown as EventTarget, overrides);
      expect(handlers.deleteRotoKey).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['input', new TestHTMLElement('input')],
    ['textarea', new TestHTMLElement('textarea')],
    ['select', new TestHTMLElement('select')],
    ['contenteditable target', new TestHTMLElement('div', { contentEditable: true })],
    ['contenteditable ancestor', new TestHTMLElement('span', { closestSelectors: ['[contenteditable="true"]'] })],
    ['script rename field', new TestHTMLElement('input', { closestSelectors: ['.physics-paint-script-rename'] })],
    ['Play Script count field', new TestHTMLElement('input', { closestSelectors: ['.physics-paint-play-script-count'] })],
    ['open dialog or modal', new TestHTMLElement('div', { modalOpen: true })],
    ['unrelated button', new TestHTMLElement('button', { closestSelectors: ['button'] })],
    ['link', new TestHTMLElement('a', { closestSelectors: ['a[href]'] })],
  ])('protects %s from destructive keyboard deletion', (_name, target) => {
    const { handlers, preventDefault } = dispatch('Backspace', target as unknown as EventTarget);

    expect(handlers.deleteRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it.each([
    'button',
    'checkbox',
    'combobox',
    'link',
    'listbox',
    'menuitem',
    'menuitemcheckbox',
    'menuitemradio',
    'option',
    'radio',
    'searchbox',
    'slider',
    'spinbutton',
    'switch',
    'tab',
    'textbox',
    'treeitem',
  ])('protects role="%s" controls', (role) => {
    const target = new TestHTMLElement('div', { closestSelectors: [`[role="${role}"]`] });
    const { handlers, preventDefault } = dispatch('Delete', target as unknown as EventTarget);

    expect(handlers.deleteRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it.each([
    ['current Roto cell button', new TestHTMLElement('button', { closestSelectors: ['.physics-paint-roto-cell.current', 'button'] })],
    ['child of current Roto cell button', new TestHTMLElement('span', { closestSelectors: ['.physics-paint-roto-cell.current', 'button'] })],
    ['Studio root', new TestHTMLElement('section')],
    ['canvas', new TestHTMLElement('canvas')],
    ['ordinary timeline target', new TestHTMLElement('div')],
  ])('allows deletion from the %s', (_name, target) => {
    const { handlers, preventDefault } = dispatch('Delete', target as unknown as EventTarget);

    expect(handlers.deleteRotoKey).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('does not prevent deletion when no delete action is installed', () => {
    const handlers = actions();
    const { deleteRotoKey: _deleteRotoKey, ...handlersWithoutDelete } = handlers;
    const keyboardEvent = eventFor('Delete', new TestHTMLElement('canvas') as unknown as EventTarget);

    dispatchPhysicsPaintStudioKeyDown(
      keyboardEvent.event,
      { currentFrame: 4, isPlaying: false, mutationLocked: false },
      handlersWithoutDelete,
      [],
    );

    expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
  });
});

describe('Physics Paint established shortcuts', () => {
  it.each([
    [{ metaKey: true, shiftKey: true, key: 'z' }, 'redo'],
    [{ ctrlKey: true, shiftKey: true, key: 'Z' }, 'redo'],
    [{ ctrlKey: true, key: 'y' }, 'redo'],
    [{ metaKey: true, key: 'z' }, 'undo'],
    [{ ctrlKey: true, key: 'z' }, 'undo'],
  ])('dispatches history shortcut exclusively', (init, expected) => {
    const { handlers, preventDefault } = dispatch(String(init.key), null, init);

    expect(handlers[expected as 'undo' | 'redo']).toHaveBeenCalledOnce();
    expect(handlers[expected === 'undo' ? 'redo' : 'undo']).not.toHaveBeenCalled();
    expect(handlers.deleteRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it.each([
    ['?', {}, 'toggleShortcuts', undefined],
    ['/', { shiftKey: true }, 'toggleShortcuts', undefined],
    [' ', {}, 'toggleRotoPlayback', undefined],
    ['ArrowLeft', {}, 'navigateRotoFrame', 3],
    ['ArrowRight', {}, 'navigateRotoFrame', 5],
    ['ArrowLeft', { shiftKey: true }, 'navigateRotoFrame', 3],
    ['ArrowRight', { shiftKey: true }, 'navigateRotoFrame', 7],
    ['g', {}, 'navigateRotoFrame', 4],
    ['o', {}, 'toggleOnion', undefined],
    ['[', {}, 'adjustOnionCount', -1],
    [']', {}, 'adjustOnionCount', 1],
  ])('keeps %s on its established action', (key, overrides, action, expectedArgument) => {
    const { handlers, preventDefault } = dispatch(key, null, overrides);
    const handler = handlers[action as keyof ReturnType<typeof actions>];

    expect(handler).toHaveBeenCalledOnce();
    if (expectedArgument !== undefined) expect(handler).toHaveBeenCalledWith(expectedArgument);
    expect(handlers.deleteRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

describe('isPhysicsPaintShortcutTarget', () => {
  it('allows regular targets and blocks editable controls', () => {
    expect(isPhysicsPaintShortcutTarget(null)).toBe(true);
    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('div') as unknown as EventTarget)).toBe(true);
    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('input') as unknown as EventTarget)).toBe(false);
    expect(isPhysicsPaintShortcutTarget(new TestHTMLElement('div', { contentEditable: true }) as unknown as EventTarget)).toBe(false);
  });
});
