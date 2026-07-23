---
status: diagnosed
trigger: "Diagnose only the shared root cause(s) behind Phase 36.14 UAT gaps G-36.14-1, G-36.14-4, G-36.14-6, G-36.14-7, G-36.14-8, and the interpolation portion of G-36.14-10."
created: 2026-07-23T20:59:07Z
updated: 2026-07-23T21:08:07Z
---

## Current Focus

bug_class: bohrbug
hypothesis: Confirmed — the physical interpolation toggle crosses two unsynchronized interpolation authorities, and generated rendering has a separate invalid-image fallback.
test: Static working-backwards trace from the exact parent rejection, controlled checkbox, physical revision encoder, rollback path, first-paint ownership transaction, and generated-frame image consumer.
expecting: The child physical state must encode enabled=true while the parent physical state still encodes enabled=false; the generated fallback must emit data that is not a valid PNG when transient canvas registrations are absent.
next_action: Return the root-cause-only diagnosis; do not modify or execute production code.
candidate_causes:
  - code: Canonical physical interpolation and legacy interpolation settings are independently mutated and consumed.
  - data/runtime: Generated rendering depends on transient in-process canvas registrations that are not reconstructed from hydrated canonical PNG payloads.
  - config/environment: No configuration or environment difference is needed to produce the reported failures.
and_gate: The stale-revision rejection requires both child canonical enabled=true and parent canonical enabled=false. Empty generated paint is an independent rendering branch that can occur when either source canvas is absent from the transient registry.

## Symptoms

expected: Interpolation has a visible enabled state; strict-interior generated frames render derived paint; painting a new real key while interpolation is enabled preserves stable keyId, direct appFrame, payload, and cache; Drag, Force Spacing, Duplicate, and Paste commit the same physical maps with interpolation enabled or disabled under parent/coordinator authority.
actual: The interpolation control has no visible state and needs two clicks; generated interior frames render empty; painting a new key while interpolation is enabled loses the key/cache; interpolation-enabled physical actions are rejected or rolled back while the same actions work with interpolation disabled.
errors: "Roto physical revision became stale before commit."
reproduction: Phase 36.14 native UAT tests 1, 4, 6, 7, 8, and the interpolation-enabled portion of test 10, as recorded in 36.14-UAT.md.
started: Observed during Phase 36.14 UAT on the current working tree, including uncommitted production fixes.

## Eliminated

- hypothesis: Drag, Force Spacing, Duplicate, or Paste has a general physical-map or stable-identity defect.
  evidence: The UAT records the same operations as accepted with interpolation disabled; the shared divergence is introduced only by enabling interpolation.
  timestamp: 2026-07-23T21:08:07Z
- hypothesis: Configuration, platform, or capacity causes the stale revision.
  evidence: The revision mismatch follows directly from deterministic code paths that encode different interpolation booleans; no environment or capacity branch precedes the exact rejection.
  timestamp: 2026-07-23T21:08:07Z
- hypothesis: The current first-paint stable-key mechanism independently loses identity or appFrame.
  evidence: It deliberately creates a blank real key through the acknowledged physical Paste path and validates the accepted keyId/appFrame before publishing pixels; interpolation-enabled Paste is rejected earlier by the same revision mismatch.
  timestamp: 2026-07-23T21:08:07Z

## Evidence

- timestamp: 2026-07-23T20:59:07Z
  checked: Phase 36.14 UAT report
  found: All affected physical operations succeed with interpolation disabled, while interpolation-enabled Duplicate and Paste explicitly fail with a stale physical revision; the same mode also correlates with empty generated frames and loss of newly painted real keys.
  implication: The stale-revision failure is interpolation-path-specific rather than a general Drag/Force Spacing/Duplicate/Paste map or identity defect; control-state and generated-rendering symptoms require separate tracing.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/stores/physicPaintStore.ts:61-80 and app/src/stores/physicPaintStore.ts:778-798
  found: The store contains separate maps for legacy `_rotoInterpolationSettings` and canonical `_rotoPhysicalInterpolationState`; the legacy setter updates only the legacy map and regenerates its cache.
  implication: Two independent sources of truth exist for the same enabled concept.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/components/physic-paint/hooks/useRotoInterpolationController.ts:34-72
  found: One click first mutates child canonical physical state with `setRotoPhysicalInterpolationState`, then sends the legacy `update-roto-interpolation-settings` payload.
  implication: The child changes revision-bearing physical state locally before any parent-authoritative physical transaction, but asks the parent to mutate a different state model.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/lib/physicPaintBridge.ts:156-162
  found: The parent handles `update-roto-interpolation-settings` by calling only `setRotoInterpolationSettings`; it does not update or replace the canonical physical document.
  implication: After enabling, child canonical interpolation is true while parent canonical interpolation remains false.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/components/physic-paint/PhysicsPaintStudio.tsx:77-81, 799-807, 965-970 and app/src/components/physic-paint/view/PhysicsPaintWorkflowStrip.tsx:224-255, 767-774
  found: Studio already derives reactive canonical `rotoInterpolationState`, but the controlled checkbox receives legacy `getRotoInterpolationSettings`; its `checked` value therefore does not read the state changed by its own handler.
  implication: The checkbox can be rendered back to its stale unchecked value, accounting for the missing visible state and apparent repeated-click behavior. Exact click timing was not executed under the diagnosis constraints.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/components/physic-paint/physicsPaintStudio.css:1515-1544
  found: The control has only native checkbox sizing and `accent-color`; there is no accepted-state class, pressed state, or explicit ON/OFF label.
  implication: The wrong controlled value has no independent visual presentation that could reveal the accepted canonical state.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/components/physic-paint/roto/physicsPaintRotoPhysicalModel.ts:591-623
  found: Canonical physical revision encoding includes `interpolation.enabled` in addition to the stable real-key records and payloads.
  implication: Equal records with child enabled=true and parent enabled=false necessarily produce different physical revisions.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:559-615 and app/src/lib/physicPaintBridge.ts:392-410
  found: The coordinator builds `expectedRevision` from the child's current canonical interpolation, while the parent recomputes it from the parent's unchanged canonical interpolation and emits the exact UAT error on inequality.
  implication: Drag, Force Spacing, Duplicate, Paste, and serialized physical work are deterministically rejected whenever the split state has been created.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/components/physic-paint/hooks/useRotoPhysicalEditCoordinator.ts:403-466
  found: A parent rejection restores the complete before snapshot.
  implication: Drag returning to its source and spacing/duplicate/paste appearing not to commit are expected rollback effects, not separate map defects.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/components/physic-paint/PhysicsPaintStudio.tsx:442-484, 581-614, 885-908
  found: The current working tree creates an empty-cell real key through an acknowledged Paste, waits for the accepted stable keyId/appFrame, and publishes pixels only to that accepted record.
  implication: With interpolation enabled, stale-revision rejection makes the first-paint target null, so cache publication cannot proceed. New-key/cache loss is downstream of the shared revision defect; the stable-key/direct-appFrame design should be preserved.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/stores/physicPaintStore.ts:424-486 and app/src/stores/physicPaintStore.ts:1303-1345
  found: Every physical generated cell uses the synchronous blend renderer. A valid PNG is produced only when both source data URLs resolve to canvases in `_rotoAlphaCanvasRegistry`; otherwise the fallback base64-encodes a custom `roto-alpha:...` string and labels it `data:image/png`.
  implication: The fallback payload lacks a PNG signature and is not a decodable PNG, so generated frames can be classified correctly yet render empty.
- timestamp: 2026-07-23T21:08:07Z
  checked: app/src/components/physic-paint/roto/rotoCanvasFrames.ts:24-35, app/src/components/physic-paint/roto/rotoLaunchHydration.ts:69-78, and app/src/components/physic-paint/hooks/useRotoReferenceController.ts:42-52, 83-98
  found: Freshly encoded canvases are registered, but physical launch hydration only installs the canonical document and does not reconstruct registry canvases from payload PNGs; the reference loader passes the generated data URL directly to the engine as an image.
  implication: Generated rendering is incorrectly dependent on transient process-local registry history rather than solely on canonical real-key payloads. This is separate from the state/revision split.

## Resolution

root_cause: >-
  Control-state and stale revision share one authority defect: the physical interpolation control locally mutates child canonical `_rotoPhysicalInterpolationState`, displays child legacy `_rotoInterpolationSettings`, and sends a legacy payload that mutates only the parent's legacy settings. Because canonical revisions include `interpolation.enabled`, the child then submits enabled=true while the parent still validates enabled=false, producing the exact stale-revision rejection and coordinator rollback. The current first-paint Paste consequently cannot acquire an accepted stable keyId, so the new key/cache is not published. Separately, strict-interior generated rendering falls back to a custom base64 string mislabeled as PNG whenever canonical source payloads lack transient canvas-registry entries; hydration does not rebuild that registry, so the engine receives an invalid image and renders empty.
fix: >-
  Diagnosis only. Minimal direction: make canonical physical interpolation the single authority and the control's single read model. Route enabled-state changes through the existing acknowledged parent/coordinator physical transaction (unchanged records, changed enabled-only interpolation) instead of locally mutating first or using `update-roto-interpolation-settings`; bind the checkbox and explicit visible active presentation to the accepted canonical `rotoInterpolationState`. Do not dual-write legacy and physical interpolation. Preserve the current stable-key/direct-appFrame first-paint flow. For generated cells, remove the pseudo-PNG fallback and produce a valid composited image from canonical source PNG payloads, with decoding/registration/hydration handled before publication rather than relying on transient registry presence.
verification: >-
  Static source diagnosis only, using the recorded native Phase 36.14 UAT as the red artifact. No tests, test discovery, typecheck, build, server, browser, or native app were run, as explicitly required. The stale-revision mechanism is a deterministic source-level proof; the generated-render branch proves a deterministic invalid-image fallback, while exact registry availability in the reported native run remains unexecuted.
files_changed:
  - /Users/lmarques/Dev/efx-motion-editor/.planning/debug/uat-36-14-interpolation-revision.md
