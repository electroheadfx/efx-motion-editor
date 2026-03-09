import {timelineStore} from '../../stores/timelineStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {sequenceStore} from '../../stores/sequenceStore';
import {trackLayouts} from '../../lib/frameMap';
import {BASE_FRAME_WIDTH, TRACK_HEADER_WIDTH, RULER_HEIGHT, TRACK_HEIGHT} from './TimelineRenderer';
import type {TimelineRenderer} from './TimelineRenderer';

/**
 * TimelineInteraction: Pointer/wheel/touch event handling for the timeline canvas.
 *
 * Translates user interactions into timelineStore/playbackEngine actions:
 * - Click-to-seek (TIME-02)
 * - Playhead drag scrubbing (TIME-03)
 * - Wheel zoom with cursor anchoring (TIME-04)
 * - Horizontal scroll
 * - macOS pinch-to-zoom
 * - Track header drag-and-drop for sequence reorder (TIME-06)
 */
export class TimelineInteraction {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: TimelineRenderer | null = null;
  private isDragging = false;

  // Track header drag state (TIME-06)
  private isDraggingTrack = false;
  private dragTrackIndex = -1;

  // Bound handlers for cleanup
  private handlePointerDown = this.onPointerDown.bind(this);
  private handlePointerMove = this.onPointerMove.bind(this);
  private handlePointerUp = this.onPointerUp.bind(this);
  private handleWheel = this.onWheel.bind(this);
  private handleGestureChange = this.onGestureChange.bind(this);
  private handleGestureStart = this.onGestureStart.bind(this);

  attach(canvas: HTMLCanvasElement, renderer: TimelineRenderer) {
    this.canvas = canvas;
    this.renderer = renderer;

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('wheel', this.handleWheel, {passive: false});
    // macOS pinch-to-zoom via gesture events
    canvas.addEventListener('gesturestart', this.handleGestureStart as EventListener);
    canvas.addEventListener('gesturechange', this.handleGestureChange as EventListener);
  }

  detach() {
    if (!this.canvas) return;
    const canvas = this.canvas;

    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
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
    return Math.abs(clientX - playheadX) <= 10;
  }

  /** Compute track index from clientY position */
  private trackIndexFromY(clientY: number): number {
    if (!this.canvas) return -1;
    const rect = this.canvas.getBoundingClientRect();
    const y = clientY - rect.top - RULER_HEIGHT;
    if (y < 0) return -1;
    return Math.floor(y / TRACK_HEIGHT);
  }

  /** Compute drop index for track reorder (insertion point between tracks) */
  private dropIndexFromY(clientY: number): number {
    if (!this.canvas) return 0;
    const rect = this.canvas.getBoundingClientRect();
    const y = clientY - rect.top - RULER_HEIGHT;
    const trackCount = trackLayouts.peek().length;
    const idx = Math.round(y / TRACK_HEIGHT);
    return Math.max(0, Math.min(idx, trackCount));
  }

  /** Check if the click is in the ruler area (above tracks) */
  private isInRuler(clientY: number): boolean {
    if (!this.canvas) return false;
    const rect = this.canvas.getBoundingClientRect();
    return (clientY - rect.top) < RULER_HEIGHT;
  }

  // --- Click-to-seek (TIME-02), playhead drag start, and track header drag ---
  private onPointerDown(e: PointerEvent) {
    if (!this.canvas) return;

    // Only handle primary button (left click); ignore middle/right
    if (e.button !== 0) return;

    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;

    // Check if the click is in the track header area (TIME-06: sequence reorder)
    if (localX < TRACK_HEADER_WIDTH) {
      const trackIndex = this.trackIndexFromY(e.clientY);
      const tracks = trackLayouts.peek();

      // Only start drag if valid track and more than one sequence
      if (trackIndex >= 0 && trackIndex < tracks.length && tracks.length > 1) {
        this.isDraggingTrack = true;
        this.dragTrackIndex = trackIndex;
        this.canvas.style.cursor = 'grabbing';
        this.canvas.setPointerCapture(e.pointerId);

        // Set initial drag visual state
        if (this.renderer) {
          this.renderer.setDragState({
            fromIndex: trackIndex,
            toIndex: trackIndex,
            currentY: e.clientY,
          });
        }
      }
      return;
    }

    // Click in ruler area or on playhead → start drag-to-scrub immediately
    if (this.isInRuler(e.clientY) || this.isOnPlayhead(e.clientX)) {
      this.isDragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      // Seek to clicked position immediately
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
    } else {
      // Click-to-seek on track area
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
    }
  }

  // --- Playhead scrubbing (TIME-03) and track header drag (TIME-06) ---
  private onPointerMove(e: PointerEvent) {
    // Track header dragging
    if (this.isDraggingTrack) {
      const dropIndex = this.dropIndexFromY(e.clientY);
      if (this.renderer) {
        this.renderer.setDragState({
          fromIndex: this.dragTrackIndex,
          toIndex: dropIndex,
          currentY: e.clientY,
        });
      }
      return;
    }

    // Playhead scrubbing
    if (this.isDragging) {
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
      return;
    }

    // Cursor hint: show grab cursor when hovering over track headers
    if (this.canvas) {
      const rect = this.canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const trackIndex = this.trackIndexFromY(e.clientY);
      const tracks = trackLayouts.peek();
      if (localX < TRACK_HEADER_WIDTH && trackIndex >= 0 && trackIndex < tracks.length && tracks.length > 1) {
        this.canvas.style.cursor = 'grab';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }
  }

  private onPointerUp(e: PointerEvent) {
    // Track header drop (TIME-06)
    if (this.isDraggingTrack) {
      const dropIndex = this.dropIndexFromY(e.clientY);
      // Compute effective target index for reorderSequences
      // dropIndex is the insertion point; if dropping below the dragged track, adjust
      const fromIndex = this.dragTrackIndex;
      let toIndex = dropIndex;
      if (toIndex > fromIndex) {
        toIndex -= 1; // Account for the removed item shifting indices down
      }

      if (toIndex !== fromIndex) {
        sequenceStore.reorderSequences(fromIndex, toIndex);
      }

      this.isDraggingTrack = false;
      this.dragTrackIndex = -1;
      if (this.renderer) {
        this.renderer.setDragState(null);
      }
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture may have been released by browser
        }
      }
      return;
    }

    // Playhead drag end
    if (this.isDragging) {
      this.isDragging = false;
      if (this.canvas) {
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture may have been released by browser
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
