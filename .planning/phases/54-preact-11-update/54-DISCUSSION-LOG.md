# Phase 54: Preact 11 update - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-14
**Phase:** 54-preact-11-update
**Areas discussed:** Probe green bar, Live UAT surface, Package peer floor, One-preact-copy proof

---

## Probe green bar

| Option | Description | Selected |
|--------|-------------|----------|
| Our paintVersion pattern | Throwaway that mounts a paintVersion-style bump+subscribe render effect on Preact 11 + signals 2.11.3 and asserts teardown still works | |
| Playground pairing + teardown check | Use the watercolor playground as pairing evidence; add only a tiny teardown check | |
| Pattern probe + playground pairing | Both: the pattern probe AND a confirmation the playground pairing runs | ✓ |

**User's choice:** Pattern probe + playground pairing
**Notes:** The probe must prove two things before any bump: (a) our paintVersion bump+subscribe render-effect pattern still tears down correctly on Preact 11 + @preact/signals 2.11.3 — a signal write in an effect plus a compare-then-write store setter, the exact shape Preact 11's deferred cleanups could break; and (b) the declared-green package pairing actually runs, using the watercolor playground (preact 11.0.1 + signals 2.11.3) as the pairing witness. "Does signals import" is not enough. Stop-if-red on either leg. The pattern leg is the real gate; the pairing leg is cheap confirmation.

Follow-up question — probe disposal:

| Option | Description | Selected |
|--------|-------------|----------|
| Throwaway — delete after green | Delete the probe once both legs are green | ✓ |
| Keep pattern leg as a pin | Turn the pattern leg into a pinned vitest regression | |

**User's choice:** Throwaway — delete after green
**Notes:** Its job is to de-risk this bump, not to become a permanent test surface — a synthetic pattern pin would not exercise our real components anyway. Phase 54 stays stack-bump-only. The paintVersion teardown law is already enforced by the standing reactivity discipline plus the A1–A5 live UAT; a future Preact/signals bump re-creates the probe as its own gate.

---

## Live UAT surface

| Option | Description | Selected |
|--------|-------------|----------|
| Keep all five rows | A1 stroke · A2 undo/redo · A3 track switch · A4 Studio open/close · A5 standalone ./preact mount | ✓ |
| Core three gate, A4/A5 advisory | Gate Phase 55 on A1–A3 only | |
| Extend the row set | Add rows beyond the spec (export smoke, chunk-budget) | |

**User's choice:** Keep all five rows
**Notes:** A4 and A5 are exactly the rows that see this phase's two failure modes — zombie subscriptions after deferred cleanups, and package-entry breakage from the single-preact-copy proof. Gating on A1–A3 only would let a broken bump open Phase 55. Do not extend the set: export smoke and chunk-budget are release gates, not Preact gates.

---

## Package peer floor

| Option | Description | Selected |
|--------|-------------|----------|
| Bump floor to >=11 | peerDependencies becomes `preact: \">=11.0.0\"` | |
| Keep >=10 wide range | Leave `preact: \">=10.0.0\"` | |
| Peer >=11 + devDep aligned | Bump the peer floor AND the package's own devDependency preact to the 11.x line in the same commit | ✓ |

**User's choice:** Peer >=11 + devDep aligned
**Notes:** Bump both in the same commit: peerDependencies.preact to >=11.0.0 (no dual-major range — clean-break law) AND the package's own devDependencies.preact from ^10.29.0 to the 11.x line. Verified in tree: packages/efx-physic-paint/package.json:47 is the peer floor and :64 is the devDep pin. A peer-only bump leaves a live 10.x pin that can re-pin workspace resolution to 10 and contradict the bump — exactly the second-copy failure RUN-02 exists to prevent. Completing both fields is the law, not extra scope. The root overrides.preact (^10.29.8 today) moves to the 11.x line as part of the bump itself.

---

## One-preact-copy proof

| Option | Description | Selected |
|--------|-------------|----------|
| Lockfile measurement | Documented lockfile/pnpm-why measurement | |
| Contract test pin | A small source-scan/contract test asserting the root pnpm override | |
| Measurement + contract pin | Both: the measurement is the close evidence, and the contract test pins the override | ✓ |

**User's choice:** Measurement + contract pin
**Notes:** The documented lockfile / pnpm why preact measurement is the evidence for this phase's close — exactly one preact copy across app + packages. On top of it, a lightweight contract test asserts the root overrides.preact stays on the 11.x line and that no workspace package pins a second preact in dependencies / devDependencies / peerDependencies. The measurement proves today's state; the pin keeps a future install or a new workspace package from silently reintroducing a second copy. Dual-preact failures are non-obvious at runtime (two signals runtimes, zombie state), so this must fail loudly at test time. Keep it a normal .test.ts in the existing vitest setup — no one-off config.

---

## User-supplied migration-guide findings (recorded before write_context)

1. **Known compile break — JSX namespace reduction.** Only Element / IntrinsicElements stay in JSX; CSSProperties and Targeted*Event move to the preact namespace. Affected: `app/src/components/shared/NumericStepper.tsx`, `app/src/components/shared/SliderStepper.tsx`, `app/src/components/physic-paint/engine/PhysicsPaintCanvasMount.tsx`. JSX.Element usages stay as-is. Deterministic `tsc --noEmit` break — named as a work item so it is fixed deliberately, not discovered mid-bump.
2. **Second preact copy exists today (measured).** `app/node_modules/.pnpm/preact@10.28.4` sits under a root `overrides.preact: ^10.29.8`. RUN-02's measurement must explain this divergence and eliminate it; the contract pin must prevent its return.
3. **Guide items verified as no-impact** (auto-px, defaultProps/forwardRef/SuspenseList/Component.base/render() 3rd arg, Hydration 2.0, Object.is/NaN deps, TS floor, ESM-only, useRef initial values) — not carried as risk.
4. **Scope note:** wet / cuisson Studio tools are a Phase 56 UI gray zone and must not be pulled into 54.

---

## Claude's Discretion

- Probe implementation shape (file layout, how the pattern leg is mounted) — as long as both legs hold and the probe is deleted on green.
- Commit sequencing inside the mechanical migration — as long as the two peer/devDep fields land together and the JSX fix is deliberate.

## Deferred Ideas

- Wet / cuisson Studio tools → Phase 56 UI gray zone
- Export smoke + chunk-budget checks → release gates, not Preact gates
- Engine-1 spectral adoption (KRT-02) → v2.1.0

## Reviewed Todos (not folded)

- `261003-d08-tier-parity-harness-rescope.md` — generic-keyword match only; unrelated to a dependency phase.
