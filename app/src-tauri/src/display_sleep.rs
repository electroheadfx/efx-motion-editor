//! macOS display-sleep guard for the physics-paint window.
//!
//! The paint window's black-window crash is a display-sleep artifact: with
//! `displaysleep 10` the display sleeps after 10 min of input idle, and the
//! WKWebView loses its composited surface on wake — the web process survives
//! (no crash report, rAF dead, window black). Holding
//! kIOPMAssertionTypeNoDisplaySleep while the paint window is open prevents
//! the sleep class entirely; it is the same mechanism `caffeinate -d` uses.

use core_foundation::base::TCFType;
use core_foundation::string::{CFString, CFStringRef};

#[link(name = "IOKit", kind = "framework")]
unsafe extern "C" {
    fn IOPMAssertionCreateWithName(
        assertion_type: CFStringRef,
        level: u32,
        name: CFStringRef,
        id: *mut u32,
    ) -> i32;
    fn IOPMAssertionRelease(id: u32) -> i32;
}

const NO_DISPLAY_SLEEP: &str = "NoDisplaySleep";
const ASSERTION_LEVEL_ON: u32 = 255;
const KIORETURN_SUCCESS: i32 = 0;

/// Holds a display-sleep-preventing IOPMAssertion while alive; dropped on
/// release.
pub struct DisplaySleepGuard {
    id: u32,
}

impl DisplaySleepGuard {
    pub fn acquire(reason: &str) -> Option<Self> {
        let assertion_type = CFString::new(NO_DISPLAY_SLEEP);
        let name = CFString::new(reason);
        let mut id: u32 = 0;
        // Safety: IOPMAssertionCreateWithName copies both CFStrings before
        // returning; the assertion id outlives the local CFString wrappers.
        let result = unsafe {
            IOPMAssertionCreateWithName(
                assertion_type.as_concrete_TypeRef(),
                ASSERTION_LEVEL_ON,
                name.as_concrete_TypeRef(),
                &mut id,
            )
        };
        (result == KIORETURN_SUCCESS).then_some(Self { id })
    }
}

impl Drop for DisplaySleepGuard {
    fn drop(&mut self) {
        // Safety: id came from a successful IOPMAssertionCreateWithName and is
        // released exactly once here.
        unsafe {
            IOPMAssertionRelease(self.id);
        }
    }
}
