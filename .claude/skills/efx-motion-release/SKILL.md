---
name: efx-motion-release
description: End-to-end signed macOS release workflow for EFX Motion Editor milestones. Use when planning or executing a milestone's final release phase (version bump, gates, credentialed sign/notarize, signed UAT, GitHub publish). Encodes every v0.8.1/v0.9.0 lesson so the release runs without improvisation.
---

# EFX Motion Release Workflow

Proven path from v0.8.1 and v0.9.0. The final phase of every milestone follows this sequence exactly. Do not improvise; every rule below comes from a real incident.

## Hard rules (non-negotiable)

1. **Push `main` BEFORE any `gh release create`.** GitHub creates the release tag on the remote default-branch HEAD. If local `main` is ahead and unpushed, the tag lands on a stale commit. *v0.9.0 incident: the published tag pointed at a commit where `package.json` still said 0.8.1.*
2. **Write the release notes into the draft BEFORE publishing.** `--latest` publishes whatever is there, including an empty body.
3. **Update the README release section before milestone closure.**
4. **Never touch Apple certificate files.** Credentials enter only through the user-run wrapper (below), never the repo, planning files, or agent context.
5. **Deleting a published release's tag reverts the release to draft.** If a tag must be retargeted, republish immediately after: `gh release edit <tag> --draft=false --latest`.
6. **Bundle freshness is judged by the inner binary mtime** of `app/src-tauri/target/release/bundle/macos/EFX Motion Editor.app`, never by `bundle/dmg/` (stale DMGs linger there).
7. **CSP/permission questions are proven on the packaged build only**, never the dev server.
8. **The stop-condition checklist is a hard gate.** Any active condition blocks publish. No silent pass, no warnings-mode.
9. **Release phase = zero functional code changes.** A UAT bug stops the phase; the fix lands in a follow-up quick/debug, then the release phase re-runs.

## Sequence

### 1. Pre-flight repository state

- [ ] README release section updated to the new version
- [ ] Version bumped atomically on all 5 surfaces: `app/package.json`, `app/src-tauri/tauri.conf.json`, `app/src-tauri/Cargo.toml`, the `efx-motion-editor` entry in `app/src-tauri/Cargo.lock`, `PRODUCT_VERSION` in `scripts/macos-release.sh` — verified green by `releaseContract.test.ts`
- [ ] Icon contract intact: the 5 canonical desktop icons (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`) tracked; extras and the 1024×1024 source stay out of Git (regenerable via `pnpm --dir app tauri icon src-tauri/app-icon.png`; source must be SQUARE)
- [ ] Archive stale previous-version bundles out of `app/src-tauri/target/release/bundle/`

### 2. Automated gates (exact order, all green)

```bash
pnpm --dir app exec vitest run
pnpm --dir app run typecheck
pnpm build
cargo test --manifest-path app/src-tauri/Cargo.toml
bash -n scripts/macos-release.sh
bash scripts/macos-release.sh preflight
```

Any failure: stop and flag; the user decides fix-and-rerun vs defer.

### 3. Credentialed release (user-run, the only credentialed step)

The user runs from the repo root in their own terminal:

```bash
~/.config/efx/scripts/efx-release-efx-motion
```

The wrapper prompts for the **trusted Apple environment file** (drag-and-drop at the prompt) — the file containing the four `export APPLE_*` lines, **NOT the `.p8` key file** (dragging the `.p8` fails with `command not found: -----BEGIN`). It sources and validates the vars, runs `scripts/macos-release.sh release`, and trap-unsets everything on exit.

Expected ledger: `RELEASE PASS` with app + DMG signature, Developer ID team, Hardened Runtime, Gatekeeper, notarization (`Accepted`), and stapler checks. The agent records the ledger and verifies freshness by inner-binary mtime.

### 4. Signed packaged-app UAT (user oracle, one comprehensive pass)

The user launches `bundle/macos/EFX Motion Editor.app` and walks the milestone spec's numbered UAT list, including any signed-artifact boundary handed off from earlier phases (for v0.9.0: linked-loop preview/export parity + unresolved-loop export block). Summarized evidence plus the user's visual confirmation is sufficient. Any failing step: flag with step number + screenshot; no in-phase fix.

### 5. GitHub draft + notes + downloaded-artifact verification

```bash
gh release create vX.Y.Z --draft --title "EFX Motion Editor vX.Y.Z" <dmg>
# Then IMMEDIATELY fill the notes (see template below) — before any publish
gh release edit vX.Y.Z --notes "<release notes>"
```

- The user downloads the DMG from the draft (separate path, e.g. browser download — never the local bundle) and reports the absolute path.
- `bash scripts/macos-release.sh verify-downloaded <path>` → expect `DOWNLOADED ARTIFACT PASS`.
- The user installs into Applications and launches **normally** (double-click, no Control-click bypass). The app must open with no Gatekeeper prompt; icon surfaces (Finder/Dock/DMG) show the current artwork; macOS reports the new version.

### 6. Stop-condition checklist + publish

Record every "do not publish if" condition from the milestone spec as individually NOT ACTIVE. Only then:

```bash
gh release edit vX.Y.Z --draft=false --latest
```

Verify: `gh api repos/<owner>/<repo>/releases/latest --jq .tag_name` returns the new tag.

### 7. Post-publish tag verification (mandatory since v0.9.0)

```bash
git ls-remote --tags origin vX.Y.Z            # tag commit
git show vX.Y.Z:app/package.json | grep version   # must equal the shipped version
```

If the tag points at a wrong commit: push `main`, delete the remote tag (`git push origin --delete vX.Y.Z`), recreate the annotated tag at the correct commit, push it, then republish (`gh release edit vX.Y.Z --draft=false --latest`) — deleting the tag reverts the release to draft.

## Release notes template

Lead with features; end with the verification footer:

```markdown
## What shipped

### <Headline feature 1>
### <Headline feature 2>
...

---

**Release verification:** signed and notarized with Apple Developer ID; passed Gatekeeper assessment, downloaded-artifact verification, and normal launch without security overrides.
```

## Failure handling

- **Any gate/UAT failure mid-window**: stop and flag (step number + evidence). The user decides fix-and-rerun or defer. No silent pass.
- **Wrapper fails on credentials**: check the dragged file is the env file with four `export APPLE_` lines; the `.p8` appears only as the quoted value of `APPLE_API_KEY_PATH`.
- **Notarization slow**: 2–10 minutes is normal; do not close the terminal.

## References

- `scripts/macos-release.sh` — frozen credential-free pipeline (preflight/release/verify-downloaded)
- `docs/macos-signed-release.md`, `docs/macos-developer-id-setup.md` — runbooks (manual 4-export flow is the documented fallback)
- `app/src/releaseContract.test.ts`, `app/src/viteBuild.test.ts` — version/icon/bundle contracts
- v0.9.0 phase artifacts: `.planning/phases/44-integrated-uat-signed-release/`
