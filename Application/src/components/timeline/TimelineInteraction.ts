import {timelineStore} from '../../stores/timelineStore';
import {playbackEngine} from '../../lib/playbackEngine';
import {sequenceStore} from '../../stores/sequenceStore';
import {layerStore} from '../../stores/layerStore';
import {uiStore} from '../../stores/uiStore';
import {keyframeStore} from '../../stores/keyframeStore';
import {audioStore} from '../../stores/audioStore';
import {trackLayouts, fxTrackLayouts, audioTrackLayouts} from '../../lib/frameMap';
import {startCoalescing, stopCoalescing} from '../../lib/history';
import {BASE_FRAME_WIDTH, TRACK_HEADER_WIDTH, RULER_HEIGHT, FX_TRACK_HEIGHT, TRACK_HEIGHT} from './TimelineRenderer';
import type {TimelineRenderer} from './TimelineRenderer';
import {isolationStore} from '../../stores/isolationStore';

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

  // Keyframe hover state
  private hoveredKeyframeFrame: number | null = null;

  // Keyframe diamond drag state (KF-09)
  private isDraggingKeyframe = false;
  private kfDragLayerId = '';
  private kfDragFromFrame = 0;  // sequence-local frame
  private kfDragSequenceStartFrame = 0;  // global start of the owning sequence

  // Audio track drag state (INT-03, INT-04, INT-05)
  private isDraggingAudio = false;
  private audioDragMode: 'move' | 'resize-left' | 'resize-right' | 'slip' = 'move';
  private audioDragTrackId = '';
  private audioDragStartFrame = 0;
  private audioDragOrigOffset = 0;
  private audioDragOrigIn = 0;
  private audioDragOrigOut = 0;
  private audioDragOrigSlip = 0;

  // Audio track reorder state (INT-06)
  private isDraggingAudioReorder = false;
  private audioReorderFromIndex = -1;
  private audioReorderStartY = 0;
  private audioReorderMoved = false;

  // Audio track height resize state (INT-07)
  private isDraggingAudioHeight = false;
  private audioHeightTrackId = '';
  private audioHeightStartY = 0;
  private audioHeightOrigHeight = 0;

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

  /** Select the first layer in an FX or content-overlay sequence for property editing.
   *  Searches all sequences by ID (not just getFxSequences) so content-overlay sequences are found. */
  private selectFxSequenceLayer(sequenceId: string): void {
    const allSeqs = sequenceStore.sequences.peek();
    const seq = allSeqs.find(s => s.id === sequenceId);
    if (seq && seq.layers.length > 0) {
      const layerId = seq.layers[0].id;
      layerStore.setSelected(layerId);
      uiStore.selectLayer(layerId);
      uiStore.selectSequence(null);
    }
  }

  /** In linear mode, find which content sequence owns the given global frame number */
  private sequenceFromFrame(frame: number): string | null {
    const tracks = trackLayouts.peek();
    for (const track of tracks) {
      if (frame >= track.startFrame && frame < track.endFrame) {
        return track.sequenceId;
      }
    }
    return null;
  }

  /** Clear layer selection only if current selection is an FX or content-overlay layer.
   *  Preserves content sequence layer selection so keyframe diamonds stay visible. */
  private clearFxLayerSelection(): void {
    const currentLayerId = layerStore.selectedLayerId.peek();
    if (!currentLayerId) return;
    const allSeqs = sequenceStore.sequences.peek();
    // Check if the layer belongs to an FX or content-overlay sequence
    const ownerSeq = allSeqs.find(s => s.layers.some(l => l.id === currentLayerId));
    if (ownerSeq && ownerSeq.kind !== 'content') {
      layerStore.setSelected(null);
      uiStore.selectLayer(null);
    }
  }

  /** Get the Y position where the audio section starts (below ruler, FX, and content rows). */
  private getAudioSectionY(): number {
    if (!this.renderer) return 0;
    const scrollY = this.renderer.getScrollY();
    const fxH = this.renderer.getFxTrackCount() * FX_TRACK_HEIGHT;
    return RULER_HEIGHT + fxH + TRACK_HEIGHT - scrollY;
  }

  /** Check if clientY is in the audio tracks area (below content tracks). */
  private isInAudioArea(clientY: number): boolean {
    if (!this.canvas || !this.renderer) return false;
    const rect = this.canvas.getBoundingClientRect();
    const localY = clientY - rect.top;
    const audioStartY = this.getAudioSectionY();
    if (localY < audioStartY) return false;
    const audioLayouts = audioTrackLayouts.peek();
    const totalAudioH = audioLayouts.reduce((sum, t) => sum + t.trackHeight, 0);
    return localY < audioStartY + totalAudioH;
  }

  /** Hit-test audio tracks from clientY. Returns index in audioTrackLayouts + track info. */
  private audioTrackHitFromY(clientY: number): { index: number; trackId: string; trackY: number; trackHeight: number } | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const localY = clientY - rect.top;
    const audioStartY = this.getAudioSectionY();
    const audioLayouts = audioTrackLayouts.peek();
    let accY = audioStartY;
    for (let i = 0; i < audioLayouts.length; i++) {
      const h = audioLayouts[i].trackHeight;
      if (localY >= accY && localY < accY + h) {
        return { index: i, trackId: audioLayouts[i].trackId, trackY: accY, trackHeight: h };
      }
      accY += h;
    }
    return null;
  }

  /** Determine audio drag mode based on click position relative to range bar edges. */
  private audioDragModeFromX(
    clientX: number,
    audioTrack: { offsetFrame: number; inFrame: number; outFrame: number },
  ): 'move' | 'resize-left' | 'resize-right' | null {
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    const zoom = timelineStore.zoom.peek();
    const scrollX = timelineStore.scrollX.peek();
    const frameWidth = BASE_FRAME_WIDTH * zoom;

    const barLeft = audioTrack.offsetFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH + rect.left;
    const barRight = (audioTrack.offsetFrame + audioTrack.outFrame - audioTrack.inFrame) * frameWidth - scrollX + TRACK_HEADER_WIDTH + rect.left;

    // Edge hit zone: 8px from each edge (4px inside + 4px outside)
    if (Math.abs(clientX - barLeft) <= 8) return 'resize-left';
    if (Math.abs(clientX - barRight) <= 8) return 'resize-right';
    if (clientX >= barLeft && clientX <= barRight) return 'move';
    return null;
  }

  /** Compute drop index for audio track reorder based on Y position. */
  private audioDropIndexFromY(clientY: number): number {
    if (!this.canvas) return 0;
    const rect = this.canvas.getBoundingClientRect();
    const localY = clientY - rect.top;
    const audioStartY = this.getAudioSectionY();
    const audioLayouts = audioTrackLayouts.peek();
    let accY = audioStartY;
    for (let i = 0; i < audioLayouts.length; i++) {
      const midY = accY + audioLayouts[i].trackHeight / 2;
      if (localY < midY) return i;
      accY += audioLayouts[i].trackHeight;
    }
    return audioLayouts.length > 0 ? audioLayouts.length - 1 : 0;
  }

  /** Hit-test the name label overlay for content sequences.
   *  Returns the sequenceId if the point is on a name label, null otherwise. */
  private nameLabelHitTest(clientX: number, clientY: number): string | null {
    if (!this.canvas || !this.renderer) return null;
    if (this.isInRuler(clientY)) return null;
    if (this.isInFxArea(clientY)) return null;

    const rect = this.canvas.getBoundingClientRect();
    const localX = clientX - rect.left;
    if (localX < TRACK_HEADER_WIDTH) return null;

    const frameWidth = BASE_FRAME_WIDTH * timelineStore.zoom.peek();
    const scrollX = timelineStore.scrollX.peek();
    const canvasWidth = rect.width;
    const trackY = this.renderer.getContentTrackY();
    const scrollY = this.renderer.getScrollY();
    const localY = clientY - rect.top;

    const tracks = trackLayouts.peek();
    for (const track of tracks) {
      const labelRect = this.renderer.getNameLabelRect(track, frameWidth, scrollX, canvasWidth, trackY - scrollY);
      if (!labelRect) continue;
      if (
        localX >= labelRect.x &&
        localX <= labelRect.x + labelRect.w &&
        localY >= labelRect.y &&
        localY <= labelRect.y + labelRect.h
      ) {
        return track.sequenceId;
      }
    }
    return null;
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

  /** Hit-test keyframe diamonds: returns the hit keyframe info or null */
  private keyframeHitTest(clientX: number, clientY: number): { frame: number; layerId: string; sequenceStartFrame: number } | null {
    // Only hit-test if we have active keyframes
    const keyframes = keyframeStore.activeLayerKeyframes.peek();
    if (keyframes.length === 0) return null;

    const selectedId = layerStore.selectedLayerId.peek();
    if (!selectedId) return null;

    // Find which sequence owns the selected layer
    const allSeqs = sequenceStore.sequences.peek();
    let owningSeq: typeof allSeqs[0] | null = null;
    for (const seq of allSeqs) {
      if (seq.layers.some(l => l.id === selectedId)) {
        owningSeq = seq;
        break;
      }
    }
    if (!owningSeq) return null;

    if (this.isInRuler(clientY)) return null;
    if (!this.canvas) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (clientX - rect.left < TRACK_HEADER_WIDTH) return null;

    const frameWidth = BASE_FRAME_WIDTH * timelineStore.zoom.peek();
    const hitThresholdFrames = Math.max(0.6, 18 / frameWidth);

    // Check FX and content-overlay tracks in the FX area
    if (this.isInFxArea(clientY) && (owningSeq.kind === 'fx' || owningSeq.kind === 'content-overlay')) {
      const fxTracks = fxTrackLayouts.peek();
      const fxTrackIndex = fxTracks.findIndex(ft => ft.sequenceId === owningSeq!.id && (ft.kind === 'fx' || ft.kind === 'content-overlay'));
      if (fxTrackIndex < 0) return null;

      // Check if clicked Y is on this FX track
      const clickedFxIdx = this.fxTrackIndexFromY(clientY);
      if (clickedFxIdx !== fxTrackIndex) return null;

      const fxTrack = fxTracks[fxTrackIndex];
      const clickFrame = this.getFrame(clientX);
      const localClickFrame = clickFrame - fxTrack.inFrame;

      let bestHit: { frame: number; distance: number } | null = null;
      for (const kf of keyframes) {
        const dist = Math.abs(localClickFrame - kf.frame);
        if (dist <= hitThresholdFrames) {
          if (!bestHit || dist < bestHit.distance) {
            bestHit = { frame: kf.frame, distance: dist };
          }
        }
      }
      if (bestHit) {
        return { frame: bestHit.frame, layerId: selectedId, sequenceStartFrame: fxTrack.inFrame };
      }
      return null;
    }

    // Content track area (not FX, not ruler, not header)
    if (this.isInFxArea(clientY)) return null;

    // Find the content track for this sequence
    const tracks = trackLayouts.peek();
    const track = tracks.find(t => t.sequenceId === owningSeq!.id);
    if (!track) return null;

    // Linear timeline: all content on one row — use X-based hit testing
    if (!this.isInFxArea(clientY) && !this.isInRuler(clientY)) {
      const clickFrame = this.getFrame(clientX);
      const localClickFrame = clickFrame - track.startFrame;
      if (clickFrame >= track.startFrame && clickFrame < track.endFrame) {
        let bestHit: { frame: number; distance: number } | null = null;
        for (const kf of keyframes) {
          const dist = Math.abs(localClickFrame - kf.frame);
          if (dist <= hitThresholdFrames) {
            if (!bestHit || dist < bestHit.distance) {
              bestHit = { frame: kf.frame, distance: dist };
            }
          }
        }
        if (bestHit) {
          return { frame: bestHit.frame, layerId: selectedId, sequenceStartFrame: track.startFrame };
        }
      }
    }
    return null;
  }

  /** Hit-test transition overlays on both content tracks and FX tracks.
   *  Returns the sequenceId + type if the point is on a transition overlay, null otherwise. */
  private transitionHitTest(
    localX: number,
    localY: number,
  ): { sequenceId: string; type: 'fade-in' | 'fade-out' | 'cross-dissolve' } | null {
    if (!this.renderer) return null;
    const frameWidth = BASE_FRAME_WIDTH * timelineStore.zoom.peek();
    const scrollX = timelineStore.scrollX.peek();
    const scrollY = this.renderer.getScrollY();
    const contentTrackY = this.renderer.getContentTrackY() - scrollY;
    const barTop = contentTrackY + 2;
    const barH = Math.round(TRACK_HEIGHT * 0.3);

    // Check content tracks (transition bar is at top 20% of track)
    if (localY >= barTop && localY <= barTop + barH) {
      const tracks = trackLayouts.peek();
      for (let i = 0; i < tracks.length; i++) {
        const track = tracks[i];
        const seqX = track.startFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
        const seqEndX = track.endFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;

        if (track.fadeIn) {
          const fadeW = track.fadeIn.duration * frameWidth;
          if (localX >= seqX && localX <= seqX + fadeW) {
            return { sequenceId: track.sequenceId, type: 'fade-in' };
          }
        }

        if (track.fadeOut) {
          const fadeW = track.fadeOut.duration * frameWidth;
          const fadeX = seqEndX - fadeW;
          if (localX >= fadeX && localX <= seqEndX) {
            return { sequenceId: track.sequenceId, type: 'fade-out' };
          }
        }

        // Check cross dissolve zones
        if (track.crossDissolve && i < tracks.length - 1) {
          const cd = track.crossDissolve;
          const halfDuration = Math.floor(cd.duration / 2);
          const boundary = track.endFrame;
          const cdStartFrame = boundary - halfDuration;
          const cdX = cdStartFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
          const cdW = cd.duration * frameWidth;

          if (localX >= cdX && localX <= cdX + cdW) {
            return { sequenceId: track.sequenceId, type: 'cross-dissolve' };
          }
        }
      }
    }

    // Check FX tracks
    const fxTracks = fxTrackLayouts.peek();
    for (let i = 0; i < fxTracks.length; i++) {
      const fxTrack = fxTracks[i];
      const fxY = RULER_HEIGHT + i * FX_TRACK_HEIGHT - scrollY;
      const barY = fxY + 4;
      const barH = FX_TRACK_HEIGHT - 8;
      if (localY < barY || localY > barY + barH) continue;

      const barX = fxTrack.inFrame * frameWidth - scrollX + TRACK_HEADER_WIDTH;
      const barW = (fxTrack.outFrame - fxTrack.inFrame) * frameWidth;

      if (fxTrack.fadeIn) {
        const fadeW = fxTrack.fadeIn.duration * frameWidth;
        if (localX >= barX && localX <= barX + Math.min(fadeW, barW)) {
          return { sequenceId: fxTrack.sequenceId, type: 'fade-in' };
        }
      }

      if (fxTrack.fadeOut) {
        const fadeW = fxTrack.fadeOut.duration * frameWidth;
        const fadeX = barX + barW - fadeW;
        if (localX >= Math.max(fadeX, barX) && localX <= barX + barW) {
          return { sequenceId: fxTrack.sequenceId, type: 'fade-out' };
        }
      }
    }

    return null;
  }

  /** Delete selected keyframe diamonds (called from shortcuts) */
  deleteSelectedKeyframes(): void {
    const selectedFrames = keyframeStore.selectedKeyframeFrames.peek();
    if (selectedFrames.size === 0) return;
    const layerId = layerStore.selectedLayerId.peek();
    if (!layerId) return;
    keyframeStore.removeKeyframes(layerId, [...selectedFrames]);
    keyframeStore.clearSelection();
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

      // Check keyframe diamond hit BEFORE range bar drag (diamonds have priority)
      const fxKfHit = this.keyframeHitTest(e.clientX, e.clientY);
      if (fxKfHit) {
        keyframeStore.selectKeyframe(fxKfHit.frame, e.shiftKey);
        playbackEngine.seekToFrame(fxKfHit.sequenceStartFrame + fxKfHit.frame);
        this.isDraggingKeyframe = true;
        this.kfDragLayerId = fxKfHit.layerId;
        this.kfDragFromFrame = fxKfHit.frame;
        this.kfDragSequenceStartFrame = fxKfHit.sequenceStartFrame;
        timelineStore.setTimelineDragging(true);
        this.canvas.setPointerCapture(e.pointerId);
        startCoalescing();
        return;
      }

      // Transition hit test on FX tracks (priority: keyframes > transitions > range bar drag)
      {
        const localY = e.clientY - rect.top;
        const fxTransHit = this.transitionHitTest(localX, localY);
        if (fxTransHit) {
          uiStore.selectTransition(fxTransHit);
          return;
        }
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
          timelineStore.setTimelineDragging(true);
          this.canvas.setPointerCapture(e.pointerId);
          this.canvas.style.cursor = mode === 'move' ? 'grabbing' : 'col-resize';
          startCoalescing();
          return;
        }
      }
      // Click in FX area but not on a bar -- deselect transition and seek playhead
      uiStore.selectTransition(null);
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
      return;
    }

    // Check audio track area (below FX + content tracks)
    if (this.isInAudioArea(e.clientY)) {
      const rect = this.canvas.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const audioHit = this.audioTrackHitFromY(e.clientY);
      if (!audioHit) return;

      const audioLayouts = audioTrackLayouts.peek();
      const audioTrack = audioLayouts[audioHit.index];

      // Height resize check (INT-07): 4px inside + 4px outside bottom edge
      const bottomEdgeY = audioHit.trackY + audioHit.trackHeight;
      const localY = e.clientY - rect.top;
      if (Math.abs(localY - bottomEdgeY) <= 4) {
        this.isDraggingAudioHeight = true;
        this.audioHeightTrackId = audioHit.trackId;
        this.audioHeightStartY = e.clientY;
        this.audioHeightOrigHeight = audioTrack.trackHeight;
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor = 'row-resize';
        return;
      }

      // Header area check (INT-06 reorder, INT-09 mute toggle via D-15)
      if (localX < TRACK_HEADER_WIDTH) {
        // Select the audio track
        audioStore.selectTrack(audioHit.trackId);
        uiStore.selectSequence(null);
        uiStore.selectTransition(null);
        this.clearFxLayerSelection();

        // Start potential reorder
        this.isDraggingAudioReorder = true;
        this.audioReorderFromIndex = audioHit.index;
        this.audioReorderStartY = e.clientY;
        this.audioReorderMoved = false;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }

      // Edge resize check (INT-04): 8px hit zone around each edge
      const edgeMode = this.audioDragModeFromX(e.clientX, audioTrack);
      if (edgeMode === 'resize-left' || edgeMode === 'resize-right') {
        audioStore.selectTrack(audioHit.trackId);
        uiStore.selectSequence(null);
        uiStore.selectTransition(null);
        this.clearFxLayerSelection();

        this.isDraggingAudio = true;
        this.audioDragMode = edgeMode;
        this.audioDragTrackId = audioHit.trackId;
        this.audioDragStartFrame = this.getFrame(e.clientX);
        this.audioDragOrigIn = audioTrack.inFrame;
        this.audioDragOrigOut = audioTrack.outFrame;
        this.audioDragOrigOffset = audioTrack.offsetFrame;
        timelineStore.setTimelineDragging(true);
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor = 'col-resize';
        startCoalescing();
        return;
      }

      // Body click/drag check (INT-02 select, INT-03 move, INT-05 slip)
      if (edgeMode === 'move') {
        // Select the track (D-16)
        audioStore.selectTrack(audioHit.trackId);
        uiStore.selectSequence(null);
        uiStore.selectTransition(null);
        this.clearFxLayerSelection();

        // Alt/Option key = slip mode (D-09, INT-05)
        const mode = e.altKey ? 'slip' as const : 'move' as const;
        this.isDraggingAudio = true;
        this.audioDragMode = mode;
        this.audioDragTrackId = audioHit.trackId;
        this.audioDragStartFrame = this.getFrame(e.clientX);
        this.audioDragOrigOffset = audioTrack.offsetFrame;
        this.audioDragOrigIn = audioTrack.inFrame;
        this.audioDragOrigOut = audioTrack.outFrame;
        this.audioDragOrigSlip = audioTrack.slipOffset;
        timelineStore.setTimelineDragging(true);
        this.canvas.setPointerCapture(e.pointerId);
        this.canvas.style.cursor = mode === 'slip' ? 'ew-resize' : 'grabbing';
        startCoalescing();
        return;
      }

      // Click in audio area but not on a bar -- select track if in row, seek playhead
      audioStore.selectTrack(audioHit.trackId);
      uiStore.selectSequence(null);
      uiStore.selectTransition(null);
      this.clearFxLayerSelection();
      playbackEngine.seekToFrame(this.getFrame(e.clientX));
      return;
    }

    // Check keyframe diamond hit BEFORE regular track interactions
    const kfHit = this.keyframeHitTest(e.clientX, e.clientY);
    if (kfHit) {
      // Select the keyframe (shift for additive)
      keyframeStore.selectKeyframe(kfHit.frame, e.shiftKey);

      // Snap playhead to keyframe frame
      playbackEngine.seekToFrame(kfHit.sequenceStartFrame + kfHit.frame);

      // Start keyframe drag
      this.isDraggingKeyframe = true;
      this.kfDragLayerId = kfHit.layerId;
      this.kfDragFromFrame = kfHit.frame;
      this.kfDragSequenceStartFrame = kfHit.sequenceStartFrame;
      timelineStore.setTimelineDragging(true);
      this.canvas.setPointerCapture(e.pointerId);
      startCoalescing();
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const localX = e.clientX - rect.left;

    // Linear timeline: header click just seeks (no per-track headers)
    if (localX < TRACK_HEADER_WIDTH) {
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
      return;
    }

    // Transition hit test on content tracks (priority: keyframes > transitions > sequence selection)
    {
      const localY = e.clientY - rect.top;
      const transHit = this.transitionHitTest(localX, localY);
      if (transHit) {
        // Toggle: clicking already-selected transition deselects it
        const current = uiStore.selectedTransition.peek();
        if (current && current.sequenceId === transHit.sequenceId && current.type === transHit.type) {
          uiStore.selectTransition(null);
        } else {
          uiStore.selectTransition(transHit);
        }
        return;
      }
    }

    // Name label click: toggle isolation
    const nameHit = this.nameLabelHitTest(e.clientX, e.clientY);
    if (nameHit) {
      isolationStore.toggleIsolation(nameHit);
      sequenceStore.setActive(nameHit);
      uiStore.selectSequence(nameHit);
      this.clearFxLayerSelection();
      return;
    }

    // Click in ruler area or on playhead -> start drag-to-scrub immediately
    if (this.isInRuler(e.clientY) || this.isOnPlayhead(e.clientX)) {
      this.isDragging = true;
      timelineStore.setTimelineDragging(true);
      this.canvas.setPointerCapture(e.pointerId);
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
    } else {
      // Click-to-seek + select content sequence by X position — also deselect transition
      uiStore.selectTransition(null);
      const frame = this.getFrame(e.clientX);
      const seqId = this.sequenceFromFrame(frame);
      if (seqId) {
        sequenceStore.setActive(seqId);
        uiStore.selectSequence(seqId);
        this.clearFxLayerSelection();
      }
      playbackEngine.seekToFrame(frame);
    }
  }

  // --- Playhead scrubbing (TIME-03), track header drag (TIME-06), FX drag (FX-09), keyframe drag (KF-10) ---
  private onPointerMove(e: PointerEvent) {
    // Keyframe diamond drag
    if (this.isDraggingKeyframe) {
      const globalFrame = this.getFrame(e.clientX);
      const localFrame = Math.max(0, globalFrame - this.kfDragSequenceStartFrame);
      if (localFrame !== this.kfDragFromFrame) {
        keyframeStore.moveKeyframe(this.kfDragLayerId, this.kfDragFromFrame, localFrame);
        // Update selected frames to track the moved keyframe
        keyframeStore.selectKeyframe(localFrame, false);
        this.kfDragFromFrame = localFrame;
      }
      return;
    }

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

    // Audio track height resize (INT-07)
    if (this.isDraggingAudioHeight) {
      const deltaY = e.clientY - this.audioHeightStartY;
      const newHeight = Math.max(28, Math.min(120, this.audioHeightOrigHeight + deltaY));
      audioStore.setTrackHeight(this.audioHeightTrackId, newHeight);
      return;
    }

    // Audio track reorder (INT-06)
    if (this.isDraggingAudioReorder) {
      if (!this.audioReorderMoved && Math.abs(e.clientY - this.audioReorderStartY) > 5) {
        this.audioReorderMoved = true;
      }
      return;
    }

    // Audio track drag: move, resize, slip (INT-03, INT-04, INT-05)
    if (this.isDraggingAudio) {
      const currentFrame = this.getFrame(e.clientX);
      const deltaFrames = currentFrame - this.audioDragStartFrame;

      if (this.audioDragMode === 'move') {
        const newOffset = this.audioDragOrigOffset + deltaFrames;
        audioStore.setOffset(this.audioDragTrackId, newOffset);
      } else if (this.audioDragMode === 'resize-left') {
        const newIn = Math.max(0, this.audioDragOrigIn + deltaFrames);
        if (newIn < this.audioDragOrigOut - 1) {
          audioStore.setInOut(this.audioDragTrackId, newIn, this.audioDragOrigOut);
        }
      } else if (this.audioDragMode === 'resize-right') {
        const newOut = Math.max(this.audioDragOrigIn + 1, this.audioDragOrigOut + deltaFrames);
        audioStore.setInOut(this.audioDragTrackId, this.audioDragOrigIn, newOut);
      } else if (this.audioDragMode === 'slip') {
        const newSlip = this.audioDragOrigSlip + deltaFrames;
        audioStore.setSlipOffset(this.audioDragTrackId, newSlip);
      }
      return;
    }

    // Playhead scrubbing: seekToFrame updates both currentFrame and displayFrame
    // (via syncDisplayFrame), giving realtime canvas preview during drag.
    if (this.isDragging) {
      const frame = this.getFrame(e.clientX);
      playbackEngine.seekToFrame(frame);
      return;
    }

    // Keyframe hover detection: crosshair cursor + highlight
    // (works on both content tracks and content-overlay tracks in the FX area)
    if (this.canvas && !this.isInRuler(e.clientY)) {
      const kfHover = this.keyframeHitTest(e.clientX, e.clientY);
      const newHoveredFrame = kfHover ? kfHover.frame : null;
      if (newHoveredFrame !== this.hoveredKeyframeFrame) {
        this.hoveredKeyframeFrame = newHoveredFrame;
        if (this.renderer) {
          this.renderer.setHoveredKeyframe(newHoveredFrame);
        }
      }
      if (newHoveredFrame !== null) {
        this.canvas.style.cursor = 'crosshair';
        return;
      }

      // Transition overlay hover: pointer cursor
      const rect = this.canvas.getBoundingClientRect();
      const transHover = this.transitionHitTest(e.clientX - rect.left, e.clientY - rect.top);
      if (transHover) {
        this.canvas.style.cursor = 'pointer';
        return;
      }
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
        if (this.renderer) this.renderer.setHoveredNameLabel(null);
        return; // Skip content area cursor logic
      }

      // Cursor hint: Audio area
      if (this.isInAudioArea(e.clientY)) {
        const rect = this.canvas.getBoundingClientRect();
        const localX = e.clientX - rect.left;
        const localY = e.clientY - rect.top;
        const audioHit = this.audioTrackHitFromY(e.clientY);

        if (audioHit) {
          const audioLayouts = audioTrackLayouts.peek();
          const audioTrack = audioLayouts[audioHit.index];
          const bottomEdgeY = audioHit.trackY + audioHit.trackHeight;

          // Bottom edge: row-resize cursor (INT-07)
          if (Math.abs(localY - bottomEdgeY) <= 4) {
            this.canvas.style.cursor = 'row-resize';
          } else if (localX < TRACK_HEADER_WIDTH) {
            // Header area: pointer cursor for mute toggle / reorder
            this.canvas.style.cursor = 'pointer';
          } else {
            // Waveform body area
            const mode = this.audioDragModeFromX(e.clientX, audioTrack);
            if (mode === 'resize-left' || mode === 'resize-right') {
              this.canvas.style.cursor = 'col-resize';
            } else if (mode === 'move') {
              this.canvas.style.cursor = e.altKey ? 'ew-resize' : 'grab';
            } else {
              this.canvas.style.cursor = 'default';
            }
          }
        } else {
          this.canvas.style.cursor = 'default';
        }
        if (this.renderer) this.renderer.setHoveredNameLabel(null);
        return;
      }

      // Name label hover: pointer cursor + highlight
      const nameHover = this.nameLabelHitTest(e.clientX, e.clientY);
      if (nameHover) {
        this.canvas.style.cursor = 'pointer';
        if (this.renderer) {
          this.renderer.setHoveredNameLabel(nameHover);
        }
        return;
      }

      // Clear name label hover when not hovering
      if (this.renderer) {
        this.renderer.setHoveredNameLabel(null);
      }

      // Linear timeline: no grab cursor on headers
      this.canvas.style.cursor = 'default';
    }
  }

  private onPointerUp(e: PointerEvent) {
    // Keyframe diamond drag end
    if (this.isDraggingKeyframe) {
      this.isDraggingKeyframe = false;
      timelineStore.setTimelineDragging(false);
      stopCoalescing();
      if (this.canvas) {
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture may have been released
        }
      }
      return;
    }

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
      timelineStore.setTimelineDragging(false);
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

    // Audio track height resize end (INT-07)
    if (this.isDraggingAudioHeight) {
      this.isDraggingAudioHeight = false;
      this.audioHeightTrackId = '';
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

    // Audio track reorder end (INT-06)
    if (this.isDraggingAudioReorder) {
      if (this.audioReorderMoved) {
        const dropIndex = this.audioDropIndexFromY(e.clientY);
        if (dropIndex !== this.audioReorderFromIndex) {
          audioStore.reorderTracks(this.audioReorderFromIndex, dropIndex);
        }
      } else {
        // No drag happened -- it was a click, toggle mute (D-15)
        const audioLayouts = audioTrackLayouts.peek();
        if (this.audioReorderFromIndex >= 0 && this.audioReorderFromIndex < audioLayouts.length) {
          const trackId = audioLayouts[this.audioReorderFromIndex].trackId;
          const track = audioStore.getTrack(trackId);
          if (track) {
            audioStore.setMuted(trackId, !track.muted);
          }
        }
      }
      this.isDraggingAudioReorder = false;
      this.audioReorderFromIndex = -1;
      this.audioReorderMoved = false;
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

    // Audio track drag end (move/resize/slip)
    if (this.isDraggingAudio) {
      this.isDraggingAudio = false;
      this.audioDragTrackId = '';
      timelineStore.setTimelineDragging(false);
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

    // Playhead drag end
    if (this.isDragging) {
      this.isDragging = false;
      timelineStore.setTimelineDragging(false);
      // Final sync: seekToFrame calls syncDisplayFrame which triggers Preview render
      // now that timelineDragging is false
      playbackEngine.seekToFrame(timelineStore.currentFrame.peek());
      if (this.canvas) {
        try {
          this.canvas.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture may have been released by browser
        }
      }
    }
  }

  // --- Zoom and scroll (TIME-04) ---
  private onWheel(e: WheelEvent) {
    if (!this.canvas) return;
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();

    if (e.ctrlKey) {
      // Ctrl+scroll = zoom at cursor (mouse scroll + trackpad pinch-to-zoom sets ctrlKey on macOS)
      const cursorX = e.clientX - rect.left - TRACK_HEADER_WIDTH;
      const oldZoom = timelineStore.zoom.peek();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = clamp(oldZoom * factor, 0.1, 10);

      // Keep frame under cursor stable
      const frameUnderCursor = (timelineStore.scrollX.peek() + cursorX) / (BASE_FRAME_WIDTH * oldZoom);
      const newScrollX = frameUnderCursor * BASE_FRAME_WIDTH * newZoom - cursorX;

      timelineStore.setZoom(newZoom);
      timelineStore.setScrollX(Math.max(0, newScrollX));
    } else if (e.metaKey) {
      // Cmd+scroll = vertical scroll (mouse users)
      if (e.deltaY !== 0) {
        const newScrollY = timelineStore.scrollY.peek() + e.deltaY;
        timelineStore.setScrollY(Math.max(0, Math.min(timelineStore.maxScrollY.peek(), newScrollY)));
      }
    } else if (e.shiftKey) {
      // Shift+scroll = vertical scroll (fallback)
      // macOS swaps deltaY to deltaX when Shift held, so use whichever axis has a value
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (delta !== 0) {
        const newScrollY = timelineStore.scrollY.peek() + delta;
        timelineStore.setScrollY(Math.max(0, Math.min(timelineStore.maxScrollY.peek(), newScrollY)));
      }
    } else {
      // No modifier — handle both mouse wheel and trackpad
      // Mouse wheel: only produces deltaY (deltaX === 0) → route to horizontal scroll
      // Trackpad: produces deltaX (and maybe deltaY) → natural two-axis scrolling
      if (e.deltaX !== 0) {
        // Trackpad horizontal swipe (or mouse tilt-wheel): apply deltaX to horizontal scroll
        const newScrollX = timelineStore.scrollX.peek() + e.deltaX;
        timelineStore.setScrollX(Math.max(0, newScrollX));
        // Trackpad vertical component: apply deltaY to vertical scroll
        if (e.deltaY !== 0) {
          const newScrollY = timelineStore.scrollY.peek() + e.deltaY;
          timelineStore.setScrollY(Math.max(0, Math.min(timelineStore.maxScrollY.peek(), newScrollY)));
        }
      } else if (e.deltaY !== 0) {
        // deltaX === 0, deltaY !== 0 → mouse wheel: route to horizontal scroll
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
