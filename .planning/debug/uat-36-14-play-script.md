---
status: diagnosed
trigger: "Diagnose only Phase 36.14 UAT gap G-36.14-13. User correction: the paint mode under test is Physics Paint, not p5.brush. Copy/Apply Script works. Play Script regressed: its UI is constrained inside a short-height dark panel instead of the previous full-height light presentation, and generated Play Script caches no longer work. Screenshot evidence is /Users/lmarques/.claude/image-cache/3737de95-687f-47d7-b37e-690c2e3f9391/19.png. Console also logs an unhandled rejection: notification.is_permission_granted not allowed on window efx-physic-paint; allowed on windows: main. Determine whether notification rejection is unrelated console noise or contributes to Play Script failure. Compare current implementation with the prior accepted Play Script behavior using git history if useful. Inspect current working tree including uncommitted production fixes. Do not modify production code or tests. Do not run tests, typecheck, build, server, browser, or native app. You may write only .planning/debug/uat-36-14-play-script.md. Read the UAT and relevant code. Report separate root causes for UI layout and cache failure, evidence with file:line references, files involved, and minimal fix direction."
created: 2026-07-23T00:00:00Z
updated: 2026-07-23T23:45:00Z
audit_acknowledged:
  milestone: v0.9.0
  at: 2026-08-21
  status: diagnosed
---

## Current Focus

hypothesis: Confirmed two independent code-path regressions: the Play Script dialog is mounted and styled inside a height-constrained dark Scripts pane, while Play Script publication remains on the retired frame-indexed cache path after Phase 36.14 made physical key records the durable/rendering authority. The notification permission rejection is unrelated console noise.
test: Static differential trace from the UAT screenshot through current UI composition, Play Script render/commit/mirror, store serialization, physical hydration/rendering, Tauri capabilities, working-tree cutover changes, and accepted Git history.
expecting: Confirmed. UI constraints explain the exact screenshot; legacy Play Script writes are excluded whenever a physical document exists; notification has no dependency edge into Play Script.
next_action: Return the diagnose-only ROOT CAUSE FOUND result; do not modify production code or run executable verification.
bug_class: Bohrbug — deterministic structural/data-authority mismatch visible by static tracing.
reasoning_checkpoint:
  hypothesis: "UI layout fails because the Play dialog is an absolutely positioned child of the split secondary Scripts pane; cache persistence fails because Play Script commits and mirrors replace-roto-key-frames while save/reopen/render consume rotoPhysical real-key records."
  confirming_evidence:

    - "PhysicsPaintScriptsPanel.tsx:108-133 mounts Play Script under .physics-paint-scripts-panel; physicsPaintStudio.css:1132-1141 and 1207-1208 constrain it and paint it #292b2d."
    - "useRotoPlayScriptController.ts:44-47 sends replace-roto-key-frames; physicPaintStore.ts:930-964 updates legacy frame/cache maps only, while physicPaintStore.ts:653-677 serializes frames: [] when physical records exist."
    - "physicPaintStore.ts:1275-1345 and rotoLaunchHydration.ts:33-78 consume only the physical record document for projection/render/reopen."
  falsification_test: "The diagnosis would be wrong if Play Script published PhysicPaintRotoRealKeyRecord entries through replace-roto-physical-map, or if the dialog were mounted outside the split right pane with an unconstrained light full-height surface; neither is true in the inspected implementation."
  fix_rationale: "Move only the Play dialog surface to a Studio-level full-height light host, and migrate Play publication to the authoritative physical-map transaction so generated PNG payloads belong to stable keyId/appFrame records used by render, save, and reopen."
  blind_spots: "No runtime execution was permitted. Static evidence identifies deterministic divergence points but does not measure whether an additional renderer defect exists after the authority mismatch is corrected."
  candidate_causes:

    - "code: wrong UI mount/style boundary and legacy replace-roto-key-frames publication"
    - "config: child Tauri capability omits notification permission, producing an independent rejection"
    - "data: coexistence of legacy cachedRotoFrames and canonical rotoPhysical fields allows stale writes to compile but not persist"
  and_gate: "No for either reported symptom: the UI layout defect and cache-authority defect reproduce independently. The notification capability mismatch is a third independent condition and is not required for either Play Script failure."

## Symptoms

expected: Physics Paint Play Script retains its prior accepted full-height light presentation, and generated Play Script caches remain usable.
actual: Copy/Apply Script works, but Play Script is constrained inside a short-height dark panel and generated Play Script caches no longer work.
errors: Unhandled rejection: notification.is_permission_granted not allowed on window "efx-physic-paint"; allowed on windows: "main".
reproduction: In the Physics Paint window, open/use Play Script as exercised by Phase 36.14 UAT G-36.14-13; observe the compact dark UI and try generated Play Script caches.
started: Regression observed during Phase 36.14 UAT; prior Play Script behavior had been accepted.

## Eliminated

- hypothesis: The reported surface is p5.brush rather than Physics Paint.
  evidence: The screenshot and the `/physics-paint` component path show the standalone Physics Paint Studio Scripts pane; the UAT correction explicitly identifies Physics Paint, and Copy/Apply Script uses this same physical workflow.
  timestamp: 2026-07-23T20:30:00Z

- hypothesis: The notification permission rejection interrupts Play Script rendering, commit, mirror, or cache persistence.
  evidence: The only inspected `isPermissionGranted` call is the post-export notification block in `exportEngine.ts:371-389`, guarded by `document.hidden` and `try/catch`. No Play Script module imports or awaits that path. The rejection is explained independently by `default.json:5-33` granting notification only to `main` while `physics-paint.json:5-12` grants none to `efx-physic-paint`.
  timestamp: 2026-07-23T22:20:00Z

- hypothesis: A new Phase 36.14 CSS edit alone introduced the compact dark Play Script dialog.
  evidence: Git history attributes the dialog mount/style to `6ee19538` (`feat(260717-m9k): add authoritative Play Script generation`), and the same compact dark CSS remains in the accepted `cbe38e5a` state. Phase 36.14 exposed an oracle mismatch rather than introducing a new stylesheet change: m9k accepted a compact dialog, while current UAT explicitly requires full-height light presentation.
  timestamp: 2026-07-23T22:35:00Z

## Evidence

- timestamp: 2026-07-23T00:00:00Z
  checked: Screenshot `/Users/lmarques/.claude/image-cache/3737de95-687f-47d7-b37e-690c2e3f9391/19.png`
  found: The Physics Paint Scripts tab shows controls and generation progress inside a shallow dark sidebar panel while the paint canvas remains large and light.
  implication: The visible UI symptom is a container/layout regression in the Physics Paint window, not a p5.brush mode issue.

- timestamp: 2026-07-23T20:40:00Z
  checked: Phase 36.14 UAT oracle at `/Users/lmarques/Dev/efx-motion-editor/.planning/phases/36.14-physics-paint-roto-timeline-ui-from-pencil/36.14-UAT.md:132-140,275-289`
  found: Test 13 requires a full-height light Play Script presentation and stable generated caches; Copy/Apply Script passed, while Play Script UI/cache and notification were reported separately.
  implication: The requested diagnosis must preserve Copy/Apply and isolate layout, publication/persistence, and notification causes.

- timestamp: 2026-07-23T20:55:00Z
  checked: Current Play Script mount in `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx:56-64,108-133`
  found: The Play Script dialog is rendered directly as a child of `.physics-paint-scripts-panel`, alongside the script list and the delete confirmation.
  implication: It inherits the Scripts pane's containing block and cannot become a Studio/canvas-height surface without moving the render boundary.

- timestamp: 2026-07-23T21:00:00Z
  checked: Current Scripts/dialog styles in `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintStudio.css:1132-1141,1207-1208`
  found: The parent is `position: relative`, `min-height: 180px`, and `overflow: hidden`; the dialog is `position: absolute`, has `max-height: calc(100% - 52px)`, `overflow: auto`, and explicit dark `background: #292b2d`.
  implication: These declarations directly produce the short-height dark panel shown in the screenshot.

- timestamp: 2026-07-23T21:10:00Z
  checked: Right-pane composition in `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx:184-186,370-376,567-629`
  found: The right panel starts with a 50/50 split and mounts Scripts in the secondary half through `PhysicsPaintScriptsPanel`.
  implication: The dialog's percentage height is relative to only the lower half of the sidebar, compounding the local `max-height` constraint.

- timestamp: 2026-07-23T21:15:00Z
  checked: Studio-level composition in `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx:145-156`
  found: The right panel is a sibling of the canvas and workflow strip, but Play Script has no Studio-level dialog slot.
  implication: A full-height surface requires hoisting only the dialog presentation to this level or an equivalent Studio overlay host; increasing the Scripts pane's minimum height would not remove the split-pane constraint.

- timestamp: 2026-07-23T21:30:00Z
  checked: Play Script generation/commit flow in `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts:112-150`
  found: Rendering stages progressive PNG frames, merges them into `completeFrames`, commits a frame list, then calls `mirrorAccepted(completeFrames, ...)` after parent acceptance.
  implication: The renderer has a valid staged output handoff; the authority seam after rendering determines whether those outputs become durable physical keys.

- timestamp: 2026-07-23T21:35:00Z
  checked: Play Script bridge adapter in `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts:38-47`
  found: Commit still sends `{ kind: 'replace-roto-key-frames', ...payload }`.
  implication: Play Script was not migrated to the Phase 36.14 `replace-roto-physical-map` transaction used by the canonical physical timeline.

- timestamp: 2026-07-23T21:45:00Z
  checked: Parent apply/authority routing in `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts:155-196,207-240`
  found: Play Script validation and acceptance still derive authority from `getRotoCacheFrames()` and dispatch to `replaceRotoKeyFrames`; the physical-map payload has a separate branch.
  implication: Parent acceptance only confirms consistency of the legacy frame-indexed snapshot, not publication into physical `keyId/appFrame` records.

- timestamp: 2026-07-23T21:55:00Z
  checked: Child mirror in `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx:532-553`
  found: The child mirror again calls `replaceRotoKeyFrames`, refreshes `getRotoCacheFrames`, and writes legacy `cachedRotoFrames`/`rotoBackground` into launch context; it creates or preserves no physical `keyId` record.
  implication: Both authoritative parent commit and local mirror write the retired cache authority, so the physical timeline/render source never receives the generated Play keys.

- timestamp: 2026-07-23T22:00:00Z
  checked: Legacy store mutation in `/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts:930-964`
  found: `replaceRotoKeyFrames` replaces `_frames` and `_rotoCacheMetadata` and regenerates legacy generated cache metadata, but does not update `_rotoRealKeyRecords` or the physical revision/document.
  implication: A successful Play Script response can still leave the canonical physical document unchanged.

- timestamp: 2026-07-23T22:05:00Z
  checked: Serialization branch in `/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts:653-685`
  found: When `_rotoRealKeyRecords` exists, `toMceOutputs()` returns the physical document with `frames: []`; legacy frames are serialized only in the non-physical fallback branch.
  implication: Play Script frames written only to `_frames` are deterministically omitted from save output on a Phase 36.14 physical layer.

- timestamp: 2026-07-23T22:10:00Z
  checked: Physical render and persistence paths in `/Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts:1275-1345`, `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintPersistence.ts:143-187`, and `/Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoLaunchHydration.ts:33-78`
  found: Timeline projection/render source read physical records; persistence writes physical record payloads to `key-{appFrame}-{keyId}.png`; relaunch requires and installs the complete `rotoPhysical` document.
  implication: Legacy Play Script cache entries are ignored by live physical rendering and cannot survive save/reopen unless converted into authoritative physical records.

- timestamp: 2026-07-23T22:15:00Z
  checked: Transitional launch types in `/Users/lmarques/Dev/efx-motion-editor/app/src/types/physicPaint.ts:376-405`
  found: Canonical `rotoPhysical` coexists temporarily with optional legacy `rotoBackground`, `cachedRotoFrames`, and interpolation fields.
  implication: The stale Play Script path can still typecheck and appear locally successful even though current persistence/hydration use a different authority.

- timestamp: 2026-07-23T22:25:00Z
  checked: Current uncommitted physical-cutover changes in `PhysicsPaintStudio.tsx`, `usePhysicsPaintLaunchIntegration.ts`, and Rust project/launch models
  found: The working tree increasingly reads launch background and hydration from `rotoPhysical` and removes legacy serialized fields, but does not change Play Script's `replace-roto-key-frames` commit/mirror.
  implication: The uncommitted production fixes do not repair Play Script; they reinforce the physical authority boundary that exposes its stale publication path.

- timestamp: 2026-07-23T22:40:00Z
  checked: Git history around `6ee19538`, `719cc906`, `cbe38e5a`, `3983bf95`, `04debfab`, `0f08d6df`, and `c03a7dee`
  found: The m9k fusion introduced the compact dialog and later removed the separate larger Play workflow. Phase 36.14 then migrated persistence, live cache, and Copy/Apply to physical records, while `0f08d6df` changed Play Script selection to physical frame/identity but left commit publication legacy.
  implication: UI and cache failures have different histories: UI is an inherited presentation/oracle mismatch; cache is an incomplete physical-authority cutover specific to Play Script publication.

- timestamp: 2026-07-23T22:50:00Z
  checked: Notification call and capabilities in `/Users/lmarques/Dev/efx-motion-editor/app/src/lib/exportEngine.ts:371-389`, `/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/capabilities/default.json:5-33`, and `/Users/lmarques/Dev/efx-motion-editor/app/src-tauri/capabilities/physics-paint.json:5-12`
  found: Notification permission is queried only after export completion; `notification:default` is scoped to `main`, not `efx-physic-paint`.
  implication: The rejection is a real child-window capability/configuration defect but has no call/data-flow connection to Play Script generation or cache publication.

## Resolution

root_cause: >-
  UI layout root cause: Play Script's confirmation UI is mounted inside the lower split Scripts pane and reuses the compact delete-confirmation CSS. Its containing panel is relative/overflow-hidden, while the dialog is absolutely positioned, percentage-height constrained, scrollable, and explicitly dark. This structurally prevents the required full-height light presentation. The code predates Phase 36.14 and was accepted under the earlier m9k "compact dialog" oracle, so the current UAT exposes a presentation-contract mismatch rather than a recent CSS edit.

  Cache root cause: Phase 36.14 made physical real-key records (`keyId` + `appFrame` + payload) the sole timeline, render, persistence, and relaunch authority, but Play Script still commits and mirrors `replace-roto-key-frames`. That legacy mutation updates `_frames`/legacy cache metadata only. On any layer with physical records, serialization intentionally emits `frames: []`, and physical projection/hydration never reads those legacy entries. Consequently generated Play Script PNGs are not attached to authoritative physical identities and are ignored or lost across rendering/save/reopen.

  Notification classification: unrelated console noise for this Play Script failure. The rejection is caused by calling the notification plugin from `efx-physic-paint` although the capability is granted only to `main`; the only located call is a post-export block and Play Script neither imports nor awaits it.
fix: >-
  UI: preserve the existing Play controller, validation, focus trap, progress, and cancellation, but hoist only the Play dialog presentation from `PhysicsPaintScriptsPanel` to a Studio-level/canvas-level host and give it a dedicated full-height light class. Do not restore the retired separate Play workflow and do not merely increase the Scripts pane minimum height.

  Cache: migrate Play Script commit/mirror to the canonical physical-map transaction. Build a complete `PhysicPaintRotoRealKeyRecord` set, preserve existing stable `keyId`s outside/reused within the affected range, assign stable new IDs to newly generated destinations, attach each staged PNG payload to its physical record, validate physical revision/capacity atomically in the parent, and mirror only the accepted physical document. Read/write Motion and background through `rotoPhysical`. Do not maintain a second synchronization layer between legacy frames and physical records.

  Notification: fix separately by gating notification calls to the `main` window, moving notification dispatch to a main-only path, or deliberately granting the child capability if product behavior requires it.
verification: >-
  Static diagnose-only verification under explicit user constraints. The screenshot symptom matches the inspected DOM/CSS constraints; the cache data-flow was traced from renderer output through commit/mirror to serialization, physical rendering, persistence, and hydration; Git history and the current uncommitted cutover were compared; notification was traced to a separate export-only capability path. No tests, typecheck, build, server, browser, or native app were run. Runtime verification remains required after implementation.
oracle_type: specified — Phase 36.14 UAT Test 13 and user-provided screenshot/report.
files_involved:

  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintScriptsPanel.tsx
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintRightPanel.tsx
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/view/PhysicsPaintStudioView.tsx
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/physicsPaintStudio.css
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/physicsPaintRotoPlayScriptController.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/hooks/useRotoPlayScriptController.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/PhysicsPaintStudio.tsx
  - /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintBridge.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/stores/physicPaintStore.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/lib/physicPaintPersistence.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/components/physic-paint/roto/rotoLaunchHydration.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/types/physicPaint.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src/lib/exportEngine.ts
  - /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/capabilities/default.json
  - /Users/lmarques/Dev/efx-motion-editor/app/src-tauri/capabilities/physics-paint.json

files_changed:

  - /Users/lmarques/Dev/efx-motion-editor/.planning/debug/uat-36-14-play-script.md
