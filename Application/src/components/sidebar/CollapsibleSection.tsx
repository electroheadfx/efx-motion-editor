import type { Signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { ChevronDown } from 'lucide-preact';

interface CollapsibleSectionProps {
  title: string;
  collapsed: Signal<boolean>;
  headerActions?: ComponentChildren;
  children: ComponentChildren;
  /** Optional callback fired when the section is toggled. Receives the new collapsed state. */
  onCollapse?: (collapsed: boolean) => void;
}

export function CollapsibleSection({ title, collapsed, headerActions, children, onCollapse }: CollapsibleSectionProps) {
  const handleToggle = () => {
    const newState = !collapsed.value;
    if (onCollapse) {
      onCollapse(newState);
    } else {
      collapsed.value = newState;
    }
  };

  return (
    <>
      <div
        class="flex items-center justify-between h-9 px-3 cursor-pointer select-none shrink-0"
        data-interactive
        onClick={handleToggle}
      >
        <div class="flex items-center gap-1.5">
          <ChevronDown
            size={12}
            style={{
              color: 'var(--sidebar-text-secondary)',
              transform: collapsed.value ? 'rotate(-90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms ease',
            }}
          />
          <span style="font-size: 11px; font-weight: 600; letter-spacing: 2px; color: var(--sidebar-text-secondary)">
            {title}
          </span>
        </div>
        {headerActions && (
          <div onClick={(e) => e.stopPropagation()}>{headerActions}</div>
        )}
      </div>
      <div
        class="overflow-hidden transition-[max-height] duration-150 ease-out"
        style={{ maxHeight: collapsed.value ? '0px' : '9999px' }}
      >
        {children}
      </div>
    </>
  );
}
