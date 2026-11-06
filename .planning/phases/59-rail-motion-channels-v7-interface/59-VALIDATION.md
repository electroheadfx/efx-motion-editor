---
phase: "59"
slug: "rail-motion-channels-v7-interface"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-06"
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^2.1.9 |
| **Config file** | `app/vitest.config.ts` — `include: ['src/**/*.test.ts', '../packages/efx-paint-host/src/**/*.test.ts']` |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run` |
| **Rust parity (if required)** | `cargo test --manifest-path app/src-tauri/Cargo.toml` (verify manifest path before use) |
| **Estimated runtime** | ~90 seconds (full suite) |

**Collection trap:** only `.test.ts` is collected. A `.test.tsx` file runs nothing and exits 0. Every new test in this phase must be `.test.ts`; UI contracts use source-string pins, not rendered TSX.

**Watch mode is forbidden** — always `vitest run`.

---

## Sampling Rate

- **After every task commit:** targeted new test file; plus the full suite when the change touches shared revision/compositor code.
- **After every plan wave:** `pnpm --filter efx-motion-editor exec vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

> Seeded by plan-phase. Task rows are filled as PLAN.md files are finalized.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | — | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `app/src/components/physic-paint/roto/railMotionModel.test.ts` — validation, canonical order, conditional write, round-trip (MOTN-12, REL-02)
- [ ] `app/src/components/physic-paint/roto/railMotionIdentity.test.ts` — Gate B identity truth table (MOTN-01, MOTN-11)
- [ ] `app/src/components/physic-paint/roto/railMotionEvaluator.test.ts` — channels, curves, endpoints, unbounded rotation, wiggle determinism (MOTN-03/05/06/09/10)
- [ ] `app/src/components/physic-paint/roto/railMotionRevision.test.ts` — revision/carrier assertions, no sampled-value cache terms (REL-03)
- [ ] `app/src/efx-paint/compositor/efxPaintCompositorRailMotion.test.ts` — both draw sites, identity fast path, opacity multiply, transform math (MOTN-07/08)
- [ ] `app/src/lib/railMotionExportParity.test.ts` — sub-frame integer content + fractional transform (REL-04)
- [ ] `app/src/components/physic-paint/view/TimelineMotionChannels.test.ts` — source-string pins for MUI-01/02/03/04/05
- [ ] Rust parity fixture in `app/src-tauri/src/services/script_library.rs` tests — railKind + rail-motions ordinal parity (REL-02 / Pitfall 9)

*(No framework install needed — existing infrastructure covers revision, round-trip, and source-string pinning patterns; the gaps are new files, not new tooling.)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| v7 chrome fidelity against the exported reference | MUI-02, MUI-03, MUI-05 | Visual contract (18px lanes, 6×6 keys, outline, header alignment) needs native inspection | Compare the live Studio timeline against `SPECS/v2.1.0-motion-channels/reference/section-01-motion-channels.png` |
| Active-track edit/Play/export pixel parity | MOTN-08 | Requires the packaged/native renderer | Play the same frame on the active track, pause, export; compare frames |
| Motion-blur export paint retention | REL-04 | Export pipeline is native | Export a motion-blurred range; confirm paint is present on every frame |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
