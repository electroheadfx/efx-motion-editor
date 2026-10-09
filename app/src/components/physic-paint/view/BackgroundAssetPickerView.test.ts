import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MceImageRef } from '../../../types/project';
import type { PhysicPaintAudioAssetRef, PhysicPaintImageLibraryResult } from '../../../types/physicPaint';
import {
  buildConfirmedImageIds,
  useBackgroundAssetPickerController,
  type BackgroundAssetPickerPorts,
} from './BackgroundAssetPickerView';

/**
 * 49-04 (Task 2) controller tests. The picker controller is signal-driven
 * (useSignal/useComputed only — no useState, efx-preact-reactivity). The
 * @preact/signals hook wrappers (useSignal = useMemo(() => signal(v), []),
 * useComputed = useRef + useMemo + a render-context component flag) require a
 * live Preact render context, so the test mocks the two hook wrappers down to
 * the real signal/computed core — the controller behavior under test is the
 * signal state machine, not the hook plumbing. The view component itself is
 * covered by the source-level contract tests in PhysicsPaintStudio.test.ts.
 */

vi.mock('@preact/signals', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@preact/signals')>();
  return {
    ...actual,
    useSignal: <Value>(value: Value) => actual.signal(value),
    useComputed: <Value>(compute: () => Value) => actual.computed(compute),
  };
});

const sourcePath = resolve(dirname(fileURLToPath(import.meta.url)), 'BackgroundAssetPickerView.tsx');
const source = () => readFileSync(sourcePath, 'utf8');

function image(id: string, originalFilename: string): MceImageRef {
  return {
    id,
    original_filename: originalFilename,
    relative_path: `assets/${originalFilename}`,
    thumbnail_relative_path: `thumbs/${originalFilename}`,
    width: 100,
    height: 100,
    format: 'png',
  };
}

function createPorts(overrides: Partial<BackgroundAssetPickerPorts> = {}): BackgroundAssetPickerPorts {
  return {
    requestLibrary: vi.fn(async (): Promise<PhysicPaintImageLibraryResult> => ({ ok: true, images: [], projectDir: '/proj', operationId: 'op-1' })),
    importFiles: vi.fn(async (): Promise<void> => undefined),
    openDialog: vi.fn(async (): Promise<string[] | null> => null),
    sortImages: vi.fn((images: readonly MceImageRef[]) => [...images]),
    refreshLibrary: vi.fn(async (): Promise<MceImageRef[]> => []),
    ...overrides,
  };
}

function createHarness(ports: BackgroundAssetPickerPorts) {
  const render = () => useBackgroundAssetPickerController(ports);
  return { render };
}

describe('useBackgroundAssetPickerController', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts closed with an empty selection and disabled Confirm (S2 idle)', () => {
    const harness = createHarness(createPorts());
    const controller = harness.render();
    expect(controller.open.value).toBe(false);
    expect(controller.images.value).toEqual([]);
    expect(controller.selectedIds.value).toEqual([]);
    expect(controller.selectedCount.value).toBe(0);
    expect(controller.confirmDisabled.value).toBe(true);
    expect(controller.status.value).toEqual({ kind: 'idle' });
    expect(controller.importing.value).toBe(false);
  });

  it('populates the library and project directory on open (Task 1 bridge consumer)', async () => {
    const images = [image('a', 'shot_1.png'), image('b', 'shot_2.png')];
    const ports = createPorts({
      requestLibrary: vi.fn(async () => ({ ok: true, images, projectDir: '/proj', operationId: 'op-1' })),
    });
    const harness = createHarness(ports);
    const controller = harness.render();
    await controller.openPicker();
    expect(controller.open.value).toBe(true);
    expect(controller.images.value).toEqual(images);
    expect(controller.projectDir.value).toBe('/proj');
    expect(controller.status.value).toEqual({ kind: 'idle' });
    expect(ports.requestLibrary).toHaveBeenCalledTimes(1);
  });

  it('surfaces the bridge error state without opening the grid (fail-closed)', async () => {
    const ports = createPorts({
      requestLibrary: vi.fn(async () => ({ ok: false, images: [], projectDir: '', operationId: 'op-1', error: 'Library unavailable.' })),
    });
    const harness = createHarness(ports);
    const controller = harness.render();
    await controller.openPicker();
    expect(controller.open.value).toBe(true);
    expect(controller.images.value).toEqual([]);
    expect(controller.status.value).toEqual({ kind: 'error', message: 'Library unavailable.' });
  });

  it('never populates a picker that was closed while the request was in flight', async () => {
    let resolveRequest: (value: PhysicPaintImageLibraryResult) => void = () => undefined;
    const ports = createPorts({
      requestLibrary: vi.fn(() => new Promise<PhysicPaintImageLibraryResult>((resolve) => { resolveRequest = resolve; })),
    });
    const harness = createHarness(ports);
    const controller = harness.render();
    const pending = controller.openPicker();
    controller.cancel();
    resolveRequest({ ok: true, images: [image('a', 'shot_1.png')], projectDir: '/proj', operationId: 'op-1' });
    await pending;
    expect(controller.open.value).toBe(false);
    expect(controller.images.value).toEqual([]);
  });

  it('toggles selection and drives the Confirm-disabled computed', () => {
    const images = [image('a', 'shot_1.png'), image('b', 'shot_2.png')];
    const ports = createPorts({
      requestLibrary: vi.fn(async () => ({ ok: true, images, projectDir: '/proj', operationId: 'op-1' })),
    });
    const harness = createHarness(ports);
    const controller = harness.render();
    controller.toggleSelect('a');
    expect(controller.selectedIds.value).toEqual(['a']);
    expect(controller.selectedCount.value).toBe(1);
    expect(controller.confirmDisabled.value).toBe(false);
    controller.toggleSelect('b');
    expect(controller.selectedIds.value).toEqual(['a', 'b']);
    expect(controller.selectedCount.value).toBe(2);
    controller.toggleSelect('a');
    expect(controller.selectedIds.value).toEqual(['b']);
    expect(controller.selectedCount.value).toBe(1);
  });

  it('imports dialog-selected paths and refreshes the library in place (in-picker Import)', async () => {
    const initial = [image('a', 'shot_1.png')];
    const afterImport = [image('a', 'shot_1.png'), image('c', 'shot_3.png')];
    const ports = createPorts({
      requestLibrary: vi.fn(async () => ({ ok: true, images: initial, projectDir: '/proj', operationId: 'op-1' })),
      openDialog: vi.fn(async () => ['/proj/assets/shot_3.png']),
      importFiles: vi.fn(async () => undefined),
      refreshLibrary: vi.fn(async () => afterImport),
    });
    const harness = createHarness(ports);
    const controller = harness.render();
    await controller.openPicker();
    await controller.importImages();
    expect(ports.openDialog).toHaveBeenCalledTimes(1);
    expect(ports.importFiles).toHaveBeenCalledWith(['/proj/assets/shot_3.png'], '/proj');
    expect(controller.images.value).toEqual(afterImport);
    expect(controller.status.value).toEqual({ kind: 'idle' });
    expect(controller.importing.value).toBe(false);
  });

  it('keeps the picker open and reports the error when the import path fails', async () => {
    const ports = createPorts({
      requestLibrary: vi.fn(async () => ({ ok: true, images: [], projectDir: '/proj', operationId: 'op-1' })),
      openDialog: vi.fn(async () => ['/proj/assets/shot_3.png']),
      importFiles: vi.fn(async () => { throw new Error('Import failed'); }),
    });
    const harness = createHarness(ports);
    const controller = harness.render();
    await controller.openPicker();
    await controller.importImages();
    expect(controller.open.value).toBe(true);
    expect(controller.status.value).toEqual({ kind: 'error', message: 'Error: Import failed' });
    expect(controller.importing.value).toBe(false);
  });

  it('reports a missing project directory before attempting the import', async () => {
    const ports = createPorts({
      requestLibrary: vi.fn(async () => ({ ok: true, images: [], projectDir: '', operationId: 'op-1' })),
      openDialog: vi.fn(async () => ['/proj/assets/shot_3.png']),
    });
    const harness = createHarness(ports);
    const controller = harness.render();
    await controller.openPicker();
    await controller.importImages();
    expect(ports.importFiles).not.toHaveBeenCalled();
    expect(controller.status.value).toEqual({ kind: 'error', message: 'No project directory is open.' });
  });

  it('cancel closes the picker and clears the selection and error state', async () => {
    const ports = createPorts({
      requestLibrary: vi.fn(async () => ({ ok: false, images: [], projectDir: '', operationId: 'op-1', error: 'Library unavailable.' })),
    });
    const harness = createHarness(ports);
    const controller = harness.render();
    await controller.openPicker();
    controller.toggleSelect('a');
    controller.cancel();
    expect(controller.open.value).toBe(false);
    expect(controller.selectedIds.value).toEqual([]);
    expect(controller.status.value).toEqual({ kind: 'idle' });
  });
});

describe('buildConfirmedImageIds — D-02 natural original-filename ordering', () => {
  it('emits the confirmed selection ordered by original filename, never by click order or asset UUID', () => {
    const images = [
      image('uuid-b', 'shot_10.png'),
      image('uuid-a', 'shot_1.png'),
      image('uuid-c', 'shot_2.png'),
    ];
    // Click order is deliberately NOT natural order.
    const selectedIds = ['uuid-c', 'uuid-b', 'uuid-a'];
    const naturalSort = (rows: readonly MceImageRef[]) =>
      [...rows].sort((left, right) =>
        left.original_filename.localeCompare(right.original_filename, undefined, { numeric: true, sensitivity: 'base' }),
      );
    const sorted = buildConfirmedImageIds(images, selectedIds, naturalSort);
    expect(sorted).toEqual(['uuid-a', 'uuid-c', 'uuid-b']);
  });

  it('emits an empty array when nothing is selected', () => {
    const images = [image('a', 'shot_1.png')];
    expect(buildConfirmedImageIds(images, [], (rows) => [...rows])).toEqual([]);
  });
});

/* ----------------------------------------------------------------------------
 * 52.5-01b Task 2 RED — kind 'audio' gallery mode (D-02 single entry point,
 * D-03 gallery is the only import seam, DOC-SND-02). The controller shape is
 * duck-typed loosely so the pre-GREEN file still type-checks (01a idiom):
 * `audioAssets` and the `kind` parameter exist only after GREEN.
 * ------------------------------------------------------------------------- */

function audioAsset(id: string, name: string): PhysicPaintAudioAssetRef {
  return { id, name, relativePath: `audio/${name}` };
}

type AudioPickerController = ReturnType<typeof useBackgroundAssetPickerController> & {
  audioAssets?: { value: PhysicPaintAudioAssetRef[] };
};

const renderAudioPicker = useBackgroundAssetPickerController as unknown as (
  ports: BackgroundAssetPickerPorts,
  kind?: 'image' | 'audio',
) => AudioPickerController;

function audioPorts(assets: readonly PhysicPaintAudioAssetRef[]): BackgroundAssetPickerPorts {
  return createPorts({
    requestLibrary: vi.fn(async () => ({
      ok: true,
      images: [],
      projectDir: '/proj',
      operationId: 'op-1',
      audioAssets: [...assets],
    })),
  });
}

describe("BackgroundAssetPickerView kind='audio' (52.5-01b Task 2 RED)", () => {
  it("(t1) kind='audio' maps the requestLibrary result's audioAssets into the listing signal", async () => {
    const assets = [audioAsset('snd-a', 'loop.wav'), audioAsset('snd-b', 'voice.mp3')];
    const controller = renderAudioPicker(audioPorts(assets), 'audio');
    await controller.openPicker();
    expect(controller.open.value).toBe(true);
    // The image listing stays EMPTY in audio mode (the result carries no images).
    expect(controller.images.value).toEqual([]);
    // The audio listing maps the result's audioAssets (RED: signal missing).
    // JSON compare keeps the failure payload on ONE line — a multi-line
    // pretty-format array dump corrupts the TAP YAML (01a/01b evidence pitfall).
    expect(JSON.stringify(controller.audioAssets?.value)).toBe(JSON.stringify(assets));
  });

  it("(t2) kind='audio' Confirm path emits exactly one asset id (D-01 singleton)", async () => {
    const assets = [audioAsset('snd-a', 'loop.wav'), audioAsset('snd-b', 'voice.mp3')];
    const controller = renderAudioPicker(audioPorts(assets), 'audio');
    await controller.openPicker();
    controller.toggleSelect('snd-a');
    controller.toggleSelect('snd-b');
    // Audio selection is SINGLE-select: the second pick replaces, never
    // accumulates. JSON compare keeps the failure payload one line (TAP YAML).
    expect(JSON.stringify(controller.selectedIds.value)).toBe(JSON.stringify(['snd-b']));
    const mod = (await import('./BackgroundAssetPickerView')) as {
      buildConfirmedAudioIds?: (
        assets: readonly PhysicPaintAudioAssetRef[],
        selectedIds: readonly string[],
      ) => string[];
    };
    const emitted = mod.buildConfirmedAudioIds?.(assets, controller.selectedIds.value) ?? [];
    expect(JSON.stringify(emitted)).toBe(JSON.stringify(['snd-b']));
    expect(emitted.length).toBe(1);
  });

  it('(t3) the view renders audio filename tiles without thumbnails and confirms through the audio path', () => {
    const code = source();
    // Custom short-message check: `expect(code).toContain(...)` would print the
    // ENTIRE source file into the TAP diagnostic, which breaks the RED
    // evidence parser (01a pitfall — keep failure payloads small).
    const required = [
      "kind?: 'image' | 'audio'",
      "props.kind === 'audio'",
      'audioAssets',
      'buildConfirmedAudioIds',
      // Audio tiles are filename-only — the thumbnail <img> rides the image branch only.
      "{props.kind === 'audio' ? (",
    ];
    const missing = required.filter((needle) => !code.includes(needle));
    if (missing.length > 0) {
      throw new Error(`view source missing audio-mode markers: ${missing.join(' | ')}`);
    }
  });
});

describe('BackgroundAssetPickerView surface contract', () => {
  it('is a signal-driven controller with no useState in the new picker code (efx-preact-reactivity)', () => {
    const code = source();
    expect(code).toContain('useSignal');
    expect(code).toContain('useComputed');
    // No useState hook call — the only "useState" occurrences are the
    // explanatory comment and the type import of ReadonlySignal/Signal.
    expect(code).not.toContain('useState(');
  });

  it('renders a full-area region swap with named Confirm/Cancel and an in-picker Import (S2)', () => {
    const code = source();
    expect(code).toContain('role="region"');
    expect(code).toContain('aria-label={title}');
    expect(code).toContain("const title = props.title ?? 'Import background images';");
    expect(code).toContain('physics-paint-background-picker-confirm');
    expect(code).toContain('physics-paint-background-picker-import');
    expect(code).toContain('props.onConfirm(');
    expect(code).toContain('buildConfirmedImageIds(props.images, props.selectedIds, (images) =>');
    expect(code).toContain('sortImagesByOriginalFilename(images, (image) => image.original_filename)');
    expect(code).not.toContain('aria-modal');
    expect(code).not.toContain('role="dialog"');
  });

  it('moves focus to Confirm on open and restores it on close (UI-SPEC)', () => {
    const code = source();
    // Opening the picker focuses the Confirm button (the completion action in
    // the footer); Cancel/Confirm restore focus to the opener.
    expect(code).toContain('confirmButtonRef.current?.focus();');
    expect(code).toContain('ref={confirmButtonRef}');
    expect(code).toContain('returnFocusRef.current.focus();');
    expect(code).not.toContain('importButtonRef');
  });
});
