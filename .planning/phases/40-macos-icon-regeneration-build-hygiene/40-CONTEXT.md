# Phase 40: macOS Icon Regeneration + Build Hygiene - Context

**Gathered:** 2026-08-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver (a) a legible macOS release identity: regenerate the tracked Tauri icon set from the user-approved `SPECS/efxmotioneditor-icon-2.png` (794×794 alpha source, used directly) through the existing icon pipeline, keeping the generated tracked icons as release authority with the existing release-contract checks; and (b) explicit, test-pinned desktop build hygiene: `chunkSizeWarningLimit: 1100` with documented rationale, user-approved correction of only provably ineffective mixed static/dynamic imports, and production-build seam regression coverage (BUILD-03).

Requirements: ICON-01..04, BUILD-01..03 (REQUIREMENTS.md). Source spec: `SPECS/milestone-v0.9.0-plan.md` §"Phase 1 — macOS release identity and desktop build hygiene".

</domain>

<decisions>
## Implementation Decisions

### Icon replacement + verification (user-simplified scope — supersedes all deeper proposals)

- **D-01:** The 794×794 artwork is trusted input. The user owns and guarantees its visual quality and transparency; Phase 40 treats `SPECS/efxmotioneditor-icon-2.png` as valid input with no programmatic pixel validation.
- **D-02:** EXPLICITLY REMOVED from scope — no alpha-corner automation, no `pngjs`, no custom PNG decoder, no pixel-level alpha tests, no `sips` calls from Vitest, no icon-preview/contact-sheet script, no new image-processing dependency or infrastructure. Phase 40 is a straightforward artwork replacement through the existing icon pipeline; no additional icon-validation architecture.
- **D-03:** Regenerate via the existing Tauri icon tooling with the project package manager (`pnpm`) using the 794×794 source directly — no manual 1024 upscale. Keep the approved bundle entries: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`. Generated tracked files under `app/src-tauri/icons/` remain the release authority; no tracked raw source for preflight.
- **D-04:** Validation retains ONLY the existing release-contract checks: declared icon files present and non-empty, valid ICNS signature, `CFBundleIconFile` declared, bundled icon resource present. These already exist in `app/src/releaseContract.test.ts` and `scripts/macos-release.sh` — extend only if a check is missing, do not build new machinery.
- **D-05:** Phase 40 proves the packaged-.app icon metadata check NOW against the unsigned UAT build — run the release script's existing `Info.plist CFBundleIconFile` + bundled-icon-resource logic against the unsigned `.app` (reuse, don't duplicate, that logic). Phase 44 preflight re-proves it at release time.
- **D-06:** Unsigned UAT package via direct `pnpm --dir app tauri build` — zero changes to `scripts/macos-release.sh`, no signing/notarization/stapling paths touched. User performs a simple visual check of the generated packaged application (Finder, Dock, Applications, Cmd-Tab, mounted DMG).

### Mixed-import triage (BUILD-02)

- **D-07:** Baseline first: reproduce the production warning set with `pnpm --dir app build` and save the raw output under the phase directory (e.g. `.planning/phases/40-macos-icon-regeneration-build-hygiene/baseline-build-warnings.txt`) as the triage reference and before/after evidence.
- **D-08:** Approval gate: the executor presents a classified candidate list — fix / preserve (with reason) / report-as-DI — with per-case evidence (eager import proven, no cycle created, no init-timing change), and waits for user approval BEFORE editing any import.
- **D-09:** Conservative default: if "provably ineffective" cannot be fully evidenced for a warning, it stays untouched and is listed as preserved-with-reason. Spec wording applied strictly. Preserve Tauri/browser runtime guards, genuine lazy chunks, and cycle-breaking dynamic imports; no global warning suppression.
- **D-10:** Dependency-inversion cases (out of scope per spec) are written up in the phase SUMMARY with module pairs + why inversion is needed, AND captured to the project backlog as separately scoped architecture work.

### Build budget + regression seam (BUILD-01, BUILD-03)

- **D-11:** `chunkSizeWarningLimit: 1100` in `app/vite.config.ts` with a comment block directly above it as the sole documentation: packaged Tauri desktop app loading local assets, Vite's 500 kB default is a generic web threshold, 1100 is a monitored desktop entry-bundle budget, not a performance claim, must not be raised again without measurement. No separate doc file. No `manualChunks`, fake lazy bootstrap imports, or warning filters.
- **D-12:** Warning capture in `app/src/viteBuild.test.ts` via a warnings-capture Vite plugin (onLog/custom logger) inside the existing programmatic `build()` call — same pattern as the existing input-capture plugin; no subprocess, no stderr parsing.
- **D-13:** "Corrected mixed-import warnings do not return" is asserted by module-path absence: no captured warning may reference the specific corrected module paths (from the approved D-08 list). Robust to Vite wording changes; no exact message matching, no content hashes, no exact chunk counts.
- **D-14:** Resolved-limit assertion: capture the resolved `chunkSizeWarningLimit` via `configResolved` (existing capture pattern) and assert it is exactly `1100`.
- **D-15:** Intentional chunk separation pinned for Motion Canvas output (spec-named) plus efx-physic-paint IF the captured baseline shows it as a genuinely separate chunk — the researcher confirms from the baseline and the approved triage list names exactly which separations get pinned. Also retained: HTML entry exists, referenced local assets exist and are non-empty.

### Claude's Discretion

- Exact mechanics of reusing the release script's packaged-icon check against the unsigned `.app` (sourced function vs small shared check script) — reuse existing logic, don't duplicate.
- Test file organization inside the existing seams (which `describe` blocks the new assertions join).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec + requirements (locked WHAT)
- `SPECS/milestone-v0.9.0-plan.md` §"Phase 1 — macOS release identity and desktop build hygiene" — locked ICON-01..03 / BUILD-01..03 spec text, including all prohibitions
- `.planning/REQUIREMENTS.md` — ICON-01..04, BUILD-01..03 requirement statements
- `.planning/ROADMAP.md` §"Phase 40" — goal, success criteria, parallel-safe boundary (touches only icons, Vite config, build test seam, release preflight)

### Design input (gitignored — never referenced by automation)
- `SPECS/efxmotioneditor-icon-2.png` — user-approved 794×794 alpha artwork; input to Tauri icon generation only; release automation must NOT depend on this path

### Existing seams to extend (read before editing)
- `app/src/releaseContract.test.ts` — pure fs/JSON contract: exact 5-icon array, present + non-empty, ICNS magic bytes, CSP contract
- `app/src/viteBuild.test.ts` — real production-build seam (~60-90s programmatic `build()`, input-capture plugin pattern, local-refs/asset collection helpers)
- `app/vite.config.ts` — build config home for `chunkSizeWarningLimit` (note the plugin/config-hook architecture around esbuild + Motion Canvas)
- `scripts/macos-release.sh` — release preflight incl. existing packaged-.app icon check (`CFBundleIconFile` + bundled resource, added after the v0.8.0 placeholder incident T-jun-02); must remain unaltered
- `app/src-tauri/tauri.conf.json` — `bundle.icon` declares exactly the 5 tracked files
- `docs/macos-signed-release.md` — signing/notarization prep context (untouched by this phase)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/src/releaseContract.test.ts`: already asserts the exact `EXPECTED_ICONS` array, non-empty files, and `icns` magic bytes — ICON-02/ICON-03 static coverage mostly exists; verify completeness, extend only for gaps
- `app/src/viteBuild.test.ts`: existing programmatic-build seam with `createInputCapturePlugin` (`configResolved` capture), `extractLocalRefs`, `collectFiles` helpers, 300s build timeout — BUILD-03 assertions plug into this file using the same patterns
- `scripts/macos-release.sh` `run_preflight` + package-stage icon check: existing `CFBundleIconFile`/bundled-resource validation logic to reuse for the unsigned-build check (D-05)

### Established Patterns
- Contract tests in this repo are pure fs/JSON/text assertions (no build) in `releaseContract.test.ts`; build-dependent assertions live only in `viteBuild.test.ts` — keep that split
- Release config changes ship with contract-test guards (v0.8.1 CSP fix pattern: grant + contract test) — same shape for the 1100 budget
- Native visual UAT is the user's oracle; nothing is "done" until live UAT passes — icon UAT is user-performed on the packaged unsigned app

### Integration Points
- `app/vite.config.ts` `build` block: add `chunkSizeWarningLimit: 1100` + rationale comment (D-11)
- Mixed-import corrections: wherever the baseline build reports them (app/src and possibly packages/) — only after D-08 approval
- Phase 44: inherits the re-proven preflight; this phase must not alter bundle identity, signing, notarization, stapling, or Gatekeeper verification

</code_context>

<specifics>
## Specific Ideas

- User replaced the initially-proposed deeper icon verification (contact sheet, alpha automation, pngjs) with an explicit simplification directive: "Phase 40 must remain a straightforward artwork replacement through the existing icon pipeline. Do not introduce any additional icon-validation architecture." Treat this as a hard constraint.
- User-approved icon generation path: existing Tauri icon command, pnpm, 794×794 source directly.

</specifics>

<deferred>
## Deferred Ideas

- Dependency-inversion mixed-import cases (if any surface during triage) — separately scoped architecture work; goes to phase SUMMARY + project backlog per D-10
- Roto cache footprint measurement/compression — already deferred from v0.8.0 (unchanged)

</deferred>

---

*Phase: 40-macos-icon-regeneration-build-hygiene*
*Context gathered: 2026-08-04*
