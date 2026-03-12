import {useRef, useEffect} from 'preact/hooks';
import Sortable from 'sortablejs';
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
        <span class="text-[10px] text-[var(--color-text-dim)]">No active sequence</span>
      </div>
    );
  }

  return (
    <div class="flex flex-col flex-1 min-h-0 overflow-y-auto p-2">
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

  // Color-coded type indicator
  const typeColor =
    layer.type === 'image-sequence' ? '#3B82F6'          // blue
    : layer.type === 'static-image' ? '#14B8A6'          // teal
    : layer.type === 'video' ? '#8B5CF6'                 // purple
    : 'var(--color-text-secondary)';

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
      class={`${isBase ? 'layer-base' : ''} flex items-center gap-2 rounded-md px-2.5 py-1.5 h-[36px] cursor-pointer select-none ${
        isSelected
          ? 'bg-[var(--color-bg-selected)] border-l-2 border-[var(--color-accent)]'
          : isBase
            ? 'bg-[var(--color-bg-input)]'
            : 'bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-hover-item)]'
      }`}
      onClick={handleSelect}
    >
      {/* Drag handle -- hidden for base layer */}
      {!isBase ? (
        <div class="layer-drag-handle w-2 h-4 flex flex-col justify-center gap-[2px] cursor-grab shrink-0 opacity-40 hover:opacity-70">
          <div class="w-full h-[1px] bg-[var(--color-text-secondary)]" />
          <div class="w-full h-[1px] bg-[var(--color-text-secondary)]" />
          <div class="w-full h-[1px] bg-[var(--color-text-secondary)]" />
        </div>
      ) : (
        <div class="w-2 shrink-0" />
      )}

      {/* Visibility toggle */}
      <button
        class="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-[var(--color-hover-overlay-strong)]"
        onClick={handleToggleVisibility}
        title={layer.visible ? 'Hide layer' : 'Show layer'}
      >
        <span class="text-[10px] leading-none" style={{color: layer.visible ? 'var(--color-text-button)' : 'var(--color-text-dim)'}}>
          {layer.visible ? '\u25CF' : '\u25CB'}
        </span>
      </button>

      {/* Color-coded type indicator */}
      <div
        class="w-2.5 h-2.5 rounded-sm shrink-0"
        style={{backgroundColor: typeColor}}
      />

      {/* Name and type label */}
      <div class="flex flex-col gap-0 flex-1 min-w-0">
        <span
          class={`text-[11px] truncate leading-tight ${
            isBase ? 'text-[var(--color-text-heading)] font-medium' : 'text-[var(--color-text-link)]'
          }`}
        >
          {layer.name}
        </span>
        <span class="text-[9px] text-[var(--color-text-dim)] truncate leading-tight">
          {typeLabel}
          {isBase && ' \u00B7 Locked'}
        </span>
      </div>

      {/* Delete button -- only for non-base layers */}
      {!isBase ? (
        <button
          class="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-hover-overlay-strong)] text-[var(--color-text-dim)] hover:text-[var(--color-error-text)] shrink-0"
          onClick={handleDelete}
          title="Delete layer"
        >
          <span class="text-[10px] leading-none">&times;</span>
        </button>
      ) : (
        <div class="w-5 shrink-0 flex items-center justify-center">
          <span class="text-[9px] text-[var(--color-text-dim)]" title="Base layer (locked)">
            &#x1F512;
          </span>
        </div>
      )}
    </div>
  );
}
