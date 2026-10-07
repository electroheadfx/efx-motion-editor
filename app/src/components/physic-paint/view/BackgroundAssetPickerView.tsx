import { useComputed, useSignal, type ReadonlySignal, type Signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { assetUrl } from '../../../lib/ipc';
import { sortImagesByOriginalFilename } from '../../../efx-paint/utils/naturalFilenameSort';
import type { MceImageRef } from '../../../types/project';
import type { PhysicPaintAudioAssetRef, PhysicPaintImageLibraryResult } from '../../../types/physicPaint';
import { AUDIO_EMPTY_BODY } from './PhysicsPaintAudioModalView';

/**
 * 49-04 (Task 2): the scoped full-area asset picker (S2) that the Bg row's
 * Import control opens (S1 lands in 49-05). The Studio realm's imageStore is
 * empty (Pitfall 2), so the picker populates its grid from the main webview via
 * the image-library request/result bridge pair (Task 1) and imports new images
 * through the native dialog (capability `dialog:allow-open`, Task 1).
 *
 * The controller is signal-driven (useSignal/useComputed only — no useState,
 * efx-preact-reactivity). The view is a presentational full-area swap of the
 * canvas region: bordered panel, top bar with the surface title and the
 * in-picker Import button, an images-only multi-select grid, and a footer with
 * Confirm/Cancel. No backdrop overlay, no Tab trap — a region swap, not a modal
 * (D-01).
 *
 * 52.5-01b (D-02/D-03): the SAME controller + view serve the audio mode
 * (`kind: 'audio'`) the Document sound modal's Import/Replace opens — filename
 * tiles (no thumbnails), SINGLE-select (D-01 singleton: one clip per document),
 * Confirm emits exactly one asset id. Audio rides the 01a requestLibrary/
 * import bridge pairs — never a second picker, never a new file-dialog path.
 */

export type BackgroundAssetPickerStatus =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string };

export type BackgroundAssetPickerKind = 'image' | 'audio';

export interface BackgroundAssetPickerPorts {
  /** Bridge consumer port: request { images, projectDir } from the main webview. */
  requestLibrary: () => Promise<PhysicPaintImageLibraryResult>;
  /** Existing import path: imports the dialog-selected paths into the project library. */
  importFiles: (paths: string[], projectDir: string) => Promise<void>;
  /** Native file dialog (plugin-dialog open) returning the selected image paths. */
  openDialog: () => Promise<string[] | null>;
  /** 49-02 natural original-filename ordering for Confirm. */
  sortImages: (images: readonly MceImageRef[]) => MceImageRef[];
  /** Post-import library refresh: returns the full MceImageRef[] to display. */
  refreshLibrary: () => Promise<MceImageRef[]>;
  /**
   * 52.5-01b: audio-mode post-import refresh — returns the package-relative
   * audio refs (kind 'audio' instances only; the image mode never calls it).
   */
  refreshAudioLibrary?: () => Promise<PhysicPaintAudioAssetRef[]>;
}

export interface BackgroundAssetPickerController {
  open: Signal<boolean>;
  images: Signal<MceImageRef[]>;
  /** 52.5-01b: the kind 'audio' listing (empty in image mode). */
  audioAssets: Signal<PhysicPaintAudioAssetRef[]>;
  projectDir: Signal<string>;
  selectedIds: Signal<string[]>;
  status: Signal<BackgroundAssetPickerStatus>;
  importing: Signal<boolean>;
  selectedCount: ReadonlySignal<number>;
  confirmDisabled: ReadonlySignal<boolean>;
  openPicker: () => Promise<void>;
  toggleSelect: (imageId: string) => void;
  cancel: () => void;
  importImages: () => Promise<void>;
}

export function useBackgroundAssetPickerController(
  ports: BackgroundAssetPickerPorts,
  kind: BackgroundAssetPickerKind = 'image',
): BackgroundAssetPickerController {
  const open = useSignal(false);
  const images = useSignal<MceImageRef[]>([]);
  const audioAssets = useSignal<PhysicPaintAudioAssetRef[]>([]);
  const projectDir = useSignal('');
  const selectedIds = useSignal<string[]>([]);
  const status = useSignal<BackgroundAssetPickerStatus>({ kind: 'idle' });
  const importing = useSignal(false);
  const selectedCount = useComputed(() => selectedIds.value.length);
  const confirmDisabled = useComputed(() => selectedIds.value.length === 0);

  const openPicker = async () => {
    open.value = true;
    status.value = { kind: 'loading' };
    const result = await ports.requestLibrary();
    // Closed while the request was in flight — never populate a closed picker.
    if (!open.value) return;
    if (!result.ok) {
      status.value = { kind: 'error', message: result.error ?? 'Failed to load the project library.' };
      return;
    }
    images.value = result.images;
    // Audio listings carry their refs separately (01a result shape); image
    // mode never sees an audio row.
    audioAssets.value = kind === 'audio' ? result.audioAssets ?? [] : [];
    projectDir.value = result.projectDir;
    status.value = { kind: 'idle' };
  };

  const toggleSelect = (imageId: string) => {
    const current = selectedIds.value;
    // 52.5-01b D-01 singleton: the audio gallery is SINGLE-select — a second
    // pick REPLACES the selection (one sound clip per document); it never
    // accumulates the way the image multi-select does.
    if (kind === 'audio') {
      selectedIds.value = current.length === 1 && current[0] === imageId ? [] : [imageId];
      return;
    }
    selectedIds.value = current.includes(imageId)
      ? current.filter((id) => id !== imageId)
      : [...current, imageId];
  };

  const cancel = () => {
    open.value = false;
    selectedIds.value = [];
    status.value = { kind: 'idle' };
  };

  const importImages = async () => {
    if (importing.value) return;
    importing.value = true;
    try {
      const paths = await ports.openDialog();
      if (paths && paths.length > 0) {
        const dir = projectDir.value;
        if (!dir) {
          status.value = { kind: 'error', message: 'No project directory is open.' };
          return;
        }
        await ports.importFiles(paths, dir);
        // Refresh the library so newly imported images appear without closing
        // the picker; prior selection is preserved (error state keeps it too).
        if (kind === 'audio') {
          audioAssets.value = await ports.refreshAudioLibrary?.() ?? [];
        } else {
          images.value = await ports.refreshLibrary();
        }
        status.value = { kind: 'idle' };
      }
    } catch (error) {
      status.value = { kind: 'error', message: String(error) };
    } finally {
      importing.value = false;
    }
  };

  return {
    open,
    images,
    audioAssets,
    projectDir,
    selectedIds,
    status,
    importing,
    selectedCount,
    confirmDisabled,
    openPicker,
    toggleSelect,
    cancel,
    importImages,
  };
}

/**
 * D-02 confirm ordering: the confirmed selection is emitted ordered by
 * `sortImagesByOriginalFilename` — click order and asset UUID never influence
 * the emitted reference order (zero-one-many: one image → single-frame-cycle
 * source; many → full natural-sorted cycle).
 */
export function buildConfirmedImageIds(
  images: readonly MceImageRef[],
  selectedIds: readonly string[],
  sortImages: (images: readonly MceImageRef[]) => MceImageRef[],
): string[] {
  const selected = images.filter((image) => selectedIds.includes(image.id));
  return sortImages(selected).map((image) => image.id);
}

/**
 * 52.5-01b (D-01 singleton): the audio Confirm emit — natural-filename ordered
 * like the image path, and with the controller's single-select it always
 * carries EXACTLY one asset id (one sound clip per document).
 */
export function buildConfirmedAudioIds(
  audioAssets: readonly PhysicPaintAudioAssetRef[],
  selectedIds: readonly string[],
): string[] {
  const selected = audioAssets.filter((asset) => selectedIds.includes(asset.id));
  return [...selected]
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))
    .map((asset) => asset.id);
}

export interface BackgroundAssetPickerViewProps {
  open: boolean;
  images: MceImageRef[];
  projectDir: string;
  selectedIds: string[];
  status: BackgroundAssetPickerStatus;
  importing: boolean;
  onToggleSelect: (imageId: string) => void;
  onConfirm: (sortedIds: string[]) => void;
  onCancel: () => void;
  onImport: () => void;
  /** 50-03 (S2): the picker's title + aria-label. Defaults to the Bg copy
   *  ("Import background images"); the reference picker passes
   *  "Import reference images" (D-01 region swap reuse). */
  title?: string;
  /** 52.5-01b (D-02/D-03): gallery mode — 'image' (default) lists thumbnails,
   *  'audio' lists filename tiles and single-selects (D-01 singleton). */
  kind?: 'image' | 'audio';
  /** kind 'audio' listing (absent in image mode). */
  audioAssets?: PhysicPaintAudioAssetRef[];
}

/**
 * S2 full-area swap: a bordered panel filling the canvas region with a top bar
 * (`Import background images` title + Import button), an images-only
 * multi-select grid, and a footer with named Confirm/Cancel buttons.
 * `role="region"` with `aria-label="Import background images"`; focus moves to
 * Confirm on open and Confirm/Cancel restore focus to the opener. No backdrop
 * overlay and no Tab trap (region swap, not a modal). The engine canvas stays
 * mounted underneath — this panel is an overlay, never a replacement.
 */
export function BackgroundAssetPickerView(props: BackgroundAssetPickerViewProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (props.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      // UI-SPEC: opening the picker moves focus to Confirm (the completion
      // action in the footer); Cancel/Confirm restore focus to the Import
      // control that opened the picker.
      confirmButtonRef.current?.focus();
    } else if (returnFocusRef.current) {
      returnFocusRef.current.focus();
      returnFocusRef.current = null;
    }
  }, [props.open]);

  if (!props.open) return null;

  const handleConfirm = () => {
    if (props.kind === 'audio') {
      props.onConfirm(buildConfirmedAudioIds(props.audioAssets ?? [], props.selectedIds));
      return;
    }
    props.onConfirm(
      buildConfirmedImageIds(props.images, props.selectedIds, (images) =>
        sortImagesByOriginalFilename(images, (image) => image.original_filename),
      ),
    );
  };

  // Unified listing shape: image rows carry a thumbnail, audio rows are
  // filename-only tiles (no thumbnails — D-03 keeps the gallery ONE surface).
  const entries = props.kind === 'audio'
    ? (props.audioAssets ?? []).map((asset) => ({ id: asset.id, name: asset.name }))
    : props.images.map((image) => ({ id: image.id, name: image.original_filename }));

  const empty = entries.length === 0;
  const error = props.status.kind === 'error' ? props.status.message : null;
  const title = props.title ?? 'Import background images';

  return (
    <div class="physics-paint-background-picker" role="region" aria-label={title}>
      <div class="physics-paint-background-picker-topbar">
        <span class="physics-paint-background-picker-title">{title}</span>
        <div class="physics-paint-background-picker-actions">
          <button
            type="button"
            class="physics-paint-background-picker-import"
            disabled={props.importing}
            onClick={props.onImport}
          >
            Import
          </button>
        </div>
      </div>

      <div class="physics-paint-background-picker-body">
        {error ? (
          <div class="physics-paint-background-picker-status" role="alert">
            {error}
          </div>
        ) : null}
        {empty ? (
          <div class="physics-paint-background-picker-empty">
            {/* Audio mode: the contracted modal body copy (verbatim reuse — no
                drag-and-drop path exists for audio, so the image drag copy
                never shows here). */}
            <span>{props.kind === 'audio' ? AUDIO_EMPTY_BODY : 'Drag & drop images here or use Import button'}</span>
          </div>
        ) : (
          <div class="physics-paint-background-picker-grid">
            {entries.map((entry) => {
              const selected = props.selectedIds.includes(entry.id);
              const image = props.kind === 'audio'
                ? null
                : props.images.find((candidate) => candidate.id === entry.id) ?? null;
              return (
                <div
                  key={entry.id}
                  class={`physics-paint-background-picker-tile${selected ? ' selected' : ''}`}
                  title={entry.name}
                  aria-pressed={selected}
                  onClick={() => props.onToggleSelect(entry.id)}
                >
                  {props.kind === 'audio' ? (
                    // Filename-only audio tile — no thumbnail, no image decode.
                    <span class="physics-paint-background-picker-tile-wave" aria-hidden="true" />
                  ) : image ? (
                    <img
                      src={assetUrl(`${props.projectDir}/${image.thumbnail_relative_path}`)}
                      alt={entry.name}
                      loading="lazy"
                      draggable={false}
                    />
                  ) : null}
                  <span class="physics-paint-background-picker-tile-name">{entry.name}</span>
                  {selected ? (
                    <span class="physics-paint-background-picker-tile-check" aria-hidden="true">
                      &#10003;
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div class="physics-paint-background-picker-footer">
        <div class="physics-paint-background-picker-actions">
          <button
            type="button"
            ref={confirmButtonRef}
            class="physics-paint-background-picker-confirm"
            disabled={props.selectedIds.length === 0}
            onClick={handleConfirm}
          >
            Confirm
          </button>
          <button type="button" onClick={props.onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
