import './index.css';
import {render} from 'preact';
import {getCurrentWindow} from '@tauri-apps/api/window';
import {listen} from '@tauri-apps/api/event';
import {invoke} from '@tauri-apps/api/core';
import {App} from './app';
import {initTempProjectDir} from './lib/projectDir';
import {initTheme} from './lib/themeManager';
import {guardUnsavedChanges} from './lib/unsavedGuard';
import {startAutoSave} from './lib/autoSave';
import {mountShortcuts, handleSave, handleNewProject, handleOpenProject, handleCloseProject} from './lib/shortcuts';
import {createOpenedUrlQueue, toPackageManifestPath} from './lib/openedProjectUrls';
import {reportLatchedIoFailure, showProjectIoFailureDialog} from './lib/projectIoFailureDialog';
import {projectStore} from './stores/projectStore';
import {undo, redo} from './lib/history';
import {canvasStore} from './stores/canvasStore';
import {uiStore} from './stores/uiStore';
import {timelineStore} from './stores/timelineStore';
import {paintStore} from './stores/paintStore';
import {installPhysicPaintApplyListener, installPhysicPaintAudioContextPublisher, installPhysicPaintAudioOwnershipListener, installPhysicPaintEfxPaintDocumentListener, installPhysicPaintFrameSyncListener, installPhysicPaintImageImportListener, installPhysicPaintImageLibraryListener, installPhysicPaintProjectContextRequestListener, installPhysicPaintRotoAuthorityListener, installPhysicPaintScriptLibraryListener, installPhysicPaintStateSaveListener} from './lib/physicPaintBridge';
import {setDebugApplyPayloadValidation} from './types/physicPaint';
import {shouldReloadPaintWindow} from './lib/paintWindowWatchdog';
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
  // firing. The detection stays live as a diagnostic (console warn on a
  // stall), but the automatic reload is DISABLED by request (47 close-out):
  // a false-positive reload on focus regain was worse than a black window.
  // If the compositor ever dies again, the warn traces the stall and the
  // reload can be re-enabled below. The detection ONLY fires while the paint
  // window is focused AND the user is actively interacting with it: WKWebView
  // pauses rAF for occluded/background windows even when visibilityState
  // reports 'visible', so an idle or out-of-focus window must never count as
  // a stall. Focused + active interaction + rAF stall = the compositor is
  // dead. A 15s cooldown prevents a warn loop if the GPU process does not
  // restart.
  let lastRafTick = performance.now();
  let lastActivityAt = performance.now();
  let lastReloadAt = 0;
  // 47-05: the black-window root cause is a ~45 MB/s leak of the WKWebView's
  // presented-frame backing buffers, driven by the CONTINUOUS rAF tick that
  // used to run here (10 Hz x ~4.6 MB window backing = the measured rate; the
  // editor window, which idles without rAF, never leaks). The watchdog is now
  // event-driven: each interaction schedules ONE rAF probe. If the compositor
  // is alive the probe fires within ~16ms (lastRafTick fresh); if it died
  // (black window), the probe never fires and the stall check below reloads.
  const probeRaf = () => { lastRafTick = performance.now(); };
  const onActivity = () => {
    lastActivityAt = performance.now();
    requestAnimationFrame(probeRaf);
  };
  window.addEventListener('pointerdown', onActivity, { passive: true });
  window.addEventListener('pointermove', onActivity, { passive: true });
  window.addEventListener('pointerup', onActivity, { passive: true });
  window.addEventListener('keydown', onActivity, { passive: true });
  // Regaining focus is NOT proof of a dead compositor: WKWebView pauses rAF
  // for occluded windows, so lastRafTick is stale by the time the user
  // returns. Counting focus as plain activity re-armed the stall check in the
  // gap before rAF resumed and reloaded a healthy window (the "UI reloads in a
  // fraction of a second on focus regain" report). Assume the compositor is
  // alive on return (optimistic tick) and let the probe confirm; a genuinely
  // dead compositor re-arms the stall check on the user's next interaction.
  const onFocus = () => {
    lastActivityAt = performance.now();
    lastRafTick = performance.now();
    requestAnimationFrame(probeRaf);
  };
  window.addEventListener('focus', onFocus, { passive: true });
  window.setInterval(() => {
    const now = performance.now();
    if (shouldReloadPaintWindow({
      now,
      lastActivityAt,
      lastRafTick,
      lastReloadAt,
      hasFocus: document.hasFocus(),
    })) {
      lastReloadAt = now;
      // 47 close-out: automatic reload is DISABLED by request — a false-positive
      // reload on focus regain was worse than a black window. The detection
      // stays live as a diagnostic: if the compositor ever dies again, this
      // warn traces the stall and the reload can be re-enabled below.
      console.warn(`[watchdog] compositor stall detected — rAF last tick ${Math.round(now - lastRafTick)}ms ago — reload DISABLED`);
      // window.location.reload();
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
    // 49-04: the main webview answers the Studio's image-library request/result
    // bridge pair (the picker grid + in-picker Import refresh). Without this
    // install the child's emitTo('main', ...) has no receiver and every request
    // times out. Main window only; app-lifetime install like the siblings.
    await installPhysicPaintImageLibraryListener();
    // quick-260921-bjm: the main webview also PERFORMS the Studio picker's
    // imports. The child names the dialog-selected paths only; this realm —
    // whose imageStore feeds the persisted manifest `images` array — resolves
    // its own directory, imports, and answers with the post-import library.
    // Without this install the child's import request has no receiver and
    // times out. Main window only; app-lifetime install like the siblings.
    await installPhysicPaintImageImportListener();
    // quick-260922-al1: the main webview answers the Studio's project-context
    // request — the Scripts panel's layer-scope pull/round trip. The Studio
    // window RE-BOOTS on every layer switch (the reused window is navigated),
    // and the project context is only pushed at bind/clear — before the Studio
    // exists — so a Studio opened later PULLS the live layer list plus the
    // stored scope through this installer. Without it the pull has no receiver
    // and the scope stays All with snapshotted provenance.
    await installPhysicPaintProjectContextRequestListener();
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
    listen('menu:undo', () => { if (document.hasFocus()) undo(); });
    listen('menu:redo', () => { if (document.hasFocus()) redo(); });

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

    // 52.2-11 (D-03): a `.mce` package double-clicked in Finder. macOS delivers
    // the document through `RunEvent::Opened`; the native side EMITS it live on
    // the `opened` channel once this listener exists, and BUFFERS it for the
    // cold start (the event fires before the webview is alive) for the one
    // `opened_urls` drain below. Both channels feed ONE queue, so a URL that
    // arrives twice cannot open the project twice; the guard + open path is the
    // menu open's (52.2-11 Task 3).
    const openedUrlQueue = createOpenedUrlQueue();
    const openPackageFromPath = async (openedPath: string): Promise<void> => {
      const guard = await guardUnsavedChanges();
      if (guard === 'cancelled') return;
      try {
        // The OS names the PACKAGE directory; the store loads the manifest in it.
        await projectStore.openProject(toPackageManifestPath(openedPath));
      } catch (err) {
        console.error('Failed to open project:', err);
        await showProjectIoFailureDialog('open', err);
      }
    };
    const applyOpenedUrls = async (urls: readonly string[]): Promise<void> => {
      openedUrlQueue.push(urls);
      for (const openedPath of openedUrlQueue.drain()) {
        await openPackageFromPath(openedPath);
      }
    };
    await listen<string[]>('opened', (event) => {
      applyOpenedUrls(event.payload).catch((err) => {
        console.error('Failed to open a package delivered by the OS:', err);
        // The callback is not async — surface the failure without awaiting it.
        void showProjectIoFailureDialog('open', err);
      });
    });
    // Cold start: drain the buffer exactly once. This call also flips the
    // native side to live emission, so nothing is delivered twice.
    try {
      await applyOpenedUrls(await invoke<string[]>('opened_urls'));
    } catch (err) {
      // Fail-soft like the live `opened` listener above: a missing native
      // command must not abort the rest of startup (close guard, shortcuts).
      console.error('Failed to drain OS-delivered packages:', err);
      // Latched: the cold-start drain runs once, but the per-URL open failures
      // inside it already reported — one modal per streak, not one per URL.
      reportLatchedIoFailure('open', err);
    }

    // Guard window close: show unsaved-changes dialog and prevent close on Cancel
    getCurrentWindow().onCloseRequested(async (event) => {
      const result = await guardUnsavedChanges();
      if (result === 'cancelled') {
        event.preventDefault();
      }
    });
  });
}
