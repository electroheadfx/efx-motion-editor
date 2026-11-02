---
phase: "54"
slug: "preact-11-update"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-02"
---

# Phase 54 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Retroactive L1 (grep-depth) verification at ASVS level 1. The register was
> authored at plan time in all five PLAN files.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| probe install → registry | Throwaway `pnpm install` of the locked Preact 11 pairing pulls packages from the npm registry | package tarballs |
| gitignored witness → plan | SPECS playground is untracked local state, read only as a measurement witness | manifest declarations |
| human → registry trust | A human vouches for the four target versions before install | publisher identity |
| workspace → registry | `pnpm install` pulls the locked target versions from the npm registry | package tarballs |
| published peer contract | Workspace `peerDependencies.preact` ranges are a contract external consumers read | peer range declarations |
| type seam → compile | The three migrated files are the only JSX.* type-import surfaces | type-only changes |
| store version clock → render effects | Every `paintVersion` bump can re-render subscribers | signal values |
| Studio lifecycle → signal subscriptions | Dispose must actually tear down, which Preact 11 defers | subscription lifetimes |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-54-01 | Tampering | `scripts/preact11-probe` install | high | mitigate | Install used only the exact D-09 pins; the probe was deleted on green (D-02). Verified: `scripts/preact11-probe` does not exist. | closed |
| T-54-02 | Tampering | False-green pairing leg | medium | mitigate | Pairing leg required the witness to declare both packages and to actually run; both legs green, recorded in `54-01-SUMMARY.md`. | closed |
| T-54-SC | Tampering | npm installs | high | mitigate | Blocking-human package-legitimacy checkpoint before any workspace install; option A recorded in `54-02-SUMMARY.md` with publisher identity for all four targets. | closed |
| T-54-03 | Tampering | npm target versions for preact / signals / lucide-preact / preset-vite | high | mitigate | Human walked all four npmjs.com pages and selected option A before install (`54-02-SUMMARY.md`); no [SLOP] package admitted. | closed |
| T-54-04 | Tampering | Unattended walk of the D-04 peer-range door | high | mitigate | `checkpoint:decision gate="blocking-human"` with no auto-select immediately before the GREEN bump; human selected option A in `54-03-SUMMARY.md`. | closed |
| T-54-05 | Tampering | Silent second `preact` reintroduction | high | mitigate | Standing `preactSingleCopyContract.test.ts` rejects a second pin or off-line override; extended by `preactToolchainContract.test.ts` (lucide ≥ 1.57.0, preset-vite aligned on 2.10.6). Both green. | closed |
| T-54-06 | Tampering | Peer-only bump leaving a live 10.x devDep | high | mitigate | D-04 same-commit pair landed in `54-03`; the carrying package `packages/efx-physic-paint` was later retired in the Phase 55/56 restructure, and the singleton contract covers every current workspace package (green). | closed |
| T-54-07 | Tampering | Registry serves a different artifact than the locked pins | medium | mitigate | Legitimacy checkpoint confirmed the target publishers/versions; install used those exact pins; `pnpm why preact` close evidence recorded in `54-03-SUMMARY.md`. | closed |
| T-54-08 | Tampering | Type migration hiding a behavior change | medium | mitigate | D-07 scope is type names only; `preactJsxNamespaceContract.test.ts` pins the migrated shape and the full vitest suite is the behavior backstop. Green. | closed |
| T-54-09 | Tampering | Subscribe shape rewritten into cleanup-based correctness | high | mitigate | `paintVersionDisciplineContract.test.ts` (5 assertions) plus live UAT rows A1–A4 approved 2026-10-14. Pin green. | closed |
| T-54-10 | Denial of Service | Zombie subscription after Studio dispose drives a render loop (historical OOM class) | high | mitigate | Live UAT row A4 approved 2026-10-14 (dispose counters: `beforeDestroy: 1`, `resize.cleanup: 1`); profile counters remain the standing detection tool. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**threats_open: 0** — all 11 threats closed with recorded evidence.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|

*No accepted risks.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-02 | 11 | 11 | 0 | gsd-execute-phase orchestrator (L1 grep-depth; ASVS 1 short-circuit) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-02
