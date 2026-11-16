// ============================================================
//  quick 261116-gcn — the floating Textures sheet.
//
//  Laws pinned here:
//    closed renders null; open seats the fifth step at 76px / z 54
//    a capture-phase press raises the sheet in the shared stack
//    the Size control is the SHARED brush Size in px (min 1 / max 512,
//    one mapping to the canonical — quick 261116-inu / Task 8)
//    a release commits exactly one size patch to the selection
//    the body keeps the FULL strip, below the Size row
//    only the front sheet consumes Escape; a close releases its seat
//    the header drag survives close/reopen for the session
//    quick 261116-inu: Delete/Backspace on the sheet or a chip opens
//    ONE confirmation; Confirm asks the bridge once, Cancel changes
//    nothing, and inert targets never open it
//    quick 261116-inu / Task 10: the Rotation row renders only from a
//    machine-library row, previews the gesture locally and sends ONE
//    integer-degrees set-rotation on release
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';

const mockTextureMutation = vi.hoisted(() => vi.fn());

vi.mock('preact/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('preact/hooks')>();
  return {
    ...actual,
    useRef: (initial: unknown) => ({ current: initial }),
    useEffect: () => {},
    useLayoutEffect: () => {},
    useState: (initial: unknown) => [
      typeof initial === 'function' ? (initial as () => unknown)() : initial,
      () => {},
    ],
  };
});

// Only the mutation request is replaced; the rest of the bridge (and the
// import request WatercolorBrushLibrary calls) stays real.
vi.mock('../../../lib/physicPaintBridge', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/physicPaintBridge')>();
  return { ...actual, requestPhysicPaintBrushTextureMutation: mockTextureMutation };
});

import {
  PhysicsPaintTextureModal,
  TextureRotationControl,
  TextureSizeControl,
  resetTextureDeleteState,
  resetTextureModalLayout,
  resetTextureRotationState,
} from './PhysicsPaintTextureModal';
import {
  SHEET_ID_BRUSHES,
  SHEET_ID_TEXTURES,
  bringSheetToFront,
  resetFloatingSheetStack,
  sheetZIndex,
} from './floatingSheetStack';
import {
  aquarellePaintCanonicalFromPx,
  aquarelleParams,
  aquarelleSelectedTextureId,
  aquarelleTextureModalOpen,
  recordAquarelleStroke,
  setAquarelleSelectedTextureId,
  setAquarelleTextureModalOpen,
} from './aquarelleRecordState';
import {
  libraryRowToTip,
  libraryRows,
  replaceLibraryEntries,
  resetAquarelleBrushCatalog,
} from '../../../stores/aquarelleBrushCatalog';
import { TIP_MASK_BYTES, registerMask, resetMaskRegistry } from '@efxlab/efx-watercolor';
import {
  setAquarelleSelectMode,
  setAquarelleSelectionEditPort,
} from './aquarelleStrokeSelection';
import { clearScriptStrokeSelection, setScriptStrokeSelection } from './scriptStrokeEdition';
import type { ScriptStrokeAppearancePatch } from './strokeSettingsModel';
import { WatercolorTextureImport } from './WatercolorBrushLibrary';

interface TestVNode {
  type: unknown;
  props: Record<string, unknown> & { children?: unknown };
}

function collect(node: unknown, out: TestVNode[] = []): TestVNode[] {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (Array.isArray(node)) {
    for (const child of node) collect(child, out);
    return out;
  }
  if (typeof node !== 'object') return out;
  const vnode = node as TestVNode;
  out.push(vnode);
  const children = vnode.props?.children;
  if (children !== undefined) collect(children, out);
  return out;
}

function findByTestId(tree: unknown, testId: string): TestVNode | undefined {
  return collect(tree).find((node) => node.props?.['data-testid'] === testId);
}

const MODAL_SOURCE = readFileSync(resolve(__dirname, 'PhysicsPaintTextureModal.tsx'), 'utf8');
const CSS_SOURCE = readFileSync(resolve(__dirname, '..', 'physicsPaintStudio.css'), 'utf8');

/** quick 261116-inu: one machine-library row for the delete surface. */
const TEXTURE_DIGEST = 'd'.repeat(64);
const TEXTURE_ENTRY = {
  id: `wc/custom-${TEXTURE_DIGEST.slice(0, 12)}`,
  name: 'fern.png',
  digest: TEXTURE_DIGEST,
  textureRotation: 0,
  createdAt: '2026-11-16T10:00:00Z',
  tip: 1,
  aspect: 1,
  rotation: 1,
  sizeCurve: 1,
  scatter: 1,
  capacity: 1,
  grain: 1,
  wetRound: 1,
};

function seedTextureRow(textureRotation = 0): void {
  replaceLibraryEntries([
    { tip: libraryRowToTip(TEXTURE_ENTRY), digest: TEXTURE_DIGEST, textureRotation },
  ]);
  registerMask(TEXTURE_ENTRY.id, new Uint8Array(TIP_MASK_BYTES));
}

/** The Rotation row's SliderStepper vnode, if the control renders at all. */
function rotationSlider(tree: unknown): TestVNode | undefined {
  return collect(tree).find((node) => node.props?.id === 'physics-texture-rotation');
}

/** The surface's own keydown prop, invoked with a DOM-like target. */
function fireSurfaceKey(
  tree: TestVNode,
  key: string,
  target: unknown,
): { preventDefault: ReturnType<typeof vi.fn>; stopPropagation: ReturnType<typeof vi.fn> } {
  const preventDefault = vi.fn();
  const stopPropagation = vi.fn();
  const handler = tree.props?.onKeyDown as ((event: unknown) => void) | undefined;
  handler?.({ key, target, preventDefault, stopPropagation });
  return { preventDefault, stopPropagation };
}

/** A texture-chip button target (passes the closest('.watercolor-texture-chip') gate). */
const CHIP_TARGET = { tagName: 'BUTTON', closest: () => ({}) };

/** Concatenated text of a vnode subtree. */
function textOf(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  const children = (node as TestVNode).props?.children;
  return children === undefined ? '' : textOf(children);
}

beforeEach(() => {
  aquarelleTextureModalOpen.value = false;
  resetTextureModalLayout();
  resetTextureDeleteState();
  resetTextureRotationState();
  resetAquarelleBrushCatalog();
  resetMaskRegistry();
  setAquarelleSelectedTextureId(null);
  mockTextureMutation.mockReset();
  mockTextureMutation.mockResolvedValue({
    operationId: 'op-test',
    ok: true,
    digest: TEXTURE_DIGEST,
  });
  setAquarelleSelectionEditPort(null);
  setAquarelleSelectMode(false);
  clearScriptStrokeSelection();
  // The stack order is module-global: a raise in one case would leak.
  resetFloatingSheetStack();
});

afterEach(() => {
  aquarelleTextureModalOpen.value = false;
  resetTextureModalLayout();
  resetTextureDeleteState();
  resetTextureRotationState();
  resetAquarelleBrushCatalog();
  resetMaskRegistry();
  setAquarelleSelectedTextureId(null);
  setAquarelleSelectionEditPort(null);
  setAquarelleSelectMode(false);
  clearScriptStrokeSelection();
  resetFloatingSheetStack();
});

describe('quick 261116-gcn Textures sheet', () => {
  it('renders null while closed and seats at 76px / z 54 when open', () => {
    expect(PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() })).toBeNull();

    setAquarelleTextureModalOpen(true);
    const tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect(tree.props?.['data-testid']).toBe('watercolor-texture-modal');
    expect(tree.props?.role).toBe('dialog');
    expect(String(tree.props?.['aria-label'])).toBe('Textures');
    const style = tree.props?.style as Record<string, unknown>;
    expect(style.top, 'the fifth 16px cascade step').toBe('76px');
    expect(style.height, 'the bottom inset stays 12px').toBe('min(480px, calc(100% - 88px))');
    expect(style.zIndex, 'the appended-last seat').toBe(54);
    expect(style.zIndex).toBe(sheetZIndex(SHEET_ID_TEXTURES));
    expect(findByTestId(tree, 'watercolor-texture-modal-header'), 'the header renders').toBeDefined();
    expect(findByTestId(tree, 'watercolor-texture-modal-close'), 'the close chrome renders').toBeDefined();
    expect(findByTestId(tree, 'watercolor-texture-modal-resize'), 'the resize handle renders').toBeDefined();
  });

  it('raises on a capture-phase press and drops one level behind a raised brush catalog', () => {
    expect(sheetZIndex(SHEET_ID_TEXTURES)).toBe(54);
    bringSheetToFront(SHEET_ID_BRUSHES);
    setAquarelleTextureModalOpen(true);
    let tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect((tree.props?.style as Record<string, unknown>).zIndex).toBe(53);
    expect(
      tree.props?.onPointerDownCapture,
      'the root raises itself on capture-phase pointerdown',
    ).toBeTypeOf('function');
    (tree.props?.onPointerDownCapture as () => void)();
    tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect((tree.props?.style as Record<string, unknown>).zIndex).toBe(54);
    // Raising the brush catalog again pushes textures back one level.
    bringSheetToFront(SHEET_ID_BRUSHES);
    tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect((tree.props?.style as Record<string, unknown>).zIndex).toBe(53);
  });

  it('seats the shared brush Size control with the live value and a pass-through handler', () => {
    const previousParams = aquarelleParams.value;
    aquarelleParams.value = { ...previousParams, size: 42 };
    try {
      const onBrushSizeChange = vi.fn();
      const control = TextureSizeControl({ onBrushSizeChange }) as TestVNode;
      expect(control.props?.['data-testid']).toBe('watercolor-texture-modal-size');
      expect(String(control.props?.class)).toBe('physics-paint-texture-size');
      const slider = collect(control).find((node) => node.props?.id === 'physics-texture-size');
      expect(slider, 'the Size row renders a SliderStepper').toBeTruthy();
      // quick 261116-inu / Task 8: px range, and the displayed value is the
      // DERIVED footprint — the default filbert response at canonical 42
      // paints 186.624 px on a 1080-high sheet.
      expect(slider!.props?.min).toBe(1);
      expect(slider!.props?.max).toBe(512);
      expect(slider!.props?.step).toBe(1);
      expect(slider!.props?.label).toBe('Brush size');
      expect(slider!.props?.ariaLabel).toBe('Brush size — textures');
      expect(slider!.props?.value, 'the derived px of the live canonical').toBeCloseTo(186.624, 3);
      expect(slider!.props?.disabled).toBeFalsy();

      (slider!.props?.onChange as (value: number) => void)(37);
      expect(onBrushSizeChange, 'the continuous path forwards the top-bar handler').toHaveBeenCalledWith(
        aquarellePaintCanonicalFromPx(37),
      );
      expect(aquarelleParams.value.size, 'the control never writes the live signal').toBe(42);

      const disabledSlider = collect(TextureSizeControl({ onBrushSizeChange, disabled: true })).find(
        (node) => node.props?.id === 'physics-texture-size',
      );
      expect(disabledSlider!.props?.disabled, 'the bar lock reaches the Size row').toBe(true);
    } finally {
      aquarelleParams.value = previousParams;
    }
  });

  it('commits exactly one size patch per release to the selected paint strokes', () => {
    recordAquarelleStroke(10801, stroke10801([point10801(0.2, 0.5)]));
    const calls: Array<{ ids: readonly number[]; patch: ScriptStrokeAppearancePatch }> = [];
    const promise = Promise.resolve(true);
    setAquarelleSelectionEditPort({
      applyAppearance: (ids, patch) => {
        calls.push({ ids, patch });
        return promise;
      },
    });
    setAquarelleSelectMode(true);
    setScriptStrokeSelection([10801]);

    const slider = collect(TextureSizeControl({ onBrushSizeChange: vi.fn() })).find(
      (node) => node.props?.id === 'physics-texture-size',
    );
    expect(typeof slider!.props?.onCommit, 'the release boundary is wired').toBe('function');
    // A live drag never commits: the port is silent until a release.
    expect(calls).toHaveLength(0);
    (slider!.props?.onCommit as (value: number) => void)(37);
    expect(calls, 'one patch per release').toHaveLength(1);
    // quick 261116-inu / Task 8: the release carries px; the patch carries the
    // canonical produced by the ONE mapping.
    expect(calls[0]!.patch).toEqual({ params: { size: aquarellePaintCanonicalFromPx(37) } });
    expect(calls[0]!.ids).toEqual([10801]);
  });

  it('the header drag moves the surface and the close chrome closes it', () => {
    setAquarelleTextureModalOpen(true);
    const tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    const header = findByTestId(tree, 'watercolor-texture-modal-header')!;
    const onPointerDown = header.props?.onPointerDown as ((event: unknown) => void);
    const onPointerMove = header.props?.onPointerMove as ((event: unknown) => void);
    onPointerDown({
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      preventDefault: vi.fn(),
      currentTarget: { setPointerCapture: vi.fn() },
    });
    onPointerMove({ clientX: 130, clientY: 120 });
    const moved = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect(String((moved.props?.style as Record<string, unknown>)?.transform)).toBe(
      'translate(30px, 20px)',
    );

    const close = findByTestId(moved, 'watercolor-texture-modal-close')!;
    (close.props?.onClick as () => void)();
    expect(aquarelleTextureModalOpen.value).toBe(false);
  });

  it('mounts the shared import control above the strip under its own testid prefix', () => {
    setAquarelleTextureModalOpen(true);
    const tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    const mounted = collect(tree).find((node) => node.type === WatercolorTextureImport);
    expect(mounted, 'the sheet mounts the catalogue import control').toBeTruthy();
    expect(
      (mounted!.props as Record<string, unknown>)['testIdPrefix'],
      'the sheet never reuses the catalogue testids',
    ).toBe('watercolor-texture-import');

    const stripAt = MODAL_SOURCE.indexOf('<WatercolorTextureStrip />');
    const importAt = MODAL_SOURCE.indexOf(
      '<WatercolorTextureImport testIdPrefix="watercolor-texture-import" />',
    );
    expect(importAt, 'the import control renders').toBeGreaterThan(-1);
    expect(importAt, 'the import control leads the strip').toBeLessThan(stripAt);
    expect(stripAt, 'the strip still renders').toBeGreaterThan(-1);

    // The control itself: ONE button and ONE hidden PNG/JPEG input, sharing the
    // catalogue's single decode/register path.
    const control = WatercolorTextureImport({
      testIdPrefix: 'watercolor-texture-import',
    }) as TestVNode;
    const nodes = collect(control);
    const button = nodes.find(
      (node) => node.props?.['data-testid'] === 'watercolor-texture-import',
    );
    expect(button?.type, 'a real button').toBe('button');
    expect(button!.props?.['disabled'], 'idle control is enabled').toBe(false);
    const inputs = nodes.filter((node) => node.type === 'input');
    expect(inputs.length, 'exactly one file input').toBe(1);
    expect(inputs[0]!.props?.['accept'], 'PNG + JPEG only').toBe('image/png,image/jpeg');
    expect(inputs[0]!.props?.['style'], 'input stays hidden').toMatchObject({
      display: 'none',
    });
  });

  it('pins the sheet-only 72px chips and the widened name', () => {
    const canvasAt = CSS_SOURCE.indexOf(
      '.physics-paint-texture-modal .watercolor-texture-chip-canvas {',
    );
    expect(canvasAt, 'the sheet chip rule exists').toBeGreaterThan(-1);
    const canvasRule = CSS_SOURCE.slice(canvasAt, CSS_SOURCE.indexOf('}', canvasAt));
    expect(canvasRule, 'larger than the 44px catalogue chip').toContain('width: 72px');
    expect(canvasRule).toContain('height: 72px');

    const nameAt = CSS_SOURCE.indexOf(
      '.physics-paint-texture-modal .watercolor-texture-chip-name {',
    );
    expect(nameAt, 'the sheet name rule exists').toBeGreaterThan(-1);
    const nameRule = CSS_SOURCE.slice(nameAt, CSS_SOURCE.indexOf('}', nameAt));
    expect(nameRule, 'the name widens with the chip').toContain('max-width: 80px');

    // The catalogue keeps its shipped 44px base rule untouched.
    const baseAt = CSS_SOURCE.indexOf('\n.watercolor-texture-chip-canvas {');
    expect(baseAt, 'the base chip rule exists').toBeGreaterThan(-1);
    const baseRule = CSS_SOURCE.slice(baseAt, CSS_SOURCE.indexOf('}', baseAt));
    expect(baseRule, 'the catalogue chip stays 44px').toContain('width: 44px');
  });

  it('source pins the full strip, the Size-before-strip order and the front-only Escape law', () => {
    expect(MODAL_SOURCE).toContain('<WatercolorTextureStrip />');
    expect(MODAL_SOURCE, 'the sheet carries the FULL strip, never the compact one').not.toContain(
      '<WatercolorTextureStrip compact',
    );
    const sizeAt = MODAL_SOURCE.indexOf('<TextureSizeControl');
    const stripAt = MODAL_SOURCE.indexOf('<WatercolorTextureStrip />');
    expect(sizeAt, 'the Size row renders').toBeGreaterThan(-1);
    expect(stripAt, 'the strip renders').toBeGreaterThan(sizeAt);
    expect(MODAL_SOURCE).toContain('closeSheetIfFront(SHEET_ID_TEXTURES');
    expect(MODAL_SOURCE).toContain('event.stopImmediatePropagation();');
    expect(MODAL_SOURCE).toContain('releaseSheet(SHEET_ID_TEXTURES);');
    // quick 261116-inu / Task 8: the release commits the canonical produced by
    // the ONE px mapping, never the raw px.
    expect(MODAL_SOURCE).toContain(
      "commitAquarelleSelectionParam('size', aquarellePaintCanonicalFromPx(value))",
    );
    expect(MODAL_SOURCE).not.toContain('useState');
  });
});

describe('quick 261116-inu texture delete on the Textures surface', () => {
  it('Delete on a chip opens ONE confirmation naming the consequence — no request yet', () => {
    seedTextureRow();
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    setAquarelleTextureModalOpen(true);
    const tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect(tree.props?.tabIndex, 'the sheet container is focusable').toBe(-1);
    expect(tree.props?.onKeyDown, 'the container owns the gesture').toBeTypeOf('function');

    const { preventDefault, stopPropagation } = fireSurfaceKey(tree, 'Delete', CHIP_TARGET);
    expect(preventDefault, 'the key never performs its default action').toHaveBeenCalled();
    expect(stopPropagation, 'the gesture stays inside the surface').toHaveBeenCalled();
    expect(mockTextureMutation, 'nothing is asked before confirmation').not.toHaveBeenCalled();

    const next = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    const confirm = findByTestId(next, 'watercolor-texture-delete-confirm');
    expect(confirm, 'one confirmation dialog').toBeTruthy();
    expect(confirm!.props?.role).toBe('alertdialog');
    const copy = collect(confirm).find(
      (node) => String(node.props?.class ?? '') === 'physics-paint-texture-modal-confirm-copy',
    );
    const text = textOf(copy);
    expect(text).toContain('fern.png');
    expect(text, 'the copy names the machine-wide consequence').toContain('from this machine');
    expect(text).toContain('fall back to the response tip');
  });

  it('Backspace opens the same confirmation and Cancel is a no-op', () => {
    seedTextureRow();
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    setAquarelleTextureModalOpen(true);
    let tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    fireSurfaceKey(tree, 'Backspace', CHIP_TARGET);
    tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect(findByTestId(tree, 'watercolor-texture-delete-confirm')).toBeTruthy();

    const cancel = findByTestId(tree, 'watercolor-texture-delete-cancel')!;
    (cancel.props?.onClick as () => void)();

    expect(mockTextureMutation, 'cancel never asks the bridge').not.toHaveBeenCalled();
    expect(aquarelleSelectedTextureId.value, 'cancel changes no selection').toBe(TEXTURE_ENTRY.id);
    const closed = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect(findByTestId(closed, 'watercolor-texture-delete-confirm')).toBeUndefined();
  });

  it('Confirm asks once and resets the deleted selection to Default', async () => {
    seedTextureRow();
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    setAquarelleTextureModalOpen(true);
    let tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    fireSurfaceKey(tree, 'Delete', CHIP_TARGET);
    tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    const confirmButton = findByTestId(tree, 'watercolor-texture-delete-confirm-button')!;
    (confirmButton.props?.onClick as () => void)();

    await vi.waitFor(() => {
      expect(mockTextureMutation).toHaveBeenCalledTimes(1);
    });
    expect(mockTextureMutation).toHaveBeenCalledWith({
      operation: 'delete',
      digest: TEXTURE_DIGEST,
    });
    await vi.waitFor(() => {
      expect(aquarelleSelectedTextureId.value, 'the dangling selection falls back to Default').toBeNull();
    });

    const settled = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect(findByTestId(settled, 'watercolor-texture-delete-confirm')).toBeUndefined();
  });

  it('a refused delete leaves the selection and the dialog settles closed', async () => {
    seedTextureRow();
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    setAquarelleTextureModalOpen(true);
    mockTextureMutation.mockResolvedValue({
      operationId: 'op-test',
      ok: false,
      digest: TEXTURE_DIGEST,
      reason: 'mutation-failed',
    });
    let tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    fireSurfaceKey(tree, 'Delete', CHIP_TARGET);
    tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    (findByTestId(tree, 'watercolor-texture-delete-confirm-button')!.props?.onClick as () => void)();

    await vi.waitFor(() => {
      expect(mockTextureMutation).toHaveBeenCalledTimes(1);
    });
    // Let the request settle before asserting the post-settle state.
    await vi.waitFor(() => {
      const settled = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
      expect(findByTestId(settled, 'watercolor-texture-delete-confirm')).toBeUndefined();
    });
    expect(aquarelleSelectedTextureId.value, 'a failed delete never clears the selection').toBe(
      TEXTURE_ENTRY.id,
    );
  });

  it('is inert outside the surface, on text fields, on other keys and on the Default chip', () => {
    seedTextureRow();
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    setAquarelleTextureModalOpen(true);
    const tree = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;

    // A target outside the sheet/chips (the window, another sheet's node).
    const outside = fireSurfaceKey(tree, 'Delete', { tagName: 'DIV', closest: () => null });
    expect(outside.preventDefault).not.toHaveBeenCalled();
    // The Size row's free-entry input owns Delete/Backspace.
    const input = fireSurfaceKey(tree, 'Delete', { tagName: 'INPUT', closest: () => ({}) });
    expect(input.preventDefault).not.toHaveBeenCalled();
    // Other keys are not this gesture.
    fireSurfaceKey(tree, 'a', CHIP_TARGET);
    expect(
      findByTestId(PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }), 'watercolor-texture-delete-confirm'),
      'no dialog from an inert gesture',
    ).toBeUndefined();

    // The Default chip is no deletion subject.
    setAquarelleSelectedTextureId(null);
    fireSurfaceKey(tree, 'Delete', CHIP_TARGET);
    expect(
      findByTestId(PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }), 'watercolor-texture-delete-confirm'),
    ).toBeUndefined();
    expect(mockTextureMutation).not.toHaveBeenCalled();
  });

  it('source and CSS pin the container-scoped handler, sentence case and the focus ring', () => {
    expect(MODAL_SOURCE).toContain('tabIndex={-1}');
    expect(MODAL_SOURCE).toContain('onKeyDown={onSurfaceKeyDown}');
    expect(MODAL_SOURCE).toContain('requestPhysicPaintBrushTextureMutation({');
    expect(MODAL_SOURCE, 'the Escape law clears a pending confirmation first').toContain(
      'pendingTextureDelete.value !== null',
    );
    expect(MODAL_SOURCE, 'a close clears the confirmation').toContain('resetTextureDeleteState();');
    expect(MODAL_SOURCE, 'never the global paint shortcut dispatcher').not.toContain('shortcuts');
    expect(
      MODAL_SOURCE,
      'Delete/Backspace is never attached to window — the only window keydown is the front-sheet Escape law',
    ).not.toContain('window.addEventListener(\'keydown\', onSurfaceKeyDown');

    const confirmAt = CSS_SOURCE.indexOf('\n.physics-paint-texture-modal-confirm {');
    expect(confirmAt, 'the confirmation rule exists').toBeGreaterThan(-1);
    const focusAt = CSS_SOURCE.indexOf('\n.physics-paint-texture-modal:focus-visible {');
    expect(focusAt, 'the container focus ring exists').toBeGreaterThan(-1);
    const focusRule = CSS_SOURCE.slice(focusAt, CSS_SOURCE.indexOf('}', focusAt));
    expect(focusRule).toContain('outline: 2px solid var(--color-accent');
    const buttonAt = CSS_SOURCE.indexOf('\n.physics-paint-texture-modal-confirm-button {');
    expect(buttonAt, 'the action button rule exists').toBeGreaterThan(-1);
    const buttonRule = CSS_SOURCE.slice(buttonAt, CSS_SOURCE.indexOf('}', buttonAt));
    expect(buttonRule, 'sentence-case copy, never the global uppercase').toContain(
      'text-transform: none',
    );
  });
});

describe('quick 261116-inu texture rotation on the Textures surface', () => {
  it('renders only from a machine-library row — absent for Default and an external tip', () => {
    // Default: no texture selected, nothing persisted to rotate.
    expect(TextureRotationControl({}), 'the Default chip has no rotation row').toBeNull();

    seedTextureRow();
    setAquarelleSelectedTextureId('wc/custom-external-unknown');
    expect(
      TextureRotationControl({}),
      'a script-registered id with no library row has no rotation row',
    ).toBeNull();

    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    const control = TextureRotationControl({}) as TestVNode;
    expect(control.props?.['data-testid']).toBe('watercolor-texture-modal-rotation');
    expect(String(control.props?.class)).toBe('physics-paint-texture-rotation');
  });

  it('shows the row’s committed integer degrees with the degrees range', () => {
    seedTextureRow(-120);
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    setAquarelleTextureModalOpen(true);
    // The open sheet seats the row from the same library row.
    const sheet = PhysicsPaintTextureModal({ onBrushSizeChange: vi.fn() }) as TestVNode;
    expect(
      collect(sheet).find((node) => node.type === TextureRotationControl),
      'the open sheet mounts the Rotation row',
    ).toBeTruthy();

    const slider = rotationSlider(TextureRotationControl({}))!;
    expect(slider.props?.label).toBe('Rotation');
    expect(slider.props?.ariaLabel).toBe('Rotation — textures');
    expect(slider.props?.value, 'the committed row value, never hundredths').toBe(-120);
    expect(slider.props?.min).toBe(-180);
    expect(slider.props?.max).toBe(180);
    expect(slider.props?.step).toBe(1);
    expect(slider.props?.disabled).toBeFalsy();
  });

  it('a gesture previews locally and never asks the bridge before the release', () => {
    seedTextureRow(0);
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    const slider = rotationSlider(TextureRotationControl({}))!;
    (slider.props?.onChange as (value: number) => void)(45);

    expect(mockTextureMutation, 'no request from a live drag').not.toHaveBeenCalled();
    expect(rotationSlider(TextureRotationControl({}))!.props?.value, 'the preview drives the row').toBe(45);
    expect(libraryRows.value[0]!.textureRotation, 'the child never writes the catalog row').toBe(0);
  });

  it('a release sends exactly one integer-degrees set-rotation and spends the preview', async () => {
    seedTextureRow(0);
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    const slider = rotationSlider(TextureRotationControl({}))!;
    (slider.props?.onChange as (value: number) => void)(45);
    (slider.props?.onCommit as (value: number) => void)(45);

    await vi.waitFor(() => {
      expect(mockTextureMutation).toHaveBeenCalledTimes(1);
    });
    expect(mockTextureMutation).toHaveBeenCalledWith({
      operation: 'set-rotation',
      digest: TEXTURE_DIGEST,
      textureRotation: 45,
    });
    await vi.waitFor(() => {
      expect(
        rotationSlider(TextureRotationControl({}))!.props?.value,
        'the gesture ended: the row value owns the display again',
      ).toBe(0);
    });
  });

  it('a release landing on the committed value asks for nothing', () => {
    seedTextureRow(37);
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    const slider = rotationSlider(TextureRotationControl({}))!;
    (slider.props?.onChange as (value: number) => void)(37);
    (slider.props?.onCommit as (value: number) => void)(37);

    expect(mockTextureMutation).not.toHaveBeenCalled();
    expect(rotationSlider(TextureRotationControl({}))!.props?.value).toBe(37);
  });

  it('is disabled while the bar lock is on or a request is in flight', async () => {
    seedTextureRow(0);
    setAquarelleSelectedTextureId(TEXTURE_ENTRY.id);
    expect(
      rotationSlider(TextureRotationControl({ disabled: true }))!.props?.disabled,
      'the bar lock reaches the Rotation row',
    ).toBe(true);

    let resolveRequest: (value: unknown) => void = () => {};
    mockTextureMutation.mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve; }),
    );
    const slider = rotationSlider(TextureRotationControl({}))!;
    (slider.props?.onCommit as (value: number) => void)(45);
    await vi.waitFor(() => {
      expect(
        rotationSlider(TextureRotationControl({}))!.props?.disabled,
        'one request at a time',
      ).toBe(true);
    });

    resolveRequest({ operationId: 'op-test', ok: true, digest: TEXTURE_DIGEST });
    await vi.waitFor(() => {
      expect(rotationSlider(TextureRotationControl({}))!.props?.disabled).toBeFalsy();
    });
  });

  it('source and CSS pin the Size-before-Rotation-before-strip order and the child law', () => {
    const sizeAt = MODAL_SOURCE.indexOf('<TextureSizeControl');
    const rotationAt = MODAL_SOURCE.indexOf('<TextureRotationControl');
    const stripAt = MODAL_SOURCE.indexOf('<WatercolorTextureStrip />');
    expect(rotationAt, 'the Rotation row renders').toBeGreaterThan(-1);
    expect(rotationAt, 'directly below Brush size').toBeGreaterThan(sizeAt);
    expect(rotationAt, 'above the texture strip').toBeLessThan(stripAt);
    expect(MODAL_SOURCE, 'a close and a re-open reset the preview').toContain(
      'resetTextureRotationState();',
    );
    expect(
      MODAL_SOURCE,
      'the child requests the mutation; it never calls the main-realm library function',
    ).not.toContain('setBrushTextureRotation');

    const ruleAt = CSS_SOURCE.indexOf('\n.physics-paint-texture-rotation {');
    expect(ruleAt, 'the Rotation row rule exists').toBeGreaterThan(-1);
    const rule = CSS_SOURCE.slice(ruleAt, CSS_SOURCE.indexOf('}', ruleAt));
    expect(rule).toContain('padding: 0 2px 10px');
  });
});

function point10801(x: number, y: number): AquarellePoint {
  return { x, y, p: 1, tx: 0, ty: 0, tw: 0 };
}

function stroke10801(points: readonly AquarellePoint[]): AquarelleStroke {
  return {
    tool: 'brush',
    color: '#103c65',
    params: { size: 12 },
    brushId: 'round',
    points,
    timestamp: 0,
    playFrame: 801,
  };
}
