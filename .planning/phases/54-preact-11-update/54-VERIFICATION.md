---
phase: 54-preact-11-update
verified: 2026-10-14T17:10:41Z
status: passed
score: 17/17 must-haves verified
covered_files:
  [
    ".planning/phases/54-preact-11-update/54-01-PLAN.md",
    ".planning/phases/54-preact-11-update/54-01-SUMMARY.md",
    ".planning/phases/54-preact-11-update/54-02-PLAN.md",
    ".planning/phases/54-preact-11-update/54-02-SUMMARY.md",
    ".planning/phases/54-preact-11-update/54-03-PLAN.md",
    ".planning/phases/54-preact-11-update/54-03-SUMMARY.md",
    ".planning/phases/54-preact-11-update/54-04-PLAN.md",
    ".planning/phases/54-preact-11-update/54-04-SUMMARY.md",
    ".planning/phases/54-preact-11-update/54-05-PLAN.md",
    ".planning/phases/54-preact-11-update/54-05-SUMMARY.md",
    "app/package.json",
    "app/src/components/canvas/PaintOverlay.tsx",
    "app/src/components/canvas/TransformOverlay.tsx",
    "app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx",
    "app/src/components/physic-paint/hooks/usePhysicsPaintApplyResultController.ts",
    "app/src/components/physic-paint/hooks/usePhysicsPaintLaunchIntegration.ts",
    "app/src/components/physic-paint/hooks/useRotoFrameEditingController.ts",
    "app/src/components/physic-paint/hooks/useRotoPersistenceIntegration.ts",
    "app/src/components/physic-paint/view/PhysicsPaintBackgroundClipSection.test.ts",
    "app/src/components/physic-paint/view/PhysicsPaintPhotoReferenceDialog.test.ts",
    "app/src/components/physic-paint/view/PhysicsPaintPlayScriptDialog.tsx",
    "app/src/components/physic-paint/view/PhysicsPaintScriptPickerDialog.test.tsx",
    "app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx",
    "app/src/components/physic-paint/view/PhysicsPaintStyledTooltip.tsx",
    "app/src/components/physic-paint/view/PhysicsPaintTrackRow.test.tsx",
    "app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx",
    "app/src/components/physic-paint/view/PhysicsPaintWorkflowStripRailCreate.test.tsx",
    "app/src/components/sequence/KeyPhotoStrip.tsx",
    "app/src/components/shared/NumericStepper.test.tsx",
    "app/src/components/shared/NumericStepper.tsx",
    "app/src/components/shared/SliderStepper.tsx",
    "app/src/paintVersionDisciplineContract.test.ts",
    "app/src/preactSingleCopyContract.test.ts",
    "package.json",
    "packages/efx-physic-paint/package.json",
    "pnpm-lock.yaml",
  ]
covered_digest: "v3:sha256:6ed9953a2783cc72e13356181220eba26121f230b1078616e535c37361b589dc"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 54: Preact 11 Update — Verification Report

**Phase Goal:** The workstation runs on Preact 11 with the signals reactivity law intact, proven live before any engine work begins
**Verified:** 2026-10-14T17:10:41Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                          | Status     | Evidence                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Throwaway two-leg probe green on preact@11.0.1 + @preact/signals@2.11.3 BEFORE any workspace pin moved; a red leg would stop the milestone (SC1, RUN-01)          | ✓ VERIFIED | Probe commits `62ef96ac` (create) and `d6eca4db` (delete) precede bump commit `529bdb4c`. Probe `package.json` pinned exact `11.0.1`/`2.11.3`. Pattern + pairing legs recorded green. |
| 2   | Probe directory `scripts/preact11-probe/` deleted once both legs green (54-01 D-02)                                                                            | ✓ VERIFIED | `test ! -e scripts/preact11-probe` passes. Delete commit `d6eca4db` in history. No probe file left behind.                                                                       |
| 3   | Human confirmed the four locked bump targets exist on npm before any workspace install (54-02)                                                                  | ✓ VERIFIED | `54-02-SUMMARY.md` records option A with four version strings + publisher identities (preactjs org, ericfennis). Held before 54-03 install.                                      |
| 4   | Workspace resolves exactly one preact copy (11.0.1) across app + packages (SC3, RUN-02)                                                                         | ✓ VERIFIED | `pnpm -r why preact` shows only `preact 11.0.1`; lockfile has a single `preact@11.0.1` entry; zero `preact@10` lines; no `preact@10*` virtual-store entries remain.                 |
| 5   | Root `pnpm.overrides.preact` on the 11.x line and `@preact/signals` on the 2.11.3+ line (54-03)                                                                 | ✓ VERIFIED | `package.json` overrides: `preact: ^11.0.1`, `@preact/signals: ^2.11.3`. Pin tests 1-2 green.                                                                                    |
| 6   | `lucide-preact` pinned to `^1.57.0` and `@preact/preset-vite` aligned on `2.10.6` (SC3, RUN-03)                                                                 | ✓ VERIFIED | `app/package.json` `lucide-preact: ^1.57.0`; `@preact/preset-vite: 2.10.6` in both `app` and `packages/efx-physic-paint`. One preset-vite instance on `preact@11.0.1` in lockfile. |
| 7   | `packages/efx-physic-paint` peer `>=11.0.0` AND devDep 11.x land in the SAME commit (54-03 D-04)                                                                | ✓ VERIFIED | `git show 529bdb4c` — `peerDependencies.preact` `>=10.0.0`→`>=11.0.0` and `devDependencies.preact` `^10.29.0`→`^11.0.1` in one commit. No dual-major range.                        |
| 8   | Standing `.test.ts` contract pin fails loudly if a future install reintroduces a second preact (54-03 D-05)                                                     | ✓ VERIFIED | `app/src/preactSingleCopyContract.test.ts` (192 lines, 6 tests) passes. RED-first TDD: `79151e25` born red on 10.x tree, `529bdb4c` green. RED evidence `54-03-red-evidence.json`. |
| 9   | `tsc --noEmit` green after the mechanical migration; behavior identical (SC3, RUN-04)                                                                           | ✓ VERIFIED | `pnpm --filter efx-motion-editor run typecheck` exit 0. Full vitest suite: 271 files, 4926 passed / 1 skipped / 96 todo.                                                        |
| 10  | JSX.Element return types stay; CSSProperties/Targeted* move to preact namespace; no other file carries JSX.* type refs; D-08 items get zero work (54-04 D-07/D-08) | ✓ VERIFIED | Grep: zero `JSX.CSSProperties`/`JSX.Targeted` in the three D-07 files; both `JSX.Element` return types remain. Bare named imports from `'preact'`. TS `~5.9.3`; zero uninit `useRef()`. |
| 11  | paintVersion bump+subscribe discipline preserved — not rewritten into effect cleanups (SC2, RUN-05, D-11)                                                        | ✓ VERIFIED | `app/src/paintVersionDisciplineContract.test.ts` (243 lines, 5 tests) green. PaintOverlay.tsx:2319-2324 keeps the requestPreview idiom (body read + same `.value` in dep array).   |
| 12  | Compare-then-write store setter bumps the version clock zero times on an unchanged value (54-05, efx-preact-reactivity rule 3)                                   | ✓ VERIFIED | Pin asserts early-return-before-write-before-bump shape for `setRotoPlaybackSettings` and `setRotoBackgroundMetadata`. Probe assertion 2 behaviorally confirmed 1000 no-op calls = 0 bumps on Preact 11. |
| 13  | Live UAT rows A1-A5 user-asserted and CLOSED before Phase 55 opens (SC4, RUN-06, D-03)                                                                          | ✓ VERIFIED | `54-05-SUMMARY.md` records A1-A5 all PASS with per-row live observations; commit `9c091264`. Human gate closed 2026-10-14.                                                        |
| 14  | [backstop] Root `pnpm.overrides.preact` takes precedence; the contract pin still reports a contradicting pin                                                     | ✓ VERIFIED | RED run directly observed the pin naming contradicting pins (`overrides.preact=^10.29.8`, `dependencies.preact: 10.29.8`, `peerDependencies.preact: >=10.0.0`). `pnpm why` shows one copy under the override. |
| 15  | [backstop] A workspace package that declares no preact pin is accepted with zero second-copy findings                                                             | ✓ VERIFIED | Explicit synthetic test in the pin (`synthetic/no-preact/package.json` with only `left-pad`) asserts `collectOffenders` returns `[]`.                                            |
| 16  | [backstop] The one-copy contract pin enumerates workspace manifests in deterministic sorted path order when reporting offenders                                  | ✓ VERIFIED | `workspaceManifestPaths()` sorts via `localeCompare`; test 6 property-asserts `paths === sorted(paths)` and per-offender message names package + field.                           |
| 17  | [backstop] Studio open/close leaves no live paintVersion subscription after dispose (A4)                                                                         | ✓ VERIFIED | Live UAT A4: profile counters `lifecycle.canvasMount.beforeDestroy: 1`, `observer.canvasMount.resize.cleanup: 1` against `install: 2`. Directly observed dispose behavior.       |

**Score:** 17/17 truths verified (0 present, behavior-unverified)

### Deferred Items

None.

### Advisory (New Scope, Unevidenced)

Not applicable — initial verification (no re-verification gate).

### Required Artifacts

| Artifact                                            | Expected                                                     | Status             | Details                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------- |
| `app/src/preactSingleCopyContract.test.ts`          | Permanent one-preact-copy contract pin (D-05)                  | ✓ VERIFIED         | 192 lines, 6 tests, 10 expects. Collected by vitest. RED-first TDD. Rides existing setup.        |
| `app/src/paintVersionDisciplineContract.test.ts`    | Permanent D-11 / RUN-05 source-contract pin                    | ✓ VERIFIED         | 243 lines, 5 tests, 22 expects. Names PaintOverlay / physicPaintStore / paintStore. Green.       |
| `scripts/preact11-probe/package.json`               | Throwaway probe manifest, exact D-09 pins (created + deleted)  | ✓ VERIFIED (D-02)  | History `62ef96ac`. Exact `preact: 11.0.1`, `@preact/signals: 2.11.3`. Deleted `d6eca4db`.        |
| `scripts/preact11-probe/probe.mjs`                  | Throwaway pattern-leg runner (created + deleted)               | ✓ VERIFIED (D-02)  | History `62ef96ac`. Substantive DOM shim + three assertions. Deleted `d6eca4db`.                  |
| `package.json` (root)                               | pnpm.overrides retargeted to 11.x / 2.11.3                     | ✓ VERIFIED         | `preact: ^11.0.1`, `@preact/signals: ^2.11.3`.                                                   |
| `app/package.json`                                  | preact 11.0.1, signals 2.11.3, lucide ^1.57.0, preset-vite 2.10.6 | ✓ VERIFIED      | All four fields confirmed.                                                                      |
| `packages/efx-physic-paint/package.json`            | peer >=11.0.0 + devDep 11.x + preset-vite 2.10.6               | ✓ VERIFIED         | All three fields confirmed in commit `529bdb4c`.                                                 |

### Key Link Verification

| From                                              | To                                             | Via                                                                 | Status     | Details                                                       |
| ------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------- | ---------- | ------------------------------------------------------------- |
| Probe `package.json`                              | preact@11.0.1 + @preact/signals@2.11.3 (D-09)  | Exact pins in throwaway manifest                                     | ✓ WIRED    | History `62ef96ac` shows exact D-09 pins.                      |
| Pairing witness SPECS/.../package.json            | Preact 11 + signals pairing                    | Read-only measurement (never copy-from)                              | ✓ WIRED    | Not in files_modified. typecheck+build ran as witness.          |
| Root `pnpm.overrides.preact`                      | Workspace singleton mechanism (D-05)           | Contract pin tests 1-2 read and assert the override                  | ✓ WIRED    | Pin `preactSingleCopyContract.test.ts:132-139`.                 |
| D-06 divergence (preact@10.28.4 + preact@10.29.8) | Eliminated by this bump                        | `pnpm -r why preact` measurement + virtual-store cleanup             | ✓ WIRED    | Zero `preact@10` lines remain.                                 |
| efx-physic-paint peer + devDep                    | One commit (D-04)                              | `git show 529bdb4c` — both fields in same diff                       | ✓ WIRED    | Never shipped apart.                                           |
| PaintOverlay subscribe idiom                      | D-11 protected shape                           | Pin scans effect body + dep array for `paintStore.paintVersion.value` | ✓ WIRED    | PaintOverlay.tsx:2319-2324 confirmed.                          |
| A1-A5 row set                                     | Hard gate on Phase 55                          | User assertion recorded in SUMMARY + commit `9c091264`               | ✓ WIRED    | Row set not trimmed, not extended.                             |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces dependency pins, type migrations, and source-contract tests. No dynamic rendered values to trace.

### Behavioral Spot-Checks

| Behavior                                 | Command                                                                              | Result                                                    | Status  |
| ---------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------- |
| Both contract pins pass                  | `pnpm exec vitest run src/preactSingleCopyContract.test.ts src/paintVersionDisciplineContract.test.ts` | 11 passed (11)                                            | ✓ PASS  |
| Typecheck green (RUN-04)                 | `pnpm --filter efx-motion-editor run typecheck`                                       | exit 0, zero `error TS` lines                             | ✓ PASS  |
| Full suite green (behavior identical)    | `pnpm --filter efx-motion-editor exec vitest run`                                     | 271 files, 4926 passed / 1 skipped / 96 todo, exit 0      | ✓ PASS  |
| Single preact copy resolved              | `pnpm -r why preact`                                                                 | only `preact 11.0.1`; zero `preact@10` lines              | ✓ PASS  |
| JSX migration greps                      | `grep 'JSX.CSSProperties\|JSX.Targeted'` on 3 D-07 files                              | no matches; `JSX.Element` return types still present      | ✓ PASS  |

### Probe Execution

| Probe                         | Command                                       | Result                                              | Status        |
| ----------------------------- | --------------------------------------------- | --------------------------------------------------- | ------------- |
| `scripts/preact11-probe/`     | `node scripts/preact11-probe/probe.mjs` (historical) | exit 0, PROBE_PASS + teardown-clean (per 54-01 SUMMARY); directory deleted per D-02 | PASS (historical) |

No standing `scripts/*/tests/probe-*.sh` probes exist. The RUN-01 probe was intentionally throwaway (D-02); evidence is the create/delete commits and the SUMMARY record. Not re-runnable by design.

### Requirements Coverage

| Requirement | Source Plan | Description                                                                                                       | Status      | Evidence                                                                                         |
| ----------- | ---------- | ----------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ |
| RUN-01      | 54-01      | Probe `@preact/signals` ↔ Preact 11 compatibility BEFORE any bump; STOP if red                                     | ✓ SATISFIED | Probe green on both legs before bump; deleted on green. Commits `62ef96ac`→`d6eca4db`→`529bdb4c`. |
| RUN-02      | 54-02, 54-03 | App runs on `preact@11.0.1` + `@preact/signals@2.11.3` with exactly one `preact` copy                             | ✓ SATISFIED | `pnpm -r why preact` single copy; lockfile single entry; contract pin 6/6.                        |
| RUN-03      | 54-02, 54-03 | `lucide-preact` bumped to `^1.57.0`                                                                               | ✓ SATISFIED | `app/package.json` `lucide-preact: ^1.57.0`. Peer range allows Preact 11 (confirmed 54-02).       |
| RUN-04      | 54-04      | Mechanical migration: JSX types → preact namespace, useRef initial values, defaultProps/auto-px → compat            | ✓ SATISFIED | Three D-07 files migrated; typecheck green; D-08 items measured no-impact, zero work.             |
| RUN-05      | 54-05      | `paintVersion` bump+subscribe discipline preserved — NOT rewritten into effect cleanups                             | ✓ SATISFIED | `paintVersionDisciplineContract.test.ts` 5/5 green. D-11 held.                                    |
| RUN-06      | 54-05      | Live UAT of the reactivity paths CLOSES before Phase 55 opens                                                       | ✓ SATISFIED | A1-A5 user-asserted PASS 2026-10-14 (commit `9c091264`). Phase 55 unblocked.                     |

**Orphaned requirements:** None. All six RUN IDs in REQUIREMENTS.md are claimed by plans and marked Complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| —    | —    | —       | —        | None. No TBD/FIXME/XXX debt markers in phase-touched source. No stubs, no placeholder text, no empty implementations in created/modified files. |

**Prohibitions check (all held):**

- No feature work / UX change / engine work — commits are probe, test, type migration, and dependency bump only.
- No one-off vitest config — both contract pins ride the existing `src/**/*.test.ts` setup.
- No dual-major preact peer range — `peerDependencies.preact` is `>=11.0.0` (clean-break law).
- No second preact copy — `pnpm -r why preact` and lockfile confirm singleton.
- No useRef call-site rewrites (D-08) — zero uninit `useRef()` call sites.
- No TypeScript major bump — `~5.9.3` retained.
- paintVersion subscriptions not rewritten — pin green on the bump+subscribe shape.
- No useState introduced by this phase — diff adds zero `useState` lines (pre-existing usages in touched files predate the phase).
- Export smoke / chunk-budget not in A1-A5 — row set is exactly A1-A5 per D-03.

### Test Quality Audit

| Test File                                       | Linked Req  | Active | Skipped | Circular | Assertion Level | Verdict |
| ----------------------------------------------- | ----------- | ------ | --------- |---------- | --------------- | ------- |
| `app/src/preactSingleCopyContract.test.ts`      | RUN-02, RUN-03 | 6    | 0         | 0         | Value + Behavioral | PASS    |
| `app/src/paintVersionDisciplineContract.test.ts` | RUN-05, RUN-06 | 5    | 0         | 0         | Value + Behavioral (control-flow order) | PASS |

**Disabled tests on requirements:** 0
**Circular patterns detected:** 0
**Insufficient assertions:** 0 — both pins use value-level and control-flow-order assertions with named-surface failure messages.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts. (13/13 — `check.decision-coverage-verify`, non-blocking gate.)

### Human Verification Required

None outstanding. The phase's human gates were all held and closed during execution:

- **54-02 package-legitimacy checkpoint** — human option A recorded with four version strings + publisher identities (blocking-human, held before install).
- **54-03 D-04 one-way peer-range door** — human option A recorded before the peerDependencies edit (blocking-human).
- **54-05 live UAT A1-A5** — user-asserted PASS 2026-10-14 with per-row live observations (commit `9c091264`). This was the hard gate before Phase 55; it is closed.

### Gaps Summary

No gaps. All 17 must-haves verified against the actual codebase:

- The workspace runs on Preact 11.0.1 + @preact/signals 2.11.3 with exactly one preact copy (lockfile + `pnpm why` measurement + standing contract pin).
- The signals reactivity law is intact: bump+subscribe discipline preserved (source-contract pin), idempotent setters preserved (source shape + probe behavioral proof), Studio dispose clean (live A4 with profile counters).
- The proof is live: A1-A5 user-asserted PASS before any engine work (Phase 55) begins.
- Both standing contract pins (`preactSingleCopyContract.test.ts`, `paintVersionDisciplineContract.test.ts`) are green and will fail loudly on regression.

---

_Verified: 2026-10-14T17:10:41Z_
_Verifier: Claude (gsd-verifier)_
