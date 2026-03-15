import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {ThemeSwitcher} from '../layout/ThemeSwitcher';

const COMMON_RESOLUTIONS = [
  {label: '1920x1080 (1080p)', w: 1920, h: 1080},
  {label: '1280x720 (720p)', w: 1280, h: 720},
  {label: '3840x2160 (4K)', w: 3840, h: 2160},
];

export function SettingsView() {
  const currentResLabel = `${projectStore.width.value}x${projectStore.height.value}`;

  return (
    <div class="flex flex-col flex-1 min-w-0 bg-[var(--color-bg-root)]">
      {/* Header bar */}
      <div class="flex items-center justify-between h-10 px-4 bg-[var(--color-bg-toolbar)] border-b border-[var(--color-separator)] shrink-0">
        <span class="text-sm font-semibold text-[var(--color-text-button)]">Settings</span>
        <button
          class="w-6 h-6 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-button)] transition-colors"
          onClick={() => uiStore.setEditorMode('editor')}
          title="Close"
        >
          &times;
        </button>
      </div>

      {/* Settings content */}
      <div class="flex-1 overflow-y-auto p-6">
        <div class="max-w-md space-y-6">
          {/* FPS */}
          <div class="space-y-2">
            <label class="text-xs font-semibold text-[var(--color-text-muted)]">Frame Rate</label>
            <div class="flex gap-2">
              {[15, 24].map((rate) => (
                <button
                  key={rate}
                  class={`px-4 py-2 rounded-[5px] text-sm transition-colors ${
                    projectStore.fps.value === rate
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-bg-settings)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-input)]'
                  }`}
                  onClick={() => projectStore.setFps(rate)}
                >
                  {rate} fps
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div class="space-y-2">
            <label class="text-xs font-semibold text-[var(--color-text-muted)]">Resolution</label>
            <select
              class="w-full text-sm bg-[var(--color-bg-input)] text-[var(--color-text-button)] border border-[var(--color-border-subtle)] rounded-[5px] px-3 py-2 outline-none cursor-pointer"
              value={currentResLabel}
              onChange={(e) => {
                const val = (e.target as HTMLSelectElement).value;
                const res = COMMON_RESOLUTIONS.find((r) => `${r.w}x${r.h}` === val.split(' ')[0]);
                if (res) projectStore.setResolution(res.w, res.h);
              }}
            >
              {COMMON_RESOLUTIONS.map((r) => (
                <option key={r.label} value={`${r.w}x${r.h}`}>{r.label}</option>
              ))}
              {!COMMON_RESOLUTIONS.find((r) => `${r.w}x${r.h}` === currentResLabel) && (
                <option value={currentResLabel}>{currentResLabel}</option>
              )}
            </select>
          </div>

          {/* Theme */}
          <div class="space-y-2">
            <label class="text-xs font-semibold text-[var(--color-text-muted)]">Theme</label>
            <ThemeSwitcher />
          </div>
        </div>
      </div>
    </div>
  );
}
