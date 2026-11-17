---
phase: 64-medium-engine
plan: 01
subsystem: engine
tags:
  - watercolor
  - viscosity
  - webgl2
  - pixel-baseline
  - determinism
  - headless-chrome
  - esbuild

# Dependency graph
requires: []
provides:
  - `viscosity` in the canonical 0..100 bag and the engine 0..1 `Params` bag
  - The ONE canonical mapping's `clamp01` guard for the phase's medium keys
  - Exactly two viscosity consumers in `Engine.step()` (additive dissipation gain, scaled 0.12 spread)
  - `probe/medium-engine/` harness with esbuild + headless-Chrome bundling and FNV-1a pixel digests
  - Both comparator modes: committed-baseline equality and same-session `--other`
  - The committed pre-milestone baseline every later byte-identity gate reuses
affects:
  - 64-02 (medium bag, app-side key, snapshot, Paint-tab row)
  - 64-04 (three-background matrix and the `--differs-from` operand)
  - every later plan whose byte-identity gate compares against `baselines/neutral-identity.json`

# Actuals (#2632) — chars/4 over the realized diff, never a harness token count
actuals:
  tokens: 212
  tasks: 3
  commits: 3
  plan_head_before: d1fd7ea3c890b8684f8160cf90fb5e904ab5e5ad
  plan_head_after: e0b0d83e6e3f575f4b06ae46f26792459aa15880

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Committed pixel-buffer baseline captured BEFORE the change, compared by digest
    - Prototype tap (`setManual`) to capture the adapter's private engine for multi-background export
    - Two-mode comparator (`<gate>` vs baselines, `<gate> --other <gate>` vs /tmp) reusable by later plans

key-files:
  created:
    - packages/efx-watercolor/probe/medium-engine/probe.ts
    - packages/efx-watercolor/probe/medium-engine/run.mjs
    - packages/efx-watercolor/probe/medium-engine/compare.mjs
    - packages/efx-watercolor/probe/medium-engine/index.html
    - packages/efx-watercolor/probe/medium-engine/.gitignore
    - packages/efx-watercolor/probe/medium-engine/baselines/neutral-identity.json
    - packages/efx-watercolor/src/playground/viscosity.test.ts
  modified:
    - packages/efx-watercolor/src/playground/params.ts
    - packages/efx-watercolor/src/playground/Engine.ts
    - packages/efx-watercolor/src/playground/params.test.ts
    - packages/efx-watercolor/src/determinismContract.test.ts

key-decisions:
  - "The viscosity law lives as two literals in Engine.step() with the constants documented in a module comment, not as code constants — the plan pins the exact source expressions, and unused constants would be dead weight."
  - "The benchmark harness captures the adapter's private engine via a prototype tap on setManual, because the adapter exposes only the transparent export while the gate must digest paper and white too."
  - "The spread boundary at viscosity 1 is pinned with 12-decimal closeness, not a decimal literal: IEEE-754 binary64 evaluates 0.12 * (1 - 0.9) to 0.011999999999999997."
  - "Task 2 lands as a test-only commit with no RED, per the 63-09 precedent: Task 1 ships the behavior, so every <behavior> bullet is already green."

patterns-established:
  - "Pre-milestone pixel baseline: capture before the first source edit, commit with its capture commit, never regenerate after the change."
  - "Region-scoped source scan: assert a new value appears only in its two intended sites and in no settle/bleach/advect-ink/display block."
  - "Machine-scoped byte identity: a committed digest is valid on the machine and build that captured it; the gate compares two renders of that same machine."

requirements-completed: [MED-02, MED-03, MED-04, MED-05, MED-06]

coverage:
  - id: D1
    description: "`viscosity` exists in the canonical 0..100 bag and is projected by the ONE mapping to a clamped 0..1 engine value; absent and non-finite inputs map to 0."
    requirement: MED-02
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/params.test.ts#maps the Viscosity global 0..100 onto the 0..1 medium bag"
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/params.test.ts#replays a stroke without the viscosity key at the neutral default"
        status: pass
    human_judgment: false
  - id: D2
    description: "Viscosity is consumed at exactly two engine sites with the documented literals, read once per frame, and never in a settle, bleach, advect-ink or display pass."
    requirement: MED-03
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/viscosity.test.ts#applies viscosity at exactly the two documented literals"
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/viscosity.test.ts#reads this.params.viscosity exactly once — the single local"
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/viscosity.test.ts#never consumes viscosity in a settle, bleach, advect-ink or display pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "The documented rate table holds: strictly monotonic dissipation, bit-identical reduction to the pre-milestone expression at 0, and the 0.12 / 0.066 / 0.012 spread boundaries with no negative value for any clamped input."
    requirement: MED-04
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/viscosity.test.ts#is strictly increasing in viscosity at fixed flow and dt"
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/viscosity.test.ts#reduces bit-identically to the pre-milestone expression at viscosity 0"
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/viscosity.test.ts#scales the 0.12 diffusion floor on the documented boundary"
      - kind: unit
        ref: "packages/efx-watercolor/src/playground/viscosity.test.ts#never returns a negative spread for any clamped viscosity"
        status: pass
    human_judgment: false
  - id: D4
    description: "A pre-milestone stroke renders byte-identically with viscosity at its default: paper, transparent and white exports all match the committed baseline (d2bd637a / 291d4a11 / 6ba88334)."
    requirement: MED-05
    verification:
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/run.mjs --gate neutral-identity && node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity"
        status: pass
      - kind: integration
        ref: "node packages/efx-watercolor/probe/medium-engine/compare.mjs neutral-identity --other neutral-identity-repeat"
        status: pass
    human_judgment: false
  - id: D5
    description: "Replay determinism is unaffected by the medium value: both the 0 and 100 arms replay byte-identically on fresh adapters, and the recorded params bag carries the value that was used."
    requirement: MED-06
    verification:
      - kind: unit
        ref: "packages/efx-watercolor/src/determinismContract.test.ts#replays identically within each viscosity arm and carries the value"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-11-17
status: complete
---

# Phase 64 Plan 01: Viscosity vertical slice with a committed pre-milestone pixel baseline Summary

**One Viscosity term travels from the canonical 0..100 bag through the ONE clamped mapping into exactly two engine sites, and a committed pre-milestone baseline proves the neutral default leaves an existing project's render byte-identical on all three export backgrounds.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-11-17T14:45:21Z
- **Completed:** 2026-11-17T14:52:32Z
- **Tasks:** 3
- **Files modified:** 11 (5 product/test files + 6 probe files, one of them a baseline)

## Accomplishments

- `viscosity` added to `AquarelleCanonicalParams` / `DEFAULT_CANONICAL_PARAMS` (0..100, neutral 0) and to the engine `Params` / `DEFAULT_PARAMS` (0..1).
- `toEngineParams` is the sole producer of the engine value, with a local `clamp01` guard so a typed overshoot or a non-finite value can never reach a uniform (T-64-01).
- Exactly two consumers in `Engine.step()`: `Math.exp(-dt * (3.0 - flow * 2.4 + viscosity * 12.0)) * (fixing ? Math.exp(-dt * 7) : 1)` and `0.12 * (1 - viscosity * 0.9)`. One `this.params.viscosity` read, no third site, nothing in the settle/bleach/advect-ink/display regions.
- The pre-milestone baseline was captured **before** any source edit (from `d1fd7ea3c`) and reproduces exactly after the change: `paper d2bd637a`, `transparent 291d4a11`, `white 6ba88334`, 262144 bytes per export.
- `probe/medium-engine/` ships the reusable harness: esbuild bundle + headless Chrome with real WebGL2, seeded `Math.random` around adapter construction, FNV-1a over every exported byte, and both comparator modes (`<gate>` vs committed baseline, `<gate> --other <gate>` vs `/tmp`).

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end Viscosity — one key, one mapping, two engine sites, one baseline** — `23efbfa04` (feat)
2. **Task 2: Pin the viscosity law at its boundaries** — `1a0d0bcb6` (test)
3. **Task 3: Prove the neutral default with the pixel-buffer gate** — `e0b0d83e6` (test)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified

- `packages/efx-watercolor/src/playground/params.ts` — `viscosity` on the canonical interface and defaults, `clamp01` helper, one projection row.
- `packages/efx-watercolor/src/playground/Engine.ts` — `viscosity` on `Params` / `DEFAULT_PARAMS`, the law documented in a module comment, one local read, the two sites.
- `packages/efx-watercolor/src/playground/params.test.ts` — the `toEqual` output table gains `viscosity: 0`; new rows for 0/37/100, the out-of-track clamp, and the absent/non-finite replay default.
- `packages/efx-watercolor/src/playground/viscosity.test.ts` — source pins (both literals, single read, region exclusion) and the CPU rate table.
- `packages/efx-watercolor/src/determinismContract.test.ts` — optional viscosity on the stroke fixture, a `replayRun` helper that returns the recorded bag, and the viscosity determinism row.
- `packages/efx-watercolor/probe/medium-engine/probe.ts` — the fixed 256x256 `cold` / paperTexture 1 scenario, adapter drive, three-background FNV-1a digest.
- `packages/efx-watercolor/probe/medium-engine/run.mjs` — `--gate <name>` runner writing `/tmp/medium-engine/<name>.json` only.
- `packages/efx-watercolor/probe/medium-engine/compare.mjs` — both modes; unknown flags rejected, baseline never consulted in `--other` mode.
- `packages/efx-watercolor/probe/medium-engine/index.html` / `.gitignore` — the page that loads the bundle; the generated bundle is ignored.
- `packages/efx-watercolor/probe/medium-engine/baselines/neutral-identity.json` — the committed pre-milestone reference with its capture commit.

## Decisions Made

- **Law documented as a comment, applied as literals.** The plan pins exact source expressions (`3.0 - flow * 2.4 + viscosity * 12.0`, `0.12 * (1 - viscosity * 0.9)`), so `VISCOSITY_DISSIPATION_GAIN = 12.0` and `VISCOSITY_SPREAD_FLOOR = 0.012` are recorded in the module comment rather than as unused constants.
- **Prototype tap instead of a new adapter surface.** The adapter exposes only the transparent export; the gate needs paper and white. A tap on `setManual` records the engine instance the adapter just constructed — the same scratch-harness idiom vector-spine uses for `stamp` — with no product-code change.
- **Two comparator modes shipped now.** 64-04 and every later gate consume both, so both land with the baseline that they are proven against; `--differs-from` is deliberately left to 64-04.
- **Baseline fields are minimal on purpose.** `run.mjs` writes only the captured digests and dimensions; wall-clock timing stays on stdout so a later run cannot make the committed file look stale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `index.html` and `.gitignore` to the probe directory**
- **Found during:** Task 1 (probe harness creation)
- **Issue:** The plan's `files_modified` lists `probe.ts`, `run.mjs`, `compare.mjs` and the baseline, but headless Chrome loads `index.html` and esbuild emits `probe.bundle.js` beside the source. Without the page the probe cannot run; without the ignore file the 240 KB bundle would be committed.
- **Fix:** Added both, mirroring `probe/vector-spine/index.html` and `.gitignore` exactly.
- **Files modified:** `packages/efx-watercolor/probe/medium-engine/index.html`, `packages/efx-watercolor/probe/medium-engine/.gitignore`
- **Verification:** The probe ran and the bundle stayed untracked (`git status --ignored` shows it as ignored).
- **Committed in:** `23efbfa04` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The two files are harness plumbing with no product-code surface; the plan's intent (a runnable, reproducible gate) requires them.

## TDD Gate Compliance

Plan frontmatter is `type: execute`; Task 2 carries `tdd="true"` and the phase runs with `workflow.tdd_mode=true`, so `task.is-behavior-adding` returns `true` (`tdd_true` / `has_behavior_block` / `has_source_files` all true). Task 2 nevertheless lands as a single `test(64-01)` commit (`1a0d0bcb6`) with no preceding RED, deliberately:

- All six `<behavior>` bullets already hold in HEAD: Task 1 is the tracer and ships the entire viscosity implementation (mapping, both sites, single read).
- A RED assertion for any of them passes immediately, which is `unexpected_green` under the fail-fast rules. Investigating (rule 1) confirms the behavior exists by design, not that the tests are wrong.
- Per `tdd.md` fail-fast rule 1 and the 63-09 precedent, no RED was fabricated — adding wrong behavior solely to make a test fail is exactly the fabrication the rule forbids. Green-by-construction is recorded here instead.

Observed commit order for the plan: `feat(64-01)` (`23efbfa04`) → `test(64-01)` (`1a0d0bcb6`) → `test(64-01)` (`e0b0d83e6`). The tracer commit necessarily precedes its pins; no `feat(64-01)` follows the `test(64-01)` commits.

## Issues Encountered

- **The spread boundary at viscosity 1 is not a decimal-exact double.** `0.12 * (1 - 1 * 0.9)` evaluates to `0.011999999999999997` in IEEE-754 binary64 (about 3.5e-18 short of `0.012`). The plan's "exactly 0.012" is the real-number statement of the law; the test pins it with `toBeCloseTo(0.012, 12)` and documents why. The 0 and 0.5 boundaries *are* exact (`0.12`, `0.066`) and are pinned with `toBe`.
- **Neutral-default identity was confirmed twice.** Once immediately after the tracer (post-change capture vs the pre-change capture) and again in Task 3 against the committed baseline; both reported all six fields equal.
- No other problems; the package's full suite stayed green (24 files, 439 passed / 8 skipped).

## User Setup Required

None - no external service configuration required. The probe needs a local Chrome install, already present on this machine.

## Threat Flags

None beyond the plan's threat model. T-64-01 is mitigated and tested (clamp in the ONE mapping, non-finite fallback, spread cannot go negative); T-64-02 is mitigated (bounded additive gain, one read per frame); T-64-03 is mitigated (baseline captured from `d1fd7ea3c` before the first source edit and never regenerated); T-64-SC holds (no dependency added).

## Known Stubs

None. No placeholder, hardcoded-empty or unwired values were introduced, and no `<verify>` was left unrun.

## Next Phase Readiness

- The reusable shape is in place for every later medium term: one canonical key, one clamped projection in `toEngineParams`, one engine consumer per behavior, one committed numeric gate.
- `baselines/neutral-identity.json` is the phase-wide pre-milestone reference. It is machine-scoped by construction: the digests are valid for the machine and build that captured them, and `compare.mjs` compares two renders of that same machine.
- Ready for 64-02, which owns the app-side key (`AquarelleGlobalParams`, `AQUARELLE_GLOBAL_KEYS`, `DEFAULT_AQUARELLE_PARAMS`, the `GLOBAL_ROWS` label and the per-stroke snapshot). No app file was modified here.

---
*Phase: 64-medium-engine*
*Completed: 2026-11-17*

## Self-Check: PASSED

All declared artifacts exist and all three task commits are ancestors of HEAD:
`viscosity.test.ts`, `probe/medium-engine/probe.ts`, `run.mjs`, `compare.mjs`,
`baselines/neutral-identity.json`, this SUMMARY; `23efbfa04`, `1a0d0bcb6`, `e0b0d83e6`.
