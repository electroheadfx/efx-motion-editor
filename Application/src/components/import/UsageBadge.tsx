import type {FunctionalComponent} from 'preact';

interface UsageBadgeProps {
  count: number;
  onClick: (e: MouseEvent) => void;
  /** 'thumbnail' for image/video grid items, 'inline' for audio list items */
  layout?: 'thumbnail' | 'inline';
}

export const UsageBadge: FunctionalComponent<UsageBadgeProps> = ({count, onClick, layout = 'thumbnail'}) => {
  // Color thresholds per D-02 / UI-SPEC:
  // 0: green (safe to remove), 1-2: yellow (low), 3-5: orange (medium), 6+: red (heavy)
  const bgColor = count === 0 ? 'var(--color-dot-green)'
    : count <= 2 ? 'var(--color-dot-yellow)'
    : count <= 5 ? 'var(--color-dot-orange)'
    : 'var(--color-usage-badge-red)';

  const textColor = count <= 2 ? '#000000' : '#FFFFFF';

  // Per UI-SPEC: thumbnail = absolute top-1 right-1, inline = ml-auto flex item
  const positionClass = layout === 'thumbnail'
    ? 'absolute top-1 right-1 z-10'
    : 'ml-auto shrink-0';

  return (
    <button
      class={`${positionClass} min-w-[18px] h-[18px] rounded-full flex items-center justify-center cursor-pointer`}
      style={{
        backgroundColor: bgColor,
        color: textColor,
        fontSize: '9px',
        fontWeight: 600,
        lineHeight: '1',
        padding: '0 4px',
        border: 'none',
        filter: 'brightness(1)',  // base for hover transition
        transition: 'filter 100ms',
      }}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onClick(e);
      }}
      onMouseEnter={(e: MouseEvent) => {
        (e.currentTarget as HTMLElement).style.filter = 'brightness(1.15)';
      }}
      onMouseLeave={(e: MouseEvent) => {
        (e.currentTarget as HTMLElement).style.filter = 'brightness(1)';
      }}
      title={`Used ${count} time${count !== 1 ? 's' : ''}`}
    >
      {count}
    </button>
  );
};
