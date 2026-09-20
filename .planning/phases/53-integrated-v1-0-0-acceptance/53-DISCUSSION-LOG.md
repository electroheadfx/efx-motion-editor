# Phase 53: Integrated v1.0.0 Acceptance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-20
**Phase:** 53-integrated-v1-0-0-acceptance
**Areas discussed:** UAT pass shape, Signed-artifact depth, Owed items & open questions, Version & publish mechanics

---

## UAT pass shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single comprehensive pass | One planned gate walking the numbered list on the packaged app (Phase 44 style) | ✓ |
| Grouped multi-session sections | Thematic groups executed in separate sessions | |

**User's choice:** Single comprehensive pass
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Interactive HTML worksheet | 52.2-16 precedent — checkboxes, navigable, archived as evidence | ✓ |
| Plain UAT.md checklist | Phase 44 style | |

**User's choice:** Interactive HTML worksheet
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Real project through-line + targeted fresh | §7-pair 31-key project as the through-line; fresh projects only where sections require them | ✓ |
| Fresh projects everywhere | Isolation maximum, longer pass | |

**User's choice:** Real project through-line + targeted fresh
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Spec 1-17 + natural insertions | Spec order as armature; post-spec rows inserted at natural positions | ✓ |
| Pure spec then additions block | 17 spec steps first, additions appended | |

**User's choice:** Spec 1-17 + natural insertions
**Notes:** —

---

## Signed-artifact depth

| Option | Description | Selected |
|--------|-------------|----------|
| Full local + smoke downloaded | Full ~25-row pass on the signed local bundle; downloaded gets verify-downloaded + install + smoke | ✓ |
| Full pass twice | Complete pass on both local and downloaded install | |
| Full on downloaded only | Single pass only after download — problems found late | |

**User's choice:** Full local + smoke downloaded (v0.9.0-proven split)
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Covering smoke | Quarantine launch + .mce double-click open + paint + save + short export (~15-20 min) | ✓ |
| Minimal smoke | Quarantine launch + open + visual check only (~5 min) | |
| Planner decides | Detail deferred to planning | |

**User's choice:** Covering smoke
**Notes:** —

---

## Owed items & open questions

| Option | Description | Selected |
|--------|-------------|----------|
| Fold as 53 UAT rows | 260913-05k (package IO via Rust + blocking save/open modal) becomes rows in the pass | ✓ |
| Separate quick first | Run 260913-05k as its own quick before Phase 53 | |

**User's choice:** Fold as 53 UAT rows
**Notes:** Package-native surfaces; a separate quick would need its own packaged build anyway.

| Option | Description | Selected |
|--------|-------------|----------|
| Excluded, post-v1.0.0 follow-ups | 52.3 WR-01/WR-03 stay out | |
| Blocking for v1.0.0 | One or both to be decided before release | (split) |

**User's choice (free text):** WR-01 is BLOCKING — fresh 52.3-introduced scrub regression: gap entries carry `sequenceId:''`; scrubbing onto one calls `setActive('')` which also clears `selectedKeyPhotoId` (sidebar loses fx properties; export dialog loses "selected sequence"). Visible in normal use (paint-only project with fx inFrame > 0). Fix = guard in `syncActiveSequence` (`only setActive when entry.sequenceId !== ''`) + test — routed as a **pre-53 quick** (prompt written by the user in-session; `playbackEngine.ts:188-199`, `frameMap.ts:68`). WR-03 stays post-v1.0.0: design-model edge case, fail-closed refusal, no data loss; both review options recorded for the backlog.
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Not blocking | Sequence-extension bug stays a later quick | |
| Blocking for v1.0.0 | Joins the pre-53 quick queue | ✓ |

**User's choice (free text):** BLOCKING — user blocked since 2026-09-14 (cannot extend an existing project's sequence length; worked around by creating within current bounds). Pre-53 quick, diagnose-first (manual out_frame edit? scrub-past-end? span beyond end? 260918-o0n clamp family at sequence level), RED on the diagnosed path, minimal fix. Escape hatch: if structural, STOP and re-classify non-blocking with the facts.
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Quick pre-53 | Fond fix lands before Phase 53; phase stays release-only | ✓ |
| Exception in 53 | Functional fix inside the phase | |
| Cold-start test only | No fix; prove current behavior via an export cold-start test | |

**User's choice (free text):** Quick pre-53 — `collectRotoPaperTextures` currently reads the doc-level fallback, so exports lose a track's custom paper (canvas1 + grain 0.45 renders as plain solid) — preview/export parity defect on the milestone's core deliverable. RED first: export of a track with a custom paper renders THAT paper; then the minimal read-path fix (active-track paper mirror). Note: the audit framed the direction oppositely — the RED test defines ground truth.
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Live gates ×3 | 52.1 profiler counters, live memory trace, open-time wall clock as human-verification rows | ✓ |
| 46-UAT rows ×3 | Async PlayScript capture, sidecar cleanup, F-01 identical-content switch re-recorded (or F-01 retired) | ✓ |
| DOC-05 offline reopen | Cold open without network/warm cache proven in the pass | ✓ |
| D-11 LRU pinning | Hardening (wire production draw path) — later narrowed to formal acceptance | ✓ |

**User's choice:** All four absorbed
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| Formal acceptance | D-11 recorded as permanent accepted-risk (AR-52.1-03); no code | ✓ |
| Production wiring | Wire pin/unpin into a production draw path (functional exception) | |

**User's choice:** Formal acceptance
**Notes:** Phase 53 stays release-only.

| Option | Description | Selected |
|--------|-------------|----------|
| Stay deferred | Phase 52 WR-01..WR-06 remain post-closure | |
| Some pre-53 | Selected items join the pre-53 queue | ✓ |

**User's choice (free text):** Phase 52 WR-01 (stretch no-op lying with undo entry + revision bump), WR-02 (multi-image reference bake resolves the source once at `canonicalStart` — frame-aligned D-15 violated, wrong images baked), WR-03 (`revealCreationRequested` never reset — photo dialog permanently hijacked after first use) join the pre-53 queue as **ONE quick-batch** — normal-flow/output-correctness defects in the milestone's NAMED feature. WR-04/05/06 stay deferred (error-path/data-honesty, no silent wrong output).
**Notes:** —

---

## Version & publish mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| UAT on signed artifact | Gates → credentialed release → full UAT on signed local bundle → verify-downloaded → install → smoke → stop conditions → publish (v0.9.0-proven) | ✓ |
| UAT first, sign after | Full pass on a local unsigned packaged build first | |

**User's choice:** UAT on the signed artifact
**Notes:** If UAT fails, fix and re-sign — builds are cheap.

| Option | Description | Selected |
|--------|-------------|----------|
| Milestone summary | Multi-track frames + Reveal, package format, HD runtime; per-phase major points | ✓ |
| Full changelog | Exhaustive commit/PR list | |
| Summary + condensed changelog | Both | |

**User's choice:** Milestone summary
**Notes:** —

| Option | Description | Selected |
|--------|-------------|----------|
| User pushes/tags, publish after gates | User pushes main + creates immutable tag v1.0.0; Claude prepares notes + gh draft; user publishes Latest | ✓ |
| Claude prepares all, user pushes | Tag/publication prepared as soon as gates pass | |

**User's choice:** User pushes/tags, publish after gates
**Notes:** Never re-tag (v0.8.0 lesson).

---

## Claude's Discretion

- Worksheet layout, section structure, and the final row numbering/count (~25 rows; spec 1-17 + insertions).
- Plan/task decomposition within the locked release sequence.
- Stop-conditions checklist artifact shape and gate-command-to-plan mapping.

## Deferred Ideas

- 52.3 WR-03 (overlapping-fx export ownership) — post-v1.0.0; record BOTH review options in the backlog (pin the fail-closed refusal as designed vs extend the D-08 filter).
- Phase 52 WR-04/05/06 — post-closure quick series.
- Pre-53 quick queue (user-owned): ① WR-01 52.3 gap-entry scrub guard; ② sequence-extension diagnose-first; ③ fond preload-gate paper-mirror fix; ④ quick-batch 52 WR-01+WR-02+WR-03.
