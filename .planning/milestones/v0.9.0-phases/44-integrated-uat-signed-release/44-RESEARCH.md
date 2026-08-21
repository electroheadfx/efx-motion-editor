# Phase 44: Integrated UAT + Signed Release - Research

**Researched:** 2026-08-21
**Domain:** macOS Developer ID signing/notarization/stapling, Tauri v2 packaging, release-gate orchestration, native packaged-app UAT
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Native packaged-app UAT (REL-02)

- **D-01:** Run the native packaged-app UAT as **one comprehensive pass** over the full spec step list (icon surfaces → hydration without Refresh → audio sync/seek/loop/stop without drift or doubling → toggle isolation → progressive apply → 5-frame cycle × 5 → infinity to next clip → partial-cycle truncation label → next-clip move/remove re-expansion → color override with unchanged source → save/reopen/export). One planned gate walks the numbered list in sequence in the packaged app. — **Reversibility:** reversible — a failing step can be re-run in isolation.
- **D-02:** The **Phase 43 handoff is folded into the UAT pass** as a first-class step: verify valid linked-loop preview/export parity AND the unresolved-loop export block on the signed/notarized app. This is the signed-artifact boundary (ROADMAP success criterion 2) and must never be silently dropped. — **Reversibility:** reversible.

#### Automated gates + credentialed release (REL-01, REL-03)

- **D-03:** All automated gates run green before release: `pnpm --dir app exec vitest run`, `pnpm --dir app run typecheck`, `pnpm build`, `cargo test --manifest-path app/src-tauri/Cargo.toml`, `bash -n scripts/macos-release.sh`, and `bash scripts/macos-release.sh preflight`.
- **D-04:** The **credentialed `release` run (sign/notarize/staple) is user-run**. The user's entry point is the personal wrapper **`efx-release-efx-motion`** (`~/.config/efx/scripts/`, outside the repo, mode 700): it prompts live for the trusted Apple environment file (drag-and-drop at the prompt), sources it to load the four credential env vars (`APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`), validates them, runs `bash scripts/macos-release.sh release` from the repo root, and unsets every variable on exit (trap cleanup). This is the exact mechanism used for the v0.8.1 release; the manual 4-export flow in `docs/macos-signed-release.md` remains the documented fallback. The agent prepares the repo and gates and the user reports back the output. Credentials never enter the repo, project files, or agent context. Apple signing setup follows the locked screenshot-guided Keychain flow; never search or open certificate files. — **Reversibility:** reversible — no credential exposure.
- **D-05:** CSP/permission questions must be proven on a **packaged build**, never the dev server. Verify the signed artifact's freshness by `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` (and its inner binary) timestamps, not the `bundle/dmg/` folder which can hold stale DMGs.

#### Publish gate and stop conditions (REL-03)

- **D-06:** Final GitHub publish is a **separate plan** sequenced after verify-downloaded + install/launch pass, matching the proven v0.8.1 sequence: preflight → release → verify-downloaded → install into Applications → publish as GitHub Latest. — **Reversibility:** reversible.
- **D-07:** Release stop conditions are a **hard gate** — an explicit checklist against every "do not publish if" stop condition in the spec (hydration, icon, audio, loop resolution, preview/export) is run and recorded before publish; any failure blocks publication. — **Reversibility:** reversible.
- **D-08:** If any automated gate or UAT step fails mid-release-window: **stop and flag** to the user; the user decides whether to fix + re-run or defer. No silent pass.
- **D-09:** This phase is **release-only**: it runs gates + UAT + verify-downloaded + publish and changes no functional code. Any functional bug surfaced by UAT is triaged as release-blocking (stops publication for a fix in a follow-up) or non-blocking (deferred), never fixed half-way inside this phase.

### Claude's Discretion
- Exact plan/task decomposition of the comprehensive UAT pass and the gate checks, within the locked sequence above.
- Which existing gate commands are re-run in which plan, provided all six gates in D-03 complete before release.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within release-scope. Functional bugs discovered by UAT are triaged as release-blocking (stop publication, fix in follow-up) or deferred, not half-fixed in this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-01 | Automated release gates all green before release | Six gates verified green at HEAD (this session): vitest 138 files / 2675 tests, typecheck exit 0, build exit 0, cargo test 20 tests, `bash -n` OK, `preflight` → `PREFLIGHT PASS`. Gate commands verbatim in Code Examples. |
| REL-02 | Native packaged-app UAT over the full spec step list | Spec Phase 5 UAT steps 1-17 verbatim; one-pass walk in the packaged app; Phase 43 handoff (loop preview/export parity + unresolved-loop export block) pinned at `app/src/lib/previewRenderer.ts` + `app/src/lib/exportEngine.ts`. |
| REL-03 | Signed/notarized downloaded-artifact verification + no stop condition before publish | `verify-downloaded` mode contract verbatim; stop-condition checklist from spec Phase 5; publish as separate plan (D-06). |

</phase_requirements>

## Summary

Phase 44 is the definition-of-done gate for milestone v0.9.0. It is a **release/verification phase — no functional code is written**. It orchestrates (1) all six REL-01 automated gates, (2) one comprehensive native packaged-app UAT covering the 17 spec steps plus the Phase 43 signed-artifact boundary, (3) a user-run credentialed `release` (sign/notarize/staple), (4) `verify-downloaded` + install + normal visible launch, and (5) a final publish gated on an explicit "do not publish if" checklist. The mechanics are fully proven: the exact same pipeline published v0.8.1 as GitHub Latest, and the repo now contains hardened fail-closed guard tests (`app/src/releaseContract.test.ts`, `app/src/viteBuild.test.ts`) and the credential-free hardened release script `scripts/macos-release.sh`.

Two pre-existing, verified, non-functional facts constrain the plan:

1. **The v0.9.0 version bump is not yet done.** Every product-owned version surface still reads `0.8.1` — `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock`, and `scripts/macos-release.sh` (`PRODUCT_VERSION="0.8.1"` at scripts/macos-release.sh:10). A release run today would rebuild and re-sign the *already-published* v0.8.1. The single-source contract test `releaseContract.test.ts:53` enforces that all five agree with `package.json`, so the bump must be applied to all five in one atomic change before any gate is re-run.
2. **Stale release artifacts exist** under `app/src-tauri/target/` (a 7-août `.app` at `target/release/bundle/macos/EFX Motion Editor.app` and an `_0.8.1_aarch64.dmg`). The script's artifact discovery is exactly-one-or-fatal, so stale outputs must be archived/removed before the credentialed run, and freshness of the signed artifact must be judged by the inner-binary timestamp, never the `bundle/dmg/` folder.

**Primary recommendation:** plan Phase 44 in three sequential plans mirroring the proven v0.8.1 sequence — (A) bump version to 0.9.0 on the five surfaces, clean stale artifacts, then run all six REL-01 gates green; (B) comprehensive packaged-app UAT pass (spec steps 1-17 + Phase 43 boundary) on the *signed* app; (C) user-run `release` via the `efx-release-efx-motion` wrapper, `verify-downloaded <dmg>`, install + launch, then `gh release` publish as GitHub Latest only after the explicit stop-condition checklist records zero active conditions. Every failing gate/step stops the plan and flags the user (D-08).

**Primary recommendation:** Plan the phase as gate-run (all green, evidence captured) → comprehensive signed-app UAT (user-run, evidence = visual confirmation + summarized thresholds) → user-run credentialed release → verify-downloaded + install/launch → publish, with the version bump as the first non-functional task and the stop-condition checklist as the publish gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Release gate execution (six REL-01 gates) | Local CLI (dev machine) | CI-equivalent | All gates are repo-local commands (`vitest`, `typecheck`, `build`, `cargo test`, `bash -n`, `preflight`) — no server tier exists. |
| Signing / notarization / stapling | Release pipeline (local user-run script) | Apple toolchain (codesign/notarytool/stapler) | `scripts/macos-release.sh release` is the only supported path; must remain unaltered. |
| Credential custody | User-owned session | Wrapper `efx-release-efx-motion` (trap-unset) | Credentials never enter repo, files, or agent context (D-04). |
| Native packaged-app UAT | Packaged desktop app | User visual confirmation | Packaged-app UAT is the user's oracle; dev server cannot prove CSP. |
| Downloaded-artifact verification | Release pipeline (`verify-downloaded`) | Separate download environment | Must be proven on a downloaded artifact, and Gatekeeper path, not local build. |
| Publish | GitHub Releases | — | `gh release draft → upload → publish Latest`, separate final plan (D-06). |
| Version consistency | Config layer (5 surfaces) | Contract test `releaseContract.test.ts` | Single source `app/package.json`; test asserts all five agree. |
| CSP / permission proof | Packaged build | CSP contract tests | Proven only on packaged build (D-05); never dev server. |

## Standard Stack

### Core

This phase installs **no new packages**. All tooling is already vendored in the repo and verified present this session. The "stack" is the release pipeline + existing dev toolchain:

| Tool | Version (verified) | Purpose | Why Standard |
|------|--------------------|---------|--------------|
| `scripts/macos-release.sh` | in-repo, HEAD | preflight / release / verify-downloaded | The only supported release path; three modes; credential-free preflight; fail-loud. |
| `pnpm` (workspace) | 10.27.0 | runs vitest/typecheck/build via `app` workspace | Monorepo standard (CLAUDE.md: use pnpm, not npm). |
| Vitest | in-repo (suite 2675 tests) | REL-01 gate 1, release contract + build contract tests | `app/src/releaseContract.test.ts`, `app/src/viteBuild.test.ts` are the release-specific seams. |
| Tauri CLI (`tauri-cli`) | 2.10.0 | `pnpm --dir app tauri build --bundles app,dmg --ci` | Tauri v2 packaging invoked by `macos-release.sh release`. |
| Rust toolchain (cargo) | 1.93.1 | `cargo test --manifest-path app/src-tauri/Cargo.toml` | Rust test gate (REL-01). |
| `gh` (GitHub CLI) | 2.97.0 | publish DMG as GitHub Latest (final plan) | v0.8.1 publish used `gh release`. |
| Apple toolchain | current CommandLineTools | codesign / security / xcrun notarytool + stapler / spctl / hdiutil | Signed/notarized/stapled release + Gatekeeper assessment. |
| User wrapper `efx-release-efx-motion` | ~/.config/efx/scripts/, zsh, mode 700 | sources trusted Apple env file, exports 4 vars, runs release, trap-unsets | The exact mechanism proven on v0.8.1. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Node.js | v24.15.0 | runtime for gate commands, `validate_tauri_config` Node checks | everywhere |
| bash | 5.3.15 | runs `macos-release.sh` | `bash -n` syntax gate |
| `security` / `spctl` / `plutil` / `hdiutil` (macOS) | system | identity query, Gatekeeper assessment, Info.plist extraction, DMG integrity | inside release script only — never invoked ad hoc by plans |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `scripts/macos-release.sh` release | Xcode organizer / fastlane | The script is the proven, fail-closed, credential-free-in-repo path; alternatives re-introduce manual steps and credential risk. |
| `gh` publish | GitHub web UI | `gh release` is scriptable, recorded, and was proven on v0.8.1; web UI can't be verified in an audit trail. |

## Package Legitimacy Audit

> Required gate: this phase installs **no external packages** — the audit table is intentionally empty. All runtime dependencies are already vendored or system-provided. The only "install-like" step is the in-repo version bump (a config change, not a package). No `npm install`, no `pip`, no `cargo add` occurs in this phase.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| — | — | — | — | — | — | none installed |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Planner note: do not let any execution task add a package. The release pipeline must stay credential-neutral and external-dependency-free; any proposed new install should be treated as a scope violation of D-09.*

## Architecture Patterns

### Release Sequence (the proven v0.8.1 pattern)

```
[1] v0.9.0 version bump   (5 files, single commit; releaseContract.test.ts becomes green)
[2] all six REL-01 gates  (vitest / typecheck / build / cargo test / bash -n / preflight)
          |
          ▼
[3] user-run: `efx-release-efx-motion`  →  `scripts/macos-release.sh release`
          |   (preflight → tauri build --bundles app,dmg → notarize+staple DMG → verify app+DMG)
          ▼
[4] upload DMG to GitHub draft  (gh release draft; attach DMG)
          ▼
[5] download back the uploaded DMG in a clean user/session
          ▼
[6] `verify-downloaded <dmg>` → DOWNLOADED ARTIFACT PASS
          ▼
[7] install into Applications; normal launch (no Ctrl-click/Open, no Gatekeeper bypass)
          ▼
[8] stop-condition checklist (hard gate; every "do not publish if" recorded)
          ▼
[9] publish as GitHub Latest (gh release edit --latest)
```

Entry point is `scripts/macos-release.sh` (all three modes, credential-boundary for `release`). No other path exists; the script never touches network credentials, and the wrapper never persists them.

### Task Sequencing Pattern (three plans)

| Plan | Scope | User dependency |
|------|-------|-----------------|
| Plan A (pre-release) | version bump, stale-artifact cleanup, six gates green, capture per-gate exit status | none (agent-run) |
| Plan B (UAT) | comprehensive native packaged-app UAT (spec steps 1-17 + Phase 43 boundary) on the *signed* app | user visual confirmation + summarized-thresholds evidence |
| Plan C (release + publish) | user-run `release` via wrapper, upload, verify-downloaded, install/launch, stop-condition checklist, publish Latest | user exports credentials via wrapper; agent orchestrates evidence |

### Recommended Project Structure

No new files are created in production code. The release tree is already the single supported entry point:

```
scripts/macos-release.sh          # only supported release path (never modify)
docs/macos-signed-release.md      # credential contract, modes, planned sequence
docs/macos-developer-id-setup.md   # Developer ID / Keychain prerequisite
app/src/releaseContract.test.ts    # version/icon/CSP/script contract guards (REL-01)
app/src/viteBuild.test.ts          # production-build guard (REL-01)
app/src-tauri/tauri.conf.json      # productName / version / bundle.icon / CSP / hardenedRuntime
~/.config/efx/scripts/efx-release-efx-motion  # user-owned credential wrapper
```

### Pattern 1: Credential-isolated release handoff

**What:** The agent prepares every non-credentialed step; the user executes the one credentialed step through a wrapper that never persists secrets. The wrapper sources a trusted env file (drag-and-drop), validates the four variables, runs `bash scripts/macos-release.sh release` from the repo root, then unsets all four variables in a `trap cleanup EXIT INT TERM`.

**When to use:** every credentialed release. The plan must treat the user's `release` output as the single source of truth for the artifact's pass/fail; the agent does not re-run `release`.

**Example (the wrapper, verified):**
```zsh
#!/usr/bin/env zsh
set -euo pipefail
readonly PROJECT_DIR="/Users/lmarques/Dev/efx-motion-editor"
cleanup() { unset APPLE_SIGNING_IDENTITY APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH; }
cleanup; trap cleanup EXIT INT TERM
read -r "credentials_input?Path to trusted Apple environment file (drag it here): "
credentials_file="${(Q)credentials_input}"; credentials_file="${credentials_file:A}"
source "$credentials_file"
# validates the four vars, resolves APPLE_API_KEY_PATH absolute + readable
cd "$PROJECT_DIR"
bash scripts/macos-release.sh release
```
Source: `~/.config/efx/scripts/efx-release-efx-motion` [VERIFIED: read this session]

### Pattern 2: Guard-test-backed release contracts

**What:** Every release safety property ships as a contract test that fails the build — not as a manual checklist. `releaseContract.test.ts` asserts the five version surfaces agree, bundle.icon is exactly the 5 tracked files with non-empty ICNS, the release script has no hardcoded version and no pinned DMG glob, the system-first codesign resolution path is used, and the CSP directives grant exactly `data:` to `img-src` only and `efxasset:` to `connect-src` only.

**When to use:** REL-01 gates and the v0.9.0 bump — after the bump, the contract test re-pins the five surfaces in lockstep.

### Anti-Patterns to Avoid

- **Running the credentialed release from the agent session:** D-04 is locked; credentials never enter the agent context. If a plan task tries `export APPLE_...`, reject it.
- **Skipping a stop condition because UAT "passed":** the stop-condition checklist (D-07) is separate from UAT pass; every "do not publish if" must be recorded explicitly.
- **Fixing functional bugs mid-release:** D-09 forbids half-fixes inside this phase; a UAT failure is release-blocking and goes to a follow-up.
- **Judging artifact freshness by `bundle/dmg/`:** the DMG folder holds stale artifacts; only `.app` + inner binary timestamps are trustworthy.
- **Using dev-server CSP/permission proof:** CSP questions are packaged-only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| macOS code signing | hand-rolled `codesign` invocations | `scripts/macos-release.sh release` (system-first PATH, verified identity) | wrong identity/timestamp/authority silently corrupts the artifact |
| Notarization + stapling | manual `notarytool` orchestration | built into `macos-release.sh` (submit→wait→log→staple, evidence JSON under `target/dmg/notarization-evidence`) | Apple API changes, retry/waits, evidence capture are handled by the proven script |
| Developer ID / Gatekeeper verification | trusting any tool's "signed" word | `verify_app`/`verify_dmg` (codesign strict, spctl assess, stapler validate, Team ID match) | a "signed" artifact can still fail Gatekeeper; the pipeline's fail-closed chain proves the chain |
| DMG integrity / quarantine | skipping quarantine checks | `hdiutil verify` + downloaded-artifact path with Gatekeeper assessment | the download path is the true trust boundary |
| CSP grants | loosening CSP to make a permission work | guard test in `releaseContract.test.ts` (img-src data:, connect-src efxasset: narrow-grant) | any future grant beyond the locked set breaks the contract test and fails `vitest` |
| Release evidence ledger | trusting "exit 0" | the script's final `RELEASE PASS` / `DOWNLOADED ARTIFACT PASS` ledger shape | redacted checklist in `docs/macos-signed-release.md` is the user evidence contract |

**Key insight:** the release pipeline already exists, is hardened, and is proven on v0.8.1. This phase's job is to *reprove* it on the v0.9.0 artifact, not to re-engineer it. Any new signing/notarization code inside this phase would be a duplicate-in-parallel violation of the single-release-path invariant.

## Runtime State Inventory

This is a release/version phase (the v0.9.0 bump touches runtime surfaces), so a state inventory is required.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — app documents are user files; version is not persisted in the document format | none |
| Live service config | None — no service config references the version | none |
| OS-registered state | None — the version is embedded in the bundle Info.plist at build time; no OS registration exists for v0.8.1 that needs renaming | none |
| Secrets / env vars | The four credential vars are user-session-only (never in repo, never in agent context). **No rename needed.** Note: an env file may exist at the user's trusted path; the plan never reads it. | none (code doesn't read them either) |
| Build artifacts | `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` (inner binary 7 août 14:00, 26MB) and `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_0.8.1_aarch64.dmg` — both stale (v0.8.1). Artifact discovery is exactly-one-or-fatal; a stale artifact would be found by the `.app` glob regardless of version | Archive/remove the stale `target/**/release/bundle/*` outputs before the v0.9.0 build, and let a fresh build overwrite; do not try to re-sign stale bundles |

**Nothing found in category:** stored data, live service config, OS-registered state — all verified as non-versioned (None, by inspection).

## Common Pitfalls

### Pitfall 1: Releasing the old version (the v0.9.0 bump is pending)
**What goes wrong:** all five version surfaces read `0.8.1` (verified this session). A `release` run builds, signs, and notarizes a v0.8.1 artifact and would upload a duplicate of the already-published release.
**Why:** the milestone bumped the milestone name but the code still carries v0.8.1.
**How to avoid:** make the 5-file bump the first task of Plan A; re-run `releaseContract.test.ts` to prove the five surfaces agree at 0.9.0 before any further gate.
**Warning signs:** the artifact DMG filename still shows `_0.8.1_`.

### Pitfall 2: Stale artifact ambiguity
**What goes wrong:** `find_release_artifacts` requires exactly one `.app` and exactly one `*_${PRODUCT_VERSION}_*.dmg`. Stale v0.8.1 bundles under `target/` can produce "found 2" fatal errors (docs/macos-signed-release.md troubleshooting: "Move or remove stale build output").
**How to avoid:** before Plan C, archive/remove stale release bundles; record the count after a fresh build.
**Warning signs:** `ERROR: Expected exactly one ... found N`.

### Pitfall 3: Judging freshness by the DMG folder
**What goes wrong:** `bundle/dmg/` can hold stale DMGs even when the `.app` is fresh.
**How to avoid:** freshness = `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` + inner binary mtime; use `stat` timestamps before the packaged UAT.
**Warning signs:** the inner binary predates today's signed build.

### Pitfall 4: CSP/permission proof on the dev server
**What goes wrong:** dev server is looser than packaged (CSP only applies to packaged).
**How to avoid:** prove any CSP/permission question on the packaged app only (D-05), covered by the `img-src data:` and `connect-src efxasset:` contract tests in `releaseContract.test.ts`.
**Warning signs:** a CSP fix verified only in `pnpm dev`.

### Pitfall 5: Truncation label copy mismatch (French spec vs English implementation)
**What goes wrong:** spec Phase 5 step 12 requires the label `Boucle raccourcie par le clip suivant`; the actual implemented copy (verified) is English `… · Effective: …f — shortened by the next clip` and the 43-UAT approved English `Loop shortened by next clip`. A strict reading of the spec label in the signed-app UAT would fail the step against the shipped implementation.
**How to avoid:** the UAT plan should assert the shipped English copy (43-approved) as the acceptance oracle and record the French/spec mismatch as a known-spec divergence, not a regression. Do not change the label in this phase.
**Warning signs:** UAT step 12 fails on the exact string; the code comment history shows the label was intentionally amended.

### Pitfall 6: Chunk budget drift (1100 spec vs 1120 actual)
**What goes wrong:** the desktop chunk budget is 1120 in the codebase (amended from 1100 during 43.x; see `viteBuild.test.ts` chunkSizeWarningLimit=1120) — a spec-derived gate that no longer matches the spec's 1100. Reverting to 1100 would fail the build for no benefit.
**How to avoid:** gate on the actual 1120 budget; record the amendment in the phase validation evidence.
**How to avoid:** same pattern — the budget is an implementation contract, not a spec contract.

### Pitfall 7: No credential material anywhere near the repo
**What goes wrong:** preflight's private-asset guard fails the release if a `.p12/.p8/.key` file (or anything private-key-named) is present anywhere in the worktree; a credential slipping into the repo is a security incident.
**How to avoid:** the agent never writes/echoes Apple credentials; any failure mentioning private assets must be surfaced to the user with no secret material echoed.
**Warning signs:** `ERROR: A private Apple signing/notarization asset exists inside the repository`.

### Pitfall 8: Type-check/build chain recompiling stale regression files (36.14)
**What goes wrong:** a full typecheck/build chain can compile stale regression files after a contract change (36.14 surprise), producing a "green" gate on wrong code.
**How to avoid:** order the gates so the compile-proof runs *after* the contract-stable code (the v0.9.0 bump is the contract change; re-run gates in the exact D-03 order after the bump, capturing each exit status).
**Warning signs:** a gate passes but a source file that should be compiled isn't compiled (check gate output timestamps).

## Code Examples

Verified patterns from this repo (all sources read this session).

### The six REL-01 gates (verbatim spec Phase 5 + D-03)

```bash
pnpm --dir app exec vitest run
pnpm --dir app run typecheck
pnpm build
cargo test --manifest-path app/src-tauri/Cargo.toml
bash -n scripts/macos-release.sh
bash scripts/macos-release.sh preflight
```
All six pass at HEAD (2026-08-21): vitest 138 files / 2675 tests, typecheck exit 0, build exit 0, cargo test 20 tests, bash -n OK, preflight → `PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards`.

### User-credentialed release (D-04, wrapper)

```bash
# User runs (outside the agent session):
# ~/.config/efx/scripts/efx-release-efx-motion
# → prompt: drag trusted Apple env file
# → sources it, exports APPLE_SIGNING_IDENTITY APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
# → runs: bash scripts/macos-release.sh release
# → trap: unset the four variables
```

### verify-downloaded (REL-03, credential-free)

```bash
bash scripts/macos-release.sh verify-downloaded /absolute/path/to/EFX\ Motion\ Editor_0.9.0_aarch64.dmg
```
Expected: `DOWNLOADED ARTIFACT PASS` + "normal visible launch remains a required user-owned check". Then: open DMG → drag app to Applications → normal launch (no Control-click/Open, no Gatekeeper bypass).

### Publish as GitHub Latest (final plan)

```bash
# create draft (from the built DMG)
gh release create v0.9.0 --draft --title "EFX Motion Editor v0.9.0" app/src-tauri/target/release/bundle/dmg/*_0.9.0_*.dmg
# after verify-downloaded + install/launch + stop-condition checklist pass:
gh release edit v0.9.0 --latest
```
Sequence: `gh release create` draft → `gh release upload` → verify-downloaded download → install/launch → `gh release edit v0.9.0 --latest` only after the stop-condition checklist is all-pass.

### Evidence ledger (user-reported, from docs/macos-signed-release.md)

```
Local release ledger: PASS
app notarization status: Accepted
DMG notarization status: Accepted
app stapler validation: PASS / DMG stapler validation: PASS
verify-downloaded ledger: PASS
normal launch without Control-click/Open: PASS
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| v0.8.0 release (deferred, broken artifact) | v0.8.1 hotfix pipeline (fail-closed bundle guard, icon contract, version agreement, simulated codesign) | v0.8.1 | The release pipeline now fails loudly on every class of v0.8.0 failure |
| Manually crafted Tauri icons | `tauri icon` from the 1024² source kept outside Git; `bundle.icon` exactly 5 files with ICNS magic | v0.8.1 | Icon contract is CI-verified; preflight rejects a fresh clone missing the source PNG |
| Per-milestone version drift | single-source `app/package.json` version propagated to tauri.conf.json/Cargo.toml/Cargo.lock/macos-release.sh (contract test) | v0.8.1 | the v0.9.0 bump touches 5 surfaces as one change |

**Deprecated/outdated:**
- **Full Xcode requirement** — superseded by `xcrun --find notarytool/stapler` capability probes on the selected CommandLineTools (preflight log: "Full Xcode is not required when these capability probes succeed").
- **Any release without `verify-downloaded`** — the docs state distribution acceptance remains unproven until a separately downloaded artifact passes.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The release version target is **0.9.0** (spec/milestone/ROADMAP all say v0.9.0, but no in-repo value yet pins it) | Summary / Standard Stack | If the intended release tag is a different version, the 5-surface bump would be wrong — cheap to correct before gates |
| A2 | The Phase 43 boundary expectations (`Loop source missing` placeholder, `Boucle raccourcie…`/English label) will pass on the signed artifact as they did unsigned | Common Pitfalls P5 | If the signed build ships different copy, the UAT step's label assertion fails — flagged, not a code change |
| A3 | Chunk budget stays 1120 (amended) for the v0.9.0 build | Pitfall 6 | If the build target changed, `viteBuild.test.ts` budget assertion may misalign — re-verify at gate time |
| A4 | The v0.8.1 published GitHub "Latest" will be superseded by v0.9.0 via `gh release edit --latest` (matching v0.8.1 flow) | Publish pattern | A rename/tag history issue would be visible; still re-check gh state before editing |
| A5 | No new test files are needed for Phase 44 (existing releaseContract + viteBuild + suites cover the release gates) | Validation Architecture | If a gate uncovered a new regression, a regression test is added in a follow-up phase (D-09 says no code in this phase) |

## Open Questions

1. **Confirmation of the release version "0.9.0"** — all evidence points there, but no in-repo value yet sets it.
   - What we know: milestone name, ROADMAP, CONTEXT all say v0.9.0; the five surfaces all read 0.8.1.
   - What's unclear: whether the user wants `0.9.0` exactly or a version-suffix (e.g., `0.9.0-beta`).
   - Recommendation: confirm `0.9.0` in the discuss/plan handoff; the bump is the first task.

2. **Truncation-label divergence handling in the UAT** — spec French `Boucle raccourcie par le clip suivant` vs implemented English.
   - What we know: implementation prints English (43-approved); spec step 12 asserts French.
   - What's unclear: which label the signed-app UAT is judged against.
   - Recommendation: judge against the shipped English label (43-approved) and record the spec divergence; do not change code in this phase.

3. **Stale-artifact cleanup boundary** — do we archive or delete `target/**/release/bundle/*` outputs in Plan A?
   - What we know: exactly-one-or-fatal discovery.
   - What's unclear: whether the user wants to keep the old v0.8.1 DMG locally.
   - Recommendation: archive/rename (not delete) stale bundles; document the count.

## Environment Availability

Step 2.6 was run this session (all probes current):

| Dependency | Required By | Available | Version | Notes |
|------------|-------------|-----------|---------|-------|
| macOS (darwin) | all codesign/spctl/notary/staple steps | ✓ | Darwin 24.6.0 | preflight requires macOS |
| node | gates + `validate_tauri_config` | ✓ | v24.15.0 | — |
| pnpm | vitest/typecheck/build/tauri | ✓ | 10.27.0 | — |
| cargo / rustc | cargo test gate | ✓ | 1.93.1 | — |
| bash | `macos-release.sh` | ✓ | 5.3.15 | `bash -n` gate |
| `gh` (GitHub CLI) | publish plan | ✓ | 2.97.0 (auth: electroheadfx) | verified auth |
| `tauri-cli` | release build | ✓ | 2.10.0 | invoked by the script |
| codesign / security / xcrun (notarytool/stapler) / hdiutil / spctl | release verify steps | ✓ | present | preflight capability probes pass |
| Apple credential env file | `release` run | ✗ (user-owned, not available to agent) | — | this is the D-04 boundary: agent never holds it |

**Missing dependencies with no fallback:**
- Apple Developer credentials + identity — the `release` step cannot be automated; it is a **user-owned step** (D-04). The plan must include a user checkpoint that reports the `release` output.

**Missing dependencies with fallback:**
- None otherwise — all tools above are present. The fallback for the credentialed step is `docs/macos-signed-release.md`'s manual 4-export flow, also user-run.

## Validation Architecture

`workflow.nyquist_validation` is `true` (verified in `.planning/config.json`), so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (existing app workspace, `pnpm --filter efx-motion-editor exec vitest run`) |
| Config file | `app/vitest.config.*` (existing) |
| Quick command | `pnpm --dir app exec vitest run app/src/releaseContract.test.ts app/src/viteBuild.test.ts` |
| Full suite | `pnpm --dir app exec vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REL-01 | all six gates green | gate-run (no new unit test) | the six D-03 commands | existing (releaseContract.test.ts, viteBuild.test.ts, cargo suite) |
| REL-01 | version surfaces agree (post-bump) | unit (single-source) | `pnpm --dir app exec vitest run releaseContract.test.ts` | ✅ |
| REL-01 | icon contract + ICNS magic + CSP grants | unit | `vitest run releaseContract.test.ts` | ✅ |
| REL-01 | production build + chunk budget | unit | `vitest run viteBuild.test.ts` | ✅ |
| REL-02 | native UAT steps 1-17 | manual (packaged app) | user visual walk (reports evidence) | n/a |
| REL-03 | stop-condition checklist | manual record | checklist recorded (no assert) | n/a |

### Sampling Rate

- **Per task commit:** `pnpm --dir app exec vitest run` (or the release-contract subset after the bump).
- **Per plan merge:** full `vitest run` + `bash -n scripts/macos-release.sh` + `preflight`.
- **Phase gate:** all six gates green + user-reported `RELEASE PASS` + `DOWNLOADED ARTIFACT PASS` + normal launch.

### Wave 0 Gaps

None — the release contract tests and full Vitest suite already exist and pass; no new test file is needed. The only new-assertion consideration is re-running `releaseContract.test.ts` after the v0.9.0 bump (it will initially fail at 0.8.1 because `package.json` still says 0.8.1 — the bump resolves it). No shared fixture changes needed.

## Security Domain

Security enforcement is enabled (config.json absent) — include.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | release pipeline has no user accounts; GitHub auth is `gh` token (outside phase) |
| V3 Session Management | no | — |
| V4 Access Control | no | the credential boundary is enforced by the user-owned wrapper, not the app |
| V5 Input Validation | partial | `require_release_credentials` validates `APPLE_API_KEY_PATH` (absolute, readable, outside repo, real-path), `require_verify_downloaded` validates the DMG path is a readable `.dmg` |
| V6 Cryptography | yes | signing/notarization delegated to the hardened script / Apple toolchain — never hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential exposure in repo (private `.p8`/`.p12`/`.key`) | Information Disclosure | preflight private-asset guard + worktree scan; policy: never search/open certificate files |
| Malicious/spoofed release artifact | Tampering | `verify_app`/`verify_dmg` (strict codesign, Gatekeeper, stapler, Team ID match, no entitlements) |
| CSP bypass via dev-server-only proof | Tampering | CSP contract tests + packaged-build-only proof (D-05) |
| Cache poisoning of release evidence | Spoofing | evidence ledger shape documented; every gate exit status recorded, not assumed |

## Sources

### Primary (HIGH confidence — read/executed this session)
- `scripts/macos-release.sh` — modes, guards, verify paths (read lines 1-483; preflight re-executed → PASS)
- `app/src/releaseContract.test.ts` — version/icon/CSP contracts (read lines 1-163)
- `app/src/viteBuild.test.ts` — build + chunk budget (read this session)
- `app/src-tauri/tauri.conf.json` — release config, bundle.icon, CSP
- `SPECS/milestone-v0.9.0-plan.md` §Phase 5 (lines 549-644) — UAT steps 1-17, stop conditions, schedule
- `docs/macos-signed-release.md` — credential contract, planned sequence, evidence checklist
- `docs/macos-developer-id-setup.md` — Developer ID prerequisite
- `~/.config/efx/scripts/efx-release-efx-motion` — user wrapper (mode 700, outside repo)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json`, 44-CONTEXT.md, 44-DISCUSSION-LOG.md, 44-MEMORY-RECALL.md, 43-UAT.md, 43-VALIDATION.md
- Gate re-verification at HEAD: vitest / typecheck / build / cargo test / bash -n / preflight (all green)

### Secondary (MEDIUM)
- Apple Developer / notarytool / stapler documented contract — as enforced by the script's exact commands (system binaries), not re-fetched this session

### Tertiary (LOW)
- None needed — all release-relevant claims either verified in-repo or explicitly flagged `[ASSUMED]` in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every release tool is in-repo and version-verified this session; no new packages.
- Architecture: HIGH — release sequence, stop conditions, wrapper boundary all locked in CONTEXT and re-verified in code/docs.
- Pitfalls: MEDIUM-HIGH — the five pitfalls are verified facts from this repo; the truncation-label and chunk-budget divergences are documented but not user-adjudicated.

**Research date:** 2026-08-21
**Valid until:** 2026-09-21 (the release pipeline and lock gates are stable; only the v0.9.0 bump and any future version changes would alter this)
