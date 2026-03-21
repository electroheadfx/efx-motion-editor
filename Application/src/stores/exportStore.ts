import {signal, computed} from '@preact/signals';
import type {ExportFormat, ExportResolution, ExportSettings, ExportProgress} from '../types/export';

const format = signal<ExportFormat>('png');
const resolution = signal<ExportResolution>(1);
const outputFolder = signal<string | null>(null);
const namingPattern = signal('{name}_{frame}.png');
const videoQuality = signal({
  h264Crf: 18,
  av1Crf: 23,
  proresProfile: 'hq' as const,
});

const progress = signal<ExportProgress>({
  status: 'idle',
  currentFrame: 0,
  totalFrames: 0,
  estimatedSecondsRemaining: null,
  errorMessage: null,
  resumeFromFrame: null,
  outputPath: null,
});

const cancelled = signal(false);

const settings = computed<ExportSettings>(() => ({
  format: format.value,
  resolution: resolution.value,
  outputFolder: outputFolder.value,
  namingPattern: namingPattern.value,
  videoQuality: videoQuality.value,
}));

/** True when export is actively running (rendering or encoding) */
const isExporting = computed(() => {
  const s = progress.value.status;
  return s === 'preparing' || s === 'rendering' || s === 'encoding';
});

export const exportStore = {
  format,
  resolution,
  outputFolder,
  namingPattern,
  videoQuality,
  progress,
  cancelled,
  settings,
  isExporting,

  setFormat(f: ExportFormat) { format.value = f; },
  setResolution(r: ExportResolution) { resolution.value = r; },
  setOutputFolder(path: string | null) { outputFolder.value = path; },

  updateProgress(partial: Partial<ExportProgress>) {
    progress.value = { ...progress.value, ...partial };
  },

  resetProgress() {
    progress.value = {
      status: 'idle', currentFrame: 0, totalFrames: 0,
      estimatedSecondsRemaining: null, errorMessage: null,
      resumeFromFrame: null, outputPath: null,
    };
    cancelled.value = false;
  },

  cancel() { cancelled.value = true; },
  isCancelled() { return cancelled.peek(); },
};
