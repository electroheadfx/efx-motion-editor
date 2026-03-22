import {useRef, useState, useCallback, useEffect} from 'preact/hooks';
import {createPortal} from 'preact/compat';
import {computed} from '@preact/signals';
import {Film, Music} from 'lucide-preact';
import {imageStore, type VideoAsset} from '../../stores/imageStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {audioStore} from '../../stores/audioStore';
import {assetUrl} from '../../lib/ipc';
import {UsageBadge} from './UsageBadge';
import {UsagePopover} from './UsagePopover';
import {getAllAssetUsages} from '../../lib/assetUsage';
import {cascadeRemoveAsset, cascadeDeleteFile} from '../../lib/assetRemoval';

interface ImportGridProps {
  /** When provided, images become selectable and clicking calls this with the image ID */
  onSelect?: (imageId: string) => void;
  /** Enable multi-select mode (checkmarks + toggle) */
  multiSelect?: boolean;
  /** Currently selected image IDs in multi-select mode */
  selectedIds?: string[];
  /** Toggle selection of an image in multi-select mode */
  onToggleSelect?: (imageId: string) => void;
  /** Filter which asset types to show */
  assetFilter?: 'all' | 'images-only' | 'videos-only' | 'audio-only';
  /** When provided, video thumbnails become clickable and call this with the video ID */
  onVideoSelect?: (videoId: string) => void;
  /** When provided, audio items become clickable and call this with the audio asset ID */
  onAudioSelect?: (audioAssetId: string) => void;
}

/**
 * Thumbnail grid showing imported images and video assets.
 * Displayed in the LeftPanel when assets have been imported.
 */
export function ImportGrid({onSelect, multiSelect, selectedIds, onToggleSelect, assetFilter = 'all', onVideoSelect, onAudioSelect}: ImportGridProps) {
  const images = imageStore.images.value;
  const videos = imageStore.videoAssets.value;
  const audios = imageStore.audioAssets.value;

  const showImages = assetFilter !== 'videos-only' && assetFilter !== 'audio-only';
  const showVideos = assetFilter !== 'images-only' && assetFilter !== 'audio-only';
  const showAudio = assetFilter === 'audio-only' || assetFilter === 'all';

  const [ctxMenu, setCtxMenu] = useState<{
    type: 'image' | 'video' | 'audio';
    id: string;
    name: string;
    path: string;
    x: number;
    y: number;
  } | null>(null);

  const [popover, setPopover] = useState<{
    assetId: string;
    assetName: string;
    assetPath: string;
    assetType: 'image' | 'video' | 'audio';
    x: number;
    y: number;
    thumbnailPath?: string;
  } | null>(null);

  // Reactive usage map: auto-updates when any dependency signal changes
  const usageMap = computed(() => getAllAssetUsages(
    imageStore.images.value,
    imageStore.videoAssets.value,
    imageStore.audioAssets.value,
    sequenceStore.sequences.value,
    audioStore.tracks.value,
  ));

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [ctxMenu]);

  const handleBadgeClick = useCallback((assetId: string, assetName: string, assetPath: string, assetType: 'image' | 'video' | 'audio', e: MouseEvent, thumbnailPath?: string) => {
    setPopover({assetId, assetName, assetPath, assetType, x: e.clientX, y: e.clientY, thumbnailPath});
    setCtxMenu(null);  // close context menu if open
  }, []);

  const handlePopoverRemoveRef = useCallback(() => {
    if (!popover) return;
    const usage = usageMap.value.get(popover.assetId);
    cascadeRemoveAsset(popover.assetId, popover.assetType, popover.assetName, usage?.locations ?? []);
    setPopover(null);
  }, [popover]);

  const handlePopoverDeleteFile = useCallback(async () => {
    if (!popover) return;
    const usage = usageMap.value.get(popover.assetId);
    await cascadeDeleteFile(popover.assetId, popover.assetType, popover.assetName, popover.assetPath, usage?.locations ?? [], popover.thumbnailPath);
    setPopover(null);
  }, [popover]);

  const handleRemoveRef = useCallback(() => {
    if (!ctxMenu) return;
    const usage = usageMap.value.get(ctxMenu.id);
    cascadeRemoveAsset(ctxMenu.id, ctxMenu.type, ctxMenu.name, usage?.locations ?? []);
    setCtxMenu(null);
  }, [ctxMenu]);

  const handleDeleteFile = useCallback(async () => {
    if (!ctxMenu) return;
    const usage = usageMap.value.get(ctxMenu.id);
    let thumbnailPath: string | undefined;
    if (ctxMenu.type === 'image') {
      const img = imageStore.getById(ctxMenu.id);
      thumbnailPath = img?.thumbnail_path;
    }
    await cascadeDeleteFile(ctxMenu.id, ctxMenu.type, ctxMenu.name, ctxMenu.path, usage?.locations ?? [], thumbnailPath);
    setCtxMenu(null);
  }, [ctxMenu]);

  const visibleImages = showImages ? images : [];
  const visibleVideos = showVideos ? videos : [];
  const visibleAudios = showAudio ? audios : [];
  if (visibleImages.length === 0 && visibleVideos.length === 0 && visibleAudios.length === 0) {
    return (
      <div class="flex items-center justify-center h-20 px-3">
        <span class="text-[10px] text-[var(--color-text-dim)] text-center">
          {assetFilter === 'videos-only'
            ? 'No imported videos yet'
            : assetFilter === 'audio-only'
              ? 'No imported audio yet — use Import button'
              : 'Drag & drop images here or use Import button'}
        </span>
      </div>
    );
  }

  return (
    <div class="overflow-y-auto">
      {/* Image assets */}
      {showImages && images.length > 0 && (
        <div class="grid grid-cols-4 gap-1 p-2">
          {images.map((img) => (
            <div
              key={img.id}
              class={`relative aspect-[4/3] rounded overflow-hidden bg-[var(--color-bg-input)] group${
                multiSelect && selectedIds?.includes(img.id)
                  ? ' ring-2 ring-[var(--color-accent)]'
                  : onSelect || multiSelect
                    ? ' cursor-pointer ring-0 hover:ring-2 ring-[var(--color-accent)]'
                    : ''
              }`}
              title={`${img.width}x${img.height} ${img.format.toUpperCase()}`}
              onClick={
                multiSelect
                  ? () => onToggleSelect?.(img.id)
                  : onSelect
                    ? () => onSelect(img.id)
                    : undefined
              }
              onContextMenu={(e: MouseEvent) => {
                e.preventDefault();
                setCtxMenu({
                  type: 'image', id: img.id,
                  name: img.original_path.split('/').pop() ?? 'image',
                  path: img.project_path,
                  x: e.clientX, y: e.clientY,
                });
              }}
            >
              <img
                src={assetUrl(img.thumbnail_path)}
                alt={img.original_path.split('/').pop() ?? 'image'}
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <UsageBadge
                count={usageMap.value.get(img.id)?.count ?? 0}
                onClick={(e) => handleBadgeClick(img.id, img.original_path.split('/').pop() ?? 'image', img.project_path, 'image', e, img.thumbnail_path)}
              />
              {/* Hover overlay with filename */}
              <div class="absolute inset-0 bg-[#00000080] opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                <span class="text-[8px] text-white truncate w-full">
                  {img.original_path.split('/').pop()}
                </span>
              </div>
              {/* Multi-select checkmark */}
              {multiSelect && selectedIds?.includes(img.id) && (
                <div
                  class="absolute top-1 left-1 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-accent)' }}
                >
                  <span class="text-white text-[10px] font-bold">&#10003;</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Video assets */}
      {showVideos && videos.length > 0 && (
        <div class="px-2 pb-2">
          {assetFilter === 'all' && (
            <span class="text-[9px] text-[var(--color-text-dim)] uppercase tracking-wider block mt-1 mb-1">
              Videos
            </span>
          )}
          <div class="grid grid-cols-4 gap-1">
            {videos.map((video) => (
              <div key={video.id} class="relative">
                <VideoThumb
                  video={video}
                  selectMode={!!onSelect && !onVideoSelect}
                  onClick={onVideoSelect ? () => onVideoSelect(video.id) : undefined}
                  onContextMenu={(e: MouseEvent) => {
                    e.preventDefault();
                    setCtxMenu({
                      type: 'video', id: video.id,
                      name: video.name, path: video.path,
                      x: e.clientX, y: e.clientY,
                    });
                  }}
                />
                <UsageBadge
                  count={usageMap.value.get(video.id)?.count ?? 0}
                  onClick={(e) => handleBadgeClick(video.id, video.name, video.path, 'video', e)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audio assets */}
      {showAudio && audios.length > 0 && (
        <div class="px-2 pb-2">
          {assetFilter === 'all' && (
            <span class="text-[9px] text-[var(--color-text-dim)] uppercase tracking-wider block mt-1 mb-1">
              Audio
            </span>
          )}
          <div class="flex flex-col gap-1">
            {audios.map((audio) => (
              <div
                key={audio.id}
                class={`flex items-center gap-2 px-3 py-2 rounded bg-[var(--color-bg-input)] group${
                  onAudioSelect ? ' cursor-pointer hover:bg-[var(--color-bg-hover-item)] hover:ring-1 ring-[var(--color-accent)]' : ''
                }`}
                onClick={onAudioSelect ? () => onAudioSelect(audio.id) : undefined}
                title={audio.name}
                onContextMenu={(e: MouseEvent) => {
                  e.preventDefault();
                  setCtxMenu({
                    type: 'audio', id: audio.id,
                    name: audio.name, path: audio.path,
                    x: e.clientX, y: e.clientY,
                  });
                }}
              >
                <Music size={14} class="text-[var(--color-audio-waveform,#22B8A0)] shrink-0" />
                <span class="text-xs text-[var(--color-text-button)] truncate">{audio.name}</span>
                <UsageBadge
                  count={usageMap.value.get(audio.id)?.count ?? 0}
                  onClick={(e) => handleBadgeClick(audio.id, audio.name, audio.path, 'audio', e)}
                  layout="inline"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {popover && (() => {
        const usage = usageMap.value.get(popover.assetId);
        return (
          <UsagePopover
            assetId={popover.assetId}
            assetName={popover.assetName}
            assetPath={popover.assetPath}
            assetType={popover.assetType}
            locations={usage?.locations ?? []}
            count={usage?.count ?? 0}
            position={{x: popover.x, y: popover.y}}
            onClose={() => setPopover(null)}
            onRemoveRef={handlePopoverRemoveRef}
            onDeleteFile={handlePopoverDeleteFile}
          />
        );
      })()}

      {ctxMenu && createPortal(
        <div
          class="fixed z-50 rounded-md shadow-xl py-1 min-w-[140px]"
          style={{
            top: ctxMenu.y, left: ctxMenu.x,
            backgroundColor: 'var(--sidebar-panel-bg)',
            border: '1px solid var(--sidebar-border-unselected)',
          }}
          onMouseDown={(e: MouseEvent) => e.stopPropagation()}
        >
          <button
            class="w-full text-left px-3 py-1.5 text-xs hover:bg-[#ffffff10]"
            style={{ color: 'var(--sidebar-text-button)' }}
            onClick={handleRemoveRef}
          >
            Remove Reference
          </button>
          <div class="w-full h-px my-1" style={{ backgroundColor: 'var(--sidebar-border-unselected)' }} />
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[var(--color-error-text)] hover:bg-[#ffffff10]"
            onClick={handleDeleteFile}
          >
            Delete File
          </button>
        </div>,
        document.body,
      )}
    </div>
  );
}

/** Video thumbnail that seeks to middle frame for a meaningful preview */
function VideoThumb({video, selectMode, onClick, onContextMenu}: {video: VideoAsset; selectMode?: boolean; onClick?: () => void; onContextMenu?: (e: MouseEvent) => void}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onMeta = () => {
      if (el.duration && isFinite(el.duration)) {
        el.currentTime = el.duration / 2;
      }
    };
    el.addEventListener('loadedmetadata', onMeta);
    return () => el.removeEventListener('loadedmetadata', onMeta);
  }, [video.path]);

  return (
    <div
      class={`relative aspect-[4/3] rounded overflow-hidden bg-[var(--color-bg-input)] group${
        onClick ? ' cursor-pointer hover:ring-2 ring-[var(--color-accent)]' : selectMode ? ' opacity-50' : ''
      }`}
      title={onClick ? video.name : selectMode ? 'Videos cannot be used as key photos' : video.name}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <video
        ref={videoRef}
        src={assetUrl(video.path)}
        preload="metadata"
        muted
        class="w-full h-full object-cover pointer-events-none"
      />
      <div class="absolute inset-0 bg-[#00000080] opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
        <span class="text-[8px] text-white truncate w-full">
          {video.name}
        </span>
      </div>
      <div class="absolute bottom-1 right-1 w-4 h-4 rounded-sm flex items-center justify-center"
           style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <Film size={10} class="text-white" />
      </div>
    </div>
  );
}
