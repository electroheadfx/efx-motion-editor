export type FadeCurve = 'linear' | 'exponential' | 'logarithmic';

export interface AudioTrack {
  id: string;
  name: string;
  filePath: string;           // Absolute path to audio file on disk
  relativePath: string;       // Relative path within project dir (for .mce persistence)
  originalFilename: string;   // Original filename for display in properties panel
  offsetFrame: number;        // Start position on timeline (frame 0 = project start); can be negative
  inFrame: number;            // Trim in-point (frames from audio file start)
  outFrame: number;           // Trim out-point (frames from audio file start)
  volume: number;             // 0 to 1 linear
  muted: boolean;
  fadeInFrames: number;       // Fade-in duration in frames
  fadeOutFrames: number;      // Fade-out duration in frames
  fadeInCurve: FadeCurve;     // Default 'exponential' per D-21
  fadeOutCurve: FadeCurve;    // Default 'exponential' per D-21
  sampleRate: number;         // From decoded AudioBuffer
  duration: number;           // Total duration in seconds
  channelCount: number;       // Number of channels (for metadata display)
  order: number;              // Reorder position among audio tracks per D-07
  trackHeight: number;        // Per-track height, default 44 per D-01
  slipOffset: number;         // Audio content offset within in/out range (frames) per D-09
  totalFramesInFile: number;  // Total frames in the source audio file (immutable after import)
}

/** Serialized audio track format for .mce v8 project files (snake_case) */
export interface MceAudioTrack {
  id: string;
  name: string;
  relative_path: string;
  original_filename: string;
  offset_frame: number;
  in_frame: number;
  out_frame: number;
  volume: number;
  muted: boolean;
  fade_in_frames: number;
  fade_out_frames: number;
  fade_in_curve: string;
  fade_out_curve: string;
  sample_rate: number;
  duration: number;
  channel_count: number;
  order: number;
  track_height: number;
  slip_offset: number;
  total_frames_in_file: number;
}

/** Pre-computed waveform peak data at 3 resolution tiers per D-04 */
export interface WaveformPeaks {
  /** Peak envelope: ~100 samples for extreme zoom-out */
  tier1: Float32Array;
  /** Standard: ~2000 samples for 100% zoom */
  tier2: Float32Array;
  /** Detailed: ~8000 samples for zoomed-in view */
  tier3: Float32Array;
}
