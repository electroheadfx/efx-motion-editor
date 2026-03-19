import {tinykeys} from 'tinykeys';
import {playbackEngine} from './playbackEngine';
import {isFullscreen, enterFullscreen, exitFullscreen} from './fullscreenManager';
import {pressJ, pressK, pressL} from './jklShuttle';
import {findPrevSequenceStart, findNextSequenceStart} from './sequenceNav';
import {trackLayouts} from './frameMap';
import {undo, redo} from './history';
import {guardUnsavedChanges} from './unsavedGuard';
import {cycleTheme} from './themeManager';
import {projectStore} from '../stores/projectStore';
import {uiStore} from '../stores/uiStore';
import {layerStore} from '../stores/layerStore';
import {sequenceStore} from '../stores/sequenceStore';
import {canvasStore} from '../stores/canvasStore';
import {blurStore} from '../stores/blurStore';
import {keyframeStore} from '../stores/keyframeStore';
import {timelineStore} from '../stores/timelineStore';
import {isFxLayer} from '../types/layer';
import {save, open} from '@tauri-apps/plugin-dialog';

/**
 * Check whether a keyboard shortcut should be suppressed because the user
 * is typing in a form element or contentEditable region.
 */
function shouldSuppressShortcut(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (!target) return false;

  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;

  return false;
}

// --- Internal handler functions ---

async function handleSave(): Promise<void> {
  if (projectStore.isSaving.value) return;

  if (!projectStore.filePath.value) {
    // Never saved — open Save As picker
    const filePath = await save({
      filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
      defaultPath: `${projectStore.name.value}.mce`,
    });
    if (filePath) {
      try {
        await projectStore.saveProjectAs(filePath);
      } catch (err) {
        console.error('Failed to save project:', err);
      }
    }
  } else {
    try {
      await projectStore.saveProject();
    } catch (err) {
      console.error('Failed to save project:', err);
    }
  }
}

async function handleNewProject(): Promise<void> {
  const guard = await guardUnsavedChanges();
  if (guard === 'cancelled') return;
  uiStore.showNewProjectDialog.value = true;
}

async function handleOpenProject(): Promise<void> {
  const guard = await guardUnsavedChanges();
  if (guard === 'cancelled') return;

  const selected = await open({
    multiple: false,
    filters: [{name: 'EFX Motion Project', extensions: ['mce']}],
  });
  if (selected && typeof selected === 'string') {
    try {
      await projectStore.openProject(selected);
    } catch (err) {
      console.error('Failed to open project:', err);
    }
  }
}

function handleDelete(): void {
  // Check for selected keyframe diamonds first (KF-12)
  const selectedKfFrames = keyframeStore.selectedKeyframeFrames.peek();
  if (selectedKfFrames.size > 0) {
    const layerId = layerStore.selectedLayerId.peek();
    if (layerId) {
      keyframeStore.removeKeyframes(layerId, [...selectedKfFrames]);
      keyframeStore.clearSelection();
      return;
    }
  }

  // Check for selected key photo — delete just that key photo, not the sequence
  const selectedKpId = sequenceStore.selectedKeyPhotoId.peek();
  if (selectedKpId) {
    const allSeqs = sequenceStore.sequences.peek();
    const ownerSeq = allSeqs.find(s => s.keyPhotos.some(kp => kp.id === selectedKpId));
    if (ownerSeq) {
      sequenceStore.removeKeyPhoto(ownerSeq.id, selectedKpId);
      return;
    }
  }

  // Delete selected layer if any (FX layers delete via this path)
  const selectedLayer = uiStore.selectedLayerId.value;
  if (selectedLayer) {
    layerStore.remove(selectedLayer);
    layerStore.setSelected(null);
    uiStore.selectLayer(null);
    return;
  }

  // Delete selected content sequence (no confirmation — undo via Cmd+Z)
  const selectedSeqId = uiStore.selectedSequenceId.value;
  if (selectedSeqId) {
    const seq = sequenceStore.getById(selectedSeqId);
    if (seq && seq.kind === 'content') {
      sequenceStore.remove(seq.id);
      uiStore.selectSequence(null);
      return;
    }
  }
}

// --- Nudge helpers ---

function nudgeIfSelected(axis: 'x' | 'y', delta: number): void {
  const selectedId = layerStore.selectedLayerId.peek();
  if (!selectedId) return;
  const allLayers = layerStore.layers.peek();
  const layer = allLayers.find(l => l.id === selectedId);
  if (layer) {
    layerStore.updateLayer(selectedId, {
      transform: {...layer.transform, [axis]: layer.transform[axis] + delta},
    });
  }
}

function handleArrow(axis: 'x' | 'y', delta: number): void {
  const region = uiStore.mouseRegion.peek();

  if (region === 'timeline') {
    // Timeline region: arrows always scrub timeline
    // delta already has correct sign and magnitude (1 or 10 with shift)
    const current = timelineStore.currentFrame.peek();
    playbackEngine.seekToFrame(Math.max(0, current + delta));
    return;
  }

  if (region === 'canvas') {
    // Canvas region: nudge selected layer if any
    nudgeIfSelected(axis, delta);
    return;
  }

  // Fallback ('other'): left/right scrub if no layer selected, nudge if selected; up/down always nudge
  if (axis === 'x') {
    const selectedId = layerStore.selectedLayerId.peek();
    if (selectedId) {
      nudgeIfSelected(axis, delta);
    } else {
      if (delta < 0) playbackEngine.stepBackward();
      else playbackEngine.stepForward();
    }
  } else {
    nudgeIfSelected(axis, delta);
  }
}

// --- Mount shortcuts ---

/**
 * Mount all keyboard shortcuts globally via tinykeys.
 * Returns the unsubscribe function (typically not needed — shortcuts remain
 * active for the lifetime of the app).
 */
export function mountShortcuts(): () => void {
  return tinykeys(window, {
    // Playback: Space is handled in CanvasArea (deferred to keyup for Space+drag pan support)
    'ArrowLeft': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleArrow('x', -1);
    },
    'Shift+ArrowLeft': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleArrow('x', -10);
    },
    'ArrowRight': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleArrow('x', 1);
    },
    'Shift+ArrowRight': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleArrow('x', 10);
    },
    'ArrowUp': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleArrow('y', -1);
    },
    'Shift+ArrowUp': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleArrow('y', -10);
    },
    'ArrowDown': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleArrow('y', 1);
    },
    'Shift+ArrowDown': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleArrow('y', 10);
    },

    // JKL Scrub (KEY-03)
    'KeyJ': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      pressJ();
    },
    'KeyK': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      pressK();
    },
    'KeyL': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      pressL();
    },

    // Undo/Redo (KEY-04)
    '$mod+KeyZ': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      undo();
    },
    '$mod+Shift+KeyZ': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      redo();
    },

    // Fullscreen toggle (FL-01)
    '$mod+Shift+KeyF': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      if (isFullscreen.peek()) {
        exitFullscreen();
      } else {
        enterFullscreen();
      }
    },

    // File operations (KEY-05)
    '$mod+KeyS': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleSave();
    },
    '$mod+KeyN': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleNewProject();
    },
    '$mod+KeyO': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      handleOpenProject();
    },

    // Delete (KEY-06)
    'Backspace': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      handleDelete();
    },
    'Delete': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      handleDelete();
    },

    // Shortcuts overlay (KEY-08)
    'Shift+?': (e: KeyboardEvent) => {
      // ? key -- uses event.key matching for layout-independent binding
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      uiStore.toggleShortcutsOverlay();
    },

    // Theme cycle (KEY-09)
    '$mod+Shift+KeyT': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      cycleTheme();
    },

    // Context-aware zoom (ZOOM-01, ZOOM-03) — bare keys, no Cmd modifier
    // When mouse hovers timeline: zoom timeline; otherwise: zoom canvas
    '=': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const region = uiStore.mouseRegion.peek();
      if (region === 'timeline') {
        timelineStore.zoomIn();
      } else {
        canvasStore.zoomIn();
      }
    },
    '+': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const region = uiStore.mouseRegion.peek();
      if (region === 'timeline') {
        timelineStore.zoomIn();
      } else {
        canvasStore.zoomIn();
      }
    },
    '-': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const region = uiStore.mouseRegion.peek();
      if (region === 'timeline') {
        timelineStore.zoomOut();
      } else {
        canvasStore.zoomOut();
      }
    },
    '$mod+Digit0': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      canvasStore.fitToWindow();
    },
    'KeyF': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      canvasStore.toggleFitLock();
    },

    // Blur bypass toggle (BLUR-05)
    'Shift+KeyB': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      blurStore.toggleBypass();
    },

    // Add keyframe at current frame (KF-07)
    'KeyI': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const selectedId = layerStore.selectedLayerId.peek();
      if (!selectedId) return;
      // Find the layer to check if it's animatable (content layer, not base/FX)
      const allSeqs = sequenceStore.sequences.peek();
      for (const seq of allSeqs) {
        const layer = seq.layers.find(l => l.id === selectedId);
        if (layer) {
          if (isFxLayer(layer) || layer.isBase) return;
          keyframeStore.addKeyframe(selectedId, timelineStore.currentFrame.peek());
          return;
        }
      }
    },

    // Transform: Escape deselect (XFORM-09)
    // Fullscreen exit takes priority over layer deselect
    'Escape': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      e.preventDefault();
      if (isFullscreen.peek()) {
        exitFullscreen();
        return;
      }
      layerStore.setSelected(null);
      uiStore.selectLayer(null);
    },

    // Timeline navigation: Home/End/PageUp/PageDown (NAV-01..04)
    'Home': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      playbackEngine.seekToFrame(0);
    },
    'End': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const lastFrame = timelineStore.totalFrames.peek();
      playbackEngine.seekToFrame(Math.max(0, lastFrame - 1));
    },
    'PageUp': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const target = findPrevSequenceStart(trackLayouts.peek(), timelineStore.currentFrame.peek());
      if (target !== null) {
        playbackEngine.seekToFrame(target);
      } else {
        playbackEngine.seekToFrame(0);
      }
    },
    'PageDown': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const target = findNextSequenceStart(trackLayouts.peek(), timelineStore.currentFrame.peek());
      if (target !== null) {
        playbackEngine.seekToFrame(target);
      } else {
        const lastFrame = timelineStore.totalFrames.peek();
        playbackEngine.seekToFrame(Math.max(0, lastFrame - 1));
      }
    },

    // Cmd+Arrow sequence navigation — laptop-friendly alternatives (NAV-CMD-ARROWS)
    '$mod+ArrowLeft': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const target = findPrevSequenceStart(trackLayouts.peek(), timelineStore.currentFrame.peek());
      if (target !== null) {
        playbackEngine.seekToFrame(target);
      } else {
        playbackEngine.seekToFrame(0);
      }
    },
    '$mod+ArrowRight': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const target = findNextSequenceStart(trackLayouts.peek(), timelineStore.currentFrame.peek());
      if (target !== null) {
        playbackEngine.seekToFrame(target);
      } else {
        const lastFrame = timelineStore.totalFrames.peek();
        playbackEngine.seekToFrame(Math.max(0, lastFrame - 1));
      }
    },
    '$mod+Shift+ArrowLeft': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      playbackEngine.seekToFrame(0);
    },
    '$mod+Shift+ArrowRight': (e: KeyboardEvent) => {
      if (shouldSuppressShortcut(e)) return;
      if (isFullscreen.peek()) return;
      e.preventDefault();
      const lastFrame = timelineStore.totalFrames.peek();
      playbackEngine.seekToFrame(Math.max(0, lastFrame - 1));
    },
  });
}
