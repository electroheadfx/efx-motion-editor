# Quick 260717-9hw: Physics Paint Right Sidebar and Scripts Polish - Research

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Script-row load failure
- If a newly activated durable preset fails to load, keep the last successfully loaded row selected and preserve its clipboard content.
- Surface the attempted load error through the established Scripts status/error and LOG routes.
- Never present the failed row as successfully selected or loaded.

#### Repeated row activation
- Every pointer or keyboard activation reloads the durable preset into the transient immutable clipboard, including activation of the already-selected row.
- Row activation remains load-only and must never invoke Apply.

#### Locked toolbar behavior
- The paintBrush toolbar action reloads the currently selected durable preset as authoritative clipboard content, then invokes the existing approved Apply Script path exactly once.
- If selected-preset loading fails, Apply must not start.
- If the current destination is ineligible for Apply, the combined action is disabled rather than performing only the load half.
- The clipboard remains loaded and reusable after Apply.
- The disabled Play control immediately follows paintBrush, has no callback, and communicates that playback is not yet available.

#### Locked validation order
- Research and plan first.
- Implement only production UI/controller integration changes.
- Run type checking and the minimum existing focused checks needed to establish that production code builds.
- Stop for native visible UAT; do not add or modify regression tests before explicit approval.
- After approval, add focused regression coverage, run tests with `vitest run`, broader existing gates, code review, and final verification.
- Plan validation must not reorder automated regression tests before native UAT.

### Claude's Discretion
- Exact internal event-handler composition, focus styling, responsive CSS adjustments, and controller method naming, provided existing Preact-native Signals/controller boundaries and accessible interaction patterns are preserved.

### Deferred Ideas (OUT OF SCOPE)
- Persistence, replay, Motion, history, cache behavior, script schema, project discovery, native filesystem authority, and approved timeline Copy/Apply behavior redesigns.
- Regression-test creation or modification before explicit native UAT approval.
</user_constraints>

## Summary

The feature is already concentrated in four production seams: `PhysicsPaintRightPanel.tsx` owns Brush color plus Tool/Onion/Motion/Scripts navigation; `PhysicsPaintScriptsPanel.tsx` owns toolbar/list interactions; `physicsPaintRotoScriptLibrary.ts` owns durable rows and loading; and `physicsPaintRotoScriptClipboard.ts` owns the immutable transient clipboard and the sole approved Apply path. The narrow implementation should edit those seams plus `PhysicsPaintStudio.tsx` wiring and `physicsPaintStudio.css`; it should not touch native persistence, schema, bridge authority, replay, or timeline Apply internals. [VERIFIED: codebase `app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx`, `PhysicsPaintScriptsPanel.tsx`, `roto/physicsPaintRotoScriptLibrary.ts`, `roto/physicsPaintRotoScriptClipboard.ts`, `PhysicsPaintStudio.tsx`]

The important controller correction is transactional row activation. Current rows select separately from loading, and `loadSelected()` republishes rows with the attempted ID before clipboard replacement. That cannot enforce “failed row is never selected.” Add one controller action that accepts a row ID, loads that ID without committing selection, replaces the clipboard synchronously on success, then commits `selectedId`; failure leaves both selection and clipboard unchanged while publishing status/LOG error. Re-activating the selected ID must still execute the complete load. [VERIFIED: codebase `PhysicsPaintScriptsPanel.tsx:30-71`; `physicsPaintRotoScriptLibrary.ts:74-95,154-160,184`]

**Primary recommendation:** move only the existing tablist, make durable row activation a transactional `activateAndLoad(id)` operation, and compose toolbar `reload selected -> await success -> existing applyScript()` with a typed destination-eligibility guard. [VERIFIED: codebase seam analysis]

## Project Constraints (from CLAUDE.md)

- Use the project-local GSD installation in `.claude/gsd-core`; do not run the development server. [VERIFIED: codebase `CLAUDE.md:1-4`]
- This is Preact. Preserve the existing Signals/controllers and avoid new effect-driven synchronization or React workarounds. [VERIFIED: codebase `CLAUDE.md:12-129`; loaded `developing-preact` skill]
- Use pnpm. If tests are later approved, invoke Vitest with `vitest run`, never watch mode. [VERIFIED: codebase `CLAUDE.md:6-10`; root `package.json:3`]
- Keep the change proportional and do not refactor unrelated code. [VERIFIED: codebase `CLAUDE.md:117-129`]
- Before native UAT, modify production code only and run build-focused checks; do not create or modify tests. [VERIFIED: CONTEXT locked validation order]

## Implementation-Ready Findings

### 1. Right-panel structure and placement

- `PhysicsPaintStudioView` mounts `.physics-paint-right-panel-shell` in grid column 3 and renders `PhysicsPaintRightPanel`; the shell spans the canvas and workflow rows. [VERIFIED: codebase `PhysicsPaintStudioView.tsx:121-167`; `physicsPaintStudio.css:724-737`]
- `PhysicsPaintRightPanel` currently renders two sibling sections. The first is the Brush/conditional LOG tab and color picker. The second starts with the Tool/Onion/Motion/Scripts tablist and then renders its selected panel. [VERIFIED: codebase `PhysicsPaintRightPanel.tsx:254-375,377-470`]
- Labels are hard-coded uppercase (`BRUSH COLOR`, `TOOL`, `ONION`, `MOTION`, `SCRIPTS`, `LOG`) and `.physics-paint-options-tab` also applies `text-transform: uppercase`. Change the requested five labels to exact mixed case and remove/override uppercase transformation for this tab system; LOG may remain as its existing label because the locked casing list does not rename it. [VERIFIED: codebase `PhysicsPaintRightPanel.tsx:265,275,386,395,404,413`; `physicsPaintStudio.css:949-970`]
- Narrowest placement: move the existing options tablist JSX out of the second section so it immediately follows the completed Brush/LOG section, then keep the selected Tool/Onion/Motion/Scripts panel in the existing options section. Do not duplicate tab state or controls. Reduce the inter-section gap/margin so the navigation visually attaches to Brush color. [VERIFIED: current DOM and `.physics-paint-right-panel { gap:18px }`, `.physics-paint-right-section + ... { margin-top:2px }` at `physicsPaintStudio.css:745-795`]

### 2. Responsive and overflow CSS

| Surface | Current rule | Required narrow adjustment |
|---|---|---|
| Desktop | Studio columns are `52px / canvas / 316–340px`; right panel scrolls vertically. | Preserve width and vertical scrolling; do not add fixed child widths. [VERIFIED: `physicsPaintStudio.css:410-417,745-755`] |
| Narrow desktop ≤1180px | Right panel becomes 286px. | Keep four tabs `flex:1 1 0`, reduce padding if needed, retain `white-space:nowrap` and `min-width:0`. [VERIFIED: `physicsPaintStudio.css:934-983,2163-2203`] |
| Stacked ≤860px | Shell moves to row 3; panel max-height is 260px with hidden horizontal overflow and vertical scrolling. | Keep toolbar and rows within `min-width:0`; no horizontal scrolling or clipped toolbar buttons. [VERIFIED: `physicsPaintStudio.css:2206-2244`] |
| Scripts toolbar | Six equal grid columns. | Retain six columns after replacing Load/Import semantics: Save, Paintbrush Load+Apply, disabled Play, Rename, Delete, Refresh. [VERIFIED: `physicsPaintStudio.css:1051-1056`; CONTEXT toolbar order] |
| Script rows | Grid `48px minmax(0,1fr)`; names/provenance/count ellipsize. | Make the row itself focusable/activatable and add pointer/focus styling; preserve thumbnail and ellipsis rules. [VERIFIED: `physicsPaintStudio.css:1078-1110`] |

### 3. Existing icon system

The project already depends on `lucide-preact`; add no dependency. Exact existing symbols are `FolderOpen` (current durable Load), `Paintbrush` (used elsewhere in the editor), and `Play` (used by Physics Paint transport). The current disabled Import placeholder uses `Download`; remove that Import control and use disabled `Play` immediately after the new `Paintbrush` action. [VERIFIED: codebase `app/package.json:29`; `PhysicsPaintScriptsPanel.tsx:1,39,43`; `SidebarProperties.tsx:2,86`; `PhysicsPaintWorkflowStrip.tsx:1,462`]

### 4. Durable Scripts controller and error routes

- Controller state is Signals-based: `rows`, `selectedId`, computed `selected`, `busy`, `status`, skipped count, rename state, delete confirmation, and computed availability. Explicit actions cover scan/entry, save, load, rename, delete, select, and disposal. [VERIFIED: codebase `physicsPaintRotoScriptLibrary.ts:24-48,50-70,180-186`]
- `execute()` rejects overlap, correlates context/operation generations, republishes sorted rows, and routes failed request details through `ports.log(..., true)`. Studio maps that port to `applyMessage` and `lastError`, which feed the Brush/LOG panel. [VERIFIED: codebase `physicsPaintRotoScriptLibrary.ts:74-95`; `PhysicsPaintStudio.tsx:231-247`; `PhysicsPaintRightPanel.tsx:152,360-373`]
- Save captures the active real frame; rename preserves ID and expected revision; delete uses selected revision and confirmation; refresh scans explicitly. These behaviors should remain untouched. [VERIFIED: codebase `physicsPaintRotoScriptLibrary.ts:96-153,162-179`; `PhysicsPaintScriptsPanel.tsx:60-90`]
- Current failed-load risk: `loadSelected()` passes the attempted row ID as `preferredId` to `execute()`, so `publishResult()` may select it before knowing whether clipboard replacement succeeds. Replace this with an ID-specific transactional load that commits selection only after successful validated load and successful `replaceClipboard`. [VERIFIED: codebase `physicsPaintRotoScriptLibrary.ts:74-79,154-160`]

### 5. Immutable clipboard and Apply safety

- Durable load converts the validated document to a fresh runtime object, then `replaceClipboardFromPersisted()` clones every stroke/point/params object, deep-freezes the complete script, synchronously assigns `clipboard.value`, and clears clipboard status/error. [VERIFIED: codebase `physicsPaintRotoScriptSchema.ts:142-153`; `physicsPaintRotoScriptClipboard.ts:411-420,768-789`]
- `applyScript()` reads `clipboard.value` at call time, stores that immutable object in the active operation, replays through `enqueueRecordedStroke()`, and never clears or mutates the clipboard. Discard/disposal are the explicit clearing paths. [VERIFIED: codebase `physicsPaintRotoScriptClipboard.ts:521-590,706-719`]
- Therefore `const loaded = await library.activateAndLoad(id); if (loaded) await rotoScript.applyScript();` safely uses the newly loaded authoritative clipboard: replacement is synchronous before the load promise resolves, and Apply reads the signal afterward. Do not trigger Apply from a state effect or from an un-awaited callback. [VERIFIED: codebase execution ordering above]
- Current `availability.canApply` also requires a clipboard. The combined toolbar action must be enabled for an eligible destination even when no clipboard is loaded yet, because its first step creates one. Add a typed clipboard-controller computed guard such as `canApplyReplacement` / `replacementApplyDisabledReason` that keeps the existing busy, mode, and generated-frame checks but omits only the “missing clipboard” check. Do not compare human-readable reason strings. [VERIFIED: codebase `physicsPaintRotoScriptClipboard.ts:207-231`; CONTEXT combined-action rule]
- Real keys and true-empty frames are eligible; generated interpolation is ineligible. Empty targets remain prepared by the existing `claimEmptyTarget` path inside `applyScript()`. [VERIFIED: codebase `physicsPaintRotoScriptClipboard.ts:223-230,528-558`; Studio `claimRotoSelectedFrame` wiring at `PhysicsPaintStudio.tsx:191-220`]

### 6. Accessible full-row activation

Use the script row as the single focusable `role="option"` activation surface with `tabIndex={0}`, pointer click, and Enter/Space keyboard handling. Activation calls only `activateAndLoad(row.id)`. Keep listbox Arrow/Home/End navigation if desired, but those selection moves must not falsely mark an unloaded row as successful; preferably focus rows directly or treat keyboard navigation as focus movement until activation. [VERIFIED: current listbox keyboard behavior `PhysicsPaintScriptsPanel.tsx:30-53`; locked failure semantics]

Nested explicit controls—rename input and any action buttons—must call `stopPropagation()` for pointer activation and keyboard events that would otherwise bubble to the row. The repository uses this exact nested-action pattern in sequence rows and recent-project rows. Preserve visible `:focus-visible` styling through the existing right-panel outline rule, extending it to the focusable row if needed. [VERIFIED: codebase `SequenceList.tsx:250-266,319-332,343-385`; `WelcomeScreen.tsx:57-65,94-105`; `physicsPaintStudio.css:663-671`]

### 7. Exact wiring sequence

1. In `physicsPaintRotoScriptLibrary.ts`, add ID-specific transactional activation/load and keep the previous successful selection on all failures. [VERIFIED: controller seam]
2. In `physicsPaintRotoScriptClipboard.ts`, expose destination eligibility for a future replacement without changing `applyScript()`. [VERIFIED: availability seam]
3. In `PhysicsPaintStudio.tsx`, provide two handlers: row `load only`, and toolbar `await reload selected; if true, invoke existing rotoScript.applyScript() exactly once`; route failures through existing `lastError` handling. [VERIFIED: current wiring `PhysicsPaintStudio.tsx:641-655`]
4. In `PhysicsPaintScriptsPanel.tsx`, replace current FolderOpen Load with Paintbrush combined action, replace disabled Download Import with disabled Play immediately after it, and make entire rows pointer/keyboard activatable. Preserve Save/Rename/Delete/Refresh, status, confirmation, thumbnail, provenance, and count. [VERIFIED: current panel `PhysicsPaintScriptsPanel.tsx:35-100`]
5. In `PhysicsPaintRightPanel.tsx` and CSS, move the existing options tablist, change exact casing, and verify desktop/286px/stacked overflow. [VERIFIED: right-panel and CSS seams]

## Pitfalls to Prevent

- **Selecting before load settles:** exposes a failed row as selected and violates clipboard authority. Commit selection after successful replacement only. [VERIFIED: current controller risk]
- **Using existing `canApply` directly for the combined button:** it disables when clipboard is empty even though toolbar load would create the clipboard. Use typed replacement eligibility. [VERIFIED: current availability logic]
- **Calling Apply in an effect after load:** introduces stale/racy state and can double-apply. Await the load result in one event handler. [VERIFIED: Preact project constraints and synchronous clipboard replacement]
- **Letting nested actions bubble:** rename/delete interactions can accidentally reload. Stop propagation at explicit nested controls. [VERIFIED: repository row patterns]
- **Keeping CSS uppercase:** changing JSX text alone will not produce mixed-case labels. [VERIFIED: `.physics-paint-options-tab { text-transform: uppercase }`]
- **Running or adding tests before UAT:** explicitly forbidden for this quick. [VERIFIED: CONTEXT]

## Minimum Pre-UAT Validation

Run production-only checks and stop; do not run the server and do not create/modify tests. [VERIFIED: CLAUDE.md and CONTEXT]

```bash
pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app typecheck
pnpm --dir /Users/lmarques/Dev/efx-motion-editor/app exec vite build
git -C /Users/lmarques/Dev/efx-motion-editor diff --check
```

These commands use the installed pnpm 10.27.0, TypeScript 5.9.3, and Vite 5.4.21. [VERIFIED: environment probe and package manifests]

## Security Domain

No new native, filesystem, schema, or bridge authority is required. Preserve the existing validated durable-load boundary and opaque-ID request path; the UI/controller change must never accept paths or bypass `loadSelected`/its transactional replacement successor. Input validation remains in the existing persisted schema/native service, and generated-frame access control remains in the existing Apply availability/controller. [VERIFIED: codebase architecture and task boundary]

## Confidence

**Overall: HIGH.** Findings are derived from current production code and the native-approved durable Scripts and Copy/Apply implementations. No external package or undocumented API is required. The only discretionary point is exact focus styling, which should follow the existing right-panel `:focus-visible` outline. [VERIFIED: codebase and quick `260716-dby` summary]
