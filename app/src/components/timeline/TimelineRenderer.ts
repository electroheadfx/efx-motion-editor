import type {TrackLayout, FxTrackLayout, AudioTrackLayout} from '../../types/timeline';
import type {imageStore as ImageStoreType} from '../../stores/imageStore';
import {computeDownbeatFrames} from '../../lib/beatMarkerEngine';
import {createCanvasGradient} from '../../lib/previewRenderer';
import {ThumbnailCache} from './ThumbnailCache';

// --- Design constants (exported for TimelineInteraction) ---
export const BASE_FRAME_WIDTH = 60;
export const TRACK_HEIGHT = 52;
export const TRACK_HEADER_WIDTH = 80;
export const RULER_HEIGHT = 24;
export const FX_TRACK_HEIGHT = 28;
export const AUDIO_TRACK_HEIGHT = 44;

// Functional colors -- stay hardcoded (high-visibility, theme-independent)
const PLAYHEAD_COLOR = '#E55A2B';
const PLAYHEAD_TRIANGLE_SIZE = 6;
const DROP_INDICATOR_COLOR = '#4488FF';
const PLACEHOLDER_BG_A = '#1A1A2A';
const PLACEHOLDER_BG_B = '#1A2A1A';
const MIN_FRAME_WIDTH_FOR_THUMB = 4; // Below this px width, use solid color fallback

// --- Theme-aware color cache ---
// Colors are read from CSS variables once per theme change, not every frame.
let cachedColors: Record<string, string> | null = null;

function getThemeColors(): Record<string, string> {
  if (cachedColors) return cachedColors;
  const style = getComputedStyle(document.documentElement);
  cachedColors = {
    trackBg: style.getPropertyValue('--color-timeline-track-bg').trim() || '#111111',
    headerBg: style.getPropertyValue('--color-timeline-header-bg').trim() || '#0D0D0D',
    frameBorder: style.getPropertyValue('--color-timeline-frame-border').trim() || '#222222',
    rulerBg: style.getPropertyValue('--color-timeline-ruler-bg').trim() || '#0A0A0A',
    rulerText: style.getPropertyValue('--color-timeline-ruler-text').trim() || '#666666',
    trackName: style.getPropertyValue('--color-timeline-track-name').trim() || '#999999',
    fxTrackBg: style.getPropertyValue('--color-timeline-fx-track-bg').trim() || '#0D0D0D',
    fxHeaderBg: style.getPropertyValue('--color-timeline-fx-header-bg').trim() || '#0A0A0A',
    // Content overlay type-specific colors (resolved from CSS variables for Canvas 2D)
    contentOverlayGreen: style.getPropertyValue('--sidebar-dot-green').trim() || '#22C55E',
    contentOverlayBlue: style.getPropertyValue('--sidebar-dot-blue').trim() || '#3B82F6',
    contentOverlayPurple: '#8B5CF6', // hardcoded, no CSS variable
    // Audio track colors
    audioTrackBg: style.getPropertyValue('--color-audio-track-bg').trim() || '#0A0F0E',
    audioHeaderBg: style.getPropertyValue('--color-audio-header-bg').trim() || '#080D0C',
    audioWaveform: style.getPropertyValue('--color-audio-waveform').trim() || '#22B8A0',
    audioWaveformMuted: style.getPropertyValue('--color-audio-waveform-muted').trim() || '#22B8A033',
    audioCenterline: style.getPropertyValue('--color-audio-centerline').trim() || '#FFFFFF15',
    audioFadeOverlay: style.getPropertyValue('--color-audio-fade-overlay').trim() || '#22B8A040',
    accent: style.getPropertyValue('--color-accent').trim() || '#2D5BE3',
  };
  return cachedColors;
}

/** Invalidate the cached theme colors. Call when theme changes. */
export function invalidateColorCache(): void {
  cachedColors = null;
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
  selectedContentSequenceId?: string | null;
  selectedLayerKeyframes?: { frame: number; easing: string }[];  // sequence-local frames
  selectedKeyframeFrames?: Set<number>;  // frames that are selected (highlighted)
  selectedLayerSequenceId?: string | null;  // which sequence the selected layer belongs to
  hidePlayhead?: boolean;  // true during full-speed playback
  isolatedSequenceIds?: Set<string>;
  hoveredNameLabelSequenceId?: string | null;
  selectedTransition?: { sequenceId: string; type: 'fade-in' | 'fade-out' | 'cross-dissolve' | 'gl-transition' } | null;
  audioTracks?: AudioTrackLayout[];
  selectedAudioTrackId?: string | null;
  beatMarkersVisible?: boolean;
  snapToBeatsEnabled?: boolean;
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
  private fxDragState: FxDragState | null = null;
  private selectedFxSequenceId: string | null = null;
  private selectedContentSequenceId: string | null = null;
  private hoveredKeyframeFrame: number | null = null;
  private hoveredNameLabelSequenceId: string | null = null;
  /** Number of FX tracks (used by TimelineInteraction for layout calculations) */
  fxTrackCount = 0;
  /** Number of audio tracks (used by TimelineInteraction for layout calculations) */
  audioTrackCount = 0;
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
    const colors = getThemeColors();
    this.fxTrackCount = fxTracks.length;
    this.lastScrollY = scrollY;
    if (state.selectedFxSequenceId !== undefined) {
      this.selectedFxSequenceId = state.selectedFxSequenceId;
    }
    if (state.selectedContentSequenceId !== undefined) {
      this.selectedContentSequenceId = state.selectedContentSequenceId;
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
      this.drawFxTrack(ctx, fxTracks[fi], fxTrackY, frameWidth, scrollX, w, isSelected, imageStore, state);
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
      ctx.fillStyle = colors.fxHeaderBg;
      ctx.fillRect(0, ghostY, TRACK_HEADER_WIDTH, FX_TRACK_HEIGHT);
      if (fromIndex < fxTracks.length) {
        const ghostTrack = fxTracks[fromIndex];
        ctx.fillStyle = ghostTrack.color;
        ctx.beginPath();
        ctx.arc(9, ghostY + FX_TRACK_HEIGHT / 2, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = colors.trackName;
        ctx.font = '9px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const ghostName = this.truncateText(ctx, ghostTrack.sequenceName, TRACK_HEADER_WIDTH - 16);
        ctx.fillText(ghostName, 16, ghostY + FX_TRACK_HEIGHT / 2);
      }
      ctx.fillStyle = colors.fxTrackBg;
      ctx.fillRect(TRACK_HEADER_WIDTH, ghostY, w - TRACK_HEADER_WIDTH, FX_TRACK_HEIGHT);
      ctx.globalAlpha = 1.0;
    }

    // 2. Draw content tracks as a single linear row (below FX tracks, scrolled)
    const fxOffset = fxTracks.length * FX_TRACK_HEIGHT;
    this.drawLinearTrack(ctx, state, tracks, frameWidth, scrollX, w, fxOffset, colors);

    // 2.5. Draw audio tracks below content tracks (scrolled)
    this.audioTrackCount = state.audioTracks?.length ?? 0;
    if (state.audioTracks && state.audioTracks.length > 0) {
      const contentTracksTotalHeight = TRACK_HEIGHT; // single linear row
      const fxTracksTotalHeight = fxTracks.length * FX_TRACK_HEIGHT;
      const audioStartY = RULER_HEIGHT + fxTracksTotalHeight + contentTracksTotalHeight;
      let audioY = audioStartY;
      for (const audioTrack of state.audioTracks) {
        this.drawAudioTrack(ctx, audioTrack, audioY, frameWidth, scrollX, w, colors);
        audioY += audioTrack.trackHeight;
      }
    }

    // 2.7. Draw beat markers (spanning full height from FX to audio)
    if (state.beatMarkersVisible && state.audioTracks) {
      // Show markers from selected track only to avoid visual chaos
      const selectedTrack = state.audioTracks.find(at => at.selected && at.showBeatMarkers);
      if (selectedTrack && selectedTrack.beatMarkers.length > 0) {
        const contentTracksTotalHeight = TRACK_HEIGHT;
        const fxTracksTotalHeight = fxTracks.length * FX_TRACK_HEIGHT;
        const audioTracksTotalHeight = (state.audioTracks ?? []).reduce((sum, at) => sum + at.trackHeight, 0);
        const yTop = RULER_HEIGHT;
        const yBottom = RULER_HEIGHT + fxTracksTotalHeight + contentTracksTotalHeight + audioTracksTotalHeight;
        const downbeats = computeDownbeatFrames(selectedTrack.beatMarkers);
        this.drawBeatMarkers(ctx, selectedTrack.beatMarkers, downbeats, frameWidth, scrollX, w, yTop, yBottom);
      }
    }

    // End scrolled region
    ctx.restore();

    // 3. Draw playhead line in screen space (spans full height, not affected by scroll)
    // Hidden during full-speed playback to reinforce "no UI feedback" mode
    if (!state.hidePlayhead) {
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

    // 4. Draw keyframe diamonds (on top of everything else in the track area)
    this.drawKeyframeDiamonds(ctx, state, w);
  }

  /** Draw a transition overlay. Content tracks: 30% height bar at top. FX tracks: full height. */
  private drawTransitionOverlay(
    ctx: CanvasRenderingContext2D,
    x: number,
    w: number,
    trackY: number,
    trackH: number,
    type: 'fade-in' | 'fade-out' | 'cross-dissolve',
    isSelected: boolean,
    fullHeight = false,
  ): void {
    if (w <= 0) return;
    ctx.save();

    const barY = fullHeight ? trackY : trackY + 2;
    const barH = fullHeight ? trackH : Math.round(trackH * 0.3);

    // Purple solid fill at 50% opacity (brighter when selected)
    ctx.fillStyle = isSelected ? 'rgba(139, 92, 246, 0.7)' : 'rgba(139, 92, 246, 0.5)';
    ctx.fillRect(x, barY, w, barH);

    // Diagonal line (white, semi-transparent)
    ctx.beginPath();
    if (type === 'fade-in' || type === 'cross-dissolve') {
      ctx.moveTo(x, barY + barH);
      ctx.lineTo(x + w, barY);
    } else {
      ctx.moveTo(x, barY);
      ctx.lineTo(x + w, barY + barH);
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Black border (purple when selected)
    ctx.strokeStyle = isSelected ? 'rgba(139, 92, 246, 1)' : 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, barY + 0.5, w - 1, barH - 1);

    ctx.restore();
  }

  /** Draw a GL transition overlay — teal/cyan color to distinguish from purple cross-dissolve */
  private drawGlTransitionOverlay(
    ctx: CanvasRenderingContext2D,
    x: number,
    w: number,
    trackY: number,
    trackH: number,
    isSelected: boolean,
  ): void {
    if (w <= 0) return;
    ctx.save();

    const barY = trackY + 2;
    const barH = Math.round(trackH * 0.3);

    // Teal fill (distinct from purple cross-dissolve)
    ctx.fillStyle = isSelected ? 'rgba(20, 184, 166, 0.7)' : 'rgba(20, 184, 166, 0.5)';
    ctx.fillRect(x, barY, w, barH);

    // X-pattern (two crossing diagonals) to distinguish from cross-dissolve's single diagonal
    ctx.beginPath();
    ctx.moveTo(x, barY);
    ctx.lineTo(x + w, barY + barH);
    ctx.moveTo(x + w, barY);
    ctx.lineTo(x, barY + barH);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Border
    ctx.strokeStyle = isSelected ? 'rgba(20, 184, 166, 1)' : 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, barY + 0.5, w - 1, barH - 1);

    ctx.restore();
  }

  /** Resolve the display color for an FX/content-overlay track.
   *  Content overlay colors use CSS variables that Canvas 2D cannot resolve directly,
   *  so we map them to the pre-resolved theme color cache values. */
  private resolveTrackColor(fxTrack: FxTrackLayout): string {
    if (fxTrack.kind !== 'content-overlay') return fxTrack.color;
    const colors = getThemeColors();
    if (fxTrack.color.includes('sidebar-dot-green')) return colors.contentOverlayGreen;
    if (fxTrack.color.includes('sidebar-dot-blue')) return colors.contentOverlayBlue;
    return colors.contentOverlayPurple;
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
    imageStore?: typeof ImageStoreType,
    state?: DrawState,
  ): void {
    const colors = getThemeColors();
    const resolvedColor = this.resolveTrackColor(fxTrack);

    // Track background (highlight when selected)
    ctx.fillStyle = isSelected ? '#1A1520' : colors.fxTrackBg;
    ctx.fillRect(0, y, canvasWidth, FX_TRACK_HEIGHT);

    // Selection indicator: left accent border
    if (isSelected) {
      ctx.fillStyle = resolvedColor;
      ctx.fillRect(0, y, 2, FX_TRACK_HEIGHT);
    }

    // Track header
    const isVisible = fxTrack.visible;
    ctx.fillStyle = isSelected ? '#151015' : colors.fxHeaderBg;
    ctx.fillRect(isSelected ? 2 : 0, y, TRACK_HEADER_WIDTH - (isSelected ? 2 : 0), FX_TRACK_HEIGHT);
    ctx.fillStyle = isVisible ? resolvedColor : resolvedColor + '4D'; // 30% opacity when hidden
    ctx.font = '9px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const name = this.truncateText(ctx, fxTrack.sequenceName, TRACK_HEADER_WIDTH - 16);
    // Color dot + name
    const dotX = 6;
    const dotY = y + FX_TRACK_HEIGHT / 2;
    if (isVisible) {
      ctx.beginPath();
      ctx.arc(dotX + 3, dotY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = isVisible ? colors.trackName : colors.rulerText;
    ctx.fillText(name, dotX + 10, dotY);

    // Range bar
    const barX = fxTrack.inFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
    const barW = (fxTrack.outFrame - fxTrack.inFrame) * frameWidth;
    const barY = y + 4;
    const barH = FX_TRACK_HEIGHT - 8;

    // Only draw if in viewport
    if (barX + barW >= TRACK_HEADER_WIDTH && barX <= canvasWidth) {
      const clippedLeft = Math.max(barX, TRACK_HEADER_WIDTH);
      const clippedRight = Math.min(barX + barW, canvasWidth);
      const clippedW = Math.max(0, clippedRight - clippedLeft);

      // Bar fill (semi-transparent color)
      ctx.fillStyle = resolvedColor + (isVisible ? '40' : '26'); // 25% or 15% opacity
      ctx.beginPath();
      ctx.roundRect(clippedLeft, barY, clippedW, barH, 3);
      ctx.fill();

      // Bar border
      ctx.strokeStyle = resolvedColor + (isVisible ? '80' : '40'); // 50% or 25% opacity
      ctx.lineWidth = 1;
      ctx.stroke();

      // Thumbnail icon for content overlay tracks
      let thumbOffsetX = 0;
      if (fxTrack.kind === 'content-overlay' && fxTrack.thumbnailImageId && imageStore) {
        const image = imageStore.getById(fxTrack.thumbnailImageId);
        const thumbUrl = image ? imageStore.getDisplayUrl(image) : '';
        if (thumbUrl) {
          const cachedImg = this.thumbnailCache.get(fxTrack.thumbnailImageId, thumbUrl);
          if (cachedImg && cachedImg.complete) {
            const iconH = barH - 4;
            const aspect = cachedImg.naturalWidth / cachedImg.naturalHeight;
            const iconW = Math.min(iconH * aspect, 20);
            const iconX = Math.max(clippedLeft + 3, barX + 3);
            // Only draw if icon is within visible bar area
            if (iconX + iconW <= clippedRight) {
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(iconX, barY + 2, iconW, iconH, 2);
              ctx.clip();
              ctx.drawImage(cachedImg, iconX, barY + 2, iconW, iconH);
              ctx.restore();
              thumbOffsetX = iconW + 4; // shift name text right
            }
          }
        }
      }

      // Name text inside the bar (shifted right when thumbnail is present)
      if (clippedW > 30 + thumbOffsetX) {
        ctx.fillStyle = isVisible ? '#CCCCCC' : '#666666';
        ctx.font = '8px system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const barNameX = Math.max(clippedLeft + 4 + thumbOffsetX, barX + 4 + thumbOffsetX);
        const barNameMaxW = clippedRight - barNameX - 4;
        if (barNameMaxW > 10) {
          const barName = this.truncateText(ctx, fxTrack.sequenceName, barNameMaxW);
          ctx.fillText(barName, barNameX, barY + barH / 2);
        }
      }

      // Draw transition overlays on FX bars
      if (fxTrack.fadeIn) {
        const fadeW = fxTrack.fadeIn.duration * frameWidth;
        const isFadeSelected = state?.selectedTransition?.sequenceId === fxTrack.sequenceId
          && state?.selectedTransition?.type === 'fade-in';
        this.drawTransitionOverlay(ctx, barX, Math.min(fadeW, barW), barY, barH, 'fade-in', isFadeSelected, true);
      }
      if (fxTrack.fadeOut) {
        const fadeW = fxTrack.fadeOut.duration * frameWidth;
        const fadeX = barX + barW - fadeW;
        const isFadeSelected = state?.selectedTransition?.sequenceId === fxTrack.sequenceId
          && state?.selectedTransition?.type === 'fade-out';
        this.drawTransitionOverlay(ctx, Math.max(fadeX, barX), Math.min(fadeW, barW), barY, barH, 'fade-out', isFadeSelected, true);
      }

      // Left edge handle (drag to resize inFrame)
      if (barX >= TRACK_HEADER_WIDTH) {
        ctx.fillStyle = resolvedColor;
        ctx.fillRect(barX, barY + 2, 3, barH - 4);
      }

      // Right edge handle (drag to resize outFrame)
      const rightEdge = barX + barW;
      if (rightEdge >= TRACK_HEADER_WIDTH && rightEdge <= canvasWidth) {
        ctx.fillStyle = resolvedColor;
        ctx.fillRect(rightEdge - 3, barY + 2, 3, barH - 4);
      }
    }
  }

  /** Draw a Photoshop-style checkerboard pattern in a clipped rectangle (per D-17) */
  private drawCheckerboard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cellSize = 4): void {
    const light = '#B0B0B0';
    const dark = '#808080';
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = light;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = dark;
    for (let row = 0; row * cellSize < h; row++) {
      for (let col = 0; col * cellSize < w; col++) {
        if ((row + col) % 2 === 0) {
          ctx.fillRect(x + col * cellSize, y + row * cellSize, cellSize, cellSize);
        }
      }
    }
    ctx.restore();
  }

  /** Draw all content sequences as a single linear row */
  private drawLinearTrack(
    ctx: CanvasRenderingContext2D,
    state: DrawState,
    tracks: TrackLayout[],
    frameWidth: number,
    scrollX: number,
    w: number,
    fxOffset: number,
    colors: Record<string, string>,
  ): void {
    const trackY = RULER_HEIGHT + fxOffset;

    // Single row background
    ctx.fillStyle = colors.trackBg;
    ctx.fillRect(0, trackY, w, TRACK_HEIGHT);

    // Header column
    ctx.fillStyle = colors.headerBg;
    ctx.fillRect(0, trackY, TRACK_HEADER_WIDTH, TRACK_HEIGHT);
    ctx.fillStyle = colors.trackName;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('Timeline', 6, trackY + TRACK_HEIGHT / 2);

    // Clip content area
    ctx.save();
    ctx.beginPath();
    ctx.rect(TRACK_HEADER_WIDTH, trackY, w - TRACK_HEADER_WIDTH, TRACK_HEIGHT);
    ctx.clip();

    for (let ti = 0; ti < tracks.length; ti++) {
      const track = tracks[ti];
      const isSelected = track.sequenceId === this.selectedContentSequenceId;

      // Selection highlight for the sequence's frame range
      if (isSelected) {
        const selX = track.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const selW = (track.endFrame - track.startFrame) * frameWidth;
        ctx.fillStyle = '#151A20';
        ctx.fillRect(selX, trackY, selW, TRACK_HEIGHT);
      }

      // Draw key photo ranges (same thumbnail tile logic as stacked mode)
      for (let ri = 0; ri < track.keyPhotoRanges.length; ri++) {
        const range = track.keyPhotoRanges[ri];
        const rangeX = range.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const rangeWidth = range.holdFrames * frameWidth;

        if (rangeX + rangeWidth < TRACK_HEADER_WIDTH || rangeX > w) continue;

        // === Gradient / Solid / Transparent range rendering ===
        if (range.gradient) {
          // Gradient: fill each frame cell with Canvas 2D gradient
          for (let f = 0; f < range.holdFrames; f++) {
            const fx = (range.startFrame + f) * frameWidth - scrollX + TRACK_HEADER_WIDTH;
            const fy = trackY + 2;
            const fw = frameWidth;
            const fh = TRACK_HEIGHT - 4;
            if (fx + fw < TRACK_HEADER_WIDTH || fx > w) continue;
            ctx.save();
            ctx.beginPath();
            ctx.rect(fx, fy, fw, fh);
            ctx.clip();
            ctx.translate(fx, fy);
            ctx.fillStyle = createCanvasGradient(ctx, range.gradient, fw, fh);
            ctx.fillRect(0, 0, fw, fh);
            ctx.restore();
            ctx.strokeStyle = colors.frameBorder;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(fx, fy, fw, fh);
          }
        } else if (range.solidColor && !range.isTransparent) {
          // Solid: fill entire range with solid color
          for (let f = 0; f < range.holdFrames; f++) {
            const fx = (range.startFrame + f) * frameWidth - scrollX + TRACK_HEADER_WIDTH;
            const fy = trackY + 2;
            const fw = frameWidth;
            const fh = TRACK_HEIGHT - 4;
            if (fx + fw < TRACK_HEADER_WIDTH || fx > w) continue;
            ctx.fillStyle = range.solidColor;
            ctx.fillRect(fx, fy, fw, fh);
            ctx.strokeStyle = colors.frameBorder;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(fx, fy, fw, fh);
          }
        } else if (range.isTransparent) {
          // Transparent: checkerboard pattern
          for (let f = 0; f < range.holdFrames; f++) {
            const fx = (range.startFrame + f) * frameWidth - scrollX + TRACK_HEADER_WIDTH;
            const fy = trackY + 2;
            const fw = frameWidth;
            const fh = TRACK_HEIGHT - 4;
            if (fx + fw < TRACK_HEADER_WIDTH || fx > w) continue;
            this.drawCheckerboard(ctx, fx, fy, fw, fh, 4);
            ctx.strokeStyle = colors.frameBorder;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(fx, fy, fw, fh);
          }
        } else {
          // === Existing image thumbnail rendering ===
          const image = state.imageStore.getById(range.imageId);
          const thumbnailUrl = image ? state.imageStore.getDisplayUrl(image) : '';
          const cachedImg = thumbnailUrl ? this.thumbnailCache.get(range.imageId, thumbnailUrl) : null;

          let pattern: CanvasPattern | null = null;
          if (cachedImg) {
            const cellH = TRACK_HEIGHT - 4;
            const scale = cellH / cachedImg.naturalHeight;
            pattern = ctx.createPattern(cachedImg, 'repeat');
            if (pattern) {
              pattern.setTransform(new DOMMatrix().scale(scale, scale));
            }
          }

          for (let f = 0; f < range.holdFrames; f++) {
            const fx = (range.startFrame + f) * frameWidth - scrollX + TRACK_HEADER_WIDTH;
            const fy = trackY + 2;
            const fw = frameWidth;
            const fh = TRACK_HEIGHT - 4;

            if (fx + fw < TRACK_HEADER_WIDTH || fx > w) continue;

            if (cachedImg && pattern && fw >= MIN_FRAME_WIDTH_FOR_THUMB) {
              const cellH = TRACK_HEIGHT - 4;
              const scale = cellH / cachedImg.naturalHeight;
              const tileWidth = cachedImg.naturalWidth * scale;
              const offsetX = fw < tileWidth ? (fw - tileWidth) / 2 : 0;
              ctx.save();
              ctx.beginPath();
              ctx.rect(fx, fy, fw, fh);
              ctx.clip();
              ctx.translate(fx + offsetX, fy);
              ctx.fillStyle = pattern;
              ctx.fillRect(0, 0, fw - offsetX, fh);
              ctx.restore();
            } else {
              ctx.fillStyle = ri % 2 === 0 ? PLACEHOLDER_BG_A : PLACEHOLDER_BG_B;
              ctx.fillRect(fx, fy, fw, fh);
            }

            ctx.strokeStyle = colors.frameBorder;
            ctx.lineWidth = 0.5;
            ctx.strokeRect(fx, fy, fw, fh);
          }
        }

        // Key photo separator
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

      // Draw transition overlays on content tracks
      if (track.fadeIn) {
        const seqX = track.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const fadeW = track.fadeIn.duration * frameWidth;
        const isFadeSelected = state.selectedTransition?.sequenceId === track.sequenceId
          && state.selectedTransition?.type === 'fade-in';
        this.drawTransitionOverlay(ctx, seqX, fadeW, trackY, TRACK_HEIGHT, 'fade-in', isFadeSelected);
      }
      if (track.fadeOut) {
        const seqEndX = track.endFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const fadeW = track.fadeOut.duration * frameWidth;
        const fadeX = seqEndX - fadeW;
        const isFadeSelected = state.selectedTransition?.sequenceId === track.sequenceId
          && state.selectedTransition?.type === 'fade-out';
        this.drawTransitionOverlay(ctx, fadeX, fadeW, trackY, TRACK_HEIGHT, 'fade-out', isFadeSelected);
      }

      // (Cross dissolve overlays drawn in separate pass below — after all track thumbnails)

      // Sequence boundary separator (pink marker between sequences)
      if (ti > 0) {
        const sepX = track.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        if (sepX >= TRACK_HEADER_WIDTH && sepX <= w) {
          ctx.strokeStyle = '#E54586';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sepX, trackY);
          ctx.lineTo(sepX, trackY + TRACK_HEIGHT);
          ctx.stroke();
        }
      }

      // --- Isolation state ---
      const isIsolated = state.isolatedSequenceIds?.has(track.sequenceId) ?? false;
      const isNameHovered = state.hoveredNameLabelSequenceId === track.sequenceId;

      // Isolation overlay: transparent orange over isolated sequence thumbnails
      if (isIsolated) {
        const isoSegX = track.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const isoSegW = (track.endFrame - track.startFrame) * frameWidth;
        const clippedIsoX = Math.max(isoSegX, TRACK_HEADER_WIDTH);
        const clippedIsoW = Math.min(isoSegX + isoSegW, w) - clippedIsoX;
        if (clippedIsoW > 0) {
          ctx.fillStyle = 'rgba(229, 132, 27, 0.5)';
          ctx.fillRect(clippedIsoX, trackY, clippedIsoW, TRACK_HEIGHT);
        }
      }

      // Name overlay
      {
        const segX = track.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const segW = (track.endFrame - track.startFrame) * frameWidth;
        if (segX + segW > TRACK_HEADER_WIDTH && segX < w && segW > 20) {
          const labelH = 16;
          const labelY = trackY + TRACK_HEIGHT - 2 - labelH;
          const clippedX = Math.max(segX, TRACK_HEADER_WIDTH);
          const leftPad = 8;
          ctx.font = '10px system-ui, sans-serif';
          ctx.textBaseline = 'middle';
          const name = this.truncateText(ctx, track.sequenceName, segW - leftPad - 6);
          const textW = ctx.measureText(name).width;
          const bgPad = 4;

          // Background: orange if isolated or hovered, black semi-transparent otherwise
          if (isIsolated || isNameHovered) {
            ctx.fillStyle = '#E5841B';
          } else {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          }
          ctx.fillRect(clippedX + leftPad - bgPad, labelY, textW + bgPad * 2, labelH);

          ctx.fillStyle = isIsolated || isNameHovered ? '#FFFFFF' : '#EEEEEE';
          ctx.fillText(name, clippedX + leftPad, labelY + labelH / 2);
        }
      }
    }

    // Cross dissolve and GL transition overlays — drawn AFTER all tracks so they aren't covered by next track's thumbnails
    for (let ti = 0; ti < tracks.length; ti++) {
      const track = tracks[ti];
      if (track.crossDissolve && ti < tracks.length - 1) {
        const cd = track.crossDissolve;
        const halfDuration = Math.floor(cd.duration / 2);
        const boundary = track.endFrame;
        const cdStartFrame = boundary - halfDuration;
        const cdX = cdStartFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const cdW = cd.duration * frameWidth;

        const isCdSelected = state.selectedTransition?.sequenceId === track.sequenceId
          && state.selectedTransition?.type === 'cross-dissolve';

        this.drawTransitionOverlay(ctx, cdX, cdW, trackY, TRACK_HEIGHT, 'cross-dissolve', isCdSelected);
      }

      // GL transition overlay (teal, visually distinct from purple cross-dissolve)
      if (track.glTransition && ti < tracks.length - 1) {
        const glt = track.glTransition;
        const halfDuration = Math.floor(glt.duration / 2);
        const boundary = track.endFrame;
        const gltStartFrame = boundary - halfDuration;
        const gltX = gltStartFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const gltW = glt.duration * frameWidth;

        const isGltSelected = state.selectedTransition?.sequenceId === track.sequenceId
          && state.selectedTransition?.type === 'gl-transition';

        this.drawGlTransitionOverlay(ctx, gltX, gltW, trackY, TRACK_HEIGHT, isGltSelected);
      }
    }

    ctx.restore();
  }

  /** Draw beat marker vertical lines spanning the full track area */
  private drawBeatMarkers(
    ctx: CanvasRenderingContext2D,
    beatMarkers: number[],
    downbeats: Set<number>,
    frameWidth: number,
    scrollX: number,
    canvasWidth: number,
    yTop: number,
    yBottom: number,
  ): void {
    // Only draw markers in visible frame range
    const startFrame = Math.floor(scrollX / frameWidth);
    const endFrame = Math.ceil((scrollX + canvasWidth - TRACK_HEADER_WIDTH) / frameWidth);

    // Fade opacity based on zoom level
    const baseOpacity = Math.min(1, frameWidth / 8);

    for (const frame of beatMarkers) {
      if (frame < startFrame || frame > endFrame) continue;
      const x = frame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
      if (x < TRACK_HEADER_WIDTH || x > canvasWidth) continue;

      const isDownbeat = downbeats.has(frame);
      // amber at 20-30% for regular, 50% for downbeats
      const opacity = isDownbeat ? baseOpacity * 0.5 : baseOpacity * 0.25;
      const width = isDownbeat ? 1.5 : 0.5;

      ctx.strokeStyle = `rgba(245, 158, 11, ${opacity})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBottom);
      ctx.stroke();
    }
  }

  /** Draw a single audio track row with waveform, fades, selection, and center line */
  private drawAudioTrack(
    ctx: CanvasRenderingContext2D,
    track: AudioTrackLayout,
    y: number,
    frameWidth: number,
    scrollX: number,
    canvasWidth: number,
    colors: Record<string, string>,
  ): void {
    // 1. Track background
    ctx.fillStyle = colors.audioTrackBg;
    ctx.fillRect(0, y, canvasWidth, track.trackHeight);

    // 2. Header background
    ctx.fillStyle = colors.audioHeaderBg;
    ctx.fillRect(0, y, TRACK_HEADER_WIDTH, track.trackHeight);

    // 3. Track name in header
    ctx.font = '10px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = track.muted ? colors.trackName + '66' : colors.trackName;
    const truncatedName = this.truncateText(ctx, track.trackName, TRACK_HEADER_WIDTH - 16);
    ctx.fillText(truncatedName, 8, y + track.trackHeight / 2 + 3);

    // 4. Selected indicator: 2px left accent border
    if (track.selected) {
      ctx.fillStyle = colors.accent;
      ctx.fillRect(0, y, 2, track.trackHeight);
    }

    // 5. Compute range bar position
    // offsetFrame = timeline position; inFrame/outFrame = source audio trim points
    const barX = track.offsetFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
    const trimFrames = track.outFrame - track.inFrame;
    const barW = trimFrames * frameWidth;
    const padding = 4;
    const barY = y + padding;
    const barH = track.trackHeight - padding * 2;

    // Skip if bar not visible
    if (barX + barW < TRACK_HEADER_WIDTH || barX > canvasWidth) return;

    // 6. Select resolution tier based on zoom
    let peaks: Float32Array;
    if (track.peaks.tier2.length > 0) {
      const pixelsPerPeak = barW / (track.peaks.tier2.length / 2);
      peaks = pixelsPerPeak < 1 ? track.peaks.tier1
        : pixelsPerPeak > 4 ? track.peaks.tier3
        : track.peaks.tier2;
    } else {
      peaks = track.peaks.tier1;
    }

    const centerY = barY + barH / 2;

    // 7. Draw center line (zero-crossing hairline)
    const lineStartX = Math.max(barX, TRACK_HEADER_WIDTH);
    const lineEndX = Math.min(barX + barW, canvasWidth);
    if (lineEndX > lineStartX) {
      ctx.strokeStyle = colors.audioCenterline;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(lineStartX, centerY);
      ctx.lineTo(lineEndX, centerY);
      ctx.stroke();
    }

    // 8. Draw waveform peaks — smooth filled path, sliced to in/out range
    if (peaks.length > 0 && track.totalAudioFrames > 0) {
      ctx.fillStyle = track.muted ? colors.audioWaveformMuted : colors.audioWaveform;
      const fullPeakCount = peaks.length / 2;
      const halfH = barH / 2 - 1;

      // Map inFrame..outFrame (with slipOffset) to peak indices
      const srcStart = track.inFrame + track.slipOffset;
      const srcEnd = track.outFrame + track.slipOffset;
      const startIdx = Math.max(0, Math.floor((srcStart / track.totalAudioFrames) * fullPeakCount));
      const endIdx = Math.min(fullPeakCount, Math.ceil((srcEnd / track.totalAudioFrames) * fullPeakCount));
      const visiblePeakCount = endIdx - startIdx;
      if (visiblePeakCount <= 0) return;

      // Clip drawing to the visible bar area
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.max(barX, TRACK_HEADER_WIDTH), barY, Math.min(barX + barW, canvasWidth) - Math.max(barX, TRACK_HEADER_WIDTH), barH);
      ctx.clip();

      // Draw smooth filled waveform using a single path:
      // trace maxes left-to-right across the top, then mins right-to-left across the bottom
      ctx.beginPath();
      const firstPx = barX;
      ctx.moveTo(firstPx, centerY - peaks[(startIdx) * 2 + 1] * halfH);

      // Top edge (max values, left to right)
      for (let vi = 0; vi < visiblePeakCount; vi++) {
        const px = barX + (vi / visiblePeakCount) * barW;
        const pi = startIdx + vi;
        const max = peaks[pi * 2 + 1];
        ctx.lineTo(px, centerY - max * halfH);
      }

      // Bottom edge (min values, right to left)
      for (let vi = visiblePeakCount - 1; vi >= 0; vi--) {
        const px = barX + (vi / visiblePeakCount) * barW;
        const pi = startIdx + vi;
        const min = peaks[pi * 2];
        ctx.lineTo(px, centerY - min * halfH);
      }

      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 9. Draw fade overlays
    if (track.fadeInFrames > 0) {
      const fadeInW = track.fadeInFrames * frameWidth;
      const fadeX = barX;
      const fadeEndX = barX + fadeInW;
      if (fadeEndX > TRACK_HEADER_WIDTH && fadeX < canvasWidth) {
        const grad = ctx.createLinearGradient(fadeX, 0, fadeEndX, 0);
        grad.addColorStop(0, colors.audioTrackBg);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(Math.max(fadeX, TRACK_HEADER_WIDTH), barY, Math.min(fadeInW, canvasWidth - fadeX), barH);
      }
    }
    if (track.fadeOutFrames > 0) {
      const fadeOutW = track.fadeOutFrames * frameWidth;
      const fadeStartX = barX + barW - fadeOutW;
      const fadeEndX = barX + barW;
      if (fadeEndX > TRACK_HEADER_WIDTH && fadeStartX < canvasWidth) {
        const grad = ctx.createLinearGradient(fadeStartX, 0, fadeEndX, 0);
        grad.addColorStop(0, 'transparent');
        grad.addColorStop(1, colors.audioTrackBg);
        ctx.fillStyle = grad;
        ctx.fillRect(Math.max(fadeStartX, TRACK_HEADER_WIDTH), barY, Math.min(fadeOutW, canvasWidth - fadeStartX), barH);
      }
    }

    // 10. Draw edge lines at barX and barX+barW
    ctx.fillStyle = colors.audioWaveform;
    if (barX >= TRACK_HEADER_WIDTH && barX <= canvasWidth) {
      ctx.fillRect(barX, barY, 2, barH);
    }
    const rightEdge = barX + barW;
    if (rightEdge >= TRACK_HEADER_WIDTH && rightEdge <= canvasWidth) {
      ctx.fillRect(rightEdge - 2, barY, 2, barH);
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
    const colors = getThemeColors();

    // Ruler background
    ctx.fillStyle = colors.rulerBg;
    ctx.fillRect(0, 0, width, RULER_HEIGHT);

    // Frame number labels at regular intervals
    ctx.fillStyle = colors.rulerText;
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
      ctx.strokeStyle = colors.rulerText;
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

  /** Get the Y position of the content track row (accounts for FX tracks + ruler) */
  getContentTrackY(): number {
    return RULER_HEIGHT + this.fxTrackCount * FX_TRACK_HEIGHT;
  }

  /** Compute name label hit rect for a given track at current state. Returns null if label not visible. */
  getNameLabelRect(
    track: TrackLayout,
    frameWidth: number,
    scrollX: number,
    canvasWidth: number,
    trackY: number,
  ): { x: number; y: number; w: number; h: number } | null {
    const segX = track.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
    const segW = (track.endFrame - track.startFrame) * frameWidth;
    if (segX + segW <= TRACK_HEADER_WIDTH || segX >= canvasWidth || segW <= 20) return null;
    const labelH = 16;
    const labelY = trackY + TRACK_HEIGHT - 2 - labelH;
    const clippedX = Math.max(segX, TRACK_HEADER_WIDTH);
    const leftPad = 8;
    this.ctx.font = '10px system-ui, sans-serif';
    const name = this.truncateText(this.ctx, track.sequenceName, segW - leftPad - 6);
    const textW = this.ctx.measureText(name).width;
    const bgPad = 4;
    return {
      x: clippedX + leftPad - bgPad,
      y: labelY,
      w: textW + bgPad * 2,
      h: labelH,
    };
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

  /** Set hovered keyframe frame for highlight rendering */
  setHoveredKeyframe(frame: number | null) {
    if (this.hoveredKeyframeFrame === frame) return;
    this.hoveredKeyframeFrame = frame;
    if (this.lastState) {
      this.draw(this.lastState);
    }
  }

  /** Set hovered name label sequence for orange highlight preview */
  setHoveredNameLabel(sequenceId: string | null) {
    if (this.hoveredNameLabelSequenceId !== sequenceId) {
      this.hoveredNameLabelSequenceId = sequenceId;
      if (this.lastState) {
        this.draw({ ...this.lastState, hoveredNameLabelSequenceId: sequenceId });
      }
    }
  }

  /** Draw a losange (diamond/rhombus) marker for linear keyframes */
  private drawLosange(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isSelected: boolean,
    isHovered: boolean,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y - size);       // top
    ctx.lineTo(x + size, y);       // right
    ctx.lineTo(x, y + size);       // bottom
    ctx.lineTo(x - size, y);       // left
    ctx.closePath();

    ctx.fillStyle = isSelected ? '#FFD700' : (isHovered ? '#F0B830' : '#E5A020');
    ctx.fill();

    if (isSelected) {
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (isHovered) {
      ctx.shadowColor = '#E5A020';
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(136, 102, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** Draw a full circle marker for ease-in-out keyframes */
  private drawCircle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isSelected: boolean,
    isHovered: boolean,
  ): void {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);

    ctx.fillStyle = isSelected ? '#FFD700' : (isHovered ? '#F0B830' : '#E5A020');
    ctx.fill();

    if (isSelected) {
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (isHovered) {
      ctx.shadowColor = '#E5A020';
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(136, 102, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** Draw a left half-circle marker for ease-in keyframes (left side filled) */
  private drawHalfCircleLeft(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isSelected: boolean,
    isHovered: boolean,
  ): void {
    ctx.save();
    const r = size * 0.7;
    const fillColor = isSelected ? '#FFD700' : (isHovered ? '#F0B830' : '#E5A020');

    // Filled left half
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 0.5, Math.PI * 1.5);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 0.5, Math.PI * 1.5);
      ctx.closePath();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 0.5, Math.PI * 1.5);
      ctx.closePath();
      ctx.shadowColor = '#E5A020';
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Full circle outline
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(136, 102, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** Draw a right half-circle marker for ease-out keyframes (right side filled) */
  private drawHalfCircleRight(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    isSelected: boolean,
    isHovered: boolean,
  ): void {
    ctx.save();
    const r = size * 0.7;
    const fillColor = isSelected ? '#FFD700' : (isHovered ? '#F0B830' : '#E5A020');

    // Filled right half
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 1.5, Math.PI * 0.5);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 1.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.shadowColor = '#FFD700';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (isHovered) {
      ctx.beginPath();
      ctx.arc(x, y, r, Math.PI * 1.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.shadowColor = '#E5A020';
      ctx.shadowBlur = 3;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Full circle outline
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected ? '#FFFFFF' : 'rgba(136, 102, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /** Dispatch to the correct keyframe icon draw method based on easing type */
  private drawKeyframeIcon(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, size: number,
    easing: string,
    isSelected: boolean,
    isHovered: boolean,
  ): void {
    switch (easing) {
      case 'linear':
        this.drawLosange(ctx, x, y, size, isSelected, isHovered);
        break;
      case 'ease-in-out':
        this.drawCircle(ctx, x, y, size, isSelected, isHovered);
        break;
      case 'ease-in':
        this.drawHalfCircleLeft(ctx, x, y, size, isSelected, isHovered);
        break;
      case 'ease-out':
        this.drawHalfCircleRight(ctx, x, y, size, isSelected, isHovered);
        break;
      default:
        this.drawLosange(ctx, x, y, size, isSelected, isHovered);
    }
  }

  /** Draw keyframe diamond markers for the selected layer */
  private drawKeyframeDiamonds(
    ctx: CanvasRenderingContext2D,
    state: DrawState,
    w: number,
  ): void {
    if (!state.selectedLayerKeyframes || state.selectedLayerKeyframes.length === 0) return;
    if (!state.selectedLayerSequenceId) return;

    const frameWidth = BASE_FRAME_WIDTH * state.zoom;
    const iconSize = 9;
    const selectedFrames = state.selectedKeyframeFrames ?? new Set();

    // First, check if the selected layer belongs to a content track
    const trackIndex = state.tracks.findIndex(t => t.sequenceId === state.selectedLayerSequenceId);
    if (trackIndex >= 0) {
      // Draw diamonds on content track row
      const track = state.tracks[trackIndex];
      const fxOffset = state.fxTracks.length * FX_TRACK_HEIGHT;
      // All content tracks share a single row (linear timeline)
      const trackCenterY = RULER_HEIGHT + fxOffset + TRACK_HEIGHT / 2 - state.scrollY;

      for (const kf of state.selectedLayerKeyframes) {
        const globalFrame = track.startFrame + kf.frame;
        const kfX = globalFrame * frameWidth - state.scrollX + TRACK_HEADER_WIDTH;

        if (kfX < TRACK_HEADER_WIDTH - iconSize || kfX > w + iconSize) continue;
        if (trackCenterY < RULER_HEIGHT - iconSize || trackCenterY > ctx.canvas.height / (window.devicePixelRatio || 1)) continue;

        const isSelected = selectedFrames.has(kf.frame);
        const isHovered = kf.frame === this.hoveredKeyframeFrame;
        this.drawKeyframeIcon(ctx, kfX, trackCenterY, iconSize, kf.easing, isSelected, isHovered);
      }
      return;
    }

    // Check if the selected layer belongs to a content-overlay or FX track in the FX area
    const fxKfTrackIndex = state.fxTracks.findIndex(ft => ft.sequenceId === state.selectedLayerSequenceId);
    if (fxKfTrackIndex >= 0) {
      const fxTrack = state.fxTracks[fxKfTrackIndex];
      const trackCenterY = RULER_HEIGHT + fxKfTrackIndex * FX_TRACK_HEIGHT + FX_TRACK_HEIGHT / 2 - state.scrollY;
      const startFrame = fxTrack.inFrame;

      for (const kf of state.selectedLayerKeyframes) {
        const globalFrame = startFrame + kf.frame;
        const kfX = globalFrame * frameWidth - state.scrollX + TRACK_HEADER_WIDTH;

        if (kfX < TRACK_HEADER_WIDTH - iconSize || kfX > w + iconSize) continue;
        if (trackCenterY < RULER_HEIGHT - iconSize || trackCenterY > ctx.canvas.height / (window.devicePixelRatio || 1)) continue;

        const isSelected = selectedFrames.has(kf.frame);
        const isHovered = kf.frame === this.hoveredKeyframeFrame;
        this.drawKeyframeIcon(ctx, kfX, trackCenterY, iconSize, kf.easing, isSelected, isHovered);
      }
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
