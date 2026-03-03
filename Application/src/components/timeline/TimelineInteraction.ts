import {timelineStore} from '../../stores/timelineStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {BASE_FRAME_WIDTH, TRACK_HEADER_WIDTH} from './TimelineRenderer';
import type {TimelineRenderer} from './TimelineRenderer';

/**
 * TimelineInteraction: Mouse/wheel/touch event handling for the timeline canvas.
 *
 * Translates user interactions into timelineStore/playbackEngine actions:
 * - Click-to-seek (TIME-02)
 * - Playhead drag scrubbing (TIME-03)
 * - Wheel zoom with cursor anchoring (TIME-04)
 * - Horizontal scroll
 * - macOS pinch-to-zoom
 */
export class TimelineInteraction {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: TimelineRenderer | null = null;
  private isDragging = false;

  // Bound handlers for cleanup
  private handleMouseDown = this.onMouseDown.bind(this);
  private handleMouseMove = this.onMouseMove.bind(this);
  private handleMouseUp = this.onMouseUp.bind(this);
  private handleWheel = this.onWheel.bind(this);
  private handleGestureChange = this.onGestureChange.bind(this);
  private handleGestureStart = this.onGestureStart.bind(this);

  attach(canvas: HTMLCanvasElement, renderer: TimelineRenderer) {
    this.canvas = canvas;
    this.renderer = renderer;

    canvas.addEventListener('mousedown', this.handleMouseDown);
    canvas.addEventListener('mousemove', this.handleMouseMove);
    canvas.addEventListener('mouseup', this.handleMouseUp);
    canvas.addEventListener('wheel', this.handleWheel, {passive: false});
    // macOS pinch-to-zoom via gesture events
    canvas.addEventListener('gesturestart', this.handleGestureStart as EventListener);
    canvas.addEventListener('gesturechange', this.handleGestureChange as EventListener);
  }

  detach() {
    if (!this.canvas) return;
    const canvas = this.canvas;

    canvas.removeEventListener('mousedown', this.handleMouseDown);
    canvas.removeEventListener('mousemove', this.handleMouseMove);
    canvas.removeEventListener('mouseup', this.handleMouseUp);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('gesturestart', this.handleGestureStart as EventListener);
    canvas.removeEventListener('gesturechange', this.handleGestureChange as EventListener);

    this.canvas = null;
    this.renderer = null;
  }

  private getFrame(clientX: number): number {
    if (!this.canvas || !this.renderer) return 0;
    const rect = this.canvas.getBoundingClientRect();
    const totalFrames = timelineStore.totalFrames.peek();
    return this.renderer.frameFromX(
      clientX,
      rect,
      timelineStore.scrollX.peek(),
      timelineStore.zoom.peek(),
      totalFrames,
    );
  }

  private isOnPlayhead(clientX: number): boolean {
    if (!this.canvas) return false;
    const rect = this.canvas.getBoundingClientRect();
    const currentFrame = timelineStore.currentFrame.peek();
    const frameWidth = BASE_FRAME_WIDTH * timelineStore.zoom.peek();
    const playheadX = currentFrame * frameWidth - timelineStore.scrollX.peek() + TRACK_HEADER_WIDTH + rect.left;
    return Math.abs(clientX - playheadX) <= 5;
  }

  // --- Click-to-seek (TIME-02) and playhead drag start ---
  private onMouseDown(e: MouseEvent) {
    if (!this.canvas) return;

    // Check if the click is in the header area -- ignore
    const rect = this.canvas.getBoundingClientRect();
    if (e.clientX - rect.left < TRACK_HEADER_WIDTH) return;

    if (this.isOnPlayhead(e.clientX)) {
      // Start playhead drag (TIME-03)
      this.isDragging = true;
      this.canvas.setPointerCapture((e as unknown as PointerEvent).pointerId ?? 0);
    } else {
      // Click-to-seek
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
    }
  }

  // --- Playhead scrubbing (TIME-03) ---
  private onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const frame = this.getFrame(e.clientX);
    playbackEngine.seekToFrame(frame);
  }

  private onMouseUp(_e: MouseEvent) {
    if (this.isDragging) {
      this.isDragging = false;
      if (this.canvas && (_e as unknown as PointerEvent).pointerId !== undefined) {
        try {
          this.canvas.releasePointerCapture((_e as unknown as PointerEvent).pointerId);
        } catch {
          // Pointer capture may not be active
        }
      }
    }
  }

  // --- Zoom and horizontal scroll (TIME-04) ---
  private onWheel(e: WheelEvent) {
    if (!this.canvas) return;
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();

    if (e.ctrlKey || e.metaKey) {
      // Zoom centered on cursor position
      const cursorX = e.clientX - rect.left - TRACK_HEADER_WIDTH;
      const oldZoom = timelineStore.zoom.peek();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = clamp(oldZoom * factor, 0.1, 10);

      // Keep frame under cursor stable
      const frameUnderCursor = (timelineStore.scrollX.peek() + cursorX) / (BASE_FRAME_WIDTH * oldZoom);
      const newScrollX = frameUnderCursor * BASE_FRAME_WIDTH * newZoom - cursorX;

      timelineStore.setZoom(newZoom);
      timelineStore.setScrollX(Math.max(0, newScrollX));
    } else {
      // Horizontal scroll
      const newScrollX = timelineStore.scrollX.peek() + e.deltaX + e.deltaY;
      timelineStore.setScrollX(Math.max(0, newScrollX));
    }
  }

  // --- macOS pinch-to-zoom ---
  private onGestureStart(e: Event) {
    e.preventDefault();
  }

  private onGestureChange(e: Event) {
    if (!this.canvas) return;
    e.preventDefault();

    const ge = e as GestureEvent;
    const rect = this.canvas.getBoundingClientRect();
    const cursorX = (ge.clientX ?? rect.left + rect.width / 2) - rect.left - TRACK_HEADER_WIDTH;
    const oldZoom = timelineStore.zoom.peek();
    const newZoom = clamp(oldZoom * ge.scale, 0.1, 10);

    const frameUnderCursor = (timelineStore.scrollX.peek() + cursorX) / (BASE_FRAME_WIDTH * oldZoom);
    const newScrollX = frameUnderCursor * BASE_FRAME_WIDTH * newZoom - cursorX;

    timelineStore.setZoom(newZoom);
    timelineStore.setScrollX(Math.max(0, newScrollX));
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Safari macOS gesture event interface */
interface GestureEvent extends UIEvent {
  scale: number;
  rotation: number;
  clientX: number;
  clientY: number;
}
