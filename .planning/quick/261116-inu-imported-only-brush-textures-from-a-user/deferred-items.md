# Deferred items — quick 261116-inu

Out-of-scope discoveries logged during execution (executor scope-boundary rule).

## 1. Script-carrier fixtures still build 192x192 WebPs (pre-existing at Task 1's commit)

- **Files:** `app/src/components/physic-paint/roto/physicsPaintRotoScriptLibrary.test.ts`
  (`brushWebp(192, 192)` at the save-leg fixtures),
  `app/src/components/physic-paint/roto/physicsPaintRotoScriptSchema.test.ts`
  (`scriptDataUrl(192, 192)` at the `decodeScriptMaskDataUrl` cases).
- **Symptom:** 4 + 4 failing tests. `decodeScriptMaskDataUrl` now requires
  `TIP_MASK_EDGE` (512) after Task 1, so the 192x192 fixture data URLs are
  refused and `serializeAquarelleRotoScript` throws.
- **Cause:** Task 1's `TIP_MASK_EDGE` 192 -> 512 retarget did not touch these
  two files; they are not in Task 1's or Task 2's file lists.
- **Ownership:** Task 5 explicitly owns both files ("drops its `maskDataUrl`
  cases", retargets the carrier fixtures when the inline mask carrier is
  removed). Task 5 rewrites or deletes these assertions, so patching the 192
  literals here would be churn on code that is about to disappear.
- **Status:** open — expected green again at Task 5.
