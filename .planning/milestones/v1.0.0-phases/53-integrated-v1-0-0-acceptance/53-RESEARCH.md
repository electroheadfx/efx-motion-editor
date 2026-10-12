# Phase 53: Integrated v1.0.0 Acceptance - Research

**Researched:** 2026-10-10
**Domain:** Release engineering — automated gates, comprehensive native UAT on a signed macOS artifact, credentialed sign/notarize, stop-condition enforcement, GitHub publish
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

- **52.3 WR-03 (overlapping-fx export ownership)** — post-v1.0.0 design decision; record BOTH options from the 52.3 review in the backlog: pin the fail-closed refusal as designed vs extend the D-08 filter. Failure mode is a fail-closed refusal ("timeline is empty" despite visible content) — no data loss; not something to rush during acceptance.
- **Phase 52 WR-04/05/06** — error-path/data-honesty items, no silent wrong output in the normal flow → post-closure quick series.
- **Pre-53 quick queue (run before Phase 53 planning/execution):** ① WR-01 52.3 gap-entry scrub guard; ② sequence-extension refusal (diagnose-first, escape hatch); ③ fond preload-gate paper-mirror read path; ④ quick-batch Phase 52 WR-01 + WR-02 + WR-03. The user owns these quicks; each prompt is written in this discussion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ACC-01 | All automated gates pass (vitest, typecheck, build, cargo test, release script preflight) | Six gate commands are fixed in the spec (`SPECS/milestone-v1.0.0-plan.md:689-696`); five of six measured GREEN this session, vitest currently exits 1 on one pre-existing failing suite (Pitfall 1 — must clear before ACC-01 can close) |
| ACC-02 | Native UAT validates the full 17-step surface (document init, legacy rejection, track CRUD, Background loops, fallback, Reveal, save/reopen, main-editor parity) | The 17 steps are enumerated verbatim in the spec (`SPECS/milestone-v1.0.0-plan.md:719-735`); D-01..D-04 fix the pass shape (single pass, HTML worksheet, §7-pair through-line, steps as armature with insertions D-04/D-12..D-16) |
| ACC-03 | Release stop conditions are all not active; signed/notarized downloaded-artifact verification passes before publication | 14 stop conditions enumerated in the spec (`SPECS/milestone-v1.0.0-plan.md:741-754`); `scripts/macos-release.sh verify-downloaded` is the credential-free verification entry point; 44-STOP-CONDITIONS.md is the recording precedent; preflight + Developer ID identity + notarytool measured present this session |
</phase_requirements>

## Summary

Phase 53 is a release-verification phase: run the six automated gates, execute one comprehensive ~25-row native UAT pass on the signed packaged app, run a credentialed user-owned sign/notarize release, verify the downloaded artifact, record the 14-item stop-conditions checklist, and publish v1.0.0 as GitHub Latest. The entire mechanical pipeline already exists and has been proven twice (v0.8.1, v0.9.0) — the encoded workflow lives in `.claude/skills/efx-motion-release/SKILL.md`, the credential-free pipeline in `scripts/macos-release.sh` (three modes: `preflight` / `release` / `verify-downloaded`, verified by reading the script this session), and the evidence shapes in the Phase 44 artifact set. No new libraries, no new architecture, no functional code.

Two findings dominate planning risk. **First, the vitest gate is currently RED** (measured this session: exit 1, one failing test file `PhysicsPaintStudioView.test.ts` — a `paintStore`↔`projectStore` circular-import init failure, already tracked as WINDOWS.md entry #90 and flagged by three recent quicks as "belongs to a dedicated quick"). ACC-01 cannot close until this clears, and D-21 forbids half-fixing it in-phase — it needs routing (pre-53 quick or an explicitly user-approved fix window) before the release gate runs. **Second, the D-03 through-line material appears to have changed:** `~/Desktop/efx-motion-editor-project-test/v1.0.0.mce` (the §7-pair 31-key project cited throughout planning) no longer exists on disk; the directory now holds `v1.0.0-2.mce` (3 real keys, 3 WebP frames, capacity 31), `1.0.0-sound.mce`, and `Untitled Project.mce`. The planner must confirm with the user which package is the pass through-line before writing worksheet rows.

The pre-53 quick queue (D-07..D-10) has landed code-complete: `260920-j5r` (scrub guard), `260920-ji7` (sequence-extension clamp, UAT approved), `260920-k34` (fond resolution, UAT approved), `260920-kov` (Reveal WR batch, 3 native UAT rows still PENDING). D-11's precondition is satisfied on the code side; kov's 3 pending rows plus j5r's pending native row should be folded into the Phase 53 worksheet (they are exactly the "poison the Reveal rows" surfaces D-11 protected).

**Primary recommendation:** plan Phase 53 as a sequence of evidence-artifact plans (gates → version bump → release/signed-UAT → verify-downloaded → stop-conditions → publish) modeled 1:1 on the Phase 44 artifact set, but add an explicit pre-gate routing decision for the failing vitest suite and a user confirmation of the D-03 test material before Wave 1 runs.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Automated gates (vitest/tsc/build/cargo/preflight) | Local toolchain (CLI) | — | Runs as plain commands on the dev machine; no app/UI involvement |
| Version single-source bump (5 surfaces) | Repo source files | Automated contract (`releaseContract.test.ts`) | Pure file edits pinned by an existing guard test; no runtime tier |
| Credentialed sign/notarize | macOS host (user-run wrapper) | Apple notary service | Credentials live only in the user's terminal session (D-22); agent never touches them |
| Native UAT pass | Packaged macOS app (user oracle) | Interactive HTML worksheet (planning artifact) | Nothing is "done" until live UAT on the packaged build passes; worksheet only records |
| Downloaded-artifact verification | macOS host (`macos-release.sh verify-downloaded`) | — | Credential-free verification of a separate download; Gatekeeper/spctl/codesign |
| Stop-conditions checklist | Planning artifact (44-STOP-CONDITIONS.md pattern) | Automated contract tests where they exist | Explicit human-recorded hard gate; evidence cited from UAT rows or existing tests |
| Publish (GitHub Latest) | `gh` CLI (Claude-prepared draft, user-published) | GitHub API | Draft + notes prepared by agent; publish decision and tag push are user actions (D-19) |

## Standard Stack

### Core

No packages are installed in this phase. The "stack" is the existing proven toolchain:

| Tool | Version (measured 2026-10-10) | Purpose | Why Standard |
|------|---------|---------|--------------|
| pnpm | 10.27.0 | workspace builds/tests | Project rule: pnpm not npm (monorepo) |
| Node.js | v24.15.0 | runtime for app/tests | Current project runtime |
| cargo | 1.93.1 | Rust tests for `app/src-tauri` | Tauri backend toolchain |
| gh CLI | 2.102.0 | release draft/publish | Proven on v0.8.1/v0.9.0; GitHub only allows `make_latest` on a published release (Phase 44 sequencing note) |
| `scripts/macos-release.sh` | frozen (read this session: `scripts/macos-release.sh:37-44` usage = `preflight` / `release` / `verify-downloaded /absolute/path`) | build/sign/notarize/staple/verify pipeline | The only supported release path; must remain unaltered |
| `efx-motion-release` skill | `.claude/skills/efx-motion-release/SKILL.md` | encoded end-to-end release workflow | Encodes every v0.8.1/v0.9.0 lesson; "Do not improvise" |
| Xcode CLT notarytool/stapler | present at `/Library/Developer/CommandLineTools/usr/bin/` (measured) | notarization submission + ticket stapling | Apple-required; preflight probes them |
| Developer ID Application identity | 1 valid identity found (measured via `security find-identity -v -p codesigning`) | code signing | Required for notarized distribution |
| Release wrapper | `~/.config/efx/scripts/efx-release-efx-motion` exists (measured) | credentialed release entry (mode 700, outside repo) | D-22 locked; credentials never enter repo/agent |

### Supporting (evidence artifacts to replicate)

| Artifact | Location | Purpose | When to Use |
|----------|----------|---------|-------------|
| Phase 44 UAT record | `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-UAT.md` (read this session — pass/fail matrix per spec step, "ALL 17 STEPS PASS") | evidence shape for the comprehensive pass | every UAT plan |
| Phase 44 stop-conditions checklist | `44-STOP-CONDITIONS.md` (read this session — per-condition table: condition, NOT ACTIVE status, evidence source; publish-confirmation ledger) | ACC-03 recording template | stop-conditions plan |
| Phase 44 gates record | `44-GATES.md` (read this session — per-gate `echo $?` exit capture, five-surface version table, stale-bundle archival) | ACC-01 evidence shape | gates plan |
| Phase 44 verify-downloaded record | `44-VERIFY-DOWNLOADED.md` (read this session — draft creation, expected `DOWNLOADED ARTIFACT PASS` ledger, install/launch steps) | downloaded verification evidence | verify plan |
| Interactive HTML worksheet | `SPECS/phase-52.2-plan16-uat-worksheet.html` (exists, 43,830 bytes, checked this session) | D-02 tracking support precedent | worksheet authoring |
| Guard tests | `app/src/releaseContract.test.ts` (11 tests, asserts 5 version surfaces + icon + DMG glob), `app/src/viteBuild.test.ts` | never weaken/override; cite in stop conditions | version bump verification |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain UAT.md record | HTML worksheet | **Rejected by D-02** — checkboxes + navigability + archived evidence |
| Full second pass on downloaded artifact | ~15-20 min covering smoke | **Rejected by D-06** — full pass already ran on the signed local bundle |
| Agent-run credentialed release | user-run wrapper | **Rejected by D-22** — credential exposure risk |

**Installation:** none — no new dependencies in this phase.

**Version verification:** no registry packages to verify; version surfaces measured this session all read `0.9.0` (`app/package.json:4` `"version": "0.9.0"` [VERIFIED: app/package.json:4], `scripts/macos-release.sh:10` `PRODUCT_VERSION="0.9.0"` [VERIFIED: scripts/macos-release.sh:10]) — the D-17 bump to 1.0.0 is work to do, and `releaseContract.test.ts` pins agreement.

## Package Legitimacy Audit

No external packages are installed or recommended in this phase.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### Sequence Diagram (locked by D-05 + skill)

```
[repo prep: README + 5-surface version bump + stale-bundle archival]
        │
        ▼
[6 automated gates, exact order, ALL green] ── fail ──► STOP & FLAG (D-21: user decides fix+rerun vs defer)
        │ green
        ▼
[USER runs ~/.config/efx/scripts/efx-release-efx-motion]  ← only credentialed step (D-22)
        │ expected: RELEASE PASS (sign, notarize Accepted, staple, Gatekeeper)
        ▼
[USER launches signed bundle/macos/*.app → one comprehensive ~25-row UAT pass (D-01)]
        │ fail: flag step # + screenshot, no in-phase fix (D-21)
        │ pass
        ▼
[gh release create v1.0.0 --draft + DMG upload + notes written BEFORE publish]
        │
        ▼
[USER downloads DMG from draft → bash scripts/macos-release.sh verify-downloaded <path>]
        │ expected: DOWNLOADED ARTIFACT PASS
        ▼
[install to Applications → normal double-click launch (no Gatekeeper prompt) → downloaded smoke (D-06)]
        │
        ▼
[stop-conditions checklist: 14/14 individually NOT ACTIVE (D-20, hard gate)]
        │ any active ──► BLOCK publication
        ▼
[USER publishes GitHub Latest → post-publish tag verification (skill §7)]
```

### Recommended Project Structure (phase artifacts)

```
.planning/phases/53-integrated-v1-0-0-acceptance/
├── 53-CONTEXT.md            # locked decisions (exists)
├── 53-RESEARCH.md           # this file
├── 53-01-PLAN.md            # gates + version bump evidence
├── 53-02-PLAN.md            # worksheet authoring (~25 rows)
├── 53-03-PLAN.md            # release + signed UAT + verify-downloaded (or split per discretion)
├── 53-GATES.md              # ACC-01 evidence (44-GATES.md shape)
├── 53-UAT.md / 53-UAT.html  # ACC-02 evidence (D-02 worksheet, archived)
├── 53-STOP-CONDITIONS.md    # ACC-03 evidence (44-STOP-CONDITIONS.md shape)
├── 53-VERIFY-DOWNLOADED.md  # downloaded verification ledger
└── 53-RELEASE.md            # publish confirmation + post-publish tag ledger
```

### Pattern 1: Evidence-artifact plan decomposition
**What:** each plan produces one durable evidence file whose shape replicates its Phase 44 counterpart.
**When to use:** every Phase 53 task.
**Example:**
```markdown
<!-- Source: .planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-GATES.md -->
REL-01-1: `pnpm --dir app exec vitest run` — exit 0 — marker: `Test Files ... passed` — <timestamp>
```

### Pattern 2: Stop conditions evidenced, never asserted
**What:** each of the 14 "do not publish if" items is recorded individually NOT ACTIVE with an evidence source (UAT row, contract test name, or gate run).
**When to use:** stop-conditions plan; D-20: "no condition passes by assertion".
**Example:**
```markdown
<!-- Source: 44-STOP-CONDITIONS.md (read this session) -->
| # | "Do not publish if" stop condition | Status | Evidence source |
| 5 | Audio drifts from Paint playback | **NOT ACTIVE** | UAT step 6 PASS — 44-UAT.md |
```

### Pattern 3: Fail-stop release window
**What:** any gate or UAT failure stops the phase; the user triages fix+re-run vs defer; fixes land as follow-up quicks, then the release phase re-runs.
**When to use:** any red during the window (D-21, skill hard rule 9).

### Anti-Patterns to Avoid
- **Fixing a UAT-discovered bug in-phase:** forbidden by D-21/skill rule 9 — release phase = zero functional code.
- **Publishing while a stop condition is active:** hard gate, no warnings-mode (skill rule 8).
- **Re-tagging after publish:** v0.8.0 lesson — tags are immutable; if retargeting is unavoidable follow the skill §7 recovery exactly.
- **Judging bundle freshness by `bundle/dmg/`:** stale DMGs linger there; judge by inner binary mtime (skill rule 6).
- **Proving CSP/package behavior on the dev server:** packaged builds only (skill rule 7).
- **Running compile-proof gates before the version bump:** Phase 44 Pitfall 8 — bump first, then gates.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Sign/notarize/staple/verify pipeline | custom shell steps | `scripts/macos-release.sh` (frozen) | Proven twice; preflight guards private-asset leakage; must remain unaltered |
| Credential handling | env exports in repo/scripts | user-run wrapper `efx-release-efx-motion` (D-22) | Credentials must never enter repo, planning files, or agent context |
| Stop-condition tracking | prose assertions | 44-STOP-CONDITIONS.md table pattern | Per-item evidence source is the audit trail; a green UAT never substitutes (44 precedent) |
| UAT tracking | plain UAT.md (D-02 says "Not a plain UAT.md") | interactive HTML worksheet (`SPECS/phase-52.2-plan16-uat-worksheet.html` pattern) | checkboxes, navigable, archived as evidence |
| Version agreement checks | manual 5-surface diff | `app/src/releaseContract.test.ts` | existing guard test; never weaken/override |
| Downloaded artifact verification | manual codesign/spctl invocations | `bash scripts/macos-release.sh verify-downloaded <path>` | credential-free, expects `DOWNLOADED ARTIFACT PASS` |
| Release notes drafting from scratch | full changelog | skill release-notes template + D-18 milestone summary | user-oriented, proven format, verification footer |

**Key insight:** every mechanical step of this release has an existing encoded or proven artifact; the phase's novelty is only the v1.0.0 content (17 spec steps + insertions) and the version number. Improvising any pipeline step reintroduces incidents that already happened (stale tag, empty notes, draft-`--latest` 422, stale DMG).

## Common Pitfalls

### Pitfall 1: The vitest gate is already RED (measured this session)
**What goes wrong:** `pnpm --dir app exec vitest run` exits 1 — `Test Files 1 failed | 258 passed | 2 skipped`, failure = `TypeError: _setPaintMarkDirtyCallback is not a function` at `app/src/stores/projectStore.ts` during module init of `src/components/physic-paint/view/PhysicsPaintStudioView.test.ts` (collection-level `paintStore`↔`projectStore` circular import). ACC-01 cannot close.
**Why it happens:** pre-existing ESM init-order cycle, reproduced at multiple bases, logged in WINDOWS.md #90 and deferred-items of quicks 261006-bdk/261006-dfy/261008-ful/261008-ig1 ("belongs to a dedicated quick — late-bind the projectStore→paintStore wiring").
**How to avoid:** route it BEFORE the release gate — a pre-53 quick (break the cycle: lazy import or move the wiring call) is the documented fix direction; alternatively the user explicitly accepts a scoped in-phase test-only fix under D-21. Do not let the gates plan discover this for the first time.
**Warning signs:** any quick SUMMARY repeating "pre-existing failure … out of scope".

### Pitfall 2: D-03 test material has drifted from the planning record
**What goes wrong:** worksheet rows reference `~/Desktop/efx-motion-editor-project-test/v1.0.0.mce` (31 keys) which no longer exists; the surviving `v1.0.0-2.mce` has 3 real keys / 3 WebP frames (capacity 31), so "§7-pair 31 keys full range" rows cannot execute as written.
**Why it happens:** the user's test packages were rebuilt/renamed during 52.x quicks (STATE.md records a `v1.0.0.mce.backup-20260922-070351` repair and later 1.0.0-sound work).
**How to avoid:** confirm the through-line package with the user during planning; if the 31-key shape is required, the plan includes re-creating/re-identifying it as a material-prep step.
**Warning signs:** any UAT row citing a path that `find` cannot locate.

### Pitfall 3: Ordering violations in the release window
**What goes wrong:** gates run against a stale version surface, or the GitHub tag lands on a commit where `package.json` still says 0.9.0 (v0.9.0 incident), or notes are empty at publish.
**Why it happens:** skipping the locked order (bump → gates; push before `gh release create`; notes before publish).
**How to avoid:** follow D-05 sequence + skill hard rules 1–2 exactly; the gates plan includes the 5-surface bump verified by `releaseContract.test.ts` before compile-proof gates run (44 Pitfall 8).

### Pitfall 4: Draft-state `--latest` 422
**What goes wrong:** `gh release edit v1.0.0 --latest` while still a draft → `HTTP 422: Latest release cannot be draft or prerelease.`
**Why it happens:** GitHub only allows `make_latest` on a published release (recorded in 44-STOP-CONDITIONS.md sequencing note).
**How to avoid:** publish first, then set latest — or use the two-step flow the Phase 44 artifact documents.

### Pitfall 5: A failing UAT step gets half-fixed in-phase
**What goes wrong:** functional code changes during the release window violate D-21/skill rule 9 and invalidate the "release-only" property.
**How to avoid:** stop-and-flag with step number + screenshot; the user triages; fixes land as follow-up quicks; the release phase re-runs from the affected point.

### Pitfall 6: Pending native-UAT debt silently dropped
**What goes wrong:** rows owed from earlier quicks (kov's 3 Reveal rows, j5r's scrub row, the audit's hide/solo native UAT, D-12 live gates ×3, D-13 46-UAT ×3, D-16 260913-05k) never get recorded and the milestone closes with unproven surfaces.
**How to avoid:** D-04/D-12..D-16 already mandate them as first-class numbered worksheet rows, not an appendix (53-CONTEXT specifics); the worksheet-authoring plan must enumerate every carried row explicitly.

### Pitfall 7: Stale bundle judging
**What goes wrong:** UAT runs against a stale `.app`.
**How to avoid:** freshness by inner binary `Contents/MacOS/efx-motion-editor` mtime post-dating the release run; archive previous-version bundles out of `target/release/bundle/` before the credentialed run (44-GATES Task 2 pattern).

## Code Examples

### Gate commands (authoritative — verbatim from the spec)
```bash
# Source: SPECS/milestone-v1.0.0-plan.md:689-696 [VERIFIED: SPECS/milestone-v1.0.0-plan.md:689-696]
pnpm --dir app exec vitest run
pnpm --dir app run typecheck
pnpm build
cargo test --manifest-path app/src-tauri/Cargo.toml
bash -n scripts/macos-release.sh
bash scripts/macos-release.sh preflight
```

### Release script modes (verbatim usage)
```bash
# Source: scripts/macos-release.sh:37-44 [VERIFIED: scripts/macos-release.sh:37-44]
bash scripts/macos-release.sh preflight
bash scripts/macos-release.sh release
bash scripts/macos-release.sh verify-downloaded /absolute/path/to/downloaded.dmg
```

### Session-measured gate baseline (2026-10-10)
```text
vitest:      EXIT 1 — 1 failed suite (PhysicsPaintStudioView.test.ts circular init) | 4805 tests passed
typecheck:   EXIT 0 — tsc --noEmit clean
pnpm build:  EXIT 0 — ✓ built in 7.74s
cargo test:  EXIT 0 — test result: ok. 21 passed; 0 failed
bash -n:     EXIT 0 — SYNTAX_OK
preflight:   EXIT 0 — PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards
```

### Version bump surfaces (5, pinned by guard test)
```text
[VERIFIED: app/package.json:4]         "version": "0.9.0"     (single source)
app/src-tauri/tauri.conf.json          "version": "0.9.0"
app/src-tauri/Cargo.toml               version = "0.9.0"
app/src-tauri/Cargo.lock               efx-motion-editor entry
[VERIFIED: scripts/macos-release.sh:10] PRODUCT_VERSION="0.9.0"
```
Agreement asserted by `app/src/releaseContract.test.ts` (11 tests; `expect(scriptProductVersion(script)).toBe(expected)` at :60).

## Runtime State Inventory

Not applicable — this is a release/verification phase, not a rename/refactor/migration. No stored-data, live-service, OS-registered, secret, or build-artifact renames are in scope. (One adjacent note: stale previous-version bundles under `app/src-tauri/target/release/bundle/` must be **archived, not deleted**, before the credentialed run — 44-GATES Task 2 pattern, not a rename.)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The four pre-53 quicks (D-07..D-10) satisfy D-11's "queue landed" precondition on the code side; kov's 3 native UAT rows and j5r's native UAT row remain PENDING and should fold into the Phase 53 worksheet | Summary | If the user considers them blocking *before* planning, planning waits on a UAT session |
| A2 | The D-03 §7-pair 31-key package must be re-identified or re-created; `v1.0.0-2.mce` (3 keys) is not it | Pitfall 2 | Worksheet rows reference nonexistent material; the pass stalls mid-execution |
| A3 | SND-07 (moved audio file surfaced as missing) can be closed inside the Phase 53 save/reopen rows, or stays open as a declared milestone gap — the checkbox law currently holds it open (261010-pze: "measured target is 64/68 with ACC-01..03 + SND-07 open") | Open Questions | Milestone audit FAIL gate may count SND-07 depending on closure criteria |
| A4 | The vitest circular-import failure is routed as a pre-53 quick (or explicit user-accepted scoped fix), not silently absorbed into the gates plan | Pitfall 1 | ACC-01 cannot close; release window starts red |
| A5 | No external packages are needed; Package Legitimacy Audit is empty | Standard Stack | none — verified by design of the phase |

## Open Questions (RESOLVED)

1. **Which on-disk package is the D-03 through-line?** — **RESOLVED:** handled by 53-03-PLAN.md's UAT pass sub-step 0 (material gate): the executor confirms the D-03 through-line `.mce` path with the user before any row runs; if the 31-key §7-pair package cannot be produced, the user explicitly approves the available material with the deviation recorded in the divergence table. 53-04-PLAN.md Task 3 reuses that confirmed file for the Finder double-click row.
   - What we know: `v1.0.0.mce` referenced throughout `.planning` no longer exists; `v1.0.0-2.mce` exists with capacity 31 but 3 real keys / 3 WebP frames (verified by reading the layer JSON this session).
   - What's unclear: whether the user holds the 31-key package elsewhere or the pass uses the current package + fresh projects.
   - Recommendation: ask during plan authoring; adjust worksheet row wording to the confirmed path.

2. **Routing of the failing `PhysicsPaintStudioView.test.ts` suite?** — **RESOLVED:** routed as a pre-53 quick (CONTEXT.md deferred queue), enforced by the 53-01-PLAN.md Task 2 precondition: the executor asserts the full vitest suite is green at HEAD and halts with CHECKPOINT REACHED if `PhysicsPaintStudioView.test.ts` fails — cleared by the pre-53 quick or a user-approved scoped fix under D-21 before any gate runs.
   - What we know: pre-existing, tracked (WINDOWS.md #90), documented fix direction (late-bind the wiring), repeatedly declared out-of-scope by quicks.
   - What's unclear: pre-53 quick vs user-accepted scoped test-only fix in the gates plan.
   - Recommendation: pre-53 quick (cleanest vs D-21 release-only rule); surface both options to the user.

3. **Does Phase 53 close SND-07?** — **RESOLVED:** yes — folded into the pass as worksheet row **R18** (moved document-sound file surfaces as missing in the modal, no silent playback) in 53-02-PLAN.md; 53-03-PLAN.md's matrix lists SND-07 as a carried first-class row that may not be dropped.
   - What we know: SND-07 checkbox open pending a formal moved-file→missing UAT row (REQUIREMENTS.md:103 `[VERIFIED: .planning/REQUIREMENTS.md:103]`).
   - What's unclear: whether the acceptance pass owns that row or a 52.5 follow-up does.
   - Recommendation: fold one explicit row into the save/reopen section of the worksheet (it is a package-native surface like D-16's).

4. **Scope of "hash-stale" pending native UAT from recent quicks beyond the carry list** — many quicks since 260924 carry "automated-ready, native UAT pending" markers; most were later approved per memory, but a full sweep is not done. — **RESOLVED:** 53-02-PLAN.md Task 2 runs the audit-uat sweep (`node .claude/gsd-core/bin/gsd-tools.cjs audit-uat`) during worksheet authoring and records the outcome in the worksheet footer — either "no additional unresolved rows" or appended numbered cards for each found row; only unresolved rows enter the pass, and none may be silently dropped.
   - Recommendation: run `gsd-audit-uat`-style sweep during worksheet authoring; only unresolved rows enter the pass.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | gates, build | ✓ | 10.27.0 | — |
| Node.js | gates, build | ✓ | v24.15.0 | — |
| cargo | cargo test gate | ✓ | 1.93.1 | — |
| gh CLI | draft/publish | ✓ | 2.102.0 | — |
| `macos-release.sh preflight` | ACC-01 | ✓ PASS (measured) | script frozen | — |
| codesign/security/notarytool/stapler (Xcode CLT) | credentialed release | ✓ (probed: `/Library/Developer/CommandLineTools/usr/bin/notarytool` resolves) | CLT | — |
| Developer ID Application identity | signing | ✓ 1 valid identity (`Developer ID Application: MARQUES Laurent (TCYJ9HH9RS)` — from `security find-identity` output this session) | — | — |
| Release wrapper `efx-release-efx-motion` | D-22 credentialed step | ✓ exists at `~/.config/efx/scripts/` | — | documented manual 4-export flow in `docs/macos-signed-release.md` |
| Apple environment file (4× `APPLE_*` exports) | credentialed release | user-owned (prompts live at wrapper) | — | — |
| GitHub repo access (`electroheadfx/efx-motion-editor`) | publish | ✓ `gh release list` works; v0.9.0 is current Latest (measured) | — | — |
| D-03 test package (§7-pair 31-key) | UAT through-line | ✗ missing at documented path | — | confirm/replace with user (Open Question 1) |
| vitest suite green | ACC-01 | ✗ 1 failing suite (Pitfall 1) | — | route fix quick (Open Question 2) |

**Missing dependencies with no fallback:**
- D-03 through-line package (needs user confirmation, not a tool).
- Green vitest gate (needs a code fix routed by the user).

**Missing dependencies with fallback:**
- Apple env file — user supplies at runtime; wrapper validates.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (config `app/vitest.config.ts`, `include: ['src/**/*.test.ts']` — read this session) |
| Config file | `app/vitest.config.ts` |
| Quick run command | `pnpm --filter efx-motion-editor exec vitest run` (config `workflow.test_command`) — never watch (CLAUDE.md) |
| Full suite command | same (the suite IS the full run); Rust side: `cargo test --manifest-path app/src-tauri/Cargo.toml` |
| Known collection gap | Vitest collects only `.test.ts` — a `.test.tsx` target runs nothing while exiting 0 (project memory: `project_vitest_collects_test_ts_only`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| ACC-01 | six gates green | automated gates | spec command block (see Code Examples) | ✅ all configs present; vitest red (Pitfall 1) |
| ACC-02 | 17-step native UAT | manual_procedural (user oracle) | worksheet walk on signed app | ✅ worksheet precedent exists (D-02) |
| ACC-03 | 14 stop conditions not active + verify-downloaded | mixed (contract tests + manual + CLI) | `bash scripts/macos-release.sh verify-downloaded <path>`; cite `releaseContract.test.ts` where applicable | ✅ script + precedent exist |

### Sampling Rate

- **Per task commit:** `pnpm --filter efx-motion-editor exec vitest run` (only for the pre-53 fix quick / version-bump verification — this phase itself lands docs only)
- **Per wave merge:** n/a (evidence-artifact plans)
- **Phase gate:** full suite + typecheck + build + cargo + `bash -n` + `preflight` all green (ACC-01) before the credentialed release

### Wave 0 Gaps

- [ ] `PhysicsPaintStudioView.test.ts` green (route per Open Question 2) — gates precondition
- [ ] D-03 through-line package confirmed/recreated — worksheet precondition
- [ ] Worksheet HTML authored from the 52.2 precedent — D-02 precondition
- [ ] No framework install needed

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — (no auth surface; Apple API creds are user-session-only) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no new surfaces | existing parsers fail-closed (PKG-04 clean break; legacy rejection row is UAT evidence) |
| V6 Cryptography | yes (signing) | Apple Developer ID + notary service via frozen script — **never hand-roll**; no certificate files ever read/opened (D-22; project memory `feedback_no_certificate_file_access`) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Apple credentials leaking into repo/agent context | Information Disclosure | user-run wrapper outside repo; env file dragged at prompt; trap-unset on exit; preflight private-asset guards (`PREFLIGHT PASS: … private-asset guards`) |
| Private key assets tracked in Git | Information Disclosure | preflight scans for `.p12`/`.p8`/`.key` in worktree; fails loud |
| Publishing a compromised/stale artifact | Tampering | verify-downloaded on a SEPARATE download + Gatekeeper normal launch + post-publish tag verification (skill §7) |
| GitHub token misuse | Elevation of Privilege | `gh` uses the user's authenticated session; draft prepared by agent, publish is a user decision (D-19) |

*(Config has no `security_enforcement: false`, so this section is included per defaults.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v0.9.0 manual release checklists | encoded `efx-motion-release` skill + frozen `macos-release.sh` | v0.8.1 → v0.9.0 | Phase 53 follows the skill verbatim; no improvisation |
| Draft `--latest` publish | publish-first, then `--latest` (two-step) | Phase 44 incident (HTTP 422) | stop-conditions/publish plan uses the two-step flow |
| Full second UAT pass on download | covering smoke (~15-20 min) after full signed-bundle pass | D-06 | halves redundant user time |

**Deprecated/outdated:**
- `SPECS/milestone-v1.0.0-plan.md` "Required coverage" bullet list (lines 698-713) predates 52.3/52.4/52.5 additions — the worksheet (Claude's discretion) should reconcile it with the current requirement set (PKG/SND rows, paint-export enumeration) rather than treating it as exhaustive.

## Sources

### Primary (HIGH confidence)
- `SPECS/milestone-v1.0.0-plan.md` §Phase 9 (lines 683-754, read this session) — gate commands, 17 UAT steps, 14 stop conditions
- `.planning/phases/53-integrated-v1-0-0-acceptance/53-CONTEXT.md` (read this session, full) — locked decisions D-01..D-22
- `.claude/skills/efx-motion-release/SKILL.md` (read this session, full) — hard rules 1-9, 7-step sequence, notes template, failure handling
- `scripts/macos-release.sh` lines 1-50 (read this session) — modes, PRODUCT_VERSION
- `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/` artifact set (44-UAT.md, 44-STOP-CONDITIONS.md, 44-GATES.md, 44-VERIFY-DOWNLOADED.md — read this session)
- `.planning/REQUIREMENTS.md` lines 86-110 (read this session) — ACC-01..03, SND-07, PKG rows
- Session measurements: gate runs, `security find-identity`, `xcrun --find`, `gh release list`, preflight PASS, test-package inspection (all commands run 2026-10-10)

### Secondary (MEDIUM confidence)
- Tauri official docs `tauri.app/distribute/sign/macos` (fetched this session) — Developer ID + `APPLE_API_*` env contract, `security find-identity -v -p codesigning`; consistent with in-repo pipeline (classify-confidence: context7 tier = MEDIUM)
- `.planning/v1.0.0-MILESTONE-AUDIT.md` (read this session) — Recommendations 1-5, carry list, fond-gate warning status
- `.planning/quick/260920-j5r|ji7|k34|kov/SUMMARY.md` (read this session) — pre-53 queue landing + pending native UAT rows

### Tertiary (LOW confidence)
- gh release draft-then-publish external best practice (classify-confidence: websearch tier = LOW) — but the decisive evidence is the in-repo Phase 44 incident record (HIGH), so the plan relies on that instead.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — toolchain measured directly; release pipeline read and executed (preflight PASS) this session
- Architecture: HIGH — sequence locked in CONTEXT D-05 and skill, both read this session; Phase 44 precedent fully documented
- Pitfalls: HIGH for Pitfalls 1/2 (measured/verified this session), MEDIUM for edge-case reoccurrence odds

**Research date:** 2026-10-10
**Valid until:** 30 days (stable toolchain; risk is repo drift — new quicks landing between research and execution)
