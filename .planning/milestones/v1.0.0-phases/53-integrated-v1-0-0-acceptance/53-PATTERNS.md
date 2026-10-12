# Phase 53: Integrated v1.0.0 Acceptance - Pattern Map

**Mapped:** 2026-10-10
**Files analyzed:** 13 (7 evidence/planning artifacts to create, 5 version-bump surfaces to modify, 1 conditional fix routed out)
**Analogs found:** 13 / 13

## File Classification

This is a release/verification phase: the "code" is evidence artifacts (markdown ledgers + one interactive HTML worksheet) plus a mechanical 5-surface version bump. Data-flow labels below are adapted: `evidence-record` = write-once human-recorded ledger; `config-bump` = atomic multi-file version edit pinned by a guard test; `interactive-state` = browser-localState worksheet with JSON export.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `53-01-PLAN.md` (gates + version bump) | config | config-bump | `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-01-PLAN.md` | exact |
| `53-02-PLAN.md` (worksheet authoring + UAT pass) | config | evidence-record | `44-02-PLAN.md` (same dir) | exact |
| `53-03-PLAN.md` (release + verify + stop conditions + publish) | config | evidence-record | `44-03-PLAN.md` (same dir) | exact |
| `53-GATES.md` | evidence record | evidence-record | `44-integrated-uat-signed-release/44-GATES.md` | exact |
| `53-UAT.html` (interactive worksheet, D-02) | component (static HTML) | interactive-state | `SPECS/phase-52.2-plan16-uat-worksheet.html` (⚠ gitignored — see note) | exact |
| `53-UAT.md` (archived pass verdict record) | evidence record | evidence-record | `44-integrated-uat-signed-release/44-UAT.md` | exact |
| `53-STOP-CONDITIONS.md` | evidence record | evidence-record | `44-integrated-uat-signed-release/44-STOP-CONDITIONS.md` | exact |
| `53-VERIFY-DOWNLOADED.md` | evidence record | evidence-record | `44-integrated-uat-signed-release/44-VERIFY-DOWNLOADED.md` | exact |
| `53-RELEASE.md` (publish ledger + notes) | evidence record | evidence-record | `44-integrated-uat-signed-release/44-RELEASE.md` | exact |
| `app/package.json` (version) | config | config-bump | `44-GATES.md` Task 1 table (atomic 5-surface bump, commit `d66feaf8`) | exact |
| `app/src-tauri/tauri.conf.json` (version) | config | config-bump | same | exact |
| `app/src-tauri/Cargo.toml` (version) | config | config-bump | same | exact |
| `app/src-tauri/Cargo.lock` (root package block only) | config | config-bump | same | exact |
| `scripts/macos-release.sh:10` (`PRODUCT_VERSION` only) | config | config-bump | same | exact |
| README release section (before closure) | docs | config-bump | skill hard rule 3 (`.claude/skills/efx-motion-release/SKILL.md:15`) | role-match |
| `PhysicsPaintStudioView.test.ts` circular-import fix | test | — | **routed OUT** — pre-53 quick per research Pitfall 1 / Open Question 2 | no analog needed |

**Tracked-source gate:** all Phase 44 analogs, `app/src/releaseContract.test.ts`, `scripts/macos-release.sh`, and `.claude/skills/efx-motion-release/SKILL.md` are git-TRACKED (verified with `git ls-files`). **Exception:** `SPECS/phase-52.2-plan16-uat-worksheet.html` is under `.gitignore:47 (SPECS)` — zero SPECS files are tracked. It is stable local project source (not a sync mirror), so it is safe as a structural precedent, but the planner must NOT treat any SPECS path as a tracked anchor; the tracked evidence-shape analogs are the Phase 44 artifact set.

## Pattern Assignments

### `53-GATES.md` (evidence record, evidence-record)

**Analog:** `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/44-GATES.md` (tracked, 71 lines — full file is the template)

**Header pattern** (44-GATES.md:1-6):
```markdown
# Phase 44 — REL-01 Automated Gate Evidence Record

**Date:** 2026-08-21
**Commit under test:** `d66feaf8` (chore(release): bump product version to 0.9.0)
**Gate order:** locked D-03 order — compile-proof gates run only AFTER the contract-stable 0.9.0 bump (Pitfall 8 satisfied).
**Evidence policy:** every exit status was captured fresh this session via `echo "GATE<N>_EXIT=$?"` after each command — never assumed or reused from a prior session.
```

**Version-bump table pattern** (44-GATES.md:12-22 — replicate with `1.0.0` values):
```markdown
| Surface | File:Line | Value |
|---------|-----------|-------|
| Single source of truth | `app/package.json:4` | `"version": "1.0.0"` |
| Tauri config | `app/src-tauri/tauri.conf.json:4` | `"version": "1.0.0"` |
| Cargo package | `app/src-tauri/Cargo.toml:3` | `version = "1.0.0"` |
| Cargo.lock root package | `app/src-tauri/Cargo.lock:<line>` (efx-motion-editor block only) | `version = "1.0.0"` |
| Release script | `scripts/macos-release.sh:10` | `PRODUCT_VERSION="1.0.0"` |

`pnpm --dir app exec vitest run src/releaseContract.test.ts` → **11 tests passed**
(single-source agreement oracle; `releaseContract.test.ts:53-61` asserts all five surfaces equal `packageJson.version`).
```

**Six-gate line pattern** (44-GATES.md:43-48 — one line per gate, verbatim commands from `SPECS/milestone-v1.0.0-plan.md:689-696`):
```markdown
REL-01-1: `pnpm --dir app exec vitest run` — exit 0 — marker: `Test Files ... passed` — <timestamp>
REL-01-2: `pnpm --dir app run typecheck` — exit 0 — marker: `tsc --noEmit` completed, no errors — <timestamp>
REL-01-3: `pnpm build` — exit 0 — marker: `✓ built in <n>s` — <timestamp>
REL-01-4: `cargo test --manifest-path app/src-tauri/Cargo.toml` — exit 0 — marker: `test result: ok. <n> passed; 0 failed` — <timestamp>
REL-01-5: `bash -n scripts/macos-release.sh` — exit 0 — marker: clean parse — <timestamp>
REL-01-6: `bash scripts/macos-release.sh preflight` — exit 0 — marker: `PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards` — <timestamp>
```

**Hard-boundaries footer** (44-GATES.md:62-71 — copy verbatim, adjust version):
```markdown
- No Apple credential file accessed, opened, or searched.
- No global version replace in Cargo.lock (only the `efx-motion-editor` root package block changed).
- No modification of `scripts/macos-release.sh` beyond line 10 (`PRODUCT_VERSION="1.0.0"`).
- No functional source file changed (the only repo file edits are the five version surfaces + this evidence record).
```

**Stale-bundle archival (Task 2)** — 44-GATES.md:26-37: archive previous-version bundles to `app/src-tauri/target/release/bundle/archive-v0.9.0-<date>/` (NOT delete), then prove `bundle/macos/` holds zero `.app` and `bundle/dmg/` zero `*_0.9.0_*.dmg` before the credentialed run.

---

### `53-UAT.html` (component, interactive-state) — the D-02 worksheet

**Analog:** `SPECS/phase-52.2-plan16-uat-worksheet.html` (43,830 bytes; gitignored SPECS precedent — structural copy only)

**Overall structure to copy:**
- `<title>` + FR/EN bilingual `<span class="lang-fr">…</span><span class="lang-en">…</span>` pairs toggled by `data-lang` on `<body>` (line 6, throughout)
- Progress card: `progress-count` + `progress-fill` bar (lines 150-158)
- META card with text inputs: fresh `.app` path, commit, §7-pair package path (REQUIRED), fixture path (lines 165-187) — for 53: also the D-03 through-line package path (research Open Question 1 must be resolved first)
- One `<section class="card" id="card-Rn">` per row: badges → `<h2>` title → `why` paragraph → `<ol class="steps">` → `alert ok` (expected) → `alert warn` (trap/FAIL guidance) → checkbox `.checks` → PASS/FAIL/NA verdict radios → comment `<textarea id="cm-Rn">` (lines 189-219)

**Row skeleton** (worksheet lines 189-219, abridged):
```html
<section class="card" id="card-R1">
  <div class="badges"><span class="badge row">R1</span><span class="badge">SPEC STEP 1</span><span class="badge">BUNDLE ONLY</span></div>
  <h2><span class="lang-fr">…</span><span class="lang-en">…</span></h2>
  <p class="why">…</p>
  <h3><span class="lang-fr">Étapes</span><span class="lang-en">Steps</span></h3>
  <ol class="steps"> <li>…</li> </ol>
  <div class="alert ok"><span class="lang-en"><b>Expected:</b> …</span></div>
  <div class="checks">
    <label><input type="checkbox" id="R1-c1"><span>…</span></label>
  </div>
  <div class="verdict">
    <label><input type="radio" name="v-R1" value="pass">…</label>
    <label><input type="radio" name="v-R1" value="fail">…</label>
    <label><input type="radio" name="v-R1" value="na">…</label>
  </div>
  <div class="field"><textarea id="cm-R1" placeholder="…"></textarea></div>
</section>
```

**State/export script pattern** (worksheet lines 373-417):
```javascript
(function () {
  'use strict';
  var KEY = 'efx-53-uat';                 // namespaced localStorage key
  var ROW_IDS = ['R1', /* … ~25 rows … */];
  var CHECKS = { R1: ['c1','c2','c3','c4'], /* … */ };
  var META_IDS = ['meta-app', 'meta-commit', 'meta-pair', 'meta-fixture'];
  function collectState() { /* meta + per-row verdict/checks/comment + free-notes */ }
  // … auto-save to localStorage, JSON report download (drop-in /tmp), toast feedback
})();
```
Footer instructions (lines 160-163): user downloads the JSON report into `/tmp` and hands it to the GSD session — keep this contract for 53.

**Row inventory for 53 (Claude's discretion per D-04):** spec steps 1-17 as the armature + insertions: Finder package treatment near open/init; export enumeration at step 16; 260913-05k modal rows with save/open failure (D-16); live gates ×3 (D-12); 46-UAT ×3 (D-13); DOC-05 offline reopen (D-14); kov's 3 pending Reveal rows + j5r's scrub row (research Pitfall 6); optionally SND-07 (Open Question 3).

---

### `53-UAT.md` (evidence record, evidence-record)

**Analog:** `44-integrated-uat-signed-release/44-UAT.md` (tracked, 80 lines)

Note: D-02 says tracking support is the HTML worksheet "not a plain UAT.md" — `53-UAT.md` is only the final archived verdict record (the 44-UAT shape), complementing the worksheet, not replacing it.

**Header** (44-UAT.md:10-17): artifact under test path, DMG path, **freshness** (inner binary mtime postdating the release run), oracle = shipped English labels, mode = one comprehensive pass, Result line.
**Pass/fail matrix** (44-UAT.md:21-39):
```markdown
| # | Spec step | Expected-outcome marker | Result |
|---|-----------|-------------------------|--------|
| 1 | <step text> | <shipped-English expected marker> | **PASS** |
```
**Divergence recording** (44-UAT.md:64-69): spec-vs-implementation table with "recorded, NOT fixed — release-only phase" judgment.
**User approval + hard boundaries** (44-UAT.md:71-80): user approval statement, then: no functional source changed, no credential file accessed, no dev server, no Vitest watch.

---

### `53-STOP-CONDITIONS.md` (evidence record, evidence-record)

**Analog:** `44-integrated-uat-signed-release/44-STOP-CONDITIONS.md` (tracked, 65 lines)

**Header** (lines 1-6): source of truth = `SPECS/milestone-v1.0.0-plan.md` lines 741-754 (14 items), "checklist is SEPARATE from the UAT pass; a green UAT never substitutes", recorded-before-publish date.
**Checklist table** (lines 10-26):
```markdown
| # | "Do not publish if" stop condition | Status | Evidence source |
|---|------------------------------------|--------|-----------------|
| 1 | <verbatim spec condition> | **NOT ACTIVE** | UAT step N PASS — 53-UAT.md / `releaseContract.test.ts` <test name> |
```
**Verdict + publish confirmation** (lines 28-52): "ZERO active stop conditions" verdict; human publish decision checklist; verification ledger table (`gh api …/releases/latest --jq .tag_name`, `gh release list --limit 3 --json tagName,isLatest`, isDraft, isPrerelease, DMG asset name).
**Sequencing note** (lines 54-65): the draft-`--latest` HTTP 422 record → two-step flow `gh release edit v1.0.0 --draft=false` then `--latest` (skill §6).

---

### `53-VERIFY-DOWNLOADED.md` (evidence record, evidence-record)

**Analog:** `44-integrated-uat-signed-release/44-VERIFY-DOWNLOADED.md` (tracked, 89 lines — actually contains the RELEASE ledger; and `44-RELEASE.md` contains downloaded verification — **the two files' contents are swapped relative to their names in Phase 44**; read both and assign by content, not filename)

Content to replicate (from the downloaded-verification file):
1. Draft creation section — `gh release create v1.0.0 --draft --title "EFX Motion Editor v1.0.0" app/src-tauri/target/release/bundle/dmg/*_1.0.0_*.dmg`; note GitHub converts spaces → dots in asset names.
2. verify-downloaded contract block:
```bash
bash scripts/macos-release.sh verify-downloaded /absolute/path/to/EFX.Motion.Editor_1.0.0_aarch64.dmg
# expected: DOWNLOADED ARTIFACT PASS
```
3. Install + normal launch steps (drag to Applications, plain double-click, no Gatekeeper bypass, icon on downloaded surface).
4. Results checkboxes + verbatim output ledger + user confirmation.

Release-ledger content (from the other 44 file) belongs in `53-RELEASE.md`: pre-conditions table (preflight, zero stale bundles, wrapper exists, 5 surfaces at 1.0.0), user-run wrapper description, RELEASE PASS ledger table (notarization Accepted, stapler PASS), freshness table (inner binary mtime ≥ release run — NEVER `bundle/dmg/`), notarization evidence JSON fields.

---

### `53-RELEASE.md` (evidence record, evidence-record) — publish ledger

**Analog:** `44-integrated-uat-signed-release/44-RELEASE.md` (downloaded-verification content) + skill §5-§7 for the publish sequence.

**Release notes = skill template** (`.claude/skills/efx-motion-release/SKILL.md:91-105`, tracked):
```markdown
## What shipped

### <Headline feature 1>   <!-- 53: multi-track frames + Reveal; package format; HD runtime (D-18 milestone summary) -->
### <Headline feature 2>
...

---

**Release verification:** signed and notarized with Apple Developer ID; passed Gatekeeper assessment, downloaded-artifact verification, and normal launch without security overrides.
```
Publish sequence (skill lines 60-89): notes into draft BEFORE publish → stop conditions green → `gh release edit v1.0.0 --draft=false --latest` → post-publish tag verification (`git ls-remote --tags origin v1.0.0` + `git show v1.0.0:app/package.json | grep version`).

---

### Version-bump surfaces (config, config-bump)

**Analog:** `44-GATES.md` Task 1 (above) + the guard test itself.

**Guard test** — `app/src/releaseContract.test.ts:53-61` (tracked; never weaken/override):
```typescript
it('all product-owned version surfaces agree with app/package.json (single source)', () => {
  const expected = packageJson.version;
  expect(tauriConfig.version, 'tauri.conf.json version').toBe(expected);
  expect(cargoTomlPackageVersion(cargoToml), 'Cargo.toml package version').toBe(expected);
  expect(cargoLockPackageVersion(cargoLock, 'efx-motion-editor'), 'Cargo.lock efx-motion-editor version').toBe(expected);
  expect(scriptProductVersion(script), 'PRODUCT_VERSION in scripts/macos-release.sh').toBe(expected);
});
```
Bump rules extracted from 44-GATES + skill §1:
- Edit `app/package.json:4` first (single source), then the other four to match.
- `Cargo.lock`: change ONLY the `efx-motion-editor` root package block — never global replace.
- `scripts/macos-release.sh`: ONLY line 10 `PRODUCT_VERSION="…"` — the pipeline stays frozen.
- Verify: `pnpm --dir app exec vitest run src/releaseContract.test.ts` (the `app/` prefix in the path resolves to no files — use `src/releaseContract.test.ts` per 44-GATES.md:24 note; 11 tests).
- Order: bump BEFORE compile-proof gates (44 Pitfall 8), in one atomic commit.
- Also: README release section update (skill hard rule 3) and stale-bundle archival (skill §1).

---

### Plan files `53-01/02/03-PLAN.md` (config, evidence-record)

**Analog:** `44-01-PLAN.md` / `44-02-PLAN.md` / `44-03-PLAN.md` (tracked, 213/205/242 lines). Each plan is GSD-standard (Requirements/Actions/Tasks) but the Phase 44 plans show the evidence-artifact decomposition: each plan's Tasks end by producing its named artifact, with agent-side credential-free steps separated from user-owned steps (44-02 Task 1 = agent preconditions; user run = D-04). Copy the Task split, not literal content.

## Shared Patterns

### Fail-stop release window (applies to ALL plans)
**Source:** `.claude/skills/efx-motion-release/SKILL.md:10-20,107-111` (tracked)
```markdown
9. **Release phase = zero functional code changes.** A UAT bug stops the phase; the fix lands in
   a follow-up quick/debug, then the release phase re-runs.
Any gate/UAT failure mid-window: stop and flag (step number + evidence). The user decides
fix-and-rerun or defer. No silent pass.
```
Apply to: every 53 plan — gates, UAT, verify, stop-conditions, publish.

### Sequence lock (applies to plans 01→03)
**Source:** SKILL.md sequence §1-§7 + CONTEXT D-05: bump → gates → user credentialed release → signed UAT → draft+notes → verify-downloaded → install/smoke → stop conditions → publish → post-publish tag check. Push `main` BEFORE `gh release create` (hard rule 1 — v0.9.0 stale-tag incident).

### Credential boundary (applies to every plan)
**Source:** SKILL.md hard rule 4 + CONTEXT D-22: credentials only via the user-run wrapper `~/.config/efx/scripts/efx-release-efx-motion`; never read/search/open certificate files; every artifact footer repeats "No Apple credential file accessed, opened, or searched."

### Bundle freshness (applies to gates, UAT, release records)
**Source:** SKILL.md hard rule 6: judge freshness by inner binary `Contents/MacOS/efx-motion-editor` mtime, never `bundle/dmg/`.

### English-only user-facing + GSD artifacts
**Source:** project memory `feedback_gsd_artifacts_english` + 44-UAT "shipped English labels as oracle". The worksheet's FR/EN switcher (52.2 precedent) is allowed UI chrome; all `.planning` ledgers are English.

## No Analog Found

| File | Role | Data Flow | Reason / Guidance |
|------|------|-----------|-------------------|
| `PhysicsPaintStudioView.test.ts` circular-import fix (`_setPaintMarkDirtyCallback is not a function`) | test | — | Not a Phase 53 file — research Pitfall 1 routes it to a pre-53 quick (late-bind `projectStore`→`paintStore` wiring; WINDOWS.md #90). If the user approves an in-phase scoped fix instead, search `app/src/stores/projectStore.ts` + `app/src/stores/paintStore.ts` at fix time; no pattern assigned here. |
| D-03 §7-pair 31-key through-line package | test material | — | On-disk material, not a repo file; documented path missing (research Pitfall 2 / Open Question 1). Confirm/recreate with the user before worksheet rows reference it. |

## Metadata

**Analog search scope:** `.planning/milestones/v0.9.0-phases/44-integrated-uat-signed-release/`, `SPECS/`, `app/src/`, `scripts/`, `.claude/skills/efx-motion-release/`
**Files scanned:** ~10 read in depth (44-GATES, 44-UAT, 44-STOP-CONDITIONS, 44-RELEASE, 44-VERIFY-DOWNLOADED, releaseContract.test.ts, SKILL.md, worksheet HTML ×2 sections, 44-01-PLAN headings, 44-CONTEXT listing)
**Pattern extraction date:** 2026-10-10
**Note on the 44 file swap:** in the Phase 44 set, `44-RELEASE.md` holds downloaded-artifact verification and `44-VERIFY-DOWNLOADED.md` holds the release ledger — assign by content when replicating.
