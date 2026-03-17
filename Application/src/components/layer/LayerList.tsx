import {useRef, useEffect} from 'preact/hooks';
import Sortable from 'sortablejs';
import {GripVertical, Eye, EyeOff, X, Lock} from 'lucide-preact';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import type {Layer} from '../../types/layer';

/** SortableJS-powered layer list with drag-and-drop reorder, visibility toggle, delete, and selection */
export function LayerList() {
  const listRef = useRef<HTMLDivElement>(null);
  const layers = layerStore.layers.value;
  const selectedId = layerStore.selectedLayerId.value;

  // Reverse for display: topmost layer visually at top, base at bottom
  const displayLayers = [...layers].reverse();
  const totalLayers = layers.length;

  // SortableJS integration (content layers only)
  useEffect(() => {
    if (!listRef.current) return;
    const instance = Sortable.create(listRef.current, {
      animation: 150,
      ghostClass: 'opacity-30',
      handle: '.layer-drag-handle',
      filter: '.layer-base',
      forceFallback: true,
      fallbackClass: 'opacity-30',
      onMove(evt) {
        // Prevent dropping anything onto the base layer position
        if (evt.related.classList.contains('layer-base')) {
          return false;
        }
        return true;
      },
      onEnd(evt) {
        const { oldIndex, newIndex, item, from } = evt;
        if (oldIndex != null && newIndex != null && oldIndex !== newIndex) {
          // Revert SortableJS DOM mutation so Preact can re-render correctly
          from.removeChild(item);
          from.insertBefore(item, from.children[oldIndex] ?? null);
          // Convert visual indices (reversed) back to array indices
          const fromIdx = totalLayers - 1 - oldIndex;
          const toIdx = totalLayers - 1 - newIndex;
          layerStore.reorder(fromIdx, toIdx);
        }
      },
    });
    return () => instance.destroy();
  }, [totalLayers]);

  if (layers.length === 0) {
    return (
      <div class="flex items-center justify-center py-4">
        <span style={{fontSize: '10px', color: 'var(--sidebar-text-secondary)'}}>No active sequence</span>
      </div>
    );
  }

  return (
    <div class="flex flex-col flex-1 min-h-0 p-2">
      {/* Content layers (SortableJS container) */}
      <div ref={listRef} class="flex flex-col gap-0.5">
        {displayLayers.map((layer) => (
          <LayerRow
            key={layer.id}
            layer={layer}
            isSelected={selectedId === layer.id}
          />
        ))}
      </div>

    </div>
  );
}

interface LayerRowProps {
  layer: Layer;
  isSelected: boolean;
}

function LayerRow({layer, isSelected}: LayerRowProps) {
  const isBase = layer.isBase ?? false;

  // Color-coded type indicator using sidebar variables
  const typeColor =
    layer.type === 'image-sequence' ? 'var(--sidebar-dot-blue)'
    : layer.type === 'static-image' ? 'var(--sidebar-dot-green)'
    : layer.type === 'video' ? '#8B5CF6'
    : 'var(--sidebar-text-secondary)';

  // Type label
  const typeLabel =
    layer.type === 'video' ? 'Video'
    : layer.type === 'image-sequence' ? 'Sequence'
    : layer.type === 'static-image' ? 'Image'
    : 'Layer';

  const handleSelect = () => {
    layerStore.setSelected(layer.id);
    uiStore.selectLayer(layer.id);
  };

  const handleToggleVisibility = (e: MouseEvent) => {
    e.stopPropagation();
    layerStore.updateLayer(layer.id, {visible: !layer.visible});
  };

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    layerStore.remove(layer.id);
  };

  return (
    <div
      class={`${isBase ? 'layer-base' : ''} flex items-center gap-2 rounded-md px-2.5 py-1.5 h-[44px] cursor-pointer select-none`}
      style={{
        backgroundColor: isSelected
          ? 'var(--sidebar-selected-layer-bg)'
          : 'transparent',
      }}
      onClick={handleSelect}
    >
      {/* Drag handle -- hidden for base layer */}
      {!isBase ? (
        <div class="layer-drag-handle cursor-grab shrink-0 opacity-60 hover:opacity-100">
          <GripVertical size={14} style={{color: 'var(--sidebar-resizer-icon)'}} />
        </div>
      ) : (
        <div class="w-[14px] shrink-0" />
      )}

      {/* Visibility toggle */}
      <button
        class="w-5 h-5 flex items-center justify-center shrink-0 rounded hover:bg-[#ffffff10]"
        onClick={handleToggleVisibility}
        title={layer.visible ? 'Hide layer' : 'Show layer'}
      >
        {layer.visible ? (
          <Eye size={14} style={{color: 'var(--sidebar-text-secondary)'}} />
        ) : (
          <EyeOff size={14} style={{color: 'var(--sidebar-text-secondary)', opacity: 0.4}} />
        )}
      </button>

      {/* Color-coded type indicator */}
      <div
        class="w-2 h-2 rounded-full shrink-0"
        style={{backgroundColor: typeColor}}
      />

      {/* Name and type label */}
      <div class="flex flex-col gap-0 flex-1 min-w-0">
        <span
          class="truncate leading-tight"
          style={{fontSize: '13px', fontWeight: 500, color: 'var(--sidebar-text-primary)'}}
        >
          {layer.name}
        </span>
        <span
          class="truncate leading-tight"
          style={{fontSize: '11px', fontWeight: 400, color: 'var(--sidebar-text-secondary)'}}
        >
          {typeLabel}
          {isBase && ' . Locked'}
        </span>
      </div>

      {/* Delete button -- only for non-base layers */}
      {!isBase ? (
        <button
          class="w-5 h-5 flex items-center justify-center rounded shrink-0"
          style={{color: 'var(--sidebar-text-secondary)'}}
          onClick={handleDelete}
          title="Delete layer"
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--color-error-text)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-secondary)')}
        >
          <X size={14} />
        </button>
      ) : (
        <div class="w-5 shrink-0 flex items-center justify-center">
          <Lock size={12} style={{color: 'var(--sidebar-lock-icon)'}} />
        </div>
      )}
    </div>
  );
}
