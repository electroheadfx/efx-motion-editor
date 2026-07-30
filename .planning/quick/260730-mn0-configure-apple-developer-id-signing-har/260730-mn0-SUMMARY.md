---
phase: quick-260730-mn0-configure-apple-developer-id-signing-har
plan: 01
subsystem: release
tags: [macos, tauri, developer-id, notarization, gatekeeper, documentation]

# Dependency graph
requires:
  - phase: v0.8.0 milestone closure
    provides: deferred requirement for Developer ID signing, notarization, stapling, and Gatekeeper validation
provides:
  - Secret-safe CLI workflow for Tauri app and DMG signing, notarization, stapling, and validation
  - Explicit Hardened Runtime configuration with no custom entitlement exceptions
  - Verified Developer ID Application identity and App Store Connect Team Key setup procedure
  - Durable setup and signed-release runbooks with resolved troubleshooting cases
affects: [v0.8.0-release, macos-distribution, milestone-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Release credentials stay outside the repository and enter only through terminal-session environment variables"
    - "Capability probes determine whether Apple Command Line Tools are sufficient; full Xcode is not assumed"
    - "Credentialed release evidence is never inferred from preparation or preflight success"

key-files:
  created:
    - scripts/macos-release.sh
    - docs/macos-developer-id-setup.md
    - docs/macos-signed-release.md
  modified:
    - app/src-tauri/tauri.conf.json
    - .gitignore

key-decisions:
  - "Use Developer ID Application with the modern G2 Sub-CA and retain the public G2 intermediate in the System keychain"
  - "Use an App Store Connect Team Key with Developer access and a one-time .p8 download stored outside the repository"
  - "Do not store signing/notarization values in an app-local or repository-local .env file"
  - "Close this quick task as preparation complete; run the real release only after /gsd-audit-milestone and /gsd-complete-milestone"

requirements-completed: [QUICK-260730-MN0]
completion-scope: preparation-only

coverage:
  - id: D1
    description: "The repository has a fail-loud Developer ID release workflow with Hardened Runtime, app/DMG notarization, stapling, codesign, Gatekeeper, and downloaded-artifact checks"
    requirement: QUICK-260730-MN0
    verification:
      - kind: other
        ref: "bash -n scripts/macos-release.sh && bash scripts/macos-release.sh preflight"
        status: pass
    human_judgment: false
  - id: D2
    description: "The release Mac has exactly one valid Developer ID Application signing identity and the required Developer ID G2 trust chain"
    requirement: QUICK-260730-MN0
    verification:
      - kind: manual
        ref: "Keychain Access screenshots plus user-run security find-identity -v -p codesigning"
        status: pass
    human_judgment: true
  - id: D3
    description: "An App Store Connect Team Key with Developer access was created and its one-time private key was downloaded without entering repository state"
    requirement: QUICK-260730-MN0
    verification:
      - kind: manual
        ref: "App Store Connect Team Keys screenshots"
        status: pass
    human_judgment: true
  - id: D4
    description: "The real credentialed build, Apple Accepted results, stapling, Gatekeeper checks, downloaded-artifact verification, and normal launch"
    requirement: QUICK-260730-MN0
    verification:
      - kind: deferred
        ref: "docs/macos-signed-release.md"
        status: not-run
    human_judgment: true

# Metrics
duration: 2h51m
completed: 2026-07-30
status: complete
---

# Quick 260730-mn0: Apple Developer ID Release Preparation Summary

**EFX Motion Editor now has a secret-safe macOS release workflow, a valid local Developer ID identity, App Store Connect API-key preparation, and complete operational documentation; the real signed/notarized release remains intentionally deferred.**

## Performance

- **Started:** 2026-07-30T14:18:01Z
- **Completed:** 2026-07-30T17:09:16Z
- **Duration:** 2h51m, including interactive Apple portal and Keychain setup
- **Implementation commits:** 2
- **Product files created/modified:** 5

## Accomplishments

- Added `scripts/macos-release.sh` with `preflight`, `release`, and `verify-downloaded` modes.
- Explicitly enabled Tauri macOS Hardened Runtime without adding entitlement exceptions.
- Added defense-in-depth ignore rules for `.p12`, `.p8`, and `.key` private assets.
- Proved that the selected `/Library/Developer/CommandLineTools` installation exposes `codesign`, `security`, `notarytool`, and `stapler`; full Xcode is not required on this Mac.
- Completed the live Developer ID Application setup with the modern G2 chain and exactly one usable signing identity.
- Enabled App Store Connect API access and created a Team Key with Developer access without recording its identifiers or private key in the repository.
- Added two durable guides covering setup, all encountered problems and resolutions, release execution, troubleshooting, evidence collection, and external Gatekeeper validation.

## Task Commits

1. **Add Developer ID release workflow** — `b71f2aa1`
2. **Document Apple signing release workflow** — `1292351a`

**Plan and summary metadata:** handled by the final orchestrator documentation commit.

## Files Created/Modified

- `scripts/macos-release.sh` — fail-loud tool/config/private-asset preflight, Tauri app and DMG build, explicit DMG notarization, stapling, local verification, and downloaded-artifact verification.
- `app/src-tauri/tauri.conf.json` — explicit `bundle.macOS.hardenedRuntime: true` with no custom entitlements.
- `.gitignore` — ignores Apple private certificate/key containers.
- `docs/macos-developer-id-setup.md` — complete Apple portal, Keychain, G2 trust-chain, API-key, backup, and troubleshooting runbook.
- `docs/macos-signed-release.md` — safe environment setup, script modes, exact release behavior, expected evidence, failure handling, and second-environment validation.

## Problems Encountered and Resolved

- Opened the Passwords/passkeys application instead of Keychain Access; switched to `Trousseaux d’accès` and its certificate assistant.
- Initially selected Developer ID Installer; corrected to Developer ID Application.
- Initially selected Previous Sub-CA; corrected to the modern G2 Sub-CA.
- The personal certificate landed in System while its CSR private key remained in session, producing zero usable identities; copied the leaf into session.
- The certificate appeared untrusted because only the older 2027 intermediate was installed; installed Apple's public Developer ID G2 intermediate expiring in 2031 without overriding trust settings.
- Keychain drag-and-drop failed; copy/paste succeeded.
- Copying temporarily produced two identical usable identities; removed only the duplicate personal leaf from System while retaining the session identity and G2 intermediate, yielding exactly one valid identity.
- Clarified that `APPLE_SIGNING_IDENTITY` is the full Keychain identity string, not an email address or Team ID alone.
- Clarified that release values belong in temporary terminal exports, never an app-local `.env` file.

## Verification

Passed:

```text
bash -n scripts/macos-release.sh
bash scripts/macos-release.sh preflight
git diff --check
security find-identity -v -p codesigning -> 1 valid identity
```

The preflight concluded with:

```text
PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards
```

## Scope Change and Deferred Execution

The original plan included an immediate credentialed release and second-environment Gatekeeper proof. During the interactive checkpoint, the user explicitly chose to close this quick task after preparation and documentation, then run the signed release after:

1. `/gsd-audit-milestone`
2. `/gsd-complete-milestone`

Therefore this summary does **not** claim:

- a successful signed v0.8.0 app or DMG build;
- Apple notarization status `Accepted` for the app or DMG;
- stapled-ticket validation;
- local or downloaded-artifact Gatekeeper acceptance;
- successful normal launch on another Mac or clean user session.

Those checks remain mandatory release operations documented in `docs/macos-signed-release.md`.

## User-Owned Security State

The following remain outside the repository and are not recorded here:

- Developer ID private key and any `.p12` backup/password;
- App Store Connect Issuer ID and Key ID;
- the one-time `.p8` private key and its absolute path;
- any local terminal environment values.

## Next Steps

1. Run `/gsd-audit-milestone`.
2. Run `/gsd-complete-milestone`.
3. Follow `docs/macos-signed-release.md` from a fresh terminal.
4. Preserve redacted Apple `Accepted` and PASS evidence.
5. Upload and re-download the DMG through the intended channel.
6. Run `verify-downloaded` on another Mac or clean macOS session.
7. Launch normally without Control-click/Open or a Gatekeeper override.

## Self-Check: PASSED FOR PREPARATION SCOPE

- FOUND: `scripts/macos-release.sh`
- FOUND: `docs/macos-developer-id-setup.md`
- FOUND: `docs/macos-signed-release.md`
- FOUND: `app/src-tauri/tauri.conf.json` with Hardened Runtime enabled
- FOUND: `.gitignore` private Apple asset patterns
- FOUND: implementation commit `b71f2aa1`
- FOUND: documentation commit `1292351a`
- NOT RUN BY DESIGN: credentialed release and external distribution validation

---
*Phase: quick-260730-mn0-configure-apple-developer-id-signing-har*
*Completed: 2026-07-30 — preparation scope only*
