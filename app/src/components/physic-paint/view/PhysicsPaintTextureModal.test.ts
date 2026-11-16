// ============================================================
//  quick 261116-gcn — the floating Textures sheet.
//
//  Laws pinned here:
//    closed renders null; open seats the fifth step at 76px / z 54
//    a capture-phase press raises the sheet in the shared stack
//    the Size control is the SHARED brush Size (min 1 / max 80)
//    a release commits exactly one size patch to the selection
//    the body keeps the FULL strip, below the Size row
//    only the front sheet consumes Escape; a close releases its seat
//    the header drag survives close/reopen for the session
// ============================================================

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AquarellePoint, AquarelleStroke } from '@efxlab/efx-watercolor/payload';

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

import {
  PhysicsPaintTextureModal,
  TextureSizeControl,
  resetTextureModalLayout,
} from './PhysicsPaintTextureModal';
import {
  SHEET_ID_BRUSHES,
  SHEET_ID_TEXTURES,
  bringSheetToFront,
  resetFloatingSheetStack,
  sheetZIndex,
} from './floatingSheetStack';
import {
  aquarelleParams,
  aquarelleTextureModalOpen,
  recordAquarelleStroke,
  setAquarelleTextureModalOpen,
} from './aquarelleRecordState';
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

beforeEach(() => {
  aquarelleTextureModalOpen.value = false;
  resetTextureModalLayout();
  setAquarelleSelectionEditPort(null);
  setAquarelleSelectMode(false);
  clearScriptStrokeSelection();
  // The stack order is module-global: a raise in one case would leak.
  resetFloatingSheetStack();
});

afterEach(() => {
  aquarelleTextureModalOpen.value = false;
  resetTextureModalLayout();
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
      expect(slider!.props?.min).toBe(1);
      expect(slider!.props?.max).toBe(80);
      expect(slider!.props?.step).toBe(1);
      expect(slider!.props?.label).toBe('Brush size');
      expect(slider!.props?.ariaLabel).toBe('Brush size — textures');
      expect(slider!.props?.value, 'the live aquarelle size').toBe(42);
      expect(slider!.props?.disabled).toBeFalsy();

      (slider!.props?.onChange as (value: number) => void)(37);
      expect(onBrushSizeChange, 'the continuous path forwards the top-bar handler').toHaveBeenCalledWith(37);
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
    expect(calls[0]!.patch).toEqual({ params: { size: 37 } });
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

  it('mounts the shared import control below the strip under its own testid prefix', () => {
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
    expect(importAt, 'the import control sits below the strip').toBeGreaterThan(stripAt);

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
    expect(MODAL_SOURCE).toContain("commitAquarelleSelectionParam('size', value)");
    expect(MODAL_SOURCE).not.toContain('useState');
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
