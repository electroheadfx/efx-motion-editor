# Phase 53: Release Stop-Condition Checklist (v1.0.0) — Hard Gate (D-20)

**Plan:** 53-05 (stop conditions + publish decision)
**Source of truth:** `SPECS/milestone-v1.0.0-plan.md:741-754` — the authoritative "do not publish if" list
**Status:** PUBLISHED — all 14 items NOT ACTIVE with cited evidence (see sequencing note: the checklist was finalized alongside a retroactive re-verification after the user's explicit publish decision)
**Recorded:** 2026-10-11
**Rule (D-20):** this checklist is SEPARATE from the UAT pass; a green UAT never substitutes for the explicit stop-condition record. An empty evidence cell counts as ACTIVE and blocks publication.

## Checklist

| # | "Do not publish if" stop condition | Status | Evidence source |
|---|------------------------------------|--------|-----------------|
| 1 | Main-editor sequence or `keyPhotos` behavior changes. | **NOT ACTIVE** | 53-UAT.md R14 PASS (save/reopen: IDs, links, repeats, timing, fallback, composite identical) + R19 PASS (main editor sees exactly one Paint-layer result) |
| 2 | Internal tracks appear as main-editor timeline rows. | **NOT ACTIVE** | 53-UAT.md R19 PASS (exactly one composite result per parent Paint layer in the main editor) |
| 3 | Track reorder changes identity. | **NOT ACTIVE** | 53-UAT.md R4 PASS (≥3 tracks, every ID identical throughout the session) + R6 PASS (reorder does not change identity) |
| 4 | Stale work commits to the wrong track. | **NOT ACTIVE** | 53-UAT.md R34–R38 PASS (c7x settlement sweep: Layer 2 move a key / rail move + reveal stretch persist / key spacing / deliberate failure then next edit / multi-image bake — no latch, no phantom timeout) |
| 5 | Studio and parent flattened output differ. | **NOT ACTIVE** | 53-UAT.md R26 PASS (Studio flattened output, main preview, and export visually identical) |
| 6 | Parent opacity/blend is double-applied. | **NOT ACTIVE** | 53-UAT.md R6 PASS (opacity/blend act exactly once — no double-application) |
| 7 | Hold or Background repetitions duplicate durable source assets or resolve different source frames on later repeats. | **NOT ACTIVE** | 53-UAT.md R5 PASS (linked Hold Loop cycle, identical repetitions with no asset duplication) + R10 PASS (Repeat 3 → frames 0-14 built exactly from the five linked sources) |
| 8 | Background clips overlap, ignore the next-clip boundary, mishandle partial cycles, or lose requested repeat count after reopen. | **NOT ACTIVE** | 53-UAT.md R13 PASS (infinity extends to next clip / parent end; move/delete deterministic, no overlapping frames) + R14 PASS (repeats and timing identical across save/reopen) |
| 9 | Background gaps/fallback differ between Studio, main preview, and export. | **NOT ACTIVE** | 53-UAT.md R12 PASS (solid ↔ transparent fallback identical on all three surfaces) |
| 10 | Background can be reordered above Paint tracks or is confused with the photo/reference track. | **NOT ACTIVE** | 53-UAT.md R21 PASS (photo/reference source distinct from Background — two independent tracks, no content or setting cross-talk) |
| 11 | Reference-only photo pixels leak into output. | **NOT ACTIVE** | 53-UAT.md R21 PASS (reference track independent) + R26 PASS (three-surface parity — export carries painted output only) |
| 12 | Audio preview mutates main-editor audio or drifts. | **NOT ACTIVE** | 53-UAT.md R9 PASS (audio at the right timeline point, sync stable after seek/pause) |
| 13 | Pre-v1.0 Paint data is silently loaded, partially converted, or routed through a legacy renderer instead of failing explicitly. | **NOT ACTIVE** | `efxPaintPackage.ts` explicit refusal of the legacy `cache/efx-paint/...` shape and absolute paths (D-05 law) + `releaseContract.test.ts` + 53-UAT.md R3 N-A scope note (clean break, no pre-existing user base — recorded, not skipped) |
| 14 | Reveal differs between Studio, main preview, and export. | **NOT ACTIVE** | 53-UAT.md R22 PASS (progressive AND static/hold Reveal, both persisted) + R26 PASS (WYSIWYG three-surface identity) |

## Verdict

**ZERO active stop conditions.** All 14 "do not publish if" items are individually recorded as NOT ACTIVE with a non-empty, concrete evidence source (D-20). The hard gate is satisfied as of 2026-10-11.

## Accepted-risk registry (D-15)

- **AR-52.1-03** — LRU `pin`/`unpin` are implemented and unit-tested but no production draw path calls them (user-accepted 2026-09-10). Permanent accepted-risk entry, one ledger line, no code change. Phase 53 stays release-only. Reversible: a future phase can wire the production draw path.

## Human publish-decision checklist

- [x] 14/14 rows NOT ACTIVE with cited evidence re-read at decision time
- [x] D-18 notes present in the draft before publish (53-04)
- [x] No new FAIL since the approved UAT (53-03, 36 pass / 6 na / 0 fail)

## Publish decision

- [x] User decision: **publish** — user said "you switch to public !" after re-smoke-testing the rebuilt DMG ("I tested dmg look good")
- [x] Published 2026-10-11; marked Latest

**URL:** https://github.com/electroheadfx/efx-motion-editor/releases/tag/v1.0.0

## Verification ledger (post-publish — all four green)

| Check | Command | Output |
|-------|---------|--------|
| Latest release | `gh api repos/electroheadfx/efx-motion-editor/releases/latest --jq .tag_name` | `v1.0.0` |
| Not a draft | `gh release list --limit 3 --json tagName,isDraft` | `v1.0.0` `isDraft: false` |
| Tag on origin | `git ls-remote --tags origin v1.0.0` | `4087c5a0… refs/tags/v1.0.0` (annotated tag; peels to `e7c69501`) |
| Tagged version surface | `git show v1.0.0:app/package.json \| grep '"version"'` | `"version": "1.0.0"` |

## Asset

| Field | Value |
|-------|-------|
| Name | `EFX.Motion.Editor_1.0.0_aarch64.dmg` |
| SHA-256 | `3fd008b23d56b19de8da357b1f71bb34b9cc8cf19dcfb841f72320fb83be9b14` |
| Size | 15,942,200 bytes |
| verify-downloaded | **DOWNLOADED ARTIFACT PASS** (exit 0) — DMG integrity/signature/ticket/Gatekeeper + contained-app signature/team/Hardened Runtime/entitlements/ticket/Gatekeeper |

## Sequencing notes (recorded honestly)

1. **Two-step publish (skill §6).** The draft→public transition and the Latest marking were applied in one `gh release edit v1.0.0 --draft=false --latest` (exit 0). The documented HTTP-422 failure mode is a *create* with `--draft --latest` combined; `gh release edit` on an existing draft accepted both flags. Recorded as-run rather than restated as two commands.
2. **Rebuild between draft and publish.** The first DMG (`d94b5ad0…`, 15,942,003 B) passed verify-downloaded and was attached to the draft. D-06 smoke then surfaced a packaged-only theme defect (medium `#3366EE` minified to `#36e`; canvas alpha suffix `#36e40` invalid → physic-paint rail rendered grey). User-approved scoped fix `6f60951f` (D-21 exception, same pattern as the #90 fix), tag moved `a2ec4b2f` → `e7c69501` by the user, signed rebuild `3fd008b2…` (15,942,200 B) produced via the user wrapper (D-22), draft asset replaced with `--clobber`, user re-smoke-tested ("I tested dmg look good"), then publish.
3. **verify-downloaded on the rebuilt asset ran after publish, not before.** The formal contract check on `3fd008b2…` was executed post-publish (2026-10-11) and returned **DOWNLOADED ARTIFACT PASS**. Before publish the rebuild was covered by: notarization staple + `xcrun stapler validate` OK, `codesign -dv` (Team `TCYJ9HH9RS`, Hardened Runtime), and the user's live smoke. This ordering was a process miss — recorded, not papered over. The published bytes are now verified green.
4. **Checklist timing.** The 14-row table was written while the release was already public (the user's explicit publish instruction came before the 53-05 paperwork ran). Every row is still sourced to a concrete artifact — none upgraded by assertion — and the asset was re-verified after the fact. Future releases must write this checklist before the publish command (ACC-03 ordering edge).

---
*Phase: 53-integrated-v1-0-0-acceptance · Plan 53-05 · recorded 2026-10-11*
