# Memory Recall (MemPalace)

_Wing: efx-motion-editor · Mode: augment · Transport: mcp_

Palace search (release/UAT terms) surfaced no release-phase drawers directly on this topic; the palace is un-augmented for release specifics this run. Native memory (MEMORY.md) carries the release-relevant records below and is authoritative.

## Prior decisions
- v0.8.1 (signed/notarized) release published as GitHub Latest after local + downloaded UAT passed; the preflight → release → verify-downloaded → install → publish sequence is proven — native memory: project_v0_8_1_csp_native_uat_passed
- CSP fix shipped with a guard contract test (`img-src data:` grant + contract test) — never weaken or override release gates — native memory: project_v081_csp_fix_approved
- Apple Developer ID signing/notarization available for future releases; certificate files are never opened/searched — native memory: project_apple_signing_available / feedback_no_certificate_file_access
- Packaged builds enforce CSP while dev server does not — judge bundle freshness by `bundle/macos/*.app` (and inner binary), not `bundle/dmg/` — native memory: project_packaged_csp_divergence

## Patterns
- Release gates ship with guard tests; packaged-app UAT is the user's oracle; evidence = summarized thresholds + user visual confirmation — native memory: feedback_render_uat_evidence
- Automated repo gate chain (vitest → typecheck → build → diff check) recorded with real exit statuses, never historical reuse — palace drawer: 43.1-12-PLAN.md (Task 2)

## Surprises / gotchas
- 36.14: a full typecheck/build chain compiled stale regression files after contract changes — order gates so the compile-proof runs after contract-stable code (release-phase relevance: run all six REL-01 gates green in sequence, capture actual status per gate) — palace drawer: 36.14-11-SUMMARY.md (problems room)
