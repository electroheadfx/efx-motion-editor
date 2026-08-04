# Phase 40: macOS Icon Regeneration + Build Hygiene - Research

**Researched:** 2026-08-04
**Domain:** Tauri v2 icon tooling / Vite 5 production build policy / Vitest build-test seam
**Confidence:** HIGH (all load-bearing claims verified empirically this session against the repo's real toolchain)

## Summary

Phase 40 is two well-bounded workstreams against seams that already exist. The icon workstream is a straight artwork swap: the project's installed Tauri CLI (`tauri icon`) accepts the 794×794 RGBA source directly — verified this session by running it into a scratch dir — and produces a valid ICNS (correct `icns` magic, representations from 16px through 1024px). The only real hazard is that `tauri icon` emits ~50 files (Appx Square logos, StoreLogo, iOS, Android, `64x64.png`, `icon.png`) while the repo tracks exactly 5; the plan must prune the extras so `bundle.icon`'s exact-array contract stays true. The build-hygiene workstream plugs into the existing programmatic-build seam in `app/src/viteBuild.test.ts`: warning capture via a `createLogger()` wrap was verified end-to-end this session (all 13 baseline warnings captured with full module-path text), and `configResolved` on an `enforce: 'post'` plugin captures the resolved `chunkSizeWarningLimit` (currently the 500 default). The baseline build shows the entry chunk at 969.22 kB — so 1100 silences exactly one chunk-size warning today while remaining a real budget. The mixed-import triage inventory is fully enumerated below (12 warnings); classification into fix/preserve/report-as-DI is deliberately left to the executor's D-08 approval gate.

**Primary recommendation:** Regenerate icons with `pnpm --dir app tauri icon ../SPECS/efxmotioneditor-icon-2.png` (run from `app/`) into a staging dir, copy only the 5 declared files into `app/src-tauri/icons/`; add `chunkSizeWarningLimit: 1100` + rationale comment to the existing `build` block in `app/vite.config.ts`; extend `viteBuild.test.ts` with a warnings-capture customLogger and module-path-absence assertions; run the mixed-import triage strictly behind the D-08 approval gate.

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD install from `.claude/gsd-core`.
- **Do not run the dev server** — the user runs it on their side.
- Tests: `vitest run` only; **never** Vitest watch mode.
- Monorepo uses **pnpm** (not npm); the app lives in `app/`.
- Preact-native patterns: prefer Signals over unnecessary hooks; no React workarounds. (Low relevance here — this phase touches no component state, but mixed-import corrections must not introduce hook/effect churn.)
- Git index lock recovery protocol applies if `.git/index.lock` blocks a command.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Icon replacement + verification (user-simplified scope — supersedes all deeper proposals)**

- **D-01:** The 794×794 artwork is trusted input. The user owns and guarantees its visual quality and transparency; Phase 40 treats `SPECS/efxmotioneditor-icon-2.png` as valid input with no programmatic pixel validation.
- **D-02:** EXPLICITLY REMOVED from scope — no alpha-corner automation, no `pngjs`, no custom PNG decoder, no pixel-level alpha tests, no `sips` calls from Vitest, no icon-preview/contact-sheet script, no new image-processing dependency or infrastructure. Phase 40 is a straightforward artwork replacement through the existing icon pipeline; no additional icon-validation architecture.
- **D-03:** Regenerate via the existing Tauri icon tooling with the project package manager (`pnpm`) using the 794×794 source directly — no manual 1024 upscale. Keep the approved bundle entries: `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`. Generated tracked files under `app/src-tauri/icons/` remain the release authority; no tracked raw source for preflight.
- **D-04:** Validation retains ONLY the existing release-contract checks: declared icon files present and non-empty, valid ICNS signature, `CFBundleIconFile` declared, bundled icon resource present. These already exist in `app/src/releaseContract.test.ts` and `scripts/macos-release.sh` — extend only if a check is missing, do not build new machinery.
- **D-05:** Phase 40 proves the packaged-.app icon metadata check NOW against the unsigned UAT build — run the release script's existing `Info.plist CFBundleIconFile` + bundled-icon-resource logic against the unsigned `.app` (reuse, don't duplicate, that logic). Phase 44 preflight re-proves it at release time.
- **D-06:** Unsigned UAT package via direct `pnpm --dir app tauri build` — zero changes to `scripts/macos-release.sh`, no signing/notarization/stapling paths touched. User performs a simple visual check of the generated packaged application (Finder, Dock, Applications, Cmd-Tab, mounted DMG).

**Mixed-import triage (BUILD-02)**

- **D-07:** Baseline first: reproduce the production warning set with `pnpm --dir app build` and save the raw output under the phase directory (e.g. `.planning/phases/40-macos-icon-regeneration-build-hygiene/baseline-build-warnings.txt`) as the triage reference and before/after evidence.
- **D-08:** Approval gate: the executor presents a classified candidate list — fix / preserve (with reason) / report-as-DI — with per-case evidence (eager import proven, no cycle created, no init-timing change), and waits for user approval BEFORE editing any import.
- **D-09:** Conservative default: if "provably ineffective" cannot be fully evidenced for a warning, it stays untouched and is listed as preserved-with-reason. Spec wording applied strictly. Preserve Tauri/browser runtime guards, genuine lazy chunks, and cycle-breaking dynamic imports; no global warning suppression.
- **D-10:** Dependency-inversion cases (out of scope per spec) are written up in the phase SUMMARY with module pairs + why inversion is needed, AND captured to the project backlog as separately scoped architecture work.

**Build budget + regression seam (BUILD-01, BUILD-03)**

- **D-11:** `chunkSizeWarningLimit: 1100` in `app/vite.config.ts` with a comment block directly above it as the sole documentation: packaged Tauri desktop app loading local assets, Vite's 500 kB default is a generic web threshold, 1100 is a monitored desktop entry-bundle budget, not a performance claim, must not be raised again without measurement. No separate doc file. No `manualChunks`, fake lazy bootstrap imports, or warning filters.
- **D-12:** Warning capture in `app/src/viteBuild.test.ts` via a warnings-capture Vite plugin (onLog/custom logger) inside the existing programmatic `build()` call — same pattern as the existing input-capture plugin; no subprocess, no stderr parsing.
- **D-13:** "Corrected mixed-import warnings do not return" is asserted by module-path absence: no captured warning may reference the specific corrected module paths (from the approved D-08 list). Robust to Vite wording changes; no exact message matching, no content hashes, no exact chunk counts.
- **D-14:** Resolved-limit assertion: capture the resolved `chunkSizeWarningLimit` via `configResolved` (existing capture pattern) and assert it is exactly `1100`.
- **D-15:** Intentional chunk separation pinned for Motion Canvas output (spec-named) plus efx-physic-paint IF the captured baseline shows it as a genuinely separate chunk — the researcher confirms from the baseline and the approved triage list names exactly which separations get pinned. Also retained: HTML entry exists, referenced local assets exist and are non-empty.

### Claude's Discretion

- Exact mechanics of reusing the release script's packaged-icon check against the unsigned `.app` (sourced function vs small shared check script) — reuse existing logic, don't duplicate.
- Test file organization inside the existing seams (which `describe` blocks the new assertions join).

### Deferred Ideas (OUT OF SCOPE)

- Dependency-inversion mixed-import cases (if any surface during triage) — separately scoped architecture work; goes to phase SUMMARY + project backlog per D-10
- Roto cache footprint measurement/compression — already deferred from v0.8.0 (unchanged)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ICON-01 | Replace macOS icon using `SPECS/efxmotioneditor-icon-2.png` (794×794 used directly) | `tauri icon` verified to accept the 794×794 source (probe ran clean, zero upscale needed); ICNS output contains 16→1024px representations |
| ICON-02 | Tracked icon set under `app/src-tauri/icons/` stays release authority; no SPECS-path dependency | Existing `releaseContract.test.ts` asserts the exact 5-file array + non-empty + ICNS magic against tracked files only; prune-generation-extras step required (verified file list below) |
| ICON-03 | Release-contract validation: icons exist/non-empty, ICNS signature, packaged `.app` icon resource — no signing/notarization changes | Static coverage already exists verbatim in `releaseContract.test.ts:63-72`; packaged check exists in `macos-release.sh:309-323` and was verified readable against the current packaged app; D-05 reuse mechanics documented below |
| ICON-04 | Legible at 16×16→512×512 in Finder/Dock/Applications/Cmd-Tab/DMG | ICNS probe shows `ic07`(128), `ic08`(256), `ic09`(512), `ic10`(1024), `ic11`(32), `ic12`(64), `ic13`, `ic14`, legacy `is32`/`il32`+masks — all macOS display sizes covered; legibility itself is user UAT (D-06) |
| BUILD-01 | `chunkSizeWarningLimit: 1100` + documented rationale | `app/vite.config.ts:180-187` `build` block verified to have no such key — add there; Vite docs confirm the option (kB, uncompressed size, default 500); baseline entry chunk 969.22 kB < 1100 |
| BUILD-02 | Correct only provably ineffective mixed imports | Full 12-warning baseline inventory with dynamic/static import sites enumerated below; dynamic-import call sites inspected (line numbers below); D-08 gate governs all edits |
| BUILD-03 | Build seam verifies 1100 limit, HTML entry, assets, MC output, chunk separation, non-return of corrected warnings | `customLogger` capture and `configResolved` limit capture both verified working this session inside the exact programmatic `build()` the test uses; chunk-separation targets resolved per D-15 below |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Icon source → platform icon set generation | Build tooling (Tauri CLI) | — | `tauri icon` owns resampling/ICNS/ICO encoding; never hand-rolled (D-02) |
| Icon release-authority validation | Test seam (Vitest contract test) | Release script preflight | `releaseContract.test.ts` is pure fs/JSON; script preflight re-proves at release |
| Packaged `.app` icon metadata proof | Release-script logic (reused) | Phase UAT step | Logic already lives in `macos-release.sh`; phase proves it against unsigned build |
| Chunk budget policy | Vite config (`app/vite.config.ts`) | Build test seam | Single config key + comment; test asserts resolved value |
| Mixed-import correction | App source (`app/src`, possibly `packages/`) | — | Source-level edits only, behind D-08 approval |
| Warning regression coverage | Build test seam (`app/src/viteBuild.test.ts`) | — | customLogger capture inside existing programmatic `build()` |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/cli` | ^2.10.0 (installed; resolved API deps show 2.10.1) [VERIFIED: app/package.json:42] | `tauri icon` generation, `tauri build` packaging | Project's existing icon pipeline per D-03 |
| `vite` | 5.4.21 [VERIFIED: baseline build banner] | Production build, `chunkSizeWarningLimit`, `customLogger` | Existing build tool |
| `vitest` | (project-pinned, run via `pnpm --dir app exec vitest run`) | Contract + build seam tests | Existing test framework; CLAUDE.md mandates `vitest run`, never watch |

### Supporting
No supporting libraries. D-02 explicitly forbids new image-processing dependencies (`pngjs`, custom decoders).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tauri icon` CLI | `sips`/`iconutil`/`png2icns` manual pipeline | Hand-rolled resampling + ICNS encoding; explicitly removed from scope by D-02; more failure surface |
| `customLogger` warning capture | Vite plugin `onLog` hook | `onLog` plugin hook availability/behavior in Vite 5.4 not verified; customLogger verified working this session — use it |
| `customLogger` warning capture | Subprocess + stderr parsing | Explicitly prohibited by D-12 |

**Installation:** None. This phase installs zero new packages.

**Version verification:** No new packages to verify. Existing tool versions confirmed by execution this session: `pnpm tauri icon --help` (CLI 2.10.x), `vite v5.4.21` (build banner), node v24.15.0, pnpm 10.27.0.

## Package Legitimacy Audit

**No external packages are installed in this phase.** D-02 forbids new image-processing dependencies; the icon pipeline is the already-installed `@tauri-apps/cli`; warning capture uses Vite's built-in `createLogger`. The Package Legitimacy Gate has nothing to check.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
ICON WORKSTREAM
  SPECS/efxmotioneditor-icon-2.png (794×794 RGBA, gitignored — design input only)
      │  pnpm --dir app tauri icon ../SPECS/efxmotioneditor-icon-2.png -o <staging>
      ▼
  staging dir (full platform set: 5 declared + ~45 extras)
      │  copy ONLY the 5 declared files; discard extras
      ▼
  app/src-tauri/icons/  (tracked release authority: 32x32, 128x128, 128x128@2x, icon.icns, icon.ico)
      ├─► releaseContract.test.ts  (static: exact array, non-empty, icns magic)
      └─► pnpm --dir app tauri build (unsigned UAT package)
              ▼
          target/release/bundle/macos/EFX Motion Editor.app
              ├─► D-05 check: reused CFBundleIconFile + bundled-icon logic from macos-release.sh
              └─► User visual UAT: Finder / Dock / Applications / Cmd-Tab / DMG

BUILD HYGIENE WORKSTREAM
  pnpm --dir app build  ──► baseline warning set (12 mixed-import + 1 chunk-size)
      │                        saved to phase dir per D-07
      ▼
  D-08 triage: fix / preserve-with-reason / report-as-DI  ──(user approval gate)──► import edits
      ▼
  app/vite.config.ts  build block += chunkSizeWarningLimit: 1100 (+ rationale comment)
      ▼
  app/src/viteBuild.test.ts  (existing programmatic build())
      ├─ customLogger capture ──► assert corrected module paths absent from warnings (D-13)
      ├─ configResolved capture ──► assert resolved limit === 1100 (D-14)
      ├─ existing assertions ──► HTML entry, local assets non-empty, project-*.js present
      └─ new separation pins ──► src/project-*.js AND PhysicsPaintStudio-*.js remain separate (D-15)
```

### Recommended Project Structure

No new structure. All work lands in existing files:

```
app/
├── vite.config.ts                 # add chunkSizeWarningLimit: 1100 + comment (D-11)
├── src/
│   ├── releaseContract.test.ts    # icon static contract — verify completeness, extend only for gaps (D-04)
│   ├── viteBuild.test.ts          # add warning capture + limit + separation assertions (D-12..15)
│   └── <triage-approved import edits only>   (D-08/D-09)
└── src-tauri/icons/               # 5 regenerated files only
.planning/phases/40-macos-icon-regeneration-build-hygiene/
└── baseline-build-warnings.txt    # D-07 evidence (executor reproduces)
```

### Pattern 1: Warning capture via customLogger (VERIFIED this session)
**What:** Intercept Vite's logger inside the existing programmatic `build()` to capture every warning's full text.
**When to use:** D-12/D-13 assertions.
**Verified behavior:** 13/13 baseline warnings captured; mixed-import messages contain full module paths (so module-path-absence assertions per D-13 work); message text is prefixed by a `[plugin:vite:reporter]` line — assert with `.includes(path)`, never with exact-match or line-0 assumptions.
**Example:**
```typescript
// Source: verified empirically this session (probe build against app/vite.config.ts, Vite 5.4.21);
// API documented at https://vite.dev/config/shared-options.html#customlogger
import { build, createLogger } from 'vite';

const warnings: string[] = [];
const logger = createLogger();
const origWarn = logger.warn;
logger.warn = (msg, options) => {
  warnings.push(String(msg));   // capture everything; do NOT filter here
  origWarn(msg, options);       // or drop delegation to keep test output clean
};

await build({
  root: APP_DIR,
  configFile: join(APP_DIR, 'vite.config.ts'),
  customLogger: logger,                  // replaces logLevel: 'silent' in the existing call
  plugins: [createInputCapturePlugin(captured)],
  build: { outDir, emptyOutDir: true },
});
```
Note: the existing seam passes `logLevel: 'silent'`; `customLogger` replaces it (a custom logger ignores logLevel gating for captured messages — the wrap sees all `warn` calls).

### Pattern 2: Resolved-limit capture (VERIFIED this session)
**What:** Extend the existing input-capture plugin to also record `config.build.chunkSizeWarningLimit`.
**Example:**
```typescript
// Source: extends app/src/viteBuild.test.ts:52-60 pattern; verified via probe (returned 500 default pre-change)
function createInputCapturePlugin(captured: { input: unknown; chunkLimit?: number }): Plugin {
  return {
    name: 'test-capture-rollup-input',
    enforce: 'post',
    configResolved(config) {
      captured.input = config.build.rollupOptions.input;
      captured.chunkLimit = config.build.chunkSizeWarningLimit;  // D-14: assert === 1100
    },
  };
}
```

### Pattern 3: Icon generation with extras pruning (VERIFIED this session)
**What:** Generate into a staging dir, copy only the 5 declared files into `app/src-tauri/icons/`.
**Why staging:** `tauri icon` verified to emit, besides the 5 declared files: `64x64.png`, `icon.png`, `StoreLogo.png`, 10 `Square*Logo.png`, `ios/` (18 AppIcon files), `android/` (15 mipmap files). The repo's tracked icons dir currently contains exactly the 5 declared files, and `releaseContract.test.ts` + `tauri.conf.json` pin that exact set — extras must not be committed.
**Example:**
```bash
# Source: verified this session against @tauri-apps/cli 2.10.x
cd app && pnpm tauri icon ../SPECS/efxmotioneditor-icon-2.png -o /tmp/efx-icons-staging
cp /tmp/efx-icons-staging/{32x32.png,128x128.png,128x128@2x.png,icon.icns,icon.ico} src-tauri/icons/
```
(Equivalently: run without `-o` — default output is the `icons/` dir next to `tauri.conf.json` [VERIFIED: `pnpm tauri icon --help`] — then delete everything except the 5 declared files. Staging is cleaner: zero risk of deleting a tracked file by mistake or leaving an untracked extra.)

### Pattern 4: D-05 packaged-icon check reuse
**What:** Prove the packaged `.app` icon metadata against the unsigned UAT build by reusing the release script's logic.
**Constraint discovered (verified by reading the script):**
- The icon check lives inside `verify_app()` at `scripts/macos-release.sh:309-323`, which also runs `codesign --verify`, `spctl --assess`, and `xcrun stapler validate` (lines 294-328) — so `verify_app` as a whole cannot run against an unsigned `.app`.
- The script ends with an unconditional `main "$@"` — sourcing the whole file executes the CLI. There is no source guard.
- The block uses `local` (must run inside a function) and depends on `$PLUTIL` (`/usr/bin/plutil`, defined line 21) and `die` (lines 32-35).
**Recommended mechanic (Claude's-discretion area):** a small phase check script that extracts the exact icon-check lines from `macos-release.sh` at check time (e.g. `sed -n '/Info.plist metadata: the packaged app/,/icns magic bytes/p'`) and evaluates them inside a function with `PLUTIL=/usr/bin/plutil` and a local `die` defined — the logic literally comes from the release script (reuse, not duplication), and `macos-release.sh` itself stays byte-identical per D-06. The existing releaseContract tests' grep-based pins on the script keep the extracted range stable.
**Verified against current packaged app:** `plutil -extract CFBundleIconFile raw -o - ".../EFX Motion Editor.app/Contents/Info.plist"` returns `icon.icns`, and `Contents/Resources/icon.icns` exists non-empty. The unsigned UAT bundle path is `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` [VERIFIED: directory listing this session].

### Anti-Patterns to Avoid
- **Tracking the full `tauri icon` output:** would break the exact-5-icon contract and pollute the repo with Windows/iOS/Android assets. Copy or keep only the declared 5.
- **Sourcing `scripts/macos-release.sh`:** executes `main "$@"` (no source guard). Extract the needed lines instead.
- **Running the whole `verify_app` on the unsigned app:** codesign/spctl/stapler steps fail by design on unsigned bundles; only the Info.plist/bundled-icon portion is in scope.
- **Exact warning-message matching:** Vite/Rollup wording changes between versions; D-13 mandates module-path absence only.
- **Content-hash or exact-chunk-count assertions:** explicitly prohibited (BUILD-03); chunk filenames carry content hashes (`index-DiQjlua3.js`) — match by stable prefix (`src/project-`, `PhysicsPaintStudio-`).
- **`manualChunks` / fake lazy imports / warning filters:** prohibited by spec and D-11.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG resizing to 6+ sizes | sips/sharp/pngjs pipeline | `tauri icon` (D-03) | D-02 forbids new image infra; CLI verified to handle 794×794 directly |
| ICNS/ICO container encoding | Custom encoder | `tauri icon` | ICNS verified: `icns` magic + ic07–ic14 + legacy mask entries |
| Bundle completeness check | New validation script | Existing `assertProductionBundle` in `vite.config.ts` (exported, tested) | Already the correctness gate per spec |
| Build warning capture | Subprocess + stderr parsing | `customLogger` wrap (verified) | D-12 prohibits subprocess/stderr; logger capture verified 13/13 |
| Icon contract validation | New machinery | Existing `releaseContract.test.ts` icons test | D-04: extend only for gaps |

**Key insight:** Every mechanism this phase needs already exists in-repo or in the installed toolchain. The phase's entire risk surface is (a) pruning generated extras, (b) triage discipline on the 12 mixed-import warnings, (c) keeping assertions prefix-based.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified: icons are build inputs, not stored data; no datastore keys reference icon paths | none |
| Live service config | None — verified: no external service holds app icon config; GitHub release assets for v0.9.0 are produced later (Phase 44) from the packaged bundle | none |
| OS-registered state | macOS LaunchServices icon caches may show the OLD icon after replacement (user-visible in Finder/Dock until cache refresh) | Note in UAT step: user may need to log out/in or `touch` the .app if Finder shows a stale cached icon; not a code task |
| Secrets/env vars | None — verified: icon and Vite config changes touch no secret or env var | none |
| Build artifacts | `app/dist/` (stale bundle with old asset hashes — regenerated by build); `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` + `dmg/` (packaged with OLD icon, dated 2026-08-01) [VERIFIED: directory listing] | Regenerated by the D-06 unsigned `pnpm --dir app tauri build`; no manual cleanup required (Tauri overwrites), but UAT must run against the freshly built bundle, not the stale one |

## Common Pitfalls

### Pitfall 1: Committing `tauri icon` extras
**What goes wrong:** Running `tauri icon` with default output drops ~45 extra files (Square logos, StoreLogo, `64x64.png`, `icon.png`, `ios/`, `android/`) into `app/src-tauri/icons/`.
**Why it happens:** The CLI generates "various icons for all major platforms" [CITED: https://v2.tauri.app/reference/cli/#icon]; verified empirically this session.
**How to avoid:** Generate into a staging dir with `-o`, copy only the 5 declared files (Pattern 3). Verify with `git status app/src-tauri/icons/` showing exactly 5 modified, 0 untracked.
**Warning signs:** `releaseContract.test.ts` still passes (it only checks the declared 5) — so the guard is the git-status check, not the test.

### Pitfall 2: `logLevel: 'silent'` silently swallowing the capture
**What goes wrong:** Adding a capture plugin but leaving `logLevel: 'silent'` and expecting warnings via a plugin hook.
**Why it happens:** The existing seam uses `logLevel: 'silent'`; silent mode does not prevent a `customLogger` wrap from seeing `warn` calls, but plugin-based observation of the reporter is unreliable in 5.4.
**How to avoid:** Use the verified `customLogger` wrap (Pattern 1); keep or drop delegation as preferred for output noise.

### Pitfall 3: Converting a cycle-breaking dynamic import
**What goes wrong:** "Fixing" `paintStore.ts → timelineStore.ts` / `layerStore.ts` dynamic imports (lines 478-479, 545-546) introduces a module-init cycle.
**Why it happens:** Store modules cross-reference each other; dynamic import is a deliberate cycle-breaker.
**How to avoid:** D-09 conservative default + per-case evidence at the D-08 gate. Store-to-store dynamic imports are presumed cycle-breaking until proven otherwise.

### Pitfall 4: Asserting chunk filenames with hashes
**What goes wrong:** Test pins `index-DiQjlua3.js`; any content change renames it.
**How to avoid:** Prefix matching only: `/src\/project-[^/]*\.js$/` (existing pattern at `viteBuild.test.ts:123`) and `/PhysicsPaintStudio-[^/]*\.js$/`.

### Pitfall 5: 1100 becoming a silent ratchet
**What goes wrong:** Future chunk growth past 1100 gets "fixed" by raising the limit again.
**How to avoid:** D-11 comment block must state "monitored budget, not a performance claim, must not be raised again without measurement" — the comment is the sole documentation, so its wording is a verification target. Current headroom: entry chunk 969.22 kB (130 kB under).

### Pitfall 6: UAT against the stale packaged app
**What goes wrong:** User checks the icon on the 2026-08-01 bundle still in `target/release/bundle/`.
**How to avoid:** UAT step must follow the fresh D-06 `pnpm --dir app tauri build`; check bundle mtime before UAT.

## Code Examples

### Baseline chunk inventory (VERIFIED this session, `pnpm --dir app build`, Vite 5.4.21)
```
dist/index.html                         0.76 kB
dist/PhysicsPaintStudio-DEX2lnh9.css   44.54 kB
dist/index-Dgsx0_Gh.css                46.68 kB
dist/strokeAnimation-zGawlrLy.js        0.58 kB
dist/index-B2jC0LUy.js                  2.35 kB
dist/_commonjsHelpers-BEKB6BXw.js      22.89 kB
dist/src/project-Che8Jrrs.js          148.02 kB   ← Motion Canvas project bundle (spec-named separation)
dist/PhysicsPaintStudio-Ovc7TYVA.js   362.86 kB   ← genuine lazy chunk (main.tsx:19 dynamic import)
dist/index-DiQjlua3.js                969.22 kB   ← entry chunk; only chunk-size warning; < 1100 ✓
```
**D-15 resolution (researcher confirmation):** efx-physic-paint engine code (probe: `renderFromStrokes`) is present ONLY in `PhysicsPaintStudio-*.js` [VERIFIED: grep over dist chunks this session] — it is not a standalone chunk; it rides the intentional Studio lazy chunk. **Pin exactly two separations:** `src/project-*.js` (Motion Canvas, spec-named; already asserted by the existing test) and `PhysicsPaintStudio-*.js` (new assertion). Both are verified genuinely separate in the baseline.

### Mixed-import baseline inventory — 12 warnings (VERIFIED this session; full raw output at `/tmp/efx-phase40-baseline-build.txt`, executor re-captures per D-07)

| # | Module (warning subject) | Dynamically imported by | Statically imported by (excerpt) | Researcher's initial read (D-08 gate decides) |
|---|--------------------------|-------------------------|-----------------------------------|------------------------------------------------|
| 1 | `@tauri-apps/api/core.js` | usePhysicsPaintParentBridge.ts, ShaderBrowser.tsx, SidebarFxProperties.tsx, physicPaintBridge.ts (×2) | lib/ipc.ts + all tauri plugin entry points | Likely PRESERVE — Tauri/browser runtime guard pattern in physic-paint bridge (spec-named preserve); plugin statics make it eager anyway |
| 2 | `@tauri-apps/api/event.js` | physicsPaintBridgeTransport.ts (×5), physicsPaintSessionFile.ts, usePhysicsPaintParentBridge.ts (×6), usePhysicsPaintEngineLifecycle.ts, physicPaintBridge.ts (×9) | PaintOverlay.tsx, main.tsx, tauri internals | Likely PRESERVE — bridge runtime guards |
| 3 | `@tauri-apps/api/window.js` | PhysicsPaintStudio.tsx, usePhysicsPaintParentBridge.ts, physicPaintBridge.ts | exportEngine.ts, main.tsx | Likely PRESERVE — runtime guard |
| 4 | `@tauri-apps/plugin-dialog` | physicPaintBridge.ts | ExportPreview, Toolbar, NewProjectDialog, WelcomeScreen, AudioProperties, ImportedView, shortcuts, unsavedGuard | Likely PRESERVE — runtime guard (bridge runs in non-Tauri context) |
| 5 | `app/src/lib/appConfig.ts` | stores/uiStore.ts:180 | LeftPanel, WelcomeScreen, CollapseHandle, themeManager, isolationStore, projectStore | CANDIDATE FIX — `await import('../lib/appConfig')` inside uiStore; executor must prove no uiStore↔appConfig cycle and no init-timing change |
| 6 | `app/src/stores/timelineStore.ts` | stores/paintStore.ts:478-479, 545-546 | ~30 modules incl. main.tsx, projectStore | Likely PRESERVE — store-to-store dynamic import, presumed cycle-breaker (D-09) |
| 7 | `app/src/stores/layerStore.ts` | stores/paintStore.ts:478-479, 545-546 | ~25 modules | Likely PRESERVE — same as #6 |
| 8 | `@tauri-apps/plugin-fs` | physicPaintBridge.ts | AudioProperties, ImportedView, assetRemoval, paintPersistence, physicPaintPersistence, projectStore | Likely PRESERVE — runtime guard |
| 9 | `app/src/lib/unsavedGuard.ts` | main.tsx:84 | Toolbar.tsx, shortcuts.ts | CANDIDATE FIX — main.tsx statically reaches shortcuts.ts; dynamic import inside event handler is provably ineffective IF executor proves main.tsx's static graph already pulls unsavedGuard before the handler can fire |
| 10 | `app/src/lib/themeManager.ts` | main.tsx:25 (`initTheme`) | ThemeSwitcher, TimelineCanvas, shortcuts | CANDIDATE FIX — but init-timing evidence is critical: the dynamic import may deliberately defer theme init; executor must prove the static importers are already in main's eager graph at that point |
| 11 | `app/src/lib/physicPaintBridge.ts` | stores/projectStore.ts:61 | bridge transport/session/parent files, PhysicPaintProperties, main.tsx | Likely PRESERVE or report-as-DI — projectStore→bridge dynamic import smells like a store/bridge cycle-breaker; if fixing requires dependency inversion, report per D-10 |
| 12 | `app/src/lib/paintPreferences.ts` | stores/paintStore.ts:106, 535, 541 | PhysicsPaintRightPanel, InlineColorPicker | CANDIDATE FIX — dynamic imports in paintStore action handlers; executor must prove eager reachability + no cycle (paintStore ↔ components import graph) |

Triage rules reminder: "initial read" column is research guidance only — D-08 requires the executor to present per-case evidence and wait for user approval before any edit; D-09 makes preserve the default when evidence is incomplete.

### Icon ICNS verification (VERIFIED this session on probe output)
```
$ head -c 4 icon.icns → "icns"            # passes releaseContract.test.ts:71
Representations: ic10 (1024×1024, sips reports pixelWidth 1024), ic09 (512), ic14, ic08 (256),
ic13, ic07 (128), ic12 (64), ic11 (32), is32/il32 + s8mk/l8mk legacy masks
→ covers every macOS display size ICON-04 lists (16 via is32/il32 legacy + scaled ic11/ic12)
```

### Existing contract pins (VERIFIED — read this session; quote verbatim)
`app/src/releaseContract.test.ts:15-21`:
```typescript
const EXPECTED_ICONS = [
  'icons/32x32.png',
  'icons/128x128.png',
  'icons/128x128@2x.png',
  'icons/icon.icns',
  'icons/icon.ico',
];
```
`app/src-tauri/tauri.conf.json:14-20` (`bundle.icon`) declares the identical 5 paths, and `releaseContract.test.ts:63-72` already asserts exact-array equality, per-file existence + non-empty, and `icns` magic bytes. **ICON-02/ICON-03 static coverage is complete; no test changes needed unless a gap is found during execution (D-04).**

`app/vite.config.ts:180-187` — the `build` block where `chunkSizeWarningLimit: 1100` + comment belongs (currently: `target: 'safari13'`, `minify`, `sourcemap` only; no chunkSizeWarningLimit present [VERIFIED by Read]).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tauri icon` requiring manual 1024×1024 source | Tauri v2 accepts any square PNG/SVG with transparency; no documented mandatory source size | Tauri v2 CLI | 794×794 used directly per spec/D-03; verified accepted |
| v0.8.0 placeholder template icon incident (T-jun-02) | Packaged-icon preflight (`CFBundleIconFile` + bundled resource + icns magic) in `macos-release.sh` | post-v0.8.0 | Phase 40 reuses this exact logic for the D-05 unsigned-build proof |

**Deprecated/outdated:**
- Manual 1024 upscale: out of scope per REQUIREMENTS.md "Out of Scope" table and D-03.
- Any pixel-level icon validation architecture (pngjs, alpha-corner automation, contact sheets): explicitly removed by D-02 — do not reintroduce during planning.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Initial read" classifications in the 12-warning triage table (candidate-fix vs likely-preserve) | Code Examples → baseline inventory | Low by design: D-08 approval gate re-validates every case with evidence before edits; wrong reads get caught at the gate |
| A2 | Vite plugin `onLog` hook as an alternative capture mechanism in Vite 5.4 | Pattern 1 (mentioned only as not-verified) | None — the verified customLogger path is the recommendation; onLog is not used |
| A3 | Tauri overwrites (not merges) `target/release/bundle/macos/` on rebuild, so no manual cleanup of the stale bundle is needed | Runtime State Inventory | Low — worst case UAT checks a stale bundle; Pitfall 6's mtime check catches it |
| A4 | macOS LaunchServices may cache the old icon, requiring cache refresh during UAT | Runtime State Inventory | Low — cosmetic UAT note only |

## Open Questions

1. **Which mixed-import cases (if any) are dependency-inversion reports?**
   - What we know: candidates #11 (physicPaintBridge via projectStore) is the most likely DI case; #5/#9/#10/#12 look convertible.
   - What's unclear: only resolvable with per-case cycle/timing evidence at the D-08 gate.
   - Recommendation: plan a dedicated triage task whose output is the classified list + user checkpoint; edits happen only after approval.

2. **Does `releaseContract.test.ts` need any extension for ICON-03?**
   - What we know: declared-file existence, non-empty, ICNS magic, and exact-array pins all exist verbatim; packaged-.app check lives in the shell script (not the Vitest seam) and D-05 exercises it against the unsigned build.
   - What's unclear: whether the planner wants the D-05 check itself pinned as a repeatable script in the phase dir vs. a documented one-off UAT step.
   - Recommendation: keep as a phase-local check script (discretion area), consistent with "no new machinery" (D-04).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node | build + tests | ✓ | v24.15.0 | — |
| pnpm | all package ops (CLAUDE.md) | ✓ | 10.27.0 | — |
| @tauri-apps/cli (`pnpm tauri`) | icon generation, unsigned build | ✓ | ^2.10.0 (app dep) | — |
| vite | production build seam | ✓ | 5.4.21 | — |
| macOS host (`darwin`) | codesign probe, plutil, packaged .app checks, icon UAT | ✓ | Darwin 24.6.0 | — (phase is macOS-only) |
| `/usr/bin/plutil` | D-05 packaged-icon check | ✓ | present (verified against current packaged Info.plist) | — |
| Rust/cargo (Tauri build) | D-06 unsigned `tauri build` | ✓ (implied — v0.8.1 was packaged on this machine 2026-08-01) | — | — |
| Existing packaged bundle | D-05 reference | ✓ | `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` (stale icon; will be rebuilt) | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (project-pinned; run via pnpm) |
| Config file | existing app vitest setup (no new config — MEMORY: "No test config hacks") |
| Quick run command | `pnpm --dir app exec vitest run src/releaseContract.test.ts` |
| Full suite command | `pnpm --dir app exec vitest run` (CLAUDE.md: `vitest run`, never watch) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ICON-01 | Icons regenerated from approved source | manual/generation step + existing contract test | `pnpm --dir app exec vitest run src/releaseContract.test.ts` | ✅ |
| ICON-02 | Tracked 5-icon set is release authority | unit (contract) | same as above | ✅ (coverage exists verbatim) |
| ICON-03 | Packaged .app declares + contains icon resource | integration (shell check, unsigned build) | D-05 phase check script against `target/release/bundle/macos/EFX Motion Editor.app` | ❌ Wave 0 (phase check script, discretion area) |
| ICON-04 | Legibility 16→512 across Finder/Dock/Cmd-Tab/DMG | manual-only (user UAT per D-06; user is the visual oracle) | — | — |
| BUILD-01 | Resolved limit exactly 1100 + rationale comment | unit (build seam) | `pnpm --dir app exec vitest run src/viteBuild.test.ts` | ✅ (file exists; new assertions added) |
| BUILD-02 | Only provably ineffective imports corrected | triage checkpoint (D-08) + build seam non-return assertions | same build seam | ✅ |
| BUILD-03 | Seam verifies limit/HTML/assets/MC output/separations/non-return | integration (real programmatic build, ~60-90s) | `pnpm --dir app exec vitest run src/viteBuild.test.ts` | ✅ (extended) |

### Sampling Rate
- **Per task commit:** `pnpm --dir app exec vitest run src/releaseContract.test.ts` (fast, pure fs/JSON)
- **Per wave merge:** `pnpm --dir app exec vitest run` (includes the ~60-90s build seam)
- **Phase gate:** Full suite green + `pnpm --dir app build` warnings match approved post-triage set + unsigned `tauri build` + D-05 check + user icon UAT

### Wave 0 Gaps
- [ ] D-05 phase check script (extract-and-run the packaged-icon block from `macos-release.sh`) — covers ICON-03 against the unsigned build
- [ ] Nothing else — both test seams (`releaseContract.test.ts`, `viteBuild.test.ts`) exist with the needed capture patterns; no framework install, no fixtures

## Security Domain

This phase changes build config and binary assets only; no new runtime attack surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | marginal | The 794×794 source is trusted user-owned input (D-01); `tauri icon` is the sole parser — no custom decoding (D-02) |
| V6 Cryptography | no | — |
| V14 Configuration | yes | CSP contract already pinned by `releaseContract.test.ts` (v0.8.1 pattern); this phase must not alter CSP, bundle identity, signing, notarization (spec + D-06) |

### Known Threat Patterns for Tauri/Vite build tooling

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious image input to icon tooling | Tampering | Trusted-input decision (D-01); official CLI parser only |
| Warning suppression masking build regressions | Repudiation/Info disclosure (process integrity) | D-13 module-path-absence assertions; no global suppression (BUILD-02) |
| Accidental signing/notarization drift | Tampering | Zero changes to `macos-release.sh` (D-06); releaseContract grep-pins on the script detect accidental edits |

## Sources

### Primary (empirically verified this session)
- Baseline `pnpm --dir app build` run (Vite 5.4.21): 12 mixed-import warnings + 1 chunk-size warning; chunk inventory with sizes; raw output `/tmp/efx-phase40-baseline-build.txt`
- `pnpm tauri icon` probe into `/tmp/efx-icon-probe`: full generated file list; ICNS representation dump (`ic07`–`ic14`, `ic10`=1024, magic `icns`)
- Warning-capture probe (programmatic `build()` + `createLogger` wrap): 13/13 warnings captured with full module-path text; `configResolved` returned resolved limit 500 (pre-change)
- Packaged-app probe: `plutil -extract CFBundleIconFile` → `icon.icns`; bundled resource present non-empty
- `app/src/releaseContract.test.ts:15-21, 63-72` — icon contract (read verbatim)
- `app/vite.config.ts:32-66, 180-187` — bundle guard + build block (read verbatim)
- `app/src/viteBuild.test.ts:52-60, 62-98` — capture-plugin pattern + build seam (read verbatim)
- `scripts/macos-release.sh:294-328` + tail — `verify_app` icon block, unconditional `main "$@"` (read verbatim)
- `app/src-tauri/tauri.conf.json:14-20` — `bundle.icon` declaration (read verbatim)

### Secondary (official docs via WebFetch)
- https://v2.tauri.app/reference/cli/#icon — input "squared PNG or SVG file with transparency"; default output `icons/` next to tauri.conf.json; no documented source-size mandate
- https://v2.tauri.app/develop/icons/ — desktop icon set matches the declared 5; Square*Logo "currently unused but intended for AppX/MS Store targets"
- https://vite.dev/config/build-options.html — `chunkSizeWarningLimit`: number, kB, default 500, compared against uncompressed chunk size
- https://vite.dev/config/shared-options.html — `customLogger` / `createLogger` wrap pattern for intercepting `warn`

### Tertiary
- None — no claim rests on unverified search results alone.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; all tool versions confirmed by execution
- Architecture: HIGH — all seams read verbatim; capture patterns proven with live probe builds
- Pitfalls: HIGH — each pitfall derived from an observed behavior this session (extras generation, `main "$@"` source trap, hash-named chunks, 969.22 kB headroom)

**Research date:** 2026-08-04
**Valid until:** 2026-09-03 (30 days — stable toolchain; re-run baseline if vite/tauri deps change before execution)
