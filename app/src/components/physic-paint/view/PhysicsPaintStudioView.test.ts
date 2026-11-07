import { describe, expect, it } from 'vitest';
import { signal } from '@preact/signals';
import { PhysicsPaintStudioView, type PhysicsPaintStudioViewProps } from './PhysicsPaintStudioView';
import { PhysicsPaintSettingsModal } from './PhysicsPaintSettingsModal';
import { PhysicsPaintRailMotionModal } from './PhysicsPaintRailMotionModal';
import type { RailMotionDialogBundle } from './physicsPaintKeyRailPresentation';
import { MemoizedPhysicsPaintPlayScriptDialog } from './MemoizedPhysicsPaintPlayScriptDialog';
import { PhysicsPaintPhotoReferenceDialog } from './PhysicsPaintPhotoReferenceDialog';
import { PhysicsPaintScriptPickerDialog } from './PhysicsPaintScriptPickerDialog';
import { BackgroundAssetPickerView } from './BackgroundAssetPickerView';

/**
 * 260923-fhn (Quick 4): visibility orchestration pin at the view seam.
 *
 * The gallery pickers (background / reference) render as an absolute z-20
 * overlay INSIDE the canvas region while the parent modals are fixed z-70/72 —
 * stacked they fight for space. Contract pinned here: while EITHER picker is
 * open, NO parent modal (PlayScript, photo reference) is in the
 * returned vnode tree; when the picker closes, every parent that was open is
 * back (their opener booleans are never cleared at this seam).
 *
 * 261029-hy2: the floating Settings sheet rides the same step-aside gate — the
 * pin is on its MOUNT vnode (the sheet self-hides on its own open signal).
 *
 * Node harness: PhysicsPaintStudioView's body has no hooks, so it is invoked
 * as a plain function and the returned vnode tree is walked with the
 * PhysicsPaintPlayScriptDialog.test.ts idiom. Children are never invoked —
 * presence is asserted by vnode type identity.
 */

interface TestVNode {
  type?: unknown;
  props?: Record<string, unknown> | null;
}

interface ViewFixture {
  /** Parent photo-reference dialog prop object present (Studio had it open). */
  referenceDialog?: boolean;
  /** PlayScript dialog prop present (confirmation surface). */
  playScriptPresent?: boolean;
  /** 261022-o2a: Tools script picker prop present (Studio had it open). */
  scriptPickerPresent?: boolean;
  /** Background gallery picker open. */
  backgroundPickerOpen?: boolean;
  /** Reference gallery picker open. */
  referencePickerOpen?: boolean;
  /** 261107-qgj: the Motion dialog bundle signal (values irrelevant here). */
  railMotionDialogPresent?: boolean;
}

function childrenOf(vnode: TestVNode): unknown[] {
  const children = vnode.props?.children;
  if (children === null || children === undefined || typeof children === 'boolean') return [];
  return Array.isArray(children) ? children : [children];
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

function countOfType(root: unknown, type: unknown): number {
  return findAll(root, (vnode) => vnode.type === type).length;
}

function renderView(fixture: ViewFixture): unknown {
  const props: Record<string, unknown> = {
    layout: {
      rightPanelCollapsed: false,
      onKeyDown: () => {},
      onSetRightPanelCollapsed: () => {},
    },
    topBar: {},
    toolRail: {},
    canvas: {},
    rightPanel: {},
    workflow: {},
    status: { shortcutsVisible: false },
    // Parents are only "open" when their prop object/flag is present.
    playScriptDialog: fixture.playScriptPresent ? {} : undefined,
    scriptPickerDialog: fixture.scriptPickerPresent
      ? {
          open: true,
          intent: 'create-rail',
          library: {},
          onPick: () => {},
          onClose: () => {},
        }
      : null,
    referenceDialog: fixture.referenceDialog
      ? {
          open: true,
          layerId: 'layer-1',
          onClose: () => {},
          onImportSource: () => {},
        }
      : null,
    backgroundPicker: fixture.backgroundPickerOpen
      ? {
          open: true,
          title: 'Import background images',
        }
      : null,
    referencePicker: fixture.referencePickerOpen
      ? {
          open: true,
          title: 'Import reference images',
        }
      : null,
    // 261107-qgj: the Studio passes the hook's signal by reference; the modal
    // self-hides on its own value. The seam pin is the MOUNT vnode.
    railMotionDialog: fixture.railMotionDialogPresent
      ? signal<RailMotionDialogBundle | null>(null)
      : null,
    onCloseRailMotionDialog: () => {},
  };
  return PhysicsPaintStudioView(props as unknown as PhysicsPaintStudioViewProps);
}

function expectNoParentModals(tree: unknown): void {
  expect(countOfType(tree, PhysicsPaintPhotoReferenceDialog)).toBe(0);
  expect(countOfType(tree, MemoizedPhysicsPaintPlayScriptDialog)).toBe(0);
  expect(countOfType(tree, PhysicsPaintScriptPickerDialog)).toBe(0);
  expect(countOfType(tree, PhysicsPaintSettingsModal)).toBe(0);
  expect(countOfType(tree, PhysicsPaintRailMotionModal)).toBe(0);
}

function expectAllParentModals(tree: unknown): void {
  expect(countOfType(tree, PhysicsPaintPhotoReferenceDialog)).toBe(1);
  expect(countOfType(tree, MemoizedPhysicsPaintPlayScriptDialog)).toBe(1);
  expect(countOfType(tree, PhysicsPaintScriptPickerDialog)).toBe(1);
  expect(countOfType(tree, PhysicsPaintSettingsModal)).toBe(1);
  expect(countOfType(tree, PhysicsPaintRailMotionModal)).toBe(1);
}

describe('PhysicsPaintStudioView picker-open visibility gate (260923-fhn)', () => {
  it('hides every parent modal while the background gallery picker is open', () => {
    const tree = renderView({
      referenceDialog: true,
      playScriptPresent: true,
      scriptPickerPresent: true,
      backgroundPickerOpen: true,
    });
    expectNoParentModals(tree);
    // The picker overlay itself must stay visible.
    expect(countOfType(tree, BackgroundAssetPickerView)).toBe(1);
  });

  it('hides every parent modal while the reference gallery picker is open (Reveal nesting path)', () => {
    const tree = renderView({
      referenceDialog: true,
      playScriptPresent: true,
      scriptPickerPresent: true,
      referencePickerOpen: true,
    });
    expectNoParentModals(tree);
    expect(countOfType(tree, BackgroundAssetPickerView)).toBe(1);
  });

  it('restores every parent modal when no picker is open', () => {
    const tree = renderView({
      referenceDialog: true,
      playScriptPresent: true,
      scriptPickerPresent: true,
      backgroundPickerOpen: false,
      referencePickerOpen: false,
    });
    expectAllParentModals(tree);
    expect(countOfType(tree, BackgroundAssetPickerView)).toBe(0);
  });

  it('hides every parent modal when BOTH gallery pickers are open at once', () => {
    const tree = renderView({
      referenceDialog: true,
      playScriptPresent: true,
      scriptPickerPresent: true,
      backgroundPickerOpen: true,
      referencePickerOpen: true,
    });
    expectNoParentModals(tree);
    expect(countOfType(tree, BackgroundAssetPickerView)).toBe(2);
  });

  it('mounts the Motion modal beside its sibling sheets and steps it aside for a picker (261107-qgj)', () => {
    const open = renderView({ railMotionDialogPresent: true });
    const mount = findAll(open, (vnode) => vnode.type === PhysicsPaintRailMotionModal);
    expect(mount).toHaveLength(1);
    // The Signal is forwarded by reference — this view never reads its value.
    expect((mount[0].props as Record<string, unknown>)?.dialog).not.toBeNull();
    expect((mount[0].props as Record<string, unknown>)?.onClose).toBeTypeOf('function');

    const aside = renderView({ railMotionDialogPresent: true, backgroundPickerOpen: true });
    expect(countOfType(aside, PhysicsPaintRailMotionModal)).toBe(0);
  });
});
