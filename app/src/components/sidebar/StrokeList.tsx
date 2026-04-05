import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import {useSignal} from '@preact/signals';
import Sortable from 'sortablejs';
import {GripVertical, Eye, EyeOff, X, PenTool} from 'lucide-preact';
import {paintStore} from '../../stores/paintStore';
import {timelineStore} from '../../stores/timelineStore';
import {CollapsibleSection} from './CollapsibleSection';
import type {PaintElement} from '../../types/paint';

interface StrokeListProps {
  layerId: string;
}

function getElementLabel(el: PaintElement, index: number): string {
  const toolLabels: Record<string, string> = {
    brush: 'Brush',
    eraser: 'Eraser',
    line: 'Line',
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    fill: 'Fill',
  };
  return `${toolLabels[el.tool] || el.tool} ${index + 1}`;
}

export function StrokeList({layerId}: StrokeListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectionAnchor = useRef<number>(-1);

  const frame = timelineStore.currentFrame.value;
  paintStore.paintVersion.value; // subscribe to re-renders
  const paintFrame = paintStore.getFrame(layerId, frame);
  const elements = paintFrame?.elements ?? [];
  const selectedIds = paintStore.selectedStrokeIds.value;

  const displayElements = [...elements].reverse();
  const totalElements = elements.length;
  const strokesCollapsed = useSignal(false);

  // Custom scrollbar state
  const [thumbTop, setThumbTop] = useState(0);
  const [thumbHeight, setThumbHeight] = useState(0);
  const [isScrollable, setIsScrollable] = useState(false);
  const [isHovering, setIsHovering] = useState(false);

  const updateThumb = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const scrollable = scrollHeight > clientHeight + 1;
    setIsScrollable(scrollable);
    if (!scrollable) return;
    const ratio = clientHeight / scrollHeight;
    const th = Math.max(24, ratio * clientHeight);
    setThumbHeight(th);
    const scrollRange = scrollHeight - clientHeight;
    const thumbRange = clientHeight - th;
    setThumbTop(scrollRange > 0 ? (scrollTop / scrollRange) * thumbRange : 0);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [updateThumb, totalElements]);

  // SortableJS integration
  useEffect(() => {
    if (!listRef.current) return;
    const instance = Sortable.create(listRef.current, {
      animation: 150,
      ghostClass: 'opacity-30',
      handle: '.stroke-drag-handle',
      forceFallback: true,
      fallbackClass: 'opacity-30',
      onEnd(evt) {
        const {oldIndex, newIndex, item, from} = evt;
        if (oldIndex != null && newIndex != null && oldIndex !== newIndex) {
          // Revert SortableJS DOM mutation so Preact can re-render correctly
          from.removeChild(item);
          from.insertBefore(item, from.children[oldIndex] ?? null);
          // Convert visual indices (reversed) back to array indices
          const fromIdx = totalElements - 1 - oldIndex;
          const toIdx = totalElements - 1 - newIndex;
          paintStore.reorderElements(layerId, frame, fromIdx, toIdx);
          paintStore.refreshFrameFx(layerId, frame);
        }
      },
    });
    return () => instance.destroy();
  }, [totalElements, layerId, frame]);

  // Auto-scroll on canvas selection change
  useEffect(() => {
    const selected = selectedIds;
    if (selected.size > 0) {
      const firstId = [...selected][0];
      const row = listRef.current?.querySelector(`[data-element-id="${firstId}"]`);
      row?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    }
  }, [selectedIds]);

  const handleSelect = (elementId: string, displayIndex: number, e: MouseEvent) => {
    if (e.shiftKey && selectionAnchor.current >= 0) {
      // Shift+click: range select from anchor to clicked
      paintStore.clearSelection();
      const start = Math.min(selectionAnchor.current, displayIndex);
      const end = Math.max(selectionAnchor.current, displayIndex);
      for (let i = start; i <= end; i++) {
        const el = displayElements[i];
        if (el) paintStore.selectStroke(el.id);
      }
    } else if (e.metaKey) {
      // Cmd+click: toggle individual stroke
      if (selectedIds.has(elementId)) {
        paintStore.deselectStroke(elementId);
      } else {
        paintStore.selectStroke(elementId);
      }
      selectionAnchor.current = displayIndex;
    } else {
      // Plain click: select single stroke
      paintStore.clearSelection();
      paintStore.selectStroke(elementId);
      selectionAnchor.current = displayIndex;
    }
  };

  const handleToggleVisibility = (elementId: string) => {
    const el = elements.find(e => e.id === elementId);
    paintStore.setElementVisibility(layerId, frame, elementId, el?.visible === false);
    paintStore.refreshFrameFx(layerId, frame);
  };

  const handleDelete = (elementId: string) => {
    paintStore.removeElement(layerId, frame, elementId);
    paintStore.deselectStroke(elementId);
    paintStore.refreshFrameFx(layerId, frame);
  };

  const handleEditPath = (elementId: string) => {
    paintStore.clearSelection();
    paintStore.selectStroke(elementId);
    paintStore.activeTool.value = 'pen';
  };

  return (
    <CollapsibleSection
      title={`STROKES (${totalElements})`}
      collapsed={strokesCollapsed}
    >
      {totalElements === 0 ? (
        <div class="px-3 py-2 text-[10px]" style={{color: 'var(--sidebar-text-secondary)'}}>
          No strokes on this frame
        </div>
      ) : (
        <div
          class="relative max-h-48"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
        <div ref={listRef} class="flex flex-col gap-0.5 max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none' }} onScroll={updateThumb}>
          {displayElements.map((el, i) => {
            const isSelected = selectedIds.has(el.id);
            const isHidden = el.visible === false;
            const labelIndex = totalElements - 1 - i;
            return (
              <div
                key={el.id}
                class="group/row flex items-center gap-1.5 rounded px-2 py-1 cursor-pointer select-none"
                data-element-id={el.id}
                style={{
                  backgroundColor: isSelected ? 'var(--sidebar-selected-layer-bg)' : 'transparent',
                  opacity: isHidden ? 0.4 : 1,
                }}
                onClick={(e) => handleSelect(el.id, i, e as MouseEvent)}
              >
                {/* Drag handle */}
                <div class="stroke-drag-handle cursor-grab shrink-0 opacity-60 hover:opacity-100">
                  <GripVertical size={12} style={{color: 'var(--sidebar-resizer-icon)'}} />
                </div>

                {/* Visibility toggle */}
                <button
                  class="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-[#ffffff10]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleVisibility(el.id);
                  }}
                >
                  {isHidden ? (
                    <EyeOff size={12} style={{color: 'var(--sidebar-text-secondary)', opacity: 0.4}} />
                  ) : (
                    <Eye size={12} style={{color: 'var(--sidebar-text-secondary)'}} />
                  )}
                </button>

                {/* Color swatch */}
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{backgroundColor: el.color}}
                />

                {/* Label */}
                <span
                  class="flex-1 truncate text-[11px]"
                  style={{
                    color: isSelected ? 'var(--sidebar-text-primary)' : 'var(--sidebar-collapse-line)',
                  }}
                >
                  {getElementLabel(el, labelIndex)}
                </span>

                {/* Edit path button */}
                {(el.tool === 'brush' || el.tool === 'eraser' || el.tool === 'line' || el.tool === 'rect' || el.tool === 'ellipse') && (
                  <button
                    class="w-4 h-4 flex items-center justify-center rounded shrink-0 opacity-0 group-hover/row:opacity-100"
                    style={{color: 'var(--sidebar-text-secondary)'}}
                    title="Edit path"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditPath(el.id);
                    }}
                  >
                    <PenTool size={11} />
                  </button>
                )}

                {/* Delete button */}
                <button
                  class="w-4 h-4 flex items-center justify-center rounded shrink-0 opacity-0 group-hover/row:opacity-100"
                  style={{color: 'var(--sidebar-text-secondary)'}}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(el.id);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>
        {isScrollable && (
          <div
            class="absolute right-0 top-0 pointer-events-none transition-opacity duration-150"
            style={{
              width: '4px',
              height: `${thumbHeight}px`,
              transform: `translateY(${thumbTop}px)`,
              backgroundColor: 'var(--sidebar-scrollbar-thumb)',
              borderRadius: '2px',
              opacity: isHovering ? 0.7 : 0,
            }}
          />
        )}
        </div>
      )}
    </CollapsibleSection>
  );
}
