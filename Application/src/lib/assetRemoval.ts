import {batch} from '@preact/signals';
import {remove as removeFile} from '@tauri-apps/plugin-fs';
import {imageStore} from '../stores/imageStore';
import {sequenceStore} from '../stores/sequenceStore';
import {audioStore} from '../stores/audioStore';
import {pushAction} from './history';
import type {UsageLocation} from './assetUsage';
import type {Sequence} from '../types/sequence';
import type {AudioTrack} from '../types/audio';
import type {ImportedImage} from '../types/image';
import type {VideoAsset, AudioAsset} from '../stores/imageStore';

/** Snapshots of all three stores for composite undo/redo */
interface StoreSnapshots {
  seqs: Sequence[];
  seqActive: string | null;
  audioTracks: AudioTrack[];
  audioSelected: string | null;
  imgs: ImportedImage[];
  vids: VideoAsset[];
  auds: AudioAsset[];
}

/** Capture snapshots of all three stores before mutation */
function captureSnapshots(): StoreSnapshots {
  return {
    seqs: structuredClone(sequenceStore.sequences.peek()),
    seqActive: sequenceStore.activeSequenceId.peek(),
    audioTracks: structuredClone(audioStore.tracks.peek()),
    audioSelected: audioStore.selectedTrackId.peek(),
    imgs: structuredClone(imageStore.images.peek()),
    vids: structuredClone(imageStore.videoAssets.peek()),
    auds: structuredClone(imageStore.audioAssets.peek()),
  };
}

/** Restore all three stores from snapshots */
function restoreSnapshots(snap: StoreSnapshots): void {
  batch(() => {
    sequenceStore.sequences.value = snap.seqs;
    sequenceStore.activeSequenceId.value = snap.seqActive;
    audioStore.tracks.value = snap.audioTracks;
    audioStore.selectedTrackId.value = snap.audioSelected;
    imageStore.images.value = snap.imgs;
    imageStore.videoAssets.value = snap.vids;
    imageStore.audioAssets.value = snap.auds;
  });
}

/**
 * Perform cascade mutations for removing an asset.
 * - Image assets: key photos become __placeholder__, matching layers removed/filtered
 * - Video assets: matching video layers removed
 * - Audio assets: matching audio tracks removed
 * Then removes the asset from its store.
 */
function performCascadeMutations(assetId: string, assetType: 'image' | 'video' | 'audio'): void {
  batch(() => {
    if (assetType === 'image') {
      // Key photos: set imageId to __placeholder__ sentinel
      // Static-image layers with matching imageId: remove layer
      // Image-sequence layers containing imageId: filter out of imageIds array
      const updatedSeqs = sequenceStore.sequences.peek().map(seq => {
        const updatedKeyPhotos = seq.keyPhotos.map(kp =>
          kp.imageId === assetId ? {...kp, imageId: '__placeholder__'} : kp,
        );

        const updatedLayers = seq.layers
          .filter(layer => {
            // Remove static-image layers referencing this image
            if (layer.source.type === 'static-image' && layer.source.imageId === assetId) {
              return false;
            }
            return true;
          })
          .map(layer => {
            // Filter imageId out of image-sequence layers
            if (layer.source.type === 'image-sequence' && layer.source.imageIds.includes(assetId)) {
              return {
                ...layer,
                source: {
                  ...layer.source,
                  imageIds: layer.source.imageIds.filter(id => id !== assetId),
                },
              };
            }
            return layer;
          });

        return {...seq, keyPhotos: updatedKeyPhotos, layers: updatedLayers};
      });
      sequenceStore.sequences.value = updatedSeqs;
      imageStore.images.value = imageStore.images.peek().filter(img => img.id !== assetId);
    } else if (assetType === 'video') {
      // Video layers with matching videoAssetId: remove layer
      const updatedSeqs = sequenceStore.sequences.peek().map(seq => {
        const updatedLayers = seq.layers.filter(layer => {
          if (layer.source.type === 'video' && layer.source.videoAssetId === assetId) {
            return false;
          }
          return true;
        });
        return {...seq, layers: updatedLayers};
      });
      sequenceStore.sequences.value = updatedSeqs;
      imageStore.videoAssets.value = imageStore.videoAssets.peek().filter(v => v.id !== assetId);
    } else if (assetType === 'audio') {
      // Audio tracks with matching audioAssetId: remove
      audioStore.tracks.value = audioStore.tracks.peek().filter(t => t.audioAssetId !== assetId);
      imageStore.audioAssets.value = imageStore.audioAssets.peek().filter(a => a.id !== assetId);
    }
  });
}

/**
 * Remove an asset from the library with cascade removal of all references.
 * Shows a confirmation dialog listing affected locations.
 * Pushes a single undo entry that restores all three stores.
 *
 * @returns true if removal was performed, false if cancelled
 */
export function cascadeRemoveAsset(
  assetId: string,
  assetType: 'image' | 'video' | 'audio',
  assetName: string,
  locations: UsageLocation[],
): boolean {
  // Confirmation dialog
  if (locations.length > 0) {
    const locationList = locations.map(l => `- ${l.sequenceName} > ${l.detail}`).join('\n');
    const message = `"${assetName}" is used in ${locations.length} location${locations.length !== 1 ? 's' : ''}:\n\n${locationList}\n\nRemove all references and delete from library?`;
    if (!window.confirm(message)) return false;
  } else {
    if (!window.confirm(`Remove "${assetName}" from library?`)) return false;
  }

  // Capture before-snapshots
  const beforeSnap = captureSnapshots();

  // Perform cascade mutations
  performCascadeMutations(assetId, assetType);

  // Capture after-snapshots
  const afterSnap = captureSnapshots();

  // Push single undo action
  pushAction({
    id: crypto.randomUUID(),
    description: `Remove ${assetType} "${assetName}"`,
    timestamp: Date.now(),
    undo: () => restoreSnapshots(beforeSnap),
    redo: () => restoreSnapshots(afterSnap),
  });

  return true;
}

/**
 * Delete an asset file from disk with cascade removal.
 * For in-use assets: two-step confirmation (cascade first, then disk delete).
 * For unused assets: single confirmation then remove + delete.
 *
 * @returns true if deletion was performed, false if cancelled
 */
export async function cascadeDeleteFile(
  assetId: string,
  assetType: 'image' | 'video' | 'audio',
  assetName: string,
  assetPath: string,
  locations: UsageLocation[],
  thumbnailPath?: string,
): Promise<boolean> {
  if (locations.length > 0) {
    // In-use: two-step confirmation per D-12
    const locationList = locations.map(l => `- ${l.sequenceName} > ${l.detail}`).join('\n');

    // Step 1: Warn about reference removal
    const step1 = `"${assetName}" is used in ${locations.length} location${locations.length !== 1 ? 's' : ''}:\n\n${locationList}\n\nThis will remove all references first.`;
    if (!window.confirm(step1)) return false;

    // Capture before-snapshots and perform cascade
    const beforeSnap = captureSnapshots();
    performCascadeMutations(assetId, assetType);
    const afterSnap = captureSnapshots();

    // Push undo for the cascade removal
    pushAction({
      id: crypto.randomUUID(),
      description: `Remove ${assetType} "${assetName}"`,
      timestamp: Date.now(),
      undo: () => restoreSnapshots(beforeSnap),
      redo: () => restoreSnapshots(afterSnap),
    });

    // Step 2: Confirm disk deletion
    if (!window.confirm(`Permanently delete "${assetName}" from disk? This cannot be undone.`)) {
      // References already removed but file kept -- this is correct behavior
      return true;
    }

    // Delete file from disk
    try { await removeFile(assetPath); } catch { /* file may not exist */ }
    if (thumbnailPath) {
      try { await removeFile(thumbnailPath); } catch { /* thumbnail may not exist */ }
    }
  } else {
    // Unused: single confirmation per D-13
    if (!window.confirm(`Delete "${assetName}" from disk? This cannot be undone.`)) return false;

    // Capture before-snapshots and remove from store
    const beforeSnap = captureSnapshots();
    performCascadeMutations(assetId, assetType);
    const afterSnap = captureSnapshots();

    // Push undo for the store removal
    pushAction({
      id: crypto.randomUUID(),
      description: `Remove ${assetType} "${assetName}"`,
      timestamp: Date.now(),
      undo: () => restoreSnapshots(beforeSnap),
      redo: () => restoreSnapshots(afterSnap),
    });

    // Delete file from disk
    try { await removeFile(assetPath); } catch { /* file may not exist */ }
    if (thumbnailPath) {
      try { await removeFile(thumbnailPath); } catch { /* thumbnail may not exist */ }
    }
  }

  return true;
}
