import {projectStore} from '../../stores/projectStore';

export function Toolbar() {
  return (
    <div class="flex items-center gap-1 h-11 w-full bg-[#1C1C1C] px-3 shrink-0">
      {/* New, Open, Save buttons -- placeholders for Phase 3 */}
      <button class="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-accent)] px-3 py-1.5">
        <span class="text-xs text-white">New</span>
      </button>
      <button class="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5">
        <span class="text-xs text-[#CCCCCC]">Open</span>
      </button>
      <button class="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-3 py-1.5">
        <span class="text-xs text-[#CCCCCC]">Save</span>
      </button>
      <div class="w-px h-6 bg-[#333333]" />
      <button class="flex items-center gap-1.5 rounded-[5px] bg-[var(--color-bg-settings)] px-2.5 py-1.5">
        <span class="text-xs text-[#CCCCCC]">Set Folder</span>
      </button>
      <div class="w-px h-6 bg-[#333333]" />
      {/* FPS Toggle -- wired to projectStore */}
      <div class="flex items-center gap-0.5 rounded-[5px] bg-[var(--color-bg-settings)] p-1">
        <div
          class={`flex items-center rounded px-2.5 py-1 cursor-pointer ${projectStore.fps.value === 15 ? 'bg-[var(--color-accent)]' : ''}`}
          onClick={() => projectStore.setFps(15)}
        >
          <span class={`text-[11px] ${projectStore.fps.value === 15 ? 'text-white' : 'text-[var(--color-text-secondary)]'}`}>15fps</span>
        </div>
        <div
          class={`flex items-center rounded px-2.5 py-1 cursor-pointer ${projectStore.fps.value === 24 ? 'bg-[var(--color-accent)]' : ''}`}
          onClick={() => projectStore.setFps(24)}
        >
          <span class={`text-[11px] ${projectStore.fps.value === 24 ? 'text-white' : 'text-[var(--color-text-secondary)]'}`}>24fps</span>
        </div>
      </div>
      {/* Spacer */}
      <div class="flex-1" />
      <span class="text-[11px] text-[var(--color-text-secondary)]">100%</span>
      <button class="rounded-[5px] bg-[var(--color-bg-settings)] px-2.5 py-1">
        <span class="text-sm text-[#CCCCCC]">-</span>
      </button>
      <button class="rounded-[5px] bg-[var(--color-bg-settings)] px-2.5 py-1">
        <span class="text-sm text-[#CCCCCC]">+</span>
      </button>
      <div class="w-px h-6 bg-[#333333]" />
      <button class="flex items-center gap-1.5 rounded-[5px] bg-[#F97316] px-4 py-1.5">
        <span class="text-xs font-semibold text-white">Export</span>
      </button>
    </div>
  );
}
