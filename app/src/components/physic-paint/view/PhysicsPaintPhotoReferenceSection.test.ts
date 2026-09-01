import { describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import {
  PhysicsPaintPhotoReferenceSection,
  usePhysicsPaintPhotoReferenceSectionController,
  PHOTO_REFERENCE_MODE_HINT,
  PHOTO_REFERENCE_EMPTY_SOURCE,
  PHOTO_REFERENCE_UNLOCKED_TOOLTIP,
  type PhysicsPaintPhotoReferenceSectionPorts,
  type PhysicsPaintPhotoReferenceSectionProps,
} from './PhysicsPaintPhotoReferenceSection';
import type { EfxPaintDocument, PhotoReferenceMode, PhotoReferenceTrack } from '../../../efx-paint/document/efxPaintDocument';
import type { PhotoReferenceDisplayResult, PhotoReferenceMutationResult } from '../../../stores/efxPaintStore';

/**
 * 50-05 (Task 1) contract tests for the S5 right-panel `Photo Reference`
 * section. The section is signals-driven (useSignal only — no useState,
 * efx-preact-reactivity), so the test mocks the @preact/signals hook wrapper
 * down to the real signal core (the BackgroundAssetPickerView.test.ts pattern)
 * and exercises the controller state machine directly. The view component is
 * additionally rendered as a plain function and walked as a vnode tree (the
 * PhysicsPaintRightPanel.test.ts pattern) for the render/accessibility surface.
 */

vi.mock('@preact/signals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@preact/signals')>();
  return {
    ...actual,
    useSignal: <Value>(value: Value) => actual.signal(value),
  };
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
    mode: 'reference-only',
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

/**
 * Store-simulating harness: the fake setMode/setOpacity/setTransformLocked
 * mutate a mutable track exactly like the 50-02 store ops (validation + commit),
 * so the controller tests exercise the real commit flow without importing the
 * store.
 */
function createHarness(initialTrack: PhotoReferenceTrack | null) {
  const state = { track: initialTrack };
  const setMode = vi.fn((_layerId: string, mode: PhotoReferenceMode): PhotoReferenceMutationResult => {
    if (!state.track) return { ok: false, reason: 'no-photo-reference' };
    state.track = { ...state.track, mode, revision: state.track.revision + 1 };
    return { ok: true, descriptor: null };
  });
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
  const ports: PhysicsPaintPhotoReferenceSectionPorts = {
    getDocument: () => makeDocument(state.track),
    setMode,
    setOpacity,
    setTransformLocked,
    resolveFilename: (ref) => FILENAMES[ref],
  };
  const render = () => usePhysicsPaintPhotoReferenceSectionController({
    layerId: 'layer-1',
    ports,
  });
  return { state, setMode, setOpacity, setTransformLocked, ports, render };
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

function renderSection(props: PhysicsPaintPhotoReferenceSectionProps): AnyVNode {
  return PhysicsPaintPhotoReferenceSection(props) as AnyVNode;
}

describe('usePhysicsPaintPhotoReferenceSectionController (50-05, S5 state machine)', () => {
  it('reports the defaults when no photo/reference track exists (empty-source row)', () => {
    const harness = createHarness(null);
    const controller = harness.render();
    expect(controller.mode).toBe('reference-only');
    expect(controller.opacityPercent).toBe(50);
    expect(controller.transformLocked).toBe(true);
    expect(controller.sourceCount).toBe(0);
    expect(controller.filenames).toEqual([]);
    expect(controller.hasSource).toBe(false);
  });

  it('reads the accepted document state (mode, opacity, lock, source facts)', () => {
    const harness = createHarness(makeTrack({ mode: 'reveal-source', opacity: 0.75, transformLocked: false }));
    const controller = harness.render();
    expect(controller.mode).toBe('reveal-source');
    expect(controller.opacityPercent).toBe(75);
    expect(controller.transformLocked).toBe(false);
    expect(controller.sourceCount).toBe(3);
    // Source cycle fact: original filenames in the track's stored order (D-02).
    expect(controller.filenames).toEqual(['shot_1.png', 'shot_2.png', 'shot_10.png']);
    expect(controller.hasSource).toBe(true);
  });

  it('selectMode routes one undoable mutation through setMode (D-07)', () => {
    const harness = createHarness(makeTrack());
    const controller = harness.render();
    controller.selectMode('masked-transform-source');
    expect(harness.setMode).toHaveBeenCalledTimes(1);
    expect(harness.setMode).toHaveBeenCalledWith('layer-1', 'masked-transform-source');
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
    // The live preview lives in the draft signal (the view reads it as
    // `draft ?? accepted`); the store write happens only on commit.
    expect(controller.opacityDraft.value).toBe(30);
  });

  it('toggleTransformLocked routes the lock state through setTransformLocked (D-13)', () => {
    const harness = createHarness(makeTrack());
    const controller = harness.render();
    controller.toggleTransformLocked(false);
    expect(harness.setTransformLocked).toHaveBeenCalledTimes(1);
    expect(harness.setTransformLocked).toHaveBeenCalledWith('layer-1', false);
  });
});

describe('PhysicsPaintPhotoReferenceSection view (50-05, S5 render + accessibility)', () => {
  it('renders the section heading and the empty-source fact when no source exists', () => {
    const harness = createHarness(null);
    const tree = renderSection({ layerId: 'layer-1', ports: harness.ports });
    expect(textContent(tree)).toContain('Photo Reference');
    expect(textContent(tree)).toContain(PHOTO_REFERENCE_EMPTY_SOURCE);
  });

  it('renders the 3-segment Mode radiogroup with the active segment checked (D-05)', () => {
    const harness = createHarness(makeTrack({ mode: 'reveal-source' }));
    const tree = renderSection({ layerId: 'layer-1', ports: harness.ports });
    const group = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function' && vnode.props?.['role'] === 'radiogroup';
    }) as AnyVNode | undefined;
    expect(group, 'Missing Mode radiogroup').toBeDefined();
    expect(group!.props['aria-label']).toBe('Mode');
    // The exclusion hint is aria-describedby on the group (UI-SPEC).
    expect(group!.props['aria-describedby']).toBe('physics-photo-reference-mode-hint');
    const radios = childrenOf(group).filter((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function' && vnode.props?.['role'] === 'radio';
    }) as AnyVNode[];
    expect(radios).toHaveLength(3);
    const labels = radios.map((radio) => textContent(radio));
    expect(labels).toEqual(['Reference only', 'Reveal source', 'Masked transform']);
    const checked = radios.filter((radio) => radio.props['aria-checked'] === true);
    expect(checked).toHaveLength(1);
    expect(textContent(checked[0])).toBe('Reveal source');
  });

  it('renders the exclusion hint copy (D-06 flag-only)', () => {
    const harness = createHarness(makeTrack());
    const tree = renderSection({ layerId: 'layer-1', ports: harness.ports });
    expect(textContent(tree)).toContain(PHOTO_REFERENCE_MODE_HINT);
  });

  it('renders the Overlay opacity slider with the live aria-valuenow (D-12)', () => {
    const harness = createHarness(makeTrack({ opacity: 0.5 }));
    const tree = renderSection({ layerId: 'layer-1', ports: harness.ports });
    const slider = findByLabel(tree, 'Overlay opacity');
    expect(slider.props['role']).toBe('slider');
    expect(slider.props['aria-valuemin']).toBe(0);
    expect(slider.props['aria-valuemax']).toBe(100);
    expect(slider.props['aria-valuenow']).toBe(50);
    // The readout renders `{N}%` — the walker joins the number and the `%`
    // token with a space, so assert the two tokens separately.
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
    const tree = renderSection({ layerId: 'layer-1', ports: harness.ports });
    const toggle = findByLabel(tree, 'Lock reference transform');
    expect(toggle.props['aria-pressed']).toBe(true);
    expect(toggle.props.title).toBeUndefined();
  });

  it('renders the unlock tooltip when the transform is unlocked (D-13)', () => {
    const harness = createHarness(makeTrack({ transformLocked: false }));
    const tree = renderSection({ layerId: 'layer-1', ports: harness.ports });
    const toggle = findByLabel(tree, 'Lock reference transform');
    expect(toggle.props['aria-pressed']).toBe(false);
    expect(toggle.props.title).toBe(PHOTO_REFERENCE_UNLOCKED_TOOLTIP);
  });

  it('lists the original filenames in the track stored order in the source tooltip (D-02)', () => {
    const harness = createHarness(makeTrack());
    const tree = renderSection({ layerId: 'layer-1', ports: harness.ports });
    const sourceValue = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).includes('physics-paint-bg-clip-value')
        && typeof vnode.props?.title === 'string';
    }) as AnyVNode | undefined;
    expect(sourceValue, 'Missing source value with filename tooltip').toBeDefined();
    expect(String(sourceValue!.props.title)).toBe('shot_1.png\nshot_2.png\nshot_10.png');
    expect(textContent(tree)).toContain('3');
    expect(textContent(tree)).toContain('image(s)');
  });
});
