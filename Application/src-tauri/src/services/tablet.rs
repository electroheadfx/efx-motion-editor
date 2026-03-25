//! Native macOS tablet pressure bridge.
//!
//! WebKit (WKWebView) does not report real pen pressure via PointerEvent.pressure
//! on macOS — it always returns 0.5. This module installs an NSEvent local monitor
//! that captures native tablet pressure/tilt and emits it to the frontend via Tauri events.
//!
//! On modern macOS, tablet data is carried on mouse events (LeftMouseDown, LeftMouseDragged,
//! LeftMouseUp) with subtype == NSEventSubtypeTabletPoint (1). Standalone NSEventTypeTabletPoint
//! events (type 23) are rarely generated.

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
pub struct TabletPressureEvent {
    pub pressure: f64,
    pub tilt_x: f64,
    pub tilt_y: f64,
}

/// Install a local NSEvent monitor for tablet point events.
/// Emits `tablet:pressure` events to the frontend whenever the pen reports data.
pub fn install_tablet_monitor(app_handle: AppHandle) {
    use std::sync::Arc;

    let handle = Arc::new(app_handle);

    let main_queue = dispatch::Queue::main();
    main_queue.exec_async(move || {
        use std::panic::AssertUnwindSafe;
        use std::ptr::NonNull;

        use block2::RcBlock;
        use objc2::exception::catch as objc_catch;
        use objc2_app_kit::{NSEvent, NSEventMask};

        // Monitor mouse events that carry tablet data + standalone tablet events:
        // LeftMouseDown (1), LeftMouseUp (2), LeftMouseDragged (6), TabletPoint (23)
        let mask: u64 = (1 << 1)   // NSEventTypeLeftMouseDown
                      | (1 << 2)   // NSEventTypeLeftMouseUp
                      | (1 << 6)   // NSEventTypeLeftMouseDragged
                      | (1 << 23); // NSEventTypeTabletPoint

        let block = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
            let _ = unsafe {
                objc_catch(AssertUnwindSafe(|| {
                    let event_ref: &NSEvent = event.as_ref();

                    // subtype 1 = NSEventSubtypeTabletPoint (has pressure/tilt)
                    let subtype = event_ref.subtype().0;
                    if subtype == 1 {
                        let pressure = event_ref.pressure() as f64;
                        let tilt = event_ref.tilt();

                        let _ = handle.emit(
                            "tablet:pressure",
                            TabletPressureEvent {
                                pressure,
                                tilt_x: tilt.x,
                                tilt_y: tilt.y,
                            },
                        );
                    }
                }))
            };

            event.as_ptr()
        });

        unsafe {
            let mask_val = NSEventMask(mask);
            let _monitor =
                NSEvent::addLocalMonitorForEventsMatchingMask_handler(mask_val, &block);
            std::mem::forget(_monitor);
        }
    });
}
