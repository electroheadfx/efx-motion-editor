import {imageStore} from '../../stores/imageStore';
import {assetUrl} from '../../lib/ipc';

/**
 * Thumbnail grid showing imported images.
 * Displayed in the LeftPanel when images have been imported.
 */
export function ImportGrid() {
  const images = imageStore.images.value;

  if (images.length === 0) {
    return (
      <div class="flex items-center justify-center h-20 px-3">
        <span class="text-[10px] text-[var(--color-text-dim)] text-center">
          Drag & drop images here or use Import button
        </span>
      </div>
    );
  }

  return (
    <div class="grid grid-cols-3 gap-1 p-2 overflow-y-auto max-h-[200px]">
      {images.map((img) => (
        <div
          key={img.id}
          class="relative aspect-[4/3] rounded overflow-hidden bg-[#1E1E1E] cursor-pointer group"
          title={`${img.width}x${img.height} ${img.format.toUpperCase()}`}
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
  );
}
