# Phase 53: Integrated v1.0.0 Acceptance - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The enforcement backstop for all v1.0.0 stop conditions: automated gates green, one comprehensive native UAT pass on the packaged/signed app (~25 rows = the spec's 17 steps + post-spec surfaces: Finder package treatment, export enumeration, the owed 260913-05k modal rows, and the absorbed carry items), credentialed signed/notarized release, downloaded-artifact verification, stop-conditions checklist, and GitHub Latest publication.

This is a **release/verification phase, not a feature phase**. No functional code lands here. The pre-53 quick queue (D-07..D-11) has already resolved the blocking defects; anything surfaced by the UAT pass is triaged release-blocking (stop publication, fix in a follow-up) or deferred — never half-fixed in-phase.

**Precondition (blocking):** the four pre-53 quicks must land before Phase 53 planning/execution — the acceptance pass would hit WR-01 and the fond gate anyway.

**In scope:** gates, the full UAT pass, version 1.0.0 bump on the contract surfaces, credentialed release (user-run), downloaded smoke, stop conditions, publish.
**Out of scope:** 52.3 WR-03 (overlapping-fx export ownership — post-v1.0.0 design decision), Phase 52 WR-04/05/06 (post-closure quick series), any functional feature or hardening code (D-15 recorded as acceptance, not implementation).

</domain>

<decisions>
## Implementation Decisions

### UAT pass shape
- **D-01:** **One comprehensive single pass** over the full ~25-row surface, executed on the packaged app in one planned gate walking the numbered list in sequence — Phase 44 D-01 pattern. A failing step can be re-run in isolation. — **Reversibility:** reversible.
- **D-02:** **Interactive HTML worksheet** as the tracking support (SPECS/phase-52.2-plan16-uat-worksheet.html precedent): checkboxes, navigable, filled during the pass, archived as evidence. Not a plain UAT.md.
- **D-03:** **Test material = the real §7-pair 31-key project** (converted to package format) as the through-line, plus **targeted fresh projects** where sections require them (document init, legacy rejection, paint-only × both orientations, mixed project).
- **D-04:** **Ordering = the spec's steps 1-17 as the armature**, with post-spec rows inserted at their natural positions: Finder package treatment (one icon, double-click) near the open/init steps; export enumeration at step 16 (compare surfaces); 260913-05k modal rows with the save/open failure surface.

### Signed-artifact depth
- **D-05:** **Release-first sequence, UAT on the signed artifact** (v0.9.0-proven): gates → credentialed release (user) → **full UAT pass on the signed local bundle** → verify-downloaded → install into Applications → downloaded smoke → stop conditions → publish. If UAT fails: fix, re-sign, re-run (builds are cheap). — **Reversibility:** reversible — the sequence order is re-runnable.
- **D-06:** **Downloaded artifact gets a covering smoke** (~15-20 min), not a second full pass: quarantine launch (clean Gatekeeper warning), §7-pair open via **Finder double-click on the `.mce` package**, paint a few strokes, save, short PNG export.

### Pre-53 quick queue (blocking items routed out — user-owned, land BEFORE Phase 53)
- **D-07:** **WR-01 (52.3) is BLOCKING → pre-53 quick.** Fresh 52.3-introduced scrub regression: gap entries carry `sequenceId:''`; scrubbing onto one calls `setActive('')` which also clears `selectedKeyPhotoId` — the sidebar loses fx properties and the export dialog silently loses "selected sequence" (visible in normal use of a paint-only project with fx inFrame > 0). Fix per the review: guard in `syncActiveSequence` — only call `setActive` when `entry.sequenceId !== ''`. RED first: scrubbing onto a gap entry preserves the prior active sequence and key-photo selection (leading gap; inter-fx gap). Evidence: `.planning/phases/52.3-paint-content-export-per-frame-compositor-enumeration/52.3-REVIEW.md` WR-01; `playbackEngine.ts:188-199`; `frameMap.ts:68`.
- **D-08:** **Sequence-extension refusal is BLOCKING → pre-53 quick, diagnose-first.** User blocked since 2026-09-14 (cannot extend an existing project's sequence length; worked around by creating within current bounds). First diagnose the exact broken path (manual out_frame edit? scrub-past-end? span beyond end?) and whether it is the 260918-o0n clamp family at sequence level; RED on the diagnosed path, minimal fix. **Escape hatch:** if the diagnosis proves this structural (out_frame management redesign, not a clamp), STOP and re-classify non-blocking with the facts on record.
- **D-09:** **Fond preload-gate → pre-53 quick.** `collectRotoPaperTextures` currently reads the doc-level fallback, so exports lose a track's custom paper (e.g. canvas1 + grain 0.45 renders as plain solid) — a preview/export parity defect on the milestone's core deliverable. RED first: export of a track with a custom paper renders THAT paper (not the doc fallback); then the minimal read-path fix (read the active-track paper mirror). Note: the milestone audit framed this as the mirror reading the fallback; the RED test defines ground truth — diagnose, don't assume.
- **D-10:** **Phase 52 WR-01 + WR-02 + WR-03 → ONE pre-53 quick-batch.** All three are normal-flow or output-correctness defects in the milestone's NAMED feature (Frames and Reveal): WR-01 stretch no-op lying (undo entry + revision bump for nothing); WR-02 multi-image reference bake resolves the source once at `canonicalStart` (frame-aligned D-15 violated — wrong images baked); WR-03 `revealCreationRequested` never reset (photo dialog permanently hijacked after first use).
- **D-11:** **Phase 53 must not start before the queue lands.** WR-01 and the fond gate are user-visible in the acceptance pass's normal flow; the quick-batch defects would poison Reveal UAT rows.

### Carry items absorbed by Phase 53
- **D-12:** **Live gates ×3 (52.1) become human-verification rows** in the pass — the phase is their designated backstop: profiler counters, live memory trace, open-time wall clock (no recorded measurement at 52.1 close). Source: `.planning/quick/260911-f2p-backfill-missing-milestone-verification-/260911-f2p-SUMMARY.md` `human_verification` + `.planning/v1.0.0-MILESTONE-AUDIT.md` Recommendation 1.
- **D-13:** **The 3 transferred 46-UAT rows are re-recorded during the pass:** async PlayScript capture (A→B), sidecar cleanup on disk, F-01 identical-content switch — or F-01 is explicitly retired with a fix. Never silently dropped (audit Recommendation 3).
- **D-14:** **DOC-05 offline reopen path proven in the pass** — project reopened without network/warm cache (package self-containment on a cold open).
- **D-15:** **D-11 LRU pinning (52.1) = FORMAL ACCEPTANCE, no code.** AR-52.1-03 recorded as permanent accepted-risk: `pin`/`unpin` are implemented and unit-tested but no production draw path calls them (user-accepted 2026-09-10); the 52.2 read-path change did not break anything. One registry line — Phase 53 stays release-only. — **Reversibility:** reversible — a future phase can wire the production draw path.
- **D-16:** **The owed 260913-05k native UAT folds as rows in the pass** — package file IO routed through Rust commands + blocking save/open failure modal (`.planning/quick/260913-05k-p0-fix-route-mce-package-file-io-through/`). Package-native surfaces; a separate quick would require its own packaged build anyway.

### Version & publish mechanics
- **D-17:** **Version bump to 1.0.0 on the contract surfaces** as part of the release plan: single source `app/package.json` → `tauri.conf.json`, `Cargo.toml`, `Cargo.lock` — agreement pinned by `app/src/releaseContract.test.ts` (REL-01 five-surface pattern). — **Reversibility:** one-way once published — the tag and GitHub release make the version public.
- **D-18:** **Release notes = milestone summary** (multi-track frames + Reveal, package format, HD runtime; major points per phase), user-oriented like previous releases — not a full changelog.
- **D-19:** **User pushes main + creates the immutable tag `v1.0.0`** (never re-tag — v0.8.0 lesson). Claude prepares the notes and the `gh` draft; the user publishes **GitHub Latest** after the downloaded smoke + stop-conditions checklist are green.
- **D-20:** **Stop conditions = hard gate.** An explicit checklist against all 14 "do not publish if" items in the milestone spec is run and recorded before publish (44-STOP-CONDITIONS.md precedent); any failure blocks publication. — **Reversibility:** reversible.
- **D-21:** **Release-only phase, stop-and-flag on failure** (carried Phase 44 D-08/D-09): any gate or UAT failure stops the release window and surfaces to the user, who decides fix + re-run or defer. UAT-discovered bugs are triaged release-blocking vs deferred — never half-fixed in-phase.
- **D-22:** **Credentialed release is user-run** (carried Phase 44 D-04): entry point = the personal wrapper `efx-release-efx-motion` (outside the repo), prompts live for the Apple environment file, runs `bash scripts/macos-release.sh release`, unsets on exit. Credentials never enter the repo, project files, or agent context. Apple signing setup follows the screenshot-guided Keychain flow; **never search or open certificate files**. The agent prepares the repo and gates; the user reports back the output. — **Reversibility:** reversible — no credential exposure.

### Claude's Discretion
- Worksheet layout, section structure, and the final row numbering/count (~25 rows assembled from spec 1-17 + the insertions in D-04/D-12..D-16).
- Plan/task decomposition of the comprehensive pass and the gate checks, within the locked sequence (gates → release → signed UAT → verify-downloaded → smoke → stop conditions → publish).
- Stop-conditions checklist artifact shape (44-STOP-CONDITIONS.md precedent) and which gate commands run in which plan.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec + requirements (authoritative WHAT)
- `SPECS/milestone-v1.0.0-plan.md` §"Phase 9 — Integrated v1.0.0 acceptance" — automated gate commands, the 17-step native UAT list, the 14 release stop conditions, and the forbidden sequence-level assumptions
- `.planning/REQUIREMENTS.md` §ACC — ACC-01 (all gates), ACC-02 (17-step native UAT), ACC-03 (stop conditions + signed/notarized downloaded-artifact verification)
- `.planning/ROADMAP.md` §"Phase 53: Integrated v1.0.0 Acceptance" — goal, success criteria, requirement links

### Release tooling (read before touching — must remain unaltered)
- `scripts/macos-release.sh` — the only supported release path; three modes `preflight` / `release` / `verify-downloaded`
- `docs/macos-signed-release.md` — credential env contract, modes, planned sequence, verify-downloaded flow
- `docs/macos-developer-id-setup.md` — Developer ID / Keychain prerequisite (user-owned)
- `.claude/skills/efx-motion-release/SKILL.md` — the encoded end-to-end signed release workflow (v0.8.1/v0.9.0 lessons)

### Release precedent (v0.9.0 Phase 44 — the direct template)
- `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-CONTEXT.md` — the locked decision set carried forward (D-01..D-09)
- `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-UAT.md` — the comprehensive-pass evidence shape
- `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-STOP-CONDITIONS.md` — the recorded stop-conditions checklist precedent
- `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-GATES.md` — gate execution evidence
- `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-VERIFY-DOWNLOADED.md` + `44-RELEASE.md` — downloaded verification + publish evidence
- `SPECS/phase-52.2-plan16-uat-worksheet.html` — the interactive HTML worksheet precedent (D-02)

### Carry evidence (what Phase 53 absorbs)
- `.planning/v1.0.0-MILESTONE-AUDIT.md` — Recommendations 1-4 and the full carry list (live gates, fond preload-gate reliance, 46-UAT transferred rows, D-11 partial)
- `.planning/quick/260911-f2p-backfill-missing-milestone-verification-/260911-f2p-SUMMARY.md` — D-11 PARTIAL verdict (AR-52.1-03), the three live gates in `human_verification`
- `.planning/phases/52.1-modern-frame-runtime-native-hd-paint/52.1-VALIDATION.md` + `52.1-SECURITY.md` — the D-11/AR-52.1-03 and T-52.1-* accepted-risk rows behind D-12/D-15
- `.planning/phases/52.3-paint-content-export-per-frame-compositor-enumeration/52.3-REVIEW.md` — WR-01 (D-07, blocking) and WR-03 (deferred, post-v1.0.0)
- `.planning/phases/46-track-local-paint-roto-playscript-state-loop-clips-and-cache/46-UAT.md` — the 3 transferred rows to re-record (D-13)
- `.planning/quick/260913-05k-p0-fix-route-mce-package-file-io-through/260913-05k-SUMMARY.md` — the owed native UAT folded as rows (D-16)

### Verification seams (existing, extend only for gaps)
- `app/src/releaseContract.test.ts` — version single-source agreement (D-17), icon array/ICNS, CSP contract
- `app/src/viteBuild.test.ts` — production-build seam (input capture, chunk budget)
- `app/src-tauri/tauri.conf.json` — `bundle.icon` (5 tracked files), version surface, beforeBuildCommand/frontendDist contract

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/macos-release.sh`: complete, credential-free, hardened pipeline (preflight / release / verify-downloaded) — reuse as-is, do not modify.
- `docs/macos-signed-release.md`: the exact credentialed release + verify-downloaded sequence already proven on v0.8.1 and v0.9.0 — reuse verbatim.
- The Phase 44 artifact set (44-UAT.md / 44-STOP-CONDITIONS.md / 44-GATES.md / 44-VERIFY-DOWNLOADED.md): the evidence shapes to replicate for v1.0.0.
- `SPECS/phase-52.2-plan16-uat-worksheet.html`: the interactive worksheet pattern for the D-02 tracking support.
- The converted §7-pair package (`~/Desktop/efx-motion-editor-project-test/v1.0.0.mce` family): the real-project through-line (D-03); the committed legacy fixtures (`app/src/efx-paint/document/__fixtures__/pre-52.2-project.mce.json` + the Phase 45 v0.9 fixture) serve the legacy-rejection row.

### Established Patterns
- **Packaged-app UAT is the user's oracle** — nothing is "done" until live UAT on the packaged build passes; the user runs the UAT, the agent orchestrates gates and evidence.
- **Packaged builds enforce CSP; dev does not** — prove CSP/package questions on packaged builds; judge bundle freshness by `app/src-tauri/target/release/bundle/macos/*.app` (and inner binary) timestamps, not `bundle/dmg/` which can hold stale DMGs.
- **Release gates ship with guard tests** — never weaken or override contract tests.
- **Version single-source** — `app/package.json` is the source; releaseContract.test.ts pins agreement across surfaces.
- **Clean-break + fail-closed** house style: the legacy-rejection UAT row (no-recourse dialog) and the block-not-degrade error surfaces are the designed behavior, not defects.
- English user-facing copy; English GSD artifacts. TDD (`tdd_mode: true`), `vitest run` (never watch).

### Integration Points
- `gh release` draft → upload DMG → publish Latest (after verify-downloaded + install/launch pass) — the v0.8.1/v0.9.0 publish seam.
- `verify-downloaded` mode takes a downloaded `.dmg` absolute path (no credentials) — the signed-downloaded artifact entry point.
- The user-run wrapper `efx-release-efx-motion` (`~/.config/efx/scripts/`, mode 700, outside the repo) — the credentialed release entry point; never in agent context.
- The pre-53 quick queue touches: `playbackEngine.ts` `syncActiveSequence` + `frameMap.ts` (WR-01 guard); the sequence out_frame/span path (sequence-extension); `collectRotoPaperTextures` (fond gate); the Reveal bake/`revealCreationRequested` paths (quick-batch).

</code_context>

<specifics>
## Specific Ideas

- The §7-pair 31-key project (full range, 31 keys) is the headline UAT material — it is the real project shape that surfaced the export enumeration blocker in 52.3 and it exercises the package format end-to-end.
- "Exported frames visually match the on-canvas composite" (WYSIWYG law, 52.3 D-05) is the acceptance bar carried into the step-16 comparison row.
- The downloaded smoke must open the §7-pair by **Finder double-click on the `.mce` package** — this is the macOS package treatment proof on the signed artifact (52.2 D-03 surface).
- Stop conditions are evidenced where possible by existing automated contract tests (cite them) and by UAT rows otherwise — no condition passes by assertion.
- The worksheet should carry the absorbed rows (live gates ×3, 46-UAT ×3, DOC-05 offline reopen, 260913-05k modal) as first-class numbered rows, not an appendix.
- D-11 acceptance is one registry line — do not build hardening code for it in this phase.

</specifics>

<deferred>
## Deferred Ideas

- **52.3 WR-03 (overlapping-fx export ownership)** — post-v1.0.0 design decision; record BOTH options from the 52.3 review in the backlog: pin the fail-closed refusal as designed vs extend the D-08 filter. Failure mode is a fail-closed refusal ("timeline is empty" despite visible content) — no data loss; not something to rush during acceptance.
- **Phase 52 WR-04/05/06** — error-path/data-honesty items, no silent wrong output in the normal flow → post-closure quick series.
- **Pre-53 quick queue (run before Phase 53 planning/execution):** ① WR-01 52.3 gap-entry scrub guard; ② sequence-extension refusal (diagnose-first, escape hatch); ③ fond preload-gate paper-mirror read path; ④ quick-batch Phase 52 WR-01 + WR-02 + WR-03. The user owns these quicks; each prompt is written in this discussion.

</deferred>

---

*Phase: 53-integrated-v1-0-0-acceptance*
*Context gathered: 2026-09-20*
