---
phase: 54-preact-11-update
plan: 03
subsystem: infra
tags: [preact, preact-signals, lucide-preact, preset-vite, one-preact-copy, contract-pin, tdd, pnpm-overrides]

# Dependency graph
requires:
  - phase: 54-01
    provides: "RUN-01 satisfied — Preact 11 + signals 2.11.3 pairing de-risked before any pin moved"
  - phase: 54-02
    provides: "Package legitimacy (option A) for preact@11.0.1, @preact/signals@2.11.3, lucide-preact@1.57.0, @preact/preset-vite@2.10.6"
provides:
  - "Workspace on preact@11.0.1 + @preact/signals@2.11.3 with exactly one preact copy (RUN-02)"
  - "lucide-preact@^1.57.0 and aligned @preact/preset-vite@2.10.6 pins (RUN-03, D-10, D-13)"
  - "Standing one-preact-copy contract pin (D-05) at app/src/preactSingleCopyContract.test.ts"
  - "D-04 door walked: efx-physic-paint peerDependencies.preact >=11.0.0 AND devDependencies.preact ^11.0.1 in the SAME commit"
affects: [54-04, 54-05]

# Actuals (#2632) — pairs with the plan's `estimate` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), never a harness token count.
actuals:
  tokens: 4799
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added:
    - "preact@11.0.1"
    - "@preact/signals@2.11.3"
    - "lucide-preact@1.57.0"
  patterns:
    - "Standing fs/JSON contract pin over workspace manifests as the one-preact-copy guard (releaseContract.test.ts analog)"
    - "RED-first TDD on a dependency bump: the pin is born red on the 10.x tree, then the bump makes it green"

key-files:
  created:
    - app/src/preactSingleCopyContract.test.ts
    - .planning/phases/54-preact-11-update/54-03-red-evidence.json
  modified:
    - package.json
    - app/package.json
    - packages/efx-physic-paint/package.json
    - pnpm-lock.yaml

key-decisions:
  - "Option A (D-04 one-way door): peerDependencies.preact >=11.0.0 + devDependencies.preact 11.x in the SAME commit; no dual-major range (clean-break law accepted 2026-10-14)"
  - "Root pnpm.overrides.preact ^11.0.1 + @preact/signals ^2.11.3 are the workspace singleton mechanism the pin guards"
  - "app pins exact preact 11.0.1 + @preact/signals 2.11.3 + lucide-preact ^1.57.0 (D-09, D-10)"
  - "Every @preact/preset-vite pin aligned on 2.10.6 (D-13 concrete target from 54-02)"
  - "Contract pin rides the existing vitest setup (include: src/**/*.test.ts); filename ends in .test.ts so vitest collects it"
  - "RED evidence captured as JUnit XML after TAP proved parser-incompatible (vitest nested/flat TAP trips Non-TAP data + Malformed TAP); classifier verdict RED_EVIDENCE_OK"
  - "Orphaned virtual-store entries on the retired preact@10 lane (including D-06 app/node_modules/.pnpm/preact@10.28.4) deleted so no second preact copy remains on disk"

patterns-established:
  - "One-preact-copy contract pin: root override on 11.x, signals 2.11.3+, no off-line package pin, peer floor >=11.0.0, sorted offender reports"

requirements-completed: [RUN-02, RUN-03]

# Coverage metadata (#1602) — one entry per shipped deliverable. Drives DETERMINISTIC UAT routing in verify-work.
coverage:
  - id: D1
    description: "Standing one-preact-copy contract pin (app/src/preactSingleCopyContract.test.ts) — RED at birth on the 10.x tree, GREEN after the bump"
    requirement: "RUN-02"
    verification:
      - kind: unit
        ref: "pnpm --filter efx-motion-editor exec vitest run src/preactSingleCopyContract.test.ts (6 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Workspace resolves exactly one preact copy (11.0.1) across app + packages; D-06 second-copy divergence eliminated"
    requirement: "RUN-02"
    verification:
      - kind: other
        ref: "pnpm -r why preact — only preact 11.0.1; lockfile has a single preact@11.0.1; no preact@10 virtual-store entry remains"
        status: pass
    human_judgment: false
  - id: D3
    description: "lucide-preact pinned to ^1.57.0 (peer floor for Preact 11) and every @preact/preset-vite pin aligned on 2.10.6"
    requirement: "RUN-03"
    verification:
      - kind: other
        ref: "app/package.json lucide-preact ^1.57.0; packages/efx-physic-paint + app preset-vite 2.10.6; lucide-preact@1.57.0 peerDependencies.preact is ^10.27.2 || ^11.0.0-0"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-04 same-commit pair: packages/efx-physic-paint peerDependencies.preact >=11.0.0 AND devDependencies.preact ^11.0.1"
    requirement: "RUN-02"
    verification:
      - kind: other
        ref: "git show 529bdb4c — both fields land in one commit; no dual-major range written"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-10-14
status: complete
plan_head_before: dacaff8b4a0b595038bd77d4f4a37fce25ee3d82
plan_head_after: 529bdb4ca3375ac0f3018d3d57e4b27047ba7666
---

# Phase 54 Plan 03: One-Preact-Copy Bump Summary

**Workspace moved to preact@11.0.1 + @preact/signals@2.11.3 with exactly one preact copy, proven by a RED-first standing contract pin and a documented `pnpm why preact` measurement.**

## Performance

- **Duration:** 11 min
- **Tasks:** 3/3 completed (1 checkpoint:decision + 2 auto, Task 2 tdd="true")
- **Commits:** 2 (measured `dacaff8b..HEAD`)
- **Files modified:** 5 workspace files + 1 new permanent test + 1 RED evidence record

## Accomplishments

### Task 1 — Walk the one-way peer-range door (D-04)

`checkpoint:decision`, `gate="blocking-human"`. Human selected **option A** with rationale: *engines 2–3 must not build on a dead major, and a peer-only bump would leave a live 10.x devDep that silently re-pins workspace resolution — the exact second-copy failure D-05 exists to prevent.*

- Locked shape: `peerDependencies.preact` `">=10.0.0"` → `">=11.0.0"` AND `devDependencies.preact` `^10.29.0` → the 11.x line **in the same commit**, with root `pnpm.overrides.preact` moving to the 11.x line as part of the same bump.
- No dual-major range written (clean-break law accepted 2026-10-14).

### Task 2 — RED: one-preact-copy contract pin (tdd="true")

Created `app/src/preactSingleCopyContract.test.ts` (permanent, rides the existing vitest setup — no one-off config). Pure fs/JSON reads of root + workspace manifests via `fileURLToPath(import.meta.url)`.

The pin asserts:
1. Root `pnpm.overrides.preact` is on the 11.x line (not the 10.x line)
2. Root `pnpm.overrides["@preact/signals"]` is on the 2.11.3+ line
3. No workspace package pins an off-line `preact` in `dependencies` / `devDependencies`
4. Every `peerDependencies.preact` range is `>=11.0.0` or stricter on the 11 major (dual-major floor rejected)
5. A workspace package that declares no `preact` pin contributes zero offenders
6. Offenders are reported in sorted package-path order and each failure message names the package and the field

**RED at birth (verified, not assumed):** exit 1 on the pre-bump tree. Failures named the live surfaces:

| Failure | Named surface |
|---------|---------------|
| overrides.preact | `package.json pnpm.overrides.preact=^10.29.8 must be on the 11.x line` |
| overrides signals | `package.json pnpm.overrides["@preact/signals"]=^2.11.2 must be 2.11.3 or higher` |
| deps/devDeps pins | `app/package.json dependencies.preact: 10.29.8` + `packages/efx-physic-paint/package.json devDependencies.preact: ^10.29.0` |
| peer floor | `packages/efx-physic-paint/package.json peerDependencies.preact: >=10.0.0` |

**TDD RED evidence:** JUnit XML via `vitest --reporter=junit`. TAP (`tap` and `tap-flat`) was tried first and rejected by the classifier (`Non-TAP data in report`, `Malformed TAP` — vitest's YAML diagnostics are parser-incompatible). Reran with the supported JUnit reporter through the project's test command; `gsd_run check tdd-red-evidence` returned **`RED_EVIDENCE_OK`** (`target_test_failed`). Semantic assessment: the target test executed and failed on the planned 11.x-line assertion, not a load/fixture/syntax fault. Record: `.planning/phases/54-preact-11-update/54-03-red-evidence.json`.

### Task 3 — GREEN: workspace bump to Preact 11.0.1 + one-copy proof

| Manifest | Field | From | To |
|----------|-------|------|----|
| `package.json` | `pnpm.overrides.preact` | `^10.29.8` | `^11.0.1` |
| `package.json` | `pnpm.overrides["@preact/signals"]` | `^2.11.2` | `^2.11.3` |
| `app/package.json` | `preact` | `10.29.8` | `11.0.1` |
| `app/package.json` | `@preact/signals` | `2.11.2` | `2.11.3` |
| `app/package.json` | `lucide-preact` | `^0.577.0` | `^1.57.0` |
| `app/package.json` | `@preact/preset-vite` | `2.10.6` | `2.10.6` (already aligned) |
| `packages/efx-physic-paint/package.json` | `peerDependencies.preact` | `>=10.0.0` | `>=11.0.0` |
| `packages/efx-physic-paint/package.json` | `devDependencies.preact` | `^10.29.0` | `^11.0.1` |
| `packages/efx-physic-paint/package.json` | `devDependencies["@preact/preset-vite"]` | `^2.10.5` | `2.10.6` |

**D-04 same-commit pair held:** `peerDependencies.preact` and `devDependencies.preact` land in commit `529bdb4c` together with the root override move.

**D-05 close evidence (`pnpm -r why preact`):**

```
efx-motion-editor (app):
  preact 11.0.1
  @preact/signals 2.11.3 → preact 11.0.1 peer
  lucide-preact 1.57.0 → preact 11.0.1 peer
  @preact/preset-vite 2.10.6 → @prefresh/vite → preact 11.0.1 peer

@efxlab/efx-physic-paint:
  preact 11.0.1
  @preact/preset-vite 2.10.6 → @prefresh/vite → preact 11.0.1 peer
```

- Exactly one resolved preact version across the workspace: **11.0.1**
- Zero `preact@10` lines
- Lockfile carries a single `preact@11.0.1` entry
- **D-06 divergence gone:** `app/node_modules/.pnpm/preact@10.28.4` and root `preact@10.29.8` no longer exist (orphaned virtual-store entries on the retired lane were deleted after `pnpm install`)
- **D-13 closed:** one `@preact/preset-vite` instance remains (`2.10.6` coupled to `preact@11.0.1`); the `2.10.3` / `2.10.5` / `2.10.6` triple and the `2.10.3` instance that rode `preact@10.28.4` are gone

**Contract pin after the bump:** `pnpm --filter efx-motion-editor exec vitest run src/preactSingleCopyContract.test.ts` → **6 passed (6)**.

## Task Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Walk the one-way peer-range door (D-04) | (decision recorded — no files changed by the gate itself) | — |
| 2 | RED: one-preact-copy contract pin | `79151e25` | `app/src/preactSingleCopyContract.test.ts` |
| 3 | GREEN: workspace bump + one-copy proof | `529bdb4c` | `package.json`, `app/package.json`, `packages/efx-physic-paint/package.json`, `pnpm-lock.yaml` |

**Plan metadata:** `docs(54-03): complete one-preact-copy-bump plan` (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified

- `app/src/preactSingleCopyContract.test.ts` — created (permanent D-05 standing pin)
- `.planning/phases/54-preact-11-update/54-03-red-evidence.json` — created (TDD RED evidence record)
- `package.json` — modified (pnpm.overrides)
- `app/package.json` — modified (preact, signals, lucide-preact)
- `packages/efx-physic-paint/package.json` — modified (peer + devDep preact, preset-vite)
- `pnpm-lock.yaml` — refreshed resolution

## Decisions Made

- **Option A walked (D-04 one-way door):** peer `>=11.0.0` + devDep 11.x + root override 11.x in one bump. No dual-major fallback remains; the clean-break law forbids reintroducing one.
- **Root override is the singleton:** `^11.0.1` / `^2.11.3` take precedence over any package-level pin; the contract pin still reports a contradicting pin (backstop truth held).
- **Junit for RED evidence:** TAP was incompatible with the classifier for vitest output; JUnit XML is the supported format used. Verdict `RED_EVIDENCE_OK`.
- **Orphan virtual-store cleanup:** unreferenced `preact@10*` / `*preact@10*` entries under `node_modules/.pnpm` and `app/node_modules/.pnpm` were deleted after install so "no second preact copy left anywhere" is true on disk, not only in the lockfile.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TAP RED evidence rejected by classifier**
- **Found during:** Task 2
- **Issue:** vitest `--reporter=tap` and `--reporter=tap-flat` both produced reports the `tdd-red-evidence` classifier marked `INVALID_RED` (`Non-TAP data in report`, `Malformed TAP`) because vitest's YAML diagnostics do not parse as strict TAP.
- **Fix:** Reran the planned target with the supported JUnit XML reporter through the project's test command (`vitest --reporter=junit --outputFile=...`), captured the unchanged XML as `output`, and submitted that record. Classifier returned `RED_EVIDENCE_OK`. Per tdd.md RED step 4: "If the reporter is incompatible, rerun the planned target with a supported reporter."
- **Files modified:** `.planning/phases/54-preact-11-update/54-03-red-evidence.json` (evidence record; test file unchanged)
- **Commit:** `79151e25` (test commit as planned)

No other deviations.

## Issues Encountered

None beyond the TAP reporter incompatibility above.

## Auth Gates / Human Checkpoints

**Task 1: D-04 one-way peer-range door** — `checkpoint:decision`, `gate="blocking-human"`.

- **Resolved as:** Option A. Human rationale recorded: engines 2–3 must not build on a dead major; a peer-only bump would leave a live 10.x devDep that re-pins workspace resolution (the D-05 failure mode).
- **Outcome:** GREEN bump authorized with the locked shape (peer + devDep same commit, no dual-major range).

## Known Stubs

None — no hardcoded empty values, placeholder text, or unwired data sources in the created/modified files.

## Threat Flags

None — no new network endpoint, auth path, file-access pattern, or trust-boundary schema change. `pnpm install` used the 54-02 legitimacy-approved pins only (T-54-07 / T-54-SC held). The standing pin is the T-54-05 mitigation and is green.

## TDD Gate Compliance

Plan type is `execute` (not `type: tdd`), so the plan-level TDD gate table does not apply. Task 2 carried `tdd="true"` and followed the RED→GREEN cycle:

| Phase | Commit | Evidence |
|-------|--------|----------|
| RED | `79151e25` `test(54-03): add failing one-preact-copy contract pin` | `RED_EVIDENCE_OK` (JUnit, target_test_failed); 4 planned failures naming 10.x override and dual pins |
| GREEN | `529bdb4c` `feat(54-03): bump workspace to preact 11.0.1 with one-copy proof` | 6/6 contract pin tests pass |
| REFACTOR | — | not needed |

## Next Phase Readiness

- 54-04 (JSX namespace migration, RUN-04 / D-07) is unblocked: the workspace now resolves Preact 11 types; `tsc --noEmit` is expected to report the three named seams until 54-04 lands.
- 54-05 (paintVersion discipline pin + live UAT A1–A5, RUN-05 / RUN-06) follows 54-04.
- No blockers.

## Self-Check: PASSED

- `app/src/preactSingleCopyContract.test.ts` exists and is collected by vitest (6 tests)
- Commits `79151e25` and `529bdb4c` exist on `gsd/phase-54-preact-11-update`
- D-04 same-commit pair verified in `529bdb4c` (peer + devDep together)
- Contract pin green after the bump (6 passed)
- `pnpm -r why preact` shows a single preact 11.0.1 and no preact@10 line
- SUMMARY.md present at `.planning/phases/54-preact-11-update/54-03-SUMMARY.md`
