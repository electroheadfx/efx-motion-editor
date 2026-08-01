# macOS Signed Release

This guide uses `scripts/macos-release.sh` to build, sign, notarize, staple, and verify the EFX Motion Editor v0.8.0 macOS application and DMG without storing Apple credentials in the repository.

> **Current status:** Repository preparation and the credential-free CLI preflight have passed. The real credentialed release, Apple notarization, ticket stapling, external-download verification, and normal visible launch have been intentionally deferred and have not yet been executed. This document does not claim release success or distribution acceptance.

Complete [macOS Developer ID Setup](macos-developer-id-setup.md) before running a credentialed release.

## Purpose and prerequisites

The release script provides one fail-loud path for:

- validating the macOS command-line toolchain and tracked Tauri release contract;
- building the `.app` and `.dmg` bundles through Tauri;
- using a Developer ID Application identity and an App Store Connect Team API key;
- explicitly submitting the final DMG to Apple's notary service;
- stapling and validating tickets;
- checking signatures, Team ID consistency, Hardened Runtime, empty custom entitlements, Gatekeeper acceptance, and DMG integrity;
- validating a separately downloaded DMG without access to signing credentials.

Before continuing, confirm:

- You are on macOS.
- Node.js and `pnpm` are on `PATH`.
- `/usr/bin/codesign`, `/usr/bin/security`, `/usr/bin/xcrun`, `/usr/bin/hdiutil`, `/usr/sbin/spctl`, `/usr/bin/xcode-select`, `/usr/bin/find`, `/usr/bin/git`, and `/usr/bin/plutil` are available.
- `xcrun --find notarytool` and `xcrun --find stapler` succeed.
- Exactly one intended **Developer ID Application** identity is usable.
- The App Store Connect `.p8` key is readable from an absolute path outside the repository.
- No `.p12`, `.p8`, `.key`, or other detected private-key asset is tracked by Git or present anywhere inside the repository worktree.

Full Xcode is not required when the capability probes pass. On the prepared release Mac, the selected `/Library/Developer/CommandLineTools` installation exposes the required tools. Probe each release machine rather than assuming every Command Line Tools installation has the same capabilities.

## Script modes

The script has exactly three modes:

```bash
bash scripts/macos-release.sh preflight
bash scripts/macos-release.sh release
bash scripts/macos-release.sh verify-downloaded /absolute/path/to/file.dmg
```

| Mode | Credentials required | Purpose |
|---|---:|---|
| `preflight` | No | Validate the host tools, Tauri configuration, resource contract, and absence of private Apple assets in the repository. |
| `release` | Yes | Run preflight, validate credentials and identity selection, build/sign/notarize/staple the release, and verify the local artifacts. |
| `verify-downloaded /absolute/path/to/file.dmg` | No | Verify a separately downloaded DMG and its contained app, without launching the app. |

No other flags or modes are supported by the current script.

## Credential environment variables

`release` requires exactly these environment variables:

| Variable | Value |
|---|---|
| `APPLE_SIGNING_IDENTITY` | The complete usable identity name reported by `security find-identity`, including `Developer ID Application:`, the legal name, and the 10-character Team ID in parentheses. |
| `APPLE_API_ISSUER` | The App Store Connect API **Issuer ID**. |
| `APPLE_API_KEY` | The App Store Connect API **Key ID**. |
| `APPLE_API_KEY_PATH` | An absolute path to the readable `.p8` private key outside the repository. |

A Team ID alone is not the signing identity. An Apple email address is not the signing identity. Copy the full quoted identity value reported by:

```bash
/usr/bin/security find-identity -v -p codesigning
```

Expected shape:

```text
  1) <CERTIFICATE-FINGERPRINT> "Developer ID Application: <LEGAL-NAME> (<TEAM-ID>)"
     1 valid identities found
```

Use terminal-session-local exports with placeholders replaced only in your local terminal:

```bash
export APPLE_SIGNING_IDENTITY='Developer ID Application: <LEGAL-NAME> (<TEAM-ID>)'
export APPLE_API_ISSUER='<APP-STORE-CONNECT-ISSUER-ID>'
export APPLE_API_KEY='<APP-STORE-CONNECT-KEY-ID>'
export APPLE_API_KEY_PATH='/absolute/path/outside-the-repository/AuthKey_<KEY-ID>.p8'
```

Do not put these assignments in the repository, an app-local `.env`, a repository-local `.env`, shell startup files shared with other users, tickets, chat, or documentation. The script never sources an `.env` file.

The `.p8` path must:

- begin with `/`;
- resolve to a readable regular file;
- remain outside `/Users/lmarques/Dev/efx-motion-editor` after symbolic links are resolved.

The script checks those conditions before the build. It checks variable presence but does not print their values.

When the release session is complete, close the terminal or unset the values:

```bash
unset APPLE_SIGNING_IDENTITY APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
```

## Planned release sequence

For the v0.8.0 release, first run `/gsd-audit-milestone`, then `/gsd-complete-milestone`. Run the credentialed procedure below only after those two project gates are finished and the project owner resumes release execution.

1. Open a fresh terminal.
2. Change to the repository:

   ```bash
   cd /Users/lmarques/Dev/efx-motion-editor
   ```

3. Export the four credential variables in that terminal session.
4. Run the credential-free and identity-independent checks first:

   ```bash
   bash scripts/macos-release.sh preflight
   ```

5. Confirm that it ends with:

   ```text
   PREFLIGHT PASS: release configuration, Apple CLI capabilities, resources, and private-asset guards
   ```

6. Start the real release:

   ```bash
   bash scripts/macos-release.sh release
   ```

7. Treat any nonzero exit or `ERROR:` line as a rejected release attempt. Do not publish artifacts from a failed run.
8. Preserve only redacted, non-secret evidence from a successful run.

## What `release` does

The current script executes the following sequence.

### 1. Configuration, tool, and private-asset guards

It runs the shared preflight, which:

- requires macOS;
- requires the fixed system executables and resolves Node.js and `pnpm` from `PATH`;
- reports the selected Apple developer directory;
- requires executable `notarytool` and `stapler` paths resolved through `xcrun`;
- parses `app/src-tauri/tauri.conf.json` with Node.js and requires:
  - product name `EFX Motion Editor`;
  - version `0.8.0`;
  - identifier `com.efxlab.motion-editor`;
  - `bundle.macOS.hardenedRuntime` set to `true`;
  - no `bundle.macOS.entitlements` value;
  - no `bundle.externalBin` value;
  - exactly `resources/*` in the resource list;
  - exactly one regular resource file, `resources/test-image.jpg`;
- rejects private Apple assets tracked by Git;
- rejects detected `.p12`, `.p8`, `.key`, SSH private-key, or private-key-named files anywhere inside the repository worktree.

### 2. Credential and exact identity validation

It requires all four environment variables, validates the external `.p8` path, and requires `APPLE_SIGNING_IDENTITY` to begin with `Developer ID Application: `.

It parses `/usr/bin/security find-identity -v -p codesigning` and requires exactly one usable identity whose complete displayed name equals `APPLE_SIGNING_IDENTITY`. An absent identity and duplicate matching identities both fail.

It also extracts the final parenthesized Team ID from the requested identity and requires it to be exactly 10 uppercase alphanumeric characters. That Team ID is later compared with the signed artifacts.

### 3. Tauri app and DMG build

The exact build command is:

```bash
pnpm --dir app tauri build --bundles app,dmg --ci
```

The script does not pass `--no-sign` or `--skip-stapling`. The exported Apple variables remain in the environment for Tauri's application signing and notarization path.

### 4. Unique artifact discovery

After the build, the script searches below `app/src-tauri/target` and requires exactly one match for each pattern:

```text
*/release/bundle/macos/EFX Motion Editor.app
*/release/bundle/dmg/*_0.8.0_*.dmg
```

Zero matches or multiple matches are fatal. Remove or archive conflicting stale release outputs before retrying rather than selecting an artifact manually.

### 5. Explicit final-DMG notarization and stapling

After Tauri handles the app release path, the script explicitly submits the discovered DMG:

```bash
xcrun notarytool submit <DMG_PATH> \
  --key "$APPLE_API_KEY_PATH" \
  --key-id "$APPLE_API_KEY" \
  --issuer "$APPLE_API_ISSUER" \
  --wait \
  --output-format json
```

It requires the JSON result to contain status `Accepted` and a nonempty submission ID. It then downloads the Apple notary log and staples the ticket to the DMG.

Non-secret evidence is written beneath the ignored Tauri target output, next to the DMG:

```text
notarization-evidence/dmg-submit.json
notarization-evidence/dmg-log.json
```

These files are build evidence, not a place for credentials. Review diagnostic content before sharing it externally.

### 6. Application verification

The discovered `.app` must pass:

- `codesign --verify --deep --strict --verbose=2`;
- Developer ID Application authority inspection;
- a valid Team Identifier matching the Team ID in `APPLE_SIGNING_IDENTITY`;
- exact identifier `com.efxlab.motion-editor`;
- the Hardened Runtime `runtime` signature flag;
- extraction of an empty entitlement dictionary, with no unexpected entitlement keys;
- Gatekeeper executable assessment through `spctl --assess --type execute --verbose=4`;
- `xcrun stapler validate`.

### 7. DMG verification

The discovered `.dmg` must pass:

- `hdiutil verify`;
- `codesign --verify --strict --verbose=2`;
- Developer ID Application authority inspection;
- a valid Team Identifier matching the app and requested identity;
- `xcrun stapler validate`;
- Gatekeeper open assessment through `spctl --assess --type open --context context:primary-signature --verbose=4`.

Only after every step succeeds does the script print `RELEASE PASS` and the artifact paths.

## Keychain access prompts

During signing, macOS may ask whether the release tool can access the Developer ID private key in Keychain.

- Read the prompt and confirm that it refers to the expected signing operation and identity.
- Approve access locally according to the Mac's security policy.
- Never share the macOS login password, Keychain password, `.p12` password, or private-key material with another person or paste it into chat.
- If repeated prompts or denial prevent signing, inspect the private key's Keychain access controls locally rather than weakening trust settings or exporting credentials into the repository.

## Artifact and evidence locations

The target directory can include an architecture-specific prefix, so rely on these patterns rather than assuming a single fixed architecture directory:

```text
app/src-tauri/target/**/release/bundle/macos/EFX Motion Editor.app
app/src-tauri/target/**/release/bundle/dmg/*_0.8.0_*.dmg
app/src-tauri/target/**/release/bundle/dmg/notarization-evidence/dmg-submit.json
app/src-tauri/target/**/release/bundle/dmg/notarization-evidence/dmg-log.json
```

The whole `app/src-tauri/target/` tree is ignored by Git.

A successful local run is expected to end with a ledger shaped like this:

```text
RELEASE PASS
- app: <ABSOLUTE-PATH-TO-EFX-MOTION-EDITOR.APP>
- dmg: <ABSOLUTE-PATH-TO-V0.8.0-DMG>
- app signature, Developer ID team, Hardened Runtime, no-custom-entitlements, Gatekeeper, and stapler checks passed
- DMG integrity, signature, Developer ID team, notarization, stapler, and Gatekeeper checks passed
```

This is the expected format only. No actual `RELEASE PASS` result has yet been produced or accepted.

## Verify a separately downloaded artifact

Local build verification is not sufficient to prove the distributed download. Upload the selected DMG through the intended distribution channel, then download it on another Mac or in a separate clean macOS user/session so the real download and Gatekeeper path is exercised.

On that validation environment, use a checkout containing the same verification script. No Apple signing or notarization credentials are required:

```bash
cd /absolute/path/to/efx-motion-editor
bash scripts/macos-release.sh verify-downloaded /absolute/path/to/downloaded-file.dmg
```

The script:

1. reruns credential-free preflight;
2. requires a readable `.dmg` file;
3. verifies DMG integrity, signature, Developer ID authority, stapled ticket, and Gatekeeper assessment;
4. mounts the DMG read-only at a temporary mount point;
5. requires exactly one contained `EFX Motion Editor.app`;
6. verifies the app signature, matching Team ID, exact application identifier, Hardened Runtime, empty custom entitlements, stapled ticket, and Gatekeeper executable assessment;
7. unmounts and removes the temporary mount point.

Expected successful ledger shape:

```text
DOWNLOADED ARTIFACT PASS
- dmg: <ABSOLUTE-PATH-TO-DOWNLOADED-DMG>
- DMG integrity/signature/ticket/Gatekeeper checks passed
- contained app signature/team/Hardened Runtime/no-custom-entitlements/ticket/Gatekeeper checks passed
- normal visible launch remains a required user-owned check
```

The script deliberately does not launch the application. After it passes:

1. Open the downloaded DMG normally.
2. Drag **EFX Motion Editor.app** to **Applications**.
3. Launch it normally from Finder or Launchpad.
4. Do not use Control-click > Open.
5. Do not disable Gatekeeper or use any security override.
6. Confirm that macOS does not report an unidentified developer or damaged application and that the normal EFX Motion Editor main window appears.

Until both `verify-downloaded` and this visible launch succeed, distribution acceptance remains unproven.

## Troubleshooting

### Required toolchain component is missing

Typical errors include:

```text
ERROR: Required executable is missing: <PATH>
ERROR: Required command is missing from PATH: node
ERROR: Required command is missing from PATH: pnpm
ERROR: No Apple developer directory is selected; install/select a current Apple toolchain
ERROR: notarytool is unavailable; install/select a current Apple toolchain
ERROR: stapler is unavailable; install/select a current Apple toolchain
```

Install or select a current Apple toolchain and rerun `preflight`. Do not bypass the probe or assume full Xcode is necessary if a current Command Line Tools installation can provide all required capabilities.

### Tauri release configuration drift

Errors beginning with this prefix are blocking:

```text
ERROR: Tauri release configuration drift: ...
```

The script checks the exact v0.8.0 product name, identifier, Hardened Runtime setting, absence of custom entitlements and external binaries, resource glob, and single resource file. Reconcile the release script and reviewed Tauri configuration before retrying; do not weaken the check only to make a build pass.

### Private assets are inside the repository

The script fails with one of:

```text
ERROR: Git tracks a private Apple signing/notarization asset; remove it from repository history before release
ERROR: A private Apple signing/notarization asset exists inside the repository; move it outside the repository before release
```

Move private assets to secure external storage. If Git tracks one, remove it from current tracking and assess repository history exposure before release. Do not merely rename a credential to evade the guard.

### A required environment variable is missing

The error names the missing variable:

```text
ERROR: Required environment variable is not set: <VARIABLE-NAME>
```

Set all four required values in the current terminal session. Do not add an `.env` file.

### The `.p8` path is invalid

Possible errors:

```text
ERROR: APPLE_API_KEY_PATH must be an absolute path
ERROR: APPLE_API_KEY_PATH must reference a readable regular file
ERROR: APPLE_API_KEY_PATH could not be resolved
ERROR: APPLE_API_KEY_PATH must be outside the repository
```

Use an absolute, readable path to the real `.p8` file in secure external storage. A symbolic link that resolves inside the repository is also rejected.

### The signing identity is missing, wrong, or duplicated

Possible errors:

```text
ERROR: APPLE_SIGNING_IDENTITY must name a Developer ID Application identity
ERROR: Unable to query usable code-signing identities
ERROR: The requested Developer ID Application identity is absent or ambiguous in the usable codesigning identities
ERROR: APPLE_SIGNING_IDENTITY must end with a 10-character Apple Team ID in parentheses
```

Run:

```bash
/usr/bin/security find-identity -v -p codesigning
```

Copy the complete identity name exactly. The required result is one matching usable identity. If none exists or the same identity appears twice, follow the Keychain placement and duplicate-removal procedure in [macOS Developer ID Setup](macos-developer-id-setup.md).

### Apple rejects DMG notarization

The script reports a status and submission identifier in an error shaped like:

```text
ERROR: DMG notarization was not accepted (status: <STATUS>, submission: <SUBMISSION-ID>)
```

Inspect the generated `notarization-evidence/dmg-submit.json` and, when available, `dmg-log.json`. Correct the Apple-reported signing or bundle issue and rebuild. Share only redacted diagnostics; never share API credentials or private-key material.

### Artifact discovery is ambiguous

Possible errors:

```text
ERROR: Expected exactly one v0.8.0 EFX Motion Editor.app release artifact, found <COUNT>
ERROR: Expected exactly one v0.8.0 DMG release artifact, found <COUNT>
```

A count of zero means the build did not produce the expected reviewed output. A count greater than one usually means stale or multi-target release artifacts exist under `app/src-tauri/target`. Move or remove stale build output, then rerun the complete release so the script can identify one authoritative app and one authoritative DMG.

### Signature, Team ID, identifier, or Hardened Runtime verification fails

Blocking errors include missing Developer ID authority, an invalid or mismatched Team Identifier, a wrong application identifier, and a missing `runtime` flag. Do not publish the artifact. Confirm the selected identity, reviewed Tauri configuration, and signing output, then rebuild from a clean release-output state.

### Unexpected entitlements are present

The script fails if it cannot extract a valid entitlement property list or if any entitlement key is present:

```text
ERROR: Unable to extract app entitlements
ERROR: Extracted app entitlements are not a valid property list
ERROR: App signature contains unexpected entitlement keys
```

The current release contract permits no custom entitlement keys. Investigate configuration or signing drift rather than adding an exception without a separate security review.

### Gatekeeper, stapler, codesign, or DMG integrity fails

Failures from `codesign`, `spctl`, `xcrun stapler`, or `hdiutil verify` stop the script immediately. Treat them as release rejection. Do not use Control-click > Open, disable Gatekeeper, remove quarantine attributes, or skip stapling to manufacture a pass.

For a downloaded artifact, also confirm that the file came through the intended distribution channel and was not modified after publication.

## Release evidence checklist

Paste and complete this redacted checklist in a future release UAT response. Include no personal Apple values, certificate fingerprints, API identifiers, key paths, passwords, or private files.

```text
macOS signed release evidence

Local release environment:
- macOS version: <VERSION>
- selected developer directory: <PATH, NO PERSONAL VALUES>
- preflight: PASS

Release artifacts:
- app filename: <FILENAME ONLY>
- DMG filename: <FILENAME ONLY>
- architecture: <ARCHITECTURE>
- local release ledger: PASS / FAIL

Apple processing:
- app notarization status: Accepted / Not Accepted / Not Run
- DMG notarization status: Accepted / Not Accepted / Not Run
- app stapler validation: PASS / FAIL / Not Run
- DMG stapler validation: PASS / FAIL / Not Run

Local verification:
- app signature and Team ID consistency: PASS / FAIL / Not Run
- Hardened Runtime: PASS / FAIL / Not Run
- no custom entitlement keys: PASS / FAIL / Not Run
- app Gatekeeper assessment: PASS / FAIL / Not Run
- DMG integrity/signature/Gatekeeper assessment: PASS / FAIL / Not Run

Downloaded-artifact environment:
- separate Mac or clean user/session: <DESCRIPTION>
- macOS version: <VERSION>
- distribution channel used: <CHANNEL, NO PRIVATE URL IF SENSITIVE>
- verify-downloaded ledger: PASS / FAIL / Not Run
- normal launch without Control-click/Open or Gatekeeper override: PASS / FAIL / Not Run
- normal main window appeared: YES / NO / Not Run

Redacted failure detail, if any:
- failed command or check: <DESCRIPTION>
- Apple diagnostic summary: <REDACTED DESCRIPTION>
```

Release and distribution acceptance must remain pending until the credentialed release, both notarization paths, stapling, downloaded-artifact verification, and normal visible launch have all produced real evidence.

## v0.8.1 packaging hotfix

v0.8.0 packaged a broken app even though every signing check passed. Three defects combined:

1. **Missing frontend entry.** `motion-canvas:project` sets `build.rollupOptions.input` in `app/vite.config.ts`, which makes Vite skip its default `index.html` entry. The production build therefore emitted no `dist/index.html` at all — only the Motion Canvas project bundle and assets — and nothing in the pipeline noticed.
2. **Placeholder application icon.** `app/src-tauri/icons/` contained the 559-byte create-tauri-app template placeholder, and `tauri.conf.json` never declared a `bundle.icon` array, so the signed bundle shipped the stock icon.
3. **codesign resolution via ambient PATH.** The Tauri build invokes `codesign`/`security` internally; a PATH carrying wrapper binaries could have shadowed the genuine Apple tools.

The v0.8.1 pipeline makes these failures loud instead of silent:

- **Fail-closed bundle guard.** The Vite config merges the Motion Canvas input with an `app` entry pointing at `app/index.html` and runs a `writeBundle` guard that fails `pnpm build` — hence Tauri's `beforeBuildCommand`, before any compilation or signing — when `index.html` is missing/empty, references no local module script, or references a missing/empty local asset. The esbuild JSX repair is returned from the same post plugin's `config` hook because `vite:esbuild` snapshots `config.esbuild` at plugin-creation time; mutating it in `configResolved` was a no-op.
- **Icon contract.** The real EFX icon set was generated from the 1024x1024 RGBA source (kept outside Git) via `tauri icon`; `bundle.icon` names exactly the 5 desktop files (`32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, `icon.ico`). The tracked generated icons under `app/src-tauri/icons/` are the canonical release inputs: preflight requires the array to match, every referenced file to exist non-empty, and `icon.icns` to carry the `icns` magic bytes — a fresh clone passes preflight without any source PNG.
- **Version agreement.** Preflight compares `tauri.conf.json` `version` against the script's `PRODUCT_VERSION` dynamically (no hardcoded version literal), and the DMG artifact glob interpolates `PRODUCT_VERSION`.
- **Simulated codesign resolution.** Preflight requires `PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH" command -v codesign` to resolve exactly `/usr/bin/codesign`, and the Tauri build invocation itself runs with the same system-first PATH prefix.
- **Extended `verify_app()`.** Both the local release and `verify-downloaded` paths now require the packaged app's `Info.plist` to report `CFBundleShortVersionString == PRODUCT_VERSION`, present `CFBundleVersion` and `CFBundleIconFile`, and a non-empty bundled icon with `icns` magic.

Regression coverage lives in `app/src/viteBuild.test.ts` (real hermetic production build + guard contract) and `app/src/releaseContract.test.ts` (version/icon/script contract). The credentialed release, notarization, tag creation, and visible native UAT remain user-owned steps.
