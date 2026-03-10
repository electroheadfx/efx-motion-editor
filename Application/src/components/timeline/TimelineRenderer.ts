import type {TrackLayout, FxTrackLayout} from '../../types/timeline';
import type {imageStore as ImageStoreType} from '../../stores/imageStore';
import {ThumbnailCache} from './ThumbnailCache';

// --- Design constants (exported for TimelineInteraction) ---
export const BASE_FRAME_WIDTH = 60;
export const TRACK_HEIGHT = 52;
export const TRACK_HEADER_WIDTH = 80;
export const RULER_HEIGHT = 24;
export const FX_TRACK_HEIGHT = 28;

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
const FX_TRACK_BG = '#0D0D0D';
const FX_TRACK_HEADER_BG = '#0A0A0A';

export interface DragState {
  fromIndex: number;
  toIndex: number;
  currentY: number;
}

export interface FxDragState {
  fromIndex: number;
  toIndex: number;
  currentY: number;
}

export interface DrawState {
  frame: number;
  zoom: number;
  scrollX: number;
  scrollY: number;
  tracks: TrackLayout[];
  fxTracks: FxTrackLayout[];
  imageStore: typeof ImageStoreType;
  totalFrames: number;
  selectedFxSequenceId?: string | null;
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
  private fxDragState: FxDragState | null = null;
  private selectedFxSequenceId: string | null = null;
  /** Number of FX tracks (used by TimelineInteraction for layout calculations) */
  fxTrackCount = 0;
  /** Last scrollY value (used by TimelineInteraction for hit-testing) */
  private lastScrollY = 0;

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

    const {frame, zoom, scrollX, scrollY, tracks, fxTracks, imageStore, totalFrames} = state;
    this.fxTrackCount = fxTracks.length;
    this.lastScrollY = scrollY;
    if (state.selectedFxSequenceId !== undefined) {
      this.selectedFxSequenceId = state.selectedFxSequenceId;
    }
    const ctx = this.ctx;
    const frameWidth = BASE_FRAME_WIDTH * zoom;
    const w = this.displayWidth;
    const h = this.displayHeight;

    // Clear canvas
    ctx.clearRect(0, 0, w, h);

    // 1. Draw time ruler
    this.drawRuler(ctx, frameWidth, scrollX, w, totalFrames);

    // 1.5. Clip below ruler and apply scrollY for FX + content tracks
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, RULER_HEIGHT, w, h - RULER_HEIGHT);
    ctx.clip();
    ctx.translate(0, -scrollY);

    // Draw FX track rows (above content tracks, scrolled)
    let fxTrackY = RULER_HEIGHT;
    for (let fi = 0; fi < fxTracks.length; fi++) {
      const isSelected = fxTracks[fi].sequenceId === this.selectedFxSequenceId;
      this.drawFxTrack(ctx, fxTracks[fi], fxTrackY, frameWidth, scrollX, w, isSelected);
      fxTrackY += FX_TRACK_HEIGHT;
    }

    // FX reorder visual feedback (drop indicator + ghost)
    if (this.fxDragState) {
      const {fromIndex, toIndex, currentY} = this.fxDragState;
      const canvasRect = this.canvas.getBoundingClientRect();

      // Drop indicator line between FX tracks
      const dropY = RULER_HEIGHT + toIndex * FX_TRACK_HEIGHT;
      ctx.fillStyle = DROP_INDICATOR_COLOR;
      ctx.fillRect(0, dropY - 1, w, 2);

      // Ghost FX track at mouse Y
      const ghostY = currentY - canvasRect.top - FX_TRACK_HEIGHT / 2 + scrollY;
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = FX_TRACK_HEADER_BG;
      ctx.fillRect(0, ghostY, TRACK_HEADER_WIDTH, FX_TRACK_HEIGHT);
      if (fromIndex < fxTracks.length) {
        const ghostTrack = fxTracks[fromIndex];
        ctx.fillStyle = ghostTrack.color;
        ctx.beginPath();
        ctx.arc(9, ghostY + FX_TRACK_HEIGHT / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#999999';
        ctx.font = '9px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const ghostName = this.truncateText(ctx, ghostTrack.sequenceName, TRACK_HEADER_WIDTH - 16);
        ctx.fillText(ghostName, 16, ghostY + FX_TRACK_HEIGHT / 2);
      }
      ctx.fillStyle = FX_TRACK_BG;
      ctx.fillRect(TRACK_HEADER_WIDTH, ghostY, w - TRACK_HEADER_WIDTH, FX_TRACK_HEIGHT);
      ctx.globalAlpha = 1.0;
    }

    // 2. Draw content track rows (below FX tracks, scrolled)
    const fxOffset = fxTracks.length * FX_TRACK_HEIGHT;
    let trackY = RULER_HEIGHT + fxOffset;
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

    // 2b. Draw drag visual feedback (drop indicator line) in scrolled space
    if (this.dragState) {
      const {fromIndex, toIndex, currentY} = this.dragState;
      const canvasRect = this.canvas.getBoundingClientRect();

      // Draw drop indicator line between tracks (offset by FX tracks)
      const dropY = RULER_HEIGHT + fxOffset + toIndex * TRACK_HEIGHT;
      ctx.fillStyle = DROP_INDICATOR_COLOR;
      ctx.fillRect(0, dropY - 1, w, 2);

      // Draw ghost of the dragged track at current mouse Y position (in scrolled space)
      const ghostY = currentY - canvasRect.top - TRACK_HEIGHT / 2 + scrollY;
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

    // End scrolled region
    ctx.restore();

    // 3. Draw playhead line in screen space (spans full height, not affected by scroll)
    const playheadX = frame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
    if (playheadX >= TRACK_HEADER_WIDTH && playheadX <= w) {
      ctx.strokeStyle = PLAYHEAD_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, RULER_HEIGHT);
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

  /** Draw a single FX sequence as a colored range bar */
  private drawFxTrack(
    ctx: CanvasRenderingContext2D,
    fxTrack: FxTrackLayout,
    y: number,
    frameWidth: number,
    scrollX: number,
    canvasWidth: number,
    isSelected = false,
  ): void {
    // Track background (highlight when selected)
    ctx.fillStyle = isSelected ? '#1A1520' : FX_TRACK_BG;
    ctx.fillRect(0, y, canvasWidth, FX_TRACK_HEIGHT);

    // Selection indicator: left accent border
    if (isSelected) {
      ctx.fillStyle = fxTrack.color;
      ctx.fillRect(0, y, 2, FX_TRACK_HEIGHT);
    }

    // Track header
    const isVisible = fxTrack.visible;
    ctx.fillStyle = isSelected ? '#151015' : FX_TRACK_HEADER_BG;
    ctx.fillRect(isSelected ? 2 : 0, y, TRACK_HEADER_WIDTH - (isSelected ? 2 : 0), FX_TRACK_HEIGHT);
    ctx.fillStyle = isVisible ? fxTrack.color : fxTrack.color + '4D'; // 30% opacity when hidden
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const name = this.truncateText(ctx, fxTrack.sequenceName, TRACK_HEADER_WIDTH - 16);
    // Color dot + name
    const dotX = 6;
    const dotY = y + FX_TRACK_HEIGHT / 2;
    ctx.beginPath();
    ctx.arc(dotX + 3, dotY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isVisible ? '#999999' : '#555555';
    ctx.fillText(name, dotX + 10, dotY);

    // Range bar
    const barX = fxTrack.inFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
    const barW = (fxTrack.outFrame - fxTrack.inFrame) * frameWidth;
    const barY = y + 4;
    const barH = FX_TRACK_HEIGHT - 8;

    // Only draw if in viewport
    if (barX + barW >= TRACK_HEADER_WIDTH && barX <= canvasWidth) {
      const clippedLeft = Math.max(barX, TRACK_HEADER_WIDTH);
      const clippedW = Math.min(barW, canvasWidth - clippedLeft);

      // Bar fill (semi-transparent FX color)
      ctx.fillStyle = fxTrack.color + (isVisible ? '40' : '26'); // 25% or 15% opacity
      ctx.beginPath();
      ctx.roundRect(clippedLeft, barY, clippedW, barH, 3);
      ctx.fill();

      // Bar border
      ctx.strokeStyle = fxTrack.color + (isVisible ? '80' : '40'); // 50% or 25% opacity
      ctx.lineWidth = 1;
      ctx.stroke();

      // Left edge handle (drag to resize inFrame)
      if (barX >= TRACK_HEADER_WIDTH) {
        ctx.fillStyle = fxTrack.color;
        ctx.fillRect(barX, barY + 2, 3, barH - 4);
      }

      // Right edge handle (drag to resize outFrame)
      const rightEdge = barX + barW;
      if (rightEdge >= TRACK_HEADER_WIDTH && rightEdge <= canvasWidth) {
        ctx.fillStyle = fxTrack.color;
        ctx.fillRect(rightEdge - 3, barY + 2, 3, barH - 4);
      }
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

  /** Get the number of FX tracks currently rendered */
  getFxTrackCount(): number {
    return this.fxTrackCount;
  }

  /** Get the last scrollY value (used by TimelineInteraction for hit-testing) */
  getScrollY(): number {
    return this.lastScrollY;
  }

  /** Set drag state for track reorder visual feedback */
  setDragState(state: DragState | null) {
    this.dragState = state;
    if (this.lastState) {
      this.draw(this.lastState);
    }
  }

  /** Set FX drag state for FX reorder visual feedback */
  setFxDragState(state: FxDragState | null) {
    this.fxDragState = state;
    if (this.lastState) {
      this.draw(this.lastState);
    }
  }

  /** Set selected FX sequence for highlight rendering */
  setSelectedFxSequenceId(id: string | null) {
    this.selectedFxSequenceId = id;
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
