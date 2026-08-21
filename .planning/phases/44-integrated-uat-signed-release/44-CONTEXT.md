# Phase 44: Integrated UAT + Signed Release - Context

**Gathered:** 2026-08-21
**Status:** Ready for planning

<domain>
## Phase Boundary

v0.9.0 ships as a signed, notarized macOS release on 2026-08-31. The phase runs every automated gate green, executes the native packaged-app UAT against the spec, produces the signed/notarized/stapled DMG through the existing credential-free release pipeline, verifies the downloaded artifact, and publishes only when no release stop condition is active.

This is a **release/verification phase, not a feature phase**. No functional code changes happen here. The scope is fully locked by REL-01/02/03 and the milestone spec's Phase 5 — the discussion captured how to *execute* the release.

</domain>

<decisions>
## Implementation Decisions

### Native packaged-app UAT (REL-02)

- **D-01:** Run the native packaged-app UAT as **one comprehensive pass** over the full spec step list (icon surfaces → hydration without Refresh → audio sync/seek/loop/stop without drift or doubling → toggle isolation → progressive apply → 5-frame cycle × 5 → infinity to next clip → partial-cycle truncation label → next-clip move/remove re-expansion → color override with unchanged source → save/reopen/export). One planned gate walks the numbered list in sequence in the packaged app. — **Reversibility:** reversible — a failing step can be re-run in isolation.
- **D-02:** The **Phase 43 handoff is folded into the UAT pass** as a first-class step: verify valid linked-loop preview/export parity AND the unresolved-loop export block on the signed/notarized app. This is the signed-artifact boundary (ROADMAP success criterion 2) and must never be silently dropped. — **Reversibility:** reversible.

### Automated gates + credentialed release (REL-01, REL-03)

- **D-03:** All automated gates run green before release: `pnpm --dir app exec vitest run`, `pnpm --dir app run typecheck`, `pnpm build`, `cargo test --manifest-path app/src-tauri/Cargo.toml`, `bash -n scripts/macos-release.sh`, and `bash scripts/macos-release.sh preflight`.
- **D-04:** The **credentialed `release` run (sign/notarize/staple) is user-run**. The user exports the four credential env vars (`APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_PATH`) in a fresh terminal and runs `bash scripts/macos-release.sh release` themselves; the agent prepares the repo and gates and the user reports back the output. Credentials never enter the repo, project files, or agent context. Apple signing setup follows the locked screenshot-guided Keychain flow; never search or open certificate files. — **Reversibility:** reversible — no credential exposure.
- **D-05:** CSP/permission questions must be proven on a **packaged build**, never the dev server. Verify the signed artifact's freshness by `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app` (and its inner binary) timestamps, not the `bundle/dmg/` folder which can hold stale DMGs.

### Publish gate and stop conditions (REL-03)

- **D-06:** Final GitHub publish is a **separate plan** sequenced after verify-downloaded + install/launch pass, matching the proven v0.8.1 sequence: preflight → release → verify-downloaded → install into Applications → publish as GitHub Latest. — **Reversibility:** reversible.
- **D-07:** Release stop conditions are a **hard gate** — an explicit checklist against every "do not publish if" stop condition in the spec (hydration, icon, audio, loop resolution, preview/export) is run and recorded before publish; any failure blocks publication. — **Reversibility:** reversible.
- **D-08:** If any automated gate or UAT step fails mid-release-window: **stop and flag** to the user; the user decides whether to fix + re-run or defer. No silent pass.
- **D-09:** This phase is **release-only**: it runs gates + UAT + verify-downloaded + publish and changes no functional code. Any functional bug surfaced by UAT is triaged as release-blocking (stops publication for a fix in a follow-up) or non-blocking (deferred), never fixed half-way inside this phase.

### Claude's Discretion
- Exact plan/task decomposition of the comprehensive UAT pass and the gate checks, within the locked sequence above.
- Which existing gate commands are re-run in which plan, provided all six gates in D-03 complete before release.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked spec + requirements (authoritative WHAT)
- `SPECS/milestone-v0.9.0-plan.md` §"Phase 5 — Integrated release acceptance" — locked REL-01/02/03 automated gates, native UAT step list, release stop conditions ("do not publish if"), and delivery schedule (freeze 08-27, release window 08-28..30, publish 08-31)
- `.planning/REQUIREMENTS.md` — REL-01 (gates), REL-02 (native packaged-app UAT), REL-03 (signed/notarized downloaded-artifact verification + no stop condition)
- `.planning/ROADMAP.md` §"Phase 44: Integrated UAT + Signed Release" — goal, success criteria (esp. criterion 2: signed packaged UAT must explicitly cover linked-loop preview/export parity + unresolved-loop export block), requirement links

### Release tooling (read before touching)
- `scripts/macos-release.sh` — the only supported release path; three modes `preflight` / `release` / `verify-downloaded`. **Must remain unaltered.**
- `docs/macos-signed-release.md` — credential env contract, modes table, planned release sequence, verify-downloaded flow
- `docs/macos-developer-id-setup.md` — Developer ID / Keychain setup prerequisite (credential-free; user-owned)

### Verification seams (existing, extend only for gaps)
- `app/src/releaseContract.test.ts` — icon array, non-empty, ICNS signature, CSP contract, version consistency
- `app/src/viteBuild.test.ts` — production-build seam (input capture, build warnings, chunk budget)
- `app/src-tauri/tauri.conf.json` — `bundle.icon` (5 tracked files), beforeBuildCommand/frontendDist contract

### Signed-artifact UAT boundary (Phase 43 handoff)
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-UAT.md` — approved native acceptance for linked-loop preview/export parity and the unresolved-loop export block, verified here on the signed artifact
- `.planning/phases/43-hold-loop-clips-filmstrip-capsule/43-VALIDATION.md` — automated/native coverage map that the signed pass must re-prove on the packaged artifact

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/macos-release.sh`: complete, credential-free, hardened release pipeline (preflight / release / verify-downloaded). Reuse as-is; do not modify.
- `app/src/releaseContract.test.ts` + `app/src/viteBuild.test.ts`: existing automated gates that already assert icon contract, ICNS magic, CSP, version consistency, and production-build output. These satisfy most of REL-01.
- `docs/macos-signed-release.md`: exact credentialed release + verify-downloaded sequence already proven on v0.8.1 — reuse the sequence verbatim.

### Established Patterns
- **Packaged-app UAT is the user's oracle** — nothing is "done" until live UAT on the packaged build passes; summarized thresholds + user visual confirmation are sufficient evidence (no raw telemetry demanded).
- **Verify on the downloaded artifact, not the dev machine** — icon caches lie; freshness judged by `bundle/macos/*.app` + inner binary timestamps, not `bundle/dmg/`.
- **Release gates ship with guard tests** (v0.8.1 CSP-fix pattern: grant + contract test). Do not weaken or override.
- Native UAT + credentialed release are user-run; the agent orchestrates gates, evidence, and post-verify publication steps.

### Integration Points
- The `verify-downloaded` mode takes a downloaded `.dmg` absolute path (no credentials) — the signed-downloaded artifact UDF entry point.
- GitHub publish via `gh release` draft → upload DMG → publish Latest, after verify-downloaded + install/launch pass.
- The Phase 43 signed-artifact boundary maps to `app/src/lib/previewRenderer.ts` (preview) and `app/src/lib/exportEngine.ts` (fail-fast export) coverage already pinned in `43-VALIDATION.md`.

</code_context>

<specifics>
## Specific Ideas

- Release sequence mirrors the proven v0.8.1 path: `preflight` → user-run `release` → `verify-downloaded <downloaded.dmg>` → install into Applications → GitHub draft → publish as Latest.
- The signed packaged UAT must visibly cover the valid linked-loop preview/export parity and the unresolved-loop export block (Phase 43 handoff) — this is the signed-artifact boundary and is never silently dropped.
- Stop conditions are a hard gate: an explicit "do not publish if" checklist (hydration, icon, audio, loop overlap/dup, preview/export) is run and recorded before publish.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within release-scope. Functional bugs discovered by UAT are triaged as release-blocking (stop publication, fix in follow-up) or deferred, not half-fixed in this phase.

</deferred>

---

*Phase: 44-integrated-uat-signed-release*
*Context gathered: 2026-08-21*
