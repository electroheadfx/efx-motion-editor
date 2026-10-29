---
status: resolved
trigger: "Fix the Roto key-creation regression: 'Could not create a Roto key on this frame — the stroke was discarded.' Adding a key by painting on a non-real frame (empty or interpolated) and via '+ Rail' both fail; only '+ Key' still works. Window opens after the UAT-approved 997afe8e (quick 261029-bks)."
created: 2026-10-29T00:00:00Z
updated: 2026-10-29T00:00:00Z (native UAT approved by the user — session resolved)
---

## Current Focus

bug_class: Bohrbug
hypothesis: "Confirmed. Quick 261029-bks set libwebp to method 0 / quality 50 in WebPLosslessCodec::encode_rgba. For a UNIFORM (single-colour, e.g. fully transparent) frame at a large canvas size, method 0 emits a trivial 34-byte VP8L stream. libwebp itself decodes it (dwebp, webpinfo: no error, 1080×1920), but Apple's ImageIO/WebKit WebP decoder rejects it — sips reports nil dimensions and createImageBitmap/Image both fail. buildBlankRotoFrame produces exactly that uniform frame, so the parent-side prepareRotoPhysicalRealKeyFrames throws 'Canonical Roto WebP could not be decoded.', the physical edit is rejected as parent-rejection, and promotion reports no-acceptance."
reasoning_checkpoint:
  confirming_evidence:

    - "Native repro (user): '+ Rail' on a fresh start logs '[PhysicsPaintStudio] physical edit: Roto physical edit failed (parent-rejection): Canonical Roto WebP could not be decoded.' Paint on an empty frame logs the same rejection plus promotion diagnostic 'no-acceptance · reason=parent-rejection · Apply failed — see LOG · Added an empty Roto key.' — so the failing branch is no-acceptance, not any promoteRotoPaintTargetRef guard."
    - "The rejection text is thrown only at app/src/components/physic-paint/roto/rotoCanvasFrames.ts:86/93, inside decodeRotoWebpOffMainThread. Both createImageBitmap and the Image fallback fail, so the bytes are rejected by the browser decoder, not by a shape/identity guard."
    - "physicPaintBridge.ts applyPreparedPhysicPaintPayload decodes EVERY bytes-carrying record of the edit before applying, so a new blank key's payload alone can reject the whole edit."
    - "rotoCanvasFrames.ts registerRotoAlphaCanvasFrameFromBytes early-returns when hasRotoAlphaCanvasFrame(bytes, size) — an already-registered payload never decodes. '+ Key' clones a previous real key whose canvas is already registered, which is why only '+ Key' still works."
    - "Empirical (Pillow/libwebp 1.6.0, same version as cwebp on this machine): a fully transparent 1080×1920 RGBA encoded with lossless+exact, method 0/quality 50 is 34 bytes with a valid 1080×1920 VP8L header and webpinfo reports 'No error detected', yet sips reports pixelWidth/pixelHeight <nil>. method 1/quality 50, method 1/quality 75 and method 4/quality 75 produce 128 bytes and decode correctly."
    - "Trigger matrix: opaque-solid and semi-solid uniform frames also fail at method 0; 2-colour and 3-colour frames and one-stroke/noisy frames decode fine at method 0, so the trigger is the trivial single-colour stream, not method 0 in general."
    - "Quality is irrelevant: method 0/quality 50 and method 0/quality 100 produce byte-identical size (34 B). Only method selects the trivial path."
    - "Size sweep: uniform frames decode at method 0 up to 768×768 (589 824 px) and fail from 999×999 (998 001 px) upward, including 1080×1920 and 1920×1080. Every real Studio canvas size is in the failing range."
  falsification_test: "If the blank 1080×1920 payload were decodable by Apple's decoder, or if the rejection persisted after the codec stopped emitting the 34-byte trivial stream, this diagnosis would be wrong."
  fix_rationale: "Fix once in the Rust codec so every uniform frame — blank keys AND any fully-cleared or solid-colour real key that could otherwise be persisted and fail launch hydration — is safe. Keep quality 50 / method 0 for real content to preserve the 261029-bks perf win, and re-encode at method 1 only when the output took the trivial single-colour shortcut. method 1 costs nothing on uniform content (a 128-byte encode)."
  blind_spots: "The native UAT must confirm the fix inside the app; this environment cannot run the Studio. Apple's exact pixel threshold is characterised only empirically (between 768×768 and 999×999) and is not needed by the fix, which keys on the emitted stream rather than on dimensions."
  candidate_causes:

    - "code: WebPLosslessCodec::encode_rgba now emits libwebp method-0 trivial uniform streams that Apple's decoder rejects"
    - "code: buildBlankRotoFrame supplies a fully uniform frame, the exact content class that triggers the trivial path"
  and_gate: "yes — the bug requires BOTH the method-0 codec change and a uniform payload reaching the parent-side decode"
hypothesis: confirmed root cause in WebPLosslessCodec::encode_rgba
test: re-encode the trivial single-colour stream at method 1 and rerun the codec tests plus the app suite
expecting: a 1080×1920 uniform frame encodes to a payload Apple's decoder accepts, and key creation works by paint and by + Rail
fix_applied: "frame_codec.rs encode_rgba re-encodes at method 1 when the payload is below TRIVIAL_SINGLE_COLOUR_PAYLOAD_FLOOR (64 B); method 0 / quality 50 still used for real content"
next_action: "none — native UAT approved by the user on 2026-10-29 ('UAT approved, work now'); session resolved."
blind_spots: "Latent, NOT fixed by design: any uniform REAL-key payload already persisted with method-0 bytes would still fail launch hydration. Creation was blocked during the regression window, so this set should be empty; no migration was added."

## Symptoms

expected: Painting on a non-real frame (empty or interpolated) promotes the frame to a real Roto key, and "+ Rail" creates a blank key that starts a new rail.
actual: Both fail with "Could not create a Roto key on this frame — the stroke was discarded."; only "+ Key" still works.
errors: "[PhysicsPaintStudio] physical edit: Roto physical edit failed (parent-rejection): Canonical Roto WebP could not be decoded." and "[PhysicsPaintStudio] auto-key promotion failed: no-acceptance · reason=parent-rejection · Apply failed — see LOG · Added an empty Roto key."
reproduction: Fresh app start, then click "+ Rail"; or paint on an empty/interpolated non-real frame. Both reproduce on the first attempt.
started: After 997afe8e (quick 261029-bks), which changed WebP lossless encode settings from method 1 / quality 75 to method 0 / quality 50.

## Eliminated

- hypothesis: A promotion guard in promoteRotoPaintTargetRef fails (launch-mismatch, session-track-mismatch, previous-key-bytes-unavailable, blank-frame-failed, created-key-missing, dispatch-threw).
  reason: The native diagnostic names no-acceptance with reason=parent-rejection, so the promotion reached dispatch and the parent refused the edit.
- hypothesis: "+ Rail" reports a stale promotion message from an earlier paint attempt.
  reason: A clean fresh-start "+ Rail" click reproduces the parent-rejection on its own; the message is not stale.
- hypothesis: The WebP bytes are malformed.
  reason: webpinfo reports "No error detected" and libwebp decodes them at the correct dimensions. The stream is valid; Apple's decoder rejects this valid stream.
- hypothesis: The payload shape differs between + Key and the failing paths.
  reason: toEmptyKeyPayload and the inline payloads produce identical fields; the discriminator is the canvas registry early-return, not the payload shape.
- hypothesis: quality 50 causes the regression.
  reason: method 0 / quality 100 produces the same 34-byte stream and fails identically; method 1 passes at every quality.

## Evidence

- timestamp: 2026-10-29T00:00:00Z
  checked: Native repro from the user on a fresh app start (+ Rail, then paint on an empty frame).
  found: Both log parent-rejection "Canonical Roto WebP could not be decoded."; promotion additionally logs no-acceptance · reason=parent-rejection.
  implication: The failing branch is no-acceptance and the rejection originates in the parent's WebP decode.

- timestamp: 2026-10-29T00:00:00Z
  checked: git diff 997afe8e..HEAD -- app/src/components/physic-paint/PhysicsPaintStudio.tsx and app/src-tauri/src/services/frame_codec.rs
  found: The Studio diff is diagnostics-only (AquarelleApplyDiagnostics plumbing). The codec diff changes quality 75 → 50 and method 1 → 0.
  implication: The Studio-side changes of the quick cannot cause this; the codec change is the only behaviour-affecting edit in the window.

- timestamp: 2026-10-29T00:00:00Z
  checked: app/src/components/physic-paint/roto/rotoCanvasFrames.ts (decodeRotoWebpOffMainThread, registerRotoAlphaCanvasFrameFromBytes, buildBlankRotoFrame)
  found: The rejection string is thrown only in the decode path; registration early-returns for already-registered payloads; buildBlankRotoFrame always builds a fully transparent canvas.
  implication: The failing payload is a uniform blank frame, and cloning paths skip the decode entirely — explaining why + Key works.

- timestamp: 2026-10-29T00:00:00Z
  checked: app/src/lib/physicPaintBridge.ts applyPreparedPhysicPaintPayload
  found: prepareRotoPhysicalRealKeyFrames runs on every bytes-carrying record of the edit before the store is touched; any decode failure returns a failure result.
  implication: One undecodable payload rejects the whole physical edit, so no key can be accepted.

- timestamp: 2026-10-29T00:00:00Z
  checked: Pillow/libwebp 1.6.0 encode matrix (content × method × quality) probed with dwebp, webpinfo and sips.
  found: method 0 emits a 34-byte stream for any uniform frame; webpinfo and dwebp accept it, sips reports nil dimensions. Non-uniform content and method 1/4 decode correctly at every quality.
  implication: libwebp method 0's trivial single-colour stream is the defect surface; Apple's decoder is the strict consumer.

- timestamp: 2026-10-29T00:00:00Z
  checked: Dimension sweep of uniform transparent frames at method 0.
  found: 64×64 through 768×768 decode; 999×999 and above fail, including 1080×1920 and 1920×1080.
  implication: Every Studio canvas size is affected, so blank key creation is systematically broken.

- timestamp: 2026-10-29T00:00:00Z
  checked: Fix in app/src-tauri/src/services/frame_codec.rs — encode_rgba re-encodes at method 1 when the method-0 payload is below TRIVIAL_SINGLE_COLOUR_PAYLOAD_FLOOR (64 B); new regression test `uniform_1080x1920_frame_never_emits_the_apple_rejected_trivial_stream`.
  found: RED at base — the new test failed with "uniform 1080x1920 frame encoded to 34 bytes" using the crate's own bundled libwebp, reproducing the external probe exactly. GREEN after the fix: `cargo test --lib` 105 passed / 0 failed (frame_codec module 5/5).
  implication: The fix removes the Apple-rejected stream at the source while leaving method 0 / quality 50 in place for real content, so the 261029-bks perf win is untouched. Native UAT is the only remaining gate.

- timestamp: 2026-10-29T00:00:00Z
  checked: Native UAT in the app, run by the user (five rows: paint on empty non-real frame, paint on interpolated non-real frame, fresh-start '+ Rail', no promotion capsule on either, '+ Key' regression).
  found: User verdict "UAT approved, work now" — all five rows pass.
  implication: The regression is closed end-to-end; no frontend change was needed and no further investigation is required.

## Resolution

root_cause: |
  Quick 261029-bks set WebPLosslessCodec::encode_rgba to libwebp method 0 /
  quality 50. For a UNIFORM frame (single colour — exactly the fully
  transparent canvas buildBlankRotoFrame builds), method 0 takes a trivial
  single-colour fast path and emits a 34-byte VP8L stream. The stream is
  spec-valid and libwebp decodes it, but Apple's ImageIO/WebKit decoder rejects
  it. The parent-side prepareRotoPhysicalRealKeyFrames decodes every
  bytes-carrying record before applying, so one blank key payload rejected the
  whole physical edit as parent-rejection, and promotion reported no-acceptance.
  '+ Key' only worked because it clones an already-registered canvas and
  registerRotoAlphaCanvasFrameFromBytes early-returns before decoding.

fix: |
  app/src-tauri/src/services/frame_codec.rs only. encode_rgba keeps
  quality 50 / method 0, then re-encodes the same RGBA at method 1 when the
  produced payload is below TRIVIAL_SINGLE_COLOUR_PAYLOAD_FLOOR (64 B — the
  trivial stream is 34 B, the method-1 uniform stream is ~128 B). Uniform frames
  encode in negligible time either way, so the 261029-bks perf win for real
  content is untouched. No frontend change, no promotion-branch change, no
  migration.

verification: |
  TDD red/green: the new 1080×1920 uniform-frame regression test failed at base
  with the bundled libwebp emitting 34 bytes, and passes with the fallback.
  `cargo test --manifest-path app/src-tauri/Cargo.toml --lib`: 105 passed,
  0 failed (frame_codec module 5/5, was 4).
  Native UAT: pass — user approved 2026-10-29 ("UAT approved, work now") across
  the five requested rows: (1) paint on an empty non-real frame creates a real
  key and keeps the stroke, (2) paint on an interpolated non-real frame creates
  a real key, (3) fresh start, first action '+ Rail' creates a blank key on a
  new rail, (4) no promotion-failure capsule text on either action, (5) '+ Key'
  still works. No frontend file changed, so no vitest surface was involved.

files_changed:
  - app/src-tauri/src/services/frame_codec.rs

postmortem:
  why_not_caught: "The 261029-bks A/B measured encode/decode throughput on real content only; no gate encoded a uniform (blank) canvas — the exact class that takes libwebp method 0's trivial fast path — and libwebp round-trips that stream fine, so a codec-level round-trip check would also have passed."
  guard: "The new regression test `uniform_1080x1920_frame_never_emits_the_apple_rejected_trivial_stream` in frame_codec.rs fails if encode_rgba ever emits a payload under the 64-byte trivial floor."
  artifact: "app/src-tauri/src/services/frame_codec.rs — TRIVIAL_SINGLE_COLOUR_PAYLOAD_FLOOR + the 1080×1920 uniform-frame test."

known_gap: |
  Any uniform real-key payload persisted with method-0 bytes before this fix
  would still fail launch hydration. Creation was blocked during the regression
  window, so the set is expected to be empty; no migration was added.
