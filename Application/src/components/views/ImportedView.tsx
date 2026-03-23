import {useState, useCallback, useEffect} from 'preact/hooks';
import {open} from '@tauri-apps/plugin-dialog';
import {copyFile, mkdir, readFile} from '@tauri-apps/plugin-fs';
import {imageStore} from '../../stores/imageStore';
import {projectStore} from '../../stores/projectStore';
import {sequenceStore} from '../../stores/sequenceStore';
import {uiStore} from '../../stores/uiStore';
import {layerStore} from '../../stores/layerStore';
import {audioStore} from '../../stores/audioStore';
import {audioEngine} from '../../lib/audioEngine';
import {computeWaveformPeaks} from '../../lib/audioWaveform';
import {audioPeaksCache} from '../../lib/audioPeaksCache';
import {defaultTransform} from '../../types/layer';
import type {Layer} from '../../types/layer';
import {ImportGrid} from '../import/ImportGrid';
import {tempProjectDir} from '../../lib/projectDir';
import {totalFrames} from '../../lib/frameMap';

export function ImportedView() {
  const intent = uiStore.addLayerIntent.value;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [isDecodingAudio, setIsDecodingAudio] = useState(false);

  // Priority 1-3: add-layer intent
  const isAddLayerFlow = !!intent;
  const isAudioFlow = intent?.type === 'audio';
  const intentFilter = intent?.type === 'video' ? 'videos-only'
    : intent?.type === 'static-image' || intent?.type === 'image-sequence' ? 'images-only'
    : intent?.type === 'audio' ? 'audio-only'
    : 'all';
  const intentMultiSelect = intent?.type === 'image-sequence';

  // Priority 4-5: existing key photo flows (only when no add-layer intent)
  const seqId = !isAddLayerFlow ? sequenceStore.activeSequenceId.value : null;
  const isPickingKeyPhoto = !!seqId;
  const pendingId = !isAddLayerFlow ? uiStore.pendingNewSequenceId.value : null;
  const isPendingMultiSelect = !!pendingId;

  // Combined mode
  const isMultiSelect = intentMultiSelect || isPendingMultiSelect;
  const assetFilter = isAddLayerFlow ? intentFilter : 'all' as const;

  // Header text derivation
  const headerText = intent?.type === 'audio' ? 'Select audio file'
    : intent?.type === 'static-image' ? 'Select image for layer'
    : intent?.type === 'image-sequence'
      ? `Select images for sequence${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`
    : intent?.type === 'video' ? 'Select video for layer'
    : isPendingMultiSelect
      ? `Select key photos${selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}`
    : isPickingKeyPhoto ? 'Select a key photo'
    : 'Imported Assets';

  // Reset selectedIds when intent changes (pitfall 5 prevention)
  useEffect(() => {
    setSelectedIds([]);
  }, [intent?.type]);

  const handleSelectForKeyPhoto = (imageId: string) => {
    const activeId = sequenceStore.activeSequenceId.peek();
    if (!activeId) return;
    sequenceStore.addKeyPhoto(activeId, imageId);
    uiStore.setEditorMode('editor');
  };

  const handleToggleSelect = useCallback((imageId: string) => {
    setSelectedIds(prev =>
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  }, []);

  // Single-select handler for static image layer creation
  const handleAddStaticImageLayer = useCallback((imageId: string) => {
    const currentIntent = uiStore.addLayerIntent.peek();
    const img = imageStore.getById(imageId);
    if (!img) return;
    const layerId = crypto.randomUUID();
    const filename = img.original_path.split('/').pop() ?? 'image';

    // Change Source flow: update existing layer source instead of creating new
    if (currentIntent?.changeSourceFor) {
      layerStore.updateLayer(currentIntent.changeSourceFor.layerId, {
        source: { type: 'static-image', imageId: img.id },
        name: filename,
      });
      uiStore.setAddLayerIntent(null);
      uiStore.setEditorMode('editor');
      return;
    }

    // Content overlay flow: create new content-overlay sequence
    if (currentIntent?.target === 'content-overlay') {
      const layer: Layer = {
        id: layerId, name: filename, type: 'static-image',
        visible: true, opacity: 1, blendMode: 'normal',
        transform: defaultTransform(),
        source: { type: 'static-image', imageId: img.id },
        isBase: false,
      };
      sequenceStore.createContentOverlaySequence(filename, layer, totalFrames.peek());
      layerStore.setSelected(layerId);
      uiStore.selectLayer(layerId);
      uiStore.setAddLayerIntent(null);
      uiStore.setEditorMode('editor');
      return;
    }

    // Default flow: add layer to active content sequence
    layerStore.add({
      id: layerId, name: filename, type: 'static-image',
      visible: true, opacity: 1, blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'static-image', imageId: img.id },
      isBase: false,
    });
    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
    uiStore.setAddLayerIntent(null);
    uiStore.setEditorMode('editor');
  }, []);

  // Single-select handler for video layer creation
  const handleAddVideoLayer = useCallback((videoId: string) => {
    const currentIntent = uiStore.addLayerIntent.peek();
    const video = imageStore.videoAssets.value.find(v => v.id === videoId);
    if (!video) return;
    const layerId = crypto.randomUUID();

    // Change Source flow: update existing layer source
    if (currentIntent?.changeSourceFor) {
      layerStore.updateLayer(currentIntent.changeSourceFor.layerId, {
        source: { type: 'video', videoAssetId: video.id },
        name: video.name,
      });
      uiStore.setAddLayerIntent(null);
      uiStore.setEditorMode('editor');
      return;
    }

    // Content overlay flow: create new content-overlay sequence
    if (currentIntent?.target === 'content-overlay') {
      const layer: Layer = {
        id: layerId, name: video.name, type: 'video',
        visible: true, opacity: 1, blendMode: 'normal',
        transform: defaultTransform(),
        source: { type: 'video', videoAssetId: video.id },
        isBase: false,
      };
      sequenceStore.createContentOverlaySequence(video.name, layer, totalFrames.peek());
      layerStore.setSelected(layerId);
      uiStore.selectLayer(layerId);
      uiStore.setAddLayerIntent(null);
      uiStore.setEditorMode('editor');
      return;
    }

    // Default flow: add layer to active content sequence
    layerStore.add({
      id: layerId, name: video.name, type: 'video',
      visible: true, opacity: 1, blendMode: 'normal',
      transform: defaultTransform(),
      source: { type: 'video', videoAssetId: video.id },
      isBase: false,
    });
    layerStore.setSelected(layerId);
    uiStore.selectLayer(layerId);
    uiStore.setAddLayerIntent(null);
    uiStore.setEditorMode('editor');
  }, []);

  // Confirm handler for image sequence layer creation + existing key photo flow
  const handleConfirm = useCallback(() => {
    if (selectedIds.length === 0) return;

    const currentIntent = uiStore.addLayerIntent.peek();
    if (currentIntent?.type === 'image-sequence') {
      const sortedIds = [...selectedIds].sort();

      // Change Source flow: update existing layer source
      if (currentIntent.changeSourceFor) {
        layerStore.updateLayer(currentIntent.changeSourceFor.layerId, {
          source: { type: 'image-sequence', imageIds: sortedIds },
          name: `Sequence (${sortedIds.length} images)`,
        });
        setSelectedIds([]);
        uiStore.setAddLayerIntent(null);
        uiStore.setEditorMode('editor');
        return;
      }

      // Content overlay flow: create new content-overlay sequence
      if (currentIntent.target === 'content-overlay') {
        const layerId = crypto.randomUUID();
        const layer: Layer = {
          id: layerId, name: `Sequence (${sortedIds.length} images)`,
          type: 'image-sequence', visible: true, opacity: 1, blendMode: 'normal',
          transform: defaultTransform(),
          source: { type: 'image-sequence', imageIds: sortedIds },
          isBase: false,
        };
        sequenceStore.createContentOverlaySequence(layer.name, layer, totalFrames.peek());
        layerStore.setSelected(layerId);
        uiStore.selectLayer(layerId);
        setSelectedIds([]);
        uiStore.setAddLayerIntent(null);
        uiStore.setEditorMode('editor');
        return;
      }

      // Default flow: add layer to active content sequence
      const layerId = crypto.randomUUID();
      layerStore.add({
        id: layerId, name: `Sequence (${selectedIds.length} images)`,
        type: 'image-sequence', visible: true, opacity: 1, blendMode: 'normal',
        transform: defaultTransform(),
        source: { type: 'image-sequence', imageIds: [...selectedIds] },
        isBase: false,
      });
      layerStore.setSelected(layerId);
      uiStore.selectLayer(layerId);
      setSelectedIds([]);
      uiStore.setAddLayerIntent(null);
      uiStore.setEditorMode('editor');
    } else {
      // Existing key photo flow
      const targetSeqId = uiStore.pendingNewSequenceId.peek() ?? sequenceStore.activeSequenceId.peek();
      if (targetSeqId) {
        for (const imageId of selectedIds) {
          sequenceStore.addKeyPhoto(targetSeqId, imageId);
        }
      }
      uiStore.setPendingNewSequenceId(null);
      setSelectedIds([]);
      uiStore.setEditorMode('editor');
    }
  }, [selectedIds]);

  // Close handler -- intent-aware to prevent cancel-delete collision (pitfall 2)
  const handleClose = useCallback(() => {
    const currentIntent = uiStore.addLayerIntent.peek();
    if (currentIntent) {
      // Add-layer flow: just clear intent, no side effects
      uiStore.setAddLayerIntent(null);
    } else {
      // Existing behavior: check for pending sequence cancel-delete
      const pending = uiStore.pendingNewSequenceId.peek();
      if (pending) {
        sequenceStore.remove(pending);
        uiStore.setPendingNewSequenceId(null);
      }
    }
    setSelectedIds([]);
    uiStore.setEditorMode('editor');
  }, []);

  // Audio selection handler — decode, extract peaks, create audio track
  const handleSelectAudio = useCallback(async (audioAssetId: string) => {
    const asset = imageStore.audioAssets.value.find(a => a.id === audioAssetId);
    if (!asset) return;

    setIsDecodingAudio(true);
    try {
      const fileBytes = await readFile(asset.path);
      const arrayBuffer = fileBytes.buffer;
      const trackId = crypto.randomUUID();
      const audioBuffer = await audioEngine.decode(trackId, arrayBuffer);
      const peaks = computeWaveformPeaks(audioBuffer);
      audioPeaksCache.set(trackId, peaks);
      const outFrame = Math.ceil(audioBuffer.duration * projectStore.fps.peek());

      audioStore.addTrack({
        id: trackId,
        audioAssetId: audioAssetId,
        name: asset.name,
        filePath: asset.path,
        relativePath: 'audio/' + asset.name,
        originalFilename: asset.name,
        offsetFrame: 0,
        inFrame: 0,
        outFrame,
        volume: 1,
        muted: false,
        fadeInFrames: 0,
        fadeOutFrames: 0,
        fadeInCurve: 'exponential',
        fadeOutCurve: 'exponential',
        sampleRate: audioBuffer.sampleRate,
        duration: audioBuffer.duration,
        channelCount: audioBuffer.numberOfChannels,
        order: audioStore.tracks.peek().length,
        trackHeight: 44,
        slipOffset: 0,
        totalFramesInFile: outFrame,
        bpm: null,
        beatOffsetFrames: 0,
        beatMarkers: [],
        showBeatMarkers: false,
      });

      // Auto-detect BPM after adding track
      audioStore.detectAndSetBPM(trackId, projectStore.fps.peek());

      uiStore.setAddLayerIntent(null);
      uiStore.setEditorMode('editor');
    } catch (err) {
      console.error('Failed to decode audio:', err);
    } finally {
      setIsDecodingAudio(false);
    }
  }, []);

  // Import handler -- intent-aware file filter (pitfall 3)
  const handleImport = async () => {
    const currentIntent = uiStore.addLayerIntent.peek();
    if (currentIntent?.type === 'audio') {
      // Audio import flow
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'aac', 'flac', 'm4a', 'aif', 'aiff'] }],
      });
      if (!selected) return;
      const dir = projectStore.dirPath.value ?? tempProjectDir.value;
      if (!dir) return;
      const filePath = typeof selected === 'string' ? selected : selected;
      const filename = filePath.replace(/\\/g, '/').split('/').pop() ?? 'audio';
      const sep = dir.endsWith('/') ? '' : '/';
      const audioDir = `${dir}${sep}audio`;
      try { await mkdir(audioDir, { recursive: true }); } catch { /* exists */ }
      const destPath = `${audioDir}/${filename}`;
      try { await copyFile(filePath, destPath); } catch (err) { console.error('Failed to copy audio:', err); return; }
      // Only add asset if not already imported (same path = same file)
      const existing = imageStore.audioAssets.value.find(a => a.path === destPath);
      if (!existing) {
        imageStore.addAudioAsset({ id: crypto.randomUUID(), name: filename, path: destPath });
      }
    } else if (currentIntent?.type === 'video') {
      // Video import flow
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'webm', 'avi'] }],
      });
      if (!selected) return;
      const dir = projectStore.dirPath.value ?? tempProjectDir.value;
      if (!dir) return;
      const filePath = typeof selected === 'string' ? selected : selected;
      const filename = filePath.replace(/\\/g, '/').split('/').pop() ?? 'video';
      const sep = dir.endsWith('/') ? '' : '/';
      const videosDir = `${dir}${sep}videos`;
      try { await mkdir(videosDir, { recursive: true }); } catch { /* exists */ }
      const destPath = `${videosDir}/${filename}`;
      try { await copyFile(filePath, destPath); } catch (err) { console.error('Failed to copy video:', err); return; }
      imageStore.addVideoAsset({ id: crypto.randomUUID(), name: filename, path: destPath });
    } else {
      // Image import flow (existing behavior)
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'heic', 'heif'] }],
      });
      if (selected) {
        const dir = projectStore.dirPath.value ?? tempProjectDir.value;
        if (!dir) return;
        const paths = Array.isArray(selected) ? selected : [selected];
        imageStore.importFiles(paths, dir);
      }
    }
  };

  // Route onSelect by intent type
  const imageSelectHandler = intent?.type === 'static-image'
    ? handleAddStaticImageLayer
    : !isMultiSelect && isPickingKeyPhoto
      ? handleSelectForKeyPhoto
      : undefined;

  return (
    <div class="flex flex-col flex-1 min-w-0 bg-[var(--color-bg-root)]">
      {/* Header bar */}
      <div class="flex items-center justify-between h-10 px-4 bg-[var(--color-bg-toolbar)] border-b border-[var(--color-separator)] shrink-0">
        <span class="text-sm font-semibold text-[var(--color-text-button)]">
          {headerText}
        </span>
        <div class="flex items-center gap-2">
          {isMultiSelect && (
            <button
              class="rounded-[5px] px-4 py-1.5 transition-colors"
              style={{
                backgroundColor: selectedIds.length > 0 ? 'var(--color-accent)' : 'var(--sidebar-input-bg)',
                opacity: selectedIds.length > 0 ? 1 : 0.5,
                cursor: selectedIds.length > 0 ? 'pointer' : 'default',
              }}
              onClick={selectedIds.length > 0 ? handleConfirm : undefined}
              disabled={selectedIds.length === 0}
            >
              <span class="text-xs text-white font-semibold">Confirm ({selectedIds.length})</span>
            </button>
          )}
          <button
            class="rounded-[5px] bg-[var(--color-accent)] px-3 py-1.5 hover:bg-[var(--color-accent-hover)] transition-colors"
            onClick={handleImport}
          >
            <span class="text-xs text-white">+ Import</span>
          </button>
          <button
            class="w-6 h-6 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-button)] transition-colors"
            onClick={handleClose}
            title={isMultiSelect || isAddLayerFlow ? 'Cancel' : 'Close'}
          >
            &times;
          </button>
        </div>
      </div>

      {/* Import status */}
      {imageStore.isImporting.value && (
        <div class="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-bg-selected)]">
          <div class="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span class="text-[10px] text-[var(--color-text-secondary)]">Importing...</span>
        </div>
      )}

      {/* Import errors */}
      {imageStore.importErrors.value.length > 0 && (
        <div class="px-4 py-1.5 bg-[var(--color-error-bg)]">
          {imageStore.importErrors.value.map((err, i) => (
            <span key={i} class="text-[9px] text-[var(--color-error-text)] block truncate">{err}</span>
          ))}
        </div>
      )}

      {/* Decoding audio overlay */}
      {isDecodingAudio && (
        <div class="flex items-center gap-2 px-4 py-1.5 bg-[var(--color-bg-selected)]">
          <div class="w-3 h-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
          <span class="text-[10px] text-[var(--color-text-secondary)]">Decoding audio...</span>
        </div>
      )}

      {/* Full-size import grid */}
      <div class="flex-1 overflow-y-auto p-4">
        <ImportGrid
          onSelect={imageSelectHandler}
          multiSelect={isMultiSelect}
          selectedIds={isMultiSelect ? selectedIds : undefined}
          onToggleSelect={isMultiSelect ? handleToggleSelect : undefined}
          assetFilter={assetFilter}
          onVideoSelect={intent?.type === 'video' ? handleAddVideoLayer : undefined}
          onAudioSelect={isAudioFlow ? handleSelectAudio : undefined}
        />
      </div>
    </div>
  );
}
