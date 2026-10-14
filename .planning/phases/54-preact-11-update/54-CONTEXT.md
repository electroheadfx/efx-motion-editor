# Phase 54: Preact 11 update - Context

**Gathered:** 2026-10-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the workspace from Preact 10.29.8 to Preact 11 with the signals reactivity law intact. Dependency bump + mechanical migration only — no feature work, no engine work, no UX change. This is the hard pre-req of phases 55–57: it runs first and its live UAT closes before Phase 55 opens.

Scope anchor: RUN-01 (stop-if-red probe) → RUN-02 (one preact copy on 11.0.1 + signals 2.11.3) → RUN-03 (lucide-preact bump) → RUN-04 (mechanical migration) → RUN-05 (paintVersion discipline preserved) → RUN-06 (live UAT A1–A5 closes the phase).

</domain>

<decisions>
## Implementation Decisions

### Probe green bar (RUN-01)
- **D-01:** The throwaway probe has TWO legs and stops if either is red. (a) **Pattern leg — the real gate:** a paintVersion-style bump+subscribe render effect (signal write in an effect + compare-then-write store setter) must still tear down correctly on `preact@11.0.1` + `@preact/signals@2.11.3`. (b) **Pairing leg — cheap confirmation:** the declared-green package pairing actually runs, witnessed by `SPECS/v1.1.0-water-color/watercolor-playground` (already on preact 11.0.1 + signals 2.11.3). "Does signals import" is not enough. Stop-if-red on either leg is a named blocking decision — never a shim, never an unofficial pin.
- **D-02:** The probe is throwaway: delete it once both legs are green. Its job is to de-risk this bump, not to become a permanent test surface (a synthetic pattern pin would not exercise the real components). Phase 54 stays stack-bump-only. The paintVersion teardown law stays enforced by the standing reactivity discipline plus A1–A5 live UAT; a future Preact/signals bump re-creates its own probe as its own gate. — **Reversibility:** reversible — re-creating a probe later is cheap.

### Live UAT surface (RUN-06)
- **D-03:** All five rows A1–A5 are the hard gate that opens Phase 55. Do not trim, do not extend:
  - **A1** — paint a stroke in Studio: canvas reflects it without a manual refresh (paintVersion bump + subscribe path)
  - **A2** — undo/redo: canvas and timeline rail both follow
  - **A3** — track switch / active-track change: runtime view follows without a stale render
  - **A4** — Studio open/close round trip: no orphaned subscription, no zombie effect after dispose
  - **A5** — `packages/efx-physic-paint` standalone entry (`./preact`) still mounts
  A4 and A5 are exactly the rows that see this phase's two failure modes (zombie subscriptions after deferred cleanups; package-entry breakage from the single-preact-copy proof). Export smoke and chunk-budget checks are release gates, not Preact gates — they do not enter this row set.

### Package peer floor (spec Q3 — CLOSED)
- **D-04:** `packages/efx-physic-paint` bumps BOTH fields in the same commit: `peerDependencies.preact` → `">=11.0.0"` (no dual-major range — clean-break law) AND `devDependencies.preact` from `^10.29.0` → the 11.x line. A peer-only bump leaves a live 10.x pin that can re-pin workspace resolution to 10 and contradict the bump. The root `pnpm.overrides.preact` (`^10.29.8` today) moves to the 11.x line as part of the bump itself. — **Reversibility:** one-way — published peer-range contract; no dual-major range left to fall back on, and the clean-break law forbids reintroducing one.

### One-preact-copy proof (RUN-02)
- **D-05:** Proven twice. (1) **Close evidence:** a documented lockfile / `pnpm why preact` measurement showing exactly one `preact` copy across app + packages. (2) **Standing pin:** a normal `.test.ts` contract test (existing vitest setup, no one-off config) asserts the root `overrides.preact` stays on the 11.x line and that no workspace package pins a second `preact` in `dependencies` / `devDependencies` / `peerDependencies`. The measurement proves today's state; the pin keeps a future install or a new workspace package from silently reintroducing a second copy. Dual-preact failures are non-obvious at runtime (two signals runtimes, zombie state) — this must fail loudly at test time.
- **D-06:** A second preact copy exists **today** (measured fact): `app/node_modules/.pnpm/preact@10.28.4` sits beside root `node_modules/.pnpm/preact@10.29.8`, under a root `overrides.preact: ^10.29.8`. RUN-02's measurement must explain this divergence and eliminate it; the contract pin must prevent its return. This is the concrete validation of D-04 (peer `>=11` AND devDep 11.x, same commit).

### Mechanical migration named work item (RUN-04)
- **D-07:** The JSX namespace reduction is a **known deterministic `tsc --noEmit` break** — name it as a work item planned against RUN-01's gate sequence so it is fixed deliberately, never discovered mid-bump. Guide clause: "Reduction in JSX namespace" — only `Element` / `IntrinsicElements` stay in `JSX`; `CSSProperties` and `Targeted*Event` move to the `preact` namespace. Affected files (verified in tree):
  - `app/src/components/shared/NumericStepper.tsx`
  - `app/src/components/shared/SliderStepper.tsx`
  - `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx`
  `JSX.Element` return-type usages stay as-is. No other file carries `JSX.*` type references.

### Guide items verified no-impact (do not carry as risk)
- **D-08:** The following Preact 11 guide items were checked against the live tree and are NO-IMPACT. Plans must not schedule work or invent risk for them:
  - auto-px — all numeric styles are unitless or `0`
  - `defaultProps` / `forwardRef` / `SuspenseList` / `Component.base` / `render()` 3rd arg — zero usage
  - Hydration 2.0 — no lazy/Suspense
  - Object.is / NaN deps — NaN only as parse sentinels
  - TS floor — `~5.9.3` already `>= 5.1`; do not jump to TypeScript 7.x
  - ESM-only — `"type": "module"` on both packages; `efx-physic-paint` publishes `.mjs` via tsup
  - `useRef` initial value — all multi-line sites already initialized (0 uninit call sites)

### Locked by requirement (not re-litigated)
- **D-09:** Target pairing is `preact@11.0.1` + `@preact/signals@2.11.3` (RUN-02). Signals 2.11.3 carries the Preact-11 deferred-dispose fix; 2.11.2 does not.
- **D-10:** `lucide-preact` bumps to `^1.57.0` (RUN-03). Peer floor for Preact 11 is `1.50.0`; the currently pinned `0.577.0` peer-range excludes 11. Spec Q2 is closed.
- **D-11:** `paintVersion` bump+subscribe discipline is preserved — NOT rewritten into effect cleanups (RUN-05). Preact 11 defers cleanups; the project deliberately does not depend on cleanup for correctness.
- **D-12:** No `useState`, no React, no new state/reaction library. No feature work, no UX change, no engine work in this phase. No React migration codemods. No new one-off test config.

### Claude's Discretion
- Probe implementation shape (file layout, how the pattern leg is mounted) is planner/executor discretion, as long as it satisfies D-01's two legs and is deleted on green.
- Commit sequencing inside the mechanical migration is executor discretion, as long as D-04's two fields land in the same commit and D-07 is fixed deliberately rather than discovered.

### Reviewed Todos (not folded)
- `261003-d08-tier-parity-harness-rescope.md` — "Retire or re-scope the D-08 tier-parity harness row to the one-pipeline contract". Matched on generic keywords only (score 0.6, area `general`); unrelated to a Preact/dependency phase. Left out of Phase 54 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec and requirements
- `SPECS/v1.1.0-preact11/context.md` — phase-importable spec: R1–R4 requirements, A1–A5 UAT rows, prohibitions, ambiguity report (Q1/Q2 resolved, Q3 closed here). The requirement text lives here — do not paraphrase it away.
- `.planning/REQUIREMENTS.md` §Runtime Foundation — RUN-01..RUN-06 as locked milestone requirements
- `.planning/ROADMAP.md` §Phase 54 — goal + four success criteria; hard gate wording before Phase 55

### Stack / compatibility research
- `.planning/research/STACK.md` §HARD GATE + §(a) Preact 11 bump — declared-GREEN peer ranges, `@preact/signals@2.11.3` deferred-dispose note, `lucide-preact` peer table (floor 1.50.0), and the measured breaking-change blast radius table
- `.planning/research/ARCHITECTURE.md` §sequencing — why 54 runs first and what its UAT unlocks

### Reactivity law (mandatory)
- `.claude/skills/efx-preact-reactivity/SKILL.md` — project reactivity discipline (idempotent store setters, identity-stable effect deps, narrow signal reads, no render-body signal writes, loop termination). RUN-05 is this law surviving the bump.
- `CLAUDE.md` §Preact — binding project instruction

### Pairing witness / sequencing lock
- `SPECS/v1.1.0-water-color/watercolor-playground/` — live pairing witness for D-01 leg (b) (already runs preact 11.0.1 + signals 2.11.3)
- `SPECS/v1.1.0-water-color/00-grill-context.md` §Sequencing lock — Preact 11 is the gate before any watercolour work

### Upstream
- Preact 11 upgrade guide (upstream) — source of the R2 breaking-change table; JSX namespace reduction clause is D-07

### Version manifests
- `package.json` — root `pnpm.overrides.preact` / `@preact/signals`
- `app/package.json` — `preact`, `@preact/signals`, `lucide-preact`
- `packages/efx-physic-paint/package.json` — `peerDependencies.preact` (line ~47) and `devDependencies.preact` (line ~64)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SPECS/v1.1.0-water-color/watercolor-playground` — already a live Preact 11.0.1 + signals 2.11.3 tree; reuse as D-01 pairing leg, do not rebuild
- Existing vitest setup (`pnpm --filter efx-motion-editor exec vitest run`) — home of the D-05 contract pin; no new config

### Established Patterns
- **paintVersion bump + subscribe** — every store setter that mutates a paint document bumps the version signal; every render effect that draws from it subscribes. 358 paintVersion/physicPaintVersion/efxPaintVersion references in tree. This pattern is what D-01 leg (a) and A1–A3 exercise.
- **compare-then-write store setters** — idempotent setters from `efx-preact-reactivity`; part of the pattern leg.
- **Workspace singletons via root `pnpm.overrides`** — the mechanism D-05 pins.

### Integration Points
- JSX type-import seams in the three D-07 files — the only mechanical type break
- `packages/efx-physic-paint` `./preact` standalone entry — A5 mount target
- Studio open/close lifecycle — A4 zombie-subscription target

### Measured tree facts (2026-10-14)
- `app/node_modules/.pnpm/preact@10.28.4` **and** `node_modules/.pnpm/preact@10.29.8` — two copies today (D-06)
- 0 uninit `useRef()` call sites; 0 `defaultProps`; `JSX.*` type refs confined to the three D-07 files
- `lucide-preact@0.577.0` currently pinned — peer-range excludes Preact 11

</code_context>

<specifics>
## Specific Ideas

- "Does signals import is not enough" — the probe must exercise the real bump+subscribe teardown shape, not a smoke import.
- The pattern leg is the real gate; the pairing leg is cheap confirmation. Do not invert that weight.
- Dual-preact failures are non-obvious at runtime (two signals runtimes, zombie state) — the one-copy contract pin must fail loudly at test time, not silently warn.
- Known compile breaks are named work items (D-07), not discoveries. The migration is mechanical and small: the two real tasks are the type-import fix (3 files) and the `lucide-preact` bump.

</specifics>

<deferred>
## Deferred Ideas

- **Wet / cuisson Studio tools** are a Phase 56 UI gray zone (aquarelle engine surface). Must not be pulled into Phase 54.
- Export smoke + chunk-budget checks — release gates, not Preact gates (D-03).
- Engine-1 spectral adoption (KRT-02) — v2.1.0, Q5-gated at milestone close.

None else — discussion stayed within phase scope.

</deferred>

---

*Phase: 54-preact-11-update*
*Context gathered: 2026-10-14*
