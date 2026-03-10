import {timelineStore} from '../../stores/timelineStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import {trackLayouts, fxTrackLayouts} from '../../lib/frameMap';
import {startCoalescing, stopCoalescing} from '../../lib/history';
import {BASE_FRAME_WIDTH, TRACK_HEADER_WIDTH, RULER_HEIGHT, TRACK_HEIGHT, FX_TRACK_HEIGHT} from './TimelineRenderer';
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
 * - FX range bar drag for move and resize (FX-09)
 */
export class TimelineInteraction {
  private canvas: HTMLCanvasElement | null = null;
  private renderer: TimelineRenderer | null = null;
  private isDragging = false;

  // Track header drag state (TIME-06)
  private isDraggingTrack = false;
  private dragTrackIndex = -1;

  // FX range bar drag state (FX-09)
  private isDraggingFx = false;
  private fxDragMode: 'move' | 'resize-left' | 'resize-right' = 'move';
  private fxDragSeqId = '';
  private fxDragStartFrame = 0; // frame at pointer-down
  private fxDragOrigIn = 0;
  private fxDragOrigOut = 0;

  // FX header reorder drag state (FX-10)
  private isDraggingFxReorder = false;
  private fxReorderFromIndex = -1;
  private fxReorderMoved = false;

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

  /** Compute content track index from clientY (accounts for FX track offset and scrollY) */
  private trackIndexFromY(clientY: number): number {
    if (!this.canvas || !this.renderer) return -1;
    const rect = this.canvas.getBoundingClientRect();
    const scrollY = this.renderer.getScrollY();
    const fxOffset = this.renderer.getFxTrackCount() * FX_TRACK_HEIGHT;
    const y = clientY - rect.top - RULER_HEIGHT - fxOffset + scrollY;
    if (y < 0) return -1;
    return Math.floor(y / TRACK_HEIGHT);
  }

  /** Compute drop index for track reorder (accounts for FX track offset and scrollY) */
  private dropIndexFromY(clientY: number): number {
    if (!this.canvas || !this.renderer) return 0;
    const rect = this.canvas.getBoundingClientRect();
    const scrollY = this.renderer.getScrollY();
    const fxOffset = this.renderer.getFxTrackCount() * FX_TRACK_HEIGHT;
    const y = clientY - rect.top - RULER_HEIGHT - fxOffset + scrollY;
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

  /** Check if clientY is in the FX tracks area (accounts for scrollY) */
  private isInFxArea(clientY: number): boolean {
    if (!this.canvas || !this.renderer) return false;
    const rect = this.canvas.getBoundingClientRect();
    const scrollY = this.renderer.getScrollY();
    const y = clientY - rect.top - RULER_HEIGHT + scrollY;
    const fxCount = this.renderer.getFxTrackCount();
    return y >= 0 && y < fxCount * FX_TRACK_HEIGHT;
  }

  /** Get FX track index from clientY (accounts for scrollY) */
  private fxTrackIndexFromY(clientY: number): number {
    if (!this.canvas || !this.renderer) return -1;
    const rect = this.canvas.getBoundingClientRect();
    const scrollY = this.renderer.getScrollY();
    const y = clientY - rect.top - RULER_HEIGHT + scrollY;
    if (y < 0) return -1;
    return Math.floor(y / FX_TRACK_HEIGHT);
  }

  /** Compute drop index for FX reorder (uses Math.round for insertion-point semantics) */
  private fxDropIndexFromY(clientY: number): number {
    if (!this.canvas || !this.renderer) return 0;
    const rect = this.canvas.getBoundingClientRect();
    const scrollY = this.renderer.getScrollY();
    const y = clientY - rect.top - RULER_HEIGHT + scrollY;
    const fxCount = this.renderer.getFxTrackCount();
    const idx = Math.round(y / FX_TRACK_HEIGHT);
    return Math.max(0, Math.min(idx, fxCount));
  }

  /** Select the first layer in an FX sequence for property editing */
  private selectFxSequenceLayer(sequenceId: string): void {
    const fxSeqs = sequenceStore.getFxSequences();
    const seq = fxSeqs.find(s => s.id === sequenceId);
    if (seq && seq.layers.length > 0) {
      const layerId = seq.layers[0].id;
      layerStore.setSelected(layerId);
      uiStore.selectLayer(layerId);
    }
  }

  /** Determine FX drag mode based on click position relative to range bar edges */
  private fxDragModeFromX(clientX: number, fxTrack: {inFrame: number; outFrame: number}): 'move' | 'resize-left' | 'resize-right' | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const zoom = timelineStore.zoom.peek();
    const scrollX = timelineStore.scrollX.peek();
    const frameWidth = BASE_FRAME_WIDTH * zoom;

    const barLeft = fxTrack.inFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH + rect.left;
    const barRight = fxTrack.outFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH + rect.left;

    // Edge hit zone: 8px from each edge
    if (Math.abs(clientX - barLeft) <= 8) return 'resize-left';
    if (Math.abs(clientX - barRight) <= 8) return 'resize-right';
    if (clientX >= barLeft && clientX <= barRight) return 'move';
    return null;
  }

  // --- Click-to-seek (TIME-02), playhead drag start, track header drag, and FX drag ---
  private onPointerDown(e: PointerEvent) {
    if (!this.canvas) return;

    // Only handle primary button (left click); ignore middle/right
    if (e.button !== 0) return;

    // Check FX track area first
    if (this.isInFxArea(e.clientY)) {
      const rect = this.canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const fxIdx = this.fxTrackIndexFromY(e.clientY);
      const fxTracks = fxTrackLayouts.peek();

      // Always select the FX layer when clicking anywhere in its track
      if (fxIdx >= 0 && fxIdx < fxTracks.length) {
        this.selectFxSequenceLayer(fxTracks[fxIdx].sequenceId);
      }

      // Header: check for bullet click or initiate FX reorder drag
      if (localX < TRACK_HEADER_WIDTH && fxIdx >= 0 && fxIdx < fxTracks.length) {
        const fxSeqId = fxTracks[fxIdx].sequenceId;

        // Click on bullet/dot area (x < 18px) toggles visibility
        if (localX < 18) {
          sequenceStore.toggleFxSequenceVisibility(fxSeqId);
          return;
        }

        this.isDraggingFxReorder = true;
        this.fxReorderFromIndex = fxIdx;
        this.fxReorderMoved = false;
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor = 'grabbing';
        if (this.renderer) {
          this.renderer.setFxDragState({
            fromIndex: fxIdx,
            toIndex: fxIdx,
            currentY: e.clientY,
          });
        }
        return;
      }

      if (fxIdx >= 0 && fxIdx < fxTracks.length) {
        const fxTrack = fxTracks[fxIdx];
        const mode = this.fxDragModeFromX(e.clientX, fxTrack);
        if (mode) {
          this.isDraggingFx = true;
          this.fxDragMode = mode;
          this.fxDragSeqId = fxTrack.sequenceId;
          this.fxDragStartFrame = this.getFrame(e.clientX);
          this.fxDragOrigIn = fxTrack.inFrame;
          this.fxDragOrigOut = fxTrack.outFrame;
          this.canvas.setPointerCapture(e.pointerId);
          this.canvas.style.cursor = mode === 'move' ? 'grabbing' : 'col-resize';
          startCoalescing();
          return;
        }
      }
      // Click in FX area but not on a bar -- seek playhead
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;

    // Check if the click is in the track header area (TIME-06: sequence reorder)
    if (localX < TRACK_HEADER_WIDTH) {
      const trackIndex = this.trackIndexFromY(e.clientY);
      const tracks = trackLayouts.peek();

      // Select the content sequence on header click
      if (trackIndex >= 0 && trackIndex < tracks.length) {
        const track = tracks[trackIndex];
        sequenceStore.setActive(track.sequenceId);
        uiStore.selectSequence(track.sequenceId);
        // Clear any selected FX layer so Delete targets the sequence
        layerStore.setSelected(null);
        uiStore.selectLayer(null);
      }

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

    // Click in ruler area or on playhead -> start drag-to-scrub immediately
    if (this.isInRuler(e.clientY) || this.isOnPlayhead(e.clientX)) {
      this.isDragging = true;
      this.canvas.setPointerCapture(e.pointerId);
      // Seek to clicked position immediately
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
    } else {
      // Click-to-seek on track area + select content sequence
      const trackIndex = this.trackIndexFromY(e.clientY);
      const tracks = trackLayouts.peek();
      if (trackIndex >= 0 && trackIndex < tracks.length) {
        const track = tracks[trackIndex];
        sequenceStore.setActive(track.sequenceId);
        uiStore.selectSequence(track.sequenceId);
        // Clear any selected FX layer so Delete targets the sequence
        layerStore.setSelected(null);
        uiStore.selectLayer(null);
      }
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
    }
  }

  // --- Playhead scrubbing (TIME-03), track header drag (TIME-06), and FX drag (FX-09) ---
  private onPointerMove(e: PointerEvent) {
    // FX header reorder dragging with visual feedback
    if (this.isDraggingFxReorder) {
      this.fxReorderMoved = true;
      const dropIndex = this.fxDropIndexFromY(e.clientY);
      if (this.renderer) {
        this.renderer.setFxDragState({
          fromIndex: this.fxReorderFromIndex,
          toIndex: dropIndex,
          currentY: e.clientY,
        });
      }
      return;
    }

    // FX range bar dragging
    if (this.isDraggingFx) {
      const currentFrame = this.getFrame(e.clientX);
      const delta = currentFrame - this.fxDragStartFrame;
      const totalFr = timelineStore.totalFrames.peek();

      let newIn = this.fxDragOrigIn;
      let newOut = this.fxDragOrigOut;

      if (this.fxDragMode === 'move') {
        const duration = this.fxDragOrigOut - this.fxDragOrigIn;
        newIn = Math.max(0, this.fxDragOrigIn + delta);
        newOut = newIn + duration;
        // Clamp to timeline bounds
        if (newOut > totalFr) {
          newOut = totalFr;
          newIn = newOut - duration;
        }
      } else if (this.fxDragMode === 'resize-left') {
        newIn = Math.max(0, Math.min(this.fxDragOrigIn + delta, this.fxDragOrigOut - 1));
      } else if (this.fxDragMode === 'resize-right') {
        newOut = Math.max(this.fxDragOrigIn + 1, Math.min(this.fxDragOrigOut + delta, totalFr));
      }

      sequenceStore.updateFxSequenceRange(this.fxDragSeqId, newIn, newOut);
      return;
    }

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

    // Cursor hints (hover state)
    if (this.canvas) {
      // Cursor hint: FX area
      if (this.isInFxArea(e.clientY)) {
        const rect = this.canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const fxIdx = this.fxTrackIndexFromY(e.clientY);
        const fxTracks = fxTrackLayouts.peek();

        // FX header area: show grab cursor for reorder/toggle
        if (localX < TRACK_HEADER_WIDTH && fxIdx >= 0 && fxIdx < fxTracks.length) {
          this.canvas.style.cursor = 'pointer';
          return;
        }

        if (fxIdx >= 0 && fxIdx < fxTracks.length) {
          const fxTrack = fxTracks[fxIdx];
          const mode = this.fxDragModeFromX(e.clientX, fxTrack);
          if (mode === 'resize-left' || mode === 'resize-right') {
            this.canvas.style.cursor = 'col-resize';
          } else if (mode === 'move') {
            this.canvas.style.cursor = 'grab';
          } else {
            this.canvas.style.cursor = 'default';
          }
        } else {
          this.canvas.style.cursor = 'default';
        }
        return; // Skip content area cursor logic
      }

      // Cursor hint: show grab cursor when hovering over track headers
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
    // FX header reorder drag end
    if (this.isDraggingFxReorder) {
      if (this.fxReorderMoved) {
        // Actual drag: reorder FX sequences
        const dropFxIdx = this.fxDropIndexFromY(e.clientY);
        const fxTracks = fxTrackLayouts.peek();
        const clampedDrop = Math.max(0, Math.min(dropFxIdx, fxTracks.length - 1));
        const fromIndex = this.fxReorderFromIndex;
        let toIndex = clampedDrop;
        if (toIndex > fromIndex) {
          toIndex -= 1; // Account for removed item shifting indices
        }
        if (toIndex !== fromIndex) {
          sequenceStore.reorderFxSequences(fromIndex, toIndex);
        }
      }
      // Selection already happened on pointerDown (no toggle here)
      this.isDraggingFxReorder = false;
      this.fxReorderFromIndex = -1;
      this.fxReorderMoved = false;
      if (this.renderer) {
        this.renderer.setFxDragState(null);
      }
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture may have been released
        }
      }
      return;
    }

    // FX range bar drag end
    if (this.isDraggingFx) {
      this.isDraggingFx = false;
      this.fxDragSeqId = '';
      stopCoalescing();
      if (this.canvas) {
        this.canvas.style.cursor = 'default';
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture may have been released
        }
      }
      return;
    }

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
      // Horizontal scroll (deltaX)
      if (e.deltaX !== 0) {
        const newScrollX = timelineStore.scrollX.peek() + e.deltaX;
        timelineStore.setScrollX(Math.max(0, newScrollX));
      }
      // Vertical scroll (deltaY without modifier)
      if (e.deltaY !== 0 && !e.shiftKey) {
        const newScrollY = timelineStore.scrollY.peek() + e.deltaY;
        // Compute max scrollY: total content height - visible canvas height
        const fxCount = this.renderer?.getFxTrackCount() ?? 0;
        const contentCount = trackLayouts.peek().length;
        const totalContentH = RULER_HEIGHT + fxCount * FX_TRACK_HEIGHT + contentCount * TRACK_HEIGHT;
        const canvasH = this.canvas?.getBoundingClientRect().height ?? totalContentH;
        const maxScrollY = Math.max(0, totalContentH - canvasH);
        timelineStore.setScrollY(Math.min(maxScrollY, Math.max(0, newScrollY)));
      } else if (e.deltaY !== 0 && e.shiftKey) {
        // Shift+scroll = horizontal scroll (standard macOS pattern)
        const newScrollX = timelineStore.scrollX.peek() + e.deltaY;
        timelineStore.setScrollX(Math.max(0, newScrollX));
      }
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
