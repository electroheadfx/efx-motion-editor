---
phase: "55"
slug: "efx-paint-host-engine-1-host-split"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-15"
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 |
| **Config file** | `app/vitest.config.ts` (host tests collected via `../packages/efx-paint-host/src/**/*.test.ts` include) |
| **Quick run command** | `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/host-split/` |
| **Full suite command** | `pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor run typecheck` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter efx-motion-editor exec vitest run src/efx-paint/host-split/`
- **After every plan wave:** Run `pnpm --filter efx-motion-editor exec vitest run && pnpm --filter efx-motion-editor run typecheck`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 55-01-01 | 01 | 1 | HOST-03 | — | Golden fixture captured on pre-split code (D-04) | unit | `vitest run src/efx-paint/host-split/preSplitGoldenParity.test.ts` | ✅ | ✅ green |
| 55-01-02 | 01 | 1 | HOST-03 | — | Standing delta-zero parity pin (D-01/D-02/D-03) | unit | `vitest run src/efx-paint/host-split/preSplitGoldenParity.test.ts` | ✅ | ✅ green |
| 55-02-01 | 02 | 2 | HOST-01 | — | Host package scaffold + util move (traceSeed signature kept, D-25) | unit | `vitest run src/efx-paint/host-split/preSplitGoldenParity.test.ts` | ✅ | ✅ green |
| 55-02-02 | 02 | 2 | HOST-01 | — | animation/ folder move + 13-site consumer re-point (D-18, clean break) | unit | `pnpm --filter @efxlab/efx-paint-host exec vitest run` | ✅ | ✅ green |
| 55-02-03 | 02 | 2 | HOST-02 | — | toStudioStroke projection + vitest host include (D-19) | unit | `vitest run src/efx-paint/host-split/preSplitGoldenParity.test.ts` | ✅ | ✅ green |
| 55-03-01 | 03 | 3 | HOST-01, HOST-02 | — | StudioScriptEnvelope<P> opaque engine slot, fail-closed parse (D-19/R2.2) | unit | `pnpm --filter @efxlab/efx-paint-host exec vitest run src/script/payload.test.ts` | ✅ | ✅ green |
| 55-03-02 | 03 | 3 | HOST-02 | — | parseStudioScriptEnvelope named failures return null without throwing | unit | `pnpm --filter @efxlab/efx-paint-host exec vitest run src/script/payload.test.ts` | ✅ | ✅ green |
| 55-04-01 | 04 | 4 | DATA-03 | — | HOST_TICK_HZ=60 integer tick grid (D-23) | unit | `pnpm --filter @efxlab/efx-paint-host exec vitest run src/time/ticks.test.ts` | ✅ | ✅ green |
| 55-04-02 | 04 | 4 | DATA-03 | — | Uncapped cuisson mechanism (D-20), named RangeError on bad input | unit | `pnpm --filter @efxlab/efx-paint-host exec vitest run src/time/ticks.test.ts` | ✅ | ✅ green |
| 55-05-01 | 05 | 5 | HOST-01, DATA-01 | — | Host refusal codes + classifyEnvelopeParseFailure (D-09/D-11/D-13) | unit | `pnpm --filter @efxlab/efx-paint-host exec vitest run src/script/refusal.test.ts` | ✅ | ✅ green |
| 55-05-02 | 05 | 5 | DATA-01 | — | Engine-1 codec on envelope + refused-row surface (D-14/D-16) | unit | `pnpm --filter @efxlab/efx-paint-host exec vitest run src/script/refusal.test.ts` | ✅ | ✅ green |
| 55-06-01 | 06 | 6 | HOST-05, DATA-02 | — | Four named Apply refusal lines (D-11), named visible error | unit | `vitest run src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` | ✅ | ✅ green |
| 55-06-02 | 06 | 6 | HOST-05 | — | No-partial pin: every named refusal writes nothing (D-12) | unit | `vitest run src/efx-paint/host-split/hostSplitFailClosedApply.test.ts` | ✅ | ✅ green |
| 55-07-01 | 07 | 7 | HOST-04 | — | Fake engine-2 stub EngineAdapter<P> (D-06/D-08) | unit | `vitest run src/efx-paint/host-split/hostGenericityRoundTrip.test.ts` | ✅ | ✅ green |
| 55-07-02 | 07 | 7 | HOST-04 | — | A5 genericity round-trip + import-graph pin (D-05/D-07) | unit | `vitest run src/efx-paint/host-split/hostImportGraphContract.test.ts` | ✅ | ✅ green |
| 55-07-03 | 07 | 7 | HOST-04 | — | createBakeHost dispose-abort / flush-survives (D-21) | unit | `pnpm --filter @efxlab/efx-paint-host exec vitest run src/bake/bakeHost.test.ts` | ✅ | ✅ green |
| 55-08-01 | 08 | 8 | HOST-03, HOST-05, DATA-02 | — | Suite gate over 6 pins + paintVersion intact (R5.1/R1.3) | unit | `vitest run src/efx-paint/host-split/hostSplitSuiteGate.test.ts` | ✅ | ✅ green |
| 55-09-01 | 09 | 9 | HOST-01 | — | Animation residue + package-surface lock pin | unit | `vitest run src/efx-paint/host-split/hostAnimationResidueContract.test.ts` | ✅ | ✅ green |
| 55-10-01 | 10 | 10 | A2 (UAT) | — | Paint document-sound clips during scrub (GAP-55-01) | unit | `vitest run src/lib/playbackEngine.test.ts` | ✅ | ✅ green |
| 55-10-02 | 10 | 10 | A2 (UAT) | — | Source contract pin + Studio non-regression | unit | `vitest run src/lib/playbackEngine.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* — vitest 2.1.9 already installed; `app/vitest.config.ts` host include landed in 55-02.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Record/apply look parity | HOST-03 / A1 | Visual judgment of painted output | Record a stroke in Physic Paint; compare look before/after apply |
| Play-from-cursor + audible scrub | A2 | Audio perception | Scrub timeline with document sound; verify audible snippet |
| Bake survives leaving the frame | A3 | Timing/behavioral | Start bake, navigate away, return; frame is baked |
| Save/reopen replay | A4 | End-to-end behavior | Save project, reopen, verify script replays identically |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-10-15

---

## Validation Audit

| Metric | Value |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
