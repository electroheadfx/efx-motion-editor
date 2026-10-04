import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ToolType } from '@efxlab/efx-physic-paint';
import {
  combineEffectiveTool,
  handleTemporaryEraseBlur,
  handleTemporaryEraseGestureBoundary,
  handleTemporaryEraseKeyDown,
  handleTemporaryEraseVisibilityChange,
  handleTemporaryMoveKeyDown,
  handleTemporaryMoveKeyUp,
  mountPhysicsPaintTemporaryErase,
  resetTemporaryEraseForTests,
  resolveEffectiveTool,
  readEffectiveTool,
  temporaryErase,
  temporaryMove,
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
 * quick 261004-dn5 — Cmd = temporary Move in the Physics Paint Studio window
 * (the dual-arm extension of the UAT-closed Alt = temporary erase module).
 * THIS CELL LIST IS THE CONTRACT OF RECORD (mirrors PLAN.md Task 1):
 *
 *  - PRECEDENCE: combineEffectiveTool is the ONE combination rule and move
 *    outranks erase — moveArmed + selected 'paint' resolves to 'move'; the
 *    erase arm alone resolves to 'erase'; a disarmed selection passes through;
 *    a selected 'erase' is never flipped to 'move' (the selected tool wins).
 *    The 2-argument call form (no move arm) still resolves exactly as before.
 *  - GATED META ARM: a Meta/Cmd keydown arms ONLY when the shortcut target is
 *    clean, the selected tool is 'paint', an engine is mounted, mutations are
 *    not locked and the event is not a key repeat; a non-Meta key never arms.
 *  - UNCONDITIONAL META KEYUP: releasing Meta clears the move arm no matter
 *    which gates now fail — including a keyup delivered while an input is
 *    focused.
 *  - BLUR / VISIBILITY: window blur and visibilitychange-to-hidden clear BOTH
 *    arms (temporaryErase and temporaryMove); visibilitychange-to-visible
 *    clears neither.
 *  - EVENT HYGIENE: neither arm handler ever calls preventDefault or
 *    stopPropagation (source assertion over the handler bodies), and a
 *    dispatcher integration cell proves meta+Z still fires the Studio undo
 *    while the move arm is armed — every existing Cmd chord keeps working.
 *  - BOUNDARY DEFERRAL: pointerdown (capture) force-syncs the effective tool
 *    to the engine BEFORE the gesture starts; arming/disarming mid-gesture
 *    defers the apply; pointerup coalesces to exactly ONE final setTool; a
 *    lost Meta keyup followed by blur ends on 'paint' (never stuck on 'move').
 *  - MOUNT / TEARDOWN: mount wires keydown/keyup/blur/pointerdown(capture)/
 *    pointerup/pointercancel/visibilitychange, dispatching BOTH arm handlers
 *    from the key listeners; teardown removes every listener and clears both
 *    arms; the reset helper clears both signals plus the deferral state.
 *  - SOURCE PINS: the rail declares a 'move' item immediately after 'erase',
 *    an isItemActive branch for it, runAction dispatching onSelectTool('move',
 *    physicsMode) and a strokeScriptInMemory feature gate; the Studio writes
 *    strokeScriptInMemory from the existing history listener, peeks BOTH arms
 *    in the armed-guarded effect and passes the signal through the tool-rail
 *    identity memo.
 *
 * Node environment: no real DOM. Everything is driven through the exported
 * handlers with injected deps; the mount takes window-like/document-like
 * fakes so no global is touched at import time.
 */

const railSource = readFileSync(new URL('./PhysicsPaintToolRail.tsx', import.meta.url), 'utf8');
const studioSource = readFileSync(new URL('../PhysicsPaintStudio.tsx', import.meta.url), 'utf8');
const armModuleSource = readFileSync(new URL('./physicsPaintTemporaryErase.ts', import.meta.url), 'utf8');

function harness(selected: ToolType = 'paint') {
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
  closest(selector?: string): Element | null {
    // The dispatcher's Select All is workflow-strip scoped (Pitfall 5): the
    // fake target stands in for a strip-focused element so the meta+A cell
    // reaches its action. Every other selector (input guards, rail targets)
    // keeps the plain null answer.
    if (selector === '.physics-paint-workflow-strip') return {} as Element;
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

/** Body of `name` in the arm module source — used for the event-hygiene pins. */
function handlerBody(name: string): string {
  const start = armModuleSource.indexOf(`export function ${name}(`);
  expect(start, `handler ${name} must exist in physicsPaintTemporaryErase.ts`).toBeGreaterThanOrEqual(0);
  const open = armModuleSource.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < armModuleSource.length; i++) {
    if (armModuleSource[i] === '{') depth++;
    else if (armModuleSource[i] === '}') {
      depth--;
      if (depth === 0) return armModuleSource.slice(start, i + 1);
    }
  }
  throw new Error(`unterminated handler body: ${name}`);
}

function railArrayBody(): string {
  const open = railSource.indexOf('PHYSICS_PAINT_TOOL_RAIL_ITEMS: PhysicsPaintToolRailItem[] = [');
  expect(open).toBeGreaterThanOrEqual(0);
  const close = railSource.indexOf('\n];', open);
  return railSource.slice(open, close);
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

describe('combineEffectiveTool (PRECEDENCE)', () => {
  it("move outranks erase: armed move + selected 'paint' resolves to 'move'", () => {
    expect(combineEffectiveTool(true, 'paint', true)).toBe('move');
  });

  it("the erase arm alone still resolves to 'erase'", () => {
    expect(combineEffectiveTool(true, 'paint', false)).toBe('erase');
    expect(combineEffectiveTool(false, 'paint', true)).toBe('paint');
    expect(combineEffectiveTool(false, 'paint', false)).toBe('paint');
  });

  it("a selected 'erase' is never flipped to 'move' — the selected tool wins", () => {
    expect(combineEffectiveTool(true, 'erase', true)).toBe('erase');
    expect(combineEffectiveTool(true, 'erase', false)).toBe('erase');
  });

  it('the 2-argument call form (no move arm) behaves exactly as before', () => {
    expect(combineEffectiveTool(true, 'paint')).toBe('erase');
    expect(combineEffectiveTool(false, 'paint')).toBe('paint');
    expect(combineEffectiveTool(true, 'erase')).toBe('erase');
  });

  it('resolveEffectiveTool and readEffectiveTool pass the live move signal as the third argument', () => {
    temporaryErase.value = false;
    temporaryMove.value = false;
    expect(resolveEffectiveTool('paint')).toBe('paint');
    expect(readEffectiveTool('paint')).toBe('paint');

    temporaryErase.value = true;
    expect(resolveEffectiveTool('paint')).toBe('erase');

    // Both arms armed → move wins (discretion decision 1).
    temporaryMove.value = true;
    expect(resolveEffectiveTool('paint')).toBe('move');
    expect(readEffectiveTool('paint')).toBe('move');

    temporaryErase.value = false;
    expect(resolveEffectiveTool('paint')).toBe('move');
    temporaryMove.value = false;
    expect(resolveEffectiveTool('paint')).toBe('paint');
  });

  it('the resolver never mutates its input', () => {
    const input: ToolType = 'paint';
    temporaryMove.value = true;
    resolveEffectiveTool(input);
    expect(input).toBe('paint');
    temporaryMove.value = false;
  });
});

describe('gated Meta arm (ARM / GATED ARM)', () => {
  it("arms on a gated Meta keydown, applies engine.setTool('move') on the idle engine, and never writes the selected tool", () => {
    const h = harness();
    const { event } = keyEvent('Meta');

    handleTemporaryMoveKeyDown(event, h.deps);

    expect(temporaryMove.peek()).toBe(true);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('move');
    expect(h.box.selected).toBe('paint');
  });

  it('is idempotent — a second gated Meta keydown adds no extra apply', () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);

    expect(temporaryMove.peek()).toBe(true);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['selected tool is erase', (h: ReturnType<typeof harness>) => { h.box.selected = 'erase'; }],
    ['shortcut target fails (input / textarea / contentEditable)', (h: ReturnType<typeof harness>) => { h.box.shortcut = false; }],
    ['mutations are locked', (h: ReturnType<typeof harness>) => { h.box.locked = true; }],
    ['no engine is mounted', (h: ReturnType<typeof harness>) => { h.box.engine = null; }],
    ['key repeat', (h: ReturnType<typeof harness>) => { void h; }],
    ['non-Meta key', (h: ReturnType<typeof harness>) => { void h; }],
  ])('does not arm when %s', (label, mutate) => {
    const h = harness();
    mutate(h);
    const key = label === 'key repeat' ? 'Meta' : label === 'non-Meta key' ? 'z' : 'Meta';
    const repeat = label === 'key repeat';
    const { event } = keyEvent(key, { repeat });

    handleTemporaryMoveKeyDown(event, h.deps);

    expect(temporaryMove.peek()).toBe(false);
    expect(h.engine.setTool).not.toHaveBeenCalled();
  });

  it("arming does NOT touch the Alt arm — temporaryErase stays false", () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);

    expect(temporaryErase.peek()).toBe(false);
  });
});

describe('unconditional Meta keyup (KEYUP)', () => {
  it('Meta keyup clears the move arm even when every gate now fails, and applies the selected tool back', () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    expect(temporaryMove.peek()).toBe(true);

    h.box.shortcut = false;
    h.box.locked = true;
    const { event, preventDefault, stopPropagation } = keyEvent('Meta');
    handleTemporaryMoveKeyUp(event, h.deps);

    expect(temporaryMove.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');
    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it('a keyup delivered while an input is focused still clears (shortcut target failing)', () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    h.box.shortcut = false;

    handleTemporaryMoveKeyUp(keyEvent('Meta').event, h.deps);

    expect(temporaryMove.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');
  });

  it('does NOT clear on a non-Meta keyup (releasing another key while Cmd stays held)', () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryMoveKeyUp(keyEvent('x').event, h.deps);

    expect(temporaryMove.peek()).toBe(true);
    expect(h.engine.setTool).not.toHaveBeenCalled();
  });
});

describe('blur / visibility clear BOTH arms (LOST FOCUS)', () => {
  it('window blur clears temporaryErase and temporaryMove', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    expect(temporaryErase.peek()).toBe(true);
    expect(temporaryMove.peek()).toBe(true);
    h.box.locked = true;
    h.box.shortcut = false;

    handleTemporaryEraseBlur(h.deps);

    expect(temporaryErase.peek()).toBe(false);
    expect(temporaryMove.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');
  });

  it('visibilitychange-to-hidden clears both arms; visibilitychange-to-visible clears neither', () => {
    const h = harness();
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);

    handleTemporaryEraseVisibilityChange(h.deps, 'hidden');
    expect(temporaryErase.peek()).toBe(false);
    expect(temporaryMove.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');

    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    handleTemporaryEraseVisibilityChange(h.deps, 'visible');
    expect(temporaryErase.peek()).toBe(true);
    expect(temporaryMove.peek()).toBe(true);
  });
});

describe('event hygiene — preserved Cmd chords (EVENT HYGIENE)', () => {
  it('no arm handler body ever calls preventDefault or stopPropagation', () => {
    for (const name of [
      'handleTemporaryMoveKeyDown',
      'handleTemporaryMoveKeyUp',
      'handleTemporaryEraseKeyDown',
      'handleTemporaryEraseKeyUp',
      'handleTemporaryEraseBlur',
      'handleTemporaryEraseVisibilityChange',
      'handleTemporaryEraseGestureBoundary',
    ]) {
      expect(handlerBody(name)).not.toContain('preventDefault');
      expect(handlerBody(name)).not.toContain('stopPropagation');
    }
  });

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

  it('meta+Z still triggers the Studio undo through the dispatcher while the move arm is armed', () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    expect(temporaryMove.peek()).toBe(true);

    const { actions, preventDefault, stopPropagation } = dispatcherDispatch('z', { metaKey: true });

    expect(actions.undo).toHaveBeenCalled();
    // Exactly one preventDefault, the dispatcher's OWN pre-existing meta+z
    // branch (browser-undo suppression) — the arm handlers never saw this
    // event, so nothing the quick added consumed it. stopPropagation stays
    // at zero: the dispatcher never calls it.
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it('every other existing Cmd chord still reaches its action while the move arm is armed', () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);

    const copy = dispatcherDispatch('c', { metaKey: true });
    expect(copy.actions.copyRotoKey).toHaveBeenCalled();
    const paste = dispatcherDispatch('v', { metaKey: true });
    expect(paste.actions.pasteRotoKey).toHaveBeenCalled();
    const selectAll = dispatcherDispatch('a', { metaKey: true });
    expect(selectAll.actions.selectAllRotoKeys).toHaveBeenCalled();
    const redo = dispatcherDispatch('z', { metaKey: true, shiftKey: true });
    expect(redo.actions.redo).toHaveBeenCalled();
  });
});

describe('gesture-boundary deferral (GESTURE OWNERSHIP)', () => {
  it("ARM MID-GESTURE: arming while inFlight defers the apply until the pointerup boundary", () => {
    const h = harness();
    handleTemporaryEraseGestureBoundary('down', h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);

    expect(temporaryMove.peek()).toBe(true);
    expect(h.engine.setTool).not.toHaveBeenCalled();

    handleTemporaryEraseGestureBoundary('up', h.deps);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('move');
  });

  it("DISARM MID-MOVE: releasing Cmd while inFlight defers the apply until the pointerup boundary", () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    expect(h.engine.setTool).toHaveBeenCalledWith('move');
    handleTemporaryEraseGestureBoundary('down', h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryMoveKeyUp(keyEvent('Meta').event, h.deps);

    expect(temporaryMove.peek()).toBe(false);
    expect(h.engine.setTool).not.toHaveBeenCalledWith('paint');

    handleTemporaryEraseGestureBoundary('up', h.deps);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('paint');
  });

  it('PENDING COALESCE: arm then disarm both while inFlight → exactly ONE apply at the boundary, the final tool', () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    handleTemporaryEraseGestureBoundary('down', h.deps);
    handleTemporaryEraseBlur(h.deps);
    expect(temporaryMove.peek()).toBe(false);
    h.engine.setTool.mockClear();

    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    handleTemporaryMoveKeyUp(keyEvent('Meta').event, h.deps);

    expect(h.engine.setTool).not.toHaveBeenCalled();

    handleTemporaryEraseGestureBoundary('up', h.deps);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('paint');
  });

  it('POINTERDOWN FORCE-SYNC: the capture boundary applies the effective tool even when the last-applied dedupe would skip it', () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('move');
    // Something else (rail selectTool, canvas mount) wrote the engine behind our back.
    h.engine.setTool('paint');
    h.engine.setTool.mockClear();

    handleTemporaryEraseGestureBoundary('down', h.deps);

    expect(h.engine.setTool).toHaveBeenCalledWith('move');
  });

  it("RECOVERY: a lost Meta keyup followed by blur ends on 'paint' — the next pointerdown never starts on 'move'", () => {
    const h = harness();
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    handleTemporaryEraseGestureBoundary('down', h.deps);
    // Lost Cmd keyup: blur disarms but the pointerup boundary never fires —
    // inFlight stays stuck and the engine still reads 'move'.
    handleTemporaryEraseBlur(h.deps);
    expect(temporaryMove.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('move');
    h.engine.setTool.mockClear();

    handleTemporaryEraseGestureBoundary('down', h.deps);

    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('paint');
  });

  it('pointercancel clears inFlight and flushes the deferred apply', () => {
    const h = harness();
    handleTemporaryEraseGestureBoundary('down', h.deps);
    h.engine.setTool.mockClear();

    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    expect(h.engine.setTool).not.toHaveBeenCalled();

    handleTemporaryEraseGestureBoundary('cancel', h.deps);
    expect(h.engine.setTool).toHaveBeenCalledTimes(1);
    expect(h.engine.setTool).toHaveBeenCalledWith('move');
    expect(temporaryMove.peek()).toBe(true);
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

  it('the teardown removes every listener and clears BOTH arms', () => {
    const h = harness();
    const targets = mountTargets();
    const teardown = wireMount(targets, h.deps);
    handleTemporaryEraseKeyDown(keyEvent('Alt').event, h.deps);
    handleTemporaryMoveKeyDown(keyEvent('Meta').event, h.deps);
    expect(temporaryErase.peek()).toBe(true);
    expect(temporaryMove.peek()).toBe(true);

    teardown();

    expect(temporaryErase.peek()).toBe(false);
    expect(temporaryMove.peek()).toBe(false);
    expect(targets.window.registrations).toHaveLength(0);
    expect(targets.document.registrations).toHaveLength(0);
    expect(targets.window.removeEventListener).toHaveBeenCalledTimes(6);
    expect(targets.document.removeEventListener).toHaveBeenCalledTimes(1);
  });

  it('end-to-end through the mounted listeners: a fake Meta keydown arms the fake engine and visibilitychange-to-hidden disarms it', () => {
    const h = harness();
    const targets = mountTargets();
    const teardown = wireMount(targets, h.deps);

    const { event } = keyEvent('Meta');
    targets.window.dispatch('keydown', event);
    expect(temporaryMove.peek()).toBe(true);
    expect(h.engine.setTool).toHaveBeenCalledWith('move');

    targets.document.visibilityState = 'hidden';
    targets.document.dispatch('visibilitychange', plainEvent().event);
    expect(temporaryMove.peek()).toBe(false);
    expect(h.engine.setTool).toHaveBeenLastCalledWith('paint');

    teardown();
  });
});

describe('source pins — rail + Studio wiring (SOURCE PINS)', () => {
  it("the rail declares a 'move' item immediately after the 'erase' item", () => {
    const body = railArrayBody();
    const entries = body.split('\n').filter((line) => line.trim().startsWith('{ id:'));
    const eraseIndex = entries.findIndex((line) => line.includes("id: 'erase'"));
    const moveIndex = entries.findIndex((line) => line.includes("id: 'move'"));
    expect(eraseIndex).toBeGreaterThanOrEqual(0);
    expect(moveIndex).toBe(eraseIndex + 1);
    expect(entries[moveIndex]).toContain("label: 'Move'");
    expect(entries[moveIndex]).toContain("kind: 'tool'");
    expect(entries[moveIndex]).toContain('moveToolIcon');
  });

  it("the rail imports the move icon and unions the 'move' action", () => {
    expect(railSource).toContain("import moveToolIcon from '../../../assets/physics-paint-ui/icons/move-tool.svg';");
    expect(railSource).toMatch(/\|\s*'move'/);
  });

  it('the rail highlights the move item, dispatches its selection and gates it on the stroke script', () => {
    expect(railSource).toContain("if (item.id === 'move') return activeTool === 'move';");
    expect(railSource).toContain("if (item.id === 'move') onSelectTool('move', physicsMode);");
    expect(railSource).toContain('strokeScriptInMemory');
    expect(railSource).toContain('!strokeScriptInMemory.value');
    // The IMPL body must keep the existing narrow-history pin green.
    const railStart = railSource.indexOf('function PhysicsPaintToolRailImpl');
    const railEnd = railSource.indexOf('export const PhysicsPaintToolRail', railStart);
    expect(railStart).toBeGreaterThanOrEqual(0);
    expect(railSource.slice(railStart, railEnd)).not.toContain('historyAvailability?.value');
  });

  it('the Studio writes strokeScriptInMemory from the existing history listener', () => {
    expect(studioSource).toContain('const strokeScriptInMemory = useSignal(false);');
    expect(studioSource).toContain('strokeScriptInMemory.value = readyEngine.getStrokeCount() > 0;');
    const listenerStart = studioSource.indexOf('readyEngine.setHistoryAvailabilityListener(');
    expect(listenerStart).toBeGreaterThanOrEqual(0);
    const listenerEnd = studioSource.indexOf('});', listenerStart);
    expect(studioSource.slice(listenerStart, listenerEnd)).toContain('strokeScriptInMemory.value = readyEngine.getStrokeCount() > 0;');
  });

  it('the armed-guarded effect peeks BOTH arms and the tool-rail memo passes the signal through', () => {
    expect(studioSource).toContain('if (!temporaryErase.peek() && !temporaryMove.peek()) return;');
    const memoStart = studioSource.indexOf('const toolRail = toolRailPropsMemo.resolve(');
    expect(memoStart).toBeGreaterThanOrEqual(0);
    const memoEnd = studioSource.indexOf('}));', memoStart);
    const memo = studioSource.slice(memoStart, memoEnd);
    expect(memo).toContain('strokeScriptInMemory');
    expect(memo).toContain('strokeScriptInMemory,');
    // Preact signals only — no useState for the feature gate.
    expect(studioSource).not.toContain('const [strokeScriptInMemory');
  });
});
