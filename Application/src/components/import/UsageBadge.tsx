import type {FunctionalComponent} from 'preact';
import {Badge} from 'lucide-preact';

interface UsageBadgeProps {
  count: number;
  onClick: (e: MouseEvent) => void;
  /** 'thumbnail' for image/video grid items, 'inline' for audio list items */
  layout?: 'thumbnail' | 'inline';
}

export const UsageBadge: FunctionalComponent<UsageBadgeProps> = ({count, onClick, layout = 'thumbnail'}) => {
  // Color thresholds per D-02 / UI-SPEC:
  // 0: green (safe to remove), 1-2: yellow (low), 3-5: orange (medium), 6+: red (heavy)
  const color = count === 0 ? 'var(--color-dot-green)'
    : count <= 2 ? 'var(--color-dot-yellow)'
    : count <= 5 ? 'var(--color-dot-orange)'
    : 'var(--color-usage-badge-red)';

  const textColor = count <= 2 ? '#000000' : '#FFFFFF';

  // Per UI-SPEC: thumbnail = absolute top-1 right-1, inline = ml-auto flex item
  const positionClass = layout === 'thumbnail'
    ? 'absolute top-1 right-1 z-10'
    : 'ml-auto shrink-0';

  const size = layout === 'thumbnail' ? 26 : 22;

  return (
    <button
      class={`${positionClass} relative flex items-center justify-center cursor-pointer`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        padding: 0,
        border: 'none',
        background: 'none',
        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4))',
        transition: 'filter 100ms, transform 100ms',
      }}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
      }}
      onMouseEnter={(e: MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        el.style.filter = 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5))';
        el.style.transform = 'scale(1.15)';
      }}
      onMouseLeave={(e: MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        el.style.filter = 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.4))';
        el.style.transform = 'scale(1)';
      }}
      title={`Used ${count} time${count !== 1 ? 's' : ''}`}
    >
      <Badge
        size={size}
        fill={color}
        color={color}
        strokeWidth={0}
        style={{position: 'absolute', inset: 0}}
      />
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          color: textColor,
          fontSize: layout === 'thumbnail' ? '11px' : '9px',
          fontWeight: 700,
          lineHeight: '1',
          marginTop: '-1px',
        }}
      >
        {count}
      </span>
    </button>
  );
};
