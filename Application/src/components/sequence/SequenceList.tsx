import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import Sortable from 'sortablejs';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {imageStore} from '../../stores/imageStore';
import {timelineStore} from '../../stores/timelineStore';
import {trackLayouts} from '../../lib/frameMap';
import {assetUrl} from '../../lib/ipc';
import type {Sequence} from '../../types/sequence';

/** Sortable sequence list with drag reorder, context actions, inline rename */
export function SequenceList() {
  const listRef = useRef<HTMLDivElement>(null);
  const sequences = sequenceStore.sequences.value;
  const activeId = uiStore.selectedSequenceId.value;

  // SortableJS integration — recreate when items added/removed to keep DOM refs fresh
  useEffect(() => {
    if (!listRef.current) return;
    const instance = Sortable.create(listRef.current, {
      animation: 150,
      ghostClass: 'opacity-30',
      handle: '.seq-drag-handle',
      onEnd(evt) {
        const { oldIndex, newIndex, item, from } = evt;
        if (oldIndex != null && newIndex != null && oldIndex !== newIndex) {
          // Revert SortableJS DOM mutation so Preact can re-render correctly
          from.removeChild(item);
          from.insertBefore(item, from.children[oldIndex] ?? null);
          sequenceStore.reorderSequences(oldIndex, newIndex);
        }
      },
    });
    return () => instance.destroy();
  }, [sequences.length]);

  return (
    <div ref={listRef} class="flex flex-col gap-px flex-1 min-h-0 overflow-y-auto">
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
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(seq.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const handleSelect = useCallback(() => {
    if (!editing) {
      uiStore.selectSequence(seq.id);
      sequenceStore.setActive(seq.id);
      // Seek playhead to this sequence's start frame so preview shows the right content
      const track = trackLayouts.peek().find((t) => t.sequenceId === seq.id);
      if (track) {
        timelineStore.seek(track.startFrame);
      }
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

  const handleContextMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      setMenuOpen(!menuOpen);
    },
    [menuOpen],
  );

  return (
    <div
      class={`relative flex items-center gap-2 h-10 w-full px-3 cursor-pointer select-none ${
        isActive ? 'bg-[#2D5BE320]' : 'bg-transparent hover:bg-[#ffffff08]'
      }`}
      onClick={handleSelect}
      onContextMenu={handleContextMenu}
    >
      {/* Drag handle */}
      <div class="seq-drag-handle w-2 h-4 flex flex-col justify-center gap-[2px] cursor-grab shrink-0 opacity-40 hover:opacity-70">
        <div class="w-full h-[1px] bg-[#888]" />
        <div class="w-full h-[1px] bg-[#888]" />
        <div class="w-full h-[1px] bg-[#888]" />
      </div>

      {/* Active indicator */}
      {isActive && (
        <div class="w-[3px] h-6 rounded-sm bg-[var(--color-accent)] shrink-0" />
      )}

      {/* Thumbnail */}
      <div
        class={`w-7 h-5 rounded-[3px] shrink-0 bg-cover bg-center ${
          isActive ? 'bg-[#3D3D3D]' : 'bg-[#2A2A2A]'
        }`}
        style={thumbUrl ? {backgroundImage: `url(${thumbUrl})`} : undefined}
      />

      {/* Name and meta */}
      <div class="flex flex-col gap-0.5 flex-1 min-w-0">
        {editing ? (
          <input
            ref={inputRef}
            type="text"
            class="text-xs bg-[#1A1A1A] border border-[var(--color-accent)] rounded px-1 py-0 text-[#E0E0E0] outline-none w-full"
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
            class={`text-xs truncate ${
              isActive
                ? 'font-medium text-[#E0E0E0]'
                : 'text-[var(--color-text-secondary)]'
            }`}
            onDblClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            {seq.name}
          </span>
        )}
        <span
          class={`text-[10px] ${
            isActive
              ? 'text-[var(--color-text-muted)]'
              : 'text-[var(--color-text-dim)]'
          }`}
        >
          {keyCount} keys &middot; {duration}s
        </span>
      </div>

      {/* Action button */}
      <button
        class="w-5 h-5 flex items-center justify-center rounded hover:bg-[#ffffff15] text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
      >
        <span class="text-xs leading-none">...</span>
      </button>

      {/* Context Menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          class="absolute right-2 top-9 z-50 bg-[#1E1E1E] border border-[#333] rounded-md shadow-xl py-1 min-w-[120px]"
        >
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10]"
            onClick={(e) => {
              e.stopPropagation();
              startRename();
            }}
          >
            Rename
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10]"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicate();
            }}
          >
            Duplicate
          </button>
          <div class="w-full h-px bg-[#333] my-1" />
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#FF6666] hover:bg-[#ffffff10]"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
