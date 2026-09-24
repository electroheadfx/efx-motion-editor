/**
 * 260918-ovi: NewProjectDialog canvas-format surface.
 *
 * Render tests materialize the vnode tree (no DOM environment — same pattern
 * as NumericStepper.test.tsx / PhysicsPaintTrackRow.test.tsx): the component
 * function is invoked directly and its vnodes are walked, so pill clicks and
 * stepper onChange handlers are driven with plain event objects.
 *
 * The useState stub is STATEFUL across renders (hook slots keyed by call
 * order within one component invocation) so the Choose... folder picker can
 * set dirPath and the Create button's handleCreate closure sees it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hook-slot harness: each renderDialog() resets the cursor; useState slots
// persist across renders so event handlers can drive state forward.
const hookSlots: unknown[] = [];
let hookCursor = 0;
// Mount effects registered by the component under test. Real Preact fires a
// `[]`-deps effect once per mount; the harness invokes these manually to
// simulate an open → close → reopen cycle (WR-01).
const mountEffects: Array<() => void> = [];

vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>();
  return {
    ...actual,
    useRef: <T,>(initial: T): { current: T } => ({ current: initial }),
    useEffect: (fn: () => void) => {
      mountEffects.push(fn);
    },
    useState: <T,>(initial: T): [T, (next: T | ((prev: T) => T)) => void] => {
      const slot = hookCursor++;
      if (!(slot in hookSlots)) hookSlots[slot] = initial;
      const set = (next: T | ((prev: T) => T)) => {
        hookSlots[slot] = typeof next === 'function' ? (next as (p: T) => T)(hookSlots[slot] as T) : next;
      };
      return [hookSlots[slot] as T, set];
    },
  };
});

const mockCreateProject = vi.hoisted(() => vi.fn());
const mockSaveProjectAs = vi.hoisted(() => vi.fn());
const mockOpenDialog = vi.hoisted(() => vi.fn());

vi.mock('../../stores/projectStore', () => ({
  projectStore: {
    createProject: mockCreateProject,
    saveProjectAs: mockSaveProjectAs,
  },
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: mockOpenDialog,
}));

vi.mock('../../lib/projectIoFailureDialog', () => ({
  showProjectIoFailureDialog: vi.fn(async () => {}),
}));

import { NewProjectDialog } from './NewProjectDialog';
import { NumericStepper } from '../shared/NumericStepper';
import {
  CUSTOM_CANVAS_FORMAT_MAX_SIDE,
  CUSTOM_CANVAS_FORMAT_MIN_SIDE,
} from './canvasFormatPresets';

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

function childrenOf(node: TestVNode): unknown[] {
  const children = node.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
}

function materialize(node: unknown, preserve?: ReadonlySet<unknown>): unknown {
  if (node === null || node === undefined || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map((child) => materialize(child, preserve));
  if (typeof node !== 'object') return node;
  const vnode = node as TestVNode;
  // Keep whitelisted function components as leaf vnodes so the test can
  // assert their props directly (e.g. NumericStepper step/min/max).
  if (typeof vnode.type === 'function' && preserve?.has(vnode.type)) {
    return {
      ...vnode,
      props: {
        ...vnode.props,
        children: childrenOf(vnode).map((child) => materialize(child, preserve)),
      },
    } as TestVNode;
  }
  if (typeof vnode.type === 'function') return materialize((vnode.type as (p: unknown) => unknown)(vnode.props), preserve);
  return {
    ...vnode,
    props: {
      ...vnode.props,
      children: childrenOf(vnode).map((child) => materialize(child, preserve)),
    },
  } as TestVNode;
}

function* walk(node: unknown): Generator<TestVNode> {
  if (node === null || node === undefined || typeof node === 'boolean') return;
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
    return;
  }
  if (typeof node !== 'object') return;
  const vnode = node as TestVNode;
  yield vnode;
  for (const child of childrenOf(vnode)) yield* walk(child);
}

function findAll(root: unknown, predicate: (vnode: TestVNode) => boolean): TestVNode[] {
  return [...walk(root)].filter(predicate);
}

function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node !== 'object') return '';
  const vnode = node as TestVNode;
  return childrenOf(vnode).map(textOf).join('');
}

function findPillByLabel(root: unknown, label: string): TestVNode | undefined {
  return findAll(root, (vnode) => {
    if (typeof vnode.type !== 'string' || vnode.type !== 'div') return false;
    const onClick = (vnode.props as { onClick?: unknown }).onClick;
    if (typeof onClick !== 'function') return false;
    return textOf(vnode) === label;
  })[0];
}

function renderDialog(): unknown {
  hookCursor = 0;
  return materialize(NewProjectDialog({ onClose: () => {} }), new Set([NumericStepper]));
}

/** Simulate a fresh dialog open: render, fire the mount effect (WR-01 reset), re-render. */
function openDialogFresh(): unknown {
  renderDialog();
  for (const effect of mountEffects.splice(0)) effect();
  return renderDialog();
}

/** The always-visible W×H steppers, located by their aria labels. */
function steppersByLabel(tree: unknown): { width: TestVNode; height: TestVNode } {
  const steppers = findAll(tree, (vnode) => vnode.type === NumericStepper);
  const width = steppers.find((s) => (s.props.ariaLabel as string).toLowerCase().includes('width'))!;
  const height = steppers.find((s) => (s.props.ariaLabel as string).toLowerCase().includes('height'))!;
  return { width, height };
}

describe('NewProjectDialog canvas format (260918-ovi)', () => {
  beforeEach(() => {
    hookSlots.length = 0;
    hookCursor = 0;
    mountEffects.length = 0;
    mockCreateProject.mockReset();
    mockCreateProject.mockResolvedValue(undefined);
    mockSaveProjectAs.mockReset();
    mockSaveProjectAs.mockResolvedValue(undefined);
    mockOpenDialog.mockReset();
    mockOpenDialog.mockResolvedValue('/projects');
  });

  it('renders one pill option per fixed preset plus a Custom… segment', () => {
    const tree = renderDialog();
    expect(findPillByLabel(tree, 'HD')).toBeDefined();
    expect(findPillByLabel(tree, 'HD Vertical')).toBeDefined();
    expect(findPillByLabel(tree, 'Portrait')).toBeDefined();
    expect(findPillByLabel(tree, 'Square')).toBeDefined();
    expect(findPillByLabel(tree, 'Custom…')).toBeDefined();
  });

  it('Custom… branch renders two editable NumericSteppers with step=1, min=16, max=1920', () => {
    const tree = openDialogFresh();
    const customPill = findPillByLabel(tree, 'Custom…');
    expect(customPill).toBeDefined();
    (customPill!.props as { onClick: () => void }).onClick();

    const nextTree = renderDialog();
    // 260924-ffd: the Frame Rate preset stepper also renders as a
    // NumericStepper — scope this canvas-format assertion to W×H.
    const steppers = findAll(nextTree, (vnode) => vnode.type === NumericStepper).filter((s) =>
      /width|height/i.test(s.props.ariaLabel as string),
    );
    expect(steppers).toHaveLength(2);
    for (const stepper of steppers) {
      expect(stepper.props.step).toBe(1);
      expect(stepper.props.min).toBe(CUSTOM_CANVAS_FORMAT_MIN_SIDE);
      expect(stepper.props.max).toBe(CUSTOM_CANVAS_FORMAT_MAX_SIDE);
      expect(stepper.props.disabled).toBe(false);
    }
    const labels = steppers.map((stepper) => (stepper.props.ariaLabel as string).toLowerCase());
    expect(labels.some((label) => label.includes('width'))).toBe(true);
    expect(labels.some((label) => label.includes('height'))).toBe(true);
  });

  it('always renders the W×H fields greyed at the open defaults (amendment; WR-01 unchanged)', () => {
    const tree = openDialogFresh();
    const fields = steppersByLabel(tree);
    expect(fields.width.props.value).toBe(1920);
    expect(fields.height.props.value).toBe(1080);
    expect(fields.width.props.disabled).toBe(true);
    expect(fields.height.props.disabled).toBe(true);
  });

  it('greyed fields track the selected preset live (amendment)', () => {
    let tree = openDialogFresh();

    (findPillByLabel(tree, 'HD Vertical')!.props as { onClick: () => void }).onClick();
    tree = renderDialog();
    let fields = steppersByLabel(tree);
    expect(fields.width.props.value).toBe(1080);
    expect(fields.height.props.value).toBe(1920);
    expect(fields.width.props.disabled).toBe(true);
    expect(fields.height.props.disabled).toBe(true);

    (findPillByLabel(tree, 'Square')!.props as { onClick: () => void }).onClick();
    tree = renderDialog();
    fields = steppersByLabel(tree);
    expect(fields.width.props.value).toBe(1080);
    expect(fields.height.props.value).toBe(1080);
    expect(fields.width.props.disabled).toBe(true);
    expect(fields.height.props.disabled).toBe(true);
  });

  it('Custom… enables the fields, seeded from the current preset dims (amendment)', () => {
    let tree = openDialogFresh();

    (findPillByLabel(tree, 'HD Vertical')!.props as { onClick: () => void }).onClick();
    tree = renderDialog();
    (findPillByLabel(tree, 'Custom…')!.props as { onClick: () => void }).onClick();
    tree = renderDialog();

    const fields = steppersByLabel(tree);
    expect(fields.width.props.disabled).toBe(false);
    expect(fields.height.props.disabled).toBe(false);
    expect(fields.width.props.value).toBe(1080);
    expect(fields.height.props.value).toBe(1920);
  });

  it('switching back to a preset discards the custom edits; re-entering Custom… re-seeds from that preset (amendment)', () => {
    let tree = openDialogFresh();

    // Enter Custom… from HD: seeded 1920×1080, then edit both fields.
    (findPillByLabel(tree, 'Custom…')!.props as { onClick: () => void }).onClick();
    tree = renderDialog();
    let fields = steppersByLabel(tree);
    expect(fields.width.props.value).toBe(1920);
    expect(fields.height.props.value).toBe(1080);
    (fields.width.props as { onChange: (v: number) => void }).onChange(1500);
    (fields.height.props as { onChange: (v: number) => void }).onChange(1600);

    tree = renderDialog();
    fields = steppersByLabel(tree);
    expect(fields.width.props.value).toBe(1500);
    expect(fields.height.props.value).toBe(1600);

    // Switch to Portrait: the fields grey out and show the preset dims.
    (findPillByLabel(tree, 'Portrait')!.props as { onClick: () => void }).onClick();
    tree = renderDialog();
    fields = steppersByLabel(tree);
    expect(fields.width.props.disabled).toBe(true);
    expect(fields.height.props.disabled).toBe(true);
    expect(fields.width.props.value).toBe(1080);
    expect(fields.height.props.value).toBe(1350);

    // Re-enter Custom…: re-seeded from Portrait, the 1500×1600 edits discarded.
    (findPillByLabel(tree, 'Custom…')!.props as { onClick: () => void }).onClick();
    tree = renderDialog();
    fields = steppersByLabel(tree);
    expect(fields.width.props.disabled).toBe(false);
    expect(fields.width.props.value).toBe(1080);
    expect(fields.height.props.value).toBe(1350);
  });

  it('Create with Custom… calls createProject with the clamped custom dims', async () => {
    let tree = renderDialog();

    // Pick the Custom… branch.
    const customPill = findPillByLabel(tree, 'Custom…');
    expect(customPill).toBeDefined();
    (customPill!.props as { onClick: () => void }).onClick();

    // Choose a folder so dirPath is set (drives the real handleCreate path).
    tree = renderDialog();
    const chooseButton = findAll(tree, (vnode) => {
      if (vnode.type !== 'button') return false;
      return textOf(vnode).includes('Choose...');
    })[0];
    expect(chooseButton).toBeDefined();
    await (chooseButton!.props as { onClick: () => Promise<void> }).onClick();

    // Drive the two steppers: width to 1500, height attempts 2200 but the
    // stepper's own clampToStep emits 1920 (T-260918-ovi-01).
    tree = renderDialog();
    // 260924-ffd: scope to the W×H steppers — the Frame Rate preset stepper
    // is a third NumericStepper now.
    const steppers = findAll(tree, (vnode) => vnode.type === NumericStepper).filter((s) =>
      /width|height/i.test(s.props.ariaLabel as string),
    );
    expect(steppers).toHaveLength(2);
    const widthStepper = steppers.find((s) => (s.props.ariaLabel as string).toLowerCase().includes('width'))!;
    const heightStepper = steppers.find((s) => (s.props.ariaLabel as string).toLowerCase().includes('height'))!;
    (widthStepper.props as { onChange: (v: number) => void }).onChange(1500);
    (heightStepper.props as { onChange: (v: number) => void }).onChange(1920);

    // Click Create.
    tree = renderDialog();
    const createButton = findAll(tree, (vnode) => {
      if (vnode.type !== 'button') return false;
      const label = textOf(vnode);
      return label === 'Create' || label === 'Creating...';
    })[0];
    expect(createButton).toBeDefined();
    await (createButton!.props as { onClick: () => Promise<void> }).onClick();

    expect(mockCreateProject).toHaveBeenCalledTimes(1);
    expect(mockCreateProject).toHaveBeenCalledWith('Untitled Project', 24, '/projects/Untitled Project.mce', 1500, 1920);
  });

  it('reopening the dialog resets the canvas format to the HD defaults (WR-01)', async () => {
    // First open: fire the mount effect, then pick HD Vertical.
    let tree = renderDialog();
    for (const effect of mountEffects.splice(0)) effect();
    const verticalPill = findPillByLabel(tree, 'HD Vertical');
    expect(verticalPill).toBeDefined();
    (verticalPill!.props as { onClick: () => void }).onClick();

    // Close + reopen: a fresh component invocation registers a fresh mount
    // effect; firing it must restore the HD defaults, symmetric with the
    // useState-backed name/fps/dirPath fields.
    tree = renderDialog();
    for (const effect of mountEffects.splice(0)) effect();

    // Choose a folder and Create — the project must be HD, not vertical.
    tree = renderDialog();
    const chooseButton = findAll(tree, (vnode) => {
      if (vnode.type !== 'button') return false;
      return textOf(vnode).includes('Choose...');
    })[0];
    expect(chooseButton).toBeDefined();
    await (chooseButton!.props as { onClick: () => Promise<void> }).onClick();

    tree = renderDialog();
    const createButton = findAll(tree, (vnode) => {
      if (vnode.type !== 'button') return false;
      const label = textOf(vnode);
      return label === 'Create' || label === 'Creating...';
    })[0];
    expect(createButton).toBeDefined();
    await (createButton!.props as { onClick: () => Promise<void> }).onClick();

    expect(mockCreateProject).toHaveBeenCalledTimes(1);
    expect(mockCreateProject).toHaveBeenCalledWith('Untitled Project', 24, '/projects/Untitled Project.mce', 1920, 1080);
  });
});
