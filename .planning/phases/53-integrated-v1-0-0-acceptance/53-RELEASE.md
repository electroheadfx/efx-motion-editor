# Phase 53: Signed Release Ledger (v1.0.0)

**Plan:** 53-04 — distribution: user push + immutable tag (D-19) → GitHub draft with D-18 notes → downloaded-artifact verification (ACC-03)
**Status:** IN PROGRESS — Task 1 CLEARED (tag verified) + Task 2 DONE (D-18 notes + draft release created, still unpublished); awaiting Task 3 human-verify (downloaded-artifact verification)
**Recorded:** 2026-10-11 (agent, read-only checks only — no push, no credential file touched)
**Sequence lock (D-05 + skill §1):** push `main` + annotated tag → agent verifies read-only → `gh release create --draft` with notes + DMG → verify-downloaded + install/smoke → (53-05: stop conditions + publish decision)

## Pre-conditions (agent-verified this session — credential-free, read-only)

Modeled on the Phase 44 pre-conditions table. Every row cites its source ledger.

| # | Check | Result | Evidence / source ledger |
|---|-------|--------|--------------------------|
| 1 | Six REL-01 gates green (53-01) | **PASS** | `53-GATES.md` — REL-01-1…6 all `exit 0`, captured fresh 2026-10-11 10:18:43–10:21:03 local (vitest 259 files / 0 failed, typecheck, `pnpm build`, `cargo test`, `bash -n`, `PREFLIGHT PASS`) |
| 2 | Zero stale bundles in `bundle/macos` + no `_0.9.0_` DMG (53-01 archival) | **PASS** | `53-GATES.md` archival record — 2 artifacts moved (never deleted) to `app/src-tauri/target/release/bundle/archive-v0.9.0-20261011/`; re-checked this session: `bundle/macos` holds 0 `.app`, `bundle/dmg` holds 0 `*_0.9.0_*.dmg` |
| 3 | Signed/notarized/stapled DMG exists (53-03) | **PASS** | `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_1.0.0_aarch64.dmg` — 15,942,003 bytes, mtime **Oct 11 12:11:14 2026 (local)**; `bundle/dmg/notarization-evidence/` present; freshness by inner-binary mtime **Oct 11 12:09:58 2026** recorded in `53-UAT.md` header (skill rule 6) |
| 4 | Five version surfaces at 1.0.0 (53-01) | **PASS** | `app/package.json:4`, `app/src-tauri/tauri.conf.json:4`, `app/src-tauri/Cargo.toml:3`, `app/src-tauri/Cargo.lock` (efx-motion-editor block), `scripts/macos-release.sh:10` `PRODUCT_VERSION` — all read `1.0.0` (re-read this session); pinned by `releaseContract.test.ts` (11 passed) |
| 5 | Comprehensive signed UAT pass recorded (53-03) | **PASS** | `53-UAT.md` **Result:** 36 pass, 6 na, 0 fail — 42/42 verdicts, user-approved; export archived as `53-UAT.json` (`complete: true`, `missing: []`) |

**Observation (recorded, not a failure):** `bundle/macos/` no longer holds the signed 1.0.0 `.app` that was present during 53-03 (the folder now contains only `.DS_Store`). The pre-condition row above is "zero stale bundles" and the distributable for this plan is the **DMG** (row 3, present and freshness-proven); nothing in 53-04 reads `bundle/macos/`. Noted so a later plan never infers freshness from that directory.

**Hard boundaries in force:** D-21 (no functional source fixes — record, never fix), D-22 (no credential/certificate file accessed, opened, or searched), no `git push` / no `git fetch` by the agent, no publish and no `--latest` (53-05 owns the publish decision).

## Remote state at recording time (read-only `git ls-remote`)

| Ref | Value |
|-----|-------|
| `refs/heads/main` on origin (at Task 1 recording) | `3e6bc8cf4ef68937e902cc32f242b9bb603a6d25` |
| `refs/heads/main` on origin (post-push, re-checked) | `a2ec4b2f4a88d72d246aba69e33c991b21b07059` — equals the tag target (README rebuild commits `9c21b0fa`/`1a42ff2c` + merge `a2ec4b2f` landed between the Task 1 recording and the user's push) |
| `refs/tags/v1.0.0` on origin | **present** — annotated tag object `32cf5283953fe19e432322a3bac6007bd35d0f9f` (verified below) |
| Local `v1.0.0` tag | **present** — the same annotated tag object `32cf5283…`, dereferencing to commit `a2ec4b2f` |

The bump commit (`359ada83`) is an ancestor of the tag target (`a2ec4b2f` — `git merge-base --is-ancestor` exit 0). `app/package.json` at the tag reads `"version": "1.0.0"`.

## Task 1 — tag creation + push (D-19, user-owned)

**Awaiting the user.** The user runs, from their own terminal at the repo root (main checkout):

```bash
git push origin main        # no-op expected — origin/main already equals local main
git tag -a v1.0.0 -m "EFX Motion Editor v1.0.0"
git push origin v1.0.0
```

The agent issues no push command (memory: user handles push/remote ops).

### Tag verification outputs (agent, read-only — captured 2026-10-11 after the user's push)

| Check | Command | Output |
|-------|---------|--------|
| Tag present on origin | `git ls-remote --tags origin refs/tags/v1.0.0` | `32cf5283953fe19e432322a3bac6007bd35d0f9f\trefs/tags/v1.0.0` — **PASS** |
| Local tag object matches remote | `git rev-parse v1.0.0` | `32cf5283953fe19e432322a3bac6007bd35d0f9f` (identical annotated tag object; type `tag`) |
| Tag dereferences to the bump commit | `git rev-parse v1.0.0^{commit}` | `a2ec4b2f4a88d72d246aba69e33c991b21b07059` — equals `refs/heads/main` on origin (`git ls-remote origin refs/heads/main` → same SHA) |
| Tag points at the 1.0.0 bump commit | `git show v1.0.0:app/package.json` → `grep '"version"'` | `"version": "1.0.0"` — **PASS** (stale-tag gate, v0.8.0 lesson) |
| Bump ancestry | `git merge-base --is-ancestor 359ada83 v1.0.0` | exit 0 — the 1.0.0 bump commit is inside the tagged tree |

**Task 1 verdict: PASS (5/5).** All checks green; the agent issued no push command — the user
pushed `main` and created/pushed the annotated tag (D-19). No `gh release` command ran in this
task; the draft comes next (Task 2).

> If any check had failed, execution would stop and be flagged: a pushed tag is immutable release
> history — only the user may decide a delete-and-retag (v0.8.0 lesson).

## Release notes (D-18) — WRITTEN in Task 2, filled into the draft before any publish step

Authored per the skill template (`SKILL.md:91-105`): three D-18 headline sections + the verbatim
release-verification footer. The exact text below is byte-identical to the draft's `body`
(`gh release view v1.0.0 --json body` diffed clean against the notes file used at create time).

```markdown
## What shipped

### Multi-track Frames and Reveal

EFX Paint is now a full multi-track frame document: independent Paint tracks with hide/solo, opacity and blend modes, filmstrip capsules, a fixed Background track with imported still/sequence Loop Clips (finite or infinite repeats, gaps, fallback), and a durable Photo/Reference track for painting reference and Reveal source. **Frames and Reveal** exposes it all in the timeline — paint and rotoscope across tracks, then reveal the photo source through animated coverage baked into keys from one or more Paint tracks. Read-only audio preview stays synchronized while you play (play-from-cursor and audible scrub included), and a WYSIWYG compositor export renders every painted frame — paint-only or mixed projects, both canvas orientations — so what you see on the canvas is what lands in the PNG sequence or video.

### Project package format (.mce)

Projects are now macOS document packages: `Name.mce` holds a light manifest, per-layer sub-files, and `frames/` media as references only, with a machine-local derived cache and a multi-file save transaction. The package is self-contained for sharing, opens by Finder double-click with a single icon, and the legacy flat format is rejected explicitly — a clean break with no silent migration.

### HD native runtime + performance work

The frame runtime moved from base64 data URLs to bytes/ImageBitmap, with PNG→WebP-lossless encode/decode in Rust and a byte-budgeted LRU sidecar cache — raising the working resolution to native HD so big projects paint without main-thread jank or heap blowup. Alongside it: structured bristle footprints that keep the gesture in every stroke, deterministic stop-motion physics, native Tauri window and frame sync, and the release-path hardening (version contract, icon contract, credential-free preflight) that makes a signed build reproducible.

---

**Release verification:** signed and notarized with Apple Developer ID; passed Gatekeeper assessment, downloaded-artifact verification, and normal launch without security overrides.
```

## Draft release creation (Task 2) — DONE 2026-10-11

- **Command (exactly as the plan specifies):**
  `gh release create v1.0.0 --draft --title "EFX Motion Editor v1.0.0" --notes-file <notes> "<DMG path>"`
  - Notes file: `/tmp/53-04-v1.0.0-notes.md` (the text reproduced above)
  - DMG path: `app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_1.0.0_aarch64.dmg` —
    main-repo build output (worktrees hold no `target/`), stat-checked against this ledger's
    pre-conditions row 3 immediately before upload: **15,942,003 bytes, mtime Oct 11 12:11:14 2026
    (local)** — unchanged since the 53-03 signing run, exactly one `*_1.0.0_*.dmg` present.
- **Draft URL:** https://github.com/electroheadfx/efx-motion-editor/releases/tag/untagged-6774ba4d622d57031c05
  (drafts show an `untagged-…` slug until published — expected; `tagName` is already `v1.0.0`)
- **Asset name:** `EFX.Motion.Editor_1.0.0_aarch64.dmg` — 15,942,003 bytes (GitHub converts
  spaces → dots; matches the v0.8.1/v0.9.0 naming pattern)
- **Create timestamp:** `2026-10-11T15:54:27Z`
- **Verification JSON excerpts (captured right after create):**

```json
{"isDraft": true, "tagName": "v1.0.0", "url": "https://github.com/electroheadfx/efx-motion-editor/releases/tag/untagged-6774ba4d622d57031c05", "createdAt": "2026-10-11T15:54:27Z", "assets": [{"name": "EFX.Motion.Editor_1.0.0_aarch64.dmg", "size": 15942003}]}
```

- **Plan gate (`<verify>`) result:** `TASK2_GATE_PASS` — `gh release view v1.0.0 --json isDraft`
  → `"isDraft":true`, and the assets list holds exactly one name matching `_1.0.0_.*\.dmg`.
- **Notes-before-publish (skill hard rule 2):** notes were passed via `--notes-file` at create
  time; a `diff` of the draft body against the notes file is clean — the draft never existed empty.
- No pre-existing release was found before create (`gh release view v1.0.0` → "release not
  found"), so nothing was mutated (D-21 discipline).

**Prohibition (frontmatter, ACC-03 sequence lock):** MUST NOT publish (`--draft=false`) and MUST NOT set `--latest` in this plan — that is 53-05's gated decision.

---
*Phase: 53-integrated-v1-0-0-acceptance · Plan 53-04 · created 2026-10-11*
