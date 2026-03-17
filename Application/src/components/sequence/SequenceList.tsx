import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import Sortable from 'sortablejs';
import {GripVertical, Ellipsis, Clapperboard} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {imageStore} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';
import {KeyPhotoStripInline, AddKeyPhotoButton} from './KeyPhotoStrip';
import type {Sequence} from '../../types/sequence';

/** Sortable sequence list with drag reorder, context actions, inline rename */
export function SequenceList() {
  const listRef = useRef<HTMLDivElement>(null);
  const allSequences = sequenceStore.sequences.value;
  const sequences = allSequences.filter(s => s.kind !== 'fx');
  const activeId = uiStore.selectedSequenceId.value;

  // SortableJS integration — recreate when items added/removed to keep DOM refs fresh
  useEffect(() => {
    if (!listRef.current) return;
    const instance = Sortable.create(listRef.current, {
      animation: 150,
      ghostClass: 'opacity-30',
      handle: '.seq-drag-handle',
      forceFallback: true,
      fallbackClass: 'opacity-30',
      onEnd(evt) {
        const { oldIndex, newIndex, item, from } = evt;
        if (oldIndex != null && newIndex != null && oldIndex !== newIndex) {
          // Revert SortableJS DOM mutation so Preact can re-render correctly
          from.removeChild(item);
          from.insertBefore(item, from.children[oldIndex] ?? null);
          // Map filtered (content-only) indices back to full sequences array
          const contentSeqs = sequenceStore.sequences.peek().filter(s => s.kind !== 'fx');
          const movedSeq = contentSeqs[oldIndex];
          const targetSeq = contentSeqs[newIndex];
          if (movedSeq && targetSeq) {
            const allSeqs = sequenceStore.sequences.peek();
            const actualOld = allSeqs.findIndex(s => s.id === movedSeq.id);
            const actualNew = allSeqs.findIndex(s => s.id === targetSeq.id);
            if (actualOld !== -1 && actualNew !== -1) {
              sequenceStore.reorderSequences(actualOld, actualNew);
            }
          }
        }
      },
    });
    return () => instance.destroy();
  }, [sequences.length]);

  return (
    <div ref={listRef} class="flex flex-col gap-1.5 flex-1 min-h-0 p-1.5">
      {sequences.map((seq) => (
        <SequenceItem
          key={seq.id}
          seq={seq}
          isActive={seq.id === activeId}
        />
      ))}
    </div>
  );
}

interface SequenceItemProps {
  seq: Sequence;
  isActive: boolean;
}

function SequenceItem({seq, isActive}: SequenceItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({top: 0, left: 0});
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(seq.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasSelectedKeyPhoto = sequenceStore.selectedKeyPhotoId.value !== null;

  const keyCount = seq.keyPhotos.length;
  const totalFrames = seq.keyPhotos.reduce(
    (sum, kp) => sum + kp.holdFrames,
    0,
  );
  const duration = keyCount > 0 ? (totalFrames / seq.fps).toFixed(1) : '0.0';

  // Get first key photo thumbnail if available
  const firstKp = seq.keyPhotos[0];
  const firstImage = firstKp ? imageStore.getById(firstKp.imageId) : undefined;
  const thumbUrl = firstImage
    ? assetUrl(firstImage.thumbnail_path)
    : null;

  // Close menu on click outside
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  // Focus input when editing starts
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // isActive derived from uiStore.selectedSequenceId — preserves scrub auto-select:
  // TimelineInteraction.ts calls uiStore.selectSequence() on scrub release,
  // which updates selectedSequenceId signal and triggers key photo collapse/expand
  const handleSelect = useCallback(() => {
    if (!editing) {
      layerStore.setSelected(null);
      uiStore.selectLayer(null);
      uiStore.selectSequence(seq.id);
      sequenceStore.setActive(seq.id);
      sequenceStore.clearKeyPhotoSelection();
    }
  }, [seq.id, editing]);

  const startRename = useCallback(() => {
    setEditName(seq.name);
    setEditing(true);
    setMenuOpen(false);
  }, [seq.name]);

  const commitRename = useCallback(() => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== seq.name) {
      sequenceStore.rename(seq.id, trimmed);
    }
    setEditing(false);
  }, [editName, seq.id, seq.name]);

  const handleDuplicate = useCallback(() => {
    sequenceStore.duplicate(seq.id);
    setMenuOpen(false);
  }, [seq.id]);

  const handleDelete = useCallback(() => {
    setMenuOpen(false);
    if (
      seq.keyPhotos.length > 0 &&
      !window.confirm(
        `Delete "${seq.name}"? It has ${seq.keyPhotos.length} key photo(s).`,
      )
    ) {
      return;
    }
    sequenceStore.remove(seq.id);
  }, [seq.id, seq.name, seq.keyPhotos.length]);

  /** Compute menu position from the action button (or fallback to event coords) */
  const openMenu = useCallback((fallbackX?: number, fallbackY?: number) => {
    if (menuBtnRef.current) {
      const rect = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({top: rect.bottom + 2, left: rect.right - 120});
    } else if (fallbackX != null && fallbackY != null) {
      setMenuPos({top: fallbackY, left: fallbackX});
    }
    setMenuOpen(true);
  }, []);

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      if (menuOpen) {
        setMenuOpen(false);
      } else {
        openMenu(e.clientX, e.clientY);
      }
    },
    [menuOpen, openMenu],
  );

  return (
    <div
      class="rounded-lg overflow-hidden select-none"
      style={{
        border: `1px solid var(${isActive ? '--sidebar-border-selected' : '--sidebar-border-unselected'})`,
        backgroundColor: isActive ? 'var(--sidebar-selected-group-bg)' : 'var(--sidebar-panel-bg)',
        opacity: isActive ? 1 : 0.5,
      }}
    >
      {/* Sequence row */}
      <div
        class="flex items-center gap-2 h-10 w-full px-3 cursor-pointer"
        style={{
          backgroundColor: isActive ? 'var(--sidebar-selected-row-bg)' : 'transparent',
          borderLeft: isActive && !hasSelectedKeyPhoto ? '2px solid var(--color-accent)' : '2px solid transparent',
        }}
        onClick={handleSelect}
        onContextMenu={handleContextMenu}
      >
        {/* Left accent bar (only when active) */}
        {isActive && (
          <div class="shrink-0" style={{width: '4px', height: '24px', borderRadius: '2px', backgroundColor: 'var(--sidebar-accent-bar)'}} />
        )}

        {/* Drag handle */}
        <div class="seq-drag-handle cursor-grab shrink-0 opacity-60 hover:opacity-100">
          <GripVertical size={14} style={{color: 'var(--sidebar-resizer-icon)'}} />
        </div>

        {/* Thumbnail */}
        <div
          class="shrink-0 rounded bg-cover bg-center relative overflow-hidden"
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '4px',
            backgroundColor: 'var(--sidebar-input-bg)',
            ...(thumbUrl ? {backgroundImage: `url(${thumbUrl})`} : {}),
          }}
        >
          <div class="absolute bottom-0 right-0" style={{ padding: '3px', background: '#00000088', borderRadius: '4px' }}>
            <Clapperboard size={12} color="white" />
          </div>
        </div>

        {/* Name and meta */}
        <div class="flex flex-col gap-0.5 flex-1 min-w-0">
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              class="bg-[var(--sidebar-input-bg)] border border-[var(--sidebar-border-selected)] rounded px-1 py-0 outline-none w-full"
              style={{fontSize: '14px', fontWeight: 600, color: 'var(--sidebar-text-primary)'}}
              value={editName}
              onInput={(e) =>
                setEditName((e.target as HTMLInputElement).value)
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              class="truncate"
              style={{fontSize: '14px', fontWeight: 600, color: 'var(--sidebar-text-primary)'}}
              onDblClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
            >
              {seq.name}
            </span>
          )}
          <span style={{fontSize: '11px', fontWeight: 400, color: 'var(--sidebar-text-secondary)'}}>
            {keyCount} keys &middot; {duration}s
          </span>
        </div>

        {/* Action button */}
        <button
          ref={menuBtnRef}
          class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#ffffff10] shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            if (menuOpen) {
              setMenuOpen(false);
            } else {
              openMenu();
            }
          }}
        >
          <Ellipsis size={14} style={{color: 'var(--sidebar-text-secondary)'}} />
        </button>

        {/* Context Menu -- rendered via portal to avoid scrollbar from overflow container */}
        {menuOpen && createPortal(
          <div
            ref={menuRef}
            class="fixed z-50 rounded-md shadow-xl py-1 min-w-[120px]"
            style={{top: menuPos.top, left: menuPos.left, backgroundColor: 'var(--sidebar-panel-bg)', border: '1px solid var(--sidebar-border-unselected)'}}
          >
            <button
              class="w-full text-left px-3 py-1.5 text-xs hover:bg-[#ffffff10]"
              style={{color: 'var(--sidebar-text-button)'}}
              onClick={(e) => {
                e.stopPropagation();
                startRename();
              }}
            >
              Rename
            </button>
            <button
              class="w-full text-left px-3 py-1.5 text-xs hover:bg-[#ffffff10]"
              style={{color: 'var(--sidebar-text-button)'}}
              onClick={(e) => {
                e.stopPropagation();
                handleDuplicate();
              }}
            >
              Duplicate
            </button>
            <div class="w-full h-px my-1" style={{backgroundColor: 'var(--sidebar-border-unselected)'}} />
            <button
              class="w-full text-left px-3 py-1.5 text-xs text-[var(--color-error-text)] hover:bg-[#ffffff10]"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete();
              }}
            >
              Delete
            </button>
          </div>,
          document.body,
        )}
      </div>

      {/* Inline key photos -- only for active sequence */}
      <div
        class="overflow-hidden transition-[max-height] duration-150 ease-out"
        style={{
          maxHeight: isActive && seq.keyPhotos.length > 0 ? '72px' : '0px',
        }}
      >
        <div class="px-2 py-1.5 flex items-center gap-1">
          <div class="flex-1 min-w-0 overflow-hidden">
            <KeyPhotoStripInline sequenceId={seq.id} />
          </div>
          <AddKeyPhotoButton sequenceId={seq.id} />
        </div>
      </div>
    </div>
  );
}
