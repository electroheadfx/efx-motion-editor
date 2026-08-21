---
phase: 44
slug: integrated-uat-signed-release
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-21
---

# Phase 44 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| repo → release script | `scripts/macos-release.sh` is frozen except PRODUCT_VERSION; the private-asset guard fails the release if any `.p8/.p12/.key` appears in the worktree | repo file paths; no credentials |
| user wrapper → release script | The only credential boundary; the wrapper sources a trusted Apple env file, exports the four vars, runs `bash scripts/macos-release.sh release`, and trap-unsets them. Credentials never enter the repo or agent context. | Apple credential env vars (APPLE_*), process-local only |
| stale bundles → artifact discovery | `find_release_artifacts` is exactly-one-or-fatal; stale v0.8.1 bundles under `target/` could abort or confuse the release run | artifact file paths |
| GitHub API → release | The `gh` CLI (authenticated as electroheadfx) uploads and edits release assets; the draft state protects against premature publication | release asset bytes |
| signed artifact → UAT | The packaged app is the user's oracle; CSP/permission facts are only provable on the packaged build (D-05) | packaged app bundle |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-44-01 | Tampering | version surfaces | high | mitigate | single-source `releaseContract.test.ts` assertion (5 surfaces agree) + one atomic 5-file bump commit — `app/src/releaseContract.test.ts` "all product-owned version surfaces agree" (11/11 green), verified in 44-01-SUMMARY | closed |
| T-44-02 | Tampering/Repudiation | stale bundle discovery | high | mitigate | stale `.app`/`_0.8.1_*.dmg` archived (not deleted) under `bundle/archive-v0.8.1-20260821/`; count recorded — exactly-one-or-fatal discovery finds zero stale artifacts (44-01-SUMMARY) | closed |
| T-44-03 | Tampering | gate evidence | medium | mitigate | every gate exit status captured explicitly into `44-GATES.md`, never assumed or reused (D-03) — REL-01-1..6 each `exit 0` with marker + timestamp | closed |
| T-44-04 | Information Disclosure | credential boundary | high | mitigate | no plan task exports/echoes Apple credentials; agent never writes private-asset files; preflight private-asset guard untouched (D-04) — `scripts/macos-release.sh` `is_private_asset_name`/`worktree_private_asset_exists` guard, `PREFLIGHT PASS` (REL-01-6) | closed |
| T-44-SC | Tampering | package installs | high | mitigate | RESEARCH Package Legitimacy Audit confirms ZERO packages installed; 5-surface bump is a config change, not an install; `added: []` in dependency change record (44-01-SUMMARY) | closed |
| T-44-05 | Information Disclosure | credential env vars (APPLE_*) | critical | mitigate | release runs only through the user-owned wrapper (mode 700, trap-unset on exit); agent never exports/echoes the four vars; preflight private-asset guard untouched (D-04) | closed |
| T-44-06 | Spoofing | signed artifact provenance | high | mitigate | user-reported RELEASE PASS + notarization/stapler ledgers + freshness by inner-binary mtime (D-05) — `44-RELEASE.md`: RELEASE PASS, app+DMG notarization `Accepted`, stapler PASS | closed |
| T-44-07 | Tampering | CSP/permission proof | high | mitigate | CSP/permission facts proven only on the packaged build; `releaseContract.test.ts` guards the `img-src data:` and `connect-src efxasset:` narrow grants (no dev-server proof) — verified contract tests | closed |
| T-44-08 | Tampering | UAT evidence | medium | mitigate | every spec step recorded pass/fail in `44-UAT.md` with the shipped-label oracle; divergences recorded, never "fixed" in-phase (D-09) — ALL 17 STEPS PASS matrix | closed |
| T-44-09 | Tampering | uploaded release asset | high | mitigate | `verify-downloaded` on the SEPARATELY downloaded DMG → `DOWNLOADED ARTIFACT PASS` (REL-03); draft state prevents public distribution — `44-VERIFY-DOWNLOADED.md` | closed |
| T-44-10 | Spoofing | gatekeeper bypass | high | mitigate | normal visible launch without Control-click/Open recorded; any bypass attempt is a failure (UAT 17 / install step) — downloaded-artifact install+launch confirmed | closed |
| T-44-11 | Repudiation | stop-condition checklist | medium | mitigate | D-07 hard gate: every "do not publish if" item recorded with evidence source in `44-STOP-CONDITIONS.md` — all 15 items NOT ACTIVE with evidence | closed |
| T-44-12 | Tampering | gh CLI state | medium | mitigate | verify draft→published transition via `gh release view --json isLatest` after every state change — `isDraft: true` verified pre-publish (44-VERIFY-DOWNLOADED) | closed |

*Status: open · closed · open — below {block_on} threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-21 | 13 | 13 | 0 | claude / gsd-secure-phase |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-21

---

## Security Audit 2026-08-21

| Metric | Count |
|--------|-------|
| Threats found | 13 |
| Closed | 13 |
| Open | 0 |
