---
phase: 40
slug: macos-icon-regeneration-build-hygiene
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-04
---

# Phase 40 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| artwork → icon tooling | SPECS/efxmotioneditor-icon-2.png crosses into @tauri-apps/cli as parsed binary input (trusted user-owned input per D-01) | PNG binary artwork |
| build machine → packaged .app | Unsigned UAT bundle is produced and inspected locally; no signing/notarization path is exercised | Packaged app bundle (local only) |
| check script → release script | check-unsigned-app-icon.sh evaluates extracted lines from macos-release.sh at runtime | Shell script text extraction |
| Vite build → test seam | Programmatic build warnings are process-internal evidence; suppressing or misreading them would mask regressions | Build warning strings |
| triage classification → source edits | Only the user-approved subset may cross into the working tree (D-08 gate) | Source file edits |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-40-01 | Tampering | `tauri icon` image parsing | low | accept | Trusted user-owned artwork (D-01); official @tauri-apps/cli is the sole parser; no custom decoder permitted (D-02) — no new parsing surface introduced | closed |
| T-40-02 | Tampering | scripts/macos-release.sh | medium | mitigate | Zero edits permitted (D-06); `git diff e2914295^..4b5a951d -- scripts/macos-release.sh` verified empty; releaseContract.test.ts grep-pins detect accidental modification | closed |
| T-40-03 | Repudiation | check-unsigned-app-icon.sh | low | mitigate | Fail-closed local `die` on missing bundle/plist/icon (script lines 27, 34, 40, 45); icon-check block extracted from the release script itself so checked logic cannot silently drift | closed |
| T-40-04 | Repudiation | chunkSizeWarningLimit budget | medium | mitigate | D-11 rationale comment present (app/vite.config.ts ~184–189); resolved-limit assertion reads config via configResolved (app/src/viteBuild.test.ts:80,131) so source-text edits cannot false-pass; no warning suppression | closed |
| T-40-05 | Information disclosure (process integrity) | warning capture | low | mitigate | Capture unfiltered at ingestion — `String(msg)` pushed verbatim (app/src/viteBuild.test.ts:59); filtering only inside assertions; customLogger replaces silent logLevel (line 97–98) | closed |
| T-40-06 | Tampering | chunk-separation pins | low | mitigate | Prefix-based regexes only (`/PhysicsPaintStudio-[^/]*\.js$/`, app/src/viteBuild.test.ts:169); content-hash filenames and exact counts explicitly rejected | closed |
| T-40-07 | Tampering | import-graph conversions | medium | mitigate | D-08 approve-all recorded in 40-TRIAGE.md; 4 corrections applied (commit c97c5780) with preserved call order; build-seam green on first run — no revert needed; store-to-store dynamics preserved per D-09 | closed |
| T-40-08 | Repudiation | warning suppression | medium | mitigate | No global suppression (BUILD-02/D-09); D-13 asserts corrected module paths absent from captured warnings (app/src/viteBuild.test.ts:189) rather than silencing output | closed |
| T-40-09 | Elevation of scope | dependency inversion | low | mitigate | #11 projectStore ↔ physicPaintBridge DI case documented in 40-03-SUMMARY.md and routed to backlog (D-10) — never implemented in-phase | closed |
| T-40-SC (40-01) | Tampering | package installs | high | mitigate | No installs occurred; `git diff e2914295^..4b5a951d -- '**/package.json' '**/pnpm-lock.yaml'` verified empty | closed |
| T-40-SC (40-02) | Tampering | package installs | high | mitigate | No installs occurred; manifest/lockfile diff verified empty across phase range | closed |
| T-40-SC (40-03) | Tampering | package installs | high | mitigate | No installs occurred; manifest/lockfile diff verified empty across phase range | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-40-01 | T-40-01 | Artwork is trusted user-owned input (D-01); the official @tauri-apps/cli is the sole parser and no custom decoder is permitted (D-02), so no new parsing surface is introduced by regenerating the icon set | user (plan-time D-01/D-02) | 2026-08-04 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-04 | 12 | 12 | 0 | /gsd-secure-phase (L1 grep-depth; ASVS level 1, register authored at plan time — auditor short-circuit per workflow) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-04
