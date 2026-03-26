export type ExportFormat = 'png' | 'prores' | 'h264' | 'av1';

export type ExportResolution = 0.15 | 0.25 | 0.5 | 1 | 2;

export interface ExportSettings {
  format: ExportFormat;
  resolution: ExportResolution;
  outputFolder: string | null;
  /** DaVinci Resolve naming pattern per D-16. Default: '{name}_{frame}.png' */
  namingPattern: string;
  /** Per-codec quality settings per D-13/D-14 */
  videoQuality: {
    h264Crf: number;   // default 18
    av1Crf: number;    // default 23
    proresProfile: 'proxy' | 'lt' | 'standard' | 'hq'; // default 'hq'
  };
  includeAudio: boolean;  // Default true; false = export video-only. Per D-04
  motionBlur: {
    enabled: boolean;
    shutterAngle: number;       // 0-360 degrees, default from project
    subFrames: number;           // 8, 16, 32, 64, or 128
  };
  /** When true, export only the active sequence instead of the full timeline */
  selectedSequenceOnly: boolean;
}

export interface ExportProgress {
  status: 'idle' | 'preparing' | 'rendering' | 'encoding' | 'complete' | 'error' | 'cancelled';
  currentFrame: number;
  totalFrames: number;
  /** Estimated seconds remaining, computed from rolling average of frame render times */
  estimatedSecondsRemaining: number | null;
  /** Error message if status === 'error' */
  errorMessage: string | null;
  /** Frame number to resume from if error occurred (per D-29) */
  resumeFromFrame: number | null;
  /** Path to the export output folder */
  outputPath: string | null;
}
