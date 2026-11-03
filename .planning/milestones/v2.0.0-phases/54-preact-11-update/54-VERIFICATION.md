---
phase: 54-preact-11-update
verified: 2026-11-02T11:30:38Z
status: passed
score: 21/21 must-haves verified
covered_files:
  [
    ".planning/phases/54-preact-11-update/54-01-PLAN.md",
    ".planning/phases/54-preact-11-update/54-01-SUMMARY.md",
    ".planning/phases/54-preact-11-update/54-02-PLAN.md",
    ".planning/phases/54-preact-11-update/54-02-SUMMARY.md",
    ".planning/phases/54-preact-11-update/54-03-PLAN.md",
    ".planning/phases/54-preact-11-update/54-03-SUMMARY.md",
    ".planning/phases/54-preact-11-update/54-03-red-evidence.json",
    ".planning/phases/54-preact-11-update/54-04-PLAN.md",
    ".planning/phases/54-preact-11-update/54-04-SUMMARY.md",
    ".planning/phases/54-preact-11-update/54-05-PLAN.md",
    ".planning/phases/54-preact-11-update/54-05-SUMMARY.md",
    "app/package.json",
    "app/src/components/canvas/PaintOverlay.tsx",
    "app/src/components/physic-paint/PhysicsPaintStudio.test.ts",
    "app/src/components/physic-paint/PhysicsPaintStudio.tsx",
    "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx",
    "app/src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts",
    "app/src/components/physic-paint/roto/PhysicsPaintRotoBackgroundValidatorParity.test.ts",
    "app/src/components/shared/NumericStepper.tsx",
    "app/src/components/shared/SliderStepper.tsx",
    "app/src/paintVersionDisciplineContract.test.ts",
    "app/src/preactJsxNamespaceContract.test.ts",
    "app/src/preactSingleCopyContract.test.ts",
    "app/src/preactToolchainContract.test.ts",
    "app/src/stores/paintStore.ts",
    "app/src/stores/physicPaintStore.paper.test.ts",
    "app/src/stores/physicPaintStore.test.ts",
    "app/src/stores/physicPaintStore.ts",
    "package.json",
    "pnpm-lock.yaml",
  ]
covered_digest: "v3:sha256:551088aada4a7a8ec0ac8a9ec02a49e76991cf65b1511e58c6ab470024a896e1"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 21/21
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory:
  - finding: "CR-01: Play Script dialog root Enter handler hijacks Enter from focused buttons (Enter on Cancel confirms)"
    category: other
    reason: "Pre-existing UX/interaction defect in a file Phase 54 touched only with type-only edits (54-REVIEW.md). No deterministic failing test or reproducible command was supplied; out of Phase 54's must-have scope. Disposition `open` in 54-REVIEW-DISPOSITION.md."
    evidence_status: "none provided"
  - finding: "CR-02: shared steppers strand the module-global undo coalescing on unmount"
    category: other
    reason: "Pre-existing defect in NumericStepper/SliderStepper (54-REVIEW.md), outside the type-only Phase 54 diff. No deterministic failing test was supplied; disposition `open` in 54-REVIEW-DISPOSITION.md."
    evidence_status: "none provided"
  - finding: "WR-02: paintVersion pin still accepts a subscribe+write effect body; WR-03: setRotoBackgroundMetadata pin locks 1 of 4 equality fields"
    category: other
    reason: "Pin-completeness warnings on app/src/paintVersionDisciplineContract.test.ts (54-REVIEW.md). The underlying source discipline is intact and independently verified this pass (runtime idempotence test + directly inspected four-field guard); no failing test demonstrates a discipline regression. Worth hardening in a follow-up."
    evidence_status: "none provided"
  - finding: "Remaining review findings WR-01, WR-04..WR-07, IN-01..IN-04"
    category: other
    reason: "Pre-existing defects/heuristics in Phase-54-touched files, all dispositioned `open` in 54-REVIEW-DISPOSITION.md; none falsifies a Phase 54 must-have, and none carries deterministic test evidence in this verification."
    evidence_status: "none provided"
  - finding: "Unreferenced virtual-store residue: node_modules/.pnpm/preact@11.0.1, node_modules/.pnpm/preact@11.0.2 (plus preact@11.0.1/11.0.2-coupled @preact/* dirs); the resolved copy is preact@11.1.1"
    category: other
    reason: "Created by later patch bumps (0b15de7c9 preact 11.0.2, 3bc344718 11.1.1), not by Phase 54 (whose D-06 10.x residue is gone). The lockfile and `pnpm -r why preact` resolve a single 11.1.1; the other directories are unreferenced disk residue. Cleanup is informational."
    evidence_status: "none provided"
---

# Phase 54: Preact 11 Update — Verification Report

**Phase Goal:** The workstation runs on Preact 11 with the signals reactivity law intact, proven live before any engine work begins
**Verified:** 2026-11-02T11:30:38Z
**Status:** passed
**Re-verification:** Yes — forced by a covered-file change. The previously stored digest was stale because `app/src/stores/physicPaintStore.ts` changed in the PAPER-03 pair: `aa4153622` (store: `_writePaperDisplay` now returns a `BackgroundEditDescriptor | null`, paper setters surface it) and `1ff7b5214` (Studio: paper-id edits no longer record an undo entry). Both are undo-ledger/display changes outside the Preact 11 surfaces; this pass re-derived every truth from the current tree and re-ran the phase gates against it. No regression was found.

## Goal Achievement

The phase goal is achieved on the current tree. The workspace runs on Preact 11.1.1 (a later patch bump on the same 11.x line) with a single resolved `preact` copy across app and packages, `@preact/signals` 2.11.3, and `lucide-preact` on the Preact-11-permitting `^1.57.0` line. Root `pnpm.overrides.preact` / `@preact/signals` hold the workspace singleton on the 11.x / 2.11.3+ lines. The probe-before-bump gate and its deletion are recorded in history and still absent from the tree. The JSX-namespace migration is intact (`CSSProperties` / `Targeted*Event` as bare `preact` type imports, `JSX.Element` return types preserved, zero forbidden `JSX.*` references tree-wide). The paintVersion bump+subscribe discipline is preserved, with the four-field compare-then-write guard intact and the named runtime idempotence test green.

The PAPER-03 store change was examined directly and does not alter the reactivity law: the `_writePaperDisplay` idempotence guard still compares the clamped background/strength/scale triple and returns before any write or `bumpTrackRevision`; the write path still rotates the mirror through the same guarded branch; the new `BackgroundEditDescriptor | null` return is threaded only into the Studio undo ledger, not into any version clock. `bumpTrackRevision`, `setRotoBackgroundMetadata`, and `setRotoPlaybackSettings` are unchanged. `pnpm --filter efx-motion-editor run typecheck` exits 0 with zero `error TS` lines, all four standing contract pins plus the store suite pass 158/158, the PAPER-03 affected surfaces pass 426/426, and the full vitest suite is green (366 files passed / 2 skipped; 7018 tests passed / 1 skipped / 96 todo; main chunk 1,587.25 kB under the 2,000 kB ceiling). The A1-A5 live UAT remains a recorded user-asserted PASS from 2026-10-14, before Phase 55 opened.

### Observable Truths

| #   | Truth                                                                                                                                                                                                         | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Throwaway two-leg probe green on preact@11.0.1 + @preact/signals@2.11.3 BEFORE any workspace pin moved (SC1, RUN-01, D-01)                                                                                   | ✓ VERIFIED | `git cat-file -e` confirms `62ef96ac7` (create) and `d6eca4dbd` (delete); both are ancestors of the bump `529bdb4c` (`git merge-base --is-ancestor` returns 0 for create<delete and delete<bump). `git show 62ef96ac7:scripts/preact11-probe/package.json` pins exactly `preact: 11.0.1` / `@preact/signals: 2.11.3`. 54-01-SUMMARY records pattern leg (mount-runs=1 → bump runs=2, idempotent-clean, teardown-clean) and pairing leg (`tsc -b` + `vite build` exit 0). |
| 2   | A red probe leg stops the phase as a named blocking decision — no shim, no unofficial pin (RUN-01, D-01)                                                                                                      | ✓ VERIFIED | Stop-if-red gate explicit in 54-01-PLAN/SUMMARY; both legs were green so the stop path never triggered. No shim or unofficial pin exists: root `pnpm.patchedDependencies` / `resolutions` are null, and `app/vite.config.ts` declares no preact alias or compat shim (only the standing `@preact/preset-vite` plugin plus the pre-existing optimizeDeps fix). The workspace stayed on 10.x until `529bdb4c`; the probe pins were the exact D-09 pairing.                       |
| 3   | Probe directory `scripts/preact11-probe/` deleted once both legs green (D-02)                                                                                                                                 | ✓ VERIFIED | `test ! -e scripts/preact11-probe` exits 0; `git ls-files | grep preact11-probe` returns none; delete commit `d6eca4dbd` removes 3 files / 385 lines (`.gitignore`, `package.json`, `probe.mjs`) and the directory is absent from HEAD.                                                                                                                                                                                                                                |
| 4   | A human confirmed the four bumped packages exist on npm at the locked target versions before any workspace install (RUN-02, RUN-03, T-54-SC)                                                                   | ✓ VERIFIED | 54-02-SUMMARY records option A with all four versions and publisher identities (preactjs org for preact/signals/preset-vite; ericfennis for lucide-preact) and confirms the lucide peer range `^10.27.2 \|\| ^11.0.0-0`. 54-03's install commit `529bdb4c` follows the recorded gate.                                                                                                                                                                                     |
| 5   | Workspace resolves exactly one preact copy on the 11.x line across app + packages (SC3, RUN-02, D-05, D-06)                                                                                                   | ✓ VERIFIED | `pnpm -r why preact` on the current tree resolves only `preact 11.1.1` (zero `preact 10` lines); `pnpm-lock.yaml` has one `preact@11.1.1` package entry and no `preact@10` reference. The D-06 `preact@10.28.4` + `preact@10.29.8` divergence is gone. (Unreferenced 11.0.x virtual-store residue exists — see Advisory.)                                                                                                                                            |
| 6   | Root `pnpm.overrides.preact` on the 11.x line and `@preact/signals` on the 2.11.3+ line (RUN-02, D-09)                                                                                                        | ✓ VERIFIED | Root `package.json` overrides read `preact: ^11.1.1`, `@preact/signals: ^2.11.3`; pin test read directly from the manifest. `^11.1.1` is the later patch bump within the same 11.x line (3bc344718); Phase 54 landed `^11.0.1`.                                                                                                                                                                                                                                     |
| 7   | `lucide-preact` pinned to `^1.57.0`, the first line whose peer range allows Preact 11 (RUN-03, D-10)                                                                                                          | ✓ VERIFIED | `app/package.json` `lucide-preact: ^1.57.0`; `preactToolchainContract.test.ts` 7/7 green (range parser rejects `0.x` and 1.0–1.56.x, accepts `^`/`~`/exact at or above 1.57.0). Lockfile declares a single `lucide-preact@1.57.0(preact@11.1.1)`.                                                                                                                                                                                                                        |
| 8   | `@preact/preset-vite` pins aligned so no 2.10.x instance rides the retired preact lane (RUN-02, D-13)                                                                                                         | ✓ VERIFIED | `app/package.json` devDependency `@preact/preset-vite: 2.10.6`; the current workspace packages (`efx-paint-host`, `efx-spectral`, `efx-watercolor`) declare none; lockfile has one `@preact/preset-vite@2.10.6(...preact@11.1.1...)` instance; toolchain pin green.                                                                                                                                                                                                         |
| 9   | `packages/efx-physic-paint` bumps peerDependencies.preact to `>=11.0.0` and devDependencies.preact to the 11.x line in the SAME commit (RUN-02, D-04)                                                          | ✓ VERIFIED | `git show 529bdb4c -- packages/efx-physic-paint/package.json` shows `peerDependencies.preact >=10.0.0 → >=11.0.0`, `devDependencies.preact ^10.29.0 → ^11.0.1`, and preset-vite `^2.10.5 → 2.10.6` in one diff; no dual-major range. The package was retired later by `22d0a8e91` (quick 261027-klx, 2026-10-27), outside Phase 54's scope.                                                                                                                        |
| 10  | A standing `.test.ts` contract pin fails loudly if a future install reintroduces a second preact (RUN-02, D-05)                                                                                               | ✓ VERIFIED | `app/src/preactSingleCopyContract.test.ts` (192 lines, 6 tests) exists, rides the existing vitest setup, and is green on the current tree. RED-first TDD record `54-03-red-evidence.json` (`exit 1`, `one-preact-copy contract pin (D-05) > root pnpm.overrides.preact is on the 11.x line`) names the 10.x override and the offending deps/peer pins.                                                                                                                |
| 11  | [backstop] Root `pnpm.overrides.preact` takes precedence over any workspace package pin; the contract pin still reports the contradicting pin                                                                 | ✓ VERIFIED | The recorded RED run (exit 1) names the contradicting pins while the override was 10.x — `package.json pnpm.overrides.preact=^10.29.8`, `app/package.json dependencies.preact: 10.29.8`, `packages/efx-physic-paint devDependencies.preact: ^10.29.0`, `peerDependencies.preact: >=10.0.0`. The current `pnpm -r why preact` resolves one copy under the 11.x override and the pin is green. Directly observed behavior, not mere symbol presence.                   |
| 12  | [backstop] A workspace package that declares no preact pin is accepted by the one-copy pin (zero second-copy findings for that package)                                                                       | ✓ VERIFIED | Explicit synthetic test (`synthetic/no-preact/package.json` with only `left-pad`) asserts `collectOffenders(...)` is `[]`; green. All three current packages declare no preact pin and contribute zero offenders in the real scan.                                                                                                                                                                                                                                          |
| 13  | [backstop] The one-copy pin enumerates workspace manifests in deterministic sorted path order when reporting offenders                                                                            | ✓ VERIFIED | `workspaceManifestPaths()` sorts via `localeCompare`; test 6 asserts the offender path list equals its own sorted copy and every message names package + field; green.                                                                                                                                                                                                                                                                                                     |
| 14  | `tsc --noEmit` is green after the three-file JSX namespace migration (SC3, RUN-04, D-07)                                                                                                                      | ✓ VERIFIED | `pnpm --filter efx-motion-editor run typecheck` exits **0** with **zero** `error TS` lines on the current tree (re-run this pass). The earlier TS6196 (`DepField` unused in `preactToolchainContract.test.ts`) remains removed by `0b6fd2576`.                                                                                                                                                                                                                          |
| 15  | `JSX.Element` return types stay as-is; only `CSSProperties` and `Targeted*Event` move to the preact namespace (RUN-04, D-07)                                                                                  | ✓ VERIFIED | `NumericStepper.tsx:292` and `SliderStepper.tsx:281` still return `JSX.Element`; `NumericStepper.tsx:3` and `SliderStepper.tsx:3` import bare `CSSProperties`/`TargetedMouseEvent`/`TargetedPointerEvent` from `'preact'`; `PhysicsPaintCanvasMount.tsx:1` imports bare `CSSProperties`; manual grep finds zero `JSX.CSSProperties`/`JSX.Targeted` matches; `preactJsxNamespaceContract.test.ts` 9/9 green.                                                              |
| 16  | No other file in the tree carries `JSX.*` type references after the migration (RUN-04, D-07)                                                                                                                  | ✓ VERIFIED | Manual `grep -rn "JSX.CSSProperties\|JSX.Targeted" app/src packages` (node_modules excluded) returns zero matches; the pin's tree-wide scan over `app/src` + `packages` is green and its detection self-test proves the scanner catches a real reference.                                                                                                                                                                                                                  |
| 17  | D-08 guide items verified no-impact (auto-px, defaultProps, forwardRef, SuspenseList, Component.base, render() 3rd arg, Hydration 2.0, Object.is/NaN deps, TS floor, ESM-only, useRef initial values) get zero migration work (RUN-04, D-08) | ✓ VERIFIED | Zero `defaultProps`, `forwardRef`, `SuspenseList`, and uninitialized `useRef()` call sites tree-wide (re-grepped this pass); TypeScript stays `~5.9.3` in app and all packages (>=5.1, no 7.x jump); Phase 54's commits contain only D-07 type seams and mechanical RefObject/MutableRef type fallout, no compat shims.                                                                                                                                                  |
| 18  | paintVersion bump+subscribe discipline is preserved — subscribe effects still read the version signal, not rewritten into cleanup-based correctness (SC2, RUN-05, D-11)                                         | ✓ VERIFIED | `PaintOverlay.tsx:2320-2324` reads `paintStore.paintVersion.value` in the effect body with the same `.value` read in the dep array; `:2330-2332` is the second subscribe effect; `bumpTrackRevision` (`physicPaintStore.ts:164-180`) still does `entry.paint.value++` / `entry.roto.value++` / `physicPaintVersion.value++` after the PAPER-03 change; `_notifyVisualChange` (`paintStore.ts:85-89`) still does `paintVersion.value++`; `paintVersionDisciplineContract.test.ts` 5/5 green. |
| 19  | Calling a compare-then-write store setter with an unchanged value bumps the version clock zero times (RUN-05, RUN-06, efx-preact-reactivity rule 3)                                                          | ✓ VERIFIED | `setRotoPlaybackSettings` (`physicPaintStore.ts:3557-3560`) compares `current?.loop`/`current.fps` and returns false before any write; `setRotoBackgroundMetadata` (`:3497-3523`) compares all four fields (background, clamped grainStrength, color, normalized grainScale) and returns before `.set(...)` and `bumpTrackRevision`. The PAPER-03-touched `_writePaperDisplay` (`:1753`) retains its own clamped-triple idempotence guard (`:1784-1791`) and returns `null` before any write/bump on an identical edit. Runtime evidence: the named test `260923-bcm: a scale-only metadata write is not early-returned by the idempotence guard` ran green in this pass and asserts an identical write leaves `physicPaintVersion.value` unchanged. |
| 20  | Live UAT rows A1-A5 are user-asserted and CLOSED before Phase 55 opens (SC4, RUN-06, D-03)                                                                                                                    | ✓ VERIFIED | 54-05-SUMMARY records all five rows PASS on 2026-10-14 with per-row live observations (A1 canvas follows stroke; A2 undo/redo canvas+rail; A3 track switch; A4 dispose counters; A5 standalone `./preact` mount). Phase 55's first commit (context capture) is 2026-10-14 21:41 +0200, after the UAT close, and ROADMAP records Phase 55 completed 2026-10-15. Row set neither trimmed nor extended (exactly A1–A5).                                                               |
| 21  | [backstop] Studio open/close leaves no live paintVersion subscription after dispose (A4)                                                                                                                       | ✓ VERIFIED | Recorded live A4 observation: `lifecycle.canvasMount.beforeDestroy: 1` and `observer.canvasMount.resize.cleanup: 1` against `install: 2`, no idle `render.*` churn, `decode.*` zero. Directly observed dispose behavior (the backstop evidence bar), and the standing pin still protects the subscribe shape. No code surface involved in A4 changed in the PAPER-03 pair.                                                                                                |

**Score:** 21/21 truths verified (0 present, behavior-unverified)

No regressions from the PAPER-03 change. Every truth is either verified on the current tree or carries recorded live/human evidence from execution time (truths 1-4, 9, 20-21 are historical or human gates that are not re-runnable).

### Deferred Items

None.

### Advisory (New Scope, Unevidenced)

New-scope findings raised by the retrospective review artifacts, not tied to a Phase 54 must-have and carrying no deterministic test evidence this pass. They do not block the phase goal and do not revert a completed must-have. All remain `open` in 54-REVIEW-DISPOSITION.md.

| # | Finding | Category | Why Advisory |
|---|---------|----------|--------------|
| 1 | CR-01 — Play Script dialog root Enter handler hijacks Enter from focused buttons | other | Pre-existing UI/interaction defect; no failing test or reproducible command supplied; outside the type-only Phase 54 diff |
| 2 | CR-02 — shared steppers strand module-global undo coalescing on unmount | other | Pre-existing defect; no deterministic failing test supplied; outside Phase 54's type-only scope |
| 3 | WR-02 / WR-03 — paintVersion pin accepts a subscribe+write body; metadata pin locks 1 of 4 equality fields | other | Pin-strength warnings; the underlying source discipline is verified intact this pass (four-field guard read directly + runtime idempotence test); would be a hardening follow-up |
| 4 | WR-01, WR-04..WR-07, IN-01..IN-04 — remaining review findings | other | All `open` in 54-REVIEW-DISPOSITION.md; pre-existing, no must-have falsified, no deterministic evidence |
| 5 | `node_modules/.pnpm/preact@11.0.1` and `preact@11.0.2` unreferenced virtual-store residue (plus their `@preact/*`-coupled dirs) | other | Created by later patch bumps (0b15de7c9 / 3bc344718), not Phase 54; lockfile and `pnpm -r why preact` resolve a single 11.1.1; cleanup informational |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `app/src/preactSingleCopyContract.test.ts` | Permanent one-preact-copy contract pin (D-05) | ✓ VERIFIED | 192 lines, 6 tests, green; rides existing vitest; RED-first TDD evidence recorded. |
| `app/src/paintVersionDisciplineContract.test.ts` | Permanent D-11 / RUN-05 source-contract pin | ✓ VERIFIED | 253 lines, 5 tests, green; names PaintOverlay/physicPaintStore/paintStore. Pin-completeness warnings recorded as advisory. |
| `app/src/preactToolchainContract.test.ts` | Nyquist gap-closure pin for RUN-03 (lucide floor + preset-vite alignment) | ✓ VERIFIED | 299 lines, 7 tests green; the unused `DepField` alias was removed in `0b6fd2576` and tree-wide `tsc --noEmit` exits 0. |
| `app/src/preactJsxNamespaceContract.test.ts` | Nyquist gap-closure pin for RUN-04 / D-07 | ✓ VERIFIED | 301 lines, 9 tests green; three D-07 file assertions + tree-wide zero-reference scan with a detection self-test. |
| `scripts/preact11-probe/package.json` | Throwaway probe manifest, exact D-09 pins (created + deleted, D-02) | ✓ VERIFIED (historical) | Created `62ef96ac7` with `preact: 11.0.1` / `@preact/signals: 2.11.3`; deleted `d6eca4dbd`; absent from HEAD. |
| `scripts/preact11-probe/probe.mjs` | Throwaway pattern-leg runner (created + deleted, D-02) | ✓ VERIFIED (historical) | Created `62ef96ac7`; deleted `d6eca4dbd`; absent from HEAD. |
| Root `package.json` | `pnpm.overrides` retargeted to 11.x / 2.11.3+ | ✓ VERIFIED | `preact: ^11.1.1`, `@preact/signals: ^2.11.3` (later patch bump within the line). |
| `app/package.json` | preact 11.x, signals 2.11.3, lucide `^1.57.0`, preset-vite 2.10.6 | ✓ VERIFIED | `preact: 11.1.1`, `@preact/signals: 2.11.3`, `lucide-preact: ^1.57.0`, `@preact/preset-vite: 2.10.6`, typescript `~5.9.3`. |
| `packages/efx-physic-paint/package.json` | peer `>=11.0.0` + devDep 11.x + preset-vite 2.10.6 (D-04, D-13) | ✓ VERIFIED (historical) | All three fields landed in `529bdb4c`; the package was retired later by `22d0a8e91`, outside Phase 54's scope. |
| `pnpm-lock.yaml` | Refreshed single-copy Preact 11 resolution | ✓ VERIFIED | Single `preact@11.1.1` entry; zero `preact@10` references; all consumers keyed to `preact@11.1.1`. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Probe `package.json` | preact@11.0.1 + @preact/signals@2.11.3 (D-09) | Exact pins in the throwaway manifest | ✓ WIRED | `git show 62ef96ac7` pins both exactly; probe created and green before bump `529bdb4c`. |
| Pairing witness `SPECS/v1.1.0-water-color/watercolor-playground` | Preact 11 + signals pairing | Read-only measurement, never copy-from | ✓ WIRED | Witness declares `preact ^11.0.0` + `@preact/signals ^2.11.3`; its `tsc -b` + `vite build` ran green per 54-01-SUMMARY. |
| Root `pnpm.overrides.preact` | Workspace singleton mechanism (D-05) | Contract pin tests 1-2 read and assert the override | ✓ WIRED | Pin green; `pnpm -r why preact` shows one resolved copy. |
| D-06 divergence (`preact@10.28.4` + `preact@10.29.8`) | Eliminated by the bump | `pnpm -r why preact` + lockfile scan | ✓ WIRED | Zero preact@10 lines/entries remain. |
| `@preact/preset-vite` pins | One aligned instance on 2.10.6 | Toolchain pin + lockfile suffix inspection | ✓ WIRED | One `@preact/preset-vite@2.10.6(...preact@11.1.1...)` lockfile instance; no current package redeclares it. |
| efx-physic-paint peer + devDep | One commit (D-04) | `git show 529bdb4c` | ✓ WIRED | Both fields in the same diff; no dual-major range. |
| PaintOverlay subscribe idiom | D-11 protected shape | Pin scans effect body + dep array for `paintStore.paintVersion.value` | ✓ WIRED | `PaintOverlay.tsx:2320-2324` (body + dep array), second effect `:2330-2332`; pin green. |
| PAPER-03 `_writePaperDisplay` descriptor | Studio undo ledger only | Return value threaded into `recordPaperDisplayEdit` / paper-id path removed | ✓ WIRED | Typecheck green; the descriptor never feeds a paintVersion bump; idempotence guard still returns before write. |
| A1-A5 row set | Hard gate on Phase 55 | Recorded user assertion in 54-05-SUMMARY | ✓ WIRED | All five PASS 2026-10-14; Phase 55 context opened 2026-10-14 21:41 +0200 and completed 2026-10-15. |

### Data-Flow Trace (Level 4)

N/A — Phase 54 produces dependency pins, type migrations, and source-contract tests. No dynamic rendered value is introduced or rewired; the rendered-data surfaces it touches (`PaintOverlay`, stores) are unchanged in behavior except the type-only edits. The PAPER-03 change routes a new descriptor value to the undo ledger, which is outside this phase's rendered-data surfaces.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Four Phase 54 contract pins + the store suite pass on the current tree | `pnpm --filter efx-motion-editor exec vitest run src/preactSingleCopyContract.test.ts src/preactToolchainContract.test.ts src/preactJsxNamespaceContract.test.ts src/paintVersionDisciplineContract.test.ts src/stores/physicPaintStore.test.ts` | 5 files, **158 passed** (6 + 7 + 9 + 5 + 131) | ✓ PASS |
| Tree typecheck (RUN-04 gate) | `pnpm --filter efx-motion-editor run typecheck` | **exit 0**, zero `error TS` lines | ✓ PASS |
| Full suite | `pnpm --filter efx-motion-editor exec vitest run` | 366 files passed / 2 skipped; **7018 passed**, 1 skipped, 96 todo; exit 0; main chunk 1,587.25 kB under the 2,000 kB ceiling | ✓ PASS |
| PAPER-03 affected surfaces (regression probe) | `pnpm --filter efx-motion-editor exec vitest run src/stores/physicPaintStore.paper.test.ts src/components/physic-paint/PhysicsPaintStudio.test.ts src/components/physic-paint/hooks/useRotoPhysicalEditHistory.test.ts src/components/physic-paint/roto/PhysicsPaintRotoBackgroundValidatorParity.test.ts` | 4 files, **426 passed** | ✓ PASS |
| Single resolved preact copy | `pnpm -r why preact` | only `preact 11.1.1`; zero `preact 10` lines | ✓ PASS |
| Idempotent metadata write keeps the version clock unchanged | Named test within `src/stores/physicPaintStore.test.ts` (`260923-bcm: a scale-only metadata write is not early-returned by the idempotence guard`) | passed; identical write leaves `physicPaintVersion.value` unchanged | ✓ PASS |
| JSX migration greps | `grep -E "JSX\.CSSProperties\|JSX\.Targeted"` on the three D-07 files and tree-wide; `grep "): JSX.Element"` on the two steppers | zero forbidden refs; both `JSX.Element` return types present | ✓ PASS |
| D-08 no-impact items | `grep defaultProps\|forwardRef\|SuspenseList`; `grep "useRef()"`; TypeScript version read across manifests | zero matches; `~5.9.3` in app and all packages | ✓ PASS |
| Probe directory deleted | `test ! -e scripts/preact11-probe`; `git ls-files | grep preact11-probe` | exit 0; absent from HEAD tree | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| `scripts/preact11-probe/probe.mjs` | historical `node scripts/preact11-probe/probe.mjs` | exit 0 with PROBE_PASS + teardown-clean per 54-01-SUMMARY; directory deleted on green per D-02 | PASS (historical) |

No standing `scripts/*/tests/probe-*.sh` probes exist (`find` returns none). The RUN-01 probe was intentionally throwaway and is unreproducible by design (D-02); the evidence is the create/delete commits plus the recorded two-leg result.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| RUN-01 | 54-01 | Probe `@preact/signals` ↔ Preact 11 compatibility BEFORE any bump; STOP if red | ✓ SATISFIED | Probe created `62ef96ac7`, deleted `d6eca4dbd`, both before bump `529bdb4c`; both legs recorded green; no shim. |
| RUN-02 | 54-02, 54-03 | App runs on `preact@11.0.1` + `@preact/signals@2.11.3` with exactly one `preact` copy | ✓ SATISFIED | Single resolved `preact 11.1.1` (later patch bump on the same line) + signals 2.11.3; lockfile single copy; one-copy pin 6/6. |
| RUN-03 | 54-02, 54-03 | `lucide-preact` bumped to `^1.57.0` (peer range allows Preact 11) | ✓ SATISFIED | `app/package.json` `^1.57.0`; toolchain pin 7/7; peer range confirmed live in 54-02. |
| RUN-04 | 54-04 | Mechanical migration: JSX types → preact namespace, `useRef` initial values, `defaultProps`/auto-px → compat | ✓ SATISFIED | Three D-07 seams migrated, tree-wide JSX scan clean, D-08 items received zero work, and `tsc --noEmit` exits 0 after `0b6fd2576` closed the validation pin's TS6196. |
| RUN-05 | 54-05 | `paintVersion` bump+subscribe discipline preserved — NOT rewritten into effect cleanups | ✓ SATISFIED | `PaintOverlay.tsx:2320/2324/2330/2332` idiom intact; bump helpers intact after the PAPER-03 change; pin 5/5; runtime idempotence test green. |
| RUN-06 | 54-05 | Live UAT of reactivity paths CLOSES before Phase 55 opens | ✓ SATISFIED | A1-A5 user-asserted PASS 2026-10-14; Phase 55 opened and completed after. |

**Orphaned requirements:** None — all six RUN IDs mapped to Phase 54 in REQUIREMENTS.md are claimed by plans and accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No blockers this pass | — | The previous TS6196 entry (`DepField` unused alias) is resolved by `0b6fd2576`; typecheck is clean. |
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO` debt markers in the changed store file or the covered test surfaces | — | Debt-marker gate clean on the current tree. |
| — | — | No placeholder/stub implementations in the phase's deliverables | — | Pins and manifests are substantive; probe was throwaway by design. The PAPER-03 `return null` occurrences are typed no-op/failure returns, not placeholder rendering. |

**Prohibitions check (all held):**

- No feature work / UX change / engine work in Phase 54 — commits are probe, test, type migration, and dependency pins only.
- No one-off vitest config — all four pins ride the existing `src/**/*.test.ts` setup; no vitest config touched by the phase commits.
- No dual-major `preact` peer range — D-04 clean break (`>=11.0.0`); the one-copy pin rejects dual-major floors.
- No second `preact` copy — lockfile and `pnpm -r why` resolve a single 11.x copy (unreferenced 11.0.x virtual-store residue noted as advisory only).
- No useRef call-site rewrites (D-08) — zero uninitialized `useRef()` call sites; only prop-type widening landed.
- No TypeScript major bump — `~5.9.3` retained in app and all packages.
- paintVersion subscriptions not rewritten into cleanups — pin green; no cleanup-based rewrite in the phase diff.
- No `useState`/React/new state library introduced by the phase.
- Export smoke / chunk-budget checks not folded into A1-A5 — the row set is exactly A1-A5 per D-03.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
| --------- | ---------- | ------ | ------- | -------- | --------------- | ------- |
| `app/src/preactSingleCopyContract.test.ts` | RUN-02, RUN-03 | 6 | 0 | 0 | Value + behavioral synthetic cases | PASS |
| `app/src/preactToolchainContract.test.ts` | RUN-03 | 7 | 0 | 0 | Value + parser behavior + synthetic offenders | PASS |
| `app/src/preactJsxNamespaceContract.test.ts` | RUN-04 | 9 | 0 | 0 | Value + detection self-test | PASS |
| `app/src/paintVersionDisciplineContract.test.ts` | RUN-05, RUN-06 | 5 | 0 | 0 | Value + control-flow order | PASS with pin-completeness warning (WR-02/WR-03, advisory) |

**Disabled tests on requirements:** 0 → no blocker.
**Circular patterns detected:** 0 → no blocker.
**Insufficient assertions:** 1 warning — the paintVersion pin does not reject a subscribe+write effect body and the metadata pin asserts only one equality field (WR-02/WR-03); the actual source discipline is independently verified intact this pass.

### Decision Coverage

All 13 trackable CONTEXT.md decisions are honored by shipped artifacts (13/13, non-blocking gate; `check.decision-coverage-verify` returned `honored: 13, total: 13, not_honored: []`).

### Human Verification Required

N/A — Infrastructure/foundation phase (stack bump + type migration) with no new user-facing surface, and every human gate was held and closed during execution:

- 54-02 package-legitimacy checkpoint — option A with four versions + publisher identities, before install.
- 54-03 D-04 one-way peer-range door — option A before the peerDependencies edit.
- 54-05 live UAT A1-A5 — user-asserted PASS 2026-10-14 with per-row observations; Phase 55 opened after.

No ⚠️ PRESENT_BEHAVIOR_UNVERIFIED or abstained `insufficient_spec` truths exist this pass. The A1-A5 rows are preserved as recorded user-asserted facts, not re-derived from unit tests.

### Gaps Summary

None. This re-verification was triggered solely by the stale covered digest: `app/src/stores/physicPaintStore.ts` changed in the PAPER-03 pair (`aa4153622` / `1ff7b5214`). Direct inspection shows the change is display/undo-ledger only: `_writePaperDisplay` now returns the committed `BackgroundEditDescriptor` (or `null` on no-op/failure), its clamped-triple idempotence guard still returns before any write or revision bump, `bumpTrackRevision` is unchanged, and the Studio paper-id path no longer records a ledger entry. On the current tree:

- `pnpm --filter efx-motion-editor run typecheck` exits 0 with zero `error TS` lines.
- All four standing contract pins plus the store suite pass 158/158.
- The PAPER-03 affected surfaces pass 426/426.
- The full suite is green: 366 files passed / 2 skipped, 7018 tests passed / 1 skipped / 96 todo; the production build stays under the 2,000 kB chunk budget (main chunk 1,587.25 kB).
- `pnpm -r why preact` and `pnpm-lock.yaml` each resolve a single `preact@11.1.1` copy with zero `preact@10` references.
- The D-07 JSX-namespace migration is intact with `JSX.Element` preserved.
- The paintVersion bump+subscribe discipline and the compare-then-write setters are intact, with the named runtime idempotence test green.
- The A1-A5 live UAT close remains on the record from 2026-10-14.

---

_Verified: 2026-11-02T11:30:38Z_
_Verifier: Claude (gsd-verifier)_
