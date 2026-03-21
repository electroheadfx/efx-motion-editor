import { PreviewRenderer } from './previewRenderer';
import { renderGlobalFrame, preloadExportImages } from './exportRenderer';
import { frameMap, crossDissolveOverlaps } from './frameMap';
import { sequenceStore } from '../stores/sequenceStore';
import { projectStore } from '../stores/projectStore';
import { exportStore } from '../stores/exportStore';
import { exportCreateDir, exportWritePng, exportCheckFfmpeg, exportDownloadFfmpeg, exportEncodeVideo } from './ipc';
import { generateJsonSidecar, generateFcpxml } from './exportSidecar';

/**
 * Convert canvas to PNG blob, then to Uint8Array for IPC.
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('toBlob returned null')),
      'image/png',
    );
  });
}

async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Format frame number into filename per D-16: project_name_[####].png
 * Zero-padded to at least 4 digits (or more if totalFrames >= 10000).
 */
function formatFrameFilename(
  projectName: string,
  frameNumber: number,
  totalFrames: number,
  pattern: string,
): string {
  const digits = Math.max(4, String(totalFrames).length);
  const paddedFrame = String(frameNumber).padStart(digits, '0');
  const sanitizedName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
  // Default pattern: '{name}_{frame}.png'
  return pattern
    .replace('{name}', sanitizedName)
    .replace('{frame}', paddedFrame);
}

/**
 * Start a full PNG export. Called from ExportView Export button.
 * Returns when complete, cancelled, or errored.
 */
export async function startExport(startFromFrame = 0): Promise<void> {
  const settings = exportStore.settings.peek();
  if (!settings.outputFolder) {
    exportStore.updateProgress({ status: 'error', errorMessage: 'No output folder selected' });
    return;
  }

  const fm = frameMap.peek();
  const total = fm.length;
  if (total === 0) {
    exportStore.updateProgress({ status: 'error', errorMessage: 'No frames to export (timeline is empty)' });
    return;
  }

  const allSeqs = sequenceStore.sequences.peek();
  const overlaps = crossDissolveOverlaps.peek();
  const projectName = projectStore.name.peek();
  const projectWidth = projectStore.width.peek();
  const projectHeight = projectStore.height.peek();

  // Compute export resolution (D-05: project resolution * multiplier)
  // Do NOT apply devicePixelRatio (Research Pitfall 1)
  const exportWidth = Math.round(projectWidth * settings.resolution);
  const exportHeight = Math.round(projectHeight * settings.resolution);

  exportStore.resetProgress();
  exportStore.updateProgress({
    status: 'preparing',
    totalFrames: total,
    currentFrame: startFromFrame,
  });

  try {
    // 1. Create export directory (D-18: timestamped subfolder)
    // If resuming, reuse the existing outputPath instead of creating new
    let exportDir: string;
    if (startFromFrame > 0 && exportStore.progress.peek().outputPath) {
      exportDir = exportStore.progress.peek().outputPath!;
    } else {
      const dirResult = await exportCreateDir(settings.outputFolder);
      if (!dirResult.ok) {
        exportStore.updateProgress({ status: 'error', errorMessage: dirResult.error });
        return;
      }
      exportDir = dirResult.data;
    }
    exportStore.updateProgress({ outputPath: exportDir });

    // 2. Create offscreen canvas at export resolution
    const canvas = document.createElement('canvas');
    canvas.width = exportWidth;
    canvas.height = exportHeight;

    // 3. Create renderer for the offscreen canvas
    const renderer = new PreviewRenderer(canvas);

    // 4. Preload all images
    await preloadExportImages(renderer, fm);

    // 5. Export loop with yielding and cancel support
    exportStore.updateProgress({ status: 'rendering' });
    const frameTimes: number[] = []; // rolling window for ETA

    for (let frame = startFromFrame; frame < total; frame++) {
      // Check cancel between frames
      if (exportStore.isCancelled()) {
        exportStore.updateProgress({
          status: 'cancelled',
          resumeFromFrame: frame,
        });
        return;
      }

      const frameStart = performance.now();

      // Render frame
      renderGlobalFrame(renderer, canvas, frame, fm, allSeqs, overlaps);

      // Extract PNG
      const blob = await canvasToBlob(canvas);
      const bytes = await blobToUint8Array(blob);

      // Write to disk
      const filename = formatFrameFilename(
        projectName, frame, total, settings.namingPattern,
      );
      const writeResult = await exportWritePng(exportDir, filename, Array.from(bytes));
      if (!writeResult.ok) {
        exportStore.updateProgress({
          status: 'error',
          errorMessage: `Failed to write frame ${frame}: ${writeResult.error}`,
          resumeFromFrame: frame,
        });
        return;
      }

      // Update progress with ETA
      const frameTime = performance.now() - frameStart;
      frameTimes.push(frameTime);
      if (frameTimes.length > 20) frameTimes.shift(); // rolling window of 20
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const remainingFrames = total - frame - 1;
      const estimatedMs = avgFrameTime * remainingFrames;

      exportStore.updateProgress({
        currentFrame: frame + 1,
        estimatedSecondsRemaining: Math.round(estimatedMs / 1000),
      });

      // Yield to event loop for UI responsiveness (D-28)
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 6. Write JSON sidecar (D-21)
    const sidecarJson = generateJsonSidecar({
      projectName,
      fps: projectStore.fps.peek(),
      width: exportWidth,
      height: exportHeight,
      totalFrames: total,
      resolution: settings.resolution,
      format: settings.format,
      namingPattern: settings.namingPattern,
      sequences: allSeqs,
    });
    const sidecarFilename = `${projectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_metadata.json`;
    const sidecarBytes = new TextEncoder().encode(sidecarJson);
    await exportWritePng(exportDir, sidecarFilename, Array.from(sidecarBytes));

    // 7. If video format, encode with FFmpeg (per D-03, D-08)
    if (settings.format !== 'png') {
      exportStore.updateProgress({ status: 'encoding' });

      // Check if FFmpeg is available, download if not (D-08, D-11)
      const ffmpegCheck = await exportCheckFfmpeg();
      if (!ffmpegCheck.ok || !ffmpegCheck.data) {
        exportStore.updateProgress({
          status: 'preparing',
          // Reuse preparing status for download indication
        });
        const downloadResult = await exportDownloadFfmpeg();
        if (!downloadResult.ok) {
          exportStore.updateProgress({
            status: 'error',
            errorMessage: `Failed to download FFmpeg: ${downloadResult.error}`,
          });
          return;
        }
      }

      // Build output filename per D-19: ProjectName_ResolutionP_codec.ext
      const resLabel = `${exportHeight}p`;
      const codecLabel = settings.format === 'prores' ? 'prores'
        : settings.format === 'h264' ? 'h264'
        : 'av1';
      const ext = settings.format === 'prores' ? '.mov' : '.mp4';
      const sanitizedName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const videoFilename = `${sanitizedName}_${resLabel}_${codecLabel}${ext}`;
      const videoOutputPath = `${exportDir}/${videoFilename}`;

      // Build FFmpeg glob pattern from naming pattern
      // Convert '{name}_{frame}.png' to 'ProjectName_%04d.png' for FFmpeg
      const digits = Math.max(4, String(total).length);
      const ffmpegPattern = settings.namingPattern
        .replace('{name}', sanitizedName)
        .replace('{frame}', `%0${digits}d`);

      const codecMap: Record<string, string> = {
        prores: 'prores',
        h264: 'h264',
        av1: 'av1',
      };

      const encodeResult = await exportEncodeVideo(
        exportDir,
        ffmpegPattern,
        videoOutputPath,
        codecMap[settings.format] || 'h264',
        projectStore.fps.peek(),
        settings.videoQuality.h264Crf,
        settings.videoQuality.av1Crf,
        settings.videoQuality.proresProfile,
      );

      if (!encodeResult.ok) {
        exportStore.updateProgress({
          status: 'error',
          errorMessage: `Video encoding failed: ${encodeResult.error}`,
        });
        return;
      }

      // Write FCPXML sidecar for ProRes only (per D-22)
      if (settings.format === 'prores') {
        const fcpxml = generateFcpxml(
          projectName,
          projectStore.fps.peek(),
          exportWidth,
          exportHeight,
          total,
          videoFilename,
        );
        const fcpxmlFilename = `${sanitizedName}.fcpxml`;
        const fcpxmlBytes = new TextEncoder().encode(fcpxml);
        await exportWritePng(exportDir, fcpxmlFilename, Array.from(fcpxmlBytes));
      }
    }

    // 8. Complete
    exportStore.updateProgress({ status: 'complete' });

    // 9. macOS notification if app is in background (D-31)
    if (document.hidden) {
      try {
        const { isPermissionGranted, requestPermission, sendNotification } =
          await import('@tauri-apps/plugin-notification');
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === 'granted';
        }
        if (granted) {
          sendNotification({
            title: 'Export Complete',
            body: `${projectName} exported ${total} frames to ${exportDir}`,
          });
        }
      } catch {
        // Notification plugin not available — silently ignore
      }
    }

  } catch (err) {
    exportStore.updateProgress({
      status: 'error',
      errorMessage: String(err),
      resumeFromFrame: exportStore.progress.peek().currentFrame,
    });
  }
}

/**
 * Resume export from the last successfully rendered frame (per D-29).
 */
export async function resumeExport(): Promise<void> {
  const resumeFrame = exportStore.progress.peek().resumeFromFrame;
  if (resumeFrame == null) return;
  await startExport(resumeFrame);
}
