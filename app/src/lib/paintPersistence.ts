/**
 * Paint sidecar file persistence (per D-14).
 *
 * Paint data is stored as sidecar JSON files alongside the .mce project file:
 *   ProjectDir/paint/{layer-uuid}/frame-NNN.json
 *
 * Each frame-NNN.json contains a serialized PaintFrame (the elements array).
 * Paint persistence failure is non-fatal -- errors are logged but not thrown.
 */

import {readTextFile, writeTextFile, mkdir, exists, readDir, remove} from '@tauri-apps/plugin-fs';
import type {PaintFrame, PaintStroke} from '../types/paint';
import {paintStore} from '../stores/paintStore';
import {renderFrameFx} from './brushP5Adapter';
import {projectStore} from '../stores/projectStore';

/**
 * Save dirty paint frames to sidecar files.
 * Called BEFORE the .mce file is saved (per Research Pitfall 5).
 */
export async function savePaintData(projectDir: string): Promise<void> {
  const dirtyFrames = paintStore.getDirtyFrames();
  if (dirtyFrames.length === 0) return;

  for (const {layerId, frame} of dirtyFrames) {
    try {
      const layerDir = projectDir + '/paint/' + layerId;
      await mkdir(layerDir, {recursive: true});

      const paddedFrame = String(frame).padStart(3, '0');
      const filePath = layerDir + '/frame-' + paddedFrame + '.json';

      const frameData = paintStore.getFrame(layerId, frame);
      if (frameData && frameData.elements.length > 0) {
        await writeTextFile(filePath, JSON.stringify(frameData));
      } else {
        // Frame is empty or null -- remove the file if it exists
        try {
          if (await exists(filePath)) {
            await remove(filePath);
          }
        } catch (removeErr) {
          console.error(`Failed to remove empty paint frame file ${filePath} (non-fatal):`, removeErr);
        }
      }
    } catch (err) {
      console.error(`Failed to save paint frame ${layerId}:${frame} (non-fatal):`, err);
    }
  }
}

/**
 * Load paint data from sidecar files for the given layer IDs.
 * Called after hydrating sequences from the .mce file.
 */
export async function loadPaintData(projectDir: string, layerIds: string[]): Promise<void> {
  for (const layerId of layerIds) {
    try {
      const layerDir = projectDir + '/paint/' + layerId;
      const dirExists = await exists(layerDir);
      if (!dirExists) continue;

      const entries = await readDir(layerDir);
      for (const entry of entries) {
        try {
          const filename = entry.name;
          if (!filename) continue;

          const match = filename.match(/^frame-(\d+)\.json$/);
          if (!match) continue;

          const frameNum = parseInt(match[1], 10);
          const filePath = layerDir + '/' + filename;
          const json = await readTextFile(filePath);
          const paintFrame: PaintFrame = JSON.parse(json);

          paintStore.loadFrame(layerId, frameNum, paintFrame);

          // Regenerate frame-level FX cache for frames with FX-applied strokes (per PAINT-13)
          const projW = projectStore.width.peek();
          const projH = projectStore.height.peek();
          if (projW > 0 && projH > 0) {
            const hasFxStrokes = paintFrame.elements.some((el) => {
              if (el.tool !== 'brush') return false;
              const s = el as PaintStroke;
              return s.fxState === 'fx-applied' && s.brushStyle && s.brushStyle !== 'flat';
            });

            if (hasFxStrokes) {
              try {
                const brushStrokes = paintFrame.elements.filter(
                  (el) => el.tool === 'brush'
                ) as PaintStroke[];
                const fxCanvas = renderFrameFx(brushStrokes, projW, projH);
                if (fxCanvas) {
                  paintStore.setFrameFxCache(layerId, frameNum, fxCanvas);
                }
              } catch (e) {
                console.warn(`[paintPersistence] Failed to regenerate frame FX cache for ${layerId}:${frameNum}:`, e);
              }
            }
          }
        } catch (fileErr) {
          console.error(`Failed to load paint frame file ${entry.name} for layer ${layerId} (non-fatal):`, fileErr);
        }
      }
    } catch (err) {
      console.error(`Failed to load paint data for layer ${layerId} (non-fatal):`, err);
    }
  }

  // Trigger canvas re-render after all FX caches are regenerated
  paintStore.paintVersion.value++;
}

/**
 * Remove orphaned paint directories for layers that no longer exist.
 * Called during project save after paint data is written.
 */
export async function cleanupOrphanedPaintFiles(projectDir: string, activeLayerIds: string[]): Promise<void> {
  try {
    const paintDir = projectDir + '/paint';
    const dirExists = await exists(paintDir);
    if (!dirExists) return;

    const entries = await readDir(paintDir);
    const activeSet = new Set(activeLayerIds);

    for (const entry of entries) {
      const dirName = entry.name;
      if (!dirName || dirName === '.DS_Store') continue;

      // If this directory is not for an active paint layer, remove it
      if (!activeSet.has(dirName)) {
        try {
          await remove(paintDir + '/' + dirName, {recursive: true});
        } catch (removeErr) {
          console.error(`Failed to remove orphaned paint directory ${dirName} (non-fatal):`, removeErr);
        }
      }
    }
  } catch (err) {
    console.error('Failed to cleanup orphaned paint files (non-fatal):', err);
  }
}

/**
 * Get all paint layer IDs that have sidecar data on disk.
 * Returns subdirectory names under the paint/ directory.
 */
export async function getPaintLayerIds(projectDir: string): Promise<string[]> {
  try {
    const paintDir = projectDir + '/paint';
    const dirExists = await exists(paintDir);
    if (!dirExists) return [];

    const entries = await readDir(paintDir);
    return entries
      .filter(entry => entry.name != null)
      .map(entry => entry.name!);
  } catch (err) {
    console.error('Failed to get paint layer IDs (non-fatal):', err);
    return [];
  }
}
