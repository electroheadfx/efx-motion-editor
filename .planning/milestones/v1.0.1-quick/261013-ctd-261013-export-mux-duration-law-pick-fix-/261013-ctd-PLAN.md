---
phase: quick-261013-ctd
plan: 261013-ctd
type: tdd
wave: 1
depends_on: []
files_modified:
  - app/src-tauri/src/services/ffmpeg.rs
  - app/src/lib/audioExportMixer.test.ts
  - .planning/REQUIREMENTS.md
autonomous: true
requirements: [EXP-01]

estimate:
  tokens: 18000
  raw_tokens: 9000
  tasks: 2
  confidence: low

must_haves:
  truths:
    - "The exported container's audio and video streams have the SAME duration (the shorter one) — no player divergence on short exports (EXP-01)."
    - "When audio is muxed, the ffmpeg encode argv carries the mux-truncation output option so the longer stream is cut at mux time."
    - "The mixer's anti-cut-off duration pad stays internal — app/src/lib/audioExportMixer.ts is byte-untouched and a source-scan pin keeps the pad expression in place."
    - "Video/image render path untouched; 53.1 scope untouched; no version bump."
  artifacts:
    - app/src-tauri/src/services/ffmpeg.rs
    - app/src/lib/audioExportMixer.test.ts
    - .planning/REQUIREMENTS.md
  key_links:
    - "encode_video_args is the single pure argv builder encode_video consumes — the mux-truncation pin lives there, never in a second call site."
    - "audio_path = Some is the only arm that gains the mux-truncation option; the None arm keeps -an and the existing video-only argv."
---

<objective>
Close the export mux duration law: the exported container's audio and video streams have the same duration (the shorter one), so short exports no longer show player divergence (Preview vs VLC/QuickTime). Fix option 2 only — add the ffmpeg mux-truncation output option to the encode command. Do not drop the mixer pad.

Purpose: live UAT 2026-10-13 measured an audio stream 0.5s longer than the video stream. Cause is known: audioExportMixer renders totalDurationSec + 0.5 (anti-cut-off safety, Pitfall 1) and the ffmpeg encode invoke has no mux-truncation option, so the container keeps the longer audio. Option 2 truncates at mux time and keeps the safety pad internal.
Output: a pure encode_video_args builder in app/src-tauri/src/services/ffmpeg.rs, the mux-truncation flag on the audio arm, a RED-first Rust regression leg pinning the argv, a source-scan pin that the mixer pad stays, and EXP-01 in REQUIREMENTS.md.

Scope: v1.0.1 debt-patch quick only (non-blocking). 53.1 scope untouched; no version bump; video/image render path untouched; app/src/lib/audioExportMixer.ts byte-untouched. Stop after automated-ready — UAT is the user's.
</objective>

<execution_context>
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/workflows/execute-plan.md
@/Users/lmarques/Dev/efx-motion-editor/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/todos/pending/261013-export-mux-duration-law.md
@CLAUDE.md

ACCEPTANCE (add EXP-01 to REQUIREMENTS.md during Task 2):
- EXP-01: The exported container's audio and video streams have the same duration (the shorter one).

FIX CONTRACT (brief, locked — option 2 only):
- app/src-tauri/src/services/ffmpeg.rs encode_video (:156) builds Command inline. With audio_path Some it maps 0:v:0 / 1:a:0 and picks pcm_s16le (prores) or aac 192k (else), then writes output_path — no mux-truncation option anywhere.
- app/src/lib/audioExportMixer.ts:100 keeps its Math.ceil duration pad (anti-cut-off safety). That file is OUT OF SCOPE — byte-untouched.
- Law: container audio duration == container video duration == the shorter stream. No player divergence on short exports.

GUARDRAILS (locked):
- 53.1 scope untouched (no frame-model files).
- No version bump (no package.json / tauri.conf / Info.plist edits).
- Video/image render path untouched (exportRenderer, previewRenderer, image encode paths).
- TDD ON: the regression leg pins the ffmpeg args carry the mux-truncation option. RED first.
- app/src/lib/audioExportMixer.ts byte-untouched.
- PATH FORM: every path in this body is repo-root-relative; every command assumes cwd at the checkout root. pnpm, not npm. `vitest run` only, never watch. No dev server.

LANDMARKS (verified live, 2026-10-13):
- app/src-tauri/src/services/ffmpeg.rs — encode_video :156-229; inputs :173-179; codec match :182-200; audio arm :202-216 (`-map 0:v:0 -map 1:a:0`, pcm_s16le / aac 192k); else `-an` :215; output_path last :217. No #[cfg(test)] module yet. Sister modules (frame_codec.rs :64) use inline `#[cfg(test)] mod tests`.
- app/src-tauri/src/commands/export.rs — export_encode_video :78 wraps encode_video in spawn_blocking; no argv knowledge here (stays untouched).
- app/src/lib/audioExportMixer.ts — pad at :100 (`totalDurationSec + 0.5`). Do not edit.
- app/src/lib/audioExportMixer.test.ts — source-scan suite :14-43 via readSource/readFileSync; pad pin belongs in a NEW describe, existing cases byte-untouched.
- gsd_run lives at `.claude/gsd-core/bin/gsd_run` (NOT on PATH) — invoke it by path for frontmatter/structure validation and commit.
- Rust tests: `cargo test --manifest-path app/src-tauri/Cargo.toml <filter> --lib` (house pattern).

SCOPE OUT (do not touch):
- app/src/lib/audioExportMixer.ts and its pad math.
- 53.1 frame-model files, version surfaces, exportRenderer/previewRenderer, vitest.config.ts, any package.json dependency.
</context>

<feature>
  <name>Export mux duration law — ffmpeg argv carries the mux-truncation option (261013-ctd, EXP-01)</name>
  <files>app/src-tauri/src/services/ffmpeg.rs, app/src/lib/audioExportMixer.test.ts, .planning/REQUIREMENTS.md</files>
  <behavior>
    Cases (pure argv builder, no process spawn):
    - encode_video_args(..., audio_path = Some("mix.wav"), codec = "h264") → argv contains the mux-truncation output option and the two map flags; audio codec arm is aac 192k; last element is output_path.
    - encode_video_args(..., audio_path = Some("mix.wav"), codec = "prores") → same mux-truncation option; audio codec arm is pcm_s16le.
    - encode_video_args(..., audio_path = None) → argv keeps `-an`, has no audio map pair, and omits the mux-truncation option (video-only encode is unchanged).
    - Unknown codec still returns Err (fail-closed, existing law).

    Guardrail pin (green-at-birth, honest):
    - audioExportMixer source still contains the anti-cut-off duration pad expression; that file is byte-untouched by this quick.

    Non-regression:
    - encode_video keeps its public signature and still spawns ffmpeg; export_encode_video and the whole video/image render path stay untouched.
  </behavior>
  <implementation>
    Extract a pure `encode_video_args(png_dir, glob_pattern, output_path, codec, fps, quality_args, audio_path) -> Result<Vec<String>, String>` in ffmpeg.rs that returns the full argv after the binary. encode_video builds `Command::new(&ffmpeg)` from that vec (behavior-identical for the None arm). In the audio arm only, insert the mux-truncation output option beside the existing map/codec args so ffmpeg truncates the longer stream at mux time. Keep app/src/lib/audioExportMixer.ts byte-untouched — its duration pad is the anti-cut-off safety and stays internal. Add a source-scan pin for that pad and EXP-01 to REQUIREMENTS.md.
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (RED): pure encode_video_args extract + failing mux-duration legs + pad-stay pin</name>
  <files>app/src-tauri/src/services/ffmpeg.rs, app/src/lib/audioExportMixer.test.ts</files>
  <behavior>
    - New pure encode_video_args returns today's argv (no mux-truncation option yet) so encode_video is behavior-identical after the extract.
    - Leg (a): audio Some + h264 → argv contains the mux-truncation output option and both map flags. RED today: the extract still omits the option.
    - Leg (b): audio Some + prores → same mux-truncation option; pcm_s16le present. RED today: same omission.
    - Leg (c): audio None → argv contains `-an`, no audio map pair, and omits the mux-truncation option. Green after extract (this is the non-regression arm).
    - Leg (d): unknown codec → Err. Green after extract (existing law).
    - Green-at-birth pin (honest): audioExportMixer source-scan still contains the anti-cut-off duration pad expression; existing audioExportMixer cases stay green.
  </behavior>
  <action>Test-first for the new builder, then the extract — no mux-truncation production change in this commit. Read .claude/skills/tdd/SKILL.md first.

(1) app/src-tauri/src/services/ffmpeg.rs — add `#[cfg(test)] mod tests` at the bottom (mirror frame_codec.rs:64 style). Implement a pure `pub(crate) fn encode_video_args(...)` that returns `Result<Vec<String>, String>` carrying exactly the argv encode_video passes to Command today (inputs, codec arm, audio map/codec arm or `-an`, output_path last). Refactor encode_video to `Command::new(&ffmpeg)` + those args — the spawn/output/error handling body stays as-is. Do NOT add the mux-truncation option yet.

Tests (new describe-equivalent, names carry the law):
- `encode_video_args_audio_h264_carries_shortest_and_maps` — quality VideoQualityArgs { h264_crf: 23, av1_crf: 30, prores_profile: "hq".into() }; assert the returned vec contains the two map flags and the mux-truncation output option (the option string is the ffmpeg output flag that stops at the shorter stream), contains aac + 192k, and ends with output_path.
- `encode_video_args_audio_prores_carries_shortest_and_pcm` — same with codec "prores"; assert mux-truncation option + pcm_s16le + yuva444p10le.
- `encode_video_args_no_audio_keeps_an_and_omits_shortest` — audio None; assert `-an` present, no `-map` pair, and the mux-truncation option absent (this one goes green at extract and stays green).
- `encode_video_args_unknown_codec_errors` — codec "gif" returns Err naming the codec.

RED evidence: the two audio legs fail on the missing mux-truncation option; the no-audio and unknown-codec legs pass. Record the failing assertion messages in the commit body.

(2) app/src/lib/audioExportMixer.test.ts — NEW top-level describe `261013-ctd export mux duration pad (EXP-01)` beside the existing ones (existing cases byte-untouched). One source-scan case using the file's existing readSource helper: assert the source still contains the anti-cut-off duration pad expression (`totalDurationSec + 0.5`). This pin is green-at-birth — it guards the brief's do-not-touch law, it is not the RED leg.

Sanity gates: `git diff --stat` lists only those two files; `git diff app/src/lib/audioExportMixer.ts` is empty; `git diff app/vitest.config.ts app/package.json` is empty.

Commit as `test(261013-ctd): RED — pin ffmpeg mux args carry -shortest (EXP-01)`.
</action>
  <verify>
    <automated>cargo test --manifest-path app/src-tauri/Cargo.toml encode_video --lib; exit code 1 is EXPECTED here (RED) — the two audio legs must fail on the missing mux-truncation option while no-audio and unknown-codec pass; pnpm --filter efx-motion-editor exec vitest run src/lib/audioExportMixer.test.ts</automated>
  </verify>
  <done>RED evidence captured: both audio legs fail against the extracted builder with their own assertion messages; no-audio and unknown-codec pass; encode_video is behavior-identical after the extract (same argv as before, no mux-truncation option yet); the pad-stay source-scan pin passes and audioExportMixer.ts is byte-untouched; existing audioExportMixer cases still pass with zero assertion edits; diff confined to the two files; committed test-first as test(261013-ctd).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (GREEN): add the mux-truncation option on the audio arm + EXP-01 requirement</name>
  <files>app/src-tauri/src/services/ffmpeg.rs, .planning/REQUIREMENTS.md</files>
  <behavior>
    - Task 1 legs (a) and (b) go green with ZERO assertion edits.
    - The audio arm of encode_video_args inserts the mux-truncation output option beside the existing map/codec args (before output_path).
    - The None arm is unchanged (`-an`, no maps, no mux-truncation option).
    - encode_video still spawns ffmpeg with the builder's argv; export_encode_video untouched.
    - REQUIREMENTS.md carries EXP-01 in the checklist and traceability (Quick 5 | Pending), with coverage counts and footer updated.
  </behavior>
  <action>Run Task 1's cargo suite first and watch legs (a)/(b) fail, then implement until green with ZERO Task 1 assertion edits.

(1) app/src-tauri/src/services/ffmpeg.rs — in encode_video_args' audio arm only, add the ffmpeg output option that truncates the longer stream at mux time (the short-form output flag spelled `-shortest` <!-- planner-discipline-allow: -shortest -->), placed with the other output options before the output_path element. Leave the None arm, the codec arms, and encode_video's spawn/error body untouched. Update the encode_video doc comment: audio muxing truncates at mux time so container stream durations match (EXP-01); the mixer's duration pad stays internal.

(2) .planning/REQUIREMENTS.md — add during this task:
- New checklist section after SND: `### EXP — Export Mux Duration Law` with `- [ ] **EXP-01**: The exported container's audio and video streams have the same duration (the shorter one)`.
- Traceability row: `| EXP-01 | Quick 5 | Pending |`.
- Coverage block: `v1 requirements: 11 total` → `12 total`, `Mapped to quicks/release: 11` → `12`.
- Footer: append (keep the existing line) `*2026-10-13 — EXP-01 defined (Quick 5, export mux duration law, option 2); 12/12 mapped, status Pending until native UAT*`.

Sanity gates: `grep -c "EXP-01" .planning/REQUIREMENTS.md` ≥ 3; `git diff app/src/lib/audioExportMixer.ts app/src/lib/exportEngine.ts app/src-tauri/src/commands/export.rs` is empty; `git diff --stat` lists only the two Task-2 files.

Commit as `fix(261013-ctd): ffmpeg mux truncates at the shorter stream (EXP-01)`.
</action>
  <verify>
    <automated>cargo test --manifest-path app/src-tauri/Cargo.toml encode_video --lib && pnpm --filter efx-motion-editor exec vitest run src/lib/audioExportMixer.test.ts</automated>
  </verify>
  <done>Task 1 legs (a)/(b) green with zero assertion edits; the audio arm carries the mux-truncation output option before output_path; the None arm keeps -an and omits that option; encode_video consumes the builder; audioExportMixer.ts, exportEngine.ts, commands/export.rs, and every video/image render path file are byte-untouched; no version surface edited; REQUIREMENTS.md carries EXP-01 in checklist + traceability + coverage + footer; both suites green; one atomic commit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| pre-rendered WAV path → ffmpeg second input | the path is already app-produced; the new flag only changes mux-length policy, not path handling |
| ffmpeg argv builder → spawned process | the pure builder is the single place output options are assembled — no second call site can drift |

## STRIDE Threat Register

Threat IDs are unique within this quick; no prior PLAN files exist in this directory (T-261013-CTD-SC is reserved and kept).

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261013-CTD-01 | Integrity | encode_video audio arm — container stream durations disagree and players show divergent tails | medium | mitigate | Audio arm only gains the mux-truncation output option so both streams end at the shorter length (EXP-01); legs (a)/(b) pin the argv; native UAT runs ffprobe on a short export |
| T-261013-CTD-02 | Integrity | audioExportMixer pad — a fix that drops the anti-cut-off safety would reintroduce audio cut-off | medium | mitigate | That file is out of scope and byte-untouched; a source-scan pin keeps the duration pad expression; git diff guard in both tasks |
| T-261013-CTD-SC | Tampering | npm/pip/cargo installs | high | mitigate | No package installs in this plan — zero install surface, so no legitimacy checkpoint is required |

</threat_model>

<verification>
- Per-task automated gates: `cargo test --manifest-path app/src-tauri/Cargo.toml encode_video --lib` (RED then GREEN) and `pnpm --filter efx-motion-editor exec vitest run src/lib/audioExportMixer.test.ts` (run only, never watch).
- Guardrail audit: `git diff app/src/lib/audioExportMixer.ts` empty; `git diff` confined to the plan's files; 53.1 frame-model files, version surfaces, exportRenderer/previewRenderer untouched.
- Requirements trace: EXP-01 = Task 1 (RED legs + pad pin) and Task 2 (GREEN flag + REQUIREMENTS entry).
- Status stays automated-ready until the user judges the live UAT row (no server started by the executor):

| # | Case | Pass condition |
|---|------|----------------|
| 1 | Short export with audio, ffprobe | container audio duration == video duration (the shorter one); no player divergence on the tail frame |

- After UAT pass: this quick is non-blocking for the v1.0.1 release (53.1 frame-model UAT remains the only release gate).
</verification>

<success_criteria>
- EXP-01 passes every automated leg AND the user's ffprobe UAT row passes — nothing is claimed done before that (status = automated-ready)
- Audio-muxed encode argv carries the mux-truncation option; video-only encode is unchanged
- The mixer's anti-cut-off duration pad stays internal and the file is byte-untouched
- Guardrails held: 53.1 untouched, no version bump, video/image render path untouched, zero pre-existing assertion edits
</success_criteria>

<output>
Create .planning/quick/261013-ctd-261013-export-mux-duration-law-pick-fix-/261013-ctd-SUMMARY.md when done (commit style: `test(261013-ctd): …` / `fix(261013-ctd): …`)
</output>
