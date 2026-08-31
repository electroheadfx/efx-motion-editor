import { describe, expect, it, vi } from 'vitest';
import type { VNode } from 'preact';
import { signal } from '@preact/signals';
import {
  PhysicsPaintBackgroundClipSection,
  usePhysicsPaintBackgroundClipSectionController,
  type PhysicsPaintBackgroundClipSectionPorts,
  type PhysicsPaintBackgroundClipSectionProps,
} from './PhysicsPaintBackgroundClipSection';
import type { EfxPaintDocument, FrameLoopClip, FrameLoopClipRepeat } from '../../../efx-paint/document/efxPaintDocument';
import type { BackgroundClipMutationResult } from '../../../stores/efxPaintStore';

/**
 * 49-06 (Task 1) contract tests for the S5 right-panel `Background Clip`
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

function makeClip(overrides: Partial<FrameLoopClip> = {}): FrameLoopClip {
  return {
    id: 'clip-1',
    startFrame: 10,
    sourceFrameRefs: ['ref-shot-1', 'ref-shot-2', 'ref-shot-10'],
    repeat: { mode: 'finite', count: 3 },
    sourceKind: 'imported-background',
    revision: 1,
    ...overrides,
  };
}

function makeDocument(clips: readonly FrameLoopClip[]): EfxPaintDocument {
  return {
    version: 1,
    parentLayerId: 'layer-1',
    documentRevision: 1,
    activeTrackId: 'track-1',
    tracks: [],
    background: { id: 'bg-1', clips, fallback: { mode: 'transparent' }, visible: true, revision: 1 },
    photoReference: null,
    compositeRevision: 0,
  };
}

/**
 * Store-simulating harness: the fake setRepeat/deleteClip mutate a mutable
 * clip list exactly like the 49-02 store ops (validation + commit), so the
 * controller tests exercise the real commit/rejection/delete/undo flow without
 * importing the store.
 */
function createHarness(initialClips: readonly FrameLoopClip[], selection: string | null) {
  const state = { clips: [...initialClips] };
  const selectionSignal = signal<string | null>(selection);
  const setRepeat = vi.fn((_layerId: string, clipId: string, repeat: FrameLoopClipRepeat): BackgroundClipMutationResult => {
    const clip = state.clips.find((candidate) => candidate.id === clipId);
    if (!clip) return { ok: false, reason: 'clip-not-found' };
    if (repeat.mode === 'finite' && (!Number.isInteger(repeat.count) || repeat.count < 1)) {
      return { ok: false, reason: 'invalid-repeat' };
    }
    state.clips = state.clips.map((candidate) => (candidate.id === clipId ? { ...candidate, repeat } : candidate));
    return { ok: true, clipId, descriptor: null };
  });
  const deleteClip = vi.fn((_layerId: string, clipId: string): BackgroundClipMutationResult => {
    if (!state.clips.some((candidate) => candidate.id === clipId)) return { ok: false, reason: 'clip-not-found' };
    state.clips = state.clips.filter((candidate) => candidate.id !== clipId);
    return { ok: true, clipId, descriptor: null };
  });
  const ports: PhysicsPaintBackgroundClipSectionPorts = {
    getDocument: () => makeDocument(state.clips),
    setRepeat,
    deleteClip,
    resolveFilename: (ref) => FILENAMES[ref],
  };
  const render = () => usePhysicsPaintBackgroundClipSectionController({
    layerId: 'layer-1',
    selectedBackgroundClipId: selectionSignal,
    ports,
  });
  return { state, selectionSignal, setRepeat, deleteClip, ports, render };
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

function renderSection(props: PhysicsPaintBackgroundClipSectionProps): AnyVNode {
  return PhysicsPaintBackgroundClipSection(props) as AnyVNode;
}

describe('usePhysicsPaintBackgroundClipSectionController (49-06, S5 state machine)', () => {
  it('reports no clip when the selection is empty (empty right-panel row)', () => {
    const harness = createHarness([makeClip()], null);
    const controller = harness.render();
    expect(controller.clip).toBeUndefined();
    expect(controller.isInfinite).toBe(false);
    expect(controller.filenames).toEqual([]);
  });

  it('resolves the selected clip from the document and surfaces accepted facts (populated row)', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    const controller = harness.render();
    expect(controller.clip?.id).toBe('clip-1');
    expect(controller.clip?.startFrame).toBe(10);
    expect(controller.repeatDraft.value).toBe('3');
    expect(controller.isInfinite).toBe(false);
    // Source cycle fact: original filenames in the clip's stored order (D-02).
    expect(controller.filenames).toEqual(['shot_1.png', 'shot_2.png', 'shot_10.png']);
  });

  it('commits a positive integer on Enter/blur exactly once with { mode: finite, count }', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    const controller = harness.render();
    controller.repeatDraft.value = '5';
    controller.commitRepeat();
    expect(harness.setRepeat).toHaveBeenCalledTimes(1);
    expect(harness.setRepeat).toHaveBeenCalledWith('layer-1', 'clip-1', { mode: 'finite', count: 5 });
    expect(controller.repeatError.value).toBeNull();
  });

  it('does NOT commit invalid input (empty, zero, negative) and keeps the prior accepted value visible', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    const controller = harness.render();
    for (const invalid of ['', '0', '-2', 'abc']) {
      controller.repeatDraft.value = invalid;
      controller.commitRepeat();
      expect(harness.setRepeat).not.toHaveBeenCalled();
      expect(controller.repeatError.value).toBe('Enter a positive integer.');
      // The prior accepted value stays visible (UI-SPEC repeat rows: error).
      expect(controller.repeatDraft.value).toBe('3');
    }
  });

  it('handles a store-level invalid-repeat rejection by restoring the prior accepted value', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    harness.setRepeat.mockReturnValue({ ok: false, reason: 'invalid-repeat' });
    const controller = harness.render();
    controller.repeatDraft.value = '9';
    controller.commitRepeat();
    expect(harness.setRepeat).toHaveBeenCalledTimes(1);
    expect(controller.repeatError.value).toBe('Enter a positive integer.');
    expect(controller.repeatDraft.value).toBe('3');
  });

  it('does not skip a same-value commit — the call is made and the store no-op is inert (BKG-09)', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    const controller = harness.render();
    controller.repeatDraft.value = '3';
    controller.commitRepeat();
    // The call is NOT skipped by a value-equality guard; the store's idempotence
    // (descriptor: null, no revision bump) is proven at 49-02.
    expect(harness.setRepeat).toHaveBeenCalledTimes(1);
    expect(harness.setRepeat).toHaveBeenCalledWith('layer-1', 'clip-1', { mode: 'finite', count: 3 });
    expect(controller.repeatError.value).toBeNull();
  });

  it('toggles Loop indefinitely on with { mode: infinite } and off with the last finite count', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    const controller = harness.render();
    controller.toggleInfinity(true);
    expect(harness.setRepeat).toHaveBeenLastCalledWith('layer-1', 'clip-1', { mode: 'infinite' });
    // The controller is a per-render snapshot — re-render to read the accepted
    // document state (the view re-renders on efxPaintVersion in production).
    expect(harness.render().isInfinite).toBe(true);
    // The SAME controller instance toggles off so its lastFiniteCount signal
    // (saved when ∞ was toggled on) persists — mirroring the keyed mount.
    controller.toggleInfinity(false);
    expect(harness.setRepeat).toHaveBeenLastCalledWith('layer-1', 'clip-1', { mode: 'finite', count: 3 });
    expect(harness.render().isInfinite).toBe(false);
  });

  it('deletes with no dialog and the section disappears on the resulting empty selection; Undo restores by reference', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    const controller = harness.render();
    controller.handleDelete();
    expect(harness.deleteClip).toHaveBeenCalledTimes(1);
    expect(harness.deleteClip).toHaveBeenCalledWith('layer-1', 'clip-1');
    // The clip is gone from the document — the section renders nothing.
    const afterDelete = harness.render();
    expect(afterDelete.clip).toBeUndefined();
    // Undo restores the clip by reference (same id) — the section reappears.
    harness.state.clips = [makeClip()];
    const afterUndo = harness.render();
    expect(afterUndo.clip?.id).toBe('clip-1');
  });
});

describe('PhysicsPaintBackgroundClipSection view (49-06, S5 render + accessibility)', () => {
  it('renders nothing when no clip is selected (empty row)', () => {
    const harness = createHarness([makeClip()], null);
    const tree = renderSection({ layerId: 'layer-1', selectedBackgroundClipId: harness.selectionSignal, ports: harness.ports });
    expect(tree).toBeNull();
  });

  it('renders the Background Clip section with start frame, repeat, source fact, and delete from accepted state', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    const tree = renderSection({ layerId: 'layer-1', selectedBackgroundClipId: harness.selectionSignal, ports: harness.ports });
    expect(textContent(tree)).toContain('Background Clip');
    expect(textContent(tree)).toContain('Start frame');
    expect(textContent(tree)).toContain('10');
    expect(textContent(tree)).toContain('Repeat');
    // The source fact renders as `{N} image(s)` — the walker joins the number
    // and the label with a space, so assert the two tokens separately.
    expect(textContent(tree)).toContain('3');
    expect(textContent(tree)).toContain('image(s)');
    expect(textContent(tree)).toContain('Enter a positive integer.');
    // Accessibility contract (UI-SPEC): named controls.
    const repeatInput = findByLabel(tree, 'Repeat');
    expect(repeatInput.props['aria-describedby']).toBe('physics-bg-repeat-hint');
    const infinityToggle = findByLabel(tree, 'Loop indefinitely');
    expect(infinityToggle.props['aria-pressed']).toBe(false);
    const deleteButton = findByLabel(tree, 'Delete clip');
    expect(deleteButton).toBeDefined();
  });

  it('lists the original filenames in the clip stored order in the source tooltip (D-02)', () => {
    const harness = createHarness([makeClip()], 'clip-1');
    const tree = renderSection({ layerId: 'layer-1', selectedBackgroundClipId: harness.selectionSignal, ports: harness.ports });
    // The source value is the `physics-paint-bg-clip-value` element that
    // carries the filename tooltip (the Start frame value has no title).
    const sourceValue = childrenOf(tree).find((node) => {
      const vnode = node as AnyVNode;
      return typeof vnode.type !== 'function'
        && String(vnode.props?.class ?? '').split(/\s+/).includes('physics-paint-bg-clip-value')
        && typeof vnode.props?.title === 'string';
    }) as AnyVNode | undefined;
    expect(sourceValue, 'Missing source value with filename tooltip').toBeDefined();
    expect(String(sourceValue!.props.title)).toBe('shot_1.png\nshot_2.png\nshot_10.png');
  });

  it('reflects the infinite state on the ∞ toggle aria-pressed and disables the numeric input', () => {
    const harness = createHarness([makeClip({ repeat: { mode: 'infinite' } })], 'clip-1');
    const tree = renderSection({ layerId: 'layer-1', selectedBackgroundClipId: harness.selectionSignal, ports: harness.ports });
    const infinityToggle = findByLabel(tree, 'Loop indefinitely');
    expect(infinityToggle.props['aria-pressed']).toBe(true);
    const repeatInput = findByLabel(tree, 'Repeat');
    expect(repeatInput.props.disabled).toBe(true);
  });
});
