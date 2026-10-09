/**
 * Main-app audio disk-reference doors (261009-rko).
 *
 * A main-app audio file is a REFERENCE to where it lives on disk. Bytes are read
 * through the efxasset channel only — plugin-fs scope cannot reach an arbitrary
 * user path outside the audio tree, and the package never holds audio bytes.
 *
 * `readAudioSourceBytes` is the single main-app audio byte-read helper.
 * `registerPickedAudioSource` and `buildAudioReplacePatch` (Task 2) are the
 * never-copy import/replace doors: pure registration and patch construction
 * with zero filesystem writes.
 */

import {assetUrl} from './ipc';
import {imageStore, type AudioAsset} from '../stores/imageStore';
import type {AudioTrack} from '../types/audio';

export {assetUrl};

/** Basename of a picker path (backslash-normalized). */
function basename(filePath: string): string {
  return filePath.replace(/\\/g, '/').split('/').pop() ?? filePath;
}

/**
 * Read the bytes of a disk-referenced audio file through the efxasset channel.
 * Throws on a non-ok response (missing file, blocked root, bad extension).
 */
export async function readAudioSourceBytes(sourcePath: string): Promise<ArrayBuffer> {
  const response = await fetch(assetUrl(sourcePath));
  if (!response.ok) {
    throw new Error(`Failed to read audio source at ${sourcePath} (status ${response.status}).`);
  }
  return response.arrayBuffer();
}

/**
 * Register a picker-chosen audio file as a gallery asset — never-copy.
 * Dedupes by path. Pure registration: no filesystem call of any kind.
 */
export function registerPickedAudioSource(filePath: string): AudioAsset {
  const existing = imageStore.audioAssets.peek().find((asset) => asset.path === filePath);
  if (existing) return existing;
  const asset: AudioAsset = {
    id: crypto.randomUUID(),
    name: basename(filePath),
    path: filePath,
  };
  imageStore.addAudioAsset(asset);
  return asset;
}

/**
 * Build the track patch for a sidebar Replace — the picker path is the disk
 * reference, carried verbatim. Metadata comes from the freshly decoded buffer.
 */
export function buildAudioReplacePatch(
  filePath: string,
  decoded: {sampleRate: number; duration: number; numberOfChannels: number},
  fps: number,
): Partial<AudioTrack> {
  return {
    filePath,
    originalFilename: basename(filePath),
    sampleRate: decoded.sampleRate,
    duration: decoded.duration,
    channelCount: decoded.numberOfChannels,
    inFrame: 0,
    outFrame: Math.ceil(decoded.duration * fps),
  };
}
