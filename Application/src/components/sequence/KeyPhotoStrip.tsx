import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import Sortable from 'sortablejs';
import {Camera, Square, Blend, Pipette, X} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {imageStore} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';
import {trackLayouts} from '../../lib/frameMap';
import {playbackEngine} from '../../lib/playbackEngine';
import {getTopLayerId} from '../../lib/layerSelection';
import {getActiveKeyPhotoIndex} from '../../lib/keyPhotoNav';

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
        <button
          class="text-[10px] hover:underline cursor-pointer"
          style={{ color: 'var(--color-accent)' }}
          onClick={() => uiStore.setEditorMode('imported')}
        >
          + Add photos
        </button>
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

  // Read displayFrame for auto-scroll (only changes when NOT playing, or on stop)
  const displayFrame = timelineStore.displayFrame.value;

  // Compute active key photo index from displayFrame
  const layouts = trackLayouts.peek();
  const track = layouts.find(t => t.sequenceId === sequenceId);
  const activeKpIndex = track ? getActiveKeyPhotoIndex(track.keyPhotoRanges, displayFrame) : -1;

  // Auto-scroll strip to keep active key photo visible
  useEffect(() => {
    // Only auto-scroll when NOT playing
    if (timelineStore.isPlaying.peek()) return;
    if (!stripRef.current) return;

    const currentLayouts = trackLayouts.peek();
    const currentTrack = currentLayouts.find(t => t.sequenceId === sequenceId);
    if (!currentTrack) return;

    const kpIndex = getActiveKeyPhotoIndex(currentTrack.keyPhotoRanges, displayFrame);
    if (kpIndex < 0) return;

    const child = stripRef.current.children[kpIndex] as HTMLElement;
    if (child) {
      child.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [displayFrame, sequenceId]);

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
      class="flex gap-1 overflow-x-auto scrollbar-hidden p-0.5"
      onWheel={handleWheel}
      onClick={() => {
        sequenceStore.clearKeyPhotoSelection();
      }}
    >
      {keyPhotos.map((kp, index) => (
        <KeyPhotoCard
          key={kp.id}
          sequenceId={sequenceId}
          keyPhotoId={kp.id}
          imageId={kp.imageId}
          holdFrames={kp.holdFrames}
          isActiveByFrame={index === activeKpIndex}
          solidColor={kp.solidColor}
          isTransparent={kp.isTransparent}
        />
      ))}
    </div>
  );
}

/** Color picker popover with native input + hex text field (per D-13, D-14, D-15) */
interface ColorPickerPopoverProps {
  color: string;
  onLiveChange: (color: string) => void;
  onCommit: (color: string) => void;
  onClose: () => void;
}

function ColorPickerPopover({color, onLiveChange, onCommit, onClose}: ColorPickerPopoverProps) {
  const [hexValue, setHexValue] = useState(color);
  const popoverRef = useRef<HTMLDivElement>(null);
  const initialColor = useRef(color);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (hexValue !== initialColor.current) {
          onCommit(hexValue);
        }
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, onCommit, hexValue]);

  // Close on Escape (revert to initial)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onLiveChange(initialColor.current);
        onClose();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, onLiveChange]);

  // Sync hex display when color prop changes externally
  useEffect(() => {
    setHexValue(color);
  }, [color]);

  const handleHexCommit = useCallback(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexValue)) {
      onCommit(hexValue);
    } else {
      setHexValue(color);
    }
  }, [hexValue, color, onCommit]);

  return (
    <div
      ref={popoverRef}
      class="absolute z-50 rounded-lg shadow-xl p-2 flex flex-col gap-1"
      style={{
        bottom: '100%',
        left: 0,
        marginBottom: '4px',
        backgroundColor: 'var(--sidebar-panel-bg)',
        border: '1px solid var(--sidebar-border-unselected)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="color"
        value={color}
        class="w-8 h-8 rounded cursor-pointer border-0 p-0"
        onInput={(e) => {
          const val = (e.target as HTMLInputElement).value;
          onLiveChange(val);
          setHexValue(val);
        }}
        onChange={(e) => {
          const val = (e.target as HTMLInputElement).value;
          onCommit(val);
          setHexValue(val);
        }}
      />
      <input
        type="text"
        value={hexValue}
        class="w-full rounded px-1 py-0.5 border-0 outline-none"
        style={{
          fontSize: '10px',
          backgroundColor: 'var(--sidebar-input-bg)',
          color: 'var(--sidebar-text-primary)',
        }}
        placeholder="#000000"
        onInput={(e) => setHexValue((e.target as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleHexCommit();
          if (e.key === 'Escape') onClose();
        }}
        onBlur={handleHexCommit}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

interface KeyPhotoCardProps {
  sequenceId: string;
  keyPhotoId: string;
  imageId: string;
  holdFrames: number;
  isActiveByFrame: boolean;
  solidColor?: string;
  isTransparent?: boolean;
}

function KeyPhotoCard({
  sequenceId,
  keyPhotoId,
  imageId,
  holdFrames,
  isActiveByFrame,
  solidColor,
  isTransparent,
}: KeyPhotoCardProps) {
  const [editingFrames, setEditingFrames] = useState(false);
  const [frameValue, setFrameValue] = useState(String(holdFrames));
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSolidEntry = !!solidColor || !!isTransparent;
  const image = !isSolidEntry ? imageStore.getById(imageId) : undefined;
  const thumbUrl = image ? assetUrl(image.thumbnail_path) : null;

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
      class={`group h-14 rounded-md relative shrink-0 bg-cover bg-center overflow-hidden cursor-pointer${isActiveByFrame ? ' ring-2 ring-[var(--color-accent)]' : ''}`}
      style={{
        width: 'auto',
        minWidth: '56px',
        height: '56px',
        backgroundColor: isTransparent ? '#B0B0B0' : solidColor ? solidColor : 'var(--sidebar-input-bg)',
        opacity: isActiveByFrame ? 1 : 0.7,
        ...(isTransparent ? {
          backgroundImage: 'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
        } : thumbUrl ? {backgroundImage: `url(${thumbUrl})`, aspectRatio: 'auto'} : {}),
      }}
      onClick={(e) => {
        e.stopPropagation();
        // Select key photo (for Delete key targeting)
        sequenceStore.selectKeyPhoto(keyPhotoId);

        // Auto-select top-most layer (bidirectional sync)
        const seq = sequenceStore.getById(sequenceId);
        if (seq) {
          const topLayerId = getTopLayerId(seq);
          if (topLayerId) {
            layerStore.setSelected(topLayerId);
            uiStore.selectLayer(topLayerId);
          }
        }

        // Seek playhead to key photo start frame
        const seekLayouts = trackLayouts.peek();
        const seekTrack = seekLayouts.find(t => t.sequenceId === sequenceId);
        if (seekTrack) {
          const range = seekTrack.keyPhotoRanges.find(r => r.keyPhotoId === keyPhotoId);
          if (range) {
            playbackEngine.seekToFrame(range.startFrame);
          }
          timelineStore.ensureTrackVisible(sequenceId);
        }
      }}
    >
      {/* Placeholder icon when no image and not a solid/transparent entry */}
      {!thumbUrl && !isSolidEntry && (
        <div class="absolute inset-0 flex items-center justify-center">
          <span class="text-[10px]" style={{color: 'var(--sidebar-text-secondary)'}}>?</span>
        </div>
      )}

      {/* Top-left: Solid/Transparent toggle (per D-11) — only for solid entries, visible on hover */}
      {isSolidEntry && (
        <button
          class="absolute top-0.5 left-0.5 w-3.5 h-3.5 flex items-center justify-center bg-[#00000080] hover:bg-[#000000AA] rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            sequenceStore.toggleKeyEntryTransparent(sequenceId, keyPhotoId);
          }}
          title={isTransparent ? 'Switch to solid color' : 'Switch to transparent'}
        >
          {isTransparent ? <Blend size={10} color="white" /> : <Square size={10} color="white" />}
        </button>
      )}

      {/* Bottom-left: Pipette color picker (per D-10, D-12) — hidden when transparent */}
      {isSolidEntry && !isTransparent && (
        <div class="absolute bottom-0.5 left-0.5">
          <button
            class="w-3.5 h-3.5 flex items-center justify-center bg-[#00000080] hover:bg-[#000000AA] rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setPickerOpen(!pickerOpen);
            }}
            title="Pick color"
          >
            <Pipette size={10} color="white" />
          </button>
          {pickerOpen && (
            <ColorPickerPopover
              color={solidColor || '#000000'}
              onLiveChange={(c) => {
                sequenceStore.updateKeySolidColorLive(sequenceId, keyPhotoId, c);
              }}
              onCommit={(c) => {
                sequenceStore.updateKeySolidColor(sequenceId, keyPhotoId, c);
              }}
              onClose={() => setPickerOpen(false)}
            />
          )}
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

/** Split add button — Camera (top) to add key photo, Square (bottom) to add key solid (per D-05, D-06, D-07) */
export function AddKeyPhotoButton({sequenceId}: {sequenceId: string}) {
  return (
    <div class="flex flex-col shrink-0 rounded overflow-hidden" style={{ width: '24px', height: '56px' }}>
      <button
        class="flex-1 flex items-center justify-center hover:brightness-125 transition-colors cursor-pointer"
        style={{ backgroundColor: '#3A3A50', color: 'var(--sidebar-text-secondary)' }}
        onClick={() => uiStore.setEditorMode('imported')}
        aria-label="Add key photo"
        title="Add photo from imported images"
      >
        <Camera size={12} />
      </button>
      <button
        class="flex-1 flex items-center justify-center hover:brightness-125 transition-colors cursor-pointer"
        style={{ backgroundColor: '#3A3A50', color: 'var(--sidebar-text-secondary)', borderTop: '1px solid #2A2A3A' }}
        onClick={() => sequenceStore.addKeySolid(sequenceId)}
        aria-label="Add key solid"
        title="Add solid color entry"
      >
        <Square size={12} />
      </button>
    </div>
  );
}
