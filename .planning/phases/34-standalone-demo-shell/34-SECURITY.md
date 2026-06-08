---
phase: 34
slug: standalone-demo-shell
status: verified
threats_open: 0
unregistered_flags: 0
asvs_level: 1
register_authored_at_plan_time: true
created: 2026-06-08
updated: 2026-06-08
---

# Phase 34 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Developer shell -> pnpm workspace scripts | Local commands execute package scripts from `package.json`; tampered script values can execute unexpected code. | Local developer command execution |
| Package manager -> npm registry | New dev dependency metadata and tarballs enter the local workspace lockfile. | Third-party package metadata and code |
| Browser -> demo DOM | Demo code renders visible HTML in the browser; injected HTML or runtime errors could affect local testing. | Static JSX copy and mount errors |
| Vite dev server -> local source files | Vite serves demo files and resolves aliases into package source for HMR. | Demo source files and package source alias resolution |
| Demo shell -> package public wrapper | The demo exercises `@efxlab/efx-physic-paint/preact`, which creates engine canvases and pointer handlers in a DOM container. | Local browser UI state and canvas interactions |
| README -> developer shell | Users copy documented commands into a shell; stale or wrong commands cause execution of wrong workflows. | Human-operated local commands |
| README -> public API expectations | Users copy Preact examples; stale props cause runtime/type failures or encourage internal API usage. | Documentation examples and public API expectations |

---

## Threat Register

| Threat ID | Source Plan | Category | Component | Disposition | Mitigation / Verification Evidence | Status |
|-----------|-------------|----------|-----------|-------------|------------------------------------|--------|
| T-34-01 | 34-01 | Tampering | `package.json` scripts | mitigate | `package.json:7` pins `dev:paint` to `pnpm --filter @efxlab/efx-physic-paint demo:dev`. | closed |
| T-34-02 | 34-01 | Tampering | `packages/efx-physic-paint/package.json` scripts/exports/files | mitigate | `packages/efx-physic-paint/package.json:55-59` separates demo scripts from `build`/`dev:watch`/`check`; `packages/efx-physic-paint/package.json:29-45` keeps demo out of exports/files. | closed |
| T-34-SC | 34-01 | Tampering | pnpm installs | mitigate | `packages/efx-physic-paint/package.json:62,67` and `pnpm-lock.yaml:112-114,127-129` use approved `@preact/preset-vite@^2.10.5` and `vite@5.4.21` metadata. | closed |
| T-34-03 | 34-02 | Tampering | `demo/src/main.tsx` rendered copy | mitigate | `packages/efx-physic-paint/demo/src/App.tsx:87-88`, `packages/efx-physic-paint/demo/src/App.tsx:41`, and `packages/efx-physic-paint/demo/src/main.tsx:13` render static JSX/textContent strings; focused grep found no `dangerouslySetInnerHTML` in demo source. | closed |
| T-34-04 | 34-02 | Information Disclosure | `demo/vite.config.ts` and served files | mitigate | `packages/efx-physic-paint/demo/src/App.tsx:28-33` intentionally loads the three bundled demo paper textures from `/img/`; `packages/efx-physic-paint/demo/public/img/paper_1.jpg`, `paper_2.jpg`, and `paper_3.jpg` are static package demo assets, not app/user/private files; no runtime file access or editor asset path is exposed. | closed |
| T-34-05 | 34-02 | Elevation of Privilege | Demo runtime boundary | mitigate | `packages/efx-physic-paint/demo/src/App.tsx:2` imports `EfxPaintCanvas` from the public Preact subpath; focused grep found no imports from `app/`, `@tauri-apps/*`, editor stores, or package engine internals in demo source. | closed |
| T-34-06 | 34-02 | Denial of Service | Missing mount root or failed canvas wrapper mount | mitigate | `packages/efx-physic-paint/demo/src/main.tsx:5,10-14` implements the visible root-mount error; `packages/efx-physic-paint/demo/src/App.tsx:7,13-17,41` implements the visible canvas-wrapper mount error. | closed |
| T-34-SC | 34-02 | Tampering | Vite/Preact dev dependency execution | mitigate | `packages/efx-physic-paint/package.json:62,67` and `pnpm-lock.yaml:112-114,127-129` use approved `@preact/preset-vite@^2.10.5` and `vite@5.4.21`; `34-02-SUMMARY.md:102-103` records `demo:build` and `check` passing. | closed |
| T-34-07 | 34-03 | Spoofing | README workflow identity | mitigate | `packages/efx-physic-paint/README.md:117` states `pnpm dev:paint` launches the standalone package demo; `packages/efx-physic-paint/README.md:125` states it is not an editor paint-layer integration. | closed |
| T-34-08 | 34-03 | Tampering | README command examples | mitigate | `packages/efx-physic-paint/README.md:101-114` documents commands matching `package.json:7` and `packages/efx-physic-paint/package.json:55-59`. | closed |
| T-34-09 | 34-03 | Information Disclosure | README workflow guidance | mitigate | `packages/efx-physic-paint/README.md:121-125` distinguishes app Vite, Tauri desktop, and standalone browser demo workflows, and states demo files are not exports or `tsup` entries. | closed |
| T-34-10 | 34-03 | Tampering | README API examples | mitigate | `packages/efx-physic-paint/README.md:52-54` uses current public `papers`, `defaultPaper`, and `onEngineReady` props; focused grep found no stale `paperPath` or `onEngine={(engine)}` examples. | closed |
| T-34-SC | 34-03 | Tampering | package manager commands in docs | accept | Accepted risk entry `R-34-SC-03` is present in the Accepted Risks Log below; `packages/efx-physic-paint/README.md:96-114` documents pnpm commands only and Plan 03 added no installs. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-34-SC-03 | T-34-SC / 34-03 | Plan 03 is documentation-only and documents pnpm commands only. Package legitimacy and dependency installation were handled in Plans 01/02; no new installs are introduced by Plan 03. | Plan 03 threat register | 2026-06-08 |

---

## Threat Flags Review

| Summary | Threat Flags | Mapping | Status |
|---------|--------------|---------|--------|
| 34-01-SUMMARY.md | None. Changes are limited to existing package-manager and local developer script surfaces covered by the plan threat model. | Existing Plan 01 threats | no unregistered flag |
| 34-02-SUMMARY.md | None. Implementation did not add network endpoints, auth paths, file access patterns, schema changes, or new trust-boundary surfaces beyond the planned Vite demo/browser DOM/runtime boundary. | Existing Plan 02 threats | no unregistered flag |
| 34-03-SUMMARY.md | None. Documentation only; no new network endpoints, auth paths, file access patterns, or schema changes. | Existing Plan 03 threats | no unregistered flag |

---

## Open Threats

None.

---

## Security Audit Trail

| Audit Date | Threat Rows Total | Closed | Open | Unregistered Flags | Run By |
|------------|-------------------|--------|------|--------------------|--------|
| 2026-06-08 | 13 | 13 | 0 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-08
