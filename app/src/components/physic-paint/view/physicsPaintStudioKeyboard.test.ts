import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dispatchPhysicsPaintStudioKeyDown,
  findAdjacentRealKeyFrame,
  isPhysicsPaintShortcutTarget,
  type PhysicsPaintStudioKeyboardState,
} from './physicsPaintStudioKeyboard';
import {
  disarmPushTool,
  isPushToolArmed,
  togglePushTool,
} from './physicsPaintPushArmedTool';

interface TestTargetOptions {
  contentEditable?: boolean;
  closestSelectors?: string[];
  /** A real modal (aria-modal="true") is present in the document. */
  modalOpen?: boolean;
  /** The toolbox popover (role="dialog" aria-modal="false") is present. */
  popoverOpen?: boolean;
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
      querySelector: (selector: string) => {
        if (options.modalOpen && selector === '[aria-modal="true"]') return this as unknown as Element;
        if (options.popoverOpen && selector === '[role="dialog"]') return this as unknown as Element;
        return null;
      },
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
    copyRotoKey: vi.fn(),
    cutRotoKey: vi.fn(),
    pasteRotoKey: vi.fn(),
    deleteRotoKey: vi.fn(),
    toggleShortcuts: vi.fn(),
    toggleRotoPlayback: vi.fn(),
    navigateRotoFrame: vi.fn(),
    toggleOnion: vi.fn(),
    adjustOnionCount: vi.fn(),
    selectAdjacentRotoKey: vi.fn(),
    selectAllRotoKeys: vi.fn(),
    collapseRotoSelection: vi.fn(),
    closeToolboxPopover: vi.fn(),
    disarmPushTool: vi.fn(),
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

function dispatch(
  key: string,
  target: EventTarget | null = null,
  overrides: Record<string, unknown> = {},
  stateOverrides: Partial<PhysicsPaintStudioKeyboardState> = {},
) {
  const handlers = actions();
  const keyboardEvent = eventFor(key, target, overrides);
  dispatchPhysicsPaintStudioKeyDown(
    keyboardEvent.event,
    { currentFrame: 4, isPlaying: false, mutationLocked: false, hasSelectedRotoKey: false, ...stateOverrides },
    handlers,
    [{ frame: 1 }, { frame: 3 }, { frame: 7 }],
  );
  return { handlers, preventDefault: keyboardEvent.preventDefault };
}

beforeEach(() => {
  vi.stubGlobal('HTMLElement', TestHTMLElement);
  vi.stubGlobal('Element', TestHTMLElement);
  // Reset the session-only armed-Push module so every test starts disarmed
  // (D-19 — armed state never persists between tests either).
  disarmPushTool();
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

  it.each(['Backspace', 'Delete'])('allows deletion from a selected Key Rail button (%s)', (key) => {
    const target = new TestHTMLElement('button', { closestSelectors: ['.physics-paint-key-rail-target.selected', 'button'] });
    const { handlers, preventDefault } = dispatch(key, target as unknown as EventTarget);

    expect(handlers.deleteRotoKey).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it.each(['Backspace', 'Delete'])('allows deletion from a selected Motion/Static Rail button (%s)', (key) => {
    const target = new TestHTMLElement('button', { closestSelectors: ['.physics-paint-loop-clip-rail-target.selected', 'button'] });
    const { handlers, preventDefault } = dispatch(key, target as unknown as EventTarget);

    expect(handlers.deleteRotoKey).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it.each(['Backspace', 'Delete'])('protects an unselected Key Rail button from deletion (%s)', (key) => {
    const target = new TestHTMLElement('button', { closestSelectors: ['.physics-paint-key-rail-target', 'button'] });
    const { handlers, preventDefault } = dispatch(key, target as unknown as EventTarget);

    expect(handlers.deleteRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does not prevent deletion when no delete action is installed', () => {
    const handlers = actions();
    const { deleteRotoKey: _deleteRotoKey, ...handlersWithoutDelete } = handlers;
    const keyboardEvent = eventFor('Delete', new TestHTMLElement('canvas') as unknown as EventTarget);

    dispatchPhysicsPaintStudioKeyDown(
      keyboardEvent.event,
      { currentFrame: 4, isPlaying: false, mutationLocked: false, hasSelectedRotoKey: false },
      handlersWithoutDelete,
      [],
    );

    expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
  });
});

describe('Physics Paint toolbox popover shortcut routing (43.5-02)', () => {
  it('routes Delete from a selected key while the non-modal popover is open', () => {
    const target = new TestHTMLElement('button', {
      closestSelectors: ['.physics-paint-roto-cell.current', 'button'],
      popoverOpen: true,
    });
    const { handlers, preventDefault } = dispatch(
      'Delete',
      target as unknown as EventTarget,
      {},
      { toolboxPopoverOpen: true },
    );

    expect(handlers.deleteRotoKey).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it.each(['Backspace', 'Delete'])('keeps %s routing while the popover is open', (key) => {
    const target = new TestHTMLElement('div', { popoverOpen: true });
    const { handlers, preventDefault } = dispatch(
      key,
      target as unknown as EventTarget,
      {},
      { toolboxPopoverOpen: true },
    );

    expect(handlers.deleteRotoKey).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('still suspends Delete while a real modal (aria-modal=true) is open', () => {
    const target = new TestHTMLElement('button', {
      closestSelectors: ['.physics-paint-roto-cell.current', 'button'],
      modalOpen: true,
    });
    const { handlers, preventDefault } = dispatch('Delete', target as unknown as EventTarget);

    expect(handlers.deleteRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('routes Cmd+Z undo while the popover is open', () => {
    const target = new TestHTMLElement('div', { popoverOpen: true });
    const { handlers, preventDefault } = dispatch(
      'z',
      target as unknown as EventTarget,
      { metaKey: true },
      { toolboxPopoverOpen: true },
    );

    expect(handlers.undo).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('Escape dismisses the popover before collapsing the selection (one Escape, one layer)', () => {
    const { handlers, preventDefault } = dispatch('Escape', null, {}, { toolboxPopoverOpen: true });

    expect(handlers.closeToolboxPopover).toHaveBeenCalledOnce();
    expect(handlers.collapseRotoSelection).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('with the popover closed, Escape still collapses the selection', () => {
    const { handlers, preventDefault } = dispatch('Escape');

    expect(handlers.collapseRotoSelection).toHaveBeenCalledOnce();
    expect(handlers.closeToolboxPopover).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });
});

describe('Physics Paint armed Push tool disarm routing (43.5-05)', () => {
  it('Select All disarms an armed tool (D-20)', () => {
    const strip = new TestHTMLElement('div', { closestSelectors: ['.physics-paint-workflow-strip'] });
    const { handlers, preventDefault } = dispatch('a', strip as unknown as EventTarget, { metaKey: true });

    expect(handlers.disarmPushTool).toHaveBeenCalledOnce();
    expect(handlers.selectAllRotoKeys).toHaveBeenCalledOnce();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('does not disarm on Select All when mutations are locked (D-18)', () => {
    const strip = new TestHTMLElement('div', { closestSelectors: ['.physics-paint-workflow-strip'] });
    const { handlers } = dispatch('a', strip as unknown as EventTarget, { metaKey: true }, { mutationLocked: true });

    expect(handlers.disarmPushTool).not.toHaveBeenCalled();
    expect(handlers.selectAllRotoKeys).not.toHaveBeenCalled();
  });

  it('does not disarm on Select All from a non-strip target (Pitfall 5)', () => {
    const { handlers } = dispatch('a', null, { metaKey: true });

    expect(handlers.disarmPushTool).not.toHaveBeenCalled();
    expect(handlers.selectAllRotoKeys).not.toHaveBeenCalled();
  });

  it('Escape disarms an armed tool without collapsing the selection (Pitfall 2)', () => {
    const handlers = actions();
    handlers.disarmPushTool.mockReturnValue(true);
    const keyboardEvent = eventFor('Escape');
    dispatchPhysicsPaintStudioKeyDown(
      keyboardEvent.event,
      { currentFrame: 4, isPlaying: false, mutationLocked: false, hasSelectedRotoKey: false },
      handlers,
      [],
    );

    expect(handlers.disarmPushTool).toHaveBeenCalledOnce();
    expect(handlers.collapseRotoSelection).not.toHaveBeenCalled();
    expect(keyboardEvent.preventDefault).toHaveBeenCalledOnce();
  });

  it('Escape falls through to collapseRotoSelection when no tool is armed', () => {
    const handlers = actions();
    handlers.disarmPushTool.mockReturnValue(false);
    const keyboardEvent = eventFor('Escape');
    dispatchPhysicsPaintStudioKeyDown(
      keyboardEvent.event,
      { currentFrame: 4, isPlaying: false, mutationLocked: false, hasSelectedRotoKey: false },
      handlers,
      [],
    );

    expect(handlers.disarmPushTool).toHaveBeenCalledOnce();
    expect(handlers.collapseRotoSelection).toHaveBeenCalledOnce();
    expect(keyboardEvent.preventDefault).toHaveBeenCalledOnce();
  });

  it('Escape dismisses the toolbox popover before consulting the armed tool', () => {
    const handlers = actions();
    handlers.disarmPushTool.mockReturnValue(true);
    const keyboardEvent = eventFor('Escape');
    dispatchPhysicsPaintStudioKeyDown(
      keyboardEvent.event,
      {
        currentFrame: 4,
        isPlaying: false,
        mutationLocked: false,
        hasSelectedRotoKey: false,
        toolboxPopoverOpen: true,
      },
      handlers,
      [],
    );

    expect(handlers.closeToolboxPopover).toHaveBeenCalledOnce();
    expect(handlers.disarmPushTool).not.toHaveBeenCalled();
    expect(handlers.collapseRotoSelection).not.toHaveBeenCalled();
  });
});

describe('Physics Paint armed Push tool module (43.5-05 lock-transition primitive)', () => {
  it('starts disarmed every session — armed state is never persisted (D-19)', () => {
    expect(isPushToolArmed()).toBe(false);
  });

  it('togglePushTool arms and re-toggle disarms (D-06)', () => {
    expect(togglePushTool()).toBe(true);
    expect(isPushToolArmed()).toBe(true);
    expect(togglePushTool()).toBe(true);
    expect(isPushToolArmed()).toBe(false);
  });

  it('disarmPushTool returns true when armed and false when disarmed (lock transition, D-18)', () => {
    expect(disarmPushTool()).toBe(false);
    togglePushTool();
    expect(disarmPushTool()).toBe(true);
    expect(isPushToolArmed()).toBe(false);
  });
});

describe('Physics Paint Roto copy/paste shortcuts', () => {
  it.each([
    [{ metaKey: true, key: 'c' }, 'copyRotoKey'],
    [{ ctrlKey: true, key: 'C' }, 'copyRotoKey'],
    [{ metaKey: true, key: 'v' }, 'pasteRotoKey'],
    [{ ctrlKey: true, key: 'V' }, 'pasteRotoKey'],
  ])('dispatches $expected through the existing timeline action', (init, expected) => {
    const { handlers, preventDefault } = dispatch(String(init.key), new TestHTMLElement('canvas') as unknown as EventTarget, init);

    expect(handlers[expected as 'copyRotoKey' | 'pasteRotoKey']).toHaveBeenCalledOnce();
    expect(handlers[expected === 'copyRotoKey' ? 'pasteRotoKey' : 'copyRotoKey']).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it.each(['c', 'v'])('ignores repeated, shifted, alt-modified, and mutation-locked Cmd+%s dispatches', (key) => {
    for (const overrides of [
      { metaKey: true, repeat: true },
      { metaKey: true, shiftKey: true },
      { metaKey: true, altKey: true },
    ]) {
      const { handlers, preventDefault } = dispatch(key, new TestHTMLElement('canvas') as unknown as EventTarget, overrides);
      expect(handlers.copyRotoKey).not.toHaveBeenCalled();
      expect(handlers.pasteRotoKey).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }

    const handlers = actions();
    const keyboardEvent = eventFor(key, new TestHTMLElement('canvas') as unknown as EventTarget, { metaKey: true });
    dispatchPhysicsPaintStudioKeyDown(
      keyboardEvent.event,
      { currentFrame: 4, isPlaying: false, mutationLocked: true, hasSelectedRotoKey: false },
      handlers,
      [],
    );
    expect(handlers.copyRotoKey).not.toHaveBeenCalled();
    expect(handlers.pasteRotoKey).not.toHaveBeenCalled();
    expect(keyboardEvent.preventDefault).toHaveBeenCalledOnce();
  });

  it.each(['c', 'v'])('preserves native Cmd+%s inside editable controls', (key) => {
    const { handlers, preventDefault } = dispatch(key, new TestHTMLElement('input') as unknown as EventTarget, { metaKey: true });

    expect(handlers.copyRotoKey).not.toHaveBeenCalled();
    expect(handlers.pasteRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe('Physics Paint Roto cut shortcut (quick 260731-9l0)', () => {
  it.each([
    [{ metaKey: true, key: 'x' }],
    [{ ctrlKey: true, key: 'X' }],
  ])('dispatches $key through cutRotoKey exactly once with the existing guards', (init) => {
    const { handlers, preventDefault } = dispatch(String(init.key), new TestHTMLElement('canvas') as unknown as EventTarget, init);

    expect(handlers.cutRotoKey).toHaveBeenCalledOnce();
    expect(handlers.copyRotoKey).not.toHaveBeenCalled();
    expect(handlers.pasteRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it.each([
    { metaKey: true, repeat: true },
    { metaKey: true, shiftKey: true },
    { metaKey: true, altKey: true },
  ])('ignores repeated, shifted, and alt-modified Cmd+X dispatches', (overrides) => {
    const { handlers, preventDefault } = dispatch('x', new TestHTMLElement('canvas') as unknown as EventTarget, overrides);

    expect(handlers.cutRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('blocks Cmd+X while mutations are locked', () => {
    const handlers = actions();
    const keyboardEvent = eventFor('x', new TestHTMLElement('canvas') as unknown as EventTarget, { metaKey: true });
    dispatchPhysicsPaintStudioKeyDown(
      keyboardEvent.event,
      { currentFrame: 4, isPlaying: false, mutationLocked: true, hasSelectedRotoKey: false },
      handlers,
      [],
    );

    expect(handlers.cutRotoKey).not.toHaveBeenCalled();
    expect(keyboardEvent.preventDefault).toHaveBeenCalledOnce();
  });

  it('no-ops Cmd+X when no cutRotoKey action is registered', () => {
    const { cutRotoKey: _omitted, ...handlers } = actions();
    const keyboardEvent = eventFor('x', new TestHTMLElement('canvas') as unknown as EventTarget, { metaKey: true });
    dispatchPhysicsPaintStudioKeyDown(
      keyboardEvent.event,
      { currentFrame: 4, isPlaying: false, mutationLocked: false, hasSelectedRotoKey: false },
      handlers,
      [],
    );

    expect(handlers.copyRotoKey).not.toHaveBeenCalled();
    expect(handlers.pasteRotoKey).not.toHaveBeenCalled();
    expect(keyboardEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('preserves native Cmd+X inside editable controls', () => {
    const { handlers, preventDefault } = dispatch('x', new TestHTMLElement('input') as unknown as EventTarget, { metaKey: true });

    expect(handlers.cutRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
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
    [{ metaKey: true, shiftKey: true, key: 'z' }, 'redo'],
    [{ metaKey: true, key: 'z' }, 'undo'],
  ])('routes the history shortcut from a plain Studio container target', (init, expected) => {
    // 43.4 defect 7: after Delete Key Rail the focused rail is removed and the
    // Defect 6 restoration refocuses the plain timeline container; Cmd+Z must
    // reach the same physical authority the visible buttons use, independent
    // of which Studio element holds DOM focus. A plain div target is that case.
    const container = new TestHTMLElement('div') as unknown as EventTarget;
    const { handlers, preventDefault } = dispatch(String(init.key), container, init);

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

describe('Physics Paint selection-gated real-key frame cycling (43.4 defect 9)', () => {
  it('finds the adjacent REAL KEY frame, skipping generated/interpolated/empty frames, with no wrap', () => {
    expect(findAdjacentRealKeyFrame([2, 6, 10], 6, 1)).toBe(10);
    expect(findAdjacentRealKeyFrame([2, 6, 10], 6, -1)).toBe(2);
    expect(findAdjacentRealKeyFrame([2, 6, 10], 10, 1)).toBeNull();
    expect(findAdjacentRealKeyFrame([2, 6, 10], 2, -1)).toBeNull();
    expect(findAdjacentRealKeyFrame([], 4, 1)).toBeNull();
  });

  it('with a real key selected, ArrowLeft/Right chain to the adjacent real key instead of raw cursor movement', () => {
    const { handlers } = dispatch('ArrowRight', null, {}, { hasSelectedRotoKey: true });
    expect(handlers.selectAdjacentRotoKey).toHaveBeenCalledWith(1);
    expect(handlers.navigateRotoFrame).not.toHaveBeenCalled();

    const { handlers: left } = dispatch('ArrowLeft', null, {}, { hasSelectedRotoKey: true });
    expect(left.selectAdjacentRotoKey).toHaveBeenCalledWith(-1);
    expect(left.navigateRotoFrame).not.toHaveBeenCalled();
  });

  it('preserves plain cursor arrow movement when no key is selected', () => {
    const { handlers, preventDefault } = dispatch('ArrowRight');
    expect(handlers.navigateRotoFrame).toHaveBeenCalledWith(5);
    expect(handlers.selectAdjacentRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it('keeps the validated Shift+Arrow saved-frame jump even with a key selected', () => {
    const { handlers } = dispatch('ArrowRight', null, { shiftKey: true }, { hasSelectedRotoKey: true });
    expect(handlers.navigateRotoFrame).toHaveBeenCalledWith(7);
    expect(handlers.selectAdjacentRotoKey).not.toHaveBeenCalled();
  });

  it('never starts frame navigation from a rail target (the roving rail group owns arrows)', () => {
    const target = new TestHTMLElement('div', { closestSelectors: ['.physics-paint-rail-target'] });
    const { handlers } = dispatch('ArrowRight', target as unknown as EventTarget);
    expect(handlers.navigateRotoFrame).not.toHaveBeenCalled();
    expect(handlers.selectAdjacentRotoKey).not.toHaveBeenCalled();
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
