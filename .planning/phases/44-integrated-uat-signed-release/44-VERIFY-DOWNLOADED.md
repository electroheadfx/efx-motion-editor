# Phase 44: Downloaded-Artifact Verification Evidence (REL-03)

**Plan:** 44-03 (release + publish)
**Status:** DRAFT CREATED — awaiting user download + verify-downloaded + install/launch

## 1. Draft release creation (Task 1)

- **Command:** `gh release create v0.9.0 --draft --title "EFX Motion Editor v0.9.0" app/src-tauri/target/release/bundle/dmg/*_0.9.0_*.dmg`
- **Draft URL:** https://github.com/electroheadfx/efx-motion-editor/releases/tag/untagged-6d09bec41a2f19f4bbd3
- **Draft state:** `isDraft: true` (verified via `gh release view v0.9.0 --json isDraft --jq .isDraft`)
- **Uploaded asset:** `EFX.Motion.Editor_0.9.0_aarch64.dmg`
  - GitHub converts spaces in uploaded asset filenames to dots. The local source file is `EFX Motion Editor_0.9.0_aarch64.dmg` (15.7 MB, mtime Aug 21 12:32). This matches the established v0.8.1 pattern (`EFX.Motion.Editor_0.8.1_aarch64.dmg`).
- **Source DMG:** `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_0.9.0_aarch64.dmg` (signed/notarized/stapled per 44-RELEASE.md)

## 2. Download path for the user (Task 2)

Download the asset from the draft release URL above in a **clean session / fresh download** (not the local bundle path). The downloaded file will be named `EFX.Motion.Editor_0.9.0_aarch64.dmg` (dots, per GitHub's upload naming).

## 3. verify-downloaded contract (credential-free)

```bash
bash scripts/macos-release.sh verify-downloaded /absolute/path/to/EFX.Motion.Editor_0.9.0_aarch64.dmg
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
5. Confirm the icon on the launched/downloaded app surface (not the dev machine — icon caches lie per D-05).

## 5. Results (filled in after user download + agent verify)

- [ ] verify-downloaded → `DOWNLOADED ARTIFACT PASS`
- [ ] App launched normally from Applications without Gatekeeper bypass
- [ ] Icon verified on the downloaded artifact
