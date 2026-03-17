import {useRef, useEffect} from 'preact/hooks';
import {imageStore, type VideoAsset} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';

interface ImportGridProps {
  /** When provided, images become selectable and clicking calls this with the image ID */
  onSelect?: (imageId: string) => void;
}

/**
 * Thumbnail grid showing imported images and video assets.
 * Displayed in the LeftPanel when assets have been imported.
 */
export function ImportGrid({onSelect}: ImportGridProps) {
  const images = imageStore.images.value;
  const videos = imageStore.videoAssets.value;

  if (images.length === 0 && videos.length === 0) {
    return (
      <div class="flex items-center justify-center h-20 px-3">
        <span class="text-[10px] text-[var(--color-text-dim)] text-center">
          Drag & drop images here or use Import button
        </span>
      </div>
    );
  }

  return (
    <div class="overflow-y-auto">
      {/* Image assets */}
      {images.length > 0 && (
        <div class="grid grid-cols-4 gap-1 p-2">
          {images.map((img) => (
            <div
              key={img.id}
              class={`relative aspect-[4/3] rounded overflow-hidden bg-[var(--color-bg-input)] group${onSelect ? ' cursor-pointer ring-0 hover:ring-2 ring-[var(--color-accent)]' : ''}`}
              title={`${img.width}x${img.height} ${img.format.toUpperCase()}`}
              onClick={onSelect ? () => onSelect(img.id) : undefined}
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
            </div>
          ))}
        </div>
      )}

      {/* Video assets */}
      {videos.length > 0 && (
        <div class="px-2 pb-2">
          <span class="text-[9px] text-[var(--color-text-dim)] uppercase tracking-wider block mt-1 mb-1">
            Videos
          </span>
          <div class="grid grid-cols-4 gap-1">
            {videos.map((video) => (
              <VideoThumb key={video.id} video={video} selectMode={!!onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Video thumbnail that seeks to middle frame for a meaningful preview */
function VideoThumb({video, selectMode}: {video: VideoAsset; selectMode?: boolean}) {
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
      class={`relative aspect-[4/3] rounded overflow-hidden bg-[var(--color-bg-input)] group${selectMode ? ' opacity-50' : ' cursor-pointer'}`}
      title={selectMode ? 'Videos cannot be used as key photos' : video.name}
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
    </div>
  );
}
