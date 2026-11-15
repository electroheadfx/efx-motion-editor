---
status: diagnosed
phase: 63-brush-tip-pipeline
source: [63-VERIFICATION.md]
started: 2026-11-15T17:05:00Z
updated: 2026-11-15T20:43:52.433Z
---

## Current Test

[testing complete]

## Tests

### 1. Studio import round trip
expected: In the Brush tab, import a PNG/JPG, paint a visibly textured stroke, switch layers so the Studio re-boots, then paint again with the same tip without re-importing — the imported tip paints its own visibly different footprint in both sessions, with no re-import.
result: pass

### 2. Library surface and degraded tip
expected: Import a PNG/JPG; the Custom card previews its own painted texture (not another tip's, not a raw mask shape) and its footprint differs from presets. Then open a project whose stored brush asset was removed — the degraded tip shows a greyed, unselectable card and exactly one aggregate warning line.
result: pass

### 3. Persistence UAT
expected: Save a project with an imported tip, quit, relaunch, reopen; then move/rename/delete the source image and reopen; then copy the project directory alone to a fresh profile and reopen — the stroke replays with its imported texture from the `.mce` alone in every case; source-image changes are no-ops; the fresh-profile copy reproduces identical strokes and an identical brush library listing.
result: pass

### 4. Fresh-install built-ins
expected: With no imports, open the brush library and paint with Bristle fan, Chalk grain and Sponge — all three are listed adjacent to the presets and each paints its own texture; nothing was written into the project package.
result: pass

### 5. Roto script carrier
expected: Save a script from a project with an imported tip, then apply it in a project that never imported that tip — the script's strokes paint the carried texture with no neutral round fallback, and no catalog row appears for the script tip.
result: issue
reported: "No work, apply script and play script with motion/static/reveal draw to neutral round fallback. The saved or copied script doesn't not store texture choice for each strokes."
severity: major

### 6. Project scoping
expected: Import a tip in project A, open project B, then close the project and start a New Project — in project B the A tip is neither listed nor resolvable; after close/New Project the library and registry hold exactly the three built-ins.
result: pass

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-63-5
  truth: "A script saved from a project with an imported tip carries that tip's texture when applied in a project that never imported it — no neutral round fallback."
  status: failed
  reason: "User reported: No work, apply script and play script with motion/static/reveal draw to neutral round fallback. The saved or copied script doesn't not store texture choice for each strokes."
  severity: major
  test: 5
  root_cause: "The per-track Studio script snapshot (SNP1/AQTL) never carries engine.textureId: AQTL encode (scriptTimelineCodec.ts:635-743, engine block 680-726) and decode (998-1014) omit it, so every Studio boot/layer switch/track reseed calls studioScriptSnapshotController.restore() which wholesale-replaces payloadTimeline (aquarelleRecordState.ts:1771-1781), silently stripping every recorded stroke's texture before Save/Copy Script captures it. Secondary: aquarelleSelectedTextureId is session-only module state (aquarelleRecordState.ts:132), never restored on boot, and silently nulls an absent pick (360-368; AquarelleCanvasLayer.tsx:629-631,535). Confirmed by the real saved script on disk (v2.1.0-phase-60-2.mce scripts/c649ad32...efx-roto-script.json): brushPack carries all 3 imported tips with inline maskDataUrl, 23 brush strokes + 15 Dry events, zero occurrences of textureId; u16-quantized UV on strokes 0-18 vs raw floats on 19-22 proves a mid-session restore."
  artifacts:
    - path: "app/src/components/physic-paint/performance/scriptTimelineCodec.ts"
      issue: "AQTL encode (635-743) and decode (998-1014) omit engine.textureId — the drop point"
    - path: "app/src/components/physic-paint/snapshot/studioScriptSnapshotController.ts"
      issue: "restore() decodes and wholesale-replaces the timeline (676, 712, 755)"
    - path: "app/src/components/physic-paint/view/aquarelleRecordState.ts"
      issue: "restore replaces payloadTimeline (1771-1781); texture selection is session-only (132) and silently gated (360-368)"
    - path: "app/src/components/physic-paint/engine/AquarelleCanvasLayer.tsx"
      issue: "record conditionally writes texture (629-631, 535)"
  missing:
    - "Add a presence-prefixed textureId string to the AQTL stroke engine block, encode + decode, with the format's clean-break version bump"
    - "Regression test covering record -> SNP1 encode/decode -> restore -> save script, which no current test exercises (76/76 pass while this path is broken)"
    - "Optional: restore/retain the Studio texture selection across a realm reset"
  debug_session: .planning/debug/roto-script-drops-texture.md
