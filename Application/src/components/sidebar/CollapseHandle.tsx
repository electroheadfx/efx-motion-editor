import { uiStore } from '../../stores/uiStore';

export function CollapseHandle() {
  return (
    <div
      class="absolute top-0 right-0 w-5 h-full flex items-center justify-end cursor-pointer z-20 group"
      onClick={() => uiStore.toggleSidebar()}
      title={uiStore.sidebarCollapsed.value ? 'Expand sidebar' : 'Collapse sidebar'}
    >
      {/* Double lines: 10% height, vertically centered */}
      <div class="flex gap-[4px] items-center" style={{ height: '10%' }}>
        <div
          class="h-full rounded-full transition-opacity duration-150 group-hover:opacity-100"
          style={{
            width: '1.5px',
            backgroundColor: 'var(--sidebar-collapse-line)',
            opacity: 0.6,
          }}
        />
        <div
          class="h-full rounded-full transition-opacity duration-150 group-hover:opacity-100"
          style={{
            width: '1.5px',
            backgroundColor: 'var(--sidebar-collapse-line)',
            opacity: 0.6,
          }}
        />
      </div>
    </div>
  );
}
