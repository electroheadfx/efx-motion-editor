# Phase 53: Downloaded-Artifact Verification Evidence (ACC-03)

**Plan:** 53-04 (distribution: tag + draft + downloaded verification)
**Status:** SEEDED — draft created with notes + DMG; **awaiting Task 3 human-verify (user downloads the DMG, agent runs verify-downloaded, user installs + D-06 covering smoke)**
**Seeded:** 2026-10-11 (agent, Task 2)
**Credential boundary (D-22):** no Apple credential file accessed, opened, or searched — verify-downloaded is credential-free.

## 1. Draft release creation (Task 2 — done)

- **Command:** `gh release create v1.0.0 --draft --title "EFX Motion Editor v1.0.0" --notes-file <notes> "app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_1.0.0_aarch64.dmg"`
- **Draft URL:** https://github.com/electroheadfx/efx-motion-editor/releases/tag/untagged-6774ba4d622d57031c05
- **Draft state:** `isDraft: true` (verified via `gh release view v1.0.0 --json isDraft` → `{"isDraft":true}`); created `2026-10-11T15:54:27Z`
- **Uploaded asset:** `EFX.Motion.Editor_1.0.0_aarch64.dmg` (15,942,003 bytes — exactly matches the local source size)
  - GitHub converts spaces in uploaded asset filenames to dots. The local source file is `EFX Motion Editor_1.0.0_aarch64.dmg` (15,942,003 bytes, mtime Oct 11 12:11:14 2026 local). Same pattern as v0.8.1/v0.9.0.
- **Source DMG:** `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_1.0.0_aarch64.dmg` (signed/notarized/stapled per 53-03 / `53-UAT.md`)
- **Notes:** D-18 milestone notes were passed at create time via `--notes-file` (skill hard rule 2 — the draft never existed empty); full text in `53-RELEASE.md`.
- **Not published:** no `--draft=false`, no `--latest` — publish is plan 53-05's gated decision.

## 2. Download path for the user (Task 3)

Download the asset from the draft release URL above in a **normal browser / clean session — fresh bytes over the network, never the local bundle path**. The downloaded file will be named `EFX.Motion.Editor_1.0.0_aarch64.dmg` (dots, per GitHub's upload naming). Report the absolute path of the download.

## 3. verify-downloaded contract (credential-free, agent-run)

```bash
bash scripts/macos-release.sh verify-downloaded /absolute/path/to/EFX.Motion.Editor_1.0.0_aarch64.dmg
```

Expected ledger:

```text
DOWNLOADED ARTIFACT PASS
- dmg: <ABSOLUTE-PATH-TO-DOWNLOADED-DMG>
- DMG integrity/signature/ticket/Gatekeeper checks passed
- contained app signature/team/Hardened Runtime/no-custom-entitlements/ticket/Gatekeeper checks passed
- normal visible launch remains a required user-owned check
```

## 4. Install + normal launch (user-owned)

1. Open the downloaded DMG normally.
2. Drag **EFX Motion Editor.app** to **Applications**.
3. Launch it normally from Finder or Launchpad (double-click; NO Control-click > Open, NO Gatekeeper bypass).
4. Confirm macOS does not report an unidentified developer or damaged application and the normal EFX Motion Editor main window appears.
5. Confirm the icon on the launched/downloaded app surface (not the dev machine — icon caches lie).

## 5. D-06 covering smoke on the installed copy (user-driven, agent observes)

Scope per D-06 (~15-20 min — a covering smoke, NOT a second full pass):

- [ ] (a) **Quarantine first-open:** first open after download shows the normal quarantine prompt path resolving cleanly to a launched app
- [ ] (b) **Package double-click:** the D-03 through-line `.mce` opens via Finder double-click (package association works)
- [ ] (c) **Paint:** one paint stroke renders
- [ ] (d) **Save:** save succeeds
- [ ] (e) **Export:** a short PNG export succeeds

Any failure is FLAGGED, not fixed in-phase (D-21 — release-only phase). A failure stops the plan.

## 6. Results (filled in during Task 3)

- [ ] verify-downloaded → `DOWNLOADED ARTIFACT PASS` on the browser-downloaded DMG
- [ ] App installed to Applications and launched normally without Gatekeeper bypass / right-click override
- [ ] Icon verified on the downloaded artifact surface
- [ ] All five D-06 covering-smoke items recorded (see section 5)
- [ ] User confirmation line present

### 6.1 verify-downloaded output (agent-run — PENDING)

**Downloaded DMG path:** _pending_

**Output (verbatim):** _pending_

### 6.2 Install + normal launch (user-owned — PENDING)

_pending_

### 6.3 D-06 covering smoke results (PENDING)

| # | Smoke item | Result |
|---|-----------|--------|
| a | Quarantine first-open resolves cleanly | _pending_ |
| b | Through-line `.mce` opens via Finder double-click | _pending_ |
| c | One paint stroke renders | _pending_ |
| d | Save succeeds | _pending_ |
| e | Short PNG export succeeds | _pending_ |

### 6.4 User confirmation (PENDING)

_pending — the completed ledger is submitted for the user's explicit approval before the checkpoint resolves_

---
*Phase: 53-integrated-v1-0-0-acceptance · Plan 53-04 · seeded 2026-10-11*
