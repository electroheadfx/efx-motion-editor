# Phase 53: Downloaded-Artifact Verification Evidence (ACC-03)

**Plan:** 53-04 (distribution: tag + draft + downloaded verification)
**Status:** AUTOMATED EVIDENCE DONE — agent downloaded the draft asset fresh (SHA-256 matches local build) and verify-downloaded returned **DOWNLOADED ARTIFACT PASS**; **awaiting Task 3 human-verify: user install + normal launch + D-06 covering smoke + confirmation**
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

## 6. Results (filled in during Task 3 + post-rebuild re-verification)

- [x] verify-downloaded → `DOWNLOADED ARTIFACT PASS` on the freshly downloaded DMG (agent download, SHA-256-identical to local build)
- [x] App installed to Applications and launched normally without Gatekeeper bypass / right-click override (user, both the first DMG and the rebuilt one)
- [x] Icon verified on the downloaded artifact surface (user: "DMG work", app launches and renders)
- [x] All five D-06 covering-smoke items recorded (see section 5) — items a–e exercised across the first-DMG smoke and the rebuilt-DMG re-smoke
- [x] User confirmation line present ("I tested dmg look good !")

### Rebuild note (same session)

The published asset is the **rebuilt** DMG `3fd008b2…` (15,942,200 B), not the first `d94b5ad0…` (15,942,003 B). The first build surfaced a packaged-only theme defect during D-06 smoke (physic-paint rail grey in medium theme). A user-approved scoped fix (`6f60951f`, TimelineRenderer hex-expansion) landed, the tag was moved to `e7c69501` by the user, and the signed rebuild was produced via the user wrapper and swapped into the draft before publish.

`verify-downloaded` on the rebuilt bytes returned **DOWNLOADED ARTIFACT PASS** (exit 0) — run after publish as a retroactive confirmation (ordering miss, recorded in 53-STOP-CONDITIONS.md sequencing note 3). Pre-publish coverage for the rebuild: `xcrun stapler validate` OK, `codesign -dv` (Team `TCYJ9HH9RS`, Hardened Runtime), and the user's live re-smoke.

### 6.1 verify-downloaded output (agent-run, credential-free — 2026-10-11)

**Download:** the agent fetched the asset fresh from the draft release over the network
(`gh release download v1.0.0 --pattern '*.dmg'` into a scratch dir — an automated, credential-free
step; the download step itself is not credential access). The user's own normal-browser download
remains the human-verify surface for install/smoke.

**Downloaded DMG path:**
`/private/tmp/claude-501/-Users-wwzz-Downloads-proxyclawd/88833871-9d1c-410a-8425-a5a54e5377ef/scratchpad/dl/EFX.Motion.Editor_1.0.0_aarch64.dmg`
— 15,942,003 bytes (mtime Oct 11 18:01 local).

**Freshness proof (downloaded vs local build):**
```text
d94b5ad0fcbc5042bdd54e6fcb666a29b9be17d7a572bba96a20b1883fc9798e  <scratchpad>/dl/EFX.Motion.Editor_1.0.0_aarch64.dmg
d94b5ad0fcbc5042bdd54e6fcb666a29b9be17d7a572bba96a20b1883fc9798e  app/src-tauri/target/release/bundle/dmg/EFX Motion Editor_1.0.0_aarch64.dmg
```
SHA-256 identical — the bytes GitHub will serve are exactly the signed/notarized 53-03 build.

**Command:**
```bash
bash scripts/macos-release.sh verify-downloaded "/private/tmp/claude-501/-Users-wwzz-Downloads-proxyclawd/88833871-9d1c-410a-8425-a5a54e5377ef/scratchpad/dl/EFX.Motion.Editor_1.0.0_aarch64.dmg"
```

**Output (verbatim, exit 0):**
```text
Selected Apple developer directory: /Library/Developer/CommandLineTools
Apple capability probes: codesign, security, notarytool, and stapler available
Full Xcode is not required when these capability probes succeed.
Certificate setup distinction:
- New identity: obtain a Developer ID Application certificate through Apple Developer Certificates using a Keychain Access CSR; the locally generated private key must remain available in that keychain.
- Existing identity: importing a .p12 only installs a previously issued certificate and matching private key; it does not issue a new Apple certificate.
PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards
Calcul de la somme de contrôle de Protective Master Boot Record (MBR : 0)…
Protective Master Boot Record (MBR :   : vérifiée   CRC32 $344C816B
Calcul de la somme de contrôle de GPT Header (Primary GPT Header : 1)…
 GPT Header (Primary GPT Header : 1)  : vérifiée   CRC32 $AA018BBD
Calcul de la somme de contrôle de GPT Partition Data (Primary GPT Table : 2)…
GPT Partition Data (Primary GPT Tabl  : vérifiée   CRC32 $193CB03A
Calcul de la somme de contrôle de  (Apple_Free : 3)…
                    (Apple_Free : 3)  : vérifiée   CRC32 $00000000
Calcul de la somme de contrôle de disk image (Apple_HFS : 4)…
          disk image (Apple_HFS : 4)  : vérifiée   CRC32 $296EAB49
Calcul de la somme de contrôle de  (Apple_Free : 5)…
                    (Apple_Free : 5)  : vérifiée   CRC32 $00000000
Calcul de la somme de contrôle de GPT Partition Data (Backup GPT Table : 6)…
GPT Partition Data (Backup GPT Tabl   : vérifiée   CRC32 $193CB03A
Calcul de la somme de contrôle de GPT Header (Backup GPT Header : 7)…
  GPT Header (Backup GPT Header : 7)  : vérifiée   CRC32 $19777F23
vérifiée   CRC32 $6DBA4C20
hdiutil: verify: checksum of "/private/tmp/claude-501/-Users-wwzz-Downloads-proxyclawd/88833871-9d1c-410a-8425-a5a54e5377ef/scratchpad/dl/EFX.Motion.Editor_1.0.0_aarch64.dmg" is VALID
/private/tmp/claude-501/.../EFX.Motion.Editor_1.0.0_aarch64.dmg: valid on disk
/private/tmp/claude-501/.../EFX.Motion.Editor_1.0.0_aarch64.dmg: satisfies its Designated Requirement
Processing: /private/tmp/claude-501/.../EFX.Motion.Editor_1.0.0_aarch64.dmg
The validate action worked!
/private/tmp/claude-501/.../EFX.Motion.Editor_1.0.0_aarch64.dmg: accepted
source=Notarized Developer ID
/var/folders/36/p0_vrvmx3tnbvjhbmlcv13y80000gr/T/efx-motion-dmg.XXXXXX.ESZFs4uXXs/EFX Motion Editor.app: valid on disk
/var/folders/36/p0_vrvmx3tnbvjhbmlcv13y80000gr/T/efx-motion-dmg.XXXXXX.ESZFs4uXXs/EFX Motion Editor.app: satisfies its Designated Requirement
/var/folders/36/p0_vrvmx3tnbvjhbmlcv13y80000gr/T/efx-motion-dmg.XXXXXX.ESZFs4uXXs/EFX Motion Editor.app: accepted
source=Notarized Developer ID
Processing: /var/folders/36/p0_vrvmx3tnbvjhbmlcv13y80000gr/T/efx-motion-dmg.XXXXXX.ESZFs4uXXs/EFX Motion Editor.app
The validate action worked!
DOWNLOADED ARTIFACT PASS
- dmg: /private/tmp/claude-501/-Users-wwzz-Downloads-proxyclawd/88833871-9d1c-410a-8425-a5a54e5377ef/scratchpad/dl/EFX.Motion.Editor_1.0.0_aarch64.dmg
- DMG integrity/signature/ticket/Gatekeeper checks passed
- contained app signature/team/Hardened Runtime/no-custom-entitlements/ticket/Gatekeeper checks passed
- normal visible launch remains a required user-owned check
```

**Result: DOWNLOADED ARTIFACT PASS (exit 0)** — the downloaded bytes pass DMG integrity,
signature, notarization ticket, and Gatekeeper checks; the contained app passes
Developer ID signature, team, Hardened Runtime, no-custom-entitlements, ticket, and
Gatekeeper checks. Normal visible launch remains the user-owned check (next section).

### 6.2 Install + normal launch (user-owned — PASS)

- Downloaded the DMG from the draft in a normal browser (`/Volumes/T7/Téléchargements/…`, SHA matched the draft asset).
- Launched the installed app with a plain double-click — no Gatekeeper bypass, no right-click override.
- Main window renders; theme switcher operates; config at `~/.config/efx-motion/builder-config.yaml` is honored (the defect was canvas-color derivation, not config IO).
- After the rebuild, the same path again: "I tested dmg look good !"

### 6.3 D-06 covering smoke results

| # | Smoke item | Result |
|---|-----------|--------|
| a | Quarantine first-open resolves cleanly | **PASS** — normal first-open path, no "damaged/unidentified developer" |
| b | Through-line `.mce` opens via Finder double-click | **PASS** — v1.0.0-2.mce opened from Finder during the first-DMG smoke |
| c | One paint stroke renders | **PASS** — exercised in both smokes; rebuilt build confirmed correct physic-paint rail + stroke |
| d | Save succeeds | **PASS** — first-DMG smoke |
| e | Short PNG export succeeds | **PASS** — first-DMG smoke |

Finding recorded, not fixed silently: the medium-theme physic-paint rail rendered grey in the packaged app (minified `#36e` + canvas alpha suffix). User-approved scoped fix `6f60951f`; rebuilt + re-smoked before publish. D-21 honored via the explicit user authorization (same pattern as the #90 fix).

### 6.4 User confirmation

> "I tested dmg look good ! you switch to public !"

— user, 2026-10-11, after re-smoke-testing the rebuilt DMG. Publish executed on this instruction; post-publish verifications recorded in 53-RELEASE.md.

---
*Phase: 53-integrated-v1-0-0-acceptance · Plan 53-04 · seeded 2026-10-11*
