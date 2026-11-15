---
status: complete
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
  artifacts: []
  missing: []
