//! Native occlusion monitor for the physics-paint window.
//!
//! Proven mechanism (via `log stream`, session F): the WebKit GPU process
//! removes its connection to the paint page ~7 min after the window becomes
//! occluded/inactive — `GPUProcess::removeGPUConnectionToWebProcess` at
//! +7:03, followed by the black window on re-presentation. The web content
//! process survives; no crash report; `inactiveSchedulingPolicy` governs task
//! scheduling, not this GPU-connection teardown, so no JS or webview knob
//! prevents it.
//!
//! Mitigation: while the window stays fully occluded for 5 minutes, reload it
//! (hidden — the user is not looking). The fresh page creates a new GPU
//! connection and resets the 7-minute clock; the sessionStorage document
//! checkpoint restores the painting losslessly. A reload every 5 minutes of
//! continuous occlusion keeps the connection age under the eviction threshold.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, WebviewWindow};

pub struct OcclusionStopFlag(pub Arc<AtomicBool>);

impl Default for OcclusionStopFlag {
    fn default() -> Self {
        Self(Arc::new(AtomicBool::new(false)))
    }
}

/// Reload cadence while occluded: 5 min keeps the page's GPU connection well
/// under the ~7 min WebKit eviction threshold.
const OCCLUDED_RELOAD_AFTER: Duration = Duration::from_secs(5 * 60);
/// Poll cadence for the window occlusion state.
const POLL_INTERVAL: Duration = Duration::from_secs(2);

/// The NSWindow pointer is only ever dereferenced on the main thread (inside
/// run_on_main_thread), so it is safe to move across threads as a raw handle.
/// Access goes through a method so closures capture the whole wrapper (and
/// its Send impl), not the raw field.
#[derive(Clone, Copy)]
struct SendNsWindow(*mut objc2_app_kit::NSWindow);
unsafe impl Send for SendNsWindow {}

impl SendNsWindow {
    fn as_ptr(&self) -> *mut objc2_app_kit::NSWindow {
        self.0
    }
}

pub fn start(window: WebviewWindow, app: &AppHandle) {
    let app = app.clone();
    let stop = app.state::<OcclusionStopFlag>().0.clone();
    let Some(handle) = window.ns_window().ok() else {
        return;
    };
    let ns_window = handle.cast::<objc2_app_kit::NSWindow>();
    if ns_window.is_null() {
        return;
    }
    let ns_window = SendNsWindow(ns_window);
    std::thread::spawn(move || {
        let occluded_since = Arc::new(Mutex::new(None::<Instant>));
        loop {
            if stop.load(Ordering::Relaxed) {
                return;
            }
            let window = window.clone();
            let app = app.clone();
            let stop = stop.clone();
            let occluded_since = occluded_since.clone();
            let ns_window = ns_window;
            // NSWindow may only be touched on the main thread.
            let _ = app.run_on_main_thread(move || {
                if stop.load(Ordering::Relaxed) {
                    return;
                }
                // Safety: ns_window is the paint window's NSWindow; guarded by
                // the stop flag so it is never dereferenced after Destroyed.
                let visible = unsafe { (*ns_window.as_ptr()).occlusionState() }
                    .contains(objc2_app_kit::NSWindowOcclusionState::Visible);
                let now = Instant::now();
                let mut since = occluded_since.lock().unwrap();
                if !visible {
                    let start = since.unwrap_or(now);
                    *since = Some(start);
                    if now.duration_since(start) >= OCCLUDED_RELOAD_AFTER {
                        println!(
                            "[physics-paint] window occluded for 5 min — hidden reload resets the WebKit GPU connection"
                        );
                        let _ = window.eval("window.location.reload()");
                        // Restart the cycle from this reload: the fresh page's
                        // GPU connection stays under the eviction threshold.
                        *since = Some(now);
                    }
                } else {
                    *since = None;
                }
            });
            std::thread::sleep(POLL_INTERVAL);
        }
    });
}
