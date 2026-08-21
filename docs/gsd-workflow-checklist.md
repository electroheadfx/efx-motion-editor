# GSD Workflow Checklist — EFX Motion Editor

Canonical journey for every milestone, learned from the v0.9.0 cycle. The mid-milestone steps **secure-phase** and **validate-phase** and the end-of-milestone **audit → summary** sequence are the ones that were forgotten in practice — do not skip them.

## 1. Milestone setup

- [ ] `/gsd-new-milestone` — requirements + roadmap
- [ ] (optional) `/gsd-review-backlog` — promote deferred items

## 2. Per phase (repeat for each phase)

1. [ ] `/gsd-discuss-phase N` — lock the gray-area decisions (Kimi K3)
2. [ ] `/gsd-ui-phase N` — frontend phases only (UI-SPEC contract)
3. [ ] `/gsd-plan-phase N` — research → plan → plan-check
4. [ ] `/gsd-execute-phase N` — waves with tracer checkpoints
5. [ ] `/gsd-verify-work N` — **native UAT, user oracle** — nothing is "done" until it passes (say "automated-ready")
6. [ ] `/gsd-secure-phase N` — threat verification ⚠ often forgotten
7. [ ] `/gsd-validate-phase N` — Nyquist coverage audit ⚠ often forgotten

## 3. Quick work (any time)

- `/gsd-quick` — bounded tasks, atomic commits, same UAT discipline
- `/gsd-debug` — systematic bugs; never pivot a debug into a phase midstream

## 4. Milestone closure (in order)

1. [ ] `/gsd-audit-milestone vX.Y.Z` — requirements, integration seams, Nyquist gaps
2. [ ] Fix the gaps (validate-phase runs, deferred UAT re-runs)
3. [ ] **Final release phase** — follow the `efx-motion-release` skill:
   - README + 5-surface version bump + icon contract
   - 6 automated gates green
   - credentialed release via `efx-release-efx-motion` (user-run)
   - signed packaged-app UAT (one pass, user oracle)
   - draft release + **notes before publish**
   - verify-downloaded + install + normal launch
   - stop-condition checklist (hard gate) → publish as Latest
   - **post-publish tag check**: the tag must point at the release commit (`main` pushed first)
4. [ ] `/gsd-audit-milestone vX.Y.Z` re-run — must reach full score
5. [ ] `/gsd-milestone-summary vX.Y.Z` ⚠ often forgotten
6. [ ] `/gsd-complete-milestone vX.Y.Z` — archive

## 5. Housekeeping

- Push `main` regularly — GitHub creates release tags on the **remote** default branch
- Native UAT evidence: summarized thresholds + visual confirmation are sufficient
- GSD bugs (not project bugs): draft an open-gsd issue per the `gsd-guide` skill pipeline
