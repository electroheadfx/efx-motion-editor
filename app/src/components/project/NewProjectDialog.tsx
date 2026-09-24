import {useState, useEffect, useRef} from 'preact/hooks';
import {signal} from '@preact/signals';
import {open as openDialog} from '@tauri-apps/plugin-dialog';
import {projectStore} from '../../stores/projectStore';
import {toPackageManifestPath} from '../../lib/openedProjectUrls';
import {showProjectIoFailureDialog} from '../../lib/projectIoFailureDialog';
import {NumericStepper} from '../shared/NumericStepper';
// 260924-ffd: the Frame Rate control is the shared preset stepper over the ONE
// FPS_PRESETS list (the inline 15/24 fps pills → OBSOLETE). PROJECT tier seed:
// local fps state (default 24, locked decision) → createProject(name, fps, …),
// never the project store's fps setter directly (two-tier fps law).
import {FPS_PRESETS} from '../../lib/fpsPresets';
import {
  CANVAS_FORMAT_PRESETS,
  CUSTOM_CANVAS_FORMAT_MAX_SIDE,
  CUSTOM_CANVAS_FORMAT_MIN_SIDE,
  CUSTOM_CANVAS_FORMAT_PRESET_ID,
  DEFAULT_CANVAS_FORMAT_PRESET_ID,
  clampCustomSize,
  type CanvasFormatSelectionId,
} from './canvasFormatPresets';

// 260918-ovi (efx-preact-reactivity): NEW dialog state lives in module-scope
// signals, never useState. The pre-existing name/fps/dirPath useState fields
// stay untouched (out of scope to refactor).
const selectedPresetId = signal<CanvasFormatSelectionId>(DEFAULT_CANVAS_FORMAT_PRESET_ID);
// Custom…-branch field state (amendment: the W×H fields are always visible —
// a selected preset displays its own dims in the greyed fields, and entering
// Custom… re-seeds these signals from the current preset). The steppers clamp
// at emission; handleCreate still runs clampCustomSize as the defensive
// second pass (T-260918-ovi-01).
const customWidth = signal<number>(1920);
const customHeight = signal<number>(1080);

/** Short pill label for a fixed preset — full annotated labels stay in the preset table for SettingsView. */
function pillLabelFor(id: string): string {
  switch (id) {
    case 'hd': return 'HD';
    case 'hd-vertical': return 'HD Vertical';
    case 'portrait': return 'Portrait';
    case 'square': return 'Square';
    default: return id;
  }
}

interface NewProjectDialogProps {
  onClose: () => void;
}

export function NewProjectDialog({onClose}: NewProjectDialogProps) {
  const [name, setName] = useState('Untitled Project');
  const [fps, setFps] = useState(24);
  const [dirPath, setDirPath] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus the name input on mount
  useEffect(() => {
    // WR-01: the module-scope format signals outlive a mount cycle, unlike
    // the useState fields — reset them so every open starts at the HD
    // defaults, symmetric with name/fps/dirPath.
    selectedPresetId.value = DEFAULT_CANVAS_FORMAT_PRESET_ID;
    customWidth.value = 1920;
    customHeight.value = 1080;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const handleChooseFolder = async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: 'Choose Project Folder',
    });
    if (selected && typeof selected === 'string') {
      setDirPath(selected);
    }
  };

  const handleCreate = async () => {
    if (!dirPath) {
      setError('Please choose a folder for the project.');
      return;
    }
    if (!name.trim()) {
      setError('Please enter a project name.');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      // 52.2-11 (D-03): the project IS the package — a directory named
      // `Name.mce` that macOS presents as ONE Finder document (LSTypeIsPackage
      // in the bundle's Info.plist). Every package-relative path the store
      // writes (`project.mce`, `layers/`, `frames/`) lives inside it, so the
      // project directory and the package directory are the same directory.
      const packageDirPath = `${dirPath}/${name.trim()}.mce`;

      // Create the project via projectStore (handles IPC + temp migration)
      // Custom… branch: clampCustomSize is the defensive second pass — the
      // steppers already bounded every emission (T-260918-ovi-01).
      const dims = selectedPresetId.value === CUSTOM_CANVAS_FORMAT_PRESET_ID
        ? clampCustomSize(customWidth.value, customHeight.value)
        : (CANVAS_FORMAT_PRESETS.find(p => p.id === selectedPresetId.value) ?? CANVAS_FORMAT_PRESETS[0]);
      await projectStore.createProject(name.trim(), fps, packageDirPath, dims.width, dims.height);

      // Auto-save the initial package: the manifest inside the package dir.
      await projectStore.saveProjectAs(toPackageManifestPath(packageDirPath));

      onClose();
    } catch (err) {
      // quick-260913-05k round 3 (UAT defect A): `createProject` resets the UI
      // store (`closeProject`), so this dialog is already unmounted by the time
      // a create or the initial save can fail — an inline setError renders
      // nowhere. Route the failure through the blocking modal every other save
      // site uses; the project stays registered at its chosen package path.
      console.error('Failed to create project:', err);
      await showProjectIoFailureDialog('save', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && !isCreating) handleCreate();
  };

  const isCustomFormat = selectedPresetId.value === CUSTOM_CANVAS_FORMAT_PRESET_ID;
  // The preset whose dims the greyed W×H fields track. In Custom… mode the
  // fields read the custom signals instead; activePreset is then only the
  // seed source captured by the Custom… pill click.
  const activePreset =
    CANVAS_FORMAT_PRESETS.find((p) => p.id === selectedPresetId.value) ?? CANVAS_FORMAT_PRESETS[0];

  return (
    <div
      class="fixed inset-0 flex items-center justify-center z-50"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        class="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Dialog Card */}
      <div class="relative bg-(--color-bg-card) rounded-xl shadow-2xl w-[440px] p-8 flex flex-col gap-6">
        {/* Title */}
        <h2 class="text-lg font-semibold text-(--color-text-primary)">
          New Project
        </h2>

        {/* Project Name */}
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-semibold text-(--color-text-dim) tracking-wide">
            PROJECT NAME
          </label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            class="w-full h-10 rounded-lg bg-(--color-bg-input) border border-(--color-separator) px-3 text-sm text-(--color-text-primary) outline-none focus:border-(--color-accent) transition-colors"
            placeholder="Enter project name"
          />
        </div>

        {/* Frame Rate (260924-ffd: preset stepper over the shared FPS_PRESETS list) */}
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-semibold text-(--color-text-dim) tracking-wide">
            FRAME RATE
          </label>
          <div class="flex items-center gap-1 rounded-lg bg-(--color-bg-input) p-1 w-fit">
            <NumericStepper
              value={fps}
              onChange={setFps}
              presets={FPS_PRESETS}
              ariaLabel="Frame Rate"
            />
          </div>
        </div>

        {/* Canvas Format (260918-ovi) */}
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-semibold text-(--color-text-dim) tracking-wide">
            CANVAS FORMAT
          </label>
          <div class="flex items-center gap-1 rounded-lg bg-(--color-bg-input) p-1 w-fit">
            {CANVAS_FORMAT_PRESETS.map((preset) => (
              <div
                key={preset.id}
                class={`flex items-center rounded-md px-4 py-2 cursor-pointer transition-colors ${
                  selectedPresetId.value === preset.id ? 'bg-(--color-accent)' : ''
                }`}
                onClick={() => { selectedPresetId.value = preset.id; }}
              >
                <span
                  class={`text-sm ${selectedPresetId.value === preset.id ? 'text-white font-medium' : 'text-(--color-text-secondary)'}`}
                >
                  {pillLabelFor(preset.id)}
                </span>
              </div>
            ))}
            <div
              class={`flex items-center rounded-md px-4 py-2 cursor-pointer transition-colors ${
                isCustomFormat ? 'bg-(--color-accent)' : ''
              }`}
              onClick={() => {
                // Amendment (always-visible fields): entering Custom… seeds the
                // fields from the preset current at click time — the user edits
                // from those dims, not from blank. Switching back to a preset
                // shows that preset's dims again (the custom values are
                // discarded; a later Custom… entry re-seeds).
                customWidth.value = activePreset.width;
                customHeight.value = activePreset.height;
                selectedPresetId.value = CUSTOM_CANVAS_FORMAT_PRESET_ID;
              }}
            >
              <span
                class={`text-sm ${isCustomFormat ? 'text-white font-medium' : 'text-(--color-text-secondary)'}`}
              >
                Custom…
              </span>
            </div>
          </div>
          {/* Pixel dims (amendment): always visible — greyed and tracking the
              selected preset; editable steppers (16–1920 clamp) on Custom…. */}
          <div class={`flex items-center gap-2 ${isCustomFormat ? '' : 'opacity-50'}`}>
            <NumericStepper
              value={isCustomFormat ? customWidth.value : activePreset.width}
              onChange={(v) => { customWidth.value = v; }}
              step={1}
              min={CUSTOM_CANVAS_FORMAT_MIN_SIDE}
              max={CUSTOM_CANVAS_FORMAT_MAX_SIDE}
              ariaLabel="Canvas width (px)"
              disabled={!isCustomFormat}
            />
            <span class="text-sm text-(--color-text-secondary)">x</span>
            <NumericStepper
              value={isCustomFormat ? customHeight.value : activePreset.height}
              onChange={(v) => { customHeight.value = v; }}
              step={1}
              min={CUSTOM_CANVAS_FORMAT_MIN_SIDE}
              max={CUSTOM_CANVAS_FORMAT_MAX_SIDE}
              ariaLabel="Canvas height (px)"
              disabled={!isCustomFormat}
            />
          </div>
        </div>

        {/* Location */}
        <div class="flex flex-col gap-2">
          <label class="text-[11px] font-semibold text-(--color-text-dim) tracking-wide">
            LOCATION
          </label>
          <div class="flex items-center gap-2">
            <div class="flex-1 h-10 rounded-lg bg-(--color-bg-input) border border-(--color-separator) px-3 flex items-center overflow-hidden">
              <span class="text-sm text-(--color-text-secondary) truncate">
                {dirPath ?? 'No folder selected'}
              </span>
            </div>
            <button
              class="h-10 rounded-lg bg-(--color-bg-settings) px-4 hover:bg-(--color-bg-input) transition-colors shrink-0"
              onClick={handleChooseFolder}
            >
              <span class="text-sm text-(--color-text-secondary)">
                Choose...
              </span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div class="rounded-lg bg-(--color-error-bg) px-3 py-2">
            <span class="text-xs text-(--color-error-text)">{error}</span>
          </div>
        )}

        {/* Buttons */}
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            class="h-9 rounded-lg bg-(--color-bg-settings) px-5 hover:bg-(--color-bg-input) transition-colors"
            onClick={onClose}
            disabled={isCreating}
          >
            <span class="text-sm text-(--color-text-secondary)">
              Cancel
            </span>
          </button>
          <button
            class="h-9 rounded-lg bg-(--color-accent) px-5 hover:bg-(--color-accent-hover) transition-colors disabled:opacity-50"
            onClick={handleCreate}
            disabled={isCreating || !dirPath}
          >
            <span class="text-sm font-medium text-white">
              {isCreating ? 'Creating...' : 'Create'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
