import './index.css';
import {render} from 'preact';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';
import {App} from './app';
import {initTempProjectDir} from './lib/projectDir';
import {initTheme} from './lib/themeManager';
import {guardUnsavedChanges} from './lib/unsavedGuard';
import {startAutoSave} from './lib/autoSave';
import {mountShortcuts, handleSave, handleNewProject, handleOpenProject, handleCloseProject} from './lib/shortcuts';
import {undo, redo} from './lib/history';
import {canvasStore} from './stores/canvasStore';
import {uiStore} from './stores/uiStore';
import {timelineStore} from './stores/timelineStore';
import {paintStore} from './stores/paintStore';
import {installPhysicPaintApplyListener, installPhysicPaintAudioContextPublisher, installPhysicPaintAudioOwnershipListener, installPhysicPaintEfxPaintDocumentListener, installPhysicPaintFrameSyncListener, installPhysicPaintRotoAuthorityListener, installPhysicPaintScriptLibraryListener, installPhysicPaintStateSaveListener, installPhysicPaintThumbnailEncodeListener} from './lib/physicPaintBridge';
import {setDebugApplyPayloadValidation} from './types/physicPaint';
import {setDebugRotoUndo} from './components/physic-paint/hooks/useRotoPhysicalEditHistory';
import {setDebugReplayDiff} from './lib/physicPaintBridge';
// 46 UAT debug hook: enable per-clause apply-payload rejection logging from the
// console via window.__setDebugApplyPayloadValidation(true).
(window as unknown as { __setDebugApplyPayloadValidation: (enabled: boolean) => void }).__setDebugApplyPayloadValidation = setDebugApplyPayloadValidation;
// 46 UAT debug hook: enable why-Paste-does-or-doesn't-record / why-Undo-rejects
// logging from the console via window.__setDebugRotoUndo(true).
(window as unknown as { __setDebugRotoUndo: (enabled: boolean) => void }).__setDebugRotoUndo = setDebugRotoUndo;
// 46 UAT debug hook: enable field-level diff of a rejected parent replay-target
// snapshot from the MAIN window console via window.__setDebugReplayDiff(true).
(window as unknown as { __setDebugReplayDiff: (enabled: boolean) => void }).__setDebugReplayDiff = setDebugReplayDiff;

const root = document.getElementById('app')!;

if (window.location.pathname === '/physics-paint') {
  // Compositor-death watchdog: when the WKWebView GPU/compositing process
  // dies, the web process survives (the window goes black) but rAF stops
  // firing. Reload to recover — the sessionStorage document checkpoint
  // rehydrates the Studio with the last pushed state (bounded by the 2s push
  // debounce). The reload ONLY fires while the user is actively interacting
  // with the paint window: WKWebView pauses rAF for occluded/background
  // windows even when visibilityState reports 'visible' and the document
  // reports focus, so an idle window must never reload (the paint window
  // reloaded every 5-15s while the user typed in another app). Active
  // interaction + rAF stall = the compositor is dead. A 15s cooldown
  // prevents a reload loop if the GPU process does not restart.
  let lastRafTick = performance.now();
  let lastActivityAt = performance.now();
  let lastReloadAt = 0;
  const rafTick = () => { lastRafTick = performance.now(); };
  requestAnimationFrame(rafTick);
  const onActivity = () => { lastActivityAt = performance.now(); };
  window.addEventListener('pointerdown', onActivity, { passive: true });
  window.addEventListener('pointermove', onActivity, { passive: true });
  window.addEventListener('pointerup', onActivity, { passive: true });
  window.addEventListener('keydown', onActivity, { passive: true });
  window.setInterval(() => {
    const now = performance.now();
    if (now - lastActivityAt < 3000 && now - lastRafTick > 5000 && now - lastReloadAt > 15000) {
      lastReloadAt = now;
      window.location.reload();
    }
  }, 1000);
  import('./components/physic-paint/PhysicsPaintStudio').then(({ PhysicsPaintStudio }) => {
    render(<PhysicsPaintStudio />, root);
  });
} else {
  // Resolve temp project dir from Tauri's app data path before rendering
  initTempProjectDir().then(async () => {
    await initTheme();
    await paintStore.initFromPreferences(); // Load saved brush prefs BEFORE render
    render(<App />, root);
    startAutoSave();
    mountShortcuts(); // Mount keyboard shortcuts globally
    await installPhysicPaintApplyListener();
    // 47-01: main window accepts the Studio's EFX Paint document sync (track
    // CRUD happens in the child window's own efxPaintStore instance).
    await installPhysicPaintEfxPaintDocumentListener();
    await installPhysicPaintScriptLibraryListener();
    await installPhysicPaintRotoAuthorityListener();
    await installPhysicPaintStateSaveListener();
    await installPhysicPaintThumbnailEncodeListener();
    // Route physic-paint:seek-frame navigation events from the standalone
    // Physics Paint window to the editor timeline. Awaited install like the
    // sibling bridge installs above; the discarded cleanup handle matches the
    // app-lifetime pattern.
    await installPhysicPaintFrameSyncListener();

    // 41-03 (D-02): push revisioned audio-preview context updates to the EFX
    // Paint window on every main-editor audio change. Main window only — this
    // branch never runs in the child bundle. App-lifetime effect; the
    // discarded cleanup matches the sibling installs above.
    installPhysicPaintAudioContextPublisher();

    // 41-04 (D-05 symmetric guard): record the EFX Paint window's audio
    // ownership claim so playbackEngine.startAudioPlayback() suppresses itself
    // while the child owns monitoring. Main window only; app-lifetime install.
    await installPhysicPaintAudioOwnershipListener();

    // Listen for undo/redo events emitted by the native macOS menu.
    // On macOS, Cmd+Z and Cmd+Shift+Z are intercepted by the native menu
    // accelerators before keydown reaches the webview, so these menu event
    // listeners are the sole path for undo/redo on that platform.
    listen('menu:undo', () => { undo(); });
    listen('menu:redo', () => { redo(); });

    // Listen for zoom events emitted by the native macOS View menu.
    // Zoom in/out now use bare = / - keys via tinykeys (no Cmd modifier),
    // so the menu items have no accelerator. These listeners handle the
    // click path when users select Zoom In / Zoom Out from the View menu.
    // Fit to Window (Cmd+0) still uses a native accelerator.
    listen('menu:zoom-in', () => {
      if (uiStore.mouseRegion.peek() === 'timeline') {
        timelineStore.zoomIn();
      } else {
        canvasStore.zoomIn();
      }
    });
    listen('menu:zoom-out', () => {
      if (uiStore.mouseRegion.peek() === 'timeline') {
        timelineStore.zoomOut();
      } else {
        canvasStore.zoomOut();
      }
    });
    listen('menu:fit-to-window', () => { canvasStore.fitToWindow(); });

    // Listen for File menu events emitted by the native macOS File menu.
    // On macOS, Cmd+N/O/S/W are intercepted by the native menu accelerators
    // before keydown reaches the webview, so these listeners are the sole path
    // for file operations on that platform (same pattern as Edit > Undo/Redo).
    listen('menu:new-project', () => { handleNewProject(); });
    listen('menu:open-project', () => { handleOpenProject(); });
    listen('menu:save-project', () => { handleSave(); });

    listen('menu:close-project', () => { handleCloseProject(); });

    listen('menu:export', () => { uiStore.setEditorMode('export'); });

    // Guard window close: show unsaved-changes dialog and prevent close on Cancel
    getCurrentWindow().onCloseRequested(async (event) => {
      const result = await guardUnsavedChanges();
      if (result === 'cancelled') {
        event.preventDefault();
      }
    });
  });
}
