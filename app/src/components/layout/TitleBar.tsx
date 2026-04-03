import {projectStore} from '../../stores/projectStore';

export function TitleBar() {
  return (
    <div class="flex items-center h-7 w-full bg-(--color-bg-section-header) px-1.5 shrink-0">
      <div class="flex items-center gap-2">
        <div class="w-3 h-3 rounded-full bg-[#FF5F57]" />
        <div class="w-3 h-3 rounded-full bg-[#FFBD2E]" />
        <div class="w-3 h-3 rounded-full bg-[#28CA41]" />
      </div>
      <span class="text-xs text-(--color-text-muted) ml-4">
        EFX-Motion — {projectStore.name}.mce
      </span>
    </div>
  );
}
