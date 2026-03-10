import {useState, useEffect, useRef} from 'preact/hooks';
import {open} from '@tauri-apps/plugin-dialog';
import {copyFile, mkdir, readDir} from '@tauri-apps/plugin-fs';
import {layerStore} from '../../stores/layerStore';
import {imageStore} from '../../stores/imageStore';
import {projectStore} from '../../stores/projectStore';
import {uiStore} from '../../stores/uiStore';
import {defaultTransform} from '../../types/layer';
import {tempProjectDir} from '../../lib/projectDir';
import {assetUrl} from '../../lib/ipc';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm', 'avi'];

/** Extract filename from a path (cross-platform) */
function basename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || filePath;
}

/** Natural sort comparator for filenames (frame001 < frame010) */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'});
}

/** Popover menu for adding static-image, image-sequence, and video layers */
export function AddLayerMenu() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [videoPickerOpen, setVideoPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const imagePickerRef = useRef<HTMLDivElement>(null);
  const videoPickerRef = useRef<HTMLDivElement>(null);

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

  // Close image picker on click outside
  useEffect(() => {
    if (!imagePickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (imagePickerRef.current && !imagePickerRef.current.contains(e.target as Node)) {
        setImagePickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [imagePickerOpen]);

  // Close video picker on click outside
  useEffect(() => {
    if (!videoPickerOpen) return;
    function handleClick(e: MouseEvent) {
      if (videoPickerRef.current && !videoPickerRef.current.contains(e.target as Node)) {
        setVideoPickerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [videoPickerOpen]);

  const getProjectDir = (): string | null => {
    return projectStore.dirPath.value ?? tempProjectDir.value;
  };

  /** Add a static image layer from an already-imported asset */
  const handleAddStaticImageFromAsset = (imageId: string) => {
    const img = imageStore.getById(imageId);
    if (!img) return;

    const layerId = crypto.randomUUID();
    const filename = img.original_path.split('/').pop() ?? 'image';

    layerStore.add({
      id: layerId,
      name: filename,
      type: 'static-image',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: {type: 'static-image', imageId: img.id},
      isBase: false,
    });

    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
    setImagePickerOpen(false);
  };

  /** Import a new static image via file dialog (fallback from asset picker) */
  const handleImportNewStaticImage = async () => {
    setImagePickerOpen(false);
    const selected = await open({
      multiple: false,
      filters: [
        {name: 'Images', extensions: IMAGE_EXTENSIONS},
      ],
    });
    if (!selected) return;

    const dir = getProjectDir();
    if (!dir) return;

    const filePath = typeof selected === 'string' ? selected : selected;
    const paths = [filePath];

    // Import the image via existing pipeline
    const beforeCount = imageStore.images.value.length;
    await imageStore.importFiles(paths, dir);
    const afterImages = imageStore.images.value;

    // Get the newly imported image
    if (afterImages.length <= beforeCount) return;
    const newImage = afterImages[afterImages.length - 1];

    const layerId = crypto.randomUUID();
    const filename = basename(filePath);

    layerStore.add({
      id: layerId,
      name: filename,
      type: 'static-image',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: {type: 'static-image', imageId: newImage.id},
      isBase: false,
    });

    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
  };

  /** Add an image sequence layer from a directory */
  const handleAddImageSequence = async () => {
    setMenuOpen(false);
    const selected = await open({directory: true});
    if (!selected) return;

    const dir = getProjectDir();
    if (!dir) return;

    const folderPath = typeof selected === 'string' ? selected : selected;

    // Read all entries from the selected directory
    const entries = await readDir(folderPath);

    // Filter for image files and sort naturally by name
    const imageEntries = entries
      .filter((entry) => {
        if (entry.isDirectory) return false;
        const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
        return IMAGE_EXTENSIONS.includes(ext);
      })
      .sort((a, b) => naturalCompare(a.name, b.name));

    if (imageEntries.length === 0) return;

    // Build absolute paths for import
    const sep = folderPath.endsWith('/') ? '' : '/';
    const imagePaths = imageEntries.map((e) => `${folderPath}${sep}${e.name}`);

    // Import all images
    const beforeCount = imageStore.images.value.length;
    await imageStore.importFiles(imagePaths, dir);
    const afterImages = imageStore.images.value;

    // Collect the newly imported image IDs (in order)
    const newImages = afterImages.slice(beforeCount);
    if (newImages.length === 0) return;
    const importedImageIds = newImages.map((img) => img.id);

    // Extract folder name for the layer name
    const folderName = basename(folderPath);
    const layerId = crypto.randomUUID();

    layerStore.add({
      id: layerId,
      name: folderName,
      type: 'image-sequence',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: {type: 'image-sequence', imageIds: importedImageIds},
      isBase: false,
    });

    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
  };

  /** Add a video layer from an already-imported asset */
  const handleAddVideoFromAsset = (videoId: string) => {
    const video = imageStore.videoAssets.value.find((v) => v.id === videoId);
    if (!video) return;

    const layerId = crypto.randomUUID();

    layerStore.add({
      id: layerId,
      name: video.name,
      type: 'video',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: {type: 'video', videoPath: video.path},
      isBase: false,
    });

    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
    setVideoPickerOpen(false);
  };

  /** Import a new video via file dialog (fallback from video picker) */
  const handleImportNewVideo = async () => {
    setVideoPickerOpen(false);
    const selected = await open({
      multiple: false,
      filters: [
        {name: 'Video', extensions: VIDEO_EXTENSIONS},
      ],
    });
    if (!selected) return;

    const dir = getProjectDir();
    if (!dir) return;

    const filePath = typeof selected === 'string' ? selected : selected;
    const filename = basename(filePath);

    // Ensure videos/ subdirectory exists
    const sep = dir.endsWith('/') ? '' : '/';
    const videosDir = `${dir}${sep}videos`;
    try {
      await mkdir(videosDir, {recursive: true});
    } catch {
      // Directory may already exist, that's fine
    }

    // Copy video file to project videos/ directory
    const destPath = `${videosDir}/${filename}`;
    try {
      await copyFile(filePath, destPath);
    } catch (err) {
      console.error('Failed to copy video file:', err);
      return;
    }

    const layerId = crypto.randomUUID();

    // Register video as imported asset so it appears in IMPORTED panel
    imageStore.addVideoAsset({
      id: layerId,
      name: filename,
      path: destPath,
    });

    layerStore.add({
      id: layerId,
      name: filename,
      type: 'video',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      transform: defaultTransform(),
      source: {type: 'video', videoPath: destPath},
      isBase: false,
    });

    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
  };

  return (
    <div class="relative" ref={menuRef}>
      <button
        class="rounded px-2 py-1 bg-[var(--color-bg-settings)] hover:bg-[var(--color-bg-input)] transition-colors"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span class="text-[10px] text-[var(--color-text-secondary)]">+ Add</span>
      </button>

      {menuOpen && (
        <div class="absolute right-0 top-7 z-50 bg-[#1E1E1E] border border-[#333] rounded-md shadow-xl py-1 min-w-[150px]">
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={() => { setMenuOpen(false); setImagePickerOpen(true); }}
          >
            <span class="w-2 h-2 rounded-sm bg-[#14B8A6] shrink-0" />
            Static Image
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={handleAddImageSequence}
          >
            <span class="w-2 h-2 rounded-sm bg-[#3B82F6] shrink-0" />
            Image Sequence
          </button>
          <button
            class="w-full text-left px-3 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] flex items-center gap-2"
            onClick={() => { setMenuOpen(false); setVideoPickerOpen(true); }}
          >
            <span class="w-2 h-2 rounded-sm bg-[#8B5CF6] shrink-0" />
            Video
          </button>
        </div>
      )}

      {imagePickerOpen && (
        <div
          ref={imagePickerRef}
          class="absolute right-0 top-7 z-50 bg-[#1E1E1E] border border-[#333] rounded-md shadow-xl p-2 min-w-[180px] max-w-[260px] max-h-[300px] overflow-y-auto"
        >
          {imageStore.images.value.length === 0 ? (
            <div class="text-center py-3">
              <span class="text-[10px] text-[var(--color-text-dim)]">No imported images yet.</span>
            </div>
          ) : (
            <div class="grid grid-cols-4 gap-1">
              {imageStore.images.value.map((img) => (
                <button
                  key={img.id}
                  class="aspect-square rounded overflow-hidden bg-[#2A2A2A] hover:ring-1 hover:ring-[#14B8A6] cursor-pointer"
                  style={{backgroundImage: `url(${assetUrl(img.thumbnail_path)})`, backgroundSize: 'cover', backgroundPosition: 'center'}}
                  title={img.original_path.split('/').pop() ?? 'image'}
                  onClick={() => handleAddStaticImageFromAsset(img.id)}
                />
              ))}
            </div>
          )}
          <button
            class="w-full mt-2 py-1 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-t border-[#333] cursor-pointer"
            onClick={handleImportNewStaticImage}
          >
            Import new...
          </button>
        </div>
      )}

      {videoPickerOpen && (
        <div
          ref={videoPickerRef}
          class="absolute right-0 top-7 z-50 bg-[#1E1E1E] border border-[#333] rounded-md shadow-xl p-2 min-w-[180px] max-w-[260px] max-h-[300px] overflow-y-auto"
        >
          {imageStore.videoAssets.value.length === 0 ? (
            <div class="text-center py-3">
              <span class="text-[10px] text-[var(--color-text-dim)]">No imported videos yet.</span>
            </div>
          ) : (
            <div class="flex flex-col gap-1">
              {imageStore.videoAssets.value.map((video) => (
                <button
                  key={video.id}
                  class="w-full text-left px-2 py-1.5 text-xs text-[#CCCCCC] hover:bg-[#ffffff10] rounded flex items-center gap-2 cursor-pointer"
                  onClick={() => handleAddVideoFromAsset(video.id)}
                >
                  <span class="w-2 h-2 rounded-full bg-[#8B5CF6] shrink-0" />
                  <span class="truncate">{video.name}</span>
                </button>
              ))}
            </div>
          )}
          <button
            class="w-full mt-2 py-1 text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] border-t border-[#333] cursor-pointer"
            onClick={handleImportNewVideo}
          >
            Import new...
          </button>
        </div>
      )}
    </div>
  );
}
