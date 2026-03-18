import {useRef, useEffect} from 'preact/hooks';
import {Film} from 'lucide-preact';
import {imageStore, type VideoAsset} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';

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
  assetFilter?: 'all' | 'images-only' | 'videos-only';
  /** When provided, video thumbnails become clickable and call this with the video ID */
  onVideoSelect?: (videoId: string) => void;
}

/**
 * Thumbnail grid showing imported images and video assets.
 * Displayed in the LeftPanel when assets have been imported.
 */
export function ImportGrid({onSelect, multiSelect, selectedIds, onToggleSelect, assetFilter = 'all', onVideoSelect}: ImportGridProps) {
  const images = imageStore.images.value;
  const videos = imageStore.videoAssets.value;

  const showImages = assetFilter !== 'videos-only';
  const showVideos = assetFilter !== 'images-only';

  const visibleImages = showImages ? images : [];
  const visibleVideos = showVideos ? videos : [];
  if (visibleImages.length === 0 && visibleVideos.length === 0) {
    return (
      <div class="flex items-center justify-center h-20 px-3">
        <span class="text-[10px] text-[var(--color-text-dim)] text-center">
          {assetFilter === 'videos-only'
            ? 'No imported videos yet'
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
            >
              <img
                src={assetUrl(img.thumbnail_path)}
                alt={img.original_path.split('/').pop() ?? 'image'}
                class="w-full h-full object-cover"
                loading="lazy"
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
              <VideoThumb
                key={video.id}
                video={video}
                selectMode={!!onSelect && !onVideoSelect}
                onClick={onVideoSelect ? () => onVideoSelect(video.id) : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Video thumbnail that seeks to middle frame for a meaningful preview */
function VideoThumb({video, selectMode, onClick}: {video: VideoAsset; selectMode?: boolean; onClick?: () => void}) {
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
