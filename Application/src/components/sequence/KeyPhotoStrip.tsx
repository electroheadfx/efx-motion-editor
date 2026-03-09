import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import Sortable from 'sortablejs';
import {sequenceStore} from '../../stores/sequenceStore';
import {imageStore} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';

/** Key photo strip with thumbnails, hold duration editing, click-to-select + SortableJS drag reorder */
export function KeyPhotoStrip() {
  const activeSeq = sequenceStore.getActiveSequence();

  if (!activeSeq) {
    return (
      <div class="px-3 py-3 text-center">
        <span class="text-[10px] text-[var(--color-text-dim)]">
          Select a sequence to view key photos
        </span>
      </div>
    );
  }

  if (activeSeq.keyPhotos.length === 0) {
    return (
      <div class="px-3 py-3 text-center">
        <span class="text-[10px] text-[var(--color-text-dim)]">
          No key photos yet
        </span>
      </div>
    );
  }

  return (
    <div class="px-2 py-2">
      <KeyPhotoStripInner sequenceId={activeSeq.id} />
    </div>
  );
}

function KeyPhotoStripInner({sequenceId}: {sequenceId: string}) {
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
      class={`w-[72px] h-14 rounded-md relative shrink-0 bg-[#2A2A2A] bg-cover bg-center overflow-hidden cursor-pointer${isSelected ? ' ring-1 ring-[var(--color-accent)]' : ''}`}
      style={thumbUrl ? {backgroundImage: `url(${thumbUrl})`} : undefined}
      onClick={() => sequenceStore.selectKeyPhoto(keyPhotoId)}
    >
      {/* Placeholder icon when no image */}
      {!thumbUrl && (
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[10px] text-[#555]">?</span>
        </div>
      )}

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

export function AddKeyPhotoButton({sequenceId}: {sequenceId: string}) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  const importedImages = imageStore.images.value;

  // Close popover on click outside
  useEffect(() => {
    if (!popoverOpen) return;
    function handleClick(e: MouseEvent) {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [popoverOpen]);

  const handleAddImage = useCallback(
    (imageId: string) => {
      sequenceStore.addKeyPhoto(sequenceId, imageId, 4);
      setPopoverOpen(false);
    },
    [sequenceId],
  );

  return (
    <div class="relative shrink-0">
      <button
        class="w-5 h-5 rounded flex items-center justify-center bg-[#2A2A2A] text-[10px] text-[var(--color-text-secondary)] hover:bg-[#333] hover:text-white transition-colors"
        onClick={() => setPopoverOpen(!popoverOpen)}
        title="Add key photo from imported images"
      >
        +
      </button>

      {/* Image picker popover */}
      {popoverOpen && (
        <div
          ref={popRef}
          class="absolute right-0 top-7 z-50 bg-[#1E1E1E] border border-[#333] rounded-md shadow-xl p-2 min-w-[180px] max-w-[260px] max-h-[300px] overflow-y-auto"
        >
          {importedImages.length === 0 ? (
            <span class="text-[10px] text-[var(--color-text-dim)] block p-2">
              No imported images. Import images first.
            </span>
          ) : (
            <div class="grid grid-cols-4 gap-1">
              {importedImages.map((img) => (
                <button
                  key={img.id}
                  class="w-11 h-8 rounded bg-[#2A2A2A] bg-cover bg-center hover:ring-1 hover:ring-[var(--color-accent)] cursor-pointer"
                  style={{
                    backgroundImage: `url(${assetUrl(img.thumbnail_path)})`,
                  }}
                  onClick={() => handleAddImage(img.id)}
                  title={img.original_path.split('/').pop() ?? img.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
