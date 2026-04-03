import {signal, computed} from '@preact/signals';
import type {ExportFormat, ExportResolution, ExportSettings, ExportProgress} from '../types/export';
import {configGetExportFolder, configSetExportFolder, configGetExportNamingPattern, configSetExportNamingPattern, configGetVideoQuality, configSetVideoQuality} from '../lib/ipc';

const format = signal<ExportFormat>('png');
const resolution = signal<ExportResolution>(1);
const outputFolder = signal<string | null>(null);
const namingPattern = signal('{name}_{frame}.png');
const includeAudio = signal(true);
const videoQuality = signal<ExportSettings['videoQuality']>({
  h264Crf: 18,
  av1Crf: 23,
  proresProfile: 'hq',
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

const motionBlurEnabled = signal(false);
const motionBlurShutterAngle = signal(180);
const motionBlurSubFrames = signal(32);
const selectedSequenceOnly = signal(false);

const cancelled = signal(false);

const settings = computed<ExportSettings>(() => ({
  format: format.value,
  resolution: resolution.value,
  outputFolder: outputFolder.value,
  namingPattern: namingPattern.value,
  videoQuality: videoQuality.value,
  includeAudio: includeAudio.value,
  motionBlur: {
    enabled: motionBlurEnabled.value,
    shutterAngle: motionBlurShutterAngle.value,
    subFrames: motionBlurSubFrames.value,
  },
  selectedSequenceOnly: selectedSequenceOnly.value,
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
  includeAudio,
  motionBlurEnabled,
  motionBlurShutterAngle,
  motionBlurSubFrames,
  selectedSequenceOnly,
  progress,
  cancelled,
  settings,
  isExporting,

  setFormat(f: ExportFormat) { format.value = f; },
  setResolution(r: ExportResolution) { resolution.value = r; },
  setOutputFolder(path: string | null) {
    outputFolder.value = path;
    if (path) configSetExportFolder(path);
  },
  setNamingPattern(pattern: string) {
    namingPattern.value = pattern;
    configSetExportNamingPattern(pattern);
  },
  setIncludeAudio(v: boolean) { includeAudio.value = v; },
  setMotionBlurEnabled(v: boolean) { motionBlurEnabled.value = v; },
  setMotionBlurShutterAngle(v: number) { motionBlurShutterAngle.value = Math.max(0, Math.min(360, v)); },
  setMotionBlurSubFrames(v: number) { motionBlurSubFrames.value = v; },
  setSelectedSequenceOnly(v: boolean) { selectedSequenceOnly.value = v; },
  setVideoQuality(q: typeof videoQuality.value) {
    videoQuality.value = q;
    configSetVideoQuality(q as Record<string, unknown>);
  },

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

  async initFromConfig() {
    const folderResult = await configGetExportFolder();
    if (folderResult.ok && folderResult.data) {
      outputFolder.value = folderResult.data;
    }
    const patternResult = await configGetExportNamingPattern();
    if (patternResult.ok && patternResult.data) {
      namingPattern.value = patternResult.data;
    }
    const qualityResult = await configGetVideoQuality();
    if (qualityResult.ok && qualityResult.data) {
      const q = qualityResult.data as Record<string, unknown>;
      videoQuality.value = {
        h264Crf: (q.h264Crf as number) ?? 18,
        av1Crf: (q.av1Crf as number) ?? 23,
        proresProfile: (q.proresProfile as string ?? 'hq') as 'proxy' | 'lt' | 'standard' | 'hq',
      };
    }
  },
};
