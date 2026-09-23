import { describe, expect, it } from 'vitest';
import { PhysicsPaintStudioView, type PhysicsPaintStudioViewProps } from './PhysicsPaintStudioView';
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
 * open, NO parent modal (PlayScript, photo reference, script picker) is in the
 * returned vnode tree; when the picker closes, every parent that was open is
 * back (their opener booleans are never cleared at this seam).
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
  /** Script-picker (Create Rail) dialog open. */
  scriptPickerOpen?: boolean;
  /** PlayScript dialog prop present (confirmation surface). */
  playScriptPresent?: boolean;
  /** Background gallery picker open. */
  backgroundPickerOpen?: boolean;
  /** Reference gallery picker open. */
  referencePickerOpen?: boolean;
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
    referenceDialog: fixture.referenceDialog
      ? {
          open: true,
          layerId: 'layer-1',
          onClose: () => {},
          onImportSource: () => {},
        }
      : null,
    scriptPickerDialog: fixture.scriptPickerOpen
      ? {
          open: true,
          intent: null,
          rows: [],
          selectedId: null,
          blockedReason: null,
          onPick: () => {},
          onClose: () => {},
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
  };
  return PhysicsPaintStudioView(props as unknown as PhysicsPaintStudioViewProps);
}

function expectNoParentModals(tree: unknown): void {
  expect(countOfType(tree, PhysicsPaintPhotoReferenceDialog)).toBe(0);
  expect(countOfType(tree, PhysicsPaintScriptPickerDialog)).toBe(0);
  expect(countOfType(tree, MemoizedPhysicsPaintPlayScriptDialog)).toBe(0);
}

function expectAllParentModals(tree: unknown): void {
  expect(countOfType(tree, PhysicsPaintPhotoReferenceDialog)).toBe(1);
  expect(countOfType(tree, PhysicsPaintScriptPickerDialog)).toBe(1);
  expect(countOfType(tree, MemoizedPhysicsPaintPlayScriptDialog)).toBe(1);
}

describe('PhysicsPaintStudioView picker-open visibility gate (260923-fhn)', () => {
  it('hides every parent modal while the background gallery picker is open', () => {
    const tree = renderView({
      referenceDialog: true,
      scriptPickerOpen: true,
      playScriptPresent: true,
      backgroundPickerOpen: true,
    });
    expectNoParentModals(tree);
    // The picker overlay itself must stay visible.
    expect(countOfType(tree, BackgroundAssetPickerView)).toBe(1);
  });

  it('hides every parent modal while the reference gallery picker is open (Reveal nesting path)', () => {
    const tree = renderView({
      referenceDialog: true,
      scriptPickerOpen: true,
      playScriptPresent: true,
      referencePickerOpen: true,
    });
    expectNoParentModals(tree);
    expect(countOfType(tree, BackgroundAssetPickerView)).toBe(1);
  });

  it('restores every parent modal when no picker is open', () => {
    const tree = renderView({
      referenceDialog: true,
      scriptPickerOpen: true,
      playScriptPresent: true,
      backgroundPickerOpen: false,
      referencePickerOpen: false,
    });
    expectAllParentModals(tree);
    expect(countOfType(tree, BackgroundAssetPickerView)).toBe(0);
  });

  it('hides every parent modal when BOTH gallery pickers are open at once', () => {
    const tree = renderView({
      referenceDialog: true,
      scriptPickerOpen: true,
      playScriptPresent: true,
      backgroundPickerOpen: true,
      referencePickerOpen: true,
    });
    expectNoParentModals(tree);
    expect(countOfType(tree, BackgroundAssetPickerView)).toBe(2);
  });
});
