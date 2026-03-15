import type { Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';

interface CollapsibleSectionProps {
  title: string;
  collapsed: Signal<boolean>;
  headerActions?: ComponentChildren;
  children: ComponentChildren;
}

export function CollapsibleSection({ title, collapsed, headerActions, children }: CollapsibleSectionProps) {
  return (
    <>
      <div
        class="flex items-center justify-between h-9 px-3 bg-[var(--color-bg-section-header)] cursor-pointer select-none"
        onClick={() => { collapsed.value = !collapsed.value; }}
      >
        <div class="flex items-center gap-1.5">
          <span class="text-[9px] text-[var(--color-text-dimmer)]">
            {collapsed.value ? '\u25B6' : '\u25BC'}
          </span>
          <span class="text-[10px] font-semibold text-[var(--color-text-muted)]">
            {title}
          </span>
        </div>
        {headerActions && (
          <div onClick={(e) => e.stopPropagation()}>{headerActions}</div>
        )}
      </div>
      {!collapsed.value && children}
    </>
  );
}
