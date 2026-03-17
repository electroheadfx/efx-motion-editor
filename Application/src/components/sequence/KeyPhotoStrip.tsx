import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import Sortable from 'sortablejs';
import {Plus, X} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {imageStore} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';

/** Key photo strip with thumbnails, hold duration editing, click-to-select + SortableJS drag reorder */
export function KeyPhotoStrip() {
  const activeSeq = sequenceStore.getActiveSequence();

  if (!activeSeq) {
    return (
      <div class="px-3 py-3 text-center">
        <span class="text-[10px]" style={{color: 'var(--sidebar-text-secondary)'}}>
          Select a sequence to view key photos
        </span>
      </div>
    );
  }

  if (activeSeq.keyPhotos.length === 0) {
    return (
      <div class="px-3 py-3 text-center">
        <span class="text-[10px]" style={{color: 'var(--sidebar-text-secondary)'}}>
          No key photos yet
        </span>
      </div>
    );
  }

  return (
    <div class="px-2 py-2">
      <KeyPhotoStripInline sequenceId={activeSeq.id} />
    </div>
  );
}

/** Inline key photo strip rendered inside a SequenceItem card */
export function KeyPhotoStripInline({sequenceId}: {sequenceId: string}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const activeSeq = sequenceStore.getById(sequenceId);
  const keyPhotos = activeSeq?.keyPhotos ?? [];

  // Convert vertical wheel to horizontal scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!stripRef.current) return;
    if (e.deltaY !== 0) {
      e.preventDefault();
      stripRef.current.scrollLeft += e.deltaY;
    }
  }, []);

  // SortableJS drag-and-drop reorder
  useEffect(() => {
    if (!stripRef.current) return;
    const instance = Sortable.create(stripRef.current, {
      animation: 150,
      ghostClass: 'opacity-30',
      forceFallback: true,
      fallbackClass: 'opacity-30',
      direction: 'horizontal',
      onEnd(evt) {
        const { oldIndex, newIndex, item, from } = evt;
        if (oldIndex != null && newIndex != null && oldIndex !== newIndex) {
          // Revert SortableJS DOM mutation so Preact can re-render correctly
          from.removeChild(item);
          from.insertBefore(item, from.children[oldIndex] ?? null);
          sequenceStore.reorderKeyPhotos(sequenceId, oldIndex, newIndex);
        }
      },
    });
    return () => instance.destroy();
  }, [keyPhotos.length, sequenceId]);

  return (
    <div
      ref={stripRef}
      class="flex gap-1 overflow-x-auto scrollbar-hidden pb-1"
      onWheel={handleWheel}
    >
      {keyPhotos.map((kp) => (
        <KeyPhotoCard
          key={kp.id}
          sequenceId={sequenceId}
          keyPhotoId={kp.id}
          imageId={kp.imageId}
          holdFrames={kp.holdFrames}
        />
      ))}
    </div>
  );
}

interface KeyPhotoCardProps {
  sequenceId: string;
  keyPhotoId: string;
  imageId: string;
  holdFrames: number;
}

function KeyPhotoCard({
  sequenceId,
  keyPhotoId,
  imageId,
  holdFrames,
}: KeyPhotoCardProps) {
  const [editingFrames, setEditingFrames] = useState(false);
  const [frameValue, setFrameValue] = useState(String(holdFrames));
  const inputRef = useRef<HTMLInputElement>(null);
  const image = imageStore.getById(imageId);
  const thumbUrl = image ? assetUrl(image.thumbnail_path) : null;
  const isSelected = sequenceStore.selectedKeyPhotoId.value === keyPhotoId;
  const anySelected = sequenceStore.selectedKeyPhotoId.value !== null;

  useEffect(() => {
    if (editingFrames && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingFrames]);

  const commitFrames = useCallback(() => {
    const parsed = parseInt(frameValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 999 && parsed !== holdFrames) {
      sequenceStore.updateHoldFrames(sequenceId, keyPhotoId, parsed);
    }
    setEditingFrames(false);
  }, [frameValue, holdFrames, sequenceId, keyPhotoId]);

  return (
    <div
      class={`group h-14 rounded-md relative shrink-0 bg-cover bg-center overflow-hidden cursor-pointer${isSelected ? ' ring-2 ring-[var(--color-accent)]' : ''}`}
      style={{
        width: 'auto',
        minWidth: '56px',
        height: '56px',
        backgroundColor: 'var(--sidebar-input-bg)',
        opacity: !isSelected && anySelected ? 0.4 : 1,
        ...(thumbUrl ? {backgroundImage: `url(${thumbUrl})`, aspectRatio: 'auto'} : {}),
      }}
      onClick={() => sequenceStore.selectKeyPhoto(keyPhotoId)}
    >
      {/* Placeholder icon when no image */}
      {!thumbUrl && (
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[10px]" style={{color: 'var(--sidebar-text-secondary)'}}>?</span>
        </div>
      )}

      {/* Delete button on hover */}
      <button
        class="absolute top-0.5 right-0.5 w-3.5 h-3.5 flex items-center justify-center bg-[#000000AA] rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          sequenceStore.removeKeyPhoto(sequenceId, keyPhotoId);
        }}
        title="Remove key photo"
      >
        <X size={10} color="white" />
      </button>

      {/* Hold frames badge */}
      {editingFrames ? (
        <input
          ref={inputRef}
          type="number"
          min={1}
          max={999}
          class="absolute bottom-0.5 right-0.5 w-8 text-[9px] bg-[#000000CC] text-white rounded px-0.5 py-0 outline-none border border-[var(--color-accent)]"
          value={frameValue}
          onInput={(e) =>
            setFrameValue((e.target as HTMLInputElement).value)
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitFrames();
            if (e.key === 'Escape') setEditingFrames(false);
          }}
          onBlur={commitFrames}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          class="absolute bottom-0.5 right-0.5 text-[9px] bg-[#00000080] text-white rounded px-1 py-0 cursor-pointer hover:bg-[#000000AA]"
          onClick={(e) => {
            e.stopPropagation();
            setFrameValue(String(holdFrames));
            setEditingFrames(true);
          }}
          title="Click to edit hold frames"
        >
          {holdFrames}f
        </button>
      )}
    </div>
  );
}

/** Add key photo button -- opens full imported view */
export function AddKeyPhotoButton({sequenceId: _sequenceId}: {sequenceId: string}) {
  return (
    <button
      class="flex items-center justify-center shrink-0 hover:brightness-125 transition-colors"
      style={{
        width: '24px',
        height: '56px',
        backgroundColor: '#3A3A50',
        borderRadius: '4px',
        color: 'var(--sidebar-text-secondary)',
      }}
      onClick={() => uiStore.setEditorMode('imported')}
      aria-label="Add key photo"
      title="Add key photo from imported images"
    >
      <Plus size={14} />
    </button>
  );
}
