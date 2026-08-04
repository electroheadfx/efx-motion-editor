# Phase 40: macOS Icon Regeneration + Build Hygiene - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-04
**Phase:** 40-macos-icon-regeneration-build-hygiene
**Areas discussed:** Icon UAT scope, Preflight split, Mixed-import triage, Warning assertions

---

## Icon UAT scope

| Option | Description | Selected |
|--------|-------------|----------|
| Packaged build now | Unsigned local .app + DMG for full native UAT (Finder/Dock/Cmd-Tab/DMG) | |
| Files only, defer to 44 | Generated-file checks now; packaged presentation deferred to Phase 44 | |
| Contact sheet + packaged | Automated downscale contact sheet + packaged build UAT | ✓ (initial) |

| Option | Description | Selected |
|--------|-------------|----------|
| Programmatic alpha check | releaseContract.test.ts decodes PNGs, asserts transparent corners | ✓ (initial) |
| Visual only | Alpha corners verified by eye only | |
| Source-only check | Check alpha on the SPECS source only | |

| Option | Description | Selected |
|--------|-------------|----------|
| sips script | macOS-only icon-preview script (iconutil + sips, HTML contact sheet) | ✓ (initial) |
| Vitest artifact | Contact sheet generated during test run | |
| Manual commands | Documented one-liners | |

| Option | Description | Selected |
|--------|-------------|----------|
| Direct tauri build | `pnpm --dir app tauri build`, release pipeline untouched | ✓ (FINAL) |
| Preview mode in release script | Extend macos-release.sh with unsigned mode | |

**User's choice (FINAL — scope override):** During Preflight split the user issued an explicit simplification directive that SUPERSEDES the first three answers above: the artwork is user-provided and user-guaranteed; treat the 794×794 PNG as valid input. REMOVED: alpha-corner automation, pngjs, custom PNG decoder, pixel-level alpha tests, sips-from-Vitest, icon-preview/contact-sheet script, all new image-processing infrastructure. KEPT: existing Tauri icon generation command, tracked generated icons as release authority, existing release-contract checks only, simple visual check of the packaged app. "Phase 40 must remain a straightforward artwork replacement through the existing icon pipeline."
**Notes:** The direct-`tauri build` answer (unsigned package, no release-script changes) stands. This override is recorded in CONTEXT.md as D-01/D-02 and quoted in Specifics as a hard constraint.

---

## Preflight split

| Option | Description | Selected |
|--------|-------------|----------|
| Check unsigned .app now | Run existing CFBundleIconFile + bundled-resource check against the unsigned Phase 40 .app during UAT | ✓ |
| Wait for Phase 44 preflight | Packaged metadata only re-proven at release | |

| Option | Description | Selected |
|--------|-------------|----------|
| pngjs devDependency | Tiny standard PNG decoder for the alpha test | (superseded) |
| Zero-dep zlib decoder | Hand-rolled node:zlib decoder in test | (superseded) |
| Shell to sips | sips conversion from the test | (superseded) |

**User's choice:** Check unsigned .app now (reusing existing release-script logic). The second question was answered with the scope-override directive above — no PNG decoding of any kind.
**Notes:** Existing coverage discovered during discussion: `releaseContract.test.ts` already asserts the exact 5-icon array, non-empty files, ICNS magic; `macos-release.sh` preflight already checks `CFBundleIconFile` + bundled resource (added after the v0.8.0 template-placeholder incident T-jun-02).

---

## Mixed-import triage

| Option | Description | Selected |
|--------|-------------|----------|
| Approve list first | Classified fix/preserve/report-DI list with per-case evidence approved before any edit | ✓ |
| Fix, review after | Executor applies spec criteria, user reviews in diff/UAT | |

| Option | Description | Selected |
|--------|-------------|----------|
| Conservative: preserve | Unproven warnings stay untouched, listed preserved-with-reason | ✓ |
| Allow judgment calls | Likely-safe fixes with risk notes | |

| Option | Description | Selected |
|--------|-------------|----------|
| SUMMARY + backlog | DI cases in phase SUMMARY + project backlog as separately scoped work | ✓ |
| SUMMARY only | No backlog entry | |

| Option | Description | Selected |
|--------|-------------|----------|
| Save raw baseline | Raw build warnings saved under the phase directory | ✓ |
| Prose summary only | RESEARCH.md summary, no raw artifact | |

**Notes:** Spec constraints carried without re-asking: preserve Tauri/browser runtime guards, genuine lazy chunks, cycle-breaking imports; no global suppression; no manualChunks/fake lazy imports/warning filters.

---

## Warning assertions

| Option | Description | Selected |
|--------|-------------|----------|
| Capture plugin | Warnings-capture Vite plugin in the existing programmatic build() (input-capture pattern) | ✓ |
| Subprocess + parse | Spawn pnpm build, parse stderr | |

| Option | Description | Selected |
|--------|-------------|----------|
| Module-path absence | Assert no warning references the corrected module paths | ✓ |
| Exact message absence | Match full warning text (fragile) | |

| Option | Description | Selected |
|--------|-------------|----------|
| MC + evidence-based | Pin Motion Canvas + efx-physic-paint if baseline-evidenced; triage list names exact separations | ✓ |
| Motion Canvas only | Pin only the spec-named separation | |

| Option | Description | Selected |
|--------|-------------|----------|
| Config comment + docs | vite.config.ts comment + release/build docs note | |
| Config comment only | Comment block above chunkSizeWarningLimit only | ✓ |

---

## Claude's Discretion

- Mechanics of reusing the release script's packaged-icon check against the unsigned .app (sourced function vs small shared check script).
- Test organization inside the existing seams (which describe blocks gain the new assertions).

## Deferred Ideas

- Dependency-inversion mixed-import cases (if any surface) — phase SUMMARY + project backlog, separately scoped (per D-10).
