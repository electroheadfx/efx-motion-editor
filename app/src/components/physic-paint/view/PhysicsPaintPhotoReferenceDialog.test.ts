import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { VNode } from 'preact';
import {
  PhysicsPaintPhotoReferenceDialog,
  type PhysicsPaintPhotoReferenceDialogProps,
} from './PhysicsPaintPhotoReferenceDialog';
import {
  usePhysicsPaintPhotoReferenceController,
  PHOTO_REFERENCE_EMPTY_SOURCE,
  PHOTO_REFERENCE_UNLOCKED_TOOLTIP,
  type PhysicsPaintPhotoReferencePorts,
} from './physicsPaintPhotoReferenceController';
import type { EfxPaintDocument, PhotoReferenceTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { PhotoReferenceDisplayResult, PhotoReferenceMutationResult } from '../../../stores/efxPaintStore';

/**
 * 50-UAT (modal redesign) contract tests for the floating Photo Reference
 * dialog. The controller is signals-driven (useSignal only — the same harness
 * as the pre-redesign section tests), so the test mocks @preact/signals down to
 * the real signal core. The dialog itself uses refs/effect for drag/focus, so
 * preact/hooks is mocked with a cursor-based runtime (the
 * PhysicsPaintPlayScriptDialog.test.ts pattern) and the dialog is invoked as a
 * plain function and walked as a vnode tree.
 */

const hooks = vi.hoisted(() => ({
  refs: new Map<number, { current: unknown }>(),
  cursor: 0,
  reset() {
    this.refs = new Map();
    this.cursor = 0;
  },
}));

vi.mock('preact/hooks', () => ({
  useRef: <Value>(initial: Value) => {
    const index = hooks.cursor++;
    if (!hooks.refs.has(index)) hooks.refs.set(index, { current: initial });
    return hooks.refs.get(index) as { current: Value };
  },
  useEffect: () => {},
}));

vi.mock('@preact/signals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@preact/signals')>();
  return {
    ...actual,
    useSignal: <Value>(value: Value) => actual.signal(value),
  };
});

beforeEach(() => {
  hooks.reset();
});

type AnyVNode = VNode<Record<string, any>>;

const FILENAMES: Record<string, string> = {
  'ref-shot-1': 'shot_1.png',
  'ref-shot-2': 'shot_2.png',
  'ref-shot-10': 'shot_10.png',
};

function makeTrack(overrides: Partial<PhotoReferenceTrack> = {}): PhotoReferenceTrack {
  return {
    id: 'photo-ref-1',
    sourceFrameRefs: ['ref-shot-1', 'ref-shot-2', 'ref-shot-10'],
    revision: 0,
    visibleInStudio: true,
    opacity: 0.5,
    transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 },
    transformLocked: true,
    ...overrides,
  };
}

function makeDocument(photoReference: PhotoReferenceTrack | null): EfxPaintDocument {
  return {
    version: 1,
    parentLayerId: 'layer-1',
    documentRevision: 1,
    activeTrackId: 'track-1',
    tracks: [],
    background: { id: 'bg-1', clips: [], fallback: { mode: 'transparent' }, visible: true, revision: 1 },
    photoReference,
    compositeRevision: 0,
  };
}

/** Store-simulating harness: the fake setters mutate a mutable track exactly
 *  like the 50-02 store ops (validation + commit), so the controller tests
 *  exercise the real commit flow without importing the store. */
function createHarness(initialTrack: PhotoReferenceTrack | null) {
  const state = { track: initialTrack };
  const setOpacity = vi.fn((_layerId: string, opacity: number): PhotoReferenceDisplayResult => {
    if (!state.track) return { ok: false, reason: 'no-photo-reference' };
    state.track = { ...state.track, opacity };
    return { ok: true };
  });
  const setTransformLocked = vi.fn((_layerId: string, locked: boolean): PhotoReferenceDisplayResult => {
    if (!state.track) return { ok: false, reason: 'no-photo-reference' };
    state.track = { ...state.track, transformLocked: locked };
    return { ok: true };
  });
  const setVisible = vi.fn((_layerId: string, visible: boolean): PhotoReferenceDisplayResult => {
    if (!state.track) return { ok: false, reason: 'no-photo-reference' };
    state.track = { ...state.track, visibleInStudio: visible };
    return { ok: true };
  });
  const clearReference = vi.fn((_layerId: string): PhotoReferenceMutationResult => {
    if (!state.track) return { ok: false, reason: 'no-photo-reference' };
    state.track = null;
    return { ok: true, descriptor: null };
  });
  const ports: PhysicsPaintPhotoReferencePorts = {
    getDocument: () => makeDocument(state.track),
    setOpacity,
    setTransformLocked,
    setVisible,
    clearReference,
    resolveFilename: (ref) => FILENAMES[ref],
  };
  const render = () => usePhysicsPaintPhotoReferenceController({
    layerId: 'layer-1',
    ports,
  });
  return { state, setOpacity, setTransformLocked, setVisible, clearReference, ports, render };
}

function childrenOf(node: unknown): unknown[] {
  if (Array.isArray(node)) return node.flatMap(childrenOf);
  if (!node || typeof node !== 'object') return [];
  const vnode = node as AnyVNode;
  if (typeof vnode.type === 'function') {
    const rendered = (vnode.type as (props: Record<string, any>) => unknown)(vnode.props);
    return [vnode, ...childrenOf(rendered)];
  }
  const children = vnode.props?.children;
  return [vnode, ...childrenOf(children)];
}

function textContent(node: unknown): string {
  const parts: string[] = [];
  const walk = (current: unknown) => {
    if (typeof current === 'string' || typeof current === 'number') { parts.push(String(current)); return; }
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) { for (const child of current) walk(child); return; }
    walk((current as AnyVNode).props?.children);
  };
  walk(node);
  return parts.join(' ');
}

function findByLabel(tree: AnyVNode, label: string): AnyVNode {
  const match = childrenOf(tree).find((node) => {
    const vnode = node as AnyVNode;
    return typeof vnode.type !== 'function' && vnode.props?.['aria-label'] === label;
  }) as AnyVNode | undefined;
  expect(match, `Missing element with aria-label ${label}`).toBeDefined();
  return match!;
}

function fireClick(node: AnyVNode): void {
  const onClick = (node.props as unknown as { onClick?: () => void }).onClick;
  expect(onClick, 'Missing onClick handler').toBeDefined();
  onClick?.();
}

function renderDialog(props: Partial<PhysicsPaintPhotoReferenceDialogProps> & { ports: PhysicsPaintPhotoReferencePorts }): AnyVNode {
  return PhysicsPaintPhotoReferenceDialog({
    open: true,
    layerId: 'layer-1',
    onClose: () => {},
    onImportSource: () => {},
    ...props,
  }) as AnyVNode;
}

describe('usePhysicsPaintPhotoReferenceController (50-UAT, dialog state machine)', () => {
  it('reports the defaults when no photo/reference track exists (empty-source state)', () => {
    const harness = createHarness(null);
    const controller = harness.render();
    expect(controller.opacityPercent).toBe(50);
    expect(controller.transformLocked).toBe(true);
    expect(controller.sourceCount).toBe(0);
    expect(controller.filenames).toEqual([]);
    expect(controller.hasSource).toBe(false);
  });

  it('reads the accepted document state (opacity, lock, source facts)', () => {
    const harness = createHarness(makeTrack({ opacity: 0.75, transformLocked: false }));
    const controller = harness.render();
    expect(controller.opacityPercent).toBe(75);
    expect(controller.transformLocked).toBe(false);
    expect(controller.sourceCount).toBe(3);
    // Source cycle fact: original filenames in the track's stored order (D-02).
    expect(controller.filenames).toEqual(['shot_1.png', 'shot_2.png', 'shot_10.png']);
    expect(controller.hasSource).toBe(true);
  });

  it('commitOpacity routes the 0..1 store value through setOpacity (D-12)', () => {
    const harness = createHarness(makeTrack());
    const controller = harness.render();
    controller.commitOpacity(75);
    expect(harness.setOpacity).toHaveBeenCalledTimes(1);
    expect(harness.setOpacity).toHaveBeenCalledWith('layer-1', 0.75);
    // The draft is cleared on commit (release-commit).
    expect(controller.opacityDraft.value).toBeNull();
  });

  it('previewOpacity updates the live draft WITHOUT a store write (release-commit D-12)', () => {
    const harness = createHarness(makeTrack());
    const controller = harness.render();
    controller.previewOpacity(30);
    expect(harness.setOpacity).not.toHaveBeenCalled();
    expect(controller.opacityDraft.value).toBe(30);
  });

  it('toggleTransformLocked inverts the LIVE lock — the reverse click re-locks (50-UAT round 2)', () => {
    const harness = createHarness(makeTrack({ transformLocked: true }));
    const controller = harness.render();
    controller.toggleTransformLocked();
    expect(harness.setTransformLocked).toHaveBeenCalledTimes(1);
    expect(harness.setTransformLocked).toHaveBeenCalledWith('layer-1', false);
    // A second render with the now-unlocked track re-locks instead of repeating
    // the stale first value — the toggle is always reversible.
    harness.setTransformLocked.mockClear();
    harness.state.track = makeTrack({ transformLocked: false });
    const reRendered = harness.render();
    reRendered.toggleTransformLocked();
    expect(harness.setTransformLocked).toHaveBeenCalledWith('layer-1', true);
  });

  it('toggleVisible inverts the LIVE visibility — hidden can re-show (50-UAT round 2)', () => {
    const harness = createHarness(makeTrack({ visibleInStudio: true }));
    const controller = harness.render();
    controller.toggleVisible();
    expect(harness.setVisible).toHaveBeenCalledTimes(1);
    expect(harness.setVisible).toHaveBeenCalledWith('layer-1', false);
    harness.setVisible.mockClear();
    harness.state.track = makeTrack({ visibleInStudio: false });
    const reRendered = harness.render();
    reRendered.toggleVisible();
    expect(harness.setVisible).toHaveBeenCalledWith('layer-1', true);
  });

  it('removeReference routes through clearReference (D-03 remove)', () => {
    const harness = createHarness(makeTrack());
    const controller = harness.render();
    controller.removeReference();
    expect(harness.clearReference).toHaveBeenCalledTimes(1);
    expect(harness.clearReference).toHaveBeenCalledWith('layer-1');
  });
});

describe('PhysicsPaintPhotoReferenceDialog view (50-UAT, render + accessibility)', () => {
  it('renders nothing when closed', () => {
    const harness = createHarness(makeTrack());
    const tree = PhysicsPaintPhotoReferenceDialog({
      open: false,
      layerId: 'layer-1',
      ports: harness.ports,
      onClose: () => {},
      onImportSource: () => {},
    }) as unknown;
    expect(tree).toBeNull();
  });

  it('renders the dialog shell with title and close button when open', () => {
    const harness = createHarness(makeTrack());
    const tree = renderDialog({ ports: harness.ports });
    const dialog = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function' && vnode.props?.['role'] === 'dialog';
    }) as AnyVNode | undefined;
    expect(dialog, 'Missing role=dialog').toBeDefined();
    expect(textContent(dialog)).toContain('Photo Reference');
    expect(findByLabel(tree, 'Close photo reference')).toBeDefined();
  });

  it('renders the Overlay opacity slider with the live aria-valuenow (D-12)', () => {
    const harness = createHarness(makeTrack({ opacity: 0.5 }));
    const tree = renderDialog({ ports: harness.ports });
    const slider = findByLabel(tree, 'Overlay opacity');
    expect(slider.props['role']).toBe('slider');
    expect(slider.props['aria-valuemin']).toBe(0);
    expect(slider.props['aria-valuemax']).toBe(100);
    expect(slider.props['aria-valuenow']).toBe(50);
    const output = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function' && vnode.type === 'output';
    }) as AnyVNode | undefined;
    expect(output, 'Missing opacity readout').toBeDefined();
    expect(textContent(output)).toContain('50');
    expect(textContent(output)).toContain('%');
  });

  it('renders the Lock reference transform toggle with aria-pressed reflecting lock state (D-13)', () => {
    const harness = createHarness(makeTrack({ transformLocked: true }));
    const tree = renderDialog({ ports: harness.ports });
    const toggle = findByLabel(tree, 'Lock reference transform');
    expect(toggle.props['aria-pressed']).toBe(true);
    expect(toggle.props.title).toBeUndefined();
  });

  it('renders the unlock tooltip when the transform is unlocked (D-13)', () => {
    const harness = createHarness(makeTrack({ transformLocked: false }));
    const tree = renderDialog({ ports: harness.ports });
    const toggle = findByLabel(tree, 'Lock reference transform');
    expect(toggle.props['aria-pressed']).toBe(false);
    expect(toggle.props.title).toBe(PHOTO_REFERENCE_UNLOCKED_TOOLTIP);
  });

  it('lists the original filenames in the track stored order in the source tooltip (D-02)', () => {
    const harness = createHarness(makeTrack());
    const tree = renderDialog({ ports: harness.ports });
    const sourceValue = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).includes('physics-paint-photo-reference-chip')
        && typeof vnode.props?.title === 'string';
    }) as AnyVNode | undefined;
    expect(sourceValue, 'Missing source value with filename tooltip').toBeDefined();
    expect(String(sourceValue!.props.title)).toBe('shot_1.png\nshot_2.png\nshot_10.png');
    expect(textContent(sourceValue)).toContain('3');
    expect(textContent(sourceValue)).toContain('image(s)');
  });

  it('renders the Show reference in studio toggle with aria-pressed reflecting visibility (D-11)', () => {
    const harness = createHarness(makeTrack({ visibleInStudio: true }));
    const tree = renderDialog({ ports: harness.ports });
    const toggle = findByLabel(tree, 'Show reference in studio');
    expect(toggle.props['aria-pressed']).toBe(true);
    expect(textContent(toggle)).toContain('Visible');
  });

  it('routes the empty-state Import button to onImportSource', () => {
    const harness = createHarness(null);
    const onImportSource = vi.fn();
    const tree = renderDialog({ ports: harness.ports, onImportSource });
    expect(textContent(tree)).toContain(PHOTO_REFERENCE_EMPTY_SOURCE);
    const importButton = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).includes('physics-paint-photo-reference-import');
    }) as AnyVNode | undefined;
    expect(importButton, 'Missing Import button').toBeDefined();
    expect(textContent(importButton)).toContain('Import');
    fireClick(importButton!);
    expect(onImportSource).toHaveBeenCalledTimes(1);
  });

  it('routes the Replace source button to onImportSource when a source exists (D-03)', () => {
    const harness = createHarness(makeTrack());
    const onImportSource = vi.fn();
    const tree = renderDialog({ ports: harness.ports, onImportSource });
    const importButton = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).includes('physics-paint-photo-reference-import');
    }) as AnyVNode | undefined;
    expect(importButton, 'Missing Replace source button').toBeDefined();
    expect(textContent(importButton)).toContain('Replace source');
    fireClick(importButton!);
    expect(onImportSource).toHaveBeenCalledTimes(1);
  });

  it('renders the Remove button only when a source exists (D-03 remove)', () => {
    const withSource = createHarness(makeTrack());
    const withSourceTree = renderDialog({ ports: withSource.ports });
    const removeWith = childrenOf(withSourceTree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).includes('physics-paint-photo-reference-remove');
    }) as AnyVNode | undefined;
    expect(removeWith, 'Missing Remove button with source').toBeDefined();
    fireClick(removeWith!);
    expect(withSource.clearReference).toHaveBeenCalledTimes(1);

    const withoutSource = createHarness(null);
    const withoutTree = renderDialog({ ports: withoutSource.ports });
    const removeWithout = childrenOf(withoutTree).filter((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).includes('physics-paint-photo-reference-remove');
    });
    expect(removeWithout).toHaveLength(0);
  });

  it('routes the header close X to onClose', () => {
    const harness = createHarness(makeTrack());
    const onClose = vi.fn();
    const tree = renderDialog({ ports: harness.ports, onClose });
    const close = findByLabel(tree, 'Close photo reference');
    fireClick(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render dialog content when the layer id is missing', () => {
    const harness = createHarness(makeTrack());
    const tree = PhysicsPaintPhotoReferenceDialog({
      open: true,
      layerId: null,
      ports: harness.ports,
      onClose: () => {},
      onImportSource: () => {},
    }) as unknown;
    expect(tree).toBeNull();
  });
});
