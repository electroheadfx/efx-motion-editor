export function PropertiesPanel() {
  return (
    <div class="flex items-center gap-5 h-14 w-full bg-[#0F0F0F] px-4 shrink-0 overflow-x-auto">
      <span class="text-[9px] font-semibold text-[var(--color-text-dimmer)]">
        TRANSFORM
      </span>
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-[var(--color-text-muted)]">X</span>
        <div class="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span class="text-[11px] text-[#CCCCCC]">0.00</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-[var(--color-text-muted)]">Y</span>
        <div class="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span class="text-[11px] text-[#CCCCCC]">0.00</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-[var(--color-text-muted)]">Scale</span>
        <div class="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span class="text-[11px] text-[#CCCCCC]">1.00</span>
        </div>
      </div>
      <div class="flex items-center gap-1">
        <span class="text-[10px] text-[var(--color-text-muted)]">
          Rotation
        </span>
        <div class="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
          <span class="text-[11px] text-[#CCCCCC]">0&deg;</span>
        </div>
      </div>
      <div class="w-px h-8 bg-[#2A2A2A]" />
      <span class="text-[9px] font-semibold text-[var(--color-text-dimmer)]">
        BLEND
      </span>
      <div class="rounded bg-[var(--color-bg-input)] px-2.5 py-[5px]">
        <span class="text-[11px] text-[#CCCCCC]">Screen &#9662;</span>
      </div>
      <span class="text-[10px] text-[var(--color-text-muted)]">Opacity</span>
      <div class="flex items-center w-[100px] h-3">
        <div class="w-20 h-1 rounded-sm bg-[var(--color-accent)]" />
        <div class="w-5 h-1 rounded-sm bg-[#333333]" />
      </div>
      <span class="text-[11px] text-[#CCCCCC]">80%</span>
    </div>
  );
}
