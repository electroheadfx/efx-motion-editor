import type {Sequence} from '../types/sequence';
import type {AudioTrack} from '../types/audio';

export interface UsageLocation {
  sequenceId: string;
  sequenceName: string;
  type: 'key-photo' | 'layer' | 'audio-track';
  detail: string;  // e.g., "Key Photo #3", "Layer 'overlay'", "Track 'Music'"
}

export interface AssetUsage {
  assetId: string;
  assetType: 'image' | 'video' | 'audio';
  locations: UsageLocation[];
  count: number;
}

/**
 * Scan all sequences for references to a specific image asset.
 * Checks key photos, static-image layers, and image-sequence layers.
 */
export function getImageUsage(imageId: string, sequences: Sequence[]): AssetUsage {
  const locations: UsageLocation[] = [];

  for (const seq of sequences) {
    // Check key photos (skip placeholder sentinel)
    for (let i = 0; i < seq.keyPhotos.length; i++) {
      const kp = seq.keyPhotos[i];
      if (kp.imageId === imageId && kp.imageId !== '__placeholder__') {
        locations.push({
          sequenceId: seq.id,
          sequenceName: seq.name,
          type: 'key-photo',
          detail: `Key Photo #${i + 1}`,
        });
      }
    }

    // Check layers
    for (const layer of seq.layers) {
      if (layer.source.type === 'static-image' && layer.source.imageId === imageId) {
        locations.push({
          sequenceId: seq.id,
          sequenceName: seq.name,
          type: 'layer',
          detail: `Layer '${layer.name}'`,
        });
      }
      if (layer.source.type === 'image-sequence' && layer.source.imageIds.includes(imageId)) {
        locations.push({
          sequenceId: seq.id,
          sequenceName: seq.name,
          type: 'layer',
          detail: `Layer '${layer.name}'`,
        });
      }
    }
  }

  return {
    assetId: imageId,
    assetType: 'image',
    locations,
    count: locations.length,
  };
}

/**
 * Scan all sequences for references to a specific video asset.
 * Checks video layers by videoAssetId.
 */
export function getVideoUsage(videoAssetId: string, sequences: Sequence[]): AssetUsage {
  const locations: UsageLocation[] = [];

  for (const seq of sequences) {
    for (const layer of seq.layers) {
      if (layer.source.type === 'video' && layer.source.videoAssetId === videoAssetId) {
        locations.push({
          sequenceId: seq.id,
          sequenceName: seq.name,
          type: 'layer',
          detail: `Layer '${layer.name}'`,
        });
      }
    }
  }

  return {
    assetId: videoAssetId,
    assetType: 'video',
    locations,
    count: locations.length,
  };
}

/**
 * Scan all audio tracks for references to a specific audio asset.
 * Audio tracks are project-level, not per-sequence.
 */
export function getAudioUsage(audioAssetId: string, audioTracks: AudioTrack[]): AssetUsage {
  const locations: UsageLocation[] = [];

  for (const track of audioTracks) {
    if (track.audioAssetId === audioAssetId) {
      locations.push({
        sequenceId: '',
        sequenceName: 'Timeline',
        type: 'audio-track',
        detail: `Track '${track.name}'`,
      });
    }
  }

  return {
    assetId: audioAssetId,
    assetType: 'audio',
    locations,
    count: locations.length,
  };
}

/**
 * Compute usage for all assets of all three types.
 * Returns a Map keyed by assetId for O(1) lookup.
 */
export function getAllAssetUsages(
  images: Array<{id: string}>,
  videoAssets: Array<{id: string}>,
  audioAssets: Array<{id: string}>,
  sequences: Sequence[],
  audioTracks: AudioTrack[],
): Map<string, AssetUsage> {
  const result = new Map<string, AssetUsage>();

  for (const img of images) {
    result.set(img.id, getImageUsage(img.id, sequences));
  }

  for (const video of videoAssets) {
    result.set(video.id, getVideoUsage(video.id, sequences));
  }

  for (const audio of audioAssets) {
    result.set(audio.id, getAudioUsage(audio.id, audioTracks));
  }

  return result;
}
