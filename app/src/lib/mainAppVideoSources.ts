/**
 * Video disk-reference import door (261012-d6q).
 *
 * A picked video file is a REFERENCE to where it lives on disk — registration
 * only, zero filesystem writes: the package never holds video bytes, no
 * `videos/` tree is ever provisioned, and the picked file stays untouched at
 * its origin (VID-01/VID-03). Mirror of `registerPickedAudioSource`
 * (261009-rko). Losing the original file loses the media — accepted loss, no
 * copy fallback.
 */

import {imageStore, type VideoAsset} from '../stores/imageStore';

/** Basename of a picker path (backslash-normalized). */
function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

/**
 * Register a picker-chosen video file as a gallery asset — never-copy.
 * Dedupes by path. Pure registration: no filesystem call of any kind.
 */
export function registerPickedVideoSource(filePath: string): VideoAsset {
  const existing = imageStore.videoAssets.peek().find((asset) => asset.path === filePath);
  if (existing) return existing;
  const asset: VideoAsset = {
    id: crypto.randomUUID(),
    name: basename(filePath),
    path: filePath,
  };
  imageStore.addVideoAsset(asset);
  return asset;
}
