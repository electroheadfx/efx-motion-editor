import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolType } from '@efxlab/efx-physic-paint';
import {
  handleTemporaryEraseBlur,
  handleTemporaryEraseGestureBoundary,
  handleTemporaryEraseKeyDown,
  handleTemporaryEraseKeyUp,
  handleTemporaryEraseVisibilityChange,
  mountPhysicsPaintTemporaryErase,
  resetTemporaryEraseForTests,
  resolveEffectiveTool,
  syncTemporaryErase,
  temporaryErase,
  type TemporaryEraseDeps,
  type TemporaryEraseEngine,
  type TemporaryEraseMountTargets,
} from './physicsPaintTemporaryErase';
import {
  dispatchPhysicsPaintStudioKeyDown,
  type PhysicsPaintStudioKeyboardActions,
  type PhysicsPaintStudioKeyboardState,
} from './physicsPaintStudioKeyboard';

/**
 * quick 261003-vos — Alt = temporary erase in the Physics Paint Studio window.
 * THIS CELL LIST IS THE CONTRACT OF RECORD (mirrors PLAN.md Task 1):
 *
 *  - RESOLVE: resolveEffectiveTool('paint') armed reads 'erase'; disarmed reads
 *    'paint'; armed with selected 'erase' reads 'erase' (selected wins); the
 *    resolver never mutates its input.
 *  - ARM: gated Alt keydown (key 'Alt', !repeat, shortcut target, selected
 *    'paint', engine present, not locked) sets temporaryErase and applies
 *    engine.setTool('erase') on the idle engine; the injected selected-tool
 *    getter still returns 'paint' (nothing writes the selection).
 *  - GATED ARM: no arm for selected 'erase', input/textarea/contentEditable
 *    target, mutation-locked, no engine, key repeat, or a non-Alt key.
 *  - KEYUP + LOST FOCUS: keyup disarms unconditionally (every arm gate may
 *    fail — suppressed target, locked, tool 'erase' — disarm still fires) and
 *    when idle applies the SELECTED tool back ('paint' normally, 'erase' if
 *    that is what is selected); window blur and visibilitychange-to-hidden
 *    disarm unconditionally; visibilitychange-to-visible does NOT disarm;
 *    double keyup / double disarm are idempotent.
 *  - EVENT HYGIENE (preserved-Alt pin): the keydown, keyup, blur and
 *    visibility handlers never call preventDefault or stopPropagation, so
 *    every existing Alt behavior in the Studio dispatcher is preserved
 *    byte-for-byte.
 *  - BOUNDARY DEFERRAL — ARM MID-GESTURE: arming while inFlight sets the
 *    signal but does NOT call setTool yet; the pointerup boundary flushes one
 *    deferred apply of 'erase'.
 *  - BOUNDARY DEFERRAL — DISARM MID-ERASE: disarming while inFlight does NOT
 *    call setTool yet; the pointerup boundary applies 'paint'.
 *  - PENDING COALESCE: arm then disarm both while inFlight → exactly ONE
 *    apply at the boundary, the final desired tool ('paint'); no intermediate
 *    'erase' apply leaks.
 *  - RECOVERY (lost-keyup safety): a stuck state (disarmed signal, engine
 *    still 'erase', inFlight stuck true) is force-synced to 'paint' at the
 *    next pointerdown boundary BEFORE the gesture starts; pointercancel
 *    clears inFlight and flushes.
 *  - ENGINE IDENTITY RESYNC: lastApplied tracks the engine instance — the
 *    next sync applies to a NEW engine even when the desired tool string is
 *    unchanged.
 *  - MOUNT WIRING: keydown/keyup/blur/pointerdown/pointerup/pointercancel on
 *    the window-like target (pointerdown WITH capture: true), visibilitychange
 *    on the document-like target; teardown removes every listener and
 *    disarms; mounted listeners behave like the direct handlers end-to-end.
 *  - DISPATCHER GUARD PIN: the existing Alt exclusions in
 *    dispatchPhysicsPaintStudioKeyDown stay intact (Backspace/Delete inert
 *    under Alt, Meta+Alt+C never roto-copies, Escape under Alt never
 *    collapses) — physicsPaintStudioKeyboard.ts is never edited.
 *
 * Node environment: no real DOM. Everything is driven through the exported
 * pure handlers with injected deps; the mount takes window-like/document-like
 * fakes so no global is touched at import time.
 */

interface EngineHarness {
  engine: TemporaryEraseEngine & { setTool: ReturnType<typeof vi.fn> };
}

interface Harness extends EngineHarness {
  box: {
    selected: ToolType;
    engine: TemporaryEraseEngine | null;
    locked: boolean;
    shortcut: boolean;
  };
  deps: TemporaryEraseDeps;
  nextEngine: () => TemporaryEraseEngine & { setTool: ReturnType<typeof vi.fn> };
}

function harness(selected: ToolType = 'paint'): Harness {
  const engine = { setTool: vi.fn<(tool: ToolType) => void>() };
  const box = {
    selected,
    engine: engine as TemporaryEraseEngine | null,
    locked: false,
    shortcut: true,
  };
  const deps: TemporaryEraseDeps = {
    getSelectedTool: () => box.selected,
    getEngine: () => box.engine,
    isMutationLocked: () => box.locked,
    isShortcutTarget: () => box.shortcut,
  };
  return {
    engine,
    box,
    deps,
    nextEngine: () => {
      const fresh = { setTool: vi.fn<(tool: ToolType) => void>() };
      box.engine = fresh;
      return fresh;
    },
  };
}

function keyEvent(key: string, overrides: Record<string, unknown> = {}) {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  return {
    event: {
      key,
      repeat: false,
      target: null,
      preventDefault,
      stopPropagation,
      ...overrides,
    } as unknown as KeyboardEvent,
    preventDefault,
    stopPropagation,
  };
}

function plainEvent() {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  return { event: { preventDefault, stopPropagation } as unknown as Event, preventDefault, stopPropagation };
}

interface FakeListener {
  type: string;
  listener: (event: Event) => void;
  options?: boolean | { capture?: boolean };
}

function fakeEventTarget() {
  const registrations: FakeListener[] = [];
  return {
    registrations,
    addEventListener: vi.fn((type: string, listener: (event: Event) => void, options?: boolean | { capture?: boolean }) => {
      registrations.push({ type, listener, options });
    }),
    removeEventListener: vi.fn((type: string, listener: (event: Event) => void, options?: boolean | { capture?: boolean }) => {
      const index = registrations.findIndex((entry) => entry.type === type && entry.listener === listener);
      if (index >= 0) registrations.splice(index, 1);
      void options;
    }),
    dispatch(type: string, event: Event) {
      registrations
        .filter((entry) => entry.type === type)
        .forEach((entry) => entry.listener(event));
    },
    callsFor(type: string) {
      return registrations.filter((entry) => entry.type === type);
    },
  };
}

function fakeDocument() {
  const target = fakeEventTarget();
  return {
    ...target,
    visibilityState: 'visible' as DocumentVisibilityState,
  };
}

function mountTargets() {
  return {
    window: fakeEventTarget(),
    document: fakeDocument(),
  };
}

function wireMount(targets: ReturnType<typeof mountTargets>, deps: TemporaryEraseDeps) {
  return mountPhysicsPaintTemporaryErase(
    { window: targets.window, document: targets.document } as unknown as TemporaryEraseMountTargets,
    () => deps,
  );
}

class TestHTMLElement {
  tagName: string;
  isContentEditable: boolean;
  ownerDocument: { querySelector: () => Element | null };
  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.isContentEditable = false;
    this.ownerDocument = { querySelector: () => null };
  }
  closest(): Element | null {
    return null;
  }
}

function dispatcherDispatch(key: string, overrides: Record<string, unknown> = {}) {
  const actions: PhysicsPaintStudioKeyboardActions = {
    navigateRotoFrame: vi.fn(),
    toggleOnion: vi.fn(),
    adjustOnionCount: vi.fn(),
    toggleRotoPlayback: vi.fn(),
    toggleShortcuts: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    copyRotoKey: vi.fn(),
    cutRotoKey: vi.fn(),
    pasteRotoKey: vi.fn(),
    deleteRotoKey: vi.fn(),
    selectAllRotoKeys: vi.fn(),
    collapseRotoSelection: vi.fn(),
    closeToolboxPopover: vi.fn(),
    disarmPushTool: vi.fn(),
    disarmSolo: vi.fn(),
    relockReferenceTransform: vi.fn(),
    relockBackgroundTransform: vi.fn(),
  };
  const state: PhysicsPaintStudioKeyboardState = {
    currentFrame: 4,
    isPlaying: false,
    mutationLocked: false,
    hasSelectedRotoKey: true,
  };
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  const target = new TestHTMLElement('canvas');
  const event = {
    key,
    target,
    repeat: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault,
    stopPropagation,
    ...overrides,
  } as unknown as KeyboardEvent;
  dispatchPhysicsPaintStudioKeyDown(event, state, actions, []);
  return { actions, preventDefault, stopPropagation };
}

beforeEach(() => {
  resetTemporaryEraseForTests();
  vi.stubGlobal('HTMLElement', TestHTMLElement);
  vi.stubGlobal('Element', TestHTMLElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetTemporaryEraseForTests();
});

describe('resolveEffectiveTool (RESOLVE)', () => {
  it("reads 'erase' only when armed AND selected is paint; the selected tool wins otherwise; the input is never mutated", () => {
    expect(resolveEffectiveTool('paint')).toBe('paint');

    temporaryErase.value = true;
    expect(resolveEffectiveTool('paint')).toBe('erase');
    expect(resolveEffectiveTool('erase')).toBe('erase');

    temporaryErase.value = false;
    expect(resolveEffectiveTool('paint')).toBe('paint');
    expect(resolveEffectiveTool('erase')).toBe('erase');

    const input: ToolType = 'paint';
    resolveEffectiveTool(input);
    expect(input).toBe('paint');
  });
});

describe('gated arm (ARM / GATED ARM)', () => {
  it("arms on a gated Alt keydown, applies engine.setTool('erase') on the idle engine, and never writes the selected tool", () => {
    const h = harness();
    const { event } = keyEvent('Alt');

    handleTemporaryEraseKeyDown(event, h.deps);

    expect(temporaryErase.peek()).toBe(true);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('erase');
    expect(h.box.selected).toBe('paint');
  });

  it('is idempotent — a second gated Alt keydown adds no extra apply', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);

    expect(temporaryErase.peek()).toBe(true);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['selected tool is erase', (h: Harness) => { h.box.selected = 'erase'; }],
    ['shortcut target fails (input / textarea / contentEditable)', (h: Harness) => { h.box.shortcut = false; }],
    ['mutations are locked', (h: Harness) => { h.box.locked = true; }],
    ['no engine is mounted', (h: Harness) => { h.box.engine = null; }],
    ['key repeat', (h: Harness) => { void h; }],
    ['non-Alt key', (h: Harness) => { void h; }],
  ])('does not arm when %s', (label, mutate) => {
    const h = harness();
    mutate(h);
    const key = label === 'key repeat' ? 'Alt' : label === 'non-Alt key' ? 'a' : 'Alt';
    const repeat = label === 'key repeat';
    const { event } = keyEvent(key, { repeat });

    handleTemporaryEraseKeyDown(event, h.deps);

    expect(temporaryErase.peek()).toBe(false);
    expect(h.engine.setTool).not.toHaveBeenCalled();
  });
});

describe('release + lost-keyup safety (KEYUP + LOST FOCUS)', () => {
  it('keyup disarms unconditionally — every arm gate may fail and the selected tool is applied back', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    expect(temporaryErase.peek()).toBe(true);

    // Every arm gate now fails — disarm must still fire.
    h.box.shortcut = false;
    h.box.locked = true;
    const { event, preventDefault, stopPropagation } = keyEvent('Alt');
    handleTemporaryEraseKeyUp(event, h.deps);

    expect(temporaryErase.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it("when the selected tool is 'erase', a keyup lands on 'erase' — the selected tool always wins", () => {
    const h = harness('erase');

    handleTemporaryEraseKeyUp(keyEvent('Alt').event, h.deps);

    expect(temporaryErase.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenCalledWith('erase');
    expect(h.engine.setTool).not.toHaveBeenCalledWith('paint');
  });

  it('does NOT disarm on a non-Alt keyup (releasing another key while Alt stays held)', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryEraseKeyUp(keyEvent('x').event, h.deps);

    expect(temporaryErase.peek()).toBe(true);
    expect(h.engine.setTool).not.toHaveBeenCalled();
  });

  it('window blur disarms unconditionally (locked + suppressed target + tool erase still clear)', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    h.box.locked = true;
    h.box.shortcut = false;

    handleTemporaryEraseBlur(h.deps);

    expect(temporaryErase.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');
  });

  it('visibilitychange to hidden disarms; visibilitychange to visible does NOT disarm', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);

    handleTemporaryEraseVisibilityChange(h.deps, 'hidden');
    expect(temporaryErase.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');

    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryEraseVisibilityChange(h.deps, 'visible');
    expect(temporaryErase.peek()).toBe(true);
  });

  it('double keyup and double blur are idempotent — exactly one apply of the selected tool', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryEraseKeyUp(keyEvent('Alt').event, h.deps);
    handleTemporaryEraseKeyUp(keyEvent('Alt').event, h.deps);
    handleTemporaryEraseBlur(h.deps);

    expect(temporaryErase.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('paint');
  });
});

describe('event hygiene — preserved Alt (EVENT HYGIENE)', () => {
  it('the mounted keydown, keyup, blur and visibility handlers never preventDefault or stopPropagation', () => {
    const h = harness();
    const targets = mountTargets();
    const teardown = wireMount(targets, h.deps);

    for (const [target, type] of [
      [targets.window, 'keydown'],
      [targets.window, 'keyup'],
      [targets.window, 'blur'],
      [targets.document, 'visibilitychange'],
    ] as const) {
      const { event, preventDefault, stopPropagation } = plainEvent();
      target.dispatch(type, event);
      expect(preventDefault).not.toHaveBeenCalled();
      expect(stopPropagation).not.toHaveBeenCalled();
    }

    teardown();
  });
});

describe('gesture-boundary deferral (GESTURE OWNERSHIP)', () => {
  it('ARM MID-GESTURE: arming while inFlight defers the apply until the pointerup boundary', () => {
    const h = harness();
    handleTemporaryEraseGestureBoundary('down', h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);

    expect(temporaryErase.peek()).toBe(true);
    // The paint stroke in progress must still read 'paint'.
    expect(h.engine.setTool).not.toHaveBeenCalled();

    handleTemporaryEraseGestureBoundary('up', h.deps);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('erase');
  });

  it('DISARM MID-ERASE: disarming while inFlight defers the apply until the pointerup boundary', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    expect(h.engine.setTool).toHaveBeenCalledWith('erase');
    handleTemporaryEraseGestureBoundary('down', h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryEraseKeyUp(keyEvent('Alt').event, h.deps);

    expect(temporaryErase.peek()).toBe(false);
    // The erase swipe in progress must still read 'erase'.
    expect(h.engine.setTool).not.toHaveBeenCalledWith('paint');

    handleTemporaryEraseGestureBoundary('up', h.deps);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('paint');
  });

  it('PENDING COALESCE: arm then disarm both while inFlight → exactly ONE apply at the boundary, the final tool', () => {
    const h = harness();
    // Establish 'erase' as the applied tool, then start a gesture and disarm
    // without flushing (blur during the gesture) so the signal starts false
    // while the engine still holds 'erase'.
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryEraseGestureBoundary('down', h.deps);
    handleTemporaryEraseBlur(h.deps);
    expect(temporaryErase.peek()).toBe(false);
    h.engine.setTool.mockClear();

    // Arm, then disarm — both while the gesture is live.
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryEraseKeyUp(keyEvent('Alt').event, h.deps);

    expect(h.engine.setTool).not.toHaveBeenCalled();

    handleTemporaryEraseGestureBoundary('up', h.deps);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('paint');
  });

  it('pointercancel clears inFlight and flushes the deferred apply', () => {
    const h = harness();
    handleTemporaryEraseGestureBoundary('down', h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    expect(h.engine.setTool).not.toHaveBeenCalled();

    handleTemporaryEraseGestureBoundary('cancel', h.deps);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('erase');
    expect(temporaryErase.peek()).toBe(true);
  });
});

describe('recovery — lost keyup / stuck state (RECOVERY)', () => {
  it("the next pointerdown force-syncs 'paint' BEFORE the gesture starts, even with inFlight stuck true", () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryEraseGestureBoundary('down', h.deps);
    // Lost Alt keyup: disarm happens (blur) but the pointerup boundary never
    // fires — inFlight stays stuck and the engine still reads 'erase'.
    handleTemporaryEraseBlur(h.deps);
    expect(temporaryErase.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('erase');
    h.engine.setTool.mockClear();

    // The next gesture starts: force-sync corrects the engine first.
    handleTemporaryEraseGestureBoundary('down', h.deps);

    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('paint');
  });

  it('recovers an external setTool divergence at the gesture start (force bypasses the last-applied dedupe)', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('erase');
    // Something else (rail selectTool, canvas mount) wrote the engine behind
    // our back while lastApplied still records 'erase'.
    h.engine.setTool('paint');
    h.engine.setTool.mockClear();

    handleTemporaryEraseGestureBoundary('down', h.deps);

    expect(h.engine.setTool).toHaveBeenCalledWith('erase');
  });
});

describe('engine identity resync (ENGINE IDENTITY RESYNC)', () => {
  it('the next sync applies to a NEW engine even when the desired tool string is unchanged', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    expect(h.engine.setTool).toHaveBeenCalledWith('erase');
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);

    const engineB = h.nextEngine();

    syncTemporaryErase(h.deps);

    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(engineB.setTool).toHaveBeenCalledTimes(1);
    expect(engineB.setTool).toHaveBeenCalledWith('erase');
  });
});

describe('mount wiring (MOUNT WIRING)', () => {
  it('registers keydown/keyup/blur/pointerdown/pointerup/pointercancel on the window-like target, visibilitychange on the document-like target, pointerdown with capture: true', () => {
    const h = harness();
    const targets = mountTargets();

    wireMount(targets, h.deps);

    for (const type of ['keydown', 'keyup', 'blur', 'pointerdown', 'pointerup', 'pointercancel']) {
      expect(targets.window.callsFor(type)).toHaveLength(1);
    }
    expect(targets.document.callsFor('visibilitychange')).toHaveLength(1);

    const pointerdown = targets.window.callsFor('pointerdown')[0]!;
    const options = pointerdown.options as { capture?: boolean } | undefined;
    expect(options).toBeTruthy();
    expect(options!.capture).toBe(true);
  });

  it('the teardown removes every listener and disarms temporaryErase', () => {
    const h = harness();
    const targets = mountTargets();
    const teardown = wireMount(targets, h.deps);
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    expect(temporaryErase.peek()).toBe(true);

    teardown();

    expect(temporaryErase.peek()).toBe(false);
    expect(targets.window.registrations).toHaveLength(0);
    expect(targets.document.registrations).toHaveLength(0);
    expect(targets.window.removeEventListener).toHaveBeenCalledTimes(6);
    expect(targets.document.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('end-to-end through the mounted listeners: a fake Alt keydown arms the fake engine and visibilitychange-to-hidden disarms it', () => {
    const h = harness();
    const targets = mountTargets();
    const teardown = wireMount(targets, h.deps);

    const { event } = keyEvent('Alt');
    targets.window.dispatch('keydown', event);
    expect(temporaryErase.peek()).toBe(true);
    expect(h.engine.setTool).toHaveBeenCalledWith('erase');

    targets.document.visibilityState = 'hidden';
    targets.document.dispatch('visibilitychange', plainEvent().event);
    expect(temporaryErase.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');

    teardown();
  });
});

describe('dispatcher Alt exclusion pins — physicsPaintStudioKeyboard.ts untouched (DISPATCHER GUARD PIN)', () => {
  it('Backspace/Delete with altKey held never calls deleteRotoKey and never prevents its default', () => {
    for (const key of ['Backspace', 'Delete']) {
      const { actions, preventDefault } = dispatcherDispatch(key, { altKey: true });
      expect(actions.deleteRotoKey).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });

  it('Meta+Alt+C never calls copyRotoKey (roto clipboard exclusion preserved)', () => {
    const { actions, preventDefault } = dispatcherDispatch('c', { metaKey: true, altKey: true });
    expect(actions.copyRotoKey).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('Escape with altKey held never collapses the selection', () => {
    const { actions, preventDefault } = dispatcherDispatch('Escape', { altKey: true });
    expect(actions.collapseRotoSelection).not.toHaveBeenCalled();
    expect(actions.disarmPushTool).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
