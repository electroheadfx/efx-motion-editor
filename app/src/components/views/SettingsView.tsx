import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {ThemeSwitcher} from '../layout/ThemeSwitcher';
// 260918-ovi (T-260918-ovi-03): consume the SHARED preset table so a future
// edit cannot silently reintroduce a 4K option in one surface while the other
// stays clamped. The source-scan contract (SettingsView.test.tsx) pins the
// absence of any '3840' / '2160' / '4K' literal outside comments.
import {CANVAS_FORMAT_PRESETS} from '../project/canvasFormatPresets';
// 260924-ffd UAT follow-up: the Frame Rate control is a click-button row over
// the ONE FPS_PRESETS list (the value stepper here → OBSOLETE; the Studio
// playback value control lives in the Tools popover instead). This is the
// PROJECT tier: a click writes only the project store's fps setter, never the
// Studio playback store (two-tier fps law, pinned in NumericStepper.test.tsx).
import {FPS_PRESETS} from '../../lib/fpsPresets';

export function SettingsView() {
  const currentResLabel = `${projectStore.width.value}x${projectStore.height.value}`;

  return (
    <div class="flex flex-col flex-1 min-w-0 bg-(--color-bg-root)">
      {/* Header bar */}
      <div class="flex items-center justify-between h-10 px-4 bg-(--color-bg-toolbar) border-b border-(--color-separator) shrink-0">
        <span class="text-sm font-semibold text-(--color-text-button)">Settings</span>
        <button
          class="w-6 h-6 flex items-center justify-center text-(--color-text-muted) hover:text-(--color-text-button) transition-colors"
          onClick={() => uiStore.setEditorMode('editor')}
          title="Close"
        >
          &times;
        </button>
      </div>

      {/* Settings content */}
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-md space-y-6">
          {/* FPS (260924-ffd follow-up: click buttons over the shared FPS_PRESETS list) */}
          <div class="space-y-2">
            <label class="text-xs font-semibold text-(--color-text-muted)">Frame Rate</label>
            <div class="flex gap-2 items-center flex-wrap" role="group" aria-label="Frame Rate">
              {FPS_PRESETS.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  aria-pressed={projectStore.fps.value === rate}
                  class={`h-8 min-w-11 rounded-md px-3 text-sm font-medium transition-colors ${
                    projectStore.fps.value === rate
                      ? 'bg-(--color-accent) text-white'
                      : 'bg-(--color-bg-input) text-(--color-text-secondary) hover:bg-(--color-bg-settings)'
                  }`}
                  onClick={() => projectStore.setFps(rate)}
                >
                  {rate}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div class="space-y-2">
            <label class="text-xs font-semibold text-(--color-text-muted)">Resolution</label>
            <select
              class="w-full text-sm bg-(--color-bg-input) text-(--color-text-button) border border-(--color-border-subtle) rounded-[5px] px-3 py-2 outline-none cursor-pointer"
              value={currentResLabel}
              onChange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                const preset = CANVAS_FORMAT_PRESETS.find((p) => `${p.width}x${p.height}` === val);
                if (preset) projectStore.setResolution(preset.width, preset.height);
              }}
            >
              {CANVAS_FORMAT_PRESETS.map((preset) => (
                <option key={preset.id} value={`${preset.width}x${preset.height}`}>{preset.label}</option>
              ))}
              {/* Fallback: a project created outside the preset set (or via the
                  Custom… creation branch with non-preset dims) still sees its
                  live size as a selectable option so the select always shows
                  the project's current dims. */}
              {!CANVAS_FORMAT_PRESETS.find((p) => `${p.width}x${p.height}` === currentResLabel) && (
                <option value={currentResLabel}>{currentResLabel}</option>
              )}
            </select>
          </div>

          {/* Theme */}
          <div class="space-y-2">
            <label class="text-xs font-semibold text-(--color-text-muted)">Theme</label>
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}
