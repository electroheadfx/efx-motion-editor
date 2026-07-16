---
status: findings
reviewed_commits:
  - c764544e
  - 6677c805
base: 75998aa2f7dded08b1203ab6e8b85f64d416d597
reviewed: 2026-07-16
---

# Quick 260716-dby Production Review

Production is not ready for native UAT until the findings below are corrected. Deferred regression tests and absence of native UAT are intentionally not findings.

## Blockers

### BLOCKER-01: Standalone can mint authority for arbitrary filesystem paths

**Evidence:**
- `app/src-tauri/src/commands/script_library.rs:6-10`
- `app/src-tauri/src/commands/script_library.rs:42-47`
- `app/src-tauri/src/lib.rs:540-547`
- `app/src-tauri/capabilities/default.json:4-5`

Registered native bind/migration commands accept arbitrary project paths and are available to the standalone webview. Standalone code could directly bind another accessible `.mce` root or migrate between arbitrary roots, bypassing the locked parent-owned authority boundary.

**Required correction:** Bind, clear, and migration must not be standalone-invokable arbitrary-path commands. Verify the caller window label and derive/validate parent-owned active project authority in native managed state. Migration must operate only on parent/native-known source and destination project state.

### BLOCKER-02: Save As publishes/writes destination state before script migration succeeds

**Evidence:**
- `app/src/stores/projectStore.ts:712-731`

The store switches `dirPath`/`filePath` and writes the destination before library migration completes. A migration failure leaves a partially completed destination while the frontend restores only signals.

**Required correction:** Stage Save As and library migration before publishing destination active state. Commit destination project, migrated assets/library, authority, and mounted context only after required steps succeed. On failure, preserve source authority and clean only transaction-owned destination artifacts where safe.

## High

### HIGH-01: Native validation is weaker than frontend validation

**Evidence:**
- `app/src-tauri/src/services/script_library.rs:312-325`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:209-217`
- `app/src/types/physicPaint.ts:546-552`

Rust does not validate all optional deterministic fields such as `hasPenInput`, `playFrame`, and `physicsMode`, accepts timestamps beyond JavaScript safe integer bounds, and does not enforce all date invariants. Native scan can expose a row that frontend Load rejects.

**Required correction:** Match authoritative schema validation field-for-field, enforce safe integers and `updatedAt >= createdAt`, and omit invalid documents during scan.

### HIGH-02: WebP validation checks only container prefix

**Evidence:**
- `app/src-tauri/src/services/script_library.rs:284-294,372`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.ts:195-207`

Base64 decoding is permissive and validators do not parse actual WebP dimensions or compare them to declared metadata.

**Required correction:** Strictly decode canonical Base64/data URLs, parse VP8/VP8L/VP8X dimensions, require exact metadata match, and enforce decoded-byte and dimension limits in frontend and native validation.

### HIGH-03: Script and thumbnail are captured in separate unlocked transactions

**Evidence:**
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:93-100`
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptClipboard.ts:383-401`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:231-239`

The approved source lock is released before the live alpha is copied for the thumbnail, allowing later paint/navigation to make JSON and preview disagree.

**Required correction:** Return logical script plus the corresponding live-alpha snapshot from one approved drain/capture transaction while source input/navigation remain locked. Encode the thumbnail from that immutable captured canvas.

### HIGH-04: Missing paper texture silently writes an incorrect thumbnail

**Evidence:**
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptThumbnail.ts:24-28`
- `app/src/lib/projectPaperRaster.ts:66-72`

A null paper canvas while loading/failing is treated as no paper and Save continues.

**Required correction:** Await the existing paper-raster resolution when paper is required. If it cannot be resolved, fail Save before native persistence.

### HIGH-05: Project close and Save As do not update/clear mounted library context

**Evidence:**
- `app/src/stores/projectStore.ts:695-733,776-808`
- `app/src/components/physic-paint/PhysicsPaintStudio.tsx:444-445`

The standalone refreshes only on launch-context settlement. Save As and close do not publish the required context transition, leaving stale rows/provenance.

**Required correction:** Publish explicit parent-owned project-context transitions on Save As, project switch, and close. Clear rows synchronously on close and deliver destination context plus rescan after successful Save As authority binding.

### HIGH-06: Overlapping operations and stale results can replace current state

**Evidence:**
- `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.ts:77-116,150-155`

No context generation/single-operation guard protects asynchronous captures and results; disposal is not checked by completions.

**Required correction:** Capture context generation at operation start, reject overlapping mutations, verify result kind/generation before publication, and ignore completions after disposal/context replacement.

### HIGH-07: Narrow/mobile right panel remains a clipped two-column grid

**Evidence:**
- `app/src/components/physic-paint/physicsPaintStudio.css:2198-2239`

Below 860px the panel still requires two 240px columns while horizontal overflow is hidden.

**Required correction:** Use a single-column stack with internal vertical scrolling and `min-width: 0` at narrow/mobile widths; retain two columns only when the width supports them.

### HIGH-08: Rename/Delete can mutate a valid externally replaced file

**Evidence:**
- `app/src-tauri/src/services/script_library.rs:121-142`

Requests have no expected revision/hash from the selected row.

**Required correction:** Return a stable content revision/hash with each valid row. Include the expected revision in Rename/Delete requests and compare immediately before mutation. On mismatch, fail nonfatally and rescan without modifying the file.

## Medium

### MEDIUM-01: Native NFC normalization is a no-op

**Evidence:**
- `app/src-tauri/src/services/script_library.rs:125,373-374`

**Required correction:** Use real Unicode NFC normalization consistently for validation, uniqueness comparison, and storage.

### MEDIUM-02: Rename input is nested inside an option button

**Evidence:**
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:42-57`

**Required correction:** Avoid nested interactive content. Use a focusable option container with separate selection control or switch row semantics while editing.

### MEDIUM-03: Delete dialog and disabled explanations are not reliably accessible

**Evidence:**
- `app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:31,62-73`

**Required correction:** Use the established managed-focus confirmation pattern with Escape/focus restoration. Put disabled explanations on focusable wrappers and/or `aria-describedby` so Save/Import reasons are accessible even when native disabled buttons do not receive focus/hover.

## Boundary checks

- No deferred post-UAT test artifact changed in the reviewed commits.
- Do not create or modify those tests while fixing these findings.
- After corrections, rerun existing baselines and the deferred-test guard, update the production checkpoint, and stop for native UAT.
