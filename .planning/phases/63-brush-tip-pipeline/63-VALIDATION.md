---
phase: "63"
slug: "brush-tip-pipeline"
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-15"
---

# Phase 63 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 (app + packages), cargo test (Rust) |
| **Config file** | `app/vitest.config.ts`, `packages/efx-watercolor` package config, `app/src-tauri/Cargo.toml` |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run <file>` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` + `pnpm --filter @efxlab/efx-watercolor exec vitest run` + `cargo test` in `app/src-tauri` |
| **Estimated runtime** | ~140 s (full vitest: ~108 s collect + ~35 s tests); Rust gate ~30 s |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted test file(s)
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green (measured: 9,346 passed / 1 skipped / 96 todo at wave 7)
- **Max feedback latency:** 30 s targeted, 140 s full

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 63-01.1 | 01 | 1 | TIP-02, TIP-03 | T-63-02 | Exact 36,864-byte admission before any registry write | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/brushes/deriveMask.test.ts` | ✅ | ✅ green |
| 63-01.2 | 01 | 1 | TIP-03, TIP-05 | T-63-02 | Two-branch law pinned at every boundary | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/brushes/deriveMask.test.ts` | ✅ | ✅ green |
| 63-01.3 | 01 | 1 | TIP-05, TIP-06 | T-63-09 | Reset clears entries and bumps generation | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/brushes/maskRegistry.test.ts` | ✅ | ✅ green |
| 63-02.1 | 02 | 1 | TIP-08, TIP-09 | T-63-01 | Bound-path guard: two segments, fixed root, hex stem, `.webp` only | unit + Rust | `cargo test brush_asset` (app/src-tauri) | ✅ | ✅ green |
| 63-02.2 | 02 | 1 | TIP-09 | T-63-01 | Frames MEDIA lock provably unchanged | Rust | `cargo test bound_guard` (app/src-tauri) | ✅ | ✅ green |
| 63-02.3 | 02 | 1 | TIP-10 | T-63-03 | Dimension gate before decode; per-entry batch failure reasons | unit | `pnpm --filter efx-motion-editor exec vitest run src/lib/efxPaintPackage.test.ts` | ✅ | ✅ green |
| 63-03.1 | 03 | 2 | TIP-13 | T-63-14 | Masks length-validated at module load | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/brushes/builtinTips.test.ts` | ✅ | ✅ green |
| 63-03.2 | 03 | 2 | TIP-13 | T-63-14 | Reset restores exactly the three built-ins; no project leakage | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/brushes/maskRegistry.test.ts` | ✅ | ✅ green |
| 63-04.1 | 04 | 3 | TIP-11, TIP-15 | T-63-15 | Asset refs validated through the bound-path parser; no inline bytes | unit | `pnpm --filter efx-motion-editor exec vitest run src/lib/mceFieldContract.test.ts` | ✅ | ✅ green |
| 63-04.2 | 04 | 3 | TIP-08, TIP-09, TIP-16 | T-63-12 | Save stages bytes; untouched reopen byte-identical | unit + Rust | `pnpm --filter efx-motion-editor exec vitest run src/lib/efxPaintPersistence.test.ts` | ✅ | ✅ green |
| 63-05.1 | 05 | 4 | TIP-01, TIP-04 | T-63-16 | 64 MB / 64 MP caps before read/decode | unit | `pnpm --filter efx-motion-editor exec vitest run src/lib/efxPaintBrushImport.test.ts` | ✅ | ✅ green |
| 63-05.2 | 05 | 4 | TIP-02, TIP-10 | T-63-16 | Header sniffing; named failure, never a throw | unit | `pnpm --filter @efxlab/efx-watercolor exec vitest run src/brushes/importTip.test.ts` | ✅ | ✅ green |
| 63-05.3 | 05 | 4 | TIP-04, TIP-06 | T-63-16 | Wire guards refuse malformed payloads; origin-checked fallback | unit | `pnpm --filter efx-motion-editor exec vitest run src/lib/physicPaintBridge.test.ts` | ✅ | ✅ green |
| 63-06.1 | 06 | 5 | TIP-01, TIP-13 | T-63-17 | Label rendered as text (no innerHTML), truncated at import | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | ✅ | ✅ green |
| 63-06.2 | 06 | 5 | TIP-06, TIP-10 | T-63-17 | Import control disabled in flight; caps live in the import seam | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/view/WatercolorBrushLibrary.test.ts` | ✅ | ✅ green |
| 63-06.3 | 06 | 5 | TIP-06 | T-63-18 | Every derived cache keys on mask generation; reset invalidates | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/engine/aquarelleFootprint.test.ts` | ✅ | ✅ green |
| 63-07.1 | 07 | 6 | TIP-07, TIP-17 | T-63-19 | One batch read; failures collected, never thrown | unit | `pnpm --filter efx-motion-editor exec vitest run src/lib/efxPaintBrushSet.test.ts` | ✅ | ✅ green |
| 63-07.2 | 07 | 6 | TIP-10, TIP-12 | T-63-19 | Undecodable or wrong-size asset maps to a named reason | unit + Rust | `cargo test brush_asset` (app/src-tauri) | ✅ | ✅ green |
| 63-07.3 | 07 | 6 | TIP-17 | T-63-21 | Wholesale replace on open; reset to three built-ins on close | unit | `pnpm --filter efx-motion-editor exec vitest run src/stores/aquarelleBrushCatalog.test.ts` | ✅ | ✅ green |
| 63-08.1 | 08 | 7 | TIP-14 | T-63-22 | Byte cap, canonical base64 round trip, exact 192×192 check | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts` | ✅ | ✅ green |
| 63-08.2 | 08 | 7 | TIP-14 | T-63-23 | Per-entry isolation; script masks are registry-only | unit | `pnpm --filter efx-motion-editor exec vitest run src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts` | ✅ | ✅ green |
| 63-09.1 | 09 | 2 | TIP-16 | T-63-13 | Copy re-validated through bound path + SHA-256 stem | Rust | `cargo test fresh_profile` (app/src-tauri) | ✅ | ✅ green |
| 63-09.2 | 09 | 2 | TIP-16 | T-63-24 | New project never creates an empty brushes tree | Rust | `cargo test create_project_dir` (app/src-tauri) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `app/vitest.config.ts` — existing vitest infrastructure covers the app and host package
- [x] `packages/efx-watercolor` — existing package vitest configuration
- [x] `app/src-tauri/Cargo.toml` — existing cargo test harness for the Rust legs

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Imported tip paints its own texture live and after reopen | TIP-01, TIP-07 | Visual footprint identity is a perceptual judgment the automated pins approximate (mask bytes + mapping) but cannot prove on canvas | Import a PNG/JPG from the Brush tab; confirm the Custom card previews its own texture and paints a visibly different footprint; reopen the project and confirm the same footprint |
| Degraded tip renders greyed with one aggregate warning | TIP-10 | Presence and unobtrusiveness of the aggregate UI line needs human judgment | Open a project whose brush asset was removed; confirm the card is greyed/unselectable and exactly one aggregate warning line is shown |

---

## Validation Sign-Off

- [x] All tasks have automated verification or documented manual-only rows
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none — existing infrastructure)
- [x] No watch-mode flags
- [x] Feedback latency < 140 s full suite
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-15
