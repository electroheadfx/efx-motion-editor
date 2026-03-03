import type {TrackLayout} from '../../types/timeline';
import type {imageStore as ImageStoreType} from '../../stores/imageStore';
import {ThumbnailCache} from './ThumbnailCache';

// --- Design constants (exported for TimelineInteraction) ---
export const BASE_FRAME_WIDTH = 60;
export const TRACK_HEIGHT = 52;
export const TRACK_HEADER_WIDTH = 80;
export const RULER_HEIGHT = 24;

const PLAYHEAD_COLOR = '#E55A2B';
const TRACK_BG = '#111111';
const TRACK_HEADER_BG = '#0D0D0D';
const FRAME_BORDER_COLOR = '#222222';
const RULER_BG = '#0A0A0A';
const RULER_TEXT_COLOR = '#666666';
const TRACK_NAME_COLOR = '#999999';
const PLACEHOLDER_BG_A = '#1A1A2A';
const PLACEHOLDER_BG_B = '#1A2A1A';
const PLAYHEAD_TRIANGLE_SIZE = 6;
const DROP_INDICATOR_COLOR = '#4488FF';

export interface DragState {
  fromIndex: number;
  toIndex: number;
  currentY: number;
}

export interface DrawState {
  frame: number;
  zoom: number;
  scrollX: number;
  tracks: TrackLayout[];
  imageStore: typeof ImageStoreType;
  totalFrames: number;
}

/**
 * TimelineRenderer: Pure Canvas 2D drawing for the timeline.
 *
 * Receives all state via draw() parameters -- no signal subscriptions.
 * Handles Retina DPI scaling, virtualized frame rendering, track rows,
 * playhead line, and time ruler.
 */
export class TimelineRenderer {
  private ctx: CanvasRenderingContext2D;
  private displayWidth = 0;
  private displayHeight = 0;
  private dpr = 1;
  private thumbnailCache: ThumbnailCache;
  private lastState: DrawState | null = null;
  private dragState: DragState | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2D context from canvas');
    this.ctx = ctx;

    this.thumbnailCache = new ThumbnailCache();
    this.thumbnailCache.onLoad = () => {
      if (this.lastState) {
        this.draw(this.lastState);
      }
    };

    this.setupCanvas();
  }

  /** Set up canvas for Retina/HiDPI displays */
  private setupCanvas() {
    this.dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
    this.displayWidth = rect.width;
    this.displayHeight = rect.height;
  }

  /** Called on container resize via ResizeObserver */
  resize() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform before re-setup
    this.setupCanvas();
    if (this.lastState) {
      this.draw(this.lastState);
    }
  }

  /** Main draw call -- receives all state as parameters */
  draw(state: DrawState) {
    this.lastState = state;

    const {frame, zoom, scrollX, tracks, imageStore, totalFrames} = state;
    const ctx = this.ctx;
    const frameWidth = BASE_FRAME_WIDTH * zoom;
    const w = this.displayWidth;
    const h = this.displayHeight;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // 1. Draw time ruler
    this.drawRuler(ctx, frameWidth, scrollX, w, totalFrames);

    // 2. Draw track rows
    let trackY = RULER_HEIGHT;
    for (let ti = 0; ti < tracks.length; ti++) {
      const track = tracks[ti];

      // Track background
      ctx.fillStyle = TRACK_BG;
      ctx.fillRect(0, trackY, w, TRACK_HEIGHT);

      // Track header
      ctx.fillStyle = TRACK_HEADER_BG;
      ctx.fillRect(0, trackY, TRACK_HEADER_WIDTH, TRACK_HEIGHT);
      ctx.fillStyle = TRACK_NAME_COLOR;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      const name = track.sequenceName || `Seq ${ti + 1}`;
      const truncatedName = this.truncateText(ctx, name, TRACK_HEADER_WIDTH - 12);
      ctx.fillText(truncatedName, 6, trackY + TRACK_HEIGHT / 2);

      // Draw key photo ranges
      for (let ri = 0; ri < track.keyPhotoRanges.length; ri++) {
        const range = track.keyPhotoRanges[ri];
        const rangeX = range.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const rangeWidth = range.holdFrames * frameWidth;

        // Virtualization: skip ranges entirely outside visible area
        if (rangeX + rangeWidth < TRACK_HEADER_WIDTH || rangeX > w) {
          continue;
        }

        // Get image for thumbnail
        const image = imageStore.getById(range.imageId);
        const thumbnailUrl = image ? imageStore.getDisplayUrl(image) : '';
        const cachedImg = thumbnailUrl ? this.thumbnailCache.get(range.imageId, thumbnailUrl) : null;

        // Draw individual frames within this range
        for (let f = 0; f < range.holdFrames; f++) {
          const fx = (range.startFrame + f) * frameWidth - scrollX + TRACK_HEADER_WIDTH;
          const fy = trackY + 2;
          const fw = frameWidth;
          const fh = TRACK_HEIGHT - 4;

          // Virtualization: skip individual frames outside visible area
          if (fx + fw < TRACK_HEADER_WIDTH || fx > w) {
            continue;
          }

          if (cachedImg) {
            // Draw thumbnail image
            ctx.drawImage(cachedImg, fx, fy, fw, fh);
          } else {
            // Draw placeholder
            ctx.fillStyle = ri % 2 === 0 ? PLACEHOLDER_BG_A : PLACEHOLDER_BG_B;
            ctx.fillRect(fx, fy, fw, fh);
            // Show key photo index in placeholder
            ctx.fillStyle = '#555555';
            ctx.font = '9px system-ui, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${ri + 1}`, fx + fw / 2, fy + fh / 2);
            ctx.textAlign = 'start'; // Reset
          }

          // Frame border
          ctx.strokeStyle = FRAME_BORDER_COLOR;
          ctx.lineWidth = 0.5;
          ctx.strokeRect(fx, fy, fw, fh);
        }

        // Key photo separator line (thicker border between different key photos)
        if (ri > 0) {
          const sepX = range.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
          if (sepX >= TRACK_HEADER_WIDTH && sepX <= w) {
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(sepX, trackY + 1);
            ctx.lineTo(sepX, trackY + TRACK_HEIGHT - 1);
            ctx.stroke();
          }
        }
      }

      trackY += TRACK_HEIGHT;
    }

    // 2b. Draw drag visual feedback (drop indicator line)
    if (this.dragState) {
      const {fromIndex, toIndex, currentY} = this.dragState;
      const canvasRect = this.canvas.getBoundingClientRect();

      // Draw drop indicator line between tracks
      const dropY = RULER_HEIGHT + toIndex * TRACK_HEIGHT;
      ctx.fillStyle = DROP_INDICATOR_COLOR;
      ctx.fillRect(0, dropY - 1, w, 2);

      // Draw ghost of the dragged track at current mouse Y position
      const ghostY = currentY - canvasRect.top - TRACK_HEIGHT / 2;
      ctx.globalAlpha = 0.4;

      // Ghost track header
      ctx.fillStyle = TRACK_HEADER_BG;
      ctx.fillRect(0, ghostY, TRACK_HEADER_WIDTH, TRACK_HEIGHT);
      if (fromIndex < tracks.length) {
        const ghostTrack = tracks[fromIndex];
        ctx.fillStyle = TRACK_NAME_COLOR;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const ghostName = ghostTrack.sequenceName || `Seq ${fromIndex + 1}`;
        const truncGhost = this.truncateText(ctx, ghostName, TRACK_HEADER_WIDTH - 12);
        ctx.fillText(truncGhost, 6, ghostY + TRACK_HEIGHT / 2);
      }

      // Ghost track background
      ctx.fillStyle = TRACK_BG;
      ctx.fillRect(TRACK_HEADER_WIDTH, ghostY, w - TRACK_HEADER_WIDTH, TRACK_HEIGHT);

      ctx.globalAlpha = 1.0;
    }

    // 3. Draw playhead line (spans full height)
    const playheadX = frame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
    if (playheadX >= TRACK_HEADER_WIDTH && playheadX <= w) {
      ctx.strokeStyle = PLAYHEAD_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, h);
      ctx.stroke();

      // Playhead triangle (grab handle) at top in the ruler
      ctx.fillStyle = PLAYHEAD_COLOR;
      ctx.beginPath();
      ctx.moveTo(playheadX - PLAYHEAD_TRIANGLE_SIZE, 0);
      ctx.lineTo(playheadX + PLAYHEAD_TRIANGLE_SIZE, 0);
      ctx.lineTo(playheadX, PLAYHEAD_TRIANGLE_SIZE * 1.5);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** Draw the time ruler at the top */
  private drawRuler(
    ctx: CanvasRenderingContext2D,
    frameWidth: number,
    scrollX: number,
    width: number,
    totalFrames: number,
  ) {
    // Ruler background
    ctx.fillStyle = RULER_BG;
    ctx.fillRect(0, 0, width, RULER_HEIGHT);

    // Frame number labels at regular intervals
    ctx.fillStyle = RULER_TEXT_COLOR;
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'center';

    // Determine label interval based on zoom (show fewer labels when zoomed out)
    let interval = 1;
    if (frameWidth < 15) interval = 10;
    else if (frameWidth < 30) interval = 5;
    else if (frameWidth < 50) interval = 2;

    const firstVisible = Math.max(0, Math.floor(scrollX / frameWidth));
    const lastVisible = Math.min(totalFrames, Math.ceil((scrollX + width - TRACK_HEADER_WIDTH) / frameWidth));

    for (let f = firstVisible; f <= lastVisible; f++) {
      if (f % interval !== 0) continue;
      const x = f * frameWidth - scrollX + TRACK_HEADER_WIDTH;
      if (x < TRACK_HEADER_WIDTH || x > width) continue;

      // Tick mark
      ctx.strokeStyle = RULER_TEXT_COLOR;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 6);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      // Frame number label
      ctx.fillText(String(f), x, RULER_HEIGHT - 7);
    }

    ctx.textAlign = 'start'; // Reset
  }

  /** Compute frame number from a clientX position */
  frameFromX(clientX: number, canvasRect: DOMRect, scrollX: number, zoom: number, totalFrames: number): number {
    const x = clientX - canvasRect.left - TRACK_HEADER_WIDTH;
    const frameWidth = BASE_FRAME_WIDTH * zoom;
    const frame = Math.floor((x + scrollX) / frameWidth);
    return Math.max(0, Math.min(frame, totalFrames > 0 ? totalFrames - 1 : 0));
  }

  /** Get the display width (CSS pixels) */
  getDisplayWidth(): number {
    return this.displayWidth;
  }

  /** Set drag state for track reorder visual feedback */
  setDragState(state: DragState | null) {
    this.dragState = state;
    if (this.lastState) {
      this.draw(this.lastState);
    }
  }

  /** Clean up resources */
  destroy() {
    this.thumbnailCache.clear();
    this.lastState = null;
  }

  /** Helper: truncate text to fit within maxWidth */
  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (truncated.length > 0 && ctx.measureText(truncated + '...').width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
  }
}
