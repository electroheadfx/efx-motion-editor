# Phase 44: Integrated UAT + Signed Release - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 44-integrated-uat-signed-release
**Areas discussed:** UAT shape, Phase 43 handoff, publish gate, credentialed run, publish sequencing, stop-condition checking, failing-gate handling, code-change scope

---

## UAT shape

| Option | Description | Selected |
|--------|-------------|----------|
| One comprehensive pass | Single planned gate walks the full spec UAT list in sequence in the packaged app. Simplest, matches the spec's numbered list. | ✓ |
| Segmented passes | Split the 18-step spec list into focused passes (identity/icon, audio, PlayScript/loop, save/export), each its own plan. Easier to isolate a failure, but more plans. | |

**User's choice:** One comprehensive pass
**Notes:** Matches the spec's numbered list; simpler to track.

## Phase 43 handoff

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into UAT pass (Rec.) | Signed UAT plan includes verifying valid linked-loop preview/export parity AND the unresolved-loop export block on the signed/notarized app, as a first-class step. Matches ROADMAP's explicit handoff. | ✓ |
| Separate verification plan | Track the linked-loop parity + unresolved-loop export block as a separate signed-artifact verification plan. | |

**User's choice:** Fold into UAT pass (Recommended)
**Notes:** This is the signed-artifact boundary and must never be silently dropped.

## Publish gate

| Option | Description | Selected |
|--------|-------------|----------|
| Hard gate, stop cond. block (Rec.) | Publish only when all gates pass, UAT passes, verify-downloaded passes, and no release stop condition is active. Matches the spec's 'do not publish if' list. | ✓ |
| Warnings, owner decides | Treat stop conditions as warnings the owner reviews; publication proceeds unless overridden. | |

**User's choice:** Hard gate, stop condition blocks (Recommended.)

## Credentialed run

| Option | Description | Selected |
|--------|-------------|----------|
| You run release (Rec.) | User exports the 4 credential env vars in a fresh terminal and runs `bash scripts/macos-release.sh release`; agent prepares repo/gates, user reports output. Keeps credentials out of the repo and agent context. | ✓ |
| Run via this session | Agent runs the credentialed release via a `! command` in this session. Faster but credentials pass through this session's shell. | |

**User's choice:** You run release (Recommended.)
**Notes:** Aligns with locked no-cert-file-access and credential-free pipeline constraints.

## Publish sequencing

| Option | Description | Selected |
|--------|-------------|----------|
| Separate final plan (Rec.) | Final GitHub publish is a separate plan after verify-downloaded + install/launch pass, matching the v0.8.1 sequence exactly. | ✓ |
| Last step of same plan | Publish is the last step inside the same comprehensive UAT/verify plan once every prior gate passes. | |

**User's choice:** Separate final plan (Recommended.)

## Stop-condition checking

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit checklist (Rec.) | Before publish, run an explicit checklist against every 'do not publish if' stop condition (hydration, icon, audio, loop, preview/export) and record pass/fail; any failure blocks publication. | ✓ |
| Implicit via gates | Rely on gates + UAT passing as sufficient evidence no stop condition is active; no separate checklist. | |

**User's choice:** Explicit checklist (Recommended.)

## Fail-gate handling

| Option | Description | Selected |
|--------|-------------|----------|
| Stop and flag (Rec.) | If any automated gate or UAT step fails mid-release-window, stop and flag; user decides whether to fix + re-run or defer. No silent pass. | ✓ |
| Continue, note non-critical | Continue the plan and note failures; only blocking failures stop. Faster but risks shipping a red gate. | |

**User's choice:** Stop and flag (Recommended.)

## Code-change scope

| Option | Description | Selected |
|--------|-------------|----------|
| Release only; bugs deferred (Rec.) | Phase runs gates + UAT + verify-downloaded + publish only. Any functional bug in UAT is triaged: release-blocking stops publication for a follow-up fix, not a half-fix inside this phase. | ✓ |
| Allow small fixes | Allow targeted functional fixes inside this phase if UAT surfaces a real bug, as long as small and re-UAT is cheap. | |

**User's choice:** Release only; bugs deferred (Recommended.)

---

## Claude's Discretion

- Exact plan/task decomposition of the comprehensive UAT pass and gate checks, within the locked sequence.
- Which existing gate commands are re-run in which plan, provided all six gates complete before release.

## Deferred Ideas

None — discussion stayed within release scope. Functional bugs from UAT are triaged as release-blocking (stop publication, follow-up fix) or deferred.
