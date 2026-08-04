# Stack Research

**Domain:** Tauri v2 macOS desktop app — milestone v0.9.0 feature additions (cross-window audio preview, macOS icon regeneration, Vite build hygiene, PlayScript loop clips)
**Researched:** 2026-08-03
**Confidence:** HIGH (all four research questions resolved against the existing codebase plus official docs; zero new runtime dependencies)

## Executive Summary

Milestone v0.9.0 requires **no new runtime or dev dependencies**. Every new capability maps onto infrastructure already in the repo: the `efxasset://` custom protocol (app-wide, registered on `tauri::Builder`) transports audio bytes to the second window; the existing `audioEngine.ts` Web Audio engine (already decoding every accepted import format in WKWebView via AVFoundation) plays them with the sample-accurate `AudioContext.currentTime` clock the drift-free spec requires; the `physic-paint:*` event bridge (which already carries native `physic-paint:seek-frame` sync) carries the revisioned audio context; `pnpm tauri icon` regenerates the icon set from the 794×794 source; `build.chunkSizeWarningLimit: 1100` is a one-line Vite config change; and Hold Loop Clips are pure TypeScript data-model + Canvas 2D timeline work.

The only config changes required are: (1) add `efxasset:` to the CSP `connect-src` directive so the paint window can `fetch()` audio bytes (mirrors the v0.8.1 `img-src data:` precedent); (2) add `chunkSizeWarningLimit: 1100` under `build` in `app/vite.config.ts`; (3) optionally add audio MIME entries to the Rust `efxasset` handler (cosmetic — `decodeAudioData` consumes raw bytes regardless of MIME). The fallback audio transport (grant `fs:allow-read-file` + scope to the `physics-paint` capability and reuse the `projectStore.ts:564` readFile→decode path verbatim) is documented but not recommended as the primary path.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Web Audio API (`AudioContext`, `decodeAudioData`, one-shot `AudioBufferSourceNode`) via existing `app/src/lib/audioEngine.ts` | Platform (WKWebView) | Read-only audio preview inside the EFX Paint window (Phase 2) | **No new dependency.** The main editor already decodes all accepted formats (wav/mp3/aac/m4a/flac/aif per `ImportedView.tsx:384`) through `audioEngine.decode()`, and WKWebView decodes all of them via AVFoundation (AAC/M4A most reliable; MP3 has known Promise-form rejection quirks — keep the existing tolerant wrapper; FLAC works on macOS 10.13+; OGG is not an accepted import format so WebKit's OGG gap is irrelevant). `AudioContext.currentTime` is the sample-accurate clock the spec's "audio does not drift" clause requires — HTMLAudioElement offers only float-second seek and no sample clock, so Web Audio is the only acceptable engine. The paint window loads the same app bundle (`WebviewUrl::App` + `/physics-paint` route, `lib.rs:125`), so the engine class is directly importable. |
| Existing `efxasset://` custom URI scheme protocol (`register_uri_scheme_protocol`, `app/src-tauri/src/lib.rs:383`) | Tauri 2.x (current) | Secure audio asset transport to the second window | **No new dependency, no new Rust command.** Registered on `tauri::Builder`, the handler applies app-wide to every webview (confirmed by Tauri issue #10691 — the single handler cannot even distinguish windows without `UriSchemeContext`). The `efx-physic-paint` window can already `fetch("efxasset://localhost/<path>")`; the handler sets `Access-Control-Allow-Origin: *`, supports Range requests, and exists precisely to bypass asset-scope/Unicode-path 403s. Raw bytes over fetch are MIME-agnostic for `decodeAudioData`. |
| Tauri event transport (`emit`/`emitTo`/`listen`) via the existing `physic-paint:*` bridge (`physicPaintBridge.ts`, `physicsPaintBridgeTransport.ts`) | `@tauri-apps/api` ^2.10.1 (current) | Audio preview context handoff (AUDIO-02), revisioned read-only updates (AUDIO-04), frame sync (AUDIO-03) | **No new dependency.** The `physic-paint:seek-frame` listen branch (G-01, v0.8.0) already proves native frame sync on this exact channel with regression-locked tests. The audio context is a small typed payload (`EfxPaintAudioPreviewContext` with `revision`) riding the same bridge; audio *bytes* never cross IPC — they flow over `efxasset://` — keeping events small and avoiding base64/byte-array IPC overhead. |
| `@tauri-apps/cli` `tauri icon` command | ^2.10.0 (current devDependency) | Regenerate the desktop icon set from `SPECS/efxmotioneditor-icon-2.png` (ICON-01) | **No new dependency.** Official tooling: `pnpm --dir app tauri icon <source> -o app/src-tauri/icons`. Accepts a squared PNG or SVG with transparency; no mandatory 1024×1024 source is documented, so the 794×794 source is used directly per the locked spec — the CLI scales up for the ICNS 1024px entries. Generates exactly the tracked release-authority set already declared in `bundle.icon`: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico` (plus unused `icon.png`/`Square*Logo.png`/`StoreLogo.png` that can be pruned or left untracked). |
| Vite `build.chunkSizeWarningLimit` | Vite 5.4.21 (current) | Desktop chunk budget (BUILD-01) | **Config-only change.** `build: { chunkSizeWarningLimit: 1100 }` in `app/vite.config.ts`. Units are kB against the *uncompressed* chunk size; default 500 is a web-distribution threshold that does not apply to a packaged Tauri app loading local assets. The existing `assertProductionBundle` writeBundle guard stays the correctness gate. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-fs` `readFile` | ^2.4.5 (current) | Fallback audio byte transport for the paint window | Only if `efxasset://` fetch proves problematic in the second webview. Requires adding `fs:allow-read-file` plus an `fs:scope` entry to `app/src-tauri/capabilities/physics-paint.json` — capabilities are per-window (`windows: ["efx-physic-paint"]`) and that file currently grants no fs permissions. Prefer the `efxasset` route: it mirrors how media already reaches webviews and avoids widening the paint window's filesystem surface. |
| macOS-native `sips` / `iconutil` | OS-provided | ICNS validation oracle in release preflight (`scripts/macos-release.sh`) | For release-contract validation: `sips -g all app/src-tauri/icons/icon.icns` parses the container and lists representations. Byte-level checks (magic `icns` = `0x69 0x63 0x6E 0x73`, declared big-endian length == file size, walk OSType/length entries to EOF) live in a plain node/shell test — no dependency. Expected retina-era OSTypes: ic07=128, ic08=256, ic09=512, ic10=1024, ic11=32(16@2x), ic12=64(32@2x), ic13=512(256@2x), ic14=1024. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| Vitest 2.x (current) | Regression coverage: audio context validation/revisioning, loop-clip resolution, build budget, ICNS bytes | Reuse the existing config — no new test setup (project constraint). The build-budget test asserts the resolved Vite config's `chunkSizeWarningLimit === 1100`; loop-clip tests are pure data-model tests; ICNS test reads the file bytes. |
| `cargo test` + `bash scripts/macos-release.sh preflight` | Icon contract and packaging validation | Already wired (v0.8.1 release pipeline). Extend preflight to assert the declared icon array exists/non-empty, ICNS magic/length valid, and packaged `.app` declares `CFBundleIconFile`. Must not depend on the ignored `SPECS/` path — generated tracked icons stay the release authority. |

## Installation

```bash
# No new packages. Zero additions to app/package.json dependencies or devDependencies.

# Icon regeneration (run once; commit the regenerated files under app/src-tauri/icons/):
pnpm --dir app tauri icon SPECS/efxmotioneditor-icon-2.png -o app/src-tauri/icons
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Web Audio (`audioEngine.ts`) in paint window | HTMLAudioElement (`<audio>` + `efxasset://` src — `media-src` CSP already allows it) | Never for this spec: no sample-accurate clock, coarse float-second seek, drift risk over sustained playback. Acceptable only as a last-resort diagnostic. |
| `efxasset://` fetch for audio bytes | `@tauri-apps/plugin-fs` `readFile` in paint window (mirrors `projectStore.ts:564` decode path exactly) | If CSP/protocol edge cases surface in the second webview; costs a per-window capability grant (`fs:allow-read-file` + scope). |
| `efxasset://` fetch for audio bytes | Ship audio bytes over Tauri events/IPC | Never: multi-MB base64/byte-array payloads over IPC are slow and memory-heavy. Events stay for small typed context/sync messages only. |
| `tauri icon` CLI | Hand-built ICNS via `iconutil` from a manual `.iconset` | Only if CLI output fails ICNS validation; otherwise a fragile manual pipeline for zero benefit. |
| `chunkSizeWarningLimit: 1100` | `manualChunks` splitting / fake lazy bootstrap imports | Explicitly excluded by spec (BUILD-01/BUILD-02): web-oriented splitting to satisfy a 500 kB reporter threshold is an anti-goal for a packaged desktop app. |
| `efxasset://` (custom protocol) | `convertFileSrc` (built-in `asset:` protocol) | `asset:` scope is app-level (`app.security.assetProtocol.scope`) and would work, but `efxasset://` is the project's established fix for Unicode-path 403s; running two asset protocols for the same job adds needless surface. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new audio library (howler.js, tone.js, standardized-audio-context, etc.) | Web Audio via the existing `audioEngine.ts` already decodes every accepted import format in WKWebView and provides the drift-free clock; a wrapper adds bundle weight against the 1100 kB budget with zero capability gain | `audioEngine.ts` reused in the paint window (same bundle serves both windows) |
| `build.rollupOptions.output.manualChunks` | Spec-locked exclusion; artificial splitting for a local-asset desktop app risks init-order regressions in the stores/bridge graph | `chunkSizeWarningLimit: 1100` + documented rationale |
| `logLevel: 'error'` or global warning filters to silence mixed-import warnings | Suppresses ALL build warnings, hiding real regressions; spec BUILD-02 requires correcting only provably ineffective mixed imports | Per-case fix: remove the static or the dynamic import — the warning's "statically imported by" path names the culprit; check barrel/index re-exports, which are the common hidden static path |
| Vite 6/7 or Rolldown upgrade | Out of scope; Vite 5.4.21 + motion-canvas-vite-plugin 4.0.0 interop (CJS default interop, `motion-canvas:project` input contribution, esbuild config-hook repair) is already delicately patched in `vite.config.ts` | Stay on Vite 5.4.21 |
| New Rust decode/transcode pipeline (symphonia, ffmpeg-sidecar for preview) | Massive overkill: WKWebView decodes all accepted formats natively; FFmpeg is already provisioned for export only | `decodeAudioData` in the paint window |
| XState or any state-machine library for loop-clip scheduling | Loop clips are pure data-model + canvas work: modulo indexing over `sourceFrameRefs`, half-open `[start, start+effectiveDuration)` interval resolution against next-clip/parent-end bounds | Plain TypeScript model + existing signals (matches the Phase 36.8 "no XState" decision) |
| Any UI/visualization library for the filmstrip capsule | The Roto timeline is already a custom Canvas 2D strip with semantic cell rendering | Extend the existing strip renderer with the capsule/perforated-band drawing |

## Stack Patterns by Variant

**Audio asset transport to the paint window (AUDIO-02/AUDIO-06):**
- Fetch bytes via `efxasset://localhost/<percent-encoded path>` and decode with the shared `audioEngine.decode()`.
- The app-wide CSP (`app.security.csp` in `tauri.conf.json`) currently grants `efxasset:` in `img-src` and `media-src` but NOT `connect-src`, and `fetch()` falls under `connect-src` — so add `efxasset:` to `connect-src` (one word; config change, not a dependency; mirror the v0.8.1 `img-src data:` precedent with a contract test).
- Optionally extend the Rust MIME map with audio types (`audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/flac`, `audio/aiff`) — not required for `decodeAudioData` (raw bytes), but correct for any future `<audio>` use.
- Decode failures (corrupt/missing asset) must reject into a non-blocking preview warning per AUDIO-06 — WebKit has no codec feature-detection API, so the try/catch on `decodeAudioData` IS the detection.

**Drift-free sync (AUDIO-03):**
- On paint playback start: compute audio time from the paint frame via fps and the locked frame-mapping truth table, then per audible track apply `timelineOffset`/`trimStart`/`slipOffset` and call `source.start(0, offset)`; on seek, stop all one-shot sources and restart at the new offset (the one-shot pattern `audioEngine.ts` already documents). Never chase drift by nudging `playbackRate`; re-anchor on seek. `AudioContext` needs a user gesture to leave `suspended` state — `ensureContext()` already handles lazy create/resume; the paint window's Play button is the gesture.
- Single preview authority: only the paint window's preview engine starts sources; the main editor must not also play the same tracks while monitoring is active (doubled-audio guard, AUDIO-06).

**Read-only context + revisioning (AUDIO-02/AUDIO-04):**
- Reuse existing audio track types from `audioStore` — do not duplicate the schema (spec explicitly allows the illustrative shape to collapse onto existing types). Send a revisioned context over the existing `physic-paint:*` channel; the paint side drops any context with `revision` <= last applied, matching the established Roto authority/revision guard pattern.
- Local monitoring toggle (AUDIO-05) gates source creation only — it never touches track data, mute state, or export.

**Hold Loop Clips (PLAY-04/HOLD-05):**
- Pure TypeScript: a `FrameLoopClip` record (id, startFrame, sourceFrameRefs, repeat finite/infinite, revision) resolved with modulo indexing and half-open intervals so adjacent clips meet without off-by-one overlap. Validation reuses the project's hand-rolled type-guard pattern (`isPhysicPaint*` in `types/physicPaint.ts`) — no schema library.
- Filmstrip visualization is Canvas 2D work on the existing Roto timeline strip — same renderer, new capsule/perforated-band drawing; no UI library.

**Icon (ICON-01):**
- Run `pnpm --dir app tauri icon SPECS/efxmotioneditor-icon-2.png -o app/src-tauri/icons` once; commit the regenerated tracked set; the five declared `bundle.icon` entries stay exactly as configured. Release preflight validates the generated files, never the ignored `SPECS/` source.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@tauri-apps/api` ^2.10.1 | `@tauri-apps/cli` ^2.10.0, Tauri 2.x runtime | Already pinned; no bump needed for any v0.9.0 feature |
| `tauri icon` (CLI 2.10) | `app/src-tauri/icons/` + `bundle.icon` array | Output filenames match the declared array verbatim |
| Web Audio in the paint webview | WKWebView (macOS) | All accepted import formats decodable via AVFoundation; MP3 Promise-form rejection quirk is already tolerated by the existing engine wrapper |
| Vite 5.4.21 | `@efxlab/motion-canvas-vite-plugin` 4.0.0 | `chunkSizeWarningLimit` is a top-level `build` key — no interaction with the MC plugin's contributed `rollupOptions.input` or the `fix-preact-optimize-conflict` config hooks |
| `chunkSizeWarningLimit: 1100` | `assertProductionBundle` guard | Independent: the guard validates bundle completeness, not size |

## Sources

- Tauri v2 CLI reference (https://v2.tauri.app/reference/cli/) — `tauri icon` syntax, options, input contract (MEDIUM)
- Tauri v2 icons guide (https://v2.tauri.app/develop/icons/) — generated icon set, `bundle.icon` list, source requirements (MEDIUM)
- Tauri v2 JS core API (https://v2.tauri.app/reference/javascript/api/namespacecore/) — `convertFileSrc`, asset-protocol CSP requirements (MEDIUM)
- Tauri issue #10691 + discussion #8571 (github.com/tauri-apps/tauri) — `register_uri_scheme_protocol` is Builder-level/app-wide across windows (LOW standalone; corroborated by the local Builder-level registration in `lib.rs`)
- Vite build options (https://vite.dev/config/build-options.html) — `chunkSizeWarningLimit` type/units/default (MEDIUM)
- Vite/Rollup community reports (Quasar discussion #17741, vitejs/vite#22124, shopware#11982) — mixed static/dynamic import warning semantics and per-case fixes (MEDIUM)
- WebKit feature blogs (Safari 17.4/18.4), bugnet.io decodeAudioData Safari MP3 quirk, WebKit bug 238546 — WKWebView codec support matrix (MEDIUM)
- docs.fileformat.com/image/icns + mdsteele/rust-icns — ICNS magic/length/OSType structure (MEDIUM)
- Local codebase (HIGH, direct evidence): `app/src-tauri/src/lib.rs` (efxasset handler, paint window builder), `app/src/lib/audioEngine.ts`, `app/src/stores/projectStore.ts:564` (readFile→decode path), `app/src-tauri/capabilities/default.json` + `physics-paint.json` (per-window permission gap), `app/vite.config.ts`, `app/src-tauri/tauri.conf.json` (CSP, assetProtocol scope), `app/src/lib/physicPaintBridge.ts` + `bridge/physicsPaintBridgeTransport.ts` (event channel, seek-frame sync)

---
*Stack research for: EFX-Motion Editor v0.9.0 new features*
*Researched: 2026-08-03*
