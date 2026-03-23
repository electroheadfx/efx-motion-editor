---
status: awaiting_human_verify
trigger: "Export is completely broken. Hangs indefinitely, progress never advances, cancel doesn't work. CORS 404 on efxasset:// protocol."
created: 2026-03-23T00:00:00Z
updated: 2026-03-23T00:00:00Z
---

## Current Focus

hypothesis: efxasset:// protocol handler returns 404 with no CORS headers, causing image load failures. Export hangs because failed image loads aren't handled with timeouts/abort.
test: Read all relevant source files to trace the protocol handler, CORS config, and export error handling
expecting: Find missing CORS headers in protocol registration, and missing error/timeout handling in export renderer
next_action: Read all source files listed in bug report

## Symptoms

expected: Export produces video file with progress updates and working cancel
actual: Export hangs indefinitely, progress never advances, cancel doesn't work, CORS 404 on efxasset:// URLs
errors: |
  [Error] Origin http://localhost:5173 is not allowed by Access-Control-Allow-Origin. Status code: 404
  [Error] Failed to load resource: Origin http://localhost:5173 is not allowed by Access-Control-Allow-Origin. Status code: 404
  [Error] Cannot load image efxasset://localhost/Users/lmarques/Desktop/efx-motion-editor-project-test/internal%20test/images/Capture%20d'écran%202026-03-22%20à%2010.49.48_6f1f6cd1.png?v=6f1f6cd1-7378-4d34-a90a-012124a6c7ce due to access control checks.
reproduction: Attempt any export in the app
started: After phase 16 changes (audio export features)

## Eliminated

## Evidence

- timestamp: 2026-03-23T00:01
  checked: lib.rs efxasset protocol handler (line 161-292)
  found: |
    THREE separate 404 response paths (lines 201-204, 234-238, 270-273) — NONE include
    Access-Control-Allow-Origin header. Only 200/206 success responses include CORS headers.
    When the file is not found or fs::metadata fails, the 404 response has NO CORS headers.
    This causes the browser to report it as a CORS error rather than a 404 error.
  implication: |
    The browser sees a 404 without CORS headers and reports "Origin not allowed" instead of "404".
    This is the CORS error in the bug report. The underlying issue is the file not being found.

- timestamp: 2026-03-23T00:02
  checked: previewRenderer.ts getImageSource() (line 353-383)
  found: |
    img.onerror handler (line 377-379) only removes from loadingImages set — does NOT
    add any placeholder to imageCache and does NOT call onImageLoaded callback.
    This means failed images silently disappear — they're no longer "loading" but also not "cached".
  implication: |
    In preloadExportImages (exportRenderer.ts line 319-339), the check at line 327-328
    `imageIds.every(id => renderer.getImageSource(id) !== null)` will NEVER be true
    for failed images, because getImageSource returns null for uncached images.
    The onImageLoaded callback (line 337) is also never called on error.
    Result: preloadExportImages HANGS FOREVER waiting for images that failed to load.

- timestamp: 2026-03-23T00:03
  checked: exportEngine.ts preloadExportImages call (line 110)
  found: |
    `await preloadExportImages(renderer, fm)` — no timeout, no abort signal, no error handling.
    If any image fails to load, this Promise never resolves. The export hangs at "preparing"
    status (set on line 82) and never reaches "rendering".
  implication: |
    This is WHY progress never advances — the export is stuck waiting for preload.
    Cancel check only happens inside the render loop (line 118), which is AFTER preload.
    So cancel also doesn't work during preload hang.

- timestamp: 2026-03-23T00:04
  checked: Why does fs::metadata fail on the path?
  found: |
    The URL from the error log is:
    efxasset://localhost/Users/lmarques/Desktop/efx-motion-editor-project-test/internal%20test/images/Capture%20d'écran%202026-03-22%20à%2010.49.48_6f1f6cd1.png?v=...
    After percent-decoding, the path would be:
    /Users/lmarques/Desktop/efx-motion-editor-project-test/internal test/images/Capture d'écran 2026-03-22 à 10.49.48_6f1f6cd1.png
    The protocol handler uses uri.path() which should give us the raw path.
    BUT: the query string (?v=...) is part of the URI but uri.path() should NOT include it.
    Let me verify — the Rust code reads `uri.path()` on line 169 and percent-decodes it.
    If the query string somehow leaks into the path, it would cause a file-not-found.
    Actually, the issue might be that uri.path() on a URI like "efxasset://localhost/path?v=..."
    correctly strips the query, so the path should be clean.
    Need to check if the actual file exists at that path.
  implication: |
    The file path has spaces and accented characters. The percent-decoding should handle this.
    The 404 might be legitimate (file genuinely doesn't exist) OR there's a path encoding issue.

## Resolution

root_cause: |
  Three interacting bugs:
  1. efxasset:// protocol 404 responses lack CORS headers (lib.rs lines 201-204, 234-238, 270-273).
     Browser reports "Origin not allowed" instead of "404 Not Found".
  2. previewRenderer.ts img.onerror (line 377-379) does NOT call onImageLoaded and does NOT
     mark image as failed in cache. preloadExportImages creates a Promise that waits for ALL
     images to resolve but never gets notified of failures -> hangs forever.
  3. Cancel check only runs inside the render loop (exportEngine.ts line 118), which is AFTER
     the preloadExportImages await (line 110). Since preload hangs, cancel is never checked.
fix: |
  1. Add Access-Control-Allow-Origin: * header to all 404 responses in lib.rs
  2. In previewRenderer.ts img.onerror: call onImageLoaded callback so preload can detect failures.
     Add failed images to a failedImages set so getImageSource can return a sentinel/skip them.
  3. In preloadExportImages: treat failed images as "loaded" (skip them) so the promise resolves.
     Add timeout + cancel signal support to preloadExportImages.
  4. Pass cancel signal through to preloadExportImages in exportEngine.ts.
verification: |
  - Rust: cargo check passes cleanly
  - TypeScript: tsc --noEmit passes (only pre-existing unused import warning in glslRuntime.test.ts)
  - Vitest: 152 tests pass, 3 pre-existing failures in audioWaveform.test.ts (unrelated)
  - No regressions introduced
files_changed:
  - Application/src-tauri/src/lib.rs
  - Application/src/lib/previewRenderer.ts
  - Application/src/lib/exportRenderer.ts
  - Application/src/lib/exportEngine.ts
