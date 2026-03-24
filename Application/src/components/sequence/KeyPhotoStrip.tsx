import {useRef, useEffect, useState, useCallback} from 'preact/hooks';
import Sortable from 'sortablejs';
import {Camera, Square, Blend, Pipette, X, Plus, Minus, Music} from 'lucide-preact';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {timelineStore} from '../../stores/timelineStore';
import {imageStore} from '../../stores/imageStore';
import {audioStore} from '../../stores/audioStore';
import {assetUrl} from '../../lib/ipc';
import {trackLayouts} from '../../lib/frameMap';
import {playbackEngine} from '../../lib/playbackEngine';
import {getTopLayerId} from '../../lib/layerSelection';
import {getActiveKeyPhotoIndex} from '../../lib/keyPhotoNav';
import {snapHoldFramesToBeat} from '../../lib/beatMarkerEngine';
import {ColorPickerModal} from '../shared/ColorPickerModal';
import {buildGradientCSS} from '../shared/GradientBar';
import type {GradientData} from '../../types/sequence';

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
          gradient={kp.gradient}
        />
      ))}
    </div>
  );
}

/** Hold frames popover with +/- buttons and number input */
interface FramesPopoverProps {
  holdFrames: number;
  anchorRef: preact.RefObject<HTMLButtonElement>;
  onCommit: (frames: number) => void;
  onClose: () => void;
  startFrame: number;
}

function FramesPopover({holdFrames, anchorRef, onCommit, onClose, startFrame}: FramesPopoverProps) {
  const [value, setValue] = useState(holdFrames);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{top: number; left: number}>({top: 0, left: 0});

  // Compute fixed position from anchor element, clamped to viewport
  useEffect(() => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popW = 140; // approximate popover width
    const popH = 80;  // approximate popover height
    // Default: above-left of anchor
    let top = rect.top - 4 - popH;
    let left = rect.right - popW;
    // Clamp to keep inside viewport
    if (left < 4) left = rect.right + 4;
    if (top < 4) top = rect.bottom + 4;
    if (left + popW > window.innerWidth - 4) left = window.innerWidth - popW - 4;
    setPos({ top, left });
  }, [anchorRef]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (value !== holdFrames) onCommit(value);
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose, onCommit, value, holdFrames]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const clamp = (n: number) => Math.max(1, Math.min(999, n));

  const handleDecrement = useCallback(() => {
    setValue(v => {
      const next = clamp(v - 1);
      onCommit(next);
      return next;
    });
  }, [onCommit]);

  const handleIncrement = useCallback(() => {
    setValue(v => {
      const next = clamp(v + 1);
      onCommit(next);
      return next;
    });
  }, [onCommit]);

  const handleInputCommit = useCallback(() => {
    const clamped = clamp(value);
    setValue(clamped);
    onCommit(clamped);
  }, [value, onCommit]);

  const handleSnapToBeat = useCallback(() => {
    const selectedTrack = audioStore.tracks.peek().find(
      t => t.id === audioStore.selectedTrackId.peek(),
    );
    if (!selectedTrack || selectedTrack.beatMarkers.length === 0) return;
    const snappedHold = snapHoldFramesToBeat(
      startFrame,
      value,
      selectedTrack.beatMarkers,
      Infinity, // no threshold limit -- always snap to nearest
    );
    if (snappedHold !== null && snappedHold !== value) {
      setValue(snappedHold);
      onCommit(snappedHold);
    }
  }, [startFrame, value, onCommit]);

  return (
    <div
      ref={popoverRef}
      class="fixed rounded-lg shadow-xl p-2 flex flex-col gap-1.5"
      style={{
        top: `${pos.top}px`,
        left: `${pos.left}px`,
        zIndex: 9999,
        backgroundColor: 'var(--sidebar-panel-bg)',
        border: '1px solid var(--sidebar-border-unselected)',
        minWidth: '120px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <span class="text-[9px] font-medium" style={{color: 'var(--sidebar-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
        Hold Frames
      </span>
      <div class="flex items-center gap-1">
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-[#ffffff15]"
          style={{backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)'}}
          onClick={handleDecrement}
          title="Decrease frames"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min={1}
          max={999}
          value={value}
          class="flex-1 h-7 rounded-md px-2 border-0 outline-none text-center font-mono"
          style={{
            fontSize: '12px',
            backgroundColor: 'var(--sidebar-input-bg)',
            color: 'var(--sidebar-text-primary)',
            minWidth: '40px',
          }}
          onInput={(e) => {
            const parsed = parseInt((e.target as HTMLInputElement).value, 10);
            if (!isNaN(parsed)) setValue(parsed);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleInputCommit();
            if (e.key === 'Escape') onClose();
          }}
          onBlur={handleInputCommit}
        />
        <button
          class="w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors hover:bg-[#ffffff15]"
          style={{backgroundColor: 'var(--sidebar-input-bg)', color: 'var(--sidebar-text-primary)'}}
          onClick={handleIncrement}
          title="Increase frames"
        >
          <Plus size={14} />
        </button>
      </div>
      {(() => {
        const selectedTrack = audioStore.tracks.value.find(
          t => t.id === audioStore.selectedTrackId.value,
        );
        if (!selectedTrack || !selectedTrack.bpm || selectedTrack.beatMarkers.length === 0) return null;
        return (
          <button
            class="w-full h-6 flex items-center justify-center gap-1 rounded-md cursor-pointer transition-colors hover:bg-[#ffffff15] text-[10px]"
            style={{
              backgroundColor: 'var(--sidebar-input-bg)',
              color: 'var(--sidebar-text-primary)',
            }}
            onClick={handleSnapToBeat}
            title="Snap hold duration to nearest beat marker"
          >
            <Music size={10} />
            Snap to beat
          </button>
        );
      })()}
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
  gradient?: GradientData;
}

function KeyPhotoCard({
  sequenceId,
  keyPhotoId,
  imageId,
  holdFrames,
  isActiveByFrame,
  solidColor,
  isTransparent,
  gradient,
}: KeyPhotoCardProps) {
  const [framesPopoverOpen, setFramesPopoverOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const framesBtnRef = useRef<HTMLButtonElement>(null);
  const isSolidEntry = !!solidColor || !!isTransparent || !!gradient;
  const image = !isSolidEntry ? imageStore.getById(imageId) : undefined;
  const thumbUrl = image ? assetUrl(image.thumbnail_path) : null;

  // Compute this key photo's global start frame for snap-to-beat
  const kpStartFrame = (() => {
    const layouts = trackLayouts.peek();
    const track = layouts.find(t => t.sequenceId === sequenceId);
    if (!track) return 0;
    const range = track.keyPhotoRanges.find(r => r.keyPhotoId === keyPhotoId);
    return range ? range.startFrame : 0;
  })();

  return (
    <div
      class={`group h-14 rounded-md relative shrink-0 bg-cover bg-center overflow-hidden cursor-pointer${isActiveByFrame ? ' ring-2 ring-(--color-accent)' : ''}`}
      style={{
        width: 'auto',
        minWidth: '56px',
        height: '56px',
        backgroundColor: isTransparent ? '#B0B0B0' : solidColor ? solidColor : gradient ? undefined : 'var(--sidebar-input-bg)',
        opacity: isActiveByFrame ? 1 : 0.7,
        ...(isTransparent ? {
          backgroundImage: 'linear-gradient(45deg, #808080 25%, transparent 25%), linear-gradient(-45deg, #808080 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #808080 75%), linear-gradient(-45deg, transparent 75%, #808080 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
        } : gradient ? {
          backgroundImage: buildGradientCSS(gradient.stops, gradient.type, gradient.angle, gradient.centerX, gradient.centerY),
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
        <button
          class="absolute bottom-0.5 left-0.5 w-3.5 h-3.5 flex items-center justify-center bg-[#00000080] hover:bg-[#000000AA] rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen(!pickerOpen);
          }}
          title="Pick color"
        >
          <Pipette size={10} color="white" />
        </button>
      )}
      {/* Color picker modal rendered at top level (fixed positioning) */}
      {pickerOpen && (
        <ColorPickerModal
          color={solidColor || '#000000'}
          onLiveChange={(c) => {
            sequenceStore.updateKeySolidColorLive(sequenceId, keyPhotoId, c);
          }}
          onCommit={(c) => {
            sequenceStore.updateKeySolidColor(sequenceId, keyPhotoId, c);
          }}
          onClose={() => setPickerOpen(false)}
          showGradientMode={true}
          gradient={gradient}
          onGradientChange={(g) => sequenceStore.updateKeyGradient(sequenceId, keyPhotoId, g)}
          onGradientLiveChange={(g) => sequenceStore.updateKeyGradientLive(sequenceId, keyPhotoId, g)}
        />
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

      {/* Hold frames badge — click opens frames popover */}
      <button
        ref={framesBtnRef}
        class="absolute bottom-0.5 right-0.5 text-[9px] bg-[#00000080] text-white rounded px-1 py-0 cursor-pointer hover:bg-[#000000AA]"
        onClick={(e) => {
          e.stopPropagation();
          setFramesPopoverOpen(!framesPopoverOpen);
        }}
        title="Click to edit hold frames"
      >
        {holdFrames}f
      </button>
      {framesPopoverOpen && (
        <FramesPopover
          holdFrames={holdFrames}
          anchorRef={framesBtnRef}
          startFrame={kpStartFrame}
          onCommit={(frames) => {
            sequenceStore.updateHoldFrames(sequenceId, keyPhotoId, frames);
          }}
          onClose={() => setFramesPopoverOpen(false)}
        />
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
